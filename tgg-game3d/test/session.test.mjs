// Session model and WAV export. Run with: node test/session.test.mjs
import assert from 'node:assert/strict';
import {
  MAX_TRACKS,
  addClip,
  addTake,
  addTrack,
  armTrack,
  clipGain,
  compSection,
  createSession,
  moveClip,
  normalizeSession,
  projectDuration,
  redo,
  removeClip,
  removeTrack,
  splitClip,
  trimClip,
  undo,
  updateTrack,
} from '../src/session.js';
import { encodeWav, mixdown, stemMixdown } from '../src/wav.js';

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

function sessionWithVocal() {
  const session = createSession({ name: 'Test', bpm: 96 });
  const vocal = addTrack(session, 'vocal');
  const take = addTake(session, { id: 't1', trackId: vocal.id, name: 'Take 1', duration: 10 });
  const clip = addClip(session, vocal.id, { takeId: take.id, start: 0, duration: 8, offset: 0 });
  return { session, vocal, clip, take };
}

test('a new session starts empty and sane', () => {
  const session = createSession({ name: 'Demo', bpm: 120 });
  assert.equal(session.tracks.length, 0);
  assert.equal(session.bpm, 120);
  assert.equal(session.version, 1);
});

test('tracks carry mix controls and an effect rack', () => {
  const session = createSession();
  const track = addTrack(session, 'vocal');
  assert.equal(track.kind, 'vocal');
  assert.equal(track.volume, 0.8);
  assert.equal(track.pan, 0);
  assert.equal(track.fx.compRatio, 3);
  updateTrack(session, track.id, { volume: 9, pan: -9 });
  assert.equal(track.volume, 1.5, 'volume was not clamped');
  assert.equal(track.pan, -1, 'pan was not clamped');
});

test('only one track is armed at a time', () => {
  const session = createSession();
  const a = addTrack(session, 'vocal');
  const b = addTrack(session, 'double');
  armTrack(session, a.id);
  armTrack(session, b.id);
  assert.equal(a.arm, false);
  assert.equal(b.arm, true);
  armTrack(session, b.id);
  assert.equal(b.arm, false, 'arming the armed track did not disarm it');
});

test('the track limit is enforced', () => {
  const session = createSession();
  for (let i = 0; i < MAX_TRACKS; i += 1) addTrack(session, 'custom');
  assert.equal(session.tracks.length, MAX_TRACKS);
  assert.equal(addTrack(session, 'custom'), null);
});

test('mute and solo decide the audible gain', () => {
  const session = createSession();
  const a = addTrack(session, 'vocal');
  const b = addTrack(session, 'double');
  updateTrack(session, b.id, { solo: true });
  assert.equal(clipGain(session, a), 0, 'a non-soloed track was audible during a solo');
  assert.equal(clipGain(session, b), 0.8);
  updateTrack(session, b.id, { solo: false, mute: true });
  assert.equal(clipGain(session, b), 0);
});

test('split creates two clips that still cover the original range', () => {
  const { session, vocal, clip } = sessionWithVocal();
  const parts = splitClip(session, vocal.id, clip.id, 3);
  assert.equal(parts.left.duration, 3);
  assert.equal(parts.right.start, 3);
  assert.equal(parts.right.duration, 5);
  assert.equal(parts.right.offset, 3);
  assert.equal(vocal.clips.length, 2);
  assert.equal(projectDuration(session), 8);
});

test('a split outside the clip is refused', () => {
  const { session, vocal, clip } = sessionWithVocal();
  assert.equal(splitClip(session, vocal.id, clip.id, 0), null);
  assert.equal(splitClip(session, vocal.id, clip.id, 99), null);
});

test('trim and move are non-destructive', () => {
  const { session, vocal, clip } = sessionWithVocal();
  trimClip(session, vocal.id, clip.id, { start: 1, duration: 4, offset: 2 });
  assert.deepEqual(
    { start: clip.start, duration: clip.duration, offset: clip.offset },
    { start: 1, duration: 4, offset: 2 },
  );
  moveClip(session, vocal.id, clip.id, 12);
  assert.equal(clip.start, 12);
  assert.equal(clip.takeId, 't1', 'the clip stopped pointing at its take');
});

