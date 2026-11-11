# TGG World — Build Status

Last updated: 2026-11-11 · Milestone 4 (airport cargo) + take-gate hardening + diagnostics
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

## 8. Milestone 2 — phone, map, pause and mission center

### Features implemented

- **In-game phone (Home)** — profile card (alias, career, stage, release state, best take), tiles for City map, Missions, Garage, Studio 808, Settings and Save & export, plus last-opened and radio/online lines.
- **World map** — canvas render of the real block grid, player marker with heading, Studio 808 / The Vault / TGG HQ with live distances, a ring and badge on the active mission target, and selectable location list with descriptions. The five design-only districts (Cypher Plaza, Motors Yard, Northline, Salt Flats, The Undertow) are drawn as dashed LOCKED markers with "not built", not as destinations. No fast travel.
- **Pause sheet** — Resume, Phone, Map, Missions, Settings, Save & export, Main menu. Opening it freezes game time, cancels held inputs, and shows the current objective and distance. Esc/P toggles it; the HUD gained a `II` chip. Returning to the main menu persists the run first.
- **Mission center** — current objective and distance, stage N of 2, release state, `reward: DEMO · display only, nothing awarded`, both Act I missions with Active / Completed / Not reached badges, Acts II–III marked Locked with "none are implemented", and the completed list read from the save journal.
- **Settings** — LOW / BALANCED / HIGH resolution, mute, export, import, main menu.
- **Garage view** — Coupe 808 with "Upgrades: None implemented" and "Garage district: Not built"; no invented garage location.
- **Save v2 extended** — `ui.lastScreen` and `journal.completed` (deduped and bounded to the stage range), clamped on load and import, verified through an export/import round trip.
- **Service worker changed to network-first** with cache fallback. The previous stale-while-revalidate shell could serve the *previous* bundle for one load after a deploy — that is what made the first Milestone 2 deploy look broken. Cache renamed to `tgg-shell-v2`.

### Files changed

New: `tgg-game3d/src/screens.js`

Modified: `tgg-game3d/src/main.js` (screens wiring, pause gating of the frame loop, journal, lastScreen, return to menu, debug hooks), `tgg-game3d/src/progress.js` (ui/journal schema, `downloadSave`), `tgg-game3d/src/menu.js` (uses shared `downloadSave`), `tgg-game3d/sw.js`, `tgg-game3d/index.html` (pause + tablet markup, styles, `II` chip), `BUILD_STATUS.md`.

### Build and deploy

`npm run build` → `game.js` **598,627 bytes**; `dist/sw.js` carries `tgg-shell-v2`. Deployed to the preview environment (receipt succeeded); the live bundle is byte-identical to the local build.

### Tests actually run (live preview, `#debug`)

- Boot with an existing save → menu visible, alias `Sable`, both sheets hidden.
- Continue → menu hidden, stage 0.
- Esc → pause sheet with all 7 actions and `Cut the single at Studio 808 · 219 m`.
- Phone → 6 tiles, profile `Sable · Producer · stage 1 of 2 · release draft`, Phone tab selected.
- Map → 8 locations (3 built, 5 locked), 5 LOCKED badges, distances 248 / 213 / 69 m plus "not built", Studio 808 selected with its description; canvas 1170×912 and drawn (centre pixel rgb 199,255,0).
- Missions → 5 cards (active objective, both Act I missions, Act II locked, Act III locked), DEMO reward line present, "Completed missions recorded in this save: none yet".
- Settings → 3 quality buttons with `balanced` pressed, actions mute/export/import/menu.
- Garage → Coupe 808 and the "None implemented" / "Not built" statements.
- Close from the tablet returns to the pause sheet; Resume hides both sheets.
- Pause freezes game time: elapsed 0.85 → 0.85 across 1.2 s paused, then 1.00 after resume.
- Main menu → run persisted (alias `Sable`, stage 0, `lastScreen: "pause"`, journal `[]`), menu shown.
- Reopen → phone reads `Last opened: pause`.
- Save layer (Node): `ui.lastScreen` accepted and clamped, `journal.completed` deduped and bounded, junk rejected, export → import round trip preserves both.

