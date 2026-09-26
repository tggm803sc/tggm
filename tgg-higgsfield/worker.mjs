import {providerConfig,providerHealth,providerRequest} from './provider-router.mjs';
#!/usr/bin/env node
const HIGGS=String(process.env.TGG_HIGGSFIELD_URL||'http://127.0.0.1:10040').replace(/\/$/,'');
const INTERVAL=Math.max(1000,Number(process.env.TGG_HIGGSFIELD_WORKER_INTERVAL_MS||3000));
const POLL_INTERVAL=Math.max(500,Number(process.env.TGG_CREATIVE_ENGINE_POLL_MS||2000));
const JOB_TIMEOUT=Math.max(60000,Number(process.env.TGG_CREATIVE_ENGINE_JOB_TIMEOUT_MS||1800000));
const ONCE=process.argv.includes('--once');

async function request(base,pathname,options={}){
  const response=await fetch(base+pathname,{
    ...options,
    headers:{'content-type':'application/json',...(options.headers||{})},
    signal:AbortSignal.timeout(Number(process.env.TGG_CREATIVE_ENGINE_HTTP_TIMEOUT_MS||30000))
  });
  const text=await response.text();
  let data={};try{data=text?JSON.parse(text):{}}catch{}
  if(!response.ok||data?.ok===false)throw new Error(data?.error||('HTTP '+response.status+' '+pathname));
  return data;
}

async function patchJob(id,payload){
  return request(HIGGS,'/v1/jobs/'+encodeURIComponent(id),{
    method:'PATCH',
    body:JSON.stringify(payload)
  });
}

async function engineHealth(){
  const health=await providerHealth();
  return health?.ok===true;
}

function enginePayload(job){
  return {
    owner:'TGG',
    job_id:job.id,
    mode:job.mode,
    provider_model:job.provider_model||null,
    provider_profile:job.provider_profile||null,
    provider_route:job.provider_route||'tgg-creative-engine',
    prompt:job.prompt,
    negative_prompt:job.negative_prompt,
    source_image:job.source_image,
    source_video:job.source_video,
    preset:job.preset,
    preset_profile:job.preset_profile||null,
    render_spec:job.render_spec||{},
    reference_assets:job.reference_assets||[],
    recipe:job.recipe||null,
    project_context:job.project_context||null
  };
}

async function startEngineJob(job){
  const cfg=providerConfig();
  await patchJob(job.id,{status:'running',progress:5,metadata:{worker:'tgg-higgsfield-worker',provider_mode:cfg.mode,provider_backend_url:cfg.backend_url,engine_started_at:new Date().toISOString()}});
  const started=await providerRequest('/v1/render',{
    method:'POST',
    body:JSON.stringify(enginePayload(job))
  });
  const engineJobId=String(started?.job_id||started?.id||'').trim();
  if(!engineJobId&&started?.status!=='completed')throw new Error('creative_engine_job_id_missing');

  if(started?.status==='completed'){
    await patchJob(job.id,{
      status:'completed',
      progress:100,
      output:Array.isArray(started.output)?started.output:[],
      metadata:{engine_job_id:engineJobId||null,engine_completed_at:new Date().toISOString()}
    });
    return;
  }

  await patchJob(job.id,{progress:Math.max(5,Number(started?.progress)||5),metadata:{engine_job_id:engineJobId}});
  await followEngineJob(job.id,engineJobId);
}

async function followEngineJob(tggJobId,engineJobId){
  const deadline=Date.now()+JOB_TIMEOUT;
  let lastProgress=-1;
  while(Date.now()<deadline){
    const state=await providerRequest('/v1/jobs/'+encodeURIComponent(engineJobId));
    const status=String(state?.status||'running');
    const progress=Math.max(0,Math.min(100,Number(state?.progress)||0));

    if(progress!==lastProgress){
      lastProgress=progress;
      await patchJob(tggJobId,{
        progress,
        metadata:{engine_job_id:engineJobId,engine_status:status,engine_checked_at:new Date().toISOString()}
      });
    }

    if(status==='completed'){
      await patchJob(tggJobId,{
        status:'completed',
        progress:100,
        output:Array.isArray(state.output)?state.output:[],
        metadata:{engine_job_id:engineJobId,engine_status:'completed',engine_completed_at:new Date().toISOString()}
      });
      return;
    }
    if(status==='failed'||status==='cancelled'){
      await patchJob(tggJobId,{
        status:'failed',
        progress,
        error:String(state?.error||('creative_engine_'+status)),
        metadata:{engine_job_id:engineJobId,engine_status:status,engine_failed_at:new Date().toISOString()}
      });
      return;
    }
    await new Promise(resolve=>setTimeout(resolve,POLL_INTERVAL));
  }

  await patchJob(tggJobId,{
    status:'failed',
    error:'creative_engine_timeout',
    metadata:{engine_job_id:engineJobId,engine_status:'timeout',engine_failed_at:new Date().toISOString()}
  });
}

async function resumeRunningJobs(){
  const result=await request(HIGGS,'/v1/jobs?status=running&limit=100');
  for(const job of result.jobs||[]){
    const engineJobId=String(job?.metadata?.engine_job_id||'').trim();
    if(!engineJobId)continue;
    try{await followEngineJob(job.id,engineJobId)}
    catch(error){
      await patchJob(job.id,{status:'failed',error:String(error?.message||error),metadata:{worker_resume_failed:true}});
    }
  }
}

async function processQueued(){
  const result=await request(HIGGS,'/v1/jobs?status=queued&limit=20');
  for(const job of result.jobs||[]){
    try{await startEngineJob(job)}
    catch(error){
      await patchJob(job.id,{
        status:'failed',
        error:String(error?.message||error),
        metadata:{worker:'tgg-higgsfield-worker',provider_mode:providerConfig().mode,provider_backend_url:providerConfig().backend_url,worker_failed_at:new Date().toISOString()}
      }).catch(()=>{});
    }
  }
}

async function cycle(){
  if(!(await engineHealth())){
    const cfg=providerConfig();
    console.log(JSON.stringify({ok:false,service:'tgg-higgsfield-worker',provider_mode:cfg.mode,backend:cfg.backend_url,error:'provider_backend_offline'}));
    return false;
  }
  await resumeRunningJobs();
  await processQueued();
  const cfg=providerConfig();
  console.log(JSON.stringify({ok:true,service:'tgg-higgsfield-worker',provider_mode:cfg.mode,backend:cfg.backend_url,checked_at:new Date().toISOString()}));
  return true;
}

if(ONCE){
  const ok=await cycle();
  if(!ok)process.exitCode=2;
}else{
  for(;;){
    await cycle().catch(error=>console.error(JSON.stringify({ok:false,service:'tgg-higgsfield-worker',error:String(error?.message||error)})));
    await new Promise(resolve=>setTimeout(resolve,INTERVAL));
  }
}
