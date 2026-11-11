import * as THREE from 'three';
import { createCity, HALF, ROAD_LINES } from './city.js';
import { Car } from './car.js';
import { Traffic } from './traffic.js';
import { Signals, signalState } from './signals.js';
import { Police } from './police.js';
import { setupMinimap, drawMinimap } from './hud.js';
import { EngineAudio } from './audio.js';

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

const car = new Car(canOccupy);
scene.add(car.group);

const traffic = new Traffic();
scene.add(traffic.group);

const signals = new Signals();
scene.add(signals.group);

const police = new Police();
scene.add(police.group);

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
const minimap = setupMinimap(document.getElementById('minimap'));

const state = { stage: 0, complete: false };
let running = false;
let elapsed = 0;
let toastTimer = 0;
let lastBump = -10;

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
  police.alert(car.pos.x, car.pos.z);
  pursuitTimer = 0;
}

function checkViolations(dt) {
  const axis = Math.abs(Math.sin(car.heading)) >= Math.abs(Math.cos(car.heading)) ? 'x' : 'z';
  const inJunction =
    Math.abs(nearestRoadValue(car.pos.x) - car.pos.x) < 11 &&
    Math.abs(nearestRoadValue(car.pos.z) - car.pos.z) < 11;

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

  if (police.active) {
    if (police.distance < 9 && Math.abs(car.speed) < 3) pursuitTimer += dt;
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
  car.reset(SPAWN.x, SPAWN.z, SPAWN.heading);
  running = true;
  pursuitTimer = 0;
  wasInJunction = true;
  snapCamera();
}

function restart() {
  state.stage = 0;
  state.complete = false;
  car.reset(SPAWN.x, SPAWN.z, SPAWN.heading);
  marker.position.copy(stops[0].pos);
  marker.visible = true;
  objectiveText.textContent = stops[0].objective;
  overlayComplete.classList.add('hidden');
  overlayBusted.classList.add('hidden');
  wantedBadge.classList.add('hidden');
  police.stop();
  pursuitTimer = 0;
  wasInJunction = true;
  overlayStart.classList.add('hidden');
  running = true;
  toastTimer = 0;
  toastElement.classList.remove('show');
  snapCamera();
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
  if (hudAccumulator < 0.08) {
    drawMinimap(minimap, car.pos, state.complete ? null : stops[state.stage].pos, time, traffic.positions);
    return;
  }
  hudAccumulator = 0;

  const kmh = Math.round(Math.abs(car.speed) * 3.6);
  speedText.textContent = String(kmh);
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
    police,
    renderer,
    stops,
    state,
    restart,
    busted,
    respawn,
  };
}

const clock = new THREE.Clock();

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt;

  const bumped = traffic.update(dt, car.pos, elapsed);
  signals.update(elapsed);  if (bumped && running && elapsed - lastBump > 2.5) {
    lastBump = elapsed;
    car.speed *= -0.18;
    showToast('Traffic · mind the paint');
  }

  if (running) {
    car.update(dt, input);
    updateCamera(dt);
    updateMission(dt, elapsed);
    audio.update(car.speed, input.throttle);
    checkViolations(dt);
  }

  police.update(dt, car.pos);

  updateHud(dt, elapsed);
  renderer.render(scene, camera);
}

requestAnimationFrame(frame);
