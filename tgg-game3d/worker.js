// Static assets plus one AI route. The API key lives in Sites secrets, never in
// the bundle or the browser; without it the game falls back to offline beats.

const SYSTEM_PROMPT = `You are the story director for TGG World: "The Sound of the Streets", Act I "Keys to the Coupe".
Setting: a neon music and entertainment industry city. The player drives a coupe from TGG HQ to Studio 808, then carries a master to The Vault.
Rules:
- Reply with JSON only: {"logline": string, "beats": [{"objective": string, "line": string}, {"objective": string, "line": string}]}
- objective is a short imperative under 60 characters, aimed at the coupe.
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

async function handleStory(request, env) {
  if (request.method !== 'POST') return json({ error: 'POST only' }, 405);

  const key = env.OPENAI_API_KEY;
  if (!key) {
    return json(
      {
        error: 'director not configured',
        hint: 'Add OPENAI_API_KEY under Sites → Secrets, then redeploy.',
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
  const base = env.FREEBUFF_API_BASE || 'https://freebuff.com/api/v1/paid';
  const model = env.FREEBUFF_MODEL || 'gpt-4o-mini';

  let upstream;
  try {
    upstream = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.9,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Write a fresh Act I run. Stage index ${stage}. Seed ${seed}. Keep the two stops: Studio 808, then The Vault.`,
          },
        ],
      }),
    });
  } catch {
    return json({ error: 'model unreachable' }, 502);
  }

  if (!upstream.ok) {
    return json({ error: 'model call failed', status: upstream.status }, 502);
  }

  const data = await upstream.json().catch(() => null);
  const content = data?.choices?.[0]?.message?.content;
  const parsed = extractJson(content);
  if (!parsed) return json({ error: 'model returned unusable output' }, 502);

  return json({
    source: 'remote',
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
