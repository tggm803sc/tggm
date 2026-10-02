#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const src=await fs.readFile(new URL('../deployment/tgg-video-ai-live-proof.sh',import.meta.url),'utf8');
for(const marker of ['BUILD_SHA_MISMATCH','/analyze','/plans','/apply','/renders','/v1/jobs/','ffprobe','BACKEND_LIVE_PROOF_PASS_BROWSER_STUDIO_PROOF_STILL_REQUIRED']){
  assert.equal(src.includes(marker),true,'missing '+marker);
}
console.log(JSON.stringify({schema:'tgg.video-ai.live-proof.static.test.v1',status:'PASS'},null,2));
