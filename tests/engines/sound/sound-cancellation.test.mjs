import test from 'node:test';
import assert from 'node:assert/strict';
import {AnimaterRuntime} from '../../../scripts/engines/playback/runtime.mjs';
const recipe={id:'audition',name:'Audition',trigger:'manual',stages:[{kind:'sound',soundFile:'modules/psfx/test.ogg',duration:100,volume:.35}]};
const context={source:{id:'source',center:{x:0,y:0}},targets:[]};
const tick=()=>new Promise(resolve=>setImmediate(resolve));

function audiovisualFixture(preloadSounds){
 let effects=0,sounds=0,plays=0,started;
 const section=new Proxy({}, {get:()=>()=>section});
 const runtime=new AnimaterRuntime({ready:()=>true,userId:()=> 'qa',canPlay:()=>true,preloadSounds,
  endEffects:async()=>{},endSounds:async()=>{},sequence:()=>({
   effect:()=>{effects++;return section;},sound:()=>{sounds++;return section;},play:async()=>{plays++;}
  })});
 runtime.catalog=[{key:'jb2a.impact',file:'modules/jb2a/impact.webm'}];
 const animation={...recipe,stages:[...recipe.stages,{kind:'cast',assets:['jb2a.impact'],duration:100}]};
 return {runtime,animation,counts:()=>({effects,sounds,plays}),onStart:r=>{started=r;},started:()=>started};
}

test('stalled sound preload cannot block visuals and late audio cannot restart playback',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 let release;
 const f=audiovisualFixture(()=>new Promise(resolve=>{release=resolve;}));
 t.after(()=>f.runtime.stop());
 const pending=f.runtime.play(f.animation,context,{onStart:f.onStart});await tick();
 assert.equal(f.counts().plays,0);
 t.mock.timers.tick(2000);await tick();
 assert.equal(f.counts().plays,1,'visuals start after bounded preparation');
 await pending;
 assert.equal(f.counts().sounds,0,'unready optional audio omitted for this playback');
 assert.equal(f.started().playbackPlan.some(s=>s.kind==='sound'),false);
 assert.ok(f.runtime.log.some(e=>e.status==='Skipped'&&/sound.*timed out/i.test(e.detail)));
 assert.equal(f.runtime.preparations.size,0);
 release();await tick();
 assert.equal(f.counts().plays,1,'late preload never starts another animation');
 assert.equal(f.runtime.sessions.size,0);
});

test('sound preload rejection leaves visuals playing and reports unavailable audio',async()=>{
 for(const preload of [()=>Promise.reject(Error('sound unavailable')),()=>{throw Error('sound unavailable');}]){
  const f=audiovisualFixture(preload);
  await f.runtime.play(f.animation,context,{onStart:f.onStart});
  assert.equal(f.counts().plays,1);assert.equal(f.counts().sounds,0);
  assert.ok(f.runtime.log.some(e=>e.status==='Skipped'&&e.detail.includes('sound unavailable')));
  assert.equal(f.runtime.preparations.size,0);
 }
});

test('unavailable sound-only preview reports its failure instead of claiming playback',async()=>{
 const f=audiovisualFixture(()=>Promise.reject(Error('sound unavailable')));
 await assert.rejects(f.runtime.play(recipe,context,{preview:true}),/sound unavailable/);
 assert.equal(f.counts().plays,0);assert.equal(f.runtime.preparations.size,0);assert.equal(f.runtime.sessions.size,0);
});

test('successful sound preparation retains native audio and visuals',async()=>{
 const f=audiovisualFixture(async()=>{});
 await f.runtime.play(f.animation,context,{onStart:f.onStart});
 assert.equal(f.counts().plays,1);assert.equal(f.counts().sounds,1);assert.equal(f.counts().effects,1);
 assert.equal(f.started().playbackPlan.some(s=>s.kind==='sound'),true);
 assert.equal(f.runtime.preparations.size,0);
});
test('Stop during uncached sound preload prevents playback and preview-clock startup',async()=>{
 let release,preloads=0,plays=0,starts=0;const gate=new Promise(resolve=>{release=resolve;});
 const sound=new Proxy({}, {get:()=>()=>sound});
 const runtime=new AnimaterRuntime({ready:()=>true,userId:()=> 'qa',canPlay:()=>true,preloadSounds:async()=>{preloads++;await gate;},endEffects:async()=>{},endSounds:async()=>{},sequence:()=>({sound:()=>sound,play:async()=>{plays++;}})});
 const pending=runtime.play(recipe,context,{onStart:()=>{starts++;}});await tick();
 await runtime.stop();release();await pending;
 assert.equal(preloads,1);assert.equal(plays,0);assert.equal(starts,0);assert.equal(runtime.sessions.size,0);
});
test('late sequence completion after Stop drains exact sound session without affecting other users',async()=>{
 let release,ends=[],active=false;const gate=new Promise(resolve=>{release=resolve;});
 const sound=new Proxy({}, {get:()=>()=>sound});
 const runtime=new AnimaterRuntime({ready:()=>true,userId:()=> 'qa',canPlay:()=>true,endEffects:async()=>{},endSounds:async filters=>{ends.push(filters.name);active=false;},sequence:()=>({sound:()=>sound,play:async()=>{await gate;active=true;}})});
 const pending=runtime.play(recipe,context);await tick();await runtime.stop();release();assert.equal(await pending,null);
 assert.equal(active,false);assert.ok(ends.some(name=>name.startsWith('animater-qa-')&&!name.endsWith('*')));
 assert.ok(ends.every(name=>name.startsWith('animater-qa-')));
});
