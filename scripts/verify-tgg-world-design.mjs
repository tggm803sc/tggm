#!/usr/bin/env node
import fs from 'node:fs/promises';

const designPath = 'game/world/world-design-v1.json';
const design = JSON.parse(await fs.readFile(designPath, 'utf8'));

const checks = {};
const check = (name, ok) => { checks[name] = Boolean(ok); };
const isStr = v => typeof v === 'string' && v.trim().length > 0;
const isNum = v => typeof v === 'number' && Number.isFinite(v);
const isInt = v => Number.isInteger(v);
const inRange01 = v => isNum(v) && v >= 0 && v <= 1;
const unique = list => new Set(list).size === list.length;
const exists = async p => { try { await fs.access(p); return true; } catch { return false; } };

const CANON_RELEASE_STATES = ['draft', 'mastered', 'delivery-pending', 'released'];
const CANON_ACT_ONE_STAGES = ['hq', 'drive-to-studio', 'produce-master', 'deliver-to-vault', 'complete'];
const CANON_SCREENS = {
  1: 'Cinematic Title Screen',
  2: 'Live Gameplay HUD',
  3: 'In-World TGG Phone',
  4: 'Mission Center',
  5: 'Garage & TGG Motors',
  6: 'Studio 808',
  7: 'The Vault / Music Career',
  8: 'Cypher Street Plaza',
  9: 'Multiplayer & Collab',
  10: 'Pause & Settings',
  11: 'Loading & Connection States',
  12: 'Mobile Gameplay HUD'
};
const MISSION_KINDS = ['drive', 'deliver', 'produce', 'cypher', 'explore', 'race', 'combat', 'story'];
const CREW_STANCES = ['home', 'ally', 'rival', 'antagonist', 'neutral'];
const VEHICLE_CLASSES = ['sport', 'muscle', 'lowrider', 'suv', 'motorbike', 'drift', 'hyper'];
const REQUIRED_COMPONENTS = [
  'APlayerCharacter',
  'UWeaponCombatComponent',
  'UDashComponent',
  'UInventoryComponent',
  'UEquipmentComponent',
  'ATrapPoolManager',
  'UAudioMiddlewareComponent',
  'UMatchmakingEloComponent',
  'ASaveLoadManager'
];
const REQUIRED_DECISIONS = [
  'od-economy',
  'od-mission-stage-type',
  'od-ending-canon',
  'od-combat-rating',
  'od-royalty-semantics',
  'od-wager-policy',
  'od-save-schema-v2',
  'od-crew-cap'
];

// ---- document identity -----------------------------------------------------
check('schema', design.schema === 'tgg.world.design.v1');
check('version', /^\d+\.\d+\.\d+$/.test(String(design.version)));
check('status_design_only', design.status === 'DESIGN_ONLY_NOT_IMPLEMENTED');

const canon = design.canon || {};
check('canon_repository', canon.repository === 'tggm803sc/tggm');
check('canon_branch', canon.development_branch === 'tgg-world-mega-1000x');
check('canon_overlay', canon.development_overlay === '1000x-v200');
check('canon_frozen_release', canon.frozen_release === 'whole-world-consolidated-v135');
check('canon_campaign', canon.campaign === 'The Sound of the Streets');
check('canon_ui_contract', canon.ui_contract === 'docs/TGG-WORLD-12-SCREEN-UI-HANDOFF.md');
check('canon_design_bible', canon.design_bible === 'docs/TGG-WORLD-DESIGN-BIBLE.md');
check('canon_release_states', JSON.stringify(canon.release_states) === JSON.stringify(CANON_RELEASE_STATES));
check('canon_act_one_stages', JSON.stringify(canon.act_one_stages) === JSON.stringify(CANON_ACT_ONE_STAGES));
check('design_bible_present', await exists('docs/TGG-WORLD-DESIGN-BIBLE.md'));

const scriptPath = typeof canon.campaign_script === 'string' ? canon.campaign_script : '';
check('canon_campaign_script', scriptPath === 'docs/TGG-WORLD-SCRIPT-ACTS-I-III.md');
check('campaign_script_present', isStr(scriptPath) && await exists(scriptPath));

