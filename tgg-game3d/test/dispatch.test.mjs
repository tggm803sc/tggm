import test from 'node:test';
import assert from 'node:assert/strict';

import { bayAction, claimRoundTrip, createCargo, nextRun } from '../src/cargo.js';

const normalizeCargoShallow = (cargo) => ({ ...cargo });

function delivered(overrides = {}) {
  return { ...createCargo(), state: 'delivered', crates: 3, leg: 'back', rewarded: true, attempts: 3, ...overrides };
}

test('dispatch opens a fresh contract from a finished run', () => {
  const done = delivered();
  const next = nextRun(done);
  assert.ok(next, 'a delivered run should produce the next contract');
  assert.equal(next.state, 'idle');
  assert.equal(next.crates, 0);
  assert.equal(next.leg, 'out');
  assert.equal(next.rewarded, false);
  assert.equal(next.attempts, 4, 'the attempt count carries forward');
  assert.equal(bayAction(next), 'load', 'the new contract can load at the bay');
});

test('a new contract is the fix for the completed dead end', () => {
  const done = delivered();
  assert.equal(bayAction(done), 'none', 'a delivered run is still inert at the bay');
  assert.equal(bayAction(nextRun(done)), 'load', 'and dispatch is the way out of it');
});

test('dispatch does not re-open a finished record in place', () => {
  const done = delivered();
  const next = nextRun(done);
  assert.notEqual(next, done);
  assert.equal(done.state, 'delivered', 'the old record is untouched');
  assert.equal(normalizeCargoShallow(next).rewarded, false);
  assert.equal(claimRoundTrip(done), null, 'the finished record must never pay twice');
});

test('dispatch refuses every state except delivered', () => {
  for (const state of ['idle', 'loading', 'loaded', 'transit', 'failed']) {
    assert.equal(nextRun({ ...createCargo(), state }), null, `${state} opened a contract`);
  }
  assert.equal(nextRun(null), null);
  assert.equal(nextRun(undefined), null);
});
