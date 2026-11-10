# TGG WORLD — Design Bible V1 (Continuation)

**Status:** Design continuation. This document extends the existing screen and campaign canon; it is not a claim that any of it is implemented, playable, rendered or live.
**Predecessors:** [12-Screen UI Engineering Handoff](TGG-WORLD-12-SCREEN-UI-HANDOFF.md) (screen contract, story-state canon, telemetry honesty rules), [TGG Migration](../TGG-MIGRATION.md) (branch and release identity), [Save Policy](TGG-SAVE-POLICY.md).
**Data companion:** [`game/world/world-design-v1.json`](../game/world/world-design-v1.json) — districts, crews, characters, missions, ranks, economy targets, vehicles, music and cypher rules in machine-readable form.
**Campaign script:** [`docs/TGG-WORLD-SCRIPT-ACTS-I-III.md`](TGG-WORLD-SCRIPT-ACTS-I-III.md) — dialogue and radio copy keyed to every mission id (writing draft, unrecorded).
**Design gate:** `npm run check:tgg-world` validates the data companion against the rules in this document, and fails if any mission id loses its script scene.
**Android path:** [`docs/TGG-ANDROID-PLAYABLE-PATH.md`](TGG-ANDROID-PLAYABLE-PATH.md) — what must exist before any of this runs on a phone.

All economy figures, population counts, latency, royalty and player-count values below are **design targets or sample values**. None are approved game-economy configuration and none may be awarded by a UI click. The `DEMO` / `LIVE` rule from the screen handoff applies to every number in this document.

---

## 1. Where this design picks up

The 12-screen handoff defines *how the player sees the world*: a `TGG Tactical Telemetry` overlay on a Three.js/Unreal viewport, with a phone, mission center, garage, sequencer, vault, cypher, multiplayer, pause and recovery surfaces. It deliberately stops at the interface contract and pins one canonical story state:

- Campaign `The Sound of the Streets`
- Act I stages `hq` → `drive-to-studio` → `produce-master` → `deliver-to-vault` → `complete`
- Release states `draft` → `mastered` → `delivery-pending` → `released`
- Currencies `CR`, `REP`, `XP` already shown in the UI

This bible adds the layer the screens sit on: the city, the people, the arc after Stage 4, what progression means, what the player can spend, and how content is produced. It does not change any screen ID, screen purpose or the Act I stage order.

**One deliberate break:** the handoff's `MissionStage` union has five values because Act I is the whole campaign state it needed. Acts II and III introduce new mission ids and therefore require extending that union (or replacing it with a mission-id string plus an act discriminator). That is recorded as an open decision (`od-mission-stage-type`), not silently changed.

---

## 2. Premise and pillars

**Premise.** Cordell is a coastal city that runs on sound. Freight came for the harbor, money came for the towers, and the music stayed because the streets never stopped making it. The player is a nobody from Harbor Row with a borrowed coupe, a TGG crew that believes in them, and a city that only respects a name it has heard.

TGG World is not a crime fantasy. The tension is *ownership*: who owns a street's sound, who signs the paper, who gets paid. The player wins by making records, moving through the city that made them, and refusing to be a line item.

**Four pillars**

1. **Drive to feel the city.** Traversal is the primary verb. Districts are learned by road feel, shortcuts and acoustic identity, not by map icon checklist.
2. **Produce to be heard.** The music career is a real production loop (Studio 808 → master → The Vault), not a menu with a "release" button.
3. **Battle to earn a name.** Cypher is a skill expression system with readable rules, not a cutscene with a dice roll.
4. **Crew over solo.** Crews, collaboration and shared events are the endgame; single-player is the on-ramp, not the ceiling.

**Tone.** Neon-noir, dry humor, high-contrast. Nobody monologues. The city talks in radio fragments, overheard arguments and graffiti that changes after story beats.

**Non-goals for this design pass.** No gore, no sexual content, no real-money economy, no real artist likenesses, no real-city geography, no claims about online player counts.

