// Bespoke compositions (pf2e-feats-d). Keys: '<system>:<entryId>' or '<system>:<entryId>:<variant|mode>'.
// See scripts/catalogs/bespoke/helpers.mjs and scripts/bespoke.mjs.
import { cast, travel, projectile, impact, area, aura, sprite, motion, tint, spin, breathe, design } from './helpers.mjs';

// Shared art (Patreon first, Free fallback last).
const SLASH = ['melee_generic.slashing.one_handed', 'melee_generic.slash.01.orange'];
const SLASH2 = ['melee_generic.slashing.two_handed', 'greatsword.melee.standard.white'];
const PIERCE = ['melee_generic.piercing.one_handed', 'spear.melee.01.white'];
const BLUDGEON2 = ['melee_generic.bludgeoning.two_handed', 'hammer.melee.01.white'];
const PUNCH = ['unarmed_strike.physical.02.blue'];
const FIST = ['melee_generic.creature_attack.fist.002.blue'];
const OUT_GOLD = ['template_circle.out_pulse.01.burst.yellowwhite', 'template_circle.out_pulse.01.burst.bluewhite'];
// Keep a generated recipe's visual/motion stages and add accents to them.
const keep = recipe => recipe.stages.filter(s => s.kind !== 'sound');
const idOf = (recipe, kind) => recipe.stages.find(s => s.kind === kind)?.stageId;

