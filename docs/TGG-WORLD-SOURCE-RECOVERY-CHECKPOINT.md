# TGG WORLD playable-source recovery checkpoint

Date: 2026-10-28

## Goal
Locate the authoritative React/Three.js playable TGG WORLD source so the 12-screen Stitch design can be implemented against real gameplay code without replacing the protected release or confusing the creator-platform prototype with the driving game.

## Confirmed repository findings
- Canonical project metadata on `tgg-world-mega-1000x` identifies `tggm803sc/tggm` as primary repository, `tgg-world-mega-1000x` as active development branch, production release `whole-world-consolidated-v135`, production overlay `1000x-v135`, and active development overlay `1000x-v200`.
- The branch tree includes `game/mega-1000x` runtime JS, project-state and runtime manifests, plus other Unreal-related game files.
- GitHub code searches in the accessible default branch did not find the expected `threeEngine.ts`, `gameState.ts`, `App.tsx`, or `verify-gameplay.ts` files. A commit search for the reported local foundation commit `95a28aeefe03fc13efedb3f17f53330dadbe3330` returned no matching commit in the primary repo.
- The separate `tggm803sc/tggm-universe-private` feature branch README identifies it as a four-screen vanilla HTML/JS creator-platform prototype, not the driving game source. It explicitly says metrics are sample and production integrations are not connected.
- The prior 12-screen UI handoff remains in the separate draft PR #18; it has not been merged.

## Safety / release boundary
- Do not overwrite or reset the AI Studio project.
- Do not merge the UI handoff into `main` or modify the protected v135 release while source identity is unresolved.
- Do not label simulated networking, royalties, multiplayer, or gameplay as live proof.
- No secrets or credentials belong in source exports or this repository.

## Next recovery actions
1. In AI Studio, inspect Settings > Versions and the Code tab. If source is visible, use Settings > GitHub to link/sync to a dedicated recovery branch or use Code > Export to ZIP. If export or push fails, preserve the existing project and record the exact error; do not reset/remix it.
2. Search all accessible TGG source repositories/branches for the exact expected file paths and the reported local commit SHA, including any project-source import/backup bundle catalog.
3. Once the real source tree is found, compare commit/tree hashes before copying files; add the 12-screen UI in a feature branch, run the project's tests/build, then require exact-SHA preview/live proof before any promotion.

## Current status
SOURCE RECOVERY BLOCKED: the exact playable React/Three.js source has not been located in the inspected primary repository branches. Existing TGG world runtime files and design documentation are present, but they are not a verified substitute for that source tree.
