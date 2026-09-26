import fs from 'node:fs/promises';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import crypto from 'node:crypto';

const execFileAsync=promisify(execFile);
export const ROOT=path.resolve(process.env.TGG_SOURCE_ROOT||'/data/tgg-source');
const REPOS=path.join(ROOT,'repos');
const EXPORTS=path.join(ROOT,'exports');

export function safeName(value){
  const s=String(value||'').trim();
  if(!/^[A-Za-z0-9._-]{1,100}$/.test(s))throw new Error('invalid_repo_or_branch_name');
  return s;
}
export function safeRelative(value){
  const s=String(value||'').replaceAll('\\','/').replace(/^\/+/, '');
  const normalized=path.posix.normalize(s);
  if(!normalized||normalized==='.'||normalized.startsWith('../')||normalized.includes('/../'))throw new Error('invalid_path');
  return normalized;
}
async function git(cwd,args,opts={}){
  const {stdout='',stderr=''}=await execFileAsync('git',args,{cwd,env:{...process.env,GIT_TERMINAL_PROMPT:'0'},maxBuffer:8*1024*1024,...opts});
  return {stdout:String(stdout).trim(),stderr:String(stderr).trim()};
}
function repoPath(name){return path.join(REPOS,safeName(name))}
async function exists(file){try{await fs.stat(file);return true}catch{return false}}
async function ensureGitIdentity(cwd){
  await git(cwd,['config','user.name',process.env.TGG_SOURCE_GIT_NAME||'TGG Source']);
  await git(cwd,['config','user.email',process.env.TGG_SOURCE_GIT_EMAIL||'source@tgg.local']);
}
export async function initStore(){
  await fs.mkdir(REPOS,{recursive:true});
  await fs.mkdir(EXPORTS,{recursive:true});
}
export async function listRepos(){
  await initStore();
  const names=await fs.readdir(REPOS).catch(()=>[]);
  const out=[];
  for(const name of names){
    const dir=repoPath(name);
    if(!(await exists(path.join(dir,'.git'))))continue;
    const branch=(await git(dir,['branch','--show-current']).catch(()=>({stdout:''}))).stdout||'main';
    const head=(await git(dir,['rev-parse','HEAD']).catch(()=>({stdout:null}))).stdout;
    out.push({name,branch,head});
  }
  return out.sort((a,b)=>a.name.localeCompare(b.name));
}
export async function createRepo(name){
  await initStore();
  name=safeName(name);
  const dir=repoPath(name);
  if(await exists(dir))throw new Error('repo_exists');
  await fs.mkdir(dir,{recursive:true});
  await git(dir,['init','-b','main']);
  await ensureGitIdentity(dir);
  await fs.writeFile(path.join(dir,'README.md'),'# '+name+'\n\nCreated by TGG Source.\n');
  await git(dir,['add','README.md']);
  await git(dir,['commit','-m','Initialize '+name]);
  return getRepo(name);
}
export async function getRepo(name){
  name=safeName(name); const dir=repoPath(name);
  if(!(await exists(path.join(dir,'.git'))))throw new Error('repo_not_found');
  const branch=(await git(dir,['branch','--show-current'])).stdout;
  const head=(await git(dir,['rev-parse','HEAD'])).stdout;
  const count=Number((await git(dir,['rev-list','--count','HEAD'])).stdout||0);
  return {name,branch,head,commit_count:count};
}
export async function branches(name){
  const dir=repoPath(name);
  if(!(await exists(path.join(dir,'.git'))))throw new Error('repo_not_found');
  const current=(await git(dir,['branch','--show-current'])).stdout;
  const rows=(await git(dir,['for-each-ref','--format=%(refname:short)|%(objectname)','refs/heads/'])).stdout.split('\n').filter(Boolean);
  return rows.map(row=>{const [branch,sha]=row.split('|');return {name:branch,sha,current:branch===current}});
}
export async function createBranch(name,branch,from='HEAD'){
  const dir=repoPath(name); branch=safeName(branch);
  await git(dir,['branch',branch,String(from||'HEAD')]);
  return branches(name);
}
export async function log(name,ref='HEAD',limit=50){
  const dir=repoPath(name);
  const n=Math.max(1,Math.min(200,Number(limit)||50));
  const raw=(await git(dir,['log',String(ref),'--max-count='+n,'--pretty=format:%H%x1f%an%x1f%ae%x1f%aI%x1f%s'])).stdout;
  return raw.split('\n').filter(Boolean).map(line=>{const [sha,author,email,date,message]=line.split('\x1f');return {sha,author,email,date,message}});
}
export async function tree(name,ref='HEAD'){
  const dir=repoPath(name);
  const raw=(await git(dir,['ls-tree','-r','--long',String(ref)])).stdout;
  return raw.split('\n').filter(Boolean).map(line=>{
    const m=line.match(/^(\d+)\s+(\w+)\s+([a-f0-9]+)\s+(\d+|-)\t(.+)$/);
    return m?{mode:m[1],type:m[2],sha:m[3],size:m[4]==='-'?null:Number(m[4]),path:m[5]}:{raw:line};
  });
}
export async function readFile(name,file,ref='HEAD'){
  const dir=repoPath(name); file=safeRelative(file);
  const {stdout}=await git(dir,['show',String(ref)+':'+file]);
  return {path:file,ref,content:stdout};
}
export async function commitFiles(name,{branch='main',message='TGG update',files=[]}={}){
  const dir=repoPath(name); branch=safeName(branch);
  if(!Array.isArray(files)||files.length===0)throw new Error('files_required');
  await git(dir,['checkout',branch]);
  await ensureGitIdentity(dir);
  for(const item of files){
    const rel=safeRelative(item.path);
    const full=path.join(dir,...rel.split('/'));
    if(item.delete===true){
      await fs.rm(full,{force:true,recursive:true});
    }else{
      await fs.mkdir(path.dirname(full),{recursive:true});
      await fs.writeFile(full,String(item.content??''),'utf8');
    }
  }
  await git(dir,['add','-A']);
  const status=(await git(dir,['status','--porcelain'])).stdout;
  if(!status)return {ok:true,no_change:true,repo:name,branch,head:(await git(dir,['rev-parse','HEAD'])).stdout};
  await git(dir,['commit','-m',String(message||'TGG update').slice(0,240)]);
  const head=(await git(dir,['rev-parse','HEAD'])).stdout;
  return {ok:true,repo:name,branch,head,commit_id:crypto.randomUUID()};
}


