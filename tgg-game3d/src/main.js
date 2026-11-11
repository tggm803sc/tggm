import * as THREE from 'three';
import { createCity, HALF, ROAD_LINES } from './city.js';
import { Car } from './car.js';
import { Walker } from './walker.js';
import {
  StudioInterior,
  INTERIOR_ORIGIN,
  INTERIOR_BOUNDS,
  STUDIO_POINTS,
  ENTRANCE,
} from './interior.js';
import { StoryDirector } from './director.js';
import { StudioSession } from './studio.js';
import { initProducer } from './producer.js';
import { assessMaster, normalizePattern, starterPattern, totalHits } from './sequencer.js';
import {
  DELIVERY_PENDING_SECONDS,
  RELEASE_CONFIRM_SECONDS,
  canHandOver,
  confirmFrom,
  releaseFrom,
} from './release.js';
import { Traffic } from './traffic.js';
import { Signals, signalState } from './signals.js';
import { Police } from './police.js';
import { setupMinimap, drawMinimap } from './hud.js';
import { EngineAudio } from './audio.js';
import {
  loadProgress,
  saveProgress,
  clearProgress,
  mixHash,
  downloadSave,
  importSave as parseSaveFile,
} from './progress.js';
import { initMenu } from './menu.js';
import { initScreens } from './screens.js';
import { runSelfTest, formatSelfTest } from './selftest.js';
import { initDaw } from './daw.js';
import {
  IMPACT_SPEED,
  cargoLabel,
  createCargo,
  damageCargo,
  deliverCargo,
  depart,
  failCargo,
  loadCrate,
  normalizeCargo,
  remaining,
  reloadCargo,
  returnLeg,
  claimRoundTrip,
} from './cargo.js';
import { awardContract, careerSummary, createCareer, normalizeCareer } from './career.js';

// Cargo payouts accrue here. The reward itself is claimed on the cargo record, so
// this ledger only ever sees a reward that was handed out once.
let career = normalizeCareer(null);
import { COURIER, canStartJob, completeJob, createJob, jobLabel, normalizeJob, startJob } from './jobs.js';

// Parked in the northbound lane, not on the centreline of a junction.
const SPAWN = { x: 34.5, z: 60, heading: Math.PI };
const AIRFIELD = { x: 234, z: -234 };
// Cargo hall footprint, matching the box built in city.js. Solid to the car,
// walkable inside, with a bay-door gap so you can step in from the apron.
const HALL = { x: AIRFIELD.x + 2, z: AIRFIELD.z + 36, hx: 23, hz: 7.5, doorHx: 5 };
const AIRPORT_SOLIDS = [
  { x: AIRFIELD.x + 2, z: AIRFIELD.z + 36, hx: 23, hz: 7.5 }, // cargo hall
  { x: AIRFIELD.x - 38, z: AIRFIELD.z + 34, hx: 3.4, hz: 3.4 }, // control tower
  { x: AIRFIELD.x + 2, z: AIRFIELD.z - 36, hx: 16, hz: 3.4 }, // parked freighter
];

function insideHall(x, z) {
  return Math.abs(x - HALL.x) < HALL.hx && Math.abs(z - HALL.z) < HALL.hz;
}

function insideSolid(x, z) {
  return AIRPORT_SOLIDS.some(
    (box) => Math.abs(x - box.x) < box.hx && Math.abs(z - box.z) < box.hz,
  );
}
const VAN_BAY = { x: 218, z: -218, heading: 0.8 };

import { createWorldClock } from './worldclock.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x04060a);
scene.fog = new THREE.FogExp2(0x04060a, 0.0038);
const worldFog = scene.fog;

const camera = new THREE.PerspectiveCamera(
  62,
  window.innerWidth / window.innerHeight,
  0.2,
  1400,
);

const compact = window.innerWidth < 900 || /Android|iPhone|iPad/i.test(navigator.userAgent);
// Graphics quality from the main menu. Today it changes render resolution only.
let qualityCap = compact ? 1.35 : 1.75;
const renderer = new THREE.WebGLRenderer({ antialias: !compact, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, qualityCap));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.3;
document.getElementById('scene').appendChild(renderer.domElement);

const hemi = new THREE.HemisphereLight(0x33486b, 0x06080b, 1.2);
scene.add(hemi);
const moon = new THREE.DirectionalLight(0xa7c2ff, 1.7);
moon.position.set(-140, 240, 110);
scene.add(moon);

// The world clock drives sky, fog, sun and moon together. The original night
// look is simply what the palette returns at night, so it is preserved.
const worldClock = createWorldClock({ storage: window.localStorage });
worldClock.load();
let lastClockSave = 0;

// Artificial light follows the clock too: stars, neon windows and signs and
// headlights are on at night and fade out through sunrise. Interior point
// lights are left alone on purpose, so the studio is lit at any hour.
const nightEmitters = [];
const headlights = [];
const streetlamps = [];
let nightCollected = false;
let starField = null;

function collectNightLights() {
  nightCollected = true;
  const seen = new Set();
  scene.traverse((node) => {
    if (node.isPoints && node.geometry === starGeometry) starField = node;
    if (node.isSpotLight) {
      headlights.push({ light: node, base: node.intensity });
      return;
    }
    if (node.isPointLight && node.userData.nightLight) {
      streetlamps.push({ light: node, base: node.intensity });
      return;
    }
    const material = node.material;
    if (!material) return;
    for (const entry of Array.isArray(material) ? material : [material]) {
      if (seen.has(entry)) continue;
      seen.add(entry);
      const nightOnly = entry.userData?.nightOnly === true;
      if (entry.toneMapped === false) {
        nightEmitters.push({ material: entry, base: entry.color.clone(), nightOnly });
      } else if (entry.emissive && entry.emissive.getHex() !== 0) {
        nightEmitters.push({ material: entry, emissive: entry.emissiveIntensity ?? 1, nightOnly });
      }
    }
  });
}

function applyNightLights(factor) {
  if (!nightCollected) collectNightLights();
  // factor is the "lights on" amount: 1 at night, 0 at midday. Stars belong to
  // the night, so they show when it is high, not low.
  if (starField) starField.visible = factor > 0.35;
  for (const entry of headlights) entry.light.intensity = entry.base * (0.04 + 0.96 * factor);
  for (const entry of streetlamps) entry.light.intensity = entry.base * factor;
  for (const entry of nightEmitters) {
    const scale = entry.nightOnly ? factor : 0.5 + 0.5 * factor;
    if (entry.base) entry.material.color.copy(entry.base).multiplyScalar(scale);
    else entry.material.emissiveIntensity = entry.emissive * (entry.nightOnly ? factor : 0.25 + 0.75 * factor);
  }
}

function applyWorldLight() {
  const look = worldClock.look();
  scene.background.set(look.sky);
  if (scene.fog) {
    scene.fog.color.set(look.fog);
    scene.fog.density = look.fogDensity;
  }
  hemi.color.set(look.hemiSky);
  hemi.groundColor.set(look.hemiGround);
  hemi.intensity = look.hemi;
  moon.color.set(look.sunIntensity > look.moonIntensity ? 0xfff2d0 : 0xa7c2ff);
  moon.intensity = Math.max(look.sunIntensity, look.moonIntensity);
  moon.position.set(look.sunX, look.sunY, look.sunZ);
  renderer.toneMappingExposure = look.exposure;
  applyNightLights(look.lights);
}
applyWorldLight();

// Stars above the fog.
const starPositions = [];
for (let i = 0; i < 700; i += 1) {
  const radius = 900;
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(0.15 + Math.random() * 0.85);
  starPositions.push(
    Math.sin(phi) * Math.cos(theta) * radius,
    Math.cos(phi) * radius,
    Math.sin(phi) * Math.sin(theta) * radius,
  );
}
const starGeometry = new THREE.BufferGeometry();
starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
scene.add(
  new THREE.Points(
    starGeometry,
    new THREE.PointsMaterial({
      color: 0x9fb4cc,
      size: 1.6,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0.75,
      fog: false,
    }),
  ),
);

const city = createCity();
scene.add(city.group);

function canOccupy(x, z) {
  if (Math.abs(x) > HALF - 10 || Math.abs(z) > HALF - 10) return false;
  // Nothing drives through the terminal, tower or the parked freighter.
  if (insideSolid(x, z)) return false;
  // The Salt Flats apron is drivable concrete, not a building block.
  if (Math.abs(x - AIRFIELD.x) < 27 && Math.abs(z - AIRFIELD.z) < 27) return true;
  for (const block of city.blocks) {
    if (
      Math.abs(x - block.x) < block.half + 1.4 &&
      Math.abs(z - block.z) < block.half + 1.4
    ) {
      return false;
    }
  }
  return true;
}

