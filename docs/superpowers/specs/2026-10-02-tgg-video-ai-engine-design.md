# TGG Video AI Engine Design

Date: 2026-10-02

## 1. Purpose

Build the production AI-processing and rendering subsystem behind the existing TGG Video Studio editor so a user can import footage and music, have TGG analyze the media, generate an editable AI first cut, preview it, revise it in the existing timeline, and render a finished master.

The existing editor remains the primary interaction surface. This subsystem extends it; it does not replace or redesign it.

## 2. Success Criteria

A successful production pass supports this end-to-end flow:

1. User imports footage and optional music.
2. TGG analyzes visual, audio, timing, and quality signals.
3. TGG produces a structured edit plan.
4. The edit plan materializes into the existing editable timeline.
5. The user can preview, reorder, trim, remove, restyle, and override AI decisions.
6. Render Center creates an actual video master from the approved timeline.
7. The result remains editable after AI automation.

The system must preserve existing working functionality including uploaded media preview, reordered-shot playback, music playback, stop/replay, and timeline handoff.

## 3. Scope

### In scope

- Media analysis
- Scene and shot boundary detection
- Person/action/motion signal extraction
- Speech/silence and audio energy analysis
- Shot-quality and highlight scoring
- Music structure analysis
- BPM, beat, downbeat, drop, hook, and section markers
- AI edit-plan generation
- Music video, reel/highlight, movie/film, animation, show/episode, and social presets
- Auto first cut
- Beat sync
- Clean audio
- Smart reframe
- Caption instructions
- Transition/effect instructions
- Timeline materialization
- Browser preview compatibility
- Render job creation
- Render progress and error states
- Final video output metadata
- Editable post-AI timeline state

### Out of scope for this first production pass

- Training a custom foundation model
- Replacing the existing TGG editor UI
- Autonomous publishing to third-party social platforms
- Destructive replacement of original source media
- Claiming GPU render completion without runtime evidence

## 4. Architecture

The subsystem is split into four independently testable engines behind one orchestration layer.

### 4.1 Media Brain

Responsibilities:

- Read normalized media metadata.
- Identify shots/scenes and coarse visual changes.
- Detect motion intensity and usable action windows.
- Detect speech versus silence.
- Identify low-quality or unusable sections.
- Produce highlight candidates with confidence scores.

Output:

```ts
type MediaAnalysis = {
  assetId: string;
  durationMs: number;
  shots: ShotAnalysis[];
  speechRanges: TimeRange[];
  silenceRanges: TimeRange[];
  highlights: HighlightCandidate[];
  qualityFlags: QualityFlag[];
};
```

The Media Brain never mutates the timeline directly.

### 4.2 Music Brain

Responsibilities:

- Analyze imported music or primary audio.
- Estimate BPM and beat grid.
- Identify downbeats, drops, hooks, verses, choruses, breaks, and major energy changes where confidence is sufficient.
- Produce sync markers usable by the Director Brain.

Output:

```ts
type MusicAnalysis = {
  assetId: string;
  bpm?: number;
  beats: number[];
  downbeats: number[];
  sections: MusicSection[];
  energyCurve: EnergyPoint[];
  confidence: number;
};
```

If music analysis confidence is too low, the system falls back to scene-driven timing rather than inventing precise musical structure.

### 4.3 Director Brain

Responsibilities:

- Consume MediaAnalysis, optional MusicAnalysis, user intent, project format, and selected automation mode.
- Rank candidate moments.
- Select and order shots.
- Decide trim windows.
- Assign cut timing.
- Add optional caption, transition, reframe, audio-cleanup, and effect instructions.
- Produce one structured edit plan that is fully editable.

Primary modes:

- music-video
- reel
- highlight
- film
- episode
- animation
- social

Automation commands such as Auto first cut, Beat sync, Clean audio, and Smart reframe are treated as directives to the same Director Brain pipeline, not as separate editing systems.

Output:

```ts
type EditPlan = {
  id: string;
  projectId: string;
  mode: EditMode;
  version: number;
  durationMs: number;
  tracks: PlannedTrack[];
  captions: CaptionInstruction[];
  effects: EffectInstruction[];
  transitions: TransitionInstruction[];
  reframes: ReframeInstruction[];
  audio: AudioInstruction[];
  sourceAnalyses: string[];
  warnings: string[];
};
```

### 4.4 Render Brain

Responsibilities:

- Validate the approved timeline snapshot.
- Convert timeline state to a deterministic render manifest.
- Resolve referenced media assets.
- Apply trim/order, format, captions, transitions, reframing, audio, and approved effects.
- Create a render job.
- Report queued/running/succeeded/failed states.
- Return final output metadata only when runtime evidence confirms success.

Output:

```ts
type RenderJob = {
  id: string;
  projectId: string;
  timelineVersion: number;
  manifestHash: string;
  status: "queued" | "running" | "succeeded" | "failed";
  progress: number;
  output?: {
    assetId: string;
    mimeType: string;
    width: number;
    height: number;
    durationMs: number;
  };
  error?: string;
};
```

The Render Brain must fail closed. No completed export is claimed when the render worker did not produce and verify a real output artifact.

## 5. Orchestration Layer

A Video AI Orchestrator coordinates the four engines.

