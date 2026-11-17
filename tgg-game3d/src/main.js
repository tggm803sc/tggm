import * as THREE from 'three';
import { createCity, HALF } from './city.js';
import { Car } from './car.js';
import { Traffic } from './traffic.js';
import { Signals } from './signals.js';
import { setupMinimap, drawMinimap } from './hud.js';
import { EngineAudio } from './audio.js';
import {
  SAVE_KEY,
  BACKUP_KEY,
  defaultProgress,
  parseProgress,
  serializeProgress,
  mergeRunProgress,
  formatTime,
} from './progress.js';
import {
  resolveApiBase,
  createCloudSave,
  mergeProgress,
  saveToProgress,
  localBeatsRemote,
  makeRunId,
} from './cloud.js';

const SPAWN = { x: 39, z: 39, heading: Math.PI };

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x04060a);
scene.fog = new THREE.FogExp2(0x04060a, 0.0038);

const camera = new THREE.PerspectiveCamera(
  62,
  window.innerWidth / window.innerHeight,
  0.2,
  1400,
);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
// Phones throw away pixels here: the scene is fog-heavy, so a 1.75x ratio buys
// nothing visible and costs fill rate.
const smallScreen = Math.min(window.innerWidth, window.innerHeight) < 620;
const maxPixelRatio = smallScreen ? 1.25 : 1.75;
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxPixelRatio));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.3;
document.getElementById('scene').appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0x33486b, 0x06080b, 1.2));
const moon = new THREE.DirectionalLight(0xa7c2ff, 1.7);
moon.position.set(-140, 240, 110);
scene.add(moon);

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

const car = new Car(canOccupy);
scene.add(car.group);

const traffic = new Traffic();
scene.add(traffic.group);

const signals = new Signals();
scene.add(signals.group);

const stops = [
  {
    name: 'Studio 808',
    pos: new THREE.Vector3(195, 0, -117),
    objective: 'Drive to Studio 808',
    arrival: 'Studio 808 · session logged (DEMO)',
  },
  {
    name: 'The Vault',
    pos: new THREE.Vector3(-117, 0, 195),
    objective: 'Deliver the master to The Vault',
    arrival: 'The Vault · master delivered (DEMO)',
  },
];

