// Headless tests for the Studio 808 production model, the release guards and the
// save round trip. Run with: node test/production.test.mjs
import assert from 'node:assert/strict';

const store = new Map();
globalThis.window = {
  localStorage: {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
  },
};

const seq = await import(new URL('../src/sequencer.js', import.meta.url).href);
const rel = await import(new URL('../src/release.js', import.meta.url).href);
const prog = await import(new URL('../src/progress.js', import.meta.url).href);

let passed = 0;
const failures = [];
function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`ok ${passed} — ${name}`);
  } catch (error) {
    failures.push(name);
    console.log(`FAIL — ${name}: ${error.message}`);
  }
}

test('pattern has five tracks of sixteen empty steps', () => {
  const pattern = seq.createPattern();
  assert.equal(pattern.bpm, 96);
  assert.equal(pattern.loop, true);
  assert.deepEqual(Object.keys(pattern.tracks), ['drums', 'bass', 'melody', 'chords', 'percussion']);
  for (const track of Object.values(pattern.tracks)) {
    assert.equal(track.steps.length, 16);
    assert.equal(track.steps.every((step) => step === false), true);
    assert.equal(track.mute, false);
  }
});

test('steps edit independently per track', () => {
  const pattern = seq.createPattern();
  seq.toggleStep(pattern, 'melody', 3);
  assert.equal(pattern.tracks.melody.steps[3], true);
  assert.equal(pattern.tracks.drums.steps[3], false);
  seq.toggleStep(pattern, 'drums', 0);
  assert.equal(seq.countSteps(pattern, 'drums'), 1);
  assert.equal(seq.countSteps(pattern, 'melody'), 1);
  seq.toggleStep(pattern, 'melody', 3);
  assert.equal(seq.countSteps(pattern, 'melody'), 0);
});

test('mute and volume are per track and clamped', () => {
  const pattern = seq.createPattern();
  assert.equal(seq.toggleMute(pattern, 'bass'), true);
  assert.equal(pattern.tracks.bass.mute, true);
  assert.equal(pattern.tracks.drums.mute, false);
  assert.equal(seq.setVolume(pattern, 'bass', 2), 1);
  assert.equal(seq.setVolume(pattern, 'bass', -3), 0);
  assert.equal(seq.setVolume(pattern, 'bass', 0.42), 0.42);
  assert.equal(pattern.tracks.drums.volume, 0.9);
});

test('bpm clamps to the supported range', () => {
  const pattern = seq.createPattern();
  assert.equal(seq.setBpm(pattern, 30), 70);
  assert.equal(seq.setBpm(pattern, 400), 180);
  assert.equal(seq.setBpm(pattern, 120), 120);
});

test('clear empties notes but keeps the mix', () => {
  const pattern = seq.starterPattern();
  seq.setBpm(pattern, 128);
  seq.toggleMute(pattern, 'chords');
  seq.setVolume(pattern, 'bass', 0.33);
  seq.clearPattern(pattern);
  assert.equal(seq.totalHits(pattern), 0);
  assert.equal(pattern.bpm, 128);
  assert.equal(pattern.tracks.chords.mute, true);
  assert.equal(pattern.tracks.bass.volume, 0.33);
});

test('normalize rejects junk and pads short patterns', () => {
  seq.starterPattern();
  const pattern = seq.normalizePattern({
    bpm: 999,
    loop: 'yes',
    tracks: { bass: { volume: 5, steps: [true, 1, 0] }, nonsense: { steps: [true] } },
  });
  assert.equal(pattern.bpm, 180);
  assert.equal(pattern.loop, true);
  assert.equal(pattern.tracks.bass.volume, 1);
  assert.equal(pattern.tracks.bass.steps.length, 16);
  assert.equal(pattern.tracks.bass.steps[0], true);
  assert.equal(pattern.tracks.bass.steps[1], true);
  assert.equal(pattern.tracks.bass.steps[2], false);
  assert.equal(pattern.tracks.drums.volume, 0.9);
  assert.equal('nonsense' in pattern.tracks, false);
  assert.equal(seq.normalizePattern(null).bpm, 96);
});

test('arrangement scores the starter beat high and empty or cluttered beats low', () => {
  assert.equal(seq.arrangementScore(seq.starterPattern()), 100);
  assert.equal(seq.arrangementScore(seq.createPattern()), 0);
  const full = seq.createPattern();
  for (const track of seq.TRACKS) full.tracks[track.id].steps.fill(true);
  const fullScore = seq.arrangementScore(full);
  assert.ok(fullScore < 60, `cluttered beat should fail the mix gate, got ${fullScore}`);
  const thin = seq.createPattern();
  thin.tracks.drums.steps[0] = true;
  assert.ok(seq.arrangementScore(thin) <= 40);
});

test('take quality blends performance with arrangement', () => {
  assert.equal(seq.blendTake(100, 60), 76);
  assert.equal(seq.blendTake(100, 90), 94);
  assert.equal(seq.blendTake(0, 100), 60);
  assert.equal(seq.verdictFor(94).accepted, true);
  assert.equal(seq.verdictFor(76).accepted, false);
  assert.equal(seq.verdictFor(79).accepted, false);
  assert.equal(seq.verdictFor(80).accepted, true);
});

