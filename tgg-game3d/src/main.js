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
import { Traffic } from './traffic.js';
import { Signals, signalState } from './signals.js';
import { Police } from './police.js';
import { setupMinimap, drawMinimap } from './hud.js';
import { EngineAudio } from './audio.js';

// Parked in the northbound lane, not on the centreline of a junction.
const SPAWN = { x: 34.5, z: 60, heading: Math.PI };

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
const pixelCap = compact ? 1.35 : 1.75;
const renderer = new THREE.WebGLRenderer({ antialias: !compact, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, pixelCap));
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

// On foot you can use the road and the sidewalk ring, but not the buildings.
function canWalk(x, z) {
  if (Math.abs(x) > HALF - 8 || Math.abs(z) > HALF - 8) return false;
  // Approach corridor from the street to the Studio 808 door.
  if (Math.abs(x - ENTRANCE.x) < 5 && z > -147 && z < -120) return true;
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
    objective: 'Deliver the master to The Vault',
    arrival: 'The Vault · master delivered (DEMO)',
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
const studioHud = document.getElementById('studioHud');
const studioLayer = document.getElementById('studioLayer');
const studioScore = document.getElementById('studioScore');
const studioPulse = document.getElementById('studioPulse');
const studioBars = Array.from(document.getElementById('studioBars').children);
const studioPrompt = document.getElementById('studioPrompt');
const minimap = setupMinimap(document.getElementById('minimap'));

const state = { stage: 0, complete: false };
let running = false;
let onFoot = false;
let inInterior = false;
let elapsed = 0;
let toastTimer = 0;
let lastBump = -10;

car.reset(SPAWN.x, SPAWN.z, SPAWN.heading);
marker.position.copy(stops[0].pos);

const camPosition = new THREE.Vector3();
const camLook = new THREE.Vector3();

const CAR_CAM = { distance: 11.6, height: 5.4, ahead: 10, lookY: 1.5 };
const FOOT_CAM = { distance: 5.6, height: 2.4, ahead: 6, lookY: 1.3 };

function focus() {
  return onFoot ? walker : car;
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
  state.stage += 1;
  if (state.stage < stops.length) {
    marker.position.copy(stops[state.stage].pos);
    objectiveText.textContent = stops[state.stage].objective;
    return;
  }
  state.complete = true;
  marker.visible = false;
  running = false;
  overlayComplete.classList.remove('hidden');
}

function updateMission(dt, time) {
  ring.rotation.z += dt * 0.6;
  beamMaterial.opacity = 0.07 + Math.sin(time * 2.4) * 0.03;
  ringMaterial.opacity = 0.42 + Math.sin(time * 3) * 0.16;

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
    Math.abs(nearestRoadValue(car.pos.x) - car.pos.x) < 11 &&
    Math.abs(nearestRoadValue(car.pos.z) - car.pos.z) < 11;

  if (!onFoot) {
    const axis = Math.abs(Math.sin(car.heading)) >= Math.abs(Math.cos(car.heading)) ? 'x' : 'z';
    if (
      inJunction &&
      !wasInJunction &&
      Math.abs(car.speed) > 3 &&
      signalState(elapsed, axis) !== 'green'
    ) {
      violation('Ran the light · unit alerted');
    }
    wasInJunction = inJunction;

    if (Math.abs(car.speed) > 6) {
      for (const person of traffic.crosserPositions) {
        if (!person) continue;
        if (Math.hypot(person.x - car.pos.x, person.z - car.pos.z) < 3.2) {
          violation('Hit a pedestrian · unit alerted');
          break;
        }
      }
    }
  }

  if (police.active) {
    const subject = focus();
    const still = onFoot || Math.abs(car.speed) < 3;
    if (police.distance < 9 && still) pursuitTimer += dt;
    else pursuitTimer = 0;
    if (pursuitTimer > 1.2) busted();
  }
}

function busted() {
  running = false;
  police.stop();
  wantedBadge.classList.add('hidden');
  overlayBusted.classList.remove('hidden');
}

function respawn() {
  overlayBusted.classList.add('hidden');
  setFeet(false);
  car.reset(SPAWN.x, SPAWN.z, SPAWN.heading);
  running = true;
  pursuitTimer = 0;
  wasInJunction = true;
  snapCamera();
}

function restart() {
  state.stage = 0;
  state.complete = false;
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
  wasInJunction = true;
  overlayStart.classList.add('hidden');
  running = true;
  toastTimer = 0;
  toastElement.classList.remove('show');
  snapCamera();
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
      : 'TGG director · our own engine (free)';
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
  const story = await director.requestRun(state.stage);
  applyStory(story);
  showToast(story.source === 'remote' ? 'Director · AI beats in' : 'Director · new beats in');
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

function startTake() {
  studio.start();
  studioBeat = -1;
  studioHud.classList.remove('hidden');
  studioPrompt.classList.add('hidden');
  showToast('Punch in · tap on the beat');
}

function finishTake() {
  studioHud.classList.add('hidden');
  studioPrompt.classList.add('hidden');
  const quality = studio.quality;
  studioQuality = quality;

  if (quality >= 80) {
    radioAvailable = true;
    showToast(`Engineer: that's the one · ${quality}/100 (DEMO)`);
    if (state.stage === 0 && !state.complete) advanceStage();
  } else {
    showToast(`Engineer: re-cut it · ${quality}/100 (DEMO)`);
  }
  studio.reset();
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

function updateStudioHud() {
  studioLayer.textContent = `LAYER ${Math.min(studio.layerIndex + 1, 3)}/3 · ${studio.layer}`;
  studioScore.textContent = studio.lastScore
    ? `${studio.lastScore.score} · ${studio.lastScore.offset} ms`
    : '—';
  const pulse = ((studio.phase % 1) + 1) % 1;
  studioPulse.style.transform = `translateX(${(pulse * 100).toFixed(1)}%)`;
  studioBars.forEach((bar, index) => {
    const value = studio.scores[index] ?? 0;
    bar.style.setProperty('--fill', String(value / 100));
    bar.dataset.state = value === 0 ? 'empty' : value >= 80 ? 'great' : value >= 50 ? 'ok' : 'rough';
  });
}

function updateStudioPrompt() {
  if (!inInterior || studio.active) {
    studioPrompt.classList.add('hidden');
    return;
  }
  const nearMic = near(STUDIO_POINTS.mic.x, STUDIO_POINTS.mic.z, 3.2);
  const nearDoor = near(STUDIO_POINTS.door.x, STUDIO_POINTS.door.z, 3.2);
  studioPrompt.textContent = nearMic
    ? 'E · take the mic'
    : nearDoor
      ? 'E · leave the studio'
      : 'Walk to the mic · the booth is at the back';
  studioPrompt.classList.remove('hidden');
}

function interact() {
  if (!running) return;

  if (!inInterior) {
    if (onFoot && Math.hypot(walker.pos.x - ENTRANCE.x, walker.pos.z - ENTRANCE.z) < 5) {
      enterStudio();
      return;
    }
    toggleOnFoot();
    return;
  }

  if (studio.active) {
    const result = studio.tap();
    audio.hitTone(result?.score ?? 0);
    if (studio.finished) finishTake();
    return;
  }

  if (near(STUDIO_POINTS.mic.x, STUDIO_POINTS.mic.z, 3.2)) {
    startTake();
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
    walker.enter(car.pos, car.heading);
  } else {
    walker.speed = 0;
  }
}

function toggleOnFoot() {
  if (!running) return;
  if (!onFoot) {
    if (Math.abs(car.speed) > 1.5) {
      showToast('Stop the coupe to step out');
      return;
    }
    setFeet(true);
    snapCamera();
    showToast('On foot · E to get back in');
    return;
  }

  const distance = Math.hypot(walker.pos.x - car.pos.x, walker.pos.z - car.pos.z);
  if (distance > 5.5) {
    showToast('Walk back to the coupe');
    return;
  }
  setFeet(false);
  snapCamera();
  showToast('Back in the coupe');
}

function start() {
  audio.start();
  overlayStart.classList.add('hidden');
  running = true;
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

document.getElementById('btnStart').addEventListener('click', start);
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
  if (key === 'e') interact();
  if ((key === ' ' || key === 'enter') && inInterior) interact();
  if (key === 't') toggleRadio();
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
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, pixelCap));
});