### Bugs found and fixed during this milestone

1. Every sheet view rendered a title with an empty body: the view functions returned arrays and `replaceChildren(array)` stringified them into text nodes. Now spread before insertion.
2. A deploy could run the previous bundle once because of the stale-while-revalidate service worker. Now network-first.
3. `ui.lastScreen` was erased when returning to the main menu, because closing the sheet reported `null`. The menu return now keeps it.

### Android-specific limitations

- No physical Android device test. Safe-area insets, 46–66 px targets and single-column stacking below 380 px are in place, but only exercised in a desktop viewport.
- Landscaped gameplay is unchanged; the sheets cover the screen while open and release input when closed.
- The map canvas paints on open (one frame late on a slow device) and on resize, not per frame.
- Browser download of an exported save and the file-picker import path are implemented but unverified on Android.

### Remaining work (updated)

Milestone 1's item 2 is now done. Still open, in order: character creator depth; Studio 808 five-track 16-step sequencer and mastering gate; the five missing districts with activities and roads (airport cargo mission before the Maya storyline); graphics pass (PBR, shadows, day/night, rain, wet roads, LOD); vehicles, garages, tuning, racing, heat 0–5; crews and rivalry; cloud sync + accounts + multiplayer; Unreal 5.8 export package of engine-neutral data.

### Next recommended milestone

**Milestone 3 — Studio 808 production:** replace the three-layer tap take with the canon 16-step × 5-track sequencer (drums, bass, keys, lead, fx) and a mastering gate that feeds the existing `mastered → delivery-pending → released` pipeline, and surface it through the phone's Studio 808 shortcut.

## 9. Milestone 3 — Studio 808 production system

### Features implemented

- **Five-track, sixteen-step sequencer** — Drums, Bass, Melody, Chords and Percussion, each with its own 16 booleans, mute and volume. Pads edit one step at a time and the counts update live.
- **Real synthesis** — `EngineAudio` gained a 25 ms lookahead scheduler on the audio clock and five synthesised voices (kick/snare, filtered saw bass, triangle lead, three-oscillator chord pad, noise shaker). No samples are downloaded, so playback costs no mobile data.
- **Transport** — Play/Stop, BPM 70–180 in steps of five, loop on/off, pattern clear behind a two-tap confirmation (tempo, mutes and volumes survive a clear), and Save beat.
- **Take capture and review** — Capture runs your loop and asks for eight taps on the beat. Timing comes from the existing `StudioSession` beat-distance scoring; arrangement comes from the pattern. Quality is `round(0.4 × arrangement + 0.6 × timing)`, and 80 remains the acceptance gate. The review card shows all three scores, the engineer's line, the seven mastering checks, and Rework (beat preserved) versus Accept & master.
- **Mastering gate** — `assessMaster()` checks an accepted take, timing ≥ 75, at least three arranged tracks, a downbeat kick, a bass part, arrangement ≥ 60 and tempo 80–160. The Vault refuses handover with a mastering-gate message while any check fails.
- **Canon release pipeline** — `draft → mastered → delivery-pending → confirmed → released`. The desk now moves a master to **confirmed** and the release lands a few game seconds later; every transition only fires from the state before it. No cash, XP, reputation or royalties are awarded at any point.
- **Persistence** — save v2 gained `production.pattern` (bpm, loop, mutes, volumes, 16 steps × 5 tracks), `production.take` (last take, accepted or rejected) and `production.captures`. v1 migration is unchanged and still passes.
- **Mobile** — 8 pads per row in portrait (two rows per track) and 16 in landscape/wide, 38 px pads, 48 px transport targets, safe-area padding, panel scrolls inside 94vh, landscape card widens to 1040 px. Audio stops on Stop, on closing the panel, and whenever the pause sheet or main menu opens.

### Files changed

New: `tgg-game3d/src/sequencer.js` (pattern model, arrangement score, mastering gate, hash), `tgg-game3d/src/producer.js` (panel, transport, capture, review), `tgg-game3d/src/release.js` (pipeline guards and timers), `tgg-game3d/test/production.test.mjs`.

