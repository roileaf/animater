import {SF2E_ENTRIES,SF2E_SOURCE} from '../../../data/sf2e-catalog.mjs';
import {withoutBespoke} from '../shared/bespoke.mjs';
import {clone,normalize,validateRecipe,matchRecipe, ownRecipe,matchStrikeOverride} from '../../core/model.mjs';
import {spellRecipe} from '../pf2e/spells/spell-choreography.mjs';
import {stateRecipe} from '../pf2e/state-catalog.mjs';
import {addSpellSounds} from '../../engines/sound/spell-sounds.mjs';
import {addAbilitySounds} from '../../engines/sound/ability-sounds.mjs';
import {withoutCatalogMotion} from '../shared/catalog-motion.mjs';
import {withCatalogFx} from '../shared/catalog-fx.mjs';
import {applySfMotionPatch} from './sf2e-motion.mjs';
import {withRuneFlourishes,runeFlourishesEnabled} from '../pf2e/weapons/weapon-runes.mjs';
import {normalizeElement} from '../shared/element-choice.mjs';
import {MARKS} from '../../engines/marks/ground-marks.mjs';
export {SF2E_ENTRIES,SF2E_SOURCE};
export const SF_KINDS=['spell','feat','action','feature','weapon','condition','effect'];
const byId=new Map(SF2E_ENTRIES.map(e=>[e.id,e]));
const byUuid=new Map(SF2E_ENTRIES.map(e=>[e.uuid,e]));
const byRecipe=new Map(SF2E_ENTRIES.flatMap(e=>e.variants.map(v=>[v.recipe.id,e])));
export const sfEntries=kind=>kind?SF2E_ENTRIES.filter(e=>e.kind===kind):SF2E_ENTRIES;
export const sfEntry=id=>byId.get(id)??byRecipe.get(id)??null;
export function normalizeSfCatalogState(state={}){
 state??={};const ids=values=>[...new Set((Array.isArray(values)?values:[]).filter(id=>byId.has(id)))];
 const number=(v,fallback,min,max)=>Number.isFinite(Number(v))?Math.max(min,Math.min(max,Number(v))):fallback;
 return {enabled:state.enabled===true,independent:state.independent===true,preferCatalog:state.preferCatalog===true,scope:state.scope==='selected'?'selected':'all',selected:ids(state.selected),excluded:ids(state.excluded),customized:ids(state.customized),motion:state.motion!==false,fade:state.fade===true,turn:state.turn===true,sound:state.sound!==false,soundVolume:number(state.soundVolume,.35,0,1),opacity:number(state.opacity,1,.1,1)};
}
export const sfEntryEnabled=(id,state)=>state?.enabled===true&&!state.excluded?.includes(id)&&(state.scope!=='selected'||state.selected?.includes(id)||state.customized?.includes(id));
export function useSfEntry(state,id){
 if(!byId.has(id))throw Error('Choose an SF2e catalog entry.');state=normalizeSfCatalogState(state);
 return normalizeSfCatalogState({...state,enabled:true,independent:true,scope:state.enabled?state.scope:'selected',selected:state.enabled?[...state.selected,id]:[id],excluded:state.excluded.filter(v=>v!==id),customized:state.customized.filter(v=>v!==id)});
}
export function sfRecipe(entry,variantId,{motion=true,sounds,soundVolume=.35,castRank,damageType,aura,catalog,fx=true,fxCatalog}={}){
 if(!entry)throw Error('Choose an SF2e catalog entry.');
 const variant=entry.variants.find(v=>v.id===variantId)??entry.variants[0];
 let recipe=withoutBespoke(()=>entry.kind==='spell'?spellRecipe(entry.spell,undefined,{motion,castRank,sounds:null,fx:false}):entry.state?stateRecipe(entry.state,{damageType:damageType??variant.damageType,aura,catalog,fx:false}):clone(variant.recipe));
 const markElement=grenadeMark(entry);
 recipe={...recipe,id:variant.recipe.id,name:entry.name,description:'',itemUuid:entry.uuid,systemId:'sf2e',catalogEntry:entry.id,...(entry.state?{stateEntry:entry.id,lifecycle:'document'}:{}),...(markElement?{markElement}:{})};
 // Reviewed SF2e motion corrections for spells rebuilt from the shared choreography.
 if(motion&&entry.spell?.motionPatch)recipe.stages=applySfMotionPatch(entry.spell,recipe.stages,entry.spell.motionPatch);
 if(!motion)recipe.stages=withoutCatalogMotion(recipe.stages);
 if(!entry.state){
  const item={id:entry.documentId,slug:entry.slug,soundProfile:variant.soundProfile},design={profile:variant.soundProfile};
  recipe.stages=variant.soundNamespace==='ability'?addAbilitySounds(item,recipe.stages,{sounds,soundVolume,mode:variant.weaponMode,design}):addSpellSounds(item,recipe.stages,{sounds,soundVolume,design});
 }
 return withCatalogFx(validateRecipe(recipe),{...entry,...entry.spell,...entry.state},{fx,fxCatalog,motion,sounds,soundVolume,variant,damageType:damageType??variant.damageType});
}
// The floor mark a grenade's payload leaves: its theme, when its traits name that element (a foam or stench
// grenade's theme is only its look). Other SF2e weapons leave none, as PF2e Strikes do.
function grenadeMark(entry){
 if(entry.kind!=='weapon'||entry.group!=='grenade')return null;
 const element=normalizeElement(entry.theme);
 return element&&MARKS[element]&&entry.traits?.includes(element)?element:null;
}
export function findSfEntry(event){
 if(event.systemId&&event.systemId!=='sf2e')return null;
 const item=event.item;if(!item)return null;
 if(item.animaterAura?.entryId)return sfEntry(item.animaterAura.entryId);
 for(const uuid of [event.itemUuid,item.sourceId,item._stats?.compendiumSource,item.flags?.core?.sourceId,item.original?.uuid,item.uuid]){const entry=byUuid.get(uuid);if(entry)return entry;}
 const kind=item.type==='spell'?'spell':item.type==='action'?'action':item.type==='feat'?(['classfeature','ancestryfeature'].includes(item.system?.category)?'feature':'feat'):item.type==='weapon'?'weapon':item.type==='condition'?'condition':item.type==='effect'?null:undefined;
 if(kind===undefined)return null;
 const slug=normalize(item.slug??item.system?.slug),name=normalize(item.name);
 const candidates=sfEntries(kind).filter(e=>(kind||e.state)&&(slug&&normalize(e.slug)===slug||normalize(e.name)===name));
 return candidates.length===1?candidates[0]:null;
}
export function sfVariantForEvent(entry,event){
 const candidates=entry.variants.filter(v=>v.recipe.trigger===event.type&&(!v.weaponMode||v.weaponMode===event.weaponMode||event.type==='template'||!event.weaponMode));
 return candidates.length===1?candidates[0]:null;
}
export function resolveSfAutomaticRecipe(event,stateFor,saved=[],{customEnabled=true,sounds,runes=runeFlourishesEnabled()}={}){
 if(event.systemId&&event.systemId!=='sf2e')return null;
 const entry=findSfEntry(event),state=normalizeSfCatalogState(entry&&stateFor(entry.kind));
 const custom=customEnabled||entry&&sfEntryEnabled(entry.id,state)&&state.customized.includes(entry.id)?saved:[];
 // An action rolled as a skill check has a stand-in item with no uuid: a copy bound to the entry's uuid still matches.
 if(entry?.uuid&&!event.itemUuid)event={...event,itemUuid:entry.uuid};
 const selected=entry&&sfEntryEnabled(entry.id,state),prefer=selected&&(state.selected.includes(entry.id)||state.preferCatalog&&!state.customized.includes(entry.id)&&!ownRecipe(custom,event));
 const override=matchStrikeOverride(custom,event);if(override)return override;
 if(!prefer){const recipe=matchRecipe(custom,event);if(recipe)return recipe;}
 if(!selected||entry.state)return null;
 if(!prefer&&custom.some(r=>!r.enabled&&matchRecipe([{...r,enabled:true}],event)))return null;
 const variant=sfVariantForEvent(entry,event),recipe=variant?sfRecipe(entry,variant.id,{motion:state.motion,sounds:state.sound?sounds:null,soundVolume:state.soundVolume,castRank:event.castRank}):null;
 // Catalog Strikes wear the attacking weapon's runes; saved recipes play as authored.
 return recipe&&entry.kind==='weapon'?withRuneFlourishes(recipe,event.item,{runes}):recipe;
}
export function filterSfEntries(kind,{search='',level='all',theme='all'}={}){
 const query=normalize(search),score=e=>normalize(e.name)===query?3:normalize(e.name).startsWith(query)?2:normalize(e.name).includes(query)?1:0;
 return sfEntries(kind).filter(e=>(level==='all'||e.level===Number(level))&&(theme==='all'||e.theme===theme)&&(!query||normalize(`${e.name} ${e.slug} ${e.descriptionText} ${e.group}`).includes(query))).sort((a,b)=>query?score(b)-score(a):0);
}
export const sfCatalogProfile={systemId:'sf2e',label:'SF2e',source:SF2E_SOURCE,entries:sfEntries,entry:sfEntry,recipe:sfRecipe,filter:filterSfEntries,normalize:normalizeSfCatalogState,enabled:sfEntryEnabled,use:useSfEntry,stateKey:'sfCatalogState',setStateKey:'setSfCatalogState'};
