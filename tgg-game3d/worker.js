// Static assets plus one AI route. Keys live in Sites secrets, never in the
// bundle or the browser. Provider order: a self-hosted Ollama first (no bill,
// no quota), then Z.ai's free GLM-4-flash tier, then Freebuff as a paid
// fallback. With none configured the game stays on its own offline beat engine.

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

// Ollama's OpenAI-compatible endpoint is young enough that response_format is
// not worth depending on; the prompt already asks for JSON and the reply is
// parsed leniently either way.

// One-click key check. Reports which variables are set and, when one is, makes a
// tiny real call so "configured" is never confused with "working". The key value
// is never read back into the response.
async function handleVerify(request, env) {
  if (request.method !== 'GET') return json({ error: 'GET only' }, 405);

  const keys = {
    OLLAMA_BASE_URL: Boolean(env.OLLAMA_BASE_URL),
    ZAI_API_KEY: Boolean(env.ZAI_API_KEY),
    OPENAI_API_KEY: Boolean(env.OPENAI_API_KEY),
  };
  const provider = providerFor(env);

  if (!provider) {
    return json(
      {
        ok: false,
        reason: 'no key configured',
        keys,
        steps: [
          'Ollama route: run `cloudflared tunnel --url http://localhost:11434`, then set OLLAMA_BASE_URL to that https URL (optionally OLLAMA_MODEL, default llama3.2)',
          'Or set ZAI_API_KEY for the free hosted GLM-4-flash tier',
          'Set it under Sites -> Secrets, redeploy so the Worker sees it',
          'Reload this URL: ok:true means the model answered',
        ],
      },
      501,
    );
  }

  const started = Date.now();
  let upstream;
  try {
    upstream = await fetch(`${provider.base}/chat/completions`, {
      method: 'POST',
      headers: authHeaders(provider),
      body: JSON.stringify({
        model: provider.model,
        temperature: 0,
        max_tokens: 16,
        messages: [{ role: 'user', content: 'Reply with the single word: ok' }],
      }),
    });
  } catch {
    return json(
      { ok: false, reason: 'model unreachable from the Worker', provider: provider.name, model: provider.model, keys },
      502,
    );
  }

  const latencyMs = Date.now() - started;

  if (!upstream.ok) {
    // Only the machine-readable error code is echoed; provider messages can quote
    // part of the key, so they stay out of this public response.
    const body = await upstream.json().catch(() => null);
    return json(
      {
        ok: false,
        reason: 'the provider rejected this key or model',
        provider: provider.name,
        model: provider.model,
        upstreamStatus: upstream.status,
        upstreamCode: body?.error?.code ?? body?.code ?? null,
        keys,
        latencyMs,
      },
      502,
    );
  }

  const data = await upstream.json().catch(() => null);
  return json({
    ok: true,
    reason: 'the model answered',
    provider: provider.name,
    model: provider.model,
    keys,
    latencyMs,
    replyLength: String(data?.choices?.[0]?.message?.content ?? '').length,
  });
}

async function handleStory(request, env) {
  if (request.method !== 'POST') return json({ error: 'POST only' }, 405);

  const provider = providerFor(env);
  if (!provider) {
    return json(
      {
        error: 'director not configured',
        hint: 'No bill needed: run Ollama, expose it with a cloudflared tunnel, set OLLAMA_BASE_URL under Sites → Secrets, redeploy. Or set ZAI_API_KEY for the free hosted tier.',
      },
      501,
    );
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const seed = Number(body.seed) || Date.now();
  const stage = Math.max(0, Math.min(2, Number(body.stage) || 0));

  let upstream;
  try {
    upstream = await fetch(`${provider.base}/chat/completions`, {
      method: 'POST',
      headers: authHeaders(provider),
      body: JSON.stringify({
        model: provider.model,
        temperature: 0.9,
        max_tokens: 400,
        ...(provider.name === 'ollama' ? {} : { response_format: { type: 'json_object' } }),
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Write a fresh Act I run. Stage index ${stage}. Seed ${seed}. Keep the two stops: Studio 808 (record a take), then The Vault.`,
          },
        ],
      }),
    });
  } catch {
    return json({ error: 'model unreachable', provider: provider.name }, 502);
  }

  if (!upstream.ok) {
    return json({ error: 'model call failed', provider: provider.name, status: upstream.status }, 502);
  }

  const data = await upstream.json().catch(() => null);
  const content = data?.choices?.[0]?.message?.content;
  const parsed = extractJson(content);
  if (!parsed) return json({ error: 'model returned unusable output', provider: provider.name }, 502);

  return json({
    source: 'remote',
    provider: provider.name,
    logline: parsed.logline,
    beats: parsed.beats,
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/story') return handleStory(request, env);
    if (url.pathname === '/api/story/verify') return handleVerify(request, env);
    return env.ASSETS.fetch(request);
  },
};
