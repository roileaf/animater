import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { PF2E_SOURCE, PF2E_SPELLS, spellRecipe } from '../scripts/catalogs/pf2e/spells/spell-catalog.mjs';
import { PF2E_FEATS, PF2E_FEAT_SOURCE, featRecipe } from '../scripts/catalogs/pf2e/feats/feat-catalog.mjs';
import { PF2E_WEAPONS, weaponRecipe } from '../scripts/catalogs/pf2e/weapons/weapon-catalog.mjs';
import { PF2E_CONDITIONS, PF2E_EFFECTS, stateRecipe } from '../scripts/catalogs/pf2e/state-catalog.mjs';
import { dndEntries, dndRecipe, DND5E_SOURCE } from '../scripts/catalogs/dnd5e/dnd5e-catalog.mjs';
import { previewPlan } from '../scripts/core/model.mjs';
import { timedStages } from '../scripts/engines/playback/composition.mjs';
import { motionDirection, motionPose } from '../scripts/engines/motion/motion.mjs';
import { isPathMotion } from '../scripts/engines/motion/motion-path.mjs';
import { GENERATED_MOTION_DURATION } from '../scripts/engines/motion/motion-pacing.mjs';
import { SPELL_MOTION_REVIEWS, FEAT_ACTION_MOTION_REVIEWS, dndMotionReview } from '../scripts/catalogs/shared/catalog-motion.mjs';
import { TOSS_NOTES } from '../scripts/catalogs/pf2e/feats/feat-toss.mjs';

const baselineArg = process.argv.indexOf('--baseline');
const baseline = baselineArg >= 0 ? JSON.parse(await readFile(process.argv[baselineArg + 1], 'utf8')).rows : [];
const identity = r => [r.system, r.kind, r.id, r.variant ?? ''].join(':');
const previous = new Map(baseline.map(r => [identity(r), r]));
const motionFields = ['motion','subject','duration','distance','intensity','motionRange','motionHeading','motionEndpoint','motionArrival','motionHold','jumpHeight','repeats','repeatScope','repeatInterval'];
const signature = motions => JSON.stringify(motions.map(s => Object.fromEntries(motionFields.map(k => [k, s[k]]))));
const rows = [];
const add = (system, kind, item, variant, build, reviewed) => rows.push({system,kind,id:item.id,slug:item.slug,name:item.name,variant,item,build,reviewed});
for (const s of PF2E_SPELLS.filter(s => !s.design?.unavailable && s.design?.motif !== 'generic'))
  add('pf2e','spell',s,undefined,o => spellRecipe(s,undefined,o),SPELL_MOTION_REVIEWS[s.slug]);
for (const f of PF2E_FEATS) add('pf2e','feat',f,undefined,o => featRecipe(f,o),TOSS_NOTES[f.slug] ? {reason:TOSS_NOTES[f.slug],authored:true} : FEAT_ACTION_MOTION_REVIEWS[f.slug]);
for (const w of PF2E_WEAPONS) for (const m of w.modes) add('pf2e','weapon',w,m.mode,o => weaponRecipe(w,m.mode,o));
for (const e of dndEntries().filter(e => !['condition','effect'].includes(e.kind)))
  for (const v of e.variants) add('dnd5e',e.kind,e,v.id,o => dndRecipe(e,v.id,o),dndMotionReview(e,v));
const token = (id,x,y=100,w=100,h=100) => ({id,center:{x,y},w,h,document:{x:x-w/2,y:y-h/2,width:w/100,height:h/100}});
const contexts = [
  {name:'three-targets',source:token('source',100),targets:[token('first',400),token('second',700),token('third',1000)]},
  {name:'large-rectangles',source:token('source',100,100,300,100),targets:[token('first',900,600,100,300)]},
  {name:'far-target',source:token('source',100),targets:[token('first',1900)]},
].map(c => ({...c,gridSize:100,gridDistance:5,template:{id:'template',center:{x:400,y:100}},area:{shape:'circle',center:{x:400,y:100},diameter:400,width:200,length:600,endpoint:{x:1000,y:100}}}));
const report = {date:'2026-10-07',sources:{pf2e:PF2E_SOURCE.sha,feats:PF2E_FEAT_SOURCE.sha,dnd5e:DND5E_SOURCE.sha},
  method:{scope:'Every ready transient recipe and native activity/use variant; persistent catalogs checked separately. Automated timing/pose scan, not a claim of manual review of every description.',poseSamples:201,contexts:contexts.map(c=>c.name),
    reviewed:'Complete descriptions re-read for the explicitly listed movement replacements. Physical ranged releases additionally use the existing description-derived weapon/motif and actual source-origin flight.',
    runtime:'Pure pose sampling and existing mocked runtime regressions; design preview browser checks recorded in the companion document. Live Foundry multiplayer was not exercised this pass.'},
  coverage:{},changed:[],reviewed:[],noMotion:[],persistent:{},checks:{recipes:0,effectsOnly:0,plans:0,poses:0},issues:[]};