---

## 3. Cordell — the city

Cordell is a fictional coastal city on the **Getta Coast**. Playable area is a **6 km × 6 km** square of street grid, water, hills and tunnel (`boundsMeters` in the data companion is authoritative). District positions in the data file are **normalized world meters**, not a rendered map; the radar contract clamps every input to those bounds and shows an unavailable state rather than inventing a location.

### 3.1 Districts

| District | Role | Story function | Acoustic identity |
|---|---|---|---|
| **Harbor Row** | Container port, warehouses, TGG HQ | Home. Tutorial, safehouse, crew floor. | Container slap, 0.35 reverb / 0.55 occlusion |
| **808 Avenue** | Commercial strip, pawn shops, sample alleys, Studio 808 | Where records get made and gear gets flipped. | Storefront slapback, 0.20 / 0.25 |
| **The Vault District** | Midtown towers, label offices, mastering suites, The Vault | Money and paperwork. Every compliment has a contract. | Glass lobby tail, 0.60 / 0.40 |
| **Cypher Street Plaza** | Market square and sunken amphitheater | Where reputation is settled in public. | Open-air amphitheater, 0.50 / 0.15 |
| **TGG Motors Yard** | Industrial east: garage, dyno, drift pad, test loop | Vehicle identity and build culture. | Corrugated hangar, 0.70 / 0.60 |
| **Northline** | Hills, rowhouses, community radio tower | The city's conscience and the crew's conscience. | Dry open hill, 0.15 / 0.10 |
| **Salt Flats** | Abandoned airfield and salt road | Speed, risk, and the only place with no echoes. | Dead air, 0.05 / 0.00 |
| **The Undertow** | Storm-drain and service-tunnel network under the grid | Shortcuts, contraband, and the city's bad memory. | Wet concrete tunnel, 0.85 / 0.75 |

Acoustic values are **design targets** for `UAudioMiddlewareComponent::SetAcousticState` (`ReverbSend`, `Occlusion`), not measured impulse responses. Each district must ship a hand-authored acoustic zone profile before its audio identity is called done.

### 3.2 Adjacency and travel

The district adjacency graph in the data file is symmetric and validated by the design gate. Surface travel is by vehicle; the Undertow is a surface-less network that links Harbor Row, 808 Avenue, Cypher Plaza and Motors Yard, and closes during Act III's blackout until restored.

Travel rules:

- No fast travel to an unvisited district, and none during an active chase or cypher.
- Quick travel is only offered from safehouses and the phone map, and always costs in-world time, never currency.
- The Undertow has no radar coverage; the HUD shows a degraded "no fix" state instead of a fake position.
- District entry gates are the only load boundaries; the mission tracker never teleports the player mid-objective.

### 3.3 Time, weather and density

One continuous 24-hour cycle, roughly 24 real minutes per in-game day (design target). Night is the default state for story missions because the telemetry palette assumes dark canvas. Rain is the signature weather: it drives the wet-surface look, changes tire grip in the handling model, and raises reverb on outdoor zones. Traffic and pedestrian density are **simulated locally**; no panel may present density as live player counts.

---

## 4. Crews and characters

### 4.1 Crews

| Crew | Stance | Home | Function |
|---|---|---|---|
| **TGG Collective** | Player's crew | Harbor Row | Label, garage, family. Not a gang; a crew with paperwork problems. |
| **Static Order** | Rival, later reluctant ally | 808 Avenue | Pirate relay sound-system crew. Controls who gets heard on the avenue. |
| **The Vault Syndicate** | Antagonist bloc | Vault District | Corporate label power. Legal, patient, and never the ones holding the wrench. |
| **Salt Kings** | Rival, later ally | Salt Flats | Street-racing crew. Respect is measured in seconds and repair bills. |
| **Northline Choir** | Ally | Northline | Community radio and choir. The city's memory; keeps the crew honest. |
| **Dead Air** | Neutral, transactional | The Undertow | Sample hunters and scavengers. Sell you the record your hero forgot they made. |

