import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  const playerId = request.cookies.get('tgg_player_id')?.value;
  if (!playerId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const deliveries = await db.tggDelivery.findMany({
    where: { playerId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return NextResponse.json({ deliveries });
}
