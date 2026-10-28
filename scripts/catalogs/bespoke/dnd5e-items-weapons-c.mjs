// Bespoke compositions (dnd5e-items-weapons-c). Keys: '<system>:<entryId>' or '<system>:<entryId>:<variant|mode>'.
// See scripts/catalogs/bespoke/helpers.mjs and scripts/bespoke.mjs.
import { cast, travel, projectile, impact, area, aura, sprite, motion, tint, spin, breathe, design } from './helpers.mjs';

// D&D 5e activated items, H–W. Most item activities have no measured template and
// optional targets, so every target-facing stage is optional and area() is only used
// where the activity itself places a template (lanterns, horn cone, torches, oil…).
const OPT = { optionalTargets: true };
const FIRST = { optionalTargets: true, targetSelection: 'first' };
const ABILITY = { soundNamespace: 'ability' };
// Warm lamplight glow (Patreon yellow marker; Free blue marker tinted warm).
const WARM = tint('#ffd27a');

// ---- Spells cast from items -------------------------------------------------
const fireball = design('A bright streak flies to the chosen point and blossoms into a roaring fireball.', () => [
  cast('Ember gathers', ['cast_generic.fire.01.orange'], { stageId: 'fb-c', scale: 0.7, duration: 900 }),
  travel('Fiery streak', ['fireball.beam.orange'], { stageId: 'fb-t', after: 'fb-c', anchor: 'start', offset: 450, duration: 1300, ...FIRST }),
  impact('Fireball detonates', ['fireball.explosion.orange'], { stageId: 'fb-x', after: 'fb-t', anchor: 'arrival', duration: 2200, scale: 1.6, ...FIRST }),
  motion('stagger', 'targets', { after: 'fb-x', anchor: 'start', offset: 150, duration: 800, ...OPT }),
], { sound: 'fireball' });
const fireballBead = design('A bead is torn from the necklace and thrown; at the end of its flight it detonates as a fireball.', () => [
  motion('throw', 'source', { stageId: 'nb-m', duration: 900 }),
  travel('Bead streaks away', ['fireball.beam.orange'], { stageId: 'nb-t', after: 'nb-m', anchor: 'start', offset: 350, duration: 1200, ...FIRST }),
  impact('Bead detonates', ['fireball.explosion.orange'], { stageId: 'nb-x', after: 'nb-t', anchor: 'arrival', duration: 2200, scale: 1.6, ...FIRST }),
  motion('stagger', 'targets', { after: 'nb-x', anchor: 'start', offset: 150, duration: 800, ...OPT }),
], { sound: 'fireball' });
const wallOfFire = design('A roaring curtain of flame springs up where the wielder points.', () => [
  cast('Fire gathers', ['cast_generic.fire.01.orange'], { stageId: 'wf-c', scale: 0.7, duration: 1000 }),
  impact('Wall of flame rises', ['wall_of_fire.300x100.yellow'], { stageId: 'wf-w', after: 'wf-c', anchor: 'start', offset: 600, duration: 3400, scale: 1, fadeOut: 600, ...FIRST }),
  motion('recoil', 'targets', { after: 'wf-w', anchor: 'start', offset: 300, duration: 700, ...OPT }),
], { sound: 'fireWall' });
const burningHands = design('A thin sheet of flame fans out from the outstretched hands.', () => [
  cast('Hands kindle', ['cast_generic.fire.01.orange'], { stageId: 'bh-c', scale: 0.6, duration: 700 }),
  travel('Fan of flame', ['burning_hands.01.orange'], { stageId: 'bh-t', after: 'bh-c', anchor: 'start', offset: 300, duration: 1600, ...FIRST }),
  motion('recoil', 'targets', { after: 'bh-t', anchor: 'start', offset: 500, duration: 700, ...OPT }),
], { sound: 'fireCone' });
const prismaticSpray = design('Seven multicolored rays flash from the diamond and lance through the creatures in front of the wearer.', () => [
  cast('Diamond flares', ['cast_generic.03.pinkyellow', 'cast_generic.03.blue'], { stageId: 'ps-c', scale: 0.8, duration: 900 }),
  travel('Prismatic rays', ['scorching_ray.01.rainbow01', 'energy_beam.normal.bluepink'], { stageId: 'ps-t', after: 'ps-c', anchor: 'start', offset: 400, duration: 1500, ...OPT }),
  impact('Rays burst', ['explosion.03.purplepink', 'explosion.03.blueyellow'], { stageId: 'ps-x', after: 'ps-t', anchor: 'arrival', duration: 1300, scale: 0.8, ...OPT }),
  motion('stagger', 'targets', { after: 'ps-x', anchor: 'start', duration: 700, ...OPT }),
], { sound: 'radiantRay' });
const daylight = design('An opal flares and floods the area around the wearer with bright sunlight.', () => [
  cast('Opal flares', ['cast_generic.01.yellow'], { stageId: 'dl-c', scale: 0.7, duration: 900 }),
  aura('Sphere of daylight', ['markers.light.complete.yellow02', 'markers.light.complete.blue'], { after: 'dl-c', anchor: 'start', offset: 400, duration: 3200, scale: 2.6, opacity: 0.75, fadeIn: 400, fadeOut: 800, ...tint('#fff2b8') }),
], { sound: 'light' });
const lightningBolt = design('A stroke of lightning leaps from the wand in a straight line to the target.', () => [
  cast('Charge crackles', ['static_electricity.02.blue'], { stageId: 'lb-c', scale: 0.6, duration: 800 }),
  travel('Lightning bolt', ['lightning_bolt.wide.blue'], { stageId: 'lb-t', after: 'lb-c', anchor: 'start', offset: 400, duration: 1300, ...FIRST }),
  impact('Electric jolt', ['static_electricity.03.blue'], { after: 'lb-t', anchor: 'arrival', duration: 1300, scale: 0.8, ...OPT }),
  motion('shake', 'targets', { after: 'lb-t', anchor: 'arrival', duration: 700, ...OPT }),
], { sound: 'lightningBolt' });
const chainLightning = design('A bolt strikes the first creature, then arcs on to the others.', () => [
  cast('Charge crackles', ['static_electricity.02.blue'], { stageId: 'cl-c', scale: 0.6, duration: 800 }),
  travel('Primary bolt', ['chain_lightning.primary.blue'], { stageId: 'cl-p', after: 'cl-c', anchor: 'start', offset: 400, duration: 1200, ...FIRST }),
  travel('Arcs leap on', ['chain_lightning.secondary.blue'], { after: 'cl-p', anchor: 'arrival', duration: 1100, travelOrigin: 'firstTarget', targetSelection: 'secondary', optionalTargets: true }),
  motion('shake', 'targets', { after: 'cl-p', anchor: 'arrival', duration: 700, ...OPT }),
], { sound: 'chainLightning' });
const magicMissile = design('Three glowing darts of force streak out and strike unerringly.', () => [
  cast('Force gathers', ['cast_generic.01.dark_purple', 'cast_generic.02.blue'], { stageId: 'mm-c', scale: 0.6, duration: 800 }),
  travel('Three darts of force', ['magic_missile.purple'], { stageId: 'mm-t', after: 'mm-c', anchor: 'start', offset: 350, duration: 1300, repeats: 3, repeatScope: 'total', repeatInterval: 220, ...OPT }),
  motion('recoil', 'targets', { after: 'mm-t', anchor: 'arrival', duration: 600, ...OPT }),
], { sound: 'forceMissile' });
const gustOfWind = design('A strong line of wind blasts from the item and shoves at whatever stands in it.', () => [
  cast('Air stirs', ['wind_lines.01.01.white'], { stageId: 'gw-c', scale: 0.6, duration: 800 }),
  travel('Gust of wind', ['gust_of_wind.veryfast'], { stageId: 'gw-t', after: 'gw-c', anchor: 'start', offset: 300, duration: 1600, opacity: 0.85, ...FIRST }),
  motion('stagger', 'targets', { after: 'gw-t', anchor: 'start', offset: 500, duration: 800, ...OPT }),
], { sound: 'wind' });
const gustLine = design('The fan whips up a 60-foot line of wind that shoves at creatures in it.', () => [
  cast('Fan sweeps', ['wind_lines.01.02.white'], { stageId: 'gl-c', scale: 0.6, duration: 700 }),
  area('Line of wind', ['gust_of_wind.veryfast'], { stageId: 'gl-a', after: 'gl-c', anchor: 'start', offset: 250, duration: 1800, opacity: 0.85 }),
  motion('stagger', 'targets', { after: 'gl-a', anchor: 'start', offset: 500, duration: 800, ...OPT }),
], { sound: 'wind' });
const windWall = design('A wall of strong wind roars up from the ground where the ring directs.', () => [
  cast('Air stirs', ['wind_lines.01.01.white'], { stageId: 'ww-c', scale: 0.6, duration: 800 }),
  impact('Wall of wind', ['wind_wall.300x100'], { after: 'ww-c', anchor: 'start', offset: 400, duration: 3000, fadeOut: 600, ...FIRST }),
], { sound: 'wind' });
const dominate = design('An elemental is gripped by the ring\'s will: a compulsion threads out and binds its mind.', () => [
  cast('Will gathers', ['magic_signs.rune.enchantment.complete.pink'], { stageId: 'dm-c', scale: 0.5, duration: 1200 }),
  travel('Compulsion threads out', ['energy_strands.range.standard.dark_purple.01', 'energy_strands.range.multiple.purple.01'], { stageId: 'dm-t', after: 'dm-c', anchor: 'start', offset: 500, duration: 1500, ...OPT }),
  aura('Mind seized', ['magic_signs.circle.02.enchantment.complete.dark_pink'], { subject: 'targets', after: 'dm-t', anchor: 'arrival', duration: 2200, scale: 1.2, below: true, ...OPT }),
  motion('drift', 'targets', { after: 'dm-t', anchor: 'arrival', duration: 1200, intensity: 0.4, ...OPT }),
], { sound: 'psychic' });
const stoneShape = design('Stone flows like clay under the wearer\'s touch.', () => [
  cast('Stone answers', ['cast_generic.earth.01.browngreen'], { stageId: 'ss-c', scale: 0.6, duration: 900 }),
  aura('Stone reshapes', ['ground_cracks.02.orange'], { after: 'ss-c', anchor: 'start', offset: 400, duration: 2200, scale: 0.9, below: true, opacity: 0.8, ...tint('#9b8466') }),
  aura('Grit sloughs away', ['smoke.puff.centered.grey'], { after: 'ss-c', anchor: 'start', offset: 600, duration: 1400, scale: 0.6, opacity: 0.6, ...tint('#a89070') }),
], { sound: 'earth' });
const stoneskin = design('The wearer\'s flesh hardens to the grey sheen of stone.', () => [
  cast('Earth rises', ['cast_generic.earth.01.browngreen'], { stageId: 'sk-c', scale: 0.6, duration: 900 }),
  aura('Skin turns to stone', ['shield.01.complete.01.white', 'shield.01.complete.01.blue'], { after: 'sk-c', anchor: 'start', offset: 400, duration: 2400, scale: 1.1, ...tint('#8a8378') }),
  motion('brace', 'source', { after: 'sk-c', anchor: 'start', offset: 450, duration: 800 }),
], { sound: 'earth' });
const wallOfStone = design('A wall of stone grinds up out of the ground at the chosen spot.', () => [
  cast('Earth rises', ['cast_generic.earth.01.browngreen'], { stageId: 'ws-c', scale: 0.6, duration: 900 }),
  impact('Ground splits', ['ground_cracks.03.orange'], { stageId: 'ws-g', after: 'ws-c', anchor: 'start', offset: 400, duration: 2200, scale: 1.2, below: true, ...FIRST, ...tint('#8a7a66') }),
  impact('Stone heaves up', ['falling_rocks.top.2x1.grey'], { after: 'ws-g', anchor: 'start', offset: 200, duration: 2000, scale: 1, ...FIRST }),
], { sound: 'stoneWall' });
const iceStorm = design('Hail and rock-hard ice pound down in a cylinder at the chosen point.', () => [
  cast('Cold gathers', ['cast_generic.ice.01.blue', 'cast_generic.02.blue'], { stageId: 'is-c', scale: 0.6, duration: 900 }),
  impact('Hail pounds down', ['sleet_storm.01.blue'], { stageId: 'is-h', after: 'is-c', anchor: 'start', offset: 400, duration: 3000, scale: 1.6, opacity: 0.9, fadeOut: 600, ...FIRST }),
  impact('Ice shatters', ['ice_spikes.radial.burst.white'], { after: 'is-h', anchor: 'start', offset: 500, duration: 1500, scale: 0.9, ...OPT }),
  motion('stagger', 'targets', { after: 'is-h', anchor: 'start', offset: 600, duration: 800, ...OPT }),
], { sound: 'cold' });
const wallOfIce = design('A wall of jagged ice bursts up at the chosen spot.', () => [
  cast('Cold gathers', ['cast_generic.ice.01.blue', 'cast_generic.02.blue'], { stageId: 'wi-c', scale: 0.6, duration: 900 }),
  impact('Wall of ice', ['ice_spikes.wall.burst.white'], { after: 'wi-c', anchor: 'start', offset: 400, duration: 2400, scale: 1.2, ...FIRST }),
], { sound: 'iceWall' });
const createWater = design('Water conjured from the ring spills down at the chosen spot.', () => [
  cast('Water swirls', ['cast_generic.water.02.blue'], { stageId: 'cw-c', scale: 0.6, duration: 900 }),
  aura('Water rains down', ['template_square.raindrops.001.5x5.instant.combined.blue'], { after: 'cw-c', anchor: 'start', offset: 400, duration: 2000, scale: 1, offsetX: 1, offsetUnits: 'token' }),
], { sound: 'water' });
const controlWater = design('The ring commands the surrounding water to surge and part.', () => [
  cast('Water swirls', ['cast_generic.water.02.blue'], { stageId: 'cv-c', scale: 0.7, duration: 900 }),
  aura('Water surges', ['water_splash.circle.01.blue'], { after: 'cv-c', anchor: 'start', offset: 400, duration: 2400, scale: 2, below: true }),
  aura('Waves rise', ['liquid.splash_side.blue'], { after: 'cv-c', anchor: 'start', offset: 700, duration: 1500, scale: 1.2, offsetX: 0.8, offsetUnits: 'token' }),
], { sound: 'water' });
const tsunami = design('A towering wall of water crashes over the area the ring directs.', () => [
  cast('Water swirls', ['cast_generic.water.02.blue'], { stageId: 'ts-c', scale: 0.8, duration: 1000 }),
  impact('Wall of water crashes', ['liquid.splash_side.blue'], { stageId: 'ts-w', after: 'ts-c', anchor: 'start', offset: 500, duration: 1800, scale: 2.2, ...OPT }),
  impact('Surf churns', ['water_splash.circle.01.blue'], { after: 'ts-w', anchor: 'start', offset: 300, duration: 2000, scale: 1.4, below: true, ...OPT }),
  motion('stagger', 'targets', { after: 'ts-w', anchor: 'start', offset: 300, duration: 900, ...OPT }),
], { sound: 'water' });
const waterWalk = design('Ripples spread under the feet as the creature becomes able to stride across liquid.', () => [
  aura('Ripples underfoot', ['water_splash.circle.01.blue'], { duration: 2200, scale: 1.2, below: true, opacity: 0.85 }),
  aura('Buoyant shimmer', ['shimmer.01.blue'], { duration: 1800, scale: 1, delay: 300, opacity: 0.7 }),
], { sound: 'water' });
const faerieFire = design('Creatures in the area are outlined in flickering violet faerie light.', () => [
  cast('Faerie light kindles', ['dancing_light.purplegreen'], { stageId: 'ff-c', scale: 0.6, duration: 900 }),
  aura('Outlined in faerie fire', ['markers.light.complete.purple', 'markers.light.complete.blue'], { subject: 'targets', after: 'ff-c', anchor: 'start', offset: 400, duration: 2600, scale: 1.2, ...OPT }),
  aura('Motes cling', ['fireflies.few.02'], { subject: 'targets', after: 'ff-c', anchor: 'start', offset: 600, duration: 2400, scale: 0.8, ...OPT, ...tint('#c08cff') }),
], { sound: 'light' });
const dancingLights = design('Several torch-sized lights wink into being and bob in the air around the wearer.', () => [
  aura('Light one', ['dancing_light.blueteal'], { stageId: 'dl1', duration: 2800, scale: 0.4, offsetX: -0.8, offsetY: -0.6, offsetUnits: 'token', fadeIn: 300, fadeOut: 600 }),
  aura('Light two', ['dancing_light.yellow'], { after: 'dl1', anchor: 'start', offset: 200, duration: 2600, scale: 0.4, offsetX: 0.8, offsetY: -0.6, offsetUnits: 'token', fadeIn: 300, fadeOut: 600 }),
  aura('Light three', ['dancing_light.pink'], { after: 'dl1', anchor: 'start', offset: 400, duration: 2400, scale: 0.4, offsetX: 0, offsetY: -1, offsetUnits: 'token', fadeIn: 300, fadeOut: 600 }),
], { sound: 'light' });
const lightCantrip = design('The ring makes an object shed bright light.', () => [
  aura('Bright light', ['markers.light.complete.yellow02', 'markers.light.complete.blue'], { duration: 2600, scale: 1.4, opacity: 0.8, fadeOut: 600, ...tint('#fff2b8') }),
], { sound: 'light' });
const telekinesis = design('An unseen force seizes the target and hoists it into the air.', () => [
  cast('Will reaches out', ['cast_generic.01.dark_purple', 'cast_generic.02.blue'], { stageId: 'tk-c', scale: 0.6, duration: 800 }),
  travel('Telekinetic grip', ['energy_strands.range.standard.dark_purple.01', 'energy_strands.range.multiple.purple.01'], { stageId: 'tk-t', after: 'tk-c', anchor: 'start', offset: 300, duration: 2000, ...OPT }),
  aura('Held aloft', ['energy_strands.overlay.dark_purple', 'energy_strands.overlay.blue'], { subject: 'targets', after: 'tk-t', anchor: 'arrival', duration: 2000, ...OPT }),
  motion('levitate', 'targets', { after: 'tk-t', anchor: 'arrival', duration: 1800, ...OPT }),
], { sound: 'force' });
const wish = design('Reality bends to a spoken wish: a golden sigil blazes and starlight swirls around the speaker.', () => [
  cast('Wish spoken', ['magic_signs.circle.02.conjuration.complete.yellow'], { stageId: 'wi-c', scale: 1.2, below: true, duration: 2600 }),
  aura('Reality bends', ['twinkling_stars.points07.white'], { after: 'wi-c', anchor: 'start', offset: 500, duration: 2400, scale: 1.4 }),
  aura('Golden radiance', ['markers.light.complete.yellow02', 'markers.light.complete.blue'], { after: 'wi-c', anchor: 'start', offset: 700, duration: 2200, scale: 1.8, opacity: 0.6, ...tint('#ffe08a') }),
], { sound: 'holy' });
const comprehendLanguages = design('Runes swirl around the wearer\'s head as unknown words become plain.', () => [
  cast('Divination rune', ['magic_signs.rune.divination.complete.blue'], { stageId: 'cl-r', scale: 0.4, offsetY: -0.4, offsetUnits: 'token', duration: 1400 }),
  aura('Words translate', ['markers.runes.blue', 'markers.runes.orange'], { after: 'cl-r', anchor: 'start', offset: 400, duration: 2400, scale: 0.9 }),
], { sound: 'detect' });
const detectThoughts = design('The wielder\'s mind reaches out and brushes the surface thoughts of nearby creatures.', () => [
  cast('Mind opens', ['magic_signs.rune.divination.complete.purple', 'magic_signs.rune.divination.complete.blue'], { stageId: 'dt-c', scale: 0.45, offsetY: -0.4, offsetUnits: 'token', duration: 1300 }),
  aura('Inner eye', ['eyes.01.purple', 'eyes.01.dark_green'], { after: 'dt-c', anchor: 'start', offset: 400, duration: 2200, scale: 0.8 }),
  impact('Thoughts read', ['eyes.01.single', 'eyes.01.dark_green'], { after: 'dt-c', anchor: 'start', offset: 900, duration: 1600, scale: 0.5, offsetY: -0.4, offsetUnits: 'token', ...OPT }),
], { sound: 'psychic' });
const suggestion = design('A softly spoken suggestion settles over the target\'s mind.', () => [
  cast('Words woven', ['magic_signs.rune.enchantment.complete.pink'], { stageId: 'sg-c', scale: 0.45, duration: 1200 }),
  aura('Suggestion takes hold', ['magic_signs.circle.02.enchantment.complete.dark_pink'], { subject: 'targets', after: 'sg-c', anchor: 'start', offset: 500, duration: 2200, scale: 1.1, below: true, ...OPT }),
  motion('drift', 'targets', { after: 'sg-c', anchor: 'start', offset: 700, duration: 1200, intensity: 0.3, ...OPT }),
], { sound: 'psychic' });
const telepathicMessage = design('A silent thread of thought links the wearer to the focused creature.', () => [
  travel('Thought link', ['energy_strands.range.standard.dark_purple.01', 'energy_strands.range.multiple.purple.01'], { duration: 1600, opacity: 0.8, ...OPT }),
  motion('pulse', 'source', { duration: 900, intensity: 0.3 }),
], { sound: null });
const command = design('A single word of command rings out and presses on the target\'s will.', () => [
  cast('Word of command', ['soundwave.01.purple', 'soundwave.01.blue'], { stageId: 'cm-c', scale: 0.6, duration: 900 }),
  impact('Will compelled', ['magic_signs.rune.enchantment.complete.pink'], { after: 'cm-c', anchor: 'start', offset: 400, duration: 1500, scale: 0.5, ...OPT }),
], { sound: 'psychic' });
const holdCreature = design('Spectral bindings lock the target rigid where it stands.', () => [
  cast('Binding gathers', ['magic_signs.rune.enchantment.complete.purple', 'magic_signs.rune.enchantment.complete.pink'], { stageId: 'hc-c', scale: 0.45, duration: 1100 }),
  aura('Held fast', ['markers.chain.spectral_standard.complete.02.purple', 'markers.chain.spectral_standard.complete.02.blue'], { subject: 'targets', after: 'hc-c', anchor: 'start', offset: 500, duration: 2600, ...OPT }),
  motion('press', 'targets', { after: 'hc-c', anchor: 'start', offset: 600, duration: 900, intensity: 0.5, ...OPT }),
], { sound: 'chainBinding' });
const fearSpell = design('Terror washes over the beasts before the wielder; they shrink back in fright.', () => [
  cast('Dread rises', ['smoke.plumes.01.purple', 'smoke.plumes.01.grey'], { stageId: 'fe-c', scale: 0.6, duration: 1000 }),
  impact('Fright seizes', ['markers.fear.dark_purple.02'], { after: 'fe-c', anchor: 'start', offset: 500, duration: 1800, scale: 0.8, ...OPT }),
  motion('cower', 'targets', { after: 'fe-c', anchor: 'start', offset: 600, duration: 900, ...OPT }),
], { sound: 'fear' });
const animalFriendship = design('A gentle nature charm settles over a beast, which grows friendly.', () => [
  cast('Nature soothes', ['swirling_leaves.complete.01.green'], { stageId: 'af-c', scale: 0.6, duration: 1200 }),
  impact('Beast befriended', ['markers.heart.teal.01', 'markers.heart.pink.01'], { after: 'af-c', anchor: 'start', offset: 500, duration: 1800, scale: 0.6, ...OPT }),
], { sound: 'natureHeal' });
const speakAnimals = design('The wearer can now understand and speak with beasts.', () => [
  aura('Nature\'s voices', ['wind_lines.01.leaves.01.green'], { stageId: 'sa-l', duration: 2000, scale: 0.8 }),
  aura('Small creatures gather', ['butterflies.few.orange'], { after: 'sa-l', anchor: 'start', offset: 300, duration: 2200, scale: 0.7 }),
], { sound: null });
const animalMessenger = design('The raven takes the message on silver wings and flies off to deliver it.', () => [
  aura('Silver wings beat', ['swirling_feathers.outburst.01.blue', 'swirling_feathers.outburst.01.textured'], { duration: 1600, scale: 0.8, ...tint('#d7dde6') }),
], { sound: 'wind' });
const web = design('Thick sticky webbing shoots from the wand and fills the chosen space.', () => [
  cast('Wand flicks', ['cast_generic.03.white', 'cast_generic.02.blue'], { stageId: 'wb-c', scale: 0.5, duration: 700 }),
  impact('Webs fill the area', ['web.complete.002.white'], { stageId: 'wb-w', after: 'wb-c', anchor: 'start', offset: 400, duration: 3000, scale: 1.6, ...FIRST }),
  motion('press', 'targets', { after: 'wb-w', anchor: 'start', offset: 400, duration: 900, intensity: 0.4, ...OPT }),
], { sound: 'vines' });
const darkness = design('Magical darkness spreads out and swallows the light.', () => [
  aura('Darkness spreads', ['darkness.black'], { duration: 3500, scale: 2.4, fadeIn: 500, fadeOut: 800 }),
], { sound: 'shadow' });
const slow = design('Time drags around the targets; their movements grow sluggish.', () => [
  cast('Time warps', ['cast_shape.circle.01.purple', 'cast_shape.circle.01.blue'], { stageId: 'sl-c', scale: 0.6, duration: 900 }),
  aura('Time drags', ['icosahedron.rune.below'], { subject: 'targets', after: 'sl-c', anchor: 'start', offset: 400, duration: 2400, scale: 0.9, below: true, ...OPT }),
  motion('drift', 'targets', { after: 'sl-c', anchor: 'start', offset: 600, duration: 1600, intensity: 0.3, ...OPT }),
], { sound: 'slow' });
const stinkingCloud = design('A sphere of nauseating yellow-green gas billows at the chosen point; creatures inside retch.', () => [
  cast('Fumes gather', ['fumes.toxic.green', 'fumes.04.complete.grey'], { stageId: 'sc-c', scale: 0.5, duration: 900 }),
  impact('Stinking cloud billows', ['fog_cloud.02.green', 'fog_cloud.01.white'], { stageId: 'sc-f', after: 'sc-c', anchor: 'start', offset: 400, duration: 3400, scale: 1.8, opacity: 0.85, fadeOut: 700, ...FIRST, ...tint('#b8c24a') }),
  motion('shake', 'targets', { after: 'sc-f', anchor: 'start', offset: 700, duration: 800, intensity: 0.5, ...OPT }),
], { sound: 'poison' });
const enlarge = design('The creature swells to giant size in a surge of crimson magic.', () => [
  aura('Crimson surge', ['template_circle.aura.03.outward'], { duration: 1800, scale: 1.3, ...tint('#d0413a') }),
  motion('pulse', 'source', { duration: 1200, intensity: 0.9 }),
], { sound: 'transform' });
const reduce = design('The creature contracts to a fraction of its size as crimson magic draws inward.', () => [
  aura('Crimson contraction', ['template_circle.aura.03.inward'], { duration: 1800, scale: 1.3, ...tint('#d0413a') }),
  motion('press', 'source', { duration: 1000, intensity: 0.7 }),
], { sound: 'transform' });
const invisibility = design('The creature shimmers and fades from sight.', () => [
  aura('Form shimmers', ['shimmer.01.blue'], { duration: 1800, scale: 1.1, opacity: 0.8 }),
  motion('flicker', 'source', { duration: 1200 }),
], { sound: null });
const polymorph = design('Transmutation magic engulfs the target in a twisting cloud as its shape changes.', () => [
  cast('Transmutation rune', ['magic_signs.rune.transmutation.complete.purple', 'magic_signs.rune.transmutation.complete.yellow'], { stageId: 'pm-c', scale: 0.5, duration: 1100 }),
  impact('Form twists', ['smoke.puff.centered.green', 'smoke.puff.centered.grey'], { stageId: 'pm-i', after: 'pm-c', anchor: 'start', offset: 500, duration: 1600, scale: 1.1, ...OPT }),
  motion('flicker', 'targets', { after: 'pm-i', anchor: 'start', offset: 300, duration: 900, ...OPT }),
], { sound: 'transform' });
const etherealness = design('The wearer\'s form fades to a ghostly outline as it slips into the Ethereal Plane.', () => [
  aura('Ethereal mist', ['misty_step.01.grey', 'misty_step.01.blue'], { duration: 1600, scale: 1 }),
  motion('flicker', 'source', { duration: 1300, delay: 300 }),
], { sound: 'pocketTransition' });
const teleportShift = design('The creature vanishes in a flare of conjuration, carried elsewhere.', () => [
  aura('Conjuration flare', ['teleport.01.yellow', 'teleport.01.blue'], { duration: 1800, scale: 1.2 }),
  motion('flicker', 'source', { duration: 1200, delay: 400 }),
], { sound: 'teleport' });
const astralShift = design('Starlight swirls as the wearer steps between the Material and the Astral Plane.', () => [
  area('Astral rift', ['template_circle.vortex.intro.purple', 'template_circle.vortex.intro.blue'], { stageId: 'as-v', duration: 2400, opacity: 0.85 }),
  aura('Starlight', ['twinkling_stars.points07.white'], { after: 'as-v', anchor: 'start', offset: 300, duration: 2000, scale: 1.2 }),
  motion('flicker', 'source', { after: 'as-v', anchor: 'start', offset: 600, duration: 1200 }),
], { sound: 'teleport' });

