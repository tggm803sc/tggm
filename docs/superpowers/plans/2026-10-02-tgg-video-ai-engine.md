# TGG Video AI Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a TGG-owned video analysis, AI edit planning, editable timeline handoff, and fail-closed render pipeline behind the existing TGG Video Studio.

**Architecture:** Add a new `tgg-video-ai` Node ESM service that follows the existing TGG service/store/worker pattern used by `tgg-higgsfield`. Keep analysis, direction, timeline adaptation, and rendering as isolated modules behind one orchestrator; persist versioned JSON records durably and integrate with TGG Projects for events/assets without replacing the existing editor.

**Tech Stack:** Node.js ESM, built-in `node:test`/assert-style test scripts, filesystem-backed durable JSON stores, HTTP service/worker pattern, TGG Projects event/asset APIs, existing TGG package scripts.

**Spec:** `docs/superpowers/specs/2026-10-02-tgg-video-ai-engine-design.md`

## Global Constraints

- Do not replace the working editor.
- Do not flatten AI output before the user has a chance to edit it.
- Do not create four disconnected automation systems.
- Do not fabricate analysis, render, or runtime proof.
- Do not mark export success without verified output evidence.
- Do not delete or overwrite original uploaded media.
- Keep AI suggestions reversible.
- Existing media import/preview, reordered shot playback, music playback, stop/replay, timeline handoff, and manual editing must remain valid.
- Render manifests are immutable after queueing.
- Low-confidence music analysis must fall back to scene-driven timing rather than invent beat structure.
- All first-pass persistence remains TGG-owned and online-service compatible.

## File Structure

- `tgg-video-ai/contracts.mjs` — validation/normalization for shared record shapes and state enums.
- `tgg-video-ai/store.mjs` — durable versioned JSON persistence for analyses, plans, timelines, manifests, jobs, and outputs.
- `tgg-video-ai/media-brain.mjs` — media-analysis normalization and highlight ranking.
- `tgg-video-ai/music-brain.mjs` — beat/section normalization and confidence fallback.
- `tgg-video-ai/director-brain.mjs` — one edit planner for all AI automation directives/modes.
- `tgg-video-ai/timeline-adapter.mjs` — reversible EditPlan → editable timeline conversion and manual-edit protection.
- `tgg-video-ai/render-brain.mjs` — deterministic immutable render manifest generation and verified-output acceptance.
- `tgg-video-ai/orchestrator.mjs` — state machine coordinating all engines.
- `tgg-video-ai/server.mjs` — HTTP API/health surface.
- `tgg-video-ai/worker.mjs` — queued analysis/render work execution; never fabricates success.
- `tgg-video-ai/.env.example` — service paths/ports and optional analyzer/render worker bridge configuration.
- `scripts/test-tgg-video-ai-contracts.mjs` — contracts/store tests.
- `scripts/test-tgg-video-ai-analysis.mjs` — Media/Music Brain tests.
- `scripts/test-tgg-video-ai-director.mjs` — edit-plan tests.
- `scripts/test-tgg-video-ai-timeline.mjs` — timeline/manual-protection tests.
- `scripts/test-tgg-video-ai-render.mjs` — manifest/job/output-verification tests.
- `scripts/test-tgg-video-ai-orchestrator.mjs` — end-to-end service logic tests.
- `scripts/test-tgg-video-ai-regression.mjs` — editor contract markers/API compatibility regression gate.
- `package.json` — service/check/worker scripts and root `check` integration.

## Review Focus

1. **Zero-duration, corrupt, or metadata-poor source asset** — analysis must reject or warn without producing invalid timeline clips; pinned in Task 2.
2. **Music whose beat detector returns low confidence or empty markers** — Director Brain must use scene-driven timing; pinned in Task 2/3.
3. **User manually changes a timeline after an AI plan is applied, then runs AI again** — prior manual changes must not be silently deleted; pinned in Task 4.
4. **Render worker claims success but output is absent, unreadable, or tied to a different manifest hash** — job must remain failed/unverified; pinned in Task 5.
5. **Service restarts while a job is queued/running** — persisted job state must recover deterministically without inventing completion; pinned in Task 6.

---

