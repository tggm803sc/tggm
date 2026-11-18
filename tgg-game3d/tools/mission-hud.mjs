// Wires src/mission.js into the HUD and completion card.
//
// Same discipline as tools/verified-save.mjs: exact source anchors, and the build
// throws if any anchor is missing, so the HUD cannot silently fall back to
// stale wording while the tested module says something else.

export const IMPORT_ANCHOR = "import * as THREE from 'three';";

export const STAGE_BLOCK = [
  '  stageProgressText.textContent = state.complete',
  "    ? 'Act I complete'",
  '    : `Stage ${state.stage + 1} of ${stops.length}`;',
].join('\n');

// The persistent arrival banner is written in the same place as the stage line, so
// every path that changes the stage (arrival, restart, completion) repaints it.
export const STAGE_REPLACEMENT = [
  '  stageProgressText.textContent = stageProgress({ stage: state.stage, total: stops.length, complete: state.complete, legs: state.legs });',
  "  checkpointBannerText.textContent = checkpointBanner({ stage: state.stage, total: stops.length, complete: state.complete, legs: state.legs, remaining: stops[state.stage] ? stops[state.stage].objective : '' });",
].join('\n');

// Element handle, next to the other HUD handles so the DOM contract stays in one place.
export const DOM_ANCHOR = "const stageProgressText = document.getElementById('stageProgress');";
export const DOM_REPLACEMENT = `${DOM_ANCHOR}\nconst checkpointBannerText = document.getElementById('checkpointBanner');`;

export const SUMMARY_BLOCK = [
  '  runSummaryText.textContent = state.complete',
  '    ? `Run ${formatTime(state.runTime)}${splits ? ` (${splits})` : \'\'} · ${lastSaved}`',
  "    : '';",
].join('\n');

export const SUMMARY_REPLACEMENT =
  "  runSummaryText.textContent = state.complete\n    ? completionSummary({ runTime: state.runTime, legs: state.legs, best: state.best, saved: lastSaved })\n    : '';";

const MISSION_IMPORT =
  "import { canAdvance, checkpointBanner, completionSummary, objectiveLabel, stageProgress } from './mission.js';";

// The objective line is set in two places: when a stop is reached and on restart.
export const OBJECTIVE_BLOCK = '  objectiveText.textContent = stops[state.stage].objective;';
export const OBJECTIVE_REPLACEMENT =
  '  objectiveText.textContent = objectiveLabel(stops[state.stage], { stage: state.stage, total: stops.length });';

// Advance guard: a repeated arrival must never re-award the run.
export const ADVANCE_BLOCK = 'function advanceStage() {\n  state.stage += 1;';
export const ADVANCE_REPLACEMENT =
  'function advanceStage() {\n  if (!canAdvance(state)) return;\n  state.stage += 1;';

/**
 * @param {string} source raw src/main.js (after applyVerifiedSave)
 * @returns {string} source whose mission wording and advance guard come from mission.js
 * @throws if the anchors are missing
 */
export function applyMissionHud(source) {
  if (typeof source !== 'string' || source.trim() === '') {
    throw new Error('mission-hud: empty main.js');
  }
  if (source.includes(MISSION_IMPORT)) return source; // already applied
  if (!source.includes(STAGE_BLOCK)) {
    throw new Error('mission-hud: the stage progress line changed; update tools/mission-hud.mjs');
  }
  if (!source.includes(SUMMARY_BLOCK)) {
    throw new Error('mission-hud: the run summary line changed; update tools/mission-hud.mjs');
  }
  if (!source.includes(DOM_ANCHOR)) {
    throw new Error('mission-hud: the HUD element handles moved; update tools/mission-hud.mjs');
  }
  if (!source.includes(OBJECTIVE_BLOCK)) {
    throw new Error('mission-hud: the objective assignment changed; update tools/mission-hud.mjs');
  }
  if (!source.includes(ADVANCE_BLOCK)) {
    throw new Error('mission-hud: advanceStage() changed; update tools/mission-hud.mjs');
  }
  if (!source.includes(IMPORT_ANCHOR)) {
    throw new Error('mission-hud: could not find the THREE import to attach the mission import to');
  }

  const patched = source
    .replace(STAGE_BLOCK, STAGE_REPLACEMENT)
    .replace(SUMMARY_BLOCK, SUMMARY_REPLACEMENT)
    .replaceAll(OBJECTIVE_BLOCK, OBJECTIVE_REPLACEMENT)
    .replace(ADVANCE_BLOCK, ADVANCE_REPLACEMENT)
    .replace(DOM_ANCHOR, DOM_REPLACEMENT);
  if (
    patched.includes(STAGE_BLOCK) ||
    patched.includes(SUMMARY_BLOCK) ||
    patched.includes(OBJECTIVE_BLOCK) ||
    patched.includes(ADVANCE_BLOCK)
  ) {
    throw new Error('mission-hud: an anchor survived the replacement');
  }
  // DOM_ANCHOR stays in place by design (the replacement re-states it), so it is
  // checked for exactly one handle instead of for survival.
  const handles = patched.split("const checkpointBannerText = document.getElementById('checkpointBanner');").length - 1;
  if (handles !== 1) {
    throw new Error('mission-hud: an anchor survived the replacement');
  }
  return patched.replace(IMPORT_ANCHOR, `${IMPORT_ANCHOR}\n${MISSION_IMPORT}`);
}
