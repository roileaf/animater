// Bespoke compositions (dnd5e-spells-b). Keys: '<system>:<entryId>' or '<system>:<entryId>:<variant|mode>'.
// See scripts/catalogs/bespoke/helpers.mjs and scripts/bespoke.mjs.
import { cast, travel, projectile, impact, area, aura, sprite, motion, tint, spin, breathe, design } from './helpers.mjs';

const OPT = { optionalTargets: true };

// ---- Shared compositions (used by several 2014/2024/activity keys) ----

const hypnoticPattern = design('A twisting pattern of colors weaves through the cube for a moment and vanishes; creatures who see it stand transfixed.', () => [
  cast('Colors weave from the hands', ['cast_generic.03.pinkyellow', 'cast_generic.03.blue'], { stageId: 'hp-c', scale: 0.8, duration: 1200 }),
  area('Shimmering hues', ['energy_field.01.multicolored', 'energy_field.01.blue'], { stageId: 'hp-f', after: 'hp-c', anchor: 'start', offset: 500, duration: 3000, opacity: 0.45, below: true, fadeIn: 400, fadeOut: 700 }),
  area('Twisting pattern of colors', ['swirling_sparkles.01.bluepink', 'swirling_sparkles.01.blue'], { after: 'hp-c', anchor: 'start', offset: 600, duration: 3000, opacity: 0.9, fadeIn: 300, fadeOut: 700, ...spin(5000) }),
  impact('Gaze captured', ['dizzy_stars.200px.pink', 'dizzy_stars.200px.blueorange'], { after: 'hp-f', anchor: 'start', offset: 900, duration: 2000, scale: 0.7, ...OPT }),
  motion('drift', 'targets', { after: 'hp-f', anchor: 'start', offset: 900, duration: 1800, intensity: 0.4, ...OPT }),
]);

const imprisonment = design('A magical restraint binds the target: sealing sigils close around it and spectral chains lock it in place.', () => [
  cast('Binding sigil', ['magic_signs.rune.abjuration.complete.purple', 'magic_signs.rune.abjuration.complete.blue'], { stageId: 'im-c', scale: 0.6, duration: 1600 }),
  aura('Restraint seal', ['magic_signs.circle.02.abjuration.complete.dark_purple', 'magic_signs.circle.02.abjuration.complete.dark_blue'], { subject: 'targets', stageId: 'im-s', after: 'im-c', anchor: 'start', offset: 600, duration: 3000, scale: 1.3, below: true }),
  aura('Spectral chains lock', ['markers.chain.spectral_standard.complete.02.purple', 'markers.chain.spectral_standard.complete.02.blue'], { subject: 'targets', after: 'im-s', anchor: 'start', offset: 400, duration: 2600 }),
  motion('press', 'targets', { after: 'im-s', anchor: 'start', offset: 500, duration: 1000, intensity: 0.6 }),
], { sound: 'chainBinding' });

const incendiaryCloud = design('A swirling cloud of smoke shot through with white-hot embers fills the sphere and sears everything inside.', () => [
  cast('Embers gather', ['cast_generic.fire.01.orange'], { stageId: 'ic-c', scale: 0.8, duration: 1100 }),
  area('Smoke cloud billows', ['fog_cloud.01.white'], { stageId: 'ic-a', after: 'ic-c', anchor: 'start', offset: 500, duration: 4000, opacity: 0.85, fadeIn: 600, fadeOut: 900, ...tint('#4a3a34') }),
  area('White-hot embers swirl', ['fireflies.many.01.orange', 'fireflies.many.01.green'], { after: 'ic-a', anchor: 'start', offset: 300, duration: 3600, fadeIn: 400, fadeOut: 800, ...tint('#ffb45a') }),
  impact('Embers sear', ['fumes.fire.orange', 'flames.04.complete.orange'], { after: 'ic-a', anchor: 'start', offset: 900, duration: 2000, scale: 0.8, ...OPT }),
  motion('stagger', 'targets', { after: 'ic-a', anchor: 'start', offset: 1000, duration: 800, ...OPT }),
]);
const incendiaryTick = design('Creatures that end their turn in the ember-laced smoke are seared again.', () => [
  aura('Smoke wreathes the creature', ['smoke.puff.centered.grey'], { subject: 'targets', stageId: 'it-s', duration: 2200, scale: 1.3, opacity: 0.8, ...tint('#4a3a34') }),
  impact('Embers sear', ['fumes.fire.orange', 'flames.04.complete.orange'], { after: 'it-s', anchor: 'start', offset: 300, duration: 1900, scale: 0.8 }),
  motion('stagger', 'targets', { after: 'it-s', anchor: 'start', offset: 400, duration: 800 }),
]);

const inflictWounds = design('A touch wreathed in necrotic decay rots the creature’s flesh.', () => [
  cast('Hand wreathed in decay', ['smoke.puff.centered.dark_green', 'smoke.puff.centered.grey'], { stageId: 'iw-c', scale: 0.55, duration: 1000 }),
  motion('lunge', 'source', { after: 'iw-c', anchor: 'start', offset: 400, duration: 900 }),
  impact('Necrotic surge', ['impact.004.dark_purple', 'impact.004.blue'], { stageId: 'iw-i', after: 'iw-c', anchor: 'start', offset: 750, duration: 1200, scale: 0.9, ...tint('#5b2a86') }),
  aura('Flesh withers', ['smoke.puff.centered.dark_green', 'smoke.puff.centered.grey'], { subject: 'targets', after: 'iw-i', anchor: 'start', offset: 150, duration: 1800, opacity: 0.8 }),
  motion('stagger', 'targets', { after: 'iw-i', anchor: 'start', duration: 800 }),
]);

const danceCast = design('The target breaks into a comic dance: a lilting tune of notes swirls around it as it capers in place.', () => [
  cast('Lilting tune', ['music_notations.beamed_quavers.purple', 'music_notations.beamed_quavers.blue'], { stageId: 'id-c', scale: 0.5, offsetY: -0.5, offsetUnits: 'token', duration: 1200 }),
  aura('Compelling melody', ['markers.music.purplepink', 'markers.music.greenorange'], { subject: 'targets', stageId: 'id-m', after: 'id-c', anchor: 'start', offset: 600, duration: 3000 }),
  motion('spin', 'targets', { after: 'id-m', anchor: 'start', offset: 300, duration: 1400, intensity: 0.6 }),
  motion('shake', 'targets', { after: 'id-m', anchor: 'start', offset: 1800, duration: 900, intensity: 0.5 }),
], { sound: 'song' });
const danceSave = design('The dancing creature struggles against the melody, still shuffling and capering in place.', () => [
  aura('Compelling melody', ['markers.music.purplepink', 'markers.music.greenorange'], { subject: 'targets', stageId: 'ds-m', duration: 2400 }),
  motion('shake', 'targets', { after: 'ds-m', anchor: 'start', offset: 200, duration: 1200, intensity: 0.5 }),
], { sound: 'song' });

const knock = design('A loud knock rings out and the lock, bar or seal on the chosen object springs open.', () => [
  cast('Unlocking rune', ['magic_signs.rune.transmutation.complete.yellow'], { stageId: 'kn-c', scale: 0.5, duration: 1300 }),
  impact('Loud knock', ['soundwave.01.blue'], { stageId: 'kn-k', after: 'kn-c', anchor: 'start', offset: 600, duration: 1300, scale: 0.8 }),
  impact('Lock springs open', ['impact.005.yellow', 'impact.006.yellow'], { after: 'kn-k', anchor: 'start', offset: 300, duration: 1100, scale: 0.6 }),
], { sound: 'unlock' });

