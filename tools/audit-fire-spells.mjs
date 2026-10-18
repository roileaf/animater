import {readFile,writeFile} from 'node:fs/promises';
import {basename,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spellSources} from './pf2e-source.mjs';
import {assetDatabases,variantFiles} from './asset-databases.mjs';
import {descriptionText} from './spell-semantics.mjs';
import {PF2E_SPELLS,spellRecipe} from '../scripts/catalogs/pf2e/spells/spell-catalog.mjs';

export function fireBodyIdentity(recipe,rows) {
  const keys=new Map(rows.map(row=>[row.key,row]));
  const body=recipe.stages.filter(s=>!['motion','sound','tokenfx','scenefx'].includes(s.kind)&&s.opacity!==0&&
    !(s.kind==='cast'&&s.assets.every(a=>/cast_generic|magic_signs/.test(a)))).map(s=>{
    const row=keys.get(s.assets.find(key=>keys.has(key)));
    return {kind:s.kind,subject:s.subject,media:s.kind==='sprite'?'token-copy':row?[...new Set(variantFiles(row).map(f=>basename(f).replace(/_\d+x\d+(?=_|\.|$)/g,'')))].sort():'missing',
      repeats:s.repeats,layout:s.areaLayout,origin:s.travelOrigin,destination:s.travelDestination,below:s.below,
      offset:[s.offsetX,s.offsetY],tint:s.tintEnabled?s.tint:undefined,tracks:s.tracks.map(t=>[t.property,t.from,t.to,t.loop,t.pingPong])};
  });
  return createHash('sha256').update(JSON.stringify(body)).digest('hex');
}

export async function auditFireSpells() {
const [source,libraries]=await Promise.all([spellSources(),assetDatabases()]);
const native=new Map(source.spells.map(e=>[e.source._id,e.source]));
// Retain the reported cohort when a corrected description changes its theme.
const baseline=JSON.parse(await readFile(new URL('../data/fire-spell-audit-before.json',import.meta.url),'utf8'));
const ids=new Set(baseline.records.map(r=>r.id));
const spells=PF2E_SPELLS.filter(s=>s.theme==='fire'||ids.has(s.id));
const records=spells.map(spell=>({id:spell.id,name:spell.name,motif:spell.design.motif,delivery:spell.delivery,
  description:descriptionText(native.get(spell.id).system.description.value),
  editions:Object.fromEntries(Object.entries(libraries).map(([edition,rows])=>{
    const recipe=spellRecipe(spell,undefined,{motion:false,sound:false});
    const keys=new Set(rows.map(r=>r.key));
    return [edition,{identity:fireBodyIdentity(recipe,rows),stages:recipe.stages.map(s=>({kind:s.kind,assets:s.assets,selected:s.assets.find(k=>keys.has(k)),delay:s.delay,duration:s.duration})),missing:recipe.stages.filter(s=>s.assets.length&&!s.assets.some(k=>keys.has(k))).length}];
  }))}));
const summary={source:source.sha,fireSpells:records.length,editions:Object.fromEntries(Object.keys(libraries).map(edition=>{
  const groups=new Map();
  for(const record of records){const id=record.editions[edition].identity;const group=groups.get(id)??[];group.push(record.name);groups.set(id,group);}
  return [edition,{bodyCompositions:groups.size,missing:records.reduce((n,r)=>n+r.editions[edition].missing,0),shared:[...groups.values()].filter(g=>g.length>1)}];
}))};
if(process.argv.includes('--write'))await writeFile(new URL(`../data/fire-spell-audit${process.argv.includes('--before')?'-before':''}.json`,import.meta.url),JSON.stringify({summary,records:records.map(({description,...record})=>({...record,descriptionChars:description.length,descriptionHash:createHash('sha256').update(description).digest('hex')}))},null,2)+'\n');
if(process.argv.includes('--describe')) {
  const start=Number(process.argv.at(-2)),end=Number(process.argv.at(-1));
  records.slice(start,end).forEach(r=>console.log(JSON.stringify({name:r.name,motif:r.motif,description:r.description})));
} else console.log(JSON.stringify(summary,null,2));
return {summary,records};
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1]))await auditFireSpells();
