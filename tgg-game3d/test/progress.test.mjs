import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SAVE_VERSION,
  defaultProgress,
  parseProgress,
  serializeProgress,
  mergeRunProgress,
  formatTime,
} from '../src/progress.js';

test('empty or missing payload is reported as empty, not an error', () => {
  for (const raw of ['', '   ', null, undefined, 12]) {
    const { progress, status } = parseProgress(raw);
    assert.equal(status, 'empty');
    assert.deepEqual(progress, defaultProgress());
  }
});

test('a v1 save migrates and keeps its best and run count', () => {
  const { progress, status } = parseProgress(JSON.stringify({ best: 91.5, runs: 4 }));
  assert.equal(status, 'migrated');
  assert.equal(progress.version, SAVE_VERSION);
  assert.equal(progress.best, 91.5);
  assert.equal(progress.runs, 4);
  assert.equal(progress.lastRun, null);
});

test('a current-version save loads as ok', () => {
  const raw = JSON.stringify({ version: SAVE_VERSION, best: 30, runs: 2, lastRun: 33 });
  const { progress, status } = parseProgress(raw);
  assert.equal(status, 'ok');
  assert.deepEqual(progress, { version: SAVE_VERSION, best: 30, runs: 2, lastRun: 33 });
});

test('corrupt JSON is reported and never throws', () => {
  const { progress, status } = parseProgress('{"best": 12, "runs": ');
  assert.equal(status, 'corrupt');
  assert.deepEqual(progress, defaultProgress());
});

test('non-object payloads count as corrupt', () => {
  for (const raw of ['[]', '"text"', '42', 'null', 'true']) {
    assert.equal(parseProgress(raw).status, 'corrupt', raw);
  }
});

test('a save from a newer build is readable but flagged', () => {
  const { progress, status } = parseProgress(
    JSON.stringify({ version: SAVE_VERSION + 3, best: 12, runs: 9, lastRun: 12 }),
  );
  assert.equal(status, 'newer');
  assert.equal(progress.best, 12);
  assert.equal(progress.runs, 9);
});

test('invalid fields fall back without losing the valid ones', () => {
  const { progress, status } = parseProgress(
    JSON.stringify({ version: 2, best: -5, runs: 'many', lastRun: Number.POSITIVE_INFINITY }),
  );
  assert.equal(status, 'ok');
  assert.equal(progress.best, null);
  assert.equal(progress.runs, 0);
  assert.equal(progress.lastRun, null);
});

test('merging a faster run replaces the best and counts the run', () => {
  const before = { version: SAVE_VERSION, best: 40, runs: 2, lastRun: 44 };
  const after = mergeRunProgress(before, 31.2);
  assert.equal(after.best, 31.2);
  assert.equal(after.runs, 3);
  assert.equal(after.lastRun, 31.2);
});

test('merging a slower run keeps the best but still records the run', () => {
  const before = { version: SAVE_VERSION, best: 30, runs: 2, lastRun: 44 };
  const after = mergeRunProgress(before, 55);
  assert.equal(after.best, 30);
  assert.equal(after.runs, 3);
  assert.equal(after.lastRun, 55);
});

test('an invalid run time counts the run but cannot poison the best', () => {
  const before = { version: SAVE_VERSION, best: 30, runs: 1, lastRun: 30 };
  for (const bad of [0, -3, Number.NaN, Number.POSITIVE_INFINITY, 'fast']) {
    const after = mergeRunProgress(before, bad);
    assert.equal(after.best, 30, String(bad));
    assert.equal(after.runs, 2, String(bad));
    assert.equal(after.lastRun, 30, String(bad));
  }
});

test('merging into missing progress starts a fresh record', () => {
  const after = mergeRunProgress(undefined, 12);
  assert.equal(after.best, 12);
  assert.equal(after.runs, 1);
});

test('serialize then parse round-trips current progress', () => {
  const progress = { version: SAVE_VERSION, best: 12.34, runs: 7, lastRun: 19 };
  const { progress: loaded, status } = parseProgress(serializeProgress(progress));
  assert.equal(status, 'ok');
  assert.deepEqual(loaded, progress);
});

test('formatTime renders minutes and tenths', () => {
  assert.equal(formatTime(0), '0:00.0');
  assert.equal(formatTime(2.25), '0:02.3');
  assert.equal(formatTime(61.04), '1:01.0');
  assert.equal(formatTime(Number.NaN), '0:00.0');
});
