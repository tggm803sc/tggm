import * as THREE from 'three';
import {
  makeAsphaltPatchMaterial,
  makeConcreteMaterial,
  makeGlassMaterial,
  makeMetalTrimMaterial,
  makePaverMaterial,
} from './graphics/materials.js';

// Harbour Row — one city block built as architecture instead of a scaled box.
//
// The rest of the city is still the instanced box city in city.js. This block is the
// standard for replacing it: a podium with recessed glazed storefronts, awnings and
// sign bands; towers with setbacks, and a facade grid whose windows are *geometry*
// set back behind spandrels and piers, so the sun rakes across real depth. Street
// furniture, paving, curbs, markings and lamp fixtures finish the street level.
//
// Collision is untouched on purpose: city.js already treats the whole 60 m block as
// solid for cars and impassable on foot, so this replaces what you *see* inside that
// footprint and cannot change where anything can be driven or walked.

export const DISTRICT_BLOCK = { x: 0, z: 78, half: 30 };

const SHOP_COLORS = [0xffd27a, 0x8fd3ff, 0xff6f91, 0xc7ff00, 0xffa25c, 0xb78cff];

// Deterministic pseudo-random: the block must look identical on every load, or
// before/after screenshots compare two different buildings.
function rng(seed = 20261112) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function stripeCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#e9e4d8';
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = '#b8433f';
  for (let x = 0; x < 64; x += 16) ctx.fillRect(x, 0, 8, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

export function createDistrict({ detail = 'full' } = {}) {
  const group = new THREE.Group();
  group.name = 'district-harbour-row';
  const random = rng();
  const { x: BX, z: BZ, half } = DISTRICT_BLOCK;
  const BASE_Y = 0.5; // top of the sidewalk slab

  const props = new THREE.Group();
  props.name = 'district-props';
  const ornament = new THREE.Group();
  ornament.name = 'district-roof';
  group.add(props, ornament);
  const castRoots = [];

  // --- Materials -----------------------------------------------------------

  const pave = makePaverMaterial({ repeat: 12, tiles: 8 });
  const stone = makeConcreteMaterial({ repeat: 3 });
  const stoneLight = makeConcreteMaterial({ repeat: 3, base: [156, 152, 145] });
  const trimMetal = makeMetalTrimMaterial();
  const glass = makeGlassMaterial({ opacity: 0.72 });
  const shopGlass = makeGlassMaterial({ tint: 0x0e161d, opacity: 0.34 });
  const awning = new THREE.MeshStandardMaterial({
    map: stripeCanvas(),
    roughness: 0.85,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });
  awning.map.repeat.set(2, 1);

  // Windows: dark glass on most bays, warm interiors on a deterministic subset.
  // Not a mirror: a curtain wall reflects the sky, but at 0.45 metalness and 0.09
  // roughness the environment map turned every pane into a saturated flat rectangle
  // of sky or sun. Real glazing reads as dark glass with a sheen.
  const windowDark = new THREE.MeshPhysicalMaterial({
    color: 0x101a24,
    metalness: 0.18,
    roughness: 0.26,
    clearcoat: 0.85,
    clearcoatRoughness: 0.12,
    envMapIntensity: 0.95,
  });
  const windowLit = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  // The block drives its own glow from the clock; the global night walk must not
  // overwrite it, or the windows turn into a checkerboard at noon.
  windowLit.userData.managed = true;
  const litMaterial = windowLit;
  const spandrelMat = makeConcreteMaterial({ repeat: 1, base: [104, 100, 96] });
  const pierMat = makeConcreteMaterial({ repeat: 1, base: [132, 128, 120] });
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0, toneMapped: false, transparent: true, opacity: 0.5 });
  glowMat.userData.managed = true;
  const signMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  signMat.userData.managed = true;

  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const position = new THREE.Vector3();

  function push(list, { x: px, y, z: pz, sx = 1, sy = 1, sz = 1, ry = 0 }) {
    quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry);
    position.set(px, y, pz);
    scale.set(sx, sy, sz);
    matrix.compose(position, quaternion, scale);
    list.push(matrix.clone());
  }

  function instanced(list, geometry, material, { colorize = null } = {}) {
    if (!list.length) return null;
    const mesh = new THREE.InstancedMesh(geometry, material, list.length);
    list.forEach((entry, index) => mesh.setMatrixAt(index, entry));
    if (colorize) {
      const color = new THREE.Color();
      list.forEach((_entry, index) => {
        mesh.setColorAt(index, color.setHex(colorize(index)));
      });
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    mesh.instanceMatrix.needsUpdate = true;
    group.add(mesh);
    return mesh;
  }

  // --- Paving --------------------------------------------------------------

  const paving = new THREE.Mesh(new THREE.PlaneGeometry(half * 2 - 2, half * 2 - 2), pave);
  paving.rotation.x = -Math.PI / 2;
  paving.position.set(BX, BASE_Y + 0.012, BZ);
  // Second UV set for the AO map: the grout lines darken, which is what makes a
  // paving grid read as joints instead of a painted pattern.
  paving.geometry.setAttribute('uv1', paving.geometry.attributes.uv);
  paving.receiveShadow = true;
  group.add(paving);

  // --- Podium and storefronts ---------------------------------------------

  const podiumW = 48;
  const podiumD = 52;
  const podiumH = 6.5;
  const reveal = 2.0;

  // The podium is a wall assembly, not a solid box: a plinth, a header band and an
  // inset core. That leaves a 3.5 m deep reveal all the way round, which is where
  // the shop glazing sits — real recession, so awnings and pilasters cast into it
  // and the storefronts read as openings rather than stickers on a wall.
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(podiumW, 0.9, podiumD), stone);
  plinth.position.set(BX, BASE_Y + 0.45, BZ);
  group.add(plinth);

  const header = new THREE.Mesh(new THREE.BoxGeometry(podiumW, podiumH - 4.9, podiumD), stone);
  header.position.set(BX, BASE_Y + 4.9 + (podiumH - 4.9) / 2, BZ);
  group.add(header);

  const core = new THREE.Mesh(new THREE.BoxGeometry(podiumW - reveal * 2, podiumH, podiumD - reveal * 2), stone);
  core.position.set(BX, BASE_Y + podiumH / 2, BZ);
  group.add(core);

  // Close the reveal on the two faces nobody shops from, so the block is not hollow.
  const northFill = new THREE.Mesh(new THREE.BoxGeometry(podiumW, 3.5, reveal), stone);
  northFill.position.set(BX, BASE_Y + 3.15, BZ + podiumD / 2 - reveal / 2);
  group.add(northFill);
  const westFill = new THREE.Mesh(new THREE.BoxGeometry(reveal, 3.5, podiumD), stone);
  westFill.position.set(BX - podiumW / 2 + reveal / 2, BASE_Y + 3.15, BZ);
  group.add(westFill);

  // A cornice band caps the podium and catches the sun along the whole block.
  const cornice = new THREE.Mesh(new THREE.BoxGeometry(podiumW + 1.2, 0.55, podiumD + 1.2), stoneLight);
  cornice.position.set(BX, BASE_Y + podiumH, BZ);
  group.add(cornice);

  const glassList = [];
  const glowList = [];
  const frameList = [];
  const awningList = [];
  const signList = [];
  const signColors = [];
  const doorList = [];

  const BAY_W = 7.2;
  const BAY_H = 3.4;

  // One storefront bay: glazing set back in the reveal, pilasters either side, a
  // door, a striped awning and a lit sign band on the header. `side` names the face
  // ('south' is -z, 'east' is +x) and `dir` the outward normal, so every face is
  // built by the same code with sign flips instead of four near-copies.
  function bay(side, index, count) {
    const horizontal = side === 'south' || side === 'north';
    const span = (horizontal ? podiumW : podiumD) - 9;
    const step = span / count;
    const along = -span / 2 + step * (index + 0.5);
    const shop = SHOP_COLORS[index % SHOP_COLORS.length];
    const dir = side === 'south' ? -1 : side === 'north' ? 1 : side === 'east' ? 1 : -1;
    const faceZ = side === 'south' ? BZ - podiumD / 2 : BZ + podiumD / 2;
    const faceX = side === 'east' ? BX + podiumW / 2 : BX - podiumW / 2;
    const y = BASE_Y + 3.15;

    // Place a piece relative to its face. `out` is metres outwards from the facade,
    // `at` is metres along it.
    const place = (list, at, out, height, width, tall, depth) => {
      if (horizontal) {
        push(list, { x: BX + at, y: height, z: faceZ + dir * out, sx: width, sy: tall, sz: depth });
      } else {
        // rotateY(PI/2) maps local X to world Z, so the same width/depth pair works
        // on a side face without swapping them.
        push(list, { x: faceX + dir * out, y: height, z: BZ + at, sx: width, sy: tall, sz: depth, ry: Math.PI / 2 });
      }
    };

    // Negative `out` is inwards, into the reveal; positive is out over the pavement.
    place(glassList, along, -0.55, y, step - 1.5, 3.2, 0.1);
    place(glowList, along, -1.35, y, step - 1.7, 3.0, 0.06);
    for (const edge of [-1, 1]) {
      place(frameList, along + edge * (step / 2 - 0.22), -1.0, y, 0.55, 3.5, 1.9);
    }
    place(doorList, along, -0.35, BASE_Y + 2.65, 1.1, 2.5, 0.12);
    place(awningList, along, 0.95, BASE_Y + 4.55, step - 1.7, 0.12, 1.9);
    place(signList, along, 0.08, BASE_Y + 5.7, step - 2.2, 0.85, 0.14);
    signColors.push(shop);
  }

  // Both street-facing faces get shops: the street runs along the east side, and
  // the south face is what you see walking up to the block.
  for (let i = 0; i < 6; i += 1) bay('south', i, 6);
  for (let i = 0; i < 6; i += 1) bay('east', i, 6);
  for (let i = 0; i < 5; i += 1) bay('north', i, 5);

  instanced(glassList, unitBox, shopGlass);
  instanced(glowList, unitBox, glowMat);
  instanced(frameList, unitBox, stoneLight);
  instanced(awningList, unitBox, awning);
  instanced(doorList, unitBox, trimMetal);
  const signMesh = instanced(signList, unitBox, signMat, { colorize: (index) => signColors[index % signColors.length] });

  // --- Towers --------------------------------------------------------------

  const windowsDark = [];
  const windowsLit = [];
  const spandrels = [];
  const piers = [];
  const litColors = [];

  const FLOOR_H = 3.3;
  const WIN_W = 2.4;
  const WIN_H = 2.2;

  // Builds a facade grid on one vertical face of a tower.
  function facade({ cx, cz, w, d, y0, h, towerIndex }) {
    const faces = [
      { ry: 0, span: w, ax: cx, az: cz - d / 2, axis: 'x' },
      { ry: Math.PI, span: w, ax: cx, az: cz + d / 2, axis: 'x' },
      { ry: Math.PI / 2, span: d, ax: cx + w / 2, az: cz, axis: 'z' },
      { ry: -Math.PI / 2, span: d, ax: cx - w / 2, az: cz, axis: 'z' },
    ];
    for (const face of faces) {
      const bays = Math.max(1, Math.floor((face.span - 1.6) / 3.0));
      const step = face.span / bays;
      const floors = Math.max(1, Math.floor((h - 1.0) / FLOOR_H));
      for (let floor = 0; floor < floors; floor += 1) {
        const y = y0 + 0.8 + floor * FLOOR_H + WIN_H / 2;
        for (let i = 0; i < bays; i += 1) {
          const along = -face.span / 2 + step * (i + 0.5);
          const px = face.axis === 'x' ? face.ax + along : face.ax;
          const pz = face.axis === 'x' ? face.az : face.az + along;
          // Windows sit flush: the wall is solid, so a window has to be just proud
          // of it. The depth comes from the spandrels and piers, which stand 0.17 m
          // further out, putting a real shadow line either side of every pane.
          const insetX = face.axis === 'x' ? 0 : face.ry > 0 ? 0.05 : -0.05;
          const insetZ = face.axis === 'x' ? (face.ry === 0 ? -0.05 : 0.05) : 0;
          // One shop in six has its lights on during the day. A third was a
          // checkerboard, not a city.
          const litRoll = random();
          const entry = {
            x: px + insetX,
            y,
            z: pz + insetZ,
            sx: WIN_W,
            sy: WIN_H,
            sz: 0.16,
            ry: face.ry,
          };
          if (litRoll < 0.16) {
            push(windowsLit, entry);
            litColors.push(litRoll < 0.1 ? 0xffcf8a : 0xffe6c2);
          } else {
            push(windowsDark, entry);
          }
          push(spandrels, { ...entry, y: y + WIN_H / 2 + 0.42, sy: 0.55, sz: 0.34 });
          push(piers, { ...entry, x: px + insetX + (face.axis === 'x' ? step / 2 : 0), z: pz + insetZ + (face.axis === 'z' ? step / 2 : 0), sx: 0.6, sy: FLOOR_H, sz: 0.34 });
        }
      }
    }
    return { floors: Math.max(1, Math.floor((h - 1.0) / FLOOR_H)) };
  }

  const towers = [
    { x: BX - 9, z: BZ - 10, w: 26, d: 28, h: 46, tint: stone },
    { x: BX + 14, z: BZ + 10, w: 18, d: 18, h: 32, tint: stoneLight },
    { x: BX + 13, z: BZ - 12, w: 18, d: 22, h: 20, tint: stone },
  ];

  towers.forEach((tower, index) => {
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(tower.w, tower.h, tower.d), tower.tint);
    shaft.position.set(tower.x, BASE_Y + podiumH + tower.h / 2, tower.z);
    group.add(shaft);
    facade({ cx: tower.x, cz: tower.z, w: tower.w, d: tower.d, y0: BASE_Y + podiumH, h: tower.h, towerIndex: index });

    // Setback crown: a slimmer top, so the silhouette steps instead of ending flat.
    const capH = index === 0 ? 9 : 5;
    const capW = tower.w - 5;
    const capD = tower.d - 5;
    const cap = new THREE.Mesh(new THREE.BoxGeometry(capW, capH, capD), tower.tint);
    cap.position.set(tower.x, BASE_Y + podiumH + tower.h + capH / 2, tower.z);
    group.add(cap);
    facade({
      cx: tower.x,
      cz: tower.z,
      w: capW,
      d: capD,
      y0: BASE_Y + podiumH + tower.h,
      h: capH,
      towerIndex: index + 10,
    });

    // Parapet lip, then rooftop plant.
    const parapet = new THREE.Mesh(new THREE.BoxGeometry(capW + 0.9, 0.4, capD + 0.9), stoneLight);
    parapet.position.set(tower.x, BASE_Y + podiumH + tower.h + capH, tower.z);
    group.add(parapet);
    const roofY = BASE_Y + podiumH + tower.h + capH + 0.2;
    const units = index === 0 ? 4 : 2;
    for (let i = 0; i < units; i += 1) {
      const box = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.5, 2.0), trimMetal);
      box.position.set(
        tower.x - capW / 3 + (i % 2) * 3.6,
        roofY + 0.75,
        tower.z - capD / 4 + Math.floor(i / 2) * 3.4,
      );
      ornament.add(box);
    }
    if (index === 0) {
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, 2.6, 12), trimMetal);
      tank.position.set(tower.x + capW / 4, roofY + 1.3, tower.z + capD / 5);
      ornament.add(tank);
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 7, 6), trimMetal);
      mast.position.set(tower.x - capW / 4, roofY + 3.5, tower.z - capD / 5);
      ornament.add(mast);
      const beacon = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0xff3048, toneMapped: false }),
      );
      beacon.position.set(tower.x - capW / 4, roofY + 7.1, tower.z - capD / 5);
      ornament.add(beacon);
      const beaconLight = new THREE.PointLight(0xff3048, 12, 24, 2);
      beaconLight.position.copy(beacon.position);
      beaconLight.userData.nightLight = true;
      ornament.add(beaconLight);
    }
  });

  instanced(windowsDark, unitBox, windowDark);
  instanced(windowsLit, unitBox, litMaterial, { colorize: (index) => litColors[index % litColors.length] });
  instanced(spandrels, unitBox, spandrelMat);
  instanced(piers, unitBox, pierMat);

  // --- Street furniture ----------------------------------------------------

  // Trees along the east sidewalk, where the block meets the road.
  const treeSpots = [];
  for (let i = 0; i < 6; i += 1) {
    treeSpots.push({ x: BX + podiumW / 2 + 2.2, z: BZ - 22 + i * 8.6 });
  }
  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.24, 3.0, 7);
  const canopyGeo = new THREE.IcosahedronGeometry(1.55, 0);
  const barkMat = new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 0.95 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f5d33, roughness: 0.9, flatShading: true });
  const leafMatB = new THREE.MeshStandardMaterial({ color: 0x3c6f3b, roughness: 0.9, flatShading: true });

  treeSpots.forEach((spot, index) => {
    const trunk = new THREE.Mesh(trunkGeo, barkMat);
    trunk.position.set(spot.x, BASE_Y + 1.5, spot.z);
    trunk.castShadow = true;
    props.add(trunk);
    const lower = new THREE.Mesh(canopyGeo, leafMat);
    lower.position.set(spot.x, BASE_Y + 3.4, spot.z);
    lower.scale.set(1, 0.82, 1);
    lower.castShadow = true;
    props.add(lower);
    const upper = new THREE.Mesh(canopyGeo, leafMatB);
    upper.position.set(spot.x + 0.35 * (index % 2 ? 1 : -1), BASE_Y + 4.5, spot.z - 0.3);
    upper.scale.setScalar(0.72);
    upper.castShadow = true;
    props.add(upper);
  });

  // Tree pits: dark soil square with a steel grate, so the tree is planted, not floating.
  const pitMat = new THREE.MeshStandardMaterial({ color: 0x25201a, roughness: 0.98 });
  const pit = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.7), pitMat);
  pit.geometry.rotateX(-Math.PI / 2);
  const pits = new THREE.InstancedMesh(pit.geometry, pitMat, treeSpots.length);
  treeSpots.forEach((spot, index) => {
    matrix.makeTranslation(spot.x, BASE_Y + 0.02, spot.z);
    pits.setMatrixAt(index, matrix);
  });
  pits.instanceMatrix.needsUpdate = true;
  props.add(pits);

  // Benches and bins along the paving, clear of the storefront line.
  const benchWood = new THREE.MeshStandardMaterial({ color: 0x6d4b2c, roughness: 0.9 });
  for (let i = 0; i < 3; i += 1) {
    const bench = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.12, 0.6), benchWood);
    seat.position.y = 0.45;
    const back = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.5, 0.1), benchWood);
    back.position.set(0, 0.72, -0.26);
    bench.add(seat, back);
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.45, 0.5), trimMetal);
      leg.position.set(side * 1.05, 0.22, 0);
      bench.add(leg);
    }
    bench.position.set(BX + podiumW / 2 + 3.1, BASE_Y, BZ - 16 + i * 14);
    bench.rotation.y = -Math.PI / 2;
    props.add(bench);
  }

  const binMat = new THREE.MeshStandardMaterial({ color: 0x2b3138, roughness: 0.7, metalness: 0.4 });
  for (const z of [BZ - 10, BZ + 16]) {
    const bin = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.28, 0.9, 10), binMat);
    bin.position.set(BX + podiumW / 2 + 2.6, BASE_Y + 0.45, z);
    props.add(bin);
  }

  // Bollards at the corner, so the paving edge reads as a place cars cannot enter.
  const bollardGeo = new THREE.CylinderGeometry(0.11, 0.13, 0.9, 8);
  for (let i = 0; i < 6; i += 1) {
    const bollard = new THREE.Mesh(bollardGeo, trimMetal);
    bollard.position.set(BX + podiumW / 2 + 0.9, BASE_Y + 0.45, BZ - 24 + i * 3.2);
    props.add(bollard);
  }

  props.traverse((node) => {
    if (node.isMesh) node.receiveShadow = true;
  });

  // --- Streetlights, markings, kerb detail --------------------------------

  // Detailed fixtures over the two nearest poles. The pole and its glow sphere come
  // from the existing instanced streetlight system; this adds the arm and housing
  // that make it read as a real fitting.
  const armMat = trimMetal;
  const lensMat = new THREE.MeshBasicMaterial({ color: 0xffc98a, toneMapped: false });
  for (const spot of [{ x: 44.4, z: 44.4 }, { x: 44.4, z: 122.4 }]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.14, 0.14), armMat);
    arm.position.set(spot.x - 1.3, 7.15, spot.z);
    group.add(arm);
    const housing = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.3, 0.5), armMat);
    housing.position.set(spot.x - 2.5, 7.0, spot.z);
    group.add(housing);
    const lens = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.4), lensMat);
    lens.rotation.x = Math.PI / 2;
    lens.position.set(spot.x - 2.5, 6.83, spot.z);
    group.add(lens);
  }

  // Zebra crossings on the two approaches to the corner, plus a stop bar.
  const stripeGeo = new THREE.PlaneGeometry(0.62, 4.6);
  stripeGeo.rotateX(-Math.PI / 2);
  const paintMat = new THREE.MeshBasicMaterial({ color: 0xd6dbe2, toneMapped: false, transparent: true, opacity: 0.72 });
  const stripes = [];
  for (let i = 0; i < 8; i += 1) {
    for (const z of [111.5, 43.5]) {
      push(stripes, { x: 31.4 + i * 2.0, y: 0.03, z, sx: 1, sy: 1, sz: 1 });
    }
  }
  const stripeMesh = new THREE.InstancedMesh(stripeGeo, paintMat, stripes.length);
  stripes.forEach((entry, index) => stripeMesh.setMatrixAt(index, entry));
  stripeMesh.instanceMatrix.needsUpdate = true;
  stripeMesh.receiveShadow = true;
  group.add(stripeMesh);

  // Manholes and repair patches, so the road is layered rather than one flat sheet.
  const manholeMat = new THREE.MeshStandardMaterial({ color: 0x1d2228, roughness: 0.55, metalness: 0.6 });
  for (const spot of [{ x: 36, z: 100 }, { x: 42, z: 74 }, { x: 34, z: 55 }]) {
    const cover = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.05, 14), manholeMat);
    cover.position.set(spot.x, 0.03, spot.z);
    group.add(cover);
  }

  const patchMat = makeAsphaltPatchMaterial({ repeat: 2 });
  for (const spot of [{ x: 33.5, z: 88, w: 4.5, d: 6 }, { x: 45, z: 62, w: 5.5, d: 4 }]) {
    const patch = new THREE.Mesh(new THREE.PlaneGeometry(spot.w, spot.d), patchMat);
    patch.rotation.x = -Math.PI / 2;
    patch.position.set(spot.x, 0.022, spot.z);
    group.add(patch);
  }

  // Drain grates at the kerb line.
  const grateMat = new THREE.MeshStandardMaterial({ color: 0x14181d, metalness: 0.7, roughness: 0.5 });
  for (const z of [96, 66]) {
    const grate = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 1.1), grateMat);
    grate.position.set(29.6, 0.03, z);
    group.add(grate);
  }

  // --- Quality detail and night behaviour --------------------------------

  function setDetail(level) {
    const full = level === 'full';
    const standard = level === 'standard' || full;
    props.visible = standard;
    ornament.visible = full;
    awning.visible = true;
    return { level, props: standard, ornament: full };
  }
  setDetail(detail);

  // Called with the world clock's "lights on" factor (0 midday .. 1 night).
  function setNight(factor) {
    const f = Math.min(1, Math.max(0, factor));
    litMaterial.color.setScalar(0.35 + 0.75 * f);
    signMat.color.setScalar(0.55 + 0.6 * f);
    glowMat.opacity = 0.34 + 0.5 * f;
    lensMat.color.setRGB(1, 0.79, 0.54).multiplyScalar(0.25 + 0.85 * f);
    return f;
  }
  setNight(0);

  castRoots.push(props, ornament);

  return {
    group,
    props,
    ornament,
    castRoots,
    bounds: { x: BX, z: BZ, half },
    setDetail,
    setNight,
    materials: { pave, stone, stoneLight, windowDark, spandrelMat, pierMat },
  };
}
