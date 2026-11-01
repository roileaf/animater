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
test('a round spell area set to the Tokenshade look is tagged for every client; lines, cones and tiles keep their footage', async () => {
 const { groundTag } = await import('../../../scripts/engines/playback/aura-fields.mjs');
 const { normalizeOptions } = await import('../../../scripts/core/stage-options.mjs');
 const stage = { kind: 'template', areaLook: 'tokenshade', areaMotif: 'flame', scale: 1, assets: ['jb2a.fireball'] };
 const burst = { area: { type: 'circle', diameter: 400 } };
 assert.deepEqual(groundTag(stage, burst, { name: 'Fireball' }), { motif: 'flame', color: groundTag(stage, burst, {}).color, inward: false, radius: 200 });
 assert.equal(groundTag({ ...stage, areaMotif: 'auto' }, burst, { name: 'Sacred Circle', description: 'divine radiance' }).motif, 'radiance', 'automatic reads the animation');
 assert.equal(groundTag(stage, { area: { type: 'cone', diameter: 400 } }, {}), null);
 assert.equal(groundTag({ ...stage, areaTile: {} }, burst, {}), null);
 assert.equal(groundTag({ ...stage, areaLook: 'jb2a' }, burst, {}), null);
 assert.deepEqual(['areaLook', 'areaMotif'].map((k) => normalizeOptions({ kind: 'template', areaLook: 'tokenshade', areaMotif: 'skulls' })[k]), ['tokenshade', 'skulls']);
 assert.equal(normalizeOptions({ kind: 'impact', areaLook: 'tokenshade' }).areaLook, undefined, 'templates only');
 assert.equal(normalizeOptions({ kind: 'template' }).areaLook, undefined, 'JB2A is the unset default');
});
test('an aura never shows round a creature this screen does not draw: GM-hidden, unseen, undetected or faded out', async () => {
 const { drawn } = await import('../../../scripts/engines/playback/aura-fields.mjs');
 assert.equal(drawn({ visible: true, mesh: { visible: true, worldAlpha: 1 } }), true);
 assert.equal(drawn({ visible: false, mesh: { visible: true } }), false, 'out of sight or GM-hidden');
 assert.equal(drawn({ visible: true, mesh: { visible: false } }), false, 'its art hidden (undetected)');
 assert.equal(drawn({ visible: true, mesh: { visible: true, renderable: false } }), false);
 assert.equal(drawn({ visible: true, mesh: { visible: true, worldAlpha: 0 } }), false, 'faded out');
});
