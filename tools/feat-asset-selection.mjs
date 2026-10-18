import { resolveSpellMedia, assetGeometry } from "./spell-asset-selection.mjs";
import { colorAffinity } from './color-affinity.mjs';
import { TOSS_MEDIA } from '../scripts/catalogs/pf2e/feats/feat-toss.mjs';

const martial = new Set(["strike","heavyStrike","doubleStrike","multiStrike","mixedStrike","restorativeStrike","smite","spellstrike","fearStrike","charge","tumbleStrike","feintStrike","bindStrike","tripStrike","drawStrike","whirlwindStrike"]);
export const FEAT_SELECTION_REVISION = 9;
// A reviewed weapon wins; an unreviewed Strike names its anatomy in the text
// ("make a claw Strike"), which must not fall back to a generic sword slash.
const anatomyWeapon=context=>{
  const reviewed=(context.direction?.weapon??"").toLowerCase();
  if(reviewed&&!/^(?:none|as described|melee-or-ranged|null)$/.test(reviewed))return reviewed;
  if(!martial.has(context.motif)&&context.motif!=="unarmed")return reviewed;
  const named=/\b(claw|talon|jaws|fang|bite|fist|horn|antler|tail|tusk|hoof|hooves|wing)s?\s+(?:unarmed\s+)?(?:Strikes?|attacks?)\b/i.exec(context.description??"");
  return named?named[1].toLowerCase():reviewed;
};
// Reviewed contact shape and weapon decide native footage. Never cycle colors
// or variants by name/hash merely to inflate the number of used keys.
export function nativeFeatRoots(context) {
  const weapon=anatomyWeapon(context);
  const shape=[context.direction?.shape,context.direction?.approach,...(context.direction?.finish??[])].join(" ").toLowerCase();
  const paired=(context.direction?.contacts?.count??1)>1;
  const heavy=context.motif==="heavyStrike"||/weighted|descending|slam|pummel/.test(shape);
  if(/claw|talon/.test(weapon))return [`melee_generic.creature_attack.claw.${paired?"002":"001"}`,"melee_generic.creature_attack.claw","unarmed_strike.physical","unarmed_strike"];
  if(/pincer/.test(weapon))return ["melee_generic.creature_attack.pincer","unarmed_strike.physical"];
  if(/jaw|fang|bite/.test(weapon))return ["bite","unarmed_strike.physical.01","unarmed_strike.physical"];
  // Horns, antlers and tusks gore (piercing); tails, hooves and wings batter.
  if(/horn|antler|tusk|gore/.test(weapon))return ["melee_generic.piercing.one_handed","melee_generic.piercing","unarmed_strike.physical.02","unarmed_strike.physical"];
  if(/\btail\b|hoof|hooves|\bwing/.test(weapon))return ["melee_generic.bludgeoning.one_handed","unarmed_strike.physical.02","unarmed_strike.physical"];
  if(/fist|kick|unarmed/.test(weapon)||context.motif==="unarmed")return [heavy?"melee_generic.creature_attack.fist.002":"unarmed_strike.physical.02","unarmed_strike.physical","melee_generic.creature_attack.fist","unarmed_strike"];
  if(!martial.has(context.motif))return [];
  if(context.slug==="into-the-fray")return ["melee_generic.slashing.one_handed","melee_generic.slash.01","sword.melee.01"];
  if(/polearm|spear/.test(weapon))return ["spear.melee.01","melee_generic.piercing","melee_generic.slash"];
  if(/dagger|knife/.test(weapon))return ["dagger.melee.02","melee_generic.piercing","melee_generic.slash"];
  if(/shield/.test(weapon))return ["melee_attack.06.shield","melee_generic.bludgeoning.two_handed","melee_generic.bludgeoning","unarmed_strike.physical"];
  if(/shield|hammer|club|mace|bludgeon|bash|ram/.test(weapon+" "+shape))return [`melee_generic.bludgeoning.${heavy?"two_handed":"one_handed"}`,"unarmed_strike.physical.02","unarmed_strike.physical","melee_generic.slash"];
  if(/thrust|pierc|stab|spear|narrow/.test(weapon+" "+shape))return ["melee_generic.piercing","sword.melee.01","melee_generic.slash.02.001","melee_generic.slash"];
  if(/two-handed|greatsword/.test(weapon)&&heavy)return ["melee_attack.03.greatsword.02","greatsword.melee.standard","melee_generic.slashing.two_handed","melee_generic.slash.02.002","melee_generic.slash"];
  if(/wide|cleav|sweep/.test(shape))return ["melee_generic.slash.02.002","melee_generic.slashing.two_handed","melee_generic.slash","sword.melee"];
  if(paired)return ["melee_generic.slash.02.001","melee_generic.slash.02","melee_generic.slash","sword.melee"];
  return ["melee_generic.slashing.one_handed","melee_generic.slash.01","melee_generic.slash","sword.melee"];
}
const contactColors={weapon:["white","grey","orange"],fire:["orange","red","yellow"],cold:["blue","white"],electricity:["purple","blue","yellow"],acid:["green","yellow"],poison:["green","purple"],plant:["green","yellow"],blood:["red","dark_red"],void:["dark_purple","purple","black"],spirit:["white","yellow","blue"],vitality:["yellow","white","green"]};
const colorRank=(key,theme)=>{
  const colors=contactColors[theme]??contactColors.weapon;
  const index=colors.findIndex(color=>key.split('.').includes(color));
  // Unlisted colors fall back by hue distance, never alphabetically (blue).
  return index<0?colors.length+1-colorAffinity(key,colors[0]):index;
};
export function resolveFeatMedia(databases, theme, profile, defaults, context) {
  if(TOSS_MEDIA[context.slug]) {
    const assets={},selections=[];
    for(const [slot,roots] of Object.entries(TOSS_MEDIA[context.slug])){
      assets[slot]=[];
      const geometry=slot==='bolt'?'projectile':'radial';
      for(const edition of ['patreon','free']){
        const chosen=databases[edition].filter(row=>assetGeometry(row)===geometry)
          .map(row=>({row,index:roots.findIndex(root=>row.key===`jb2a.${root}`||row.key.startsWith(`jb2a.${root}.`))})).filter(r=>r.index>=0)
          .sort((a,b)=>a.index-b.index||colorRank(a.row.key,theme)-colorRank(b.row.key,theme)||a.row.key.localeCompare(b.row.key))[0]?.row;
        if(!chosen)throw Error(`No ${edition} ${slot} footage for ${context.name}.`);
        if(!assets[slot].includes(chosen.key))assets[slot].push(chosen.key);
        selections.push({edition,slot,key:chosen.key,geometry,reason:'description-reviewed toss activity: physical recipient and phase-specific footage'});
      }
    }
    return {assets,selections};
  }
  const intent=[context.direction?.weapon,context.direction?.shape,context.direction?.approach,context.description].join(" ").toLowerCase();
  if(["ranged","throughShot","mixedStrike"].includes(context.motif))profile={...profile,bolt:/firearm|bullet|gun|pistol|musket/.test(intent)?"bullet.physical,bullet":"arrow.physical,arrow,bolt"};
  if(context.motif==="restoration"&&theme!=="healing")profile={...profile,cast:defaults.cast,aura:defaults.aura};
  if(context.slug==="magnetic-pinions")profile={...profile,bolt:"bullet.physical,bullet"};
  if(context.slug==="vengeful-spirit-deck")profile={...profile,bolt:"ranged.card,spell_projectile"};
  if(context.slug==="doctors-visitation")profile={...profile,cast:"glint",hit:"healing_generic.03.burst,healing_generic",aura:"healing_generic.loop"};
  if(["guarded-advance","guarded-advance-knight-vigilant"].includes(context.slug))profile={...profile,cast:"shield.01.complete,shield",aura:"shield"};
  if(context.slug==="black-powder-boost")profile={...profile,cast:"muzzle_flash.single,smoke",aura:"smoke"};
  if(context.slug==="explosive-leap")profile={...profile,cast:"explosion,fireball.explosion",aura:"smoke"};
  if(["marine-jet","propelled-leap"].includes(context.slug))profile={...profile,cast:"water_splash,liquid",aura:"water_splash,liquid"};
  if(context.slug==="ratfolk-roll")profile={...profile,cast:"ground_cracks,smoke",aura:"ground_cracks,smoke"};
  if(context.slug==="cross-the-final-horizon")profile={...profile,cast:"static_electricity",aura:"static_electricity"};
  const passageContacts={
    "sonic-strafe":"shatter,impact", "volcanic-escape":"fireball.explosion,impact_themed.fire",
    "dive-of-the-divine":"divine_smite,impact", "thunderous-landing":"shatter,impact",
    "danse-macabre":"ground_cracks,impact", "strafing-breath":"impact,ground_cracks",
    "to-war":"ground_cracks,impact", "trampling-charge":"ground_cracks,impact",
  };
  if(passageContacts[context.slug])profile={...profile,hit:passageContacts[context.slug]};
  const pattern=["ray","boomerang","lineCue"].includes(context.motif)?"ray":"missile";
  const selections=[];
  const assets=resolveSpellMedia(databases,theme,profile,defaults,{...context,delivery:"target",design:{label:profile.label,assetIntent:context.rationale,pattern},onSelection:selection=>selections.push(selection)});
  if(context.slug==='aerial-boomerang'){
    // Native fiction is a flying blade of wind. Keep the Free wind beam when
    // no projectile slash exists; both editions remain baked travel footage.
    const previousKeys=assets.bolt,editionKeys=[];
    for(const edition of ['patreon','free']){
      const candidate=databases[edition].find(row=>row.key==='jb2a.ranged_slash.instant.001.white'&&assetGeometry(row)==='projectile');
      const keys=new Set(databases[edition].map(row=>row.key));
      editionKeys.push(candidate?.key??previousKeys.find(key=>keys.has(key)));
      if(!candidate)continue;
      const at=selections.findIndex(selection=>selection.edition===edition&&selection.slot==='bolt');
      selections[at]={edition,slot:'bolt',key:candidate.key,geometry:'projectile',reason:'native shearing wind blade; baked ranged slash'};
    }
    assets.bolt=[...new Set(editionKeys.filter(Boolean))];
  }
  const extra=(slot,roots,reason)=>{
    assets[slot]=[];
    for(const edition of ["patreon","free"]){
      const chosen=databases[edition].filter(r=>assetGeometry(r)==="radial")
        .map(row=>({row,index:roots.findIndex(root=>row.key===`jb2a.${root}`||row.key.startsWith(`jb2a.${root}.`))})).filter(r=>r.index>=0)
        .sort((a,b)=>a.index-b.index||colorRank(a.row.key,theme)-colorRank(b.row.key,theme)||a.row.key.localeCompare(b.row.key))[0]?.row;
      if(!chosen)throw Error(`No ${edition} ${slot} footage for ${context.name}.`);
      if(!assets[slot].includes(chosen.key))assets[slot].push(chosen.key);
      selections.push({edition,slot,key:chosen.key,geometry:"radial",reason});
    }
  };
  if(context.motif==="absorb"&&/target|thrall|creature|cone|emanation/.test(context.direction?.origin??""))extra("transfer",theme==="blood"?["particles.002.001.complete.few.red","particles.002.001.complete.few"]:["particles.002.001.complete.few"],"small moving energy motes convey victim-to-source intake; not stretched stationary footage");
  if(context.slug==="into-the-fray")extra("shieldHit",["melee_attack.06.shield","melee_generic.bludgeoning.one_handed","unarmed_strike.physical"],"second native Strike uses shield, rather than another copy of weapon art");
  if(["everstand-strike","clans-edge"].includes(context.slug))extra("guard",["shield.01.complete","shield"],"source guard follows contact; target is not granted a shield");
  if(context.slug==="godbreaker")extra("landing",["ground_cracks.01","impact.001.white","impact.001"],"final successful-branch ground slam after three unarmed hits");
  if(context.slug==="split-spellstrike")extra("magicFinish",["energy_field.02.above.purple","energy_field.02.above","impact.001"],"symbolic chosen-spell discharge at the two different weapon recipients");
  if(["anatomical-quartering","devastating-manifestation"].includes(context.slug))extra("spiritFinish",["divine_smite.target.yellowwhite","divine_smite.target.blueyellow","impact.001.white"],"localized spirit accent; no invented condition or extra Strike");
  if(context.slug==="devastating-manifestation")extra("manifestation",["shimmer","energy_field.01"],"armament manifests before optional weapon contacts");
  if(context.slug==="liberating-dive"){
    extra("rescue",["shield.01.complete","shield"],"second selected creature is the willing ally receiving an Escape opportunity");
    extra("hit",["melee_generic.slash.01","melee_generic.slash"],"one selected foe receives the optional metal wing Blast contact");
  }
  // Natural weapon contact is already localized footage with inherited melee
  // metadata. Generic impact/color bonuses must not replace an explicit slash.
  const roots=nativeFeatRoots(context);
  if(roots.length){
    const chosen=[];
    for(const edition of ["patreon","free"]){
      const candidate=databases[edition].filter(row=>assetGeometry(row)==="radial"&&["melee","melee_large"].includes(row.templateName))
        .map(row=>({row,index:roots.findIndex(root=>row.key===`jb2a.${root}`||row.key.startsWith(`jb2a.${root}.`))})).filter(row=>row.index>=0)
        .sort((a,b)=>a.index-b.index||colorRank(a.row.key,theme)-colorRank(b.row.key,theme)||a.row.key.localeCompare(b.row.key))[0]?.row;
      if(!candidate)throw Error(`No native ${edition} melee contact for ${context.name}.`);
      if(!chosen.includes(candidate.key))chosen.push(candidate.key);
      const index=selections.findIndex(s=>s.edition===edition&&s.slot==="hit");
      selections[index]={edition,slot:"hit",key:candidate.key,geometry:"radial",matchedHints:roots.filter(root=>candidate.key.startsWith(`jb2a.${root}.`)),reason:"native inherited melee-template contact; prioritized over generic impacts"};
    }
    assets.hit=chosen;
  }
  if(context.slug==="black-powder-boost"){
    assets.cast=[];
    for(const edition of ["patreon","free"]){
      const candidate=databases[edition].filter(row=>assetGeometry(row)==="radial"&&row.key.startsWith("jb2a.muzzle_flash.single."))
        .sort((a,b)=>colorRank(a.key,"fire")-colorRank(b.key,"fire")||a.key.localeCompare(b.key))[0];
      if(!candidate)throw Error(`No native ${edition} source muzzle flash.`);
      if(!assets.cast.includes(candidate.key))assets.cast.push(candidate.key);
      const index=selections.findIndex(s=>s.edition===edition&&s.slot==="cast");
      selections[index]={edition,slot:"cast",key:candidate.key,geometry:"radial",reason:"source firearm discharge powers jump; no foe-directed projectile"};
    }
  }
  if(["rebounding-assault","throw-and-catch"].includes(context.slug)){
    const selected=[],roots=["greatsword.throw","sword.throw","dagger.throw"];
    for(const edition of ["patreon","free"]){
      const candidate=databases[edition].filter(row=>assetGeometry(row)==="projectile").map(row=>({row,index:roots.findIndex(root=>row.key.startsWith(`jb2a.${root}.`))})).filter(r=>r.index>=0).sort((a,b)=>a.index-b.index||a.row.key.localeCompare(b.row.key))[0]?.row;
      if(!candidate)throw Error(`No native ${edition} thrown weapon for ${context.name}.`);
      if(!selected.includes(candidate.key))selected.push(candidate.key);
      selections.push({edition,slot:"thrown",key:candidate.key,geometry:"projectile",reason:"moving thrown weapon; Free dagger approximates configurable melee weapon"});
    }
    assets.thrown=selected;
  }
  if(["running-reload","nightwave-springing-reload"].includes(context.slug)){
    assets.reload=[];
    for(const edition of ["patreon","free"]){
      const candidate=databases[edition].filter(row=>assetGeometry(row)==="radial"&&row.key.startsWith("jb2a.glint.")&&row.key.endsWith(".few"))
        .sort((a,b)=>a.key.localeCompare(b.key))[0];
      if(!candidate)throw Error(`No localized ${edition} reload glint.`);
      if(!assets.reload.includes(candidate.key))assets.reload.push(candidate.key);
      selections.push({edition,slot:"reload",key:candidate.key,geometry:"radial",reason:"small source glint after movement; reload is not a shot"});
    }
  }
  // Audit corrections re-pick only the offending slot, in explicit root order.
  // An edition without any listed root keeps its previous selection.
  const force=(slot,roots,reason,bad)=>{
    const shapes=slot==="bolt"?["projectile","beam","line"]:["radial"],chosen=[];
    for(const edition of ["patreon","free"]){
      const previous=selections.find(s=>s.edition===edition&&s.slot===slot);
      // A rule names the offending art; an edition that already avoids it is kept.
      if(bad&&previous&&!bad.test(previous.key)){if(!chosen.includes(previous.key))chosen.push(previous.key);continue;}
      const row=databases[edition].filter(r=>shapes.includes(assetGeometry(r)))
        .map(row=>({row,index:roots.findIndex(root=>row.key===`jb2a.${root}`||row.key.toLowerCase().startsWith(`jb2a.${root.toLowerCase()}.`))})).filter(r=>r.index>=0)
        .sort((a,b)=>a.index-b.index||colorRank(a.row.key,theme)-colorRank(b.row.key,theme)||a.row.key.localeCompare(b.row.key))[0]?.row;
      const key=row?.key??previous?.key??assets[slot]?.[0];
      if(!key)continue;
      if(!chosen.includes(key))chosen.push(key);
      if(!row)continue;
      const entry={edition,slot,key,geometry:assetGeometry(row),reason};
      if(previous)selections[selections.indexOf(previous)]=entry;else selections.push(entry);
    }
    if(chosen.length)assets[slot]=chosen;
  };
  for(const [slot,{roots,reason,bad}] of Object.entries(featMediaCorrections(context,theme,assets)))force(slot,roots,reason,bad);
  return {assets,selections};
}

