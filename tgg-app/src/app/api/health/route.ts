import { NextResponse } from 'next/server';

export function GET() {
  return NextResponse.json(
    {
      ok: true,
      service: 'tgg-app',
      owner: 'TGG',
      source: 'tgg-source',
      projects: 'tgg-projects',
      higgsfield: 'tgg-higgsfield',
      database: 'postgresql-prisma',
    },
    {
      headers: {
        'cache-control': 'no-store',
        'x-tgg-owner': 'TGG',
        'x-tgg-service': 'tgg-app',
      },
    },
  );
}
