#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const expectedSha=process.env.TGG_VIDEO_AI_EXPECTED_SHA||'469518eff0fe1641f6889c5ff78c2f3c0df189c7';
const dir=process.env.TGG_VIDEO_AI_EVIDENCE_DIR||process.argv[2]||'release-evidence';

async function readJson(name){
  const file=path.join(dir,name);
  let text;
  try{text=await fs.readFile(file,'utf8');}
  catch{return {ok:false,error:'evidence_missing:'+name};}
  const lines=text.trim().split(/\r?\n/).filter(Boolean);
  for(let i=lines.length-1;i>=0;i--){
    try{return {ok:true,value:JSON.parse(lines[i])};}catch{}
  }
  try{return {ok:true,value:JSON.parse(text)};}catch{}
  return {ok:false,error:'evidence_invalid_json:'+name};
}

const names=['canary.json','bootstrap.json','browser.json','health.json'];
const loaded=Object.fromEntries(await Promise.all(names.map(async name=>[name,await readJson(name)])));

const failures=[];
for(const name of names){
  if(!loaded[name].ok) failures.push(loaded[name].error);
}

const canary=loaded['canary.json'].value||{};
const bootstrap=loaded['bootstrap.json'].value||{};
const browser=loaded['browser.json'].value||{};
const health=loaded['health.json'].value||{};

if(loaded['canary.json'].ok){
  if(canary.status!=='PASS')failures.push('canary_status');
  if(canary.buildSha!==expectedSha)failures.push('canary_sha');
}
if(loaded['bootstrap.json'].ok){
  if(bootstrap.status!=='HOST_BOOTSTRAP_PASS')failures.push('bootstrap_status');
  if(bootstrap.sha!==expectedSha)failures.push('bootstrap_sha');
}
if(loaded['browser.json'].ok){
  if(browser.status!=='PASS')failures.push('browser_status');
  if(browser.promotion!=='BROWSER_STUDIO_PROOF_PASS')failures.push('browser_promotion_marker');
  if(browser.expectedSha!==expectedSha)failures.push('browser_expected_sha');
  if(browser.health?.buildSha!==expectedSha)failures.push('browser_served_sha');

  const requiredBrowserChecks=['health','exactSha','studioHttp','uiMarkers','mediaUpload','aiFirstCut','editableTimeline','renderComplete','outputVerified'];
  for(const k of requiredBrowserChecks){
    if(browser.checks?.[k]!==true)failures.push('browser_check_'+k);
  }
}
if(loaded['health.json'].ok){
  if(health.ok!==true)failures.push('health_ok');
  if(health.buildSha!==expectedSha)failures.push('health_sha');
}

const result={
  schema:'tgg.video-ai.promotion-gate.v1',
  candidateSha:expectedSha,
  status:failures.length?'HOLD':'PASS',
  failures,
  evidence:{
    canary:'canary.json',
    bootstrap:'bootstrap.json',
    browser:'browser.json',
    health:'health.json'
  },
  promotion:failures.length?'DO_NOT_MERGE':'PROMOTION_EVIDENCE_COMPLETE'
};

console.log(JSON.stringify(result,null,2));
if(failures.length)process.exit(42);