Modified: `tgg-game3d/src/audio.js` (scheduler + five voices), `tgg-game3d/src/main.js` (producer wiring, production state, confirmed step, release timers, debug handles), `tgg-game3d/src/progress.js` (`confirmed` in the canon order, production schema), `tgg-game3d/index.html` (production panel markup and styles, prompt text), `tgg-game3d/package.json` (`npm test`), `BUILD_STATUS.md`.

### Build and deployment receipt

- `npm run build` → `game.js` **616,204 bytes**.
- Deployed to preview (site `4b7e2f61-9c3a-4d58-8f21-7a6c0b5e9d34`, environment `3fafc7d6-…`): operation `5f763100-eb0e-4dd0-9d8f-f5690efef362`, request `5e0b7c92-3f4a-4d18-b6e7-19c2a0f5d3b8`, state `succeeded`, 2026-11-11T13:49:11Z → 13:49:14Z.
- Live bundle is byte-identical to the local build (616,204 bytes).

### Tests actually run

Headless (`npm test`, 15 passed, 0 failed):

1. five tracks × sixteen empty steps; 2. per-track step independence; 3. mute and volume clamp per track; 4. BPM clamps 70–180; 5. clear keeps tempo, mutes and volumes; 6. junk patterns normalise and short step arrays pad; 7. arrangement scores starter 100, empty 0, cluttered < 60; 8. take blending and the 80 gate; 9. mastering gate rejects a missing take, bad timing, slow tempo, no bass and no downbeat kick; 10. pattern hash stable and edit-sensitive; 11. release guards move one step at a time; 12. the chain cannot double-release; 13. save v2 keeps pattern, mix and take through export/import; 14. a v1 save still migrates and gains an empty production; 15. `RELEASE_ORDER` includes `confirmed`.

Live preview with `#debug` (all observed after the final deploy):

- Reload with the completed run → menu → Continue restored stage/complete/release `released`, take 100/100 and 2 captures.
- Restart reset the run to stage 0, release `draft`, starter drums 6 hits, captures 0.
- Panel opens from the studio with 5 tracks, 80 pads, starter counts 6/5/4/4/5 and `Arrangement 100/100 · 24 hits · 96 BPM`.
- Toggling a melody pad changed only that track, updated the count to 5 and persisted `production.pattern`.
- BPM + wrote 101 to the save; Loop toggled `aria-pressed` true → false → true; bass mute and the drums volume slider persisted; Clear needed two taps, emptied all notes and kept BPM 101 and the mute.
- Play → Stop flipped the transport label and scheduler state; opening the pause sheet stopped playback.
- Capture with a cleared pattern → quality 60, rejected, verdict "the beat is too thin to master", 5 failed gates, accept disabled, capture count persisted.
- Rework returned to the pads; loading the starter beat restored 24 hits.
- Capture on the starter beat → quality 100 accepted, all gates green, accept enabled.
- Accept → release `mastered`, stage advanced 0 → 1, journal `[0]`, title "Receipt", hash `d5cd004c`, take 100 saved.
- Handover → `delivery-pending`; a second handover call was refused; desk check → `confirmed` (persisted, chip "Confirmed · release lands in a moment"); landing → `released`, stage complete, journal `[0,1]`, completion overlay shown.
- Extra `confirmDelivery`, `releaseDelivery` and `startDelivery` calls changed nothing: no duplicate confirmation or release.

### Bugs found and fixed during this milestone

1. The starter beat was read as a boolean mask instead of step indices, leaving the downbeat kick empty and failing the mastering gate.
2. The Loop button lost its `aria-pressed` state when the transport was rebuilt, so it looked inert.
3. The engineer's line ignored which score failed and claimed "the arrangement is there" on an empty beat.
4. Re-accepting a saved take could advance the story a second time; acceptance now only moves the run on the first mastery.
5. The debug `delivery` handle pointed at a stale object after each transition, which made forced-timer probes meaningless; it is a getter now.

### Android-specific limitations and remaining defects

