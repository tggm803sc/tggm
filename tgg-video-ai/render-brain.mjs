import crypto from 'node:crypto';
import {normalizeRenderManifest,normalizeRenderJob} from './contracts.mjs';

function canonical(value){
  if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`;
  if(value&&typeof value==='object')return `{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
function manifestBasis(manifest){return {projectId:manifest.projectId,timelineVersion:manifest.timelineVersion,payload:manifest.payload};}
export function hashRenderManifest(manifest){return crypto.createHash('sha256').update(canonical(manifestBasis(manifest))).digest('hex');}
function timelineDuration(timeline){
  let max=0;
  for(const track of timeline.tracks||[])for(const clip of track.clips||[]){
    const end=(Number(clip.timelineStartMs)||0)+(Number(clip.durationMs)||Math.max(0,(Number(clip.endMs)||0)-(Number(clip.startMs)||0)));
    max=Math.max(max,end);
  }
  return max;
}
export function createRenderManifest({timeline,assets,preset={}}={}){
  if(!timeline?.projectId||!Number.isInteger(Number(timeline.version))||Number(timeline.version)<1)throw new Error('render_timeline_invalid');
  const assetMap=new Map((Array.isArray(assets)?assets:[]).map(a=>[a.id,a]));
  const referenced=[];
  const seen=new Set();
  for(const track of timeline.tracks||[])for(const clip of track.clips||[]){
    const asset=assetMap.get(clip.sourceAssetId);
    if(!asset)throw new Error(`render_asset_missing:${clip.sourceAssetId}`);
    const requiredVersion=clip.sourceAssetVersion??asset.version;
    if(Number(requiredVersion)!==Number(asset.version))throw new Error(`render_asset_version_mismatch:${clip.sourceAssetId}`);
    if(!seen.has(asset.id)){
      referenced.push({id:asset.id,version:Number(asset.version)||1,durationMs:Number(asset.durationMs)||0,type:asset.type||null,uri:asset.uri||null});
      seen.add(asset.id);
    }
  }
  referenced.sort((a,b)=>a.id.localeCompare(b.id));
  const payload={timeline:structuredClone(timeline),assets:referenced,preset:{...structuredClone(preset)},expectedDurationMs:timelineDuration(timeline)};
  const draft={projectId:timeline.projectId,timelineVersion:Number(timeline.version),payload};
  const manifestHash=hashRenderManifest(draft);
  return normalizeRenderManifest({id:`render-manifest-${manifestHash.slice(0,16)}`,projectId:timeline.projectId,timelineVersion:Number(timeline.version),manifestHash,payload});
}
export function createRenderJob({manifest,attempt=1}={}){
  if(!manifest?.manifestHash)throw new Error('render_manifest_required');
  const n=Math.max(1,Number(attempt)||1);
  return normalizeRenderJob({id:`render-job-${manifest.manifestHash.slice(0,12)}-a${n}`,projectId:manifest.projectId,timelineVersion:manifest.timelineVersion,manifestHash:manifest.manifestHash,status:'queued',progress:0,output:null,error:null});
}
export function advanceRenderJob(job,{status,progress,error=null,output=null}={}){
  if(job.status==='succeeded'||job.status==='failed')throw new Error('render_job_terminal');
  if(status==='succeeded'&&!output)throw new Error('render_output_unverified');
  return normalizeRenderJob({...job,status,progress:progress??job.progress,error,output});
}
export function verifyRenderOutput({job,manifest,evidence,toleranceMs=500}={}){
  if(!job||!manifest||job.manifestHash!==manifest.manifestHash)throw new Error('render_manifest_job_mismatch');
  if(!evidence?.exists)throw new Error('render_output_missing');
  if(!evidence?.readable)throw new Error('render_output_unreadable');
  if(evidence.manifestHash!==manifest.manifestHash)throw new Error('render_output_manifest_mismatch');
  const metadata=evidence.metadata;
  if(!metadata||!Number.isFinite(Number(metadata.durationMs))||!Number(metadata.width)||!Number(metadata.height)||!metadata.mimeType)throw new Error('render_output_metadata_invalid');
  const expected=Number(manifest.payload?.expectedDurationMs)||0;
  if(expected&&Math.abs(Number(metadata.durationMs)-expected)>Math.max(Number(toleranceMs)||0,expected*0.02))throw new Error('render_output_duration_mismatch');
  if(!evidence.assetId)throw new Error('render_output_asset_missing');
  return {assetId:String(evidence.assetId),projectId:manifest.projectId,timelineVersion:manifest.timelineVersion,manifestHash:manifest.manifestHash,mimeType:String(metadata.mimeType),width:Number(metadata.width),height:Number(metadata.height),durationMs:Number(metadata.durationMs)};
}
