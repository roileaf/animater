// Bespoke compositions (sf2e-a). Keys: '<system>:<entryId>' or '<system>:<entryId>:<variant|mode>'.
// See scripts/catalogs/bespoke/helpers.mjs and scripts/bespoke.mjs.
import { cast, travel, projectile, impact, area, aura, sprite, motion, tint, spin, breathe, design } from './helpers.mjs';

// Area-or-emanation helper: fill the native template when the entry has one,
// otherwise spread the layer as a wide aura around the acting token.
const hasArea = r => r?.trigger === 'template' || (r?.stages ?? []).some(s => s.kind === 'template');
const zone = (r, label, assets, o = {}) => (hasArea(r) ? area(label, assets, o) : aura(label, assets, { ...o, scale: (o.scale ?? 1) * 2.2 }));
const RUSH = { motionRange: 'distance', motionHeading: 'toward', motionEndpoint: 'near' };

export default {
  // ───────────────────────────── Spells ─────────────────────────────
  // Absolute Zero: a swirling vortex flash-freezes the air.
  'sf2e:kGas0LdEAR1WjLGZ': design('A freezing vortex whirls through the area, then flash-freezes into ice spikes; caught creatures stagger.', () => [
    cast('Cold gathers', ['cast_generic.ice.01.blue', 'cast_generic.02.blue'], { stageId: 'az-c', scale: 0.8, duration: 700 }),
    area('Freezing vortex', ['whirlwind.bluewhite', 'whirlwind.bluegrey'], { stageId: 'az-v', after: 'az-c', duration: 1800, opacity: 0.8, fadeIn: 200, fadeOut: 400 }),
    area('Flash freeze', ['ice_spikes.radial.burst.blue', 'ice_spikes.radial.burst.white'], { stageId: 'az-f', after: 'az-v', anchor: 'start', offset: 900, duration: 2200 }),
    motion('stagger', 'targets', { after: 'az-f', anchor: 'start', offset: 150, duration: 700, intensity: 0.7 }),
  ]),
  // Adaptive Camouflage: bend light amid explosions, become undetected and Step.
  'sf2e:p83iYWlcJRqe0PxL': design('Light bends around the caster, who flickers out of sight and slips a step away under the chaos.', () => [
    cast('Light bends', ['shimmer.01.purple', 'shimmer.01.blue'], { stageId: 'ac-s', duration: 1100, fadeOut: 300 }),
    sprite('Fading silhouette', { stageId: 'ac-e', after: 'ac-s', anchor: 'start', offset: 200, duration: 1100, opacity: 0.5, fadeOut: 600 }),
    motion('flicker', 'source', { after: 'ac-s', anchor: 'start', offset: 150, duration: 1000, intensity: 0.7 }),
  ]),
  // Atomic Blast: split an atom; explosion with radioactive fallout.
  'sf2e:UnWaP06SVi3jRN0M': design('Energy collapses inward to a split atom, detonates in a fireball and leaves a sickly green radioactive haze.', () => [
    cast('Atom splits', ['particles.inward.orange.01.01', 'particles.inward.greenyellow.01.01'], { stageId: 'ab-c', scale: 0.8, duration: 800 }),
    area('Atomic detonation', ['explosion.04.orange', 'explosion.01.orange'], { stageId: 'ab-x', after: 'ab-c', duration: 1700 }),
    area('Radioactive fallout', ['fumes.04.complete.green', 'fumes.04.complete.grey'], { after: 'ab-x', anchor: 'start', offset: 900, duration: 2600, opacity: 0.75, ...tint('#9be04a') }),
    motion('stagger', 'targets', { after: 'ab-x', anchor: 'start', offset: 150, duration: 750, intensity: 0.9 }),
  ], { sound: 'explosion' }),
  // Cairn Form: skin becomes a carapace of solid stone.
  'sf2e:HAaRcHfN4g83eSEC': design('Earth answers the casting and stone plates close over the target as a carapace; the target braces under the weight.', () => [
    cast('Earth answers', ['cast_generic.earth.01.browngreen'], { stageId: 'cf-c', scale: 0.8, duration: 800 }),
    impact('Stone plates close', ['falling_rocks.top.1x1.sandstone', 'falling_rocks.top.1x1.grey'], { stageId: 'cf-r', after: 'cf-c', duration: 1600, scale: 0.8 }),
    aura('Stone carapace', ['aura_themed.01.inward.complete.metal.01.grey'], { subject: 'targets', after: 'cf-r', anchor: 'start', offset: 600, duration: 2000, scale: 0.9, ...tint('#9a8466') }),
    motion('brace', 'targets', { after: 'cf-r', anchor: 'start', offset: 500, duration: 900, intensity: 0.6 }),
  ], { sound: 'earth' }),
  // Call Cosmos: a column of burning stars and frozen comets with a swirl of stardust.
  'sf2e:J3zMwmhIVgI2yzxm': design('Burning star fragments and frozen comet ice slam down in a column, leaving a swirl of stardust over the area.', () => [
    cast('Reach into the void', ['cast_generic.03.blueteal', 'cast_generic.03.blue'], { stageId: 'cc-c', scale: 0.9, duration: 800 }),
    area('Star-fire impact', ['fireball.explosion.orange'], { stageId: 'cc-f', after: 'cc-c', duration: 1700 }),
    area('Comet ice shatters', ['ice_spikes.radial.burst.blue', 'ice_spikes.radial.burst.white'], { after: 'cc-f', anchor: 'start', offset: 250, duration: 2000, scale: 0.9 }),
    area('Stardust swirl', ['twinkling_stars.points07.white'], { after: 'cc-f', anchor: 'start', offset: 900, duration: 2600, opacity: 0.85, fadeIn: 300, fadeOut: 700, ...spin(8000) }),
    motion('stagger', 'targets', { after: 'cc-f', anchor: 'start', offset: 150, duration: 750, intensity: 0.8 }),
  ]),
  // Caustic Conversion: a torrent of magical nanites dissolves the target.
  'sf2e:GB1RVtoFPwyH1B9G': design('A helix torrent of green nanites streams into the target and splashes into corrosive fumes.', () => [
    cast('Nanites gather', ['cast_generic.02.green', 'cast_generic.02.blue'], { stageId: 'cv-c', scale: 0.8, duration: 600 }),
    travel('Nanite torrent', ['ranged_helix.001.greenyellow', 'ranged_helix.001.blue'], { stageId: 'cv-t', after: 'cv-c', duration: 1500, ...tint('#8fe04a') }),
    impact('Dissolving splash', ['liquid.splash.green', 'liquid.splash.blue'], { stageId: 'cv-i', after: 'cv-t', anchor: 'end', offset: -150, duration: 1500, scale: 0.9 }),
    aura('Corrosive fumes', ['fumes.04.loop.green', 'fumes.04.loop.grey'], { subject: 'targets', after: 'cv-i', anchor: 'start', offset: 400, duration: 1800, opacity: 0.7, fadeOut: 500 }),
    motion('recoil', 'targets', { after: 'cv-t', anchor: 'end', offset: -150, duration: 650, intensity: 0.6 }),
  ]),
  // Chrono Push: shove a creature so hard it slides through time.
  'sf2e:g58dbrP7FadZhh6j': design('A temporal force bolt strikes the target, bursting in time-light as it is shoved back.', () => [
    cast('Temporal force', ['cast_generic.03.bluepurple', 'cast_generic.03.blue'], { stageId: 'cp-c', scale: 0.8, duration: 600 }),
    travel('Time-shear bolt', ['ranged_missile.001.bluepurple', 'ranged_missile.001.blue'], { stageId: 'cp-t', after: 'cp-c', duration: 1300 }),
    impact('Temporal burst', ['impact.013.001.bluepurple', 'impact.013.001.orangeyellow'], { after: 'cp-t', anchor: 'end', offset: -150, duration: 1300 }),
    motion('recoil', 'targets', { after: 'cp-t', anchor: 'end', offset: -150, duration: 750, intensity: 1 }),
  ]),
  // Control Machine: take telepathic control of a technological creature.
  'sf2e:7WtiWJRYZhT6a9Ey': design('A telepathic command signal links caster to machine; sci-fi markers lock over the target as its systems are seized.', () => [
    cast('Command uplink', ['markers_scifi.001.complete.001.blueteal'], { stageId: 'cm-c', scale: 0.8, duration: 700 }),
    travel('Command signal', ['energy_strands.range.standard.blue.01', 'energy_strands.range.standard.purple.01'], { stageId: 'cm-t', after: 'cm-c', anchor: 'start', offset: 300, duration: 1500 }),
    impact('Systems seized', ['markers_scifi.002.complete.001.blueteal'], { after: 'cm-t', anchor: 'end', offset: -150, duration: 1800, scale: 0.9 }),
    motion('shake', 'targets', { after: 'cm-t', anchor: 'end', offset: -150, duration: 700, intensity: 0.4 }),
  ]),
  // Desiccate: pull the moisture from the targets' bodies.
  'sf2e:M0jQlpQYUr0pp2Sv': design('Void magic wrenches water out of each target in a splash that boils off as steam; the targets stagger, parched.', () => [
    cast('Void thirst', ['arms_of_hadar.dark_purple'], { stageId: 'ds-c', scale: 0.6, duration: 700 }),
    impact('Moisture torn out', ['liquid.splash.blue'], { stageId: 'ds-i', after: 'ds-c', duration: 1400, scale: 0.9 }),
    impact('Water boils away', ['fumes.steam.white'], { after: 'ds-i', anchor: 'start', offset: 500, duration: 1800, scale: 0.9, opacity: 0.8 }),
    motion('stagger', 'targets', { after: 'ds-i', anchor: 'start', offset: 200, duration: 800, intensity: 0.7 }),
  ]),
  // Dizzying Colors: swirling multitude of colors overwhelms creatures in a cone.
  'sf2e:UKsIOWmMx4hSpafl': design('A fan of swirling color fills the cone and dazzles the creatures caught in it, who reel.', () => [
    cast('Colors swirl', ['swirling_sparkles.01.bluepink', 'swirling_sparkles.01.blue'], { stageId: 'dc-c', scale: 0.8, duration: 700 }),
    area('Color fan', ['detect_magic.cone.purple', 'detect_magic.cone.blue'], { stageId: 'dc-a', after: 'dc-c', duration: 1800, opacity: 0.7 }),
    area('Prismatic flare', ['particle_burst.01.circle.bluepurple'], { after: 'dc-a', anchor: 'start', offset: 200, duration: 1600 }),
    impact('Overwhelmed', ['dizzy_stars.200px.pink', 'dizzy_stars.200px.blueorange'], { optionalTargets: true, after: 'dc-a', anchor: 'start', offset: 600, duration: 1800, scale: 0.7 }),
    motion('shake', 'targets', { after: 'dc-a', anchor: 'start', offset: 600, duration: 900, intensity: 0.4 }),
  ]),
  // Earthbind: the weight of earth hampers a flier's flight.
  'sf2e:gPvtmKMRpg9I9D7H': design('Earthen weight crashes onto the target and drags it downward toward cracking ground.', () => [
    cast('Weight of earth', ['cast_generic.earth.01.browngreen'], { stageId: 'eb-c', scale: 0.8, duration: 700 }),
    impact('Earthen weight falls', ['falling_rocks.top.1x1.sandstone', 'falling_rocks.top.1x1.grey'], { stageId: 'eb-r', after: 'eb-c', duration: 1600, scale: 0.8 }),
    impact('Pulled to ground', ['ground_cracks.02.orange'], { after: 'eb-r', anchor: 'start', offset: 600, duration: 1800, scale: 0.8, below: true }),
    motion('press', 'targets', { after: 'eb-r', anchor: 'start', offset: 300, duration: 1300, intensity: 0.9 }),
  ]),
  // Eclipse Burst: a globe of freezing darkness explodes.
  'sf2e:0jadeyQIItIuRgeH': design('A globe of black darkness erupts and freezes, shards of ice bursting through the shadow; creatures stagger.', () => [
    area('Dark globe', ['darkness.black'], { stageId: 'ec-d', duration: 2600, fadeIn: 200, fadeOut: 600 }),
    area('Freezing burst', ['ice_spikes.radial.burst.blue', 'ice_spikes.radial.burst.white'], { stageId: 'ec-i', after: 'ec-d', anchor: 'start', offset: 500, duration: 2200, ...tint('#9fb6ff') }),
    motion('stagger', 'targets', { after: 'ec-i', anchor: 'start', offset: 150, duration: 700, intensity: 0.8 }),
  ]),
  // Electric Arc: lightning leaps from one target to another.
  'sf2e:kBhaPuzLUSwS6vVf': design('A crackling arc leaps to each target in turn with a quick static discharge.', () => [
    cast('Charge current', ['static_electricity.01.blue'], { stageId: 'ea-c', scale: 0.7, duration: 500 }),
    travel('Leaping arc', ['chain_lightning.primary.blue'], { stageId: 'ea-t', after: 'ea-c', anchor: 'start', offset: 250, duration: 1200, targetStagger: 250 }),
    impact('Static discharge', ['static_electricity.03.blue'], { after: 'ea-t', anchor: 'end', offset: -150, duration: 1500, scale: 0.9 }),
    motion('shake', 'targets', { after: 'ea-t', anchor: 'end', offset: -150, duration: 700, intensity: 0.5 }),
  ]),
  // Event Horizon: unleash the power of a supermassive black hole.
  'sf2e:0pl80qKToraH4dvO': design('A black hole tears open over the area while void grasps crush inward; creatures are pressed down by its gravity.', () => [
    area('Black hole', ['celestial_bodies.black_hole.001.8x8.outward.complete.bluepurple', 'celestial_bodies.black_hole.001.8x8.outward.complete.blue'], { stageId: 'eh-b', duration: 3400, fadeIn: 200, fadeOut: 600 }),
    area('Crushing pull', ['arms_of_hadar.dark_purple'], { after: 'eh-b', anchor: 'start', offset: 500, duration: 2600, opacity: 0.75 }),
    motion('press', 'targets', { after: 'eh-b', anchor: 'start', offset: 700, duration: 1600, intensity: 1 }),
  ], { sound: 'gravity' }),
  // Execute: point at a creature and invoke the demise of all things.
  'sf2e:Z9OrRXKgAPv6Hn5l': design('A strand of void energy reaches the target and tolls its death in skull smoke; the target staggers.', () => [
    cast('Demise invoked', ['arms_of_hadar.dark_purple'], { stageId: 'ex-c', scale: 0.6, duration: 700 }),
    travel('Void strand', ['energy_strands.range.standard.dark_purple.01', 'energy_strands.range.standard.purple.01'], { stageId: 'ex-t', after: 'ex-c', anchor: 'start', offset: 300, duration: 1500 }),
    impact('Life snuffed', ['toll_the_dead.purple.skull_smoke', 'toll_the_dead.green.skull_smoke'], { after: 'ex-t', anchor: 'end', offset: -150, duration: 2000 }),
    motion('stagger', 'targets', { after: 'ex-t', anchor: 'end', offset: -150, duration: 800, intensity: 0.9 }),
  ], { sound: 'void' }),
  // Falling Stars: falling stars explode upon colliding with the ground.
  'sf2e:jrBa9deU2ULFWvSl': design('Stars streak down from the sky and explode on impact, scattering stardust; creatures stagger.', () => [
    area('Stars streak down', ['lightning_strike.yellow', 'lightning_strike.blue'], { stageId: 'fs-s', duration: 900, ...tint('#ffd36b') }),
    area('Explosive collision', ['explosion.03.yellow', 'explosion.01.orange'], { stageId: 'fs-x', after: 'fs-s', anchor: 'start', offset: 450, duration: 1700 }),
    area('Stardust', ['twinkling_stars.points07.white'], { after: 'fs-x', anchor: 'start', offset: 700, duration: 2200, opacity: 0.8, fadeOut: 600 }),
    motion('stagger', 'targets', { after: 'fs-x', anchor: 'start', offset: 150, duration: 750, intensity: 0.8 }),
  ], { sound: 'explosion' }),
  // Flicker: flicker quickly between this plane and another.
  'sf2e:zR67Rt3UMHKC5evy': design('The caster phases in and out between planes in a purple mist, flickering visibly.', () => [
    cast('Phase out', ['misty_step.01.purple', 'misty_step.01.blue'], { stageId: 'fl-c', duration: 1000 }),
    aura('Between planes', ['shimmer.01.purple', 'shimmer.01.blue'], { after: 'fl-c', anchor: 'start', offset: 300, duration: 1800, opacity: 0.7, fadeOut: 500 }),
    motion('flicker', 'source', { after: 'fl-c', anchor: 'start', offset: 200, duration: 1500, intensity: 0.8 }),
  ]),
  // Freeze Time: stop time for everything but yourself.
  'sf2e:1dsahW4g1ggXtypx': design('A still crystal of time forms over the caster and a frozen field spreads beneath; the moment holds.', () => [
    cast('Time halts', ['icosahedron.simple.blue'], { stageId: 'ft-i', duration: 2800, scale: 0.8, fadeIn: 300, fadeOut: 600 }),
    aura('Stilled moment', ['energy_field.02.below.blue'], { after: 'ft-i', anchor: 'start', offset: 300, duration: 2800, scale: 1.6, opacity: 0.7, below: true, fadeOut: 600 }),
    sprite('Held instant', { after: 'ft-i', anchor: 'start', offset: 400, duration: 1600, opacity: 0.5, fadeOut: 600 }),
    motion('pulse', 'source', { after: 'ft-i', anchor: 'start', duration: 900, intensity: 0.3 }),
  ]),
  // Gravity Field: increase gravity in an area; fliers descend.
  'sf2e:gLOelTMvex2OgBqV': design('A heavy gravity well settles over the area and buckles the ground; creatures inside are pressed down.', () => [
    cast('Bend gravity', ['cast_shape.circle.01.purple', 'cast_shape.circle.01.blue'], { stageId: 'gf-c', scale: 0.8, duration: 600 }),
    area('Gravity well', ['energy_field.02.below.purple', 'energy_field.02.below.blue'], { stageId: 'gf-w', after: 'gf-c', duration: 2600, opacity: 0.8, fadeOut: 600 }),
    area('Ground buckles', ['ground_cracks.02.purple', 'ground_cracks.02.orange'], { after: 'gf-w', anchor: 'start', offset: 400, duration: 2200, below: true }),
    motion('press', 'targets', { after: 'gf-w', anchor: 'start', offset: 400, duration: 1600, intensity: 0.9 }),
  ], { sound: 'gravity' }),
  // Harm: channel void energy to harm the living.
  'sf2e:wdA52JJnsuQWeyqz': design('Void energy gathers and strikes the target in a dark burst that leaves black wisps; the target staggers.', () => [
    cast('Void gathers', ['arms_of_hadar.dark_purple'], { stageId: 'hm-c', scale: 0.6, duration: 600 }),
    impact('Void strike', ['impact.011.dark_purple', 'impact.011.blue'], { stageId: 'hm-i', after: 'hm-c', duration: 1200 }),
    aura('Void residue', ['fumes.04.loop.black', 'fumes.04.loop.grey'], { subject: 'targets', after: 'hm-i', anchor: 'start', offset: 300, duration: 1600, opacity: 0.6, fadeOut: 500 }),
    motion('stagger', 'targets', { after: 'hm-i', anchor: 'start', offset: 100, duration: 700, intensity: 0.6 }),
  ], { sound: 'void' }),
  // Implosion: crush the target by collapsing it in on itself.
  'sf2e:4WS7HrFjwNvTn8T2': design('Particles rush inward and a sphere of annihilation crushes the target in on itself.', () => [
    impact('Matter rushes inward', ['particles.inward.greenyellow.01.01'], { stageId: 'im-p', duration: 1100, scale: 0.9, ...tint('#a07cff') }),
    impact('Collapse', ['sphere_of_annihilation.200px.purple'], { stageId: 'im-s', after: 'im-p', anchor: 'start', offset: 500, duration: 1800, scale: 0.7, scaleIn: 1.4, scaleInDuration: 1200 }),
    motion('press', 'targets', { after: 'im-s', anchor: 'start', duration: 1300, intensity: 1 }),
  ]),
  // Inject Nanobots: melee spell attack injecting acidic nanobots.
  'sf2e:ZofLZ5Zs8NN5yDPJ': design('The caster lunges to inject a swarm of nanobots, which swirl through the target and eat at it with acid.', () => [
    motion('lunge', 'source', { stageId: 'in-l', duration: 700, intensity: 0.7 }),
    impact('Injection', ['impact.005.green', 'impact.005.orange'], { stageId: 'in-i', after: 'in-l', anchor: 'start', offset: 300, duration: 900, scale: 0.7 }),
    impact('Nanite swarm', ['particles.swirl.greenyellow.01.01'], { after: 'in-i', anchor: 'start', offset: 200, duration: 2000, scale: 0.9 }),
    impact('Corrosion', ['liquid.splash.green', 'liquid.splash.blue'], { after: 'in-i', anchor: 'start', offset: 600, duration: 1500, scale: 0.7 }),
    motion('shake', 'targets', { after: 'in-i', anchor: 'start', offset: 200, duration: 800, intensity: 0.4 }),
  ]),
  // Irradiate: decay atoms around you into a burst of mild radiation.
  'sf2e:MfsxPjshwZJZuNpN': design('A sci-fi warning flare pulses and a green radiation burst spreads into a lingering radioactive haze.', ({ recipe }) => [
    cast('Atoms destabilise', ['markers_scifi.001.complete.001.greenyellow'], { stageId: 'ir-c', scale: 0.8, duration: 700 }),
    zone(recipe, 'Radiation burst', ['energy_field.02.below.green', 'energy_field.02.below.blue'], { stageId: 'ir-b', after: 'ir-c', duration: 1600, ...tint('#9be04a') }),
    zone(recipe, 'Radioactive haze', ['fumes.04.complete.green', 'fumes.04.complete.grey'], { after: 'ir-b', anchor: 'start', offset: 600, duration: 2400, opacity: 0.7, ...tint('#9be04a') }),
  ], { sound: 'poison' }),
  // Overload Systems: a wave of electrical interference.
  'sf2e:5cMDrC3jX1yrxOzh': design('A wave of crackling static floods the area; glitching tech markers flash over the creatures it shocks.', () => [
    cast('Interference builds', ['static_electricity.02.blue'], { stageId: 'os-c', scale: 0.8, duration: 600 }),
    area('Electrical interference', ['static_electricity.02.blue'], { stageId: 'os-a', after: 'os-c', duration: 2000 }),
    impact('Systems glitch', ['markers_scifi.002.complete.001.blueteal'], { optionalTargets: true, after: 'os-a', anchor: 'start', offset: 400, duration: 1600, scale: 0.7 }),
    motion('shake', 'targets', { after: 'os-a', anchor: 'start', offset: 400, duration: 800, intensity: 0.5 }),
  ]),
  // Phantasmal Calamity: a vision of apocalyptic destruction.
  'sf2e:0XP2XOxT9VSiXFDr': design('An illusory apocalypse erupts in purple-tinged fire and splitting ground; creatures cower from the vision.', () => [
    area('Visions of ruin', ['fireball.explosion.dark_purple', 'fireball.explosion.orange'], { stageId: 'pc-x', duration: 1800, ...tint('#a07cff') }),
    area('Illusory fissures', ['ground_cracks.02.purple', 'ground_cracks.02.orange'], { after: 'pc-x', anchor: 'start', offset: 400, duration: 2400, opacity: 0.7, below: true }),
    motion('cower', 'targets', { after: 'pc-x', anchor: 'start', offset: 300, duration: 1100, intensity: 0.7 }),
  ]),
  // Phantasmal Fleet: a vision of starships bombarding the ground with laser fire.
  'sf2e:Y3egStSTzL8k86qc': design('Phantom laser fire strikes down from an orbiting fleet: beams hit each creature and illusory blasts ripple through the area.', () => [
    cast('Fleet projected', ['markers_scifi.001.complete.001.purplered'], { stageId: 'pf-c', scale: 0.8, duration: 700 }),
    impact('Laser strikes from orbit', ['lightning_strike.red', 'lightning_strike.blue'], { stageId: 'pf-l', optionalTargets: true, after: 'pf-c', duration: 900, repeats: 2, repeatInterval: 450, ...tint('#ff5a5a') }),
    area('Bombardment blasts', ['explosion.03.purplepink', 'explosion.01.orange'], { stageId: 'pf-x', after: 'pf-c', anchor: 'start', offset: 600, duration: 1600, repeats: 2, repeatInterval: 600, opacity: 0.85 }),
    motion('cower', 'targets', { after: 'pf-x', anchor: 'start', offset: 200, duration: 1200, intensity: 0.7 }),
  ], { sound: 'explosion' }),
  // Pocket Vacuum: a sudden vacuum and explosive decompression.
  'sf2e:ITzIb93GBvyX8UbJ': design('Air whirls violently inward into a vacuum, then decompresses in a blast; creatures stagger.', () => [
    area('Air rushes inward', ['whirlwind.bluewhite', 'whirlwind.bluegrey'], { stageId: 'pv-w', duration: 1600, opacity: 0.8, ...spin(2400, -1) }),
    area('Decompression blast', ['explosion.02.blue'], { stageId: 'pv-x', after: 'pv-w', anchor: 'start', offset: 1100, duration: 1500 }),
    motion('stagger', 'targets', { after: 'pv-x', anchor: 'start', offset: 100, duration: 750, intensity: 0.9 }),
  ], { sound: 'wind' }),
  // Rocket Dash: emit a rocket of flame behind you and blast forward.
  'sf2e:BHWG0rQPTgBF5Ye1': design('Flame ignites behind the caster, who rockets forward in a straight line trailing fire.', ({ recipe }) => [
    cast('Ignition', ['cast_generic.fire.side01.orange'], { stageId: 'rd-c', duration: 700, mirrorX: true }),
    aura('Rocket exhaust', ['flames.04.complete.orange'], { stageId: 'rd-f', after: 'rd-c', anchor: 'start', offset: 300, duration: 1800, scale: 0.8, below: true, fadeOut: 500 }),
    ...(hasArea(recipe) ? [area('Flame wake', ['breath_weapons.fire.line.orange'], { after: 'rd-f', anchor: 'start', offset: 300, duration: 1800, opacity: 0.85 })] : []),
    motion('rush', 'source', { after: 'rd-c', anchor: 'start', offset: 400, duration: 1600, intensity: 0.7, distance: 3, ...RUSH }),
  ]),
  // Root of All Pain: a root pushed into the target burrows through its nerves.
  'sf2e:ZhQWnQ0500AAtjDb': design('A touch plants a root that bursts into creeping tendrils on the target, nerve-pain crackling through it.', () => [
    motion('lunge', 'source', { stageId: 'rp-l', duration: 600, intensity: 0.5 }),
    impact('Root takes hold', ['entangle.02.complete.02.green'], { stageId: 'rp-r', after: 'rp-l', anchor: 'start', offset: 300, duration: 2200, scale: 0.6 }),
    impact('Nerve agony', ['static_electricity.01.green', 'static_electricity.01.blue'], { after: 'rp-r', anchor: 'start', offset: 600, duration: 1400, scale: 0.8 }),
    motion('shake', 'targets', { after: 'rp-r', anchor: 'start', offset: 600, duration: 1000, intensity: 0.6 }),
  ]),
  // Shuffle Repeat: repeat a creature's personal anthem to empower it.
  'sf2e:AlYzxLKWZujnzsjJ': design('A remix of music notes flows to the target as its personal anthem swells around it.', () => [
    cast('Remix', ['music_notations.beamed_quavers.purple', 'music_notations.beamed_quavers.blue'], { stageId: 'sr-c', scale: 0.6, duration: 900 }),
    impact('Personal anthem', ['soundwave.01.purple', 'soundwave.01.blue'], { stageId: 'sr-i', after: 'sr-c', anchor: 'start', offset: 400, duration: 1300, scale: 1.2 }),
    aura('Empowered', ['bardic_inspiration.purplepink', 'bardic_inspiration.greenorange'], { subject: 'targets', after: 'sr-i', anchor: 'start', offset: 400, duration: 1800, fadeOut: 500 }),
    motion('pulse', 'targets', { after: 'sr-i', anchor: 'start', offset: 300, duration: 900, intensity: 0.3 }),
  ], { sound: 'song' }),
  // Singularity Seed: a dense particle blossoms into a gravitational singularity.
  'sf2e:aPZMapuunaNpxubp': design('A tiny seed blossoms into a singularity with a swirling black-hole disc that drags and compresses nearby creatures.', () => [
    area('Singularity blossoms', ['sphere_of_annihilation.200px.purple'], { stageId: 'ss-s', duration: 3000, scale: 0.5, scaleIn: 0.1, scaleInDuration: 900, fadeOut: 500 }),
    area('Gravity disc', ['celestial_bodies.black_hole.001.8x8.outward.complete.purplered', 'celestial_bodies.black_hole.001.8x8.outward.complete.blue'], { after: 'ss-s', anchor: 'start', offset: 600, duration: 2400, opacity: 0.8, fadeOut: 500 }),
    motion('press', 'targets', { after: 'ss-s', anchor: 'start', offset: 900, duration: 1400, intensity: 0.8 }),
  ], { sound: 'gravity' }),
  // Skyfire Wings: wings of plasma let you soar.
  'sf2e:VmtQlZqeraTv0Eer': design('Fiery feathers of plasma flare from the caster with crackling arcs, lifting it into the air.', () => [
    cast('Plasma ignites', ['cast_generic.fire.01.orange'], { stageId: 'sw-c', scale: 0.8, duration: 700 }),
    aura('Plasma wings', ['swirling_feathers.outburst.01.orange', 'swirling_feathers.outburst.01.textured'], { stageId: 'sw-w', after: 'sw-c', anchor: 'start', offset: 400, duration: 2000, scale: 1.2, ...tint('#ffa040') }),
    aura('Crackling plasma', ['static_electricity.02.orange', 'static_electricity.02.blue'], { after: 'sw-w', anchor: 'start', offset: 300, duration: 1600, scale: 0.9, opacity: 0.8 }),
    motion('levitate', 'source', { after: 'sw-w', anchor: 'start', offset: 200, duration: 2000, intensity: 0.8 }),
  ], { sound: 'fire' }),
  // Slice Reality: a chasm of life-draining entropy in a straight line.
  'sf2e:a02hsymtiVRQvh3i': design('A slash of void energy cuts a line through reality; entropic cracks open under the creatures it crosses.', () => [
    cast('Reality parts', ['arms_of_hadar.dark_purple'], { stageId: 'sl-c', scale: 0.6, duration: 600 }),
    travel('Reality slice', ['energy_beam.normal.dark_purplered.02', 'energy_beam.normal.bluepink.02'], { stageId: 'sl-t', after: 'sl-c', duration: 1800 }),
    impact('Entropic chasm', ['ground_cracks.02.purple', 'ground_cracks.02.orange'], { after: 'sl-t', anchor: 'end', offset: -150, duration: 2000, below: true }),
    motion('stagger', 'targets', { after: 'sl-t', anchor: 'end', offset: -150, duration: 750, intensity: 0.7 }),
  ]),
  // Sunburst: a globe of searing sunlight explodes.
  'sf2e:a3aQxCpoj1q1NQxC': design('Sunlight gathers and detonates as a blazing yellow globe of searing light; creatures reel.', () => [
    cast('Sunlight gathers', ['sacred_flame.source.yellow'], { stageId: 'sb-c', scale: 0.8, duration: 700 }),
    area('Solar detonation', ['fireball.explosion.yellow', 'fireball.explosion.orange'], { stageId: 'sb-x', after: 'sb-c', duration: 1800 }),
    area('Searing glare', ['glint.yellow.many'], { after: 'sb-x', anchor: 'start', offset: 500, duration: 2000, opacity: 0.9, fadeOut: 600 }),
    motion('stagger', 'targets', { after: 'sb-x', anchor: 'start', offset: 150, duration: 750, intensity: 0.8 }),
  ], { sound: 'fireball' }),
  // Telekinetic Strangulation: grasp a throat and lift the creature off the ground.
  'sf2e:OudLZtxmg6gI1UEL': design('An unseen hand closes on the target, lifting it a few inches off the ground as it struggles.', () => [
    cast('Telekinetic grip', ['cast_generic.03.purplered', 'cast_generic.03.blue'], { stageId: 'ts-c', scale: 0.8, duration: 600 }),
    impact('Vice grip', ['arcane_hand.purple'], { stageId: 'ts-h', after: 'ts-c', duration: 2400, scale: 0.6, fadeOut: 500 }),
    impact('Choking pressure', ['energy_strands.complete.purple.01', 'energy_strands.complete.blue.01'], { after: 'ts-h', anchor: 'start', offset: 400, duration: 1800, scale: 0.7 }),
    motion('levitate', 'targets', { after: 'ts-h', anchor: 'start', offset: 300, duration: 2000, intensity: 0.5 }),
    motion('shake', 'targets', { after: 'ts-h', anchor: 'start', offset: 500, duration: 1400, intensity: 0.35 }),
  ], { sound: 'force' }),
  // Time's Edge: a massive blade of time refracted into the plane.
  'sf2e:GdlG9a4o0ax0F2HT': design('A huge temporal blade sweeps across the area, leaving time-shear flashes; creatures stagger.', () => [
    cast('Time refracts', ['cast_generic.03.bluepurple', 'cast_generic.03.blue'], { stageId: 'te-c', scale: 0.8, duration: 600 }),
    area('Temporal blade', ['melee_generic.slash.02.001.purple', 'melee_generic.slash.02.001.blue'], { stageId: 'te-b', after: 'te-c', duration: 1300 }),
    area('Time shears', ['impact.013.002.bluepurple', 'impact.013.002.orangeyellow'], { after: 'te-b', anchor: 'start', offset: 400, duration: 1500 }),
    motion('stagger', 'targets', { after: 'te-b', anchor: 'start', offset: 400, duration: 750, intensity: 0.7 }),
  ]),
  // Vitality Web: the network manifests as a web of vital energy.
  'sf2e:6HMiN0oQzeoYR3it': design('Strands of green vital energy web from the caster to each bonded target and bloom into healing light.', () => [
    cast('Network surges', ['cast_generic.02.green', 'cast_generic.02.blue'], { stageId: 'vw-c', scale: 0.8, duration: 600 }),
    travel('Vital threads', ['energy_strands.range.standard.dark_green.01', 'energy_strands.range.standard.purple.01'], { stageId: 'vw-t', after: 'vw-c', anchor: 'start', offset: 300, duration: 1600, ...tint('#7be08a') }),
    impact('Fast healing', ['healing_generic.03.burst.green', 'healing_generic.03.burst.bluegreen'], { after: 'vw-t', anchor: 'end', offset: -150, duration: 1800 }),
    motion('pulse', 'targets', { after: 'vw-t', anchor: 'end', offset: -150, duration: 900, intensity: 0.4 }),
  ], { sound: 'healing' }),
  // Wall of Plasma: a wall of crackling plasma.
  'sf2e:dRP4Imw3RJNQqEgc': design('A blue-white wall of plasma flame rises with electric arcs crackling along its length.', () => [
    area('Plasma wall', ['wall_of_fire.300x100.blue'], { stageId: 'wp-w', duration: 4200, fadeIn: 300, fadeOut: 600, ...tint('#b98cff') }),
    area('Crackling arcs', ['static_electricity.02.blue'], { after: 'wp-w', anchor: 'start', offset: 600, duration: 2400, areaLayout: 'tiles', opacity: 0.85 }),
  ], { sound: 'fireWall' }),
  // Wave of Despair: inflict despair on creatures in a cone.
  'sf2e:GaRQlC9Yw1BGKHfN': design('A wave of black despair rolls through the cone; fear marks rise over the creatures and they cower.', () => [
    cast('Despair wells', ['smoke.puff.centered.dark_purple', 'smoke.puff.centered.grey'], { stageId: 'wd-c', scale: 0.8, duration: 700 }),
    area('Wave of despair', ['breath_weapons02.burst.cone.arcana.dark_black.01', 'detect_magic.cone.blue'], { stageId: 'wd-a', after: 'wd-c', anchor: 'start', offset: 300, duration: 2200 }),
    impact('Hope drains', ['markers.fear.dark_purple.01'], { optionalTargets: true, after: 'wd-a', anchor: 'start', offset: 700, duration: 1800, scale: 0.6 }),
    motion('cower', 'targets', { after: 'wd-a', anchor: 'start', offset: 700, duration: 1200, intensity: 0.7 }),
  ]),
  // X-Ray Vision: see through most materials.
  'sf2e:DPP4TW5FxE85XPKZ': design("The caster's eyes sharpen and a sci-fi scanning reticle sweeps around it.", () => [
    cast('Vision sharpens', ['eyes.01.bluegreen.single', 'eyes.01.dark_green.single'], { stageId: 'xr-e', scale: 0.5, duration: 1400, offsetY: -0.3, offsetUnits: 'token' }),
    aura('X-ray scan', ['markers_scifi.002.complete.001.white', 'markers_scifi.002.complete.001.blue'], { after: 'xr-e', anchor: 'start', offset: 400, duration: 2200, scale: 1.2 }),
  ], { sound: null }),

  // ───────────────────────────── Feats & actions ─────────────────────────────
  // Absorb Flame: incorporate fire washing over you into your own flame.
  'sf2e:sf2e-feat-feats-Y5mpjkk8s6UQJYvQ': design('Fire washing over the novian is drawn inward and its solar luminance flares brighter.', () => [
    cast('Fire washes over', ['flames.01.orange'], { stageId: 'af-f', duration: 1000, scale: 0.8 }),
    cast('Flame absorbed', ['particles.inward.orange.01.01', 'particles.inward.greenyellow.01.01'], { stageId: 'af-p', after: 'af-f', anchor: 'start', offset: 400, duration: 1100, ...tint('#ff9a3c') }),
    aura('Luminance flares', ['fire_ring.500px.yellow', 'fire_ring.500px.red'], { after: 'af-p', anchor: 'start', offset: 500, duration: 1800, scale: 1.4, opacity: 0.8, fadeOut: 500 }),
    motion('pulse', 'source', { after: 'af-p', anchor: 'start', offset: 500, duration: 900, intensity: 0.5 }),
  ]),
  // Absorb Light: snuff out mundane light in a burst around you.
  'sf2e:sf2e-feat-actions-JdLNIaTM4eyI9Luo': design('Light is drawn into the creature and darkness spreads outward, snuffing nearby lights.', ({ recipe }) => [
    cast('Light drawn in', ['particles.inward.greenyellow.01.01'], { stageId: 'al-p', duration: 1000, ...tint('#fff2b0') }),
    zone(recipe, 'Lights snuffed', ['darkness.black'], { after: 'al-p', anchor: 'start', offset: 600, duration: 2200, opacity: 0.85, fadeIn: 300, fadeOut: 600 }),
    motion('pulse', 'source', { after: 'al-p', anchor: 'start', offset: 500, duration: 800, intensity: 0.3 }),
  ]),
  // Acidic Spit: spit acid in a 30-foot line.
  'sf2e:sf2e-feat-feats-zFdo4ZUj9TckfJvQ': design('A jet of acid spits along the line and splashes over the creatures in it.', ({ recipe }) => [
    motion('lunge', 'source', { stageId: 'as-l', duration: 500, intensity: 0.4 }),
    hasArea(recipe)
      ? area('Acid line', ['breath_weapons.acid.line.green'], { stageId: 'as-a', after: 'as-l', anchor: 'start', offset: 200, duration: 1800 })
      : travel('Acid jet', ['breath_weapons.acid.line.green'], { stageId: 'as-a', after: 'as-l', anchor: 'start', offset: 200, duration: 1800 }),
    impact('Acid splash', ['liquid.splash.green', 'liquid.splash.blue'], { optionalTargets: true, after: 'as-a', anchor: 'start', offset: 700, duration: 1400, scale: 0.7 }),
    motion('recoil', 'targets', { after: 'as-a', anchor: 'start', offset: 700, duration: 650, intensity: 0.5 }),
  ]),
  // Activate All Brains!: all brains hyperactive; quickened.
  'sf2e:sf2e-feat-feats-M0tr0DiimDRG8gEf': design('Sci-fi markers spark as every brain kicks into overdrive; a quickened afterimage trails the fonqugon.', () => [
    cast('Brains ignite', ['markers_scifi.001.complete.003.purplered', 'markers_scifi.001.complete.001.purplered'], { stageId: 'ab-c', duration: 1200, offsetY: -0.3, offsetUnits: 'token' }),
    aura('Hyperactive processing', ['swirling_sparkles.01.bluepink', 'swirling_sparkles.01.blue'], { after: 'ab-c', anchor: 'start', offset: 400, duration: 1600, fadeOut: 400 }),
    sprite('Quickened echo', { after: 'ab-c', anchor: 'start', offset: 600, duration: 900, opacity: 0.5, fadeOut: 400 }),
    motion('pulse', 'source', { after: 'ab-c', anchor: 'start', offset: 300, duration: 800, intensity: 0.3 }),
  ], { sound: null }),
  // Alarming Scream: a loud shriek to draw attention.
  'sf2e:sf2e-feat-feats-TD155YQzzI2OvwXA': design('A piercing shriek ripples out in sound waves; enemies flinch with startled fear marks.', () => [
    cast('Shriek', ['cast_generic.sound.01.pinkteal'], { stageId: 'sc-c', duration: 700 }),
    aura('Alarm wave', ['soundwave.02.red', 'soundwave.02.blue'], { stageId: 'sc-w', after: 'sc-c', anchor: 'start', offset: 200, duration: 1600, scale: 2.4 }),
    impact('Startled', ['markers.fear.orange.01', 'markers.fear.dark_purple.01'], { optionalTargets: true, after: 'sc-w', anchor: 'start', offset: 400, duration: 1600, scale: 0.6 }),
    motion('cower', 'targets', { after: 'sc-w', anchor: 'start', offset: 400, duration: 1000, intensity: 0.6 }),
  ]),
  // Another Day: summon a primal form of desperation for temporary HP.
  'sf2e:sf2e-feat-feats-skKhJy1W0paZlAEA': design('A surge of primal desperation wraps the mecenaic in a protective green shell; it braces.', () => [
    cast('Desperation surges', ['cast_generic.03.greenyellow', 'cast_generic.03.blue'], { stageId: 'ad-c', duration: 700 }),
    aura('Primal ward', ['shield.01.complete.01.green', 'shield.01.complete.01.blue'], { after: 'ad-c', anchor: 'start', offset: 300, duration: 1800, scale: 1.1 }),
    motion('brace', 'source', { after: 'ad-c', anchor: 'start', offset: 200, duration: 900, intensity: 0.5 }),
  ]),
  // Apocalypse Burst: vent internal gases while spinning; fiery emanation.
  'sf2e:sf2e-feat-feats-ajiFXoaXcwXqIoIW': design('The gfolian spins in place, venting gases that ignite into a burst of flame all around it.', ({ recipe }) => [
    motion('spin', 'source', { stageId: 'ap-s', duration: 1200, intensity: 0.6 }),
    zone(recipe, 'Gas ignites', ['fireball.explosion.orange'], { stageId: 'ap-x', after: 'ap-s', anchor: 'start', offset: 500, duration: 1700 }),
    zone(recipe, 'Burning vapour', ['flames.04.complete.orange'], { after: 'ap-x', anchor: 'start', offset: 600, duration: 2000, opacity: 0.8, fadeOut: 500 }),
    motion('stagger', 'targets', { after: 'ap-x', anchor: 'start', offset: 150, duration: 700, intensity: 0.6 }),
  ]),
  // Auto-Fire: spray a cone with automatic fire.
  'sf2e:sf2e-feat-actions-6ctkxUnVwqooSvgg': design('A muzzle burst sprays rapid rounds into each creature in the cone; the shooter rocks with recoil.', () => [
    cast('Muzzle burst', ['muzzle_flash.burst.01.yellow', 'muzzle_flash.single.01.yellow'], { stageId: 'au-m', duration: 700, faceTarget: true }),
    travel('Spray of rounds', ['bullet.03.orange', 'bullet.01.orange'], { stageId: 'au-t', optionalTargets: true, after: 'au-m', anchor: 'start', offset: 100, duration: 900, repeats: 3, repeatInterval: 150 }),
    impact('Rounds strike', ['impact.005.orange'], { optionalTargets: true, after: 'au-t', anchor: 'end', offset: -150, duration: 900, scale: 0.6, repeats: 3, repeatInterval: 150 }),
    motion('recoil', 'source', { after: 'au-m', anchor: 'start', duration: 900, intensity: 0.4 }),
    motion('shake', 'targets', { after: 'au-t', anchor: 'end', offset: -150, duration: 700, intensity: 0.4 }),
  ]),
  // Bioluminescent Flash Bang: a blinding burst of bioluminescence.
  'sf2e:sf2e-feat-feats-YwNGOVQ6xyN3whwn': design('The shirren erupts in a blinding flash of bioluminescent light; nearby creatures recoil.', ({ recipe }) => [
    cast('Glow builds', ['markers.light.complete.yellow', 'markers.light.complete.blue'], { stageId: 'fb-c', duration: 700, scale: 0.8 }),
    zone(recipe, 'Blinding flash', ['explosion.03.yellow', 'explosion.03.blueyellow'], { stageId: 'fb-x', after: 'fb-c', anchor: 'start', offset: 400, duration: 1500 }),
    motion('recoil', 'targets', { after: 'fb-x', anchor: 'start', offset: 100, duration: 650, intensity: 0.5 }),
  ]),
  // Blood Feast: leech vitality from nearby living creatures.
  'sf2e:sf2e-feat-feats-DWgfKsZGmidpyfDq': design('Blood is wrenched from nearby creatures and red life force gathers into the corpsefolk.', () => [
    impact('Lifeblood leeched', ['liquid.splash02.red'], { stageId: 'bf-i', optionalTargets: true, duration: 1300, scale: 0.7 }),
    cast('Vitality drawn in', ['particles.inward.red.01.01', 'particles.inward.greenyellow.01.01'], { stageId: 'bf-p', after: 'bf-i', anchor: 'start', offset: 400, duration: 1300, ...tint('#c0303a') }),
    aura('Necromantic sustenance', ['healing_generic.200px.red', 'healing_generic.200px.purple'], { after: 'bf-p', anchor: 'start', offset: 600, duration: 1600, fadeOut: 400 }),
    motion('stagger', 'targets', { after: 'bf-i', anchor: 'start', offset: 100, duration: 700, intensity: 0.5 }),
  ]),
  // Body Electric: retaliatory discharge into an adjacent attacker.
  'sf2e:sf2e-feat-feats-Pj466GpuvlcqCpQd': design('Stored charge snaps from the urog into its attacker as a short lightning arc.', () => [
    cast('Inner battery', ['static_electricity.01.blue'], { stageId: 'be-c', duration: 500, scale: 0.8 }),
    travel('Retaliatory discharge', ['chain_lightning.primary.blue'], { stageId: 'be-t', after: 'be-c', anchor: 'start', offset: 200, duration: 900 }),
    impact('Shock', ['static_electricity.03.blue'], { after: 'be-t', anchor: 'end', offset: -150, duration: 1300, scale: 0.8 }),
    motion('shake', 'targets', { after: 'be-t', anchor: 'end', offset: -150, duration: 700, intensity: 0.5 }),
  ]),
  // Brightbomb: Step and leave a burst of brilliant light.
  'sf2e:sf2e-feat-feats-K2N895JiLphTx4ss': design('The elf steps aside as a scintillating burst of light detonates where it stood.', ({ recipe }) => [
    zone(recipe, 'Brilliant burst', ['explosion.03.yellow', 'explosion.03.blueyellow'], { stageId: 'bb-x', duration: 1500, scale: hasArea(recipe) ? 1 : 0.45 }),
    motion('dodge', 'source', { after: 'bb-x', anchor: 'start', offset: 150, duration: 900, intensity: 0.5, distance: 1, ...RUSH }),
    motion('recoil', 'targets', { after: 'bb-x', anchor: 'start', offset: 100, duration: 650, intensity: 0.4 }),
  ], { sound: 'light' }),
  // Brutal Blows: pummel with a fist Strike and grapple.
  'sf2e:sf2e-feat-feats-tWpWkc42MbAS16BP': design('The shobhad lunges and hammers the foe with a heavy fist blow; the target staggers.', () => [
    motion('lunge', 'source', { stageId: 'br-l', duration: 750, intensity: 0.7 }),
    impact('Fist hammers', ['unarmed_strike.physical.02.orange', 'unarmed_strike.physical.02.blue'], { stageId: 'br-i', after: 'br-l', anchor: 'start', offset: 300, duration: 1200 }),
    motion('stagger', 'targets', { after: 'br-i', anchor: 'start', offset: 250, duration: 750, intensity: 0.7 }),
  ], { sound: 'unarmed', soundNamespace: 'ability' }),
  // Bullet Dance: Stride twice firing up to three shots at different creatures.
  'sf2e:sf2e-feat-feats-J9MbGFyEZscnEaWU': design('The operative dashes across the field, snapping off shots at up to three different targets.', () => [
    motion('rush', 'source', { stageId: 'bd-r', duration: 2400, intensity: 0.5, distance: 3, ...RUSH }),
    travel('Shots on the move', ['bullet.01.orange'], { stageId: 'bd-t', optionalTargets: true, targetLimit: 3, targetStagger: 500, after: 'bd-r', anchor: 'start', offset: 400, duration: 800 }),
    impact('Rounds land', ['impact.005.orange'], { optionalTargets: true, targetLimit: 3, after: 'bd-t', anchor: 'end', offset: -150, duration: 900, scale: 0.6 }),
    motion('shake', 'targets', { after: 'bd-t', anchor: 'end', offset: -150, duration: 600, intensity: 0.4 }),
  ], { sound: 'firearm', soundNamespace: 'ability' }),
  // Bullet Fever: frenzy instead of falling at 0 HP.
  'sf2e:sf2e-feat-feats-9RqJNPSx5T6b2WoB': design('The operative refuses to fall: a red surge of adrenaline bursts out and it shakes with frenzy.', () => [
    cast('Refuses to fall', ['cast_generic.dark.01.red', 'cast_generic.fire.01.orange'], { stageId: 'bv-c', duration: 700 }),
    aura('Frenzy', ['particles.outward.red.01.03', 'particles.outward.greenyellow.01.03'], { after: 'bv-c', anchor: 'start', offset: 300, duration: 1800, ...tint('#e0303a') }),
    motion('shake', 'source', { after: 'bv-c', anchor: 'start', offset: 300, duration: 900, intensity: 0.5 }),
  ], { sound: 'battleCry', soundNamespace: 'ability' }),
  // Caustic Trail: a slime trail of resin and corrosive slime.
  'sf2e:sf2e-feat-feats-AwQdvFb2PXPuAoLi': design('Corrosive slime oozes out as the gnarefuroid moves, leaving a trail of acid fumes.', () => [
    cast('Slime oozes', ['liquid.splash.green', 'liquid.splash.blue'], { stageId: 'ct-s', duration: 1200, scale: 0.8, below: true }),
    motion('rush', 'source', { stageId: 'ct-r', after: 'ct-s', anchor: 'start', offset: 200, duration: 2400, intensity: 0.3, distance: 3, ...RUSH }),
    aura('Corrosive fumes', ['fumes.04.loop.green', 'fumes.04.loop.grey'], { after: 'ct-r', anchor: 'start', offset: 300, duration: 2200, opacity: 0.6, below: true, fadeOut: 600 }),
  ]),
  // Cellular Static Discharge: discharge stored electricity in an emanation.
  'sf2e:sf2e-feat-feats-D4H1WVXBB2hmF7kn': design('Stored static builds on the barathu and discharges in a crackling ball of lightning around it.', ({ recipe }) => [
    cast('Charge builds', ['static_electricity.01.blue'], { stageId: 'cs-c', duration: 700 }),
    zone(recipe, 'Static discharge', ['lightning_ball.blue'], { stageId: 'cs-x', after: 'cs-c', anchor: 'start', offset: 400, duration: 1600 }),
    zone(recipe, 'Arcing static', ['static_electricity.02.blue'], { after: 'cs-x', anchor: 'start', offset: 200, duration: 1400, opacity: 0.85 }),
    motion('shake', 'targets', { after: 'cs-x', anchor: 'start', offset: 200, duration: 700, intensity: 0.5 }),
  ]),
  // Charged Blood: arcane blood revitalises and quickens.
  'sf2e:sf2e-feat-feats-w8qATrrJaeOh8rTH': design('Arcane blood surges red through the madrosarai, healing it, with a quickened afterimage.', () => [
    cast('Blood surges', ['cast_generic.dark.01.red', 'cast_generic.01.yellow'], { stageId: 'cb-c', duration: 700, ...tint('#d0303a') }),
    aura('Revitalised', ['healing_generic.200px.red', 'healing_generic.200px.purple'], { after: 'cb-c', anchor: 'start', offset: 300, duration: 1800, fadeOut: 400 }),
    sprite('Quickened echo', { after: 'cb-c', anchor: 'start', offset: 800, duration: 900, opacity: 0.5, fadeOut: 400 }),
    motion('pulse', 'source', { after: 'cb-c', anchor: 'start', offset: 300, duration: 900, intensity: 0.4 }),
  ]),
  // Clinging Flare: solar flare wraps around foes, immobilising them.
  'sf2e:sf2e-feat-feats-uoFMox9RchlL7Jbm': design('A solar flare streaks to the foe and wraps around it in golden tendrils.', () => [
    travel('Solar flare', ['ranged_missile.001.orangeyellow', 'ranged_missile.001.blue'], { stageId: 'cl-t', duration: 1200 }),
    impact('Flare wraps', ['entangle.02.complete.03.dark_orange', 'entangle.yellow'], { after: 'cl-t', anchor: 'end', offset: -150, duration: 2200, scale: 0.6 }),
    motion('recoil', 'targets', { after: 'cl-t', anchor: 'end', offset: -150, duration: 650, intensity: 0.5 }),
  ], { sound: 'radiantRay' }),
  // Command an Animal: issue an order to an animal.
  'sf2e:sf2e-feat-actions-q9nbyIF0PEBqMtYe': design('A spoken order ripples out and a direction cue appears over the animal.', () => [
    cast('Command given', ['soundwave.02.orangeyellow', 'soundwave.02.blue'], { stageId: 'ca-c', duration: 1100, scale: 0.8 }),
    impact('Order heeded', ['ui.chevrons3.yellow'], { optionalTargets: true, after: 'ca-c', anchor: 'start', offset: 500, duration: 1400, scale: 0.5, offsetY: -0.5, offsetUnits: 'token' }),
  ], { sound: null }),
  // Controlled Rage: temporary rage with extra melee damage.
  'sf2e:sf2e-feat-actions-Mfih4GjatO1sw2Ug': design('Red fury boils up around the creature as it shudders with controlled rage.', () => [
    cast('Rage builds', ['cast_generic.dark.01.red', 'cast_generic.fire.01.orange'], { stageId: 'cr-c', duration: 700 }),
    aura('Controlled fury', ['particles.outward.red.01.03', 'particles.outward.greenyellow.01.03'], { after: 'cr-c', anchor: 'start', offset: 300, duration: 1800, ...tint('#e0303a') }),
    motion('shake', 'source', { after: 'cr-c', anchor: 'start', offset: 300, duration: 900, intensity: 0.4 }),
  ]),
  // Coordinated Ambush!: designate an enemy for a hidden ally.
  'sf2e:sf2e-feat-actions-8mIyIlniGH2SMO6B': design('The envoy flags an enemy with a targeting reticle for the hidden ally.', () => [
    impact('Target marked', ['ui.indicator.redyellow.02.01', 'ui.indicator.yellow.01.01'], { stageId: 'cm-i', optionalTargets: true, targetSelection: 'first', duration: 2000, scale: 0.8 }),
  ], { sound: null }),
  // Coordinated Fire: bellowed order while unloading an area/auto weapon.
  'sf2e:sf2e-feat-feats-ai1n3ZCBbM5VEGPo': design('The soldier bellows an order and unloads a spray of rounds with a muzzle burst.', () => [
    cast('Bellowed order', ['soundwave.02.orangeyellow', 'soundwave.02.blue'], { stageId: 'cf-o', duration: 1000, scale: 1 }),
    cast('Muzzle burst', ['muzzle_flash.burst.01.yellow', 'muzzle_flash.single.01.yellow'], { stageId: 'cf-m', after: 'cf-o', anchor: 'start', offset: 300, duration: 700, faceTarget: true }),
    travel('Covering rounds', ['bullet.03.orange', 'bullet.01.orange'], { optionalTargets: true, after: 'cf-m', anchor: 'start', offset: 100, duration: 900, repeats: 3, repeatInterval: 150 }),
    motion('recoil', 'source', { after: 'cf-m', anchor: 'start', duration: 900, intensity: 0.4 }),
  ], { sound: 'firearm', soundNamespace: 'ability' }),
  // Covering Fire: suppressive shot that deals no damage.
  'sf2e:sf2e-feat-feats-bSNHMpq5e4ZYOyWo': design('A burst of suppressing rounds pins the target, which cowers.', () => [
    cast('Muzzle flash', ['muzzle_flash.single.01.yellow'], { stageId: 'cv-m', duration: 600, faceTarget: true }),
    travel('Suppressing rounds', ['bullet.01.orange'], { stageId: 'cv-t', after: 'cv-m', anchor: 'start', offset: 100, duration: 900, repeats: 2, repeatInterval: 200 }),
    impact('Rounds snap nearby', ['impact.005.orange'], { after: 'cv-t', anchor: 'end', offset: -150, duration: 900, scale: 0.5, repeats: 2, repeatInterval: 200, offsetX: 0.3, offsetUnits: 'token' }),
    motion('cower', 'targets', { after: 'cv-t', anchor: 'end', offset: -150, duration: 1000, intensity: 0.6 }),
  ]),
  // Covering Flare: Stride twice with a suppressing solar flare Strike.
  'sf2e:sf2e-feat-feats-9RgKTogyOlvbf0LH': design('The solarian advances and looses a solar flare that suppresses the foe.', () => [
    motion('rush', 'source', { stageId: 'fl-r', duration: 2200, intensity: 0.5, distance: 3, ...RUSH }),
    travel('Solar flare', ['ranged_missile.001.orangeyellow', 'ranged_missile.001.blue'], { stageId: 'fl-t', after: 'fl-r', anchor: 'start', offset: 900, duration: 1200 }),
    impact('Flare burst', ['impact.013.001.orangeyellow'], { after: 'fl-t', anchor: 'end', offset: -150, duration: 1200 }),
    motion('cower', 'targets', { after: 'fl-t', anchor: 'end', offset: -150, duration: 900, intensity: 0.5 }),
  ], { sound: 'radiantRay' }),
  // Create a Diversion: draw creatures' attention elsewhere.
  'sf2e:sf2e-feat-actions-GkmbTGfg8KcgynOA': design('A quick puff of distraction flashes beside the creature while it slips aside.', () => [
    cast('Distraction', ['smoke.puff.side.02.white', 'smoke.puff.side.grey'], { stageId: 'di-c', duration: 1200, offsetX: 0.7, offsetUnits: 'token', scale: 0.7 }),
    motion('dodge', 'source', { after: 'di-c', anchor: 'start', offset: 200, duration: 700, intensity: 0.3, distance: 0.5, ...RUSH }),
  ], { sound: null }),
  // Dance Partner!: Stride or Step, and an ally follows.
  'sf2e:sf2e-feat-actions-rlhZC1VPq3XixagS': design('Music notes lead the envoy across the floor and the partner answers with notes of its own.', () => [
    cast('Lead the dance', ['music_notations.beamed_quavers.orange', 'music_notations.beamed_quavers.blue'], { stageId: 'dp-c', duration: 1100, scale: 0.6 }),
    motion('rush', 'source', { after: 'dp-c', anchor: 'start', offset: 300, duration: 1600, intensity: 0.3, distance: 1, ...RUSH }),
    impact('Partner follows', ['music_notations.quaver.orange', 'music_notations.quaver.blue'], { optionalTargets: true, after: 'dp-c', anchor: 'start', offset: 700, duration: 1300, scale: 0.5 }),
  ], { sound: null }),
  // Death Blossom: spin in place and fire indiscriminately.
  'sf2e:sf2e-feat-feats-gibsdQ8jgyL8FZQc': design('The soldier spins in place with a muzzle burst, hosing rounds into every creature around it.', () => [
    motion('spin', 'source', { stageId: 'db-s', duration: 1400, intensity: 0.6 }),
    cast('Muzzle burst', ['muzzle_flash.burst.01.yellow', 'muzzle_flash.single.01.yellow'], { stageId: 'db-m', after: 'db-s', anchor: 'start', duration: 1200 }),
    travel('Indiscriminate fire', ['bullet.03.orange', 'bullet.01.orange'], { stageId: 'db-t', optionalTargets: true, after: 'db-s', anchor: 'start', offset: 150, duration: 900, repeats: 2, repeatInterval: 200, targetStagger: 100 }),
    motion('shake', 'targets', { after: 'db-t', anchor: 'end', offset: -150, duration: 700, intensity: 0.5 }),
  ]),
  // Delegate: direct an ally to complete a task.
  'sf2e:sf2e-feat-feats-9oOcVKp84ibKm01u': design('A spoken directive ripples out and an action cue lights over the chosen ally.', () => [
    cast('Directive given', ['soundwave.02.orangeyellow', 'soundwave.02.blue'], { stageId: 'dg-c', duration: 1100, scale: 0.8 }),
    impact('Task assigned', ['ui.chevrons3.yellow'], { optionalTargets: true, after: 'dg-c', anchor: 'start', offset: 500, duration: 1400, scale: 0.5, offsetY: -0.5, offsetUnits: 'token' }),
  ], { sound: null }),
  // Demolitions Experience: a good wrench-thrashing for haywire tech.
  'sf2e:sf2e-feat-feats-yElfOaGz9PYaMntF': design('The gnome lunges and whacks the device with a bludgeoning blow that throws sparks.', () => [
    motion('lunge', 'source', { stageId: 'de-l', duration: 750, intensity: 0.7 }),
    impact('Wrench-thrashing', ['melee_generic.bludgeoning.one_handed', 'hammer.melee.01.white'], { stageId: 'de-i', after: 'de-l', anchor: 'start', offset: 200, duration: 1300 }),
    impact('Sparks fly', ['static_electricity.01.orange', 'static_electricity.01.blue'], { after: 'de-i', anchor: 'start', offset: 500, duration: 1200, scale: 0.7 }),
    motion('stagger', 'targets', { after: 'de-i', anchor: 'start', offset: 500, duration: 700, intensity: 0.6 }),
  ], { sound: 'hammer', soundNamespace: 'ability' }),
  // Digestive Spray: spray corrosive enzymes in a 30-foot cone.
  'sf2e:sf2e-feat-feats-ewtBlMMwV7F7YPPB': design('A cone of corrosive digestive spray gushes out and splashes over creatures, which recoil.', ({ recipe }) => [
    cast('Enzymes surge', ['cast_generic.02.green', 'cast_generic.02.blue'], { stageId: 'dsp-c', duration: 600, scale: 0.7 }),
    zone(recipe, 'Enzyme spray', ['breath_weapons.poison.cone.green'], { stageId: 'dsp-a', after: 'dsp-c', anchor: 'start', offset: 300, duration: 1900, ...tint('#9be04a') }),
    impact('Acid splash', ['liquid.splash.green', 'liquid.splash.blue'], { optionalTargets: true, after: 'dsp-a', anchor: 'start', offset: 600, duration: 1400, scale: 0.7 }),
    motion('recoil', 'targets', { after: 'dsp-a', anchor: 'start', offset: 600, duration: 650, intensity: 0.5 }),
  ]),
  // Digital Assessment!: recall knowledge from the infosphere about a target.
  'sf2e:sf2e-feat-actions-4oIErnhDm0qCCpxs': design('Records spin up around the envoy and a sci-fi scan reticle locks onto the chosen creature.', () => [
    cast('Records pulled', ['markers_scifi.001.complete.003.blueteal', 'markers_scifi.001.complete.001.blueteal'], { stageId: 'da-c', duration: 1200 }),
    impact('Target analysed', ['markers_scifi.002.complete.001.blueteal'], { optionalTargets: true, targetSelection: 'first', after: 'da-c', anchor: 'start', offset: 500, duration: 1800, scale: 0.9 }),
  ], { sound: null }),
  // Double Tap: two quick shots at the mark.
  'sf2e:sf2e-feat-feats-l5v7SnMbgsVGCsMA': design('Two quick shots crack out at the mark, each with a muzzle flash and a hit spark.', () => [
    cast('Muzzle flash', ['muzzle_flash.single.01.yellow'], { stageId: 'dt-m1', duration: 500, faceTarget: true }),
    travel('First shot', ['bullet.01.orange'], { stageId: 'dt-t1', after: 'dt-m1', anchor: 'start', offset: 80, duration: 800 }),
    cast('Second flash', ['muzzle_flash.single.01.yellow'], { stageId: 'dt-m2', after: 'dt-m1', anchor: 'start', offset: 380, duration: 500, faceTarget: true }),
    travel('Second shot', ['bullet.01.orange'], { stageId: 'dt-t2', after: 'dt-m2', anchor: 'start', offset: 80, duration: 800 }),
    impact('Hit spark', ['impact.005.orange'], { after: 'dt-t1', anchor: 'end', offset: -150, duration: 800, scale: 0.6 }),
    impact('Second hit', ['impact.005.orange'], { after: 'dt-t2', anchor: 'end', offset: -150, duration: 800, scale: 0.6 }),
    motion('recoil', 'source', { after: 'dt-m1', anchor: 'start', duration: 800, intensity: 0.3 }),
  ], { sound: 'firearm', soundNamespace: 'ability' }),
  // Draconic Breath: exhale a true dragon's energy as a cone or line.
  'sf2e:sf2e-feat-feats-RSZ9IVp3S0xbAV0y': design('A gout of draconic breath sweeps the area; creatures caught in it recoil.', ({ recipe }) => [
    motion('lunge', 'source', { stageId: 'drb-l', duration: 600, intensity: 0.4 }),
    zone(recipe, 'Dragon breath', ['breath_weapons.fire.cone.orange.01'], { stageId: 'drb-a', after: 'drb-l', anchor: 'start', offset: 200, duration: 2200 }),
    motion('recoil', 'targets', { after: 'drb-a', anchor: 'start', offset: 600, duration: 650, intensity: 0.6 }),
  ]),
  // Dragon Breath (Dragon Form): exhale deadly magical energy in an area.
  'sf2e:sf2e-feat-actions-yMt7EeLqxzM3WLgn': design('The dragon form exhales a broad gout of breath across the area; creatures recoil.', ({ recipe }) => [
    motion('lunge', 'source', { stageId: 'dfb-l', duration: 600, intensity: 0.4 }),
    zone(recipe, 'Dragon breath', ['breath_weapons.fire.cone.orange.01'], { stageId: 'dfb-a', after: 'dfb-l', anchor: 'start', offset: 200, duration: 2200 }),
    motion('recoil', 'targets', { after: 'dfb-a', anchor: 'start', offset: 600, duration: 650, intensity: 0.6 }),
  ]),
  // Dragonkin Breath: exhale an energy-infused 15-foot cone.
  'sf2e:sf2e-feat-feats-PzfAk0BBtRviHW7E': design('The dragonkin exhales an energy-infused cone of breath; creatures in it recoil.', ({ recipe }) => [
    motion('lunge', 'source', { stageId: 'dkb-l', duration: 600, intensity: 0.4 }),
    zone(recipe, 'Energy breath', ['breath_weapons.fire.cone.orange.01'], { stageId: 'dkb-a', after: 'dkb-l', anchor: 'start', offset: 200, duration: 2000 }),
    motion('recoil', 'targets', { after: 'dkb-a', anchor: 'start', offset: 600, duration: 650, intensity: 0.5 }),
  ]),
  // Drain Blood: jab a proboscis into a creature and consume its blood.
  'sf2e:sf2e-feat-feats-BdAAZgzwcNwjNmML': design('The orocoran jabs its proboscis into the creature, blood spurts, and red vitality settles over the drinker.', () => [
    motion('lunge', 'source', { stageId: 'dbl-l', duration: 700, intensity: 0.6 }),
    impact('Proboscis jab', ['impact.005.red', 'impact.005.orange'], { stageId: 'dbl-j', after: 'dbl-l', anchor: 'start', offset: 300, duration: 800, scale: 0.6 }),
    impact('Blood drawn', ['liquid.splash02.red'], { after: 'dbl-j', anchor: 'start', offset: 200, duration: 1300, scale: 0.6 }),
    aura('Sated', ['healing_generic.200px.red', 'healing_generic.200px.purple'], { after: 'dbl-j', anchor: 'start', offset: 900, duration: 1500, fadeOut: 400 }),
    motion('recoil', 'targets', { after: 'dbl-j', anchor: 'start', duration: 650, intensity: 0.4 }),
  ]),
  // Drift Strike: launch the creature you crit into the Drift.
  'sf2e:sf2e-feat-feats-GUDyvtiwWuVYuTZN': design('A Drift rift opens under the struck creature and it flickers away through hyperspace.', () => [
    impact('Drift rift opens', ['portals.horizontal.ring_masked.purple', 'portals.horizontal.ring.bright_yellow'], { stageId: 'dr-p', duration: 1600, scale: 0.8, below: true }),
    impact('Hurled into the Drift', ['misty_step.01.purple', 'misty_step.01.blue'], { stageId: 'dr-m', after: 'dr-p', anchor: 'start', offset: 400, duration: 1100 }),
    motion('flicker', 'targets', { after: 'dr-m', anchor: 'start', duration: 1000, intensity: 0.8 }),
  ]),
  // Entangling Mycelium: fungus spreads in your square as difficult terrain.
  'sf2e:sf2e-feat-feats-23GpILO1Ds6US3Fu': design('Fungal mycelium spreads over the ground beneath the entu colony and knits into a tangle.', () => [
    cast('Mycelium spreads', ['plant_growth.03.round.2x2.complete.greenyellow'], { stageId: 'em-g', duration: 2400, scale: 0.8, below: true, ...tint('#c8b98a') }),
    aura('Fungal tangle', ['entangle.02.complete.02.green'], { after: 'em-g', anchor: 'start', offset: 500, duration: 2200, scale: 0.8, below: true, opacity: 0.85 }),
  ]),
  // Enter Rivener State: embrace anger and grow Large.
  'sf2e:sf2e-feat-feats-kxXC7sNk5GCDqKeZ': design('Red rage boils over the ikeshti as its body swells into the rivener form.', () => [
    cast('Anger boils', ['cast_generic.dark.01.red', 'cast_generic.fire.01.orange'], { stageId: 'rv-c', duration: 800 }),
    aura('Rivener fury', ['particles.outward.red.02.03', 'particles.outward.greenyellow.02.03'], { after: 'rv-c', anchor: 'start', offset: 300, duration: 2000, scale: 1.4, ...tint('#d8342b') }),
    sprite('Body swells', { after: 'rv-c', anchor: 'start', offset: 500, duration: 1400, opacity: 0.4, scaleOut: 1.4, scaleOutDuration: 1200, fadeOut: 500 }),
    motion('pulse', 'source', { after: 'rv-c', anchor: 'start', offset: 400, duration: 1200, intensity: 1 }),
  ]),
  // Entu Spore Cloud: spew a dense cloud of fungal spores.
  'sf2e:sf2e-feat-feats-9dfYsCBOWB5fKRQp': design('A dense cloud of fungal spores billows out around the entu colony and drifts over nearby creatures.', ({ recipe }) => [
    zone(recipe, 'Spore cloud', ['fumes.04.complete.green', 'fumes.04.complete.grey'], { stageId: 'ec-f', duration: 2600, opacity: 0.85, ...tint('#b5c96a') }),
    zone(recipe, 'Drifting spores', ['particles.swirl.greenyellow.01.01'], { after: 'ec-f', anchor: 'start', offset: 300, duration: 2200, opacity: 0.8 }),
  ]),
};
