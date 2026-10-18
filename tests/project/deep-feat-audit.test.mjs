import test from 'node:test';
import assert from 'node:assert/strict';
import { PF2E_FEATS } from '../../data/pf2e-feats.mjs';
import { featRecipe } from '../../scripts/catalogs/pf2e/feats/feat-choreography.mjs';
import { loadFeatReviews, reviewedFeatDesign } from '../../tools/feat-review.mjs';
import { previewPlan } from '../../scripts/core/model.mjs';
import { motionPhases } from '../../scripts/engines/motion/motion-path.mjs';
import { FEAT_TRAVERSAL_REVIEWS } from '../../scripts/catalogs/pf2e/feats/feat-traversal.mjs';
import { motionPose, motionDirection } from '../../scripts/engines/motion/motion.mjs';
import { GENERATED_MOTION_DURATION } from '../../scripts/engines/motion/motion-pacing.mjs';
const reviews=await loadFeatReviews();
const named=slug=>{const feat=PF2E_FEATS.find(f=>f.slug===slug);assert.ok(feat,slug);return feat;};
const reviewed=slug=>{const feat=named(slug);return {...feat,...reviewedFeatDesign(feat,reviews[feat.id],feat.descriptionHash,feat.name)};};
const token=(id,x)=>({id,center:{x,y:100},w:100,h:100,document:{x:x-50,y:50,width:1,height:1}});
const source=token('source',100),targets=[token('first',400),token('second',700),token('third',1000)];

test('Double Shot and Hunted Shot use actual ranged topology with distinct recipients',()=>{
 for(const [slug,split] of [['double-shot',true],['hunted-shot',false]]){
  const feat=reviewed(slug);
  assert.equal(feat.motif,'ranged',slug);
  feat.assets={...feat.assets,bolt:['jb2a.arrow.physical.white'],hit:['jb2a.impact.001.blue']};
  feat.mediaTiming={};
  const recipe=featRecipe(feat),plan=previewPlan(recipe,{source,targets});
  const flights=plan.filter(s=>s.kind==='travel');
  assert.equal(flights.length,2,slug);
  assert.equal(new Set(flights.map(s=>s.destination.id)).size,split?2:1,slug);
  assert.ok(!recipe.stages.some(s=>s.motion==='lunge'),slug);
 }
});

test('movement profiles show leap, sprint, roll and counted Steps without inventing attacks',()=>{
 for(const [slug,motion,count] of [['incredible-sprint','rush',1],['furious-sprint','rush',1],['marine-jet','rush',1],['ratfolk-roll','roll',1],['swift-leap','leap',1],['explosive-leap','leap',1],['black-powder-boost','leap',1],['propelled-leap','leap',1],['elf-step','dodge',2],['guarded-advance','dodge',2],['guarded-advance-knight-vigilant','dodge',1],['goblin-scuttle','dodge',1],['step-lively','dodge',1],['nimble-dodge','dodge',1]]){
  const feat=reviewed(slug),recipe=featRecipe(feat),plan=previewPlan(recipe,{source,targets});
  assert.equal(plan.filter(s=>s.kind==='motion'&&s.motion===motion).length,count,slug);
  assert.ok(!recipe.stages.some(s=>['travel','projectile','impact'].includes(s.kind)),slug);
 }
});

test('Dashing Pounce leaps into exactly two claw contacts; Doctor visitation approaches ally before care',()=>{
 const pounce=featRecipe(reviewed('dashing-pounce'));
 assert.ok(pounce.stages.some(s=>s.kind==='motion'&&s.motion==='leap'));
 const plan=previewPlan(pounce,{source,targets});
 assert.equal(plan.filter(s=>s.kind==='impact').length,2);
 assert.ok(plan.filter(s=>s.kind==='impact').every(s=>s.destination===targets[0]));
 const care=featRecipe(reviewed('doctors-visitation'));
 const movement=care.stages.find(s=>s.kind==='motion'&&s.motion==='rush');
 assert.ok(movement);
 const landing=care.stages.find(s=>s.kind==='impact');
 assert.equal(landing.afterStage,movement.stageId);
 assert.equal(landing.timingAnchor,'arrival');
 assert.match(landing.label,/care/i);
});

test('granting Divine Wings stays stationary while active wings move only cosmetically',()=>{
 const wings=featRecipe(reviewed('divine-wings'));
 assert.ok(!wings.stages.some(s=>['rush','leap'].includes(s.motion)));
 assert.match(wings.description,/wing|flight/i);
});

