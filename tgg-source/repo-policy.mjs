import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT=path.resolve(process.env.TGG_SOURCE_ROOT||'/data/tgg-source');
const META=path.join(ROOT,'meta');

function safeName(value,label='name'){
  const s=String(value||'').trim();
  if(!/^[A-Za-z0-9._-]{1,100}$/.test(s))throw new Error('invalid_'+label);
  return s;
}
function fileFor(repo){return path.join(META,safeName(repo,'repo_name'),'settings.json')}

async function durableWrite(file,value){
  await fs.mkdir(path.dirname(file),{recursive:true});
  const tmp=file+'.tmp-'+process.pid+'-'+Date.now();
  const h=await fs.open(tmp,'w',0o600);
  try{await h.writeFile(JSON.stringify(value,null,2)+'\n','utf8');await h.sync()}
  finally{await h.close()}
  await fs.rename(tmp,file);
}

export async function getRepoPolicy(repo){
  const name=safeName(repo,'repo_name');
  try{
    const data=JSON.parse(await fs.readFile(fileFor(name),'utf8'));
    return {
      repo:name,
      protected_branches:Array.isArray(data.protected_branches)?data.protected_branches.map(x=>safeName(x,'branch_name')):['main'],
      require_pull_request:data.require_pull_request!==false,
      require_checks:data.require_checks===true,
      allow_force_push:data.allow_force_push===true,
      updated_at:data.updated_at||null
    };
  }catch{
    return {
      repo:name,
      protected_branches:['main'],
      require_pull_request:true,
      require_checks:false,
      allow_force_push:false,
      updated_at:null
    };
  }
}

export async function updateRepoPolicy(repo,input={}){
  const current=await getRepoPolicy(repo);
  const next={
    repo:current.repo,
    protected_branches:Array.isArray(input.protected_branches)
      ? [...new Set(input.protected_branches.map(x=>safeName(x,'branch_name')))].slice(0,50)
      : current.protected_branches,
    require_pull_request:input.require_pull_request===undefined?current.require_pull_request:input.require_pull_request===true,
    require_checks:input.require_checks===undefined?current.require_checks:input.require_checks===true,
    allow_force_push:input.allow_force_push===undefined?current.allow_force_push:input.allow_force_push===true,
    updated_at:new Date().toISOString()
  };
  await durableWrite(fileFor(repo),next);
  return next;
}

export async function assertBranchWriteAllowed(repo,branch,{via_pull=false,bypass=false}={}){
  if(bypass||process.env.TGG_SOURCE_BYPASS_PROTECTION==='1')return true;
  const policy=await getRepoPolicy(repo);
  const protectedBranch=policy.protected_branches.includes(String(branch));
  if(!protectedBranch)return true;
  if(policy.require_pull_request&&!via_pull)throw new Error('protected_branch_requires_pull_request');
  return true;
}
