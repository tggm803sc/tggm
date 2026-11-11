import * as THREE from 'three';
import { ROAD_LINES } from './city.js';

// 24 s cycle per junction: through green, amber, protected left arrow, all-red,
// then the same shape for the crossing road.
const PHASES = [
  { end: 6, x: 'green', z: 'red' },
  { end: 7, x: 'amber', z: 'red' },
  { end: 10, x: 'red', z: 'red', xArrow: true },
  { end: 11.5, x: 'red', z: 'red' },
  { end: 17.5, x: 'red', z: 'green' },
  { end: 18.5, x: 'red', z: 'amber' },
  { end: 21.5, x: 'red', z: 'red', zArrow: true },
  { end: 24, x: 'red', z: 'red' },
];

const CYCLE = 24;
const POLE_HEIGHT = 5.6;
const CORNER = 11.5;
const OFFSETS = [
  [-CORNER, -CORNER],
  [CORNER, -CORNER],
  [CORNER, CORNER],
  [-CORNER, CORNER],
];

const ON_COLORS = { red: 0xff3048, amber: 0xffd700, green: 0xc7ff00 };
const ARROW_COLOR = 0x7bff9e;
const WALK_COLOR = 0xf2f6ff;
const OFF_COLOR = 0x0c1015;

export function phaseAt(time) {
  const phaseTime = ((time % CYCLE) + CYCLE) % CYCLE;
  for (const phase of PHASES) {
    if (phaseTime < phase.end) return phase;
  }
  return PHASES[PHASES.length - 1];
}

export function signalState(time, axis) {
  return phaseAt(time)[axis];
}

// Pedestrians cross with the green of the road running alongside their crossing.
export function walkState(time, axis) {
  return signalState(time, axis) === 'green' ? 'walk' : 'wait';
}

export class Signals {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'signals';
    this.axes = [];
    this.last = { x: null, z: null, xArrow: false, zArrow: false };
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
    const boxGeometry = new THREE.BoxGeometry(0.58, 2.24, 0.36);
    const bulbGeometry = new THREE.SphereGeometry(0.19, 10, 8);
    const walkBoxGeometry = new THREE.BoxGeometry(0.46, 0.62, 0.32);
    const walkBulbGeometry = new THREE.SphereGeometry(0.16, 10, 8);

    const metalMaterial = new THREE.MeshStandardMaterial({
      color: 0x1b222c,
      roughness: 0.55,
      metalness: 0.55,
    });
    const housingMaterial = new THREE.MeshStandardMaterial({
      color: 0x0a0e13,
      roughness: 0.72,
      metalness: 0.25,
    });

    this.poles = new THREE.InstancedMesh(poleGeometry, metalMaterial, headCount);
    this.boxes = new THREE.InstancedMesh(boxGeometry, housingMaterial, headCount);
    this.bulbs = new THREE.InstancedMesh(
      bulbGeometry,
      new THREE.MeshBasicMaterial({ toneMapped: false }),
      headCount * 4,
    );
    this.walkBoxes = new THREE.InstancedMesh(walkBoxGeometry, housingMaterial, headCount);
    this.walkBulbs = new THREE.InstancedMesh(
      walkBulbGeometry,
      new THREE.MeshBasicMaterial({ toneMapped: false }),
      headCount,
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
        const facing = Math.atan2(-dx, -dz);
        dummy.position.set(point.x + dx, POLE_HEIGHT - 0.95, point.z + dz);
        dummy.rotation.set(0, facing, 0);
        dummy.updateMatrix();
        headMatrix.copy(dummy.matrix);
        this.boxes.setMatrixAt(index, headMatrix);

        // Corners on the same diagonal govern the east-west road, the others north-south.
        this.axes[index] = dx * dz > 0 ? 'x' : 'z';

        // Bulb order matches a real head: red, amber, green, left arrow.
        for (let bulb = 0; bulb < 4; bulb += 1) {
          offset.makeTranslation(0, 0.78 - bulb * 0.52, 0.22);
          dummy.matrix.copy(headMatrix).multiply(offset);
          this.bulbs.setMatrixAt(index * 4 + bulb, dummy.matrix);
        }

        dummy.position.set(point.x + dx, 3.1, point.z + dz);
        dummy.rotation.set(0, facing, 0);
        dummy.updateMatrix();
        this.walkBoxes.setMatrixAt(index, dummy.matrix);

        offset.makeTranslation(0, 0, 0.2);
        dummy.matrix.copy(dummy.matrix).multiply(offset);
        this.walkBulbs.setMatrixAt(index, dummy.matrix);

        index += 1;
      }
    }

    this.poles.instanceMatrix.needsUpdate = true;
    this.boxes.instanceMatrix.needsUpdate = true;
    this.bulbs.instanceMatrix.needsUpdate = true;
    this.walkBoxes.instanceMatrix.needsUpdate = true;
    this.walkBulbs.instanceMatrix.needsUpdate = true;

    this.group.add(this.poles, this.boxes, this.bulbs, this.walkBoxes, this.walkBulbs);

    this.paint('x', 'green', false);
    this.paint('z', 'red', false);
    this.paintWalk('x', true);
    this.paintWalk('z', false);
    this.last = { x: 'green', z: 'red', xArrow: false, zArrow: false };
  }

  paint(axis, state, arrow) {
    const color = new THREE.Color();
    for (let i = 0; i < this.headCount; i += 1) {
      if (this.axes[i] !== axis) continue;
      for (let bulb = 0; bulb < 4; bulb += 1) {
        let hex = OFF_COLOR;
        if (bulb === 0) hex = state === 'red' ? ON_COLORS.red : OFF_COLOR;
        else if (bulb === 1) hex = state === 'amber' ? ON_COLORS.amber : OFF_COLOR;
        else if (bulb === 2) hex = state === 'green' ? ON_COLORS.green : OFF_COLOR;
        else if (arrow) hex = ARROW_COLOR;
        color.setHex(hex);
        this.bulbs.setColorAt(i * 4 + bulb, color);
      }
    }
    if (this.bulbs.instanceColor) this.bulbs.instanceColor.needsUpdate = true;
  }

  paintWalk(axis, walking) {
    const color = new THREE.Color();
    for (let i = 0; i < this.headCount; i += 1) {
      if (this.axes[i] !== axis) continue;
      color.setHex(walking ? WALK_COLOR : ON_COLORS.red);
      this.walkBulbs.setColorAt(i, color);
    }
    if (this.walkBulbs.instanceColor) this.walkBulbs.instanceColor.needsUpdate = true;
  }

  update(time) {
    const phase = phaseAt(time);
    const xArrow = Boolean(phase.xArrow);
    const zArrow = Boolean(phase.zArrow);

    if (phase.x !== this.last.x || xArrow !== this.last.xArrow) {
      this.paint('x', phase.x, xArrow);
      this.paintWalk('x', phase.x === 'green');
      this.last.x = phase.x;
      this.last.xArrow = xArrow;
    }
    if (phase.z !== this.last.z || zArrow !== this.last.zArrow) {
      this.paint('z', phase.z, zArrow);
      this.paintWalk('z', phase.z === 'green');
      this.last.z = phase.z;
      this.last.zArrow = zArrow;
    }
  }
}
