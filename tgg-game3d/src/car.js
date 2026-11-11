import * as THREE from 'three';

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
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0xb0122a,
      metalness: 0.72,
      roughness: 0.3,
    });
    const trimMaterial = new THREE.MeshStandardMaterial({
      color: 0x0a0d12,
      metalness: 0.55,
      roughness: 0.45,
    });
    const glassMaterial = new THREE.MeshStandardMaterial({
      color: 0x0a1620,
      metalness: 0.9,
      roughness: 0.12,
      transparent: true,
      opacity: 0.88,
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
    const wheelMaterial = new THREE.MeshStandardMaterial({
      color: 0x090a0d,
      roughness: 0.92,
    });
    const rimMaterial = new THREE.MeshStandardMaterial({
      color: 0xc7ff00,
      emissive: 0xc7ff00,
      emissiveIntensity: 0.7,
      metalness: 0.6,
      roughness: 0.3,
    });

    const add = (geometry, material, x, y, z) => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, y, z);
      this.group.add(mesh);
      return mesh;
    };

    add(new THREE.BoxGeometry(1.96, 0.5, 4.3), bodyMaterial, 0, 0.6, 0);
    add(new THREE.BoxGeometry(1.82, 0.22, 1.5), bodyMaterial, 0, 0.9, 1.3);
    add(new THREE.BoxGeometry(1.62, 0.5, 1.72), glassMaterial, 0, 1.06, -0.24);
    add(new THREE.BoxGeometry(1.52, 0.1, 1.42), bodyMaterial, 0, 1.33, -0.3);
    add(new THREE.BoxGeometry(1.9, 0.32, 0.42), trimMaterial, 0, 0.44, 2.1);
    add(new THREE.BoxGeometry(1.9, 0.34, 0.34), trimMaterial, 0, 0.46, -2.1);
    add(new THREE.BoxGeometry(1.72, 0.14, 0.5), trimMaterial, 0, 1.12, -1.9);

    // Lime side blades and spoiler.
    for (const side of [-1, 1]) {
      add(new THREE.BoxGeometry(0.06, 0.08, 3.1), rimMaterial, side * 0.99, 0.42, 0);
    }
    add(new THREE.BoxGeometry(1.6, 0.07, 0.34), trimMaterial, 0, 1.3, -2.02);

    // Lights.
    for (const side of [-1, 1]) {
      add(new THREE.BoxGeometry(0.44, 0.13, 0.06), headMaterial, side * 0.6, 0.72, 2.16);
    }
    add(new THREE.BoxGeometry(1.62, 0.1, 0.06), this.tailMaterial, 0, 0.74, -2.16);

    // Wheels: axis baked along X, so rotation.x spins the tread.
    const wheelGeometry = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 16);
    wheelGeometry.rotateZ(Math.PI / 2);
    const hubGeometry = new THREE.CylinderGeometry(0.17, 0.17, 0.32, 10);
    hubGeometry.rotateZ(Math.PI / 2);

    const wheelPositions = [
      [-0.94, 0.38, 1.38],
      [0.94, 0.38, 1.38],
      [-0.94, 0.38, -1.4],
      [0.94, 0.38, -1.4],
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
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x27313d, metalness: 0.55, roughness: 0.42 });
    const trimMaterial = new THREE.MeshStandardMaterial({ color: 0x0a0d12, metalness: 0.5, roughness: 0.5 });
    const glassMaterial = new THREE.MeshStandardMaterial({
      color: 0x0a1620,
      metalness: 0.9,
      roughness: 0.14,
      transparent: true,
      opacity: 0.86,
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
