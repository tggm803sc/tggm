# TGG CI

TGG CI is the project-owned validation layer for the canonical repository.

The current activation policy is stored in `activation-policy.json`.

The root command `npm run check` runs the TGG canonical save gate plus source, project, Higgsfield, and activation syntax/compile checks. The canonical gate cross-checks the V21 activation checkpoint against TGG project metadata and the runbook contract.

No GitHub-hosted deployment or promotion is required by this policy. Production promotion remains a TGG-controlled live action and is not performed by the repository gate.
