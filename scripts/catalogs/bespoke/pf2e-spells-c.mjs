// Bespoke compositions (pf2e-spells-c). Keys: '<system>:<entryId>' or '<system>:<entryId>:<variant|mode>'.
// See scripts/catalogs/bespoke/helpers.mjs and scripts/bespoke.mjs.
import { cast, travel, projectile, impact, area, aura, sprite, motion, tint, spin, breathe, design } from './helpers.mjs';

// Shared Patreon-first / Free-fallback key groups for this slice.
const PURPLE_CAST = ['cast_shape.circle.01.purple', 'cast_shape.circle.01.blue'];
const GREEN_HEAL = ['healing_generic.03.burst.green', 'healing_generic.03.burst.bluegreen'];
const GROUND_CRACK = ['impact.ground_crack.01.orange', 'impact.ground_crack.orange.01'];
const STRANDS = ['energy_strands.range.standard.purple.01'];

export default {
  // 1 Lightning Storm
  'pf2e:JyT346VmGtRLsDnV': design('A black storm cloud fills the burst and a single vertical bolt drops onto the chosen line.', () => [
    area('Black storm cloud', ['call_lightning.high_res.blue', 'call_lightning.low_res.blue'], { stageId: 'cloud', duration: 3600, opacity: 0.9, fadeIn: 300, fadeOut: 500 }),
    impact('Vertical bolt', ['lightning_strike.blue'], { stageId: 'bolt', after: 'cloud', anchor: 'start', offset: 900, duration: 1400 }),
    impact('Ground charge', ['static_electricity.01.blue'], { after: 'bolt', anchor: 'start', offset: 250, duration: 1200, scale: 0.8 }),
    motion('stagger', 'targets', { after: 'bolt', anchor: 'start', offset: 250, duration: 700 }),
  ]),
  // 2 Lignify
  'pf2e:2hMy9ROM2dOZB8Jq': design('Wood creeps inward over the target and bark-like vines lock around it as it slows.', () => [
    impact('Wood enters flesh', ['aura_themed.01.inward.complete.wood.01.green'], { stageId: 'wood', duration: 2600, scale: 1 }),
    impact('Bark closes', ['vine.complete.nature.single.01.green'], { after: 'wood', anchor: 'start', offset: 700, duration: 2400, scale: 0.8, ...tint('#8a6a45') }),
    motion('press', 'targets', { after: 'wood', anchor: 'start', offset: 800, duration: 1200, intensity: 0.6 }),
  ], { sound: 'growth' }),
  // 4 Lingering Composition
  'pf2e:irTdhxTixU9u9YUm': design('A musical flourish trails off the caster as the composition is extended.', () => [
    cast('Flourish', ['music_notations.treble_clef.blue'], { stageId: 'fl', duration: 2000, scale: 0.6, offsetY: -0.4, offsetUnits: 'token' }),
    cast('Notes linger', ['music_notations.beamed_quavers.blue'], { after: 'fl', anchor: 'start', offset: 400, duration: 2200, scale: 0.5, offsetX: 0.4, offsetUnits: 'token' }),
    aura('Composition extends', ['soundwave.02.blue'], { after: 'fl', anchor: 'start', offset: 300, duration: 2400, scale: 0.9, opacity: 0.7 }),
  ], { sound: 'song' }),
  // 5 Linnorm Sting
  'pf2e:ZMY58Yk5hnyfeE3q': design('A spectral linnorm bite pierces the foe, injecting fiery venom that bursts into flame.', () => [
    impact('Linnorm bite', ['bite.200px.red'], { stageId: 'bite', duration: 1300, scale: 0.8 }),
    impact('Venom injected', ['liquid.splash02.green', 'liquid.splash.blue'], { after: 'bite', anchor: 'start', offset: 500, duration: 1200, scale: 0.5 }),
    impact('Fiery venom', ['flames.01.orange'], { after: 'bite', anchor: 'start', offset: 900, duration: 2000, scale: 0.6 }),
    motion('recoil', 'targets', { after: 'bite', anchor: 'start', offset: 300, duration: 650 }),
  ]),
  // 6 Live Wire
  'pf2e:Vbj8bTQ1nwrOBbYF': design('A humming copper filament lashes from the caster and slashes the foe with a crack of current.', () => [
    travel('Copper wire lashes', ['electric_arc.blue.03', 'electric_arc.03'], { stageId: 'wire', duration: 1300, scale: 0.5, ...tint('#e08a3c') }),
    impact('Wire slash', ['melee_generic.slash.01.orange', 'melee_generic.slash.01.orange'], { after: 'wire', anchor: 'start', offset: 450, duration: 900, scale: 0.6 }),
    impact('Current crackles', ['static_electricity.01.blue'], { after: 'wire', anchor: 'start', offset: 600, duration: 1300, scale: 0.6 }),
    motion('recoil', 'targets', { after: 'wire', anchor: 'start', offset: 500, duration: 650 }),
  ]),
  // 7 Lively Flight
  'pf2e:cHwM7Uj74L1titXZ': design('Healing spirals onto the ally and forms wings of vital energy that carry it aloft and away from danger.', () => [
    impact('Vitality spirals', GREEN_HEAL, { stageId: 'heal', duration: 2000, scale: 1.1 }),
    impact('Wings of vitality', ['swirling_feathers.outburst.01.textured'], { after: 'heal', anchor: 'start', offset: 500, duration: 1800, scale: 1, ...tint('#9dffb0') }),
    motion('levitate', 'targets', { after: 'heal', anchor: 'start', offset: 700, duration: 900, intensity: 0.5 }),
    motion('rush', 'targets', { after: 'heal', anchor: 'start', offset: 1500, duration: 2600, distance: 1.6, motionRange: 'distance', motionHeading: 'away', intensity: 0.15, targetSelection: 'first' }),
  ]),
  // 8 Living Graveyard
  'pf2e:iCzdCea2tm1oVpRf': design('The earth splits, tombstone rubble heaves up with ghostly dead, and the violent shaking topples nearby creatures.', () => [
    cast('Graves split open', GROUND_CRACK, { stageId: 'crack', duration: 2400, scale: 1.6, below: true }),
    cast('Tombstones heave', ['falling_rocks.top.2x1.grey'], { after: 'crack', anchor: 'start', offset: 300, duration: 1600, scale: 1 }),
    cast('Buried dead rise', ['toll_the_dead.purple.skull_smoke', 'toll_the_dead.green.skull_smoke'], { after: 'crack', anchor: 'start', offset: 700, duration: 2200, scale: 1.2 }),
    motion('shake', 'source', { after: 'crack', anchor: 'start', duration: 900, intensity: 0.6 }),
    motion('stagger', 'targets', { after: 'crack', anchor: 'start', offset: 400, duration: 800 }),
  ], { sound: 'earthquake' }),
  // 9 Living Terrain
  'pf2e:ygZHabZRS1ypucaw': design('The burst churns into a roiling cauldron of earth, cracking and spitting rock as it rolls over creatures.', () => [
    area('Ground fractures', GROUND_CRACK, { stageId: 'crack', duration: 2600, below: true }),
    area('Earth roils', ['eruption.orange.01'], { after: 'crack', anchor: 'start', offset: 300, duration: 2400 }),
    impact('Rubble tosses', ['falling_rocks.top.1x1.grey'], { after: 'crack', anchor: 'start', offset: 700, duration: 1400, scale: 0.6 }),
    motion('stagger', 'targets', { after: 'crack', anchor: 'start', offset: 800, duration: 800 }),
  ]),
  // 11 Localized Quake
  'pf2e:cBUuG1yJHGeKffpg': design('The caster shakes the ground: fractures race outward and nearby creatures stumble.', () => [
    cast('Ground tremor', GROUND_CRACK, { stageId: 'crack', duration: 2400, scale: 2.4, below: true }),
    cast('Dust and stone', ['falling_rocks.side.2x1.grey', 'falling_rocks.side.2x1.grey'], { after: 'crack', anchor: 'start', offset: 300, duration: 1500, scale: 1.2 }),
    motion('slam', 'source', { stageId: 'slam', duration: 700, intensity: 0.6 }),
    motion('stagger', 'targets', { after: 'crack', anchor: 'start', offset: 450, duration: 800 }),
  ]),
  // 13 Lock
  'pf2e:Azoh0BSoCASrA1lr': design('The latch clinks shut and an abjuration seal contracts over it.', () => [
    cast('Latch closes', PURPLE_CAST, { stageId: 'c', duration: 700, scale: 0.7 }),
    impact('Seal contracts', ['magic_signs.circle.01.abjuration'], { stageId: 'seal', after: 'c', duration: 2200, scale: 0.8 }),
    impact('Chain wards hold', ['markers.chain.standard.complete.02.blue', 'markers.chain.spectral_standard.complete.02.blue'], { after: 'seal', anchor: 'start', offset: 600, duration: 1800, scale: 0.6 }),
  ]),
  // 14 Lock Item
  'pf2e:qFO9HgplrShoaAPY': design('Spectral chains bind the held item to the creature\'s hand.', () => [
    cast('Grip fused', PURPLE_CAST, { stageId: 'c', duration: 600, scale: 0.7 }),
    impact('Hand-level binding', ['markers.chain.spectral_standard.complete.02.purple', 'markers.chain.spectral_standard.complete.02.blue'], { stageId: 'chain', after: 'c', duration: 2400, scale: 0.5, offsetX: 0.3, offsetY: 0.2, offsetUnits: 'token' }),
    motion('shake', 'targets', { after: 'chain', anchor: 'start', offset: 300, duration: 600, intensity: 0.3 }),
  ]),
  // 15 Loose Time's Arrow
  'pf2e:mLAYvbafVKfBgEhz': design('A time string is drawn back and released; the quickened targets surge with speed.', () => [
    cast('Time stream plucked', ['energy_strands.complete.blue.01'], { stageId: 'pluck', duration: 1100, scale: 0.7 }),
    travel('String released', ['energy_strands.range.standard.purple.01'], { stageId: 'str', after: 'pluck', anchor: 'start', offset: 600, duration: 1200, scale: 0.45 }),
    impact('Quickened', ['wind_lines.01.01.white'], { after: 'str', anchor: 'start', offset: 750, duration: 1300, scale: 0.7 }),
    motion('pulse', 'targets', { after: 'str', anchor: 'start', offset: 750, duration: 800, intensity: 0.5 }),
  ]),
  // 16 Loremaster's Etude
  'pf2e:5Pc55FGGqVpIAJ62': design('A muse\'s refrain rises and recalled lore glows around the ally as the check is rolled twice.', () => [
    cast('Muse invocation', ['music_notations.treble_clef.blue'], { stageId: 'm', duration: 1800, scale: 0.55, offsetY: -0.4, offsetUnits: 'token' }),
    impact('Lore recalled', ['icon.runes02.orange'], { after: 'm', anchor: 'start', offset: 500, duration: 2200, scale: 0.6 }),
    impact('Fortune roll', ['icosahedron.roll.blue'], { after: 'm', anchor: 'start', offset: 900, duration: 2000, scale: 0.4 }),
  ]),
  // 18 Lotus Walk
  'pf2e:OuZY7VYeylub5K7l': design('Lotuses and lily pads bloom around the caster\'s feet on a rippling water surface.', () => [
    cast('Water ripples', ['water_splash.circle.01.blue'], { stageId: 'w', duration: 1800, scale: 0.9, below: true }),
    cast('Lotus pads bloom', ['plant_growth.02.round.2x2.complete.greenred', 'plant_growth.03.round.2x2.complete.greenyellow'], { stageId: 'p', after: 'w', anchor: 'start', offset: 300, duration: 3200, scale: 0.9, below: true }),
    cast('Petals drift', ['swirling_leaves.outburst.01.pink'], { after: 'p', anchor: 'start', offset: 500, duration: 2200, scale: 0.7 }),
  ]),
  // 19 Love's Sacrifice
  'pf2e:flKde7BHrZnRheMl': design('The caster cries out; a heart-tether pulls the loving ally, who rushes to throw itself before the blow.', () => [
    cast('Cry for aid', ['soundwave.02.red', 'soundwave.02.blue'], { stageId: 'cry', duration: 1000, scale: 0.7 }),
    travel('Heart tether', ['energy_strands.range.standard.dark_red.01', 'energy_strands.range.standard.purple.01'], { stageId: 'tether', after: 'cry', anchor: 'start', offset: 300, duration: 1200, scale: 0.5 }),
    impact('Devotion', ['icon.heart.pink'], { after: 'tether', anchor: 'start', offset: 750, duration: 1500, scale: 0.4 }),
    motion('rush', 'targets', { after: 'tether', anchor: 'start', offset: 750, duration: 1800, distance: 1.5, motionRange: 'distance', motionHeading: 'toward', intensity: 0.4, targetSelection: 'first' }),
  ]),
  // 20 Loyalty's Ward
  'pf2e:qBSyP5csMVmaOWCF': design('Talisman wards settle over the openings of the structure.', () => [
    cast('Talisman wards', ['ward.rune.yellow.01'], { stageId: 'w', duration: 3000, scale: 0.9 }),
    cast('Criteria inscribed', ['icon.runes02.orange'], { after: 'w', anchor: 'start', offset: 700, duration: 2200, scale: 0.5, offsetY: -0.5, offsetUnits: 'token' }),
  ]),
  // 23 Lucky Number
  'pf2e:rDDYGY2ekZ1yVv7q': design('A d10 is rolled and its lucky number seals into a rune.', () => [
    cast('Number drawn', ['dodecahedron.roll.blue', 'icosahedron.roll.blue'], { stageId: 'r', duration: 2200, scale: 0.55 }),
    cast('Lucky seal', ['icon.runes.orange'], { after: 'r', anchor: 'start', offset: 900, duration: 2000, scale: 0.45 }),
  ]),
  // 26 Luring Wail
  'pf2e:Lr737SofpsFtLpEo': design('A plaintive wail ripples out through the emanation and fascinated creatures drift toward its source.', () => [
    cast('Plaintive wail', ['soundwave.02.purple', 'soundwave.02.blue'], { stageId: 'w', duration: 1200, scale: 0.7 }),
    area('Call fills the air', ['soundwave.02.purple', 'soundwave.02.blue'], { after: 'w', anchor: 'start', offset: 300, duration: 2600, opacity: 0.7 }),
    impact('Fascinated', ['music_notations.quaver.purple', 'music_notations.quaver.blue'], { after: 'w', anchor: 'start', offset: 900, duration: 1800, scale: 0.35 }),
    motion('drift', 'targets', { after: 'w', anchor: 'start', offset: 1100, duration: 1600, intensity: 0.5 }),
  ]),
  // 28 Magic Hide
  'pf2e:u2uSeH6YSbK1ajTy': design('The companion\'s hide thickens with an earthy, bark-like layer and it braces.', () => [
    cast('Hide thickens', ['cast_generic.earth.01.browngreen'], { stageId: 'c', duration: 800, scale: 0.7 }),
    impact('Thicker hide', ['aura_themed.01.inward.complete.nature.01.green'], { stageId: 'hide', after: 'c', duration: 1800, scale: 1, ...tint('#8b6b43') }),
    impact('Hardened shell', ['shield.01.intro.green', 'shield.01.intro.blue'], { after: 'hide', anchor: 'start', offset: 700, duration: 1500, scale: 1, opacity: 0.6, ...tint('#a27d4f') }),
    motion('brace', 'targets', { after: 'hide', anchor: 'start', offset: 700, duration: 900 }),
  ]),
  // 30 Magic Passage
  'pf2e:115Xp9E38CJENhNS': design('Stone cracks and crumbles away as a tunnel opens through the wall.', () => [
    cast('Stone fractures', GROUND_CRACK, { stageId: 'crack', duration: 1800, scale: 1.1 }),
    cast('Rubble falls away', ['falling_rocks.side.1x1.grey'], { after: 'crack', anchor: 'start', offset: 400, duration: 1400, scale: 0.9 }),
    cast('Tunnel opens', ['portals.vertical.ring.orange', 'portals.vertical.ring.bright_yellow'], { after: 'crack', anchor: 'start', offset: 900, duration: 2600, scale: 1.1, ...tint('#9a7a55') }),
  ], { sound: 'earth' }),
  // 31 Magic Stone
  'pf2e:9u6X9ykhzG11NK1n': design('Ordinary sling stones glow with vitality energy.', () => [
    cast('Stones gather', ['falling_rocks.top.1x1.grey'], { stageId: 's', duration: 1200, scale: 0.35 }),
    cast('Vitality infused', ['sacred_flame.source.yellow'], { after: 's', anchor: 'start', offset: 600, duration: 1600, scale: 0.6 }),
    cast('Holy glints', ['glint.yellow.few'], { after: 's', anchor: 'start', offset: 1000, duration: 1500, scale: 0.6 }),
  ]),
  // 32 Magic Warrior Aspect
  'pf2e:b6UnLNikoq2Std1f': design('The mask\'s animal surfaces: bestial claw marks and primal energy wash over the caster as features shift.', () => [
    cast('Mask awakens', ['cast_generic.earth.01.browngreen'], { stageId: 'c', duration: 900, scale: 0.8 }),
    sprite('Shifting silhouette', { after: 'c', anchor: 'start', offset: 400, duration: 1200 }),
    aura('Animal features', ['claws.200px.brown', 'claws.200px.red'], { after: 'c', anchor: 'start', offset: 600, duration: 1500, scale: 0.9 }),
    motion('pulse', 'source', { after: 'c', anchor: 'start', offset: 600, duration: 900, intensity: 0.6 }),
  ], { sound: 'transform' }),
  // 33 Magic Warrior Transformation
  'pf2e:tp4K7mYDL5MRHvJc': design('The caster becomes the mask\'s animal in a burst of primal energy, claws and fangs.', () => [
    cast('Mask awakens', ['cast_generic.earth.01.browngreen'], { stageId: 'c', duration: 900, scale: 0.9 }),
    sprite('Dissolving silhouette', { after: 'c', anchor: 'start', offset: 400, duration: 1300 }),
    aura('Claws emerge', ['claws.200px.brown', 'claws.200px.red'], { after: 'c', anchor: 'start', offset: 600, duration: 1400, scale: 1 }),
    aura('Fangs bare', ['bite.200px.orange', 'bite.200px.red'], { after: 'c', anchor: 'start', offset: 1100, duration: 1200, scale: 0.8 }),
    motion('pulse', 'source', { after: 'c', anchor: 'start', offset: 600, duration: 1000, intensity: 0.8 }),
  ], { sound: 'transform' }),
  // 34 Magic's Vessel
  'pf2e:u4FGIUQgruLjml7J': design('Pure magic pours inward and the target becomes a glowing divine receptacle.', () => [
    impact('Pure magic gathers', ['particles.inward.greenyellow.01.01'], { stageId: 'in', duration: 2000, scale: 1, ...tint('#c9b6ff') }),
    impact('Divine receptacle', ['energy_field.02.above.blue'], { after: 'in', anchor: 'start', offset: 700, duration: 2200, scale: 1, opacity: 0.8 }),
    impact('Ward rune', ['particle_burst.01.rune.bluepurple'], { after: 'in', anchor: 'start', offset: 1100, duration: 1500, scale: 0.8 }),
  ]),
  // 35 Magical Fetters
  'pf2e:2ZPqcM9wNoVnpwkK': design('Ghostly manacles launch from the hand and clasp the target\'s limbs.', () => [
    cast('Strands gather', ['glint.purple.few', 'glint.yellow.few'], { stageId: 'c', duration: 600, scale: 0.8 }),
    travel('Ghostly manacles fly', ['energy_beam.normal.purple.01', 'energy_beam.normal.bluepink.02'], { stageId: 'fly', after: 'c', duration: 1000, scale: 0.6 }),
    impact('Manacles clasp', ['markers.chain.spectral_standard.complete.02.purple', 'markers.chain.spectral_standard.complete.02.blue'], { after: 'fly', anchor: 'start', offset: 750, duration: 2400, scale: 1 }),
    motion('press', 'targets', { after: 'fly', anchor: 'start', offset: 950, duration: 900, intensity: 0.5 }),
  ]),
  // 38 Magnetic Dominion
  'pf2e:AsRd1gNRSkHDq2Jx': design('Magnetic fields swirl through the emanation and seize creatures, sliding them to new spaces.', () => [
    area('Magnetic fields', ['aura_themed.01.orbit.complete.metal.01.grey'], { stageId: 'f', duration: 3400, opacity: 0.85, ...spin(5000) }),
    impact('Seized by polarity', ['aura_themed.01.inward.complete.metal.01.grey'], { after: 'f', anchor: 'start', offset: 600, duration: 1600, scale: 0.7 }),
    motion('drift', 'targets', { after: 'f', anchor: 'start', offset: 1000, duration: 1500, intensity: 0.6 }),
  ], { sound: 'metal' }),
  // 41 Malediction
  'pf2e:AdZ2rWJStZ5unxzq': design('A field of distress spreads through the emanation and enemies\' defenses waver.', () => [
    cast('Distress spoken', PURPLE_CAST, { stageId: 'c', duration: 700, scale: 0.8 }),
    area('Distress field', ['energy_strands.02.marker.bluepurple'], { after: 'c', anchor: 'start', offset: 300, duration: 3000, opacity: 0.8 }),
    impact('Defenses waver', ['icon.shield_cracked.purple'], { after: 'c', anchor: 'start', offset: 900, duration: 1800, scale: 0.35 }),
    motion('cower', 'targets', { after: 'c', anchor: 'start', offset: 1000, duration: 900, intensity: 0.4 }),
  ]),
  // 44 Manifest Will
  'pf2e:IqBfoUaWDennHYoZ': design('Raw patron energy tears loose and circulates through the emanation around the witch.', () => [
    cast('Broken connection', ['energy_strands.complete.blue.01'], { stageId: 'c', duration: 1400, scale: 0.9 }),
    area('Will manifests', ['energy_strands.02.marker.bluepurple'], { after: 'c', anchor: 'start', offset: 400, duration: 3000, opacity: 0.8 }),
    area('Patron runes', ['icon.runes03.orange'], { after: 'c', anchor: 'start', offset: 800, duration: 2200, scale: 0.6, opacity: 0.7 }),
  ]),
  // 45 Manifestation
  'pf2e:AuIiqc7jjiy1GZ75': design('Secrets of magic are spun into runes that coalesce into an unshaped power.', () => [
    cast('Secrets spun', ['magic_signs.circle.02.evocation.complete.purple', 'magic_signs.circle.02.evocation.complete.red'], { stageId: 'c', duration: 2200, scale: 1 }),
    cast('Runes coalesce', ['icon.runes02.orange'], { after: 'c', anchor: 'start', offset: 600, duration: 2000, scale: 0.6 }),
    cast('Power ready', ['particle_burst.01.star.bluepurple'], { after: 'c', anchor: 'start', offset: 1400, duration: 1400, scale: 1 }),
  ]),
  // 46 Manifestation of Spirits
  'pf2e:O1ZLfeOJpHbG9G6B': design('Menacing spirits swirl into view around the target, which cowers before them.', () => [
    cast('Eyes opened', PURPLE_CAST, { stageId: 'c', duration: 700, scale: 0.8 }),
    impact('Menacing spirits', ['spirit_guardians.dark_purple.spirits', 'spirit_guardians.blueyellow.ring'], { stageId: 's', after: 'c', duration: 3000, scale: 0.6, ...tint('#8f7ab8') }),
    impact('Fixed stare', ['eyes.01.purple.few', 'eyes.01.dark_green.few'], { after: 's', anchor: 'start', offset: 600, duration: 1800, scale: 0.4 }),
    motion('cower', 'targets', { after: 's', anchor: 'start', offset: 500, duration: 1100, intensity: 0.5 }),
  ], { sound: 'spirit' }),
  // 47 Manifold Lives
  'pf2e:MT8usUfwudDVUm5H': design('Countless alternate selves flicker around the target as its mind is cast back through time; it sobs and buckles.', () => [
    cast('Mind cast back', PURPLE_CAST, { stageId: 'c', duration: 700, scale: 0.8 }),
    impact('Time swirls', ['template_circle.vortex.intro.purple', 'energy_field.02.above.blue'], { stageId: 'v', after: 'c', duration: 2000, scale: 0.6, opacity: 0.8 }),
    sprite('Alternate lives', { subject: 'targets', after: 'v', anchor: 'start', offset: 300, duration: 1600, opacity: 0.5 }),
    motion('flicker', 'targets', { after: 'v', anchor: 'start', offset: 300, duration: 900 }),
    motion('cower', 'targets', { after: 'v', anchor: 'start', offset: 1300, duration: 1000, intensity: 0.5 }),
  ]),
  // 49 Mantis's Grasp
  'pf2e:Tl1QAqre7H0sQEXt': design('Red ghostly mantis arms sprout and crush the target, pinning it in place.', () => [
    cast('Spectral arms gather', PURPLE_CAST, { stageId: 'c', duration: 600, scale: 0.8, ...tint('#dd493d') }),
    impact('Left mantis arm', ['claws.200px.dark_red', 'claws.200px.red'], { stageId: 'l', after: 'c', duration: 1200, scale: 0.8, offsetX: -0.3, offsetUnits: 'token' }),
    impact('Right mantis arm', ['claws.200px.dark_red', 'claws.200px.red'], { after: 'l', anchor: 'start', offset: 200, duration: 1200, scale: 0.8, offsetX: 0.3, offsetUnits: 'token', mirrorX: true }),
    impact('Force pins', ['energy_strands.complete.dark_red.01', 'energy_strands.complete.blue.01'], { after: 'l', anchor: 'start', offset: 600, duration: 1800, scale: 0.9, ...tint('#dd493d') }),
    motion('press', 'targets', { after: 'l', anchor: 'start', offset: 300, duration: 1000, intensity: 0.7 }),
  ]),
  // 50 Mantle of Heaven's Slopes
  'pf2e:vF52ktg0wUIAlf57': design('Heaven\'s light envelops the caster, who morphs into a luminous angelic form.', () => [
    cast('Heaven light descends', ['divine_smite.caster.standard.yellowwhite', 'divine_smite.caster.standard.blueyellow'], { stageId: 'c', duration: 1800, scale: 0.9 }),
    sprite('Angelic silhouette', { after: 'c', anchor: 'start', offset: 600, duration: 1300 }),
    aura('Luminous mantle', ['shimmer.01.orange', 'shimmer.01.blue'], { after: 'c', anchor: 'start', offset: 800, duration: 2400, scale: 1.3, ...tint('#fff1b8') }),
    motion('levitate', 'source', { after: 'c', anchor: 'start', offset: 800, duration: 1200, intensity: 0.4 }),
  ], { sound: 'holy' }),
  // 55 Mariner's Curse
  'pf2e:z2mfh3oPnfYqXflY': design('A roiling sea-curse washes over the target, which reels with seasickness.', () => [
    impact('Sea curse', ['water_splash.circle.01.blue'], { stageId: 'w', duration: 1800, scale: 1 }),
    impact('Seasickness', ['fumes.04.complete.green', 'fumes.04.complete.grey'], { after: 'w', anchor: 'start', offset: 500, duration: 2000, scale: 0.6 }),
    motion('stagger', 'targets', { after: 'w', anchor: 'start', offset: 500, duration: 900 }),
  ], { sound: 'water' }),
  // 56 Mark of Blood
  'pf2e:Oy6qBhzayCnqOiEO': design('A drop of the caster\'s blood is charged onto the weapon.', () => [
    cast('Blood placed', ['liquid.splash02.red'], { stageId: 'b', duration: 1400, scale: 0.4 }),
    cast('Essence charged', ['icon.drop.red'], { after: 'b', anchor: 'start', offset: 500, duration: 1800, scale: 0.3 }),
    cast('Curse glows', ['sneak_attack.dark_red', 'sneak_attack.dark_green'], { after: 'b', anchor: 'start', offset: 900, duration: 1400, scale: 0.4 }),
  ]),
  // 57 Martyr's Intervention
  'pf2e:M9TiCE1vlG1j2faM': design('The caster\'s own life force streams to the dying ally and forms a shield as the harm transfers back.', () => [
    cast('Life force offered', ['cast_generic.02.green', 'cast_generic.02.blue'], { stageId: 'c', duration: 600, scale: 0.8 }),
    travel('Life tether', ['energy_strands.range.standard.dark_red.01', 'energy_strands.range.standard.purple.01'], { stageId: 't', after: 'c', duration: 1300, scale: 0.5 }),
    impact('Shielded', ['shield.01.intro.green', 'shield.01.intro.blue'], { after: 't', anchor: 'start', offset: 750, duration: 1600, scale: 1.2 }),
    motion('brace', 'targets', { after: 't', anchor: 'start', offset: 750, duration: 800 }),
    motion('stagger', 'source', { after: 't', anchor: 'start', offset: 1050, duration: 800 }),
  ], { sound: 'shield' }),
  // 58 Marvelous Mount
  'pf2e:WPKJOhEihhcIm2uQ': design('A conjuration circle flares and a fantastical mount materializes in a puff of smoke, leaving great hoofprints.', () => [
    impact('Conjuration circle', ['magic_signs.circle.02.conjuration.complete.blue', 'magic_signs.circle.02.conjuration.complete.yellow'], { stageId: 'c', duration: 2000, scale: 1.4, below: true }),
    impact('Mount appears', ['smoke.puff.ring.01.white'], { after: 'c', anchor: 'start', offset: 700, duration: 1300, scale: 1.3 }),
    impact('Mount\'s tracks', ['footprints.monster.grey', 'footprints.shoe.grey'], { after: 'c', anchor: 'start', offset: 1100, duration: 2200, scale: 1.1 }),
  ], { sound: 'summon' }),
  // 59 Mask of Terror
  'pf2e:O6VQC1Bs4aSYDa6R': design('An illusory terrifying visage settles over the target.', () => [
    cast('Illusion woven', ['magic_signs.rune.illusion.complete.purple'], { stageId: 'c', duration: 900, scale: 0.8 }),
    impact('Terror mask', ['icon.horror.purple'], { stageId: 'm', after: 'c', duration: 2400, scale: 0.8 }),
    impact('Uncanny eyes', ['eyes.01.single.purple', 'eyes.01.dark_green.single'], { after: 'm', anchor: 'start', offset: 400, duration: 2000, scale: 0.8 }),
  ], { sound: 'fear' }),
  // 60 Massacre
  'pf2e:10VcmSYNBrvBphu1': design('A wave of void death tears down the line and living creatures in it buckle.', () => [
    cast('Void gathers', ['smoke.plumes.01.purple', 'smoke.plumes.01.grey'], { stageId: 'c', duration: 800, scale: 1 }),
    area('Wave of death', ['template_line_piercing.void', 'energy_beam.normal.bluepink.03'], { stageId: 'wave', after: 'c', duration: 2000, ...tint('#5b2a6e') }),
    impact('Life snuffed', ['toll_the_dead.purple.skull_smoke', 'toll_the_dead.green.skull_smoke'], { after: 'wave', anchor: 'start', offset: 600, duration: 1800, scale: 0.6 }),
    motion('stagger', 'targets', { after: 'wave', anchor: 'start', offset: 600, duration: 900 }),
  ]),
  // 61 Maze of Locked Doors
  'pf2e:qOeBQyC1z7OScHvP': design('A portal of locked hallways swallows the target, who flickers out into the extradimensional maze.', () => [
    cast('Maze opens', ['portals.horizontal.ring_masked.purple', 'portals.horizontal.ring.bright_yellow'], { stageId: 'c', duration: 800, scale: 0.9 }),
    impact('Hallway vortex', ['portals.vertical.vortex.purple', 'portals.horizontal.ring.bright_yellow'], { stageId: 'v', after: 'c', duration: 2800, scale: 1.3 }),
    impact('Locked doors', ['markers.chain.standard.complete.02.purple', 'markers.chain.standard.complete.02.red'], { after: 'v', anchor: 'start', offset: 600, duration: 2000, scale: 0.7 }),
    motion('flicker', 'targets', { after: 'v', anchor: 'start', offset: 900, duration: 1200 }),
  ], { sound: 'teleport' }),
  // 62 Medusa's Wrath
  'pf2e:wTYxxYJWN348oV15': design('An unarmed strike charged with medusa power turns the target\'s skin to grey stone.', () => [
    motion('lunge', 'source', { stageId: 'l', duration: 700 }),
    impact('Medusa strike', ['unarmed_strike.magical.01.green', 'unarmed_strike.magical.01.blue'], { stageId: 'hit', after: 'l', anchor: 'start', offset: 250, duration: 1200, scale: 1 }),
    impact('Petrifying stone', ['aura_themed.01.inward.complete.metal.01.grey'], { after: 'hit', anchor: 'start', offset: 400, duration: 2400, scale: 0.9, ...tint('#9b9488') }),
    motion('press', 'targets', { after: 'hit', anchor: 'start', offset: 500, duration: 1000, intensity: 0.5 }),
  ], { sound: 'bludgeon' }),
  // 65 Mental Map
  'pf2e:PEGECeEtEmXEzwBT': design('Divination reads the target\'s memory of a place and the image flows back to the caster.', () => [
    cast('Read terrain', PURPLE_CAST, { stageId: 'c', duration: 700, scale: 0.8 }),
    impact('Remembered place', ['magic_signs.circle.01.divination'], { stageId: 'm', after: 'c', duration: 2200, scale: 0.8 }),
    travel('Memory returns', ['energy_strands.range.standard.purple.02'], { after: 'm', anchor: 'start', offset: 800, duration: 1400, scale: 0.5, mirrorX: true }),
  ]),
  // 66 Mercurial Stride
  'pf2e:ma3sndEAZdz0Cy2H': design('The caster ripples into toxic quicksilver and streaks forward in a mercury trail.', () => [
    cast('Quicksilver ripples', ['liquid.splash.grey', 'liquid.splash.blue'], { stageId: 'c', duration: 1000, scale: 0.7, ...tint('#c8d0d8') }),
    aura('Mercury vapour', ['fumes.toxic.green', 'fumes.04.complete.grey'], { after: 'c', anchor: 'start', offset: 300, duration: 2400, scale: 0.8, opacity: 0.5, ...tint('#b9c7b0') }),
    motion('rush', 'source', { after: 'c', anchor: 'start', offset: 300, duration: 3200, distance: 2.2, motionRange: 'distance', motionHeading: 'toward', motionEndpoint: 'near', intensity: 0.15 }),
  ]),
  // 68 Message Rune
  'pf2e:Z7N5IxJCwrAdIgSg': design('A small message rune is inscribed and goes quiet.', () => [
    cast('Inscribe', PURPLE_CAST, { stageId: 'c', duration: 700, scale: 0.7 }),
    impact('Message rune', ['icon.runes.blue', 'icon.runes.orange'], { after: 'c', duration: 2200, scale: 0.35 }),
  ]),
  // 70 Metal Reverberation
  'pf2e:GNJ0rAeLwvl2sM8S': design('A struck tuning fork rings; the target object pings with ear-piercing sound that batters adjacent creatures.', () => [
    cast('Tuning fork struck', ['cast_generic.sound.01.pinkteal'], { stageId: 'c', duration: 900, scale: 0.7 }),
    impact('Piercing note', ['impact.sound.01.pinkteal', 'cast_generic.sound.01.pinkteal'], { stageId: 'n', after: 'c', duration: 1100, scale: 1 }),
    impact('Metal reverberates', ['soundwave.02.blue'], { after: 'n', anchor: 'start', offset: 200, duration: 1800, scale: 1.4 }),
    motion('shake', 'targets', { after: 'n', anchor: 'start', offset: 200, duration: 800, intensity: 0.4 }),
  ]),
  // 71 Metallic Meteorite Glyph
  'pf2e:moTWtlU84IScjnCh': design('A rune marks the target, then an iron meteor streaks in and smashes into it.', () => [
    impact('Meteor glyph', ['icon.runes.orange'], { stageId: 'g', duration: 1500, scale: 0.5 }),
    projectile('Iron meteor', ['celestial_bodies.asteroid.single.iron.red.01', 'boulder.toss.02.01.stone.brown'], { stageId: 'm', after: 'g', anchor: 'start', offset: 700, duration: 1400, scale: 0.6 }),
    impact('Meteor smash', ['explosion.01.orange'], { after: 'm', anchor: 'start', offset: 1100, duration: 1500, scale: 0.9 }),
    impact('Crater', GROUND_CRACK, { after: 'm', anchor: 'start', offset: 1100, duration: 2200, scale: 1, below: true }),
    motion('stagger', 'targets', { after: 'm', anchor: 'start', offset: 1100, duration: 800 }),
  ]),
  // 74 Mimic Spell
  'pf2e:2a8wiTxvBhcMbMU5': design('The caster watches the foe\'s spell and pulls its secrets back as runes.', () => [
    cast('Spell watched', ['eyes.01.dark_green.single'], { stageId: 'e', duration: 1600, scale: 0.5 }),
    cast('Secrets retained', ['icon.runes02.orange'], { after: 'e', anchor: 'start', offset: 600, duration: 2000, scale: 0.6 }),
  ]),
  // 75 Mimic Undead
  'pf2e:xlRv8vCTHh1NeMpw': design('The caster wraps death around itself like a cloak; colors wash out to a deathly pall.', () => [
    cast('Death gathers', ['arms_of_hadar.dark_purple'], { stageId: 'c', duration: 1100, scale: 0.6 }),
    aura('Cloak of death', ['smoke.plumes.01.grey'], { after: 'c', anchor: 'start', offset: 400, duration: 2400, scale: 0.9, opacity: 0.7, ...tint('#7d8a86') }),
    aura('Lifeless skull', ['toll_the_dead.grey.skull_smoke', 'toll_the_dead.green.skull_smoke'], { after: 'c', anchor: 'start', offset: 900, duration: 1800, scale: 0.5 }),
  ], { sound: 'shadow' }),
  // 76 Mind Games
  'pf2e:29JyWqqZ0thCFr1C': design('Two minds lock across a psychic tether; the target reels stunned.', () => [
    travel('Minds lock', STRANDS, { stageId: 't', duration: 1500, scale: 0.5 }),
    impact('Stunned', ['icon.stun.purple'], { after: 't', anchor: 'start', offset: 750, duration: 1800, scale: 0.4 }),
    motion('shake', 'targets', { after: 't', anchor: 'start', offset: 750, duration: 800, intensity: 0.4 }),
  ], { sound: 'psychic' }),
  // 78 Mind Probe
  'pf2e:9BnhadUO8FMLmeZ3': design('The caster\'s thoughts slide into the target\'s mind and sift memories.', () => [
    travel('Thoughts enter', STRANDS, { stageId: 't', duration: 1500, scale: 0.45 }),
    impact('Memories sifted', ['eyes.01.dark_green.single'], { after: 't', anchor: 'start', offset: 750, duration: 1800, scale: 0.5 }),
    impact('Question', ['icon.runes02.orange'], { after: 't', anchor: 'start', offset: 1150, duration: 1800, scale: 0.5 }),
  ]),
  // 82 Mindscape Door
  'pf2e:8MAHUK6jphbME4BR': design('A dreamy doorway opens into the mindscape.', () => [
    cast('Mindscape concentration', ['sleep.cloud.01.pink'], { stageId: 's', duration: 2200, scale: 1 }),
    cast('Mindscape door', ['portals.vertical.ring.purple', 'portals.horizontal.ring.bright_yellow'], { after: 's', anchor: 'start', offset: 700, duration: 3000, scale: 1.1 }),
  ]),
  // 84 Miracle
  'pf2e:YfJTXyVGzLhM6V8U': design('The divine source answers in a column of holy light.', () => [
    cast('Divine petition', ['ward.star.yellow.01'], { stageId: 'w', duration: 2000, scale: 1 }),
    cast('Holy light answers', ['divine_smite.caster.standard.yellowwhite', 'divine_smite.caster.standard.blueyellow'], { after: 'w', anchor: 'start', offset: 700, duration: 2000, scale: 1.2 }),
    cast('Radiance', ['sacred_flame.source.yellow'], { after: 'w', anchor: 'start', offset: 1200, duration: 1600, scale: 0.9 }),
  ], { sound: 'holy' }),
  // 86 Mirecloak
  'pf2e:NIop4eI2i7cKFGad': design('Thin, sickly green shrouds settle about each target\'s shoulders.', () => [
    cast('Shroud woven', PURPLE_CAST, { stageId: 'c', duration: 700, scale: 0.8, ...tint('#7dbb6a') }),
    impact('Green shroud', ['fumes.04.complete.green', 'fumes.04.complete.grey'], { stageId: 's', after: 'c', duration: 2400, scale: 0.8, opacity: 0.8 }),
    impact('Watching psyche', ['eyes.01.dark_green.few'], { after: 's', anchor: 'start', offset: 600, duration: 1600, scale: 0.4 }),
  ], { sound: 'shadow' }),
  // 88 Mirror Malefactors
  'pf2e:CmZCq4htcZ6W0TKk': design('A shimmering ring of illusory mirrors surrounds the target, which flinches from its reflections.', () => [
    impact('Mirror ring', ['wall_of_force.sphere.grey'], { stageId: 'm', duration: 2600, scale: 0.6, opacity: 0.6 }),
    sprite('Hostile reflections', { subject: 'targets', after: 'm', anchor: 'start', offset: 400, duration: 1600, opacity: 0.5 }),
    impact('Frightened', ['icon.fear.dark_purple'], { after: 'm', anchor: 'start', offset: 800, duration: 1600, scale: 0.35 }),
    motion('cower', 'targets', { after: 'm', anchor: 'start', offset: 800, duration: 900, intensity: 0.4 }),
  ]),
  // 94 Misty Memory
  'pf2e:zu40ATlcCjtfWBnj': design('Mist rises from the water and forms a silent translucent tableau.', () => [
    cast('Water memory stirs', ['water_splash.circle.01.blue'], { stageId: 'w', duration: 1200, scale: 0.8 }),
    cast('Memory mist rises', ['ambient_fog.001.complete.small.white'], { stageId: 'f', after: 'w', anchor: 'start', offset: 500, duration: 3600, scale: 1.6, opacity: 0.8 }),
    cast('Tableau shimmers', ['shimmer.01.blue'], { after: 'f', anchor: 'start', offset: 800, duration: 2400, scale: 1.4, ...tint('#f2f5f8') }),
  ]),
  // 100 Moonburst
  'pf2e:Shiuhdb2nO6Qgk3k': design('A globe of chilling silver moonlight explodes across the burst.', () => [
    cast('Moonlight gathers', ['moonbeam.01.intro.blue'], { stageId: 'c', duration: 900, scale: 0.6 }),
    area('Moonlight globe bursts', ['explosion.bluewhite', 'explosion.02.blue'], { stageId: 'b', after: 'c', duration: 1600 }),
    area('Silver frost', ['impact.frost.white.01'], { after: 'b', anchor: 'start', offset: 300, duration: 1600, opacity: 0.8 }),
    motion('stagger', 'targets', { after: 'b', anchor: 'start', offset: 300, duration: 800 }),
  ]),
  // 101 Moonlight Bridge
  'pf2e:In2A7GCyxxaqZdPI': design('A span of shimmering moonlight lays itself out along the line.', () => [
    area('Moonlight span', ['moonbeam.01.complete.blue'], { stageId: 'b', duration: 3600, areaLayout: 'tiles', opacity: 0.8 }),
    area('Shimmer', ['shimmer.01.blue'], { after: 'b', anchor: 'start', offset: 500, duration: 2600, opacity: 0.6 }),
  ]),
  // 102 Moonlight Ray
  'pf2e:mtlyAyf30JnIvxVn': design('A holy ray of freezing moonlight strikes the target in a burst of silver frost.', () => [
    cast('Moonlight focuses', ['moonbeam.01.intro.blue'], { stageId: 'c', duration: 700, scale: 0.5 }),
    travel('Moonlight ray', ['ray_of_frost.blueyellow', 'ray_of_frost.blue'], { stageId: 'ray', after: 'c', duration: 1300 }),
    impact('Silver frost', ['impact.frost.white.01'], { after: 'ray', anchor: 'start', offset: 750, duration: 1400, scale: 0.9 }),
    impact('Holy glow', ['sacred_flame.target.white', 'sacred_flame.target.yellow'], { after: 'ray', anchor: 'start', offset: 950, duration: 1600, scale: 0.7 }),
    motion('recoil', 'targets', { after: 'ray', anchor: 'start', offset: 750, duration: 650 }),
  ]),
  // 103 Morass of Ages
  'pf2e:D6BcAoWFxHYTKwVZ': design('Temporal eddies swirl around the caster and slow creatures inside.', () => [
    area('Time eddies', ['template_circle.vortex.loop.blue', 'energy_field.02.below.blue'], { stageId: 'v', duration: 3500, opacity: 0.8 }),
    area('Time draws out', ['energy_field.02.above.blue'], { after: 'v', anchor: 'start', offset: 500, duration: 2500, opacity: 0.5 }),
    motion('press', 'targets', { after: 'v', anchor: 'start', offset: 900, duration: 1400, intensity: 0.4 }),
  ], { sound: 'slow' }),
  // 104 Mosquito Blight
  'pf2e:dNpIc5k1aCI3bHIg': design('A biting insect swarm and sickly disease haze fill the ritual site.', () => [
    cast('Insects swarm', ['particles.002.001.complete.many.blue'], { stageId: 's', duration: 3000, scale: 1, ...tint('#4a4a36') }),
    cast('Disease haze', ['fumes.04.complete.green', 'fumes.04.complete.grey'], { after: 's', anchor: 'start', offset: 600, duration: 2400, scale: 0.9, opacity: 0.6 }),
  ], { sound: 'swarm' }),
  // 105 Moth's Supper
  'pf2e:xabHqik5SoyDc5Db': design('The caster sighs out black-winged moths that flutter about and range forth.', () => [
    cast('Breath of moths', ['butterflies.outward_burst.01.bluepurple'], { stageId: 'b', duration: 2200, scale: 1, ...tint('#3b3040') }),
    aura('Moths flutter', ['butterflies.loop.01.bluepurple'], { after: 'b', anchor: 'start', offset: 700, duration: 2400, scale: 1, opacity: 0.85, ...tint('#3b3040') }),
  ], { sound: 'swarm' }),
  // 106 Mother's Blessing
  'pf2e:qVXraYXlTjissCaG': design('The eggs are washed clean and buried in warm, vitality-blessed sand.', () => [
    cast('Eggs washed', ['liquid.splash.blue'], { stageId: 'w', duration: 1600, scale: 0.6 }),
    cast('Warm sand', ['particles.outward.greenyellow.01.01'], { after: 'w', anchor: 'start', offset: 600, duration: 2200, scale: 1, ...tint('#c5a77d') }),
    cast('Life blessed', GREEN_HEAL, { after: 'w', anchor: 'start', offset: 1200, duration: 2000, scale: 0.9 }),
  ], { sound: 'healing' }),
  // 107 Mountain Resilience
  'pf2e:2BV2yYPfVJ5zirZt': design('Stone crusts over the target\'s skin like a mountain face and it braces.', () => [
    impact('Stone stirs', ['impact.earth.01.browngreen', 'ground_cracks.orange.01'], { stageId: 's', duration: 1200, scale: 0.8 }),
    impact('Stone skin', ['aura_themed.01.inward.complete.metal.01.grey'], { after: 's', anchor: 'start', offset: 400, duration: 2200, scale: 1, ...tint('#8d7f6e') }),
    motion('brace', 'targets', { after: 's', anchor: 'start', offset: 600, duration: 900 }),
  ]),
  // 108 Movanic Glimmer
  'pf2e:e9tVGZhYW37CtbHA': design('A celestial glimmer of awareness lights in the animal\'s eyes.', () => [
    impact('Celestial glimmer', ['twinkling_stars.points07.white'], { stageId: 'g', duration: 2000, scale: 0.7 }),
    impact('Awareness opens', ['eyes.01.dark_green.single'], { after: 'g', anchor: 'start', offset: 500, duration: 1800, scale: 0.5, ...tint('#ffe9a8') }),
  ]),
  // 109 Mud Pit
  'pf2e:yAiSNmz39qXOIlco': design('Thick clinging mud spreads across the burst.', () => [
    area('Mud splashes', ['liquid.splash.brown', 'liquid.splash.blue'], { stageId: 's', duration: 1400, ...tint('#70553f') }),
    area('Thick mud', ['grease.dark_brown.loop'], { after: 's', anchor: 'start', offset: 300, duration: 3600, opacity: 0.9, fadeIn: 400, fadeOut: 600 }),
  ], { sound: 'water' }),
  // 110 Murder of Crows
  'pf2e:KT0AR9yfSV3Cq8A4': design('A black flock streams to the target and harries it with beak and talon.', () => [
    cast('Call the flock', ['swirling_feathers.outburst.01.textured'], { stageId: 'c', duration: 900, scale: 0.6, ...tint('#2c2c34') }),
    projectile('Flock flies', ['bats.complete.01.red'], { stageId: 'f', after: 'c', anchor: 'start', offset: 300, duration: 1100, scale: 0.8, ...tint('#2c2c34') }),
    impact('Flock torments', ['bats.loop.01.red'], { after: 'f', anchor: 'start', offset: 750, duration: 2200, scale: 1.1, ...tint('#2c2c34') }),
    impact('Torn feathers', ['swirling_feathers.outburst.01.textured'], { after: 'f', anchor: 'start', offset: 1250, duration: 1200, scale: 0.8, ...tint('#2c2c34') }),
    motion('shake', 'targets', { after: 'f', anchor: 'start', offset: 750, duration: 900, intensity: 0.4 }),
  ]),
  // 111 Murderous Vine
  'pf2e:kCgkreCT6g0dipMd': design('A thorny vine slithers up around the foe and crushes it.', () => [
    cast('Vine summoned', ['swirling_leaves.complete.02.green'], { stageId: 'c', duration: 700, scale: 0.7 }),
    impact('Vine constricts', ['vine.complete.nature.group.02.green'], { stageId: 'v', after: 'c', duration: 2400, scale: 0.9 }),
    motion('press', 'targets', { after: 'v', anchor: 'start', offset: 600, duration: 1100, intensity: 0.7 }),
  ]),
  // 112 Murmuration
  'pf2e:4EmLum6EdvXxbxCj': design('Phantom feathers brush the target while screeches ring in its ears.', () => [
    impact('Brush of feathers', ['swirling_feathers.outburst.01.textured'], { stageId: 'f', duration: 1600, scale: 0.8, ...tint('#3a3a44') }),
    impact('Screeches', ['soundwave.01.blue'], { after: 'f', anchor: 'start', offset: 300, duration: 1200, scale: 0.9 }),
    motion('shake', 'targets', { after: 'f', anchor: 'start', offset: 300, duration: 700, intensity: 0.35 }),
  ]),
  // 113 Muscle Barrier
  'pf2e:lbQCmM0e89Y4ou7F': design('The thrall bursts into gory pieces that wrap the ally in layers of thick muscle.', () => [
    impact('Thrall splits', ['liquid.splash02.red'], { stageId: 's', duration: 1000, scale: 0.7 }),
    impact('Muscle wraps', ['shield.01.intro.red', 'shield.01.intro.blue'], { after: 's', anchor: 'start', offset: 400, duration: 1600, scale: 1.1, ...tint('#a8433a') }),
    motion('brace', 'targets', { after: 's', anchor: 'start', offset: 600, duration: 800 }),
  ], { sound: 'shield' }),
  // 114 Mushroom Patch
  'pf2e:xCfOskoogDf9LBlD': design('Mushrooms sprout across the burst and puff irritating spores.', () => [
    area('Mushrooms sprout', ['plant_growth.02.round.4x4.complete.greenred', 'plant_growth.03.round.4x4.complete.greenyellow'], { stageId: 'g', duration: 3200, below: true, ...tint('#b49a7a') }),
    area('Spore clouds', ['fumes.04.complete.green', 'fumes.04.complete.grey'], { after: 'g', anchor: 'start', offset: 800, duration: 2600, opacity: 0.7, ...tint('#c8c39a') }),
  ], { sound: 'growth' }),
  // 118 Mycological Malady
  'pf2e:V4jrHiaMh4XuANOP': design('Fungal spores burst over the target and take root as it sickens.', () => [
    cast('Spores gather', ['fumes.04.complete.green', 'fumes.04.complete.grey'], { stageId: 'c', duration: 900, scale: 0.5 }),
    impact('Spore cloud', ['fumes.04.complete.green', 'fumes.04.complete.grey'], { stageId: 'sp', after: 'c', anchor: 'start', offset: 400, duration: 2400, scale: 0.9, ...tint('#a8a070') }),
    impact('Fungal bloom', ['plant_growth.02.round.2x2.complete.greenred', 'plant_growth.03.round.2x2.complete.greenyellow'], { after: 'sp', anchor: 'start', offset: 600, duration: 2000, scale: 0.6, ...tint('#b49a7a') }),
    motion('stagger', 'targets', { after: 'sp', anchor: 'start', offset: 600, duration: 900 }),
  ], { sound: 'poison' }),
  // 121 Mystic Carriage
  'pf2e:jOWQ5wPd4xvSkjI5': design('Incense smoke and burning feathers rise as the carriage is called.', () => [
    cast('Incense burns', ['fumes.steam.white'], { stageId: 'i', duration: 2400, scale: 0.6 }),
    cast('Feathers burn', ['swirling_feathers.outburst.01.textured'], { after: 'i', anchor: 'start', offset: 500, duration: 2000, scale: 0.7 }),
    cast('Carriage summoned', ['magic_signs.circle.02.conjuration.complete.blue', 'magic_signs.circle.02.conjuration.complete.yellow'], { after: 'i', anchor: 'start', offset: 1200, duration: 2400, scale: 1.2, below: true }),
  ], { sound: 'summon' }),
  // 126 Nature's Reprisal
  'pf2e:YtBZq49N4Um1cwm7': design('Plant life across the area writhes, lashes out and exudes poison.', () => [
    area('Plants writhe', ['vine.complete.nature.group.01.green'], { stageId: 'v', duration: 3200 }),
    area('Poison sap', ['fumes.toxic.green', 'fumes.04.complete.grey'], { after: 'v', anchor: 'start', offset: 700, duration: 2200, opacity: 0.6 }),
    motion('stagger', 'targets', { after: 'v', anchor: 'start', offset: 800, duration: 800 }),
  ], { sound: 'vines' }),
  // 128 Necrotic Bomb
  'pf2e:cg1l2AxBenLU6JFE': design('The overloaded thrall explodes in a blast of void energy.', () => [
    cast('Void overload', ['arms_of_hadar.dark_purple'], { stageId: 'c', duration: 700, scale: 0.6 }),
    area('Void explosion', ['explosion.dark_purple', 'explosion.04.blue'], { stageId: 'b', after: 'c', duration: 1600, ...tint('#4b2a5e') }),
    area('Smoke disperses', ['smoke.puff.ring.01.dark_black', 'smoke.puff.ring.01.white'], { after: 'b', anchor: 'start', offset: 400, duration: 1800, opacity: 0.8 }),
    motion('stagger', 'targets', { after: 'b', anchor: 'start', offset: 300, duration: 800 }),
  ]),
  // 129 Necrotic Radiation
  'pf2e:29p7NMY2OTpaINzt': design('A slow sickly void glow seeps into the touched object or space.', () => [
    impact('Necrotic glow', ['energy_field.02.above.purple', 'energy_field.02.above.blue'], { stageId: 'g', duration: 2800, scale: 0.9, ...tint('#6a7a3a') }),
    impact('Void motes', ['particles.outward.greenyellow.01.01'], { after: 'g', anchor: 'start', offset: 500, duration: 2200, scale: 0.8, ...tint('#7a5a9a') }),
  ]),
  // 130 Necrotize
  'pf2e:6lO6uMQxbqmYho0e': design('Void energy rots part of the target\'s body in a putrid burst of decay.', () => [
    impact('Flesh decays', ['fumes.04.complete.green', 'fumes.04.complete.grey'], { stageId: 'd', duration: 2200, scale: 0.8, ...tint('#5d6b3a') }),
    impact('Necrosis', ['toll_the_dead.green.skull_smoke'], { after: 'd', anchor: 'start', offset: 400, duration: 1800, scale: 0.6 }),
    motion('stagger', 'targets', { after: 'd', anchor: 'start', offset: 400, duration: 900 }),
  ]),
  // 132 Needle of Vengeance
  'pf2e:aEitTTb9PnOyidRf': design('A long jagged psychic needle jabs into the foe\'s mind.', () => [
    cast('Hex woven', PURPLE_CAST, { stageId: 'c', duration: 700, scale: 0.7 }),
    impact('Psychic needle', ['melee_generic.piercing.one_handed', 'dagger.melee.02.white'], { stageId: 'n', after: 'c', duration: 1000, scale: 0.8, ...tint('#b07cff') }),
    impact('Mind stung', ['impact.pinkpurple', 'impact.004.blue'], { after: 'n', anchor: 'start', offset: 350, duration: 900, scale: 0.6 }),
    motion('recoil', 'targets', { after: 'n', anchor: 'start', offset: 350, duration: 600, intensity: 0.4 }),
  ]),
  // 133 Negate Aroma
  'pf2e:0fKHBh5goe2eiFYL': design('The target\'s scent disperses as a fading wisp.', () => [
    cast('Odor erased', PURPLE_CAST, { stageId: 'c', duration: 600, scale: 0.7 }),
    impact('Scent disperses', ['fumes.04.complete.purple', 'fumes.04.complete.grey'], { after: 'c', duration: 2400, scale: 0.8, opacity: 0.7 }),
  ]),
  // 134 Nettleskin
  'pf2e:BA143r8fCqmSjdRf': design('Green thorns burst out of the caster\'s skin and settle in a bristling layer.', () => [
    cast('Thorns sprout', ['ice_spikes.radial.burst.white'], { stageId: 't', duration: 1400, scale: 0.8, ...tint('#5f8a3a') }),
    aura('Nettle layer', ['vine.complete.nature.single.02.green'], { after: 't', anchor: 'start', offset: 400, duration: 2200, scale: 0.8, opacity: 0.85 }),
    motion('brace', 'source', { after: 't', anchor: 'start', offset: 200, duration: 800 }),
  ], { sound: 'thornWall' }),
  // 135 Never Mind
  'pf2e:5BbU1V6wGSGbrmRD': design('A curse dims the target\'s thoughts; it reels dazed.', () => [
    cast('Curse woven', PURPLE_CAST, { stageId: 'c', duration: 700, scale: 0.8 }),
    impact('Thoughts dim', ['icon.runes02.orange'], { stageId: 'r', after: 'c', duration: 1600, scale: 0.6, opacity: 0.7 }),
    impact('Mind fogged', ['dizzy_stars.200px.purple', 'dizzy_stars.200px.blueorange'], { after: 'r', anchor: 'start', offset: 600, duration: 2000, scale: 0.7 }),
    motion('shake', 'targets', { after: 'r', anchor: 'start', offset: 600, duration: 800, intensity: 0.35 }),
  ], { sound: 'psychic' }),
  // 136 Nightmare
  'pf2e:Uqj344bezBq3ESdq': design('A dark dream cloud forms and carries a horror to the sleeping target.', () => [
    cast('Dream connection', ['sleep.cloud.01.dark_purple', 'sleep.cloud.01.pink'], { stageId: 's', duration: 2400, scale: 0.8 }),
    cast('Nightmare sent', ['icon.horror.purple'], { after: 's', anchor: 'start', offset: 700, duration: 2000, scale: 0.5 }),
  ], { sound: 'fear' }),
  // 137 Noise Blast
  'pf2e:wzLkNU3AAqOSKFPR': design('A cacophonous blast of noise booms through the burst and staggers those caught in it.', () => [
    cast('Noise builds', ['cast_generic.sound.01.pinkteal'], { stageId: 'c', duration: 600, scale: 0.7 }),
    area('Sonic blast', ['shatter.blue'], { stageId: 'b', after: 'c', duration: 1100 }),
    area('Sound wave', ['soundwave.01.blue'], { after: 'b', anchor: 'start', offset: 200, duration: 1300, opacity: 0.8 }),
    motion('stagger', 'targets', { after: 'b', anchor: 'start', offset: 250, duration: 750 }),
  ]),
  // 139 Noxious Metals
  'pf2e:3A3ueS9Q0s3U8KXE': design('Toxic metal fumes fill the burst and coalesce as metal on each creature\'s skin.', () => [
    area('Toxic fumes', ['fumes.toxic.green', 'fumes.04.complete.grey'], { stageId: 'f', duration: 2600, opacity: 0.75 }),
    impact('Metal coalesces', ['aura_themed.01.inward.complete.metal.01.grey'], { after: 'f', anchor: 'start', offset: 600, duration: 1800, scale: 0.7, ...tint('#9fb08a') }),
    motion('stagger', 'targets', { after: 'f', anchor: 'start', offset: 800, duration: 800 }),
  ]),
  // 145 Nymph's Token
  'pf2e:pHrVvoTKygXeczVG': design('A flower token of favor blooms and is passed to the ally.', () => [
    cast('Flower favor', ['swirling_leaves.outburst.01.pink'], { stageId: 'f', duration: 1600, scale: 0.5 }),
    impact('Token of favor', ['icon.heart.pink'], { after: 'f', anchor: 'start', offset: 600, duration: 1800, scale: 0.35 }),
  ]),
  // 146 Oaken Resilience
  'pf2e:YWrfKetOqDwVFut7': design('Bark creeps over the target\'s skin and it braces like an oak.', () => [
    impact('Bark spreads', ['aura_themed.01.inward.complete.wood.01.green'], { stageId: 'b', duration: 2400, scale: 1 }),
    impact('Oaken skin', ['shield.01.intro.green', 'shield.01.intro.blue'], { after: 'b', anchor: 'start', offset: 700, duration: 1500, scale: 1, opacity: 0.55, ...tint('#7a5a3a') }),
    motion('brace', 'targets', { after: 'b', anchor: 'start', offset: 700, duration: 900 }),
  ]),
  // 147 Oathkeeper's Insignia
  'pf2e:cokeXkDHUAo4zHsw': design('A trinket of promise shimmers into being with its terms recorded.', () => [
    cast('Promise token', ['glint.yellow.few'], { stageId: 't', duration: 1500, scale: 0.6 }),
    cast('Terms recorded', ['icon.runes02.orange'], { after: 't', anchor: 'start', offset: 500, duration: 2000, scale: 0.5 }),
  ]),
  // 148 Object Memory
  'pf2e:RztmhJrLLQWoGVdB': design('Echoes of past makers and users rise from the touched object.', () => [
    cast('Experience drawn', PURPLE_CAST, { stageId: 'c', duration: 700, scale: 0.7 }),
    impact('Experience echo', ['magic_signs.rune.divination.complete.purple', 'magic_signs.rune.divination.complete.blue'], { stageId: 'e', after: 'c', duration: 2400, scale: 0.5 }),
    sprite('Echo of past users', { after: 'e', anchor: 'start', offset: 400, duration: 1500, opacity: 0.4 }),
  ]),
  // 150 Oblivious Expulsion
  'pf2e:QIjc7Zyej0P3b9v5': design('Memories of the cult are drawn inward and severed.', () => [
    cast('Memory focus', ['icon.runes02.orange'], { stageId: 'r', duration: 1800, scale: 0.6 }),
    cast('Memory drawn out', ['particles.inward.greenyellow.01.01'], { after: 'r', anchor: 'start', offset: 500, duration: 2200, scale: 1, ...tint('#c9b6ff') }),
  ]),
  // 153 Ode to Ouroboros
  'pf2e:DgCS456mXKw97vNy': design('A death-defying ode holds the dying ally just short of death.', () => [
    cast('Ode', ['music_notations.treble_clef.blue'], { stageId: 'o', duration: 1600, scale: 0.6 }),
    impact('Life held', ['healing_generic.200px.green', 'healing_generic.200px.blue'], { after: 'o', anchor: 'start', offset: 500, duration: 1800, scale: 0.8 }),
    impact('Death warded', ['ward.star.yellow.01'], { after: 'o', anchor: 'start', offset: 900, duration: 2200, scale: 0.7 }),
  ]),
  // 154 Oil-Slicked Walls
  'pf2e:bOf5WuLh6ZJloi7F': design('A slick oily sheen spreads and glistens.', () => [
    cast('Oil spreads', ['grease.dark_brown.loop'], { stageId: 'o', duration: 3200, scale: 0.9, fadeIn: 300, fadeOut: 500 }),
    cast('Sheen', ['shimmer.01.blue'], { after: 'o', anchor: 'start', offset: 700, duration: 2200, scale: 1.1, ...tint('#c9b27a') }),
  ]),
  // 158 One with the Land
  'pf2e:TbYqDhlNRiWHe146': design('The caster melds into the adjacent ground or tree, sinking into earth and leaves.', () => [
    cast('Feature meld', ['aura_themed.01.inward.complete.nature.01.green'], { stageId: 'm', duration: 2400, scale: 1 }),
    cast('Earth closes', ['impact.earth.01.browngreen', 'ground_cracks.orange.01'], { after: 'm', anchor: 'start', offset: 500, duration: 1500, scale: 0.8 }),
    motion('sink', 'source', { after: 'm', anchor: 'start', offset: 600, duration: 1400 }),
  ], { sound: 'earth' }),
  // 159 Oneiric Mire
  'pf2e:87zLUuTMmZ9zc7gH': design('Illusory dream-mire spreads across the burst and creatures feel pulled down into it.', () => [
    area('Dream mire', ['grease.dark_purple', 'grease.dark_brown.loop'], { stageId: 'm', duration: 3200, opacity: 0.85, fadeIn: 300, fadeOut: 500 }),
    area('Dreamstuff haze', ['sleep.cloud.01.pink'], { after: 'm', anchor: 'start', offset: 400, duration: 2600, opacity: 0.5 }),
    motion('sink', 'targets', { after: 'm', anchor: 'start', offset: 800, duration: 1400, intensity: 0.6 }),
  ]),
  // 161 Open the Wall of Ghosts
  'pf2e:PvkEzzCaDT07DcJb': design('The spirits of the barrier are addressed and the misty wall parts.', () => [
    cast('Barrier spirits', ['spirit_guardians.blueyellow.ring'], { stageId: 's', duration: 3000, scale: 1 }),
    cast('Mist parts', ['fog_cloud.01.white'], { after: 's', anchor: 'start', offset: 700, duration: 3000, scale: 1.1, opacity: 0.7 }),
  ], { sound: 'spirit' }),
  // 163 Ordained Purpose
  'pf2e:CPNlhDQP3aDmLzB3': design('Cosmic order rings out across the emanation and enemies cringe with remorse.', () => [
    cast('Order invoked', ['icosahedron.rune.above.blueyellow'], { stageId: 'c', duration: 1500, scale: 0.8 }),
    area('Purpose imposed', ['magic_signs.circle.02.abjuration.complete.blue'], { stageId: 'a', after: 'c', anchor: 'start', offset: 400, duration: 2600, opacity: 0.8 }),
    impact('Remorse', ['icon.horror.purple'], { after: 'a', anchor: 'start', offset: 500, duration: 1600, scale: 0.35 }),
    motion('cower', 'targets', { after: 'a', anchor: 'start', offset: 500, duration: 900, intensity: 0.5 }),
  ]),
  // 165 Osseous Cage
  'pf2e:Cbwhd4m7qrRoRjot': design('Bone spikes erupt into a cage around the space and pin those inside.', () => [
    area('Bone bars erupt', ['ice_spikes.radial.burst.white'], { stageId: 'b', duration: 1800, ...tint('#e8dfc8') }),
    area('Cage holds', ['ice_spikes.radial.loop.white'], { after: 'b', anchor: 'start', offset: 1200, duration: 2400, ...tint('#e8dfc8') }),
    motion('press', 'targets', { after: 'b', anchor: 'start', offset: 300, duration: 900, intensity: 0.6 }),
  ], { sound: 'stoneWall' }),
  // 166 Outcast's Curse
  'pf2e:KSAEhNfZyXMO7Z7V': design('A sour curse clings to the target and onlookers recoil from it.', () => [
    impact('Curse clings', ['energy_strands.02.marker.bluepurple'], { stageId: 'c', duration: 2400, scale: 0.9 }),
    impact('Off-putting aura', ['smoke.puff.centered.dark_green', 'smoke.puff.centered.grey'], { after: 'c', anchor: 'start', offset: 600, duration: 1600, scale: 0.7 }),
  ]),
  // 167 Over the Coals
  'pf2e:PcmFpaHPCReNp1BD': design('The witch\'s accusation brands the target with the patron\'s smoldering wrath.', () => [
    cast('Accusation', PURPLE_CAST, { stageId: 'c', duration: 700, scale: 0.8 }),
    impact('Patron\'s wrath', ['flames.purple.01', 'flames.01.orange'], { stageId: 'w', after: 'c', duration: 1800, scale: 0.6 }),
    impact('Debt claimed', ['icon.runes03.orange'], { after: 'w', anchor: 'start', offset: 400, duration: 1500, scale: 0.4 }),
    motion('cower', 'targets', { after: 'w', anchor: 'start', offset: 300, duration: 800, intensity: 0.4 }),
  ], { sound: 'psychic' }),
  // 168 Overflowing Sorrow
  'pf2e:eCniO6INHNfc9Svr': design('Blue sorrow flows out through the emanation and creatures droop.', () => [
    cast('Sorrow wells', ['icon.drop.red'], { stageId: 'c', duration: 1500, scale: 0.4, ...tint('#79a0bb') }),
    area('Sorrow spreads', ['energy_field.01.blue'], { after: 'c', anchor: 'start', offset: 300, duration: 3000, opacity: 0.7 }),
    motion('cower', 'targets', { after: 'c', anchor: 'start', offset: 900, duration: 1000, intensity: 0.4 }),
  ]),
  // 169 Overload Connection
  'pf2e:08Or2bBJuQTV2MAN': design('The familiar link flares into a line of scrambled mental static.', () => [
    cast('Link flares', PURPLE_CAST, { stageId: 'c', duration: 600, scale: 0.7 }),
    travel('Mental static line', ['energy_beam.normal.purple.01', 'energy_beam.normal.bluepink.02'], { stageId: 'l', after: 'c', duration: 1400, scale: 0.6 }),
    impact('Scrambled thoughts', ['dizzy_stars.200px.purple', 'dizzy_stars.200px.blueorange'], { after: 'l', anchor: 'start', offset: 700, duration: 1500, scale: 0.6 }),
    motion('shake', 'targets', { after: 'l', anchor: 'start', offset: 700, duration: 700, intensity: 0.4 }),
  ]),
  // 171 Overstuff
  'pf2e:mFHQ2u4LWiejqKQG': design('A huge meal fills the target, which lurches queasily.', () => [
    cast('Meal created', PURPLE_CAST, { stageId: 'c', duration: 600, scale: 0.7 }),
    impact('Food fills stomach', ['liquid.blob.purple', 'liquid.blob.blue'], { stageId: 'f', after: 'c', duration: 1800, scale: 0.6, ...tint('#ccb898') }),
    impact('Queasy', ['fumes.04.complete.green', 'fumes.04.complete.grey'], { after: 'f', anchor: 'start', offset: 700, duration: 1500, scale: 0.5 }),
    motion('stagger', 'targets', { after: 'f', anchor: 'start', offset: 800, duration: 900, intensity: 0.5 }),
  ]),
  // 173 Overwhelming Presence
  'pf2e:fkDeKktdmbeplYRY': design('The caster blazes with godlike splendor and creatures bow in tribute.', () => [
    cast('Divine splendor', ['divine_smite.caster.standard.yellowwhite', 'divine_smite.caster.standard.blueyellow'], { stageId: 'c', duration: 1800, scale: 1.2 }),
    aura('Regalia glow', ['ward.star.yellow.01'], { after: 'c', anchor: 'start', offset: 500, duration: 2400, scale: 1.1, opacity: 0.8 }),
    impact('Awe', ['glint.yellow.many'], { after: 'c', anchor: 'start', offset: 900, duration: 1600, scale: 0.6 }),
    motion('levitate', 'source', { after: 'c', anchor: 'start', offset: 400, duration: 1400, intensity: 0.4 }),
    motion('cower', 'targets', { after: 'c', anchor: 'start', offset: 1000, duration: 1000, intensity: 0.5 }),
  ], { sound: 'holy' }),
  // 174 Owb Pact
  'pf2e:u3G7KX1qpFJlSeWm': design('Darkness gathers and an owb\'s gaze turns toward the bargain.', () => [
    cast('Owb invitation', ['darkness.black'], { stageId: 'd', duration: 3000, scale: 1.1 }),
    cast('Owb attention', ['eyes.01.dark_green.single'], { after: 'd', anchor: 'start', offset: 800, duration: 2000, scale: 0.6 }),
  ], { sound: 'shadow' }),
  // 176 Pack Breaker
  'pf2e:cGGEi67G1RStR9cD': design('Suspicion clouds the creatures\' view of their allies and the bonds between them fray.', () => [
    impact('Allies misperceived', ['eyes.01.dark_green.single'], { stageId: 'e', duration: 1800, scale: 0.5 }),
    impact('Bonds fray', ['markers.chain.spectral_standard.complete.02.blue'], { after: 'e', anchor: 'start', offset: 500, duration: 2400, scale: 0.8 }),
  ]),
  // 177 Pact Broker
  'pf2e:YNAthsgsJjQIXbc8': design('An enchantment rune offers a pact of peace to the target.', () => [
    cast('Pact offered', PURPLE_CAST, { stageId: 'c', duration: 600, scale: 0.7 }),
    impact('Pact rune', ['magic_signs.rune.enchantment.complete.pink'], { after: 'c', duration: 2000, scale: 0.5 }),
  ]),
  // 178 Pain of Ages
  'pf2e:HreHc5elibW9hVK8': design('Old anguish surges up from the ground as wailing spirits that batter enemies in the burst.', () => [
    area('Ground anguish', ['impact.ground_crack.01.purple', 'impact.ground_crack.orange.01'], { stageId: 'g', duration: 1800, below: true }),
    area('Anguished spirits', ['spirit_guardians.dark_purple.spirits', 'spirit_guardians.blueyellow.ring'], { stageId: 's', after: 'g', anchor: 'start', offset: 300, duration: 3000, opacity: 0.9 }),
    impact('Anguish strikes', ['icon.horror.purple'], { after: 's', anchor: 'start', offset: 600, duration: 1500, scale: 0.35 }),
    motion('stagger', 'targets', { after: 's', anchor: 'start', offset: 600, duration: 900 }),
  ]),
  // 181 Palm-Held Sun
  'pf2e:D7yI9WPr9ahkaXNf': design('A miniature star ignites above the palm and sheds blazing sunlight.', () => [
    cast('Rift to the Forge', ['sacred_flame.source.yellow'], { stageId: 'r', duration: 1400, scale: 0.6 }),
    aura('Miniature star', ['dancing_light.yellow'], { after: 'r', anchor: 'start', offset: 600, duration: 3000, scale: 0.6, offsetY: -0.4, offsetUnits: 'token' }),
    aura('Sunlight', ['bless.400px.intro.yellow'], { after: 'r', anchor: 'start', offset: 800, duration: 2400, scale: 1.2, opacity: 0.7 }),
  ], { sound: 'light' }),
  // 183 Paranoia
  'pf2e:Mkbq9xlAUxHUHyR2': design('Watching eyes crowd the target\'s vision and it flinches from everyone.', () => [
    impact('Eyes everywhere', ['eyes.01.dark_green.many'], { stageId: 'e', duration: 2400, scale: 0.8 }),
    impact('Suspicion', ['icon.fear.dark_purple'], { after: 'e', anchor: 'start', offset: 500, duration: 1800, scale: 0.4 }),
    motion('cower', 'targets', { after: 'e', anchor: 'start', offset: 600, duration: 900, intensity: 0.4 }),
  ], { sound: 'fear' }),
  // 184 Parch
  'pf2e:7CUgqHunmHfW2lC5': design('Dry dusty winds whip around the target and wick its moisture away.', () => [
    impact('Dry winds', ['wind_lines.01.01.white'], { stageId: 'w', duration: 2000, scale: 1.1, ...tint('#cfb899') }),
    impact('Dust devil', ['whirlwind.bluegrey'], { after: 'w', anchor: 'start', offset: 200, duration: 1800, scale: 0.6, ...tint('#cfb899') }),
    motion('stagger', 'targets', { after: 'w', anchor: 'start', offset: 600, duration: 900, intensity: 0.5 }),
  ]),
  // 185 Part the Mists to Paradise
  'pf2e:9sofMbyYL80shsHH': design('Dense magical mist rolls in and a radiant pathway to paradise opens through it.', () => [
    cast('Mist rolls in', ['ambient_fog.001.complete.small.white'], { stageId: 'm', duration: 3000, scale: 1.4, opacity: 0.8 }),
    cast('Pathway opens', ['portals.vertical.ring.yellow', 'portals.vertical.ring.bright_yellow'], { after: 'm', anchor: 'start', offset: 600, duration: 2600, scale: 1.1 }),
    cast('Paradise glow', GREEN_HEAL, { after: 'm', anchor: 'start', offset: 1200, duration: 1800, scale: 1 }),
  ], { sound: 'teleport' }),
  // 188 Patron's Puppet
  'pf2e:aq1yonHeYpbaj3XI': design('Patron threads reach down and take hold of the familiar.', () => [
    cast('Patron command', ['energy_strands.complete.blue.01'], { stageId: 'c', duration: 1600, scale: 0.8 }),
    cast('Puppet threads', ['energy_strands.overlay.blue.01'], { after: 'c', anchor: 'start', offset: 500, duration: 2000, scale: 0.6 }),
  ]),
  // 191 Peaceful Rest
  'pf2e:xRgU9rrhmGAgG4Rc': design('A quiet preservation seal settles over the corpse.', () => [
    cast('Rest preserved', PURPLE_CAST, { stageId: 'c', duration: 600, scale: 0.7 }),
    impact('Preservation seal', ['ward.rune.dark_purple.01', 'ward.rune.yellow.01'], { stageId: 's', after: 'c', duration: 2400, scale: 0.7 }),
    impact('Still veil', ['shimmer.01.purple', 'shimmer.01.blue'], { after: 's', anchor: 'start', offset: 500, duration: 2000, scale: 1 }),
  ]),
  // 192 Peer Into the Past
  'pf2e:7ymYZ89WNBqGxWuh': design('Time is peered through and a frozen past scene shimmers into view.', () => [
    cast('Past moment focus', ['eyes.01.dark_green.single'], { stageId: 'e', duration: 1800, scale: 0.55 }),
    cast('Time vortex', ['template_circle.vortex.intro.blue', 'energy_field.02.above.blue'], { after: 'e', anchor: 'start', offset: 500, duration: 2200, scale: 0.8 }),
    cast('Frozen scene', ['shimmer.01.blue'], { after: 'e', anchor: 'start', offset: 1100, duration: 2400, scale: 1.3 }),
  ], { sound: 'time' }),
  // 194 Penumbral Shroud
  'pf2e:zdb8cjOIDVKYMWdr': design('A shroud of shadow envelops the target, dimming the light around it.', () => [
    cast('Shadow gathers', ['smoke.plumes.01.purple', 'smoke.plumes.01.grey'], { stageId: 'c', duration: 700, scale: 0.6, ...tint('#2b2533') }),
    impact('Shadow shroud', ['darkness.black'], { after: 'c', duration: 2600, scale: 0.8, opacity: 0.85 }),
  ], { sound: 'shadow' }),
  // 198 Perfected Body
  'pf2e:8ifpNZkaxrbs3dBJ': design('The caster\'s body shrugs off the affliction in a brief green flush of resilience.', () => [
    cast('Body withstands', ['aura_themed.01.inward.complete.nature.01.green'], { stageId: 'b', duration: 2000, scale: 0.9 }),
    cast('Resilience', ['shield.01.intro.green', 'shield.01.intro.blue'], { after: 'b', anchor: 'start', offset: 500, duration: 1400, scale: 0.9, opacity: 0.6 }),
    motion('brace', 'source', { after: 'b', anchor: 'start', offset: 400, duration: 800 }),
  ]),
  // 199 Perfected Mind
  'pf2e:cDFAQN7Z3es07WSA': design('The caster centers its mind and the distraction burns away.', () => [
    cast('Mind centers', ['magic_signs.circle.02.abjuration.complete.blue'], { stageId: 'c', duration: 2000, scale: 0.7 }),
    cast('Distraction cleared', ['particle_burst.01.circle.bluepurple'], { after: 'c', anchor: 'start', offset: 700, duration: 1300, scale: 0.6 }),
  ]),
  // 200 Perfected Thrall
  'pf2e:34d5j4TJFMwz4b8f': design('Blood, bone and a warrior spirit converge into a perfected thrall.', () => [
    cast('Blood and muscle', ['liquid.splash02.red'], { stageId: 'b', duration: 1600, scale: 1 }),
    cast('Hardened bone', ['ice_spikes.radial.burst.white'], { after: 'b', anchor: 'start', offset: 400, duration: 1400, scale: 0.7, ...tint('#e8dfc8') }),
    cast('Warrior spirit', ['spirit_guardians.dark_purple.spirits', 'spirit_guardians.blueyellow.ring'], { after: 'b', anchor: 'start', offset: 900, duration: 2400, scale: 0.8 }),
  ], { sound: 'summon' }),
  // 201 Perfection of Essence
  'pf2e:kExRMPVI07iIFCaa': design('A purifying poison is drunk and the essence burns with spirit.', () => [
    cast('Poison drunk', ['liquid.splash02.green', 'liquid.splash.blue'], { stageId: 'p', duration: 1400, scale: 0.5 }),
    cast('Ordeal', ['icon.poison.dark_green'], { after: 'p', anchor: 'start', offset: 500, duration: 1800, scale: 0.4 }),
    cast('Essence purified', ['sacred_flame.source.white', 'sacred_flame.source.yellow'], { after: 'p', anchor: 'start', offset: 1100, duration: 1800, scale: 0.7 }),
  ]),
  // 203 Perseis's Precautions
  'pf2e:ovx7O2FHvkjXhMcA': design('Divinatory wards keep watch for an ambush around the target.', () => [
    impact('Vigilant eyes', ['eyes.01.dark_green.single'], { stageId: 'e', duration: 1800, scale: 0.5 }),
    impact('Precaution ward', ['magic_signs.rune.divination.complete.blue'], { after: 'e', anchor: 'start', offset: 500, duration: 2000, scale: 0.6 }),
  ]),
  // 204 Persistent Servant
  'pf2e:qCmihBL0G0G5ExPF': design('A phantasmal hand appears in the area and sets to its chore.', () => [
    area('Servant summoned', ['magic_signs.circle.02.conjuration.complete.blue', 'magic_signs.circle.02.conjuration.complete.yellow'], { stageId: 'c', duration: 2200, scale: 0.4 }),
    area('Phantasmal servant', ['arcane_hand.blue'], { after: 'c', anchor: 'start', offset: 700, duration: 2600, scale: 0.4 }),
  ], { sound: 'summon' }),
  // 205 Personal Blizzard
  'pf2e:g4MAIQodRDVfNp1B': design('The patron\'s icy breath becomes a scouring blizzard that clings to the target.', () => [
    impact('Personal blizzard', ['sleet_storm.01.blue'], { stageId: 'b', duration: 3200, scale: 0.6 }),
    impact('Scouring ice', ['aura_themed.01.inward.complete.cold.01.blue'], { after: 'b', anchor: 'start', offset: 500, duration: 2400, scale: 0.9 }),
    motion('shake', 'targets', { after: 'b', anchor: 'start', offset: 500, duration: 900, intensity: 0.4 }),
  ]),
  // 206 Personal Ocean
  'pf2e:K2bTUhucPyhXlzjw': design('A bubble-like shroud of seawater swells around the caster.', () => [
    cast('Water surges', ['water_splash.circle.01.blue'], { stageId: 'w', duration: 1400, scale: 0.8 }),
    aura('Seawater bubble', ['bubble.001.001.complete.blue'], { after: 'w', anchor: 'start', offset: 300, duration: 3200, scale: 1.2 }),
  ], { sound: 'water' }),
  // 207 Personal Rain Cloud
  'pf2e:kJKSLfCgqxmN2FY8': design('A small rain cloud forms above the target and drizzles on it.', () => [
    impact('Overhead cloud', ['fog_cloud.01.white'], { stageId: 'c', duration: 3200, scale: 0.6, offsetY: -0.45, offsetUnits: 'token', ...tint('#9aa6b2') }),
    impact('Falling rain', ['template_square.raindrops.001.5x5.instant.combined.blue', 'sleet_storm.01.blue'], { after: 'c', anchor: 'start', offset: 500, duration: 2600, scale: 0.8 }),
  ]),
  // 210 Pest Swarm
  'pf2e:fRqHDOWmgcUTeT03': design('A buzzing squadron of pests swarms up from the ground and air.', () => [
    cast('Pests gather', ['particles.inward.greenyellow.01.01'], { stageId: 'g', duration: 1600, scale: 1.2, ...tint('#5a5038') }),
    impact('Pest swarm', ['particles.002.001.complete.many.blue'], { after: 'g', anchor: 'start', offset: 600, duration: 2800, scale: 1.2, ...tint('#4a4430') }),
  ], { sound: 'swarm' }),
  // 211 Pet Cache
  'pf2e:F1nlmqOIucch3Cmt': design('A pocket dimension opens and the companion is drawn inside.', () => [
    cast('Pocket opens', PURPLE_CAST, { stageId: 'c', duration: 500, scale: 0.7 }),
    impact('Pocket entrance', ['portals.vertical.vortex.purple', 'portals.horizontal.ring.bright_yellow'], { stageId: 'p', after: 'c', duration: 2400, scale: 0.9 }),
    motion('sink', 'targets', { after: 'p', anchor: 'start', offset: 600, duration: 1200 }),
  ]),
  // 212 Petal Storm
  'pf2e:D31YX7zvRBvenTAz': design('Razor-sharp petals thrash in a whirling storm across the burst.', () => [
    area('Petal whirl', ['whirlwind.bluegrey'], { stageId: 'w', duration: 3200, opacity: 0.6, ...tint('#efa8d1') }),
    area('Razor petals', ['swirling_leaves.outburst.01.pink'], { after: 'w', anchor: 'start', offset: 300, duration: 2600 }),
    motion('shake', 'targets', { after: 'w', anchor: 'start', offset: 600, duration: 900, intensity: 0.4 }),
  ]),
  // 213 Petrify
  'pf2e:znv4ECL7ZtuiagtA': design('Grey stone creeps over the target\'s body as it slows to a halt.', () => [
    cast('Earth stirs', ['cast_generic.earth.01.browngreen'], { stageId: 'c', duration: 700, scale: 0.7 }),
    impact('Stone creeps', ['aura_themed.01.inward.complete.metal.01.grey'], { stageId: 's', after: 'c', duration: 2600, scale: 1, ...tint('#8f8a80') }),
    impact('Stone dust', ['smoke.puff.centered.grey'], { after: 's', anchor: 'start', offset: 900, duration: 1400, scale: 0.7 }),
    motion('press', 'targets', { after: 's', anchor: 'start', offset: 500, duration: 1500, intensity: 0.5 }),
  ]),
  // 214 Phantasmagoria
  'pf2e:MJx7DmjsWYzDZ3a4': design('Colliding dream images flood the targets\' minds and they reel.', () => [
    impact('Dream images collide', ['sleep.cloud.02.pink'], { stageId: 'd', duration: 2600, scale: 1.1 }),
    impact('Many lives', ['eyes.01.dark_green.many'], { after: 'd', anchor: 'start', offset: 400, duration: 2000, scale: 0.8 }),
    motion('stagger', 'targets', { after: 'd', anchor: 'start', offset: 600, duration: 900 }),
  ]),
  // 215 Phantasmal Calamity
  'pf2e:0XP2XOxT9VSiXFDr': design('An illusory apocalypse of fire and splitting earth erupts across the burst; creatures cower.', () => [
    area('Illusory cataclysm', ['fireball.explosion.purple', 'fireball.explosion.orange'], { stageId: 'x', duration: 1800, opacity: 0.8 }),
    area('Earth splits', ['impact.ground_crack.01.purple', 'impact.ground_crack.orange.01'], { after: 'x', anchor: 'start', offset: 300, duration: 2400, below: true }),
    motion('cower', 'targets', { after: 'x', anchor: 'start', offset: 500, duration: 1000, intensity: 0.5 }),
  ]),
  // 216 Phantasmal Custodians
  'pf2e:uuoPmbjEtqzWZs0v': design('Phantasmal hands shimmer into being to tend the site.', () => [
    cast('Custodians called', ['arcane_hand.blue'], { stageId: 'h', duration: 2400, scale: 0.6 }),
    cast('Entities settle', ['shimmer.01.blue'], { after: 'h', anchor: 'start', offset: 600, duration: 2400, scale: 1.3 }),
  ]),
  // 217 Phantasmal Killer
  'pf2e:tlcrVRqW1MSKJ5IC': design('A phantom of the target\'s worst fear rushes it and rakes with imaginary claws.', () => [
    cast('Assailant appears', ['shimmer.01.purple', 'shimmer.01.blue'], { stageId: 'c', duration: 700, scale: 0.8 }),
    impact('Phantom horror', ['icon.horror.purple'], { stageId: 'h', after: 'c', duration: 1800, scale: 0.9 }),
    impact('Imaginary claws', ['claws.200px.bright_purple', 'claws.200px.red'], { after: 'h', anchor: 'start', offset: 700, duration: 1300, scale: 1 }),
    motion('cower', 'targets', { after: 'h', anchor: 'start', offset: 700, duration: 1100, intensity: 0.5 }),
  ], { sound: 'fear' }),
  // 219 Phantasmal Protagonist
  'pf2e:IKb9EOfsrhScO3GO': design('A storybook character shimmers into being.', () => [
    cast('Character recalled', ['icon.runes02.orange'], { stageId: 'r', duration: 1600, scale: 0.6 }),
    impact('Protagonist appears', ['shimmer.01.blue'], { after: 'r', anchor: 'start', offset: 500, duration: 2600, scale: 1.2 }),
  ]),
  // 220 Phantasmal Treasure
  'pf2e:L0GoJpHxSD0wRY5k': design('A glittering vision of the target\'s heart\'s desire draws its gaze.', () => [
    impact('Precious desire', ['icon.heart.pink'], { stageId: 'h', duration: 1800, scale: 0.4 }),
    impact('Treasure gleams', ['glint.yellow.many'], { after: 'h', anchor: 'start', offset: 500, duration: 2000, scale: 0.8 }),
    motion('drift', 'targets', { after: 'h', anchor: 'start', offset: 800, duration: 1400, intensity: 0.4 }),
  ]),
  // 225 Phantom Ship
  'pf2e:oOFilBgsXTVIbJpN': design('The undead crew\'s bond turns the ship ghostly above the water.', () => [
    cast('Crew bond', ['spirit_guardians.blueyellow.ring'], { stageId: 's', duration: 2600, scale: 1 }),
    cast('Water connection', ['water_splash.circle.01.blue'], { after: 's', anchor: 'start', offset: 600, duration: 2000, scale: 1.1 }),
    cast('Ghostly', ['shimmer.01.blue'], { after: 's', anchor: 'start', offset: 1100, duration: 2200, scale: 1.2 }),
  ]),
  // 227 Phase Familiar
  'pf2e:rMOI8JFJ0nT2mrCF': design('The familiar flickers into a ghostly form as harm passes through it.', () => [
    impact('Familiar phases', ['shimmer.01.blue'], { stageId: 's', duration: 1800, scale: 0.9 }),
    motion('flicker', 'targets', { after: 's', anchor: 'start', offset: 200, duration: 1000 }),
  ]),
  // 228 Phoenix Ward
  'pf2e:lJdAvY1sJyEmNDc6': design('A fiery shield rises around the caster with phoenix-wing flames.', () => [
    cast('Flames rise', ['cast_generic.fire.01.orange'], { stageId: 'c', duration: 700, scale: 0.8 }),
    aura('Fire ward', ['shield_themed.above.fire.01.orange'], { stageId: 'w', after: 'c', anchor: 'start', offset: 400, duration: 2200, scale: 1.2 }),
    aura('Phoenix wings', ['swirling_feathers.outburst.01.orange', 'swirling_feathers.outburst.01.textured'], { after: 'w', anchor: 'start', offset: 500, duration: 1600, scale: 1.1, ...tint('#ff9a3d') }),
    motion('brace', 'source', { after: 'w', anchor: 'start', duration: 800 }),
  ], { sound: 'fireIgnition' }),
  // 232 Pillar of Water
  'pf2e:eIPIZp2FUbFcLNdj': design('A self-contained cylinder of clear water surges up and holds.', () => [
    cast('Water surges', ['water_splash.circle.01.blue'], { stageId: 'w', duration: 1500, scale: 1.3 }),
    cast('Water pillar', ['bubble.001.001.complete.blue'], { after: 'w', anchor: 'start', offset: 400, duration: 3200, scale: 1.5 }),
  ]),
  // 235 Plague Shot
  'pf2e:NjN6md0KpdelWpu7': design('Siege ammunition takes on a sickly green, diseased glow.', () => [
    cast('Disease infused', ['fumes.04.complete.green', 'fumes.04.complete.grey'], { stageId: 'f', duration: 2000, scale: 0.7 }),
    cast('Sickly glow', ['glint.yellow.few'], { after: 'f', anchor: 'start', offset: 600, duration: 2000, scale: 0.8, ...tint('#7eaa5c') }),
  ]),
  // 236 Planar Collision
  'pf2e:A125k5hYixepbzNb': design('A chunk of an elemental plane smashes into the burst, cracking the ground and hurling creatures away.', () => [
    area('Planar impact', ['explosion.03.blueyellow', 'explosion.03.blueyellow'], { stageId: 'x', duration: 1800 }),
    area('Maelstrom', ['energy_field.01.blue'], { after: 'x', anchor: 'start', offset: 300, duration: 2400, opacity: 0.7 }),
    area('Ground shatters', ['impact.ground_crack.01.orange', 'impact.ground_crack.orange.01'], { after: 'x', anchor: 'start', offset: 200, duration: 2600, below: true }),
    motion('rush', 'targets', { after: 'x', anchor: 'start', offset: 300, duration: 1500, distance: 2.5, motionRange: 'distance', motionHeading: 'away', intensity: 0.5 }),
  ]),
  // 237 Planar Displacement
  'pf2e:HmKajQS0DP23bipp': design('A ritual circle flares and the creatures in it shift away to another plane.', () => [
    cast('Ritual circle', ['magic_signs.circle.02.conjuration.complete.blue', 'magic_signs.circle.02.conjuration.complete.yellow'], { stageId: 'c', duration: 2400, scale: 1.4, below: true }),
    cast('Planar crossing', ['portals.horizontal.ring_masked.purple', 'portals.horizontal.ring.bright_yellow'], { after: 'c', anchor: 'start', offset: 800, duration: 2400, scale: 1.4 }),
  ]),
  // 238 Planar Palace
  'pf2e:vPWMEyVTreMOoFnm': design('A faint shimmering rectangular entrance to the demiplane opens.', () => [
    cast('Entrance opens', ['portals.vertical.ring.purple', 'portals.horizontal.ring.bright_yellow'], { stageId: 'p', duration: 3200, scale: 1.1 }),
    cast('Door shimmer', ['shimmer.01.blue'], { after: 'p', anchor: 'start', offset: 500, duration: 2400, scale: 0.9 }),
  ], { sound: 'pocketTransition' }),
  // 239 Planar Seal
  'pf2e:XZE4BawIlTf88Yl9': design('A visible abjuration barrier seals the area against planar travel.', () => [
    area('Planar barrier', ['bubble.001.001.complete.blue'], { stageId: 'b', duration: 3600, opacity: 0.8 }),
    area('Seal rune', ['magic_signs.circle.02.abjuration.complete.blue'], { after: 'b', anchor: 'start', offset: 500, duration: 2600, scale: 0.6 }),
  ], { sound: 'shield' }),
  // 240 Planar Servitor
  'pf2e:vgy00hnqxN9VoeoF': design('Divine light answers the petition and a servitor\'s presence shimmers.', () => [
    cast('Divine petition', ['ward.star.yellow.01'], { stageId: 'w', duration: 2200, scale: 1 }),
    cast('Servitor arrives', ['divine_smite.caster.standard.yellowwhite', 'divine_smite.caster.standard.blueyellow'], { after: 'w', anchor: 'start', offset: 800, duration: 2000, scale: 1 }),
  ], { sound: 'summon' }),
  // 241 Planar Tether
  'pf2e:ksLCg62cLOojw3gN': design('Planar stitches sew the target to its current plane.', () => [
    impact('Stitches gather', ['energy_strands.complete.purple.01', 'energy_strands.complete.blue.01'], { stageId: 's', duration: 2000, scale: 1 }),
    impact('Plane anchor', ['markers.chain.spectral_standard.complete.02.purple', 'markers.chain.spectral_standard.complete.02.blue'], { after: 's', anchor: 'start', offset: 500, duration: 2200, scale: 0.8 }),
    motion('press', 'targets', { after: 's', anchor: 'start', offset: 600, duration: 900, intensity: 0.4 }),
  ]),
  // 243 Plant Growth
  'pf2e:ZhJ8d9Uk4lwIx86b': design('Plants surge with health and fruitful growth around the caster.', () => [
    cast('Growth surges', ['plant_growth.03.round.4x4.complete.greenyellow'], { stageId: 'g', duration: 3600, scale: 1.2, below: true }),
    cast('Healthy foliage', ['swirling_leaves.complete.01.green'], { after: 'g', anchor: 'start', offset: 600, duration: 2600, scale: 1.1 }),
  ]),
  // 244 Plasma Whirl
  'pf2e:ku2MHKUoFlKQ0Bv7': design('A star-portal opens and blasts a cone of crackling plasma.', () => [
    cast('Star portal', ['portals.horizontal.ring.dark_red_yellow', 'portals.horizontal.ring.bright_yellow'], { stageId: 'p', duration: 1800, scale: 1 }),
    area('Plasma cone', ['burning_hands.01.orange'], { stageId: 'cone', after: 'p', anchor: 'start', offset: 600, duration: 2000 }),
    area('Plasma lightning', ['template_cone_PF2e.lightning.01.loop.bluepurple'], { after: 'cone', anchor: 'start', offset: 200, duration: 1800, opacity: 0.8 }),
    motion('stagger', 'targets', { after: 'cone', anchor: 'start', offset: 400, duration: 800 }),
  ]),
  // 245 Pocket Library
  'pf2e:TjWHgXqPv5jywMti': design('A small extradimensional opening to a library of runic knowledge appears.', () => [
    cast('Library opens', ['portals.vertical.ring.purple', 'portals.horizontal.ring.bright_yellow'], { stageId: 'p', duration: 2400, scale: 0.45 }),
    cast('Knowledge', ['icon.runes02.orange'], { after: 'p', anchor: 'start', offset: 600, duration: 1800, scale: 0.5 }),
  ], { sound: 'pocketTransition' }),
  // 247 Pollen Pods
  'pf2e:2uEuYmlyx1R7zQeH': design('Wooden bulbs sprout and swell with toxic pollen.', () => [
    cast('Bulbs sprout', ['plant_growth.03.round.2x2.complete.greenyellow'], { stageId: 'g', duration: 3000, scale: 0.8, below: true }),
    cast('Toxic pollen', ['particles.outward.greenyellow.01.01'], { after: 'g', anchor: 'start', offset: 800, duration: 2000, scale: 0.8 }),
  ], { sound: 'growth' }),
  // 248 Poltergeist's Fury
  'pf2e:uhEjKSFdEhXzszh6': design('Loose objects whirl around the caster in a telekinetic storm that pelts nearby creatures.', () => [
    aura('Telekinetic storm', ['whirlwind.purple', 'whirlwind.bluegrey'], { stageId: 'w', duration: 3200, scale: 1.4, opacity: 0.6 }),
    aura('Orbiting debris', ['cloud_of_daggers.daggers.purple'], { after: 'w', anchor: 'start', offset: 300, duration: 2800, scale: 1.2, ...spin(2500) }),
    motion('shake', 'targets', { after: 'w', anchor: 'start', offset: 800, duration: 900, intensity: 0.5 }),
  ], { sound: 'wind' }),
  // 249 Portrait of Spite
  'pf2e:Z60JRD78wT3afOEJ': design('A blood-painted portrait is cursed as grievances are recited.', () => [
    sprite('Portrait likeness', { duration: 1800, opacity: 0.5 }),
    cast('Blood paint', ['liquid.splash02.red'], { stageId: 'b', delay: 300, duration: 1500, scale: 0.5 }),
    cast('Curse sealed', ['magic_signs.rune.necromancy.complete.green'], { after: 'b', anchor: 'start', offset: 700, duration: 2000, scale: 0.5, ...tint('#8a2a3a') }),
  ]),
  // 250 Portrait of the Artist
  'pf2e:CuRat8IXBUu9C3Yw': design('An illusory disguise shimmers over the caster with a flourish of artistry.', () => [
    cast('Disguise shimmers', ['shimmer.01.blue'], { stageId: 's', duration: 2000, scale: 1 }),
    cast('Artistic flourish', ['twinkling_stars.points07.white'], { after: 's', anchor: 'start', offset: 600, duration: 1600, scale: 0.7 }),
  ]),
  // 252 Possession
  'pf2e:wU6hNzK8Yfqdmc8m': design('The caster\'s soul leaves its body and surges into the target to seize control.', () => [
    motion('flicker', 'source', { stageId: 'f', duration: 900 }),
    travel('Soul surges', ['energy_strands.range.standard.purple.01'], { stageId: 't', after: 'f', anchor: 'start', offset: 300, duration: 1300, scale: 0.6 }),
    impact('Possession', ['spirit_guardians.dark_purple.spirits', 'spirit_guardians.blueyellow.ring'], { after: 't', anchor: 'start', offset: 700, duration: 2200, scale: 0.6 }),
    motion('shake', 'targets', { after: 't', anchor: 'start', offset: 800, duration: 900, intensity: 0.5 }),
  ], { sound: 'spirit' }),
  // 253 Power of the Beasts
  'pf2e:otdzpPYzWMJt76Rh': design('Powdered beast bones are steeped as the hunter seeks the beast\'s power.', () => [
    cast('Bone soup', ['liquid.blob.blue'], { stageId: 'b', duration: 1800, scale: 0.5, ...tint('#b39b6e') }),
    cast('Beast power', ['claws.200px.brown', 'claws.200px.red'], { after: 'b', anchor: 'start', offset: 700, duration: 1600, scale: 0.7 }),
  ]),
  // 255 Power Word Kill
  'pf2e:m3lcOFm400lQCUps': design('A word of death rings out and a skull of void smoke engulfs the target.', () => [
    cast('Word of death', ['soundwave.02.purple', 'soundwave.02.blue'], { stageId: 'w', duration: 800, scale: 0.9 }),
    impact('Death word lands', ['toll_the_dead.purple.skull_smoke', 'toll_the_dead.green.skull_smoke'], { stageId: 'd', after: 'w', anchor: 'start', offset: 400, duration: 2200, scale: 1 }),
    motion('stagger', 'targets', { after: 'd', anchor: 'start', offset: 300, duration: 1000, intensity: 0.8 }),
  ]),
  // 256 Power Word Stun
  'pf2e:7PJSqUeKxTqOVrPk': design('A word of power rings out and the target reels stunned.', () => [
    cast('Word of power', ['soundwave.02.blue'], { stageId: 'w', duration: 800, scale: 0.7 }),
    impact('Stunned', ['icon.stun.purple'], { stageId: 's', after: 'w', anchor: 'start', offset: 400, duration: 2200, scale: 0.6 }),
    motion('shake', 'targets', { after: 's', anchor: 'start', duration: 900, intensity: 0.6 }),
  ]),
  // 257 Powerful Inhalation
  'pf2e:v4QHuVOhFD1JMAqu': design('The caster drags the air inward in a crushing rush; creatures stagger breathless.', () => [
    area('Air rushes inward', ['wind_lines.01.02.white'], { stageId: 'w', duration: 2400 }),
    aura('Vortex at caster', ['whirlwind.bluegrey'], { after: 'w', anchor: 'start', offset: 200, duration: 2000, scale: 0.7 }),
    motion('stagger', 'targets', { after: 'w', anchor: 'start', offset: 600, duration: 800 }),
  ]),
  // 258 Practice Makes Perfect
  'pf2e:HOj2YsTpkoMpYJH9': design('A corrective rune flashes over the ally as its effort improves.', () => [
    cast('Practice recalled', PURPLE_CAST, { stageId: 'c', duration: 600, scale: 0.7 }),
    impact('Corrective rune', ['magic_signs.rune.divination.complete.purple', 'magic_signs.rune.divination.complete.blue'], { after: 'c', duration: 2200, scale: 0.6 }),
  ]),
  // 259 Precious Gleam
  'pf2e:v14zLiiSc4sl9RrK': design('The weapon\'s metal gleams as it transmutes into a finer material.', () => [
    cast('Transmute', ['magic_signs.rune.transmutation.complete.yellow'], { stageId: 'c', duration: 1200, scale: 0.6 }),
    impact('Metal gleams', ['shimmer.01.orange', 'shimmer.01.blue'], { after: 'c', anchor: 'start', offset: 400, duration: 1800, scale: 0.8, ...tint('#dce7ef') }),
    impact('Glints', ['glint.yellow.few'], { after: 'c', anchor: 'start', offset: 800, duration: 1500, scale: 0.6 }),
  ]),
  // 261 Pressure Zone
  'pf2e:e4c73RBCQAZdYxau': design('Air pressure plunges across the burst and creatures wince and stumble.', () => [
    area('Pressure falls', ['wind_lines.01.01.white'], { stageId: 'w', duration: 3000, opacity: 0.8 }),
    area('Pressure zone', ['energy_field.02.above.blue'], { after: 'w', anchor: 'start', offset: 400, duration: 3000, opacity: 0.5 }),
    motion('stagger', 'targets', { after: 'w', anchor: 'start', offset: 800, duration: 900, intensity: 0.5 }),
  ], { sound: 'wind' }),
  // 263 Primal Call
  'pf2e:pZc8ZwtsyWnxUUW0': design('A faerie circle of leaves and growth calls a creature of nature.', () => [
    cast('Faerie circle', ['plant_growth.03.ring.4x4.complete.greenyellow'], { stageId: 'c', duration: 3200, scale: 1.2, below: true }),
    cast('Offerings swirl', ['swirling_leaves.complete.01.green'], { after: 'c', anchor: 'start', offset: 500, duration: 2400, scale: 1 }),
    cast('Fey lights', ['fairies.outward_burst.01.bluepurple'], { after: 'c', anchor: 'start', offset: 1200, duration: 2000, scale: 0.8 }),
  ], { sound: 'summon' }),
  // 264 Primal Chorus
  'pf2e:TPN3Z6VGau6Od9rG': design('The caster lets loose a primal howl that rolls outward for beasts to answer.', () => [
    cast('Primal howl', ['soundwave.02.blue'], { stageId: 'h', duration: 2000, scale: 1.4 }),
    cast('Beasts answer', ['footprints.monster.grey', 'footprints.shoe.grey'], { after: 'h', anchor: 'start', offset: 600, duration: 2200, scale: 0.9 }),
    motion('pulse', 'source', { after: 'h', anchor: 'start', duration: 800, intensity: 0.5 }),
  ], { sound: 'howl', soundNamespace: 'ability' }),
  // 266 Primal Phenomenon
  'pf2e:MLNeD5sAunV0E23j': design('Nature answers the request in a surge of leaves and growth.', () => [
    cast('Nature petition', ['swirling_leaves.complete.01.green'], { stageId: 'l', duration: 2400, scale: 1.2 }),
    cast('Nature answers', ['plant_growth.03.round.4x4.complete.greenyellow'], { after: 'l', anchor: 'start', offset: 500, duration: 3000, scale: 1, below: true }),
    cast('Primal burst', ['particles.outward.greenyellow.01.01'], { after: 'l', anchor: 'start', offset: 1200, duration: 1800, scale: 1 }),
  ], { sound: 'growth' }),
  // 270 Prismatic Sphere
  'pf2e:PngDCmU0MXZkbu0v': design('A seven-layered sphere of colored light forms over the burst.', () => [
    area('Red layer', ['bubble.001.001.complete.blue'], { stageId: 'r', duration: 3600, ...tint('#ff4141') }),
    area('Orange layer', ['bubble.001.001.complete.blue'], { delay: 150, duration: 3500, scale: 0.97, ...tint('#ffa74a') }),
    area('Yellow layer', ['bubble.001.001.complete.blue'], { delay: 300, duration: 3400, scale: 0.94, ...tint('#f2e965') }),
    area('Green layer', ['bubble.001.001.complete.blue'], { delay: 450, duration: 3300, scale: 0.91, ...tint('#77ca69') }),
    area('Blue layer', ['bubble.001.001.complete.blue'], { delay: 600, duration: 3200, scale: 0.88, ...tint('#67b3ea') }),
    area('Indigo layer', ['bubble.001.001.complete.blue'], { delay: 750, duration: 3100, scale: 0.85, ...tint('#6864c8') }),
    area('Violet layer', ['bubble.001.001.complete.blue'], { delay: 900, duration: 3000, scale: 0.82, ...tint('#b979d4') }),
  ]),
  // 271 Prismatic Spray
  'pf2e:d6o52BnjViNz7Gub': design('A fan of rainbow beams cascades from the caster\'s hand; struck creatures reel.', () => [
    cast('Rainbow gathers', ['twinkling_stars.points04.white'], { stageId: 'c', duration: 700, scale: 0.9 }),
    area('Rainbow fan', ['detect_magic.cone.yellow', 'detect_magic.cone.blue'], { stageId: 'fan', after: 'c', duration: 1600, ...tint('#ffd36b') }),
    travel('Red beam', ['scorching_ray.01.grey', 'scorching_ray.01.orange'], { stageId: 'r1', after: 'c', duration: 1200, scale: 0.5, ...tint('#ff4545') }),
    travel('Green beam', ['scorching_ray.01.grey', 'scorching_ray.01.orange'], { after: 'c', offset: 150, duration: 1200, scale: 0.5, targetSelection: 'secondary', ...tint('#69de80') }),
    travel('Violet beam', ['scorching_ray.01.grey', 'scorching_ray.01.orange'], { after: 'c', offset: 300, duration: 1200, scale: 0.5, ...tint('#7877dd') }),
    motion('stagger', 'targets', { after: 'r1', anchor: 'start', offset: 700, duration: 800 }),
  ]),
  // 273 Procyal Philosophy
  'pf2e:4cEDhvchskRvxSw6': design('A glowing, sagacious visage floats beside the target offering advice.', () => [
    impact('Procyal visage', ['spirit_guardians.blueyellow.spirits', 'spirit_guardians.blueyellow.ring'], { stageId: 'v', duration: 2400, scale: 0.4, offsetX: 0.6, offsetUnits: 'token' }),
    impact('Helpful advice', ['icon.runes02.orange'], { after: 'v', anchor: 'start', offset: 600, duration: 1800, scale: 0.4, offsetX: 0.6, offsetUnits: 'token' }),
  ]),
  // 276 Propelling Air Stream
  'pf2e:0qDJm5z3QVtkb3aD': design('A high-speed blast of air buffets the target and the recoil lifts the caster into the air.', () => [
    cast('Air compresses', ['wind_lines.01.02.white'], { stageId: 'c', duration: 600, scale: 0.7 }),
    travel('Air stream', ['gust_of_wind.veryfast'], { stageId: 'g', after: 'c', duration: 1300, scale: 1 }),
    impact('Air buffets', ['wind_lines.01.01.white'], { after: 'g', anchor: 'start', offset: 700, duration: 1400, scale: 1 }),
    motion('recoil', 'targets', { after: 'g', anchor: 'start', offset: 700, duration: 650 }),
    motion('levitate', 'source', { after: 'g', anchor: 'start', offset: 300, duration: 1600, intensity: 0.6 }),
  ]),
  // 277 Prophet's Luck
  'pf2e:n2CM3NeRuq5RSY19': design('A prophecy rune flashes as fate\'s die is cast.', () => [
    cast('Prophecy', ['icon.runes02.orange'], { stageId: 'r', duration: 1600, scale: 0.5 }),
    impact('Fate rolls', ['icosahedron.roll.blue'], { after: 'r', anchor: 'start', offset: 500, duration: 2000, scale: 0.5 }),
  ]),
  // 278 Propulsive Breeze
  'pf2e:jlOAXuIOM3YxZKmn': design('A current of wind at the ally\'s back carries it an extra stretch.', () => [
    impact('Propelling current', ['wind_lines.01.01.white'], { stageId: 'w', duration: 1800, scale: 1 }),
    impact('Feathers on the wind', ['swirling_feathers.outburst.01.textured'], { after: 'w', anchor: 'start', offset: 300, duration: 1400, scale: 0.6 }),
    motion('rush', 'targets', { after: 'w', anchor: 'start', offset: 300, duration: 1800, distance: 1.5, motionRange: 'distance', motionHeading: 'away', intensity: 0.3, targetSelection: 'first' }),
  ]),
  // 280 Protection
  'pf2e:gMODOGamz88rgHuf': design('An abjuration ward closes around the creature.', () => [
    cast('Ward gathers', ['magic_signs.circle.01.abjuration'], { stageId: 'c', duration: 800, scale: 0.7 }),
    impact('Protection closes', ['antilife_shell.blue_no_circle'], { stageId: 'p', after: 'c', duration: 2200, scale: 0.9 }),
    motion('brace', 'targets', { after: 'p', anchor: 'start', offset: 300, duration: 700, intensity: 0.5 }),
  ], { sound: 'shield' }),
  // 281 Protective Wards
  'pf2e:lY9fOk1qBDDhBT8s': design('A ring of glyphs expands from the wizard and shields allies.', () => [
    area('Glyph ring', ['magic_signs.circle.02.abjuration.complete.blue'], { stageId: 'r', duration: 3000 }),
    area('Wards spin', ['ward.rune.yellow.01'], { after: 'r', anchor: 'start', offset: 500, duration: 2600, opacity: 0.6, ...spin(6000) }),
  ], { sound: 'shield' }),
  // 282 Protector Tree
  'pf2e:K9gI08enGtmih5X1': design('A Medium tree bursts up from the ground and spreads protective branches.', () => [
    impact('Tree sprouts', ['plant_growth.03.round.2x2.complete.greenyellow'], { stageId: 'g', duration: 3000, scale: 1, below: true }),
    impact('Branches spread', ['vine.complete.nature.group.01.green'], { after: 'g', anchor: 'start', offset: 500, duration: 2800, scale: 1 }),
    impact('Leaves rustle', ['swirling_leaves.complete.01.green'], { after: 'g', anchor: 'start', offset: 1000, duration: 2000, scale: 0.8 }),
  ], { sound: 'growth' }),
  // 283 Protector's Sacrifice
  'pf2e:rQYob0QMJ0I1U2sU': design('A tether pulls part of the ally\'s harm onto the cleric, who flinches.', () => [
    impact('Ally burden', ['icon.heart.pink'], { stageId: 'h', duration: 1200, scale: 0.4 }),
    travel('Burden flows back', ['energy_strands.range.standard.purple.01'], { stageId: 't', after: 'h', anchor: 'start', offset: 300, duration: 1300, scale: 0.5, ...tint('#e06b8a') }),
    motion('brace', 'targets', { after: 't', anchor: 'start', duration: 700, intensity: 0.4 }),
    motion('recoil', 'source', { after: 't', anchor: 'start', offset: 800, duration: 650 }),
  ], { sound: 'shield' }),
  // 284 Protector's Sphere
  'pf2e:DH9Y3RQGWO0GzXGU': design('A protective sphere expands around the cleric and allies.', () => [
    area('Protective sphere', ['bubble.001.001.complete.blue'], { stageId: 'b', duration: 3400, opacity: 0.8 }),
    area('Shield glow', ['magic_signs.circle.02.abjuration.complete.blue'], { after: 'b', anchor: 'start', offset: 400, duration: 2600, scale: 0.6 }),
  ], { sound: 'shield' }),
  // 287 Psychic Outburst
  'pf2e:Y1glh4WNHAlpTwH3': design('Psychic energy explodes outward through the emanation, hurling creatures back.', () => [
    cast('Energy filters', PURPLE_CAST, { stageId: 'c', duration: 700, scale: 0.8 }),
    area('Psychic outburst', ['explosion.purplepink', 'explosion.02.blue'], { stageId: 'b', after: 'c', duration: 1600 }),
    area('Mental shockwave', ['soundwave.01.purple', 'soundwave.01.blue'], { after: 'b', anchor: 'start', offset: 200, duration: 1400, opacity: 0.7 }),
    motion('rush', 'targets', { after: 'b', anchor: 'start', offset: 300, duration: 1300, distance: 1.5, motionRange: 'distance', motionHeading: 'away', intensity: 0.5 }),
  ]),
  // 288 Puff of Poison
  'pf2e:D7ZEhTNIDWDLC2J4': design('The caster exhales a shimmering puff of toxic breath into the enemy\'s face.', () => [
    cast('Toxic breath', ['breath_weapons.poison.cone.green'], { stageId: 'b', duration: 1200, scale: 0.4 }),
    impact('Poison cloud', ['fumes.toxic.green', 'fumes.04.complete.grey'], { after: 'b', anchor: 'start', offset: 500, duration: 2200, scale: 0.8 }),
    motion('stagger', 'targets', { after: 'b', anchor: 'start', offset: 700, duration: 800, intensity: 0.5 }),
  ]),
  // 289 Pulse of Civilization
  'pf2e:ivKnEtI1z4UqEKIA': design('The caster taps the pulse of nearby settlements in a widening scrying ring.', () => [
    cast('Settlement pulse', ['extras.tmfx.radar.circle.pulse.01.normal', 'detect_magic.circle.blue'], { stageId: 'p', duration: 3000, scale: 1.5 }),
    cast('Names known', ['icon.runes02.orange'], { after: 'p', anchor: 'start', offset: 700, duration: 1800, scale: 0.6 }),
  ]),
  // 290 Pulverizing Cascade
  'pf2e:E80SrXuBdZViPGiH': design('Two towering waves slam together in the burst and crush those between them.', () => [
    area('Wave from the left', ['liquid.splash_side.blue'], { stageId: 'l', duration: 1300, offsetX: -0.6, offsetUnits: 'token' }),
    area('Wave from the right', ['liquid.splash_side.blue'], { duration: 1300, offsetX: 0.6, offsetUnits: 'token', mirrorX: true }),
    area('Waves collide', ['water_splash.circle.01.blue'], { after: 'l', anchor: 'start', offset: 700, duration: 1800 }),
    motion('stagger', 'targets', { after: 'l', anchor: 'start', offset: 800, duration: 800 }),
  ]),
  // 292 Pummeling Rubble
  'pf2e:Rn2LkoSq1XhLsODV': design('A spray of heavy rocks flies through the cone and knocks creatures back.', () => [
    cast('Rubble gathers', ['impact.earth.01.browngreen', 'ground_cracks.orange.01'], { stageId: 'c', duration: 600, scale: 0.6 }),
    projectile('Rocks fly', ['boulder.toss.02.01.stone.brown'], { stageId: 'r', after: 'c', duration: 900, scale: 0.4 }),
    area('Rubble spray', ['falling_rocks.side.2x1.grey'], { after: 'c', anchor: 'start', offset: 300, duration: 1400 }),
    motion('rush', 'targets', { after: 'r', anchor: 'start', offset: 800, duration: 900, distance: 0.6, motionRange: 'distance', motionHeading: 'away', intensity: 0.6 }),
  ]),
  // 295 Purging Toxins
  'pf2e:CBPcGH1FFDG9vf4Z': design('A measured dose of poison flushes the affliction out of the target.', () => [
    impact('Poison dose', ['liquid.splash02.green', 'liquid.splash.blue'], { stageId: 'p', duration: 1300, scale: 0.4 }),
    impact('Toxins drawn out', ['particles.outward.greenyellow.01.01'], { after: 'p', anchor: 'start', offset: 500, duration: 1800, scale: 0.8 }),
    impact('Cleansed', ['healing_generic.200px.green', 'healing_generic.200px.blue'], { after: 'p', anchor: 'start', offset: 1200, duration: 1500, scale: 0.7 }),
  ]),
  // 296 Purify Soul Path
  'pf2e:66xBcxqzYcpbItBU': design('Inward contemplation ends in a purifying glow of holy light.', () => [
    cast('Contemplation', ['magic_signs.circle.02.divination.complete.blue'], { stageId: 'c', duration: 2400, scale: 0.8 }),
    cast('Soul reconciled', ['sacred_flame.source.white', 'sacred_flame.source.yellow'], { after: 'c', anchor: 'start', offset: 900, duration: 1800, scale: 0.8 }),
  ]),
  // 297 Purify Tanglebriar
  'pf2e:ZVdKM0HkgpWykrqf': design('Ancient forest power surges through the blighted ground, cleansing it.', () => [
    cast('Forest spirits', ['plant_growth.03.round.4x4.complete.greenyellow'], { stageId: 'g', duration: 3200, scale: 1.1, below: true }),
    cast('Leaves rise', ['swirling_leaves.complete.01.green'], { after: 'g', anchor: 'start', offset: 500, duration: 2600, scale: 1.2 }),
    cast('Blight cleansed', ['ward.star.yellow.01'], { after: 'g', anchor: 'start', offset: 1100, duration: 2400, scale: 0.8 }),
  ]),
  // 298 Purifying Icicle
  'pf2e:9Ga1AOQdHKYXUY4O': design('An icicle of frozen life essence flies at the foe and shatters with a vital glow.', () => [
    cast('Icicle forms', ['glint.blue.few', 'glint.yellow.few'], { stageId: 'c', duration: 600, scale: 0.7 }),
    travel('Icicle flies', ['spell_projectile.ice_shard.blue'], { stageId: 'i', after: 'c', duration: 1200, scale: 0.65 }),
    impact('Icicle shatters', ['impact_themed.ice_shard.blue'], { after: 'i', anchor: 'start', offset: 800, duration: 1200, scale: 0.8 }),
    impact('Vital glow', ['sacred_flame.target.white', 'sacred_flame.target.yellow'], { after: 'i', anchor: 'start', offset: 900, duration: 1300, scale: 0.5 }),
    motion('recoil', 'targets', { after: 'i', anchor: 'start', offset: 850, duration: 650 }),
  ]),
  // 299 Purifying Veil
  'pf2e:3ySPK8qwNcuESwa0': design('A veil of holy water droplets surrounds the target.', () => [
    impact('Water droplets', ['water_splash.circle.01.blue'], { stageId: 'w', duration: 1800, scale: 1.1 }),
    impact('Holy veil', ['bubble.001.002.complete.blue', 'bubble.001.001.complete.blue'], { after: 'w', anchor: 'start', offset: 400, duration: 2800, scale: 1, opacity: 0.7, ...tint('#e8f4ff') }),
    impact('Holy glints', ['glint.yellow.few'], { after: 'w', anchor: 'start', offset: 900, duration: 1600, scale: 0.7 }),
  ]),
  // 300 Purple Worm Sting
  'pf2e:ayRXv0wQH00TTNZe': design('A spectral stinger stabs the touched creature and pumps purple-worm venom into it.', () => [
    impact('Stinger strikes', ['melee_generic.piercing.one_handed', 'spear.melee.01.white'], { stageId: 's', duration: 900, scale: 0.8, ...tint('#7a3fa0') }),
    impact('Venom pumps', ['liquid.splash02.purple', 'liquid.splash.blue'], { after: 's', anchor: 'start', offset: 400, duration: 1300, scale: 0.6 }),
    impact('Venom spreads', ['fumes.toxic.green', 'fumes.04.complete.grey'], { after: 's', anchor: 'start', offset: 800, duration: 1800, scale: 0.6 }),
    motion('recoil', 'targets', { after: 's', anchor: 'start', offset: 300, duration: 650 }),
  ]),
  // 301 Pushing Gust
  'pf2e:myC2EIrsjmB8xosi': design('A powerful gust buffets the target and shoves it away.', () => [
    travel('Directed gust', ['gust_of_wind.veryfast'], { stageId: 'g', duration: 1300, scale: 0.8 }),
    impact('Wind buffets', ['wind_lines.01.01.white'], { after: 'g', anchor: 'start', offset: 600, duration: 1400, scale: 1 }),
    motion('rush', 'targets', { after: 'g', anchor: 'start', offset: 600, duration: 1100, distance: 1.5, motionRange: 'distance', motionHeading: 'away', intensity: 0.6 }),
  ]),
  // 302 Putrefy Food and Drink
  'pf2e:CxpFy4HJHf4ACbxF': design('The food rots and liquids turn brackish in a puff of foul vapor.', () => [
    impact('Food spoils', ['liquid.blob.green', 'liquid.blob.blue'], { stageId: 'f', duration: 1800, scale: 0.6, ...tint('#81775c') }),
    impact('Foul vapor', ['fumes.04.complete.green', 'fumes.04.complete.grey'], { after: 'f', anchor: 'start', offset: 600, duration: 2000, scale: 0.6, ...tint('#7a7350') }),
  ]),
  // 303 Pyrefowl Rebuke
  'pf2e:xnh2NBOGs4hcH9B3': design('Fiery wings beat once, searing the attacker, and the caster flutters away in sparks.', () => [
    cast('Fiery wings', ['swirling_feathers.outburst.01.orange', 'swirling_feathers.outburst.01.textured'], { stageId: 'w', duration: 1000, scale: 0.9, ...tint('#ff8a3d') }),
    impact('Searing sparks', ['flames.01.orange'], { after: 'w', anchor: 'start', offset: 300, duration: 1600, scale: 0.6 }),
    motion('recoil', 'targets', { after: 'w', anchor: 'start', offset: 350, duration: 650 }),
    motion('leap', 'source', { after: 'w', anchor: 'start', offset: 400, duration: 2000, distance: 1, motionRange: 'distance', motionHeading: 'away', motionEndpoint: 'near', intensity: 0.6 }),
  ], { sound: 'fire' }),
  // 304 Pyroclastic Truth
  'pf2e:IeVP2xkNJf5kVAig': design('A blast of liquid fire floods the vast burst and brands everything it touches.', () => [
    cast('Truth spoken', ['cast_generic.fire.01.orange'], { stageId: 'c', duration: 900, scale: 0.9 }),
    area('Liquid fire', ['liquid.splash_side02.red'], { stageId: 'l', after: 'c', duration: 1800, ...tint('#e67b21') }),
    area('Flames', ['flames.04.complete.orange'], { after: 'l', anchor: 'start', offset: 300, duration: 3000 }),
    impact('Soul brand', ['ward.rune.yellow.01'], { after: 'l', anchor: 'start', offset: 800, duration: 2000, scale: 0.5, ...tint('#ff7a2a') }),
    motion('stagger', 'targets', { after: 'l', anchor: 'start', offset: 400, duration: 800 }),
  ]),
  // 305 Pyrotechnics
  'pf2e:TUbXnR4RAuYzRx1u': design('The fire source bursts into a colorful spray of fireworks.', () => [
    impact('Fire drawn in', ['particles.inward.greenyellow.01.01'], { stageId: 'i', duration: 1000, scale: 0.6, ...tint('#ff9a3d') }),
    impact('Fireworks', ['firework.02.orangeyellow.01'], { after: 'i', anchor: 'start', offset: 700, duration: 2200, scale: 1 }),
    impact('Smoke', ['smoke.puff.centered.grey'], { after: 'i', anchor: 'start', offset: 1200, duration: 1600, scale: 0.8 }),
  ], { sound: 'explosion' }),
  // 306 Qi Blast
  'pf2e:oo7YcRC2gcez81PV': design('The monk thrusts out its palms and a cone of force qi blasts creatures back.', () => [
    cast('Qi concentrates', ['energy_strands.complete.blue.01'], { stageId: 'c', duration: 800, scale: 0.7 }),
    motion('lunge', 'source', { after: 'c', anchor: 'start', offset: 500, duration: 600 }),
    area('Qi blast', ['detect_magic.cone.blue'], { stageId: 'b', after: 'c', anchor: 'start', offset: 600, duration: 1400 }),
    area('Force wave', ['template_cone_PF2e.001.001.purplered'], { after: 'b', anchor: 'start', duration: 1200, opacity: 0.6, ...tint('#7fb6ff') }),
    motion('rush', 'targets', { after: 'b', anchor: 'start', offset: 300, duration: 1000, distance: 1, motionRange: 'distance', motionHeading: 'away', intensity: 0.6 }),
  ]),
  // 310 Quantic Dampening
  'pf2e:HGRutSvLpkgCAgvx': design('A calming field of elemental control fills the emanation.', () => [
    area('Elemental control', ['energy_field.01.blue'], { stageId: 'f', duration: 3000, opacity: 0.7 }),
    area('Dampening runes', ['magic_signs.circle.02.abjuration.complete.blue'], { after: 'f', anchor: 'start', offset: 400, duration: 2400, scale: 0.5 }),
  ], { sound: 'shield' }),
  // 311 Quench
  'pf2e:02J0rDTk37KN2sjt': design('The air in the burst fills with dense vapor that hisses over flames.', () => [
    area('Water vapor', ['fumes.steam.white'], { stageId: 'v', duration: 3200, opacity: 0.8 }),
    area('Vapor quenches', ['water_splash.circle.01.blue'], { after: 'v', anchor: 'start', offset: 500, duration: 2000 }),
  ], { sound: 'water' }),
  // 315 Radiant Field
  'pf2e:v3vFzGazNSFEDdRB': design('Bright light floods the burst.', () => [
    area('Light floods', ['moonbeam.01.complete.yellow', 'moonbeam.01.complete.blue'], { stageId: 'l', duration: 3600, ...tint('#fff3b0') }),
    area('Radiance', ['bless.400px.intro.yellow'], { after: 'l', anchor: 'start', offset: 300, duration: 2400, opacity: 0.6 }),
  ]),
  // 317 Radiant Heart of Devotion
  'pf2e:yfCykJ6cs0uUL79b': design('The caster\'s heart glows and floods the emanation with holy radiance.', () => [
    cast('Heart glows', ['sacred_flame.source.yellow'], { stageId: 'h', duration: 1400, scale: 0.6 }),
    area('Radiance fills', ['bless.400px.intro.yellow'], { stageId: 'r', after: 'h', anchor: 'start', offset: 500, duration: 3000 }),
    area('Holy light', ['moonbeam.01.complete.yellow', 'moonbeam.01.complete.blue'], { after: 'r', anchor: 'start', offset: 300, duration: 2600, opacity: 0.6, ...tint('#fff3b0') }),
  ]),
  // 318 Raga of Remembrance
  'pf2e:nuE9qsY2HfPFEgAo': design('Incense and a droning raga call up the spirits of fallen defenders.', () => [
    cast('Incense', ['fumes.steam.white'], { stageId: 'i', duration: 2400, scale: 0.6 }),
    cast('Ritual drone', ['music_notations.treble_clef.blue'], { after: 'i', anchor: 'start', offset: 300, duration: 2000, scale: 0.6 }),
    cast('Fallen defenders', ['spirit_guardians.blueyellow.spirits', 'spirit_guardians.blueyellow.ring'], { after: 'i', anchor: 'start', offset: 1000, duration: 2800, scale: 1 }),
  ]),
  // 319 Rainbow Fumarole
  'pf2e:0AZOIMRvZtePuGOw': design('Multi-hued flames break through the ground and soar up with dangerous fumes.', () => [
    area('Ground breaks', ['impact.ground_crack.01.orange', 'impact.ground_crack.orange.01'], { stageId: 'g', duration: 1600, below: true }),
    area('Rainbow fire spout', ['lava_spout.001.001.complete.orangeyellow'], { stageId: 'l', after: 'g', anchor: 'start', offset: 300, duration: 3200 }),
    area('Prismatic sparks', ['firework.01.yellow.02'], { after: 'l', anchor: 'start', offset: 400, duration: 2400 }),
    area('Fumes', ['fumes.04.complete.purple', 'fumes.04.complete.grey'], { after: 'l', anchor: 'start', offset: 900, duration: 2600, opacity: 0.6 }),
    motion('stagger', 'targets', { after: 'l', anchor: 'start', offset: 400, duration: 800 }),
  ]),
  // 322 Raise Runelord
  'pf2e:fr1AGcQo7WuvLvUi': design('Dreamlands energies coalesce into a physical illusion of a runelord.', () => [
    cast('Remnant focus', ['icon.runes.orange'], { stageId: 'r', duration: 1600, scale: 0.6 }),
    cast('Dreamlands', ['sleep.cloud.01.dark_purple', 'sleep.cloud.01.pink'], { after: 'r', anchor: 'start', offset: 500, duration: 2600, scale: 1 }),
    cast('Runelord forms', ['shimmer.01.blue'], { after: 'r', anchor: 'start', offset: 1200, duration: 2400, scale: 1.2 }),
  ]),
  // 323 Rally Point
  'pf2e:98gJvb8Xtn8OLIY7': design('A teleportation mark is etched into the touched square.', () => [
    area('Rally mark', ['magic_signs.circle.02.conjuration.complete.blue', 'magic_signs.circle.02.conjuration.complete.yellow'], { stageId: 'm', duration: 2600 }),
    area('Return glyph', ['ward.rune.yellow.01'], { after: 'm', anchor: 'start', offset: 600, duration: 2200, scale: 0.6 }),
  ]),
  // 325 Rallying Banner
  'pf2e:Hp2wmnRS6TUGZlZ2': design('A huge illusory banner unfurls above the target amid fireworks and cheers.', () => [
    impact('Banner', ['icon.runes03.orange'], { stageId: 'b', duration: 2600, scale: 0.9, offsetY: -0.7, offsetUnits: 'token' }),
    impact('Fireworks', ['firework.01.orangeyellow.01'], { after: 'b', anchor: 'start', offset: 400, duration: 2200, scale: 1.2 }),
    impact('Cheering', ['soundwave.02.blue'], { after: 'b', anchor: 'start', offset: 700, duration: 1800, scale: 1 }),
  ], { sound: 'applause' }),
  // 326 Ranage's Circle
  'pf2e:Pmhlv3fzPTuIhTrT': design('Stone stirs and ancient roots and trees ring the ritual clearing.', () => [
    cast('Stone stirs', ['impact.earth.01.browngreen', 'ground_cracks.orange.01'], { stageId: 's', duration: 1600, scale: 1 }),
    cast('Tree ring grows', ['plant_growth.03.ring.4x4.complete.greenyellow'], { after: 's', anchor: 'start', offset: 500, duration: 3200, scale: 1.4, below: true }),
    cast('Leaves rise', ['swirling_leaves.complete.01.green'], { after: 's', anchor: 'start', offset: 1100, duration: 2200, scale: 1 }),
  ]),
  // 327 Ranger's Bramble
  'pf2e:KktHf7zIAWOr499h': design('Thorny brambles erupt across the burst and entangle foes.', () => [
    area('Brambles erupt', ['entangle.02.complete.02.green'], { stageId: 'b', duration: 3400 }),
    area('Thorny vines', ['vine.complete.nature.group.01.green'], { after: 'b', anchor: 'start', offset: 300, duration: 2800, opacity: 0.85 }),
    motion('press', 'targets', { after: 'b', anchor: 'start', offset: 600, duration: 1000, intensity: 0.6 }),
  ]),
  // 331 Ravening Maw
  'pf2e:VDWIZuLOJqwBthHc': design('Zevgavizeb\'s gnashing hunger sinks into the target.', () => [
    cast('Hunger evoked', ['smoke.plumes.01.purple', 'smoke.plumes.01.grey'], { stageId: 'c', duration: 700, scale: 0.6, ...tint('#7a1f2a') }),
    impact('Ravening maw', ['bite.200px.red'], { stageId: 'b', after: 'c', duration: 1300, scale: 0.9 }),
    impact('Hunger takes hold', ['energy_strands.complete.dark_red.01', 'energy_strands.complete.blue.01'], { after: 'b', anchor: 'start', offset: 400, duration: 1800, scale: 0.8, ...tint('#a3242f') }),
    motion('pulse', 'targets', { after: 'b', anchor: 'start', offset: 500, duration: 900, intensity: 0.6 }),
  ], { sound: 'drain' }),
  // 332 Ravenous Darkness
  'pf2e:g1dDUKsIrdlpdqy9': design('A globe of darkness swallows the burst and shadowy teeth gnaw at those inside.', () => [
    cast('Darkness gathers', ['smoke.puff.centered.dark_purple', 'smoke.puff.centered.grey'], { stageId: 'c', duration: 700, scale: 0.9 }),
    area('Dark globe', ['darkness.black'], { stageId: 'd', after: 'c', duration: 3200 }),
    impact('Shadow teeth', ['bite.200px.purple', 'bite.200px.red'], { after: 'd', anchor: 'start', offset: 500, duration: 1400, scale: 0.7 }),
    motion('shake', 'targets', { after: 'd', anchor: 'start', offset: 600, duration: 800, intensity: 0.5 }),
  ]),
  // 333 Ravenous Portal
  'pf2e:ER1LOEgCLtmEKd05' : design('A ward settles over the door, waiting to transform it into a mimic.', () => [
    impact('Door ward', ['ward.rune.yellow.01'], { stageId: 'w', duration: 2400, scale: 0.8 }),
    impact('Hungry trigger', ['bite.200px.purple', 'bite.200px.red'], { after: 'w', anchor: 'start', offset: 800, duration: 1300, scale: 0.6 }),
  ]),
  // 334 Ravenous Reanimation
  'pf2e:u3pdkfmy0AWICdoM': design('Treasures char and melt, then void energy floods the caster.', () => [
    cast('Treasures charred', ['flames.01.orange'], { stageId: 'f', duration: 2000, scale: 0.8 }),
    cast('Melted offering', ['aura_themed.01.inward.complete.metal.01.grey'], { after: 'f', anchor: 'start', offset: 400, duration: 2200, scale: 0.9, ...tint('#e0b060') }),
    cast('Necromancy', ['toll_the_dead.purple.skull_smoke', 'toll_the_dead.green.skull_smoke'], { after: 'f', anchor: 'start', offset: 1200, duration: 2200, scale: 0.8 }),
  ]),
  // 335 Ray of Corruption
  'pf2e:nPxYYID5JARKouSV': design('A sickly grey beam of toxic spores strikes the target and rots it.', () => [
    cast('Spores gather', ['fumes.04.complete.grey'], { stageId: 'c', duration: 700, scale: 0.6 }),
    travel('Spore ray', ['energy_beam.normal.dark_green.01', 'energy_beam.normal.blue.01'], { stageId: 'r', after: 'c', duration: 1500, scale: 0.8, ...tint('#8d9478') }),
    impact('Spore burst', ['fumes.04.complete.green', 'fumes.04.complete.grey'], { after: 'r', anchor: 'start', offset: 700, duration: 2000, scale: 0.9, ...tint('#8d9478') }),
    motion('recoil', 'targets', { after: 'r', anchor: 'start', offset: 700, duration: 650 }),
  ]),
  // 342 Reaper's Lantern
  'pf2e:dxOF7d5kAWusLKWF': design('A ghostly lantern on a skeletal hand floats beside the caster and casts deathly light.', () => [
    cast('Ghostly lantern', ['dancing_light.blueteal'], { stageId: 'l', duration: 3200, scale: 0.5, offsetX: 0.5, offsetY: -0.4, offsetUnits: 'token' }),
    cast('Skeletal hand', ['arcane_hand.blue'], { after: 'l', anchor: 'start', offset: 300, duration: 2600, scale: 0.4, offsetX: 0.5, offsetY: -0.1, offsetUnits: 'token', ...tint('#cfe6e0') }),
    area('Lantern light', ['template_circle.aura.01.complete.small.bluepurple', 'antilife_shell.blue_no_circle'], { after: 'l', anchor: 'start', offset: 500, duration: 3000, opacity: 0.7 }),
  ]),
  // 343 Reblooded
  'pf2e:Stjb9wvLn146TfW6': design('The undead heart lurches back to life and acidic blood surges through it.', () => [
    impact('Heart restarts', ['icon.heart.pink'], { stageId: 'h', duration: 1400, scale: 0.4, ...tint('#b0202a') }),
    impact('Blood courses', ['liquid.splash02.red'], { after: 'h', anchor: 'start', offset: 400, duration: 1500, scale: 0.8 }),
    motion('stagger', 'targets', { after: 'h', anchor: 'start', offset: 500, duration: 900 }),
  ]),
  // 346 Recall Legacy
  'pf2e:onvFdBWAsQp0CsAy': design('A mental link brings an ancestral legacy to the target\'s mind.', () => [
    travel('Legacy link', STRANDS, { stageId: 't', duration: 1500, scale: 0.45 }),
    impact('Legacy recalled', ['icon.runes02.orange'], { after: 't', anchor: 'start', offset: 700, duration: 2000, scale: 0.6 }),
  ]),
  // 347 Recall Past Life
  'pf2e:bqx1tJeOZq1Ufhcc': design('Sigils glow, the herbed wine is drunk and a past life\'s spirit stirs.', () => [
    cast('Body sigils', ['icon.runes03.orange'], { stageId: 's', duration: 1800, scale: 0.8 }),
    cast('Herbed wine', ['liquid.splash02.red'], { after: 's', anchor: 'start', offset: 500, duration: 1400, scale: 0.4 }),
    cast('Past life stirs', ['spirit_guardians.blueyellow.spirits', 'spirit_guardians.blueyellow.ring'], { after: 's', anchor: 'start', offset: 1100, duration: 2600, scale: 0.8 }),
  ]),
  // 350 Redact
  'pf2e:ifXNOhtmU4fKL68v': design('Named text blurs and smudges into illegibility.', () => [
    impact('Name identified', ['icon.runes02.orange'], { stageId: 'r', duration: 1400, scale: 0.6 }),
    impact('Name blurred', ['smoke.puff.centered.grey'], { after: 'r', anchor: 'start', offset: 500, duration: 1600, scale: 0.7 }),
  ]),
  // 353 Reflected Beauty
  'pf2e:ghIoycTH6gxxAw3w': design('An illusion reflects the chosen creature\'s appearance onto the caster.', () => [
    travel('Reflection drawn', STRANDS, { stageId: 't', duration: 1300, scale: 0.4, mirrorX: true, ...tint('#ff9ad5') }),
    cast('Disguise shimmers', ['shimmer.01.blue'], { after: 't', anchor: 'start', offset: 600, duration: 2200, scale: 1 }),
  ]),
  // 355 Regale the Lost Ones
  'pf2e:FQZaQXiKtHdVjSc5': design('An opera performance rings out and lost spirits gather to listen.', () => [
    cast('Opera performed', ['music_notations.treble_clef.blue'], { stageId: 'o', duration: 2000, scale: 0.8 }),
    cast('Music carries', ['soundwave.02.blue'], { after: 'o', anchor: 'start', offset: 400, duration: 2000, scale: 1.2 }),
    cast('Spirit audience', ['spirit_guardians.blueyellow.spirits', 'spirit_guardians.blueyellow.ring'], { after: 'o', anchor: 'start', offset: 1000, duration: 2800, scale: 1.1 }),
  ]),
  // 357 Reincarnate
  'pf2e:gIVaSCrLhhBzGHQY': design('The departed soul is called back and drawn into a new body in a burst of life.', () => [
    cast('Soul called', ['spirit_guardians.blueyellow.spirits', 'spirit_guardians.blueyellow.ring'], { stageId: 's', duration: 2600, scale: 1 }),
    cast('New body forms', GREEN_HEAL, { after: 's', anchor: 'start', offset: 1000, duration: 2200, scale: 1.2 }),
  ], { sound: 'revive' }),
  // 359 Reinforced Rations
  'pf2e:2LsiiZZIZEKD23VQ': design('A preserving ward settles over the stores of food and water.', () => [
    cast('Food and drink', ['liquid.splash.blue'], { stageId: 'f', duration: 1600, scale: 0.8 }),
    cast('Preservation', ['shield.01.complete.01.blue'], { after: 'f', anchor: 'start', offset: 500, duration: 3000, scale: 1 }),
  ]),
  // 364 Remember the Lost
  'pf2e:nrW6lGV4xDMqLS3P': design('Spirits of the wronged dead rise through the emanation and haunt the enemies\' minds.', () => [
    cast('Victims named', ['soundwave.02.purple', 'soundwave.02.blue'], { stageId: 'n', duration: 1400, scale: 1 }),
    area('Lost spirits', ['spirit_guardians.dark_purple.spirits', 'spirit_guardians.blueyellow.ring'], { stageId: 's', after: 'n', anchor: 'start', offset: 400, duration: 3000, opacity: 0.85 }),
    impact('Grievance', ['icon.skull.purple'], { after: 's', anchor: 'start', offset: 600, duration: 1600, scale: 0.35 }),
    motion('cower', 'targets', { after: 's', anchor: 'start', offset: 700, duration: 1000, intensity: 0.5 }),
  ]),
  // 365 Rend Magic
  'pf2e:Y89dDWlECxG2vIeH': design('Raw magic surges down the caster\'s arm and tears into the target.', () => [
    cast('Arm charges', ['energy_strands.complete.blue.01'], { stageId: 'c', duration: 900, scale: 0.7 }),
    motion('lunge', 'source', { stageId: 'l', after: 'c', anchor: 'start', offset: 500, duration: 650 }),
    impact('Rending force', ['arcane_hand.blue'], { stageId: 'h', after: 'l', anchor: 'start', offset: 250, duration: 1300, scale: 0.8 }),
    impact('Magic torn', ['icon.shield_cracked.purple'], { after: 'h', anchor: 'start', offset: 500, duration: 1500, scale: 0.4 }),
    motion('recoil', 'targets', { after: 'h', anchor: 'start', offset: 200, duration: 650 }),
  ]),
  // 367 Repelling Pulse
  'pf2e:TLqMFgCewxuricJw': design('A violent telekinetic pulse bursts from the caster and hurls creatures away.', () => [
    area('Telekinetic pulse', ['energy_field.02.above.purple', 'energy_field.02.above.blue'], { stageId: 'p', duration: 1800 }),
    area('Shockwave', ['soundwave.01.purple', 'soundwave.01.blue'], { after: 'p', anchor: 'start', offset: 200, duration: 1300, opacity: 0.7 }),
    motion('rush', 'targets', { after: 'p', anchor: 'start', offset: 300, duration: 1300, distance: 2, motionRange: 'distance', motionHeading: 'away', intensity: 0.6 }),
  ]),
  // 371 Resolute Obliteration
  'pf2e:RGmPRCBFcWVUoiZz': design('Void energy ages the gathered objects to dust.', () => [
    cast('Void invoked', ['magic_signs.circle.02.necromancy.complete.dark_green'], { stageId: 'c', duration: 2200, scale: 1, below: true }),
    cast('Objects crumble', ['particles.outward.greenyellow.01.01'], { after: 'c', anchor: 'start', offset: 600, duration: 2000, scale: 0.9, ...tint('#8a7f72') }),
    cast('Dust', ['smoke.puff.centered.grey'], { after: 'c', anchor: 'start', offset: 1300, duration: 1600, scale: 0.8 }),
  ]),
  // 372 Resplendent Mansion
  'pf2e:KPDHmmjJiw7PhTYF': design('A conjured mansion shimmers into existence.', () => [
    cast('Mansion plan', ['magic_signs.circle.02.conjuration.complete.blue', 'magic_signs.circle.02.conjuration.complete.yellow'], { stageId: 'c', duration: 2400, scale: 1.2 }),
    cast('Mansion manifests', ['shimmer.01.blue'], { after: 'c', anchor: 'start', offset: 700, duration: 3000, scale: 2 }),
  ], { sound: 'summon' }),
  // 373 Rest Eternal
  'pf2e:MTNlvZ0A9xY5sOg1': design('Afterlife wards seal the departed spirit away.', () => [
    cast('Departed subject', ['icon.skull.purple'], { stageId: 's', duration: 1800, scale: 0.6 }),
    cast('Afterlife seal', ['ward.rune.yellow.01'], { after: 's', anchor: 'start', offset: 500, duration: 2600, scale: 1 }),
  ]),
  // 375 Restorative Moment
  'pf2e:pCvJ4yoZJxDtgUMI': design('Threads of time wind around the target, granting a day\'s recovery.', () => [
    impact('Time threads', ['energy_strands.complete.blue.01'], { stageId: 't', duration: 2200, scale: 0.9 }),
    impact('Day passes', ['icosahedron.rune.above.blueyellow'], { after: 't', anchor: 'start', offset: 400, duration: 2200, scale: 0.6 }),
    impact('Restored', GREEN_HEAL, { after: 't', anchor: 'start', offset: 1100, duration: 1600, scale: 0.8 }),
  ]),
  // 376 Restore Ground
  'pf2e:ljo9CEmnCMZXqfOQ': design('Civilized ground cracks apart as plants surge across the burst.', () => [
    area('Ground loosens', ['ground_cracks.01.green', 'ground_cracks.01.orange'], { stageId: 'g', duration: 2400, below: true }),
    area('Natural growth', ['plant_growth.03.round.4x4.complete.greenyellow'], { after: 'g', anchor: 'start', offset: 400, duration: 3400, below: true }),
    area('Leaves', ['swirling_leaves.complete.01.green'], { after: 'g', anchor: 'start', offset: 900, duration: 2400 }),
  ]),
  // 377 Restraining Chains
  'pf2e:WjgDgSDng1MS8g17': design('A steel chain bursts from the ground and wraps the target\'s limbs, dragging on it.', () => [
    impact('Steel chain', ['markers.chain.standard.complete.02.grey', 'markers.chain.standard.complete.02.red'], { stageId: 'c', duration: 2600, scale: 1.1, ...tint('#b8c0c8') }),
    impact('Ground anchor', ['impact.ground_crack.01.white', 'impact.ground_crack.orange.01'], { after: 'c', anchor: 'start', duration: 1500, scale: 0.6, below: true }),
    motion('press', 'targets', { after: 'c', anchor: 'start', offset: 400, duration: 1000, intensity: 0.6 }),
  ]),
  // 379 Resurrect
  'pf2e:kqhPt9344UkcGVYO': design('The soul is recalled into the body in a rush of life.', () => [
    cast('Soul recalled', ['spirit_guardians.blueyellow.no_ring', 'spirit_guardians.blueyellow.ring'], { stageId: 's', duration: 2600, scale: 1 }),
    cast('Life returns', GREEN_HEAL, { after: 's', anchor: 'start', offset: 1000, duration: 2200, scale: 1.3 }),
  ]),
  // 380 Retreat Among the Rains
  'pf2e:D4Rxud1DBr52Dmdo': design('The mind drifts into a rain-washed mindscape of insight.', () => [
    cast('Mindscape', ['template_square.raindrops.001.5x5.instant.combined.blue', 'sleet_storm.01.blue'], { stageId: 'r', duration: 3000, scale: 0.8 }),
    cast('Insight', ['ioun_stones.01.blue.insight'], { after: 'r', anchor: 'start', offset: 500, duration: 2600, scale: 0.8 }),
  ]),
  // 382 Retrieving Hook
  'pf2e:lqxh1qgJG5ujSHXI': design('A conjured hook and rope fly out, catch the target and haul it in.', () => [
    cast('Hook conjured', PURPLE_CAST, { stageId: 'c', duration: 500, scale: 0.6 }),
    travel('Rope flies', ['energy_strands.range.standard.purple.03'], { stageId: 'r', after: 'c', duration: 1400, scale: 0.55 }),
    impact('Hook catches', ['markers.chain.spectral_standard.complete.02.purple', 'markers.chain.spectral_standard.complete.02.blue'], { after: 'r', anchor: 'start', offset: 700, duration: 1600, scale: 0.7 }),
    motion('rush', 'targets', { after: 'r', anchor: 'start', offset: 900, duration: 2300, distance: 6, motionRange: 'target', motionHeading: 'toward', motionEndpoint: 'near', intensity: 0.45 }),
  ]),
  // 383 Retrocognition
  'pf2e:rsZ5c0AUyywe5yoK': design('Echoes of past events ripple around the caster.', () => [
    cast('Past impressions', ['magic_signs.circle.02.divination.complete.blue'], { stageId: 'c', duration: 2400, scale: 1 }),
    cast('Time echoes', ['icosahedron.rune.above.blueyellow'], { after: 'c', anchor: 'start', offset: 500, duration: 2200, scale: 0.6 }),
    sprite('Earlier self', { after: 'c', anchor: 'start', offset: 900, duration: 1500, opacity: 0.4 }),
  ]),
  // 385 Return the Favor
  'pf2e:9gMQPCaFM27PEIh4': design('The witch repays an ally with a glow of protective vitality.', () => [
    cast('Favor acknowledged', PURPLE_CAST, { stageId: 'c', duration: 600, scale: 0.7 }),
    impact('Ally heartened', ['icon.heart.pink'], { stageId: 'h', after: 'c', duration: 1600, scale: 0.4 }),
    impact('Temporary vitality', ['ward.star.yellow.01'], { after: 'h', anchor: 'start', offset: 400, duration: 1800, scale: 0.6 }),
  ]),
  // 386 Return To Essence
  'pf2e:v8VnSMzaSYwkq6c7': design('The ward on the door unravels and its energy streams back to the caster.', () => [
    impact('Ward unweaves', ['ward.rune.yellow.01'], { stageId: 'w', duration: 2000, scale: 0.8 }),
    travel('Energy drawn back', STRANDS, { stageId: 't', after: 'w', anchor: 'start', offset: 500, duration: 1400, scale: 0.6, mirrorX: true }),
    cast('Essence reclaimed', ['particles.inward.greenyellow.01.01'], { after: 't', anchor: 'start', offset: 800, duration: 1600, scale: 0.8, ...tint('#c9b6ff') }),
  ]),
  // 388 Revel in Retribution
  'pf2e:Eed8QBWBtpufl1iP': design('Time seems to slow around the caster as a spectral weapon readies to lash out.', () => [
    cast('Time slows', ['icosahedron.rune.above.blueyellow'], { stageId: 't', duration: 2000, scale: 0.8 }),
    aura('Ready weapon', ['spiritual_weapon.longsword.01.astral.01.purple', 'spiritual_weapon.longsword.01.spectral.02.green'], { after: 't', anchor: 'start', offset: 500, duration: 2400, scale: 0.6 }),
  ]),
  // 389 Reverse Gravity
  'pf2e:37ESlJzUvVbOudOT': design('Gravity flips inside the cylinder and creatures and loose debris fall upward.', () => [
    cast('Gravity reverses', PURPLE_CAST, { stageId: 'c', duration: 700, scale: 0.8 }),
    area('Reversed field', ['energy_field.02.above.purple', 'energy_field.02.above.blue'], { stageId: 'f', after: 'c', duration: 3000, opacity: 0.7 }),
    area('Debris rises', ['particles.outward.greenyellow.01.01'], { after: 'f', anchor: 'start', offset: 300, duration: 2600, ...tint('#b49ad8') }),
    motion('levitate', 'targets', { after: 'f', anchor: 'start', offset: 400, duration: 2200, intensity: 1 }),
  ], { sound: 'gravity' }),
  // 391 Rewinding Step
  'pf2e:5tpk4Q2QI3FVhm99': design('A temporal anchor is fixed in the caster\'s space.', () => [
    cast('Temporal anchor', ['icosahedron.rune.above.blueyellow'], { stageId: 't', duration: 2000, scale: 0.8 }),
    cast('Return mark', ['magic_signs.circle.02.conjuration.complete.blue', 'magic_signs.circle.02.conjuration.complete.yellow'], { after: 't', anchor: 'start', offset: 400, duration: 2200, scale: 0.8, below: true }),
  ]),
  // 392 Rewrite Memory
  'pf2e:FhOaQDTSnsY7tiam': design('Memory runes flicker over the target\'s mind as memories are edited.', () => [
    impact('Memory runes', ['icon.runes03.orange'], { stageId: 'r', duration: 2000, scale: 0.7 }),
    impact('Memory edits', ['shimmer.01.blue'], { after: 'r', anchor: 'start', offset: 400, duration: 2000, scale: 0.8 }),
  ], { sound: 'psychic' }),
  // 394 Rigid Form
  'pf2e:Ey4pKybxyPAxq0ew': design('Wood\'s rigidity hardens around the caster as a bark ward.', () => [
    cast('Wood rigidity', ['aura_themed.01.inward.complete.wood.01.green'], { stageId: 'w', duration: 2200, scale: 0.9 }),
    cast('Shape protection', ['shield.01.complete.01.blue'], { after: 'w', anchor: 'start', offset: 600, duration: 2200, scale: 0.9, ...tint('#8b6b43') }),
    motion('brace', 'source', { after: 'w', anchor: 'start', offset: 600, duration: 800 }),
  ]),
  // 396 Ring of Truth
  'pf2e:aewxsale5xWEPKLk': design('A boundary of truth wards the area and a soft bell chimes.', () => [
    area('Truth boundary', ['magic_signs.circle.02.divination.complete.blue'], { stageId: 'b', duration: 3000 }),
    area('Bell chimes', ['toll_the_dead.yellow.bell', 'toll_the_dead.green.bell'], { after: 'b', anchor: 'start', offset: 700, duration: 2000, scale: 0.4 }),
  ]),
  // 397 Rip the Spirit
  'pf2e:1bw6XJMOERcbC5Iq': design('Void energy tears the target\'s spirit partly out of its body.', () => [
    impact('Void grips', ['arms_of_hadar.dark_purple'], { stageId: 'v', duration: 1600, scale: 0.6 }),
    sprite('Spirit torn loose', { subject: 'targets', after: 'v', anchor: 'start', offset: 400, duration: 1400, opacity: 0.5, offsetY: -0.3, offsetUnits: 'token' }),
    impact('Spirit severed', ['spirit_guardians.dark_purple.no_ring', 'spirit_guardians.blueyellow.ring'], { after: 'v', anchor: 'start', offset: 500, duration: 2200, scale: 0.6 }),
    motion('stagger', 'targets', { after: 'v', anchor: 'start', offset: 500, duration: 900 }),
  ]),
  // 398 Rising Surf
  'pf2e:zTN6zuruDUKOea6h': design('A wave rises under the caster, who surfs forward on it.', () => [
    cast('Wave rises', ['liquid.splash.blue'], { stageId: 'w', duration: 1500, scale: 1 }),
    aura('Water beneath feet', ['water_splash.circle.01.blue'], { after: 'w', anchor: 'start', offset: 300, duration: 2600, scale: 1.1, below: true }),
    motion('levitate', 'source', { after: 'w', anchor: 'start', offset: 300, duration: 900, intensity: 0.4 }),
    motion('rush', 'source', { after: 'w', anchor: 'start', offset: 700, duration: 2400, distance: 3, motionRange: 'distance', motionHeading: 'toward', motionEndpoint: 'near', intensity: 0.3 }),
  ]),
  // 399 Rite of Cleansing Flame
  'pf2e:KwDyrUIlnOrpdxYi': design('Phoenix feathers and cleansing flame sweep out from the ritual.', () => [
    cast('Phoenix patron', ['swirling_feathers.outburst.01.orange', 'swirling_feathers.outburst.01.textured'], { stageId: 'p', duration: 2000, scale: 1, ...tint('#ff9a3d') }),
    cast('Cleansing flame', ['flames.04.complete.orange'], { after: 'p', anchor: 'start', offset: 400, duration: 3000, scale: 1 }),
  ], { sound: 'fireIgnition' }),
  // 400 Rite of Repatriation
  'pf2e:w00PBRjENqJa7Vxu': design('Local spirits gather and accept the returned object.', () => [
    cast('Local spirits', ['spirit_guardians.blueyellow.no_ring', 'spirit_guardians.blueyellow.ring'], { stageId: 's', duration: 2800, scale: 1 }),
    cast('Object repaired', ['swirling_sparkles.01.blue'], { after: 's', anchor: 'start', offset: 900, duration: 2000, scale: 0.6 }),
  ]),
  // 401 Rite of the Red Star
  'pf2e:fLiowSDQXo3vCQDh': design('Chanting opens a smoking crimson portal toward the Red Star.', () => [
    cast('Chanting', ['soundwave.02.red', 'soundwave.02.blue'], { stageId: 'c', duration: 1600, scale: 1 }),
    cast('Red Star portal', ['portals.vertical.ring.red', 'portals.horizontal.ring.bright_yellow'], { after: 'c', anchor: 'start', offset: 600, duration: 3000, scale: 1.2, ...tint('#e0503a') }),
  ]),
  // 402 Ritual Obstruction
  'pf2e:h7h0wMxu4WOpveQ3': design('A zone of crackling magical feedback settles over the area.', () => [
    area('Feedback zone', ['energy_strands.complete.blue.01'], { stageId: 'f', duration: 3000, opacity: 0.8 }),
    area('Obstruction seal', ['magic_signs.circle.02.abjuration.complete.dark_blue', 'magic_signs.circle.02.abjuration.complete.blue'], { after: 'f', anchor: 'start', offset: 500, duration: 2400, scale: 0.6, ...tint('#b04a4a') }),
  ]),
  // 406 Rolling Boulders
  'pf2e:RgVlYrn5mu8wNHK4': design('The earth heaves and boulders rise to roll alongside the caster.', () => [
    cast('Earth heaves', ['impact.ground_crack.01.orange', 'impact.ground_crack.orange.01'], { stageId: 'g', duration: 1800, scale: 1.4, below: true }),
    aura('Boulders roll', ['rolling_boulder.loop.01.rock.brown'], { after: 'g', anchor: 'start', offset: 500, duration: 3000, scale: 0.5, offsetX: 0.8, offsetUnits: 'token' }),
    aura('Boulders roll', ['rolling_boulder.loop.01.rock.brown'], { after: 'g', anchor: 'start', offset: 700, duration: 2800, scale: 0.5, offsetX: -0.8, offsetUnits: 'token', mirrorX: true }),
  ], { sound: 'earth' }),
  // 409 Rose's Thorns
  'pf2e:gBJtUhewnihlqxm7': design('Razor-thorned rose bushes burst up through the area and rake creatures.', () => [
    area('Rose bushes sprout', ['plant_growth.02.round.4x4.complete.greenred', 'plant_growth.03.round.4x4.complete.greenyellow'], { stageId: 'r', duration: 3200, below: true }),
    area('Thorned vines', ['vine.complete.nature.group.03.green'], { after: 'r', anchor: 'start', offset: 300, duration: 2800 }),
    impact('Thorns rake', ['liquid.splash02.red'], { after: 'r', anchor: 'start', offset: 700, duration: 1200, scale: 0.5 }),
    motion('shake', 'targets', { after: 'r', anchor: 'start', offset: 700, duration: 800, intensity: 0.5 }),
  ]),
  // 410 Rouse Skeletons
  'pf2e:0JWyMwVnLxX9CDYQ': design('Misshapen skeletal forms erupt from the floor and claw at creatures.', () => [
    area('Ground splits', ['impact.ground_crack.01.white', 'impact.ground_crack.orange.01'], { stageId: 'g', duration: 1800, below: true }),
    area('Skeletal limbs erupt', ['ice_spikes.radial.burst.white'], { after: 'g', anchor: 'start', offset: 300, duration: 2400, ...tint('#e8dfc8') }),
    impact('Grasping claws', ['claws.200px.red'], { after: 'g', anchor: 'start', offset: 700, duration: 1200, scale: 0.7, ...tint('#e8dfc8') }),
    motion('shake', 'targets', { after: 'g', anchor: 'start', offset: 700, duration: 800, intensity: 0.5 }),
  ]),
  // 411 Rousing Splash
  'pf2e:zhDIiQlJmrd4UDNC': design('A splash of cold water drops on the ally\'s head and it shakes off with fresh vigor.', () => [
    impact('Water splash', ['liquid.splash.blue'], { stageId: 's', duration: 1400, scale: 0.8, offsetY: -0.3, offsetUnits: 'token' }),
    impact('Vigor', ['healing_generic.200px.blue'], { after: 's', anchor: 'start', offset: 500, duration: 1500, scale: 0.6 }),
    motion('shake', 'targets', { after: 's', anchor: 'start', offset: 400, duration: 600, intensity: 0.3 }),
  ]),
  // 414 Rune Trap
  'pf2e:o0l57UfBm9ScEUMW': design('A hostile spell is bound into a glowing trap rune.', () => [
    cast('Trap rune', ['magic_signs.rune.evocation.complete.red'], { stageId: 'r', duration: 2400, scale: 0.8 }),
    cast('Bound spell', ['ward.rune.yellow.01'], { after: 'r', anchor: 'start', offset: 600, duration: 2200, scale: 0.6, ...tint('#e05a4a') }),
  ]),
  // 417 Runic Weapon
  'pf2e:TFitdEOpQC4SzKQQ': design('Temporary runes carve down the weapon\'s length.', () => [
    cast('Magic glimmers', ['glint.purple.few', 'glint.yellow.few'], { stageId: 'c', duration: 600, scale: 0.7 }),
    impact('Runes carve', ['magic_signs.rune.02.complete.01.purple', 'magic_signs.rune.transmutation.complete.yellow'], { after: 'c', duration: 2200, scale: 0.6 }),
  ]),
  // 418 Rust Cloud
  'pf2e:yy2K51kK3a60rRIe': design('A cloud of jittering red-brown rust flecks fills the burst and scours creatures.', () => [
    area('Rust cloud', ['fog_cloud.02.white', 'fog_cloud.01.white'], { stageId: 'c', duration: 3200, ...tint('#a44d32') }),
    area('Agitated flecks', ['particles.002.001.complete.many.blue'], { after: 'c', anchor: 'start', offset: 300, duration: 2800, ...tint('#a44d32') }),
    motion('shake', 'targets', { after: 'c', anchor: 'start', offset: 700, duration: 800, intensity: 0.4 }),
  ], { sound: 'wind' }),
  // 419 Rusting Grasp
  'pf2e:0fYE64odlKqISzft': design('Corrosive rust spreads over the metal target.', () => [
    impact('Rust spreads', ['aura_themed.01.inward.complete.metal.01.grey'], { stageId: 'r', duration: 2200, scale: 0.9, ...tint('#a05c33') }),
    impact('Flaking rust', ['particles.outward.greenyellow.01.01'], { after: 'r', anchor: 'start', offset: 600, duration: 1800, scale: 0.8, ...tint('#a05c33') }),
    motion('shake', 'targets', { after: 'r', anchor: 'start', offset: 600, duration: 700, intensity: 0.3 }),
  ], { sound: 'acid' }),
  // 421 Sacred Covenant
  'pf2e:fusrsBS7pb2KxYi4': design('A golden covenant bond links the allies under a sacred oath.', () => [
    travel('Covenant bond', STRANDS, { stageId: 't', duration: 1500, scale: 0.6, ...tint('#ffd36b') }),
    cast('Sacred oath', ['ward.star.yellow.01'], { after: 't', anchor: 'start', offset: 300, duration: 2400, scale: 0.9 }),
    impact('Pact sealed', ['ward.star.yellow.01'], { after: 't', anchor: 'start', offset: 800, duration: 1800, scale: 0.6 }),
  ], { sound: 'bless' }),
  // 425 Safeguard Secret
  'pf2e:OsrtOeG0TvDNnEFH': design('A protective seal closes over the guarded knowledge.', () => [
    cast('Protected knowledge', ['icon.runes02.orange'], { stageId: 'r', duration: 1600, scale: 0.5 }),
    cast('Secret sealed', ['shield.01.complete.01.blue'], { after: 'r', anchor: 'start', offset: 500, duration: 2400, scale: 0.8 }),
  ]),
  // 426 Sage's Curse
  'pf2e:APDrC83QljsyHenB': design('Swirling minutiae crowd the target\'s mind and it second-guesses itself.', () => [
    impact('Distracting minutiae', ['icon.runes02.orange'], { stageId: 'r', duration: 1800, scale: 0.7 }),
    impact('Second-guessing', ['dizzy_stars.200px.purple', 'dizzy_stars.200px.blueorange'], { after: 'r', anchor: 'start', offset: 500, duration: 1800, scale: 0.6 }),
  ]),
  // 428 Sand Form
  'pf2e:KjC2ya8HD5AENeHI': design('The target\'s body and gear shift into flowing sand.', () => [
    impact('Sand swirls', ['particles.outward.greenyellow.01.01'], { stageId: 's', duration: 2000, scale: 1, ...tint('#d2b27a') }),
    impact('Sand body', ['whirlwind.bluegrey'], { after: 's', anchor: 'start', offset: 300, duration: 2000, scale: 0.6, opacity: 0.7, ...tint('#d2b27a') }),
  ]),
  // 429 Sanguine Mist
  'pf2e:5zeSxzDxMSr0wgSF': design('A bloodsucking red fog fills the burst and drains the living.', () => [
    area('Blood fog', ['ambient_fog.001.complete.large.purplered', 'ambient_fog.001.complete.large.white'], { stageId: 'f', duration: 3600, ...tint('#9a1f2a') }),
    impact('Life drained', ['energy_strands.in.green.01'], { after: 'f', anchor: 'start', offset: 600, duration: 1800, scale: 0.6, ...tint('#c0303a') }),
    motion('stagger', 'targets', { after: 'f', anchor: 'start', offset: 700, duration: 900 }),
  ]),
  // 435 Scholarly Recollection
  'pf2e:dXIRotMLsABDQQSB': design('A short prayer points the cleric\'s thoughts in the right direction.', () => [
    cast('Thoughts gathered', ['icon.runes02.orange'], { stageId: 'r', duration: 1600, scale: 0.6 }),
    cast('Insight', ['ioun_stones.01.blue.insight'], { after: 'r', anchor: 'start', offset: 400, duration: 2200, scale: 0.6 }),
  ]),
  // 438 Scouring Pulse
  'pf2e:9bOqFkewRz7Z3HZ5': design('A column of vitality light scours the area and undead burn.', () => [
    area('Vitality column', ['moonbeam.01.complete.yellow', 'moonbeam.01.complete.blue'], { stageId: 'c', duration: 3000, ...tint('#fff3b0') }),
    impact('Undeath scoured', ['sacred_flame.target.yellow'], { after: 'c', anchor: 'start', offset: 600, duration: 1800, scale: 0.8 }),
    motion('stagger', 'targets', { after: 'c', anchor: 'start', offset: 700, duration: 800 }),
  ]),
  // 441 Scramble Body
  'pf2e:XcMObj2p9nIBp53b': design('A queasy haze wracks the target\'s biology and it reels.', () => [
    cast('Biology unsettled', PURPLE_CAST, { stageId: 'c', duration: 600, scale: 0.7 }),
    impact('Nausea', ['fumes.04.complete.green', 'fumes.04.complete.grey'], { stageId: 'n', after: 'c', duration: 2200, scale: 0.8 }),
    motion('stagger', 'targets', { after: 'n', anchor: 'start', offset: 400, duration: 1000, intensity: 0.5 }),
  ]),
  // 447 Sea of Thought
  'pf2e:tSosbMsftXcRaQgT': design('An ankle-high torrent of semi-solid thought sloshes across the burst and bogs creatures down.', () => [
    area('Sloshing thought', ['liquid.blob.purple', 'liquid.blob.blue'], { stageId: 's', duration: 3400, opacity: 0.85, ...tint('#9a7fd0') }),
    area('Thought currents', ['energy_strands.02.marker.bluepurple'], { after: 's', anchor: 'start', offset: 400, duration: 2800, opacity: 0.6 }),
    motion('sink', 'targets', { after: 's', anchor: 'start', offset: 700, duration: 1300, intensity: 0.4 }),
  ]),
  // 448 Sea Surge
  'pf2e:cf7Jkm39uEjUFtHt': design('The caster slaps the surface and a wall of water surges down the line, shoving creatures along.', () => [
    cast('Surface slap', ['liquid.splash.blue'], { stageId: 'c', duration: 900, scale: 0.8 }),
    area('Surging wave', ['liquid.splash_side.blue'], { stageId: 'w', after: 'c', anchor: 'start', offset: 300, duration: 2200, areaLayout: 'tiles' }),
    motion('rush', 'targets', { after: 'w', anchor: 'start', offset: 500, duration: 1300, distance: 1.5, motionRange: 'distance', motionHeading: 'away', intensity: 0.5 }),
  ], { sound: 'water' }),
  // 449 Seal Fate
  'pf2e:gfKhtVsXF3HKSdmY': design('A death-curse seals the target\'s fated end.', () => [
    impact('Fated death', ['toll_the_dead.purple.skull_smoke', 'toll_the_dead.green.skull_smoke'], { stageId: 'd', duration: 2000, scale: 0.7 }),
    impact('Fate sealed', ['magic_signs.rune.necromancy.complete.green'], { after: 'd', anchor: 'start', offset: 500, duration: 2000, scale: 0.5 }),
    motion('cower', 'targets', { after: 'd', anchor: 'start', offset: 500, duration: 900, intensity: 0.4 }),
  ]),
  // 451 Secret Chest
  'pf2e:BoA00y45uDlmou07': design('The container fades ethereal and slips through a portal into the Ethereal Plane.', () => [
    impact('Turns ethereal', ['shimmer.01.blue'], { stageId: 's', duration: 1600, scale: 0.8 }),
    impact('Banished', ['portals.horizontal.ring.purple', 'portals.horizontal.ring.bright_yellow'], { after: 's', anchor: 'start', offset: 500, duration: 2600, scale: 0.8 }),
  ]),
  // 452 Secret Page
  'pf2e:VVAZPCvd4d90qVA1': design('The text shimmers and rewrites itself.', () => [
    impact('Text rewrites', ['icon.runes02.orange'], { stageId: 'r', duration: 1800, scale: 0.5 }),
    impact('Concealed', ['shimmer.01.blue'], { after: 'r', anchor: 'start', offset: 400, duration: 2000, scale: 0.7 }),
  ]),
  // 453 Secure Siege Weapons
  'pf2e:a9og2ZYfr8kAeltU': design('Protective wards fortify the siege weapons.', () => [
    cast('Fortification', ['shield.01.complete.01.blue'], { stageId: 's', duration: 2800, scale: 1 }),
    cast('Enemy ward', ['ward.rune.yellow.01'], { after: 's', anchor: 'start', offset: 600, duration: 2400, scale: 0.8 }),
  ], { sound: 'shield' }),
  // 455 Seed of Mercy
  'pf2e:opXqASAY37ltENB8': design('A tended bird recovers and flies free in a flurry of feathers.', () => [
    cast('Merciful tending', GREEN_HEAL, { stageId: 'h', duration: 1800, scale: 0.6 }),
    cast('Bird flies free', ['swirling_feathers.outburst.01.textured'], { after: 'h', anchor: 'start', offset: 900, duration: 1800, scale: 0.8 }),
  ]),
  // 456 Seize Identity
  'pf2e:DOBs5ALM1titPYxe': design('The target\'s voice is torn away and swallowed, and the caster takes on its look.', () => [
    impact('Voice seized', ['icon.mute.dark_red'], { stageId: 'v', duration: 1600, scale: 0.5 }),
    travel('Identity drawn in', STRANDS, { stageId: 't', after: 'v', anchor: 'start', offset: 400, duration: 1300, scale: 0.6, mirrorX: true }),
    cast('Borrowed appearance', ['shimmer.01.blue'], { after: 't', anchor: 'start', offset: 700, duration: 2000, scale: 1 }),
    motion('recoil', 'targets', { after: 'v', anchor: 'start', offset: 300, duration: 650 }),
  ]),
  // 457 Seize Soul
  'pf2e:GYmXvS9NJ7QwfWGg': design('The departing soul is dragged into the vessel item.', () => [
    impact('Soul rises', ['spirit_guardians.blueyellow.no_ring', 'spirit_guardians.blueyellow.ring'], { stageId: 's', duration: 2200, scale: 0.7 }),
    travel('Soul dragged', STRANDS, { after: 's', anchor: 'start', offset: 700, duration: 1300, scale: 0.5, mirrorX: true }),
    cast('Soul vessel', ['ioun_stones.01.pink.protection'], { after: 's', anchor: 'start', offset: 1300, duration: 2000, scale: 0.5 }),
  ], { sound: 'spirit' }),
  // 460 Sepulchral Mask
  'pf2e:3mINzPzup2m9qzFU': design('A funerary mask manifests and its regretful gaze sweeps the emanation.', () => [
    cast('Funerary mask', ['icon.skull.purple'], { stageId: 'm', duration: 1800, scale: 0.6 }),
    area('Regret spreads', ['smoke.puff.ring.01.dark_black', 'smoke.puff.ring.01.white'], { after: 'm', anchor: 'start', offset: 400, duration: 2000, opacity: 0.7 }),
    motion('cower', 'targets', { after: 'm', anchor: 'start', offset: 700, duration: 900, intensity: 0.4 }),
  ]),
  // 462 Shadow Army
  'pf2e:hvKtmoHwekDZ5iOH': design('Dozens of shadowy clones of the caster swarm across the burst and batter enemies.', () => [
    cast('Shadows gather', ['smoke.plumes.01.purple', 'smoke.plumes.01.grey'], { stageId: 'c', duration: 900, scale: 1, ...tint('#2b2533') }),
    sprite('Shadow clones', { after: 'c', anchor: 'start', offset: 300, duration: 2000, opacity: 0.5 }),
    area('Shadow swarm', ['darkness.black'], { stageId: 'a', after: 'c', anchor: 'start', offset: 400, duration: 3000, opacity: 0.7 }),
    impact('Clones strike', ['melee_generic.slash.01.orange'], { after: 'a', anchor: 'start', offset: 600, duration: 1000, scale: 0.6, ...tint('#3a2f4a') }),
    motion('shake', 'targets', { after: 'a', anchor: 'start', offset: 600, duration: 800, intensity: 0.5 }),
  ]),
  // 468 Shadow Raid
  'pf2e:VTb0yI6P1bLkzuRr': design('Flying shadows explode into being across the burst and strike enemies.', () => [
    area('Shadows erupt', ['smoke.puff.ring.01.dark_black', 'smoke.puff.ring.01.white'], { stageId: 's', duration: 1600 }),
    area('Flying shadows', ['bats.complete.01.red'], { after: 's', anchor: 'start', offset: 300, duration: 2400, ...tint('#2b2533') }),
    impact('Shadow strikes', ['claws.200px.bright_purple', 'claws.200px.red'], { after: 's', anchor: 'start', offset: 700, duration: 1100, scale: 0.6, ...tint('#3a2f4a') }),
    motion('shake', 'targets', { after: 's', anchor: 'start', offset: 700, duration: 800, intensity: 0.5 }),
  ]),
  // 471 Shadow Strike
  'pf2e:AZKN2gnZSw2IHsQc': design('A tendril of darkness latches onto the target and drags it toward the caster.', () => [
    cast('Darkness gathers', ['smoke.puff.centered.dark_purple', 'smoke.puff.centered.grey'], { stageId: 'c', duration: 700, scale: 0.8 }),
    travel('Shadow tendril', ['energy_strands.range.multiple.dark_purple.01', 'energy_strands.range.multiple.purple.01'], { stageId: 't', after: 'c', duration: 1500, scale: 0.8 }),
    impact('Tendril latches', ['arms_of_hadar.dark_purple'], { after: 't', anchor: 'arrival', duration: 1600, scale: 0.7 }),
    motion('rush', 'targets', { after: 't', anchor: 'arrival', offset: 200, duration: 1300, distance: 2, motionRange: 'distance', motionHeading: 'toward', intensity: 0.5 }),
  ]),
  // 474 Shaken Confidence
  'pf2e:9j35xXKVVtHCh1Pe': design('Mockery rattles the foe and doubt clouds its next roll.', () => [
    cast('Mocking voice', ['soundwave.02.purple', 'soundwave.02.blue'], { stageId: 'm', duration: 1200, scale: 0.8 }),
    impact('Doubt', ['icon.fear.dark_purple'], { after: 'm', anchor: 'start', offset: 400, duration: 1800, scale: 0.4 }),
    motion('cower', 'targets', { after: 'm', anchor: 'start', offset: 500, duration: 800, intensity: 0.4 }),
  ]),
  // 478 Shape Wood
  'pf2e:CXICME10TkEJxz0P': design('The wood twists and reshapes under the caster\'s will.', () => [
    impact('Wood bends', ['aura_themed.01.inward.complete.wood.01.green'], { stageId: 'w', duration: 2200, scale: 0.8 }),
    impact('Shaping', ['arcane_hand.green', 'arcane_hand.blue'], { after: 'w', anchor: 'start', offset: 400, duration: 2000, scale: 0.5 }),
  ]),
  // 479 Share Burden
  'pf2e:cJq5NarY0eOZN74A': design('A tether lets the cleric shoulder part of the ally\'s emotional pain.', () => [
    travel('Burden shared', STRANDS, { stageId: 't', duration: 1500, scale: 0.6 }),
    impact('Support', ['shield.01.intro.blue'], { after: 't', anchor: 'start', offset: 700, duration: 1500, scale: 0.8 }),
    motion('brace', 'source', { after: 't', anchor: 'start', offset: 800, duration: 700, intensity: 0.4 }),
  ]),
  // 480 Share Life
  'pf2e:d7Lwx6KAs47MtF0q': design('A link of life essence binds caster and target.', () => [
    travel('Life bond', ['energy_strands.range.standard.dark_red.01', 'energy_strands.range.standard.purple.01'], { stageId: 't', duration: 1600, scale: 0.6 }),
    impact('Shared life', ['icon.heart.pink'], { after: 't', anchor: 'start', offset: 700, duration: 1800, scale: 0.4 }),
  ]),
  // 481 Share Lore
  'pf2e:nXmC2Xx9WmS5NsAo': design('Knowledge flows from the caster into the touched creatures.', () => [
    cast('Expertise offered', PURPLE_CAST, { stageId: 'c', duration: 600, scale: 0.7 }),
    travel('Knowledge travels', ['energy_strands.range.standard.purple.04'], { stageId: 't', after: 'c', duration: 1400, scale: 0.6 }),
    impact('Lore received', ['icon.runes02.orange'], { after: 't', anchor: 'start', offset: 800, duration: 1800, scale: 0.4 }),
  ]),
  // 484 Shared Nightmare
  'pf2e:skvgOWNTitLehL0b': design('Merged minds swap distressing visions and the target reels confused.', () => [
    travel('Minds merge', STRANDS, { stageId: 't', duration: 1400, scale: 0.6 }),
    impact('Nightmare visions', ['icon.horror.purple'], { after: 't', anchor: 'start', offset: 700, duration: 1800, scale: 0.6 }),
    impact('Confusion', ['dizzy_stars.200px.purple', 'dizzy_stars.200px.blueorange'], { after: 't', anchor: 'start', offset: 1100, duration: 1600, scale: 0.6 }),
    motion('shake', 'targets', { after: 't', anchor: 'start', offset: 900, duration: 800, intensity: 0.4 }),
  ], { sound: 'psychic' }),
  // 486 Shatter Mind
  'pf2e:BqJAOPimCq5uCcEJ': design('A cone of telepathic force assails the minds of enemies, who flinch.', () => [
    cast('Psychic charge', PURPLE_CAST, { stageId: 'c', duration: 500, scale: 0.7 }),
    area('Mental cone', ['detect_magic.cone.purple', 'detect_magic.cone.blue'], { stageId: 'a', after: 'c', duration: 1500 }),
    impact('Minds assailed', ['impact.pinkpurple', 'impact.004.blue'], { after: 'a', anchor: 'start', offset: 400, duration: 900, scale: 0.6 }),
    motion('shake', 'targets', { after: 'a', anchor: 'start', offset: 400, duration: 700, intensity: 0.4 }),
  ]),
  // 487 Shattering Gem
  'pf2e:0uRpypf1Hi7ahvTl': design('A large gem materializes and orbits the target erratically.', () => [
    impact('Gem forms', ['glint.yellow.few'], { stageId: 'g', duration: 900, scale: 0.6 }),
    impact('Orbiting gem', ['ioun_stones.01.pink.protection'], { after: 'g', anchor: 'start', offset: 400, duration: 3000, scale: 0.8, ...spin(2400) }),
  ]),
  // 499 Shillelagh
  'pf2e:s3abwDbTV43pGFFW': design('Vines and leaves sprout along the club or staff as it swells with primal power.', () => [
    impact('Weapon vines', ['vine.complete.nature.single.01.green'], { stageId: 'v', duration: 2200, scale: 0.6 }),
    impact('Leaves burst', ['swirling_leaves.outburst.01.pink', 'swirling_leaves.complete.01.green'], { after: 'v', anchor: 'start', offset: 400, duration: 1600, scale: 0.6, ...tint('#7fbf4a') }),
    impact('Primal glow', ['aura_themed.01.outward.complete.nature.01.green'], { after: 'v', anchor: 'start', offset: 700, duration: 1800, scale: 0.7 }),
  ]),
};
