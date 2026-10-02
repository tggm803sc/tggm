#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const expectedSha=process.env.TGG_VIDEO_AI_EXPECTED_SHA||'469518eff0fe1641f6889c5ff78c2f3c0df189c7';
const dir=process.env.TGG_VIDEO_AI_EVIDENCE_DIR||process.argv[2]||'release-evidence';

async function readJson(name){
  const file=path.join(dir,name);
  let text;
  try{text=await fs.readFile(file,'utf8');}
  catch{throw new Error('EVIDENCE_MISSING:'+name);}
  const lines=text.trim().split(/?
/).filter(Boolean);
  for(let i=lines.length-1;i>=0;i--){
    try{return JSON.parse(lines[i]);}catch{}
  }
  try{return JSON.parse(text);}catch{}
  throw new Error('EVIDENCE_INVALID_JSON:'+name);
}

const canary=await readJson('canary.json');
const bootstrap=await readJson('bootstrap.json');
const browser=await readJson('browser.json');
const health=await readJson('health.json');

const failures=[];
if(canary.status!=='PASS')failures.push('canary_status');
if(canary.buildSha!==expectedSha)failures.push('canary_sha');
if(bootstrap.status!=='HOST_BOOTSTRAP_PASS')failures.push('bootstrap_status');
if(bootstrap.sha!==expectedSha)failures.push('bootstrap_sha');
if(browser.status!=='PASS')failures.push('browser_status');
if(browser.promotion!=='BROWSER_STUDIO_PROOF_PASS')failures.push('browser_promotion_marker');
if(browser.expectedSha!==expectedSha)failures.push('browser_expected_sha');
if(browser.health?.buildSha!==expectedSha)failures.push('browser_served_sha');
if(health.ok!==true)failures.push('health_ok');
if(health.buildSha!==expectedSha)failures.push('health_sha');

const requiredBrowserChecks=['health','exactSha','studioHttp','uiMarkers','mediaUpload','aiFirstCut','editableTimeline','renderComplete','outputVerified'];
for(const k of requiredBrowserChecks){
  if(browser.checks?.[k]!==true)failures.push('browser_check_'+k);
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
