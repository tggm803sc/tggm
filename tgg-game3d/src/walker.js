import * as THREE from 'three';

// The player on foot.
//
// The earlier version was a capsule with a sphere head and two stick arms. What
// made it read as a toy was not a missing texture: it was that nothing had a joint.
// This version has a chest, waist and hips, arms with elbows, legs with knees, shoes
// with soles, a collar, a cap and a face. It is still primitives — that is honest —
// but the silhouette and the segmented rig are what the eye reads as a person.

export class Walker {
  constructor(canWalk) {
    this.canWalk = canWalk;
    this.group = new THREE.Group();
    this.group.name = 'walker';
    this.group.visible = false;
    this.pos = new THREE.Vector3();
    this.heading = Math.PI;
    this.speed = 0;
    this.phase = 0;
    this.build();
  }

  get forward() {
    return new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
  }

  build() {
    // Cloth is matte. An earlier pass dropped roughness and pushed environment
    // intensity, which made the jacket read as wet plastic — the opposite of the goal.
    const jacket = new THREE.MeshStandardMaterial({
      color: 0xff3048,
      roughness: 0.78,
      metalness: 0.02,
      envMapIntensity: 0.35,
    });
    const jacketDark = new THREE.MeshStandardMaterial({
      color: 0xb3202f,
      roughness: 0.8,
      metalness: 0.02,
      envMapIntensity: 0.3,
    });
    const jeans = new THREE.MeshStandardMaterial({
      color: 0x1b2430,
      roughness: 0.82,
      metalness: 0.05,
      envMapIntensity: 0.6,
    });
    const skin = new THREE.MeshStandardMaterial({
      color: 0xe8bf9a,
      roughness: 0.62,
      metalness: 0,
      envMapIntensity: 0.5,
    });
    const hair = new THREE.MeshStandardMaterial({ color: 0x1a1512, roughness: 0.9 });
    const shoeMaterial = new THREE.MeshStandardMaterial({
      color: 0x0a0c10,
      roughness: 0.55,
      metalness: 0.15,
      envMapIntensity: 0.9,
    });
    const soleMaterial = new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.85 });
    const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0x101418, roughness: 0.35 });

    const mesh = (geometry, material, parent = this.group) => {
      const item = new THREE.Mesh(geometry, material);
      item.castShadow = true;
      parent.add(item);
      return item;
    };

    // --- Torso -------------------------------------------------------------
    // Chest and waist are separate volumes, so the jacket has a waistline instead of
    // being one uniform tube.
    const chest = mesh(new THREE.CapsuleGeometry(0.215, 0.42, 4, 12), jacket);
    chest.position.y = 1.29;
    chest.scale.set(1.02, 1, 0.82);

    const waist = mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.26, 12), jacketDark);
    waist.position.y = 1.03;
    waist.scale.set(1.05, 1, 0.8);

    const hips = mesh(new THREE.BoxGeometry(0.34, 0.16, 0.22), jeans);
    hips.position.y = 0.9;

    // Collar, so the neck does not simply grow out of the chest.
    const collar = mesh(new THREE.TorusGeometry(0.13, 0.045, 6, 12), jacketDark);
    collar.rotation.x = Math.PI / 2;
    collar.position.set(0, 1.5, 0);

    // Zip line down the jacket front.
    const zip = mesh(new THREE.BoxGeometry(0.025, 0.5, 0.02), jacketDark);
    zip.position.set(0, 1.28, 0.205);

    const neck = mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.11, 8), skin);
    neck.position.y = 1.55;

    // --- Head --------------------------------------------------------------
    const head = mesh(new THREE.SphereGeometry(0.165, 16, 12), skin);
    head.position.y = 1.73;
    head.scale.set(1, 1.1, 0.95);

    const jaw = mesh(new THREE.SphereGeometry(0.13, 12, 10), skin);
    jaw.position.set(0, 1.65, 0.03);
    jaw.scale.set(0.95, 0.8, 0.92);

    const nose = mesh(new THREE.ConeGeometry(0.032, 0.075, 6), skin);
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, 1.71, 0.16);

    for (const side of [-1, 1]) {
      const eye = mesh(new THREE.SphereGeometry(0.016, 8, 6), eyeMaterial);
      eye.position.set(side * 0.055, 1.75, 0.145);
      const brow = mesh(new THREE.BoxGeometry(0.055, 0.01, 0.014), hair);
      brow.position.set(side * 0.057, 1.778, 0.142);
      const ear = mesh(new THREE.SphereGeometry(0.032, 8, 6), skin);
      ear.position.set(side * 0.158, 1.735, 0);
      ear.scale.set(0.5, 1, 0.8);
    }

    // Cap: a hairline plus the TGG cap, which reads at distance better than a bare sphere.
    // The cap sits on the crown. At 1.765 the brim crossed the eyes and the whole
    // face read as a visor.
    const hairline = mesh(new THREE.SphereGeometry(0.168, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.52), hair);
    hairline.position.set(0, 1.79, -0.01);
    hairline.rotation.x = -0.1;
    const cap = mesh(new THREE.SphereGeometry(0.176, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), jacket);
    cap.position.set(0, 1.815, -0.005);
    const brim = mesh(new THREE.CylinderGeometry(0.175, 0.175, 0.026, 14, 1, false, 0, Math.PI), jacketDark);
    brim.position.set(0, 1.812, 0.105);
    brim.rotation.x = Math.PI / 2;

    // --- Arms --------------------------------------------------------------
    this.arms = [];
    this.elbows = [];
    for (const side of [-1, 1]) {
      const shoulder = mesh(new THREE.SphereGeometry(0.105, 10, 8), jacket);
      shoulder.position.set(side * 0.235, 1.41, 0);
      shoulder.scale.set(1, 0.9, 0.95);

      const arm = new THREE.Group();
      arm.position.set(side * 0.235, 1.39, 0);
      const upper = mesh(new THREE.CapsuleGeometry(0.068, 0.2, 3, 8), jacket, arm);
      upper.position.y = -0.14;
      const elbow = new THREE.Group();
      elbow.position.y = -0.27;
      const fore = mesh(new THREE.CapsuleGeometry(0.058, 0.18, 3, 8), jacketDark, elbow);
      fore.position.y = -0.12;
      const hand = mesh(new THREE.SphereGeometry(0.062, 8, 6), skin, elbow);
      hand.position.y = -0.25;
      hand.scale.set(0.85, 1.15, 0.7);
      arm.add(elbow);
      this.group.add(arm);
      this.arms.push(arm);
      this.elbows.push(elbow);
    }

    // --- Legs --------------------------------------------------------------
    this.legs = [];
    this.knees = [];
    for (const side of [-1, 1]) {
      const leg = new THREE.Group();
      leg.position.set(side * 0.115, 0.88, 0);
      const thigh = mesh(new THREE.CapsuleGeometry(0.082, 0.26, 3, 8), jeans, leg);
      thigh.position.y = -0.18;
      const knee = new THREE.Group();
      knee.position.y = -0.4;
      const shin = mesh(new THREE.CapsuleGeometry(0.072, 0.22, 3, 8), jeans, knee);
      shin.position.y = -0.15;
      const shoe = mesh(new THREE.BoxGeometry(0.13, 0.09, 0.27), shoeMaterial, knee);
      shoe.position.set(0, -0.33, 0.045);
      const toe = mesh(new THREE.BoxGeometry(0.125, 0.06, 0.08), shoeMaterial, knee);
      toe.position.set(0, -0.34, 0.16);
      const sole = mesh(new THREE.BoxGeometry(0.14, 0.025, 0.29), soleMaterial, knee);
      sole.position.set(0, -0.385, 0.05);
      leg.add(knee);
      this.group.add(leg);
      this.legs.push(leg);
      this.knees.push(knee);
    }
  }

  enter(carPos, heading) {
    const right = new THREE.Vector3(Math.cos(heading), 0, -Math.sin(heading));
    const door = { x: carPos.x + right.x * 2.2, z: carPos.z + right.z * 2.2 };
    if (this.canWalk(door.x, door.z)) {
      this.pos.set(door.x, 0, door.z);
    } else {
      this.pos.set(carPos.x, 0, carPos.z);
    }
    this.heading = heading;
    this.speed = 0;
    this.group.position.copy(this.pos);
    this.group.rotation.y = this.heading;
  }

  update(dt, input) {
    const turn = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    this.heading += turn * 2.5 * dt;

    const targetSpeed = input.throttle ? 5.4 : input.brake ? -2.6 : 0;
    this.speed += (targetSpeed - this.speed) * Math.min(1, dt * 6);

    const forward = this.forward;
    const dx = forward.x * this.speed * dt;
    const dz = forward.z * this.speed * dt;

    if (this.canWalk(this.pos.x + dx, this.pos.z)) this.pos.x += dx;
    else this.speed *= 0.35;
    if (this.canWalk(this.pos.x, this.pos.z + dz)) this.pos.z += dz;
    else this.speed *= 0.35;

    this.group.position.set(this.pos.x, 0, this.pos.z);
    this.group.rotation.y = this.heading;

    this.phase += Math.abs(this.speed) * dt * 3.4 + dt * 0.4;
    const swing = Math.sin(this.phase) * Math.min(0.6, Math.abs(this.speed) * 0.12);
    const walk = Math.min(1, Math.abs(this.speed) / 5);
    if (this.legs[0]) this.legs[0].rotation.x = swing;
    if (this.legs[1]) this.legs[1].rotation.x = -swing;
    // Knees only bend on the back swing, which is what stops the walk looking like a
    // pair of scissors.
    if (this.knees[0]) this.knees[0].rotation.x = Math.max(0, -swing) * 1.1 * walk;
    if (this.knees[1]) this.knees[1].rotation.x = Math.max(0, swing) * 1.1 * walk;
    if (this.arms[0]) this.arms[0].rotation.x = -swing * 0.7;
    if (this.arms[1]) this.arms[1].rotation.x = swing * 0.7;
    if (this.elbows[0]) this.elbows[0].rotation.x = -0.18 - Math.max(0, swing) * 0.5;
    if (this.elbows[1]) this.elbows[1].rotation.x = -0.18 - Math.max(0, -swing) * 0.5;
  }
}
