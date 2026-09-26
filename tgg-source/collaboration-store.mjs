import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT=path.resolve(process.env.TGG_SOURCE_ROOT||'/data/tgg-source');
const META=path.join(ROOT,'meta');

function safeName(value){
  const s=String(value||'').trim();
  if(!/^[A-Za-z0-9._-]{1,100}$/.test(s))throw new Error('invalid_repo_name');
  return s;
}
function repoMeta(repo){return path.join(META,safeName(repo))}
async function writeJson(file,value){
  await fs.mkdir(path.dirname(file),{recursive:true});
  const tmp=file+'.tmp-'+process.pid+'-'+Date.now();
  const h=await fs.open(tmp,'w',0o600);
  try{await h.writeFile(JSON.stringify(value,null,2)+'\n','utf8');await h.sync();}
  finally{await h.close();}
  await fs.rename(tmp,file);
}
async function readJson(file){try{return JSON.parse(await fs.readFile(file,'utf8'))}catch{return null}}
async function nextNumber(repo,type){
  const file=path.join(repoMeta(repo),type+'-counter.json');
  const current=await readJson(file);
  const number=Math.max(0,Number(current?.number||0))+1;
  await writeJson(file,{number});
  return number;
}
async function listType(repo,type,{state='all'}={}){
  const dir=path.join(repoMeta(repo),type);
  const files=(await fs.readdir(dir).catch(()=>[])).filter(x=>x.endsWith('.json')).sort((a,b)=>Number(b.split('.')[0])-Number(a.split('.')[0]));
  const out=[];
  for(const file of files){
    try{
      const item=JSON.parse(await fs.readFile(path.join(dir,file),'utf8'));
      if(state!=='all'&&item.state!==state)continue;
      out.push(item);
    }catch{}
  }
  return out;
}
async function getType(repo,type,number){
  const n=Number(number);
  if(!Number.isInteger(n)||n<1)throw new Error('invalid_number');
  const item=await readJson(path.join(repoMeta(repo),type,n+'.json'));
  if(!item)throw new Error(type.slice(0,-1)+'_not_found');
  return item;
}

export async function createIssue(repo,input={}){
  const number=await nextNumber(repo,'issues');
  const issue={
    number,
    type:'issue',
    repo:safeName(repo),
    title:String(input.title||'').trim().slice(0,300),
    body:String(input.body||'').slice(0,50000),
    state:'open',
    labels:Array.isArray(input.labels)?input.labels.map(String).slice(0,20):[],
    assignees:Array.isArray(input.assignees)?input.assignees.map(String).slice(0,20):[],
    created_at:new Date().toISOString(),
    updated_at:new Date().toISOString()
  };
  if(!issue.title)throw new Error('title_required');
  await writeJson(path.join(repoMeta(repo),'issues',number+'.json'),issue);
  return issue;
}
export const listIssues=(repo,options)=>listType(repo,'issues',options);
export const getIssue=(repo,number)=>getType(repo,'issues',number);
export async function updateIssue(repo,number,input={}){
  const issue=await getIssue(repo,number);
  if(input.title!==undefined)issue.title=String(input.title).trim().slice(0,300);
  if(input.body!==undefined)issue.body=String(input.body).slice(0,50000);
  if(input.state!==undefined){
    const state=String(input.state);
    if(!['open','closed'].includes(state))throw new Error('invalid_issue_state');
    issue.state=state;
  }
  if(Array.isArray(input.labels))issue.labels=input.labels.map(String).slice(0,20);
  issue.updated_at=new Date().toISOString();
  await writeJson(path.join(repoMeta(repo),'issues',Number(number)+'.json'),issue);
  return issue;
}

export async function createPull(repo,input={}){
  const number=await nextNumber(repo,'pulls');
  const pull={
    number,
    type:'pull_request',
    repo:safeName(repo),
    title:String(input.title||'').trim().slice(0,300),
    body:String(input.body||'').slice(0,50000),
    base:String(input.base||'main'),
    head:String(input.head||'').trim(),
    state:'open',
    draft:input.draft===true,
    merged:false,
    created_at:new Date().toISOString(),
    updated_at:new Date().toISOString()
  };
  if(!pull.title)throw new Error('title_required');
  if(!pull.head)throw new Error('head_required');
  await writeJson(path.join(repoMeta(repo),'pulls',number+'.json'),pull);
  return pull;
}
export const listPulls=(repo,options)=>listType(repo,'pulls',options);
export const getPull=(repo,number)=>getType(repo,'pulls',number);
export async function updatePull(repo,number,input={}){
  const pull=await getPull(repo,number);
  if(input.title!==undefined)pull.title=String(input.title).trim().slice(0,300);
  if(input.body!==undefined)pull.body=String(input.body).slice(0,50000);
  if(input.state!==undefined){
    const state=String(input.state);
    if(!['open','closed'].includes(state))throw new Error('invalid_pull_state');
    pull.state=state;
  }
  if(input.draft!==undefined)pull.draft=input.draft===true;
  pull.updated_at=new Date().toISOString();
  await writeJson(path.join(repoMeta(repo),'pulls',Number(number)+'.json'),pull);
  return pull;
}
export async function markPullMerged(repo,number,merge={}){
  const pull=await getPull(repo,number);
  pull.state='closed';
  pull.merged=true;
  pull.merge_sha=merge.sha||null;
  pull.merged_at=new Date().toISOString();
  pull.updated_at=pull.merged_at;
  await writeJson(path.join(repoMeta(repo),'pulls',Number(number)+'.json'),pull);
  return pull;
}


export async function createRelease(repo,input={}){
  const number=await nextNumber(repo,'releases');
  const release={
    number,
    type:'release',
    repo:safeName(repo),
    tag_name:String(input.tag_name||'').trim(),
    target_commitish:String(input.target_commitish||'HEAD').trim(),
    name:String(input.name||input.tag_name||'').trim().slice(0,300),
    body:String(input.body||'').slice(0,100000),
    draft:input.draft===true,
    prerelease:input.prerelease===true,
    state:input.draft===true?'draft':'published',
    created_at:new Date().toISOString(),
    published_at:input.draft===true?null:new Date().toISOString(),
    updated_at:new Date().toISOString()
  };
  if(!release.tag_name)throw new Error('tag_name_required');
  if(!release.name)release.name=release.tag_name;
  await writeJson(path.join(repoMeta(repo),'releases',number+'.json'),release);
  return release;
}
export const listReleases=(repo,options)=>listType(repo,'releases',options);
export const getRelease=(repo,number)=>getType(repo,'releases',number);
export async function updateRelease(repo,number,input={}){
  const release=await getRelease(repo,number);
  if(input.name!==undefined)release.name=String(input.name).trim().slice(0,300);
  if(input.body!==undefined)release.body=String(input.body).slice(0,100000);
  if(input.draft!==undefined){
    const nextDraft=input.draft===true;
    const publishing=release.draft===true&&!nextDraft;
    release.draft=nextDraft;
    release.state=nextDraft?'draft':'published';
    if(publishing&&!release.published_at)release.published_at=new Date().toISOString();
  }
  if(input.prerelease!==undefined)release.prerelease=input.prerelease===true;
  release.updated_at=new Date().toISOString();
  await writeJson(path.join(repoMeta(repo),'releases',Number(number)+'.json'),release);
  return release;
}
