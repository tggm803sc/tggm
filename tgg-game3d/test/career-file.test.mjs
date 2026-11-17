import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CAREER_FILE_KIND,
  SAVE_VERSION,
  defaultProgress,
  exportCareer,
  importCareer,
  mergeRunProgress,
} from '../src/progress.js';

test('an exported career names the game and its format', () => {
  const text = exportCareer({ best: 5, runs: 3, lastRun: 6.25 }, '2026-11-17T00:00:00.000Z');
  const parsed = JSON.parse(text);
  assert.equal(parsed.kind, CAREER_FILE_KIND);
  assert.equal(parsed.format, 1);
  assert.equal(parsed.exportedAt, '2026-11-17T00:00:00.000Z');
  assert.deepEqual(parsed.save, { version: SAVE_VERSION, best: 5, runs: 3, lastRun: 6.25 });
  assert.ok(text.endsWith('\n'));
});

test('an exported career cannot contain junk values', () => {
  const parsed = JSON.parse(exportCareer({ best: -4, runs: 'lots', lastRun: NaN }));
  assert.deepEqual(parsed.save, { version: SAVE_VERSION, best: null, runs: 0, lastRun: null });
});

test('export then import round-trips a career', () => {
  const text = exportCareer({ best: 4.5, runs: 7, lastRun: 5 });
  const result = importCareer(text);
  assert.equal(result.status, 'ok');
  assert.deepEqual(result.progress, { version: SAVE_VERSION, best: 4.5, runs: 7, lastRun: 5 });
});

test('importing merges and never makes the local career worse', () => {
  const current = { best: 4.5, runs: 7, lastRun: 5 };
  const slower = importCareer(exportCareer({ best: 9, runs: 2, lastRun: 8 }), { current });
  assert.equal(slower.status, 'ok');
  assert.deepEqual(slower.progress, { version: SAVE_VERSION, best: 4.5, runs: 7, lastRun: 8 });

  const faster = importCareer(exportCareer({ best: 3, runs: 1, lastRun: 3 }), { current });
  assert.deepEqual(faster.progress, { version: SAVE_VERSION, best: 3, runs: 7, lastRun: 3 });
});

test('import refuses anything that is not a TGG World career', () => {
  assert.deepEqual(importCareer(''), { status: 'empty' });
  assert.deepEqual(importCareer('   '), { status: 'empty' });
  assert.deepEqual(importCareer('not json'), { status: 'invalid', reason: 'not_json' });
  assert.deepEqual(importCareer('[1,2]'), { status: 'invalid', reason: 'not_an_object' });
  assert.deepEqual(
    importCareer(JSON.stringify({ kind: 'something-else', save: {} })),
    { status: 'invalid', reason: 'wrong_kind' },
  );
  assert.deepEqual(
    importCareer(JSON.stringify({ kind: CAREER_FILE_KIND })),
    { status: 'invalid', reason: 'missing_save' },
  );
  assert.deepEqual(
    importCareer(JSON.stringify({ kind: CAREER_FILE_KIND, save: { best: 'fast' } })),
    { status: 'invalid', reason: 'invalid_save' },
  );
});

test('an empty career file is reported as empty rather than applied', () => {
  const text = JSON.stringify({ kind: CAREER_FILE_KIND, save: { version: SAVE_VERSION, best: null, runs: 0 } });
  assert.deepEqual(importCareer(text), { status: 'empty' });
});

test('a career from a newer build is not adopted', () => {
  const text = JSON.stringify({
    kind: CAREER_FILE_KIND,
    save: { version: SAVE_VERSION + 5, best: 1, runs: 40, lastRun: 1 },
  });
  const result = importCareer(text);
  assert.equal(result.status, 'newer');
  assert.equal(result.progress.best, 1);
});

test('a default career exports as an empty file', () => {
  assert.equal(importCareer(exportCareer(defaultProgress())).status, 'empty');
});

test('exporting after a run keeps the faster best', () => {
  const after = mergeRunProgress({ best: 5, runs: 1, lastRun: 6 }, 4);
  const round = importCareer(exportCareer(after));
  assert.equal(round.progress.best, 4);
  assert.equal(round.progress.runs, 2);
});
