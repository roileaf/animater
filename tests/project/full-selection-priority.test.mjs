import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveSpellMedia,assetGeometry} from '../../tools/spell-asset-selection.mjs';
const row=(key,name=key)=>({key:`jb2a.${key}`,file:`${key}_400x400.webm`,width:400,height:400,metadata:{name}});
test('authored matching particles win over generic metal defaults when both satisfy geometry',()=>{
 const particle=row('particles.outward.green','Particles'),dagger=row('rust_cloud','Rust Cloud metal cloud');
 const cast=row('cast_generic.metal','Casting'),bolt=row('energy_beam.metal','Beam');const db={patreon:[particle,dagger,cast,bolt],free:[particle,dagger,cast,bolt]};
 const profile={cast:'cast_generic',bolt:'energy_beam',hit:'particles',aura:'particles',area:'particles.outward'};
 const defaults={...profile,area:'rust_cloud'};
 const selected=resolveSpellMedia(db,'metal',profile,defaults,{name:'Rust Cloud',design:{pattern:'burst',assetIntent:'metal rust cloud particles'},delivery:'burst'});
 assert.deepEqual(selected.area,[particle.key]);
});
test('localized rolling boulder footage stays a sized moving object rather than directional beam',()=>{
 assert.equal(assetGeometry({key:'jb2a.rolling_boulder.loop.01.rock.brown',file:'RollingBoulderRockLoop01_01_Regular_Brown_600x600.webm',width:600,height:600}),'radial');
});
