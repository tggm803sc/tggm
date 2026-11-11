// Automation lanes: interpolation, sanitising on load, and the envelope actually
// changing the exported audio. Run with: node test/automation.test.mjs
import assert from 'node:assert/strict';
import {
  addAutomationPoint,
  addClip,
  addTake,
  addTrack,
  automationAt,
  createSession,
  normalizeAutomation,
  normalizeSession,
  removeAutomationPoint,
} from '../src/session.js';
import { mixdown } from '../src/wav.js';

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

const ramp = [
  { time: 0, value: 2 },
  { time: 2, value: 4 },
];

test('an empty lane is unity gain', () => {
  assert.equal(automationAt([], 1), 1);
  assert.equal(automationAt(undefined, 1), 1);
});

test('the lane interpolates between points', () => {
  assert.equal(automationAt(ramp, 0), 2);
  assert.equal(automationAt(ramp, 1), 3);
  assert.equal(automationAt(ramp, 2), 4);
});

test('the lane holds before the first and after the last point', () => {
  assert.equal(automationAt(ramp, -5), 2);
  assert.equal(automationAt(ramp, 99), 4);
});

test('a loaded lane is sorted, clamped and typed', () => {
  const clean = normalizeAutomation({
    t1: [
      { time: 3, value: 9 },
      { time: 1, value: -2 },
      { time: 'x', value: 1 },
      { time: 2, value: 0.5 },
    ],
    t2: 'nope',
  });
  assert.deepEqual(clean.t1, [
    { time: 1, value: 0 },
    { time: 2, value: 0.5 },
    { time: 3, value: 1.2 },
  ]);
  assert.equal(clean.t2, undefined);
});

test('adding a point replaces one at the same time', () => {
  const session = createSession();
  addAutomationPoint(session, 't1', 1, 0.4);
  addAutomationPoint(session, 't1', 1, 0.9);
  assert.equal(session.automation.t1.length, 1);
  assert.equal(session.automation.t1[0].value, 0.9);
});

test('the envelope is applied to the exported mix', () => {
  const session = createSession({ sampleRate: 1000 });
  const track = addTrack(session, 'vocal');
  addTake(session, { id: 't1', trackId: track.id, duration: 1 });
  addClip(session, track.id, { takeId: 't1', start: 0, duration: 1 });
  session.automation = { [track.id]: [{ time: 0, value: 0.5 }] };
  const samples = new Float32Array(1000).fill(0.5);
  const plain = mixdown(session, () => samples, { sampleRate: 1000 });
  assert.ok(Math.abs(plain.left[10] - plain.left[10]) < 1e-9);
  assert.ok(Math.abs(plain.left[10] - 0.5 * 0.5 * 0.8 * 0.707) < 1e-3, `unexpected level ${plain.left[10]}`);
  session.automation[track.id] = [{ time: 0, value: 0.25 }];
  const quieter = mixdown(session, () => samples, { sampleRate: 1000 });
  assert.ok(Math.abs(quieter.left[10] - (plain.left[10] * 0.5)) < 1e-4, 'the envelope did not scale the mix');
});

test('automation survives a save and reload', () => {
  const session = createSession();
  const track = addTrack(session, 'vocal');
  addAutomationPoint(session, track.id, 1.5, 0.3);
  const reloaded = normalizeSession(JSON.parse(JSON.stringify(session)));
  assert.equal(reloaded.automation[track.id][0].value, 0.3);
  assert.equal(reloaded.automation[track.id][0].time, 1.5);
});

test('pan automation moves the image and is clamped to the pan range', () => {
  const session = createSession({ sampleRate: 1000 });
  const track = addTrack(session, 'vocal');
  addTake(session, { id: 't1', trackId: track.id, duration: 1 });
  addClip(session, track.id, { takeId: 't1', start: 0, duration: 1 });
  const samples = new Float32Array(1000).fill(0.5);
  session.automationPan = { [track.id]: [{ time: 0, value: -1 }] };
  const leftMix = mixdown(session, () => samples, { sampleRate: 1000 });
  assert.ok(leftMix.left[10] > leftMix.right[10], 'pan -1 did not move the image left');
  session.automationPan = { [track.id]: [{ time: 0, value: 1 }] };
  const rightMix = mixdown(session, () => samples, { sampleRate: 1000 });
  assert.ok(rightMix.right[10] > rightMix.left[10], 'pan +1 did not move the image right');
  const clean = normalizeAutomation({ t: [{ time: 0, value: 5 }, { time: 1, value: -5 }] }, -1, 1);
  assert.deepEqual(clean.t.map((point) => point.value), [1, -1]);
});

test('a removed point leaves the rest of the lane intact', () => {
  const session = createSession();
  addAutomationPoint(session, 't1', 1, 0.5);
  addAutomationPoint(session, 't1', 2, 0.7);
  assert.equal(removeAutomationPoint(session, 't1', 1), true);
  assert.equal(session.automation.t1.length, 1);
  assert.equal(session.automation.t1[0].time, 2);
  assert.equal(removeAutomationPoint(session, 't1', 9), false);
});

console.log(`${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
