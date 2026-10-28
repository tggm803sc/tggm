# TGG WORLD — 12-Screen UI Engineering Handoff

**Status:** Design specification / implementation contract  
**Design system:** TGG Tactical Telemetry (Design System 2)  
**Scope:** React/Three.js prototype and Unreal Engine 5 UMG mapping  
**Data integrity:** All numeric economy, networking, player-count, latency, audio-sync, crowd and royalty values in this document are illustrative demo data unless explicitly sourced from a live runtime.

## 1. Visual tokens

| Token | Value | Use |
|---|---|---|
| Obsidian | `#0C0E11` | Main canvas/background |
| Carbon | `#111317` | Panels and glass backplates |
| TGG Crimson | `#FF3048` | Primary action, warning, active selection |
| Electric Lime | `#C7FF00` | Health/progression/audio meter |
| Metallic Gold | `#FFD700` | Currency/royalty emphasis |
| Crimson hairline | `rgba(255,48,72,.30)` | Fine borders |
| Lime hairline | `rgba(199,255,0,.30)` | Fine borders |

Use a restrained glow, high-contrast text, consistent spacing and controller glyphs. Never obscure the central driving/exploration viewport with large card stacks. On mobile, prioritize touch targets and keep the driving view visible.

## 2. Screen registry

| ID | Screen | Primary purpose | Entry / exit |
|---|---|---|---|
| 01 | Cinematic Title Screen | Continue slot, campaign dossier, settings, credits, multiplayer | Continue → 02 |
| 02 | Live Gameplay HUD | World viewport, radar, player/vehicle telemetry, active mission | TAB → 03; ESC → 10; quick travel → 08/09 |
| 03 | In-World TGG Phone | Eight app tiles, GPS, radio and sampler | TAB/back → 02 |
| 04 | Mission Center | Storyline, contracts, waypoint selection | Garage → 05; studio → 06 |
| 05 | Garage & TGG Motors | Vehicle inspection, tuning and summon controls | Back → 02/04 |
| 06 | Studio 808 | Five-track, 16-step sequencer and master/deliver action | Deliver → 07 |
| 07 | The Vault / Music Career | Release status, royalty summary and career progression | Return/quick travel → 02/08 |
| 08 | Cypher Street Plaza | 1v1 battle, turn timer, flow meters, queue and stakes | Return → 02 |
| 09 | Multiplayer & Collab | Lobby, crew roster and simulated relay diagnostics | Return → 02 |
| 10 | Pause & Settings | Resume, save/load, photo mode, audio/graphics/controls/camera/gameplay | Resume → 02 |
| 11 | Loading & Connection States | Loading, sync-conflict and timeout/retry recovery | Retry or safe return |
| 12 | Mobile Gameplay HUD | Touch movement, radar, driving controls and phone drawer | Phone → 03; back → 02 |

Each screen must be a separately addressable component/view, not a flattened screenshot or collage. Preserve the screen IDs and names in route/state keys.

## 3. Canonical demo story state

Use one shared story-state object to prevent the mission tracker and Vault from contradicting one another.

- Campaign: `The Sound of the Streets`
- Stage 1: enter sports coupe at TGG HQ — complete
- Stage 2: drive to Studio 808 — complete
- Stage 3: produce master beat — active until delivery is confirmed
- Stage 4: deliver mixtape to The Vault — locked until Stage 3 completes; active after master delivery; complete only after the delivery event succeeds
- Economy and telemetry shown in the supplied design are **SAMPLE** values. Do not grant currency, XP or REP merely because a button was clicked in the UI.
- The supplied audit reports +350 XP, +80 REP and a $50,000 CR reward, while another description has differing REP values and the Vault already shows a delivered release while the mission tracker says delivery is locked. Do not silently combine these states. Treat rewards as display-only until one canonical game-economy configuration is approved.

Suggested typed state:

```ts
type MissionStage = "hq" | "drive-to-studio" | "produce-master" | "deliver-to-vault" | "complete";
type ReleaseState = "draft" | "mastered" | "delivery-pending" | "released";
type DataMode = "DEMO" | "LIVE";

interface TggWorldUiState {
  screenId: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
  missionStage: MissionStage;
  releaseState: ReleaseState;
  dataMode: DataMode;
  isPaused: boolean;
  phoneOpen: boolean;
}
```

