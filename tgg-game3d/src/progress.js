// Save data for TGG World Act I.
//
// This is DEVICE-LOCAL progress (localStorage in the player's browser), not a
// server-side career. Every reader here is total: bad, partial or older data
// degrades to a playable default instead of throwing during boot.

export const SAVE_KEY = 'tgg.world.act1.v1';
export const BACKUP_KEY = 'tgg.world.act1.v1.corrupt';
export const SAVE_VERSION = 2;

function positiveNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

function countNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}

export function defaultProgress() {
  return { version: SAVE_VERSION, best: null, runs: 0, lastRun: null };
}

/**
 * Read a stored payload.
 * status: empty | ok | migrated | corrupt | newer | unavailable
 * `newer` means the save came from a future build: read it, never overwrite it.
 */
export function parseProgress(raw) {
  if (typeof raw !== 'string' || raw.trim() === '') {
    return { progress: defaultProgress(), status: 'empty' };
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return { progress: defaultProgress(), status: 'corrupt' };
  }

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { progress: defaultProgress(), status: 'corrupt' };
  }

  const version = typeof data.version === 'number' && Number.isFinite(data.version) ? data.version : 1;
  const progress = {
    version: SAVE_VERSION,
    best: positiveNumber(data.best),
    runs: countNumber(data.runs),
    lastRun: positiveNumber(data.lastRun),
  };

  if (version > SAVE_VERSION) return { progress, status: 'newer' };
  return { progress, status: version === SAVE_VERSION ? 'ok' : 'migrated' };
}

export function serializeProgress(progress) {
  return JSON.stringify({
    version: SAVE_VERSION,
    best: positiveNumber(progress?.best),
    runs: countNumber(progress?.runs),
    lastRun: positiveNumber(progress?.lastRun),
  });
}

/** Fold a finished run into stored progress. Invalid times still count a run. */
export function mergeRunProgress(progress, runTime) {
  const base = progress && typeof progress === 'object' ? progress : defaultProgress();
  const time = positiveNumber(runTime);
  const runs = countNumber(base.runs) + 1;
  const previousBest = positiveNumber(base.best);
  const best = time === null ? previousBest : previousBest === null || time < previousBest ? time : previousBest;
  return {
    version: SAVE_VERSION,
    best,
    runs,
    lastRun: time === null ? positiveNumber(base.lastRun) : time,
  };
}

export function formatTime(seconds) {
  const total = Math.max(0, Number(seconds) || 0);
  const mins = Math.floor(total / 60);
  const rest = total - mins * 60;
  return `${mins}:${rest.toFixed(1).padStart(4, '0')}`;
}
