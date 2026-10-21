// Defeated look: how a token marked Defeated (CONFIG.specialStatusEffects.DEFEATED, normally
// "dead") is drawn. Foundry's default lays the status icon over the whole token as an overlay
// (v14 stores that as flags.core.overlay on the ActiveEffect); the combat tracker, PF2e and
// Animater's own finisher body ending all ask for it. "Small icon" clears that flag whenever the
// status is created or turned into an overlay, from any source. "Animater effect" does the same
// and adds a lasting animation through the persistent state layers while the status lasts.
import {validateRecipe} from '../../core/model.mjs';

export const DEFEATED_LOOK='defeatedLook';
export const DEFEATED_LOOK_CHOICES=Object.freeze({overlay:'Foundry default (skull over the whole token)',icon:'Small icon',effect:'Animater effect'});
export const normalizeDefeatedLook=value=>Object.hasOwn(DEFEATED_LOOK_CHOICES,value)?value:'overlay';
export const defeatedStatusId=(config=globalThis.CONFIG)=>config?.specialStatusEffects?.DEFEATED??'dead';

export function registerDefeatedLook(settings,id,{onChange}={}){
 settings.register(id,DEFEATED_LOOK,{name:'Defeated look',
  hint:'How a Defeated token is drawn (combat tracker, system or finisher). Small icon: a normal status icon instead of the skull over the whole token. Animater effect: the small icon, faint skull smoke and a greyed token while it stays Defeated. Applies to tokens defeated from now on; existing Defeated effects keep their look.',
  scope:'world',config:true,type:String,choices:{...DEFEATED_LOOK_CHOICES},default:'overlay',onChange});
}

const hasStatus=(effect,statusId)=>{const s=effect?.statuses;return !!s&&(typeof s.has==='function'?s.has(statusId):Array.from(s).includes(statusId));};
const iconOnly=mode=>normalizeDefeatedLook(mode)!=='overlay';

// The options Animater's finisher body ending marks Defeated with.
export const defeatedStatusOptions=mode=>({active:true,overlay:!iconOnly(mode)});
export async function markDefeated(actor,mode,config=globalThis.CONFIG){
 return actor?.toggleStatusEffect?.(defeatedStatusId(config),defeatedStatusOptions(mode));
}

// Clears the overlay flag on the defeated status as it is created or updated. Existing effects
// are never rewritten: a change of setting applies from then on.
// statuses: the ids that count as defeated (a system with its own defeated set, as Daggerheart).
export function installDefeatedLook(hooks,{mode,config=()=>globalThis.CONFIG,statuses=()=>[defeatedStatusId(config())]}){
 const applies=(effect,data)=>iconOnly(mode())&&statuses().some(id=>hasStatus(effect,id)||hasStatus(data,id));
 hooks.on('preCreateActiveEffect',(effect,data)=>{
  if(!applies(effect,data))return;
  if(effect?.flags?.core?.overlay===true||data?.flags?.core?.overlay===true||data?.['flags.core.overlay']===true)effect.updateSource({'flags.core.overlay':false});
 });
 hooks.on('preUpdateActiveEffect',(effect,changes)=>{
  if(!applies(effect,changes))return;
  if(changes?.['flags.core.overlay']===true)changes['flags.core.overlay']=false;
  if(changes?.flags?.core?.overlay===true)changes.flags.core.overlay=false;
 });
}

// The lasting look: faint grey skull smoke over the token, and the body drained of colour
// (condition-body's 'stone' treatment: animater's local desaturation filter, or a grey tint).
export const DEFEATED_RECIPE=validateRecipe({id:'animater-defeated',name:'Defeated',trigger:'effect',lifecycle:'document',color:'#9aa0a6',
 description:'Faint skull smoke over a greyed body while the token stays Defeated.',
 stages:[{stageId:'defeated-smoke',label:'Skull smoke',kind:'aura',subject:'source',persist:true,
  assets:['jb2a.toll_the_dead.grey.skull_smoke','jb2a.smoke.puff.centered.grey'],
  duration:6000,fadeIn:800,fadeOut:800,scale:0.9,opacity:0.35,bindAlpha:true,bindRotation:false}]});

// Is this creature Defeated (dead), whatever its look? Its other lasting animations stop while it is.
export function isDefeated(actor,statusIds){
 return statusIds.some(statusId=>Array.from(actor?.effects??[]).some(e=>hasStatus(e,statusId)&&!e.disabled&&e.active!==false));
}
// The defeated status as a lasting state the persistent layers can show, in effect mode only.
export function defeatedStates(actor,{mode,statusId}){
 if(normalizeDefeatedLook(mode)!=='effect')return [];
 const effect=Array.from(actor?.effects??[]).find(e=>hasStatus(e,statusId)&&!e.disabled&&e.active!==false);
 if(!effect)return [];
 return [{id:`defeated-${effect.id}`,uuid:effect.uuid,type:'effect',name:DEFEATED_RECIPE.name,document:effect,actor,
  animaterRecipe:DEFEATED_RECIPE,animaterBody:'stone'}];
}