// ---- Divine beads and rods --------------------------------------------------
const bless = design('A bead glows and golden blessing settles over the chosen allies.', () => [
  cast('Bead glows', ['markers.light_orb.complete.yellow', 'markers.light_orb.complete.blue'], { stageId: 'bl-c', scale: 0.4, duration: 1000 }),
  aura('Blessing', ['bless.200px.intro.yellow'], { subject: 'targets', after: 'bl-c', anchor: 'start', offset: 400, duration: 2200, scale: 1, ...OPT }),
], { sound: 'bless' });
const cureWounds = design('A healing touch closes the creature\'s wounds.', () => [
  cast('Bead glows', ['markers.light_orb.complete.green', 'markers.light_orb.complete.blue'], { stageId: 'cu-c', scale: 0.4, duration: 900 }),
  impact('Wounds close', ['cure_wounds.400px.green', 'cure_wounds.400px.blue'], { after: 'cu-c', anchor: 'start', offset: 400, duration: 2000, scale: 0.8, ...OPT }),
], { sound: 'healing' });
const restoration = design('Restorative light washes an affliction out of the creature.', () => [
  cast('Bead glows', ['markers.light_orb.complete.white', 'markers.light_orb.complete.blue'], { stageId: 'rs-c', scale: 0.4, duration: 900 }),
  impact('Affliction lifted', ['healing_generic.burst.yellowwhite', 'healing_generic.burst.greenorange'], { after: 'rs-c', anchor: 'start', offset: 400, duration: 1800, scale: 0.9, ...OPT }),
], { sound: 'healing' });
const smite = design('Divine light floods the wearer\'s next weapon strike.', () => [
  aura('Radiant weapon', ['divine_smite.caster.yellowwhite', 'divine_smite.caster.standard'], { duration: 1800, scale: 0.9 }),
], { sound: 'divineWrath' });
const guardianOfFaith = design('A spectral guardian bearing a glowing blade appears to watch over the area.', () => [
  cast('Bead glows', ['markers.light_orb.complete.yellow', 'markers.light_orb.complete.blue'], { stageId: 'gf-c', scale: 0.4, duration: 900 }),
  aura('Spectral guardian', ['spiritual_weapon.longsword.01.spectral.01.blue', 'spiritual_weapon.longsword.01.spectral.02.green'], { after: 'gf-c', anchor: 'start', offset: 400, duration: 2800, scale: 0.8, offsetX: 1, offsetUnits: 'token', fadeIn: 400, fadeOut: 600 }),
], { sound: 'spirit' });
const planarAlly = design('A celestial circle opens as an otherworldly ally answers the call.', () => [
  aura('Summoning circle', ['magic_signs.circle.02.conjuration.complete.yellow'], { stageId: 'pa-c', duration: 2800, scale: 1.2, below: true }),
  aura('Ally arrives', ['portals.vertical.ring.yellow', 'portals.vertical.ring.bright_yellow'], { after: 'pa-c', anchor: 'start', offset: 600, duration: 2200, scale: 0.9, offsetX: 1, offsetUnits: 'token' }),
], { sound: 'summon' });
const windWalk = design('The wearer\'s body dissolves into a cloud of drifting vapor.', () => [
  aura('Body turns to vapor', ['fog_cloud.01.white'], { stageId: 'wk-f', duration: 2600, scale: 1, opacity: 0.85, fadeOut: 600 }),
  aura('Wind swirls', ['wind_lines.01.01.white'], { after: 'wk-f', anchor: 'start', offset: 200, duration: 1600, scale: 0.8 }),
  motion('drift', 'source', { after: 'wk-f', anchor: 'start', offset: 400, duration: 1600 }),
], { sound: 'wind' });
const healTouch = design('A surge of healing light restores the creature.', () => [
  cast('Rod glows', ['cast_generic.02.green', 'cast_generic.02.blue'], { stageId: 'ht-c', scale: 0.6, duration: 900 }),
  impact('Healing surge', ['healing_generic.400px.yellow', 'healing_generic.400px.green'], { after: 'ht-c', anchor: 'start', offset: 400, duration: 2200, scale: 0.9, ...OPT }),
], { sound: 'healing' });
const resurrection = design('Radiant light pours down and draws a soul back into its body.', () => [
  cast('Rod blazes', ['magic_signs.circle.02.necromancy.complete.yellow', 'magic_signs.circle.02.necromancy.complete.green'], { stageId: 'rz-c', scale: 1, below: true, duration: 2600 }),
  impact('Soul returns', ['markers.light.complete.yellow02', 'markers.light.complete.blue'], { after: 'rz-c', anchor: 'start', offset: 700, duration: 2200, scale: 1.2, ...OPT, ...tint('#fff2b8') }),
  impact('Life restored', ['healing_generic.burst.yellowwhite', 'healing_generic.burst.greenorange'], { after: 'rz-c', anchor: 'start', offset: 1200, duration: 1800, ...OPT }),
], { sound: 'revive' });
const detectAura = (why, color, free = 'blue') => design(why, () => [
  cast('Divination rune', [`magic_signs.rune.divination.complete.${color === 'dark_red' ? 'red' : color}`, 'magic_signs.rune.divination.complete.blue'], { stageId: 'dx-c', scale: 0.45, duration: 1100 }),
  aura('Senses extend', [`detect_magic.circle.${color}`, `detect_magic.circle.${free}`], { after: 'dx-c', anchor: 'start', offset: 400, duration: 2800, scale: 2.2, below: true, opacity: 0.85 }),
], { sound: 'detect' });
const detectEvil = detectAura('The rod senses celestials, fiends and undead nearby.', 'yellow');
const detectMagic = detectAura('The rod senses the presence of magic nearby.', 'purple');
const detectPoison = detectAura('The rod senses poison, poisonous creatures and disease nearby.', 'green');
const seeInvisibility = design('The wielder\'s eyes are opened to the invisible and the ethereal.', () => [
  cast('Divination rune', ['magic_signs.rune.divination.complete.blue'], { stageId: 'si-c', scale: 0.45, offsetY: -0.4, offsetUnits: 'token', duration: 1100 }),
  aura('True sight', ['eyes.01.bluegreen', 'eyes.01.dark_green'], { after: 'si-c', anchor: 'start', offset: 400, duration: 2200, scale: 0.8 }),
  aura('Unseen revealed', ['shimmer.01.blue'], { after: 'si-c', anchor: 'start', offset: 600, duration: 1800, scale: 2, opacity: 0.5 }),
], { sound: 'detect' });
const rulership = design('The rod is raised and creatures who see it are compelled to obey its wielder.', () => [
  cast('Rod raised', ['magic_signs.circle.02.enchantment.complete.yellow', 'magic_signs.circle.02.enchantment.complete.pink'], { stageId: 'ru-c', scale: 1.1, below: true, duration: 2200 }),
  aura('Authority radiates', ['template_circle.aura.03.outward'], { after: 'ru-c', anchor: 'start', offset: 300, duration: 1800, scale: 1.6, ...tint('#ffd36b') }),
  impact('Compelled', ['magic_signs.rune.enchantment.complete.yellow', 'magic_signs.rune.enchantment.complete.pink'], { after: 'ru-c', anchor: 'start', offset: 700, duration: 1500, scale: 0.45, ...OPT }),
], { sound: 'psychic' });

