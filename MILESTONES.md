# TGG World — milestone board

Last written: 2026-11-11. This file is the durable record of what is **verified**,
what is implemented but unproven, and what is not built. Update it in the same
commit as the work it describes.

## Verified baseline

| Item | Value |
| --- | --- |
| Branch | `feat/tgg-world-left-turn-walk-signals` |
| Commit | `15613bb` — default FX off and cover multitrack export levels |
| Tests | **107 passed, 0 failed** |
| Deploy | `b7a38e87-76a0-450b-8cbd-12c6eb27177b` (preview) |
| Preview | https://site-3fafc7d6c378497f910b8708af22753c.freebuff.page |

Test breakdown: 15 production, 13 cargo, 6 self-test, 5 police, 7 jobs,
20 session/WAV, 6 master, 9 automation, 10 world clock, 8 mix FX,
8 mixdown FX.

## Milestone board

| Area | State | Evidence |
| --- | --- | --- |
| World clock (hour, rate, persistence) | Done | 10 unit tests; v2 storage key, legacy v1 dropped |
| Daytime default 09:00 | Done | unit test + live page (copy and no night save) |
| Sky / fog / sun / exposure palette | Done | unit tests; live screenshot at 09:00 |
| Stars, neon, headlights follow clock | Implemented | deployed; **visual verification pending** |
| Studio interior lighting protected | Done | point lights excluded from clock dimming |
| DAW automation: create, drag, delete | Done | browser-tested with own runtime |
| Automation reload persistence | **Unverified** | browser probe blocked by 10 s cap + tab mode churn |
| FX chain (EQ, comp, gate, saturation) | Done | 8 unit tests |
| FX in exported mixdown | **Done (Milestone 1)** | 8 export tests; opt-in, byte-identical when off, multitrack levels and clipping covered |
| FX enable switch in the UI | **Missing** | model default `enabled: false` exists; no rack control sets it yet |
| FX automation | **Not started** | chain is buffer-based; needs block rendering |
| Streetlight illumination / light pools | **Not started** | lamp pools are baked emissive meshes |
| MP3 export, pitch correction | Not implemented (deliberate) | would be faked otherwise |

## Working rules

- No TinyFish or paid third-party browser automation. Verification uses this
  workspace's own cloud browser runtime.
- No runtime Gemini in TGG. Gemini is a Freebuff coding provider only. Any
  `GEMINI_API_KEY` belongs in server secrets, never in client code, never in chat.
- A passing unit test is not proof the live game works. Systems that touch audio,
  storage or rendering need their own browser or runtime evidence.
- Never report a browser test as passed without a captured result.
- Do not change the default render path: `fx.enabled` defaults false so existing
  sessions and their 20 session/WAV tests stay identical.

## Next actions, in order

0. **Milestone 1 closed** (commit `15613bb`): FX renders per track into the
   export, defaults off, identity when neutral, each stage proven to change the
   samples, multitrack balance and clipping covered.
1. **FX enable switch (UI).** Add a control in the FX rack that sets
   `track.fx.enabled`. Accept when: a track with the switch on produces an export
   whose samples differ from the same track with it off, and a neutral chain still
   renders identical samples.
2. **Reload persistence.** Add an automation point, reload the deployed page,
   reopen the DAW, confirm the point is present. One action per browser probe; the
   evaluator caps at 10 s and `daw.open()` awaits IndexedDB. Re-query any canvas
   that `renderMixer()` replaced before dispatching to it.
3. **FX automation.** Decide block size for parameter automation, extend the lane
   model with effect targets, apply during the per-track render, persist and reload.
   Accept when exported audio changes across the automated range.
4. **Lighting evidence.** Screenshots at sunrise, midday, sunset and midnight from
   the deployed build.
5. **Streetlight pools.** Real lamp lighting rather than baked emissive quads.
6. **Regression + deploy** after each step, with the test count in this file
   updated to match.

## File map

- `tgg-game3d/src/worldclock.js` — hour, palette, sun position, save/load
- `tgg-game3d/src/mixfx.js` — offline channel strip
- `tgg-game3d/src/wav.js` — `mixdown` (per-track FX), `stemMixdown`, WAV encoder
- `tgg-game3d/src/session.js` — session model, automation, master bus
- `tgg-game3d/src/daw.js` — studio UI, transport, mixer, automation lanes
- `tgg-game3d/src/storage.js` — IndexedDB takes, samples, projects
- `tgg-game3d/src/main.js` — world, lighting wiring, frame loop
- `tgg-game3d/test/*.test.mjs` — the 106-test suite
