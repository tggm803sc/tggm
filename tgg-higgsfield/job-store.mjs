import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT=path.resolve(process.env.TGG_HIGGSFIELD_ROOT||'/data/tgg-higgsfield');
const JOBS=path.join(ROOT,'jobs');

async function syncDir(dir){
  let handle;
  try{
    handle=await fs.open(dir,'r');
    await handle.sync();
  }catch(error){
    if(!['EINVAL','ENOTSUP','EISDIR'].includes(String(error?.code||'')))throw error;
  }finally{
    await handle?.close().catch(()=>{});
  }
}
async function durableWrite(file,value){
  const dir=path.dirname(file);
  await fs.mkdir(dir,{recursive:true});
  const tmp=file+'.tmp-'+process.pid+'-'+Date.now();
  const handle=await fs.open(tmp,'w',0o600);
  try{
    await handle.writeFile(JSON.stringify(value,null,2)+'\n','utf8');
    await handle.sync();
  }finally{
    await handle.close();
  }
  await fs.rename(tmp,file);
  await syncDir(dir);
}
function validId(id){
  if(!/^tgg-hf-[A-Za-z0-9-]+$/.test(String(id||'')))throw new Error('invalid_job_id');
  return String(id);
}
function normalizeStatus(value){
  const status=String(value||'queued');
  if(!['queued','running','completed','failed','cancelled'].includes(status))throw new Error('invalid_job_status');
  return status;
}
export async function init(){await fs.mkdir(JOBS,{recursive:true})}

export async function createJob(input={}){
  await init();
  const id='tgg-hf-'+Date.now()+'-'+crypto.randomBytes(5).toString('hex');
  const job={
    id,
    owner:'TGG',
    service:'tgg-higgsfield',
    mode:String(input.mode||'image'),
    prompt:String(input.prompt||'').slice(0,12000),
    negative_prompt:String(input.negative_prompt||'').slice(0,12000),
    source_image:input.source_image||null,
    source_video:input.source_video||null,
    preset:String(input.preset||'tgg-cinematic-world'),
    preset_profile:input.preset_profile&&typeof input.preset_profile==='object'?input.preset_profile:null,
    render_spec:input.render_spec&&typeof input.render_spec==='object'?input.render_spec:{},
    reference_assets:Array.isArray(input.reference_assets)?input.reference_assets.slice(0,24):[],
    recipe:input.recipe&&typeof input.recipe==='object'?input.recipe:null,
    project_context:input.project_context&&typeof input.project_context==='object'?input.project_context:null,
    project_id:input.project_id?String(input.project_id):null,
    source_repo:input.source_repo?String(input.source_repo):null,
    source_branch:input.source_branch?String(input.source_branch):null,
    source_sha:input.source_sha?String(input.source_sha):null,
    status:'queued',
    progress:0,
    output:[],
    error:null,
    engine:'tgg-creative-engine',
    external_provider_required:false,
    created_at:new Date().toISOString(),
    updated_at:new Date().toISOString(),
    started_at:null,
    completed_at:null
  };
  if(!job.prompt&& !job.source_image && !job.source_video)throw new Error('prompt_or_source_required');
  await durableWrite(path.join(JOBS,id+'.json'),job);
  return job;
}

export async function getJob(id){
  id=validId(id);
  try{return JSON.parse(await fs.readFile(path.join(JOBS,id+'.json'),'utf8'))}
  catch{throw new Error('job_not_found')}
}

export async function updateJob(id,input={}){
  const job=await getJob(id);
  if(input.status!==undefined){
    const next=normalizeStatus(input.status);
    const terminal=['completed','failed','cancelled'].includes(job.status);
    if(terminal&&next!==job.status)throw new Error('job_already_terminal');
    job.status=next;
    if(next==='running'&&!job.started_at)job.started_at=new Date().toISOString();
    if(['completed','failed','cancelled'].includes(next)&&!job.completed_at)job.completed_at=new Date().toISOString();
  }
  if(input.progress!==undefined){
    const progress=Math.max(0,Math.min(100,Number(input.progress)||0));
    job.progress=progress;
  }
  if(Array.isArray(input.output))job.output=input.output.slice(0,100);
  if(input.error!==undefined)job.error=input.error===null?null:String(input.error).slice(0,20000);
  if(input.render_spec&&typeof input.render_spec==='object')job.render_spec={...(job.render_spec||{}),...input.render_spec};
  if(Array.isArray(input.reference_assets))job.reference_assets=input.reference_assets.slice(0,24);
  if(input.recipe&&typeof input.recipe==='object')job.recipe={...(job.recipe||{}),...input.recipe};
  if(input.metadata&&typeof input.metadata==='object')job.metadata={...(job.metadata||{}),...input.metadata};
  job.updated_at=new Date().toISOString();
  await durableWrite(path.join(JOBS,job.id+'.json'),job);
  return job;
}

export async function cancelJob(id){
  const job=await getJob(id);
  if(['completed','failed','cancelled'].includes(job.status))return job;
  return updateJob(id,{status:'cancelled'});
}

export async function retryJob(id){
  const prior=await getJob(id);
  if(!['failed','cancelled'].includes(prior.status))throw new Error('job_not_retryable');
  return createJob({
    mode:prior.mode,
    prompt:prior.prompt,
    negative_prompt:prior.negative_prompt,
    source_image:prior.source_image,
    source_video:prior.source_video,
    preset:prior.preset,
    preset_profile:prior.preset_profile,
    render_spec:prior.render_spec,
    reference_assets:prior.reference_assets,
    recipe:prior.recipe,
    project_context:prior.project_context,
    project_id:prior.project_id,
    source_repo:prior.source_repo,
    source_branch:prior.source_branch,
    source_sha:prior.source_sha
  });
}

export async function listJobs({status=null,project_id=null,limit=100}={}){
  await init();
  const max=Math.max(1,Math.min(500,Number(limit)||100));
  const names=(await fs.readdir(JOBS)).filter(x=>x.endsWith('.json')).sort().reverse();
  const out=[];
  for(const name of names){
    if(out.length>=max)break;
    try{
      const job=JSON.parse(await fs.readFile(path.join(JOBS,name),'utf8'));
      if(status&&job.status!==status)continue;
      if(project_id&&job.project_id!==project_id)continue;
      out.push(job);
    }catch{}
  }
  return out;
}
