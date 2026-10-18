import {installedFxCatalog, OPTIONAL_FX_KINDS} from '../../engines/playback/optional-fx.mjs';
import {tokenFx} from '../../engines/tokenshade/api.mjs';
import {validateRecipe, MAX_STAGES} from '../../core/model.mjs';
import {applyBespoke} from './bespoke.mjs';
import {BESPOKE} from '../bespoke/index.mjs';
import {CATALOG_FX_EVIDENCE} from '../../../data/catalog-fx-evidence.mjs';
import {fxSemantics} from './catalog-fx-semantics.mjs';
import {fitCastClips} from '../../engines/playback/cast-clip.mjs';

export function catalogFxSettings(game = globalThis.game) {
  const enabled = key => { try { return game?.settings?.get('animater',key) !== false; } catch { return true; } };
  return {token:enabled('catalogTokenFx'),scene:enabled('catalogSceneFx')};
}
export function liveCatalogFx() {
  const game=globalThis.game, settings=catalogFxSettings(game);
  const catalog=installedFxCatalog({modules:game?.modules,tokenFx,
    fxmaster:globalThis.FXMASTER?.api,config:globalThis.CONFIG?.fxmaster,
    localize:key=>game?.i18n?.localize?.(key)??key,isGM:game?.user?.isGM===true});
  return {...catalog,tokenReady:catalog.tokenReady&&settings.token,sceneReady:catalog.sceneReady&&settings.scene};
}
const slug = entry => String(entry.slug??entry.identifier??entry.name??'').toLowerCase()
  .replace(/^(?:spell[ -])?effect[ -:]*/,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const bodyProfiles = {
  fire:{preset:'fire',tint:'#ff9b45'},  // '[BW] …' presets are registered by the optional Baileywiki modules, not Token
  // Magic FX itself; without them the core frost aura plays instead.
  cold:{preset:'[BW] Overlay Cold Ice',fallback:'pure-ice-aura',tint:'#9cdeff'},
  // Acid and poison glow on the body's outline. The fumes and smoke presets lay a fog over the whole token
  // art in overlay blending and have no transparency setting, so even Strength 0.1 left the face buried.
  electricity:{preset:'electric',tint:'#88cfff'},acid:{preset:'glow',tint:'#a2dc48'},
  poison:{preset:'glow',tint:'#78bc57'},force:{preset:'glow',tint:'#ba9cff'},
  // Force-field presets (hexa/earth/water-field) draw a large dome with a dark
  // rim and radiating lines over the token; wards glow on the body instead.
  healing:{preset:'glow',tint:'#80dda4'},ward:{preset:'glow',tint:'#a7bcff'},
  stone:{preset:'glow',tint:'#bea57f'},water:{preset:'glow',tint:'#75cfff'},
  blur:{preset:'blur'},distortion:{preset:'distortion'},mirror:{preset:'images'},spectral:{preset:'spectral-body',tint:'#83dcf3'},
  teleport:{preset:'warp-field',tint:'#ccb8ff'},fireWard:{preset:'fire-aura',tint:'#ffb267'},
  rush:{preset:'zoomblur'},
};
const themes={fire:'fire',cold:'cold',ice:'cold',electricity:'electricity',lightning:'electricity',acid:'acid',poison:'poison',force:'force'};
// Reviewed fiction overrides: a chosen element (freezing breath or sonic scream),
// hail that deals bludgeoning, or healing that only happens when a form ends.
const elementVetoes=[[/^storming-breath$/],[/^storm-of-vengeance$/,/hail|gust/i]];
const healingVetoes=[/^invoke-the-leviathan$/];
const stealthy=/^(?:hide|sneak|create-a-diversion|avoid-notice|underhanded-assault)$/;
const variantName=options=>String(options.variant?.label??'')+' '+String(options.variant?.activityName??'');
// Hexa-field only on a magical barrier: field wording, or a magical source
// (spell, spell effect, tradition/mythic trait) that is not a raised shield,
// worn armor or toughened body.
const magicalSource=entry=>entry.kind==='spell'||entry.rank!=null||!!entry.traditions?.length||/^spell-effect/.test(String(entry.slug??''))||
  (entry.traits??[]).some(t=>['arcane','divine','occult','primal','magical','mythic','spell'].includes(t));
const realWard=(entry,meaning)=>!meaning.mundane&&(meaning.field||magicalSource(entry)&&!meaning.body);
const vetoed=(list,name,options)=>list.some(([n,v])=>n.test(name)&&(!v||v.test(variantName(options))));
const material = stage => (stage.assets??[]).join(' ');
const visual = stage => !['sound','motion','sprite',...OPTIONAL_FX_KINDS].includes(stage.kind);
const onTarget = stage => stage.kind==='impact'||stage.subject==='targets'||stage.kind==='template';
const semantics = (entry,recipe) => {
  const key=entry.uuid??entry.sourceUUID??recipe.itemUuid;
  return Object.hasOwn(CATALOG_FX_EVIDENCE,key)
    ? Object.fromEntries(CATALOG_FX_EVIDENCE[key].map(key=>[key,true])) : fxSemantics(entry);
};

// Existing reviewed delivery, material and description evidence determine body
// accents. A theme alone never means the caster or every victim is on fire.
function bodyProfile(recipe, entry, anchor, options) {
  if(entry.design?.contactFx===false)return null;
  const name=slug(entry),art=material(anchor),persistent=recipe.lifecycle==='document',meaning=semantics(entry,recipe);
  if (persistent && /^(?:persistent-damage|burning)$/.test(name))
    return themes[options.damageType??recipe.stateDamageType]??null;
  if (/^(?:blur|concealed|concealment|blurred)(?:-|$)/.test(name))return 'blur';
  // Concealment of the token itself only: not a suppressed property, an
  // immunity, or a wall that hides others.
  // Mirror Image shows its illusory duplicates with the image-copy token filter.
  if (/^mirror-image(?:-|$)/.test(name))return 'mirror';
  if (/^(?:invisible|invisibility|displacement)(?:-|$)/.test(name)&&!/(?:suppressed|immunity|curtain)/.test(name))return 'distortion';
  if (/^(?:ethereal|etherealness|ghostly-form|incorporeal-form|ghost-walk)(?:-|$)/.test(name))return 'spectral';
  if (persistent && name==='poisoned')return 'poison';
  if (meaning.healing&&!healingVetoes.some(v=>v.test(name))&&/jb2a\.(?:cure_wounds|healing_generic|heal\.)/.test(art))return 'healing';
  // A force-field dome around the token; JB2A shield art already
  // draws the barrier, so only shell-like fields without their own bubble get it.
  if (meaning.ward&&realWard(entry,meaning)&&anchor.kind==='aura'&&/jb2a\.(?:wall_of_force|antilife_shell|protect)/.test(art))return 'ward';
  if (anchor.kind==='aura'&&/jb2a\.fire_shield/.test(art))return 'fireWard';
  if (anchor.kind==='aura'&&/jb2a\.stoneskin/.test(art))return 'stone';
  if (anchor.kind==='aura'&&/jb2a\.(?:water_bubble|watery_sphere)/.test(art))return 'water';
  if (!onTarget(anchor))return null;
  // The element of a play-time choice is unknown when FX are composed; a fixed
  // element preset would contradict the art chosen at playback.
  if (recipe.elementChoice)return null;
  const theme=themes[options.mode?.payload?.element??options.mode?.element??options.variant?.theme??entry.theme];
  if (!theme)return null;
  const damaging=!!options.mode&&options.mode.element!=='physical'||meaning.damage||
    ['attack','damage'].includes(recipe.trigger)&&entry.design?.impact!==false;
  if (!damaging&&!persistent)return null;
  // Weapon modes carry native damage. Elsewhere, when the description names
  // damage types, the body accent must be one of them (Sacred Flame is radiant).
  if (!options.mode&&!persistent){
    if (vetoed(elementVetoes,name,options))return null;
    const named=Object.keys(meaning).filter(k=>k.startsWith('dmg-'));
    if (named.length&&!meaning[`dmg-${theme}`])return null;
  }
  const materials={fire:/jb2a\.(?:fire|flames|burning|scorching|explosion)/,cold:/jb2a\.(?:ice|frost|cold|snow|sleet|ray_of_frost|cone_of_cold)|jb2a\.breath_weapons\d*\.[\w.]*\b(?:cold|ice|frost)\b/,
    electricity:/jb2a\.(?:lightning|electric|chain_lightning|static_electricity)/,acid:/jb2a\.(?:acid|liquid|drop|splash)/,
    poison:/jb2a\.(?:poison|smoke|gas|liquid|drop|splash)/,force:/jb2a\.(?:impact|magic_missile|eldritch|force|energy_field|explosion)/};
  return materials[theme].test(art)?theme:null;
}
const sceneProfiles={
  earthquake:{category:'filter',type:'screenShake',duration:2400,options:{timed:true,strength:.18,speed:.2,smoothness:.75,blur:0,decay:.85,duration:2.4,audioAware:false}},
  'control-weather':{category:'particle',type:'clouds',duration:6000,options:{density:.12,speed:.25}},
  'storm-of-vengeance':{category:'particle',type:'rain',duration:6000,options:{density:.3,speed:.6,splash:false}},
};

export function catalogFxDesign(recipe, entry, options={}) {
  if (!recipe.enabled || entry.design?.unavailable || entry.design?.motif==='generic')return [];
  const stages=recipe.stages.filter(visual),persistent=recipe.lifecycle==='document', additions=[];
  const meaning=semantics(entry,recipe);
  // Speed blur only where the body really travels; stealth moves are not dashes.
  const bodyStages=meaning.moves&&!stealthy.test(slug(entry))?recipe.stages.filter(s=>s.kind==='motion'&&s.motion==='rush'&&s.subject==='source'):[];
  const teleportStage=!persistent&&meaning.teleport&&stages.find(s=>/jb2a\.(?:misty_step|portals|teleportation)/.test(material(s)));
  const order=persistent?stages:[...bodyStages,...(teleportStage?[teleportStage]:[]),...stages.filter(onTarget),...stages.filter(s=>!onTarget(s))];
  for (const anchor of order) {
    const profile=bodyStages.includes(anchor)?'rush':anchor===teleportStage?'teleport':bodyProfile(recipe,entry,anchor,options),spec=bodyProfiles[profile];
    if (!spec)continue;
    const subject=persistent?'source':onTarget(anchor)?'targets':anchor.subject??'source';
    const duration=persistent?6000:Math.max(1400,Math.min(2400,anchor.duration??1600));
    additions.push({kind:'tokenfx',stageId:`${recipe.id}-tmfx`,label:`Tokenshade · ${spec.preset}`,assets:[],
      catalogFx:true,fxProfile:profile,fxPreset:spec.preset,...(spec.fallback?{fxFallbackPreset:spec.fallback}:{}),fxLibrary:'tmfx-main',fxTint:spec.tint??'',subject,persist:persistent,
      delay:persistent?0:anchor.delay??0,duration,optionalTargets:subject==='targets',
      ...(persistent?{}:{afterStage:anchor.stageId,timingAnchor:'start',startOffset:0,
        targetSelection:anchor.targetSelection??'all',targetLimit:anchor.targetLimit??0,
        targetStagger:0,requiresHit:anchor.requiresHit===true})});
    break;
  }
  const scene=!persistent&&sceneProfiles[slug(entry)];
  if (scene) {
    const anchor=stages.find(s=>s.kind==='template')??stages[0];
    additions.push({kind:'scenefx',stageId:`${recipe.id}-fxmaster`,label:`FXMaster · ${scene.type}`,assets:[],catalogFx:true,
      fxProfile:slug(entry),fxCategory:scene.category,fxType:scene.type,fxOptions:{...scene.options},
      delay:anchor?.delay??0,duration:scene.duration,...(anchor?{afterStage:anchor.stageId,timingAnchor:'start',startOffset:0}:{})});
  }
  return additions;
}
export function withCatalogFx(recipe, entry, options={}) {
  // Reviewed bespoke compositions and play-time element choice come first, so they
  // apply whether or not optional FX providers are installed.
  recipe=applyBespoke(recipe, entry, options);
  // Every built-in catalog passes here: its cast stages show their whole clip
  // (lead-in skipped, visible length kept) before FX layers time off them.
  const fitted=fitCastClips(recipe);
  if(fitted!==recipe)recipe=validateRecipe(fitted);
  if (options.fx===false||BESPOKE[recipe.bespoke]?.fx===false)return recipe;
  const catalog=options.fxCatalog??liveCatalogFx();
  if (!catalog.tokenReady&&!catalog.sceneReady)return recipe;
  const has=(name,library)=>catalog.presets?.some(p=>p.name===name&&p.library===library);
  // Prefer the richer preset (e.g. an ice overlay) and fall back to a core one when an install lacks it.
  const candidates=catalogFxDesign(recipe,entry,options).map(({fxFallbackPreset,...stage})=>stage.kind==='tokenfx'&&fxFallbackPreset&&!has(stage.fxPreset,stage.fxLibrary)&&has(fxFallbackPreset,stage.fxLibrary)
    ?{...stage,fxPreset:fxFallbackPreset,label:`Tokenshade · ${fxFallbackPreset}`}:stage).filter(stage=>stage.kind==='tokenfx'
    ? catalog.tokenReady&&catalog.presets.some(p=>p.name===stage.fxPreset&&p.library===stage.fxLibrary)
    : catalog.sceneReady&&catalog.effects.some(e=>e.type===stage.fxType&&e.category===stage.fxCategory));
  const additions=candidates.filter(stage=>!recipe.stages.some(s=>s.stageId===stage.stageId));
  if (!additions.length)return recipe;
  return validateRecipe({...recipe,stages:[...recipe.stages,...additions].slice(0,MAX_STAGES)});
}
