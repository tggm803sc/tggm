#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const cfg=await fs.readFile(new URL('../tgg-app/next.config.mjs',import.meta.url),'utf8');
const page=await fs.readFile(new URL('../tgg-app/src/app/video-studio/page.tsx',import.meta.url),'utf8');
const compose=await fs.readFile(new URL('../deployment/DockerComposeTopology.yml',import.meta.url),'utf8');
assert.equal(cfg.includes("source: '/video-ai/:path*'"),true);
assert.equal(cfg.includes("http://video-ai:10050"),true);
assert.equal(page.includes("const baseUrl = '/video-ai'"),true);
assert.equal(compose.includes("TGG_VIDEO_AI_PUBLIC_BASE_URL: ${TGG_VIDEO_AI_PUBLIC_BASE_URL:-/video-ai}"),true);
assert.equal(compose.includes("TGG_VIDEO_AI_INTERNAL_URL: ${TGG_VIDEO_AI_INTERNAL_URL:-http://video-ai:10050}"),true);
console.log(JSON.stringify({schema:'tgg.video-ai.same-origin.test.v1',status:'PASS'},null,2));
