#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const manifestPath=path.join(root,'tgg-projects','framework-module-manifest-v1.json');
const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
const errors=[];

const expectedUnresolved=[35,63,64,65,66,67,68];
const unresolved=[...(manifest.unresolvedModuleNumbers||[])].sort((a,b)=>a-b);
if(JSON.stringify(unresolved)!==JSON.stringify(expectedUnresolved)){
  errors.push('unresolved-module-set-mismatch');
}

if(manifest.targetModuleCount!==68) errors.push('target-module-count-must-be-68');
if(manifest.explicitlyIdentifiedCount!==61) errors.push('explicitly-identified-count-must-be-61');
if(!Array.isArray(manifest.modules) || manifest.modules.length!==61){
  errors.push('manifest-must-contain-61-explicit-modules');
}

const seen=new Set();
for(const module of manifest.modules||[]){
  if(seen.has(module.number)) errors.push(`duplicate-module-number:${module.number}`);
  seen.add(module.number);

  if(expectedUnresolved.includes(module.number)){
    errors.push(`unresolved-module-should-not-have-explicit-entry:${module.number}`);
  }
  if(!module.repoPath){
    errors.push(`missing-repo-path:${module.number}`);
    continue;
  }
  const full=path.join(root,module.repoPath);
  if(!fs.existsSync(full)){
    errors.push(`repo-path-missing:${module.number}:${module.repoPath}`);
  }
  if(module.exactNamePresentOnMain!==true){
    errors.push(`materialization-flag-false:${module.number}`);
  }
  if(typeof module.materializationStatus!=='string' || module.materializationStatus.startsWith('NOT_FOUND')){
    errors.push(`invalid-materialization-status:${module.number}`);
  }
}

for(const n of expectedUnresolved){
  if(seen.has(n)) errors.push(`unresolved-number-present:${n}`);
}

const result={
  schema:'tgg.framework.manifest.verification.v1',
  status:errors.length?'FAIL':'PASS',
  targetModuleCount:manifest.targetModuleCount,
  explicitModules:manifest.modules?.length||0,
  unresolvedModuleNumbers:expectedUnresolved,
  errors
};
console.log(JSON.stringify(result,null,2));
process.exit(errors.length?1:0);