const longstrider = design('A touch lengthens the creature’s stride: wind streaks trail from its feet as its speed increases.', () => [
  cast('Touch of swiftness', ['cast_generic.02.blue'], { stageId: 'ls-c', scale: 0.6, duration: 900 }),
  aura('Swift streaks', ['wind_lines.01.01.white'], { subject: 'targets', stageId: 'ls-w', after: 'ls-c', anchor: 'start', offset: 400, duration: 2000, scale: 1.2, opacity: 0.85 }),
  aura('Light footsteps', ['footprints.shoe.grey'], { subject: 'targets', after: 'ls-w', anchor: 'start', offset: 200, duration: 1800, scale: 0.8, opacity: 0.6, below: true }),
  motion('pulse', 'targets', { after: 'ls-w', anchor: 'start', duration: 900, intensity: 0.35 }),
], { sound: 'wind' });

const mageHand = design('A spectral, floating hand appears beside the caster, ready to manipulate objects.', () => [
  cast('Gesture', ['cast_shape.circle.single01.blue'], { stageId: 'mh-c', scale: 0.5, duration: 900 }),
  cast('Spectral hand', ['arcane_hand.blue'], { after: 'mh-c', anchor: 'start', offset: 400, duration: 2800, scale: 0.4, opacity: 0.75, offsetX: 1, offsetUnits: 'token', fadeIn: 400, fadeOut: 600 }),
]);

const magicCircle = (color, freeColor, label) => design(`A ${label}cylinder of magical energy rises and glowing runes appear where it meets the floor.`, () => [
  cast('Warding gesture', ['magic_signs.rune.abjuration.complete.' + color, 'magic_signs.rune.abjuration.complete.blue'], { stageId: 'mc-c', scale: 0.5, duration: 1400 }),
  area('Glowing floor runes', ['magic_signs.circle.02.abjuration.complete.' + color, 'magic_signs.circle.02.abjuration.complete.' + freeColor], { stageId: 'mc-r', after: 'mc-c', anchor: 'start', offset: 600, duration: 4000, below: true }),
  area('Cylinder of energy', ['energy_field.02.above.' + (color === 'blue' ? 'blue' : 'purple'), 'energy_field.02.above.blue'], { after: 'mc-r', anchor: 'start', offset: 600, duration: 3200, opacity: 0.45, fadeIn: 500, fadeOut: 700 }),
]);

const magicMissile = design('Three glowing darts of magical force streak out and strike simultaneously, each bursting on impact.', () => [
  cast('Three darts form', ['cast_shape.circle.01.purple', 'cast_shape.circle.01.blue'], { stageId: 'mm-c', scale: 0.6, duration: 900 }),
  travel('Three force darts', ['magic_missile.purple'], { stageId: 'mm-t', after: 'mm-c', anchor: 'start', offset: 500, duration: 1600, repeats: 3, repeatScope: 'total', repeatInterval: 110 }),
  impact('Force bursts', ['impact.004.pinkpurple', 'impact.004.blue'], { stageId: 'mm-i', after: 'mm-t', anchor: 'end', offset: -120, duration: 900, scale: 0.6, repeats: 3, repeatScope: 'total', repeatInterval: 110 }),
  motion('recoil', 'targets', { after: 'mm-i', anchor: 'start', duration: 650 }),
]);

const mansionDoor = (useArea) => design('A shimmering doorway to an extradimensional dwelling opens within range.', () => [
  cast('Conjuration circle', ['magic_signs.circle.02.conjuration.complete.purple', 'magic_signs.circle.02.conjuration.complete.yellow'], { stageId: 'md-c', scale: 0.6, duration: 1600, below: true }),
  (useArea ? area : cast)('Shimmering door', ['portals.vertical.ring_masked.purple', 'portals.vertical.ring.bright_yellow'], { after: 'md-c', anchor: 'start', offset: 700, duration: 3600, fadeIn: 400, fadeOut: 700, ...(useArea ? { scale: 0.8 } : { scale: 0.7, offsetX: 1.2, offsetUnits: 'token' }) }),
]);

const maze = design('The target is banished into a labyrinthine demiplane: a vortex opens beneath it and it vanishes.', () => [
  cast('Banishing gesture', ['magic_signs.circle.02.conjuration.complete.purple', 'magic_signs.circle.02.conjuration.complete.yellow'], { stageId: 'mz-c', scale: 0.5, duration: 1200, below: true }),
  aura('Labyrinth vortex', ['portals.horizontal.vortex.purple', 'portals.horizontal.ring.bright_yellow'], { subject: 'targets', stageId: 'mz-v', after: 'mz-c', anchor: 'start', offset: 500, duration: 2800, scale: 1.2, below: true, fadeIn: 300, fadeOut: 600 }),
  motion('sink', 'targets', { after: 'mz-v', anchor: 'start', offset: 600, duration: 1500, intensity: 0.7 }),
  motion('flicker', 'targets', { after: 'mz-v', anchor: 'start', offset: 1900, duration: 900, intensity: 0.6 }),
], { sound: 'teleport' });

const meteorSwarm = design('Blazing orbs of fire plummet and explode at four points across the area.', () => [
  cast('Sky-fire called down', ['cast_generic.fire.01.orange'], { stageId: 'ms-c', scale: 0.9, duration: 1200 }),
  area('First meteor', ['fireball.explosion.orange'], { stageId: 'ms-1', after: 'ms-c', anchor: 'start', offset: 700, duration: 2600, scale: 0.55, offsetX: -0.9, offsetY: -0.7 }),
  area('Second meteor', ['fireball.explosion.orange'], { after: 'ms-1', anchor: 'start', offset: 300, duration: 2600, scale: 0.55, offsetX: 0.9, offsetY: -0.5 }),
  area('Third meteor', ['fireball.explosion.orange'], { after: 'ms-1', anchor: 'start', offset: 600, duration: 2600, scale: 0.55, offsetX: -0.6, offsetY: 0.9 }),
  area('Fourth meteor', ['fireball.explosion.orange'], { after: 'ms-1', anchor: 'start', offset: 900, duration: 2600, scale: 0.55, offsetX: 0.8, offsetY: 0.8 }),
  area('Scorched ground', ['scorched_earth.orange', 'scorched_earth.black'], { after: 'ms-1', anchor: 'start', offset: 700, duration: 3000, opacity: 0.6, below: true, fadeOut: 900 }),
  motion('stagger', 'targets', { after: 'ms-1', anchor: 'start', offset: 400, duration: 900, ...OPT }),
], { sound: 'fireball' });

const mindBlank = design('A touch seals the creature’s mind behind a shimmering ward against psychic intrusion and divination.', () => [
  cast('Warding rune', ['magic_signs.rune.abjuration.complete.purple', 'magic_signs.rune.abjuration.complete.blue'], { stageId: 'mb-c', scale: 0.5, duration: 1300 }),
  aura('Mind sealed', ['shield.02.complete.01.purple', 'shield.01.complete.01.blue'], { subject: 'targets', after: 'mb-c', anchor: 'start', offset: 600, duration: 2600, scale: 1.1 }),
  aura('Thought-veil', ['icon.runes.white', 'icon.runes.orange'], { subject: 'targets', after: 'mb-c', anchor: 'start', offset: 900, duration: 2000, scale: 0.4, offsetY: -0.55, offsetUnits: 'token', opacity: 0.8 }),
], { sound: 'shield' });

