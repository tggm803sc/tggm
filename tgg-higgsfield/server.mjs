import http from 'node:http';
import {init,createJob,getJob,listJobs,updateJob,cancelJob,retryJob} from './job-store.mjs';

const PORT=Number(process.env.TGG_HIGGSFIELD_PORT||10040);
const HOST=process.env.TGG_HIGGSFIELD_HOST||'0.0.0.0';

function send(res,status,body){
  res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-tgg-owner':'TGG','x-tgg-service':'tgg-higgsfield'});
  res.end(JSON.stringify(body,null,2));
}
async function body(req){const chunks=[];for await(const c of req)chunks.push(c);return chunks.length?JSON.parse(Buffer.concat(chunks).toString('utf8')):{}}

await init();
http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost');
    if(req.method==='GET'&&url.pathname==='/health')return send(res,200,{ok:true,service:'tgg-higgsfield',owner:'TGG',external_provider_required:false});
    if(req.method==='GET'&&url.pathname==='/v1/jobs')return send(res,200,{ok:true,jobs:await listJobs({
      status:url.searchParams.get('status')||null,
      project_id:url.searchParams.get('project_id')||null,
      limit:url.searchParams.get('limit')||100
    })});
    if(req.method==='POST'&&url.pathname==='/v1/jobs')return send(res,202,{ok:true,job:await createJob(await body(req))});
    const m=url.pathname.match(/^\/v1\/jobs\/([^/]+)$/);
    if(req.method==='GET'&&m)return send(res,200,{ok:true,job:await getJob(decodeURIComponent(m[1]))});
    if(req.method==='PATCH'&&m)return send(res,200,{ok:true,job:await updateJob(decodeURIComponent(m[1]),await body(req))});
    const action=url.pathname.match(/^\/v1\/jobs\/([^/]+)\/(cancel|retry)$/);
    if(req.method==='POST'&&action){
      const id=decodeURIComponent(action[1]);
      if(action[2]==='cancel')return send(res,200,{ok:true,job:await cancelJob(id)});
      return send(res,202,{ok:true,job:await retryJob(id)});
    }
    send(res,404,{ok:false,error:'not_found'});
  }catch(error){
    const msg=String(error?.message||error);
    send(res,/not_found/.test(msg)?404:400,{ok:false,error:msg});
  }
}).listen(PORT,HOST,()=>console.log(JSON.stringify({ok:true,service:'tgg-higgsfield',port:PORT})));