- No physical Android device test. Pad and transport sizes follow the touch guidance, but nothing here has run on real hardware.
- Audio audibility is unverified: the cloud browser is headless, so only scheduler state, transport state and step highlighting were checked.
- A capture resets the session beat to zero, so eight taps issued inside one frame score 100/100 timing. On a device taps are spread over real time, but the gate could be tightened to reject sub-frame bursts.
- The old tap-take HUD (`#studioHud`, `startTake`, `finishTake`, `updateStudioHud`) is no longer reachable; it is dead code left in place this milestone.
- Export download and file-picker import remain unverified on Android; the Node test covers the v2 document round trip.
- The desk timers pause with the pause sheet; the release lands after roughly seven unpaused game seconds.
- Cloud AI is still unproven — no provider secret is configured, so `/api/story/verify` still reports 501.
- Save `stage` is clamped to the last stop, so a completed run stores `stage: 1` with `complete: true`; the flag is authoritative (pre-existing behaviour).

### Next recommended milestone

**Milestone 4 — Airport, cargo van and the airport cargo mission:** the road out to Salt Flats, a drivable cargo van with its own handling, a loading job with a real fail state, and the delivery that unlocks the Maya studio storyline. It should reuse the mission center markers and the save v2 journal rather than adding a second mission system.

## 10. Milestone 4 — Salt Flats airport cargo, plus the deferred fixes

### Defects fixed first (carried over from Milestone 3)

1. **`interact()` still called the deleted `finishTake`.** A retired tap branch survived the producer rewrite and would have thrown once a session reached its third layer. The branch is gone; the producer owns tapping.
2. **Stepping out and `start()` distance still read the coupe.** Both now use the vehicle actually being driven, so the van cannot be exited at speed and the opening toast measures from the right car.
3. **Burst takes were reviewed with the timing verdict.** The review now keeps the burst line instead of claiming "the arrangement is there, the timing is not".
4. **The diagnostics frame time was clamped to 50 ms.** It received the simulation `dt` (capped at 0.05 s) and could never report a slow frame. It now takes the raw clock delta: a throttled headless tab reports 1444.2 ms, which is the truth.
5. **The old tap-take HUD is finally gone** — `#studioHud`, its 12 CSS rules, `startTake`, `finishTake`, `updateStudioHud` and the HUD element handles were removed rather than left dead.
6. **The take gate now refuses bursts.** `StudioSession` records the gap between taps; anything under 100 ms of game time marks the take as a burst, which scores 0 and cannot be accepted. Eight taps inside one frame no longer pass.

### Milestone 4 features

- **Salt Flats airfield** on the east edge `(234, −234)`: a solid 58 m apron you can drive on, hangar shell, painted strip with dashes, crate stack, windsock and dock light. No tower was built there — the landmark renders as a working cargo dock, not a fake airport.
- **Cargo van** — a second drivable vehicle with its own handling (22 m/s top speed, softer acceleration, heavier braking, wider steering) and its own body. `Car` now takes an options object; the coupe is untouched.
- **The cargo run** — three crates loaded with E at the bay, a 90-second clock that starts when the last crate is in, straight-line target switched to the Vault dock, and delivery with E at walking pace.
- **Real fail states** — a hard wall or traffic impact above 8.5 m/s adds a dent; three dents write the freight off; the clock running out fails it too. On failure the van is returned to the bay, the run is persisted as `failed`, and the bay offers a reload.
- **Maya unlock** — a successful delivery sets `journal.maya`, completes Act I and shows the Maya studio thread as **Unlocked** in the mission center, with the missions themselves still marked not built.
- **Map and missions** — Salt Flats is a real map location with a description; the salt district entry is no longer listed as locked; the mission center shows three Act I missions and the cargo state.
- **Save v2** — `cargo` (state, crates, damage, timers, reason, attempts), `van` position, and `journal.maya`. `MAX_STAGE` is now 2. v1 migration still passes.
- **Diagnostics** (`i` chip or `I`): fps, frame ms, draw calls, triangles, geometries, textures, pixel ratio, viewport, audio state, online, stage/release, cargo, van position and which vehicle is being driven.
- **Android checklist** — `ANDROID_SMOKE.md` covers install, menu/save, screens, studio, release, cargo and offline, with a results table to fill in on hardware.

