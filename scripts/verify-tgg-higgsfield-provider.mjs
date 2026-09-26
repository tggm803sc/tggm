#!/usr/bin/env node
import fs from 'node:fs';

const catalog=JSON.parse(fs.readFileSync('tgg-higgsfield/provider-catalog.json','utf8'));
const presets=JSON.parse(fs.readFileSync('tgg-higgsfield/presets.json','utf8'));
const gameAssets=JSON.parse(fs.readFileSync('tgg-higgsfield/game-asset-profile.json','utf8'));
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
const required=['soul_cast','soul_location','cinematic_studio_3_0','kling2_6','tripo_h3_1_image_to_3d','tripo_h3_1_multiview_to_3d','autosprite','cinematic_studio_video_v2','inworld_text_to_speech','mirelo_text_to_audio','sonilo_music','sam_3_3d','image_to_3d','soul_2','nano_banana_pro','kling3_0','grok_video_v15','seedance_2_5','sam_3_3d_body','meshy_v7_image_to_3d','meshy_v5_remesh','3d_rigging'];
for(const id of required) if(!ids.has(id)) errors.push('required-model-missing:'+id);
if(gameAssets.schema!=='tgg.higgsfield.game-asset-profile.v3') errors.push('game-asset-profile-schema');
for(const [route,id] of Object.entries(gameAssets.preferredRoutes||{})){
  if(!ids.has(id)) errors.push('game-asset-route-unknown-model:'+route+':'+id);
}
if(gameAssets.runtime?.productionGenerationClaim!==false) errors.push('game-asset-production-claim-must-be-false');

console.log(JSON.stringify({
  schema:'tgg.higgsfield.provider-verification.v1',
  status:errors.length?'FAIL':'PASS',
  verifiedModels:ids.size,
  presets:(presets.presets||[]).length,
  gameAssetRoutes:Object.keys(gameAssets.preferredRoutes||{}).length,
  errors
},null,2));
process.exit(errors.length?1:0);
