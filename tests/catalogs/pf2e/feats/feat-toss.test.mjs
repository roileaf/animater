import test from 'node:test';
import assert from 'node:assert/strict';
import {PF2E_FEATS,featRecipe,filterFeats} from '../../../../scripts/catalogs/pf2e/feats/feat-catalog.mjs';
import {previewPlan,planRecipe} from '../../../../scripts/core/model.mjs';
import {timedStages} from '../../../../scripts/engines/playback/composition.mjs';
import {motionPose} from '../../../../scripts/engines/motion/motion.mjs';
import {chainPreview} from '../../../../scripts/engines/preview/chain-preview.mjs';
import {abilitySoundInfo,ABILITY_SOUND_PROFILES} from '../../../../scripts/engines/sound/ability-sounds.mjs';
const feat=slug=>PF2E_FEATS.find(f=>f.slug===slug);
const recipe=slug=>featRecipe(feat(slug));
const token=(id,x)=>({id,center:{x,y:100},document:{width:1,height:1}});
const context={source:token('performer',100),targets:[token('first',250),token('second',450),token('third',650)],gridSize:100};
const shape=r=>r.stages.filter(s=>s.kind!=='sound').map(s=>[s.kind,s.motion,s.subject,s.afterStage?'linked':'absolute',s.timingAnchor]);

test('ally throws have distinct physical phases instead of shared command music',()=>{
 const names=['friendly-fling','friendly-toss','jotuns-boost'],recipes=names.map(recipe);
 assert.equal(new Set(recipes.map(r=>JSON.stringify(shape(r)))).size,3);
 for(const r of recipes){
  assert.ok(!r.stages.flatMap(s=>s.assets).some(k=>/music_notations|bardic_inspiration/.test(k)),r.name);
  assert.ok(r.playbackRoles?.targets.includes('willing-adjacent-ally'),r.name);
  const plans=previewPlan(r,context).filter(p=>p.destination!==context.source);
  assert.ok(plans.length>0);assert.ok(plans.every(p=>p.destination===context.targets[0]),r.name);
  for(const s of r.stages.filter(s=>s.kind==='motion'))assert.deepEqual(motionPose(s,1),{x:0,y:0,rotation:0,scale:1});
 }
 assert.ok(recipes[0].stages.some(s=>/horn/i.test(s.label)));
 assert.ok(recipes[1].stages.some(s=>s.motion==='recoil'&&s.subject==='source'));
 assert.ok(recipes[2].stages.some(s=>s.motion==='rush'&&s.motionHeading==='up'&&s.subject==='targets'));
});

test('Distracting Toss juggles a weapon, makes one thrown attack, and never tosses its foe',()=>{
 const r=recipe('distracting-toss'),flights=r.stages.filter(s=>s.kind==='travel');
 assert.equal(flights.length,1);assert.ok(flights[0].assets.every(k=>/dagger\.throw|sword\.throw/.test(k)));
 assert.ok(r.stages.some(s=>/juggle|distraction/i.test(s.label)&&s.kind==='cast'));
 assert.ok(!r.stages.some(s=>s.kind==='motion'&&s.subject==='targets'));
 assert.equal(previewPlan(r,context).filter(p=>p.kind==='travel').length,1);
});

test('Rebounding Toss goes from source to first foe, then first foe to second, never third',()=>{
 const r=recipe('rebounding-toss'),flights=previewPlan(r,context).filter(p=>p.kind==='travel');
 assert.equal(flights.length,2);
 assert.deepEqual(flights.map(p=>[p.origin.id,p.destination.id]),[['performer','first'],['first','second']]);
 assert.ok(r.stages.find(s=>s.kind==='travel').assets.every(k=>/dagger\.throw|sword\.throw/.test(k)));
 const hits=previewPlan(r,context).filter(p=>p.kind==='impact');assert.equal(hits.length,2);
 assert.ok(flights[1].delay>=hits[0].delay);assert.ok(!r.stages.some(s=>s.kind==='motion'&&s.subject==='targets'));
});

test('Whirlwind Toss thrashes its held victim before the optional toss, collateral recipients stay put',()=>{
 const r=recipe('whirlwind-toss'),timed=timedStages(r),toss=timed.find(s=>s.motion==='roll'),thrash=timed.find(s=>s.kind==='impact'&&/Thrash/i.test(s.label));
 assert.ok(thrash);assert.ok(toss);assert.ok(toss.delay>=thrash.delay+thrash.duration);
 assert.deepEqual(r.playbackRoles.targets,['grabbed-victim','adjacent-collateral-victims']);
 const plans=previewPlan(r,context);assert.ok(plans.filter(p=>p.kind==='motion'&&p.subject==='targets').every(p=>p.destination.id==='first'));
 const collateral=plans.filter(p=>/Collateral Thrash/.test(p.label));assert.deepEqual(collateral.map(p=>p.destination.id),['second','third']);
});

