// Static assets plus the story director route. Keys live in Sites secrets, never
// in the bundle or the browser.
//
// The director always answers. With no key configured the Worker writes the run
// itself from a deterministic grammar, so the AI panel is never a 501 and never
// a broken promise. A model is an upgrade, not a requirement: a self-hosted
// Ollama first (no bill, no quota), then Z.ai's free GLM-4-flash tier, then
// Freebuff as a paid fallback. A configured model that fails falls back to the
// built-in beats instead of taking the panel down with it.

function ollamaBase(env) {
  const raw = String(env.OLLAMA_BASE_URL || '').trim().replace(/\/+$/, '');
  if (!raw) return '';
  return /\/v1$/.test(raw) ? raw : `${raw}/v1`;
}

const SYSTEM_PROMPT = `You are the story director for TGG World: "The Sound of the Streets", Act I "Keys to the Coupe".
Setting: a neon music and entertainment industry city. The player drives a coupe from TGG HQ to Studio 808, records a take in the booth, then carries the master to The Vault.
Rules:
- Reply with JSON only: {"logline": string, "beats": [{"objective": string, "line": string}, {"objective": string, "line": string}]}
- objective is a short imperative under 60 characters, aimed at the coupe or the booth.
- line is the arrival toast under 90 characters and must end with "(DEMO)".
- Keep it grounded: streets, sessions, masters, radio, labels. No magic, no real artists, no real releases.
- Never invent money, royalties, chart positions or sales. Never claim anything shipped or went live.
- Do not use HTML.`;

// ---- built-in director ----------------------------------------------------

const HOOKS = [
  'the master is short a hook and the radio slot closes at midnight',
  'a rival label pressed the same sample and it lands first',
  'the engineer wants the mix finished before the sun is up',
  'the coupe still has the demo in the deck and the engine is warm',
  'the vault closes the session file at 4 a.m. sharp',
  'the A&R flies out at dawn and wants a finished master',
  'a pirate station is spinning the rough mix and nobody knows who leaked it',
  'the session player bailed and the booth is booked till morning',
];

const COMPLICATIONS = [
  'traffic is heavy and every light is against you',
  'a unit is already circling the block',
  'the walk signal is short and the sidewalks are crowded',
  'a delivery truck has the bridge down to one lane',
  'a rival crew is parked outside the studio with the engine running',
  'the bay is short a loader and the crates are stacked high',
];

const STUDIO_LINES = [
  'Studio 808 · session logged (DEMO)',
  'Studio 808 · hook cut, rough mix saved (DEMO)',
  'Studio 808 · console red, take printed (DEMO)',
  'Studio 808 · booth hot, one take down (DEMO)',
];

const VAULT_LINES = [
  'The Vault · master delivered (DEMO)',
  'The Vault · file stamped and shelved (DEMO)',
  'The Vault · delivery accepted (DEMO)',
  'The Vault · desk signed for the tape (DEMO)',
];

const CARGO_LINES = [
  'Salt Flats · crates loaded, bay clear (DEMO)',
  'Salt Flats · freight strapped down (DEMO)',
  'Salt Flats · van full, clock running (DEMO)',
];

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(rand, list) {
  return list[Math.floor(rand() * list.length) % list.length];
}

// Deterministic for a seed, so the same run can be replayed and the same beats
// survive a refresh. Every line is a demo and says so.
export function builtinStory(seed = Date.now(), stage = 0) {
  const rand = mulberry32((Number(seed) || 1) + Math.max(0, Number(stage) || 0) * 7919);
  const hook = pick(rand, HOOKS);
  const complication = pick(rand, COMPLICATIONS);
  const studio = pick(rand, STUDIO_LINES);
  const vault = pick(rand, VAULT_LINES);
  const cargo = pick(rand, CARGO_LINES);
  const opener = Number(stage) > 0 ? 'The master moved on and the night is not over' : hook;

  return {
    source: 'builtin',
    provider: 'tgg',
    logline: `${opener} — ${complication}.`,
    beats: [
      { objective: Number(stage) >= 2 ? 'Load the cargo at Salt Flats' : 'Cut the single at Studio 808', line: Number(stage) >= 2 ? cargo : studio },
      { objective: 'Carry the master to The Vault', line: vault },
    ],
  };
}

// ---- provider plumbing -----------------------------------------------------

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

function extractJson(text) {
  if (typeof text !== 'string') return null;
  const withoutFence = text.replace(/```json|```/g, '').trim();
  const start = withoutFence.indexOf('{');
  const end = withoutFence.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(withoutFence.slice(start, end + 1));
  } catch {
    return null;
  }
}

