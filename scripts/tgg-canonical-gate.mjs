#!/usr/bin/env node
import fs from 'node:fs/promises';

const read=async file=>JSON.parse(await fs.readFile(file,'utf8'));
const [project,registry,approved,state]=await Promise.all([
  read('TGG-PROJECT.json'),
  read('tgg-projects/registry.json'),
  read('tgg-approved-release.json'),
  read('tgg-projects/project-state-2026-09-25.json')
]);

const expectedRepo='tggm803sc/tggm';
const expectedReleaseSha='ea27aca634f3c2b92fc430a232f5f8d0be4fba23';

const checks={
  project_primary:project.primary_repository===expectedRepo,
  project_save_target:project.canonical_save_target===expectedRepo,
  project_status:project.status==='CANONICAL_TGG_PRIMARY_ACTIVE',
  registry_primary:registry.primary_repository===expectedRepo,
  registry_save_target:registry.canonical_save_target===expectedRepo,
  approved_release_sha:String(approved.final_commit||'').toLowerCase()===expectedReleaseSha,
  approved_release_branch:approved.final_branch==='tgg-world-release-v135-final',
  active_branch:project.active_branch==='tgg-world-mega-1000x',
  active_overlay:project.active_development_overlay==='1000x-v197',
  active_cleaner:String(project.active_cleaner)==='184',
  saved_snapshot_repository:state.canonical_repository===expectedRepo,
  saved_snapshot_production:String(state.production?.commit||'').toLowerCase()===expectedReleaseSha
};

const failed=Object.entries(checks).filter(([,ok])=>!ok).map(([name])=>name);
const report={
  ok:failed.length===0,
  gate:'TGG_CANONICAL_SAVE_GATE',
  canonical_repository:expectedRepo,
  active_branch:'tgg-world-mega-1000x',
  active_overlay:'1000x-v197',
  frozen_release:'whole-world-consolidated-v135',
  frozen_sha:expectedReleaseSha,
  checks,
  failed
};

console.log(JSON.stringify(report,null,2));
if(!report.ok)process.exit(1);
