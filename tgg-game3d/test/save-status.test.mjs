import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PENDING_KEY,
  RECOVERED_KEY,
  SNAPSHOT_KEY,
  describeSaveState,
  readSaveState,
  recoverFromBackup,
  resetCareer,
  snapshotBackup,
  writeProgressVerified,
} from '../src/save-status.js';
import { BACKUP_KEY, SAVE_KEY } from '../src/progress.js';

function store(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
    raw: () => Object.fromEntries(data),
  };
}

const good = JSON.stringify({ version: 2, best: 5, runs: 3, lastRun: 5 });

test('an empty device reports no career and needs no recovery', () => {
  const state = readSaveState(store());
  assert.equal(state.status, 'empty');
  assert.equal(state.hasBackup, false);
  const described = describeSaveState(state);
  assert.match(described.message, /No career on this device yet/);
  assert.equal(described.needsRecovery, false);
});

test('a healthy save shows the best time, runs and the backup presence', () => {
  const storeWith = store({ [SAVE_KEY]: good, [BACKUP_KEY]: JSON.stringify({ version: 2, best: 9, runs: 1, lastRun: 9 }) });
  const described = describeSaveState(readSaveState(storeWith));
  assert.equal(described.tone, 'ok');
  assert.match(described.message, /best 0:05\.0 · 3 runs · backup kept/);
});

test('a newer-build save is reported read-only, never as corrupt', () => {
  const storeWith = store({ [SAVE_KEY]: JSON.stringify({ version: 99, best: 2, runs: 40, lastRun: 2 }) });
  const state = readSaveState(storeWith);
  assert.equal(state.status, 'newer');
  const described = describeSaveState(state);
  assert.equal(described.tone, 'warn');
  assert.match(described.message, /read-only/);
  assert.equal(described.needsRecovery, false);
});

test('corrupt data with a valid backup offers recovery, and recovery restores it', () => {
  const storeWith = store({ [SAVE_KEY]: '{not json', [BACKUP_KEY]: good });
  const described = describeSaveState(readSaveState(storeWith));
  assert.equal(described.tone, 'error');
  assert.match(described.message, /backup from before is available/);
  assert.equal(described.needsRecovery, true);

  const result = recoverFromBackup(storeWith);
  assert.equal(result.ok, true);
  assert.match(result.message, /Backup restored/);
  assert.deepEqual(JSON.parse(storeWith.getItem(SAVE_KEY)), { version: 2, best: 5, runs: 3, lastRun: 5 });
  // the unreadable payload is kept, not discarded
  assert.equal(storeWith.getItem(RECOVERED_KEY), '{not json');
  assert.equal(storeWith.getItem(BACKUP_KEY), good);
});

test('corrupt data with no backup says so and refuses to invent one', () => {
  const storeWith = store({ [SAVE_KEY]: '{not json' });
  const described = describeSaveState(readSaveState(storeWith));
  assert.match(described.message, /no backup to restore/);
  assert.equal(described.needsRecovery, false);
  const result = recoverFromBackup(storeWith);
  assert.equal(result.ok, false);
  assert.equal(storeWith.getItem(SAVE_KEY), '{not json');
});

test('recovery refuses to replace a newer-build career', () => {
  const newer = JSON.stringify({ version: 99, best: 1, runs: 2, lastRun: 1 });
  const storeWith = store({ [SAVE_KEY]: newer, [BACKUP_KEY]: good });
  const result = recoverFromBackup(storeWith);
  assert.equal(result.ok, false);
  assert.match(result.message, /newer build/);
  assert.equal(storeWith.getItem(SAVE_KEY), newer);
});

test('a corrupt backup is not offered as recoverable', () => {
  const storeWith = store({ [SAVE_KEY]: '[]', [BACKUP_KEY]: 'nope' });
  const state = readSaveState(storeWith);
  assert.equal(state.backup, null);
  assert.equal(describeSaveState(state).needsRecovery, false);
});

test('reset clears the career but keeps the backup and outlasts pending writes', () => {
  const storeWith = store({ [SAVE_KEY]: good, [BACKUP_KEY]: good, [PENDING_KEY]: good });
  const result = resetCareer(storeWith);
  assert.equal(result.ok, true);
  assert.equal(storeWith.getItem(SAVE_KEY), null);
  assert.equal(storeWith.getItem(PENDING_KEY), null);
  assert.equal(storeWith.getItem(BACKUP_KEY), good);
  assert.match(result.message, /backup are untouched/);
});