// ---- Wondrous items ----------------------------------------------------------
const hornBlast = design('The horn bellows a thunderous blast that ripples out through the cone.', () => [
  cast('Horn sounds', ['soundwave.02.blue'], { stageId: 'hb-c', scale: 0.6, duration: 800 }),
  area('Thunderous blast', ['template_cone_5e.001.001.blue', 'template_cone_5e.001.001.purplered'], { stageId: 'hb-a', after: 'hb-c', anchor: 'start', offset: 250, duration: 1800, ...tint('#bcd8ff') }),
  motion('stagger', 'targets', { after: 'hb-a', anchor: 'start', offset: 400, duration: 800, ...OPT }),
  motion('recoil', 'source', { after: 'hb-c', anchor: 'start', duration: 600, intensity: 0.4 }),
], { sound: 'sonic' });
const hornObject = design('The thunderous blast batters unattended objects in the cone.', () => [
  impact('Thunder batters', ['thunderwave.center.blue'], { duration: 1400, scale: 0.6, ...OPT }),
], { sound: 'sonic' });
const hornExplodeRoll = design('The over-used horn shudders as it strains to hold the blast.', () => [
  motion('shake', 'source', { duration: 900, intensity: 0.5 }),
  aura('Horn strains', ['soundwave.01.blue'], { duration: 1000, scale: 0.4, opacity: 0.7 }),
], { sound: null });
const hornExplosion = design('The horn explodes in the wielder\'s hands with a burst of force.', () => [
  aura('Horn bursts', ['explosion.04.dark_purple', 'explosion.04.blue'], { stageId: 'hx-x', duration: 1500, scale: 0.9 }),
  motion('stagger', 'source', { after: 'hx-x', anchor: 'start', offset: 100, duration: 800 }),
], { sound: 'explosion' });
const hornValhalla = design('The horn sounds and spectral warriors of Ysgard ride out to answer it.', () => [
  cast('Horn sounds', ['soundwave.02.blue'], { stageId: 'hv-c', scale: 0.6, duration: 800 }),
  aura('Spirit warriors gather', ['spirit_guardians.blueyellow.spirits', 'spirit_guardians.blueyellow.ring'], { after: 'hv-c', anchor: 'start', offset: 400, duration: 3000, scale: 1.4, fadeIn: 400, fadeOut: 700 }),
  aura('Ysgard\'s call', ['magic_signs.circle.02.conjuration.complete.yellow'], { after: 'hv-c', anchor: 'start', offset: 300, duration: 2600, scale: 1.4, below: true, opacity: 0.8 }),
], { sound: 'summon' });
const horseshoesZephyr = design('The shoes bind to the hooves and a cushion of wind lifts the steed off the ground.', () => [
  aura('Wind cushions the hooves', ['whirlwind.bluegrey'], { subject: 'targets', stageId: 'hz-w', duration: 2000, scale: 0.8, below: true, opacity: 0.8, ...OPT }),
  motion('levitate', 'targets', { after: 'hz-w', anchor: 'start', offset: 300, duration: 1500, ...OPT }),
], { sound: 'wind' });
const horseshoesSpeed = design('The shoes bind to the hooves and the steed is wreathed in rushing wind.', () => [
  aura('Speed lines', ['wind_lines.01.01.white'], { subject: 'targets', duration: 1800, scale: 0.9, ...OPT }),
  motion('pulse', 'targets', { duration: 900, intensity: 0.4, ...OPT }),
], { sound: 'wind' });
const immovableRod = design('A click of the button and the rod locks rigidly in place with a ringing hum.', () => [
  aura('Rod locks', ['magic_signs.rune.transmutation.complete.yellow'], { duration: 1400, scale: 0.4 }),
  aura('Force pins it', ['extras.tmfx.inpulse.circle.01.normal'], { duration: 1000, scale: 0.6, opacity: 0.8, delay: 200 }),
], { sound: 'metalResonance' });
const instantFortress = design('The adamantine statuette swells into a 20-foot tower, shoving creatures out of its footprint.', () => [
  area('Ground heaves', ['ground_cracks.02.orange'], { stageId: 'if-g', duration: 2600, below: true, ...tint('#8a7a66') }),
  area('Adamantine tower rises', ['wall_of_force.horizontal.grey'], { stageId: 'if-t', after: 'if-g', anchor: 'start', offset: 300, duration: 2600, opacity: 0.8, fadeIn: 500, ...tint('#7d8590') }),
  area('Dust billows', ['smoke.puff.centered.grey'], { after: 'if-t', anchor: 'start', offset: 200, duration: 1600, opacity: 0.6 }),
  motion('stagger', 'targets', { after: 'if-t', anchor: 'start', offset: 300, duration: 800, ...OPT }),
], { sound: 'earth' });
const iounStone = (why, keyName, heal = false) => design(why, () => [
  aura('Stone set orbiting', [`ioun_stones.01.${keyName}`], { stageId: 'io-s', duration: 3000, scale: 0.8, offsetY: -0.3, offsetUnits: 'token', fadeIn: 300, fadeOut: 500 }),
  ...(heal ? [aura('Wounds knit', ['healing_generic.200px.green'], { after: 'io-s', anchor: 'start', offset: 500, duration: 1800, scale: 0.8 })] : []),
]);
const ironBands = design('The iron sphere is hurled, springing open in flight into a tangle of metal bands that clamp the target.', () => [
  motion('throw', 'source', { stageId: 'ib-m', duration: 900 }),
  travel('Sphere hurled', ['throwable.throw.bomb.01.grey', 'throwable.throw.bomb.01.black'], { stageId: 'ib-t', after: 'ib-m', anchor: 'start', offset: 350, duration: 1100 }),
  aura('Bands clamp shut', ['markers.chain.standard.complete.02.grey', 'markers.chain.standard.complete.02.red'], { subject: 'targets', after: 'ib-t', anchor: 'arrival', duration: 2400, requiresHit: true, ...tint('#7a6a5c') }),
  motion('press', 'targets', { after: 'ib-t', anchor: 'arrival', duration: 900, intensity: 0.6, requiresHit: true }),
], { sound: 'chainBinding' });
const strainBonds = design('The bound creature strains against its restraints.', () => [
  aura('Bonds creak', ['markers.chain.standard.complete.02.grey', 'markers.chain.standard.complete.02.red'], { duration: 1600, scale: 0.9, opacity: 0.8, ...tint('#7a6a5c') }),
  motion('shake', 'source', { duration: 1000, intensity: 0.6 }),
], { sound: null });
const ironFlaskTrap = design('The flask\'s mouth yawns and a vortex tugs the extraplanar creature toward it.', () => [
  cast('Stopper drawn', ['smoke.puff.side.dark_purple', 'smoke.puff.side.grey'], { stageId: 'fl-c', scale: 0.5, duration: 900 }),
  travel('Vortex pulls', ['energy_beam.reverse.purple', 'energy_beam.normal.bluepink'], { stageId: 'fl-t', after: 'fl-c', anchor: 'start', offset: 300, duration: 2000, opacity: 0.85, ...OPT }),
  aura('Sucked at', ['template_circle.vortex.intro.purple', 'template_circle.vortex.intro.blue'], { subject: 'targets', after: 'fl-t', anchor: 'start', offset: 300, duration: 2000, scale: 0.6, below: true, ...OPT }),
  motion('drift', 'targets', { after: 'fl-t', anchor: 'start', offset: 500, duration: 1300, intensity: 0.5, ...OPT }),
], { sound: 'void' });
const ironFlaskRelease = design('The stopper comes free and the imprisoned creature pours out in a gout of smoke.', () => [
  aura('Smoke pours out', ['smoke.plumes.01.purple', 'smoke.plumes.01.grey'], { stageId: 'fr-s', duration: 2200, scale: 0.9, offsetX: 0.8, offsetUnits: 'token' }),
  aura('Creature emerges', ['misty_step.02.purple', 'misty_step.02.blue'], { after: 'fr-s', anchor: 'start', offset: 600, duration: 1400, scale: 0.9, offsetX: 1, offsetUnits: 'token' }),
], { sound: 'summon' });
const quiet = design('Bookkeeping activity: only a brief, quiet shimmer on the item\'s owner.', () => [
  aura('Item stirs', ['glint.yellow.few'], { duration: 1200, scale: 0.6, opacity: 0.8 }),
], { sound: null, fx: false });
const figurine = (why, extraAssets, extraTint) => design(why, () => [
  motion('throw', 'source', { stageId: 'fg-m', duration: 800 }),
  aura('Statuette grows', ['smoke.puff.centered.grey'], { stageId: 'fg-s', after: 'fg-m', anchor: 'start', offset: 350, duration: 1600, scale: 1.1, offsetX: 1, offsetUnits: 'token' }),
  aura('Transmutation flare', ['magic_signs.circle.02.transmutation.complete.yellow'], { after: 'fg-m', anchor: 'start', offset: 250, duration: 2200, scale: 1, below: true, offsetX: 1, offsetUnits: 'token' }),
  ...(extraAssets ? [aura('Creature takes shape', extraAssets, { after: 'fg-s', anchor: 'start', offset: 300, duration: 1800, scale: 0.9, offsetX: 1, offsetUnits: 'token', ...(extraTint ? tint(extraTint) : {}) })] : []),
], { sound: 'summon' });
const goatTerror = figurine('The ivory goat swells into a fearsome giant goat whose horns can become weapons.', ['markers.fear.dark_purple.02']);
const marbleElephant = figurine('The marble statuette grows into a trumpeting elephant.');
const obsidianSteed = figurine('The obsidian horse swells into a nightmare wreathed in smoke and flame.', ['flames.04.complete.purple', 'flames.04.complete.orange']);
const onyxDog = figurine('The onyx statuette becomes a loyal mastiff.');
const serpentineOwl = figurine('The serpentine statuette becomes a giant owl.', ['swirling_feathers.outburst.01.textured'], '#c8b8a0');
const silverRaven = figurine('The silver statuette becomes a raven in a flurry of silvery feathers.', ['swirling_feathers.outburst.01.blue', 'swirling_feathers.outburst.01.textured'], '#d7dde6');
const figurineRevert = design('The creature shrinks back into its statuette with a puff of smoke.', () => [
  aura('Shrinks back', ['smoke.puff.centered.grey'], { duration: 1400, scale: 0.8, offsetX: 1, offsetUnits: 'token' }),
], { sound: null });
const bagOfTricks = design('A fuzzy ball is pulled from the bag and thrown; it becomes a beast where it lands.', () => [
  motion('throw', 'source', { stageId: 'bt-m', duration: 800 }),
  aura('Ball becomes a beast', ['smoke.puff.centered.grey'], { stageId: 'bt-s', after: 'bt-m', anchor: 'start', offset: 450, duration: 1600, scale: 1, offsetX: 1.4, offsetUnits: 'token', ...tint('#a07850') }),
  aura('Fur flies', ['wind_lines.01.leaves.01.greenorange', 'wind_lines.01.leaves.01.green'], { after: 'bt-s', anchor: 'start', offset: 150, duration: 1200, scale: 0.6, offsetX: 1.4, offsetUnits: 'token', ...tint('#a07850') }),
], { sound: 'summon' });
const hiddenPit = design('A hinged lid swings open and the creature drops into the pit in a cloud of dust.', () => [
  motion('sink', 'targets', { stageId: 'hp-m', duration: 1100, ...OPT }),
  impact('Dust from the fall', ['smoke.puff.centered.grey'], { after: 'hp-m', anchor: 'start', offset: 300, duration: 1500, scale: 1, ...OPT, ...tint('#a89070') }),
  impact('Bone-jarring landing', ['impact.005.orange'], { after: 'hp-m', anchor: 'start', offset: 600, duration: 900, scale: 0.6, ...OPT, ...tint('#8a7a66') }),
], { sound: 'bludgeon' });
const spikedPit = design('The creature drops into the pit and lands on sharpened spikes.', () => [
  motion('sink', 'targets', { stageId: 'sp-m', duration: 1100, ...OPT }),
  impact('Spikes', ['spike_trap.05x05ft.top.holes.normal.01.01'], { after: 'sp-m', anchor: 'start', offset: 300, duration: 1600, scale: 1, ...OPT }),
  impact('Dust from the fall', ['smoke.puff.centered.grey'], { after: 'sp-m', anchor: 'start', offset: 400, duration: 1400, scale: 0.9, opacity: 0.7, ...OPT, ...tint('#a89070') }),
], { sound: 'pierce' });
const rollingStone = design('A great stone ball thunders down the passage and slams into the creature.', () => [
  travel('Boulder rolls', ['rolling_boulder.loop.01.rock.brown'], { stageId: 'rs-t', duration: 2000, ...OPT }),
  impact('Crushing impact', ['impact.005.orange'], { after: 'rs-t', anchor: 'arrival', duration: 900, scale: 0.9, ...OPT, ...tint('#8a7a66') }),
  motion('stagger', 'targets', { after: 'rs-t', anchor: 'arrival', duration: 900, ...OPT }),
], { sound: 'bludgeon' });
const braceAgainst = design('The creature braces with all its strength against the rolling stone.', () => [
  motion('brace', 'source', { duration: 1100, intensity: 0.8 }),
  aura('Grit sprays', ['smoke.puff.side.grey'], { duration: 1200, scale: 0.5, opacity: 0.7, ...tint('#a89070') }),
], { sound: null });
const poisonDarts = design('Hidden tubes fire a volley of poisoned darts at the creature on the pressure plate.', () => [
  travel('Darts fire', ['dart.01.throw.physical.white', 'arrow.physical.white.01'], { stageId: 'pd-t', duration: 900, repeats: 3, repeatInterval: 150, scale: 0.7, ...OPT }),
  impact('Venom stings', ['impact_themed.poison.greenyellow', 'icon.poison.dark_green'], { after: 'pd-t', anchor: 'arrival', duration: 1400, scale: 0.6, ...OPT }),
  motion('recoil', 'targets', { after: 'pd-t', anchor: 'arrival', duration: 600, ...OPT }),
], { sound: 'pierce' });
const poisonNeedle = design('A tiny poisoned needle springs from the lock and pricks the meddler.', () => [
  impact('Needle pricks', ['impact.005.white', 'impact.005.orange'], { stageId: 'pn-i', duration: 700, scale: 0.35, ...OPT }),
  impact('Venom spreads', ['icon.poison.dark_green'], { after: 'pn-i', anchor: 'start', offset: 300, duration: 1500, scale: 0.5, ...OPT }),
  motion('recoil', 'targets', { after: 'pn-i', anchor: 'start', duration: 500, intensity: 0.4, ...OPT }),
], { sound: 'pierce' });
const huntingTrap = design('The sawtooth steel jaws snap shut on the creature\'s leg.', () => [
  impact('Jaws snap', ['impact.005.white', 'impact.005.orange'], { stageId: 'ht-i', duration: 800, scale: 0.6, ...OPT }),
  aura('Chained in place', ['markers.chain.standard.complete.02.grey', 'markers.chain.standard.complete.02.red'], { subject: 'targets', after: 'ht-i', anchor: 'start', offset: 200, duration: 1800, scale: 0.8, ...OPT, ...tint('#7a7a7a') }),
  motion('stagger', 'targets', { after: 'ht-i', anchor: 'start', duration: 700, ...OPT }),
]);
const poisonOn = (why, mark, cue) => design(why, () => [
  impact(cue[0], cue[1], { stageId: 'po-i', duration: 1400, scale: cue[2] ?? 0.8, opacity: 0.85, ...OPT, ...(cue[3] ? tint(cue[3]) : {}) }),
  impact('Poison takes hold', mark, { after: 'po-i', anchor: 'start', offset: 400, duration: 1600, scale: 0.55, ...OPT }),
  motion('shake', 'targets', { after: 'po-i', anchor: 'start', offset: 400, duration: 800, intensity: 0.5, ...OPT }),
], { sound: 'poison' });
const POISON_MARK = ['markers.poison.dark_green', 'icon.poison.dark_green'];
const poisonInhaled = poisonOn('The inhaled poison drifts into the creature\'s lungs; it chokes and its eyes cloud.', POISON_MARK, ['Toxic puff', ['fog_cloud.02.green', 'fog_cloud.01.white'], 0.7, '#7a9a3a']);
const poisonIngested = poisonOn('The swallowed poison works through the creature from within.', POISON_MARK, ['Sickly pallor', ['smoke.puff.centered.dark_green', 'smoke.puff.centered.grey'], 0.6]);
const poisonContact = poisonOn('The poison is smeared on the creature\'s skin and seeps in.', POISON_MARK, ['Venom smeared', ['liquid.splash.green', 'liquid.splash.blue'], 0.5, '#6f9a2a']);
const poisonInjury = poisonOn('Venom enters through a wound and burns through the creature\'s blood.', POISON_MARK, ['Venom in the wound', ['impact_themed.poison.greenyellow', 'icon.poison.dark_green'], 0.6]);
const poisonSleep = poisonOn('The ingested drug leaves the creature drowsy and sluggish.', ['sleep.symbol.dark_green', 'sleep.symbol.pink'], ['Sickly pallor', ['smoke.puff.centered.dark_green', 'smoke.puff.centered.grey'], 0.6]);
const poisonTruth = poisonOn('The serum loosens the creature\'s tongue.', ['markers.stun.dark_teal', 'markers.stun.purple'], ['Serum spreads', ['smoke.puff.centered.dark_green', 'smoke.puff.centered.grey'], 0.6]);
const poisonUnconscious = poisonOn('The contact poison seeps in and the creature slumps unconscious.', ['sleep.symbol.dark_green', 'sleep.symbol.pink'], ['Oil smeared', ['liquid.splash.green', 'liquid.splash.blue'], 0.5, '#6f9a2a']);
const coatWeapon = design('A vial of poison is smeared along a blade or a few pieces of ammunition.', () => [
  aura('Poison coats the weapon', ['liquid.blob.green', 'liquid.blob.blue'], { duration: 1300, scale: 0.4, offsetX: 0.4, offsetUnits: 'token', ...tint('#6f9a2a') }),
  aura('Toxic sheen', ['fumes.toxic.green', 'fumes.04.complete.grey'], { duration: 1500, scale: 0.4, delay: 300, offsetX: 0.4, offsetUnits: 'token', opacity: 0.7 }),
], { sound: 'poison' });
const potionOfPoison = design('What looks like a healing draught turns out to be poison: a false glow sours into toxic green.', () => [
  aura('False glimmer', ['healing_generic.200px.red', 'healing_generic.200px.green'], { stageId: 'pp-g', duration: 1000, scale: 0.7, opacity: 0.8 }),
  aura('Poison sours', ['fumes.toxic.green', 'fumes.04.complete.grey'], { after: 'pp-g', anchor: 'start', offset: 700, duration: 1600, scale: 0.8 }),
  motion('shake', 'source', { after: 'pp-g', anchor: 'start', offset: 800, duration: 900, intensity: 0.6 }),
], { sound: 'poison' });
const manaclesBind = design('Iron manacles are clapped shut around the creature\'s wrists.', () => [
  aura('Manacles lock', ['markers.chain.standard.complete.02.grey', 'markers.chain.standard.complete.02.red'], { subject: 'targets', duration: 2000, scale: 0.8, ...OPT, ...tint('#7a7a7a') }),
  motion('press', 'targets', { duration: 800, intensity: 0.4, ...OPT }),
], { sound: 'chainBinding' });
const effort = design('A plain feat of strength or dexterity: the creature strains at the task.', () => [
  motion('shake', 'source', { duration: 1000, intensity: 0.5 }),
  aura('Effort', ['smoke.puff.side.grey'], { duration: 900, scale: 0.35, opacity: 0.5 }),
], { sound: null, fx: false });
const ropeBurst = design('The creature strains until the rope snaps.', () => [
  motion('shake', 'source', { stageId: 'rb-m', duration: 1000, intensity: 0.7 }),
  aura('Rope snaps', ['impact.005.white', 'impact.005.orange'], { after: 'rb-m', anchor: 'end', offset: -200, duration: 700, scale: 0.4, ...tint('#c8a878') }),
], { sound: null, fx: false });
const toolWork = design('Mundane tool work: a short, restrained flash of attention, no magic.', () => [
  aura('Careful work', ['glint.yellow.few'], { duration: 1600, scale: 0.7, opacity: 0.85 }),
], { sound: null, fx: false });
const stargazing = design('The navigator reads the stars to fix their position.', () => [
  aura('Stars read', ['twinkling_stars.points05.white'], { duration: 2200, scale: 0.8, offsetY: -0.8, offsetUnits: 'token', fadeIn: 300, fadeOut: 500 }),
], { sound: null, fx: false });
const herbalism = design('Leaves and herbs are sorted and identified by hand.', () => [
  aura('Herbs sorted', ['wind_lines.01.leaves.01.green'], { duration: 1500, scale: 0.5, opacity: 0.85 }),
], { sound: null, fx: false });
const mundane = design('Mundane gear: eaten, drunk or handled without any magic, so only a slight gesture plays.', () => [
  motion('pulse', 'source', { duration: 700, intensity: 0.25 }),
], { sound: null, fx: false });
const spikeHammer = design('A spike is hammered home with ringing blows.', () => [
  motion('slam', 'source', { stageId: 'sh-m', duration: 800, intensity: 0.5 }),
  aura('Spike driven in', ['impact.005.white', 'impact.005.orange'], { after: 'sh-m', anchor: 'start', offset: 350, duration: 700, scale: 0.35, offsetX: 0.5, offsetUnits: 'token', repeats: 2, repeatInterval: 350, ...tint('#cfcfcf') }),
]);
const portableRam = design('The ram is swung into the door with a heavy, splintering crash.', () => [
  motion('slam', 'source', { stageId: 'pr-m', duration: 900 }),
  aura('Door splinters', ['impact.005.white', 'impact.005.orange'], { after: 'pr-m', anchor: 'start', offset: 400, duration: 900, scale: 0.7, offsetX: 0.6, offsetUnits: 'token', ...tint('#b89a70') }),
], { sound: 'bludgeon' });
const lampLight = design('The wick catches and warm lamplight spreads to fill its radius.', () => [
  cast('Wick catches', ['flames.01.orange'], { stageId: 'll-f', scale: 0.3, duration: 1500, fadeOut: 300 }),
  area('Warm light spreads', ['markers.light.complete.yellow', 'markers.light.complete.blue'], { after: 'll-f', anchor: 'start', offset: 300, duration: 3000, opacity: 0.45, below: true, fadeIn: 500, fadeOut: 800, ...WARM }),
], { fx: false });
const lanternRevealing = design('The lantern\'s bright light spreads and invisible things within it shimmer into view.', () => [
  cast('Wick catches', ['flames.01.orange'], { stageId: 'lr-f', scale: 0.3, duration: 1500, fadeOut: 300 }),
  area('Revealing light', ['markers.light.complete.yellow', 'markers.light.complete.blue'], { stageId: 'lr-a', after: 'lr-f', anchor: 'start', offset: 300, duration: 3000, opacity: 0.45, below: true, fadeIn: 500, fadeOut: 800, ...WARM }),
  area('Unseen revealed', ['shimmer.01.blue'], { after: 'lr-a', anchor: 'start', offset: 500, duration: 2000, opacity: 0.5 }),
], { fx: false, sound: 'light' });
const lanternRevealingSelf = design('The lantern\'s bright light spreads and invisible things within it shimmer into view.', () => [
  cast('Wick catches', ['flames.01.orange'], { stageId: 'ls-f', scale: 0.3, duration: 1500, fadeOut: 300 }),
  aura('Revealing light', ['markers.light.complete.yellow', 'markers.light.complete.blue'], { after: 'ls-f', anchor: 'start', offset: 300, duration: 3000, scale: 3, opacity: 0.45, below: true, fadeIn: 500, fadeOut: 800, ...WARM }),
  aura('Unseen revealed', ['shimmer.01.blue'], { after: 'ls-f', anchor: 'start', offset: 800, duration: 2000, scale: 2.5, opacity: 0.5 }),
], { fx: false, sound: 'light' });
const bullseye = design('The bullseye lantern throws a focused cone of warm light.', () => [
  cast('Wick catches', ['flames.01.orange'], { stageId: 'be-f', scale: 0.3, duration: 1500, fadeOut: 300 }),
  area('Beam of light', ['detect_magic.cone.yellow', 'detect_magic.cone.blue'], { after: 'be-f', anchor: 'start', offset: 300, duration: 3000, opacity: 0.55, fadeIn: 400, fadeOut: 800, ...WARM }),
], { fx: false });
const robeLantern = design('A bullseye lantern patch peels free and is lit.', () => [
  aura('Patch becomes a lantern', ['smoke.puff.side.02.white', 'smoke.puff.side.grey'], { stageId: 'rl-p', duration: 900, scale: 0.4, opacity: 0.7 }),
  aura('Lantern lit', ['markers.light.complete.yellow', 'markers.light.complete.blue'], { after: 'rl-p', anchor: 'start', offset: 400, duration: 2400, scale: 1.6, opacity: 0.5, fadeOut: 600, ...WARM }),
], { sound: null });
const torchLight = design('The torch flares to life and casts warm light around its bearer.', () => [
  cast('Torch flares', ['flames.01.orange'], { stageId: 'tl-f', scale: 0.4, duration: 1800, fadeOut: 300 }),
  area('Torchlight spreads', ['markers.light.complete.yellow', 'markers.light.complete.blue'], { after: 'tl-f', anchor: 'start', offset: 300, duration: 2800, opacity: 0.4, below: true, fadeIn: 500, fadeOut: 800, ...WARM }),
], { fx: false });
const tinderbox = design('Flint strikes steel; sparks catch and a small flame kindles.', () => [
  aura('Sparks', ['impact.007.orange'], { stageId: 'tb-s', duration: 600, scale: 0.25, offsetX: 0.4, offsetUnits: 'token', repeats: 2, repeatInterval: 300 }),
  aura('Small flame', ['flames.01.orange'], { after: 'tb-s', anchor: 'start', offset: 600, duration: 1600, scale: 0.25, offsetX: 0.4, offsetUnits: 'token', fadeOut: 400 }),
], { fx: false });
const holyWater = design('A flask of holy water is hurled and bursts, searing fiends and undead with radiance.', () => [
  motion('throw', 'source', { stageId: 'hw-m', duration: 900 }),
  travel('Flask flies', ['throwable.throw.flask.01.white', 'throwable.throw.flask.01.orange'], { stageId: 'hw-t', after: 'hw-m', anchor: 'start', offset: 350, duration: 1000 }),
  impact('Flask shatters', ['explosion.side_fracture.flask'], { after: 'hw-t', anchor: 'arrival', duration: 900, scale: 0.6, ...tint('#e9f1ff') }),
  impact('Holy radiance sears', ['sacred_flame.target.yellow'], { after: 'hw-t', anchor: 'arrival', offset: 150, duration: 1800, scale: 0.8 }),
]);
const oilThrow = design('A flask of oil is thrown and bursts, splashing the target with slick black oil.', () => [
  motion('throw', 'source', { stageId: 'ot-m', duration: 900 }),
  travel('Flask flies', ['throwable.throw.flask.01.black', 'throwable.throw.flask.01.orange'], { stageId: 'ot-t', after: 'ot-m', anchor: 'start', offset: 350, duration: 1000 }),
  impact('Flask shatters', ['explosion.side_fracture.flask'], { after: 'ot-t', anchor: 'arrival', duration: 900, scale: 0.6, ...tint('#b8a070') }),
  impact('Oil splashes', ['liquid.splash.dark_black', 'liquid.splash.blue'], { after: 'ot-t', anchor: 'arrival', offset: 100, duration: 1300, scale: 0.7, ...tint('#3a2f1e') }),
], { sound: 'bomb', ...ABILITY });
const oilFlaskFire = design('A flask of oil shatters on the target and the slick oil bursts into flame.', () => [
  motion('throw', 'source', { stageId: 'of-m', duration: 900 }),
  travel('Flask flies', ['throwable.throw.flask.01.black', 'throwable.throw.flask.01.orange'], { stageId: 'of-t', after: 'of-m', anchor: 'start', offset: 350, duration: 1000 }),
  impact('Oil splashes', ['liquid.splash.dark_black', 'liquid.splash.blue'], { after: 'of-t', anchor: 'arrival', duration: 1200, scale: 0.7, ...tint('#3a2f1e') }),
  impact('Oil ignites', ['flames.04.complete.orange'], { after: 'of-t', anchor: 'arrival', offset: 400, duration: 1800, scale: 0.7, requiresHit: true }),
], { sound: 'bomb-fire', ...ABILITY });
const oilDouse = design('Oil spread over the ground catches fire and burns in the doused square.', () => [
  area('Oil slick', ['grease.dark_brown.loop'], { stageId: 'od-g', duration: 3000, opacity: 0.8, below: true, fadeOut: 600, ...tint('#2e2416') }),
  area('Oil burns', ['flames.02.orange'], { after: 'od-g', anchor: 'start', offset: 500, duration: 2500, fadeIn: 300, fadeOut: 600 }),
], { sound: 'fireIgnition' });
const grease = design('Slick oil spreads across the ground in a slippery sheen.', () => [
  area('Slippery oil', ['grease.dark_brown.loop'], { duration: 3200, opacity: 0.85, below: true, fadeIn: 400, fadeOut: 700 }),
], { sound: 'water' });
const greaseSelf = design('The vial of slippery oil is poured out at the user\'s feet.', () => [
  aura('Slippery oil', ['grease.dark_brown.loop'], { duration: 3000, scale: 1.8, opacity: 0.85, below: true, fadeIn: 400, fadeOut: 700 }),
], { sound: 'water' });
const slipperyCoat = design('A sticky black unguent coats the creature, letting it slip free of any hold.', () => [
  aura('Unguent coats', ['liquid.splash.dark_black', 'liquid.splash.blue'], { duration: 1200, scale: 0.6, ...tint('#2e2416') }),
  aura('Slick sheen', ['shimmer.01.orange', 'shimmer.01.blue'], { duration: 1800, scale: 1, delay: 400, opacity: 0.6, ...tint('#5a4a30') }),
], { sound: 'water' });
const sharpness = design('Oil sparkling with silver shards is wiped along the edge, honing it to a magical keenness.', () => [
  aura('Silver shards glint', ['glint.blue.many', 'glint.yellow.many'], { duration: 1600, scale: 0.5, offsetX: 0.4, offsetUnits: 'token', ...tint('#dfe6ee') }),
  aura('Edge honed', ['shimmer.01.blue'], { duration: 1400, delay: 400, scale: 0.6, offsetX: 0.4, offsetUnits: 'token', opacity: 0.7, ...tint('#dfe6ee') }),
], { sound: 'metalResonance' });
const mithral = design('The armor takes on the light, silvery sheen of mithral.', () => [
  aura('Silvery sheen', ['shimmer.01.blue'], { duration: 1800, scale: 1.1, opacity: 0.8, ...tint('#dfe6ee') }),
  aura('Metal glints', ['glint.blue.few', 'glint.yellow.few'], { duration: 1400, delay: 300, scale: 0.8, ...tint('#dfe6ee') }),
], { sound: 'metalResonance' });
const giantStrength = (why, assets, tintHex, sound) => design(why, () => [
  aura('Giant might surges', assets, { stageId: 'gs-a', duration: 2200, scale: 1.2, ...(tintHex ? tint(tintHex) : {}) }),
  aura('Strength swells', ['template_circle.aura.03.outward'], { after: 'gs-a', anchor: 'start', offset: 300, duration: 1600, scale: 1.2, opacity: 0.7, ...tint(tintHex ?? '#d9a050') }),
  motion('pulse', 'source', { after: 'gs-a', anchor: 'start', offset: 300, duration: 1200, intensity: 0.9 }),
], { sound });
const giantCloud = giantStrength('Cloud giant strength fills the drinker on a swirl of high wind.', ['whirlwind.bluegrey'], null, 'wind');
const giantFire = giantStrength('Fire giant strength fills the drinker with forge-hot might.', ['shield_themed.above.fire.01.orange'], null, 'fire');
const giantFrost = giantStrength('Frost giant strength fills the drinker in a rime of ice.', ['shield_themed.above.ice.01.blue'], null, 'cold');
const giantHill = giantStrength('Hill giant strength fills the drinker; the ground cracks under their weight.', ['ground_cracks.02.orange'], '#9b8466', 'earth');
const giantStone = giantStrength('Stone giant strength hardens the drinker like living rock.', ['ground_cracks.03.orange'], '#8a8378', 'earth');
const giantStorm = giantStrength('Storm giant strength crackles through the drinker as lightning.', ['static_electricity.03.blue'], null, 'electric');
const resist = (why, assets, tintHex) => design(why, () => [
  aura('Resistance wards', ['shield.01.complete.01.white', 'shield.01.complete.01.blue'], { stageId: 'rz-s', duration: 2200, scale: 1, ...tint(tintHex) }),
  aura('Element repelled', assets, { after: 'rz-s', anchor: 'start', offset: 300, duration: 1500, scale: 0.6, opacity: 0.8 }),
], { sound: 'shield' });
const resistAcid = resist('The drinker gains resistance to acid.', ['liquid.splash.green', 'liquid.splash.blue'], '#8fd14f');
const resistCold = resist('The drinker gains resistance to cold.', ['shield_themed.above.ice.01.blue'], '#9fd6ff');
const resistFire = resist('The drinker gains resistance to fire.', ['shield_themed.above.fire.01.orange'], '#ff9a4a');
const resistForce = resist('The drinker gains resistance to force.', ['impact.004.dark_purple', 'impact.004.blue'], '#b48cff');
const resistLightning = resist('The drinker gains resistance to lightning.', ['static_electricity.02.blue'], '#8fc8ff');
const resistNecrotic = resist('The drinker gains resistance to necrotic energy.', ['smoke.puff.centered.dark_green', 'smoke.puff.centered.grey'], '#7aa06a');
const resistPoison = resist('The drinker gains resistance to poison.', ['fumes.toxic.green', 'fumes.04.complete.grey'], '#7ac04a');
const resistPsychic = resist('The drinker gains resistance to psychic assault.', ['markers.stun.purple'], '#e08cff');
const resistRadiant = resist('The drinker gains resistance to radiant energy.', ['markers.light.complete.yellow02', 'markers.light.complete.blue'], '#fff2b8');
const resistThunder = resist('The drinker gains resistance to thunder.', ['soundwave.01.blue'], '#bcd8ff');
const clairvoyance = design('An eyeball swims in the yellowish draught; an invisible sensor opens far away.', () => [
  cast('Divination rune', ['magic_signs.rune.divination.complete.yellow', 'magic_signs.rune.divination.complete.blue'], { stageId: 'cv-c', scale: 0.45, offsetY: -0.4, offsetUnits: 'token', duration: 1200 }),
  aura('Distant sight', ['eyes.01.orangeyellow', 'eyes.01.dark_green'], { after: 'cv-c', anchor: 'start', offset: 400, duration: 2200, scale: 0.8 }),
], { sound: 'detect' });
const climbing = design('Bands of brown, silver and grey settle over the drinker, granting a sure climbing grip.', () => [
  aura('Stone-banded sheen', ['shimmer.01.orange', 'shimmer.01.blue'], { duration: 1800, scale: 1, opacity: 0.75, ...tint('#9b8466') }),
  motion('brace', 'source', { duration: 900, delay: 300, intensity: 0.5 }),
], { sound: 'earth' });
const flying = design('The drinker grows light as air and lifts off the ground on a gust of wind.', () => [
  aura('Wind gathers', ['wind_lines.01.01.white'], { stageId: 'fl-w', duration: 1600, scale: 0.9 }),
  aura('Feathers whirl', ['swirling_feathers.outburst.01.blue', 'swirling_feathers.outburst.01.textured'], { after: 'fl-w', anchor: 'start', offset: 200, duration: 1500, scale: 0.8, ...tint('#eef3f8') }),
  motion('levitate', 'source', { after: 'fl-w', anchor: 'start', offset: 400, duration: 2000 }),
], { sound: 'wind' });
const wingedBoots = design('Small wings flutter at the boots\' heels and lift the wearer into the air.', () => [
  aura('Heel wings flutter', ['swirling_feathers.outburst.01.blue', 'swirling_feathers.outburst.01.textured'], { stageId: 'wb-f', duration: 1400, scale: 0.6, offsetY: 0.35, offsetUnits: 'token', ...tint('#eef3f8') }),
  motion('levitate', 'source', { after: 'wb-f', anchor: 'start', offset: 300, duration: 2000 }),
], { sound: 'wind' });
const wings = design('The cloak unfurls into great feathered wings that carry the wearer aloft.', () => [
  aura('Wings unfurl', ['swirling_feathers.outburst.01.orange', 'swirling_feathers.outburst.01.textured'], { stageId: 'wg-f', duration: 1600, scale: 1.1 }),
  aura('Downdraft', ['wind_lines.01.02.white'], { after: 'wg-f', anchor: 'start', offset: 300, duration: 1400, scale: 0.9 }),
  motion('levitate', 'source', { after: 'wg-f', anchor: 'start', offset: 400, duration: 2000 }),
], { sound: 'wind' });
const gaseousForm = design('The drinker\'s body loosens into a drifting misty cloud.', () => [
  aura('Body turns to mist', ['fog_cloud.01.white'], { stageId: 'gf-m', duration: 2600, scale: 1, opacity: 0.85, fadeOut: 600 }),
  motion('drift', 'source', { after: 'gf-m', anchor: 'start', offset: 400, duration: 1600 }),
], { sound: 'wind' });
const heroism = design('A rush of heroic courage: golden blessing and a bolstering ward settle over the drinker.', () => [
  aura('Heroic blessing', ['bless.200px.intro.yellow'], { stageId: 'hr-b', duration: 2200, scale: 1 }),
  aura('Bolstered', ['shield.01.complete.01.yellow', 'shield.01.complete.01.blue'], { after: 'hr-b', anchor: 'start', offset: 500, duration: 1800, scale: 0.9, opacity: 0.8 }),
], { sound: 'bless' });
const invulnerability = design('Liquefied iron hardens over the drinker into a resistant metallic sheen.', () => [
  aura('Iron sheath', ['shield.01.complete.01.white', 'shield.01.complete.01.blue'], { duration: 2200, scale: 1.1, ...tint('#8d939b') }),
  motion('brace', 'source', { duration: 900, delay: 300, intensity: 0.6 }),
], { sound: 'metalResonance' });
const longevity = design('Years flow back out of the drinker in a soft, renewing light.', () => [
  aura('Years recede', ['particles.inward.white', 'particles.inward.greenyellow'], { stageId: 'lg-p', duration: 1800, scale: 0.9 }),
  aura('Youth renewed', ['healing_generic.200px.yellow'], { after: 'lg-p', anchor: 'start', offset: 600, duration: 1600, scale: 0.8 }),
], { sound: 'time' });
const haste = design('The drinker blurs with unnatural speed.', () => [
  aura('Golden quickening', ['swirling_sparkles.01.yellow', 'swirling_sparkles.01.blue'], { stageId: 'hs-s', duration: 1800, scale: 0.9 }),
  aura('Speed lines', ['wind_lines.01.01.white'], { after: 'hs-s', anchor: 'start', offset: 300, duration: 1400, scale: 0.9 }),
  motion('shake', 'source', { after: 'hs-s', anchor: 'start', offset: 400, duration: 900, intensity: 0.4 }),
]);
const vitality = design('Exhaustion and sickness drain away and the drinker is restored.', () => [
  aura('Vitality restored', ['healing_generic.burst.greenorange'], { duration: 1800, scale: 1 }),
  aura('Boon settles', ['condition.boon.01.001.green'], { duration: 1600, delay: 500, scale: 0.8 }),
], { sound: 'healing' });
const philter = design('A heart-shaped bubble rises from the rose-hued philter; the drinker falls under its charm.', () => [
  aura('Effervescent bubbles', ['bubble.002.001.complete.pinkyellow', 'bubble.002.001.complete.blue'], { stageId: 'ph-b', duration: 1400, scale: 0.6 }),
  aura('Smitten', ['markers.heart.pink.01'], { after: 'ph-b', anchor: 'start', offset: 500, duration: 2000, scale: 0.7 }),
], { sound: 'psychic' });
const pipesHaunting = design('The pipes play an eerie, spellbinding tune that fills listeners with fear.', () => [
  cast('Eerie tune', ['music_notations.flat.purple', 'music_notations.flat.blue'], { stageId: 'ph-c', scale: 0.5, offsetY: -0.5, offsetUnits: 'token', duration: 1200 }),
  area('Haunting notes', ['template_circle.symbol.normal.horror.purple'], { after: 'ph-c', anchor: 'start', offset: 300, duration: 2800, opacity: 0.6, below: true, fadeOut: 600 }),
  impact('Frightened', ['markers.fear.dark_purple.02'], { after: 'ph-c', anchor: 'start', offset: 800, duration: 1800, scale: 0.7, ...OPT }),
  motion('cower', 'targets', { after: 'ph-c', anchor: 'start', offset: 900, duration: 900, ...OPT }),
], { sound: 'whispers' });
const pipesHauntingSelf = design('The pipes play an eerie, spellbinding tune that fills listeners with fear.', () => [
  cast('Eerie tune', ['music_notations.flat.purple', 'music_notations.flat.blue'], { stageId: 'pj-c', scale: 0.5, offsetY: -0.5, offsetUnits: 'token', duration: 1200 }),
  aura('Haunting notes', ['markers.music.purplepink', 'markers.music.greenorange'], { after: 'pj-c', anchor: 'start', offset: 300, duration: 2400, scale: 1.2, ...tint('#9a6bd0') }),
  impact('Frightened', ['markers.fear.dark_purple.02'], { after: 'pj-c', anchor: 'start', offset: 800, duration: 1800, scale: 0.7, ...OPT }),
  motion('cower', 'targets', { after: 'pj-c', anchor: 'start', offset: 900, duration: 900, ...OPT }),
], { sound: 'whispers' });
const pipesRats = design('A shrill tune on the pipes calls a swarm of rats out of the shadows.', () => [
  cast('Shrill tune', ['music_notations.quaver.green', 'music_notations.quaver.blue'], { stageId: 'pr-c', scale: 0.5, offsetY: -0.5, offsetUnits: 'token', duration: 1200 }),
  aura('Rats boil out', ['smoke.plumes.01.grey'], { after: 'pr-c', anchor: 'start', offset: 500, duration: 2200, scale: 0.9, offsetX: 1, offsetUnits: 'token', ...tint('#5a4a3a') }),
], { sound: 'song' });
const pipesSway = design('The piper\'s tune works on the rats\' small minds, swaying them to obey.', () => [
  cast('Piping tune', ['music_notations.quaver.green', 'music_notations.quaver.blue'], { stageId: 'pw-c', scale: 0.5, offsetY: -0.5, offsetUnits: 'token', duration: 1200 }),
  impact('Swayed by music', ['markers.music.greenorange'], { after: 'pw-c', anchor: 'start', offset: 500, duration: 1800, scale: 0.6, ...OPT }),
  motion('drift', 'targets', { after: 'pw-c', anchor: 'start', offset: 600, duration: 1200, intensity: 0.3, ...OPT }),
], { sound: 'song' });
const portableHole = design('The black cloth is unfolded into a circle of absolute dark: an extradimensional hole.', () => [
  area('Hole opens', ['darkness.black'], { stageId: 'ph-h', duration: 2600, fadeIn: 400, fadeOut: 600 }),
  area('Edge ripples', ['smoke.puff.centered.grey'], { after: 'ph-h', anchor: 'start', offset: 200, duration: 1400, opacity: 0.6, ...tint('#2a2a33') }),
], { sound: 'pocketTransition' });
const wellOfWorlds = design('The cloth unfolds into a two-way portal to another world.', () => [
  area('Portal opens', ['portals.horizontal.vortex.purple', 'portals.horizontal.ring.bright_yellow'], { stageId: 'wo-p', duration: 3000, fadeIn: 400, fadeOut: 700 }),
  area('Otherworldly light', ['twinkling_stars.points07.white'], { after: 'wo-p', anchor: 'start', offset: 400, duration: 2200, opacity: 0.8 }),
], { sound: 'teleport' });
const mirrorTrap = design('The mirror\'s glass ripples and drags the creature\'s image into its depths.', () => [
  cast('Glass ripples', ['shimmer.01.blue'], { stageId: 'mt-c', scale: 0.8, duration: 1200 }),
  travel('Image drawn in', ['energy_beam.reverse.blue', 'energy_beam.normal.blue'], { stageId: 'mt-t', after: 'mt-c', anchor: 'start', offset: 300, duration: 1800, opacity: 0.8, ...OPT }),
  aura('Reflection snatched', ['shimmer.01.blue'], { subject: 'targets', after: 'mt-t', anchor: 'start', offset: 300, duration: 1600, scale: 1, ...OPT }),
  motion('drift', 'targets', { after: 'mt-t', anchor: 'start', offset: 400, duration: 1200, intensity: 0.4, ...OPT }),
], { sound: 'void' });
const mirrorRelease = design('A trapped creature steps out of the mirror\'s glass.', () => [
  aura('Steps from the glass', ['misty_step.02.blue'], { duration: 1500, scale: 0.9, offsetX: 1, offsetUnits: 'token' }),
], { sound: 'teleport' });
const psychicBacklash = design('The manual\'s magic lashes the unqualified reader\'s mind.', () => [
  aura('Mind reels', ['markers.stun.purple'], { stageId: 'pb-s', duration: 1800, scale: 0.7 }),
  motion('shake', 'source', { after: 'pb-s', anchor: 'start', offset: 200, duration: 900 }),
], { sound: 'psychic' });
const tome = (why, rune, aspect, aspectTint) => design(why, () => [
  cast('Magic in the words', [rune], { stageId: 'tm-r', scale: 0.4, offsetY: -0.4, offsetUnits: 'token', duration: 1400 }),
  aura('Lesson takes hold', aspect, { after: 'tm-r', anchor: 'start', offset: 600, duration: 1800, scale: 0.9, ...(aspectTint ? tint(aspectTint) : {}) }),
  motion('pulse', 'source', { after: 'tm-r', anchor: 'start', offset: 700, duration: 900, intensity: 0.4 }),
], { sound: 'bless' });
const manualHealth = tome('Health and diet lessons charged with magic raise the reader\'s Constitution.', 'magic_signs.rune.transmutation.complete.yellow', ['healing_generic.200px.green']);
const manualExercise = tome('Fitness exercises charged with magic raise the reader\'s Strength.', 'magic_signs.rune.transmutation.complete.yellow', ['template_circle.aura.03.outward'], '#e0783a');
const manualQuickness = tome('Coordination exercises charged with magic raise the reader\'s Dexterity.', 'magic_signs.rune.transmutation.complete.yellow', ['wind_lines.01.01.white']);
const tomeClear = tome('Memory and logic exercises charged with magic raise the reader\'s Intelligence.', 'magic_signs.rune.divination.complete.blue', ['markers.runes.blue', 'markers.runes.orange']);
const tomeLeadership = tome('Guidelines for influence charged with magic raise the reader\'s Charisma.', 'magic_signs.rune.enchantment.complete.pink', ['markers.light_orb.complete.yellow', 'markers.light_orb.complete.blue']);
const tomeUnderstanding = tome('Intuition and insight exercises charged with magic raise the reader\'s Wisdom.', 'magic_signs.rune.divination.complete.blue', ['eyes.01.bluegreen', 'eyes.01.dark_green']);
const deckDraw = design('A card is drawn from the deck and its fate-twisting magic flares.', () => [
  aura('Card turns', ['icosahedron.roll.blue'], { stageId: 'dd-r', duration: 1600, scale: 0.5, offsetY: -0.5, offsetUnits: 'token' }),
  aura('Fate stirs', ['swirling_sparkles.01.orangepurple', 'swirling_sparkles.01.blue'], { after: 'dd-r', anchor: 'start', offset: 600, duration: 1800, scale: 0.9 }),
]);
const pearlOfPower = design('The pearl glows and spent spell energy flows back into the attuned caster.', () => [
  aura('Pearl glows', ['markers.light_orb.complete.white', 'markers.light_orb.complete.blue'], { stageId: 'pp-o', duration: 1400, scale: 0.4 }),
  aura('Power flows back', ['energy_strands.in.blue.01', 'energy_strands.in.green.01'], { after: 'pp-o', anchor: 'start', offset: 400, duration: 1800, scale: 0.9, ...tint('#9fc8ff') }),
], { sound: 'drain' });
const absorbSpell = design('The rod drinks in magical energy, pulling it inward.', () => [
  aura('Magic drawn in', ['energy_strands.in.purple.01', 'energy_strands.in.green.01'], { stageId: 'ab-i', duration: 1800, scale: 1, ...tint('#b48cff') }),
  aura('Rod hums', ['extras.tmfx.inflow.circle.01'], { after: 'ab-i', anchor: 'start', offset: 300, duration: 1400, scale: 0.8, opacity: 0.8 }),
], { sound: 'drain' });
const spellTurning = design('A reflective ward flashes up, turning a spell back on its caster.', () => [
  aura('Reflective ward', ['shield.02.complete.01.purple', 'shield.01.complete.01.blue'], { duration: 1600, scale: 1 }),
  motion('brace', 'source', { duration: 800, intensity: 0.5 }),
], { sound: 'shield' });
const evasion = design('The wearer twists aside from the danger at the last instant.', () => [
  sprite('Afterimage', { duration: 700, opacity: 0.4 }),
  motion('dodge', 'source', { duration: 800, distance: 0.4 }),
], { sound: null });
const ramAttack = design('A spectral ram\'s head of force charges from the ring and butts the target.', () => [
  cast('Ring flares', ['cast_shape.circle.01.purple', 'cast_shape.circle.01.blue'], { stageId: 'ra-c', scale: 0.5, duration: 700 }),
  travel('Force ram charges', ['eldritch_blast.dark_purple', 'eldritch_blast.purple'], { stageId: 'ra-t', after: 'ra-c', anchor: 'start', offset: 300, duration: 1100 }),
  impact('Ram strikes', ['thunderwave.center.dark_purple', 'thunderwave.center.blue'], { after: 'ra-t', anchor: 'arrival', duration: 1200, scale: 0.6, requiresHit: true }),
  motion('stagger', 'targets', { after: 'ra-t', anchor: 'arrival', duration: 800, requiresHit: true }),
], { sound: 'force' });
const ramBreak = design('A ram of force slams into the object to burst it open.', () => [
  impact('Ram slams', ['thunderwave.center.dark_purple', 'thunderwave.center.blue'], { stageId: 'rb-i', duration: 1100, scale: 0.6, ...OPT }),
  impact('Object breaks', ['shatter.purple', 'shatter.blue'], { after: 'rb-i', anchor: 'start', offset: 250, duration: 1200, scale: 0.4, ...OPT }),
], { sound: 'force' });
const lightningSpheres = design('Glowing spheres of lightning blink into being and hover in the area.', () => [
  area('Lightning spheres', ['lightning_orb.01.complete.bluepurple', 'lightning_orb.01.loop.bluepurple'], { duration: 3000, fadeIn: 300, fadeOut: 600 }),
], { sound: 'electric' });
const sphereZap = design('A hovering sphere discharges a bolt into a nearby creature.', () => [
  travel('Sphere discharges', ['chain_lightning.secondary.blue'], { stageId: 'sz-t', duration: 1000, ...OPT }),
  impact('Jolt', ['static_electricity.03.blue'], { after: 'sz-t', anchor: 'arrival', duration: 1200, scale: 0.7, ...OPT }),
  motion('shake', 'targets', { after: 'sz-t', anchor: 'arrival', duration: 700, ...OPT }),
], { sound: 'electric' });
const shootingStars = (why, burst, sound) => design(why, () => [
  travel('Star falls', ['scorching_ray.01.yellow', 'scorching_ray.01.orange'], { stageId: 'st-t', duration: 900, travelDestination: 'area' }),
  area('Starburst', burst, { stageId: 'st-a', after: 'st-t', anchor: 'arrival', duration: 1600 }),
  area('Sparkling motes', ['twinkling_stars.points07.white'], { after: 'st-a', anchor: 'start', offset: 200, duration: 1600, opacity: 0.85 }),
  motion('stagger', 'targets', { after: 'st-a', anchor: 'start', offset: 150, duration: 700, ...OPT }),
], { sound });
const glareFlash = design('Light flares and the robe\'s many eyes are dazzled.', () => [
  aura('Blinding flare', ['markers.light.complete.yellow02', 'markers.light.complete.blue'], { stageId: 'gl-f', duration: 1400, scale: 1.4, ...tint('#fff2b8') }),
  aura('Eyes squeeze shut', ['eyes.01.orangeyellow', 'eyes.01.dark_green'], { after: 'gl-f', anchor: 'start', offset: 300, duration: 1400, scale: 0.7, opacity: 0.7 }),
  motion('cower', 'source', { after: 'gl-f', anchor: 'start', offset: 200, duration: 800 }),
], { sound: null });
const dazzlingHues = design('The robe flashes shifting, dazzling colors in every direction.', () => [
  area('Shifting hues', ['energy_field.01.multicolored', 'energy_field.01.blue'], { stageId: 'dh-a', duration: 3000, opacity: 0.55, below: true, fadeIn: 400, fadeOut: 700 }),
  aura('Robe scintillates', ['swirling_sparkles.01.bluepink', 'swirling_sparkles.01.blue'], { after: 'dh-a', anchor: 'start', offset: 200, duration: 2400, scale: 1 }),
], { sound: 'light' });
const dazzlingSelf = design('The robe flashes shifting, dazzling colors in every direction.', () => [
  aura('Shifting hues', ['energy_field.01.multicolored', 'energy_field.01.blue'], { stageId: 'ds-a', duration: 2800, scale: 2.2, opacity: 0.55, below: true, fadeIn: 400, fadeOut: 700 }),
  aura('Robe scintillates', ['swirling_sparkles.01.bluepink', 'swirling_sparkles.01.blue'], { after: 'ds-a', anchor: 'start', offset: 200, duration: 2400, scale: 1 }),
  impact('Dazzled', ['dizzy_stars.200px.pink', 'dizzy_stars.200px.blueorange'], { after: 'ds-a', anchor: 'start', offset: 600, duration: 1600, scale: 0.6, ...OPT }),
], { sound: 'light' });
const usefulPatch = design('A cloth patch is pulled from the robe and becomes the real object with a soft puff.', () => [
  aura('Patch becomes real', ['smoke.puff.side.02.white', 'smoke.puff.side.grey'], { duration: 1000, scale: 0.45, offsetX: 0.4, offsetUnits: 'token', opacity: 0.8 }),
], { sound: null });
const ropeAnimate = design('The rope uncoils and snakes through the air at its owner\'s command.', () => [
  aura('Rope snakes out', ['vine.complete.nature.single.01.green'], { duration: 2400, scale: 0.6, offsetX: 0.8, offsetUnits: 'token', ...tint('#b08a5a') }),
], { sound: null });
const ropeEntangle = design('The rope lashes out and coils tightly around the target.', () => [
  travel('Rope lashes out', ['vine.complete.nature.single.01.green'], { stageId: 're-t', duration: 1200, ...OPT, ...tint('#b08a5a') }),
  aura('Rope binds', ['entangle.brown'], { subject: 'targets', after: 're-t', anchor: 'arrival', duration: 2200, scale: 0.8, ...OPT, ...tint('#b08a5a') }),
  motion('press', 'targets', { after: 're-t', anchor: 'arrival', duration: 900, intensity: 0.5, ...OPT }),
], { sound: 'whip', ...ABILITY });
const scarab = design('The golden scarab flares, warding its bearer against death magic.', () => [
  aura('Scarab ward', ['shield.01.complete.01.yellow', 'shield.01.complete.01.blue'], { duration: 1800, scale: 1 }),
  aura('Holy sigil', ['ward.star.yellow.01'], { duration: 1600, delay: 300, scale: 0.7, below: true }),
], { sound: 'shield' });
const sending = design('A short message is spoken into the stone and leaps to its twin.', () => [
  aura('Stone glows', ['markers.light_orb.complete.blue'], { stageId: 'sd-o', duration: 1200, scale: 0.35 }),
  aura('Message sent', ['magic_signs.rune.divination.complete.blue'], { after: 'sd-o', anchor: 'start', offset: 400, duration: 1400, scale: 0.4, offsetY: -0.4, offsetUnits: 'token' }),
], { sound: 'whispers' });
const shieldBash = design('The cavalier\'s shield slams into the foe with a burst of force.', () => [
  motion('lunge', 'source', { stageId: 'sb-m', duration: 800 }),
  impact('Forceful bash', ['impact.004.dark_purple', 'impact.004.blue'], { stageId: 'sb-i', after: 'sb-m', anchor: 'start', offset: 350, duration: 1000, scale: 0.7, requiresHit: true }),
  motion('stagger', 'targets', { after: 'sb-i', anchor: 'start', duration: 800, requiresHit: true }),
], { sound: 'shieldStrike', ...ABILITY });
const whistle = design('A shrill whistle blast carries far.', () => [
  aura('Shrill blast', ['soundwave.01.blue'], { duration: 1000, scale: 0.5, offsetX: 0.3, offsetUnits: 'token' }),
], { sound: 'whistle', fx: false });
const slaying = design('The bullet\'s slaying magic surges through a creature of its bane type.', () => [
  impact('Death magic surges', ['toll_the_dead.red.skull_smoke', 'toll_the_dead.green.skull_smoke'], { stageId: 'sl-i', duration: 1600, scale: 0.7, ...OPT }),
  motion('stagger', 'targets', { after: 'sl-i', anchor: 'start', offset: 200, duration: 800, ...OPT }),
], { sound: 'drain' });
const glue = design('A thin layer of sovereign glue is spread over the surface.', () => [
  area('Glue spreads', ['grease.dark_grey.loop', 'grease.dark_brown.loop'], { duration: 2400, opacity: 0.7, below: true, fadeOut: 600, ...tint('#efe9da') }),
], { sound: null });
const solvent = design('Universal solvent hisses over the surface and dissolves any adhesive.', () => [
  area('Solvent spreads', ['liquid.splash.grey', 'liquid.splash.blue'], { stageId: 'so-l', duration: 1300, opacity: 0.8, ...tint('#dfe6ee') }),
  area('Adhesive dissolves', ['fumes.steam.white'], { after: 'so-l', anchor: 'start', offset: 400, duration: 1800, opacity: 0.7 }),
], { sound: null });
const sphereEngulf = design('The sphere of annihilation swallows matter: the creature is caught in the void.', () => [
  impact('Sphere engulfs', ['sphere_of_annihilation.200px.purple'], { stageId: 'se-i', duration: 2400, scale: 0.9, ...OPT }),
  motion('stagger', 'targets', { after: 'se-i', anchor: 'start', offset: 300, duration: 900, ...OPT }),
], { sound: 'void' });
const sphereControl = design('The controller strains to bend the sphere of annihilation to their will.', () => [
  aura('Will strains', ['energy_strands.overlay.dark_purple', 'energy_strands.overlay.blue'], { stageId: 'sc-s', duration: 1800, scale: 0.9 }),
  motion('shake', 'source', { after: 'sc-s', anchor: 'start', offset: 200, duration: 900, intensity: 0.5 }),
], { sound: 'void' });
const dragonOrb = design('The orb awakens with a draconic gaze and calls out to dragons nearby.', () => [
  aura('Draconic gaze', ['eyes.01.dark_red', 'eyes.01.dark_green'], { stageId: 'do-e', duration: 2200, scale: 0.8 }),
  aura('Orb\'s power', ['magic_signs.circle.02.divination.complete.dark_red', 'magic_signs.circle.02.divination.complete.blue'], { after: 'do-e', anchor: 'start', offset: 200, duration: 2400, scale: 1.2, below: true }),
], { sound: 'detect' });
const dragonOrbWill = design('The orb presses its alien will against the user\'s mind.', () => [
  aura('Draconic will', ['eyes.01.dark_red', 'eyes.01.dark_green'], { stageId: 'dw-e', duration: 1800, scale: 0.8 }),
  motion('shake', 'source', { after: 'dw-e', anchor: 'start', offset: 300, duration: 900, intensity: 0.5 }),
], { sound: 'psychic' });
const wonderRoll = design('The wand is pointed and its wild magic tumbles, its effect left to chance.', () => [
  aura('Chance tumbles', ['icosahedron.roll.blue'], { stageId: 'wr-r', duration: 1600, scale: 0.5, offsetY: -0.5, offsetUnits: 'token' }),
  aura('Wild sparks', ['swirling_sparkles.01.bluepink', 'swirling_sparkles.01.blue'], { after: 'wr-r', anchor: 'start', offset: 400, duration: 1600, scale: 0.8 }),
]);
const colorBurst = design('A burst of colorful light explodes outward; creatures inside are dazzled.', () => [
  area('Colorful burst', ['energy_field.01.multicolored', 'energy_field.01.blue'], { stageId: 'cb-a', duration: 2400, opacity: 0.6, fadeOut: 600 }),
  area('Flash', ['explosion.03.purplepink', 'explosion.03.blueyellow'], { after: 'cb-a', anchor: 'start', duration: 1400 }),
  impact('Dazzled', ['dizzy_stars.200px.pink', 'dizzy_stars.200px.blueorange'], { after: 'cb-a', anchor: 'start', offset: 600, duration: 1600, scale: 0.6, ...OPT }),
], { sound: 'light' });
const gemStream = design('A stream of gemstones sprays out along the line and pelts creatures in its path.', () => [
  area('Stream of gems', ['celestial_bodies.asteroid.line.05x25.ice.blue.01', 'celestial_bodies.asteroid.line.05x25.iron.red.01'], { stageId: 'gm-a', duration: 1800 }),
  area('Gem glints', ['twinkling_stars.points05.white'], { after: 'gm-a', anchor: 'start', offset: 200, duration: 1500, opacity: 0.8 }),
  motion('stagger', 'targets', { after: 'gm-a', anchor: 'start', offset: 400, duration: 700, ...OPT }),
], { sound: 'bludgeon' });
const heavyRain = design('A heavy downpour falls in the cylinder.', () => [
  area('Heavy rain', ['sleet_storm.02.blue'], { duration: 3400, opacity: 0.8, fadeIn: 400, fadeOut: 700, ...tint('#8cb8e0') }),
], { sound: 'water' });
const lordlyMight = design('The rod is swung as a magic mace.', () => [
  motion('lunge', 'source', { stageId: 'lm-m', duration: 800 }),
  travel('Mace swing', ['mace.melee.01.white'], { stageId: 'lm-t', after: 'lm-m', anchor: 'start', offset: 200, duration: 1100 }),
  motion('recoil', 'targets', { after: 'lm-t', anchor: 'arrival', duration: 600, requiresHit: true }),
], { sound: 'hammer', ...ABILITY });
const paralysisRay = design('A thin blue ray lances from the wand and the target\'s limbs lock rigid.', () => [
  cast('Wand charges', ['cast_generic.02.blue'], { stageId: 'pr-c', scale: 0.5, duration: 700 }),
  travel('Paralyzing ray', ['energy_beam.normal.blue'], { stageId: 'pr-t', after: 'pr-c', anchor: 'start', offset: 300, duration: 1400, ...OPT }),
  impact('Limbs lock', ['markers.stun.dark_teal', 'markers.stun.purple'], { after: 'pr-t', anchor: 'arrival', duration: 1600, scale: 0.6, ...OPT }),
  motion('shake', 'targets', { after: 'pr-t', anchor: 'arrival', duration: 600, intensity: 0.3, ...OPT }),
], { sound: 'forceRay' });
const conceal = design('The ring fades from sight on the wearer\'s finger.', () => [
  aura('Ring fades', ['shimmer.01.blue'], { duration: 1200, scale: 0.4, opacity: 0.7 }),
], { sound: null, fx: false });

