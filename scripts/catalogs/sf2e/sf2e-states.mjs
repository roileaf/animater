import {sfEntries,sfEntry,sfRecipe,findSfEntry,normalizeSfCatalogState,sfEntryEnabled} from './sf2e-catalog.mjs';
import {actorStates,activeState,stateVisible} from '../../engines/playback/persistent-states.mjs';
import {matchRecipe,validateRecipe} from '../../core/model.mjs';
const stateView=entry=>entry?.state?{...entry.state,id:entry.id,private:entry.private}:null;
export const findSfState=item=>{const entry=findSfEntry({systemId:'sf2e',item});return entry?.state?entry:null;};
const auraLookup=uuid=>{
 const entries=sfEntries('effect').filter(e=>e.uuid===uuid||uuid===`Compendium.sf2e.${e.pack}.Item.${e.name}`);
 return entries.length===1?stateView(entries[0]):null;
};
const profile={findStateEntry:item=>stateView(findSfState(item)),auraStateEntry:auraLookup,effects:sfEntries('effect').map(stateView)};
export const sfActorStates=actor=>actorStates(actor,profile);
export const sfStateVisible=(item,token,visibility)=>stateVisible(item,token,visibility,findSfState);
export function resolveSfStateRecipe(item,options,saved=[],catalog,{customEnabled=true}={}){
 const entry=findSfState(item),state=normalizeSfCatalogState(options);
 const damageType=item.system?.persistent?.damageType;
 const own=saved.filter(r=>r.lifecycle==='document'&&r.systemId==='sf2e'&&(!r.stateDamageType||r.stateDamageType===damageType)).sort((a,b)=>Number(Boolean(b.stateDamageType))-Number(Boolean(a.stateDamageType)));
 const custom=(entry?own.find(r=>r.stateEntry===entry.id):null)??matchRecipe(own,{type:'effect',systemId:'sf2e',item});
 // Your own recipe plays whenever it is enabled and custom recipes play, catalog on or off,
 // unless you explicitly picked the catalog's version of this entry.
 const handmade=Boolean(custom?.enabled&&customEnabled&&!(entry&&state.enabled&&state.selected.includes(entry.id)&&!state.customized.includes(entry.id)));
 if(!handmade&&(entry&&!sfEntryEnabled(entry.id,state)||!entry&&!state.enabled))return null;
 const built=()=>sfRecipe(entry,damageType,{damageType,catalog,aura:item.animaterAura??null});
 if(!handmade&&entry&&state.selected.includes(entry.id)&&!state.customized.includes(entry.id))return built();
 if(custom&&!custom.enabled)return null;
 if(custom)return validateRecipe({...custom,stages:custom.stages.map(s=>item.animaterAura?{...s,auraRadius:item.animaterAura.radius,auraSlug:item.animaterAura.slug}:s)});
 return entry?built():null;
}
export const sfStateHost={actorStates:sfActorStates,activeState,stateVisible:sfStateVisible,normalizeState:normalizeSfCatalogState,resolveStateRecipe:resolveSfStateRecipe,stateKind:item=>findSfState(item)?.kind??item.type};
