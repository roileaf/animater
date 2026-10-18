import test from 'node:test';
import assert from 'node:assert/strict';
import {PF2E_FEATS,featRecipe} from '../../scripts/catalogs/pf2e/feats/feat-catalog.mjs';
import {PF2E_SPELLS,spellRecipe} from '../../scripts/catalogs/pf2e/spells/spell-catalog.mjs';
import {PF2E_CONDITIONS,PF2E_EFFECTS,stateRecipe} from '../../scripts/catalogs/pf2e/state-catalog.mjs';
import {featSoundDirection} from '../../tools/ability-sound-semantics.mjs';
import {automaticSoundGain} from '../../tools/sound-databases.mjs';
import {spellSources} from '../../tools/pf2e-source.mjs';
import {soundDirection} from '../../tools/spell-sound-semantics.mjs';
import {addAbilitySounds,ABILITY_SOUND_PROFILES} from '../../scripts/engines/sound/ability-sounds.mjs';
import {SOUND_PROFILES,prepareRecipeSounds,previewRecipeSounds} from '../../scripts/engines/sound/spell-sounds.mjs';
import {repeatStride} from '../../scripts/core/stage-options.mjs';
import {validateRecipe} from '../../scripts/core/model.mjs';
const feat=slug=>PF2E_FEATS.find(f=>f.slug===slug);
const all={resolve:c=>c};
const nativeSpells=(await spellSources()).spells;

test('full native ranged descriptions never turn a blowgun, weapon choice, or silent assault into gunfire',()=>{
 assert.equal(featSoundDirection(feat('deathblow')).profile,'ranged');
 assert.match(feat('deathblow').plainDescription,/blowgun or sling/);
 assert.equal(featSoundDirection(feat('blast-tackle')).profile,'ranged');
 assert.match(feat('blast-tackle').plainDescription,/crossbow or a firearm/);
 assert.equal(featSoundDirection(feat('lonely-army')).profile,'');
 assert.match(feat('lonely-army').plainDescription,/deadly silence/);
 const base=feat('deathblow');
 assert.equal(featSoundDirection({...base,direction:{...base.direction,weapon:'blowgun'}}).profile,'blowgun');
 assert.equal(featSoundDirection({...base,direction:{...base.direction,weapon:'crossbow'}}).profile,'crossbow');
});

test('Shove maneuvers get no blade-cut cue and an explicit unarmed combination retains its own physical identity',()=>{
 assert.equal(featSoundDirection(feat('clear-the-way')).profile,'');
 assert.match(feat('clear-the-way').plainDescription,/Shove up to five/);
 const unarmed=feat('cross-the-final-horizon');
 assert.match(unarmed.plainDescription,/unarmed attacks/);
 assert.equal(featSoundDirection({...unarmed,direction:{...unarmed.direction,weapon:'as described'}}).profile,'unarmed');
 assert.equal(featSoundDirection(feat('twin-shot-knockdown')).profile,'ranged');
 assert.equal(featSoundDirection(feat('writhing-runelord-weapon')).profile,'spear');
});

test('Force Barrage uses the inventoried missile-release family instead of gravitational impact audio',()=>{
 const cue=SOUND_PROFILES.forceMissile[0];
 assert.ok(cue.candidates.some(c=>/ggg-sfx\.magic\.arcane\.cast\.missiles\.02/.test(c.key)));
 assert.ok(cue.candidates.every(c=>!/Gravi Blast/.test(c.file)));
 const item=PF2E_SPELLS.find(s=>s.slug==='force-barrage');
 const audio=spellRecipe(item,undefined,{sounds:all}).stages.find(s=>s.kind==='sound');
 assert.equal(audio.optionalSound.candidates[0].module,'ggg','Short release family precedes a complete PSFX flight/impact recording for repeated missiles');
});