const marker = new THREE.Group();
const beamMaterial = new THREE.MeshBasicMaterial({
  color: 0xc7ff00,
  transparent: true,
  opacity: 0.16,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  side: THREE.DoubleSide,
  toneMapped: false,
});
const beam = new THREE.Mesh(
  new THREE.CylinderGeometry(2.2, 3.6, 72, 18, 1, true),
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
const input = { throttle: false, brake: false, left: false, right: false, handbrake: false };

const overlayStart = document.getElementById('start');
const overlayComplete = document.getElementById('complete');
const objectiveText = document.getElementById('objective');
const distanceText = document.getElementById('distance');
const compass = document.getElementById('compass');
const speedText = document.getElementById('speed');
const gearText = document.getElementById('gear');
const toastElement = document.getElementById('toast');
const minimap = setupMinimap(document.getElementById('minimap'));
const timerText = document.getElementById('timer');
const bestText = document.getElementById('bestTime');
const stageProgressText = document.getElementById('stageProgress');
const runSummaryText = document.getElementById('runSummary');
const startBestText = document.getElementById('startBest');

const state = { stage: 0, complete: false, runTime: 0, best: null, runs: 0, legs: [] };
let running = false;
let elapsed = 0;
let toastTimer = 0;
let lastBump = -10;
let lastImpact = -10;
let legMark = 0;

// Device-local progress only: localStorage on the player's browser, not a
// server-side career. Clearing site data resets it; it never leaves the device.
const progress = defaultProgress();
let progressWritable = true;
let progressStatus = 'empty';

function loadProgress() {
  let raw = null;
  try {
    raw = window.localStorage.getItem(SAVE_KEY);
  } catch {
    progressStatus = 'unavailable';
    progressWritable = false;
    return;
  }
  const parsed = parseProgress(raw);
  Object.assign(progress, parsed.progress);
  progressStatus = parsed.status;
  if (progressStatus === 'corrupt') {
    // Keep the unreadable payload for inspection, then start from a clean slate.
    try {
      window.localStorage.setItem(BACKUP_KEY, raw);
    } catch {
      /* storage full or blocked; the game still boots */
    }
  }
  if (progressStatus === 'newer') progressWritable = false;
}

function writeProgress() {
  if (!progressWritable) {
    return progressStatus === 'newer'
      ? 'not overwritten · save is from a newer build'
      : 'not saved · storage unavailable';
  }
  try {
    window.localStorage.setItem(SAVE_KEY, serializeProgress(progress));
    return 'saved on this device';
  } catch {
    return 'not saved · storage blocked';
  }
}

loadProgress();
state.best = progress.best;
state.runs = progress.runs;

let lastSaved =
  progressStatus === 'ok' || progressStatus === 'migrated' ? 'local save loaded' : 'no save yet';

// Optional career sync. The app-served build talks to its own origin; the static
// GitHub Pages build has no /api/world, finds nothing, and stays device-local.
const apiBase = resolveApiBase({
  pageOrigin: window.location.origin,
  override: new URLSearchParams(window.location.search).get('api') ?? '',
  meta: document.querySelector('meta[name="tgg-api-base"]')?.getAttribute('content') ?? '',
});
const cloud = createCloudSave({ base: apiBase ?? '' });
let cloudRevision = 0;
const cloudNote = { state: apiBase === null ? 'off' : 'idle' };

function applyCloudSave(save) {
  cloudRevision = save.revision;
  const merged = mergeProgress(progress, saveToProgress(save));
  const changed = merged.best !== progress.best || merged.runs !== progress.runs;
  if (changed) {
    Object.assign(progress, merged);
    state.best = progress.best;
    state.runs = progress.runs;
    if (progressWritable) writeProgress();
    reflectProgress();
  }
  return changed;
}

async function pushCloudSave() {
  const result = await cloud.push(progress, cloudRevision);
  if (result.state === 'ok' && result.save) {
    cloudRevision = result.save.revision;
    cloudNote.state = 'pushed';
    lastSaved = 'saved on this device · career published';
  } else if (result.state === 'conflict' && result.save) {
    const changed = applyCloudSave(result.save);
    cloudNote.state = 'conflict';
    lastSaved = changed
      ? 'career server had a fresher save · reloaded it'
      : 'saved on this device · server save current';
  } else if (result.state === 'signed-out') {
    cloudNote.state = 'signed-out';
    lastSaved = 'saved on this device · sign in on the app to sync';
  } else if (result.state !== 'disabled') {
    cloudNote.state = 'offline';
    lastSaved = 'saved on this device · career server offline';
  }
  reflectProgress();
}

async function loadCloudSave() {
  const result = await cloud.load();
  if (result.state === 'ok') {
    if (result.save) {
      const changed = applyCloudSave(result.save);
      cloudNote.state = changed ? 'merged' : 'current';
      lastSaved = changed ? 'server save merged' : 'server save current';
      // Played offline on this device and beat the server: publish that result.
      if (localBeatsRemote(progress, saveToProgress(result.save))) await pushCloudSave();
    } else {
      cloudNote.state = 'empty';
      if (progress.best !== null || progress.runs > 0) await pushCloudSave();
    }
  } else if (result.state === 'signed-out') {
    cloudNote.state = 'signed-out';
    lastSaved = 'saved on this device · sign in on the app to sync';
  } else if (result.state !== 'disabled') {
    cloudNote.state = 'offline';
    lastSaved = 'saved on this device · career server offline';
  }
  reflectProgress();
}

async function syncRunToCloud() {
  if (!cloud.enabled) return;
  const result = await cloud.submitRun({
    runId: makeRunId(),
    totalMs: Math.round(state.runTime * 1000),
    legs: state.legs.map((leg) => Math.round(leg * 1000)),
  });
  if (result.state === 'ok') {
    if (result.save) cloudRevision = Math.max(cloudRevision, result.save.revision);
    cloudNote.state = 'synced';
    lastSaved = result.duplicate
      ? 'saved on this device · run already synced'
      : 'saved on this device · run synced';
  } else if (result.state === 'signed-out') {
    cloudNote.state = 'signed-out';
    lastSaved = 'saved on this device · sign in to sync runs';
  } else if (result.state !== 'disabled') {
    cloudNote.state = 'offline';
    lastSaved = 'saved on this device · sync failed';
  }
  reflectProgress();
}

function reflectProgress() {
  bestText.textContent = `Best ${state.best ? formatTime(state.best) : '—'}`;
  stageProgressText.textContent = state.complete
    ? 'Act I complete'
    : `Stage ${state.stage + 1} of ${stops.length}`;
  startBestText.textContent = progressStatus === 'newer'
    ? `Best run ${state.best ? formatTime(state.best) : formatTime(progress.lastRun)} · newer build save (read-only)`
    : state.best
      ? `Best run ${formatTime(state.best)} · ${state.runs} completed`
      : 'No completed run on this device yet';
  const splits = state.legs.map((time, index) => `${index + 1}: ${formatTime(time)}`).join(' · ');
  runSummaryText.textContent = state.complete
    ? `Run ${formatTime(state.runTime)}${splits ? ` (${splits})` : ''} · ${lastSaved}`
    : '';
}

reflectProgress();
loadCloudSave();

car.reset(SPAWN.x, SPAWN.z, SPAWN.heading);
marker.position.copy(stops[0].pos);

const camPosition = new THREE.Vector3();
const camLook = new THREE.Vector3();

const CAM = { distance: 11.6, height: 5.4, ahead: 10, lookY: 1.5 };

function snapCamera() {
  const forward = car.forward;
  camPosition.set(
    car.pos.x - forward.x * CAM.distance,
    CAM.height,
    car.pos.z - forward.z * CAM.distance,
  );
  camLook.set(
    car.pos.x + forward.x * CAM.ahead,
    CAM.lookY,
    car.pos.z + forward.z * CAM.ahead,
  );
  camera.position.copy(camPosition);
  camera.lookAt(camLook);
}

function updateCamera(dt) {
  const forward = car.forward;
  const desiredX = car.pos.x - forward.x * CAM.distance;
  const desiredZ = car.pos.z - forward.z * CAM.distance;
  const follow = 1 - Math.exp(-5.5 * dt);
  camPosition.x += (desiredX - camPosition.x) * follow;
  camPosition.z += (desiredZ - camPosition.z) * follow;
  camPosition.y += (CAM.height - camPosition.y) * follow;
  camLook.x += (car.pos.x + forward.x * CAM.ahead - camLook.x) * (1 - Math.exp(-7 * dt));
  camLook.y += (CAM.lookY - camLook.y) * (1 - Math.exp(-7 * dt));
  camLook.z += (car.pos.z + forward.z * CAM.ahead - camLook.z) * (1 - Math.exp(-7 * dt));
  camera.position.copy(camPosition);
  camera.lookAt(camLook);
  camera.fov = 62 + Math.min(9, Math.abs(car.speed) * 0.24);
  camera.updateProjectionMatrix();
}

function showToast(text) {
  toastElement.textContent = text;
  toastElement.classList.add('show');
  toastTimer = 3.2;
}

function advanceStage() {
  state.stage += 1;
  if (state.stage < stops.length) {
    // Close the leg that just finished so the completion card shows real splits.
    state.legs.push(state.runTime - legMark);
    legMark = state.runTime;
    marker.position.copy(stops[state.stage].pos);
    objectiveText.textContent = stops[state.stage].objective;
    reflectProgress();
    return;
  }
  state.complete = true;
  marker.visible = false;
  running = false;
  state.legs.push(state.runTime - legMark);
  legMark = state.runTime;
  const previousBest = progress.best;
  const merged = mergeRunProgress(progress, state.runTime);
  if (progressWritable) {
    Object.assign(progress, merged);
    lastSaved = writeProgress();
  } else {
    // A save from a newer build stays authoritative: report, never adopt it.
    lastSaved = writeProgress();
  }
  state.best = progress.best;
  state.runs = progress.runs;
  const isBest =
    progressWritable &&
    progress.best !== null &&
    progress.best === state.runTime &&
    (previousBest === null || state.runTime <= previousBest);
  reflectProgress();
  overlayComplete.classList.remove('hidden');
  showToast(isBest ? `New best run · ${lastSaved}` : `Run logged · ${lastSaved}`);
  // Local write already happened; the server copy is best-effort and never
  // delays the completion card or the next run.
  syncRunToCloud();
}

function updateMission(dt, time) {
  ring.rotation.z += dt * 0.6;
  beamMaterial.opacity = 0.12 + Math.sin(time * 2.4) * 0.05;
  ringMaterial.opacity = 0.42 + Math.sin(time * 3) * 0.16;

  if (state.complete) return;
  const target = stops[state.stage].pos;
  const distance = Math.hypot(target.x - car.pos.x, target.z - car.pos.z);
  if (distance < 12) {
    showToast(stops[state.stage].arrival);
    advanceStage();
  }
}

function restart() {
  state.stage = 0;
  state.complete = false;
  car.reset(SPAWN.x, SPAWN.z, SPAWN.heading);
  marker.position.copy(stops[0].pos);
  marker.visible = true;
  objectiveText.textContent = stops[0].objective;
  overlayComplete.classList.add('hidden');
  overlayStart.classList.add('hidden');
  running = true;
  state.runTime = 0;
  state.legs = [];
  legMark = 0;
  reflectProgress();
  toastTimer = 0;
  toastElement.classList.remove('show');
  snapCamera();
}

function start() {
  audio.start();
  overlayStart.classList.add('hidden');
  running = true;
  state.runTime = 0;
  state.legs = [];
  legMark = 0;
  if (progressStatus === 'corrupt') showToast('Unreadable save kept aside · starting fresh');
  if (progressStatus === 'newer') showToast('Save is from a newer build · read-only');
  const target = stops[0].pos;
  const distance = Math.round(Math.hypot(target.x - car.pos.x, target.z - car.pos.z));
  showToast(`Studio 808 · ${distance} m`);
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
bindHold(document.getElementById('btnHandbrake'), 'handbrake');

document.getElementById('btnStart').addEventListener('click', start);
document.getElementById('btnAgain').addEventListener('click', restart);
document.getElementById('btnRestart').addEventListener('click', restart);

const muteButton = document.getElementById('btnMute');
muteButton.addEventListener('click', () => {
  const muted = audio.toggleMute();
  muteButton.style.color = muted ? '#8d98a6' : '';
});

window.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) {
    event.preventDefault();
  }
  if (key === 'w' || key === 'arrowup') input.throttle = true;
  if (key === 's' || key === 'arrowdown') input.brake = true;
  if (key === 'a' || key === 'arrowleft') input.left = true;
  if (key === 'd' || key === 'arrowright') input.right = true;
  if (key === ' ') input.handbrake = true;
  if (key === 'r') restart();
  if (key === 'm') {
    const muted = audio.toggleMute();
    muteButton.style.color = muted ? '#8d98a6' : '';
  }
  if (overlayStart.classList.contains('hidden') === false) start();
});

