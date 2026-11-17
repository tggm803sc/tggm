# TGG SESSION TEST RESULTS — 2026-11-17

Every result below was produced by running the command in this session on the
files that were actually uploaded. Environment: Node v26.13.0, npm 11.20.0,
Python 3.12.3, Linux, no browser.

## Summary

| Project | Command | Before | After |
|---|---|---|---|
| `tggm` | `npm run check` | PASS | PASS (unchanged) |
| `tggm/tgg-app` | `npx tsc --noEmit` | NOT RUN | **PASS** |
| `tggm/tgg-game3d` | `npm test` | PASS 13/13 | PASS 13/13 (unchanged) |
| `tggm/tgg-game3d` | `npm run build` | PASS | PASS (unchanged) |
| `tgg-os` | `npm run typecheck` | PASS | **PASS** |
| `tgg-os` | `npm run build` | PASS | **PASS** |
| `tgg-studio` | `npm test` | no tests existed | **PASS 5/5** |
| `tgg-studio` | `npm run build` | PASS | **PASS** |
| `tru-go-getta-mixtape` | `npm run check` | **FAIL (exit 1)** | **PASS (exit 0)** |
| `tgg-studio` CI (on GitHub's runner) | run 44122934753 | no workflow existed | **PASS (`success`, 0 annotations)** |
| `tru-go-getta-mixtape` CI (on GitHub's runner) | run 44122930440 | no workflow existed | **PASS (`success`, 0 annotations)** |

## Detail

### `tggm` — control plane

```
$ npm run check
> tgg@1.0.0 check
  check:tgg-canonical, check:tgg-source, check:tgg-projects,
  check:tgg-higgsfield, check:tgg-app, check:tgg-world, check:tgg-activation,
  check:tgg-oci, check:tgg-oci-bridge, check:tgg-oci-finalizer,
  check:tgg-pre-r232-reconciler, check:tgg-pre-r232-bridge,
  check:tgg-live-checkpoint, check:tgg-oci-plan-verifier
→ exit 0
```

### `tggm/tgg-app` — Next.js app

```
$ npm install --no-audit --no-fund        → exit 0
$ npx prisma generate                     → exit 0 (Prisma Client 6.19.3)
$ npx tsc --noEmit                        → exit 0 (no diagnostics)
```

`next build` was **NOT TESTED** (would need a database URL for the Prisma-backed
routes; no database is reachable here).

### `tggm/tgg-game3d` — three.js game

```
$ npm test
ℹ tests 13   ℹ pass 13   ℹ fail 0
$ npm run build
legacy screens bundle missing — skipped
built …/tgg-game3d/dist     → exit 0
```

### `tgg-os` — final content as uploaded

```
$ npm run typecheck → exit 0
$ npm run build
✓ 34 modules transformed
 dist/assets/index-*.css   33.70 kB │ gzip:  6.52 kB
 dist/assets/index-*.js   266.99 kB │ gzip: 82.32 kB
✓ built in 326ms            → exit 0
```

### `tgg-studio` — final content as uploaded

```
$ npm test
✔ the feed keeps the newest cuts and caps the list
✔ a tight budget keeps every cut and gives up the posters
✔ a full profile still saves the edit by trading poster space
✔ an impossible save reports failure instead of pretending
✔ withoutPosters keeps only the newest posters asked for
ℹ tests 5   ℹ pass 5   ℹ fail 0
$ npm run build
✓ 48 modules transformed
 dist/assets/index-*.js   228.66 kB │ gzip: 73.57 kB
✓ built in 1.41s            → exit 0
```

### `tru-go-getta-mixtape` — the red gate

```
BEFORE (main @ a7d71cb)
$ npm run check → exit 1
AssertionError: The input did not match the regular expression /TGG Higgsfields/
  at scripts/tgg-higgsfield-static.test.mjs
  (tgg:source:test never ran)

AFTER (fix/higgsfield-gate-label @ e5e2715)
$ npm run check → exit 0
{ "gate": "TGG_HIGGSFIELD_STATIC", "ok": true, "presets": 6, … }
{ "gate": "TGG_SOURCE_STATIC", "ok": true, "source_control": true,
  "search": true, "activity": true, "issues": true, "pull_requests": true,
  "releases": true, "bundle_export": true, "actions": true,
  "smart_http_git": true, "clone_fetch_push": true,
  "downloadable_bundle_exports": true, "higgsfield_every_project": true,
  "save_all": true }
```

### CI workflows — on GitHub's runners

Added in `tgg-studio`#2 and `tru-go-getta-mixtape`#2 (Phase 9 in
`TGG_SESSION_PROGRESS.md`). Job-level result as reported by the Actions API:

```
tgg-studio / ci/test-and-build
  workflow .github/workflows/ci.yml      job "Test and build"
  runs-on ubuntu-24.04 · Node 20 · npm cache · 15 min timeout
  run 44122934753 → success · annotations_count 0 · 13s

  same steps, same tree, run locally:
  $ npm ci          → exit 0
  $ npm test        → exit 0   tests 5 / pass 5 / fail 0
  $ npm run build   → exit 0   48 modules, index-BDdgezTF.js 228.66 kB / 73.57 kB gzip
  $ test -s dist/index.html; ls dist/assets → exit 0

tru-go-getta-mixtape / ci/static-gates
  workflow .github/workflows/ci.yml      job "Static gates"
  runs-on ubuntu-24.04 · Node 20 · no install step · 10 min timeout
  run 44122930440 → success · annotations_count 0 · 8s

  same step, same tree, run locally:
  $ npm run check   → exit 0
    TGG_HIGGSFIELD_STATIC  ok (6 presets)
    TGG_SOURCE_STATIC      ok (all 12 flags true)
```

History of these workflows: the first runs used `actions/checkout@v4` /
`setup-node@v4` and warned that Node 20 is deprecated and the actions were
forced onto Node 24, plus a notice that `ubuntu-latest` migrates to Ubuntu 26 on
2026-10-19. Both were changed to `@v7` with `runs-on: ubuntu-24.04` (the pattern
`tgg-os` already runs green) and the re-runs above report no annotations.

After merge, the push-triggered runs on `main` also came back green — checked
*before* anything was made required, so the gate was never armed on a red branch:

```
tgg-studio            main c60758d   run 44150549109 → success · 0 annotations · 20s
tru-go-getta-mixtape  main b9158c4   run 44150549362 → success · 0 annotations · 13s
```

Branch protection, read back through the API after being set:

```
get /repos/tggm803sc/tgg-studio/branches/main
  protected: true
  required_status_checks.checks = [{app_id: 15368, context: "Test and build"}]
  strict: false · enforcement_level: non_admins

get /repos/tggm803sc/tru-go-getta-mixtape/branches/main
  protected: true
  required_status_checks.checks = [{app_id: 15368, context: "Static gates"}]
  strict: false · enforcement_level: non_admins
```

**Not verified**: the step-level logs (only the job conclusion, annotation count
and duration were read), and that a failing run actually blocks a merge — no
deliberately red PR or direct push to `main` was attempted. `enforce_admins` is
off, so the owner is not among the blocked accounts.

## Deployment / endpoint probes

HTTP GET with redirects, 20s timeout, 2026-11-17:

```
200  https://site-06b1aca5210f4581b3dbed8a0d482c87.freebuff.page
200  https://site-16ce126d091a4f96a04895dfa0ac0dda.freebuff.page
404  https://site-2a1765ed52884bd4ae871ed942404ba0.freebuff.page   (parked tile)
200  https://site-363c68e932f2463e9a132c0126332b2a.freebuff.page
200  https://site-db99a68e0ff74fa8b1dd92c222aa2ca8.freebuff.page
200  https://site-fa61cbe050024fc2bc4c3f33a1e32323.freebuff.page
200  https://site-fa61cbe050024fc2bc4c3f33a1e32323.freebuff.page/store
200  https://site-363c68e932f2463e9a132c0126332b2a.freebuff.page/TGG-World-Studio.apk  (78,833 bytes)
```

## Upload integrity

Each uploaded file was compared byte-for-byte against the local copy that was
tested, by fetching the branch file from `raw.githubusercontent.com` and running
`diff`:

- `tgg-os` `src/App.tsx`, `src/store.ts`, `src/components/Os.tsx` → identical
  (one stray blank line in the local `store.ts` was corrected to match the
  uploaded file, then typecheck/build re-run → PASS).
- `tgg-studio` `src/storage.js`, `src/assets.js`, `package.json`,
  `test/storage.test.mjs` → identical.
- `tgg-studio` `.github/workflows/ci.yml` and
  `tru-go-getta-mixtape` `.github/workflows/ci.yml` → `git hash-object` of the
  local files returns `87816c43…` and `b9777b53…`, matching the blobs GitHub
  stored for each branch.

## NOT TESTED

- Any browser rendering, interaction, camera or MediaRecorder behaviour: no
  browser in this environment. The TGG OS resume-on-reload and the studio
  storage banner are typechecked/unit-tested but **not visually confirmed**.
- Mobile layouts and touch control: no device.
- GitHub Actions in general: the two workflows added this session **were**
  inspected at job level (PR runs 44122934753 / 44122930440 and `main` runs
  44150549109 / 44150549362, all `success` with 0 annotations), but their step
  logs were not read, and no merge was observed actually being blocked by the
  required check. For the TGG World Pages deployment and the nine `tggm`
  workflows the definitions were read and the runs were **not** inspected, so
  that deployment is **UNVERIFIED**.
- Unreal TGG World compile: no engine, no project file.
- `tggm-universe-private` suites: repo is private and not clonable here.
- Higgsfield/OpenAI/Anthropic provider calls: no credentials.
