#!/usr/bin/env node
import fs from 'node:fs';

const catalog=JSON.parse(fs.readFileSync('tgg-higgsfield/provider-catalog.json','utf8'));
const presets=JSON.parse(fs.readFileSync('tgg-higgsfield/presets.json','utf8'));
const errors=[];

if(catalog.schema!=='tgg.higgsfield.provider-catalog.v1') errors.push('catalog-schema');
const ids=new Set(Object.values(catalog.modes||{}).flat().map(x=>x.id));
for(const preset of presets.presets||[]){
  if(preset.provider_model && !ids.has(preset.provider_model)){
    errors.push('unknown-provider-model:'+preset.id+':'+preset.provider_model);
  }
  for(const mode of preset.modes||[]){
    if(!['image','video','sprite','audio','3d'].includes(mode)){
      errors.push('unsupported-mode:'+preset.id+':'+mode);
    }
  }
}
const required=['autosprite','cinematic_studio_3_0','inworld_text_to_speech','mirelo_text_to_audio','sonilo_music','sam_3_3d','image_to_3d'];
for(const id of required) if(!ids.has(id)) errors.push('required-model-missing:'+id);

console.log(JSON.stringify({
  schema:'tgg.higgsfield.provider-verification.v1',
  status:errors.length?'FAIL':'PASS',
  verifiedModels:ids.size,
  presets:(presets.presets||[]).length,
  errors
},null,2));
process.exit(errors.length?1:0);