```text
Imported Assets
      |
      v
Media Brain -----
                  \
                   > Director Brain -> Edit Plan -> Existing Timeline
Music Brain -----/                                |
                                                  v
                                             Preview/Edit
                                                  |
                                                  v
                                             Render Brain
                                                  |
                                                  v
                                            Finished Master
```

The orchestrator owns state transitions but not editing logic.

Suggested states:

- idle
- analyzing-media
- analyzing-music
- planning
- ready-to-preview
- applied-to-timeline
- render-queued
- rendering
- rendered
- failed

## 6. Existing Editor Integration

The current TGG Video Studio remains authoritative for user edits.

The AI layer integrates at three points:

### Import

Imported assets are registered for analysis while continuing to appear in the existing media panel and preview workflow.

### Apply to timeline

The Director Brain returns an EditPlan. A dedicated adapter converts the plan into existing timeline clip/track objects.

The adapter must:

- preserve source-asset references,
- preserve clip editability,
- avoid flattening the project into one pre-rendered clip,
- keep user changes distinguishable from AI-originated suggestions,
- allow repeated AI passes without silently deleting manual edits.

### Render

Render Center receives a versioned timeline snapshot, not a fresh autonomous edit request. This ensures the final output reflects the exact timeline the user approved.

## 7. User Control and Override Rules

AI is assistive, not authoritative.

- Every AI-generated cut remains editable.
- Every effect, caption, transition, and reframe can be removed or changed.
- Re-running AI must not silently destroy manual timeline changes.
- The user can choose to apply a full plan, selected suggestions, or no suggestion.
- The system stores plan version and timeline version separately.
- Manual edits after AI application create a new timeline version.

## 8. Data and Versioning

Minimum persistent records:

- Project
- MediaAsset
- MediaAnalysis
- MusicAnalysis
- EditPlan
- TimelineVersion
- RenderManifest
- RenderJob
- RenderOutput

All derived artifacts include:

- source asset IDs,
- project ID,
- producing engine version,
- creation timestamp,
- deterministic content or manifest hash where applicable.

## 9. Error Handling

### Analysis failures

If one asset fails analysis:

- mark only that asset failed,
- continue analyzing other assets when safe,
- surface the failure in EditPlan warnings,
- never fabricate analysis data.

### Low-confidence results

Use explicit confidence values.

Fallback order:

1. verified signal
2. simpler heuristic
3. omit feature

Example: if BPM confidence is weak, omit beat-locking and use scene-driven cuts.

### Missing render capability

If no compatible render worker is available:

- keep the project and edit plan valid,
- show render unavailable/blocked,
- do not mark the export succeeded.

### Worker failure

A failed render job preserves:

- manifest,
- timeline version,
- error details,
- retry eligibility.

A retry creates a new render attempt but may reuse the same immutable manifest.

## 10. Rendering Contract

The render manifest is immutable once queued.

It includes:

- exact timeline version,
- exact source asset versions,
- canvas size and frame rate,
- clip trims and order,
- transition/effect parameters,
- caption payloads,
- reframe instructions,
- audio mix instructions,
- output codec/container preset,
- manifest hash.

A rendered output is accepted only when:

1. the worker reports success,
2. the produced file exists,
3. its metadata is readable,
4. expected duration is within allowed tolerance,
5. output is associated with the same manifest hash.

## 11. First Production Pass

The first pass prioritizes one reliable path:

```text
Footage + Song
-> analyze
-> create editable music-video first cut
-> preview
-> modify timeline
-> render master
```

Required automation features in this pass:

- Auto first cut
- Beat sync
- Basic clean-audio instructions
- Smart reframe instructions
- Basic captions
- Core transitions
- Real render job path
- Render progress/error state
- Verified final output record

Advanced generative scene creation and complex VFX remain separate extensions after this core path is stable.

## 12. Testing Strategy

Testing is organized by engine and by end-to-end contract.

### Unit tests

Media Brain:
- shot segmentation normalization
- highlight ranking
- unusable-range exclusion

Music Brain:
- beat-grid normalization
- section-boundary handling
- low-confidence fallback

Director Brain:
- deterministic edit plan from fixed inputs
- no overlapping incompatible trims
- beat-sync placement
- manual-protection rules
- mode-specific pacing constraints

Timeline adapter:
- EditPlan maps to editable timeline objects
- source references preserved
- repeated plan application does not silently remove manual edits

Render Brain:
- timeline snapshot validation
- manifest determinism
- missing asset failure
- manifest hash stability
- render-state transitions
- output verification

### Integration tests

- imported footage plus song produces an EditPlan
- EditPlan applies to timeline
- preview consumes applied timeline
- timeline modification increments version
- render uses the modified version
- successful worker evidence produces a verified RenderOutput
- absent worker evidence never produces a false success

### Regression tests

Existing editor functionality must remain green:

- media import/preview
- reordered shot playback
- music playback
- stop/replay
- timeline handoff
- manual editing

## 13. Rollout

Roll out behind a project capability flag first.

Recommended stages:

1. analysis-only shadow mode
2. editable first-cut generation
3. render manifest generation
4. render worker execution
5. verified output delivery
6. enable by default after regression and runtime proof

## 14. Non-Negotiable Guardrails

- Do not replace the working editor.
- Do not flatten AI output before the user has a chance to edit it.
- Do not create four disconnected automation systems.
- Do not fabricate analysis, render, or runtime proof.
- Do not mark export success without verified output evidence.
- Do not delete or overwrite original uploaded media.
- Keep AI suggestions reversible.
