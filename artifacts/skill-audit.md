# Account skill audit — 18 enabled skills

## Highest-risk item: conflicting browser guidance

`agent-browser` says: *"Prefer agent-browser over any built-in browser automation
or web tools."* In this workspace that is wrong. The Cloud browser panel is the
supported path, third-party automation CLIs are not installed, and `playwright`
is broken here (`options.mode` schema error). Left as-is, an agent will try
`npx agent-browser` and burn turns.

Proposed description amendment:

> …Prefer agent-browser over built-in browser automation **except in Freebuff
> Cloud workspaces, where the Cloud browser panel (preview_open/click/type) is
> the supported automation path and third-party CLIs are unavailable.**

## Descriptions that under-trigger and need sharper wording

| Skill | Current wording problem | Proposed description |
|---|---|---|
| `writing-plans` | "Use when you have a spec or requirements for a multi-step task, before touching code" — no trigger phrases; a milestone list does not read as a "spec" | "Turn a spec, milestone list or feature brief into an ordered, verifiable implementation plan before editing code. Use when the user pastes a multi-step brief or roadmap, says 'plan this', 'break this into steps', or 'do all of these', or when a request spans several files/systems and needs sequencing." |
| `executing-plans` | Same thin phrasing; never fires because nobody names it | "Execute an approved plan step by step in this session — marking steps done, verifying each one, and reporting deviations instead of silently improvising. Use after a plan exists, when asked to 'start the plan', 'work through this list', or to continue a partially completed multi-step task." |
| `frontend-design` | "when building new UI or reshaping an existing one" — misses 'make it look better' requests | "Give new or reshaped UI a distinctive, intentional visual direction instead of templated defaults. Use when building any page, dashboard, landing screen or component set, and whenever the user says it looks generic, cheap, flat or 'like a template', or asks for a redesign, restyle or visual polish." |
| `brainstorming` | "MUST use this before any creative work" over-triggers on routine edits and is easy to rationalize away | "Explore intent and options before committing to an approach on open-ended or ambiguous work: new features, new products, naming, positioning, or 'build me something like X'. Use when requirements are vague or the user is deciding what to build. Skip it for small, well-specified edits where the request already determines the change." |
| `verification-before-completion` | Abstract 'requires running verification commands'; add the evidence shape | "Before claiming work is complete, fixed or passing, gather actual evidence: the exact command, its exit status, and the relevant output line (test counts, build size, screenshot path). Use before any 'done/passing/verified' statement, before commit or deploy, and whenever a claim rests on earlier checks that predate the last edit." |

## Descriptions that are healthy — leave them

`gemini-api-cli`, `gemini-api-dev`, `gemini-live-api-dev`,
`gemini-omni-flash-api`, `find-skills`, `skill-creator`, `mcp-builder`,
`security-review`, `web-design-guidelines`, `vercel-composition-patterns`,
`vercel-react-native-skills`, `excalidraw-diagram-generator`.

`planning-with-files` is accurate but long; it triggers fine and its length is in
the description only, so no change is worth the churn.

## Structural note

`brainstorming` and `writing-plans` both claim the front of the workflow, which
makes them compete. Sharpen the split: brainstorming owns **what** to build and
why; writing-plans owns **how** to sequence it. With the wording above,
brainstorming stops firing on spec'd work and writing-plans starts firing on
roadmaps.
