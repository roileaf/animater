// Rune flourishes for PF2e/SF2e weapon Strikes: fundamental runes scale the existing
// contact (striking) and add a weapon glint (potency); each visible property rune adds one
// on-hit element accent. Visual only: never damage, conditions or rules.
import {validateRecipe,MAX_STAGES} from '../../../core/model.mjs';
import {WEAPON_ACCENTS,payloadAppearance} from './weapon-payloads.mjs';
import {MEDIA_DURATIONS} from '../../../../data/media-durations.mjs';

export const RUNE_SETTING='weaponRuneFlourishes';
export function runeFlourishesEnabled(game=globalThis.game){
 try{return game?.settings?.get('animater',RUNE_SETTING)!==false;}catch{return true;}
}
const STRIKING={striking:1,greaterStriking:2,majorStriking:3};
const tier=value=>Number.isFinite(Number(value))&&value!==null&&value!==''?Math.max(0,Math.min(3,Math.trunc(Number(value)))):STRIKING[value]??0;
export function weaponRunes(item){
 const sys=item?.system??{},runes=sys.runes??{};
 const legacy=[1,2,3,4].map(n=>sys[`propertyRune${n}`]?.value);
 const property=(Array.isArray(runes.property)?runes.property:legacy).filter(slug=>typeof slug==='string'&&slug);
 return {potency:tier(runes.potency??sys.potencyRune?.value),striking:tier(runes.striking??sys.strikingRune?.value),property};
}
// Every PF2e/SF2e weapon property rune (pinned PF2e 8.6.1 / SF2e 1.6.1: 62 base runes; greater,
// major and true tiers reuse their base look, larger). Runes that deal a damage type reuse that
// element's weapon accent; the rest get a look from what the rune does. Each ends on a free
// JB2A impact so it always plays.
const own=(assets,tint,extra={})=>({assets:[...assets,'jb2a.impact.005'],appearance:tint?{colorize:true,tintEnabled:true,tint}:{},...extra});
const element=name=>({element:name});
const RUNE_LOOKS={
 // Energy and spirit damage.
 flaming:element('fire'),frost:element('cold'),shock:element('electricity'),corrosive:element('acid'),thundering:element('sonic'),
 holy:element('holy'),unholy:element('unholy'),brilliant:element('light'),
 deathdrinking:element('void'),impactful:element('force'),giantKilling:element('mental'),wounding:element('bleed'),coating:element('poison'),
 astral:own(['jb2a.divine_smite.target.blueyellow','jb2a.divine_smite.target.yellowwhite'],'#bcd0ff'),
 disrupting:own(['jb2a.healing_generic.03.burst.yellow','jb2a.divine_smite.target.yellowwhite'],null),
 ashen:own(['jb2a.smoke.puff.centered.grey','jb2a.impact.fire.01.orange'],'#9a8578'),
 decaying:own(['jb2a.smoke.puff.centered.green','jb2a.toll_the_dead.green.skull_smoke'],'#6f8a4a'),
 demolishing:own(['jb2a.impact.ground_crack.01.purple','jb2a.impact.boulder.01'],'#a98bff'),
 conducting:own(['jb2a.static_electricity.03.blue','jb2a.lightning_ball.blue'],null),
 energizing:own(['jb2a.energy_strands.complete.blue.01','jb2a.static_electricity.03.blue'],null),
 energyVulnerability:own(['jb2a.energy_field.01.multicolored','jb2a.impact.003.pinkpurple'],null,{scale:.6}),
 fearsome:own(['jb2a.markers.fear.dark_orange.01','jb2a.icon.fear.dark_purple'],null),
 nightmare:own(['jb2a.sleep.symbol.dark_pink','jb2a.markers.fear.dark_purple.01'],'#8a4fb0'),
 // Blood and blades.
 grievous:own(['jb2a.claws.200px.dark_red','jb2a.liquid.splash.red'],null),
 bloodbane:own(['jb2a.liquid.splash.red'],'#8e1b2c'),
 bloodthirsty:own(['jb2a.bats.complete.01.red','jb2a.liquid.splash.red'],null),
 serrating:own(['jb2a.melee_generic.slash.01.orange','jb2a.melee_generic.slash.01'],'#d9dde6'),
 vorpal:own(['jb2a.melee_generic.slash.01.orange','jb2a.melee_generic.slash.01'],'#e03a52'),
 keen:own(['jb2a.impact.007.white','jb2a.impact.005.white'],'#eef4ff',{scale:.55}),
 fanged:own(['jb2a.bite.200px.red','jb2a.claws.200px.red'],null),
 // Weight, earth and growth.
 crushing:own(['jb2a.impact.boulder.01','jb2a.impact.004.blue'],'#b9a58a'),
 truddsStrength:own(['jb2a.impact.boulder.01','jb2a.impact.ground_crack.01.orange'],'#d8a84a'),
 shockwave:own(['jb2a.impact.ground_crack.01.orange','jb2a.impact.earth.01.browngreen'],null),
 earthbinding:own(['jb2a.impact.earth.01.browngreen','jb2a.impact.ground_crack.01.green'],null),
 rooting:own(['jb2a.entangle.02.complete.02.green','jb2a.swirling_leaves.complete.01.green'],null),
 underwater:own(['jb2a.water_splash.circle.01.blue','jb2a.liquid.splash.blue'],null),
 swarming:own(['jb2a.particles.002.001.complete.many.white','jb2a.particles.002.001.complete.many'],'#77686f'),
 // Binding and holding.
 anchoring:own(['jb2a.markers.chain.spectral_standard.complete.02.purple','jb2a.markers.chain.spectral_standard.complete.02.blue'],null),
 hooked:own(['jb2a.markers.chain.spectral_standard.complete.02.blue','jb2a.markers.chain.diamond.loop.01.grey'],null),
 hauling:own(['jb2a.markers.chain.diamond.loop.02.grey','jb2a.markers.chain.diamond.loop.01.grey'],null,{scale:.6}),
 ghostTouch:own(['jb2a.smoke.puff.centered.grey'],'#cfe8ff',{opacity:.7}),
 // Oaths, blessings and mercy.
 kolssOath:own(['jb2a.ward.rune.yellow.01','jb2a.ward.rune.yellow.02'],null),
 authorized:own(['jb2a.ward.rune.dark_purple.01','jb2a.ward.rune.dark_purple.02'],null,{scale:.6}),
 bane:own(['jb2a.impact.004.dark_purple','jb2a.impact.ground_crack.01.dark_red'],null),
 ancestralEchoing:own(['jb2a.magic_signs.rune.02.complete.01.blue','jb2a.energy_strands.complete.blue.01'],null,{scale:.6}),
 bolkasBlessing:own(['jb2a.butterflies.few.purple','jb2a.butterflies.few.orange'],null),
 hopeful:own(['jb2a.bless.200px.intro.yellow','jb2a.markers.light.loop.yellow'],null),
 merciful:own(['jb2a.dizzy_stars.200px.yellow','jb2a.dizzy_stars.200px.blueorange'],null),
 pacifying:own(['jb2a.healing_generic.03.burst.bluegreen','jb2a.healing_generic.03.burst.green'],null),
 // Guarding the wielder.
 deflecting:own(['jb2a.shield.01.complete.01.white','jb2a.shield.01.complete.01.blue'],null,{scale:.6}),
 kinWarding:own(['jb2a.shield.01.complete.01.green','jb2a.shield.01.complete.01.blue'],null,{scale:.6}),
 // Motion, speed and the weapon itself.
 speed:own(['jb2a.wind_lines.01.02.white','jb2a.wind_lines.01.01.white'],'#fff2b3'),
 flurrying:own(['jb2a.wind_lines.01.01.white','jb2a.wind_lines.01.02.white'],null),
 dancing:own(['jb2a.whirlwind.bluewhite','jb2a.whirlwind.blue'],null,{scale:.55}),
 flickering:own(['jb2a.misty_step.01.blue','jb2a.misty_step.01.purple'],null,{scale:.6}),
 shifting:own(['jb2a.impact.008.purple','jb2a.misty_step.01.purple'],null),
 called:own(['jb2a.teleport.01.blue','jb2a.misty_step.01.blue'],null,{scale:.5}),
 returning:own(['jb2a.impact.009.white','jb2a.impact.007.white'],'#cfe0ff',{scale:.55}),
 extending:own(['jb2a.impact.004.blue','jb2a.energy_strands.complete.blue.01'],null),
 spellStoring:own(['jb2a.magic_signs.rune.02.complete.01.purple','jb2a.impact.003.pinkpurple'],null),
 cunning:own(['jb2a.impact.010.orange','jb2a.impact.011.orange'],null),
 impossible:own(['jb2a.impact.003.pinkpurple','jb2a.energy_field.01.multicolored'],null),
};
const GLINT=['jb2a.glint.blue.few','jb2a.shimmer.01.blue','jb2a.impact.007.white','jb2a.impact.005'];
// "greaterFlaming" / "greater-flaming" → {base:'flaming', rank:2}.
function parseRune(slug){
 const camel=String(slug).replace(/[-_\s]+([a-z])/g,(_,c)=>c.toUpperCase());
 const [,prefix,rest]=/^(greater|major|true)?(.*)$/i.exec(camel);
 const base=prefix&&rest?rest[0].toLowerCase()+rest.slice(1):camel;
 return {base,rank:prefix?.toLowerCase()==='major'||prefix?.toLowerCase()==='true'?3:prefix?2:1};
}
const words=base=>base.replace(/([A-Z])/g,' $1').toLowerCase();
const film=assets=>Math.min(2600,Math.max(900,...assets.map(k=>MEDIA_DURATIONS[k]??Object.entries(MEDIA_DURATIONS).find(([key])=>key.startsWith(k+'.'))?.[1]??0))+150);
// The stage a weapon Strike lands on: the melee contact, else the ranged arrival finish.
const anchorOf=stages=>stages.find(s=>s.kind==='impact'&&s.stageId?.endsWith('-contact'))??stages.find(s=>s.kind==='impact'&&s.stageId?.endsWith('-accent'))??stages.find(s=>s.kind==='impact');
export function withRuneFlourishes(recipe,item,{runes=true}={}){
 if(!runes||!recipe)return recipe;
 const {potency,striking,property}=weaponRunes(item);
 const anchor=anchorOf(recipe.stages);
 if(!anchor||!potency&&!striking&&!property.length)return recipe;
 const growth=1+.12*striking;
 // Striking hits harder: the contact (and a melee finish riding it) grows per tier.
 let stages=recipe.stages.map(s=>striking&&s.kind==='impact'&&(s===anchor||s.stageId?.endsWith('-accent'))?{...s,scale:Math.min(5,Math.round(s.scale*growth*100)/100)}:s);
 const anchored=stages.find(s=>s.stageId===anchor.stageId)??anchor;
 const at=(offset,extra)=>({kind:'impact',delay:anchored.delay+offset,afterStage:anchored.stageId,timingAnchor:'start',startOffset:offset,requiresHit:true,oneShot:true,fadeIn:0,scaleInDuration:0,targetSelection:'first',...extra});
 const additions=[],seen=new Set();
 for(const slug of property){
  const {base,rank}=parseRune(slug),look=RUNE_LOOKS[base];
  if(!look)continue;
  const key=look.element??base;if(seen.has(key))continue;seen.add(key);
  const assets=look.assets??(WEAPON_ACCENTS[look.element]??[]).map(k=>`jb2a.${k}`);
  const offset=160+additions.length*120,name=`${rank===3?'Major ':rank===2?'Greater ':''}${words(base)}`;
  additions.push(at(offset,{stageId:`${recipe.id}-rune-${base}`,label:`${name[0].toUpperCase()}${name.slice(1)} rune · ${look.element??words(base)} accent`,assets,
   duration:film(assets),fadeOut:220,scale:Math.round(((look.scale??.8)+.12*(rank-1))*growth*100)/100,opacity:look.opacity??.9,
   ...(look.element?payloadAppearance(look.element,assets):look.appearance)}));
 }
 if(potency)additions.push(at(60,{stageId:`${recipe.id}-rune-potency`,label:`+${potency} potency rune · weapon glint`,assets:GLINT,duration:1100,fadeOut:400,
  scale:Math.round((.3+.15*potency)*100)/100,opacity:Math.min(1,.4+.15*potency),colorize:true,tintEnabled:true,tint:'#bcd6ff'}));
 stages=[...stages,...additions].slice(0,Math.max(stages.length,MAX_STAGES));
 return validateRecipe({...recipe,stages});
}
