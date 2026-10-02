#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const src=await fs.readFile(new URL('../deployment/tgg-video-ai-host-bootstrap.sh',import.meta.url),'utf8');
for(const marker of ['TGG_VIDEO_AI_EXPECTED_SHA_REQUIRED','WORKTREE_SHA_MISMATCH','tgg-video-ai-cutover.sh','tgg-video-ai-live-proof.sh','HOST_BOOTSTRAP_PASS']){
  assert.equal(src.includes(marker),true,'missing '+marker);
}
console.log(JSON.stringify({schema:'tgg.video-ai.host-bootstrap.static.v1',status:'PASS'},null,2));
