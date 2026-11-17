import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { corsHeaders } from '@/lib/world/cors';
import { requirePlayer } from '@/lib/world/auth';
import { applyClientSave, parseClientSave, StoredSave } from '@/lib/world/save';

export const dynamic = 'force-dynamic';

const baseHeaders = { 'cache-control': 'no-store' };
const headersFor = (request: NextRequest) => ({ ...baseHeaders, ...corsHeaders(request) });

function toStored(save: {
  version: number;
  revision: number;
  bestRunMs: number | null;
  runs: number;
  career: unknown;
  deviceId: string | null;
}): StoredSave {
  return {
    version: save.version,
    revision: save.revision,
    bestRunMs: save.bestRunMs,
    runs: save.runs,
    career: (save.career ?? {}) as Record<string, unknown>,
    deviceId: save.deviceId,
  };
}

function serialise(save: {
  version: number;
  revision: number;
  bestRunMs: number | null;
  runs: number;
  career: unknown;
  deviceId: string | null;
  updatedAt: Date;
}) {
  return {
    version: save.version,
    revision: save.revision,
    bestRunMs: save.bestRunMs,
    runs: save.runs,
    career: save.career ?? {},
    deviceId: save.deviceId,
    updatedAt: save.updatedAt.toISOString(),
  };
}

export async function GET(request: NextRequest) {
  const headers = headersFor(request);
  const player = await requirePlayer(request);
  if (!player) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401, headers });
  }

  try {
    const save = await db.tggWorldSave.findUnique({ where: { playerId: player.id } });
    return NextResponse.json({ ok: true, save: save ? serialise(save) : null }, { headers });
  } catch {
    return NextResponse.json({ error: 'database_unavailable' }, { status: 503, headers });
  }
}

export async function PUT(request: NextRequest) {
  const headers = headersFor(request);
  const player = await requirePlayer(request);
  if (!player) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401, headers });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400, headers });
  }

  const parsed = parseClientSave(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400, headers });
  }

  try {
    const existing = await db.tggWorldSave.findUnique({ where: { playerId: player.id } });

    if (!existing) {
      const created = await db.tggWorldSave.create({
        data: {
          playerId: player.id,
          version: parsed.value.version,
          revision: 1,
          bestRunMs: parsed.value.bestRunMs,
          runs: parsed.value.runs,
          career: parsed.value.career as Prisma.InputJsonValue,
          deviceId: parsed.value.deviceId,
        },
      });
      return NextResponse.json({ ok: true, save: serialise(created) }, { status: 201, headers });
    }

    const applied = applyClientSave(toStored(existing), parsed.value);
    if (applied.status === 'conflict') {
      // The caller is on an older revision: hand back the authoritative row so
      // it can reload instead of clobbering a fresher run.
      return NextResponse.json(
        { error: 'stale_revision', revision: existing.revision, save: serialise(existing) },
        { status: 409, headers },
      );
    }

    const updated = await db.tggWorldSave.update({
      where: { playerId: player.id },
      data: {
        version: applied.next.version,
        revision: applied.next.revision,
        bestRunMs: applied.next.bestRunMs,
        runs: applied.next.runs,
        career: applied.next.career as Prisma.InputJsonValue,
        deviceId: applied.next.deviceId,
      },
    });
    return NextResponse.json({ ok: true, save: serialise(updated) }, { headers });
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === 'P2002') {
      // Two tabs created the row at the same moment; the loser simply reloads.
      return NextResponse.json({ error: 'conflict_retry' }, { status: 409, headers });
    }
    return NextResponse.json({ error: 'database_unavailable' }, { status: 503, headers });
  }
}

// Browsers preflight a cross-origin JSON request before the real one.
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: headersFor(request) });
}
