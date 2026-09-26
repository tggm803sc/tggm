import { createHash, randomUUID } from 'node:crypto';

const VALID_MEDIA=new Set(['image','video','audio','3d','sprite']);

export function promptSha256(prompt=''){
  return createHash('sha256').update(String(prompt),'utf8').digest('hex');
}

export function normalizeHiggsfieldAsset(input={}){
  const mediaType=String(input.mediaType||'').toLowerCase();
  if(!VALID_MEDIA.has(mediaType)) throw new Error('invalid_higgsfield_media_type');
  if(!input.projectId) throw new Error('missing_project_id');
  if(!input.modelId) throw new Error('missing_model_id');
  if(!input.jobId) throw new Error('missing_job_id');
  if(!input.sourceUri) throw new Error('missing_source_uri');

  const is3d=mediaType==='3d';
  return {
    schema:'tgg.higgsfield.asset-ingest.v1',
    assetId:String(input.assetId||randomUUID()),
    projectId:String(input.projectId),
    entityId:input.entityId?String(input.entityId):null,
    provider:'HIGGSFIELD',
    modelId:String(input.modelId),
    jobId:String(input.jobId),
    mediaType,
    source:{
      kind:String(input.sourceKind||'generation-result'),
      uri:String(input.sourceUri),
      mimeType:input.mimeType?String(input.mimeType):null
    },
    provenance:{
      promptSha256:promptSha256(input.prompt||''),
      generatedAt:String(input.generatedAt||new Date().toISOString()),
      accountIdentityPersisted:false,
      providerCredentialsPersisted:false
    },
    version:Number.isInteger(input.version)&&input.version>0?input.version:1,
    state:'REGISTERED',
    unreal:{
      preferredFormat:is3d?'glb':null,
      validationRequired:is3d,
      validationStatus:is3d?'PENDING':'NOT_APPLICABLE'
    },
    metadata:{...(input.metadata||{})}
  };
}

export function assertSafeIngestRecord(record){
  if(record?.schema!=='tgg.higgsfield.asset-ingest.v1') throw new Error('invalid_ingest_schema');
  if(record?.provider!=='HIGGSFIELD') throw new Error('invalid_ingest_provider');
  if(record?.provenance?.accountIdentityPersisted!==false) throw new Error('account_identity_must_not_persist');
  if(record?.provenance?.providerCredentialsPersisted!==false) throw new Error('provider_credentials_must_not_persist');
  if(!/^[0-9a-f]{64}$/.test(String(record?.provenance?.promptSha256||''))) throw new Error('invalid_prompt_hash');
  if(record?.mediaType==='3d' && record?.unreal?.validationRequired!==true) throw new Error('3d_requires_unreal_validation');
  return true;
}
