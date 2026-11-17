# TGG SESSION BLOCKERS — 2026-11-17

Each blocker states what is blocked, why, and what would unblock it.

## B1 — No GitHub credentials in the sandbox (workflow blocker, high impact)

- **Evidence**: `gh auth status` → "You are not logged into any GitHub hosts". No
  git remote, no credential helper, no token in the environment. A clone of the
  private repo fails with `could not read Username for 'https://github.com'`.
- **Effect**: all writes had to go through the GitHub file API. Full-file
  uploads are fine for small files but impractical for large ones, so the
  700-line `tgg-studio/src/App.jsx` and any other large file could not be safely
  rewritten without risking transcription damage.
- **Consequences in this session**: the studio fix was kept self-contained in
  `src/storage.js` + tests instead of also editing `App.jsx`; the OS work edited
  three files that were read back and byte-diffed against the branch.
- **Unblock**: a token or SSH key available to the sandbox (or a clone-based
  workspace with push access) would remove this class of workaround.

## B2 — Private repository not accessible for local work

- **Repo**: `tggm803sc/tggm-universe-private` (default branch
  `feat/tggm-universe-enhancements`).
- **Effect**: its five test suites (`test-suite.mjs`, `test-browser-smoke.mjs`,
  `test-mcp-bridge.mjs`, `test-mcp-integration.mjs`, `test-baseline-audit.mjs`)
  were **NOT TESTED**. Its current pass/fail state is unknown.
- **Unblock**: B1, or a CI workflow in that repo that runs the suites on PRs.

## B3 — TGG World (Unreal) cannot be compiled

- **Evidence**: `tggm/game/unreal` contains `Source/MultiplayerFramework`
  (18 C++ files), `Shaders/TGGPostProcess.hlsl` and `UI/WBP_HUD.layout.json`,
  but no `.uproject`, no `.uplugin`, no engine and no CI target.
- **Effect**: the Unreal career simulator was not built, tested or changed.
- **Unblock**: the real Unreal project (`.uproject` + targets) and a build
  environment with the engine, or a documented headless build image.

## B4 — No browser or device in the session

- **Effect**: every UI change is compiled and unit-tested but visually
  **UNVERIFIED**: TGG OS resume-on-reload, the OS clock change, the studio
  storage banner, export/MediaRecorder behaviour, and all mobile layouts.
- **Unblock**: a browser session (or Playwright) against a served build.

## B5 — OCI infrastructure is apply-ready but unauthorised

- **Evidence**: `TGG-PROJECT.json` → `status:
  APPLY_READY_WAITING_EXTERNAL_OCI_EXECUTION`, `resource_manager_apply: NOT_RUN`,
  `control_ingress_8787: CLOSED`, `host_agent_remote_token_provisioned: false`.
- **Effect**: no host, no public IP, nothing to deploy to; the Terraform plan
  itself also needs OCI credentials that are not present here.
- **Unblock**: OCI credentials plus explicit authorisation to apply.

## B6 — `tggm` PRs #15 and #16 are blocked on a live host

- **Evidence**: both PR bodies say they must not be promoted until a reachable
  TGG production host and a real render/browser proof exist on the served SHA.
- **Effect**: left untouched; touching them without a host would mean claiming
  verification that cannot be produced.
- **Unblock**: a reachable host session, or a self-hosted runner.

## B7 — No CI in two active repositories

- **Evidence**: `tgg-studio` and `tru-go-getta-mixtape` have no
  `.github/workflows` directory; `tgg-os` and `tggm` do.
- **Effect**: this is how the mixtape gate stayed red in `main` — nothing ran it.
  It also means the new studio tests only run when someone runs them.
- **Unblock**: a small workflow per repo (`npm ci` + test/build). Not added here
  because it is a separate, reviewable change per repo.

## B8 — Provider credentials absent

- **Effect**: Higgsfield/OpenAI/Anthropic generation paths, and the Prisma-backed
  routes that need a database URL, are **NOT TESTED**. Only their syntax gates
  and compiles were verified.
- **Unblock**: credentials supplied as repository or environment secrets (never
  in source).

## B9 — GitHub Actions history not inspected

- **Effect**: deployment status for the TGG World Pages site and the outcome of
  the nine `tggm` workflows are **UNVERIFIED**. "Workflow exists" was recorded,
  not "workflow passed".
- **Unblock**: read the Actions runs for the relevant SHAs (available to the
  connected account).
