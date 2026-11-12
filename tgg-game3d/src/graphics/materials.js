import * as THREE from 'three';

// Procedural PBR material library.
//
// The renderer has no texture assets, so surface detail has to come from canvas.
// What matters for realism is not a bigger colour map: it is the *maps beside it* —
// a normal map so light catches edges, a roughness map so reflections break up, and
// an AO map so joints darken. Those are generated here from a height field.

const registry = new Set();

function createCanvas(width, height = width) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function track(texture) {
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  registry.add(texture);
  return texture;
}

// Sobel over luminance: a height field becomes tangent-space normals. Flat areas
// come out neutral (128,128,255), which is exactly what a missing normal map means.
export function normalMapFromCanvas(source, { strength = 2.2, wrap = true } = {}) {
  const width = source.width;
  const height = source.height;
  const context = source.getContext('2d');
  const { data } = context.getImageData(0, 0, width, height);
  const output = createCanvas(width, height);
  const outCtx = output.getContext('2d');
  const image = outCtx.createImageData(width, height);

  const lum = (x, y) => {
    const index = (y * width + x) * 4;
    return (data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114) / 255;
  };
  const sample = (x, y) => lum((x + width) % width, (y + height) % height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const dx =
        sample(x - 1, y - 1) + 2 * sample(x - 1, y) + sample(x - 1, y + 1) -
        (sample(x + 1, y - 1) + 2 * sample(x + 1, y) + sample(x + 1, y + 1));
      const dy =
        sample(x - 1, y - 1) + 2 * sample(x, y - 1) + sample(x + 1, y - 1) -
        (sample(x - 1, y + 1) + 2 * sample(x, y + 1) + sample(x + 1, y + 1));
      // Sobel sums are eight times a normalised gradient; without dividing them
      // out, fine speckle (concrete grain) produces near-horizontal normals and the
      // whole surface renders black. This is the difference between "stone" and
      // "soot".
      const nx = -(dx / 8) * strength;
      const ny = -(dy / 8) * strength;
      const length = Math.hypot(nx, ny, 1);
      const index = (y * width + x) * 4;
      image.data[index] = Math.round(((nx / length) * 0.5 + 0.5) * 255);
      image.data[index + 1] = Math.round(((ny / length) * 0.5 + 0.5) * 255);
      image.data[index + 2] = Math.round(((1 / length) * 0.5 + 0.5) * 255);
      image.data[index + 3] = 255;
    }
  }
  outCtx.putImageData(image, 0, 0);

  const texture = new THREE.CanvasTexture(output);
  if (wrap) track(texture);
  texture.colorSpace = THREE.NoColorSpace;
  return texture;
}

// --- Height fields ---------------------------------------------------------

function paverHeight({ tiles = 8, size = 512, grout = 4 } = {}) {
  const canvas = createCanvas(size);
  const context = canvas.getContext('2d');
  context.fillStyle = '#3a3a3a';
  context.fillRect(0, 0, size, size);
  const cell = size / tiles;
  for (let y = 0; y < tiles; y += 1) {
    for (let x = 0; x < tiles; x += 1) {
      const shade = 190 + Math.round(Math.random() * 40);
      context.fillStyle = `rgb(${shade},${shade},${shade})`;
      context.fillRect(x * cell + grout / 2, y * cell + grout / 2, cell - grout, cell - grout);
    }
  }
  return canvas;
}

function paverColor({ tiles = 8, size = 512, grout = 4, base = [92, 96, 104] } = {}) {
  const canvas = createCanvas(size);
  const context = canvas.getContext('2d');
  context.fillStyle = '#23262c';
  context.fillRect(0, 0, size, size);
  const cell = size / tiles;
  for (let y = 0; y < tiles; y += 1) {
    for (let x = 0; x < tiles; x += 1) {
      const variance = (Math.random() - 0.5) * 26;
      const [r, g, b] = base.map((channel) => Math.max(0, Math.min(255, channel + variance)));
      context.fillStyle = `rgb(${r},${g},${b})`;
      context.fillRect(x * cell + grout / 2, y * cell + grout / 2, cell - grout, cell - grout);
      // Wear: a few darker speckles per tile stops the grid reading as a texture tile.
      for (let i = 0; i < 8; i += 1) {
        context.fillStyle = `rgba(0,0,0,${0.02 + Math.random() * 0.05})`;
        context.fillRect(
          x * cell + grout + Math.random() * (cell - grout * 2),
          y * cell + grout + Math.random() * (cell - grout * 2),
          2 + Math.random() * 8,
          2 + Math.random() * 8,
        );
      }
    }
  }
  return canvas;
}

function concreteColor({ size = 512, base = [148, 146, 140] } = {}) {
  const canvas = createCanvas(size);
  const context = canvas.getContext('2d');
  context.fillStyle = `rgb(${base.join(',')})`;
  context.fillRect(0, 0, size, size);
  for (let i = 0; i < 5200; i += 1) {
    const tone = Math.random() > 0.5 ? 255 : 0;
    context.fillStyle = `rgba(${tone},${tone},${tone},${0.02 + Math.random() * 0.05})`;
    context.fillRect(Math.random() * size, Math.random() * size, 1 + Math.random() * 3, 1 + Math.random() * 3);
  }
  // Form-work lines and a damp streak at the bottom.
  context.strokeStyle = 'rgba(0,0,0,0.12)';
  context.lineWidth = 2;
  for (let y = 0; y < size; y += 128) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(size, y);
    context.stroke();
  }
  const damp = context.createLinearGradient(0, size * 0.7, 0, size);
  damp.addColorStop(0, 'rgba(0,0,0,0)');
  damp.addColorStop(1, 'rgba(0,0,0,0.16)');
  context.fillStyle = damp;
  context.fillRect(0, size * 0.7, size, size * 0.3);
  return canvas;
}

