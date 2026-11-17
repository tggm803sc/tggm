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

/**
 * A portable copy of the career.
 *
 * With no career server there is no cross-device sync, so the honest offline
 * substitute is a file the player owns: this envelope names the game and the
 * format so an import can refuse anything that is not a TGG World career.
 */
export const CAREER_FILE_KIND = 'tgg-world-career';
export const CAREER_FILE_FORMAT = 1;

export function exportCareer(progress, exportedAt = new Date().toISOString()) {
  return `${JSON.stringify(
    {
      kind: CAREER_FILE_KIND,
      format: CAREER_FILE_FORMAT,
      exportedAt,
      save: {
        version: SAVE_VERSION,
        best: positiveNumber(progress?.best),
        runs: countNumber(progress?.runs),
        lastRun: positiveNumber(progress?.lastRun),
      },
    },
    null,
    2,
  )}\n`;
}

/**
 * Reads an exported career back.
 * status: ok | empty | invalid | newer
 * With `merge` (the default) the import can only improve a career: the faster
 * best, the larger run count and the incoming last run win.
 */
export function importCareer(text, options = {}) {
  const current = options.current && typeof options.current === 'object' ? options.current : null;
  const merge = options.merge !== false;

  if (typeof text !== 'string' || text.trim() === '') return { status: 'empty' };

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { status: 'invalid', reason: 'not_json' };
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { status: 'invalid', reason: 'not_an_object' };
  }
  if (data.kind !== CAREER_FILE_KIND) return { status: 'invalid', reason: 'wrong_kind' };
  const save = data.save;
  if (!save || typeof save !== 'object' || Array.isArray(save)) {
    return { status: 'invalid', reason: 'missing_save' };
  }
  // A hand-edited file must be rejected for what it says, not quietly turned
  // into an empty career by the tolerant reader below.
  const notANumber = (value) => value !== undefined && value !== null && typeof value !== 'number';
  if (notANumber(save.best) || notANumber(save.runs) || notANumber(save.lastRun)) {
    return { status: 'invalid', reason: 'invalid_save' };
  }

  const parsed = parseProgress(JSON.stringify(save));
  if (parsed.status === 'corrupt') return { status: 'invalid', reason: 'invalid_save' };
  if (parsed.status === 'newer') return { status: 'newer', progress: parsed.progress };
  if (parsed.status === 'empty') return { status: 'empty' };

  const incoming = parsed.progress;
  if (incoming.best === null && incoming.runs === 0 && incoming.lastRun === null) {
    return { status: 'empty' };
  }
  if (!merge || !current) return { status: 'ok', progress: incoming };

  const best =
    current.best === null || current.best === undefined
      ? incoming.best
      : incoming.best === null
        ? current.best
        : Math.min(current.best, incoming.best);
  return {
    status: 'ok',
    progress: {
      version: SAVE_VERSION,
      best,
      runs: Math.max(countNumber(current.runs), incoming.runs),
      lastRun: incoming.lastRun ?? current.lastRun ?? null,
    },
  };
}

export function formatTime(seconds) {
  const total = Math.max(0, Number(seconds) || 0);
  const mins = Math.floor(total / 60);
  const rest = total - mins * 60;
  return `${mins}:${rest.toFixed(1).padStart(4, '0')}`;
}
