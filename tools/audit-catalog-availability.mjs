import {writeFile,access} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {PF2E_SPELLS,spellRecipe,catalogSpellReady} from '../scripts/catalogs/pf2e/spells/spell-catalog.mjs';
import {PF2E_FEATS,featRecipe} from '../scripts/catalogs/pf2e/feats/feat-catalog.mjs';
import {PF2E_WEAPONS,weaponRecipe} from '../scripts/catalogs/pf2e/weapons/weapon-catalog.mjs';
import {PF2E_CONDITIONS,PF2E_EFFECTS,stateRecipe} from '../scripts/catalogs/pf2e/state-catalog.mjs';
import {dndEntries,dndRecipe} from '../scripts/catalogs/dnd5e/dnd5e-catalog.mjs';
import {planRecipe} from '../scripts/core/model.mjs';
import {assetDatabases,variantFiles} from './asset-databases.mjs';
import {spellSources} from './pf2e-source.mjs';

export function availabilityEntries(){return [
 ...PF2E_SPELLS.map(item=>({system:'pf2e',kind:'spell',item,ready:catalogSpellReady(item),build:()=>spellRecipe(item,undefined,{sound:false})})),
 ...PF2E_FEATS.map(item=>({system:'pf2e',kind:'feat',item,build:()=>featRecipe(item,{sound:false})})),
 ...PF2E_WEAPONS.flatMap(item=>item.modes.map(mode=>({system:'pf2e',kind:'weapon',item,variant:mode.mode,build:()=>weaponRecipe(item,mode.mode,{sound:false})}))),
 ...[...PF2E_CONDITIONS,...PF2E_EFFECTS].flatMap(item=>[
  {system:'pf2e',kind:item.kind,item,build:()=>stateRecipe(item)},
  ...Object.keys(item.damageVariants??{}).map(damageType=>({system:'pf2e',kind:item.kind,item,variant:damageType,build:()=>stateRecipe(item,{damageType})})),
  ...Object.keys(item.auraDesign?.variants??{}).map(auraVariant=>({system:'pf2e',kind:item.kind,item,variant:auraVariant,build:()=>stateRecipe(item,{auraVariant})})),
 ]),
 ...dndEntries().flatMap(item=>item.variants.map(variant=>({system:'dnd5e',kind:item.kind,item,variant:variant.id,build:()=>dndRecipe(item,variant.id,{sound:false})}))),
];}

export function availabilityContext(recipe){
 const source={id:'caster',center:{x:100,y:100},w:100,h:100},targets=Array.from({length:5},(_,i)=>({id:`target-${i}`,center:{x:400+i*100,y:100},w:100,h:100}));
 const shape=recipe.previewArea?.type??'circle',length=(recipe.previewArea?.value??15)*20;
 return {source,targets,gridSize:100,outcome:'success',preview:true,template:{id:'area'},area:['line','cone'].includes(shape)?{type:shape,center:source.center,endpoint:{x:100+length,y:100},length,width:(recipe.previewArea?.width??5)*20,angle:90}:{type:['square','cube'].includes(shape)?'square':'circle',center:targets[0].center,diameter:length*(['square','cube'].includes(shape)?1:2)}};
}

export async function auditAvailability(){
 const db=await assetDatabases(),summary={},missing=[],files=new Map();
 for(const e of availabilityEntries()){
  const group=`${e.system}/${e.kind}`,counts=summary[group]??={entries:0,ready:0,unconfigured:0,broken:0};counts.entries++;
  if(e.ready===false){counts.unconfigured++;missing.push({system:e.system,kind:e.kind,id:e.item.id,name:e.item.name,slug:e.item.slug,reason:'unconfigured',path:e.item.path});continue;}
  try{
   const recipe=e.build();
   if(recipe.enabled===false||!recipe.stages.some(s=>s.kind!=='sound'))throw Error('Recipe has no active visual stages');
   for(const [edition,catalog] of Object.entries(db)){
    const plan=planRecipe(recipe,catalog,availabilityContext(recipe));
    if(!plan.some(s=>s.kind!=='sound'))throw Error(`${edition}: no visual playback`);
    if(edition==='patreon')for(const s of plan)if(s.asset){const row=catalog.find(r=>r.key===s.asset);for(const file of variantFiles(row))files.set(file,s.asset);}
   }
   counts.ready++;
  }catch(error){counts.broken++;missing.push({system:e.system,kind:e.kind,id:e.item.id,name:e.item.name,variant:e.variant,reason:error.message});}
 }
 const root=fileURLToPath(new URL('../../..',import.meta.url)),missingFiles=[];
 for(const [file,key] of files)try{await access(resolve(root,file));}catch{missingFiles.push({key,file});}
 return {summary,missing,installedFilesChecked:files.size,missingFiles};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const report=await auditAvailability();
 if(process.argv.includes('--descriptions')){
  const sources=await spellSources(),byId=new Map(sources.spells.map(s=>[s.source._id,s.source]));
  for(const item of report.missing.filter(s=>s.system==='pf2e'&&s.kind==='spell')){
   const source=byId.get(item.id);item.native=source?.system;
  }
  await writeFile(new URL('../.cache/catalog-availability-source.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
  for(const item of report.missing)delete item.native;
 }
 await writeFile(new URL('../data/catalog-availability-audit.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({summary:report.summary,missing:report.missing.length,installedFilesChecked:report.installedFilesChecked,missingFiles:report.missingFiles},null,2));
}
