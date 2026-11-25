# TGG World — work ledger

Durable resume record. Newest batch first inside each phase. A unit is only
listed as done when it has evidence (test run, build output or a browser check);
nothing here is padded to reach a round number.

## Ground truth

- Repository: `tggm803sc/tggm`. Game: `tgg-game3d`. Platform: `tgg-app`.
- Editor / DAW / Unreal TGG World: **not present in this worktree** — separate
  projects, not touched, not substituted.
- Static, offline-first, no paid hosting, no external API, no hosted DB.
- The requested 10,000-slot target is **not** being simulated. This ledger counts
  only units that changed a file or produced verification evidence. Padding it
  would make it useless for resuming.

## Status summary (this batch)

| Status | Count |
| --- | --- |
| verified done | 62 |
| implemented, not proven in a browser | 3 |
| not verified (proxy blocked the test) | 1 |
| blocked (needs a human/secret) | 2 |
| queued (next batch) | see Resume pointer |

## Phase 1 — career export/import interface

| ID | Unit | Files | Evidence | Status |
| --- | --- | --- | --- | --- |
| WU-0001 | Read merged PWA layer before changing it | `manifests`, `sw.js`, `build.mjs` | file review | done |
| WU-0002 | Locate the real start overlay and toast hooks | `index.html`, `style.css` | `#start .card`, `#toast` | done |
| WU-0003 | Add a visible **Export career** control | `src/career-panel.js` | browser: button present | verified |
| WU-0004 | Add a visible **Import career** control | `src/career-panel.js` | browser: button present | verified |
| WU-0005 | Load the panel as its own entry, not inside `game.js` | `src/career-panel.js`, `build.mjs` | `dist/career.js` 7.9 KB | verified |
| WU-0006 | Ship the panel even if the renderer fails | `build.mjs` (second esbuild entry) | build output | verified |
| WU-0007 | Inject the panel script at build time | `build.mjs` | `dist/index.html` has `src="./career.js"` | verified |
| WU-0008 | Clear, dated, sortable file name | `src/career-transfer.js` | `tgg-world-career-2026-11-17-17-21-38-best-5_0s.json` | verified |
| WU-0009 | Produce a valid portable career body | `src/career-transfer.js` | parsed blob: kind `tgg-world-career`, format 1, best 5, runs 7 | verified |
| WU-0010 | Download as `application/json` | `src/career-panel.js` | blob type + size 174 B | verified |
| WU-0011 | File picker restricted to JSON | `src/career-panel.js` | `accept="application/json,.json"` | verified |
| WU-0012 | Validate before touching player state | `src/career-transfer.js` | junk import left save byte-identical | verified |
| WU-0013 | Reject malformed JSON | `test/career-transfer.test.mjs` | `{oops` rejected | verified |
| WU-0014 | Reject a wrong / missing envelope | module | browser: `wrong_kind` | verified |
| WU-0015 | Reject unsupported versions | module | test: newer build refused | verified |
| WU-0016 | Reject invalid numbers / best times | `progress.js` import check | existing tests | verified |
| WU-0017 | Reject impossible progression | merge-only rules | tests | verified |
| WU-0018 | Reject oversized files before reading | `src/career-panel.js` | 300 KB file → "too large (limit 256 KB)" | verified |
| WU-0019 | Keep the previous career as a backup | `src/career-transfer.js` | backup held `{version:2,best:9,runs:4}` | verified |
| WU-0020 | Merge-only: never downgrade a better career | `src/career-transfer.js` | worse import → "already on this device" | verified |
| WU-0021 | Say what the import did | `describeImport` | note text after each case | verified |
| WU-0022 | Say why a file was refused | `describeImport` | `Not a TGG World career file (wrong_kind).` | verified |
| WU-0023 | Handle a cancelled picker | `picker.value = ''` before read | code review | implemented |
| WU-0024 | Handle a duplicate import | no-change branch | test + message | verified |
| WU-0025 | Handle a blocked or full browser storage | `usable()` + try/catch | test: `status: unavailable` | verified |
| WU-0026 | Handle a valid file the browser refuses to write | `writeStoredCareer` returns false | test | verified |
| WU-0027 | Keyboard accessibility (native buttons, no traps) | `src/career-panel.js` | not exercised with a keyboard | implemented |
| WU-0028 | Mobile-sized controls | inline 44 px min height | measured 44 px | verified |
| WU-0029 | Reload after a successful import | `career-panel.js` | page reloaded, save readable | verified |
| WU-0030 | Progression survives the reload | storage round trip | `best 5 / runs 7` after reload | verified |
| WU-0031 | Career file tests | `test/career-transfer.test.mjs` | 10 tests, all pass | verified |
| WU-0032 | Narrow-screen layout | inline styles | no horizontal overflow at 375×667 | verified |
| WU-0033 | Shell cached so the game can start with no network | cache holds 8/8 shell files incl. `career.js` | verified |
| WU-0045 | Prove a real offline reload | offline emulation had no effect through the preview proxy (uncached probe still returned 404) | **not verified** |

