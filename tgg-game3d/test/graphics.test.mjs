// Tests for TGG Graphics Studio.
//
// These cover the parts that can be wrong without anything looking wrong on screen:
// a GLB that lulls the studio into accepting a model it cannot render, a quality
// profile that silently falls back to the wrong setting, a screenshot diff that
// reports "no change" when two images are nothing alike.
//
// They deliberately do not test that the game looks realistic. That is a visual
// claim, and it is checked with screenshots, not assertions.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PROFILES,
  budgetReport,
  detectDevice,
  persistedName,
  qualityNames,
  resolveProfile,
} from '../src/graphics/quality.js';
import { GLB_LIMITS, measureGLB, parseGLB, validateGLB } from '../src/graphics/glb.js';
import { AssetLibrary, DEFAULT_MANIFEST } from '../src/graphics/assets.js';
import { percentile, summariseFrames } from '../src/graphics/perf.js';
import { diffPixels } from '../src/graphics/compare.js';
import { PHOTO_VIEWS, resolveView, viewIds } from '../src/graphics/presets.js';

// --- helpers ---------------------------------------------------------------

function makeGLB(json, { bin = 0, version = 2, magic = 0x46546c67, declaredLength = null } = {}) {
  const jsonText = JSON.stringify(json);
  const jsonBytes = Buffer.from(jsonText.padEnd(Math.ceil(jsonText.length / 4) * 4, ' '), 'utf8');
  const binBytes = Buffer.alloc(Math.ceil(bin / 4) * 4);
  const size = 12 + 8 + jsonBytes.length + (binBytes.length ? 8 + binBytes.length : 0);
  const buffer = Buffer.alloc(size);
  buffer.writeUInt32LE(magic, 0);
  buffer.writeUInt32LE(version, 4);
  buffer.writeUInt32LE(declaredLength ?? size, 8);
  buffer.writeUInt32LE(jsonBytes.length, 12);
  buffer.writeUInt32LE(0x4e4f534a, 16);
  jsonBytes.copy(buffer, 20);
  if (binBytes.length) {
    const at = 20 + jsonBytes.length;
    buffer.writeUInt32LE(binBytes.length, at);
    buffer.writeUInt32LE(0x004e4942, at + 4);
    binBytes.copy(buffer, at + 8);
  }
  return buffer;
}

const minimalJson = {
  asset: { version: '2.0', generator: 'studio test' },
  scenes: [{ nodes: [] }],
  meshes: [
    {
      primitives: [
        {
          attributes: { POSITION: 0 },
          indices: 1,
          material: 0,
        },
      ],
    },
  ],
  accessors: [
    { componentType: 5126, count: 300, type: 'VEC3' },
    { componentType: 5123, count: 90, type: 'SCALAR' },
  ],
  materials: [{ name: 'paint' }],
  buffers: [{ byteLength: 16 }],
};

// --- quality ---------------------------------------------------------------

test('quality profiles all carry a budget and a detail level', () => {
  for (const name of qualityNames()) {
    const profile = resolveProfile(name);
    assert.equal(profile.name, name);
    assert.ok(profile.maxDrawCalls > 0, `${name} has no draw-call budget`);
    assert.ok(profile.maxTriangles > 0, `${name} has no triangle budget`);
    assert.ok(['core', 'standard', 'full'].includes(profile.detail), `${name} has a bad detail level`);
    assert.ok(profile.envSize >= 128, `${name} environment map is unusably small`);
  }
});

test('the menu names still resolve, so existing saves keep working', () => {
  assert.equal(resolveProfile('balanced').name, 'medium');
  assert.equal(persistedName('medium'), 'balanced');
  assert.equal(persistedName('ultra'), 'ultra');
  // A corrupt save must not stop the game booting.
  assert.equal(resolveProfile('nonsense').name, 'medium');
  assert.equal(resolveProfile(undefined).name, 'medium');
});

test('quality ordering increases cost, never decreases it', () => {
  const order = qualityNames().map((name) => resolveProfile(name));
  for (let i = 1; i < order.length; i += 1) {
    assert.ok(order[i].pixelRatio >= order[i - 1].pixelRatio);
    assert.ok(order[i].maxTriangles >= order[i - 1].maxTriangles);
    assert.ok(order[i].shadowMap >= order[i - 1].shadowMap);
  }
});

