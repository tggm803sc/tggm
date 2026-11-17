// Cross-origin access for the career API.
//
// The app serves the game itself at /game/, so the normal case is same-origin and
// needs no CORS at all. The GitHub Pages build is a different origin, so it is
// allowed explicitly here; TGG_WORLD_ALLOWED_ORIGINS adds more (comma separated).
// Credentials are only ever echoed back to an origin on that list, and an
// unknown origin gets no headers rather than a wildcard.

const DEFAULT_ORIGINS = ['https://tggm803sc.github.io'];

export function allowedOrigins(env: Record<string, string | undefined> = process.env): string[] {
  const extra = String(env.TGG_WORLD_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  return [...DEFAULT_ORIGINS, ...extra];
}

type RequestLike = { headers: { get(name: string): string | null } };

export function corsHeaders(
  request: RequestLike,
  env: Record<string, string | undefined> = process.env,
): Record<string, string> {
  const origin = request.headers.get('origin');
  if (!origin || !allowedOrigins(env).includes(origin)) return {};
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-credentials': 'true',
    'access-control-allow-methods': 'GET, POST, PUT, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '600',
    vary: 'origin',
  };
}