### Task 1: Shared Contracts and Durable Store

**Files:**
- Create: `tgg-video-ai/contracts.mjs`
- Create: `tgg-video-ai/store.mjs`
- Create: `scripts/test-tgg-video-ai-contracts.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: filesystem durability pattern from `tgg-higgsfield/job-store.mjs`.
- Produces:
  - `normalizeMediaAsset(input) -> MediaAsset`
  - `normalizeMediaAnalysis(input) -> MediaAnalysis`
  - `normalizeMusicAnalysis(input) -> MusicAnalysis`
  - `normalizeEditPlan(input) -> EditPlan`
  - `normalizeTimelineVersion(input) -> TimelineVersion`
  - `normalizeRenderManifest(input) -> RenderManifest`
  - `createStore({root}) -> VideoAiStore`
  - Store methods: `put(kind,id,value)`, `get(kind,id)`, `list(kind,{projectId,status,limit})`, `nextVersion(kind,projectId)`.

- [ ] **Step 1: Write failing contract/store tests**

Test assertions:
- invalid negative durations fail;
- edit modes accept exactly `music-video|reel|highlight|film|episode|animation|social`;
- render status accepts exactly `queued|running|succeeded|failed`;
- a durable `put` followed by a fresh store instance `get` returns the same normalized record;
- `nextVersion` monotonically increments per project/kind.

- [ ] **Step 2: Run the test and verify RED**

Run: `node scripts/test-tgg-video-ai-contracts.mjs`

Expected: non-zero exit because `tgg-video-ai/contracts.mjs` and `store.mjs` do not exist.

- [ ] **Step 3: Implement the contracts and store**

Use atomic temp-write → fsync → rename behavior matching the existing TGG durable-store pattern. Validate IDs/versions/statuses at module boundaries.

- [ ] **Step 4: Run GREEN and root syntax check**

Run:
`node scripts/test-tgg-video-ai-contracts.mjs && node --check tgg-video-ai/contracts.mjs && node --check tgg-video-ai/store.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

`git add tgg-video-ai/contracts.mjs tgg-video-ai/store.mjs scripts/test-tgg-video-ai-contracts.mjs package.json && git commit -m "feat: add TGG Video AI contracts and store"`

---

### Task 2: Media Brain and Music Brain

**Files:**
- Create: `tgg-video-ai/media-brain.mjs`
- Create: `tgg-video-ai/music-brain.mjs`
- Create: `scripts/test-tgg-video-ai-analysis.mjs`
- Modify: `tgg-video-ai/.env.example`

**Interfaces:**
- Consumes: Task 1 normalized contracts.
- Produces:
  - `analyzeMedia(asset, rawSignals={}) -> MediaAnalysis`
  - `analyzeMusic(asset, rawSignals={}) -> MusicAnalysis`
  - `rankHighlights(shots,{speechRanges,qualityFlags}) -> HighlightCandidate[]`
  - Music result includes `timingMode: "beat"|"scene"` and confidence.

- [ ] **Step 1: Write failing analysis tests**

Test assertions:
- valid shot signals normalize/sort/clamp into asset duration;
- unusable flagged windows are excluded from top highlights;
- zero-duration/corrupt asset returns explicit `media_asset_invalid`;
- empty/weak beat input returns `timingMode:"scene"`, no invented beats;
- confident beat input sorts/deduplicates beat/downbeat markers and preserves section boundaries.

- [ ] **Step 2: Run RED**

Run: `node scripts/test-tgg-video-ai-analysis.mjs`

Expected: FAIL because analyzers are missing.

- [ ] **Step 3: Implement minimal deterministic analyzers**

First-pass logic accepts normalized signal payloads from a future analyzer bridge and provides deterministic heuristic fallback. Do not add a paid/external analyzer dependency in this task.

- [ ] **Step 4: Run GREEN**

