# TGG SESSION PROGRESS — 2026-11-17

Mode: discovery first, then implementation across separate projects. This is a
log of what was actually done, in order, with the evidence for each step.

## Phase 1 — Ecosystem discovery

1. Listed every repository reachable from the connected GitHub account (6 found).
2. Cloned the four public repos at depth 30; the private repo cannot be cloned
   (no credentials in the sandbox) and was read through the API instead.
3. Walked each repo: tree, README, `package.json`, workflows, docs and entry
   points. Recorded stack, size, HEAD commit and purpose in
   `TGG_ECOSYSTEM_REGISTER.md`.
4. Ran each project's own checks to get a baseline before touching anything.

**Baseline**

| Project | Command | Baseline |
|---|---|---|
| `tggm` | `npm run check` | PASS |
| `tggm/tgg-app` | `tsc --noEmit` | not run (no deps) |
| `tggm/tgg-game3d` | `npm test` | PASS 13/13 |
| `tgg-os` | `typecheck`, `build` | PASS, PASS |
| `tgg-studio` | `build` | PASS |
| `tru-go-getta-mixtape` | `npm run check` | **FAIL** |

5. Probed every suite URL in TGG OS over HTTP to test the declared statuses.

**Finding**: 7 of 8 probes healthy; the single 404 is the tile the repo already
marks `offline`. The OS's declared health was accurate.

## Phase 2 — TGG OS and core platform

Read `store.ts`, `App.tsx`, `Os.tsx`, `Camera.tsx`, `media.ts` and `suite.ts`.
Two real reliability gaps were found and fixed:

- **Navigation did not persist** — reload always dropped you on the launcher with
  Snap reset to Stories.
- **The clock drifted** — a 30s interval started at mount could show a time up to
  half a minute stale and never rolled over on the minute.

Branch `feat/shell-persistence-and-clock` → **PR tgg-os#10**. The camera tab is
deliberately never restored, because mounting it calls `getUserMedia`.

## Phase 3 — TGG Hub and creator tools

`tgg-studio` audit: the editor, timeline, export and feed all build. The defect
is in persistence:

- every write swallowed `QuotaExceededError`, so autosave silently stopped
  working as the 5 MB profile filled and a reload returned an older project;
- published posters (JPEG data URLs) accumulated without limit, which is what
  fills the budget.

Branch `fix/quota-safe-storage` → **PR tgg-studio#1**: poster-space recovery with
one retry, honest `saved | trimmed | failed` status, a 30-cut feed cap, a
status banner when a save truly cannot land, and 5 tests against a budgeted
`localStorage`.

The 700-line `App.jsx` was deliberately left untouched — see the blocker on
large-file uploads — so the toast wiring is the first follow-up.

## Phase 4 — Websites and business systems

No separate website or client/business repository exists among the accessible
repos; the website lives inside `tggm` and the client-facing surfaces that do
exist are the suite apps whose health was measured in Phase 1. No business
platform code (leads, quotes, contracts, invoicing) was found to work on, so
none was invented.

## Phase 5 — Games and interactive experiences

`tgg-game3d` is healthy: 13/13 tests, clean build. Its Pages workflow publishes
`dist/`. The build prints `legacy screens bundle missing — skipped` because
`tgg-app/play-site/dist` is not in the repo — noted, not changed, since the
present build still produces a working game and the warning is by design.

The Unreal TGG World drop cannot be compiled here (no engine, no project file).
**BLOCKED**, no game work was forced.

## Phase 6 — AI, automation and integrations

Found, not modified:

- `tggm/tgg-higgsfield` (job store, provider router, worker) with a syntax gate
  in `npm run check` that passes;
- `tggm/tgg-ci` reconcilers and activation gates (Python, compile-checked);
- `tggm-universe-private/tgg-local-commander` (MCP server + skills);
- the `tru-go-getta-mixtape` lanes: `/v1/actions` runs allowlisted checks in
  isolated worktrees.

One automation defect was fixed: the Higgsfield static gate in
`tru-go-getta-mixtape` had been failing since the TGG Source dashboard relabelled
its view, which meant **no gate in that repo ran on any commit**. Branch
`fix/higgsfield-gate-label` → **PR tru-go-getta-mixtape#1** turns the check green
and lets the source gate execute again.

Provider calls (Higgsfield, Anthropic, OpenAI) were **NOT TESTED** — no
credentials are available in this environment.

## Phase 7 — Infrastructure, security and performance

Reviewed, not changed:

- `tggm` has 9 workflows: build automation, app check, deployment verification
  (kubeconform), framework manifest, Higgsfield, OCI terraform validate/plan,
  GPU pool resume, world Pages. Actions are SHA-pinned in the main build
  workflow.
