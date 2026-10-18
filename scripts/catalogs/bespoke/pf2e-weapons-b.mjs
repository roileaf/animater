// Bespoke compositions (pf2e-weapons-b). Keys: '<system>:<entryId>' or '<system>:<entryId>:<variant|mode>'.
// See scripts/catalogs/bespoke/helpers.mjs and scripts/bespoke.mjs.
import { cast, travel, projectile, impact, area, aura, sprite, motion, tint, spin, breathe, design } from './helpers.mjs';

// ── Shared weapon-Strike building blocks (Patreon key first, Free fallback after) ──
const lunge = (o = {}) => motion('lunge', 'source', { stageId: 'lunge', duration: 1250, distance: 0.14, ...o });
const heavyLunge = (o = {}) => lunge({ duration: 1500, distance: 0.2, ...o });
const swing = (label, keys, o = {}) => impact(label, keys, { stageId: 'swing', delay: 625, duration: 2400, fadeOut: 120, ...o });
const accent = (label, keys, o = {}) => impact(label, keys, { after: 'swing', anchor: 'start', offset: 200, duration: 1800, scale: 0.8, fadeOut: 400, ...o });
const stagger = (o = {}) => motion('stagger', 'targets', { after: 'swing', anchor: 'start', offset: 250, duration: 900, distance: 0.1, intensity: 0.8, ...o });
const recoil = (o = {}) => motion('recoil', 'source', { delay: 520, duration: 900, distance: 0.08, ...o });
const muzzle = (o = {}) => cast('Muzzle flash', ['muzzle_flash.single.01.yellow'], { stageId: 'muzzle', delay: 480, duration: 953, scale: 0.55, opacity: 0.95, faceTarget: true, fadeOut: 120, ...o });
const shot = (label, keys, o = {}) => travel(label, keys, { stageId: 'shot', delay: 520, duration: 1450, fadeOut: 120, ...o });
const onArrival = (label, keys, o = {}) => impact(label, keys, { after: 'shot', anchor: 'start', offset: 250, duration: 1500, scale: 0.65, fadeOut: 300, ...o });
const throwMotion = (o = {}) => motion('throw', 'source', { duration: 900, distance: 0.12, ...o });
const flight = (label, keys, o = {}) => travel(label, keys, { stageId: 'flight', delay: 342, duration: 2083, fadeOut: 120, ...o });
const landed = (label, keys, o = {}) => impact(label, keys, { stageId: 'landed', after: 'flight', anchor: 'start', offset: 850, duration: 1450, scale: 0.65, fadeOut: 300, ...o });
const DARK = '#2e2a38';
const ABILITY = soundProfile => ({ sound: soundProfile, soundNamespace: 'ability' });

