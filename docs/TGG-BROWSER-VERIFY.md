# Verifying TGG World in a browser

The browser build is only evidence while its frame loop is running. A backgrounded
tab has `requestAnimationFrame` suspended by the browser, so `elapsed` stops
advancing, nothing renders, and the HUD keeps whatever text it painted on its last
frame. Moving the player with debug calls underneath a frozen HUD produces
convincing but false readings — a "stale prompt" that was really a frozen tab.

## Check liveness before trusting any HUD text

```js
JSON.stringify({
  elapsed: window.__tgg.elapsed(),               // must be > 0 and rising
  frames: window.__tgg.renderer.info.render.frame, // must be > 0 and rising
  raf: await new Promise((r) => requestAnimationFrame(() => r('live'))), // never rejects
})
```

`requestAnimationFrame` that does not fire within ~1s, `elapsed` frozen at 0, or
`renderer.info.render.frame` stuck at 0 all mean the same thing: the tab is not
being painted. Bring it to the foreground (open the tab) and re-read. No game
change is required, and no bug should be filed from that state.

## Reading state rather than pixels

`window.__tgg` (present with `#debug`) exposes the live objects, so a check can read
the model instead of guessing from text:

| Probe | Returns |
| --- | --- |
| `__tgg.elapsed()` | seconds of simulated time |
| `__tgg.cargoNow()` | the live cargo record (state, leg, crates, tier, rewarded) |
| `__tgg.onFootNow()` | whether the player is on foot |
| `__tgg.inTowerNow()` | whether the focus is inside the tower footprint |
| `__tgg.promptNow()` | `{ text, mode, hidden }` for the on-screen hint |
| `__tgg.walkerTo(x, z, heading)` | teleport the walker, returns its state |
| `__tgg.drivingNow()` | the vehicle currently being driven |

Mutations through these references (`Object.assign(__tgg.cargoNow(), {…})`) change the
running game, which is how a finished contract or a mid-run state can be staged
without driving the whole route.

## Order of operations for a press-driven check

1. Confirm liveness (`elapsed` rising, `frames` rising).
2. Read `promptNow()` **after** a frame has passed since any teleport — a read in the
   same tick as `walkerTo` still shows the previous frame's hint.
3. Press the key, then read the record (`cargoNow()`, career in `localStorage`) in a
   later tick.
4. For anything banked, reload and read again: a payout that is not in the save was
   never banked.

## This cloud browser runs the sim at ~7% speed

Even the visible tab is throttled here. Measured directly: `elapsed` advanced
0.25 → 0.35 while 1.5 s of wall clock passed, with `renderer.info.render.frame`
going 6 → 8. Because `dt` is clamped to 0.05 s per frame, the simulation advances
about 0.075 s per real second.

Consequences for a keyboard-driven test:

- Holding `W` for 1.5 s of wall clock is 0.1 s of driving — the coupe reaches
  0.6 m/s and moves 0 cm. That looks exactly like "the car is stuck" and is not.
- Driving one 500 m leg at the van's 22 m/s needs ~23 s of simulated time, which is
  ~5 minutes of wall clock per direction, past the per-call limit.

So a full no-teleport mission run cannot be driven from this environment. Anything
that requires sustained real-time simulation (driving, traffic, pursuit timers)
needs a normal-speed browser. HUD text, prompts, toasts and state transitions can
still be verified here, because they respond to input on the next frame.

## What a frozen tab cannot tell you

A suspended tab proves nothing about prompts, toasts, HUD text, animations or
camera state. It can still be used to mutate state, but not to observe it.
