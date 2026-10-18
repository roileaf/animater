import test from 'node:test';
import assert from 'node:assert/strict';
import {PF2E_SPELLS,spellRecipe} from '../../scripts/catalogs/pf2e/spells/spell-catalog.mjs';
import {SPELL_MOTIFS} from '../../scripts/catalogs/pf2e/spells/spell-design.mjs';
import {resolveSpellMedia} from '../../tools/spell-asset-selection.mjs';

const grim=PF2E_SPELLS.find(s=>s.slug==='grim-tendrils');

test('Grim Tendrils sends dark curling strands through the native line, without assumed save outcomes',()=>{
  const recipe=spellRecipe(grim),lines=recipe.stages.filter(s=>s.kind==='template');
  assert.deepEqual(recipe.previewArea,{type:'line',value:30});
  assert.equal(recipe.trigger,'template');
  assert.equal(lines.length,2,'A group of curling tendrils and a separate winding strand');
  assert.equal(lines[0].assets[0],'jb2a.energy_strands.range.multiple.dark_purple02.01');
  assert.equal(lines[1].assets[0],'jb2a.energy_strands.range.standard.dark_purple02.01');
  assert.ok(lines[0].assets.includes('jb2a.energy_strands.range.multiple.purple.01'));
  assert.ok(lines[1].assets.includes('jb2a.energy_strands.range.standard.purple.01'));
  for(const line of lines){
    assert.equal(line.areaLayout,'fit');
    assert.equal(line.oneShot,true);
    assert.equal(line.tintEnabled,true);
    assert.equal(line.colorize,true,'Free footage needs the same dark treatment');
    assert.ok(line.playbackRate>=.8&&line.playbackRate<1);
    assert.equal(line.opacity,1);
    assert.equal(line.persist,false);
  }
  assert.ok(lines[1].delay>lines[0].delay);
  const origin=recipe.stages.find(s=>s.kind==='cast');
  assert.ok(origin.assets.includes('jb2a.arms_of_hadar.dark_purple'));
  assert.ok(origin.clipEnd>0&&origin.clipEnd<=800,'Origin curl is deliberately clipped, not a lingering field');
  assert.ok(!recipe.stages.some(s=>s.kind==='impact'||s.kind==='motion'&&s.subject==='targets'));
  const gesture=recipe.stages.find(s=>s.kind==='motion');
  assert.equal(gesture.subject,'source');
  assert.ok(gesture.duration>=800);
  const effectsOnly=spellRecipe(grim,undefined,{motion:false});
  assert.ok(effectsOnly.stages.every(s=>s.kind!=='motion'));
  assert.deepEqual(effectsOnly.stages.filter(s=>s.kind==='template'),lines);
});

test('regeneration keeps reviewed tendril footage and the compatible Free fallback',()=>{
  const row=key=>({key:'jb2a.'+key,file:'modules/test/strand_15ft_1000x400.webm',width:1000,height:400,template:[200,200,200]});
  const local=key=>({key:'jb2a.'+key,file:'modules/test/local_400x400.webm',width:400,height:400});
  const locals=['arms_of_hadar.dark_purple','impact.001.purple','energy_field.01.purple'].map(local);
  const db={patreon:[...locals,row('energy_strands.range.multiple.dark_greenpurple.02'),row('energy_strands.range.multiple.dark_purple02.01'),row('energy_strands.range.standard.dark_purple02.01')],
    free:[...locals,row('energy_strands.range.multiple.purple.01'),row('energy_strands.range.standard.purple.01')]};
  const assets=resolveSpellMedia(db,grim.theme,SPELL_MOTIFS[grim.design.motif],{cast:'arms_of_hadar',hit:'impact',aura:'energy_field'},
    {slug:grim.slug,name:grim.name,design:grim.design,delivery:'line',area:grim.area});
  assert.deepEqual(assets.area,['jb2a.energy_strands.range.multiple.dark_purple02.01','jb2a.energy_strands.range.multiple.purple.01']);
  assert.deepEqual(assets.bolt,['jb2a.energy_strands.range.standard.dark_purple02.01','jb2a.energy_strands.range.standard.purple.01']);
});
