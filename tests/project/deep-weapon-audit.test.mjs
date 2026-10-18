import test from 'node:test';
import assert from 'node:assert/strict';
import {weaponSources} from '../../tools/pf2e-weapon-source.mjs';
import {analyzeWeapon} from '../../tools/weapon-semantics.mjs';
import {selectWeaponMedia} from '../../tools/weapon-asset-selection.mjs';
import {weaponRecipe,PF2E_WEAPONS} from '../../scripts/catalogs/pf2e/weapons/weapon-catalog.mjs';
import {motionPose} from '../../scripts/engines/motion/motion.mjs';
import {payloadAppearance} from '../../scripts/catalogs/pf2e/weapons/weapon-payloads.mjs';
const sources=await weaponSources();
const fromSource=name=>{const row=sources.weapons.find(w=>w.source.name===name);assert.ok(row,name);return analyzeWeapon(row.source,row.path);};
const media=(key,geometry='radial')=>({key:'jb2a.'+key,file:geometry==='projectile'?'Regular_White_15ft_1000x400.webm':'Weapon_800x600.webm',width:geometry==='projectile'?1000:800,height:geometry==='projectile'?400:600});

test('native weapon identity outranks damage type for shortswords and katana',()=>{
 for(const [name,family]of [['Shortsword','shortsword'],['Gloom Blade','shortsword'],['Blade of Four Energies','shortsword'],['Katana','katana'],['Wakizashi','shortsword'],['Sickle','sickle'],['Scythe','scythe'],['Butterfly Sword','butterflysword']])assert.equal(fromSource(name).modes[0].family,family,name);
 assert.equal(fromSource('Rapier').modes[0].family,'rapier');
});

test('optional transformation lists do not replace native Strike construction',()=>{
 assert.equal(fromSource('Serithtial').modes[0].family,'sword');
});

test('full bomb descriptions distinguish fungal growth, expanding foam and silver filings',()=>{
 assert.equal(fromSource('Pernicious Spore Bomb (Lesser)').modes[0].payload.style,'spores');
 assert.equal(fromSource('Boulder Seed').modes[0].payload.style,'foam');
 assert.equal(fromSource('Silver Orb (Lesser)').modes[0].payload.element,'silver');
 assert.equal(fromSource('Pressure Bomb (Lesser)').modes[0].payload.style,'pressure');
});

test('permanent fire enchantments select native flame weapon footage before neutral weapon film',()=>{
 const w=fromSource('Searing Blade'),m=w.modes[0];
 const db=[media('sword.melee.fire.orange'),media('sword.melee.01.white'),media('impact.fire.01.orange')];
 const selected=selectWeaponMedia({patreon:db},w,m);
 assert.deepEqual(selected.assets.contact,['jb2a.sword.melee.fire.orange']);
});

test('enchanted bow shots retain physical arrow identity and native elemental trail',()=>{
 const w=fromSource('Shortbow'),m={...w.modes[0],element:'cold',elements:['cold']};
 const db=[media('arrow.cold.blue','projectile'),media('arrow.physical.white.01','projectile'),media('impact.frost.white.01')];
 assert.deepEqual(selectWeaponMedia({patreon:db},w,m).assets.flight,['jb2a.arrow.cold.blue']);
});

test('returning boomerangs retain boomerang artwork instead of changing into a dagger',()=>{
 const w=fromSource('Boomerang'),m={...w.modes[0],returning:true};
 const db=[media('boomerang.01.white.01.throw','projectile'),media('boomerang.01.white.01.return','projectile'),media('dagger.return.01.white','projectile'),media('impact.001.white')];
 assert.deepEqual(selectWeaponMedia({patreon:db},w,m).assets.return,['jb2a.boomerang.01.white.01.return']);
});

test('native fire color keeps its highlights while off-color edition fallback is corrected',()=>{
 assert.notEqual(payloadAppearance('fire',['jb2a.fireball.explosion.orange']).colorize,true);
 assert.equal(payloadAppearance('acid',['jb2a.liquid.splash.green','jb2a.liquid.splash.blue']).colorize,true);
});

test('weapon token gestures show readable contact motion and gun recoil starts with discharge',()=>{
 const sword=PF2E_WEAPONS.find(w=>w.slug==='longsword');
 const r=weaponRecipe(sword,'melee'),motion=r.stages.find(s=>s.kind==='motion'),hit=r.stages.find(s=>s.kind==='impact');
 const pose=motionPose(motion,(hit.delay-motion.delay)/motion.duration,{x:1,y:0},100);
 assert.ok(pose.x>=12&&pose.x<=25,'melee contact needs noticeable restrained movement, not 2–3px');
 const gun=weaponRecipe(PF2E_WEAPONS.find(w=>w.slug==='arquebus'),'ranged');
 const recoil=gun.stages.find(s=>s.kind==='motion'),flight=gun.stages.find(s=>s.kind==='travel');
 assert.equal(recoil.motion,'recoil');assert.equal(recoil.delay,flight.delay);
});
