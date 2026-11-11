// Master bus: fader and limiter. Run with: node test/master.test.mjs
import assert from 'node:assert/strict';
import { addClip, addTake, addTrack, createSession, limitSample, masterGain } from '../src/session.js';
import { encodeWav, mixdown } from '../src/wav.js';

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

function hotSession(amplitude = 0.6) {
  const session = createSession({ sampleRate: 1000 });
  const track = addTrack(session, 'vocal');
  addTake(session, { id: 't1', trackId: track.id, duration: 1 });
  addClip(session, track.id, { takeId: 't1', start: 0, duration: 1 });
  return { session, samples: new Float32Array(1000).fill(amplitude) };
}

test('the master fader scales the mix', () => {
  const { session, samples } = hotSession();
  const unity = mixdown(session, () => samples, { sampleRate: 1000 });
  session.master.gain = 0.5;
  const quiet = mixdown(session, () => samples, { sampleRate: 1000 });
  assert.ok(Math.abs(quiet.left[10] - unity.left[10] * 0.5) < 1e-6, 'the fader did not scale the mix');
});

test('a silent master exports silence', () => {
  const { session, samples } = hotSession();
  session.master.gain = 0;
  const mix = mixdown(session, () => samples, { sampleRate: 1000 });
  assert.equal(mix.left[10], 0);
  assert.equal(mix.peak, 0);
});

test('the limiter keeps a hot mix under 0 dBFS', () => {
  // 1.0 × 0.8 clip gain × 0.707 pan × 2.0 fader = 1.13, above the -1 dB threshold.
  const { session, samples } = hotSession(1);
  session.master.gain = 2;
  const mix = mixdown(session, () => samples, { sampleRate: 1000 });
  assert.ok(mix.peak <= 1, `peak ${mix.peak} is over full scale`);
  assert.ok(mix.peak > 0.88, `peak ${mix.peak} lost too much level`);
  assert.ok(mix.peak < 1.13, 'the limiter did not reduce the peak');
});

test('below the threshold the limiter is transparent', () => {
  const value = 0.4;
  assert.equal(limitSample(value, -1), value);
  assert.equal(limitSample(-0.4, -1), -0.4);
});

test('the master settings survive a save round trip', () => {
  const session = createSession();
  session.master = { gain: 0.72, limiter: -3 };
  const copy = JSON.parse(JSON.stringify(session));
  assert.equal(masterGain(copy), 0.72, 'the master fader was not read back');
  assert.equal(copy.master.limiter, -3);
});

test('the exported WAV still has a valid header after the master bus', () => {
  const { session, samples } = hotSession();
  session.master.gain = 1.2;
  const mix = mixdown(session, () => samples, { sampleRate: 1000 });
  const buffer = encodeWav([mix.left, mix.right], 1000);
  const view = new DataView(buffer);
  assert.equal(String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3)), 'RIFF');
  assert.equal(buffer.byteLength, 44 + mix.frames * 4);
});

console.log(`${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