test('complete descriptions override negated music, private melodies, future compositions and silent metal buffs',()=>{
 for(const slug of ['boots-on-the-ground','canticle-of-everlasting-grief','enthrall','fortissimo-composition','fold-metal','precious-metals','serrate','field-of-razors','rust-cloud','steel-fortifications','wall-of-metal']){
  const spell=PF2E_SPELLS.find(s=>s.slug===slug),source=nativeSpells.find(e=>e.source._id===spell.id).source;
  const d=soundDirection(spell,source);
  assert.equal(d.profile,'',slug);
  assert.ok(d.descriptionChars>50,slug);
  assert.doesNotMatch(d.reason,/No unambiguous audible effect/,slug+' retains an individually reviewed reason');
 }
 for(const [slug,profile]of [['needle-darts','metalProjectile'],['magnetic-acceleration','metalProjectile'],['metal-reverberation','metalResonance'],['restraining-chains','chainBinding'],['shielded-arm','shield']]){
  const spell=PF2E_SPELLS.find(s=>s.slug===slug),source=nativeSpells.find(e=>e.source._id===spell.id).source;
  assert.equal(soundDirection(spell,source).profile,profile,slug);
 }
});

test('paired contact recordings vary deterministically and reverb ends before the next blow',()=>{
 const item=feat('double-slice');
 const stages=[
  {kind:'impact',stageId:'first',delay:100,duration:500},
  {kind:'impact',stageId:'second',delay:400,duration:500},
 ];
 const sounds={resolve:c=>({...c,duration:2000,gain:.5})};
 const cues=addAbilitySounds(item,stages,{sounds,soundVolume:.4}).filter(s=>s.kind==='sound');
 assert.equal(cues.length,2);
 assert.ok(cues[0].duration<=270);
 assert.equal(cues[1].duration,2000);
 assert.notEqual(cues[0].soundFile,cues[1].soundFile);
 assert.ok(cues.every(s=>s.volume===.2&&s.optionalSound.gain===.5));
 assert.deepEqual(addAbilitySounds(item,stages,{sounds,soundVolume:.4}),addAbilitySounds(item,stages,{sounds,soundVolume:.4}));
});

test('repeated physical cues keep cadence without accumulating overlapping long tails',()=>{
 const contact={kind:'impact',stageId:'contact',delay:500,duration:1000,repeats:4,repeatInterval:300};
 const cue=addAbilitySounds(feat('double-slice'),[contact],{sounds:{resolve:c=>({...c,duration:2000})}}).find(s=>s.kind==='sound');
 assert.equal(cue.repeats,4);
 assert.equal(repeatStride(cue),300);
 assert.ok(cue.duration<=270);
});

test('automatic audio gain only attenuates measured loud clips and respects peak headroom',()=>{
 assert.equal(automaticSoundGain(-32,-16),1,'Subtle recordings are never boosted');
 assert.ok(automaticSoundGain(-12,0)<.4);
 assert.ok(0+20*Math.log10(automaticSoundGain(-12,0))<=-3);
 assert.ok(-12+20*Math.log10(automaticSoundGain(-12,0))<=-20);
 assert.equal(automaticSoundGain(NaN,0),1);
});

test('every generated optional recording retains finite measured levels and conservative gain',()=>{
 const files=new Map();
 for(const profiles of [SOUND_PROFILES,ABILITY_SOUND_PROFILES])for(const cues of Object.values(profiles))for(const cue of cues)for(const candidate of cue.candidates)files.set(candidate.file,candidate);
 assert.ok(files.size>400,'All retained fallback providers are covered');
 for(const [file,candidate]of files){
  assert.ok(Number.isFinite(candidate.nativeDuration)&&candidate.nativeDuration>0,file);
  assert.ok(candidate.duration>0&&candidate.duration<=Math.min(4500,candidate.nativeDuration),file);
  assert.ok(Number.isFinite(candidate.meanDb)&&Number.isFinite(candidate.peakDb),file);
  assert.equal(candidate.gain,Number(automaticSoundGain(candidate.meanDb,candidate.peakDb).toFixed(5)),file);
  assert.ok(candidate.gain>=.05&&candidate.gain<=1,file);
  if(candidate.gain<1){
   assert.ok(candidate.meanDb+20*Math.log10(candidate.gain)<=-20+.002,file);
   assert.ok(candidate.peakDb+20*Math.log10(candidate.gain)<=-3+.002,file);
  }
 }
});