// Luck blade: a gold-glinting shortsword whose fortune shows as a lucky sparkle.
const luckBlade = design('Luck-symbol shortsword: a golden-edged thrust that leaves a brief glint of good fortune on the foe.', () => [
  lunge({ duration: 1000 }),
  swing('Golden shortsword thrust', ['shortsword.melee.01.yellow', 'shortsword.melee.01.white'], { delay: 500 }),
  accent('Glint of fortune', ['glint.yellow.few'], { scale: 0.7, duration: 1400 }),
]);
// Lyrakien staff: silver shaft, crystal sphere of shifting constellations, starlight glow.
const lyrakienStaff = design('Silver staff crowned with a constellation sphere: a starlit blue swing that scatters twinkling stars on contact.', () => [
  lunge(),
  swing('Starlit staff swing', ['quarterstaff.melee.01.blue', 'quarterstaff.melee.01.white']),
  accent('Constellation sparks', ['particle_burst.01.star.bluepurple'], { scale: 0.7, duration: 1600 }),
  accent('Starlight twinkle', ['twinkling_stars.points07.white'], { offset: 350, scale: 0.6, duration: 1500, opacity: 0.85 }),
]);
// Spore Shepherd staff: magically grown amanita mushroom.
const sporeStaff = design('Amanita-mushroom staff: a plain staff blow that puffs a cloud of pale spores from the cap.', () => [
  lunge(),
  swing('Mushroom staff swing', ['quarterstaff.melee.01.white']),
  accent('Spore puff', ['particles.002.001.complete.few.white', 'particles.002.001.complete.few.blue'], { scale: 0.75, duration: 2000, opacity: 0.8, ...tint('#e6d6a8') }),
]);
// Worldringer: a ringed khakkhara staff rather than a club.
const worldringer = design('Khakkhara staff topped with rings: a two-handed staff sweep with metal ring jangle instead of a club bash.', () => [
  lunge(),
  swing('Khakkhara sweep', ['quarterstaff.melee.01.white']),
], ABILITY('ironStaff'));
// Singing shortbow: gut string sings like an instrument, thundering arrow.
const singingShortbow = design('Gut-strung composite shortbow: the string sings a few notes on release and the thundering arrow lands with a sonic ring.', () => [
  motion('brace', 'source', { duration: 1250, distance: 0.1 }),
  cast('String sings', ['music_notations.beamed_quavers.blue'], { stageId: 'notes', delay: 450, duration: 1300, scale: 0.45, offsetY: -0.45, offsetUnits: 'token', fadeIn: 150, fadeOut: 400 }),
  travel('Arrow flight', ['arrow.physical.white.01'], { stageId: 'shot', delay: 625, duration: 2550, fadeOut: 120 }),
  onArrival('Thunder ring', ['shatter.blue'], { offset: 650, duration: 2200 }),
]);
// Splintered-free dark blades that drink light.
const darkBlade = (rationale, keys, label, o = {}) => design(rationale, () => [
  lunge(o.lunge),
  swing(label, keys, { ...tint(DARK), ...o.swing }),
  accent('Clinging shadow', ['smoke.puff.side.dark_black', 'smoke.puff.side.grey'], { scale: 0.6, opacity: 0.7, duration: 1600, ...tint('#241f2c') }),
]);
// Stargazer: telekinetic crystal ball that flies out and back.
const stargazerOrb = (label, o = {}) => projectile(label, ['dancing_light.blueteal'], { stageId: 'orb', delay: 300, duration: 800, scale: 0.35, fadeIn: 80, fadeOut: 80, ...o });

