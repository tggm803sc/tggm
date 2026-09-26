type DiscordDispatch = {
  content: string;
  username?: string;
};

export async function dispatchDiscordSentinel(payload: DiscordDispatch) {
  const webhook = process.env.TGG_DISCORD_SENTINEL_WEBHOOK;
  if (!webhook) {
    return { delivered: false as const, reason: 'not_configured' as const };
  }

  const response = await fetch(webhook, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      content: payload.content.slice(0, 1900),
      username: payload.username ?? 'TGG Sentinel',
      allowed_mentions: { parse: [] },
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`discord_dispatch_failed:${response.status}`);
  }

  return { delivered: true as const };
}
