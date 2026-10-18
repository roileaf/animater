import test from 'node:test';
import assert from 'node:assert/strict';
import {validateRecipe,planRecipe}from '../../../scripts/core/model.mjs';
import {timedStages}from '../../../scripts/engines/playback/composition.mjs';
test('sound ranges cap actual duration before linked stages and cleanup deadlines',()=>{
 const recipe=validateRecipe({id:'trim',name:'Trim',trigger:'manual',stages:[{kind:'sound',stageId:'audio',soundFile:'sounds/cue.ogg',duration:4000,clipStart:300,clipEnd:570},{kind:'cast',assets:['jb2a.impact'],afterStage:'audio',duration:1200}]});
 const timed=timedStages(recipe);assert.equal(timed[0].duration,270);assert.equal(timed[1].delay,270);
 const plan=planRecipe(recipe,[{key:'jb2a.impact'}],{source:{center:{x:0,y:0}},targets:[]});
 assert.equal(plan[0].duration,270);assert.equal(plan[1].delay,270);
});
