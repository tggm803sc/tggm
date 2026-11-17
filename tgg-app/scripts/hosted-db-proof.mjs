// Proof run for a hosted career database.
//
// Called by scripts/verify-hosted-db.sh after migrations and a healthy app.
// Prints the database host only (never credentials) and asserts the eight
// required behaviours. Exits non-zero if any check fails, so CI fails visibly
// instead of printing a disappointing log and going green.
//
// KEEP_PROOF_PLAYERS=1 leaves the two throwaway players and their rows behind
// for manual inspection; by default they are removed again.
import { PrismaClient } from '@prisma/client';
import { createCloudSave, saveToProgress, mergeProgress } from '../../tgg-game3d/src/cloud.js';

const APP = process.env.APP_URL ?? 'http://127.0.0.1:3200';
const KEEP = process.env.KEEP_PROOF_PLAYERS === '1';
const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set');
  process.exit(2);
}

let where = 'unparseable';
try {
  const parsed = new URL(url);
  const sslmode = parsed.searchParams.get('sslmode');
  where = `${parsed.hostname}:${parsed.port || 5432}${parsed.pathname}${sslmode ? ` (sslmode=${sslmode})` : ''}`;
} catch {
  /* keep the placeholder */
}

const results = [];
const print = (label, value) => console.log(label.padEnd(34), JSON.stringify(value));
const check = (label, ok, value) => {
  results.push({ label, ok });
  print(label, value);
};

const db = new PrismaClient();
const players = [];
for (const steamId of ['76561190000090001', '76561190000090002']) {
  players.push(
    await db.tggPlayer.upsert({
      where: { steamId },
      update: {},
      create: { steamId },
      select: { id: true },
    }),
  );
}
const [A, B] = players;

async function clearProofRows() {
  await db.tggWorldRun.deleteMany({ where: { playerId: { in: [A.id, B.id] } } });
  await db.tggWorldSave.deleteMany({ where: { playerId: { in: [A.id, B.id] } } });
}

// Start from a known state.
await clearProofRows();

const withCookie = (cookie) => (path, init = {}) =>
  fetch(APP + path, { ...init, headers: { ...init.headers, ...(cookie ? { cookie } : {}) } });
const cloud = (cookie) => createCloudSave({ base: '', fetchImpl: withCookie(cookie) });

print('database', where);

try {
  // 1. Database health.
  let health = null;
  try {
    health = await (await fetch(`${APP}/api/world/health`)).json();
  } catch {
    health = null;
  }
  check('1. health', Boolean(health?.ok) && health?.database === 'up', health);

  // 2. Anonymous access is refused.
  const anonymous = await cloud('').load();
  check('2. anonymous load', anonymous.state === 'signed-out' && anonymous.status === 401, anonymous);

  const a = cloud(`tgg_player_id=${A.id}`);
  const first = await a.load();
  print('A load (new career)', first);

  // 3. A first save is created at revision 1.
  const created = await a.push({ best: 1.2, runs: 1 }, 0);
  check(
    '3. first save',
    created.state === 'ok' && created.save?.revision === 1 && created.save?.bestRunMs === 1200,
    { state: created.state, revision: created.save?.revision, bestRunMs: created.save?.bestRunMs },
  );

  // 4. A stale revision is rejected and reports the authoritative revision.
  const stale = await a.push({ best: 1.1, runs: 2 }, 0);
  check(
    '4. stale revision',
    stale.state === 'conflict' && stale.save?.revision === 1,
    { state: stale.state, status: stale.status, revision: stale.save?.revision },
  );

  // 5. A finished run is recorded.
  const runId = `hosted-${Date.now()}`;
  const run = await a.submitRun({ runId, totalMs: 845, legs: [700, 145] });
  check(
    '5. run submission',
    run.state === 'ok' && run.duplicate === false && run.save?.bestRunMs === 845 && run.save?.runs === 2,
    {
      state: run.state,
      duplicate: run.duplicate,
      revision: run.save?.revision,
      best: run.save?.bestRunMs,
      runs: run.save?.runs,
    },
  );

  // 6. Retrying the same run id is idempotent.
  const retry = await a.submitRun({ runId, totalMs: 845, legs: [700, 145] });
  check('6. duplicate retry', retry.state === 'ok' && retry.duplicate === true, retry);

  const reload = await a.load();
  print('A reload', {
    revision: reload.save?.revision,
    bestRunMs: reload.save?.bestRunMs,
    runs: reload.save?.runs,
  });

  // 7. A second player sees their own (empty) career.
  const b = cloud(`tgg_player_id=${B.id}`);
  const bLoad = await b.load();
  check('7. player isolation', bLoad.state === 'ok' && bLoad.save === null, bLoad);

  // 8. Another player's run id is refused.
  const stolen = await b.submitRun({ runId, totalMs: 5, legs: [] });
  check('8. foreign run id', stolen.state === 'failed' && stolen.status === 409, {
    state: stolen.state,
    status: stolen.status,
  });

  print(
    'merge local 0.8s + hosted',
    mergeProgress({ best: 0.8, runs: 1, lastRun: 0.9 }, saveToProgress(reload.save)),
  );

  const saves = await db.tggWorldSave.findMany({
    where: { playerId: { in: [A.id, B.id] } },
    select: { revision: true, bestRunMs: true, runs: true },
  });
  const runs = await db.tggWorldRun.findMany({
    where: { playerId: A.id },
    orderBy: { createdAt: 'desc' },
    take: 2,
    select: { totalMs: true, legs: true },
  });
  print('rows in hosted save table', saves);
  print('rows in hosted run table', runs);
} finally {
  if (!KEEP) {
    await clearProofRows();
    print('cleanup', 'proof rows removed');
  } else {
    print('cleanup', 'kept (KEEP_PROOF_PLAYERS=1)');
  }
  await db.$disconnect();
}

const failed = results.filter((r) => !r.ok);
console.log(`RESULT: ${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  for (const item of failed) console.error(`FAILED CHECK: ${item.label}`);
  process.exitCode = 1;
}
