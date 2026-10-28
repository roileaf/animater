import { featCatalogDocumentation } from "./feat-catalog-doc.mjs";
import { writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { featSources } from "./pf2e-feat-source.mjs";
import { assetDatabases } from "./asset-databases.mjs";
import { assetGeometry } from "./spell-asset-selection.mjs";
import { resolveFeatMedia, FEAT_SELECTION_REVISION } from "./feat-asset-selection.mjs";
import { mediaTiming } from "./media-timing.mjs";
import { classifyFeat, analyzeFeat, plainFeatDescription } from "./feat-semantics.mjs";
import { SPELL_THEMES } from "../scripts/catalogs/pf2e/spells/spell-choreography.mjs";
import { FEAT_MOTIFS, featRecipe } from "../scripts/catalogs/pf2e/feats/feat-choreography.mjs";
import { planRecipe, validateRecipe } from "../scripts/core/model.mjs";
import { recipeDuration } from "../scripts/engines/playback/choreography.mjs";
import { loadFeatReviews,reviewedFeatDesign } from "./feat-review.mjs";
import { frameFeatCatalog } from "./feat-framing.mjs";
import { MEDIA_DURATIONS } from "../data/media-durations.mjs";
import { isPathMotion } from "../scripts/engines/motion/motion-path.mjs";
import { GENERATED_MOTION_DURATION } from "../scripts/engines/motion/motion-pacing.mjs";

const classes = new Set("alchemist animist barbarian bard champion cleric commander druid exemplar fighter guardian gunslinger inventor investigator kineticist magus monk oracle psychic ranger rogue sorcerer summoner swashbuckler thaumaturge witch wizard".split(" "));
const counts = values => Object.fromEntries([...new Set(values)].sort().map(value => [value,values.filter(v=>v===value).length]));
// One pipeline, three catalogs: feats, class features and basic actions.
const CATALOGS = {
  feats: { pack: "feats", data: "data/pf2e-feats.mjs", items: "PF2E_FEATS", meta: "PF2E_FEAT_SOURCE", audit: "data/pf2e-feat-audit", doc: "docs/pf2e-feat-catalog.md", requireReview: true, label: "feat" },
  classfeatures: { pack: "(?:class-features|ancestry-features)", data: "data/pf2e-class-features.mjs", items: "PF2E_CLASS_FEATURES", meta: "PF2E_CLASS_FEATURE_SOURCE", audit: "data/pf2e-class-feature-audit", doc: null, requireReview: false, label: "class feature" },
  actions: { pack: "actions", data: "data/pf2e-actions.mjs", items: "PF2E_ACTIONS", meta: "PF2E_ACTION_SOURCE", audit: "data/pf2e-action-audit", doc: null, requireReview: false, label: "action" },
};
const catalogName = process.argv.find(a => a.startsWith("--catalog="))?.split("=")[1] ?? "feats";
const CFG = CATALOGS[catalogName];
if (!CFG) throw Error(`Unknown catalog ${catalogName}; use feats, classfeatures or actions.`);
// Passive class features that add damage to a Strike play as damage-roll riders.
const RIDERS = { "sneak-attack": "sneak-attack", "precise-strike": "precise-strike", "precision": "precision", "flurry-of-blows-precision": "precision", "vicious-swing": "vicious-swing", "strategic-strike": "strategic-strike" };
// Native compendium ids from the PF2e system manifest (packs/actions → actionspf2e, etc.).
const NATIVE_PACKS = { actions: "actionspf2e", "class-features": "classfeatures", "ancestry-features": "ancestryfeatures" };
const nativeUuid = (path,id) => { const pack = NATIVE_PACKS[path.split("/").at(path.startsWith("packs/pf2e/") ? 2 : 1)]; if (!pack) throw Error(`No native pack for ${path}.`); return `Compendium.pf2e.${pack}.Item.${id}`; };
const [source,databases] =await Promise.all([featSources("pf2e-8.6.0", CFG.pack),assetDatabases()]);
const reviews=await loadFeatReviews();
const previousModule = process.argv.includes("--reuse-media") ? await import(`../${CFG.data}`) : null;
const previous = previousModule ? { PF2E_FEAT_SOURCE: previousModule[CFG.meta], PF2E_FEATS: previousModule[CFG.items] } : null;
if (previous && previous.PF2E_FEAT_SOURCE.sha !== source.sha) throw Error("Cannot reuse media from a different PF2e source revision.");
const previousById = new Map((previous?.PF2E_FEATS ?? []).map(feat => [feat.id,feat]));
const exclusions = [], feats = [];
const sourceAudit = [];
console.log(`Fetched ${source.feats.length} feat descriptions from ${source.ref}.`);
for (const entry of source.feats) {
  const item=entry.source,s=item.system,riderSlug=catalogName==="classfeatures"?RIDERS[s.slug??item.name.toLowerCase().replace(/[^a-z0-9]+/g,"-")]:null;
  const classification=riderSlug?{...classifyFeat(item),included:true,classification:"damage-rider",reason:"Passive class feature that adds damage to a Strike; plays as a rider on that damage roll."}:classifyFeat(item);
  const audit={id:item._id,name:item.name,path:entry.path,sourceBlob:entry.sha,actionType:s.actionType?.value,actions:s.actions?.value,category:s.category,...classification};
  sourceAudit.push(audit);
  if (!classification.included) {exclusions.push(audit);continue;}
  const analyzed=analyzeFeat(item,entry.path);
  const design=CFG.requireReview?reviewedFeatDesign(analyzed,reviews[item._id],classification.descriptionHash,item.name)
    :{...analyzed,review:{method:"full-description semantic rules",fullDescriptionRead:false,descriptionHash:classification.descriptionHash}},selections=[];
  const profile=FEAT_MOTIFS[design.motif],theme=SPELL_THEMES[design.theme];
  if(!theme) throw Error(`Unknown theme ${design.theme} for ${item.name}.`);
  const cached = previousById.get(item._id);
  const compatible = previous?.PF2E_FEAT_SOURCE.selectionRevision === FEAT_SELECTION_REVISION && cached?.descriptionHash === classification.descriptionHash && cached.motif === design.motif && cached.theme === design.theme && JSON.stringify(cached.direction)===JSON.stringify(design.direction) && (!["rebounding-assault","throw-and-catch"].includes(design.slug)||cached.assets.thrown) && (design.slug!=="vengeful-spirit-deck"||cached.assets.bolt.some(k=>k.startsWith("jb2a.ranged.card.")));
  // An updated pack may remove an alias. Cached media must still have a key
  // for every edition and slot before its contact analysis can be reused.
  const cacheAvailable=compatible&&Object.values(databases).every(rows=>Object.values(cached.assets).every(keys=>!keys.length||keys.some(key=>rows.some(row=>row.key===key))));
  const resolved=cacheAvailable && (design.slug!=="running-reload" || cached.assets.reload) ? {assets:cached.assets,selections:cached.selections} : resolveFeatMedia(databases,design.theme,profile,theme,{name:item.name,slug:design.slug,motif:design.motif,rationale:design.rationale,direction:design.direction,traits:s.traits?.value??[],description:plainFeatDescription(s.description?.value)});
  const assets=resolved.assets;selections.push(...resolved.selections);
  const traits=s.traits?.value??[];
  feats.push({id:item._id,name:item.name,img:item.img,slug:design.slug,level:s.level?.value??0,actionType:s.actionType?.value,actions:s.actions?.value,
    activation:s.actionType?.value,category:s.category??"class",classTraits:traits.filter(t=>classes.has(t)),traits,rarity:s.traits?.rarity??"common",
    edition:s.publication?.remaster===false||entry.path.includes("legacy")?"legacy":"remaster",publication:s.publication?.title??"",path:entry.path,
    sourceUrl:`https://github.com/foundryvtt/pf2e/blob/${source.sha}/${entry.path}`,sourceBlob:entry.sha,
    description:s.description?.value??"",plainDescription:plainFeatDescription(s.description?.value),descriptionHash:classification.descriptionHash,
    classification:classification.classification,classificationReason:classification.reason,trigger:riderSlug?"damage":"use",...(riderSlug?{rider:riderSlug}:{}),
    ...(catalogName!=="feats"?{catalogKind:catalogName,itemType:item.type,recipeKind:catalogName==="actions"?"action":"feature",uuid:nativeUuid(entry.path,item._id)}:{}),...design,assets,selections});
}
if(new Set(feats.map(f=>f.id)).size!==feats.length) throw Error("Duplicate feat compendium IDs.");
if(CFG.requireReview&&feats.some(f=>!f.review?.fullDescriptionRead))throw Error("Complete active feat description review required before rebuilding catalog.");
console.log(`Selected full-inventory assets for ${feats.length} active feats; probing complete footage.`);
const allKeys=[...new Set(feats.flatMap(f=>Object.values(f.assets).flat()))],timings=Object.assign({},...(previous?.PF2E_FEATS ?? []).map(feat=>feat.mediaTiming)),maps=Object.fromEntries(Object.entries(databases).map(([edition,rows])=>[edition,new Map(rows.map(row=>[row.key,row]))]));
let next=0;
await Promise.all(Array.from({length:4},async()=>{
  while(next<allKeys.length){
    const key=allKeys[next++],row=maps.patreon.get(key)??maps.free.get(key);
    if(timings[key]) {
      // Reuse contact analysis, but include the measured longest distance/random clip.
      timings[key]={...timings[key],duration:Math.max(timings[key].duration,MEDIA_DURATIONS[key]??0)};
      continue;
    }
    const timing=await mediaTiming(row,databases);
    if(timing) timings[key]={...timing,melee:["melee","melee_large"].includes(row.templateName)};
  }
}));
for(const feat of feats) feat.mediaTiming=Object.fromEntries(Object.values(feat.assets).flat().filter(key=>timings[key]).map(key=>[key,timings[key]]));
const variety=frameFeatCatalog(feats,databases);
const signatures=new Map();
for(const feat of feats){
  const recipe=featRecipe(feat),fingerprint=createHash("sha256").update(JSON.stringify(recipe.stages.map(({stageId,label,afterStage,...s})=>({...s,afterIndex:afterStage?recipe.stages.findIndex(p=>p.stageId===afterStage):-1})))).digest("hex");
  feat.compositionHash=fingerprint;
  if(!signatures.has(fingerprint))signatures.set(fingerprint,[]);
  signatures.get(fingerprint).push(feat.id);
}
for(const feat of feats) feat.sharedCount=signatures.get(feat.compositionHash).length;
const sourceMeta={version:source.ref.replace(/^pf2e-/,""),ref:source.ref,sha:source.sha,repository:"foundryvtt/pf2e",url:`https://github.com/foundryvtt/pf2e/tree/${source.sha}/packs/pf2e/${catalogName==="classfeatures"?"class-features":CFG.pack}`,catalog:catalogName,
  selectionRevision:FEAT_SELECTION_REVISION,
  total:source.feats.length,count:feats.length,active:feats.length,excluded:exclusions.length,passive:exclusions.length,
  actionTypes:counts(feats.map(f=>f.actionType)),actions:counts(feats.filter(f=>f.actionType==="action").map(f=>f.actions)),
  classifications:counts(sourceAudit.map(f=>f.classification)),quality:counts(feats.map(f=>f.quality)),
  authored:feats.filter(f=>f.authored).length,motifs:Object.keys(counts(feats.map(f=>f.motif))).length,distinctCompositions:signatures.size,
  reviewed:feats.filter(f=>f.review?.fullDescriptionRead).length,unreviewed:feats.filter(f=>!f.review?.fullDescriptionRead).map(f=>({id:f.id,name:f.name})),variety,
  descriptionChars:feats.reduce((sum,f)=>sum+f.descriptionChars,0),missingDescriptions:feats.filter(f=>!f.descriptionChars).map(f=>f.id),
  mediaTiming:{probed:Object.keys(timings).length,missing:allKeys.filter(key=>!timings[key])},
  scope:"Native feat actionType action/reaction/free only. Passive grants and uncertain embedded exploration/downtime activities excluded.",
  trigger:"Own feat sent to chat. Generic Strikes, skills, damage and passive acquisitions do not activate built-ins."};
const issues=[],coverage={};
const sourceToken={id:"s",center:{x:100,y:100},document:{x:50,y:50,width:1,height:1},actor:{id:"a"}},target={id:"t",center:{x:400,y:100},document:{x:350,y:50,width:1,height:1},actor:{id:"b"}};
for(const [edition,rows] of Object.entries(databases)) {
  const used=new Set();let effects=0,motions=0;
  for(const feat of feats){
    const recipe=validateRecipe(featRecipe(feat));
    try{
      const plan=planRecipe(recipe,rows,{source:sourceToken,targets:[target],gridSize:100,gridDistance:5,area:{center:{x:400,y:100},diameter:400}});
      for(const stage of plan){
        if(stage.asset){used.add(stage.asset);effects++; const row=maps[edition].get(stage.asset),geometry=assetGeometry(row);
          if(["cast","impact","aura"].includes(stage.kind)&&geometry!=="radial") issues.push({id:feat.id,name:feat.name,edition,stage:stage.label,asset:stage.asset,reason:`${stage.kind} must use localized geometry; got ${geometry}`});
          if(stage.kind==="travel"&&!["projectile","beam","line"].includes(geometry))issues.push({id:feat.id,name:feat.name,edition,asset:stage.asset,reason:`travel got ${geometry}`});
        }
        if(stage.kind==="motion"){motions++;const invalid=isPathMotion(stage)?stage.duration<GENERATED_MOTION_DURATION[stage.motion]||stage.distance>12||stage.intensity>.8:stage.duration<800||stage.distance>.25||stage.intensity>.65;if(invalid) issues.push({id:feat.id,name:feat.name,edition,reason:"Motion exceeds its pacing or path limits"});}
      }
    }catch(error){issues.push({id:feat.id,name:feat.name,edition,reason:error.message});}
  }
  coverage[edition]={availableKeys:rows.length,usedKeys:used.size,families:[...new Set([...used].map(key=>key.split(".")[1]))].sort(),effects,motions,used:[...used].sort()};
}
await mkdir("data",{recursive:true});await mkdir("docs",{recursive:true});
await writeFile(CFG.data,`// Generated by tools/build-pf2e-feat-catalog.mjs${catalogName==="feats"?"":" --catalog="+catalogName}; pinned full compendium descriptions.\nexport const ${CFG.meta} = ${JSON.stringify(sourceMeta,null,2)};\nexport const ${CFG.items} = ${JSON.stringify(feats,null,2)};\n`);
const report={source:sourceMeta,coverage,issues,variety,sharedCompositions:[...signatures.entries()].filter(([,ids])=>ids.length>1).map(([hash,ids])=>({hash,count:ids.length,ids})),descriptionReviews:feats.map(f=>({id:f.id,name:f.name,review:f.review,evidence:f.evidence,direction:f.direction,framing:f.framing,visualDirection:f.visualDirection})),sourceAudit};
await writeFile(`${CFG.audit}.json`,JSON.stringify(report,null,2)+"\n");
const csvValue=v=>`"${String(v??"").replaceAll('"','""')}"`;
await writeFile(`${CFG.audit}.csv`,["id,name,activity,actions,level,category,quality,motif,theme,sharedCount,descriptionHash,path,rationale",...feats.map(f=>[f.id,f.name,f.actionType,f.actions,f.level,f.category,f.quality,f.motif,f.theme,f.sharedCount,f.descriptionHash,f.path,f.rationale].map(csvValue).join(","))].join("\n")+"\n");
if(CFG.doc)await writeFile(CFG.doc,featCatalogDocumentation(sourceMeta,coverage,issues));
console.log(JSON.stringify({source:sourceMeta,coverage:Object.fromEntries(Object.entries(coverage).map(([edition,{used,families,...rest}])=>[edition,{...rest,families:families.length}])),timingKeys:Object.keys(timings).length,issues:issues.slice(0,15)},null,2));
if(issues.length)process.exitCode=1;
