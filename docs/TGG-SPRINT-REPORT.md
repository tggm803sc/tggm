# TGG World sprint report

Scope of this pass: the static-first TGG World slice and its save layer. No
external API, no hosted database, no paid hosting was used or required.

## Verified in this pass

| Item | Evidence |
| --- | --- |
| Game unit tests | `npm test` in `tgg-game3d` — 43 pass, 0 fail (34 existing + 9 career-file) |
| App unit tests | `npm test` in `tgg-app` — 18 pass, 0 fail |
| Typecheck | `npx tsc --noEmit` in `tgg-app` — clean |
| Production build | `npm run build` in `tgg-game3d` — 7 files in `dist` |
| Installable PWA | manifest fetched 200, `name: TGG World — Act I`, icons `any` + `maskable` |
| Service worker | registration `activated`, `navigator.serviceWorker.controller === true` after reload |
| Offline launch | context offline + reload: page loaded from cache, title, canvas and start button present |
| Sync client → real Postgres | `bash scripts/verify-hosted-db.sh` — `RESULT: 8/8 checks passed` against a local PostgreSQL |

## What the offline PWA actually caches

`dist/sw.js` precaches the shell (`./`, `index.html`, `game.js`, `style.css`,
`manifest.webmanifest`, both icons) under a cache name carrying a **build
version** that `build.mjs` writes into the worker. Every build therefore
publishes a different worker, which installs a new cache and deletes the old
one — the mechanism that stops a stale bundle after an update.

Navigations try the network first and fall back to the cached shell, so a launch
with no signal still works. Same-origin assets are cache-first with a
fill-on-use path.

## Career files (offline transfer)

With no server the only honest cross-device path is a file the player owns:

- `exportCareer(progress)` → JSON envelope `{ kind: 'tgg-world-career', format: 1, exportedAt, save }`.
- `importCareer(text, { current })` → `ok | empty | invalid | newer`; merging can
  only improve a career (faster best, larger run count, incoming last run).
- Hand-edited junk (`best: "fast"`) is rejected with `invalid_save` rather than
  silently becoming an empty career; a career from a newer build is returned as
  `newer` and not adopted.

**Not wired to a button yet** — the data layer and its tests are in place, the
UI entry point is the next task.

## Repository state

- Build guard added to `.github/workflows/tgg-world-pages.yml`: the deploy now
  fails if `manifest.webmanifest`, `sw.js`, both icons are missing, if `sw.js`
  still holds the version placeholder, or if `index.html` no longer links the
  manifest or registers the worker.
- No secrets, no credentials, no generated junk added.

## Outstanding

1. Export/import buttons (and a file input) in the start or completion overlay.
2. Hosted database verification — impossible without a `DATABASE_URL`; the
   `TGG World DB Verify` workflow fails at its guard until that secret exists.
3. The live Pages deployment is only confirmed by the deployment workflow; this
   report makes no claim about it.
4. A physical-phone pass for the touch controls.
