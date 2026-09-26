import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {initSnapshots,createSnapshot,getSnapshot,listSnapshots} from './state-store.mjs';

const ROOT=path.dirname(fileURLToPath(import.meta.url));
const PORT=Number(process.env.TGG_PROJECTS_PORT||10020);
const HOST=process.env.TGG_PROJECTS_HOST||'0.0.0.0';
const TGG_SOURCE_URL=String(process.env.TGG_SOURCE_URL||'http://127.0.0.1:10030').replace(/\/$/,'');
const TGG_HIGGSFIELD_URL=String(process.env.TGG_HIGGSFIELD_URL||'http://127.0.0.1:10040').replace(/\/$/,'');

await initSnapshots();

async function registry(){
  return JSON.parse(await fs.readFile(path.join(ROOT,'registry.json'),'utf8'));
}
async function ciReceipt(){
  const file=path.resolve(ROOT,'..','tgg-ci','latest-check.json');
  try{return JSON.parse(await fs.readFile(file,'utf8'))}
  catch{return {schema:'tgg.ci.canonical.receipt.v1',authority:'TGG',status:'NOT_RUN',checks:{}}}
}
async function body(req){
  const chunks=[];for await(const c of req)chunks.push(c);
  return chunks.length?JSON.parse(Buffer.concat(chunks).toString('utf8')):{};
}
async function serviceJson(base,pathname,{method='GET',payload=null}={}){
  try{
    const response=await fetch(base+pathname,{
      method,
      headers:payload?{'content-type':'application/json'}:undefined,
      body:payload?JSON.stringify(payload):undefined,
      signal:AbortSignal.timeout(10000)
    });
    const data=await response.json().catch(()=>({}));
    return {ok:response.ok&&data?.ok!==false,status:response.status,data};
  }catch(error){
    return {ok:false,status:0,data:{ok:false,error:String(error?.message||error)}};
  }
}
async function dashboardState(){
  const [data,snapshots,sourceRepos,higgsJobs,sourceHealth,higgsHealth,ci]=await Promise.all([
    registry(),
    listSnapshots({limit:25}),
    serviceJson(TGG_SOURCE_URL,'/v1/repos'),
    serviceJson(TGG_HIGGSFIELD_URL,'/v1/jobs'),
    serviceJson(TGG_SOURCE_URL,'/health'),
    serviceJson(TGG_HIGGSFIELD_URL,'/health'),
    ciReceipt()
  ]);
  return {
    ...data,
    snapshots,
    services:{
      source:{url:TGG_SOURCE_URL,ok:sourceHealth.ok,health:sourceHealth.data},
      higgsfield:{url:TGG_HIGGSFIELD_URL,ok:higgsHealth.ok,health:higgsHealth.data}
    },
    source_repositories:sourceRepos.data?.repositories||[],
    higgsfield_jobs:higgsJobs.data?.jobs||[],
    ci
  };
}
async function saveEverything(input={}){
  const state=await dashboardState();
  const repos=(state.source_repositories||[]).map(repo=>({
    name:repo.name,
    branch:repo.branch||null,
    head:repo.head||null
  }));
  const jobs=(state.higgsfield_jobs||[]).map(job=>({
    id:job.id,
    mode:job.mode,
    status:job.status,
    preset:job.preset||null,
    created_at:job.created_at||null
  }));
  return createSnapshot({
    project_id:String(input.project_id||'tgg'),
    repository:state.primary_repository,
    branch:input.branch||null,
    sha:input.sha||null,
    build:input.build||null,
    release:input.release||null,
    status:'saved-everything',
    title:String(input.title||'TGG Save Everything checkpoint'),
    notes:String(input.notes||'TGG Projects captured current project registry, source repositories, and TGG Higgsfield job state.'),
    metadata:{
      registry_updated_at:state.updated_at||null,
      project_count:(state.projects||[]).length,
      source_service_ok:state.services.source.ok,
      source_repositories:repos,
      higgsfield_service_ok:state.services.higgsfield.ok,
      higgsfield_jobs:jobs,
      ci:{
        schema:state.ci?.schema||null,
        authority:state.ci?.authority||'TGG',
        status:state.ci?.status||'NOT_RUN',
        createdAt:state.ci?.createdAt||null,
        checks:state.ci?.checks||{}
      },
      captured_at:new Date().toISOString()
    }
  });
}
function send(res,status,body,type='application/json; charset=utf-8'){
  res.writeHead(status,{'content-type':type,'cache-control':'no-store','x-tgg-owner':'TGG','x-tgg-service':'tgg-projects'});
  res.end(type.startsWith('application/json')?JSON.stringify(body,null,2):body);
}
function page(data){
  const cards=(data.projects||[]).map(p=>`<article><div class="row"><b>${p.name}</b><span>${p.status}</span></div><p>${p.purpose||''}</p><code>${p.path||p.branch||p.id}</code></article>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TGG Projects</title><style>
  body{margin:0;background:#090b10;color:#f4f7fb;font-family:Inter,system-ui,sans-serif}.top{padding:22px 28px;border-bottom:1px solid #222b3a;background:#0e131c;display:flex;justify-content:space-between;gap:18px;align-items:center}.wrap{max-width:1280px;margin:auto;padding:30px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:20px 0}.stat,article{border:1px solid #263047;background:#111824;border-radius:16px;padding:18px}.row{display:flex;justify-content:space-between;gap:12px;align-items:center}.row span{font-size:12px;color:#9fb0c8}.muted,p{color:#91a0b6}code{color:#c7d5eb}.btn{border:1px solid #38506f;background:#182437;color:#fff;padding:11px 15px;border-radius:10px;font-weight:800;cursor:pointer}.btn.primary{background:#1c6df2;border-color:#2c78f5}.ok{color:#83e3a1}.bad{color:#ff9a9a}.list{border:1px solid #263047;border-radius:14px;overflow:hidden}.item{padding:12px 14px;border-bottom:1px solid #202838}.item:last-child{border:0}@media(max-width:850px){.grid,.stats{grid-template-columns:1fr}.top{align-items:flex-start;flex-direction:column}}</style></head><body>
  <div class="top"><div><b>TGG PROJECTS</b><div class="muted">Primary repository · ${data.primary_repository}</div></div><button class="btn primary" onclick="saveEverything()">SAVE EVERYTHING</button></div>
  <div class="wrap"><h1>TGG Platform</h1><p>One place for the TGG game, source control, runtime, cloud, CI, Creator OS and media tools.</p>
    <div id="live" class="stats"><div class="stat">Loading TGG services…</div></div>
    <h2>Projects</h2><div class="grid">${cards}</div>
    <h2>Recent checkpoints</h2><div id="snapshots" class="list"><div class="item muted">Loading…</div></div>
  </div>
<script>
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function api(url,options){const r=await fetch(url,options);const j=await r.json().catch(()=>({}));if(!r.ok||j.ok===false)throw Error(j.error||('HTTP '+r.status));return j}
async function load(){
  try{
    const d=await api('/v1/dashboard');
    const repos=d.source_repositories||[],jobs=d.higgsfield_jobs||[],snaps=d.snapshots||[];
    document.getElementById('live').innerHTML=[
      ['TGG Source',d.services?.source?.ok?'ONLINE':'OFFLINE',repos.length+' repositories',d.services?.source?.ok],
      ['TGG Higgsfield',d.services?.higgsfield?.ok?'ONLINE':'OFFLINE',jobs.length+' jobs',d.services?.higgsfield?.ok],
      ['TGG Projects','ONLINE',(d.projects||[]).length+' projects',true],
      ['TGG CI',d.ci?.status||'NOT RUN',d.ci?.createdAt||'no receipt',d.ci?.status==='PASS'],
      ['Snapshots',String(snaps.length),snaps[0]?.created_at||'none',true]
    ].map(x=>`<div class="stat"><b>${esc(x[0])}</b><div class="${x[3]?'ok':'bad'}">${esc(x[1])}</div><div class="muted">${esc(x[2])}</div></div>`).join('');
    document.getElementById('snapshots').innerHTML=snaps.length?snaps.map(s=>`<div class="item"><div class="row"><b>${esc(s.title)}</b><span>${esc(s.status)}</span></div><div class="muted">${esc(s.id)} · ${esc(s.created_at)}</div></div>`).join(''):'<div class="item muted">No snapshots yet.</div>';
  }catch(e){document.getElementById('live').innerHTML='<div class="stat bad">'+esc(e.message)+'</div>'}
}
async function saveEverything(){
  try{
    const r=await api('/v1/save-everything',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({title:'TGG Save Everything checkpoint'})});
    alert('Saved to TGG Projects: '+r.snapshot.id);
    await load();
  }catch(e){alert(e.message)}
}
load();
</script></body></html>`;
}
http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost');
    const data=await registry();
    if(req.method==='GET'&&url.pathname==='/health')return send(res,200,{ok:true,service:'tgg-projects',owner:'TGG',projects:data.projects?.length||0});
    if(req.method==='GET'&&url.pathname==='/v1/projects')return send(res,200,{ok:true,...data});
    if(req.method==='GET'&&url.pathname==='/v1/dashboard')return send(res,200,{ok:true,...await dashboardState()});
    if(req.method==='POST'&&url.pathname==='/v1/save-everything')return send(res,201,{ok:true,snapshot:await saveEverything(await body(req))});
    if(req.method==='GET'&&url.pathname==='/v1/source/repos'){
      const result=await serviceJson(TGG_SOURCE_URL,'/v1/repos');
      return send(res,result.ok?200:502,result.data);
    }
    if(req.method==='GET'&&url.pathname==='/v1/higgsfield/jobs'){
      const result=await serviceJson(TGG_HIGGSFIELD_URL,'/v1/jobs');
      return send(res,result.ok?200:502,result.data);
    }
    if(req.method==='POST'&&url.pathname==='/v1/higgsfield/jobs'){
      const result=await serviceJson(TGG_HIGGSFIELD_URL,'/v1/jobs',{method:'POST',payload:await body(req)});
      return send(res,result.ok?202:502,result.data);
    }
    if(req.method==='GET'&&url.pathname==='/v1/snapshots')return send(res,200,{ok:true,snapshots:await listSnapshots({project_id:url.searchParams.get('project_id')||null,limit:url.searchParams.get('limit')||100})});
    if(req.method==='POST'&&url.pathname==='/v1/snapshots')return send(res,201,{ok:true,snapshot:await createSnapshot(await body(req))});
    const snap=url.pathname.match(/^\/v1\/snapshots\/([^/]+)$/);
    if(req.method==='GET'&&snap)return send(res,200,{ok:true,snapshot:await getSnapshot(decodeURIComponent(snap[1]))});
    const projectSnaps=url.pathname.match(/^\/v1\/projects\/([^/]+)\/snapshots$/);
    if(req.method==='GET'&&projectSnaps)return send(res,200,{ok:true,snapshots:await listSnapshots({project_id:decodeURIComponent(projectSnaps[1]),limit:url.searchParams.get('limit')||100})});
    if(req.method==='POST'&&projectSnaps){
      const payload=await body(req);
      return send(res,201,{ok:true,snapshot:await createSnapshot({...payload,project_id:decodeURIComponent(projectSnaps[1])})});
    }
    if(req.method==='GET'&&url.pathname==='/')return send(res,200,page(data),'text/html; charset=utf-8');
    send(res,404,{ok:false,error:'not_found'});
  }catch(error){send(res,500,{ok:false,error:String(error?.message||error)})}
}).listen(PORT,HOST,()=>console.log(JSON.stringify({ok:true,service:'tgg-projects',port:PORT})));
