#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const contract=JSON.parse(await fs.readFile(new URL('../tgg-video-ai/editor-contract.json',import.meta.url),'utf8'));
assert.equal(contract.schema,'tgg.video-ai.editor-contract.v1');
assert.deepEqual(contract.directives,{'Auto first cut':['auto-first-cut'],'Beat sync':['beat-sync'],'Clean audio':['clean-audio'],'Smart reframe':['smart-reframe']});
for(const marker of ['Auto first cut','Beat sync','Clean audio','Smart reframe','Media','Timeline','Render Center','▶','−5','+5'])assert.equal(contract.requiredLiveMarkers.includes(marker),true,`missing marker ${marker}`);
assert.equal(contract.timeline.editable,true);
assert.equal(contract.timeline.flattenAiOutput,false);
assert.equal(contract.render.acceptOnlyVerifiedOutput,true);
assert.equal(contract.liveBridge.status,'PENDING');
assert.equal(contract.liveBridge.reason,'no_supported_site_source_write_capability_in_session');
console.log(JSON.stringify({schema:'tgg.video-ai.regression.test.v1',status:'PASS'},null,2));