test('Feral Toss shows a horn attack; its push requires a confirmed hit',()=>{
 const r=recipe('feral-toss'),push=r.stages.find(s=>s.kind==='motion'&&s.subject==='targets');assert.ok(push?.requiresHit);
 assert.ok(r.stages.some(s=>s.subject==='source'&&s.motion==='shake'));
 const catalog=r.stages.flatMap(s=>s.assets.map(key=>({key,file:key+'.webm'})));
 assert.equal(planRecipe(r,catalog,{...context,outcome:'failure'}).filter(p=>p.kind==='motion'&&p.subject==='targets').length,0);
 assert.equal(planRecipe(r,catalog,{...context,outcome:'success'}).filter(p=>p.kind==='motion'&&p.subject==='targets').length,1);
});

test('Wind-Tossed Spell prepares wind at source, without firing or tossing a recipient',()=>{
 const r=recipe('wind-tossed-spell');assert.ok(r.stages.some(s=>s.assets.some(k=>/wind_lines/.test(k))));
 assert.ok(r.stages.every(s=>!['impact','travel'].includes(s.kind)&&s.subject!=='targets'));
 assert.ok(!r.stages.flatMap(s=>s.assets).some(k=>/cast_generic|magic_signs/.test(k)));
});

test('every toss search result keeps a distinct effects-only sequence and valid timing links',()=>{
 const rows=filterFeats({search:'toss'});assert.equal(rows.length,8);
 const signatures=new Set();
 for(const f of rows){
  const r=featRecipe(f,{motion:false});assert.ok(r.stages.every(s=>s.kind!=='motion'));
  assert.ok(r.stages.every(s=>!s.afterStage||r.stages.some(p=>p.stageId===s.afterStage)));
  signatures.add(JSON.stringify(r.stages.map(s=>[s.kind,s.assets,s.delay,s.duration,s.targetSelection,s.travelOrigin,s.offsetY])));
 }
 assert.equal(signatures.size,rows.length);
});

test('preview labels the willing ally and held victim, and shows the actual capped rebound route',()=>{
 assert.equal(chainPreview(recipe('jotuns-boost')).actors[1].name,'Willing ally');
 const whirl=chainPreview(recipe('whirlwind-toss'));
 assert.deepEqual(whirl.actors.slice(1).map(a=>a.name),['Held victim','Nearby foe 1','Nearby foe 2']);
 assert.equal(whirl.recipe.playbackPlan.filter(p=>/Collateral Thrash/.test(p.label)).length,2);
 assert.equal(chainPreview(recipe('rebounding-toss')).actors.length,3);
 const real=chainPreview(recipe('jotuns-boost'),{targets:{name:'Ezren'}});assert.equal(real.actors[1].name,'Ezren');
});

test('physical toss sounds follow their phases and conditional rebound audio stays gated',()=>{
 const soundCatalog={resolve:c=>({...c,duration:c.duration??1000})};
 for(const slug of ['friendly-fling','friendly-toss','jotuns-boost']){
  assert.equal(abilitySoundInfo(feat(slug)).profile,'allyHeave');
  const r=featRecipe(feat(slug),{soundCatalog}),sounds=r.stages.filter(s=>s.kind==='sound');assert.equal(sounds.length,1);
  assert.equal(r.stages.find(s=>s.stageId===sounds[0].afterStage).kind,'cast');
 }
 const r=featRecipe(feat('rebounding-toss'),{soundCatalog}),second=r.stages.find(s=>/Second weapon contact/.test(s.label));
 const contact=r.stages.find(s=>s.kind==='sound'&&s.afterStage===second.stageId);assert.ok(contact?.requiresHit);
 const catalog=r.stages.flatMap(s=>s.assets.map(key=>({key,file:key+'.webm'})));
 const failed=planRecipe(r,catalog,{...context,outcome:'failure'});assert.ok(!failed.some(s=>s.stageId===contact.stageId));
 assert.ok(ABILITY_SOUND_PROFILES.naturalPierce[0].candidates.filter(c=>c.key).every(c=>/melee\.claws\.strike\.stab/.test(c.key)),'natural piercing uses a creature stab rather than a metal polearm');
});
