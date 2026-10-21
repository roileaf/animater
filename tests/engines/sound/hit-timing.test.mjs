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
 assert.equal(out[2].delay-cue.delay,30,'the blood keeps its place after the cue');
 const plate=alignSurfaceHits([plan[0],{...plan[1],soundFile:'plate.ogg'}],f=>peaks[f]);
 assert.equal(plate[1].delay+5-560,80,'a clang that rings at once waits for the strike');
 assert.deepEqual(alignSurfaceHits(plan,()=>null),plan,'unmeasured sounds keep their timing');
});
