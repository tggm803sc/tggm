import * as THREE from 'three';

// The room sits far outside the city so it never collides with the street grid.
export const INTERIOR_ORIGIN = { x: 2000, z: 0 };
export const INTERIOR_BOUNDS = { x: 16, z: 11 };

export const STUDIO_POINTS = {
  mic: { x: INTERIOR_ORIGIN.x - 9, z: -8 },
  desk: { x: INTERIOR_ORIGIN.x + 4, z: 2 },
  door: { x: INTERIOR_ORIGIN.x + 8, z: 9 },
};

function makeSignTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 512, 128);
  ctx.font = 'bold 62px ui-sans-serif, system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#c7ff00';
  const label = 'STUDIO 808';
  const widths = Array.from(label).map((letter) => ctx.measureText(letter).width + 6);
  let x = (512 - widths.reduce((sum, w) => sum + w, 0)) / 2;
  Array.from(label).forEach((letter, index) => {
    ctx.fillText(letter, x, 66);
    x += widths[index];
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export class StudioInterior {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'studio-interior';
    this.group.position.set(INTERIOR_ORIGIN.x, 0, INTERIOR_ORIGIN.z);
    this.group.visible = false;
    this.screens = [];
    this.build();
  }

  build() {
    const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x151b24, roughness: 0.86 });
    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x0c1118, roughness: 0.94 });
    const trimMaterial = new THREE.MeshStandardMaterial({
      color: 0x202a36,
      roughness: 0.5,
      metalness: 0.4,
    });
    const darkMaterial = new THREE.MeshStandardMaterial({ color: 0x090c11, roughness: 0.9 });

    const floor = new THREE.Mesh(new THREE.BoxGeometry(34, 0.4, 24), floorMaterial);
    floor.position.y = -0.2;
    this.group.add(floor);

    const rug = new THREE.Mesh(
      new THREE.PlaneGeometry(14, 9),
      new THREE.MeshStandardMaterial({ color: 0x231015, roughness: 0.95 }),
    );
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(3, 0.03, 3);
    this.group.add(rug);

    // Shell: back, front, sides, ceiling.
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(34, 8, 0.4), wallMaterial);
    backWall.position.set(0, 4, -12);
    const frontWall = new THREE.Mesh(new THREE.BoxGeometry(34, 8, 0.4), wallMaterial);
    frontWall.position.set(0, 4, 12);
    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.4, 8, 24), wallMaterial);
    leftWall.position.set(-17, 4, 0);
    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.4, 8, 24), wallMaterial);
    rightWall.position.set(17, 4, 0);
    const ceiling = new THREE.Mesh(
      new THREE.BoxGeometry(34, 0.3, 24),
      new THREE.MeshStandardMaterial({ color: 0x080b0f, roughness: 1 }),
    );
    ceiling.position.y = 8;
    this.group.add(backWall, frontWall, leftWall, rightWall, ceiling);

    // --- Recording booth, glass front with a doorway gap -------------------
    const boothFloor = new THREE.Mesh(
      new THREE.BoxGeometry(12, 0.18, 7.5),
      new THREE.MeshStandardMaterial({ color: 0x101720, roughness: 0.95 }),
    );
    boothFloor.position.set(-8, 0.09, -7.75);
    this.group.add(boothFloor);

    const glassMaterial = new THREE.MeshStandardMaterial({
      color: 0x9fd2ff,
      transparent: true,
      opacity: 0.2,
      metalness: 0.5,
      roughness: 0.08,
    });
    const glassFront = new THREE.Mesh(new THREE.BoxGeometry(8.5, 3.1, 0.1), glassMaterial);
    glassFront.position.set(-11, 1.6, -4);
    const glassSide = new THREE.Mesh(new THREE.BoxGeometry(0.1, 3.1, 7.4), glassMaterial);
    glassSide.position.set(-2.1, 1.6, -7.7);
    this.group.add(glassFront, glassSide);

    for (const x of [-15.2, -11, -6.8, -2.3]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 3.2, 0.16), trimMaterial);
      post.position.set(x, 1.6, -4);
      this.group.add(post);
    }
    const boothHeader = new THREE.Mesh(new THREE.BoxGeometry(13, 0.4, 0.4), trimMaterial);
    boothHeader.position.set(-8.5, 3.3, -4);
    this.group.add(boothHeader);

    // Acoustic foam: alternating wedges across the booth back wall.
    for (let i = 0; i < 9; i += 1) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.15, 0.16), darkMaterial);
      panel.position.set(-13.6 + i * 1.3, 1.2 + (i % 2) * 1.3, -11.7);
      this.group.add(panel);
    }
    for (let i = 0; i < 4; i += 1) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.2, 1.2), darkMaterial);
      panel.position.set(-16.7, 1.4 + (i % 2) * 1.4, -10.5 + i * 1.5);
      this.group.add(panel);
    }

    // Mic on a boom, with pop filter and headphones on a hook.
    const micStand = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 1.5, 8), trimMaterial);
    micStand.position.set(STUDIO_POINTS.mic.x - INTERIOR_ORIGIN.x, 0.75, STUDIO_POINTS.mic.z);
    this.group.add(micStand);
    const boomArm = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.06, 0.06), trimMaterial);
    boomArm.position.set(STUDIO_POINTS.mic.x - INTERIOR_ORIGIN.x + 0.5, 1.5, STUDIO_POINTS.mic.z);
    this.group.add(boomArm);
    const micBody = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.11, 0.26, 4, 10),
      new THREE.MeshStandardMaterial({ color: 0x2b3442, roughness: 0.4, metalness: 0.6 }),
    );
    micBody.position.set(STUDIO_POINTS.mic.x - INTERIOR_ORIGIN.x + 1, 1.32, STUDIO_POINTS.mic.z);
    this.group.add(micBody);
    const popFilter = new THREE.Mesh(
      new THREE.RingGeometry(0.16, 0.24, 20),
      new THREE.MeshStandardMaterial({ color: 0x0d1117, roughness: 1 }),
    );
    popFilter.position.set(STUDIO_POINTS.mic.x - INTERIOR_ORIGIN.x + 1, 1.32, STUDIO_POINTS.mic.z + 0.35);
    this.group.add(popFilter);

    this.micLight = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xff3048, toneMapped: false }),
    );
    this.micLight.position.set(
      STUDIO_POINTS.mic.x - INTERIOR_ORIGIN.x + 1,
      1.32,
      STUDIO_POINTS.mic.z - 0.22,
    );
    this.group.add(this.micLight);

    // --- Control room: desk, monitors, speakers, lounge --------------------
    const desk = new THREE.Mesh(new THREE.BoxGeometry(10, 0.95, 2.2), trimMaterial);
    desk.position.set(4, 0.9, 0);
    this.group.add(desk);

    const screenColors = [0xc7ff00, 0xffd700, 0xff3048];
    screenColors.forEach((hex, index) => {
      const screen = new THREE.Mesh(
        new THREE.PlaneGeometry(2, 1.2),
        new THREE.MeshBasicMaterial({ color: hex, toneMapped: false }),
      );
      screen.position.set(0.5 + index * 3.2, 2.1, 0.05);
      screen.rotation.x = -0.16;
      this.group.add(screen);
      this.screens.push(screen);
    });

    // Fader bank and meters on the desk edge.
    for (let i = 0; i < 8; i += 1) {
      const fader = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.5), darkMaterial);
      fader.position.set(0.6 + i * 1.1, 1.42, 0.7);
      this.group.add(fader);
    }

    const speakerGeometry = new THREE.BoxGeometry(1.5, 4, 1.5);
    for (const [x, z] of [
      [11.5, -4],
      [11.5, 4],
    ]) {
      const stack = new THREE.Mesh(speakerGeometry, trimMaterial);
      stack.position.set(x, 2, z);
      this.group.add(stack);
      for (const offset of [-0.6, 0.5]) {
        const cone = new THREE.Mesh(
          new THREE.CylinderGeometry(0.36, 0.36, 0.14, 16),
          new THREE.MeshStandardMaterial({ color: 0x0a0d12, roughness: 0.85 }),
        );
        cone.rotation.x = Math.PI / 2;
        cone.position.set(x, 2.2 + offset, z < 0 ? z + 0.78 : z - 0.78);
        this.group.add(cone);
      }
    }

    const sofaBase = new THREE.Mesh(new THREE.BoxGeometry(5, 0.6, 2), darkMaterial);
    sofaBase.position.set(12, 0.4, 8);
    const sofaBack = new THREE.Mesh(new THREE.BoxGeometry(5, 1.1, 0.4), darkMaterial);
    sofaBack.position.set(12, 1.1, 8.9);
    this.group.add(sofaBase, sofaBack);

    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(9, 2.2),
      new THREE.MeshBasicMaterial({ map: makeSignTexture(), transparent: true, toneMapped: false }),
    );
    sign.position.set(6, 5.6, -11.7);
    this.group.add(sign);

    // Ceiling LED runs.
    for (const x of [-10, 0, 10]) {
      const strip = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 0.08, 18),
        new THREE.MeshBasicMaterial({ color: x === 0 ? 0x7bff9e : 0x1c2a38, toneMapped: false }),
      );
      strip.position.set(x, 7.85, 0);
      this.group.add(strip);
    }

    const warmLight = new THREE.PointLight(0xffd9a8, 22, 30, 2);
    warmLight.position.set(4, 6, 2);
    const limeLight = new THREE.PointLight(0xc7ff00, 18, 20, 2);
    limeLight.position.set(-8, 3.6, -7);
    this.group.add(warmLight, limeLight);

    // Door marker on the floor.
    const doorRing = new THREE.Mesh(
      new THREE.RingGeometry(1.5, 2.2, 24),
      new THREE.MeshBasicMaterial({
        color: 0xc7ff00,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    );
    doorRing.rotation.x = -Math.PI / 2;
    doorRing.position.set(STUDIO_POINTS.door.x - INTERIOR_ORIGIN.x, 0.06, STUDIO_POINTS.door.z);
    this.group.add(doorRing);
  }

  // Animate the desk screens with the session beat.
  pulse(intensity, accent) {
    this.screens.forEach((screen, index) => {
      const base = [0xc7ff00, 0xffd700, 0xff3048][index];
      const color = new THREE.Color(base);
      color.multiplyScalar(0.5 + intensity * 0.9 + (accent === index ? 0.6 : 0));
      screen.material.color.copy(color);
    });
    this.micLight.material.color.setHex(accent === 2 ? 0xff3048 : 0xff3048);
  }

  enter() {
    this.group.visible = true;
  }

  exit() {
    this.group.visible = false;
  }
}