// On foot you can use the road and the sidewalk ring, but not the buildings.
function canWalk(x, z) {
  if (Math.abs(x) > HALF - 8 || Math.abs(z) > HALF - 8) return false;
  // Approach corridor from the street to the Studio 808 door.
  if (Math.abs(x - ENTRANCE.x) < 5 && z > -147 && z < -120) return true;
  // Inside the cargo hall you walk the floor, not the walls, and only through
  // the bay-door gap in the apron-facing wall.
  if (insideHall(x, z)) {
    const onWall = Math.abs(z - HALL.z) > HALL.hz - 0.9 || Math.abs(x - HALL.x) > HALL.hx - 0.9;
    const inDoorway =
      z - HALL.z < -(HALL.hz - 1.8) && Math.abs(x - HALL.x) < HALL.doorHx;
    return !onWall || inDoorway;
  }
  // Tower and freighter are solid on foot too.
  if (insideSolid(x, z)) return false;
  // Salt Flats apron, minus the hangar shell.
  if (Math.abs(x - AIRFIELD.x) < 26 && Math.abs(z - AIRFIELD.z) < 26) {
    return !(Math.abs(x - (AIRFIELD.x - 14)) < 13.5 && Math.abs(z - (AIRFIELD.z - 16)) < 8.5);
  }
  for (const block of city.blocks) {
    if (
      Math.abs(x - block.x) < block.half - 6 &&
      Math.abs(z - block.z) < block.half - 6
    ) {
      return false;
    }
  }
  return true;
}

const car = new Car(canOccupy);
scene.add(car.group);

// The cargo van waits at the Salt Flats bay until the freight run starts.
const van = new Car(canOccupy, { van: true });
van.reset(VAN_BAY.x, VAN_BAY.z, VAN_BAY.heading);
scene.add(van.group);
let driving = car;

// Cargo-bay activity: two workers pacing inside the hall and a pallet shuttle.
// Presentation only — nothing here reads or writes mission state.
const yard = new THREE.Group();
scene.add(yard);
const yardWorkers = [];
let yardClock = 0;
{
  const hiVis = new THREE.MeshStandardMaterial({ color: 0xf2c14e, roughness: 0.7 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xd9a066, roughness: 0.8 });
  const helmet = new THREE.MeshStandardMaterial({ color: 0xf3f4f0, roughness: 0.5 });
  const trousers = new THREE.MeshStandardMaterial({ color: 0x2b3440, roughness: 0.85 });
  for (const [dx, dz, phase] of [[6, 30, 0], [-4, 31, Math.PI]]) {
    const body = new THREE.Group();
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.9, 0.42), hiVis);
    torso.position.y = 1.06;
    body.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), skin);
    head.position.y = 1.66;
    body.add(head);
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.29, 0.14, 10), helmet);
    hat.position.y = 1.83;
    body.add(hat);
    for (const legX of [-0.16, 0.16]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.62, 0.22), trousers);
      leg.position.set(legX, 0.31, 0);
      body.add(leg);
    }
    body.position.set(AIRFIELD.x + dx, 0, AIRFIELD.z + dz);
    yard.add(body);
    yardWorkers.push({ body, phase });
  }
}
const palletShuttle = new THREE.Mesh(
  new THREE.BoxGeometry(1.6, 0.3, 1.6),
  new THREE.MeshStandardMaterial({ color: 0x7a5c36, roughness: 0.95 }),
);
palletShuttle.position.set(AIRFIELD.x + 10, 0.25, AIRFIELD.z + 30);
yard.add(palletShuttle);
const shuttleLoad = new THREE.Mesh(
  new THREE.BoxGeometry(1.2, 1.1, 1.2),
  new THREE.MeshStandardMaterial({ color: 0x8a6a3e, roughness: 0.9 }),
);
shuttleLoad.position.y = 0.75;
palletShuttle.add(shuttleLoad);
// A crate rising and settling over the counter, reading as the lift loading it.
const liftCrate = new THREE.Mesh(
  new THREE.BoxGeometry(1.1, 1, 1.1),
  new THREE.MeshStandardMaterial({ color: 0x9a7743, roughness: 0.9 }),
);
liftCrate.position.set(AIRFIELD.x + 3.5, 1.5, AIRFIELD.z + 40.5);
yard.add(liftCrate);

const walker = new Walker(canWalk);
scene.add(walker.group);

const traffic = new Traffic();
scene.add(traffic.group);

const signals = new Signals();
scene.add(signals.group);

const police = new Police();
scene.add(police.group);

const studioInterior = new StudioInterior();
scene.add(studioInterior.group);

const director = new StoryDirector();
const studio = new StudioSession();
let studioBeat = -1;
let studioQuality = 0;
let radioAvailable = false;
let radioOn = false;

const stops = [
  {
    name: 'Studio 808',
    pos: new THREE.Vector3(156, 0, -122),
    objective: 'Drive to Studio 808',
    arrival: 'Studio 808 · park and head inside',
    advanceOnArrival: false,
  },
  {
    name: 'The Vault',
    pos: new THREE.Vector3(-156, 0, 122),
    objective: 'Hand the master to The Vault desk',
    arrival: 'The Vault · press E at the desk to hand over the master',
    advanceOnArrival: false,
  },
  {
    name: 'Salt Flats',
    pos: new THREE.Vector3(AIRFIELD.x, 0, AIRFIELD.z),
    objective: 'Load the cargo van at Salt Flats',
    arrival: 'Salt Flats · press E at the van to load the crates',
    advanceOnArrival: false,
  },
];

const marker = new THREE.Group();
const beamMaterial = new THREE.MeshBasicMaterial({
  color: 0xc7ff00,
  transparent: true,
  opacity: 0.1,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  side: THREE.DoubleSide,
  toneMapped: false,
});
const beam = new THREE.Mesh(
  new THREE.CylinderGeometry(1.5, 2.4, 72, 18, 1, true),
  beamMaterial,
);
beam.position.y = 36;
const ringMaterial = new THREE.MeshBasicMaterial({
  color: 0xc7ff00,
  transparent: true,
  opacity: 0.55,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  side: THREE.DoubleSide,
  toneMapped: false,
});
const ring = new THREE.Mesh(new THREE.RingGeometry(7.4, 9.4, 48), ringMaterial);
ring.rotation.x = -Math.PI / 2;
ring.position.y = 0.14;
marker.add(beam, ring);
scene.add(marker);

const audio = new EngineAudio();
// Mobile browsers keep the audio context suspended until a real gesture. Any
// tap or key unlocks it once, and the producer does the same on its own buttons.
for (const gesture of ['pointerdown', 'keydown', 'touchstart']) {
  window.addEventListener(gesture, () => audio.unlock(), { capture: true, passive: true });
}
// Coming back from the background suspends the context again on mobile.
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) audio.unlock();
});
const input = { throttle: false, brake: false, left: false, right: false };

const overlayStart = document.getElementById('start');
const overlayComplete = document.getElementById('complete');
const overlayBusted = document.getElementById('busted');
const wantedBadge = document.getElementById('wanted');
const objectiveText = document.getElementById('objective');
const distanceText = document.getElementById('distance');
const compass = document.getElementById('compass');
const speedText = document.getElementById('speed');
const gearText = document.getElementById('gear');
const toastElement = document.getElementById('toast');
const directorPanel = document.getElementById('director');
const directorLogline = document.getElementById('directorLogline');
const directorBeats = document.getElementById('directorBeats');
const directorSource = document.getElementById('directorSource');
const studioPrompt = document.getElementById('studioPrompt');
const minimap = setupMinimap(document.getElementById('minimap'));
const deliveryChip = document.getElementById('deliveryChip');
const releaseNote = document.getElementById('releaseNote');
const offlineChip = document.getElementById('offlineChip');
const cargoChip = document.getElementById('cargoChip');
const diagPanel = document.getElementById('diagPanel');
const btnDiag = document.getElementById('btnDiag');
let diagOn = false;
let diagTimer = 0;
let fpsSmooth = 60;

function toggleDiagnostics(force) {
  diagOn = typeof force === 'boolean' ? force : !diagOn;
  diagPanel?.classList.toggle('hidden', !diagOn);
  btnDiag?.setAttribute('aria-pressed', String(diagOn));
  if (diagOn) diagTimer = 1;
}
btnDiag?.addEventListener('click', () => toggleDiagnostics());

// The phone verifies its own build: engine checks, no network, no device lab.
const selfTestPanel = document.getElementById('selfTestPanel');
const btnSelfTest = document.getElementById('btnSelfTest');
let selfTestOn = false;

function mayaSessionReady() {
  return Boolean(journal.maya) && !journal.mayaMix;
}