export default {
  'dnd5e:dnd5e-items-rhGulc3gEJhnuP31:gX0XMie1ghHlIWtH': daylight, // Helm of Brilliance [Daylight (opal)] (2014)
  'dnd5e:dnd5e-items-rhGulc3gEJhnuP31:jEyPsKTcQqBZODw6': fireball, // Helm of Brilliance [Fireball (fire opal)] (2014)
  'dnd5e:dnd5e-items-rhGulc3gEJhnuP31:RKy4bIoE7fJbhqhv': prismaticSpray, // Helm of Brilliance [Prismatic Spray (diamond)] (2014)
  'dnd5e:dnd5e-items-rhGulc3gEJhnuP31:vS32THDevDFcwjHQ': wallOfFire, // Helm of Brilliance [Wall of Fire (opal)] (2014)
  'dnd5e:dnd5e-equipment24-dmgHelmOfCompreh': comprehendLanguages, // Helm of Comprehending Languages (2024)
  'dnd5e:dnd5e-items-rY9sRFQp5CFSfsat': comprehendLanguages, // Helm of Comprehending Languages (2014)
  'dnd5e:dnd5e-equipment24-dmgHelmOfTelepat:UtT5lj94xD2gC7t7': detectThoughts, // Helm of Telepathy [cast] (2024)
  'dnd5e:dnd5e-equipment24-dmgHelmOfTelepat:KeNwSWKR7BsH8e9G': suggestion, // Helm of Telepathy [cast] (2024)
  'dnd5e:dnd5e-items-EJVaAvNfCq6gn6VG:ojwSZNV7dBmpFdcC': detectThoughts, // Helm of Telepathy [cast] (2014)
  'dnd5e:dnd5e-items-EJVaAvNfCq6gn6VG:HG9ikbJ7bHYwKcug': suggestion, // Helm of Telepathy [cast] (2014)
  'dnd5e:dnd5e-items-EJVaAvNfCq6gn6VG:0KtYlJxRLKoAwU8R': telepathicMessage, // Helm of Telepathy [Telepathic Message] (2014)
  'dnd5e:dnd5e-equipment24-dmgHelmOfTelepor': teleportShift, // Helm of Teleportation (2024)
  'dnd5e:dnd5e-items-DEQkJiQdGyfmSNkV': teleportShift, // Helm of Teleportation (2014)
  'dnd5e:dnd5e-items-oRrNK2H2vcN4Kp74:dnd5eactivity000': ropeBurst, // Hempen Rope (50 ft.) [check] (2014)
  'dnd5e:dnd5e-items-oRrNK2H2vcN4Kp74:dnd5eactivity100': effort, // Hempen Rope (50 ft.) [save] (2014)
  'dnd5e:dnd5e-items-U5fRz04JWgNS1WvK:dnd5eactivity000': ropeBurst, // Hempen Rope (50 ft.) [check] (2014)
  'dnd5e:dnd5e-items-U5fRz04JWgNS1WvK:dnd5eactivity100': effort, // Hempen Rope (50 ft.) [save] (2014)
  'dnd5e:dnd5e-items-bDZFQqLQE73cFB8c:dnd5eactivity000': ropeBurst, // Hempen Rope (50 ft.) [check] (2014)
  'dnd5e:dnd5e-items-bDZFQqLQE73cFB8c:dnd5eactivity100': effort, // Hempen Rope (50 ft.) [save] (2014)
  'dnd5e:dnd5e-items-QXmaarJ4X8P0C1HV': ropeBurst, // Hempen Rope (50 ft.) (2014)
  'dnd5e:dnd5e-equipment24-phbtulHerbalismK': herbalism, // Herbalism Kit (2024)
  'dnd5e:dnd5e-equipment24-dmgHiddenPit0000:jq9xOi9mBPGjGvZS': hiddenPit, // Hidden Pit [Trigger (1-4)] (2024)
  'dnd5e:dnd5e-equipment24-dmgHiddenPit0000:OdTFfnBTIf5pMuoe': hiddenPit, // Hidden Pit [Trigger (5-10)] (2024)
  'dnd5e:dnd5e-equipment24-dmgHiddenPit0000:eGupjGTVYHujyovg': hiddenPit, // Hidden Pit [Trigger (11-16)] (2024)
  'dnd5e:dnd5e-equipment24-dmgHiddenPit0000:QkEQfhEIHrwAqzBd': hiddenPit, // Hidden Pit [Trigger (17-20)] (2024)
  'dnd5e:dnd5e-equipment24-phbagHolyWater00': holyWater, // Holy Water (2024)
  'dnd5e:dnd5e-equipment24-nshr9PBVyB03T7wB': holyWater, // Holy Water (2024)
  'dnd5e:dnd5e-equipment24-DKYzehYrMUKiFDxt': lampLight, // Hooded Lantern (2024)
  'dnd5e:dnd5e-items-wjHtGnd05SPdURqE': lampLight, // Hooded Lantern (2014)
  'dnd5e:dnd5e-items-trmWAdUoR6Y2B7rA': lampLight, // Hooded Lantern (2014)
  'dnd5e:dnd5e-equipment24-dmgHornOfBlastin:FMTcQOb5MZKBohdN': hornBlast, // Horn of Blasting [Blow Horn] (2024)
  'dnd5e:dnd5e-equipment24-dmgHornOfBlastin:CohXMZ4aojCQTIpk': hornObject, // Horn of Blasting [Object Damage] (2024)
  'dnd5e:dnd5e-equipment24-dmgHornOfBlastin:FIPuYfZI5jKkVYYo': hornExplodeRoll, // Horn of Blasting [Roll for Explosion Chance] (2024)
  'dnd5e:dnd5e-equipment24-dmgHornOfBlastin:q8PShLHyh2ItXbkQ': hornExplosion, // Horn of Blasting [Explosion Damage] (2024)
  'dnd5e:dnd5e-items-t7GfyRp3dB3lqS9i:dnd5eactivity000': hornBlast, // Horn of Blasting [save] (2014)
  'dnd5e:dnd5e-items-t7GfyRp3dB3lqS9i:dnd5eactivity300': hornBlast, // Horn of Blasting [utility] (2014)
  'dnd5e:dnd5e-equipment24-dmgHornofValhall': hornValhalla, // Horn of Valhalla (2024)
  'dnd5e:dnd5e-equipment24-dmgHorseshoesOfA': horseshoesZephyr, // Horseshoes of a Zephyr (2024)
  'dnd5e:dnd5e-equipment24-dmgHorseshoesOfS': horseshoesSpeed, // Horseshoes of Speed (2024)
  'dnd5e:dnd5e-equipment24-phbagHuntingTrap:tIsE5Y5S9TjOTs9C': huntingTrap, // Hunting Trap [save] (2024)
  'dnd5e:dnd5e-equipment24-phbagHuntingTrap:JjJCLmn9qZmCzlxX': effort, // Hunting Trap [Escape] (2024)
  'dnd5e:dnd5e-items-LiOD83I4MIZlpoQQ:dnd5eactivity000': huntingTrap, // Hunting Trap [save] (2014)
  'dnd5e:dnd5e-items-LiOD83I4MIZlpoQQ:dnd5eactivity200': huntingTrap, // Hunting Trap [damage] (2014)
  'dnd5e:dnd5e-equipment24-dmgImmovableRod0:a9ZLyGvSKD1k33nC': immovableRod, // Immovable Rod [Make Immovable] (2024)
  'dnd5e:dnd5e-equipment24-dmgImmovableRod0:PweONVtDaHGqDRnZ': effort, // Immovable Rod [Attempt to Move] (2024)
  'dnd5e:dnd5e-items-eQNXan0zp279jDtk': immovableRod, // Immovable Rod (2014)
  'dnd5e:dnd5e-equipment24-dmgDaernsInstant:DByArwt2cHu1XB0F': instantFortress, // Instant Fortress [Grow Tower] (2024)
  'dnd5e:dnd5e-equipment24-dmgDaernsInstant:9iUaAGUtacDYwh0Q': quiet, // Instant Fortress [Open Fortress Door] (2024)
  'dnd5e:dnd5e-items-9stfX2i2I1YPo8vx': instantFortress, // Instant Fortress (2014)
  'dnd5e:dnd5e-equipment24-dmgAbsorptionIou': iounStone('The stone is tossed up and settles into orbit around the wearer\'s head, ready to absorb spells.', 'purple.absorption'), // Ioun Stone of Absorption (2024)
  'dnd5e:dnd5e-equipment24-dmgGreaterAbsorp': iounStone('The stone is tossed up and settles into orbit around the wearer\'s head, ready to absorb spells.', 'purple.great_absorption'), // Ioun Stone of Greater Absorption (2024)
  'dnd5e:dnd5e-equipment24-dmgRegnerationIo': iounStone('The orbiting stone of regeneration knits the wearer\'s wounds.', 'white.regeneration', true), // Ioun Stone of Regeneration (2024)
  'dnd5e:dnd5e-equipment24-dmgReserveIounSt': iounStone('The stone is tossed up and orbits the wearer\'s head, holding stored spells.', 'purple.reserve'), // Ioun Stone of Reserve (2024)
  'dnd5e:dnd5e-equipment24-dmgIronBandsOfBi:YvxUL75GlG2OoFMg': ironBands, // Iron Bands [Throw Bands] (2024)
  'dnd5e:dnd5e-equipment24-dmgIronBandsOfBi:2FSMsnJsj8zfMx85': strainBonds, // Iron Bands [Break Check] (2024)
  'dnd5e:dnd5e-items-E9G4jALlSA96fKAN': ironBands, // Iron Bands of Binding (2014)
  'dnd5e:dnd5e-equipment24-dmgIronFlask0000:UVei1X4pYM1VZDWv': ironFlaskTrap, // Iron Flask [Attempt to Trap Creature] (2024)
  'dnd5e:dnd5e-equipment24-dmgIronFlask0000:4FJGA5jQX1wjCADZ': ironFlaskRelease, // Iron Flask [Release Creature] (2024)
  'dnd5e:dnd5e-equipment24-dmgIronFlask0000:Jd5BGVg4MO1h2ZRl': quiet, // Iron Flask [Add Trapped Creature] (2024)
  'dnd5e:dnd5e-items-lvLrkAR7k8DS7J3W': ironFlaskTrap, // Iron Flask (2014)
  'dnd5e:dnd5e-equipment24-dmgIronHornOfVal': hornValhalla, // Iron Horn of Valhalla (2024)
  'dnd5e:dnd5e-items-qVuZznv0MnIjDU70': hornValhalla, // Iron Horn of Valhalla (2014)
  'dnd5e:dnd5e-items-RiOeHR2qaYktz5Ys': spikeHammer, // Iron Spike (2014)
  'dnd5e:dnd5e-equipment24-dmgFwpIvoryGoats:hDc2bhCP7qL52Z1J': goatTerror, // Ivory Goats [Goat of Terror] (2024)
  'dnd5e:dnd5e-equipment24-dmgFwpIvoryGoats:G771YStNNwTixstV': figurine('The ivory goat swells into a living giant goat.'), // Ivory Goats [Goat of Traveling] (2024)
  'dnd5e:dnd5e-equipment24-dmgFwpIvoryGoats:5g8tPLkudHb2kfkt': quiet, // Ivory Goats [Revert or Recall Goat of Traveling] (2024)
  'dnd5e:dnd5e-equipment24-dmgFwpIvoryGoats:KguY9D4cU0ognpu4': figurine('The ivory goat swells into a living giant goat.'), // Ivory Goats [Goat of Travail] (2024)
  'dnd5e:dnd5e-equipment24-SMj5QHHkDCdvkx35': lampLight, // Lamp (2024)
  'dnd5e:dnd5e-equipment24-phbagLamp0000000': lampLight, // Lamp (2024)
  'dnd5e:dnd5e-equipment24-KUlBAAjJ9KmOCSsC': lampLight, // Lamp (2024)
  'dnd5e:dnd5e-equipment24-Ekz3r0UKJ261oBJj': lampLight, // Lamp (2024)
  'dnd5e:dnd5e-items-vmymwrmE730l3pKh': lampLight, // Lamp (2014)
  'dnd5e:dnd5e-items-qMzHmlmha8qMDnEF': lampLight, // Lamp (2014)
  'dnd5e:dnd5e-equipment24-dmgLanternOfReve': lanternRevealing, // Lantern of Revealing (2024)
  'dnd5e:dnd5e-items-7FLs8qIGdOFnz9oL': lanternRevealingSelf, // Lantern of Revealing (2014)
  'dnd5e:dnd5e-equipment24-phbagLanternBull': bullseye, // Lantern, Bullseye (2024)
  'dnd5e:dnd5e-equipment24-phbagLanternHood': lampLight, // Lantern, Hooded (2024)
  'dnd5e:dnd5e-equipment24-phbtulLeatherwor': toolWork, // Leatherworker's Tools (2024)
  'dnd5e:dnd5e-items-xwUWrV15s9jLnmfZ:dnd5eactivity000': toolWork, // Lock [check] (2014)
  'dnd5e:dnd5e-items-xwUWrV15s9jLnmfZ:dnd5eactivity100': toolWork, // Lock [save] (2014)
  'dnd5e:dnd5e-equipment24-dmgMalice0000000': poisonInhaled, // Malice (2024)
  'dnd5e:dnd5e-equipment24-phbagManacles000:LPW3NsIFCn3pYMjY': manaclesBind, // Manacles [Bind] (2024)
  'dnd5e:dnd5e-equipment24-phbagManacles000:IpcLYRMUOUk7dKpE': strainBonds, // Manacles [Escape Check] (2024)
  'dnd5e:dnd5e-equipment24-phbagManacles000:HStudlka63uekHM2': strainBonds, // Manacles [Burst Check] (2024)
  'dnd5e:dnd5e-items-tWJLHIL6ZIZUez9k:dnd5eactivity000': strainBonds, // Manacles [Attempt Escape] (2014)
  'dnd5e:dnd5e-items-tWJLHIL6ZIZUez9k:9DosjAvEYAW0LLK8': strainBonds, // Manacles [Attempt to Break] (2014)
  'dnd5e:dnd5e-items-tWJLHIL6ZIZUez9k:9IBcoj8ChH1OiDT8': strainBonds, // Manacles [Attempt to Pick] (2014)
  'dnd5e:dnd5e-equipment24-dmgManualOfBodil:L5OnUjZIn27NHd2E': manualHealth, // Manual of Bodily Health [Read] (2024)
  'dnd5e:dnd5e-equipment24-dmgManualOfBodil:AtSTn7SENNBRbKlL': quiet, // Manual of Bodily Health [Reset Progress] (2024)
  'dnd5e:dnd5e-items-BjyTJn9oGvURWKJR': manualHealth, // Manual of Bodily Health (2014)
  'dnd5e:dnd5e-equipment24-dmgManualOfGainf:QoMjlu00wQebXPDg': manualExercise, // Manual of Gainful Exercise [Read] (2024)
  'dnd5e:dnd5e-equipment24-dmgManualOfGainf:HGqt36FRfkZiaj1w': quiet, // Manual of Gainful Exercise [Reset Progress] (2024)
  'dnd5e:dnd5e-items-ykefWXBjq3y6y9Se': manualExercise, // Manual of Gainful Exercise (2014)
  'dnd5e:dnd5e-items-UxkP6FvDzPbsIY6o': psychicBacklash, // Manual of Golems (2014)
  'dnd5e:dnd5e-equipment24-dmgManualOfQuick:MeBH48FuUmQFEhUM': manualQuickness, // Manual of Quickness of Action [Read] (2024)
  'dnd5e:dnd5e-equipment24-dmgManualOfQuick:k3pTw9xOeWpnBuWi': quiet, // Manual of Quickness of Action [Reset Progress] (2024)
  'dnd5e:dnd5e-items-Q4jmng3i9Lb2nL5F': manualQuickness, // Manual of Quickness of Action (2014)
  'dnd5e:dnd5e-equipment24-dmgFwpMarbleElep': marbleElephant, // Marble Elephant (2024)
  'dnd5e:dnd5e-equipment24-dmgNolzursMarvel:yoPyCsTjtbJ8kmRK': quiet, // Marvelous Pigments [Determine Number of Pots] (2024)
  'dnd5e:dnd5e-equipment24-dmgMedallionOfTh': detectThoughts, // Medallion of Thoughts (2024)
  'dnd5e:dnd5e-items-skoUe223EvRYGPL6': detectThoughts, // Medallion of Thoughts (2014)
  'dnd5e:dnd5e-equipment24-dmgMidnightTears': poisonIngested, // Midnight Tears (2024)
  'dnd5e:dnd5e-equipment24-dmgMirrorOfLifeT:LBblEPSD08p00pe2': mirrorTrap, // Mirror of Life Trapping [save] (2024)
  'dnd5e:dnd5e-equipment24-dmgMirrorOfLifeT:7Gg3wdYSJRWDNIOH': quiet, // Mirror of Life Trapping [Add Trapped Creature] (2024)
  'dnd5e:dnd5e-equipment24-dmgMirrorOfLifeT:spCmQeov51Eu4Edi': mirrorRelease, // Mirror of Life Trapping [Free Trapped Creature] (2024)
  'dnd5e:dnd5e-items-hf5j1meGsA33HkUj': mirrorTrap, // Mirror of Life Trapping (2014)
  'dnd5e:dnd5e-equipment24-dmgMithralArmor0': mithral, // Mithral Armor (2024)
  'dnd5e:dnd5e-equipment24-dmgDmtMoon000000': wish, // Moon (2024)
  'dnd5e:dnd5e-equipment24-dmgDeckOfManyThi:kX6QeM68hTgCv7do': quiet, // Mysterious Deck [Check Deck Size] (2024)
  'dnd5e:dnd5e-equipment24-dmgDeckOfManyThi:z74JXEy5r4T6cBUA': deckDraw, // Mysterious Deck [Draw Cards] (2024)
  'dnd5e:dnd5e-equipment24-phbtulNavigators:tbXPqxy6Ukm9WnSs': toolWork, // Navigator's Tools [Plot a Course] (2024)
  'dnd5e:dnd5e-equipment24-phbtulNavigators:TPOgnShxoZdAsFXc': stargazing, // Navigator's Tools [Determine Position by Stargazing] (2024)
  'dnd5e:dnd5e-equipment24-dmgNecklaceOfFir:EhXO2nrkALoZagWG': quiet, // Necklace of Fireballs [Determine Number of Beads] (2024)
  'dnd5e:dnd5e-equipment24-dmgNecklaceOfFir:v2sP2OkYkHfhR8hu': fireballBead, // Necklace of Fireballs [Throw Bead] (2024)
  'dnd5e:dnd5e-items-3ALOhh6JNInIK4o7': fireballBead, // Necklace of Fireballs (2014)
  'dnd5e:dnd5e-equipment24-dmgNecklaceOfPra:SEwmmaZFABa5L61F': bless, // Necklace of Prayer Beads [cast] (2024)
  'dnd5e:dnd5e-equipment24-dmgNecklaceOfPra:i1xNzPeIb7VkHrh6': cureWounds, // Necklace of Prayer Beads [cast] (2024)
  'dnd5e:dnd5e-equipment24-dmgNecklaceOfPra:yiGuTjneUv0F9NnC': restoration, // Necklace of Prayer Beads [cast] (2024)
  'dnd5e:dnd5e-equipment24-dmgNecklaceOfPra:xjMwMrJpNfh3HZyP': smite, // Necklace of Prayer Beads [cast] (2024)
  'dnd5e:dnd5e-equipment24-dmgNecklaceOfPra:FGwlSZAUgTaknnt1': guardianOfFaith, // Necklace of Prayer Beads [cast] (2024)
  'dnd5e:dnd5e-equipment24-dmgNecklaceOfPra:VBwVZg8g1vPZ1xep': windWalk, // Necklace of Prayer Beads [cast] (2024)
  'dnd5e:dnd5e-items-wqVSRfkcTjuhvDyx:JEZSgGmMUnJjLZnY': bless, // Necklace of Prayer Beads [Bead of Blessing (bless)] (2014)
  'dnd5e:dnd5e-items-wqVSRfkcTjuhvDyx:N52T1PHwMzYlRrd9': cureWounds, // Necklace of Prayer Beads [Bead of Curing (cure wounds)] (2014)
  'dnd5e:dnd5e-items-wqVSRfkcTjuhvDyx:elE3WRvgeS74pI8C': restoration, // Necklace of Prayer Beads [Bead of Curing (lesser restoration)] (2014)
  'dnd5e:dnd5e-items-wqVSRfkcTjuhvDyx:Cgqj8eZR8ZiKtnsS': restoration, // Necklace of Prayer Beads [Bead of Favor (greater restoration)] (2014)
  'dnd5e:dnd5e-items-wqVSRfkcTjuhvDyx:PQtYreEqxAhDUIWZ': smite, // Necklace of Prayer Beads [Bead of Smiting (branding smite)] (2014)
  'dnd5e:dnd5e-items-wqVSRfkcTjuhvDyx:6F2HhcDk94H0kGqV': planarAlly, // Necklace of Prayer Beads [Bead of Summons (planar ally)] (2014)
  'dnd5e:dnd5e-items-wqVSRfkcTjuhvDyx:zqkOXnnqsBvQTS9v': windWalk, // Necklace of Prayer Beads [Bead of Wind Walking (wind walk)] (2014)
  'dnd5e:dnd5e-equipment24-dmgFwpObsidianSt': obsidianSteed, // Obsidian Steed (2024)
  'dnd5e:dnd5e-equipment24-JpE7eqjwXw95Sai5:FoeoumkYcnAsGCRo': oilThrow, // Oil [Throw] (2024)
  'dnd5e:dnd5e-equipment24-JpE7eqjwXw95Sai5:mDj3jtAY6ICmi1ZL': oilDouse, // Oil [Douse Space] (2024)
  'dnd5e:dnd5e-equipment24-8dJcpxveaFEzjK5C:FoeoumkYcnAsGCRo': oilThrow, // Oil [Throw] (2024)
  'dnd5e:dnd5e-equipment24-8dJcpxveaFEzjK5C:mDj3jtAY6ICmi1ZL': oilDouse, // Oil [Douse Space] (2024)
  'dnd5e:dnd5e-equipment24-q6nVEb4XnTWxqA81:FoeoumkYcnAsGCRo': oilThrow, // Oil [Throw] (2024)
  'dnd5e:dnd5e-equipment24-q6nVEb4XnTWxqA81:mDj3jtAY6ICmi1ZL': oilDouse, // Oil [Douse Space] (2024)
  'dnd5e:dnd5e-equipment24-rwITntQ6OAy0neX8:FoeoumkYcnAsGCRo': oilThrow, // Oil [Throw] (2024)
  'dnd5e:dnd5e-equipment24-rwITntQ6OAy0neX8:mDj3jtAY6ICmi1ZL': oilDouse, // Oil [Douse Space] (2024)
  'dnd5e:dnd5e-equipment24-VczW1tStT5y7No3b:FoeoumkYcnAsGCRo': oilThrow, // Oil [Throw] (2024)
  'dnd5e:dnd5e-equipment24-VczW1tStT5y7No3b:mDj3jtAY6ICmi1ZL': oilDouse, // Oil [Douse Space] (2024)
  'dnd5e:dnd5e-equipment24-phbagOil00000000:FoeoumkYcnAsGCRo': oilThrow, // Oil [Throw] (2024)
  'dnd5e:dnd5e-equipment24-phbagOil00000000:mDj3jtAY6ICmi1ZL': oilDouse, // Oil [Douse Space] (2024)
  'dnd5e:dnd5e-equipment24-Ur2LYFqSdOgeWWF0:FoeoumkYcnAsGCRo': oilThrow, // Oil [Throw] (2024)
  'dnd5e:dnd5e-equipment24-Ur2LYFqSdOgeWWF0:mDj3jtAY6ICmi1ZL': oilDouse, // Oil [Douse Space] (2024)
  'dnd5e:dnd5e-items-jDTM1RjtZMu9YYL9': oilFlaskFire, // Oil Flask (2014)
  'dnd5e:dnd5e-items-j01YDOu2AolsRvdN': oilFlaskFire, // Oil Flask (2014)
  'dnd5e:dnd5e-items-psoZaItkOScMVaHL': oilFlaskFire, // Oil Flask (2014)
  'dnd5e:dnd5e-equipment24-dmgOilOfEthereal': etherealness, // Oil of Etherealness (2024)
  'dnd5e:dnd5e-items-Xbq8CyXSRV358SfP': etherealness, // Oil of Etherealness (2014)
  'dnd5e:dnd5e-equipment24-dmgOilOfSharpnes:qobONpalBAZbVnNS': sharpness, // Oil of Sharpness [Apply Oil to Weapon] (2024)
  'dnd5e:dnd5e-equipment24-dmgOilOfSharpnes:MVRpUqiBnbDX0snB': sharpness, // Oil of Sharpness [Apply Oil to Ammunition] (2024)
  'dnd5e:dnd5e-items-C0MNXWA81ufzGlp5:cT06cj9LC81wNski': sharpness, // Oil of Sharpness [Apply Oil to Weapon] (2014)
  'dnd5e:dnd5e-items-C0MNXWA81ufzGlp5:Wa0cWtddVr7eTGOz': sharpness, // Oil of Sharpness [Apply Oil to Ammunition] (2014)
  'dnd5e:dnd5e-equipment24-dmgOilOfSlipperi:dgp4czAiBiwgDJ2X': slipperyCoat, // Oil of Slipperiness [Cover Creature] (2024)
  'dnd5e:dnd5e-equipment24-dmgOilOfSlipperi:IQsAg45adQPcbS86': greaseSelf, // Oil of Slipperiness [Pour on Ground] (2024)
  'dnd5e:dnd5e-items-FIDyR0kZnxGy7bj8:OMSMC85UR5All9Vz': slipperyCoat, // Oil of Slipperiness [Apply Oil] (2014)
  'dnd5e:dnd5e-items-FIDyR0kZnxGy7bj8:OCcBVLFoBjsgBp2r': grease, // Oil of Slipperiness [Pour Oil Out] (2014)
  'dnd5e:dnd5e-equipment24-dmgOilOfTaggit00': poisonUnconscious, // Oil of Taggit (2024)
  'dnd5e:dnd5e-equipment24-dmgFwpOnyxDogRar': onyxDog, // Onyx Dog (2024)
  'dnd5e:dnd5e-items-1RwJWOAeyoideLKe:dnd5eactivity000': dragonOrb, // Orb of Dragonkind [utility] (2014)
  'dnd5e:dnd5e-items-1RwJWOAeyoideLKe:dnd5eactivity100': dragonOrbWill, // Orb of Dragonkind [save] (2014)
  'dnd5e:dnd5e-equipment24-dmgPaleTincture0': poisonIngested, // Pale Tincture (2024)
  'dnd5e:dnd5e-equipment24-dmgPearlOfPower0': pearlOfPower, // Pearl of Power (2024)
  'dnd5e:dnd5e-items-44XNWmMGnwXn7bNW': pearlOfPower, // Pearl of Power (2014)
  'dnd5e:dnd5e-equipment24-dmgPhilterOfLove': philter, // Philter of Love (2024)
  'dnd5e:dnd5e-items-63nb14yQRJMc4bIn': philter, // Philter of Love (2014)
  'dnd5e:dnd5e-equipment24-dmgPipesOfHaunti': pipesHaunting, // Pipes of Haunting (2024)
  'dnd5e:dnd5e-items-oNLfJNRQgUHpU8c7': pipesHauntingSelf, // Pipes of Haunting (2014)
  'dnd5e:dnd5e-equipment24-dmgPipesOfTheSew:NTO2u1o5isZNoZol': pipesRats, // Pipes of the Sewers [Call Swarm of Rats] (2024)
  'dnd5e:dnd5e-equipment24-dmgPipesOfTheSew:eODd7jfqxrFREsrY': pipesSway, // Pipes of the Sewers [Sway Rats] (2024)
  'dnd5e:dnd5e-items-nvhk1quD0Dg1ZtSH:dnd5eactivity000': pipesSway, // Pipes of the Sewers [check] (2014)
  'dnd5e:dnd5e-items-nvhk1quD0Dg1ZtSH:dnd5eactivity100': pipesSway, // Pipes of the Sewers [save] (2014)
  'dnd5e:dnd5e-items-P31t6tGgt9aLAdYt': spikeHammer, // Piton (2014)
  'dnd5e:dnd5e-items-wmedRPNenLVSUaT5': spikeHammer, // Piton (2014)
  'dnd5e:dnd5e-items-TqyvIglHDj5kfohR': spikeHammer, // Piton (2014)
  'dnd5e:dnd5e-equipment24-dmgPlateArmorOfE:4dRHNHbVFlWq34Ow': etherealness, // Plate Armor of Etherealness [cast] (2024)
  'dnd5e:dnd5e-equipment24-dmgPlateArmorOfE:ETp0AleqjJT1ZtPZ': mithral, // Plate Armor of Etherealness [Plate Armor of Etherealness] (2024)
  'dnd5e:dnd5e-items-dJjdWdaZU30r1zx4': etherealness, // Plate Armor of Etherealness (2014)
  'dnd5e:dnd5e-equipment24-phbgstPlayingcar:X7yHLXqHjM0kC0Jw': toolWork, // Playing Cards [Catch Cheating] (2024)
  'dnd5e:dnd5e-equipment24-phbgstPlayingcar:el0b7gglRR0etmB0': toolWork, // Playing Cards [Play to Win] (2024)
  'dnd5e:dnd5e-equipment24-phbagPoisonBasic': coatWeapon, // Poison, Basic (2024)
  'dnd5e:dnd5e-equipment24-dmgPoisonedDarts:RvICMGIB0eFj7glp': poisonDarts, // Poisoned Darts [Trigger (1-4)] (2024)
  'dnd5e:dnd5e-equipment24-dmgPoisonedDarts:MSTCr3QSYGyolvAe': poisonDarts, // Poisoned Darts [Trigger (5-10)] (2024)
  'dnd5e:dnd5e-equipment24-dmgPoisonedDarts:dmaXYLZqje000jxt': poisonDarts, // Poisoned Darts [Trigger (11-16)] (2024)
  'dnd5e:dnd5e-equipment24-dmgPoisonedDarts:NDPRYh9wNKYZuDbL': poisonDarts, // Poisoned Darts [Trigger (17-20)] (2024)
  'dnd5e:dnd5e-equipment24-dmgPoisonedNeedl:cClVGymHxg8fqkCu': poisonNeedle, // Poisoned Needle [Trigger (1-4)] (2024)
  'dnd5e:dnd5e-equipment24-dmgPoisonedNeedl:sCOyeTxHTLXgFU70': poisonNeedle, // Poisoned Needle [Trigger (5-10)] (2024)
  'dnd5e:dnd5e-equipment24-dmgPoisonedNeedl:P2SZTZG5uTqSmZKn': poisonNeedle, // Poisoned Needle [Trigger (11-16)] (2024)
  'dnd5e:dnd5e-equipment24-dmgPoisonedNeedl:75RnwBhPYT8xU06M': poisonNeedle, // Poisoned Needle [Trigger (17-20)] (2024)
  'dnd5e:dnd5e-equipment24-dmgPortableHole0:ijstCapAvHeMYnZf': portableHole, // Portable Hole [Unfold Portable Hole] (2024)
  'dnd5e:dnd5e-equipment24-dmgPortableHole0:rOLpsFh6iEEG5o2n': effort, // Portable Hole [Escape Check] (2024)
  'dnd5e:dnd5e-items-rvxGvcUzoQXVNbAu:dnd5eactivity000': effort, // Portable Hole [check] (2014)
  'dnd5e:dnd5e-items-rvxGvcUzoQXVNbAu:dnd5eactivity100': portableHole, // Portable Hole [save] (2014)
  'dnd5e:dnd5e-items-srTRzwTfWKO5opOo': portableRam, // Portable Ram (2014)
  'dnd5e:dnd5e-items-zgZkJAyFAfYmyn11': resistAcid, // Potion of Acid Resistance (2014)
  'dnd5e:dnd5e-equipment24-dmgPotionOfAnima': animalFriendship, // Potion of Animal Friendship (2024)
  'dnd5e:dnd5e-items-nXWevqtV6p484N59': animalFriendship, // Potion of Animal Friendship (2014)
  'dnd5e:dnd5e-equipment24-dmgPotionOfClair': clairvoyance, // Potion of Clairvoyance (2024)
  'dnd5e:dnd5e-items-bAyr7j5Peq9wIJTa': clairvoyance, // Potion of Clairvoyance (2014)
  'dnd5e:dnd5e-equipment24-dmgPotionOfClimb': climbing, // Potion of Climbing (2024)
  'dnd5e:dnd5e-items-aMnWi1WXWpxRHq4r': climbing, // Potion of Climbing (2014)
  'dnd5e:dnd5e-items-lAcTZgNtpmks2Mo5': giantCloud, // Potion of Cloud Giant Strength (2014)
  'dnd5e:dnd5e-items-34YKlIJVVWLeBv7R': resistCold, // Potion of Cold Resistance (2014)
  'dnd5e:dnd5e-equipment24-dmgPotionOfDimin': reduce, // Potion of Diminution (2024)
  'dnd5e:dnd5e-items-HY8duCwmvlXOruTG': reduce, // Potion of Diminution (2014)
  'dnd5e:dnd5e-items-bEZOY6uvHRweMM56': giantFire, // Potion of Fire Giant Strength (2014)
  'dnd5e:dnd5e-items-Jj4iFQQGvckx8Wsj': resistFire, // Potion of Fire Resistance (2014)
  'dnd5e:dnd5e-equipment24-dmgPotionOfFlyin': flying, // Potion of Flying (2024)
  'dnd5e:dnd5e-items-eTNc8XPtvZNe3yQs': flying, // Potion of Flying (2014)
  'dnd5e:dnd5e-items-kKGJjVVlJVoakWgQ': resistForce, // Potion of Force Resistance (2014)
  'dnd5e:dnd5e-items-TevMHicE3A70AlmP': giantFrost, // Potion of Frost Giant Strength (2014)
  'dnd5e:dnd5e-equipment24-dmgPotionOfGaseo': gaseousForm, // Potion of Gaseous Form (2024)
  'dnd5e:dnd5e-items-bqZ6NTLDCUB98YjV': gaseousForm, // Potion of Gaseous Form (2014)
  'dnd5e:dnd5e-equipment24-dmgCloudPotionOf': giantCloud, // Potion of Giant Strength (Cloud) (2024)
  'dnd5e:dnd5e-equipment24-dmgFirePotionOfG': giantFire, // Potion of Giant Strength (Fire) (2024)
  'dnd5e:dnd5e-equipment24-dmgFrostPotionOf': giantFrost, // Potion of Giant Strength (Frost) (2024)
  'dnd5e:dnd5e-equipment24-dmgHillPotionOfG': giantHill, // Potion of Giant Strength (Hill) (2024)
  'dnd5e:dnd5e-equipment24-dmgStonePotionOf': giantStone, // Potion of Giant Strength (Stone) (2024)
  'dnd5e:dnd5e-equipment24-dmgStormPotionOf': giantStorm, // Potion of Giant Strength (Storm) (2024)
  'dnd5e:dnd5e-equipment24-dmgPotionOfGrowt': enlarge, // Potion of Growth (2024)
  'dnd5e:dnd5e-items-gTRFQLdVD1gsKtPi': enlarge, // Potion of Growth (2014)
  'dnd5e:dnd5e-equipment24-dmgPotionOfHeroi': heroism, // Potion of Heroism (2024)
  'dnd5e:dnd5e-items-wNKYbKYwOHbA7SH8': heroism, // Potion of Heroism (2014)
  'dnd5e:dnd5e-items-mhFBTY0egW8AeCHe': giantHill, // Potion of Hill Giant Strength (2014)
  'dnd5e:dnd5e-equipment24-dmgPotionOfInvis': invisibility, // Potion of Invisibility (2024)
  'dnd5e:dnd5e-items-rTn4p9nJr4Aq2GPB': invisibility, // Potion of Invisibility (2014)
  'dnd5e:dnd5e-equipment24-dmgPotionOfInvul': invulnerability, // Potion of Invulnerability (2024)
  'dnd5e:dnd5e-items-8MPnSrvEeZhPhtTi': resistLightning, // Potion of Lightning Resistance (2014)
  'dnd5e:dnd5e-equipment24-dmgPotionOfLonge': longevity, // Potion of Longevity (2024)
  'dnd5e:dnd5e-equipment24-dmgPotionOfMindR': detectThoughts, // Potion of Mind Reading (2024)
  'dnd5e:dnd5e-items-Ct9LR9Ft1FG4a6Y1': detectThoughts, // Potion of Mind Reading (2014)
  'dnd5e:dnd5e-items-xw99pcqPBVwtMOLw': resistNecrotic, // Potion of Necrotic Resistance (2014)
  'dnd5e:dnd5e-equipment24-dmgPotionOfPoiso': potionOfPoison, // Potion of Poison (2024)
  'dnd5e:dnd5e-items-qBSEGJyHxdKIlBfj:dnd5eactivity000': potionOfPoison, // Potion of Poison [save] (2014)
  'dnd5e:dnd5e-items-qBSEGJyHxdKIlBfj:baqKYeBxT4UMih4u': potionOfPoison, // Potion of Poison [damage] (2014)
  'dnd5e:dnd5e-items-f5chGcpQCi1HYPQw': resistPoison, // Potion of Poison Resistance (2014)
  'dnd5e:dnd5e-items-c0luemOP0iW8L23R': resistPsychic, // Potion of Psychic Resistance (2014)
  'dnd5e:dnd5e-items-LBQWNqX6hZOKhQ8a': resistRadiant, // Potion of Radiant Resistance (2014)
  'dnd5e:dnd5e-equipment24-dmgPotionOfSpeed': haste, // Potion of Speed (2024)
  'dnd5e:dnd5e-items-ctKfjHjk9gs9UtZI': haste, // Potion of Speed (2014)
  'dnd5e:dnd5e-items-4ZiJsDTRA1GgcWKP': giantStone, // Potion of Stone Giant Strength (2014)
  'dnd5e:dnd5e-items-1KMSpOSU0EliUBm2': giantStorm, // Potion of Storm Giant Strength (2014)
  'dnd5e:dnd5e-items-zBX8LLC2CjC89Dzl': resistThunder, // Potion of Thunder Resistance (2014)
  'dnd5e:dnd5e-equipment24-dmgPotionOfVital': vitality, // Potion of Vitality (2024)
  'dnd5e:dnd5e-equipment24-phbtulPottersToo': toolWork, // Potter's Tools (2024)
  'dnd5e:dnd5e-equipment24-dmgPurpleWormPoi': poisonInjury, // Purple Worm Poison (2024)
  'dnd5e:dnd5e-equipment24-phbagRations0000': mundane, // Rations (2024)
  'dnd5e:dnd5e-items-JwJf6M6HCSSMgKx3': mundane, // Rations (2014)
  'dnd5e:dnd5e-items-8d95YV1jHcxPygJ9': mundane, // Rations (2014)
  'dnd5e:dnd5e-items-YM4QueTsF3DL77mH': mundane, // Rations (2014)
  'dnd5e:dnd5e-items-P5UuhUBZL59wZiCY': mundane, // Rations (2014)
  'dnd5e:dnd5e-items-EC6ugXsfJZmjMNAj': mundane, // Rations (2014)
  'dnd5e:dnd5e-items-f4w4GxBi0nYXmhX4': mundane, // Rations (2014)
  'dnd5e:dnd5e-items-XZWHQ20ynJBK6xmU:bHxilWVcS6pXWF14': dominate, // Ring of Air Elemental Command [cast] (2014)
  'dnd5e:dnd5e-items-XZWHQ20ynJBK6xmU:N5oNPgMOhNHD8tPw': chainLightning, // Ring of Air Elemental Command [cast] (2014)
  'dnd5e:dnd5e-items-XZWHQ20ynJBK6xmU:EYXcYiN0xI0cNnfD': gustOfWind, // Ring of Air Elemental Command [cast] (2014)
  'dnd5e:dnd5e-items-XZWHQ20ynJBK6xmU:TPa1m5E6TgXJLysw': windWall, // Ring of Air Elemental Command [cast] (2014)
  'dnd5e:dnd5e-equipment24-dmgRingOfAnimalI:Y0cSjJs5olZWdSgZ': animalFriendship, // Ring of Animal Influence [cast] (2024)
  'dnd5e:dnd5e-equipment24-dmgRingOfAnimalI:kn4eCuLZrcps7ujc': fearSpell, // Ring of Animal Influence [Fear (Affects Beasts Only)] (2024)
  'dnd5e:dnd5e-equipment24-dmgRingOfAnimalI:76ZGwAp8abm0ZB5Z': speakAnimals, // Ring of Animal Influence [cast] (2024)
  'dnd5e:dnd5e-items-ElLfmohtIFMagr5f:pC9sdScwAtSLIx3a': animalFriendship, // Ring of Animal Influence [cast] (2014)
  'dnd5e:dnd5e-items-ElLfmohtIFMagr5f:3Ag2tI8TAhvtGP7V': fearSpell, // Ring of Animal Influence [cast] (2014)
  'dnd5e:dnd5e-items-ElLfmohtIFMagr5f:0zewU222OCtjpOty': speakAnimals, // Ring of Animal Influence [cast] (2014)
  'dnd5e:dnd5e-items-Zf7kBZa5f4WBepn1:2BmS0duA6cOAkzUW': dominate, // Ring of Earth Elemental Command [cast] (2014)
  'dnd5e:dnd5e-items-Zf7kBZa5f4WBepn1:d8GlId9yzDbJHrS7': stoneShape, // Ring of Earth Elemental Command [cast] (2014)
  'dnd5e:dnd5e-items-Zf7kBZa5f4WBepn1:lsp1CkHeT5EWo09F': stoneskin, // Ring of Earth Elemental Command [cast] (2014)
  'dnd5e:dnd5e-items-Zf7kBZa5f4WBepn1:KEqwUW6z1Hk9CyB2': wallOfStone, // Ring of Earth Elemental Command [cast] (2014)
  'dnd5e:dnd5e-equipment24-dmgRingOfEvasion': evasion, // Ring of Evasion (2024)
  'dnd5e:dnd5e-items-2wxqnjpnPmkpPCC5': evasion, // Ring of Evasion (2014)
  'dnd5e:dnd5e-items-L9KBLub5vfb3mTDz:dxaE4B2S9PJ692hU': dominate, // Ring of Fire Elemental Command [cast] (2014)
  'dnd5e:dnd5e-items-L9KBLub5vfb3mTDz:rWInlhCUYFV0xFpU': burningHands, // Ring of Fire Elemental Command [cast] (2014)
  'dnd5e:dnd5e-items-L9KBLub5vfb3mTDz:MWSaqDybpLBn8R9V': fireball, // Ring of Fire Elemental Command [cast] (2014)
  'dnd5e:dnd5e-items-L9KBLub5vfb3mTDz:Favmm3fyHI1GTOcN': wallOfFire, // Ring of Fire Elemental Command [cast] (2014)
  'dnd5e:dnd5e-items-1J0dsxyKRhVXYQf5': invisibility, // Ring of Invisibility (2014)
  'dnd5e:dnd5e-items-dGnkwePemh7ovuDv': conceal, // Ring of Mind Shielding (2014)
  'dnd5e:dnd5e-equipment24-dmgRingOfShootin:745v4uo4m3ghldT9': faerieFire, // Ring of Shooting Stars [cast] (2024)
  'dnd5e:dnd5e-equipment24-dmgRingOfShootin:sZwpvVE0OpUNXe2B': lightningSpheres, // Ring of Shooting Stars [Create Lightning Spheres] (2024)
  'dnd5e:dnd5e-equipment24-dmgRingOfShootin:GLyk6XaqTk5JOVQ8': sphereZap, // Ring of Shooting Stars [Lightning Sphere Save] (2024)
  'dnd5e:dnd5e-equipment24-dmgRingOfShootin:4ZI0cvhpjWiYg9i4': shootingStars('A mote of light streaks down from the ring and bursts in a shower of radiant sparks.', ['explosion.03.yellow', 'explosion.03.blueyellow'], 'radiantRay'), // Ring of Shooting Stars [Shooting Stars] (2024)
  'dnd5e:dnd5e-items-etA2SBgWwduCLgLT:dnd5eactivity000': shootingStars('A fiery mote streaks down from the ring and bursts into flame.', ['explosion.01.orange'], 'fireball'), // Ring of Shooting Stars [Shooting Star] (2014)
  'dnd5e:dnd5e-items-etA2SBgWwduCLgLT:BmdTWkjcU0ZkyCLr': dancingLights, // Ring of Shooting Stars [cast] (2014)
  'dnd5e:dnd5e-items-etA2SBgWwduCLgLT:vbdZ39RG4LdxLH0a': lightCantrip, // Ring of Shooting Stars [cast] (2014)
  'dnd5e:dnd5e-items-etA2SBgWwduCLgLT:TkKZyzTSjdDD6a8i': faerieFire, // Ring of Shooting Stars [cast] (2014)
  'dnd5e:dnd5e-equipment24-dmgRingOfSpellTu': spellTurning, // Ring of Spell Turning (2024)
  'dnd5e:dnd5e-equipment24-dmgRingOfTelekin': telekinesis, // Ring of Telekinesis (2024)
  'dnd5e:dnd5e-items-hxfOtvFrY1PXHQN1': telekinesis, // Ring of Telekinesis (2014)
  'dnd5e:dnd5e-equipment24-dmgRingOfTheRam0:nzg8lY3B6i5cGid9': ramAttack, // Ring of the Ram [attack] (2024)
  'dnd5e:dnd5e-equipment24-dmgRingOfTheRam0:tHMfH0m2E10QKCzV': ramBreak, // Ring of the Ram [Break Item] (2024)
  'dnd5e:dnd5e-items-qw05Om9XWqTMoio2:dnd5eactivity000': ramAttack, // Ring of the Ram [attack] (2014)
  'dnd5e:dnd5e-items-qw05Om9XWqTMoio2:dnd5eactivity300': ramBreak, // Ring of the Ram [Break Object] (2014)
  'dnd5e:dnd5e-equipment24-dmgRingOfThreeWi': wish, // Ring of Three Wishes (2024)
  'dnd5e:dnd5e-items-ewXgnWiYQhS8KArS': wish, // Ring of Three Wishes (2014)
  'dnd5e:dnd5e-items-HnIERWmmra74hSCw:UXQJwXpxp8Jg9y5Y': dominate, // Ring of Water Elemental Command [cast] (2014)
  'dnd5e:dnd5e-items-HnIERWmmra74hSCw:5dYgpmrfsu4gThpP': createWater, // Ring of Water Elemental Command [cast] (2014)
  'dnd5e:dnd5e-items-HnIERWmmra74hSCw:x44Euvr98lcnkosn': controlWater, // Ring of Water Elemental Command [cast] (2014)
  'dnd5e:dnd5e-items-HnIERWmmra74hSCw:rrDO95DYgnJAMlkX': iceStorm, // Ring of Water Elemental Command [cast] (2014)
  'dnd5e:dnd5e-items-HnIERWmmra74hSCw:RMqCV3LnQUBLFMq0': wallOfIce, // Ring of Water Elemental Command [cast] (2014)
  'dnd5e:dnd5e-equipment24-dmgRobeOfEyes000:cnwTmjzQ7kgEOKI7': glareFlash, // Robe of Eyes [Light Save] (2024)
  'dnd5e:dnd5e-equipment24-dmgRobeOfEyes000:idP25eFI8qWG7FTV': glareFlash, // Robe of Eyes [Daylight Save] (2024)
  'dnd5e:dnd5e-items-U74TPNQLJZbHJyCk:dnd5eactivity000': glareFlash, // Robe of Eyes [Save vs. Light] (2014)
  'dnd5e:dnd5e-items-U74TPNQLJZbHJyCk:pA9Ko1PbdY79DvVb': glareFlash, // Robe of Eyes [Save vs. Daylight] (2014)
  'dnd5e:dnd5e-equipment24-dmgRobeOfScintil:N5STMAfYocyR39zB': dazzlingSelf, // Robe of Scintillating Colors [save] (2024)
  'dnd5e:dnd5e-equipment24-dmgRobeOfScintil:uNpAG3kertIKjxHM': dazzlingHues, // Robe of Scintillating Colors [Display Dazzling Hues] (2024)
  'dnd5e:dnd5e-items-JRJpKZyamkpa7awv:dnd5eactivity000': dazzlingSelf, // Robe of Scintillating Colors [save] (2014)
  'dnd5e:dnd5e-items-JRJpKZyamkpa7awv:dnd5eactivity300': dazzlingSelf, // Robe of Scintillating Colors [utility] (2014)
  'dnd5e:dnd5e-equipment24-dmgRobeOfStars00:8RstC93WBiFEF5ya': magicMissile, // Robe of Stars [cast] (2024)
  'dnd5e:dnd5e-equipment24-dmgRobeOfStars00:s1lUHgJWF8CUIedO': astralShift, // Robe of Stars [Enter/Exit Astral Plane] (2024)
  'dnd5e:dnd5e-items-66UkbfH0PVwo4HgA': magicMissile, // Robe of Stars (2014)
  'dnd5e:dnd5e-equipment24-dmgRobeOfUsefulI:CewswcciLrV7wBVN': robeLantern, // Robe of Useful Items [Bullseye Lantern] (2024)
  'dnd5e:dnd5e-equipment24-dmgRobeOfUsefulI:gzkM1WvNfpmo48YP': usefulPatch, // Robe of Useful Items [Dagger] (2024)
  'dnd5e:dnd5e-equipment24-dmgRobeOfUsefulI:8714LxXzxWUgz2iy': usefulPatch, // Robe of Useful Items [Mirror] (2024)
  'dnd5e:dnd5e-equipment24-dmgRobeOfUsefulI:A0T4ezb8ANRXbNFn': usefulPatch, // Robe of Useful Items [Pole] (2024)
  'dnd5e:dnd5e-equipment24-dmgRobeOfUsefulI:oWCkue5qnRqcQGQE': usefulPatch, // Robe of Useful Items [Rope (Coiled)] (2024)
  'dnd5e:dnd5e-equipment24-dmgRobeOfUsefulI:GEjvz3xtYjhD50U4': usefulPatch, // Robe of Useful Items [Sack] (2024)
  'dnd5e:dnd5e-items-2ksm2KXCY3vBHTAx': usefulPatch, // Robe of Useful Items (2014)
  'dnd5e:dnd5e-equipment24-dmgRodOfAbsorpti:wgsdcPGuk1yY5gIG': absorbSpell, // Rod of Absorption [Restore Slots] (2024)
  'dnd5e:dnd5e-equipment24-dmgRodOfAbsorpti:y66MTczY5BQfIonF': absorbSpell, // Rod of Absorption [Absorb Spell] (2024)
  'dnd5e:dnd5e-items-6pjaQzbtxQTuQ4RW': absorbSpell, // Rod of Absorption (2014)
  'dnd5e:dnd5e-equipment24-dmgRodOfAlertnes:1QtWQjNgCeQvsRXb': detectEvil, // Rod of Alertness [cast] (2024)
  'dnd5e:dnd5e-equipment24-dmgRodOfAlertnes:lmhyPV4BzFsooFUy': detectMagic, // Rod of Alertness [cast] (2024)
  'dnd5e:dnd5e-equipment24-dmgRodOfAlertnes:FdoTXcNrE4D5k8TZ': detectPoison, // Rod of Alertness [cast] (2024)
  'dnd5e:dnd5e-equipment24-dmgRodOfAlertnes:CLHEZxKXJVquJbgo': seeInvisibility, // Rod of Alertness [cast] (2024)
  'dnd5e:dnd5e-items-Do3qeSHtBjUsmfvz:oA9zbvC3W4wWhyp8': detectEvil, // Rod of Alertness [cast] (2014)
  'dnd5e:dnd5e-items-Do3qeSHtBjUsmfvz:IHSMR3HySfUImEHj': detectMagic, // Rod of Alertness [cast] (2014)
  'dnd5e:dnd5e-items-Do3qeSHtBjUsmfvz:5IazOhC4axC53B6B': detectPoison, // Rod of Alertness [cast] (2014)
  'dnd5e:dnd5e-items-Do3qeSHtBjUsmfvz:fJkRusyWDVH98JZF': seeInvisibility, // Rod of Alertness [cast] (2014)
  'dnd5e:dnd5e-items-d5HNCmLIPCpPoX2w': lordlyMight, // Rod of Lordly Might (2014)
  'dnd5e:dnd5e-equipment24-dmgRodOfResurrec:61qS4dLeKZdtrWoL': healTouch, // Rod of Resurrection [cast] (2024)
  'dnd5e:dnd5e-equipment24-dmgRodOfResurrec:bHhFcL8mph4snByq': resurrection, // Rod of Resurrection [cast] (2024)
  'dnd5e:dnd5e-equipment24-dmgRodOfRulershi': rulership, // Rod of Rulership (2024)
  'dnd5e:dnd5e-items-vmbB2SK6pQU2Vkzb': rulership, // Rod of Rulership (2014)
  'dnd5e:dnd5e-equipment24-dmgRodOfSecurity': teleportShift, // Rod of Security (2024)
  'dnd5e:dnd5e-items-9kfMsSweOBui0SC4': teleportShift, // Rod of Security (2014)
  'dnd5e:dnd5e-equipment24-dmgRollingStone0:MLbhL4DqA54XPO0N': rollingStone, // Rolling Stone [save] (2024)
  'dnd5e:dnd5e-equipment24-dmgRollingStone0:xYCs4eHhCOtp4faS': braceAgainst, // Rolling Stone [Slow] (2024)
  'dnd5e:dnd5e-equipment24-x8jC9e00t4cUYiKR:Y0LvyxjfVHNbp4CG': mundane, // Rope [Tie Knot] (2024)
  'dnd5e:dnd5e-equipment24-x8jC9e00t4cUYiKR:rYGOWDRcT5jBKvzq': ropeBurst, // Rope [Burst Rope] (2024)
  'dnd5e:dnd5e-equipment24-x8jC9e00t4cUYiKR:5q6tX1T7ONDvgJiA': effort, // Rope [Escape Check] (2024)
  'dnd5e:dnd5e-equipment24-LfDewuKszszreg6i:Y0LvyxjfVHNbp4CG': mundane, // Rope [Tie Knot] (2024)
  'dnd5e:dnd5e-equipment24-LfDewuKszszreg6i:rYGOWDRcT5jBKvzq': ropeBurst, // Rope [Burst Rope] (2024)
  'dnd5e:dnd5e-equipment24-LfDewuKszszreg6i:5q6tX1T7ONDvgJiA': effort, // Rope [Escape Check] (2024)
  'dnd5e:dnd5e-equipment24-5KMKEV07I25SVth0:Y0LvyxjfVHNbp4CG': mundane, // Rope [Tie Knot] (2024)
  'dnd5e:dnd5e-equipment24-5KMKEV07I25SVth0:rYGOWDRcT5jBKvzq': ropeBurst, // Rope [Burst Rope] (2024)
  'dnd5e:dnd5e-equipment24-5KMKEV07I25SVth0:5q6tX1T7ONDvgJiA': effort, // Rope [Escape Check] (2024)
  'dnd5e:dnd5e-equipment24-phbagRope0000000:Y0LvyxjfVHNbp4CG': mundane, // Rope [Tie Knot] (2024)
  'dnd5e:dnd5e-equipment24-phbagRope0000000:rYGOWDRcT5jBKvzq': ropeBurst, // Rope [Burst Rope] (2024)
  'dnd5e:dnd5e-equipment24-phbagRope0000000:5q6tX1T7ONDvgJiA': effort, // Rope [Escape Check] (2024)
  'dnd5e:dnd5e-equipment24-dmgRopeOfClimbin:JH4C7mTutLBmBJyi': quiet, // Rope of Climbing [Damage Rope] (2024)
  'dnd5e:dnd5e-equipment24-dmgRopeOfClimbin:1zQvPyT12aIg017J': quiet, // Rope of Climbing [Repair Rope] (2024)
  'dnd5e:dnd5e-equipment24-dmgRopeOfClimbin:0QUTFIBynESqw7XZ': ropeAnimate, // Rope of Climbing [Command] (2024)
  'dnd5e:dnd5e-items-29e6gHwWKNLaRUoz': ropeAnimate, // Rope of Climbing (2014)
  'dnd5e:dnd5e-equipment24-dmgRopeOfEntangl:oY5qoF7eii3fFuzY': ropeEntangle, // Rope of Entanglement [Entangle] (2024)
  'dnd5e:dnd5e-equipment24-dmgRopeOfEntangl:4Zem04Lsz9nIP2qM': effort, // Rope of Entanglement [Escape] (2024)
  'dnd5e:dnd5e-equipment24-dmgRopeOfEntangl:945K5l88AeS7w4hV': quiet, // Rope of Entanglement [Damage Rope] (2024)
  'dnd5e:dnd5e-equipment24-dmgRopeOfEntangl:60i9AJLDM4Meg8TG': quiet, // Rope of Entanglement [Repair Rope] (2024)
  'dnd5e:dnd5e-items-J8gQdJJi5e8LmD7H': ropeEntangle, // Rope of Entanglement (2014)
  'dnd5e:dnd5e-equipment24-dmgRustBagofTric': bagOfTricks, // Rust Bag of Tricks (2024)
  'dnd5e:dnd5e-equipment24-dmgScarabOfProte': scarab, // Scarab of Protection (2024)
  'dnd5e:dnd5e-items-xjRSY2ECcc9viSz3': scarab, // Scarab of Protection (2014)
  'dnd5e:dnd5e-equipment24-dmgSendingStones': sending, // Sending Stones (2024)
  'dnd5e:dnd5e-equipment24-dmgSerpentVenom0': poisonInjury, // Serpent Venom (2024)
  'dnd5e:dnd5e-equipment24-dmgFwpSerpentine': serpentineOwl, // Serpentine Owl (2024)
  'dnd5e:dnd5e-equipment24-dmgShieldOfTheCa:ABPaLpY5mrKpB4ou': shieldBash, // Shield of the Cavalier [Forceful Bash] (2024)
  'dnd5e:dnd5e-equipment24-phbagSignalWhist': whistle, // Signal Whistle (2024)
  'dnd5e:dnd5e-items-oY8KbpGmB5H2Deoy': ropeBurst, // Silk Rope (50 ft.) (2014)
  'dnd5e:dnd5e-equipment24-dmgSilverHornOfV': hornValhalla, // Silver Horn of Valhalla (2024)
  'dnd5e:dnd5e-items-lTfo6OVvAY2iJ4oq': hornValhalla, // Silver Horn of Valhalla (2014)
  'dnd5e:dnd5e-equipment24-dmgFwpSilverRave:H9avlnuBT1KSCMEp': silverRaven, // Silver Raven [summon] (2024)
  'dnd5e:dnd5e-equipment24-dmgFwpSilverRave:bO4agG7byTwFTiFg': animalMessenger, // Silver Raven [cast] (2024)
  'dnd5e:dnd5e-items-Mj8fTo5VZKJJ7uMv': slaying, // Sling Bullet of Slaying (2014)
  'dnd5e:dnd5e-equipment24-phbtulSmithsTool': toolWork, // Smith's Tools (2024)
  'dnd5e:dnd5e-equipment24-dmgSovereignGlue:LCgLQSifP8jigYoR': quiet, // Sovereign Glue [Determine Ounces] (2024)
  'dnd5e:dnd5e-equipment24-dmgSovereignGlue:gnuo4HtCHVjx6WSd': glue, // Sovereign Glue [Apply Glue] (2024)
  'dnd5e:dnd5e-items-zJ5LhDvTxYKzPIx4': glue, // Sovereign Glue (2014)
  'dnd5e:dnd5e-equipment24-dmgSphereOfAnnih:zDwHatTZuDTnAu17': sphereEngulf, // Sphere of Annihilation [Engulfed] (2024)
  'dnd5e:dnd5e-equipment24-dmgSphereOfAnnih:9dTRH8Pj9QqzCbTC': sphereControl, // Sphere of Annihilation [Control the Sphere] (2024)
  'dnd5e:dnd5e-equipment24-dmgSphereOfAnnih:eA2EcW8p6IoxeM4n': sphereEngulf, // Sphere of Annihilation [save] (2024)
  'dnd5e:dnd5e-items-2YNqk5zm9jDTvd7q': sphereEngulf, // Sphere of Annihilation (2014)
  'dnd5e:dnd5e-equipment24-dmgLolthsSting00': poisonInjury, // Spider's Sting (2024)
  'dnd5e:dnd5e-equipment24-dmgSpikedPit0000:z3zHgndXK0UL9IUU': spikedPit, // Spiked Pit [Trigger (1-4)] (2024)
  'dnd5e:dnd5e-equipment24-dmgSpikedPit0000:TGk3pt61XchkW4ce': spikedPit, // Spiked Pit [Trigger (5-10)] (2024)
  'dnd5e:dnd5e-equipment24-dmgSpikedPit0000:qoVDXlVaNIuGbSpN': spikedPit, // Spiked Pit [Trigger (11-16)] (2024)
  'dnd5e:dnd5e-equipment24-dmgSpikedPit0000:svYtkaj1auIEVJGC': spikedPit, // Spiked Pit [Trigger (17-20)] (2024)
  'dnd5e:dnd5e-items-46ikeR4RrSim6DsN': sphereControl, // Talisman of the Sphere (2014)
  'dnd5e:dnd5e-equipment24-dmgTanBagofTrick': bagOfTricks, // Tan Bag of Tricks (2024)
  'dnd5e:dnd5e-equipment24-phbtulThievesToo': toolWork, // Thieves' Tools (2024)
  'dnd5e:dnd5e-equipment24-phbgstThreedrago:EbM17Ylyo84xBjwb': toolWork, // Three-dragon ante [Catch Cheating] (2024)
  'dnd5e:dnd5e-equipment24-phbgstThreedrago:gUPVf8vkBC1YlPN0': toolWork, // Three-dragon ante [Play to Win] (2024)
  'dnd5e:dnd5e-equipment24-RqrWyXa9XkriaxTP': tinderbox, // Tinderbox (2024)
  'dnd5e:dnd5e-equipment24-YAXBQxHMEtJx6OuQ': tinderbox, // Tinderbox (2024)
  'dnd5e:dnd5e-equipment24-EGuDt2xpscYtalmV': tinderbox, // Tinderbox (2024)
  'dnd5e:dnd5e-equipment24-rIuY5ZDJh6ctfUwG': tinderbox, // Tinderbox (2024)
  'dnd5e:dnd5e-equipment24-367bsHMaHI1II4k9': tinderbox, // Tinderbox (2024)
  'dnd5e:dnd5e-equipment24-gHOs5HRZJdnUwfng': tinderbox, // Tinderbox (2024)
  'dnd5e:dnd5e-equipment24-etKzfLUMWikSsi3R': tinderbox, // Tinderbox (2024)
  'dnd5e:dnd5e-equipment24-phbagTinderbox00': tinderbox, // Tinderbox (2024)
  'dnd5e:dnd5e-equipment24-phbtulTinkersToo': toolWork, // Tinker's Tools (2024)
  'dnd5e:dnd5e-equipment24-dmgTomeOfClearTh:OCFufJcLGbTJqDqS': tomeClear, // Tome of Clear Thought [Read] (2024)
  'dnd5e:dnd5e-equipment24-dmgTomeOfClearTh:EzaVGpKcf0061yEW': quiet, // Tome of Clear Thought [Reset Progress] (2024)
  'dnd5e:dnd5e-items-2BYm8to5KldN8eYu': tomeClear, // Tome of Clear Thought (2014)
  'dnd5e:dnd5e-equipment24-dmgTomeOfLeaders:3dQNGt7ALqZaPgkD': tomeLeadership, // Tome of Leadership and Influence [Read] (2024)
  'dnd5e:dnd5e-equipment24-dmgTomeOfLeaders:EeYz5jSAJuCJJDLH': quiet, // Tome of Leadership and Influence [Reset Progress] (2024)
  'dnd5e:dnd5e-items-oN4Glcmi4BhdAI3k': tomeLeadership, // Tome of Leadership and Influence (2014)
  'dnd5e:dnd5e-equipment24-dmgTomeOfUnderst:5cPQGohyjYHSemQF': tomeUnderstanding, // Tome of Understanding [Read] (2024)
  'dnd5e:dnd5e-equipment24-dmgTomeOfUnderst:bKk94UV9DZ8pCzHf': quiet, // Tome of Understanding [Reset Progress] (2024)
  'dnd5e:dnd5e-items-WnKWD1FuAFUE7f4v': tomeUnderstanding, // Tome of Understanding (2014)
  'dnd5e:dnd5e-equipment24-gYKSyS7STTresmnS': torchLight, // Torch (2024)
  'dnd5e:dnd5e-equipment24-PKHfz87DirOHUBHn': torchLight, // Torch (2024)
  'dnd5e:dnd5e-equipment24-phbagTorch000000': torchLight, // Torch (2024)
  'dnd5e:dnd5e-items-ltbDV5OitV0yrDFU': torchLight, // Torch (2014)
  'dnd5e:dnd5e-items-29ZLE8PERtFVD3QU': torchLight, // Torch (2014)
  'dnd5e:dnd5e-items-BnOCLuNWhVvzHLjl': torchLight, // Torch (2014)
  'dnd5e:dnd5e-equipment24-dmgTorpor0000000': poisonSleep, // Torpor (2024)
  'dnd5e:dnd5e-equipment24-dmgTruthSerum000': poisonTruth, // Truth Serum (2024)
  'dnd5e:dnd5e-items-a86F565Pjdzym1jH': poisonTruth, // Truth Serum (2014)
  'dnd5e:dnd5e-equipment24-dmgUniversalSolv:zLSDeTP2AoZlrhAj': quiet, // Universal Solvent [Determine Ounces] (2024)
  'dnd5e:dnd5e-equipment24-dmgUniversalSolv:29Jn4qIeO3YkUZhG': solvent, // Universal Solvent [Apply Glue] (2024)
  'dnd5e:dnd5e-items-MAwoj2suj6cvb9Ti': solvent, // Universal Solvent (2014)
  'dnd5e:dnd5e-equipment24-dmgWandOfBinding:FYtfhGIVPzCls9Mv': holdCreature, // Wand of Binding [cast] (2024)
  'dnd5e:dnd5e-equipment24-dmgWandOfBinding:fKknnO6Gnieic15C': holdCreature, // Wand of Binding [cast] (2024)
  'dnd5e:dnd5e-items-7jEKkA9qbwJ3IuCb:yAh2VKsLWwGagH4w': holdCreature, // Wand of Binding [cast] (2014)
  'dnd5e:dnd5e-items-7jEKkA9qbwJ3IuCb:T4OTnHCe9gEtxKtc': holdCreature, // Wand of Binding [cast] (2014)
  'dnd5e:dnd5e-items-7jEKkA9qbwJ3IuCb:zlPilAc3Tg3RVZyG': quiet, // Wand of Binding [Assisted Escape] (2014)
  'dnd5e:dnd5e-equipment24-dmgWandOfFear000:ebs3fzYC16cloMWS': command, // Wand of Fear [cast] (2024)
  'dnd5e:dnd5e-items-EJFql4aNWHHJSxT9:J1oQUVbZNLMFnm4f': command, // Wand of Fear [cast] (2014)
  'dnd5e:dnd5e-equipment24-dmgWandOfFirebal': fireball, // Wand of Fireballs (2024)
  'dnd5e:dnd5e-items-DoSvjhRARhRqWZXg': fireball, // Wand of Fireballs (2014)
  'dnd5e:dnd5e-equipment24-dmgWandOfLightni': lightningBolt, // Wand of Lightning Bolts (2024)
  'dnd5e:dnd5e-items-bPFVfq81EsMNu6OQ': lightningBolt, // Wand of Lightning Bolts (2014)
  'dnd5e:dnd5e-equipment24-dmgWandOfMagicMi': magicMissile, // Wand of Magic Missiles (2024)
  'dnd5e:dnd5e-items-1taRIMF9w7jpnonN': magicMissile, // Wand of Magic Missiles (2014)
  'dnd5e:dnd5e-equipment24-dmgWandOfParalys': paralysisRay, // Wand of Paralysis (2024)
  'dnd5e:dnd5e-items-GcpXNc4dKUNw0Tk6': paralysisRay, // Wand of Paralysis (2014)
  'dnd5e:dnd5e-equipment24-dmgWandOfPolymor': polymorph, // Wand of Polymorph (2024)
  'dnd5e:dnd5e-items-khyjT3dKyoEOf4eA': polymorph, // Wand of Polymorph (2014)
  'dnd5e:dnd5e-equipment24-dmgWandOfWeb0000': web, // Wand of Web (2024)
  'dnd5e:dnd5e-items-4sR5HOah6KwVPHOb': web, // Wand of Web (2014)
  'dnd5e:dnd5e-equipment24-dmgWandOfWonder0:Z62czXwABB7SN1lP': darkness, // Wand of Wonder [cast] (2024)
  'dnd5e:dnd5e-equipment24-dmgWandOfWonder0:4h4Aazi3L1MmByOt': faerieFire, // Wand of Wonder [cast] (2024)
  'dnd5e:dnd5e-equipment24-dmgWandOfWonder0:76MvwJBXwm1GbzfW': fireball, // Wand of Wonder [cast] (2024)
  'dnd5e:dnd5e-equipment24-dmgWandOfWonder0:F6QdFpERu7c4x6cd': slow, // Wand of Wonder [cast] (2024)
  'dnd5e:dnd5e-equipment24-dmgWandOfWonder0:uDrKgJTXIcF0EM33': stinkingCloud, // Wand of Wonder [cast] (2024)
  'dnd5e:dnd5e-equipment24-dmgWandOfWonder0:yMZ4RIhJV1jvkKaf': gustOfWind, // Wand of Wonder [cast] (2024)
  'dnd5e:dnd5e-equipment24-dmgWandOfWonder0:DIkFGxynTge6LTPJ': heavyRain, // Wand of Wonder [Heavy Rain (36-40)] (2024)
  'dnd5e:dnd5e-equipment24-dmgWandOfWonder0:EhdR11nT5sMOi9h5': lightningBolt, // Wand of Wonder [cast] (2024)
  'dnd5e:dnd5e-equipment24-dmgWandOfWonder0:cKz4qaK2elWiFRCS': enlarge, // Wand of Wonder [cast] (2024)
  'dnd5e:dnd5e-equipment24-dmgWandOfWonder0:6kTej94dEVrwxM9D': colorBurst, // Wand of Wonder [Burst of Colorful Light (78-82)] (2024)
  'dnd5e:dnd5e-equipment24-dmgWandOfWonder0:hohchQU2VPFVUIWG': invisibility, // Wand of Wonder [cast] (2024)
  'dnd5e:dnd5e-equipment24-dmgWandOfWonder0:R4TuLg6r7fTmIMF9': gemStream, // Wand of Wonder [Stream of Gems (88-92)] (2024)
  'dnd5e:dnd5e-equipment24-dmgWandOfWonder0:Wxry2v7kMU16VG7T': polymorph, // Wand of Wonder [cast] (2024)
  'dnd5e:dnd5e-items-lPsueMv4ZoXqCYf9:MQiFj6kmbG849P2I': slow, // Wand of Wonder [Slow (1–5)] (2014)
  'dnd5e:dnd5e-items-lPsueMv4ZoXqCYf9:6DZzvyzd46LbnfIL': faerieFire, // Wand of Wonder [Faerie Fire (6–10)] (2014)
  'dnd5e:dnd5e-items-lPsueMv4ZoXqCYf9:CasBiIZXL54laOOx': gustOfWind, // Wand of Wonder [Gust of Wind (16–20)] (2014)
  'dnd5e:dnd5e-items-lPsueMv4ZoXqCYf9:scEVZazoOleSrYw2': detectThoughts, // Wand of Wonder [Detect Thoughts (21–25)] (2014)
  'dnd5e:dnd5e-items-lPsueMv4ZoXqCYf9:4xPLz74G1GRXtSmB': stinkingCloud, // Wand of Wonder [Stinking Cloud (26–30)] (2014)
  'dnd5e:dnd5e-items-lPsueMv4ZoXqCYf9:mfe676QinSfB6v8H': lightningBolt, // Wand of Wonder [Lightning Bolt (37–46)] (2014)
  'dnd5e:dnd5e-items-lPsueMv4ZoXqCYf9:V6TIchqdN8i6seVY': darkness, // Wand of Wonder [Darkness (54–58)] (2014)
  'dnd5e:dnd5e-items-lPsueMv4ZoXqCYf9:3dSvQUQq9gxu0HSl': fireball, // Wand of Wonder [Fireball (70–79)] (2014)
  'dnd5e:dnd5e-items-lPsueMv4ZoXqCYf9:fcFugwiJmL6UEXvv': invisibility, // Wand of Wonder [Invisibility (80–84)] (2014)
  'dnd5e:dnd5e-items-lPsueMv4ZoXqCYf9:J8RHNvGM7pmoqBNJ': wonderRoll, // Wand of Wonder [Point Wand at Target] (2014)
  'dnd5e:dnd5e-equipment24-dmgWaterRingOfEl:Un5AmzSdpsELbHQT': dominate, // Water Ring of Elemental Command [Elemental Compulsion] (2024)
  'dnd5e:dnd5e-equipment24-dmgWaterRingOfEl:vTkZY9QUnH16jHrV': createWater, // Water Ring of Elemental Command [cast] (2024)
  'dnd5e:dnd5e-equipment24-dmgWaterRingOfEl:pBLKd2Ukm41DD9Tw': iceStorm, // Water Ring of Elemental Command [cast] (2024)
  'dnd5e:dnd5e-equipment24-dmgWaterRingOfEl:f78Oiitz2BMcKx6i': waterWalk, // Water Ring of Elemental Command [cast] (2024)
  'dnd5e:dnd5e-equipment24-dmgWaterRingOfEl:J9591oTJtg4nJxEA': tsunami, // Water Ring of Elemental Command [cast] (2024)
  'dnd5e:dnd5e-equipment24-dmgWaterRingOfEl:OsiNV2wXjfJPtpUx': wallOfIce, // Water Ring of Elemental Command [cast] (2024)
  'dnd5e:dnd5e-items-q4RcCLeKviqgckqt': mundane, // Waterskin (2014)
  'dnd5e:dnd5e-items-2cKJTN5Ki77oCrQn': mundane, // Waterskin (2014)
  'dnd5e:dnd5e-items-1L5wkmbw0fmNAr38': mundane, // Waterskin (2014)
  'dnd5e:dnd5e-items-kx8DGQizmR5UI21R': mundane, // Waterskin (2014)
  'dnd5e:dnd5e-items-a8fe9d81BRW86cvP': mundane, // Waterskin (2014)
  'dnd5e:dnd5e-items-Uv0ilmzbWvqmlCVH': mundane, // Waterskin (2014)
  'dnd5e:dnd5e-equipment24-phbtulWeaversToo': toolWork, // Weaver's Tools (2024)
  'dnd5e:dnd5e-equipment24-dmgWellOfManyWor': wellOfWorlds, // Well of Many Worlds (2024)
  'dnd5e:dnd5e-items-xjme5oSQZmdAy1fc:dnd5eactivity000': wellOfWorlds, // Well of Many Worlds [utility] (2014)
  'dnd5e:dnd5e-items-xjme5oSQZmdAy1fc:dnd5eactivity200': wellOfWorlds, // Well of Many Worlds [damage] (2014)
  'dnd5e:dnd5e-equipment24-dmgWindFan000000': gustOfWind, // Wind Fan (2024)
  'dnd5e:dnd5e-items-mYFfH24uzuKh4IPS:dnd5eactivity000': gustLine, // Wind Fan [save] (2014)
  'dnd5e:dnd5e-items-mYFfH24uzuKh4IPS:dnd5eactivity200': gustLine, // Wind Fan [damage] (2014)
  'dnd5e:dnd5e-items-mYFfH24uzuKh4IPS:dnd5eactivity300': gustLine, // Wind Fan [utility] (2014)
  'dnd5e:dnd5e-equipment24-dmgWingedBoots00': wingedBoots, // Winged Boots (2024)
  'dnd5e:dnd5e-equipment24-dmgWingsOfFlying': wings, // Wings of Flying (2024)
  'dnd5e:dnd5e-items-FkDyLSpiynKTQZdi': wings, // Wings of Flying (2014)
  'dnd5e:dnd5e-equipment24-phbtulWoodcarver': toolWork, // Woodcarver's Tools (2024)
  'dnd5e:dnd5e-equipment24-dmgWyvernPoison0': poisonInjury, // Wyvern Poison (2024)
};