Run: `node scripts/test-tgg-video-ai-analysis.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

`git add tgg-video-ai/media-brain.mjs tgg-video-ai/music-brain.mjs tgg-video-ai/.env.example scripts/test-tgg-video-ai-analysis.mjs && git commit -m "feat: add TGG video media and music analysis"`

---

### Task 3: Director Brain and Unified Automation Commands

**Files:**
- Create: `tgg-video-ai/director-brain.mjs`
- Create: `scripts/test-tgg-video-ai-director.mjs`

**Interfaces:**
- Consumes:
  - `MediaAnalysis` from Task 2.
  - optional `MusicAnalysis` from Task 2.
- Produces:
  - `createEditPlan({projectId,mode,directives,mediaAnalyses,musicAnalysis,canvas}) -> EditPlan`
  - directives: `auto-first-cut|beat-sync|clean-audio|smart-reframe|captions`.

- [ ] **Step 1: Write failing Director Brain tests**

Test assertions:
- fixed analysis inputs produce deterministic plan ordering;
- trim windows do not exceed source bounds;
- beat-sync uses verified beat markers only when `timingMode==="beat"`;
- low-confidence music produces scene-driven cuts;
- `clean-audio` adds audio instructions to the same plan rather than creating another plan type;
- `smart-reframe` adds reframe instructions while retaining source clip IDs;
- music-video pacing differs from reel/film pacing using explicit mode rules;
- warnings carry missing/failed asset IDs.

- [ ] **Step 2: Run RED**

Run: `node scripts/test-tgg-video-ai-director.mjs`

Expected: FAIL because Director Brain is missing.

- [ ] **Step 3: Implement the unified planner**

Keep one `EditPlan` schema for all commands. Add only deterministic first-pass pacing rules needed by the tests; no generative scene creation.

- [ ] **Step 4: Run GREEN**

Run: `node scripts/test-tgg-video-ai-director.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

`git add tgg-video-ai/director-brain.mjs scripts/test-tgg-video-ai-director.mjs && git commit -m "feat: add unified TGG AI video director"`

---

### Task 4: Editable Timeline Adapter and Manual-Edit Protection

**Files:**
- Create: `tgg-video-ai/timeline-adapter.mjs`
- Create: `scripts/test-tgg-video-ai-timeline.mjs`

**Interfaces:**
- Consumes: `EditPlan` from Task 3 and optional prior `TimelineVersion`.
- Produces:
  - `applyEditPlan({plan,previousTimeline=null}) -> TimelineVersion`
  - `markManualEdit(timeline,edit) -> TimelineVersion`
  - `mergePlanSuggestions({plan,timeline,strategy}) -> TimelineVersion`
  - strategy values: `replace-ai-only|append-suggestions|selected`.

- [ ] **Step 1: Write failing timeline tests**

Test assertions:
- planned clips remain independent editable objects, never one flattened clip;
- source asset IDs and trim ranges survive conversion;
- AI-originated clips are marked `origin:"ai"`;
- manual changes create a new timeline version and mark affected items `origin:"manual"`;
- applying a second plan with `replace-ai-only` replaces prior AI-originated items but preserves manual items;
- selected suggestion application changes only selected plan item IDs;
- captions/effects/transitions/reframes remain individually removable timeline objects.

- [ ] **Step 2: Run RED**

Run: `node scripts/test-tgg-video-ai-timeline.mjs`

Expected: FAIL because adapter is missing.

- [ ] **Step 3: Implement adapter/version protection**

Use stable source IDs plus unique timeline item IDs. Never mutate an input timeline in place.

- [ ] **Step 4: Run GREEN**

