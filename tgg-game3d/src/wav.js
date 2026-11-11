// WAV encoding and the offline mixdown. Pure float maths, so the export can be
// tested in Node byte for byte instead of "looks fine on my machine".
import { applyLimiter, applySaturation, applyTrackFx, createFxState, createLimiterState } from './mixfx.js';
import {
  FX_RANGES,
  automationAt,
  clipGain,
  fxParamAt,
  hasFxAutomation,
  masterGain,
  masterParamAt,
  projectDuration,
} from './session.js';

const clampSample = (value) => Math.max(-1, Math.min(1, value));

// One grid for all buffer-processor automation, independent of chunking.
const AUTOMATION_GRID = 2048;

export function encodeWav(channels, sampleRate = 48000) {
  const list = Array.isArray(channels) ? channels : [channels];
  const channelCount = Math.max(1, list.length);
  const frames = list[0]?.length ?? 0;
  const bytesPerSample = 2;
  const blockAlign = channelCount * bytesPerSample;
  const dataBytes = frames * blockAlign;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);

  const writeAscii = (offset, text) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
  };

  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, channelCount, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // bits per sample
  writeAscii(36, 'data');
  view.setUint32(40, dataBytes, true);

  let offset = 44;
  for (let frame = 0; frame < frames; frame += 1) {
    for (let channel = 0; channel < channelCount; channel += 1) {
      const sample = clampSample(Number(list[channel]?.[frame]) || 0);
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }
  return buffer;
}

// Equal-power pan keeps a centred clip the same loudness as a hard-panned one.
function panGain(pan = 0) {
  const angle = ((clampSample(pan) + 1) / 2) * (Math.PI / 2);
  return { left: Math.cos(angle), right: Math.sin(angle) };
}