export default {
  // ── Luck Blades
  'pf2e:pIYlenaADKnxdp11:melee': luckBlade,
  'pf2e:C3vAFRWoeGbMQTAH:melee': luckBlade,

  // ── Lyrakien Staves
  'pf2e:fcRTJBvy1RqXr3ow:melee': lyrakienStaff,
  'pf2e:uepeQsiOEIqTyNsx:melee': lyrakienStaff,
  'pf2e:uX8urrzOQM5wdoTD:melee': lyrakienStaff,

  // Man-Feller: a cold-iron battle axe, not a hatchet.
  'pf2e:4ADeEQGQJR0ju2Nd:melee': design('Single-piece cold-iron battle axe: a full battleaxe chop instead of handaxe footage.', () => [
    lunge(),
    swing('Cold-iron battleaxe chop', ['melee_attack.02.battleaxe.01', 'handaxe.melee.standard.white'], { duration: 1800 }),
    stagger({ intensity: 0.6 }),
  ]),

  // Mattock of the Titans: 15-foot adamantine digging tool.
  'pf2e:WCWdJmR5tYO7Aulb:melee': design('A 15-foot adamantine mattock: an oversized overhead pick blow that slams down and cracks the ground under the foe.', () => [
    motion('slam', 'source', { stageId: 'slam', duration: 1400, intensity: 1 }),
    swing('Titanic pick blow', ['melee_attack.02.pickaxe.01', 'warhammer.melee.01.white'], { delay: 700, duration: 1800, scale: 1.6 }),
    accent('Ground cracks', ['impact.ground_crack.01.orange'], { offset: 250, scale: 0.8, duration: 2400, below: true, ...tint('#9a8f86') }),
    stagger({ intensity: 1 }),
  ]),

  // Mirrorblade: reflective khopesh.
  'pf2e:B18ZjBdOW7zBDzvX:melee': design('Mirror-bright khopesh: a curved hooking slash whose reflective surface flashes a mesmerizing glint.', () => [
    lunge(),
    swing('Khopesh slash', ['falchion.melee.01.white'], { duration: 2000 }),
    accent('Mirror glint', ['glint.blue.many', 'glint.yellow.many'], { scale: 0.7, duration: 1400, ...tint('#e8f2ff') }),
  ]),

  // Morning Glow: holy cold-iron elven curve blade shining with pale fire.
  'pf2e:JosogwNGybTSrH03:melee': design('Elven curve blade sheathed in pale holy fire: a white-flame arc that ends in a burst of sacred light.', () => [
    heavyLunge(),
    swing('Pale-fire curve blade', ['greatsword.melee.fire.white', 'greatsword.melee.standard.white'], { delay: 750, duration: 2600 }),
    accent('Holy light', ['divine_smite.target.yellowwhite', 'divine_smite.target.blueyellow'], { offset: 180, scale: 0.85, duration: 2200 }),
  ]),

  // Musket staves: the staff's own force / void magic tints the round.
  'pf2e:mfYwthsSMkDS8djw:ranged': design('Gunwitch musket staff of force: a black-powder shot whose round arrives wrapped in a violet force pulse.', () => [
    recoil(),
    muzzle(),
    shot('Force-charged round', ['bullet.01.purple', 'bullet.01.orange']),
    onArrival('Force pulse', ['impact.012.purple', 'impact.012.blue'], { scale: 0.6 }),
  ]),
  'pf2e:lsTTJ9GlHOu5o3bt:ranged': design('Gunwitch musket staff of void: a black-powder shot trailing a puff of deathly void-smoke at the target.', () => [
    recoil(),
    muzzle(),
    shot('Void-tainted round', ['bullet.02.purple', 'bullet.01.orange']),
    onArrival('Void wisp', ['smoke.puff.centered.dark_purple', 'smoke.puff.centered.grey'], { scale: 0.55, opacity: 0.85, duration: 1700, ...tint('#5b3f7a') }),
  ]),

  // Nightmare's Lament: rapier pistol of nightmare bone wreathed in dark smoke.
  'pf2e:ASjNBiQfQfWppPJc:ranged': design('Nightmare-bone rapier pistol: dark smoke curls from the weapon as it fires a red-flecked shot.', () => [
    recoil(),
    cast('Fuming wisps', ['smoke.puff.side.dark_black', 'smoke.puff.side.grey'], { delay: 200, duration: 1500, scale: 0.5, opacity: 0.6, faceTarget: true, fadeOut: 500, ...tint('#2b2430') }),
    muzzle({ delay: 380 }),
    shot('Red-flecked round', ['bullet.01.red', 'bullet.01.orange'], { delay: 420 }),
    onArrival('Round strikes', ['impact.005.dark_red', 'impact.005.orange'], { duration: 1450 }),
  ]),
  'pf2e:ASjNBiQfQfWppPJc:melee': design('Nightmare-bone rapier pistol used as a blade: a rapier thrust trailing thin wisps of dark smoke.', () => [
    lunge(),
    swing('Rapier thrust', ['rapier.melee.01.white']),
    accent('Dark smoke wisps', ['smoke.puff.side.dark_black', 'smoke.puff.side.grey'], { scale: 0.55, opacity: 0.65, duration: 1600, ...tint('#2b2430') }),
  ]),

  // Nodachi: JB2A has dedicated nodachi footage.
  'pf2e:KtarUneAx0hibGtW:melee': design('Exceptionally long nodachi blade: dedicated nodachi footage reaching out from the wielder.', () => [
    lunge({ duration: 1500, distance: 0.12 }),
    swing('Nodachi cut', ['melee_attack.05.nodachi.01', 'greatsword.melee.standard.white'], { delay: 750, duration: 2200, scale: 1.2 }),
  ]),

  // Orb Shard: golden crystal shard of the Orb of Gold Dragonkind.
  'pf2e:YjaXxg9uQ02IbwLi:melee': design('Pointed golden crystal shard of a dragon orb: a gold-edged thrust with a crystalline glint.', () => [
    lunge({ duration: 1000 }),
    swing('Crystal shard thrust', ['shortsword.melee.01.yellow', 'shortsword.melee.01.white'], { delay: 500 }),
    accent('Crystal glint', ['glint.yellow.few'], { scale: 0.65, duration: 1400 }),
  ]),

  // Phantom Fang: kama shrouded in spectral mist leaving afterimages.
  'pf2e:G1FOTNhO1qcPfRXW:melee': design('Cold-iron kama shrouded in spectral mist: the swing leaves shimmering afterimages of the wielder and a trail of mist.', () => [
    lunge({ duration: 1000 }),
    sprite('Shimmering afterimages', { delay: 150, duration: 1300, copies: 2, copySpread: 0.14, opacity: 0.25, fadeIn: 150, fadeOut: 700 }),
    swing('Kama hook', ['melee_attack.01.sickle.01'], { delay: 500, duration: 1700 }),
    accent('Spectral mist', ['smoke.puff.side.02.white'], { scale: 0.6, opacity: 0.55, duration: 1600, ...tint('#cfe0ef') }),
  ]),

  // Phase Spike: translucent astral spear.
  'pf2e:nPa8pxzjuVY0lKMp:melee': design('Astral spear with a partially translucent head: a ghostly blue thrust that ripples through the target.', () => [
    lunge(),
    swing('Translucent astral thrust', ['spear.melee.01.blue', 'spear.melee.01.white'], { opacity: 0.8 }),
    accent('Astral ripple', ['divine_smite.target.blueyellow'], { scale: 0.75, duration: 2000 }),
  ]),
  'pf2e:nPa8pxzjuVY0lKMp:thrown': design('Thrown astral spear: a translucent blue-tinted spear flight ending in an astral ripple.', () => [
    throwMotion(),
    flight('Translucent spear flight', ['spear.throw.01', 'dagger.throw.01.white'], { duration: 2150, opacity: 0.75, ...tint('#a9cfff') }),
    landed('Astral ripple', ['divine_smite.target.blueyellow'], { scale: 0.7, duration: 2000 }),
  ]),

  // Pick of Arcane Accuracy: head glows faintly at the tip.
  'pf2e:fOPWvucD6pY0dTbQ:melee': design('Combat pick whose head glows faintly at the tip: a pick blow that sparks a small arcane glint where it lands.', () => [
    lunge(),
    swing('Pick blow', ['melee_attack.02.pickaxe.01', 'warhammer.melee.01.white'], { duration: 1800 }),
    accent('Glowing tip', ['glint.blue.few', 'glint.yellow.few'], { scale: 0.55, duration: 1300 }),
  ]),

  // Reaper's Crescent: alabaster moon-sickle.
  'pf2e:Il75ytwHrdwAAOwe:melee': design('Alabaster moon-sickle: a crescent slash that leaves a pale moonlight flare, not a yellow flash.', () => [
    lunge({ duration: 1000 }),
    swing('Crescent slash', ['melee_attack.01.sickle.01'], { delay: 500, duration: 1700 }),
    accent('Moonlight flare', ['impact.007.white', 'impact.007.yellow'], { scale: 0.75, duration: 1450, ...tint('#d6e4ff') }),
  ]),

  // Reaper's Toll: decaying scythe, deathly cold, withering.
  "pf2e:YgsDUh6shTham38Q:melee": design('Decaying scythe, deathly cold and withering: a reaping arc that leaves a sickly puff of rot on the foe.', () => [
    heavyLunge(),
    swing('Reaping arc', ['melee_attack.05.scythe.01'], { delay: 750, duration: 1700, scale: 1.2 }),
    accent('Rot puff', ['smoke.puff.centered.dark_green', 'smoke.puff.centered.grey'], { scale: 0.6, opacity: 0.8, duration: 1800, ...tint('#5d6a3e') }),
    stagger(),
  ]),

  // Redeemer's Pistol: silvery steel glistening with radiant light.
  'pf2e:GKBCShgNVVhDiNCb:ranged': design('Silvery dueling pistol glistening with radiant light: a bright silver round that lands in a soft holy flare.', () => [
    recoil({ delay: 420 }),
    muzzle({ delay: 380 }),
    shot('Silver round', ['bullet.01.blue', 'bullet.03.blue'], { delay: 420 }),
    onArrival('Radiant flare', ['divine_smite.target.yellowwhite', 'divine_smite.target.blueyellow'], { scale: 0.55, duration: 2000 }),
  ]),

  // Revenant Blade: necromancer's void blade.
  'pf2e:hmtzclfmm1FTExNp:melee': design("Necromancer's void-touched sickle: a hooking slash that leaves a wisp of deathly purple smoke.", () => [
    lunge({ duration: 1000 }),
    swing('Sickle slash', ['melee_attack.01.sickle.01'], { delay: 500, duration: 1700 }),
    accent('Void wisp', ['smoke.puff.side.dark_purple', 'smoke.puff.side.grey'], { scale: 0.55, opacity: 0.75, duration: 1600, ...tint('#4a3a5c') }),
  ]),

  // Ridill: a 12-foot cyclops-forged dragon-killing sword.
  'pf2e:VJbZuJFTooFckp26:melee': design('A 12-foot cyclops-forged sword: an oversized two-handed cleave that rocks the target.', () => [
    heavyLunge({ distance: 0.22 }),
    swing('Colossal cleave', ['melee_attack.03.greatsword.02', 'greatsword.melee.standard.white'], { delay: 750, duration: 2550, scale: 1.6 }),
    stagger({ intensity: 1 }),
  ]),

  // Righteous Fury: gold-plated holy longsword of Ragathiel.
  'pf2e:sFeUlzkJ8GgcFRES:melee': design("Gold-plated holy longsword of Ragathiel: a golden arc that ends in a flare of holy light.", () => [
    lunge(),
    swing('Golden longsword arc', ['sword.melee.01.yellow', 'sword.melee.01.white']),
    accent('Holy flare', ['divine_smite.target.yellowwhite', 'divine_smite.target.blueyellow'], { scale: 0.85, duration: 2200 }),
  ]),

  // Rime Foil: steely blue frost rapier.
  'pf2e:py3PPoO2zMUjOzOI:melee': design('Steely-blue frost rapier: a blue thrust that crusts the wound with frost.', () => [
    lunge(),
    swing('Blue rapier thrust', ['rapier.melee.01.blue', 'rapier.melee.01.white']),
    accent('Frost crust', ['impact.frost.white.01'], { scale: 0.85, duration: 2600, clipEnd: 2600 }),
  ]),

  // Sawtooth Reaper: blood-red kusarigama with a crimson haze.
  'pf2e:6sjpO4ls3qMZcy2V:melee': design('Blood-red serrated kusarigama: a chained sickle whips out at reach, drawing blood amid a wafting crimson haze.', () => [
    lunge({ duration: 1500, distance: 0.12 }),
    swing('Kusarigama sickle', ['melee_attack.01.sickle.01'], { delay: 750, duration: 1700, ...tint('#c0303a') }),
    accent('Serrated wound', ['liquid.splash.red', 'liquid.splash02.red'], { scale: 0.8, duration: 2200 }),
    accent('Crimson haze', ['smoke.plumes.01.dark_red', 'smoke.puff.side.grey'], { offset: 300, scale: 0.6, opacity: 0.6, duration: 2000, ...tint('#8b1e2a') }),
    stagger(),
  ]),

  // Screech Shooter (Major): same terror-shrike larynx gun as the lesser models.
  'pf2e:v9smWWOsWFwhCZoB:ranged': design("Hand cannon built from a terror shrike's larynx: the shot shrieks out and bursts in a sonic shockwave.", () => [
    recoil({ distance: 0.14 }),
    muzzle(),
    shot('Shrieking shot', ['bullet.01.blue', 'bullet.03.blue']),
    onArrival('Sonic burst', ['shatter.blue'], { duration: 2200 }),
  ], ABILITY('enchanted-firearm-sonic')),

  // Shadow's Heart: kukri blade that absorbs light.
  'pf2e:VwNmUeRHomup8VoI:melee': darkBlade('Light-absorbing kukri: a darkened slash that leaves a smear of clinging shadow.', ['dagger.melee.02.white'], 'Light-drinking kukri slash', { lunge: { duration: 1000 }, swing: { delay: 500, duration: 1750, scale: 0.85 } }),

  // Shadowpiercer: moonlight on a ghost-touch spear.
  'pf2e:ehvsr3D5tgdyUF4E:melee': design('Ghost-touch spear gleaming with muted silver moonlight: a thrust that leaves a pale moonlit glint.', () => [
    lunge(),
    swing('Moonlit spear thrust', ['spear.melee.01.white']),
    accent('Moonlight glint', ['glint.blue.few', 'glint.yellow.few'], { scale: 0.6, duration: 1400, ...tint('#d6e4ff') }),
  ]),
  'pf2e:ehvsr3D5tgdyUF4E:thrown': design('Thrown moonlit ghost-touch spear: the spear flies and strikes with a pale moonlight glint.', () => [
    throwMotion(),
    flight('Spear flight', ['spear.throw.01', 'dagger.throw.01.white'], { duration: 2150 }),
    landed('Moonlight glint', ['glint.blue.few', 'glint.yellow.few'], { scale: 0.6, duration: 1400, ...tint('#d6e4ff') }),
  ]),

  // Shattered Plan: impactful boomerang that comes back.
  'pf2e:73JDNoUQPmUqjz97:thrown': design('Crack-veined impactful boomerang: it spins out, strikes with a jolt and curves back to the thrower.', () => [
    throwMotion(),
    flight('Boomerang out', ['boomerang.01.white.01.throw', 'dagger.throw.01.white']),
    landed('Impactful jolt', ['impact.005.white', 'impact.005.orange'], { scale: 0.7 }),
    travel('Boomerang returns', ['boomerang.01.white.01.return', 'dagger.return.01.white'], { after: 'flight', anchor: 'end', duration: 1800, travelOrigin: 'target', fadeOut: 120 }),
  ]),

  // Sinew-Song: ivory violin-bow sickle, music when swung.
  'pf2e:ctmmhe5ZOYx57gTt:melee': design('Ivory violin-bow sickle that plays soft violin music as it swings: notes trail the cut and the thundering rune rings on contact.', () => [
    lunge({ duration: 1000 }),
    cast('Violin notes', ['music_notations.quaver.blue'], { delay: 250, duration: 1300, scale: 0.4, offsetY: -0.45, offsetUnits: 'token', fadeIn: 150, fadeOut: 400 }),
    swing('Bow-blade slash', ['melee_attack.01.sickle.01'], { delay: 500, duration: 1700 }),
    accent('Thunder ring', ['shatter.blue'], { scale: 0.8, duration: 2200 }),
  ]),

  // Singing Shortbows.
  'pf2e:tVcI2ypPhfhchwMp:ranged': singingShortbow,
  'pf2e:ul4LuDff24Kz9n7e:ranged': singingShortbow,

  // Singing Sword: intelligent sword that sings.
  'pf2e:OKAR7GIyJac8dmsi:melee': design('Intelligent singing sword: it bursts into song as it strikes, notes swirling above the wielder.', () => [
    lunge(),
    cast('Sword sings', ['music_notations.treble_clef.purple', 'music_notations.treble_clef.blue'], { delay: 300, duration: 1500, scale: 0.45, offsetY: -0.5, offsetUnits: 'token', fadeIn: 150, fadeOut: 400 }),
    swing('Longsword arc', ['sword.melee.01.white']),
  ]),

  // Slime Whip: greasy slimy pseudopod.
  'pf2e:USzeQdvsXz6P5L2k:melee': design('Thick, greasy pseudopod whip: a slimy green lash that splatters ooze on contact.', () => [
    lunge({ distance: 0.12 }),
    swing('Slime lash', ['melee_generic.slashing.one_handed', 'melee_generic.slash.01.orange'], { duration: 1617, ...tint('#7fae4e') }),
    accent('Slime splatter', ['liquid.splash.green', 'liquid.splash.blue'], { scale: 0.65, duration: 2000, ...tint('#8fc06a') }),
  ]),

  // Smoking Sword: smoke belches from the blade.
  'pf2e:onFxlajKyWpHZcXt:melee': design('Longsword that constantly belches smoke: a smoky flaming arc trailed by a gout of dark smoke.', () => [
    lunge(),
    cast('Belching smoke', ['smoke.puff.side.dark_black', 'smoke.puff.side.grey'], { delay: 300, duration: 1600, scale: 0.6, opacity: 0.65, faceTarget: true, fadeOut: 500, ...tint('#3a3434') }),
    swing('Smoking blade arc', ['sword.melee.fire.orange', 'sword.melee.01.white']),
    accent('Ember finish', ['impact.fire.01.orange'], { scale: 0.75, duration: 2000 }),
  ]),

  // South Wind's Scorch Song: blackened flaming scimitar.
  'pf2e:8S81RvynBS09rIOF:melee': design('Blackened flaming scimitar with crackling carnelian flame lines: a fiery curved slash with a flame finish (fire sound, not radiant).', () => [
    lunge(),
    swing('Flaming scimitar slash', ['scimitar.melee.01.orange', 'scimitar.melee.01.white']),
    accent('Scorch', ['impact.fire.01.orange'], { scale: 0.85, duration: 2000 }),
  ], ABILITY('enchanted-sword-fire')),

  // Spellcutter: adamantine longsword that absorbs light.
  'pf2e:LKIs3LJqrKNP2yrx:melee': darkBlade('Adamantine longsword that absorbs the light around it: a shadowed arc that leaves the target briefly cloaked in gloom.', ['sword.melee.01.white'], 'Light-drinking longsword arc'),

  // Spiral Athame: tiny blue comet spiralling in the pommel.
  'pf2e:2WOpgJyaFE2gNW7H:melee': design('Silver ghost-touch athame with a tiny blue comet spiralling in its pommel: a dagger thrust trailed by a blue spiral of sparks.', () => [
    lunge({ duration: 1000 }),
    swing('Athame thrust', ['dagger.melee.02.white'], { delay: 500, duration: 1750, scale: 0.85 }),
    accent('Comet spiral', ['swirling_sparkles.01.blue'], { scale: 0.5, duration: 1600 }),
  ]),
  'pf2e:2WOpgJyaFE2gNW7H:thrown': design('Thrown silver athame: the dagger flies and its comet pommel spirals blue sparks on impact.', () => [
    throwMotion(),
    flight('Athame flight', ['dagger.throw.01.white']),
    landed('Comet spiral', ['swirling_sparkles.01.blue'], { scale: 0.5, duration: 1600 }),
  ]),

  // Spore Sap: sap of fungus stalks with spore-infused gills.
  'pf2e:tE2IarA29mYsgrxj:melee': design('Fungus-stalk sap bound around spore-infused gills: a soft bludgeon that bursts a puff of spores.', () => [
    lunge({ duration: 1000 }),
    swing('Sap blow', ['club.melee.01.white'], { delay: 500 }),
    accent('Spore burst', ['particles.002.001.complete.few.greenyellow', 'particles.002.001.complete.few.blue'], { scale: 0.7, duration: 2000, opacity: 0.85, ...tint('#b5c76a') }),
  ]),

  // Spore Shepherd's Staves.
  'pf2e:bTwZNckINJgiT8Ef:melee': sporeStaff,
  'pf2e:UEIwFJMx3wYt0Blp:melee': sporeStaff,
  'pf2e:7XEVXfgeabmO7fMd:melee': sporeStaff,

  // Stargazer: quartz crystal ball smashed telekinetically, returning.
  'pf2e:mkFrHOwWJaHF0aGp:melee': design('Quartz crystal ball smashed into a foe by telekinesis: the orb darts from the wielder\'s hand and strikes with a starry flash.', () => [
    motion('pulse', 'source', { duration: 800, intensity: 0.5 }),
    stargazerOrb('Crystal orb strikes'),
    impact('Starry flash', ['twinkling_stars.points07.white'], { after: 'orb', anchor: 'end', duration: 1400, scale: 0.6, fadeOut: 400 }),
    projectile('Orb returns', ['dancing_light.blueteal'], { after: 'orb', anchor: 'end', offset: 150, duration: 700, scale: 0.35, travelOrigin: 'target', fadeIn: 80, fadeOut: 80 }),
  ], ABILITY('club')),
  'pf2e:mkFrHOwWJaHF0aGp:thrown': design('Returning crystal ball hurled at range: the quartz orb flies out, strikes with a starry flash and returns to orbit.', () => [
    throwMotion(),
    stargazerOrb('Crystal orb flies', { stageId: 'flight', delay: 342, duration: 1200 }),
    impact('Starry flash', ['twinkling_stars.points07.white'], { after: 'flight', anchor: 'end', duration: 1400, scale: 0.6, fadeOut: 400 }),
    projectile('Orb returns', ['dancing_light.blueteal'], { after: 'flight', anchor: 'end', offset: 200, duration: 1100, scale: 0.35, travelOrigin: 'target', fadeIn: 80, fadeOut: 80 }),
  ]),

  // Tamchal Chakram (melee) was silent.
  'pf2e:kedgBVNDRAdmseRe:melee': design('Bladed urdefhan chakram swept in close combat: chakram footage with a blade-contact sound (was silent).', () => [
    lunge({ duration: 1000 }),
    swing('Chakram slash', ['melee_attack.01.chakram.01'], { delay: 500, duration: 1683 }),
  ], ABILITY('sword')),

  // Thorn Whip: woven plant-fibre whip with spikes, not a fist.
  'pf2e:2P9jItR1sV20OqmD:melee': design('Woven plant-fibre whip with small thorns: a green reaching lash (was a fist strike).', () => [
    lunge({ distance: 0.12 }),
    swing('Thorned lash', ['melee_generic.slashing.one_handed', 'melee_generic.slash.01.orange'], { duration: 1617, ...tint('#7fa35a') }),
  ], ABILITY('whip')),

  // Timeflaying Blade: acid that erodes matter away rather than liquid.
  'pf2e:8MD6Fwjjgb9cMXQb:melee': design('Orichalcum bastard sword forged around paradox shards: its corrosive damage erodes matter into drifting dust instead of splashing liquid.', () => [
    lunge(),
    swing('Orichalcum blade arc', ['sword.melee.01.orange', 'sword.melee.01.white']),
    accent('Matter erodes away', ['particles.002.001.complete.few.orangeyellow', 'particles.002.001.complete.few.blue'], { scale: 0.75, duration: 2200, ...tint('#d9b77a') }),
    accent('Eroded dust', ['smoke.puff.side.grey'], { offset: 350, scale: 0.55, opacity: 0.55, duration: 1600, ...tint('#bca27a') }),
  ], { fx: false }),

  // Twisting Gale: pale-blue impactful sansetsukon, howling winds.
  'pf2e:2iKqXkRAq8qwlFlT:melee': design('Pale-blue impactful sansetsukon that howls like wind when swung and hits with storm force.', () => [
    heavyLunge(),
    swing('Three-section staff whirl', ['melee_attack.01.flail.01'], { delay: 750, duration: 1683, scale: 1.2 }),
    accent('Howling wind', ['wind_lines.01.01.white'], { offset: 0, scale: 0.8, duration: 2000, opacity: 0.8, clipEnd: 2000 }),
    accent('Storm force', ['impact.012.blue'], { offset: 250, scale: 0.7, duration: 1500 }),
    stagger(),
  ]),

  // Venom Lash: multi-headed scorpion-tail flail.
  'pf2e:xeCh83loMuW7Aeqj:melee': design('Multi-headed flail of scorpion tails: flail footage and flail sound instead of a whip lash.', () => [
    lunge(),
    swing('Scorpion-tail flail', ['melee_attack.01.flail.01'], { duration: 1683 }),
    stagger({ intensity: 0.6 }),
  ], ABILITY('flail')),

  // Void Sickle: impossibly dark steel to which shadows cling.
  'pf2e:O7MVPau09FX898UG:melee': darkBlade('Ghost-touch sickle of impossibly dark, light-absorbing steel: a shadowed hooking slash with clinging shadows.', ['melee_attack.01.sickle.01'], 'Dark-steel sickle slash', { lunge: { duration: 1000 }, swing: { delay: 500, duration: 1700 } }),

  // Whisperer of Souls: brilliant (radiant) glaive, not fire.
  'pf2e:rft8qacTooqfsUIo:melee': design('Brilliant keen glaive: a reaching cut that flares with radiant light (the rune is brilliant, not flaming).', () => [
    lunge({ duration: 1500, distance: 0.12 }),
    swing('Glaive cut', ['glaive.melee.01.white'], { delay: 750, duration: 2400, scale: 1.2 }),
    accent('Brilliant flare', ['divine_smite.target.yellowwhite', 'divine_smite.target.blueyellow'], { scale: 0.85, duration: 2200 }),
    accent('Radiant spark', ['impact.007.yellow'], { offset: 300, scale: 0.6, duration: 1450 }),
  ]),

  // Windlass Bola: returning bola (return used dagger footage).
  'pf2e:hvMIJKY1mKXDmg1V:thrown': design('Clockwork returning bola: the weights whirl out, wrap the target briefly and spool back to the thrower.', () => [
    throwMotion(),
    flight('Bola flight', ['mace.throw', 'dagger.throw.01.white'], { duration: 2250 }),
    landed('Weights strike', ['impact.005.white', 'impact.005.orange']),
    aura('Cord wraps target', ['markers.chain.standard.complete.02.grey', 'markers.chain.standard.complete.02.red'], { subject: 'targets', after: 'flight', anchor: 'start', offset: 1000, duration: 1800, scale: 0.6, fadeOut: 400, ...tint('#b8a98a') }),
    travel('Bola spools back', ['mace.throw', 'dagger.return.01.white'], { after: 'flight', anchor: 'end', offset: 500, duration: 1800, travelOrigin: 'target', fadeOut: 120 }),
  ]),

  // Worldringer khakkharas.
  'pf2e:7L10GdJdL1hYcJZm:melee': worldringer,
  'pf2e:NvukdOaemuC6kMLL:melee': worldringer,
};
