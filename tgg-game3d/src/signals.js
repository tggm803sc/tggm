import * as THREE from 'three';
import { ROAD_LINES } from './city.js';

// One global 18 s cycle: the east-west road runs, all-red, then the north-south road.
const CYCLE = 18;
const POLE_HEIGHT = 5.6;
const CORNER = 13;
const OFFSETS = [
  [-CORNER, -CORNER],
  [CORNER, -CORNER],
  [CORNER, CORNER],
  [-CORNER, CORNER],
];

const ON_COLORS = { red: 0xff3048, amber: 0xffd700, green: 0xc7ff00 };
const OFF_COLOR = 0x0c1015;

export function signalState(time, axis) {
  const phase = time % CYCLE;
  if (axis === 'x') {
    if (phase < 7.5) return 'green';
    if (phase < 9) return 'amber';
    return 'red';
  }
  if (phase >= 9 && phase < 16.5) return 'green';
  if (phase >= 16.5) return 'amber';
  return 'red';
}

export class Signals {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'signals';
    this.axes = [];
    this.last = { x: null, z: null };
    this.build();
  }

  build() {
    const intersections = [];
    for (const x of ROAD_LINES) {
      for (const z of ROAD_LINES) intersections.push({ x, z });
    }

    const headCount = intersections.length * OFFSETS.length;
    this.headCount = headCount;

    const poleGeometry = new THREE.CylinderGeometry(0.11, 0.16, POLE_HEIGHT, 6);
    const boxGeometry = new THREE.BoxGeometry(0.58, 1.72, 0.34);
    const bulbGeometry = new THREE.SphereGeometry(0.135, 8, 6);

    this.poles = new THREE.InstancedMesh(
      poleGeometry,
      new THREE.MeshStandardMaterial({ color: 0x1b222c, roughness: 0.55, metalness: 0.55 }),
      headCount,
    );
    this.boxes = new THREE.InstancedMesh(
      boxGeometry,
      new THREE.MeshStandardMaterial({ color: 0x0a0e13, roughness: 0.72, metalness: 0.25 }),
      headCount,
    );
    this.bulbs = new THREE.InstancedMesh(
      bulbGeometry,
      new THREE.MeshBasicMaterial({ toneMapped: false }),
      headCount * 3,
    );

    const dummy = new THREE.Object3D();
    const offset = new THREE.Matrix4();
    const headMatrix = new THREE.Matrix4();
    let index = 0;

    for (const point of intersections) {
      for (const [dx, dz] of OFFSETS) {
        dummy.position.set(point.x + dx, POLE_HEIGHT / 2, point.z + dz);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        this.poles.setMatrixAt(index, dummy.matrix);

        // Heads face the middle of the junction, so the stack is readable from the road.
        dummy.position.set(point.x + dx, POLE_HEIGHT - 0.7, point.z + dz);
        dummy.rotation.set(0, Math.atan2(-dx, -dz), 0);
        dummy.updateMatrix();
        headMatrix.copy(dummy.matrix);
        this.boxes.setMatrixAt(index, headMatrix);

        // Corners on the same diagonal govern the east-west road, the others north-south.
        this.axes[index] = dx * dz > 0 ? 'x' : 'z';

        for (let bulb = 0; bulb < 3; bulb += 1) {
          offset.makeTranslation(0, 0.52 - bulb * 0.52, 0.2);
          dummy.matrix.copy(headMatrix).multiply(offset);
          this.bulbs.setMatrixAt(index * 3 + bulb, dummy.matrix);
        }

        index += 1;
      }
    }

    this.poles.instanceMatrix.needsUpdate = true;
    this.boxes.instanceMatrix.needsUpdate = true;
    this.bulbs.instanceMatrix.needsUpdate = true;

    this.group.add(this.poles, this.boxes, this.bulbs);
    this.paint('x', 'green');
    this.paint('z', 'red');
    this.last = { x: 'green', z: 'red' };
  }

  paint(axis, state) {
    const color = new THREE.Color();
    for (let i = 0; i < this.headCount; i += 1) {
      if (this.axes[i] !== axis) continue;
      for (let bulb = 0; bulb < 3; bulb += 1) {
        const slot = bulb === 0 ? 'red' : bulb === 1 ? 'amber' : 'green';
        color.setHex(slot === state ? ON_COLORS[slot] : OFF_COLOR);
        this.bulbs.setColorAt(i * 3 + bulb, color);
      }
    }
    if (this.bulbs.instanceColor) this.bulbs.instanceColor.needsUpdate = true;
  }

  update(time) {
    const x = signalState(time, 'x');
    const z = signalState(time, 'z');
    if (x !== this.last.x) {
      this.paint('x', x);
      this.last.x = x;
    }
    if (z !== this.last.z) {
      this.paint('z', z);
      this.last.z = z;
    }
  }
}
