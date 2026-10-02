#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const data=JSON.parse(await fs.readFile(new URL('../release-metadata/tgg-video-ai-v1-supply-chain.json',import.meta.url),'utf8'));
const sha='469518eff0fe1641f6889c5ff78c2f3c0df189c7';

assert.equal(data.schema,'tgg.video-ai.supply-chain.v1');
assert.equal(data.candidateSha,sha);
assert.equal(data.releaseBranch,'release/tgg-video-ai-v1');
assert.equal(data.immutableImage.ref,`ghcr.io/tggm803sc/tggm-video-ai:${sha}`);
assert.equal(data.sealedReleaseArtifact.digest,'sha256:f9511368a26c20c26ec8ee1c9616e52e7eb3750cf277db76511a089e9d033107');
assert.equal(data.opsCompanionContract.selfReferenceFree,true);
assert.equal(data.sealedReleaseArtifact.independentlyVerified,true);
assert.equal(data.promotionContract.aggregatePass,'PROMOTION_EVIDENCE_COMPLETE');
assert.equal(data.promotionContract.aggregateHold,'DO_NOT_MERGE');
assert.equal(data.policy.productionPromoted,false);
assert.equal(data.policy.mergeAllowed,false);
for(const check of data.exactShaChecks) assert.equal(check.status,'PASS',check.name);
console.log(JSON.stringify({schema:'tgg.video-ai.supply-chain.test.v1',status:'PASS'},null,2));
