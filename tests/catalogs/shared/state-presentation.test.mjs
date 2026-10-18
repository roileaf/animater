import test from 'node:test';
import assert from 'node:assert/strict';
import {statePresentation} from '../../../scripts/catalogs/shared/state-presentation.mjs';
import {PF2E_EFFECTS,PF2E_CONDITIONS,stateRecipe} from '../../../scripts/catalogs/pf2e/state-catalog.mjs';
import {SF2E_ENTRIES} from '../../../data/sf2e-catalog.mjs';

test("a lasting Hunter's Mark is a small corner badge, never a sheet over the token's face",()=>{
 const p=statePresentation({assets:['jb2a.hunters_mark.loop.06.green']});
 assert.ok(p.scale<=.4);assert.equal(p.below,false);assert.equal(p.offsetUnits,'token');
 assert.ok(p.offsetX>0&&p.offsetY<0,'top-right corner');assert.ok(Math.abs(p.offsetX)+p.scale/2<=.5,'inside its own square');
});
test("no PF2e or SF2e lasting state draws Hunter's Mark larger than a badge (SF2e Get 'Em! hid tokens under a glyph)",()=>{
 const states=[...PF2E_CONDITIONS,...PF2E_EFFECTS,...(SF2E_ENTRIES??[]).filter(e=>['condition','effect'].includes(e.kind))];
 for(const e of states){const r=e.state?{stages:e.variants?.[0]?.recipe?.stages??[]}:stateRecipe(e);
  for(const s of r.stages??[])if((s.assets??[]).some(a=>/hunters_mark\.loop/.test(a)))assert.ok(s.scale<=.4,`${e.name}: ${s.scale}`);}
});
import {coversToken} from '../../../scripts/catalogs/shared/state-presentation.mjs';
test('lasting web, smoke, fog, sparkle, flame, orb, dome and marker layers at token size draw under the token',()=>{
 for(const a of ['jb2a.web.01','jb2a.fumes.04.loop.green','jb2a.sleep.cloud.01.blue','jb2a.twinkling_stars.points06.orange','jb2a.flames.01.orange','jb2a.lightning_orb.01.loop.bluepurple','jb2a.shield.01.loop.blue','jb2a.vine.loop.nature.group.01.green','jb2a.markers.light_orb.loop.yellow'])
  assert.equal(coversToken({scale:1.4,below:false},a),true,a);
 assert.equal(coversToken({scale:1.5,below:false},'jb2a.markers.chain.standard.loop.02.grey'),false,'chain rings stay on top');
 assert.equal(coversToken({scale:.62,offsetY:-.24},'jb2a.fog_cloud.01.white'),false,"Blinded's small blindfold over the eyes is deliberate");
 assert.equal(coversToken({scale:1.4},'jb2a.magic_signs.circle.02.abjuration.loop.blue'),false,'open glyph rings stay on top');
 assert.equal(coversToken({scale:1.4,below:true},'jb2a.web.01'),false,'already under');
});
import {hollowFootage} from '../../../scripts/catalogs/shared/state-presentation.mjs';
test('hollow footage: rings and markers are hollow, webs, smoke and sparkles fill the frame',()=>{
 for(const a of ['jb2a.markers.music.greenorange','jb2a.markers.light_orb.loop.yellow','jb2a.token_border.circle.static.orange.006','jb2a.condition.curse.01.012.purple','jb2a.magic_signs.circle.02.abjuration.loop.blue','jb2a.template_circle.aura.03.outward.005.loop.combined.blue','jb2a.fire_ring.500px.red'])
  assert.equal(hollowFootage(a),true,a);
 for(const a of ['jb2a.web.01','jb2a.fumes.04.loop.green','jb2a.twinkling_stars.points06.orange','jb2a.shield.01.loop.blue'])assert.equal(hollowFootage(a),false,a);
});
