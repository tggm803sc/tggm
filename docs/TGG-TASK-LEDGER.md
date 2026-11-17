# TGG World — work ledger

Durable resume record. A unit counts only when it changed a file and has evidence
(test run, build output, HTTP or browser result). Numbers here are small and true;
this file is not padded toward the 10,000-slot ceiling.

## Ground truth

- Repo `tggm803sc/tggm`. Game `tgg-game3d`. Platform `tgg-app`.
- Editor / DAW / Unreal TGG World: **not in this worktree**. Separate projects, untouched.
- Static, offline-first. No paid hosting, no external API, no hosted DB.

## Batch 1 — career transfer UI (merged #30, `1f7a8fa`)

| Unit | What | Evidence |
| --- | --- | --- |
| WU-0001..0033 | Export/Import career panel as its own `career.js` bundle; dated file name; validation; merge-only; backup before import; size guard; messages | 10 tests; browser: real blob `application/json`, merge to best 5/runs 7, junk → `wrong_kind`, 300 KB refused, 44 px buttons at 375×667 |
| WU-0034..0037 | Panel in SW shell; Pages guards | cache held 8/8 shell files incl. `career.js` |
| WU-0044 | Live deployment | run `44137147151` success; live `/tggm/` 200 with `career.js`, live `career.js` 200/7909 B |

## Batch 2 — save health (merged #31, `a40611a`)

| Unit | What | Evidence |
| --- | --- | --- |
| WU-0100..0109 | Status line (empty/saved/newer-read-only/corrupt/unavailable), Restore backup, two-click Reset, `writeProgressVerified`, multi-tab refresh | 16 tests; browser: corrupt → "backup from before is available (best 0:05.0)" → restored "best 0:05.0 · 3 runs · backup kept"; reset arms then clears with backup+snapshot kept; newer save amber read-only; second tab reflected |
| — | **Defect fixed:** boot copied the corrupt payload over the backup key, hiding a good backup. `career.js` now loads first and snapshots it. | regression test reproduces the overwrite |

## Batch 3 — verified completion save (merged #32, `d90b0e9`)

| Unit | What | Evidence |
| --- | --- | --- |
| WU-0110 | `writeProgress()` now calls `writeProgressVerified` via an exact-match codemod (`tools/verified-save.mjs`) applied by an esbuild plugin; build throws if the block moves or a direct `setItem(SAVE_KEY, …)` survives | `npm test` 73 pass / 0 fail; `dist/game.js` contains `tgg.world.act1.v1.pending` + `storage blocked or full`, no `not saved · storage blocked`; Pages guard greps the pending key |
| WU-0110 (browser) | Quota failure during a real write path | `Storage.prototype.setItem` throwing on save keys → "The file was valid but this browser refused to save it (storage blocked or full)", stored career byte-identical |

Not verified for WU-0110: a literal mission completion in the browser. The
completion write is proven at bundle and unit level, not by finishing a run.

## Implemented but unverified

- "Another tab changed this career" prefix (the refresh happens; the prefix was overwritten by a visibility refresh before it could be read).
- Keyboard-only operation of the career buttons; cancelled file picker.
- True offline reload: offline emulation had no effect through the preview proxy (uncached probe still 404), so only cache contents are proven.

## Blocked

- **B-01** hosted DB verification: no `DATABASE_URL` secret; owner-only.
- **B-02** cross-device sync via API: ruled out by the no-external-API rule.

## Next work unit

**WU-0111 — gameplay objectives and completion feedback.** Inspect the mission
loop in `main.js` (stage/leg progression, `state.legs`, `reflectProgress`,
`overlayComplete`), then add objective progress and completion feedback that the
verified save path already backs. After that: WU-0112 visuals (lighting, road
readability) and WU-0113 Android touch sizing, each with its own evidence row.

Update this file in the same commit as the work it records.
