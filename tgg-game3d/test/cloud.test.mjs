import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveApiBase,
  progressToSave,
  saveToProgress,
  mergeProgress,
  localBeatsRemote,
  createCloudSave,
  makeRunId,
} from '../src/cloud.js';

function stubFetch(responses) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, init });
    const next = responses.shift();
    if (typeof next === 'function') return next(url, init);
    if (next instanceof Error) throw next;
    return { status: next.status, json: async () => next.body };
  };
  return { fetchImpl, calls };
}

test('same origin is the default API base', () => {
  assert.equal(resolveApiBase({}), '');
  assert.equal(resolveApiBase({ override: '   ' }), '');
});

test('an explicit host is reduced to its origin', () => {
  assert.equal(
    resolveApiBase({ override: 'https://tgg.example.com/api/world?x=1' }),
    'https://tgg.example.com',
  );
  assert.equal(
    resolveApiBase({ pageOrigin: 'https://game.example.com', override: '/backend' }),
    'https://game.example.com',
  );
});

test('an unusable host disables sync instead of guessing', () => {
  assert.equal(resolveApiBase({ override: 'ftp://files.example.com' }), null);
  assert.equal(resolveApiBase({ override: 'http://' }), null);
});

test('query override wins over the meta tag', () => {
  assert.equal(
    resolveApiBase({ override: 'https://a.example', meta: 'https://b.example' }),
    'https://a.example',
  );
  assert.equal(resolveApiBase({ meta: 'https://b.example' }), 'https://b.example');
});

test('progress converts to the server save in milliseconds', () => {
  assert.deepEqual(progressToSave({ best: 12.345, runs: 3, lastRun: 20.5 }, 4), {
    version: 2,
    revision: 4,
    bestRunMs: 12345,
    runs: 3,
    career: { lastRunMs: 20500 },
  });
});

test('empty or broken local progress still produces a valid body', () => {
  assert.deepEqual(progressToSave(null, -3), {
    version: 2,
    revision: 0,
    bestRunMs: null,
    runs: 0,
    career: { lastRunMs: null },
  });
});

test('a stored save maps back to local seconds', () => {
  assert.deepEqual(
    saveToProgress({ bestRunMs: 750, runs: 2, career: { lastRunMs: 1500 } }),
    { version: 2, best: 0.75, runs: 2, lastRun: 1.5 },
  );
  assert.deepEqual(saveToProgress(null), { version: 2, best: null, runs: 0, lastRun: null });
});

test('merge keeps the better best, more runs and the local last run', () => {
  assert.deepEqual(
    mergeProgress({ best: 9.5, runs: 1, lastRun: 9.5 }, { best: 7, runs: 4, lastRun: 8 }),
    { version: 2, best: 7, runs: 4, lastRun: 9.5 },
  );
  assert.deepEqual(
    mergeProgress({ best: null, runs: 0, lastRun: null }, { best: 7, runs: 4, lastRun: 8 }),
    { version: 2, best: 7, runs: 4, lastRun: 8 },
  );
});

test('localBeatsRemote only fires for a genuinely faster device result', () => {
  assert.equal(localBeatsRemote({ best: 6 }, { best: 7 }), true);
  assert.equal(localBeatsRemote({ best: 7 }, { best: 7 }), false);
  assert.equal(localBeatsRemote({ best: 8 }, { best: 7 }), false);
  assert.equal(localBeatsRemote({ best: 8 }, { best: null }), true);
  assert.equal(localBeatsRemote({ best: null }, { best: null }), false);
});

test('without a fetch implementation the client is simply disabled', async () => {
  const cloud = createCloudSave({ fetchImpl: null });
  assert.equal(cloud.enabled, false);
  assert.deepEqual(await cloud.load(), { state: 'disabled' });
  assert.deepEqual(await cloud.submitRun({ runId: 'abcdefgh', totalMs: 1, legs: [] }), {
    state: 'disabled',
  });
});

test('load reads the save, and reports an empty career as ok', async () => {
  const { fetchImpl, calls } = stubFetch([
    { status: 200, body: { ok: true, save: { revision: 3, bestRunMs: 900, runs: 2 } } },
    { status: 200, body: { ok: true, save: null } },
  ]);
  const cloud = createCloudSave({ fetchImpl });
  const found = await cloud.load();
  assert.equal(found.state, 'ok');
  assert.equal(found.save.revision, 3);
  assert.deepEqual(await cloud.load(), { state: 'ok', save: null });
  assert.equal(calls[0].url, '/api/world/save');
  assert.equal(calls[0].init.credentials, 'include');
});

test('load separates signed-out, missing and unreachable servers', async () => {
  const { fetchImpl } = stubFetch([
    { status: 401, body: { error: 'unauthenticated' } },
    { status: 404, body: null },
    new Error('offline'),
  ]);
  const cloud = createCloudSave({ fetchImpl });
  assert.equal((await cloud.load()).state, 'signed-out');
  assert.equal((await cloud.load()).state, 'failed');
  assert.equal((await cloud.load()).state, 'unreachable');
});

test('push sends JSON with credentials and surfaces a stale revision', async () => {
  const { fetchImpl, calls } = stubFetch([
    { status: 201, body: { ok: true, save: { revision: 1 } } },
    { status: 409, body: { error: 'stale_revision', save: { revision: 7, bestRunMs: 700 } } },
    { status: 400, body: { error: 'invalid_best_run' } },
  ]);
  const cloud = createCloudSave({ fetchImpl });
  const created = await cloud.push({ best: 9, runs: 1 }, 0);
  assert.equal(created.state, 'ok');
  assert.equal(calls[0].init.method, 'PUT');
  assert.equal(calls[0].init.headers['content-type'], 'application/json');
  assert.equal(JSON.parse(calls[0].init.body).bestRunMs, 9000);

  const stale = await cloud.push({ best: 9, runs: 1 }, 0);
  assert.equal(stale.state, 'conflict');
  assert.equal(stale.save.revision, 7);

  assert.equal((await cloud.push({ best: 9, runs: 1 }, 0)).state, 'failed');
});

test('a finished run posts splits and reports a duplicate retry', async () => {
  const { fetchImpl, calls } = stubFetch([
    { status: 201, body: { ok: true, duplicate: false, save: { revision: 4 } } },
    { status: 200, body: { ok: true, duplicate: true } },
  ]);
  const cloud = createCloudSave({ fetchImpl });
  const run = { runId: 'abc12345', totalMs: 750, legs: [600, 150] };
  const first = await cloud.submitRun(run);
  assert.equal(first.state, 'ok');
  assert.equal(first.duplicate, false);
  assert.equal(calls[0].url, '/api/world/runs');
  assert.deepEqual(JSON.parse(calls[0].init.body), run);
  assert.equal((await cloud.submitRun(run)).duplicate, true);
});

test('a hanging server is abandoned instead of stalling the call', async () => {
  const fetchImpl = (url, init = {}) =>
    new Promise((_, reject) => {
      init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
    });
  const cloud = createCloudSave({ fetchImpl, timeoutMs: 10 });
  assert.equal((await cloud.load()).state, 'unreachable');
});

test('run ids are server-valid idempotency keys', () => {
  for (let i = 0; i < 20; i += 1) {
    const id = makeRunId();
    assert.match(id, /^[A-Za-z0-9_-]{8,64}$/);
  }
  assert.equal(makeRunId(() => 0.5, () => 1234).length >= 8, true);
});