// ---- world ----------------------------------------------------------------
const world = design.world || {};
const districts = Array.isArray(world.districts) ? world.districts : [];
const districtIds = districts.map(d => d.id);
const districtById = new Map(districts.map(d => [d.id, d]));
const bounds = world.boundsMeters || {};

check('world_city', isStr(world.city));
check('world_region', isStr(world.region));
check('world_bounds', isNum(bounds.minX) && isNum(bounds.maxX) && isNum(bounds.minZ) && isNum(bounds.maxZ)
  && bounds.minX < bounds.maxX && bounds.minZ < bounds.maxZ);
check('world_day_length', isNum(world.dayLengthRealMinutes) && world.dayLengthRealMinutes > 0);
check('world_district_count', districts.length === 8);
check('world_district_ids_unique', unique(districtIds));
check('world_one_undersurface', districts.filter(d => d.surface === false).length === 1
  && districts.some(d => d.id === 'undertow' && d.surface === false));
check('world_surface_districts', districts.filter(d => d.surface === true).length === 7);

check('world_district_fields', districts.every(d =>
  isStr(d.id) && isStr(d.name) && isStr(d.role) && isStr(d.storyFunction)
  && isNum(d.center && d.center.x) && isNum(d.center && d.center.z)
  && isNum(d.radiusMeters) && d.radiusMeters > 0
  && (d.safehouse === null || isStr(d.safehouse))
  && Array.isArray(d.adjacent) && d.adjacent.length > 0
  && d.acoustics && inRange01(d.acoustics.reverbSend) && inRange01(d.acoustics.occlusion)
  && 'surface' in d));

check('world_districts_inside_bounds', districts.every(d =>
  d.center.x - d.radiusMeters >= bounds.minX
  && d.center.x + d.radiusMeters <= bounds.maxX
  && d.center.z - d.radiusMeters >= bounds.minZ
  && d.center.z + d.radiusMeters <= bounds.maxZ));

check('world_adjacency_resolves', districts.every(d => d.adjacent.every(a => districtById.has(a))));
check('world_adjacency_no_self', districts.every(d => !d.adjacent.includes(d.id)));
check('world_adjacency_symmetric', districts.every(d =>
  d.adjacent.every(a => (districtById.get(a)?.adjacent || []).includes(d.id))));
check('world_adjacency_unique', districts.every(d => unique(d.adjacent)));

const travel = world.travel || {};
check('world_travel_defined', isStr(travel.fastTravel)
  && Array.isArray(travel.forbiddenDuring) && travel.forbiddenDuring.length > 0
  && isStr(travel.cost) && isStr(travel.undertowRadar));

// ---- crews and characters --------------------------------------------------
const crews = Array.isArray(design.crews) ? design.crews : [];
const crewIds = crews.map(c => c.id);
const characters = Array.isArray(design.characters) ? design.characters : [];
const characterIds = characters.map(c => c.id);

check('crew_ids_unique', unique(crewIds));
check('crews_defined', crews.length >= 5);
check('crew_fields', crews.every(c => isStr(c.id) && isStr(c.name)
  && CREW_STANCES.includes(c.stance)
  && districtById.has(c.homeDistrictId)
  && isStr(c.function) && isStr(c.arc)));
check('crew_stance_home_once', crews.filter(c => c.stance === 'home').length === 1);
check('crew_roster_populated', crews.every(c => characters.some(ch => ch.crewId === c.id)));

check('character_ids_unique', unique(characterIds));
check('character_fields', characters.every(c => isStr(c.id) && isStr(c.name)
  && (c.alias === null || isStr(c.alias))
  && crewIds.includes(c.crewId)
  && districtById.has(c.homeDistrictId)
  && isStr(c.role)));
check('player_character_present', characters.some(c => c.id === 'player-getta' && c.crewId === 'tgg-collective'));

// ---- campaign -------------------------------------------------------------
const campaign = design.campaign || {};
const acts = Array.isArray(campaign.acts) ? campaign.acts : [];
const missions = acts.flatMap(a => (a.missions || []));
const missionIds = missions.map(m => m.id);
const missionById = new Map(missions.map(m => [m.id, m]));
const missionIndex = new Map(missions.map((m, i) => [m.id, i]));