const mirrorImage = design('Three illusory duplicates of the caster appear in its space, shifting so the real one cannot be tracked.', () => [
  cast('Illusion woven', ['cast_generic.01.dark_purple', 'cast_shape.circle.01.blue'], { stageId: 'mi-c', scale: 0.7, duration: 1000 }),
  sprite('Three illusory duplicates', { stageId: 'mi-s', after: 'mi-c', anchor: 'start', offset: 450, duration: 3000, copies: 3, copySpread: 0.38, opacity: 0.45, fadeIn: 300, fadeOut: 800 }),
  aura('Illusory shimmer', ['shimmer.01.purple', 'shimmer.01.blue'], { after: 'mi-s', anchor: 'start', duration: 1500, opacity: 0.6 }),
  motion('flicker', 'source', { after: 'mi-s', anchor: 'start', offset: 200, duration: 1200, intensity: 0.5 }),
]);
const mirrorIntercept = design('An attack strikes one of the duplicates instead, which bursts into motes and vanishes.', () => [
  sprite('Duplicate takes the blow', { stageId: 'mx-s', duration: 900, copies: 1, offsetX: 0.45, offsetUnits: 'token', opacity: 0.5, fadeOut: 600 }),
  cast('Duplicate shatters', ['glint.purple.many', 'glint.yellow.many'], { after: 'mx-s', anchor: 'start', offset: 450, duration: 1200, scale: 0.6, offsetX: 0.45, offsetUnits: 'token' }),
  motion('dodge', 'source', { after: 'mx-s', anchor: 'start', duration: 700, intensity: 0.4 }),
]);

const mislead = design('The caster turns invisible as an illusory double appears where it stood.', () => [
  cast('Illusion woven', ['cast_generic.01.dark_purple', 'cast_shape.circle.01.blue'], { stageId: 'ml-c', scale: 0.7, duration: 1000 }),
  sprite('Illusory double', { stageId: 'ml-s', after: 'ml-c', anchor: 'start', offset: 450, duration: 3000, copies: 1, opacity: 0.55, fadeIn: 300, fadeOut: 800 }),
  motion('flicker', 'source', { after: 'ml-s', anchor: 'start', offset: 300, duration: 1400, intensity: 0.6 }),
]);

const mistyStep = design('Briefly surrounded by silvery mist, the caster vanishes and steps across space.', () => [
  cast('Silvery mist', ['misty_step.01.grey', 'misty_step.01.blue'], { stageId: 'mst-c', duration: 1800 }),
  motion('flicker', 'source', { after: 'mst-c', anchor: 'start', offset: 250, duration: 1300, intensity: 0.6 }),
]);

const moonbeamConjure = design('A silvery beam of pale light shines down in a cylinder, searing those inside.', () => [
  cast('Moonlight gathers', ['dancing_light.blueteal'], { stageId: 'mb-c', scale: 0.6, duration: 1100 }),
  area('Silvery beam', ['moonbeam.01.complete.blue'], { stageId: 'mb-a', after: 'mb-c', anchor: 'start', offset: 500, duration: 4000 }),
  motion('stagger', 'targets', { after: 'mb-a', anchor: 'start', offset: 900, duration: 800, ...OPT }),
], { sound: 'moonRay' });
const moonbeamBurn = design('A creature caught in the pale beam is seared by its silvery light.', () => [
  impact('Pale light sears', ['moonbeam.01.complete.blue'], { stageId: 'mbb', duration: 2600, scale: 0.6 }),
  motion('stagger', 'targets', { after: 'mbb', anchor: 'start', offset: 500, duration: 800 }),
], { sound: 'moonRay' });

const phantasmalKiller = (withCast) => design('An illusory manifestation of the target’s deepest fear looms over it, visible only to the victim, who cowers in terror.', () => [
  ...(withCast ? [cast('Nightmare drawn out', ['cast_shape.circle.01.purple', 'cast_shape.circle.01.blue'], { stageId: 'pk-c', scale: 0.6, duration: 1100 })] : []),
  aura('Nightmare manifests', ['smoke.plumes.01.purple', 'smoke.plumes.01.grey'], { subject: 'targets', stageId: 'pk-n', ...(withCast ? { after: 'pk-c', anchor: 'start', offset: 500 } : {}), duration: 2800, opacity: 0.8, fadeIn: 300, fadeOut: 700 }),
  aura('Eyes of its fear', ['eyes.01.dark_purple.many', 'eyes.01.dark_green.many'], { subject: 'targets', after: 'pk-n', anchor: 'start', offset: 300, duration: 2300, scale: 1.2, opacity: 0.85 }),
  impact('Terror strikes', ['markers.fear.dark_purple.01'], { after: 'pk-n', anchor: 'start', offset: 700, duration: 1800, scale: 0.6 }),
  motion('cower', 'targets', { after: 'pk-n', anchor: 'start', offset: 600, duration: 1300 }),
], { sound: 'fear' });

const poisonSpray = design('A puff of noxious gas sprays from the caster’s palm and engulfs the creature.', () => [
  cast('Toxins gather', ['cast_generic.02.green', 'cast_generic.02.blue'], { stageId: 'ps-c', scale: 0.55, duration: 800 }),
  travel('Noxious spray', ['breath_weapons.poison.cone.green'], { stageId: 'ps-t', after: 'ps-c', anchor: 'start', offset: 350, duration: 1700, scale: 0.6 }),
  impact('Poison cloud engulfs', ['fumes.toxic.green', 'smoke.puff.centered.grey'], { after: 'ps-t', anchor: 'end', offset: -120, duration: 2000, scale: 0.7, ...tint('#7cc443') }),
  motion('recoil', 'targets', { after: 'ps-t', anchor: 'end', offset: -120, duration: 700 }),
]);

const prismaticSprayCast = design('Eight multicolored rays flash from the caster’s hand across the cone, each a different color and power.', () => [
  cast('Rainbow light gathers', ['cast_generic.03.pinkyellow', 'cast_generic.03.blue'], { stageId: 'pr-c', scale: 0.7, duration: 900 }),
  travel('Eight prismatic rays', ['energy_beam.normal.yellow.01', 'energy_beam.normal.bluepink.02'], { stageId: 'pr-t', after: 'pr-c', anchor: 'start', offset: 450, duration: 2400, travelDestination: 'area', areaLayout: 'fan', fanCount: 8, fanColors: ['#ff3030', '#ff9638', '#ffe85c', '#63dc75', '#57a9ff', '#585de1', '#b66aec', '#ffffff'], scale: 0.5, fadeOut: 300 }),
  motion('recoil', 'source', { after: 'pr-c', anchor: 'start', offset: 450, duration: 600, intensity: 0.4 }),
]);

const purify = design('Cleansing light washes over the food and drink in the sphere, lifting away poison and rot.', () => [
  cast('Cleansing gesture', ['cast_generic.01.yellow'], { stageId: 'pu-c', scale: 0.6, duration: 1000 }),
  area('Purifying glow', ['healing_generic.burst.yellowwhite', 'healing_generic.400px.yellow'], { stageId: 'pu-a', after: 'pu-c', anchor: 'start', offset: 500, duration: 2400 }),
  area('Freshness sparkles', ['twinkling_stars.points05.white'], { after: 'pu-a', anchor: 'start', offset: 400, duration: 2200, scale: 0.8 }),
], { sound: 'holy' });

