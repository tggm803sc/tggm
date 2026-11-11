import * as THREE from 'three';

// The room sits far outside the city so it never collides with the street grid.
export const INTERIOR_ORIGIN = { x: 2000, z: 0 };

function makeSignTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 512, 128);
  ctx.font = 'bold 64px ui-sans-serif, system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#c7ff00';
  const label = 'STUDIO 808';
  const widths = Array.from(label).map((letter) => ctx.measureText(letter).width + 6);
  let x = (512 - widths.reduce((sum, w) => sum + w, 0)) / 2;
  Array.from(label).forEach((letter, index) => {
    ctx.fillText(letter, x, 68);
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
    this.build();
  }

  build() {
    const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x161c25, roughness: 0.88 });
    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x0d1219, roughness: 0.92 });
    const trimMaterial = new THREE.MeshStandardMaterial({
      color: 0x1f2833,
      roughness: 0.55,
      metalness: 0.35,
    });

    const floor = new THREE.Mesh(new THREE.BoxGeometry(26, 0.4, 18), floorMaterial);
    floor.position.y = -0.2;
    this.group.add(floor);

    const rug = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 8),
      new THREE.MeshStandardMaterial({ color: 0x241014, roughness: 0.95 }),
    );
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(0, 0.03, 0);
    this.group.add(rug);

    const backWall = new THREE.Mesh(new THREE.BoxGeometry(26, 7, 0.4), wallMaterial);
    backWall.position.set(0, 3.5, -9);
    const frontWall = backWall.clone();
    frontWall.position.z = 9;
    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.4, 7, 18), wallMaterial);
    leftWall.position.set(-13, 3.5, 0);
    const rightWall = leftWall.clone();
    rightWall.position.x = 13;
    this.group.add(backWall, frontWall, leftWall, rightWall);

    const ceiling = new THREE.Mesh(
      new THREE.BoxGeometry(26, 0.3, 18),
      new THREE.MeshStandardMaterial({ color: 0x0a0e13, roughness: 1 }),
    );
    ceiling.position.y = 7;
    this.group.add(ceiling);

    // Mixing desk with lit screens.
    const desk = new THREE.Mesh(new THREE.BoxGeometry(7, 0.9, 1.8), trimMaterial);
    desk.position.set(0, 0.85, -6.4);
    this.group.add(desk);

    const screenColors = [0xc7ff00, 0xffd700, 0xff3048];
    screenColors.forEach((hex, index) => {
      const screen = new THREE.Mesh(
        new THREE.PlaneGeometry(1.6, 0.9),
        new THREE.MeshBasicMaterial({ color: hex, toneMapped: false }),
      );
      screen.position.set(-2 + index * 2, 1.75, -6.2);
      screen.rotation.x = -0.18;
      this.group.add(screen);
    });

    // Speaker stacks either side of the desk.
    for (const side of [-1, 1]) {
      const stack = new THREE.Mesh(new THREE.BoxGeometry(1.3, 3.4, 1.3), trimMaterial);
      stack.position.set(side * 7.5, 1.7, -7.6);
      this.group.add(stack);
      const cap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.32, 0.32, 0.16, 14),
        new THREE.MeshBasicMaterial({ color: 0x0a0d12 }),
      );
      cap.rotation.x = Math.PI / 2;
      cap.position.set(side * 7.5, 2.4, -6.9);
      this.group.add(cap);
    }

    // Control-room glass looking into the live room.
    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(9, 2.6, 0.12),
      new THREE.MeshStandardMaterial({
        color: 0x9fd2ff,
        transparent: true,
        opacity: 0.22,
        metalness: 0.4,
        roughness: 0.1,
      }),
    );
    glass.position.set(-3.5, 3.4, -8.7);
    this.group.add(glass);

    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(9, 2.2),
      new THREE.MeshBasicMaterial({
        map: makeSignTexture(),
        transparent: true,
        toneMapped: false,
      }),
    );
    sign.position.set(6, 5.2, -8.7);
    this.group.add(sign);

    const light = new THREE.PointLight(0xc7ff00, 26, 26, 2);
    light.position.set(0, 5.4, -3);
    this.group.add(light);

    // Door marker on the rug so the exit reads as a door.
    const doorMat = new THREE.MeshBasicMaterial({
      color: 0xc7ff00,
      transparent: true,
      opacity: 0.32,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    const door = new THREE.Mesh(new THREE.RingGeometry(1.6, 2.3, 24), doorMat);
    door.rotation.x = -Math.PI / 2;
    door.position.set(0, 0.05, 5.6);
    this.group.add(door);
  }

  enter() {
    this.group.visible = true;
  }

  exit() {
    this.group.visible = false;
  }
}
