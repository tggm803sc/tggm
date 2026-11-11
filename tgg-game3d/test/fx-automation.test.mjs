// FX automation: parameter lanes, bounds, persistence and the exported samples.
// Run with: node test/fx-automation.test.mjs
import assert from 'node:assert/strict';
import {
  addClip,
  addFxAutomationPoint,
  addTake,
  addTrack,
  createSession,
  fxParamAt,
  normalizeSession,
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

const RATE = 48000;

function sine(hz, amplitude, seconds = 1) {
  const length = Math.floor(RATE * seconds);
  const out = new Float32Array(length);
  for (let i = 0; i < length; i += 1) out[i] = Math.sin((2 * Math.PI * hz * i) / RATE) * amplitude;
  return out;
}

function sessionWith(fx, amplitude = 0.6) {
  const session = createSession({ sampleRate: RATE });
  const track = addTrack(session, 'vocal');
  addTake(session, { id: 'take', trackId: track.id, duration: 1 });
  addClip(session, track.id, { takeId: 'take', start: 0, duration: 1 });
  track.fx = fx;
  const samples = sine(220, amplitude);
  return { session, track, read: () => samples };
}

const OFF = { enabled: true, eqLow: 0, eqMid: 0, eqHigh: 0, compThreshold: 0, compRatio: 1, gate: -80, saturation: 0 };
const rms = (channel) => {
  let sum = 0;
  for (const value of channel) sum += value * value;
  return Math.sqrt(sum / channel.length);
};

test('an FX lane interpolates and clamps to the parameter range', () => {
  const session = createSession();
  addFxAutomationPoint(session, 't1', 'eqLow', 0, -40);
  addFxAutomationPoint(session, 't1', 'eqLow', 2, 40);
  assert.equal(fxParamAt(session, 't1', 'eqLow', 0, 0), -18);
  assert.equal(fxParamAt(session, 't1', 'eqLow', 1, 0), 0);
  assert.equal(fxParamAt(session, 't1', 'eqLow', 2, 0), 18);
});

test('an unknown parameter is refused instead of inventing a lane', () => {
  const session = createSession();
  assert.equal(addFxAutomationPoint(session, 't1', 'makeItLoud', 0, 5), null);
  assert.deepEqual(session.automationFx, {});
});

test('FX automation survives save and reload', () => {
  const session = createSession();
  const track = addTrack(session, 'vocal');
  addFxAutomationPoint(session, track.id, 'saturation', 0.5, 0.8);
  const reloaded = normalizeSession(JSON.parse(JSON.stringify(session)));
  assert.equal(reloaded.automationFx[track.id].saturation[0].value, 0.8);
});

test('automated saturation shapes the second half of the export more than the first', () => {
  const { session, track, read } = sessionWith({ ...OFF });
  addFxAutomationPoint(session, track.id, 'saturation', 0, 0);
  addFxAutomationPoint(session, track.id, 'saturation', 1, 1);
  const mix = mixdown(session, read, { sampleRate: RATE });
  const first = rms(mix.left.subarray(0, RATE / 2));
  const second = rms(mix.left.subarray(RATE / 2));
  assert.ok(second < first * 0.95, `the ramp did not shape the tail (${second} vs ${first})`);
});

test('automated compression tightens the tail of the export', () => {
  // Ratio must be above 1 or the compressor is a no-op regardless of threshold.
  const { session, track, read } = sessionWith({ ...OFF, compRatio: 6 });
  addFxAutomationPoint(session, track.id, 'compThreshold', 0, 0);
  addFxAutomationPoint(session, track.id, 'compThreshold', 1, -40);
  const mix = mixdown(session, read, { sampleRate: RATE });
  const first = rms(mix.left.subarray(0, RATE / 2));
  const second = rms(mix.left.subarray(RATE / 2));
  assert.ok(second < first * 0.9, `the compressor ramp did not reduce the tail (${second} vs ${first})`);
});

test('FX automation does nothing while the track FX flag is off', () => {
  const plain = sessionWith({ ...OFF, enabled: false });
  const automated = sessionWith({ ...OFF, enabled: false });
  addFxAutomationPoint(automated.session, automated.track.id, 'saturation', 0, 1);
  const a = mixdown(plain.session, plain.read, { sampleRate: RATE });
  const b = mixdown(automated.session, automated.read, { sampleRate: RATE });
  assert.deepEqual(Array.from(a.left), Array.from(b.left));
});

test('an automated track does not clip the master', () => {
  const { session, track, read } = sessionWith({ ...OFF, eqLow: 18 }, 0.6);
  addFxAutomationPoint(session, track.id, 'eqLow', 0, 18);
  const mix = mixdown(session, read, { sampleRate: RATE });
  assert.ok(mix.peak <= 1, `peak ${mix.peak} exceeded full scale`);
});

console.log(`${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