### Files changed

New: `tgg-game3d/src/cargo.js`, `tgg-game3d/test/cargo.test.mjs`, `ANDROID_SMOKE.md`.

Modified: `tgg-game3d/src/car.js` (van build, configurable handling, impact flags), `tgg-game3d/src/city.js` (Salt Flats landmark and apron), `tgg-game3d/src/main.js` (van switching, cargo run, diagnostics, dead HUD removal, stage 3), `tgg-game3d/src/progress.js` (MAX_STAGE 2, cargo/van/maya), `tgg-game3d/src/studio.js` (tap-gap guard, `abort()`), `tgg-game3d/src/producer.js` (burst review), `tgg-game3d/src/screens.js` (airport, three missions, Maya), `tgg-game3d/index.html` (cargo chip, diagnostics panel, HUD removal), `tgg-game3d/package.json` (second test file), `BUILD_STATUS.md`.

### Build and deployment receipt

- `npm test` → **28 passed, 0 failed** (15 production, 13 cargo).
- `npm run build` → `game.js` **626,674 bytes**.
- Preview deploy (site `4b7e2f61-9c3a-4d58-8f21-7a6c0b5e9d34`, env `3fafc7d6-…`): operation `90e0bd6e-fabd-4af1-8924-bba08e71e83c`, request `6b1f4d28-90c7-4e53-b1a8-3d20e7f5c9a4`, state `succeeded`, 2026-11-11T14:14:13Z → 14:14:16Z.

### Tests actually run

Headless, 13 new cargo tests: idle start; three crates one press each; departure only on a full load; the clock counts down only in transit; three hits write off the freight; damage outside transit ignored; fail records its reason and blocks delivery; delivery counts once and keeps attempts; junk normalises; a burst is flagged while a timed pass is not; `abort()` ends a pass without finishing it; cargo/van/Maya survive export → import; stage 2 allowed, beyond clamped, fresh saves default clean.

Live preview (`#debug`) on build 626,674:

- Continue after reload restored `journal.maya: true`, `cargo: delivered`, `complete: true`; the cargo chip read `CARGO DELIVERED`; `#studioHud` is absent from the DOM.
- Bay: first press loaded crate 1/3 (`LOADING 1/3`) and put the player in the van; presses two and three reached `CARGO 3/3 · 0 dents · 90s`, objective `Run the cargo to The Vault`, map target `−156` (the Vault).
- Timer failure: winding `startedAt` back 100 s made the real `updateCargo` tick fail the run — state `failed`, reason `time`, chip `CARGO LOST · reload at Salt Flats`, van back at `218,−218`, failed state persisted.
- Reload: pressing E at the bay reset the run to `idle` with 0 crates.
- Second attempt: three crates loaded, state `transit`; van moved to `(−150, 122)` and E delivered — `delivered`, attempts 1, stage complete, overlay shown, `journal.maya` saved true, cargo saved `delivered`.
- Mission center: 7 cards including **Maya’s studio — Unlocked** and the cargo line.
- Burst gate: eight same-frame taps produced `burst: true`, quality 0, the burst verdict, accept disabled, and `production.take.burst` persisted.
- Diagnostics: toggles on and off from the chip, reports live values — `fps 47 · frame 1444.2 ms`, 33 draw calls, 207,438 triangles, 33 geometries, 6 textures, pixel ratio 1.75, audio running, stage/release and cargo/van lines.

### Remaining defects and limits

- No physical Android run yet. `ANDROID_SMOKE.md` exists but every box is unchecked; nothing in this report came from a phone.
- The fps figure is smoothed and lags for a second after a stall while frame ms is instantaneous, so the two can disagree right after a long frame.
- Salt Flats is a cargo apron, not a full airport: no runway length, taxiway, aircraft or ATC.
- Damage is wall and traffic impacts only; crates are not visually removed as they load.
- The Maya storyline is an unlock flag and a mission-center entry; no Maya missions, studio or scenes exist yet.
- Distances and the compass are straight-line; there is no road routing.
- Cloud AI still returns 501 until a provider secret is configured.
- A completed run stores `stage: 2` with `complete: true`; the flag is authoritative.

