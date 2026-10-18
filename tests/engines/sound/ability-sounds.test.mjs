import test from 'node:test';
import assert from 'node:assert/strict';
import {PF2E_FEATS,featRecipe} from '../../../scripts/catalogs/pf2e/feats/feat-catalog.mjs';
import {PF2E_WEAPONS,weaponRecipe} from '../../../scripts/catalogs/pf2e/weapons/weapon-catalog.mjs';
import {ABILITY_SOUND_PROFILES,FEAT_SOUND_DESIGNS,WEAPON_SOUND_DESIGNS} from '../../../data/ability-sounds.mjs';
import {installedSoundCatalog,prepareRecipeSounds} from '../../../scripts/engines/sound/spell-sounds.mjs';
import {timedStages} from '../../../scripts/engines/playback/composition.mjs';
import {featSoundDirection} from '../../../tools/ability-sound-semantics.mjs';
import {addAbilitySounds} from '../../../scripts/engines/sound/ability-sounds.mjs';
import {repeatStride} from '../../../scripts/core/stage-options.mjs';
const allSounds={resolve:c=>({...c,duration:c.duration??1000})};
test('active feat sound settings produce real audio stages',()=>{
 const feat=PF2E_FEATS.find(f=>f.slug==='double-slice');
 const recipe=featRecipe(feat,{soundCatalog:allSounds});
 assert.ok(recipe.stages.some(s=>s.kind==='sound'),'Double Slice must include synchronized optional weapon cues');
});
test('paired feat sounds follow each distinct blade contact and catalog volume',()=>{
 const feat=PF2E_FEATS.find(f=>f.slug==='double-slice');
 const recipe=featRecipe(feat,{soundCatalog:allSounds,soundVolume:.2});
 const sounds=recipe.stages.filter(s=>s.kind==='sound');assert.equal(sounds.length,2);
 const timed=timedStages(recipe);
 for(const s of sounds){assert.equal(s.volume,.2*(s.optionalSound.gain??1));assert.equal(timed.find(t=>t.stageId===s.stageId).delay,timed.find(t=>t.stageId===s.afterStage).delay);}
 assert.equal(featRecipe(feat).stages.filter(s=>s.kind==='sound').length,0);
 assert.equal(prepareRecipeSounds(recipe,{resolve:()=>null}).stages.filter(s=>s.kind==='sound').length,0);
});
test('optional weapon audio follows the selected use and release/contact timing',()=>{
 const w=PF2E_WEAPONS.find(w=>w.slug==='dagger');
 const melee=weaponRecipe(w,'melee',{soundCatalog:allSounds}),thrown=weaponRecipe(w,'thrown',{soundCatalog:allSounds});
 assert.ok(melee.stages.some(s=>s.kind==='sound'&&s.label==='Dagger contact'));
 assert.ok(thrown.stages.some(s=>s.kind==='sound'&&s.label==='Dagger release'));
 assert.ok(thrown.stages.some(s=>s.kind==='sound'&&s.label==='Dagger contact'));
 assert.notEqual(WEAPON_SOUND_DESIGNS[`${w.id}:melee`].profile,WEAPON_SOUND_DESIGNS[`${w.id}:thrown`].profile);
});
test('audio registration resolves active pack candidates and rechecks late database availability',()=>{
 const candidate=ABILITY_SOUND_PROFILES.sword[0].candidates.find(c=>c.module==='ggg');
 const modules=new Map([['ggg',{active:true}]]);let ready=false;
 const db={entryExists:()=>ready,getAllFileEntries:()=>[{file:candidate.file}]};
 assert.equal(installedSoundCatalog(modules,db).resolve(candidate),null);ready=true;
 assert.equal(installedSoundCatalog(modules,db).resolve(candidate).file,candidate.file);
 modules.get('ggg').active=false;assert.equal(installedSoundCatalog(modules,db).resolve(candidate),null);
});
test('every active feat has a full-description audio decision; silent activities never invent noise',()=>{
 assert.equal(Object.keys(FEAT_SOUND_DESIGNS).length,PF2E_FEATS.length);
 for(const f of PF2E_FEATS){assert.equal(FEAT_SOUND_DESIGNS[f.id].descriptionHash,f.descriptionHash);assert.ok(FEAT_SOUND_DESIGNS[f.id].reason);}
 const sample=PF2E_FEATS.find(f=>f.slug==='double-slice');
 assert.equal(featSoundDirection({...sample,name:'Silent Blade',traits:['subtle']}).profile,'');
 assert.equal(FEAT_SOUND_DESIGNS[PF2E_FEATS.find(f=>f.slug==='running-reload').id].profile,'');
 assert.equal(FEAT_SOUND_DESIGNS[PF2E_FEATS.find(f=>f.slug==='battle-medicine').id].profile,'');
 assert.equal(FEAT_SOUND_DESIGNS[PF2E_FEATS.find(f=>f.slug==='cornered-animal').id].profile,'unarmed');
 assert.equal(FEAT_SOUND_DESIGNS[PF2E_FEATS.find(f=>f.slug==='alchemical-shot').id].profile,'ranged');
});
test('audio does not silently disappear from previously full eight-stage feat designs',()=>{
 for(const f of PF2E_FEATS){const r=featRecipe(f,{soundCatalog:allSounds});assert.ok(r.stages.length<=12);if(FEAT_SOUND_DESIGNS[f.id].profile)assert.ok(r.stages.some(s=>s.kind==='sound'),f.name);}
});
test('repeated contact cues keep visual cadence when audio has a shorter duration',()=>{
 const f=PF2E_FEATS.find(f=>f.slug==='double-slice');
 for(const interval of [0,500]){
  const contact={kind:'impact',stageId:'contact',label:'Blade contact',delay:400,duration:1700,repeats:3,repeatGap:250,repeatInterval:interval};
  const cue=addAbilitySounds(f,[contact],{soundCatalog:allSounds}).find(s=>s.kind==='sound');
  assert.equal(repeatStride(cue),repeatStride(contact));
  assert.equal(cue.repeats,3);
 }
});
