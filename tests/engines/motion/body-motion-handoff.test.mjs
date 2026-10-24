import test from 'node:test';
import assert from 'node:assert/strict';
import {ConditionBody} from '../../../scripts/engines/motion/condition-body.mjs';
import {TokenMotionPlayer} from '../../../scripts/engines/motion/motion.mjs';

test('death collapse must not bake an idle or wounded pose into the revived token',async()=>{
 for(const kind of ['idle-breathe','hunch','sag','prone']){
  let now=0,id=0;const frames=new Map();
  const frame=cb=>{frames.set(++id,cb);return id;},cancel=id=>frames.delete(id);
  const point=(x,y)=>({x,y,set(x,y){this.x=x;this.y=y;}});
  const token={visible:true,w:100,center:{x:100,y:100},document:{x:50,y:50},mesh:{position:point(100,100),rotation:.2,scale:point(1.2,.8)}};
  let body;
  const motions=new TokenMotionPlayer({now:()=>now,frame,cancel,beforeStart:t=>body.restore(t)});
  body=new ConditionBody({now:()=>now,frame,cancel,busy:t=>motions.active.has(t)});
  const step=t=>{now=t;const callbacks=[...frames.values()];frames.clear();callbacks.forEach(cb=>cb(now));};
  body.add('existing',token,kind);step(650);
  assert.notEqual(token.mesh.scale.y,.8);
  const playing=motions.play(token,{motion:'collapse',duration:1800,distance:.25,intensity:.8},{x:1,y:0},'death');
  step(800);body.remove('existing',{immediate:true});step(2450);await playing;
  // Combat ended, then HP restored; the effect must leave the original sprite geometry.
  assert.equal(token.mesh.scale.y,.8,kind+' scale restored');
  assert.equal(token.mesh.rotation,.2,kind+' rotation restored');
  assert.equal(token.mesh.position.y,100,kind+' position restored');
 }
});
