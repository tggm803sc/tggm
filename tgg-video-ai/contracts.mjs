const EDIT_MODES=new Set(['music-video','reel','highlight','film','episode','animation','social']);
const RENDER_STATUSES=new Set(['queued','running','succeeded','failed']);

function text(value,name){
  const out=String(value??'').trim();
  if(!out)throw new Error(`invalid_${name}`);
  return out;
}
function int(value,name,{min=0}={}){
  const n=Number(value);
  if(!Number.isInteger(n)||n<min)throw new Error(`invalid_${name}`);
  return n;
}
function num(value,name,{min=0,max=Infinity}={}){
  const n=Number(value);
  if(!Number.isFinite(n)||n<min||n>max)throw new Error(`invalid_${name}`);
  return n;
}
function array(value){return Array.isArray(value)?structuredClone(value):[]}
function object(value){return value&&typeof value==='object'&&!Array.isArray(value)?structuredClone(value):{}}

export function normalizeMediaAsset(input={}){
  return {
    id:text(input.id,'id'),
    projectId:text(input.projectId,'project_id'),
    type:text(input.type||'video','asset_type'),
    version:int(input.version??1,'version',{min:1}),
    durationMs:int(input.durationMs,'duration'),
    uri:input.uri?String(input.uri):null,
    metadata:object(input.metadata)
  };
}

export function normalizeMediaAnalysis(input={}){
  return {
    id:text(input.id,'id'),
    projectId:text(input.projectId,'project_id'),
    assetId:text(input.assetId,'asset_id'),
    version:int(input.version??1,'version',{min:1}),
    durationMs:int(input.durationMs,'duration'),
    shots:array(input.shots),
    speechRanges:array(input.speechRanges),
    silenceRanges:array(input.silenceRanges),
    highlights:array(input.highlights),
    qualityFlags:array(input.qualityFlags),
    engineVersion:String(input.engineVersion||'tgg-video-ai-v1')
  };
}

export function normalizeMusicAnalysis(input={}){
  const confidence=num(input.confidence??0,'confidence',{min:0,max:1});
  return {
    id:text(input.id,'id'),
    projectId:text(input.projectId,'project_id'),
    assetId:text(input.assetId,'asset_id'),
    version:int(input.version??1,'version',{min:1}),
    bpm:input.bpm==null?null:num(input.bpm,'bpm',{min:1}),
    beats:array(input.beats),
    downbeats:array(input.downbeats),
    sections:array(input.sections),
    energyCurve:array(input.energyCurve),
    confidence,
    timingMode:input.timingMode==='beat'?'beat':'scene',
    engineVersion:String(input.engineVersion||'tgg-video-ai-v1')
  };
}

export function normalizeEditPlan(input={}){
  const mode=String(input.mode||'');
  if(!EDIT_MODES.has(mode))throw new Error('invalid_edit_mode');
  return {
    id:text(input.id,'id'),
    projectId:text(input.projectId,'project_id'),
    mode,
    version:int(input.version??1,'version',{min:1}),
    durationMs:int(input.durationMs??0,'duration'),
    tracks:array(input.tracks),
    captions:array(input.captions),
    effects:array(input.effects),
    transitions:array(input.transitions),
    reframes:array(input.reframes),
    audio:array(input.audio),
    sourceAnalyses:array(input.sourceAnalyses),
    warnings:array(input.warnings)
  };
}

export function normalizeTimelineVersion(input={}){
  return {
    id:text(input.id,'id'),
    projectId:text(input.projectId,'project_id'),
    version:int(input.version,'version',{min:1}),
    planId:input.planId?String(input.planId):null,
    tracks:array(input.tracks),
    captions:array(input.captions),
    effects:array(input.effects),
    transitions:array(input.transitions),
    reframes:array(input.reframes),
    audio:array(input.audio),
    metadata:object(input.metadata)
  };
}

export function normalizeRenderManifest(input={}){
  return {
    id:text(input.id,'id'),
    projectId:text(input.projectId,'project_id'),
    timelineVersion:int(input.timelineVersion,'timeline_version',{min:1}),
    manifestHash:text(input.manifestHash,'manifest_hash'),
    payload:object(input.payload)
  };
}

export function normalizeRenderJob(input={}){
  const status=String(input.status||'queued');
  if(!RENDER_STATUSES.has(status))throw new Error('invalid_render_status');
  return {
    id:text(input.id,'id'),
    projectId:text(input.projectId,'project_id'),
    timelineVersion:int(input.timelineVersion,'timeline_version',{min:1}),
    manifestHash:text(input.manifestHash,'manifest_hash'),
    status,
    progress:num(input.progress??0,'progress',{min:0,max:100}),
    output:input.output&&typeof input.output==='object'?structuredClone(input.output):null,
    error:input.error==null?null:String(input.error)
  };
}

export const VIDEO_AI_EDIT_MODES=Object.freeze([...EDIT_MODES]);
export const VIDEO_AI_RENDER_STATUSES=Object.freeze([...RENDER_STATUSES]);
