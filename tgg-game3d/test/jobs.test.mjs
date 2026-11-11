// The repeatable courier job. Run with: node test/jobs.test.mjs
import assert from 'node:assert/strict';
import {
  COURIER,
  canStartJob,
  cancelJob,
  completeJob,
  createJob,
  jobLabel,
  normalizeJob,
  startJob,
} from '../src/jobs.js';

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

test('a fresh job is idle with no runs', () => {
  const job = createJob();
  assert.deepEqual(job, { state: 'idle', runs: 0 });
  assert.equal(canStartJob(job, false), false, 'the board opened before Act I ended');
  assert.equal(canStartJob(job, true), true);
});

test('a parcel has to be collected before it can be dropped', () => {
  const job = createJob();
  assert.equal(completeJob(job), false, 'an idle job completed');
  assert.equal(startJob(job), true);
  assert.equal(job.state, 'carrying');
  assert.equal(startJob(job), false, 'the same parcel was collected twice');
  assert.equal(completeJob(job), true);
  assert.equal(job.state, 'idle');
  assert.equal(job.runs, 1);
});

test('runs accumulate across repeat deliveries', () => {
  const job = createJob();
  for (let i = 0; i < 3; i += 1) {
    startJob(job);
    completeJob(job);
  }
  assert.equal(job.runs, 3);
});

test('cancelling puts the parcel back without paying a run', () => {
  const job = createJob();
  startJob(job);
  assert.equal(cancelJob(job), true);
  assert.equal(job.state, 'idle');
  assert.equal(job.runs, 0);
  assert.equal(cancelJob(job), false);
});

test('the job survives a save round trip', () => {
  const raw = normalizeJob({ state: 'carrying', runs: '4' });
  assert.deepEqual(raw, { state: 'carrying', runs: 4 });
  assert.deepEqual(normalizeJob(null), { state: 'idle', runs: 0 });
  assert.deepEqual(normalizeJob({ state: 'nonsense', runs: -5 }), { state: 'idle', runs: 0 });
});

test('the label reads correctly in both states', () => {
  const job = createJob();
  assert.match(jobLabel(job), /0 done/);
  startJob(job);
  assert.match(jobLabel(job), /parcel aboard/);
});

test('the pickup and drop are the real Vault and Studio 808 positions', () => {
  assert.deepEqual(COURIER.pickup, { x: -156, z: 122 });
  assert.deepEqual(COURIER.drop, { x: 156, z: -122 });
});

console.log(`${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
