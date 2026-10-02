#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const host=await fs.readFile(new URL('../release-ops/tgg-video-ai-collect-host-evidence.sh',import.meta.url),'utf8');
for(const marker of ['canary.json','bootstrap.json','health.json','HOST_BOOTSTRAP_PASS','CANARY_EVIDENCE_NOT_FOUND']){
  assert.equal(host.includes(marker),true,'missing '+marker);
}

const browser=await fs.readFile(new URL('../release-ops/tgg-video-ai-browser-proof.mjs',import.meta.url),'utf8');
assert.equal(browser.includes('TGG_VIDEO_AI_BROWSER_EVIDENCE'),true);
assert.equal(browser.includes('browser.json'),true);

console.log(JSON.stringify({schema:'tgg.video-ai.evidence-capture.static.v1',status:'PASS'},null,2));
