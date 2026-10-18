import {SPELL_SEAL_LAYOUTS,SPELL_SEAL_FINISHES} from '../scripts/catalogs/pf2e/spells/spell-visual-identity.mjs';
import {effectIdentity} from './spell-identity-audit.mjs';
import {descriptionOpening,nativeSpellDescription} from './spell-semantics.mjs';
import {GAP_SPELL_MOTIFS} from '../scripts/catalogs/pf2e/spells/spell-gap-designs.mjs';

// Full prose chooses a preferred casting grammar. Collision allocation chooses
// another visible grammar in that family, not a hash, millisecond or scale nudge.
const directions=[
 ['fold',/\b(absorb|draw\b|inhale|consume|drain|steal|siphon|contract)\w*/i],
 ['weave',/\b(weav|thread|intertwin|bind|tether|connect|link)\w*/i],
 ['rise',/\b(rise|rising|lift|float|fly|soar|ascend|resurrect|reviv)\w*/i],
 ['descend',/\b(rain|fall|descend|drop|sink|crush)\w*/i],
 ['orbit',/\b(surround|circle|orbit|ring|shield|ward|protect|enclos)\w*/i],
 ['crossWeave',/\b(split|separate|betray|confus|contradict|fractur)\w*/i],
 ['returnSweep',/\b(return|recall|remember|memor|past|reflect)\w*/i],
 ['diagonal',/\b(strike|bolt|ray|arrow|lance|pierc|launch|shoot)\w*/i],
 ['sweep',/\b(wave|push|gust|stream|sweep|spread|dispers)\w*/i],
 ['bloom',/\b(grow\w*|creat(?:e|es|ing|ed)|conjur\w*|summon\w*|heal\w*|restore\w*|glow\w*|reveal\w*)\b/i],
];
export function spellCastingEvidence(text=''){
 const matches=directions.filter(([,pattern])=>pattern.test(text));
 return {preferred:matches.map(([layout])=>layout),evidence:matches.map(([layout,pattern])=>({layout,phrase:text.match(pattern)?.[0]}))};
}
export function allocateSpellIdentities(spells,recipeFor,databases,sourceById){
 const editions=Object.entries(databases),used=Object.fromEntries(editions.map(([e])=>[e,new Set()]));
 const changed=[],shared=[];
 // Individually directed entries keep first choice when another entry would
 // otherwise collide. Ordering is explicit and deterministic, never name hash.
 const ordered=[...spells].sort((a,b)=>Number(b.design.authored)-Number(a.design.authored)||a.slug.localeCompare(b.slug)||a.id.localeCompare(b.id));
 for(const spell of ordered){
  const recipe=recipeFor(spell),initial=editions.map(([,rows])=>effectIdentity(recipe,rows));
  if(initial.every((key,i)=>!used[editions[i][0]].has(key))){initial.forEach((key,i)=>used[editions[i][0]].add(key));continue;}
  // Report native shared footage honestly. An unrelated casting seal cannot
  // turn the same material field into a bespoke animation.
  if(GAP_SPELL_MOTIFS[spell.design.motif] || !recipe.stages.some(s=>s.kind==='cast'&&s.assets.some(key=>(spell.design.assets.cast??[]).includes(key)))){
   delete spell.design.visualIdentity;
   initial.forEach((key,i)=>used[editions[i][0]].add(key));
   shared.push({id:spell.id,name:spell.name,motif:spell.design.motif});continue;
  }
  const item=sourceById.get(spell.id),text=descriptionOpening(nativeSpellDescription(item));
  const semantic=spellCastingEvidence(text),layouts=[...new Set([...semantic.preferred,...SPELL_SEAL_LAYOUTS])];
  let chosen;
  for(const finish of SPELL_SEAL_FINISHES){
   for(const layout of layouts){
    spell.design.visualIdentity={layout,finish,method:'shared-family-composition-variation',prosePreferenceApplied:semantic.preferred.includes(layout),evidence:semantic.evidence};
    const keys=editions.map(([,rows])=>effectIdentity(recipeFor(spell),rows));
    if(keys.every((key,i)=>!used[editions[i][0]].has(key))){chosen=keys;break;}
   }
   if(chosen)break;
  }
  if(!chosen){delete spell.design.visualIdentity;throw Error(`No distinct visible casting composition for ${spell.name}; author a native treatment.`);}
  chosen.forEach((key,i)=>used[editions[i][0]].add(key));
  changed.push({id:spell.id,name:spell.name,...spell.design.visualIdentity});
 }
 const editionAssets=Object.fromEntries(editions.map(([edition,rows])=>{
  const byKey=new Map(rows.map(row=>[row.key,row])),keys=new Set();
  for(const spell of spells)for(const s of recipeFor(spell).stages){const key=(s.assets??[]).find(k=>byKey.has(k));if(key)keys.add(key);}
  return [edition,[...keys].sort().map(key=>{const r=byKey.get(key);return {key,file:r.file,files:r.files,distanceFiles:r.distanceFiles};})];
 }));
 return {entries:spells.length,changed:changed.length,variations:changed,sharedNativeCompositions:shared,editionAssets,distinct:Object.fromEntries(editions.map(([e])=>[e,used[e].size])),methodology:'Selected movie variants and visible effect layouts; excludes sounds, motions, display labels, fine timing and rank scaling. Casting seals differentiate shared families; these are compositions of shared artwork, not bespoke assets. Native material-only fields without casting seals report their shared compositions.'};
}