const PHYSICAL_CONTACT=["impact.005.white","impact.007.white","impact.009.white","impact.005"];
const DUST=["smoke.puff.side.grey","smoke.puff.centered.grey","smoke.puff"];
const BLOOD=["liquid.splash_side02.red","liquid.splash.red","liquid.splash02.red","liquid.splash_side02"];
const PSYCHIC={hit:["energy_strands.02.marker.bluepurple","dizzy_stars.200px.purple","dizzy_stars"],aura:["energy_strands.complete.purple","energy_strands.complete.dark_purple","energy_strands.complete","energy_strands"]};
// Conjured objects take their material, never a plant ring (2026-10-07 audit).
const CONJURED={fire:[["flaming_sphere.200px.orange","flames.01.orange","flames"],["dancing_light.yellow","dancing_light"]],
  metal:[["glint.many","glint"],["aura_themed.01.orbit.complete.metal.01.grey","aura_themed.01.orbit.complete.metal"]],
  spirit:[["spiritual_weapon.club.01.spectral","spiritual_weapon.club"],["glint"]],
  teleport:[["teleport.01","misty_step.01"],["glint"]]};
// Per-feat corrections from the 2026-10-07 full-read audit (verified keys).
const FEAT_MEDIA={
  "collapse-wall":{hit:["falling_rocks.top.1x1.grey","falling_rocks.top.2x1.grey","falling_rocks"],aura:DUST},
  "amalgamate":{hit:["liquid.blob.purple","liquid.blob"],aura:["energy_strands.in.red","energy_strands.complete.dark_purple","energy_strands"]},
  "bone-burst":{hit:["impact.ground_crack.01.white","impact.ground_crack.02.white","impact.ground_crack"]},
  "call-worm-spirit":{hit:["ground_cracks.01.white","ground_cracks"],aura:["bite.400px.grey","bite"]},
  "call-the-swarm":{hit:["smoke.puff.centered.grey","smoke.puff"],aura:["ground_cracks.02.white","ground_cracks"]},
  "beastmasters-call":{hit:["magic_signs.circle.02.conjuration.complete","cast_generic.02"],aura:["magic_signs.circle.02.conjuration.loop"]},
  "celestial-cacophony":{aura:["soundwave.02.orangeyellow","soundwave.01.orangeyellow","soundwave"]},
  "a-hush-falls-over-the-world":{cast:["darkness.black"],aura:["darkness.black"]},
  "dalangs-ally":{cast:["darkness.black"],hit:["darkness.black"],aura:["shimmer.01.purple","shimmer"]},
  "dazzling-dragonet-disappearance":{cast:["dancing_light.yellow","glint.yellow.many","glint"],aura:["shimmer.01.orange","shimmer"]},
  "ash-strider":{cast:["smoke.puff.side.dark_black","smoke.puff.side.grey","smoke.puff"]},
  "explosive-death-drop":{hit:["impact.fire.01.orange","fireball.explosion.orange","fireball.explosion"]},
  "molten-wire":{hit:["impact.fire.01.orange","fireball.explosion.orange"]},
  "scorching-disarm":{hit:["impact.fire.01.orange","fireball.explosion.orange"]},
  "lava-leap":{aura:["shield_themed.above.molten_earth.01.orange","shield_themed.above.molten_earth"]},
  "kashrishi-revivification":{cast:["healing_generic.03.burst","healing_generic.burst"],aura:["healing_generic.loop","healing_generic"]},
  "infinite-expanse-of-bluest-heaven":{hit:["swirling_sparkles.01.blue","swirling_sparkles"],aura:["shimmer.01.blue","shimmer"]},
  "imprison-foe":{aura:["portals.horizontal.ring_masked.dark_purple","portals.horizontal.ring_masked","portals.horizontal.ring"]},
  "guardian-lion-roar":{hit:["shatter.blue","shatter"]},
  "hurricane-swing":{bolt:["gust_of_wind.veryfast","gust_of_wind"],hit:["whirlwind.bluewhite","whirlwind"]},
  "wild-winds-gust":{bolt:["gust_of_wind.veryfast","gust_of_wind"]},
  "lightning-tongue":{hit:["impact.005.white","impact.005"],aura:["glint"]},
  "ensnaring-disarm":{hit:["impact.005.white","impact.005"],aura:["glint"]},
  "goblin-club":{hit:["spiritual_weapon.club.01.spectral.02.green","spiritual_weapon.club"]},
  "instinctive-obfuscation":{cast:["shimmer.01.purple","shimmer"],aura:["shimmer.01.purple","shimmer"]},
  "heat-wave":{cast:["smoke.plumes.01.dark_red","smoke.plumes.01.yellow","smoke.plumes"]},
  "extraplanar-haze":{aura:["swirling_sparkles.01.blue","swirling_sparkles"]},
  "invigorating-breath":{cast:["wind_lines.01.01.white","wind_lines"],aura:["healing_generic.loop","healing_generic"]},
  "feral-mending":{cast:["healing_generic.03.burst.green","healing_generic.03.burst"]},
  "megavolt":{bolt:["breath_weapons.lightning.line.blue","breath_weapons.lightning.line"]},
  "pit-of-snakes":{hit:["entangle.02.complete.02.green","entangle.02.complete"],aura:["entangle.02.loop.02.green","entangle.02.loop"]},
  "oversized-throw":{bolt:["boulder.toss.01.01","boulder.toss.02.01.stone","boulder.toss"],hit:["impact.boulder.01","impact.boulder","impact.ground_crack.01.orange"]},
  "rock-rampart":{aura:["falling_rocks.side.2x1.grey","falling_rocks.side.1x1.grey","falling_rocks"]},
  "scorching-column":{aura:["wall_of_fire.ring.yellow","wall_of_fire.ring","wall_of_fire.Ring"]},
  "rising-hurricane":{hit:["whirlwind.bluewhite","whirlwind"],aura:["whirlwind.bluewhite","whirlwind"]},
  "regurgitate-mutagen":{hit:["liquid.splash_side02.green","liquid.splash.green","liquid.splash"]},
  "rotten-slurry":{hit:["liquid.splash_side02.green","liquid.splash.green","impact.001.green"]},
  "scrap-barricade":{hit:["impact.005.orange","impact.007.orange"],aura:["aura_themed.01.orbit.complete.metal.01.red","aura_themed.01.orbit.complete.metal"]},
  "thunderous-landing":{hit:["shatter.blue","impact.005.white","shatter"]},
  "twist-the-knife":{hit:BLOOD,aura:["energy_strands.in.red","energy_strands"]},
  "anatomical-quartering":{spiritFinish:["energy_strands.complete.grey","energy_strands.complete.blue","energy_strands.complete"]},
  "battle-hymn-to-the-lost":{aura:["spirit_guardians.blueyellow.spirits","spirit_guardians.blueyellow","spirit_guardians"]},
  "smoke-curtain":{aura:["smoke.puff.ring.01.white","smoke.puff.centered.grey","smoke.puff"]},
  "blazing-aura":{aura:["fire_ring.500px.red","flames.04.loop.orange"]},
  "aura-expertise":{aura:["energy_field.02.below.purple","energy_field.02.below"]},
  "dominion-aura":{aura:["energy_field.02.below.purple","energy_field.02.below"]},
  "beguiling-aura":{aura:["swirling_sparkles.01.bluepink","swirling_sparkles"]},
  "slowing-strike":{aura:["markers.chain.standard.loop.02.grey","markers.chain.standard.loop","glint"]},
  // 2026-10-08: icy wind with insects deals slashing (no ice spikes); SF2e
  // leviathan transformation is a sea-creature change, not a healing burst.
  "yamarajs-grandeur":{hit:["whirlwind.bluewhite","whirlwind"],area:["whirlwind.bluewhite","whirlwind"]},
  "invoke-the-leviathan":{cast:["water_splash.circle.01.blue","water_splash"],hit:["impact.water.02.blue","impact.water"]},
  "snakebirds-shadow":{hit:["melee_generic.slashing.one_handed","melee_generic.slash.01","melee_generic.slash"],aura:["water_splash.circle.01.blue","water_splash"]},
};
const MUSIC=/\b(?:sing|song|music|musical|instrument|compos|perform|dance|danc|tune|melod|chant|hymn|anthem|rhythm|verse|lyric)/i;
const MAGICAL=["arcane","divine","occult","primal","magical","divination","detection","revelation","scrying","spell","impulse"];
const OFF_MAGIC=/^jb2a\.impact\.(?:00\d|ground_crack\.0\d)\.(?:purple|blue\d*|pinkpurple|dark_purple)$/;
export function featMediaCorrections(context,theme,assets){
  // `bad` names the offending art: editions whose pick already avoids it are kept.
  const out={},set=(slot,roots,reason,bad)=>{if(assets[slot]?.length&&!out[slot])out[slot]={roots,reason,bad};};
  const has=(slot,re)=>(assets[slot]??[]).some(key=>re.test(key));
  const rule=(slot,re,roots,reason)=>{if(has(slot,re))set(slot,roots,reason,re);};
  const text=String(context.description??""),traits=context.traits??[],motif=context.motif;
  const reviewed=[context.name,context.direction?.shape,context.direction?.approach].join(" ");
  const mundane=!traits.some(t=>MAGICAL.includes(t));
  for(const [slot,roots] of Object.entries(FEAT_MEDIA[context.slug]??{}))set(slot,roots,"2026-10-07 audit: per-feat reviewed media");
  for(const slot of ["cast","hit","aura"]){
    // Holy pillar/flame is for holy fiction, not a generic heavy contact.
    if(!["spirit","vitality","light","healing"].includes(theme))rule(slot,/\.(?:divine_smite|sacred_flame)\./,theme==="blood"?BLOOD:theme==="void"?["impact.001.dark_purple","impact.003.dark_purple","energy_strands.in.purple"]:PHYSICAL_CONTACT,"non-holy contact; holy smite art reserved for holy fiction");
    if(theme==="weapon"&&slot!=="aura")rule(slot,OFF_MAGIC,has(slot,/impact\.ground_crack/)?["impact.ground_crack.01.white","impact.ground_crack.01.orange","impact.ground_crack"]:PHYSICAL_CONTACT,"mundane contact is a white spark, not a magic flash");
    if(!/spiritual|spectral|ghost|astral|conjur|manifest|phantom/i.test(text+reviewed))rule(slot,/\.spiritual_weapon\./,["trip","shove"].includes(motif)?DUST:slot==="hit"?PHYSICAL_CONTACT:["glint"],"no conjured spectral weapon in a mundane maneuver");
    if(!/\b(?:sleep|asleep|slumber|unconscious|dream|drows)/i.test(text))rule(slot,/\.sleep\./,slot==="hit"?PSYCHIC.hit:PSYCHIC.aura,"mental damage without slumber");
    if(theme==="blood")rule(slot,/\.toll_the_dead\./,slot==="hit"?BLOOD:["energy_strands.in.red","energy_strands"],"bleeding wound, not a death knell");
  }
  // Conjured objects show their material, not foliage.
  if(motif==="produce"&&theme!=="plant"&&has("hit",/plant_growth/)){
    const [hit,aura]=CONJURED[theme]??[["impact.005.white","glint.many","glint"],["glint"]];
    rule("hit",/plant_growth|swirling_leaves/,hit,"conjured object is not plant growth");rule("aura",/swirling_leaves|butterflies|plant_growth/,aura,"conjured object is not foliage");
  }
  // Movement medium: Fly -> feathers, Swim -> water, Burrow -> earth; mundane runs lose leaf confetti.
  if(["movement","flight","charge","trample","tumbleStrike"].includes(motif))for(const slot of ["cast","aura"]){
    if(!has(slot,/\.wind_lines\./))continue;
    const medium=source=>/\bburrow/i.test(source)?"burrow":/\b(?:swim|swims|swimming|underwater|dive)\b/i.test(source)?"swim":/\b(?:fly|flies|flying|flight|wings?|glide|glides|soar|swoop|aerial|airborne)\b/i.test(source)?"fly":"";
    const kind=medium(reviewed)||medium(text.split(/[.!?]/).slice(0,3).join(" "));
    if(kind==="burrow")rule(slot,/\.wind_lines\./,["ground_cracks.01.orange","ground_cracks"],"burrowing movement churns earth");
    else if(kind==="swim")rule(slot,/\.wind_lines\./,["water_splash.circle.01.blue","water_splash"],"swimming movement parts water");
    else if(kind==="fly")rule(slot,/\.wind_lines\./,["swirling_feathers.outburst.01.textured","swirling_feathers"],"flight uses wing/feather cue");
    else if(theme!=="plant")rule(slot,/\.wind_lines\.01\.leaves\./,["wind_lines.01.01.white","wind_lines.01.02.white"],"plain movement wake; leaves only for plant fiction");
  }
  // Polymorph: form-specific cue when the reviewed shape names the form.
  if(["form","transform"].includes(motif)){
    const shimmer=/\.shimmer\./;
    if(/\bbats?\b/i.test(reviewed)){rule("cast",shimmer,["bats.complete.01.red","bats.complete"],"bat form");rule("aura",shimmer,["bats.loop.01.red","bats.loop"],"bat form");}
    else if(/\b(?:metal|steel|iron|alloy|adamantine)\b/i.test(reviewed)){rule("cast",shimmer,["aura_themed.01.inward.complete.metal.01.grey","aura_themed.01.inward.complete.metal"],"metal body");rule("aura",shimmer,["aura_themed.01.inward.loop.metal.01.grey","aura_themed.01.inward.loop.metal"],"metal body");}
    else if(/\b(?:bird|birds|feather|feathers|wings?|avian|raven|crow|tengu)\b/i.test(reviewed))rule("cast",shimmer,["swirling_feathers.outburst.01.textured","swirling_feathers"],"winged form");
  }
  // Mundane parries/dodges are not magic bubbles; divine wards are runes.
  // A feat that actually raises/uses a shield keeps the shield art.
  if(motif==="guard"&&["weapon","earth"].includes(theme)&&mundane&&!/\bshields?\b/i.test(reviewed+" "+text)){
    rule("cast",/\.(?:shield|ward)\./,theme==="earth"?["impact.ground_crack.01.orange","impact.ground_crack"]:PHYSICAL_CONTACT,"physical parry/dodge flash, no magic barrier");rule("aura",/\.(?:shield|ward)\./,["glint"],"physical defense settles without a bubble");
  }
  if(motif==="guard"&&theme==="spirit")rule("aura",/\.shield\./,["ward.rune.yellow.01","ward.rune.yellow"],"divine ward rune");
  // Martial stances without an element get a weapon glint, not an energy halo.
  if(motif==="stance"&&["weapon","ward"].includes(theme)&&mundane){
    rule("cast",/energy_field|^jb2a\.impact\.00\d\.(?:purple|blue\d*|pinkpurple|dark_purple)$/,PHYSICAL_CONTACT,"martial stance entrance");rule("aura",/energy_field/,["glint"],"martial readiness, no elemental halo");
  }
  // Misfortune is imposed on a foe: an ominous mark, never the ally fortune twinkle.
  if(motif==="fortune"){
    if(traits.includes("misfortune")||!traits.includes("fortune")&&/\bmisfortune effect\b/i.test(text)){
      for(const slot of ["cast","hit"])rule(slot,/twinkling_stars/,["hunters_mark.pulse.01.purple","hunters_mark.pulse"],"misfortune mark");
      rule("aura",/twinkling_stars|magic_signs/,["hunters_mark.loop.01.purple","hunters_mark.loop"],"misfortune lingers");
    }else rule("aura",/magic_signs/,["twinkling_stars.points08","twinkling_stars"],"school-neutral luck loop");
  }
  // Notes and clefs only for music; voiced orders and roars are sound waves.
  if(!MUSIC.test(text)&&!traits.includes("composition")){
    const voiced=traits.includes("auditory")||/\b(?:shout|roar|call|calls|speak|cry|yell|bark|command|order|decree|voice|word|words|howl|scream)\b/i.test(text);
    for(const slot of ["cast","aura"])rule(slot,/music_notations/,slot==="cast"&&voiced?["soundwave.02","soundwave.01","soundwave"]:["glint.many","glint"],voiced?"voiced command/roar, not music":"silent signal, not music");
    rule("hit",/bardic_inspiration/,/\b(?:stride|strides|step|move|moves|formation|advance|charge)\b/i.test(text)?["ui.chevrons3.yellow","ui.chevrons3"]:["glint"],"allied order cue, not bardic music");
  }
  // Studying or recalling without magic reads as attention, not a detect-magic circle.
  if(theme!=="divination"&&mundane)for(const [slot,suffix] of [["cast","few"],["hit","single"],["aura","many"]])
    rule(slot,/\.detect_magic\./,[`eyes.01.dark_yellow.${suffix}`,`eyes.01.dark_green.${suffix}`,"eyes.01"],"mundane study/senses");
  return out;
}
