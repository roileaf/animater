import {catalogDataNeeded} from '../shared/catalog-data.mjs';
import {matchRecipe} from '../../core/model.mjs';
import {buildNpcActionRecipe} from '../shared/npc-system-actions.mjs';
import {sfEntry,sfRecipe,resolveSfAutomaticRecipe} from './sf2e-catalog.mjs';
const {SF_NPC_ACTIONS,SF_NPC_ACTION_SOURCE}=catalogDataNeeded('sf2e')?await import('../../../data/sf2e-npc-actions.mjs'):{SF_NPC_ACTIONS:[],SF_NPC_ACTION_SOURCE:{}};
export {SF_NPC_ACTIONS,SF_NPC_ACTION_SOURCE};
const byId=new Map(SF_NPC_ACTIONS.map(a=>[a.id,a]));
const bySource=new Map(SF_NPC_ACTIONS.flatMap(a=>a.sources.map(s=>[s,a])));
const byName=new Map();for(const action of SF_NPC_ACTIONS){const key=action.name.toLowerCase();byName.set(key,[...(byName.get(key)??[]),action]);}

// Shared NPC choreography includes Patreon colors. Measured Free equivalents
// preserve the same footage family/shape and recolor it, rather than introducing
// an unrelated impact or dropping a stage when the Free database is installed.
const FREE_CHOICES=new Map([
 ['jb2a.impact.005.purple',['jb2a.impact.005.orange','#ae86dc']],
 ['jb2a.impact.003.pinkpurple',['jb2a.impact.003.blue','#ae86dc']],
 ['jb2a.liquid.splash.bright_green',['jb2a.liquid.splash.blue','#87bd67']],
 ['jb2a.impact.003.green',['jb2a.impact.003.blue','#87bd67']],
 ['jb2a.shimmer.01.purple',['jb2a.shimmer.01.blue','#ae86dc']],
 ['jb2a.soundwave.02.purple',['jb2a.soundwave.02.blue','#ae86dc']],
 ['jb2a.soundwave.01.purple',['jb2a.soundwave.01.blue','#ae86dc']],
 ['jb2a.impact.004.dark_purple',['jb2a.impact.004.blue','#7f6096']],
 ['jb2a.impact.003.dark_purple',['jb2a.impact.003.blue','#7f6096']],
 ['jb2a.smoke.puff.centered.dark_purple',['jb2a.smoke.puff.centered.grey','#8e72a8']],
 ['jb2a.impact.009.purple',['jb2a.impact.009.orange','#ae86dc']],
 ['jb2a.energy_strands.complete.dark_red.01',['jb2a.energy_strands.complete.blue.01','#a24343']],
 ['jb2a.toll_the_dead.grey.skull_smoke',['jb2a.toll_the_dead.green.skull_smoke','#a29aa9']],
 ['jb2a.impact_themed.poison.greenyellow',['jb2a.impact.003.blue','#a1bf67']],
 ['jb2a.liquid.blob.green',['jb2a.liquid.blob.blue','#87bd67']],
 ['jb2a.liquid.splash.green',['jb2a.liquid.splash.blue','#87bd67']],
 ['jb2a.explosion.04.dark_purple',['jb2a.explosion.04.blue','#ae86dc']],
 ['jb2a.explosion.01.purple',['jb2a.explosion.01.orange','#ae86dc']],
 ['jb2a.fumes.toxic.green',['jb2a.smoke.puff.centered.grey','#87bd67']],
 ['jb2a.smoke.puff.centered.dark_green',['jb2a.smoke.puff.centered.grey','#87bd67']],
 ['jb2a.particle_burst.01.rune.bluepurple',['jb2a.impact.003.blue','#ae86dc']],
 ['jb2a.impact.005.white',['jb2a.impact.005.orange','#e3e3e3']],
 ['jb2a.impact.003.yellow',['jb2a.impact.003.blue','#e3d68e']],
]);
function freeCompatible(recipe){
 if(!recipe)return recipe;
 return {...recipe,stages:recipe.stages.map(stage=>{
  const choices=(stage.assets??[]).map(key=>FREE_CHOICES.get(key)).filter(Boolean);
  if(!choices.length)return stage;
  return {...stage,assets:[...new Set([...stage.assets,...choices.map(([key])=>key)])],...(stage.tintEnabled?{}:{tintEnabled:true,tint:choices[0][1]})};
 })};
}

export function findSfNpcAction(event){
 const item=event?.item,actor=event?.actor??item?.actor;
 if(event?.systemId&&event.systemId!=='sf2e'||item?.type!=='action'||actor?.type!=='npc')return null;
 const sources=[event.itemUuid,item.sourceId,item._stats?.compendiumSource,item.flags?.core?.sourceId,item.original?.uuid,item.uuid];
 for(const source of sources)if(bySource.has(source))return bySource.get(source);
 const actorSource=actor.sourceId??actor._stats?.compendiumSource??actor.flags?.core?.sourceId;
 const embedded=actorSource&&`${actorSource}.Item.${item.id??item._id}`;if(bySource.has(embedded))return bySource.get(embedded);
 if(sources.concat(actorSource).some(source=>/^Compendium\.(?!sf2e\.)/.test(source??'')))return null;
 const traits=[...(item.system?.traits?.value??[])].sort().join('|');
 const matches=(byName.get(String(item.name??'').toLowerCase())??[]).filter(a=>a.creatures.includes(actor.name)&&a.traits.join('|')===traits&&a.actionType===item.system?.actionType?.value&&a.actions===item.system?.actions?.value);
 return matches.length===1?matches[0]:null;
}
export function sfNpcActionPreview(id,options={}){
 const action=typeof id==='object'?id:byId.get(id);if(!action)return null;
 return action.native?sfRecipe(sfEntry(action.native.entryId),action.native.variantId,options):freeCompatible(buildNpcActionRecipe(action,{...options,systemId:'sf2e'}));
}
export function resolveSfNpcAction(event,saved=[],options={}){
 const action=findSfNpcAction(event);if(!action)return null;
 const own=options.customEnabled===false?[]:saved;
 const custom=matchRecipe(own,event);if(custom)return custom;
 if(own.some(r=>r.enabled===false&&matchRecipe([{...r,enabled:true}],event)))return null;
 if(options.enabled===false||(options.excluded??[]).includes(action.id)||action.form.trigger!==event.type)return null;
 if(action.native){
  // The ordinary native catalog remains authoritative for its scope, selection,
  // exclusions and custom recipes. Never turn an excluded native entry into a fallback.
  return resolveSfAutomaticRecipe(event,options.stateFor??(()=>({enabled:false})),saved,options);
 }
 return sfNpcActionPreview(action,options);
}
