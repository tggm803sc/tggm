// Studio 808 production model: five tracks × sixteen steps, plus the mastering
// gate. Pure data and arithmetic only — no DOM, no audio — so it can be tested
// outside the browser and exported to another engine unchanged.

export const STEPS = 16;
export const MIN_BPM = 70;
export const MAX_BPM = 180;
export const DEFAULT_BPM = 96;
export const ACCEPT_QUALITY = 80;

// `ideal` is the density window a track is mixed at. Filling all sixteen steps
// scores worse than a part that leaves space, which is the point of the editor.
export const TRACKS = [
  { id: 'drums', label: 'Drums', short: 'DRM', weight: 0.3, ideal: [6, 10], color: '#c7ff00' },
  { id: 'bass', label: 'Bass', short: 'BAS', weight: 0.25, ideal: [4, 8], color: '#7fd4ff' },
  { id: 'melody', label: 'Melody', short: 'MEL', weight: 0.15, ideal: [3, 8], color: '#ffd166' },
  { id: 'chords', label: 'Chords', short: 'CHD', weight: 0.2, ideal: [4, 8], color: '#c48bff' },
  { id: 'percussion', label: 'Percussion', short: 'PRC', weight: 0.1, ideal: [3, 6], color: '#ff8b99' },
];

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

// A beat that already sounds like something; the player edits from here.
export const STARTER_STEPS = {
  drums: [0, 4, 6, 8, 12, 14],
  bass: [0, 3, 6, 10, 13],
  melody: [2, 5, 9, 14],
  chords: [0, 4, 8, 12],
  percussion: [1, 3, 7, 11, 15],
};

// Stored patterns are 16 booleans; the starter beat is written as step indices.
function maskFromBooleans(list) {
  return Array.from({ length: STEPS }, (_, index) => Boolean(list?.[index]));
}

function maskFromIndices(list) {
  const mask = Array(STEPS).fill(false);
  for (const step of Array.isArray(list) ? list : []) {
    if (Number.isInteger(step) && step >= 0 && step < STEPS) mask[step] = true;
  }
  return mask;
}

export function createPattern({ bpm = DEFAULT_BPM, hits = null } = {}) {
  const tracks = {};
  for (const track of TRACKS) {
    tracks[track.id] = {
      mute: false,
      volume: track.id === 'drums' ? 0.9 : 0.7,
      steps: maskFromIndices(hits?.[track.id]),
    };
  }
  return { bpm: clamp(Math.round(bpm), MIN_BPM, MAX_BPM), loop: true, tracks };
}

export function starterPattern() {
  return createPattern({ hits: STARTER_STEPS });
}

// Anything coming from storage or an imported file passes through here.
export function normalizePattern(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const tracks = {};
  for (const track of TRACKS) {
    const incoming = source.tracks?.[track.id] ?? {};
    tracks[track.id] = {
      mute: Boolean(incoming.mute),
      volume: clamp(Number(incoming.volume), 0, 1),
      steps: maskFromBooleans(incoming.steps),
    };
    if (!Number.isFinite(Number(incoming.volume))) tracks[track.id].volume = track.id === 'drums' ? 0.9 : 0.7;
  }
  return {
    bpm: clamp(Math.round(Number(source.bpm) || DEFAULT_BPM), MIN_BPM, MAX_BPM),
    loop: source.loop !== false,
    tracks,
  };
}

export function toggleStep(pattern, trackId, step) {
  const track = pattern.tracks[trackId];
  if (!track || step < 0 || step >= STEPS) return false;
  track.steps[step] = !track.steps[step];
  return track.steps[step];
}

export function setStep(pattern, trackId, step, on) {
  const track = pattern.tracks[trackId];
  if (!track || step < 0 || step >= STEPS) return;
  track.steps[step] = Boolean(on);
}

export function toggleMute(pattern, trackId) {
  const track = pattern.tracks[trackId];
  if (!track) return false;
  track.mute = !track.mute;
  return track.mute;
}

export function setVolume(pattern, trackId, value) {
  const track = pattern.tracks[trackId];
  if (!track) return 0;
  track.volume = clamp(Number(value) || 0, 0, 1);
  return track.volume;
}

export function setBpm(pattern, value) {
  pattern.bpm = clamp(Math.round(Number(value) || DEFAULT_BPM), MIN_BPM, MAX_BPM);
  return pattern.bpm;
}

export function setLoop(pattern, on) {
  pattern.loop = Boolean(on);
  return pattern.loop;
}

// Clearing wipes the notes, not the mix: tempo, mutes and volumes survive.
export function clearPattern(pattern) {
  for (const track of TRACKS) pattern.tracks[track.id].steps.fill(false);
  return pattern;
}

export function countSteps(pattern, trackId) {
  return (pattern.tracks[trackId]?.steps ?? []).filter(Boolean).length;
}

