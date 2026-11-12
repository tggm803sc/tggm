# TGG Graphics Studio

The visual production system for the **browser** game (`tgg-game3d/`). This is not the
Unreal project: nothing here is evidence about `game/unreal/`, and the two do not share
assets, pipeline or rendering.

Status: milestone 1 implemented and deployed. One block, one vehicle and the player
character are rebuilt, with a quality system, an asset manifest, GLB validation, a
performance budget and fixed comparison views around them.

## 1. What existed before this work

Audited before writing anything, so the studio builds on the renderer instead of
replacing it.

| Area | Before |
| --- | --- |
| Renderer | `WebGLRenderer`, ACES tone mapping, `compact` device branch, one quality knob (a pixel-ratio cap: low / balanced / high). |
| Scene | `createCity()` builds a 9×9 grid of blocks: one instanced box mesh for every building, one instanced box for rooftop neon rims, four landmark towers with edge lines, the Salt Flats apron/hangar/control tower, and a Studio 808 frontage. |
| Lighting | Hemisphere + one directional "moon" driven by `worldclock.js` (sky, fog, sun/moon, exposure, "lights on" factor), plus point lights for lamps and interiors. |
| Environment | `visuals.js` generates an equirect canvas from the clock palette and pre-filters it with `PMREMGenerator`; this is the only environment map. |
| Shadows | `PCFSoftShadowMap`, 2048², ±80 m frustum re-centred on the player every frame; casters are the dynamic objects only (cars, player, traffic, police); every opaque mesh receives. |
| Materials | Standard/physical materials; procedural window texture used as colour + emissive on the box buildings; clearcoat car paint; matte cloth on the player. |
| Textures | All procedural (`CanvasTexture`): ground map with lane markings and block outlines, window grid, glow sprite, sign text. No image assets ship. |
| GLB support | **None.** No loader, no validator, no asset manifest, no `.glb` files. |
| Diagnostics | `__tgg.graphics()` (calls, triangles, shadow toggle, casters, environment, phase, exposure, pixel ratio) and `__tgg.setHour()`. |
| Screenshots | Manual Playwright captures of a fixed camera, no baseline storage or diff. |

Missing, and now built: an asset pipeline and manifest, GLB validation/import, material
and texture management, quality profiles that control more than resolution, performance
budgets, comparison views and pixel diffing.

## 2. Studio architecture

```
src/graphics/
  quality.js    profiles (low/medium/high/ultra), device detection, budgets
  assets.js     manifest + AssetLibrary (register, list, validate, export for tools)
  glb.js        GLB parse / measure / validate / load (Node-safe, no WebGL)
  materials.js  procedural PBR textures: colour, normal, roughness, AO + factory
  perf.js       frame-time sampling, renderer counters, percentile summaries
  presets.js    lighting presets and the six fixed comparison views
  compare.js    pixel diff, canvas capture, baseline store
  studio.js     the facade the game and tools talk to
src/district.js Harbour Row: the block rebuilt as architecture
```

`createGraphicsStudio(context)` takes handles it does not own — renderer, scene, camera,
`applyQuality`, the world clock, photo mode — and exposes:

- `quality()`, `qualityNames`, `setQuality(name)`, `detect()`, `qualityReport()`
- `manifest()`, `validateAssets()`, `assets`
- `sample()`, `report()`, `tick(now)`, `markLoad(ms)`
- `views()`, `photo(id)`, `exitPhoto()`, `capture()`, `saveBaseline()`, `compareToBaseline()`

Nothing in the studio renders independently: it reports on and configures the systems
`main.js` already runs, so there is no second world to fall out of sync.

### Asset manifest

`DEFAULT_MANIFEST` describes each asset with `id`, `kind`, `title`, `source`
(`procedural` | `glb`), `module` or `url`, `status` (`in-game` | `declared`), `budget`
and `tags`. Two GLB slots are deliberately `declared` and empty: the manifest's job is to
say what exists, and a reserved slot must not read as a finished asset.

```js
window.__tgg.graphicsStudio.manifest()
// { counts: { total, inGame, declared }, assets: [...] }
```

### GLB path

`validateGLB(buffer)` parses the container itself (magic, version, declared length, chunk
table, JSON), measures triangles/materials/images from accessors, and refuses what the
runtime cannot honour: wrong container version, truncated chunks, missing buffers, and
compressed geometry (`KHR_draco_mesh_compression`, `EXT_meshopt_compression`,
`KHR_texture_basisu`) because no decoder ships. It returns errors *and* warnings instead
of throwing, so one report can show every problem in a file. `loadGLB(url)` validates
before it instantiates anything.

No Blender-authored asset exists yet. That is a workstation step, not something this
environment can perform, and the manifest says so.

### Quality profiles

| Profile | Pixel ratio | Shadows | Shadow map | Env map | Anisotropy | Detail | Draw calls | Triangles |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| low | 1 | off | – | 128 | 2 | core | 260 | 260k |
| medium | 1.35 | on | 1024² | 256 | 4 | standard | 320 | 340k |
| high | 1.75 | on | 2048² | 512 | 8 | full | 400 | 460k |
| ultra | 2 | on | 4096² | 1024 | 16 | full | 500 | 620k |

