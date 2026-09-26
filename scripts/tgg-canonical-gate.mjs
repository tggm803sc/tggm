#!/usr/bin/env node
import fs from 'node:fs/promises';
import crypto from 'node:crypto';

const read=async file=>JSON.parse(await fs.readFile(file,'utf8'));
const [project,registry,approved,state,activation,activationValidation,runbook,sourceLock,liveRequirements,ociSource,artifactDomains,libraryWorkingSet,developmentProvenance]=await Promise.all([
  read('TGG-PROJECT.json'),
  read('tgg-projects/registry.json'),
  read('tgg-approved-release.json'),
  read('tgg-projects/project-state-2026-09-25.json'),
  read('tgg-activation/checkpoint.json'),
  read('tgg-activation/validation-v21.json'),
  read('tgg-activation/runbook-contract.json'),
  read('tgg-activation/source-lock.json'),
  read('tgg-activation/live-requirements.json'),
  read('infra/oci/source-state.json'),
  read('tgg-projects/artifact-domains.json'),
  read('tgg-projects/library-working-set.json'),
  read('tgg-projects/development-provenance-v199.json')
]);

const expectedRepo='tggm803sc/tggm';
const expectedReleaseSha='ea27aca634f3c2b92fc430a232f5f8d0be4fba23';
const expectedActivationLine='V21_FINAL';
const expectedActivationBundle='0f5ab2f19f5b311c360a1b683262964d07a17cfceb1d0b4bf23291e86152a921';
const expectedCandidateSha='b36596a996558d53daa5ded3e62f2599417cb0e1b87761e8895a908ed915ebd3';
const expectedSourceLockBlob='94bb1fa2e6825ea70228d605ad6376009c8ba0f3';


const gitBlobSha=async file=>{
  const body=await fs.readFile(file);
  const header=Buffer.from(`blob ${body.length}\0`);
  return crypto.createHash('sha1').update(header).update(body).digest('hex');
};

const sourceChecks={};
for(const item of sourceLock.files||[]){
  const actual=await gitBlobSha(item.path);
  sourceChecks[`activation_source:${item.path}`]=actual===String(item.gitBlobSha||'').toLowerCase();
}

