// FX in the render path: opt-in, identity when neutral, and each stage
// measurably changing the exported samples. Run with: node test/mixdown-fx.test.mjs
import assert from 'node:assert/strict';
import { addClip, addTake, addTrack, createSession } from '../src/session.js';
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

function sine(hz, amplitude = 0.2, seconds = 0.5) {
  const length = Math.floor(RATE * seconds);
  const out = new Float32Array(length);
  for (let i = 0; i < length; i += 1) out[i] = Math.sin((2 * Math.PI * hz * i) / RATE) * amplitude;
  return out;
}

// One track carrying one clip, with an optional fx block.
function sessionWith(fx, amplitude = 0.2, hz = 220) {
  const session = createSession({ sampleRate: RATE });
  const track = addTrack(session, 'vocal');
  addTake(session, { id: 'take', trackId: track.id, duration: 0.5 });
  addClip(session, track.id, { takeId: 'take', start: 0, duration: 0.5 });
  track.fx = fx;
  const samples = sine(hz, amplitude);
  return { session, read: () => samples, samples };
}

const rms = (channel) => {
  let sum = 0;
  for (const value of channel) sum += value * value;
  return Math.sqrt(sum / channel.length);
};
const peak = (channel) => channel.reduce((max, value) => Math.max(max, Math.abs(value)), 0);
const NEUTRAL = { enabled: true, eqLow: 0, eqMid: 0, eqHigh: 0, compThreshold: -24, compRatio: 1, gate: -80, saturation: 0 };

test('without the flag the render path is untouched', () => {
  const plain = sessionWith(undefined);
  const off = sessionWith({ ...NEUTRAL, enabled: false });
  const a = mixdown(plain.session, plain.read, { sampleRate: RATE });
  const b = mixdown(off.session, off.read, { sampleRate: RATE });
  assert.deepEqual(Array.from(a.left), Array.from(b.left));
  assert.deepEqual(Array.from(a.right), Array.from(b.right));
});

test('an enabled but neutral chain renders identical samples', () => {
  const plain = sessionWith(undefined);
  const neutral = sessionWith(NEUTRAL);
  const a = mixdown(plain.session, plain.read, { sampleRate: RATE });
  const b = mixdown(neutral.session, neutral.read, { sampleRate: RATE });
  for (let i = 0; i < a.left.length; i += 1) {
    assert.ok(Math.abs(a.left[i] - b.left[i]) < 1e-6, `left sample ${i} changed`);
    assert.ok(Math.abs(a.right[i] - b.right[i]) < 1e-6, `right sample ${i} changed`);
  }
});

test('enabled EQ changes the exported level', () => {
  const plain = sessionWith(undefined, 0.2, 80);
  const eq = sessionWith({ ...NEUTRAL, eqLow: 6 }, 0.2, 80);
  const base = rms(mixdown(plain.session, plain.read, { sampleRate: RATE }).left);
  const boosted = rms(mixdown(eq.session, eq.read, { sampleRate: RATE }).left);
  assert.ok(boosted > base * 1.1, `EQ did not lift the export (${boosted} vs ${base})`);
});

test('enabled compression lowers the exported peak', () => {
  const plain = sessionWith(undefined, 0.5);
  const comp = sessionWith({ ...NEUTRAL, compThreshold: -24, compRatio: 6 }, 0.5);
  const base = peak(mixdown(plain.session, plain.read, { sampleRate: RATE }).left.subarray(RATE / 4));
  const squashed = peak(mixdown(comp.session, comp.read, { sampleRate: RATE }).left.subarray(RATE / 4));
  assert.ok(squashed < base, `compression did not reduce the export peak (${squashed} vs ${base})`);
});

test('an enabled gate silences a quiet track in the export', () => {
  const plain = sessionWith(undefined, 0.002);
  const gated = sessionWith({ ...NEUTRAL, gate: -40 }, 0.002);
  const base = peak(mixdown(plain.session, plain.read, { sampleRate: RATE }).left);
  const closed = peak(mixdown(gated.session, gated.read, { sampleRate: RATE }).left.subarray(RATE / 4));
  assert.ok(base > 0.001, 'the baseline was already silent');
  assert.ok(closed < base * 0.2, `the gate did not close (${closed} vs ${base})`);
});

test('enabled saturation changes a hot track without clipping the master', () => {
  const plain = sessionWith(undefined, 0.6);
  const sat = sessionWith({ ...NEUTRAL, saturation: 1 }, 0.6);
  const base = peak(mixdown(plain.session, plain.read, { sampleRate: RATE }).left.subarray(RATE / 4));
  const mixed = mixdown(sat.session, sat.read, { sampleRate: RATE });
  const shaped = peak(mixed.left.subarray(RATE / 4));
  assert.ok(shaped < base * 0.9, `saturation did not reshape the export (${shaped} vs ${base})`);
  assert.equal(mixed.clipped, false);
});

test('FX on one track leaves the other track at its level', () => {
  const session = createSession({ sampleRate: RATE });
  const loud = addTrack(session, 'vocal', { name: 'loud' });
  const quiet = addTrack(session, 'bgv', { name: 'quiet' });
  addTake(session, { id: 't1', trackId: loud.id, duration: 0.5 });
  addTake(session, { id: 't2', trackId: quiet.id, duration: 0.5 });
  addClip(session, loud.id, { takeId: 't1', start: 0, duration: 0.5 });
  addClip(session, quiet.id, { takeId: 't2', start: 0, duration: 0.5 });
  loud.fx = { ...NEUTRAL, saturation: 1 };
  const read = (id) => sine(220, id === 't1' ? 0.6 : 0.1);
  const mix = mixdown(session, read, { sampleRate: RATE });
  const loudOnly = mixdown({ ...session, tracks: [loud] }, read, { sampleRate: RATE });
  const quietOnly = mixdown({ ...session, tracks: [quiet] }, read, { sampleRate: RATE });
  const combined = peak(mix.left.subarray(RATE / 4));
  const together = peak(loudOnly.left.subarray(RATE / 4)) + peak(quietOnly.left.subarray(RATE / 4));
  assert.ok(combined <= together + 1e-6, 'the mixed peak exceeded the sum of the tracks');
  assert.ok(peak(quietOnly.left) > 0.01, 'the untreated track disappeared');
});

console.log(`${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
