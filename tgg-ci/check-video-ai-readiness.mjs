#!/usr/bin/env node
import fs from 'node:fs/promises';

const fixtures={
  missing:{service:false,editorBridge:false,analysisPlanTimeline:false,renderWorker:false,verifiedOutput:false,manifestHashMatch:false},
  'no-editor':{service:true,editorBridge:false,analysisPlanTimeline:true,renderWorker:true,verifiedOutput:true,manifestHashMatch:true},
  'no-renderer':{service:true,editorBridge:true,analysisPlanTimeline:true,renderWorker:false,verifiedOutput:false,manifestHashMatch:false},
  'false-success':{service:true,editorBridge:true,analysisPlanTimeline:true,renderWorker:true,verifiedOutput:false,manifestHashMatch:true},
  valid:{service:true,editorBridge:true,analysisPlanTimeline:true,renderWorker:true,verifiedOutput:true,manifestHashMatch:true}
};
function arg(name){const i=process.argv.indexOf(name);return i>=0?process.argv[i+1]:null;}
async function loadEvidence(){
  const fixture=arg('--fixture');
  if(fixture){if(!fixtures[fixture])throw new Error('unknown_fixture');return {evidence:fixtures[fixture],evidenceMode:'fixture'};}
  const file=arg('--evidence');
  if(!file)throw new Error('evidence_required');
  return {evidence:JSON.parse(await fs.readFile(file,'utf8')),evidenceMode:'live'};
}
function evaluate(e,evidenceMode){
  const checks={service:e.service===true,editorBridge:e.editorBridge===true,analysisPlanTimeline:e.analysisPlanTimeline===true,renderWorker:e.renderWorker===true,verifiedOutput:e.verifiedOutput===true,manifestHashMatch:e.manifestHashMatch===true};
  const names={service:'video_ai_service_unavailable',editorBridge:'editor_bridge_unverified',analysisPlanTimeline:'analysis_plan_timeline_unverified',renderWorker:'render_worker_unavailable',verifiedOutput:'render_output_unverified',manifestHashMatch:'manifest_hash_mismatch'};
  const blockers=Object.entries(checks).filter(([,ok])=>!ok).map(([k])=>names[k]);
  const status=blockers.length?'HOLD':'PASS';
  return {schema:'tgg.video-ai.readiness.v1',status,evidenceMode,promotable:status==='PASS'&&evidenceMode==='live',checks,blockers};
}
try{
  const loaded=await loadEvidence();
  const result=evaluate(loaded.evidence,loaded.evidenceMode);
  console.log(JSON.stringify(result,null,2));
  process.exit(result.status==='PASS'?0:1);
}catch(error){
  console.error(JSON.stringify({schema:'tgg.video-ai.readiness.v1',status:'HOLD',evidenceMode:'unknown',promotable:false,checks:{service:false,editorBridge:false,analysisPlanTimeline:false,renderWorker:false,verifiedOutput:false,manifestHashMatch:false},blockers:[String(error?.message||error)]},null,2));
  process.exit(1);
}
