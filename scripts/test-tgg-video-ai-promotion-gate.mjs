#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const root=await fs.mkdtemp(path.join(os.tmpdir(),'tgg-video-ai-promotion-'));
const sha='469518eff0fe1641f6889c5ff78c2f3c0df189c7';
const write=(name,obj)=>fs.writeFile(path.join(root,name),JSON.stringify(obj)+'\n');

await write('canary.json',{status:'PASS',buildSha:sha});
await write('bootstrap.json',{status:'HOST_BOOTSTRAP_PASS',sha});
await write('health.json',{ok:true,buildSha:sha});
await write('browser.json',{
  status:'PASS',
  promotion:'BROWSER_STUDIO_PROOF_PASS',
  expectedSha:sha,
  health:{buildSha:sha},
  checks:{health:true,exactSha:true,studioHttp:true,uiMarkers:true,mediaUpload:true,aiFirstCut:true,editableTimeline:true,renderComplete:true,outputVerified:true}
});

let r=spawnSync(process.execPath,[new URL('../release-ops/tgg-video-ai-promotion-gate.mjs',import.meta.url).pathname,root],{
  encoding:'utf8',
  env:{...process.env,TGG_VIDEO_AI_EXPECTED_SHA:sha}
});
assert.equal(r.status,0,r.stderr+r.stdout);
let out=JSON.parse(r.stdout);
assert.equal(out.status,'PASS');
assert.equal(out.promotion,'PROMOTION_EVIDENCE_COMPLETE');

await write('browser.json',{
  status:'PASS',
  promotion:'BROWSER_STUDIO_PROOF_PASS',
  expectedSha:sha,
  health:{buildSha:'0000000000000000000000000000000000000000'},
  checks:{health:true,exactSha:true,studioHttp:true,uiMarkers:true,mediaUpload:true,aiFirstCut:true,editableTimeline:true,renderComplete:true,outputVerified:true}
});
r=spawnSync(process.execPath,[new URL('../release-ops/tgg-video-ai-promotion-gate.mjs',import.meta.url).pathname,root],{
  encoding:'utf8',
  env:{...process.env,TGG_VIDEO_AI_EXPECTED_SHA:sha}
});
assert.notEqual(r.status,0);
out=JSON.parse(r.stdout);
assert.equal(out.status,'HOLD');
assert.ok(out.failures.includes('browser_served_sha'));
console.log(JSON.stringify({schema:'tgg.video-ai.promotion-gate.test.v1',status:'PASS'},null,2));
