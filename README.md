# TGG — TRU GO GETTA PROJECT

Primary repository: `tggm803sc/tggm`

This is the TGG-owned project home and control plane.

## Canonical ownership
- **TGG Source** — primary code host and repository app
- **TGG Projects** — permanent project registry, checkpoints, assets, events, repository-bundle backups, sealed Save Everything manifests, and verification
- **TGG Higgsfield** — TGG-owned creative generation jobs saved back into TGG Projects
- **GitHub** — legacy/bootstrap import source only; normal work is intended to move through TGG Source + TGG Projects

## Core project
- TRU GO GETTA WORLD
- TGG Runtime
- TGG Cloud
- TGG CI
- TGG Source / Repository App
- TGG Projects
- TGG Creator OS
- TGG Game Studio
- TGG VFX
- TGG Avatar Maker
- TGG Recording Studio
- TGG Higgsfield
- TGG App

## One-time takeover / migration
With TGG Source + TGG Projects running:

```bash
npm run tgg:takeover
```

That imports/backups the canonical TGG platform and game repositories into TGG Source, then seals a TGG Projects Save Everything checkpoint.

## Save everything
```bash
npm run tgg:projects:save-everything
```

The save command:
1. exports all TGG Source repositories as full Git bundles,
2. records assets/events/Higgsfield job state,
3. creates a TGG Projects snapshot,
4. creates a sealed `tgg.projects.save-manifest.v1`,
5. verifies the manifest SHA-256 and every repository bundle SHA-256.

## Branch model
- `main` — TGG platform/runtime/source-control control plane
- `tgg-world-mega-1000x` — active world/game development
- frozen release branches — immutable release checkpoints

## Current game development state
- Registry build: **1000x-v200**
- Cleaner: **187**
- Graphics manifest: **57**
- Runtime manifest: `game/mega-1000x/runtime/runtime-manifest-v200.json`

## Production checkpoint
The previously approved V135 release remains the frozen production checkpoint until a newer TGG release is separately frozen and approved.

TGG Source + TGG Projects are the primary project workflow going forward.