let hudAccumulator = 0;
function updateHud(dt, time) {
  hudAccumulator += dt;
  const subject = focus();
  const target = state.complete ? null : stops[state.stage].pos;

  if (hudAccumulator >= 0.08) {
    hudAccumulator = 0;

    const kmh = Math.round(Math.abs(subject.speed) * 3.6);
    speedText.textContent = String(kmh);
    gearText.textContent = onFoot ? 'W' : car.speed < -0.4 ? 'R' : kmh === 0 ? 'N' : 'D';

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
    state,
    restart,
    busted,
    respawn,
    toggleOnFoot,
    isOnFoot: () => onFoot,
    isInInterior: () => inInterior,
    snapCamera,
    interact,
  };
}

const clock = new THREE.Clock();

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt;

  const bumped = traffic.update(dt, focus().pos, elapsed);
  signals.update(elapsed);
  if (bumped && running && elapsed - lastBump > 2.5) {
    lastBump = elapsed;
    car.speed *= -0.18;
    showToast('Traffic · mind the paint');
  }

  if (running) {
    if (onFoot) walker.update(dt, input);
    else car.update(dt, input);
    updateCamera(dt);
    updateMission(dt, elapsed);
    audio.update(onFoot ? 0 : car.speed, onFoot ? false : input.throttle);
    audio.updateFootsteps(onFoot ? walker.speed : 0, dt);
    checkViolations(dt);
  }

  audio.updateRadio(dt);

  if (inInterior) {
    studioInterior.animate(elapsed);
    studio.update(dt);
    if (studio.active) {
      if (studio.beatCount !== studioBeat) {
        studioBeat = studio.beatCount;
        audio.click(studio.lastAccent);
        studioInterior.pulse(studio.progress, studio.layerIndex);
      }
      updateStudioHud();
    }
    updateStudioPrompt();
  }

  police.update(dt, focus().pos);
  audio.updateSiren(police.active, police.distance, elapsed);

  updateHud(dt, elapsed);
  renderer.render(scene, camera);
}

requestAnimationFrame(frame);
