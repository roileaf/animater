import fs from 'node:fs';
import {PF2E_SPELLS,spellRecipe} from '../scripts/catalogs/pf2e/spells/spell-catalog.mjs';
import {PF2E_FEATS,featRecipe} from '../scripts/catalogs/pf2e/feats/feat-catalog.mjs';
import {PF2E_WEAPONS,weaponRecipe} from '../scripts/catalogs/pf2e/weapons/weapon-catalog.mjs';
import {PF2E_CONDITIONS,PF2E_EFFECTS,stateRecipe} from '../scripts/catalogs/pf2e/state-catalog.mjs';
import {DND5E_ENTRIES,dndRecipe} from '../scripts/catalogs/dnd5e/dnd5e-catalog.mjs';
import {SF2E_ENTRIES,sfRecipe} from '../scripts/catalogs/sf2e/sf2e-catalog.mjs';
import {catalogFxDesign} from '../scripts/catalogs/shared/catalog-fx.mjs';
import {MAX_STAGES} from '../scripts/core/model.mjs';
import {PRESETS as presets} from '../scripts/engines/tokenshade/presets.mjs';
const fxCatalog={tokenReady:true,sceneReady:true,isGM:true,presets:presets.map(p=>({name:p.name,library:p.library})),effects:[{type:'screenShake',category:'filter'},{type:'clouds',category:'particle'},{type:'rain',category:'particle'}]};
const groups=[
 ['pf2e-spell',PF2E_SPELLS,e=>[[spellRecipe,e,undefined,{fxCatalog}]]],
 ['pf2e-feat',PF2E_FEATS,e=>[[featRecipe,e,undefined,{fxCatalog}]]],
 ['pf2e-weapon',PF2E_WEAPONS,e=>e.modes.map(m=>[weaponRecipe,e,m.mode,{fxCatalog,mode:m}])],
 ['pf2e-state',[...PF2E_CONDITIONS,...PF2E_EFFECTS],e=>[undefined,...Object.keys(e.damageVariants??{})].map(damageType=>[stateRecipe,e,damageType,{fxCatalog,damageType}])],
 ['dnd5e',DND5E_ENTRIES,e=>e.variants.map(v=>[dndRecipe,e,v.id,{fxCatalog,variant:v}])],
 ['sf2e',SF2E_ENTRIES,e=>e.variants.map(v=>[sfRecipe,e,v.id,{fxCatalog,variant:v}])],
];
const version=name=>JSON.parse(fs.readFileSync(new URL(`../../${name}/module.json`,import.meta.url),'utf8')).version;
const report={providerVersions:{animater:version('animater'),fxmaster:version('fxmaster')},groups:{},issues:[],rows:[],examples:[]};
for(const [name,entries,variants] of groups){
 const stats={entries:entries.length,recipes:0,enhanced:0,token:0,scene:0,profiles:{},maxStages:0};
 for(const entry of entries)for(const [builder,e,variant,opt] of variants(entry)){
  const build=options=>[featRecipe,stateRecipe].includes(builder)?builder(e,options):builder(e,variant,options);
  try{
   const base=build({...opt,fx:false}),recipe=build(opt),wanted=catalogFxDesign(base,{...e,...e.spell,...e.state},opt);
   const additions=recipe.stages.filter(s=>s.catalogFx),validWanted=wanted.filter(s=>s.kind==='tokenfx'?fxCatalog.presets.some(p=>p.name===s.fxPreset&&p.library===s.fxLibrary):true);
   stats.recipes++;stats.maxStages=Math.max(stats.maxStages,recipe.stages.length);
   if(additions.length)stats.enhanced++;
   for(const s of additions){stats[s.kind==='tokenfx'?'token':'scene']++;stats.profiles[s.fxProfile]=(stats.profiles[s.fxProfile]??0)+1;}
   if(additions.length)report.rows.push({group:name,name:e.name,id:e.id,variant,stages:additions.map(s=>({kind:s.kind,preset:s.fxPreset,type:s.fxType,profile:s.fxProfile,subject:s.subject,tint:s.fxTint,persist:s.persist,afterStage:s.afterStage,timingAnchor:s.timingAnchor,duration:s.duration}))});
   if(validWanted.length!==additions.length)report.issues.push({group:name,name:e.name,variant,wanted:validWanted.map(s=>s.fxProfile),added:additions.map(s=>s.fxProfile),stages:base.stages.length,limit:MAX_STAGES});
   if(JSON.stringify(recipe.stages.filter(s=>!s.catalogFx))!==JSON.stringify(base.stages))report.issues.push({group:name,name:e.name,variant,problem:'Base choreography changed'});
   if(['sudden-charge','earthquake','force-barrage','blur','acid-flask'].includes(e.slug))report.examples.push({group:name,name:e.name,variant,stages:recipe.stages.map(s=>({kind:s.kind,motion:s.motion,subject:s.subject,label:s.label,preset:s.fxPreset,profile:s.fxProfile,delay:s.delay,afterStage:s.afterStage}))});
  }catch(error){report.issues.push({group:name,name:e.name,variant,error:error.message});}
 }
 report.groups[name]=stats;
}
if(process.argv.includes('--write'))fs.writeFileSync(new URL('../data/catalog-fx-audit.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({groups:report.groups,issueCount:report.issues.length,issues:report.issues.slice(0,10),...(process.argv.includes('--examples')?{examples:report.examples}:{})},null,2));
if(report.issues.length)process.exitCode=1;
