// Act I run state, kept in the browser. Nothing here is a claim about a real
// release: the hash is a local content id for the take, not a music asset.
const KEY = 'tgg.world.act1.v1';
const VERSION = 1;

// Release pipeline, canon order. A state may only move forward except on an
// explicit new run, which starts again at draft.
export const RELEASE_ORDER = ['draft', 'mastered', 'delivery-pending', 'released'];

export function loadProgress() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== VERSION) return null;
    if (data.release && !RELEASE_ORDER.includes(data.release.state)) {
      data.release.state = 'draft';
    }
    return data;
  } catch {
    return null;
  }
}

export function saveProgress(patch) {
  try {
    const prior = loadProgress() ?? {};
    const next = { ...prior, ...patch, version: VERSION, savedAt: Date.now() };
    window.localStorage.setItem(KEY, JSON.stringify(next));
    return next;
  } catch {
    return null;
  }
}

export function clearProgress() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Storage can be blocked; a run without saving is still a playable run.
  }
}

// Same take in, same id out, so a refresh cannot silently change the master.
export function mixHash(quality, scores, seed) {
  let hash = 2166136261 ^ (Number(seed) >>> 0);
  const push = (code) => {
    hash ^= code & 0xff;
    hash = Math.imul(hash, 16777619) >>> 0;
  };
  push(Number(quality) || 0);
  for (const score of scores ?? []) push(Number(score) || 0);
  for (const char of String(seed)) push(char.charCodeAt(0));
  return hash.toString(16).padStart(8, '0');
}
