import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT=path.resolve(process.env.TGG_HIGGSFIELD_ROOT||'/data/tgg-higgsfield');
const JOBS=path.join(ROOT,'jobs');

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
    source_image:input.source_image||null,
    source_video:input.source_video||null,
    preset:input.preset||'cinematic',
    project_context:input.project_context||null,
    status:'queued',
    engine:'tgg-creative-engine',
    external_provider_required:false,
    created_at:new Date().toISOString()
  };
  await fs.writeFile(path.join(JOBS,id+'.json'),JSON.stringify(job,null,2)+'\n',{mode:0o600});
  return job;
}
export async function getJob(id){
  if(!/^tgg-hf-[A-Za-z0-9-]+$/.test(String(id||'')))throw new Error('invalid_job_id');
  try{return JSON.parse(await fs.readFile(path.join(JOBS,id+'.json'),'utf8'))}
  catch{throw new Error('job_not_found')}
}
export async function listJobs(){
  await init();
  const names=(await fs.readdir(JOBS)).filter(x=>x.endsWith('.json')).sort().reverse().slice(0,100);
  const out=[];for(const name of names){try{out.push(JSON.parse(await fs.readFile(path.join(JOBS,name),'utf8')))}catch{}}
  return out;
}
