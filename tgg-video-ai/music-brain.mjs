import {normalizeMediaAsset,normalizeMusicAnalysis} from './contracts.mjs';

const CONFIDENCE_THRESHOLD=0.6;
function finite(v){const n=Number(v);return Number.isFinite(n)?n:null;}
function markers(values,durationMs){
  return [...new Set((Array.isArray(values)?values:[]).map(finite).filter(v=>v!==null&&v>=0&&v<=durationMs))].sort((a,b)=>a-b);
}
function sections(values,durationMs){
  return (Array.isArray(values)?values:[]).map((s,i)=>({
    ...structuredClone(s),
    type:String(s.type||`section-${i+1}`),
    startMs:Math.max(0,Math.min(durationMs,Number(s.startMs)||0)),
    endMs:Math.max(0,Math.min(durationMs,Number(s.endMs)||0))
  })).filter(s=>s.endMs>s.startMs).sort((a,b)=>a.startMs-b.startMs||a.endMs-b.endMs);
}

export function analyzeMusic(assetInput,rawSignals={}){
  let asset;
  try{asset=normalizeMediaAsset(assetInput);}catch{throw new Error('music_asset_invalid');}
  if(asset.durationMs<=0)throw new Error('music_asset_invalid');
  const confidence=Math.max(0,Math.min(1,Number(rawSignals.confidence)||0));
  const beatMode=confidence>=CONFIDENCE_THRESHOLD && Array.isArray(rawSignals.beats) && rawSignals.beats.length>0;
  const beats=beatMode?markers(rawSignals.beats,asset.durationMs):[];
  const downbeats=beatMode?markers(rawSignals.downbeats,asset.durationMs):[];
  return normalizeMusicAnalysis({
    id:`music-analysis-${asset.id}-v${asset.version}`,
    projectId:asset.projectId,
    assetId:asset.id,
    version:asset.version,
    bpm:beatMode&&Number(rawSignals.bpm)>0?Number(rawSignals.bpm):null,
    beats,
    downbeats,
    sections:sections(rawSignals.sections,asset.durationMs),
    energyCurve:Array.isArray(rawSignals.energyCurve)?structuredClone(rawSignals.energyCurve):[],
    confidence,
    timingMode:beatMode&&beats.length?'beat':'scene',
    engineVersion:'tgg-video-ai-music-v1'
  });
}