function runSelfTestPanel() {
  if (!selfTestPanel) return null;
  const report = runSelfTest();
  selfTestPanel.textContent = formatSelfTest(report);
  try {
    localStorage.setItem(
      'tgg.selftest',
      JSON.stringify({ at: report.at, passed: report.passed, total: report.total, failed: report.failed }),
    );
  } catch {
    // Storage is optional; the report on screen is the point.
  }
  showToast(
    report.failed === 0
      ? `Self-test · ${report.passed}/${report.total} passed`
      : `Self-test · ${report.failed} failed`,
  );
  return report;
}

function toggleSelfTest(force) {
  const show = typeof force === 'boolean' ? force : !selfTestOn;
  selfTestOn = show;
  selfTestPanel?.classList.toggle('hidden', !show);
  btnSelfTest?.setAttribute('aria-pressed', String(show));
  if (!show) return;
  toggleDiagnostics(false);
  runSelfTestPanel();
}
btnSelfTest?.addEventListener('click', () => toggleSelfTest());
if (location.search.includes('selftest')) toggleSelfTest(true);

const state = { stage: 0, complete: false };
// Release pipeline: draft -> mastered -> delivery-pending -> released.
const release = { state: 'draft', quality: 0, hash: null, title: null, bpm: 96, key: 'A min' };
const journal = { completed: [], mayaMix: false };
const TAKE_TITLES = [
  'Late Pass',
  'Curb Service',
  'Rain on the Snare',
  'Receipt',
  'Harbour Row Freestyle',
];
let delivery = { state: 'idle', at: 0 };
// Studio 808 production: the pattern the player arranged and the last take.
let pattern = starterPattern();
const production = { take: null, captures: 0 };
let cargo = createCargo();
let job = createJob();
let running = false;
let paused = false;
let muted = false;
let lastScreen = null;
let onFoot = false;
let inInterior = false;
let elapsed = 0;
let toastTimer = 0;
let lastBump = -10;

car.reset(SPAWN.x, SPAWN.z, SPAWN.heading);
marker.position.copy(stops[0].pos);

let currentSave = loadProgress();
if (currentSave) {
  hydrate(currentSave);
  renderRelease();
}

const menu = initMenu({
  onContinue: () => start(),
  onNewGame: (profile) => startNewCareer(profile),
  onImport: (save) => adoptSave(save),
  onQuality: (quality) => applyQuality(quality),
  onError: (message) => showToast(message),
});
menu.refresh(currentSave);
if (currentSave) applyQuality(currentSave.settings.quality);
if (currentSave?.settings?.muted) audio.setMuted(true);
syncOnline();

const screens = initScreens({
  getState: () => buildScreenState(),
  onPause: (value) => {
    paused = value;
    if (value) {
      input.throttle = false;
      input.brake = false;
      input.left = false;
      input.right = false;
      producer.stopPlayback();
    } else {
      snapCamera();
    }
  },
  onScreen: (name) => {
    lastScreen = name;
    if (running) saveProgress({ ui: { lastScreen: name } });
  },
  actions: {
    mainMenu: () => returnToMenu(),
    exportSave: () => {
      persist();
      showToast(downloadSave(currentSave) ? 'Save exported' : 'Nothing to export yet');
    },
    quality: (quality) => applyQuality(quality),
    toggleMute: () => toggleMute(),
    importSave: (text) => {
      const imported = parseSaveFile(text);
      if (!imported) {
        showToast('That file is not a TGG save');
        return;
      }
      adoptSave(imported);
      screens.openView('phone');
    },
  },
});

document.getElementById('btnPause').addEventListener('click', () => screens.toggle());

// One production panel, driven by the saved pattern and the take that passed.
const producer = initProducer({
  audio,
  session: studio,
  getProduction: () => ({ pattern, take: production.take, captures: production.captures }),
  onProduction: (next) => {
    pattern = normalizePattern(next.pattern);
    production.take = next.take ?? null;
    production.captures = Number(next.captures) || 0;
    persist();
  },
  onMastered: ({ pattern: nextPattern, take: nextTake, variant }) =>
    masterTake(nextPattern, nextTake, variant),
  onToast: (text) => showToast(text),
});

// The pro studio is its own sheet, with its own session and audio engine.
const daw = initDaw({ audio, onToast: (text) => showToast(text), getBeat: () => pattern });
document.getElementById('btnDaw')?.addEventListener('click', () => daw.open());

// The take passed the engineer and the mastering gate: the release is mastered.
function masterTake(nextPattern, nextTake, variant = 'studio') {
  // Maya's room is her own thread: it never advances Act I or the release.
  if (variant === 'maya') {
    pattern = normalizePattern(nextPattern);
    production.take = nextTake;
    studioQuality = Math.max(studioQuality, nextTake.quality);
    radioAvailable = true;
    journal.mayaMix = true;
    persist();
    showToast(`Maya’s mix · ${nextTake.quality}/100 · she signs it (DEMO)`);
    return;
  }
  // Only the first acceptance moves the run; re-accepting a saved take is a
  // no-op so the same master cannot advance the story twice.
  const firstMaster = release.state === 'draft';
  pattern = normalizePattern(nextPattern);
  production.take = nextTake;
  release.state = 'mastered';
  release.quality = nextTake.quality;
  release.hash = mixHash(nextTake.quality, [nextTake.arrangement, nextTake.timing], director.seed);
  release.title = takeTitle(release.hash);
  release.bpm = pattern.bpm;
  studioQuality = nextTake.quality;
  radioAvailable = true;
  renderRelease();
  persist();
  if (firstMaster && state.stage === 0 && !state.complete) advanceStage();
  showToast(`Mastered · ${release.title} · ${nextTake.quality}/100 (DEMO)`);
}

const camPosition = new THREE.Vector3();
const camLook = new THREE.Vector3();

const CAR_CAM = { distance: 11.6, height: 5.4, ahead: 10, lookY: 1.5 };
const FOOT_CAM = { distance: 5.6, height: 2.4, ahead: 6, lookY: 1.3 };

function focus() {
  return onFoot ? walker : driving;
}

function camSettings() {
  return onFoot ? FOOT_CAM : CAR_CAM;
}

// Buildings occupy the middle of every block, so the chase camera would sit
// inside a wall when you park close. Keep it on the street.
function blockedForCamera(x, z) {
  for (const block of city.blocks) {
    if (
      Math.abs(x - block.x) < block.half - 6 &&
      Math.abs(z - block.z) < block.half - 6
    ) {
      return true;
    }
  }
  return false;
}

function keepCameraClear(x, z, subject) {
  if (inInterior || !blockedForCamera(x, z)) return { x, z };
  for (let t = 0.92; t >= 0.12; t -= 0.08) {
    const nx = subject.pos.x + (x - subject.pos.x) * t;
    const nz = subject.pos.z + (z - subject.pos.z) * t;
    if (!blockedForCamera(nx, nz)) return { x: nx, z: nz };
  }
  return { x: subject.pos.x, z: subject.pos.z };
}

function snapCamera() {
  const subject = focus();
  const settings = camSettings();
  const forward = subject.forward;
  const clear = keepCameraClear(
    subject.pos.x - forward.x * settings.distance,
    subject.pos.z - forward.z * settings.distance,
    subject,
  );
  camPosition.set(clear.x, settings.height, clear.z);
  camLook.set(
    subject.pos.x + forward.x * settings.ahead,
    settings.lookY,
    subject.pos.z + forward.z * settings.ahead,
  );
  camera.position.copy(camPosition);
  camera.lookAt(camLook);
}

function updateCamera(dt) {
  const subject = focus();
  const settings = camSettings();
  const forward = subject.forward;
  const desiredX = subject.pos.x - forward.x * settings.distance;
  const desiredZ = subject.pos.z - forward.z * settings.distance;
  const follow = 1 - Math.exp(-5.5 * dt);
  camPosition.x += (desiredX - camPosition.x) * follow;
  camPosition.z += (desiredZ - camPosition.z) * follow;
  camPosition.y += (settings.height - camPosition.y) * follow;
  const clear = keepCameraClear(camPosition.x, camPosition.z, subject);
  camPosition.x = clear.x;
  camPosition.z = clear.z;
  camLook.x += (subject.pos.x + forward.x * settings.ahead - camLook.x) * (1 - Math.exp(-7 * dt));
  camLook.y += (settings.lookY - camLook.y) * (1 - Math.exp(-7 * dt));
  camLook.z += (subject.pos.z + forward.z * settings.ahead - camLook.z) * (1 - Math.exp(-7 * dt));
  camera.position.copy(camPosition);
  camera.lookAt(camLook);
  camera.fov = 62 + Math.min(9, Math.abs(subject.speed) * 0.24);
  camera.updateProjectionMatrix();
}

