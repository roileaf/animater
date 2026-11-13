import {catalogData} from '../shared/catalog-data.mjs';

import {clone,normalize,originalName,validateRecipe,matchRecipe, ownRecipe,matchStrikeOverride} from '../../core/model.mjs';
import {addSpellSounds} from '../../engines/sound/spell-sounds.mjs';
import {addAbilitySounds} from '../../engines/sound/ability-sounds.mjs';
import {applyCatalogMotion,dndMotionReview,withoutCatalogMotion} from '../shared/catalog-motion.mjs';
import {withCatalogFx,withAuditedLooks} from '../shared/catalog-fx.mjs';
import {normalizeElement} from '../shared/element-choice.mjs';
import {MARKS} from '../../engines/marks/ground-marks.mjs';
import {resolveDndNpcAction,findDndNpcAction} from './dnd5e-npc-actions.mjs';
// Filled when the data loads (catalog-data.mjs): the SRD entries first, ahead of any book's.
const DND5E_ENTRIES=[],DND5E_SOURCE={};
export {DND5E_ENTRIES,DND5E_SOURCE};
export const DND_KINDS=['spell','feat','weapon','item','condition','effect'];
const byId=new Map();
const byUuid=new Map();
let loaded=false;
await catalogData('dnd5e','entries',async()=>{
 const data=await import('../../../data/dnd5e-catalog.mjs');
 const fresh=data.DND5E_ENTRIES.filter(e=>!byId.has(e.id));
 DND5E_ENTRIES.splice(0,0,...fresh);Object.assign(DND5E_SOURCE,data.DND5E_SOURCE);
 for(const e of fresh){byId.set(e.id,e);if(e.uuid)byUuid.set(e.uuid,e);}
 loaded=true;
});
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
 // Before the data loads, a saved choice keeps its id as it is (nothing is dropped as unknown).
 state??={};const ids=values=>[...new Set((Array.isArray(values)?values:[]).filter(id=>!loaded?typeof id==='string'&&id:byId.has(id)))];
 return {enabled:state.enabled===true,independent:state.independent===true,preferCatalog:state.preferCatalog===true,scope:state.scope==='selected'?'selected':'all',selected:ids(state.selected),excluded:ids(state.excluded),customized:ids(state.customized),motion:state.motion!==false,fade:state.fade===true,turn:state.turn===true,sound:state.sound!==false,soundVolume:Number.isFinite(Number(state.soundVolume))?Math.max(0,Math.min(1,Number(state.soundVolume))):.35,opacity:Number.isFinite(Number(state.opacity))?Math.max(.1,Math.min(1,Number(state.opacity))):1};
}
export const dndEntryEnabled=(id,state)=>state?.enabled===true&&!state.excluded?.includes(id)&&(state.scope!=='selected'||state.selected?.includes(id)||state.customized?.includes(id));
export function useDndEntry(state,id){
 if(!byId.has(id))throw Error('Choose a D&D catalog entry first.');
 state=normalizeDndCatalogState(state);
 return normalizeDndCatalogState({...state,enabled:true,independent:true,scope:state.enabled?state.scope:'selected',selected:state.enabled?[...state.selected,id]:[id],excluded:state.excluded.filter(v=>v!==id),customized:state.customized.filter(v=>v!==id)});
}
// Whether this is a breath being let out (pure): by its name, not the spell's cast on someone else.
export const breathes=(entry,variant)=>/\bbreath\b|\bexhale/i.test(`${entry?.name??''} ${variant?.activityName??''}`)&&!(entry?.kind==='spell'&&variant?.activityType==='utility');
export function dndRecipe(entry,variantId,{motion=true,sounds,soundVolume=.35,fx=true,fxCatalog}={}){
 if(!entry)throw Error('Choose a D&D catalog entry first.');
 const variant=entry.variants.find(v=>v.id===variantId)??entry.variants[0];
 let recipe=clone(variant.recipe);
 const markElement=flaskMark(entry,variant);
 if(markElement)recipe.markElement=markElement;
 // Its activity's kind and name, so a copy of this spell from another book plays it too (model.mjs sameActivity).
 if(recipe.activityId){recipe.activityType??=variant.activityType;recipe.activityName??=variant.activityName;}
 recipe.stages=applyCatalogMotion(entry,recipe.stages,dndMotionReview(entry,variant));
 if(!motion)recipe.stages=withoutCatalogMotion(recipe.stages);
 if(!['condition','effect'].includes(entry.kind)){
  const item={id:entry.id,slug:entry.slug,soundProfile:variant.soundProfile};
  const design={profile:variant.soundProfile,excludeRoles:variant.soundExcludeRoles};
  recipe.stages=variant.soundNamespace==='ability'?addAbilitySounds(item,recipe.stages,{sounds,soundVolume,mode:variant.weaponMode,design}):addSpellSounds(item,recipe.stages,{sounds,soundVolume,design});
  // Breath weapons draw breath first, whatever they exhale (the sound packs' own inhales).
  if(breathes(entry,variant)){const first=recipe.stages.find(s=>s.kind!=='sound');if(first?.stageId)recipe.stages=addAbilitySounds({...item,id:`${entry.id}-breath`},recipe.stages,{sounds,soundVolume,design:{profile:'breath-other',pinTo:{inhale:first.stageId}}});}
 }
 // The audited clips again after the hex dome gives way (its stand-in has a verdict of its own).
 return withAuditedLooks(validateRecipe(withoutHexDome(withCatalogFx(validateRecipe(recipe),entry,{fx,fxCatalog,variant,motion,sounds,soundVolume}))),entry,fx===false?{}:fxCatalog);
}
// The floor mark a thrown flask's contents leave (Alchemist's Fire, Acid): its theme, when the item is thrown as
// a flask or vial. Holy water and oil leave none (no mark for their themes).
const FLASK=/throwable\.throw\.(flask|vial)/;
function flaskMark(entry,variant){
 if(entry.kind!=='item'||!variant.recipe.stages.some(s=>['travel','projectile'].includes(s.kind)&&s.assets?.some(a=>FLASK.test(a))))return null;
 const element=normalizeElement(variant.theme??entry.theme);
 return element&&MARKS[element]?element:null;
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
// Older copies record their source without the document type ("Compendium.dnd5e.monsterfeatures.<id>").
const canonicalUuid=uuid=>typeof uuid==='string'?uuid.replace(/^(Compendium\.[^.]+\.[^.]+)\.([^.]+)$/,'$1.Item.$2'):uuid;
export function findDndEntry(event){
 const item=event.item;if(!item)return null;
 const kind=item.type==='spell'?'spell':item.type==='feat'?'feat':item.type==='weapon'?'weapon':'item';
 let legacy=null;
 for(const uuid of [event.itemUuid,item._stats?.compendiumSource,item.flags?.core?.sourceId,item.original?.uuid,item.uuid]){
  const entry=byUuid.get(uuid);if(entry)return entry;
  // A 2014 statblock's Hooves is a weapon attack copied from a utility feature: a legacy
  // source of another kind yields to a same-kind entry by name.
  const old=byUuid.get(canonicalUuid(uuid));if(old&&old.kind===kind)return old;legacy??=old;
 }
 const edition=item.system?.source?.rules==='2014'?'2014':item.system?.source?.rules==='2024'?'2024':null;
 // A translated copy still carries its English name (flags.babele.originalName).
 const name=originalName(item)??item.name,other=kind==='feat'?'weapon':kind==='weapon'?'feat':null;
 const byName=(n,k=kind)=>dndEntries(k).filter(e=>normalize(e.name)===normalize(n)||item.system?.identifier&&e.identifier===item.system.identifier);
 let matches=byName(name);
 // Official books keep the wizard's name the SRD drops ("Evard's Black Tentacles",
 // "Bigby's Hand" → Black Tentacles, Arcane Hand).
 if(!matches.length&&kind==='spell')matches=byName(srdSpellName(name));
 // Statblocks disagree on whether a natural attack is a feature or a weapon (2014 Bite and
 // Claw are features, the catalog's are weapons; Constrict and Stomp the other way round).
 if(!matches.length&&legacy)return legacy;
 if(!matches.length&&other)matches=byName(name,other);
 // Only its translated name left (typed by hand, a translated module's own copy).
 const inPack=k=>dndEntries(k).filter(e=>{const n=packName(e);return n&&normalize(n)===normalize(item.name);});
 if(!matches.length)matches=inPack(kind);
 if(!matches.length&&other)matches=inPack(other);
 return matches.find(e=>e.edition===edition)??matches.find(e=>e.edition==='2024')??matches[0]??null;
}
// What a non-English world's compendium calls an entry, where a translation renamed it: Babele renames the packs'
// indexes in place. Read live, since Babele finishes after Foundry's ready and can reload its translations.
// Embedded effects and condition pages have no index entry of their own, so they keep the catalog's name.
function packName(e){
 const game=globalThis.game,lang=game?.i18n?.lang;
 if(!lang||/^en\b/.test(lang)||!e.uuid||['condition','effect'].includes(e.kind))return null;
 const [,scope,pack,,id]=e.uuid.split('.'),name=game.packs?.get(`${scope}.${pack}`)?.index?.get(id)?.name;
 return name&&normalize(name)!==normalize(e.name)?name:null;
}
// The name to show. Other systems' catalogs share the UI that calls this and keep their own names. With "Original names in
// brackets" on, a translated entry reads "Тьма [Darkness]" (the way translated content is often written).
let bracketOriginal=()=>false;
export const setDndOriginalNames=f=>{bracketOriginal=typeof f==='function'?f:()=>!!f;};
export const dndDisplayName=e=>{
 const shown=byId.get(e.id)===e?packName(e):null;
 if(!shown)return e.name;
 let both=false;try{both=!!bracketOriginal();}catch{/* translated only */}
 return both?`${shown} [${e.name}]`:shown;
};
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
 const type=event.activity?.type;if(!type)return null;
 const same=candidates.filter(v=>v.activityType===type);
 // Several of that kind ("Attack", "Moving Attack"): the unnamed default, else the first.
 if(same.length)return same.length===1?same[0]:same.find(v=>!v.activityName)??same[0];
 // A statblock that uses another kind of activity (a 2014 Breath Weapon saves, the entry's is a
 // utility) plays the entry's one automatic design. Manual designs stay manual (a summon, Mage Hand's conjuring).
 const automatic=entry.variants.filter(v=>v.recipe.trigger!=='manual');
 if(!['use','template','damage'].includes(event.type)||entry.variants.some(v=>v.activityType===type))return null;
 return automatic.length===1&&candidates.includes(automatic[0])?automatic[0]:null;
}
const awaitingTargets=new Map();
// Creature-bound stages with nothing optional about them cannot play without a target.
// Whether a roll is still to come for this cast, when its targets will be known (pure). Without one (Dragon's Breath, touching a willing creature) waiting would mean never playing.
export const rollComesLater=(activity,variant)=>activity?activity.type==='attack'||activity.type==='heal'||activity.type==='damage'||(activity.damage?activity.damage.parts?.length>0:activity.type==='save'):['attack','damage','heal','save'].includes(variant?.activityType);
// A recipe as it plays with nobody targeted (pure): what falls on the recipient falls on the caster, what flies or strikes at a target is left out.
export function withoutTargets(recipe){
 const gone=new Set(),stages=[];
 for(const s of recipe.stages){
  if(['aura','sound'].includes(s.kind)&&s.subject==='targets'&&!s.optionalTargets){stages.push({...s,subject:'source'});continue;}
  if((['travel','projectile','impact'].includes(s.kind)||s.subject==='targets')&&!s.optionalTargets&&s.travelDestination!=='area'){gone.add(s.stageId);continue;}
  stages.push(s.kind==='motion'?{...s,optionalTargets:true}:s);
 }
 if(!stages.length)return recipe;
 return {...recipe,stages:stages.map(s=>gone.has(s.afterStage)?{...s,afterStage:''}:s)};
}
const needsTargets=recipe=>recipe.trigger!=='template'&&recipe.stages.some(s=>(['travel','projectile','impact'].includes(s.kind)||s.subject==='targets')&&!s.optionalTargets&&s.travelDestination!=='area');
export function resolveDndAutomaticRecipe(event,stateFor,saved=[],{customEnabled=true,sounds,npcEnabled=true,npcExcluded=[]}={}){
 const entry=findDndEntry(event),state=normalizeDndCatalogState(stateFor(entry?.kind??'feat'));
 const custom=customEnabled||entry&&dndEntryEnabled(entry.id,state)&&state.customized.includes(entry.id)?saved:[];
 const selected=entry&&dndEntryEnabled(entry.id,state),prefer=selected&&(state.selected.includes(entry.id)||state.preferCatalog&&!state.customized.includes(entry.id)&&!ownRecipe(custom,event));
 const override=matchStrikeOverride(custom,event);if(override)return override;
 if(!prefer){const match=matchRecipe(custom,event);if(match)return match;}
 const indexedNpc=findDndNpcAction(event);
 if(indexedNpc&&(npcEnabled===false||npcExcluded.includes(indexedNpc.id)||indexedNpc.delegated))return null;
 const npcFallback=()=>resolveDndNpcAction(event,custom,{npcEnabled,npcExcluded,motion:state.motion,sounds:state.sound?sounds:null,soundVolume:state.soundVolume});
 if(!entry){if(!state.enabled||state.scope==='selected')return null;return npcFallback();}
 if(!selected||['condition','effect'].includes(entry.kind))return null;
 if(!prefer&&custom.some(r=>!r.enabled&&matchRecipe([{...r,enabled:true}],event)))return null;
 let variant=dndVariantForEvent(entry,event);
 // A save spell plays when cast (Sacred Flame, Toll the Dead). Cast before anyone is
 // targeted, it waits for that item's damage roll, when the targets are known.
 const key=event.item?.uuid??event.item?.id;
 if(!variant&&event.type==='damage'&&key&&awaitingTargets.has(key)){variant=entry.variants.find(v=>v.id===awaitingTargets.get(key));awaitingTargets.delete(key);}
 else if(variant&&event.type==='use'&&key&&!event.targets?.length&&needsTargets(variant.recipe)&&rollComesLater(event.activity,variant)){awaitingTargets.set(key,variant.id);event.skipReason='no target yet; plays on its damage roll';if(awaitingTargets.size>50)awaitingTargets.delete(awaitingTargets.keys().next().value);return null;}
 if(!variant)return npcFallback();
 let recipe=dndRecipe(entry,variant.id,{motion:state.motion,sounds:state.sound?sounds:null,soundVolume:state.soundVolume});
 if(event.type==='use'&&!event.targets?.length&&needsTargets(recipe))recipe=withoutTargets(recipe);
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
 const scoreName=name=>normalize(name)===query?3:normalize(name).startsWith(query)?2:normalize(name).includes(query)?1:0;
 const score=e=>Math.max(scoreName(e.name),scoreName(packName(e)??e.name));
 return dndEntries(kind).filter(e=>(edition==='all'||e.edition==='both'||e.edition===edition)&&(level==='all'||e.level===Number(level))&&(theme==='all'||e.theme===theme)&&(!query||normalize(`${e.name} ${packName(e)??''} ${e.identifier??''} ${e.descriptionText??''} ${e.group??''}`).includes(query))).sort((a,b)=>query?score(b)-score(a):0);
}
