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
      apps: '/api/apps',
      primary_code_host: 'tgg-source',
      primary_save_ledger: 'tgg-projects',
      creative_engine: 'tgg-higgsfield',
      legacy_bootstrap_source: 'github',
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