function showToast(text) {
  toastElement.textContent = text;
  toastElement.classList.add('show');
  toastTimer = 3.2;
}

function advanceStage() {
  if (!journal.completed.includes(state.stage)) journal.completed.push(state.stage);
  state.stage += 1;
  if (state.stage < stops.length) {
    marker.position.copy(stops[state.stage].pos);
    objectiveText.textContent = stops[state.stage].objective;
    persist();
    return;
  }
  state.complete = true;
  marker.visible = false;
  running = false;
  renderRelease();
  persist();
  overlayComplete.classList.remove('hidden');
}

// Everything the run needs to survive a refresh. The take stays a take: the
// hash only proves it is the same one you cut.
function persist() {
  currentSave =
    saveProgress({
      stage: state.stage,
      complete: state.complete,
      release: { ...release },
      studioQuality,
      radioAvailable,
      directorSeed: director.seed,
      car: { x: car.pos.x, z: car.pos.z, heading: car.heading },
      journal: { completed: [...journal.completed], maya: journal.maya, mayaMix: journal.mayaMix },
      production: { pattern, take: production.take, captures: production.captures },
      cargo,
      job,
      van: { x: van.pos.x, z: van.pos.z, heading: van.heading },
      ui: { lastScreen },
      stats: { bestTake: Math.max(currentSave?.stats?.bestTake ?? 0, studioQuality) },
    }) ?? currentSave;
}

function hydrate(save) {
  const stage = Number(save.stage);
  state.stage = Number.isFinite(stage) ? Math.max(0, Math.min(stops.length - 1, stage)) : 0;
  state.complete = Boolean(save.complete);
  if (save.release && typeof save.release.state === 'string') Object.assign(release, save.release);
  journal.completed = [...(save.journal?.completed ?? [])];
  journal.maya = Boolean(save.journal?.maya);
  journal.mayaMix = Boolean(save.journal?.mayaMix);
  cargo = normalizeCargo(save.cargo);
  job = normalizeJob(save.job);
  if (save.van && Number.isFinite(Number(save.van.x))) {
    van.reset(Number(save.van.x), Number(save.van.z), Number(save.van.heading) || 0);
  }
  if (cargo.state === 'transit' || cargo.state === 'failed') {
    driving = van;
    stops[2].objective = cargo.state === 'transit' ? 'Run the cargo to The Vault' : 'Reload the cargo van at Salt Flats';
  }
  lastScreen = save.ui?.lastScreen ?? null;
  // A refresh while the desk is checking must resume the check, not strand the
  // release: the tick only runs while `delivery` is pending.
  if (release.state === 'delivery-pending') {
    delivery = { state: 'pending', at: elapsed };
    deliveryChip.textContent = 'Delivery pending · desk checking metadata and mix';
    deliveryChip.classList.remove('hidden');
  } else if (release.state === 'confirmed') {
    delivery = { state: 'confirmed', at: elapsed };
    deliveryChip.textContent = 'Confirmed · release lands in a moment';
    deliveryChip.classList.remove('hidden');
  }
  studioQuality = Number(save.studioQuality) || 0;
  if (save.production?.pattern) pattern = normalizePattern(save.production.pattern);
  production.take = save.production?.take ?? null;
  production.captures = Number(save.production?.captures) || 0;
  // A run from before the studio existed starts on the house beat, not silence.
  if (totalHits(pattern) === 0 && production.captures === 0) pattern = starterPattern();
  radioAvailable = Boolean(save.radioAvailable);
  if (Number.isFinite(Number(save.directorSeed))) director.seed = Number(save.directorSeed);
  if (save.car && canOccupy(Number(save.car.x), Number(save.car.z))) {
    car.reset(Number(save.car.x), Number(save.car.z), Number(save.car.heading) || 0);
  }
  marker.visible = !state.complete;
  marker.position.copy(missionTarget() ?? stops[state.stage].pos);
  objectiveText.textContent = state.complete ? 'Act I complete' : stops[state.stage].objective;
  updateCargoChip();
}

function renderRelease() {
  if (!releaseNote) return;
  const master = release.title ? `“${release.title}” · ${release.bpm} BPM · ${release.key}` : 'no master cut';
  releaseNote.textContent = `Release ${release.state} · ${master}${release.hash ? ` · ${release.hash}` : ''} (DEMO)`;
}

function takeTitle(hash) {
  const index = parseInt(String(hash).slice(0, 4), 16) || 0;
  return TAKE_TITLES[index % TAKE_TITLES.length];
}

function startDelivery() {
  const gate = assessMaster(pattern, production.take);
  const check = canHandOver({
    releaseState: release.state,
    deliveryState: delivery.state,
    stage: state.stage,
    complete: state.complete,
    masterReady: gate.ready,
  });
  if (!check.ok) {
    if (check.reason === 'mastering-gate') showToast('The desk refuses it · fix the mastering gate');
    else if (check.reason === 'nothing-mastered') showToast('Nothing to hand over · cut the single first');
    else if (check.reason === 'already-in-delivery') showToast('The desk is already checking this master');
    else showToast('The Vault is not taking deliveries right now');
    return;
  }
  delivery = { state: 'pending', at: elapsed };
  release.state = 'delivery-pending';
  deliveryChip.textContent = 'Delivery pending · desk checking metadata and mix';
  deliveryChip.classList.remove('hidden');
  renderRelease();
  persist();
  showToast('The Vault · title, BPM, key and mix in');
}

// The desk confirms, not the player. Each step only fires from the state before
// it, so a repeated tick cannot release the same master twice.
function confirmDelivery() {
  const next = confirmFrom(release.state);
  if (!next) return;
  release.state = next;
  delivery = { state: 'confirmed', at: elapsed };
  deliveryChip.textContent = 'Confirmed · release lands in a moment';
  renderRelease();
  persist();
  showToast('The Vault · confirmed, the release is scheduled (DEMO)');
}

function releaseDelivery() {
  const next = releaseFrom(release.state);
  if (!next) return;
  release.state = next;
  delivery = { state: 'idle', at: 0 };
  deliveryChip.classList.add('hidden');
  renderRelease();
  showToast(`The Vault · released ${release.hash} (DEMO)`);
  advanceStage();
}

function updateMission(dt, time) {
  ring.rotation.z += dt * 0.6;
  beamMaterial.opacity = 0.07 + Math.sin(time * 2.4) * 0.03;
  ringMaterial.opacity = 0.42 + Math.sin(time * 3) * 0.16;

  if (delivery.state === 'pending' && time - delivery.at > DELIVERY_PENDING_SECONDS) {
    confirmDelivery();
  }
  if (delivery.state === 'confirmed' && time - delivery.at > RELEASE_CONFIRM_SECONDS) {
    releaseDelivery();
  }

  if (state.complete) return;
  const subject = focus();
  const stop = stops[state.stage];
  const distance = Math.hypot(stop.pos.x - subject.pos.x, stop.pos.z - subject.pos.z);
  if (distance < 12) {
    if (!stop.arrived) {
      stop.arrived = true;
      showToast(stop.arrival);
    }
    if (stop.advanceOnArrival !== false) advanceStage();
  } else if (distance > 20) {
    stop.arrived = false;
  }
}

// Starts true: the bay sits on a junction, which must not count as running it.
let wasInJunction = true;
let pursuitTimer = 0;
let escapeTimer = 0;
let lastViolation = -10;

function nearestRoadValue(value) {
  let best = ROAD_LINES[0];
  for (const line of ROAD_LINES) {
    if (Math.abs(line - value) < Math.abs(best - value)) best = line;
  }
  return best;
}

function violation(reason) {
  if (elapsed - lastViolation < 6) return;
  lastViolation = elapsed;
  showToast(reason);
  wantedBadge.classList.remove('hidden');
  police.alert(focus().pos.x, focus().pos.z);
  pursuitTimer = 0;
}

