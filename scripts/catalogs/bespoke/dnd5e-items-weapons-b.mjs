// Bespoke compositions (dnd5e-items-weapons-b). Keys: '<system>:<entryId>' or '<system>:<entryId>:<variant|mode>'.
// See scripts/catalogs/bespoke/helpers.mjs and scripts/bespoke.mjs.
import { cast, travel, projectile, impact, area, aura, sprite, motion, tint, spin, breathe, design } from './helpers.mjs';

// Item activities often carry no template or target of their own, so every
// target-facing stage here is optional (skipped when nothing is targeted) and
// spell looks avoid template stages unless the activity itself places an area.
const OT = { optionalTargets: true };
const T1 = { optionalTargets: true, targetSelection: 'first' };
const ABILITY = { soundNamespace: 'ability' };

// ---------------------------------------------------------------------------
// Spell looks for "cast" activities (item casts a named spell from its charges).
// Each returns stages; `sound` is the spell sound profile.
// ---------------------------------------------------------------------------
const SPELLS = {
  'Cone of Cold': { sound: 'coldCone', why: 'a blast of cold air erupts in a cone', build: () => [
    cast('Frost gathers', ['cast_generic.ice.01.blue', 'cast_generic.02.blue'], { stageId: 'c', duration: 900, scale: 0.8 }),
    travel('Freezing cone', ['cone_of_cold.blue'], { stageId: 'cone', after: 'c', anchor: 'end', offset: -200, duration: 2000, ...T1 }),
    impact('Rime on targets', ['impact_themed.ice_shard.blue'], { after: 'cone', anchor: 'start', offset: 600, duration: 1300, scale: 0.8, ...OT }),
    motion('stagger', 'targets', { after: 'cone', anchor: 'start', offset: 650, duration: 700, ...OT }),
  ] },
  Fireball: { sound: 'fireball', why: 'a bright streak flashes to a point and blossoms into an explosion of flame', build: () => [
    cast('Ember gathers', ['cast_generic.fire.01.orange'], { stageId: 'c', duration: 900, scale: 0.8 }),
    travel('Fire streak', ['fireball.beam.orange'], { stageId: 'beam', after: 'c', anchor: 'end', offset: -250, duration: 1600, ...T1 }),
    impact('Fire blossom', ['fireball.explosion.orange'], { stageId: 'boom', after: 'beam', anchor: 'arrival', duration: 2200, scale: 1.4, ...T1 }),
    motion('stagger', 'targets', { after: 'beam', anchor: 'arrival', offset: 100, duration: 700, ...OT }),
  ] },
  'Globe of Invulnerability': { sound: 'shield', why: 'an immobile, shimmering barrier springs into existence around the caster', build: () => [
    cast('Abjuration circle', ['magic_signs.circle.02.abjuration.complete.blue'], { stageId: 'c', duration: 1400, scale: 1, below: true }),
    aura('Shimmering globe', ['wall_of_force.sphere.blue', 'wall_of_force.sphere.grey'], { after: 'c', anchor: 'start', offset: 500, duration: 3000, scale: 2.6, opacity: 0.75, fadeIn: 400, fadeOut: 600 }),
    motion('brace', 'source', { after: 'c', anchor: 'start', offset: 500, duration: 800 }),
  ] },
  'Hold Monster': { sound: 'chainBinding', why: 'the target is paralyzed in place by enchantment', build: () => [
    cast('Enchantment', ['magic_signs.circle.02.enchantment.complete.purple', 'magic_signs.circle.02.enchantment.complete.pink'], { stageId: 'c', duration: 1300, scale: 0.8 }),
    impact('Spectral bindings', ['markers.chain.spectral_standard.complete.02.purple', 'markers.chain.spectral_standard.complete.02.blue'], { after: 'c', anchor: 'start', offset: 500, duration: 2600, scale: 1.1, ...OT }),
    motion('shake', 'targets', { after: 'c', anchor: 'start', offset: 700, duration: 900, intensity: 0.4, ...OT }),
  ] },
  Levitate: { sound: 'wind', why: 'a creature or object rises vertically and hangs aloft', build: () => [
    cast('Transmutation', ['magic_signs.circle.02.transmutation.complete.yellow'], { stageId: 'c', duration: 1200, scale: 0.7 }),
    impact('Updraft', ['wind_lines.01.01.white'], { after: 'c', anchor: 'start', offset: 400, duration: 2000, scale: 0.8, opacity: 0.6, below: true, ...OT }),
    motion('levitate', 'targets', { after: 'c', anchor: 'start', offset: 450, duration: 2400, ...OT }),
  ] },
  'Lightning Bolt': { sound: 'lightningBolt', why: 'a stroke of lightning forms a 100-foot line from the caster', build: () => [
    cast('Static charge', ['static_electricity.01.blue'], { stageId: 'c', duration: 800, scale: 0.8 }),
    travel('Lightning bolt', ['lightning_bolt.wide.blue'], { stageId: 'bolt', after: 'c', anchor: 'end', offset: -200, duration: 1500, ...T1 }),
    impact('Arc strike', ['lightning_strike.blue'], { after: 'bolt', anchor: 'arrival', duration: 1100, scale: 0.7, ...OT }),
    motion('stagger', 'targets', { after: 'bolt', anchor: 'arrival', duration: 700, ...OT }),
  ] },
  'Magic Missile': { sound: 'forceMissile', why: 'three glowing darts of magical force each strike unerringly', build: () => [
    cast('Force gathers', ['cast_shape.circle.01.purple', 'cast_shape.circle.01.blue'], { stageId: 'c', duration: 800, scale: 0.6 }),
    travel('Three darts', ['magic_missile.purple'], { stageId: 'darts', after: 'c', anchor: 'end', offset: -200, duration: 1500, repeats: 3, repeatScope: 'total', repeatInterval: 220, ...OT }),
    impact('Dart hits', ['impact.004.pinkpurple', 'impact.004.blue'], { after: 'darts', anchor: 'arrival', duration: 900, scale: 0.5, repeats: 3, repeatScope: 'total', repeatInterval: 220, ...OT }),
  ] },
  'Ray of Enfeeblement': { sound: 'darkRay', why: 'a black beam of enervating energy saps the target\'s strength', build: () => [
    cast('Necrotic gathers', ['cast_generic.dark.01.red', 'cast_generic.01.yellow'], { stageId: 'c', duration: 800, scale: 0.6, ...tint('#2a1f33') }),
    travel('Black ray', ['energy_beam.normal.dark_greenpurple.02', 'energy_beam.normal.bluepink.02'], { stageId: 'ray', after: 'c', anchor: 'end', offset: -150, duration: 1500, ...T1, ...tint('#3a2a44') }),
    motion('cower', 'targets', { after: 'ray', anchor: 'arrival', duration: 900, ...OT }),
  ] },
  'Wall of Force': { sound: 'force', why: 'an invisible wall of force springs into existence', build: () => [
    cast('Evocation', ['cast_shape.square.01.blue'], { stageId: 'c', duration: 1000, scale: 0.7 }),
    impact('Force wall', ['wall_of_force.vertical.blue', 'wall_of_force.vertical.grey'], { after: 'c', anchor: 'start', offset: 400, duration: 2600, scale: 1.4, opacity: 0.7, ...T1 }),
  ] },
  'Giant Insect': { sound: 'swarm', why: 'nearby insects swell into giant forms', build: () => [
    cast('Conjuration', ['magic_signs.circle.02.transmutation.complete.green', 'magic_signs.circle.02.transmutation.complete.yellow'], { stageId: 'c', duration: 1300, scale: 0.8 }),
    impact('Insects swell', ['fireflies.few.01.green'], { after: 'c', anchor: 'start', offset: 400, duration: 2200, scale: 1, ...tint('#7a6a2a'), ...OT }),
    motion('pulse', 'targets', { after: 'c', anchor: 'start', offset: 600, duration: 1200, ...OT }),
  ] },
  'Insect Plague': { sound: 'swarm', why: 'swarming, biting locusts fill a sphere', build: () => [
    cast('Swarm called', ['cast_generic.earth.01.browngreen'], { stageId: 'c', duration: 900, scale: 0.7 }),
    impact('Locust swarm', ['fireflies.many.01.green'], { after: 'c', anchor: 'start', offset: 300, duration: 3200, scale: 2.4, ...tint('#6b5a2a'), ...T1 }),
    motion('shake', 'targets', { after: 'c', anchor: 'start', offset: 800, duration: 1200, intensity: 0.5, ...OT }),
  ] },
  'Arcane Lock': { sound: 'chainBinding', why: 'a closed door or container is magically locked', build: () => [
    cast('Abjuration', ['magic_signs.circle.02.abjuration.complete.blue'], { stageId: 'c', duration: 1200, scale: 0.6 }),
    impact('Lock rune', ['ward.rune.yellow.01'], { after: 'c', anchor: 'start', offset: 400, duration: 2000, scale: 0.6, ...tint('#7fb3ff'), ...T1 }),
  ] },
  'Conjure Elemental': { sound: 'summon', why: 'an elemental is summoned from a mass of its element', build: () => [
    cast('Conjuration', ['magic_signs.circle.02.conjuration.complete.yellow'], { stageId: 'c', duration: 1400, scale: 0.8 }),
    impact('Elemental vortex', ['portals.horizontal.vortex_masked.orange', 'portals.horizontal.ring.bright_yellow'], { after: 'c', anchor: 'start', offset: 500, duration: 2600, scale: 1.2, ...T1 }),
  ] },
  'Detect Magic': { sound: 'detect', why: 'the caster senses magic within 30 feet', build: () => [
    aura('Divination pulse', ['detect_magic.circle.purple', 'detect_magic.circle.blue'], { duration: 3000, scale: 3, opacity: 0.8, fadeOut: 500 }),
  ] },
  'Dispel Magic': { sound: 'dispel', why: 'magic on the target unravels and ends', build: () => [
    cast('Abjuration', ['magic_signs.circle.02.abjuration.complete.blue'], { stageId: 'c', duration: 1000, scale: 0.6 }),
    impact('Magic unravels', ['energy_strands.complete.blue.01'], { after: 'c', anchor: 'start', offset: 400, duration: 1800, scale: 0.9, ...T1 }),
    impact('Ward breaks', ['shield.01.outro_explode.blue'], { after: 'c', anchor: 'start', offset: 900, duration: 1200, scale: 0.8, ...T1 }),
  ] },
  'Enlarge/Reduce': { sound: 'transform', why: 'a creature grows or shrinks in size', build: () => [
    cast('Transmutation', ['magic_signs.circle.02.transmutation.complete.yellow'], { stageId: 'c', duration: 1200, scale: 0.7 }),
    impact('Size shift', ['on_token_buff.001.001.orangeyellow'], { after: 'c', anchor: 'start', offset: 400, duration: 1800, scale: 1, ...OT }),
    motion('pulse', 'targets', { after: 'c', anchor: 'start', offset: 500, duration: 1400, intensity: 1.2, ...OT }),
  ] },
  'Flaming Sphere': { sound: 'fire', why: 'a 5-foot sphere of fire appears and rolls at the caster\'s command', build: () => [
    cast('Ember gathers', ['cast_generic.fire.01.orange'], { stageId: 'c', duration: 800, scale: 0.6 }),
    projectile('Rolling sphere', ['flaming_sphere.200px.orange.01'], { stageId: 'ball', after: 'c', anchor: 'end', offset: -200, duration: 1800, scale: 0.9, ...T1 }),
    impact('Scorch', ['impact.fire.01.orange'], { after: 'ball', anchor: 'arrival', duration: 1100, scale: 0.7, ...T1 }),
  ] },
  'Ice Storm': { sound: 'cold', why: 'a hail of rock-hard ice pounds a cylinder', build: () => [
    cast('Frost gathers', ['cast_generic.ice.01.blue', 'cast_generic.02.blue'], { stageId: 'c', duration: 900, scale: 0.7 }),
    impact('Hailstorm', ['sleet_storm.02.blue'], { stageId: 'hail', after: 'c', anchor: 'start', offset: 300, duration: 3000, scale: 1.6, ...T1 }),
    impact('Ice shards', ['ice_spikes.radial.burst.white'], { after: 'hail', anchor: 'start', offset: 700, duration: 1600, scale: 1.2, ...T1 }),
    motion('press', 'targets', { after: 'hail', anchor: 'start', offset: 800, duration: 900, ...OT }),
  ] },
  Invisibility: { sound: null, why: 'the touched creature becomes invisible', build: () => [
    cast('Illusion', ['magic_signs.circle.02.illusion.complete.purple'], { stageId: 'c', duration: 1200, scale: 0.6 }),
    impact('Fading shimmer', ['shimmer.01.purple', 'shimmer.01.blue'], { after: 'c', anchor: 'start', offset: 400, duration: 1400, ...OT }),
    motion('flicker', 'targets', { after: 'c', anchor: 'start', offset: 500, duration: 1200, ...OT }),
  ] },
  Knock: { sound: 'unlock', why: 'a loud knock and a lock springs open', build: () => [
    cast('Transmutation', ['magic_signs.circle.02.transmutation.complete.yellow'], { stageId: 'c', duration: 1000, scale: 0.6 }),
    impact('Knock', ['impact.011.blue'], { after: 'c', anchor: 'start', offset: 400, duration: 1000, scale: 0.6, ...T1 }),
  ] },
  Light: { sound: 'light', why: 'an object sheds bright light', build: () => [
    impact('Object glows', ['markers.light_orb.complete.yellow', 'markers.light_orb.complete.blue'], { duration: 2400, scale: 0.8, ...T1 }),
    aura('Spark', ['twinkling_stars.points06.white'], { duration: 1200, scale: 0.4 }),
  ] },
  'Mage Hand': { sound: null, why: 'a spectral floating hand appears and manipulates an object', build: () => [
    projectile('Spectral hand', ['arcane_hand.purple', 'arcane_hand.blue'], { duration: 1800, scale: 0.5, opacity: 0.85, ...T1 }),
  ] },
  Passwall: { sound: 'teleport', why: 'a passage appears through a wooden, plaster or stone surface', build: () => [
    cast('Transmutation', ['magic_signs.circle.02.transmutation.complete.yellow'], { stageId: 'c', duration: 1000, scale: 0.6 }),
    impact('Passage opens', ['portals.vertical.ring_masked.orange', 'portals.vertical.ring.bright_yellow'], { after: 'c', anchor: 'start', offset: 400, duration: 2400, scale: 1, ...T1 }),
  ] },
  'Plane Shift': { sound: 'teleport', why: 'the caster and allies are transported to another plane', build: () => [
    cast('Planar circle', ['magic_signs.circle.02.conjuration.complete.purple', 'magic_signs.circle.02.conjuration.complete.yellow'], { stageId: 'c', duration: 1400, scale: 1, below: true }),
    aura('Planar rift', ['portals.horizontal.vortex.purple', 'portals.horizontal.ring.bright_yellow'], { after: 'c', anchor: 'start', offset: 500, duration: 2400, scale: 1.4, below: true }),
    motion('flicker', 'source', { after: 'c', anchor: 'start', offset: 1400, duration: 1200 }),
  ] },
  'Protection from Evil and Good': { sound: 'bless', why: 'a creature is warded against aberrations, fiends, undead and other planar beings', build: () => [
    cast('Abjuration', ['magic_signs.circle.02.abjuration.complete.yellow', 'magic_signs.circle.02.abjuration.complete.blue'], { stageId: 'c', duration: 1200, scale: 0.6 }),
    impact('Warding star', ['ward.star.yellow.01'], { after: 'c', anchor: 'start', offset: 400, duration: 2200, scale: 0.9, ...OT }),
  ] },
  Telekinesis: { sound: 'force', why: 'the caster moves a creature or object by thought', build: () => [
    travel('Telekinetic grip', ['energy_strands.range.standard.blue.01', 'energy_strands.range.multiple.purple.01'], { stageId: 'grip', duration: 2200, opacity: 0.85, ...T1 }),
    motion('levitate', 'targets', { after: 'grip', anchor: 'start', offset: 400, duration: 1800, ...OT }),
  ] },
  'Wall of Fire': { sound: 'fireWall', why: 'a wall of fire rises on a solid surface', build: () => [
    cast('Ember gathers', ['cast_generic.fire.01.orange'], { stageId: 'c', duration: 800, scale: 0.6 }),
    impact('Wall of fire', ['wall_of_fire.300x100.yellow'], { after: 'c', anchor: 'start', offset: 300, duration: 3000, scale: 1, ...T1 }),
  ] },
  Web: { sound: 'vines', why: 'thick, sticky webbing fills a cube', build: () => [
    cast('Conjuration', ['magic_signs.circle.02.conjuration.complete.yellow'], { stageId: 'c', duration: 900, scale: 0.6 }),
    impact('Webbing', ['web.complete.002.white'], { after: 'c', anchor: 'start', offset: 300, duration: 3000, scale: 1.4, ...T1 }),
    motion('shake', 'targets', { after: 'c', anchor: 'start', offset: 900, duration: 900, intensity: 0.4, ...OT }),
  ] },
  'Animal Friendship': { sound: null, why: 'a beast is charmed by the caster', build: () => [
    cast('Nature call', ['swirling_leaves.complete.01.green'], { stageId: 'c', duration: 1500, scale: 0.6 }),
    impact('Charmed', ['markers.heart.pink.01'], { after: 'c', anchor: 'start', offset: 500, duration: 2000, scale: 0.7, ...OT }),
  ] },
  Awaken: { sound: 'growth', why: 'a beast or plant gains intelligence after a long ritual', build: () => [
    cast('Nature magic', ['swirling_leaves.complete.02.green'], { stageId: 'c', duration: 1500, scale: 0.7 }),
    impact('Awakening', ['plant_growth.03.round.2x2.complete.greenyellow'], { after: 'c', anchor: 'start', offset: 400, duration: 2400, scale: 1, below: true, ...OT }),
    impact('Spark of mind', ['twinkling_stars.points08.white'], { after: 'c', anchor: 'start', offset: 1200, duration: 1400, scale: 0.6, ...OT }),
  ] },
  Barkskin: { sound: 'growth', why: 'the target\'s skin takes on a rough, bark-like appearance', build: () => [
    impact('Bark covers skin', ['aura_themed.01.inward.complete.wood.01.green'], { duration: 2600, scale: 1, ...OT }),
    motion('brace', 'targets', { delay: 500, duration: 800, ...OT }),
  ] },
  'Locate Animals or Plants': { sound: 'detect', why: 'the caster senses the direction of a named beast or plant', build: () => [
    aura('Nature sense', ['detect_magic.circle.green', 'detect_magic.circle.blue'], { duration: 2800, scale: 3, opacity: 0.7, fadeOut: 500 }),
    aura('Leaves stir', ['swirling_leaves.complete.01.green'], { duration: 2000, scale: 0.7 }),
  ] },
  'Pass without Trace': { sound: null, why: 'a veil of shadows and silence hides the caster and companions', build: () => [
    aura('Shadow veil', ['smoke.puff.ring.01.dark_black', 'smoke.puff.ring.01.white'], { duration: 1800, scale: 1.6, opacity: 0.7 }),
    aura('Tracks fade', ['footprints.shoe.grey'], { delay: 300, duration: 2200, scale: 0.8, opacity: 0.5, fadeOut: 900, below: true }),
    motion('drift', 'source', { delay: 300, duration: 1400 }),
  ] },
  'Speak with Animals': { sound: null, why: 'the caster can comprehend and communicate with beasts', build: () => [
    aura('Nature voice', ['swirling_leaves.complete.02.green'], { duration: 2000, scale: 0.6 }),
    aura('Words', ['markers.music_note.blue.01'], { delay: 400, duration: 1800, scale: 0.5, offsetY: -0.5, offsetUnits: 'token', ...tint('#8bc86a') }),
  ] },
  'Speak with Plants': { sound: 'growth', why: 'plants gain limited sentience and speak with the caster', build: () => [
    aura('Plants stir', ['plant_growth.03.round.2x2.complete.greenyellow'], { duration: 2400, scale: 1.4, below: true }),
    aura('Leaves whisper', ['swirling_leaves.complete.01.green'], { delay: 300, duration: 2000, scale: 0.6 }),
  ] },
  'Wall of Thorns': { sound: 'thornWall', why: 'a wall of tough, pliable, tangled brush bristling with needle-sharp thorns', build: () => [
    cast('Nature magic', ['swirling_leaves.complete.01.green'], { stageId: 'c', duration: 900, scale: 0.6 }),
    impact('Thorn wall', ['vine.complete.nature.group.01.green'], { after: 'c', anchor: 'start', offset: 300, duration: 3000, scale: 1.4, ...T1 }),
    impact('Brambles', ['entangle.green'], { after: 'c', anchor: 'start', offset: 600, duration: 2400, scale: 1.2, below: true, ...T1 }),
  ] },
  'Dominate Beast': { sound: 'psychic', why: 'the caster seizes control of a beast\'s mind', build: () => [
    cast('Enchantment', ['magic_signs.circle.02.enchantment.complete.purple', 'magic_signs.circle.02.enchantment.complete.pink'], { stageId: 'c', duration: 1300, scale: 0.7 }),
    impact('Mind seized', ['eyes.01.purple.single', 'eyes.01.dark_green.single'], { after: 'c', anchor: 'start', offset: 500, duration: 1800, scale: 0.6, offsetY: -0.4, offsetUnits: 'token', ...OT }),
    motion('cower', 'targets', { after: 'c', anchor: 'start', offset: 600, duration: 900, ...OT }),
  ] },
  'Chain Lightning': { sound: 'chainLightning', why: 'a bolt of lightning arcs to a target and then leaps to up to three others', build: () => [
    cast('Static charge', ['static_electricity.01.blue'], { stageId: 'c', duration: 800, scale: 0.8 }),
    travel('Primary bolt', ['chain_lightning.primary.blue'], { stageId: 'p', after: 'c', anchor: 'end', offset: -200, duration: 1300, ...T1 }),
    travel('Leaping arcs', ['chain_lightning.secondary.blue'], { stageId: 's', after: 'p', anchor: 'arrival', duration: 1200, travelOrigin: 'previousTarget', targetSelection: 'secondary', targetStagger: 200, optionalTargets: true }),
    motion('stagger', 'targets', { after: 'p', anchor: 'arrival', duration: 700, ...OT }),
  ] },
  'Feather Fall': { sound: 'wind', why: 'falling creatures descend slowly, as if on a feather', build: () => [
    impact('Drifting feathers', ['swirling_feathers.outburst.01.textured'], { duration: 2200, scale: 0.9, ...OT }),
    motion('drift', 'targets', { delay: 300, duration: 1600, ...OT }),
  ] },
  'Gust of Wind': { sound: 'wind', why: 'a line of strong wind blasts from the caster, pushing creatures away', build: () => [
    travel('Gust', ['gust_of_wind.default'], { stageId: 'g', duration: 1800, ...T1 }),
    motion('stagger', 'targets', { after: 'g', anchor: 'arrival', duration: 900, intensity: 1.2, ...OT }),
  ] },
  'Wind Wall': { sound: 'wind', why: 'a wall of strong wind rises from the ground', build: () => [
    cast('Wind gathers', ['wind_lines.01.02.white'], { stageId: 'c', duration: 900, scale: 0.7 }),
    impact('Wind wall', ['wind_wall.300x100'], { after: 'c', anchor: 'start', offset: 300, duration: 3000, scale: 1, ...T1 }),
  ] },
  Gate: { sound: 'teleport', why: 'a portal links an unoccupied space to a precise location on another plane', build: () => [
    cast('Conjuration', ['magic_signs.circle.02.conjuration.complete.purple', 'magic_signs.circle.02.conjuration.complete.yellow'], { stageId: 'c', duration: 1300, scale: 0.8 }),
    impact('Planar gate', ['portals.vertical.vortex.purple', 'portals.vertical.ring.bright_yellow'], { after: 'c', anchor: 'start', offset: 500, duration: 3200, scale: 1.4, ...T1 }),
  ] },
  Polymorph: { sound: 'transform', why: 'a creature is transformed into a new beast form', build: () => [
    cast('Transmutation', ['magic_signs.circle.02.transmutation.complete.yellow'], { stageId: 'c', duration: 1200, scale: 0.7 }),
    impact('Form shifts', ['smoke.puff.centered.green', 'smoke.puff.centered.grey'], { after: 'c', anchor: 'start', offset: 400, duration: 1800, scale: 1.2, ...OT }),
    motion('spin', 'targets', { after: 'c', anchor: 'start', offset: 500, duration: 900, ...OT }),
  ] },
  Scrying: { sound: 'detect', why: 'the caster sees and hears a chosen creature through a scrying sensor', build: () => [
    cast('Divination', ['magic_signs.circle.02.divination.complete.blue'], { stageId: 'c', duration: 1500, scale: 0.8 }),
    aura('Scrying eye', ['eyes.01.bluegreen.single', 'eyes.01.dark_green.single'], { after: 'c', anchor: 'start', offset: 500, duration: 2200, scale: 0.6, offsetY: -0.5, offsetUnits: 'token' }),
  ] },
  'Detect Thoughts': { sound: 'psychic', why: 'the caster reads the surface thoughts of nearby creatures', build: () => [
    cast('Divination', ['magic_signs.circle.02.divination.complete.purple', 'magic_signs.circle.02.divination.complete.blue'], { stageId: 'c', duration: 1300, scale: 0.7 }),
    impact('Thoughts read', ['eyes.01.purple.few', 'eyes.01.dark_green.few'], { after: 'c', anchor: 'start', offset: 500, duration: 2000, scale: 0.6, offsetY: -0.4, offsetUnits: 'token', ...OT }),
  ] },
  Suggestion: { sound: 'psychic', why: 'the caster suggests a course of activity to a creature', build: () => [
    cast('Enchantment', ['magic_signs.circle.02.enchantment.complete.pink'], { stageId: 'c', duration: 1300, scale: 0.7 }),
    travel('Whispered suggestion', ['spell_projectile.music_note.pink', 'spell_projectile.ice_shard.blue'], { stageId: 'w', after: 'c', anchor: 'start', offset: 400, duration: 1500, scale: 0.6, ...T1, ...tint('#d98ad8') }),
    impact('Mind sways', ['markers.heart.pink.01'], { after: 'w', anchor: 'arrival', duration: 1600, scale: 0.6, ...OT }),
  ] },
  'Mage Armor': { sound: 'shield', why: 'a protective magical force surrounds a willing creature', build: () => [
    impact('Force armor', ['shield.02.complete.01.blue', 'shield.01.complete.01.blue'], { duration: 2400, scale: 1, ...OT }),
    motion('brace', 'targets', { delay: 400, duration: 800, ...OT }),
  ] },
  Shield: { sound: 'shield', why: 'an invisible barrier of force appears to protect the caster', build: () => [
    aura('Force barrier', ['shield.01.complete.01.blue'], { duration: 2000, scale: 1.1 }),
    motion('brace', 'source', { delay: 150, duration: 700 }),
  ] },
  'Tiny Hut': { sound: 'force', why: 'a 10-foot dome of force springs into being around the caster', build: () => [
    cast('Evocation', ['magic_signs.circle.02.evocation.complete.blue', 'magic_signs.circle.02.evocation.complete.red'], { stageId: 'c', duration: 1300, scale: 1, below: true }),
    aura('Dome of force', ['wall_of_force.sphere.blue', 'wall_of_force.sphere.grey'], { after: 'c', anchor: 'start', offset: 500, duration: 3000, scale: 3.2, opacity: 0.6, fadeIn: 500, fadeOut: 600 }),
  ] },
  'Private Sanctum': { sound: 'shield', why: 'an area is made magically secure against intrusion and scrying', build: () => [
    aura('Sanctum circle', ['magic_signs.circle.02.abjuration.complete.blue'], { duration: 2800, scale: 2.6, below: true }),
    aura('Warding rune', ['ward.rune.yellow.01'], { delay: 600, duration: 2000, scale: 0.8, ...tint('#7fb3ff') }),
  ] },
  'Resilient Sphere': { sound: 'force', why: 'a sphere of shimmering force encloses a creature', build: () => [
    cast('Evocation', ['cast_shape.circle.01.blue'], { stageId: 'c', duration: 900, scale: 0.6 }),
    impact('Force sphere', ['wall_of_force.sphere.blue', 'wall_of_force.sphere.grey'], { after: 'c', anchor: 'start', offset: 300, duration: 3000, scale: 1.4, opacity: 0.75, fadeIn: 300, ...T1 }),
    motion('press', 'targets', { after: 'c', anchor: 'start', offset: 500, duration: 900, ...OT }),
  ] },
  'Cure Wounds': { sound: 'healing', why: 'a touched creature regains hit points', build: () => [
    impact('Healing light', ['cure_wounds.400px.blue'], { duration: 2400, scale: 0.9, ...OT }),
  ] },
  Daylight: { sound: 'light', why: 'a 60-foot sphere of light spreads from a point', build: () => [
    cast('Light gathers', ['sacred_flame.source.yellow'], { stageId: 'c', duration: 1000, scale: 0.6 }),
    impact('Daylight sphere', ['template_circle.aura.01.complete.large.yellow', 'template_circle.out_pulse.01.burst.bluewhite'], { after: 'c', anchor: 'start', offset: 400, duration: 2800, scale: 2.4, opacity: 0.85, ...T1 }),
  ] },
  'Death Ward': { sound: 'holy', why: 'a creature is protected against death', build: () => [
    impact('Ward against death', ['bless.200px.intro.yellow'], { duration: 2200, scale: 1, ...OT }),
    impact('Warding star', ['ward.star.yellow.01'], { delay: 600, duration: 1800, scale: 0.7, ...OT }),
  ] },
  Earthquake: { sound: 'earthquake', why: 'an intense tremor rips through the ground', build: () => [
    cast('Earth stirs', ['cast_generic.earth.01.browngreen'], { stageId: 'c', duration: 900, scale: 0.7 }),
    impact('Ground ruptures', ['ground_cracks.03.orange', 'ground_cracks.01.orange'], { after: 'c', anchor: 'start', offset: 300, duration: 3000, scale: 2.2, below: true, ...T1 }),
    impact('Fissure', ['impact.ground_crack.orange.02'], { after: 'c', anchor: 'start', offset: 500, duration: 1800, scale: 1.4, ...OT }),
    motion('shake', 'targets', { after: 'c', anchor: 'start', offset: 500, duration: 1600, intensity: 1, ...OT }),
  ] },
  'Stone Shape': { sound: 'earth', why: 'a stone object is reshaped', build: () => [
    cast('Transmutation', ['magic_signs.circle.02.transmutation.complete.yellow'], { stageId: 'c', duration: 1000, scale: 0.6 }),
    impact('Stone reshapes', ['impact.ground_crack.01.orange'], { after: 'c', anchor: 'start', offset: 400, duration: 1600, scale: 0.8, ...T1 }),
  ] },
  Stoneskin: { sound: 'earth', why: 'a creature\'s flesh becomes as hard as stone', build: () => [
    impact('Stone skin', ['aura_themed.01.inward.complete.metal.01.grey'], { duration: 2400, scale: 1, ...OT, ...tint('#9a8f80') }),
    motion('brace', 'targets', { delay: 500, duration: 800, ...OT }),
  ] },
  'Wall of Stone': { sound: 'stoneWall', why: 'a nonmagical wall of solid stone springs into existence', build: () => [
    cast('Earth stirs', ['cast_generic.earth.01.browngreen'], { stageId: 'c', duration: 900, scale: 0.7 }),
    impact('Stone erupts', ['impact.ground_crack.orange.02'], { after: 'c', anchor: 'start', offset: 300, duration: 1800, scale: 1.2, ...T1 }),
    impact('Rubble settles', ['falling_rocks.side.2x1.grey'], { after: 'c', anchor: 'start', offset: 500, duration: 1600, scale: 1, ...T1 }),
  ] },
  'Burning Hands': { sound: 'fireCone', why: 'a thin sheet of flames shoots from outstretched fingertips in a cone', build: () => [
    travel('Sheet of flame', ['burning_hands.01.orange'], { stageId: 'f', duration: 1800, ...T1 }),
    motion('recoil', 'targets', { after: 'f', anchor: 'start', offset: 500, duration: 700, ...OT }),
  ] },
  'Fire Storm': { sound: 'fire', why: 'a storm of roaring flame fills several cubes', build: () => [
    cast('Fire gathers', ['cast_generic.fire.01.orange'], { stageId: 'c', duration: 800, scale: 0.8 }),
    impact('Firestorm', ['flames.orange.03.2x2'], { stageId: 'f', after: 'c', anchor: 'start', offset: 300, duration: 2600, scale: 1.2, targetStagger: 200, ...OT }),
    impact('Flame bursts', ['explosion.01.orange'], { after: 'c', anchor: 'start', offset: 400, duration: 1600, scale: 1, targetStagger: 200, ...OT }),
    motion('recoil', 'targets', { after: 'c', anchor: 'start', offset: 600, duration: 700, ...OT }),
  ] },
  'Faerie Fire': { sound: 'light', why: 'objects and creatures are outlined in blue, green or violet light', build: () => [
    cast('Faerie light', ['dancing_light.purplegreen'], { stageId: 'c', duration: 1200, scale: 0.6 }),
    impact('Outlined in light', ['markers.light.complete.purple', 'markers.light.complete.blue'], { after: 'c', anchor: 'start', offset: 400, duration: 2200, scale: 0.9, ...OT }),
  ] },
  'Phantasmal Force': { sound: 'psychic', why: 'an illusion is crafted in a creature\'s mind', build: () => [
    cast('Illusion', ['magic_signs.circle.02.illusion.complete.purple'], { stageId: 'c', duration: 1200, scale: 0.7 }),
    impact('Phantasm', ['icon.horror.purple'], { after: 'c', anchor: 'start', offset: 400, duration: 1800, scale: 0.6, offsetY: -0.4, offsetUnits: 'token', ...OT }),
    motion('cower', 'targets', { after: 'c', anchor: 'start', offset: 600, duration: 900, ...OT }),
  ] },
  'Stinking Cloud': { sound: 'poison', why: 'a 20-foot sphere of yellow, nauseating gas', build: () => [
    cast('Conjuration', ['fumes.toxic.green', 'fumes.04.complete.grey'], { stageId: 'c', duration: 900, scale: 0.6 }),
    impact('Nauseating gas', ['fog_cloud.02.green', 'fog_cloud.01.white'], { after: 'c', anchor: 'start', offset: 300, duration: 3200, scale: 2, ...T1, ...tint('#c7c25a') }),
    motion('shake', 'targets', { after: 'c', anchor: 'start', offset: 900, duration: 900, intensity: 0.5, ...OT }),
  ] },
  'Prismatic Spray': { sound: 'radiantRay', why: 'eight rays of multicolored light flash from the caster\'s hand', build: () => [
    cast('Prismatic gleam', ['dancing_light.purplegreen'], { stageId: 'c', duration: 700, scale: 0.6 }),
    travel('Prismatic rays', ['scorching_ray.01.rainbow01', 'scorching_ray.01.orange'], { stageId: 'r', after: 'c', anchor: 'end', offset: -200, duration: 1500, targetStagger: 120, ...OT }),
    impact('Color burst', ['explosion.03.pink', 'explosion.03.blueyellow'], { after: 'r', anchor: 'arrival', duration: 1200, scale: 0.7, ...OT }),
  ] },
  'Scorching Ray': { sound: 'fireRay', why: 'three rays of fire hurl at targets', build: () => [
    cast('Heat gathers', ['cast_generic.fire.01.orange'], { stageId: 'c', duration: 700, scale: 0.6 }),
    travel('Three rays', ['scorching_ray.01.orange'], { stageId: 'r', after: 'c', anchor: 'end', offset: -200, duration: 1400, repeats: 3, repeatScope: 'total', repeatInterval: 250, ...OT }),
    impact('Scorch', ['impact.fire.01.orange'], { after: 'r', anchor: 'arrival', duration: 900, scale: 0.5, repeats: 3, repeatScope: 'total', repeatInterval: 250, ...OT }),
  ] },
};
const cast_ = (spell, label) => {
  const s = SPELLS[spell];
  if (!s) throw Error(`no spell look for ${spell}`);
  return design(`${label}: the item casts ${spell} — ${s.why}.`, () => s.build(), { sound: s.sound });
};

