import { featRecipe } from "../scripts/catalogs/pf2e/feats/feat-choreography.mjs";
import { visibleFeatComposition,semanticEntrance,FEAT_FRAMES,FEAT_ENTRANCES } from "../scripts/catalogs/pf2e/feats/feat-direction.mjs";
import { TOSS_NOTES } from '../scripts/catalogs/pf2e/feats/feat-toss.mjs';

const preferredFrame=direction=>/low|ground|floor|foot/.test(direction.shape??"")?1:/high|wing|upward|rising/.test(direction.shape??"")?2:0;
const allowedEntrances=feat=>feat.motif==="absorb"?["contracting","closing"]:
  ["preparation","spellshape","rune"].includes(feat.motif)?["contracting","closing","turning","unfolding"]:
  feat.motif==="concealment"?["breathing","closing","unfolding","ascending"]:FEAT_ENTRANCES;

export function frameFeatCatalog(feats,databases){
  const editions=Object.fromEntries(Object.entries(databases).map(([edition,rows])=>[edition,new Set(rows.map(row=>row.key))]));
  const seen=Object.fromEntries(Object.keys(editions).map(edition=>[edition,new Map()]));
  let variants=0;
  for(const feat of feats){
    const preferred=semanticEntrance(feat.direction),first=preferredFrame(feat.direction??{});
    const entrances=[preferred,...allowedEntrances(feat).filter(v=>v!==preferred)];
    let chosen=null;
    for(let attempt=0;attempt<2&&!chosen;attempt++){
    // A bespoke design that duplicates an earlier feat yields to the framed generated design.
    if(attempt)feat.bespoke=false;
    // Preserve semantic shape first. If identical, choose visibly different
    // ambient framing, footprint, then entrance. Never add attacks or change
    // attack count, flight speed, media duration or token mechanics for variety.
    outer:for(const entrance of entrances)for(const size of [1,.75,1.25])for(const pause of [0,400,800])for(const frame of [first,...FEAT_FRAMES.map((_,i)=>i).filter(i=>i!==first)]){
      feat.framing={entrance,frame,size,pause};
      const recipe=featRecipe(feat,{motion:false});
      const signatures=Object.fromEntries(Object.entries(editions).map(([edition,keys])=>[edition,JSON.stringify(visibleFeatComposition(recipe,keys,{motion:false}))]));
      if(Object.entries(signatures).every(([edition,key])=>!seen[edition].has(key))){chosen=signatures;break outer;}
    }
    }
    if(!chosen)throw Error(`Visible framing exhausted for ${feat.name}; author another semantic treatment.`);
    for(const [edition,key] of Object.entries(chosen))seen[edition].set(key,feat.id);
    if(feat.framing.frame!==first||feat.framing.size!==1||feat.framing.pause||feat.framing.entrance!==preferred)variants++;
    feat.visualDirection=TOSS_NOTES[feat.slug]?feat.direction.shape:`${feat.direction?.shape??feat.rationale}; ${FEAT_FRAMES[feat.framing.frame].name}, ${feat.framing.entrance} entrance`;
  }
  return {distinctByEdition:Object.fromEntries(Object.entries(seen).map(([edition,map])=>[edition,map.size])),visiblyReframed:variants,
    method:"Edition-specific effects-only comparison at 200ms / 0.1-square / 15-degree precision; IDs, names, labels and inactive tint ignored. Semantic activity cues get discrete visible framing when a shared basis collides."};
}