// Mixes every clip into a stereo pair. `read(takeId)` returns the samples for a
// take (Float32Array) — in the browser that is the decoded AudioBuffer, in tests
// it is a plain array, and the maths is identical either way.
export function mixdown(session, read, { sampleRate = session.sampleRate, gain = 1, block = 2048 } = {}) {
  const duration = projectDuration(session);
  const frames = Math.max(1, Math.ceil(duration * sampleRate));
  const left = new Float32Array(frames);
  const right = new Float32Array(frames);
  let peak = 0;

  for (const track of session.tracks) {
    const trackGain = clipGain(session, track);
    if (trackGain <= 0) continue;
    const pan = panGain(track.pan);
    const panPoints = session.automationPan?.[track.id];
    // FX is opt-in per track: without the flag the render path is unchanged.
    const fxOn = Boolean(track.fx?.enabled) && !track.fx?.bypass;
    const trackLeft = fxOn ? new Float32Array(frames) : left;
    const trackRight = fxOn ? new Float32Array(frames) : right;
    for (const clip of track.clips) {
      const samples = read(clip.takeId);
      if (!samples || !samples.length) continue;
      const takeRate = session.takes?.[clip.takeId]?.sampleRate || sampleRate;
      const ratio = takeRate / sampleRate;
      const startFrame = Math.round(clip.start * sampleRate);
      const clipFrames = Math.round(clip.duration * sampleRate);
      const offsetFrame = Math.round(clip.offset * takeRate);
      for (let i = 0; i < clipFrames; i += 1) {
        const target = startFrame + i;
        if (target < 0 || target >= frames) continue;
        const source = Math.floor(offsetFrame + i * ratio);
        if (source < 0 || source >= samples.length) continue;
        // Short clip fades stop edits clicking.
        let envelope = 1;
        if (clip.fadeIn > 0 && i < clip.fadeIn * sampleRate) envelope = i / (clip.fadeIn * sampleRate);
        if (clip.fadeOut > 0 && i > clipFrames - clip.fadeOut * sampleRate) {
          envelope = (clipFrames - i) / (clip.fadeOut * sampleRate);
        }
        const automation = automationAt(session.automation?.[track.id], target / sampleRate, 1);
        const panNow = panPoints ? panGain(automationAt(panPoints, target / sampleRate, track.pan)) : pan;
        const value = samples[source] * clip.gain * envelope * trackGain * gain * automation;
        trackLeft[target] += value * panNow.left;
        trackRight[target] += value * panNow.right;
        const magnitude = Math.abs(value);
        if (magnitude > peak) peak = magnitude;
      }
    }
    if (fxOn) {
      if (hasFxAutomation(session, track.id)) {
        // Effect parameters are buffer processors, so automation is applied per
        // block at the block's midpoint rather than per sample.
        // Automation resolves on a fixed grid, so the processing chunk size is
        // only an implementation detail: 512 and 2048 must render identically.
        const requested = Math.floor(Number(block) || AUTOMATION_GRID);
        const chunk = requested > 0 && AUTOMATION_GRID % requested === 0 ? requested : AUTOMATION_GRID;
        // One state per track for the whole render, so envelopes carry across
        // blocks instead of re-attacking at every boundary.
        const fxState = createFxState();
        for (let start = 0; start < frames; start += chunk) {
          const end = Math.min(frames, start + chunk);
          const windowStart = Math.floor(start / AUTOMATION_GRID) * AUTOMATION_GRID;
          const at = (windowStart + AUTOMATION_GRID / 2) / sampleRate;
          const params = { ...track.fx };
          for (const param of Object.keys(FX_RANGES)) {
            params[param] = fxParamAt(session, track.id, param, at, track.fx?.[param] ?? params[param]);
          }
          applyTrackFx(trackLeft.subarray(start, end), trackRight.subarray(start, end), params, sampleRate, fxState);
        }
      } else {
        applyTrackFx(trackLeft, trackRight, track.fx, sampleRate);
      }
      for (let i = 0; i < frames; i += 1) {
        left[i] += trackLeft[i];
        right[i] += trackRight[i];
      }
    }
  }

  // Master bus: fader, then master saturation, then the limiter. Master
  // parameters resolve on the same fixed grid as track FX, so the exported
  // audio never depends on the processing chunk size. Saturation and the
  // limiter are per-sample and memoryless, so there is no envelope to carry.
  const bus = masterGain(session) * (Number(gain) || 1);
  const staticLimiter = session.master?.limiter ?? -1;
  const staticSaturation = session.master?.saturation ?? 0;
  const limiterState = createLimiterState();
  let finalPeak = 0;
  for (let start = 0; start < frames; start += AUTOMATION_GRID) {
    const end = Math.min(frames, start + AUTOMATION_GRID);
    const at = (start + AUTOMATION_GRID / 2) / sampleRate;
    const limiterDb = masterParamAt(session, 'limiter', at, staticLimiter);
    const saturation = masterParamAt(session, 'saturation', at, staticSaturation);
    const blockLeft = left.subarray(start, end);
    const blockRight = right.subarray(start, end);
    if (bus !== 1) {
      for (let i = 0; i < blockLeft.length; i += 1) {
        blockLeft[i] *= bus;
        blockRight[i] *= bus;
      }
    }
    if (saturation > 0) {
      applySaturation(blockLeft, { saturation });
      applySaturation(blockRight, { saturation });
    }
    applyLimiter(blockLeft, blockRight, { limiter: limiterDb }, sampleRate, limiterState);
    for (let i = 0; i < blockLeft.length; i += 1) {
      const magnitude = Math.max(Math.abs(blockLeft[i]), Math.abs(blockRight[i]));
      if (magnitude > finalPeak) finalPeak = magnitude;
    }
  }

  return { left, right, frames, sampleRate, duration, peak: finalPeak, clipped: finalPeak > 0.999 };
}

// Stems: one stereo pair per track, for handing a mix to someone else.
export function stemMixdown(session, read, options = {}) {
  const stems = [];
  for (const track of session.tracks) {
    const solo = { ...session, tracks: [{ ...track, mute: false, solo: false }] };
    // A muted or un-soloed track still exports as a stem, but silent, so the
    // stem list always matches the track list.
    const audible = clipGain(session, track) > 0;
    const mix = mixdown(solo, read, options);
    if (!audible) {
      mix.left.fill(0);
      mix.right.fill(0);
    }
    stems.push({ trackId: track.id, name: track.name, ...mix });
  }
  return stems;
}
