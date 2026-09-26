import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {init,createJob,getJob,listJobs,updateJob,cancelJob,retryJob} from './job-store.mjs';

const ROOT=path.dirname(fileURLToPath(import.meta.url));
const PORT=Number(process.env.TGG_HIGGSFIELD_PORT||10040);
const HOST=process.env.TGG_HIGGSFIELD_HOST||'0.0.0.0';
const TGG_PROJECTS_URL=String(process.env.TGG_PROJECTS_URL||'http://127.0.0.1:10020').replace(/\/$/,'');

function higgsfieldAppManifest(){
  return {
    ok:true,
    owner:'TGG',
    app:'tgg-higgsfield',
    name:'TGG Higgsfield',
    engine:'tgg-creative-engine',
    external_provider_required:false,
    openapi:'/openapi.json',
    health:'/health',
    capabilities:[
      'image-jobs','video-jobs','project-context','progress','outputs',
      'cancel','retry','project-checkpoints','project-assets','project-events'
    ]
  };
}

function send(res,status,body){
  res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-tgg-owner':'TGG','x-tgg-service':'tgg-higgsfield'});
  res.end(JSON.stringify(body,null,2));
}
async function body(req){const chunks=[];for await(const c of req)chunks.push(c);return chunks.length?JSON.parse(Buffer.concat(chunks).toString('utf8')):{}}

async function projectsPost(pathname,payload){
  try{
    const response=await fetch(TGG_PROJECTS_URL+pathname,{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify(payload),
      signal:AbortSignal.timeout(5000)
    });
    const data=await response.json().catch(()=>({}));
    return response.ok?data:null;
  }catch{return null}
}

async function saveJobEvent(job,event,{status=null,metadata={}}={}){
  const projectId=job.project_id||'tgg-higgsfield';
  return projectsPost('/v1/events',{
    project_id:projectId,
    type:'higgsfield-'+event,
    source_service:'tgg-higgsfield',
    source_id:job.id,
    repository:job.source_repo||'tggm803sc/tggm',
    branch:job.source_branch||null,
    sha:job.source_sha||null,
    title:'TGG Higgsfield · '+job.mode+' · '+event,
    status:status||job.status||event,
    metadata:{
      job_id:job.id,
      mode:job.mode,
      preset:job.preset,
      progress:job.progress,
      output_count:Array.isArray(job.output)?job.output.length:0,
      engine:job.engine,
      project_context:job.project_context||null,
      ...metadata
    }
  });
}

async function checkpointJob(job,event){
  const projectId=encodeURIComponent(job.project_id||'tgg-higgsfield');
  return projectsPost('/v1/projects/'+projectId+'/snapshots',{
    repository:job.source_repo||'tggm803sc/tggm',
    branch:job.source_branch||null,
    sha:job.source_sha||null,
    build:job.project_context?.build||job.project_context?.world_build||null,
    status:'higgsfield-'+event,
    title:'TGG Higgsfield · '+job.mode+' · '+event,
    notes:String(job.prompt||'').slice(0,1000),
    metadata:{
      job_id:job.id,
      mode:job.mode,
      preset:job.preset,
      progress:job.progress,
      output_count:Array.isArray(job.output)?job.output.length:0,
      engine:job.engine,
      event
    }
  });
}

async function saveCompletedAsset(job){
  if(job.status!=='completed')return null;
  const projectId=encodeURIComponent(job.project_id||'tgg-higgsfield');
  return projectsPost('/v1/projects/'+projectId+'/assets',{
    type:'higgsfield-'+job.mode,
    source_service:'tgg-higgsfield',
    source_id:job.id,
    title:'TGG Higgsfield '+job.mode+' output',
    status:'saved',
    outputs:Array.isArray(job.output)?job.output:[],
    metadata:{
      preset:job.preset,
      prompt:job.prompt,
      negative_prompt:job.negative_prompt,
      source_repo:job.source_repo,
      source_branch:job.source_branch,
      source_sha:job.source_sha,
      project_context:job.project_context,
      completed_at:job.completed_at,
      engine:job.engine
    }
  });
}

await init();
http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost');
    if(req.method==='GET'&&url.pathname==='/health')return send(res,200,{ok:true,service:'tgg-higgsfield',owner:'TGG',external_provider_required:false});
    if(req.method==='GET'&&url.pathname==='/.well-known/tgg-higgsfield.json')return send(res,200,higgsfieldAppManifest());
    if(req.method==='GET'&&url.pathname==='/openapi.json')return send(res,200,JSON.parse(await fs.readFile(path.join(ROOT,'openapi.json'),'utf8')));
    if(req.method==='GET'&&url.pathname==='/v1/jobs')return send(res,200,{ok:true,jobs:await listJobs({
      status:url.searchParams.get('status')||null,
      project_id:url.searchParams.get('project_id')||null,
      limit:url.searchParams.get('limit')||100
    })});
    if(req.method==='POST'&&url.pathname==='/v1/jobs'){
      const job=await createJob(await body(req));
      const checkpoint=await checkpointJob(job,'queued');
      const event=await saveJobEvent(job,'queued');
      return send(res,202,{ok:true,job,project_saved:Boolean(checkpoint||event),snapshot:checkpoint?.snapshot||null,event:event?.event||null});
    }
    const m=url.pathname.match(/^\/v1\/jobs\/([^/]+)$/);
    if(req.method==='GET'&&m)return send(res,200,{ok:true,job:await getJob(decodeURIComponent(m[1]))});
    if(req.method==='PATCH'&&m){
      const job=await updateJob(decodeURIComponent(m[1]),await body(req));
      const checkpoint=await checkpointJob(job,job.status);
      const asset=await saveCompletedAsset(job);
      const event=await saveJobEvent(job,job.status,{metadata:{asset_id:asset?.asset?.id||null}});
      return send(res,200,{
        ok:true,
        job,
        project_saved:Boolean(checkpoint||asset||event),
        snapshot:checkpoint?.snapshot||null,
        asset:asset?.asset||null,
        event:event?.event||null
      });
    }
    const action=url.pathname.match(/^\/v1\/jobs\/([^/]+)\/(cancel|retry)$/);
    if(req.method==='POST'&&action){
      const id=decodeURIComponent(action[1]);
      if(action[2]==='cancel'){
        const job=await cancelJob(id);
        const checkpoint=await checkpointJob(job,'cancelled');
        const event=await saveJobEvent(job,'cancelled');
        return send(res,200,{ok:true,job,project_saved:Boolean(checkpoint||event),snapshot:checkpoint?.snapshot||null,event:event?.event||null});
      }
      const job=await retryJob(id);
      const checkpoint=await checkpointJob(job,'retry-queued');
      const event=await saveJobEvent(job,'retry-queued',{metadata:{retried_from:id}});
      return send(res,202,{ok:true,job,project_saved:Boolean(checkpoint||event),snapshot:checkpoint?.snapshot||null,event:event?.event||null});
    }
    send(res,404,{ok:false,error:'not_found'});
  }catch(error){
    const msg=String(error?.message||error);
    send(res,/not_found/.test(msg)?404:400,{ok:false,error:msg});
  }
}).listen(PORT,HOST,()=>console.log(JSON.stringify({ok:true,service:'tgg-higgsfield',port:PORT})));
