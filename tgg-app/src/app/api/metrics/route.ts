import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!process.env.TGG_METRICS_TOKEN || token !== process.env.TGG_METRICS_TOKEN) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = await request.json() as { name?: string; value?: number; labels?: object };
  if (!body.name || typeof body.value !== 'number' || !Number.isFinite(body.value)) {
    return NextResponse.json({ error: 'invalid_metric' }, { status: 400 });
  }

  const sample = await db.tggMetricSample.create({
    data: { name: body.name, value: body.value, labels: body.labels },
  });

  return NextResponse.json({ ok: true, sampleId: sample.id });
}
