#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const sha='469518eff0fe1641f6889c5ff78c2f3c0df189c7';
const gatePath=new URL('../release-ops/tgg-video-ai-promotion-gate.mjs',import.meta.url).pathname;
const run=(root)=>spawnSync(process.execPath,[gatePath,root],{
  encoding:'utf8',
  env:{...process.env,TGG_VIDEO_AI_EXPECTED_SHA:sha}
});
const write=(root,name,obj)=>fs.writeFile(path.join(root,name),JSON.stringify(obj)+'\n');

const empty=await fs.mkdtemp(path.join(os.tmpdir(),'tgg-video-ai-promotion-empty-'));
let r=run(empty);
assert.equal(r.status,42);
let out=JSON.parse(r.stdout);
assert.equal(out.status,'HOLD');
assert.equal(out.promotion,'DO_NOT_MERGE');
for(const name of ['canary.json','bootstrap.json','browser.json','health.json']){
  assert.ok(out.failures.includes('evidence_missing:'+name));
}

const root=await fs.mkdtemp(path.join(os.tmpdir(),'tgg-video-ai-promotion-'));
await write(root,'canary.json',{status:'PASS',buildSha:sha});
await write(root,'bootstrap.json',{status:'HOST_BOOTSTRAP_PASS',sha});
await write(root,'health.json',{ok:true,buildSha:sha});
await write(root,'browser.json',{
  status:'PASS',
  promotion:'BROWSER_STUDIO_PROOF_PASS',
  expectedSha:sha,
  health:{buildSha:sha},
  checks:{health:true,exactSha:true,studioHttp:true,uiMarkers:true,mediaUpload:true,aiFirstCut:true,editableTimeline:true,renderComplete:true,outputVerified:true}
});

r=run(root);
assert.equal(r.status,0,r.stderr+r.stdout);
out=JSON.parse(r.stdout);
assert.equal(out.status,'PASS');
assert.equal(out.promotion,'PROMOTION_EVIDENCE_COMPLETE');

await write(root,'browser.json',{
  status:'PASS',
  promotion:'BROWSER_STUDIO_PROOF_PASS',
  expectedSha:sha,
  health:{buildSha:'0000000000000000000000000000000000000000'},
  checks:{health:true,exactSha:true,studioHttp:true,uiMarkers:true,mediaUpload:true,aiFirstCut:true,editableTimeline:true,renderComplete:true,outputVerified:true}
});
r=run(root);
assert.equal(r.status,42);
out=JSON.parse(r.stdout);
assert.equal(out.status,'HOLD');
assert.ok(out.failures.includes('browser_served_sha'));

console.log(JSON.stringify({schema:'tgg.video-ai.promotion-gate.test.v1',status:'PASS'},null,2));
