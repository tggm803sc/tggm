// The recording session: tracks, clips, takes, undo history and comping. Pure
// data and arithmetic — no DOM, no AudioContext — so the editor can be tested
// in Node and exported to another engine unchanged.
//
// A clip is non-destructive: it points at a take (durable audio) and stores only
// the window into it plus where it sits on the timeline.

export const MAX_TRACKS = 32;
export const HISTORY_LIMIT = 60;

export const TRACK_KINDS = [
  { id: 'vocal', label: 'Main vocal', color: '#c7ff00' },
  { id: 'double', label: 'Vocal double', color: '#9fe870' },
  { id: 'adlib', label: 'Ad-libs', color: '#ffd166' },
  { id: 'bgv', label: 'Background vocals', color: '#7fd4ff' },
  { id: 'harmony', label: 'Harmonies', color: '#c48bff' },
  { id: 'instrumental', label: 'Instrumental', color: '#ff8b99' },
  { id: 'custom', label: 'Audio track', color: '#a8b3c2' },
];

export const FX_DEFAULTS = {
  eqLow: 0,
  eqMid: 0,
  eqHigh: 0,
  compThreshold: -24,
  compRatio: 3,
  gate: -60,
  deEss: 0,
  reverb: 0.12,
  delay: 0.08,
  saturation: 0,
  limiter: -1,
  bypass: false,
};

