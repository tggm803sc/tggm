# TGG WORLD playable-source recovery checkpoint

Date: 2026-10-28

## Goal
Preserve the authoritative React/Three.js playable TGG WORLD source and then implement the 12-screen Stitch design against that source without replacing the protected release or confusing the creator-platform prototype with the driving game.

## Newly confirmed from the live AI Studio browser tab
- The existing AI Studio project `TGG World - The Game Generation` is open and its Code file explorer exposes the playable source tree.
- Visible source includes `src/App.tsx`, `src/game/threeEngine.ts`, `src/game/gameState.ts`, `src/components/HUD.tsx`, `src/components/TGGPhone.tsx`, title/garage/mission/vault/cypher/multiplayer/studio components, `scripts/verify-gameplay.ts`, `package.json`, `vite.config.ts`, and `tsconfig.json`.
- The same file explorer visibly includes `backup/tgg-world-playable-foundation.bundle`, `backup/tgg-world-playable-foundation-source.tar.gz`, and `MANIFEST.sha256`. Their presence is confirmed in the UI; their bytes and checksums have not yet been independently read or verified from the connected tools.
- The AI Studio session reports a quota-limit error in its chat panel. Do not depend on another AI Studio generation run to preserve source.
- The visible AI Studio history reports local commit `95a28aeefe03fc13efedb3f17f53330dadbe3330` and later checkpoint commit `cf8fb077ba488924c036d69a0622c89e59430942`, but a connected GitHub commit search did not find the earlier reported commit in `tggm803sc/tggm`. These are UI-reported source facts, not verified remote GitHub commits.

## Confirmed repository findings
- Canonical project metadata on `tgg-world-mega-1000x` identifies `tggm803sc/tggm` as primary repository, `tgg-world-mega-1000x` as active development branch, production release `whole-world-consolidated-v135`, production overlay `1000x-v135`, and active development overlay `1000x-v200`.
- The branch tree includes `game/mega-1000x` runtime JS, project-state and runtime manifests, plus other Unreal-related game files.
- Searches of the connected GitHub repo did not find the expected React/Three.js source paths. The separate `tggm803sc/tggm-universe-private` feature branch README identifies it as a four-screen vanilla HTML/JS creator-platform prototype, not the driving game source.
- The prior 12-screen UI handoff remains in draft PR #18; it has not been merged.

## Safety / release boundary
- Do not overwrite, reset, or remix the AI Studio project.
- Do not merge the UI handoff into `main` or modify the protected v135 release while source identity is unresolved.
- Do not label simulated networking, royalties, multiplayer, or gameplay as live proof.
- Do not request, expose, or commit credentials. No secrets belong in source backups or the repository.

## Next recovery actions
1. Use the existing AI Studio Code pane's Export/Download or Settings > GitHub sync only if it can safely preserve the existing tree; if the quota error prevents export, leave the project intact.
2. Use an authorized TGG source-control/host workflow to import the visible bundle or tarball from the existing project only after confirming the file bytes and SHA-256. Do not claim archive integrity based on the UI manifest alone.
3. Search accessible TGG source repositories/branches for the exact file paths and reported commit SHAs; compare tree hashes before copying files.
4. Once the source tree is recovered, add the 12-screen UI in a feature branch, run the project's tests/build, and require exact-SHA preview/live proof before any promotion.

## Current status
SOURCE FOUND IN AI STUDIO; REMOTE RECOVERY PENDING. The existing playable source tree and backup archive filenames are visible in the AI Studio project. A verified import into the connected TGG GitHub repository has not yet been completed. Preserve the project while resolving the export/sync path.
