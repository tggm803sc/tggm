import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

function validSignature(raw: string, supplied: string | null) {
  const secret = process.env.TGG_STORE_WEBHOOK_SECRET;
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

  let body: { id?: string; playerId?: string; productId?: string; status?: string };
  try { body = JSON.parse(raw); } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  if (!body.id || !body.productId || !body.status) {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
  }

  const delivery = await db.tggDelivery.upsert({
    where: { externalId: body.id },
    update: { playerId: body.playerId, productId: body.productId, status: body.status, payload: body },
    create: { externalId: body.id, playerId: body.playerId, productId: body.productId, status: body.status, payload: body },
  });
  return NextResponse.json({ ok: true, deliveryId: delivery.id });
}
