// World clock: progression, sunrise/sunset, lighting values and the saved hour.
// Run with: node test/worldclock.test.mjs
import assert from 'node:assert/strict';
import { createWorldClock, lookAt, phaseAt } from '../src/worldclock.js';

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

test('time advances at the configured rate and wraps at midnight', () => {
  const clock = createWorldClock({ hour: 23.5, speed: 1 });
  clock.advance(1);
  assert.ok(Math.abs(clock.hour - 0.5) < 1e-9, `expected 00:30, got ${clock.hour}`);
});

test('a paused clock does not advance', () => {
  const clock = createWorldClock({ hour: 9, speed: 0 });
  clock.advance(600);
  assert.equal(clock.hour, 9);
});

test('the sun is up at noon and down at midnight', () => {
  const noon = lookAt(12);
  const midnight = lookAt(0);
  assert.ok(noon.sunY > 200, 'the sun was not overhead at noon');
  assert.equal(noon.sunIntensity, 3.4);
  assert.equal(midnight.sunIntensity, 0);
  assert.ok(midnight.sunY < 0, 'the sun was above the horizon at midnight');
  assert.ok(midnight.moonIntensity > 0.8);
});

test('sunrise and sunset are warm, not cold', () => {
  const dawn = lookAt(6);
  const dusk = lookAt(18);
  const red = (hex) => (hex >> 16) & 0xff;
  const blue = (hex) => hex & 0xff;
  assert.ok(red(dawn.sky) > blue(dawn.sky), 'sunrise sky is not warm');
  assert.ok(red(dusk.sky) > blue(dusk.sky), 'sunset sky is not warm');
  assert.equal(phaseAt(6), 'sunrise');
  assert.equal(phaseAt(18), 'sunset');
});

test('daylight is brighter and clearer than night', () => {
  const day = lookAt(12);
  const night = lookAt(0);
  const luminance = (hex) => ((hex >> 16) & 0xff) + ((hex >> 8) & 0xff) + (hex & 0xff);
  assert.ok(luminance(day.sky) > luminance(night.sky) * 4, 'the day sky is not brighter');
  assert.ok(day.fogDensity < night.fogDensity, 'daytime fog is not thinner');
  assert.ok(day.exposure > night.exposure, 'the day is not exposed brighter');
});

test('stars fade out in daylight and lights come on at night', () => {
  assert.equal(lookAt(12).stars, 0);
  assert.equal(lookAt(0).stars, 1);
  assert.equal(lookAt(0).lights, 1);
  assert.equal(lookAt(12).lights, 0);
});

test('the world time and rate survive a save and reload', () => {
  const store = new Map();
  const storage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, value),
  };
  const clock = createWorldClock({ hour: 17.25, speed: 0.5, storage });
  assert.equal(clock.save(), true);
  const reloaded = createWorldClock({ storage });
  assert.equal(reloaded.load(), true);
  assert.ok(Math.abs(reloaded.hour - 17.25) < 1e-9);
  assert.equal(reloaded.speed, 0.5);
});

test('a fresh world starts in the morning, not at night', () => {
  const clock = createWorldClock();
  assert.equal(clock.hour, 9);
  assert.equal(clock.phase, 'day');
  assert.ok(lookAt(9).sunIntensity > 1.2, 'the morning sun is too weak');
  assert.ok(lookAt(9).sunY > 120, 'the sun is too low at 09:00');
  assert.ok(lookAt(9).lights < 0.5, 'street lights are still fully on in the morning');
});

test('an old night-time save cannot pin the world to night', () => {
  const store = new Map([['tgg.worldclock.v1', JSON.stringify({ hour: 22.5, speed: 0 })]]);
  let removed = null;
  const storage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, value),
    removeItem: (key) => {
      removed = key;
      store.delete(key);
    },
  };
  const clock = createWorldClock({ storage });
  assert.equal(clock.load(), false, 'the legacy entry was treated as a current save');
  assert.equal(clock.hour, 9);
  assert.equal(removed, 'tgg.worldclock.v1');
  assert.equal(store.has('tgg.worldclock.v1'), false);
});

test('a corrupt save is ignored instead of breaking the clock', () => {
  const storage = { getItem: () => '{not json', setItem: () => {} };
  const clock = createWorldClock({ hour: 8, storage });
  assert.equal(clock.load(), false);
  assert.equal(clock.hour, 8);
});

console.log(`${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
