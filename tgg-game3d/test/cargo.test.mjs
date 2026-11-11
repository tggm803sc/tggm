// Headless tests for the Salt Flats cargo run, the tap-burst guard and the
// airport fields in save v2. Run with: node test/cargo.test.mjs
import assert from 'node:assert/strict';

const store = new Map();
globalThis.window = {
  localStorage: {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
  },
};

const cargo = await import(new URL('../src/cargo.js', import.meta.url).href);
const studio = await import(new URL('../src/studio.js', import.meta.url).href);
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

test('a new run starts idle with no crates', () => {
  const run = cargo.createCargo();
  assert.equal(run.state, 'idle');
  assert.equal(run.crates, 0);
  assert.equal(run.damage, 0);
  assert.equal(cargo.cargoLabel(run), 'CARGO EMPTY');
});

test('three crates load one press at a time', () => {
  const run = cargo.createCargo();
  assert.deepEqual(cargo.loadCrate(run), { crate: 1, crates: 3, ready: false });
  assert.equal(run.state, 'loading');
  cargo.loadCrate(run);
  assert.deepEqual(cargo.loadCrate(run), { crate: 3, crates: 3, ready: true });
  assert.equal(run.state, 'loaded');
  assert.equal(cargo.loadCrate(run), null);
});

test('departure needs a full load and starts the clock', () => {
  const run = cargo.createCargo();
  cargo.loadCrate(run);
  assert.equal(cargo.depart(run, 5), false);
  cargo.loadCrate(run);
  cargo.loadCrate(run);
  assert.equal(cargo.depart(run, 5), true);
  assert.equal(run.state, 'transit');
  assert.equal(run.startedAt, 5);
  assert.equal(cargo.depart(run, 9), false);
});

test('the clock counts down only in transit', () => {
  const run = cargo.createCargo();
  assert.equal(cargo.remaining(run, 500), cargo.CARGO_SECONDS);
  cargo.loadCrate(run);
  cargo.loadCrate(run);
  cargo.loadCrate(run);
  cargo.depart(run, 10);
  assert.equal(cargo.remaining(run, 40), cargo.CARGO_SECONDS - 30);
  assert.equal(cargo.remaining(run, 10_000), 0);
});

test('three hard hits write the freight off', () => {
  const run = cargo.createCargo();
  cargo.loadCrate(run);
  cargo.loadCrate(run);
  cargo.loadCrate(run);
  cargo.depart(run, 0);
  assert.deepEqual(cargo.damageCargo(run), { damage: 1, failed: false });
  assert.deepEqual(cargo.damageCargo(run), { damage: 2, failed: false });
  assert.deepEqual(cargo.damageCargo(run), { damage: 3, failed: true });
});

test('damage outside transit is ignored', () => {
  const run = cargo.createCargo();
  assert.deepEqual(cargo.damageCargo(run), { damage: 0, failed: false });
  cargo.loadCrate(run);
  cargo.loadCrate(run);
  cargo.loadCrate(run);
  cargo.depart(run, 0);
  cargo.deliverCargo(run, 30);
  assert.deepEqual(cargo.damageCargo(run), { damage: 0, failed: false });
});

test('fail records its reason and blocks delivery', () => {
  const run = cargo.createCargo();
  cargo.loadCrate(run);
  cargo.loadCrate(run);
  cargo.loadCrate(run);
  cargo.depart(run, 0);
  assert.equal(cargo.failCargo(run, 95, 'time'), true);
  assert.equal(run.state, 'failed');
  assert.equal(run.reason, 'time');
  assert.equal(cargo.deliverCargo(run, 96), false);
  assert.equal(cargo.failCargo(run, 97, 'time'), false);
});

test('delivery only counts once and keeps the attempt count', () => {
  const run = cargo.createCargo();
  cargo.loadCrate(run);
  cargo.loadCrate(run);
  cargo.loadCrate(run);
  cargo.depart(run, 0);
  assert.equal(cargo.deliverCargo(run, 60), true);
  assert.equal(run.state, 'delivered');
  assert.equal(run.attempts, 1);
  assert.equal(cargo.deliverCargo(run, 61), false);
  assert.equal(run.attempts, 1);
  const fresh = cargo.reloadCargo(run);
  assert.equal(fresh.state, 'idle');
  assert.equal(fresh.crates, 0);
  assert.equal(fresh.attempts, 1);
});

test('cargo normalises junk from storage', () => {
  const run = cargo.normalizeCargo({ state: 'hacked', crates: 99, damage: -4, reason: 'aliens' });
  assert.equal(run.state, 'idle');
  assert.equal(run.crates, cargo.CRATES);
  assert.equal(run.damage, 0);
  assert.equal(run.reason, null);
  assert.equal(cargo.normalizeCargo(null).state, 'idle');
});

test('a burst of taps is flagged and a timed pass is not', () => {
  const timed = new studio.StudioSession();
  timed.start();
  for (let i = 0; i < 8; i += 1) {
    timed.update(0.62);
    timed.tap();
  }
  assert.equal(timed.burst, false);
  assert.equal(timed.scores.length, 1);
  assert.ok(timed.scores[0] >= 90, `timed pass should score high, got ${timed.scores[0]}`);

  const burst = new studio.StudioSession();
  burst.start();
  for (let i = 0; i < 8; i += 1) burst.tap();
  assert.equal(burst.burst, true);
});

test('abort ends a pass without finishing it', () => {
  const session = new studio.StudioSession();
  session.start();
  session.tap();
  session.abort();
  assert.equal(session.active, false);
  assert.equal(session.finished, false);
});

test('save v2 keeps the cargo run, the van and the Maya unlock', () => {
  store.clear();
  const run = cargo.createCargo();
  cargo.loadCrate(run);
  cargo.loadCrate(run);
  cargo.loadCrate(run);
  cargo.depart(run, 12);
  cargo.damageCargo(run);

  const saved = prog.saveProgress({
    player: { alias: 'Sable', career: 'producer' },
    stage: 2,
    journal: { completed: [0, 1], maya: true },
    cargo: run,
    van: { x: 230, z: -226, heading: 1.2 },
  });

  assert.equal(saved.cargo.state, 'transit');
  assert.equal(saved.cargo.crates, 3);
  assert.equal(saved.cargo.damage, 1);
  assert.equal(saved.van.x, 230);
  assert.equal(saved.journal.maya, true);
  assert.deepEqual(saved.journal.completed, [0, 1]);

  store.clear();
  const restored = prog.importSave(prog.exportSave(saved));
  assert.equal(restored.cargo.state, 'transit');
  assert.equal(restored.cargo.startedAt, 12);
  assert.equal(restored.journal.maya, true);
  assert.equal(restored.stage, 2);
});

test('the run allows the airport stage and clamps beyond it', () => {
  const atAirport = prog.normalizeSave({ stage: 2, journal: { completed: [0, 1, 2, 9] } });
  assert.equal(atAirport.stage, 2);
  assert.deepEqual(atAirport.journal.completed, [0, 1, 2]);
  const beyond = prog.normalizeSave({ stage: 7 });
  assert.equal(beyond.stage, 2);
  const fresh = prog.normalizeSave({});
  assert.equal(fresh.journal.maya, false);
  assert.equal(fresh.cargo.state, 'idle');
  assert.equal(fresh.van, null);
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.log(`failed: ${failures.join(', ')}`);
  process.exitCode = 1;
}
