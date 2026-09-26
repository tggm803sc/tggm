import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {initStore,listRepos,createRepo,getRepo,branches,createBranch,log,tree,readFile,commitFiles,compareRefs,mergeBranch,searchCode,tags,createTag,commitDetails,exportRepoBundle,readRepoBundle,restoreRepoBundle,importRepo} from './repo-store.mjs';
import {createIssue,listIssues,getIssue,updateIssue,createPull,listPulls,getPull,updatePull,markPullMerged,createRelease,listReleases,getRelease,updateRelease} from './collaboration-store.mjs';
import {getRepoPolicy,updateRepoPolicy} from './repo-policy.mjs';
import {createCheckRun,listCheckRuns,checksPass} from './check-store.mjs';

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

async function saveSourceEvent(repoName,type,{source_id=null,branch=null,sha=null,title='',status='saved',metadata={}}={}){
  return projectsPost('/v1/events',{
    project_id:'tgg-source',
    type,
    source_service:'tgg-source',
    source_id,
    repository:'tgg-source:'+repoName,
    branch,
    sha,
    title:title||('TGG Source · '+repoName+' · '+type),
    status,
    metadata:{repo:repoName,...metadata}
  });
}

async function saveBundleAsset(repoName,bundle){
  return projectsPost('/v1/projects/tgg-source/assets',{
    type:'repository-bundle',
    source_service:'tgg-source',
    source_id:bundle.id,
    title:'TGG Source backup · '+repoName,
    status:'saved',
    outputs:[{
      filename:bundle.filename,
      bytes:bundle.bytes,
      sha256:bundle.sha256,
      ref:bundle.ref,
      head:bundle.head
    }],
    metadata:{
      repo:repoName,
      bundle_path:bundle.path,
      created_at:bundle.created_at
    }
  });
}

async function saveReleaseAsset(repoName,release,tag){
  return projectsPost('/v1/projects/tgg-source/assets',{
    type:'source-release',
    source_service:'tgg-source',
    source_id:repoName+'#release-'+release.number,
    title:'TGG Release · '+repoName+' · '+release.tag_name,
    status:release.state,
    outputs:[{
      tag:release.tag_name,
      sha:tag?.sha||null,
      release_number:release.number,
      prerelease:release.prerelease===true
    }],
    metadata:{
      repo:repoName,
      release_name:release.name,
      target_commitish:release.target_commitish,
      published_at:release.published_at,
      created_at:release.created_at
    }
  });
}