window.addEventListener('keyup', (event) => {
  const key = event.key.toLowerCase();
  if (key === 'w' || key === 'arrowup') input.throttle = false;
  if (key === 's' || key === 'arrowdown') input.brake = false;
  if (key === 'a' || key === 'arrowleft') input.left = false;
  if (key === 'd' || key === 'arrowright') input.right = false;
  if (key === ' ') input.handbrake = false;
});

window.addEventListener('blur', () => {
  input.throttle = false;
  input.brake = false;
  input.left = false;
  input.right = false;
  input.handbrake = false;
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxPixelRatio));
});

const legSplitText = document.getElementById('legSplit');
let hudAccumulator = 0;
function updateHud(dt, time) {
  hudAccumulator += dt;
  if (hudAccumulator < 0.08) {
    drawMinimap(minimap, car.pos, state.complete ? null : stops[state.stage].pos, time, traffic.positions);
    return;
  }
  hudAccumulator = 0;

  const kmh = Math.round(Math.abs(car.speed) * 3.6);
  speedText.textContent = String(kmh);
  timerText.textContent = formatTime(state.runTime);
  if (legSplitText) {
    // The legs already banked sum to the moment this leg started.
    const legStart = state.legs.reduce((total, leg) => total + leg, 0);
    legSplitText.textContent = state.complete
      ? ''
      : `L${state.stage + 1} ${formatTime(Math.max(0, state.runTime - legStart))}`;
  }
  gearText.textContent = car.speed < -0.4 ? 'R' : kmh === 0 ? 'N' : 'D';

  if (!state.complete) {
    const target = stops[state.stage].pos;
    const dx = target.x - car.pos.x;
    const dz = target.z - car.pos.z;
    distanceText.textContent = `${Math.round(Math.hypot(dx, dz))} m`;
    const relative = Math.atan2(dx, dz) - car.heading;
    compass.style.transform = `rotate(${(-relative * 180) / Math.PI}deg)`;
  } else {
    distanceText.textContent = 'delivered';
    compass.style.transform = 'rotate(0deg)';
  }

  if (toastTimer > 0) {
    toastTimer -= 0.08 * 4;
    if (toastTimer <= 0) toastElement.classList.remove('show');
  }

  drawMinimap(minimap, car.pos, state.complete ? null : stops[state.stage].pos, time, traffic.positions);
}

