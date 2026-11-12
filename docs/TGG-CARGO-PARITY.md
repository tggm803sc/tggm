# Cargo run — browser reference and Unreal reconciliation

The Salt Flats cargo round trip exists in one place today: the browser build in
`tgg-game3d/`. The Unreal project in `game/unreal/` is a multiplayer framework
(player, inventory, combat, save) and contains **no cargo mission, no Salt Flats
mission logic and no freight state**. This document records the browser contract
so the Unreal implementation can be built against it later, and states plainly
what does and does not exist on each side. No code in either project was changed
to produce it.

## 1. What exists where

| Concern | Browser (`tgg-game3d/`) | Unreal (`game/unreal/`) |
|---|---|---|
| Cargo state machine | `src/cargo.js`, pure, no renderer | absent |
| Mission wiring, prompts, dispatch | `src/main.js` (`handleBay`, `interact`, `updateStreetPrompt`) | absent |
| Bay geometry, sign, workers | `src/city.js` (`addAirport` / `addCargoTerminal`) | absent |
| Reward ledger | `src/career.js`, in memory only | `FPlayerPersistentSnapshot::Currency` / `Experience` fields exist, unused by cargo |
| Persistence | `src/progress.js`, key `tgg.world.act1.v2` | `UMultiplayerSaveGame`, `ASaveLoadManager`, slot `TGG_Server_Save` |
| Freight as cargo items | implicit (`cargo.crates` count) | `UInventoryComponent::ServerAddItem/ServerRemoveItem` |

## 2. The contract

Constants (`tgg-game3d/src/cargo.js`), which any port must match:

| Name | Value | Meaning |
|---|---|---|
| `CRATES` | 3 | crates per leg |
| `CARGO_SECONDS` | 90 | leg clock |
| `MAX_DAMAGE` | 2 | dents tolerated before failure |
| `ROUND_TRIP_REWARD` | `{ cash: 850, xp: 120 }` | paid once, on the return unload |

States: `idle → loading → loaded → transit → delivered | failed`, plus a `leg`
of `'out'` or `'back'`. The return leg reuses `idle/loading/loaded/transit`, which
is why the leg field exists.

Transitions:

```
loadCrate    idle|loading  → loading (crates < 3) | loaded (crates == 3)
depart       loaded        → transit (startedAt = now)
deliverCargo transit       → delivered, then leg out → back
returnLeg    delivered(out)→ idle(back), crates 0      [reload at the Vault]
loadReturn   idle|loading  → as loadCrate, leg back
depart       loaded(back)  → transit(back)
unloadReturn transit(back) → delivered(back) + claimRoundTrip
failCargo    transit       → failed (time out, or damage > MAX_DAMAGE)
reloadCargo  failed        → idle, attempts + 1
```

## 3. Invariants that have to survive a port

These are the rules the last three fixes established. They are not style
preferences; each one was a bug first.

1. **Payment happens once.** `claimRoundTrip` sets `rewarded` on the cargo
   record and returns `null` on every later call. The flag is persisted, so the
   guard survives a reload. The ledger in `career.js` only ever sees a reward
   that was handed out once.
2. **A delivered run is inert at the bay.** `bayAction(cargo)` returns
   `'reload' | 'load' | 'none'`; `delivered` is `'none'`, so a stray press cannot
   wipe a finished round trip or restart its clock.
3. **The prompt must match what the handler will do.** The bay prompt falls
   through to `bayAction` rather than offering `E · load a crate` on a state
   that refuses it.
4. **Dispatch order matters more than the state machine.** `interact()` checks
   the return unload before the outbound loader, because both live at the same
   bay; the outbound loader swallowed the press during the back leg while the
   prompt advertised the unload. Pure state tests cannot see this class of bug —
   only driving the mission can.

## 4. Mapping to the Unreal framework

When the cargo run is ported:

- **Authority.** Unreal's inventory is server-authoritative
  (`ServerAddItem` / `ServerRemoveItem`), so crates should be server state, with
  the browser record becoming a replicated struct (`FCargoRunState`) rather than
  a client-side object. The browser build is single-player and has no authority
  concept at all; this is the largest real divergence.
- **Reward.** `ROUND_TRIP_REWARD` maps to `Currency` / `Experience` on
  `FPlayerPersistentSnapshot`. The browser ledger is in memory and resets on
  reload; Unreal's snapshot is the mechanism that fixes that.
- **Persistence.** The browser saves the whole cargo record under one key with
  `VERSION = 2`, and `normalizeCargo` repairs anything unrecognised. The Unreal
  equivalent is a versioned `FCargoRunState` field on `UMultiplayerSaveGame`
  (`SchemaVersion` is 1 today — a port has to bump it and handle the old save).
- **Clock.** Browser timing is `elapsed` (session seconds) compared against
  `startedAt`; a server port needs a server clock, or a client can be cheated
  into never timing out.

## 5. Verification status

Browser, verified in the deployed build with real key presses and a reload:
three physical `E` presses load the van, a physical `E` delivers at the Vault,
three more load the return freight, a physical `E` unloads at Salt Flats for
`$850 + 120 XP`, and three further presses at the finished bay change nothing.
After a reload the run restores as `delivered/back/3/rewarded: true` and no
second payout appears. 9 round-trip tests plus 141 legacy tests pass.

Unreal: no cargo code exists, so there is nothing to reconcile behaviourally —
only this contract to implement against.

## 6. Known open points in the browser build

Recorded rather than fixed, per the current content-work priority:

- With the player on foot inside the hall, `interact()` always takes the hall
  pickup branch before any position-based check, so a press there does nothing
  while the cargo is in transit or delivered. Harmless in play (no prompt is
  offered), but it is the same dispatch-order family as invariant 4.
- After a completed round trip, `hydrate()` only rewrites the objective text for
  `transit` and `failed`, so a reloaded finished run still displays
  `Load the cargo van at Salt Flats` in the mission panel while the chip reads
  `RETURN FREIGHT DELIVERED`.
- The tower's dispatch hint is written by `updateStreetPrompt`, but the studio
  desk prompt is written later in the same frame and overwrites it, so standing at
  the dispatch desk shows `E · open the beat desk`. The interaction itself is
  correct (the press dispatches, the toast is accurate); only the hint text is
  wrong. Cosmetic, logged rather than fixed.
- The shell's boot guard reports a module that never sets `__tggReady`, and the
  bundle name is content-hashed so a deploy cannot be masked by a cached
  `game.js`. Both were verified live in the deployed preview, including a shell
  pointing at a bundle that was never deployed.
