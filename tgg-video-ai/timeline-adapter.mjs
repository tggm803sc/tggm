import {normalizeTimelineVersion} from './contracts.mjs';

function clone(v){return structuredClone(v);}
function toTimelineClip(planClip,index){
  return {...clone(planClip),id:`timeline-${planClip.id}-${index+1}`,planItemId:planClip.id,origin:'ai',removable:true};
}
function mapDecor(items=[]){
  return (Array.isArray(items)?items:[]).map((item,index)=>({...clone(item),id:`timeline-${item.id||`item-${index+1}`}`,planItemId:item.id||null,origin:'ai',removable:true}));
}
function timelineFromPlan(plan,version=1){
  return normalizeTimelineVersion({
    id:`timeline-${plan.projectId}-v${version}`,projectId:plan.projectId,version,planId:plan.id,
    tracks:(Array.isArray(plan.tracks)?plan.tracks:[]).map(track=>({...clone(track),clips:(Array.isArray(track.clips)?track.clips:[]).map(toTimelineClip)})),
    captions:mapDecor(plan.captions),effects:mapDecor(plan.effects),transitions:mapDecor(plan.transitions),reframes:mapDecor(plan.reframes),audio:mapDecor(plan.audio),
    metadata:{planVersion:plan.version}
  });
}
export function applyEditPlan({plan,previousTimeline=null}={}){
  if(!previousTimeline)return timelineFromPlan(plan,1);
  return mergePlanSuggestions({plan,timeline:previousTimeline,strategy:'replace-ai-only'});
}
export function markManualEdit(timeline,edit={}){
  const next=clone(timeline);
  next.version=Number(timeline.version||0)+1;
  next.id=`timeline-${next.projectId}-v${next.version}`;
  if(edit.type==='update-clip'){
    let found=false;
    for(const track of next.tracks||[]){
      const clip=(track.clips||[]).find(c=>c.id===edit.itemId);
      if(clip){Object.assign(clip,clone(edit.patch||{}),{origin:'manual'});found=true;break;}
    }
    if(!found)throw new Error('timeline_item_not_found');
  }else throw new Error('unsupported_manual_edit');
  return normalizeTimelineVersion(next);
}
export function mergePlanSuggestions({plan,timeline,strategy='replace-ai-only',selectedIds=[]}={}){
  const next=clone(timeline);
  next.version=Number(timeline.version||0)+1;
  next.id=`timeline-${next.projectId}-v${next.version}`;
  next.planId=plan.id;
  const plannedTracks=(Array.isArray(plan.tracks)?plan.tracks:[]).map(track=>({...clone(track),clips:(Array.isArray(track.clips)?track.clips:[]).map(toTimelineClip)}));
  if(strategy==='replace-ai-only'){
    const manual=[];
    for(const track of next.tracks||[])for(const clip of track.clips||[])if(clip.origin==='manual')manual.push(clone(clip));
    const ai=plannedTracks.flatMap(t=>t.clips||[]);
    next.tracks=[{id:'video-1',type:'video',clips:[...manual,...ai]}];
    for(const key of ['captions','effects','transitions','reframes','audio']){
      const preserved=(next[key]||[]).filter(item=>item.origin==='manual');
      next[key]=[...preserved,...mapDecor(plan[key])];
    }
  }else if(strategy==='append-suggestions'){
    if(!next.tracks?.length)next.tracks=[{id:'video-1',type:'video',clips:[]}];
    next.tracks[0].clips.push(...plannedTracks.flatMap(t=>t.clips||[]));
    for(const key of ['captions','effects','transitions','reframes','audio'])next[key]=[...(next[key]||[]),...mapDecor(plan[key])];
  }else if(strategy==='selected'){
    const selected=new Set(selectedIds||[]);
    if(!next.tracks?.length)next.tracks=[{id:'video-1',type:'video',clips:[]}];
    next.tracks[0].clips=(next.tracks[0].clips||[]).filter(c=>c.origin==='manual');
    for(const track of plannedTracks)next.tracks[0].clips.push(...(track.clips||[]).filter(c=>selected.has(c.planItemId)));
    for(const key of ['captions','effects','transitions','reframes','audio']){
      next[key]=(next[key]||[]).filter(item=>item.origin==='manual');
      next[key].push(...mapDecor(plan[key]).filter(item=>selected.has(item.planItemId)));
    }
  }else throw new Error('invalid_merge_strategy');
  next.metadata={...(next.metadata||{}),planVersion:plan.version};
  return normalizeTimelineVersion(next);
}
