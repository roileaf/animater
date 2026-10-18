import {ABILITY_SOUND_PROFILES,FEAT_SOUND_DESIGNS,WEAPON_SOUND_DESIGNS} from '../../../data/ability-sounds.mjs';
import {SOUND_PROFILES} from '../../../data/spell-sounds.mjs';
import {MAX_STAGES} from '../../core/model.mjs';
import {repeatStride} from '../../core/stage-options.mjs';
import {timedStages} from '../playback/composition.mjs';
import {automaticCueVolume,soundGain} from './spell-sounds.mjs';
export {ABILITY_SOUND_PROFILES,FEAT_SOUND_DESIGNS,WEAPON_SOUND_DESIGNS};
const profiles={...SOUND_PROFILES,...ABILITY_SOUND_PROFILES};
const seed=text=>[...text].reduce((h,c)=>(Math.imul(h,31)+c.charCodeAt(0))>>>0,0);
export const abilitySoundInfo=(item,mode)=>mode?WEAPON_SOUND_DESIGNS[`${item.id}:${mode}`]:FEAT_SOUND_DESIGNS[item.id];
export function addAbilitySounds(item,stages,{soundCatalog,sounds=soundCatalog,soundVolume=.35,mode,design=abilitySoundInfo(item,mode)}={}){
 if(!sounds)return stages;
 const result=[...stages];
 for(const [cueIndex,cue]of (profiles[design?.profile]??[]).entries()){
  if(design?.excludeRoles?.includes(cue.role))continue;
  const choices=cue.candidates.map(c=>({original:c,active:sounds.resolve?.(c)})).filter(c=>c.active);
  if(!choices.length)continue;
  const best=['ggg','psfx','soundfxlibrary','pf2e-creature-sounds'].find(m=>choices.some(c=>c.active.module===m));
  const variants=choices.filter(c=>c.active.module===best),variantSeed=seed(item.slug+':'+(mode??'')+':'+cueIndex);
  let anchors;
  if(cue.role==='release')anchors=stages.filter(s=>['travel','projectile'].includes(s.kind)&&!s.label?.includes('Return'));
  else if(cue.role==='reload')anchors=stages.filter(s=>/reload|chamber/i.test(s.label));
  else if(cue.role==='impact'||cue.role==='contact'){
   // A rune's elemental finish is not another physical Strike. Weapon builders
   // give the actual blow a stable contact ID; feat builders retain all authored
   // physical contacts (paired attacks need one cue per blow).
   const slot=cue.anchorSlot??(cue.role==='contact'?'contact':'accent');
   anchors=stages.filter(s=>mode==='area'?s.kind==='template':s.kind==='impact'&&(!mode||s.stageId?.endsWith('-'+slot)));
   if(!mode&&cue.anchorSlot)anchors=anchors.filter(s=>s.stageId?.endsWith('-'+cue.anchorSlot));
  }
  else if(cue.role==='cast')anchors=stages.filter(s=>s.kind==='cast');
  else anchors=stages.filter(s=>['impact','aura','template'].includes(s.kind));
  if(!anchors.length&&['release','reload','contact','impact'].includes(cue.role))continue;
  anchors=anchors.length?anchors:[stages.find(s=>s.kind!=='motion')??stages[0]];
  if(cue.role!=='contact')anchors=anchors.slice(0,1);
  const timing=anchors.length>1?timedStages({stages}):null;
  for(const [anchorIndex,anchor]of anchors.entries()){
   if(result.length>=MAX_STAGES)break;
   // Paired blows rotate actual recordings. Long reverb tails must not turn a
   // quick combination into several simultaneous full-volume contacts.
   const chosen=variants[(variantSeed+anchorIndex)%variants.length];
   const stride=(anchor.repeats??1)>1?repeatStride(anchor):0;
   const current=timing?.find(s=>s.stageId===anchor.stageId)?.delay;
   const next=timing?.filter(s=>anchors.some(a=>a.stageId===s.stageId)&&s.delay>current).sort((a,b)=>a.delay-b.delay)[0];
   const cadence=Math.min(stride||Infinity,next?next.delay-current:Infinity);
   const duration=Math.min(chosen.active.duration,Number.isFinite(cadence)?Math.max(100,cadence*.9):Infinity);
   result.push({kind:'sound',stageId:`audio-${item.id}-${mode??'feat'}-${cueIndex}-${anchorIndex}`,label:cue.label+(anchors.length>1?` ${anchorIndex+1}`:''),assets:[],duration,delay:anchor.delay,
    afterStage:anchor.stageId,timingAnchor:'start',startOffset:0,subject:'source',requiresHit:anchor.requiresHit===true,volume:automaticCueVolume(soundVolume,chosen.active),soundFile:chosen.active.file,fadeIn:10,fadeOut:Math.min(90,duration*.2),
    repeats:anchor.repeats??1,repeatInterval:(anchor.repeats??1)>1?repeatStride(anchor):0,repeatScope:anchor.repeatScope??'perTarget',
    optionalSound:{profile:design.profile,cue:cueIndex,gain:soundGain(chosen.active),candidates:[chosen.original,...cue.candidates.filter(c=>c!==chosen.original)]}});
  }
 }
 return result;
}
