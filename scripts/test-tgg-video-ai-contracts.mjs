#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {normalizeMediaAsset,normalizeEditPlan,normalizeRenderJob} from '../tgg-video-ai/contracts.mjs';
import {createStore} from '../tgg-video-ai/store.mjs';

function expectThrow(fn,code){
  let hit=false;
  try{fn();}catch(error){hit=String(error?.message||error).includes(code);}
  assert.equal(hit,true,`expected error containing ${code}`);
}
expectThrow(()=>normalizeMediaAsset({id:'asset-1',projectId:'p1',durationMs:-1,type:'video'}),'invalid_duration');
for(const mode of ['music-video','reel','highlight','film','episode','animation','social']){
  assert.equal(normalizeEditPlan({id:`plan-${mode}`,projectId:'p1',mode,version:1,durationMs:1000}).mode,mode);
}
expectThrow(()=>normalizeEditPlan({id:'bad',projectId:'p1',mode:'anything',version:1,durationMs:1}),'invalid_edit_mode');
for(const status of ['queued','running','succeeded','failed']){
  assert.equal(normalizeRenderJob({id:`job-${status}`,projectId:'p1',timelineVersion:1,manifestHash:'abc',status,progress:0}).status,status);
}
expectThrow(()=>normalizeRenderJob({id:'job-bad',projectId:'p1',timelineVersion:1,manifestHash:'abc',status:'completed',progress:0}),'invalid_render_status');
const root=await fs.mkdtemp(path.join(os.tmpdir(),'tgg-video-ai-store-'));
const storeA=createStore({root});
const value=normalizeMediaAsset({id:'asset-2',projectId:'p1',durationMs:2500,type:'video',version:1});
await storeA.put('media-assets',value.id,value);
const storeB=createStore({root});
assert.deepEqual(await storeB.get('media-assets',value.id),value);
assert.equal(await storeB.nextVersion('edit-plans','p1'),1);
await storeB.put('edit-plans','plan-1',normalizeEditPlan({id:'plan-1',projectId:'p1',mode:'music-video',version:1,durationMs:1000}));
assert.equal(await storeB.nextVersion('edit-plans','p1'),2);
console.log(JSON.stringify({schema:'tgg.video-ai.contracts.test.v1',status:'PASS'},null,2));
