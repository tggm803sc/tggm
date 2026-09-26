#!/usr/bin/env node
const source=String(process.env.TGG_SOURCE_URL||'http://127.0.0.1:10030').replace(/\/$/,'');
const projects=String(process.env.TGG_PROJECTS_URL||'http://127.0.0.1:10020').replace(/\/$/,'');
const desired=[
  {name:'tgg-platform',url:'https://github.com/tggm803sc/tggm.git'},
  {name:'tru-go-getta-mixtape',url:'https://github.com/tggm803sc/tru-go-getta-mixtape.git'}
];

async function request(base,pathname,options={}){
  const response=await fetch(base+pathname,{
    ...options,
    headers:{'content-type':'application/json',...(options.headers||{})},
    signal:AbortSignal.timeout(Number(process.env.TGG_MIGRATION_TIMEOUT_MS||180000))
  });
  const text=await response.text();
  let body={};try{body=text?JSON.parse(text):{}}catch{}
  if(!response.ok||body?.ok===false)throw new Error(body?.error||('HTTP '+response.status+' '+pathname));
  return body;
}

const health=await request(source,'/health');
if(health.service!=='tgg-source'||health.owner!=='TGG')throw new Error('tgg_source_identity_mismatch');

const existing=await request(source,'/v1/repos');
const names=new Set((existing.repositories||[]).map(repo=>repo.name));
const imported=[];

for(const item of desired){
  if(!names.has(item.name)){
    const result=await request(source,'/v1/import',{
      method:'POST',
      body:JSON.stringify(item)
    });
    imported.push({name:item.name,status:'imported',head:result?.imported?.head||null});
    names.add(item.name);
  }else{
    imported.push({name:item.name,status:'already-present'});
  }

  const backup=await request(source,'/v1/repos/'+encodeURIComponent(item.name)+'/export',{
    method:'POST',
    body:JSON.stringify({ref:'--all'})
  });
  imported[imported.length-1].bundle_id=backup?.bundle?.id||null;
  imported[imported.length-1].bundle_sha256=backup?.bundle?.sha256||null;
  imported[imported.length-1].bundle_bytes=backup?.bundle?.bytes||null;
  imported[imported.length-1].project_saved=backup?.project_saved===true;
}

const saved=await request(projects,'/v1/save-everything',{
  method:'POST',
  body:JSON.stringify({
    project_id:'tgg',
    title:'TGG GitHub-to-TGG Source migration checkpoint',
    notes:'Canonical TGG platform and game repositories imported/backed up in TGG Source and sealed in TGG Projects.'
  })
});

const manifestId=String(saved?.manifest?.id||'');
if(!manifestId)throw new Error('migration_save_manifest_missing');

const verified=await request(projects,'/v1/save-manifests/'+encodeURIComponent(manifestId)+'/verify',{
  method:'POST',
  body:'{}'
});
if(verified?.verification?.ok!==true)throw new Error('migration_save_verification_failed');

console.log(JSON.stringify({
  ok:true,
  gate:'TGG_GITHUB_TO_SOURCE_MIGRATION',
  owner:'TGG',
  source_service:source,
  projects_service:projects,
  repositories:imported,
  snapshot_id:saved?.snapshot?.id||null,
  manifest_id:manifestId,
  manifest_sha256:saved?.manifest?.manifest_sha256||null,
  verified:true,
  normal_working_home:'TGG Source + TGG Projects',
  legacy_bootstrap:'GitHub'
},null,2));
