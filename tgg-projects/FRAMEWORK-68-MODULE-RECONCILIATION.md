# TGG 68-Module Framework Reconciliation

This document preserves the 68-module architecture target from the project conversation without pretending every historical filename currently exists in the canonical repository.

## Canonical accounting

- Target: **68 modules**
- Explicitly identified in the current architecture list: **61**
- Reconciliation slots: **7**
- Unresolved module numbers: **35, 63, 64, 65, 66, 67, 68**

## Important numbering rule

`WeaponCombatComponent.h/.cpp` is already represented as Modules 9-10. A later reference to Modules 69-70 is treated as a historical numbering alias, not two additional modules, until source evidence proves otherwise.

## Repo materialization status

A recursive `main` tree check plus exact-name repository search found no exact matches for the historical filenames listed in the 61 identified entries. That means the architecture is currently **conversation-defined**, while those exact source files are **not yet materialized on main under those names**.

This distinction is intentional:
- do not claim those files already exist;
- do not synthesize the seven missing module names;
- do not duplicate systems already implemented under different canonical TGG files without an explicit reconciliation pass.

## Group reconciliation notes

1. **Authoritative Game Server Engines (C++)**
   - Claimed: 35
   - Explicit: 34
   - Missing slot: Module 35

2. **Full-Stack Web App Subsystems**
   - Claimed: 18
   - Explicit entries in the current list: 10
   - Historical numbering overlaps the deployment range, so count/category reconciliation is required before renumbering.

3. **Data Schemas, Deployment & Automation**
   - Claimed: 8
   - Explicit: 8
   - This group is internally consistent.

4. **Interface Views & Visual Shaders**
   - Claimed: 7
   - Explicit physical entries: 9
   - Preserve all nine entries; reconcile whether some are intended to be paired into logical modules.

## Next implementation rule

When materializing the framework, use this manifest as the source of truth for numbering and status. New source files should only flip a module from `NOT_FOUND_BY_EXACT_NAME_ON_MAIN` to a real repo path after the file actually exists.