function providerFor(env) {
  const ollama = ollamaBase(env);
  if (ollama) {
    return {
      name: 'ollama',
      base: ollama,
      model: env.OLLAMA_MODEL || 'llama3.2',
      // A tunnelled Ollama can sit behind its own auth; a bare local one needs none.
      token: env.OLLAMA_TOKEN || '',
    };
  }
  if (env.ZAI_API_KEY) {
    return {
      name: 'zai',
      base: env.ZAI_API_BASE || 'https://api.z.ai/api/paas/v4',
      model: env.ZAI_MODEL || 'glm-4-flash',
      key: env.ZAI_API_KEY,
    };
  }
  if (env.OPENAI_API_KEY) {
    return {
      name: 'freebuff',
      base: env.FREEBUFF_API_BASE || 'https://freebuff.com/api/v1/paid',
      model: env.FREEBUFF_MODEL || 'gpt-4o-mini',
      key: env.OPENAI_API_KEY,
    };
  }
  return null;
}

function authHeaders(provider) {
  const headers = { 'content-type': 'application/json' };
  const token = provider.token ?? provider.key;
  if (token) headers.authorization = `Bearer ${token}`;
  return headers;
}

const UPGRADE_STEPS = [
  'Ollama route (no bill): run `cloudflared tunnel --url http://localhost:11434`, then set OLLAMA_BASE_URL to that https URL (optionally OLLAMA_MODEL, default llama3.2)',
  'Or set ZAI_API_KEY for the free hosted GLM-4-flash tier',
  'Set the variable under Sites -> Secrets, then redeploy so the Worker sees it',
  'Reload /api/story/verify: model.answered true means the model is writing the beats',
];

async function callModel(provider, messages, extra = {}) {
  const started = Date.now();
  const response = await fetch(`${provider.base}/chat/completions`, {
    method: 'POST',
    headers: authHeaders(provider),
    body: JSON.stringify({
      model: provider.model,
      messages,
      ...extra,
    }),
  });
  const latencyMs = Date.now() - started;
  const body = await response.json().catch(() => null);
  return { response, body, latencyMs };
}

// Reports what the director will do right now: built-in beats always work, and
// a configured model is probed with a tiny real call so "configured" is never
// confused with "working". No key value is ever read back.
export async function handleVerify(request, env) {
  if (request.method !== 'GET') return json({ error: 'GET only' }, 405);

  const keys = {
    OLLAMA_BASE_URL: Boolean(env.OLLAMA_BASE_URL),
    ZAI_API_KEY: Boolean(env.ZAI_API_KEY),
    OPENAI_API_KEY: Boolean(env.OPENAI_API_KEY),
  };
  const provider = providerFor(env);
  const builtin = { ok: true, provider: 'builtin', beats: builtinStory(1, 0).beats.length };

  if (!provider) {
    return json({
      ok: true,
      provider: 'builtin',
      builtin,
      reason: 'the built-in director is writing the runs; no model key is set',
      keys,
      model: { configured: false, answered: false },
      steps: UPGRADE_STEPS,
    });
  }

  let model = { configured: true, answered: false, provider: provider.name, model: provider.model };
  try {
    const { response, latencyMs } = await callModel(
      provider,
      [{ role: 'user', content: 'Reply with the single word: ok' }],
      { temperature: 0, max_tokens: 16 },
    );
    model = {
      ...model,
      answered: response.ok,
      status: response.status,
      latencyMs,
    };
  } catch {
    model = { ...model, answered: false, status: 0, reason: 'unreachable from the Worker' };
  }

  return json({
    ok: true,
    provider: model.answered ? provider.name : 'builtin',
    builtin,
    reason: model.answered
      ? 'the model answered, so it writes the runs'
      : 'the model did not answer; the built-in director keeps working',
    keys,
    model,
    steps: model.answered ? [] : UPGRADE_STEPS,
  });
}

export async function handleStory(request, env) {
  if (request.method !== 'POST') return json({ error: 'POST only' }, 405);

  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const seed = Number(body.seed) || Date.now();
  const stage = Math.max(0, Math.min(2, Number(body.stage) || 0));
  const provider = providerFor(env);

  if (!provider) {
    return json(builtinStory(seed, stage));
  }

  try {
    const { response, body: data } = await callModel(
      provider,
      [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Write a fresh Act I run. Stage index ${stage}. Seed ${seed}. Keep the two stops: Studio 808 (record a take), then The Vault.`,
        },
      ],
      {
        temperature: 0.9,
        max_tokens: 400,
        ...(provider.name === 'ollama' ? {} : { response_format: { type: 'json_object' } }),
      },
    );

    if (!response.ok) {
      return json({ ...builtinStory(seed, stage), degraded: provider.name, reason: 'model call failed' });
    }

    const parsed = extractJson(data?.choices?.[0]?.message?.content);
    if (!parsed) {
      return json({ ...builtinStory(seed, stage), degraded: provider.name, reason: 'model returned unusable output' });
    }

    return json({
      source: 'remote',
      provider: provider.name,
      logline: parsed.logline,
      beats: parsed.beats,
    });
  } catch {
    return json({ ...builtinStory(seed, stage), degraded: provider.name, reason: 'model unreachable' });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/story') return handleStory(request, env);
    if (url.pathname === '/api/story/verify') return handleVerify(request, env);
    return env.ASSETS.fetch(request);
  },
};
