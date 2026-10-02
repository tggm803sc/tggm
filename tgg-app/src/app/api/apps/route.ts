import { NextResponse } from 'next/server';

const trim = (value: string) => value.replace(/\/$/, '');

export function GET() {
  const source = trim(process.env.TGG_SOURCE_URL ?? 'http://127.0.0.1:10030');
  const projects = trim(process.env.TGG_PROJECTS_URL ?? 'http://127.0.0.1:10020');
  const higgsfield = trim(process.env.TGG_HIGGSFIELD_URL ?? 'http://127.0.0.1:10040');
  const videoAi = trim(process.env.TGG_VIDEO_AI_PUBLIC_BASE_URL ?? 'http://127.0.0.1:10050');

  return NextResponse.json(
    {
      ok: true,
      owner: 'TGG',
      app: 'tgg-app',
      mode: 'owned-control-plane',
      primary_code_host: 'tgg-source',
      primary_save_ledger: 'tgg-projects',
      creative_engine: 'tgg-higgsfield',
      video_ai_engine: 'tgg-video-ai',
      legacy_bootstrap_source: 'github',
      services: [
        {
          id: 'tgg-source',
          name: 'TGG Source',
          base_url: source,
          discovery_url: source + '/.well-known/tgg-source.json',
          openapi_url: source + '/openapi.json',
          role: 'primary-code-host',
        },
        {
          id: 'tgg-projects',
          name: 'TGG Projects',
          base_url: projects,
          discovery_url: projects + '/.well-known/tgg-projects.json',
          openapi_url: projects + '/openapi.json',
          role: 'primary-save-ledger',
        },
        {
          id: 'tgg-higgsfield',
          name: 'TGG Higgsfield',
          base_url: higgsfield,
          discovery_url: higgsfield + '/.well-known/tgg-higgsfield.json',
          openapi_url: higgsfield + '/openapi.json',
          role: 'creative-generation',
        },
        {
          id: 'tgg-video-ai',
          name: 'TGG Video AI',
          base_url: videoAi,
          discovery_url: videoAi + '/.well-known/tgg-video-ai.json',
          openapi_url: videoAi + '/openapi.json',
          role: 'video-analysis-edit-render',
          studio_url: '/video-studio',
        },
      ],
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
