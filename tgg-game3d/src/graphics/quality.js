// Graphics quality profiles.
//
// These replace the old single knob (a render-resolution cap) with a set of
// settings that actually trade fidelity for cost: shadows, shadow-map resolution,
// environment-map size, texture filtering and how much street detail is built.
//
// Nothing here invents a capability: `shadows` needs a shadow-casting light, and
// `envSize` only affects the procedural environment map, which is the only
// environment this build has.

export const PROFILES = {
  low: {
    label: 'Low',
    pixelRatio: 1,
    shadows: false,
    shadowMap: 1024,
    shadowRadius: 60,
    envSize: 128,
    anisotropy: 2,
    // 'core' builds the block shell and towers but skips benches, bins, trees and
    // facade ornament, which are the cheapest things to drop.
    detail: 'core',
    maxDrawCalls: 260,
    maxTriangles: 260000,
  },
  medium: {
    label: 'Medium',
    pixelRatio: 1.35,
    shadows: true,
    shadowMap: 1024,
    shadowRadius: 70,
    envSize: 256,
    anisotropy: 4,
    detail: 'standard',
    maxDrawCalls: 320,
    maxTriangles: 340000,
  },
  high: {
    label: 'High',
    pixelRatio: 1.75,
    shadows: true,
    shadowMap: 2048,
    shadowRadius: 80,
    envSize: 512,
    anisotropy: 8,
    detail: 'full',
    maxDrawCalls: 400,
    maxTriangles: 460000,
  },
  ultra: {
    label: 'Ultra',
    pixelRatio: 2,
    shadows: true,
    shadowMap: 4096,
    shadowRadius: 110,
    envSize: 1024,
    anisotropy: 16,
    detail: 'full',
    maxDrawCalls: 500,
    maxTriangles: 620000,
  },
};

export const QUALITY_ORDER = ['low', 'medium', 'high', 'ultra'];

// The menu already offered low / balanced / high, and saves persist those names.
// Renaming them would strand existing saves, so they alias instead.
export const QUALITY_ALIASES = { balanced: 'medium', med: 'medium', max: 'ultra' };

export function qualityNames() {
  return [...QUALITY_ORDER];
}

// Resolves a persisted or user-facing name to a full profile. Unknown values fall
// back to medium rather than throwing: a corrupt save must not stop the game booting.
export function resolveProfile(name) {
  const key = QUALITY_ALIASES[name] ?? name;
  const profile = PROFILES[key] ?? PROFILES.medium;
  return { ...profile, name: PROFILES[key] ? key : 'medium' };
}

// What to call the profile when writing it back to a save, so the menu keeps working.
export function persistedName(name) {
  const resolved = resolveProfile(name).name;
  return resolved === 'medium' ? 'balanced' : resolved;
}

// A conservative starting point, not a benchmark: the browser exposes only coarse
// hints, so this errs towards the lower profile when a signal is weak.
export function detectDevice(info = {}) {
  const {
    width = 1280,
    dpr = 1,
    hardwareConcurrency = 4,
    deviceMemory = 4,
    mobile = false,
  } = info;

  if (mobile || width < 760 || hardwareConcurrency <= 2 || deviceMemory <= 2) return 'low';
  if (hardwareConcurrency >= 8 && deviceMemory >= 8 && dpr >= 2) return 'high';
  if (hardwareConcurrency >= 4 && deviceMemory >= 4) return 'medium';
  return 'low';
}

// A single comparable sample of what the GPU was asked to do.
export function budgetReport(sample, profile) {
  const limits = resolveProfile(profile);
  const over = [];
  if (sample.drawCalls > limits.maxDrawCalls) {
    over.push({ metric: 'drawCalls', value: sample.drawCalls, limit: limits.maxDrawCalls });
  }
  if (sample.triangles > limits.maxTriangles) {
    over.push({ metric: 'triangles', value: sample.triangles, limit: limits.maxTriangles });
  }
  return {
    profile: limits.name,
    ok: over.length === 0,
    over,
    drawCalls: sample.drawCalls,
    triangles: sample.triangles,
  };
}
