# TGG World — Build Status

Last updated: 2026-11-11
Live preview: https://site-3fafc7d6c378497f910b8708af22753c.freebuff.page
Branch: `feat/tgg-world-left-turn-walk-signals`
Runtime: three.js 0.170, vanilla ES modules, esbuild bundle, Cloudflare Worker for assets + AI route.
No Unreal Engine, Windows machine or desktop toolchain is required to run or build this.

## 1. Audit before this milestone

What existed in `tgg-game3d/`:

- 13 source modules: `main`, `city`, `car`, `walker`, `traffic`, `signals`, `police`, `interior`, `studio`, `hud`, `audio`, `story`, `director`.
- Playable Act I loop: coupe driving, on-foot mode, Studio 808 interior with a recording take gate, engineer grading, radio, The Vault delivery state machine, director with offline beats.
- Save: `localStorage` v1 holding stage/complete/take/release/car only.
- UI: one start overlay, touch pedals + steer buttons, HUD chips, minimap. No menu, no profile, no settings.
- Worker: static assets, `POST /api/story`, `GET /api/story/verify`.
- Missing entirely: main menu, Continue/New Game, player profile, career choice, graphics settings, save export/import, service worker, web manifest, offline shell, online/offline indication.

`tgg-app/` (the Next/React 12-screen app) was **not** touched.

## 2. Milestone 1 — completed

1. **Main menu** — title screen with career summary, last played, Continue / New game, graphics selector, save export/import, offline status line.
2. **Continue / New Game** — Continue resumes the saved run; New game opens alias + career selection and, when a save exists, a destructive-action confirmation. New career clears the run, keeps graphics settings.
3. **Player save architecture (v2)** — versioned, normalised, engine-neutral JSON document: `player` (alias, career, createdAt), `settings` (quality, muted), run state (stage, complete, release pipeline), `stats` (runs, bestTake), director seed, car position. v1 saves are migrated, not discarded. Export writes a `tgg-save` JSON file; import validates and clamps instead of trusting the file.
4. **Responsive touchscreen interface** — menu actions stack under 420px, career grid reflows, min 56px targets, safe-area insets respected, hidden panels use one scoped hidden rule.
5. **Offline application-shell foundation** — `sw.js` caches the shell (`/`, `index.html`, `game.js`, `style.css`, manifest, icon) with stale-while-revalidate and never caches `/api/*`; offline navigation falls back to the cached shell. Adds `manifest.webmanifest` + `icon.svg` for Android install, and an offline chip plus menu status driven by `navigator.onLine`.

### Changed files (exact)

New:

- `tgg-game3d/src/menu.js` — menu controller (career picker, quality, export/import, confirm).
- `tgg-game3d/sw.js` — app-shell service worker.
- `tgg-game3d/manifest.webmanifest`, `tgg-game3d/icon.svg` — install metadata and icon.
- `BUILD_STATUS.md` — this file.

Rewritten:

- `tgg-game3d/src/progress.js` — v2 schema, normalisation, legacy migration, export/import, career list, summary.

Modified:

- `tgg-game3d/index.html` — menu markup, offline chip, menu styles, manifest link, service-worker registration.
- `tgg-game3d/src/main.js` — menu wiring, new-career/reset split, graphics quality, online/offline handling, offline-aware director, debug hooks.
- `tgg-game3d/build.mjs` — copies `sw.js`, manifest and icon into `dist/`.

## 3. Build

```
cd tgg-game3d && npm run build
```

Result: `dist/` with `game.js` **585,049 bytes**, plus `index.html`, `style.css`, `sw.js`, `manifest.webmanifest`, `icon.svg`, `screens.*`.
Deployed to the preview environment; receipt succeeded.

Served asset checks (live):

| Path | Status | Bytes | Content type |
|---|---|---|---|
| `/` | 200 | 19,045 | text/html |
| `/sw.js` | 200 | 2,126 | text/javascript |
| `/manifest.webmanifest` | 200 | 548 | application/manifest+json |
| `/icon.svg` | 200 | 274 | image/svg+xml |

## 4. Tests run

Save layer (Node, real module):

- v1 → v2 migration: stage/release/take/radio/seed preserved, alias + settings defaulted, v2 written, v1 removed.
- New career: alias + career accepted, stage 0, release `draft`, `stats.runs = 1`.
- Patch merge: settings and stage merge without wiping the profile.
- Export → import round trip (676 bytes, `format: tgg-save`).
- Rejects non-JSON and foreign-format files; clamps stage > 1, strips tags from alias, coerces unknown career/quality/release state; take id stable per take and different across takes.

Browser (live preview, `#debug`):

- Empty storage → menu shows New game, 7 careers, quality balanced.
- Typed alias `Sable` + Producer → save written (`format: tgg-save`, alias `Sable`, career `producer`, stage 0, release `draft`), menu hides, objective `Cut the single at Studio 808`, toast `New career · Sable · Studio 808`.
- Summary card renders alias, career label, objective, release state and last-played time.
- `navigator.onLine = false` → offline chip visible with text, menu status switches to offline; back online hides the chip.
- Quality `low` → renderer pixel ratio 1, `settings.quality = "low"` persisted.
- Service worker registered, active, scope `/`.

Previously verified and still true after this change (unchanged code paths): take gate (25/100 rejected, 100/100 accepted), radio, delivery `mastered → delivery-pending → released`, spawn lane position, Studio 808 frontage, camera clearance.

## 5. Known limitations

- Character creator is alias + career selection only; no appearance, background perks or starting stats.
- Graphics quality changes render resolution only. No shadows, PBR textures, day/night, rain or wet roads yet — the "realistic graphics" directive is not started.
- Offline covers the shell and local play. There is no cloud sync queue because nothing syncs to a server yet; AI and multiplayer report unavailable while offline.
- Save is per-browser. Portability is via export/import JSON; there are no accounts, D1 or server saves.
- Audio could not be heard in the automated checks (headless browser), and no real Android device FPS/battery measurement has been taken.
- Cloud AI needs a configured provider (`OLLAMA_BASE_URL` or `ZAI_API_KEY`); the deployed preview currently has none, so the director runs on its offline engine.
- Playwright is unavailable in this environment (`options.mode` harness error), so browser verification used direct DOM evaluation instead.

## 6. Completed vs remaining (against the directive)

Done: main menu, Continue/New Game, player save architecture, save export/import, responsive touch UI, offline shell + manifest, offline indication, graphics quality selector, BUILD_STATUS.

Remaining, in planned order:

1. Character creator depth (appearance, background, career-specific starting state).
2. Phone / map screen / pause menu / mission center.
3. Studio 808 five-track 16-step sequencer + mastering gate.
4. Districts: Cypher Plaza, Motors Yard, Northline, Salt Flats, Undertow, each with landmarks, activities and connected roads; keep the airport cargo mission before the Maya storyline.
5. Graphics pass: PBR materials, shadows, day/night, rain, wet roads, LOD; quality presets that actually change those features.
6. Vehicles: ownership, garage, customisation, tuning, street racing, meets, heat 0–5.
7. Crews and rivalry systems.
8. Cloud sync queue + accounts (D1), and multiplayer.
9. Unreal 5.8 export package: engine-neutral mission/world/profile/vehicle/save JSON plus documentation; rendering, physics, animation and interaction must be rebuilt there, not converted.

## 7. Backup / safety

No working system was replaced with a placeholder. All prior behaviour is still reachable; the menu is additive over the existing start overlay, and the old overlay's hints moved into the menu footer. History is preserved on the branch above (last known-good before this milestone: `aaa0d34`).
