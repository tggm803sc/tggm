import fs from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_ROOT=path.resolve(process.env.TGG_VIDEO_AI_ROOT||'/data/tgg-video-ai');
const SAFE=/^[A-Za-z0-9._-]+$/;

function safe(value,label){
  const out=String(value||'');
  if(!SAFE.test(out))throw new Error(`invalid_${label}`);
  return out;
}
async function syncDir(dir){
  let handle;
  try{handle=await fs.open(dir,'r');await handle.sync();}
  catch(error){if(!['EINVAL','ENOTSUP','EISDIR'].includes(String(error?.code||'')))throw error;}
  finally{await handle?.close().catch(()=>{});}
}
async function durableWrite(file,value){
  const dir=path.dirname(file);
  await fs.mkdir(dir,{recursive:true});
  const tmp=`${file}.tmp-${process.pid}-${Date.now()}`;
  const handle=await fs.open(tmp,'w',0o600);
  try{await handle.writeFile(JSON.stringify(value,null,2)+'\n','utf8');await handle.sync();}
  finally{await handle.close();}
  await fs.rename(tmp,file);
  await syncDir(dir);
}

export function createStore({root=DEFAULT_ROOT}={}){
  const base=path.resolve(root);
  function dir(kind){return path.join(base,safe(kind,'kind'))}
  function file(kind,id){return path.join(dir(kind),safe(id,'id')+'.json')}
  return {
    root:base,
    async put(kind,id,value){await durableWrite(file(kind,id),value);return structuredClone(value)},
    async get(kind,id){
      try{return JSON.parse(await fs.readFile(file(kind,id),'utf8'))}
      catch(error){if(error?.code==='ENOENT')throw new Error('record_not_found');throw error;}
    },
    async list(kind,{projectId=null,status=null,limit=100}={}){
      const max=Math.max(1,Math.min(500,Number(limit)||100));
      let names=[];
      try{names=(await fs.readdir(dir(kind))).filter(x=>x.endsWith('.json')).sort();}
      catch(error){if(error?.code==='ENOENT')return [];throw error;}
      const out=[];
      for(const name of names){
        if(out.length>=max)break;
        try{
          const value=JSON.parse(await fs.readFile(path.join(dir(kind),name),'utf8'));
          if(projectId&&value.projectId!==projectId)continue;
          if(status&&value.status!==status)continue;
          out.push(value);
        }catch{}
      }
      return out;
    },
    async nextVersion(kind,projectId){
      const records=await this.list(kind,{projectId,limit:500});
      return records.reduce((max,item)=>Math.max(max,Number(item.version)||0),0)+1;
    }
  };
}