Crew stance is story state, not a reputation meter with numbers attached. Reputation (`REP`) belongs to the *player*, not to a faction standing bar. This keeps the UI from implying a simulation it does not run.

### 4.2 Principal characters

- **The Getta (player)** — unnamed by default, alias chosen at the title screen. Voice: sparse, funny under pressure.
- **Decks Marlow** — TGG HQ owner, ex-freight engineer, mentor. Gave the player the coupe keys and never explains why.
- **Nia Vale** — engineer and producer at Studio 808. Runs the five-track desk. The only person who tells the player the truth about a bad mix.
- **Sloane Vex** — Vault Syndicate A&R. Signs streets, not artists. Offers the player everything in Act II and means about 40% of it.
- **Rell Kasai ("KAS-9")** — Static Order's cypher champion. Rival, not villain; the final battle is a test, not a murder.
- **Mother Audra** — Northline Choir, runs the radio tower. Keeps the city's archive and the crew's conscience.
- **Tack Reyes** — Salt Kings captain. Races for pink slips and pride, in that order.
- **Ovis** — Dead Air fixer in the Undertow. Sells parts, samples and information, and remembers every favor.

Character refs, crew affiliations and home districts live in the data companion so the mission scripting, phone contacts and HUD nameplates read from one source.

---

## 5. Campaign

Three acts, seventeen missions, one campaign arc. Act I is fixed canon and must not be reordered. Act II and III are this design pass's continuation.

### Act I — *The Sound of the Streets* (canon, 5 stages)

| # | Stage id | Mission | District | Ends when |
|---|---|---|---|---|
| 1 | `hq` | Keys to the Coupe | Harbor Row | Player enters the sports coupe at TGG HQ |
| 2 | `drive-to-studio` | The 808 Run | 808 Avenue | Player parks at Studio 808 |
| 3 | `produce-master` | Five Tracks, One Master | 808 Avenue | Master beat is confirmed mastered in the sequencer session |
| 4 | `deliver-to-vault` | Hand It to the Vault | Vault District | Server delivery event succeeds; release becomes `released` |
| 5 | `complete` | The Sound of the Streets | Vault District | Act I complete; Act II opens |

The stage 4 lock is real: the Vault screen may not show a delivered release while the tracker says delivery is locked. Both read the same state source, as the handoff requires.

### Act II — *Frequency Wars* (6 missions)

| # | Mission | District | Kind | Gate |
|---|---|---|---|---|
| 1 | Open Mic at the Plaza | Cypher Street Plaza | Cypher | Act I `complete` |
| 2 | Static Interference | 808 Avenue | Explore | Win the open mic |
| 3 | Parts Run | The Undertow | Drive / Fetch | Meet Ovis, recover the relay parts |
| 4 | Tune Up | TGG Motors Yard | Drive | Deliver parts; unlock one vehicle build |
| 5 | Crew Call | Northline | Story | Recruit; crew creation becomes available |
| 6 | Cypher Street Final | Cypher Street Plaza | Cypher | Face KAS-9; Sloane Vex's contract decision posts here |

**Act II theme:** being heard is not the same as being owned. Static Order blocks the avenue, the Vault offers a contract that solves money and costs authorship, and the player's first real choice is which one they can live with. The Act II final is a cypher, not a boss fight — the fight was never physical.

### Act III — *The Getta Coast* (6 missions)

| # | Mission | District | Kind | Gate |
|---|---|---|---|---|
| 1 | Spectrum Auction | Vault District | Story | Act II final complete |
| 2 | Salt Flats Invitational | Salt Flats | Race | Tack Reyes issues the challenge |
| 3 | Blackout Protocol | Undertow → Harbor Row | Explore / Combat | Spectrum auction result; Undertow closes until restored |
| 4 | One City, One Mix | Northline | Story | All five crews contacted |
| 5 | The Getta Coast LP | 808 Avenue | Produce | Album session unlocked; five tracks minimum |
| 6 | Tru Go Getta | Cypher Plaza → Salt Flats → Vault District | Finale | Album mastered, race won, cypher won |

