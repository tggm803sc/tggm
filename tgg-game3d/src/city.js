import * as THREE from 'three';

export const PITCH = 78;
export const BLOCK = 60;
export const GRID = 9;
export const WORLD = PITCH * GRID;
export const HALF = WORLD / 2;
export const ROAD_LINES = [-273, -195, -117, -39, 39, 117, 195, 273];

export const BLOCKS = [];
for (let i = 0; i < GRID; i += 1) {
  for (let j = 0; j < GRID; j += 1) {
    BLOCKS.push({
      x: (i - (GRID - 1) / 2) * PITCH,
      z: (j - (GRID - 1) / 2) * PITCH,
      half: BLOCK / 2,
    });
  }
}

export const LANDMARKS = {
  studio: { x: 156, z: -156, name: 'Studio 808', color: 0xc7ff00 },
  vault: { x: -156, z: 156, name: 'The Vault', color: 0xffd700 },
  hq: { x: 0, z: 0, name: 'TGG HQ', color: 0xff3048 },
  airport: { x: 234, z: -234, name: 'Salt Flats', color: 0xff8b99 },
};

// The Salt Flats cargo apron. It is a working dock, not a full airport: one
// hangar, a painted strip, crates and the van bay.
function addAirfield(group, landmark) {
  const apron = new THREE.Mesh(
    new THREE.BoxGeometry(58, 0.4, 58),
    new THREE.MeshStandardMaterial({ color: 0x232b34, roughness: 0.96 }),
  );
  apron.position.set(landmark.x, 0.7, landmark.z);
  group.add(apron);

  const strip = new THREE.Mesh(
    new THREE.PlaneGeometry(54, 9),
    new THREE.MeshBasicMaterial({ color: 0xb9c6d4, transparent: true, opacity: 0.2, toneMapped: false }),
  );
  strip.rotation.x = -Math.PI / 2;
  strip.position.set(landmark.x, 0.92, landmark.z + 21);
  group.add(strip);
  for (let i = 0; i < 7; i += 1) {
    const dash = new THREE.Mesh(
      new THREE.PlaneGeometry(4, 0.5),
      new THREE.MeshBasicMaterial({ color: 0xffd700, toneMapped: false }),
    );
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(landmark.x - 22 + i * 7.4, 0.94, landmark.z + 21);
    group.add(dash);
  }

  const hangar = new THREE.Mesh(
    new THREE.BoxGeometry(26, 11, 16),
    new THREE.MeshStandardMaterial({ color: 0x141b23, roughness: 0.8, metalness: 0.25 }),
  );
  hangar.position.set(landmark.x - 14, 6, landmark.z - 16);
  group.add(hangar);

  const opening = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 8),
    new THREE.MeshBasicMaterial({
      color: 0xffdca8,
      transparent: true,
      opacity: 0.24,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  opening.position.set(landmark.x - 14, 5, landmark.z - 7.85);
  group.add(opening);

  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 5),
    new THREE.MeshBasicMaterial({ map: makeSignTexture('Salt Flats', '#ff8b99'), transparent: true, toneMapped: false }),
  );
  sign.position.set(landmark.x - 14, 9.4, landmark.z - 7.8);
  group.add(sign);

  const crateGeometry = new THREE.BoxGeometry(1.5, 1.5, 1.5);
  const crates = new THREE.InstancedMesh(
    crateGeometry,
    new THREE.MeshStandardMaterial({ color: 0x5a4630, roughness: 0.9 }),
    6,
  );
  const matrix = new THREE.Matrix4();
  for (let i = 0; i < 6; i += 1) {
    matrix.makeTranslation(landmark.x + 18 + (i % 3) * 1.8, 1.25 + Math.floor(i / 3) * 1.5, landmark.z + 8);
    crates.setMatrixAt(i, matrix);
  }
  crates.instanceMatrix.needsUpdate = true;
  group.add(crates);

  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.16, 9, 6),
    new THREE.MeshStandardMaterial({ color: 0x1b222c, roughness: 0.6 }),
  );
  pole.position.set(landmark.x + 24, 5, landmark.z - 22);
  group.add(pole);

  const sock = new THREE.Mesh(
    new THREE.ConeGeometry(0.9, 3, 8),
    new THREE.MeshStandardMaterial({ color: 0xff8b99, emissive: 0x401018, emissiveIntensity: 0.6, side: THREE.DoubleSide }),
  );
  sock.rotation.z = Math.PI / 2;
  sock.position.set(landmark.x + 26, 9, landmark.z - 22);
  group.add(sock);

  const dockLight = new THREE.PointLight(0xffd700, 48, 60, 2);
  dockLight.position.set(landmark.x + 6, 6, landmark.z + 14);
  group.add(dockLight);

  addCargoTerminal(group, landmark);
}