test('device detection sends weak hardware to low, not to ultra', () => {
  assert.equal(detectDevice({ mobile: true, width: 400, dpr: 3, hardwareConcurrency: 8, deviceMemory: 8 }), 'low');
  assert.equal(detectDevice({ width: 600, dpr: 2, hardwareConcurrency: 4, deviceMemory: 8 }), 'low');
  assert.equal(detectDevice({ width: 1600, dpr: 2, hardwareConcurrency: 8, deviceMemory: 8 }), 'high');
  assert.equal(detectDevice({ width: 1280, dpr: 1, hardwareConcurrency: 4, deviceMemory: 4 }), 'medium');
});

test('budgetReport names the metric that went over', () => {
  const report = budgetReport({ drawCalls: 10, triangles: 999999 }, 'low');
  assert.equal(report.ok, false);
  assert.deepEqual(report.over.map((entry) => entry.metric), ['triangles']);
  assert.equal(budgetReport({ drawCalls: 10, triangles: 10 }, 'low').ok, true);
});

// --- GLB -------------------------------------------------------------------

test('a well-formed GLB parses and is measured', () => {
  const buffer = makeGLB(minimalJson, { bin: 16 });
  const { json, bin } = parseGLB(buffer);
  assert.equal(json.asset.version, '2.0');
  assert.ok(bin.length > 0);

  const stats = measureGLB(json);
  assert.equal(stats.meshes, 1);
  assert.equal(stats.triangles, 30); // 90 indices / 3
  assert.equal(stats.materials, 1);

  const check = validateGLB(buffer);
  assert.equal(check.ok, true, check.errors.join('; '));
  assert.match(check.summary, /30 tris/);
});

test('a GLB that is not a GLB is refused, not half-read', () => {
  const bad = validateGLB(Buffer.alloc(64));
  assert.equal(bad.ok, false);
  assert.match(bad.errors[0], /magic/);

  const wrongVersion = validateGLB(makeGLB(minimalJson, { version: 1 }));
  assert.equal(wrongVersion.ok, false);
  assert.match(wrongVersion.errors[0], /version/);

  const wrongLength = validateGLB(makeGLB(minimalJson, { declaredLength: 999 }));
  assert.equal(wrongLength.ok, false);
  assert.match(wrongLength.errors[0], /header length/);
});

test('a GLB with no JSON chunk is refused', () => {
  const buffer = Buffer.alloc(24);
  buffer.writeUInt32LE(0x46546c67, 0);
  buffer.writeUInt32LE(2, 4);
  buffer.writeUInt32LE(24, 8);
  buffer.writeUInt32LE(4, 12);
  buffer.writeUInt32LE(0x004e4942, 16);
  const check = validateGLB(buffer);
  assert.equal(check.ok, false);
  assert.match(check.errors.join(' '), /no JSON chunk/);
});

test('compressed geometry is refused because the build cannot decode it', () => {
  const json = {
    ...minimalJson,
    extensionsRequired: ['KHR_draco_mesh_compression'],
    extensionsUsed: ['KHR_draco_mesh_compression'],
  };
  const check = validateGLB(makeGLB(json, { bin: 16 }));
  assert.equal(check.ok, false);
  assert.match(check.errors.join(' '), /decoder/);
});

test('an over-budget model is caught before it reaches a tab', () => {
  const json = {
    ...minimalJson,
    accessors: [
      { componentType: 5126, count: GLB_LIMITS.triangles * 3 + 300, type: 'VEC3' },
      { componentType: 5123, count: GLB_LIMITS.triangles * 3 + 300, type: 'SCALAR' },
    ],
  };
  const check = validateGLB(makeGLB(json, { bin: 16 }));
  assert.equal(check.ok, false);
  assert.match(check.errors.join(' '), /over the .* budget/);
});

test('an empty model is a warning, because it renders nothing', () => {
  const json = { asset: { version: '2.0' }, meshes: [] };
  const check = validateGLB(makeGLB(json, { bin: 0 }));
  assert.equal(check.ok, true);
  assert.match(check.warnings.join(' '), /no triangles/);
});

