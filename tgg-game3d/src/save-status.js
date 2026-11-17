// Save health: what is on this device, whether it is readable, and the two
// operations the player is allowed to perform on it — recover, or reset.
//
// Every function takes the storage object, so all of this is testable without a
// browser and none of it touches the DOM. The invariant that matters: nothing
// here can destroy a career the player cannot get back. Recovery keeps the
// unreadable payload, and reset keeps the backup.

import {
  BACKUP_KEY,
  SAVE_KEY,
  defaultProgress,
  formatTime,
  parseProgress,
  serializeProgress,
} from './progress.js';

export const PENDING_KEY = 'tgg.world.act1.v1.pending';
export const RECOVERED_KEY = 'tgg.world.act1.v1.corrupt.bad';
// Taken before the game boots, because the boot path copies a newly corrupt
// payload over the backup key. Without this snapshot a good backup sitting in
// that key is unreachable by the time the player can press Restore.
export const SNAPSHOT_KEY = 'tgg.world.act1.v1.backup.snapshot';

const usable = (storage) =>
  storage &&
  typeof storage.getItem === 'function' &&
  typeof storage.setItem === 'function' &&
  typeof storage.removeItem === 'function'
    ? storage
    : null;

function safeGet(store, key) {
  try {
    const value = store.getItem(key);
    return typeof value === 'string' && value.trim() !== '' ? value : null;
  } catch {
    return null;
  }
}

/**
 * Keeps a readable copy of the backup payload, once, before anything can
 * overwrite it. Safe to call on every boot: a valid snapshot is never replaced
 * by an unreadable one.
 */
export function snapshotBackup(storage) {
  const store = usable(storage);
  if (!store) return false;
  const payload = safeGet(store, BACKUP_KEY);
  if (payload === null) return false;
  const status = parseProgress(payload).status;
  if (status === 'corrupt' || status === 'empty') return false;
  try {
    if (safeGet(store, SNAPSHOT_KEY) === payload) return true;
    store.setItem(SNAPSHOT_KEY, payload);
    return true;
  } catch {
    return false;
  }
}

/** Everything the status line needs, in one read. */
export function readSaveState(storage) {
  const store = usable(storage);
  if (!store) {
    return { status: 'unavailable', progress: defaultProgress(), hasBackup: false, backup: null, raw: null };
  }
  let raw = null;
  try {
    raw = store.getItem(SAVE_KEY);
  } catch {
    return { status: 'unavailable', progress: defaultProgress(), hasBackup: false, backup: null, raw: null };
  }

  const parsed = parseProgress(raw);
  const usableBackup = (payload) => {
    if (payload === null) return null;
    const candidate = parseProgress(payload);
    if (candidate.status === 'corrupt' || candidate.status === 'empty') return null;
    return candidate.progress;
  };

  const liveBackup = usableBackup(safeGet(store, BACKUP_KEY));
  const snapshotted = usableBackup(safeGet(store, SNAPSHOT_KEY));
  const backup = liveBackup ?? snapshotted;

  return {
    status: parsed.status,
    progress: parsed.progress,
    hasBackup: backup !== null,
    backup,
    fromSnapshot: liveBackup === null && snapshotted !== null,
    raw: typeof raw === 'string' ? raw : null,
  };
}

/** The one-line status shown above the career buttons. */
export function describeSaveState(state) {
  const progress = state?.progress ?? defaultProgress();
  const backupNote = state?.hasBackup ? ' · backup kept' : '';

  switch (state?.status) {
    case 'ok':
    case 'migrated':
      return {
        tone: 'ok',
        message:
          progress.best === null && progress.runs === 0
            ? `Saved on this device · no completed run yet${backupNote}`
            : `Saved on this device · best ${formatTime(progress.best)} · ${progress.runs} runs${backupNote}`,
        needsRecovery: false,
      };
    case 'newer':
      return {
        tone: 'warn',
        message: 'This career is from a newer build · read-only, this build will not overwrite it',
        needsRecovery: false,
      };
    case 'corrupt':
      return {
        tone: 'error',
        message: state?.backup
          ? `Saved career could not be read · backup from before is available (best ${formatTime(state.backup.best)})`
          : 'Saved career could not be read · no backup to restore',
        needsRecovery: Boolean(state?.backup),
      };
    case 'unavailable':
      return {
        tone: 'error',
        message: 'This browser is blocking local storage · progress cannot be saved or restored',
        needsRecovery: false,
      };
    default:
      return {
        tone: 'muted',
        message: `No career on this device yet${backupNote}`,
        needsRecovery: false,
      };
  }
}

/**
 * Restores the backup as the live career.
 * The unreadable payload is moved aside first, so a bug here never costs the
 * player the corrupt data an export or a hand-repair might still need.
 */
export function recoverFromBackup(storage) {
  const store = usable(storage);
  if (!store) return { ok: false, message: 'Storage is not available, so nothing was restored.' };

  const state = readSaveState(store);
  if (!state.backup) return { ok: false, message: 'There is no valid backup to restore on this device.' };
  if (state.status === 'newer') {
    return { ok: false, message: 'This career is from a newer build and will not be replaced.' };
  }

  try {
    if (state.raw) store.setItem(RECOVERED_KEY, state.raw);
    store.setItem(SAVE_KEY, serializeProgress(state.backup));
  } catch {
    return { ok: false, message: 'This browser refused to write the backup (storage blocked or full).' };
  }

  const after = readSaveState(store);
  if (after.status !== 'ok' && after.status !== 'migrated') {
    return { ok: false, message: 'The backup could not be read back after writing.' };
  }
  return {
    ok: true,
    progress: after.progress,
    message: `Backup restored · best ${formatTime(after.progress.best)} · ${after.progress.runs} runs`,
  };
}

/**
 * Clears the live career on this device. Exported files and the recovery backup
 * are deliberately left alone: a reset must not be able to destroy the only
 * remaining copy of anything.
 */
export function resetCareer(storage) {
  const store = usable(storage);
  if (!store) return { ok: false, message: 'Storage is not available, so there was nothing to reset.' };
  try {
    store.removeItem(SAVE_KEY);
    store.removeItem(PENDING_KEY);
  } catch {
    return { ok: false, message: 'This browser refused to clear the career.' };
  }
  const after = readSaveState(store);
  if (after.status !== 'empty') {
    return { ok: false, message: 'The career is still on this device.' };
  }
  return { ok: true, message: 'Career reset on this device · exported files and the backup are untouched' };
}

/**
 * A write that survives a full disk mid-write.
 *
 * localStorage has no transactions, so the closest honest thing is: write the
 * new payload to a separate key, read it back, and only then replace the live
 * key. If storage is full or blocked the first write fails and the existing
 * career is still untouched.
 */
export function writeProgressVerified(storage, progress) {
  const store = usable(storage);
  if (!store) return { ok: false, message: 'not saved · storage unavailable' };
  const payload = serializeProgress(progress);

  try {
    store.setItem(PENDING_KEY, payload);
    if (store.getItem(PENDING_KEY) !== payload) {
      return { ok: false, message: 'not saved · the write could not be verified' };
    }
    store.setItem(SAVE_KEY, payload);
    if (store.getItem(SAVE_KEY) !== payload) {
      return { ok: false, message: 'not saved · the write could not be verified' };
    }
    store.removeItem(PENDING_KEY);
    return { ok: true, message: 'saved on this device' };
  } catch {
    try {
      store.removeItem(PENDING_KEY);
    } catch {
      /* the pending key is harmless if it survives */
    }
    return { ok: false, message: 'not saved · storage blocked or full' };
  }
}
