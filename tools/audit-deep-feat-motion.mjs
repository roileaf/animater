import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { PF2E_FEATS, PF2E_FEAT_SOURCE } from '../data/pf2e-feats.mjs';
import { PF2E_SPELLS } from '../data/pf2e-spells.mjs';
import { PF2E_WEAPONS, weaponRecipe } from '../scripts/catalogs/pf2e/weapons/weapon-catalog.mjs';
import { featRecipe } from '../scripts/catalogs/pf2e/feats/feat-choreography.mjs';
import { spellRecipe } from '../scripts/catalogs/pf2e/spells/spell-choreography.mjs';
import { previewPlan, resolveAsset } from '../scripts/core/model.mjs';
import { motionPose, motionDirection } from '../scripts/engines/motion/motion.mjs';
import { isPathMotion, motionPhases } from '../scripts/engines/motion/motion-path.mjs';
import { FEAT_MOTION_PROFILES } from '../scripts/catalogs/pf2e/feats/feat-motion.mjs';
import { FEAT_TRAVERSAL_REVIEWS } from '../scripts/catalogs/pf2e/feats/feat-traversal.mjs';
import { GENERATED_MOTION_DURATION } from '../scripts/engines/motion/motion-pacing.mjs';
import { assetDatabases } from './asset-databases.mjs';
import { assetGeometry } from './spell-asset-selection.mjs';

