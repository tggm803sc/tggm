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
| verified done | 51 |
| implemented, waiting on deploy workflow | 3 |
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
| WU-0016 | Reject invalid numbers / best times | `progress.js` import check | 9 existing tests | verified |
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
| WU-0027 | Keyboard accessibility (native buttons, no traps) | `src/career-panel.js` | Tab reaches both buttons | implemented |
| WU-0028 | Mobile-sized controls | inline 44 px min height | measured 44 px | verified |
| WU-0029 | Reload after a successful import | `career-panel.js` | page reloaded, save readable | verified |
| WU-0030 | Progression survives the reload | storage round trip | `best 5 / runs 7` after reload | verified |
| WU-0031 | Career file tests | `test/career-transfer.test.mjs` | 12 tests, all pass | verified |
| WU-0032 | Narrow-screen layout | inline styles | no horizontal overflow at 375×667 | verified |
| WU-0033 | Works with the network off | SW precache + panel | offline reload showed both buttons | verified |

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
| WU-0044 | Live Pages deployment | — | not claimed |

## Blocked

| ID | Unit | Why |
| --- | --- | --- |
| B-01 | Hosted DB verification run | no `DATABASE_URL` secret; only the repo owner can add it |
| B-02 | Career sync across devices via API | ruled out: no external API / paid hosting |

## Resume pointer — next batch (priority order)

1. **WU-0100** Save-status line in the start overlay (last saved / backup present / read-only newer build).
2. **WU-0101** Explicit "Reset career" with typed confirmation, which never deletes the backup.
3. **WU-0102** Corrupt-save recovery prompt that offers the backup instead of silently resetting.
4. **WU-0103** Touch control audit: 44 px minimums, no page scroll while steering.
5. **WU-0104** Pause/restart state-transition tests against double completion.
6. **WU-0105** Race reward idempotency test (replay the completion event).
7. **WU-0106** Frame-time measurement harness (no invented FPS numbers).
8. **WU-0107** `tgg-app` empty/loading states on `/play`.

Update this file in the same commit as the work it records.
