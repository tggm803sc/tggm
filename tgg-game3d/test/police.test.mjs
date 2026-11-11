// The police unit, headless. Run with: node test/police.test.mjs
import assert from 'node:assert/strict';
import { Police } from '../src/police.js';
import { HALF } from '../src/city.js';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`ok ${passed} — ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL — ${name}`);
    console.error(`       ${error.message}`);
  }
}

test('alert spawns a visible unit well away from the player', () => {
  const police = new Police();
  police.alert(34, 60);
  assert.equal(police.active, true);
  assert.equal(police.group.visible, true);
  const distance = Math.hypot(police.pos.x - 34, police.pos.z - 60);
  assert.ok(distance > 40, `spawned ${distance.toFixed(1)} m away, which is an instant bust`);
  assert.ok(Math.abs(police.pos.x) < HALF, 'spawn x is outside the city');
  assert.ok(Math.abs(police.pos.z) < HALF, 'spawn z is outside the city');
});

test('the unit never spawns on the player at a map corner', () => {
  const police = new Police();
  for (const [x, z] of [
    [HALF - 20, HALF - 20],
    [-(HALF - 20), HALF - 20],
    [HALF - 20, -(HALF - 20)],
    [-(HALF - 20), -(HALF - 20)],
  ]) {
    police.alert(x, z);
    const distance = Math.hypot(police.pos.x - x, police.pos.z - z);
    assert.ok(distance > 30, `corner spawn was ${distance.toFixed(1)} m from the player`);
  }
});

test('update closes the distance and stays inside the city', () => {
  const police = new Police();
  police.alert(34, 60);
  const before = police.distance;
  for (let i = 0; i < 120; i += 1) police.update(0.05, { x: 34, z: 60 });
  assert.ok(police.distance < before, 'the unit did not close in');
  assert.ok(Math.abs(police.pos.x) <= HALF - 11.9, 'the unit left the city on x');
  assert.ok(Math.abs(police.pos.z) <= HALF - 11.9, 'the unit left the city on z');
});

test('the unit gives up beyond the 300 m leash', () => {
  const police = new Police();
  police.alert(0, 0);
  police.pos.set(0, 0, 0);
  police.update(0.05, { x: 600, z: 600 });
  assert.equal(police.active, false);
  assert.equal(police.group.visible, false);
  assert.equal(police.distance, Infinity);
});

test('stop clears the pursuit completely', () => {
  const police = new Police();
  police.alert(10, 10);
  police.stop();
  assert.equal(police.active, false);
  assert.equal(police.group.visible, false);
  assert.equal(police.distance, Infinity);
});

console.log(`${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
