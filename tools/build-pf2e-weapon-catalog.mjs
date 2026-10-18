import {writeFile} from 'node:fs/promises';
import {weaponSources} from './pf2e-weapon-source.mjs';
import {analyzeWeapon} from './weapon-semantics.mjs';
import {selectWeaponMedia} from './weapon-asset-selection.mjs';
import {assetDatabases} from './asset-databases.mjs';
import {mediaTiming} from './media-timing.mjs';
import {weaponRecipe} from '../scripts/catalogs/pf2e/weapons/weapon-choreography.mjs';
import {planRecipe,resolveAsset} from '../scripts/core/model.mjs';
import {MEDIA_DURATIONS} from '../data/media-durations.mjs';
const [source,databases]=await Promise.all([weaponSources(),assetDatabases()]);
const excluded=[],weapons=[];
for(const {source:item,path}of source.weapons){
 const weapon=analyzeWeapon(item,path);
 for(const mode of weapon.modes)Object.assign(mode,selectWeaponMedia(databases,weapon,mode));
 weapons.push(weapon);
}
console.log(`${weapons.length} weapons / ${weapons.reduce((n,w)=>n+w.modes.length,0)} native usage designs. Probing films.`);
const rows=new Map(Object.values(databases).flat().map(row=>[row.key,row])),keys=[...new Set(weapons.flatMap(w=>w.modes.flatMap(m=>Object.values(m.assets).flat())))],timings={};let next=0;
await Promise.all(Array.from({length:6},async()=>{while(next<keys.length){const key=keys[next++],timing=await mediaTiming(rows.get(key),databases);if(timing)timings[key]={...timing,duration:Math.max(timing.duration,MEDIA_DURATIONS[key]??0)};}}));
for(const weapon of weapons)for(const mode of weapon.modes){mode.mediaTiming=Object.fromEntries(Object.values(mode.assets).flat().filter(k=>timings[k]).map(k=>[k,timings[k]]));mode.approximations=mode.selections.filter(s=>s.approximation).map(s=>`${s.edition} ${s.slot}: ${s.key}`);}
// Bespoke usages play their own media; record what each edition resolves for them.
for(const weapon of weapons)for(const mode of weapon.modes){
 const recipe=weaponRecipe(weapon,mode.mode);if(!recipe.bespoke)continue;
 for(const [edition,db]of Object.entries(databases))for(const stage of recipe.stages){
  const key=stage.assets?.length?resolveAsset(stage,db):null;
  if(key&&!mode.selections.some(s=>s.edition===edition&&s.key===key))mode.selections.push({edition,slot:'bespoke',key});
 }
}
const issues=[],coverage={},context={source:{id:'s',center:{x:100,y:100},document:{width:1,height:1}},targets:[{id:'t',center:{x:400,y:100},document:{width:1,height:1}}],gridSize:100};
for(const [edition,db]of Object.entries(databases)){
 const used=new Set();
 for(const weapon of weapons)for(const mode of weapon.modes){try{for(const stage of planRecipe(weaponRecipe(weapon,mode.mode),db,context))if(stage.asset)used.add(stage.asset);}catch(e){issues.push({name:weapon.name,mode:mode.mode,edition,error:e.message});}}
 coverage[edition]={available:db.length,used:used.size,keys:[...used].sort()};
}
const meta={version:'8.6.0',sha:source.sha,repository:'foundryvtt/pf2e',equipmentDocuments:source.total,weaponDocuments:source.weapons.length,count:weapons.length,excluded,usageCount:weapons.reduce((n,w)=>n+w.modes.length,0),descriptionAudit:weapons.length,missingDescriptions:weapons.filter(w=>!w.descriptionChars).map(w=>w.id),probedKeys:Object.keys(timings).length,missingTiming:keys.filter(k=>!timings[k]),modes:Object.fromEntries(['melee','ranged','thrown'].map(m=>[m,weapons.flatMap(w=>w.modes).filter(u=>u.mode===m).length]))};
await writeFile('data/pf2e-weapons.mjs',`// Generated from pinned official PF2e full equipment descriptions. References only.\nexport const PF2E_WEAPON_SOURCE = ${JSON.stringify(meta,null,2)};\nexport const PF2E_WEAPONS = ${JSON.stringify(weapons,null,2)};\n`);
const payloadAudit={bombs:weapons.filter(w=>w.group==='bomb').length,bombStyles:Object.fromEntries([...new Set(weapons.flatMap(w=>w.modes.map(m=>m.payload?.style)).filter(Boolean))].sort().map(style=>[style,weapons.filter(w=>w.modes.some(m=>m.payload?.style===style)).length])),elementalUses:weapons.flatMap(w=>w.modes).filter(m=>m.element!=='physical').length,residueUses:weapons.flatMap(w=>w.modes).filter(m=>m.assets.residue?.length).length};
await writeFile('data/pf2e-weapon-audit.json',JSON.stringify({source:meta,coverage,payloadAudit,issues,designs:weapons.flatMap(w=>w.modes.map(m=>({id:w.id,name:w.name,descriptionHash:w.descriptionHash,descriptionChars:w.descriptionChars,mode:m.mode,family:m.family,elements:m.elements,persistent:m.persistent,payload:m.payload,rationale:m.rationale,approximations:m.approximations})))},null,2));
const csv=v=>'"'+String(v??'').replaceAll('"','""')+'"';
await writeFile('data/pf2e-weapon-audit.csv',['Weapon,ID,Usage,Family,Damage,Range,Description hash,Rationale,Approximations',...weapons.flatMap(w=>w.modes.map(m=>[w.name,w.id,m.mode,m.family,m.damage,m.range,w.descriptionHash,m.rationale,m.approximations.join(' | ')].map(csv).join(',')))].join('\n'));
console.log(JSON.stringify({source:meta,payloadAudit,coverage:Object.fromEntries(Object.entries(coverage).map(([k,{keys,...v}])=>[k,v])),issues},null,2));
if(issues.length)process.exitCode=1;
