import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!process.env.TGG_SERVER_SYNC_TOKEN || token !== process.env.TGG_SERVER_SYNC_TOKEN) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = await request.json() as { id?: string; name?: string; rating?: number; metadata?: object };
  if (!body.id || !body.name) {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
  }

  const clan = await db.tggClan.upsert({
    where: { id: body.id },
    update: { name: body.name, rating: body.rating ?? 1000, metadata: body.metadata },
    create: { id: body.id, name: body.name, rating: body.rating ?? 1000, metadata: body.metadata },
  });

  return NextResponse.json({ ok: true, clan });
}
