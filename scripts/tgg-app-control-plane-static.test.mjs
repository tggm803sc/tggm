#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [
  sourceServer,
  sourceStore,
  sourcePolicy,
  sourceChecks,
  sourceUi,
  projects,
  higgsServer,
  higgsStore,
  projectsStore,
  registry,
  saved,
  appPackage,
  appNext,
  appDb,
  appEnv,
  appInput,
  appSchema,
  appCheckpoint
]=await Promise.all([
  fs.readFile('tgg-source/server.mjs','utf8'),
  fs.readFile('tgg-source/repo-store.mjs','utf8'),
  fs.readFile('tgg-source/repo-policy.mjs','utf8'),
  fs.readFile('tgg-source/check-store.mjs','utf8'),
  fs.readFile('tgg-source/index.html','utf8'),
  fs.readFile('tgg-projects/server.mjs','utf8'),
  fs.readFile('tgg-higgsfield/server.mjs','utf8'),
  fs.readFile('tgg-higgsfield/job-store.mjs','utf8'),
  fs.readFile('tgg-projects/state-store.mjs','utf8'),
  fs.readFile('tgg-projects/registry.json','utf8').then(JSON.parse),
  fs.readFile('tgg-projects/saved-state-tgg-app-2026-09-25.json','utf8').then(JSON.parse),
  fs.readFile('tgg-app/package.json','utf8').then(JSON.parse),
  fs.readFile('tgg-app/next.config.mjs','utf8'),
  fs.readFile('tgg-app/src/lib/db.ts','utf8'),
  fs.readFile('tgg-app/.env.example','utf8'),
  fs.readFile('tgg-app/Config/DefaultInput.ini','utf8'),
  fs.readFile('tgg-app/prisma/schema.prisma','utf8'),
  fs.readFile('tgg-projects/saved-state-tgg-app-approved-2026-09-26.json','utf8').then(JSON.parse)
]);

