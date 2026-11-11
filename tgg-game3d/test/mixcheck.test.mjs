// Mix check: the numbers the DAW reports must match the samples it exports.
// Run with: node test/mixcheck.test.mjs
import assert from 'node:assert/strict';
import { analyzeChannel, analyzeMix, dbFromGain, formatMixCheck, mixVerdict } from '../src/mixcheck.js';

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
function sine(hz, amplitude, seconds = 0.25) {
  const length = Math.floor(RATE * seconds);
  const out = new Float32Array(length);
  for (let i = 0; i < length; i += 1) out[i] = Math.sin((2 * Math.PI * hz * i) / RATE) * amplitude;
  return out;
}
const stereo = (channel) => ({ left: channel, right: channel });

test('peak and RMS match the samples', () => {
  const channel = sine(220, 0.5);
  const stats = analyzeChannel(channel);
  assert.ok(Math.abs(stats.peak - 0.5) < 1e-3, `peak ${stats.peak}`);
  assert.ok(Math.abs(stats.rms - 0.5 / Math.SQRT2) < 1e-3, `rms ${stats.rms}`);
  assert.equal(stats.samples, channel.length);
});

test('a full-scale square counts as clipped', () => {
  const channel = new Float32Array(64).fill(1);
  const stats = analyzeChannel(channel);
  assert.equal(stats.clipped, 64);
  assert.equal(stats.peak, 1);
});

test('silence reads as silent, not as a ready mix', () => {
  const analysis = analyzeMix(stereo(new Float32Array(128)));
  assert.equal(analysis.silent, true);
  assert.equal(mixVerdict(analysis).status, 'silent');
  assert.ok(formatMixCheck(analysis).includes('silent'));
});

test('a hot mix is flagged, a clipped mix is called out, and a healthy one is ready', () => {
  const hot = analyzeMix(stereo(sine(220, 0.995)));
  assert.equal(hot.clipped, 0, 'a 0.995 peak is hot but not clipped');
  assert.equal(mixVerdict(hot).status, 'hot');
  const clipped = analyzeMix(stereo(new Float32Array(64).fill(1)));
  assert.equal(mixVerdict(clipped).status, 'clipped');
  const healthy = analyzeMix(stereo(sine(220, 0.5)));
  assert.equal(mixVerdict(healthy).status, 'ready');
  assert.ok(formatMixCheck(healthy).startsWith('Mix check · peak'));
});

test('the louder channel decides the peak', () => {
  const analysis = analyzeMix({ left: sine(220, 0.2), right: sine(220, 0.9) });
  assert.ok(analysis.peak > 0.89, `peak ${analysis.peak}`);
  assert.equal(analysis.channels.left.clipped, 0);
});

test('dc offset is reported, not hidden', () => {
  const channel = new Float32Array(200).fill(0.1);
  const stats = analyzeChannel(channel);
  assert.ok(Math.abs(stats.dc - 0.1) < 1e-6, `dc ${stats.dc}`);
});

test('gain to decibels is stable at the edges', () => {
  assert.equal(dbFromGain(1), 0);
  assert.ok(Math.abs(dbFromGain(0.5) + 6.0206) < 1e-3);
  assert.equal(dbFromGain(0), -Infinity);
});

console.log(`${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
