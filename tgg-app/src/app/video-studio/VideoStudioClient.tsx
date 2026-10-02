'use client';

import {useEffect,useMemo,useRef,useState} from 'react';

type Asset={
  id:string;
  projectId:string;
  type:'video'|'audio';
  version:number;
  durationMs:number;
  uri:string;
  metadata?:{name?:string;mimeType?:string;sizeBytes?:number};
};
type TimelineClip={
  id:string;
  sourceAssetId:string;
  sourceShotId?:string;
  startMs:number;
  endMs:number;
  durationMs:number;
  timelineStartMs:number;
  origin:'ai'|'manual';
};
type Timeline={
  id:string;
  projectId:string;
  version:number;
  tracks:Array<{id:string;type:string;clips:TimelineClip[]}>;
  captions:any[];
  effects:any[];
  transitions:any[];
  reframes:any[];
  audio:any[];
};

const shell='#080b10';
const panel='#0e131b';
const panel2='#111824';
const border='#273246';
const accent='#7c5cff';
const accent2='#21d4fd';
const muted='#8e9aae';

function uid(prefix:string){return prefix+'-'+crypto.randomUUID();}
function ms(v:number){const s=Math.floor(v/1000);return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;}

async function mediaDuration(file:File){
  return new Promise<number>((resolve)=>{
    const el=document.createElement(file.type.startsWith('audio/')?'audio':'video');
    const url=URL.createObjectURL(file);
    el.preload='metadata';
    el.onloadedmetadata=()=>{const n=Number.isFinite(el.duration)?Math.round(el.duration*1000):0;URL.revokeObjectURL(url);resolve(n)};
    el.onerror=()=>{URL.revokeObjectURL(url);resolve(0)};
    el.src=url;
  });
}

