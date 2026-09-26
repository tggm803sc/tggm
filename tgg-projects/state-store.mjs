import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT=path.resolve(process.env.TGG_PROJECTS_ROOT||'/data/tgg-projects');
const SNAPSHOTS=path.join(ROOT,'snapshots');
const ASSETS=path.join(ROOT,'assets');
const EVENTS=path.join(ROOT,'events');
const MANIFESTS=path.join(ROOT,'save-manifests');
const LATEST_SAVE=path.join(ROOT,'latest-save.json');

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

export async function initSnapshots(){
  await fs.mkdir(SNAPSHOTS,{recursive:true});
  await fs.mkdir(ASSETS,{recursive:true});
  await fs.mkdir(EVENTS,{recursive:true});
  await fs.mkdir(MANIFESTS,{recursive:true});
}

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


export async function createAsset(input={}){
  await initSnapshots();
  const project_id=cleanId(input.project_id||'tgg','project_id');
  const type=cleanId(input.type||'asset','asset_type');
  const source_service=String(input.source_service||'tgg').slice(0,120);
  const source_id=input.source_id?String(input.source_id):null;

  let existing=null;
  if(source_id){
    const rows=await listAssets({project_id,limit:500});
    existing=rows.find(row=>row.source_service===source_service&&row.source_id===source_id)||null;
  }

  const id=existing?.id||('tgg-asset-'+Date.now()+'-'+crypto.randomBytes(5).toString('hex'));
  const asset={
    id,
    owner:'TGG',
    service:'tgg-projects',
    project_id,
    type,
    source_service,
    source_id,
    title:String(input.title||type).slice(0,240),
    status:String(input.status||'saved'),
    outputs:Array.isArray(input.outputs)?input.outputs.slice(0,100):[],
    metadata:{
      ...(existing?.metadata||{}),
      ...(input.metadata&&typeof input.metadata==='object'?input.metadata:{})
    },
    created_at:existing?.created_at||new Date().toISOString(),
    updated_at:new Date().toISOString()
  };
  await durableWrite(path.join(ASSETS,id+'.json'),asset);
  return asset;
}

export async function listAssets({project_id=null,type=null,limit=100}={}){
  await initSnapshots();
  const max=Math.max(1,Math.min(500,Number(limit)||100));
  const files=(await fs.readdir(ASSETS)).filter(x=>x.endsWith('.json')).sort().reverse();
  const out=[];
  for(const file of files){
    if(out.length>=max)break;
    try{
      const row=JSON.parse(await fs.readFile(path.join(ASSETS,file),'utf8'));
      if(project_id&&row.project_id!==project_id)continue;
      if(type&&row.type!==type)continue;
      out.push(row);
    }catch{}
  }
  return out;
}

export async function getAsset(id){
  id=cleanId(id,'asset_id');
  try{return JSON.parse(await fs.readFile(path.join(ASSETS,id+'.json'),'utf8'))}
  catch{throw new Error('asset_not_found')}
}


export async function recordEvent(input={}){
  await initSnapshots();
  const project_id=cleanId(input.project_id||'tgg','project_id');
  const type=cleanId(input.type||'event','event_type');
  const id='tgg-event-'+Date.now()+'-'+crypto.randomBytes(5).toString('hex');
  const event={
    id,
    owner:'TGG',
    service:'tgg-projects',
    project_id,
    type,
    source_service:String(input.source_service||'tgg').slice(0,120),
    source_id:input.source_id?String(input.source_id):null,
    repository:input.repository?String(input.repository):null,
    branch:input.branch?String(input.branch):null,
    sha:input.sha?String(input.sha):null,
    title:String(input.title||type).slice(0,240),
    status:String(input.status||'saved'),
    metadata:input.metadata&&typeof input.metadata==='object'?input.metadata:{},
    created_at:new Date().toISOString()
  };
  await durableWrite(path.join(EVENTS,id+'.json'),event);
  return event;
}

export async function listEvents({project_id=null,type=null,source_service=null,limit=100}={}){
  await initSnapshots();
  const max=Math.max(1,Math.min(1000,Number(limit)||100));
  const files=(await fs.readdir(EVENTS)).filter(x=>x.endsWith('.json')).sort().reverse();
  const out=[];
  for(const file of files){
    if(out.length>=max)break;
    try{
      const row=JSON.parse(await fs.readFile(path.join(EVENTS,file),'utf8'));
      if(project_id&&row.project_id!==project_id)continue;
      if(type&&row.type!==type)continue;
      if(source_service&&row.source_service!==source_service)continue;
      out.push(row);
    }catch{}
  }
  return out;
}


export async function createSaveManifest(input={}){
  await initSnapshots();
  const project_id=cleanId(input.project_id||'tgg','project_id');
  const id='tgg-save-'+Date.now()+'-'+crypto.randomBytes(5).toString('hex');
  const base={
    id,
    owner:'TGG',
    service:'tgg-projects',
    schema:'tgg.projects.save-manifest.v1',
    project_id,
    repository:String(input.repository||'tggm803sc/tggm'),
    snapshot_id:input.snapshot_id?String(input.snapshot_id):null,
    branch:input.branch?String(input.branch):null,
    sha:input.sha?String(input.sha):null,
    build:input.build?String(input.build):null,
    release:input.release?String(input.release):null,
    source_backups:Array.isArray(input.source_backups)?input.source_backups:[],
    saved_assets:Array.isArray(input.saved_assets)?input.saved_assets:[],
    higgsfield_jobs:Array.isArray(input.higgsfield_jobs)?input.higgsfield_jobs:[],
    ci:input.ci&&typeof input.ci==='object'?input.ci:{},
    metadata:input.metadata&&typeof input.metadata==='object'?input.metadata:{},
    created_at:new Date().toISOString()
  };
  const canonical=JSON.stringify(base);
  const manifest={
    ...base,
    manifest_sha256:crypto.createHash('sha256').update(canonical).digest('hex')
  };
  await durableWrite(path.join(MANIFESTS,id+'.json'),manifest);
  await durableWrite(LATEST_SAVE,{
    owner:'TGG',
    service:'tgg-projects',
    manifest_id:id,
    manifest_sha256:manifest.manifest_sha256,
    snapshot_id:manifest.snapshot_id,
    project_id,
    repository:manifest.repository,
    created_at:manifest.created_at
  });
  return manifest;
}

export async function getSaveManifest(id){
  id=cleanId(id,'save_manifest_id');
  try{return JSON.parse(await fs.readFile(path.join(MANIFESTS,id+'.json'),'utf8'))}
  catch{throw new Error('save_manifest_not_found')}
}

export async function listSaveManifests({project_id=null,limit=100}={}){
  await initSnapshots();
  const max=Math.max(1,Math.min(500,Number(limit)||100));
  const files=(await fs.readdir(MANIFESTS)).filter(x=>x.endsWith('.json')).sort().reverse();
  const out=[];
  for(const file of files){
    if(out.length>=max)break;
    try{
      const row=JSON.parse(await fs.readFile(path.join(MANIFESTS,file),'utf8'));
      if(project_id&&row.project_id!==project_id)continue;
      out.push(row);
    }catch{}
  }
  return out;
}

export async function getLatestSave(){
  try{
    const pointer=JSON.parse(await fs.readFile(LATEST_SAVE,'utf8'));
    const manifest=pointer?.manifest_id?await getSaveManifest(pointer.manifest_id):null;
    return {pointer,manifest};
  }catch{
    return {pointer:null,manifest:null};
  }
}
