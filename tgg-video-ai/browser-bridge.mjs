const DEFAULT_BASE=(document.currentScript?.dataset?.baseUrl||window.TGG_VIDEO_AI_BASE_URL||'').replace(/\/$/,'');
const STATE_KEY='tgg.video-ai.live-bridge.v1';

function loadState(){
  try{return JSON.parse(localStorage.getItem(STATE_KEY)||'{}')}catch{return {}}
}
function saveState(s){localStorage.setItem(STATE_KEY,JSON.stringify(s));}
function id(prefix='id'){return prefix+'-'+crypto.randomUUID();}
function byText(label){
  return [...document.querySelectorAll('button,a,[role="button"]')].find(el=>el.textContent?.trim()===label)||null;
}
function toast(message,kind='info'){
  let el=document.getElementById('tgg-video-ai-status');
  if(!el){
    el=document.createElement('div');el.id='tgg-video-ai-status';
    Object.assign(el.style,{position:'fixed',right:'18px',bottom:'18px',zIndex:'2147483647',maxWidth:'420px',padding:'12px 14px',borderRadius:'10px',background:'#111',color:'#fff',font:'13px/1.4 system-ui',boxShadow:'0 12px 36px rgba(0,0,0,.35)'});
    document.body.appendChild(el);
  }
  el.dataset.kind=kind;el.textContent=message;
}
async function mediaDurationMs(file){
  return new Promise((resolve)=>{
    const el=document.createElement(file.type.startsWith('audio/')?'audio':'video');
    const url=URL.createObjectURL(file);
    el.preload='metadata';
    el.onloadedmetadata=()=>{const ms=Number.isFinite(el.duration)?Math.round(el.duration*1000):0;URL.revokeObjectURL(url);resolve(ms)};
    el.onerror=()=>{URL.revokeObjectURL(url);resolve(0)};
    el.src=url;
  });
}
async function api(base,path,options={}){
  const r=await fetch(base+path,{...options,headers:{...(options.body instanceof Blob?{}:{'content-type':'application/json'}),...(options.headers||{})}});
  const ct=r.headers.get('content-type')||'';
  const body=ct.includes('application/json')?await r.json():await r.text();
  if(!r.ok)throw new Error(body?.error||body||('HTTP '+r.status));
  return body;
}
async function upload(base,projectId,file){
  const durationMs=await mediaDurationMs(file);
  const assetId=id('asset');
  const type=file.type.startsWith('audio/')?'audio':'video';
  const result=await api(base,`/v1/projects/${encodeURIComponent(projectId)}/assets/${encodeURIComponent(assetId)}`,{
    method:'PUT',
    body:file,
    headers:{
      'content-type':file.type||'application/octet-stream',
      'x-tgg-asset-name':encodeURIComponent(file.name||assetId),
      'x-tgg-asset-type':type,
      'x-tgg-duration-ms':String(durationMs)
    }
  });
  return result.asset;
}
async function runDirective(base,state,directive){
  if(!state.assets?.length)throw new Error('Import footage or audio first.');
  toast('TGG AI: analyzing media…');
  const analyzed=await api(base,`/v1/projects/${encodeURIComponent(state.projectId)}/analyze`,{method:'POST',body:JSON.stringify({assets:state.assets,signals:{}})});
  toast('TGG AI: building editable first cut…');
  const planRes=await api(base,`/v1/projects/${encodeURIComponent(state.projectId)}/plans`,{method:'POST',body:JSON.stringify({
    mode:'music-video',
    directives:[directive],
    mediaAnalyses:analyzed.mediaAnalyses,
    musicAnalysis:analyzed.musicAnalysis,
    canvas:{width:1920,height:1080}
  })});
  const applied=await api(base,`/v1/projects/${encodeURIComponent(state.projectId)}/plans/${encodeURIComponent(planRes.plan.id)}/apply`,{method:'POST',body:JSON.stringify({})});
  state.planId=planRes.plan.id;
  state.timelineVersion=applied.timeline.version;
  state.timeline=applied.timeline;
  saveState(state);
  window.dispatchEvent(new CustomEvent('tgg-video-ai:timeline',{detail:{plan:planRes.plan,timeline:applied.timeline,directive}}));
  toast('TGG AI first cut ready · timeline v'+applied.timeline.version,'success');
  return applied.timeline;
}
async function render(base,state){
  if(!state.timelineVersion)await runDirective(base,state,'auto-first-cut');
  toast('TGG Render Center: queueing verified MP4…');
  const queued=await api(base,`/v1/projects/${encodeURIComponent(state.projectId)}/renders`,{method:'POST',body:JSON.stringify({
    timelineVersion:state.timelineVersion,
    assets:state.assets,
    preset:{width:1920,height:1080,fps:30,container:'mp4',codec:'h264'}
  })});
  state.renderJobId=queued.job.id;saveState(state);
  for(let i=0;i<240;i++){
    await new Promise(r=>setTimeout(r,1000));
    const current=await api(base,`/v1/jobs/${encodeURIComponent(queued.job.id)}`);
    const job=current.job;
    toast('TGG Render Center · '+job.status+' · '+Math.round(job.progress||0)+'%');
    if(job.status==='failed')throw new Error(job.error||'Render failed');
    if(job.status==='succeeded'){
      state.output=job.output;saveState(state);
      window.dispatchEvent(new CustomEvent('tgg-video-ai:rendered',{detail:job.output}));
      toast('Render complete · verified MP4 ready','success');
      return job.output;
    }
  }
  throw new Error('Render polling timed out');
}
export async function connectTGGVideoAI({baseUrl=DEFAULT_BASE}={}){
  const base=String(baseUrl||'').replace(/\/$/,'');
  if(!base)throw new Error('TGG Video AI base URL is required');
  const state=loadState();
  state.projectId=state.projectId||id('project');
  state.assets=Array.isArray(state.assets)?state.assets:[];
  saveState(state);

  for(const input of document.querySelectorAll('input[type="file"]')){
    if(input.dataset.tggVideoAiBound)return;
    input.dataset.tggVideoAiBound='1';
    input.addEventListener('change',async()=>{
      try{
        for(const file of [...(input.files||[])]){
          toast('Uploading '+file.name+' to TGG…');
          const asset=await upload(base,state.projectId,file);
          state.assets=state.assets.filter(a=>a.id!==asset.id).concat(asset);
          saveState(state);
        }
        toast('TGG media ready · '+state.assets.length+' asset(s)','success');
        window.dispatchEvent(new CustomEvent('tgg-video-ai:assets',{detail:state.assets}));
      }catch(e){toast('TGG upload error: '+e.message,'error')}
    });
  }

  const directives={
    'Auto first cut':'auto-first-cut',
    'Beat sync':'beat-sync',
    'Clean audio':'clean-audio',
    'Smart reframe':'smart-reframe'
  };
  for(const [label,directive] of Object.entries(directives)){
    const el=byText(label); if(!el||el.dataset.tggVideoAiBound)return;
    el.dataset.tggVideoAiBound='1';
    el.addEventListener('click',async(ev)=>{
      ev.preventDefault();
      try{await runDirective(base,state,directive)}catch(e){toast('TGG AI error: '+e.message,'error')}
    });
  }
  const renderEl=byText('Render Center');
  if(renderEl&&!renderEl.dataset.tggVideoAiBound){
    renderEl.dataset.tggVideoAiBound='1';
    renderEl.addEventListener('click',async()=>{try{const out=await render(base,state);if(out?.uri)window.open(out.uri,'_blank','noopener')}catch(e){toast('TGG render error: '+e.message,'error')}});
  }

  window.TGGVideoAI={state,runDirective:(d)=>runDirective(base,state,d),render:()=>render(base,state),upload:(f)=>upload(base,state.projectId,f)};
  toast('TGG Video AI connected','success');
  return window.TGGVideoAI;
}

if(DEFAULT_BASE)connectTGGVideoAI({baseUrl:DEFAULT_BASE}).catch(e=>toast('TGG bridge: '+e.message,'error'));
