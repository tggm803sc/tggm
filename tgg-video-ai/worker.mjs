import {createStore} from './store.mjs';
import {createVideoAiOrchestrator} from './orchestrator.mjs';
import {executeFfmpegRender} from './ffmpeg-executor.mjs';

const once=process.argv.includes('--once');
const store=createStore();
const renderMode=String(process.env.TGG_VIDEO_AI_RENDER_MODE||'ffmpeg');
const outputDir=process.env.TGG_VIDEO_AI_OUTPUT_DIR||'/data/tgg-video-ai/outputs';
const renderExecutor=renderMode==='ffmpeg'
  ? (manifest)=>executeFfmpegRender({manifest,outputDir})
  : null;
const orch=createVideoAiOrchestrator({store,renderExecutor});

await orch.recoverPendingJobs();

async function tick(){
  const jobs=await store.list('render-jobs',{status:'queued',limit:50});
  for(const job of jobs){
    if(!renderExecutor){
      console.log(JSON.stringify({job_id:job.id,status:'HOLD',reason:'render_executor_unavailable',render_mode:renderMode}));
      continue;
    }
    const result=await orch.processQueuedJob(job.id);
    console.log(JSON.stringify({job_id:job.id,status:result.job?.status||'unknown',render_mode:renderMode}));
  }
}
await tick();
if(!once)setInterval(()=>tick().catch(e=>console.error(e)),5000);
