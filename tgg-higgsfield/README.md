# TGG Higgsfield

TGG Higgsfield is the TGG-owned creative-generation orchestration layer for the Creator OS, Game Studio, and TGG World asset pipeline.

Supported TGG job modes:

- image — avatars, environments, concept art, covers, marketing stills
- video — cinematics, trailers, music-video shots, social promos
- sprite — game-ready character sprite-sheet generation
- audio — NPC voice, sound effects, music cues
- 3d — image-to-GLB props and character assets

## Provider catalog

`provider-catalog.json` records the Higgsfield models verified through the connected Higgsfield catalog on 2026-09-26. TGG presets may reference only model IDs in that verified catalog.

Runtime endpoint:

`GET /v1/provider/catalog`

The catalog currently includes TGG routes for Soul 2.0, Soul Cinema, Cinema Studio, Soul Location, AutoSprite, Seed Audio, Sonilo Music, Mirelo SFX, Inworld TTS, SAM 3 3D, and Image to 3D.

## Runtime boundary

The repository service remains TGG-owned:

`tgg-higgsfield -> tgg-creative-engine -> TGG Projects`

The authenticated ChatGPT Higgsfield connector is available to this project session, but that does **not** mean the deployed TGG runtime automatically possesses Higgsfield provider credentials. A deployed provider bridge must be configured explicitly before runtime jobs can call Higgsfield directly.

Completed jobs save:

- project checkpoint
- lifecycle event
- generated output references
- TGG preset
- provider model ID
- provider catalog verification metadata
- source repository / branch / SHA
- project context

Default port: `10040`
Default state: `/data/tgg-higgsfield`

## Provider routing modes

TGG Higgsfield has two explicit runtime modes:

- `local-engine` — default. Jobs render through the TGG-owned creative engine.
- `bridge` — optional. Jobs render through a separately secured TGG provider bridge that exposes the same `/health`, `/v1/render`, and `/v1/jobs/:id` contract.

Bridge mode requires both:

- `TGG_HIGGSFIELD_PROVIDER_BRIDGE_URL`
- `TGG_HIGGSFIELD_PROVIDER_BRIDGE_TOKEN`

The service fails closed when bridge mode is selected without both values.

The authenticated ChatGPT Higgsfield connector is **not** exported into the runtime and its credentials are never written to this repository.


## TGG World game-asset profile

`game-asset-profile.json` is the canonical routing profile for TGG World creative assets.

Runtime endpoint:

`GET /v1/provider/game-assets`

The profile is verified against the connected Higgsfield catalog and currently routes realistic character images, environment concepts, cinematic motion, multimodal video, GLB generation, remeshing, rigging, and animation.

Generated assets remain project assets until Unreal import/build validation passes. The connected ChatGPT Higgsfield credentials are not exported to the deployed runtime.
