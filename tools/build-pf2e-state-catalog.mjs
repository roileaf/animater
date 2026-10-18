import {profiles,classify,selectStateMedia,elementDesign} from './twoe-state-design.mjs';
import {readFile,readdir,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {assetDatabases,variantFiles} from './asset-databases.mjs';
import {ensureStateSources,STATE_SOURCE_SHA,STATE_SOURCE_PACKS,AURA_SOURCE_PACKS} from './pf2e-state-source.mjs';
import {statePresentation} from '../scripts/catalogs/shared/state-presentation.mjs';
import {buildAuraDesign} from './pf2e-aura-designs.mjs';
import {buildConditionDesign,buildEffectDesign,CONDITION_PLANS} from './pf2e-condition-designs.mjs';

const sha=STATE_SOURCE_SHA;
const base=await ensureStateSources();
const english=JSON.parse(await readFile(resolve(base,'../../static/lang/en.json'),'utf8'));
const localize=text=>text.replace(/@Localize\[([^\]]+)\]/g,(raw,path)=>english[path]??path.split('.').reduce((v,key)=>v?.[key],english)??raw);
const db=await assetDatabases();
const hash=v=>createHash('sha256').update(v).digest('hex');
const plain=v=>String(v??'').replace(/@UUID\[[^\]]*\](?:\{([^}]+)\})?/g,(_,label)=>label??'').replace(/<[^>]*>/g,' ').replace(/&[a-z]+;/gi,' ').replace(/\s+/g,' ').trim();
const auraSlug=(rule,item,file)=>rule.slug??item.system.slug??file.split('/').at(-1).replace(/\.json$/,'');
const auraSources=new Map();
const sourceDescriptions=new Map();
for(const pack of AURA_SOURCE_PACKS)for(const path of await readdir(`${base}/${pack}`,{recursive:true})){
 const file=path.replaceAll('\\','/');if(!file.endsWith('.json')||file==='_folders.json')continue;
 const item=JSON.parse(await readFile(`${base}/${pack}/${file}`,'utf8'));
 const nativePack=({'equipment':'equipment-srd','spells':'spells-srd','feats':'feats-srd'})[pack]??pack;
 const reference={uuid:`Compendium.pf2e.${nativePack}.Item.${item._id}`,descriptionHash:hash(localize(item.system?.description?.value??'')),sourceUrl:`https://github.com/foundryvtt/pf2e/blob/${sha}/packs/pf2e/${pack}/${file}`};
 sourceDescriptions.set(reference.uuid,reference);sourceDescriptions.set(`Compendium.pf2e.${nativePack}.Item.${item.name}`,reference);
 for(const rule of item.system?.rules??[])if(rule.key==='Aura')for(const effect of rule.effects??[]){
  if(typeof effect.uuid!=='string'||effect.uuid.includes('{'))continue;
  const sources=auraSources.get(effect.uuid)??[];
  sources.push({uuid:reference.uuid,slug:auraSlug(rule,item,file),radius:typeof rule.radius==='number'?rule.radius:null});
  auraSources.set(effect.uuid,sources);
 }
}
const select=(...args)=>selectStateMedia(db,...args);
const rows=[],packs=STATE_SOURCE_PACKS;
for(const pack of packs){
 for(const path of await readdir(`${base}/${pack}`,{recursive:true})){
  const file=path.replaceAll('\\','/');
  if(!file.endsWith('.json')||file==='_folders.json')continue;
  const item=JSON.parse(await readFile(`${base}/${pack}/${file}`,'utf8'));if(!['condition','effect'].includes(item.type))continue;
  if(item.system.description?.value)item.system.description.value=localize(item.system.description.value);
  if(pack!=='conditions'&&item.type==='condition')continue;
  const slug=file.split('/').at(-1).replace(/\.json$/,'');let design=item.type==='condition'?{theme:'neutral',quality:'symbolic'}:classify(item);
  const element=item.type==='effect'?elementDesign(item,design.theme):null;
  if(element)design={...design,...element.base};
  if(design.theme==='fog'&&!design.color)design={...design,...fogLook(`${item.name} ${plain(item.system.description?.value)}`)};
  const profile=profiles[design.theme];
  const condition=item.type==='condition';const nativePack=condition?'conditionitems':pack;
  const entry={id:`${pack}-${item._id}`,documentId:item._id,pack:nativePack,sourcePack:pack,uuid:`Compendium.pf2e.${nativePack}.Item.${item._id}`,slug,name:item.name,img:item.img,kind:condition?'condition':'effect',group:condition?'Conditions':({'spell-effects':'Spell effects','equipment-effects':'Item effects','feat-effects':'Feat effects','bestiary-effects':'Creature effects','campaign-effects':'Campaign effects','other-effects':'Other effects','boons-and-curses':'Boons and curses'}[pack]),description:item.system.description?.value??'',descriptionHash:hash(item.system.description?.value??''),sourceUrl:`https://github.com/foundryvtt/pf2e/blob/${sha}/packs/pf2e/${pack}/${file}`,theme:design.theme,color:design.hex??profile.hex,quality:design.quality,evidence:design.evidence,rationale:design.rationale??profile.note,...select(design.theme,slug,design.color),...(design.wardColor?{wardColor:design.wardColor,wardTint:design.hex}:{}),scale:1.15,opacity:0.5,below:['slow','speed','stone','rage','neutral','boon'].includes(design.theme),private:design.theme==='cooldown'||['hidden','undetected','unnoticed','invisible','friendly','helpful','indifferent','hostile','unfriendly','observed'].includes(slug),nativeDuration:item.system.duration??null};
  // A chosen element or resistance type resolves at runtime from the item's rule selection.
  if(element?.choice){
   entry.elementChoice=element.choice;
   entry.elementVariants=Object.fromEntries(Object.entries(element.variants).map(([type,look])=>{const media=select(look.theme,slug,look.color);return [type,{theme:look.theme,color:look.hex??profiles[look.theme].hex,rationale:profiles[look.theme].note,...media,...(look.wardColor?{wardColor:look.wardColor,wardTint:look.hex}:{}),...statePresentation(media)}];}));
  }
  // Timed variants of a core condition reuse that condition's reviewed look.
  const parent=/^Effect: (.+) until (?:the )?end of your next turn$/.exec(item.name)?.[1]?.toLowerCase().replace(/[^a-z]+/g,'-');
  Object.assign(entry,condition?buildConditionDesign(entry,db):CONDITION_PLANS[parent]?{...buildConditionDesign({...entry,slug:parent},db),evidence:`Timed variant of the native ${parent} condition`}:buildEffectDesign(entry,db)??statePresentation(entry));
  const auras=(item.system.rules??[]).filter(r=>r.key==='Aura').map(r=>({slug:auraSlug(r,item,file),radius:typeof r.radius==='number'?r.radius:null}));
  const sources=[...new Map([...(auraSources.get(entry.uuid)??[]),...(auraSources.get(`Compendium.pf2e.${nativePack}.Item.${item.name}`)??[])].map(s=>[`${s.uuid}:${s.slug}`,s])).values()];
  if(auras.length)entry.auras=auras;
  if(sources.length)entry.auraSources=sources;
  // Explicit compositions replace theme/hash selection for native area fields.
  if(auras.length||sources.length){
   entry.auraDesign=buildAuraDesign(entry,db);
   const refs=[...sources.map(s=>s.uuid),...entry.description.matchAll(/@UUID\[([^\]]+)\]/g)].map(s=>typeof s==='string'?s:s[1]);
   entry.auraDesign.reviewSources=[{uuid:entry.uuid,descriptionHash:entry.descriptionHash,sourceUrl:entry.sourceUrl},...[...new Map(refs.map(uuid=>sourceDescriptions.get(uuid)).filter(Boolean).map(r=>[r.uuid,r])).values()]];
   entry.auraAssets=entry.auraDesign.layers[0].assets;entry.auraEditions=entry.auraDesign.layers[0].editions;
  }
  rows.push(entry);
 }
}
rows.sort((a,b)=>a.name.localeCompare(b.name)||a.pack.localeCompare(b.pack));
const conditionsData=rows.filter(r=>r.kind==='condition'),effects=rows.filter(r=>r.kind==='effect');
function fogLook(text){
 if(/\b(?:dust|sand|silt)\b/i.test(text))return {color:'orangeyellow',hex:'#d8c294'};
 if(/fetid|noxious|toxic|poison|stench|smog|miasma|putrid|reek/i.test(text))return {color:'greenyellow',hex:'#b8d48c'};
 return {};
}
const fieldLayers=r=>[...(r.auraDesign?.layers??[]),...Object.values(r.auraDesign?.variants??{}).flatMap(v=>v.layers),...(r.conditionDesign?.layers??[]),...Object.values(r.damageVariants??{}).flatMap(v=>v.conditionDesign?.layers??[])];
const coverage=Object.fromEntries(Object.entries(db).map(([edition,assets])=>{const keys=[...new Set(rows.flatMap(r=>[r.editions[edition].key,...fieldLayers(r).map(l=>l.editions[edition].key),...Object.values(r.damageVariants??{}).map(v=>v.editions[edition].key),...Object.values(r.elementVariants??{}).map(v=>v.editions[edition].key)]))];return[edition,{available:assets.length,selected:keys.length,families:[...new Set(keys.map(k=>k.split('.')[1]))],missing:keys.filter(k=>!assets.some(r=>r.key===k))}]}));
const auraEntries=effects.filter(e=>e.auraDesign);
const fingerprint=(e,edition)=>JSON.stringify(e.auraDesign.layers.map(l=>[l.editions[edition].files.slice().sort(),l.tint,l.below]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))));
const structure=(e,edition)=>JSON.stringify(e.auraDesign.layers.map(l=>l.editions[edition].key.replace(/\.(?:blue|grey|green|white|black|dark_black|orange|purple|red|yellow|pink|bluepurple|blueteal|greenpurple|greenyellow|purplered|orangeyellow|bluepink|pinkpurple|pinkyellow|orangepurple)$/,'')).sort());
const auraReview={entries:auraEntries.length,emitters:auraEntries.filter(e=>e.auras).length,abilities:new Set(auraEntries.map(e=>e.auraDesign.id)).size,
 editions:Object.fromEntries(Object.keys(db).map(edition=>{const groups=new Map(),structures=new Map();for(const e of auraEntries){for(const [map,key] of [[groups,fingerprint(e,edition)],[structures,structure(e,edition)]]){const group=map.get(key)??[];group.push(e);map.set(key,group);}}return [edition,{compositions:groups.size,structuralCompositions:structures.size,unrelatedStructuralDuplicates:[...structures.values()].filter(g=>new Set(g.map(e=>e.auraDesign.id)).size>1).map(g=>g.map(e=>e.name)),unrelatedDuplicates:[...groups.values()].filter(g=>new Set(g.map(e=>e.auraDesign.id)).size>1).map(g=>g.map(e=>e.name)),sharedAbilityGroups:[...groups.values()].filter(g=>g.length>1&&new Set(g.map(e=>e.auraDesign.id)).size===1).map(g=>g.map(e=>e.name))}]}))};
