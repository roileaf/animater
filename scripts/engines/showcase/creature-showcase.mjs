import {validateRecipe} from '../../core/model.mjs';
import {normalizePreviewArea} from '../preview/canvas-preview-area.mjs';

const list=value=>Array.from(value?.contents??value?.values?.()??(Array.isArray(value)?value:Object.values(value??{})));
export const isShowcaseCreature=actor=>['npc','adversary'].includes(actor?.type);
export function showcasePreviewArea(item,activity){
 const area=item.system?.area,template=activity?.target?.template;
 const native=normalizePreviewArea(area)??normalizePreviewArea(template?{type:template.type==='wall'?'line':template.type,value:template.size??template.value,width:template.width}:null);
 if(native)return native;
 const macro=/@Template\[([^\]]+)\]/i.exec(item.system?.description?.value??'');if(!macro)return null;
 const parts=macro[1].split('|'),values=Object.fromEntries(parts.filter(p=>p.includes(':')).map(p=>p.split(':')));
 return normalizePreviewArea({type:values.type??parts[0],value:values.distance??values.radius??values.size,width:values.width});
}
export function showcaseMovementRecipe(systemId){
 return validateRecipe({id:'showcase-movement',name:'Movement',systemId,trigger:'manual',stages:[{
  stageId:'walk',kind:'motion',motion:'path',subject:'source',duration:2800,pathEase:'linear',
  keyframes:[{at:0,x:0,y:0},{at:.5,x:2,y:0},{at:1,x:0,y:0}],assets:[],
 }]});
}

// Resolve real embedded items and activities without using/rolling any of them.
// Keep activity identities: two breaths on one D&D feature are separate steps.
export function buildCreatureShowcase({actor,systemId,resolve,limit=24}={}){
 if(!isShowcaseCreature(actor))return {steps:[],unavailable:[],total:0};
 const steps=[{id:'movement',name:'Movement',kind:'movement',recipe:showcaseMovementRecipe(systemId)}],unavailable=[],seen=new Set();
 const items=list(actor.items),weaponName=s=>String(s??'').toLowerCase().replace(/^\+\d+\s*/,'').trim();
 const strikes=new Set(items.filter(i=>i.type==='melee').map(i=>weaponName(i.name)));
 for(const item of items){
  if(item.type==='weapon'&&strikes.has(weaponName(item.name)))continue;
  if(!['action','melee','weapon','spell','feat','feature'].includes(item.type))continue;
  if(item.type==='action'&&item.system?.actionType?.value==='passive')continue;
  const activities=systemId==='dnd5e'?list(item.system?.activities):[];
  if(systemId==='dnd5e'&&!activities.length)continue;
  const subjects=activities.length?activities:[null];let found=false;
  for(const activity of subjects){
   if(activity&&!['action','bonus','reaction','legendary','lair','special','minute','hour'].includes(activity.activation?.type))continue;
   if(activity?.type==='cast')continue; // The actual embedded spells appear separately.
   let matched=false;
   for(const type of ['template','attack','use']){
    const event={type,systemId,item,actor,activity,activityId:activity?.id??activity?._id,activityType:activity?.type,activityName:activity?.name,
     targets:[{id:'showcase-target'}],spellLevel:Number(item.system?.level?.value??item.system?.level)||undefined};
    const recipe=resolve(event);if(!recipe||recipe.lifecycle==='document')continue;
    const key=[item.id??item._id??item.name,event.activityId??'',recipe.id,recipe.trigger].join(':');
    if(seen.has(key))continue;seen.add(key);matched=found=true;
    const name=activity?.name&&activity.name!==item.name?`${item.name} · ${activity.name}`:item.name;
    const kind=item.type==='spell'?'spell':type==='attack'?'attack':type==='template'?'area':'ability';
    const area=!recipe.previewArea&&recipe.stages.some(s=>s.kind==='template')?showcasePreviewArea(item,activity):null;
    steps.push({id:key,name,kind,itemId:item.id??item._id,activityId:event.activityId,recipe:validateRecipe({...recipe,...(area?{previewArea:area}:{})})});
    // A single activation's use/attack followups stay one coherent preview.
    break;
   }
   if(!matched&&activity)unavailable.push({name:`${item.name}${activity.name&&activity.name!==item.name?` · ${activity.name}`:''}`});
  }
  if(!found&&!activities.length)unavailable.push({name:item.name});
 }
 const priority=s=>s.kind==='movement'?0:/breath|exhal|megavolt/i.test(s.name)?1:s.kind==='attack'?2:s.kind==='area'?3:s.kind==='ability'?4:5;
 steps.sort((a,b)=>priority(a)-priority(b));
 return {steps:steps.slice(0,Math.max(1,Math.min(60,Number(limit)||24))),unavailable,total:steps.length};
}