const revive = design('Radiant life floods into the dead creature as its soul is called back into its body.', () => [
  cast('Divine light gathers', ['divine_smite.caster.yellowwhite', 'divine_smite.caster.blueyellow'], { stageId: 'rv-c', scale: 0.8, duration: 1600 }),
  aura('Soul returns', ['healing_generic.loop.yellowwhite', 'healing_generic.loop.greenorange'], { subject: 'targets', stageId: 'rv-a', after: 'rv-c', anchor: 'start', offset: 700, duration: 3000, ...OPT }),
  impact('Life rekindled', ['cure_wounds.400px.yellow', 'cure_wounds.400px.blue'], { after: 'rv-a', anchor: 'start', offset: 500, duration: 2200, scale: 0.8, ...OPT }),
  motion('pulse', 'targets', { after: 'rv-a', anchor: 'start', offset: 1000, duration: 1000, intensity: 0.5, ...OPT }),
], { sound: 'revive' });
const reincarnate = design('Nature forms a new body for the dead creature and calls its soul to enter it.', () => [
  cast('Nature’s call', ['swirling_leaves.complete.01.green'], { stageId: 'ri-c', scale: 0.8, duration: 1600 }),
  aura('New body grows', ['plant_growth.04.round.2x2.complete.greenwhite', 'plant_growth.03.round.2x2.complete.greenyellow'], { subject: 'targets', stageId: 'ri-a', after: 'ri-c', anchor: 'start', offset: 600, duration: 3000, below: true, ...OPT }),
  impact('Soul enters', ['healing_generic.burst.greenorange'], { after: 'ri-a', anchor: 'start', offset: 900, duration: 1800, scale: 0.8, ...OPT }),
  motion('pulse', 'targets', { after: 'ri-a', anchor: 'start', offset: 1100, duration: 1000, intensity: 0.5, ...OPT }),
], { sound: 'revive' });

const reverseGravity = design('Gravity reverses within the cylinder: debris and unanchored creatures fall upward.', () => [
  cast('Gravity inverts', ['cast_generic.03.bluepurple', 'cast_generic.02.blue'], { stageId: 'rg-c', scale: 0.8, duration: 1100 }),
  area('Cylinder of reversed gravity', ['energy_field.02.above.purple', 'energy_field.02.above.blue'], { stageId: 'rg-a', after: 'rg-c', anchor: 'start', offset: 500, duration: 3600, opacity: 0.5, fadeIn: 500, fadeOut: 800 }),
  area('Debris falls upward', ['falling_rocks.top.1x1.grey'], { after: 'rg-a', anchor: 'start', offset: 300, duration: 2600, scale: 0.6, mirrorY: true, opacity: 0.9 }),
  motion('levitate', 'targets', { after: 'rg-a', anchor: 'start', offset: 500, duration: 2600, intensity: 0.9, ...OPT }),
], { sound: 'gravity' });
const reverseGravityGrab = design('A creature caught in reversed gravity grabs for a fixed object as it is pulled upward.', () => [
  aura('Upward pull', ['wind_lines.01.01.white'], { subject: 'targets', stageId: 'rgg', duration: 2000, rotation: -90, opacity: 0.8 }),
  motion('brace', 'targets', { after: 'rgg', anchor: 'start', offset: 200, duration: 1200 }),
], { sound: 'gravity' });

const scorchingRay = design('Three rays of fire streak out, each bursting into flame on the creature it hits.', () => [
  cast('Fire gathers', ['cast_generic.fire.01.orange'], { stageId: 'sr-c', scale: 0.7, duration: 900 }),
  travel('Three fiery rays', ['scorching_ray.01.orange'], { stageId: 'sr-t', after: 'sr-c', anchor: 'start', offset: 450, duration: 1600, scale: 0.6, repeats: 3, repeatScope: 'total', repeatInterval: 280 }),
  impact('Flame bursts', ['explosion.01.orange'], { stageId: 'sr-i', after: 'sr-t', anchor: 'end', offset: -120, duration: 1100, scale: 0.45, repeats: 3, repeatScope: 'total', repeatInterval: 280 }),
  motion('recoil', 'targets', { after: 'sr-i', anchor: 'start', duration: 650 }),
]);

const sleetStorm = design('Freezing rain and sleet pour down across the cylinder, coating the ground in slick ice.', () => [
  cast('Cold gathers', ['cast_generic.ice.01.blue', 'cast_generic.02.blue'], { stageId: 'ss-c', scale: 0.8, duration: 1100 }),
  area('Sleet pours down', ['sleet_storm.01.blue'], { stageId: 'ss-a', after: 'ss-c', anchor: 'start', offset: 500, duration: 4200, fadeIn: 500, fadeOut: 800 }),
  motion('shake', 'targets', { after: 'ss-a', anchor: 'start', offset: 900, duration: 900, intensity: 0.4, ...OPT }),
]);

const spareTheDying = design('Gentle healing steadies the dying creature’s faltering heartbeat until it is stable.', () => [
  cast('Healing touch', ['cast_generic.02.green', 'cast_generic.02.blue'], { stageId: 'sd-c', scale: 0.55, duration: 900 }),
  aura('Life steadied', ['healing_generic.200px.green'], { subject: 'targets', stageId: 'sd-a', after: 'sd-c', anchor: 'start', offset: 400, duration: 1800, scale: 0.8 }),
  impact('Heartbeat steadies', ['ui.heartbeat.01.green'], { after: 'sd-a', anchor: 'start', offset: 300, duration: 1800, scale: 0.5 }),
], { sound: 'healing' });

const spiritualWeapon = (conjure) => design('A floating, spectral weapon of force appears and swings at a creature near it.', () => [
  ...(conjure ? [cast('Spectral weapon summoned', ['divine_smite.caster.blueyellow'], { stageId: 'sw-c', scale: 0.6, duration: 1200 })] : []),
  impact('Spectral weapon strikes', ['spiritual_weapon.mace.01.spectral.01.blue', 'spiritual_weapon.mace.spectral.blue'], { stageId: 'sw-i', ...(conjure ? { after: 'sw-c', anchor: 'start', offset: 600 } : {}), duration: 2600, ...OPT }),
  motion('stagger', 'targets', { after: 'sw-i', anchor: 'start', offset: 1100, duration: 700, ...OPT }),
]);
const spiritualWeaponArea = design('A floating, spectral weapon of force materializes at the chosen point and swings at a creature near it.', () => [
  cast('Spectral weapon summoned', ['divine_smite.caster.blueyellow'], { stageId: 'swa-c', scale: 0.6, duration: 1200 }),
  area('Spectral weapon appears', ['spiritual_weapon.mace.01.spectral.01.blue', 'spiritual_weapon.mace.spectral.blue'], { stageId: 'swa-a', after: 'swa-c', anchor: 'start', offset: 600, duration: 2600 }),
  motion('stagger', 'targets', { after: 'swa-a', anchor: 'start', offset: 1100, duration: 700, ...OPT }),
]);

const stoneskin = design('The willing creature’s flesh turns as hard as stone, shrugging off mundane blows.', () => [
  cast('Earth gathers', ['cast_generic.earth.01.browngreen'], { stageId: 'sk-c', scale: 0.6, duration: 1000 }),
  aura('Rock grit swirls', ['aura_themed.01.inward.complete.metal.01.grey'], { subject: 'targets', stageId: 'sk-g', after: 'sk-c', anchor: 'start', offset: 400, duration: 1800, scale: 1.1, ...tint('#8b7d6b') }),
  aura('Flesh hardens to stone', ['shield.01.complete.01.white', 'shield.01.complete.01.blue'], { subject: 'targets', after: 'sk-g', anchor: 'start', offset: 600, duration: 2200, ...tint('#8b7d6b') }),
  motion('brace', 'targets', { after: 'sk-g', anchor: 'start', offset: 700, duration: 1000 }),
], { sound: 'earth' });

