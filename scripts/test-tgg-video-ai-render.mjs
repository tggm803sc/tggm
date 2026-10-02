#!/usr/bin/env node
import assert from 'node:assert/strict';
import {createRenderManifest,createRenderJob,advanceRenderJob,verifyRenderOutput,hashRenderManifest} from '../tgg-video-ai/render-brain.mjs';
const timeline={id:'timeline-p1-v2',projectId:'p1',version:2,planId:'plan-1',tracks:[{id:'video-1',type:'video',clips:[{id:'c1',sourceAssetId:'vid1',sourceAssetVersion:3,startMs:0,endMs:2000,durationMs:2000,timelineStartMs:0,origin:'manual'}]}],captions:[],effects:[],transitions:[],reframes:[],audio:[],metadata:{}};
const assets=[{id:'vid1',version:3,durationMs:5000,type:'video',uri:'tgg://vid1'}];
const preset={width:1920,height:1080,fps:30,container:'mp4',codec:'h264'};
const m1=createRenderManifest({timeline,assets,preset}); const m2=createRenderManifest({timeline:structuredClone(timeline),assets:structuredClone(assets),preset:structuredClone(preset)});
assert.equal(m1.manifestHash,m2.manifestHash); assert.equal(hashRenderManifest(m1),m1.manifestHash); assert.equal(m1.payload.assets[0].version,3);
const changed=createRenderManifest({timeline:{...timeline,version:3,id:'timeline-p1-v3'},assets,preset}); assert.notEqual(changed.manifestHash,m1.manifestHash);
let missing=false; try{createRenderManifest({timeline:{...timeline,tracks:[{...timeline.tracks[0],clips:[{...timeline.tracks[0].clips[0],sourceAssetId:'nope'}]}]},assets,preset});}catch(e){missing=String(e.message).includes('render_asset_missing');} assert.equal(missing,true);
const job=createRenderJob({manifest:m1}); assert.equal(job.status,'queued'); const running=advanceRenderJob(job,{status:'running',progress:50}); assert.equal(running.status,'running');
for(const evidence of [null,{exists:false,readable:true,manifestHash:m1.manifestHash,metadata:{durationMs:2000,width:1920,height:1080,mimeType:'video/mp4'},assetId:'out1'},{exists:true,readable:false,manifestHash:m1.manifestHash,metadata:{durationMs:2000,width:1920,height:1080,mimeType:'video/mp4'},assetId:'out1'},{exists:true,readable:true,manifestHash:'wrong',metadata:{durationMs:2000,width:1920,height:1080,mimeType:'video/mp4'},assetId:'out1'},{exists:true,readable:true,manifestHash:m1.manifestHash,metadata:null,assetId:'out1'},{exists:true,readable:true,manifestHash:m1.manifestHash,metadata:{durationMs:99999,width:1920,height:1080,mimeType:'video/mp4'},assetId:'out1'}]){
  let rejected=false; try{verifyRenderOutput({job:running,manifest:m1,evidence});}catch{rejected=true;} assert.equal(rejected,true);
}
const output=verifyRenderOutput({job:running,manifest:m1,evidence:{exists:true,readable:true,manifestHash:m1.manifestHash,assetId:'out1',metadata:{durationMs:2000,width:1920,height:1080,mimeType:'video/mp4'}}});
assert.equal(output.assetId,'out1'); assert.equal(output.manifestHash,m1.manifestHash);
const succeeded=advanceRenderJob(running,{status:'succeeded',progress:100,output}); assert.equal(succeeded.status,'succeeded');
const retry=createRenderJob({manifest:m1,attempt:2}); assert.notEqual(retry.id,job.id); assert.equal(retry.manifestHash,job.manifestHash);
console.log(JSON.stringify({schema:'tgg.video-ai.render.test.v1',status:'PASS'},null,2));
