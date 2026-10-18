// Bespoke compositions (pf2e-weapons-a). Keys: '<system>:<entryId>' or '<system>:<entryId>:<variant|mode>'.
// See scripts/catalogs/bespoke/helpers.mjs and scripts/bespoke.mjs.
import { cast, travel, projectile, impact, area, aura, sprite, motion, tint, spin, breathe, design } from './helpers.mjs';

// Weapon designs mostly keep the generated choreography (gesture, contact/flight,
// returns, accents) and patch or extend it. Generated stage ids are `${recipe.id}-<slot>`
// (motion, contact, flight, muzzle, accent, flavor1, residue, return …).
const ks = assets => assets.map(k => (k.startsWith('jb2a.') ? k : `jb2a.${k}`));
const sid = (r, slot) => `${r.id}-${slot}`;
const base = r => r.stages.filter(s => s.kind !== 'sound');
const has = (r, slot) => r.stages.some(s => s.stageId === sid(r, slot));
/** Patch generated stages by slot: { contact: {assets:[...]}, muzzle: null (drop) }. */
const patch = (r, patches) => base(r).flatMap(s => {
  const slot = Object.keys(patches).find(k => s.stageId === sid(r, k));
  if (!slot) return [s];
  const p = patches[slot];
  if (p === null) return [];
  return [{ ...s, ...p, ...(p.assets ? { assets: ks(p.assets) } : {}) }];
});
const hit = r => (has(r, 'contact') ? sid(r, 'contact') : sid(r, 'accent'));
const ABILITY = { soundNamespace: 'ability' };

// --- shared designs -------------------------------------------------------
const voidScatter = why => design(why, ({ recipe: r }) => [
  ...patch(r, {
    muzzle: { assets: ['muzzle_flash.single.01.yellow'], ...tint('#8a6bb0') },
    flight: { assets: ['bullet.01.purple', 'bullet.01.orange'], ...tint('#5a3f78') },
    accent: { assets: ['toll_the_dead.purple.skull_smoke', 'toll_the_dead.green.skull_smoke'], scale: 0.55, ...tint('#6b4a8a') },
  }),
  aura('Ashen powder smoke', ['smoke.puff.side.dark_black', 'smoke.puff.side.grey'], { after: sid(r, 'muzzle'), anchor: 'start', duration: 1400, scale: 0.5, opacity: 0.7, offsetX: 0.45, offsetUnits: 'token', fadeOut: 400 }),
]);

const airPuff = why => design(why, ({ recipe: r }) => [
  ...base(r),
  cast('Compressed-air puff', ['smoke.puff.side.02.white', 'smoke.puff.side.grey'], { after: sid(r, 'flight'), anchor: 'start', offset: -40, duration: 900, scale: 0.35, opacity: 0.6, faceTarget: true, fadeOut: 300 }),
]);

const crossbowCombo = why => design(why, ({ recipe: r }) => patch(r, {
  flight: { assets: ['bolt.physical.white', 'bolt.physical.orange'], label: 'crossbow bolt shot' },
  motion: { motion: 'recoil', distance: 0.05, duration: 600, delay: 565, label: 'Release kick' },
}), { sound: 'crossbow', ...ABILITY });

const bloodGlow = why => design(why, ({ recipe: r }) => [
  ...base(r),
  impact('Blade glows dull red', ['impact.007.red', 'impact.007.orange'], { after: sid(r, 'contact'), anchor: 'start', offset: 220, duration: 1100, scale: 0.55, opacity: 0.75, ...tint('#8a1c1c') }),
]);

const atmospheric = why => design(why, ({ recipe: r }) => [
  ...base(r),
  impact('Imposing boom', ['toll_the_dead.grey.shockwave', 'toll_the_dead.green.shockwave'], { after: sid(r, 'contact'), anchor: 'start', offset: 120, duration: 1300, scale: 0.7, opacity: 0.75, below: true, ...tint('#d8dde6') }),
  motion('stagger', 'targets', { after: sid(r, 'contact'), anchor: 'start', offset: 150, duration: 700, intensity: 0.6, distance: 0.08, requiresHit: true }),
]);