const stormOfVengeance = design('A churning storm cloud forms overhead; lightning flashes and thunder rolls, deafening those beneath.', () => [
  cast('Storm summoned', ['static_electricity.02.blue'], { stageId: 'sv-c', scale: 0.8, duration: 1200 }),
  area('Churning storm cloud', ['fog_cloud.01.white'], { stageId: 'sv-a', after: 'sv-c', anchor: 'start', offset: 500, duration: 4500, opacity: 0.75, fadeIn: 700, fadeOut: 900, ...tint('#5a6474') }),
  area('Lightning flashes', ['call_lightning.high_res.blue'], { after: 'sv-a', anchor: 'start', offset: 900, duration: 3000, opacity: 0.85 }),
  impact('Thunder peals', ['thunderwave.center.blue'], { after: 'sv-a', anchor: 'start', offset: 1300, duration: 1400, scale: 0.6, ...OPT }),
  motion('stagger', 'targets', { after: 'sv-a', anchor: 'start', offset: 1400, duration: 800, ...OPT }),
], { sound: 'lightningBolt' });

const sunburst = design('Brilliant sunlight flashes across the whole sphere, searing and blinding creatures caught in it.', () => [
  cast('Sunlight gathers', ['divine_smite.caster.yellowwhite', 'divine_smite.caster.blueyellow'], { stageId: 'sb-c', scale: 0.7, duration: 1200 }),
  area('Brilliant flash', ['explosion.05.yellowwhite', 'explosion.03.blueyellow'], { stageId: 'sb-a', after: 'sb-c', anchor: 'start', offset: 600, duration: 2200 }),
  area('Lingering glare', ['twinkling_stars.points08.white'], { after: 'sb-a', anchor: 'start', offset: 400, duration: 2200, opacity: 0.8 }),
  motion('cower', 'targets', { after: 'sb-a', anchor: 'start', offset: 300, duration: 1100, ...OPT }),
], { sound: 'holy' });

const sunbeamRecast = design('A new 5-foot-wide beam of brilliant sunlight blasts from the caster’s hand.', () => [
  cast('Sunlight in hand', ['divine_smite.caster.yellowwhite', 'divine_smite.caster.blueyellow'], { stageId: 'sbr-c', scale: 0.55, duration: 800 }),
  area('Beam of sunlight', ['breath_weapons02.burst.line.holy.yellow.01', 'breath_weapons02.burst.line.fire.orange.01'], { stageId: 'sbr-t', after: 'sbr-c', anchor: 'start', offset: 300, duration: 1600, scale: 2.2, ...tint('#fff1a8') }),
  motion('cower', 'targets', { after: 'sbr-t', anchor: 'end', offset: -120, duration: 900, ...OPT }),
]);

const telekinesis = (lift) => design('The caster seizes the target by thought alone and moves it through the air.', () => [
  cast('Mental grip', ['cast_shape.circle.01.purple', 'cast_shape.circle.01.blue'], { stageId: 'tk-c', scale: 0.6, duration: 900 }),
  travel('Telekinetic hold', ['energy_strands.range.standard.purple.01'], { stageId: 'tk-t', after: 'tk-c', anchor: 'start', offset: 400, duration: 2400, opacity: 0.75, ...OPT }),
  aura('Held in force', ['energy_strands.overlay.purple.01', 'energy_strands.overlay.blue.01'], { subject: 'targets', after: 'tk-t', anchor: 'start', offset: 200, duration: 2400, ...OPT }),
  motion(lift ? 'levitate' : 'drift', 'targets', { after: 'tk-t', anchor: 'start', offset: 300, duration: 2200, intensity: 0.8, ...OPT }),
], { sound: 'psychic' });

const timeStop = design('The flow of time halts for everyone but the caster: a ripple of stillness spreads outward around arcane clockwork.', () => [
  cast('Time halts', ['cast_shape.circle.01.blue'], { stageId: 'ts-c', scale: 0.7, duration: 1000 }),
  aura('Arcane clockwork', ['magic_signs.circle.02.transmutation.complete.blue', 'magic_signs.circle.02.transmutation.complete.yellow'], { stageId: 'ts-m', after: 'ts-c', anchor: 'start', offset: 400, duration: 3200, scale: 1.6, below: true, ...spin(9000) }),
  aura('Stillness ripples outward', ['extras.tmfx.outpulse.circle.01.slow', 'extras.tmfx.outpulse.circle.01.normal'], { after: 'ts-m', anchor: 'start', offset: 300, duration: 2400, scale: 4, opacity: 0.6 }),
  motion('pulse', 'source', { after: 'ts-m', anchor: 'start', duration: 1000, intensity: 0.4 }),
], { sound: 'time' });

const tinyHut = design('A stationary dome of force springs into existence around and above the caster.', () => [
  cast('Force gathers', ['cast_shape.circle.01.blue'], { stageId: 'th-c', scale: 0.6, duration: 1000 }),
  area('Dome of force', ['wall_of_force.sphere.blue', 'wall_of_force.sphere.grey'], { stageId: 'th-a', after: 'th-c', anchor: 'start', offset: 500, duration: 3600, opacity: 0.55, fadeIn: 500, fadeOut: 800 }),
  area('Dome base', ['energy_field.02.below.blue'], { after: 'th-a', anchor: 'start', duration: 3600, opacity: 0.35, below: true, fadeIn: 500, fadeOut: 800 }),
], { sound: 'force' });

const vitriolicSphere = design('A glowing ball of acid streaks to the point and explodes in a 20-foot sphere of corrosive spray.', () => [
  cast('Acid gathers', ['cast_generic.02.green', 'cast_generic.02.blue'], { stageId: 'vs-c', scale: 0.6, duration: 800 }),
  travel('Ball of acid streaks', ['fireball.beam.dark_green', 'fireball.beam.orange'], { stageId: 'vs-t', after: 'vs-c', anchor: 'start', offset: 350, duration: 1500, travelDestination: 'area', ...tint('#8fd14f') }),
  area('Acid explodes', ['explosion.04.green', 'explosion.02.blue'], { stageId: 'vs-a', after: 'vs-t', anchor: 'end', offset: -150, duration: 1800, ...tint('#8fd14f') }),
  area('Corrosive splash', ['liquid.splash.bright_green', 'liquid.splash.blue'], { after: 'vs-a', anchor: 'start', offset: 200, duration: 2000, ...tint('#7fd13a') }),
  motion('stagger', 'targets', { after: 'vs-a', anchor: 'start', offset: 200, duration: 800, ...OPT }),
]);

const vampiricTouch = design('A shadow-wreathed hand strikes and siphons the creature’s life force back into the caster.', () => [
  cast('Shadow-wreathed hand', ['smoke.puff.centered.dark_purple', 'smoke.puff.centered.grey'], { stageId: 'vt-c', scale: 0.55, duration: 900 }),
  motion('lunge', 'source', { after: 'vt-c', anchor: 'start', offset: 300, duration: 900 }),
  impact('Necrotic touch', ['impact.004.dark_purple', 'impact.004.blue'], { stageId: 'vt-i', after: 'vt-c', anchor: 'start', offset: 650, duration: 1100, scale: 0.8, ...tint('#4b1f5e') }),
  travel('Life force siphoned', ['energy_strands.range.standard.dark_red.01', 'energy_strands.range.standard.purple.01'], { stageId: 'vt-t', after: 'vt-i', anchor: 'start', offset: 250, duration: 1800, travelOrigin: 'target', travelDestination: 'source', opacity: 0.9 }),
  aura('Caster restored', ['healing_generic.200px.red', 'healing_generic.200px.purple'], { after: 'vt-t', anchor: 'end', offset: -400, duration: 1500, scale: 0.8 }),
  motion('stagger', 'targets', { after: 'vt-i', anchor: 'start', duration: 800 }),
], { sound: 'drain' });