// ---------------------------------------------------------------------------
// Shared item designs
// ---------------------------------------------------------------------------
// Staff of Power / Magi: Retributive Strike — the staff is broken and its magic explodes.
const retributive = (why, withArea) => design(why, () => [
  cast('Staff snaps', ['impact.011.purple', 'impact.011.blue'], { stageId: 'snap', duration: 700, scale: 0.6 }),
  withArea
    ? area('Arcane detonation', ['explosion.04.dark_purple', 'explosion.04.blue'], { stageId: 'boom', after: 'snap', anchor: 'start', offset: 250, duration: 2200 })
    : aura('Arcane detonation', ['explosion.04.dark_purple', 'explosion.04.blue'], { stageId: 'boom', after: 'snap', anchor: 'start', offset: 250, duration: 2200, scale: 4 }),
  aura('Shockwave', ['side_impact.part.shockwave.purple', 'side_impact.part.shockwave.blue'], { after: 'snap', anchor: 'start', offset: 300, duration: 1200, scale: 3, below: true }),
  motion('recoil', 'targets', { after: 'boom', anchor: 'start', offset: 200, duration: 800, intensity: 1.2, ...OT }),
], { sound: 'explosion' });

// Extra force damage delivered through a staff hit (Power Strike / Charge Damage).
const forceHit = why => design(why, () => [
  impact('Force discharge', ['impact.004.pinkpurple', 'impact.004.blue'], { stageId: 'hit', duration: 1200, scale: 0.9, ...OT }),
  impact('Force ripple', ['side_impact.part.shockwave.purple', 'side_impact.part.shockwave.blue'], { after: 'hit', anchor: 'start', offset: 100, duration: 1000, scale: 0.8, ...OT }),
  motion('stagger', 'targets', { after: 'hit', anchor: 'start', offset: 100, duration: 700, ...OT }),
], { sound: 'force' });