assert.match(sourceServer,/\/v1\/repos/);
assert.match(sourceServer,/pulls\/\(\\d\+\)\/merge/);
assert.match(sourceUi,/Files/);
assert.match(sourceUi,/openFile/);
assert.match(sourceUi,/createFileCommit/);
assert.match(sourceUi,/deleteFile/);
assert.match(sourceUi,/pull requests/i);
assert.match(sourceUi,/Create tag/);
assert.match(sourceServer,/\/v1\/checks/);
assert.match(sourceUi,/TGG CI \/ Checks/);
assert.match(sourceStore,/commitDetails/);
assert.match(sourceStore,/exportRepoBundle/);
assert.match(sourceStore,/readRepoBundle/);
assert.match(sourceStore,/restoreRepoBundle/);
assert.match(sourceServer,/\/v1\/restore/);
assert.match(sourceServer,/\/v1\/exports\//);
assert.match(sourceServer,/saveBundleAsset/);
assert.match(sourceUi,/View diff/);
assert.match(sourceUi,/Backup repository/);
assert.match(sourceServer,/tail==='releases'/);
assert.match(sourceServer,/saveReleaseAsset/);
assert.match(sourceServer,/saveReleaseCheckpoint/);
assert.match(sourceUi,/createRelease/);
assert.match(sourceUi,/TGG Release saved to TGG Projects/);

assert.match(projects,/\/v1\/dashboard/);
assert.match(projects,/\/v1\/save-everything/);
assert.match(projects,/TGG_SOURCE_URL/);
assert.match(projects,/TGG_HIGGSFIELD_URL/);
assert.match(projects,/latest-check\.json/);
assert.match(projects,/SAVE EVERYTHING/);
assert.match(projects,/\/v1\/assets/);
assert.match(projects,/Saved Assets/);
assert.match(projects,/saved_assets/);
assert.match(projects,/\/export/);
assert.match(projects,/sourceBackups/);
assert.match(projects,/source_backups_ok/);
assert.match(projects,/source_backup_count/);
assert.match(projectsStore,/createAsset/);
assert.match(projectsStore,/listAssets/);
assert.match(projectsStore,/recordEvent/);
assert.match(projectsStore,/listEvents/);
assert.match(projectsStore,/createSaveManifest/);
assert.match(projectsStore,/getLatestSave/);
assert.match(projects,/\/v1\/save-manifests/);
assert.match(projects,/verifySaveManifest/);
assert.match(projects,/TGG_PROJECTS_SAVE_VERIFY/);
assert.match(projects,/manifest_sha256/);
assert.match(projects,/\/v1\/events/);
assert.match(sourceServer,/saveSourceEvent/);
assert.match(higgsServer,/saveJobEvent/);
assert.match(projectsStore,/source_service===source_service/);

assert.match(higgsServer,/PATCH/);
assert.match(higgsServer,/cancel\|retry/);
assert.match(higgsStore,/durableWrite/);
assert.match(higgsStore,/progress/);
assert.match(higgsStore,/output/);
assert.match(higgsStore,/retryJob/);
assert.match(higgsStore,/cancelJob/);
assert.match(higgsServer,/TGG_PROJECTS_URL/);
assert.match(higgsServer,/saveCompletedAsset/);
assert.match(higgsServer,/checkpointJob/);
assert.match(sourceServer,/TGG_PROJECTS_URL/);
assert.match(sourceServer,/saveSourceCheckpoint/);
assert.match(sourceServer,/project_saved/);
assert.match(sourceServer,/importRepo/);
assert.match(sourceServer,/getRepoPolicy/);
assert.match(sourceServer,/updateRepoPolicy/);
assert.match(sourceStore,/assertBranchWriteAllowed/);
assert.match(sourcePolicy,/protected_branch_requires_pull_request/);
assert.match(sourcePolicy,/protected_branches/);
assert.match(sourceUi,/Repository protection/);
assert.match(sourceUi,/saveSettings\(\)/);
assert.match(sourceChecks,/createCheckRun/);
assert.match(sourceChecks,/checksPass/);
assert.match(sourceServer,/check-runs\/from-ci/);
assert.match(sourceServer,/required_checks_not_passed/);
assert.match(sourceUi,/Sync TGG CI to HEAD/);
assert.match(sourceUi,/syncTggCi\(\)/);
assert.match(sourceServer,/\/v1\/import/);
assert.match(sourceUi,/Import into TGG Source/);
assert.match(sourceUi,/importRepo\(\)/);
assert.match(projects,/Recent saved timeline/);
assert.match(projects,/\/v1\/projects\/\(\[\^\/\]\+\)\/events/);

assert.equal(registry.primary_repository,'tggm803sc/tggm');
assert.equal(registry.projects.find(x=>x.id==='tgg-source')?.status,'active-tgg-native-github-style');
assert.equal(registry.projects.find(x=>x.id==='tgg-higgsfield')?.status,'active-project-integrated');
assert.equal(saved.canonical_repository,'tggm803sc/tggm');
assert.equal(saved.source_control.mode,'github-style-tgg-owned');
assert.equal(saved.higgsfield.external_provider_required,false);

assert.equal(registry.projects.find(x=>x.id==='tgg-app')?.status,'active-next-prisma-game-control');
assert.equal(appPackage.name,'tgg-app');
assert.match(appNext,/steamstatic\.com/);
assert.match(appNext,/poweredByHeader:\s*false/);
assert.match(appDb,/cachedPrisma/);
assert.match(appDb,/PrismaClient/);
assert.match(appEnv,/DATABASE_URL=/);
assert.doesNotMatch(appEnv,/SecretAuthSecurePasswordMatrix123/);
assert.doesNotMatch(appEnv,/AuthoritativeTokenHandshakeSignatureKeyString/);
assert.match(appInput,/IA_Dodge/);
assert.match(appInput,/IA_Fire/);
assert.match(appInput,/IA_Interact/);
assert.match(appSchema,/model TggPlayer/);
assert.match(appSchema,/model TggTelemetryEvent/);
assert.equal(appCheckpoint.security.plaintext_secrets_committed,false);
assert.equal(appCheckpoint.tgg_higgsfield.integrated,true);

console.log(JSON.stringify({
  ok:true,
  gate:'TGG_APP_CONTROL_PLANE_STATIC',
  owner:'TGG',
  checks:106,
  source:'tgg-source',
  projects:'tgg-projects',
  higgsfield:'tgg-higgsfield'
},null,2));