## Phase 7 — PWA / offline reliability

| ID | Unit | Evidence | Status |
| --- | --- | --- | --- |
| WU-0034 | Precache the new panel bundle | `sw.js` shell list | verified |
| WU-0035 | Fail the deploy if the panel is missing or uncached | workflow guards | verified (yaml + build) |
| WU-0036 | Worker controls the page after reload | `controller === true` | verified |
| WU-0037 | Offline shell cached with all 8 entries | cache `tgg-world-mwkyjwfg` | verified |

## Phase 13/14 — gates and delivery

| ID | Unit | Evidence | Status |
| --- | --- | --- | --- |
| WU-0038 | Game test suite | `npm test` → 53 pass, 0 fail | verified |
| WU-0039 | Platform test suite | `npm test` in `tgg-app` → 18 pass | verified |
| WU-0040 | TypeScript | `npx tsc --noEmit` clean | verified |
| WU-0041 | Production build | `npm run build` exit 0, 8 files | verified |
| WU-0042 | No build placeholders remain | `__TGG_VERSION__` count 0 | verified |
| WU-0043 | Pages workflow syntax | parses, guards added | verified |
| WU-0044 | Live Pages deployment | runs `44137147151` (1f7a8fa) and `44141605316` (d90b0e9) both **success**; live `game.js` checked by content | verified |

## Phase 20 — save health, mission feedback (PR #31, #32, #33, #34, #35)

| ID | Unit | Files | Evidence | Status |
| --- | --- | --- | --- | --- |
| WU-0108 | Save health line + recovery + reset, backup snapshotted before boot overwrites it | `src/save-status.js`, `src/career-panel.js`, `build.mjs` | 69→73 tests; browser: recovery, reset, newer-build warning | verified |
| WU-0109 | Multi-tab detection refreshes instead of silently clobbering | `src/save-status.js` | tests; browser toast | verified |
| WU-0110 | Route the completion save through the verified writer | `tools/verified-save.mjs` codemod | 73/73 tests; `dist/game.js` carries the pending key; Pages guard greps it | verified |
| WU-0111 | Mission HUD wording from a tested module | `src/mission.js`, `tools/mission-hud.mjs` | 83/83 tests; browser: "Stop 1 of 2", objective "Drive to Studio 808" | verified |
| WU-0112 | Final-stop wording, idempotent advance guard, persistent checkpoint banner | `src/mission.js`, `tools/mission-hud.mjs`, `index.html` | 88/88 tests; build clean; browser: banner element present with `role=status`, empty and 0×0 at stop 1, style probe 206×29 lime inside the viewport | verified (arrival unproven) |
| WU-0112b | Banner fills on a real arrival | `src/mission.js` | real run: reaching Studio 808 at run time 46.5 s set `Checkpoint 1 reached · final stop ahead` (274.3×17 px, 0×0 before); the arrival toast had already faded to `toast` while the banner still read the same text | verified |
| WU-0113 | Phone touch targets at 375×667 and 360×640 | `style.css` (`--touch`), `test/touch-targets.test.mjs` | 92/92 tests (the guard fails when the token shrinks); browser at both sizes: chips 44×44, steer 58×58, handbrake 46, brake 56, gas 72, CTA 44 px tall, nothing under 44, no overlap, no overflow, every control hit-tests to itself once the run starts | verified |
| WU-0113b | Touch targets re-measured with genuine touch emulation, including landscape | none (measurement only) | five sizes with real touch emulation (mobile metrics, DPR 2–3, `setTouchEmulationEnabled`, `maxTouchPoints` 5): `pointer: coarse` and `hover: none` both true, `.desktop-hint` hidden. Portrait 375×667 / 360×640: chips 44, steer 58, handbrake 46, brake 56, gas 72, CTA 44 tall. Landscape 667×375 / 640×360 / 740×360: chips 44, steer 58, handbrake 46, brake 52, gas 66, CTA 44 tall. Nothing under 44, no overlap, no overflow, every control hit-tests to itself | verified |
| WU-0114 | Full two-stop run, reload, persistence | — (verification only) | one continuous run in the cloud browser: stop 1 at 46.5 s (leg 46.5), act complete at 141.2 s (legs 46.5 + 94.7); card `Run 2:21.2 (1: 0:46.5 · 2: 1:34.7) · best 2:21.2 · saved on this device`; save `{"version":2,"best":141.2,"runs":1,"lastRun":141.2}`; after reload `progressStatus()` `ok`, HUD `Best 2:21.2`, start line `Best run 2:21.2 · 1 completed`, stage back to `Stop 1 of 2`, banner back to 0×0 | verified |
| WU-0115 | Source/build parity for every codemod + deployed-bundle check | `tools/verified-save.mjs`, `tools/mission-hud.mjs`, `build.mjs` | worktree reset onto `main` `385899b`; both codemod blobs match (`ab1db61`, `da9e520`); a clean rebuild reproduces the live bytes: `game.js` `f44478a4…ebb690` (554,602 B), `index.html` `a97eb9ab…`, `style.css` `1387339e…` | verified |

