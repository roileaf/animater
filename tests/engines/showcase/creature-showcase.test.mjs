import test from 'node:test';
import assert from 'node:assert/strict';
import {buildCreatureShowcase,showcaseMovementRecipe,showcasePreviewArea} from '../../../scripts/engines/showcase/creature-showcase.mjs';
import {createBossEntrance,receiveBossEntrance,bossEntranceOptions,BOSS_TIMING,bossEntranceDesign} from '../../../scripts/engines/showcase/boss-entrance.mjs';
import {assetDatabases} from '../../../tools/asset-databases.mjs';
import {resolveAsset} from '../../../scripts/core/model.mjs';
import {samplePath} from '../../../scripts/engines/motion/keyframe-path.mjs';

test('showcase resolves real NPC items and distinct activities without using or changing them',()=>{
 const actor={type:'npc',items:[{id:'b',type:'feat',name:'Breaths',system:{activities:{fire:{_id:'fire',name:'Fire',activation:{type:'action'}},sleep:{_id:'sleep',name:'Sleep',activation:{type:'action'}},passive:{activation:{type:'turnStart'}},cast:{type:'cast',activation:{type:'action'}}}}}]};
 const before=JSON.stringify(actor),calls=[];
 const show=buildCreatureShowcase({actor,systemId:'dnd5e',resolve:e=>{calls.push(e);return e.type==='use'?{id:e.activityId,name:e.activityName,systemId:'dnd5e',trigger:'use',stages:[{kind:'aura',assets:['jb2a.shimmer.01.blue']}]}:null;}});
 assert.deepEqual(show.steps.map(s=>s.activityId).filter(Boolean),['fire','sleep']);assert.equal(show.steps.length,3);assert.equal(show.unavailable.length,0);
 assert.ok(calls.every(e=>e.actor===actor&&e.item===actor.items[0]));assert.equal(JSON.stringify(actor),before);
 assert.deepEqual(buildCreatureShowcase({actor:{type:'character'},resolve:()=>{throw Error('PC');}}).steps,[]);
});
test('choreography includes breath before attacks, names uncovered actions and bounds the sequence',()=>{
 const actor={type:'npc',items:[{id:'a',type:'melee',name:'Jaws'},{id:'b',type:'action',name:'Breath Weapon'},{id:'c',type:'action',name:'Unknown'},{id:'p',type:'action',name:'Passive',system:{actionType:{value:'passive'}}}]};
 const show=buildCreatureShowcase({actor,systemId:'pf2e',limit:2,resolve:e=>e.item.id==='c'?null:e.type===(e.item.id==='a'?'attack':'template')?{id:e.item.id,name:e.item.name,trigger:e.type,stages:[{kind:'aura',assets:['jb2a.shimmer.01.blue']}]}:null});
 assert.deepEqual(show.steps.map(s=>s.name),['Movement','Breath Weapon']);assert.equal(show.total,3);assert.deepEqual(show.unavailable,[{name:'Unknown'}]);
 const path=showcaseMovementRecipe('pf2e').stages[0].keyframes;assert.ok(samplePath(path,.25).x>0);assert.equal(samplePath(path,1).x,0);
});
test('preview geometry preserves native line/cone range and D&D activity template dimensions',()=>{
 assert.deepEqual(showcasePreviewArea({system:{description:{value:'in a @Template[line|distance:100]'}}}),{type:'line',value:100});
 assert.deepEqual(showcasePreviewArea({system:{description:{value:'@Template[type:cone|distance:60]'}}}),{type:'cone',value:60});
 assert.deepEqual(showcasePreviewArea({}, {target:{template:{type:'wall',size:80,width:10}}}),{type:'line',value:80,width:10});
 assert.equal(showcasePreviewArea({system:{description:{value:'A long line.'}}}),null);
});
function fixture(){
 let now=0,visible=true,scene=true;const timers=new Map(),calls=[];let n=0,interrupt;
 const host={target:()=>visible?{name:'Boss',center:{x:100,y:200},w:200,h:200}:null,sameScene:()=>scene,view:()=>({x:10,y:20,scale:1}),maxZoom:()=>2,canPan:()=>true,
  pan:p=>calls.push(['pan',p]),overlay:p=>{calls.push(['overlay',p]);return ()=>calls.push(['overlay-stop']);},effects:()=>()=>calls.push(['effect-stop']),
  sound:async()=>({stop:()=>calls.push(['sound-stop'])}),watchCamera:fn=>{interrupt=fn;return ()=>calls.push(['unwatch']);},trace:(...v)=>calls.push(v),
  schedule:(fn,ms)=>{const id=++n;timers.set(id,{fn,at:now+ms});return id;},cancel:id=>timers.delete(id)};
 const engine=createBossEntrance(host);
 return {engine,host,calls,timers,interrupt:()=>interrupt(),hide:()=>{visible=false;},sceneOff:()=>{scene=false;},advance:ms=>{const until=now+ms;for(;;){const next=[...timers].filter(([,v])=>v.at<=until).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;now=next[1].at;timers.delete(next[0]);next[1].fn();}now=until;}};
}
const entrance={id:'entrance-1',tokenId:'boss',sceneId:'scene'};
const settle=()=>new Promise(resolve=>setImmediate(resolve));
test('entrance returns camera and cleans title, effects, audio and timers; replay packets are ignored',async()=>{
 const f=fixture();assert.equal(f.engine.play(entrance),true);f.advance(BOSS_TIMING.impact);await settle();
 f.advance(BOSS_TIMING.duration);assert.equal(f.engine.playing,false);assert.equal(f.timers.size,0);
 assert.deepEqual(f.calls.filter(c=>c[0]==='pan').at(-1)[1],{x:10,y:20,scale:1,duration:450});
 assert.ok(f.calls.some(c=>c[0]==='overlay-stop'));assert.ok(f.calls.some(c=>c[0]==='effect-stop'));assert.ok(f.calls.some(c=>c[0]==='sound-stop'));
 assert.equal(f.engine.play(entrance),false);
});
test('manual camera changes prevent return; hidden token and scene exit remove the entrance',()=>{
 const f=fixture();f.engine.play(entrance);f.interrupt();f.advance(BOSS_TIMING.duration);assert.equal(f.calls.filter(c=>c[0]==='pan').length,1);
 const hidden=fixture();hidden.engine.play(entrance);hidden.hide();hidden.advance(200);assert.equal(hidden.engine.playing,false);assert.equal(hidden.timers.size,0);
 const scene=fixture();scene.engine.play(entrance);scene.sceneOff();scene.engine.stop({restore:false});assert.equal(scene.calls.filter(c=>c[0]==='pan').length,1);
 const low=fixture();low.host.canPan=()=>false;low.engine.play(entrance);low.advance(BOSS_TIMING.duration);assert.equal(low.calls.filter(c=>c[0]==='pan').length,0);
});
test('a timer cancellation error cannot strand the overlay or camera',()=>{
 const f=fixture();f.engine.play(entrance);f.host.cancel=()=>{throw Error('timer gone');};f.engine.stop();
 assert.ok(f.calls.some(c=>c[0]==='overlay-stop'));assert.equal(f.calls.filter(c=>c[0]==='pan').length,2);
});
test('late audio cannot leak after cancellation; only authenticated GM packets can start or stop entrances',async()=>{
 const f=fixture();let resolve;f.host.sound=()=>new Promise(r=>resolve=r);f.engine.play(entrance);f.advance(BOSS_TIMING.impact);await settle();f.engine.stop();let stopped=0;resolve({stop:()=>stopped++});await settle();assert.equal(stopped,1);
 const calls=[],host={isGM:id=>id==='gm',play:d=>{calls.push(d);return true;},stop:id=>calls.push(id)};
 const packet={...entrance,type:'boss-entrance',action:'play',userId:'gm',options:{title:'<script>',style:'unknown'}};
 assert.equal(receiveBossEntrance(packet,undefined,host),false);assert.equal(receiveBossEntrance(packet,'player',host),false);assert.equal(receiveBossEntrance(packet,'gm',host),true);
 assert.equal(calls[0].options.style,'dread');assert.equal(calls[0].preview,false);
 receiveBossEntrance({...packet,action:'stop'},'gm',host);assert.equal(calls[1],entrance.id);
 assert.equal(bossEntranceOptions({volume:9,title:'x'.repeat(200)}).title.length,100);assert.equal(bossEntranceOptions({volume:9}).volume,1);
});
test('entrances build, impact and linger with installed Free/Patreon media; local Skip cancels delayed audio',async()=>{
 const db=await assetDatabases();
 for(const style of ['dread','arcane','primal']){
  const design=bossEntranceDesign(style);assert.equal(design.length,3);assert.equal(design[1].delay,BOSS_TIMING.impact);
  for(const rows of Object.values(db))for(const phase of design)assert.ok(resolveAsset({kind:'aura',assets:phase.assets},rows),`${style} ${phase.label}`);
 }
 const f=fixture();let sounds=0,finished=0;f.host.sound=()=>{sounds++;};f.engine.play({...entrance,onFinish:()=>finished++});
 const overlay=f.calls.find(c=>c[0]==='overlay')[1];overlay.onSkip();f.advance(BOSS_TIMING.duration);await settle();assert.equal(sounds,0);assert.equal(f.engine.playing,false);assert.equal(finished,1);
});
