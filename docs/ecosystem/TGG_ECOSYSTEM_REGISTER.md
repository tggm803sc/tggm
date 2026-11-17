# TGG ECOSYSTEM REGISTER

Captured: 2026-11-17. Owner account: `tggm803sc` (GitHub).

This register records only what was actually inspected. Anything that could not be
reached is marked **BLOCKED**; anything not executed is marked **NOT TESTED**.

## Repositories found

Six repositories are visible to the connected GitHub account. There are no
organizations, so everything is user-owned.

| # | Repository | Kind | Visibility | Default branch | HEAD inspected |
|---|---|---|---|---|---|
| 1 | `tggm803sc/tggm` | TGG control plane, website, game, app | public | `main` | `c7589f4` |
| 2 | `tggm803sc/tgg-os` | TGG OS shell (Snap + suite launcher) | public | `main` | `9ddce77` |
| 3 | `tggm803sc/tgg-studio` | Browser video studio editor | public | `main` | `4a937d6` |
| 4 | `tggm803sc/tru-go-getta-mixtape` | TGG Projects / Source / Higgsfield services | public | `main` | `a7d71cb` |
| 5 | `tggm803sc/tggm-universe-private` | TGGM Universe browser app + local commander | **private** | `feat/tggm-universe-enhancements` | `241421a` |
| 6 | `tggm803sc/airflow` | Fork of Apache Airflow (no TGG changes observed) | public | `main` | not inspected |

## Project register

### 1. `tggm` — TGG control plane, website and game

- **Purpose**: canonical TGG project home. Contains the runtime control plane,
the website, the Playable slice app, the three.js game, CI gates, OCI
infrastructure and the Unreal source drop.
- **Repo**: <https://github.com/tggm803sc/tggm> (no production URL recorded in
  the repo for the whole site).
- **State**: 250 tracked files on `main` at `c7589f4`.
- **Sub-projects inside it**
  - `tgg-app` — Next 15 + React 19 + Prisma 6 app; routes `/`, `/play`,
    `/clans`, `/leaderboards`, `/vault-logs`; play slice in
    `src/app/play` + `src/components/play` + `src/lib/play`.
  - `tgg-game3d` — three.js Act I city slice (car, traffic, signals, HUD,
    progress save). Has `test/progress.test.mjs` and `build.mjs`.
  - `tgg-source`, `tgg-projects` — repo hosting and project services (Node).
  - `tgg-higgsfield` — creative generation job bridge and worker.
  - `tgg-ci`, `tgg-activation` — gates, reconcilers and activation runbooks.
  - `infra/oci` — Terraform for the Oracle Cloud control/game hosts.
  - `game/unreal` — C++ multiplayer framework sources, HLSL post-process,
    `WBP_HUD.layout.json`.
  - `docs/` — design bible, campaign script Acts I–III, Android playable path.
- **Build/test status this session**
  - `npm run check` → **PASS** (exit 0). Covers the canonical gate, source/
    projects/higgsfield syntax gates, the app control-plane static test, the
    world design gate, the activation shell/Python compiles, the OCI preflight
    and the OCI bridge/plan compiles.
  - `tgg-app`: `npm install` → 0, `npx prisma generate` → 0,
    `npx tsc --noEmit` → **PASS**. A full `next build` was **NOT TESTED**.
  - `tgg-game3d`: `npm test` → **13 pass / 0 fail**; `npm run build` → **PASS**,
    with the warning `legacy screens bundle missing — skipped`.
- **Deployment**: `.github/workflows/tgg-world-pages.yml` publishes
  `tgg-game3d/dist` to GitHub Pages on pushes to `main` touching `tgg-game3d/**`.
  **NOT VERIFIED** this session (no workflow run inspected).
- **Open work in the repo**: PR #15 (Higgsfield live catalog refresh, open since
  2026-09-26) and PR #16 (TGG Video AI v1, draft, blocked on a reachable
  production host and live render proof).
