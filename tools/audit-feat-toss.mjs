import {writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {PF2E_FEATS,PF2E_FEAT_SOURCE,featRecipe} from '../scripts/catalogs/pf2e/feats/feat-catalog.mjs';
import {TOSS_NOTES} from '../scripts/catalogs/pf2e/feats/feat-toss.mjs';
import {visibleFeatComposition} from '../scripts/catalogs/pf2e/feats/feat-direction.mjs';
import {abilitySoundInfo} from '../scripts/engines/sound/ability-sounds.mjs';
import {assetDatabases} from './asset-databases.mjs';
import {previewPlan} from '../scripts/core/model.mjs';
const db=await assetDatabases();
const token=(id,x)=>({id,center:{x,y:100},document:{width:1,height:1}});
const context={source:token('performer',100),targets:[token('first',250),token('second',450),token('third',650)],gridSize:100};
const rows=Object.keys(TOSS_NOTES).map(slug=>{
 const f=PF2E_FEATS.find(f=>f.slug===slug),r=featRecipe(f),p=previewPlan(r,context);
 return {id:f.id,name:f.name,slug,descriptionChars:f.plainDescription.length,descriptionHash:f.descriptionHash,source:f.sourceUrl,nativeRoles:r.playbackRoles??null,review:TOSS_NOTES[slug],
  editions:Object.fromEntries(Object.entries(db).map(([edition,rows])=>{
   const keys=new Set(rows.map(row=>row.key));
   const effects=featRecipe(f,{motion:false});
   return [edition,{effectsOnlySignature:createHash('sha256').update(JSON.stringify(visibleFeatComposition(effects,keys,{motion:false}))).digest('hex'),media:r.stages.filter(s=>s.assets.length).map(s=>({label:s.label,key:s.assets.find(k=>keys.has(k))??null}))}];
  })),sound:abilitySoundInfo(f),motion:r.stages.filter(s=>s.kind==='motion').map(s=>({label:s.label,motion:s.motion,subject:s.subject,heading:s.motionHeading,distance:s.distance,duration:s.duration,requiresHit:s.requiresHit})),
  flights:p.filter(s=>s.kind==='travel').map(s=>({from:s.origin.id,to:s.destination.id,delay:s.delay,requiresHit:s.requiresHit})),contacts:p.filter(s=>s.kind==='impact').map(s=>({label:s.label,to:s.destination.id,delay:s.delay,requiresHit:s.requiresHit}))};
});
const issues=[];
for(const edition of Object.keys(db)){
 const signatures=new Set(rows.map(r=>r.editions[edition].effectsOnlySignature));
 if(signatures.size!==rows.length)issues.push(`${edition} effects-only duplicate`);
 for(const r of rows)if(r.editions[edition].media.some(s=>!s.key))issues.push(`${r.name}: missing ${edition} footage`);
}
const report={date:'2026-10-07',source:PF2E_FEAT_SOURCE.sha,scope:'Eight toss-related activities; their complete pinned native descriptions were read individually for this correction.',validation:'Native recipe planner, three ordered recipients, effects-only edition comparison, hit-gated branches, complete clip and motion reset regressions. Browser design preview uses installed Patreon videos; this report does not claim live multiplayer or installed-Free playback.',rows,issues};
await writeFile('data/feat-toss-audit-2026-10-07.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({entries:rows.length,distinctEffectsOnly:Object.fromEntries(Object.keys(db).map(e=>[e,new Set(rows.map(r=>r.editions[e].effectsOnlySignature)).size])),issues}));
if(issues.length)process.exitCode=1;
