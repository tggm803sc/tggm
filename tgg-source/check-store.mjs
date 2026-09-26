import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT=path.resolve(process.env.TGG_SOURCE_ROOT||'/data/tgg-source');
const META=path.join(ROOT,'meta');

function safeName(value,label='name'){
  const s=String(value||'').trim();
  if(!/^[A-Za-z0-9._-]{1,120}$/.test(s))throw new Error('invalid_'+label);
  return s;
}
function safeSha(value){
  const s=String(value||'').trim().toLowerCase();
  if(!/^[a-f0-9]{40}$/.test(s))throw new Error('invalid_sha');
  return s;
}
function checksDir(repo){return path.join(META,safeName(repo,'repo_name'),'checks')}

async function durableWrite(file,value){
  await fs.mkdir(path.dirname(file),{recursive:true});
  const tmp=file+'.tmp-'+process.pid+'-'+Date.now();
  const h=await fs.open(tmp,'w',0o600);
  try{await h.writeFile(JSON.stringify(value,null,2)+'\n','utf8');await h.sync()}
  finally{await h.close()}
  await fs.rename(tmp,file);
}

export async function createCheckRun(repo,input={}){
  const sha=safeSha(input.sha);
  const name=safeName(input.name||'tgg-ci','check_name');
  const status=String(input.status||'completed');
  if(!['queued','in_progress','completed'].includes(status))throw new Error('invalid_check_status');
  const conclusion=input.conclusion==null?null:String(input.conclusion);
  if(conclusion&&!['success','failure','neutral','cancelled','skipped','timed_out','action_required'].includes(conclusion)){
    throw new Error('invalid_check_conclusion');
  }
  const id='tgg-check-'+Date.now()+'-'+crypto.randomBytes(5).toString('hex');
  const row={
    id,
    owner:'TGG',
    service:'tgg-source',
    repo:safeName(repo,'repo_name'),
    sha,
    name,
    status,
    conclusion,
    details_url:input.details_url?String(input.details_url):null,
    summary:String(input.summary||'').slice(0,20000),
    created_at:new Date().toISOString(),
    completed_at:status==='completed'?new Date().toISOString():null
  };
  await durableWrite(path.join(checksDir(repo),sha,name+'-'+id+'.json'),row);
  return row;
}

export async function listCheckRuns(repo,{sha=null,limit=100}={}){
  const dir=checksDir(repo);
  const max=Math.max(1,Math.min(500,Number(limit)||100));
  const targetSha=sha?safeSha(sha):null;
  const roots=targetSha?[path.join(dir,targetSha)]:((await fs.readdir(dir,{withFileTypes:true}).catch(()=>[])).filter(x=>x.isDirectory()).map(x=>path.join(dir,x.name)));
  const out=[];
  for(const root of roots){
    for(const file of (await fs.readdir(root).catch(()=>[])).filter(x=>x.endsWith('.json')).sort().reverse()){
      if(out.length>=max)break;
      try{out.push(JSON.parse(await fs.readFile(path.join(root,file),'utf8')))}catch{}
    }
  }
  return out.sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))).slice(0,max);
}

export async function checksPass(repo,sha){
  const rows=await listCheckRuns(repo,{sha,limit:500});
  if(!rows.length)return false;
  const latestByName=new Map();
  for(const row of rows){
    if(!latestByName.has(row.name))latestByName.set(row.name,row);
  }
  return [...latestByName.values()].some(row=>row.status==='completed'&&row.conclusion==='success');
}
