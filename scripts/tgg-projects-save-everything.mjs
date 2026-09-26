#!/usr/bin/env node
const base=String(process.env.TGG_PROJECTS_URL||'http://127.0.0.1:10020').replace(/\/$/,'');
const payload={
  project_id:String(process.env.TGG_PROJECT_ID||'tgg'),
  title:String(process.env.TGG_SAVE_TITLE||'TGG Save Everything checkpoint'),
  notes:String(process.env.TGG_SAVE_NOTES||'Saved by TGG Projects canonical save command.'),
  branch:process.env.TGG_SAVE_BRANCH||null,
  sha:process.env.TGG_SAVE_SHA||null,
  build:process.env.TGG_SAVE_BUILD||null,
  release:process.env.TGG_SAVE_RELEASE||null
};
const response=await fetch(base+'/v1/save-everything',{
  method:'POST',
  headers:{'content-type':'application/json'},
  body:JSON.stringify(payload),
  signal:AbortSignal.timeout(30000)
});
const data=await response.json().catch(()=>({}));
console.log(JSON.stringify(data,null,2));
if(!response.ok||data?.ok!==true)process.exit(1);
