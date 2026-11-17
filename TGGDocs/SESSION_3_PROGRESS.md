# Session 3 — progress

Started from `main` @ `c7589f4` (the session-2 squash merge). Audit confirmed that
commit, an empty GitHub worktree at start, PR #20 merged, and the live site at
<https://tggm803sc.github.io/tggm/> serving the session-2 build.

## Phase 1 — CI and deployment hardening: DONE and merged

PR #21 → squash `cc6194d`. Run #4 (`44116508310`) on `main`: **success**, meaning
tests → build → bundle proof → deploy → smoke all passed on the new chain.

- Pull requests build and test but never publish (`if: github.event_name != 'pull_request'`).
- Bundle proof: three files non-empty, `game.js` > 200 kB, `index.html` really
  loads `./game.js`, no source maps in `dist`.
- New post-deploy smoke job: retries the live page 12×, requires `btnHandbrake`
  and `startBest`, then re-fetches `game.js`/`style.css` and re-checks sizes.
- `docs/TGG-WORLD-DEPLOY.md`: triggers, guard chain, rollback paths, limits.

## Phase 2/3 — server persistence and career saves: IMPLEMENTED, VERIFIED locally

Built and proven against a real PostgreSQL 18.6 server (embedded, unprivileged,
`127.0.0.1:55432`) — not against a hosted database, because none is provisioned.

- `tgg-app/prisma/schema.prisma`: `TggWorldSave` (unique `playerId`, `version`,
  `revision`, `bestRunMs`, `runs`, `career` JSON, `deviceId`) and `TggWorldRun`
  (client-supplied `id` for idempotency, `totalMs`, `legs` JSON, ownership FKs).
- Migration created and applied: `prisma/migrations/20261117153936_world_saves`.
- `src/lib/world/save.ts`: pure contract — parse, validate, conflict resolution,
  run folding. 13 `node:test` cases, all passing.
- Routes: `GET/PUT /api/world/save`, `GET/POST /api/world/runs`,
  `GET /api/world/health` (real `SELECT 1`).
- Auth is the existing httpOnly steam-session cookie; player id never comes from
  the body or a query string.

## Phase 4/5 — gameplay and mobile: IMPLEMENTED, VERIFIED in a browser

- Background-tab pause: `visibilitychange` releases inputs, suspends audio and
  freezes run time; on return the clock delta is discarded.
- Adaptive quality now recovers (fast frames buy pixels back) as well as sheds.
- Live leg split (`L1 0:00.4`) on its own block line under the run line.

## Phase 6 — creative engine: unchanged, still offline

`tgg-projects` `:10020`, `tgg-source` `:10030`, `tgg-higgsfield` `:10040` all
answer `200` on `/health` locally. `tgg-higgsfield` still reports
`provider_bridge_configured: false` and nothing listens on `:10041`, so no render
can be produced and none was claimed. The bridge contract (three endpoints,
bearer auth, 30 s timeout) is documented in `docs/TGG-CLOUDWAYS-REPLACEMENT.md`.

## What is where

- **On GitHub:** PR #21 / `cc6194d`, this document set, `docs/TGG-WORLD-DEPLOY.md`.
- **In this chat's worktree only:** the Phase 2/3 app layer and the Phase 4/5
  game changes, committed locally as `ac5dda8` → `HEAD` (tag
  `tgg-free-checkpoint-4`). The worktree has no push credentials (anonymous read
  only, no SSH key), and the GitHub API path needs whole-file bodies;
  `TGGDocs/SESSION_3_HANDOFF.md` gives the exact commands to land them.
