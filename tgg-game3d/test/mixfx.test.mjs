// Offline FX chain: identity, EQ, compression, gate and saturation.
// Run with: node test/mixfx.test.mjs
import assert from 'node:assert/strict';
import { applyCompressor, applyEq, applyGate, applySaturation, applyTrackFx } from '../src/mixfx.js';

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

function sine(hz, amplitude = 0.3, seconds = 0.2) {
  const length = Math.floor(RATE * seconds);
  const out = new Float32Array(length);
  for (let i = 0; i < length; i += 1) out[i] = Math.sin((2 * Math.PI * hz * i) / RATE) * amplitude;
  return out;
}

const rms = (channel) => {
  let sum = 0;
  for (const value of channel) sum += value * value;
  return Math.sqrt(sum / channel.length);
};

const peak = (channel) => channel.reduce((max, value) => Math.max(max, Math.abs(value)), 0);

test('a bypassed chain is an exact identity', () => {
  const source = sine(220);
  const copy = Float32Array.from(source);
  applyTrackFx(copy, Float32Array.from(source), { bypass: true, eqLow: 12, compRatio: 8, gate: -40, saturation: 0.9 }, RATE);
  assert.deepEqual(Array.from(copy), Array.from(source));
});

test('a chain of neutral settings does not alter the samples', () => {
  const source = sine(220);
  const copy = Float32Array.from(source);
  applyTrackFx(copy, Float32Array.from(source), { eqLow: 0, eqMid: 0, eqHigh: 0, compRatio: 1, gate: -80, saturation: 0 }, RATE);
  for (let i = 0; i < source.length; i += 1) {
    assert.ok(Math.abs(copy[i] - source[i]) < 1e-6, `sample ${i} moved`);
  }
});

test('the low shelf lifts a bass tone', () => {
  const source = sine(80, 0.2);
  const before = rms(source);
  applyEq(source, { eqLow: 6 }, RATE);
  assert.ok(rms(source) > before * 1.2, 'the low shelf did not add level');
});

test('the high shelf lifts a treble tone', () => {
  const source = sine(9000, 0.2);
  const before = rms(source);
  applyEq(source, { eqHigh: 6 }, RATE);
  assert.ok(rms(source) > before * 1.2, 'the high shelf did not add level');
});

test('the compressor pulls a loud tone down', () => {
  const source = sine(220, 0.8, 0.5);
  const before = peak(source.subarray(source.length / 2));
  applyCompressor(source, { compThreshold: -20, compRatio: 4 }, RATE);
  const after = peak(source.subarray(source.length / 2));
  assert.ok(after < before * 0.85, `the compressor left the peak at ${after.toFixed(3)} from ${before.toFixed(3)}`);
});

test('the compressor leaves a quiet tone alone', () => {
  const source = sine(220, 0.01);
  const before = peak(source);
  applyCompressor(source, { compThreshold: -12, compRatio: 4 }, RATE);
  assert.ok(Math.abs(peak(source) - before) < before * 0.2, 'a sub-threshold tone was compressed');
});

test('the gate closes on room noise and opens on signal', () => {
  const quiet = sine(220, 0.002, 0.5);
  applyGate(quiet, { gate: -40 });
  const tail = peak(quiet.subarray(quiet.length / 2));
  assert.ok(tail < 0.0005, `the gate left ${tail} of noise after the release`);
  const loud = sine(220, 0.4, 0.5);
  applyGate(loud, { gate: -40 });
  assert.ok(peak(loud) > 0.3, 'the gate closed on a loud signal');
});

test('saturation rounds an over-driven signal inside full scale', () => {
  const source = sine(220, 1.6);
  applySaturation(source, { saturation: 1 });
  assert.ok(peak(source) <= 1, `saturation overshot to ${peak(source)}`);
  assert.ok(peak(source) > 0.1, 'saturation collapsed the signal to nothing');
  const quiet = sine(220, 0.05);
  applySaturation(quiet, { saturation: 0.2 });
  assert.ok(Math.abs(peak(quiet) - 0.05) < 0.02, 'saturation changed a quiet signal too much');
});

console.log(`${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