const issue = (r, reason, detail={}) => report.issues.push({system:r.system,kind:r.kind,id:r.id,name:r.name,variant:r.variant,reason,...detail});
for (const r of rows) {
  const recipe=r.build({}),still=r.build({motion:false}),motions=recipe.stages.filter(s=>s.kind==='motion');
  r.motions=motions;
  report.checks.recipes++;report.checks.effectsOnly++;
  const ids=new Set(recipe.stages.map(s=>s.stageId)),stillIds=new Set(still.stages.map(s=>s.stageId));
  for (const s of recipe.stages) if (s.afterStage && !ids.has(s.afterStage)) issue(r,'Missing timing anchor',{stage:s.label});
  for (const s of still.stages) if (s.kind==='motion' || s.afterStage && !stillIds.has(s.afterStage)) issue(r,'Effects-only retains motion or dangling anchor',{stage:s.label});
  if (still.stages.length!==recipe.stages.length-motions.length) issue(r,'Effects-only loses non-motion stages');
  for (const s of timedStages(recipe)) if (!Number.isFinite(s.delay+s.duration) || s.delay<0) issue(r,'Invalid playback timing',{stage:s.label});
  const old=previous.get(identity(r));
  if (old && signature(old.motions)!==signature(motions)) report.changed.push({system:r.system,kind:r.kind,id:r.id,slug:r.slug,name:r.name,variant:r.variant,before:old.motions.map(s=>s.motion),after:motions.map(s=>s.motion),reviewed:!!r.reviewed});
  if (r.reviewed) {
    const description=r.item.description??r.item.descriptionText??old?.description;
    report.reviewed.push({system:r.system,kind:r.kind,id:r.id,slug:r.slug,name:r.name,variant:r.variant,
      descriptionHash:description?createHash('sha256').update(description).digest('hex'):null,
      sourceUrl:r.item.sourceUrl??r.item.sourceURL??`https://github.com/foundryvtt/pf2e/blob/${PF2E_SOURCE.sha}/${r.item.path}`,
      profile:r.reviewed,performerRoles:recipe.playbackRoles??null});
  }
  if (!motions.length) report.noMotion.push({system:r.system,kind:r.kind,id:r.id,name:r.name,variant:r.variant,design:r.item.design?.pattern??r.item.motif,
    reason:r.item.kind==='weapon'?'Native variant is not a resolved weapon attack; inspect activity before adding a release.':'No motion inferred solely from activation: may depict an object/field, a later grant, an unresolved performer, or a nonphysical action. Not individually re-read in this pass.'});
  for (const context of contexts) {
    const spec=r.item.area;
    const shape=recipe.stages.some(s=>s.areaLayout==='fan')?'cone':spec?.type;
    const length=(spec?.value??30)*context.gridSize/context.gridDistance;
    const area=shape?{...context.area,type:shape,shape,center:['cone','line','emanation'].includes(shape)?context.source.center:context.area.center,length,diameter:length*2,width:shape==='line'?100:length,angle:90,endpoint:{x:context.source.center.x+length,y:context.source.center.y}}:context.area;
    const actual={...context,area,template:{...context.template,center:area.center}};
    let plan;
    try {plan=previewPlan(recipe,actual);report.checks.plans++;}
    catch(error) {issue(r,'Planning failed',{context:context.name,detail:error.message});continue;}
    for (const stage of plan.filter(s=>s.kind==='motion')) {
      if (isPathMotion(stage) && stage.duration<GENERATED_MOTION_DURATION[stage.motion]) issue(r,'Path below readable duration floor',{stage:stage.label});
      const direction=motionDirection(stage.destination,context.source,stage.motionTarget??context.targets[stage.targetIndex??0],stage.motion,100);
      for (let sample=0;sample<=200;sample++) {
        const pose=motionPose(stage,sample/200,direction,100);report.checks.poses++;
        if (Object.values(pose).some(value=>!Number.isFinite(value))) {issue(r,'Non-finite pose',{stage:stage.label});break;}
        if (sample===200 && (pose.x||pose.y||pose.rotation||pose.scale!==1)) issue(r,'Motion does not restore neutral pose',{stage:stage.label});
      }
    }
  }
}
const counts=rs=>({recipes:rs.length,withMotion:rs.filter(r=>r.motions.length).length,withPath:rs.filter(r=>r.motions.some(isPathMotion)).length,motionStages:rs.reduce((n,r)=>n+r.motions.length,0)});
for (const system of ['pf2e','dnd5e']) for (const kind of ['spell','feat','weapon','item']) {
  const rs=rows.filter(r=>r.system===system&&r.kind===kind);if (!rs.length) continue;
  report.coverage[`${system}-${kind}`]={...counts(rs),...(baseline.length?{before:counts(baseline.filter(r=>r.system===system&&r.kind===kind))}:{}),changed:report.changed.filter(r=>r.system===system&&r.kind===kind).length};
}
const stateRows=[...PF2E_CONDITIONS,...PF2E_EFFECTS].map(e=>({system:'pf2e',kind:e.kind,id:e.id,name:e.name,recipe:stateRecipe(e)}));
for (const e of dndEntries().filter(e=>['condition','effect'].includes(e.kind))) for (const v of e.variants) stateRows.push({system:'dnd5e',kind:e.kind,id:e.id,name:e.name,recipe:dndRecipe(e,v.id)});
for (const s of stateRows) if (s.recipe.stages.some(t=>['motion','sound'].includes(t.kind))) issue(s,'Persistent loop moves token or plays repeated audio');
for (const system of ['pf2e','dnd5e']) report.persistent[system]={recipes:stateRows.filter(r=>r.system===system).length,motion:0,reason:'Document-linked fields and status loops remain quiet, without replaying token movement on refresh.'};
report.reviewedCount=report.reviewed.length;report.changedCount=report.changed.length;
await writeFile('data/catalog-motion-coverage-audit.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({coverage:report.coverage,reviewed:report.reviewedCount,changed:report.changedCount,persistent:report.persistent,checks:report.checks,issues:report.issues.length,examples:report.issues.slice(0,8)},null,2));
if(report.issues.length) process.exitCode=1;
