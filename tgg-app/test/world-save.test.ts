import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_CAREER_BYTES,
  SAVE_VERSION,
  applyClientSave,
  applyRun,
  parseClientSave,
  parseRun,
} from '../src/lib/world/save.ts';

const stored = (over: Partial<Record<string, unknown>> = {}) => ({
  version: SAVE_VERSION,
  revision: 4,
  bestRunMs: 12_500,
  runs: 3,
  career: { cash: 900, vehicle: 'coupe' },
  deviceId: 'device-a',
  ...over,
});

test('accepts a well-formed save', () => {
  const parsed = parseClientSave({ version: 2, revision: 4, bestRunMs: 950, runs: 1, career: { cash: 10 } });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.value.bestRunMs, 950);
  assert.equal(parsed.value.deviceId, null);
});

test('rejects non-object bodies and unknown versions', () => {
  assert.deepEqual(parseClientSave(null), { ok: false, error: 'invalid_body' });
  assert.deepEqual(parseClientSave([1, 2]), { ok: false, error: 'invalid_body' });
  assert.deepEqual(parseClientSave({ version: 99 }), { ok: false, error: 'unsupported_version' });
  assert.deepEqual(parseClientSave({ version: 0 }), { ok: false, error: 'unsupported_version' });
});

test('rejects impossible numbers instead of coercing them', () => {
  assert.deepEqual(parseClientSave({ bestRunMs: -1 }), { ok: false, error: 'invalid_best_run' });
  assert.deepEqual(parseClientSave({ bestRunMs: Number.NaN }), { ok: false, error: 'invalid_best_run' });
  assert.deepEqual(parseClientSave({ bestRunMs: '12' }), { ok: false, error: 'invalid_best_run' });
  assert.deepEqual(parseClientSave({ runs: 1.5 }), { ok: false, error: 'invalid_runs' });
  assert.deepEqual(parseClientSave({ runs: -2 }), { ok: false, error: 'invalid_runs' });
  assert.deepEqual(parseClientSave({ revision: -1 }), { ok: false, error: 'invalid_revision' });
});

test('rejects a career blob that is too large or not an object', () => {
  assert.deepEqual(parseClientSave({ career: 'nope' }), { ok: false, error: 'invalid_career' });
  const big = { blob: 'x'.repeat(MAX_CAREER_BYTES + 1) };
  assert.deepEqual(parseClientSave({ career: big }), { ok: false, error: 'career_too_large' });
});

test('rejects oversized or empty device ids', () => {
  assert.deepEqual(parseClientSave({ deviceId: '' }), { ok: false, error: 'invalid_device' });
  assert.deepEqual(parseClientSave({ deviceId: 'x'.repeat(65) }), { ok: false, error: 'invalid_device' });
  assert.deepEqual(parseClientSave({ deviceId: 7 }), { ok: false, error: 'invalid_device' });
});

test('a fresh save keeps the client numbers and starts revision 1', () => {
  const parsed = parseClientSave({ bestRunMs: 1200, runs: 1, career: { cash: 5 } });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  const applied = applyClientSave(
    { version: 2, revision: 0, bestRunMs: null, runs: 0, career: {}, deviceId: null },
    parsed.value,
  );
  assert.equal(applied.status, 'applied');
  if (applied.status !== 'applied') return;
  assert.equal(applied.next.revision, 1);
  assert.equal(applied.next.bestRunMs, 1200);
  assert.deepEqual(applied.next.career, { cash: 5 });
});

test('a newer best wins, an older one never overwrites it', () => {
  const base = stored();
  const worse = applyClientSave(base, { version: 2, revision: 4, bestRunMs: 30_000, runs: 3, career: {}, deviceId: null });
  assert.equal(worse.status, 'applied');
  if (worse.status === 'applied') assert.equal(worse.next.bestRunMs, 12_500);

  const better = applyClientSave(base, { version: 2, revision: 4, bestRunMs: 900, runs: 4, career: {}, deviceId: null });
  assert.equal(better.status, 'applied');
  if (better.status === 'applied') {
    assert.equal(better.next.bestRunMs, 900);
    assert.equal(better.next.runs, 4);
    assert.equal(better.next.revision, 5);
  }
});

test('a stale revision is refused and reports the authoritative revision', () => {
  const result = applyClientSave(stored(), {
    version: 2, revision: 2, bestRunMs: 500, runs: 9, career: {}, deviceId: null,
  });
  assert.deepEqual(result, { status: 'conflict', storedRevision: 4 });
});

test('runs count never decreases and device id is kept when omitted', () => {
  const result = applyClientSave(stored(), {
    version: 2, revision: 4, bestRunMs: null, runs: 1, career: { cash: 1 }, deviceId: null,
  });
  assert.equal(result.status, 'applied');
  if (result.status !== 'applied') return;
  assert.equal(result.next.runs, 3);
  assert.equal(result.next.bestRunMs, 12_500);
  assert.equal(result.next.deviceId, 'device-a');
});

test('a run id must be a safe token and a duration must be finite', () => {
  assert.deepEqual(parseRun({ runId: 'short', totalMs: 10 }), { ok: false, error: 'invalid_run_id' });
  assert.deepEqual(parseRun({ runId: 'run_12345678', totalMs: -5 }), { ok: false, error: 'invalid_total' });
  assert.deepEqual(parseRun({ runId: 'run 12345678', totalMs: 10 }), { ok: false, error: 'invalid_run_id' });
  const ok = parseRun({ runId: 'run_12345678', totalMs: 950, legs: [800, 150] });
  assert.equal(ok.ok, true);
  if (ok.ok) assert.deepEqual(ok.value.legs, [800, 150]);
});

test('legs must be a short array of finite durations', () => {
  assert.deepEqual(parseRun({ runId: 'run_12345678', totalMs: 10, legs: 'x' }), { ok: false, error: 'invalid_legs' });
  assert.deepEqual(parseRun({ runId: 'run_12345678', totalMs: 10, legs: [1, 2, 3, 4, 5, 6, 7, 8, 9] }), { ok: false, error: 'invalid_legs' });
  assert.deepEqual(parseRun({ runId: 'run_12345678', totalMs: 10, legs: [-1] }), { ok: false, error: 'invalid_legs' });
});

test('applyRun increments the run count and only improves the best', () => {
  const slower = applyRun(stored(), { totalMs: 20_000 });
  assert.equal(slower.runs, 4);
  assert.equal(slower.bestRunMs, 12_500);
  assert.equal(slower.changed, false);

  const faster = applyRun(stored(), { totalMs: 800 });
  assert.equal(faster.bestRunMs, 800);
  assert.equal(faster.changed, true);
  assert.equal(faster.revision, 5);
  assert.deepEqual(faster.career, { cash: 900, vehicle: 'coupe' });
});

test('a save with no previous best adopts the first run', () => {
  const first = applyRun({ version: 2, revision: 1, bestRunMs: null, runs: 0, career: {}, deviceId: null }, { totalMs: 4321 });
  assert.equal(first.bestRunMs, 4321);
  assert.equal(first.runs, 1);
});