let idCounter = 0;
function nextId(prefix) {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter.toString(36)}`;
}

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function snapshot(session) {
  const copy = clone(session);
  delete copy._undo;
  delete copy._redo;
  return copy;
}

// Every mutation goes through here, so undo is uniform rather than per-feature.
export function pushHistory(session) {
  if (!Array.isArray(session._undo)) session._undo = [];
  session._undo.push(snapshot(session));
  if (session._undo.length > HISTORY_LIMIT) session._undo.shift();
  session._redo = [];
  return session;
}

export function undo(session) {
  if (!session._undo?.length) return false;
  const previous = session._undo.pop();
  if (!Array.isArray(session._redo)) session._redo = [];
  session._redo.push(snapshot(session));
  Object.assign(session, previous, { _undo: session._undo, _redo: session._redo });
  return true;
}

export function redo(session) {
  if (!session._redo?.length) return false;
  const next = session._redo.pop();
  if (!Array.isArray(session._undo)) session._undo = [];
  session._undo.push(snapshot(session));
  Object.assign(session, next, { _undo: session._undo, _redo: session._redo });
  return true;
}

export function createSession({ name = 'Untitled session', bpm = 96, sampleRate = 48000 } = {}) {
  return {
    version: 1,
    name,
    bpm: clamp(Math.round(Number(bpm) || 96), 40, 220),
    sampleRate: Number(sampleRate) || 48000,
    tracks: [],
    takes: {},
    master: { gain: 1, limiter: -1 },
    automation: {},
    automationPan: {},
    createdAt: Date.now(),
    updatedAt: Date.now(),
    _undo: [],
    _redo: [],
  };
}

export function createTrack(kind = 'custom', patch = {}) {
  const known = TRACK_KINDS.find((entry) => entry.id === kind) ?? TRACK_KINDS[TRACK_KINDS.length - 1];
  return {
    id: nextId('trk'),
    kind: known.id,
    name: patch.name ?? known.label,
    arm: Boolean(patch.arm),
    mute: false,
    solo: false,
    volume: 0.8,
    pan: 0,
    input: 'default',
    monitor: false,
    clips: [],
    fx: { ...FX_DEFAULTS, ...(patch.fx ?? {}) },
  };
}

export function addTrack(session, kind = 'custom', patch = {}) {
  if (session.tracks.length >= MAX_TRACKS) return null;
  pushHistory(session);
  const track = createTrack(kind, patch);
  session.tracks.push(track);
  session.updatedAt = Date.now();
  return track;
}

export function removeTrack(session, trackId) {
  const index = session.tracks.findIndex((track) => track.id === trackId);
  if (index === -1) return false;
  pushHistory(session);
  session.tracks.splice(index, 1);
  return true;
}

export function updateTrack(session, trackId, patch = {}) {
  const track = session.tracks.find((entry) => entry.id === trackId);
  if (!track) return null;
  pushHistory(session);
  for (const key of ['name', 'arm', 'mute', 'solo', 'volume', 'pan', 'input', 'monitor']) {
    if (patch[key] !== undefined) track[key] = patch[key];
  }
  if (patch.volume !== undefined) track.volume = clamp(Number(patch.volume) || 0, 0, 1.5);
  if (patch.pan !== undefined) track.pan = clamp(Number(patch.pan) || 0, -1, 1);
  session.updatedAt = Date.now();
  return track;
}

// Only one track can be armed for recording at a time: this is a vocal booth,
// not a 16-input console, and arming two inputs would record the same mic twice.
export function armTrack(session, trackId) {
  const target = session.tracks.find((track) => track.id === trackId);
  if (!target) return false;
  pushHistory(session);
  for (const track of session.tracks) track.arm = track.id === trackId ? !target.arm : false;
  return true;
}

export function addTake(session, take) {
  pushHistory(session);
  session.takes[take.id] = {
    id: take.id,
    trackId: take.trackId,
    name: take.name ?? 'Take',
    duration: Number(take.duration) || 0,
    sampleRate: Number(take.sampleRate) || session.sampleRate,
    createdAt: take.createdAt ?? Date.now(),
    // Audio lives in IndexedDB under this key; the session only references it.
    bufferKey: take.bufferKey ?? `take:${take.id}`,
  };
  return session.takes[take.id];
}

export function addClip(session, trackId, clip) {
  const track = session.tracks.find((entry) => entry.id === trackId);
  if (!track) return null;
  pushHistory(session);
  const created = {
    id: nextId('clip'),
    takeId: clip.takeId,
    start: Math.max(0, Number(clip.start) || 0),
    duration: Math.max(0.01, Number(clip.duration) || 0.01),
    offset: Math.max(0, Number(clip.offset) || 0),
    gain: Number.isFinite(Number(clip.gain)) ? Number(clip.gain) : 1,
    fadeIn: Math.max(0, Number(clip.fadeIn) || 0),
    fadeOut: Math.max(0, Number(clip.fadeOut) || 0),
    name: clip.name ?? 'Clip',
  };
  track.clips.push(created);
  session.updatedAt = Date.now();
  return created;
}

export function removeClip(session, trackId, clipId) {
  const track = session.tracks.find((entry) => entry.id === trackId);
  if (!track) return false;
  const index = track.clips.findIndex((clip) => clip.id === clipId);
  if (index === -1) return false;
  pushHistory(session);
  track.clips.splice(index, 1);
  return true;
}

export function moveClip(session, trackId, clipId, start) {
  const track = session.tracks.find((entry) => entry.id === trackId);
  const clip = track?.clips.find((entry) => entry.id === clipId);
  if (!clip) return false;
  pushHistory(session);
  clip.start = Math.max(0, Number(start) || 0);
  session.updatedAt = Date.now();
  return true;
}

// Trimming changes the window into the take, never the take itself.
export function trimClip(session, trackId, clipId, { start, duration, offset } = {}) {
  const track = session.tracks.find((entry) => entry.id === trackId);
  const clip = track?.clips.find((entry) => entry.id === clipId);
  if (!clip) return false;
  pushHistory(session);
  if (start !== undefined) clip.start = Math.max(0, Number(start) || 0);
  if (duration !== undefined) clip.duration = Math.max(0.01, Number(duration) || 0.01);
  if (offset !== undefined) clip.offset = Math.max(0, Number(offset) || 0);
  return true;
}

export function splitClip(session, trackId, clipId, at) {
  const track = session.tracks.find((entry) => entry.id === trackId);
  const clip = track?.clips.find((entry) => entry.id === clipId);
  if (!clip) return null;
  const point = Number(at);
  if (!Number.isFinite(point) || point <= clip.start || point >= clip.start + clip.duration) return null;
  pushHistory(session);
  const leftDuration = point - clip.start;
  const right = {
    ...clone(clip),
    id: nextId('clip'),
    start: point,
    duration: clip.duration - leftDuration,
    offset: clip.offset + leftDuration,
    fadeIn: 0,
  };
  clip.duration = leftDuration;
  clip.fadeOut = 0;
  track.clips.push(right);
  return { left: clip, right };
}

export function clipGain(session, track) {
  const anySolo = session.tracks.some((entry) => entry.solo);
  if (track.mute) return 0;
  if (anySolo && !track.solo) return 0;
  return clamp(Number(track.volume) || 0, 0, 1.5);
}

// Comping: copy a time range from one take into the comp track as its own clip,
// so the best line of each take can live on one track without losing the takes.
export function compSection(session, { fromTrackId, clipId, targetTrackId, from, to, name }) {
  const sourceTrack = session.tracks.find((track) => track.id === fromTrackId);
  const source = sourceTrack?.clips.find((clip) => clip.id === clipId);
  const target = session.tracks.find((track) => track.id === targetTrackId);
  if (!source || !target) return null;
  const begin = Number(from);
  const end = Number(to);
  if (!Number.isFinite(begin) || !Number.isFinite(end) || end <= begin) return null;
  const clipStart = Math.max(begin, source.start);
  const clipEnd = Math.min(end, source.start + source.duration);
  if (clipEnd <= clipStart) return null;
  return addClip(session, targetTrackId, {
    takeId: source.takeId,
    start: clipStart,
    duration: clipEnd - clipStart,
    offset: source.offset + (clipStart - source.start),
    name: name ?? 'Comp',
  });
}

// Volume automation: points of {time, value}, linear between points and held
// before the first and after the last. An empty lane is unity gain.
export function automationAt(points, time, fallback = 1) {
  if (!Array.isArray(points) || !points.length) return fallback;
  const at = Number(time) || 0;
  if (at <= points[0].time) return points[0].value;
  const last = points[points.length - 1];
  if (at >= last.time) return last.value;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    if (at <= b.time) {
      const span = b.time - a.time;
      if (span <= 0) return b.value;
      return a.value + ((b.value - a.value) * (at - a.time)) / span;
    }
  }
  return last.value;
}

export function normalizeAutomation(raw, low = 0, high = 1.2) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [trackId, points] of Object.entries(raw)) {
    if (!Array.isArray(points)) continue;
    const clean = points
      .map((point) => ({ time: Number(point?.time), value: Number(point?.value) }))
      .filter((point) => Number.isFinite(point.time) && Number.isFinite(point.value))
      .map((point) => ({ time: Math.max(0, point.time), value: clamp(point.value, low, high) }))
      .sort((a, b) => a.time - b.time)
      .slice(0, 128);
    if (clean.length) out[trackId] = clean;
  }
  return out;
}

// Adds a point at a time, replacing a near-identical one so a click does not
// stack points the user cannot separate again.
export function addAutomationPoint(session, trackId, time, value, { lane = 'automation', low = 0, high = 1.2 } = {}) {
  if (!session[lane] || typeof session[lane] !== 'object') session[lane] = {};
  const at = Math.max(0, Number(time) || 0);
  const level = clamp(Number(value) || 0, low, high);
  const points = (session[lane][trackId] ?? []).filter((point) => Math.abs(point.time - at) > 0.02);
  points.push({ time: at, value: level });
  points.sort((a, b) => a.time - b.time);
  session[lane][trackId] = points.slice(0, 128);
  return session[lane][trackId];
}

export function removeAutomationPoint(session, trackId, time, lane = 'automation') {
  const points = session[lane]?.[trackId];
  if (!Array.isArray(points)) return false;
  const at = Number(time) || 0;
  const next = points.filter((point) => Math.abs(point.time - at) > 0.02);
  if (next.length === points.length) return false;
  if (next.length) session[lane][trackId] = next;
  else delete session[lane][trackId];
  return true;
}

export function clearAutomation(session, trackId) {
  if (session.automation) delete session.automation[trackId];
}

export function masterGain(session) {
  const value = Number(session.master?.gain);
  return Number.isFinite(value) ? clamp(value, 0, 2) : 1;
}

// Soft-knee limiter: untouched below the threshold, smoothly capped above it,
// so nothing leaves the master above 0 dBFS.
export function limitSample(value, limiterDb = -1) {
  const threshold = 10 ** (clamp(Number(limiterDb) || -1, -12, 0) / 20);
  const magnitude = Math.abs(value);
  if (magnitude <= threshold) return value;
  return Math.sign(value) * (threshold + Math.tanh((magnitude - threshold) / threshold) * (1 - threshold));
}

export function projectDuration(session) {
  let end = 0;
  for (const track of session.tracks) {
    for (const clip of track.clips) end = Math.max(end, clip.start + clip.duration);
  }
  return end;
}

export function normalizeSession(raw) {
  if (!raw || typeof raw !== 'object') return createSession();
  const session = createSession({
    name: typeof raw.name === 'string' ? raw.name.slice(0, 80) : 'Untitled session',
    bpm: raw.bpm,
    sampleRate: raw.sampleRate,
  });
  session.createdAt = Number(raw.createdAt) || session.createdAt;
  session.updatedAt = Number(raw.updatedAt) || session.updatedAt;

  const takes = raw.takes && typeof raw.takes === 'object' ? raw.takes : {};
  for (const [id, take] of Object.entries(takes)) {
    if (!take || typeof take !== 'object') continue;
    session.takes[id] = {
      id,
      trackId: typeof take.trackId === 'string' ? take.trackId : '',
      name: typeof take.name === 'string' ? take.name.slice(0, 60) : 'Take',
      duration: Math.max(0, Number(take.duration) || 0),
      sampleRate: Number(take.sampleRate) || session.sampleRate,
      createdAt: Number(take.createdAt) || Date.now(),
      bufferKey: typeof take.bufferKey === 'string' ? take.bufferKey : `take:${id}`,
    };
  }

  session.master = {
    gain: clamp(Number(raw.master?.gain ?? 1), 0, 2),
    limiter: clamp(Number(raw.master?.limiter ?? -1), -12, 0),
  };
  session.automation = normalizeAutomation(raw.automation);
  session.automationPan = normalizeAutomation(raw.automationPan, -1, 1);

  const tracks = Array.isArray(raw.tracks) ? raw.tracks.slice(0, MAX_TRACKS) : [];
  for (const source of tracks) {
    if (!source || typeof source !== 'object') continue;
    const track = createTrack(source.kind, {
      name: typeof source.name === 'string' ? source.name.slice(0, 40) : undefined,
      fx: source.fx,
    });
    track.id = typeof source.id === 'string' ? source.id : track.id;
    track.arm = false; // arming is never restored: a reload must not be live
    track.mute = Boolean(source.mute);
    track.solo = Boolean(source.solo);
    track.volume = clamp(Number(source.volume) || 0.8, 0, 1.5);
    track.pan = clamp(Number(source.pan) || 0, -1, 1);
    track.input = typeof source.input === 'string' ? source.input : 'default';
    track.monitor = Boolean(source.monitor);
    track.fx = { ...FX_DEFAULTS, ...(source.fx && typeof source.fx === 'object' ? source.fx : {}) };
    track.clips = (Array.isArray(source.clips) ? source.clips : [])
      .filter((clip) => clip && typeof clip === 'object' && typeof clip.takeId === 'string')
      .map((clip) => ({
        id: typeof clip.id === 'string' ? clip.id : nextId('clip'),
        takeId: clip.takeId,
        start: Math.max(0, Number(clip.start) || 0),
        duration: Math.max(0.01, Number(clip.duration) || 0.01),
        offset: Math.max(0, Number(clip.offset) || 0),
        gain: Number.isFinite(Number(clip.gain)) ? Number(clip.gain) : 1,
        fadeIn: Math.max(0, Number(clip.fadeIn) || 0),
        fadeOut: Math.max(0, Number(clip.fadeOut) || 0),
        name: typeof clip.name === 'string' ? clip.name.slice(0, 60) : 'Clip',
      }));
    session.tracks.push(track);
  }
  return session;
}

export function serializeSession(session) {
  return snapshot(session);
}
