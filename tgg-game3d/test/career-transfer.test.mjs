import test from 'node:test';
import assert from 'node:assert/strict';
import {
  careerFileName,
  describeImport,
  exportStoredCareer,
  importStoredCareer,
  readStoredCareer,
  writeStoredCareer,
} from '../src/career-transfer.js';
import { BACKUP_KEY, SAVE_KEY, exportCareer } from '../src/progress.js';

function memoryStore(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
    dump: () => Object.fromEntries(data),
  };
}

function blockedStore() {
  return {
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
}

test('the file name is dated, sortable and has no unsafe characters', () => {
  const name = careerFileName({ best: 4.25 }, new Date('2026-11-17T13:05:09.000Z'));
  assert.equal(name, 'tgg-world-career-2026-11-17-13-05-09-best-4_3s.json');
  assert.match(name, /^[A-Za-z0-9._-]+$/);
  assert.equal(careerFileName({ best: null }, new Date('2026-11-17T00:00:00.000Z')), 'tgg-world-career-2026-11-17-00-00-00-new.json');
  assert.match(careerFileName({ best: 3 }, new Date('not a date')), /\.json$/);
});

test('messages explain every import outcome', () => {
  assert.match(describeImport({ status: 'ok', progress: { best: 65.5, runs: 3 } }).message, /1:05\.5 · 3 runs/);
  assert.equal(describeImport({ status: 'empty' }).tone, 'warn');
  assert.equal(describeImport({ status: 'newer' }).tone, 'warn');
  assert.match(describeImport({ status: 'invalid', reason: 'wrong_kind' }).message, /wrong_kind/);
  assert.equal(describeImport(null).tone, 'error');
});

test('an empty device exports a valid but empty career file', () => {
  const store = memoryStore();
  const result = exportStoredCareer(store, new Date('2026-11-17T10:00:00.000Z'));
  assert.equal(result.status, 'ok');
  assert.equal(result.empty, true);
  assert.equal(JSON.parse(result.text).kind, 'tgg-world-career');
  assert.match(result.filename, /-new\.json$/);
});

test('importing a better career merges it and keeps the previous one as backup', () => {
  const local = JSON.stringify({ version: 2, best: 9, runs: 2, lastRun: 9 });
  const store = memoryStore({ [SAVE_KEY]: local });
  const incoming = exportCareer({ best: 5, runs: 6, lastRun: 6 });

  const result = importStoredCareer(store, incoming);
  assert.equal(result.status, 'ok');
  assert.equal(result.changed, true);
  assert.deepEqual(JSON.parse(store.getItem(SAVE_KEY)), { version: 2, best: 5, runs: 6, lastRun: 6 });
  assert.equal(store.getItem(BACKUP_KEY), local);
  assert.match(result.message, /previous career kept as backup/);
});

test('a strictly worse career changes nothing and says so', () => {
  const store = memoryStore({ [SAVE_KEY]: JSON.stringify({ version: 2, best: 4, runs: 9, lastRun: 4 }) });
  const result = importStoredCareer(store, exportCareer({ best: 12, runs: 1, lastRun: 4 }));
  assert.equal(result.changed, false);
  assert.equal(result.tone, 'warn');
  assert.match(result.message, /already on this device/);
  assert.equal(JSON.parse(store.getItem(SAVE_KEY)).best, 4);
});

test('a career that only adds a newer last run still merges', () => {
  const store = memoryStore({ [SAVE_KEY]: JSON.stringify({ version: 2, best: 4, runs: 9, lastRun: 4 }) });
  const result = importStoredCareer(store, exportCareer({ best: 12, runs: 1, lastRun: 6 }));
  assert.equal(result.changed, true);
  assert.deepEqual(JSON.parse(store.getItem(SAVE_KEY)), { version: 2, best: 4, runs: 9, lastRun: 6 });
});

test('a malformed file never touches the stored career', () => {
  const local = JSON.stringify({ version: 2, best: 7, runs: 1, lastRun: 7 });
  const store = memoryStore({ [SAVE_KEY]: local });
  for (const bad of ['', '{oops', '[]', JSON.stringify({ kind: 'nope' }), JSON.stringify({ kind: 'tgg-world-career' })]) {
    const result = importStoredCareer(store, bad);
    assert.notEqual(result.status, 'ok');
    assert.equal(result.changed, false);
    assert.equal(store.getItem(SAVE_KEY), local);
    assert.equal(store.getItem(BACKUP_KEY), null);
  }
});

test('a career from a newer build is refused and the save is untouched', () => {
  const local = JSON.stringify({ version: 2, best: 7, runs: 1, lastRun: 7 });
  const store = memoryStore({ [SAVE_KEY]: local });
  const newer = JSON.stringify({
    kind: 'tgg-world-career',
    save: { version: 99, best: 1, runs: 40, lastRun: 1 },
  });
  const result = importStoredCareer(store, newer);
  assert.equal(result.status, 'newer');
  assert.equal(result.changed, false);
  assert.equal(store.getItem(SAVE_KEY), local);
});

test('a blocked or full browser storage is reported, not thrown', () => {
  const result = importStoredCareer(blockedStore(), exportCareer({ best: 5, runs: 1, lastRun: 5 }));
  assert.equal(result.status, 'unavailable');
  assert.equal(result.changed, false);
  assert.match(result.message, /Storage is not available/);
  assert.equal(readStoredCareer(blockedStore()).status, 'unavailable');
  assert.equal(readStoredCareer(null).status, 'unavailable');
  assert.equal(writeStoredCareer(null, { best: 1 }), false);
});

test('a valid file is not applied when the browser refuses to write it', () => {
  const store = {
    getItem: () => JSON.stringify({ version: 2, best: 9, runs: 1, lastRun: 9 }),
    setItem() {
      throw new Error('quota');
    },
    removeItem() {},
  };
  const result = importStoredCareer(store, exportCareer({ best: 5, runs: 3, lastRun: 5 }));
  assert.equal(result.status, 'ok');
  assert.equal(result.changed, false);
  assert.equal(result.tone, 'error');
  assert.match(result.message, /refused to save/);
});
