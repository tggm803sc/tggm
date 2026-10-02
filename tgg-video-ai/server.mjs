import http from 'node:http';
import {createStore} from './store.mjs';
import {createVideoAiOrchestrator} from './orchestrator.mjs';

const HOST=process.env.TGG_VIDEO_AI_HOST||'0.0.0.0';
const PORT=Number(process.env.TGG_VIDEO_AI_PORT||10050);
const PROJECTS=String(process.env.TGG_PROJECTS_URL||'http://127.0.0.1:10020').replace(/\/$/,'');
const store=createStore();
const projectsClient={
 async postEvent(payload){const r=await fetch(PROJECTS+'/v1/events',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(5000)}); if(!r.ok)throw new Error('projects_event_failed'); return r.json();},
 async saveAsset(payload){const id=encodeURIComponent(payload.project_id); const r=await fetch(PROJECTS+`/v1/projects/${id}/assets`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(5000)}); if(!r.ok)throw new Error('projects_asset_failed'); return r.json();}
};
const orch=createVideoAiOrchestrator({store,projectsClient});
function send(res,status,value){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-tgg-owner':'TGG','x-tgg-service':'tgg-video-ai'});res.end(JSON.stringify(value,null,2));}
async function readBody(req){const chunks=[];for await(const c of req)chunks.push(c);return chunks.length?JSON.parse(Buffer.concat(chunks).toString('utf8')):{};}
http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost');
 if(req.method==='GET'&&url.pathname==='/health')return send(res,200,{ok:true,service:'tgg-video-ai',owner:'TGG',orchestration_ready:true,render_proof_required:true});
 let m=url.pathname.match(/^\/v1\/projects\/([^/]+)\/analyze$/); if(req.method==='POST'&&m)return send(res,200,{ok:true,...await orch.analyzeProject(decodeURIComponent(m[1]),await readBody(req))});
 m=url.pathname.match(/^\/v1\/projects\/([^/]+)\/plans$/); if(req.method==='POST'&&m)return send(res,200,{ok:true,...await orch.planProject(decodeURIComponent(m[1]),await readBody(req))});
 m=url.pathname.match(/^\/v1\/projects\/([^/]+)\/plans\/([^/]+)\/apply$/); if(req.method==='POST'&&m)return send(res,200,{ok:true,...await orch.applyPlan(decodeURIComponent(m[1]),decodeURIComponent(m[2]),await readBody(req))});
 m=url.pathname.match(/^\/v1\/projects\/([^/]+)\/renders$/); if(req.method==='POST'&&m){const b=await readBody(req);return send(res,200,{ok:true,...await orch.queueRender(decodeURIComponent(m[1]),Number(b.timelineVersion),b)});}
 m=url.pathname.match(/^\/v1\/jobs\/([^/]+)$/); if(req.method==='GET'&&m)return send(res,200,{ok:true,job:await store.get('render-jobs',decodeURIComponent(m[1]))});
 m=url.pathname.match(/^\/v1\/projects\/([^/]+)\/state$/); if(req.method==='GET'&&m)return send(res,200,{ok:true,state:await orch.getState(decodeURIComponent(m[1]))});
 return send(res,404,{ok:false,error:'not_found'});
}catch(error){send(res,400,{ok:false,error:String(error?.message||error)});}}).listen(PORT,HOST,()=>console.log(`[TGG Video AI] http://${HOST}:${PORT}`));
