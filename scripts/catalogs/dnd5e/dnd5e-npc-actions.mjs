import {catalogDataNeeded} from '../shared/catalog-data.mjs';
const {DND_NPC_ACTIONS,DND_NPC_ACTION_SOURCE}=catalogDataNeeded('dnd5e')?await import('../../../data/dnd5e-npc-actions.mjs'):{DND_NPC_ACTIONS:[],DND_NPC_ACTION_SOURCE:{}};
import {buildNpcActionRecipe} from '../shared/npc-system-actions.mjs';
import {dndEntry,dndRecipe} from './dnd5e-catalog.mjs';
import {matchRecipe,matchStrikeOverride,normalize,validateRecipe} from '../../core/model.mjs';
export {DND_NPC_ACTIONS,DND_NPC_ACTION_SOURCE};
const byId=new Map(DND_NPC_ACTIONS.map(a=>[a.id,a])),bySource=new Map(),byName=new Map();
for(const action of DND_NPC_ACTIONS){const name=normalize(action.name);if(!byName.has(name))byName.set(name,[]);byName.get(name).push(action);}
for(const action of DND_NPC_ACTIONS)for(const match of action.matches){if(!bySource.has(match.source))bySource.set(match.source,[]);bySource.get(match.source).push({action,activityId:match.activityId});}
function select(candidates,event){
 const activityId=event.activityId??event.activity?._id,name=event.activityName??event.activity?.name;
 if(activityId){const exact=candidates.filter(c=>c.activityId===activityId);if(exact.length===1)return exact[0].action;}
 const named=candidates.filter(c=>(name==null||normalize(c.action.activityName)===normalize(name))&&(!event.activity?.type||c.action.activityType===event.activity.type));
 return named.length===1?named[0].action:null;
}
export function findDndNpcAction(event){
 const item=event?.item,actor=event?.actor??item?.actor;
 if(!item||actor?.type!=='npc'||item.type!=='feat'||event.systemId&&event.systemId!=='dnd5e')return null;
 const sources=[event.itemUuid,item._stats?.compendiumSource,item.flags?.core?.sourceId,item.original?.uuid,item.uuid];
 for(const actorSource of [actor._stats?.compendiumSource,actor.flags?.core?.sourceId,actor.uuid])if(actorSource&&item.id)sources.push(`${actorSource}.Item.${item.id}`);
 for(const source of sources){const candidates=bySource.get(source);if(candidates){const action=select(candidates,event);if(action)return action;}}
 // Imported NPCs preserve their native name even when a migration regenerates
 // embedded ids. Require both creature and feature plus unambiguous activity.
 const edition=item.system?.source?.rules;
 return select((byName.get(normalize(item.name))??[]).filter(a=>a.creatures.some(n=>normalize(n)===normalize(actor.name))&&(!edition||a.edition===edition)).map(action=>({action,activityId:action.activityId})),event);
}
export function dndNpcActionPreview(id,options={}){
 const action=typeof id==='string'?byId.get(id):id;if(!action)return null;
 if(action.native){const entry=dndEntry(action.native.entryId);return entry?dndRecipe(entry,action.native.variantId,options):null;}
 const recipe=buildNpcActionRecipe(action,{...options,systemId:'dnd5e'});
 // Some elemental impact families only ship in Patreon. Preserve the authored
 // geometry and tint with a compact blue Free impact as the final fallback.
 if(recipe&&action.form.id.startsWith('generic:'))for(const stage of recipe.stages)if(['cast','impact','aura'].includes(stage.kind)&&stage.assets?.length)stage.assets=[...stage.assets,'jb2a.impact.004.blue'];
 return recipe;
}
export function resolveDndNpcAction(event,saved=[],options={}){
 if(options.npcEnabled===false)return null;
 const action=findDndNpcAction(event);if(!action||action.delegated||options.npcExcluded?.includes(action.id))return null;
 const override=matchStrikeOverride(saved,event)??matchRecipe(saved,event);if(override)return override;
 if(saved.some(r=>!r.enabled&&matchRecipe([{...r,enabled:true}],event)))return null;
 const recipe=dndNpcActionPreview(action,options);if(!recipe||recipe.trigger!==event.type)return null;
 // Bind the selected native activity, including imported copies with new ids.
 return validateRecipe({...recipe,activityId:event.activityId??event.activity?._id??action.activityId,activityType:action.activityType,activityName:event.activityName??event.activity?.name??action.activityName});
}