const checks={
  project_primary:project.primary_repository===expectedRepo,
  project_save_target:project.canonical_save_target===expectedRepo,
  project_status:project.status==='CANONICAL_TGG_PRIMARY_ACTIVE',
  registry_primary:registry.primary_repository===expectedRepo,
  registry_save_target:registry.canonical_save_target===expectedRepo,
  approved_release_sha:String(approved.final_commit||'').toLowerCase()===expectedReleaseSha,
  approved_release_branch:approved.final_branch==='tgg-world-release-v135-final',
  provenance_schema:developmentProvenance.schema==='tgg.development.provenance.v1',
  provenance_status:developmentProvenance.status==='VERIFIED_BRANCH_SNAPSHOT',
  provenance_repo:developmentProvenance.repository===expectedRepo,
  provenance_branch:developmentProvenance.branch==='tgg-world-mega-1000x',
  provenance_head:String(developmentProvenance.branchHead||'').toLowerCase()==='22b3f4e320764fe1451a238d4b72de8395eebf08',
  provenance_tree:String(developmentProvenance.branchTree||'').toLowerCase()==='cd2e5e2d0e74beed98da9171569e41445109c69e',
  provenance_manifest_blob:String(developmentProvenance.runtimeManifest?.gitBlobSha||'').toLowerCase()==='88fdb82a3a74421b7a977833b9499e08dfe372aa',
  provenance_project_state_blob:String(developmentProvenance.projectState?.gitBlobSha||'').toLowerCase()==='24f5b574a5ac0b83ec4de8da050914921b3b4364',
  provenance_development_record_blob:String(developmentProvenance.developmentRecord?.gitBlobSha||'').toLowerCase()==='5947e97c4073a23c0a56e9df41c52638639e7ad6',
  provenance_canonical_save_blob:String(developmentProvenance.canonicalSave?.gitBlobSha||'').toLowerCase()==='aecf3425b8ad489c573f87de11f6a78da499a1c4',
  active_branch:project.active_branch===developmentProvenance.branch,
  active_overlay:project.active_development_overlay===developmentProvenance.overlay,
  active_cleaner:String(project.active_cleaner)===String(developmentProvenance.cleaner),
  active_project_head:String(project.active_development_branch_head||'').toLowerCase()===String(developmentProvenance.branchHead||'').toLowerCase(),
  active_manifest_blob:String(project.active_runtime_manifest_git_blob_sha||'').toLowerCase()===String(developmentProvenance.runtimeManifest?.gitBlobSha||'').toLowerCase(),
  saved_snapshot_repository:state.canonical_repository===expectedRepo,
  saved_snapshot_production:String(state.production?.commit||'').toLowerCase()===expectedReleaseSha,
  saved_snapshot_dev_branch:state.development?.branch===developmentProvenance.branch,
  saved_snapshot_dev_head:String(state.development?.branch_head||'').toLowerCase()===String(developmentProvenance.branchHead||'').toLowerCase(),
  saved_snapshot_dev_overlay:state.development?.overlay===developmentProvenance.overlay,
  saved_snapshot_dev_cleaner:String(state.development?.cleaner)===String(developmentProvenance.cleaner),
  saved_snapshot_dev_manifest:state.development?.runtime_manifest===developmentProvenance.runtimeManifest?.path,
  saved_snapshot_dev_manifest_blob:String(state.development?.runtime_manifest_git_blob_sha||'').toLowerCase()===String(developmentProvenance.runtimeManifest?.gitBlobSha||'').toLowerCase(),

  activation_repo:activation.repository===expectedRepo,
  activation_branch:activation.branch==='main',
  activation_line:activation.activationLine===expectedActivationLine,
  activation_bundle:String(activation.bundleSha256||'').toLowerCase()===expectedActivationBundle,
  activation_candidate:String(activation.candidateSha||'').toLowerCase()===expectedCandidateSha,
  activation_offline_pass:activation.offlineValidation==='PASS',
  activation_dry_run_pass:activation.dryRun==='PASS' && activation.dryRunNonRootSafe==='PASS',
  activation_fail_closed:activation.executeModeFailClosedWithoutCredentials==='PASS',
  activation_auto_promotion_disabled:activation.automaticR232Promotion==='DISABLED',
  activation_live_not_run:activation.productionRunbook==='NOT_EXECUTED_LIVE',
  activation_pre_r232_not_issued:activation.preR232Ready==='NOT_ISSUED_LIVE',
  activation_r232_not_executed:activation.r232==='NOT_EXECUTED',
  activation_new_work_destination:activation.newWorkDestination===expectedRepo,

  project_activation_line:project.activation?.line===expectedActivationLine,
  project_activation_bundle:String(project.activation?.bundle_sha256||'').toLowerCase()===expectedActivationBundle,
  project_activation_candidate:String(project.activation?.candidate_sha||'').toLowerCase()===expectedCandidateSha,
  project_activation_status:project.activation?.status==='PRE_R232_OFFLINE_READY',
  project_activation_live_not_run:project.activation?.live_execution==='NOT_RUN',
  project_activation_r232_not_executed:project.activation?.r232==='NOT_EXECUTED',
  project_live_readiness:project.activation?.live_readiness==='LIVE_HOST_DISCOVERY_REQUIRED',
  project_live_endpoint_source:project.activation?.live_endpoint_source==='INFRA_SOURCE_PRESENT_APPLY_REQUIRED',
  project_oci_source_ready:project.infrastructure?.status==='SOURCE_READY_APPLY_REQUIRED',
  project_oci_apply_not_run:project.infrastructure?.resource_manager_apply==='NOT_RUN',

  activation_validation_schema:activationValidation.schema==='tgg.final.activation.bundle.v21.validation',
  activation_validation_status:activationValidation.status==='PASS',
  activation_validation_no_issues:Array.isArray(activationValidation.issues)&&activationValidation.issues.length===0,
  activation_validation_offline:activationValidation.offlineValidation==='PASS',
  activation_validation_auto_promotion_disabled:activationValidation.automaticR232Promotion==='DISABLED',
  activation_validation_live_not_run:activationValidation.liveExecution==='NOT_RUN',

  runbook_schema:runbook.schema==='tgg.production.activation.runbook.v1',
  runbook_candidate:String(runbook.candidateSha||'').toLowerCase()===expectedCandidateSha,
  runbook_fail_closed:runbook.failClosed===true,
  runbook_no_auto_promotion:runbook.automaticPromotion===false,
  runbook_r232_not_executed:runbook.r232Executed===false,
  runbook_has_hard_stop:Array.isArray(runbook.executeSequence)&&runbook.executeSequence.some(x=>String(x).toLowerCase().includes('hard stop before r232 execution')),
  source_lock_schema:sourceLock.schema==='tgg.activation.source-lock.v1',
  source_lock_repo:sourceLock.repository===expectedRepo,
  source_lock_branch:sourceLock.branch==='main',
  source_lock_line:sourceLock.activationLine===expectedActivationLine,
  source_lock_candidate:String(sourceLock.candidateSha||'').toLowerCase()===expectedCandidateSha,
  live_requirements_schema:liveRequirements.schema==='tgg.activation.live-requirements.v1',
  live_requirements_status:liveRequirements.liveStatus==='LIVE_HOST_DISCOVERY_REQUIRED',
  live_requirements_no_auto_promotion:liveRequirements.automaticR232Promotion===false,
  live_requirements_r232_not_executed:liveRequirements.r232==='NOT_EXECUTED',
  oci_source_schema:ociSource.schema==='tgg.oci.infrastructure.source.v1',
  oci_source_status:ociSource.status==='SOURCE_READY_APPLY_REQUIRED',
  oci_source_candidate:String(ociSource.candidateSha||'').toLowerCase()===expectedCandidateSha,
  oci_apply_not_run:ociSource.resourceManagerApply==='NOT_RUN',
  oci_game_node_default_off:ociSource.gameNodeDefault===false,
  oci_admin_cidr_no_default:ociSource.adminCidrDefault===null,
  oci_host_agent_private:ociSource.hostAgent8787Public===false,
  artifact_domains_schema:artifactDomains.schema==='tgg.artifact.domains.v1',
  artifact_domains_policy:artifactDomains.policy==='NEVER_COMPARE_HASHES_ACROSS_DIFFERENT_ARTIFACT_DOMAINS',
  artifact_r224_sha:String(artifactDomains.domains?.worldRuntimeR224?.sha||'').toLowerCase()==='faf8a6a89049d32af13df5f4e1cbd65ee2ba7742e63989790ab2abc0fce054fa',
  artifact_r227_sha:String(artifactDomains.domains?.certificationR227?.sha||'').toLowerCase()===expectedCandidateSha,
  artifact_v21_sha:String(artifactDomains.domains?.activationV21Bundle?.sha||'').toLowerCase()===expectedActivationBundle,
  artifact_r224_not_r227:String(artifactDomains.domains?.worldRuntimeR224?.sha||'').toLowerCase()!==String(artifactDomains.domains?.certificationR227?.sha||'').toLowerCase(),
  library_working_set_schema:libraryWorkingSet.schema==='tgg.library.working-set.v1',
  library_dev_overlay:libraryWorkingSet.workingSet?.gameDevelopment?.overlay===developmentProvenance.overlay,
  library_dev_head:String(libraryWorkingSet.workingSet?.gameDevelopment?.branchHead||'').toLowerCase()===String(developmentProvenance.branchHead||'').toLowerCase(),
  library_dev_manifest:libraryWorkingSet.workingSet?.gameDevelopment?.runtimeManifest===developmentProvenance.runtimeManifest?.path,
  library_runtime_r224:libraryWorkingSet.workingSet?.runtimeEvidence?.r224Candidate?.releaseStatus==='CANDIDATE_NOT_PROMOTED',
  library_r227_pending:libraryWorkingSet.workingSet?.runtimeEvidence?.r227Certification?.liveProof==='PENDING',
  library_recording_v1742_static:libraryWorkingSet.workingSet?.recordingStudio?.staticGate==='PASS',
  library_activation_r232:libraryWorkingSet.workingSet?.activation?.r232==='NOT_EXECUTED',
  source_lock_blob:(await gitBlobSha('tgg-activation/source-lock.json'))===expectedSourceLockBlob,
  checkpoint_source_lock:activation.sourceLockGitBlobSha===expectedSourceLockBlob,
  project_source_lock:project.activation?.source_lock_git_blob_sha===expectedSourceLockBlob,
  ...sourceChecks
};

const failed=Object.entries(checks).filter(([,ok])=>!ok).map(([name])=>name);
const report={
  ok:failed.length===0,
  gate:'TGG_CANONICAL_SAVE_GATE',
  canonical_repository:expectedRepo,
  active_branch:developmentProvenance.branch,
  active_overlay:developmentProvenance.overlay,
  frozen_release:'whole-world-consolidated-v135',
  frozen_sha:expectedReleaseSha,
  activation:{
    line:expectedActivationLine,
    bundle_sha256:expectedActivationBundle,
    candidate_sha:expectedCandidateSha,
    production_execution:'NOT_RUN',
    r232:'NOT_EXECUTED'
  },
  checks,
  failed
};

console.log(JSON.stringify(report,null,2));
if(!report.ok)process.exit(1);
