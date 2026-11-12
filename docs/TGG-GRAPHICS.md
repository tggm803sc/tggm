# TGG Graphics Studio — browser renderer

The visual system for the browser build (`tgg-game3d/`). It upgrades the *actual*
renderer the game ships, and is deliberately kept separate from the Unreal project in
`game/unreal/` — nothing here is evidence about that codebase.

## What was flat, and why

The world already had asphalt texturing, window maps and a clock-driven sky palette.
The two missing pieces were the ones that make physically based materials read as
real:

1. **No environment map.** Every `MeshStandardMaterial` with `metalness` had nothing
   to reflect, so car paint, glass, metal and wet road rendered as flat plastic.
2. **No shadows.** Nothing touched the ground, so buildings and vehicles floated —
   the strongest single contributor to the "blocky game" read.

A third, subtler one: the paint and cloth materials were tuned as if they were
reflective, which made a person look like a glossy toy once reflections arrived.

## What the renderer does now

| Concern | Implementation |
| --- | --- |
| Reflections | `src/visuals.js → createEnvironment()` builds an equirectangular canvas from the clock's own sky (zenith → sky → fog → ground), adds a horizon city-glow band scaled by the night factor and a soft sun/moon blob, then pre-filters it with `PMREMGenerator`. Rebuilt only when the sky changes (`phase` + sun intensity + lights bucket). |
| Shadows | One `DirectionalLight` casts, `PCFSoftShadowMap`, 2048² map, ±80 m frustum re-centred on the player every frame (`trackShadowFocus`). |
| Casters | Cars, the van, the player, traffic, police — 70 meshes. **Buildings only receive.** |
| Receivers | Every opaque mesh (`enableShadowReceivers`), skipping transparent/additive/`toneMapped:false` surfaces (signs, glow cards, lamp pools, glass). |
| Car paint | `MeshPhysicalMaterial` with `clearcoat 0.9` on the coupe, `0.55` on the van, plus per-material `envMapIntensity`. |
| Glass | Physical, low roughness, clearcoat 1, `envMapIntensity ~1.7`, `opacity 0.6`. |
| Road | Asphalt map with `roughness 0.72`, `metalness 0.08`, `envMapIntensity 0.65` — enough sheen to catch street light, not a mirror. |
| Kerbs | Sidewalk slabs at `roughness 0.84` so the raised edge reads as a curb. |
| Character | Shoulders, hands and a cap added to the walker's capsule rig; cloth is matte (`roughness 0.78`, `envMapIntensity 0.35`), skin softer (`0.62`). |

## A regression this process caught

The first pass set *everything* to cast shadows. Because the sun is a single
directional light, every facade then shadowed itself: buildings went black in
daylight and the night scene collapsed to near-black. It was visible immediately in
the before/after screenshots and fixed by splitting cast from receive — buildings
receive, dynamic objects cast. That is why the casters are an explicit list rather
than a `scene.traverse` blanket.

## Measuring it

`window.__tgg.graphics()` reports the live numbers:

```json
{ "calls": 244, "triangles": 243148, "shadows": true, "casters": 70,
  "environment": true, "phase": "day", "exposure": 1.6, "pixelRatio": 1.75 }
```

`window.__tgg.setHour(22)` moves the clock without a reload, which is how day and
night were captured in one session.

Before/after captures at the same camera, same hour:

| | Before | After |
| --- | --- | --- |
| Day | `artifacts/before-day.png` | `artifacts/after-day.png` |
| Night | `artifacts/before-night.png` | `artifacts/after-night.png` |

What changed visibly: lit facades (they were black slabs in the day shot after the
first shadow pass and unlit before it), a contact shadow under the walker and the
coupe, sheen and curb shading on the asphalt, window colour variety at night, and a
matte character instead of a glossy one.

## What this does **not** fix

Honest limits of a materials-and-lighting pass:

- **Geometry is still primitives.** Buildings are scaled boxes, the player is a
  capsule stack, cars are box assemblies. No amount of PBR makes a box read as
  architecture. That needs authored meshes.
- **No normal maps or AO.** Surfaces have colour and roughness only, so close-up
  detail is absent.
- **Frame rate is not measured here.** This cloud browser simulates at ~7% of real
  time, so FPS numbers from it are meaningless. Shadows cost a second scene pass;
  `graphics().calls`/`triangles` are the honest comparable figures.
- **Not verified on real hardware or mobile.**

## The asset path that actually adds realism

These are the tools that produce geometry, and none of them run in this environment —
they are a workstation pipeline that feeds the game:

1. **Blender** — model buildings, vehicles, street furniture, characters; export glTF
   (`.glb`), which is the delivery format three.js recommends.
2. **Poly Haven** (CC0) — HDRIs would replace the procedural environment map with a
   photographed sky, and PBR texture sets give real normal/roughness/AO detail.
3. **glTF Report** — inspect and optimise before shipping; glTF assets get heavy fast.
4. **Substance 3D Painter** — only if hand-painted wear (car paint chips, concrete
   staining) becomes necessary.

The runtime already has the hooks for that work: `scene.environment` swaps cleanly for
an HDRI, materials carry `envMapIntensity`, and `prepareShadowCasters` accepts any
group, so a heavier model can be dropped in and lit correctly without touching the
lighting rig.

## Suggested next slice

One block, one vehicle, one character as authored assets, loaded as `.glb` behind the
same camera-angle screenshots used above — so the comparison stays measurable rather
than a matter of taste.