- **Risks**: the Unreal drop has no `.uproject`/engine, so it cannot be
  compiled from the repo alone; the OCI stack is apply-ready but unauthorised.

### 2. `tgg-os` — TGG OS

- **Purpose**: unified front door for the TGG apps; Snap (camera, stories, chat,
  streaks) runs inside it and the rest of the suite launches from the grid.
- **Repo**: <https://github.com/tggm803sc/tgg-os>, 37 files, `main` @ `9ddce77`.
- **Stack**: React 19.3, TypeScript 7, Vite 8.3.8; `sites.manifest.json` +
  `worker/index.js` serve `dist/` as an SPA. CI: `npm ci`, typecheck, build.
- **Build/test status**: `npm run typecheck` → **PASS**; `npm run build` →
  **PASS** (266.99 kB js, 82.32 kB gzip; 33.70 kB css).
- **Suite health (measured by HTTP GET, 2026-11-17)**

  | Tile | URL | Result |
  |---|---|---|
  | TGG World | site-06b1aca5….freebuff.page | 200 |
  | TGG AI Impact Desk | site-16ce126d….freebuff.page | 200 |
  | TGG Suno (parked) | site-2a1765ed….freebuff.page | **404** |
  | TGG Studio Download | site-363c68e9….freebuff.page | 200 |
  | TGG Reels | site-db99a68e….freebuff.page | 200 |
  | TGG Cash | site-fa61cbe0….freebuff.page | 200 |
  | TGG Store | site-fa61cbe0….freebuff.page/store | 200 |
  | Studio APK | site-363c68e9….freebuff.page/TGG-World-Studio.apk | 200, 78,833 bytes |

  The one 404 is the tile the repo already parks as `offline`, so the declared
  statuses match reality.
- **Incomplete**: suite statuses are hand-maintained strings in `src/suite.ts`;
  nothing re-checks them at runtime or in CI.

### 3. `tgg-studio` — browser video studio

- **Purpose**: in-browser editor — media bin, preview, multi-track timeline,
  inspector, WebM export, publishable reel feed. All media procedural, no assets.
- **Repo**: <https://github.com/tggm803sc/tgg-studio>, 28 files, `main` @
  `c60758d` (was `4a937d6` when the register was captured).
- **Stack**: React 18.3, Vite 5.4; `deploy.json` + `worker/index.js` SPA.
- **Build/test status**: `npm run build` → **PASS** (228.66 kB js / 73.57 kB
  gzip). Tests: 5 focused storage tests, added in #1 and now on `main`.
