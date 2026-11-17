import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { corsHeaders } from '@/lib/world/cors';

export const dynamic = 'force-dynamic';

const baseHeaders = { 'cache-control': 'no-store' };
const headersFor = (request: NextRequest) => ({ ...baseHeaders, ...corsHeaders(request) });

/**
 * Health for the world-save backend. Unlike /api/health (which describes the
 * service graph), this actually round-trips a query so "up" means "the save
 * table can be read", not "the process started".
 */
export async function GET(request: NextRequest) {
  const headers = headersFor(request);
  const started = Date.now();
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json(
      { ok: true, database: 'up', latencyMs: Date.now() - started },
      { headers },
    );
  } catch {
    return NextResponse.json(
      { ok: false, database: 'down', latencyMs: Date.now() - started },
      { status: 503, headers },
    );
  }
}

// Browsers preflight a cross-origin JSON request before the real one.
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: headersFor(request) });
}
