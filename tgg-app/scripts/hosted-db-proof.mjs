// Proof run for a hosted career database.
//
// Called by scripts/verify-hosted-db.sh after migrations and a healthy app.
// Prints the database host only (never credentials) and exercises the save API
// through the game's own sync client: first save, stale revision, a finished
// run, an idempotent retry, a second player's isolation, and the raw rows.
import { PrismaClient } from '@prisma/client';
import { createCloudSave, saveToProgress, mergeProgress } from '../../tgg-game3d/src/cloud.js';

const APP = process.env.APP_URL ?? 'http://127.0.0.1:3200';
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
// Start from a known state: these two players are throwaway proof accounts.
await db.tggWorldRun.deleteMany({ where: { playerId: { in: [A.id, B.id] } } });
await db.tggWorldSave.deleteMany({ where: { playerId: { in: [A.id, B.id] } } });

const log = (label, value) => console.log(label.padEnd(34), JSON.stringify(value));
const withCookie = (cookie) => (path, init = {}) =>
  fetch(APP + path, { ...init, headers: { ...init.headers, ...(cookie ? { cookie } : {}) } });
const cloud = (cookie) => createCloudSave({ base: '', fetchImpl: withCookie(cookie) });

log('database', where);
log('health', await (await fetch(`${APP}/api/world/health`)).json());
log('anonymous load', await cloud('').load());

const a = cloud(`tgg_player_id=${A.id}`);
log('A load (new career)', await a.load());

const created = await a.push({ best: 1.2, runs: 1 }, 0);
log('A first push', {
  state: created.state,
  status: created.status,
  revision: created.save?.revision,
  bestRunMs: created.save?.bestRunMs,
});

const stale = await a.push({ best: 1.1, runs: 2 }, 0);
log('A push on stale revision', {
  state: stale.state,
  status: stale.status,
  revision: stale.save?.revision,
});

const runId = `hosted-${Date.now()}`;
const run = await a.submitRun({ runId, totalMs: 845, legs: [700, 145] });
log('A submitRun 845ms', {
  state: run.state,
  duplicate: run.duplicate,
  revision: run.save?.revision,
  best: run.save?.bestRunMs,
  runs: run.save?.runs,
});

log('A retry same run id', await a.submitRun({ runId, totalMs: 845, legs: [700, 145] }));

const reload = await a.load();
log('A reload', {
  revision: reload.save?.revision,
  bestRunMs: reload.save?.bestRunMs,
  runs: reload.save?.runs,
});

const b = cloud(`tgg_player_id=${B.id}`);
log('B load (isolation)', await b.load());
const stolen = await b.submitRun({ runId, totalMs: 5, legs: [] });
log("B reusing A's run id", { state: stolen.state, status: stolen.status });
log(
  'merge local 0.8s + hosted',
  mergeProgress({ best: 0.8, runs: 1, lastRun: 0.9 }, saveToProgress(reload.save)),
);

const saves = await db.tggWorldSave.findMany({
  select: { playerId: true, revision: true, bestRunMs: true, runs: true },
});
const runs = await db.tggWorldRun.findMany({
  orderBy: { createdAt: 'desc' },
  take: 2,
  select: { id: true, totalMs: true, legs: true },
});
log('rows in hosted save table', saves);
log('rows in hosted run table', runs);
await db.$disconnect();