async function saveReleaseCheckpoint(repoName,release,tag){
  return projectsPost('/v1/projects/tgg-source/snapshots',{
    repository:'tgg-source:'+repoName,
    branch:null,
    sha:tag?.sha||null,
    release:release.tag_name,
    status:'source-release-'+release.state,
    title:'TGG Source Release · '+repoName+' · '+release.tag_name,
    notes:release.body||'TGG Source release saved.',
    metadata:{
      release_number:release.number,
      release_name:release.name,
      prerelease:release.prerelease===true,
      target_commitish:release.target_commitish
    }
  });
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

async function appManifest(){
  return {
    ok:true,
    owner:'TGG',
    app:'tgg-source',
    name:'TGG Source',
    mode:'tgg-owned-github-style',
    primary_code_host:true,
    openapi:'/openapi.json',
    ui:'/',
    health:'/health',
    capabilities:[
      'repositories','files','branches','commits','history','compare','search',
      'issues','pull-requests','merge','tags','checks','releases',
      'repository-bundles','restore','protected-branches','required-checks',
      'tgg-projects-checkpoints'
    ],
    legacy_bootstrap:'github'
  };
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
    if(req.method==='GET'&&url.pathname==='/.well-known/tgg-source.json')return send(res,200,await appManifest());
    if(req.method==='GET'&&url.pathname==='/openapi.json')return send(res,200,JSON.parse(await fs.readFile(path.join(ROOT,'openapi.json'),'utf8')));
    if(req.method==='GET'&&url.pathname==='/')return send(res,200,await fs.readFile(path.join(ROOT,'index.html'),'utf8'),'text/html; charset=utf-8');
    if(req.method==='GET'&&url.pathname==='/v1/repos')return send(res,200,{ok:true,repositories:await listRepos()});
    if(req.method==='GET'&&url.pathname==='/v1/checks')return send(res,200,{ok:true,receipt:await ciReceipt()});
    if(req.method==='POST'&&url.pathname==='/v1/repos'){
      const b=await body(req);return send(res,201,{ok:true,repository:await createRepo(b.name)});
    }
    if(req.method==='POST'&&url.pathname==='/v1/import'){
      const input=await body(req);
      const imported=await importRepo(input);
      const checkpoint=await saveSourceCheckpoint(imported.repo,{
        branch:imported.branch,
        message:'Import repository from '+imported.imported_from,
        files:[]
      },{branch:imported.branch,head:imported.head});
      const event=await saveSourceEvent(imported.repo,'repository-import',{
        source_id:imported.head,
        branch:imported.branch,
        sha:imported.head,
        title:'TGG Source import · '+imported.repo,
        metadata:{imported_from:imported.imported_from}
      });
      return send(res,201,{ok:true,imported,project_saved:Boolean(checkpoint||event),snapshot:checkpoint?.snapshot||null,event:event?.event||null});
    }
    if(req.method==='POST'&&url.pathname==='/v1/restore'){
      const restored=await restoreRepoBundle(await body(req));
      const checkpoint=await saveSourceCheckpoint(restored.repo,{
        branch:restored.branch,
        message:'Restore repository from '+restored.restored_from,
        files:[]
      },{branch:restored.branch,head:restored.head});
      return send(res,201,{ok:true,restored,project_saved:Boolean(checkpoint),snapshot:checkpoint?.snapshot||null});
    }
    const m=url.pathname.match(/^\/v1\/repos\/([^/]+)(?:\/(.*))?$/);
    if(m){
      const name=decodeURIComponent(m[1]);const tail=m[2]||'';
      if(req.method==='GET'&&!tail)return send(res,200,{ok:true,repository:await getRepo(name)});
      if(req.method==='POST'&&tail==='check-runs/from-ci'){
        const repoInfo=await getRepo(name);
        const receipt=await ciReceipt();
        const status=receipt?.status==='PASS'?'completed':'completed';
        const conclusion=receipt?.status==='PASS'?'success':'failure';
        const check=await createCheckRun(name,{
          sha:repoInfo.head,
          name:'tgg-ci',
          status,
          conclusion,
          summary:'TGG CI '+String(receipt?.status||'NOT_RUN')+' · '+String(receipt?.createdAt||'no receipt')
        });
        const event=await saveSourceEvent(name,'check-run',{source_id:check.id,branch:repoInfo.branch,sha:check.sha,title:'TGG CI · '+name,status:check.conclusion,metadata:{receipt_schema:receipt?.schema||null,receipt_status:receipt?.status||'NOT_RUN',receipt_created_at:receipt?.createdAt||null}});
        return send(res,201,{ok:true,check,receipt,project_saved:Boolean(event),event:event?.event||null});
      }
      if(req.method==='GET'&&tail==='check-runs')return send(res,200,{ok:true,checks:await listCheckRuns(name,{sha:url.searchParams.get('sha')||null,limit:url.searchParams.get('limit')||100})});
      if(req.method==='POST'&&tail==='check-runs'){
        const check=await createCheckRun(name,await body(req));
        const event=await saveSourceEvent(name,'check-run',{source_id:check.id,sha:check.sha,title:'TGG Check · '+name+' · '+check.name,status:check.conclusion||check.status,metadata:{check_name:check.name,status:check.status,conclusion:check.conclusion}});
        return send(res,201,{ok:true,check,project_saved:Boolean(event),event:event?.event||null});
      }
      if(req.method==='GET'&&tail==='settings')return send(res,200,{ok:true,settings:await getRepoPolicy(name)});
      if(req.method==='PATCH'&&tail==='settings'){
        const settings=await updateRepoPolicy(name,await body(req));
        const event=await saveSourceEvent(name,'repository-settings',{source_id:'settings',title:'TGG Source settings · '+name,metadata:settings});
        return send(res,200,{ok:true,settings,project_saved:Boolean(event),event:event?.event||null});
      }
      if(req.method==='GET'&&tail==='branches')return send(res,200,{ok:true,branches:await branches(name)});
      if(req.method==='POST'&&tail==='branches'){
        const b=await body(req);return send(res,201,{ok:true,branches:await createBranch(name,b.name,b.from||'HEAD')});
      }
      if(req.method==='GET'&&tail==='commits')return send(res,200,{ok:true,commits:await log(name,url.searchParams.get('ref')||'HEAD',url.searchParams.get('limit')||50)});
      let commitMatch=tail.match(/^commits\/([^/]+)$/);
      if(req.method==='GET'&&commitMatch)return send(res,200,{ok:true,commit:await commitDetails(name,decodeURIComponent(commitMatch[1]))});
      if(req.method==='GET'&&tail==='tree')return send(res,200,{ok:true,files:await tree(name,url.searchParams.get('ref')||'HEAD')});
      if(req.method==='GET'&&tail==='file')return send(res,200,{ok:true,file:await readFile(name,url.searchParams.get('path'),url.searchParams.get('ref')||'HEAD')});
      if(req.method==='GET'&&tail==='compare')return send(res,200,{ok:true,comparison:await compareRefs(name,url.searchParams.get('base')||'main',url.searchParams.get('head')||'HEAD')});
      if(req.method==='GET'&&tail==='search')return send(res,200,{ok:true,results:await searchCode(name,{query:url.searchParams.get('q'),ref:url.searchParams.get('ref')||'HEAD',limit:url.searchParams.get('limit')||100})});
      if(req.method==='GET'&&tail==='tags')return send(res,200,{ok:true,tags:await tags(name)});
      if(req.method==='POST'&&tail==='tags')return send(res,201,{ok:true,tag:await createTag(name,await body(req))});
      if(req.method==='GET'&&tail==='releases')return send(res,200,{ok:true,releases:await listReleases(name,{state:url.searchParams.get('state')||'all'})});
      if(req.method==='POST'&&tail==='releases'){
        const input=await body(req);
        if(!input.tag_name)throw new Error('tag_name_required');
        const existing=(await tags(name)).find(x=>x.tag===String(input.tag_name));
        const tag=existing||await createTag(name,{tag:input.tag_name,ref:input.target_commitish||'HEAD',message:input.name||input.tag_name});
        const release=await createRelease(name,input);
        const asset=await saveReleaseAsset(name,release,tag);
        const checkpoint=await saveReleaseCheckpoint(name,release,tag);
        const event=await saveSourceEvent(name,'source-release',{source_id:name+'#release-'+release.number,sha:tag?.sha||null,title:'TGG Source release · '+name+' · '+release.tag_name,status:release.state,metadata:{release_number:release.number,tag_name:release.tag_name,prerelease:release.prerelease===true}});
        return send(res,201,{ok:true,release,tag,project_saved:Boolean(asset||checkpoint||event),asset:asset?.asset||null,snapshot:checkpoint?.snapshot||null,event:event?.event||null});
      }
      let releaseItem=tail.match(/^releases\/(\d+)$/);
      if(req.method==='GET'&&releaseItem)return send(res,200,{ok:true,release:await getRelease(name,releaseItem[1])});
      if(req.method==='PATCH'&&releaseItem){
        const release=await updateRelease(name,releaseItem[1],await body(req));
        const tag=(await tags(name)).find(x=>x.tag===release.tag_name)||null;
        const asset=await saveReleaseAsset(name,release,tag);
        const checkpoint=await saveReleaseCheckpoint(name,release,tag);
        return send(res,200,{ok:true,release,project_saved:Boolean(asset||checkpoint),asset:asset?.asset||null,snapshot:checkpoint?.snapshot||null});
      }
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
        const policy=await getRepoPolicy(name);
        if(policy.require_checks){
          const comparison=await compareRefs(name,pull.base,pull.head);
          const headInfo=(await branches(name)).find(b=>b.name===pull.head);
          const headSha=headInfo?.sha||comparison?.head_sha||null;
          if(!headSha||!(await checksPass(name,headSha)))throw new Error('required_checks_not_passed');
        }
        const merged=await mergeBranch(name,{base:pull.base,head:pull.head,message:'Merge pull #'+pull.number+': '+pull.title,via_pull:true});
        return send(res,200,{ok:true,pull:await markPullMerged(name,item[1],merged),merge:merged});
      }
      if(req.method==='POST'&&tail==='merge')return send(res,200,{ok:true,result:await mergeBranch(name,await body(req))});
      if(req.method==='POST'&&tail==='export'){
        const bundle=await exportRepoBundle(name,await body(req));
        const asset=await saveBundleAsset(name,bundle);
        const event=await saveSourceEvent(name,'repository-backup',{source_id:bundle.id,sha:bundle.head,title:'TGG Source backup · '+name,metadata:{bundle_id:bundle.id,filename:bundle.filename,bytes:bundle.bytes,sha256:bundle.sha256,ref:bundle.ref}});
        return send(res,201,{ok:true,bundle,project_saved:Boolean(asset||event),asset:asset?.asset||null,event:event?.event||null});
      }
      if(req.method==='POST'&&tail==='commits'){
        const input=await body(req);
        const result=await commitFiles(name,input);
        const checkpoint=await saveSourceCheckpoint(name,input,result);
        const event=await saveSourceEvent(name,'source-commit',{source_id:result.commit_id||result.head||null,branch:result.branch||input.branch||null,sha:result.head||null,title:'TGG Source commit · '+name+' · '+String(input.message||'commit').slice(0,120),metadata:{message:String(input.message||'TGG update').slice(0,240),no_change:result.no_change===true,file_count:Array.isArray(input.files)?input.files.length:0,paths:Array.isArray(input.files)?input.files.map(x=>x.path).slice(0,100):[]}});
        return send(res,201,{ok:true,result,project_saved:Boolean(checkpoint||event),snapshot:checkpoint?.snapshot||null,event:event?.event||null});
      }
    }
    const exportMatch=url.pathname.match(/^\/v1\/exports\/([^/]+)$/);
    if(req.method==='GET'&&exportMatch){
      const bundle=await readRepoBundle(decodeURIComponent(exportMatch[1]));
      res.writeHead(200,{
        'content-type':'application/octet-stream',
        'content-disposition':'attachment; filename="'+bundle.filename+'"',
        'cache-control':'no-store',
        'x-tgg-owner':'TGG',
        'x-tgg-service':'tgg-source'
      });
      return res.end(bundle.data);
    }
    send(res,404,{ok:false,error:'not_found'});
  }catch(error){fail(res,error)}
});
server.listen(PORT,HOST,()=>console.log(JSON.stringify({ok:true,service:'tgg-source',url:'http://'+HOST+':'+PORT})));
