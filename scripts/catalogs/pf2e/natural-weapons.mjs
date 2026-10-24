import {catalogDataNeeded} from '../shared/catalog-data.mjs';
// Creature attacks (an NPC's Jaws, an ancestry Claw) the equipment catalog has no weapon for.
// These names play as they are; an NPC Strike's longer name plays its last such word
// ("Spiked Tail" a tail, "Storm-Beak Jab" a beak).
import {normalize} from '../../core/model.mjs';
const {PF2E_WEAPONS: EQUIPMENT} = catalogDataNeeded('pf2e') ? await import('../../../data/pf2e-weapons.mjs') : {PF2E_WEAPONS: []};

const FAMILIES={
 bite:{names:['Jaws','Bite','Fangs','Beak','Mandibles','Teeth','Maw','Peck','Proboscis'],damage:'piercing',sound:'naturalPierce',scale:.9,label:'Bite',
  film:c=>[`jb2a.bite.400px.${c}`,`jb2a.bite.200px.${c}`],free:'jb2a.bite.400px.red',
  colors:{physical:'red',fire:'orange',cold:'blue',sonic:'blue',electricity:'yellow',acid:'green',poison:'green',void:'purple',negative:'purple',unholy:'purple',mental:'purple',force:'purple',vitality:'yellow',positive:'yellow',holy:'yellow',spirit:'yellow',bleed:'red'}},
 claw:{names:['Claw','Talon','Rake','Pincer','Scratch','Slash','Nail'],damage:'slashing',sound:'claw',scale:1,label:'Claw rake',
  film:c=>[`jb2a.claws.400px.${c}`,`jb2a.claws.200px.${c}`],free:'jb2a.claws.400px.red',
  colors:{physical:'red',fire:'bright_orange',cold:'bright_blue',sonic:'bright_blue',electricity:'bright_yellow',acid:'bright_green',poison:'bright_green',void:'bright_purple',negative:'bright_purple',unholy:'bright_purple',mental:'bright_purple',force:'bright_purple',vitality:'bright_yellow',positive:'bright_yellow',holy:'bright_yellow',spirit:'bright_yellow',bleed:'dark_red'}},
 blow:{names:['Tail','Tentacle','Horn','Slam','Hoof','Wing','Stinger','Foot','Hand','Arm','Leg','Limb','Trunk','Branch','Root','Vine','Leaf','Tendril','Tongue','Pseudopod','Antler','Tusk','Ram','Headbutt','Gore','Kick','Stomp','Punch','Backhand','Knuckle','Paddle','Flipper','Fin','Shell','Wave','Lash'],damage:'bludgeoning',sound:'unarmed',scale:1.1,label:'Natural blow',
  film:c=>[`jb2a.unarmed_strike.physical.02.${c}`,`jb2a.unarmed_strike.physical.01.${c}`],free:'jb2a.unarmed_strike.physical.02.blue',
  colors:{physical:'orange',fire:'orange',cold:'blue',sonic:'blue',electricity:'yellow',acid:'green',poison:'green',void:'dark_purple',negative:'dark_purple',unholy:'dark_purple',mental:'pinkpurple',force:'pinkpurple',vitality:'yellow',positive:'yellow',holy:'yellow',spirit:'yellow',bleed:'dark_red'}},
};
const PHYSICAL=new Set(['bludgeoning','piercing','slashing','precision','untyped']);
// An energy's finish as the equipment catalog already picked it for each JB2A edition (a melee
// weapon's when one has it). Energies no weapon carries (holy) keep the colour without a finish.
const FINISHES=new Map();
for(const melee of [true,false])for(const w of EQUIPMENT)for(const m of w.modes)if((m.mode==='melee')===melee&&m.element!=='physical'&&!FINISHES.has(m.element)&&m.assets.accent?.length)
 FINISHES.set(m.element,{assets:m.assets.accent,selections:(m.selections??[]).filter(s=>s.slot==='accent')});