**Act III theme:** the city's spectrum is being sold. The finale is a three-part sequence — a cypher, a race, and a release — and the ending branches on whether the player signed with the Vault in Act II. Both endings keep the player in Cordell; the difference is who owns the master.

Ending state is an **open decision** (`od-ending-canon`) until one branch is approved as canon. Until then, the finale mission exists in data but its ending payload is marked unresolved.

### 5.1 Mission template

Every mission declares: `id`, `act`, `order`, `title`, `kind`, `districtId`, `requires`, 2–4 objectives, `unlocks`, `screenIds` and (optionally) `rewardTargets` with `displayOnly: true`. Kinds are `drive`, `deliver`, `produce`, `cypher`, `explore`, `race`, `combat`, `story`. Rewards exist only as sample display targets in V1; the authoritative award path is a server-validated, idempotent completion event.

### 5.2 Mission design rules

- Every objective must be completable with the verbs that exist: drive, walk, talk, produce, deliver, battle, race, interact. No objective may require a system that is not implemented.
- A mission may not award currency from a UI callback. Completion is a state transition, and the economy reacts to it.
- Failure states are recoverable: blown race, lost cypher, wrecked car and failed delivery return the player to a safe state with progress intact.
- Act II and III may reuse Act I districts; they may not reuse Act I mission ids.
- The mission tracker is the only place that declares "active"; the Vault, phone and pause menu read it.

---

## 6. Progression and economy

### 6.1 Rank ladder

`XP` moves rank; `REP` gates story access; `CR` buys things. They are separate on purpose, so a player cannot buy their way past a story gate or grind cyphers for a car without ever making a record.

| Rank | Title | XP threshold (design target) | Unlocks |
|---|---|---|---|
| 0 | Unknown | 0 | Harbor Row safehouse |
| 1 | Open Mic | 500 | Cypher Plaza open mic |
| 2 | Local Name | 2,000 | Garage tuning tier 1 |
| 3 | Buzz | 6,000 | Studio 808 session time |
| 4 | Regional | 14,000 | Salt Flats events |
| 5 | Headliner | 30,000 | Crew creation, tier 2 builds |
| 6 | Heavyweight | 60,000 | Vault contract negotiations |
| 7 | Getta | 120,000 | Endgame events, tier 3 builds |

Thresholds are `DESIGN_TARGET_NOT_APPROVED`. Act gates use REP, not XP, so the story and the grind cannot deadlock each other.

### 6.2 Currencies

| Currency | Type | Earned by | Spent on | Notes |
|---|---|---|---|---|
| **CR** (street credits) | Soft currency | Missions, deliveries, races, cypher stakes (REP only in V1) | Vehicles, parts, gear, studio time | Integer only; ledger writes follow `TggVaultLedger` transfer semantics |
| **REP** | Reputation | Cyphers, releases, crew events, story beats | Nothing — it gates | Cannot be purchased or transferred |
| **XP** | Progression | All activities | Nothing — it ranks | Server-awarded only |
| **Royalty** | Career income | Released tracks | Studio upgrades, features | Display-only in V1; non-withdrawable, not real money |

Hard rules:

1. **No UI-awarded currency.** A button click never grants CR, XP or REP. Only an authoritative completion event with a unique idempotency key can.
2. **No negative balances.** Transfers validate source balance inside a serializable transaction, as the existing vault helper already does.
3. **No real-money conversion, ever**, in this design.
4. **Stakes are REP-only** in V1. CR wagering is an open decision (`od-wager-policy`) because it creates a farming loop between two colluding accounts.
5. **Caps are server-side** and shown in the HUD as a soft warning before the cap, never as a silent discard.
6. **Offline progress is not simulated.** Closing the game does not earn royalties.