if(Object.values(auraReview.editions).some(e=>e.unrelatedDuplicates.length||e.unrelatedStructuralDuplicates.length))throw Error(`Unrelated native aura compositions still duplicate: ${JSON.stringify(auraReview.editions)}`);
const source={version:'8.6.0',sha,conditions:conditionsData.length,effects:effects.length,packs:Object.fromEntries(packs.map(p=>[p,rows.filter(r=>r.sourcePack===p).length])),coverage,localizationSource:`https://github.com/foundryvtt/pf2e/blob/${sha}/static/lang/en.json`,unresolvedLocalizations:rows.filter(r=>r.description.includes('@Localize[')).map(r=>r.id),missingDescriptions:rows.filter(r=>!r.description).map(r=>({id:r.id,name:r.name})),scope:'Core PF2e condition, spell, equipment, feat, creature, other, campaign, boon and curse effect Item documents. Application/removal remains native PF2e.'};
await mkdir('data',{recursive:true});await writeFile('data/pf2e-state-catalog.mjs',`// Generated from pinned native PF2e descriptions; no JB2A media bundled.\nexport const PF2E_STATE_SOURCE=${JSON.stringify(source,null,2)};\nexport const PF2E_CONDITIONS=${JSON.stringify(conditionsData)};\nexport const PF2E_EFFECTS=${JSON.stringify(effects)};\n`);
await writeFile('data/pf2e-state-catalog-audit.json',JSON.stringify({source,auraReview,entries:rows.map(r=>({id:r.id,name:r.name,kind:r.kind,theme:r.theme,quality:r.quality,evidence:r.evidence,descriptionHash:r.descriptionHash,editions:r.editions,auras:r.auras,auraSources:r.auraSources,auraEditions:r.auraEditions,auraDesign:r.auraDesign,conditionDesign:r.conditionDesign,damageVariants:r.damageVariants,elementChoice:r.elementChoice,elementVariants:r.elementVariants,presentationRole:r.presentationRole,scale:r.scale,opacity:r.opacity,below:r.below,offsetY:r.offsetY})),issues:[]},null,2)+'\n');
console.log(JSON.stringify({source,auraReview},null,2));
