import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// The player vehicle.
//
// The coupe used to be seven boxes and two cylinders. It is now a body extruded
// from a side profile — so it has a bonnet, a slope over the cabin and a boot —
// with a separate raked greenhouse, flared arches, real rims, mirrors, a splitter,
// exhausts and an interior you can see through the glass. Every part is merged by
// material, so the whole car is about fifteen draw calls.
//
// The cargo van is deliberately untouched: the milestone is one detailed vehicle,
// and the van is a working tool whose dimensions the cargo bay depends on.

export class Car {
  constructor(canOccupy, options = {}) {
    this.canOccupy = canOccupy;
    this.van = Boolean(options.van);
    // A loaded cargo van is slower, heavier on the brakes and steers wider.
    this.maxSpeed = this.van ? 22 : 34;
    this.accel = this.van ? 8.5 : 13;
    this.brakePower = this.van ? 20 : 26;
    this.steerRate = this.van ? 1.12 : 1.55;
    this.impact = false;
    this.impactSpeed = 0;
    this.group = new THREE.Group();
    this.pos = new THREE.Vector3(0, 0, 0);
    this.heading = Math.PI;
    this.speed = 0;
    this.steer = 0;
    this.spin = 0;
    this.wheels = [];
    this.frontPivots = [];
    this.build();
  }

  get forward() {
    return new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
  }

