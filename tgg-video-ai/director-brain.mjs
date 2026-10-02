import {normalizeEditPlan} from './contracts.mjs';

const MODE_CLIP_MS={
  'music-video':2000,
  reel:900,
  highlight:1200,
  film:3000,
  episode:3500,
  animation:1800,
  social:1200
};
function safeArray(v){return Array.isArray(v)?v:[];}
function clipDuration(mode,sourceStart,sourceEnd){
  const target=MODE_CLIP_MS[mode]||2000;
  return Math.max(1,Math.min(target,Math.max(1,sourceEnd-sourceStart)));
}
function chooseCandidates(analysis){
  const byId=new Map(safeArray(analysis.shots).map(s=>[s.id,s]));
  const preferred=safeArray(analysis.highlights).map(h=>({...(byId.get(h.shotId)||{}),...h,id:h.shotId||h.id}));
  return (preferred.length?preferred:safeArray(analysis.shots)).filter(x=>Number(x.endMs)>Number(x.startMs));
}
function nextBeat(beats,at){
  for(const beat of beats)if(beat>=at)return beat;
  return null;
}

export function createEditPlan({projectId,mode,directives=[],mediaAnalyses=[],musicAnalysis=null,canvas=null}={}){
  const enabled=new Set(safeArray(directives));
  const warnings=[];
  const clips=[];
  let cursor=0;
  const beatMode=enabled.has('beat-sync')&&musicAnalysis?.timingMode==='beat'&&safeArray(musicAnalysis.beats).length>0;
  const beats=beatMode?safeArray(musicAnalysis.beats):[];
  for(const analysis of safeArray(mediaAnalyses)){
    if(!analysis||analysis.error||Number(analysis.durationMs)<=0){
      warnings.push(`analysis unavailable for ${analysis?.assetId||'unknown-asset'}`);
      continue;
    }
    const candidates=chooseCandidates(analysis);
    const analysisBase=cursor;
    const firstSourceStart=candidates.length?Math.max(0,Number(candidates[0].startMs)||0):0;
    for(const candidate of candidates){
      const sourceStart=Math.max(0,Number(candidate.startMs)||0);
      const sourceEnd=Math.min(Number(analysis.durationMs)||0,Number(candidate.endMs)||0);
      const durationMs=clipDuration(mode,sourceStart,sourceEnd);
      let timelineStartMs=analysisBase+(sourceStart-firstSourceStart);
      if(beatMode){
        const beat=nextBeat(beats,cursor);
        if(beat!==null)timelineStartMs=beat;
      }
      clips.push({
        id:`plan-clip-${clips.length+1}`,
        sourceAssetId:analysis.assetId,
        sourceShotId:String(candidate.id||candidate.shotId||`shot-${clips.length+1}`),
        startMs:sourceStart,
        endMs:sourceStart+durationMs,
        durationMs,
        timelineStartMs,
        origin:'ai'
      });
      cursor=Math.max(cursor,timelineStartMs+durationMs);
    }
  }
  const durationMs=clips.reduce((max,c)=>Math.max(max,c.timelineStartMs+c.durationMs),0);
  const audio=[];
  if(musicAnalysis?.assetId)audio.push({id:'music-bed-1',type:'music-bed',sourceAssetId:musicAnalysis.assetId,startMs:0,endMs:durationMs,gain:1});
  if(enabled.has('clean-audio'))audio.push({id:'audio-clean-1',type:'clean-audio',mode:'dialogue-preserve'});
  const reframes=enabled.has('smart-reframe')?clips.map(c=>({id:`reframe-${c.id}`,sourceClipId:c.id,type:'smart-reframe',canvas:canvas||null})):[];
  const captions=enabled.has('captions')?clips.map((c,i)=>({id:`caption-${i+1}`,sourceClipId:c.id,type:'auto-caption',startMs:c.timelineStartMs,endMs:c.timelineStartMs+c.durationMs,text:''})):[];
  const sourceAnalyses=safeArray(mediaAnalyses).filter(a=>a?.id).map(a=>a.id);
  if(musicAnalysis?.id)sourceAnalyses.push(musicAnalysis.id);
  return normalizeEditPlan({
    id:`plan-${projectId}-${mode}-v1`,
    projectId,
    mode,
    version:1,
    durationMs,
    tracks:[{id:'video-1',type:'video',clips}],
    captions,
    effects:[],
    transitions:[],
    reframes,
    audio,
    sourceAnalyses,
    warnings
  });
}
