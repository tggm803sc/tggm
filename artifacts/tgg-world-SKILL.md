---
name: tgg-world
description: Build, verify, and ship TGG World — the three.js open-world music-industry game plus its Pro-Tools-style DAW — including city and airport content, vehicles, missions, cargo runs, audio export and deployment. Use this whenever a task mentions tgg-game3d, the game, the DAW, Studio 808, The Vault, Salt Flats, the airport, cargo missions, mixdown or export, or asks to add city locations, interiors, NPCs, jobs or career progression. Also use it when the user says "keep building", "content mode", or "deploy the game", even if they do not name the project.
---

# TGG World

A three.js open-world game set in the music industry, with a real DAW attached
(`tgg-game3d/src/daw.js`, `wav.js`, `mixfx.js`). The city is procedural; missions
drive between landmarks.

## Non-negotiables

These have all been violated before and cost real time:

- **Content first.** New playable content and visible improvements outrank
  maintenance. Log small bugs in `MILESTONES.md` and keep building. Stop the
  content work only for security issues, data loss, broken builds, or a blocked
  dependent system.
- **Never weaken a test to get green.** No skipped tests, no loosened asserts, no
  suppressions. If behavior must change, change the test to assert the new
  behavior and say why.
- **Never claim verified without evidence.** A passing build proves it compiles,
  not that it plays. Say "built, not played" until you have actually driven it.
- **No runtime Gemini, no keys** in code, files, commits or chat.
- **Preserve existing work.** Do not replace the game with a prototype, and do
  not confuse the game with the DAW or other TGG projects.

## Build and check

```bash
cd tgg-game3d
npm test            # 148 tests: legacy suites + test/cargo-roundtrip.test.mjs
npm run build       # writes tgg-game3d/dist
ls -l dist/game.js  # bundle size — watch the delta, ~700 KB today
```

Report test totals as `N passed, 0 failed` and the bundle size change. A content
change that does not move the bundle size probably did not apply — `str_replace`
has silently failed before, so confirm the file changed before trusting a build.

## Deploy and ship

- Deploy with `sites_deploy`: manifest `tgg-game3d/deploy.json`, environment
  `preview`, and a **fresh UUID** `requestId` per attempt. The site id and current
  published deploy are recorded in `MILESTONES.md` — read it instead of guessing.
- Push with `cloud_git` to `feat/tgg-world-left-turn-walk-signals`.
- Update `MILESTONES.md` (board row + deploy id) and `BUILD_STATUS.md` (evidence),
  then commit and push. Two commits per milestone is normal: code, then board.
- Never run `npx convex login` or an interactive `convex dev` in this workspace.

## Verifying gameplay in this workspace

The sanctioned path is the Cloud browser panel, not a third-party automation CLI:

1. `preview_open` with `mode: "browser"` and a cache-busting URL
   (`?v=<tag>#debug`). Between turns the panel can silently fall back to iframe
   preview; when that happens `preview_evaluate` errors with "This is an iframe
   preview, not an automated browser" — reopen in browser mode.
2. Two passes over the menu: `CONTINUE` only loads once `window.__tgg` exists.
3. The dev build exposes `window.__tgg`: `car`, `walker`, `isOnFoot`,
   `toggleOnFoot`, `snapCamera`, `cargoNow`, `missionTarget`, `stops`, `state`,
   `interact`, `renderer`, `restart`, `diagnostics`.
4. **Evaluations are capped at 10 seconds** and the render loop competes with
   them. Keep each call to one synchronous action. No polling loops, no
   `await` chains over ~1 s, no walking simulations — they time out and silently
   leave the page untouched.
5. `preview_screenshot` times out on heavy frames. Call
   `renderer.setPixelRatio(0.5)` and `renderer.setSize(w, h, false)` first; that
   makes capture reliable. Pausing the run freezes the frame but draws the pause
   overlay over the view, so capture while running.
6. `car.reset(x, z, heading)` bypasses collision, so it can place you inside a
   building. Teleport onto open ground and look at the thing you want to see.

If a verification needs walking a route, add a synchronous debug hook to the game
first rather than fighting the 10 s cap. That is the cheap, repeatable answer.

## World facts that keep getting rediscovered

- `LANDMARKS.airport = { x: 234, z: -234, name: 'Salt Flats' }`. Mission keys,
  the map and `screens.js` are tied to this; extend the landmark, do not rename it.
- `canOccupy` lets the car drive the apron inside `±27`; `canWalk` lets the walker
  use `±26` minus the hangar shell.
- `AIRPORT_SOLIDS` in `main.js` blocks the cargo hall, control tower and parked
  freighter. Before it existed those were drive-through scenery.
- Cargo hall: centre `x 236, z -198`, half-extents `23 × 7.5`, bay-door gap
  `|x - 236| < 5` on the apron-facing wall.
- `cargo.js` is a pure state machine: `idle → loading → loaded → transit →
  delivered | failed`, with `leg: 'out' | 'back'`. `returnLeg()` opens the return
  trip; `claimRoundTrip()` pays once via a one-way `rewarded` flag.
- `career.js` holds cash/XP/contracts — currently in memory only, so it resets on
  reload. Wiring it into the save is open work.

## Content still to build

Airport workers and loading activity, repeatable cargo contracts, more interiors
and enterable businesses, NPC routines, street racing, entertainment careers.
Prefer one complete, playable slice over three half-built ones.
