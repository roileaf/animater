// Bespoke compositions (sf2e-b). Keys: '<system>:<entryId>' or '<system>:<entryId>:<variant|mode>'.
// See scripts/catalogs/bespoke/helpers.mjs and scripts/bespoke.mjs.
import { cast, travel, projectile, impact, area, aura, sprite, motion, tint, spin, breathe, design } from './helpers.mjs';

// ---- key helpers -----------------------------------------------------------
const F = id => `sf2e:sf2e-feat-${id}`;
const W = id => `sf2e:sf2e-weapon-equipment-${id}`;
const ABILITY = { soundNamespace: 'ability' };
const IMP = ['impact.005.white', 'impact.005.orange'];
const sci = (n, col, kind = 'complete') => `markers_scifi.00${n}.${kind}.001.${col}`;

// ---- shared building blocks -----------------------------------------------
// Single aimed gunshot: lock-on reticle, muzzle flash, round, hit, recoil.
const gun = (o = {}) => [
  ...(o.aim === false ? [] : [impact('Target lock', [sci(1, o.mark ?? 'orangeyellow')], { stageId: 'aim', scale: 0.65, opacity: 0.85, duration: 900 })]),
  cast('Muzzle flash', ['muzzle_flash.single.01.yellow'], { stageId: 'flash', delay: o.aim === false ? 0 : 450, scale: 0.7, duration: 600 }),
  travel('Round', o.round ?? ['bullet.01.orange'], { stageId: 'shot', after: 'flash', anchor: 'start', duration: 900, ...(o.shotOpts ?? {}) }),
  impact('Hit', o.hit ?? IMP, { stageId: 'hit', after: 'shot', anchor: 'arrival', duration: 900, scale: o.hitScale ?? 0.8, ...(o.hitOpts ?? {}) }),
  motion('recoil', 'source', { after: 'flash', anchor: 'start', duration: 450, intensity: o.kick ?? 0.5 }),
  ...(o.targetMotion ? [motion(o.targetMotion, 'targets', { after: 'shot', anchor: 'arrival', duration: 750, intensity: 0.5 })] : []),
  ...(o.extra ?? []),
];
// Area Fire / Auto-Fire: burst muzzle, a spray of rounds into every target, rattling hits.
const autoFire = (o = {}) => [
  cast('Muzzle burst', ['muzzle_flash.burst.01.yellow', 'muzzle_flash.single.01.yellow'], { stageId: 'burst', scale: 0.85, duration: 1300 }),
  travel('Spray of rounds', o.round ?? ['bullet.03.orange', 'bullet.02.orange'], { stageId: 'spray', after: 'burst', anchor: 'start', offset: 100, duration: 800, repeats: o.repeats ?? 3, repeatInterval: 220, targetStagger: 120 }),
  impact('Rounds strike', o.hit ?? IMP, { stageId: 'hits', after: 'spray', anchor: 'arrival', duration: 800, scale: 0.7, repeats: o.repeats ?? 3, repeatInterval: 220, targetStagger: 120 }),
  motion('shake', 'source', { after: 'burst', anchor: 'start', duration: 1000, intensity: 0.35 }),
  ...(o.extra ?? []),
];
// Envoy directive: a holo command signal at the envoy and a marker on the chosen creature.
const directive = (col, label, o = {}) => [
  cast('Command signal', [sci(2, col)], { stageId: 'cmd', scale: 0.8, duration: 1300 }),
  impact(label, [sci(1, col)], { stageId: 'mark', after: 'cmd', anchor: 'start', offset: 400, duration: 1500, scale: 0.8, optionalTargets: true, ...(o.markOpts ?? {}) }),
  motion('pulse', 'source', { after: 'cmd', anchor: 'start', duration: 700, intensity: 0.3 }),
  ...(o.extra ?? []),
];
// Feint: a fake lunge, a sidestep, and the target flinching off guard.
const feint = (o = {}) => [
  ...(o.pre ?? []),
  motion('lunge', 'source', { stageId: 'fake', delay: o.delay ?? 0, duration: 500, intensity: 0.35 }),
  impact('Misdirection', ['wind_lines.01.01.white'], { stageId: 'open', after: 'fake', anchor: 'start', offset: 200, duration: 1000, scale: 0.6, optionalTargets: true }),
  motion('dodge', 'source', { after: 'fake', anchor: 'end', duration: 600, intensity: 0.3, distance: 0.3, motionRange: 'distance', motionHeading: 'left' }),
  motion('stagger', 'targets', { after: 'open', anchor: 'start', offset: 300, duration: 700, intensity: 0.3 }),
];
// Dropping prone: stumble, flinch to the floor, a puff of dust.
const dropProne = (o = {}) => [
  motion('stagger', 'source', { stageId: 'fall', duration: 600, intensity: 0.6 }),
  motion('cower', 'source', { after: 'fall', anchor: 'end', duration: 900, intensity: 0.55 }),
  cast('Dust as you hit the floor', ['smoke.puff.side.grey'], { stageId: 'dust', after: 'fall', anchor: 'end', duration: 1100, scale: 0.6, below: true }),
  ...(o.extra ?? []),
];
// Tucking into a shell/plates: hunch, plates clack shut.
const tuck = (o = {}) => [
  ...(o.link ? [] : [motion('cower', 'source', { stageId: 'tuck', duration: 900, intensity: 0.5 })]),
  cast('Plates lock', IMP, { stageId: 'clack', after: o.link ?? 'tuck', anchor: 'start', offset: 250, scale: 0.55, duration: 800 }),
  aura('Hardened shell', ['icon.shield.blue', 'shield.01.complete.01.blue'], { after: 'clack', anchor: 'start', offset: 150, duration: 1600, scale: 0.5, opacity: 0.75, offsetY: -0.55, offsetUnits: 'token', fadeIn: 200, fadeOut: 400 }),
  ...(o.extra ?? []),
];
// Physical grapple: reach, grip, the target struggles.
const grab = (o = {}) => [
  ...(o.pre ?? []),
  motion('lunge', 'source', { stageId: 'reach', delay: o.delay ?? 0, duration: 600, intensity: 0.5 }),
  impact('Grip', ['unarmed_strike.physical.01.orange', 'unarmed_strike.physical.01.blue'], { stageId: 'grip', after: 'reach', anchor: 'start', offset: 250, duration: 900, scale: 0.7 }),
  motion('shake', 'targets', { after: 'grip', anchor: 'start', duration: 900, intensity: 0.4 }),
];
// Defensive spines: the body bristles and the attacker is pricked.
const spines = (o = {}) => [
  motion(o.puff ? 'pulse' : 'shake', 'source', { stageId: 'flex', duration: 600, intensity: o.puff ? 0.6 : 0.4 }),
  impact('Spines pierce', ['melee_generic.piercing.one_handed', 'spear.melee.01.white'], { stageId: 'prick', after: 'flex', anchor: 'start', offset: 200, duration: 1000, scale: 0.7 }),
  motion('recoil', 'targets', { after: 'prick', anchor: 'start', offset: 250, duration: 650, intensity: 0.5 }),
  ...(o.extra ?? []),
];
// Gliding descent.
const glide = (o = {}) => [
  cast(o.label ?? 'Catch the air', o.assets ?? ['wind_lines.01.01.white'], { stageId: 'air', scale: 0.8, duration: 1400, ...(o.castOpts ?? {}) }),
  motion('drift', 'source', { after: 'air', anchor: 'start', offset: 200, duration: 2200, intensity: 0.5 }),
];
// Colour-shifting camouflage.
const camo = (col = 'green') => [
  cast('Pigments shift', [`shimmer.01.${col}`, 'shimmer.01.blue'], { stageId: 'shift', duration: 1500, scale: 1 }),
  sprite('Body fades into the background', { after: 'shift', anchor: 'start', offset: 300, duration: 1500, opacity: 0.35, fadeIn: 300, fadeOut: 600 }),
];
// Psychic jolt into one target's mind.
const mindJolt = (o = {}) => [
  cast('Thoughts focus', ['eyes.01.purple.single', 'eyes.01.dark_green.single'], { stageId: 'focus', scale: 0.6, offsetY: -0.5, offsetUnits: 'token', duration: 900 }),
  travel('Telepathic link', ['energy_strands.range.standard.purple.01'], { stageId: 'link', after: 'focus', anchor: 'start', offset: 300, duration: 1100 }),
  impact(o.label ?? 'Mind jolted', o.hit ?? ['toll_the_dead.purple.shockwave', 'toll_the_dead.green.shockwave'], { stageId: 'jolt', after: 'link', anchor: 'arrival', duration: 1200, scale: 0.8 }),
  motion(o.targetMotion ?? 'stagger', 'targets', { after: 'jolt', anchor: 'start', duration: 700, intensity: 0.35 }),
];
// Mouth/body squirt of fluid at a target.
const squirt = (col, label, o = {}) => [
  cast('Squirt', [`liquid.splash_side.${col}`, 'liquid.splash_side.blue'], { stageId: 'spit', scale: 0.5, duration: 700, ...(o.castTint ?? {}) }),
  projectile('Fluid flies', ['liquid.blob.' + (o.blob ?? col), 'liquid.blob.blue'], { stageId: 'fly', after: 'spit', anchor: 'start', offset: 150, duration: 700, scale: 0.4, ...(o.castTint ?? {}) }),
  impact(label, [`liquid.splash.${col}`, o.free ?? 'liquid.splash.blue'], { stageId: 'splat', after: 'fly', anchor: 'arrival', duration: 1100, scale: 0.8, ...(o.castTint ?? {}) }),
  motion('recoil', 'targets', { after: 'splat', anchor: 'start', duration: 600, intensity: 0.4 }),
];
// Flash grenade: arc, white-gold blinding flash, afterglow, targets flinch.
const flashBang = (mode) => [
  travel('Grenade arc', ['throwable.throw.bomb.01.grey', 'throwable.throw.bomb.01.black'], { stageId: 'toss', duration: 900 }),
  mode === 'area'
    ? area('Blinding flash fills the burst', ['explosion.03.yellow', 'explosion.03.blueyellow'], { stageId: 'flash', after: 'toss', anchor: 'arrival', duration: 1300, ...tint('#fff3c4') })
    : impact('Blinding flash', ['explosion.03.yellow', 'explosion.03.blueyellow'], { stageId: 'flash', after: 'toss', anchor: 'arrival', duration: 1300, scale: 1.1, ...tint('#fff3c4') }),
  impact('Afterglow', ['markers.light.complete.yellow', 'markers.light.complete.blue'], { after: 'flash', anchor: 'start', offset: 250, duration: 1500, scale: 1, opacity: 0.75, optionalTargets: true, ...tint('#fff6dc') }),
  motion('throw', 'source', { duration: 700 }),
  motion('cower', 'targets', { after: 'flash', anchor: 'start', offset: 100, duration: 900, intensity: 0.45 }),
];
// Fury/adrenaline: red surge and a swelling pulse.
const fury = (o = {}) => [
  cast(o.label ?? 'Fury surges', ['cast_generic.01.dark_red', 'cast_generic.fire.01.orange'], { stageId: 'surge', duration: 1100 }),
  aura(o.auraLabel ?? 'Seething aura', ['energy_strands.overlay.dark_red', 'energy_strands.overlay.blue.01'], { after: 'surge', anchor: 'start', offset: 400, duration: 2000, scale: 1.1, opacity: 0.8, fadeIn: 300, fadeOut: 500, ...tint('#c0392b') }),
  motion('pulse', 'source', { after: 'surge', anchor: 'start', offset: 300, duration: 900, intensity: o.grow ?? 0.35 }),
];
// Glitchy Gap blink.
const gapBlink = (o = {}) => [
  cast('Static flash', ['static_electricity.02.purple', 'static_electricity.02.blue'], { stageId: 'static', duration: 900, scale: 0.9 }),
  aura('Reality glitches', [sci(2, 'purplered')], { after: 'static', anchor: 'start', offset: 150, duration: 1200, scale: 0.9, opacity: 0.8 }),
  motion('flicker', 'source', { after: 'static', anchor: 'start', offset: 100, duration: 1000, intensity: 0.6 }),
  ...(o.extra ?? []),
];

