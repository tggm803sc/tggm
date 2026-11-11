// On-device checks. The same code runs in the browser panel and in Node, so the
// phone build is verified by the game itself rather than by a checklist alone.
import { localBeats, validateStory } from './story.js';
import { createCargo, deliverCargo, depart, failCargo, loadCrate, remaining } from './cargo.js';
import { StudioSession, MIN_TAP_GAP } from './studio.js';
import { assessMaster, blendTake, starterPattern, verdictFor } from './sequencer.js';
import { normalizeSave, mixHash } from './progress.js';

function check(id, label, run) {
  try {
    const detail = run();
    return { id, label, ok: true, detail: detail || 'ok' };
  } catch (error) {
    return { id, label, ok: false, detail: String(error?.message ?? error).slice(0, 160) };
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export function runSelfTest() {
  const results = [];

  results.push(
    check('story', 'Offline director writes a valid two-beat run', () => {
      const story = validateStory(localBeats(4242, 0));
      assert(story, 'the offline story did not validate');
      assert(story.beats.length === 2, 'expected two beats');
      assert(story.beats[0].objective.length <= 60, 'objective too long');
      assert(/\(DEMO\)$/.test(story.beats[0].line), 'beat line must end with (DEMO)');
      return `${story.beats[0].objective} → ${story.beats[1].objective}`;
    }),
  );

  results.push(
    check('story-seed', 'The director is deterministic for a seed', () => {
      const a = JSON.stringify(localBeats(777, 0));
      const b = JSON.stringify(localBeats(777, 0));
      assert(a === b, 'the same seed produced different beats');
      return 'same seed, same beats';
    }),
  );

  results.push(
    check('cargo-load', 'Three crates fill the van before departure', () => {
      const cargo = createCargo();
      assert(!depart(cargo, 0).ok, 'departed with no crates');
      assert(!loadCrate(cargo).ready, 'left the bay after one crate');
      loadCrate(cargo);
      const third = loadCrate(cargo);
      assert(third.ready, 'three crates did not fill the van');
      depart(cargo, 12);
      assert(cargo.state === 'transit', 'the run did not start');
      return `${cargo.crates}/3 loaded, state ${cargo.state}`;
    }),
  );

  results.push(
    check('cargo-deliver', 'A run delivers once and suspends the clock', () => {
      const cargo = createCargo();
      for (let i = 0; i < 3; i += 1) loadCrate(cargo);
      depart(cargo, 10);
      assert(deliverCargo(cargo, 20), 'delivery was refused from transit');
      assert(cargo.state === 'delivered', 'state is not delivered');
      assert(!deliverCargo(cargo, 21), 'the same run delivered twice');
      return `delivered, ${remaining(cargo, 25)}s left on the clock`;
    }),
  );

  results.push(
    check('cargo-fail', 'A failed run records its reason', () => {
      const cargo = createCargo();
      for (let i = 0; i < 3; i += 1) loadCrate(cargo);
      depart(cargo, 0);
      assert(failCargo(cargo, 95, 'time'), 'the clock did not fail the run');
      assert(cargo.state === 'failed' && cargo.reason === 'time', 'the reason was not saved');
      assert(!deliverCargo(cargo, 96), 'a failed run still delivered');
      return 'failed · time';
    }),
  );

  results.push(
    check('take-gate', 'Eight taps in one frame are refused as a burst', () => {
      const session = new StudioSession();
      session.start();
      for (let i = 0; i < 8; i += 1) session.tap();
      assert(session.burst, 'the burst was not detected');
      assert(MIN_TAP_GAP > 0, 'the minimum tap gap is not set');
      session.abort();
      return `burst flagged · gap ${MIN_TAP_GAP}s`;
    }),
  );

  results.push(
    check('master-gate', 'A mastered take needs a real arrangement', () => {
      const pattern = starterPattern();
      const gate = assessMaster(pattern, {
        accepted: true,
        quality: 90,
        timing: 90,
        arrangement: 90,
        bpm: pattern.bpm,
        burst: false,
      });
      assert(gate.ready, 'a good take was refused by the mastering gate');
      const bad = verdictFor(20, { arrangement: 10, timing: 20 });
      assert(!bad.accepted, 'a weak take was accepted');
      const blended = blendTake(90, 90);
      assert(blended >= 80, 'a strong take did not pass the blend');
      return `gate ready · blend ${blended}`;
    }),
  );

  results.push(
    check('save', 'A save round-trips and clamps the stage', () => {
      const save = normalizeSave({
        stage: 9,
        complete: true,
        journal: { completed: [0, 1, 2, 99], maya: true },
        cargo: { state: 'delivered', crates: 3 },
      });
      assert(save, 'the save did not normalise');
      assert(save.stage === 2, `stage clamped to ${save.stage}`);
      assert(save.journal.maya === true, 'the Maya unlock was lost');
      assert(!save.journal.completed.includes(99), 'an out-of-range mission survived');
      return `stage ${save.stage} · missions ${save.journal.completed.join(',')}`;
    }),
  );

  results.push(
    check('hash', 'The mix hash is stable for the same take', () => {
      const a = mixHash(88, [90, 86], 1234);
      const b = mixHash(88, [90, 86], 1234);
      assert(a === b, 'the same take hashed differently');
      assert(mixHash(89, [90, 86], 1234) !== a, 'a different take hashed the same');
      return a;
    }),
  );

  const failed = results.filter((row) => !row.ok).length;
  return {
    at: Date.now(),
    total: results.length,
    passed: results.length - failed,
    failed,
    results,
  };
}

// One line per check, for a phone screen or a terminal.
export function formatSelfTest(report) {
  const head = `TGG self-test · ${report.passed}/${report.total} passed${report.failed ? ` · ${report.failed} failed` : ''}`;
  return [head, ...report.results.map((row) => `${row.ok ? 'PASS' : 'FAIL'} ${row.label} — ${row.detail}`)].join(
    '\n',
  );
}
