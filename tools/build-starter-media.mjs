import {writeFile} from 'node:fs/promises';
import {starterRecipes} from '../scripts/core/presets.mjs';
import {resolveAsset} from '../scripts/core/model.mjs';
import {assetDatabases} from './asset-databases.mjs';
import {mediaTiming} from './media-timing.mjs';
const db=await assetDatabases(),timings={};
for(const recipe of starterRecipes()){
 const travel=recipe.stages.find(s=>s.kind==='travel'||s.assets?.some(k=>/\.(?:melee_generic|sword)\./.test(k)));if(!travel)continue;
 const measurements=await Promise.all(Object.values(db).map(rows=>mediaTiming(rows.find(r=>r.key===resolveAsset(travel,rows)),db)));
 if(measurements.some(m=>!m))throw Error(`No measured starter movie for ${recipe.id}`);
 timings[recipe.id]={contact:Math.max(...measurements.map(m=>m.contact??Math.round(m.duration*.6))),duration:Math.max(...measurements.map(m=>m.duration))};
}
await writeFile('data/starter-media-timing.mjs',`// Measured complete native films and endpoint contact, both editions.\n// Rebuild: rtk proxy node tools/build-starter-media.mjs\nexport const STARTER_MEDIA_TIMING = ${JSON.stringify(timings,null,2)};\n`);
console.log(timings);