// Staff of Withering: necrotic withering on a staff hit.
const wither = why => design(why, () => [
  impact('Life withers', ['toll_the_dead.purple.skull_smoke', 'toll_the_dead.green.skull_smoke'], { stageId: 'w', duration: 1600, scale: 0.8, ...OT }),
  impact('Decay', ['smoke.puff.centered.dark_purple', 'smoke.puff.centered.grey'], { after: 'w', anchor: 'start', offset: 200, duration: 1500, scale: 0.8, opacity: 0.7, ...OT }),
  motion('cower', 'targets', { after: 'w', anchor: 'start', offset: 200, duration: 900, ...OT }),
], { sound: 'void' });

// Spell absorption: hostile magic is drawn into the staff.
const absorb = why => design(why, () => [
  aura('Spell drawn in', ['energy_strands.in.purple.01', 'energy_strands.in.green.01'], { stageId: 'in', duration: 2000, scale: 1.4 }),
  aura('Staff gleams', ['twinkling_stars.points06.white'], { after: 'in', anchor: 'start', offset: 1200, duration: 1000, scale: 0.5 }),
  motion('brace', 'source', { delay: 200, duration: 800 }),
], { sound: 'dispel' });

const insectCloud = why => design(why, () => [
  cast('Swarm released', ['cast_generic.earth.01.browngreen'], { stageId: 'c', duration: 800, scale: 0.6 }),
  area('Harmless insect cloud', ['fireflies.many.01.green'], { after: 'c', anchor: 'start', offset: 300, duration: 3200, opacity: 0.9, ...tint('#7a6a3a') }),
  area('Obscuring haze', ['ambient_fog.001.complete.small.greenyellow', 'ambient_fog.001.complete.small.white'], { after: 'c', anchor: 'start', offset: 300, duration: 3200, opacity: 0.4, below: true }),
], { sound: 'swarm' });

const thunderTarget = why => design(why, () => [
  impact('Thunderclap', ['shatter.blue'], { stageId: 'b', duration: 1500, scale: 0.9, ...OT }),
  impact('Shockwave', ['side_impact.part.shockwave.blue'], { after: 'b', anchor: 'start', offset: 100, duration: 1000, scale: 0.8, ...OT }),
  motion('stagger', 'targets', { after: 'b', anchor: 'start', offset: 150, duration: 800, ...OT }),
], { sound: 'sonic' });

const lightningTarget = (why, withThunder) => design(why, () => [
  impact('Lightning strike', ['lightning_strike.blue'], { stageId: 'l', duration: 1200, scale: 1, ...OT }),
  ...(withThunder ? [impact('Thunder', ['shatter.blue'], { after: 'l', anchor: 'start', offset: 200, duration: 1400, scale: 0.8, ...OT })] : []),
  motion('stagger', 'targets', { after: 'l', anchor: 'start', offset: 150, duration: 800, ...OT }),
], { sound: 'electric' });

const levitateSelf = why => design(why, () => [
  aura('Feather-light lift', ['swirling_feathers.outburst.01.textured'], { duration: 1800, scale: 0.8, opacity: 0.8 }),
  motion('levitate', 'source', { delay: 200, duration: 2600 }),
], { sound: 'wind' });

const haste = why => design(why, () => [
  aura('Burst of speed', ['wind_lines.01.01.white'], { stageId: 'w', duration: 1400, scale: 1, opacity: 0.8 }),
  aura('Quickened glow', ['on_token_buff.001.001.orangeyellow'], { delay: 100, duration: 1600, scale: 1 }),
  sprite('Afterimage', { delay: 200, duration: 900, copies: 2, copySpread: 0.3, opacity: 0.4 }),
  motion('pulse', 'source', { delay: 150, duration: 900 }),
], { sound: 'wind' });

