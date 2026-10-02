#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const page=await fs.readFile(new URL('../tgg-app/src/app/video-studio/VideoStudioClient.tsx',import.meta.url),'utf8');
for(const marker of ['TGG STUDIO','Auto first cut','Beat sync','Clean audio','Smart reframe','Media','Timeline','Render Center','Export project','Camera + Mic','Screen Record']){
  assert.equal(page.includes(marker),true,'missing '+marker);
}
for(const endpoint of ['/analyze','/plans','/apply','/renders','/v1/jobs/']){
  assert.equal(page.includes(endpoint),true,'missing endpoint '+endpoint);
}
assert.equal(page.includes('input ref={fileRef} multiple type="file"'),true);
assert.equal(page.includes('verified MP4'),true);
console.log(JSON.stringify({schema:'tgg.video-studio.route.test.v1',status:'PASS'},null,2));
