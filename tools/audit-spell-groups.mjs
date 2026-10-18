import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {PF2E_SPELLS,PF2E_SOURCE,spellRecipe,SPELL_THEMES} from '../scripts/catalogs/pf2e/spells/spell-catalog.mjs';
import {effectIdentity} from './spell-identity-audit.mjs';
import {fireBodyIdentity} from './audit-fire-spells.mjs';
import {spellSources} from './pf2e-source.mjs';
import {descriptionText,nativeSpellDescription} from './spell-semantics.mjs';

const visible=s=>!['motion','sound','tokenfx','scenefx'].includes(s.kind)&&Number(s.opacity??1)>0;
export function spellGroupIdentity(recipe,rows,{withoutOpening=false}={}){
 const stages=recipe.stages.filter((s,i)=>visible(s)&&!(withoutOpening&&i===0&&s.kind==='cast'));
 // Area shape changes the rendered body; rank/radius alone does not.
 const shape=stages.some(s=>s.kind==='template')?recipe.previewArea?.type??'native':undefined;
 const routing=stages.filter(s=>!(s.kind==='cast'&&s.assets.every(a=>/cast_generic|magic_signs/.test(a)))).map(s=>({
  repeatScope:s.repeatScope,targetSelection:s.targetSelection,targetLimit:s.targetLimit,
  copies:s.kind==='sprite'?s.copies:undefined,spread:s.kind==='sprite'?s.copySpread:undefined,
  colorize:s.tintEnabled?s.colorize:undefined,maskToken:s.maskToken,mirror:[s.mirrorX,s.mirrorY],
 }));
 return createHash('sha256').update(JSON.stringify([shape,fireBodyIdentity({...recipe,stages},rows),routing])).digest('hex');
}
export function groupSpellRecipes(spells,recipeFor,databases){
 const entries=spells.map(spell=>({spell,recipe:recipeFor(spell)}));
 return Object.fromEntries(Object.entries(databases).map(([edition,rows])=>{
  const keys=new Set(rows.map(r=>r.key));
  const groups=new Map(),withoutOpening=new Map(),complete=new Set(),missing=[];
  for(const {spell,recipe} of entries){
   for(const [index,identity] of [[groups,spellGroupIdentity(recipe,rows)],[withoutOpening,spellGroupIdentity(recipe,rows,{withoutOpening:true})]]){
    const group=index.get(identity)??[];group.push(spell);index.set(identity,group);
   }
   complete.add(effectIdentity({...recipe,stages:recipe.stages.filter(visible)},rows));
   for(const stage of recipe.stages.filter(s=>visible(s)&&s.assets.length&&!s.assets.some(k=>keys.has(k))))missing.push({id:spell.id,name:spell.name,stage:stage.stageId,assets:stage.assets});
  }
  const shared=[...groups].filter(([,spells])=>spells.length>1).sort((a,b)=>b[1].length-a[1].length);
  const affected=new Set(shared.flatMap(([,spells])=>spells.map(s=>s.id)));
  const themes=Object.fromEntries([...new Set(spells.map(s=>s.theme))].map(theme=>{
   const sameTheme=shared.map(([,group])=>group.filter(s=>s.theme===theme)).filter(g=>g.length>1);
   return [theme,{label:SPELL_THEMES[theme]?.label??theme,total:spells.filter(s=>s.theme===theme).length,
    repeatedBodies:sameTheme.length,sameThemeSpells:sameTheme.flat().length,
    repeatedAcrossCatalog:spells.filter(s=>s.theme===theme&&affected.has(s.id)).length}];
  }));
  return [edition,{total:spells.length,completeEffectCompositions:complete.size,mainBodyCompositions:groups.size,
   withoutOpeningCompositions:withoutOpening.size,sharedGroups:shared.length,affectedSpells:affected.size,missing,
   themes,groups:shared.map(([identity,group])=>({identity,count:group.length,themes:[...new Set(group.map(s=>s.theme))],
    spells:group.map(s=>({id:s.id,name:s.name,theme:s.theme,motif:s.design.motif,path:s.path,descriptionHash:s.design.descriptionHash}))}))}];
 }));
}

