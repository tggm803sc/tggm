#!/usr/bin/env node
import assert from 'node:assert/strict';
import {analyzeMedia,rankHighlights} from '../tgg-video-ai/media-brain.mjs';
import {analyzeMusic} from '../tgg-video-ai/music-brain.mjs';

const asset={id:'vid1',projectId:'p1',durationMs:10000,type:'video',version:1};
const media=analyzeMedia(asset,{
  shots:[
    {id:'s2',startMs:5000,endMs:11000,score:0.8,motion:0.7},
    {id:'s1',startMs:-50,endMs:3000,score:0.9,motion:0.5},
    {id:'s3',startMs:3000,endMs:5000,score:0.95,motion:0.9}
  ],
  qualityFlags:[{startMs:3000,endMs:5000,type:'unusable'}],
  speechRanges:[{startMs:1000,endMs:2000}]
});
assert.deepEqual(media.shots.map(s=>[s.id,s.startMs,s.endMs]),[['s1',0,3000],['s3',3000,5000],['s2',5000,10000]]);
assert.equal(media.highlights.some(h=>h.shotId==='s3'),false);
assert.equal(media.highlights[0].shotId,'s1');
let invalid=false;
try{analyzeMedia({...asset,id:'bad',durationMs:0},{});}catch(error){invalid=String(error.message).includes('media_asset_invalid');}
assert.equal(invalid,true);
const weak=analyzeMusic({id:'song1',projectId:'p1',durationMs:60000,type:'audio',version:1},{confidence:0.2,beats:[],downbeats:[]});
assert.equal(weak.timingMode,'scene');
assert.deepEqual(weak.beats,[]);
const strong=analyzeMusic({id:'song2',projectId:'p1',durationMs:60000,type:'audio',version:1},{confidence:0.95,bpm:120,beats:[1000,500,500,1500,70000],downbeats:[1000,0,1000],sections:[{type:'verse',startMs:30000,endMs:45000},{type:'intro',startMs:-10,endMs:15000}]});
assert.equal(strong.timingMode,'beat');
assert.deepEqual(strong.beats,[500,1000,1500]);
assert.deepEqual(strong.downbeats,[0,1000]);
assert.deepEqual(strong.sections.map(s=>[s.type,s.startMs,s.endMs]),[['intro',0,15000],['verse',30000,45000]]);
const ranked=rankHighlights(media.shots,{speechRanges:media.speechRanges,qualityFlags:media.qualityFlags});
assert.equal(ranked[0].shotId,'s1');
assert.equal(ranked.some(h=>h.shotId==='s3'),false);
console.log(JSON.stringify({schema:'tgg.video-ai.analysis.test.v1',status:'PASS'},null,2));