function checkViolations(dt) {
  const inJunction =
    Math.abs(nearestRoadValue(driving.pos.x) - driving.pos.x) < 11 &&
    Math.abs(nearestRoadValue(driving.pos.z) - driving.pos.z) < 11;

  if (!onFoot) {
    const axis = Math.abs(Math.sin(driving.heading)) >= Math.abs(Math.cos(driving.heading)) ? 'x' : 'z';
    if (
      inJunction &&
      !wasInJunction &&
      Math.abs(driving.speed) > 3 &&
      signalState(elapsed, axis) !== 'green'
    ) {
      violation('Ran the light · unit alerted');
    }
    wasInJunction = inJunction;

    if (Math.abs(driving.speed) > 6) {
      for (const person of traffic.crosserPositions) {
        if (!person) continue;
        if (Math.hypot(person.x - driving.pos.x, person.z - driving.pos.z) < 3.2) {
          violation('Hit a pedestrian · unit alerted');
          break;
        }
      }
    }
  }

  // The badge is the unit's state, not a separate memory: if the unit stopped
  // (lost you, gave up or hit the 300 m leash) the warning goes with it.
  if (!police.active && !wantedBadge.classList.contains('hidden')) {
    wantedBadge.classList.add('hidden');
    escapeTimer = 0;
  }

  if (police.active) {
    const still = onFoot || Math.abs(driving.speed) < 3;
    if (police.distance < 9 && still) pursuitTimer += dt;
    else pursuitTimer = 0;
    if (pursuitTimer > 1.2) {
      busted();
      return;
    }

    // Pulling away from the unit for long enough loses it, so a red light is a
    // chase rather than a permanent tag.
    if (police.distance > 130) escapeTimer += dt;
    else escapeTimer = 0;
    if (escapeTimer > 6) {
      escapeTimer = 0;
      pursuitTimer = 0;
      police.stop();
      wantedBadge.classList.add('hidden');
      showToast('Unit lost · you are clear');
    }
  }
}

function busted() {
  running = false;
  escapeTimer = 0;
  pursuitTimer = 0;
  police.stop();
  wantedBadge.classList.add('hidden');
  overlayBusted.classList.remove('hidden');
  showToast('Busted · lay low and get back to the bay');
}

function respawn() {
  overlayBusted.classList.add('hidden');
  driving = car;
  setFeet(false);
  car.reset(SPAWN.x, SPAWN.z, SPAWN.heading);
  running = true;
  pursuitTimer = 0;
  escapeTimer = 0;
  wasInJunction = true;
  snapCamera();
}

// Puts the run back to its opening state without touching the career.
function resetRun() {
  state.stage = 0;
  state.complete = false;
  release.state = 'draft';
  release.hash = null;
  release.title = null;
  release.quality = 0;
  delivery = { state: 'idle', at: 0 };
  deliveryChip.classList.add('hidden');
  studioQuality = 0;
  radioAvailable = false;
  journal.completed = [];
  journal.maya = false;
  journal.mayaMix = false;
  pattern = starterPattern();
  production.take = null;
  production.captures = 0;
  cargo = createCargo();
  job = createJob();
  van.reset(VAN_BAY.x, VAN_BAY.z, VAN_BAY.heading);
  driving = car;
  renderRelease();
  updateCargoChip();
  setFeet(false);
  car.reset(SPAWN.x, SPAWN.z, SPAWN.heading);
  marker.position.copy(stops[0].pos);
  marker.visible = true;
  objectiveText.textContent = stops[0].objective;
  overlayComplete.classList.add('hidden');
  overlayBusted.classList.add('hidden');
  wantedBadge.classList.add('hidden');
  stops.forEach((stop) => {
    stop.arrived = false;
  });
  police.stop();
  pursuitTimer = 0;
  escapeTimer = 0;
  wasInJunction = true;
  overlayStart.classList.add('hidden');
  running = true;
  toastTimer = 0;
  toastElement.classList.remove('show');
  snapCamera();
}

function restart() {
  // R belongs to the run, not to the menu.
  if (!overlayStart.classList.contains('hidden')) return;
  resetRun();
  persist();
  menu.refresh(currentSave);
  showToast('Run reset · same career');
}

function startNewCareer(profile) {
  clearProgress();
  currentSave = null;
  resetRun();
  currentSave =
    saveProgress({
      player: { alias: profile.alias, career: profile.career, createdAt: Date.now() },
      createdAt: Date.now(),
      stats: { runs: 1, bestTake: 0 },
    }) ?? currentSave;
  running = true;
  audio.start();
  menu.refresh(currentSave);
  menu.hide();
  showToast(`New career · ${profile.alias} · ${stops[0].name}`);
}

function applyQuality(quality) {
  const caps = { low: 1, balanced: compact ? 1.35 : 1.75, high: 2 };
  qualityCap = caps[quality] ?? caps.balanced;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, qualityCap));
  renderer.setSize(window.innerWidth, window.innerHeight);
  currentSave = saveProgress({ settings: { quality } }) ?? currentSave;
}

function adoptSave(save) {
  clearProgress();
  currentSave = saveProgress({ ...save }) ?? save;
  hydrate(currentSave);
  applyQuality(currentSave.settings.quality);
  renderRelease();
  menu.refresh(currentSave);
  showToast('Save imported · press Continue');
}

function syncOnline() {
  const online = navigator.onLine;
  document.body.classList.toggle('is-offline', !online);
  offlineChip.classList.toggle('hidden', online);
  menu.setOnline(online);
}

window.addEventListener('online', () => {
  syncOnline();
  showToast('Back online · the director can reach a model');
});

window.addEventListener('offline', () => {
  syncOnline();
  showToast('Offline · local run only, cloud AI unavailable');
});

// Everything the phone, map, mission center and pause sheet read. Read-only:
// the screens never mutate the run.
function buildScreenState() {
  const subject = focus();
  const targetIndex =
    state.stage === 2 && cargo.state === 'transit' ? 1 : Math.min(state.stage, stops.length - 1);
  const target = state.complete ? null : stops[targetIndex].pos;
  return {
    alias: currentSave?.player?.alias ?? 'Getta',
    career: currentSave?.player?.career ?? 'artist',
    stage: state.stage,
    complete: state.complete,
    objective: objectiveText.textContent,
    release: { ...release },
    take: { quality: studioQuality, radioAvailable },
    journal: { completed: [...journal.completed], maya: journal.maya },
    cargo: { ...cargo },
    stats: currentSave?.stats ?? { runs: 1, bestTake: 0 },
    player: { x: subject.pos.x, z: subject.pos.z, heading: subject.heading },
    target: target
      ? {
          id: targetIndex === 0 ? 'studio' : targetIndex === 1 ? 'vault' : 'airport',
          name: stops[targetIndex].name,
          x: target.x,
          z: target.z,
        }
      : null,
    distance: target
      ? Math.round(Math.hypot(target.x - subject.pos.x, target.z - subject.pos.z))
      : null,
    studioDistance: Math.round(
      Math.hypot(stops[0].pos.x - subject.pos.x, stops[0].pos.z - subject.pos.z),
    ),
    quality: currentSave?.settings?.quality ?? 'balanced',
    muted,
    online: navigator.onLine,
    lastScreen,
  };
}

// Leaving for the menu keeps the run: save first, then show the title screen.
function returnToMenu() {
  // keepLastScreen: closing the sheet must not erase what the phone last showed.
  const lastOpen = lastScreen;
  screens.close();
  lastScreen = lastOpen;
  persist();
  running = false;
  setFeet(false);
  menu.refresh(currentSave);
  menu.show();
  showToast('Run saved · main menu');
}

function renderDirector() {
  const story = director.story;
  directorLogline.textContent = story.logline;
  directorBeats.replaceChildren(
    ...story.beats.map((beat) => {
      const item = document.createElement('li');
      item.textContent = `${beat.objective} — ${beat.line}`;
      return item;
    }),
  );
  directorSource.textContent =
    story.source === 'remote'
      ? `model-written${story.provider ? ` · ${story.provider}` : ''}`
      : story.source === 'builtin'
        ? 'TGG hosted director · written in the Worker (free)'
        : 'TGG director · offline beats (free)';
}

function applyStory(story) {
  director.story = story;
  stops[0].objective = story.beats[0].objective;
  stops[0].arrival = story.beats[0].line;
  if (story.beats[1]) {
    stops[1].objective = story.beats[1].objective;
    stops[1].arrival = story.beats[1].line;
  }
  if (state.stage === 0 && !state.complete) objectiveText.textContent = stops[0].objective;
  renderDirector();
}

async function rewriteRun() {
  const online = navigator.onLine;
  if (!online) showToast('AI needs a connection · offline beats only');
  const story = await director.requestRun(state.stage);
  applyStory(story);
  showToast(
    !online
      ? 'Director · offline beats in'
      : story.source === 'remote'
        ? 'Director · AI beats in'
        : story.source === 'builtin'
          ? 'Director · hosted beats in'
          : 'Director · new beats in',
  );
}

function toggleDirectorPanel(force) {
  const show = typeof force === 'boolean' ? force : directorPanel.classList.contains('hidden');
  directorPanel.classList.toggle('hidden', !show);
}

function enterStudio() {
  inInterior = true;
  // The room is a separate cell inside the tower, so the street is hidden.
  scene.fog = null;
  city.group.visible = false;
  studioInterior.enter();
  walker.canWalk = (x, z) =>
    Math.abs(x - INTERIOR_ORIGIN.x) < INTERIOR_BOUNDS.x &&
    Math.abs(z - INTERIOR_ORIGIN.z) < INTERIOR_BOUNDS.z;
  walker.pos.set(INTERIOR_ORIGIN.x, 0, INTERIOR_ORIGIN.z + 6);
  walker.heading = Math.PI;
  walker.group.position.copy(walker.pos);
  walker.group.rotation.y = walker.heading;
  snapCamera();
  showToast('Studio 808 · the booth is at the back');
}

