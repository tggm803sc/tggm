// GLB (glTF Binary) inspection and validation.
//
// The game ships procedural geometry today, so no GLB is loaded at runtime yet.
// This module is what makes the authored-asset path safe to open: a model can be
// checked for structure, cost and unsupported extensions *before* it reaches a
// renderer, in Node, with no WebGL context.
//
// It deliberately parses the container itself instead of trusting a loader: a
// malformed file that reaches three's GLTFLoader fails deep inside a promise, and
// a 40 MB asset fails by freezing the tab.

const MAGIC = 0x46546c67; // 'glTF' little-endian
const VERSION = 2;
const JSON_CHUNK = 0x4e4f534a; // 'JSON'
const BIN_CHUNK = 0x004e4942; // 'BIN\0'

export const GLB_LIMITS = {
  bytes: 8 * 1024 * 1024,
  triangles: 300000,
  materials: 24,
  images: 16,
  drawCalls: 40,
};

// Extensions the runtime can honour, either natively in three.js or because the
// material work here already uses the same features.
const SUPPORTED_EXTENSIONS = new Set([
  'KHR_materials_clearcoat',
  'KHR_materials_ior',
  'KHR_materials_emissive_strength',
  'KHR_materials_unlit',
  'KHR_materials_specular',
  'KHR_materials_sheen',
  'KHR_texture_transform',
  'KHR_mesh_quantization',
  'EXT_texture_webp',
]);

// Compression needs a decoder shipped with the build. Without it the file loads as
// an empty mesh, which is worse than refusing it.
const DECODER_EXTENSIONS = new Set([
  'KHR_draco_mesh_compression',
  'EXT_meshopt_compression',
  'KHR_texture_basisu',
]);

export class GLBError extends Error {
  constructor(message) {
    super(message);
    this.name = 'GLBError';
  }
}

function toBytes(input) {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (ArrayBuffer.isView(input)) return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  throw new GLBError('validateGLB expects an ArrayBuffer or a typed array');
}

// Returns the parsed JSON chunk and binary chunk, or throws with a readable reason.
export function parseGLB(input) {
  const bytes = toBytes(input);
  if (bytes.byteLength < 20) throw new GLBError('file is too small to be a GLB');

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const magic = view.getUint32(0, true);
  if (magic !== MAGIC) throw new GLBError('not a GLB: missing glTF magic');

  const version = view.getUint32(4, true);
  if (version !== VERSION) throw new GLBError(`unsupported glTF container version ${version}`);

  const declared = view.getUint32(8, true);
  if (declared !== bytes.byteLength) {
    throw new GLBError(`header length ${declared} does not match ${bytes.byteLength} bytes`);
  }

  let offset = 12;
  let json = null;
  let bin = null;
  while (offset + 8 <= bytes.byteLength) {
    const chunkLength = view.getUint32(offset, true);
    const chunkType = view.getUint32(offset + 4, true);
    const start = offset + 8;
    const end = start + chunkLength;
    if (end > bytes.byteLength) throw new GLBError('chunk runs past the end of the file');

    if (chunkType === JSON_CHUNK) {
      const text = new TextDecoder().decode(bytes.subarray(start, end)).replace(/\0+$/, '').trim();
      try {
        json = JSON.parse(text);
      } catch (error) {
        throw new GLBError(`JSON chunk is not valid JSON: ${error.message}`);
      }
    } else if (chunkType === BIN_CHUNK) {
      bin = bytes.subarray(start, end);
    }
    // Chunks are padded to 4-byte boundaries.
    offset = end + ((4 - (chunkLength % 4)) % 4);
  }

  if (!json) throw new GLBError('no JSON chunk found');
  return { json, bin, version, bytes: bytes.byteLength };
}

// Triangle count for one mesh primitive, respecting indices and draw mode.
function primitiveTriangles(json, primitive) {
  const mode = primitive.mode ?? 4;
  if (mode !== 4) return 0; // only TRIANGLES is budgeted; strips/fans are rare
  if (primitive.indices != null) {
    const accessor = json.accessors?.[primitive.indices];
    if (!accessor) return 0;
    return Math.floor(accessor.count / 3);
  }
  const position = primitive.attributes?.POSITION;
  if (position == null) return 0;
  const accessor = json.accessors?.[position];
  return accessor ? Math.floor(accessor.count / 3) : 0;
}