// The terminal that turns the apron into an airport: a lit cargo hall, a control
// tower, a parked freighter and taxiway lights. Everything sits outside the
// drivable apron box so the van never clips through a building.
function addCargoTerminal(group, landmark) {
  const concrete = new THREE.MeshStandardMaterial({ color: 0x2a323c, roughness: 0.92 });
  const glass = new THREE.MeshBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.45, toneMapped: false });

  const hall = new THREE.Mesh(new THREE.BoxGeometry(46, 9, 15), concrete);
  hall.position.set(landmark.x + 2, 4.5, landmark.z + 36);
  group.add(hall);

  const canopy = new THREE.Mesh(
    new THREE.BoxGeometry(50, 0.6, 5),
    new THREE.MeshStandardMaterial({ color: 0x11161d, roughness: 0.7, metalness: 0.4 }),
  );
  canopy.position.set(landmark.x + 2, 6.6, landmark.z + 28.5);
  group.add(canopy);

  for (let i = 0; i < 7; i += 1) {
    const windowPane = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 2.4), glass);
    windowPane.position.set(landmark.x - 16 + i * 6.2, 5.1, landmark.z + 28.3);
    windowPane.rotation.y = Math.PI;
    group.add(windowPane);
  }

  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(26, 5),
    new THREE.MeshBasicMaterial({ map: makeSignTexture('Air Cargo', '#9fd8ff'), transparent: true, toneMapped: false }),
  );
  sign.position.set(landmark.x + 2, 8.2, landmark.z + 28.2);
  sign.rotation.y = Math.PI;
  group.add(sign);

  const towerBase = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 3.2, 24, 10), concrete);
  towerBase.position.set(landmark.x - 38, 12, landmark.z + 34);
  group.add(towerBase);

  const cab = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.2, 3.4, 14), glass);
  cab.position.set(landmark.x - 38, 25.5, landmark.z + 34);
  group.add(cab);

  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(0.45, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xff3048, toneMapped: false }),
  );
  beacon.position.set(landmark.x - 38, 27.8, landmark.z + 34);
  group.add(beacon);

  const beaconLight = new THREE.PointLight(0xff3048, 26, 34, 2);
  beaconLight.position.copy(beacon.position);
  beaconLight.userData.nightLight = true;
  group.add(beaconLight);

  const planeMaterial = new THREE.MeshStandardMaterial({ color: 0xb9c4d0, roughness: 0.45, metalness: 0.4 });
  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 30, 12), planeMaterial);
  fuselage.rotation.z = Math.PI / 2;
  fuselage.position.set(landmark.x + 2, 5.4, landmark.z - 36);
  group.add(fuselage);

  const nose = new THREE.Mesh(new THREE.SphereGeometry(2.6, 12, 10), planeMaterial);
  nose.position.set(landmark.x - 13, 5.4, landmark.z - 36);
  group.add(nose);

  const wing = new THREE.Mesh(new THREE.BoxGeometry(7, 0.5, 30), planeMaterial);
  wing.position.set(landmark.x + 4, 4.6, landmark.z - 36);
  group.add(wing);

  const tailFin = new THREE.Mesh(new THREE.BoxGeometry(6, 7, 0.5), planeMaterial);
  tailFin.position.set(landmark.x + 16, 9, landmark.z - 36);
  group.add(tailFin);

  for (const side of [-1, 1]) {
    const engine = new THREE.Mesh(
      new THREE.CylinderGeometry(1.3, 1.5, 4, 10),
      new THREE.MeshStandardMaterial({ color: 0x2b3440, roughness: 0.5, metalness: 0.6 }),
    );
    engine.rotation.z = Math.PI / 2;
    engine.position.set(landmark.x + 4, 3.4, landmark.z - 36 + side * 8);
    group.add(engine);
  }

  // --- Interior: the hall is enterable through the bay doors. Box meshes are
  // front-face only, so standing inside reads as a room with its own floor,
  // pallets and racks rather than the outside of a solid block.
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(44, 13),
    new THREE.MeshStandardMaterial({ color: 0x333c46, roughness: 0.95 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(landmark.x + 2, 0.06, landmark.z + 36);
  group.add(floor);

  // Picked-out bay markings on the floor, so the loading lanes read.
  for (const lane of [-9, 0, 9]) {
    const stripe = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 0.5),
      new THREE.MeshBasicMaterial({ color: 0xf2c14e, toneMapped: false }),
    );
    stripe.rotation.x = -Math.PI / 2;
    stripe.position.set(landmark.x + 2, 0.08, landmark.z + 36 + lane);
    group.add(stripe);
  }

  // Pallets: a slatted deck with a crate stack on top.
  const palletWood = new THREE.MeshStandardMaterial({ color: 0x7a5c36, roughness: 0.95 });
  const crateBox = new THREE.MeshStandardMaterial({ color: 0x8a6a3e, roughness: 0.9 });
  for (const [px, pz, stack] of [[-14, 33, 2], [-7, 34, 1], [6, 33.5, 2], [13, 34, 1], [-2, 40, 2]]) {
    const deck = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.22, 2.4), palletWood);
    deck.position.set(landmark.x + px, 0.22, landmark.z + pz);
    group.add(deck);
    for (let s = 0; s < stack; s += 1) {
      const crate = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.4, 1.9), crateBox);
      crate.position.set(landmark.x + px, 1.05 + s * 1.45, landmark.z + pz);
      group.add(crate);
    }
  }

  // Rack runs against the back wall, three tiers each.
  const steel = new THREE.MeshStandardMaterial({ color: 0x4a545f, roughness: 0.55, metalness: 0.5 });
  for (const rx of [-16, -8, 0, 8, 16]) {
    const upright = new THREE.Mesh(new THREE.BoxGeometry(0.24, 6.4, 0.24), steel);
    upright.position.set(landmark.x + rx, 3.2, landmark.z + 42);
    group.add(upright);
    for (const tier of [1.6, 3.4, 5.2]) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.16, 1.6), steel);
      beam.position.set(landmark.x + rx + 3.8, tier, landmark.z + 42);
      group.add(beam);
    }
  }

  // The forklift: chassis, mast, forks and a counterweight.
  const forklift = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(3.2, 1.6, 5.2),
    new THREE.MeshStandardMaterial({ color: 0xd8a11d, roughness: 0.6, metalness: 0.3 }),
  );
  body.position.y = 1.1;
  forklift.add(body);
  const mast = new THREE.Mesh(new THREE.BoxGeometry(0.35, 5.4, 0.35), steel);
  mast.position.set(-1.4, 3.2, 2.9);
  forklift.add(mast);
  for (const fx of [-1.4, 1.4]) {
    const fork = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.14, 3.6), steel);
    fork.position.set(fx, 0.5, 4.6);
    forklift.add(fork);
  }
  const counterweight = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.2, 1.2), steel);
  counterweight.position.set(0, 1.4, -3.1);
  forklift.add(counterweight);
  forklift.position.set(landmark.x + 12, 0, landmark.z + 40);
  forklift.rotation.y = 0.5;
  group.add(forklift);

  // The pickup counter where freight is lifted onto the van.
  const counter = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.1, 1.4), palletWood);
  counter.position.set(landmark.x + 2, 0.55, landmark.z + 40.2);
  group.add(counter);

  // Ceiling strips, night-scaled with the rest of the terminal.
  for (const lx of [-14, 0, 14]) {
    const strip = new THREE.Mesh(
      new THREE.PlaneGeometry(18, 1.1),
      new THREE.MeshBasicMaterial({ color: 0xe8f2ff, toneMapped: false }),
    );
    strip.rotation.x = Math.PI / 2;
    strip.position.set(landmark.x + lx, 8.6, landmark.z + 36);
    group.add(strip);
    const lamp = new THREE.PointLight(0xe8f2ff, 46, 26, 2);
    lamp.position.set(landmark.x + lx, 7.8, landmark.z + 36);
    lamp.userData.nightLight = true;
    group.add(lamp);
  }

  // Taxiway edge lights, night-scaled like the street lamps.
  const taxiLights = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.35, 0.35, 0.35),
    new THREE.MeshBasicMaterial({ color: 0x5fd0ff, toneMapped: false }),
    14,
  );
  const matrix = new THREE.Matrix4();
  for (let i = 0; i < 14; i += 1) {
    matrix.makeTranslation(landmark.x - 26 + i * 4, 0.95, landmark.z - 4);
    taxiLights.setMatrixAt(i, matrix);
  }
  taxiLights.instanceMatrix.needsUpdate = true;
  group.add(taxiLights);

  // Threshold bars at the head of the painted strip.
  for (let i = 0; i < 4; i += 1) {
    for (const side of [-1, 1]) {
      const bar = new THREE.Mesh(
        new THREE.PlaneGeometry(1.2, 8),
        new THREE.MeshBasicMaterial({ color: 0xf2f6ff, toneMapped: false }),
      );
      bar.rotation.x = -Math.PI / 2;
      bar.position.set(landmark.x + side * (10 + i * 2.4), 0.95, landmark.z + 21);
      group.add(bar);
    }
  }

  // Freight staged inside the hall, set back so it reads through the bay.
  const staged = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1.4, 1.4, 1.4),
    new THREE.MeshStandardMaterial({ color: 0x6b5334, roughness: 0.9 }),
    8,
  );
  const bayMatrix = new THREE.Matrix4();
  for (let i = 0; i < 8; i += 1) {
    bayMatrix.makeTranslation(landmark.x - 8 + (i % 4) * 1.9, 1.3 + Math.floor(i / 4) * 1.5, landmark.z + 33);
    staged.setMatrixAt(i, bayMatrix);
  }
  staged.instanceMatrix.needsUpdate = true;
  group.add(staged);

  // Outside the drivable apron box (|dx|, |dz| < 26 in main.js), so the van cannot
  // clip a mast pole.
  for (const [dx, dz] of [[-30, 21], [30, 21]]) {
    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.22, 16, 6),
      new THREE.MeshStandardMaterial({ color: 0x1b222c, roughness: 0.6 }),
    );
    mast.position.set(landmark.x + dx, 8, landmark.z + dz);
    group.add(mast);
    const flood = new THREE.PointLight(0xdfeaff, 120, 44, 2);
    flood.position.set(landmark.x + dx, 15.5, landmark.z + dz);
    flood.userData.nightLight = true;
    group.add(flood);
  }
}

