import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {findDndEntry,dndVariantForEvent} from '../scripts/catalogs/dnd5e/dnd5e-catalog.mjs';
import {effectiveActivity} from './dnd5e-source.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const active=new Set(['action','bonus','reaction','legendary','lair','special','crew']);
export async function nativeNpcSources(systemRoot=path.resolve(root,'../../systems/dnd5e')){
 const manifest=JSON.parse(await fs.readFile(path.join(systemRoot,'system.json'),'utf8'));
 const {ClassicLevel}=createRequire('C:/Program Files/Foundry Virtual Tabletop/resources/app/main.js')('classic-level');
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'animater-dnd-npc-')),rows=[];let actors=0;
 try{for(const pack of manifest.packs.filter(p=>p.type==='Actor')){
  const copy=path.join(temp,pack.name);await fs.cp(path.join(systemRoot,pack.path),copy,{recursive:true,filter:p=>path.basename(p)!=='LOCK'});
  const db=new ClassicLevel(copy,{valueEncoding:'json'});await db.open();
  try{const entries=[];for await(const [key,value] of db.iterator())entries.push([key,value]);
   const npcs=new Map(entries.filter(([k,v])=>/^!actors![^!]+$/.test(k)&&v.type==='npc').map(([,v])=>[v._id,v]));actors+=npcs.size;
   for(const [key,item] of entries){const match=key.match(/^!actors\.items!([^.]+)\.([^.]+)$/);const actor=match&&npcs.get(match[1]);
    if(actor&&item.type==='feat'&&Object.keys(item.system?.activities??{}).length)rows.push({system:'dnd5e',pack:pack.name,source:`Compendium.dnd5e.${pack.name}.Actor.${actor._id}.Item.${item._id}`,actor:{id:actor._id,name:actor.name,type:actor.type},item});}
  }finally{await db.close();}
 }}finally{if(path.resolve(temp).startsWith(path.resolve(os.tmpdir())+path.sep+'animater-dnd-npc-'))await fs.rm(temp,{recursive:true,force:true});}
 return {rows,version:manifest.version,actors};
}