export default function VideoStudioClient({baseUrl}:{baseUrl:string}){
  const [projectId]=useState(()=>uid('project'));
  const [assets,setAssets]=useState<Asset[]>([]);
  const [localMedia,setLocalMedia]=useState<Array<{id:string;name:string;type:string;url:string}>>([]);
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const [timeline,setTimeline]=useState<Timeline|null>(null);
  const [status,setStatus]=useState('Ready');
  const [renderProgress,setRenderProgress]=useState(0);
  const [renderUrl,setRenderUrl]=useState<string|null>(null);
  const [busy,setBusy]=useState(false);
  const fileRef=useRef<HTMLInputElement|null>(null);

  useEffect(()=>()=>localMedia.forEach(x=>URL.revokeObjectURL(x.url)),[localMedia]);
  const selected=useMemo(()=>localMedia.find(x=>x.id===selectedId)||localMedia[0]||null,[localMedia,selectedId]);
  const clips=timeline?.tracks?.flatMap(t=>t.clips||[])||[];

  async function json(path:string,options:RequestInit={}){
    const r=await fetch(baseUrl.replace(/\/$/,'')+path,{...options,headers:{'content-type':'application/json',...(options.headers||{})}});
    const body=await r.json();
    if(!r.ok)throw new Error(body?.error||`HTTP ${r.status}`);
    return body;
  }

  async function uploadOne(file:File){
    const durationMs=await mediaDuration(file);
    const assetId=uid('asset');
    const type=file.type.startsWith('audio/')?'audio':'video';
    const r=await fetch(`${baseUrl.replace(/\/$/,'')}/v1/projects/${encodeURIComponent(projectId)}/assets/${encodeURIComponent(assetId)}`,{
      method:'PUT',
      body:file,
      headers:{
        'content-type':file.type||'application/octet-stream',
        'x-tgg-asset-name':encodeURIComponent(file.name),
        'x-tgg-asset-type':type,
        'x-tgg-duration-ms':String(durationMs)
      }
    });
    const body=await r.json();
    if(!r.ok)throw new Error(body?.error||'Upload failed');
    return body.asset as Asset;
  }

  async function importFiles(files:FileList|File[]){
    const list=[...files];
    if(!list.length)return;
    setBusy(true);setStatus(`Importing ${list.length} file(s)…`);
    try{
      const added:Asset[]=[];
      const local:Array<{id:string;name:string;type:string;url:string}>=[];
      for(const file of list){
        const asset=await uploadOne(file);added.push(asset);
        local.push({id:asset.id,name:file.name,type:asset.type,url:URL.createObjectURL(file)});
      }
      setAssets(a=>[...a,...added]);
      setLocalMedia(a=>[...a,...local]);
      if(!selectedId&&local[0])setSelectedId(local[0].id);
      setStatus(`${added.length} file(s) ready`);
    }catch(e){setStatus(e instanceof Error?e.message:'Import failed')}
    finally{setBusy(false)}
  }

  async function runAI(directive:string,label:string){
    if(!assets.length){setStatus('Import footage or audio first');return;}
    setBusy(true);setRenderUrl(null);setStatus(`${label}: analyzing…`);
    try{
      const analyzed=await json(`/v1/projects/${projectId}/analyze`,{method:'POST',body:JSON.stringify({assets,signals:{}})});
      setStatus(`${label}: directing first cut…`);
      const plan=await json(`/v1/projects/${projectId}/plans`,{method:'POST',body:JSON.stringify({
        mode:'music-video',directives:[directive],mediaAnalyses:analyzed.mediaAnalyses,musicAnalysis:analyzed.musicAnalysis,
        canvas:{width:1920,height:1080}
      })});
      const applied=await json(`/v1/projects/${projectId}/plans/${plan.plan.id}/apply`,{method:'POST',body:'{}'});
      setTimeline(applied.timeline);setStatus(`${label} ready · timeline v${applied.timeline.version}`);
    }catch(e){setStatus(e instanceof Error?e.message:'AI edit failed')}
    finally{setBusy(false)}
  }

  async function render(){
    setBusy(true);setRenderProgress(0);setStatus('Render Center: queueing verified MP4…');
    try{
      let active=timeline;
      if(!active){
        await runAI('auto-first-cut','Auto first cut');
        throw new Error('First cut created — press Export project again to render.');
      }
      const q=await json(`/v1/projects/${projectId}/renders`,{method:'POST',body:JSON.stringify({
        timelineVersion:active.version,assets,preset:{width:1920,height:1080,fps:30,container:'mp4',codec:'h264'}
      })});
      for(let i=0;i<300;i++){
        await new Promise(r=>setTimeout(r,1000));
        const cur=await json(`/v1/jobs/${q.job.id}`);
        setRenderProgress(Math.round(cur.job.progress||0));setStatus(`Rendering · ${cur.job.status} · ${Math.round(cur.job.progress||0)}%`);
        if(cur.job.status==='failed')throw new Error(cur.job.error||'Render failed');
        if(cur.job.status==='succeeded'){
          setRenderProgress(100);setRenderUrl(cur.job.output.uri);setStatus('Verified MP4 ready');return;
        }
      }
      throw new Error('Render polling timed out');
    }catch(e){setStatus(e instanceof Error?e.message:'Render failed')}
    finally{setBusy(false)}
  }

  function removeClip(id:string){
    if(!timeline)return;
    setTimeline({...timeline,tracks:timeline.tracks.map(t=>({...t,clips:t.clips.filter(c=>c.id!==id)}))});
  }

  return <main style={{minHeight:'100vh',background:shell,color:'#f6f8fc',fontFamily:'Inter,system-ui,sans-serif'}}>
    <header style={{height:66,borderBottom:`1px solid ${border}`,display:'flex',alignItems:'center',gap:18,padding:'0 20px',background:'#0a0e14',position:'sticky',top:0,zIndex:20}}>
      <div style={{fontWeight:900,letterSpacing:1.1}}>TGG STUDIO <span style={{color:accent2}}>PRO</span></div>
      <input defaultValue="Untitled Music Video" aria-label="Project name" style={{background:'#111824',border:`1px solid ${border}`,borderRadius:8,padding:'8px 10px',color:'#fff',minWidth:240}}/>
      <div style={{fontSize:12,color:'#70e39a'}}>● {status}</div>
      <div style={{marginLeft:'auto',display:'flex',gap:8}}>
        <button style={ghost}>↶</button><button style={ghost}>↷</button><button style={ghost}>Save</button>
        <button disabled={busy} onClick={render} style={primary}>Export project</button>
      </div>
    </header>

    <div style={{display:'grid',gridTemplateColumns:'210px minmax(0,1fr) 300px',minHeight:'calc(100vh - 66px)'}}>
      <aside style={{borderRight:`1px solid ${border}`,padding:14,background:'#0b1017'}}>
        <small style={{color:muted,letterSpacing:1.5}}>CREATIVE SUITE</small>
        {['▣ Video','✧ AI Auto Edit','✦ Create Engine','▦ Storyboard','✎ Cartoon','◆ Animation','▤ Film + Series','✦ VFX','● Live Capture','♫ Audio','T Graphics','▤ Media Vault','◎ Collaboration','⬡ Render Center'].map((x,i)=>
          <div key={x} style={{padding:'9px 10px',borderRadius:8,marginTop:4,background:i===1?'#17152a':'transparent',color:i===1?'#c9c0ff':'#c6ceda',fontSize:13}}>{x}</div>)}
      </aside>

      <section style={{minWidth:0,padding:16,display:'grid',gridTemplateRows:'minmax(340px,54vh) auto 1fr',gap:12}}>
        <div style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) 270px',gap:12}}>
          <div style={{background:'#05070a',border:`1px solid ${border}`,borderRadius:12,display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',position:'relative'}}>
            {selected ? selected.type==='video'
              ? <video key={selected.url} src={selected.url} controls style={{width:'100%',height:'100%',objectFit:'contain'}}/>
              : <div style={{textAlign:'center'}}><div style={{fontSize:42}}>♫</div><audio src={selected.url} controls/><div style={{marginTop:10,color:muted}}>{selected.name}</div></div>
              : <div style={{textAlign:'center',color:muted}}><div style={{fontSize:40,marginBottom:10}}>TGG</div><button onClick={()=>fileRef.current?.click()} style={primary}>Import footage</button><p>Drop clips here or choose files</p></div>}
          </div>
          <div style={{background:panel,border:`1px solid ${border}`,borderRadius:12,padding:12,overflow:'auto'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><b>Media</b><button onClick={()=>fileRef.current?.click()} style={ghost}>＋</button></div>
            <input ref={fileRef} multiple type="file" accept="video/*,audio/*" onChange={e=>e.target.files&&importFiles(e.target.files)} style={{display:'none'}}/>
            {!localMedia.length&&<p style={{color:muted,fontSize:12}}>Your media will appear here</p>}
            {localMedia.map(item=><button key={item.id} onClick={()=>setSelectedId(item.id)} style={{width:'100%',display:'flex',alignItems:'center',gap:9,padding:8,borderRadius:8,border:`1px solid ${selectedId===item.id?accent:border}`,background:panel2,color:'#fff',marginTop:8,textAlign:'left'}}>
              <span>{item.type==='video'?'▶':'♫'}</span><span style={{whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{item.name}</span>
            </button>)}
          </div>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8}}>
          {[['Auto first cut','auto-first-cut'],['Beat sync','beat-sync'],['Clean audio','clean-audio'],['Smart reframe','smart-reframe']].map(([label,d])=>
            <button key={label} disabled={busy} onClick={()=>runAI(d,label)} style={{...primary,background:'linear-gradient(135deg,#27203e,#16253f)',border:`1px solid ${accent}`,padding:'12px 8px'}}>{label}</button>)}
        </div>

        <div style={{background:panel,border:`1px solid ${border}`,borderRadius:12,padding:12,minHeight:210}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
            <b>Timeline</b><span style={{fontSize:12,color:muted}}>Snap: On · v{timeline?.version||0}</span>
          </div>
          <div style={{height:26,borderBottom:`1px solid ${border}`,display:'grid',gridTemplateColumns:'repeat(5,1fr)',fontSize:11,color:muted}}>
            {['00:00','00:10','00:20','00:30','00:40'].map(x=><span key={x}>{x}</span>)}
          </div>
          {['V1 · Video','A1 · Audio','T1 · Text'].map((track,idx)=><div key={track} style={{display:'grid',gridTemplateColumns:'92px 1fr',gap:8,alignItems:'stretch',minHeight:48,borderBottom:`1px solid #1c2432`}}>
            <div style={{fontSize:11,color:muted,paddingTop:12}}>{track}</div>
            <div style={{display:'flex',gap:4,alignItems:'center',overflow:'hidden'}}>
              {idx===0&&clips.map(c=><button title="Remove clip" onClick={()=>removeClip(c.id)} key={c.id} style={{height:30,minWidth:Math.max(70,c.durationMs/22),border:`1px solid ${c.origin==='manual'?accent2:accent}`,background:'#27203e',color:'#fff',borderRadius:6,fontSize:10}}>{c.sourceAssetId.slice(0,10)} · {ms(c.durationMs)}</button>)}
              {idx===1&&timeline?.audio?.map((a:any)=><div key={a.id} style={{height:24,minWidth:150,background:'#12352d',border:'1px solid #216c55',borderRadius:5,padding:'5px 8px',fontSize:10}}>♫ {a.type}</div>)}
            </div>
          </div>)}
        </div>
      </section>

      <aside style={{borderLeft:`1px solid ${border}`,padding:14,background:'#0b1017',overflow:'auto'}}>
        <section style={card}><b>✦ TGG AI EDIT</b><p style={copy}>Build a clean first cut, sync edits to the beat, improve sound, or reframe for social.</p></section>
        <section style={card}><b>CAPTURE</b><div style={row}><button style={ghost}>● Camera + Mic</button><button style={ghost}>▣ Screen Record</button></div></section>
        <section style={card}><b>EFFECTS · 32 FX</b><p style={copy}>Looks · Motion · Keying · Audio FX</p>{['Cinematic Film','Teal + Gold','B&W Film','Neon Night','Dream Glow','VHS','Grain','Sharpen'].map(x=><span key={x} style={pill}>{x}</span>)}</section>
        <section style={card}><b>COLOR + LUT</b><p style={copy}>Exposure · Contrast · Saturation · Temperature</p></section>
        <section style={card}><b>TRANSITIONS</b><p style={copy}>Fade · Dissolve · Push Zoom Impact · Whip Pan · Flash</p></section>
        <section style={card}><b>CANVAS</b><p style={copy}>YouTube 16:9 · Shorts/Reels 9:16 · Square 1:1 · Feed 4:5</p></section>
        <section style={card}><b>RENDER CENTER</b><div style={{height:7,background:'#1b2431',borderRadius:5,overflow:'hidden',marginTop:10}}><div style={{height:'100%',width:`${renderProgress}%`,background:`linear-gradient(90deg,${accent},${accent2})`}}/></div>{renderUrl&&<a href={renderUrl} target="_blank" rel="noreferrer" style={{display:'inline-block',marginTop:10,color:'#8edcff'}}>Open verified MP4</a>}</section>
      </aside>
    </div>
  </main>
}

const primary:React.CSSProperties={background:`linear-gradient(135deg,${accent},#5b7cff)`,border:0,borderRadius:8,padding:'9px 13px',color:'#fff',fontWeight:700,cursor:'pointer'};
const ghost:React.CSSProperties={background:'#121926',border:`1px solid ${border}`,borderRadius:8,padding:'8px 10px',color:'#d9e0ea',cursor:'pointer'};
const card:React.CSSProperties={background:panel,border:`1px solid ${border}`,borderRadius:10,padding:12,marginBottom:10};
const copy:React.CSSProperties={fontSize:12,lineHeight:1.5,color:muted};
const row:React.CSSProperties={display:'flex',gap:6,flexWrap:'wrap'};
const pill:React.CSSProperties={display:'inline-block',fontSize:10,padding:'5px 7px',margin:'4px 4px 0 0',background:'#141d2a',border:`1px solid ${border}`,borderRadius:99,color:'#c7d0dd'};
