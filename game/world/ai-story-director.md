# TGG World — AI story director

Act I ships with a story layer that can write itself. It is deliberately split in
two so the game never depends on a model being available.

## 1. Offline beat engine (`tgg-game3d/src/story.js`)

Deterministic for a seed. It composes, from canon arrays:

- one **logline** built from a hook plus a complication,
- two **beats**, one per fixed destination (Studio 808, then The Vault),
  each with a short objective and an arrival line.

The destinations are fixed because the world geometry is fixed. Only the
wording, hook and complication vary, so a written run can never send the player
to a street that does not exist.

## 2. Model director (`tgg-game3d/src/director.js` + `/api/story`)

`StoryDirector.requestRun()` bumps the seed, calls `POST /api/story` with the
seed and stage, and accepts the result only if `validateStory()` passes:

- logline present, under 160 characters,
- exactly two beats, objective under 60, line under 90,
- tags stripped, whitespace collapsed.

On 501 (no key), timeout (5 s) or malformed output it falls back to the offline
engine. The panel labels the result **model-written** or **offline beat engine**
so the player always knows which one they are reading.

`tgg-game3d/worker.js` holds the only place the key is read: `env.OPENAI_API_KEY`
plus optional `FREEBUFF_API_BASE` and `FREEBUFF_MODEL`. Nothing secret reaches
the browser.

### Enabling real model-written beats

1. Create a key at https://freebuff.com/account/api (Desktop: Account → Developer API).
2. Sites → the TGG World project → **Secrets** → add `OPENAI_API_KEY`.
3. Redeploy. Without this step `/api/story` answers 501 and the game stays on
   offline beats — that is expected, not a bug.

## Canon guardrails in the prompt

The system prompt pins:

- campaign **The Sound of the Streets**, Act I **Keys to the Coupe**,
- the two-stop route and the coupe,
- arrival lines must end with `(DEMO)`,
- no invented money, royalties, charts, sales or release claims,
- no HTML, JSON only.

## What this is not

This is a **director and writer layer**, not a trained model. There is no
fine-tuned network, no memory of previous runs and no evaluation harness yet.
Building a genuinely owned model would need:

1. a corpus of approved world content (the world bible and script are the start),
2. a fine-tune or LoRA job plus a fixed eval set scored by a human on canon,
3. a serving path with the same key isolation this route already demonstrates,
4. a regression gate that rejects beats whose objectives cannot be reached.

Until 1–4 exist, calling this "our own AI" would be overstating it: the game has
an AI-shaped pipeline that a hosted model plugs into, with a safe offline floor.

## Next story work

- Tension: track heat, police presence and hype as inputs to beat selection.
- Characters: a small cast with goals, so beats reference people, not only places.
- Memory: persist the last N runs so the director avoids repeating hooks.
