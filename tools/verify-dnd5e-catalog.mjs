import {writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {dndEntries,dndRecipe,DND5E_SOURCE} from '../scripts/catalogs/dnd5e/dnd5e-catalog.mjs';
import {planRecipe,resolveAsset} from '../scripts/core/model.mjs';
import {assetDatabases} from './asset-databases.mjs';
import {assetGeometry} from './spell-asset-selection.mjs';
import {isPathMotion} from '../scripts/engines/motion/motion-path.mjs';
import {dndMotionReview} from '../scripts/catalogs/shared/catalog-motion.mjs';
import {GENERATED_MOTION_DURATION} from '../scripts/engines/motion/motion-pacing.mjs';
const db=await assetDatabases(),entries=dndEntries(),issues=[],ledger=[];
const context={gridSize:100,source:{id:'caster',center:{x:0,y:0},w:100,h:100},targets:Array.from({length:5},(_,i)=>({id:'target-'+i,center:{x:200+i*200,y:200},w:100,h:100})),template:{id:'area'}};
const editions=Object.fromEntries(Object.keys(db).map(k=>[k,{keys:new Set(),families:new Set(),plannedStages:0}])),configurations=new Set(),profiles=new Set(),soundFiles=new Set();
let motionRecipes=0,motionStages=0,audibleVariants=0,quietVariants=0,reviewedVariants=0;
for(const entry of entries)for(const variant of entry.variants){
 const recipe=dndRecipe(entry,variant.id,{sounds:{resolve:c=>c}});
 const hash=createHash('sha256').update(JSON.stringify(recipe.stages.map(({label,stageId,afterStage,optionalSound,...s})=>({...s,afterIndex:afterStage?recipe.stages.findIndex(p=>p.stageId===afterStage):-1})))).digest('hex');configurations.add(hash);
 const motions=recipe.stages.filter(s=>s.kind==='motion'),sounds=recipe.stages.filter(s=>s.kind==='sound');
 motionRecipes+=motions.length>0;motionStages+=motions.length;audibleVariants+=sounds.length>0;quietVariants+=!sounds.length;reviewedVariants+=variant.reviewed===true;
 if(variant.soundProfile)profiles.add(variant.soundProfile);for(const s of sounds)soundFiles.add(s.soundFile);
 const reviewedMotion=dndMotionReview(entry,variant);
 for(const s of motions){
  const reviewedPath=isPathMotion(s)&&s.stageId.startsWith(`${entry.id}-reviewed-motion`)&&reviewedMotion?.motion===s.motion;
  const distanceLimit=reviewedPath?reviewedMotion.distance:.3;
  const minimum=isPathMotion(s)?GENERATED_MOTION_DURATION[s.motion]:1000;
  if(s.duration<minimum||s.distance>distanceLimit||s.intensity>.6)issues.push({id:entry.id,variant:variant.id,stage:s.label,issue:'Motion bounds'});
 }
 if(['condition','effect'].includes(entry.kind)&&(motions.length||sounds.length||recipe.stages.some(s=>!s.persist)))issues.push({id:entry.id,issue:'Persistent state lifecycle'});
 const assets={};
 for(const [edition,inventory]of Object.entries(db)){
  const area=recipe.previewArea?.type;
  const c={...context,area:['line','cone'].includes(area)?{type:area,center:{x:0,y:0},endpoint:{x:400,y:0},length:400,width:100,angle:90}:{center:{x:200,y:200},diameter:400}};
  const plan=planRecipe(recipe,inventory,c);editions[edition].plannedStages+=plan.length;assets[edition]=[];
  for(const s of recipe.stages.filter(s=>s.assets.length)){
   const key=resolveAsset(s,inventory),media=inventory.find(m=>m.key===key);
   if(!media){issues.push({id:entry.id,variant:variant.id,stage:s.label,edition,issue:'Missing asset'});continue;}
   assets[edition].push(key);editions[edition].keys.add(key);editions[edition].families.add(key.split('.')[1]);
   const geometry=assetGeometry(media);
   if(s.kind==='travel'&&!['beam','projectile','line'].includes(geometry))issues.push({id:entry.id,variant:variant.id,stage:s.label,edition,key,geometry,issue:'Travel geometry'});
  }
 }
 ledger.push({id:entry.id,name:entry.name,kind:entry.kind,edition:entry.edition,variant:variant.id,activityId:variant.activityId,trigger:recipe.trigger,reviewed:variant.reviewed===true,hash,motionStages:motions.length,soundProfile:variant.soundProfile,sounds:sounds.map(s=>s.soundFile),assets});
}
const timing=JSON.parse(await readFile(new URL('../data/pf2e-media-completeness-after.json',import.meta.url),'utf8'));
const alpha=JSON.parse(await readFile(new URL('../data/media-visibility-audit-after.json',import.meta.url),'utf8'));
const footprint=JSON.parse(await readFile(new URL('../data/media-footprint-audit.json',import.meta.url),'utf8'));
const report={source:DND5E_SOURCE,entries:entries.length,variants:ledger.length,reviewedVariants,distinctConfigurations:configurations.size,motionRecipes,motionStages,audibleVariants,quietVariants,soundProfiles:profiles.size,selectedSoundFiles:soundFiles.size,editions:Object.fromEntries(Object.entries(editions).map(([k,v])=>[k,{selectedKeys:v.keys.size,families:v.families.size,plannedStages:v.plannedStages}])),issues,
 media:{allSystemCutoffs:timing.issues.length,allSystemEarlyFades:timing.fades.length,missingTimingMeasurements:timing.missingFiles.length,allSystemSelectedFiles:alpha.selectedFiles,missingAlphaMeasurements:alpha.missingMeasurements.length,dndSuppressedPeaks:alpha.suppressed.filter(r=>r.domain.startsWith('dnd5e-')).length,dndFastActions:alpha.fastMovies.filter(r=>r.domain.startsWith('dnd5e-')).length,missingFootprintMeasurements:footprint.missingMeasurements.length},ledger};
await writeFile(new URL('../data/dnd5e-catalog-validation.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,ledger:undefined},null,2));
if(issues.length||Object.entries(report.media).some(([k,v])=>/Cutoffs|EarlyFades|missing|Suppressed|Fast/.test(k)&&v))process.exitCode=1;
