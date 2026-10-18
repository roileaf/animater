import { uuid } from "../../core/uuid.mjs";
import { normalizeLayers } from "../tokenshade/layers.mjs";
import { LIBRARY, libraryId } from "../tokenshade/presets.mjs";

// Preset libraries a token FX stage can name: animater's token and region presets, and
// the world's own saved presets.
export const TOKEN_FX_LIBRARIES = [LIBRARY.TOKEN, LIBRARY.REGION, LIBRARY.CUSTOM];
// Token filters are animater's own (scripts/fx); scene weather comes from FXMaster when
// installed. Never replace another module's token filters or the scene's weather.
export const OPTIONAL_FX_KINDS = new Set(['tokenfx', 'scenefx']);
const safeKey = key => /^[a-zA-Z][a-zA-Z0-9_-]{0,79}$/.test(key) && !['constructor','prototype','__proto__'].includes(key);
export function normalizeFxOptions(input) {
  const result = {};
  for (const [key, value] of Object.entries(input ?? {}).slice(0, 40)) {
    if (!safeKey(key)) continue;
    if (typeof value === 'boolean' || typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 100000)
      result[key] = value;
    else if (typeof value === 'string' && value.length <= 100) result[key] = value;
    else if (value && typeof value === 'object' && /^#[\da-f]{6}$/i.test(value.value))
      result[key] = {value:value.value, apply:value.apply === true};
  }
  return result;
}
export function normalizeFxStage(stage) {
  const metadata=stage.catalogFx===true?{catalogFx:true,fxProfile:typeof stage.fxProfile==='string'?stage.fxProfile.slice(0,50):''}:{};
  return {...metadata,...(stage.kind === 'tokenfx'
    ? {fxPreset:typeof stage.fxPreset === 'string' ? stage.fxPreset.slice(0,100).trim() : '',
       fxLibrary:TOKEN_FX_LIBRARIES.includes(libraryId(stage.fxLibrary)) ? libraryId(stage.fxLibrary) : LIBRARY.TOKEN,
       // The stage's own edited copy of the effect (every layer, setting and animation).
       ...(normalizeLayers(stage.fxLayers) ? {fxLayers:normalizeLayers(stage.fxLayers)} : {}),
       fxSpeed:Number.isFinite(Number(stage.fxSpeed))?Math.min(5,Math.max(.1,Number(stage.fxSpeed))):1,
       fxTint:/^#[\da-f]{6}$/i.test(stage.fxTint??'')?stage.fxTint:'',
       fxStrength:Number.isFinite(Number(stage.fxStrength))?Math.min(1,Math.max(.1,Number(stage.fxStrength))):1}
    : {fxCategory:stage.fxCategory === 'filter' ? 'filter' : 'particle',
       fxType:safeKey(stage.fxType ?? '') ? stage.fxType : '', fxOptions:normalizeFxOptions(stage.fxOptions)})};
}
function schemaFields(parameters, localize) {
  return Object.entries(parameters ?? {}).flatMap(([key, p]) => {
    if (!safeKey(key) || key.startsWith('soundFx') || key.startsWith('background') || key.includes('Trail')) return [];
    const label = localize(p.label ?? key);
    if (p.type === 'range' && [p.min,p.max,p.value].every(Number.isFinite))
      return [{key,label,type:'number',min:p.min,max:p.max,step:p.step ?? .1,value:p.value}];
    if (p.type === 'checkbox') return [{key,label,type:'checkbox',value:p.value === true}];
    if (p.type === 'color' && /^#[\da-f]{6}$/i.test(p.value?.value))
      return [{key,label,type:'color',value:{value:p.value.value,apply:p.value.apply === true}}];
    if (p.type === 'select' && p.options && typeof p.value === 'string')
      return [{key,label,type:'select',value:p.value,choices:Object.fromEntries(Object.entries(p.options).map(([k,v])=>[k,localize(v)]))}];
    return [];
  });
}
export function installedFxCatalog({modules, tokenFx, fxmaster, config, localize = value => value, isGM = false} = {}) {
  const tokenReady = !!(tokenFx?.getPresets && tokenFx?.apply && tokenFx.ready?.() !== false);
  const sceneReady = !!(modules?.get('fxmaster')?.active && fxmaster?.effects?.play && fxmaster?.effects?.stop);
  const presets = tokenReady ? TOKEN_FX_LIBRARIES.flatMap(library => {
    try { return (tokenFx.getPresets(library) ?? []).filter(p=>p?.name && p.params?.length && presetAssetsAvailable(p,modules)).map(p=>tokenPresetMetadata(p,library)); }
    catch { return []; }
  }) : [];
  const effects = sceneReady ? ['particle','filter'].flatMap(category =>
    Object.entries(config?.[category === 'particle' ? 'particleEffects' : 'filterEffects'] ?? {}).flatMap(([type, Effect]) => {
      if (!safeKey(type)) return [];
      try { return [{type,category,label:localize(Effect.label ?? type),fields:schemaFields(Effect.parameters,localize)}]; }
      catch { return []; }
    })) : [];
  return {tokenReady,sceneReady,isGM,presets,effects};
}
// A world's own Token Magic presets live in world settings, so one can outlive the
// module that ships its sprite images (Baileywiki '[BW]' overlays). Only offer
// presets whose image modules are active.
// Presets have no shared opacity: each filter has its own visibility settings (alpha,
// lightAlpha, glow outerStrength, aura intensity, fog density…). Strength scales every one a filter has,
// animated ones too; filters without any (outlines, distortions, colour shifts) are unchanged.
const ALPHA_KEY=/^(?:alpha|[a-z]+Alpha|alphaImg|alphaChr|strength|[a-z]+Strength|intensity|[a-z]+Intensity|density|bloomScale)$/;
export function scaleFilterStrength(param, strength = 1) {
  if (!(Number(strength) < 1)) return param;
  for (const [key, value] of Object.entries(param)) if (ALPHA_KEY.test(key) && typeof value === 'number') param[key] = value * strength;
  for (const [key, anim] of Object.entries(param.animated ?? {})) if (ALPHA_KEY.test(key) && anim && typeof anim === 'object')
    for (const end of ['val1', 'val2']) if (typeof anim[end] === 'number') anim[end] *= strength;
  return param;
}
// A private copy of a preset with the stage's tint and strength applied.
export function tintedPreset(preset, stage = {}) {
  const own=structuredClone(stage.fxLayers?.length?{...preset,name:preset?.name??'custom',params:stage.fxLayers}:preset);
  const tint=/^#[\da-f]{6}$/i.test(stage.fxTint??'')?Number.parseInt(stage.fxTint.slice(1),16):null;
  for(const param of own.params??[]) {
    if(tint!==null&&typeof param.color==='number') {param.color=tint;if(param.animated)delete param.animated.color;}
    scaleFilterStrength(param,stage.fxStrength);
  }
  return own;
}
export function presetAssetsAvailable(preset, modules) {
  return (preset.params ?? []).every(p => {
    const id = /^modules\/([^/]+)\//.exec(String(p?.imagePath ?? ''))?.[1];
    return !id || !!modules?.get?.(id)?.active;
  });
}
// Discovery exposes metadata only; shader parameters stay with the FX engine.
export function tokenPresetMetadata(preset, library = preset.library) {
  return {name:preset.name,library,
    filterTypes:[...new Set((preset.params??[]).map(p=>p.filterType).filter(type=>typeof type==='string'&&safeKey(type)))],
    tintable:(preset.params??[]).some(p=>typeof p.color==='number')};
}
// A library audition is local and owns a separate session; never use the socket
// or stop the recipe/document effects already playing on these tokens.
export function startTokenFxPreview(player, stage, {tokens, userId, session = uuid()} = {}) {
  const destinations=[...new Set((tokens??[]).filter(Boolean))];
  if(!destinations.length)throw Error(stage.subject==='targets'?'Target a token first.':'Select a token first.');
  const duration=Math.min(30000,Math.max(500,Number(stage.duration)||3000));
  const filter={...normalizeFxStage({...stage,kind:'tokenfx'}),kind:'tokenfx',duration};
  const stop=()=>player.stop({session,userId});
  const jobs=destinations.map(destination=>player.play({...filter,destination},{session,userId,preview:true}));
  const done=Promise.all(jobs).catch(async error=>{await stop();await Promise.allSettled(jobs);throw error;});
  return {done,stop};
}
export function fxAvailability(stage, catalog, {preview = false} = {}) {
  if (stage.kind === 'tokenfx') {
    if (!catalog?.tokenReady) return 'Tokenshade unavailable';
    if (!stage.fxLayers?.length && !catalog.presets.some(p=>p.name===stage.fxPreset && p.library===libraryId(stage.fxLibrary ?? LIBRARY.TOKEN))) return 'Choose a Tokenshade preset';
  } else if (stage.kind === 'scenefx') {
    if (!catalog?.sceneReady) return 'FXMaster unavailable';
    if (!catalog.effects.some(e=>e.type===stage.fxType && e.category===(stage.fxCategory ?? 'particle'))) return 'Choose an FXMaster effect';
    // A private preview draws particles on this client only; scene filters cannot be local.
    if (preview) return (stage.fxCategory ?? 'particle') === 'particle' ? '' : 'FXMaster filters skipped in private preview';
    if (!catalog.isGM) return 'FXMaster requires GM playback';
  }
  return '';
}
export function effectOptions(stage, effect) {
  const values = normalizeFxOptions(stage.fxOptions);
  const result = {soundFxEnabled:false,backgroundEnabled:false,backgroundTrailsEnabled:false};
  for (const field of effect.fields) {
    let value = values[field.key] ?? field.value;
    if (field.type === 'number') value = Number.isFinite(Number(value)) ? Math.min(field.max,Math.max(field.min,Number(value))) : field.value;
    if (field.type === 'checkbox') value = value === true;
    if (field.type === 'select' && !Object.hasOwn(field.choices,value)) value = field.value;
    if (field.type === 'color') value = value && /^#[\da-f]{6}$/i.test(value.value) ? {value:value.value,apply:value.apply === true} : field.value;
    result[field.key] = value;
  }
  return result;
}
export class OptionalFxPlayer {
  constructor(host) { this.host=host; this.active=new Set(); }
  async addTokenFilter(stage) {
    const api=this.host.tokenFx();
    const preset=api.getPresets(libraryId(stage.fxLibrary??LIBRARY.TOKEN)).find(p=>p.name===stage.fxPreset);
    const placeable=(stage.destination?.document??stage.destination)?.object;
    if(!(preset?.params?.length||stage.fxLayers?.length)||!placeable)return ()=>{};
    return api.apply(placeable,tintedPreset(preset??{name:stage.fxPreset},stage),{speed:stage.fxSpeed??1});
  }
  async retain(stage,{session,userId}={}) {
    if(stage.kind!=='tokenfx')throw Error('Only token filters can last while a condition or effect is on the token.');
    const unavailable=fxAvailability(stage,this.host.catalog());
    if(unavailable){this.host.trace?.('Skipped',unavailable);return ()=>{};}
    const entry={session,userId,cancelled:false};
    entry.done=new Promise(resolve=>{entry.finish=resolve;});this.active.add(entry);
    const finish=()=>entry.finishing??=(async()=>{
      try { await entry.remove?.(); }
      finally {this.active.delete(entry);entry.finish();}
    })();
    try {
      entry.remove=await this.addTokenFilter(stage);
      entry.resolve=()=>void finish().catch(error=>this.host.trace?.('Blocked',error.message));
      if(entry.cancelled)await finish();
      return async()=>{entry.cancelled=true;await finish();};
    } catch(error) {await finish();throw error;}
  }
  async play(stage, {session, userId, preview = false, template = null} = {}) {
    const catalog=this.host.catalog();
    const unavailable=fxAvailability(stage,catalog,{preview});
    if(unavailable){this.host.trace?.('Skipped',unavailable);return;}
    const entry={session,userId,cancelled:false};
    entry.done=new Promise(resolve=>{entry.finish=resolve;});
    this.active.add(entry);
    let remove;
    try {
      if(stage.kind==='tokenfx') {
        remove=await this.addTokenFilter(stage);
      } else if(preview) {
        // Local preview: the particles run on this canvas only; the scene is untouched.
        const effect=catalog.effects.find(e=>e.category===(stage.fxCategory??'particle') && e.type===stage.fxType);
        remove=this.host.localParticles?.(stage,effect,template)??null;
        if(!remove){this.host.trace?.('Skipped','FXMaster particles unavailable for local preview');}
      } else {
        // A placed template keeps the effect inside it: a temporary FXMaster behavior
        // on the template's Region, gone when the stage ends or the template is removed.
        // Without a placed Region (a private sample area) the effect covers the scene.
        const effect=catalog.effects.find(e=>e.category===(stage.fxCategory??'particle') && e.type===stage.fxType);
        if(template)remove=await this.host.regionFx?.(stage,effect,template)??null;
      }
      if(stage.kind==='scenefx' && !preview && !remove) {
        const api=this.host.fxmaster().effects;
        const scene=this.host.scene();
        const effect=catalog.effects.find(e=>e.category===stage.fxCategory && e.type===stage.fxType);
        const expires=Date.now()+stage.duration+15000;
        const id=`apiMacro_animater_${expires}_${uuid().replaceAll('-','')}_${stage.fxCategory==='particle'?'p':'f'}`;
        const ids={particles:stage.fxCategory==='particle'?[id]:[],filters:stage.fxCategory==='filter'?[id]:[]};
        // Install cleanup before awaiting Scene updates, including partial failure.
        remove=()=>api.stop({...ids,scene,skipFading:true});
        await api.play({effects:[{id,kind:stage.fxCategory,type:stage.fxType,options:effectOptions(stage,effect)}],scene,skipFading:true});
      }
      if(!entry.cancelled) await new Promise(resolve=>{
        entry.resolve=resolve;
        entry.timer=setTimeout(resolve,stage.duration);
      });
    } finally {
      clearTimeout(entry.timer);
      try { if(remove)await remove(); }
      finally { this.active.delete(entry); entry.finish(); }
    }
  }
  stop({userId,session} = {}) {
    const waiting=[];
    for(const entry of this.active) {
      if(userId && entry.userId!==userId || session && entry.session!==session)continue;
      entry.cancelled=true;
      clearTimeout(entry.timer);
      entry.resolve?.();
      // Pending providers finish cleanup immediately after their add settles.
      if(entry.resolve)waiting.push(entry.done);
    }
    return Promise.allSettled(waiting);
  }
  async pruneExpired() {
    const catalog=this.host.catalog();
    if(!catalog.sceneReady || !catalog.isGM) return;
    const scene=this.host.scene();
    if(!scene)return;
    const expired=key=>/^apiMacro_animater_(\d+)_/.exec(key)?.[1] < Date.now();
    const particles=Object.keys(scene.getFlag('fxmaster','effects') ?? {}).filter(expired);
    const filters=Object.keys(scene.getFlag('fxmaster','filters') ?? {}).filter(expired);
    if(particles.length || filters.length)await this.host.fxmaster().effects.stop({particles,filters,scene,skipFading:true});
  }
}
