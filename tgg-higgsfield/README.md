# TGG Higgsfield

TGG Higgsfield is the TGG-owned creative-generation orchestration layer for:

- Game Studio creative generation
- VFX jobs
- image generation jobs
- image-to-video jobs
- cinematic promo jobs
- avatar/character creative passes
- project-context-aware creative requests

The current repository contains the TGG-owned API/job layer. The actual GPU/model worker can be attached behind `tgg-creative-engine` without changing the Creator OS or Game Studio API.

Default port: `10040`
Default state: `/data/tgg-higgsfield`

This service declares `external_provider_required:false`.
