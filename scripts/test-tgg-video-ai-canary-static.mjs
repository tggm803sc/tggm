#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const src=await fs.readFile(new URL('../release-ops/tgg-video-ai-v1-canary.sh',import.meta.url),'utf8');
for(const marker of [
  'WORKTREE_SHA_MISMATCH',
  'tgg-video-ai-canary',
  '18050',
  'build video-ai video-ai-worker',
  'tgg-video-ai-live-proof.sh',
  'CANARY_PASS_PRODUCTION_CUTOVER_STILL_REQUIRED'
]) assert.equal(src.includes(marker),true,'missing '+marker);
console.log(JSON.stringify({schema:'tgg.video-ai.canary.static.v1',status:'PASS'},null,2));
