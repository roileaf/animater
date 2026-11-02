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
test('a round spell area set to the Tokenshade look is tagged for every client; tiles keep their footage', async () => {
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
test('a cone or line set to the Tokenshade look is drawn as waves rolling out along it', async () => {
 const { groundTag } = await import('../../../scripts/engines/playback/aura-fields.mjs');
 const stage = { kind: 'template', areaLook: 'tokenshade', scale: 1, assets: ['jb2a.breath_weapons02.burst.cone.ice'], tintEnabled: true, tint: '#e2e6f0' };
 const cone = groundTag(stage, { area: { type: 'cone', center: { x: 100, y: 100 }, endpoint: { x: 700, y: 100 }, angle: 90 } }, {});
 assert.equal(cone.wave, 'cone');
 assert.deepEqual(cone.origin, { x: 100, y: 100 }, 'from the mouth');
 assert.equal(cone.rotation, 0);assert.equal(cone.length, 600);
 assert.ok(Math.abs(cone.halfAngle - Math.PI / 4) < 1e-9);
 assert.equal(cone.color, 0xe2e6f0);
 const line = groundTag(stage, { area: { type: 'line', center: { x: 100, y: 100 }, endpoint: { x: 100, y: 900 }, width: 100 } }, {});
 assert.equal(line.wave, 'line');assert.ok(Math.abs(line.rotation - Math.PI / 2) < 1e-9);assert.equal(line.halfWidth, 50);
 assert.equal(groundTag(stage, { area: { type: 'cone', diameter: 400 } }, {}), null, 'no geometry, no field');
});
test('a wave field lies at the mouth along its breath, rolls out over time, and fades', () => {
 const added=[],ticks=new Set();let now=0;
 class Mesh{constructor(g,shader){this.shader=shader;this.rotation=0;this.position={set:(x,y)=>{this.x=x;this.y=y;}};}}
 const PIXI={Geometry:class{addAttribute(){return this;}addIndex(){return this;}},Shader:{from:(v,f,u)=>({fragment:f,uniforms:{...u}})},Mesh};
 const fields=createAuraFields({PIXI,addToScene:m=>added.push(m),removeFromScene(){},ticker:{add:f=>ticks.add(f),remove:f=>ticks.delete(f)},zoom:()=>1,gridSize:()=>100,gridDistance:()=>5,now:()=>now});
 const anchor={center:{x:0,y:0},w:0,visible:true};
 const mesh=fields.add('w',{token:anchor,radius:600,wave:{wave:'cone',origin:{x:100,y:200},rotation:0.5,length:600,halfAngle:0.7,color:0xe2e6f0}});
 assert.deepEqual([mesh.x,mesh.y],[100,200]);assert.equal(mesh.rotation,0.5);
 const u=mesh.shader.uniforms;assert.equal(u.uLength,600);assert.equal(u.uShape,1);assert.equal(u.uHalfAngle,0.7);
 assert.match(mesh.shader.fragment,/uHalfAngle/);
 now=500;[...ticks][0]();assert.equal(mesh.shader.uniforms.uTime,0.5,'the waves roll on');
});
test('a swarm drawn by Tokenshade: round a creature, over a round area, or pouring out along a cone or line', async () => {
 const { groundTag } = await import('../../../scripts/engines/playback/aura-fields.mjs');
 const { normalizeOptions } = await import('../../../scripts/core/stage-options.mjs');
 const swarm = { areaLook: 'tokenshade', areaMotif: 'swarm', scale: 1, assets: ['jb2a.particles.swirl.greenyellow.01.01'], tintEnabled: true, tint: '#3a2a10' };
 const onCreature = groundTag({ ...swarm, kind: 'impact' }, {}, {}, { grid: 100 });
 assert.equal(onCreature.swarm, 'circle');assert.equal(onCreature.follow, true);assert.ok(onCreature.radius >= 60 && onCreature.radius <= 100, `about the creature, ${onCreature.radius}`);
 assert.equal(onCreature.color, 0x3a2a10);
 assert.equal(groundTag({ ...swarm, kind: 'template' }, { area: { type: 'circle', diameter: 600 } }, {}, { grid: 100 }).radius, 300);
 const cone = groundTag({ ...swarm, kind: 'template' }, { area: { type: 'cone', center: { x: 0, y: 0 }, endpoint: { x: 0, y: 500 }, angle: 60 } }, {}, { grid: 100 });
 assert.equal(cone.swarm, 'cone');assert.equal(cone.length, 500);assert.ok(Math.abs(cone.rotation - Math.PI / 2) < 1e-9);
 // The swarm motif may be set on a creature's stage; any other Tokenshade look stays for areas.
 assert.deepEqual(['areaLook', 'areaMotif'].map((k) => normalizeOptions({ kind: 'impact', areaLook: 'tokenshade', areaMotif: 'swarm' })[k]), ['tokenshade', 'swarm']);
 assert.equal(normalizeOptions({ kind: 'impact', areaLook: 'tokenshade', areaMotif: 'flame' }).areaLook, undefined);
});
test('a swarm field circles its creature as it moves, or lies along its cone', () => {
 const ticks=new Set();let now=0;
 class Mesh{constructor(g,shader){this.shader=shader;this.rotation=0;this.visible=true;this.position={set:(x,y)=>{this.x=x;this.y=y;}};}}
 const PIXI={Geometry:class{addAttribute(){return this;}addIndex(){return this;}},Shader:{from:(v,f,u)=>({fragment:f,uniforms:{...u}})},Mesh};
 const fields=createAuraFields({PIXI,addToScene(){},removeFromScene(){},ticker:{add:f=>ticks.add(f),remove:f=>ticks.delete(f)},zoom:()=>1,gridSize:()=>100,gridDistance:()=>5,now:()=>now});
 const token={w:100,h:100,center:{x:300,y:300},visible:true};
 const mesh=fields.add('s',{token,radius:80,swarm:{swarm:'circle',radius:80,color:0x3a2a10}});
 assert.deepEqual([mesh.x,mesh.y],[300,300]);assert.match(mesh.shader.fragment,/uDensity/);assert.equal(mesh.shader.uniforms.uShape,2);
 now=300;token.center={x:340,y:300};[...ticks][0]();assert.equal(mesh.x,340,'it follows the creature');
 const cone=fields.add('c',{token,radius:500,swarm:{swarm:'cone',origin:{x:0,y:0},rotation:1,length:500,halfAngle:0.5,color:0x3a2a10}});
 assert.deepEqual([cone.x,cone.y,cone.rotation],[0,0,1]);assert.equal(cone.shader.uniforms.uShape,1);
});
test('an aura never shows round a creature this screen does not draw: GM-hidden, unseen, undetected or faded out', async () => {
 const { drawn } = await import('../../../scripts/engines/playback/aura-fields.mjs');
 assert.equal(drawn({ visible: true, mesh: { visible: true, worldAlpha: 1 } }), true);
 assert.equal(drawn({ visible: false, mesh: { visible: true } }), false, 'out of sight or GM-hidden');
 assert.equal(drawn({ visible: true, mesh: { visible: false } }), false, 'its art hidden (undetected)');
 assert.equal(drawn({ visible: true, mesh: { visible: true, renderable: false } }), false);
 assert.equal(drawn({ visible: true, mesh: { visible: true, worldAlpha: 0 } }), false, 'faded out');
});
