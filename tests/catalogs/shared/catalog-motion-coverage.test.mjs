import test from 'node:test';
import assert from 'node:assert/strict';
import {PF2E_SPELLS,spellRecipe,automaticCatalogRecipe} from '../../../scripts/catalogs/pf2e/spells/spell-catalog.mjs';
import {PF2E_FEATS,featRecipe} from '../../../scripts/catalogs/pf2e/feats/feat-catalog.mjs';
import {dndEntries,dndRecipe} from '../../../scripts/catalogs/dnd5e/dnd5e-catalog.mjs';
import {timedStages} from '../../../scripts/engines/playback/composition.mjs';
import {isPathMotion,motionPhases} from '../../../scripts/engines/motion/motion-path.mjs';
import {motionPose} from '../../../scripts/engines/motion/motion.mjs';
import {pf2eEvent} from '../../../scripts/systems/adapters.mjs';
import {previewPlan} from '../../../scripts/core/model.mjs';
const spell=slug=>PF2E_SPELLS.find(s=>s.slug===slug),feat=slug=>PF2E_FEATS.find(s=>s.slug===slug);
const route=r=>r.stages.find(isPathMotion);
const arrival=(r,s)=>timedStages(r).find(t=>t.stageId===s.stageId).delay+s.duration*motionPhases(s).arrival;
test('movement combined with combat uses a real path and contacts follow its arrival',()=>{
 for(const slug of ['dual-weapon-blitz','blazing-talon-surge','flying-tackle','running-tackle','scouts-pounce','swimming-charge','needle-in-the-gods-eyes']){
  const r=featRecipe(feat(slug)),s=route(r);assert.ok(s,slug+' needs traversal');
  assert.ok(s.duration>=2200);assert.ok(s.distance>=1);assert.equal(s.subject,'source');
  for(const hit of r.stages.filter(t=>t.kind==='impact'&&t.afterStage===s.stageId))assert.equal(hit.timingAnchor,'arrival');
  assert.deepEqual(motionPose(s,1,{x:1,y:0,length:600,clearance:100},100),{x:0,y:0,rotation:0,scale:1});
 }
});
test('Parting Shot retreats before firing; Hurling Charge fires before advancing',()=>{
 const part=featRecipe(feat('parting-shot')),p=route(part),pShot=timedStages(part).find(s=>s.kind==='travel');assert.ok(p);assert.equal(p.motionHeading,'away');assert.ok(pShot.delay>=arrival(part,p));
 const hurl=featRecipe(feat('hurling-charge')),h=route(hurl),hShot=timedStages(hurl).find(s=>s.kind==='travel');assert.ok(h);assert.ok(timedStages(hurl).find(s=>s.stageId===h.stageId).delay>=hShot.delay+hShot.duration);
});