const smokeCloud = (why, withArea) => design(why, () => [
  aura('Smoke pours out', ['smoke.plumes.01.grey'], { stageId: 's', duration: 2000, scale: 1 }),
  withArea
    ? area('Smoke cloud', ['ambient_fog.001.complete.large.white'], { after: 's', anchor: 'start', offset: 500, duration: 3200, opacity: 0.8, ...tint('#7a7a7a') })
    : aura('Smoke cloud', ['ambient_fog.001.complete.large.white'], { after: 's', anchor: 'start', offset: 500, duration: 3200, scale: 3, opacity: 0.8, ...tint('#7a7a7a') }),
], { sound: 'wind' });

const sneezeDust = why => design(why, () => [
  aura('Dust thrown', ['smoke.puff.side.grey'], { stageId: 't', duration: 900, scale: 0.6, faceTarget: true }),
  area('Choking dust', ['ambient_fog.001.complete.small.white', 'smoke.plumes.01.grey'], { after: 't', anchor: 'start', offset: 300, duration: 3000, opacity: 0.75, ...tint('#b8a98a') }),
  motion('shake', 'targets', { after: 't', anchor: 'start', offset: 900, duration: 1200, intensity: 0.6, ...OT }),
], { sound: 'wind' });

const fallingNet = why => design(why, () => [
  area('Net drops', ['web.complete.002.white', 'web.01'], { stageId: 'n', duration: 2400, opacity: 0.85 }),
  motion('press', 'targets', { after: 'n', anchor: 'start', offset: 300, duration: 900, ...OT }),
]);

const elementalSummon = (why, look, sound) => design(why, () => look(), { sound });
const AIR = () => [
  cast('Gem cracks', ['magic_signs.circle.02.conjuration.complete.blue', 'magic_signs.circle.02.conjuration.complete.yellow'], { stageId: 'c', duration: 1200, scale: 0.7 }),
  impact('Air elemental forms', ['whirlwind.bluewhite', 'whirlwind.bluegrey'], { after: 'c', anchor: 'start', offset: 400, duration: 3000, scale: 1.2, ...T1 }),
];
const WATER = () => [
  cast('Gem cracks', ['magic_signs.circle.02.conjuration.complete.blue', 'magic_signs.circle.02.conjuration.complete.yellow'], { stageId: 'c', duration: 1200, scale: 0.7 }),
  impact('Water elemental surges', ['water_splash.circle.01.blue'], { after: 'c', anchor: 'start', offset: 400, duration: 2600, scale: 1.3, ...T1 }),
  impact('Spray', ['bubble.001.001.complete.blue'], { after: 'c', anchor: 'start', offset: 700, duration: 2000, scale: 1, ...T1 }),
];
const FIRE = () => [
  cast('Gem cracks', ['magic_signs.circle.02.conjuration.complete.red', 'magic_signs.circle.02.conjuration.complete.yellow'], { stageId: 'c', duration: 1200, scale: 0.7 }),
  impact('Fire elemental ignites', ['fire_jet.orange'], { after: 'c', anchor: 'start', offset: 400, duration: 2400, scale: 1.2, ...T1 }),
  impact('Flames', ['flames.04.complete.orange'], { after: 'c', anchor: 'start', offset: 600, duration: 2600, scale: 1, ...T1 }),
];
const EARTH = () => [
  cast('Gem cracks', ['magic_signs.circle.02.conjuration.complete.yellow'], { stageId: 'c', duration: 1200, scale: 0.7 }),
  impact('Earth elemental rises', ['impact.ground_crack.orange.02'], { after: 'c', anchor: 'start', offset: 400, duration: 2200, scale: 1.4, ...T1 }),
  impact('Stone erupts', ['eruption.orange.01'], { after: 'c', anchor: 'start', offset: 600, duration: 2400, scale: 1, ...T1 }),
];

const figurineSummon = (why, accent) => design(why, () => [
  cast('Figurine tossed', ['magic_signs.circle.02.conjuration.complete.yellow'], { stageId: 'c', duration: 1200, scale: 0.7 }),
  impact('Creature springs forth', [accent, 'smoke.puff.centered.grey'], { after: 'c', anchor: 'start', offset: 400, duration: 1800, scale: 1.2, ...T1 }),
], { sound: 'summon' });

const restrainedGlint = why => design(why, () => [
  impact('Careful work', ['glint.yellow.few'], { duration: 1400, scale: 0.4, opacity: 0.7, ...OT }),
], { sound: null });