test('optional provider fallback recalculates attenuation once; manual sounds preserve authored volume',()=>{
 const original={module:'ggg',file:'modules/ggg/cue.ogg',gain:.5,duration:1500};
 const fallback={module:'psfx',file:'modules/psfx/cue.ogg',gain:.8,duration:900};
 const recipe={stages:[{kind:'sound',stageId:'sound',duration:1000,volume:.1,soundFile:original.file,optionalSound:{profile:'test',gain:.5,candidates:[original,fallback]}},{kind:'sound',stageId:'manual',duration:1000,volume:.1,soundFile:'worlds/test/custom.ogg'}]};
 const catalog={resolve:c=>c.module==='psfx'?fallback:null};
 const prepared=prepareRecipeSounds(recipe,catalog);
 assert.ok(Math.abs(prepared.stages[0].volume-.16)<1e-12);
 assert.equal(prepared.stages[0].duration,900);
 assert.equal(prepared.stages[0].optionalSound.gain,.8);
 assert.deepEqual(prepareRecipeSounds(prepared,catalog),prepared,'No repeated gain multiplication');
 assert.ok(Math.abs(previewRecipeSounds(recipe,catalog).stages[0].volume-.16)<1e-12);
 assert.deepEqual(prepared.stages[1],recipe.stages[1]);
 assert.equal(prepareRecipeSounds({...recipe,stages:[{...recipe.stages[0],volume:0}]},catalog).stages[0].volume,0);
});

test('rapid PSFX missiles skip measured opening silence and preserve extra user trim through fallback',()=>{
 const item=PF2E_SPELLS.find(s=>s.slug==='force-barrage');
 const psfx={resolve:c=>c.module==='psfx'?c:null},ggg={resolve:c=>c.module==='ggg'?c:null};
 const recipe=spellRecipe(item,undefined,{sounds:psfx}),cue=recipe.stages.find(s=>s.kind==='sound');
 assert.equal(cue.clipStart,300);
 assert.equal(cue.optionalSound.clipStart,300);
 assert.equal(cue.duration,270);
 assert.match(cue.soundFile,/magic-missile-001-\d+ft\.ogg$/);
 const normalized=validateRecipe(recipe).stages.find(s=>s.kind==='sound');
 assert.equal(normalized.clipStart,300);
 assert.equal(normalized.optionalSound.clipStart,300,'Opening provenance survives saved recipes');
 const audio=r=>r.stages.find(s=>s.kind==='sound');
 const edited={...recipe,stages:recipe.stages.map(s=>s.stageId===cue.stageId?{...cue,clipStart:500}:s)};
 const same=prepareRecipeSounds(edited,psfx);
 assert.equal(audio(same).clipStart,500);
 const switched=prepareRecipeSounds(edited,ggg);
 assert.equal(audio(switched).clipStart,200,'Only the known PSFX opening is removed');
 assert.equal(audio(switched).optionalSound.clipStart,0);
 assert.deepEqual(prepareRecipeSounds(switched,ggg),switched);
 const legacy={...recipe,stages:recipe.stages.map(s=>s.stageId===cue.stageId?{...cue,clipStart:0,duration:3500,optionalSound:{...cue.optionalSound}}:s)};
 delete audio(legacy).optionalSound.clipStart;
 const upgraded=audio(prepareRecipeSounds(legacy,psfx));
 assert.equal(upgraded.clipStart,300);
 assert.equal(upgraded.duration,3200,'Trimmed cue cannot loop beyond its native recording');
});

test('an optional cue becomes audible again when its pack returns after an unavailable preview',()=>{
 const candidate={module:'ggg',file:'modules/ggg/cue.ogg',duration:500,gain:1};
 const recipe={stages:[{kind:'sound',stageId:'cue',duration:500,volume:.3,soundFile:candidate.file,optionalSound:{profile:'test',candidates:[candidate]}}]};
 const unavailable=previewRecipeSounds(recipe,{resolve:()=>null});
 assert.equal(unavailable.stages[0].skipSound,true);
 const returned=previewRecipeSounds(unavailable,{resolve:c=>c});
 assert.ok(!returned.stages[0].skipSound);
 assert.equal(returned.stages[0].soundFile,candidate.file);
 assert.equal(returned.stages[0].volume,.3);
});

test('persistent states remain quiet instead of replaying sounds on startup, refresh, expiry, or every loop',()=>{
 for(const entry of [...PF2E_CONDITIONS,...PF2E_EFFECTS])assert.ok(stateRecipe(entry).stages.every(s=>s.kind!=='sound'),entry.name);
});