const composer = why => design(why, ({ recipe: r }) => [
  ...base(r),
  impact('Melodic hum', ['music_notations.beamed_quavers.purple', 'music_notations.beamed_quavers.blue'], { after: sid(r, 'contact'), anchor: 'start', offset: 200, duration: 1300, scale: 0.35, opacity: 0.85, offsetY: -0.35, offsetUnits: 'token', fadeOut: 400 }),
]);

const fluidForm = why => design(why, ({ recipe: r }) => [
  ...patch(r, { flavor1: null }),
  impact('Sand stirs in the orb', ['smoke.puff.centered.grey'], { after: sid(r, 'contact'), anchor: 'start', offset: 220, duration: 1200, scale: 0.45, opacity: 0.6, ...tint('#c9a96e') }),
]);

const blinkBladeMelee = why => design(why, ({ recipe: r }) => [
  ...base(r),
  impact('Portal shimmer', ['misty_step.02.blue', 'misty_step.01.blue'], { after: sid(r, 'contact'), anchor: 'start', offset: 150, duration: 1100, scale: 0.4, opacity: 0.7 }),
]);
const blinkBladeThrown = why => design(why, ({ recipe: r }) => [
  ...patch(r, { flight: { assets: ['dagger.throw.01.blue', 'dagger.throw.01.white'] } }),
  cast('Blade blinks away', ['misty_step.01.blue'], { after: sid(r, 'flight'), anchor: 'start', duration: 900, scale: 0.35, opacity: 0.8 }),
  impact('Blade blinks in', ['misty_step.02.blue', 'misty_step.01.blue'], { after: sid(r, 'accent'), anchor: 'start', offset: -150, duration: 1000, scale: 0.4, opacity: 0.8 }),
]);

const caydenShock = why => design(why, ({ recipe: r }) => [
  ...base(r),
  impact('Shockwave ripple', ['toll_the_dead.yellow.shockwave', 'toll_the_dead.green.shockwave'], { after: hit(r), anchor: 'start', offset: 100, duration: 1300, scale: 0.75, opacity: 0.8, below: true, ...tint('#ffd36b') }),
  motion('stagger', 'targets', { after: hit(r), anchor: 'start', offset: 120, duration: 700, intensity: 0.7, distance: 0.1, requiresHit: true }),
]);

