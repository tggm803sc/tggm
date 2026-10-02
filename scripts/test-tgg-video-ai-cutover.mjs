#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const src=await fs.readFile(new URL('../deployment/tgg-video-ai-cutover.sh',import.meta.url),'utf8');
for(const marker of ['TGG_PROD_ORIGIN_UNRESOLVED','docker compose','video-ai-worker','/.well-known/tgg-video-ai.json','/openapi.json','PENDING_BROWSER_AND_REAL_MEDIA_PROOF']){
  assert.equal(src.includes(marker),true,'missing '+marker);
}
assert.equal(src.includes('CUTOVER_READY'),true);
console.log(JSON.stringify({schema:'tgg.video-ai.cutover.test.v1',status:'PASS'},null,2));
