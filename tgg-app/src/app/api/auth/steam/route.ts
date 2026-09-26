import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';

export async function GET() {
  const callback = process.env.STEAM_OPENID_CALLBACK_URL;
  if (!callback) return NextResponse.json({ error: 'steam_not_configured' }, { status: 503 });

  const state = randomBytes(24).toString('hex');
  const url = new URL('https://steamcommunity.com/openid/login');
  url.searchParams.set('openid.ns', 'http://specs.openid.net/auth/2.0');
  url.searchParams.set('openid.mode', 'checkid_setup');
  url.searchParams.set('openid.return_to', `${callback}?state=${state}`);
  url.searchParams.set('openid.realm', new URL(callback).origin);
  url.searchParams.set('openid.identity', 'http://specs.openid.net/auth/2.0/identifier_select');
  url.searchParams.set('openid.claimed_id', 'http://specs.openid.net/auth/2.0/identifier_select');

  const response = NextResponse.redirect(url);
  response.cookies.set('tgg_steam_state', state, {
    httpOnly: true, secure: true, sameSite: 'lax', maxAge: 600, path: '/',
  });
  return response;
}
