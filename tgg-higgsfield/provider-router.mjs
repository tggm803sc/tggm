const MODE=String(process.env.TGG_HIGGSFIELD_PROVIDER_MODE||'local-engine').trim().toLowerCase();
const LOCAL_URL=String(process.env.TGG_CREATIVE_ENGINE_URL||'http://127.0.0.1:10041').replace(/\/$/,'');
const BRIDGE_URL=String(process.env.TGG_HIGGSFIELD_PROVIDER_BRIDGE_URL||'').replace(/\/$/,'');
const BRIDGE_TOKEN=String(process.env.TGG_HIGGSFIELD_PROVIDER_BRIDGE_TOKEN||'').trim();
const TIMEOUT=Math.max(1000,Number(process.env.TGG_CREATIVE_ENGINE_HTTP_TIMEOUT_MS||30000));

export function providerConfig(){
  const bridgeConfigured=Boolean(BRIDGE_URL&&BRIDGE_TOKEN);
  return {
    mode:MODE,
    backend_url:MODE==='bridge'?BRIDGE_URL:LOCAL_URL,
    bridge_configured:bridgeConfigured,
    ready:MODE==='local-engine'||(MODE==='bridge'&&bridgeConfigured),
    auth_strategy:MODE==='bridge'?'bearer':'none'
  };
}

export function assertProviderReady(){
  const cfg=providerConfig();
  if(!['local-engine','bridge'].includes(cfg.mode)) throw new Error('invalid_higgsfield_provider_mode');
  if(cfg.mode==='bridge'&&!cfg.bridge_configured) throw new Error('higgsfield_provider_bridge_not_configured');
  return cfg;
}

function headers(extra={}){
  const cfg=assertProviderReady();
  const auth=cfg.mode==='bridge'?{authorization:'Bearer '+BRIDGE_TOKEN}:{};
  return {'content-type':'application/json',...auth,...extra};
}

export async function providerRequest(pathname,options={}){
  const cfg=assertProviderReady();
  const response=await fetch(cfg.backend_url+pathname,{
    ...options,
    headers:headers(options.headers||{}),
    signal:AbortSignal.timeout(TIMEOUT)
  });
  const text=await response.text();
  let data={};
  try{ data=text?JSON.parse(text):{}; }catch{}
  if(!response.ok||data?.ok===false) throw new Error(data?.error||('HTTP '+response.status+' '+pathname));
  return data;
}

export async function providerHealth(){
  try{
    const cfg=assertProviderReady();
    const data=await providerRequest('/health');
    return {ok:data?.ok===true,mode:cfg.mode,url:cfg.backend_url,data};
  }catch(error){
    return {ok:false,mode:MODE,url:MODE==='bridge'?BRIDGE_URL:LOCAL_URL,error:String(error?.message||error)};
  }
}