function exitStudio() {
  inInterior = false;
  scene.fog = worldFog;
  city.group.visible = true;
  studioInterior.exit();
  walker.canWalk = canWalk;
  walker.pos.set(ENTRANCE.x, 0, ENTRANCE.z + 2);
  walker.group.position.copy(walker.pos);
  snapCamera();
  showToast('Back on Harbour Row');
}

function near(x, z, radius) {
  return Math.hypot(walker.pos.x - x, walker.pos.z - z) < radius;
}

// ---- Salt Flats cargo run -------------------------------------------------
function updateCargoChip() {
  if (!cargoChip) return;
  if (job.state === 'carrying') {
    cargoChip.classList.remove('hidden');
    cargoChip.dataset.state = 'courier';
    cargoChip.textContent = jobLabel(job);
    return;
  }
  const relevant = state.stage >= 2 || cargo.state !== 'idle';
  cargoChip.classList.toggle('hidden', !relevant);
  cargoChip.dataset.state = cargo.state;
  if (!relevant) return;
  const left = cargo.state === 'transit' ? ` · ${Math.ceil(remaining(cargo, elapsed))}s` : '';
  cargoChip.textContent = `${cargoLabel(cargo)}${left}`;
}

function missionTarget() {
  if (state.complete) return null;
  if (state.stage === 2 && cargo.state === 'transit') return stops[1].pos;
  return stops[state.stage].pos;
}

function handleBay() {
  if (cargo.state === 'failed' || cargo.state === 'delivered') {
    cargo = reloadCargo(cargo);
    stops[2].objective = 'Load the cargo van at Salt Flats';
    objectiveText.textContent = stops[2].objective;
    marker.position.copy(stops[2].pos);
    updateCargoChip();
    persist();
    showToast('Freight reloaded · three crates to load');
    return;
  }
  if (driving !== van) {
    driving = van;
    setFeet(false);
    snapCamera();
  }
  const loaded = loadCrate(cargo);
  if (!loaded) return;
  if (loaded.ready) {
    depart(cargo, elapsed);
    stops[2].objective = 'Run the cargo to The Vault';
    objectiveText.textContent = stops[2].objective;
    marker.position.copy(stops[1].pos);
    showToast('Three crates in · 90 seconds to the Vault dock');
  } else {
    showToast(`Crate ${loaded.crate}/3 loaded`);
  }
  updateCargoChip();
  persist();
}

function unloadCargo() {
  if (Math.abs(driving.speed) > 4) {
    showToast('Stop the van to unload');
    return;
  }
  if (!deliverCargo(cargo, elapsed)) return;
  journal.maya = true;
  // Outbound delivery unlocks the return leg instead of closing the job, so the
  // van drives freight back to the airport terminal.
  if (returnLeg(cargo)) {
    stops[2].objective = 'Load the return freight at the Vault dock';
    objectiveText.textContent = stops[2].objective;
    marker.position.copy(stops[1].pos);
    updateCargoChip();
    persist();
    showToast('Outbound freight delivered · load the return run');
    return;
  }
  updateCargoChip();
  showToast('Cargo delivered · Maya is expecting you');
  advanceStage();
}

// Freight is lifted inside the hall: stand at the counter and the crates go onto
// the van, so the terminal is a place you walk into to start a run.
function loadAtPickup() {
  const loaded = loadCrate(cargo);
  if (!loaded) {
    showToast(cargo.state === 'loaded' ? 'The van is already full' : 'Nothing left to lift');
    return;
  }
  if (loaded.ready) {
    depart(cargo, elapsed);
    stops[2].objective = 'Run the cargo to The Vault';
    objectiveText.textContent = stops[2].objective;
    marker.position.copy(stops[1].pos);
    showToast('Three crates loaded · 90 seconds to the Vault dock');
  } else {
    showToast(`Crate ${loaded.crate}/3 on the pallet`);
  }
  updateCargoChip();
  persist();
}

// Loading and unloading the return leg happen at the same two docks, with the
// direction reversed: pick up at the Vault, deliver at the apron.
function loadReturn() {
  const loaded = loadCrate(cargo);
  if (!loaded) return;
  if (loaded.ready) {
    depart(cargo, elapsed);
    stops[2].objective = 'Run the return freight to Salt Flats';
    objectiveText.textContent = stops[2].objective;
    marker.position.copy(stops[2].pos);
    showToast('Return freight loaded · 90 seconds to the terminal');
  } else {
    showToast(`Return crate ${loaded.crate}/3 loaded`);
  }
  updateCargoChip();
  persist();
}

function unloadReturn() {
  if (Math.abs(driving.speed) > 4) {
    showToast('Stop the van to unload');
    return;
  }
  if (!deliverCargo(cargo, elapsed)) return;
  const reward = claimRoundTrip(cargo);
  const paid = reward ? awardContract(career, reward) : null;
  updateCargoChip();
  persist();
  showToast(
    paid
      ? `Return freight delivered · $${paid.cash} + ${paid.xp} XP${paid.levelUp ? ` · level ${paid.level}` : ''}`
      : 'Return freight delivered · the terminal is stocked',
  );
}

function failCargoRun(reason) {
  if (!failCargo(cargo, elapsed, reason)) return;
  stops[2].objective = 'Reload the cargo van at Salt Flats';
  objectiveText.textContent = stops[2].objective;
  marker.position.copy(stops[2].pos);
  van.reset(VAN_BAY.x, VAN_BAY.z, VAN_BAY.heading);
  driving = van;
  snapCamera();
  updateCargoChip();
  persist();
  showToast(reason === 'time' ? 'Cargo late · the bay is waiting' : 'Freight written off · reload at the bay');
}

function updateCargo() {
  if (cargo.state !== 'transit') return;
  if (driving === van && van.impact && van.impactSpeed > IMPACT_SPEED) {
    const hit = damageCargo(cargo);
    updateCargoChip();
    if (hit.failed) {
      failCargoRun('damage');
      return;
    }
    showToast(`Freight hit · ${hit.damage}/3 dents`);
  }
  if (remaining(cargo, elapsed) <= 0) failCargoRun('time');
}

function startCourier() {
  if (!startJob(job)) return;
  updateCargoChip();
  persist();
  showToast('Courier · parcel aboard · Studio 808 is the drop');
}

function finishCourier() {
  if (!completeJob(job)) return;
  updateCargoChip();
  persist();
  showToast(`Courier delivered · ${job.runs} run${job.runs === 1 ? '' : 's'} (DEMO)`);
}

function toggleRadio() {
  if (!radioAvailable) {
    showToast('No take to play yet');
    return;
  }
  radioOn = !radioOn;
  if (radioOn) {
    audio.startRadio(studioQuality);
    showToast('Crimson Line Radio · your take (DEMO)');
  } else {
    audio.stopRadio();
    showToast('Radio off');
  }
}

function updateStudioPrompt() {
  if (!inInterior || studio.active) {
    studioPrompt.classList.add('hidden');
    return;
  }
  const nearMic = near(STUDIO_POINTS.mic.x, STUDIO_POINTS.mic.z, 3.2);
  const nearDoor = near(STUDIO_POINTS.door.x, STUDIO_POINTS.door.z, 3.2);
  studioPrompt.textContent = nearMic
    ? mayaSessionReady()
      ? 'E · Maya’s B room'
      : 'E · open the beat desk'
    : nearDoor
      ? 'E · leave the studio'
      : 'Walk to the mic · the booth is at the back';
  studioPrompt.dataset.mode = 'interior';
  studioPrompt.classList.remove('hidden');
}

