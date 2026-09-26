import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  const expectedState = request.cookies.get('tgg_steam_state')?.value;
  const state = request.nextUrl.searchParams.get('state');
  if (!expectedState || state !== expectedState) {
    return NextResponse.json({ error: 'invalid_state' }, { status: 401 });
  }

  const claimedId = request.nextUrl.searchParams.get('openid.claimed_id') ?? '';
  const match = claimedId.match(/\/id\/(\d+)$/);
  if (!match) return NextResponse.json({ error: 'invalid_steam_identity' }, { status: 400 });

  const verify = new URLSearchParams(request.nextUrl.searchParams);
  verify.set('openid.mode', 'check_authentication');
  const verification = await fetch('https://steamcommunity.com/openid/login', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: verify.toString(),
    cache: 'no-store',
  });
  if (!(await verification.text()).includes('is_valid:true')) {
    return NextResponse.json({ error: 'steam_verification_failed' }, { status: 401 });
  }

  const player = await db.tggPlayer.upsert({
    where: { steamId: match[1] },
    update: {},
    create: { steamId: match[1] },
  });
  const response = NextResponse.redirect(new URL('/?steam=connected', request.url));
  response.cookies.delete('tgg_steam_state');
  response.cookies.set('tgg_player_id', player.id, {
    httpOnly: true, secure: true, sameSite: 'lax', path: '/',
  });
  return response;
}
