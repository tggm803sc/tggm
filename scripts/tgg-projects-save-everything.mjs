#!/usr/bin/env node
const base=String(process.env.TGG_PROJECTS_URL||'http://127.0.0.1:10020').replace(/\/$/,'');
const payload={
  project_id:String(process.env.TGG_PROJECT_ID||'tgg'),
  title:String(process.env.TGG_SAVE_TITLE||'TGG Save Everything checkpoint'),
  notes:String(process.env.TGG_SAVE_NOTES||'Saved by TGG Projects canonical save-and-verify command.'),
  branch:process.env.TGG_SAVE_BRANCH||null,
  sha:process.env.TGG_SAVE_SHA||null,
  build:process.env.TGG_SAVE_BUILD||null,
  release:process.env.TGG_SAVE_RELEASE||null
};

async function request(pathname,options={}){
  const response=await fetch(base+pathname,{
    ...options,
    headers:{'content-type':'application/json',...(options.headers||{})},
    signal:AbortSignal.timeout(Number(process.env.TGG_PROJECTS_SAVE_TIMEOUT_MS||120000))
  });
  const text=await response.text();
  let data={};try{data=text?JSON.parse(text):{}}catch{}
  if(!response.ok||data?.ok!==true)throw new Error(data?.error||('HTTP '+response.status));
  return data;
}

const saved=await request('/v1/save-everything',{
  method:'POST',
  body:JSON.stringify(payload)
});

const manifestId=String(saved?.manifest?.id||'').trim();
if(!manifestId)throw new Error('save_manifest_missing');

const verified=await request('/v1/save-manifests/'+encodeURIComponent(manifestId)+'/verify',{
  method:'POST',
  body:'{}'
});

if(verified?.verification?.ok!==true)throw new Error('save_manifest_verification_failed');

console.log(JSON.stringify({
  ok:true,
  gate:'TGG_PROJECTS_SAVE_AND_VERIFY',
  owner:'TGG',
  project_id:payload.project_id,
  snapshot_id:saved?.snapshot?.id||null,
  manifest_id:manifestId,
  manifest_sha256:saved?.manifest?.manifest_sha256||null,
  source_backup_count:verified?.verification?.source_backups?.length||0,
  verified_at:verified?.verification?.verified_at||null
},null,2));
