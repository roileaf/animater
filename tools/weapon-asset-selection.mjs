import {colorAffinity} from './color-affinity.mjs';
import {assetGeometry} from './spell-asset-selection.mjs';
import {WEAPON_ACCENTS,BOMB_PAYLOADS} from '../scripts/catalogs/pf2e/weapons/weapon-payloads.mjs';
const melee={dagger:['dagger.melee.02','melee_generic.piercing'],sword:['sword.melee.01'],greatsword:['melee_attack.03.greatsword.02','greatsword.melee.standard','melee_attack.03.greatsword'],spear:['spear.melee.01'],hammer:['hammer.melee.01','melee_attack.02.hammer'],club:['club.melee.01','melee_attack.02.club'],flail:['melee_attack.01.flail'],unarmed:['unarmed_strike.physical'],axe:['melee_generic.slashing'],polearm:['melee_generic.piercing'],pick:['melee_attack.02.pickaxe.01','melee_generic.piercing'],shield:['melee_generic.bludgeoning'],whip:['melee_generic.slashing.one_handed','melee_generic.slash.01.orange'],contact:['melee_generic']};
const flights={bow:['arrow.physical'],crossbow:['bolt.physical','arrow.physical'],blowgun:['dart.01.throw','dagger.throw.01'],firearm:['bullet.01','bullet.02'],cannon:['throwable.launch.cannon_ball.01','boulder.toss.01'],sling:['sling','bullet.02'],spear:['spear.throw.01'],dagger:['dagger.throw.01','kunai.throw'],shuriken:['shuriken.01'],hammer:['hammer.throw'],axe:['axe.throw','dagger.throw.02'],boomerang:['boomerang','hammer.throw'],thrown:['hammer.throw','dagger.throw.01'],club:['mace.throw','hammer.throw'],weight:['mace.throw','hammer.throw'],bola:['mace.throw','slingshot'],hook:['kunai.throw','dagger.throw.01'],bomb:['throwable.throw.bomb'],flask:['throwable.throw.flask'],projectile:['arrow.physical']};
const r0=row=>row.key;
export function selectWeaponMedia(databases,weapon,mode){
 const assets={contact:[],flight:[],accent:[],return:[]},selections=[];
 for(const [edition,rows]of Object.entries(databases)){
  const pick=(slot,roots,geometry,fallback=[])=>{
   assets[slot]??=[];
   const candidates=rows.filter(r=>[geometry].flat().includes(assetGeometry(r)));
   let chosen;
   for(const root of [...roots,...fallback]){
    const list=candidates.filter(r=>r.key===`jb2a.${root}`||r.key.startsWith(`jb2a.${root}.`));
    if(list.length){
     list.sort((a,b)=>{
      const score=r=>(/\.white\b/.test(r.key)?10:0)+(r.key.includes(mode.hands===2?'two_handed':'one_handed')?8:0)+(r.key.includes('.01')?1:0);
      // Mundane gear reads as white/steel; elemental modes take their hue. Never alphabetical blue.
      // A trait flourish (Scalding Gauntlets' fire) may tint a colorless-white-less contact family.
      const tone=mode.element==='physical'&&slot==='contact'?mode.flavor?.[0]:mode.element;
      const hue={fire:'orange',cold:'blue',electricity:'blue',acid:'green',poison:'green',void:'purple',force:'purple',mental:'purple',spirit:'yellow',vitality:'yellow',sonic:'blue',unholy:'purple',holy:'yellow',light:'yellow',plant:'green'}[tone]??(slot==='flight'&&/bullet/.test(r0(a))?'orange':'white');
      return score(b)-score(a)||colorAffinity(b.key,hue)-colorAffinity(a.key,hue)||a.key.localeCompare(b.key);
     });chosen=list[0];break;
    }
   }
   if(!chosen)throw Error(`No ${edition} ${slot} geometry for ${weapon.name} (${mode.mode}).`);
   if(!assets[slot].includes(chosen.key))assets[slot].push(chosen.key);
   const substitute=mode.family==='spittle'&&(/\.arrow\.|\.bolt\.|\.eldritch_blast\./.test(chosen.key)||mode.element==='acid')||mode.family==='blowgun'&&chosen.key.includes('dagger.')||['whip','pick','shield','contact','polearm','axe'].includes(mode.family)&&chosen.key.includes('melee_generic.')||mode.family==='crossbow'&&chosen.key.includes('arrow.');
   selections.push({edition,slot,key:chosen.key,geometry,approximation:substitute||!roots.some(r=>chosen.key===`jb2a.${r}`||chosen.key.startsWith(`jb2a.${r}.`))});
  };
  const nativeMelee={chakram:['melee_attack.01.chakram'],rapier:['rapier.melee.01'],shortsword:['shortsword.melee.01','melee_attack.01.shortsword'],katana:['melee_attack.04.katana'],butterflysword:['melee_attack.01.butterflysword'],sickle:['melee_attack.01.sickle'],scythe:['melee_attack.05.scythe'],mace:['melee_attack.02.mace'],shield:['melee_attack.06.shield'],claw:['melee_generic.creature_attack.claw'],scimitar:['scimitar.melee.01','melee_attack.04.scimitar'],falchion:['falchion.melee.01','melee_attack.04.falchion'],handaxe:['handaxe.melee.standard','melee_attack.02.handaxe'],greataxe:['melee_attack.03.greataxe.02.white','greataxe.melee.standard','melee_attack.03.greataxe'],quarterstaff:['quarterstaff.melee.01'],greatclub:['greatclub.standard','melee_attack.03.greatclub'],glaive:['glaive.melee.01'],halberd:['halberd.melee.01'],maul:['maul.melee.standard','melee_attack.03.maul'],warhammer:['warhammer.melee.01','melee_attack.02.warhammer']};
  const nativeFlight={javelin:['javelin.01.throw','javelin.throw'],dart:['dart.01.throw'],chakram:['chakram.01.throw'],boomerang:['boomerang.01.white.01.throw','boomerang.02.white.01.throw'],handaxe:['handaxe.throw'],shieldThrow:['shield_attack.ranged.throw'],vial:mode.element==='unholy'?['throwable.throw.flask.01.black','throwable.throw.flask']:['throwable.throw.flask.01.white','throwable.throw.flask'],sling:['slingshot'],spike:['javelin.01.throw','javelin.throw'],airgun:['bullet.02'],spittle:mode.element==='fire'?['fire_bolt.orange']:mode.element==='cold'?['snowball_toss']:mode.element==='electricity'?['bolt.lightning.blue','arrow.lightning.blue','lightning_bolt.narrow.blue']:['spell_projectile.poison.greenyellow','arrow.poison.green.01']};
  const mystic=['cold','void','negative','force','mental'].includes(mode.element);
  if(mode.family==='whip'&&mystic)nativeMelee.whip=['melee_generic.slash.01'];
  // Generic contact follows the native damage type: piercing pens/cards never read as a bludgeon.
  if(mode.family==='contact')nativeMelee.contact=[`melee_generic.${mode.damage}`,'melee_generic'];
  const flame=mode.elements?.includes('fire')?[`${mode.family}.melee.fire.orange`]:[];
  if(mode.mode==='melee')pick('contact',mode.contactRoots??[...flame,...(nativeMelee[mode.family]??melee[mode.family]??melee.contact)],'radial',[`melee_generic.${mode.damage}`, 'melee_generic.slash.01','unarmed_strike.physical']);
  else{
   const element=({fire:'fire',cold:'cold',electricity:'lightning',poison:'poison'})[mode.element],color=({fire:'orange',cold:'blue',electricity:'blue',poison:'green'})[mode.element];
   const root=mode.family==='bow'?'arrow':mode.family==='crossbow'?'bolt':'';
   const elemental=root&&element?[`${root}.${element}.${color}`]:[];
   pick('flight',mode.flightRoots??[...elemental,...(nativeFlight[mode.family]??flights[mode.family]??flights.projectile)],mode.family==='spittle'&&mode.element==='electricity'?['projectile','beam']:'projectile',['dagger.throw.01','arrow.physical']);
   // Black-powder and gun Strikes fire visibly from the muzzle.
   if(mode.mode==='ranged'&&mode.family==='firearm')pick('muzzle',['muzzle_flash.single.01','muzzle_flash.burst.01'],'radial',['impact.005.orange','impact.001.orange']);
  }
  const payload=mode.payload;
  const liquidColor={acid:'green',poison:'green',water:'blue',mud:'brown',glue:'brown',bleed:'red'}[payload?.element];
  const primary=payload?.style==='liquid'&&liquidColor?[`liquid.splash.${liquidColor}`,'liquid.splash']:payload?BOMB_PAYLOADS[payload.style]?.roots:WEAPON_ACCENTS[mode.element];
  pick('accent',primary??WEAPON_ACCENTS.physical,'radial',WEAPON_ACCENTS[mode.element]??WEAPON_ACCENTS.physical);
  if(payload?.fracture)pick('fracture',['explosion.top_fracture.flask.01'],'radial');
  if(payload?.residue||mode.persistent){
   const type=mode.persistent||payload.element;
   const roots=type==='bleed'?['liquid.splash02.red']:type==='fire'?['impact.fire.01.orange']:
    payload?.style==='radiation'?['energy_field.02.above.green','energy_field.02.above.blue']:
    payload?.style==='insects'?['particles.002.001.complete.many.white','particles.002.001.complete.many']:
    payload?.style==='algae'?['particles.002.001.complete.few.greenyellow','particles.002.001.complete.few']:
    payload?.style==='force'?['energy_field.01','energy_field.02.above']:
    payload?.style==='spores'?['plant_growth.03.square.2x2.loop.greenyellow']:
    payload?.style==='foam'?['ground_cracks.01.white','ground_cracks.01']:
    payload?.style==='gas'||['void','negative','poison'].includes(type)?['smoke.puff.centered.grey']:
    payload?.style==='web'?['web.complete.002.white','web.01']:payload?.style==='thorns'?['entangle.green']:
    payload?.style==='light'||/silver-orb|pernicious-spore/.test(weapon.slug)?['particles.002.001.complete.few.white','particles.002.001.complete.few.blue']:['liquid.blob'];
   pick('residue',roots,'radial',WEAPON_ACCENTS[type]??WEAPON_ACCENTS.physical);
  }
  const secondary=[...new Set([...(mode.elements??[]).filter(e=>e!==mode.element),payload?.secondary].filter(Boolean))];
  for(const [index,element]of secondary.entries())pick(`accent${index+2}`,WEAPON_ACCENTS[element]??WEAPON_ACCENTS.physical,'radial');
  for(const [index,flavor]of (mode.flavor??[]).entries())pick(`flavor${index+1}`,WEAPON_ACCENTS[flavor]??WEAPON_ACCENTS.physical,'radial');
  // Bolas entangle: wrap the first target in a chain marker (web wisp fallback).
  if(mode.family==='bola')pick('bind',['markers.chain.standard.complete.02'],'radial',['web.complete.002.white']);
  if(mode.onHitCue==='warpwave')pick('onHit',['energy_field.01.multicolored'],'radial',['energy_field.01.blue']);
  if(mode.returning){
   const returns={boomerang:['boomerang.01.white.01.return','boomerang.02.white.01.return'],chakram:['chakram.01.return'],dart:['dart.01.return'],shieldThrow:['shield_attack.ranged.return'],javelin:['javelin.01.return','spear.return.01'],handaxe:['handaxe.return']};
   pick('return',returns[mode.family]??[`${mode.family}.return`],'projectile',['dagger.return.01']);
  }
 }
 return {assets,selections};
}

