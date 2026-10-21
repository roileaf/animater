// A weapon's blow sounds like what it lands on: bare skin, leather or cloth, metal armour, a raised shield,
// a spider's chitin, a skeleton's bones or a treant's bark, a golem's stone, glass or crystal, an ooze,
// a magical shield or armour (a wizard's Shield, Mystic Armor, Mage Armor).
// Each target of a Strike gets its own, chosen as it plays. Animater's bundled CC0 recordings always play;
// GGG's add variety when that pack is installed. Every system reads its targets through describeTarget.
import {SURFACE_SOUND_PROFILES} from '../../../data/surface-sounds.mjs';
import {MAX_STAGES,SURFACES} from '../../core/model.mjs';
import {automaticCueVolume} from './spell-sounds.mjs';
export {SURFACE_SOUND_PROFILES};
// The kind of blow, from the weapon's damage: an edge, a weight, a point. Bombs and pure energy have none.
const BLOWS={slashing:'blade',bludgeoning:'blunt',piercing:'pierce'};
export const blowOfDamage=type=>BLOWS[String(type??'').toLowerCase()]??null;
export const blowOf=mode=>mode?.payload?null:blowOfDamage(mode?.damage);
// A few recordings per surface, so blow after blow is not the same sound.
const VARIANTS=6;
export function addSurfaceSounds(item,stages,{sounds,soundVolume=.35,mode,blow=blowOf(mode),anchor}={}){
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
// Where a built weapon recipe's blow lands: its contact (melee), else its arrival (ranged), else its hit.
export const surfaceAnchor=stages=>['contact','accent','hit'].map(end=>stages.find(s=>s.kind==='impact'&&new RegExp(`(^|-)${end}$`).test(s.stageId??''))).find(Boolean)??null;
// A catalog weapon recipe from any system gains a surface cue, when its sounds are on (it has sound cues).
export function withSurfaceSounds(recipe,{blow,sounds,soundVolume=.35}={}){
 if(!recipe?.stages?.length||!blow||recipe.stages.some(s=>s.surfaces)||!recipe.stages.some(s=>s.kind==='sound'))return recipe;
 const anchor=surfaceAnchor(recipe.stages);
 return anchor?{...recipe,stages:addSurfaceSounds(recipe,recipe.stages,{sounds,soundVolume,blow,anchor})}:recipe;
}
// The weapon an attack is made with, as a kind of blow, in any system.
export function blowOfItem(item,{family}={}){
 const s=item?.system??{};
 const types=[s.damage?.damageType,...Array.from(s.damage?.base?.types??[]),...Object.values(s.damageRolls??{}).map(r=>r?.damageType),
  ...Array.from(s.attack?.damage?.parts??[]).flatMap(p=>Array.from(p?.type??p?.types??[]))];
 return types.map(blowOfDamage).find(Boolean)??(family?blowOfDamage({blade:'slashing',bow:'piercing',spear:'piercing',firearm:'piercing',hammer:'bludgeoning',shield:'bludgeoning'}[family]):null);
}

// Animated objects sound like what they were made of.
const METAL_OBJECT=/\b(armou?r|iron|steel|bronze|brass|copper|adamantine|mithral|silverware|blades?|swords?|cauldron|gears?|mechanical|widget|cannon|boiler|engine|automaton|capstan)\b/i;
const WOODEN_OBJECT=/\b(wood(en)?|broom|wardrobe|chairs?|table|door|shel(f|ves)|cart|barrel|puppet|dolls?|scarecrow|marionette|toys?|mannequin|cabinet|bamboo|figurine|wicker|straw)\b/i;
const BONE_OBJECT=/\b(bones?|femur|ribcage|skulls?|jaws|phalang\w*|skelet\w*|ossuary)\b/i;
// Golems of flesh and stitched bodies, and soft things (dust, cloth) give like flesh.
const SOFT_OBJECT=/\b(flesh|meat|corpse|carrion|taxidermy|stitch\w*|dust|cloth|rags?|quilt|tapestry|rope|pillow)\b/i;
// Living flame and wind: a blade passes through. A salamander or a fire giant is solid.
const FORMLESS=/\b(elemental|wisps?|bonfire|blaze|ember|inferno|flames?|fire|wildfire|hellfire|firewyrm|smoke|whirlwind|squall|breeze|gust|zephyr|vortex|cloud|wind|storm|tempest|lightning|phade)\b/i;
// Shelled and many-legged creatures: their bodies crack rather than give.
const SHELLED=/\b(spiders?|scorpions?|centipedes?|millipedes?|beetles?|ants?|wasps?|hornets?|crabs?|insects?|mantis(es)?|ticks?|mosquitoe?s?|roach(es)?|cockroach(es)?|locusts?|bees?|scarabs?|isopods?|lobsters?|crayfish|ankhrav|giant tick|ankheg|chuul|umber hulk|carrion crawler)\b/i;
// Metal armour: anything of chain or plate, and any heavy armour. Wooden, bone and ceramic armour crack and knock.
const METAL_GROUPS=new Set(['chain','plate','composite']),HARD_GROUPS=new Set(['wood','skeletal','ceramic']),SOFT_GROUPS=new Set(['leather','cloth','polymer']);
const GLASSY=/\b(glass|crystal(line)?|mirror|obsidian|ice)\b/i;
// An armour known only by name (D&D 5e, Daggerheart): what it is made of.
const ARMOR_NAMES=[[/\b(chain|ring|scale|splint|plate|breastplate|mail|brigandine|lamellar|cuirass|harness)\b/i,'chain'],[/\b(bone|chitin)\b/i,'skeletal'],[/\b(wood|bark)/i,'wood'],[/\b(hide|leather|studded|fur)/i,'leather'],[/\b(padded|gambeson|cloth|robe|quilted|silk)\b/i,'cloth']];
const armorGroupOf=name=>ARMOR_NAMES.find(([re])=>re.test(name??''))?.[1]??null;
// D&D 5e has creature types rather than traits, and its ghosts and elementals are told apart by name.
const DND_INCORPOREAL=/\b(ghosts?|specters?|spectres?|wraiths?|shadows?|poltergeists?|banshees?|will-o['’]?-wisps?|allips?)\b/i;
function dndTraits(actor){
 const type=actor.system?.details?.type??{},name=actor.name??'',out=[type.value,type.custom,...String(type.subtype??'').split(/[,\s]+/)].filter(Boolean).map(t=>String(t).toLowerCase());
 if(out.includes('elemental'))for(const [t,re] of [['fire',/fire|flame|magma|azer|salamander/i],['air',/air|wind|storm|invisible stalker/i],['water',/water/i],['earth',/earth|stone|galeb|xorn/i]])if(re.test(name))out.push(t);
 if(DND_INCORPOREAL.test(name))out.push('incorporeal');
 if(/\bskelet/i.test(name))out.push('skeleton');
 return out;
}

// Any system's creature, as what a blow can meet: its kind (traits), its armour, a raised shield, its magic.
export function describeTarget(actor){
 if(!actor)return null;
 const s=actor.system??{},items=Array.from(actor.items??[]);
 const effects=[...(actor.itemTypes?.effect??items.filter(i=>i?.type==='effect')),...Array.from(actor.appliedEffects??actor.effects??[])].filter(e=>!e.disabled);
 const pf=Array.isArray(s.traits?.value);
 let armor=null,raised=false;
 if(pf){
  // A creature's stat block lists its armour without equipping it (its AC is fixed): any armour it carries counts.
  const body=(actor.itemTypes?.armor??[]).filter(a=>(a.category??a.system?.category)!=='shield');
  const a=actor.wornArmor??body.find(x=>x.isEquipped??x.system?.equipped?.inSlot)??(actor.type==='npc'?body[0]:null);
  // Padded armour, clothes and aprons carry no armour group: soft, like leather.
  if(a)armor={group:a.group??a.system?.group??(((a.category??a.system?.category)==='heavy')?null:'cloth'),category:a.category??a.system?.category};
  raised=(actor.attributes?.shield?.raised??s.attributes?.shield?.raised)===true;
 }else if(s.attributes?.ac&&'equippedArmor' in s.attributes.ac||s.details?.type?.value!==undefined){
  // D&D 5e: the armour and shield it wears; a shield is always in the way.
  const a=s.attributes?.ac?.equippedArmor;
  if(a)armor={group:armorGroupOf(a.name),category:a.system?.type?.value};
  raised=Boolean(s.attributes?.ac?.equippedShield);
 }else{
  // Daggerheart (and others): the armour it has equipped, known by name.
  const a=items.find(i=>i?.type==='armor'&&(i.system?.equipped??true));
  if(a)armor={group:armorGroupOf(a.name),category:null};
 }
 return {name:actor.name??'',traits:new Set(pf?s.traits.value:dndTraits(actor)),armor,raised,
  slugs:effects.map(e=>e.slug??e.system?.slug).filter(Boolean),names:effects.map(e=>e.name??'').filter(Boolean),mageArmor:s.attributes?.ac?.calc==='mage'};
}
// What a blow that connects lands on. Null: nothing to hear (a ghost, an illusion, living flame or wind).
export function bodySurface(actor){
 const t=describeTarget(actor);
 if(!t)return 'flesh';
 const {traits,armor,name}=t;
 if(traits.has('incorporeal')||traits.has('illusion')||traits.has('elemental')&&(traits.has('fire')||traits.has('air'))&&FORMLESS.test(name))return null;
 if(armor&&(METAL_GROUPS.has(armor.group)||armor.category==='heavy'))return 'metal';
 if(armor&&HARD_GROUPS.has(armor.group))return 'crunch';
 if(armor&&SOFT_GROUPS.has(armor.group))return 'leather';
 if(traits.has('ooze')||traits.has('elemental')&&traits.has('water')&&!traits.has('dragon'))return 'squish';
 if(traits.has('skeleton')||traits.has('plant')||traits.has('fungus')||traits.has('wood'))return 'crunch';
 if(traits.has('metal')||traits.has('clockwork')||traits.has('robot'))return 'metal';
 if(traits.has('construct'))return SOFT_OBJECT.test(name)?'flesh':GLASSY.test(name)?'glass':BONE_OBJECT.test(name)||WOODEN_OBJECT.test(name)?'crunch':METAL_OBJECT.test(name)?'metal':'stone';
 if(traits.has('earth')&&traits.has('elemental'))return GLASSY.test(name)?'glass':'stone';
 if(SHELLED.test(name))return 'crunch';
 return 'flesh';
}
// Magical protection, read from the creature's active spell effects (PF2e slugs; D&D 5e and others by name).
// A magical shield turns a miss into a ward's ring; magical armour is what a blow meets on an otherwise bare
// body. Some are made of something.
const MAGIC_SHIELD=/^spell-effect-(shield|shield-amped|glass-shield|prismatic-shield|dancing-shield|fire-shield|energy-aegis|shields-of-the-spirit.*|shielding-formation|protectors-sphere)$/;
const MAGIC_ARMOR=/^spell-effect-(mystic-armor|instant-armor|prismatic-armor|chromatic-armor|protection|protective-wards|sparkleskin|spirit-ward|blood-ward|forbidding-ward|death-ward|phoenix-ward|flame-barrier|unbreaking-wave-barrier|armor-of-bones|untwisting-iron-.*|stoneskin|barkskin)$/;
const SHIELD_NAMES=/^(shield|shield of faith|warding bond)$/i,ARMOR_EFFECT_NAMES=/^(mage armou?r|barkskin|stoneskin|armou?r of agathys|protection from evil and good)$/i;
const MADE_OF=[[/glass-shield/,'glass'],[/armor-of-bones|barkskin/i,'crunch'],[/untwisting-iron/,'metal'],[/stoneskin/i,'stone']];
const madeOf=key=>MADE_OF.find(([re])=>re.test(key))?.[1]??'ward';
const HIT=new Set(['success','criticalSuccess']),MISS=new Set(['failure','criticalFailure']);
// A hit sounds on the body, or the magical armour over a bare one; a miss against a raised shield is blocked
// by it, against a magical shield rings off the ward; any other miss is silent.
export function targetSurface(actor,outcome){
 const t=describeTarget(actor);
 if(HIT.has(outcome)){
  const body=bodySurface(actor),armor=t?.slugs.find(s=>MAGIC_ARMOR.test(s))??t?.names.find(n=>ARMOR_EFFECT_NAMES.test(n))??(t?.mageArmor?'mage armor':null);
  return armor&&['flesh','leather'].includes(body)?madeOf(armor):body;
 }
 if(!MISS.has(outcome)||!t)return null;
 if(t.raised)return 'shield';
 const shield=t.slugs.find(s=>MAGIC_SHIELD.test(s))??t.names.find(n=>SHIELD_NAMES.test(n));
 return shield?madeOf(shield):null;
}