const wallOfFireLine = design('A wall of fire roars up along the chosen line on solid ground.', () => [
  cast('Flames gather', ['cast_generic.fire.01.orange'], { stageId: 'wf-c', scale: 0.8, duration: 1000 }),
  area('Wall of fire rises', ['wall_of_fire.300x100.yellow'], { after: 'wf-c', anchor: 'start', offset: 500, duration: 4200, fadeIn: 500, fadeOut: 800 }),
], { sound: 'fireWall' });
const wallOfFireRing = design('A ringed wall of fire roars up around the chosen point.', () => [
  cast('Flames gather', ['cast_generic.fire.01.orange'], { stageId: 'wr-c', scale: 0.8, duration: 1000 }),
  area('Ring of fire rises', ['wall_of_fire.ring.yellow', 'wall_of_fire.Ring.yellow'], { after: 'wr-c', anchor: 'start', offset: 500, duration: 4200, fadeIn: 500, fadeOut: 800 }),
], { sound: 'fireWall' });

const wallOfForcePanels = design('An invisible wall of force panels springs into existence, glimpsed only as a faint shimmer.', () => [
  cast('Force gathers', ['cast_shape.square.01.blue'], { stageId: 'wfp-c', scale: 0.6, duration: 1000 }),
  area('Force panels', ['wall_of_force.vertical.blue', 'wall_of_force.vertical.grey'], { after: 'wfp-c', anchor: 'start', offset: 450, duration: 3600, opacity: 0.5, fadeIn: 500, fadeOut: 900 }),
]);
const wallOfForceDome = design('An invisible hemisphere of force springs into existence, glimpsed only as a faint shimmer.', () => [
  cast('Force gathers', ['cast_shape.circle.01.blue'], { stageId: 'wfd-c', scale: 0.6, duration: 1000 }),
  area('Force dome', ['wall_of_force.sphere.blue', 'wall_of_force.sphere.grey'], { after: 'wfd-c', anchor: 'start', offset: 450, duration: 3600, opacity: 0.5, fadeIn: 500, fadeOut: 900 }),
]);

const wallOfThornsLine = design('A wall of tough, tangled brush bristling with needle-sharp thorns grows up along the line.', () => [
  cast('Growth stirs', ['swirling_leaves.complete.01.green'], { stageId: 'wt-c', scale: 0.8, duration: 1100 }),
  area('Thorny brush wall', ['vine.complete.nature.group.01.green'], { after: 'wt-c', anchor: 'start', offset: 500, duration: 4000, areaLayout: 'tiles' }),
], { sound: 'thornWall' });

const windWall = design('A wall of strong wind rises from the ground along the chosen line.', () => [
  cast('Winds gather', ['wind_lines.01.01.white'], { stageId: 'ww-c', scale: 0.8, duration: 1100 }),
  area('Wall of wind', ['wind_wall.500x100'], { after: 'ww-c', anchor: 'start', offset: 400, duration: 4000, fadeIn: 400, fadeOut: 800 }),
]);

const silence = design('A sphere of absolute silence settles over the area; no sound can pass in or out.', () => [
  cast('Hushing gesture', ['cast_generic.01.dark_purple', 'cast_shape.circle.01.blue'], { stageId: 'si-c', scale: 0.6, duration: 1000 }),
  area('Muffled sphere', ['energy_field.02.below.blue'], { stageId: 'si-a', after: 'si-c', anchor: 'start', offset: 500, duration: 3600, opacity: 0.35, below: true, fadeIn: 600, fadeOut: 900 }),
  area('Sound stilled', ['icon.mute.blue', 'icon.mute.dark_red'], { after: 'si-a', anchor: 'start', offset: 300, duration: 2600, scale: 0.3, opacity: 0.7 }),
], { sound: null });

const passWithoutTrace = (useArea) => design('A veil of shadow and silence settles over the caster and companions, masking them from detection.', () => [
  cast('Veil drawn', ['smoke.puff.centered.dark_black', 'smoke.puff.centered.grey'], { stageId: 'pw-c', scale: 0.7, duration: 1100 }),
  (useArea ? area : aura)('Veil of shadows', ['darkness.black'], { stageId: 'pw-a', after: 'pw-c', anchor: 'start', offset: 400, duration: 3200, opacity: 0.35, fadeIn: 600, fadeOut: 900, ...(useArea ? {} : { scale: 3 }) }),
  aura('Tracks fade', ['footprints.shoe.grey'], { after: 'pw-a', anchor: 'start', offset: 300, duration: 2000, scale: 0.8, opacity: 0.5, below: true, fadeOut: 1200 }),
], { sound: null });

const wordOfRecall = design('The caster and nearby companions vanish in a flash of divine light, recalled to their sanctuary.', () => [
  cast('Word of recall', ['divine_smite.caster.yellowwhite', 'divine_smite.caster.blueyellow'], { stageId: 'wr-c', scale: 0.7, duration: 1100 }),
  cast('Divine departure', ['teleport.01.yellow', 'teleport.01.blue'], { stageId: 'wr-t', after: 'wr-c', anchor: 'start', offset: 500, duration: 1800 }),
  motion('flicker', 'source', { after: 'wr-t', anchor: 'start', offset: 300, duration: 1200 }),
  motion('flicker', 'targets', { after: 'wr-t', anchor: 'start', offset: 300, duration: 1200, ...OPT }),
], { sound: 'teleport' });

const magicWeapon = design('A touch infuses the weapon with magic; it gleams with a steady arcane shine.', () => [
  cast('Enchanting touch', ['magic_signs.rune.transmutation.complete.yellow'], { stageId: 'mw-c', scale: 0.45, duration: 1200 }),
  aura('Weapon gleams', ['glint.yellow.many'], { subject: 'targets', stageId: 'mw-g', after: 'mw-c', anchor: 'start', offset: 500, duration: 2200, scale: 0.9 }),
  aura('Arcane sheen', ['on_token_buff.001.001.orangeyellow'], { subject: 'targets', after: 'mw-g', anchor: 'start', duration: 2000, opacity: 0.7 }),
]);

const shiningSmite = design('The strike flares with radiance and leaves the target shedding bright light that betrays it.', () => [
  impact('Radiant smite', ['divine_smite.target.yellowwhite', 'divine_smite.target.blueyellow'], { stageId: 'sh-i', duration: 2000 }),
  aura('Target glows', ['markers.light.complete.yellow', 'markers.light.complete.blue'], { subject: 'targets', after: 'sh-i', anchor: 'start', offset: 700, duration: 2400, opacity: 0.8 }),
  motion('stagger', 'targets', { after: 'sh-i', anchor: 'start', offset: 200, duration: 800 }),
], { sound: 'holy' });

const starryWisp = design('A mote of starlight flies at the target and leaves it outlined in a faint, twinkling glow.', () => [
  cast('Mote of light', ['twinkling_stars.points04.white'], { stageId: 'st-c', scale: 0.5, duration: 900 }),
  travel('Starry mote', ['guiding_bolt.01.blueyellow'], { stageId: 'st-t', after: 'st-c', anchor: 'start', offset: 400, duration: 1800, scale: 0.5 }),
  impact('Twinkling outline', ['twinkling_stars.points07.white'], { after: 'st-t', anchor: 'end', offset: -120, duration: 2200, scale: 0.7 }),
  motion('recoil', 'targets', { after: 'st-t', anchor: 'end', offset: -120, duration: 650 }),
]);

