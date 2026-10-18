import {PF2E_CONDITIONS,PF2E_EFFECTS,PF2E_STATE_SOURCE} from '../../../data/pf2e-state-catalog.mjs';
import {normalize,validateRecipe,matchRecipe,resolveAsset} from '../../core/model.mjs';
import {statePresentation} from '../shared/state-presentation.mjs';
import {withCatalogFx} from '../shared/catalog-fx.mjs';
export {PF2E_CONDITIONS,PF2E_EFFECTS,PF2E_STATE_SOURCE};
const entries=[...PF2E_CONDITIONS,...PF2E_EFFECTS],byId=new Map(entries.map(e=>[e.id,e])),byUuid=new Map(entries.map(e=>[e.uuid,e]));
const byCondition=new Map(PF2E_CONDITIONS.map(e=>[e.slug,e]));
const byName=new Map();
for(const e of entries){const key=`${e.kind}:${normalize(e.name)}`;if(!byName.has(key))byName.set(key,[]);byName.get(key).push(e);}
export const catalogStateEntry=id=>byId.get(String(id).replace(/^pf2e-state-/,''))??null;
export function normalizeStateCatalogState(state={}){
 state??={};const ids=vs=>[...new Set((Array.isArray(vs)?vs:[]).filter(id=>byId.has(id)))];
 return {enabled:state.enabled===true,scope:state.scope==='selected'?'selected':'all',selected:ids(state.selected),excluded:ids(state.excluded),customized:ids(state.customized),motion:state.motion!==false,fade:state.fade===true,turn:state.turn===true,opacity:Number.isFinite(Number(state.opacity))?Math.min(1,Math.max(.1,Number(state.opacity))):1};
}
export function stateEntryEnabled(id,state){return state?.enabled===true&&!state.excluded?.includes(id)&&(state.scope!=='selected'||state.selected?.includes(id)||state.customized?.includes(id));}
export function useStateEntry(state,id){
 state=normalizeStateCatalogState(state);if(!byId.has(id))throw Error('Choose a condition or effect first.');
 return normalizeStateCatalogState({...state,enabled:true,scope:state.enabled?state.scope:'selected',selected:state.enabled?[...state.selected,id]:[id],excluded:state.excluded.filter(v=>v!==id),customized:state.customized.filter(v=>v!==id)});
}
export function findStateEntry(item){
 if(item?.animaterAura)return byId.get(item.animaterAura.entryId)??null;
 if(!['condition','effect'].includes(item?.type))return null;
 if(item.type==='condition')return byCondition.get(item.slug??item.system?.slug??normalize(item.name).replaceAll(' ','-'))??null;
 for(const uuid of [item.uuid,item.sourceId,item._stats?.compendiumSource,item.flags?.core?.sourceId,item.original?.uuid]){const e=byUuid.get(uuid);if(e?.kind===item.type)return e;}
 const found=byName.get(`${item.type}:${normalize(item.name)}`)??[];
 // A source-less custom document must not bind to one of several native effects.
 return found.length===1?found[0]:null;
}
export function auraStateEntry(uuid){
 if(byUuid.get(uuid)?.kind==='effect')return byUuid.get(uuid);
 const match=/^Compendium\.pf2e\.([^.]+)\.Item\.(.+)$/.exec(uuid??'');
 const found=match?PF2E_EFFECTS.filter(e=>e.pack===match[1]&&e.name===match[2]):[];
 return found.length===1?found[0]:null;
}
// The element or resistance type an effect's ChoiceSet (or its origin) selected.
export function stateElement(entry,item){
 if(!entry?.elementVariants||!item)return null;
 const ref=entry.elementChoice??{},selections=item.flags?.system?.rulesSelections??{};
 const value=ref.origin?ref.origin.split('.').reduce((v,k)=>v?.[k],item.origin?.flags?.system):selections[ref.flag];
 return entry.elementVariants[value]?value:Object.values(selections).find(v=>typeof v==='string'&&entry.elementVariants[v])??null;
}
export function stateRecipe(entry,{damageType,element,catalog,auraVariant,aura=entry?.auras?.[0]??entry?.auraSources?.[0],fx=true,fxCatalog}={}){
 if(!entry)throw Error('Choose a condition or effect first.');
 const variantBase=entry.damageVariants?.[damageType]??(entry.elementVariants?.[element]?{...entry,...entry.elementVariants[element]}:entry);
 const base=aura?{...variantBase,assets:entry.auraAssets??variantBase.assets}:variantBase;
 const key=catalog?.length?resolveAsset(base,catalog):null;
 const design=key&&!base.conditionDesign?{...base,...statePresentation({assets:[key]})}:base;
 const wardTint=base.wardColor&&!(key??base.assets[0]).split('.').includes(base.wardColor)?{tintEnabled:true,colorize:true,tint:base.wardTint}:{};
 // Single-stage markers record whether the edition had to substitute a color;
 // honor it so a "green boon" or "red penalty" never renders as a stock blue ring.
 const chosenKey=key??base.assets[0],chosenEdition=Object.values(base.editions??{}).find(e=>e.key===chosenKey)??Object.values(base.editions??{})[0];
 const markerTint=!wardTint.tint&&chosenEdition?.colorSubstitution&&/^#[0-9a-f]{6}$/i.test(base.color??entry.color??'')?{tintEnabled:true,colorize:true,tint:base.color??entry.color}:{};
 const variant=entry.damageVariants?.[damageType]?damageType:null;
 const source=aura?.source,flags=source?.actor?.flags?.system??{},selections=source?.flags?.system?.rulesSelections??{};
 const choice=auraVariant??(entry.auraDesign?.choice==='thermal'?(flags.kineticist?.thermalNimbus??selections.thermalNimbus):entry.auraDesign?.choice==='tradition'?(flags.manifestWillTradition??selections.manifestWillTradition):null);
 const field=aura&&(entry.auraDesign?.variants?.[choice]??entry.auraDesign);
 const lifetime={kind:'aura',subject:'source',persist:true,duration:6000,fadeIn:400,fadeOut:400,bindAlpha:true,bindRotation:false};
 const area=aura?{auraSlug:aura.slug,auraRadius:aura.radius??5,scale:1,offsetX:0,offsetY:0,offsetUnits:'grid'}:{};
 const layers=field?.layers??base.conditionDesign?.layers;
 const stages=layers?layers.map(l=>{
  const selected=catalog?.length?resolveAsset(l,catalog):null,edition=selected?Object.values(l.editions??{}).find(e=>e.key===selected):null;
  return {...l,...lifetime,...area,...(edition?{tintEnabled:edition.colorSubstitution,colorize:edition.colorSubstitution}:{}),...(edition?.anchor?{customAnchor:true,anchorX:edition.anchor.x,anchorY:edition.anchor.y}:{})};
 }):[{stageId:'sustained',label:'Sustained visual',...lifetime,assets:design.assets,scale:design.scale??entry.scale,opacity:design.opacity??entry.opacity,below:design.below??entry.below,offsetX:design.offsetX??entry.offsetX,offsetY:design.offsetY??entry.offsetY,offsetUnits:design.offsetUnits??entry.offsetUnits,...area,...(aura?{below:true}:{}),...markerTint,...wardTint}];
 return withCatalogFx(validateRecipe({id:`${entry.systemId??'pf2e'}-state-${entry.id}${variant?`-${variant}`:''}`,name:entry.name,description:field?.rationale??design.rationale??entry.rationale,category:entry.group,color:design.color??entry.color,trigger:'effect',itemUuid:entry.uuid,match:entry.name,lifecycle:'document',stateEntry:entry.id,...(variant?{stateDamageType:variant}:{}),stages}),entry,{damageType,fx,fxCatalog});
}
export function resolveStateRecipe(item,state,saved=[],catalog,{customEnabled=true}={}){
 const entry=findStateEntry(item);
 const own=saved.filter(r=>r.lifecycle==='document'&&(!r.stateDamageType||r.stateDamageType===item.system?.persistent?.damageType)).sort((a,b)=>Number(Boolean(b.stateDamageType))-Number(Boolean(a.stateDamageType)));
 const custom=(entry?own.find(r=>r.stateEntry===entry.id):null)??matchRecipe(own,{type:'effect',item});
 // Your own recipe plays whenever it is enabled and custom recipes play, catalog on or off,
 // unless you explicitly picked the catalog's version of this entry.
 const handmade=Boolean(custom?.enabled&&customEnabled&&!(entry&&state?.enabled&&state.selected?.includes(entry.id)&&!state.customized?.includes(entry.id)));
 if(!handmade&&entry&&!stateEntryEnabled(entry.id,state))return null;
 if(!handmade&&!entry&&state?.enabled!==true)return null;
 const aura=item.animaterAura??null;
 if(!handmade&&entry&&state.selected?.includes(entry.id)&&!state.customized?.includes(entry.id))return stateRecipe(entry,{damageType:item.system?.persistent?.damageType,element:stateElement(entry,item),catalog,aura});
 if(custom&&!custom.enabled)return null;
 if(custom)return validateRecipe({...custom,stages:custom.stages.map(s=>{
  const {auraRadius,auraSlug,...stage}=s;
  return aura?{...stage,auraRadius:aura.radius,auraSlug:aura.slug}:stage;
 })});
 return entry?stateRecipe(entry,{damageType:item.system?.persistent?.damageType,element:stateElement(entry,item),catalog,aura}):null;
}
export function filterStateCatalog(kind,{search='',group='all',theme='all',quality='all'}={}){
 const query=normalize(search);return (kind==='condition'?PF2E_CONDITIONS:PF2E_EFFECTS).filter(e=>(group==='all'||e.group===group)&&(theme==='all'||e.theme===theme)&&(quality==='all'||e.quality===quality)&&(!query||normalize(`${e.name} ${e.slug} ${e.group} ${e.theme}`).includes(query)));
}