The menu's existing `low / balanced / high` names are aliased rather than renamed, so
saves keep working; `balanced` persists back as `balanced`. `detectDevice()` picks a
starting profile from screen width, DPR, cores and memory, erring low.

## 3. Harbour Row (block at 0, 78)

The box city is skipped for this block (`createCity({ skipBlocks })`); its sidewalk slab
still comes from `city.js`. **Collision was not touched**: the whole 60 m block was
already solid to cars and impassable on foot, so replacing its visuals cannot change
where anything drives or walks, and mission points are unaffected.

Built as architecture:

- **Podium** as a wall assembly — plinth, header, inset core — leaving a 2 m deep reveal
  all round. Storefronts sit inside it: glazing 0.55 m back, pilasters filling the
  reveal, a door, a striped awning and a lit sign band. Both street-facing faces get
  bays (south and east), plus the north face.
- **Three towers** with setbacks and a crown, each face carrying a generated facade grid:
  ~1,000 window panes, spandrels and piers as separate instances (six draw calls for the
  whole block's facade), so light rakes across real depth instead of a texture.
- **Street furniture**: trees in pits, benches, bins, bollards, a detailed lamp head
  (arm, housing, lens) over the existing poles, a paved sidewalk with tile normal,
  roughness and AO maps, zebra crossings, manholes, asphalt repair patches and drain
  grates.
- **Night**: the block scales its own window, sign and lamp glow from the world clock.

Measured on the deployed build at `high` (single frame, `graphics()`):

```
calls 128 · triangles 271008 · textures 27 · casters 88 · env true · pixelRatio 1.75
load 1169 ms · budget high: ok (no metric over)
```

The studio's own frame timing in the cloud browser reads ~6.5 fps, which is **not** a
performance measurement: that browser runs the simulation at roughly 7% of real time
(see `docs/TGG-BROWSER-VERIFY.md`). Draw calls and triangles are the comparable numbers.

## 4. Vehicle

The coupe is now a body **extruded from a side profile** — scalloped over both axles for
open wheel arches — with a separate raked greenhouse, roof panel, mirrors, skirts,
splitter, grille slats, exhausts, spoiler, interior (seats, dash, wheel) and wheels with
merged spokes. Geometry is merged by material (one mesh per material, all non-indexed
because `mergeGeometries` refuses to mix indexed and non-indexed input).

Still a procedural model, not an authored one: panel gaps, badges, lights with real
reflectors and a modelled grille mesh are Blender work.

## 5. Character

Chest, waist and hips; arms with shoulders, elbows and hands; legs with knees, shoes and
soles; collar, zip, neck, jaw, nose, ears, eyes, brows, hairline and a cap. The walk
cycle bends knees on the back swing and elbows on the forward swing, which is what stops
it reading as scissors.

## 6. Verification

Automated: `npm test` (183 legacy assertions + 18 studio tests) exits 0. The studio tests
cover profile resolution and aliasing, device detection, budgets, GLB parsing (valid,
bad magic, bad version, bad length, no JSON chunk, Draco, over-budget, empty), manifest
integrity and status honesty, percentile maths, pixel diff, and view resolution.

Visual: fixed views at `artifacts/studio-*.png` (day, vehicle, character, plus whatever
the run captured). Everything was checked by inspecting the actual rendered frames, not
by test output.

Regressions this process caught and fixed, all of which would have shipped silently:

1. **Buildings went black.** Casting shadows from every mesh made each facade shadow
   itself under a single directional sun. Buildings now only receive.
2. **The coupe rendered half a car width to one side.** `ExtrudeGeometry` starts at z=0,
   so the body and cabin were offset until they were re-centred before rotation.
3. **The body mesh was `null`.** `mergeGeometries` returns null when indexed and
   non-indexed geometry are mixed, and the renderer then crashed reading
   `geometry.morphAttributes`.
4. **Concrete rendered as soot.** The Sobel normal map was eight times too strong, so
   fine grain produced near-horizontal normals. Dividing by 8 turned stone back into
   stone.
5. **Window glass was chrome.** At 0.45 metalness the environment map turned every pane
   into a saturated flat rectangle of sky or sun.
6. **Night lights registered before the world existed.** The first `applyWorldLight()`
   ran before the city and cars were built, so their emissive materials and lamp lights
   were never collected and never dimmed by day. `refreshNightLights()` re-collects once
   the world is complete.

## 7. Known gaps, stated plainly

- **Geometry is still procedural.** Facades are boxes with instanced trim; there are no
  authored meshes, UVs, normal maps or interior detail on buildings. Blender + Poly
  Haven HDRI/PBR work is what moves this further, and none of it can run here.
- **The character is still a primitive assembly.** Jointed and proportioned, but a
  modelled human it is not.
- **Sunset/night/street captures** were attempted under a throttled cloud browser that
  repeatedly timed out; only the frames listed above are evidence. Do not read the
  absence of an image as a pass.
- **No device testing.** Nothing here was checked on a phone or on real GPU hardware.
- **The old city is unchanged.** One block is upgraded; the remaining 80 are the same
  instanced boxes, which makes the difference obvious in-frame.
