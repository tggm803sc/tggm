import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ROTATION,
  TIERS,
  bayAction,
  cargoLabel,
  claimRoundTrip,
  createCargo,
  damageCargo,
  damageLimit,
  crateQuota,
  loadCrate,
  normalizeCargo,
  nextRun,
  reloadCargo,
  remaining,
  tierOf,
  tierSpec,
} from '../src/cargo.js';

function finished(tier) {
  return { ...createCargo(tier), state: 'delivered', crates: TIERS[tier].crates, leg: 'back', rewarded: false, attempts: 2 };
}

test('a contract carries its own crates, clock, drop and payout', () => {
  const standard = tierSpec(createCargo());
  assert.equal(standard.crates, 3);
  assert.equal(standard.seconds, 90);
  assert.equal(standard.drop, 'The Vault');
  assert.deepEqual(standard.reward, { cash: 850, xp: 120 });

  const priority = tierSpec(createCargo('priority'));
  assert.equal(priority.crates, 4);
  assert.equal(priority.seconds, 110);
  assert.equal(priority.drop, 'Studio 808');
  assert.deepEqual(priority.reward, { cash: 1300, xp: 180 });

  const night = tierSpec(createCargo('night'));
  assert.equal(night.crates, 5);
  assert.equal(night.seconds, 75, 'the night run is the tight clock');
  assert.equal(night.drop, 'The Vault');
  assert.deepEqual(night.reward, { cash: 1600, xp: 220 });
  for (const other of [TIERS.standard, TIERS.priority]) {
    assert.ok(night.seconds < other.seconds, 'night is tighter than every other contract');
  }
});

test('the priority contract needs its own fourth crate before the van rolls', () => {
  const cargo = createCargo('priority');
  const presses = [];
  for (let i = 0; i < 4; i += 1) presses.push(loadCrate(cargo));
  assert.deepEqual(
    presses.map((press) => [press.crate, press.crates, press.ready]),
    [
      [1, 4, false],
      [2, 4, false],
      [3, 4, false],
      [4, 4, true],
    ],
  );
  assert.equal(cargo.state, 'loaded');
  assert.equal(loadCrate(cargo), null, 'a full van refuses a fifth crate');
  assert.equal(crateQuota(cargo), 4);
});

test('the priority clock is its own length, not the standard one', () => {
  const cargo = { ...createCargo('priority'), state: 'transit', startedAt: 100 };
  assert.equal(remaining(cargo, 100), 110);
  assert.equal(remaining(cargo, 160), 50, '110s contract still has 50s at t+60');
  assert.equal(remaining({ ...createCargo(), state: 'transit', startedAt: 0 }, 60), 30);
});

test('each contract pays its own rate, once', () => {
  const standard = finished('standard');
  assert.deepEqual(claimRoundTrip(standard), { cash: 850, xp: 120 });
  assert.equal(claimRoundTrip(standard), null, 'the payout is one-way');

  const priority = finished('priority');
  assert.deepEqual(claimRoundTrip(priority), { cash: 1300, xp: 180 });
  assert.equal(priority.rewarded, true);
  assert.equal(claimRoundTrip(priority), null);
});

test('dispatch works through the contracts in order and wraps around', () => {
  assert.deepEqual(ROTATION, ['standard', 'priority', 'night']);
  const first = nextRun(finished('standard'));
  assert.equal(first.tier, 'priority', 'a standard run opens the priority contract');
  assert.equal(first.state, 'idle');
  assert.equal(first.attempts, 3);
  assert.equal(bayAction(first), 'load');

  const second = nextRun(finished('priority'));
  assert.equal(second.tier, 'night', 'priority hands over to the night run');
  assert.equal(second.attempts, 3);

  const third = nextRun(finished('night'));
  assert.equal(third.tier, 'standard', 'the night run wraps back to standard');
  assert.equal(third.attempts, 3);
  assert.equal(third.crates, 0);
});

test('the tier is part of the job, so a reload keeps it and a bad save falls back', () => {
  const failed = { ...createCargo('priority'), state: 'failed', crates: 2, attempts: 1 };
  const reloaded = reloadCargo(failed);
  assert.equal(reloaded.tier, 'priority', 'a failed priority run reloads as priority');
  assert.equal(reloaded.attempts, 1);
  assert.equal(reloaded.state, 'idle');

  assert.equal(normalizeCargo({ tier: 'priority' }).tier, 'priority');
  assert.equal(normalizeCargo({ tier: 'charter' }).tier, 'standard', 'an unknown tier is standard');
  assert.equal(normalizeCargo(null).tier, 'standard');
  assert.equal(normalizeCargo({ tier: 'charter', crates: 9 }).crates, 3, 'crates clamp to the tier quota');
  assert.equal(normalizeCargo({ tier: 'priority', crates: 9 }).crates, 4);
  assert.equal(tierOf({}), 'standard');
});

test('the night shift tolerates one dent, the day runs tolerate two', () => {
  const night = { ...createCargo('night'), state: 'transit', crates: 5 };
  assert.equal(damageLimit(night), 1);
  assert.deepEqual(damageCargo(night), { damage: 1, failed: false }, 'one dent survives');
  assert.deepEqual(damageCargo(night), { damage: 2, failed: true }, 'a second dent writes it off');

  const standard = { ...createCargo(), state: 'transit', crates: 3 };
  assert.equal(damageLimit(standard), 2);
  assert.equal(damageCargo(standard).failed, false);
  assert.equal(damageCargo(standard).failed, false, 'two dents still roll');
  assert.equal(damageCargo(standard).failed, true, 'the third ends it');

  const freshNight = { ...createCargo('night'), state: 'transit', crates: 5 };
  assert.match(cargoLabel(freshNight), /0\/1 dents/, 'the chip shows the contract limit');
  assert.match(cargoLabel({ ...createCargo(), state: 'transit' }), /0\/2 dents/);
});

test('the chip names the dock the player is actually loading at', () => {
  const back = { ...createCargo('priority'), state: 'idle', leg: 'back' };
  assert.match(cargoLabel(back), /Studio 808/, 'an idle return leg loads at the drop');
  assert.doesNotMatch(cargoLabel(back), /load at Salt Flats/);

  const out = { ...createCargo('priority'), state: 'idle', leg: 'out' };
  assert.match(cargoLabel(out), /Salt Flats/, 'the outbound run starts at the apron');
  assert.match(cargoLabel({ ...createCargo('priority'), state: 'transit', crates: 2 }), /PRIORITY · CARGO 2\/4/);
  assert.match(cargoLabel({ ...createCargo(), state: 'loaded' }), /drive to The Vault/);
});