### Next recommended milestone

**Milestone 5 — Maya’s studio (Act II opener):** consume the unlock with a real cutscene-lite handoff, a second production room with its own sound palette, and two missions that build on the cargo run. City districts and jobs from the roadmap can follow on top of the same mission/journal plumbing.

## 11. Cloud director fixed, Maya's B room, and a self-test the phone can run

### Cloud AI: no key needed, and it never 501s again

The 501 was real: this deployment had no `OLLAMA_BASE_URL`, no `ZAI_API_KEY` and no `OPENAI_API_KEY`, and the Sites variable quota showed 0 of 25 used. There was nothing to fix in the provider code and no key to invent, so the Worker now writes the run itself:

- `builtinStory(seed, stage)` is a deterministic, demo-labelled grammar hosted in the Worker. `POST /api/story` answers `200` with `source: "builtin"` when no model is configured.
- `GET /api/story/verify` answers `200` with `ok: true`, `provider: "builtin"`, `keys` (booleans only), `model: { configured, answered }`, and the exact upgrade steps for adding a model later.
- A configured model that fails (bad key, dead tunnel, unusable JSON) now falls back to `builtinStory` with `degraded: "<provider>"` instead of failing the panel. A model is an upgrade, not a requirement.
- The director panel labels all three sources: `model-written · <provider>`, `TGG hosted director · written in the Worker (free)`, and `TGG director · offline beats (free)`.
- Key values are never echoed; only machine-readable status and booleans.

Verified with `curl` against the deployment: `/api/story/verify` → `200`, `provider builtin`, `model.configured false`; `POST /api/story {seed:99,stage:0}` → `200`, two beats ending `(DEMO)`; `stage:2` → the Salt Flats cargo objective. In the browser, the AI panel read `TGG hosted director · written in the Worker (free)` and the toast said `Director · hosted beats in`.

### Maya's B room (Act II opener)

- With the cargo delivered and the mix unsigned, pressing **E** at the Studio 808 mic opens the producer in `maya` mode: the sheet title becomes **Maya's B room**, the brief changes to her ear, and the same sequencer and mastering gate apply.
- Mastering there sets `journal.mayaMix` and never advances Act I, the release chain or any reward. The take can play on Crimson Line Radio.
- `journal.mayaMix` is saved and normalised (v1 and v2 saves both load), and the mission center now says **Mix mastered** with an accurate line about what is and is not built.
- The normal desk is untouched: the mic only switches to Maya while `journal.maya && !journal.mayaMix`.

### Self-test in the game

- `src/selftest.js` runs nine checks — offline director validity, seeded determinism, cargo load/deliver/fail, burst take gate, mastering gate, save round-trip and clamping, mix hash stability — and formats them as `PASS`/`FAIL` lines.
- Entry points: the **✓** chip, the **K** key, or `?selftest` in the URL. The last run is kept in `localStorage` under `tgg.selftest`.
- Live on the deployed build: `TGG self-test · 9/9 passed`, no failures, result stored, chip toggles the panel and `aria-pressed` follows.

### Files changed

New: `tgg-game3d/src/selftest.js`, `tgg-game3d/test/selftest.test.mjs`.

Modified: `tgg-game3d/worker.js` (built-in director, verify shape, graceful model fallback), `tgg-game3d/src/story.js` (`builtin` source), `tgg-game3d/src/director.js` (error labels), `tgg-game3d/src/producer.js` (variants), `tgg-game3d/src/main.js` (Maya session, self-test panel, AI labels), `tgg-game3d/src/screens.js` (Maya card), `tgg-game3d/src/progress.js` (`journal.mayaMix`), `tgg-game3d/index.html` (self-test chip and panel), `tgg-game3d/package.json`, `ANDROID_SMOKE.md`, `BUILD_STATUS.md`.

### Build and deployment receipt