### 6.3 Sample Act I reward

The screen handoff records an audit showing `+350 XP`, `+80 REP`, `$50,000 CR` for Act I completion while another description differs. V1 keeps that exact sample, marked `displayOnly` and `SAMPLE_UI_AUDIT`, on the `complete` stage only. It is not a balance decision and does not get promoted without sign-off.

### 6.4 Heat

A 0–5 star attention meter per district, not a global wanted level. It rises from public combat, reckless driving in crowded streets and race collisions, and decays when the player breaks line of sight or changes district. At 3+ stars, cypher and studio entrances are closed; at 5, safehouse use is blocked until decay. Heat never takes currency. The tuning values live in the data companion and are design targets.

---

## 7. Vehicles and TGG Motors

Driving is the primary verb, so vehicles are characters, not inventory rows. Seven launch classes:

| Id | Name | Class | Role | Design notes |
|---|---|---|---|---|
| `vm-coupe-sport` | Coupe 808 | Sport | Starter | The borrowed coupe from Act I stage 1; balanced grip, weak top end |
| `vm-muscle-bandit` | Bandit 440 | Muscle | Straight-line | High torque, heavy, poor in the Undertow |
| `vm-lowrider-velvet` | Velvet Low | Lowrider | Style | Hydraulics, crowd appeal bonus at Cypher Plaza |
| `vm-suv-hauler` | Block Hauler | SUV | Crew | Seats a full crew, best for delivery cargo |
| `vm-bike-sting` | Sting 250 | Motorbike | Undertow | Narrow tunnel lines, exposed to combat |
| `vm-drift-hachi` | Slide 86 | Drift | Drift events | Highest drift score ceiling, twitchy in rain |
| `vm-hyper-sonata` | Sonata GT | Hyper | Endgame | Act III reward tier; not purchasable before rank 6 |

Rules: a vehicle is owned, never rented; tuning is per-vehicle and reversible; damage is cosmetic plus handling penalties that repair at the Yard; no vehicle is gated behind a real-money purchase. The HUD speed and gear read the real Chaos Vehicle state when bound, and show `DEMO` when not — never a fabricated speed.

---

## 8. Music career — Studio 808 to The Vault

### 8.1 Production

The sequencer is canonical: **16 steps × 5 tracks** (`drums`, `bass`, `keys`, `lead`, `fx`), Web Audio clock as the timing source, visual playhead as a display only. A session produces a *beat*, not a release.

A session is masterable only when: all five tracks have content, the loop length is valid, no track clips, and the player confirms the master action. Mastery creates an immutable mix snapshot with a content hash.

### 8.2 Release pipeline (canon enum, unchanged)

`draft` → `mastered` → `delivery-pending` → `released`

Delivery requires: mastered mix hash, cover asset id from the Projects asset library, metadata (title, BPM, key, explicit flag) and a server delivery event. `delivery-pending` is a real state with a retry path; it never resolves optimistically. A release cannot go backwards except through an explicit revision that creates a new release id.

### 8.3 Royalties and career

Royalties accrue from released tracks in **fictional** streams. Formula: `streams × rate × ownershipShare`, all design targets, all display-only in V1. Royalty balance buys studio upgrades and features, never vehicles or real money. Career milestones (first release, first chart entry, first sold-out show) are narrative beats, not currency faucets.

---

## 9. Cypher — the battle system

Cypher Street Plaza is a 1v1, three-round battle with a 45-second turn timer (design target). Each round is eight bars; the crowd meter is the visible score.

**Meters (0–100):** `delivery` (timing and clarity), `pocket` (staying on beat), `crowd` (response). Final round score weights: pocket 0.40, delivery 0.30, crowd 0.30 — the crowd cannot fully rescue a rapper who is off-beat, and the weights must sum to 1.0 (validated).

Rules:

- Repeating a bar already used in the match applies a repetition penalty.
- A clean rebuttal inside the first four bars of a turn earns a rebuttal bonus.
- Stakes are REP only in V1. Stakes are set before the match and cannot change mid-match.
- Rating uses the existing matchmaking component contract: base 1000, K-factor 32.
- Disconnect during a turn forfeits the round, not the match; the match pauses with a `CONNECTING` state and a bounded reconnect window.
- The AI opponent reads from the same rule set as the player; no hidden rubber-banding.

Cypher outcomes feed REP and story gates, never XP directly (XP comes from the mission/activity event, to avoid double dipping).

---

## 10. Street systems and existing components

The Unreal `MultiplayerFramework` module already provides combat, health, ammo, dash, inventory, equipment, traps, acoustic zones, matchmaking and save/load. Design maps onto those rather than inventing parallel systems:

| Existing component | World use | Constraint |
|---|---|---|
| `APlayerCharacter` | Player body, health, non-lethal damage | Combat is non-lethal; health restores at safehouse |
| `UWeaponCombatComponent` | Non-lethal street encounters and Hot Zone events | No gore; no civilian targeting |
| `UDashComponent` | Sprint/dodge, cypher stage movement | Same cooldown in and out of missions |
| `UInventoryComponent` | Samples, parts, gear, delivery cargo | Server-authoritative add/remove only |
| `UEquipmentComponent` | Equipped instrument, tool or carried item | Cosmetic change never alters stats |
| `ATrapPoolManager` / `ASpikeTrap` | Undertow hazard events | Pooled and telegraphed; never instant death |
| `UAudioMiddlewareComponent` | District acoustic identity, cypher crowd | Zone values are authored, not guessed |
| `UMatchmakingEloComponent` | Cypher and crew ratings | Base 1000, K 32, server-recorded |
| `ASaveLoadManager` / `UMultiplayerSaveGame` | Player snapshot | Needs schema v2 for REP, releases, vehicles (open decision) |

`SaveLoadManager` currently persists `PlayerId`, `Currency`, `Experience`, `InventoryItemIds`. REP, release state, vehicle ownership and mission progress are **not** in that struct. Claiming saves cover progression would be false until the schema is extended.

---

## 11. Multiplayer, crews and live-ops