const ALIASES={negative:'void',positive:'vitality',holy:'spirit'};
const slugOf=name=>name.toLowerCase().replace(/[^a-z0-9]+/g,'-');

function mode(family,damage){
 const f=FAMILIES[family],color=f.colors[damage]??f.colors.physical,finish=FINISHES.get(ALIASES[damage]??damage),element=finish?ALIASES[damage]??damage:'physical',film=f.film(color);
 return {mode:'melee',group:'natural',damage:f.damage,die:'',persistent:'',traits:['unarmed'],range:0,family,element,elements:[],flavor:[],payload:null,hands:0,reach:false,agile:false,heavy:false,onHitCue:'',returning:false,
  rationale:`${f.label} in the colour of its damage. A creature's natural attack, matched by its exact name.`,
  soundDesign:{profile:f.sound},contactScale:f.scale,
  assets:{contact:[...film,f.free],flight:[],accent:finish?.assets??[],return:[]},
  selections:[{edition:'patreon',slot:'contact',key:film[0],geometry:'radial',approximation:false},{edition:'free',slot:'contact',key:f.free,geometry:'radial',approximation:f.free!==film[0]},...(finish?.selections??[])]};
}
export const NATURAL_WEAPONS=Object.entries(FAMILIES).flatMap(([family,f])=>f.names.map(name=>({
 id:`natural-${slugOf(name)}`,name,slug:slugOf(name),img:'icons/svg/claw.svg',level:0,base:'',group:'natural',category:'unarmed',traits:['unarmed'],rarity:'common',edition:'remaster',
 publication:'Natural attack',uuid:'',natural:family,
 description:`<p>A creature's ${name.toLowerCase()} attack.</p>`,plainDescription:`A creature's ${name.toLowerCase()} attack: ${f.label.toLowerCase()} coloured by its damage type.`,
 modes:[mode(family,'physical')],
})));
const byName=new Map(NATURAL_WEAPONS.map(w=>[normalize(w.name),w]));
// "Claws", "Tusks", "Feet": the word's family name.
const singular=w=>w==='teeth'?w:w==='feet'?'foot':/(ss|us)$/.test(w)?w:w.replace(/(?<=..)s$/,'');
// The last word of a longer name that names a family ("Thunderbird Guard Talon" a talon).
function byWord(name){
 const words=String(name??'').toLowerCase().split(/[^a-z]+/).filter(Boolean).map(singular);
 for(let i=words.length-1;i>=0;i--){const found=byName.get(words[i]);if(found)return found;}
 return null;
}
// NPC Strikes and PC unarmed attacks only; a weapon called "Horn" is still a weapon. Only an NPC
// Strike plays a word of its name: a PC's attack names are its own.
export function naturalWeaponFor(item){
 const npc=item?.type==='melee',unarmed=npc||(item?.type==='weapon'&&(item.category??item.system?.category)==='unarmed');
 if(!unarmed)return null;
 return byName.get(normalize(item.name))??byName.get(normalize(item.system?.slug??item.slug))??(npc?byWord(item.name):null)??null;
}
// An NPC Strike no name places, by its damage: a slashing one rakes like a claw, any other lands as a blow.
export function naturalByDamage(item){
 const types=[...Object.values(item?.system?.damageRolls??{}).map(r=>r?.damageType),item?.system?.damage?.damageType].filter(Boolean);
 return byName.get(normalize(types.includes('slashing')?'Claw':'Slam'));
}
// The attack's energy (Jaws 2d8 piercing plus 1d6 fire → fire), else physical.
export function naturalElement(item){
 const types=[...Object.values(item?.system?.damageRolls??{}).map(r=>r?.damageType),item?.system?.damage?.damageType].filter(Boolean);
 return types.find(t=>!PHYSICAL.has(t))??'physical';
}
// The catalog entry dressed in this attack's damage colour.
export function naturalVariant(weapon,item){
 const element=naturalElement(item);
 return element==='physical'?weapon:{...weapon,modes:[mode(weapon.natural,element)]};
}
