import test from 'node:test';
import assert from 'node:assert/strict';
import {assetDatabases} from '../../tools/asset-databases.mjs';
import {resolveSpellMedia,assetGeometry} from '../../tools/spell-asset-selection.mjs';
import {reviewedUpgradeRoots} from '../../tools/jb2a-reviewed-upgrades.mjs';
import {SPELL_MOTIFS} from '../../scripts/catalogs/pf2e/spells/spell-design.mjs';
import {SPELL_THEMES} from '../../scripts/catalogs/pf2e/spells/spell-choreography.mjs';
import {selectWeaponMedia} from '../../tools/weapon-asset-selection.mjs';
import {resolveFeatMedia} from '../../tools/feat-asset-selection.mjs';
import {FEAT_MOTIFS} from '../../scripts/catalogs/pf2e/feats/feat-choreography.mjs';
import {PF2E_SPELLS,spellRecipe} from '../../scripts/catalogs/pf2e/spells/spell-catalog.mjs';
import {PF2E_FEATS,featRecipe} from '../../scripts/catalogs/pf2e/feats/feat-catalog.mjs';
const db=await assetDatabases();
const selected=(keys,edition)=>keys.find(key=>db[edition].some(r=>r.key===key));

test('new circular arrow volleys remain localized area footage',()=>{
 const row=db.patreon.find(r=>r.key==='jb2a.volley_of_projectiles_Circle.arrow.001.001.white');
 assert.ok(row);assert.equal(assetGeometry(row),'radial');
 const media=resolveSpellMedia(db,'plant',SPELL_MOTIFS.arrowAreaVolley,SPELL_THEMES.plant,{name:'Arrow Salvo',slug:'arrow-salvo',delivery:'burst',design:{pattern:'areaVolley'}});
 assert.equal(selected(media.hit,'patreon'),row.key);
 assert.equal(assetGeometry(db.free.find(r=>r.key===selected(media.hit,'free'))),'radial');
});
test('reviewed fog, web and lava upgrades preserve Free fallbacks',()=>{
 for(const [slug,motif,theme,slot,expected] of [
  ['mist','mistVeil','water','area','jb2a.ambient_fog.001.complete.large.white'],
  ['volcanic-eruption','lavaColumn','fire','area','jb2a.lava_spout.001.001.complete.orangeyellow'],
  ['personal-rain-cloud','gapB_personal_rain_cloud','water','aura','jb2a.template_square.raindrops.001.5x5.instant.combined.blue'],
 ]){
  const profile=SPELL_MOTIFS[motif];assert.ok(profile,motif);
  const media=resolveSpellMedia(db,theme,profile,SPELL_THEMES[theme],{slug,delivery:'burst',design:{pattern:profile.pattern}});
  assert.equal(selected(media[slot],'patreon'),expected);
  assert.ok(selected(media[slot],'free'));
 }
 for(const name of ['Fog Cloud','Web']){
  const media=resolveSpellMedia(db,'water',SPELL_THEMES.water,SPELL_THEMES.water,{system:'dnd5e',name,delivery:'burst'});
  assert.equal(selected(media.area,'patreon'),name==='Web'?'jb2a.web.complete.002.white':'jb2a.ambient_fog.001.complete.large.white');
  assert.ok(selected(media.area,'free'));
 }
});
test('literal upgrades never match figurative names or force/bone materials',()=>{
 for(const slug of ['web-of-eyes','web-of-influence','shadows-web','force-rain','force-barrage','bony-barrage','gravity-well']){
  for(const slot of ['cast','bolt','hit','aura','area'])assert.deepEqual(reviewedUpgradeRoots({slug},slot),[]);
 }
 assert.deepEqual(reviewedUpgradeRoots({system:'dnd5e',name:'Gravity Well',slug:'mist'},'area'),[]);
});
test('native picks and greatswords use physical weapon art with edition fallback',()=>{
 for(const [family,hands,expected]of [['pick',1,'jb2a.melee_attack.02.pickaxe.01'],['greatsword',2,'jb2a.melee_attack.03.greatsword.02'],['flail',1,'jb2a.melee_attack.01.flail.01']]){
  const result=selectWeaponMedia(db,{name:family,slug:family},{mode:'melee',family,hands,damage:'piercing',element:'physical'});
  assert.equal(result.selections.find(r=>r.edition==='patreon'&&r.slot==='contact').key,expected);
  assert.ok(result.selections.find(r=>r.edition==='free'&&r.slot==='contact'));
 }
});
test('Aerial Boomerang uses a flying slash when available and keeps wind-only fallback',()=>{
 const context={slug:'aerial-boomerang',name:'Aerial Boomerang',motif:'boomerang',direction:{shape:'outward wind terminal spiral'}};
 const media=resolveFeatMedia(db,'wind',FEAT_MOTIFS.boomerang,SPELL_THEMES.wind,context);
 assert.equal(selected(media.assets.bolt,'patreon'),'jb2a.ranged_slash.instant.001.white');
 assert.ok(selected(media.assets.bolt,'free'));
 const previous=Object.fromEntries(Object.entries(db).map(([edition,rows])=>[edition,rows.filter(r=>!r.key.startsWith('jb2a.ranged_slash.'))]));
 const fallback=resolveFeatMedia(previous,'wind',FEAT_MOTIFS.boomerang,SPELL_THEMES.wind,context);
 assert.ok(fallback.assets.bolt.every(key=>/gust_of_wind|wind_stream/.test(key)));
});
test('new area volleys fill the footprint once; supportive mist retains ancestor layer',()=>{
 const salvo=PF2E_SPELLS.find(s=>s.slug==='arrow-salvo');
 const contact=spellRecipe(salvo,undefined,{sound:false}).stages.find(s=>s.assets.some(k=>k.startsWith('jb2a.volley_of_projectiles_Circle.')));
 assert.equal(contact.scale,1);assert.equal(contact.repeats,1);
 const mist=PF2E_SPELLS.find(s=>s.slug==='halcyon-mists');
 const stages=spellRecipe(mist,undefined,{sound:false}).stages;
 assert.ok(stages.some(s=>s.assets.some(k=>k.startsWith('jb2a.ambient_fog.'))));
 assert.ok(stages.some(s=>s.assets.includes('jb2a.spirit_guardians.blueyellow.ring')));
});
test('new molten feat contacts complete their native burst instead of cutting it short',()=>{
 for(const slug of ['lava-leap','volcanic-escape']){
  const feat=PF2E_FEATS.find(f=>f.slug===slug),recipe=featRecipe(feat,{sound:false});
  const molten=recipe.stages.filter(s=>s.assets.some(k=>k.startsWith('jb2a.lava_spout.')));
  assert.ok(molten.length,slug);
  for(const stage of molten){assert.equal(stage.oneShot,true,slug);assert.ok(stage.duration>=6667+stage.fadeOut,slug);}
 }
});
