#!/usr/bin/env node
import {spawnSync} from 'node:child_process';

function run(env, code){
  return spawnSync(process.execPath,['--input-type=module','-e',code],{
    env:{...process.env,...env},
    encoding:'utf8'
  });
}

const importCode="import {assertProviderReady,providerConfig} from './tgg-higgsfield/provider-router.mjs'; console.log(JSON.stringify(assertProviderReady()));";

const local=run({
  TGG_HIGGSFIELD_PROVIDER_MODE:'local-engine',
  TGG_HIGGSFIELD_PROVIDER_BRIDGE_URL:'',
  TGG_HIGGSFIELD_PROVIDER_BRIDGE_TOKEN:''
},importCode);

const bridge=run({
  TGG_HIGGSFIELD_PROVIDER_MODE:'bridge',
  TGG_HIGGSFIELD_PROVIDER_BRIDGE_URL:'https://bridge.invalid',
  TGG_HIGGSFIELD_PROVIDER_BRIDGE_TOKEN:'test-token-not-secret'
},importCode);

const missing=run({
  TGG_HIGGSFIELD_PROVIDER_MODE:'bridge',
  TGG_HIGGSFIELD_PROVIDER_BRIDGE_URL:'',
  TGG_HIGGSFIELD_PROVIDER_BRIDGE_TOKEN:''
},importCode);

const errors=[];
if(local.status!==0 || !local.stdout.includes('"mode":"local-engine"')) errors.push('local-engine-mode');
if(bridge.status!==0 || !bridge.stdout.includes('"mode":"bridge"') || !bridge.stdout.includes('"ready":true')) errors.push('bridge-configured-mode');
if(missing.status===0 || !missing.stderr.includes('higgsfield_provider_bridge_not_configured')) errors.push('bridge-missing-credentials-must-fail');

console.log(JSON.stringify({
  schema:'tgg.higgsfield.provider-router.test.v1',
  status:errors.length?'FAIL':'PASS',
  cases:{
    local_engine:local.status===0?'PASS':'FAIL',
    bridge_configured:bridge.status===0?'PASS':'FAIL',
    bridge_missing_credentials:missing.status!==0?'PASS':'FAIL'
  },
  errors
},null,2));
process.exit(errors.length?1:0);