- **CI**: added in PR #2 (`ci/test-and-build`, `.github/workflows/ci.yml`) —
  `npm ci` → `npm test` → `npm run build`, then asserts the bundle emitted
  `dist/index.html` and `dist/assets`. Runs on every pull request into `main`,
  pushes to `main` and manual dispatch; `ubuntu-24.04`, Node 20, 15-min timeout.
  Green on GitHub's runners: [run 44122934753](https://github.com/tggm803sc/tgg-studio/actions/runs/44122934753)
  → `success`, 0 annotations, 13s. **Merged**: #1 then #2 landed, `main` is now
  `c60758d`, the push-triggered run on it is green
  ([44150549109](https://github.com/tggm803sc/tgg-studio/actions/runs/44150549109)),
  and `main` requires the `Test and build` check before a PR can merge.
- **Incomplete**: `App.jsx` ignores the storage layer's status values; published
  posters compete with the project for the 5 MB budget.
- **Deployment**: has a Sites-style `deploy.json`. **NOT VERIFIED** this session.

### 4. `tru-go-getta-mixtape` — TGG Projects / Source / Higgsfield

- **Purpose**: despite the name, this is the TGG-owned project and Git
  repository service: `tgg-projects/server.mjs` (projects, Smart HTTP Git, issues,
  PRs, releases, actions), `tgg-higgsfield/bridge.mjs` (creative job bridge),
  status gates in `scripts/`.
- **Repo**: <https://github.com/tggm803sc/tru-go-getta-mixtape>, 17 files,
  `main` @ `b9158c4` (was `a7d71cb` when the register was captured).
- **Build/test status**: `npm run check` → **FAILED on `main`** (Higgsfield gate
  asserted a label the dashboard no longer uses); **PASSES** with the fix in
  PR #1, which also lets the source gate run for the first time.
- **CI**: added in PR #2 (`ci/static-gates`, `.github/workflows/ci.yml`) —
  `npm run check` (syntax pass + the Higgsfield and Source gates) on every pull
  request into `main`, pushes to `main` and manual dispatch. No install step:
  no dependencies, no lockfile; `ubuntu-24.04`, Node 20, 10-min timeout. Green
  on GitHub's runners: [run 44122930440](https://github.com/tggm803sc/tru-go-getta-mixtape/actions/runs/44122930440)
  → `success`, 0 annotations, 8s. **Merged**: #1 then #2 landed, `main` is now
  `b9158c4`, the push-triggered run on it is green
  ([44150549362](https://github.com/tggm803sc/tru-go-getta-mixtape/actions/runs/44150549362)),
  and `main` requires the `Static gates` check before a PR can merge.
- **Residual**: the required check governs **merges of pull requests** only.
  `enforce_admins` is off, so a direct push to `main` is not gated by a run.

### 5. `tggm-universe-private` — TGGM Universe app

- **Purpose**: browser app (`index.html`, `app.js`, `music-hub.html`,
  `creator-os.html`, `studio-suite.html`) plus `tgg-local-commander` (an MCP
  server, skills, rules and a dashboard) and its own test suite
  (`test-suite.mjs`, `test-browser-smoke.mjs`, `test-mcp-bridge.mjs`,
  `test-mcp-integration.mjs`, `test-baseline-audit.mjs`).
- **Repo**: private, default branch `feat/tggm-universe-enhancements` @ `241421a`.
- **Status**: **BLOCKED for local work** — the sandbox has no GitHub
  credentials, so a private clone cannot be made. Files are readable through the
  GitHub integration, but no test was run (**NOT TESTED**).
- **Open work**: PR #1 (draft) — Mic Drop & Reels creator page, explicitly not
  promoted until checks pass and Blogger staging is verified separately.

### 6. `airflow` — Apache Airflow fork

- Fork with no TGG-specific commits observed; treated as tooling, not a TGG
  product. **NOT INSPECTED**.

## Services and infrastructure

| Service | Evidence | State |
|---|---|---|
| GitHub (user `tggm803sc`) | API: 6 repos, 1 private, no orgs | reachable |
| Suite hosting (`*.freebuff.page`) | 8 HTTP probes | 7×200, 1×404 (parked tile) |
| GitHub Pages (TGG World slice) | workflow definition only | NOT VERIFIED |
| Oracle Cloud (OCI) | `infra/oci/*`, `TGG-PROJECT.json` | apply-ready, **unauthorised**: `APPLY_READY_WAITING_EXTERNAL_OCI_EXECUTION`, control ingress 8787 `CLOSED` |
| Prisma database (`tgg-app/prisma`) | `prisma generate` succeeded | client generates; **no database reachable** |
| Anthropic/Higgsfield provider | presets + bridge code | code present; provider calls **NOT TESTED** (needs credentials) |
| GitHub Actions (CI) | 2 workflows; PR runs 44122934753 / 44122930440, `main` runs 44150549109 / 44150549362 | green on `ubuntu-24.04` (`success`, 0 annotations each); both are **required checks on `main`** |

## TGG World (Unreal)

`tggm/game/unreal` holds 18 C++ files, a post-process shader and a HUD layout
JSON, but no `.uproject`, no `.uplugin` target and no engine. It cannot be
compiled in this environment: **BLOCKED**. No Unreal work was attempted.