export function measureGLB(json) {
  const meshes = json.meshes ?? [];
  let triangles = 0;
  let primitives = 0;
  for (const mesh of meshes) {
    for (const primitive of mesh.primitives ?? []) {
      triangles += primitiveTriangles(json, primitive);
      primitives += 1;
    }
  }
  return {
    meshes: meshes.length,
    primitives,
    triangles,
    nodes: (json.nodes ?? []).length,
    materials: (json.materials ?? []).length,
    images: (json.images ?? []).length,
    textures: (json.textures ?? []).length,
    animations: (json.animations ?? []).length,
    // Each primitive is at least one draw call; repeated nodes multiply it.
    drawCallsEstimate: primitives,
  };
}

// Full check. Never throws for bad content: callers get errors and warnings, so a
// studio report can show every problem in a file at once instead of one at a time.
export function validateGLB(input, limits = GLB_LIMITS) {
  const errors = [];
  const warnings = [];
  let stats = null;
  let used = [];

  try {
    const { json, bin, bytes } = parseGLB(input);
    used = [...(json.extensionsUsed ?? [])];

    if (!json.asset?.version) {
      errors.push('asset.version is missing');
    } else if (!String(json.asset.version).startsWith('2.')) {
      errors.push(`asset.version ${json.asset.version} is not glTF 2.x`);
    }

    for (const required of json.extensionsRequired ?? []) {
      if (DECODER_EXTENSIONS.has(required)) {
        errors.push(`${required} needs a decoder that this build does not ship`);
      } else if (!SUPPORTED_EXTENSIONS.has(required)) {
        errors.push(`required extension ${required} is not supported`);
      }
    }
    for (const usedExtension of used) {
      if (DECODER_EXTENSIONS.has(usedExtension)) {
        warnings.push(`${usedExtension} is present but optional; the compressed data will be ignored`);
      } else if (!SUPPORTED_EXTENSIONS.has(usedExtension)) {
        warnings.push(`extension ${usedExtension} is not recognised and may be ignored`);
      }
    }

    stats = measureGLB(json);

    if (bytes > limits.bytes) errors.push(`file is ${bytes} bytes, over the ${limits.bytes} byte budget`);
    if (stats.triangles > limits.triangles) {
      errors.push(`${stats.triangles} triangles, over the ${limits.triangles} budget`);
    }
    if (stats.materials > limits.materials) {
      warnings.push(`${stats.materials} materials, over the ${limits.materials} recommendation`);
    }
    if (stats.images > limits.images) {
      warnings.push(`${stats.images} images, over the ${limits.images} recommendation`);
    }
    if (stats.drawCallsEstimate > limits.drawCalls) {
      warnings.push(`${stats.drawCallsEstimate} primitives means at least that many draw calls`);
    }
    if (!bin && (json.buffers ?? []).some((buffer) => !buffer.uri)) {
      errors.push('a buffer has neither a BIN chunk nor a uri');
    }
    if (stats.triangles === 0) warnings.push('no triangles found: the model would render empty');

    return {
      ok: errors.length === 0,
      errors,
      warnings,
      stats,
      bytes,
      extensions: used,
      summary: `${stats.meshes} meshes · ${stats.triangles} tris · ${stats.materials} materials`,
    };
  } catch (error) {
    return {
      ok: false,
      errors: [error.message],
      warnings,
      stats,
      bytes: 0,
      extensions: used,
      summary: 'unreadable GLB',
    };
  }
}

// Loads a GLB through three's loader. Imported lazily so the loader is only part of
// the bundle once an authored asset actually ships.
export async function loadGLB(url, { THREE, GLTFLoader } = {}) {
  const three = THREE ?? (await import('three'));
  const loaderModule =
    GLTFLoader ?? (await import('three/examples/jsm/loaders/GLTFLoader.js')).GLTFLoader;
  const response = await fetch(url);
  if (!response.ok) throw new GLBError(`${url} returned ${response.status}`);
  const buffer = await response.arrayBuffer();
  const check = validateGLB(buffer);
  if (!check.ok) throw new GLBError(`${url} failed validation: ${check.errors.join('; ')}`);
  const loader = new loaderModule();
  const gltf = await loader.parseAsync(buffer, url.slice(0, url.lastIndexOf('/') + 1));
  return { scene: gltf.scene, animations: gltf.animations ?? [], report: check, three };
}
