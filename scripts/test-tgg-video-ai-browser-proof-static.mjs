#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const src=await fs.readFile(new URL('../release-ops/tgg-video-ai-browser-proof.mjs',import.meta.url),'utf8');
for(const marker of [
  '/video-ai/health',
  '/video-studio',
  'Auto first cut',
  'Export project',
  'Open verified MP4',
  'BUILD_SHA_MISMATCH',
  'BROWSER_STUDIO_PROOF_PASS'
]) assert.equal(src.includes(marker),true,'missing '+marker);
console.log(JSON.stringify({schema:'tgg.video-ai.browser-proof.static.v1',status:'PASS'},null,2));
