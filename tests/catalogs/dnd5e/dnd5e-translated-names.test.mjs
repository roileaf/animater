// A translation module (Babele, e.g. the Russian ru-ru) renames compendium documents in place: new name, same ids and
// identifiers, and the English name kept on flags.babele.originalName. Names below come from ru-ru's dnd5e files.
import test from 'node:test';
import assert from 'node:assert/strict';
import {dndEntries,findDndEntry,resolveDndAutomaticRecipe,dndDisplayName,filterDndEntries} from '../../../scripts/catalogs/dnd5e/dnd5e-catalog.mjs';
import {DndCatalogWorkspace} from '../../../scripts/ui/dnd5e-catalog-ui.mjs';
import {findDndState} from '../../../scripts/catalogs/dnd5e/dnd5e-states.mjs';
import {DND_NPC_ACTIONS,findDndNpcAction} from '../../../scripts/catalogs/dnd5e/dnd5e-npc-actions.mjs';
import {matchRecipe} from '../../../scripts/core/model.mjs';

const find=(name,kind='spell',edition='2024')=>dndEntries(kind).find(e=>e.name===name&&e.edition===edition);
const fireball=find('Fireball');
const translated=(extra={},system={})=>({type:'spell',name:'Огненный шар',...extra,system:{source:{rules:'2024'},...system}});
const babele=name=>({babele:{originalName:name}});
const world=(lang,index)=>({i18n:{lang},packs:new Map([['dnd5e.spells24',{index}]])});

test('a translated item finds its entry by source, identifier or original name',()=>{
 assert.equal(findDndEntry({item:translated({_stats:{compendiumSource:fireball.uuid}})})?.id,fireball.id,'compendium source');
 assert.equal(findDndEntry({item:translated({},{identifier:'fireball'})})?.id,fireball.id,'identifier');
 assert.equal(findDndEntry({item:translated({flags:babele('Fireball')})})?.id,fireball.id,'original name');
 assert.equal(findDndEntry({item:translated()}),null,'a name alone, with no compendium to ask');
});
test('the original name keeps the rules edition and the book-name fallback',()=>{
 const legacy=find('Fireball','spell','2014');
 assert.equal(findDndEntry({item:translated({flags:babele('Fireball')},{source:{rules:'2014'}})})?.id,legacy.id);
 assert.equal(findDndEntry({item:{type:'spell',name:'Черные щупальца',flags:babele("Evard's Black Tentacles"),system:{}}})?.name,'Black Tentacles');
});
test('a natural attack that only kept its translated name still plays: statblocks disagree on feature or weapon',()=>{
 const bite=dndEntries('weapon').find(e=>e.name==='Bite');
 assert.equal(findDndEntry({item:{type:'feat',name:'Укус',flags:babele('Bite'),system:{}}})?.name,bite.name);
});
test('an item that kept only its translated name finds the entry through the compendium the translation renamed',()=>{
 const pack=new Map([[fireball.documentId,{name:'Огненный шар'}]]);
 globalThis.game=world('ru',new Map());
 try{
  assert.equal(findDndEntry({item:translated()}),null,'names not translated yet');
  globalThis.game=world('ru',pack);
  assert.equal(findDndEntry({item:translated()})?.id,fireball.id,'translated later: nothing stale stuck');
  assert.equal(findDndEntry({item:{type:'weapon',name:'Огненный шар',system:{}}}),null,'another kind of item is not that spell');
  assert.equal(findDndEntry({item:{type:'spell',name:'Неизвестное заклинание',system:{}}}),null);
  assert.equal(findDndEntry({item:{type:'spell',name:'',system:{}}}),null,'a blank name matches nothing');
 }finally{delete globalThis.game;}
});
test('a non-English world shows and searches the names its compendium uses',()=>{
 globalThis.game=world('ru',new Map([[fireball.documentId,{name:'Огненный шар'}]]));
 try{
  assert.equal(dndDisplayName(fireball),'Огненный шар');
  assert.deepEqual(filterDndEntries('spell',{search:'Огненный шар',edition:'2024'}).map(e=>e.id),[fireball.id]);
  assert.equal(filterDndEntries('spell',{search:'огненный',edition:'2024'})[0]?.id,fireball.id,'part of a name, any case');
  assert.equal(filterDndEntries('spell',{search:'Fireball',edition:'2024'})[0]?.id,fireball.id,'English still finds it');
  const legacy=find('Fireball','spell','2014');
  assert.equal(dndDisplayName(legacy),'Fireball','an entry the translation left alone keeps its name');
  assert.equal(dndDisplayName({id:'another-system',name:'Другое',uuid:fireball.uuid}),'Другое','another system\'s entry is not looked up');
 }finally{delete globalThis.game;}
});
test('an English world always shows the catalog names, whatever its compendiums say',()=>{
 for(const lang of ['en','en-GB',undefined]){
  globalThis.game=world(lang,new Map([[fireball.documentId,{name:'Renamed Blast'}]]));
  try{
   assert.equal(dndDisplayName(fireball),'Fireball',String(lang));
   assert.equal(filterDndEntries('spell',{search:'Renamed Blast',edition:'2024'}).length,0,String(lang));
   assert.equal(findDndEntry({item:{type:'spell',name:'Renamed Blast',system:{}}}),null,String(lang));
  }finally{delete globalThis.game;}
 }
});
test('the catalog cards and details show the display name',()=>{
 globalThis.game=world('ru',new Map([[fireball.documentId,{name:'Огненный шар'}]]));
 try{
  const w={page:'spells',host:{environment:()=>({demo:false,ready:true,systemId:'dnd5e'}),recipes:()=>[],dndCatalogState:()=>({}),soundCatalog:()=>null},recipePreviewHTML:()=>'',render(){}};
  const ui=new DndCatalogWorkspace(w);
  ui.filters.spell={search:'Огненный шар',edition:'2024',level:'all',theme:'all'};
  const html=ui.html();
  assert.match(html,/<b>Огненный шар<\/b>/,'card');
  assert.match(html,/aria-label="Open Огненный шар details">Огненный шар<\/button>/,'details');
 }finally{delete globalThis.game;}
});
test('a translated spell plays its catalog animation on plug and play',()=>{
 const variant=fireball.variants.find(v=>v.recipe.trigger==='template')??fireball.variants[0];
 const event={type:variant.recipe.trigger,systemId:'dnd5e',item:translated({flags:babele('Fireball')}),activityId:variant.activityId,activity:{type:variant.activityType}};
 assert.ok(resolveDndAutomaticRecipe(event,()=>({enabled:true,scope:'all'}),[],{sounds:null}));
});
test('a recipe named in English matches the translated item by its original name',()=>{
 const recipe={id:'r',enabled:true,trigger:'use',match:'Bite',stages:[]};
 assert.equal(matchRecipe([recipe],{type:'use',item:{name:'Укус',flags:babele('Bite'),system:{identifier:''}}})?.id,'r');
 assert.equal(matchRecipe([recipe],{type:'use',item:{name:'Укус',system:{identifier:''}}}),null);
});