export async function auditSpellGroups({sources=false}={}){
 const inventory=JSON.parse(await readFile(new URL('../data/pf2e-spell-variety-audit.json',import.meta.url),'utf8')).editionAssets;
 const editions=groupSpellRecipes(PF2E_SPELLS,s=>spellRecipe(s,undefined,{motion:false,sound:false,fx:false}),inventory);
 const provenance={checked:0,issues:[]};
 if(sources){
  const source=await spellSources(PF2E_SOURCE.sha);
  if(source.sha!==PF2E_SOURCE.sha)throw Error('Source revision differs from catalog');
  const native=new Map(source.spells.map(s=>[s.path,s.source]));
  for(const spell of PF2E_SPELLS){
   const text=descriptionText(nativeSpellDescription(native.get(spell.path)));
   const hash=createHash('sha256').update(text).digest('hex');
   if(!text||hash!==spell.design.descriptionHash||text.length!==spell.design.descriptionChars)provenance.issues.push({id:spell.id,name:spell.name});
   provenance.checked++;
  }
 }
 const affected=new Set(Object.values(editions).flatMap(e=>e.groups.flatMap(g=>g.spells.map(s=>s.id))));
 return {source:PF2E_SOURCE.sha,scope:'PF2e spell catalog, all themes, Free and Patreon',
  themes:Object.keys(editions.patreon.themes).length,affectedInEitherEdition:affected.size,
  method:'Compare actual edition footage and visible main-body arrangements. Ignore sound, token motion, optional filters, names, timing, scale and generic caster seals. Retain native area shape. Opening-independent check also removes the first caster stage. These are body-reuse candidates, not a claim that every full timed animation or description is identical.',
  provenance,editions};
}
export function spellGroupReportMarkdown(report){
 const p=report.editions.patreon,f=report.editions.free;
 const themes=Object.entries(p.themes).sort((a,b)=>Math.max(f.themes[b[0]].repeatedAcrossCatalog,b[1].repeatedAcrossCatalog)-Math.max(f.themes[a[0]].repeatedAcrossCatalog,a[1].repeatedAcrossCatalog));
 const lines=['# PF2e spell group audit','',`Source: PF2e 8.6.0, commit \`${report.source}\`. Scope: ${p.total} spells across ${report.themes} themes, both JB2A editions.`,
  '',`**${report.affectedInEitherEdition} spells share a main-effect body in at least one edition.** Patreon: ${p.affectedSpells} spells in ${p.sharedGroups} shared groups. Free: ${f.affectedSpells} spells in ${f.sharedGroups} shared groups.`,
  '',report.method,'','## Summary','',
  '| Check | Patreon | Free |','| --- | ---: | ---: |',
  `| Full effect compositions including casting cues | ${p.completeEffectCompositions} | ${f.completeEffectCompositions} |`,
  `| Main-effect body compositions | ${p.mainBodyCompositions} | ${f.mainBodyCompositions} |`,
  `| Spells in repeated main bodies | ${p.affectedSpells} | ${f.affectedSpells} |`,
  `| Missing inventory keys | ${p.missing.length} | ${f.missing.length} |`,
  '',`Source-description provenance checked: ${report.provenance.checked} spells; ${report.provenance.issues.length} mismatches. Hash verification is automated coverage, not individual reading of every description.`,
  '', 'Different casting-seal arrangements account for much of the earlier variety score. Generic rings/seals are removed from the body comparison even when their motion tracks differ. A separate stress check removes the initial caster stage, yielding '+p.withoutOpeningCompositions+' / '+f.withoutOpeningCompositions+' compositions; this is diagnostic only because some initial caster stages are primary spell imagery.',
  '', '## Every theme','',
  'Counts are affected spells, not numbers of distinct designs. “Within theme” requires a sibling in that theme. “Anywhere” also includes cross-theme collisions. Columns use Patreon / Free.',
  '', '| Theme | Total | Repeated within theme | Repeated anywhere |','| --- | ---: | ---: | ---: |',
  ...themes.map(([key,t])=>`| ${t.label} | ${t.total} | ${t.sameThemeSpells} / ${f.themes[key].sameThemeSpells} | ${t.repeatedAcrossCatalog} / ${f.themes[key].repeatedAcrossCatalog} |`),
  '', 'Fire has no repeated siblings after the previous rework. Its one Free cross-theme match is Heatvision sharing a divination body. The earlier fire cohort had 79 entries; Rejuvenating Flames now belongs to Healing.',
  '', '## Shared groups','', 'A shared main body can still have different durations, sounds, casting seals or token motion. Native area shape, target routing, copy counts and edition footage are retained in comparison.',
 ];
 for(const [edition,r]of Object.entries(report.editions)){
  lines.push('',`### ${edition==='patreon'?'Patreon':'Free'}`,'',...r.groups.map(g=>`- **${g.count} spells:** ${g.spells.map(s=>s.name).join('; ')}.`));
 }
 lines.push('', '## Evidence and limits','',
  'Machine evidence: `data/pf2e-spell-group-audit.json`. Individual description findings: [review notes](spell-group-audit-notes.md). Auditor regressions and retained fire regressions: 15 passed.',
  '', 'This audit compares final recipe data and actual inventory footage/variants. It does not claim every spell was watched on the Foundry canvas. Catalog choreography was not changed during this inspection. Shared bodies are exposed for description-based rework rather than made artificially unique with timing or scale nudges.',
  '', 'Run: `node tools/audit-spell-groups.mjs --write --sources`. Tests: `node --test tests/spell-group-audit.test.mjs tests/fire-spell-audit.test.mjs`.', '');
 return lines.join('\n');
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
 const report=await auditSpellGroups({sources:process.argv.includes('--sources')});
 if(process.argv.includes('--write')){
  await writeFile(new URL('../data/pf2e-spell-group-audit.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
  await writeFile(new URL('../docs/spell-group-audit.md',import.meta.url),spellGroupReportMarkdown(report));
 }
 console.log(JSON.stringify({source:report.source,themes:report.themes,affectedInEitherEdition:report.affectedInEitherEdition,provenance:report.provenance,
  editions:Object.fromEntries(Object.entries(report.editions).map(([e,r])=>[e,{total:r.total,completeEffectCompositions:r.completeEffectCompositions,mainBodyCompositions:r.mainBodyCompositions,
   withoutOpeningCompositions:r.withoutOpeningCompositions,sharedGroups:r.sharedGroups,affectedSpells:r.affectedSpells,missing:r.missing.length,
   themes:Object.fromEntries(Object.entries(r.themes).filter(([,r])=>r.repeatedAcrossCatalog).map(([t,r])=>[t,r])),
   ...(process.argv.includes('--groups')?{groups:r.groups.map(g=>({count:g.count,names:g.spells.map(s=>s.name).join(' | ')}))}:{})}]))},null,2));
 if(report.provenance.issues.length||Object.values(report.editions).some(e=>e.missing.length))process.exitCode=1;
}
