import {normalizeMediaAsset,normalizeMediaAnalysis} from './contracts.mjs';

function clamp(n,min,max){return Math.max(min,Math.min(max,Number(n)||0));}
function overlap(a,b){return Math.max(a.startMs,b.startMs)<Math.min(a.endMs,b.endMs);}
function normalizeRanges(ranges,durationMs){
  return (Array.isArray(ranges)?ranges:[]).map((r,i)=>({
    ...structuredClone(r),
    id:String(r.id||`range-${i+1}`),
    startMs:clamp(r.startMs,0,durationMs),
    endMs:clamp(r.endMs,0,durationMs)
  })).filter(r=>r.endMs>r.startMs).sort((a,b)=>a.startMs-b.startMs||a.endMs-b.endMs);
}
function normalizeShots(shots,durationMs){
  return (Array.isArray(shots)?shots:[]).map((s,i)=>({
    ...structuredClone(s),
    id:String(s.id||`shot-${i+1}`),
    startMs:clamp(s.startMs,0,durationMs),
    endMs:clamp(s.endMs,0,durationMs),
    score:clamp(s.score??0.5,0,1),
    motion:clamp(s.motion??0.5,0,1)
  })).filter(s=>s.endMs>s.startMs).sort((a,b)=>a.startMs-b.startMs||a.endMs-b.endMs);
}

export function rankHighlights(shots,{speechRanges=[],qualityFlags=[]}={}){
  const blocked=(Array.isArray(qualityFlags)?qualityFlags:[]).filter(f=>String(f.type||'').toLowerCase()==='unusable');
  return (Array.isArray(shots)?shots:[])
    .filter(shot=>!blocked.some(flag=>overlap(shot,flag)))
    .map(shot=>{
      const speechBoost=speechRanges.some(r=>overlap(shot,r))?0.05:0;
      const score=Math.max(0,Math.min(1,(Number(shot.score)||0.5)*0.8+(Number(shot.motion)||0.5)*0.15+speechBoost));
      return {shotId:shot.id,startMs:shot.startMs,endMs:shot.endMs,score:Number(score.toFixed(6))};
    })
    .sort((a,b)=>b.score-a.score||a.startMs-b.startMs);
}

export function analyzeMedia(assetInput,rawSignals={}){
  let asset;
  try{asset=normalizeMediaAsset(assetInput);}catch{throw new Error('media_asset_invalid');}
  if(asset.durationMs<=0)throw new Error('media_asset_invalid');
  const shots=normalizeShots(rawSignals.shots,asset.durationMs);
  const speechRanges=normalizeRanges(rawSignals.speechRanges,asset.durationMs);
  const silenceRanges=normalizeRanges(rawSignals.silenceRanges,asset.durationMs);
  const qualityFlags=normalizeRanges(rawSignals.qualityFlags,asset.durationMs);
  const fallbackShots=shots.length?shots:[{id:`${asset.id}-full`,startMs:0,endMs:asset.durationMs,score:0.5,motion:0.5}];
  return normalizeMediaAnalysis({
    id:`analysis-${asset.id}-v${asset.version}`,
    projectId:asset.projectId,
    assetId:asset.id,
    version:asset.version,
    durationMs:asset.durationMs,
    shots:fallbackShots,
    speechRanges,
    silenceRanges,
    qualityFlags,
    highlights:rankHighlights(fallbackShots,{speechRanges,qualityFlags}),
    engineVersion:'tgg-video-ai-media-v1'
  });
}
