import test from 'node:test';
import assert from 'node:assert/strict';
import {underwaterPose,underwaterTint} from '../../../scripts/engines/motion/underwater-appearance.mjs';
import {poseMesh} from '../../../scripts/engines/motion/burrow-sink.mjs';
import {underwaterBubbles,surfaceSplash,createMovementFeel} from '../../../scripts/engines/motion/movement-feel.mjs';
test('underwater opacity fades to a silhouette and restores the native alpha without stacking',()=>{
 const mesh={alpha:.8},surface=underwaterPose(0),deep=underwaterPose(1);
 assert.equal(surface.alpha,1);assert.equal(deep.alpha,.35);assert.ok(underwaterPose(.5).alpha>.35);
 let record=poseMesh(mesh,deep);for(let n=0;n<30;n++)record=poseMesh(mesh,deep,record);assert.ok(Math.abs(mesh.alpha-.28)<1e-8);
 record=poseMesh(mesh,surface,record);assert.equal(mesh.alpha,.8);assert.equal(record,null);
 assert.equal(underwaterPose(1,.5).alpha,.5);
});
test('water tint preserves native color, follows native refreshes, and never overwrites another tint on removal',()=>{
 const mesh={tint:0xffddaa};let record=underwaterTint(mesh,1);const wet=mesh.tint;
 assert.notEqual(wet,0xffddaa);for(let n=0;n<20;n++)record=underwaterTint(mesh,1,record);assert.equal(mesh.tint,wet);
 underwaterTint(mesh,0,record);assert.equal(mesh.tint,0xffddaa);
 record=underwaterTint(mesh,1);mesh.tint=0xabcdef;underwaterTint(mesh,0,record);assert.equal(mesh.tint,0xabcdef);
 record=underwaterTint(mesh,1,record);underwaterTint(mesh,0,record);assert.equal(mesh.tint,0xabcdef);
});
test('underwater bubbles are clearly sized and scale with the creature while staying bounded',()=>{
 const small=underwaterBubbles({x:0,y:0},{grid:100,width:100}),large=underwaterBubbles({x:0,y:0},{grid:100,width:400});
 assert.equal(small.length,5);assert.ok(small.every(p=>p.radius>=6.5&&p.radius<=11&&p.alpha>=.75));
 assert.ok(large[0].radius>small[0].radius);assert.ok(large.every(p=>p.radius<30));
});
test('surfacing creates one large size-scaled splash, including stationary elevation changes, never on initial draw or hidden tokens',()=>{
 const medium=surfaceSplash({x:100,y:200}),large=surfaceSplash({x:100,y:200},{width:400});
 assert.equal(medium.length,27);assert.equal(medium.filter(p=>p.kind==='ring').length,3);
 assert.ok(large[0].radius>medium[0].radius*3);
 let clock=0;const specs=[],token={id:'swimmer',x:100,y:200,width:100,elevation:-10,base:0,action:'swim',visible:true};
 const feel=createMovementFeel({tokens:()=>[token],now:()=>clock,grid:()=>100,density:()=>1,enabled:()=>true,floorAt:()=> 'water',layer:{addParticle:p=>{specs.push(p);return {};},updateParticle(){},removeParticle(){},addShadow(){},updateShadow(){},removeShadow(){},clear(){}}});
 feel.tick();assert.equal(specs.length,0);
 token.elevation=0;clock=100;feel.tick();assert.equal(specs.filter(p=>p.surfaceSplash).length,27);
 clock=200;feel.tick();assert.equal(specs.length,27);
 token.elevation=-10;feel.tick();token.visible=false;token.elevation=0;feel.tick();assert.equal(specs.length,27);
});