// The Vault is a desk you deal with, not a marker you touch.
function updateStreetPrompt() {
  if (inInterior) return;
  if (state.stage === 2 && !state.complete) {
    if (onFoot && insideHall(focus().pos.x, focus().pos.z)) {
      studioPrompt.dataset.mode = 'street';
      studioPrompt.textContent =
        cargo.state === 'idle' || cargo.state === 'loading'
          ? `E · lift crate ${cargo.crates + 1}/3 onto the van`
          : cargo.state === 'delivered' && cargo.leg === 'back'
            ? 'Round trip complete · the counter is clear'
            : 'Freight is on the van · drive it out';
      studioPrompt.classList.remove('hidden');
      return;
    }
    const atBay = Math.hypot(focus().pos.x - VAN_BAY.x, focus().pos.z - VAN_BAY.z) < 16;
    const atDock =
      ((cargo.state === 'transit' && cargo.leg === 'out') ||
        (cargo.leg === 'back' && (cargo.state === 'idle' || cargo.state === 'loading'))) &&
      Math.hypot(focus().pos.x - stops[1].pos.x, focus().pos.z - stops[1].pos.z) < 16;
    if (atBay || atDock) {
      studioPrompt.dataset.mode = 'street';
      studioPrompt.textContent = atDock
        ? Math.abs(driving.speed) > 4
          ? 'Stop the van to unload'
          : cargo.leg === 'back'
            ? 'E · Load return freight'
            : 'E · unload the cargo'
        : cargo.state === 'failed'
          ? 'E · reload the freight'
          : cargo.state === 'transit' && cargo.leg === 'back'
            ? Math.abs(driving.speed) > 4
              ? 'Stop the van to unload'
              : 'E · Unload return freight'
          : cargo.state === 'loaded'
            ? 'Roll out · 90 seconds to the Vault'
            : `E · load a crate (${cargo.crates}/3)`;
      studioPrompt.classList.remove('hidden');
      return;
    }
  }
  if (job.state === 'carrying') {
    const nearDrop =
      Math.hypot(focus().pos.x - COURIER.drop.x, focus().pos.z - COURIER.drop.z) < 16;
    studioPrompt.dataset.mode = 'street';
    studioPrompt.textContent = nearDrop
      ? 'E · drop the parcel at the Studio 808 door'
      : 'Courier · parcel aboard · Studio 808 is the drop';
    studioPrompt.classList.remove('hidden');
    return;
  }
  const atVault =
    state.stage === 1 &&
    !state.complete &&
    Math.hypot(focus().pos.x - stops[1].pos.x, focus().pos.z - stops[1].pos.z) < 14;
  if (atVault) {
    studioPrompt.dataset.mode = 'street';
    studioPrompt.textContent =
      release.state === 'delivery-pending'
        ? 'The desk is checking the master…'
        : release.state === 'confirmed'
          ? 'Confirmed · the release is landing…'
          : 'E · hand the master to the desk';
    studioPrompt.classList.remove('hidden');
    return;
  }
  if (studioPrompt.dataset.mode === 'street') {
    studioPrompt.dataset.mode = '';
    studioPrompt.classList.add('hidden');
  }
}

function interact() {
  if (!running) return;

  if (!inInterior) {
    if (onFoot && Math.hypot(walker.pos.x - ENTRANCE.x, walker.pos.z - ENTRANCE.z) < 5) {
      enterStudio();
      return;
    }
    if (state.stage === 2 && !state.complete) {
      if (onFoot && insideHall(focus().pos.x, focus().pos.z)) {
        loadAtPickup();
        return;
      }
      if (Math.hypot(focus().pos.x - VAN_BAY.x, focus().pos.z - VAN_BAY.z) < 16) {
        handleBay();
        return;
      }
      if (
        cargo.state === 'transit' &&
        cargo.leg === 'out' &&
        Math.hypot(focus().pos.x - stops[1].pos.x, focus().pos.z - stops[1].pos.z) < 16
      ) {
        unloadCargo();
        return;
      }
      if (
        cargo.state === 'transit' &&
        cargo.leg === 'back' &&
        Math.hypot(focus().pos.x - VAN_BAY.x, focus().pos.z - VAN_BAY.z) < 16
      ) {
        unloadReturn();
        return;
      }
      if (
        cargo.leg === 'back' &&
        (cargo.state === 'idle' || cargo.state === 'loading') &&
        Math.hypot(focus().pos.x - stops[1].pos.x, focus().pos.z - stops[1].pos.z) < 16
      ) {
        loadReturn();
        return;
      }
    }
    const atVault =
      Math.hypot(focus().pos.x - stops[1].pos.x, focus().pos.z - stops[1].pos.z) < 14;
    if (state.stage === 1 && !state.complete && atVault) {
      startDelivery();
      return;
    }
    if (canStartJob(job, state.complete) && atVault) {
      startCourier();
      return;
    }
    if (
      job.state === 'carrying' &&
      Math.hypot(focus().pos.x - COURIER.drop.x, focus().pos.z - COURIER.drop.z) < 16
    ) {
      finishCourier();
      return;
    }
    toggleOnFoot();
    return;
  }

  if (near(STUDIO_POINTS.mic.x, STUDIO_POINTS.mic.z, 3.2)) {
    producer.open(mayaSessionReady() ? 'maya' : 'studio');
    return;
  }
  if (near(STUDIO_POINTS.door.x, STUDIO_POINTS.door.z, 3.2)) {
    exitStudio();
    return;
  }
  showToast('Walk to the mic or the door');
}

function setFeet(active) {
  onFoot = active;
  walker.group.visible = active;
  if (active) {
    walker.enter(driving.pos, driving.heading);
  } else {
    walker.speed = 0;
  }
}

function toggleOnFoot() {
  if (!running) return;
  if (!onFoot) {
    if (Math.abs(driving.speed) > 1.5) {
      showToast('Stop the coupe to step out');
      return;
    }
    setFeet(true);
    snapCamera();
    showToast('On foot · E to get back in');
    return;
  }

  const distance = Math.hypot(walker.pos.x - driving.pos.x, walker.pos.z - driving.pos.z);
  if (distance > 5.5) {
    showToast(driving === van ? 'Walk back to the van' : 'Walk back to the coupe');
    return;
  }
  setFeet(false);
  snapCamera();
  showToast('Back in the coupe');
}

function start() {
  audio.start();
  menu.hide();
  overlayStart.classList.add('hidden');
  if (state.complete) {
    // Act I is done, but the city keeps running: free driving and the courier
    // board stay open instead of freezing on the completion card.
    running = true;
    overlayComplete.classList.add('hidden');
    showToast('Act I complete · free drive · the courier board is open');
    return;
  }
  running = true;
  const target = stops[state.stage].pos;
  const distance = Math.round(Math.hypot(target.x - driving.pos.x, target.z - driving.pos.z));
  showToast(
    currentSave
      ? `Saved run · ${stops[state.stage].name} · ${distance} m`
      : `${stops[state.stage].name} · ${distance} m`,
  );
}

function bindHold(element, key) {
  const on = (event) => {
    event.preventDefault();
    input[key] = true;
    element.setPointerCapture?.(event.pointerId);
  };
  const off = (event) => {
    event.preventDefault();
    input[key] = false;
  };
  element.addEventListener('pointerdown', on);
  element.addEventListener('pointerup', off);
  element.addEventListener('pointercancel', off);
  element.addEventListener('pointerleave', off);
}

bindHold(document.getElementById('btnGas'), 'throttle');
bindHold(document.getElementById('btnBrake'), 'brake');
bindHold(document.getElementById('btnLeft'), 'left');
bindHold(document.getElementById('btnRight'), 'right');

document.getElementById('btnAgain').addEventListener('click', restart);
document.getElementById('btnLayLow').addEventListener('click', respawn);
document.getElementById('btnRestart').addEventListener('click', restart);
document.getElementById('btnOnFoot').addEventListener('click', interact);
for (const id of ['btnGas', 'btnBrake']) {
  document.getElementById(id).addEventListener('pointerdown', () => {
    if (inInterior && studio.active) interact();
  });
}
document.getElementById('btnDirector').addEventListener('click', rewriteRun);
document.getElementById('btnDirectorToggle').addEventListener('click', () => toggleDirectorPanel());
document.getElementById('btnDirectorClose').addEventListener('click', () => toggleDirectorPanel(false));
document.getElementById('btnRadio').addEventListener('click', toggleRadio);

const muteButton = document.getElementById('btnMute');
function toggleMute() {
  muted = audio.toggleMute();
  muteButton.style.color = muted ? '#8d98a6' : '';
  return muted;
}
muteButton.addEventListener('click', () => toggleMute());

window.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) {
    event.preventDefault();
  }
  if (producer.isOpen()) {
    event.preventDefault();
    producer.handleKey(key);
    return;
  }
  if (key === 'escape' || key === 'p') {
    event.preventDefault();
    screens.toggle();
    return;
  }
  // Menus swallow gameplay keys, so nothing drives the coupe behind a sheet.
  if (screens.isOpen()) return;
  if (key === 'w' || key === 'arrowup') input.throttle = true;
  if (key === 's' || key === 'arrowdown') input.brake = true;
  if (key === 'a' || key === 'arrowleft') input.left = true;
  if (key === 'd' || key === 'arrowright') input.right = true;
  if (key === 'e') interact();
  if ((key === ' ' || key === 'enter') && inInterior) interact();
  if (key === 't') toggleRadio();
  if (key === 'r') restart();
  if (key === 'm') toggleMute();
  if (key === 'i') toggleDiagnostics();
  if (key === 'k') toggleSelfTest();
  if (overlayStart.classList.contains('hidden') === false) start();
});

