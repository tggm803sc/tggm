// Offline channel strip: the same order the mic chain uses — EQ, compressor,
// gate, saturation. Pure sample maths with no DOM or WebAudio, so the exported
// mix can be tested against the exact parameter set.
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const dbToGain = (db) => 10 ** (Number(db) / 20);

const lowpass = (samples, cutoff, sampleRate) => {
  const a = 1 - Math.exp((-2 * Math.PI * cutoff) / sampleRate);
  const out = new Float32Array(samples.length);
  let y = 0;
  for (let i = 0; i < samples.length; i += 1) {
    y += a * (samples[i] - y);
    out[i] = y;
  }
  return out;
};

// One-pole shelving: identity at 0 dB, because the band term is multiplied by
// (gain - 1) rather than added.
function shelf(channel, band, gainDb) {
  if (!gainDb) return;
  const gain = dbToGain(gainDb) - 1;
  for (let i = 0; i < channel.length; i += 1) channel[i] += band[i] * gain;
}

function bandpass(low, high) {
  const out = new Float32Array(low.length);
  for (let i = 0; i < low.length; i += 1) out[i] = low[i] - high[i];
  return out;
}

export function applyEq(channel, { eqLow = 0, eqMid = 0, eqHigh = 0 } = {}, sampleRate = 48000) {
  if (!eqLow && !eqMid && !eqHigh) return channel;
  const lowBand = lowpass(channel, 250, sampleRate);
  const highCut = lowpass(channel, 4000, sampleRate);
  shelf(channel, lowBand, eqLow);
  shelf(channel, bandpass(lowBand, highCut), eqMid);
  for (let i = 0; i < channel.length; i += 1) channel[i] += (channel[i] - highCut[i]) * 0;
  if (eqHigh) {
    const highBand = new Float32Array(channel.length);
    for (let i = 0; i < channel.length; i += 1) highBand[i] = channel[i] - highCut[i];
    shelf(channel, highBand, eqHigh);
  }
  return channel;
}

// Envelope state so a buffer processed in blocks behaves like one continuous
// pass: without this the compressor re-attacks and the gate re-opens at every
// block boundary.
export function createFxState() {
  const blank = () => ({ compEnv: 0, compGain: 1, gateEnv: 0, gateOpen: 1 });
  return { left: blank(), right: blank() };
}

export function applyCompressor(channel, { compThreshold = -24, compRatio = 3 } = {}, sampleRate = 48000, state = null) {
  const ratio = clamp(Number(compRatio) || 1, 1, 20);
  if (ratio <= 1) return channel;
  const threshold = dbToGain(clamp(Number(compThreshold) || 0, -60, 0));
  const attack = 1 - Math.exp(-1 / (0.005 * sampleRate));
  const release = 1 - Math.exp(-1 / (0.15 * sampleRate));
  let env = state?.compEnv ?? 0;
  let gain = state?.compGain ?? 1;
  for (let i = 0; i < channel.length; i += 1) {
    const level = Math.abs(channel[i]);
    env += (level - env) * (level > env ? attack : release);
    let target = 1;
    if (env > threshold) target = (threshold + (env - threshold) / ratio) / env;
    gain += (target - gain) * (target < gain ? attack : release);
    channel[i] *= gain;
  }
  if (state) {
    state.compEnv = env;
    state.compGain = gain;
  }
  return channel;
}

export function applyGate(channel, { gate = -60 } = {}, state = null) {
  const setting = Number(gate);
  // -80 dB is the "off" position, so a neutral chain stays a true identity.
  if (!Number.isFinite(setting) || setting <= -79) return channel;
  const threshold = dbToGain(clamp(setting, -79, -20));
  const attack = 1 - Math.exp(-1 / (0.005 * 48000));
  const decay = 1 - Math.exp(-1 / (0.08 * 48000));
  let env = state?.gateEnv ?? 0;
  let open = state?.gateOpen ?? 1;
  for (let i = 0; i < channel.length; i += 1) {
    const level = Math.abs(channel[i]);
    // Follow the envelope, not the sample: a bare zero crossing is not silence.
    env += (level - env) * (level > env ? attack : decay);
    const target = env >= threshold ? 1 : 0;
    open += (target - open) * (target > open ? 0.4 : 0.002);
    channel[i] *= open;
  }
  if (state) {
    state.gateEnv = env;
    state.gateOpen = open;
  }
  return channel;
}

export function applySaturation(channel, { saturation = 0 } = {}) {
  const drive = clamp(Number(saturation) || 0, 0, 1) * 4;
  if (drive <= 0) return channel;
  // Unity gain for quiet signals (tanh(kx)/k -> x as x -> 0) and a bounded
  // ceiling for hot ones, so the effect adds harmonics instead of a level jump.
  const k = 1 + drive;
  for (let i = 0; i < channel.length; i += 1) channel[i] = Math.tanh(channel[i] * k) / k;
  return channel;
}

// Applies the strip in place to a stereo pair. A bypassed or empty chain is a
// true identity, so adding FX never alters an existing mix by itself.
export function applyTrackFx(left, right, fx, sampleRate = 48000, state = null) {
  if (!fx || fx.bypass) return { left, right };
  const pairs = [
    [left, state?.left],
    [right, state?.right],
  ];
  for (const [channel, channelState] of pairs) {
    applyEq(channel, fx, sampleRate);
    applyCompressor(channel, fx, sampleRate, channelState);
    applyGate(channel, fx, channelState);
    applySaturation(channel, fx);
  }
  return { left, right };
}