export async function compareRefs(name,base='main',head='HEAD'){
  const dir=repoPath(name);
  const baseRef=String(base||'main');
  const headRef=String(head||'HEAD');
  const mergeBase=(await git(dir,['merge-base',baseRef,headRef])).stdout;
  const raw=(await git(dir,['diff','--numstat',baseRef+'...'+headRef])).stdout;
  const files=raw.split('\n').filter(Boolean).map(line=>{
    const [additions,deletions,...rest]=line.split('\t');
    return {
      path:rest.join('\t'),
      additions:additions==='-'?null:Number(additions),
      deletions:deletions==='-'?null:Number(deletions)
    };
  });
  const commits=Number((await git(dir,['rev-list','--count',baseRef+'..'+headRef])).stdout||0);
  return {base:baseRef,head:headRef,merge_base:mergeBase,ahead_by:commits,files};
}

export async function mergeBranch(name,{base='main',head,message}={}){
  const dir=repoPath(name);
  base=safeName(base);head=safeName(head);
  if(base===head)throw new Error('merge_same_branch');
  await ensureGitIdentity(dir);
  await git(dir,['checkout',base]);
  try{
    await git(dir,['merge','--no-ff',head,'-m',String(message||('Merge '+head+' into '+base)).slice(0,240)]);
  }catch(error){
    await git(dir,['merge','--abort']).catch(()=>{});
    throw new Error('merge_conflict_or_failure');
  }
  return {ok:true,base,head,sha:(await git(dir,['rev-parse','HEAD'])).stdout};
}