test('undo and redo walk the history without losing takes', () => {
  const { session, vocal, clip } = sessionWithVocal();
  moveClip(session, vocal.id, clip.id, 20);
  assert.equal(session.tracks[0].clips[0].start, 20);
  assert.equal(undo(session), true);
  assert.equal(session.tracks[0].clips[0].start, 0);
  assert.equal(redo(session), true);
  assert.equal(session.tracks[0].clips[0].start, 20);
  assert.equal(undo(session), true);
  assert.equal(undo(session), true);
  // History replaces objects, so the UI must re-read from the session.
  assert.equal(session.takes.t1.name, 'Take 1');
});

test('undo stops at the first edit instead of throwing', () => {
  const session = createSession();
  assert.equal(undo(session), false);
  assert.equal(redo(session), false);
});

test('comping copies a range onto another track', () => {
  const session = createSession();
  const lead = addTrack(session, 'vocal');
  const comp = addTrack(session, 'double');
  const take = addTake(session, { id: 't1', trackId: lead.id, duration: 10 });
  const clip = addClip(session, lead.id, { takeId: take.id, start: 0, duration: 10, offset: 0 });
  const piece = compSection(session, {
    fromTrackId: lead.id,
    clipId: clip.id,
    targetTrackId: comp.id,
    from: 4,
    to: 7,
    name: 'Best line',
  });
  assert.ok(piece);
  assert.equal(piece.start, 4);
  assert.equal(piece.duration, 3);
  assert.equal(piece.offset, 4);
  assert.equal(piece.takeId, 't1', 'the comp stopped pointing at the source take');
  assert.equal(comp.clips.length, 1);
  // The source take is untouched.
  assert.equal(lead.clips[0].duration, 10);
});

test('comping clamps to the source clip', () => {
  const session = createSession();
  const lead = addTrack(session, 'vocal');
  const comp = addTrack(session, 'double');
  addTake(session, { id: 't1', trackId: lead.id, duration: 10 });
  const clip = addClip(session, lead.id, { takeId: 't1', start: 2, duration: 4, offset: 0 });
  const piece = compSection(session, {
    fromTrackId: lead.id,
    clipId: clip.id,
    targetTrackId: comp.id,
    from: 0,
    to: 99,
  });
  assert.equal(piece.start, 2);
  assert.equal(piece.duration, 4);
});

test('removing tracks and clips is undoable', () => {
  const { session, vocal, clip } = sessionWithVocal();
  removeClip(session, vocal.id, clip.id);
  assert.equal(session.tracks[0].clips.length, 0);
  undo(session);
  assert.equal(session.tracks[0].clips.length, 1);
  removeTrack(session, vocal.id);
  assert.equal(session.tracks.length, 0);
  undo(session);
  assert.equal(session.tracks.length, 1);
});

test('a session round-trips through JSON and drops arm on load', () => {
  const { session, vocal, clip } = sessionWithVocal();
  armTrack(session, vocal.id);
  const copy = normalizeSession(JSON.parse(JSON.stringify(session)));
  assert.equal(copy.tracks.length, 1);
  assert.equal(copy.tracks[0].clips[0].takeId, 't1');
  assert.equal(copy.tracks[0].arm, false, 'a reload left the track armed');
  assert.equal(copy.takes.t1.duration, 10);
  assert.equal(copy.bpm, 96);
  assert.ok(clip.id);
});

test('normalize refuses junk without throwing', () => {
  for (const junk of [null, undefined, 42, 'x', [], { tracks: [null, 5, {}] }]) {
    const session = normalizeSession(junk);
    assert.ok(Array.isArray(session.tracks));
  }
});

