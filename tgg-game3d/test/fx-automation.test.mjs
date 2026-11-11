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

test('no energy step appears at the 2048-sample render block seams', () => {
  // A flat lane forces the block renderer, and hard compression is the case
  // where a reset envelope used to punch a step into the signal every 46 ms.
  const fx = { ...OFF, compThreshold: -26, compRatio: 8 };
  const { session, track, read } = sessionWith(fx, 0.9);
  addFxAutomationPoint(session, track.id, 'compThreshold', 0, -26);
  addFxAutomationPoint(session, track.id, 'compThreshold', 1, -26);
  const mix = mixdown(session, read, { sampleRate: RATE });
  const channel = mix.left;
  const block = 2048;
  let interior = 0;
  let boundary = 0;
  for (let i = 1; i < channel.length; i += 1) {
    const jump = Math.abs(channel[i] - channel[i - 1]);
    const offset = i % block;
    const nearSeam = offset <= 1 || offset >= block - 1;
    if (nearSeam) boundary = Math.max(boundary, jump);
    else interior = Math.max(interior, jump);
  }
  assert.ok(interior > 0, 'the signal was silent, so the seam test proved nothing');
  assert.ok(
    boundary <= interior * 1.5,
    `a seam step (${boundary.toFixed(5)}) stands out from the interior (${interior.toFixed(5)})`,
  );
});

test('flat FX lanes export the same samples as no automation at all', () => {
  const fx = { ...OFF, compThreshold: -20, compRatio: 6, saturation: 0.3 };
  const plain = sessionWith({ ...fx });
  const automated = sessionWith({ ...fx });
  for (const param of ['compThreshold', 'saturation']) {
    addFxAutomationPoint(automated.session, automated.track.id, param, 0, fx[param]);
    addFxAutomationPoint(automated.session, automated.track.id, param, 1, fx[param]);
  }
  const a = mixdown(plain.session, plain.read, { sampleRate: RATE });
  const b = mixdown(automated.session, automated.read, { sampleRate: RATE });
  let worst = 0;
  for (let i = 0; i < a.left.length; i += 1) {
    worst = Math.max(worst, Math.abs(a.left[i] - b.left[i]));
  }
  assert.ok(worst <= 1e-6, `a flat lane changed the export by ${worst}`);
});

console.log(`${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
