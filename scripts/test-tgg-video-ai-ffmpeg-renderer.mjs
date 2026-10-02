#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createEditPlan} from '../tgg-video-ai/director-brain.mjs';
import {applyEditPlan} from '../tgg-video-ai/timeline-adapter.mjs';
import {createRenderManifest,createRenderJob,verifyRenderOutput} from '../tgg-video-ai/render-brain.mjs';
import {executeFfmpegRender} from '../tgg-video-ai/ffmpeg-executor.mjs';

function make(bin,args){
  const r=spawnSync(bin,args,{encoding:'utf8'});
  assert.equal(r.status,0,r.stderr);
}
const root=await fs.mkdtemp(path.join(os.tmpdir(),'tgg-video-ai-real-render-'));
const a=path.join(root,'a.mp4'),b=path.join(root,'b.mp4'),music=path.join(root,'music.m4a');
make('ffmpeg',['-y','-f','lavfi','-i','color=c=red:s=320x180:d=1:r=24','-c:v','libx264','-pix_fmt','yuv420p',a]);
make('ffmpeg',['-y','-f','lavfi','-i','color=c=blue:s=320x180:d=1:r=24','-c:v','libx264','-pix_fmt','yuv420p',b]);
make('ffmpeg',['-y','-f','lavfi','-i','sine=frequency=440:duration=2','-c:a','aac',music]);

const media=[
  {id:'analysis-a',projectId:'p1',assetId:'a',version:1,durationMs:1000,shots:[{id:'a1',startMs:0,endMs:1000,score:.9,motion:.5}],highlights:[{shotId:'a1',startMs:0,endMs:1000,score:.9}],speechRanges:[],silenceRanges:[],qualityFlags:[]},
  {id:'analysis-b',projectId:'p1',assetId:'b',version:1,durationMs:1000,shots:[{id:'b1',startMs:0,endMs:1000,score:.8,motion:.5}],highlights:[{shotId:'b1',startMs:0,endMs:1000,score:.8}],speechRanges:[],silenceRanges:[],qualityFlags:[]}
];
const musicAnalysis={id:'music-analysis',projectId:'p1',assetId:'music',version:1,bpm:120,beats:[0,1000],downbeats:[0],sections:[],energyCurve:[],confidence:.95,timingMode:'beat'};
const plan=createEditPlan({projectId:'p1',mode:'music-video',directives:['auto-first-cut','beat-sync'],mediaAnalyses:media,musicAnalysis,canvas:{width:320,height:180}});
assert.equal(plan.audio.some(x=>x.type==='music-bed'&&x.sourceAssetId==='music'),true);
const timeline=applyEditPlan({plan});
const assets=[
  {id:'a',version:1,durationMs:1000,type:'video',uri:a},
  {id:'b',version:1,durationMs:1000,type:'video',uri:b},
  {id:'music',version:1,durationMs:2000,type:'audio',uri:music}
];
const manifest=createRenderManifest({timeline,assets,preset:{width:320,height:180,fps:24,container:'mp4',codec:'h264'}});
assert.equal(manifest.payload.assets.some(x=>x.id==='music'),true);
const evidence=await executeFfmpegRender({manifest,outputDir:root});
const job=createRenderJob({manifest});
const output=verifyRenderOutput({job,manifest,evidence});
assert.equal(output.mimeType,'video/mp4');
assert.equal(output.width,320);
assert.equal(output.height,180);
assert.ok(Math.abs(output.durationMs-2000)<=150,String(output.durationMs));
assert.ok(output.storagePath);
const probe=spawnSync('ffprobe',['-v','error','-select_streams','a','-show_entries','stream=codec_type','-of','csv=p=0',output.storagePath],{encoding:'utf8'});
assert.equal(probe.status,0,probe.stderr);
assert.equal(probe.stdout.trim(),'audio');
console.log(JSON.stringify({schema:'tgg.video-ai.ffmpeg-render.test.v1',status:'PASS',durationMs:output.durationMs},null,2));
