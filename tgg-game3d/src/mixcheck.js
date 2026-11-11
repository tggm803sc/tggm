// Mix analysis for the DAW's mix check. Measurements only: this module never
// touches the audio, so a mix check cannot change what gets exported.
export function analyzeChannel(channel) {
  let peak = 0;
  let sum = 0;
  let dc = 0;
  let clipped = 0;
  let maxStep = 0;
  const samples = channel?.length ?? 0;
  for (let i = 0; i < samples; i += 1) {
    const value = channel[i];
    const magnitude = Math.abs(value);
    if (magnitude > peak) peak = magnitude;
    sum += value * value;
    dc += value;
    if (magnitude >= 0.999) clipped += 1;
    if (i) {
      const step = Math.abs(value - channel[i - 1]);
      if (step > maxStep) maxStep = step;
    }
  }
  return {
    peak,
    rms: Math.sqrt(sum / Math.max(1, samples)),
    dc: dc / Math.max(1, samples),
    clipped,
    maxStep,
    samples,
  };
}

export const dbFromGain = (gain) => (gain > 0 ? 20 * Math.log10(gain) : -Infinity);

export function analyzeMix(mix) {
  const left = analyzeChannel(mix?.left);
  const right = analyzeChannel(mix?.right);
  const peak = Math.max(left.peak, right.peak);
  const rms = Math.max(left.rms, right.rms);
  return {
    peak,
    peakDb: Number(dbFromGain(peak).toFixed(2)),
    rms,
    rmsDb: Number(dbFromGain(rms).toFixed(2)),
    clipped: left.clipped + right.clipped,
    dc: Math.max(Math.abs(left.dc), Math.abs(right.dc)),
    maxStep: Math.max(left.maxStep, right.maxStep),
    silent: peak < 1e-4,
    channels: { left, right },
  };
}

// The verdict is deliberately narrow: it only judges what these numbers can
// prove. Loudness targets and creative judgement stay with the producer.
export function mixVerdict(analysis) {
  if (!analysis || analysis.silent) return { status: 'silent', label: 'nothing to check — the mix is silent' };
  if (analysis.clipped > 0) return { status: 'clipped', label: `${analysis.clipped} clipped samples` };
  if (analysis.peakDb > -1) return { status: 'hot', label: 'too hot — leave headroom' };
  if (analysis.peakDb < -24) return { status: 'quiet', label: 'very quiet' };
  return { status: 'ready', label: 'ready to print' };
}

export function formatMixCheck(analysis) {
  const verdict = mixVerdict(analysis);
  if (verdict.status === 'silent') return `Mix check: ${verdict.label}`;
  const peak = analysis.peakDb > -100 ? `${analysis.peakDb.toFixed(1)} dBFS` : 'silent';
  return `Mix check · peak ${peak} · RMS ${analysis.rmsDb.toFixed(1)} dBFS · ${verdict.label}`;
}
