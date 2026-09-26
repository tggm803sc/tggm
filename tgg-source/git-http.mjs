import {spawn} from 'node:child_process';
import path from 'node:path';
import {ROOT as SOURCE_ROOT,safeName} from './repo-store.mjs';

const REPOS=path.join(SOURCE_ROOT,'repos');

function unauthorized(res,message='git_auth_required'){
  res.writeHead(401,{
    'content-type':'application/json; charset=utf-8',
    'www-authenticate':'Basic realm="TGG Source Git"',
    'cache-control':'no-store',
    'x-tgg-owner':'TGG',
    'x-tgg-service':'tgg-source'
  });
  res.end(JSON.stringify({ok:false,error:message},null,2));
}

function parseAuth(req){
  const header=String(req.headers.authorization||'');
  if(header.startsWith('Bearer '))return header.slice(7).trim();
  if(header.startsWith('Basic ')){
    try{
      const decoded=Buffer.from(header.slice(6),'base64').toString('utf8');
      const idx=decoded.indexOf(':');
      return idx>=0?decoded.slice(idx+1):decoded;
    }catch{return ''}
  }
  return '';
}

function wantsReceivePack(url){
  return url.searchParams.get('service')==='git-receive-pack'
    ||url.pathname.endsWith('/git-receive-pack');
}

function parsePath(url){
  const match=url.pathname.match(/^\/git\/([A-Za-z0-9._-]+)(\/.*)?$/);
  if(!match)throw new Error('invalid_git_path');
  const repo=safeName(match[1]);
  const suffix=match[2]||'/';
  return {
    repo,
    pathInfo:'/'+repo+'/.git'+suffix,
  };
}

function writeCgiHeaders(res,raw){
  const lines=raw.split(/\r?\n/).filter(Boolean);
  let status=200;
  const headers={
    'cache-control':'no-store',
    'x-tgg-owner':'TGG',
    'x-tgg-service':'tgg-source',
    'x-tgg-git-transport':'smart-http'
  };
  for(const line of lines){
    const idx=line.indexOf(':');
    if(idx<0)continue;
    const key=line.slice(0,idx).trim();
    const value=line.slice(idx+1).trim();
    if(key.toLowerCase()==='status'){
      status=Number(value.split(' ')[0])||200;
    }else{
      headers[key]=value;
    }
  }
  res.writeHead(status,headers);
}

export async function handleGitHttp(req,res,url){
  const token=String(process.env.TGG_SOURCE_GIT_TOKEN||'');
  const pushing=wantsReceivePack(url);
  const supplied=parseAuth(req);
  const authenticated=Boolean(token)&&supplied===token;

  if(pushing&&!token){
    res.writeHead(503,{
      'content-type':'application/json; charset=utf-8',
      'cache-control':'no-store',
      'x-tgg-owner':'TGG',
      'x-tgg-service':'tgg-source'
    });
    return res.end(JSON.stringify({
      ok:false,
      error:'git_push_token_not_configured',
      hint:'Set TGG_SOURCE_GIT_TOKEN to enable authenticated Git push.'
    },null,2));
  }
  if(pushing&&!authenticated)return unauthorized(res);
  if(!pushing&&token&&process.env.TGG_SOURCE_GIT_PUBLIC_READ!=='1'&&!authenticated)return unauthorized(res);

  let parsed;
  try{parsed=parsePath(url)}
  catch(error){
    res.writeHead(400,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});
    return res.end(JSON.stringify({ok:false,error:String(error?.message||error)},null,2));
  }

  const env={
    ...process.env,
    GIT_PROJECT_ROOT:REPOS,
    GIT_HTTP_EXPORT_ALL:'1',
    PATH_INFO:parsed.pathInfo,
    REQUEST_METHOD:String(req.method||'GET'),
    QUERY_STRING:url.searchParams.toString(),
    CONTENT_TYPE:String(req.headers['content-type']||''),
    CONTENT_LENGTH:String(req.headers['content-length']||''),
    SERVER_PROTOCOL:'HTTP/1.1',
    SERVER_NAME:String(req.headers.host||'tgg-source').split(':')[0],
    REMOTE_ADDR:String(req.socket?.remoteAddress||''),
    REMOTE_USER:authenticated?'tgg':''
  };

  const child=spawn('git',['http-backend'],{
    cwd:REPOS,
    env,
    stdio:['pipe','pipe','pipe']
  });

  let headerBuffer=Buffer.alloc(0);
  let headersSent=false;
  let stderr='';

  child.stderr.on('data',chunk=>{
    if(stderr.length<65536)stderr+=chunk.toString('utf8');
  });

  child.stdout.on('data',chunk=>{
    if(headersSent){
      res.write(chunk);
      return;
    }
    headerBuffer=Buffer.concat([headerBuffer,chunk]);
    if(headerBuffer.length>65536){
      child.kill('SIGKILL');
      if(!res.headersSent)res.writeHead(502,{'content-type':'application/json; charset=utf-8'});
      res.end(JSON.stringify({ok:false,error:'git_backend_headers_too_large'}));
      return;
    }
    const crlf=headerBuffer.indexOf('\r\n\r\n');
    const lf=headerBuffer.indexOf('\n\n');
    const splitAt=crlf>=0?crlf:lf;
    const gap=crlf>=0?4:2;
    if(splitAt<0)return;
    writeCgiHeaders(res,headerBuffer.subarray(0,splitAt).toString('utf8'));
    headersSent=true;
    const rest=headerBuffer.subarray(splitAt+gap);
    if(rest.length)res.write(rest);
    headerBuffer=Buffer.alloc(0);
  });

  child.on('error',error=>{
    if(!res.headersSent)res.writeHead(502,{'content-type':'application/json; charset=utf-8'});
    if(!res.writableEnded)res.end(JSON.stringify({ok:false,error:'git_backend_start_failed',detail:String(error?.message||error)}));
  });

  child.on('close',code=>{
    if(!headersSent&&!res.headersSent){
      res.writeHead(code===0?200:502,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});
    }
    if(!res.writableEnded){
      if(!headersSent&&code!==0)res.end(JSON.stringify({ok:false,error:'git_backend_failed',code,detail:stderr.slice(-4000)}));
      else res.end();
    }
  });

  req.on('aborted',()=>child.kill('SIGTERM'));
  req.pipe(child.stdin);
}
