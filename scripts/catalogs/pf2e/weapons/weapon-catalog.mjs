import {PF2E_WEAPONS as EQUIPMENT,PF2E_WEAPON_SOURCE} from '../../../../data/pf2e-weapons.mjs';
import {weaponRecipe} from './weapon-choreography.mjs';
import {normalize,matchRecipe,matchStrikeOverride} from '../../../core/model.mjs';
import {withRuneFlourishes,runeFlourishesEnabled} from './weapon-runes.mjs';
import {NATURAL_WEAPONS,naturalWeaponFor,naturalVariant} from '../natural-weapons.mjs';
// Equipment weapons, then creature attacks (Jaws, Claw) the equipment has no entry for.
const PF2E_WEAPONS=[...EQUIPMENT,...NATURAL_WEAPONS];
export {PF2E_WEAPONS,PF2E_WEAPON_SOURCE,weaponRecipe};
const byId=new Map(PF2E_WEAPONS.map(w=>[w.id,w])),byName=new Map(),byBase=new Map();
for(const w of [...EQUIPMENT].sort((a,b)=>Number(a.edition==='legacy')-Number(b.edition==='legacy')||a.level-b.level)){
 for(const n of [w.name,w.slug])if(!byName.has(normalize(n)))byName.set(normalize(n),w);
 if(w.base&&normalize(w.base)===normalize(w.slug)&&!byBase.has(w.base))byBase.set(w.base,w);
}
export const catalogWeapon=id=>byId.get(String(id).replace(/^pf2e-weapon-/,'').replace(/-(melee|ranged|thrown)$/,''))??null;
export const weaponCustomizationKey=(id,mode)=>`${id}:${mode}`;
export function normalizeWeaponCatalogState(state={}){
 state??={};const ids=list=>[...new Set((Array.isArray(list)?list:[]).map(id=>catalogWeapon(id)?.id).filter(Boolean))];
 return {enabled:state.enabled===true,independent:state.independent===true,scope:state.scope==='selected'?'selected':'all',selected:ids(state.selected),excluded:ids(state.excluded),customized:[...new Set((Array.isArray(state.customized)?state.customized:[]).map(String).filter(k=>{const[id,mode,...extra]=k.split(':');return !extra.length&&byId.get(id)?.modes.some(m=>m.mode===mode);}))],preferCatalog:state.preferCatalog===true,motion:state.motion!==false,sound:state.sound!==false,surfaceSound:state.surfaceSound!==false,soundVolume:Number.isFinite(Number(state.soundVolume))?Math.max(0,Math.min(1,Number(state.soundVolume))):.35};
}
export const catalogWeaponEnabled=(id,state)=>state?.enabled===true&&!state.excluded?.includes(id)&&(state.scope!=='selected'||state.selected?.includes(id)===true);
export function useCatalogWeapon(state,id){state=normalizeWeaponCatalogState(state);id=catalogWeapon(id)?.id;if(!id)throw Error('Choose a weapon first.');return normalizeWeaponCatalogState({...state,enabled:true,independent:true,scope:state.enabled?state.scope:'selected',selected:state.enabled?[...state.selected,id]:[id],excluded:state.excluded.filter(k=>k!==id),customized:state.customized.filter(k=>!k.startsWith(id+':'))});}
function catalogForItem(item,itemUuid){
 for(const uuid of [item.uuid,item.original?.uuid,item._stats?.compendiumSource,item.flags?.core?.sourceId,itemUuid])if(uuid?.startsWith('Compendium.pf2e.equipment-srd.')){const w=byId.get(uuid.split('.').at(-1));if(w)return w;}
 return byName.get(normalize(item.system?.slug??item.slug))??byName.get(normalize(item.name))??byBase.get(item.system?.baseItem)??null;
}
export function findCatalogWeapon(event){
 const item=event?.item;
 // An NPC Strike is a melee item: it plays the weapon it was made from, else the catalog weapon of its name.
 if(item?.type==='melee'){const linked=item.linkedWeapon;return (linked?.type==='weapon'&&catalogForItem(linked))||catalogForItem(item)||naturalWeaponFor(item);}
 if(item?.type!=='weapon')return null;
 const direct=catalogForItem(item,event.itemUuid);if(direct)return direct;
 if((item.category??item.system?.category)!=='unarmed')return null;
 const natural=naturalWeaponFor(item);if(natural)return natural;
 // Match PF2e prepareAttacks: only its first worn, invested, tagged pair
 // supplies the synthetic unarmed attacks. Never infer wraps from a roll name.
 const actor=item.actor??event.actor;
 const wraps=actor?.itemTypes?.weapon?.find(w=>(w.category??w.system?.category)==='unarmed'&&w.system?.traits?.otherTags?.includes('handwraps-of-mighty-blows')&&w.isEquipped===true&&w.isInvested===true);
 const catalog=wraps&&catalogForItem(wraps);
 return catalog?.strikeBinding==='unarmed'?catalog:null;
}
// A weapon the catalog does not know by name (the basic Fist, homebrew, a renamed blade) plays its
// group's standard weapon: a homebrew sword swings like a longsword, a fist strikes like a gauntlet.
const GROUP_STANDARD={club:'club',sword:'longsword',knife:'dagger',flail:'flail',spear:'spear',polearm:'halberd',axe:'battle-axe',bow:'longbow',brawling:'gauntlet',hammer:'warhammer',dart:'dart',crossbow:'crossbow',sling:'sling',pick:'pick',shield:'shield-boss',firearm:'flintlock-musket',bomb:'alchemists-fire-lesser'};
export function standardWeapon(item,mode){
 const group=item?.system?.group??item?.group??((item?.category??item?.system?.category)==='unarmed'?'brawling':null);
 if(!group)return null;
 const fits=w=>w&&(!mode||w.modes.some(m=>m.mode===mode)),standard=byName.get(normalize(GROUP_STANDARD[group]));
 return fits(standard)?standard:PF2E_WEAPONS.find(w=>w.group===group&&w.edition!=='legacy'&&fits(w))??(standard?.group===group?standard:null);
}
// An NPC Strike has no weapon group: its linked weapon's group, or a Fist's, else no guess (Jaws, Claw).
function npcStandardWeapon(item,mode){
 if(item?.type!=='melee')return null;
 if(item.linkedWeapon?.type==='weapon')return standardWeapon(item.linkedWeapon,mode);
 return [item.system?.slug,item.name].some(n=>normalize(n)==='fist')?standardWeapon({system:{group:'brawling'}},mode):null;
}
// PF2e calls some throws "ranged"; the catalog keeps them as thrown (and the reverse).
const modeOf=(weapon,mode)=>!weapon||weapon.modes.some(m=>m.mode===mode)?mode:mode==='ranged'&&weapon.modes.some(m=>m.mode==='thrown')?'thrown':mode==='thrown'&&weapon.modes.some(m=>m.mode==='ranged')?'ranged':mode;
export function resolveAutomaticWeaponRecipe(event,state,custom=[],{customEnabled=true,soundCatalog,runes=runeFlourishesEnabled()}={}){
 const known=findCatalogWeapon(event),fallback=known?null:event?.item?.type==='weapon'?standardWeapon(event.item,event.weaponMode):npcStandardWeapon(event?.item,event?.weaponMode);
 const weapon=known?.natural?naturalVariant(known,event.item):known??fallback,mode=modeOf(weapon,event.weaponMode??weapon?.modes[0]?.mode),key=weaponCustomizationKey(weapon?.id,mode);
 // A fallback plays under the attacker's own weapon name, with an id of its own.
 const named=r=>r&&fallback?{...r,id:`pf2e-weapon-group-${fallback.group}-${mode}`,name:`${event.item.name} · ${mode}`}:r;
 // Catalog Strikes wear the attacking weapon's runes; saved recipes play as authored.
 const catalog=r=>withRuneFlourishes(named(r),event.item,{runes});
 const active=weapon&&event.type==='attack'&&catalogWeaponEnabled(weapon.id,state)&&weapon.modes.some(m=>m.mode===mode);
 const bound={...event,weaponMode:mode,...(weapon?.strikeBinding==='unarmed'?{itemUuid:`Compendium.pf2e.equipment-srd.Item.${weapon.id}`}:{})};
 const configured=customEnabled||active&&state.customized?.includes(key)?custom:[];
 const override=matchStrikeOverride(configured,bound);if(override)return override;
 if(active&&(state.selected?.includes(weapon.id)||state.preferCatalog)&&!state.customized?.includes(key))return catalog(weaponRecipe(weapon,mode,{motion:state.motion,soundCatalog:state.sound===false?null:soundCatalog,soundVolume:state.soundVolume,surfaceSound:state.surfaceSound}));
 const saved=matchRecipe(configured,bound);if(saved)return saved;
 if(!active||configured.some(r=>!r.enabled&&matchRecipe([{...r,enabled:true}],bound)))return null;
 return catalog(weaponRecipe(weapon,mode,{motion:state.motion,soundCatalog:state.sound===false?null:soundCatalog,soundVolume:state.soundVolume,surfaceSound:state.surfaceSound}));
}
export function filterWeapons({search='',group='all',mode='all',category='all',edition='all'}={}){const q=normalize(search);return PF2E_WEAPONS.filter(w=>(group==='all'||w.group===group)&&(mode==='all'||w.modes.some(m=>m.mode===mode))&&(category==='all'||w.category===category)&&(edition==='all'||w.edition===edition)&&(!q||normalize(`${w.name} ${w.slug} ${w.traits.join(' ')} ${w.publication} ${w.plainDescription}`).includes(q)));}