test('blocked storage is reported for every operation instead of throwing', () => {
  const blocked = {
    getItem() {
      throw new Error('denied');
    },
    setItem() {
      throw new Error('quota');
    },
    removeItem() {
      throw new Error('denied');
    },
  };
  assert.equal(readSaveState(blocked).status, 'unavailable');
  assert.equal(describeSaveState(readSaveState(blocked)).tone, 'error');
  assert.equal(resetCareer(blocked).ok, false);
  assert.equal(recoverFromBackup(blocked).ok, false);
  assert.equal(writeProgressVerified(blocked, { best: 1 }).ok, false);
  assert.equal(readSaveState(null).status, 'unavailable');
});

test('a verified write lands in both keys and leaves no pending file', () => {
  const storeWith = store({ [SAVE_KEY]: good });
  const result = writeProgressVerified(storeWith, { best: 4, runs: 4, lastRun: 4 });
  assert.equal(result.ok, true);
  assert.deepEqual(JSON.parse(storeWith.getItem(SAVE_KEY)), { version: 2, best: 4, runs: 4, lastRun: 4 });
  assert.equal(storeWith.getItem(PENDING_KEY), null);
});

test('a full disk leaves the existing career untouched', () => {
  const storeWith = store({ [SAVE_KEY]: good });
  const full = {
    getItem: (k) => storeWith.getItem(k),
    setItem() {
      throw new Error('QuotaExceededError');
    },
    removeItem: (k) => storeWith.removeItem(k),
  };
  const result = writeProgressVerified(full, { best: 1, runs: 99, lastRun: 1 });
  assert.equal(result.ok, false);
  assert.match(result.message, /blocked or full/);
  assert.equal(storeWith.getItem(SAVE_KEY), good);
});

test('a good backup survives the boot path overwriting the backup key', () => {
  // Regression: on boot the game copies the corrupt payload into BACKUP_KEY,
  // which used to make a perfectly good backup unreachable.
  const storeWith = store({ [SAVE_KEY]: good, [BACKUP_KEY]: good });
  assert.equal(snapshotBackup(storeWith), true);

  storeWith.setItem(SAVE_KEY, '{broken');
  storeWith.setItem(BACKUP_KEY, '{broken'); // what main.js does on a corrupt boot

  const state = readSaveState(storeWith);
  assert.equal(state.status, 'corrupt');
  assert.equal(state.hasBackup, true, 'the snapshot must still be offered');
  assert.equal(state.fromSnapshot, true);
  assert.equal(describeSaveState(state).needsRecovery, true);

  const result = recoverFromBackup(storeWith);
  assert.equal(result.ok, true);
  assert.deepEqual(JSON.parse(storeWith.getItem(SAVE_KEY)), { version: 2, best: 5, runs: 3, lastRun: 5 });
});

test('a corrupt backup never replaces a good snapshot', () => {
  const storeWith = store({ [BACKUP_KEY]: good });
  snapshotBackup(storeWith);
  storeWith.setItem(BACKUP_KEY, 'nope');
  assert.equal(snapshotBackup(storeWith), false);
  assert.equal(storeWith.getItem(SNAPSHOT_KEY), good);
  assert.equal(readSaveState(storeWith).backup.best, 5);
});

test('no backup means no snapshot either', () => {
  const storeWith = store({ [SAVE_KEY]: good });
  assert.equal(snapshotBackup(storeWith), false);
  assert.equal(storeWith.getItem(SNAPSHOT_KEY), null);
  assert.equal(snapshotBackup(null), false);
});

test('a live valid backup is preferred over the snapshot', () => {
  const storeWith = store({ [BACKUP_KEY]: good, [SNAPSHOT_KEY]: JSON.stringify({ version: 2, best: 9, runs: 1, lastRun: 9 }) });
  const state = readSaveState(storeWith);
  assert.equal(state.fromSnapshot, false);
  assert.equal(state.backup.best, 5);
});

test('a write that the store silently drops is reported, not trusted', () => {
  const lying = {
    getItem: () => good,
    setItem() {},
    removeItem() {},
  };
  const result = writeProgressVerified(lying, { best: 3, runs: 2, lastRun: 3 });
  assert.equal(result.ok, false);
  assert.match(result.message, /could not be verified/);
});
