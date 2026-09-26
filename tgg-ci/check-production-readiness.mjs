#!/usr/bin/env node
import fs from 'node:fs/promises';

const read=async f=>JSON.parse((await fs.readFile(f,'utf8')).trim().replace(/\\n$/,''));
const [project,state,working,domains,ready,oci,activation,liveReq,approved,provenance]=await Promise.all([
  read('TGG-PROJECT.json'),
  read('tgg-projects/project-state-2026-09-25.json'),
  read('tgg-projects/library-working-set.json'),
  read('tgg-projects/artifact-domains.json'),
  read('tgg-projects/production-readiness.json'),
  read('infra/oci/source-state.json'),
  read('tgg-activation/checkpoint.json'),
  read('tgg-activation/live-requirements.json'),
  read('tgg-approved-release.json'),
  read('tgg-projects/development-provenance-v200.json')
]);

const expectedBranch=provenance.branch;
const expectedHead=String(provenance.branchHead||'').toLowerCase();
const expectedOverlay=provenance.overlay;
const expectedCleaner=String(provenance.cleaner);
const expectedManifest=provenance.runtimeManifest?.path;
const expectedManifestBlob=String(provenance.runtimeManifest?.gitBlobSha||'').toLowerCase();
const expectedR224='faf8a6a89049d32af13df5f4e1cbd65ee2ba7742e63989790ab2abc0fce054fa';
const expectedR227='b36596a996558d53daa5ded3e62f2599417cb0e1b87761e8895a908ed915ebd3';

const checks={
  provenance_schema:provenance.schema==='tgg.development.provenance.v1',
  provenance_status:provenance.status==='VERIFIED_BRANCH_SNAPSHOT',
  provenance_repo:provenance.repository==='tggm803sc/tggm',
  project_provenance_path:project.development_provenance==='tgg-projects/development-provenance-v200.json',
  project_branch_head:String(project.active_development_branch_head||'').toLowerCase()===expectedHead,
  project_manifest_blob:String(project.active_runtime_manifest_git_blob_sha||'').toLowerCase()===expectedManifestBlob,
  project_branch:project.active_branch===expectedBranch,
  project_overlay:project.active_development_overlay===expectedOverlay,
  project_cleaner:String(project.active_cleaner)===expectedCleaner,
  project_manifest:project.active_runtime_manifest===expectedManifest,
  state_branch:state.development?.branch===expectedBranch,
  state_branch_head:String(state.development?.branch_head||'').toLowerCase()===expectedHead,
  state_overlay:state.development?.overlay===expectedOverlay,
  state_cleaner:String(state.development?.cleaner)===expectedCleaner,
  state_manifest:state.development?.runtime_manifest===expectedManifest,
  state_manifest_blob:String(state.development?.runtime_manifest_git_blob_sha||'').toLowerCase()===expectedManifestBlob,
  working_branch:working.workingSet?.gameDevelopment?.branch===expectedBranch,
  working_branch_head:String(working.workingSet?.gameDevelopment?.branchHead||'').toLowerCase()===expectedHead,
  working_overlay:working.workingSet?.gameDevelopment?.overlay===expectedOverlay,
  working_manifest:working.workingSet?.gameDevelopment?.runtimeManifest===expectedManifest,
  r224_domain:String(domains.domains?.worldRuntimeR224?.sha||'').toLowerCase()===expectedR224,
  r227_domain:String(domains.domains?.certificationR227?.sha||'').toLowerCase()===expectedR227,
  domains_separate:expectedR224!==expectedR227,
  readiness_schema:ready.schema==='tgg.production.readiness.v1',
  readiness_blocked:ready.status==='BLOCKED_PENDING_LIVE_INFRASTRUCTURE_AND_EVIDENCE',
  readiness_branch_head:String(ready.activeDevelopment?.branchHead||'').toLowerCase()===expectedHead,
  readiness_has_blockers:Array.isArray(ready.corePromotionBlockers)&&ready.corePromotionBlockers.length>0,
  oci_apply_not_run:oci.resourceManagerApply==='NOT_RUN',
  activation_live_not_run:activation.productionRunbook==='NOT_EXECUTED_LIVE',
  activation_r232_not_executed:activation.r232==='NOT_EXECUTED',
  live_host_required:liveReq.liveStatus==='LIVE_HOST_DISCOVERY_REQUIRED',
  production_not_promoted:approved.status==='APPROVED_CANDIDATE_NOT_YET_PROMOTED'
};

const failed=Object.entries(checks).filter(([,v])=>!v).map(([k])=>k);
const report={
  schema:'tgg.production.readiness.check.v1',
  status:failed.length?'INVALID_STATE':ready.status,
  canonicalRepository:'tggm803sc/tggm',
  activeDevelopment:{
    branch:expectedBranch,
    branchHead:expectedHead,
    overlay:expectedOverlay,
    cleaner:expectedCleaner,
    runtimeManifest:expectedManifest
  },
  corePromotionBlockers:ready.corePromotionBlockers,
  parallelProductBlockers:ready.parallelProductBlockers,
  checks,
  failed,
  r232PromotionExecuted:false
};

console.log(JSON.stringify(report,null,2));
if(failed.length) process.exit(2);
process.exit(3);