test('maneuver cues follow affected target rather than moving caster',()=>{
 for(const slug of ['repositioning-block','spinning-release','log-roll']){
  const feat=reviewed(slug),recipe=featRecipe(feat);
  assert.ok(recipe.stages.filter(s=>['motion','sprite'].includes(s.kind)).every(s=>s.subject==='targets'),slug);
  assert.ok(!recipe.stages.some(s=>s.kind==='cast'),slug);
 }
});

test('every remaining movement/flight description has an explicit reviewed route or stationary reason',()=>{
 assert.equal(Object.keys(FEAT_TRAVERSAL_REVIEWS).length,136); // Whirlwind Toss now has a dedicated multi-phase design.
 for(const [slug,review] of Object.entries(FEAT_TRAVERSAL_REVIEWS)){
  const feat=named(slug),recipe=featRecipe(feat);
  assert.match(recipe.description,new RegExp(review.reason.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')),slug);
  if(review.motion) assert.ok(recipe.stages.some(s=>s.kind==='motion'&&s.motion===review.motion.motion),slug);
  else assert.ok(!recipe.stages.some(s=>['rush','leap','roll','dodge'].includes(s.motion)),slug);
 }
});

test('actual short Fly activities traverse while movement-mode grants remain stationary',()=>{
 for(const slug of ['evanescent-wings','benefactors-wings','fledgling-flight','take-wing']){
  const move=featRecipe(named(slug)).stages.find(s=>s.kind==='motion');
  assert.equal(move.motion,'leap',slug);
  assert.equal(move.jumpHeight,.15,slug);
  assert.ok(Math.hypot(...Object.values(motionPose(move,.4,{x:1,y:0},100)).slice(0,2))>100,slug);
 }
 for(const slug of ['arcane-propulsion','cyclonic-ascent','divine-wings','propulsive-leap'])
  assert.ok(!featRecipe(named(slug)).stages.some(s=>['rush','leap','roll','dodge'].includes(s.motion)),slug);
});

test('retreats and forced throws visibly travel away rather than approaching caster/attacker',()=>{
 for(const slug of ['elude-trouble','scamper','whirling-throw','spinning-release']){
  const move=featRecipe(named(slug)).stages.find(s=>s.kind==='motion');
  assert.equal(move.motionHeading,'away',slug);
  const actor=move.subject==='targets'?targets[0]:source;
  const direction=motionDirection(actor,source,targets[0],move.motion,100);
  const pose=motionPose(move,.4,direction,100);
  assert.ok(move.subject==='targets'?pose.x>0:pose.x<0,slug);
 }
});

test('paired water and leadership routes move source plus one selected participant in parallel',()=>{
 for(const slug of ['lead-the-way','ferry-through-waves','march-the-mines','pressure-change','riptide','cratering-drop']){
  const recipe=featRecipe(named(slug)),plan=previewPlan(recipe,{source,targets});
  const moves=plan.filter(s=>s.kind==='motion');
  assert.equal(moves.length,2,slug);
  assert.equal(new Set(moves.map(s=>s.destination.id)).size,2,slug);
  assert.ok(moves.some(s=>s.destination===source),slug);
  assert.ok(moves.some(s=>s.destination===targets[0]),slug);
  const poses=moves.map(move=>motionPose(move,.4,motionDirection(move.destination,source,targets[0],move.motion,100),100));
  assert.equal(poses[0].x,poses[1].x,slug);
  assert.equal(poses[0].y,poses[1].y,slug);
 }
});

test('swimming/dive combos and route contacts preserve counted actions and one victim pass',()=>{
 const dive=featRecipe(named('swan-dive'));
 assert.deepEqual(dive.stages.filter(s=>s.kind==='motion').map(s=>s.motion),['leap','rush']);
 const light=featRecipe(named('light-paws'));
 assert.deepEqual(light.stages.filter(s=>s.kind==='motion').map(s=>s.motion),['rush','dodge']);
 for(const slug of ['sonic-strafe','to-war','trampling-charge','danse-macabre']){
  const plan=previewPlan(featRecipe(named(slug)),{source,targets});
  assert.equal(plan.filter(s=>s.kind==='impact').length,3,slug);
  assert.equal(new Set(plan.filter(s=>s.kind==='impact').map(s=>s.destination.id)).size,3,slug);
 }
 const volcanic=previewPlan(featRecipe(named('volcanic-escape')),{source,targets});
 assert.equal(volcanic.filter(s=>s.kind==='impact').length,1);
 assert.ok(volcanic.find(s=>s.kind==='impact').delay<volcanic.find(s=>s.kind==='motion').delay);
});

test('counted hopping Stride keeps three distinct readable low arcs in near, far and targetless contexts',()=>{
 const recipe=featRecipe(named('hopping-stride'));
 for(const context of [{source,targets},{source,targets:[token('far',1900)]},{source,targets:[]}]){
  const moves=previewPlan(recipe,context).filter(stage=>stage.kind==='motion');
  assert.equal(moves.length,3);
  for(const move of moves){
   assert.equal(move.motion,'leap');
   assert.ok(move.duration>=GENERATED_MOTION_DURATION.leap);
   assert.equal(move.distance,.55);
   assert.equal(move.jumpHeight,.18);
  }
  for(let index=1;index<moves.length;index++)assert.ok(moves[index].delay>=moves[index-1].delay+moves[index-1].duration);
 }
});

test('counted Step activities finish each cosmetic route before starting the next',()=>{
 for(const slug of ['elf-step','quick-positioning','guarded-advance','wing-step']){
  const moves=previewPlan(featRecipe(named(slug)),{source,targets}).filter(stage=>stage.kind==='motion');
  assert.equal(moves.length,2,slug);
  assert.ok(moves[1].delay>=moves[0].delay+moves[0].duration,slug);
 }
});

test('generic attack lunge has visible but bounded twelve-pixel footprint at grid100',()=>{
 const recipe=featRecipe(reviewed('reactive-strike'));
 const motion=recipe.stages.find(s=>s.motion==='lunge');
 assert.equal(motion.distance*motion.intensity*100,12);
});

test('native physical source flourishes retain immediate full-size footage instead of generic growth entrance',()=>{
 for(const motif of ['display','whirlwindStrike']){
  const feat={...reviewed('reactive-strike'),motif,assets:{cast:['jb2a.melee_generic.whirlwind.01.orange'],hit:['jb2a.melee_generic.slash.01.orange'],aura:['jb2a.glint.white']},mediaTiming:{'jb2a.melee_generic.whirlwind.01.orange':{duration:1500,melee:false,baked:false}}};
  const recipe=featRecipe(feat),flourish=recipe.stages.find(s=>s.label==='Source flourish');
  assert.ok(flourish.oneShot);
  assert.equal(flourish.fadeIn,0);
  assert.equal(flourish.scaleInDuration,0);
  assert.deepEqual(flourish.tracks,[]);
  assert.ok(recipe.stages.some(s=>s.kind==='aura'&&!s.oneShot),'ambient direction applies to separate cue');
 }
});

test('Lightning Dash and Lava Leap include traversal/landing contacts without rays or extra weapon Strikes',()=>{
 for(const [slug,motion] of [['lightning-dash','rush'],['lava-leap','leap']]){
  const feat=reviewed(slug),recipe=featRecipe(feat),plan=previewPlan(recipe,{source,targets});
  assert.ok(recipe.stages.some(s=>s.kind==='motion'&&s.motion===motion),slug);
  assert.equal(plan.filter(s=>s.kind==='impact').length,targets.length,slug);
  assert.ok(!recipe.stages.some(s=>['travel','projectile'].includes(s.kind)),slug);
  assert.match(recipe.description,/approximate/i,'target route limitation stays explicit');
 }
});

test('trample contacts every selected victim once and never adds weapon Strikes',()=>{
 for(const slug of ['eidolons-trample','trample-centaur','trample-sarangay','trample-mimicry']){
  const feat=reviewed(slug),recipe=featRecipe(feat),plan=previewPlan(recipe,{source,targets});
  const contacts=plan.filter(s=>s.kind==='impact');
  assert.equal(contacts.length,targets.length,slug);
  assert.equal(new Set(contacts.map(s=>s.destination.id)).size,targets.length,slug);
  assert.ok(!recipe.stages.some(s=>['travel','projectile'].includes(s.kind)),slug);
 }
});

test('default directed paths allocate equal outbound and cosmetic reset travel time',()=>{
 for(const slug of ['sudden-charge','sudden-leap','flying-kick','tumbling-strike','incredible-sprint','marine-jet']){
  const move=featRecipe(reviewed(slug)).stages.find(s=>s.kind==='motion');
  const {arrival,release}=motionPhases(move);
  assert.ok(Math.abs(arrival-(1-release))<.00001,slug);
 }
});
