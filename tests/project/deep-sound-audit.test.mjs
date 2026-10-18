import test from 'node:test';
import assert from 'node:assert/strict';
import {PF2E_WEAPONS,weaponRecipe} from '../../scripts/catalogs/pf2e/weapons/weapon-catalog.mjs';
import {PF2E_SPELLS,spellRecipe} from '../../scripts/catalogs/pf2e/spells/spell-catalog.mjs';
import {installedSoundCatalog,SOUND_PROFILES} from '../../scripts/engines/sound/spell-sounds.mjs';
import {addSpellSounds} from '../../scripts/engines/sound/spell-sounds.mjs';
import {timedStages} from '../../scripts/engines/playback/composition.mjs';
import {repeatStride} from '../../scripts/core/stage-options.mjs';
const allSounds={resolve:c=>c};
const weapon=slug=>PF2E_WEAPONS.find(w=>w.slug===slug);
const spell=name=>PF2E_SPELLS.find(s=>s.name===name);

test('one elemental weapon Strike plays exactly one physical weapon contact',()=>{
 for(const slug of ['storm-hammer','apotheosis-knife','alicorn-lance']){
  const r=weaponRecipe(weapon(slug),'melee',{sounds:allSounds});
  const physical=r.stages.filter(s=>s.kind==='sound'&&/contact|thrust/i.test(s.label));
  assert.equal(physical.length,1,slug+' must not play a new physical blow for a rune finish');
  assert.match(physical[0].afterStage,/-contact$/);
 }
});

test('description-specific bomb landing sounds follow target payload despite new descriptive labels',()=>{
 for(const slug of ['pernicious-spore-bomb-lesser','twigjack-sack-lesser','pressure-bomb-lesser']){
  const r=weaponRecipe(weapon(slug),'thrown',{sounds:allSounds});
  const landing=r.stages.find(s=>s.kind==='impact'&&s.stageId.endsWith('-accent'));
  const cue=r.stages.find(s=>s.kind==='sound'&&s.label!=='Bomb toss');
  assert.ok(cue,slug);assert.equal(cue.afterStage,landing.stageId,slug);
 }
});

test('spell ward and physical shield profiles both resolve despite sharing a profile name',()=>{
 const candidate=SOUND_PROFILES.shield[0].candidates.find(c=>c.module==='ggg');
 const catalog=installedSoundCatalog(new Map([['ggg',{active:true}]]),{entryExists:k=>k===candidate.key,getAllFileEntries:()=>[candidate.file]});
 assert.equal(catalog.resolve(candidate)?.file,candidate.file);
 assert.ok(spellRecipe(spell('Shield'),undefined,{sounds:catalog}).stages.some(s=>s.kind==='sound'));
});

test('an eight-layer visual spell retains its authored sound within MAX_STAGES',()=>{
 const r=spellRecipe(spell('Prismatic Wall'),undefined,{sounds:allSounds});
 assert.equal(r.stages.filter(s=>s.kind==='template').length,7);
 assert.ok(r.stages.some(s=>s.kind==='sound'));
 assert.ok(r.stages.length<=12);
});

test('missile release audio follows authored repeat cadence without duration-derived gaps',()=>{
 const r=spellRecipe(spell('Force Barrage'),undefined,{sounds:allSounds});
 const flight=r.stages.find(s=>s.kind==='travel'),cue=r.stages.find(s=>s.kind==='sound');
 assert.equal(cue.repeats,flight.repeats);
 assert.equal(repeatStride(cue),repeatStride(flight));
});

test('lightning-storm thunder follows sample strike rather than cloud formation',()=>{
 const r=spellRecipe(spell('Lightning Storm'),undefined,{sounds:allSounds});
 const strike=r.stages.find(s=>/lightning strike/i.test(s.label)),cue=r.stages.find(s=>s.kind==='sound');
 assert.equal(cue.afterStage,strike.stageId);
 const times=timedStages(r);
 assert.equal(times.find(s=>s.stageId===cue.stageId).delay,times.find(s=>s.stageId===strike.stageId).delay);
});

test('regenerated utility cues retain native transformation, later blessing, hook extension and target-pocket phases',()=>{
 for(const [name,profile]of [['Fortify Summoning','transform'],["Healer's Blessing",'bless']]){
  const r=spellRecipe(spell(name),undefined,{sounds:allSounds}),cue=r.stages.find(s=>s.kind==='sound');
  assert.equal(cue?.optionalSound?.profile,profile,name);
 }
 const hook=spellRecipe(spell('Retrieving Hook'),undefined,{sounds:allSounds});
 const extension=hook.stages.find(s=>s.kind==='travel'),whoosh=hook.stages.find(s=>s.kind==='sound');
 assert.equal(whoosh?.optionalSound?.profile,'objectWhoosh');assert.equal(whoosh.afterStage,extension.stageId);
 assert.ok(!hook.stages.some(s=>s.kind==='sound'&&/impact|hit|strike|clank/i.test(s.label)));
 const pocket=spellRecipe(spell('Pet Cache'),undefined,{sounds:allSounds});
 const entrance=pocket.stages.find(s=>s.label==='Companion pocket entrance'),departure=pocket.stages.find(s=>s.kind==='sound');
 assert.ok(entrance);assert.equal(departure?.optionalSound?.profile,'pocketTransition');assert.equal(departure.afterStage,entrance.stageId);
});
test('shooting-star shimmer begins at cone projectile release rather than late dazzling template',()=>{
 const r=spellRecipe(spell('Spray of Stars'),undefined,{sounds:allSounds});
 const flight=r.stages.find(s=>s.label==='Stars spread through cone'),cue=r.stages.find(s=>s.kind==='sound');
 assert.ok(flight);assert.equal(cue?.optionalSound?.profile,'starFlight');assert.equal(cue.afterStage,flight.stageId);
 const times=timedStages(r);assert.equal(times.find(s=>s.stageId===cue.stageId).delay,500);
 assert.ok(!/fire|flame|explosion/i.test(cue.label+' '+cue.soundFile));
});