export default {
  // ===== Feats & actions =====================================================
  [F('feats-nIwH5MjTHCkQe7C6')]: design('Explosive Deflection: a snap shot detonates the incoming grenade early; the blast blooms short of you while you brace.', () => [
    cast('Snap shot', ['muzzle_flash.single.01.yellow'], { stageId: 'flash', scale: 0.7, duration: 600 }),
    cast('Grenade detonates mid-air', ['explosion.01.orange'], { stageId: 'boom', after: 'flash', anchor: 'start', offset: 250, duration: 1300, scale: 0.7, offsetX: 1.1, offsetUnits: 'token' }),
    motion('recoil', 'source', { after: 'flash', anchor: 'start', duration: 450, intensity: 0.5 }),
    motion('brace', 'source', { after: 'boom', anchor: 'start', duration: 800, intensity: 0.45 }),
  ], { sound: 'explosion' }),
  [F('feats-BUt7LSUaHTmjtKIx')]: design('Extend Directive repeats last turn\'s order with a single word: a quick holo command ping.', () => directive('orangeyellow', 'Order repeated')),
  [F('feats-vO9uljpsyAyjDe5h')]: design('Fan the Hammer holds the trigger down for a second Area Fire/Auto-Fire burst: muzzle burst and a spray of rounds at every target.', () => autoFire({ repeats: 4 })),
  [F('feats-IoPJIOFRBFM2sSQ4')]: design('Fatal Error wields the Gap to muddle a creature\'s existence: glitch static gathers, then corrupted sci-fi markers and static flicker the target in and out.', () => [
    cast('The Gap stirs', ['static_electricity.03.dark_purple', 'static_electricity.03.blue'], { stageId: 'gap', duration: 1000 }),
    impact('Existence corrupts', [sci(2, 'purplered')], { stageId: 'err', after: 'gap', anchor: 'start', offset: 500, duration: 1600, scale: 1 }),
    impact('Static tears at the target', ['static_electricity.01.dark_purple', 'static_electricity.01.blue'], { after: 'err', anchor: 'start', offset: 150, duration: 1400, scale: 0.9 }),
    motion('flicker', 'targets', { after: 'err', anchor: 'start', offset: 200, duration: 1100, intensity: 0.6 }),
  ], { sound: 'void' }),
  [F('feats-Q6vXNDmTwDom59GV')]: design('Feign Death: you drop prone and play dead; a stumble, collapse and puff of dust, no magic.', () => dropProne(), { fx: false }),
  [F('actions-3In9EAqKoYiCDmz4')]: design('Feign Prone: you pretend to be tripped and drop, then Feint the triggering foe.', () => [
    ...dropProne(),
    impact('Feint catches the foe off guard', ['wind_lines.01.01.white'], { after: 'dust', anchor: 'start', offset: 300, duration: 1000, scale: 0.6, optionalTargets: true }),
    motion('stagger', 'targets', { after: 'dust', anchor: 'start', offset: 500, duration: 700, intensity: 0.3 }),
  ], { fx: false }),
  [F('actions-QNAVeNKtHA0EUw4X')]: design('Feint: a misleading flourish within reach; a fake lunge and sidestep leave the target flinching off guard.', () => feint(), { fx: false }),
  [F('ancestry-features-jjVH7W3IhgaJ5Yct')]: design('Fire Breath exhales ignited gases in a 15-foot cone: the flame cone fills the template.', () => [
    cast('Gases ignite', ['cast_generic.fire.side01.orange', 'cast_generic.fire.01.orange'], { stageId: 'ign', scale: 0.7, duration: 700 }),
    area('Cone of flame', ['breath_weapons.fire.cone.orange.01'], { stageId: 'cone', after: 'ign', anchor: 'start', offset: 300, duration: 2200 }),
    motion('lunge', 'source', { after: 'ign', anchor: 'start', duration: 600, intensity: 0.3 }),
  ]),
  [F('feats-YjzC7qufs8F739ac')]: design('Flickering Existence: you vanish and reappear 10 feet away in a flash of static.', () => [
    cast('Flash of static', ['static_electricity.02.blue'], { stageId: 'static', duration: 900, scale: 0.9 }),
    motion('flicker', 'source', { after: 'static', anchor: 'start', duration: 700, intensity: 0.6 }),
    motion('dodge', 'source', { after: 'static', anchor: 'start', offset: 450, duration: 700, intensity: 0.4, distance: 2, motionRange: 'distance', motionEndpoint: 'near' }),
    sprite('Static afterimage', { after: 'static', anchor: 'start', offset: 300, duration: 900, opacity: 0.4, fadeOut: 500 }),
  ]),
  [F('feats-hyl5HlC7YNxTmUPT')]: design('Fluid Anatomy: your gelatinous barathu body redistributes the critical blow; a wobble of fluid instead of a magic sigil.', () => [
    impact('Blow sinks in', ['liquid.splash.bright_purple', 'liquid.splash.blue'], { stageId: 'sink', subject: 'source', duration: 1100, scale: 0.7 }),
    motion('brace', 'source', { duration: 800, intensity: 0.3 }),
    motion('pulse', 'source', { after: 'sink', anchor: 'start', offset: 300, duration: 900, intensity: 0.3 }),
  ], { fx: false }),
  [F('feats-UF45fuzJXbl04r2b')]: design('Fog of War: Area/Auto-Fire whose flash and smoke leave a concealing cloud in the area.', () => autoFire({ extra: [
    area('Smoke and dust linger', ['smoke.plumes.01.grey'], { after: 'hits', anchor: 'start', offset: 200, duration: 3000, opacity: 0.8, fadeIn: 400, fadeOut: 800 }),
  ] })),
  [F('feats-3pKkqpj3tlefnJ83')]: design('For the Queen! channels the hive queen\'s telepathy: a psychic pulse links up to 10 allies, who surge with quickened battle frenzy.', () => [
    cast('Queen\'s call', ['eyes.01.purple.many', 'eyes.01.dark_green.many'], { stageId: 'call', scale: 0.8, duration: 1200 }),
    travel('Telepathic links', ['energy_strands.range.multiple.purple.01'], { stageId: 'link', after: 'call', anchor: 'start', offset: 300, duration: 1100, optionalTargets: true }),
    impact('Battle frenzy', ['energy_strands.overlay.dark_red', 'energy_strands.overlay.blue.01'], { after: 'link', anchor: 'arrival', duration: 1500, scale: 0.9, optionalTargets: true, ...tint('#d04a3a') }),
    motion('pulse', 'targets', { after: 'link', anchor: 'arrival', duration: 800, intensity: 0.35 }),
  ], { fx: false }),
  [F('actions-SjmKHgI7a5Z9JzBx')]: design('Force Open uses body or crowbar to pry or smash: a hard slam and a burst of debris, not an arcane circle.', () => [
    motion('slam', 'source', { stageId: 'heave', duration: 800, intensity: 0.6 }),
    cast('Wrenching impact', ['impact.ground_crack.01.white', 'impact.ground_crack.01.orange'], { after: 'heave', anchor: 'start', offset: 350, duration: 1200, scale: 0.6, offsetX: 0.6, offsetUnits: 'token' }),
    cast('Debris', ['smoke.puff.side.grey'], { after: 'heave', anchor: 'start', offset: 400, duration: 1100, scale: 0.6, offsetX: 0.6, offsetUnits: 'token' }),
  ], { fx: false }),
  [F('feats-CSAHq7DUJIKqUH3B')]: design('Fractal-Lite: your body and gear break apart into many small independent pieces; particles scatter and the form flickers amorphous.', () => [
    cast('Body fragments', ['particles.002.001.complete.many.blueteal', 'particles.002.001.complete.many.blue'], { stageId: 'frag', duration: 1500 }),
    sprite('Scattered silhouette', { after: 'frag', anchor: 'start', offset: 200, duration: 1300, opacity: 0.4, fadeOut: 500 }),
    motion('flicker', 'source', { after: 'frag', anchor: 'start', offset: 200, duration: 900, intensity: 0.5 }),
  ], { sound: 'transform' }),
  [F('feats-TzaICdHvT6I8RMTP')]: design('Frenzy: you fly into a reckless rage to protect allies; red fury, not a protective shield.', () => fury()),
  [F('feats-gTCYsKSoM3LbRlm5')]: design('Frilled Vesk Glide: the neck frill catches the air for a slow forward glide.', () => glide()),
  [F('actions-cmCtfURzpbzkxWsy')]: design('Get \'Em! singles out an enemy for allies to focus on: a holo target designator locks onto the foe (the optional Lead by Example Strike is not assumed).', () => directive('purplered', 'Target designated', { markOpts: { targetSelection: 'first' } })),
  [F('feats-LCc4hWg33Gh1cOdO')]: design('Gift of Gadrathar manipulates gravity on your own body to fly: a gravity field gathers and you lift off.', () => [
    cast('Gravity bends', ['energy_strands.in.purple', 'energy_strands.in.green.01'], { stageId: 'grav', duration: 1100 }),
    aura('Gravity field', ['energy_strands.complete.dark_purple', 'energy_strands.complete.blue.01'], { after: 'grav', anchor: 'start', offset: 400, duration: 1800, scale: 1, opacity: 0.8, below: true }),
    motion('levitate', 'source', { after: 'grav', anchor: 'start', offset: 400, duration: 1800, intensity: 0.5 }),
  ], { fx: false }),
  [F('feats-xw5BdDRtGmiQ5edm')]: design('Glitter Cloud: you shake a cloud of glitter from your fur that conceals you, then move.', () => [
    cast('Fur shakes', ['swirling_sparkles.01.bluepink', 'swirling_sparkles.01.blue'], { stageId: 'shake', duration: 1300 }),
    aura('Glitter cloud', ['twinkling_stars.points07.white'], { after: 'shake', anchor: 'start', offset: 200, duration: 2000, scale: 1.3, opacity: 0.85, fadeOut: 600 }),
    motion('shake', 'source', { duration: 600, intensity: 0.4 }),
    motion('rush', 'source', { after: 'shake', anchor: 'start', offset: 700, duration: 1600, intensity: 0.4, distance: 1, motionRange: 'distance', motionEndpoint: 'near' }),
  ]),
  [F('feats-2zE1Q9TSj5utOTJz')]: design('Go to Ground! orders allies to find cover; a cover-alert holo ping and you drop low behind cover.', () => [
    cast('Take-cover alert', [sci(2, 'blueteal')], { stageId: 'cmd', scale: 0.8, duration: 1300 }),
    motion('cower', 'source', { after: 'cmd', anchor: 'start', offset: 300, duration: 900, intensity: 0.45 }),
  ]),
  [F('feats-T3ixjulUFeTudoz1')]: design('Goring Rush: a charge of up to two Strides ending in a single horns Strike.', () => [
    motion('rush', 'source', { stageId: 'charge', duration: 1600, intensity: 0.5, motionRange: 'target', motionEndpoint: 'near' }),
    impact('Horns gore', ['melee_generic.piercing.two_handed', 'spear.melee.01.white'], { stageId: 'gore', after: 'charge', anchor: 'end', duration: 1100 }),
    motion('lunge', 'source', { after: 'charge', anchor: 'end', duration: 500, intensity: 0.6 }),
    motion('stagger', 'targets', { after: 'gore', anchor: 'start', offset: 200, duration: 700, intensity: 0.5 }),
  ]),
  [F('actions-3yoajuKjwHZ9ApUY')]: design('Grab an Edge: falling, you catch a handhold; a jolting stop and a scrape of dust.', () => [
    motion('stagger', 'source', { stageId: 'slip', duration: 500, intensity: 0.5 }),
    motion('brace', 'source', { after: 'slip', anchor: 'end', duration: 700, intensity: 0.5 }),
    cast('Scrape of grit', ['smoke.puff.side.grey'], { after: 'slip', anchor: 'end', duration: 1000, scale: 0.5 }),
  ], { fx: false }),
  [F('actions-PMbdMWc2QroouFGD')]: design('Grapple: a physical grab with a free hand; reach, grip, the target struggles (no magic fields).', () => grab(), { fx: false }),
  [F('feats-Io08S9xtxr9zmfBg')]: design('Grapple Dance: a kasathan acrobatic grapple using the foe\'s weight; a spinning step into the hold.', () => grab({ pre: [motion('spin', 'source', { stageId: 'twirl', duration: 700, intensity: 0.4 })], delay: 500 }), { fx: false }),
  [F('feats-tE1t3fwt4ukbfZ8f')]: design('Guilt Trip: a heartbreaking look of disappointment shames the attacker, who recoils sickened with guilt.', () => [
    cast('Look of utter disappointment', ['eyes.01.bluegreen.single', 'eyes.01.dark_green.single'], { stageId: 'look', scale: 0.55, offsetY: -0.5, offsetUnits: 'token', duration: 1200 }),
    impact('Shame', ['icon.horror.teal', 'icon.horror.purple'], { stageId: 'shame', after: 'look', anchor: 'start', offset: 450, duration: 1400, scale: 0.6, offsetY: -0.5, offsetUnits: 'token' }),
    motion('cower', 'targets', { after: 'shame', anchor: 'start', duration: 900, intensity: 0.4 }),
  ], { fx: false }),
  [F('actions-Wt3PzHoo3BauvifP')]: design('Gunk Spray spews caustic chemicals in a 30-foot cone: an acid spray fills the cone.', () => [
    cast('Chemicals spew', ['liquid.splash_side.green', 'liquid.splash_side.blue'], { stageId: 'spew', scale: 0.6, duration: 700 }),
    area('Caustic cone', ['breath_weapons.poison.cone.green'], { stageId: 'cone', after: 'spew', anchor: 'start', offset: 250, duration: 2200, ...tint('#9fe05a') }),
    motion('lunge', 'source', { after: 'spew', anchor: 'start', duration: 600, intensity: 0.3 }),
  ]),
  [F('feats-Nh1QHQqbLXcMLRdo')]: design('Hampering Flare: a ranged solar flare Strike; a golden helix bolt with a dazzling hit instead of a 4-second beam.', () => [
    cast('Flare gathers', ['ranged_helix.cast.001.orangeyellow', 'ranged_helix.cast.001.blue'], { stageId: 'gather', duration: 800 }),
    travel('Solar flare', ['ranged_helix.Helix_only.001.orangeyellow', 'ranged_helix.Helix_only.001.blue'], { stageId: 'flare', after: 'gather', anchor: 'start', offset: 350, duration: 1000 }),
    impact('Disorienting flash', ['ranged_helix.hit.001.orangeyellow', 'ranged_helix.hit.001.blue'], { after: 'flare', anchor: 'arrival', duration: 1000 }),
    motion('stagger', 'targets', { after: 'flare', anchor: 'arrival', duration: 700, intensity: 0.4 }),
  ]),
  [F('feats-SXwlRiQ9jlMw55gu')]: design('Head Fake: two faces and conflicting body language mislead the foe in a Feint, not a slash.', () => feint(), { sound: null }),
  [F('actions-XMcnh4cSI32tljXa')]: design('Hide: you huddle behind cover to become hidden; you crouch and fade, no Strike.', () => [
    motion('cower', 'source', { stageId: 'crouch', duration: 900, intensity: 0.45 }),
    sprite('Fading from view', { after: 'crouch', anchor: 'start', offset: 300, duration: 1400, opacity: 0.3, fadeIn: 200, fadeOut: 700 }),
  ], { fx: false }),
  [F('actions-8zWFGKRXg1SxIwFH')]: design('Holo-Roger: your fearsome holo-flag projects above you and you Demoralize a foe who sees it.', () => [
    aura('Holo-flag projects', [sci(2, 'purplered')], { stageId: 'flag', duration: 2400, scale: 0.9, offsetY: -0.8, offsetUnits: 'token', fadeIn: 300, fadeOut: 500 }),
    impact('Dread', ['icon.fear.dark_red', 'icon.fear.dark_purple'], { stageId: 'fear', after: 'flag', anchor: 'start', offset: 700, duration: 1400, scale: 0.6, offsetY: -0.5, offsetUnits: 'token' }),
    motion('cower', 'targets', { after: 'fear', anchor: 'start', duration: 900, intensity: 0.4 }),
  ]),
  [F('feats-PbzJ5W8sNtC4CYZH')]: design('Hostile Gravity crushes a creature with intense gravitational pressure: gravity strands, cracking ground under the target, a crushing press.', () => [
    cast('Gravity gathers', ['energy_strands.in.purple', 'energy_strands.in.green.01'], { stageId: 'grav', duration: 1000 }),
    impact('Gravity well', ['energy_strands.complete.dark_purple', 'energy_strands.complete.blue.01'], { stageId: 'well', after: 'grav', anchor: 'start', offset: 500, duration: 1600 }),
    impact('Ground buckles', ['impact.ground_crack.01.purple', 'impact.ground_crack.01.orange'], { after: 'well', anchor: 'start', offset: 300, duration: 1400, below: true }),
    motion('press', 'targets', { after: 'well', anchor: 'start', offset: 250, duration: 1100, intensity: 0.6 }),
  ]),
  [F('actions-e7Io0ZnzHuFD6yek')]: design('Hug the World lashes out at every foe in reach with grapples or limb Strikes: a spin and a lashing impact on each enemy.', () => [
    motion('spin', 'source', { stageId: 'lash', duration: 900, intensity: 0.5 }),
    impact('Limbs lash each foe', ['melee_generic.bludgeoning.one_handed', 'melee_generic.creature_attack.fist.001.red'], { stageId: 'hits', after: 'lash', anchor: 'start', offset: 250, duration: 1000, targetStagger: 150 }),
    motion('stagger', 'targets', { after: 'hits', anchor: 'start', offset: 250, duration: 700, intensity: 0.4 }),
  ], { sound: 'unarmed', ...ABILITY }),
  [F('feats-qKU2thbKGqrpplnD')]: design('Hull Hop: internal hydraulics launch you to fly; a hiss of vented pressure and lift-off, not feathers.', () => [
    cast('Hydraulic vent', ['smoke.puff.ring.01.white'], { stageId: 'vent', duration: 1000, below: true }),
    motion('levitate', 'source', { after: 'vent', anchor: 'start', offset: 200, duration: 1600, intensity: 0.5 }),
  ]),
  [F('feats-EXWB1hJSFddD1MYf')]: design('Hunker Down: you drop prone beneath your thick exoskeleton as the shooting starts.', () => [...dropProne(), ...tuck({ link: 'dust' })], { fx: false }),
  [F('feats-SJATkfqF5IeTwBRd')]: design('Hurl Ally: you pick up an adjacent ally and throw them across the battlefield.', () => [
    motion('throw', 'source', { stageId: 'heave', duration: 800 }),
    motion('leap', 'targets', { after: 'heave', anchor: 'start', offset: 250, duration: 1300, intensity: 0.5, distance: 3, motionRange: 'distance', motionHeading: 'away' }),
    cast('Heave', ['wind_lines.01.01.white'], { after: 'heave', anchor: 'start', duration: 900, scale: 0.6 }),
  ]),
  [F('feats-DDFbyNAIiKOuKTHi')]: design('I\'m the Real One! changes shape into the creature you\'re grappling with; a shapeshift shimmer and flicker.', () => [
    cast('Flesh reshapes', ['shimmer.01.purple', 'shimmer.01.blue'], { stageId: 'shift', duration: 1500 }),
    motion('flicker', 'source', { after: 'shift', anchor: 'start', offset: 200, duration: 900, intensity: 0.4 }),
  ]),
  [F('feats-SytxyomsOyZ7ZZ41')]: design('Immediate Relaxation: you go limp as you are hit, falling prone and stunned.', () => dropProne(), { fx: false }),
  [F('feats-aPdE8ly9vQWxiRDC')]: design('Independent LFAN boots an onboard AI that quickens your LFAN strikes: a tech HUD ring spins up.', () => [
    cast('AI boots', [sci(1, 'blueteal')], { stageId: 'boot', duration: 1300 }),
    aura('Targeting assist', [sci(1, 'blueteal', 'loop')], { after: 'boot', anchor: 'start', offset: 500, duration: 1800, scale: 1.1, opacity: 0.75, fadeIn: 300, fadeOut: 500 }),
    motion('pulse', 'source', { after: 'boot', anchor: 'start', offset: 400, duration: 700, intensity: 0.25 }),
  ], { sound: 'electric' }),
  [F('feats-WpJCB3dCycbIzG3w')]: design('Infernal Armaments infuse your weapons with the might of Hell: hellfire kindles and wreathes you.', () => [
    cast('Hellfire kindles', ['cast_generic.fire.01.orange'], { stageId: 'kindle', duration: 1000, ...tint('#c0392b') }),
    aura('Infernal wreath', ['energy_strands.overlay.dark_red', 'energy_strands.overlay.blue.01'], { after: 'kindle', anchor: 'start', offset: 400, duration: 2000, opacity: 0.8, fadeOut: 500, ...tint('#b03020') }),
  ], { sound: 'fire' }),
  [F('feats-OW9hFz5K37LJVlOT')]: design('Infinite Ammo Trick: reality forgets the shot was fired; a gunshot whose muzzle glitches with Gap static.', () => gun({ mark: 'purplered', extra: [cast('Reality forgets the round', ['static_electricity.01.dark_purple', 'static_electricity.01.blue'], { after: 'flash', anchor: 'start', duration: 900, scale: 0.6 })] })),
  [F('feats-k6nITfPqPA04zc6K')]: design('Inheritor of Star\'s Glory dons your progenitor star\'s power as a crown and grows: a solar crown flares and you swell.', () => [
    cast('Starlight gathers', ['markers.light.complete.yellow', 'markers.light.complete.blue'], { stageId: 'star', duration: 1300 }),
    aura('Stellar crown', ['dancing_light.yellow'], { after: 'star', anchor: 'start', offset: 400, duration: 2000, scale: 0.5, offsetY: -0.6, offsetUnits: 'token', fadeIn: 300, fadeOut: 500 }),
    motion('pulse', 'source', { after: 'star', anchor: 'start', offset: 500, duration: 1200, intensity: 0.6 }),
  ], { sound: 'light' }),
  [F('feats-zdycsO9Z0wHBZ17k')]: design('Intimidating Shot: you Demoralize by firing your weapon into the air.', () => [
    cast('Shot into the air', ['muzzle_flash.single.01.yellow'], { stageId: 'flash', scale: 0.7, duration: 600, rotation: -90, offsetY: -0.4, offsetUnits: 'token' }),
    motion('recoil', 'source', { after: 'flash', anchor: 'start', duration: 450, intensity: 0.5 }),
    impact('Dread', ['icon.fear.dark_red', 'icon.fear.dark_purple'], { after: 'flash', anchor: 'start', offset: 500, duration: 1400, scale: 0.6, offsetY: -0.5, offsetUnits: 'token', optionalTargets: true }),
    motion('cower', 'targets', { after: 'flash', anchor: 'start', offset: 550, duration: 900, intensity: 0.4 }),
  ], { sound: 'gunshotAir', ...ABILITY }),
  [F('feats-8EnKNTqKEZJBoIQb')]: design('Intimidating Taunt: you mercilessly taunt one enemy; a menacing lean-in and a fear icon on the foe.', () => [
    motion('lunge', 'source', { stageId: 'lean', duration: 600, intensity: 0.3 }),
    impact('Taunted', ['icon.fear.dark_red', 'icon.fear.dark_purple'], { stageId: 'fear', after: 'lean', anchor: 'start', offset: 300, duration: 1400, scale: 0.6, offsetY: -0.5, offsetUnits: 'token' }),
    motion('cower', 'targets', { after: 'fear', anchor: 'start', duration: 900, intensity: 0.35 }),
  ]),
  [F('actions-1lkfbLoteDlzoqxb')]: design('Into Position! calls allies to Step or Stride relative to a chosen enemy: a holo threat marker on the foe.', () => directive('blueteal', 'Threat marked', { markOpts: { targetSelection: 'first' } }), { sound: null }),
  [F('feats-WcDJMMPoAO2v26TN')]: design('Iomedae\'s Barrage auto-fires a celestial plasma cannon in a cone or line of holy fire: a golden plasma burst fills the area.', () => [
    cast('Cannon charges', ['muzzle_flash.burst.01.yellow', 'muzzle_flash.single.01.yellow'], { stageId: 'charge', scale: 0.9, duration: 1000 }),
    area('Holy plasma barrage', ['breath_weapons02.burst.cone.holy.yellow.01', 'breath_weapons.fire.cone.orange.01'], { stageId: 'barrage', after: 'charge', anchor: 'start', offset: 300, duration: 2400, ...tint('#ffd36b') }),
    motion('shake', 'source', { after: 'charge', anchor: 'start', duration: 1200, intensity: 0.35 }),
  ]),
  [F('feats-0POzibw3YsB8kH4w')]: design('Izalraan Hunter\'s Shot: a shot that also Points Out the prey to allies; gunfire then a locator marker on the target.', () => gun({ extra: [impact('Prey pointed out', [sci(1, 'greenyellow')], { after: 'hit', anchor: 'start', offset: 300, duration: 1500, scale: 0.85 })] }), { sound: 'firearm', ...ABILITY }),
  [F('feats-TZKrG7tDOkrAhsPR')]: design('Jolted Alive: you eat the electricity that hit you, crackling with energizing current instead of raising a shield.', () => [
    aura('Current absorbed', ['static_electricity.01.yellow', 'static_electricity.01.blue'], { stageId: 'zap', duration: 1600, scale: 1 }),
    motion('shake', 'source', { duration: 700, intensity: 0.4 }),
    cast('Energized', ['healing_generic.200px.yellow', 'healing_generic.200px.green'], { after: 'zap', anchor: 'start', offset: 700, duration: 1300, scale: 0.8 }),
  ]),
  [F('actions-oRdDgSC3RVpNgisd')]: design('Keep on Keeping On! boosts the next healing an ally receives: a green holo med-marker on that ally.', () => directive('greenyellow', 'Ally rallied')),
  [F('feats-dp3jTnxAb98E2BCk')]: design('Kindle Blaze: after taking fire damage you glow from within with light and heat for a minute.', () => [
    cast('Inner fire kindles', ['cast_generic.fire.01.orange'], { stageId: 'kindle', duration: 1100 }),
    aura('Glowing from within', ['markers.light.complete.yellow', 'markers.light.complete.blue'], { after: 'kindle', anchor: 'start', offset: 400, duration: 2200, scale: 1.3, opacity: 0.8, below: true, fadeOut: 600, ...tint('#ffb347') }),
    motion('pulse', 'source', { after: 'kindle', anchor: 'start', offset: 400, duration: 800, intensity: 0.3 }),
  ]),
  [F('feats-U9AtNbpmav4v6ZPh')]: design('Latch On: one jaws Strike against the creature you already hold in your jaws.', () => [
    impact('Jaws bite', ['bite.200px.orange', 'bite.200px.red'], { stageId: 'bite', duration: 1100 }),
    motion('lunge', 'source', { duration: 500, intensity: 0.5 }),
    motion('shake', 'targets', { after: 'bite', anchor: 'start', offset: 250, duration: 700, intensity: 0.4 }),
  ], { sound: 'naturalPierce', ...ABILITY }),
  [F('feats-jFoJmmNMtllYamak')]: design('Let\'s Jam: an android drops the bass with built-in instruments and allies move to the beat.', () => [
    cast('Bass drops', ['soundwave.01.purple', 'soundwave.01.blue'], { stageId: 'bass', duration: 1200 }),
    aura('Music swirls', ['music_notations.beamed_quavers.purple', 'music_notations.beamed_quavers.blue'], { after: 'bass', anchor: 'start', offset: 300, duration: 1800, scale: 0.6, offsetY: -0.5, offsetUnits: 'token', fadeOut: 500 }),
    motion('pulse', 'source', { after: 'bass', anchor: 'start', duration: 900, intensity: 0.3 }),
  ]),
  [F('feats-TbHoIKZdGtHaS9Ct')]: design('Light \'Em Up sprays Area/Auto-Fire toward an unseen enemy to reveal it: a burst of rounds and a reveal marker.', () => autoFire({ extra: [impact('Position revealed', [sci(1, 'orangeyellow')], { after: 'hits', anchor: 'start', offset: 300, duration: 1400, scale: 0.85, targetSelection: 'first' })] })),
  [F('feats-gtYPdUsrTehjcbxZ')]: design('Line \'em Up: a single trick shot that passes through every creature in a line: one long round striking each target in turn.', () => [
    impact('Line up', [sci(1, 'orangeyellow')], { stageId: 'aim', scale: 0.65, duration: 900, targetSelection: 'last' }),
    cast('Muzzle flash', ['muzzle_flash.single.01.yellow'], { stageId: 'flash', delay: 450, scale: 0.75, duration: 600 }),
    travel('Penetrating round', ['bullet.Snipe.orange', 'bullet.Snipe.blue'], { stageId: 'shot', after: 'flash', anchor: 'start', duration: 1000, targetSelection: 'last' }),
    impact('Pierces each creature', IMP, { after: 'shot', anchor: 'arrival', duration: 900, scale: 0.8, targetStagger: 90 }),
    motion('recoil', 'source', { after: 'flash', anchor: 'start', duration: 450, intensity: 0.6 }),
  ]),
  [F('actions-nPn7rGTTao4cFYDr')]: design('Living Capsule: you inflate to Huge with stored oxygen, a breathable bubble for others in zero gravity.', () => [
    cast('Body inflates', ['bubble.001.001.complete.blue'], { stageId: 'swell', duration: 1500, scale: 1.4 }),
    motion('pulse', 'source', { after: 'swell', anchor: 'start', duration: 1300, intensity: 0.7 }),
  ]),
  [F('actions-XYLK5aZ2WAMJGRAc')]: design('Living Submersible: you swell to Huge, filled with oxygenated fluid to carry others underwater.', () => [
    cast('Body fills with water', ['bubble.002.001.complete.blue', 'bubble.001.001.complete.blue'], { stageId: 'swell', duration: 1500, scale: 1.4 }),
    motion('pulse', 'source', { after: 'swell', anchor: 'start', duration: 1300, intensity: 0.7 }),
  ]),
  [F('feats-3ecQQrB0spzN1rGu')]: design('Make a Tiny Target: you pull your limbs into your protective shell.', () => tuck(), { fx: false }),
  [F('feats-d8ekF23HTScyOrbr')]: design('Meditative Analysis is a Recall Knowledge meditation on a foe\'s cosmic role, not a Strike: starlight focus and a mark on the foe.', () => [
    cast('Cosmic meditation', ['markers.light.complete.yellow', 'markers.light.complete.blue'], { stageId: 'med', duration: 1300 }),
    impact('Foe understood', ['eyes.01.dark_yellow.single', 'eyes.01.dark_green.single'], { after: 'med', anchor: 'start', offset: 500, duration: 1300, scale: 0.6, offsetY: -0.5, offsetUnits: 'token' }),
  ], { sound: null, fx: false }),
  [F('actions-KhX0FDMxGVgHjXdU')]: design('Mini-Nova: reduced to 0 HP, you release a burst of stellar fire in an emanation around you as you fall.', () => [
    cast('Stellar core flares', ['markers.light.complete.yellow', 'markers.light.complete.blue'], { stageId: 'flare', duration: 800 }),
    area('Nova burst', ['explosion.04.orange', 'explosion.01.orange'], { stageId: 'nova', after: 'flare', anchor: 'start', offset: 400, duration: 1800 }),
    motion('stagger', 'source', { after: 'nova', anchor: 'start', offset: 500, duration: 900, intensity: 0.5 }),
  ]),
  [F('feats-IdP7WH78GovkzKrd')]: design('Mournful Howl: a keening howl of sorrow forces nearby enemies to share your heartbreak.', () => [
    cast('Keening howl', ['soundwave.02.purple', 'soundwave.02.blue'], { stageId: 'howl', duration: 1400, scale: 1.2 }),
    impact('Heartbreak', ['toll_the_dead.purple.shockwave', 'toll_the_dead.green.shockwave'], { after: 'howl', anchor: 'start', offset: 400, duration: 1300, scale: 0.8, targetStagger: 120 }),
    motion('cower', 'targets', { after: 'howl', anchor: 'start', offset: 500, duration: 900, intensity: 0.35 }),
  ], { sound: 'howl', ...ABILITY }),
  [F('actions-DQSW4YEotxrLJIEl')]: design('Mucous Spurt: you spurt built-up mucus down the biting creature\'s throat.', () => squirt('green', 'Mucus splatter')),
  [F('actions-bQsL08HI1h8W0s2B')]: design('Multi-Legged Recovery: two legs buckle but the other four keep you standing; a stumble and recovery, no attack.', () => [
    motion('stagger', 'source', { stageId: 'buckle', duration: 600, intensity: 0.6 }),
    motion('brace', 'source', { after: 'buckle', anchor: 'end', duration: 700, intensity: 0.5 }),
    cast('Feet dig in', ['smoke.puff.side.grey'], { after: 'buckle', anchor: 'end', duration: 1000, scale: 0.5, below: true }),
  ], { fx: false }),
  [F('feats-BK1xOBi8FSrt5Lfg')]: design('Muzzle Flash: an aimed shot whose blinding flash leaves the target dazzled.', () => gun({ targetMotion: 'cower', extra: [impact('Dazzling flare', ['impact.006.yellow'], { after: 'hit', anchor: 'start', duration: 900, scale: 0.7 })] })),
  [F('feats-PYOgmegDpeiynDiK')]: design('Nanite Armament Boost pours nanites into your weapon so it deals electricity: crackling nanite current runs over you.', () => [
    cast('Nanites flow', [sci(1, 'blue')], { stageId: 'flow', duration: 1200 }),
    aura('Electrified weapon', ['static_electricity.02.blue'], { after: 'flow', anchor: 'start', offset: 400, duration: 1800, scale: 0.9, fadeOut: 500 }),
  ]),
  [F('feats-OlSfsaJSE4Lk7wkt')]: design('Nanite Form: you dissolve into a Huge flying swarm of nanites.', () => [
    cast('Body disperses', ['particles.002.001.complete.many.white', 'particles.002.001.complete.many.blue'], { stageId: 'disperse', duration: 1500, scale: 1.4 }),
    sprite('Nanite cloud', { after: 'disperse', anchor: 'start', offset: 200, duration: 1400, opacity: 0.4, fadeOut: 600 }),
    motion('levitate', 'source', { after: 'disperse', anchor: 'start', offset: 300, duration: 1600, intensity: 0.4 }),
  ], { sound: 'transform' }),
  [F('feats-dafc4yFLm5IfuClw')]: design('Nanite Shield: nanites form hardlight projectors into a barrier; a blue tech shield instead of a purple arcane one.', () => [
    cast('Projectors deploy', [sci(1, 'blueteal')], { stageId: 'deploy', duration: 1000, scale: 0.8 }),
    aura('Hardlight barrier', ['shield.01.complete.01.blue'], { after: 'deploy', anchor: 'start', offset: 300, duration: 1700, scale: 1.1 }),
    motion('brace', 'source', { after: 'deploy', anchor: 'start', offset: 300, duration: 800, intensity: 0.35 }),
  ]),
  [F('actions-q7UDeO9Ko1EbPRWm')]: design('Nimbus Surge: your solar nimbus flares as you lash out with a reactive melee Strike.', () => [
    cast('Nimbus flares', ['markers.light.complete.yellow', 'markers.light.complete.blue'], { stageId: 'flare', duration: 900, scale: 1.1 }),
    impact('Opening forced', ['melee_generic.slashing.one_handed', 'melee_generic.slash.01.orange'], { stageId: 'hit', after: 'flare', anchor: 'start', offset: 300, duration: 1200 }),
    motion('lunge', 'source', { after: 'flare', anchor: 'start', offset: 250, duration: 600, intensity: 0.6 }),
  ]),
  [F('feats-hAOjYvcgTbWQffbT')]: design('Nimbus Ward: you harness your solar nimbus to shield yourself; a golden corona, not a purple shield.', () => [
    cast('Nimbus gathers', ['markers.light.complete.yellow', 'markers.light.complete.blue'], { stageId: 'flare', duration: 900 }),
    aura('Solar ward', ['shield.01.complete.01.yellow', 'shield.01.complete.01.blue'], { after: 'flare', anchor: 'start', offset: 250, duration: 1600, scale: 1.1 }),
    motion('brace', 'source', { after: 'flare', anchor: 'start', offset: 250, duration: 800, intensity: 0.4 }),
  ], { sound: 'light' }),
  [F('feats-wno5bx4cDvX4oBgc')]: design('Nonnegotiable Command: you bark a simple order that allies obey with their reactions; a shout, no Strike of your own.', () => [
    cast('Barked order', ['soundwave.01.orangeyellow', 'soundwave.01.blue'], { stageId: 'bark', duration: 1100 }),
    motion('pulse', 'source', { duration: 700, intensity: 0.35 }),
  ], { sound: 'battleCry', ...ABILITY }),
  [F('feats-OlIuxKxrKAeDklfN')]: design('Not in the Face: you cower, arms over your face, acting meek and pitiful.', () => [
    motion('cower', 'source', { stageId: 'cower', duration: 1100, intensity: 0.6 }),
    impact('Pity', ['icon.heart.pink'], { after: 'cower', anchor: 'start', offset: 300, duration: 1300, scale: 0.5, offsetY: -0.5, offsetUnits: 'token', optionalTargets: true }),
  ], { sound: null, fx: false }),
  [F('feats-9BiW7yzDpWkj7hnv')]: design('Offensive Defense overcharges your force field into a concussive 5-foot blast that repulses foes.', () => [
    cast('Field overcharges', ['shield.01.complete.01.blue'], { stageId: 'charge', duration: 900 }),
    cast('Concussive blast', ['shield.01.outro_explode.blue', 'explosion.02.blue'], { stageId: 'blast', after: 'charge', anchor: 'start', offset: 500, duration: 1200, scale: 1.4 }),
    motion('recoil', 'targets', { after: 'blast', anchor: 'start', duration: 700, intensity: 0.6 }),
  ], { sound: 'force' }),
  [F('feats-u05dG8Wwt5N3K6lh')]: design('One with the Void: you gain void healing; dark void energy suffuses you instead of green vitality.', () => [
    cast('Void seeps in', ['energy_strands.in.purple', 'energy_strands.in.green.01'], { stageId: 'void', duration: 1100 }),
    aura('Void suffusion', ['healing_generic.200px.purple'], { after: 'void', anchor: 'start', offset: 400, duration: 1600, ...tint('#5a2a7a') }),
  ], { sound: 'void' }),
  [F('feats-ZB9gfqzJFtGccXwm')]: design('Opportunistic Hug: when a foe fumbles, you seize it in a big (grappling) hug.', () => grab(), { fx: false }),
  [F('actions-TBLHu4RhvhPrKid6')]: design('Oppressive Presence: a look or veiled threat leaves one enemy Suppressed.', () => [
    cast('Cold stare', ['eyes.01.dark_red.single', 'eyes.01.dark_green.single'], { stageId: 'stare', scale: 0.55, offsetY: -0.5, offsetUnits: 'token', duration: 1200 }),
    impact('Unnerved', ['icon.fear.dark_red', 'icon.fear.dark_purple'], { after: 'stare', anchor: 'start', offset: 450, duration: 1300, scale: 0.55, offsetY: -0.5, offsetUnits: 'token' }),
    motion('cower', 'targets', { after: 'stare', anchor: 'start', offset: 500, duration: 900, intensity: 0.35 }),
  ]),
  [F('feats-BwcJfYZcgCQOCGqI')]: design('Orbital Defense: your orbiting satellites of debris swing between you and harm.', () => [
    aura('Debris swings into place', ['aura_themed.01.orbit.complete.metal.01.grey'], { stageId: 'orbit', duration: 1800, scale: 1.1, ...spin(1600, 1) }),
    motion('brace', 'source', { after: 'orbit', anchor: 'start', offset: 300, duration: 800, intensity: 0.4 }),
  ], { sound: 'force' }),
  [F('feats-JEzClwVFM97EUKMX')]: design('Pahtra Caterwaul: a strange, haunting singing voice makes one target hesitate.', () => [
    cast('Caterwaul', ['soundwave.01.purple', 'soundwave.01.blue'], { stageId: 'song', duration: 1200 }),
    impact('Hesitation', ['music_notations.quaver.purple', 'music_notations.quaver.blue'], { after: 'song', anchor: 'start', offset: 350, duration: 1300, scale: 0.55, offsetY: -0.5, offsetUnits: 'token' }),
    motion('stagger', 'targets', { after: 'song', anchor: 'start', offset: 500, duration: 700, intensity: 0.3 }),
  ]),
  [F('feats-ULTJ4nXo9Nq1l8sG')]: design('Paint Splash: glowing primal pigment sprayed in glittering paint (revealing light).', () => [
    cast('Pigment flung', ['liquid.splash_side.bright_purple', 'liquid.splash_side.blue'], { stageId: 'fling', duration: 800, scale: 0.6 }),
    impact('Glittering paint', ['liquid.splash.bright_green', 'liquid.splash.blue'], { stageId: 'splash', after: 'fling', anchor: 'start', offset: 300, duration: 1100, optionalTargets: true }),
    impact('Revealing glow', ['swirling_sparkles.01.orangepurple', 'swirling_sparkles.01.blue'], { after: 'splash', anchor: 'start', offset: 250, duration: 1500, optionalTargets: true }),
  ]),
  [F('feats-N7B4Pj93XnI3A2Uz')]: design('Pause Button: you briefly cease to exist, vanishing from your space before snapping back.', () => gapBlink({ extra: [sprite('Gone from reality', { after: 'static', anchor: 'start', offset: 300, duration: 1200, opacity: 0.25, fadeOut: 400 })] })),
  [F('feats-7AvbXCgDkP9GDkbN')]: design('Percussive Maintenance: you fix a glitching tech item by smacking it against a hard surface.', () => [
    motion('slam', 'source', { stageId: 'smack', duration: 700, intensity: 0.5 }),
    cast('Clang', IMP, { stageId: 'clang', after: 'smack', anchor: 'start', offset: 300, duration: 800, scale: 0.5, offsetX: 0.5, offsetUnits: 'token' }),
    cast('Sparks settle', ['static_electricity.01.blue'], { after: 'clang', anchor: 'start', offset: 200, duration: 900, scale: 0.5, offsetX: 0.5, offsetUnits: 'token' }),
  ], { fx: false }),
  [F('feats-4GtayrDouYet2JQR')]: design('Perfect Synergy lends an ally your energy and cognition, quickening them; an energy link, not your own Strike.', () => [
    travel('Shared energy', ['energy_strands.range.standard.blue.01', 'energy_strands.range.standard.purple.01'], { stageId: 'link', duration: 1100, optionalTargets: true }),
    impact('Ally quickened', ['whirlwind.bluewhite', 'whirlwind.bluegrey'], { after: 'link', anchor: 'arrival', duration: 1300, scale: 0.7, optionalTargets: true }),
    motion('pulse', 'targets', { after: 'link', anchor: 'arrival', duration: 700, intensity: 0.3 }),
  ], { fx: false }),
  [F('feats-eyblfsR01aT1igfz')]: design('Performance Review is quick strategic advice to an ally who critically failed, not a Strike: a tactical holo note on the ally.', () => directive('greenyellow', 'Advice given'), { sound: null }),
  [F('actions-lDfffQX5QYWnNVA6')]: design('Phasic Flurry: Stride, then a phasic blade Strike against each creature within reach.', () => [
    motion('rush', 'source', { stageId: 'stride', duration: 1500, intensity: 0.5, motionRange: 'target', motionEndpoint: 'near', targetSelection: 'first' }),
    impact('Phasic blade strikes each foe', ['lasersword.melee.purple', 'lasersword.melee.blue.01'], { stageId: 'cuts', after: 'stride', anchor: 'end', duration: 1200, targetStagger: 180 }),
    motion('spin', 'source', { after: 'stride', anchor: 'end', duration: 800, intensity: 0.4 }),
  ]),
  [F('actions-OdKGpXP83uA1wdES')]: design('Photon Accelerator: the laser that hit you charges you with light, quickening you.', () => [
    aura('Light absorbed', ['markers.light.complete.yellow', 'markers.light.complete.blue'], { stageId: 'absorb', duration: 1300 }),
    impact('Photon rush', ['whirlwind.bluewhite', 'whirlwind.bluegrey'], { subject: 'source', after: 'absorb', anchor: 'start', offset: 500, duration: 1200, scale: 0.8 }),
    motion('pulse', 'source', { after: 'absorb', anchor: 'start', offset: 400, duration: 800, intensity: 0.35 }),
  ]),
  [F('actions-bWD4NpW0NB8aDwZF')]: design('Pickle Switch: flames spurt from the vehicle\'s exhaust, dazzling occupants of other vehicles.', () => [
    cast('Exhaust flames', ['fumes.fire.orange', 'cast_generic.fire.side01.orange'], { stageId: 'flame', duration: 1300, offsetX: -0.6, offsetUnits: 'token', mirrorX: true }),
    impact('Dazzling glare', ['impact.006.yellow'], { after: 'flame', anchor: 'start', offset: 400, duration: 900, scale: 0.7, optionalTargets: true }),
    motion('cower', 'targets', { after: 'flame', anchor: 'start', offset: 500, duration: 800, intensity: 0.35 }),
  ]),
  [F('actions-ZVzoIaWpXs62QVcu')]: design('Piercing Spikes: grabbed, you thrash so your spikes pierce the grabber.', () => spines({ extra: [motion('shake', 'source', { duration: 700, intensity: 0.5 })] }), { sound: 'naturalPierce', ...ABILITY }),
  [F('feats-Ts9l3J6pH1GPsL2W')]: design('Pin Down focuses your weapons fire on a resilient target to suppress it: a concentrated stream of rounds at one foe.', () => autoFire({ extra: [motion('cower', 'targets', { after: 'hits', anchor: 'start', duration: 800, intensity: 0.4 })] }), { sound: 'firearm', ...ABILITY }),
  [F('feats-gT70L4yEjpklDkxZ')]: design('Pirate\'s Parry: you parry an incoming melee Strike with your agile blade, not a gunshot.', () => [
    motion('brace', 'source', { stageId: 'brace', duration: 700, intensity: 0.45 }),
    cast('Blade parries', ['melee_generic.slashing.one_handed', 'melee_generic.slash.01.orange'], { stageId: 'parry', duration: 900, scale: 0.7, offsetX: 0.4, offsetUnits: 'token' }),
    cast('Steel rings', ['impact.005.white', 'impact.005.orange'], { after: 'parry', anchor: 'start', offset: 300, duration: 700, scale: 0.4, offsetX: 0.5, offsetUnits: 'token' }),
  ], { sound: 'sword', ...ABILITY }),
  [F('feats-OHZnPdwQe1GKwhMi')]: design('Plasma Ejection unleashes plasma through a 10-foot emanation or a 30-foot line, filling the area with fire.', () => [
    cast('Plasma builds', ['cast_generic.fire.01.orange'], { stageId: 'build', duration: 800 }),
    area('Plasma ejection', ['fireball.explosion.orange', 'explosion.01.orange'], { stageId: 'eject', after: 'build', anchor: 'start', offset: 400, duration: 1800, areaLayout: 'tiles', ...tint('#ffb04a') }),
  ]),
  [F('actions-Z8GMkB50OfXBX67a')]: design('Plate Deflection: you turn a critical hit onto a heavily armored plate; a hard clang and brace.', () => [
    motion('brace', 'source', { stageId: 'brace', duration: 800, intensity: 0.45 }),
    cast('Blow glances off plating', IMP, { after: 'brace', anchor: 'start', offset: 250, duration: 900, scale: 0.6, offsetX: 0.4, offsetUnits: 'token' }),
  ], { sound: 'shieldStrike', ...ABILITY, fx: false }),
  [F('actions-sn2hIy1iIJX9Vpgj')]: design('Point Out: you gesture at an undetected creature to show allies where it is; a locator marker, not darkness.', () => [
    motion('lunge', 'source', { duration: 500, intensity: 0.2 }),
    impact('Creature located', [sci(1, 'orangeyellow')], { delay: 300, duration: 1500, scale: 0.85 }),
  ], { fx: false }),
  [F('actions-RNEFfOL4d6WkTTpP')]: design('Polyp Print: your main body withers as a decoy and you reappear in your telekinetic hand\'s space.', () => [
    cast('Decoy withers', ['smoke.puff.centered.dark_green', 'smoke.puff.centered.grey'], { stageId: 'wither', duration: 1200 }),
    sprite('Withering decoy', { after: 'wither', anchor: 'start', duration: 1300, opacity: 0.5, fadeOut: 700 }),
    motion('flicker', 'source', { after: 'wither', anchor: 'start', offset: 300, duration: 900, intensity: 0.5 }),
  ]),
  [F('feats-Ru3mI5xoPXns5HiS')]: design('Power Slide throws the vehicle into a skid to evade pursuit: tire smoke and a sideways slide.', () => [
    cast('Tire smoke', ['smoke.puff.side.02.white', 'smoke.puff.side.grey'], { stageId: 'smoke', duration: 1300 }),
    motion('dodge', 'source', { after: 'smoke', anchor: 'start', duration: 1100, intensity: 0.5, distance: 1, motionRange: 'distance', motionHeading: 'left' }),
  ]),
  [F('feats-h2j5UDmxAtKMyZI2')]: design('Prismatic Display: your skin flashes shifting colors to throw off creatures within reach.', () => [
    aura('Skin cycles colours', ['swirling_sparkles.01.bluepink', 'swirling_sparkles.01.blue'], { stageId: 'shift', duration: 1600, scale: 1.1 }),
    impact('Senses thrown off', ['glint.blue.many', 'glint.yellow.many'], { after: 'shift', anchor: 'start', offset: 400, duration: 1100, scale: 0.6, optionalTargets: true }),
    motion('stagger', 'targets', { after: 'shift', anchor: 'start', offset: 500, duration: 700, intensity: 0.3 }),
  ]),
  [F('feats-eAQtUyjZIsYWXIui')]: design('Proudhome Puff vents poisonous fungal spores in a 30-foot emanation.', () => [
    cast('Spores vent', ['smoke.puff.ring.01.multicolored', 'smoke.puff.ring.01.white'], { stageId: 'vent', duration: 900, ...tint('#a6c94a') }),
    area('Spore cloud', ['fog_cloud.02.green', 'fog_cloud.01.white'], { after: 'vent', anchor: 'start', offset: 300, duration: 2600, opacity: 0.8, fadeIn: 300, fadeOut: 700 }),
  ]),
  [F('actions-6fsMvO0jXtK8gYkH')]: design('Puff Up: you rapidly puff up, jabbing spurred scales into your attacker.', () => spines({ puff: true }), { sound: 'naturalPierce', ...ABILITY }),
  [F('feats-3MFMVtHgpTvX3dlu')]: design('Pull Into Orbit: your gravity pulls debris and stellar ejecta into orbit around you.', () => [
    cast('Gravity pulls', ['energy_strands.in.purple', 'energy_strands.in.green.01'], { stageId: 'pull', duration: 1000 }),
    aura('Satellites orbit', ['aura_themed.01.orbit.complete.metal.01.grey'], { after: 'pull', anchor: 'start', offset: 400, duration: 2400, scale: 1.2, ...spin(3000, 1) }),
  ]),
  [F('feats-staCd7NUtYoa6Fnk')]: design('Punishing Salvo: a follow-up Strike with the same area weapon after Area Fire; a heavy shot, not a melee slash.', () => gun({ aim: false, round: ['bullet.03.orange', 'bullet.02.orange'], kick: 0.7 }), { sound: 'firearm', ...ABILITY }),
  [F('feats-bRMjKwwLTcQLk13U')]: design('Punishing Spines: you reflexively Strike your attacker with your spines.', () => spines(), { sound: 'naturalPierce', ...ABILITY }),
  [F('feats-GmRJYFPtVIiSViF8')]: design('Puzzling Outburst: a shouted mind-bending brainteaser rattles one creature.', () => mindJolt({ label: 'Brain teased', hit: ['icon.stun.purple', 'toll_the_dead.green.shockwave'] })),
  [F('actions-30Nw5q4vWKCQIBIZ')]: design('Quantum Pulse: as combat begins you instinctively release a pulse of quantum energy and Warp Reality.', () => [
    cast('Quantum pulse', ['impact.013.001.bluepurple', 'impact.013.001.orangeyellow'], { stageId: 'pulse', duration: 1100, scale: 1.4 }),
    aura('Reality warps', ['zoning.outward.circle.once.bluegreen.01'], { after: 'pulse', anchor: 'start', offset: 300, duration: 1600, scale: 2, opacity: 0.8, below: true }),
  ]),
  [F('feats-IEPUsAbgkkdSAFFz')]: design('Radiant Zone floods your quantum field with bright light.', () => [
    cast('Brighter reality', ['markers.light.complete.yellow', 'markers.light.complete.blue'], { stageId: 'light', duration: 1200 }),
    aura('Radiant field', ['zoning.outward.circle.once.bluegreen.01'], { after: 'light', anchor: 'start', offset: 300, duration: 2000, scale: 2.5, opacity: 0.85, below: true, ...tint('#ffe58a') }),
  ]),
  [F('feats-LdWDGfQInWeK0IwZ')]: design('Raise Crystalline Strands: fortified crystal hair absorbs a lethal blow.', () => [
    motion('brace', 'source', { stageId: 'brace', duration: 800, intensity: 0.45 }),
    cast('Crystal strands catch the blow', ['side_impact.ice_shard.blue'], { after: 'brace', anchor: 'start', offset: 200, duration: 900, scale: 0.7 }),
  ], { fx: false }),
  [F('feats-8NaeI5k09p1Al1np')]: design('Reactive Flicker times a temporal displacement so the attack passes through your flickering form.', () => gapBlink()),
  [F('actions-RNilk6Evoi0xNbWX')]: design('Ready Arms! is a quick command for everyone to draw and swap weapons (Lead by Example fire is optional).', () => directive('orangeyellow', 'Weapons up', { markOpts: { subject: 'source', offsetY: -0.6, offsetUnits: 'token', scale: 0.5 } }), { sound: null }),
  [F('actions-9P2ZptR0PrYyiJFl')]: design('Redirect Energy siphons the incoming cold or fire into your melee weapon; energy is drawn in and held.', () => [
    cast('Energy siphoned', ['energy_strands.in.red', 'energy_strands.in.green.01'], { stageId: 'siphon', duration: 1200 }),
    aura('Charged weapon', ['energy_strands.overlay.orange', 'energy_strands.overlay.blue.01'], { after: 'siphon', anchor: 'start', offset: 500, duration: 1600, scale: 0.9, fadeOut: 500 }),
  ]),
  [F('feats-Wl5b4f0asjRTNuZy')]: design('Release Radiation: a burst of radiation through a 10-foot emanation, like a star.', () => [
    cast('Core flares', ['markers.light.complete.green', 'markers.light.complete.blue'], { stageId: 'core', duration: 800 }),
    area('Radiation burst', ['explosion.04.green', 'explosion.04.blue'], { after: 'core', anchor: 'start', offset: 300, duration: 1700, ...tint('#b6ff5a') }),
  ]),
  [F('feats-LR7GSFZcNQpfkIKs')]: design('Relentless Tentacles: extra tentacles wrap the prey in another Grapple.', () => grab(), { fx: false }),
  [F('actions-lOE4yjUnETTdaf2T')]: design('Reposition: you muscle a creature into a new square; a heave and the target shoved aside.', () => [
    motion('lunge', 'source', { stageId: 'heave', duration: 600, intensity: 0.5 }),
    impact('Shoved', IMP, { after: 'heave', anchor: 'start', offset: 250, duration: 800, scale: 0.6 }),
    motion('dodge', 'targets', { after: 'heave', anchor: 'start', offset: 300, duration: 800, intensity: 0.5, distance: 1, motionRange: 'distance', motionHeading: 'right' }),
  ], { sound: 'unarmed', ...ABILITY, fx: false }),
  [F('feats-hPmYo6zCElcukFWV')]: design('Ride the River Between floods a 100-foot line with golden solar light.', () => [
    cast('River Between opens', ['markers.light.complete.yellow', 'markers.light.complete.blue'], { stageId: 'open', duration: 900 }),
    area('Golden solar stream', ['breath_weapons02.burst.line.holy.yellow.01', 'breath_weapons.fire.line.orange'], { after: 'open', anchor: 'start', offset: 300, duration: 2400, ...tint('#ffd36b') }),
  ]),
  [F('feats-nLQqltDF93pHHjLg')]: design('Run Hot: Area Fire twice in a ceaseless barrage.', () => autoFire({ repeats: 6 })),
  [F('actions-lID4rJHAVZB6tavf')]: design('Run Over: the vehicle charges in a straight line through creatures in its path.', () => [
    cast('Engine roars', ['smoke.puff.side.02.white', 'smoke.puff.side.grey'], { stageId: 'rev', duration: 900, mirrorX: true }),
    motion('rush', 'source', { stageId: 'ram', after: 'rev', anchor: 'start', offset: 200, duration: 1600, intensity: 0.7, distance: 4, motionRange: 'distance' }),
    impact('Ram', IMP, { after: 'ram', anchor: 'start', offset: 700, duration: 900, targetStagger: 150, optionalTargets: true }),
    motion('stagger', 'targets', { after: 'ram', anchor: 'start', offset: 800, duration: 700, intensity: 0.6 }),
  ]),
  [F('feats-JnpK0Ka0vj91Wilr')]: design('Rush of Adrenaline: overcoming a save floods you with invigorating temporary Hit Points, not a Strike.', () => fury({ label: 'Adrenaline surges', auraLabel: 'Invigorated' })),
  [F('actions-qbyer2woEdGXZzoR')]: design('Sabotage hacks a nearby tech creature or item: a corrupted holo-marker and sparking circuitry on the target.', () => [
    cast('Intrusion', [sci(2, 'purplered')], { stageId: 'hack', duration: 1200, scale: 0.7 }),
    impact('Systems sabotaged', [sci(1, 'purplered')], { stageId: 'mark', after: 'hack', anchor: 'start', offset: 400, duration: 1400, optionalTargets: true }),
    impact('Circuits spark', ['static_electricity.01.blue'], { after: 'mark', anchor: 'start', offset: 200, duration: 1100, scale: 0.8, optionalTargets: true }),
  ]),
  [F('feats-HCd1MOoyc4rJVnIo')]: design('Salvo: your LFAN weapon mount fires an arc of electricity at the target.', () => [
    cast('Mount charges', ['static_electricity.01.blue'], { stageId: 'charge', duration: 800, scale: 0.7 }),
    travel('Electric arc', ['chain_lightning.primary.blue'], { stageId: 'arc', after: 'charge', anchor: 'start', offset: 300, duration: 1000 }),
    impact('Shock', ['impact.001.blue'], { after: 'arc', anchor: 'arrival', duration: 900 }),
    motion('shake', 'targets', { after: 'arc', anchor: 'arrival', duration: 700, intensity: 0.4 }),
  ]),
  [F('feats-POBFsfiYDrRUonvL')]: design('Secrete Numbing Saliva: your stomach-mouth leaves numbing saliva in the bitten target.', () => [
    impact('Saliva oozes into the wound', ['liquid.splash.green', 'liquid.splash.blue'], { stageId: 'ooze', duration: 1100, scale: 0.6, ...tint('#b8e580') }),
    motion('shake', 'targets', { after: 'ooze', anchor: 'start', offset: 300, duration: 700, intensity: 0.3 }),
  ], { sound: 'poison' }),
  [F('actions-BlAOM2X92SI6HMtJ')]: design('Seek scans an area for creatures or objects; a sensory sweep, not a teleport.', () => [
    cast('Scanning sweep', ['eyes.01.bluegreen.few', 'eyes.01.dark_green.few'], { stageId: 'scan', scale: 0.7, offsetY: -0.5, offsetUnits: 'token', duration: 1400 }),
    aura('Senses reach out', ['zoning.outward.circle.once.bluegreen.01'], { after: 'scan', anchor: 'start', offset: 200, duration: 1500, scale: 1.8, opacity: 0.6, below: true }),
  ], { fx: false }),
  [F('feats-2ApgqRLCCigv1r6Y')]: design('Shed Shell: you leave your cumbersome shell behind for mobility.', () => [
    cast('Shell drops away', ['smoke.puff.side.grey'], { stageId: 'drop', duration: 1100, below: true }),
    motion('shake', 'source', { duration: 600, intensity: 0.4 }),
    motion('dodge', 'source', { after: 'drop', anchor: 'start', offset: 300, duration: 700, intensity: 0.3, distance: 0.4, motionRange: 'distance', motionHeading: 'right' }),
  ], { fx: false }),
  [F('feats-kjJmFQy2kJ30QHdu')]: design('Shedding Flurry: your body shakes and sheds a flurry of fur that throws off the attack.', () => [
    motion('shake', 'source', { stageId: 'shake', duration: 800, intensity: 0.6 }),
    cast('Fur flurry', ['smoke.puff.ring.01.white'], { after: 'shake', anchor: 'start', offset: 150, duration: 1100, scale: 0.9 }),
  ], { fx: false }),
  [F('feats-7Th5q3QVYL2KzKEy')]: design('Shifter\'s Feint: a sudden change of size and appearance creates the opening of a Feint.', () => feint({ pre: [cast('Sudden reshape', ['shimmer.01.purple', 'shimmer.01.blue'], { stageId: 'shift', duration: 1200 })], delay: 500 })),
  [F('actions-pWMwGj8lnOpkU3Hr')]: design('Shifthide Camouflage: your skin\'s patterns shift to match the terrain.', () => camo('green')),
  [F('actions-lIZ9DhrkzM3AEQmX')]: design('Shimmering Dazzle: your chitin flares with hypnotic shifting colour, dazzling one creature.', () => [
    aura('Chitin shimmers', ['swirling_sparkles.01.orangepurple', 'swirling_sparkles.01.blue'], { stageId: 'shim', duration: 1400 }),
    impact('Dazzled', ['glint.yellow.many'], { after: 'shim', anchor: 'start', offset: 400, duration: 1100, scale: 0.6 }),
    motion('cower', 'targets', { after: 'shim', anchor: 'start', offset: 500, duration: 800, intensity: 0.3 }),
  ]),
  [F('actions-bXLJtouJRWQXxLUP')]: design('Shine: your fur sparkles like a bright gem for an hour.', () => [
    aura('Gem-bright fur', ['twinkling_stars.points05.white'], { stageId: 'shine', duration: 2200, scale: 1.1, fadeIn: 300, fadeOut: 600 }),
    cast('Sparkle', ['swirling_sparkles.01.bluepink', 'swirling_sparkles.01.blue'], { duration: 1500 }),
  ]),
  [F('feats-6mt3bNS5Ujh0f3cf')]: design('Shocking Howl: a sudden exclamation jolts the shooter\'s nerves and may spoil its shot.', () => [
    cast('Sudden howl', ['soundwave.01.red', 'soundwave.01.blue'], { stageId: 'howl', duration: 1100 }),
    impact('Nerves jolted', ['toll_the_dead.red.shockwave', 'toll_the_dead.green.shockwave'], { after: 'howl', anchor: 'start', offset: 350, duration: 1100, scale: 0.7 }),
    motion('recoil', 'targets', { after: 'howl', anchor: 'start', offset: 450, duration: 650, intensity: 0.5 }),
  ]),
  [F('feats-OUyI2Z5wwLoqf9YA')]: design('Shooting Star: you launch across the field in a straight line, a concealing streak of starlight.', () => [
    cast('Ignition', ['impact.006.yellow'], { stageId: 'ign', duration: 800 }),
    motion('rush', 'source', { stageId: 'streak', after: 'ign', anchor: 'start', offset: 200, duration: 1500, intensity: 0.7, distance: 4, motionRange: 'distance' }),
    sprite('Light trail', { after: 'ign', anchor: 'start', offset: 250, duration: 1300, opacity: 0.4, fadeOut: 700 }),
    aura('Starlight flares at the end', ['markers.light.complete.yellow', 'markers.light.complete.blue'], { after: 'streak', anchor: 'end', duration: 1100, scale: 0.8 }),
  ], { sound: 'light' }),
  [F('feats-fSqUeSAFhvBfq4sE')]: design('Shoving Shot: Area/Auto-Fire whose blast pushes the primary target back.', () => autoFire({ extra: [motion('dodge', 'targets', { after: 'hits', anchor: 'start', duration: 700, intensity: 0.5, distance: 1, motionRange: 'distance', motionHeading: 'away', targetSelection: 'first' })] })),
  [F('feats-LmCHemr9mZQlFUMw')]: design('Shroud of Shattered Spirits: restless spirits swirl around you, concealing you from the attack.', () => [
    aura('Spirits swirl', ['spirit_guardians.dark_whiteblue.spirits', 'spirit_guardians.blueyellow.ring'], { stageId: 'spirits', duration: 2000, scale: 0.6, opacity: 0.85, fadeIn: 300, fadeOut: 500 }),
    motion('flicker', 'source', { after: 'spirits', anchor: 'start', offset: 400, duration: 800, intensity: 0.4 }),
  ]),
  [F('feats-7BmJZ3iA7WpzPBx6')]: design('Sidestep: you deftly step out of the way so the missed blow continues into another adjacent creature.', () => [
    motion('dodge', 'source', { stageId: 'step', duration: 700, intensity: 0.4, distance: 0.4, motionRange: 'distance', motionHeading: 'left' }),
    impact('Blow redirected', IMP, { after: 'step', anchor: 'start', offset: 400, duration: 800, scale: 0.6, optionalTargets: true }),
  ], { fx: false }),
  [F('feats-ri5qV0g9RwwWLiBk')]: design('Size of the Ancients: you grow to Huge size, rivaling ancient dragonkin.', () => [
    cast('Body surges', ['impact.ground_crack.01.white', 'impact.ground_crack.01.orange'], { stageId: 'surge', duration: 1300, below: true }),
    motion('pulse', 'source', { after: 'surge', anchor: 'start', offset: 200, duration: 1400, intensity: 0.8 }),
  ]),
  [F('feats-tgnqTa3ICUx5pp6o')]: design('Skitter Wrastle: you Step in and Grapple a creature (or give a big hug).', () => [
    motion('rush', 'source', { stageId: 'step', duration: 900, intensity: 0.4, motionRange: 'target', motionEndpoint: 'near' }),
    ...grab({ delay: 900 }),
  ], { fx: false }),
  [F('feats-TilhFOG89jo02XsE')]: design('Slick Mucus: you secrete slime and leave it in every square you move out of.', () => [
    cast('Slime secreted', ['liquid.splash_side.green', 'liquid.splash_side.blue'], { stageId: 'slime', duration: 900, below: true }),
    motion('rush', 'source', { after: 'slime', anchor: 'start', offset: 200, duration: 1600, intensity: 0.4, distance: 3, motionRange: 'distance' }),
    sprite('Slick trail', { after: 'slime', anchor: 'start', offset: 300, duration: 1400, opacity: 0.3, fadeOut: 800 }),
  ]),
  [F('feats-64rwZGS8fKt8P5Ae')]: design('Slime Spray coats a 15-foot cone with slippery slime.', () => [
    cast('Slime sprays', ['liquid.splash_side.green', 'liquid.splash_side.blue'], { stageId: 'spray', duration: 800, scale: 0.6 }),
    area('Slippery cone', ['breath_weapons.poison.cone.green'], { after: 'spray', anchor: 'start', offset: 250, duration: 2200, opacity: 0.85, ...tint('#7fd6c8') }),
  ]),
  [F('ancestry-features-F7aBUHwgBVRdyZJe')]: design('Slime Squirt turns one adjacent square into slick difficult terrain.', () => [
    cast('Slime squirts', ['liquid.splash_side.green', 'liquid.splash_side.blue'], { stageId: 'squirt', duration: 800, scale: 0.6 }),
    cast('Slick puddle', ['liquid.splash.green', 'liquid.splash.blue'], { after: 'squirt', anchor: 'start', offset: 250, duration: 1400, scale: 0.8, offsetX: 1, offsetUnits: 'token', below: true, ...tint('#7fd6c8') }),
  ]),
  [F('actions-oKLA4xGqOkugw45C')]: design('Slitherskin: toxins secreted through your flesh poison the creature touching you.', () => [
    aura('Toxic sheen', ['fumes.toxic.green', 'fumes.04.complete.grey'], { stageId: 'sheen', duration: 1300, scale: 0.8 }),
    impact('Poisoned touch', ['impact.001.green', 'impact.001.blue'], { after: 'sheen', anchor: 'start', offset: 400, duration: 900, scale: 0.7 }),
    motion('recoil', 'targets', { after: 'sheen', anchor: 'start', offset: 450, duration: 650, intensity: 0.45 }),
  ]),
  [F('actions-VMozDqMMuK5kpoX4')]: design('Sneak: a slow, quiet half-speed move while staying unseen; no Strike, no ground cracks.', () => [
    sprite('Low silhouette', { stageId: 'shadow', duration: 2400, opacity: 0.3, fadeIn: 300, fadeOut: 700 }),
    motion('rush', 'source', { duration: 2400, intensity: 0.15, distance: 1.5, motionRange: 'distance' }),
  ], { sound: null, fx: false }),
  [F('feats-M8Kr3GSzRQFsu8QZ')]: design('Spew Acidic Bile violently sprays acid-poison bile in a 30-foot cone.', () => [
    cast('Retch', ['liquid.splash_side.green', 'liquid.splash_side.blue'], { stageId: 'retch', duration: 700, scale: 0.6 }),
    area('Bile cone', ['breath_weapons.poison.cone.green'], { after: 'retch', anchor: 'start', offset: 250, duration: 2300, ...tint('#b6d94a') }),
    motion('lunge', 'source', { after: 'retch', anchor: 'start', duration: 600, intensity: 0.35 }),
  ]),
  [F('feats-iDOe44t6NDW3Wvr8')]: design('Spore Shot: a spore pod Strike packed with extra choking spores.', () => [
    projectile('Spore pod', ['liquid.blob.green', 'liquid.blob.blue'], { stageId: 'pod', duration: 800, scale: 0.4 }),
    impact('Pod bursts', ['smoke.puff.centered.dark_green', 'smoke.puff.centered.grey'], { stageId: 'burst', after: 'pod', anchor: 'arrival', duration: 1300 }),
    motion('throw', 'source', { duration: 600 }),
    motion('shake', 'targets', { after: 'burst', anchor: 'start', duration: 700, intensity: 0.4 }),
  ], { sound: 'thrown', ...ABILITY }),
  [F('feats-pFr1JyMlyiVVsNDV')]: design('Spot Healing transfers vitality from your network to the adjacent bonded ally.', () => [
    travel('Vitality flows', ['energy_strands.range.standard.dark_green.01', 'energy_strands.range.standard.purple.01'], { stageId: 'flow', duration: 1000, optionalTargets: true }),
    impact('Wound mends', ['healing_generic.200px.green'], { after: 'flow', anchor: 'arrival', duration: 1300, optionalTargets: true }),
  ], { sound: 'healing' }),
  [F('feats-bED9St8ppMEfJljL')]: design('Spray Ink: a squirt of viscous ink at a foe within 15 feet.', () => squirt('dark_black', 'Ink splatters', { blob: 'purple', free: 'liquid.splash.blue' })),
  [F('feats-2lZzp2B03JhLQmhd')]: design('Spread the Love: Area/Auto-Fire against two primary targets; gunfire, not magic missiles.', () => autoFire()),
  [F('feats-32W1Pnex4xbhx5Bj')]: design('Squirt Blood: you squirt blood from your eye at a creature within 30 feet.', () => squirt('red', 'Blood splatters', { free: 'liquid.splash02.red' })),
  [F('feats-3HmrwfbkjMHn6jw0')]: design('Star Brand brands the struck creature with solar energy that keeps it visible.', () => [
    impact('Solar brand', ['markers.light.complete.yellow', 'markers.light.complete.blue'], { stageId: 'brand', duration: 1500 }),
    impact('Brand glows', ['dancing_light.yellow'], { after: 'brand', anchor: 'start', offset: 500, duration: 1600, scale: 0.4, offsetY: -0.4, offsetUnits: 'token' }),
  ]),
  [F('feats-auYgbiGDpvqSHWgK')]: design('Startling Shift: you strobe luminous pigments through an emanation to confuse enemies.', () => [
    aura('Body strobes', ['swirling_sparkles.01.bluepink', 'swirling_sparkles.01.blue'], { stageId: 'strobe', duration: 1500 }),
    area('Pulsing light', ['markers.light.complete.purple', 'markers.light.complete.blue'], { after: 'strobe', anchor: 'start', offset: 200, duration: 1500, opacity: 0.8, repeats: 2, repeatInterval: 500 }),
    motion('stagger', 'targets', { after: 'strobe', anchor: 'start', offset: 600, duration: 700, intensity: 0.3 }),
  ]),
  [F('actions-qjcTcdQpCVMJcNgi')]: design('Static Shield unleashes the static in your mind as a psychic shield.', () => [
    aura('Mental static', ['static_electricity.03.purple', 'static_electricity.03.blue'], { stageId: 'static', duration: 1600, scale: 1 }),
    motion('brace', 'source', { duration: 800, intensity: 0.35 }),
  ], { sound: 'psychic' }),
  [F('feats-QicdNj8KJd0WrPzv')]: design('Steady Descent: you adjust gravity on your body for a slow controlled glide.', () => glide({ label: 'Gravity eases', assets: ['energy_strands.complete.dark_purple', 'energy_strands.complete.blue.01'], castOpts: { opacity: 0.7, below: true } })),
  [F('actions-gZr207z8Q7AuH2RT')]: design('Steel Yourselves! has allies brace for impact; a rallying shout and you brace.', () => [
    cast('Brace call', [sci(2, 'blueteal')], { stageId: 'cmd', duration: 1300, scale: 0.8 }),
    motion('brace', 'source', { after: 'cmd', anchor: 'start', offset: 300, duration: 900, intensity: 0.45 }),
  ]),
  [F('feats-7nogykxuNzdaRfnf')]: design('Stellar Rush: you rush forward on a blast of stellar energy.', () => [
    cast('Stellar blast', ['impact.006.yellow'], { stageId: 'blast', duration: 800, below: true }),
    motion('rush', 'source', { after: 'blast', anchor: 'start', offset: 150, duration: 1800, intensity: 0.55, distance: 4, motionRange: 'distance' }),
    sprite('Starlight wake', { after: 'blast', anchor: 'start', offset: 250, duration: 1300, opacity: 0.4, fadeOut: 700 }),
  ]),
  [F('feats-r5FD2LZ9kWOhDPby')]: design('Stellar Shield Collapse: your destroyed solar shield implodes into a Black Hole or bursts into a Supernova.', () => [
    cast('Shield shatters', ['shield.01.outro_explode.blue'], { stageId: 'break', duration: 900, ...tint('#ffd36b') }),
    cast('Shield collapses', ['explosion.04.dark_purple', 'explosion.04.blue'], { after: 'break', anchor: 'start', offset: 450, duration: 1500, scale: 1.2 }),
    motion('stagger', 'source', { after: 'break', anchor: 'start', duration: 700, intensity: 0.4 }),
  ], { sound: 'explosion' }),
  [F('feats-GgOtKobXSkAnnWQJ')]: design('Strobe Light: you strobe your brilliant light erratically to throw off the attacker\'s aim.', () => [
    cast('Strobe', ['impact.006.yellow'], { stageId: 'strobe', duration: 500, scale: 1.2, repeats: 3, repeatInterval: 250 }),
    motion('flicker', 'source', { duration: 1000, intensity: 0.5 }),
    motion('cower', 'targets', { after: 'strobe', anchor: 'start', offset: 300, duration: 700, intensity: 0.3 }),
  ]),
  [F('feats-FeQ4jUpeIT6klxrk')]: design('Subtle Coloration: your body shifts colour to vanish into your surroundings.', () => camo('blue')),
  [F('feats-NdYH8iWlYQWPW9rA')]: design('Sudden Withdrawal: you pull into your shell as the critical hit lands.', () => tuck(), { fx: false }),
  [F('feats-9Fuu4Kn0ZXpJaqmo')]: design('Summerborn Awakening accelerates seasonal change into verdant growth around you.', () => [
    cast('Primal season turns', ['aura_themed.01.inward.complete.nature.01.green'], { stageId: 'turn', duration: 1600 }),
    aura('Verdant growth', ['aura_themed.01.orbit.complete.nature.01.green'], { after: 'turn', anchor: 'start', offset: 500, duration: 2200, scale: 1.2, fadeOut: 600 }),
  ], { sound: 'growth' }),
  [F('feats-o8BH5yV2GOd2e57e')]: design('Superhero Landing: you absorb a fall through your large frame and land with a ground-cracking slam.', () => [
    motion('slam', 'source', { stageId: 'land', duration: 800, intensity: 0.7 }),
    cast('Impact crater', ['impact.ground_crack.01.white', 'impact.ground_crack.01.orange'], { after: 'land', anchor: 'start', offset: 300, duration: 1500, below: true }),
    cast('Dust', ['smoke.puff.ring.01.white'], { after: 'land', anchor: 'start', offset: 300, duration: 1100 }),
  ]),
  [F('feats-71DtcZirJ9bbKMTY')]: design('Supernova: pent-up stellar energy erupts through a 15- or 30-foot emanation.', () => [
    cast('Energy builds', ['markers.light.complete.yellow', 'markers.light.complete.blue'], { stageId: 'build', duration: 900 }),
    area('Supernova', ['explosion.03.yellow', 'explosion.01.orange'], { stageId: 'nova', after: 'build', anchor: 'start', offset: 450, duration: 1800 }),
    motion('pulse', 'source', { after: 'build', anchor: 'start', offset: 300, duration: 800, intensity: 0.5 }),
    motion('recoil', 'targets', { after: 'nova', anchor: 'start', offset: 200, duration: 700, intensity: 0.5 }),
  ]),
  [F('feats-HYdihFZR4TDtFT2z')]: design('Swear Vengeance: refusing to fall, you swear vengeance on the creature that almost killed you.', () => [
    ...fury({ label: 'Vow of vengeance', auraLabel: 'Burning resolve' }),
    impact('Marked for vengeance', ['icon.skull.dark_red', 'icon.fear.dark_purple'], { after: 'surge', anchor: 'start', offset: 500, duration: 1400, scale: 0.55, offsetY: -0.5, offsetUnits: 'token', optionalTargets: true }),
  ], { sound: 'battleCry', ...ABILITY }),
  [F('feats-F3K4I4GWdty1Y5DM')]: design('Swerveshift: you Change Shape to a smaller size to slip the attack.', () => [
    cast('Quick reshape', ['shimmer.01.purple', 'shimmer.01.blue'], { stageId: 'shift', duration: 1200, scale: 0.8 }),
    motion('dodge', 'source', { after: 'shift', anchor: 'start', offset: 150, duration: 700, intensity: 0.4, distance: 0.3, motionRange: 'distance', motionHeading: 'left' }),
  ]),
  [F('feats-vKJTKXdrSJMgvNlw')]: design('Swooping Rescue: you fly in, grab a willing ally and carry them off.', () => [
    cast('Lift-off', ['wind_lines.01.01.white'], { stageId: 'lift', duration: 1000 }),
    motion('leap', 'source', { stageId: 'swoop', after: 'lift', anchor: 'start', offset: 150, duration: 1800, intensity: 0.3, motionRange: 'target', motionEndpoint: 'near' }),
    impact('Ally scooped up', ['wind_lines.01.01.white'], { after: 'swoop', anchor: 'end', duration: 900, scale: 0.6, optionalTargets: true }),
    motion('levitate', 'targets', { after: 'swoop', anchor: 'end', duration: 1200, intensity: 0.3 }),
  ], { fx: false }),
  [F('feats-iUiFmM80vdgOlUkA')]: design('Sync Up: a psychic battle cry links you and up to 10 allies into a temporary hive mind.', () => [
    cast('Psychic battle cry', ['soundwave.02.purple', 'soundwave.02.blue'], { stageId: 'cry', duration: 1300 }),
    travel('Hive-mind links', ['energy_strands.range.multiple.purple.01'], { stageId: 'link', after: 'cry', anchor: 'start', offset: 300, duration: 1100, optionalTargets: true }),
    impact('Minds synced', ['eyes.01.purple.single', 'eyes.01.dark_green.single'], { after: 'link', anchor: 'arrival', duration: 1200, scale: 0.5, offsetY: -0.5, offsetUnits: 'token', optionalTargets: true }),
  ], { fx: false }),
  [F('feats-IA8eJsPKwNbWOrs0')]: design('Synthesized Black Hole: your core opens a soul-tearing black hole that damages everything in a 10-foot emanation (no pull is described).', () => [
    cast('Core pierces the void', ['impact.005.purple', 'impact.001.blue'], { stageId: 'core', duration: 800 }),
    aura('Black hole', ['sphere_of_annihilation.200px.purple', 'energy_strands.complete.blue.01'], { stageId: 'hole', after: 'core', anchor: 'start', offset: 300, duration: 2200, scale: 1, fadeIn: 300, fadeOut: 600, ...spin(2500, -1) }),
    area('Void tears through the area', ['energy_strands.complete.dark_purple', 'energy_strands.complete.blue.01'], { after: 'hole', anchor: 'start', offset: 300, duration: 1800, opacity: 0.8 }),
    motion('press', 'source', { after: 'core', anchor: 'start', duration: 900, intensity: 0.4 }),
    motion('stagger', 'targets', { after: 'hole', anchor: 'start', offset: 500, duration: 800, intensity: 0.5 }),
  ]),
  [F('feats-SToQWyRke76PwAvh')]: design('Tail Glide: your fluffy tail guides a slow glide.', () => glide()),
  [F('feats-86YwN8XwJdk2kTgQ')]: design('Take \'Em Alive! orders allies to fight nonlethally; a holo command, no slashes.', () => directive('blueteal', 'Nonlethal orders', { markOpts: { subject: 'source', offsetY: -0.6, offsetUnits: 'token', scale: 0.5 } }), { sound: null }),
  [F('actions-yh9O9BQjwWrAIiuf')]: design('Take Control: you grab the vehicle\'s controls; a cockpit HUD lights up.', () => [
    motion('lunge', 'source', { duration: 500, intensity: 0.25 }),
    cast('Controls engage', [sci(1, 'blueteal')], { delay: 250, duration: 1300, scale: 0.8 }),
  ], { fx: false }),
  [F('actions-ust1jJSCZQUhBZIz')]: design('Take Cover: you press against a wall or duck behind an obstacle.', () => [
    motion('cower', 'source', { stageId: 'duck', duration: 1000, intensity: 0.5 }),
    cast('Duck behind cover', ['smoke.puff.side.grey'], { after: 'duck', anchor: 'start', offset: 200, duration: 900, scale: 0.5, below: true }),
  ], { fx: false }),
  [F('feats-OwZo5lHroMXkW88J')]: design('Telepathic Onslaught assails the minds of any number of enemies with telepathic feedback.', () => [
    cast('Feedback builds', ['eyes.01.purple.many', 'eyes.01.dark_green.many'], { stageId: 'build', scale: 0.8, duration: 1100 }),
    travel('Telepathic feedback', ['energy_strands.range.multiple.purple.01'], { stageId: 'wave', after: 'build', anchor: 'start', offset: 300, duration: 1100 }),
    impact('Minds assailed', ['toll_the_dead.purple.shockwave', 'toll_the_dead.green.shockwave'], { after: 'wave', anchor: 'arrival', duration: 1200, scale: 0.8, targetStagger: 100 }),
    motion('stagger', 'targets', { after: 'wave', anchor: 'arrival', duration: 800, intensity: 0.4 }),
  ]),
  [F('feats-QpHJD3PSRSxq7Vu5')]: design('Terror-Forming: Area/Auto-Fire that blasts the battlefield into ruined, difficult ground.', () => autoFire({ extra: [area('Ground torn apart', ['ground_cracks.01.orange'], { after: 'hits', anchor: 'start', offset: 200, duration: 2400, below: true, fadeOut: 700 })] })),
  [F('feats-8MTJ72rLLLqFCKhe')]: design('The Harder They Fall: you exploit the big creature\'s size as an ally hits it, sending it off balance.', () => [
    impact('Weak point', IMP, { stageId: 'hit', duration: 800, scale: 0.7 }),
    motion('stagger', 'targets', { after: 'hit', anchor: 'start', offset: 150, duration: 900, intensity: 0.6 }),
    impact('Dust', ['smoke.puff.side.grey'], { after: 'hit', anchor: 'start', offset: 400, duration: 1000, scale: 0.7, below: true }),
  ], { fx: false }),
  [F('feats-L0MUHNikE5fo2DQY')]: design('Thermal Conversion turns ambient heat into speed: a heat shimmer, then a fast dash.', () => [
    cast('Heat absorbed', ['fumes.fire.orange', 'cast_generic.fire.01.orange'], { stageId: 'heat', duration: 1000 }),
    motion('rush', 'source', { after: 'heat', anchor: 'start', offset: 250, duration: 1800, intensity: 0.6, distance: 4, motionRange: 'distance' }),
    sprite('Heat-haze trail', { after: 'heat', anchor: 'start', offset: 300, duration: 1300, opacity: 0.35, fadeOut: 700 }),
  ]),
  [F('feats-v1eX35bI4DRhmEWI')]: design('Thorny: you raise thorns and spines defensively for a minute.', () => [
    cast('Thorns bristle', ['aura_themed.01.inward.complete.wood.01.green', 'aura_themed.01.inward.complete.nature.01.green'], { stageId: 'thorn', duration: 1500 }),
    motion('shake', 'source', { duration: 600, intensity: 0.35 }),
  ]),
  [F('feats-rWwYSS1CnYNWPxor')]: design('Thunderous Slam: you drop to all fours with enough force to send tremors through creatures within 10 feet.', () => [
    motion('slam', 'source', { stageId: 'slam', duration: 800, intensity: 0.8 }),
    cast('Ground shockwave', ['impact.ground_crack.02.white', 'impact.ground_crack.02.orange'], { stageId: 'crack', after: 'slam', anchor: 'start', offset: 300, duration: 1500, scale: 1.5, below: true }),
    motion('stagger', 'targets', { after: 'crack', anchor: 'start', offset: 150, duration: 800, intensity: 0.5 }),
  ]),
  [F('feats-cwhtA9D80XcPfnhF')]: design('Timber!: you fall like a mighty tree, crushing creatures in a 10-foot line.', () => [
    motion('stagger', 'source', { stageId: 'topple', duration: 900, intensity: 0.8 }),
    area('Trunk crashes down', ['impact.ground_crack.01.white', 'impact.ground_crack.01.orange'], { stageId: 'crash', after: 'topple', anchor: 'start', offset: 600, duration: 1500, areaLayout: 'tiles', below: true }),
    motion('stagger', 'targets', { after: 'crash', anchor: 'start', duration: 700, intensity: 0.5 }),
  ]),
  [F('feats-u83c2XAxja0lLTfN')]: design('Toppling Shot: an aimed shot that knocks the target back 5 feet.', () => gun({ extra: [motion('dodge', 'targets', { after: 'hit', anchor: 'start', duration: 650, intensity: 0.5, distance: 1, motionRange: 'distance', motionHeading: 'away' })] })),
  [F('actions-cShf7HifoNI7XzKd')]: design('Toxic Tear: a beak Strike that pumps extra poison into a helpless creature.', () => [
    impact('Beak tears', ['melee_generic.piercing.one_handed', 'spear.melee.01.white'], { stageId: 'tear', duration: 1000 }),
    impact('Poison seeps', ['impact.001.green', 'impact.001.blue'], { after: 'tear', anchor: 'start', offset: 400, duration: 900, scale: 0.7 }),
    motion('lunge', 'source', { duration: 500, intensity: 0.6 }),
  ]),
  [F('actions-UeMHbnnaXDa3sGfG')]: design('Transfer Vitality moves Hit Points from your vitality network into a bonded creature.', () => [
    cast('Network channels', ['energy_strands.in.green.01'], { stageId: 'net', duration: 900 }),
    travel('Vitality flows', ['energy_strands.range.standard.dark_green.01', 'energy_strands.range.standard.purple.01'], { stageId: 'flow', after: 'net', anchor: 'start', offset: 300, duration: 1000, optionalTargets: true }),
    impact('Wounds close', ['healing_generic.200px.green'], { after: 'flow', anchor: 'arrival', duration: 1300, optionalTargets: true }),
  ]),
  [F('actions-KjoCEEmPGTeFE4hh')]: design('Treat Poison is medkit work on a patient, not a magic missile: a med-scan and recovery glow on the patient.', () => [
    impact('Med-scan', [sci(1, 'greenyellow')], { stageId: 'scan', duration: 1300, scale: 0.8, optionalTargets: true }),
    impact('Antidote takes effect', ['healing_generic.200px.green'], { after: 'scan', anchor: 'start', offset: 600, duration: 1300, scale: 0.8, optionalTargets: true }),
  ], { fx: false }),
  [F('feats-V0OlaVWSTWUh1qvm')]: design('Twin Guard: you raise a solar weapon to intercept a deadly blow.', () => [
    motion('brace', 'source', { stageId: 'guard', duration: 800, intensity: 0.45 }),
    cast('Solar blade intercepts', ['lasersword.melee.yellow.01', 'lasersword.melee.blue.01'], { after: 'guard', anchor: 'start', duration: 900, scale: 0.7, offsetX: 0.4, offsetUnits: 'token' }),
  ], { sound: 'sword', ...ABILITY }),
  [F('feats-rTebGqlQpa420YQy')]: design('Twisted Dark Zone fills your quantum field with gibbering darkness.', () => [
    cast('Dark reality bleeds in', ['energy_strands.in.purple', 'energy_strands.in.green.01'], { stageId: 'bleed', duration: 1000 }),
    aura('Darkness zone', ['darkness.black'], { after: 'bleed', anchor: 'start', offset: 300, duration: 2400, scale: 2.5, opacity: 0.8, fadeIn: 500, fadeOut: 700 }),
  ]),
  [F('feats-1gqUuNJYTrihbqzM')]: design('Uncanny Wonder: your uncanny evasion of a fumbled Strike confuses the attacker; a weave, not a Strike.', () => [
    motion('dodge', 'source', { stageId: 'weave', duration: 700, intensity: 0.4, distance: 0.3, motionRange: 'distance', motionHeading: 'left' }),
    impact('Distracted', ['swirling_sparkles.01.orangepurple', 'swirling_sparkles.01.blue'], { after: 'weave', anchor: 'start', offset: 300, duration: 1100, scale: 0.6 }),
    motion('stagger', 'targets', { after: 'weave', anchor: 'start', offset: 400, duration: 700, intensity: 0.35 }),
  ], { sound: null, fx: false }),
  [F('feats-vCDJybbGPmPErHQV')]: design('Unforgiving Fury: violence fuels your fury into temporary Hit Points.', () => fury({ label: 'Fury fuels you', auraLabel: 'Resilient fury' })),
  [F('feats-sKZJDPCrCehAC3Sq')]: design('Unleash Hell!: your Hellknight armor unleashes a gout of hellfire in a 30-foot cone.', () => [
    cast('Armor vents hellfire', ['cast_generic.fire.01.orange'], { stageId: 'vent', duration: 700, ...tint('#c0392b') }),
    area('Hellfire cone', ['breath_weapons02.burst.cone.fire.orange.01', 'breath_weapons.fire.cone.orange.01'], { after: 'vent', anchor: 'start', offset: 250, duration: 2300, ...tint('#d0391f') }),
    motion('brace', 'source', { after: 'vent', anchor: 'start', duration: 800, intensity: 0.35 }),
  ]),
  [F('feats-LEDQYYh1uYiK5qjU')]: design('Unleash Pneuma: a violent burst of spiritual essence strikes all adjacent creatures.', () => [
    cast('Pneuma gathers', ['energy_strands.in.purple', 'energy_strands.in.green.01'], { stageId: 'gather', duration: 800 }),
    cast('Spirit burst', ['impact.013.001.bluepurple', 'impact.013.001.orangeyellow'], { stageId: 'burst', after: 'gather', anchor: 'start', offset: 400, duration: 1200, scale: 1.6 }),
    motion('recoil', 'targets', { after: 'burst', anchor: 'start', duration: 700, intensity: 0.5 }),
  ], { sound: 'spirit' }),
  [F('feats-c0Jduoit1Lzo7gxF')]: design('Unleash Sota\'s Flame blasts plasma down a 120-foot line.', () => [
    cast('Sun\'s heat channels', ['cast_generic.fire.01.orange'], { stageId: 'heat', duration: 800 }),
    area('Plasma line', ['breath_weapons02.burst.line.fire.orange.01', 'breath_weapons.fire.line.orange'], { after: 'heat', anchor: 'start', offset: 300, duration: 2200, ...tint('#ffb04a') }),
    motion('brace', 'source', { after: 'heat', anchor: 'start', duration: 800, intensity: 0.35 }),
  ]),
  [F('feats-SAkw1zr6z8PKV3ZF')]: design('Unleashed Anger: your contained anger swells you to Large size.', () => fury({ label: 'Anger unleashed', auraLabel: 'Swollen with rage', grow: 0.8 })),
  [F('feats-2Ye5H37ZP0AYpxHT')]: design('Unstable Flare: a supercharged solar flare Strike against every enemy in a 15-foot burst.', () => [
    cast('Flare supercharges', ['ranged_helix.cast.001.orangeyellow', 'ranged_helix.cast.001.blue'], { stageId: 'charge', duration: 900 }),
    travel('Simultaneous flares', ['ranged_helix.Helix_only.001.orangeyellow', 'ranged_helix.Helix_only.001.blue'], { stageId: 'flares', after: 'charge', anchor: 'start', offset: 400, duration: 1000 }),
    impact('Flares strike', ['ranged_helix.hit.001.orangeyellow', 'ranged_helix.hit.001.blue'], { after: 'flares', anchor: 'arrival', duration: 1000 }),
  ], { sound: 'radiantRay' }),
  [F('feats-8Xp7Pj7w0jcoQVvW')]: design('Unstable Overdrive pushes your circuitry to the limit: quickened but glitching.', () => [
    cast('Overdrive', [sci(1, 'purplered')], { stageId: 'od', duration: 1200 }),
    aura('Glitching circuits', ['static_electricity.02.red', 'static_electricity.02.blue'], { after: 'od', anchor: 'start', offset: 400, duration: 1600, fadeOut: 500 }),
    motion('shake', 'source', { after: 'od', anchor: 'start', offset: 300, duration: 900, intensity: 0.35 }),
  ], { sound: 'electric' }),
  [F('feats-ruiw4DcY40C58F8f')]: design('Urchin: you flex the spines on your head and neck into the attacker.', () => spines(), { sound: 'naturalPierce', ...ABILITY }),
  [F('feats-SGcndFbKQDfHiwWr')]: design('Vapor Form: your body becomes an amorphous gaseous vapor.', () => [
    cast('Body evaporates', ['fumes.steam.white'], { stageId: 'steam', duration: 1500 }),
    sprite('Vaporous form', { after: 'steam', anchor: 'start', offset: 200, duration: 1500, opacity: 0.35, fadeOut: 600 }),
    motion('drift', 'source', { after: 'steam', anchor: 'start', offset: 300, duration: 1500, intensity: 0.3 }),
  ], { sound: 'transform' }),
  [F('feats-9OSyLqbvtNU028ae')]: design('Vector Reflector: your armor absorbs the kinetic energy of the blow.', () => [
    motion('brace', 'source', { stageId: 'brace', duration: 800, intensity: 0.45 }),
    aura('Kinetic absorption', ['shield.01.complete.01.blue'], { after: 'brace', anchor: 'start', offset: 150, duration: 1300 }),
  ], { sound: 'shieldStrike', ...ABILITY }),
  [F('feats-sFVRvgwfSbpjiJr5')]: design('Veil of Ink vents an obscuring ink cloud through a 10-foot emanation.', () => [
    cast('Ink vents', ['smoke.puff.centered.dark_black', 'smoke.puff.centered.grey'], { stageId: 'vent', duration: 900 }),
    area('Ink cloud', ['darkness.black'], { after: 'vent', anchor: 'start', offset: 300, duration: 2600, opacity: 0.85, fadeIn: 400, fadeOut: 800 }),
  ]),
  [F('feats-SuzoBwGsO1myKR8w')]: design('Venomous Cocktail: you chug a dose of poison to enrich your natural venom, not a Strike.', () => [
    cast('Chug the poison', ['fumes.toxic.green', 'fumes.04.complete.grey'], { stageId: 'chug', duration: 1300, scale: 0.7 }),
    aura('Venom enriched', ['icon.poison.dark_green'], { after: 'chug', anchor: 'start', offset: 400, duration: 1300, scale: 0.5, offsetY: -0.5, offsetUnits: 'token' }),
  ], { sound: 'poison' }),
  [F('feats-5u0FfMFohGG9tAAP')]: design('Visual Static scrubs you from enemies\' minds in a blast of psychic static.', () => [
    cast('Psychic static', ['static_electricity.03.purple', 'static_electricity.03.blue'], { stageId: 'static', duration: 1300, scale: 1.2 }),
    sprite('Concealed', { after: 'static', anchor: 'start', offset: 300, duration: 1400, opacity: 0.35, fadeOut: 600 }),
    motion('flicker', 'source', { after: 'static', anchor: 'start', offset: 300, duration: 900, intensity: 0.4 }),
  ]),
  [F('actions-oxYfBuSCruRWTqJ9')]: design('Volosian Spit breathes acid in a 30-foot cone.', () => [
    cast('Acid wells', ['liquid.splash_side.green', 'liquid.splash_side.blue'], { stageId: 'well', duration: 700, scale: 0.6 }),
    area('Acid cone', ['breath_weapons.poison.cone.green'], { after: 'well', anchor: 'start', offset: 250, duration: 2300, ...tint('#9fe05a') }),
    motion('lunge', 'source', { after: 'well', anchor: 'start', duration: 600, intensity: 0.3 }),
  ]),
  [F('actions-Pdam8vyOw6KSQvRe')]: design('Wail: a sonic wail through a 60-foot cone.', () => [
    cast('Wail', ['soundwave.02.blue'], { stageId: 'wail', duration: 1100 }),
    area('Sonic cone', ['breath_weapons02.burst.cone.arcana.purple.01', 'breath_weapons.cold.cone.blue'], { after: 'wail', anchor: 'start', offset: 250, duration: 2200, ...tint('#9ad7ff') }),
    motion('recoil', 'targets', { after: 'wail', anchor: 'start', offset: 600, duration: 700, intensity: 0.45 }),
  ]),
  [F('feats-WJwaAuKBPBLGT8yl')]: design('Waiting for your Moment: you hold back for the perfect moment, gaining a quickened first round.', () => [
    cast('Patient focus', ['eyes.01.bluegreen.single', 'eyes.01.dark_green.single'], { stageId: 'wait', scale: 0.55, offsetY: -0.5, offsetUnits: 'token', duration: 1400 }),
    motion('pulse', 'source', { after: 'wait', anchor: 'start', offset: 700, duration: 700, intensity: 0.25 }),
  ], { sound: null, fx: false }),
  [F('actions-ZoMpqQgDdlT13Jp0')]: design('Warp Reality activates your quantum field, a 20-foot burst of altered reality around a chosen point.', () => [
    cast('Reality bends', ['impact.013.001.bluepurple', 'impact.013.001.orangeyellow'], { stageId: 'bend', duration: 1000 }),
    area('Quantum field', ['zoning.outward.circle.once.bluegreen.01'], { stageId: 'field', after: 'bend', anchor: 'start', offset: 300, duration: 2000, opacity: 0.85, below: true }),
    area('Reality shimmers', [sci(2, 'bluepurple')], { after: 'field', anchor: 'start', offset: 300, duration: 1500, opacity: 0.6 }),
  ]),
  [F('feats-PRKr7ugCsMdaDrdK')]: design('Warp Wounds overlaps you with a reality where someone else was hurt in your stead.', () => [
    cast('Realities overlap', ['shimmer.01.purple', 'shimmer.01.blue'], { stageId: 'over', duration: 1300 }),
    sprite('Other-reality double', { after: 'over', anchor: 'start', offset: 200, duration: 1200, opacity: 0.35, offsetX: 0.3, offsetUnits: 'token', fadeOut: 600 }),
    motion('flicker', 'source', { after: 'over', anchor: 'start', offset: 250, duration: 800, intensity: 0.4 }),
  ], { sound: 'time' }),
  [F('feats-SVjJGIvTodhDjpaD')]: design('Weightless Defense: in zero-g you curl into a tight, guarded ball.', () => [
    motion('cower', 'source', { stageId: 'curl', duration: 1000, intensity: 0.6 }),
    motion('spin', 'source', { after: 'curl', anchor: 'start', offset: 200, duration: 1200, intensity: 0.2 }),
  ], { sound: null, fx: false }),
  [F('feats-B2BaUMz72Q2Z5CSe')]: design('Widen Area reconfigures your area weapon for a bigger spread; a targeting HUD widens, nothing fires yet.', () => [
    cast('Spread reconfigured', [sci(1, 'orangeyellow')], { stageId: 'cfg', duration: 1300 }),
    aura('Wider targeting arc', ['zoning.outward.cone.once.bluegreen.01'], { after: 'cfg', anchor: 'start', offset: 300, duration: 1500, opacity: 0.6, below: true }),
  ], { fx: false }),
  [F('feats-Srv7MbqIEqb5OHlC')]: design('World Shards unleashes superdense red-hot iron shards in a 30-foot cone.', () => [
    cast('Planetary cores call', ['cast_generic.earth.01', 'cast_generic.earth.01.browngreen'], { stageId: 'call', duration: 800 }),
    area('Red-hot iron shards', ['breath_weapons02.burst.cone.fire.orange.01', 'breath_weapons.fire.cone.orange.01'], { after: 'call', anchor: 'start', offset: 300, duration: 2200, ...tint('#ff6a2b') }),
    motion('recoil', 'targets', { after: 'call', anchor: 'start', offset: 900, duration: 700, intensity: 0.5 }),
  ]),
  [F('feats-tFQeG2J1OxlXi0TI')]: design('Wormhole Warren creates a pair of wormholes, one adjacent to you.', () => [
    cast('Wormhole opens', ['portals.vertical.ring.dark_purple', 'portals.vertical.ring.bright_yellow'], { stageId: 'open', duration: 2000, offsetX: 1, offsetUnits: 'token' }),
    motion('pulse', 'source', { duration: 700, intensity: 0.25 }),
  ]),
  [F('feats-Nvhq3MIQ1svU2lio')]: design('You Should See the Other Guy: after being crit, you Strike back in swift retribution.', () => [
    impact('Retribution', ['melee_generic.bludgeoning.one_handed', 'melee_generic.creature_attack.fist.001.red'], { stageId: 'hit', delay: 300, duration: 1100 }),
    motion('lunge', 'source', { delay: 200, duration: 550, intensity: 0.6 }),
    motion('stagger', 'targets', { after: 'hit', anchor: 'start', offset: 250, duration: 700, intensity: 0.45 }),
  ], { sound: 'unarmed', ...ABILITY }),
  [F('feats-M8kAxAXWRRWMRTzT')]: design('You\'ll Have to Go Through Me!: you Area/Auto-Fire, then brace to defend allies behind you.', () => autoFire({ extra: [motion('brace', 'source', { after: 'hits', anchor: 'start', offset: 300, duration: 900, intensity: 0.5 })] })),
  [F('feats-MsCW9UEjyWS73vz9')]: design('Zone Overlap layers a second zone onto your quantum field.', () => [
    cast('Second zone layers in', ['impact.013.002.bluepurple', 'impact.013.002.orangeyellow'], { stageId: 'layer', duration: 1000 }),
    aura('Overlapping fields', ['zoning.outward.circle.once.bluegreen.01'], { after: 'layer', anchor: 'start', offset: 300, duration: 1800, scale: 2, opacity: 0.75, below: true, ...tint('#b48cff') }),
  ], { sound: 'time' }),
  [F('feats-o7xxuslqMeEvsqha')]: design('Zoomies: a burst of pent-up energy and unpredictable motion.', () => [
    impact('Burst of energy', ['whirlwind.bluewhite', 'whirlwind.bluegrey'], { subject: 'source', stageId: 'zoom', duration: 1300, scale: 0.8 }),
    motion('spin', 'source', { duration: 800, intensity: 0.5 }),
    motion('dodge', 'source', { after: 'zoom', anchor: 'start', offset: 500, duration: 700, intensity: 0.5, distance: 0.6, motionRange: 'distance', motionHeading: 'right' }),
  ]),

  // ===== Weapons =============================================================
  [W('25ePewNhni6x8zgX')]: design('Acid Dart Rifle fires compressed-air darts whose corrosive load mixes on launch: an air puff, a dart, an acid splash.', () => [
    cast('Compressed-air puff', ['smoke.puff.side.02.white', 'smoke.puff.side.grey'], { stageId: 'puff', duration: 700, scale: 0.5 }),
    travel('Dart', ['dart.01.throw.physical.white', 'bolt.physical.orange'], { stageId: 'dart', after: 'puff', anchor: 'start', offset: 100, duration: 800 }),
    impact('Corrosive splash', ['liquid.splash.green', 'liquid.splash.blue'], { after: 'dart', anchor: 'arrival', duration: 1100, scale: 0.8, ...tint('#b8e580') }),
    motion('recoil', 'source', { after: 'puff', anchor: 'start', duration: 400, intensity: 0.3 }),
  ]),
  [W('uk9u5cX31uEuFMEa:area')]: design('Arc Emitter Area Fire: arcs of electricity crackle through the whole cone.', () => [
    cast('Rails charge', ['static_electricity.01.blue'], { stageId: 'charge', duration: 700, scale: 0.7 }),
    area('Arc cone', ['static_electricity.03.blue'], { stageId: 'cone', after: 'charge', anchor: 'start', offset: 250, duration: 1600 }),
    travel('Arcs', ['chain_lightning.primary.blue'], { after: 'charge', anchor: 'start', offset: 250, duration: 1000, optionalTargets: true }),
    motion('recoil', 'source', { after: 'charge', anchor: 'start', duration: 450, intensity: 0.4 }),
  ]),
  [W('4X0L8oORH8ty2tH4')]: design('Assassin Rifle: a scoped sniper shot with a hard kick.', () => gun({ round: ['bullet.Snipe.orange', 'bullet.Snipe.blue'], kick: 0.7 })),
  [W('dxkmvJZOblZ8oImW:area')]: design('Autotarget Rifle Auto-Fire unloads a magazine in one squeeze: muzzle burst and a spray into every target.', () => autoFire({ round: ['bullet.02.orange'], repeats: 4 })),
  [W('r2EzMZWgtMaJth6A')]: design('Blockthrower hypercools liquid into gigantic ice blocks slung at the target.', () => [
    cast('Coils hypercool', ['impact.frost.white.01', 'side_impact.part.slow.snowflake.blue'], { stageId: 'cool', duration: 700, scale: 0.6 }),
    projectile('Ice block', ['boulder.toss.02.01.ice.blue', 'boulder.toss.02.01.stone.brown'], { stageId: 'block', after: 'cool', anchor: 'start', offset: 200, duration: 1000, ...tint('#bfe8ff') }),
    impact('Block shatters', ['side_impact.ice_shard.blue'], { after: 'block', anchor: 'arrival', duration: 1000 }),
    motion('recoil', 'source', { after: 'cool', anchor: 'start', offset: 200, duration: 500, intensity: 0.6 }),
    motion('dodge', 'targets', { after: 'block', anchor: 'arrival', duration: 600, intensity: 0.4, distance: 0.5, motionRange: 'distance', motionHeading: 'away' }),
  ]),
  [W('V7epvZwIrMLMYI97')]: design('Coil Rifle accelerates its round on magnetic fields: a crackle of coil energy and a hypervelocity slug.', () => gun({ round: ['bullet.Snipe.blue'], kick: 0.7, extra: [cast('Coils discharge', ['static_electricity.01.blue'], { after: 'flash', anchor: 'start', duration: 700, scale: 0.5 })] })),
  [W('SiYdlPu9zfqZrBdR')]: design('Disintegration Lash: a black-snake whip crackling with red energy that sunders matter.', () => [
    impact('Lash', ['melee_attack.01.flail.01'], { stageId: 'lash', duration: 1100, ...tint('#2a1a1a') }),
    impact('Red disintegration crackle', ['static_electricity.01.dark_red', 'static_electricity.01.blue'], { after: 'lash', anchor: 'start', offset: 350, duration: 1000, scale: 0.8 }),
    motion('lunge', 'source', { duration: 600, intensity: 0.5 }),
  ]),
  [W('3yWQhmBrAXnBhYaF:ranged')]: design('Flamethrower spews burning chemicals, not bullets.', () => [
    cast('Igniter', ['cast_generic.fire.side01.orange', 'cast_generic.fire.01.orange'], { stageId: 'ign', duration: 600, scale: 0.6 }),
    travel('Flame jet', ['fire_bolt.orange'], { stageId: 'jet', after: 'ign', anchor: 'start', offset: 150, duration: 900 }),
    impact('Burning chemicals', ['impact.fire.01.orange', 'explosion.01.orange'], { after: 'jet', anchor: 'arrival', duration: 1000 }),
    motion('recoil', 'source', { after: 'ign', anchor: 'start', duration: 450, intensity: 0.3 }),
  ], { sound: 'fireCone' }),
  [W('3yWQhmBrAXnBhYaF:area')]: design('Flamethrower Area Fire fills the cone with orange chemical fire.', () => [
    cast('Igniter', ['cast_generic.fire.side01.orange', 'cast_generic.fire.01.orange'], { stageId: 'ign', duration: 600, scale: 0.6 }),
    area('Cone of fire', ['breath_weapons.fire.cone.orange.01'], { after: 'ign', anchor: 'start', offset: 200, duration: 2200 }),
    motion('shake', 'source', { after: 'ign', anchor: 'start', duration: 1000, intensity: 0.3 }),
  ], { sound: 'fireCone' }),
  [W('yJYorlEvJLSxc3VS:thrown')]: design('Flash grenade: a blast of bright light that dazzles, not shrapnel.', () => flashBang('thrown')),
  [W('yJYorlEvJLSxc3VS:area')]: design('Flash grenade Area Fire: blinding light fills the burst.', () => flashBang('area')),
  [W('yZ1PddTL7huZhECC:thrown')]: design('Flash grenade: a blast of bright light that dazzles, not shrapnel.', () => flashBang('thrown')),
  [W('yZ1PddTL7huZhECC:area')]: design('Flash grenade Area Fire: blinding light fills the burst.', () => flashBang('area')),
  [W('zQlnRRTdC4pdwCvi:thrown')]: design('Flash grenade: a blast of bright light that blinds and dazzles, not shrapnel.', () => flashBang('thrown')),
  [W('zQlnRRTdC4pdwCvi:area')]: design('Flash grenade Area Fire: blinding light fills the burst.', () => flashBang('area')),
  [W('KtThxo7Jv7eYAiwR:thrown')]: design('Flash grenade: a blast of bright light that blinds and dazzles, not shrapnel.', () => flashBang('thrown')),
  [W('KtThxo7Jv7eYAiwR:area')]: design('Flash grenade Area Fire: blinding light fills the burst.', () => flashBang('area')),
  [W('z4hYYCFlMRypJ6Wd:thrown')]: design('Flash grenade: a blast of bright light that dazzles, not shrapnel.', () => flashBang('thrown')),
};
