import test from 'node:test';
import assert from 'node:assert/strict';
import {SF_NPC_ACTIONS,SF_NPC_ACTION_SOURCE,findSfNpcAction,sfNpcActionPreview,resolveSfNpcAction} from '../scripts/catalogs/sf2e/sf2e-npc-actions.mjs';
import {twoeCatalogRecipe} from '../scripts/systems/twoe-crossover.mjs';
import {planRecipe} from '../scripts/core/model.mjs';
import {assetDatabases} from '../tools/asset-databases.mjs';

const eventFor=(a,type=a.form.trigger)=>({systemId:'sf2e',type,actor:{type:'npc',name:a.creatures[0]},item:{name:a.name,type:'action',sourceId:a.sources[0],system:{traits:{value:a.traits},actionType:{value:a.actionType},actions:{value:a.actions}}}});
const action=name=>SF_NPC_ACTIONS.find(a=>a.name===name);
const stateFor=kind=>kind==='npcAbility'?true:kind==='npcAbilityGuess'?false:kind==='npcAbilityExcluded'?[]:{enabled:true,motion:true,scope:'all'};
const context={source:{id:'npc',center:{x:0,y:0},w:100,h:100},targets:[{id:'target',center:{x:300,y:0},w:100,h:100}],gridSize:100,gridDistance:5,template:{id:'area'},area:{type:'cone',center:{x:0,y:0},endpoint:{x:500,y:0},length:500,angle:60,width:100,diameter:500}};

test('all SF NPC previews resolve actual Free and Patreon media with motion on and off',async()=>{
 const databases=await assetDatabases();
 for(const a of SF_NPC_ACTIONS)for(const motion of [true,false]){
  const recipe=sfNpcActionPreview(a.id,{motion,sounds:null});
  const c={...context,area:{...context.area,type:recipe.previewArea?.type??(a.form.variant?.startsWith('line')?'line':a.form.variant?.startsWith('cone')?'cone':'burst')}};
  for(const [edition,assets]of Object.entries(databases)){
   let plan;try{plan=planRecipe(recipe,assets,c);}catch(error){throw new Error(`${a.name} / ${a.form.id} / motion ${motion} / ${edition}: ${error.message}`,{cause:error});}
   assert.ok(plan.length,`${a.name} ${motion} ${edition}`);
   assert.ok(plan.some(s=>!['motion','sound'].includes(s.kind)),`${a.name} visible ${motion} ${edition}`);
  }
 }
});

test('all installed native active actions are indexed once and preview in both motion modes',()=>{
 assert.equal(SF_NPC_ACTION_SOURCE.occurrences,958);assert.equal(SF_NPC_ACTIONS.length,660);
 const sources=SF_NPC_ACTIONS.flatMap(a=>a.sources);assert.equal(sources.length,958);assert.equal(new Set(sources).size,958);
 for(const a of SF_NPC_ACTIONS){
  assert.equal(findSfNpcAction(eventFor(a))?.id,a.id);
  for(const motion of [true,false]){const r=sfNpcActionPreview(a.id,{motion});assert.ok(r?.stages.length,a.name);assert.equal(r.systemId,'sf2e',a.name);}
 }
});
test('source matching rejects unrelated custom/other-system names and supports imported native actors',()=>{
 const a=action('Attack Pattern Alpha'),event=eventFor(a);
 assert.equal(findSfNpcAction({...event,systemId:'dnd5e'}),null);
 assert.equal(findSfNpcAction({...event,item:{...event.item,sourceId:'Compendium.pf2e.bestiary.Actor.x.Item.y'}}),null);
 const source=a.sources[0],cut=source.lastIndexOf('.Item.');
 assert.equal(findSfNpcAction({...event,actor:{...event.actor,sourceId:source.slice(0,cut)},item:{...event.item,sourceId:undefined,id:source.slice(cut+6)}})?.id,a.id);
 assert.equal(findSfNpcAction({...event,actor:{type:'npc',name:'Unrelated NPC'},item:{...event.item,sourceId:undefined}}),null);
});
test('known reviewed SF actions run with guessing off and preserve native system',()=>{
 const a=action('Attack Pattern Alpha'),e=eventFor(a);
 const recipe=twoeCatalogRecipe('sf2e',e,[],{stateFor});
 assert.ok(recipe);assert.equal(recipe.systemId,'sf2e');assert.equal(recipe.catalogEntry,a.id);
 assert.equal(a.form.id,'review-c-strike');
 assert.ok(recipe.stages.every(s=>!['projectile','impact','template'].includes(s.kind)));
 assert.equal(action('Mass Reload').form.id,'review-c-gather');
 assert.equal(action('Target Tracking').form.id,'review-c-mark');
 assert.equal(action('Slip Through Space').form.id,'review-c-dissolve');
});
test('wrong trigger, NPC switch and exclusions never fall through into guessing',()=>{
 const a=action('Attack Pattern Alpha'),e=eventFor(a);
 assert.equal(resolveSfNpcAction({...e,type:'template'},[],{enabled:true}),null);
 assert.equal(twoeCatalogRecipe('sf2e',e,[],{stateFor:k=>k==='npcAbility'?false:stateFor(k)}),null);
 assert.equal(twoeCatalogRecipe('sf2e',e,[],{stateFor:k=>k==='npcAbilityExcluded'?[a.id]:stateFor(k)}),null);
 const area=SF_NPC_ACTIONS.find(a=>!a.native&&a.form.trigger==='template');
 assert.ok(area);assert.equal(resolveSfNpcAction(eventFor(area,'use'),[],{enabled:true}),null);
 assert.ok(resolveSfNpcAction(eventFor(area),[],{enabled:true}));
});
test('custom overrides and paused recipes remain authoritative',()=>{
 const a=action('Attack Pattern Alpha'),e=eventFor(a),custom={...sfNpcActionPreview(a.id),id:'custom-sf-action',itemUuid:a.sources[0],enabled:true};
 assert.equal(resolveSfNpcAction(e,[custom],{enabled:false})?.id,custom.id);
 assert.equal(twoeCatalogRecipe('sf2e',e,[{...custom,enabled:false}],{stateFor}),null);
 assert.notEqual(resolveSfNpcAction(e,[custom],{customEnabled:false,enabled:true})?.id,custom.id);
});
test('existing native entries obey their ordinary catalog exclusions and scope',()=>{
 const a=SF_NPC_ACTIONS.find(a=>a.native),e=eventFor(a);
 assert.ok(resolveSfNpcAction(e,[],{enabled:true,stateFor}));
 assert.equal(twoeCatalogRecipe('sf2e',e,[],{stateFor:k=>typeof stateFor(k)==='object'&&!Array.isArray(stateFor(k))?{...stateFor(k),excluded:[a.native.entryId]}:stateFor(k)}),null);
 assert.equal(resolveSfNpcAction(e,[],{enabled:true,stateFor:()=>({enabled:true,scope:'selected',selected:[]})}),null);
});
