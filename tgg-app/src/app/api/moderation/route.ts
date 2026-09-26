import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!process.env.TGG_MODERATION_TOKEN || token !== process.env.TGG_MODERATION_TOKEN) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = await request.json() as {
    playerId?: string;
    action?: string;
    reason?: string;
    actor?: string;
    expiresAt?: string;
    metadata?: object;
  };
  if (!body.playerId || !body.action || !body.actor) {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
  }

  const action = await db.tggModerationAction.create({
    data: {
      playerId: body.playerId,
      action: body.action,
      reason: body.reason,
      actor: body.actor,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
      metadata: body.metadata,
    },
  });

  return NextResponse.json({ ok: true, actionId: action.id });
}