test('WAV encode writes a valid 16-bit stereo header', () => {
  const rate = 48000;
  const frames = 100;
  const left = new Float32Array(frames).fill(0.5);
  const right = new Float32Array(frames).fill(-0.5);
  const buffer = encodeWav([left, right], rate);
  const view = new DataView(buffer);
  const ascii = (offset, length) =>
    String.fromCharCode(...Array.from({ length }, (_, i) => view.getUint8(offset + i)));
  assert.equal(ascii(0, 4), 'RIFF');
  assert.equal(ascii(8, 4), 'WAVE');
  assert.equal(ascii(12, 4), 'fmt ');
  assert.equal(ascii(36, 4), 'data');
  assert.equal(view.getUint16(20, true), 1, 'not PCM');
  assert.equal(view.getUint16(22, true), 2, 'not stereo');
  assert.equal(view.getUint32(24, true), rate);
  assert.equal(view.getUint16(34, true), 16);
  assert.equal(view.getUint32(40, true), frames * 4);
  assert.equal(buffer.byteLength, 44 + frames * 4);
  // Int16 conversion truncates toward zero, it does not round.
  assert.equal(view.getInt16(44, true), Math.trunc(0.5 * 0x7fff));
  assert.equal(view.getInt16(46, true), Math.trunc(-0.5 * 0x8000));
});

test('WAV encode clamps instead of wrapping', () => {
  const buffer = encodeWav([new Float32Array([2, -2])], 48000);
  const view = new DataView(buffer);
  assert.equal(view.getInt16(44, true), 0x7fff);
  assert.equal(view.getInt16(46, true), -0x8000);
});

test('mixdown places clips on the timeline and sums them', () => {
  const session = createSession({ sampleRate: 1000 });
  const track = addTrack(session, 'vocal');
  addTake(session, { id: 't1', trackId: track.id, duration: 2 });
  addClip(session, track.id, { takeId: 't1', start: 1, duration: 1, offset: 0, gain: 1 });
  const samples = new Float32Array(1000).fill(0.25);
  const mix = mixdown(session, () => samples, { sampleRate: 1000 });
  assert.equal(mix.frames, 2000);
  assert.equal(mix.left[0], 0, 'audio landed before the clip start');
  // Centre pan is equal-power, so each side carries 1/sqrt(2) of the clip.
  const expected = 0.25 * 0.8 * Math.SQRT1_2;
  assert.ok(Math.abs(mix.left[1000] - expected) < 1e-6, `expected ${expected}, got ${mix.left[1000]}`);
  assert.ok(mix.peak > 0);
});

test('muted tracks and solos are respected by the mix', () => {
  const session = createSession({ sampleRate: 1000 });
  const a = addTrack(session, 'vocal');
  const b = addTrack(session, 'double');
  addTake(session, { id: 't1', trackId: a.id, duration: 1 });
  addTake(session, { id: 't2', trackId: b.id, duration: 1 });
  addClip(session, a.id, { takeId: 't1', start: 0, duration: 1 });
  addClip(session, b.id, { takeId: 't2', start: 0, duration: 1 });
  updateTrack(session, a.id, { mute: true });
  const samples = new Float32Array(1000).fill(0.2);
  const onlyB = mixdown(session, () => samples, { sampleRate: 1000 });
  assert.ok(Math.abs(onlyB.left[10] - 0.2 * 0.8 * Math.SQRT1_2) < 1e-6, 'the unmuted track vanished');
  updateTrack(session, b.id, { mute: true });
  const silent = mixdown(session, () => samples, { sampleRate: 1000 });
  assert.equal(silent.left[10], 0, 'a fully muted session still made sound');
});

test('stems export one pair per track and the track list is preserved', () => {
  const session = createSession({ sampleRate: 1000 });
  const a = addTrack(session, 'vocal');
  const b = addTrack(session, 'instrumental');
  addTake(session, { id: 't1', trackId: a.id, duration: 1 });
  addTake(session, { id: 't2', trackId: b.id, duration: 1 });
  addClip(session, a.id, { takeId: 't1', start: 0, duration: 1 });
  addClip(session, b.id, { takeId: 't2', start: 0, duration: 1 });
  updateTrack(session, b.id, { mute: true });
  const stems = stemMixdown(session, () => new Float32Array(1000).fill(0.3), { sampleRate: 1000 });
  assert.equal(stems.length, 2);
  const vocalStem = stems.find((stem) => stem.trackId === a.id);
  const instStem = stems.find((stem) => stem.trackId === b.id);
  assert.ok(vocalStem.left[10] > 0, 'the audible stem was silent');
  assert.equal(instStem.left[10], 0, 'a muted track leaked into its stem');
});

console.log(`${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
