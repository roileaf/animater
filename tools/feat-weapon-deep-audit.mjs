import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {PF2E_FEATS,PF2E_FEAT_SOURCE} from '../data/pf2e-feats.mjs';
import {PF2E_WEAPONS,PF2E_WEAPON_SOURCE} from '../data/pf2e-weapons.mjs';
import {featRecipe} from '../scripts/catalogs/pf2e/feats/feat-choreography.mjs';
import {weaponRecipe} from '../scripts/catalogs/pf2e/weapons/weapon-choreography.mjs';
import {planRecipe} from '../scripts/core/model.mjs';
import {motionPose,motionDirection} from '../scripts/engines/motion/motion.mjs';
import {isPathMotion} from '../scripts/engines/motion/motion-path.mjs';
import {GENERATED_MOTION_DURATION} from '../scripts/engines/motion/motion-pacing.mjs';
import {visibleFeatComposition,featPlaybackRoles} from '../scripts/catalogs/pf2e/feats/feat-direction.mjs';
import {assetDatabases} from './asset-databases.mjs';
import {assetGeometry} from './spell-asset-selection.mjs';
import {analyzeWeapon} from './weapon-semantics.mjs';
import {weaponSources} from './pf2e-weapon-source.mjs';
const scope=JSON.parse(await readFile(new URL('../data/full-feat-weapon-review-scope-2026-10-07.json',import.meta.url),'utf8'));
const databases=await assetDatabases(),maps=Object.fromEntries(Object.entries(databases).map(([edition,rows])=>[edition,new Map(rows.map(r=>[r.key,r]))]));
const source={id:'source',center:{x:100,y:100},w:100,h:100,document:{x:50,y:50,width:1,height:1}};
const token=(id,x,y=100)=>({id,center:{x,y},w:100,h:100,document:{x:x-50,y:y-50,width:1,height:1}});
const contexts=[{name:'near-one',source,targets:[token('target-1',220)],gridSize:100},{name:'far-one',source,targets:[token('target-1',1300)],gridSize:100},{name:'six-selected',source,targets:Array.from({length:6},(_,i)=>token(`target-${i+1}`,350+150*i)),gridSize:100}];
const report={date:'2026-10-07',source:{featSha:PF2E_FEAT_SOURCE.sha,weaponSha:PF2E_WEAPON_SOURCE.sha},inventory:Object.fromEntries(Object.entries(databases).map(([e,rows])=>[e,rows.length])),individualReview:{feats:scope.feats.length,weapons:scope.weapons.length,scope:'Full descriptions explicitly listed in review-scope JSON. All other entries receive corpus checks, not a claim of individual reading.'},coverage:{feats:0,weaponDocuments:0,weaponModes:0,editionContextPlans:0,motionInstances:0,explicitRoleFeats:0},selection:{},routing:[],motionRecords:[],issues:[]};
const signatures={patreon:new Set(),free:new Set()},keys={feat:{patreon:new Set(),free:new Set()},weapon:{patreon:new Set(),free:new Set()}};
const native=await weaponSources(),nativeMap=new Map(native.weapons.map(e=>[e.source._id,e]));
const issue=(domain,item,reason,extra={})=>report.issues.push({domain,id:item.id,name:item.name,reason,...extra});
function audit(domain,item,recipe){
 const hash=createHash('sha256').update(item.description).digest('hex').slice(0,item.descriptionHash.length);
 if(hash!==item.descriptionHash)issue(domain,item,'Raw full-description hash differs from source provenance');
 for(const edition of ['patreon','free']){
  const catalog=maps[edition];
  if(domain==='feat')signatures[edition].add(JSON.stringify(visibleFeatComposition(recipe,new Set(catalog.keys()))));
  for(const context of contexts){
   let plan;try{plan=planRecipe(recipe,databases[edition],context);}catch(error){issue(domain,item,error.message,{edition,context:context.name});continue;}
   report.coverage.editionContextPlans++;
   for(const stage of plan){
    if(!['motion','sprite','sound'].includes(stage.kind)){
     const key=stage.asset??stage.assets.find(k=>catalog.has(k)),row=catalog.get(key);
     if(!row)issue(domain,item,'Missing installed-edition effect key',{edition,stage:stage.label});
     else{
      keys[domain][edition].add(key);const geometry=assetGeometry(row);
      if(['cast','aura','impact'].includes(stage.kind)&&geometry!=='radial')issue(domain,item,'Local contact or aura uses directional footage',{edition,stage:stage.label,key,geometry});
      if(stage.kind==='travel'&&geometry==='radial')issue(domain,item,'Stretched travel uses localized footage',{edition,stage:stage.label,key});
     }
    }
    if(stage.kind==='motion'){
     report.coverage.motionInstances++;const grid=context.gridSize;
     const selected=stage.targetSelection==='last'?context.targets.at(-1):stage.targetSelection==='second'?context.targets[1]:stage.targetSelection==='third'?context.targets[2]:context.targets[0];
     const direction=motionDirection(stage.subject==='targets'?stage.destination:source,source,selected,stage.motion,grid);
     const end=motionPose(stage,1,direction,grid);
     if(end.x||end.y||end.rotation||end.scale!==1)issue(domain,item,'Cosmetic motion does not restore neutral pose',{edition,context:context.name,stage:stage.label});
     let previous=null,maximumDisplacement=0,peakSpeed=0;
     for(let i=0;i<=200;i++){
      const pose=motionPose(stage,i/200,direction,grid);
      if(Object.values(pose).some(v=>!Number.isFinite(v)))issue(domain,item,'Non-finite cosmetic pose',{edition,stage:stage.label});
      maximumDisplacement=Math.max(maximumDisplacement,Math.hypot(pose.x,pose.y)/grid);
      if(previous)peakSpeed=Math.max(peakSpeed,Math.hypot(pose.x-previous.x,pose.y-previous.y)/grid/(stage.duration/200/1000));
      previous=pose;
     }
     if(edition==='patreon')report.motionRecords.push({domain,id:item.id,name:item.name,context:context.name,stage:stage.label,motion:stage.motion,duration:stage.duration,maxDisplacementSquares:+maximumDisplacement.toFixed(3),peakTranslationSquaresPerSecond:+peakSpeed.toFixed(3)});
     if(isPathMotion(stage)&&stage.duration<GENERATED_MOTION_DURATION[stage.motion])issue(domain,item,'Generated path is below its readable duration floor',{edition,stage:stage.label});
     const overlap=plan.some(other=>other!==stage&&other.kind==='motion'&&other.stageId===stage.stageId&&other.destination?.id===stage.destination?.id&&other.delay<stage.delay&&other.delay+other.duration>stage.delay);
     if(isPathMotion(stage)&&overlap)issue(domain,item,'Repeated traversal begins before earlier reset finishes',{edition,stage:stage.label});
    }
   }
   if(domain==='weapon'){
    const expected=item.modes.find(m=>m.mode===recipe.weaponMode);
    if(plan.some(s=>s.destination?.id==='target-2'))issue(domain,item,'Single weapon use spills to unrelated selected foe',{edition,mode:recipe.weaponMode});
    if(expected.mode==='melee'&&plan.some(s=>s.kind==='travel'))issue(domain,item,'Melee use emits an unintended flight',{edition});
    if(expected.mode!=='melee'&&!plan.some(s=>s.kind==='travel'))issue(domain,item,'Ranged/thrown use has no traveling weapon',{edition});
    if(!plan.some(s=>s.kind==='impact'))issue(domain,item,'Weapon use has no arrival/contact finish',{edition});
   }
  }
 }
}
for(const feat of PF2E_FEATS){try{
 const roles=featPlaybackRoles(feat);
 if(roles){report.coverage.explicitRoleFeats++;report.routing.push({id:feat.id,name:feat.name,...roles});if(JSON.stringify(feat.playbackRoles)!==JSON.stringify(roles))issue('feat',feat,'Generated performer/recipient roles differ from current native review; rebuild required');}
 audit('feat',feat,featRecipe(feat));report.coverage.feats++;
}catch(e){issue('feat',feat,e.message);}}
for(const weapon of PF2E_WEAPONS){
 const entry=nativeMap.get(weapon.id);if(!entry){issue('weapon',weapon,'Native pinned source document missing');continue;}
 const current=analyzeWeapon(entry.source,entry.path);
 for(const [i,mode] of weapon.modes.entries()){
  const wanted=current.modes[i];
  if(!wanted||['mode','family','damage','element','persistent','returning','onHitCue'].some(k=>JSON.stringify(mode[k])!==JSON.stringify(wanted[k]))||JSON.stringify(mode.payload)!==JSON.stringify(wanted.payload))issue('weapon',weapon,'Generated usage semantics differ from current native analyzer; rebuild required',{mode:mode.mode});
  try{audit('weapon',weapon,weaponRecipe(weapon,mode.mode));report.coverage.weaponModes++;}catch(e){issue('weapon',weapon,e.message,{mode:mode.mode});}
 }
 report.coverage.weaponDocuments++;
}
for(const domain of ['feat','weapon'])report.selection[domain]=Object.fromEntries(['patreon','free'].map(edition=>[edition,{keys:keys[domain][edition].size,families:new Set([...keys[domain][edition]].map(k=>k.split('.').slice(0,2).join('.'))).size}]));
report.selection.feat.visibleGraphFingerprints=Object.fromEntries(['patreon','free'].map(e=>[e,signatures[e].size]));
report.selection.note='Counts are actual selected keys and quantized visible graph fingerprints, not bespoke animations or proof of perceptual uniqueness. Framing/entrance/timing differences can split fingerprints while family structures remain shared; use the parent broad-family audit for similarity clusters.';
report.contexts=contexts.map(c=>c.name);
await writeFile(new URL('../data/full-feat-weapon-audit-2026-10-07.json',import.meta.url),JSON.stringify(report,null,2));
const {motionRecords,routing,...summary}=report;
console.log(JSON.stringify({...summary,issues:report.issues.slice(0,15),issueCount:report.issues.length},null,2));
if(report.issues.length)process.exitCode=1;