window.addEventListener('keyup', (event) => {
  const key = event.key.toLowerCase();
  if (key === 'w' || key === 'arrowup') input.throttle = false;
  if (key === 's' || key === 'arrowdown') input.brake = false;
  if (key === 'a' || key === 'arrowleft') input.left = false;
  if (key === 'd' || key === 'arrowright') input.right = false;
});

window.addEventListener('blur', () => {
  input.throttle = false;
  input.brake = false;
  input.left = false;
  input.right = false;
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, qualityCap));
});

let hudAccumulator = 0;
function updateDiagnostics(dt) {
  if (!diagOn || !diagPanel) return;
  const frameMs = dt * 1000;
  fpsSmooth += (1 / Math.max(dt, 0.0001) - fpsSmooth) * 0.12;
  diagTimer += dt;
  if (diagTimer < 0.25) return;
  diagTimer = 0;
  const info = renderer.info;
  diagPanel.textContent = [
    `fps ${Math.round(fpsSmooth)} · frame ${frameMs.toFixed(1)} ms`,
    `draw calls ${info.render.calls} · triangles ${info.render.triangles}`,
    `geometries ${info.memory.geometries} · textures ${info.memory.textures}`,
    `pixel ratio ${renderer.getPixelRatio().toFixed(2)} · ${window.innerWidth}x${window.innerHeight}`,
    `audio ${audio.ctx?.state ?? 'off'} · ${navigator.onLine ? 'online' : 'offline'}`,
    `stage ${state.stage}${state.complete ? ' complete' : ''} · release ${release.state}`,
    `cargo ${cargo.state} · ${cargo.crates}/3 · ${cargo.damage} dents`,
    `van ${van.pos.x.toFixed(0)},${van.pos.z.toFixed(0)} · drive ${driving === van ? 'van' : 'coupe'}`,
  ].join('\n');
}

function updateHud(dt, time) {
  hudAccumulator += dt;
  const subject = focus();
  const target = missionTarget();

  if (hudAccumulator >= 0.08) {
    hudAccumulator = 0;
    updateCargoChip();

    const kmh = Math.round(Math.abs(subject.speed) * 3.6);
    speedText.textContent = String(kmh);
    gearText.textContent = onFoot ? 'W' : driving.speed < -0.4 ? 'R' : kmh === 0 ? 'N' : 'D';

    if (inInterior) {
      distanceText.textContent = 'in session';
      compass.style.transform = 'rotate(0deg)';
    } else if (target) {
      const dx = target.x - subject.pos.x;
      const dz = target.z - subject.pos.z;
      distanceText.textContent = `${Math.round(Math.hypot(dx, dz))} m`;
      const relative = Math.atan2(dx, dz) - subject.heading;
      compass.style.transform = `rotate(${(-relative * 180) / Math.PI}deg)`;
    } else {
      distanceText.textContent = 'delivered';
      compass.style.transform = 'rotate(0deg)';
    }

    if (toastTimer > 0) {
      toastTimer -= 0.08 * 4;
      if (toastTimer <= 0) toastElement.classList.remove('show');
    }
  }

  drawMinimap(minimap, subject.pos, target, time, traffic.positions, police);
}

applyStory(director.story);
snapCamera();

// Dev hook for automated checks only; inert unless the URL ends in #debug.
if (window.location.hash === '#debug') {
  window.__tgg = {
    car,
    walker,
    traffic,
    signals,
    police,
    studioInterior,
    director,
    studio,
    toggleRadio,
    renderer,
    stops,
    release,
    // A getter, because every transition replaces the object.
    deliveryNow: () => delivery,
    startDelivery,
    confirmDelivery,
    elapsed: () => elapsed,
    menu,
    screens,
    producer,
    production: () => ({ pattern, take: production.take, captures: production.captures }),
    masterTake,
    releaseDelivery,
    enterStudio,
    van,
    drivingNow: () => driving,
    cargoNow: () => cargo,
    loadVan: handleBay,
    unloadCargo,
    failCargoRun,
    missionTarget,
    toggleDiagnostics,
    diagnostics: () => (diagPanel ? diagPanel.textContent : ''),
    assess: () => assessMaster(pattern, production.take),
    applyQuality,
    currentSave: () => currentSave,
    loadProgress,
    state,
    restart,
    busted,
    respawn,
    toggleOnFoot,
    isOnFoot: () => onFoot,
    isInInterior: () => inInterior,
    snapCamera,
    interact,
    // Synchronous probes. Browser evaluations are capped at 10 s and the render
    // loop starves anything that waits, so these answer in a single call instead
    // of driving the walker frame by frame.
    canWalk: (x, z) => canWalk(x, z),
    walkPath: (from, to, steps = 60) => {
      const blocked = [];
      for (let i = 0; i <= steps; i += 1) {
        const t = i / steps;
        const x = from[0] + (to[0] - from[0]) * t;
        const z = from[1] + (to[1] - from[1]) * t;
        if (!canWalk(x, z)) blocked.push({ x: Number(x.toFixed(2)), z: Number(z.toFixed(2)) });
      }
      return { clear: blocked.length === 0, blockedCount: blocked.length, first: blocked[0] ?? null };
    },
    // Put the driver on foot at a spot and snap the camera there, so a single
    // call can stand inside the hall and screenshot it.
    walkerTo: (x, z, heading = 0) => {
      if (!onFoot) toggleOnFoot();
      walker.pos.set(x, walker.pos.y, z);
      walker.heading = heading;
      snapCamera();
      return { x: walker.pos.x, z: walker.pos.z, onFoot, inHall: insideHall(x, z) };
    },
  };
}

// Workers pace up and down inside the bay; the pallet shuttle runs a slow loop
// between the doorway and the rack runs. Cheap enough to run every frame.
function updateYard(dt) {
  yardClock += dt;
  for (const worker of yardWorkers) {
    const swing = Math.sin(yardClock * 0.7 + worker.phase);
    worker.body.position.z = AIRFIELD.z + 30 + swing * 3.2;
    worker.body.rotation.y = Math.cos(yardClock * 0.7 + worker.phase) >= 0 ? 0 : Math.PI;
  }
  palletShuttle.position.z = AIRFIELD.z + 30 + ((yardClock * 0.7) % 6);
  // Load cycle: lift, hold at the top, settle back onto the counter.
  const lift = Math.max(0, Math.sin(yardClock * 1.1));
  liftCrate.position.y = 1.5 + lift * 1.3;
  liftCrate.rotation.y = yardClock * 0.25;
}

const clock = new THREE.Clock();

function frame() {
  requestAnimationFrame(frame);
  const rawDt = clock.getDelta();
  // Simulation steps stay clamped; diagnostics report the real frame time.
  const dt = Math.min(rawDt, 0.05);
  // A paused run freezes: no game time passes and nothing simulates.
  if (!paused) elapsed += dt;
  if (!paused) worldClock.advance(dt);
  applyWorldLight();
  if (elapsed - lastClockSave > 5) {
    lastClockSave = elapsed;
    worldClock.save();
  }
  const active = running && !paused;

  const bumped = active ? traffic.update(dt, focus().pos, elapsed) : false;
  if (active) signals.update(elapsed);
  if (bumped && active && elapsed - lastBump > 2.5) {
    lastBump = elapsed;
    driving.speed *= -0.18;
    if (driving === van && cargo.state === 'transit') {
      const hit = damageCargo(cargo);
      updateCargoChip();
      if (hit.failed) failCargoRun('damage');
    }
    showToast('Traffic · mind the paint');
  }

  if (active) {
    if (onFoot) walker.update(dt, input);
    else driving.update(dt, input);
    updateCamera(dt);
    updateMission(dt, elapsed);
    updateCargo();
    updateYard(dt);
    audio.update(onFoot ? 0 : driving.speed, onFoot ? false : input.throttle);
    audio.updateFootsteps(onFoot ? walker.speed : 0, dt);
    checkViolations(dt);
  }

  audio.updateRadio(dt);

  if (inInterior) {
    studioInterior.animate(elapsed);
    if (active) {
      studio.update(dt);
      if (studio.active && studio.beatCount !== studioBeat) {
        studioBeat = studio.beatCount;
        audio.click(studio.lastAccent);
        studioInterior.pulse(studio.progress, studio.layerIndex);
      }
    }
    updateStudioPrompt();
  } else {
    updateStreetPrompt();
  }

  if (active) police.update(dt, focus().pos);
  audio.updateSiren(active && police.active, police.distance, elapsed);

  updateHud(dt, elapsed);
  updateDiagnostics(rawDt);
  renderer.render(scene, camera);
}

requestAnimationFrame(frame);