- `npm test` → **34 passed, 0 failed** (15 production, 13 cargo, 6 self-test/director).
- `npm run build` → `game.js` **631,920 bytes**.
- Preview deploy: operation `8fb3eb8a-56a9-43fb-9cab-6a7540fcaa86`, request `c4e7a1d9-2b60-4f38-9a5e-71d3f0b8c264`, `succeeded`, 2026-11-11T14:22:43Z → 14:22:47Z.
- Same build with the earlier frame-time and burst-verdict fixes: operations `90e0bd6e-…` and `213e5a7c-…`, both `succeeded`.

### Tests actually run

New headless tests: the nine-check self-test passes in Node with zero failures; the built-in director is deterministic, two beats, every line `(DEMO)` and under the length limits; the airport stage is told as the cargo run; `/api/story/verify` answers 200 without a key (not 501); `/api/story` writes a run without a key; a configured but unreachable model still returns usable beats and reports `degraded`.

Live: self-test 9/9 and stored; Maya's B room opens with `variant: "maya"`, the right title and the B-room brief, and closes cleanly; hosted director label and toast as above; earlier in this session the burst gate, cargo run success/failure, Maya unlock and diagnostics were verified on the deployed build.

### Remaining defects and limits

- **City districts and jobs are not shipped.** They were the third card and they need their own geometry and job system; nothing here pretends otherwise, and the map still lists them as locked.
- Maya's mix was opened and inspected live, but **signing it with a real take was not completed end-to-end** in this session; the acceptance path is the same code the Act I desk uses, and the `maya` branch is covered by the producer variant plus the mastered-take logic, but the flow on a phone is unverified.
- No physical Android run. `ANDROID_SMOKE.md` is still unverified on hardware, though the in-game self-test covers the engine-level risk.
- Without a model key the runs are template-written, not model-written. They are deterministic and demo-labelled; they are not an LLM.
- Salt Flats is still a cargo apron, not a full airport; crates do not vanish visually; distances are straight-line.
- The fps readout stays smoothed while frame ms is instantaneous.

### Next recommended milestone

**City districts and jobs** — the one item from the last batch still unbuilt: real district blocks, a board of repeatable freight/courier jobs on the existing cargo and van plumbing, and map/mission entries that only claim what exists.

## 12. Police fixed, Maya's mix signed end to end

### Police defects

1. **The wanted badge never cleared.** `police.stop()` (lost unit, 300 m leash) hid the car but left "Unit on your tail" on screen forever. The badge now follows the unit's state each frame, so it disappears the moment the pursuit ends.
2. **`alert()` could spawn the unit on the player.** Near a map edge every 132 m candidate fell outside the city and the fallback was the player's own road position — an instant bust. It now falls back through 96 m and 60 m hops before anything else.
3. **There was no way to lose a pursuit.** A red light was a permanent tag until it caught you. Pulling more than 130 m clear for six seconds now loses the unit, clears the badge and says so.
4. **Being busted had no message** and left the escape timer armed. `busted()` now clears both timers and says what happened.

New `test/police.test.mjs` covers the spawn distance, corner spawns (all four corners), the chase closing in while staying inside the city, the 300 m leash, and `stop()`.

### Maya's mix, end to end

Verified on the deployed build with a scored take: the B room accepted it, the producer reported `mastered`, `journal.mayaMix` saved as `true`, and the toast read `Maya’s mix · 92/100 · she signs it (DEMO)`. Act I, the release chain and the stage were untouched.

### Not shipped

- **City districts and jobs** — still the one card unbuilt. It needs district geometry and a job system, not a label change.
- **A real model behind the director** — blocked on a key. There is no `ZAI_API_KEY`, `OLLAMA_BASE_URL` or `OPENAI_API_KEY` in this deployment and no way to mint one from here. Set one under Sites → Secrets and redeploy; `/api/story/verify` reports `model.answered` once it works, and the built-in director covers the gap until then.

### Build and deployment receipt

- `npm test` → **39 passed, 0 failed** (15 production, 13 cargo, 6 self-test/director, 5 police).
- `npm run build` → `game.js` **632,370 bytes**.
- Preview deploy: operation `d19a9c5b-bfdc-4dcd-bc43-e76b0492e06e`, request `f2d0c8a4-57b1-4e26-8c39-0a6b5e2d71f8`, `succeeded`, 2026-11-11T14:29:54Z → 14:29:57Z.
