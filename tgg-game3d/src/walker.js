import * as THREE from 'three';

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
    const jacket = new THREE.MeshStandardMaterial({
      color: 0xff3048,
      roughness: 0.6,
      metalness: 0.15,
    });
    const jeans = new THREE.MeshStandardMaterial({ color: 0x1b2430, roughness: 0.85 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xe8bf9a, roughness: 0.75 });
    const shoeMaterial = new THREE.MeshStandardMaterial({ color: 0x0a0c10, roughness: 0.9 });

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.46, 4, 10), jacket);
    torso.position.y = 1.18;
    this.group.add(torso);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 10), skin);
    head.position.y = 1.66;
    this.group.add(head);

    this.legs = [];
    for (const side of [-1, 1]) {
      const leg = new THREE.Group();
      leg.position.set(side * 0.12, 0.86, 0);
      const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.52, 0.19), jeans);
      thigh.position.y = -0.26;
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.12, 0.3), shoeMaterial);
      shoe.position.set(0, -0.56, 0.06);
      leg.add(thigh, shoe);
      this.group.add(leg);
      this.legs.push(leg);
    }

    this.arms = [];
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.4, 3, 8), jacket);
      arm.position.set(side * 0.33, 1.2, 0);
      this.group.add(arm);
      this.arms.push(arm);
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
    if (this.legs[0]) this.legs[0].rotation.x = swing;
    if (this.legs[1]) this.legs[1].rotation.x = -swing;
    if (this.arms[0]) this.arms[0].rotation.x = -swing * 0.7;
    if (this.arms[1]) this.arms[1].rotation.x = swing * 0.7;
  }
}