- `tgg-studio` and `tru-go-getta-mixtape` have **no CI at all** — their checks
  only run when a human runs them. This is the largest unaddressed reliability
  gap found, and it is why a stale assertion could sit broken in `main`.
  **Closed in Phase 9.**
- No secrets are committed in the files inspected; provider credentials are
  referenced through environment variables.
- OCI remains unapplied and requires external credentials.

## Phase 8 — Verification and handoff

Re-ran the affected checks on the exact uploaded content (raw-file diff against
each branch confirmed the branch bytes match what was tested). Full command log
and results are in `TGG_SESSION_TEST_RESULTS.md`; blockers in
`TGG_SESSION_BLOCKERS.md`; ordered next tasks in `TGG_SESSION_HANDOFF.md`.

## Phase 9 — CI for the two ungated repos

The gap recorded in Phase 7 was turned into one workflow per repo, written and
run rather than only recommended:

- **`tgg-studio`** — `ci/test-and-build`: `npm ci` (lockfile must match
  `package.json`), `npm test` (the 5 storage tests from PR #1), `npm run build`,
  then asserts `dist/index.html` and `dist/assets` exist so a green build that
  emits nothing still fails. Node 20 with npm cache, 15-minute timeout.
- **`tru-go-getta-mixtape`** — `ci/static-gates`: `npm run check` (syntax pass
  over every script, then the Higgsfield and TGG Source gates). No install step:
  the package has no dependencies and no lockfile. 10-minute timeout.

Both fire on `pull_request` into `main`, on pushes to `main` (so `main` going
red shows up on the next merge rather than waiting for a human) and on
`workflow_dispatch`; both use `permissions: contents: read` and a concurrency
group that cancels superseded runs.

Two decisions worth recording:

1. **Branching.** Each CI branch is stacked on its repo's `fix/…` branch. Off
   `main`, `tgg-studio`'s workflow would fail (`test/` and the `test` script
   only exist in #1) and the mixtape workflow would fail on the stale assertion
   in `main`. Stacking makes each PR's own check green and reviewable instead of
   shipping a workflow whose first run is red for reasons outside itself.
2. **Action versions.** The first runs on both repos emitted the Node 20
   deprecation warning for `actions/checkout@v4`/`setup-node@v4` plus a notice
   that `ubuntu-latest` migrates on 2026-10-19. Both workflows were moved to
   `@v7` and pinned to `ubuntu-24.04`, mirroring the `tgg-os` workflow that is
   already green, and the re-runs carry no annotations.

Runner evidence: [tgg-studio 44122934753](https://github.com/tggm803sc/tgg-studio/actions/runs/44122934753)
(`success`, 13s) and [mixtape 44122930440](https://github.com/tggm803sc/tru-go-getta-mixtape/actions/runs/44122930440)
(`success`, 8s). Not claimed: step-level logs (only the job conclusion and
annotation count were read).

**Follow-through.** `#1` then `#2` were merged in both repos, so `main` is now
`c60758d` (`tgg-studio`) and `b9158c4` (`tru-go-getta-mixtape`). The
push-triggered runs on those commits came back green ([44150549109](https://github.com/tggm803sc/tgg-studio/actions/runs/44150549109),
[44150549362](https://github.com/tggm803sc/tru-go-getta-mixtape/actions/runs/44150549362))
*before* the check was made required, so the gate was never armed on a red
branch. Both `main` branches now require their job — `Test and build` and
`Static gates`, pinned to the GitHub Actions app — with `enforce_admins` **on**,
so the owner is held to the check as well (`enforcement_level: everyone`) and
cannot force-push `main`. One limit remains: only PR merges are gated, so a
direct push to `main` runs the workflow without waiting for it. That limit was
not tested by deliberately pushing a red change.

## Deliverables from this session

| Repo | Branch | Commit | PR | State |
|---|---|---|---|---|
| `tru-go-getta-mixtape` | `fix/higgsfield-gate-label` | `e5e2715` | #1 | merged |
| `tru-go-getta-mixtape` | `ci/static-gates` | `5b97a1c`, `3f5e051` | #2 | merged; `Static gates` required on `main` |
| `tgg-os` | `feat/shell-persistence-and-clock` | `4a8ca32` | #10 | open |
| `tgg-studio` | `fix/quota-safe-storage` | `aa64476` | #1 | merged |
| `tgg-studio` | `ci/test-and-build` | `ab66540`, `4135697` | #2 | merged; `Test and build` required on `main` |
| `tggm` | `docs/ecosystem-session-2026-11-17` | this PR | docs only | open |