export default {
  // ---------------------------------------------------------------- P
  'pf2e:IfoxFY9kzP4KG9gi': design('Pluck from the Sky: a Strike against a flier that drives it down out of the air.', () => [
    impact('Strike on the flier', SLASH, { stageId: 'hit', delay: 350, duration: 1400 }),
    motion('lunge', 'source', { delay: 100, duration: 1000, intensity: 0.6 }),
    motion('press', 'targets', { after: 'hit', anchor: 'start', offset: 450, duration: 1100, intensity: 0.7 }),
    impact('Downdraft dust', ['smoke.puff.side.grey', 'smoke.puff.side.grey'], { after: 'hit', anchor: 'start', offset: 750, duration: 1200, scale: 0.8, below: true }),
  ]),
  'pf2e:D8XoWk1brpyW6oO2': design('Plum Deluge: three identical plum-coloured vials are thrown up, shatter, and rain contact poison over everyone in the burst.', () => [
    motion('throw', 'source', { duration: 1100, intensity: 0.5 }),
    projectile('Three vials arc out', ['throwable.throw.flask.03.purple', 'throwable.throw.flask.01.orange'], { stageId: 'vials', delay: 200, duration: 1300, scale: 0.7, repeats: 3, repeatInterval: 180, targetSelection: 'first' }),
    impact('Vials shatter overhead', ['explosion.side_fracture.flask.02', 'explosion.side_fracture.flask.01'], { stageId: 'burst', after: 'vials', anchor: 'arrival', duration: 1200, scale: 0.8, offsetY: -0.4, offsetUnits: 'token' }),
    impact('Poison deluge', ['liquid.splash.bright_purple', 'liquid.splash.blue'], { after: 'burst', anchor: 'start', offset: 250, duration: 1600, scale: 1.2, ...tint('#9b4fc9') }),
    impact('Poison haze lingers', ['smoke.puff.centered.dark_purple', 'smoke.puff.centered.grey'], { after: 'burst', anchor: 'start', offset: 700, duration: 2000, scale: 1.3, opacity: 0.8 }),
    motion('cower', 'targets', { after: 'burst', anchor: 'start', offset: 400, duration: 1100, intensity: 0.4 }),
  ], { sound: 'bomb-poison', soundNamespace: 'ability' }),
  'pf2e:eHkMcQQ4ejRAFJAt': design('Poison Coat: venom is brushed into the clothing, leaving a toxic sheen on the wearer.', () => [
    cast('Venom drips', ['liquid.blob.green', 'liquid.blob.blue'], { stageId: 'drip', duration: 1300, scale: 0.45, ...tint('#5fbf3a') }),
    aura('Poisoned garment', ['markers.poison.dark_green.01'], { after: 'drip', anchor: 'start', offset: 600, duration: 1900, scale: 0.8, opacity: 0.85, fadeIn: 250, fadeOut: 400 }),
  ]),
  'pf2e:ALbosSUygdq4T1Yk': design('Poison Weapon: a dose of contact or injury poison is daubed onto the wielded weapon.', () => [
    cast('Poison drawn', ['icon.poison.dark_green'], { stageId: 'vial', duration: 1000, scale: 0.45, offsetY: -0.45, offsetUnits: 'token', fadeIn: 150, fadeOut: 300 }),
    aura('Venom coats the blade', ['liquid.blob.green', 'liquid.blob.blue'], { after: 'vial', anchor: 'start', offset: 500, duration: 1400, scale: 0.4, offsetX: 0.35, offsetUnits: 'token', ...tint('#5fbf3a') }),
    aura('Toxic sheen', ['markers.poison.dark_green.01'], { after: 'vial', anchor: 'start', offset: 900, duration: 1600, scale: 0.7, opacity: 0.8, fadeIn: 200, fadeOut: 400 }),
  ]),
  'pf2e:pKoW1X95LjmWn5Jq': design('Poisoner\'s Twist: the weapon already in the wound twists, driving poison into the weakened body system.', () => [
    impact('Weapon twists in the wound', PIERCE, { stageId: 'twist', duration: 1300, scale: 0.9 }),
    motion('lunge', 'source', { duration: 900, intensity: 0.35 }),
    impact('Poison floods in', ['impact_themed.poison.greenyellow', 'impact.003.blue'], { after: 'twist', anchor: 'start', offset: 450, duration: 1300, ...tint('#7bd64a') }),
    impact('Toxin spreads', ['markers.poison.dark_green.01'], { after: 'twist', anchor: 'start', offset: 900, duration: 1500, scale: 0.7, opacity: 0.85 }),
    motion('stagger', 'targets', { after: 'twist', anchor: 'start', offset: 450, duration: 1000, intensity: 0.5 }),
  ]),
  'pf2e:hDvjODvJXdFjZJ81': design('Ponpoko-Pon!: two thunderous belly-drum beats push a 30-foot cone of sonic force over the foes.', () => [
    cast('Belly drum beats', ['soundwave.02.blue'], { stageId: 'drum', duration: 900, scale: 0.9, repeats: 2, repeatInterval: 450 }),
    motion('pulse', 'source', { duration: 900, intensity: 0.4, repeats: 2, repeatInterval: 450 }),
    travel('Sonic cone', ['breath_weapons02.burst.cone.arcana.purple.01', 'breath_weapons.cold.cone.blue'], { stageId: 'cone', after: 'drum', anchor: 'start', offset: 700, duration: 1600, targetSelection: 'first', opacity: 0.8, ...tint('#7fe0d0') }),
    impact('Pressure hits', ['shatter.blue'], { after: 'cone', anchor: 'start', offset: 450, duration: 1200, scale: 0.9 }),
    motion('stagger', 'targets', { after: 'cone', anchor: 'start', offset: 450, duration: 1000, intensity: 0.5 }),
  ]),
  'pf2e:TEH73yqZBqByO624': design('Positioning Assault: a punishing two-handed blow that shoves the foe 5 feet into position.', () => [
    impact('Two-handed blow', SLASH2, { stageId: 'hit', delay: 400, duration: 1400 }),
    motion('lunge', 'source', { delay: 100, duration: 1050, intensity: 0.7 }),
    motion('dodge', 'targets', { after: 'hit', anchor: 'start', offset: 450, duration: 1300, distance: 1, motionRange: 'distance', intensity: 0.5 }),
  ]),
  'pf2e:2qR4QAgJVArv63Z2': design('Prayer-Touched Weapon: divine prayer coats the weapon with vitality light for the rest of the turn.', () => [
    cast('Prayer rises', ['divine_smite.caster.yellowwhite', 'divine_smite.caster.blueyellow'], { stageId: 'pray', duration: 1500, scale: 0.75 }),
    aura('Weapon glows with vitality', ['sacred_flame.source.white', 'sacred_flame.source.yellow'], { after: 'pray', anchor: 'start', offset: 700, duration: 1700, scale: 0.5, offsetX: 0.35, offsetUnits: 'token', fadeIn: 200, fadeOut: 400 }),
  ], { sound: 'holy' }),
  'pf2e:WQa6PxkOgyvRpaaM': design('Predator\'s Growl: a throaty growl at the creature just found, demoralizing it without shared language.', () => [
    cast('Throaty growl', ['soundwave.01.red', 'soundwave.01.blue'], { stageId: 'growl', duration: 1100, scale: 0.8 }),
    motion('shake', 'source', { duration: 700, intensity: 0.3 }),
    impact('Prey is shaken', ['markers.fear.dark_orange.01', 'markers.fear.dark_purple.01'], { after: 'growl', anchor: 'start', offset: 500, duration: 1600, scale: 0.75 }),
    motion('cower', 'targets', { after: 'growl', anchor: 'start', offset: 500, duration: 1300, intensity: 0.4 }),
  ]),
  'pf2e:YojUMTTPbLdqk5Rq': design('Promise of Pain: a spoken promise of unending pain lashes a sickened enemy with mental damage.', () => [
    cast('Cruel promise', ['soundwave.02.purple', 'soundwave.02.blue'], { stageId: 'voice', duration: 1000, scale: 0.7 }),
    travel('Promise reaches the mind', ['energy_strands.range.standard.dark_purple.01', 'energy_strands.range.standard.purple.01'], { stageId: 'beam', after: 'voice', anchor: 'start', offset: 450, duration: 1300 }),
    impact('Mental anguish', ['impact_themed.skull.pinkpurple', 'icon.skull.purple'], { after: 'beam', anchor: 'arrival', duration: 1400, scale: 0.8 }),
    motion('cower', 'targets', { after: 'beam', anchor: 'arrival', duration: 1200, intensity: 0.45 }),
  ], { sound: 'psychic' }),
  'pf2e:q8c0LINVNcJrdK91': design('Propulsive Leap: flames jet from the feet and launch the deviant into flight.', () => [
    cast('Flames jet downward', ['fire_jet.orange'], { stageId: 'jet', duration: 1300, scale: 0.55, rotation: 90, offsetY: 0.45, offsetUnits: 'token', below: true }),
    aura('Exhaust ring', ['smoke.puff.ring.01.white'], { after: 'jet', anchor: 'start', offset: 200, duration: 1300, scale: 1.1, below: true }),
    motion('levitate', 'source', { after: 'jet', anchor: 'start', offset: 250, duration: 1800, intensity: 0.4 }),
  ], { sound: 'fire' }),
  'pf2e:ryBj7phZqASQSEjV': design('Psi Burst: a passing thought hurls violent psychic force that batters one creature within 30 feet.', () => [
    cast('Thought gathers', ['cast_shape.circle.01.purple', 'cast_shape.circle.01.blue'], { stageId: 'think', duration: 900, scale: 0.7, ...tint('#b06cff') }),
    travel('Psychic force', ['ranged.03.instant.01.pinkpurple', 'ranged.03.instant.01.bluegreen'], { stageId: 'bolt', after: 'think', anchor: 'start', offset: 450, duration: 1100, ...tint('#b06cff') }),
    impact('Bludgeoning psychic blow', ['impact.007.purple', 'impact.004.blue'], { after: 'bolt', anchor: 'arrival', duration: 1200, ...tint('#b06cff') }),
    motion('recoil', 'targets', { after: 'bolt', anchor: 'arrival', duration: 750, intensity: 0.6 }),
  ], { sound: 'psychic' }),
  'pf2e:qZsTI97BQUwoPgKF': design('Psi Catastrophe: all held-back psychic power erupts in a catastrophic 20-foot blast around the psychic.', () => [
    cast('Power unleashed', ['cast_shape.circle.single01.purple', 'cast_shape.circle.single01.blue'], { stageId: 'gather', duration: 900, scale: 0.9, ...tint('#b06cff') }),
    motion('shake', 'source', { duration: 900, intensity: 0.4 }),
    aura('Catastrophic blast', ['explosion.04.dark_purple', 'explosion.02.blue'], { stageId: 'blast', after: 'gather', anchor: 'start', offset: 650, duration: 1800, scale: 3.8, ...tint('#a35cff') }),
    aura('Shockwave', ['template_circle.out_pulse.02.burst.purplepink', 'template_circle.out_pulse.02.burst.bluewhite'], { after: 'blast', anchor: 'start', duration: 1600, scale: 4.2, opacity: 0.8, below: true, ...tint('#b06cff') }),
    impact('Force strikes', ['impact.007.purple', 'impact.004.blue'], { after: 'blast', anchor: 'start', offset: 300, duration: 1100, ...tint('#b06cff') }),
    motion('recoil', 'targets', { after: 'blast', anchor: 'start', offset: 300, duration: 800, intensity: 0.7 }),
  ], { sound: 'psychic' }),
  'pf2e:HoU7pgdW7KPO347H': design('Pummeling Whirlpool: water drawn from the surroundings swirls into a 10-foot torrent that batters and topples nearby foes.', () => [
    cast('Water drawn in', ['water_splash.circle.01.blue'], { stageId: 'draw', duration: 1000, scale: 1 }),
    aura('Swirling torrent', ['template_circle.vortex.loop.blue'], { stageId: 'vortex', after: 'draw', anchor: 'start', offset: 400, duration: 2600, scale: 2.6, opacity: 0.85, below: true, fadeIn: 300, fadeOut: 500, ...spin(2400, 1) }),
    aura('Spray', ['water_splash.circle.01.blue'], { after: 'vortex', anchor: 'start', offset: 300, duration: 1500, scale: 2.4 }),
    impact('Water pummels', ['impact.water.02.blue'], { after: 'vortex', anchor: 'start', offset: 600, duration: 1200, scale: 1.1 }),
    motion('stagger', 'targets', { after: 'vortex', anchor: 'start', offset: 600, duration: 1100, intensity: 0.6 }),
  ]),
  'pf2e:mwPOOTtELS4X7reC': design('Pyre Ant Sting: the swarm of burning-red ants stings every creature in its space.', () => [
    impact('Ant swarm', ['fireflies.many.01.red', 'fireflies.many.01.green'], { stageId: 'swarm', duration: 2200, scale: 1, ...tint('#e0452a') }),
    impact('Burning stings', ['impact.fire.01.orange'], { after: 'swarm', anchor: 'start', offset: 500, duration: 1000, scale: 0.45, repeats: 3, repeatInterval: 300 }),
    motion('shake', 'targets', { after: 'swarm', anchor: 'start', offset: 500, duration: 1200, intensity: 0.35 }),
  ], { sound: 'swarm' }),
  // ---------------------------------------------------------------- Q
  'pf2e:FMjihpGLn9eQ14Gw': design('Quaking Stomp: a stomp so forceful it sets off a minor earthquake around the barbarian.', () => [
    motion('slam', 'source', { duration: 1100, intensity: 0.6 }),
    aura('Stomp impact', ['impact.ground_crack.03.orange'], { stageId: 'stomp', delay: 350, duration: 1600, scale: 2, below: true }),
    aura('Ground splits', ['ground_cracks.03.orange'], { after: 'stomp', anchor: 'start', offset: 250, duration: 2600, scale: 3.5, below: true, fadeOut: 600 }),
    motion('shake', 'targets', { after: 'stomp', anchor: 'start', offset: 300, duration: 1500, intensity: 0.4 }),
  ]),
  'pf2e:it5yM6sbwJJysm9U': design('Quick Root: roots sprout from the legs and plunge into the ground to hold footing.', () => [
    cast('Roots plunge down', ['vine.complete.nature.group.01.green'], { stageId: 'roots', duration: 1600, scale: 0.9, below: true }),
    aura('Rooted stance', ['plant_growth.03.round.2x2.complete.greenyellow'], { after: 'roots', anchor: 'start', offset: 300, duration: 1600, scale: 0.9, below: true, opacity: 0.8 }),
    motion('brace', 'source', { after: 'roots', anchor: 'start', offset: 150, duration: 1100, intensity: 0.5 }),
  ], { sound: 'vines' }),
  'pf2e:ux6kbsqRMsu9VHtn': design('Quill Spray: a mass of quills is launched across a 30-foot cone, piercing every foe in it.', () => [
    motion('pulse', 'source', { duration: 600, intensity: 0.3 }),
    travel('Quills fly', ['dart.01.throw.physical.white', 'arrow.physical.white.01'], { stageId: 'quills', delay: 250, duration: 900, scale: 0.6, repeats: 3, repeatInterval: 120 }),
    impact('Quills pierce', ['impact.005.white', 'impact.005.orange'], { after: 'quills', anchor: 'arrival', duration: 800, scale: 0.6 }),
    motion('recoil', 'targets', { after: 'quills', anchor: 'arrival', duration: 700, intensity: 0.5 }),
  ], { sound: 'pierce' }),
  'pf2e:2XmdYW8OsAvjGDG3': design('Radiant Circuitry: biological circuitry lights up like a torch, casting bright light around the android.', () => [
    cast('Circuits ignite', ['markers.light.intro.yellow', 'markers.light.intro.blue'], { stageId: 'on', duration: 1100, scale: 0.8, ...tint('#ffd77a') }),
    aura('Torchlight', ['dancing_light.yellow'], { after: 'on', anchor: 'start', offset: 500, duration: 2200, scale: 2.4, opacity: 0.55, below: true, fadeIn: 400, fadeOut: 600 }),
  ], { sound: 'light' }),
  'pf2e:FL5Ecvy7WYU1OzVv': design('Radiate Glory: celestial glory pours from the nephilim, dazzling every creature that sees it.', () => [
    cast('Divine glory', ['divine_smite.caster.yellowwhite', 'divine_smite.caster.blueyellow'], { stageId: 'glory', duration: 1400, scale: 0.9 }),
    aura('Radiance spreads', OUT_GOLD, { after: 'glory', anchor: 'start', offset: 500, duration: 1800, scale: 3.2, opacity: 0.85, below: true, ...tint('#ffe08a') }),
    aura('Shining figure', ['dancing_light.yellow'], { after: 'glory', anchor: 'start', offset: 500, duration: 2200, scale: 1.4, opacity: 0.7, fadeIn: 300, fadeOut: 500 }),
  ], { sound: 'holy' }),
  'pf2e:llWnSLYALh88iRGQ': design('Rain of Bolts: the automaton\'s chassis fires every stored bolt at once across the area.', () => [
    cast('Chassis ports open', ['impact.005.orange'], { stageId: 'ports', duration: 700, scale: 0.6 }),
    motion('recoil', 'source', { delay: 250, duration: 700, intensity: 0.4 }),
    travel('Volley of bolts', ['bolt.physical.white', 'bolt.physical.orange'], { stageId: 'volley', delay: 250, duration: 1000, repeats: 3, repeatInterval: 120 }),
    impact('Bolts strike', ['impact.005.white', 'impact.005.orange'], { after: 'volley', anchor: 'arrival', duration: 800, scale: 0.6 }),
    motion('recoil', 'targets', { after: 'volley', anchor: 'arrival', duration: 700, intensity: 0.5 }),
  ], { sound: 'crossbow', soundNamespace: 'ability' }),
  'pf2e:879dW5QkNDS66Ue3': design('Rain of Razors: razor-sharp metal slivers fall from the sky over the burst and embed in every surface.', () => [
    cast('Metal summoned', ['cast_generic.03.white', 'cast_generic.02.blue'], { stageId: 'call', duration: 900, scale: 0.7, ...tint('#c8d0d8') }),
    impact('Razors fall', ['cloud_of_daggers.kunai.blue', 'cloud_of_daggers.daggers.blue'], { stageId: 'rain', after: 'call', anchor: 'start', offset: 500, duration: 2200, scale: 1.3, ...tint('#c8d0d8') }),
    impact('Slivers embed', ['impact.ground_crack.white.01', 'impact.ground_crack.frost.01.white'], { after: 'rain', anchor: 'start', offset: 900, duration: 1500, scale: 1.1, below: true }),
    motion('stagger', 'targets', { after: 'rain', anchor: 'start', offset: 700, duration: 1200, intensity: 0.5 }),
  ]),
  'pf2e:t3BPLh4rEInYGJJW': design('Rain of Rust: a red raincloud pours rust-coloured corrosive rain on the burst below it.', () => [
    impact('Red raincloud', ['smoke.plumes.01.dark_red', 'smoke.plumes.01.grey'], { stageId: 'cloud', duration: 2600, scale: 1.3, offsetY: -0.7, offsetUnits: 'token', opacity: 0.85, ...tint('#9b3b22') }),
    impact('Rust rain', ['template_square.raindrops.001.5x5.instant.combined.orangeyellow', 'template_square.raindrops.001.5x5.instant.combined.blue'], { after: 'cloud', anchor: 'start', offset: 500, duration: 2000, scale: 1.2, ...tint('#b5562b') }),
    motion('cower', 'targets', { after: 'cloud', anchor: 'start', offset: 700, duration: 1200, intensity: 0.3 }),
  ]),
  'pf2e:7ZPm0P6vY9FlVtoy': design('Raise Island: the sea churns and sweeps enemies around the area, then a pillar of earth lifts the exemplar.', () => [
    aura('Sea churns', ['water_splash.circle.01.blue'], { stageId: 'churn', duration: 1600, scale: 3.2 }),
    impact('Enemies swept up', ['water_splash.circle.01.blue'], { after: 'churn', anchor: 'start', offset: 400, duration: 1400, scale: 1 }),
    motion('dodge', 'targets', { after: 'churn', anchor: 'start', offset: 400, duration: 1400, distance: 2, motionRange: 'distance', intensity: 0.6 }),
    aura('Pillar of earth', ['impact.ground_crack.02.orange'], { stageId: 'pillar', after: 'churn', anchor: 'start', offset: 1300, duration: 1600, scale: 1.4, below: true }),
    motion('levitate', 'source', { after: 'pillar', anchor: 'start', offset: 150, duration: 1600, intensity: 0.5 }),
  ], { sound: 'water' }),
  'pf2e:8l3qDZrfhxUGijjB': design('Rallying Cry: a shouted call quickens every ally within 30 feet and steels them with temporary Hit Points.', () => [
    cast('Rallying shout', ['soundwave.02.orangeyellow', 'soundwave.02.blue'], { stageId: 'shout', duration: 1100, scale: 0.9 }),
    motion('pulse', 'source', { duration: 800, intensity: 0.4 }),
    aura('Call carries', OUT_GOLD, { after: 'shout', anchor: 'start', offset: 300, duration: 1500, scale: 3.2, opacity: 0.75, below: true, ...tint('#ffcf6a') }),
    impact('Allies invigorated', ['on_token_buff.001.001.orangeyellow'], { after: 'shout', anchor: 'start', offset: 700, duration: 1600, scale: 0.9 }),
  ], { sound: 'battleCry', soundNamespace: 'ability' }),
  'pf2e:u2en8XQqxX9mQxkm': design('Rattle the Earth: the kineticist strikes the ground and an earthquake ripples out over the foes.', () => [
    motion('slam', 'source', { duration: 1100, intensity: 0.6 }),
    aura('Ground struck', ['impact.ground_crack.03.orange'], { stageId: 'strike', delay: 350, duration: 1600, scale: 1.8, below: true }),
    impact('Fissures open', ['ground_cracks.02.orange'], { after: 'strike', anchor: 'start', offset: 400, duration: 2200, scale: 1.4, below: true, fadeOut: 500 }),
    impact('Debris jolts', ['falling_rocks.top.1x1.sandstone', 'falling_rocks.top.1x1.grey'], { after: 'strike', anchor: 'start', offset: 600, duration: 1500, scale: 0.9 }),
    motion('shake', 'targets', { after: 'strike', anchor: 'start', offset: 400, duration: 1500, intensity: 0.5 }),
  ]),
  'pf2e:mHvkBdBN4gs6CH1g': design('Ravel of Thorns: thorny vines grow in geometric patterns across the kinetic aura.', () => [
    cast('Wood answers', ['cast_generic.earth.01.browngreen'], { stageId: 'call', duration: 900, scale: 0.8 }),
    aura('Thorny vines spread', ['vine.complete.nature.group.02.green'], { stageId: 'vines', after: 'call', anchor: 'start', offset: 350, duration: 2400, scale: 2.4, below: true, fadeOut: 500 }),
    aura('Geometric growth', ['plant_growth.02.ring.4x4.complete.greenred', 'plant_growth.03.ring.4x4.complete.greenyellow'], { after: 'vines', anchor: 'start', offset: 200, duration: 2200, scale: 1.6, below: true, opacity: 0.8 }),
  ]),
  'pf2e:qpoE2KhsPbF1ZDsx': design('Ravenous Charge: a hungry rush at a living creature, grabbing it and biting with gnashing jaws.', () => [
    motion('rush', 'source', { duration: 2400, distance: 6, motionRange: 'target', motionHeading: 'toward', motionEndpoint: 'near', intensity: 0.5 }),
    impact('Jaws bite', ['bite.200px.red'], { stageId: 'bite', delay: 1000, duration: 1100, scale: 0.9 }),
    motion('stagger', 'targets', { after: 'bite', anchor: 'start', offset: 250, duration: 900, intensity: 0.5 }),
  ], { sound: 'naturalPierce', soundNamespace: 'ability' }),
  'pf2e:ssrublnppwFSvVcb': design('Reach for the Sky: a gun is fired into the air and every nearby enemy is ordered to surrender.', () => [
    cast('Shot into the air', ['muzzle_flash.single.01.yellow'], { stageId: 'shot', duration: 700, scale: 0.7, rotation: -90, offsetY: -0.55, offsetUnits: 'token' }),
    motion('recoil', 'source', { duration: 600, intensity: 0.35 }),
    aura('Powder smoke', ['smoke.puff.side.grey'], { after: 'shot', anchor: 'start', offset: 100, duration: 1300, scale: 0.6, rotation: -90, offsetY: -0.7, offsetUnits: 'token' }),
    impact('Hands go up', ['markers.fear.orange.01', 'markers.fear.dark_purple.01'], { after: 'shot', anchor: 'start', offset: 550, duration: 1600, scale: 0.7 }),
    motion('cower', 'targets', { after: 'shot', anchor: 'start', offset: 550, duration: 1300, intensity: 0.45 }),
  ], { sound: 'gunshotAir', soundNamespace: 'ability' }),
  'pf2e:mNiJvsbyxdLBnTRs': design('Rebirth in Living Stone: rock overflows to consume the kineticist, then cracks open to reveal a body of living stone.', () => [
    cast('Rock engulfs the form', ['falling_rocks.top.1x1.sandstone', 'falling_rocks.top.1x1.grey'], { stageId: 'engulf', duration: 1300, scale: 1.2 }),
    aura('Stone shell cracks open', ['explosion.shrapnel.bomb.01.grey', 'explosion.shrapnel.bomb.01.black'], { stageId: 'crack', after: 'engulf', anchor: 'start', offset: 900, duration: 1100, scale: 0.8 }),
    aura('Living stone settles', ['impact.ground_crack.white.01', 'impact.ground_crack.orange.01'], { after: 'crack', anchor: 'start', offset: 150, duration: 1400, scale: 1.2, below: true }),
    motion('brace', 'source', { after: 'crack', anchor: 'start', duration: 1100, intensity: 0.5 }),
  ]),
  'pf2e:wUBodqhXq3n4XbvK': design('Reel \'Em In: a harpoon or spear strike hooks the foe and hauls it 10 feet closer.', () => [
    impact('Harpoon strike', PIERCE, { stageId: 'hit', delay: 350, duration: 1300 }),
    motion('lunge', 'source', { delay: 100, duration: 1000, intensity: 0.6 }),
    impact('Line goes taut', ['markers.chain.standard.complete.02.grey', 'markers.chain.standard.complete.02.red'], { after: 'hit', anchor: 'start', offset: 450, duration: 1300, scale: 0.7 }),
    motion('rush', 'targets', { after: 'hit', anchor: 'start', offset: 600, duration: 1500, distance: 2, motionRange: 'distance', motionHeading: 'toward', intensity: 0.4 }),
  ], { sound: 'spear', soundNamespace: 'ability' }),
  'pf2e:0M7kfn0ifdwWioOQ': design('Regurgitate Mutagen: the mutagen is spat out as a stream of stomach acid at a foe within 30 feet.', () => [
    motion('lunge', 'source', { duration: 800, intensity: 0.3 }),
    travel('Acid stream', ['breath_weapons.acid.line.green'], { stageId: 'spit', delay: 200, duration: 1400 }),
    impact('Acid splashes', ['liquid.splash_side.bright_green', 'liquid.splash_side.blue'], { after: 'spit', anchor: 'arrival', duration: 1200, ...tint('#8fdc3a') }),
    motion('stagger', 'targets', { after: 'spit', anchor: 'arrival', duration: 1000, intensity: 0.5 }),
  ]),
  'pf2e:LFS9M737RCt0Jq8r': design('Rejoice in Solstice Storm: a storm of the four seasons spirals out 30 feet from the exemplar\'s embrace.', () => [
    cast('Arms open to the seasons', ['cast_generic.03.greenyellow', 'cast_generic.02.blue'], { stageId: 'open', duration: 900, scale: 0.8 }),
    aura('Seasonal storm spirals', ['whirlwind.bluewhite', 'whirlwind.bluegrey'], { stageId: 'storm', after: 'open', anchor: 'start', offset: 450, duration: 2600, scale: 3.2, opacity: 0.75, fadeIn: 300, fadeOut: 500 }),
    aura('Spring and autumn leaves', ['swirling_leaves.outburst.01.greenorange', 'swirling_leaves.outburst.01.pink'], { after: 'storm', anchor: 'start', duration: 2000, scale: 3 }),
    aura('Winter flurry', ['sleet_storm.01.blue', 'sleet_storm.01.blue'], { after: 'storm', anchor: 'start', offset: 400, duration: 2000, scale: 2.4, opacity: 0.6 }),
    impact('Seasons strike', ['swirling_leaves.complete.01.orangered', 'swirling_leaves.complete.01.green'], { after: 'storm', anchor: 'start', offset: 600, duration: 1500, scale: 0.9 }),
    motion('stagger', 'targets', { after: 'storm', anchor: 'start', offset: 600, duration: 1100, intensity: 0.5 }),
  ], { sound: 'wind' }),
  'pf2e:YePPw9Oc4JlDAmYD': design('Release Spores: a miasma of spores fills a 20-foot burst, concealing everything inside it.', () => [
    cast('Spores expelled', ['smoke.puff.side.dark_green', 'smoke.puff.side.grey'], { stageId: 'expel', duration: 1000, scale: 0.7, ...tint('#7b8f3a') }),
    impact('Spore miasma', ['smoke.puff.centered.dark_green', 'smoke.puff.centered.grey'], { stageId: 'cloud', after: 'expel', anchor: 'start', offset: 500, duration: 2600, scale: 1.8, opacity: 0.85, ...tint('#7b8f3a') }),
    impact('Drifting spores', ['particles.outward.greenyellow.02.03'], { after: 'cloud', anchor: 'start', offset: 300, duration: 2200, scale: 1.4, opacity: 0.8 }),
  ], { sound: 'poison' }),
  'pf2e:JMIdEsQ0vVKP29bW': design('Remember Their Names: the victims\' names are spoken aloud and their pain is seared into the oppressor\'s mind.', () => [
    cast('Names spoken', ['soundwave.02.purple', 'soundwave.02.blue'], { stageId: 'voice', duration: 1000, scale: 0.7 }),
    travel('Accusation', ['energy_strands.range.standard.dark_purple.01', 'energy_strands.range.standard.purple.01'], { stageId: 'beam', after: 'voice', anchor: 'start', offset: 450, duration: 1300 }),
    impact('Victims\' echoes', ['spirit_guardians.dark_purple.spirits', 'spirit_guardians.blueyellow.ring'], { after: 'beam', anchor: 'arrival', duration: 1800, scale: 0.8, ...tint('#9b6cd9') }),
    motion('cower', 'targets', { after: 'beam', anchor: 'arrival', duration: 1300, intensity: 0.5 }),
  ], { sound: 'psychic' }),
  'pf2e:Q35r2ssLpGUBRksE': design('Rend Armor: after a critical blow the weapon wrenches the target\'s armor, cracking its defenses.', () => [
    impact('Weapon wrenches', PIERCE, { stageId: 'wrench', duration: 1200, scale: 0.9 }),
    motion('lunge', 'source', { duration: 900, intensity: 0.4 }),
    impact('Armor cracks', ['markers.shield_cracked.dark_red.01', 'markers.shield_cracked.purple.01'], { after: 'wrench', anchor: 'start', offset: 500, duration: 1600, scale: 0.7 }),
    motion('stagger', 'targets', { after: 'wrench', anchor: 'start', offset: 450, duration: 900, intensity: 0.4 }),
  ], { sound: 'pierce' }),
  'pf2e:9gEVyUjYrDLUWieq': design('Rend Mimicry: the foe caught between two slashing attacks is torn apart by a punishing rend.', () => [
    impact('Rending slashes', ['claws.200px.dark_red', 'claws.200px.red'], { stageId: 'rend', duration: 1200, scale: 0.9 }),
    impact('Cross cut', SLASH, { after: 'rend', anchor: 'start', offset: 300, duration: 1200, mirrorX: true }),
    motion('lunge', 'source', { duration: 900, intensity: 0.45 }),
    motion('stagger', 'targets', { after: 'rend', anchor: 'start', offset: 350, duration: 900, intensity: 0.5 }),
  ], { sound: 'slash' }),
  'pf2e:9kY9B5WgtEleOicn': design('Resounding Blow: the bludgeoning head strike rings in the target\'s ears, deafening it.', ({ recipe }) => [
    ...keep(recipe),
    impact('Ears ring', ['soundwave.01.blue'], { after: idOf(recipe, 'impact'), anchor: 'start', offset: 500, duration: 1100, scale: 0.7 }),
    impact('Deafened', ['markers.mute.blue.01', 'markers.mute.dark_red.01'], { after: idOf(recipe, 'impact'), anchor: 'start', offset: 900, duration: 1400, scale: 0.6 }),
  ]),
  'pf2e:mFyKBHdX818sDnzO': design('Retch Rust: tendrils of rusted metal flakes are exhaled over a 30-foot cone, shredding those inside.', () => [
    motion('pulse', 'source', { duration: 700, intensity: 0.35 }),
    travel('Rust exhalation', ['breath_weapons.poison.cone.orange', 'breath_weapons.poison.cone.green'], { stageId: 'cone', delay: 250, duration: 1700, targetSelection: 'first', ...tint('#a5532a') }),
    impact('Rust flakes shred', ['claws.200px.brown', 'claws.200px.red'], { after: 'cone', anchor: 'start', offset: 500, duration: 1100, scale: 0.8, ...tint('#a5532a') }),
    motion('recoil', 'targets', { after: 'cone', anchor: 'start', offset: 500, duration: 800, intensity: 0.5 }),
  ]),
  'pf2e:HfebybiUNW8mXOfP': design('Returning Throw: a thrown weapon arcs to the foe and ricochets back into the dwarf\'s hand.', () => [
    motion('throw', 'source', { duration: 1000, intensity: 0.5 }),
    travel('Weapon thrown', ['hammer.throw', 'dagger.throw.01.white'], { stageId: 'out', delay: 250, duration: 1100 }),
    impact('Weapon strikes', ['impact.005.white', 'impact.005.orange'], { after: 'out', anchor: 'arrival', duration: 900, scale: 0.6 }),
    motion('recoil', 'targets', { after: 'out', anchor: 'arrival', duration: 700, intensity: 0.5 }),
    travel('Weapon returns', ['hammer.return', 'dagger.return.01.white'], { after: 'out', anchor: 'arrival', offset: 200, duration: 1300 }),
  ], { sound: 'thrown', soundNamespace: 'ability' }),
  'pf2e:9LwOCcutlLxd4bfS': design('Reversing Charge: a charge and Strike, then time rewinds and teleports the attacker back to the starting square.', () => [
    motion('rush', 'source', { stageId: 'charge', duration: 2400, distance: 6, motionRange: 'target', motionHeading: 'toward', motionEndpoint: 'near', intensity: 0.5 }),
    impact('Strike at arrival', SLASH, { stageId: 'hit', delay: 900, duration: 1300 }),
    cast('Rewind to the start', ['misty_step.01.purple', 'misty_step.01.blue'], { after: 'hit', anchor: 'start', offset: 900, duration: 1300, scale: 0.9 }),
    motion('flicker', 'source', { after: 'hit', anchor: 'start', offset: 1000, duration: 800, intensity: 0.5 }),
  ]),
  'pf2e:P4xwr0xnh1uvK9qs': design('Ride the Tsunami: crashing walls of water smash forward, battering foes and pushing them 20 feet.', () => [
    cast('Water rises', ['water_splash.circle.01.blue'], { stageId: 'rise', duration: 1000, scale: 1.3 }),
    travel('Tsunami surges', ['template_line_piercing.water.01.blue', 'breath_weapons.acid.line.green'], { stageId: 'wave', after: 'rise', anchor: 'start', offset: 400, duration: 1800, scale: 1.6, ...tint('#3d8bff') }),
    impact('Waves crash', ['water_splash.circle.01.blue'], { after: 'wave', anchor: 'start', offset: 600, duration: 1300, scale: 1.3 }),
    motion('rush', 'targets', { after: 'wave', anchor: 'start', offset: 650, duration: 1500, distance: 2.5, motionRange: 'distance', motionHeading: 'away', intensity: 0.5 }),
  ]),
  'pf2e:NMRBes7gGfGldOrn': design('Ring Their Bell: an armoured blow to the head leaves the inattentive foe seeing stars.', ({ recipe }) => [
    ...keep(recipe),
    impact('Bell rung', ['dizzy_stars.200px.yellow', 'dizzy_stars.200px.blueorange'], { after: idOf(recipe, 'impact'), anchor: 'start', offset: 500, duration: 1600, scale: 0.7, offsetY: -0.35, offsetUnits: 'token' }),
    motion('stagger', 'targets', { after: idOf(recipe, 'impact'), anchor: 'start', offset: 450, duration: 1000, intensity: 0.5 }),
  ]),
  'pf2e:EDZ1MwbNM9EcdTsh': design('Rip and Tear: a second morph-claw strike tears at the prey and leaves it bleeding.', () => [
    impact('Claws tear', ['claws.200px.dark_red', 'claws.200px.red'], { stageId: 'tear', delay: 300, duration: 1200 }),
    motion('lunge', 'source', { delay: 100, duration: 1000, intensity: 0.6 }),
    impact('Bleeding', ['markers.drop.red.01'], { after: 'tear', anchor: 'start', offset: 600, duration: 1500, scale: 0.6 }),
    motion('stagger', 'targets', { after: 'tear', anchor: 'start', offset: 350, duration: 900, intensity: 0.45 }),
  ], { sound: 'claw', soundNamespace: 'ability' }),
  'pf2e:fOwArAHixZsrpUMM': design('Rise Up!: a call to Milani lets the caller and allies stand and take flight.', () => [
    cast('Call to Milani', ['soundwave.02.orangeyellow', 'soundwave.02.blue'], { stageId: 'call', duration: 1100, scale: 0.8 }),
    impact('Lifted by rebellion', ['swirling_feathers.outburst.01.textured'], { stageId: 'lift', after: 'call', anchor: 'start', offset: 500, duration: 1600, scale: 0.9 }),
    motion('levitate', 'source', { after: 'call', anchor: 'start', offset: 500, duration: 1800, intensity: 0.4 }),
    motion('levitate', 'targets', { after: 'lift', anchor: 'start', offset: 150, duration: 1800, intensity: 0.4 }),
  ]),
  'pf2e:0B8nLDB8gOAxvpkK': design('Rising Hurricane: a hurricane cylinder lifts enemies into the air and drops them back down.', () => [
    cast('Storm called', ['cast_generic.03.blueteal', 'cast_generic.02.blue'], { stageId: 'call', duration: 900, scale: 0.8 }),
    impact('Hurricane column', ['whirlwind.bluewhite', 'whirlwind.bluegrey'], { stageId: 'storm', after: 'call', anchor: 'start', offset: 450, duration: 2800, scale: 1.7, fadeIn: 250, fadeOut: 500 }),
    motion('levitate', 'targets', { after: 'storm', anchor: 'start', offset: 300, duration: 1400, intensity: 0.7 }),
    motion('press', 'targets', { after: 'storm', anchor: 'start', offset: 1800, duration: 900, intensity: 0.6 }),
  ], { sound: 'wind' }),
  'pf2e:vwOU1t8Fd5dDEYia': design('Roar Mimicry: a roar felt as much as heard blasts sonic force over everything within 15 feet.', () => [
    cast('Deep roar', ['soundwave.02.orangeyellow', 'soundwave.02.blue'], { stageId: 'roar', duration: 1000, scale: 1 }),
    motion('shake', 'source', { duration: 900, intensity: 0.4 }),
    aura('Sonic burst', ['thunderwave.center.orange', 'thunderwave.center.blue'], { stageId: 'burst', after: 'roar', anchor: 'start', offset: 300, duration: 1500, scale: 2.4 }),
    impact('Stunning force', ['shatter.blue'], { after: 'burst', anchor: 'start', offset: 250, duration: 1100, scale: 0.8 }),
    motion('stagger', 'targets', { after: 'burst', anchor: 'start', offset: 250, duration: 1000, intensity: 0.6 }),
  ]),
  'pf2e:gC3IeHyuVsX2Vtg8': design('Roiling Mudslide: water and earth form a mudslide over a 30-foot cone, smashing foes back and coating them in mud.', () => [
    cast('Earth and water mix', ['cast_generic.earth.01.browngreen'], { stageId: 'mix', duration: 900, scale: 0.8 }),
    travel('Mudslide', ['breath_weapons.poison.cone.orange', 'breath_weapons.poison.cone.green'], { stageId: 'slide', after: 'mix', anchor: 'start', offset: 400, duration: 1800, targetSelection: 'first', ...tint('#6b4a2b') }),
    impact('Mud coats', ['liquid.splash.brown', 'liquid.splash.blue'], { after: 'slide', anchor: 'start', offset: 600, duration: 1300, ...tint('#6b4a2b') }),
    motion('rush', 'targets', { after: 'slide', anchor: 'start', offset: 650, duration: 1300, distance: 1, motionRange: 'distance', motionHeading: 'away', intensity: 0.5 }),
  ]),
  'pf2e:ZJSkCrud1FZ7PMFk': design('Rotten Slurry: a glob of foul slurry is hurled at a foe, bludgeoning and sickening it.', () => [
    motion('throw', 'source', { duration: 900, intensity: 0.4 }),
    travel('Slurry glob', ['spell_projectile.poison.greenyellow', 'ranged.04.projectile.01.green'], { stageId: 'glob', delay: 200, duration: 1200, ...tint('#7a8a2a') }),
    impact('Slurry splatters', ['liquid.splash.green', 'liquid.splash.blue'], { after: 'glob', anchor: 'arrival', duration: 1200, ...tint('#7a8a2a') }),
    motion('recoil', 'targets', { after: 'glob', anchor: 'arrival', duration: 800, intensity: 0.5 }),
  ], { sound: 'poison' }),
  'pf2e:P0v56G9Hkt87cAKj': design('Rouse the Forest\'s Fury: terrifying trees burst up and lash the enemies with branches.', () => [
    cast('Forest roused', ['swirling_leaves.outburst.01.greenorange', 'swirling_leaves.outburst.01.pink'], { stageId: 'rouse', duration: 1200, scale: 1.2 }),
    impact('Trees erupt', ['vine.complete.nature.group.03.green'], { stageId: 'trees', after: 'rouse', anchor: 'start', offset: 500, duration: 2000, scale: 1.3 }),
    impact('Branch strike', BLUDGEON2, { after: 'trees', anchor: 'start', offset: 700, duration: 1300 }),
    motion('stagger', 'targets', { after: 'trees', anchor: 'start', offset: 900, duration: 1000, intensity: 0.6 }),
  ]),
  'pf2e:vHKNJZPBxj66nJzZ': design('Rupture Stomp: an armoured heel cracks the ground into difficult terrain within 10 feet.', () => [
    motion('slam', 'source', { duration: 1100, intensity: 0.6 }),
    aura('Heel impact', ['impact.ground_crack.02.orange'], { stageId: 'stomp', delay: 350, duration: 1500, scale: 1.4, below: true }),
    aura('Ground ruptures', ['ground_cracks.02.orange'], { after: 'stomp', anchor: 'start', offset: 250, duration: 2600, scale: 2.5, below: true, fadeOut: 600 }),
  ], { sound: 'earthquake' }),
  'pf2e:40mZVDnIP5qBNhTH': design('Sand Snatcher: a figure of sand rises beside the target and seizes it with grasping arms.', () => [
    cast('Sand gathers', ['cast_generic.earth.01.browngreen'], { stageId: 'gather', duration: 900, scale: 0.7 }),
    impact('Sand rises', ['smoke.puff.side.grey'], { stageId: 'rise', after: 'gather', anchor: 'start', offset: 400, duration: 1200, scale: 0.8, ...tint('#d8b77a') }),
    impact('Grasping sand arms', ['arcane_hand.rock', 'arcane_hand.red'], { after: 'rise', anchor: 'start', offset: 300, duration: 2000, scale: 0.8, ...tint('#d8b77a') }),
    motion('stagger', 'targets', { after: 'rise', anchor: 'start', offset: 900, duration: 1000, intensity: 0.4 }),
  ]),
  'pf2e:pHBHQaqI77pYtaCU': design('Sanguivolent Roots: blood-drinking vines burst from the ground and drain living enemies.', () => [
    impact('Blood vines erupt', ['vine.complete.nature.group.01.green'], { stageId: 'vines', duration: 2000, scale: 1.2, ...tint('#8a1a1a') }),
    impact('Blood drawn', ['liquid.splash02.red'], { after: 'vines', anchor: 'start', offset: 600, duration: 1200, scale: 0.8 }),
    motion('stagger', 'targets', { after: 'vines', anchor: 'start', offset: 600, duration: 1000, intensity: 0.5 }),
  ]),
  'pf2e:GsAWfDt2Cq3FkYBL': design('Sanguine Evasion: at 0 Hit Points the rogue dissolves into a spray of red mist.', () => [
    cast('Body bursts into mist', ['smoke.plumes.01.dark_red', 'smoke.plumes.01.grey'], { stageId: 'mist', duration: 1800, scale: 1.2, ...tint('#a3202a') }),
    aura('Vapor form', ['fog_cloud.01.white', 'fog_cloud.01.white'], { after: 'mist', anchor: 'start', offset: 600, duration: 2000, scale: 1.2, opacity: 0.6, ...tint('#a3202a') }),
    motion('flicker', 'source', { after: 'mist', anchor: 'start', offset: 200, duration: 1200, intensity: 0.6 }),
  ]),
  'pf2e:ylDAxUpT0rXxilro': design('Scattering Charge: an armoured charge into a group, shoving up to three foes away.', () => [
    motion('rush', 'source', { duration: 2600, distance: 7, motionRange: 'target', motionHeading: 'toward', motionEndpoint: 'near', intensity: 0.55 }),
    impact('Armoured shove', ['impact.004.blue'], { stageId: 'shove', delay: 1000, duration: 1000, scale: 0.9, ...tint('#e8e8e8') }),
    motion('rush', 'targets', { after: 'shove', anchor: 'start', offset: 100, duration: 1200, distance: 1, motionRange: 'distance', motionHeading: 'away', intensity: 0.5 }),
  ], { sound: 'unarmed', soundNamespace: 'ability' }),
  'pf2e:FvhVk79sEnSDTDtq': design('Scattering Shout: a guttural bellow blasts every enemy within 10 feet away.', () => [
    cast('Bellow', ['soundwave.02.red', 'soundwave.02.blue'], { stageId: 'shout', duration: 1000, scale: 0.9 }),
    motion('pulse', 'source', { duration: 900, intensity: 0.5 }),
    aura('Shout blast', ['thunderwave.center.dark_red', 'thunderwave.center.blue'], { stageId: 'blast', after: 'shout', anchor: 'start', offset: 250, duration: 1400, scale: 1.8 }),
    motion('rush', 'targets', { after: 'blast', anchor: 'start', offset: 200, duration: 1300, distance: 1.5, motionRange: 'distance', motionHeading: 'away', intensity: 0.55 }),
  ]),
  'pf2e:VqVgcqmG6xmYuDbK': design('Scouring Rage: entering rage releases a surge of instinctual energy that sears every enemy within 20 feet.', () => [
    cast('Rage ignites', ['cast_generic.01.dark_red', 'cast_generic.01.yellow'], { stageId: 'rage', duration: 800, scale: 0.9, ...tint('#d0302a') }),
    motion('shake', 'source', { duration: 800, intensity: 0.45 }),
    aura('Instinct surge', ['explosion.04.dark_red', 'explosion.02.blue'], { stageId: 'surge', after: 'rage', anchor: 'start', offset: 450, duration: 1600, scale: 3.2, ...tint('#d0302a') }),
    impact('Surge strikes', ['impact.008.red', 'impact.004.blue'], { after: 'surge', anchor: 'start', offset: 250, duration: 1000, ...tint('#d0302a') }),
    motion('recoil', 'targets', { after: 'surge', anchor: 'start', offset: 250, duration: 800, intensity: 0.6 }),
  ], { sound: 'force' }),
  'pf2e:XqtJVBwnxBsSo9Py': design('Scorching Column: a vertical column of extreme heat rises at the chosen spot and burns those inside.', () => [
    cast('Upward gesture', ['cast_generic.fire.01.orange'], { stageId: 'gesture', duration: 900, scale: 0.7 }),
    impact('Heat column erupts', ['eruption.orange.01'], { stageId: 'column', after: 'gesture', anchor: 'start', offset: 400, duration: 2000, scale: 1.3 }),
    impact('Flames linger', ['flames.04.complete.orange'], { after: 'column', anchor: 'start', offset: 600, duration: 1800, scale: 0.9, below: true }),
    motion('stagger', 'targets', { after: 'column', anchor: 'start', offset: 400, duration: 1000, intensity: 0.5 }),
  ]),
  'pf2e:D5atazp26amNzoqO': design('See You in Hell: a blast of spiritual energy lashes from the dying soul at the creature that felled it.', () => [
    cast('Soul flares', ['sacred_flame.source.white', 'sacred_flame.source.yellow'], { stageId: 'flare', duration: 900, scale: 0.8, ...tint('#cfe0ff') }),
    travel('Spirit lash', ['energy_strands.range.standard.dark_purple02.01', 'energy_strands.range.standard.purple.01'], { stageId: 'lash', after: 'flare', anchor: 'start', offset: 400, duration: 1500 }),
    impact('Spirit strikes', ['spirit_guardians.dark_whiteblue.spirits', 'spirit_guardians.blueyellow.ring'], { after: 'lash', anchor: 'arrival', duration: 1500, scale: 0.7 }),
    motion('recoil', 'targets', { after: 'lash', anchor: 'arrival', duration: 800, intensity: 0.6 }),
  ]),
  'pf2e:SxRmlDYhYEkq10Ak': design('Serpentcoil Slam: coils smash the flying creature down into the ground beside the nagaji.', () => [
    impact('Coils crash down', BLUDGEON2, { stageId: 'hit', delay: 450, duration: 1400, scale: 1.15 }),
    motion('lunge', 'source', { delay: 150, duration: 1100, intensity: 0.6 }),
    motion('press', 'targets', { after: 'hit', anchor: 'start', offset: 400, duration: 1000, intensity: 0.8 }),
    impact('Slammed into the ground', ['impact.ground_crack.02.orange'], { after: 'hit', anchor: 'start', offset: 600, duration: 1300, scale: 1, below: true }),
  ], { sound: 'club', soundNamespace: 'ability' }),
  'pf2e:1sD5Gu8jQL09Yz2j': design('Sever Space: a slash cuts across 80 feet of destroyed space, then the world snaps the two combatants together.', () => [
    travel('Space severed', ['ranged_slash.instant.001.purplered', 'ranged_slash.instant.001.blue'], { stageId: 'cut', delay: 250, duration: 1100 }),
    motion('lunge', 'source', { duration: 900, intensity: 0.5 }),
    impact('Slash lands', SLASH, { after: 'cut', anchor: 'arrival', duration: 1200 }),
    motion('rush', 'source', { after: 'cut', anchor: 'arrival', offset: 500, duration: 1800, distance: 6, motionRange: 'target', motionHeading: 'toward', motionEndpoint: 'near', intensity: 0.6 }),
  ], { sound: 'sword', soundNamespace: 'ability' }),
  'pf2e:ECH7BEQQEq3pCQaS': design('Shard Strike: jagged metal shards form in the air and lash out at every creature in the area.', () => [
    cast('Shards form', ['cast_generic.03.white', 'cast_generic.02.blue'], { stageId: 'form', duration: 800, scale: 0.7, ...tint('#c8d0d8') }),
    travel('Shards lash out', ['kunai.throw.01', 'dagger.throw.01.white'], { stageId: 'shards', after: 'form', anchor: 'start', offset: 350, duration: 900, scale: 0.8, repeats: 3, repeatInterval: 110 }),
    impact('Shards cut', ['impact.005.white', 'impact.005.orange'], { after: 'shards', anchor: 'arrival', duration: 800, scale: 0.6 }),
    motion('recoil', 'targets', { after: 'shards', anchor: 'arrival', duration: 700, intensity: 0.5 }),
  ]),
  'pf2e:B7VMXObJSNVI0ZGJ': design('Shattering Strike (Weapon Improviser): the improvised weapon breaks apart in the blow, driving shards into the foe.', () => [
    impact('Improvised blow', ['melee_generic.bludgeoning.one_handed', 'club.melee.01.white'], { stageId: 'hit', duration: 1200 }),
    motion('lunge', 'source', { duration: 900, intensity: 0.5 }),
    impact('Weapon shatters', ['explosion.shrapnel.bomb.01.grey', 'explosion.shrapnel.bomb.01.black'], { after: 'hit', anchor: 'start', offset: 350, duration: 1000, scale: 0.6 }),
    motion('stagger', 'targets', { after: 'hit', anchor: 'start', offset: 350, duration: 900, intensity: 0.5 }),
  ], { sound: 'club', soundNamespace: 'ability' }),
  'pf2e:QOnyOjncnw4tkTQp': design('Shattershields: four pitted metal plates float and orbit the kineticist to intercept attacks.', () => [
    cast('Metal plates form', ['impact.005.white', 'impact.005.orange'], { stageId: 'form', duration: 800, scale: 0.6 }),
    aura('Orbiting plates', ['aura_themed.01.orbit.complete.metal.01.grey'], { after: 'form', anchor: 'start', offset: 300, duration: 2600, scale: 1.5, fadeIn: 300, fadeOut: 500 }),
    motion('brace', 'source', { after: 'form', anchor: 'start', offset: 200, duration: 1000, intensity: 0.4 }),
  ]),
  'pf2e:iY08DGiUW8MVBR5k': design('Sheltering Wing: fledgling draconic wings rise to shield against attacks and spells.', () => [
    cast('Wings sweep up', ['wind_lines.01.02.white'], { stageId: 'flap', duration: 900, scale: 0.8 }),
    aura('Wing shelter', ['shield.01.complete.01.red', 'shield.01.complete.01.blue'], { after: 'flap', anchor: 'start', offset: 250, duration: 1600, scale: 1.1, ...tint('#e08a3a') }),
    motion('brace', 'source', { after: 'flap', anchor: 'start', offset: 150, duration: 1100, intensity: 0.45 }),
  ]),
  'pf2e:Xik9lMAA4e5xFegM': design('Shield Wallop: a shield bash knocks the sense out of the foe, leaving it stupefied.', () => [
    impact('Shield bash', ['melee_attack.06.shield.01'], { stageId: 'bash', delay: 300, duration: 1300 }),
    motion('lunge', 'source', { delay: 100, duration: 1000, intensity: 0.65 }),
    motion('stagger', 'targets', { after: 'bash', anchor: 'start', offset: 450, duration: 1000, intensity: 0.6 }),
    impact('Senses knocked loose', ['dizzy_stars.200px.white', 'dizzy_stars.200px.blueorange'], { after: 'bash', anchor: 'start', offset: 650, duration: 1600, scale: 0.7, offsetY: -0.35, offsetUnits: 'token' }),
  ]),
  'pf2e:qD5At83TIxznCwPg': design('Shielding Taunt: the guardian raises the shield and bangs on it loudly to draw a foe\'s attention.', () => [
    cast('Shield raised', ['shield.01.complete.01.blue'], { stageId: 'raise', duration: 1200, scale: 0.9 }),
    motion('brace', 'source', { duration: 900, intensity: 0.4 }),
    aura('Shield banging', ['soundwave.02.orangeyellow', 'soundwave.02.blue'], { stageId: 'bang', after: 'raise', anchor: 'start', offset: 500, duration: 900, scale: 0.8, repeats: 2, repeatInterval: 350 }),
    impact('Foe is taunted', ['soundwave.01.orangeyellow', 'soundwave.01.blue'], { after: 'bang', anchor: 'start', offset: 400, duration: 1100, scale: 0.6 }),
  ]),
  'pf2e:tKC06HYkt1XaWk78': design('Shining Glory: the active nimbus flares with a righteous word, inspiring allies in its light.', () => [
    cast('Righteous word', ['divine_smite.caster.yellowwhite', 'divine_smite.caster.blueyellow'], { stageId: 'word', duration: 1300, scale: 0.9 }),
    aura('Nimbus flares', OUT_GOLD, { after: 'word', anchor: 'start', offset: 400, duration: 1800, scale: 3.4, opacity: 0.85, below: true, ...tint('#ffe08a') }),
    impact('Glory touches', ['markers.light.complete.yellow', 'markers.light.complete.blue'], { after: 'word', anchor: 'start', offset: 800, duration: 1600, scale: 0.7, ...tint('#ffe08a') }),
  ], { sound: 'holy' }),
  'pf2e:tPhhaCbaQqwenkzx': design('Silence Heresy: a Strike that stifles the target\'s voice to a whisper.', ({ recipe }) => [
    ...keep(recipe),
    impact('Voice stifled', ['markers.mute.purple.01', 'markers.mute.dark_red.01'], { after: idOf(recipe, 'impact'), anchor: 'start', offset: 550, duration: 1600, scale: 0.65 }),
  ], { sound: 'sword', soundNamespace: 'ability' }),
  'pf2e:Yk3QGpalWDn5MhBV': design('Silencing Strike: a quick strike to the face leaves the enemy stunned and barely able to vocalize.', ({ recipe }) => [
    ...keep(recipe),
    impact('Dazed', ['dizzy_stars.200px.purple', 'dizzy_stars.200px.blueorange'], { after: idOf(recipe, 'impact'), anchor: 'start', offset: 500, duration: 1500, scale: 0.65, offsetY: -0.35, offsetUnits: 'token' }),
    impact('Voice choked', ['markers.mute.dark_red.01'], { after: idOf(recipe, 'impact'), anchor: 'start', offset: 900, duration: 1400, scale: 0.6 }),
    motion('stagger', 'targets', { after: idOf(recipe, 'impact'), anchor: 'start', offset: 450, duration: 900, intensity: 0.5 }),
  ]),
  'pf2e:bI0PWJ4c3AOcFDWN': design('Silk Bracelet: the Strike unleashes venom-laced silk strands that bind the target.', () => [
    impact('Strike', SLASH, { stageId: 'hit', delay: 350, duration: 1300 }),
    motion('lunge', 'source', { delay: 100, duration: 1000, intensity: 0.6 }),
    impact('Silk strands wrap', ['web.02', 'web.01'], { after: 'hit', anchor: 'start', offset: 500, duration: 1800, scale: 0.8, fadeIn: 200, fadeOut: 400 }),
    impact('Venom', ['markers.poison.dark_green.01'], { after: 'hit', anchor: 'start', offset: 900, duration: 1300, scale: 0.6 }),
  ]),
  'pf2e:RfOnsZrmT6z2ajBN': design('Siphon Life: a void-touched unarmed Strike rips life force from a living foe into the striker as temporary Hit Points.', () => [
    impact('Void strike', ['unarmed_strike.magical.02.dark_purple', 'unarmed_strike.magical.02.blue'], { stageId: 'hit', delay: 300, duration: 1300, ...tint('#5a2a7a') }),
    motion('lunge', 'source', { delay: 100, duration: 1000, intensity: 0.6 }),
    motion('stagger', 'targets', { after: 'hit', anchor: 'start', offset: 400, duration: 900, intensity: 0.5 }),
    aura('Life force drawn in', ['energy_strands.in.purple.01', 'energy_strands.in.green.01'], { after: 'hit', anchor: 'start', offset: 600, duration: 1600, scale: 0.9, ...tint('#7a3aa0') }),
  ], { sound: 'drain' }),
  'pf2e:E1WXnYE2QwhHQxQb': design('Sleeper Hold: pressure on nerve points makes the grabbed foe slump toward unconsciousness.', () => [
    impact('Nerve pinch', PUNCH, { stageId: 'pinch', duration: 1100, scale: 0.7 }),
    motion('press', 'targets', { after: 'pinch', anchor: 'start', offset: 300, duration: 1300, intensity: 0.5 }),
    impact('Consciousness fades', ['sleep.symbol.purple', 'sleep.symbol.pink'], { after: 'pinch', anchor: 'start', offset: 700, duration: 1600, scale: 0.6, offsetY: -0.4, offsetUnits: 'token' }),
  ], { sound: 'unarmed', soundNamespace: 'ability' }),
  'pf2e:xgvKXeTxns0gIdAn': design('Smite: the champion singles out one enemy for destruction in the deity\'s name.', () => [
    cast('Divine judgement', ['divine_smite.caster.yellowwhite', 'divine_smite.caster.blueyellow'], { stageId: 'call', duration: 1300, scale: 0.85 }),
    impact('Enemy marked', ['divine_smite.target.yellowwhite', 'divine_smite.target.blueyellow'], { after: 'call', anchor: 'start', offset: 650, duration: 1500, scale: 0.8 }),
  ], { sound: 'divineWrath' }),
  'pf2e:d3bonWM7JoPeOGhh': design('Smoothing Stomp: a stomp sends a wave of creation magic out 30 feet, smoothing difficult terrain.', () => [
    motion('slam', 'source', { duration: 1000, intensity: 0.5 }),
    aura('Stomp', ['impact.ground_crack.01.orange'], { stageId: 'stomp', delay: 300, duration: 1100, scale: 1.1, below: true }),
    aura('Wave of creation', ['template_circle.out_pulse.02.burst.tealyellow', 'template_circle.out_pulse.02.burst.bluewhite'], { after: 'stomp', anchor: 'start', offset: 200, duration: 1800, scale: 4, opacity: 0.8, below: true }),
    aura('Ground made smooth', ['particles.outward.greenyellow.02.03'], { after: 'stomp', anchor: 'start', offset: 500, duration: 1800, scale: 2.4, opacity: 0.7 }),
  ], { sound: 'earth' }),
  'pf2e:ugDZeILVpgLVhvGC': design('Solar Detonation: blinding sunlit flames explode in a swirling sphere over a 20-foot burst.', () => [
    cast('Sun gathered', ['cast_generic.fire.01.orange'], { stageId: 'gather', duration: 900, scale: 0.8 }),
    impact('Solar flash', ['impact.006.yellow'], { stageId: 'flash', after: 'gather', anchor: 'start', offset: 450, duration: 900, scale: 1.4 }),
    impact('Swirling sphere of flame', ['explosion.03.yellow', 'explosion.01.orange'], { after: 'flash', anchor: 'start', offset: 100, duration: 1700, scale: 1.5 }),
    motion('cower', 'targets', { after: 'flash', anchor: 'start', offset: 150, duration: 1200, intensity: 0.5 }),
  ]),
  'pf2e:SC5oZbyvLO5CQwhl': design('Sonic Dash: a bounce, a straight-line sprint, and a sonic boom where the dash ends.', () => [
    motion('pulse', 'source', { duration: 450, intensity: 0.35 }),
    cast('Takeoff', ['soundwave.01.blue'], { stageId: 'go', delay: 300, duration: 900, scale: 0.7 }),
    motion('rush', 'source', { after: 'go', anchor: 'start', duration: 2400, distance: 2, motionRange: 'distance', motionHeading: 'toward', intensity: 0.65 }),
    aura('Sonic boom', ['thunderwave.center.blue'], { after: 'go', anchor: 'start', offset: 900, duration: 1300, scale: 1.2 }),
  ], { sound: 'sonic' }),
  'pf2e:5kua1Kf5Ca85lbzb': design('Space-Time Shift: the traveller slips a few moments into the future, turning Strides into teleports.', () => [
    cast('Time slips', ['misty_step.02.purple', 'misty_step.02.blue'], { stageId: 'slip', duration: 1300, scale: 0.9 }),
    motion('flicker', 'source', { after: 'slip', anchor: 'start', offset: 200, duration: 1000, intensity: 0.5 }),
  ], { sound: 'teleport' }),
  'pf2e:BL2nLeClO30QoQGs': design('Spark Fist: black powder is dusted onto the fist and pops with small flames.', () => [
    cast('Powder dusted', ['smoke.puff.side.grey'], { stageId: 'dust', duration: 900, scale: 0.4, offsetX: 0.3, offsetUnits: 'token' }),
    aura('Powder pops', ['impact.fire.01.orange'], { after: 'dust', anchor: 'start', offset: 450, duration: 900, scale: 0.35, offsetX: 0.3, offsetUnits: 'token', repeats: 2, repeatInterval: 300 }),
  ], { sound: 'fireIgnition' }),
  'pf2e:l0VB9sqKxmkWvvaA': design('Spell Crash: a weapon smashes the ground and a prepared spell explodes outward as raw magic.', () => [
    motion('slam', 'source', { duration: 1000, intensity: 0.55 }),
    aura('Weapon smashes the ground', ['impact.ground_crack.03.purple', 'impact.ground_crack.03.orange'], { stageId: 'smash', delay: 300, duration: 1400, scale: 1.5, below: true, ...tint('#a35cff') }),
    aura('Spell explodes out', ['template_circle.out_pulse.02.burst.purplepink', 'template_circle.out_pulse.02.burst.bluewhite'], { after: 'smash', anchor: 'start', offset: 200, duration: 1600, scale: 3.6, opacity: 0.85, ...tint('#a35cff') }),
    impact('Raw magic strikes', ['impact.007.purple', 'impact.004.blue'], { after: 'smash', anchor: 'start', offset: 500, duration: 1000, ...tint('#a35cff') }),
    motion('recoil', 'targets', { after: 'smash', anchor: 'start', offset: 500, duration: 800, intensity: 0.6 }),
  ]),
  'pf2e:9p28s0zg4Vv4r5i2': design('Spike Skin: a touch hardens a willing creature\'s skin into spiky stone protrusions.', () => [
    cast('Earth touch', ['cast_generic.earth.01.browngreen'], { stageId: 'touch', duration: 900, scale: 0.7 }),
    impact('Spikes burst out', ['ice_spikes.radial.burst.grey', 'ice_spikes.radial.burst.white'], { after: 'touch', anchor: 'start', offset: 450, duration: 1400, scale: 0.75, ...tint('#9c8a6e') }),
    motion('brace', 'targets', { after: 'touch', anchor: 'start', offset: 500, duration: 1000, intensity: 0.4 }),
  ]),
  'pf2e:gxzTEt37M0z1WY1M': design('Spinebreaker: a vicious bear hug crushes the grabbed foe\'s joints and nerves.', () => [
    impact('Crushing hug', PUNCH, { stageId: 'squeeze', duration: 1100, scale: 0.8 }),
    impact('Joints strain', ['impact.003.blue'], { after: 'squeeze', anchor: 'start', offset: 400, duration: 900, scale: 0.6, ...tint('#e8e8e8') }),
    motion('press', 'targets', { after: 'squeeze', anchor: 'start', offset: 250, duration: 1300, intensity: 0.6 }),
  ], { sound: 'unarmed', soundNamespace: 'ability' }),
  'pf2e:sIN6t7nCWdI5u1HK': design('Spirit\'s Anguish: a released spirit\'s cathartic howl washes over a 30-foot cone as sonic damage.', () => [
    cast('Spirit released', ['spirit_guardians.blue.spirits', 'spirit_guardians.blueyellow.ring'], { stageId: 'free', duration: 1100, scale: 0.6 }),
    travel('Anguished howl', ['breath_weapons02.burst.cone.arcana.purple.01', 'breath_weapons.cold.cone.blue'], { stageId: 'howl', after: 'free', anchor: 'start', offset: 450, duration: 1600, targetSelection: 'first', opacity: 0.8, ...tint('#bfe6ff') }),
    impact('Howl hits', ['soundwave.01.blue'], { after: 'howl', anchor: 'start', offset: 450, duration: 1100, scale: 0.7 }),
    motion('stagger', 'targets', { after: 'howl', anchor: 'start', offset: 450, duration: 1000, intensity: 0.5 }),
  ]),
  'pf2e:gO729iC9b5ypes2K': design('Spirit\'s Wrath: an ancestral wisp streaks out up to 120 feet and rushes into the enemy.', () => [
    cast('Wisp called', ['sacred_flame.source.white', 'sacred_flame.source.yellow'], { stageId: 'call', duration: 900, scale: 0.7, ...tint('#cfe0ff') }),
    projectile('Wisp rushes', ['markers.light_orb.loop.white', 'markers.light_orb.loop.blue'], { stageId: 'wisp', after: 'call', anchor: 'start', offset: 400, duration: 1400, scale: 0.45 }),
    impact('Spirit strike', ['spirit_guardians.dark_whiteblue.particles', 'spirit_guardians.blueyellow.ring'], { after: 'wisp', anchor: 'arrival', duration: 1300, scale: 0.7 }),
    motion('stagger', 'targets', { after: 'wisp', anchor: 'arrival', duration: 900, intensity: 0.55 }),
  ]),
  'pf2e:FlsAYAGEiZg1gg7D': design('Spiritual Disruption: the Strike severs the foe\'s spiritual connection with persistent spirit damage.', ({ recipe }) => [
    ...keep(recipe),
    impact('Spirit severed', ['spirit_guardians.dark_whiteblue.particles', 'spirit_guardians.blueyellow.ring'], { after: idOf(recipe, 'impact'), anchor: 'start', offset: 450, duration: 1400, scale: 0.6 }),
    motion('stagger', 'targets', { after: idOf(recipe, 'impact'), anchor: 'start', offset: 450, duration: 900, intensity: 0.45 }),
  ]),
  'pf2e:9DWxzEavOeymc6Ql': design('Spiritual Strike: the familiar\'s occult power adds ghost-touch force to a runed weapon Strike.', ({ recipe }) => [
    ...keep(recipe),
    impact('Occult force', ['impact.007.purple', 'impact.004.blue'], { after: idOf(recipe, 'impact'), anchor: 'start', offset: 350, duration: 1000, scale: 0.8, ...tint('#a35cff') }),
  ]),
  'pf2e:eXv8ZWcASOgs8jLZ': design('Rekindled Light: the star orb familiar pours out its light to keep a falling ally at 1 Hit Point and heal them.', () => [
    cast('Star orb drains', ['markers.light_orb.complete.yellow', 'markers.light_orb.complete.blue'], { stageId: 'orb', duration: 1200, scale: 0.5, offsetY: -0.5, offsetUnits: 'token', ...tint('#ffe08a') }),
    projectile('Starlight flies', ['markers.light_orb.loop.yellow', 'markers.light_orb.loop.blue'], { stageId: 'fly', after: 'orb', anchor: 'start', offset: 500, duration: 1200, scale: 0.4, ...tint('#ffe08a') }),
    impact('Life rekindled', ['healing_generic.200px.yellow'], { after: 'fly', anchor: 'arrival', duration: 1600, scale: 0.9 }),
  ], { sound: 'healing' }),
  'pf2e:d8lWzMTYq91wOgMN': design('Polymorphic Escape: a flash polymorph into vermin or a cloud of leaves slips the hold, then a Step away.', () => [
    cast('Bursts into leaves', ['swirling_leaves.outburst.01.greenorange', 'swirling_leaves.outburst.01.pink'], { stageId: 'burst', duration: 1300, scale: 0.9, ...tint('#7bbf3a') }),
    motion('flicker', 'source', { after: 'burst', anchor: 'start', offset: 100, duration: 700, intensity: 0.5 }),
    motion('dodge', 'source', { after: 'burst', anchor: 'start', offset: 600, duration: 1300, distance: 1, motionRange: 'distance', intensity: 0.4 }),
  ]),
  'pf2e:A981119DMdqE9Pg1': design('Running Tackle: a charge that slams the body into the foe to Grapple or Shove it.', () => [
    motion('rush', 'source', { duration: 2600, distance: 8, motionRange: 'target', motionHeading: 'toward', motionEndpoint: 'near', intensity: 0.5 }),
    impact('Body tackle', PUNCH, { stageId: 'tackle', delay: 1100, duration: 1100, scale: 1 }),
    motion('stagger', 'targets', { after: 'tackle', anchor: 'start', offset: 200, duration: 1000, intensity: 0.65 }),
  ], { sound: 'unarmed', soundNamespace: 'ability' }),
  'pf2e:CAHJGt535l3Ai4cR': design('Sea Glass Guardians: elemental water beings and whirling ice crystals race around the kinetic aura.', () => [
    cast('Water called', ['impact.water.02.blue'], { stageId: 'call', duration: 1000, scale: 0.9 }),
    aura('Ice crystals whirl', ['aura_themed.01.orbit.complete.cold.01.blue'], { after: 'call', anchor: 'start', offset: 300, duration: 2600, scale: 1.8, fadeIn: 300, fadeOut: 500 }),
    aura('Water guardians flow', ['bubble.001.001.complete.blue'], { after: 'call', anchor: 'start', offset: 500, duration: 2200, scale: 1.4, opacity: 0.6 }),
  ]),
  'pf2e:nBsd828H7AnVRV6r': design('Shadows Within Shadows: the furtive apparition wraps the animist in a shroud of nondetection.', () => [
    cast('Shroud gathers', ['smoke.puff.centered.dark_black', 'smoke.puff.centered.grey'], { stageId: 'shroud', duration: 1500, scale: 1.1, ...tint('#2a2238') }),
    aura('Nondetection veil', ['smoke.puff.ring.01.dark_black', 'smoke.puff.ring.01.white'], { after: 'shroud', anchor: 'start', offset: 500, duration: 1800, scale: 1.2, opacity: 0.7, ...tint('#2a2238') }),
    motion('flicker', 'source', { after: 'shroud', anchor: 'start', offset: 300, duration: 900, intensity: 0.4 }),
  ]),
  'pf2e:YXuhZHEUXXi9Dhqx': design('Sovereign\'s Blade: the raised weapon sheds piercing bright light, dispelling darkness and calling the knights.', () => [
    cast('Blade raised', ['markers.light.intro.yellow', 'markers.light.intro.blue'], { stageId: 'raise', duration: 1200, scale: 0.6, offsetY: -0.5, offsetUnits: 'token', ...tint('#fff0b0') }),
    aura('Light pierces darkness', OUT_GOLD, { after: 'raise', anchor: 'start', offset: 500, duration: 1800, scale: 3.6, opacity: 0.8, below: true, ...tint('#fff0b0') }),
    motion('pulse', 'source', { after: 'raise', anchor: 'start', offset: 300, duration: 900, intensity: 0.35 }),
  ], { sound: 'light' }),
  'pf2e:ZbK0WZRDjm1sfOKD': design('Spectral Dagger: touching the splinter of finality conjures a ghostly dagger into the hand.', () => [
    cast('Splinter touched', ['spirit_guardians.dark_whiteblue.particles', 'spirit_guardians.blueyellow.ring'], { stageId: 'touch', duration: 1000, scale: 0.5 }),
    aura('Spectral dagger forms', ['spiritual_weapon.dagger.02.spectral.02.green'], { after: 'touch', anchor: 'start', offset: 400, duration: 1600, scale: 0.6, offsetX: 0.35, offsetUnits: 'token', fadeIn: 300, fadeOut: 400, ...tint('#cfd8ff') }),
  ], { sound: 'spirit', soundNamespace: 'ability' }),
  'pf2e:xtXWw3cUnVB25XSV': design('Sanctify Armament: a touch brings the weapon into concordance with the deity, sheathing it in holy or unholy spirit.', () => [
    cast('Sanctifying touch', ['divine_smite.caster.yellowwhite', 'divine_smite.caster.blueyellow'], { stageId: 'touch', duration: 1400, scale: 0.75 }),
    aura('Weapon sanctified', ['sacred_flame.source.white', 'sacred_flame.source.yellow'], { after: 'touch', anchor: 'start', offset: 650, duration: 1700, scale: 0.5, offsetX: 0.35, offsetUnits: 'token', fadeIn: 200, fadeOut: 400 }),
  ], { sound: 'holy' }),
  'pf2e:ho5qkbgW4XxvkXuC': design('Spirit of the Blade: spiritual energy charges the blade for the next Strike against spirits and fiends.', () => [
    cast('Spirit gathered', ['spirit_guardians.dark_whiteblue.particles', 'spirit_guardians.blueyellow.ring'], { stageId: 'gather', duration: 1100, scale: 0.6 }),
    aura('Blade charged', ['sacred_flame.source.white', 'sacred_flame.source.yellow'], { after: 'gather', anchor: 'start', offset: 500, duration: 1600, scale: 0.5, offsetX: 0.35, offsetUnits: 'token', fadeIn: 200, fadeOut: 400, ...tint('#cfe0ff') }),
  ], { sound: 'spirit', soundNamespace: 'ability' }),
  'pf2e:Bm8votckjbge54bl': design('Sleek Reposition: a finesse or polearm Strike that snags the foe and moves it where the fighter wants.', () => [
    impact('Snagging thrust', PIERCE, { stageId: 'hit', delay: 400, duration: 1300 }),
    motion('lunge', 'source', { delay: 100, duration: 1000, intensity: 0.6 }),
    motion('dodge', 'targets', { after: 'hit', anchor: 'start', offset: 450, duration: 1300, distance: 1, motionRange: 'distance', intensity: 0.5 }),
  ]),
  'pf2e:JFb1euLOlFX2IBbp': design('Remote Detonation: the whispering shot strikes and sets off the runes traced on its target.', ({ recipe }) => [
    ...keep(recipe),
    impact('Runes invoked', ['markers.runes.orange.01'], { after: idOf(recipe, 'impact'), anchor: 'start', offset: 350, duration: 1400, scale: 0.75 }),
    impact('Runic burst', ['explosion.01.orange'], { after: idOf(recipe, 'impact'), anchor: 'start', offset: 700, duration: 1100, scale: 0.6 }),
  ]),
};