function asphaltPatchColor({ size = 256 } = {}) {
  const canvas = createCanvas(size);
  const context = canvas.getContext('2d');
  context.fillStyle = '#191c20';
  context.fillRect(0, 0, size, size);
  for (let i = 0; i < 4200; i += 1) {
    const tone = 40 + Math.round(Math.random() * 60);
    context.fillStyle = `rgba(${tone},${tone + 2},${tone + 5},${0.25 + Math.random() * 0.5})`;
    context.fillRect(Math.random() * size, Math.random() * size, 1 + Math.random() * 2.4, 1 + Math.random() * 2.4);
  }
  // A hairline crack, so a repair patch reads as used road.
  context.strokeStyle = 'rgba(0,0,0,0.55)';
  context.lineWidth = 1.6;
  context.beginPath();
  let x = Math.random() * size;
  let y = 0;
  context.moveTo(x, y);
  while (y < size) {
    x += (Math.random() - 0.5) * 16;
    y += 12 + Math.random() * 18;
    context.lineTo(x, y);
  }
  context.stroke();
  return canvas;
}

function roughnessFromCanvas(source, { min = 0.35, max = 0.95 } = {}) {
  const size = source.width;
  const context = source.getContext('2d');
  const { data } = context.getImageData(0, 0, size, size);
  const canvas = createCanvas(size);
  const outCtx = canvas.getContext('2d');
  const image = outCtx.createImageData(size, size);
  for (let i = 0; i < data.length; i += 4) {
    const luminance = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255;
    // Brighter (raised) areas polish faster, so they are smoother than the grout.
    const value = Math.round((min + (1 - luminance) * (max - min)) * 255);
    image.data[i] = value;
    image.data[i + 1] = value;
    image.data[i + 2] = value;
    image.data[i + 3] = 255;
  }
  outCtx.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.NoColorSpace;
  track(texture);
  return texture;
}

// --- Material factory ------------------------------------------------------

function colorTexture(canvas, { repeat = 1, srgb = true } = {}) {
  const texture = new THREE.CanvasTexture(canvas);
  if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
  texture.repeat.set(repeat, repeat);
  track(texture);
  return texture;
}

export function makePaverMaterial({ repeat = 6, tiles = 8 } = {}) {
  const height = paverHeight({ tiles });
  const color = paverColor({ tiles });
  const material = new THREE.MeshStandardMaterial({
    map: colorTexture(color, { repeat }),
    normalMap: normalMapFromCanvas(height, { strength: 1.1 }),
    roughnessMap: roughnessFromCanvas(height),
    // The grout is genuinely lower than the slabs, so the height field doubles as
    // an occlusion map. It needs a second UV set on the mesh (`uv1`).
    aoMap: colorTexture(height, { repeat, srgb: false }),
    aoMapIntensity: 0.75,
    roughness: 1,
    metalness: 0.04,
    envMapIntensity: 0.55,
  });
  material.normalScale.set(0.85, 0.85);
  material.userData.maps = ['map', 'normalMap', 'roughnessMap', 'aoMap'];
  return material;
}

export function makeConcreteMaterial({ repeat = 2, base } = {}) {
  const height = concreteColor({ base });
  const material = new THREE.MeshStandardMaterial({
    map: colorTexture(height, { repeat }),
    normalMap: normalMapFromCanvas(height, { strength: 0.55 }),
    roughness: 0.9,
    metalness: 0.02,
    envMapIntensity: 0.5,
  });
  material.normalScale.set(0.6, 0.6);
  return material;
}

export function makeAsphaltPatchMaterial({ repeat = 1 } = {}) {
  const color = asphaltPatchColor();
  return new THREE.MeshStandardMaterial({
    map: colorTexture(color, { repeat }),
    normalMap: normalMapFromCanvas(color, { strength: 1.8 }),
    roughness: 0.82,
    metalness: 0.06,
    envMapIntensity: 0.5,
    transparent: true,
    opacity: 0.96,
  });
}

export function makePaintMaterial(color, { clearcoat = 0.9 } = {}) {
  return new THREE.MeshPhysicalMaterial({
    color,
    metalness: 0.5,
    roughness: 0.28,
    clearcoat,
    clearcoatRoughness: 0.12,
    envMapIntensity: 1.35,
  });
}

export function makeGlassMaterial({ tint = 0x0a1620, opacity = 0.62 } = {}) {
  return new THREE.MeshPhysicalMaterial({
    color: tint,
    metalness: 0.25,
    roughness: 0.05,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
    envMapIntensity: 1.8,
    transparent: opacity < 1,
    opacity,
  });
}

export function makeMetalTrimMaterial({ color = 0x14181d } = {}) {
  return new THREE.MeshStandardMaterial({ color, metalness: 0.75, roughness: 0.35, envMapIntensity: 1.1 });
}

// Applies the anisotropy the quality profile allows to every texture created here.
export function setAnisotropy(limit) {
  for (const texture of registry) {
    texture.anisotropy = Math.min(texture.anisotropy || 1, limit);
    texture.needsUpdate = true;
  }
}

export function textureCount() {
  return registry.size;
}

export function disposeMaterials() {
  for (const texture of registry) texture.dispose();
  registry.clear();
}
