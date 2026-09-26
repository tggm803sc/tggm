# TGG Activation

Canonical repository: `tggm803sc/tggm`

This directory is the source of truth for TGG production-activation work created after the GitHub account migration.

## Current checkpoint
- Activation line: **V21 FINAL**
- Bundle SHA-256: `0f5ab2f19f5b311c360a1b683262964d07a17cfceb1d0b4bf23291e86152a921`
- Candidate SHA: `b36596a996558d53daa5ded3e62f2599417cb0e1b87761e8895a908ed915ebd3`
- Offline validation: **PASS**
- Production execution: **NOT RUN**
- R232 promotion: **NOT EXECUTED**

V21 consolidates the hardened pre-R232 chain into one deterministic production runbook. It preserves a hard stop before R232 and does not claim live production evidence.

## Migration rule
The legacy repository history is not available through the currently connected GitHub account. Do not synthesize or rewrite that history. Preserve the established project state in this repository and commit all new TGG work here.

## Branch rule
- `main`: TGG platform/runtime/source-control/control plane
- `tgg-world-mega-1000x`: active game/world development
- frozen release branches: immutable release checkpoints
