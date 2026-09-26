import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT=path.resolve(process.env.TGG_PROJECTS_ROOT||'/data/tgg-projects');
const SNAPSHOTS=path.join(ROOT,'snapshots');

async function durableWrite(file,value){
  await fs.mkdir(path.dirname(file),{recursive:true});
  const tmp=file+'.tmp-'+process.pid+'-'+Date.now();
  const h=await fs.open(tmp,'w',0o600);
  try{
    await h.writeFile(JSON.stringify(value,null,2)+'\n','utf8');
    await h.sync();
  }finally{
    await h.close();
  }
  await fs.rename(tmp,file);
  let d;
  try{d=await fs.open(path.dirname(file),'r');await d.sync();}catch(error){
    if(!['EINVAL','ENOTSUP','EISDIR'].includes(String(error?.code||'')))throw error;
  }finally{await d?.close().catch(()=>{});}
}

function cleanId(value,label='id'){
  const s=String(value||'').trim();
  if(!/^[A-Za-z0-9._-]{1,120}$/.test(s))throw new Error('invalid_'+label);
  return s;
}

export async function initSnapshots(){await fs.mkdir(SNAPSHOTS,{recursive:true});}

export async function createSnapshot(input={}){
  await initSnapshots();
  const project_id=cleanId(input.project_id||'tgg','project_id');
  const id='tgg-snap-'+Date.now()+'-'+crypto.randomBytes(5).toString('hex');
  const snapshot={
    id,
    owner:'TGG',
    service:'tgg-projects',
    project_id,
    repository:String(input.repository||'tggm803sc/tggm'),
    branch:input.branch?String(input.branch):null,
    sha:input.sha?String(input.sha):null,
    build:input.build?String(input.build):null,
    release:input.release?String(input.release):null,
    status:String(input.status||'saved'),
    title:String(input.title||'TGG project checkpoint').slice(0,240),
    notes:String(input.notes||'').slice(0,20000),
    metadata:input.metadata&&typeof input.metadata==='object'?input.metadata:{},
    created_at:new Date().toISOString()
  };
  await durableWrite(path.join(SNAPSHOTS,id+'.json'),snapshot);
  return snapshot;
}

export async function getSnapshot(id){
  id=cleanId(id,'snapshot_id');
  try{return JSON.parse(await fs.readFile(path.join(SNAPSHOTS,id+'.json'),'utf8'))}
  catch{throw new Error('snapshot_not_found')}
}

export async function listSnapshots({project_id=null,limit=100}={}){
  await initSnapshots();
  const max=Math.max(1,Math.min(500,Number(limit)||100));
  const files=(await fs.readdir(SNAPSHOTS)).filter(x=>x.endsWith('.json')).sort().reverse();
  const out=[];
  for(const file of files){
    if(out.length>=max)break;
    try{
      const row=JSON.parse(await fs.readFile(path.join(SNAPSHOTS,file),'utf8'));
      if(project_id&&row.project_id!==project_id)continue;
      out.push(row);
    }catch{}
  }
  return out;
}
