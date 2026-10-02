#!/usr/bin/env node
import assert from 'node:assert/strict';
import {applyEditPlan,markManualEdit,mergePlanSuggestions} from '../tgg-video-ai/timeline-adapter.mjs';
const plan={id:'plan-p1-music-video-v1',projectId:'p1',mode:'music-video',version:1,durationMs:4000,tracks:[{id:'video-1',type:'video',clips:[{id:'plan-clip-1',sourceAssetId:'vid1',sourceShotId:'s1',startMs:0,endMs:2000,durationMs:2000,timelineStartMs:0,origin:'ai'},{id:'plan-clip-2',sourceAssetId:'vid1',sourceShotId:'s2',startMs:3000,endMs:5000,durationMs:2000,timelineStartMs:2000,origin:'ai'}]}],captions:[{id:'caption-1',sourceClipId:'plan-clip-1',type:'auto-caption',startMs:0,endMs:2000,text:'hello'}],effects:[{id:'fx-1',sourceClipId:'plan-clip-1',type:'look'}],transitions:[{id:'tr-1',fromClipId:'plan-clip-1',toClipId:'plan-clip-2',type:'fade'}],reframes:[{id:'rf-1',sourceClipId:'plan-clip-1',type:'smart-reframe'}],audio:[],sourceAnalyses:[],warnings:[]};
const t1=applyEditPlan({plan});
assert.equal(t1.version,1); assert.equal(t1.tracks[0].clips.length,2); assert.notEqual(t1.tracks[0].clips[0].id,t1.tracks[0].clips[1].id);
assert.equal(t1.tracks[0].clips[0].sourceAssetId,'vid1'); assert.equal(t1.tracks[0].clips[0].origin,'ai');
assert.equal(t1.captions[0].removable,true); assert.equal(t1.effects[0].removable,true); assert.equal(t1.transitions[0].removable,true); assert.equal(t1.reframes[0].removable,true);
const t2=markManualEdit(t1,{type:'update-clip',itemId:t1.tracks[0].clips[0].id,patch:{timelineStartMs:250}});
assert.equal(t2.version,2); assert.equal(t2.tracks[0].clips[0].origin,'manual'); assert.equal(t2.tracks[0].clips[0].timelineStartMs,250); assert.equal(t1.tracks[0].clips[0].timelineStartMs,0);
const nextPlan=structuredClone(plan); nextPlan.id='plan-p1-music-video-v2'; nextPlan.version=2; nextPlan.tracks[0].clips=[{id:'plan-clip-3',sourceAssetId:'vid2',sourceShotId:'x1',startMs:0,endMs:1000,durationMs:1000,timelineStartMs:0,origin:'ai'}];
const merged=mergePlanSuggestions({plan:nextPlan,timeline:t2,strategy:'replace-ai-only'});
assert.equal(merged.tracks[0].clips.some(c=>c.origin==='manual'&&c.sourceAssetId==='vid1'),true);
assert.equal(merged.tracks[0].clips.some(c=>c.origin==='ai'&&c.sourceAssetId==='vid2'),true);
assert.equal(merged.tracks[0].clips.some(c=>c.origin==='ai'&&c.sourceAssetId==='vid1'),false);
const selected=mergePlanSuggestions({plan,timeline:t2,strategy:'selected',selectedIds:['plan-clip-2']});
assert.equal(selected.tracks[0].clips.some(c=>c.planItemId==='plan-clip-2'),true);
assert.equal(selected.tracks[0].clips.some(c=>c.planItemId==='plan-clip-1'&&c.origin==='ai'),false);
console.log(JSON.stringify({schema:'tgg.video-ai.timeline.test.v1',status:'PASS'},null,2));