check('campaign_name', campaign.name === 'The Sound of the Streets');
check('campaign_acts', acts.length === 3 && JSON.stringify(acts.map(a => a.id)) === '[1,2,3]');
check('campaign_act_fields', acts.every(a => isStr(a.name) && isStr(a.theme)));
check('campaign_act_sizes', JSON.stringify(acts.map(a => (a.missions || []).length)) === JSON.stringify([5, 6, 6]));
check('campaign_mission_count', missions.length === 17);
check('campaign_mission_ids_unique', unique(missionIds));
check('campaign_mission_fields', missions.every(m =>
  isStr(m.id) && isStr(m.title) && isInt(m.order) && MISSION_KINDS.includes(m.kind)
  && districtById.has(m.districtId)
  && (m.requires === null || missionById.has(m.requires))
  && Array.isArray(m.objectives) && m.objectives.length >= 2 && m.objectives.length <= 4
  && m.objectives.every(isStr)
  && Array.isArray(m.unlocks) && m.unlocks.length > 0 && m.unlocks.every(isStr)
  && Array.isArray(m.screenIds) && m.screenIds.length > 0
  && unique(m.screenIds) && m.screenIds.every(id => isInt(id) && id >= 1 && id <= 12)));
check('campaign_mission_order', acts.every(a => (a.missions || []).every((m, i) => m.order === i + 1)));
check('campaign_requires_acyclic', missions.every((m, i) =>
  m.requires === null || (missionIndex.has(m.requires) && missionIndex.get(m.requires) < i)));
check('campaign_act_one_stages', JSON.stringify((acts[0]?.missions || []).map(m => m.stageId)) === JSON.stringify(CANON_ACT_ONE_STAGES));
check('campaign_later_stages_unset', acts.slice(1).every(a => (a.missions || []).every(m => m.stageId === null)));

const rewardMissions = missions.filter(m => m.rewardTargets !== null);
check('campaign_sample_reward_single', rewardMissions.length === 1 && rewardMissions[0].id === 'i-05-complete');
check('campaign_rewards_display_only', missions.every(m => m.rewardTargets === null
  || (m.rewardTargets.displayOnly === true
    && isStr(m.rewardTargets.provenance)
    && isNum(m.rewardTargets.xp) && m.rewardTargets.xp >= 0
    && isNum(m.rewardTargets.rep) && m.rewardTargets.rep >= 0
    && isNum(m.rewardTargets.cr) && m.rewardTargets.cr >= 0)));

