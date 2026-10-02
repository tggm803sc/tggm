#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const src=await fs.readFile(new URL('../.github/workflows/tgg-video-ai-final-certification.yml',import.meta.url),'utf8');
for(const marker of [
  'host_evidence_artifact_id',
  'browser_evidence_artifact_id',
  'promotion-result.json',
  'PROMOTION_EVIDENCE_COMPLETE',
  'FINAL_CERTIFICATION_HOLD',
  '469518eff0fe1641f6889c5ff78c2f3c0df189c7'
]) assert.equal(src.includes(marker),true,'missing '+marker);
console.log(JSON.stringify({schema:'tgg.video-ai.final-certification.static.v1',status:'PASS'},null,2));