export async function searchCode(name,{query,ref='HEAD',limit=100}={}){
  const dir=repoPath(name);
  const q=String(query||'').trim();
  if(!q)throw new Error('query_required');
  const max=Math.max(1,Math.min(500,Number(limit)||100));
  const result=await git(dir,['grep','-n','-I','-F','-e',q,String(ref),'--']).catch(error=>{
    if(error?.code===1)return {stdout:''};
    throw error;
  });
  return result.stdout.split('\n').filter(Boolean).slice(0,max).map(line=>{
    const first=line.indexOf(':');
    const second=line.indexOf(':',first+1);
    return {
      path:first>=0?line.slice(0,first):line,
      line:first>=0&&second>first?Number(line.slice(first+1,second)):null,
      text:second>first?line.slice(second+1):''
    };
  });
}

export async function tags(name){
  const dir=repoPath(name);
  const raw=(await git(dir,['for-each-ref','--format=%(refname:short)|%(objectname)|%(creatordate:iso-strict)','refs/tags/'])).stdout;
  return raw.split('\n').filter(Boolean).map(row=>{
    const [tag,sha,date]=row.split('|');
    return {tag,sha,date};
  });
}

export async function createTag(name,{tag,ref='HEAD',message}={}){
  const dir=repoPath(name);
  tag=safeName(tag);
  await ensureGitIdentity(dir);
  await git(dir,['tag','-a',tag,String(ref||'HEAD'),'-m',String(message||tag).slice(0,240)]);
  return {ok:true,tag,sha:(await git(dir,['rev-list','-n','1',tag])).stdout};
}


export async function commitDetails(name,ref='HEAD'){
  const dir=repoPath(name);
  const target=String(ref||'HEAD');
  const meta=(await git(dir,['show','-s','--format=%H%x1f%an%x1f%ae%x1f%aI%x1f%s',target])).stdout;
  const [sha,author,email,date,message]=meta.split('\x1f');
  const names=(await git(dir,['diff-tree','--no-commit-id','--name-status','-r',target])).stdout
    .split('\n').filter(Boolean).map(line=>{
      const [status,...rest]=line.split('\t');
      return {status,path:rest.join('\t')};
    });
  const stat=(await git(dir,['show','--format=','--numstat',target])).stdout
    .split('\n').filter(Boolean).map(line=>{
      const [additions,deletions,...rest]=line.split('\t');
      return {
        additions:additions==='-'?null:Number(additions),
        deletions:deletions==='-'?null:Number(deletions),
        path:rest.join('\t')
      };
    });
  const patch=(await git(dir,['show','--format=','--no-ext-diff','--unified=3',target],{maxBuffer:4*1024*1024})).stdout;
  return {
    sha,author,email,date,message,
    files:names,
    stats:stat,
    patch:patch.slice(0,2_000_000),
    patch_truncated:patch.length>2_000_000
  };
}

export async function exportRepoBundle(name,{ref='--all'}={}){
  await initStore();
  name=safeName(name);
  const dir=repoPath(name);
  if(!(await exists(path.join(dir,'.git'))))throw new Error('repo_not_found');
  const head=(await git(dir,['rev-parse','HEAD'])).stdout;
  const id='tgg-bundle-'+name+'-'+Date.now()+'-'+crypto.randomBytes(4).toString('hex');
  const file=path.join(EXPORTS,id+'.bundle');
  const args=['bundle','create',file];
  if(String(ref)==='--all')args.push('--all');
  else args.push(String(ref||'HEAD'));
  await git(dir,args,{maxBuffer:16*1024*1024});
  const data=await fs.readFile(file);
  return {
    id,
    repo:name,
    ref:String(ref||'--all'),
    head,
    path:file,
    filename:id+'.bundle',
    bytes:data.length,
    sha256:crypto.createHash('sha256').update(data).digest('hex'),
    created_at:new Date().toISOString()
  };
}

export async function readRepoBundle(id){
  const safe=safeName(id);
  const file=path.join(EXPORTS,safe.endsWith('.bundle')?safe:safe+'.bundle');
  const data=await fs.readFile(file).catch(()=>null);
  if(!data)throw new Error('bundle_not_found');
  return {file,data,filename:path.basename(file)};
}
