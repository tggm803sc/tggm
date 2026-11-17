import { NextRequest } from 'next/server';
import { db } from '@/lib/db';

/** Cookie set by the Steam callback once Steam has verified the identity. */
export const PLAYER_COOKIE = 'tgg_player_id';

export interface SessionPlayer {
  id: string;
}

/**
 * Returns the player the request is actually signed in as, or null.
 *
 * The id comes only from the httpOnly session cookie — never from a body field,
 * a query parameter or a header — so one player cannot address another player's
 * save by guessing an id.
 */
export async function requirePlayer(request: NextRequest): Promise<SessionPlayer | null> {
  const id = request.cookies.get(PLAYER_COOKIE)?.value;
  if (!id || id.length > 64) return null;
  const player = await db.tggPlayer.findUnique({ where: { id }, select: { id: true } });
  return player ?? null;
}
