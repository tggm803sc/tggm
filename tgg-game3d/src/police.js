import * as THREE from 'three';
import { HALF, ROAD_LINES } from './city.js';

const CHASE_SPEED = 24;

function nearestRoad(value) {
  let best = ROAD_LINES[0];
  for (const line of ROAD_LINES) {
    if (Math.abs(line - value) < Math.abs(best - value)) best = line;
  }
  return best;
}

export class Police {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'police';
    this.group.visible = false;
    this.pos = new THREE.Vector3(0, 0, 0);
    this.heading = 0;
    this.axis = 'x';
    this.lane = 0;
    this.active = false;
    this.distance = Infinity;
    this.flash = 0;
    this.build();
  }

  build() {
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0x0b0d12,
      roughness: 0.42,
      metalness: 0.55,
    });
    const whiteMaterial = new THREE.MeshStandardMaterial({
      color: 0xe4ebf5,
      roughness: 0.5,
      metalness: 0.25,
    });
    const glassMaterial = new THREE.MeshStandardMaterial({
      color: 0x0a1620,
      metalness: 0.9,
      roughness: 0.14,
      transparent: true,
      opacity: 0.9,
    });
    const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x080a0d, roughness: 0.95 });

    const add = (geometry, material, x, y, z) => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, y, z);
      this.group.add(mesh);
      return mesh;
    };

    add(new THREE.BoxGeometry(2.02, 0.64, 4.5), bodyMaterial, 0, 0.7, 0);
    add(new THREE.BoxGeometry(1.72, 0.54, 1.9), glassMaterial, 0, 1.26, -0.1);
    add(new THREE.BoxGeometry(1.58, 0.1, 1.6), bodyMaterial, 0, 1.54, -0.15);
    // Door flashes, so it reads as a unit rather than a black car.
    for (const side of [-1, 1]) {
      add(new THREE.BoxGeometry(0.05, 0.42, 1.7), whiteMaterial, side * 1.02, 0.78, 0.25);
    }

    const wheelGeometry = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 10);
    wheelGeometry.rotateZ(Math.PI / 2);
    for (const [x, z] of [
      [-0.96, 1.42],
      [0.96, 1.42],
      [-0.96, -1.45],
      [0.96, -1.45],
    ]) {
      add(wheelGeometry, wheelMaterial, x, 0.38, z);
    }

    add(new THREE.BoxGeometry(1.2, 0.14, 0.4), new THREE.MeshStandardMaterial({ color: 0x14181f }), 0, 1.62, -0.1);

    this.redBar = new THREE.Mesh(
      new THREE.BoxGeometry(0.46, 0.18, 0.34),
      new THREE.MeshStandardMaterial({
        color: 0x3a0a12,
        emissive: 0xff3048,
        emissiveIntensity: 2.4,
        toneMapped: false,
      }),
    );
    this.redBar.position.set(-0.4, 1.78, -0.1);
    this.blueBar = new THREE.Mesh(
      new THREE.BoxGeometry(0.46, 0.18, 0.34),
      new THREE.MeshStandardMaterial({
        color: 0x0a1a3a,
        emissive: 0x4a7bff,
        emissiveIntensity: 0.2,
        toneMapped: false,
      }),
    );
    this.blueBar.position.set(0.4, 1.78, -0.1);
    this.group.add(this.redBar, this.blueBar);

    // Headlight wash so it reads at night.
    const headMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xfff0c4,
      emissiveIntensity: 2.6,
    });
    for (const side of [-1, 1]) {
      add(new THREE.BoxGeometry(0.42, 0.14, 0.06), headMaterial, side * 0.62, 0.8, 2.26);
    }
  }

  alert(x, z) {
    const roadX = nearestRoad(x);
    const roadZ = nearestRoad(z);
    const candidates = [
      [roadX + 132, roadZ],
      [roadX - 132, roadZ],
      [roadX, roadZ + 132],
      [roadX, roadZ - 132],
    ].filter(([px, pz]) => Math.abs(px) < HALF - 18 && Math.abs(pz) < HALF - 18);

    const spot = candidates[Math.floor(Math.random() * candidates.length)] ?? [roadX, roadZ];
    this.pos.set(spot[0], 0, spot[1]);
    this.axis = Math.abs(spot[0] - x) > Math.abs(spot[1] - z) ? 'x' : 'z';
    this.lane = this.axis === 'x' ? nearestRoad(this.pos.z) : nearestRoad(this.pos.x);
    this.active = true;
    this.distance = Math.hypot(x - this.pos.x, z - this.pos.z);
    this.group.visible = true;
    this.group.position.copy(this.pos);
  }

  stop() {
    this.active = false;
    this.distance = Infinity;
    this.group.visible = false;
  }

  update(dt, player) {
    this.flash += dt;
    const redOn = this.flash % 0.7 < 0.35;
    this.redBar.material.emissiveIntensity = redOn ? 3.4 : 0.15;
    this.blueBar.material.emissiveIntensity = redOn ? 0.15 : 3.4;

    if (!this.active) return;

    const dx = player.x - this.pos.x;
    const dz = player.z - this.pos.z;
    this.distance = Math.hypot(dx, dz);
    if (this.distance > 300) {
      this.stop();
      return;
    }

    // Runs the grid rather than cutting through blocks.
    this.axis = Math.abs(dx) > Math.abs(dz) ? 'x' : 'z';
    const targetLane = this.axis === 'x' ? nearestRoad(this.pos.z) : nearestRoad(this.pos.x);
    this.lane += (targetLane - this.lane) * Math.min(1, dt * 2.5);

    const step = CHASE_SPEED * dt;
    if (this.axis === 'x') {
      this.pos.x += (Math.sign(dx) || 1) * step;
      this.pos.z = this.lane;
    } else {
      this.pos.z += (Math.sign(dz) || 1) * step;
      this.pos.x = this.lane;
    }

    this.pos.x = THREE.MathUtils.clamp(this.pos.x, -HALF + 12, HALF - 12);
    this.pos.z = THREE.MathUtils.clamp(this.pos.z, -HALF + 12, HALF - 12);
    this.heading = this.axis === 'x' ? (Math.sign(dx) > 0 ? Math.PI / 2 : -Math.PI / 2) : dz > 0 ? 0 : Math.PI;

    this.group.position.copy(this.pos);
    this.group.rotation.y = this.heading;
  }
}
