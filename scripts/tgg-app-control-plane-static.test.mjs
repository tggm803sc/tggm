#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [
  sourceServer,
  sourceUi,
  projects,
  higgsServer,
  higgsStore,
  registry,
  saved
]=await Promise.all([
  fs.readFile('tgg-source/server.mjs','utf8'),
  fs.readFile('tgg-source/index.html','utf8'),
  fs.readFile('tgg-projects/server.mjs','utf8'),
  fs.readFile('tgg-higgsfield/server.mjs','utf8'),
  fs.readFile('tgg-higgsfield/job-store.mjs','utf8'),
  fs.readFile('tgg-projects/registry.json','utf8').then(JSON.parse),
  fs.readFile('tgg-projects/saved-state-tgg-app-2026-09-25.json','utf8').then(JSON.parse)
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

assert.match(projects,/\/v1\/dashboard/);
assert.match(projects,/\/v1\/save-everything/);
assert.match(projects,/TGG_SOURCE_URL/);
assert.match(projects,/TGG_HIGGSFIELD_URL/);
assert.match(projects,/latest-check\.json/);
assert.match(projects,/SAVE EVERYTHING/);

assert.match(higgsServer,/PATCH/);
assert.match(higgsServer,/cancel\|retry/);
assert.match(higgsStore,/durableWrite/);
assert.match(higgsStore,/progress/);
assert.match(higgsStore,/output/);
assert.match(higgsStore,/retryJob/);
assert.match(higgsStore,/cancelJob/);

assert.equal(registry.primary_repository,'tggm803sc/tggm');
assert.equal(registry.projects.find(x=>x.id==='tgg-source')?.status,'active-github-style');
assert.equal(registry.projects.find(x=>x.id==='tgg-higgsfield')?.status,'active-foundation');
assert.equal(saved.canonical_repository,'tggm803sc/tggm');
assert.equal(saved.source_control.mode,'github-style-tgg-owned');
assert.equal(saved.higgsfield.external_provider_required,false);

console.log(JSON.stringify({
  ok:true,
  gate:'TGG_APP_CONTROL_PLANE_STATIC',
  owner:'TGG',
  checks:30,
  source:'tgg-source',
  projects:'tgg-projects',
  higgsfield:'tgg-higgsfield'
},null,2));
