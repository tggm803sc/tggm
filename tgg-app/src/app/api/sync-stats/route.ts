import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

function validSignature(raw: string, supplied: string | null) {
  const secret = process.env.TGG_STATS_INGRESS_SECRET;
  if (!secret || !supplied) return false;
  const expected = createHmac('sha256', secret).update(raw).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(supplied.replace(/^sha256=/, ''));
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  const raw = await request.text();
  if (!validSignature(raw, request.headers.get('x-tgg-signature'))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: { playerId?: string; stats?: object };
  try { body = JSON.parse(raw); } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  if (!body.playerId || !body.stats) {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
  }

  const event = await db.tggTelemetryEvent.create({
    data: { playerId: body.playerId, eventType: 'stats.sync', payload: body.stats },
  });
  return NextResponse.json({ ok: true, eventId: event.id });
}