const K = {
  // Staff of Power
  'dnd5e:dnd5e-equipment24-dmgStaffOfPower0:udI31yfOHiwPCiSF': retributive('Staff of Power — Retributive Strike: the staff is broken and its magic is released in a 30-foot explosion of force.', false),
  'dnd5e:dnd5e-equipment24-dmgStaffOfPower0:3CrTUVjWDAG17HYK': retributive('Staff of Power — Retributive Strike (save): the broken staff\'s magic explodes across the sphere.', true),
  'dnd5e:dnd5e-items-eM5gEe4SEOvA2Y9t:V1rkYRygV4mgJgMa': retributive('Staff of Power — Retributive Strike: the broken staff\'s magic explodes across a 30-foot sphere.', true),
  'dnd5e:dnd5e-items-eM5gEe4SEOvA2Y9t:ahU6uTAGGEVFyPfz': forceHit('Staff of Power — Power Strike: a charge discharges extra force damage into the creature struck; the target staggers, not the wielder.'),
  'dnd5e:dnd5e-equipment24-dmgStaffOfStriki:sviFeLqVM4b4jHvc': forceHit('Staff of Striking — each expended charge adds 1d6 force damage to the hit; force discharge on the target.'),
  'dnd5e:dnd5e-items-URun3vYrXKJJdAJe:dnd5eactivity300': forceHit('Staff of Striking — expended charges add extra force damage to the hit; force discharge on the target.'),
  // Staff of Swarming Insects
  'dnd5e:dnd5e-equipment24-dmgStaffOfSwarmi:Z7aNKLTWuCs6cpRx': insectCloud('Staff of Swarming Insects — Insect Cloud: a swarm of harmless flying insects fills the 30-foot emanation, heavily obscuring it.'),
  'dnd5e:dnd5e-items-bod1dKzbAkAm21Ho:330BsWHVJ4uVFg90': insectCloud('Staff of Swarming Insects — Insect Cloud: a swarm of harmless flying insects fills a 30-foot radius.'),
  // Staff of the Magi
  'dnd5e:dnd5e-equipment24-dmgStaffOfTheMag:QcfPhLX9LBvOnShu': absorb('Staff of the Magi — Spell Absorption: a spell targeting the wielder is drawn into the staff as charges.'),
  'dnd5e:dnd5e-items-l3V7V8VCXpmAAysQ:dLAesxiW7gTg8qWH': absorb('Staff of the Magi — Absorb Spell: a spell targeting the wielder is drawn into the staff as charges.'),
  'dnd5e:dnd5e-equipment24-dmgStaffOfTheMag:214FXhkTH9yenAGw': retributive('Staff of the Magi — Retributive Strike (save): the broken staff\'s magic explodes across a 30-foot sphere.', true),
  'dnd5e:dnd5e-equipment24-dmgStaffOfTheMag:NVRhuyVOreCm0o7T': retributive('Staff of the Magi — Retributive Strike: the staff is broken and its magic explodes outward.', false),
  'dnd5e:dnd5e-items-l3V7V8VCXpmAAysQ:K4zg56xWSxZTYESG': retributive('Staff of the Magi — Retributive Strike: the broken staff\'s magic explodes across a 30-foot sphere.', true),
  // Staff of the Woodlands — Tree Form keeps its leaves/growth look (fits).
  // Staff of Thunder and Lightning
  'dnd5e:dnd5e-equipment24-dmgStaffOfThunde:7gbLqdYFIJ1QabDq': thunderTarget('Staff of Thunder and Lightning — Thunder: the staff strikes with a thunderclap audible 300 feet away; the struck creature is deafened and staggers.'),
  'dnd5e:dnd5e-equipment24-dmgStaffOfThunde:npfuUn0YaFlIYyD1': lightningTarget('Staff of Thunder and Lightning — Lightning: a bolt of lightning hits the creature struck.', false),
  'dnd5e:dnd5e-equipment24-dmgStaffOfThunde:EtOETCHaEK0mcw03': lightningTarget('Staff of Thunder and Lightning — Thunder & Lightning: lightning and a thunderclap together hit the creature struck.', true),
  'dnd5e:dnd5e-equipment24-dmgStaffOfThunde:hjxRfoWyCUGCMbMr': design('Staff of Thunder and Lightning — Lightning Strike: a 120-foot line of lightning shoots from the staff.', () => [
    cast('Static charge', ['static_electricity.01.blue'], { stageId: 'c', duration: 700, scale: 0.7 }),
    area('Lightning line', ['lightning_bolt.wide.blue'], { stageId: 'l', after: 'c', anchor: 'end', offset: -200, duration: 1500 }),
    motion('stagger', 'targets', { after: 'l', anchor: 'start', offset: 300, duration: 700, ...OT }),
  ], { sound: 'lightningBolt' }),
  'dnd5e:dnd5e-equipment24-dmgStaffOfThunde:CnEqIoGzAUahrQIH': design('Staff of Thunder and Lightning — Thunderclap: a deafening thunderclap fills a 60-foot radius around the staff.', () => [
    cast('Staff raised', ['soundwave.02.blue'], { stageId: 'c', duration: 700, scale: 0.6 }),
    area('Thunderclap', ['thunderwave.center.blue'], { stageId: 'w', after: 'c', anchor: 'end', offset: -200, duration: 1600 }),
    area('Shock ring', ['template_circle.out_pulse.01.burst.bluewhite'], { after: 'w', anchor: 'start', offset: 100, duration: 1600, opacity: 0.7 }),
    motion('stagger', 'targets', { after: 'w', anchor: 'start', offset: 200, duration: 800, ...OT }),
  ], { sound: 'sonic' }),
  // Staff of Withering
  'dnd5e:dnd5e-equipment24-dmgStaffOfWither:aV1D7luak106JNQS': wither('Staff of Withering — on a hit the target takes extra necrotic damage and must save or have disadvantage on Strength/Constitution checks; life withers on the target.'),
  'dnd5e:dnd5e-items-uHL99JKLUpTKAbz8:dnd5eactivity100': wither('Staff of Withering — the struck creature must save or its body withers; necrotic decay on the target.'),
  'dnd5e:dnd5e-items-uHL99JKLUpTKAbz8:48P9wGkMbuzWOOQS': wither('Staff of Withering — Wither: extra necrotic damage on the creature struck.'),
  // Monster/weapon features
  'dnd5e:dnd5e-monsterfeatures24-mmTailStinger000': design('Tail Stinger: a piercing sting that injects venom; poison blooms on the target, not around the attacker.', () => [
    motion('lunge', 'source', { duration: 900, distance: 0.22 }),
    impact('Sting', ['melee_generic.piercing.one_handed', 'melee_generic.creature_attack.pincer.001.red'], { stageId: 'hit', delay: 450, duration: 1400, scale: 1.1 }),
    impact('Venom', ['impact_themed.poison.greenyellow', 'markers.poison.dark_green.01'], { after: 'hit', anchor: 'start', offset: 250, duration: 1600, scale: 0.7 }),
    motion('stagger', 'targets', { after: 'hit', anchor: 'start', offset: 200, duration: 700, requiresHit: true }),
  ], { sound: 'poison' }),
  'dnd5e:dnd5e-monsterfeatures24-mmTouch000000000': design('Touch: a burning touch sets the target alight — fire on the target rather than a fireball-sized explosion.', () => [
    motion('lunge', 'source', { duration: 800, distance: 0.15 }),
    impact('Searing touch', ['impact.fire.01.orange'], { stageId: 'hit', delay: 400, duration: 1100, scale: 0.8 }),
    impact('Starts burning', ['flames.01.orange'], { after: 'hit', anchor: 'start', offset: 250, duration: 2400, scale: 0.6, opacity: 0.9 }),
    motion('recoil', 'targets', { after: 'hit', anchor: 'start', offset: 100, duration: 700, requiresHit: true }),
  ], { sound: 'fireIgnition' }),
  'dnd5e:dnd5e-monsterfeatures24-mmTrashLob000000': design('Trash Lob: a ball of filth is lobbed at the target, leaving it poisoned — a thrown lump and a foul splash, not an arrow.', () => [
    motion('throw', 'source', { duration: 900 }),
    projectile('Lobbed trash', ['boulder.toss.02.01.stone.brown'], { stageId: 'lob', delay: 250, duration: 1600, scale: 0.35, ...tint('#5d5232') }),
    impact('Filth splatters', ['liquid.splash.brown', 'liquid.splash.blue'], { after: 'lob', anchor: 'arrival', duration: 1400, scale: 0.7, ...tint('#6b5a2a') }),
    impact('Nauseating stench', ['markers.poison.dark_green.01'], { after: 'lob', anchor: 'arrival', offset: 300, duration: 1600, scale: 0.5 }),
  ], { sound: 'thrown', ...ABILITY }),
  'dnd5e:dnd5e-monsterfeatures24-mmThornBurst0000': design('Thorn Burst: a volley of thorns lashes out at the target — green thorn darts instead of a javelin.', () => [
    motion('throw', 'source', { duration: 800 }),
    travel('Thorn volley', ['arrow.physical.white.01', 'arrow.physical.white.02'], { stageId: 'th', delay: 200, duration: 1500, scale: 0.6, repeats: 3, repeatInterval: 120, ...tint('#5f7d2e') }),
    impact('Thorns bite', ['impact.005.green', 'impact.005.orange'], { after: 'th', anchor: 'arrival', duration: 1000, scale: 0.6, ...tint('#6c8b35') }),
  ], { sound: 'ranged', ...ABILITY }),
  'dnd5e:dnd5e-monsterfeatures24-mmWindSwipe00000': design('Wind Swipe: a slashing blast of wind strikes the target — wind and gust, not purple force.', () => [
    motion('lunge', 'source', { duration: 800, distance: 0.15 }),
    impact('Wind slash', ['melee_generic.slash.02.001.blue'], { stageId: 'hit', delay: 350, duration: 1100, scale: 1, ...tint('#dfe9f2') }),
    impact('Gust', ['wind_lines.01.01.white'], { after: 'hit', anchor: 'start', offset: 100, duration: 1300, scale: 0.8 }),
    motion('stagger', 'targets', { after: 'hit', anchor: 'start', offset: 150, duration: 800, requiresHit: true }),
  ], { sound: 'wind' }),
  'dnd5e:dnd5e-monsterfeatures24-mmVerdantWisp000': design('Verdant Wisp: a mote of green nature-light flies to the target; shortened from a 6.4 s flight and recolored green.', () => [
    cast('Wisp kindles', ['dancing_light.green'], { stageId: 'c', duration: 900, scale: 0.6 }),
    travel('Verdant wisp', ['guiding_bolt.01.greenorange', 'guiding_bolt.01.blueyellow'], { stageId: 'w', after: 'c', anchor: 'end', offset: -300, duration: 1800, scale: 0.7 }),
    impact('Wisp bursts', ['sacred_flame.target.green', 'sacred_flame.target.yellow'], { after: 'w', anchor: 'arrival', duration: 1800, scale: 0.9 }),
    motion('recoil', 'targets', { after: 'w', anchor: 'arrival', duration: 700 }),
  ], { sound: 'light' }),
  // Unarmed Strike Grapple/Shove: physical shove, no purple magic.
  'dnd5e:dnd5e-classes24-phbbrbUnarmedStr:56xkATs6DZLyRJH7': design('Grapple/Shove: a physical grab or shove — plain contact and the target is pushed off balance.', () => [
    motion('lunge', 'source', { duration: 800, distance: 0.2 }),
    impact('Grab', ['unarmed_strike.physical.01.blue'], { stageId: 'hit', delay: 350, duration: 1000, scale: 0.8, ...tint('#cfcfcf') }),
    motion('stagger', 'targets', { after: 'hit', anchor: 'start', offset: 100, duration: 800, intensity: 1.1 }),
  ]),
  'dnd5e:dnd5e-classes24-phbmnkUnarmedStr:Sl673lS0oweTsTHf': design('Grapple/Shove: a physical grab or shove — plain contact and the target is pushed off balance.', () => [
    motion('lunge', 'source', { duration: 800, distance: 0.2 }),
    impact('Grab', ['unarmed_strike.physical.01.blue'], { stageId: 'hit', delay: 350, duration: 1000, scale: 0.8, ...tint('#cfcfcf') }),
    motion('stagger', 'targets', { after: 'hit', anchor: 'start', offset: 100, duration: 800, intensity: 1.1 }),
  ]),
  'dnd5e:dnd5e-equipment24-phbUnarmedStrike:Z288a0QXgaNbdZmP': design('Grapple/Shove: a physical grab or shove — plain contact and the target is pushed off balance.', () => [
    motion('lunge', 'source', { duration: 800, distance: 0.2 }),
    impact('Grab', ['unarmed_strike.physical.01.blue'], { stageId: 'hit', delay: 350, duration: 1000, scale: 0.8, ...tint('#cfcfcf') }),
    motion('stagger', 'targets', { after: 'hit', anchor: 'start', offset: 100, duration: 800, intensity: 1.1 }),
  ]),
  // Sword of Life Stealing: necrotic drain flows back to the wielder as temp HP.
  'dnd5e:dnd5e-equipment24-dmgSwordOfLifeSt': design('Sword of Life Stealing: on a 20 the target takes extra necrotic damage and the wielder gains temporary hit points — a blade hit whose life force streams back to the wielder.', () => [
    motion('lunge', 'source', { duration: 900, distance: 0.22 }),
    impact('Blade hit', ['sword.melee.01.white', 'melee_generic.slash.01.orange'], { stageId: 'hit', delay: 450, duration: 1500, scale: 1.2 }),
    impact('Necrotic bite', ['toll_the_dead.purple.skull_smoke', 'toll_the_dead.green.skull_smoke'], { after: 'hit', anchor: 'start', offset: 250, duration: 1500, scale: 0.6 }),
    travel('Life drained', ['energy_strands.range.standard.dark_red.01', 'energy_strands.range.multiple.purple.01'], { stageId: 'd', after: 'hit', anchor: 'start', offset: 400, duration: 1500, travelOrigin: 'target', opacity: 0.85 }),
    aura('Vigor gained', ['on_token_buff.001.001.purplered'], { after: 'd', anchor: 'start', offset: 900, duration: 1200, scale: 1 }),
  ], { sound: 'drain' }),
  'dnd5e:dnd5e-equipment24-dmgSwordOfSharpn': design('Sword of Sharpness: a keen blade that maximizes damage and on a 20 deals extra slashing damage — a sharp slash with a bright edge glint.', () => [
    motion('lunge', 'source', { duration: 900, distance: 0.22 }),
    impact('Keen slash', ['sword.melee.01.white', 'melee_generic.slash.01.orange'], { stageId: 'hit', delay: 450, duration: 1500, scale: 1.2 }),
    impact('Edge glint', ['glint.blue.few', 'glint.yellow.few'], { after: 'hit', anchor: 'start', offset: 200, duration: 1100, scale: 0.5 }),
    motion('stagger', 'targets', { after: 'hit', anchor: 'start', offset: 150, duration: 700, requiresHit: true }),
  ], { sound: 'sword', ...ABILITY }),
  // Trident of Fish Command
  'dnd5e:dnd5e-equipment24-dmgTridentOfFish:ANM9wvqTFJSH2o11': cast_('Dominate Beast', 'Trident of Fish Command'),
  'dnd5e:dnd5e-items-o4Irx3hHiD3FnPbL:jkhhrMO1QkMunxL3': cast_('Dominate Beast', 'Trident of Fish Command'),
  // Gear and wondrous items
  'dnd5e:dnd5e-equipment24-phbagAlchemistsF': design('Alchemist\'s Fire: a thrown flask of sticky fluid that ignites on contact and keeps burning — a flame splash and lingering fire, not a fireball.', () => [
    motion('throw', 'source', { duration: 900 }),
    projectile('Flask', ['throwable.throw.flask.01.orange'], { stageId: 'f', delay: 250, duration: 1500, scale: 0.5 }),
    impact('Ignites', ['explosion.side_fracture.flask.01', 'impact.fire.01.orange'], { after: 'f', anchor: 'arrival', duration: 1000, scale: 0.6 }),
    impact('Clinging flames', ['flames.01.orange'], { after: 'f', anchor: 'arrival', offset: 200, duration: 2400, scale: 0.6 }),
  ], { sound: 'bomb-fire', ...ABILITY }),
  'dnd5e:dnd5e-items-FvNOwWbh5FXyX4xe': design('Alchemist\'s Fire: a thrown flask of sticky fluid that ignites on contact and keeps burning — a flame splash and lingering fire, not a fireball.', () => [
    motion('throw', 'source', { duration: 900 }),
    projectile('Flask', ['throwable.throw.flask.01.orange'], { stageId: 'f', delay: 250, duration: 1500, scale: 0.5 }),
    impact('Ignites', ['explosion.side_fracture.flask.01', 'impact.fire.01.orange'], { after: 'f', anchor: 'arrival', duration: 1000, scale: 0.6 }),
    impact('Clinging flames', ['flames.01.orange'], { after: 'f', anchor: 'arrival', offset: 200, duration: 2400, scale: 0.6 }),
  ], { sound: 'bomb-fire', ...ABILITY }),
  'dnd5e:dnd5e-items-WPWszFTGzmdIuDRJ': design('Flask of Holy Water: thrown holy water sears fiends and undead with radiant damage — flask flight and a radiant splash.', () => [
    motion('throw', 'source', { duration: 900 }),
    projectile('Flask', ['throwable.throw.flask.02.white', 'throwable.throw.flask.01.orange'], { stageId: 'f', delay: 250, duration: 1500, scale: 0.5 }),
    impact('Holy splash', ['liquid.splash.blue'], { after: 'f', anchor: 'arrival', duration: 1300, scale: 0.6, ...tint('#e8f2ff') }),
    impact('Radiant sear', ['divine_smite.target.yellowwhite', 'divine_smite.target.blueyellow'], { after: 'f', anchor: 'arrival', offset: 150, duration: 1600, scale: 0.6 }),
  ], { sound: 'bomb-vitality', ...ABILITY }),
  'dnd5e:dnd5e-equipment24-phbagAntitoxin00': design('Antitoxin: drinking it grants advantage against poison — a modest cleansing glow, not toxic fumes.', () => [
    aura('Drinks', ['healing_generic.200px.green'], { duration: 1600, scale: 0.6, opacity: 0.6 }),
  ], { sound: null }),
  'dnd5e:dnd5e-items-Fc6UfFNOnW80XMzi': design('Antitoxin: drinking it grants advantage against poison — a modest cleansing glow, not toxic fumes.', () => [
    aura('Drinks', ['healing_generic.200px.green'], { duration: 1600, scale: 0.6, opacity: 0.6 }),
  ], { sound: null }),
  'dnd5e:dnd5e-equipment24-phbagBallBearing:IKk7iQcYsjxDfnmk': design('Recover Ball Bearings: ten minutes of gathering mundane bearings — no spectral weapon, just a quiet glint.', () => [
    aura('Gathering', ['glint.yellow.few'], { duration: 1200, scale: 0.4, opacity: 0.6 }),
  ], { sound: null }),
  'dnd5e:dnd5e-equipment24-KbVt56CK4ud3FUk3:IKk7iQcYsjxDfnmk': design('Recover Ball Bearings: ten minutes of gathering mundane bearings — no spectral weapon, just a quiet glint.', () => [
    aura('Gathering', ['glint.yellow.few'], { duration: 1200, scale: 0.4, opacity: 0.6 }),
  ], { sound: null }),
  // Bead of Force: a bead is thrown and explodes into a sphere of force.
  'dnd5e:dnd5e-equipment24-dmgBeadOfForce00': design('Bead of Force: the thrown bead explodes in a 10-foot sphere of force that can trap creatures in a globe.', () => [
    motion('throw', 'source', { duration: 800 }),
    projectile('Bead', ['spell_projectile.ice_shard.blue'], { stageId: 'b', delay: 200, duration: 1300, scale: 0.3, ...tint('#7f6bd6'), ...T1 }),
    area('Force burst', ['explosion.04.dark_purple', 'explosion.04.blue'], { stageId: 'x', after: 'b', anchor: 'arrival', duration: 1500 }),
    area('Globe of force', ['wall_of_force.sphere.purple', 'wall_of_force.sphere.grey'], { after: 'x', anchor: 'start', offset: 400, duration: 2800, opacity: 0.6 }),
  ], { sound: 'force' }),
  'dnd5e:dnd5e-items-SqTtbBCfiEsmZ36N:dnd5eactivity000': design('Bead of Force: the bead explodes in a 10-foot sphere of force.', () => [
    area('Force burst', ['explosion.04.dark_purple', 'explosion.04.blue'], { stageId: 'x', duration: 1500 }),
    area('Globe of force', ['wall_of_force.sphere.purple', 'wall_of_force.sphere.grey'], { after: 'x', anchor: 'start', offset: 400, duration: 2800, opacity: 0.6 }),
    motion('press', 'targets', { after: 'x', anchor: 'start', offset: 200, duration: 800, ...OT }),
  ], { sound: 'force' }),
  'dnd5e:dnd5e-items-SqTtbBCfiEsmZ36N:dnd5eactivity300': design('Bead of Force: a sphere of shimmering force encloses the area.', () => [
    area('Globe of force', ['wall_of_force.sphere.purple', 'wall_of_force.sphere.grey'], { duration: 3000, opacity: 0.65, fadeIn: 400 }),
  ], { sound: 'force' }),
  // Boots
  'dnd5e:dnd5e-equipment24-dmgBootsOfLevita': levitateSelf('Boots of Levitation: the wearer casts Levitate on themself and rises.'),
  'dnd5e:dnd5e-items-HLhFCDGfI8EK7uV9': levitateSelf('Boots of Levitation: the wearer casts Levitate on themself and rises.'),
  'dnd5e:dnd5e-equipment24-dmgBootsOfSpeed0': haste('Boots of Speed: clicking the heels doubles speed — a rush of wind and afterimages instead of an evocation circle.'),
  'dnd5e:dnd5e-items-MCMSZrhcD40oMJ9v': haste('Boots of Speed: clicking the heels doubles speed — a rush of wind and afterimages instead of an evocation circle.'),
  // Bronze Griffon / Golden Lions (figurines)
  'dnd5e:dnd5e-equipment24-dmgFwpBronzeGrif': figurineSummon('Bronze Griffon: the figurine becomes a living griffon — summoning burst with wind-swept feathers.', 'swirling_feathers.outburst.01.textured'),
  'dnd5e:dnd5e-equipment24-dmgFwpGoldenLion:hMYKwe3M3sc1GafD': figurineSummon('Golden Lions: a figurine becomes a living lion — golden summoning burst.', 'smoke.puff.ring.01.white'),
  'dnd5e:dnd5e-equipment24-dmgFwpGoldenLion:V9aP1F5pHMZTARve': figurineSummon('Golden Lions: a figurine becomes a living lion — golden summoning burst.', 'smoke.puff.ring.01.white'),
  // Burnt Othur Fumes: inhaled poison smoke.
  'dnd5e:dnd5e-equipment24-dmgBurntOthurFum:13ZvV9bxzM90FeQO': design('Burnt Othur Fumes: inhaled poison smoke — black fumes envelop the target, who chokes.', () => [
    impact('Choking fumes', ['fumes.04.complete.black', 'fumes.04.complete.grey'], { stageId: 'f', duration: 2400, scale: 1, ...OT }),
    motion('shake', 'targets', { after: 'f', anchor: 'start', offset: 500, duration: 900, intensity: 0.5, ...OT }),
  ], { sound: 'poison' }),
  'dnd5e:dnd5e-equipment24-dmgBurntOthurFum:6o0JLH0kvEJ1n6D8': design('Burnt Othur Fumes: repeated failed saves deal poison damage — poison smoke on the target, not flames.', () => [
    impact('Poison wracks', ['fumes.04.complete.black', 'fumes.04.complete.grey'], { stageId: 'f', duration: 2000, scale: 0.9, ...OT }),
    impact('Poisoned', ['markers.poison.dark_green.01'], { after: 'f', anchor: 'start', offset: 300, duration: 1600, scale: 0.5, ...OT }),
    motion('cower', 'targets', { after: 'f', anchor: 'start', offset: 400, duration: 900, ...OT }),
  ], { sound: 'poison' }),
  // Candle of Invocation: Burn and Cast Gate
  'dnd5e:dnd5e-equipment24-dmgCandleOfInvoc:N7prweo4AeKHRzd8': cast_('Gate', 'Candle of Invocation — the candle burns away'),
  // Censer of Controlling Air Elementals
  'dnd5e:dnd5e-equipment24-dmgCenserOfContr': elementalSummon('Censer of Controlling Air Elementals: incense smoke summons an air elemental — whirling wind, not a generic conjuration circle.', () => [
    aura('Incense smoke', ['smoke.plumes.01.grey'], { stageId: 's', duration: 1800, scale: 0.7 }),
    impact('Air elemental forms', ['whirlwind.bluewhite', 'whirlwind.bluegrey'], { after: 's', anchor: 'start', offset: 600, duration: 3000, scale: 1.2, ...T1 }),
  ], 'wind'),
  'dnd5e:dnd5e-items-sXEkkTDXWQDUMzsC': elementalSummon('Censer of Controlling Air Elementals: incense smoke summons an air elemental in the area.', () => [
    aura('Incense smoke', ['smoke.plumes.01.grey'], { stageId: 's', duration: 1800, scale: 0.7 }),
    area('Air elemental forms', ['whirlwind.bluewhite', 'whirlwind.bluegrey'], { after: 's', anchor: 'start', offset: 600, duration: 3000 }),
  ], 'wind'),
  // Circlet of Blasting casts Scorching Ray.
  'dnd5e:dnd5e-equipment24-dmgCircletOfBlas': cast_('Scorching Ray', 'Circlet of Blasting'),
  'dnd5e:dnd5e-items-9UvWQTY5yIgkJmmb': cast_('Scorching Ray', 'Circlet of Blasting'),
  // Cloak of Arachnida (Web), Elvenkind, Bat, Manta Ray
  'dnd5e:dnd5e-equipment24-dmgCloakOfArachn': cast_('Web', 'Cloak of Arachnida'),
  'dnd5e:dnd5e-items-VwJjuNbBf2KHMPrY': cast_('Web', 'Cloak of Arachnida'),
  'dnd5e:dnd5e-items-Jvf1NWFxcjfHnMQ5': design('Cloak of Elvenkind: the hood hides the wearer — a quiet camouflage shimmer, not an evocation circle.', () => [
    aura('Blends into surroundings', ['shimmer.01.green', 'shimmer.01.blue'], { duration: 1600, scale: 1, opacity: 0.7 }),
    motion('flicker', 'source', { delay: 200, duration: 1000, intensity: 0.5 }),
  ], { sound: null }),
  'dnd5e:dnd5e-equipment24-dmgCloakOfTheBat:baY1WKtwieimGXWd': design('Cloak of the Bat: the wearer polymorphs into a bat — a burst of bats and shadow.', () => [
    aura('Shadow wraps', ['smoke.puff.centered.dark_black', 'smoke.puff.centered.grey'], { stageId: 's', duration: 1500, scale: 1 }),
    aura('Bats scatter', ['bats.complete.01.red'], { after: 's', anchor: 'start', offset: 300, duration: 2200, scale: 1, ...tint('#3a3040') }),
    motion('spin', 'source', { after: 's', anchor: 'start', offset: 300, duration: 900 }),
  ], { sound: 'transform' }),
  'dnd5e:dnd5e-items-Aq1rhgcgFnwu2T4I': design('Cloak of the Bat: in darkness the wearer flies or polymorphs into a bat — shadow and bats.', () => [
    aura('Shadow wraps', ['smoke.puff.centered.dark_black', 'smoke.puff.centered.grey'], { stageId: 's', duration: 1500, scale: 1 }),
    aura('Bats scatter', ['bats.complete.01.red'], { after: 's', anchor: 'start', offset: 300, duration: 2200, scale: 1, ...tint('#3a3040') }),
    motion('levitate', 'source', { after: 's', anchor: 'start', offset: 300, duration: 1800 }),
  ], { sound: 'shadow' }),
  'dnd5e:dnd5e-items-hGrxC676XmlnS9y0': design('Cloak of the Manta Ray: underwater breathing and swimming — bubbles and water swirl.', () => [
    aura('Bubbles', ['bubble.001.001.complete.blue'], { duration: 2000, scale: 1 }),
    aura('Water swirl', ['water_splash.circle.01.blue'], { delay: 200, duration: 1800, scale: 0.8, opacity: 0.6, below: true }),
  ], { sound: 'water' }),
  // Telepathy crystal ball / Suggestion
  'dnd5e:dnd5e-equipment24-dmgTelepathyCrys:M05Q5IeuXKLQsEyw': cast_('Suggestion', 'Crystal Ball of Telepathy'),
  'dnd5e:dnd5e-items-5KiRtMMSTnJmMtBr:5OrwGscvIsTh4piO': cast_('Suggestion', 'Crystal Ball of Telepathy'),
  // Cube of Force 2014, Cubic Gate 2014
  'dnd5e:dnd5e-items-s4fR8bxQGSt4wbH7': design('Cube of Force: pressing a face creates a cube-shaped barrier of force around the user — a force barrier, not an illusion shimmer.', () => [
    aura('Face pressed', ['cast_shape.square.01.blue'], { stageId: 'c', duration: 800, scale: 0.6 }),
    aura('Barrier of force', ['wall_of_force.sphere.blue', 'wall_of_force.sphere.grey'], { after: 'c', anchor: 'start', offset: 300, duration: 3000, scale: 2.4, opacity: 0.6, fadeIn: 300 }),
  ], { sound: 'force' }),
  'dnd5e:dnd5e-items-6ai1pEde3iQX30Fr': cast_('Gate', 'Cubic Gate'),
  // Demon Armor: clawed gauntlets.
  'dnd5e:dnd5e-equipment24-dmgDemonArmor000': design('Demon Armor: clawed gauntlets turn unarmed strikes into 1d8 slashing claws.', () => [
    motion('lunge', 'source', { duration: 800, distance: 0.2 }),
    impact('Demonic claws', ['claws.200px.dark_red', 'claws.200px.red'], { stageId: 'hit', delay: 400, duration: 1200, scale: 0.9 }),
    motion('stagger', 'targets', { after: 'hit', anchor: 'start', offset: 150, duration: 700, requiresHit: true }),
  ], { sound: 'claw', ...ABILITY }),
  'dnd5e:dnd5e-items-ejEt6hLQxOux04lS': design('Demon Armor: clawed gauntlets turn unarmed strikes into 1d8 slashing claws.', () => [
    motion('lunge', 'source', { duration: 800, distance: 0.2 }),
    impact('Demonic claws', ['claws.200px.dark_red', 'claws.200px.red'], { stageId: 'hit', delay: 400, duration: 1200, scale: 0.9 }),
    motion('stagger', 'targets', { after: 'hit', anchor: 'start', offset: 150, duration: 700, requiresHit: true }),
  ], { sound: 'claw', ...ABILITY }),
  // Dragon Orb
  'dnd5e:dnd5e-equipment24-dmgOrbOfDragonki:KNtsQw6UPEuzR1Qu': design('Dragon Orb — Call Dragons: the orb sends a telepathic summons to every chromatic dragon within 40 miles.', () => [
    aura('Orb pulses', ['magic_signs.circle.02.divination.complete.dark_purple', 'magic_signs.circle.02.divination.complete.blue'], { stageId: 'c', duration: 1500, scale: 1 }),
    aura('Summons radiates', ['template_circle.out_pulse.02.burst.purplepink', 'template_circle.out_pulse.02.burst.bluewhite'], { after: 'c', anchor: 'start', offset: 500, duration: 2200, scale: 4, opacity: 0.6 }),
  ], { sound: 'dragonRoar' }),
  // Dust of Sneezing and Choking
  'dnd5e:dnd5e-equipment24-dmgDustOfSneezin': sneezeDust('Dust of Sneezing and Choking: thrown dust makes creatures in the area sneeze and choke — a dusty cloud, not a detection circle.'),
  'dnd5e:dnd5e-items-9eyZY9tL3fXD1Mbm': sneezeDust('Dust of Sneezing and Choking: thrown dust makes creatures in the area sneeze and choke — a dusty cloud, not a detection circle.'),
  // Earth Ring
  // Eversmoking Bottle
  'dnd5e:dnd5e-equipment24-dmgEversmokingBo': smokeCloud('Eversmoking Bottle: thick smoke pours out in a 60-foot cloud — smoke, not a whirlwind.', false),
  'dnd5e:dnd5e-items-CvzjhUy9ekRieR1A': smokeCloud('Eversmoking Bottle: thick smoke pours out and spreads into a heavily obscuring cloud.', true),
  // Efreeti Bottle 2014
  'dnd5e:dnd5e-items-fbcQsOgWCjhEAGY7': design('Efreeti Bottle: thick smoke flows out and an efreeti appears in a column of flame beside you — not a fireball.', () => [
    aura('Smoke flows', ['smoke.plumes.01.grey'], { stageId: 's', duration: 1800, scale: 0.8 }),
    area('Efreeti emerges', ['fire_jet.orange'], { after: 's', anchor: 'start', offset: 700, duration: 2400 }),
    area('Flames swirl', ['flames.04.complete.orange'], { after: 's', anchor: 'start', offset: 900, duration: 2400, opacity: 0.8 }),
  ], { sound: 'fire' }),
  // Elemental Gems (2024 activities + 2014 air gem)
  'dnd5e:dnd5e-equipment24-dmgElementalGem0:NjDJ4RmiUfQN7MvR': elementalSummon('Elemental Gem — Blue Sapphire: the gem breaks and summons an air elemental.', AIR, 'wind'),
  'dnd5e:dnd5e-equipment24-dmgElementalGem0:ZG4m47OoKFlymv0Y': elementalSummon('Elemental Gem — Emerald: the gem breaks and summons a water elemental.', WATER, 'water'),
  'dnd5e:dnd5e-equipment24-dmgElementalGem0:OPaxNrL8JED6Tp17': elementalSummon('Elemental Gem — Red Corundum: the gem breaks and summons a fire elemental.', FIRE, 'fire'),
  'dnd5e:dnd5e-equipment24-dmgElementalGem0:HZ4be2ByeBOCNgPn': elementalSummon('Elemental Gem — Yellow Diamond: the gem breaks and summons an earth elemental.', EARTH, 'earth'),
  'dnd5e:dnd5e-equipment24-dmgBlueElemental': elementalSummon('Elemental Gem (Blue Sapphire): the gem breaks and summons an air elemental.', AIR, 'wind'),
  'dnd5e:dnd5e-items-zDJ4oEt5HArN1xmP': elementalSummon('Elemental Gem of Air: the gem breaks and an air elemental whirls into being.', () => [
    cast('Gem cracks', ['magic_signs.circle.02.conjuration.complete.blue', 'magic_signs.circle.02.conjuration.complete.yellow'], { stageId: 'c', duration: 1200, scale: 0.7 }),
    area('Air elemental forms', ['whirlwind.bluewhite', 'whirlwind.bluegrey'], { after: 'c', anchor: 'start', offset: 400, duration: 3000 }),
  ], 'wind'),
  // Falling Net trap (mundane net)
  'dnd5e:dnd5e-equipment24-dmgFallingNet000:JALPu15v7AargcIY': fallingNet('Falling Net: a weighted net drops on the area and restrains those beneath — a plain white net, not colored magic webbing.'),
  'dnd5e:dnd5e-equipment24-dmgFallingNet000:0RRvsd02pznY2Jw4': fallingNet('Falling Net: a weighted net drops on the area and restrains those beneath.'),
  'dnd5e:dnd5e-equipment24-dmgFallingNet000:XQpKgUgQU6TYBLdB': fallingNet('Falling Net: a weighted net drops on the area and restrains those beneath.'),
  'dnd5e:dnd5e-equipment24-dmgFallingNet000:HKXb1e4RZBdB7dpP': fallingNet('Falling Net: a weighted net drops on the area and restrains those beneath.'),
  // Feather tokens
  'dnd5e:dnd5e-equipment24-dmgBirdQuaalsFea': design('Feather Token (Bird): tossed into the air, the token becomes an enormous multicolored bird.', () => [
    aura('Token tossed', ['swirling_feathers.outburst.01.orange', 'swirling_feathers.outburst.01.textured'], { stageId: 'f', duration: 2000, scale: 1.4 }),
    aura('Wingbeat gust', ['wind_lines.01.02.white'], { after: 'f', anchor: 'start', offset: 600, duration: 1600, scale: 1.2, opacity: 0.7 }),
  ], { sound: 'summon' }),
  'dnd5e:dnd5e-items-hWqImieUaLo08l9l': design('Feather Token Bird: tossed into the air, the token becomes an enormous multicolored bird.', () => [
    aura('Token tossed', ['swirling_feathers.outburst.01.orange', 'swirling_feathers.outburst.01.textured'], { stageId: 'f', duration: 2000, scale: 1.4 }),
    aura('Wingbeat gust', ['wind_lines.01.02.white'], { after: 'f', anchor: 'start', offset: 600, duration: 1600, scale: 1.2, opacity: 0.7 }),
  ], { sound: 'summon' }),
  'dnd5e:dnd5e-equipment24-dmgTreeQuaalsFea': design('Feather Token (Tree): touched to the ground, the token becomes a 60-foot oak tree.', () => [
    area('Tree springs up', ['plant_growth.03.round.4x4.complete.greenyellow', 'plant_growth.03.round.2x2.complete.greenyellow'], { stageId: 't', duration: 2800 }),
    area('Leaves spread', ['swirling_leaves.complete.01.green'], { after: 't', anchor: 'start', offset: 600, duration: 2200 }),
  ], { sound: 'growth' }),
  'dnd5e:dnd5e-items-NjTgPn2o0M1TGk93': design('Feather Token Tree: touched to the ground, the token becomes a 60-foot oak tree.', () => [
    impact('Tree springs up', ['plant_growth.03.round.4x4.complete.greenyellow', 'plant_growth.03.round.2x2.complete.greenyellow'], { stageId: 't', duration: 2800, scale: 1.4, ...T1 }),
    impact('Leaves spread', ['swirling_leaves.complete.01.green'], { after: 't', anchor: 'start', offset: 600, duration: 2200, scale: 1, ...T1 }),
  ], { sound: 'growth' }),
  'dnd5e:dnd5e-equipment24-dmgWhipQuaalsFea': design('Feather Token (Whip): the token becomes a floating whip that lashes a creature for force damage.', () => [
    impact('Floating whip lashes', ['melee_generic.slash.02.001.blue'], { stageId: 'w', duration: 1100, scale: 1, ...tint('#b58cff'), ...OT }),
    impact('Force sting', ['impact.004.pinkpurple', 'impact.004.blue'], { after: 'w', anchor: 'start', offset: 200, duration: 900, scale: 0.6, ...OT }),
    motion('stagger', 'targets', { after: 'w', anchor: 'start', offset: 200, duration: 700, ...OT }),
  ], { sound: 'whip', ...ABILITY }),
  'dnd5e:dnd5e-items-Fgkj11diTJJ7H3JC': design('Feather Token Whip: a floating whip lashes a creature for force damage — the whip strikes the target; the user does not recoil.', () => [
    impact('Floating whip lashes', ['melee_generic.slash.02.001.blue'], { stageId: 'w', duration: 1100, scale: 1, ...tint('#b58cff'), ...OT }),
    impact('Force sting', ['impact.004.pinkpurple', 'impact.004.blue'], { after: 'w', anchor: 'start', offset: 200, duration: 900, scale: 0.6, ...OT }),
    motion('stagger', 'targets', { after: 'w', anchor: 'start', offset: 200, duration: 700, ...OT }),
  ], { sound: 'whip', ...ABILITY }),
  // Gem of Brightness: second command — a blinding ray at one creature.
  'dnd5e:dnd5e-equipment24-dmgGemOfBrightne:zSCMjUyMs03rTkuH': design('Gem of Brightness — second command word: the gem fires a brilliant beam at one creature, which must save or be blinded.', () => [
    cast('Gem flares', ['twinkling_stars.points08.white'], { stageId: 'c', duration: 700, scale: 0.5 }),
    travel('Blinding beam', ['energy_beam.normal.yellow.01', 'energy_beam.normal.bluepink.02'], { stageId: 'b', after: 'c', anchor: 'start', offset: 300, duration: 1400, ...T1 }),
    impact('Dazzled', ['dizzy_stars.200px.yellow', 'dizzy_stars.200px.blueorange'], { after: 'b', anchor: 'arrival', duration: 1600, scale: 0.6, ...OT }),
    motion('cower', 'targets', { after: 'b', anchor: 'arrival', duration: 800, ...OT }),
  ], { sound: 'radiantRay' }),
  // Gem of Seeing: True Seeing.
  'dnd5e:dnd5e-equipment24-dmgGemOfSeeing00': design('Gem of Seeing: peering through the gem grants truesight — a seeing eye and divination, not an evocation circle.', () => [
    aura('Divination', ['magic_signs.circle.02.divination.complete.blue'], { stageId: 'c', duration: 1400, scale: 0.8 }),
    aura('True sight', ['eyes.01.bluegreen.single', 'eyes.01.dark_green.single'], { after: 'c', anchor: 'start', offset: 400, duration: 2000, scale: 0.5, offsetY: -0.5, offsetUnits: 'token' }),
  ], { sound: 'detect' }),
  'dnd5e:dnd5e-items-jJU8vFhHLQeKe2wu': design('Gem of Seeing: peering through the gem grants truesight — a seeing eye and divination, not an evocation circle.', () => [
    aura('Divination', ['magic_signs.circle.02.divination.complete.blue'], { stageId: 'c', duration: 1400, scale: 0.8 }),
    aura('True sight', ['eyes.01.bluegreen.single', 'eyes.01.dark_green.single'], { after: 'c', anchor: 'start', offset: 400, duration: 2000, scale: 0.5, offsetY: -0.5, offsetUnits: 'token' }),
  ], { sound: 'detect' }),
  'dnd5e:dnd5e-items-SypSoinJkES0o5FB': design('Glamoured Studded Leather: the armor assumes the appearance of normal clothing — an illusion shimmer, not a shield.', () => [
    aura('Glamour shifts', ['shimmer.01.purple', 'shimmer.01.blue'], { duration: 1600, scale: 1, opacity: 0.8 }),
  ], { sound: 'transform' }),
  // Healer's Kit: mundane bandaging.
  'dnd5e:dnd5e-equipment24-phbagHealersKit0': restrainedGlint('Healer\'s Kit: a mundane kit used to stabilize a creature — restrained, no healing magic.'),
  'dnd5e:dnd5e-items-6rocoBx5jdzG1QQH': restrainedGlint('Healer\'s Kit: a mundane kit used to stabilize a dying creature — restrained, no healing magic.'),
  // Helm of Brilliance
  'dnd5e:dnd5e-equipment24-dmgHelmOfBrillia:IFscsoX8eRdhxP5s': design('Helm of Brilliance — Diamond Light: the diamonds blaze, searing undead with radiant light in a 30-foot radius.', () => [
    aura('Diamonds blaze', ['twinkling_stars.points08.white'], { stageId: 'c', duration: 900, scale: 0.6 }),
    area('Radiant light', ['template_circle.out_pulse.01.burst.yellowwhite', 'template_circle.out_pulse.01.burst.bluewhite'], { after: 'c', anchor: 'start', offset: 300, duration: 2000, opacity: 0.85 }),
    motion('cower', 'targets', { after: 'c', anchor: 'start', offset: 600, duration: 800, ...OT }),
  ], { sound: 'holy' }),
  'dnd5e:dnd5e-equipment24-dmgHelmOfBrillia:yCKpY8iNj7IoLdHN': design('Helm of Brilliance — Explosive Emanation: the gems explode in a 60-foot blast of searing light and fire.', () => [
    aura('Gems overload', ['twinkling_stars.points08.white'], { stageId: 'c', duration: 700, scale: 0.6 }),
    area('Brilliant explosion', ['explosion.01.yellow', 'explosion.03.blueyellow'], { stageId: 'x', after: 'c', anchor: 'start', offset: 300, duration: 1800 }),
    area('Radiant wave', ['template_circle.out_pulse.01.burst.yellowwhite', 'template_circle.out_pulse.01.burst.bluewhite'], { after: 'x', anchor: 'start', offset: 150, duration: 1800, opacity: 0.8 }),
    motion('recoil', 'targets', { after: 'x', anchor: 'start', offset: 200, duration: 800, ...OT }),
  ], { sound: 'explosion' }),
  // Ivory Goat of Terror figurine left; Wooden staff etc. kept.
};