// --- assets ----------------------------------------------------------------

test('the shipped manifest is valid and separates built from declared', () => {
  const library = new AssetLibrary(DEFAULT_MANIFEST);
  const validation = library.validate();
  assert.equal(validation.ok, true, validation.problems.join('; '));

  const exported = library.export();
  assert.equal(exported.counts.total, DEFAULT_MANIFEST.assets.length);
  assert.ok(exported.counts.inGame >= 4);
  assert.ok(exported.counts.declared >= 1);

  // A declared asset must never be described as in-game: that is the claim this
  // whole manifest exists to keep honest.
  for (const asset of library.pending()) assert.equal(asset.status, 'declared');
  for (const asset of library.inGame()) assert.ok(asset.module, `${asset.id} is in-game with no module`);
});

test('the library refuses duplicate ids', () => {
  const library = new AssetLibrary({ assets: [] });
  const asset = { id: 'prop.test', kind: 'prop', title: 't', source: 'procedural', module: 'm', budget: { triangles: 1 } };
  library.register(asset);
  assert.equal(library.get('prop.test').id, 'prop.test');
  assert.equal(library.get('nope'), null);
});

test('an unknown asset kind is rejected rather than stored', () => {
  const library = new AssetLibrary({ assets: [] });
  assert.throws(
    () => library.register({ id: 'x', kind: 'architecture', title: 't', source: 'procedural', budget: { triangles: 1 } }),
    /unknown kind/,
  );
});

// --- perf ------------------------------------------------------------------

test('frame statistics ignore nonsense samples and report percentiles', () => {
  const stats = summariseFrames([16, 16, 16, 33, -5, 0, 9999]);
  assert.equal(stats.samples, 4);
  assert.equal(stats.p50, 16);
  assert.ok(stats.p95 >= 16);
  assert.ok(stats.fps > 30);

  assert.equal(percentile([], 50), 0);
  assert.equal(percentile([5], 95), 5);
  assert.equal(summariseFrames([]).fps, 0);
});

// --- compare ---------------------------------------------------------------

test('identical captures diff to zero, and a changed frame does not', () => {
  const a = new Uint8ClampedArray([10, 20, 30, 255, 40, 50, 60, 255]);
  const same = diffPixels(a, a);
  assert.equal(same.meanAbs, 0);
  assert.equal(same.pctChanged, 0);

  const b = new Uint8ClampedArray([110, 20, 30, 255, 40, 50, 60, 255]);
  const changed = diffPixels(a, b);
  assert.equal(changed.pctChanged, 50);
  assert.equal(changed.pixels, 2);
  assert.ok(changed.meanAbs > 0);

  assert.throws(() => diffPixels(a, new Uint8ClampedArray([1, 2, 3, 255])), /differ in size/);
  assert.throws(() => diffPixels(null, a), /two pixel buffers/);
});

// --- presets ---------------------------------------------------------------

test('the six comparison views exist and are stable', () => {
  assert.deepEqual(viewIds(), ['day', 'sunset', 'night', 'street', 'vehicle', 'character']);
  for (const view of PHOTO_VIEWS) {
    assert.ok(view.hour >= 0 && view.hour <= 24, `${view.id} has no sensible hour`);
    assert.ok(view.label, `${view.id} has no label`);
  }
});

test('resolved views are concrete camera setups', () => {
  const day = resolveView('day');
  assert.equal(day.hour, 12);
  assert.equal(day.camera.position.length, 3);
  assert.ok(Number.isFinite(day.camera.fov));

  const carView = resolveView('vehicle', { car: { pos: { x: 10, z: 20 }, heading: Math.PI } });
  for (const value of [...carView.camera.position, ...carView.camera.target]) {
    assert.ok(Number.isFinite(value));
  }
  // The close-up stands in front of the car, which faces -Z at heading PI.
  assert.ok(carView.camera.position[2] < 20);

  assert.throws(() => resolveView('nope'), /unknown photo view/);
  assert.throws(() => resolveView('vehicle', {}), /needs a car/);
});
