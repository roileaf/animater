import {dndEntries,dndRecipe,dndEntryEnabled,normalizeDndCatalogState} from './dnd5e-catalog.mjs';
import {matchRecipe} from '../../core/model.mjs';
const byCondition=new Map(dndEntries('condition').map(e=>[e.statusId,e]));
const effects=dndEntries('effect');
export function findDndState(state){
 if(state.type==='condition')return byCondition.get(state.statusId)??null;
 const effect=state.document??state,ids=[effect.uuid,effect._stats?.compendiumSource,effect.flags?.core?.sourceId];
 let found=effects.find(e=>ids.includes(e.uuid));if(found)return found;
 const parent=effect.parent?.documentName==='Item'?effect.parent:effect.actor?.items?.get?.(String(effect.origin??'').split('.Item.')[1]?.split('.')[0]);
 const source=parent?._stats?.compendiumSource??parent?.flags?.core?.sourceId;
 if(source){found=effects.find(e=>e.parentUuid===source&&(e.documentId===effect._id||e.name===effect.name));if(found)return found;}
 const named=effects.filter(e=>e.name===effect.name);return named.length===1?named[0]:null;
}
export function dndActorStates(actor){
 const applicable=actor?.appliedEffects??(actor?.allApplicableEffects?Array.from(actor.allApplicableEffects()).filter(e=>e.active):[]);
 const states=[],seen=new Set();
 for(const effect of applicable){
  if(effect.active===false||effect.disabled||effect.isSuppressed||effect.target?.documentName==='Item')continue;
  const statuses=Array.from(effect.statuses??[]).filter(id=>byCondition.has(id));
  for(const statusId of statuses){seen.add(statusId);states.push({type:'condition',statusId,name:byCondition.get(statusId).name,uuid:effect.uuid,document:effect,actor});}
  if(!statuses.length)states.push({type:'effect',name:effect.name,uuid:effect.uuid,document:effect,actor});
 }
 for(const statusId of actor?.statuses??[])if(byCondition.has(statusId)&&!seen.has(statusId))states.push({type:'condition',statusId,name:byCondition.get(statusId).name,uuid:actor.uuid,actor});
 return states;
}
export const dndActiveState=state=>!state.document||(state.document.active!==false&&!state.document.disabled&&!state.document.isSuppressed);
export function dndStateVisible(state,token,{isGM=false}={}){
 if(!token||token.destroyed||token.visible===false||!isGM&&token.document?.hidden)return false;
 if(isGM)return true;
 if(['invisible','hiding','hidden'].includes(state.statusId)&&!token.isOwner&&!token.actor?.isOwner)return false;
 const parent=state.document?.parent;
 return parent?.documentName!=='Item'||parent.system?.identified!==false;
}
export function resolveDndStateRecipe(state,options,saved=[],_catalog,{customEnabled=true}={}){
 const entry=findDndState(state),config=normalizeDndCatalogState(options);
 const own=saved.filter(r=>r.lifecycle==='document'&&r.systemId==='dnd5e');
 const custom=(entry?own.find(r=>r.stateEntry===entry.id):null)??matchRecipe(own,{type:'effect',systemId:'dnd5e',item:state.document??state});
 // Your own recipe plays whenever it is enabled and custom recipes play, catalog on or off,
 // unless you explicitly picked the catalog's version of this entry.
 const handmade=Boolean(custom?.enabled&&customEnabled&&!(entry&&config.enabled&&config.selected.includes(entry.id)&&!config.customized.includes(entry.id)));
 if(!handmade&&(entry&&!dndEntryEnabled(entry.id,config)||!entry&&!config.enabled))return null;
 if(!handmade&&entry&&config.selected.includes(entry.id)&&!config.customized.includes(entry.id))return dndRecipe(entry);
 if(custom&&!custom.enabled)return null;
 return custom??(entry?dndRecipe(entry):null);
}
export const dndStateHost={actorStates:dndActorStates,activeState:dndActiveState,stateVisible:dndStateVisible,normalizeState:normalizeDndCatalogState,resolveStateRecipe:resolveDndStateRecipe,documentKey:s=>s.type==='condition'?`condition:${s.statusId}`:`effect:${s.uuid}`,storedDocument:s=>s.document?.uuid??s.actor?.uuid??null};