// Cast activities: every line whose activity casts a named spell.
const CAST = {
  'dnd5e:dnd5e-equipment24-dmgStaffOfPower0:NQqC0MHmisyfOmfQ': ['Cone of Cold', 'Staff of Power'],
  'dnd5e:dnd5e-equipment24-dmgStaffOfPower0:zNjqfiDxCIdNI7Rn': ['Fireball', 'Staff of Power'],
  'dnd5e:dnd5e-equipment24-dmgStaffOfPower0:QABYkCIP5lk8NXSh': ['Globe of Invulnerability', 'Staff of Power'],
  'dnd5e:dnd5e-equipment24-dmgStaffOfPower0:NoWO7edVhEWuVAmx': ['Hold Monster', 'Staff of Power'],
  'dnd5e:dnd5e-equipment24-dmgStaffOfPower0:czjvyoIovQka1F9F': ['Levitate', 'Staff of Power'],
  'dnd5e:dnd5e-equipment24-dmgStaffOfPower0:mRMA2XqUdvDvMOnP': ['Lightning Bolt', 'Staff of Power'],
  'dnd5e:dnd5e-equipment24-dmgStaffOfPower0:aORrsuLy6pVeYbRK': ['Magic Missile', 'Staff of Power'],
  'dnd5e:dnd5e-equipment24-dmgStaffOfPower0:w4ATj8Ttf7inmYQ8': ['Ray of Enfeeblement', 'Staff of Power'],
  'dnd5e:dnd5e-equipment24-dmgStaffOfPower0:NpEs7lhVzV3erVyY': ['Wall of Force', 'Staff of Power'],
  'dnd5e:dnd5e-items-eM5gEe4SEOvA2Y9t:L1GZU5PNRP6yTTzv': ['Cone of Cold', 'Staff of Power'],
  'dnd5e:dnd5e-items-eM5gEe4SEOvA2Y9t:MPzQMc46FPOA0fOv': ['Fireball', 'Staff of Power'],
  'dnd5e:dnd5e-items-eM5gEe4SEOvA2Y9t:pYnqALTnXAWsBrFx': ['Globe of Invulnerability', 'Staff of Power'],
  'dnd5e:dnd5e-items-eM5gEe4SEOvA2Y9t:DlGnSXkbJ2GvX5Mq': ['Hold Monster', 'Staff of Power'],
  'dnd5e:dnd5e-items-eM5gEe4SEOvA2Y9t:U6ZnqbAPuN6TLnmy': ['Levitate', 'Staff of Power'],
  'dnd5e:dnd5e-items-eM5gEe4SEOvA2Y9t:ARYvRDrR6qLC7bKF': ['Lightning Bolt', 'Staff of Power'],
  'dnd5e:dnd5e-items-eM5gEe4SEOvA2Y9t:GbPA5LNCN13UmsGZ': ['Magic Missile', 'Staff of Power'],
  'dnd5e:dnd5e-items-eM5gEe4SEOvA2Y9t:NaBuO150m8H0tTyj': ['Ray of Enfeeblement', 'Staff of Power'],
  'dnd5e:dnd5e-items-eM5gEe4SEOvA2Y9t:cukAoZkQvzMEF4gI': ['Wall of Force', 'Staff of Power'],
  'dnd5e:dnd5e-equipment24-dmgStaffOfSwarmi:mAiLkjRTxXGR2iRG': ['Giant Insect', 'Staff of Swarming Insects'],
  'dnd5e:dnd5e-equipment24-dmgStaffOfSwarmi:bqhXvRAyiX8QEAv6': ['Insect Plague', 'Staff of Swarming Insects'],
  'dnd5e:dnd5e-items-bod1dKzbAkAm21Ho:YYSStWx9ygrl41hI': ['Giant Insect', 'Staff of Swarming Insects'],
  'dnd5e:dnd5e-items-bod1dKzbAkAm21Ho:daXCQjAPpv1uGjw4': ['Insect Plague', 'Staff of Swarming Insects'],
  'dnd5e:dnd5e-equipment24-dmgStaffOfTheMag:yf3QuUmZ7yHBdu3l': ['Arcane Lock', 'Staff of the Magi'],
  'dnd5e:dnd5e-equipment24-dmgStaffOfTheMag:3L8BGb2MQfsXgtiI': ['Conjure Elemental', 'Staff of the Magi'],
  'dnd5e:dnd5e-equipment24-dmgStaffOfTheMag:HxUNEjj9zqXWE3Ab': ['Detect Magic', 'Staff of the Magi'],
  'dnd5e:dnd5e-equipment24-dmgStaffOfTheMag:FEXImib6NMikFURp': ['Dispel Magic', 'Staff of the Magi'],
  'dnd5e:dnd5e-equipment24-dmgStaffOfTheMag:UNOZrUtFOPFeqGTV': ['Enlarge/Reduce', 'Staff of the Magi'],
  'dnd5e:dnd5e-equipment24-dmgStaffOfTheMag:q19KXqvPK8FWrLT9': ['Fireball', 'Staff of the Magi'],
  'dnd5e:dnd5e-equipment24-dmgStaffOfTheMag:ZD8LtVtrjvBl3D0F': ['Flaming Sphere', 'Staff of the Magi'],
  'dnd5e:dnd5e-equipment24-dmgStaffOfTheMag:afXaXdDq9syhL5dh': ['Ice Storm', 'Staff of the Magi'],
  'dnd5e:dnd5e-equipment24-dmgStaffOfTheMag:WzFr30itpNQnq6JS': ['Invisibility', 'Staff of the Magi'],
  'dnd5e:dnd5e-equipment24-dmgStaffOfTheMag:ak1haIVycqSCBUBH': ['Knock', 'Staff of the Magi'],
  'dnd5e:dnd5e-equipment24-dmgStaffOfTheMag:Leajkf976uWPrzcW': ['Light', 'Staff of the Magi'],
  'dnd5e:dnd5e-equipment24-dmgStaffOfTheMag:AWCWzGMIZfHxoALt': ['Lightning Bolt', 'Staff of the Magi'],
  'dnd5e:dnd5e-equipment24-dmgStaffOfTheMag:O7WRsRmSPQYoWLIZ': ['Mage Hand', 'Staff of the Magi'],
  'dnd5e:dnd5e-equipment24-dmgStaffOfTheMag:SzTx745dFkckEiUF': ['Passwall', 'Staff of the Magi'],
  'dnd5e:dnd5e-equipment24-dmgStaffOfTheMag:CvcYvfj8kKJwtBRx': ['Plane Shift', 'Staff of the Magi'],
  'dnd5e:dnd5e-equipment24-dmgStaffOfTheMag:j2A50xIz8n5xxucC': ['Protection from Evil and Good', 'Staff of the Magi'],
  'dnd5e:dnd5e-equipment24-dmgStaffOfTheMag:sCErCqrSk0MKkRzj': ['Telekinesis', 'Staff of the Magi'],
  'dnd5e:dnd5e-equipment24-dmgStaffOfTheMag:XkvsDzMADJkba8kz': ['Wall of Fire', 'Staff of the Magi'],
  'dnd5e:dnd5e-equipment24-dmgStaffOfTheMag:MWT8UKRWGxp5caKv': ['Web', 'Staff of the Magi'],
  'dnd5e:dnd5e-items-l3V7V8VCXpmAAysQ:fAGqoUKLEeAXizgK': ['Conjure Elemental', 'Staff of the Magi'],
  'dnd5e:dnd5e-items-l3V7V8VCXpmAAysQ:RYBUtg9UKqwQhEjQ': ['Dispel Magic', 'Staff of the Magi'],
  'dnd5e:dnd5e-items-l3V7V8VCXpmAAysQ:XV9UcuPxOt2Jg9kK': ['Fireball', 'Staff of the Magi'],
  'dnd5e:dnd5e-items-l3V7V8VCXpmAAysQ:yrx6wkFVfWkVDg61': ['Flaming Sphere', 'Staff of the Magi'],
  'dnd5e:dnd5e-items-l3V7V8VCXpmAAysQ:n0T3aHllQpkHulvB': ['Ice Storm', 'Staff of the Magi'],
  'dnd5e:dnd5e-items-l3V7V8VCXpmAAysQ:lWQcWdXkRJcIblXQ': ['Invisibility', 'Staff of the Magi'],
  'dnd5e:dnd5e-items-l3V7V8VCXpmAAysQ:PHcxZcGL1J03gn2b': ['Knock', 'Staff of the Magi'],
  'dnd5e:dnd5e-items-l3V7V8VCXpmAAysQ:9OmK8zLldeFfB0Qf': ['Lightning Bolt', 'Staff of the Magi'],
  'dnd5e:dnd5e-items-l3V7V8VCXpmAAysQ:9UC51m05UkS6bI6g': ['Passwall', 'Staff of the Magi'],
  'dnd5e:dnd5e-items-l3V7V8VCXpmAAysQ:1xeG5y6eGTOiNQUV': ['Plane Shift', 'Staff of the Magi'],
  'dnd5e:dnd5e-items-l3V7V8VCXpmAAysQ:HU73VsGevdca52hu': ['Telekinesis', 'Staff of the Magi'],
  'dnd5e:dnd5e-items-l3V7V8VCXpmAAysQ:WwDE5iYnZLVeSAir': ['Wall of Fire', 'Staff of the Magi'],
  'dnd5e:dnd5e-items-l3V7V8VCXpmAAysQ:YAMMMBHRGGtQngKU': ['Web', 'Staff of the Magi'],
  'dnd5e:dnd5e-items-l3V7V8VCXpmAAysQ:paXiMIUafSYasJLh': ['Arcane Lock', 'Staff of the Magi'],
  'dnd5e:dnd5e-items-l3V7V8VCXpmAAysQ:zK3i0Qjxpt3iAmjC': ['Detect Magic', 'Staff of the Magi'],
  'dnd5e:dnd5e-items-l3V7V8VCXpmAAysQ:4Gmw6fMTpsUrGNtV': ['Enlarge/Reduce', 'Staff of the Magi'],
  'dnd5e:dnd5e-items-l3V7V8VCXpmAAysQ:dmVJsTUidsz4PkwX': ['Light', 'Staff of the Magi'],
  'dnd5e:dnd5e-items-l3V7V8VCXpmAAysQ:Qq1BKk1MqYvAD6D7': ['Mage Hand', 'Staff of the Magi'],
  'dnd5e:dnd5e-items-l3V7V8VCXpmAAysQ:3zsxM5A8uevYWtrU': ['Protection from Evil and Good', 'Staff of the Magi'],
  'dnd5e:dnd5e-equipment24-dmgStaffOfTheWoo:geAlp70iuxuH1dvD': ['Animal Friendship', 'Staff of the Woodlands'],
  'dnd5e:dnd5e-equipment24-dmgStaffOfTheWoo:ZsTnyKpNKhX2UNw8': ['Awaken', 'Staff of the Woodlands'],
  'dnd5e:dnd5e-equipment24-dmgStaffOfTheWoo:HRmbe3tUq47ZLbeM': ['Barkskin', 'Staff of the Woodlands'],
  'dnd5e:dnd5e-equipment24-dmgStaffOfTheWoo:swaYlNmRQNmfu6MB': ['Locate Animals or Plants', 'Staff of the Woodlands'],
  'dnd5e:dnd5e-equipment24-dmgStaffOfTheWoo:cDbVrjDu0tnXlzaR': ['Pass without Trace', 'Staff of the Woodlands'],
  'dnd5e:dnd5e-equipment24-dmgStaffOfTheWoo:j5AgCtSJZN12vsJW': ['Speak with Animals', 'Staff of the Woodlands'],
  'dnd5e:dnd5e-equipment24-dmgStaffOfTheWoo:eoNl5saIm2pOFmsu': ['Speak with Plants', 'Staff of the Woodlands'],
  'dnd5e:dnd5e-equipment24-dmgStaffOfTheWoo:WmZyIUTekKP2iDtH': ['Wall of Thorns', 'Staff of the Woodlands'],
  'dnd5e:dnd5e-items-caEn3ixCUFBnHTx6:3NG2heM5F2MZC8jp': ['Animal Friendship', 'Staff of the Woodlands'],
  'dnd5e:dnd5e-items-caEn3ixCUFBnHTx6:joTmq1XPNETQqiag': ['Awaken', 'Staff of the Woodlands'],
  'dnd5e:dnd5e-items-caEn3ixCUFBnHTx6:5nuhAqCJUQrLA2Dl': ['Barkskin', 'Staff of the Woodlands'],
  'dnd5e:dnd5e-items-caEn3ixCUFBnHTx6:xETqUC7cpESvgEeV': ['Locate Animals or Plants', 'Staff of the Woodlands'],
  'dnd5e:dnd5e-items-caEn3ixCUFBnHTx6:Jddd8ljisRX31g8l': ['Speak with Plants', 'Staff of the Woodlands'],
  'dnd5e:dnd5e-items-caEn3ixCUFBnHTx6:8u2nn7PKK1PomSZA': ['Wall of Thorns', 'Staff of the Woodlands'],
  'dnd5e:dnd5e-items-caEn3ixCUFBnHTx6:iXNUoYwkgNbcwFJZ': ['Pass without Trace', 'Staff of the Woodlands'],
  'dnd5e:dnd5e-items-caEn3ixCUFBnHTx6:SdJnKtMS2hnx9Yhf': ['Speak with Animals', 'Staff of the Woodlands'],
  'dnd5e:dnd5e-equipment24-dmgAirRingOfElem:XBLdYOx6G8zS67Gb': ['Chain Lightning', 'Air Ring of Elemental Command'],
  'dnd5e:dnd5e-equipment24-dmgAirRingOfElem:WEBJIJBHSUTJruRZ': ['Feather Fall', 'Air Ring of Elemental Command'],
  'dnd5e:dnd5e-equipment24-dmgAirRingOfElem:KN5CZz5BdRVGC2IN': ['Gust of Wind', 'Air Ring of Elemental Command'],
  'dnd5e:dnd5e-equipment24-dmgAirRingOfElem:4sy1GTbqChCOkOdZ': ['Wind Wall', 'Air Ring of Elemental Command'],
  'dnd5e:dnd5e-items-8ABk0XV76Hzq8Qul:38pYKge1C3c2wPLF': ['Plane Shift', 'Amulet of the Planes'],
  'dnd5e:dnd5e-equipment24-dmgCloakOfTheBat:baY1WKtwieimGXWd': null, // handled in K (bat form)
  'dnd5e:dnd5e-equipment24-dmgMindReadingCr:3XpjxoC88UF7svp1': ['Scrying', 'Crystal Ball of Mind Reading'],
  'dnd5e:dnd5e-equipment24-dmgMindReadingCr:2MFzBAO64WpUiqFx': ['Detect Thoughts', 'Crystal Ball of Mind Reading'],
  'dnd5e:dnd5e-items-TwYeck6buBZ602mg:tZv4jpd4zviSzUWu': ['Scrying', 'Crystal Ball of Mind Reading'],
  'dnd5e:dnd5e-items-TwYeck6buBZ602mg:fRkGCqgiCHP528xk': ['Detect Thoughts', 'Crystal Ball of Mind Reading'],
  'dnd5e:dnd5e-equipment24-dmgTelepathyCrys:YB7AXMI2tqqNAlCG': ['Scrying', 'Crystal Ball of Telepathy'],
  'dnd5e:dnd5e-items-5KiRtMMSTnJmMtBr:gYpXMExP1crA0hHe': ['Scrying', 'Crystal Ball of Telepathy'],
  'dnd5e:dnd5e-equipment24-dmgCubeOfForce00:P5hQL8Tv1BZgMM5p': ['Mage Armor', 'Cube of Force'],
  'dnd5e:dnd5e-equipment24-dmgCubeOfForce00:ZtRR3jrinUNMIEvU': ['Shield', 'Cube of Force'],
  'dnd5e:dnd5e-equipment24-dmgCubeOfForce00:tCJJNlbzPWFK6X2m': ['Tiny Hut', 'Cube of Force'],
  'dnd5e:dnd5e-equipment24-dmgCubeOfForce00:KRhYoWhmZNWAmv1i': ['Private Sanctum', 'Cube of Force'],
  'dnd5e:dnd5e-equipment24-dmgCubeOfForce00:N5Y0YZKK2llU4HXf': ['Resilient Sphere', 'Cube of Force'],
  'dnd5e:dnd5e-equipment24-dmgCubeOfForce00:ZIMYDxhyS56bcRQE': ['Wall of Force', 'Cube of Force'],
  'dnd5e:dnd5e-equipment24-dmgCubicGate0000:KJbx4Fu7A0VNaI3w': ['Gate', 'Cubic Gate'],
  'dnd5e:dnd5e-equipment24-dmgCubicGate0000:4xkx3c93IMfNXg9x': ['Plane Shift', 'Cubic Gate'],
  'dnd5e:dnd5e-equipment24-dmgOrbOfDragonki:FaXepcc5YH9rqwu7': ['Suggestion', 'Dragon Orb'],
  'dnd5e:dnd5e-equipment24-dmgOrbOfDragonki:gU19MBO5R6a6xhIX': ['Cure Wounds', 'Dragon Orb'],
  'dnd5e:dnd5e-equipment24-dmgOrbOfDragonki:OQftVaabJyONkpL3': ['Daylight', 'Dragon Orb'],
  'dnd5e:dnd5e-equipment24-dmgOrbOfDragonki:tUFymm8hAKT7VZul': ['Death Ward', 'Dragon Orb'],
  'dnd5e:dnd5e-equipment24-dmgOrbOfDragonki:QDkpJHMmqFX13rKr': ['Detect Magic', 'Dragon Orb'],
  'dnd5e:dnd5e-equipment24-dmgOrbOfDragonki:FJYPyl7amErsBC3X': ['Scrying', 'Dragon Orb'],
  'dnd5e:dnd5e-equipment24-dmgEarthRingOfEl:Pc0Jdadmkxle0zw6': ['Earthquake', 'Earth Ring of Elemental Command'],
  'dnd5e:dnd5e-equipment24-dmgEarthRingOfEl:J0Pz4gT7m1OsezMb': ['Stone Shape', 'Earth Ring of Elemental Command'],
  'dnd5e:dnd5e-equipment24-dmgEarthRingOfEl:oP83rCUMiYvwFzJ5': ['Stoneskin', 'Earth Ring of Elemental Command'],
  'dnd5e:dnd5e-equipment24-dmgEarthRingOfEl:xpuvWA5Jy39MYwCg': ['Wall of Stone', 'Earth Ring of Elemental Command'],
  'dnd5e:dnd5e-equipment24-dmgFireRingOfEle:HgyNbSPAeSN3PFTa': ['Burning Hands', 'Fire Ring of Elemental Command'],
  'dnd5e:dnd5e-equipment24-dmgFireRingOfEle:rvrzr3I0Bman3wVX': ['Fireball', 'Fire Ring of Elemental Command'],
  'dnd5e:dnd5e-equipment24-dmgFireRingOfEle:lbxQxbL2AvJ8wXXl': ['Fire Storm', 'Fire Ring of Elemental Command'],
  'dnd5e:dnd5e-equipment24-dmgFireRingOfEle:D2CTrKYHV92RzVqB': ['Wall of Fire', 'Fire Ring of Elemental Command'],
  'dnd5e:dnd5e-equipment24-dmgHatOfManySpel:FP4ljN4wxHN6eDyy': ['Enlarge/Reduce', 'Hat of Many Spells'],
  'dnd5e:dnd5e-equipment24-dmgHatOfManySpel:B7ruAG3G8KyYSNXL': ['Faerie Fire', 'Hat of Many Spells'],
  'dnd5e:dnd5e-equipment24-dmgHatOfManySpel:1Oov0JtLLqUAI5g2': ['Fireball', 'Hat of Many Spells'],
  'dnd5e:dnd5e-equipment24-dmgHatOfManySpel:iMR8V4vNeUNVrl7e': ['Invisibility', 'Hat of Many Spells'],
  'dnd5e:dnd5e-equipment24-dmgHatOfManySpel:IPT9TqSywIaDcipD': ['Lightning Bolt', 'Hat of Many Spells'],
  'dnd5e:dnd5e-equipment24-dmgHatOfManySpel:QvbApkrkH2Nn5qnF': ['Phantasmal Force', 'Hat of Many Spells'],
  'dnd5e:dnd5e-equipment24-dmgHatOfManySpel:Gk6b31UEgbMYpKUk': ['Polymorph', 'Hat of Many Spells'],
  'dnd5e:dnd5e-equipment24-dmgHatOfManySpel:mqMYCmjvPFOaDSKv': ['Stinking Cloud', 'Hat of Many Spells'],
  'dnd5e:dnd5e-equipment24-dmgHelmOfBrillia:m8aK98SDuts6egnq': ['Daylight', 'Helm of Brilliance'],
  'dnd5e:dnd5e-equipment24-dmgHelmOfBrillia:ePzoCWNEAI8dymbs': ['Fireball', 'Helm of Brilliance'],
  'dnd5e:dnd5e-equipment24-dmgHelmOfBrillia:cyHTGkuJ0EfnTyR3': ['Prismatic Spray', 'Helm of Brilliance'],
  'dnd5e:dnd5e-equipment24-dmgHelmOfBrillia:jOM1L4QpJZo0dPr3': ['Wall of Fire', 'Helm of Brilliance'],
};

export default {
  ...Object.fromEntries(Object.entries(CAST).filter(([, v]) => v).map(([k, [spell, item]]) => [k, cast_(spell, item)])),
  ...K,
};
