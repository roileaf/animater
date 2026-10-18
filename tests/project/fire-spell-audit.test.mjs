import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PF2E_SPELLS,spellRecipe} from '../../scripts/catalogs/pf2e/spells/spell-catalog.mjs';
import {fireBodyIdentity} from '../../tools/audit-fire-spells.mjs';
import {FIRE_SPELL_MOTIFS} from '../../scripts/catalogs/pf2e/spells/spell-fire-designs.mjs';
import {assetGeometry} from '../../tools/spell-asset-selection.mjs';
import {SPELL_SOUND_DESIGNS} from '../../data/spell-sounds.mjs';
import {catalogFxDesign} from '../../scripts/catalogs/shared/catalog-fx.mjs';
const audit=JSON.parse(await readFile(new URL('../../data/pf2e-spell-variety-audit.json',import.meta.url),'utf8'));
const get=name=>PF2E_SPELLS.find(s=>s.name===name);
const recipe=name=>spellRecipe(get(name),undefined,{motion:false,sound:false,fx:false});
test('drought, burning blossoms and dehydration have different main effects in both editions',()=>{
 for(const [edition,rows] of Object.entries(audit.editionAssets)){
  const names=['Breath of Drought','Burning Blossoms','Dehydrate'];
  assert.equal(new Set(names.map(n=>fireBodyIdentity(recipe(n),rows))).size,names.length,edition);
 }
});
test('nonexplosive heat, petals, vapor, ashes and deferred dust do not detonate on cast',()=>{
 for(const name of ['Breath of Drought','Burning Blossoms','Dehydrate','Explosive Dust','Incendiary Fog','Incendiary Ashes','Wildfire'])
  assert.ok(!recipe(name).stages.some(s=>s.assets.some(k=>k.includes('fireball.explosion'))),name);
});
test('burning blossoms grows a canopy and drifts petals through its native footprint',()=>{
 const r=recipe('Burning Blossoms');
 assert.equal(r.previewArea.value,30);
 assert.ok(r.stages.some(s=>s.kind==='template'&&s.assets.some(k=>k.includes('plant_growth'))));
 assert.ok(r.stages.some(s=>s.assets.some(k=>k.includes('swirling_leaves'))&&s.tracks.some(t=>t.property==='position.y'&&t.from<t.to)));
});
test('Free-edition rays and cones retain different material compositions',()=>{
 const rows=audit.editionAssets.free;
 for(const names of [['Blazing Bolt','Fire Ray','Sun Blade'],['Breathe Fire','Plasma Whirl','Rejuvenating Flames']])
  assert.equal(new Set(names.map(n=>fireBodyIdentity(recipe(n),rows))).size,names.length,names.join(', '));
});
test('entire reported fire cohort has different bodies with caster, timing and scale changes ignored',async()=>{
 const baseline=JSON.parse(await readFile(new URL('../../data/fire-spell-audit-before.json',import.meta.url),'utf8'));
 const spells=baseline.records.map(r=>PF2E_SPELLS.find(s=>s.id===r.id));
 assert.equal(spells.length,79);
 for(const [edition,rows] of Object.entries(audit.editionAssets))
  assert.equal(new Set(spells.map(s=>{
   const r=spellRecipe(s,undefined,{motion:false,sound:false,fx:false});
   // An opening caster cue cannot make an otherwise shared body distinct.
   r.stages=r.stages.filter((stage,i)=>i!==0||stage.kind!=='cast');
   return fireBodyIdentity(r,rows);
  })).size,79,edition);
});
test('reviewed fire materials resolve matching geometry and complete measured lifetimes in both editions',()=>{
 for(const spell of PF2E_SPELLS.filter(s=>FIRE_SPELL_MOTIFS[s.design.motif])){
  const r=spellRecipe(spell,undefined,{motion:false,sound:false,fx:false});
  for(const [edition,rows]of Object.entries(audit.editionAssets)){
   const keys=new Map(rows.map(row=>[row.key,row]));
   for(const s of r.stages.filter(s=>s.assets.length)){
    const key=s.assets.find(k=>keys.has(k));assert.ok(key,`${spell.name}/${edition}`);
    const shape=assetGeometry(keys.get(key));
    if(s.kind==='travel')assert.equal(shape,'beam',`${spell.name}/${edition}: ray`);
    else if(shape==='cone')assert.equal(s.kind,'template',`${spell.name}/${edition}: cone`);
    else assert.equal(shape,'radial',`${spell.name}/${edition}: centered directional film`);
    const slot=Object.keys(spell.design.assets).find(k=>JSON.stringify(spell.design.assets[k])===JSON.stringify(s.assets));
    const lifetime=spell.design.mediaTiming[slot]?.duration;
    assert.ok(lifetime>0,`${spell.name}/${edition}: ${slot} not measured`);
    assert.ok(s.duration+1>=lifetime/(s.playbackRate??1)+s.fadeOut,`${spell.name}/${edition}: ${slot} cut off`);
   }
  }
 }
});
test('dry heat and unignited clouds are quiet and do not burn or move tokens automatically',()=>{
 for(const name of ['Breath of Drought','Dehydrate','Explosive Dust','Incendiary Fog','Incendiary Ashes']){
  const spell=get(name);
  assert.equal(SPELL_SOUND_DESIGNS[spell.id].profile,'',name);
  assert.ok(!spellRecipe(spell).stages.some(s=>s.kind==='motion'),name);
  if(name!=='Dehydrate')assert.ok(!catalogFxDesign(recipe(name),spell).some(s=>s.fxProfile==='fire'),name);
 }
 assert.equal(SPELL_SOUND_DESIGNS[get('Geyser').id].profile,'water');
 assert.equal(SPELL_SOUND_DESIGNS[get('Fire Ray').id].profile,'fireRay');
 assert.equal(SPELL_SOUND_DESIGNS[get('Sun Blade').id].profile,'radiantRay');
});
test('forming elemental creatures and later hazardous ground does not burn selected tokens now',()=>{
 for(const name of ['Elemental Confluence','Burning Blossoms','Wildfire']){
  const spell=get(name),r=recipe(name);
  assert.ok(r.stages.some(s=>s.kind==='template'&&s.assets.some(k=>/flames/.test(k))),name);
  assert.ok(!catalogFxDesign(r,spell).some(s=>s.kind==='tokenfx'),name);
 }
});
