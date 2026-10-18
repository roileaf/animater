import { nextLastingChange, lastingMessage } from "../shared/lasting-choice.mjs";
import {normalizeStateCatalogState,useStateEntry,stateRecipe,catalogStateEntry} from './state-catalog.mjs';
export async function handleStateCatalogAction(w,action,b){
 if(!['select-state','state-auto','state-pause','state-exclude','state-page','state-reset','use-state','copy-state','enable-state-custom','state-motion','state-fade'].includes(action))return false;
 const kind=action==='enable-state-custom'?catalogStateEntry(w.recipe()?.stateEntry)?.kind:w.page==='conditions'?'condition':'effect';
 const id=action==='enable-state-custom'?w.recipe()?.stateEntry:action==='state-exclude'&&b.dataset.id?b.dataset.id:w.selectedState[kind],state=normalizeStateCatalogState(w.host.stateCatalogState?.(kind));
 if(action==='state-fade'){const change=nextLastingChange(state);await w.host.setStateCatalogState(kind,change);w.message=lastingMessage(change,kind==='condition'?'Conditions':'Effects');w.render();return true;}
  if(action==='state-motion'){await w.host.setStateCatalogState(kind,{motion:!state.motion});w.message=state.motion?'Token motion off: conditions and effects show their effects only.':'Token motion on: creatures react to their conditions.';w.render();return true;}
 if(action==='select-state'){if(w.selectedState[kind]===b.dataset.id)return true;w.selectedState[kind]=b.dataset.id;w.stageIndex=0;}
 else if(action==='state-page')w.statePages[kind]=Math.max(0,Number(b.dataset.index));
 else if(action==='state-reset'){w.stateFilters[kind]={search:'',group:'all',theme:'all',quality:'all'};w.statePages[kind]=0;}
 else if(action==='copy-state'){
  const recipe=w.recipe()??stateRecipe(catalogStateEntry(id),{catalog:w.host.catalog?.()}),saved=w.host.recipes().find(r=>r.lifecycle==='document'&&r.stateEntry===id&&r.stateDamageType===recipe.stateDamageType);
  if(!saved)await w.host.save([...w.host.recipes(),recipe]);
  // Customizing means using your version: the catalog turns on for this entry and plays your saved recipe.
  await w.host.setStateCatalogState(kind,{...useStateEntry(state,id),customized:[...new Set([...state.customized,id])]});
  w.selected=saved?.id??recipe.id;w.page='recipes';w.studio=true;w.studioTime=0;w.search='';w.category='All';w.stageIndex=0;
  w.message='Your version now plays instead of the catalog one. Edit and save to change it.';
 }else{
  const env=w.host.environment();if(env.demo||env.systemId!=='pf2e'||!env.ready)throw Error('Enable persistent animations inside a PF2e world with Sequencer and JB2A.');
  let change=action==='state-auto'?{enabled:!(state.enabled&&state.scope==='all'),scope:'all'}:action==='state-pause'?{enabled:false}:action==='state-exclude'?{excluded:state.excluded.includes(id)?state.excluded.filter(v=>v!==id):[...state.excluded,id]}:useStateEntry(state,id);
  if(action==='enable-state-custom'){
   if(w.dirty?.has(w.recipe()?.id))throw Error('Save your customization before enabling it.');
   change={...change,customized:[...new Set([...state.customized,id])]};
  }
  await w.host.setStateCatalogState(kind,change);w.message=change.enabled===false?'Catalog paused. Its attached visuals will end.':'Saved. Tokens that already have these conditions or effects update now.';
 }
 w.render();return true;
}
