// A weapon's blow sounds like what it lands on: bare skin, leather or cloth, metal armour, a raised shield,
// a spider's chitin, a skeleton's bones or a treant's bark, a golem's stone, glass or crystal, an ooze,
// a magical shield or armour (a wizard's Shield, Mystic Armor).
// Each target of a Strike gets its own, chosen as it plays. Animater's bundled CC0 recordings always play;
// GGG's add variety when that pack is installed.
import {SURFACE_SOUND_PROFILES} from '../../../data/surface-sounds.mjs';
import {MAX_STAGES,SURFACES} from '../../core/model.mjs';
import {automaticCueVolume} from './spell-sounds.mjs';
export {SURFACE_SOUND_PROFILES};
// The kind of blow, from the weapon's damage: an edge, a weight, a point. Bombs and pure energy have none.
export const blowOf=mode=>mode?.payload?null:{slashing:'blade',bludgeoning:'blunt',piercing:'pierce'}[mode?.damage]??null;
// A few recordings per surface, so blow after blow is not the same sound.
const VARIANTS=6;
export function addSurfaceSounds(item,stages,{sounds,soundVolume=.35,mode,anchor}={}){
 const blow=blowOf(mode);
 if(!sounds||!blow||!anchor||stages.length>=MAX_STAGES)return stages;
 const surfaces={};
 for(const surface of SURFACES){
  const cue=SURFACE_SOUND_PROFILES[`surface-${blow}-${surface}`]?.[0];
  const active=(cue?.candidates??[]).map(c=>c.module==='animater'?c:sounds.resolve?.(c)).filter(Boolean).slice(0,VARIANTS);
  // A little under the weapon's own impact cue: the surface colours the blow, it does not replace it.
  if(active.length)surfaces[surface]=active.map(a=>({file:a.file,volume:automaticCueVolume(soundVolume,a)*.85,duration:Math.min(a.duration,1500)}));
 }
 if(!surfaces.flesh)return stages;
 const first=surfaces.flesh[0];
 return [...stages,{kind:'sound',stageId:`${anchor.stageId}-surface`,label:'What the blow lands on',assets:[],subject:'targets',targetSelection:anchor.targetSelection??'first',
  delay:anchor.delay,afterStage:anchor.stageId,timingAnchor:'start',startOffset:0,duration:first.duration,volume:first.volume,soundFile:first.file,fadeIn:10,fadeOut:Math.min(90,first.duration*.2),
  repeats:anchor.repeats??1,surfaces}];
}
// Animated objects sound like what they were made of.
const METAL_OBJECT=/\b(armou?r|iron|steel|bronze|brass|copper|adamantine|mithral|silverware|blades?|swords?|cauldron|gears?|mechanical|widget|cannon|boiler|engine|automaton|capstan)\b/i;
const WOODEN_OBJECT=/\b(wood(en)?|broom|wardrobe|chairs?|table|door|shel(f|ves)|cart|barrel|puppet|dolls?|scarecrow|marionette|toys?|mannequin|cabinet|bamboo|figurine|wicker|straw)\b/i;
const BONE_OBJECT=/\b(bones?|femur|ribcage|skulls?|jaws|phalang\w*|skelet\w*|ossuary)\b/i;
// Golems of flesh and stitched bodies, and soft things (dust, cloth) give like flesh.
const SOFT_OBJECT=/\b(flesh|meat|corpse|carrion|taxidermy|stitch\w*|dust|cloth|rags?|quilt|tapestry|rope|pillow)\b/i;
// Living flame and wind: a blade passes through. A salamander or a fire giant is solid.
const FORMLESS=/\b(elemental|wisps?|bonfire|blaze|ember|inferno|flames?|fire|smoke|whirlwind|squall|breeze|gust|zephyr|vortex|cloud|wind)\b/i;
// Shelled and many-legged creatures: their bodies crack rather than give.
const SHELLED=/\b(spiders?|scorpions?|centipedes?|millipedes?|beetles?|ants?|wasps?|hornets?|crabs?|insects?|mantis(es)?|ticks?|mosquitoe?s?|roach(es)?|cockroach(es)?|locusts?|bees?|scarabs?|isopods?|lobsters?|crayfish|ankhrav|giant tick)\b/i;
// Metal armour: anything of chain or plate, and any heavy armour. Wooden, bone and ceramic armour crack and knock.
const METAL_GROUPS=new Set(['chain','plate','composite']),HARD_GROUPS=new Set(['wood','skeletal','ceramic']),SOFT_GROUPS=new Set(['leather','cloth','polymer']);
const GLASSY=/\b(glass|crystal(line)?|mirror|obsidian|ice)\b/i;
// A creature's stat block lists its armour without equipping it (its AC is fixed): any armour it carries counts.
function wornArmor(actor){
 const body=(actor.itemTypes?.armor??[]).filter(a=>(a.category??a.system?.category)!=='shield');
 const armor=actor.wornArmor??body.find(a=>a.isEquipped??a.system?.equipped?.inSlot)??(actor.type==='npc'?body[0]:null);
 return armor?{group:armor.group??armor.system?.group,category:armor.category??armor.system?.category}:null;
}
// What a blow that connects lands on. Null: nothing to hear (a ghost, living flame or wind).
export function bodySurface(actor){
 if(!actor)return 'flesh';
 const traits=new Set(actor.system?.traits?.value??actor.traits??[]),armor=wornArmor(actor);
 if(traits.has('incorporeal')||traits.has('elemental')&&(traits.has('fire')||traits.has('air'))&&FORMLESS.test(actor.name??''))return null;
 if(armor&&(METAL_GROUPS.has(armor.group)||armor.category==='heavy'))return 'metal';
 if(armor&&HARD_GROUPS.has(armor.group))return 'crunch';
 if(armor&&SOFT_GROUPS.has(armor.group))return 'leather';
 if(traits.has('ooze')||traits.has('elemental')&&traits.has('water')&&!traits.has('dragon'))return 'squish';
 if(traits.has('skeleton')||traits.has('plant')||traits.has('fungus')||traits.has('wood'))return 'crunch';
 if(traits.has('metal')||traits.has('clockwork'))return 'metal';
 if(traits.has('construct')){const name=actor.name??'';return SOFT_OBJECT.test(name)?'flesh':GLASSY.test(name)?'glass':BONE_OBJECT.test(name)||WOODEN_OBJECT.test(name)?'crunch':METAL_OBJECT.test(name)?'metal':'stone';}
 if(traits.has('earth')&&traits.has('elemental'))return GLASSY.test(actor.name??'')?'glass':'stone';
 if(SHELLED.test(actor.name??''))return 'crunch';
 return 'flesh';
}
// Magical protection, read from the creature's spell effects. A magical shield turns a miss into a ward's
// ring; magical armour is what a blow meets on an otherwise bare body. Some are made of something.
const MAGIC_SHIELD=/^spell-effect-(shield|shield-amped|glass-shield|prismatic-shield|dancing-shield|fire-shield|energy-aegis|shields-of-the-spirit.*|shielding-formation|protectors-sphere)$/;
const MAGIC_ARMOR=/^spell-effect-(mystic-armor|instant-armor|prismatic-armor|chromatic-armor|protection|protective-wards|sparkleskin|spirit-ward|blood-ward|forbidding-ward|death-ward|phoenix-ward|flame-barrier|unbreaking-wave-barrier|armor-of-bones|untwisting-iron-.*|stoneskin|barkskin)$/;
const MADE_OF=[[/glass-shield/,'glass'],[/armor-of-bones|barkskin/,'crunch'],[/untwisting-iron/,'metal'],[/stoneskin/,'stone']];
const effectSlugs=actor=>(actor?.itemTypes?.effect??Array.from(actor?.items??[]).filter(i=>i?.type==='effect')).map(e=>e.slug??e.system?.slug).filter(Boolean);
const madeOf=slug=>MADE_OF.find(([re])=>re.test(slug))?.[1]??'ward';
const HIT=new Set(['success','criticalSuccess']),MISS=new Set(['failure','criticalFailure']);
// A hit sounds on the body, or the magical armour over a bare one; a miss against a raised shield is blocked
// by it, against a magical shield rings off the ward; any other miss is silent.
export function targetSurface(actor,outcome){
 const slugs=effectSlugs(actor);
 if(HIT.has(outcome)){
  const body=bodySurface(actor),armor=slugs.find(s=>MAGIC_ARMOR.test(s));
  return armor&&['flesh','leather'].includes(body)?madeOf(armor):body;
 }
 if(!MISS.has(outcome))return null;
 if((actor?.attributes?.shield?.raised??actor?.system?.attributes?.shield?.raised)===true)return 'shield';
 const shield=slugs.find(s=>MAGIC_SHIELD.test(s));
 return shield?madeOf(shield):null;
}
