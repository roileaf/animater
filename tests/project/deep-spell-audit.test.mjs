import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeSpellDescription } from '../../tools/spell-semantics.mjs';
import { spellRecipe, SPELL_THEMES } from '../../scripts/catalogs/pf2e/spells/spell-choreography.mjs';
import { resolveSpellMedia, coneMaterialMatches } from '../../tools/spell-asset-selection.mjs';
import { paceDeliveryEffects } from '../../scripts/catalogs/pf2e/spells/spell-delivery-timing.mjs';
import { meaningfulSpellFingerprint } from '../../tools/spell-meaningful-audit.mjs';
import { UTILITY_SPELL_DESIGNS } from '../../scripts/catalogs/pf2e/spells/spell-utility-designs.mjs';
import { timedStages } from '../../scripts/engines/playback/composition.mjs';
const fixture=(slug, prose,{theme='arcane',delivery='self',area=null,target='',traits=[],range=''}={})=>{
 const native={name:slug,system:{description:{value:`<p>${prose}</p>`},area,target:{value:target},range:{value:range},time:{value:'2'},traits:{value:traits},damage:{}}};
 const design=analyzeSpellDescription(native,{slug,theme,delivery,kind:'spell'});
 design.assets=Object.fromEntries(['cast','bolt','hit','aura','area'].map(slot=>[slot,[`jb2a.${slot}.test`]]));
 return {id:slug,slug,name:slug,rank:3,theme,delivery:design.delivery,trigger:'use',area,notes:[],design};
};
test('native cylinder and square footprint affects chosen location instead of caster',()=>{
 for(const [slug,area,prose] of [
 ['flame-strike',{type:'cylinder',value:10},'You call a rain of divine fire that plummets down from above.'],
 ['bramble-bush',{type:'cube',value:5},'You cause a thorned bush to sprout from the ground, lash around, and wither.'],
 ['floating-flame',{type:'square',value:5},'You create a fire that burns without fuel and moves to your commands.']]){
  const s=fixture(slug,prose,{theme:slug==='bramble-bush'?'plant':'fire',area});
  assert.equal(s.delivery,'burst',slug);
  assert.ok(spellRecipe(s).stages.some(p=>p.kind==='template'),slug);
 }
});
test('native cone artwork actually uses area geometry and full media lifetime',()=>{
 const s=fixture('breathe-fire','A gout of flame erupts from your hands.',{theme:'fire',delivery:'cone',area:{type:'cone',value:15}});
 s.design.mediaTiming={area:{duration:3200}};
 const stage=spellRecipe(s).stages.find(p=>p.kind==='template');
 assert.ok(stage);
 assert.equal(stage.assets[0],'jb2a.area.test');
 assert.ok(stage.duration>=3200);
 assert.equal(stage.oneShot,true);
 assert.match(s.design.label,/fire cone/i);
 assert.doesNotMatch(s.design.rationale,/arcane casting cue/i);
 assert.equal(coneMaterialMatches('jb2a.breath_weapons.fire.cone.orange.01','fire'),true);
 assert.equal(coneMaterialMatches('jb2a.breath_weapons.poison.cone.purple.01','sonic'),false);
 assert.equal(coneMaterialMatches('jb2a.detect_magic.cone.blue','sonic'),false);
});
test('native damaging line preserves its distinct caster-local restoration cue',()=>{
 const s=fixture('life-draining-roots','Thorny roots erupt from your hands, puncturing creatures in the line and transferring nutrients from those damaged into you.',{theme:'plant',delivery:'line',area:{type:'line',value:30}});
 assert.equal(s.design.motif,'rootedDrainLine');
 const recipe=spellRecipe(s),area=recipe.stages.find(p=>p.kind==='template'),restore=recipe.stages.find(p=>p.label==='Nutrients return to caster');
 assert.ok(area,'roots still fill the placed damaging line');
 assert.ok(restore,'distinct restoration cue remains');
 assert.equal(restore.subject,'source');
 assert.ok(['cast','aura'].includes(restore.kind),'healing film stays local, not stretched into area geometry');
 assert.equal(restore.assets[0],'jb2a.aura.test');
 for(const slug of ['bless','bane']){
  const emanation=fixture(slug,'Rings spread from the caster through the emanation.',{theme:'arcane',delivery:'emanation',area:{type:'emanation',value:15}});
  assert.ok(spellRecipe(emanation).stages.some(p=>p.kind==='template'),'default area aura keeps the native emanation footprint');
 }
});
test('hidden influence and mental defense use different media and do not compress native ground cracks',()=>{
 const influence=fixture('ignite-ambition','You strengthen a target ambition, increase its resentment of allies, and make its allegiances susceptible to change.',{theme:'mind',delivery:'target',target:'1 creature'});
 const defense=fixture('strength-of-mind','You bolster your ally and grant defenses against harmful mental effects.',{theme:'mind',delivery:'target',target:'1 creature'});
 assert.equal(influence.design.motif,'persuasiveThread');
 assert.equal(defense.design.motif,'mentalFortitude');
 assert.ok(!spellRecipe(influence).stages.some(s=>s.kind==='motion'));
 const gravity=spellRecipe(fixture('weight-of-the-world','You force a creature to experience severely multiplied gravity and persistent bleed.',{theme:'gravity',delivery:'target',target:'1 creature'}));
 assert.ok(!gravity.stages.find(s=>s.kind==='impact').tracks.some(t=>t.property==='scale.y'));
 assert.ok(gravity.stages.some(s=>s.kind==='sprite'&&s.tracks.some(t=>t.property==='scale.y')));
});
test('utility cluster distinguishes matter, rope, burden support and loss of sight',()=>{
 const recipes=Object.fromEntries([
 ['allfood','You transform one object into an edible substance with a gooey consistency.'],
 ['animate-rope','A length of rope animates and follows Coil, Crawl, Knot, Loop or Bind commands.'],
 ['ant-haul','You reinforce the target musculoskeletal system to bear more weight.'],
 ['blindness','You blind the target according to its Fortitude save.']
 ].map(([slug,text])=>[slug,spellRecipe(fixture(slug,text,{delivery:'target',target:'1 creature or object'}))]));
 assert.ok(recipes.blindness.stages.some(s=>/eye veil/i.test(s.label)));
 assert.ok(recipes['animate-rope'].stages.some(s=>s.rotateInDuration>=1500));
 assert.ok(recipes['ant-haul'].stages.some(s=>s.maskToken));
 assert.ok(recipes.allfood.stages.some(s=>s.tracks.some(t=>t.property==='scale.y')));
 assert.ok(Object.values(recipes).every(r=>r.stages.every(s=>s.kind!=='motion')));
 // All 66 independently reviewed entries must compose valid editable recipes.
 for(const [slug,[motif]] of Object.entries(UTILITY_SPELL_DESIGNS)){
  const s=fixture(slug,'Native utility casting.',{delivery:'target',target:'1 creature or object'});
  assert.equal(s.design.motif,motif,slug);
  const r=spellRecipe(s);assert.ok(r.stages.length>=2,slug);
  assert.doesNotThrow(()=>timedStages(r),slug);
 }
 assert.equal(Object.keys(UTILITY_SPELL_DESIGNS).length,66);
});
test('utility transfers obey direction and do not perform later reactions or timers during casting',()=>{
 const build=slug=>spellRecipe(fixture(slug,'Native utility casting.',{delivery:'target',target:'1 creature'}));
 const curse=build('claim-curse');
 assert.equal(curse.stages.find(s=>s.kind==='travel').travelOrigin,'target');
 const retrieval=build('retrieving-hook');
 assert.ok(retrieval.stages.some(s=>s.kind==='motion'&&s.subject==='targets'&&s.motionRange==='target'));
 const shared=build('share-vision').stages.filter(s=>s.kind==='travel');
 assert.equal(shared.length,2);assert.ok(shared.some(s=>s.travelOrigin==='target'));
 for(const slug of ['connective-current','synchronize-steps','liberating-command','watchdog','healers-blessing'])
  assert.ok(build(slug).stages.every(s=>s.kind!=='motion'),slug);
 const timer=build('synchronize');assert.ok(timer.stages.every(s=>s.repeats===1));
 const teleport=build('dimensional-assault'),near=timedStages(teleport,1).find(s=>s.kind==='motion'),far=timedStages(teleport,12).find(s=>s.kind==='motion');
 assert.ok(far.duration>near.duration);
 const peakSqPerSec=1.875*12/(far.duration*far.motionArrival/100/1000);
 assert.ok(peakSqPerSec<12,`teleport visual peak ${peakSqPerSec}`);
});
test('shooting stars retain native cone geometry without reusing fire-breath art',()=>{
 const s=fixture('spray-of-stars','You fling a spray of tiny shooting stars, dealing fire damage and dazzling creatures.',{theme:'fire',delivery:'cone',area:{type:'cone',value:15}});
 assert.equal(s.design.motif,'coneStarFan');
 const fan=spellRecipe(s).stages.find(p=>p.kind==='projectile');
 assert.ok(fan);
 assert.equal(fan.travelDestination,'area');
 // Shared native fan layout keeps every lane inside the placed cone.
 assert.equal(fan.areaLayout,'fan');
 assert.equal(fan.fanCount,7);
});
test('nonmaterial cone magic never becomes poison cloud or arrow volley merely for color',()=>{
 const rows=['cast_generic.purple','magic_missile.purple','impact.purple','energy_field.purple','breath_weapons.poison.cone.purple','volley_of_projectiles_Cone5e.arrow.001.001.orangeyellow','template_cone.001.001.purple'].map(key=>({key:`jb2a.${key}`,file:key.includes('cone')?'Cone_600x600.webm':'Square_400x400.webm'}));
 const defaults={cast:'cast_generic',bolt:'magic_missile',hit:'impact',aura:'energy_field',area:'impact'};
 const assets=resolveSpellMedia({free:rows,patreon:rows},'sonic',{},defaults,{name:'Haunting Hymn',delivery:'cone',design:{pattern:'generic'}});
 assert.equal(assets.area[0],'jb2a.template_cone.001.001.purple');
});
test('mental paralysis, confusion, dance and guidance have distinct fitting treatments',()=>{
 const cases=[
 ['paralyze','You block the target motor impulses before they can leave its mind, threatening to freeze the target in place.','mind','mentalParalysis'],
 ['confusion','You befuddle your target with strange impulses, causing it to act randomly.','mind','mentalConfusion'],
 ['uncontrollable-dance','The target is overcome with an all-consuming urge to dance.','mind','compelledDance'],
 ['guidance','You ask for the guidance of supernatural entities, granting the target a status bonus.','arcane','guidedInsight']];
 for(const [slug,prose,theme,motif] of cases){const s=fixture(slug,prose,{theme,delivery:'target',target:'1 creature'});assert.equal(s.design.motif,motif);assert.ok(spellRecipe(s).stages.length>=3);}
 const dance=spellRecipe(fixture('uncontrollable-dance',cases[2][1],{theme:'mind',delivery:'target',target:'1 creature'}));
 assert.ok(dance.stages.some(p=>p.kind==='motion'&&p.motion==='spin'));
 const paralysis=spellRecipe(fixture('paralyze',cases[0][1],{theme:'mind',delivery:'target',target:'1 creature'}));
 assert.ok(paralysis.stages.every(p=>p.kind!=='motion'));
});
test('movement spell casting conveys cosmetic burst movement, speed-only buffs stay in place',()=>{
 const rush=spellRecipe(fixture('qi-rush','Accelerated by your qi, you move with such speed you become a blur. Move two times: two Strides, two Steps, or one Stride and one Step.'));
 assert.ok(rush.stages.some(p=>p.kind==='motion'&&p.motion==='rush'&&p.subject==='source'));
 assert.ok(rush.stages.some(p=>p.kind==='sprite'&&p.copies>=2));
 const speed=spellRecipe(fixture('fleet-step','You gain a +30-foot status bonus to your Speed.'));
 assert.ok(!speed.stages.some(p=>p.motion==='rush'||p.motion==='lunge'));
});
test('native contact films keep early peaks visible while deliberate growth retains authored entrance',()=>{
 const short={kind:'impact',stageId:'strike',assets:['jb2a.melee_generic.slashing.one_hand.01.white'],duration:1500,fadeIn:200,scaleIn:0.1,scaleInDuration:600,rotateIn:-90,rotateInDuration:500};
 const stage=paceDeliveryEffects([short],{pattern:'generic',mediaTiming:{hit:{duration:1200}}})[0];
 assert.equal(stage.fadeIn,0);
 assert.equal(stage.scaleInDuration,0);
 assert.equal(stage.rotateInDuration,0);
 const growth=paceDeliveryEffects([{...short,assets:['jb2a.swirling_leaves.green']}],{pattern:'growth'})[0];
 assert.equal(growth.scaleInDuration,600);
 const shield=paceDeliveryEffects([{...short,kind:'cast',mediaSlot:'hit',assets:['jb2a.shield.01.intro.blue']}],{pattern:'shield',mediaTiming:{hit:{duration:2000}}})[0];
 assert.equal(shield.scaleInDuration,0);
 assert.equal(shield.oneShot,true);
 assert.ok(shield.duration>=2000);
});
test('enlarge and shrink copies move in opposite size directions without changing document size',()=>{
 const enlarged=spellRecipe(fixture('enlarge','The target grows to size Large.',{theme:'transform',delivery:'target',target:'1 creature'}));
 const shrunk=spellRecipe(fixture('shrink','The target shrinks to become Tiny in size.',{theme:'transform',delivery:'target',target:'1 creature'}));
 const trackOf=r=>r.stages.find(p=>p.kind==='sprite').tracks.find(t=>t.property==='scale.x');
 assert.ok(trackOf(enlarged).to>1);
 assert.ok(trackOf(shrunk).to<1);
});
test('deep variety metric ignores renames, tiny timing/rank changes and disabled tint',()=>{
 const s=fixture('guidance','You ask supernatural guidance.',{delivery:'target',target:'1 creature'}),r=spellRecipe(s),renamed=structuredClone(r),db=[{key:'jb2a.hit.test',file:'same.webm'},{key:'jb2a.cast.test',file:'cast.webm'},{key:'jb2a.aura.test',file:'aura.webm'}];
 renamed.name='Different';renamed.stages.forEach((p,i)=>{p.stageId=`another-${i}`;p.label='Other';p.duration+=15;p.delay+=10;p.scale+=0.01;p.tint='#000000';});
 assert.equal(meaningfulSpellFingerprint(s,r,db),meaningfulSpellFingerprint(s,renamed,db));
 renamed.stages[1].assets=['jb2a.different.art'];db.push({key:'jb2a.different.art',file:'different.webm'});
 assert.notEqual(meaningfulSpellFingerprint(s,r,db),meaningfulSpellFingerprint(s,renamed,db));
});
