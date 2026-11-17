import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { corsHeaders } from '@/lib/world/cors';
import { requirePlayer } from '@/lib/world/auth';
import { applyRun, parseRun, StoredSave } from '@/lib/world/save';

export const dynamic = 'force-dynamic';

const baseHeaders = { 'cache-control': 'no-store' };
const headersFor = (request: NextRequest) => ({ ...baseHeaders, ...corsHeaders(request) });

export async function POST(request: NextRequest) {
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

  const parsed = parseRun(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400, headers });
  }
  const run = parsed.value;

  try {
    const existingRun = await db.tggWorldRun.findUnique({
      where: { id: run.runId },
      select: { playerId: true, saveId: true },
    });

    if (existingRun) {
      if (existingRun.playerId !== player.id) {
        // Someone else's run id: refuse rather than reveal or reassign it.
        return NextResponse.json({ error: 'run_owned_by_another_player' }, { status: 409, headers });
      }
      // Same player retrying a POST it already delivered.
      return NextResponse.json({ ok: true, duplicate: true }, { headers });
    }

    const save =
      (await db.tggWorldSave.findUnique({ where: { playerId: player.id } })) ??
      (await db.tggWorldSave.create({
        data: { playerId: player.id, version: 2, revision: 1, runs: 0, career: {} },
      }));

    const stored: StoredSave = {
      version: save.version,
      revision: save.revision,
      bestRunMs: save.bestRunMs,
      runs: save.runs,
      career: (save.career ?? {}) as Record<string, unknown>,
      deviceId: save.deviceId,
    };
    const next = applyRun(stored, run);

    // The run row and the save counter move together or not at all.
    const [, updated] = await db.$transaction([
      db.tggWorldRun.create({
        data: {
          id: run.runId,
          saveId: save.id,
          playerId: player.id,
          totalMs: run.totalMs,
          legs: run.legs,
          deviceId: run.deviceId,
        },
      }),
      db.tggWorldSave.update({
        where: { playerId: player.id },
        data: {
          revision: next.revision,
          bestRunMs: next.bestRunMs,
          runs: next.runs,
          deviceId: run.deviceId ?? save.deviceId,
        },
      }),
    ]);

    return NextResponse.json(
      {
        ok: true,
        duplicate: false,
        save: {
          version: updated.version,
          revision: updated.revision,
          bestRunMs: updated.bestRunMs,
          runs: updated.runs,
          bestImproved: next.changed,
        },
      },
      { status: 201, headers },
    );
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') {
      // Lost a race with the same run id being inserted concurrently.
      return NextResponse.json({ ok: true, duplicate: true }, { headers });
    }
    return NextResponse.json({ error: 'database_unavailable' }, { status: 503, headers });
  }
}

export async function GET(request: NextRequest) {
  const headers = headersFor(request);
  const player = await requirePlayer(request);
  if (!player) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401, headers });
  }
  try {
    const runs = await db.tggWorldRun.findMany({
      where: { playerId: player.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, totalMs: true, legs: true, createdAt: true },
    });
    return NextResponse.json({ ok: true, runs }, { headers });
  } catch {
    return NextResponse.json({ error: 'database_unavailable' }, { status: 503, headers });
  }
}

// Browsers preflight a cross-origin JSON request before the real one.
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: headersFor(request) });
}