- **Crews** (the app's `TggClan` model) are up to 12 players (design target). Crew rating starts at 1000 and moves on crew events.
- **Co-op activities:** crew cyphers, relay runs, delivery escorts, drift meets. All are instanced; the open city is solo-plus-crew-invite in V1.
- **PvP:** cypher duels and Salt Flats races. No open-world PvP in V1.
- **Presence, ping, relay diagnostics stay `SIMULATED`** until a live transport measures them, exactly as the screen handoff requires. The data companion marks these as `DEMO`.
- **Seasons:** 10-week seasons (design target) with one headline content drop, two cypher ladders, one vehicle build and one album arc. No promises about real calendar dates until a live-ops calendar is approved (`od-live-ops-calendar`).

---

## 12. Content pipeline and provenance

World content is generated through the existing TGG Higgsfield provider router and saved into TGG Projects; nothing is generated inside the runtime with unmanaged credentials.

Required asset passes:

1. **Character identity** — consistent character route, plus a turnaround sheet, before any 3D pass.
2. **Environment concept** — per district, 3 views minimum, locked palette per design tokens.
3. **3D** — character/prop 3D, then rig and animation; no runtime use until the asset is ingested with provenance.
4. **Audio** — separate authored pipeline; Higgsfield audio routes are not treated as final music.

Every ingested asset records: job id, provider route, prompt, seed, creating engine version, timestamp, and the Projects asset id. An asset without provenance cannot enter a shipping manifest. Generated art never replaces a real artist credit.

---

## 13. Screen mapping

The 12 screens are unchanged. This design gives each one world content:

| Screen | World content added |
|---|---|
| 01 Title | Continue slot reads mission state; campaign dossier shows the three acts |
| 02 Gameplay HUD | District nameplate, heat meter, radar over the 6 km bounds |
| 03 TGG Phone | Contacts from the character list, GPS to districts, radio per crew |
| 04 Mission Center | Act tabs I–III, mission detail from the data companion |
| 05 Garage | Seven vehicle classes, build tiers, test loop at the Yard |
| 06 Studio 808 | 16×5 sequencer, session→master pipeline |
| 07 The Vault | Release pipeline states, royalty (display-only), career milestones |
| 08 Cypher Plaza | Three-round format, meters, REP-only stakes |
| 09 Multiplayer | Crew roster up to 12, simulated relay diagnostics |
| 10 Pause | Save/load honesty, photo mode, district return |
| 11 Loading | Sync conflict and delivery retry paths |
| 12 Mobile HUD | District-aware controls, no phone obstruction of the viewport |

---

## 14. Designed vs implemented

Honest state of this pass:

| Layer | State |
|---|---|
| World/city/crew/mission design | **DESIGNED** (this document + data companion) |
| Machine-readable world data | **AUTHORED + VALIDATED** by `check:tgg-world` |
| Screen implementation | **PARTIAL** — `tgg-app/src/app/play` implements all 12 screens as DOM views for the Act I loop; no 3D viewport |
| Unreal widgets | **NOT IMPLEMENTED** — `WBP_HUD.layout.json` is a source spec, not a `.uasset`; the shipped screens are React |
| Campaign script (dialogue/radio) | **WRITTEN, UNRECORDED** — 17 mission scenes plus both endings, coverage-gated by `check:tgg-world` |
| Mission scripting | **NOT IMPLEMENTED** — the script is copy, not triggers |
| Android build | **NOT PACKAGED** — no `.uproject`, no content, no cooked build |
| Economy authority | **NOT APPROVED** — all values design targets |
| Save schema v2 | **NOT IMPLEMENTED** — current struct lacks REP/releases/vehicles |
| Multiplayer transport, presence, ping | **NOT LIVE** — simulated only |
| Asset generation at scale | **NOT RUN** — pipeline defined, no production claim |

---

## 15. Open decisions

| Id | Decision needed | Blocks |
|---|---|---|
| `od-economy` | Approve one economy configuration (rewards, prices, caps) | Any real currency grant |
| `od-mission-stage-type` | Extend or replace the 5-value `MissionStage` union | Act II/III UI state |
| `od-ending-canon` | Choose the canonical Act III ending branch | Finale payload and sequel hooks |
| `od-combat-rating` | Confirm non-lethal combat and age rating | Street encounter tuning |
| `od-royalty-semantics` | Confirm royalties stay fictional and non-withdrawable | Vault economy |
| `od-wager-policy` | Keep stakes REP-only or allow capped CR wagers | Cypher stakes, anti-farming |
| `od-save-schema-v2` | Approve REP/releases/vehicles persistence fields | Save/load of progression |
| `od-crew-cap` | Confirm crew size and activity caps | Multiplayer balancing |

---

## 16. Next design steps

1. Approve or reject the eight open decisions; the data companion changes with the decision ids.
2. Blockout the eight districts: road graph, landmarks, safehouse, mission beats per district.
3. ~~Write the dialogue and radio script for Acts I–III against the mission ids.~~ Writing draft delivered as the [companion script](TGG-WORLD-SCRIPT-ACTS-I-III.md); recording, localisation and triggers remain open.
4. Author vehicle handling specs per class and validate against the Chaos Vehicle setup.
5. Author acoustic zone profiles per district and verify in-engine.
6. Extend the save schema and economy service, then wire mission completion events idempotently.
7. Generate the district key art and character turnarounds through the Higgsfield → Projects pipeline with provenance.
8. Follow [TGG-ANDROID-PLAYABLE-PATH.md](TGG-ANDROID-PLAYABLE-PATH.md): ship the touch web slice first, then package a blank Android map to prove the toolchain before authoring content.

Until steps 1, 6 and 7 are done, this remains a design and a validated data set, not a game build.