const planarAlly = design('An otherworldly entity answers the plea and sends its servant through a planar gate.', () => [
  cast('Beseeching circle', ['magic_signs.circle.02.conjuration.complete.purple', 'magic_signs.circle.02.conjuration.complete.yellow'], { stageId: 'pa-c', scale: 0.7, duration: 1600, below: true }),
  area('Planar gate opens', ['portals.horizontal.ring.purple', 'portals.horizontal.ring.bright_yellow'], { after: 'pa-c', anchor: 'start', offset: 700, duration: 3600, fadeIn: 400, fadeOut: 800 }),
], { sound: 'summon' });

export default {
  // Hypnotic Pattern
  'dnd5e:dnd5e-spells-6g3WLOZ2u0EbaLAd': hypnoticPattern,
  'dnd5e:dnd5e-spells24-phbsplHypnoticPa': hypnoticPattern,
  // Imprisonment
  'dnd5e:dnd5e-spells-ZVnL9L8v1KC9TBF4': imprisonment,
  'dnd5e:dnd5e-spells24-phbsplImprisonme': imprisonment,
  // Incendiary Cloud
  'dnd5e:dnd5e-spells-pV04y1iXoWiom6bp:dnd5eactivity000': incendiaryCloud,
  'dnd5e:dnd5e-spells-pV04y1iXoWiom6bp:uUuWEYPhEPpuKXqq': incendiaryTick,
  'dnd5e:dnd5e-spells24-phbsplIncendiary:Hhw0octbLetO5Nsi': incendiaryCloud,
  'dnd5e:dnd5e-spells24-phbsplIncendiary:lLAC6qfRLaes7956': incendiaryTick,
  // Inflict Wounds
  'dnd5e:dnd5e-spells-ksaaTxIbKx2sJfia': inflictWounds,
  'dnd5e:dnd5e-spells24-phbsplInflictWou': inflictWounds,
  // Irresistible Dance
  'dnd5e:dnd5e-spells-TfRzwEgBHHkCc6Ql:af27rp79fhRL6TwF': danceCast,
  'dnd5e:dnd5e-spells-TfRzwEgBHHkCc6Ql:MZXH72uYT07j4vlL': danceSave,
  'dnd5e:dnd5e-spells24-phbsplOttosIrres': danceCast,
  // Knock
  'dnd5e:dnd5e-spells-1nhIxh0DsJsntCfj': knock,
  'dnd5e:dnd5e-spells24-phbsplKnock00000': knock,
  // Longstrider
  'dnd5e:dnd5e-spells-B0pnIcc52O6G8hi8': longstrider,
  'dnd5e:dnd5e-spells24-phbsplLongstride': longstrider,
  // Mage Hand
  'dnd5e:dnd5e-spells-Utk1OQRwYkMkFRD3:dnd5eactivity000': mageHand,
  'dnd5e:dnd5e-spells-Utk1OQRwYkMkFRD3:EDuPcfsfb5cGEpiI': mageHand,
  'dnd5e:dnd5e-spells24-phbsplMageHand00': mageHand,
  // Magic Circle
  'dnd5e:dnd5e-spells-y8A4HfTwd93ypdEz:80Tb8x1GUu4ZcO7R': magicCircle('blue', 'blue', ''),
  'dnd5e:dnd5e-spells-y8A4HfTwd93ypdEz:71GHgEVbu7CwzCUg': magicCircle('purple', 'dark_blue', 'inverted '),
  'dnd5e:dnd5e-spells24-phbsplMagicCircl': magicCircle('blue', 'blue', ''),
  // Magic Missile
  'dnd5e:dnd5e-spells-41JIhpDyM9Anm7cs': magicMissile,
  'dnd5e:dnd5e-spells24-phbsplMagicMissi': magicMissile,
  // Magic Weapon
  'dnd5e:dnd5e-spells-Sgjrf8qqv97CCWM4': magicWeapon,
  'dnd5e:dnd5e-spells24-phbsplMagicWeapo': magicWeapon,
  // Magnificent Mansion
  'dnd5e:dnd5e-spells-pn4SnsFDvYDiE6rC': mansionDoor(false),
  'dnd5e:dnd5e-spells24-phbMagnificentMa': mansionDoor(true),
  // Maze
  'dnd5e:dnd5e-spells-clwv2PWOcT822hlr:dnd5eactivity000': maze,
  'dnd5e:dnd5e-spells24-phbsplMaze000000': maze,
  // Meteor Swarm
  'dnd5e:dnd5e-spells-mF52ldF79Cr7wfQo': meteorSwarm,
  'dnd5e:dnd5e-spells24-phbsplMeteorSwar': meteorSwarm,
  // Mind Blank
  'dnd5e:dnd5e-spells-bllEWfm9xfEKynhv': mindBlank,
  'dnd5e:dnd5e-spells24-phbsplMindBlank0': mindBlank,
  // Mirror Image
  'dnd5e:dnd5e-spells-X4c8xCkmF8U9HUMz:dnd5eactivity000': mirrorImage,
  'dnd5e:dnd5e-spells-X4c8xCkmF8U9HUMz:rQbzIAnDXYbVe48y': mirrorIntercept,
  'dnd5e:dnd5e-spells24-phbsplMirrorImag': mirrorImage,
  // Mislead
  'dnd5e:dnd5e-spells-MBMaQLwoy05qzMJ3:dnd5eactivity000': mislead,
  'dnd5e:dnd5e-spells24-phbsplMislead000': mislead,
  // Misty Step
  'dnd5e:dnd5e-spells-wqfAVANuQonNBgnL': mistyStep,
  'dnd5e:dnd5e-spells24-phbsplMistyStep0': mistyStep,
  // Moonbeam
  'dnd5e:dnd5e-spells-bV3yun6MIuFj71Er:dnd5eactivity000': moonbeamBurn,
  'dnd5e:dnd5e-spells-bV3yun6MIuFj71Er:JKOXpZM16ErnikPJ': moonbeamConjure,
  'dnd5e:dnd5e-spells24-phbsplMoonbeam00': moonbeamConjure,
  // Pass without Trace
  'dnd5e:dnd5e-spells-pRMvmknwLf2tdMTj': passWithoutTrace(true),
  'dnd5e:dnd5e-spells24-phbsplPasswithou': passWithoutTrace(false),
  // Phantasmal Killer
  'dnd5e:dnd5e-spells-BYNvBJzHcF5VJhXw:dnd5eactivity000': phantasmalKiller(true),
  'dnd5e:dnd5e-spells-BYNvBJzHcF5VJhXw:1UPMEailYa6ppMg6': phantasmalKiller(false),
  'dnd5e:dnd5e-spells24-phbsplPhantasmal': phantasmalKiller(true),
  // Planar Ally (2024)
  'dnd5e:dnd5e-spells24-phbsplPlanarAlly': planarAlly,
  // Poison Spray
  'dnd5e:dnd5e-spells-g2u9PYfqWQAyg9OI': poisonSpray,
  'dnd5e:dnd5e-spells24-phbsplPoisonSpra': poisonSpray,
  // Prismatic Spray (initial cone)
  'dnd5e:dnd5e-spells-eGMhwmuleAM46C6L:dnd5eactivity000': prismaticSprayCast,
  'dnd5e:dnd5e-spells24-phbsplPrismaticS:jsiTqb3Jhwz0bIDS': prismaticSprayCast,
  // Purify Food and Drink
  'dnd5e:dnd5e-spells-Kn7K5PtYUJAKZTTp': purify,
  'dnd5e:dnd5e-spells24-phbsplPurifyFood': purify,
  // Raising the dead
  'dnd5e:dnd5e-spells-AGFMPAmuzwWO6Dfz': revive,
  'dnd5e:dnd5e-spells24-phbsplRaiseDead0': revive,
  'dnd5e:dnd5e-spells-LmRHHMtplpxr9fX6': revive,
  'dnd5e:dnd5e-spells24-phbsplRevivify00': revive,
  'dnd5e:dnd5e-spells-jhhT9PsHy5A7EojO': revive,
  'dnd5e:dnd5e-spells24-phbsplResurrecti:IEI29s99C2llhqEo': revive,
  'dnd5e:dnd5e-spells24-phbsplResurrecti:EMbtn8GwrximmlvQ': revive,
  'dnd5e:dnd5e-spells-qLeEXZDbW5y4bmLY': revive,
  'dnd5e:dnd5e-spells24-phbsplTrueResurr': revive,
  'dnd5e:dnd5e-spells-zMEo5DKK8uxsuWnq': reincarnate,
  'dnd5e:dnd5e-spells24-phbsplReincarnat': reincarnate,
  // Reverse Gravity
  'dnd5e:dnd5e-spells-ERCv7yuRkQ0YjGx6:dnd5eactivity000': reverseGravityGrab,
  'dnd5e:dnd5e-spells-ERCv7yuRkQ0YjGx6:kQCUtqvQ2Rt07RYM': reverseGravity,
  'dnd5e:dnd5e-spells24-phbsplReverseGra': reverseGravity,
  // Scorching Ray
  'dnd5e:dnd5e-spells-7u2obDvuvtZBkTfq:dnd5eactivity000': scorchingRay,
  'dnd5e:dnd5e-spells24-phbsplScorchingR': scorchingRay,
  // Shining Smite
  'dnd5e:dnd5e-spells24-phbsplShiningSmi': shiningSmite,
  // Silence
  'dnd5e:dnd5e-spells-5VhqFROQYjr1P9lp': silence,
  'dnd5e:dnd5e-spells24-phbsplSilence000': silence,
  // Sleet Storm
  'dnd5e:dnd5e-spells-dhqBY4TvVjxVmOZd:PxwopGlJxRFIgDMc': sleetStorm,
  'dnd5e:dnd5e-spells24-phbsplSleetStorm': sleetStorm,
  // Spare the Dying
  'dnd5e:dnd5e-spells-8zT7njvqbpXs4Cel': spareTheDying,
  'dnd5e:dnd5e-spells24-phbsplSparetheDy': spareTheDying,
  // Spiritual Weapon
  'dnd5e:dnd5e-spells-JbxsYXxSOTZbf9I0:vdlxZxKmIlZiZ2Ij': spiritualWeaponArea,
  'dnd5e:dnd5e-spells-JbxsYXxSOTZbf9I0:edJeSEGfYmZKzrPa': spiritualWeapon(false),
  'dnd5e:dnd5e-spells24-phbsplSpiritualW': spiritualWeapon(true),
  // Starry Wisp
  'dnd5e:dnd5e-spells24-phbsplStarryWisp': starryWisp,
  // Stoneskin
  'dnd5e:dnd5e-spells-ReMbjfeOKoSj3O79': stoneskin,
  'dnd5e:dnd5e-spells24-phbsplStoneskin0': stoneskin,
  // Storm of Vengeance (initial storm)
  'dnd5e:dnd5e-spells-7KjExw0kmuqERa7C:Kb0mJl7JsrGs9OAN': stormOfVengeance,
  'dnd5e:dnd5e-spells24-phbsplStormofVen:8QALATRgSsmWWxCl': stormOfVengeance,
  // Sunbeam / Sunburst
  'dnd5e:dnd5e-spells24-phbsplSunbeam000:Y0cJvZuD7EfwGqkf': sunbeamRecast,
  'dnd5e:dnd5e-spells-hzK7FQya0BDjSmLE': sunburst,
  'dnd5e:dnd5e-spells24-phbsplSunburst00': sunburst,
  // Telekinesis
  'dnd5e:dnd5e-spells-HQfd7jJyULIoGxrZ:r5d5cLmb299gcJHl': telekinesis(true),
  'dnd5e:dnd5e-spells-HQfd7jJyULIoGxrZ:iSZxY9EGiZdtU7Re': telekinesis(false),
  'dnd5e:dnd5e-spells-HQfd7jJyULIoGxrZ:LggxvyYGcDJNHbou': telekinesis(true),
  'dnd5e:dnd5e-spells24-phbsplTelekinesi': telekinesis(true),
  // Time Stop
  'dnd5e:dnd5e-spells-JYuRBwxpoFhXduvD': timeStop,
  'dnd5e:dnd5e-spells24-phbsplTimeStop00': timeStop,
  // Tiny Hut (2024)
  'dnd5e:dnd5e-spells24-phbsplLeomundsTi': tinyHut,
  // Vampiric Touch
  'dnd5e:dnd5e-spells-UfHQhA54M4323gVO:2exFAw3zKK49UfZJ': vampiricTouch,
  'dnd5e:dnd5e-spells24-phbsplVampiricTo': vampiricTouch,
  // Vitriolic Sphere
  'dnd5e:dnd5e-spells24-phbsplVitriolicS:dnd5eactivity000': vitriolicSphere,
  // Wall of Fire
  'dnd5e:dnd5e-spells-X3DrXgxjwI2dvkD6:c7IcbrVmmq74Rzqn': wallOfFireLine,
  'dnd5e:dnd5e-spells-X3DrXgxjwI2dvkD6:M7ljtGAftvbGGZ0J': wallOfFireRing,
  'dnd5e:dnd5e-spells24-phbsplWallofFire:dnd5eactivity000': wallOfFireLine,
  'dnd5e:dnd5e-spells24-phbsplWallofFire:aLgpPe1PPRQ0zIrL': wallOfFireRing,
  // Wall of Force
  'dnd5e:dnd5e-spells-o9ZCvuD2B1OTcubb:dnd5eactivity000': wallOfForcePanels,
  'dnd5e:dnd5e-spells-o9ZCvuD2B1OTcubb:eNYZ6Nqn4KIaDDzD': wallOfForceDome,
  'dnd5e:dnd5e-spells24-phbsplWallofForc:obcyQX0IlwinXINV': wallOfForceDome,
  'dnd5e:dnd5e-spells24-phbsplWallofForc:O3uhE0OLzsAhHoAg': wallOfForcePanels,
  // Wall of Thorns (straight walls)
  'dnd5e:dnd5e-spells-AQsBc94ES7W7s7iG:dnd5eactivity000': wallOfThornsLine,
  'dnd5e:dnd5e-spells24-phbsplWallofThor:Az2cq7SukeQquptz': wallOfThornsLine,
  // Wind Wall
  'dnd5e:dnd5e-spells-ew6GA8dJy2spQmFW': windWall,
  'dnd5e:dnd5e-spells24-phbsplWindWall00:dnd5eactivity000': windWall,
  'dnd5e:dnd5e-spells24-phbsplWindWall00:H2KvnEEAgoE3YeK5': windWall,
  // Word of Recall (2014)
  'dnd5e:dnd5e-spells-76C0FdcxlU8F9Rl2': wordOfRecall,
};