Run: `node scripts/test-tgg-video-ai-timeline.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

`git add tgg-video-ai/timeline-adapter.mjs scripts/test-tgg-video-ai-timeline.mjs && git commit -m "feat: preserve editable timelines across AI passes"`

---

### Task 5: Render Brain, Immutable Manifest, and Verified Output

**Files:**
- Create: `tgg-video-ai/render-brain.mjs`
- Create: `scripts/test-tgg-video-ai-render.mjs`

**Interfaces:**
- Consumes: approved `TimelineVersion`, source asset metadata.
- Produces:
  - `createRenderManifest({timeline,assets,preset}) -> RenderManifest`
  - `createRenderJob({manifest}) -> RenderJob`
  - `advanceRenderJob(job,{status,progress,error}) -> RenderJob`
  - `verifyRenderOutput({job,manifest,evidence}) -> RenderOutput`
  - `hashRenderManifest(manifest) -> string`.

- [ ] **Step 1: Write failing render tests**

Test assertions:
- same normalized timeline/assets/preset gives same manifest hash;
- different timeline version changes the manifest hash;
- manifest references exact source asset versions;
- missing asset prevents queueing;
- terminal succeeded cannot be accepted without evidence;
- evidence must report an existing/readable output descriptor, matching manifest hash, parseable metadata, and duration within configured tolerance;
- mismatched hash/missing output/unreadable metadata results in failure, never `succeeded`;
- retry creates a new attempt ID while retaining immutable manifest hash.

- [ ] **Step 2: Run RED**

Run: `node scripts/test-tgg-video-ai-render.mjs`

Expected: FAIL because Render Brain is missing.

- [ ] **Step 3: Implement render contract**

Use canonical JSON serialization for manifest hashing. Keep worker execution abstract: this task defines and verifies the contract but does not fake a renderer.

- [ ] **Step 4: Run GREEN**

Run: `node scripts/test-tgg-video-ai-render.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

`git add tgg-video-ai/render-brain.mjs scripts/test-tgg-video-ai-render.mjs && git commit -m "feat: add fail-closed TGG video render contract"`

---

### Task 6: Orchestrator, Service API, Worker Recovery, and TGG Projects Events

