import test from 'node:test';
import assert from 'node:assert/strict';
import {peakOf,alignSurfaceHits} from '../../../scripts/engines/sound/hit-timing.mjs';

test('the loudest moment of a decoded sound',()=>{
 const data=new Float32Array(44100*.5);for(let i=13230;i<13230+441;i++)data[i]=.9;
 assert.ok(Math.abs(peakOf({sampleRate:44100,getChannelData:()=>data})-300)<=5,'within one 5 ms window');
 assert.equal(peakOf(null),null);
});
test("each surface hit lands clearly after the weapon's own, its layers with it",()=>{
 const t={id:'t'},peaks={'strike.ogg':60,'crunch.ogg':325,'plate.ogg':5};
 const plan=[{kind:'sound',stageId:'audio',soundFile:'strike.ogg',delay:500,destination:t},
  {kind:'sound',stageId:'hit-surface',soundFile:'crunch.ogg',delay:510,surfaceJitter:10,surfaceRole:'cue',destination:t},
  {kind:'sound',stageId:'hit-surface-blood',soundFile:'blood.ogg',delay:540,surfaceRole:'blood',destination:t}];
 const out=alignSurfaceHits(plan,f=>peaks[f]??null);
 const cue=out[1];assert.equal(cue.delay+325-(500+60),80,'the crunch peaks 70 ms + its jitter after the strike');
 assert.equal(out[2].delay-cue.delay,30,'an unmeasured layer keeps its place after the cue');
 const plate=alignSurfaceHits([plan[0],{...plan[1],soundFile:'plate.ogg'}],f=>peaks[f]);
 assert.equal(plate[1].delay+5-560,80,'a clang that rings at once waits for the strike');
 assert.deepEqual(alignSurfaceHits(plan,()=>null),plan,'unmeasured sounds keep their timing');
});

test("a melee swing sound lands where the clip connects, and a shot's impact as it arrives",()=>{
 const t={id:'t'},peaks={'whoosh.ogg':195,'flesh.ogg':80,'thunk.ogg':230,'blood.ogg':20};
 const swing=[{kind:'impact',stageId:'w-melee-contact',delay:625,duration:2017,asset:'jb2a.handaxe.melee.standard.white',subject:'source'},
  {kind:'sound',stageId:'audio-w-melee-0-0',afterStage:'w-melee-contact',soundFile:'whoosh.ogg',delay:625,subject:'source'},
  {kind:'sound',stageId:'w-melee-contact-surface',afterStage:'w-melee-contact',soundFile:'flesh.ogg',delay:625,surfaceRole:'cue',destination:t},
  {kind:'sound',stageId:'w-melee-contact-surface-blood',soundFile:'blood.ogg',delay:665,surfaceRole:'blood',destination:t}];
 const out=alignSurfaceHits(swing,f=>peaks[f]);
 const connects=625+2017*.71;
 assert.ok(Math.abs(out[1].delay+195-connects)<=1,'the axe sound hits as the clip connects');
 assert.ok(Math.abs(out[2].delay+80-(connects+70))<=1,'the body answers 70 ms later');
 assert.ok(out[3].delay+20>out[2].delay+80,'blood after the body, not before');
 const shot=[{kind:'impact',stageId:'b-ranged-accent',delay:1275,duration:1450,asset:'jb2a.impact.001',subject:'targets'},
  {kind:'sound',stageId:'audio-b-ranged-1-0',afterStage:'b-ranged-accent',soundFile:'thunk.ogg',delay:1275,subject:'source'}];
 assert.equal(alignSurfaceHits(shot,f=>peaks[f])[1].delay+230,1275,'the arrow thunks as it arrives');
 // A spell's sound keeps its own build-up.
 const spell=[shot[0],{...shot[1],stageId:'audio-s-feat-1-0'}];
 assert.equal(alignSurfaceHits(spell,f=>peaks[f])[1].delay,1275);
});
