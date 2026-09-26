import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {initStore,listRepos,createRepo,getRepo,branches,createBranch,log,tree,readFile,commitFiles} from './repo-store.mjs';

const ROOT=path.dirname(fileURLToPath(import.meta.url));
const PORT=Number(process.env.TGG_SOURCE_PORT||10030);
const HOST=process.env.TGG_SOURCE_HOST||'0.0.0.0';

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

await initStore();
const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost');
    if(req.method==='GET'&&url.pathname==='/health')return send(res,200,{ok:true,service:'tgg-source',owner:'TGG',port:PORT});
    if(req.method==='GET'&&url.pathname==='/')return send(res,200,await fs.readFile(path.join(ROOT,'index.html'),'utf8'),'text/html; charset=utf-8');
    if(req.method==='GET'&&url.pathname==='/v1/repos')return send(res,200,{ok:true,repositories:await listRepos()});
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
      if(req.method==='POST'&&tail==='commits')return send(res,201,{ok:true,result:await commitFiles(name,await body(req))});
    }
    send(res,404,{ok:false,error:'not_found'});
  }catch(error){fail(res,error)}
});
server.listen(PORT,HOST,()=>console.log(JSON.stringify({ok:true,service:'tgg-source',url:'http://'+HOST+':'+PORT})));
