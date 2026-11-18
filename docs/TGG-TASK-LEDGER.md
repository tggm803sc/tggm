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
| verified done | 57 |
| implemented, not proven in a browser | 4 |
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
| WU-0112 | Final-stop wording, idempotent advance guard, persistent checkpoint banner | `src/mission.js`, `tools/mission-hud.mjs`, `index.html` | 88/88 tests; build clean; browser: banner element present, empty→`display:none` at stop 1, style probe 206×29 lime inside viewport | verified (arrival unproven) |
| WU-0112b | Banner fills on a real arrival | `src/mission.js` | pure function tested; **no gameplay arrival captured yet** | implemented |
| WU-0113 | Android touch targets at 375×667 and 360×640 | — | — | not started |
| WU-0114 | Full two-stop run, reload, persistence | — | — | not started |
| WU-0115 | Source/build parity for every codemod + deployed-bundle check | — | — | not started |

### Notes from WU-0112

- `advanceStage()` now returns early when `canAdvance(state)` is false, before the
  stage increment, so a repeated final-stop arrival cannot reach the merge/write.
- `mission-hud.mjs` asserts four anchors (stage line, summary line, objective
  assignment ×2, HUD handle list). A missing anchor throws at build time.
- Parity caveat: the merged `tools/mission-hud.mjs` blob (`da9e520`) is the copy
  produced in this session and passed CI, but the worktree copy hashes
  `c603378`. Reconciling them is part of **WU-0115**.

## Blocked

| ID | Unit | Why |
| --- | --- | --- |
| B-01 | Hosted DB verification run | no `DATABASE_URL` secret; only the repo owner can add it |
| B-02 | Career sync across devices via API | ruled out: no external API / paid hosting |
| B-03 | Genuine offline reload proof | the preview proxy ignores offline emulation; only cache contents can be proven here |

## Resume pointer — next batch (priority order)

1. **WU-0113** Android touch-target sizing, measured at 375×667 and 360×640; HUD
   must not collide with the pedals; no page scroll while steering.
2. **WU-0114** Real two-stop run: reach stop 1 (banner must persist), complete the
   act, reload, confirm the saved best/runs survive.
3. **WU-0115** Source/build parity for `verified-save.mjs` and `mission-hud.mjs`,
   merged-file verification, deployed-bundle check, ledger kept in sync.
4. **WU-0116** Frame-time measurement harness (no invented FPS numbers).
5. **WU-0117** `tgg-app` empty/loading states on `/play`.

Update this file in the same commit as the work it records.
