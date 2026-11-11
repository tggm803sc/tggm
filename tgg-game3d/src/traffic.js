import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BLOCKS, HALF, ROAD_LINES } from './city.js';
import { phaseAt, walkState } from './signals.js';

// Cars keep to the right of the centreline and turn at junctions.
const LANE = 4.3;
const CAR_COUNT = 16;
const PED_COUNT = 56;
const CROSSER_COUNT = 22;
const PED_INSET = 3.2;
const SIDEWALK_HALF = 30 - PED_INSET;
const CROSSING_SPAN = 19.6;
const CROSSING_OFFSET = 11.5;

const CAR_COLORS = [
  0xe6ecf5, 0x54657a, 0xb02a3e, 0x3f6f96, 0xc9a95f, 0x62705f, 0x8b96a5, 0xd21b31,
];

const PED_COLORS = [
  0xe8edf4, 0x2b3746, 0xc7ff00, 0xffd700, 0xff3048, 0x93a2b4, 0x37424f,
];

function nearestRoad(value) {
  let best = ROAD_LINES[0];
  for (const line of ROAD_LINES) {
    if (Math.abs(line - value) < Math.abs(best - value)) best = line;
  }
  return best;
}

function nextCrossing(s, dir) {
  let bestGap = null;
  for (const line of ROAD_LINES) {
    const gap = (line - s) * dir;
    if (gap > 0 && (bestGap === null || gap < bestGap)) bestGap = gap;
  }
  return bestGap === null ? s : s + dir * bestGap;
}

