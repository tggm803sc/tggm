import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {pathToFileURL,fileURLToPath} from 'node:url';

function run(bin,args,{timeoutMs=120000}={}){
  return new Promise((resolve,reject)=>{
    const p=spawn(bin,args,{stdio:['ignore','pipe','pipe']});
    let stdout='',stderr='';
    p.stdout.on('data',d=>stdout+=d);
    p.stderr.on('data',d=>stderr+=d);
    const timer=setTimeout(()=>{p.kill('SIGKILL');reject(new Error(bin+'_timeout'));},timeoutMs);
    p.on('error',reject);
    p.on('close',code=>{
      clearTimeout(timer);
      code===0?resolve({stdout,stderr}):reject(new Error(bin+'_failed:'+stderr.slice(-6000)));
    });
  });
}
function assetUri(asset){
  const raw=String(asset?.uri||'').trim();
  if(!raw)throw new Error('render_asset_uri_missing:'+(asset?.id||'unknown'));
  if(path.isAbsolute(raw))return raw;
  if(raw.startsWith('file://'))return fileURLToPath(raw);
  if(raw.startsWith('https://'))return raw;
  throw new Error('render_asset_uri_unsupported:'+asset.id);
}
function seconds(ms){return (Math.max(0,Number(ms)||0)/1000).toFixed(3);}
function videoCodec(codec){return codec==='h265'?'libx265':'libx264';}
function mimeFor(container){return container==='webm'?'video/webm':'video/mp4';}

export async function executeFfmpegRender({manifest,outputDir,ffmpeg='ffmpeg',ffprobe='ffprobe'}={}){
  if(!manifest?.manifestHash||!manifest?.payload?.timeline)throw new Error('render_manifest_invalid');
  const preset=manifest.payload.preset||{};
  const width=Math.max(16,Number(preset.width)||1920);
  const height=Math.max(16,Number(preset.height)||1080);
  const fps=Math.max(1,Number(preset.fps)||30);
  const expectedMs=Math.max(1,Number(manifest.payload.expectedDurationMs)||1);
  const assetMap=new Map((manifest.payload.assets||[]).map(a=>[a.id,a]));
  const clips=(manifest.payload.timeline.tracks||[])
    .filter(t=>t.type==='video')
    .flatMap(t=>t.clips||[])
    .sort((a,b)=>(a.timelineStartMs||0)-(b.timelineStartMs||0));
  if(!clips.length)throw new Error('render_video_clips_required');

  let cursor=0;
  for(const clip of clips){
    const start=Number(clip.timelineStartMs)||0;
    if(start<cursor-1)throw new Error('render_overlapping_video_clips_unsupported');
    if(start>cursor+1)throw new Error('render_timeline_gaps_unsupported');
    cursor=start+(Number(clip.durationMs)||Math.max(0,(Number(clip.endMs)||0)-(Number(clip.startMs)||0)));
  }

  const root=path.resolve(outputDir||process.env.TGG_VIDEO_AI_OUTPUT_DIR||'/data/tgg-video-ai/outputs');
  await fs.mkdir(root,{recursive:true});
  const output=path.join(root,'tgg-render-'+manifest.manifestHash.slice(0,16)+'.mp4');
  const args=['-y'];
  const filters=[];

  for(let i=0;i<clips.length;i++){
    const clip=clips[i];
    const asset=assetMap.get(clip.sourceAssetId);
    if(!asset)throw new Error('render_asset_missing:'+clip.sourceAssetId);
    const durationMs=Number(clip.durationMs)||Math.max(0,(Number(clip.endMs)||0)-(Number(clip.startMs)||0));
    args.push('-ss',seconds(clip.startMs),'-t',seconds(durationMs),'-i',assetUri(asset));
    filters.push('['+i+':v:0]scale='+width+':'+height+':force_original_aspect_ratio=decrease,pad='+width+':'+height+':(ow-iw)/2:(oh-ih)/2,setsar=1,fps='+fps+',setpts=PTS-STARTPTS[v'+i+']');
  }

  filters.push(clips.map((_,i)=>'[v'+i+']').join('')+'concat=n='+clips.length+':v=1:a=0[vout]');
  const audioItem=(manifest.payload.timeline.audio||[]).find(a=>a.sourceAssetId&&a.type!=='clean-audio');
  let audioInputIndex=null;
  if(audioItem){
    const asset=assetMap.get(audioItem.sourceAssetId);
    if(!asset)throw new Error('render_asset_missing:'+audioItem.sourceAssetId);
    audioInputIndex=clips.length;
    args.push('-ss',seconds(audioItem.startMs),'-t',seconds((audioItem.endMs??expectedMs)-(audioItem.startMs||0)),'-i',assetUri(asset));
  }

  args.push('-filter_complex',filters.join(';'),'-map','[vout]');
  if(audioInputIndex!==null)args.push('-map',audioInputIndex+':a:0?','-c:a','aac','-b:a','192k');
  else args.push('-an');
  args.push('-t',seconds(expectedMs),'-c:v',videoCodec(preset.codec),'-pix_fmt','yuv420p','-movflags','+faststart','-preset','medium','-crf','18',output);

  await run(ffmpeg,args,{timeoutMs:Math.max(120000,expectedMs*20)});
  const probe=await run(ffprobe,['-v','error','-show_streams','-show_format','-of','json',output],{timeoutMs:30000});
  const data=JSON.parse(probe.stdout);
  const video=(data.streams||[]).find(s=>s.codec_type==='video');
  const duration=Number(data.format?.duration||video?.duration||0);
  if(!video||!Number.isFinite(duration)||duration<=0)throw new Error('render_output_metadata_invalid');
  await fs.access(output);

  return {
    exists:true,
    readable:true,
    manifestHash:manifest.manifestHash,
    assetId:'render-'+manifest.manifestHash.slice(0,16),
    path:output,
    uri:pathToFileURL(output).href,
    metadata:{
      durationMs:Math.round(duration*1000),
      width:Number(video.width)||0,
      height:Number(video.height)||0,
      mimeType:mimeFor(preset.container)
    }
  };
}
