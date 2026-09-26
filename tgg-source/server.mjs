import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {initStore,listRepos,createRepo,getRepo,branches,createBranch,log,tree,readFile,commitFiles,compareRefs,mergeBranch,searchCode,tags,createTag} from './repo-store.mjs';
import {createIssue,listIssues,getIssue,updateIssue,createPull,listPulls,getPull,updatePull,markPullMerged} from './collaboration-store.mjs';

const ROOT=path.dirname(fileURLToPath(import.meta.url));
const PORT=Number(process.env.TGG_SOURCE_PORT||10030);
const HOST=process.env.TGG_SOURCE_HOST||'0.0.0.0';
const TGG_PROJECTS_URL=String(process.env.TGG_PROJECTS_URL||'http://127.0.0.1:10020').replace(/\/$/,'');

function send(res,status,body,type='application/json; charset=utf-8'){
  res.writeHead(status,{'content-type':type,'cache-control':'no-store','x-tgg-owner':'TGG','x-tgg-service':'tgg-source'});
  res.end(type.startsWith('application/json')?JSON.stringify(body,null,2):body);
}
async function body(req){
  const chunks=[];for await(const c of req)chunks.push(c);
  if(!chunks.length)return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
function fail(res,error){
  const message=String(error?.message||error);
  const status=/not_found/.test(message)?404:/exists/.test(message)?409:/invalid|required/.test(message)?400:500;
  send(res,status,{ok:false,error:message});
}
async function saveSourceCheckpoint(repoName,input,result){
  try{
    const response=await fetch(TGG_PROJECTS_URL+'/v1/projects/tgg-source/snapshots',{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({
        repository:'tgg-source:'+repoName,
        branch:result?.branch||input?.branch||null,
        sha:result?.head||result?.sha||null,
        status:'source-commit-saved',
        title:'TGG Source · '+repoName+' · '+String(input?.message||'commit').slice(0,120),
        notes:'Automatically saved by TGG Source after a repository change.',
        metadata:{
          repo:repoName,
          commit_id:result?.commit_id||null,
          no_change:result?.no_change===true,
          file_count:Array.isArray(input?.files)?input.files.length:0,
          paths:Array.isArray(input?.files)?input.files.map(x=>x.path).slice(0,100):[],
          saved_by:'tgg-source'
        }
      }),
      signal:AbortSignal.timeout(5000)
    });
    return response.ok;
  }catch{return false}
}

async function ciReceipt(){
  const file=path.resolve(ROOT,'..','tgg-ci','latest-check.json');
  try{return JSON.parse(await fs.readFile(file,'utf8'))}
  catch{return {schema:'tgg.ci.canonical.receipt.v1',authority:'TGG',status:'NOT_RUN',checks:{}}}
}

await initStore();
const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost');
    if(req.method==='GET'&&url.pathname==='/health')return send(res,200,{ok:true,service:'tgg-source',owner:'TGG',port:PORT});
    if(req.method==='GET'&&url.pathname==='/')return send(res,200,await fs.readFile(path.join(ROOT,'index.html'),'utf8'),'text/html; charset=utf-8');
    if(req.method==='GET'&&url.pathname==='/v1/repos')return send(res,200,{ok:true,repositories:await listRepos()});
    if(req.method==='GET'&&url.pathname==='/v1/checks')return send(res,200,{ok:true,receipt:await ciReceipt()});
    if(req.method==='POST'&&url.pathname==='/v1/repos'){
      const b=await body(req);return send(res,201,{ok:true,repository:await createRepo(b.name)});
    }
    const m=url.pathname.match(/^\/v1\/repos\/([^/]+)(?:\/(.*))?$/);
    if(m){
      const name=decodeURIComponent(m[1]);const tail=m[2]||'';
      if(req.method==='GET'&&!tail)return send(res,200,{ok:true,repository:await getRepo(name)});
      if(req.method==='GET'&&tail==='branches')return send(res,200,{ok:true,branches:await branches(name)});
      if(req.method==='POST'&&tail==='branches'){
        const b=await body(req);return send(res,201,{ok:true,branches:await createBranch(name,b.name,b.from||'HEAD')});
      }
      if(req.method==='GET'&&tail==='commits')return send(res,200,{ok:true,commits:await log(name,url.searchParams.get('ref')||'HEAD',url.searchParams.get('limit')||50)});
      if(req.method==='GET'&&tail==='tree')return send(res,200,{ok:true,files:await tree(name,url.searchParams.get('ref')||'HEAD')});
      if(req.method==='GET'&&tail==='file')return send(res,200,{ok:true,file:await readFile(name,url.searchParams.get('path'),url.searchParams.get('ref')||'HEAD')});
      if(req.method==='GET'&&tail==='compare')return send(res,200,{ok:true,comparison:await compareRefs(name,url.searchParams.get('base')||'main',url.searchParams.get('head')||'HEAD')});
      if(req.method==='GET'&&tail==='search')return send(res,200,{ok:true,results:await searchCode(name,{query:url.searchParams.get('q'),ref:url.searchParams.get('ref')||'HEAD',limit:url.searchParams.get('limit')||100})});
      if(req.method==='GET'&&tail==='tags')return send(res,200,{ok:true,tags:await tags(name)});
      if(req.method==='POST'&&tail==='tags')return send(res,201,{ok:true,tag:await createTag(name,await body(req))});
      if(req.method==='GET'&&tail==='issues')return send(res,200,{ok:true,issues:await listIssues(name,{state:url.searchParams.get('state')||'all'})});
      if(req.method==='POST'&&tail==='issues')return send(res,201,{ok:true,issue:await createIssue(name,await body(req))});
      let item=tail.match(/^issues\/(\d+)$/);
      if(req.method==='GET'&&item)return send(res,200,{ok:true,issue:await getIssue(name,item[1])});
      if(req.method==='PATCH'&&item)return send(res,200,{ok:true,issue:await updateIssue(name,item[1],await body(req))});
      if(req.method==='GET'&&tail==='pulls')return send(res,200,{ok:true,pulls:await listPulls(name,{state:url.searchParams.get('state')||'all'})});
      if(req.method==='POST'&&tail==='pulls'){
        const input=await body(req);
        await compareRefs(name,input.base||'main',input.head);
        return send(res,201,{ok:true,pull:await createPull(name,input)});
      }
      item=tail.match(/^pulls\/(\d+)$/);
      if(req.method==='GET'&&item)return send(res,200,{ok:true,pull:await getPull(name,item[1])});
      if(req.method==='PATCH'&&item)return send(res,200,{ok:true,pull:await updatePull(name,item[1],await body(req))});
      item=tail.match(/^pulls\/(\d+)\/merge$/);
      if(req.method==='POST'&&item){
        const pull=await getPull(name,item[1]);
        if(pull.state!=='open'||pull.merged===true)throw new Error('pull_not_mergeable');
        const merged=await mergeBranch(name,{base:pull.base,head:pull.head,message:'Merge pull #'+pull.number+': '+pull.title});
        return send(res,200,{ok:true,pull:await markPullMerged(name,item[1],merged),merge:merged});
      }
      if(req.method==='POST'&&tail==='merge')return send(res,200,{ok:true,result:await mergeBranch(name,await body(req))});
      if(req.method==='POST'&&tail==='commits'){
        const input=await body(req);
        const result=await commitFiles(name,input);
        const project_saved=await saveSourceCheckpoint(name,input,result);
        return send(res,201,{ok:true,result,project_saved});
      }
    }
    send(res,404,{ok:false,error:'not_found'});
  }catch(error){fail(res,error)}
});
server.listen(PORT,HOST,()=>console.log(JSON.stringify({ok:true,service:'tgg-source',url:'http://'+HOST+':'+PORT})));
