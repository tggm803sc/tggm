# TGG Canonical Save Policy

## Canonical repository
All new TGG work must be persisted to:

`tggm803sc/tggm`

This applies to:
- TGG World game development
- TGG Runtime
- TGG Cloud
- TGG CI
- TGG Source
- TGG Projects
- TGG Creator OS
- TGG Game Studio
- TGG VFX
- TGG Avatar Maker
- TGG Recording Studio
- TGG Higgsfield
- release manifests, proofs, checkpoints and migration records

## Branch rules
- `main` — TGG platform / runtime / source-control / project-control plane
- `tgg-world-mega-1000x` — active game/world development
- `tgg-world-release-v135-final` — frozen V135 preservation/import branch

## Release safety
The V135 approved commit remains:
`ea27aca634f3c2b92fc430a232f5f8d0be4fba23`

Do not treat the current contents of the preservation branch as a byte-for-byte V135 source import unless the frozen legacy tree has actually been imported and verified.

## Save rule
Before a task is considered saved, its source or state record must exist in `tggm803sc/tggm`.

When a legacy source file cannot be read from the connected source repository, preserve:
1. its known branch/path
2. exact known release SHA
3. build/version state
4. migration/import status
5. any reconstructed or newly authored replacement under the canonical TGG repo

Never claim inaccessible legacy source was copied when it was not.
