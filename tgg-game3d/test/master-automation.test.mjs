// Master-bus automation: the limiter lane must be audible, saturation must
// shape the export, and neither may depend on the processing chunk size.
// Run with: node test/master-automation.test.mjs
import assert from 'node:assert/strict';
import {
  addClip,
  addMasterAutomationPoint,
  addTake,
  addTrack,
  createSession,
  normalizeSession,
  removeMasterAutomationPoint,
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

const rms = (channel, from = 0) => {
  let sum = 0;
  for (let i = from; i < channel.length; i += 1) sum += channel[i] * channel[i];
  return Math.sqrt(sum / Math.max(1, channel.length - from));
};

const maxDiff = (a, b) => {
  let worst = 0;
  for (let i = 0; i < a.length; i += 1) worst = Math.max(worst, Math.abs(a[i] - b[i]));
  return worst;
};

function twoTrackSession() {
  const session = createSession({ sampleRate: RATE });
  const samples = [sine(220, 0.8), sine(330, 0.7)];
  samples.forEach((data, index) => {
    const track = addTrack(session, 'vocal');
    addTake(session, { id: `mt${index}`, trackId: track.id, duration: 1 });
    addClip(session, track.id, { takeId: `mt${index}`, start: 0.05 * index, duration: 1 });
  });
  return { session, read: (id) => samples[Number(id.slice(2))] };
}

test('a master limiter lane changes the rendered audio', () => {
  const plain = twoTrackSession();
  const automated = twoTrackSession();
  // A flat lane, because a 0 → -12 dB ramp legitimately starts at full scale
  // and would not test the ceiling at all.
  addMasterAutomationPoint(automated.session, 'limiter', 0, -12);
  addMasterAutomationPoint(automated.session, 'limiter', 1, -12);
  const a = mixdown(plain.session, plain.read, { sampleRate: RATE });
  const b = mixdown(automated.session, automated.read, { sampleRate: RATE });
  assert.ok(maxDiff(a.left, b.left) > 1e-3, 'the master limiter lane was a silent no-op');
  assert.ok(b.peak <= a.peak + 1e-9, 'a lower limiter threshold did not lower the peak');
  assert.ok(b.peak <= 0.3, `limiter at -12 dB let through ${b.peak}`);
});

test('a flat master lane at the static value is transparent', () => {
  const plain = twoTrackSession();
  const automated = twoTrackSession();
  addMasterAutomationPoint(automated.session, 'limiter', 0, -1);
  addMasterAutomationPoint(automated.session, 'limiter', 1, -1);
  const a = mixdown(plain.session, plain.read, { sampleRate: RATE });
  const b = mixdown(automated.session, automated.read, { sampleRate: RATE });
  assert.ok(maxDiff(a.left, b.left) < 1e-6, `a flat limiter lane altered the export by ${maxDiff(a.left, b.left)}`);
});

test('master saturation automation shapes the export without a lane', () => {
  const plain = twoTrackSession();
  const automated = twoTrackSession();
  addMasterAutomationPoint(automated.session, 'saturation', 0, 0);
  addMasterAutomationPoint(automated.session, 'saturation', 1, 1);
  const a = mixdown(plain.session, plain.read, { sampleRate: RATE });
  const b = mixdown(automated.session, automated.read, { sampleRate: RATE });
  assert.ok(maxDiff(a.left, b.left) > 1e-3, 'master saturation automation did nothing');
  assert.ok(rms(b.left, Math.floor(b.left.length * 0.75)) > 0, 'the saturated tail was silent');
  assert.ok(b.peak <= 1, `saturated export peaked at ${b.peak}`);
});

test('master automation is identical at 512, 2048 and 3000 sample chunks', () => {
  const make = () => {
    const s = twoTrackSession();
    addMasterAutomationPoint(s.session, 'limiter', 0, -12);
    addMasterAutomationPoint(s.session, 'saturation', 0, 0.2);
    addMasterAutomationPoint(s.session, 'saturation', 1, 0.8);
    return s;
  };
  const base = make();
  const fine = mixdown(base.session, base.read, { sampleRate: RATE, block: 2048 });
  const small = mixdown(base.session, base.read, { sampleRate: RATE, block: 512 });
  const odd = mixdown(base.session, base.read, { sampleRate: RATE, block: 3000 });
  assert.ok(maxDiff(fine.left, small.left) < 1e-6, `512 vs 2048 differed by ${maxDiff(fine.left, small.left)}`);
  assert.ok(maxDiff(fine.left, odd.left) < 1e-6, `3000 vs 2048 differed by ${maxDiff(fine.left, odd.left)}`);
});

test('a two-track automated master export is audible, limited and not clipped', () => {
  const s = twoTrackSession();
  addMasterAutomationPoint(s.session, 'limiter', 0, -6);
  addMasterAutomationPoint(s.session, 'saturation', 0, 0.1);
  addMasterAutomationPoint(s.session, 'saturation', 1, 0.9);
  const mix = mixdown(s.session, s.read, { sampleRate: RATE });
  assert.ok(mix.peak <= 1, `export peaked at ${mix.peak}`);
  assert.equal(mix.clipped, false);
  assert.ok(rms(mix.left) > 0.01, 'the export was silent');
  assert.ok(rms(mix.right) > 0.01, 'the right channel was silent');
});

test('master automation survives save and reload, and removal restores the static limiter', () => {
  const s = twoTrackSession();
  addMasterAutomationPoint(s.session, 'limiter', 0.5, -9);
  const reloaded = normalizeSession(JSON.parse(JSON.stringify(s.session)));
  assert.equal(reloaded.masterAutomation.limiter[0].value, -9);
  assert.equal(reloaded.master.saturation, 0);
  removeMasterAutomationPoint(reloaded, 'limiter', 0.5);
  assert.deepEqual(reloaded.masterAutomation.limiter, undefined);
});

test('unrecorded master drag frames do not grow the undo stack', () => {
  const s = twoTrackSession();
  addMasterAutomationPoint(s.session, 'limiter', 0.5, -6);
  const depth = s.session._undo.length;
  removeMasterAutomationPoint(s.session, 'limiter', 0.5, false);
  addMasterAutomationPoint(s.session, 'limiter', 0.7, -8, false);
  assert.equal(s.session._undo.length, depth);
  assert.equal(s.session.masterAutomation.limiter[0].value, -8);
});

console.log(`${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
