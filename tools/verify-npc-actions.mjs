// Verify native NPC action media against actual Free/Patreon registries.
// Authoring check only; runtime/release bundles do not import this tool.
import fs from 'node:fs';
import path from 'node:path';
import {assetDatabases} from './asset-databases.mjs';
import {NPC_ACTIONS,npcActionPreview} from '../scripts/catalogs/pf2e/npc-abilities.mjs';
import {planRecipe,catalogIndex} from '../scripts/core/model.mjs';
const databases=await assetDatabases(),report={editions:{},errors:[]};
const source={id:'source',center:{x:100,y:100},w:100,h:100},target={id:'target',center:{x:400,y:100},w:100,h:100};
for(const [edition,rows] of Object.entries(databases)){
 const catalog=catalogIndex(rows);let checked=0;
 for(const action of NPC_ACTIONS.filter(a=>a.coverage==='reviewed'))for(const motion of [true,false]){
  try{
   const recipe=npcActionPreview(action.id,{motion});
   if(!recipe)throw Error('No preview');
   const area={type:'cone',center:source.center,endpoint:{x:700,y:100},length:600,width:100,angle:90};
   const plan=planRecipe(recipe,catalog,{source,targets:action.form.aim==='self'?[]:[target],template:{id:'area'},area,gridSize:100,outcome:'success'});
   if(!plan.length)throw Error('Empty playback');
   for(const stage of plan)if(edition==='patreon'&&stage.asset){
    const entry=rows.find(r=>r.key===stage.asset);
    if(entry?.file&&!fs.existsSync(path.resolve('../..',entry.file)))throw Error(`Missing file ${entry.file}`);
   }
   checked++;
  }catch(error){report.errors.push({edition,id:action.id,name:action.name,motion,error:error.message});}
 }
 report.editions[edition]={checked};
}
if(process.argv.includes('--write')){fs.mkdirSync('.cache',{recursive:true});fs.writeFileSync('.cache/npc-reviewed-validation.json',JSON.stringify(report,null,2));}
console.log(JSON.stringify(report,null,2));if(report.errors.length)process.exitCode=1;