// Only explicit native activations are actionable. Empty and turn-boundary
// activities are passive bookkeeping, not buttons to animate automatically.
export function eligibleNpcActivity(activity){return active.has(activity.activation?.type);}
const clean=s=>String(s??'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
function formFor(item,a){
 const text=`${item.name} ${a.name}`.toLowerCase(),template=a.target?.template?.type;
 const trigger=template?'template':a.type==='attack'?'attack':'use';
 let id,aim='self';
 const choose=(key,target=false)=>{id=key;aim=target?'target':'self';};
 if(a.type==='cast')choose('review-c-spell');
 else if(/escape|rescue|pull check|break tendril|calm check/.test(text))choose('review-c-escape');
 else if(/breath/.test(text)&&template){const element=/lightning/.test(text)?'electricity':/fire/.test(text)?'fire':/cold/.test(text)?'cold':/acid/.test(text)?'acid':/poison/.test(text)?'poison':'other';id=`breath:${element}-${template==='line'?'line':'cone'}`;aim='area';}
 else if(/healing touch|confer fire resistance/.test(text))choose(/healing/.test(text)?'review-c-aid':'review-c-ward',true);
 else if(/rejuven|regenerat|heal self|absorption|undead fortitude/.test(text)||a.type==='heal')choose('review-c-recover');
 else if(/move|dash|flight|reposition|fey step|roll/.test(text))choose('review-c-move');
 else if(/wing attack|tail attack/.test(text))choose('review-c-sweep');
 else if(/detect|insight|mimicry/.test(text))choose('review-c-focus');
 else if(/illumination|blazing light/.test(text))choose('review-c-light');
 else if(/gaze|glare/.test(text))choose('review-c-mark',true);
 else if(/screech|moan|roar|song/.test(text))choose('review-c-vocal',true);
 else if(/reflect|deflect|interpos|shield/.test(text))choose('review-c-rebound');
 else if(/antimagic|aversion/.test(text))choose('review-c-enfeeble');
 else if(/rust|corrode/.test(text))choose('review-c-acidtarget',true);
 else if(/stench|ink cloud|spores/.test(text))choose(/spore/.test(text)?'review-c-spores':'review-c-fumes');
 else if(/fire form|fire aura/.test(text))choose('review-c-heat');
 else if(/swallow/.test(text))choose('review-c-consume');
 else if(/grasp|grappl|constrict|engulf|whelm|adhesive|web|reel/.test(text))choose('review-c-grip');
 else if(/whirlwind|vortex/.test(text))choose('review-c-sweep');
 else if(/psychic drain|damage transfer|life drain/.test(text))choose('review-c-soul');
 else if(/split|specter|animate trees|limbs/.test(text)||a.type==='summon')choose('review-c-summon');
 else if(/incubus|shape|transform/.test(text)||a.type==='transform')choose('review-c-shape');
 else if(/war cry|berserk/.test(text))choose('review-c-fury');
 else if(/cantrip/.test(text))choose('review-c-spell');
 else if(/multiattack|martial advantage|sneak attack|bonus charge|expend use/.test(text))choose('review-c-strike');
 else if(a.type==='check')choose('review-c-focus');
 else if(a.type==='damage'||a.type==='save'||a.type==='attack'){
  const types=[...(a.damage?.parts??[]).flatMap(p=>p.types??[]),...(a.damage?.onSave?[a.damage.onSave]:[])];
  const element=types.find(t=>['acid','cold','fire','force','lightning','necrotic','poison','psychic','radiant','thunder'].includes(t));
  const mapped={lightning:'electricity',necrotic:'void',radiant:'spirit',thunder:'sonic',psychic:'mental'}[element]??element;
  if(mapped||a.type==='attack'){id=`generic:${template?template==='line'?'line':template==='cone'?'cone':'burst':'hit'}-${mapped??'physical'}`;aim=template?'area':'target';}
  else choose(/poison|venom/.test(text)?'review-a-poison-control':'review-c-mark',true);
 }else if(/attack|strike|bite|fist|slam|jab|bolt|charge/.test(text))choose('review-c-strike');
 else choose('review-c-focus');
 return {id,aim,trigger,rationale:`${clean(a.name)||item.name}: ${a.type} ${a.activation.type} activity. Native rolls, movement and conditions remain authoritative.`};
}

export function buildDndNpcActions(rows,{version,actors}={}){
 const groups=new Map();let skipped=0,occurrences=0;
 for(const row of rows)for(const raw of Object.values(row.item.system.activities??{})){
  const a=effectiveActivity(row.item,raw);
  if(!eligibleNpcActivity(a)){skipped++;continue;}occurrences++;
  const form=formFor(row.item,a),event={type:form.trigger,item:{...row.item,actor:row.actor,_stats:{...row.item._stats,compendiumSource:row.source}},actor:row.actor,activity:a,activityId:a._id,activityName:a.name,targets:[{}]};
  const entry=findDndEntry(event),variant=a.type!=='cast'&&entry&&dndVariantForEvent(entry,event);
  // Group identical native feature/activity designs across creatures while
  // preserving every source+activity identity for exact runtime selection.
  const native=variant?{entryId:entry.id,variantId:variant.id}:null;
  const edition=row.item.system.source?.rules??'2014',key=JSON.stringify([row.item.name,a.name??'',a.type,a.activation.type,edition,form,native]);
  if(!groups.has(key))groups.set(key,{id:'dnd5e-npc-'+createHash('sha256').update(key).digest('hex').slice(0,16),systemId:'dnd5e',name:row.item.name,names:[row.item.name],creatures:[],sources:[],matches:[],activityId:a._id,activityType:a.type,activityName:a.name??'',activation:a.activation.type,edition,form,aim:form.aim,trigger:form.trigger,native,coverage:a.type==='cast'?'delegated':native?'native':'reviewed',delegated:a.type==='cast'});
  const action=groups.get(key);if(!action.creatures.includes(row.actor.name))action.creatures.push(row.actor.name);if(!action.sources.includes(row.source))action.sources.push(row.source);action.matches.push({source:row.source,activityId:a._id});
 }
 const actions=[...groups.values()].sort((a,b)=>a.name.localeCompare(b.name)||a.activityName.localeCompare(b.activityName)||a.edition.localeCompare(b.edition));
 return {actions,source:{system:'dnd5e',version,actors,featureOccurrences:rows.length,activityOccurrences:occurrences,excludedPassiveActivities:skipped,actions:actions.length,native:actions.filter(a=>a.native).length,reviewed:actions.filter(a=>a.coverage==='reviewed').length,delegated:actions.filter(a=>a.delegated).length}};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const source=await nativeNpcSources(process.argv.find(a=>a.startsWith('--system='))?.slice(9));
 const result=buildDndNpcActions(source.rows,source);
 await fs.writeFile(path.join(root,'data/dnd5e-npc-actions.mjs'),`// Generated from native D&D5e Actor packs; no source descriptions.\nexport const DND_NPC_ACTION_SOURCE=${JSON.stringify(result.source)};\nexport const DND_NPC_ACTIONS=${JSON.stringify(result.actions,null,1)};\n`);
 console.log(result.source);
}
