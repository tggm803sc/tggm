// The self-test the phone runs, plus the Worker's built-in director, checked in
// Node. Run with: node test/selftest.test.mjs
import assert from 'node:assert/strict';
import { runSelfTest, formatSelfTest } from '../src/selftest.js';
import { builtinStory, handleStory, handleVerify } from '../worker.js';

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`ok   ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${name}`);
    console.error(`     ${error.message}`);
  }
}

await test('the self-test passes every engine check', () => {
  const report = runSelfTest();
  const bad = report.results.filter((row) => !row.ok);
  assert.equal(bad.length, 0, `failing checks: ${bad.map((row) => `${row.id} (${row.detail})`).join(', ')}`);
  assert.equal(report.total, 9, `expected 9 checks, got ${report.total}`);
  assert.equal(report.failed, 0);
  assert.match(formatSelfTest(report), /9\/9 passed/);
});

await test('the built-in director is deterministic and demo-labelled', () => {
  const a = builtinStory(4242, 0);
  const b = builtinStory(4242, 0);
  assert.deepEqual(a, b);
  assert.equal(a.source, 'builtin');
  assert.equal(a.beats.length, 2);
  for (const beat of a.beats) {
    assert.ok(beat.objective.length > 0 && beat.objective.length <= 60, `objective length ${beat.objective.length}`);
    assert.ok(beat.line.length <= 90, `line length ${beat.line.length}`);
    assert.match(beat.line, /\(DEMO\)$/);
  }
  assert.notDeepEqual(builtinStory(4243, 0), a);
});

await test('the airport stage is told as the cargo run', () => {
  const story = builtinStory(9, 2);
  assert.match(story.beats[0].objective, /Salt Flats/);
  assert.match(story.beats[1].objective, /Vault/);
});

await test('verify answers without a key instead of 501', async () => {
  const response = await handleVerify(new Request('https://example.test/api/story/verify'), {});
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.provider, 'builtin');
  assert.equal(body.keys.OLLAMA_BASE_URL, false);
  assert.equal(body.model.configured, false);
  assert.ok(Array.isArray(body.steps) && body.steps.length > 0);
});

await test('the story route writes a run without a key', async () => {
  const response = await handleStory(
    new Request('https://example.test/api/story', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ seed: 77, stage: 0 }),
    }),
    {},
  );
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.source, 'builtin');
  assert.equal(body.beats.length, 2);
  assert.match(body.beats[0].line, /\(DEMO\)$/);
});

await test('a configured but unreachable model still returns usable beats', async () => {
  const response = await handleStory(
    new Request('https://example.test/api/story', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ seed: 5, stage: 1 }),
    }),
    { ZAI_API_KEY: 'not-a-real-key', ZAI_API_BASE: 'http://127.0.0.1:9' },
  );
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.source, 'builtin');
  assert.equal(body.degraded, 'zai');
  assert.equal(body.beats.length, 2);
});

console.log(`${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