export default {
  // Air Repeater / Long Air Repeater: pressurized air, not black powder.
  'pf2e:SzUynRs4HVtnpnel:ranged': airPuff('Pressurized air, not black powder: a soft white air puff at the barrel as the small metal bullet flies.'),
  'pf2e:Hc4qCwyO9i0Avlzt:ranged': airPuff('Long air repeater: a soft compressed-air puff at the barrel instead of a powder flash as the pellet flies.'),

  // Alchemical Gauntlet: small alchemical detonations on contact.
  'pf2e:JAOzIeqKr5hULumB:melee': design('The gauntlet "emits small alchemical detonations when it makes contact": the punch lands with a small orange pop.', ({ recipe: r }) => [
    ...base(r),
    impact('Alchemical detonation', ['explosion.01.orange'], { after: sid(r, 'contact'), anchor: 'start', offset: 120, duration: 1200, scale: 0.35, opacity: 0.9 }),
  ]),

  // Alghollthu Lash: tentacle whip that constantly drips slime.
  'pf2e:QyzNxesxaSdPo3Pd:melee': design('A fleshy tentacle whip that constantly drips slime: the lash leaves a splash of murky green slime on contact.', ({ recipe: r }) => [
    ...base(r),
    impact('Slime spatter', ['liquid.splash.green', 'liquid.splash.blue'], { after: sid(r, 'contact'), anchor: 'start', offset: 180, duration: 1300, scale: 0.45, opacity: 0.75, ...tint('#6f8f5a') }),
  ]),
  // Alghollthu Whip: aqudel tentacle strobing with small patterns of light.
  'pf2e:TIq0xuvRpIdPglsA:melee': design('An aqudel tentacle whip that "constantly strobes with small patterns of light": blue-teal light motes flicker along the lash on contact.', ({ recipe: r }) => [
    ...base(r),
    impact('Strobing light patterns', ['particles.002.001.complete.few.blueteal', 'particles.002.001.complete.few.blue'], { after: sid(r, 'contact'), anchor: 'start', offset: 120, duration: 1300, scale: 0.45, opacity: 0.85 }),
  ]),

  // Atmospheric Staff: strikes with an imposing boom.
  'pf2e:CPZC4rAHGkQqPLJ9:melee': atmospheric('Dense air staff that "strikes the ground with an imposing boom": a pale pressure ring booms out under the target, which staggers.'),
  'pf2e:SKKVjloic8hQbYo7:melee': atmospheric('Greater atmospheric staff: the blow lands with an imposing boom of displaced air and the target staggers.'),
  'pf2e:HarOsJI1p5oHt2Vd:melee': atmospheric('Lesser atmospheric staff: the blow lands with an imposing boom of displaced air and the target staggers.'),
  'pf2e:YMz8ZKeOmSU9VuKp:melee': atmospheric('Major atmospheric staff: the blow lands with an imposing boom of displaced air and the target staggers.'),

  // Black King: ashen blunderbuss with the void trait; Gray Prince: ruinous Ash Cult hand cannon.
  'pf2e:NS2j5bYEoHeESlyN:ranged': voidScatter('Ashen void blunderbuss: dark-violet muzzle flash and ashen smoke, dusky shot, and a void miasma bursting where it hits.'),
  'pf2e:IePXTa0jDjDqXxYl:ranged': voidScatter('Ash Cult ruinous hand cannon (void): a dusky violet discharge with ashen smoke and void miasma on contact.'),

  // Blink Blade: dagger etched with whirling portals (teleportation).
  'pf2e:tWoW1BeFrWm35hmV:melee': blinkBladeMelee('A dagger etched with whirling portals and a blue sapphire: a faint blue portal shimmer flickers where it strikes.'),
  'pf2e:tWoW1BeFrWm35hmV:thrown': blinkBladeThrown('The portal-etched blade blinks away from the hand in a blue shimmer and blinks back in just before it strikes.'),

  // Blood-Drinker Blade: glows dull red when it draws blood.
  'pf2e:V9e6G1ZolN7Ncg7g:melee': bloodGlow('"Whenever the blade draws blood, it glows with a dull red energy": a dull crimson glow pulses at the wound.'),
  'pf2e:vtPf23T4O6fPIF4P:melee': bloodGlow('Greater blood-drinker blade: wounding bleed plus the dull red glow of a blade tasting blood.'),

  // Branch of the Great Sugi: a living tree branch used as a whip.
  'pf2e:h7RtjyqHouB3pGgr:melee': design('A living sugi branch lashed like a whip: green needles and leaves scatter from the snapping branch on contact.', ({ recipe: r }) => [
    ...base(r),
    impact('Living leaves scatter', ['swirling_leaves.outburst.01.greenorange', 'swirling_leaves.outburst.01.pink'], { after: sid(r, 'contact'), anchor: 'start', offset: 150, duration: 1400, scale: 0.45, opacity: 0.9, ...tint('#5f8f4a') }),
  ]),

  // Calamity: greatsword hewn from a solid block of ensorcelled stone.
  'pf2e:YqhEmz8dmf02b99u:melee': design('A monumental greatsword hewn from ensorcelled stone: the blow crunches with rock fragments and a ground crack, and the target staggers.', ({ recipe: r }) => [
    ...base(r),
    impact('Stone shards', ['impact.boulder.01', 'impact.ground_crack.01.orange'], { after: sid(r, 'contact'), anchor: 'start', offset: 150, duration: 1300, scale: 0.4, opacity: 0.9 }),
    impact('Ground crack', ['impact.ground_crack.01.orange'], { after: sid(r, 'contact'), anchor: 'start', offset: 200, duration: 1600, scale: 0.6, opacity: 0.7, below: true, ...tint('#9a8f80') }),
    motion('stagger', 'targets', { after: sid(r, 'contact'), anchor: 'start', offset: 150, duration: 800, intensity: 0.8, distance: 0.1, requiresHit: true }),
  ]),

  // Castrovel's Beacon: brilliant cold-iron rapier with a flickering green light.
  'pf2e:y5ibQXac9BbzrYoT:melee': design('The brilliant rapier tip "shines with a flickering sheen of green light" like Castrovel: green-lit thrust and a green radiant finish.', ({ recipe: r }) => patch(r, {
    contact: { assets: ['rapier.melee.fire.green', 'rapier.melee.01.white'] },
    accent: { assets: ['impact.fire.01.orange'], ...tint('#6fdc7a') },
  })),

  // Cayden's Tankard: returning shockwave light hammer.
  'pf2e:LMKw9PCVGeZy7knY:melee': caydenShock('A divine tankard that works as a shockwave light hammer: a golden shockwave ripples out from the blow and the target staggers.'),
  'pf2e:LMKw9PCVGeZy7knY:thrown': caydenShock('The thrown shockwave tankard lands with a golden ripple, staggers the target, and returns to the wielder.'),

  // Combination weapons whose ranged half is a crossbow, not a bow.
  'pf2e:KaYvuSNXZaOammij:ranged': crossbowCombo('Crescent cross: an arm-mounted crossbow holding three bolts, so it fires a bolt with a crossbow kick, not a drawn arrow.'),
  'pf2e:cSGWhw4Wn6Z98tVK:ranged': crossbowCombo('Lancer: the grip holds two crossbow fixtures, so it looses a crossbow bolt with a small kick rather than an arrow.'),

  // Composer Staff: hums melodically when waved.
  'pf2e:6TC4FywUTzVAK97v:melee': composer('A conductor\'s-baton staff that "hums melodically" when waved: a small flutter of music notes rises from the blow.'),
  'pf2e:KSHZBPFxPD6uCZXM:melee': composer('Greater composer staff: the humming baton leaves a small flutter of music notes on contact.'),
  'pf2e:pBPVm5JjKfKX8gaX:melee': composer('Major composer staff: the humming baton leaves a small flutter of music notes on contact.'),

  // Cythbikian Staff: rotting wood riddled with mold and fungal growths.
  'pf2e:XnlYH66ZA7RR3QgR:melee': design('A gnarled staff of rotting, mold-riddled wood: a puff of murky green spores bursts from the fungal growths on impact.', ({ recipe: r }) => [
    ...base(r),
    impact('Spore puff', ['smoke.puff.centered.dark_green', 'smoke.puff.centered.grey'], { after: sid(r, 'contact'), anchor: 'start', offset: 180, duration: 1400, scale: 0.5, opacity: 0.7, ...tint('#7d8a4a') }),
  ]),

  // Dart: larger than an arrow, shorter than a javelin.
  'pf2e:Tt4Qw64fwrxhr5gT:thrown': design('A dart is "larger than an arrow but shorter than a javelin": a small thrown dart flight instead of a full javelin.', ({ recipe: r }) => patch(r, {
    flight: { assets: ['dart.01.throw.physical.white', 'dagger.throw.01.white'], label: 'dart flight' },
  })),

  // Dezullon Fountain: living pitcher-plant air repeater that spits acid.
  'pf2e:kP51e5Ul3Q1fusSg:ranged': design('A living dezullon pitcher used as an air repeater: no powder flash, just a spurt of acid from the pitcher and a green acid shot.', ({ recipe: r }) => [
    ...patch(r, { muzzle: null }),
    cast('Pitcher spurts acid', ['liquid.splash_side.green', 'liquid.splash_side.blue'], { after: sid(r, 'flight'), anchor: 'start', offset: -60, duration: 1000, scale: 0.35, opacity: 0.85, faceTarget: true, ...tint('#9ad35a') }),
  ]),

  // Dragonfire Halfbow: bow layered with fire-dragon scales (fire trait).
  'pf2e:ergvi4pLRMndtiQj:ranged': design('A halfbow laminated with fire-dragon scales (fire trait): the arrow streaks with flame before its fiery finish.', ({ recipe: r }) => patch(r, {
    flight: { assets: ['arrow.fire.orange', 'arrow.physical.white.01'] },
  })),

  // Explosive Dogslicer melee: still a dogslicer (short goblin blade), not a greatsword.
  'pf2e:cFHUt5tTA7jVPtRh:melee': design('In melee the explosive dogslicer is a short, crude goblin blade: a quick sword slash, not a two-handed greatsword arc.', ({ recipe: r }) => patch(r, {
    contact: { assets: ['sword.melee.01.white'], label: 'dogslicer contact', scale: 1, delay: 500 },
    motion: { distance: 0.14, duration: 1000 },
  }), { sound: 'sword', ...ABILITY }),

  // Faultline Hammer: its strikes can shatter stone.
  'pf2e:CIglJOSgO3HsBqUP:melee': design('A cracked earthbreaker whose "strikes can shatter stone": the blow splits the ground beneath the target, which staggers.', ({ recipe: r }) => [
    ...base(r),
    impact('Faultline crack', ['impact.ground_crack.02.orange', 'impact.ground_crack.01.orange'], { after: sid(r, 'contact'), anchor: 'start', offset: 150, duration: 1700, scale: 0.7, opacity: 0.75, below: true, ...tint('#a39a8a') }),
    motion('stagger', 'targets', { after: sid(r, 'contact'), anchor: 'start', offset: 150, duration: 800, intensity: 0.8, distance: 0.1, requiresHit: true }),
  ]),

  // Fire Poi: ignited spinning poi.
  'pf2e:rfP9e1fnwjnIQSJK:melee': design('Fire poi are ignited before use: the whirling weighted poi lands trailing flame.', ({ recipe: r }) => [
    ...base(r),
    impact('Burning poi trail', ['impact.fire.01.orange'], { after: sid(r, 'contact'), anchor: 'start', offset: 120, duration: 1300, scale: 0.5, opacity: 0.9 }),
  ]),

  // Flingflenser: fires a cluster of circular blades with a black-powder packet.
  'pf2e:EPhsyiO4jYl0jWoC:ranged': design('A goblin tube that launches a cluster of circular blades on a black-powder packet: powder flash, then a spinning blade disc flies.', ({ recipe: r }) => patch(r, {
    flight: { assets: ['chakram.01.throw.01', 'bullet.01.orange'], label: 'circular blade cluster', scale: 0.7 },
  })),

  // Fluid Form Staff: glass orb of fine sand (no water involved).
  'pf2e:B71BgdfFApkYmAjc:melee': fluidForm('The staff\'s glass orb holds fine sand, not water: a light sandy dust swirls from the blow instead of a water splash.'),
  'pf2e:bQynfb23iexSu8zU:melee': fluidForm('Greater fluid form staff: sandy dust from the orb replaces the unrelated water splash.'),
  'pf2e:smrNvKVL976JNEab:melee': fluidForm('Major fluid form staff: sandy dust from the orb replaces the unrelated water splash.'),

  // Fulmination Fang melee: it is a gun sword, so the blade is sword-sized.
  'pf2e:ja4phrX3anThH7hx:melee': design('Fulmination Fang is a gun sword: its melee strike is a heavy sword cut, not a dagger stab.', ({ recipe: r }) => patch(r, {
    contact: { assets: ['melee_attack.03.greatsword.02', 'greatsword.melee.standard.white'], label: 'gun sword contact', scale: 1.2 },
  }), { sound: 'greatsword', ...ABILITY }),

  // Gloom Blade: coal-black blade that grows stronger in darkness.
  'pf2e:w5ZX1R3dPvuLcuRx:melee': design('A coal-black blade that grows more potent in darkness: a wisp of shadow trails the thrust.', ({ recipe: r }) => [
    ...base(r),
    impact('Shadow wisp', ['smoke.puff.centered.dark_black', 'smoke.puff.centered.grey'], { after: sid(r, 'contact'), anchor: 'start', offset: 180, duration: 1200, scale: 0.45, opacity: 0.75, ...tint('#2e2a36') }),
  ]),

  // Gravedigger's Call: rusted shovel used as a decaying (void) glaive.
  'pf2e:GQHPI84ilXlglr27:melee': design('A rusted gravedigger\'s shovel that works as a decaying glaive: the cut leaves a puff of grave-dark void miasma.', ({ recipe: r }) => [
    ...base(r),
    impact('Decay miasma', ['toll_the_dead.purple.skull_smoke', 'toll_the_dead.green.skull_smoke'], { after: sid(r, 'contact'), anchor: 'start', offset: 200, duration: 1500, scale: 0.5, opacity: 0.8, ...tint('#5d4a6e') }),
  ]),

  // Holy Water: a thrown vial of blessed water.
  'pf2e:z9T4c1hXwOotsMCp:thrown': design('A thrown vial of blessed water: the glass shatters, holy water splashes, and a soft divine glow rises.', ({ recipe: r }) => [
    ...patch(r, { flight: { assets: ['throwable.throw.flask.02.blue', 'throwable.throw.flask.01.orange'], scale: 0.75 }, accent: { scale: 0.55, opacity: 0.85 } }),
    impact('Holy water splash', ['water_splash.circle.01.blue'], { after: sid(r, 'accent'), anchor: 'start', offset: -80, duration: 1300, scale: 0.45, opacity: 0.85, ...tint('#cfe8ff') }),
    impact('Glass fragments', ['explosion.top_fracture.flask.01'], { after: sid(r, 'accent'), anchor: 'start', offset: -40, duration: 1000, scale: 0.6, opacity: 0.6 }),
  ], { sound: 'bomb-water', ...ABILITY }),

  // Hundred-Moth Caress: slicing releases a fluttering gust of moths.
  'pf2e:RZkttcpkv4qLs1Lk:melee': design('"When you slice with it, a fluttering gust of hundreds of moths\' wingbeats fills the air": dusky moths burst outward from the scythe cut.', ({ recipe: r }) => [
    ...base(r),
    impact('Moth gust', ['butterflies.outward_burst.01.white', 'butterflies.outward_burst.01.bluepurple'], { after: sid(r, 'contact'), anchor: 'start', offset: 150, duration: 1800, scale: 0.6, opacity: 0.85, ...tint('#a89f8c') }),
  ]),

  // Hydrocannon: water-producing organ, no ammunition or powder.
  'pf2e:iaZOReFQgGsKok3Q:ranged': design('A hand cannon wrapped in a grodair\'s water organ that needs no ammunition: a water burst at the barrel, a water slug, and a splash.', ({ recipe: r }) => [
    ...patch(r, {
      muzzle: null,
      flight: { assets: ['bullet.03.blue'], label: 'water slug', ...tint('#7fc4ff') },
      accent: { assets: ['water_splash.circle.01.blue', 'impact.water.02.blue'], scale: 0.5, duration: 1600, fadeOut: 400 },
    }),
    cast('Water burst', ['water_splash.cone.01.blue'], { after: sid(r, 'flight'), anchor: 'start', offset: -60, duration: 900, scale: 0.3, opacity: 0.85, faceTarget: true }),
  ], { sound: 'water' }),

  // Kusarigama: a kama on a weighted chain.
  'pf2e:D6E4VaKVG05G26Rm:melee': design('The kusarigama is a kama (sickle) on a weighted chain: a curved sickle cut instead of a dagger stab.', ({ recipe: r }) => patch(r, {
    contact: { assets: ['melee_attack.01.sickle.01'], label: 'kama contact', scale: 1 },
  })),
};
