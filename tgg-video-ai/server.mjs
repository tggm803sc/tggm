import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {createStore} from './store.mjs';
import {createVideoAiOrchestrator} from './orchestrator.mjs';
import {normalizeMediaAsset} from './contracts.mjs';

const HOST=process.env.TGG_VIDEO_AI_HOST||'0.0.0.0';
const PORT=Number(process.env.TGG_VIDEO_AI_PORT||10050);
const PROJECTS=String(process.env.TGG_PROJECTS_URL||'http://127.0.0.1:10020').replace(/\/$/,'');
const ROOT=path.resolve(process.env.TGG_VIDEO_AI_ROOT||'/data/tgg-video-ai');
const UPLOAD_ROOT=path.join(ROOT,'uploads');
const MAX_UPLOAD_BYTES=Math.max(1024*1024,Number(process.env.TGG_VIDEO_AI_MAX_UPLOAD_BYTES||2147483648));
const ALLOWED_ORIGINS=new Set(String(process.env.TGG_VIDEO_AI_ALLOWED_ORIGINS||'https://tgg-video-studio-ai-editor.olandusgood.chatgpt.site').split(',').map(x=>x.trim()).filter(Boolean));
function cors(req){
  const origin=String(req.headers.origin||'');
  return origin&&ALLOWED_ORIGINS.has(origin)?{'access-control-allow-origin':origin,'vary':'Origin','access-control-allow-methods':'GET,POST,PUT,OPTIONS','access-control-allow-headers':'content-type,x-tgg-asset-name,x-tgg-asset-type,x-tgg-duration-ms'}:{};
}
function safeId(value,label){
  const v=String(value||'');
  if(!/^[A-Za-z0-9._-]+$/.test(v))throw new Error('invalid_'+label);
  return v;
}
const store=createStore();
const projectsClient={
 async postEvent(payload){const r=await fetch(PROJECTS+'/v1/events',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(5000)}); if(!r.ok)throw new Error('projects_event_failed'); return r.json();},
 async saveAsset(payload){const id=encodeURIComponent(payload.project_id); const r=await fetch(PROJECTS+`/v1/projects/${id}/assets`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(5000)}); if(!r.ok)throw new Error('projects_asset_failed'); return r.json();}
};
const orch=createVideoAiOrchestrator({store,projectsClient});
function send(res,status,value,extra={}){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-tgg-owner':'TGG','x-tgg-service':'tgg-video-ai',...extra});res.end(JSON.stringify(value,null,2));}
async function readBody(req){const chunks=[];for await(const c of req)chunks.push(c);return chunks.length?JSON.parse(Buffer.concat(chunks).toString('utf8')):{};}
http.createServer(async(req,res)=>{try{
 const ch=cors(req);
 if(req.method==='OPTIONS'){res.writeHead(204,ch);return res.end();}
 const url=new URL(req.url,'http://localhost');
 if(req.method==='GET'&&url.pathname==='/.well-known/tgg-video-ai.json'){
   return send(res,200,{
     schema:'tgg.video-ai.discovery.v1',
     owner:'TGG',
     service:'tgg-video-ai',
     version:'v1',
     health:'/health',
     openapi:'/openapi.json',
     bridge:'/v1/client/tgg-video-ai-bridge.js',
     capabilities:['media-upload','media-analysis','music-analysis','editable-ai-plan','timeline-apply','ffmpeg-render','verified-output']
   },ch);
 }
 if(req.method==='GET'&&url.pathname==='/openapi.json'){
   return send(res,200,{
     openapi:'3.1.0',
     info:{title:'TGG Video AI API',version:'1.0.0'},
     paths:{
       '/health':{get:{summary:'Service health'}},
       '/v1/projects/{projectId}/assets/{assetId}':{put:{summary:'Upload media asset'}},
       '/v1/projects/{projectId}/analyze':{post:{summary:'Analyze project media'}},
       '/v1/projects/{projectId}/plans':{post:{summary:'Create editable AI edit plan'}},
       '/v1/projects/{projectId}/plans/{planId}/apply':{post:{summary:'Apply AI plan to editable timeline'}},
       '/v1/projects/{projectId}/renders':{post:{summary:'Queue verified render'}},
       '/v1/jobs/{jobId}':{get:{summary:'Read render job'}},
       '/v1/outputs/{assetId}':{get:{summary:'Read verified rendered output'}}
     }
   },ch);
 }
 if(req.method==='GET'&&url.pathname==='/v1/client/tgg-video-ai-bridge.js'){
   const file=new URL('./browser-bridge.mjs',import.meta.url);
   const body=await fs.promises.readFile(file);
   res.writeHead(200,{'content-type':'text/javascript; charset=utf-8','cache-control':'no-store','x-tgg-owner':'TGG','x-tgg-service':'tgg-video-ai',...ch});
   return res.end(body);
 }
 let uploadMatch=url.pathname.match(/^\/v1\/projects\/([^/]+)\/assets\/([^/]+)$/);
 if(req.method==='PUT'&&uploadMatch){
   const projectId=safeId(decodeURIComponent(uploadMatch[1]),'project_id');
   const assetId=safeId(decodeURIComponent(uploadMatch[2]),'asset_id');
   const length=Number(req.headers['content-length']||0);
   if(length>MAX_UPLOAD_BYTES)return send(res,413,{ok:false,error:'upload_too_large'},ch);
   const dir=path.join(UPLOAD_ROOT,projectId); await fs.promises.mkdir(dir,{recursive:true});
   const target=path.join(dir,assetId);
   let total=0; const out=fs.createWriteStream(target,{flags:'wx',mode:0o600});
   try{
     for await(const chunk of req){
       total+=chunk.length;if(total>MAX_UPLOAD_BYTES)throw new Error('upload_too_large');
       if(!out.write(chunk))await new Promise(r=>out.once('drain',r));
     }
     await new Promise((resolve,reject)=>out.end(err=>err?reject(err):resolve()));
   }catch(error){out.destroy();await fs.promises.unlink(target).catch(()=>{});throw error;}
   const durationMs=Math.max(0,Number(req.headers['x-tgg-duration-ms']||0));
   const type=String(req.headers['x-tgg-asset-type']||'video')==='audio'?'audio':'video';
   const name=decodeURIComponent(String(req.headers['x-tgg-asset-name']||assetId));
   const asset=normalizeMediaAsset({id:assetId,projectId,type,version:1,durationMs,uri:target,metadata:{name,mimeType:String(req.headers['content-type']||'application/octet-stream'),sizeBytes:total}});
   await store.put('media-assets',asset.id,asset);
   return send(res,200,{ok:true,asset},ch);
 }
 let outputMatch=url.pathname.match(/^\/v1\/outputs\/([^/]+)$/);
 if(req.method==='GET'&&outputMatch){
   const output=await store.get('render-outputs',decodeURIComponent(outputMatch[1]));
   const root=path.resolve(process.env.TGG_VIDEO_AI_OUTPUT_DIR||'/data/tgg-video-ai/outputs');
   const file=path.resolve(String(output.storagePath||''));
   if(!file.startsWith(root+path.sep))return send(res,403,{ok:false,error:'output_path_rejected'},ch);
   const stat=await fs.promises.stat(file);
   res.writeHead(200,{'content-type':output.mimeType||'video/mp4','content-length':stat.size,'cache-control':'private, max-age=0','x-tgg-owner':'TGG','x-tgg-service':'tgg-video-ai',...ch});
   return fs.createReadStream(file).pipe(res);
 }
 if(req.method==='GET'&&url.pathname==='/health')return send(res,200,{ok:true,service:'tgg-video-ai',owner:'TGG',orchestration_ready:true,render_proof_required:true},ch);
 let m=url.pathname.match(/^\/v1\/projects\/([^/]+)\/analyze$/); if(req.method==='POST'&&m)return send(res,200,{ok:true,...await orch.analyzeProject(decodeURIComponent(m[1]),await readBody(req))},ch);
 m=url.pathname.match(/^\/v1\/projects\/([^/]+)\/plans$/); if(req.method==='POST'&&m)return send(res,200,{ok:true,...await orch.planProject(decodeURIComponent(m[1]),await readBody(req))},ch);
 m=url.pathname.match(/^\/v1\/projects\/([^/]+)\/plans\/([^/]+)\/apply$/); if(req.method==='POST'&&m)return send(res,200,{ok:true,...await orch.applyPlan(decodeURIComponent(m[1]),decodeURIComponent(m[2]),await readBody(req))},ch);
 m=url.pathname.match(/^\/v1\/projects\/([^/]+)\/renders$/); if(req.method==='POST'&&m){const b=await readBody(req);return send(res,200,{ok:true,...await orch.queueRender(decodeURIComponent(m[1]),Number(b.timelineVersion),b)},ch);}
 m=url.pathname.match(/^\/v1\/jobs\/([^/]+)$/); if(req.method==='GET'&&m)return send(res,200,{ok:true,job:await store.get('render-jobs',decodeURIComponent(m[1]))},ch);
 m=url.pathname.match(/^\/v1\/projects\/([^/]+)\/state$/); if(req.method==='GET'&&m)return send(res,200,{ok:true,state:await orch.getState(decodeURIComponent(m[1]))},ch);
 return send(res,404,{ok:false,error:'not_found'},ch);
}catch(error){send(res,400,{ok:false,error:String(error?.message||error)},cors(req));}}).listen(PORT,HOST,()=>console.log(`[TGG Video AI] http://${HOST}:${PORT}`));
