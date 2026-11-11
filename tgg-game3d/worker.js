// Static assets plus one AI route. Keys live in Sites secrets, never in the
// bundle or the browser. Z.ai's GLM-4-flash free tier is tried first so the
// director can run without a paid key; Freebuff is the fallback provider.

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

async function handleStory(request, env) {
  if (request.method !== 'POST') return json({ error: 'POST only' }, 405);

  const provider = providerFor(env);
  if (!provider) {
    return json(
      {
        error: 'director not configured',
        hint: 'Free option: add ZAI_API_KEY (Z.ai GLM-4-flash free tier) under Sites → Secrets, then redeploy.',
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
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${provider.key}`,
      },
      body: JSON.stringify({
        model: provider.model,
        temperature: 0.9,
        max_tokens: 400,
        response_format: { type: 'json_object' },
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
    return env.ASSETS.fetch(request);
  },
};
