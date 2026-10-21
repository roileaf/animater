import {DND5E_ENTRIES,DND5E_SOURCE} from '../../../data/dnd5e-catalog.mjs';
import {clone,normalize,validateRecipe,matchRecipe, ownRecipe,matchStrikeOverride} from '../../core/model.mjs';
import {addSpellSounds} from '../../engines/sound/spell-sounds.mjs';
import {addAbilitySounds} from '../../engines/sound/ability-sounds.mjs';
import {applyCatalogMotion,dndMotionReview,withoutCatalogMotion} from '../shared/catalog-motion.mjs';
import {withCatalogFx} from '../shared/catalog-fx.mjs';
export {DND5E_ENTRIES,DND5E_SOURCE};
export const DND_KINDS=['spell','feat','weapon','item','condition','effect'];
const byId=new Map(DND5E_ENTRIES.map(e=>[e.id,e]));
const byUuid=new Map(DND5E_ENTRIES.filter(e=>e.uuid).map(e=>[e.uuid,e]));
export const dndEntries=kind=>kind?DND5E_ENTRIES.filter(e=>e.kind===kind):DND5E_ENTRIES;
const BOOK_LABELS={'dnd-players-handbook':'PHB','dnd-dungeon-masters-guide':'DMG','dnd-monster-manual':'MM','dnd-heroes-borderlands':'Borderlands'};
export const dndBookLabel=id=>BOOK_LABELS[id]??globalThis.game?.modules?.get?.(id)?.title??id;
// Official-book content the SRD lacks (data/dnd5e-book-catalog.mjs) joins the catalog
// only for book modules active in this world (entry.requires).
export function addDndBookEntries(entries,active=()=>true){
 let added=0;
 for(const e of entries??[]){
  if(byId.has(e.id)||!active(e.requires))continue;
  DND5E_ENTRIES.push(e);byId.set(e.id,e);if(e.uuid)byUuid.set(e.uuid,e);added++;
 }
 return added;
}
export const dndEntry=id=>byId.get(String(id).replace(/^animater-/,''))??null;
export function normalizeDndCatalogState(state={}){
 state??={};const ids=values=>[...new Set((Array.isArray(values)?values:[]).filter(id=>byId.has(id)))];
 return {enabled:state.enabled===true,independent:state.independent===true,preferCatalog:state.preferCatalog===true,scope:state.scope==='selected'?'selected':'all',selected:ids(state.selected),excluded:ids(state.excluded),customized:ids(state.customized),motion:state.motion!==false,fade:state.fade===true,turn:state.turn===true,sound:state.sound!==false,soundVolume:Number.isFinite(Number(state.soundVolume))?Math.max(0,Math.min(1,Number(state.soundVolume))):.35,opacity:Number.isFinite(Number(state.opacity))?Math.max(.1,Math.min(1,Number(state.opacity))):1};
}
export const dndEntryEnabled=(id,state)=>state?.enabled===true&&!state.excluded?.includes(id)&&(state.scope!=='selected'||state.selected?.includes(id)||state.customized?.includes(id));
export function useDndEntry(state,id){
 if(!byId.has(id))throw Error('Choose a D&D catalog entry first.');
 state=normalizeDndCatalogState(state);
 return normalizeDndCatalogState({...state,enabled:true,independent:true,scope:state.enabled?state.scope:'selected',selected:state.enabled?[...state.selected,id]:[id],excluded:state.excluded.filter(v=>v!==id),customized:state.customized.filter(v=>v!==id)});
}
export function dndRecipe(entry,variantId,{motion=true,sounds,soundVolume=.35,fx=true,fxCatalog}={}){
 if(!entry)throw Error('Choose a D&D catalog entry first.');
 const variant=entry.variants.find(v=>v.id===variantId)??entry.variants[0];
 let recipe=clone(variant.recipe);
 recipe.stages=applyCatalogMotion(entry,recipe.stages,dndMotionReview(entry,variant));
 if(!motion)recipe.stages=withoutCatalogMotion(recipe.stages);
 if(!['condition','effect'].includes(entry.kind)){
  const item={id:entry.id,slug:entry.slug,soundProfile:variant.soundProfile};
  const design={profile:variant.soundProfile,excludeRoles:variant.soundExcludeRoles};
  recipe.stages=variant.soundNamespace==='ability'?addAbilitySounds(item,recipe.stages,{sounds,soundVolume,mode:variant.weaponMode,design}):addSpellSounds(item,recipe.stages,{sounds,soundVolume,design});
 }
 return withoutHexDome(withCatalogFx(validateRecipe(recipe),entry,{fx,fxCatalog,variant,motion,sounds,soundVolume}));
}
// JB2A's hexagonal force-field domes (shield.01-03) swamp the token at 1.15-1.8x and
// read as sci-fi barriers. D&D wards, resistances and armour show the compact shield
// marker instead (Free ships only the green one, so the hue is tinted), and themed
// elemental shields stay close to the token.
const HEX_DOME=/^jb2a.shield.0[1-3]./;
const DOME_COLORS=[[/red|orange|pink/,'dark_red','#d0485a'],[/yellow|gold/,'yellow','#f0d060'],[/green/,'green',null],[/./,'blue','#6fa8ff']];
export function withoutHexDome(recipe){
 for(const s of recipe.stages){
  // Force-field bubbles stay as areas (a sphere spell's footprint), never on a token.
  const dome=s.assets?.find(a=>HEX_DOME.test(a)||s.kind!=='template'&&a.startsWith('jb2a.energy_field.'));
  if(!dome){if(s.assets?.some(a=>a.startsWith('jb2a.shield_themed.'))&&(s.scale??1)>1.1)s.scale=1.1;continue;}
  const [,color,hex]=DOME_COLORS.find(([re])=>re.test(dome.split('.').slice(3).join('.')));
  s.assets=[`jb2a.markers.shield.${color}.03`,'jb2a.markers.shield.green.03'];
  s.scale=Math.min(s.scale??1,1);
  if(hex&&!s.tintEnabled)Object.assign(s,{tintEnabled:true,colorize:true,tint:hex});
 }
 return recipe;
}
export function findDndEntry(event){
 const item=event.item;if(!item)return null;
 for(const uuid of [event.itemUuid,item._stats?.compendiumSource,item.flags?.core?.sourceId,item.original?.uuid,item.uuid]){const entry=byUuid.get(uuid);if(entry)return entry;}
 const kind=item.type==='spell'?'spell':item.type==='feat'?'feat':item.type==='weapon'?'weapon':'item';
 const edition=item.system?.source?.rules==='2014'?'2014':item.system?.source?.rules==='2024'?'2024':null;
 const byName=name=>dndEntries(kind).filter(e=>normalize(e.name)===normalize(name)||item.system?.identifier&&e.identifier===item.system.identifier);
 let matches=byName(item.name);
 // Official books keep the wizard's name the SRD drops ("Evard's Black Tentacles",
 // "Bigby's Hand" → Black Tentacles, Arcane Hand).
 if(!matches.length&&kind==='spell')matches=byName(srdSpellName(item.name));
 return matches.find(e=>e.edition===edition)??matches.find(e=>e.edition==='2024')??matches[0]??null;
}
const BOOK_SPELL_NAMES={"bigby's hand":'Arcane Hand',"mordenkainen's sword":'Arcane Sword',"nystul's magic aura":"Arcanist's Magic Aura"};
export function srdSpellName(name){
 const lower=String(name??'').toLowerCase().replace(/[’]/g,"'");
 return BOOK_SPELL_NAMES[lower]??String(name??'').replace(/^[A-Z][\w-]*['’]s\s+/,'');
}
export function dndVariantForEvent(entry,event){
 const candidates=entry.variants.filter(v=>v.recipe.trigger===event.type&&(!v.weaponMode||v.weaponMode===event.weaponMode||!event.weaponMode));
 const exact=candidates.find(v=>v.activityId===event.activityId)??candidates.find(v=>event.activityName&&normalize(v.activityName)===normalize(event.activityName));
 if(exact)return exact;
 if(!event.activityId&&!event.activityName)return candidates.length===1?candidates[0]:null;
 // An official-book copy of an SRD item has its own activity ids and sometimes
 // names ("Consume" for an unnamed potion activity): match the same kind of activity.
 const type=event.activity?.type,same=type?candidates.filter(v=>v.activityType===type):[];
 return same.length===1?same[0]:same.find(v=>!v.activityName)??null;
}
const awaitingTargets=new Map();
// Creature-bound stages with nothing optional about them cannot play without a target.
const needsTargets=recipe=>recipe.trigger!=='template'&&recipe.stages.some(s=>(['travel','projectile','impact'].includes(s.kind)||s.subject==='targets')&&!s.optionalTargets&&s.travelDestination!=='area');
export function resolveDndAutomaticRecipe(event,stateFor,saved=[],{customEnabled=true,sounds}={}){
 const entry=findDndEntry(event),state=normalizeDndCatalogState(entry&&stateFor(entry.kind));
 const custom=customEnabled||entry&&dndEntryEnabled(entry.id,state)&&state.customized.includes(entry.id)?saved:[];
 const selected=entry&&dndEntryEnabled(entry.id,state),prefer=selected&&(state.selected.includes(entry.id)||state.preferCatalog&&!state.customized.includes(entry.id)&&!ownRecipe(custom,event));
 const override=matchStrikeOverride(custom,event);if(override)return override;
 if(!prefer){const match=matchRecipe(custom,event);if(match)return match;}
 if(!selected||['condition','effect'].includes(entry.kind))return null;
 if(!prefer&&custom.some(r=>!r.enabled&&matchRecipe([{...r,enabled:true}],event)))return null;
 let variant=dndVariantForEvent(entry,event);
 // A save spell plays when cast (Sacred Flame, Toll the Dead). Cast before anyone is
 // targeted, it waits for that item's damage roll, when the targets are known.
 const key=event.item?.uuid??event.item?.id;
 if(!variant&&event.type==='damage'&&key&&awaitingTargets.has(key)){variant=entry.variants.find(v=>v.id===awaitingTargets.get(key));awaitingTargets.delete(key);}
 else if(variant&&event.type==='use'&&key&&!event.targets?.length&&needsTargets(variant.recipe)){awaitingTargets.set(key,variant.id);event.skipReason='no target yet; plays on its damage roll';if(awaitingTargets.size>50)awaitingTargets.delete(awaitingTargets.keys().next().value);return null;}
 if(!variant)return null;
 const recipe=dndRecipe(entry,variant.id,{motion:state.motion,sounds:state.sound?sounds:null,soundVolume:state.soundVolume});
 // Native cast level supplies the dart count; separate attack-roll beams stay one.
 if(entry.slug==='magic-missile'){
  const count=Math.min(18,Math.max(3,2+(Number(event.spellLevel)||entry.level||1)));
  for(const stage of recipe.stages)if(stage.repeats===3&&stage.repeatScope==='total')stage.repeats=count;
 }
 if(entry.slug==='chain-lightning'){
  const secondary=Math.min(8,3+Math.max(0,(Number(event.spellLevel)||6)-6));
  for(const stage of recipe.stages){
   if(stage.targetSelection==='secondary')stage.targetLimit=secondary;
   if(stage.kind==='impact'||stage.kind==='sound'&&stage.subject==='targets')stage.targetLimit=secondary+1;
  }
 }
 return validateRecipe(recipe);
}
export function filterDndEntries(kind,{search='',edition='all',level='all',theme='all'}={}){
 const query=normalize(search);
 const score=e=>normalize(e.name)===query?3:normalize(e.name).startsWith(query)?2:normalize(e.name).includes(query)?1:0;
 return dndEntries(kind).filter(e=>(edition==='all'||e.edition==='both'||e.edition===edition)&&(level==='all'||e.level===Number(level))&&(theme==='all'||e.theme===theme)&&(!query||normalize(`${e.name} ${e.identifier??''} ${e.descriptionText??''} ${e.group??''}`).includes(query))).sort((a,b)=>query?score(b)-score(a):0);
}
