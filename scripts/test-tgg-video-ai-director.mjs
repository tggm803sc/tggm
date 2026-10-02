#!/usr/bin/env node
import assert from 'node:assert/strict';
import {createEditPlan} from '../tgg-video-ai/director-brain.mjs';

const media=[{
  id:'analysis-vid1-v1',projectId:'p1',assetId:'vid1',version:1,durationMs:10000,
  shots:[{id:'s1',startMs:0,endMs:3000,score:0.95,motion:0.5},{id:'s2',startMs:3000,endMs:6000,score:0.8,motion:0.8},{id:'s3',startMs:6000,endMs:10000,score:0.7,motion:0.9}],
  highlights:[{shotId:'s1',startMs:0,endMs:3000,score:0.9},{shotId:'s2',startMs:3000,endMs:6000,score:0.8},{shotId:'s3',startMs:6000,endMs:10000,score:0.7}],
  speechRanges:[],silenceRanges:[],qualityFlags:[]
}];
const music={id:'music-a',projectId:'p1',assetId:'song1',version:1,bpm:120,beats:[0,500,1000,1500,2000,2500,3000,3500,4000,4500,5000,5500,6000,6500,7000,7500,8000,8500,9000,9500],downbeats:[0,2000,4000,6000,8000],sections:[],energyCurve:[],confidence:0.95,timingMode:'beat'};
const a=createEditPlan({projectId:'p1',mode:'music-video',directives:['auto-first-cut','beat-sync','clean-audio','smart-reframe','captions'],mediaAnalyses:media,musicAnalysis:music,canvas:{width:1920,height:1080}});
const b=createEditPlan({projectId:'p1',mode:'music-video',directives:['auto-first-cut','beat-sync','clean-audio','smart-reframe','captions'],mediaAnalyses:media,musicAnalysis:music,canvas:{width:1920,height:1080}});
assert.deepEqual(a.tracks,b.tracks);
assert.equal(a.tracks[0].clips.every(c=>c.startMs>=0&&c.endMs<=10000&&c.endMs>c.startMs),true);
assert.equal(a.tracks[0].clips.every(c=>music.beats.includes(c.timelineStartMs)),true);
assert.equal(a.audio.some(x=>x.type==='clean-audio'),true);
assert.equal(a.reframes.every(x=>x.sourceClipId),true);
assert.equal(a.captions.length>0,true);
const weak={...music,id:'music-b',timingMode:'scene',confidence:0.2,beats:[],downbeats:[]};
const scene=createEditPlan({projectId:'p1',mode:'music-video',directives:['auto-first-cut','beat-sync'],mediaAnalyses:media,musicAnalysis:weak});
assert.equal(scene.tracks[0].clips.some(c=>c.timelineStartMs===3000),true);
const reel=createEditPlan({projectId:'p1',mode:'reel',directives:['auto-first-cut'],mediaAnalyses:media});
const film=createEditPlan({projectId:'p1',mode:'film',directives:['auto-first-cut'],mediaAnalyses:media});
assert.notEqual(reel.tracks[0].clips[0].durationMs,film.tracks[0].clips[0].durationMs);
const missing=createEditPlan({projectId:'p1',mode:'music-video',directives:['auto-first-cut'],mediaAnalyses:[...media,{id:'bad-analysis',projectId:'p1',assetId:'vid-missing',version:1,durationMs:0,shots:[],highlights:[],qualityFlags:[],speechRanges:[],silenceRanges:[],error:'failed'}]});
assert.equal(missing.warnings.some(x=>String(x).includes('vid-missing')),true);
console.log(JSON.stringify({schema:'tgg.video-ai.director.test.v1',status:'PASS'},null,2));
