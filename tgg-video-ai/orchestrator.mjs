import {normalizeMediaAsset} from './contracts.mjs';
import {analyzeMedia} from './media-brain.mjs';
import {analyzeMusic} from './music-brain.mjs';
import {createEditPlan} from './director-brain.mjs';
import {applyEditPlan} from './timeline-adapter.mjs';
import {createRenderManifest,createRenderJob,advanceRenderJob,verifyRenderOutput} from './render-brain.mjs';

async function safeCall(fn,payload){try{return fn?await fn(payload):null;}catch{return null;}}

export function createVideoAiOrchestrator({store,projectsClient=null,renderExecutor=null}={}){
  if(!store)throw new Error('video_ai_store_required');
  async function setState(projectId,state,extra={}){
    const value={projectId,state,updatedAt:new Date().toISOString(),...extra};
    await store.put('project-states',projectId,value);
    return value;
  }
  async function event(projectId,type,metadata={}){
    return safeCall(projectsClient?.postEvent?.bind(projectsClient),{project_id:projectId,type,source_service:'tgg-video-ai',metadata});
  }
  return {
    async analyzeProject(projectId,input={}){
      await setState(projectId,'analyzing-media');
      const assets=(input.assets||[]).map(normalizeMediaAsset);
      const mediaAnalyses=[]; let musicAnalysis=null;
      for(const asset of assets){
        await store.put('media-assets',asset.id,asset);
        if(asset.type==='audio'||asset.type==='music')continue;
        const analysis=analyzeMedia(asset,input.signals?.[asset.id]||{});
        await store.put('media-analyses',analysis.id,analysis); mediaAnalyses.push(analysis);
      }
      const music=assets.find(a=>a.type==='audio'||a.type==='music');
      if(music){
        await setState(projectId,'analyzing-music');
        musicAnalysis=analyzeMusic(music,input.signals?.[music.id]||{});
        await store.put('music-analyses',musicAnalysis.id,musicAnalysis);
      }
      await event(projectId,'video-ai-analyzed',{media_analysis_count:mediaAnalyses.length,music_analysis_id:musicAnalysis?.id||null});
      return {state:music?'analyzing-music':'analyzing-media',mediaAnalyses,musicAnalysis};
    },
    async planProject(projectId,input={}){
      await setState(projectId,'planning');
      const version=await store.nextVersion('edit-plans',projectId);
      const raw=createEditPlan({projectId,...input});
      const plan={...raw,id:`plan-${projectId}-${input.mode}-v${version}`,version};
      await store.put('edit-plans',plan.id,plan);
      await setState(projectId,'ready-to-preview',{planId:plan.id});
      await event(projectId,'video-ai-plan-ready',{plan_id:plan.id,version});
      return {state:'ready-to-preview',plan};
    },
    async applyPlan(projectId,planId,input={}){
      const plan=await store.get('edit-plans',planId);
      if(plan.projectId!==projectId)throw new Error('plan_project_mismatch');
      const prior=input.previousTimelineId?await store.get('timelines',input.previousTimelineId):null;
      const timeline=applyEditPlan({plan,previousTimeline:prior});
      const version=await store.nextVersion('timelines',projectId);
      const saved={...timeline,id:`timeline-${projectId}-v${version}`,version};
      await store.put('timelines',saved.id,saved);
      await setState(projectId,'applied-to-timeline',{planId,timelineVersion:version});
      await event(projectId,'video-ai-plan-applied',{plan_id:planId,timeline_version:version});
      return {state:'applied-to-timeline',timeline:saved};
    },
    async queueRender(projectId,timelineVersion,input={}){
      const timeline=await store.get('timelines',`timeline-${projectId}-v${timelineVersion}`);
      const manifest=createRenderManifest({timeline,assets:input.assets||[],preset:input.preset||{}});
      await store.put('render-manifests',manifest.id,manifest);
      const existing=await store.list('render-jobs',{projectId,limit:500});
      const attempt=existing.filter(j=>j.manifestHash===manifest.manifestHash).length+1;
      const job=createRenderJob({manifest,attempt});
      await store.put('render-jobs',job.id,job);
      await setState(projectId,'render-queued',{renderJobId:job.id,timelineVersion});
      await event(projectId,'video-ai-render-queued',{job_id:job.id,manifest_hash:manifest.manifestHash,timeline_version:timelineVersion});
      return {state:'render-queued',manifest,job};
    },
    async recoverPendingJobs(){
      const jobs=await store.list('render-jobs',{limit:500});
      const recovered=[];
      for(const job of jobs){
        if(job.status==='running'){
          const reset={...job,status:'queued',progress:0,error:'recovered_after_restart'};
          await store.put('render-jobs',job.id,reset); recovered.push(job.id);
        }else if(job.status==='queued')recovered.push(job.id);
      }
      return recovered;
    },
    async completeRenderJob(jobId,evidence){
      let job=await store.get('render-jobs',jobId);
      const manifests=await store.list('render-manifests',{projectId:job.projectId,limit:500});
      const manifest=manifests.find(m=>m.manifestHash===job.manifestHash);
      if(!manifest)throw new Error('render_manifest_not_found');
      if(job.status==='queued')job=advanceRenderJob(job,{status:'running',progress:99});
      const output=verifyRenderOutput({job,manifest,evidence});
      job=advanceRenderJob(job,{status:'succeeded',progress:100,output});
      await store.put('render-jobs',job.id,job);
      await store.put('render-outputs',output.assetId,output);
      await setState(job.projectId,'rendered',{renderJobId:job.id,timelineVersion:job.timelineVersion});
      await safeCall(projectsClient?.saveAsset?.bind(projectsClient),{project_id:job.projectId,type:'video-ai-render',source_service:'tgg-video-ai',source_id:job.id,status:'verified',outputs:[output],metadata:{manifest_hash:job.manifestHash,timeline_version:job.timelineVersion}});
      await event(job.projectId,'video-ai-render-verified',{job_id:job.id,manifest_hash:job.manifestHash,timeline_version:job.timelineVersion,asset_id:output.assetId});
      return {job,output};
    },
    async processQueuedJob(jobId){
      if(!renderExecutor)throw new Error('render_executor_unavailable');
      let job=await store.get('render-jobs',jobId);
      if(job.status!=='queued')return {job};
      job=advanceRenderJob(job,{status:'running',progress:1}); await store.put('render-jobs',job.id,job);
      const manifests=await store.list('render-manifests',{projectId:job.projectId,limit:500});
      const manifest=manifests.find(m=>m.manifestHash===job.manifestHash);
      try{return await this.completeRenderJob(job.id,await renderExecutor(manifest));}
      catch(error){
        const failed={...job,status:'failed',error:String(error?.message||error),progress:job.progress};
        await store.put('render-jobs',job.id,failed); await setState(job.projectId,'failed',{renderJobId:job.id,error:failed.error}); return {job:failed};
      }
    },
    async getState(projectId){try{return await store.get('project-states',projectId);}catch{return {projectId,state:'idle'};}},
    store
  };
}
