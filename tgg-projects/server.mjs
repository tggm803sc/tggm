import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {initSnapshots,createSnapshot,getSnapshot,listSnapshots} from './state-store.mjs';

const ROOT=path.dirname(fileURLToPath(import.meta.url));
const PORT=Number(process.env.TGG_PROJECTS_PORT||10020);
const HOST=process.env.TGG_PROJECTS_HOST||'0.0.0.0';

await initSnapshots();

async function registry(){
  return JSON.parse(await fs.readFile(path.join(ROOT,'registry.json'),'utf8'));
}
async function body(req){
  const chunks=[];for await(const c of req)chunks.push(c);
  return chunks.length?JSON.parse(Buffer.concat(chunks).toString('utf8')):{};
}
function send(res,status,body,type='application/json; charset=utf-8'){
  res.writeHead(status,{'content-type':type,'cache-control':'no-store','x-tgg-owner':'TGG','x-tgg-service':'tgg-projects'});
  res.end(type.startsWith('application/json')?JSON.stringify(body,null,2):body);
}
function page(data){
  const cards=(data.projects||[]).map(p=>`<article><div class="row"><b>${p.name}</b><span>${p.status}</span></div><p>${p.purpose||''}</p><code>${p.path||p.branch||p.id}</code></article>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TGG Projects</title><style>
  body{margin:0;background:#090b10;color:#f4f7fb;font-family:Inter,system-ui,sans-serif}.top{padding:22px 28px;border-bottom:1px solid #222b3a;background:#0e131c}.wrap{max-width:1200px;margin:auto;padding:30px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}article{border:1px solid #263047;background:#111824;border-radius:16px;padding:18px}.row{display:flex;justify-content:space-between;gap:12px}.row span{font-size:12px;color:#9fb0c8}.muted,p{color:#91a0b6}code{color:#c7d5eb}@media(max-width:850px){.grid{grid-template-columns:1fr}}</style></head><body><div class="top"><b>TGG PROJECTS</b><div class="muted">Primary repository · ${data.primary_repository}</div></div><div class="wrap"><h1>TGG Platform</h1><p>One place for the TGG game, source control, runtime, cloud, CI, Creator OS and media tools.</p><div class="grid">${cards}</div></div></body></html>`;
}
http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost');
    const data=await registry();
    if(req.method==='GET'&&url.pathname==='/health')return send(res,200,{ok:true,service:'tgg-projects',owner:'TGG',projects:data.projects?.length||0});
    if(req.method==='GET'&&url.pathname==='/v1/projects')return send(res,200,{ok:true,...data});
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
