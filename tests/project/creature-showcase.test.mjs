import test from 'node:test';
import assert from 'node:assert/strict';
import {createCreatureShowcaseTools} from '../../scripts/integrations/creature-showcase.mjs';

test('Foundry bridge uses valid local Sequencer assets, keeps documents unchanged, and enforces GM/hidden guards',async t=>{
 const names=['game','canvas','CONFIG','document','Sequence','Sequencer'],before=Object.fromEntries(names.map(k=>[k,globalThis[k]]));
 t.after(()=>{for(const k of names)if(before[k]===undefined)delete globalThis[k];else globalThis[k]=before[k];});
 const calls=[],nodes=[];
 const token={id:'boss',name:'Dragon',visible:true,controlled:true,w:300,h:300,center:{x:500,y:400},actor:{type:'npc',items:[]},document:{hidden:false,texture:{src:'dragon.webp'}}};
 globalThis.game={user:{id:'gm',isGM:true},users:new Map([['gm',{isGM:true}],['player',{isGM:false}]]),system:{id:'pf2e'},modules:new Map([['animater',{socket:true}]]),socket:{emit:(...args)=>calls.push(['socket',...args])}};
 globalThis.canvas={ready:true,scene:{id:'scene',grid:{distance:5}},grid:{size:100},tokens:{get:id=>id==='boss'?token:null,placeables:[token],controlled:[token]},stage:{pivot:{x:0,y:0},scale:{x:1}},animatePan:p=>{calls.push(['pan',p]);return Promise.resolve();}};
 globalThis.CONFIG={Canvas:{maxZoom:3}};
 globalThis.document={getElementById:()=>({addEventListener(){},removeEventListener(){}}),createElement:()=>({append(){},setAttribute(){},addEventListener(){},remove(){this.removed=true;}}),body:{append:n=>nodes.push(n)}};
 globalThis.Sequence=class{
  effect(){return this;}
  file(key){assert.equal(typeof key,'string');assert.ok(key.startsWith('jb2a.'));calls.push(['file',key]);return this;}
  atLocation(){return this;}scaleToObject(){return this;}tint(){return this;}opacity(){return this;}delay(){return this;}
  duration(){return this;}fadeIn(){return this;}fadeOut(){return this;}name(){return this;}
  play(options){assert.deepEqual(options,{local:true});return Promise.resolve();}
 };
 globalThis.Sequencer={EffectManager:{endEffects:opts=>calls.push(['end',opts])}};
 const tools=createCreatureShowcaseTools({resolve:()=>null,sounds:()=>null,catalog:()=>[{key:'jb2a.smoke.puff.centered.grey'}],movement:()=>()=>{},trace:(...v)=>calls.push(v),quality:()=> 'full',canFocus:()=>true,clientId:'client'});
 t.after(()=>tools.clear());const raw=JSON.stringify(token);
 assert.equal(tools.snapshot().selectedId,'boss');assert.equal(tools.snapshot().steps[0].kind,'movement');
 assert.equal(tools.playBoss('boss',{sound:false,camera:false}),true);assert.equal(calls.find(c=>c[0]==='file')[1],'jb2a.smoke.puff.centered.grey');assert.equal(calls.filter(c=>c[0]==='socket').length,0);
 tools.stopBoss();assert.ok(nodes.every(n=>n.removed));assert.equal(JSON.stringify(token),raw);
 token.document.hidden=true;assert.throws(()=>tools.playBoss('boss',{everyone:true}),/visible/);assert.equal(tools.playBoss('boss',{sound:false,camera:false}),true);tools.clear();
 token.document.hidden=false;assert.equal(tools.playBoss('boss',{everyone:true,sound:false,camera:false}),true);assert.equal(calls.filter(c=>c[0]==='socket').length,1);tools.stopBoss({everyone:true});assert.equal(calls.filter(c=>c[0]==='socket').length,2);
 game.user.isGM=false;assert.throws(()=>tools.snapshot(),/Only a GM/);assert.throws(()=>tools.playBoss('boss'),/Only a GM/);
 const request={type:'boss-entrance',action:'play',id:'remote-1',userId:'gm',tokenId:'boss',sceneId:'scene',options:{camera:false,sound:false}};
 assert.equal(tools.receive(request,'player'),false);token.visible=false;assert.equal(tools.receive(request,'gm'),false);token.visible=true;assert.equal(tools.receive(request,'gm'),true);
 assert.equal(tools.receive({...request,action:'stop',id:'other'},'gm'),true);assert.equal(tools.playing,true);
 assert.equal(tools.receive({...request,action:'stop'},'gm'),true);assert.equal(tools.playing,false);
});