**Files:**
- Create: `tgg-video-ai/orchestrator.mjs`
- Create: `tgg-video-ai/server.mjs`
- Create: `tgg-video-ai/worker.mjs`
- Create: `scripts/test-tgg-video-ai-orchestrator.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: Tasks 1–5.
- Produces:
  - `createVideoAiOrchestrator({store,projectsClient,renderExecutor})`
  - `analyzeProject(projectId,input)`
  - `planProject(projectId,input)`
  - `applyPlan(projectId,planId,input)`
  - `queueRender(projectId,timelineVersion,input)`
  - `recoverPendingJobs()`
  - HTTP:
    - `GET /health`
    - `POST /v1/projects/:id/analyze`
    - `POST /v1/projects/:id/plans`
    - `POST /v1/projects/:id/plans/:planId/apply`
    - `POST /v1/projects/:id/renders`
    - `GET /v1/jobs/:id`
    - `GET /v1/projects/:id/state`.

- [ ] **Step 1: Write failing orchestrator tests**

Test assertions:
- footage+song progresses `idle -> analyzing-media -> analyzing-music -> planning -> ready-to-preview`;
- applying plan persists a TimelineVersion;
- manual timeline version is the one queued for render;
- a queued job survives a fresh orchestrator/store instance;
- a stale `running` job after restart becomes retryable/recoverable, not magically completed;
- TGG Projects event failures do not falsify local job state;
- completed verified output emits an asset/event payload containing manifest hash and timeline version.

- [ ] **Step 2: Run RED**

Run: `node scripts/test-tgg-video-ai-orchestrator.mjs`

Expected: FAIL because orchestrator/service modules are missing.

- [ ] **Step 3: Implement orchestrator, API, worker**

Follow the existing `tgg-higgsfield/server.mjs` and worker conventions for headers, health, TGG Projects calls, queue processing, and failure isolation. Default worker mode is local TGG execution; any external bridge is optional/configurable and must fail closed when selected but unavailable.

- [ ] **Step 4: Add package scripts**

Add:
- `tgg:video-ai`
- `tgg:video-ai:worker`
- `tgg:video-ai:worker:once`
- `check:tgg-video-ai`

Include `check:tgg-video-ai` in the root `check` chain.

- [ ] **Step 5: Run GREEN**

Run: `npm run check:tgg-video-ai`

Expected: all Task 1–6 tests plus syntax checks PASS.

- [ ] **Step 6: Commit**

`git add tgg-video-ai scripts/test-tgg-video-ai-*.mjs package.json && git commit -m "feat: orchestrate TGG Video AI service and worker"`

---

### Task 7: Existing Video Studio Bridge and Regression Gate

**Files:**
- Create: `scripts/test-tgg-video-ai-regression.mjs`
- Create: `tgg-video-ai/editor-contract.json`
- Modify: only the active TGG Video Studio integration source discovered during implementation; do not create a duplicate editor surface.
- Modify: `package.json`

**Interfaces:**
- Consumes:
  - existing TGG Video Studio project contract;
  - service API from Task 6.
- Produces:
  - editor capability mapping:
    - `Auto first cut -> directives:["auto-first-cut"]`
    - `Beat sync -> directives:["beat-sync"]`
    - `Clean audio -> directives:["clean-audio"]`
    - `Smart reframe -> directives:["smart-reframe"]`
  - plan-preview/apply/render hooks that preserve existing preview and timeline behavior.

- [ ] **Step 1: Discover and pin the actual active editor source**

Use the Library Site metadata/project source currently backing `TGG Video Studio.txt` / `tgg-video-studio-ai-editor`. If no editable source is available through the connected artifact/site capability, stop this task at the bridge boundary and record that deployment integration remains blocked; do not create a lookalike replacement site.

- [ ] **Step 2: Write failing regression/bridge test**

Assertions:
- four existing AI buttons map to the unified directives;
- AI response shape materializes through the existing editable timeline contract;
- existing preview contract markers remain present;
- existing reordered playback, music playback, stop/replay, and timeline handoff markers remain present;
- render completion UI only accepts verified `RenderOutput`.

- [ ] **Step 3: Run RED**

Run: `node scripts/test-tgg-video-ai-regression.mjs`

Expected: FAIL until the bridge mapping exists.

- [ ] **Step 4: Implement the smallest bridge into the active editor source**

Do not redesign the editor. Add service calls/state mapping only.

- [ ] **Step 5: Run complete regression gate**

Run:
`npm run check:tgg-video-ai && npm run check:tgg-app && npm run check:tgg-higgsfield`

Expected: PASS. If the active editor lives outside the repository and cannot be directly tested here, the repository bridge tests must pass and the live-editor integration remains explicitly PENDING until live proof.

- [ ] **Step 6: Commit**

`git add tgg-video-ai/editor-contract.json scripts/test-tgg-video-ai-regression.mjs package.json <actual-editor-bridge-files> && git commit -m "feat: connect TGG Video Studio to Video AI Engine"`

---

### Task 8: Runtime Proof and Promotion Gate

**Files:**
- Create: `tgg-ci/check-video-ai-readiness.mjs`
- Create: `tgg-ci/video-ai-readiness.schema.json`
- Modify: `package.json`

**Interfaces:**
- Consumes: live service health/job/output evidence.
- Produces:
  - `tgg.video-ai.readiness.v1` evidence record;
  - `check:tgg-video-ai-readiness`.

- [ ] **Step 1: Write failing readiness test fixtures**

Cases:
- service unavailable → HOLD;
- editor bridge unavailable → HOLD;
- analysis+plan+timeline verified but no renderer → HOLD with render blocker;
- renderer reports success without verified output → HOLD;
- full path with same manifest hash and verified output → PASS.

- [ ] **Step 2: Run RED**

Run: `node tgg-ci/check-video-ai-readiness.mjs --fixture missing`

Expected: command/file missing or failing before implementation.

- [ ] **Step 3: Implement readiness gate**

The gate must distinguish source/static readiness from live runtime proof. It must never promote source-only evidence as a rendered-video PASS.

- [ ] **Step 4: Run full static suite**

Run:
`npm run check:tgg-video-ai && npm run check:tgg-app && npm run check:tgg-higgsfield && npm run check:tgg-video-ai-readiness -- --fixture valid`

Expected: PASS for deterministic fixture/static validation.

- [ ] **Step 5: Run live proof only when a real TGG service origin and render worker are available**

Required live evidence:
- Video AI health;
- project analyze request;
- persisted EditPlan;
- applied TimelineVersion;
- render job;
- real output verification;
- matching manifest hash;
- editor preview/render smoke.

If any real runtime component is unavailable, report PENDING/HOLD rather than manufacturing proof.

- [ ] **Step 6: Commit**

`git add tgg-ci/check-video-ai-readiness.mjs tgg-ci/video-ai-readiness.schema.json package.json && git commit -m "test: gate TGG Video AI on verified runtime output"`
