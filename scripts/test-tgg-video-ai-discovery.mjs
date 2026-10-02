#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const src=await fs.readFile(new URL('../tgg-video-ai/server.mjs',import.meta.url),'utf8');
for(const marker of ['/.well-known/tgg-video-ai.json','/openapi.json','tgg.video-ai.discovery.v1','media-upload','ffmpeg-render','/v1/outputs/{assetId}']){
  assert.equal(src.includes(marker),true,'missing '+marker);
}
console.log(JSON.stringify({schema:'tgg.video-ai.discovery.test.v1',status:'PASS'},null,2));
