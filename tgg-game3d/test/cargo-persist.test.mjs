import test from 'node:test';
import assert from 'node:assert/strict';

import {
  claimRoundTrip,
  createCargo,
  loadCrate,
  normalizeCargo,
  nextRun,
  remaining,
  tierOf,
  tierSpec,
} from '../src/cargo.js';
import { createWorldClock } from '../src/worldclock.js';

// A save is a JSON round trip of the record; anything that does not survive it is
// not durable.
const throughDisk = (cargo) => normalizeCargo(JSON.parse(JSON.stringify(cargo)));

function started(tier, crates) {
  const cargo = createCargo(tier);
  for (let i = 0; i < crates; i += 1) loadCrate(cargo);
  cargo.state = 'transit';
  cargo.startedAt = 40;
  return cargo;
}

test('every contract survives a save and reload intact', () => {
  for (const tier of ['standard', 'priority', 'night']) {
    const spec = tierSpec(createCargo(tier));
    const live = started(tier, spec.crates);
    live.damage = 1;
    const restored = throughDisk(live);
    assert.equal(restored.tier, tier, `${tier} lost its tier`);
    assert.equal(restored.state, 'transit');
    assert.equal(restored.crates, spec.crates, `${tier} lost crates`);
    assert.equal(restored.damage, 1, `${tier} lost dent damage`);
    assert.equal(tierOf(restored), tier);
  }
});

test('a return leg and its paid flag survive a reload', () => {
  const cargo = { ...createCargo('night'), state: 'delivered', leg: 'back', crates: 5, rewarded: true, attempts: 4 };
  const restored = throughDisk(cargo);
  assert.equal(restored.leg, 'back');
  assert.equal(restored.state, 'delivered');
  assert.equal(restored.rewarded, true, 'the banked payout flag must survive');
  assert.equal(restored.attempts, 4);
  assert.equal(claimRoundTrip(restored), null, 'a reloaded finished run cannot be paid again');
});

test('a reloaded transit run cannot gain clock it never had', () => {
  const live = started('night', 5);
  // The page reloaded: session time is small again, but startedAt is from the last
  // session.
  assert.equal(remaining(live, 5), 75, 'a resumed run is clamped to the contract clock');
  assert.equal(remaining(live, 40), 75, 'and never exceeds it');
  assert.ok(remaining(live, 60) < 75, 'it still counts down from the resume point');

  // The resume rule: hydrate pins startedAt to the new session clock.
  const resumed = { ...live, startedAt: 5 };
  assert.equal(remaining(resumed, 5), 75);
  assert.equal(remaining(resumed, 25), 55, '20 s later, 55 s remain');
  assert.equal(remaining(resumed, 300), 0, 'the clock still runs out');
});

test('rotation resumes from the saved contract, not from standard', () => {
  const saved = { ...createCargo('night'), state: 'delivered', leg: 'back', rewarded: true, attempts: 7 };
  const restored = throughDisk(saved);
  const next = nextRun(restored);
  assert.equal(next.tier, 'standard', 'night hands back to standard after a reload');
  assert.equal(next.attempts, 8, 'the attempt count keeps counting across a reload');

  assert.equal(nextRun(throughDisk({ ...createCargo('priority'), state: 'delivered' })).tier, 'night');
  assert.equal(nextRun(throughDisk({ ...createCargo('standard'), state: 'delivered' })).tier, 'priority');
});

test('a night handover keeps the dark clock across a reload', () => {
  const store = new Map();
  const storage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
  };
  const clock = createWorldClock({ hour: 9, storage });
  clock.setHour(22);
  assert.equal(clock.save(), true, 'the handover hour must be written');

  const reloaded = createWorldClock({ hour: 9, storage });
  assert.equal(reloaded.load(), true);
  assert.equal(reloaded.hour, 22, 'the night run resumes after dark');
  assert.equal(reloaded.phase, 'night');

  // The clock then runs forward on its own; the contract is not what holds it.
  reloaded.advance(60);
  assert.ok(reloaded.hour > 22 || reloaded.hour < 3, 'the clock keeps moving after a reload');
});