let seed = 861306;
function random() {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
}

function px(v) {
  return ((v + HALF) / WORLD) * 2048;
}

function units(v) {
  return (v / WORLD) * 2048;
}

function makeGroundTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 2048;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#0b0e13';
  ctx.fillRect(0, 0, 2048, 2048);

  for (let i = 0; i < 14000; i += 1) {
    ctx.fillStyle = `rgba(255,255,255,${0.008 + Math.random() * 0.022})`;
    ctx.fillRect(Math.random() * 2048, Math.random() * 2048, 1.7, 1.7);
  }

  // Lane dashes, skipped across intersections.
  ctx.fillStyle = 'rgba(206,216,230,0.78)';
  const dash = units(3.4);
  const gap = units(4.6);
  const width = Math.max(3, units(0.58));
  for (const line of ROAD_LINES) {
    for (let p = -HALF + 5; p < HALF; p += dash + gap) {
      let inJunction = false;
      for (let k = 0; k < GRID; k += 1) {
        const center = (k - (GRID - 1) / 2) * PITCH;
        if (Math.abs(p + dash / 2 - center) < 33) {
          inJunction = true;
          break;
        }
      }
      if (inJunction) continue;
      ctx.fillRect(px(line) - width / 2, px(p), width, dash);
      ctx.fillRect(px(p), px(line) - width / 2, dash, width);
    }
  }

  // Sidewalk blocks and curbs.
  for (const block of BLOCKS) {
    const x0 = px(block.x - BLOCK / 2);
    const y0 = px(block.z - BLOCK / 2);
    const size = units(BLOCK);
    ctx.fillStyle = '#171c24';
    ctx.fillRect(x0, y0, size, size);
    ctx.strokeStyle = 'rgba(122,136,154,0.5)';
    ctx.lineWidth = Math.max(1.6, units(0.55));
    ctx.strokeRect(x0 + 1, y0 + 1, size - 2, size - 2);
    ctx.strokeStyle = 'rgba(58,68,82,0.85)';
    ctx.lineWidth = Math.max(1, units(0.22));
    ctx.strokeRect(x0 + units(2.4), y0 + units(2.4), size - units(4.8), size - units(4.8));
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function makeWindowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#070a0e';
  ctx.fillRect(0, 0, 64, 128);

  const cols = 4;
  const rows = 10;
  const cellW = 10;
  const cellH = 8;
  const gapX = (64 - cols * cellW) / (cols + 1);
  const gapY = (128 - rows * cellH) / (rows + 1);

  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const roll = Math.random();
      let color = '#0a1017';
      if (roll < 0.4) color = '#ffcf8a';
      else if (roll < 0.48) color = '#c7ff00';
      else if (roll < 0.56) color = '#8fd3ff';
      ctx.globalAlpha = color === '#0a1017' ? 1 : 0.5 + Math.random() * 0.5;
      ctx.fillStyle = color;
      ctx.fillRect(gapX + c * (cellW + gapX), gapY + r * (cellH + gapY), cellW, cellH);
    }
  }
  ctx.globalAlpha = 1;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function makeGlowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  gradient.addColorStop(0, 'rgba(255,255,255,0.95)');
  gradient.addColorStop(0.35, 'rgba(255,255,255,0.35)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeSignTexture(label, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.font = 'bold 62px ui-sans-serif, system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  const text = label.toUpperCase();
  const letters = Array.from(text);
  const widths = letters.map((letter) => ctx.measureText(letter).width + 5);
  const total = widths.reduce((sum, w) => sum + w, 0);
  let x = (512 - total) / 2;
  letters.forEach((letter, index) => {
    ctx.fillText(letter, x, 66);
    x += widths[index];
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Street-level frontage for Studio 808: a podium, marquee, lit door and signage
// low enough to read from the road. The tower alone was invisible at night.
function addStudioFrontage(group, landmark) {
  const face = landmark.z + 12;
  const lime = 0xc7ff00;

  const podium = new THREE.Mesh(
    new THREE.BoxGeometry(44, 18, 42),
    new THREE.MeshStandardMaterial({
      color: 0x101821,
      roughness: 0.72,
      metalness: 0.35,
      emissive: new THREE.Color(0x0e1a26),
      emissiveIntensity: 0.9,
    }),
  );
  podium.position.set(landmark.x, 9.5, landmark.z - 9);
  group.add(podium);

  const plaza = new THREE.Mesh(
    new THREE.BoxGeometry(52, 0.3, 22),
    new THREE.MeshStandardMaterial({ color: 0x242c36, roughness: 0.95 }),
  );
  plaza.position.set(landmark.x, 0.66, face + 11);
  group.add(plaza);

  // Entrance bay with a lit door.
  const bay = new THREE.Mesh(
    new THREE.BoxGeometry(9, 6.2, 0.7),
    new THREE.MeshStandardMaterial({ color: 0x05080b, roughness: 0.3, metalness: 0.6 }),
  );
  bay.position.set(landmark.x, 3.1, face + 0.32);
  group.add(bay);

  const bayLight = new THREE.Mesh(
    new THREE.PlaneGeometry(7, 4.6),
    new THREE.MeshBasicMaterial({
      color: 0xdaf7b0,
      transparent: true,
      opacity: 0.38,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  bayLight.position.set(landmark.x, 2.9, face + 0.7);
  group.add(bayLight);

  for (const side of [-1, 1]) {
    const jamb = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 6.4, 0.4),
      new THREE.MeshBasicMaterial({ color: lime, toneMapped: false }),
    );
    jamb.position.set(landmark.x + side * 4.5, 3.2, face + 0.6);
    group.add(jamb);
  }
  const header = new THREE.Mesh(
    new THREE.BoxGeometry(9.4, 0.3, 0.4),
    new THREE.MeshBasicMaterial({ color: lime, toneMapped: false }),
  );
  header.position.set(landmark.x, 6.5, face + 0.6);
  group.add(header);

  // Marquee slab with an under-glow, so the pavement is lit.
  const marquee = new THREE.Mesh(
    new THREE.BoxGeometry(20, 0.7, 7),
    new THREE.MeshStandardMaterial({ color: 0x0a0e13, roughness: 0.5, metalness: 0.6 }),
  );
  marquee.position.set(landmark.x, 7.3, face + 3.5);
  group.add(marquee);

  const underglow = new THREE.Mesh(
    new THREE.PlaneGeometry(19.2, 6.4),
    new THREE.MeshBasicMaterial({
      color: lime,
      transparent: true,
      opacity: 0.32,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  underglow.rotation.x = Math.PI / 2;
  underglow.position.set(landmark.x, 6.9, face + 3.5);
  group.add(underglow);

  const bulbGeometry = new THREE.SphereGeometry(0.17, 8, 6);
  const bulbs = new THREE.InstancedMesh(
    bulbGeometry,
    new THREE.MeshBasicMaterial({ color: lime, toneMapped: false }),
    14,
  );
  const bulbMatrix = new THREE.Matrix4();
  for (let i = 0; i < 14; i += 1) {
    bulbMatrix.makeTranslation(landmark.x - 9 + (i * 18) / 13, 7, face + 7.05);
    bulbs.setMatrixAt(i, bulbMatrix);
  }
  bulbs.instanceMatrix.needsUpdate = true;
  group.add(bulbs);

  // Big sign over the marquee, plus one on the side wall for cross traffic.
  const facadeSign = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 6),
    new THREE.MeshBasicMaterial({
      map: makeSignTexture('Studio 808', '#c7ff00'),
      transparent: true,
      toneMapped: false,
    }),
  );
  facadeSign.position.set(landmark.x, 9.6, face + 0.55);
  group.add(facadeSign);

  // Lit ground-floor band, so the venue reads from across the junction.
  const lightbox = new THREE.Mesh(
    new THREE.BoxGeometry(42, 0.42, 0.5),
    new THREE.MeshStandardMaterial({
      color: 0x1b2530,
      roughness: 0.4,
      metalness: 0.2,
      emissive: new THREE.Color(0xc7ff00),
      emissiveIntensity: 0.55,
    }),
  );
  lightbox.position.set(landmark.x, 4.7, face + 0.45);
  group.add(lightbox);

  for (const y of [7.6, 15.4]) {
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(43.4, 0.22, 0.3),
      new THREE.MeshBasicMaterial({ color: lime, toneMapped: false }),
    );
    strip.position.set(landmark.x, y, face + 0.35);
    group.add(strip);
  }

  const sideSign = new THREE.Mesh(
    new THREE.PlaneGeometry(24, 5),
    new THREE.MeshBasicMaterial({
      map: makeSignTexture('Studio 808', '#c7ff00'),
      transparent: true,
      toneMapped: false,
    }),
  );
  sideSign.position.set(landmark.x + 22.15, 10.2, face + 2);
  sideSign.rotation.y = Math.PI / 2;
  group.add(sideSign);

  const doorLight = new THREE.PointLight(lime, 60, 58, 2);
  doorLight.position.set(landmark.x, 5.2, face + 5);
  group.add(doorLight);
}

export function createCity() {
  const group = new THREE.Group();

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD, WORLD),
    new THREE.MeshStandardMaterial({ map: makeGroundTexture(), roughness: 1, metalness: 0 }),
  );
  ground.rotation.x = -Math.PI / 2;
  group.add(ground);

  // Raised sidewalks, so the blocks read as solid curbs.
  const slabs = new THREE.InstancedMesh(
    new THREE.BoxGeometry(BLOCK, 0.5, BLOCK),
    new THREE.MeshStandardMaterial({ color: 0x1a2029, roughness: 0.92, metalness: 0.04 }),
    BLOCKS.length,
  );
  const matrix = new THREE.Matrix4();
  BLOCKS.forEach((block, index) => {
    matrix.makeTranslation(block.x, 0.25, block.z);
    slabs.setMatrixAt(index, matrix);
  });
  slabs.instanceMatrix.needsUpdate = true;
  group.add(slabs);

  // Buildings.
  const landmarkKeys = new Set(
    Object.values(LANDMARKS).map((landmark) => `${landmark.x}:${landmark.z}`),
  );
  const buildings = [];
  for (const block of BLOCKS) {
    if (landmarkKeys.has(`${block.x}:${block.z}`)) continue;
    const density = 1 - Math.min(1, Math.hypot(block.x, block.z) / 360);
    const roll = random();
    const lots = [];
    if (roll < 0.4) {
      lots.push({ x: block.x, z: block.z - 13, w: 46, d: 22 });
      lots.push({ x: block.x, z: block.z + 13, w: 46, d: 22 });
    } else if (roll < 0.76) {
      for (const dx of [-13, 13]) {
        for (const dz of [-13, 13]) {
          lots.push({ x: block.x + dx, z: block.z + dz, w: 22, d: 22 });
        }
      }
    } else {
      lots.push({ x: block.x, z: block.z, w: 48, d: 48 });
    }
    for (const lot of lots) {
      const height = (14 + random() * 44) * (0.55 + density * 0.95);
      buildings.push({ ...lot, h: height });
    }
  }

  const windowTexture = makeWindowTexture();
  const buildingMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({
      map: windowTexture,
      emissiveMap: windowTexture,
      emissive: 0xffffff,
      emissiveIntensity: 0.85,
      roughness: 0.82,
      metalness: 0.08,
    }),
    buildings.length,
  );
  buildings.forEach((building, index) => {
    matrix.compose(
      new THREE.Vector3(building.x, 0.5 + building.h / 2, building.z),
      new THREE.Quaternion(),
      new THREE.Vector3(building.w, building.h, building.d),
    );
    buildingMesh.setMatrixAt(index, matrix);
  });
  buildingMesh.instanceMatrix.needsUpdate = true;
  group.add(buildingMesh);

  // Rooftop neon rims on a third of the towers.
  const accentColors = [0xc7ff00, 0xff3048, 0xffd700];
  const rims = buildings.filter(() => random() < 0.32);
  const rimMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicMaterial({ toneMapped: false }),
    rims.length,
  );
  const color = new THREE.Color();
  rims.forEach((building, index) => {
    matrix.compose(
      new THREE.Vector3(building.x, 0.5 + building.h + 0.2, building.z),
      new THREE.Quaternion(),
      new THREE.Vector3(building.w * 1.02, 0.26, building.d * 1.02),
    );
    rimMesh.setMatrixAt(index, matrix);
    color.setHex(accentColors[Math.floor(random() * accentColors.length)]);
    rimMesh.setColorAt(index, color);
  });
  rimMesh.instanceMatrix.needsUpdate = true;
  if (rimMesh.instanceColor) rimMesh.instanceColor.needsUpdate = true;
  group.add(rimMesh);

  // Landmark towers with neon edges and a readable sign.
  for (const landmark of Object.values(LANDMARKS)) {
    if (landmark.name === 'Salt Flats') {
      addAirfield(group, landmark);
      continue;
    }
    const height = landmark.name === 'TGG HQ' ? 56 : 92;
    const tower = new THREE.Mesh(
      new THREE.BoxGeometry(20, height, 20),
      new THREE.MeshStandardMaterial({
        color: 0x0a0d12,
        roughness: 0.72,
        metalness: 0.2,
        map: windowTexture,
        emissiveMap: windowTexture,
        emissive: new THREE.Color(landmark.color),
        emissiveIntensity: 0.6,
      }),
    );
    tower.position.set(landmark.x, 0.5 + height / 2, landmark.z);
    group.add(tower);

    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(tower.geometry),
      new THREE.LineBasicMaterial({
        color: landmark.color,
        transparent: true,
        opacity: 0.9,
        toneMapped: false,
      }),
    );
    edges.position.copy(tower.position);
    group.add(edges);

    const signColor = `#${new THREE.Color(landmark.color).getHexString()}`;
    const signTexture = makeSignTexture(landmark.name, signColor);
    for (const side of [1, -1]) {
      const sign = new THREE.Mesh(
        new THREE.PlaneGeometry(landmark.name === 'Studio 808' ? 19 : 28, 6),
        new THREE.MeshBasicMaterial({
          map: signTexture,
          transparent: true,
          side: THREE.DoubleSide,
          toneMapped: false,
        }),
      );
      sign.position.set(landmark.x, 0.5 + height - 10, landmark.z + side * 10.2);
      if (side === -1) sign.rotation.y = Math.PI;
      group.add(sign);
    }
  }

  addStudioFrontage(group, LANDMARKS.studio);

  // Streetlights at intersections: poles, lamp heads, pooled glow.
  const lampSpots = [];
  for (const x of ROAD_LINES) {
    for (const z of ROAD_LINES) {
      lampSpots.push({ x: x + 5.4, z: z + 5.4 });
    }
  }

  const poles = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.13, 0.2, 7.2, 6),
    new THREE.MeshStandardMaterial({ color: 0x1b222c, roughness: 0.6, metalness: 0.5 }),
    lampSpots.length,
  );
  const heads = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.4, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xffc27a, toneMapped: false }),
    lampSpots.length,
  );
  lampSpots.forEach((spot, index) => {
    matrix.makeTranslation(spot.x, 3.6, spot.z);
    poles.setMatrixAt(index, matrix);
    matrix.makeTranslation(spot.x, 7.25, spot.z);
    heads.setMatrixAt(index, matrix);
  });
  poles.instanceMatrix.needsUpdate = true;
  heads.instanceMatrix.needsUpdate = true;
  group.add(poles, heads);

  const poolGeometry = new THREE.PlaneGeometry(24, 24);
  poolGeometry.rotateX(-Math.PI / 2);
  const pools = new THREE.InstancedMesh(
    poolGeometry,
    new THREE.MeshBasicMaterial({
      map: makeGlowTexture(),
      color: 0xff9d5c,
      transparent: true,
      opacity: 0.16,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
    lampSpots.length,
  );
  lampSpots.forEach((spot, index) => {
    matrix.makeTranslation(spot.x, 0.08, spot.z);
    pools.setMatrixAt(index, matrix);
  });
  pools.instanceMatrix.needsUpdate = true;
  group.add(pools);
  // The glow decal is a night-only effect, not a general emissive surface.
  pools.material.userData.nightOnly = true;

  // Real lamp light: a capped subset of posts carries a point light, so the road
  // and kerbs are genuinely lit instead of only painted with a glow sprite.
  const MAX_LAMPS = 16;
  const step = Math.max(1, Math.ceil(lampSpots.length / MAX_LAMPS));
  lampSpots.forEach((spot, index) => {
    if (index % step !== 0) return;
    const lamp = new THREE.PointLight(0xffb46a, 180, 30, 2);
    lamp.position.set(spot.x, 6.7, spot.z);
    lamp.userData.nightLight = true;
    group.add(lamp);
  });

  return { group, blocks: BLOCKS, landmarks: LANDMARKS };
}
