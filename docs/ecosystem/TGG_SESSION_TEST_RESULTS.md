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

## NOT TESTED

- Any browser rendering, interaction, camera or MediaRecorder behaviour: no
  browser in this environment. The TGG OS resume-on-reload and the studio
  storage banner are typechecked/unit-tested but **not visually confirmed**.
- Mobile layouts and touch control: no device.
- GitHub Actions runs and the TGG World Pages deployment: workflow definitions
  read, runs **not inspected**, so deployment is **UNVERIFIED**.
- Unreal TGG World compile: no engine, no project file.
- `tggm-universe-private` suites: repo is private and not clonable here.
- Higgsfield/OpenAI/Anthropic provider calls: no credentials.
