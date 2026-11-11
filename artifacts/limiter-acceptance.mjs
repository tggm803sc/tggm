// Listening-oriented acceptance pass, done numerically: export a two-track mix
// with a master limiter lane and inspect the waveform for ceiling, overs,
// clipping, DC, discontinuities and harmonic artifacts.
import { writeFileSync } from 'node:fs';
import {
  addClip,
  addMasterAutomationPoint,
  addTake,
  addTrack,
  createSession,
} from '../tgg-game3d/src/session.js';
import { mixdown } from '../tgg-game3d/src/wav.js';

const RATE = 48000;
const sine = (hz, amp, seconds = 1) => {
  const length = Math.floor(RATE * seconds);
  const out = new Float32Array(length);
  for (let i = 0; i < length; i += 1) out[i] = Math.sin((2 * Math.PI * hz * i) / RATE) * amp;
  return out;
};
const dbToGain = (db) => 10 ** (db / 20);

function build({ limiter = -6, saturation = 0, trackCount = 2, block = 2048 } = {}) {
  const session = createSession({ sampleRate: RATE });
  const sources = [sine(220, 0.85), sine(330, 0.75)];
  for (let i = 0; i < trackCount; i += 1) {
    const track = addTrack(session, 'vocal');
    addTake(session, { id: `a${i}`, trackId: track.id, duration: 1 });
    addClip(session, track.id, { takeId: `a${i}`, start: 0.05 * i, duration: 1 });
  }
  if (limiter !== null) {
    addMasterAutomationPoint(session, 'limiter', 0, limiter);
    addMasterAutomationPoint(session, 'limiter', 1, limiter);
  }
  if (saturation) {
    addMasterAutomationPoint(session, 'saturation', 0, saturation);
    addMasterAutomationPoint(session, 'saturation', 1, saturation);
  }
  const mix = mixdown(session, (id) => sources[Number(id.slice(1))], { sampleRate: RATE, block });
  return { mix, sources };
}

function inspect(channel, threshold) {
  let peak = 0;
  let overs = 0;
  let clipped = 0;
  let dc = 0;
  let maxStep = 0;
  let stepAt = 0;
  for (let i = 0; i < channel.length; i += 1) {
    const magnitude = Math.abs(channel[i]);
    if (magnitude > peak) peak = magnitude;
    if (magnitude > threshold + 1e-6) overs += 1;
    if (magnitude >= 0.999) clipped += 1;
    dc += channel[i];
    if (i) {
      const step = Math.abs(channel[i] - channel[i - 1]);
      if (step > maxStep) {
        maxStep = step;
        stepAt = i;
      }
    }
  }
  return {
    peak: +peak.toFixed(5),
    overs,
    clipped,
    dc: +(dc / channel.length).toFixed(6),
    maxStep: +maxStep.toFixed(5),
    maxStepAt: stepAt,
  };
}

function harmonicRatio(channel, fundamental, start, length) {
  const magnitude = (hz) => {
    let re = 0;
    let im = 0;
    for (let i = 0; i < length; i += 1) {
      const t = (start + i) / RATE;
      const v = channel[start + i];
      re += v * Math.cos(2 * Math.PI * hz * t);
      im += v * Math.sin(2 * Math.PI * hz * t);
    }
    return Math.hypot(re, im) / length;
  };
  const base = magnitude(fundamental);
  const harmonics = [2, 3, 4, 5].map((n) => magnitude(fundamental * n));
  const thd = Math.hypot(...harmonics) / (base || 1);
  return { base: +base.toFixed(5), thd: +(thd * 100).toFixed(2) };
}

function waveform(channel, columns = 64) {
  const bucket = Math.floor(channel.length / columns);
  const rows = [];
  for (let c = 0; c < columns; c += 1) {
    let peak = 0;
    for (let i = c * bucket; i < Math.min(channel.length, (c + 1) * bucket); i += 1) {
      peak = Math.max(peak, Math.abs(channel[i]));
    }
    rows.push(peak);
  }
  const top = Math.max(...rows, 1e-9);
  return rows.map((v) => ({ peak: +v.toFixed(4), bar: '█'.repeat(Math.max(0, Math.round((v / top) * 24))) }));
}

const report = [];
const limits = [null, -1, -6, -12];
report.push('MASTER LIMITER ACCEPTANCE — two-track export (220 Hz + 330 Hz)');
report.push('');

const rendered = {};
for (const limiter of limits) {
  const { mix } = build({ limiter: limiter ?? null });
  rendered[String(limiter)] = mix;
  const threshold = limiter === null ? 1 : dbToGain(limiter);
  const left = inspect(mix.left, threshold);
  const right = inspect(mix.right, threshold);
  const thd = harmonicRatio(mix.left, 220, Math.floor(RATE * 0.5), 8192);
  report.push(`limiter ${limiter === null ? 'OFF (static -1 dB)' : `${limiter} dB`}`);
  report.push(`  peak ${left.peak}  overs ${left.overs}  clipped ${left.clipped}  dc ${left.dc}  maxStep ${left.maxStep} @${left.maxStepAt}`);
  report.push(`  right peak ${right.peak}  right overs ${right.overs}  right clipped ${right.clipped}`);
  report.push(`  THD vs 220 Hz fundamental: ${thd.thd}%  (fundamental magnitude ${thd.base})`);
  report.push('');
}

// Determinism across chunk sizes for the same-limiter render.
const a = build({ limiter: -6, block: 2048 }).mix;
const b = build({ limiter: -6, block: 512 }).mix;
const c = build({ limiter: -6, block: 3000 }).mix;
let worst = 0;
for (const other of [b, c]) {
  for (let i = 0; i < a.left.length; i += 1) worst = Math.max(worst, Math.abs(a.left[i] - other.left[i]));
}
report.push(`chunk determinism (2048 vs 512 vs 3000): worst sample difference ${worst.toExponential(2)}`);
report.push('');

const wave = waveform(a.left, 48);
report.push('waveform of the -6 dB limited export (48 buckets, peak per bucket):');
wave.slice(0, 24).forEach((row, i) => report.push(`  ${String(i).padStart(2)} ${row.peak.toFixed(3)} ${row.bar}`));
report.push('  …');
wave.slice(-6).forEach((row, i) => report.push(`  ${String(48 - 6 + i).padStart(2)} ${row.peak.toFixed(3)} ${row.bar}`));

writeFileSync(new URL('./limiter-report.txt', import.meta.url), `${report.join('\n')}\n`);
console.log(report.join('\n'));
