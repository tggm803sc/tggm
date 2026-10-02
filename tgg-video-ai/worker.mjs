import {createStore} from './store.mjs';
import {createVideoAiOrchestrator} from './orchestrator.mjs';
const once=process.argv.includes('--once');
const store=createStore();
const orch=createVideoAiOrchestrator({store});
async function tick(){
 await orch.recoverPendingJobs();
 const jobs=await store.list('render-jobs',{status:'queued',limit:50});
 for(const job of jobs)console.log(JSON.stringify({job_id:job.id,status:'queued',render_executor:'unavailable'}));
}
await tick();
if(!once)setInterval(()=>tick().catch(e=>console.error(e)),5000);
