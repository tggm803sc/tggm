// The round trip is the unit of pay: outbound delivery opens the return leg and
// only the return unload can claim, once.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CRATES,
  ROUND_TRIP_REWARD,
  bayAction,
  claimRoundTrip,
  createCargo,
  deliverCargo,
  depart,
  failCargo,
  loadCrate,
  normalizeCargo,
  returnLeg,
} from '../src/cargo.js';
import { awardContract, createCareer, levelFor, normalizeCareer, xpToNextLevel } from '../src/career.js';

const fill = (cargo) => {
  for (let i = 0; i < CRATES; i += 1) loadCrate(cargo);
};

const roundTripUpToReturn = () => {
  const cargo = createCargo();
  fill(cargo);
  depart(cargo, 0);
  deliverCargo(cargo, 10);
  returnLeg(cargo);
  fill(cargo);
  depart(cargo, 20);
  deliverCargo(cargo, 60);
  return cargo;
};

test('the outbound drop opens the return leg instead of ending the job', () => {
  const cargo = createCargo();
  fill(cargo);
  depart(cargo, 0);
  deliverCargo(cargo, 10);
  assert.equal(cargo.leg, 'out');
  assert.equal(claimRoundTrip(cargo), null, 'the outbound drop paid');
  assert.equal(returnLeg(cargo), true);
  assert.equal(cargo.state, 'idle');
  assert.equal(cargo.leg, 'back');
  assert.equal(cargo.crates, 0);
  assert.equal(cargo.damage, 0);
});

test('return freight loads and unloads at the apron', () => {
  const cargo = createCargo();
  fill(cargo);
  depart(cargo, 0);
  deliverCargo(cargo, 10);
  returnLeg(cargo);
  fill(cargo);
  assert.equal(cargo.state, 'loaded');
  depart(cargo, 20);
  assert.equal(cargo.state, 'transit');
  assert.equal(deliverCargo(cargo, 60), true);
  assert.equal(cargo.state, 'delivered');
  assert.equal(cargo.leg, 'back');
});

test('the round trip pays exactly once', () => {
  const cargo = roundTripUpToReturn();
  const career = createCareer();
  const reward = claimRoundTrip(cargo);
  assert.deepEqual(reward, ROUND_TRIP_REWARD);
  assert.equal(claimRoundTrip(cargo), null, 'a second claim was allowed');

  const paid = awardContract(career, reward);
  assert.equal(paid.cash, ROUND_TRIP_REWARD.cash);
  assert.equal(paid.xp, ROUND_TRIP_REWARD.xp);
  assert.equal(awardContract(career, claimRoundTrip(cargo)), null);
  assert.equal(career.cash, ROUND_TRIP_REWARD.cash);
  assert.equal(career.xp, ROUND_TRIP_REWARD.xp);
  assert.equal(career.contracts, 1);
});

test('a reload during the return keeps leg and paid flag', () => {
  const cargo = roundTripUpToReturn();
  claimRoundTrip(cargo);
  const restored = normalizeCargo(JSON.parse(JSON.stringify(cargo)));
  assert.equal(restored.leg, 'back');
  assert.equal(restored.state, 'delivered');
  assert.equal(restored.rewarded, true);
  assert.equal(claimRoundTrip(restored), null, 'a reload paid the trip again');
});

test('an unpaid reload still claims once', () => {
  const cargo = roundTripUpToReturn();
  const restored = normalizeCargo(JSON.parse(JSON.stringify(cargo)));
  assert.equal(restored.rewarded, false);
  assert.ok(claimRoundTrip(restored));
  assert.equal(claimRoundTrip(restored), null);
});

test('a third leg stays refused', () => {
  const cargo = roundTripUpToReturn();
  assert.equal(returnLeg(cargo), false);
});

test('a completed run is a no-op at the bay', () => {
  const cargo = roundTripUpToReturn();
  assert.equal(cargo.state, 'delivered');
  assert.equal(bayAction(cargo), 'none', 'a delivered run offered to reload');
  assert.ok(claimRoundTrip(cargo), 'the finished trip should pay exactly once');
  assert.equal(bayAction(cargo), 'none', 'pressing again still offers nothing');
  assert.equal(claimRoundTrip(cargo), null, 'a later press must not re-claim');
});

test('a failed run reloads, an empty one loads', () => {
  const failed = createCargo();
  fill(failed);
  depart(failed, 0);
  failCargo(failed, 95, 'time');
  assert.equal(bayAction(failed), 'reload');
  assert.equal(bayAction(createCargo()), 'load');

  const inTransit = createCargo();
  fill(inTransit);
  depart(inTransit, 0);
  assert.equal(bayAction(inTransit), 'none');
});

test('career levels climb with xp', () => {
  assert.equal(levelFor(0), 1);
  assert.ok(levelFor(1000) > levelFor(0));
  assert.ok(xpToNextLevel(0) > 0);
  const career = normalizeCareer({ cash: 100, xp: 500, contracts: 2.7 });
  assert.equal(career.cash, 100);
  assert.equal(career.contracts, 2, 'contracts were not floored');
  assert.ok(career.level >= 1);
});
