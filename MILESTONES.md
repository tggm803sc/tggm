# TGG World — milestone board

Last written: 2026-11-11 (final regression). This file is the durable record of what is **verified**,
what is implemented but unproven, and what is not built. Update it in the same
commit as the work it describes.

## Verified baseline

| Item | Value |
| --- | --- |
| Branch | `feat/tgg-world-left-turn-walk-signals` |
| Commit | `62db75c` — automation undo, plus lane repaint after undo |
| Tests | **121 passed, 0 failed** |
| Deploy | `0363f341-255b-4b4d-b6f5-d7a1fc7adb1d` (preview) |
| Preview | https://site-3fafc7d6c378497f910b8708af22753c.freebuff.page |

Test breakdown: 15 production, 13 cargo, 6 self-test, 5 police, 7 jobs,
20 session/WAV, 6 master, 9 automation, 10 world clock, 8 mix FX,
8 mixdown FX, 7 FX automation, 11 mix FX
(including three block-continuity tests).

## Milestone board

| Area | State | Evidence |
| --- | --- | --- |
| World clock (hour, rate, persistence) | Done | 10 unit tests; v2 storage key, legacy v1 dropped |
| Daytime default 09:00 | Done | unit test + live page (copy and no night save) |
| Sky / fog / sun / exposure palette | **Done (Milestone 4)** | four deployed screenshots: `artifacts/light-dawn.png` (06:00 warm horizon, stars up), `light-midday.png` (12:00 blue sky, no stars), `light-sunset.png` (18:00 amber dusk), `light-midnight.png` (22:00 neon + stars) |
| Stars, neon, headlights follow clock | **Done, browser-verified** | star visibility was inverted and fixed in `a31aec7`; midday shows no stars, night shows them |
| Studio interior lighting protected | Done | point lights excluded from clock dimming |
| DAW automation: create, drag, delete | Done | browser-tested with own runtime |
| Automation reload persistence | **Verified** | real reload: dragged point kept its new time/level, deleted point stayed gone; IndexedDB `[{time:0.45,value:0.9},{time:0.55,value:0.78}]` |
| FX chain (EQ, comp, gate, saturation) | Done | 8 unit tests |
| FX in exported mixdown | **Done (Milestone 1)** | 8 export tests; opt-in, byte-identical when off, multitrack levels and clipping covered |
| FX enable switch in the UI | **Done, browser-verified** | button read "FX on", `aria-pressed="true"`, status `FX on · Main vocal` |
| FX lane target in the UI | **Done, browser-verified** | 10 options; selector and lane both reported `automationFx:saturation` |
| FX automation | **Done (Milestone 3)** | block-based parameter lanes; 7 tests incl. saturation and compression ramps shaping the export |
| Streetlight illumination / light pools | **Done (Milestone 5)** | 16 real point lights at lamp heads, scaled by the clock's night factor; glow decal is night-only and fades to zero in daylight |
| Full regression (Milestone 6) | **Run** | 114 tests across 12 suites, all passing; deployed build checked for console errors |
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
2. **Reload persistence — verified 2026-11-11.** Point placed at 55% / 35%,
   page reloaded, DAW reopened: lane rendered 194 lit pixels (vs 62 after the
   single point) and IndexedDB held `1 lane · 1 point · {time: 0.55, value: 0.78}`.
   Follow-up 2026-11-11: two points created, one dragged from 25% to 45% and one
   deleted, then the page reloaded. After reload IndexedDB held
   `[{time:0.45,value:0.9},{time:0.55,value:0.78}]` — the dragged point at its new
   position, the deleted point absent — and the lane redrew with 172 lit pixels.
   Probe pattern: one action per call, `daw.open()` needs ~4.5 s, re-query
   `[data-auto]` after every edit because `renderMixer()` replaces the canvas.
3. **FX automation — done** (commit `da54b7d`): lanes per effect parameter with
   real ranges, resolved at each 2048-sample block midpoint inside the per-track
   render, persisted through `normalizeSession`, inert while `fx.enabled` is off.
   Remaining gap: no UI lane target for effect parameters yet.
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
