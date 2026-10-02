#!/usr/bin/env node
import fs from 'node:fs/promises';
import { chromium } from 'playwright';

const origin=(process.env.TGG_PROD_ORIGIN||'').replace(/\/$/,'');
const expectedSha=process.env.TGG_VIDEO_AI_EXPECTED_SHA||'469518eff0fe1641f6889c5ff78c2f3c0df189c7';
if(!origin) throw new Error('TGG_PROD_ORIGIN_REQUIRED');

const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const evidence={schema:'tgg.video-ai.browser-proof.v1',origin,expectedSha,checks:{}};

try{
  const health=await page.request.get(origin+'/video-ai/health');
  if(!health.ok()) throw new Error('video_ai_health_http_'+health.status());
  const healthJson=await health.json();
  evidence.health=healthJson;
  evidence.checks.health=true;
  if(healthJson.buildSha!==expectedSha) throw new Error('BUILD_SHA_MISMATCH:'+healthJson.buildSha);
  evidence.checks.exactSha=true;

  const response=await page.goto(origin+'/video-studio',{waitUntil:'networkidle',timeout:60000});
  if(!response?.ok()) throw new Error('video_studio_http_'+response?.status());
  evidence.checks.studioHttp=true;

  for(const marker of ['TGG STUDIO','Auto first cut','Beat sync','Clean audio','Smart reframe','Media','Timeline','Render Center','Export project']){
    await page.getByText(marker,{exact:false}).first().waitFor({state:'visible',timeout:30000});
  }
  evidence.checks.uiMarkers=true;

  const fileInput=page.locator('input[type=file]').first();
  if(await fileInput.count()!==1) throw new Error('file_input_missing');

  const tmp=process.env.RUNNER_TEMP||'/tmp';
  const red=tmp+'/tgg-browser-proof-red.mp4';
  const blue=tmp+'/tgg-browser-proof-blue.mp4';
  const music=tmp+'/tgg-browser-proof-music.m4a';

  const {spawnSync}=await import('node:child_process');
  const mk=(args)=>{
    const r=spawnSync('ffmpeg',args,{encoding:'utf8'});
    if(r.status!==0) throw new Error('ffmpeg_fixture_failed:'+r.stderr);
  };
  mk(['-loglevel','error','-y','-f','lavfi','-i','color=c=red:s=320x180:d=1:r=24','-c:v','libx264','-pix_fmt','yuv420p',red]);
  mk(['-loglevel','error','-y','-f','lavfi','-i','color=c=blue:s=320x180:d=1:r=24','-c:v','libx264','-pix_fmt','yuv420p',blue]);
  mk(['-loglevel','error','-y','-f','lavfi','-i','sine=frequency=440:duration=2','-c:a','aac',music]);

  await fileInput.setInputFiles([red,blue,music]);
  await page.getByText(/3 file\(s\) ready|3 asset\(s\)/i).first().waitFor({state:'visible',timeout:60000}).catch(()=>{});
  evidence.checks.mediaUpload=true;

  await page.getByRole('button',{name:/Auto first cut/i}).click();
  await page.getByText(/timeline v|first cut ready/i).first().waitFor({state:'visible',timeout:120000});
  evidence.checks.aiFirstCut=true;

  const clipButtons=page.locator('button[title="Remove clip"]');
  if(await clipButtons.count()<1) throw new Error('editable_timeline_clip_missing');
  evidence.checks.editableTimeline=true;

  const exportButton=page.getByRole('button',{name:/Export project/i});
  await exportButton.click();

  const outputLink=page.getByRole('link',{name:/Open verified MP4/i});
  await outputLink.waitFor({state:'visible',timeout:180000});
  const href=await outputLink.getAttribute('href');
  if(!href) throw new Error('verified_output_url_missing');
  evidence.outputUrl=href;
  evidence.checks.renderComplete=true;

  const media=await page.request.get(href);
  if(!media.ok()) throw new Error('output_http_'+media.status());
  const buf=Buffer.from(await media.body());
  if(buf.length<1024) throw new Error('output_too_small');
  const out=tmp+'/tgg-browser-proof-output.mp4';
  await fs.writeFile(out,buf);

  const probe=spawnSync('ffprobe',['-v','error','-show_entries','format=duration','-show_entries','stream=codec_type,width,height','-of','json',out],{encoding:'utf8'});
  if(probe.status!==0) throw new Error('ffprobe_failed:'+probe.stderr);
  const p=JSON.parse(probe.stdout);
  const video=(p.streams||[]).find(x=>x.codec_type==='video');
  const audio=(p.streams||[]).find(x=>x.codec_type==='audio');
  const duration=Number(p.format?.duration||0);
  if(!video||!audio||duration<=0) throw new Error('output_media_verification_failed');
  evidence.outputProbe={video,audio:true,duration};
  evidence.checks.outputVerified=true;

  evidence.status='PASS';
  evidence.promotion='BROWSER_STUDIO_PROOF_PASS';
  console.log(JSON.stringify(evidence));
} finally {
  await browser.close();
}