  build() {
    if (this.van) {
      this.buildVan();
      return;
    }

    // Clearcoat with an environment map is what separates paint from coloured
    // plastic: the clear layer carries the highlight, the base carries the hue.
    const bodyMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xb0122a,
      metalness: 0.55,
      roughness: 0.3,
      clearcoat: 0.9,
      clearcoatRoughness: 0.14,
      envMapIntensity: 1.35,
    });
    const trimMaterial = new THREE.MeshStandardMaterial({
      color: 0x0a0d12,
      metalness: 0.55,
      roughness: 0.45,
    });
    const glassMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x0a1620,
      metalness: 0.2,
      roughness: 0.05,
      clearcoat: 1,
      clearcoatRoughness: 0.03,
      envMapIntensity: 1.8,
      transparent: true,
      opacity: 0.62,
    });
    const headMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xfff0c4,
      emissiveIntensity: 3.4,
    });
    this.tailMaterial = new THREE.MeshStandardMaterial({
      color: 0x3a0a12,
      emissive: 0xff3048,
      emissiveIntensity: 1.6,
    });
    const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x090a0d, roughness: 0.92 });
    const rimMaterial = new THREE.MeshStandardMaterial({
      color: 0xc9ced6,
      metalness: 0.9,
      roughness: 0.26,
      envMapIntensity: 1.4,
    });
    const interiorMaterial = new THREE.MeshStandardMaterial({ color: 0x0c0f13, roughness: 0.75 });
    const accentMaterial = new THREE.MeshStandardMaterial({
      color: 0xc7ff00,
      emissive: 0xc7ff00,
      emissiveIntensity: 0.7,
      metalness: 0.6,
      roughness: 0.3,
    });

    // --- Body ----------------------------------------------------------------
    // The profile is drawn with the nose at -X because rotateY(PI/2) maps -X to
    // +Z, which is the direction this car drives in.
    // The outline is scalloped over both axles rather than a rectangle, which gives
    // the car open wheel arches. Without them the wheels are discs glued to a slab,
    // and no amount of paint detail fixes that silhouette.
    const arch = (shape, cx, cy, radius, steps = 10) => {
      for (let i = 0; i <= steps; i += 1) {
        const angle = Math.PI - (i / steps) * Math.PI;
        shape.lineTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
      }
    };

    const body = new THREE.Shape();
    body.moveTo(-2.06, 0.34);
    body.lineTo(-1.84, 0.3);
    arch(body, -1.38, 0.36, 0.46);
    body.lineTo(0.92, 0.3);
    arch(body, 1.4, 0.36, 0.46);
    body.lineTo(2.08, 0.36);
    body.lineTo(2.15, 0.5);
    body.lineTo(2.15, 0.8);
    body.lineTo(2.02, 0.88);
    body.lineTo(1.3, 0.92);
    body.lineTo(-0.72, 0.92);
    body.lineTo(-1.32, 0.86);
    body.lineTo(-1.98, 0.8);
    body.lineTo(-2.12, 0.7);
    body.closePath();

    const bodyGeometry = new THREE.ExtrudeGeometry(body, {
      depth: 1.84,
      bevelEnabled: true,
      bevelThickness: 0.08,
      bevelSize: 0.07,
      bevelSegments: 3,
      curveSegments: 6,
      steps: 1,
    });
    // ExtrudeGeometry starts at z = 0 and runs to depth, so it sits half a car to one
    // side until it is centred. This is what made the body, cabin and wheels look
    // like they belonged to three different vehicles.
    bodyGeometry.translate(0, 0, -0.92);
    bodyGeometry.rotateY(Math.PI / 2);
    bodyGeometry.computeVertexNormals();

    const bodyParts = [bodyGeometry];

    // Mirrors on short stalks, so the silhouette is not a clean wedge.
    for (const side of [-1, 1]) {
      const stalk = new THREE.BoxGeometry(0.14, 0.035, 0.05);
      stalk.translate(side * 0.94, 1.0, 0.88);
      const housing = new THREE.BoxGeometry(0.08, 0.085, 0.17);
      housing.translate(side * 1.0, 1.0, 0.9);
      bodyParts.push(stalk, housing);
    }

    // Side skirts and a small ducktail spoiler.
    for (const side of [-1, 1]) {
      const skirt = new THREE.BoxGeometry(0.06, 0.13, 2.4);
      skirt.translate(side * 0.94, 0.34, 0);
      bodyParts.push(skirt);
    }
    const spoiler = new THREE.BoxGeometry(1.44, 0.04, 0.22);
    spoiler.translate(0, 0.97, -1.94);
    bodyParts.push(spoiler);
    for (const side of [-1, 1]) {
      const leg = new THREE.BoxGeometry(0.06, 0.07, 0.09);
      leg.translate(side * 0.58, 0.93, -1.94);
      bodyParts.push(leg);
    }

    // A thin arch lip, so the cut edges are not paper-thin from the side.
    for (const z of [1.38, -1.4]) {
      for (const side of [-1, 1]) {
        const lip = new THREE.TorusGeometry(0.455, 0.03, 5, 14, Math.PI);
        lip.rotateY(Math.PI / 2);
        lip.rotateZ(Math.PI / 2);
        lip.translate(side * 0.98, 0.36, z);
        bodyParts.push(lip);
      }
    }

    // ExtrudeGeometry is non-indexed and the boxes are indexed, and mergeGeometries
    // will not mix the two — it returns null, which used to surface as a renderer
    // crash on `geometry.morphAttributes`. Everything goes in non-indexed.
    const mergedBody = mergeGeometries(
      bodyParts.map((part) => (part.index ? part.toNonIndexed() : part)),
      false,
    );
    if (!mergedBody) throw new Error('coupe body geometry failed to merge');
    const bodyMesh = new THREE.Mesh(mergedBody, bodyMaterial);
    bodyMesh.castShadow = true;
    this.group.add(bodyMesh);

    // --- Greenhouse ----------------------------------------------------------
    const cabin = new THREE.Shape();
    cabin.moveTo(-1.05, 0.9);
    cabin.lineTo(1.3, 0.92);
    cabin.lineTo(0.75, 1.4);
    cabin.lineTo(-0.35, 1.38);
    cabin.closePath();
    const cabinGeometry = new THREE.ExtrudeGeometry(cabin, {
      depth: 1.58,
      bevelEnabled: true,
      bevelThickness: 0.03,
      bevelSize: 0.03,
      bevelSegments: 2,
      curveSegments: 4,
      steps: 1,
    });
    cabinGeometry.translate(0, 0, -0.79);
    cabinGeometry.rotateY(Math.PI / 2);
    const cabinMesh = new THREE.Mesh(cabinGeometry, glassMaterial);
    this.group.add(cabinMesh);

    // Roof panel in body colour, so the glass reads as windows around a solid roof.
    // The cabin profile runs from z +1.05 (windshield) to -1.15 (rear glass), so the
    // roof sits between those, not above the windscreen.
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.54, 0.06, 1.06), bodyMaterial);
    roof.position.set(0, 1.395, -0.2);
    this.group.add(roof);

    // --- Trim, lights, interior ---------------------------------------------
    const trimParts = [];
    const splitter = new THREE.BoxGeometry(1.78, 0.05, 0.26);
    splitter.translate(0, 0.3, 2.02);
    trimParts.push(splitter);
    for (let i = 0; i < 3; i += 1) {
      const slat = new THREE.BoxGeometry(0.86, 0.035, 0.06);
      slat.translate(0, 0.58 + i * 0.07, 2.13);
      trimParts.push(slat);
    }
    for (const side of [-1, 1]) {
      const handle = new THREE.BoxGeometry(0.04, 0.03, 0.18);
      handle.translate(side * 0.98, 1.0, -0.1);
      trimParts.push(handle);
      const exhaust = new THREE.CylinderGeometry(0.052, 0.052, 0.16, 10);
      exhaust.rotateX(Math.PI / 2);
      exhaust.translate(side * 0.34, 0.36, -2.12);
      trimParts.push(exhaust);
      const mirrorLip = new THREE.BoxGeometry(0.02, 0.02, 0.18);
      mirrorLip.translate(side * 1.11, 1.0, 0.9);
      trimParts.push(mirrorLip);
    }
    const trimMesh = new THREE.Mesh(mergeGeometries(trimParts, false), trimMaterial);
    this.group.add(trimMesh);

    const headParts = [];
    for (const side of [-1, 1]) {
      const lens = new THREE.SphereGeometry(0.155, 10, 8);
      lens.scale(1, 0.34, 0.2);
      // Just proud of the nose: the body's bevel reaches z 2.23, so a lens at 2.02
      // was buried inside the bodywork and never seen.
      lens.translate(side * 0.58, 0.74, 2.19);
      headParts.push(lens);
    }
    const headMesh = new THREE.Mesh(mergeGeometries(headParts, false), headMaterial);
    this.group.add(headMesh);

    const tailParts = [];
    for (const side of [-1, 1]) {
      const lamp = new THREE.BoxGeometry(0.46, 0.11, 0.06);
      lamp.translate(side * 0.62, 0.78, -2.2);
      tailParts.push(lamp);
    }
    const bar = new THREE.BoxGeometry(1.24, 0.045, 0.05);
    bar.translate(0, 0.78, -2.2);
    tailParts.push(bar);
    const tailMesh = new THREE.Mesh(mergeGeometries(tailParts, false), this.tailMaterial);
    this.group.add(tailMesh);

    const interiorParts = [];
    for (const side of [-1, 1]) {
      const seat = new THREE.BoxGeometry(0.46, 0.13, 0.5);
      seat.translate(side * 0.37, 0.86, -0.3);
      const back = new THREE.BoxGeometry(0.46, 0.52, 0.13);
      back.translate(side * 0.37, 1.09, -0.58);
      interiorParts.push(seat, back);
    }
    const dash = new THREE.BoxGeometry(1.44, 0.16, 0.3);
    dash.translate(0, 0.94, 0.72);
    interiorParts.push(dash);
    const wheelRim = new THREE.TorusGeometry(0.15, 0.022, 6, 14);
    wheelRim.translate(-0.36, 1.0, 0.6);
    interiorParts.push(wheelRim);
    const console = new THREE.BoxGeometry(0.3, 0.18, 0.7);
    console.translate(0, 0.94, 0.1);
    interiorParts.push(console);
    const interiorMesh = new THREE.Mesh(mergeGeometries(interiorParts, false), interiorMaterial);
    this.group.add(interiorMesh);

    // Lime side blades: the TGG accent, low on the doors.
    for (const side of [-1, 1]) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.055, 2.2), accentMaterial);
      blade.position.set(side * 0.99, 0.42, 0);
      this.group.add(blade);
    }

    // --- Wheels --------------------------------------------------------------
    const tyreGeometry = mergeGeometries(
      [
        new THREE.CylinderGeometry(0.38, 0.38, 0.26, 22).rotateZ(Math.PI / 2),
        new THREE.TorusGeometry(0.335, 0.045, 6, 18).rotateY(Math.PI / 2),
      ],
      false,
    );

    const rimParts = [new THREE.CylinderGeometry(0.27, 0.27, 0.05, 18).rotateZ(Math.PI / 2)];
    for (let i = 0; i < 5; i += 1) {
      const spoke = new THREE.BoxGeometry(0.04, 0.44, 0.075);
      spoke.rotateX((i / 5) * Math.PI * 2);
      rimParts.push(spoke);
    }
    rimParts.push(new THREE.CylinderGeometry(0.09, 0.09, 0.07, 10).rotateZ(Math.PI / 2));
    const rimGeometry = mergeGeometries(rimParts, false);

    const wheelPositions = [
      [-0.92, 0.38, 1.38],
      [0.92, 0.38, 1.38],
      [-0.92, 0.38, -1.4],
      [0.92, 0.38, -1.4],
    ];

    wheelPositions.forEach(([x, y, z], index) => {
      const pivot = new THREE.Group();
      pivot.position.set(x, y, z);
      const wheel = new THREE.Mesh(tyreGeometry, wheelMaterial);
      const rim = new THREE.Mesh(rimGeometry, rimMaterial);
      // The rim has to sit at the outboard face of the tyre, not its centre plane,
      // or it is invisible from every angle that matters.
      rim.position.x = x > 0 ? 0.11 : -0.11;
      wheel.add(rim);
      wheel.castShadow = true;
      pivot.add(wheel);
      this.group.add(pivot);
      this.wheels.push(wheel);
      if (index < 2) this.frontPivots.push(pivot);
    });

    // Headlight throw.
    const spot = new THREE.SpotLight(0xfff2d6, 900, 110, 0.52, 0.6, 2);
    spot.position.set(0, 0.85, 2.1);
    spot.target.position.set(0, 0.1, 55);
    this.group.add(spot, spot.target);

    // Lime underglow, soft radial falloff instead of a flat quad.
    const glowCanvas = document.createElement('canvas');
    glowCanvas.width = 128;
    glowCanvas.height = 128;
    const glowCtx = glowCanvas.getContext('2d');
    const gradient = glowCtx.createRadialGradient(64, 64, 6, 64, 64, 62);
    gradient.addColorStop(0, 'rgba(199,255,0,0.85)');
    gradient.addColorStop(0.45, 'rgba(199,255,0,0.22)');
    gradient.addColorStop(1, 'rgba(199,255,0,0)');
    glowCtx.fillStyle = gradient;
    glowCtx.fillRect(0, 0, 128, 128);
    const glowTexture = new THREE.CanvasTexture(glowCanvas);
    glowTexture.colorSpace = THREE.SRGBColorSpace;

    const glowGeometry = new THREE.PlaneGeometry(4.6, 7);
    glowGeometry.rotateX(-Math.PI / 2);
    const glow = new THREE.Mesh(
      glowGeometry,
      new THREE.MeshBasicMaterial({
        map: glowTexture,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    glow.position.y = 0.04;
    this.group.add(glow);
  }

  // A boxy cargo van: taller body, slower steering, no spoiler.
  buildVan() {
    const bodyMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x27313d,
      metalness: 0.4,
      roughness: 0.42,
      clearcoat: 0.55,
      clearcoatRoughness: 0.3,
      envMapIntensity: 1.15,
    });
    const trimMaterial = new THREE.MeshStandardMaterial({ color: 0x0a0d12, metalness: 0.5, roughness: 0.5 });
    const glassMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x0a1620,
      metalness: 0.2,
      roughness: 0.06,
      clearcoat: 1,
      clearcoatRoughness: 0.04,
      envMapIntensity: 1.7,
      transparent: true,
      opacity: 0.6,
    });
    const headMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff0c4, emissiveIntensity: 3.2 });
    this.tailMaterial = new THREE.MeshStandardMaterial({ color: 0x3a0a12, emissive: 0xff3048, emissiveIntensity: 1.5 });
    const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x090a0d, roughness: 0.92 });
    const rimMaterial = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      emissive: 0xffd700,
      emissiveIntensity: 0.5,
      metalness: 0.5,
      roughness: 0.4,
    });

    const add = (geometry, material, x, y, z) => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      this.group.add(mesh);
      return mesh;
    };

    add(new THREE.BoxGeometry(2.34, 1.9, 3.4), bodyMaterial, 0, 1.35, -0.9);
    add(new THREE.BoxGeometry(2.3, 0.6, 5.6), trimMaterial, 0, 0.55, 0);
    add(new THREE.BoxGeometry(2.2, 1.15, 1.9), bodyMaterial, 0, 1.1, 1.85);
    add(new THREE.BoxGeometry(2.02, 0.72, 0.1), glassMaterial, 0, 1.42, 2.8);
    add(new THREE.BoxGeometry(2.3, 0.18, 0.3), trimMaterial, 0, 0.42, 2.86);
    add(new THREE.BoxGeometry(2.34, 1.0, 0.08), bodyMaterial, 0, 1.35, -2.62);
    for (const side of [-1, 1]) {
      add(new THREE.BoxGeometry(0.07, 0.16, 4.6), rimMaterial, side * 1.18, 0.9, -0.4);
      add(new THREE.BoxGeometry(0.4, 0.13, 0.06), headMaterial, side * 0.66, 0.85, 2.82);
    }
    add(new THREE.BoxGeometry(1.9, 0.12, 0.06), this.tailMaterial, 0, 0.95, -2.66);

    const wheelGeometry = new THREE.CylinderGeometry(0.42, 0.42, 0.32, 14);
    wheelGeometry.rotateZ(Math.PI / 2);
    const hubGeometry = new THREE.CylinderGeometry(0.18, 0.18, 0.34, 10);
    hubGeometry.rotateZ(Math.PI / 2);
    const wheelPositions = [
      [-1.02, 0.42, 1.75],
      [1.02, 0.42, 1.75],
      [-1.02, 0.42, -1.7],
      [1.02, 0.42, -1.7],
    ];
    wheelPositions.forEach(([x, y, z], index) => {
      const pivot = new THREE.Group();
      pivot.position.set(x, y, z);
      const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
      const hub = new THREE.Mesh(hubGeometry, rimMaterial);
      wheel.add(hub);
      pivot.add(wheel);
      this.group.add(pivot);
      this.wheels.push(wheel);
      if (index < 2) this.frontPivots.push(pivot);
    });

    const spot = new THREE.SpotLight(0xfff2d6, 700, 80, 0.55, 0.6, 2);
    spot.position.set(0, 0.95, 2.8);
    spot.target.position.set(0, 0.1, 50);
    this.group.add(spot, spot.target);
  }

  reset(x, z, heading) {
    this.pos.set(x, 0, z);
    this.heading = heading;
    this.speed = 0;
    this.steer = 0;
    this.spin = 0;
    this.group.position.set(x, 0, z);
    this.group.rotation.y = heading;
  }

  update(dt, input) {
    const maxSpeed = this.maxSpeed;
    this.impact = false;

    if (input.throttle) {
      const accel = this.accel * (1 - (Math.min(this.speed, maxSpeed) / maxSpeed) * 0.75);
      this.speed += accel * dt;
    }
    if (input.brake) {
      this.speed -= (this.speed > 0.6 ? this.brakePower : 7) * dt;
    }
    if (!input.throttle && !input.brake) {
      this.speed -= this.speed * 0.85 * dt;
    }
    this.speed -= this.speed * 0.16 * dt;
    this.speed = THREE.MathUtils.clamp(this.speed, -9, maxSpeed);
    if (Math.abs(this.speed) < 0.06) this.speed = 0;

    const steerTarget = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    this.steer += (steerTarget - this.steer) * Math.min(1, dt * 7);
    const grip = Math.min(1, Math.abs(this.speed) / 7);
    this.heading += this.steer * this.steerRate * grip * dt * Math.sign(this.speed || 1);

    const forward = this.forward;
    const dx = forward.x * this.speed * dt;
    const dz = forward.z * this.speed * dt;

    if (this.canOccupy(this.pos.x + dx, this.pos.z)) {
      this.pos.x += dx;
    } else {
      this.impact = true;
      this.impactSpeed = Math.abs(this.speed);
      this.speed *= 0.28;
    }
    if (this.canOccupy(this.pos.x, this.pos.z + dz)) {
      this.pos.z += dz;
    } else {
      this.impact = true;
      this.impactSpeed = Math.abs(this.speed);
      this.speed *= 0.28;
    }

    this.group.position.set(this.pos.x, 0, this.pos.z);
    this.group.rotation.y = this.heading;

    this.spin += (this.speed * dt) / 0.38;
    for (const wheel of this.wheels) wheel.rotation.x = this.spin;
    for (const pivot of this.frontPivots) pivot.rotation.y = this.steer * 0.42;

    this.tailMaterial.emissiveIntensity = input.brake ? 4.6 : 1.5;
  }
}