### Notes from WU-0112

- `advanceStage()` now returns early when `canAdvance(state)` is false, before the
  stage increment, so a repeated final-stop arrival cannot reach the merge/write.
- `mission-hud.mjs` asserts four anchors (stage line, summary line, objective
  assignment ×2, HUD handle list). A missing anchor throws at build time.
- Corrected while measuring WU-0113: the empty banner is **not** `display:none`.
  Only `.leg-line:has(.leg-split:empty)` is hidden; the banner itself keeps
  `display:inline-block` but measures 0×0, and the mission card stays 121.3 px, so
  it adds no visible strip. Anything that changes this needs a new measurement.

### Notes from WU-0113

- The merged `tools/mission-hud.mjs` (`da9e520`) and the old worktree copy
  (`c603378`) were never behaviourally different: quote style on two constants
  and two comment lines. The worktree now carries the merged blob, so the local
  and deployed source are the same file.
- Every number above comes from `getBoundingClientRect()` in the cloud browser at
  `375×667` and `360×640`, portrait, after clearing the service worker and its
  cache (a stale shell was serving the old 34 px chips on the first pass).
- The browser session could not run with `pointer: coarse` emulation, so the
  `@media (hover: none)` rule was inactive; the portrait sizing block that governs
  these controls was active (`matchMedia('(orientation: portrait)')` true).
  WU-0113b closes that gap: every size was re-measured with a genuine coarse
  pointer, and the numbers above were reproduced.

### Notes from WU-0114

- How the run was driven: the car was steered by dispatching real `keydown` /
  `keyup` events to `window`, which the game's own handlers turn into throttle,
  brake and steering. Physics, collision, traffic bumps, arrival checks and the
  save path all ran unmodified. Nothing was teleported and no game state was
  written directly; the `#debug` hook was only read to observe the run.
- Banner vs toast: at arrival the toast was `toast show` with
  `Studio 808 · session logged (DEMO)`; it later fell back to `toast` while the
  banner kept `Checkpoint 1 reached · final stop ahead` at 274.3×17 px. The
  banner is the persistent channel; the toast is the transient one.
- The completion card's summary is rewritten a moment after completion to append
  ` · run queued, will retry`: cloud sync is enabled against an API base that is
  not reachable from this build, so the run is queued in `localStorage` with a
  stable id. That is the queue working, not a save failure, but on a purely
  static deploy it means the card carries a retry note forever. Follow-up
  candidate: skip or reword the sync line when no API base is configured.
- Reload is a real reload of the page: stage, legs, timer and banner reset, while
  `best` and `runs` come back from the save and the start card reports them.
- Timing honesty: the cloud browser renders in software at 6–7 fps and the loop
  caps `dt` at 0.05 s, so the wall-clock run took about four times the 2:21.2 the
  game reported. Every number above is game time, which is what the HUD shows.
  This is the strongest argument for WU-0116's frame-time harness.
- Landscape sizing: handbrake stays 46 px, brake drops to 52 px and gas to 66 px
  because the pedal clamp follows `vmin` on a 360 px-tall viewport; all stay over
  44 px. The start card scrolls in landscape (at 640×360: 328 px visible against
  569 px of content) but the 44 px CTA sits above the fold at y=248.

## Blocked

| ID | Unit | Why |
| --- | --- | --- |
| B-01 | Hosted DB verification run | no `DATABASE_URL` secret; only the repo owner can add it |
| B-02 | Career sync across devices via API | ruled out: no external API / paid hosting |
| B-03 | Genuine offline reload proof | the preview proxy ignores offline emulation; only cache contents can be proven here |

## Resume pointer — next batch (priority order)

1. **WU-0116** Frame-time measurement harness (no invented FPS numbers).
2. **WU-0117** `tgg-app` empty/loading states on `/play`.
3. **WU-0118 candidate** The completion card's `run queued, will retry` note on a
   build with no API base: decide whether to disable cloud sync there or reword
   the line, so a static deploy never promises a sync that cannot happen.

Touch targets now have real numbers at five sizes (portrait 375×667, 360×640;
landscape 667×375, 640×360, 740×360), all measured with a genuine coarse pointer.

Update this file in the same commit as the work it records.