// ---- campaign script coverage ---------------------------------------------
const scriptDoc = isStr(scriptPath) && await exists(scriptPath) ? await fs.readFile(scriptPath, 'utf8') : '';
const sceneIds = [...scriptDoc.matchAll(/^### ([a-z0-9-]+) —/gm)].map(m => m[1]);
const sceneBodies = new Map(scriptDoc.split(/^### /m).slice(1)
  .filter(s => /^[a-z0-9-]+ —/.test(s))
  .map(s => [s.slice(0, s.indexOf(' —')), s]));

check('script_one_scene_per_mission', JSON.stringify(sceneIds) === JSON.stringify(missionIds));
check('script_scenes_have_dialogue', missionIds.every(id => {
  const body = (sceneBodies.get(id) || '').split('\n').slice(1).join('\n');
  return body.includes('**') && body.includes('MISSION COMPLETE:');
}));

// ---- progression ----------------------------------------------------------
const progression = design.progression || {};
const ranks = Array.isArray(progression.ranks) ? progression.ranks : [];
const heat = progression.heat || {};

check('ranks_ladder', ranks.length === 8
  && ranks.every((r, i) => r.level === i && isStr(r.title)
    && isNum(r.xpThreshold) && r.xpThreshold >= 0
    && Array.isArray(r.unlocks) && r.unlocks.length > 0)
  && ranks[0].xpThreshold === 0
  && ranks.every((r, i) => i === 0 || r.xpThreshold > ranks[i - 1].xpThreshold)
  && unique(ranks.map(r => r.title)));
check('rang_status_unapproved', progression.rankStatus === 'DESIGN_TARGET_NOT_APPROVED');
check('heat_defined', heat.maxStars === 5
  && isNum(heat.decaySecondsPerStar) && heat.decaySecondsPerStar > 0
  && Array.isArray(heat.actions) && heat.actions.length > 0
  && heat.actions.every(a => isStr(a.id) && isNum(a.stars) && a.stars > 0)
  && JSON.stringify(heat.lockouts?.map(l => l.stars)) === '[3,5]');

// ---- economy --------------------------------------------------------------
const economy = design.economy || {};
const currencies = Array.isArray(economy.currencies) ? economy.currencies : [];
const currencyIds = currencies.map(c => c.id);
const royalty = currencies.find(c => c.id === 'royalty');

check('economy_unapproved', economy.status === 'DESIGN_TARGET_NOT_APPROVED');
check('economy_currency_ids', unique(currencyIds) && ['cr', 'rep', 'xp', 'royalty'].every(id => currencyIds.includes(id)));
check('economy_currency_fields', currencies.every(c => isStr(c.symbol) && isStr(c.name) && isStr(c.type)
  && Array.isArray(c.earn) && c.earn.length > 0
  && Array.isArray(c.spend)
  && (c.cap === null || (isNum(c.cap) && c.cap > 0))
  && typeof c.displayOnly === 'boolean'
  && c.serverAwarded === true));
check('economy_royalty_fictional', royalty?.displayOnly === true && royalty?.withdrawable === false);
check('economy_rules', Array.isArray(economy.rules) && economy.rules.length >= 5 && economy.rules.every(isStr));

const sample = economy.sampleActOneReward || {};
const missionSample = missionById.get('i-05-complete')?.rewardTargets || {};
check('economy_sample_matches_mission', sample.displayOnly === true
  && sample.missionId === 'i-05-complete'
  && sample.xp === missionSample.xp
  && sample.rep === missionSample.rep
  && sample.cr === missionSample.cr
  && sample.provenance === missionSample.provenance);

// ---- vehicles -------------------------------------------------------------
const vehicles = Array.isArray(design.vehicles) ? design.vehicles : [];
check('vehicles_defined', vehicles.length >= 7);
check('vehicle_ids_unique', unique(vehicles.map(v => v.id)));
check('vehicle_fields', vehicles.every(v => isStr(v.id) && isStr(v.name)
  && VEHICLE_CLASSES.includes(v.class) && isStr(v.role)
  && isInt(v.priceCr) && v.priceCr >= 0
  && isNum(v.topSpeedKph) && v.topSpeedKph > 0
  && isInt(v.seats) && v.seats >= 1
  && v.handling && inRange01(v.handling.grip) && inRange01(v.handling.drift)
  && isNum(v.handling.mass) && v.handling.mass > 0));
check('vehicle_unlocks_resolve', vehicles.every(v => v.unlock === null || missionById.has(v.unlock)));
check('vehicle_starter', vehicles.some(v => v.id === 'vm-coupe-sport' && v.priceCr === 0 && v.unlock === null));
check('vehicle_endgame_locked', vehicles.some(v => v.class === 'hyper' && isStr(v.unlock)));

// ---- music ----------------------------------------------------------------
const music = design.music || {};
const sequencer = music.sequencer || {};
const royaltyModel = music.royaltyModel || {};

check('music_sequencer', sequencer.steps === 16
  && JSON.stringify(sequencer.tracks) === JSON.stringify(['drums', 'bass', 'keys', 'lead', 'fx']));
check('music_release_states', JSON.stringify(music.releaseStates) === JSON.stringify(CANON_RELEASE_STATES));
check('music_master_requirements', Array.isArray(music.masterRequirements) && music.masterRequirements.length >= 3);
check('music_delivery_requirements', Array.isArray(music.deliveryRequirements) && music.deliveryRequirements.length >= 3);
check('music_royalty_display_only', royaltyModel.displayOnly === true
  && royaltyModel.withdrawable === false
  && String(royaltyModel.formula || '').includes('streams'));
check('music_career_milestones', Array.isArray(music.careerMilestones) && music.careerMilestones.length > 0);

// ---- cypher ---------------------------------------------------------------
const cypher = design.cypher || {};
const weights = cypher.scoreWeights || {};
const weightSum = Object.values(weights).reduce((a, b) => a + (isNum(b) ? b : NaN), 0);

check('cypher_format', cypher.rounds === 3 && cypher.barsPerRound === 8
  && isNum(cypher.turnSeconds) && cypher.turnSeconds > 0);
check('cypher_meters', JSON.stringify(cypher.meters) === JSON.stringify(['delivery', 'pocket', 'crowd']));
check('cypher_weights', Math.abs(weightSum - 1) < 1e-9
  && Object.keys(weights).length === 3
  && Object.values(weights).every(w => isNum(w) && w > 0));
check('cypher_rating', cypher.rating?.base === 1000 && cypher.rating?.kFactor === 32
  && cypher.rating?.component === 'UMatchmakingEloComponent');
check('cypher_stakes_rep_only', cypher.stakes === 'rep-only');
check('cypher_rules', Array.isArray(cypher.rules) && cypher.rules.length >= 3 && cypher.rules.every(isStr));
check('cypher_disconnect_policy', isStr(cypher.disconnectPolicy));

// ---- systems, multiplayer, live-ops, pipeline -----------------------------
const mapping = design.systems?.componentMapping || [];
const mappedComponents = mapping.map(m => m.component);
check('systems_component_mapping', mapping.length === REQUIRED_COMPONENTS.length
  && unique(mappedComponents)
  && REQUIRED_COMPONENTS.every(c => mappedComponents.includes(c))
  && mapping.every(m => isStr(m.worldUse) && isStr(m.constraint)));

const multiplayer = design.multiplayer || {};
check('multiplayer_defined', isInt(multiplayer.crewCap) && multiplayer.crewCap > 0
  && Array.isArray(multiplayer.activities) && multiplayer.activities.length > 0
  && Array.isArray(multiplayer.pvp) && multiplayer.pvp.length > 0
  && isStr(multiplayer.openWorld));
check('multiplayer_telemetry_simulated', multiplayer.telemetry === 'SIMULATED'
  && multiplayer.presence === 'SIMULATED' && multiplayer.latency === 'SIMULATED');

const liveOps = design.liveOps || {};
check('liveops_defined', isInt(liveOps.seasonWeeks) && liveOps.seasonWeeks > 0
  && liveOps.calendarStatus === 'NOT_APPROVED');

const pipeline = design.contentPipeline || {};
check('pipeline_provider', pipeline.providerService === 'tgg-higgsfield'
  && pipeline.providerRouter === 'tgg-higgsfield/provider-router.mjs'
  && pipeline.assetLibrary === 'TGG Projects');
check('pipeline_routes', pipeline.routes && Object.values(pipeline.routes).every(isStr)
  && Object.keys(pipeline.routes).length >= 6);
check('pipeline_provenance', Array.isArray(pipeline.provenanceFields)
  && ['jobId', 'providerRoute', 'prompt', 'seed', 'engineVersion', 'createdAt', 'assetId']
    .every(f => pipeline.provenanceFields.includes(f)));
check('pipeline_no_production_claim', pipeline.productionGenerationClaim === false && isStr(pipeline.shippingRule));

// ---- screens and decisions ------------------------------------------------
const bindings = Array.isArray(design.screenBindings) ? design.screenBindings : [];
check('screens_complete', bindings.length === 12
  && JSON.stringify(bindings.map(b => b.screenId)) === JSON.stringify([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]));
check('screens_match_contract', bindings.every(b => b.screen === CANON_SCREENS[b.screenId]));
check('screens_world_features', bindings.every(b => Array.isArray(b.worldFeatures) && b.worldFeatures.length > 0
  && b.worldFeatures.every(isStr)));

const decisions = Array.isArray(design.openDecisions) ? design.openDecisions : [];
const decisionIds = decisions.map(d => d.id);
check('decisions_unique', unique(decisionIds));
check('decisions_cover_open_items', REQUIRED_DECISIONS.every(id => decisionIds.includes(id)));
check('decisions_documented', decisions.every(d => isStr(d.decision) && isStr(d.blocks)));

// ---- report ---------------------------------------------------------------
const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
const report = {
  ok: failed.length === 0,
  gate: 'TGG_WORLD_DESIGN_GATE',
  path: designPath,
  status: design.status,
  counts: {
    districts: districts.length,
    crews: crews.length,
    characters: characters.length,
    acts: acts.length,
    missions: missions.length,
    ranks: ranks.length,
    vehicles: vehicles.length,
    screens: bindings.length,
    open_decisions: decisions.length,
    script_scenes: sceneIds.length
  },
  checks,
  failed
};

console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exit(1);