test('ally movement honors each willing recipient and native target limits',()=>{
 const token=(id,x)=>({id,center:{x,y:100},document:{width:1,height:1}});
 const context={source:token('caster',100),targets:[1,2,3,4,5].map(i=>token('ally'+i,100+i*200)),gridSize:100};
 for(const [r,count] of [[featRecipe(feat('four-winds')),4],[spellRecipe(spell('friendfetch')),2],[spellRecipe(spell('friendly-push')),1],[featRecipe(feat('friendly-toss')),1]]){
  const moved=previewPlan(r,context).filter(isPathMotion);
  assert.equal(moved.length,count,r.name);assert.equal(new Set(moved.map(s=>s.destination.id)).size,count);
  assert.ok(moved.every(s=>s.destination!==context.source));
 }
 const blitz=timedStages(featRecipe(feat('dual-weapon-blitz'))).filter(s=>s.kind==='impact');
 const pack=timedStages(featRecipe(feat('pack-movement'))).filter(s=>s.kind==='impact');
 assert.equal(pack[1].delay-pack[0].delay,200);assert.ok(blitz[1].delay-blitz[0].delay>=600);
});
test('spell movement is creature motion; movement grants stay activation-only',()=>{
 for(const slug of ['airlift','comet-charge','dive-and-breach','earth-and-sky','warp-step','friendfetch','friendly-push'])assert.ok(route(spellRecipe(spell(slug))),slug);
 assert.equal(route(spellRecipe(spell('warp-step'))).repeats,2);
 assert.equal(route(spellRecipe(spell('friendfetch'))).subject,'targets');
 // The pull is acted out only when nobody is teleported: a teleported ally is already beside the caster.
 assert.equal(route(spellRecipe(spell('friendfetch'))).skipOnTeleport,true);
 assert.equal(route(spellRecipe(spell('friendly-push'))).motionHeading,'away');
 for(const slug of ['synchronize-steps','connective-current','wind-jump','earthbreaker-stride'])assert.equal(route(spellRecipe(spell(slug))),undefined,slug+' grants a later action');
});
test('D&D native movement activations use paths and preserve activity choices',()=>{
 for(const slug of ['aggressive','rampage','prowl','adrenaline-rush','world-shaking-movement']){
  const e=dndEntries('feat').find(s=>s.slug===slug);assert.ok(route(dndRecipe(e)),slug);
 }
 const cunning=dndEntries('feat').find(e=>e.slug==='cunning-strike');
 for(const v of cunning.variants){const r=dndRecipe(cunning,v.id);if(/withdraw/i.test(v.activityName))assert.ok(route(r));else assert.equal(route(r),undefined,'Poison/Trip/damage activities must not withdraw');}
 const leap=dndEntries('feat').find(e=>e.slug==='deadly-leap'&&e.edition==='2024');assert.equal(route(dndRecipe(leap)).motion,'leap');
});
test('PF2e Jump jumps at base rank, grants future Leaps when heightened, and uses native cast rank',()=>{
 const item=spell('jump');
 const base=spellRecipe(item),heightened=spellRecipe(item,undefined,{castRank:3});
 assert.equal(route(base).subject,'source');assert.equal(route(base).motion,'leap');
 assert.equal(route(heightened),undefined);
 const event={type:item.trigger,castRank:3,item:{name:item.name,type:'spell',system:{slug:item.slug}}};
 assert.equal(route(automaticCatalogRecipe(event,{enabled:true,scope:'all',motion:true})),undefined);
 assert.equal(pf2eEvent({id:'rank',author:{id:'u'},item:event.item,isRoll:false,flags:{pf2e:{origin:{castRank:3}}}},'u').castRank,3);
});
test('Hippocampus Retreat transforms its caster, attacks once, then swims away',()=>{
 const r=spellRecipe(spell('hippocampus-retreat')),s=route(r),contacts=r.stages.filter(s=>s.kind==='impact');
 assert.equal(contacts.length,1);assert.equal(s.subject,'source');assert.equal(s.motionHeading,'away');
 assert.ok(timedStages(r).find(t=>t.stageId===s.stageId).delay>timedStages(r).find(t=>t.stageId===contacts[0].stageId).delay);
 for(const copy of r.stages.filter(s=>s.kind==='sprite'))assert.equal(copy.subject,'source');
});
test('effects-only resolves every removed motion anchor and retains artwork',()=>{
 const rows=[...['dual-weapon-blitz','parting-shot','temporal-fury','hurling-charge'].map(slug=>o=>featRecipe(feat(slug),o)),...['warp-step','comet-charge','dive-and-breach'].map(slug=>o=>spellRecipe(spell(slug),undefined,o)),...dndEntries('feat').filter(e=>['rampage','deadly-leap','cunning-strike'].includes(e.slug)).flatMap(e=>e.variants.map(v=>o=>dndRecipe(e,v.id,o)))];
 for(const build of rows){const full=build({}),still=build({motion:false});assert.ok(!still.stages.some(s=>s.kind==='motion'));assert.equal(still.stages.length,full.stages.filter(s=>s.kind!=='motion').length);const ids=new Set(still.stages.map(s=>s.stageId));for(const s of still.stages)assert.ok(!s.afterStage||ids.has(s.afterStage),full.name+' dangling anchor');assert.doesNotThrow(()=>timedStages(still));}
});