snapCamera();

// Dev hook for automated checks only; inert unless the URL ends in #debug.
if (window.location.hash === '#debug') {
  window.__tgg = {
    car,
    traffic,
    signals,
    stops,
    state,
    restart,
    formatTime,
    saveKey: SAVE_KEY,
    renderer,
    scene,
    camera,
    progress,
    progressStatus: () => progressStatus,
    adaptQuality,
    paused: () => paused,
    quality: () => ({ ratio: renderer.getPixelRatio(), max: maxPixelRatio }),
    cloud: () => ({
      ...cloudNote,
      revision: cloudRevision,
      enabled: cloud.enabled,
      base: cloud.base,
    }),
  };
}

const clock = new THREE.Clock();

// A backgrounded tab must not bank run time, hold a key down, or keep the
// engine note sounding. On return the clock delta is thrown away so the coupe
// does not lurch forward by however long the phone was in a pocket.
let paused = typeof document !== 'undefined' && document.hidden;
function releaseInputs() {
  input.throttle = false;
  input.brake = false;
  input.left = false;
  input.right = false;
  input.handbrake = false;
}

document.addEventListener('visibilitychange', () => {
  paused = document.hidden;
  if (paused) {
    releaseInputs();
    audio.suspend();
  } else {
    clock.getDelta();
    audio.resume();
  }
});