// dnd5e applies a spell's effect to its target as a clone recording only _stats.duplicateSource (the caster's copy).
const effectWithParent=dndEntries('effect').find(e=>e.parentUuid&&e.uuid.startsWith('Compendium.dnd5e.spells24.'));
function appliedCopy(name,entry=effectWithParent){
 const casterSpell={documentName:'Item',id:'spell',uuid:'Actor.caster.Item.spell',_stats:{compendiumSource:entry.parentUuid}};
 const casterEffect={documentName:'ActiveEffect',id:entry.documentId,_id:entry.documentId,uuid:`${casterSpell.uuid}.ActiveEffect.${entry.documentId}`,parent:casterSpell,_stats:{}};
 globalThis.fromUuidSync=uuid=>uuid===casterEffect.uuid?casterEffect:null;
 return {type:'effect',document:{documentName:'ActiveEffect',id:'copy',_id:'copy',uuid:'Actor.target.ActiveEffect.copy',name,parent:{documentName:'Actor'},actor:{items:{get:()=>null}},origin:casterEffect.uuid,_stats:{compendiumSource:null,duplicateSource:casterEffect.uuid}}};
}
test('a spell effect applied to a target follows its source in any language',()=>{
 try{
  assert.equal(findDndState(appliedCopy('Перевод эффекта'))?.id,effectWithParent.id);
  // Effects sharing one name ("Acid Arrow" levels) stay apart too: a name alone could not tell them.
  const shared=dndEntries('effect').filter(e=>e.parentUuid&&dndEntries('effect').filter(o=>o.name===e.name).length>1).slice(0,3);
  assert.ok(shared.length);
  for(const entry of shared)assert.equal(findDndState(appliedCopy(entry.name,entry))?.id,entry.id);
 }finally{delete globalThis.fromUuidSync;}
});
test('an effect with no source left is known by its original name',()=>{
 const unique=dndEntries('effect').find(e=>dndEntries('effect').filter(o=>o.name===e.name).length===1);
 const effect={documentName:'ActiveEffect',name:'Перевод',flags:babele(unique.name),_stats:{}};
 assert.equal(findDndState({type:'effect',document:effect})?.id,unique.id);
 assert.equal(findDndState({type:'effect',document:{...effect,flags:{}}}),null);
});

test('an imported NPC with new ids is recognised through the original names of creature and feature',()=>{
 const action=DND_NPC_ACTIONS.find(a=>a.creatures.length&&!a.delegated&&a.activityId);
 const event=flags=>({systemId:'dnd5e',type:action.trigger,activityId:action.activityId,item:{type:'feat',id:'new-id',name:'Перевод',flags:flags?babele(action.name):undefined,system:{source:{rules:action.edition}}},actor:{type:'npc',name:'Существо',flags:flags?babele(action.creatures[0]):undefined}});
 assert.equal(findDndNpcAction(event(true))?.id,action.id);
 assert.equal(findDndNpcAction(event(false)),null);
});