export function totalHits(pattern) {
  return TRACKS.reduce((sum, track) => sum + countSteps(pattern, track.id), 0);
}

export function activeTracks(pattern) {
  return TRACKS.filter((track) => countSteps(pattern, track.id) > 0).map((track) => track.id);
}

// How well the arrangement is put together, 0–100. Density windows, a downbeat
// kick, a backbeat and a bass root all matter; a thin or cluttered beat does not.
export function arrangementScore(pattern) {
  const beat = normalizePattern(pattern);
  let score = 0;

  for (const track of TRACKS) {
    const hits = countSteps(beat, track.id);
    const [low, high] = track.ideal;
    let fill = 0;
    if (hits > 0 && hits < low) fill = hits / low;
    else if (hits >= low && hits <= high) fill = 1;
    else if (hits > high) fill = Math.max(0.2, 1 - (hits - high) / (STEPS - high));
    score += track.weight * fill * 100;
  }

  if (beat.tracks.drums.steps[0]) score += 6;
  if (beat.tracks.drums.steps[4] && beat.tracks.drums.steps[12]) score += 4;
  if (beat.tracks.bass.steps[0]) score += 4;
  if (countSteps(beat, 'chords') >= 2) score += 2;

  if (totalHits(beat) < 12) score = Math.min(score, 40);
  return Math.round(clamp(score, 0, 100));
}

export function stepSeconds(bpm) {
  return 60 / clamp(Number(bpm) || DEFAULT_BPM, MIN_BPM, MAX_BPM) / 4;
}

// Timing still decides whether the engineer keeps the take; the arrangement
// decides how much it helps. 60/40 keeps the performance the hard part.
export function blendTake(arrangement, timing) {
  return Math.round(clamp(Number(arrangement) || 0, 0, 100) * 0.4 + clamp(Number(timing) || 0, 0, 100) * 0.6);
}

export function verdictFor(quality, { arrangement = 0, timing = 0 } = {}) {
  const accepted = quality >= ACCEPT_QUALITY;
  let line;
  if (accepted) line = 'Engineer: that is a master. Take it to The Vault.';
  else if (arrangement < 55) line = 'Engineer: the beat is too thin to master. Build the arrangement, then perform again.';
  else if (timing < 75) line = 'Engineer: the arrangement is there, the timing is not. Re-cut it.';
  else line = 'Engineer: close, but the mix and the take do not meet yet. Rework and re-cut.';
  return { accepted, quality, line };
}

// The mastering gate. Every check is a real condition on the saved pattern and
// the accepted take — nothing here is decorative.
export function assessMaster(pattern, take = null) {
  const beat = normalizePattern(pattern);
  const timing = Number(take?.timing) || 0;
  const arrangement = arrangementScore(beat);
  const checks = [
    {
      id: 'take',
      label: 'Engineer accepted a take',
      ok: Boolean(take?.accepted),
      detail: take?.accepted ? `Take ${take.quality}/100` : 'No accepted take yet',
    },
    {
      id: 'timing',
      label: 'Timing above 75',
      ok: timing >= 75,
      detail: `${timing}/100`,
    },
    {
      id: 'tracks',
      label: 'At least three tracks arranged',
      ok: activeTracks(beat).length >= 3,
      detail: `${activeTracks(beat).length} of 5`,
    },
    {
      id: 'groove',
      label: 'Kick on the downbeat',
      ok: beat.tracks.drums.steps[0],
      detail: beat.tracks.drums.steps[0] ? 'step 1' : 'step 1 empty',
    },
    {
      id: 'bass',
      label: 'Bass carries the low end',
      ok: countSteps(beat, 'bass') >= 4,
      detail: `${countSteps(beat, 'bass')} notes`,
    },
    {
      id: 'mix',
      label: 'Arrangement inside the mixing window',
      ok: arrangement >= 60,
      detail: `${arrangement}/100`,
    },
    {
      id: 'tempo',
      label: 'Tempo between 80 and 160',
      ok: beat.bpm >= 80 && beat.bpm <= 160,
      detail: `${beat.bpm} BPM`,
    },
  ];
  return {
    ready: checks.every((check) => check.ok),
    arrangement,
    checks,
  };
}

// Same beat in, same id out, so a reload cannot silently change the master.
export function patternHash(pattern) {
  const beat = normalizePattern(pattern);
  let hash = 2166136261;
  const push = (value) => {
    const code = Number(value) || 0;
    hash ^= code & 0xff;
    hash = Math.imul(hash, 16777619) >>> 0;
  };
  push(beat.bpm);
  push(totalHits(beat));
  for (const track of TRACKS) {
    push(track.id.length);
    for (const step of beat.tracks[track.id].steps) push(step ? 1 : 0);
  }
  return hash.toString(16).padStart(8, '0');
}
