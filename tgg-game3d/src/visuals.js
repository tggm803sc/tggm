import * as THREE from 'three';

// A procedural environment map, generated from the clock's own sky palette.
//
// This is the single biggest realism gap in the browser build: `MeshStandardMaterial`
// with metalness and no `scene.environment` has nothing to reflect, so car paint,
// glass and metal read as flat plastic no matter how the lights are tuned. The map is
// rebuilt only when the sky changes meaningfully, so it costs almost nothing.
export function createEnvironment(renderer, look, size = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size / 2;
  const ctx = canvas.getContext('2d');

  const sky = new THREE.Color(look.sky);
  const fog = new THREE.Color(look.fog);
  const zenith = sky.clone().lerp(new THREE.Color(0xffffff), 0.24);
  const gradient = ctx.createLinearGradient(0, 0, 0, 256);
  gradient.addColorStop(0, `#${zenith.getHexString()}`);
  gradient.addColorStop(0.52, `#${sky.getHexString()}`);
  gradient.addColorStop(0.58, `#${fog.getHexString()}`);
  gradient.addColorStop(1, '#04060a');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 512, 256);

  // City glow along the horizon, so low-angle reflections pick up street light
  // instead of a dead grey band. Scaled by the same "lights on" factor the HUD uses.
  const glowStrength = 0.16 * (look.lights ?? 0);
  const half = size / 2;
  if (glowStrength > 0.002) {
    const haze = ctx.createLinearGradient(0, half * 0.42, 0, half * 0.77);
    haze.addColorStop(0, 'rgba(255,150,90,0)');
    haze.addColorStop(0.6, `rgba(255,150,90,${glowStrength})`);
    haze.addColorStop(1, 'rgba(255,120,70,0)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, half * 0.42, size, half * 0.35);
  }

  // A soft source where the sun or moon sits, so specular highlights have somewhere
  // to come from rather than a uniform dome.
  const sun = look.sunIntensity > look.moonIntensity;
  const u = Math.min(1, Math.max(0, (look.sunX ?? 0) / 220 * 0.5 + 0.5));
  const v = 0.5 - Math.min(1, Math.max(0, (look.sunY ?? 0) / 240)) * 0.4;
  const blob = ctx.createRadialGradient(size * u, size * v, 2, size * u, size * v, size * 0.15);
  blob.addColorStop(0, sun ? 'rgba(255,244,214,0.95)' : 'rgba(198,218,255,0.78)');
  blob.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = blob;
  ctx.fillRect(0, 0, size, half);

  const texture = new THREE.CanvasTexture(canvas);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;

  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromEquirectangular(texture).texture;
  texture.dispose();
  pmrem.dispose();
  return env;
}

// Shadows are split in two on purpose.
//
// Casting from the buildings made every facade shadow itself: the sun is a single
// directional light, so once a wall is in its own shadow map it goes black and the
// whole city loses its daylight. Buildings therefore only *receive*, and the casters
// are the things whose contact shadow actually sells the scene — cars, the player,
// traffic, police and street props.
export function enableShadowReceivers(root) {
  let receivers = 0;
  root.traverse((node) => {
    if (!node.isMesh && !node.isInstancedMesh) return;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    if (!materials.length) return;
    const skip = materials.some(
      (material) => !material || material.transparent === true || material.toneMapped === false,
    );
    if (skip) return;
    node.receiveShadow = true;
    receivers += 1;
  });
  return receivers;
}

export function prepareShadowCasters(roots) {
  let casters = 0;
  for (const root of roots) {
    if (!root) continue;
    root.traverse((node) => {
      if (!node.isMesh && !node.isInstancedMesh) return;
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      if (!materials.length) return;
      const skip = materials.some(
        (material) => !material || material.transparent === true || material.toneMapped === false,
      );
      if (skip) return;
      node.castShadow = true;
      casters += 1;
    });
  }
  return casters;
}

// Shadows are the one feature here that costs a full extra scene pass, so they can be
// switched off without touching anything else.
export function setShadows(renderer, light, enabled, { mapSize = 2048, radius = 80 } = {}) {
  renderer.shadowMap.enabled = enabled;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  if (!light) return;
  light.castShadow = enabled;
  if (!enabled) return;
  setShadowQuality(light, { mapSize, radius });
}

// Shadow resolution and coverage are separate knobs, because they trade against
// each other: the frustum has to stay tight for contact shadows to be visible at
// all, so quality profiles move both together.
//
// A tight frustum around the player: 170 m of coverage at 2048 px was ~6 texels/m
// and blurred every contact shadow into nothing. 80 m is ~13 and still covers the
// whole visible street.
export function setShadowQuality(light, { mapSize = 2048, radius = 80 } = {}) {
  if (!light?.shadow) return;
  if (light.shadow.mapSize.x !== mapSize) {
    // The map keeps its old size until it is thrown away, so a profile change has
    // to release it or the renderer keeps sampling the previous resolution.
    light.shadow.map?.dispose();
    light.shadow.map = null;
    light.shadow.mapSize.set(mapSize, mapSize);
  }
  const camera = light.shadow.camera;
  camera.left = -radius;
  camera.right = radius;
  camera.top = radius;
  camera.bottom = -radius;
  camera.near = 1;
  camera.far = 900;
  camera.updateProjectionMatrix();
  // Tight biases: the earlier 0.55 normal bias ate every small shadow (a person,
  // a crate, a wheel) and left only building-sized blobs.
  light.shadow.bias = -0.0003;
  light.shadow.normalBias = 0.08;
}

// Keep the sun's shadow frustum around the player: the city is 702 m across, and a
// single fixed 340 m frustum would either be enormous or follow nothing.
export function trackShadowFocus(light, position, look) {
  if (!light.castShadow) return;
  light.target.position.set(position.x, 0, position.z);
  const dir = new THREE.Vector3(look.sunX, Math.max(60, look.sunY), look.sunZ).normalize();
  light.position.set(position.x + dir.x * 240, dir.y * 240, position.z + dir.z * 240);
  light.target.updateMatrixWorld();
}