// Adaptive quality: when frames run slow the scene sheds pixels rather than
// dropping inputs. A stretch of fast frames buys pixels back, but never above
// the screen's own cap, so a transient stall does not leave the game blurry.
let slowFrames = 0;
let fastFrames = 0;
function adaptQuality(dt) {
  if (dt > 1 / 24) {
    slowFrames += 1;
    fastFrames = 0;
  } else if (dt < 1 / 50) {
    fastFrames += 1;
    slowFrames = Math.max(0, slowFrames - 1);
  } else {
    slowFrames = Math.max(0, slowFrames - 1);
    fastFrames = Math.max(0, fastFrames - 1);
  }

  const ratio = renderer.getPixelRatio();
  if (slowFrames > 45 && ratio > 0.8) {
    renderer.setPixelRatio(Math.max(0.8, ratio - 0.25));
    slowFrames = 0;
  } else if (fastFrames > 180 && ratio < maxPixelRatio) {
    renderer.setPixelRatio(Math.min(maxPixelRatio, ratio + 0.15));
    fastFrames = 0;
  }
}

function frame() {
  requestAnimationFrame(frame);
  const raw = clock.getDelta();
  const dt = paused ? 0 : Math.min(raw, 0.05);
  elapsed += dt;
  adaptQuality(dt);

  const bumped = traffic.update(dt, car.pos, elapsed);
  signals.update(elapsed);  if (bumped && running && elapsed - lastBump > 2.5) {
    lastBump = elapsed;
    car.speed *= -0.18;
    showToast('Traffic · mind the paint');
  }

  if (running) {
    if (!state.complete) state.runTime += dt;
    car.update(dt, input);
    if (car.impact > 9 && elapsed - lastImpact > 2.5) {
      lastImpact = elapsed;
      showToast('Wall · ease off');
    }
    updateCamera(dt);
    updateMission(dt, elapsed);
    audio.update(car.speed, input.throttle);
  }

  updateHud(dt, elapsed);
  renderer.render(scene, camera);
}

requestAnimationFrame(frame);
