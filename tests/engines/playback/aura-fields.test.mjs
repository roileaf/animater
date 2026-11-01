import test from 'node:test';
import assert from 'node:assert/strict';
import {auraLook,createAuraFields} from '../../../scripts/engines/playback/aura-fields.mjs';
import {PF2E_EFFECTS,stateRecipe} from '../../../scripts/catalogs/pf2e/state-catalog.mjs';

const look=name=>auraLook(stateRecipe(PF2E_EFFECTS.find(e=>e.name===name)));
test('each aura gets a motif from its own design, in its own colour',()=>{
 assert.equal(look('Spell Effect: Element Embodied (Fire)').motif,'flame');
 assert.equal(look('Aura: Protective Wards').motif,'hexes');
 assert.equal(look('Effect: Aura of Despair').motif,'shadow');
 assert.equal(look('Effect: Aura of Despair').inward,true,'it closes in');
 assert.equal(look('Aura: Angelic Halo').motif,'radiance');
 assert.equal(look('Effect: Soul Well').motif,'skulls');
 assert.equal(look('Effect: Overwatch Field').motif,'eyes');
 assert.equal(auraLook({name:'Plain',stages:[]}).motif,'dashes');
 assert.equal(auraLook({stages:[{auraRadius:30,assets:['jb2a.zoning.outward.circle.loop.bluegreen.01.01'],tint:'#ff0000'}]}).color,0xff0000);
});
test('the auras in the catalog use many motifs, not one',()=>{
 const motifs=new Set(PF2E_EFFECTS.filter(e=>e.auraDesign).map(e=>auraLook(stateRecipe(e)).motif));
 assert.ok(motifs.size>=8,[...motifs].join(' '));
});
test('a field follows its creature, fades in, and goes when removed',()=>{
 const added=[],removed=[],ticks=new Set();let now=0;
 class Mesh{constructor(g,shader){this.shader=shader;this.position={set:(x,y)=>{this.x=x;this.y=y;}};}}
 const PIXI={Geometry:class{addAttribute(){return this;}addIndex(){return this;}},Shader:{from:(v,f,u)=>({uniforms:{...u}})},Mesh};
 const fields=createAuraFields({PIXI,addToScene:m=>added.push(m),removeFromScene:m=>removed.push(m),ticker:{add:f=>ticks.add(f),remove:f=>ticks.delete(f)},zoom:()=>1,gridSize:()=>100,gridDistance:()=>5,now:()=>now});
 const token={w:100,h:100,center:{x:500,y:300},visible:true};
 const mesh=fields.add('k',{token,feet:30,look:{motif:'flame',color:0xff8800}});
 assert.equal(added.length,1);assert.deepEqual([mesh.x,mesh.y],[500,300]);
 assert.equal(mesh.shader.uniforms.uRadius,650,'half the token and thirty feet');
 assert.equal(mesh.shader.uniforms.uAlpha,0,'fades in');
 now=400;token.center={x:600,y:300};[...ticks][0]();
 assert.equal(mesh.x,600);assert.equal(mesh.shader.uniforms.uAlpha,1);
 fields.remove('k');assert.equal(removed.length,1);[...ticks][0]?.();assert.equal(ticks.size,0,'stops ticking when empty');
});
