import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { spellSources } from './pf2e-source.mjs';
import { assetDatabases } from './asset-databases.mjs';
import { descriptionText, analyzeSpellDescription } from './spell-semantics.mjs';
import { assetGeometry } from './spell-asset-selection.mjs';
import { meaningfulSpellFingerprint } from './spell-meaningful-audit.mjs';
import { PF2E_SPELLS,PF2E_SOURCE,spellRecipe } from '../scripts/catalogs/pf2e/spells/spell-catalog.mjs';
import { DEEP_SPELL_DESIGNS } from '../scripts/catalogs/pf2e/spells/spell-deep-designs.mjs';
import { UTILITY_SPELL_DESIGNS } from '../scripts/catalogs/pf2e/spells/spell-utility-designs.mjs';
const individuallyReviewed={...DEEP_SPELL_DESIGNS,...UTILITY_SPELL_DESIGNS};
const [source,databases]=await Promise.all([spellSources(),assetDatabases()]);
if(source.sha!==PF2E_SOURCE.sha)throw Error('Catalog source revision differs; cannot assert full-description audit.');
const native=new Map(source.spells.map(r=>[r.path,r.source])),issues=[],reviewed=[],entries=[];
const groups=Object.fromEntries(Object.keys(databases).map(e=>[e,{meaningful:new Map(),families:new Map(),used:new Map(),usedFiles:new Set()}]));
const count={};const motions={};const nativeAreas={};const generic=[];
for(const spell of PF2E_SPELLS){
 const original=native.get(spell.path),text=descriptionText(original.system.description.value),hash=createHash('sha256').update(text).digest('hex'),recipe=spellRecipe(spell),slug=spell.slug.replace(/-legacy$/,'');
 const nativeDesign=analyzeSpellDescription(original,spell);
 if(nativeDesign.nativeFootprint!==Boolean(spell.design.nativeFootprint))issues.push({name:spell.name,issue:'native-footprint-classification-differs-from-source'});
 if(hash!==spell.design.descriptionHash||text.length!==spell.design.descriptionChars)issues.push({name:spell.name,issue:'full-description-provenance-mismatch'});
 count[spell.design.motif]=(count[spell.design.motif]??0)+1;
 if(original.system.area)nativeAreas[original.system.area.type]=(nativeAreas[original.system.area.type]??0)+1;
 if(spell.design.motif==='generic'&&spell.kind!=='ritual')generic.push({name:spell.name,id:spell.id,delivery:spell.delivery,theme:spell.theme,descriptionChars:text.length});
 if(spell.design.nativeFootprint&&!recipe.stages.some(s=>s.kind==='template'))issues.push({name:spell.name,issue:'native-footprint-without-area-stage'});
 if(spell.design.nativeFootprint&&spell.trigger!=='template')issues.push({name:spell.name,issue:'native-footprint-not-triggered-by-placement'});
 const editionEvidence={};
 for(const [edition,rows] of Object.entries(databases)){
  const indexed=new Map(rows.map(r=>[r.key,r]));
  editionEvidence[edition]=recipe.stages.filter(s=>s.assets.length).map(stage=>{
   const key=stage.assets.find(k=>indexed.has(k)),row=indexed.get(key),geometry=row&&assetGeometry(row);
   if(!row)issues.push({name:spell.name,stage:stage.label,edition,issue:'no-edition-asset'});
   else{groups[edition].used.set(key,(groups[edition].used.get(key)??0)+1);groups[edition].usedFiles.add(row.file);}
   if(stage.kind==='template'&&spell.delivery==='cone'&&geometry!=='cone')issues.push({name:spell.name,stage:stage.label,edition,key,issue:'cone-stage-noncone-footage'});
   if(['cast','impact','aura'].includes(stage.kind)&&row&&!['radial'].includes(geometry))issues.push({name:spell.name,stage:stage.label,edition,key,issue:'localized-stage-directional-footage'});
   return {stage:stage.label,kind:stage.kind,key,file:row?.file,geometry,colorized:stage.colorize===true,tint:stage.tintEnabled?stage.tint:undefined,scale:stage.scale,oneShot:stage.oneShot};
  });
  for(const [type,options] of [['meaningful',{}],['families',{familiesOnly:true}]]){
   const fingerprint=meaningfulSpellFingerprint(spell,recipe,rows,options);
   if(!groups[edition][type].has(fingerprint))groups[edition][type].set(fingerprint,[]);
   groups[edition][type].get(fingerprint).push({id:spell.id,name:spell.name,motif:spell.design.motif});
  }
 }
 const motion=recipe.stages.filter(s=>s.kind==='motion').map(s=>({motion:s.motion,subject:s.subject,duration:s.duration,distance:s.distance,intensity:s.intensity,repeats:s.repeats,motionRange:s.motionRange}));
 for(const m of motion)motions[m.motion]=(motions[m.motion]??0)+1;
 const entry={id:spell.id,name:spell.name,slug:spell.slug,source:`https://github.com/foundryvtt/pf2e/blob/${source.sha}/${spell.path}`,descriptionHash:hash,rawDescriptionHash:createHash('sha256').update(original.system.description.value).digest('hex'),descriptionReferences:[...original.system.description.value.matchAll(/@UUID\[([^\]]+)\](?:\{([^}]+)\})?/g)].map(m=>({uuid:m[1],label:m[2]??null})),descriptionChars:text.length,fullDescriptionAnalyzed:text.length>0,review:individuallyReviewed[slug]?'full-description-individual-deep-review':spell.design.authored?'prior-individual-review':'programmatic-native-fields-and-full-description',native:{target:original.system.target.value,range:original.system.range.value,area:original.system.area,time:original.system.time.value,traits:original.system.traits.value},design:{theme:spell.theme,motif:spell.design.motif,delivery:spell.delivery,trigger:spell.trigger,subject:spell.design.subject,nativeFootprint:spell.design.nativeFootprint===true,rationale:spell.design.rationale},motion,media:editionEvidence};
 entries.push(entry);if(individuallyReviewed[slug])reviewed.push(entry);
}
const editions=Object.fromEntries(Object.entries(groups).map(([edition,state])=>[edition,{inventoryKeys:databases[edition].length,selectedKeys:state.used.size,selectedFiles:state.usedFiles.size,meaningfulCompositions:state.meaningful.size,familyChoreographies:state.families.size,largestMeaningfulClusters:[...state.meaningful.values()].sort((a,b)=>b.length-a.length).slice(0,15).map(spells=>({count:spells.length,spells})),largestFamilyClusters:[...state.families.values()].sort((a,b)=>b.length-a.length).slice(0,15).map(spells=>({count:spells.length,spells})),mostUsed:[...state.used].sort((a,b)=>b[1]-a[1]).slice(0,20).map(([key,stages])=>({key,stages}))}]));
const report={source:source.sha,date:'2026-10-07',total:entries.length,scope:'Every pinned description scanned in full and matched by SHA-256; native fields and final recipes checked per entry, in both JB2A editions. Deep-reviewed list explicitly separates individual reading from automated coverage. This is not an assertion every spell was watched in Foundry.',methodology:'Meaningful composition ignores labels, IDs, sound, raw millisecond changes and small rank-scale changes; preserves media, sequence roles, direction, repetitions, target selection, motion, entrance/exit direction, filters and quantized active tracks. Family metric also ignores exact media/color variants. Geometry and edition key availability do not prove every served file exists or every frame looks correct.',deepReviewed:reviewed.length,nativeFootprints:entries.filter(e=>e.design.nativeFootprint).length,nativeAreas,motifs:count,motions,genericNonritual:generic.length,genericOpportunities:generic,editions,issues,reviewed,entries};
await writeFile(new URL('../docs/deep-spell-audit-2026-10-07.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({total:report.total,deepReviewed:report.deepReviewed,nativeFootprints:report.nativeFootprints,genericNonritual:report.genericNonritual,motions,editions:Object.fromEntries(Object.entries(editions).map(([e,r])=>[e,{inventoryKeys:r.inventoryKeys,selectedKeys:r.selectedKeys,selectedFiles:r.selectedFiles,meaningfulCompositions:r.meaningfulCompositions,familyChoreographies:r.familyChoreographies,largestMeaningfulClusters:r.largestMeaningfulClusters.slice(0,3).map(g=>({count:g.count,examples:g.spells.slice(0,4).map(s=>s.name)}))}])),issues},null,2));
if(issues.length)process.exitCode=1;