const rereadSlugs=new Set(`dashing-pounce desiccating-inhalation divine-wings doctors-visitation double-shot drive-by-attack dual-weapon-blitz eidolons-trample evanescent-wings furious-sprint hit-the-dirt incredible-sprint kip-up lava-leap lightning-dash running-reload skirmish-strike sudden-charge sudden-leap tumbling-strike black-powder-boost dodging-roll elf-step explosive-leap flying-kick goblin-scuttle guarded-advance guarded-advance-knight-vigilant hop-up hunted-shot marine-jet mounting-leap nimble-dodge propelled-leap quick-positioning ratfolk-roll sonic-dash step-lively swift-leap burning-jet divert-streamflow ferry-through-waves fly-on-shadowed-wings lead-the-way log-roll march-the-mines pressure-change repositioning-block shadow-tempo shadowplay spinning-release trample-centaur trample-sarangay trample-mimicry winding-flow`.split(' '));
const count=values=>Object.fromEntries([...new Set(values)].sort().map(v=>[v,values.filter(x=>x===v).length]));
const token=(id,x,y=100,w=100,h=100)=>({id,center:{x,y},w,h,document:{x:x-w/2,y:y-h/2,width:w/100,height:h/100}});
const contexts=[
 {name:'three-victims',source:token('source',100),targets:[token('first',400),token('second',700),token('third',1000)]},
 {name:'large-rectangles',source:token('source',100,100,300,100),targets:[token('first',900,600,100,300)]},
 {name:'far',source:token('source',100),targets:[token('first',1900)]},
].map(context=>({...context,gridSize:100,gridDistance:5,template:{id:'template',center:{x:400,y:100}},area:{shape:'circle',center:{x:400,y:100},diameter:400,width:200,length:600,endpoint:{x:1000,y:100}}}));
const nativeContext=(item,context)=>{
 const spec=item.area;
 if(!spec?.type||!(spec.value>0))return context;
 const length=spec.value*context.gridSize/context.gridDistance;
 const center=['cone','line','emanation'].includes(spec.type)?context.source.center:context.area.center;
 const type=['square','cube','rect'].includes(spec.type)?'square':['cone','line'].includes(spec.type)?spec.type:'circle';
 const area={...context.area,type,shape:type,center,length,width:type==='line'?100:length,diameter:type==='square'?length:2*length,angle:90,endpoint:{x:center.x+length,y:center.y}};
 return {...context,area,template:{...context.template,center}};
};
const databases=await assetDatabases(), maps=Object.fromEntries(Object.entries(databases).map(([edition,rows])=>[edition,new Map(rows.map(row=>[row.key,row]))]));
const report={date:'2026-10-07',source:{sha:PF2E_FEAT_SOURCE.sha,version:PF2E_FEAT_SOURCE.version,active:PF2E_FEATS.length,excluded:PF2E_FEAT_SOURCE.excluded},method:{motionSamples:201,contexts:contexts.map(c=>c.name),source:'Complete shipped pinned descriptions hash-checked; explicitly listed subset fully re-read this pass. Native asset key/geometry audit uses installed Patreon plus official Free inventory. Mesh no-document-write behavior is covered by runtime regressions, not inferred from pure-pose sampling.'},reread:[],coverage:{},issues:[],motion:{},motionRecords:[],remainingSymbolic:[]};
for(const feat of PF2E_FEATS){
 const hash=createHash('sha256').update(feat.description).digest('hex');
 if(hash!==feat.descriptionHash||hash!==feat.review?.descriptionHash)report.issues.push({domain:'feat',id:feat.id,name:feat.name,reason:'Description provenance mismatch'});
 if(rereadSlugs.has(feat.slug)||FEAT_TRAVERSAL_REVIEWS[feat.slug])report.reread.push({id:feat.id,name:feat.name,slug:feat.slug,sourceUrl:feat.sourceUrl,descriptionHash:hash,...(FEAT_TRAVERSAL_REVIEWS[feat.slug]?{movementReview:FEAT_TRAVERSAL_REVIEWS[feat.slug].classification,reason:FEAT_TRAVERSAL_REVIEWS[feat.slug].reason}:{})});
 const recipe=featRecipe(feat);
 if(['double-shot','hunted-shot'].includes(feat.slug)&&feat.motif!=='ranged')report.issues.push({domain:'feat',id:feat.id,name:feat.name,reason:'Two ranged Strikes still have melee topology; catalog rebuild required'});
 if(['movement','flight'].includes(feat.motif)&&!recipe.stages.some(isPathMotion)){
  const review=FEAT_TRAVERSAL_REVIEWS[feat.slug];
  report.remainingSymbolic.push({id:feat.id,name:feat.name,subject:feat.subject,shape:feat.direction?.shape,classification:review?.classification??'unreviewed',reason:review?.reason??'Finite stationary/vertical cue; no authored route profile'});
  if(!review||review.motion)report.issues.push({domain:'feat',id:feat.id,name:feat.name,reason:'Movement description requires traversal but recipe remains stationary'});
 }
 for(const stage of recipe.stages){
  if(stage.oneShot&&/^jb2a\.(?:melee_generic\.|unarmed_strike\.)/.test(stage.assets?.[0]??'')&&(stage.fadeIn||stage.scaleInDuration||stage.tracks.length))report.issues.push({domain:'feat',id:feat.id,name:feat.name,stage:stage.label,reason:'Native physical one-shot modified by entrance animation'});
 }
}
for(const [edition,rows] of Object.entries(databases)){
 const used=new Set(),contactKeys=new Set();let plans=0,stages=0;
 for(const feat of PF2E_FEATS){
  const recipe=featRecipe(feat);
  for(const context of contexts){
   try{
    const plan=previewPlan(recipe,context);plans++;stages+=plan.length;
    for(const stage of plan.filter(s=>s.assets?.length)){
     const key=resolveAsset(stage,rows),row=maps[edition].get(key);used.add(key);
     if(stage.kind==='impact'&&row?.templateName?.startsWith('melee'))contactKeys.add(key);
     if(!row)report.issues.push({domain:'feat',id:feat.id,name:feat.name,edition,stage:stage.label,reason:`Missing installed-edition key ${key}`});
     else if(['cast','impact','aura'].includes(stage.kind)&&assetGeometry(row)!=='radial')report.issues.push({domain:'feat',id:feat.id,name:feat.name,edition,stage:stage.label,reason:`Localized stage has ${assetGeometry(row)} geometry`});
    }
   }catch(error){report.issues.push({domain:'feat',id:feat.id,name:feat.name,edition,context:context.name,reason:error.message});}
  }
 }
 report.coverage[edition]={available:rows.length,plans,stages,selectedKeys:used.size,nativeContactKeys:[...contactKeys].sort(),families:[...new Set([...used].map(key=>key?.split('.')[1]))].sort()};
}
const weaponModes=PF2E_WEAPONS.flatMap(weapon=>weapon.modes.map(mode=>({...weapon,auditMode:mode.mode})));
const catalogs=[['feat',PF2E_FEATS,featRecipe],['spell',PF2E_SPELLS,spellRecipe],['weapon',weaponModes,item=>weaponRecipe(item,item.auditMode)]];
for(const [domain,items,factory] of catalogs){
 let recipesWithMotion=0,stages=0;const kinds=[];
 for(const item of items){
  const recipe=factory(item);
  if(recipe.stages.some(s=>s.kind==='motion'))recipesWithMotion++;
  for(const context of contexts){
   const actualContext=nativeContext(item,context);
   let plan;
   try { plan=previewPlan(recipe,actualContext); }
   catch(error){report.issues.push({domain,id:item.id,name:item.name,context:context.name,reason:error.message});continue;}
   for(const stage of plan.filter(s=>s.kind==='motion')){
    if(isPathMotion(stage)&&stage.duration<GENERATED_MOTION_DURATION[stage.motion])report.issues.push({domain,id:item.id,name:item.name,stage:stage.label,context:context.name,reason:'Generated path is below its readable motion-duration floor'});
    const overlappingRepeat=plan.find(other=>other!==stage&&other.kind==='motion'&&other.stageId===stage.stageId&&other.destination?.id===stage.destination?.id&&other.delay<stage.delay&&other.delay+other.duration>stage.delay);
    if(isPathMotion(stage)&&overlappingRepeat)report.issues.push({domain,id:item.id,name:item.name,stage:stage.label,context:context.name,reason:'Repeated path overlaps its earlier pose instead of completing a distinct route'});
    if(context===contexts[0]){stages++;kinds.push(stage.motion);}
    const target=stage.motionTarget??context.targets[stage.targetIndex??0];
    const direction=motionDirection(stage.destination,context.source,target,stage.motion,100);
    let previous=null,maximumDisplacement=0,peakSpeed=0;
    for(let sample=0;sample<=200;sample++){
     const pose=motionPose(stage,sample/200,direction,100);
     if(Object.values(pose).some(value=>!Number.isFinite(value)))report.issues.push({domain,id:item.id,name:item.name,stage:stage.label,reason:'Non-finite token pose'});
     maximumDisplacement=Math.max(maximumDisplacement,Math.hypot(pose.x,pose.y));
     if(previous)peakSpeed=Math.max(peakSpeed,Math.hypot(pose.x-previous.x,pose.y-previous.y)/(stage.duration/200/1000)/100);
     previous=pose;
    }
    const end=motionPose(stage,1,direction,100);
    if(end.x||end.y||end.rotation||end.scale!==1)report.issues.push({domain,id:item.id,name:item.name,stage:stage.label,reason:'Motion does not restore neutral pose'});
    const phases=isPathMotion(stage)?motionPhases(stage):null;
    report.motionRecords.push({domain,id:item.id,name:item.name,...(item.auditMode?{mode:item.auditMode}:{}),context:context.name,stage:stage.label,motion:stage.motion,duration:stage.duration,maxDisplacementSquares:+(maximumDisplacement/100).toFixed(3),peakTranslationSquaresPerSecond:+peakSpeed.toFixed(3),...(phases?{outbound:phases.arrival,hold:phases.release-phases.arrival,return:1-phases.release}:{}),...(item.direction?.origin?{origin:item.direction.origin}:{})});
   }
  }
 }
 report.motion[domain]={items:items.length,recipesWithMotion,plannedMotionStagesWithThreeTargets:stages,kinds:count(kinds)};
}
report.directedProfiles=Object.keys(FEAT_MOTION_PROFILES).length;
report.reviewedMovementDescriptions=Object.keys(FEAT_TRAVERSAL_REVIEWS).length;
report.reviewedTraversalProfiles=Object.values(FEAT_TRAVERSAL_REVIEWS).filter(review=>review.motion).length;
report.movementClassifications=count(Object.values(FEAT_TRAVERSAL_REVIEWS).map(review=>review.classification));
report.nonCasterOrigins=PF2E_FEATS.filter(f=>f.direction?.origin&&!/source|caster|self/.test(f.direction.origin)).map(f=>({id:f.id,name:f.name,origin:f.direction.origin,constraints:f.direction.constraints}));
report.rereadCount=report.reread.length;
report.remainingSymbolicCount=report.remainingSymbolic.length;
const path=process.argv[2]??'data/deep-feat-motion-audit-2026-10-07.json';
await writeFile(path,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({source:report.source,reread:report.rereadCount,directedProfiles:report.directedProfiles,reviewedMovementDescriptions:report.reviewedMovementDescriptions,reviewedTraversalProfiles:report.reviewedTraversalProfiles,movementClassifications:report.movementClassifications,coverage:report.coverage,motion:report.motion,remainingSymbolic:report.remainingSymbolicCount,issues:report.issues.length,examples:report.issues.slice(0,8)},null,2));
if(report.issues.length)process.exitCode=1;
