import test from 'node:test';
import assert from 'node:assert/strict';
import {CreatureShowcaseUI,SHOWCASE_PAGE} from '../../scripts/ui/creature-showcase-ui.mjs';
import {showcaseMovementRecipe} from '../../scripts/engines/showcase/creature-showcase.mjs';
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(Preview){
 const calls=[],status={textContent:''},scene={},container={innerHTML:'',querySelector:()=>scene};
 const snapshot={tokens:[{id:'boss',name:'<Dragon>',hidden:false}],selectedId:'boss',creature:{name:'<Dragon>',hidden:false},previewTokens:{source:{id:'boss'},targets:{id:'stand-in'}},steps:[{name:'Movement',kind:'movement',recipe:showcaseMovementRecipe('pf2e')},{name:'Attack',kind:'attack',recipe:showcaseMovementRecipe('pf2e')}]};
 const w={page:SHOWCASE_PAGE,root:{querySelector:s=>s==='[data-showcase-stage]'?container:status,querySelectorAll:()=>[]},
  render:()=>calls.push('render'),recipePreviewHTML:(_r,t)=>{calls.push(t);return '<div>stand-ins</div>';},
  host:{environment:()=>({ready:true}),creatureShowcase:()=>snapshot,previewCreatureMovement:()=>{calls.push('move');return ()=>calls.push('move-stop');},playBossEntrance:async(id,o)=>{calls.push([id,o]);return false;},stopBossEntrance:()=>calls.push('boss-stop')}};
 const ui=new CreatureShowcaseUI(w,{Preview});ui.html();return {w,ui,calls,status,snapshot};
}
test('showcase renders escaped creature name, hidden broadcast guard and distinct preview/everyone controls',()=>{
 const f=fixture();let html=f.ui.html();assert.match(html,/&lt;Dragon&gt;/);assert.doesNotMatch(html,/<Dragon>/);assert.match(html,/data-action="boss-preview"/);assert.match(html,/data-action="boss-play"/);
 f.snapshot.creature.hidden=true;html=f.ui.html();assert.match(html,/data-action="boss-play" disabled/);assert.match(html,/Local preview is available/);
});
test('token cards show artwork and real GM creature names instead of an ambiguous dropdown',async()=>{
 const f=fixture();f.snapshot.tokens=[{id:'skink-1',name:'Unknown',actorName:'Magnetic Skink',img:'skink.webp'},{id:'spider-2',name:'Unknown',actorName:'Ogre Spider',img:'spider.webp',hidden:true}];
 const html=f.ui.html();assert.doesNotMatch(html,/data-showcase="token"/);assert.match(html,/src="skink.webp"/);assert.match(html,/Magnetic Skink/);assert.match(html,/Ogre Spider/);assert.match(html,/Hidden/);
 f.ui.options.title='Old title';await f.ui.action('showcase-token',{dataset:{id:'spider-2'}});assert.equal(f.ui.tokenId,'spider-2');assert.equal(f.ui.options.title,'');assert.ok(f.calls.includes('render'));
});
test('sequential choreography awaits each step and owns movement cleanup',async()=>{
 let active=0;class Preview{constructor(){active++;assert.equal(active,1);}async play(){return true;}stop(){if(!this.stopped){this.stopped=true;active--;}}}
 const f=fixture(Preview);await f.ui.play();assert.equal(active,0);assert.equal(f.calls.filter(x=>x==='move').length,1);assert.equal(f.calls.filter(x=>x==='move-stop').length,1);assert.match(f.status.textContent,/complete/);
});
test('stopping during media preparation prevents late movement and later steps',async()=>{
 let ready,constructed=0;class Preview{constructor(){constructed++;}prepare(){return new Promise(r=>ready=r);}play(){throw Error('late play');}stop(){}}
 const f=fixture(Preview),pending=f.ui.play();await settle();f.ui.stop();ready();await pending;assert.equal(constructed,1);assert.ok(!f.calls.includes('move'));assert.match(f.status.textContent,/stopped/);
});
test('Edit on an attack step copies the built-in, bound to this creature unless every creature is chosen',async()=>{
 const f=fixture(),drafts=[];let scope='creature';
 f.snapshot.creature.actorName='Clockwork Serpent';
 Object.assign(f.snapshot.steps[1],{name:'Jaws',itemName:'Jaws',trigger:'attack',bindUuid:'Actor.serpent.Item.jaws'});
 f.w.openDraft=(recipe,message)=>drafts.push({recipe,message});
 const radio=()=>({value:scope});
 f.w.root.querySelector=s=>s==='input[name="an-showcase-scope"]:checked'?radio():s==='[data-showcase-stage]'?{innerHTML:'',querySelector:()=>({})}:{textContent:''};
 f.ui.index=1;assert.match(f.ui.stepHTML(),/Edit Jaws animation/);
 await f.ui.action('showcase-edit',{dataset:{}});assert.match(f.ui.stepHTML(),/This creature only/);
 await f.ui.action('showcase-edit-copy',{dataset:{}});
 assert.equal(drafts[0].recipe.itemUuid,'Actor.serpent.Item.jaws');assert.equal(drafts[0].recipe.trigger,'attack');assert.match(drafts[0].recipe.name,/Clockwork Serpent/);
 f.ui.index=1;scope='all';await f.ui.action('showcase-edit',{dataset:{}});await f.ui.action('showcase-edit-copy',{dataset:{blank:'true'}});
 assert.equal(drafts[1].recipe.itemUuid,'');assert.equal(drafts[1].recipe.match,'Jaws');assert.deepEqual(drafts[1].recipe.stages[0].assets,[]);
});
test('a step you customized opens your recipe; Movement opens movement sounds',async()=>{
 const f=fixture(),opened=[];
 Object.assign(f.snapshot.steps[1],{itemName:'Jaws',trigger:'attack'});
 f.w.host.recipes=()=>[{id:f.snapshot.steps[1].recipe.id}];f.w.reveal=o=>opened.push(o);f.w.host.openMovementSounds=id=>opened.push(['sounds',id]);
 f.ui.index=1;assert.match(f.ui.stepHTML(),/Edit customization/);assert.match(f.ui.html(),/Edited/);
 await f.ui.action('showcase-edit',{dataset:{}});assert.deepEqual(opened[0],{recipeId:f.snapshot.steps[1].recipe.id});
 f.ui.index=0;assert.match(f.ui.stepHTML(),/Edit movement sounds/);await f.ui.action('showcase-movement-sounds',{dataset:{}});assert.deepEqual(opened[1],['sounds','boss']);
});
test('boss commands preserve local versus everyone intent and reject player actions',async()=>{
 const f=fixture();await f.ui.action('boss-preview',{});await f.ui.action('boss-play',{});const requests=f.calls.filter(Array.isArray);assert.equal(requests.at(-2)[1].everyone,false);assert.equal(requests.at(-1)[1].everyone,true);
 f.w.host.playerMode=true;await assert.rejects(f.ui.action('boss-play',{}),/Only a GM/);
});