## 4. React / Three.js integration contract

- Render the Three.js world as the base viewport; mount HUD and menus as DOM overlays above it.
- Noninteractive HUD decoration may use `pointer-events: none`; buttons, sliders, touch controls and modal content must restore `pointer-events: auto`.
- Suggested z-order: world canvas 0, gameplay HUD 10, phone/drawer 50, pause/error modal 100.
- Radar input contract: normalized player X/Z and yaw, plus world bounds. Clamp invalid or missing values and show an unavailable state rather than inventing a location.
- Speed/gear: bind to the real vehicle state when available; label fixed sample values as DEMO.
- Phone and pause visibility must be controlled by shared state; ESC/TAB shortcuts should not trigger while typing in an input.
- Sequencer: 16 steps × 5 tracks; audio scheduling uses the Web Audio clock. The visual playhead must not be used as the audio timing source.
- Mobile HUD: virtual stick and Gas/Brake/Handbrake/Nitro controls require touch-safe hit areas, safe-area padding and prevention of accidental page scrolling while active.
- Use a single navigation/state model for click, keyboard/controller and touch input.

## 5. Unreal Engine 5 / UMG mapping

Proposed widget hierarchy:
- `WBP_TGG_GameViewport`: world viewport root and layer ownership
- `WBP_TGG_GameplayHUD`: radar, player status, mission tracker and vehicle telemetry
- `WBP_TGG_Phone`: phone app drawer
- `WBP_TGG_Pause`: pause/settings modal
- `WBP_TGG_MissionCenter`, `WBP_TGG_Garage`, `WBP_TGG_Studio808`, `WBP_TGG_Vault`, `WBP_TGG_Cypher`, `WBP_TGG_Multiplayer`, `WBP_TGG_LoadingRecovery`, `WBP_TGG_MobileHUD`: individual feature views

Suggested z-order: world 0, gameplay HUD 10, phone 50, pause/recovery modal 100. Bind vehicle values to actual Chaos Vehicle state and mission progress to the game's authoritative quest/state owner. The existing `game/unreal/UI/WBP_HUD.layout.json` is a source layout specification, not a compiled `.uasset`; do not describe it as a finished Unreal widget asset.

## 6. Prototype safety and honest telemetry

Every network-dependent panel must expose a state such as `DEMO`, `CONNECTING`, `LIVE`, `OFFLINE` or `ERROR`. Sample values must never masquerade as live measurements. In particular:
- Lobby player counts and crew presence are simulated until backed by a live session service.
- Ping, jitter, audio relay and sync status are simulated until measured by a live transport.
- Royalties, reserve balances and collection rewards are nonfinancial demo values until the authoritative economy confirms a transaction.
- Save/load success is displayed only after the save subsystem returns success; conflict and timeout states need a non-destructive retry or return path.
- All actions that change persistent progress should be idempotent and validated by the authoritative game service.

## 7. Acceptance checklist

- [ ] All 12 screens are separate, editable components/views.
- [ ] Desktop and mobile HUD preserve the central world view.
- [ ] Title → Gameplay, Gameplay ↔ Phone, Gameplay ↔ Pause/Resume work.
- [ ] Mission → Garage/Studio and Studio → Vault work.
- [ ] Cypher and Multiplayer routes return safely to Gameplay.
- [ ] Loading, sync-conflict and timeout states have safe retry/return controls.
- [ ] Mission stage and Vault release state come from the same state source.
- [ ] Demo values are visibly marked and cannot award persistent currency.
- [ ] Keyboard/controller and touch navigation do not conflict with text input.
- [ ] Type-check/build and automated navigation/state tests pass.
- [ ] Browser playtest confirms the actual build; source-only checks are not live-play proof.
- [ ] No production promotion until the candidate SHA, runtime origin and live proof are recorded.

## 8. Evidence boundaries

This document captures the requested screen inventory and implementation contract. It does not assert that the Stitch canvas was independently inspected, that these React components already exist, that Unreal `.uasset` widgets have been generated, or that live gameplay/multiplayer/save persistence has been proven.