test('mastering gate needs a real accepted take and a usable mix', () => {
  const good = { accepted: true, quality: 94, timing: 90, arrangement: 100 };
  assert.equal(seq.assessMaster(seq.starterPattern(), good).ready, true);
  assert.equal(seq.assessMaster(seq.starterPattern(), null).ready, false);
  assert.equal(seq.assessMaster(seq.starterPattern(), { ...good, accepted: false }).ready, false);
  assert.equal(seq.assessMaster(seq.starterPattern(), { ...good, timing: 60 }).ready, false);

  const slow = seq.starterPattern();
  seq.setBpm(slow, 70);
  const slowGate = seq.assessMaster(slow, good);
  assert.equal(slowGate.ready, false);
  assert.equal(slowGate.checks.find((check) => check.id === 'tempo').ok, false);

  const noBass = seq.starterPattern();
  noBass.tracks.bass.steps.fill(false);
  assert.equal(seq.assessMaster(noBass, good).ready, false);

  const noKick = seq.starterPattern();
  noKick.tracks.drums.steps[0] = false;
  assert.equal(seq.assessMaster(noKick, good).ready, false);
});

test('pattern hash is stable and sensitive to edits', () => {
  const a = seq.starterPattern();
  const b = seq.starterPattern();
  assert.equal(seq.patternHash(a), seq.patternHash(b));
  seq.toggleStep(a, 'melody', 1);
  assert.notEqual(seq.patternHash(a), seq.patternHash(b));
  seq.setBpm(b, 120);
  assert.notEqual(seq.patternHash(a), seq.patternHash(b));
});

test('release guards move one step at a time', () => {
  assert.deepEqual(rel.canHandOver({ releaseState: 'mastered', deliveryState: 'idle', stage: 1, complete: false, masterReady: true }), { ok: true, reason: 'ok' });
  assert.equal(rel.canHandOver({ releaseState: 'mastered', deliveryState: 'idle', stage: 0, complete: false, masterReady: true }).ok, false);
  assert.equal(rel.canHandOver({ releaseState: 'mastered', deliveryState: 'idle', stage: 1, complete: false, masterReady: false }).ok, false);
  assert.equal(rel.canHandOver({ releaseState: 'draft', deliveryState: 'idle', stage: 1, complete: false, masterReady: true }).ok, false);
  assert.equal(rel.canHandOver({ releaseState: 'mastered', deliveryState: 'pending', stage: 1, complete: false, masterReady: true }).ok, false);

  assert.equal(rel.confirmFrom('delivery-pending'), 'confirmed');
  assert.equal(rel.confirmFrom('mastered'), null);
  assert.equal(rel.confirmFrom('confirmed'), null);
  assert.equal(rel.releaseFrom('confirmed'), 'released');
  assert.equal(rel.releaseFrom('delivery-pending'), null);
  assert.equal(rel.releaseFrom('released'), null);
});

test('release chain cannot double-release', () => {
  let state = 'mastered';
  const handover = rel.canHandOver({ releaseState: state, deliveryState: 'idle', stage: 1, complete: false, masterReady: true });
  assert.equal(handover.ok, true);
  state = 'delivery-pending';
  const confirmed = rel.confirmFrom(state);
  assert.equal(confirmed, 'confirmed');
  assert.equal(rel.confirmFrom(confirmed), null);
  state = rel.releaseFrom(confirmed);
  assert.equal(state, 'released');
  assert.equal(rel.releaseFrom(state), null);
  assert.equal(rel.confirmFrom(state), null);
  assert.equal(rel.canHandOver({ releaseState: state, deliveryState: 'idle', stage: 1, complete: false, masterReady: true }).ok, false);
});

test('save v2 keeps the pattern, mix and take through export/import', () => {
  store.clear();
  const pattern = seq.starterPattern();
  seq.setBpm(pattern, 128);
  seq.toggleMute(pattern, 'percussion');
  seq.toggleStep(pattern, 'chords', 15);
  const take = { accepted: true, quality: 91, timing: 88, arrangement: 100 };

  const saved = prog.saveProgress({
    player: { alias: 'Sable', career: 'producer' },
    stage: 1,
    release: { state: 'confirmed', quality: 91, hash: 'abc12345', title: 'Slow Lane', bpm: 128, key: 'A min' },
    production: { pattern, take, captures: 3 },
  });

  assert.equal(saved.release.state, 'confirmed');
  assert.equal(saved.production.pattern.bpm, 128);
  assert.equal(saved.production.pattern.tracks.percussion.mute, true);
  assert.equal(saved.production.pattern.tracks.chords.steps[15], true);
  assert.equal(saved.production.captures, 3);
  assert.equal(saved.production.take.accepted, true);

  const text = prog.exportSave(saved);
  store.clear();
  const restored = prog.importSave(text);
  assert.deepEqual(restored.production.pattern.tracks.chords.steps, saved.production.pattern.tracks.chords.steps);
  assert.equal(restored.production.pattern.bpm, 128);
  assert.equal(restored.production.take.quality, 91);
  assert.equal(restored.release.state, 'confirmed');

  const junk = prog.importSave('{"format":"not-tgg"}');
  assert.equal(junk, null);
});

test('v1 saves still migrate and gain an empty production', () => {
  store.clear();
  store.set(
    'tgg.world.act1.v1',
    JSON.stringify({ stage: 1, release: { state: 'delivered' }, studioQuality: 66, radioAvailable: true }),
  );
  const migrated = prog.loadProgress();
  assert.ok(migrated);
  assert.equal(migrated.version, 2);
  assert.equal(migrated.release.state, 'draft');
  assert.equal(migrated.studioQuality, 66);
  assert.equal(seq.totalHits(migrated.production.pattern), 0);
  assert.equal(migrated.production.captures, 0);
  assert.equal(store.has('tgg.world.act1.v1'), false);
});

test('release order includes the confirmed step', () => {
  assert.deepEqual(prog.RELEASE_ORDER, ['draft', 'mastered', 'delivery-pending', 'confirmed', 'released']);
  const save = prog.normalizeSave({ stage: 0, release: { state: 'confirmed' } });
  assert.equal(save.release.state, 'confirmed');
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.log(`failed: ${failures.join(', ')}`);
  process.exitCode = 1;
}
