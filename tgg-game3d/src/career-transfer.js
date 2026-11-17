// Career transfer logic: the part of export/import that is not the DOM.
//
// Kept separate from ./career-panel.js so every decision (filename, backup,
// merge, what the player is told) is unit-testable without a browser. Nothing
// here runs at import time; callers pass the storage object they actually have.

import {
  BACKUP_KEY,
  SAVE_KEY,
  defaultProgress,
  exportCareer,
  importCareer,
  parseProgress,
  serializeProgress,
} from './progress.js';

/** A short, sortable, human file name. No spaces, no slashes, no colons. */
export function careerFileName(progress, now = new Date()) {
  const stamp = (now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date())
    .toISOString()
    .slice(0, 19)
    .replace(/[:T]/g, '-');
  const best = progress?.best;
  const tag =
    typeof best === 'number' && Number.isFinite(best) && best > 0
      ? `-best-${best.toFixed(1).replace('.', '_')}s`
      : '-new';
  return `tgg-world-career-${stamp}${tag}.json`;
}

function readableTime(seconds) {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0) return '—';
  const mins = Math.floor(seconds / 60);
  const rest = seconds - mins * 60;
  return `${mins}:${rest.toFixed(1).padStart(4, '0')}`;
}

/** What the player is told after an import attempt. */
export function describeImport(result) {
  if (!result || typeof result.status !== 'string') {
    return { tone: 'error', message: 'That file could not be read.' };
  }
  switch (result.status) {
    case 'ok': {
      const progress = result.progress ?? {};
      return {
        tone: 'ok',
        message: `Career imported · best ${readableTime(progress.best)} · ${progress.runs ?? 0} runs`,
      };
    }
    case 'empty':
      return { tone: 'warn', message: 'That file has no career progress in it.' };
    case 'newer':
      return {
        tone: 'warn',
        message: 'That career comes from a newer build — it was not applied.',
      };
    default:
      return {
        tone: 'error',
        message: `Not a TGG World career file (${result.reason ?? 'invalid'}).`,
      };
  }
}

const usable = (storage) =>
  storage &&
  typeof storage.getItem === 'function' &&
  typeof storage.setItem === 'function' &&
  typeof storage.removeItem === 'function'
    ? storage
    : null;

/** The career currently on this device. */
export function readStoredCareer(storage) {
  const store = usable(storage);
  if (!store) return { status: 'unavailable', progress: defaultProgress() };
  try {
    return parseProgress(store.getItem(SAVE_KEY));
  } catch {
    return { status: 'unavailable', progress: defaultProgress() };
  }
}

/**
 * Writes a career, keeping the previous raw payload as the corrupt-recovery
 * backup first so a bad import can never destroy the only copy.
 */
export function writeStoredCareer(storage, progress, options = {}) {
  const store = usable(storage);
  if (!store) return false;
  try {
    if (options.backupPrevious !== false) {
      const previous = store.getItem(SAVE_KEY);
      if (typeof previous === 'string' && previous.trim() !== '') {
        store.setItem(BACKUP_KEY, previous);
      }
    }
    store.setItem(SAVE_KEY, serializeProgress(progress));
    return true;
  } catch {
    return false;
  }
}

/** The export body and file name for the career on this device. */
export function exportStoredCareer(storage, now = new Date()) {
  const { status, progress } = readStoredCareer(storage);
  if (status === 'unavailable') return { status: 'unavailable' };
  return {
    status: 'ok',
    text: exportCareer(progress, now.toISOString()),
    filename: careerFileName(progress, now),
    empty: progress.best === null && progress.runs === 0 && progress.lastRun === null,
  };
}

/**
 * Validates first, then merges into what is already on the device.
 * Returns the import result, the player-facing message and whether the stored
 * career actually changed — an import that loses to the local career changes
 * nothing, and the player is told so.
 */
export function importStoredCareer(storage, text, options = {}) {
  const store = usable(storage);
  if (!store) {
    return { status: 'unavailable', changed: false, message: 'Storage is not available, so nothing was imported.' };
  }

  const current = readStoredCareer(store);
  // A browser that refuses to read is not a browser we can safely write to.
  if (current.status === 'unavailable') {
    return {
      status: 'unavailable',
      changed: false,
      tone: 'error',
      message: 'Storage is not available, so nothing was imported.',
    };
  }
  const result = importCareer(text, {
    current: current.progress,
    merge: options.merge !== false,
  });
  const described = describeImport(result);

  if (result.status !== 'ok') {
    return { ...result, changed: false, message: described.message, tone: described.tone };
  }

  const before = current.progress;
  const after = result.progress;
  const changed =
    before.best !== after.best || before.runs !== after.runs || before.lastRun !== after.lastRun;

  if (!changed) {
    return {
      status: 'ok',
      changed: false,
      message: 'That career was already on this device — nothing to merge.',
      tone: 'warn',
      progress: after,
    };
  }

  const written = writeStoredCareer(store, after, { backupPrevious: true });
  if (!written) {
    return {
      status: 'ok',
      changed: false,
      message: 'The file was valid but this browser refused to save it (storage blocked or full).',
      tone: 'error',
      progress: before,
    };
  }

  return {
    status: 'ok',
    changed: true,
    message: `${described.message} · previous career kept as backup`,
    tone: 'ok',
    progress: after,
  };
}