export class Traffic {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'traffic';
    this.cars = [];
    this.peds = [];
    this.crossers = [];
    this.positions = [];
    this.dummy = new THREE.Object3D();
    this.pedDummy = new THREE.Object3D();
    this.crosserDummy = new THREE.Object3D();
    this.hit = false;
    this.buildCars();
    this.buildPeds();
    this.buildCrossers();
  }

  buildCars() {
    const bodyGeometry = new THREE.BoxGeometry(1.94, 0.6, 4.24);
    bodyGeometry.translate(0, 0.68, 0);

    const cabinGeometry = new THREE.BoxGeometry(1.66, 0.5, 1.76);
    cabinGeometry.translate(0, 1.16, -0.16);

    const headGeometry = new THREE.PlaneGeometry(1.5, 0.16);
    headGeometry.translate(0, 0.76, 2.13);

    const tailGeometry = new THREE.PlaneGeometry(1.62, 0.14);
    tailGeometry.rotateY(Math.PI);
    tailGeometry.translate(0, 0.77, -2.13);

    // Four wheels merged into one geometry, so a whole car is 5 instanced draws.
    const wheelTemplate = new THREE.CylinderGeometry(0.34, 0.34, 0.26, 10);
    wheelTemplate.rotateZ(Math.PI / 2);
    const wheelGeometries = [];
    for (const [wheelX, wheelZ] of [
      [-0.95, 1.38],
      [0.95, 1.38],
      [-0.95, -1.4],
      [0.95, -1.4],
    ]) {
      const wheel = wheelTemplate.clone();
      wheel.translate(wheelX, 0.36, wheelZ);
      wheelGeometries.push(wheel);
    }
    const wheelsGeometry = mergeGeometries(wheelGeometries);

    this.carBody = new THREE.InstancedMesh(
      bodyGeometry,
      new THREE.MeshStandardMaterial({ roughness: 0.42, metalness: 0.55 }),
      CAR_COUNT,
    );
    this.carCabin = new THREE.InstancedMesh(
      cabinGeometry,
      new THREE.MeshStandardMaterial({ color: 0x0a121a, roughness: 0.16, metalness: 0.9 }),
      CAR_COUNT,
    );
    this.carHead = new THREE.InstancedMesh(
      headGeometry,
      new THREE.MeshBasicMaterial({ color: 0xfff3d2, toneMapped: false }),
      CAR_COUNT,
    );
    this.carTail = new THREE.InstancedMesh(
      tailGeometry,
      new THREE.MeshBasicMaterial({ color: 0xff3048, toneMapped: false }),
      CAR_COUNT,
    );
    this.carWheels = new THREE.InstancedMesh(
      wheelsGeometry,
      new THREE.MeshStandardMaterial({ color: 0x080a0d, roughness: 0.95, metalness: 0.1 }),
      CAR_COUNT,
    );

    const color = new THREE.Color();
    for (let i = 0; i < CAR_COUNT; i += 1) {
      const axis = Math.random() < 0.5 ? 'x' : 'z';
      const dir = Math.random() < 0.5 ? 1 : -1;
      const road = ROAD_LINES[Math.floor(Math.random() * ROAD_LINES.length)];
      const lane = axis === 'z' ? road - dir * LANE : road + dir * LANE;

      // Keep the spawn junction clear so the run never starts in a collision.
      let s = -HALF + 30 + Math.random() * (HALF * 2 - 60);
      for (let guard = 0; guard < 12; guard += 1) {
        const x = axis === 'z' ? lane : s;
        const z = axis === 'z' ? s : lane;
        if (Math.hypot(x - 39, z - 39) > 34) break;
        s = -HALF + 30 + Math.random() * (HALF * 2 - 60);
      }

      const base = 8.5 + Math.random() * 5;
      this.cars.push({
        axis,
        dir,
        lane,
        s,
        speed: base * 0.7,
        base,
        turnReady: true,
        intent: null,
      });
      color.setHex(CAR_COLORS[i % CAR_COLORS.length]);
      this.carBody.setColorAt(i, color);
    }
    if (this.carBody.instanceColor) this.carBody.instanceColor.needsUpdate = true;

    this.group.add(
      this.carBody,
      this.carCabin,
      this.carHead,
      this.carTail,
      this.carWheels,
    );
  }

  buildPeds() {
    this.pedBodyGeometry = new THREE.CapsuleGeometry(0.27, 0.82, 3, 8);
    this.pedBodyGeometry.translate(0, 0.86, 0);

    this.pedHeadGeometry = new THREE.SphereGeometry(0.19, 10, 8);
    this.pedHeadGeometry.translate(0, 1.58, 0);

    this.pedBody = new THREE.InstancedMesh(
      this.pedBodyGeometry,
      new THREE.MeshStandardMaterial({ roughness: 0.86, metalness: 0.04 }),
      PED_COUNT,
    );
    this.pedHead = new THREE.InstancedMesh(
      this.pedHeadGeometry,
      new THREE.MeshStandardMaterial({ color: 0xe8bf9a, roughness: 0.8 }),
      PED_COUNT,
    );

    const color = new THREE.Color();
    for (let i = 0; i < PED_COUNT; i += 1) {
      this.peds.push({
        block: BLOCKS[Math.floor(Math.random() * BLOCKS.length)],
        p: Math.random() * 4,
        speed: 1.1 + Math.random() * 0.9,
        dir: Math.random() < 0.5 ? 1 : -1,
        phase: Math.random() * Math.PI * 2,
      });
      color.setHex(PED_COLORS[i % PED_COLORS.length]);
      this.pedBody.setColorAt(i, color);
    }
    if (this.pedBody.instanceColor) this.pedBody.instanceColor.needsUpdate = true;

    this.group.add(this.pedBody, this.pedHead);
  }

  buildCrossers() {
    this.crosserBody = new THREE.InstancedMesh(
      this.pedBodyGeometry,
      new THREE.MeshStandardMaterial({ color: 0xd8dfe9, roughness: 0.86, metalness: 0.04 }),
      CROSSER_COUNT,
    );
    this.crosserHead = new THREE.InstancedMesh(
      this.pedHeadGeometry,
      new THREE.MeshStandardMaterial({ color: 0xe8bf9a, roughness: 0.8 }),
      CROSSER_COUNT,
    );

    for (let i = 0; i < CROSSER_COUNT; i += 1) {
      this.crossers.push({
        axis: Math.random() < 0.5 ? 'x' : 'z',
        x: ROAD_LINES[Math.floor(Math.random() * ROAD_LINES.length)],
        z: ROAD_LINES[Math.floor(Math.random() * ROAD_LINES.length)],
        side: Math.random() < 0.5 ? 1 : -1,
        t: Math.random(),
        dir: Math.random() < 0.5 ? 1 : -1,
        speed: 1.1 + Math.random() * 0.7,
      });
    }

    this.group.add(this.crosserBody, this.crosserHead);
  }

  update(dt, player, time) {
    let hit = false;
    const phase = phaseAt(time);

    for (let i = 0; i < this.cars.length; i += 1) {
      const car = this.cars[i];
      let x = car.axis === 'z' ? car.lane : car.s;
      let z = car.axis === 'z' ? car.s : car.lane;

      // Yield to the player ahead instead of driving through them.
      const aheadX = car.axis === 'z' ? 0 : car.dir;
      const aheadZ = car.axis === 'z' ? car.dir : 0;
      const toPlayerX = player.x - x;
      const toPlayerZ = player.z - z;
      const forwardDistance = toPlayerX * aheadX + toPlayerZ * aheadZ;
      const lateral = Math.abs(toPlayerX * aheadZ - toPlayerZ * aheadX);
      const yielding = forwardDistance > 0 && forwardDistance < 14 && lateral < 3.7;

      // Signals only let one axis through at a time; left turners may use the arrow.
      const throughGreen = phase[car.axis] === 'green';
      const arrowGreen = car.intent === 'left' && Boolean(phase[`${car.axis}Arrow`]);
      const mayProceed = throughGreen || arrowGreen;
      const toStopLine = (nextCrossing(car.s, car.dir) - car.s) * car.dir - 5;
      const redAhead = !mayProceed && toStopLine > -1 && toStopLine < 18;

      let queued = false;
      for (let j = 0; j < this.cars.length; j += 1) {
        if (j === i) continue;
        const other = this.cars[j];
        if (other.axis !== car.axis || Math.abs(other.lane - car.lane) > 1.6) continue;
        const gap = (other.s - car.s) * car.dir;
        if (gap > 0 && gap < 9) {
          queued = true;
          break;
        }
      }

      const stopping = yielding || redAhead || queued;
      const targetSpeed = stopping ? 0 : car.base;
      car.speed += (targetSpeed - car.speed) * Math.min(1, dt * (stopping ? 8 : 2.2));

      const previousS = car.s;
      car.s += car.dir * car.speed * dt;

      if (car.s > HALF - 10) car.s = -HALF + 10;
      if (car.s < -HALF + 10) car.s = HALF - 10;

      const crossing = nearestRoad(previousS);
      if (car.turnReady && Math.abs(previousS - crossing) < 2) {
        car.turnReady = false;
        if (car.intent) {
          const nextAxis = car.axis === 'x' ? 'z' : 'x';
          const left = car.intent === 'left';
          const oldLane = car.lane;
          const nextDir =
            car.axis === 'x' ? (left ? -car.dir : car.dir) : left ? car.dir : -car.dir;
          car.axis = nextAxis;
          car.dir = nextDir;
          car.s = oldLane;
          car.lane = nextAxis === 'z' ? crossing - nextDir * LANE : crossing + nextDir * LANE;
          car.speed *= 0.55;
          car.intent = null;
        }
      } else if (Math.abs(previousS - nearestRoad(previousS)) > 9) {
        car.turnReady = true;
        if (!car.intent) {
          const roll = Math.random();
          if (roll < 0.26) car.intent = 'left';
          else if (roll < 0.52) car.intent = 'right';
        }
      }

      x = car.axis === 'z' ? car.lane : car.s;
      z = car.axis === 'z' ? car.s : car.lane;

      let heading = 0;
      if (car.axis === 'z') heading = car.dir > 0 ? 0 : Math.PI;
      else heading = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;

      const dummy = this.dummy;
      dummy.position.set(x, 0, z);
      dummy.rotation.y = heading;
      dummy.updateMatrix();
      this.carBody.setMatrixAt(i, dummy.matrix);
      this.carCabin.setMatrixAt(i, dummy.matrix);
      this.carHead.setMatrixAt(i, dummy.matrix);
      this.carTail.setMatrixAt(i, dummy.matrix);
      this.carWheels.setMatrixAt(i, dummy.matrix);

      this.positions[i] = { x, z };

      if (!hit) {
        const dx = player.x - x;
        const dz = player.z - z;
        if (dx * dx + dz * dz < 13.7) hit = true;
      }
    }

    this.carBody.instanceMatrix.needsUpdate = true;
    this.carCabin.instanceMatrix.needsUpdate = true;
    this.carHead.instanceMatrix.needsUpdate = true;
    this.carTail.instanceMatrix.needsUpdate = true;
    this.carWheels.instanceMatrix.needsUpdate = true;

    for (let i = 0; i < this.peds.length; i += 1) {
      const ped = this.peds[i];
      ped.p = (ped.p + (ped.dir * ped.speed * dt) / (SIDEWALK_HALF * 2) + 4) % 4;
      const side = Math.floor(ped.p);
      const along = -SIDEWALK_HALF + (ped.p - side) * SIDEWALK_HALF * 2;
      const block = ped.block;

      let x = block.x;
      let z = block.z;
      let heading = 0;
      if (side === 0) {
        x += along;
        z -= SIDEWALK_HALF;
        heading = ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      } else if (side === 1) {
        x += SIDEWALK_HALF;
        z += along;
        heading = ped.dir > 0 ? 0 : Math.PI;
      } else if (side === 2) {
        x -= along;
        z += SIDEWALK_HALF;
        heading = ped.dir > 0 ? -Math.PI / 2 : Math.PI / 2;
      } else {
        x -= SIDEWALK_HALF;
        z -= along;
        heading = ped.dir > 0 ? Math.PI : 0;
      }

      const dummy = this.pedDummy;
      // Sidewalk slabs are raised 0.5, so pedestrians stand on the curb, not in it.
      dummy.position.set(x, 0.5 + Math.abs(Math.sin(time * 5 + ped.phase)) * 0.06, z);
      dummy.rotation.y = heading;
      dummy.updateMatrix();
      this.pedBody.setMatrixAt(i, dummy.matrix);
      this.pedHead.setMatrixAt(i, dummy.matrix);
    }

    this.pedBody.instanceMatrix.needsUpdate = true;
    this.pedHead.instanceMatrix.needsUpdate = true;

    for (let i = 0; i < this.crossers.length; i += 1) {
      const crosser = this.crossers[i];
      const walking = walkState(time, crosser.axis) === 'walk';
      // Anyone caught mid-road clears the crossing instead of freezing in traffic.
      const midCrossing = crosser.t > 0.02 && crosser.t < 0.98;
      if (walking || midCrossing) {
        crosser.t += (crosser.dir * crosser.speed * dt) / CROSSING_SPAN;
      }
      if (crosser.t > 1) {
        crosser.t = 1;
        crosser.dir = -1;
      } else if (crosser.t < 0) {
        crosser.t = 0;
        crosser.dir = 1;
      }

      const along = -CROSSING_SPAN / 2 + crosser.t * CROSSING_SPAN;
      let x = crosser.x;
      let z = crosser.z;
      let heading = 0;
      if (crosser.axis === 'x') {
        x += along;
        z += crosser.side * CROSSING_OFFSET;
        heading = crosser.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        x += crosser.side * CROSSING_OFFSET;
        z += along;
        heading = crosser.dir > 0 ? 0 : Math.PI;
      }

      const dummy = this.crosserDummy;
      dummy.position.set(x, 0.08 + Math.abs(Math.sin(time * 6 + i)) * 0.05, z);
      dummy.rotation.y = heading;
      dummy.updateMatrix();
      this.crosserBody.setMatrixAt(i, dummy.matrix);
      this.crosserHead.setMatrixAt(i, dummy.matrix);
    }

    this.crosserBody.instanceMatrix.needsUpdate = true;
    this.crosserHead.instanceMatrix.needsUpdate = true;

    this.hit = hit;
    return hit;
  }
}
