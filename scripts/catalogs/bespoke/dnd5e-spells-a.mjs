// Bespoke compositions (dnd5e-spells-a). Keys: '<system>:<entryId>' or '<system>:<entryId>:<variant|mode>'.
// See scripts/catalogs/bespoke/helpers.mjs and scripts/bespoke.mjs.
import { cast, travel, projectile, impact, area, aura, sprite, motion, tint, spin, breathe, design } from './helpers.mjs';

// School sigils (Patreon first, Free fallback).
const NECRO = ['magic_signs.circle.02.necromancy.complete.dark_purple', 'magic_signs.circle.02.necromancy.complete.dark_green'];
const ABJ = ['magic_signs.circle.02.abjuration.complete.blue'];
const ENCH = ['magic_signs.circle.02.enchantment.complete.pink'];
const TRANS = ['magic_signs.circle.02.transmutation.complete.yellow'];
const CONJ = ['magic_signs.circle.02.conjuration.complete.yellow'];
const DIV = ['magic_signs.circle.02.divination.complete.blue'];
const EVO = ['magic_signs.circle.02.evocation.complete.red'];
const HOLY = ['divine_smite.caster.standard.yellowwhite', 'divine_smite.caster.standard.blueyellow'];
const sigil = (label, assets, o = {}) => cast(label, assets, { stageId: 'sig', scale: 0.9, below: true, duration: 1400, fadeOut: 300, ...o });

// ---------- shared designs ----------
const raiseUndead = design('Necromantic sigil flares under the caster and the remains: skull-smoke rises as the corpse lurches into undeath.', () => [
  sigil('Necromantic sigil', NECRO),
  aura('Sigil beneath the remains', NECRO, { subject: 'targets', stageId: 'rs', after: 'sig', anchor: 'start', offset: 400, duration: 2400, scale: 1.1, below: true, fadeIn: 200, fadeOut: 500 }),
  impact('Foul life rises', ['toll_the_dead.purple.skull_smoke', 'toll_the_dead.green.skull_smoke'], { after: 'rs', anchor: 'start', offset: 600, duration: 2000, scale: 0.9 }),
  motion('shake', 'targets', { after: 'rs', anchor: 'start', offset: 900, duration: 700, intensity: 0.5 }),
], { sound: 'void' });

const commandUndead = design('A thread of necromantic will reaches from the caster to the undead servant, reasserting control.', () => [
  cast('Will gathers', NECRO, { stageId: 'c', scale: 0.7, below: true, duration: 1000 }),
  travel('Thread of control', ['energy_strands.range.standard.dark_purple.01', 'energy_strands.range.standard.purple.01'], { stageId: 't', after: 'c', anchor: 'start', offset: 400, duration: 1400 }),
  impact('Command takes hold', ['energy_strands.complete.dark_purple.01', 'energy_strands.complete.blue.01'], { after: 't', anchor: 'end', duration: 1500, scale: 0.8 }),
  motion('pulse', 'targets', { after: 't', anchor: 'end', duration: 700, intensity: 0.4 }),
]);

const necroticBlast = (why) => design(why, () => [
  sigil('Negative energy gathers', NECRO),
  travel('Negative energy courses', ['energy_strands.range.standard.dark_purple.02', 'energy_strands.range.standard.purple.02'], { stageId: 't', after: 'sig', anchor: 'start', offset: 500, duration: 1300 }),
  impact('Life torn away', ['toll_the_dead.purple.skull_smoke', 'toll_the_dead.green.skull_smoke'], { after: 't', anchor: 'end', duration: 1800, scale: 0.9 }),
  impact('Necrotic surge', ['energy_strands.in.purple.01', 'energy_strands.in.green.01'], { after: 't', anchor: 'end', duration: 1500, scale: 0.9 }),
  motion('stagger', 'targets', { after: 't', anchor: 'end', duration: 800 }),
], { sound: 'drain' });

const antilife = design('A shimmering barrier spreads from the caster to fill the 10-foot emanation, hedging out living creatures.', () => [
  sigil('Abjuration sigil', ABJ),
  area('Antilife shell', ['antilife_shell.blue_with_circle', 'antilife_shell.blue_no_circle'], { after: 'sig', anchor: 'start', offset: 500, duration: 3500, fadeIn: 400, fadeOut: 600 }),
  motion('brace', 'source', { after: 'sig', anchor: 'start', offset: 400, duration: 900 }),
]);

const arcaneEye = design('An invisible magical eye opens and hovers beside the caster, relaying sight.', () => [
  sigil('Divination sigil', DIV),
  aura('Arcane eye opens', ['eyes.01.single.purple', 'eyes.01.dark_green.single'], { after: 'sig', anchor: 'start', offset: 500, duration: 2800, scale: 0.7, offsetY: -0.9, offsetUnits: 'token', fadeIn: 300, fadeOut: 600 }),
]);

const arcaneHand = design('A Large hand of shimmering force materializes in the chosen space.', () => [
  sigil('Evocation sigil', EVO),
  impact('Hand of force', ['arcane_hand.blue', 'arcane_hand.blue'], { after: 'sig', anchor: 'start', offset: 500, duration: 3500, scale: 1.4, fadeIn: 300, fadeOut: 500 }),
], { sound: 'force' });

const arcaneSword = design('A spectral sword of force appears beside the foe and slashes it with a melee spell attack.', () => [
  sigil('Evocation sigil', EVO),
  impact('Spectral sword', ['spiritual_weapon.longsword.01.spectral.01.purple', 'spiritual_weapon.longsword.01.spectral.02.green'], { stageId: 'sw', after: 'sig', anchor: 'start', offset: 400, duration: 2600, scale: 1.1, offsetX: -0.5, offsetUnits: 'token', fadeIn: 250, fadeOut: 400 }),
  impact('Force slash', ['impact.004.dark_purple', 'impact.004.blue'], { after: 'sw', anchor: 'start', offset: 1100, duration: 1200, scale: 1 }),
  motion('stagger', 'targets', { after: 'sw', anchor: 'start', offset: 1150, duration: 700 }),
], { sound: 'force' });

const astral = design('The caster and companions project astral forms that lift free of their bodies through a swirling astral rift.', () => [
  sigil('Conjuration sigil', CONJ),
  aura('Astral rift', ['portals.horizontal.vortex.purple', 'portals.horizontal.ring.bright_yellow'], { stageId: 'rift', after: 'sig', anchor: 'start', offset: 400, duration: 3000, scale: 1.4, below: true, fadeIn: 300, fadeOut: 600 }),
  sprite('Astral form rises', { after: 'rift', anchor: 'start', offset: 600, duration: 2200, opacity: 0.45, offsetY: -0.5, offsetUnits: 'token', fadeIn: 400, fadeOut: 800 }),
  aura('Silver threads', ['energy_strands.overlay.blue.01'], { subject: 'targets', after: 'rift', anchor: 'start', offset: 600, duration: 2200, scale: 1, fadeIn: 300, fadeOut: 600 }),
], { sound: 'teleport' });

const bane = design('Enchantment weighs on up to three foes: a baleful sigil, then a curse mark that saps their attacks and saves.', () => [
  sigil('Enchantment sigil', ENCH),
  aura('Bane settles', ['condition.curse.01.003.purple', 'condition.curse.01.003.red'], { subject: 'targets', stageId: 'b', after: 'sig', anchor: 'start', offset: 500, duration: 2400, scale: 1, fadeIn: 300, fadeOut: 500 }),
  motion('cower', 'targets', { after: 'b', anchor: 'start', offset: 200, duration: 800, intensity: 0.5 }),
], { sound: 'fear' });

const banish = design('An abjuration sigil opens a planar vortex beneath the target that tugs at it (the save decides whether it goes).', () => [
  sigil('Abjuration sigil', ABJ),
  aura('Planar vortex', ['portals.horizontal.vortex_masked.purple', 'portals.horizontal.ring.bright_yellow'], { subject: 'targets', stageId: 'v', after: 'sig', anchor: 'start', offset: 500, duration: 2800, scale: 1.3, below: true, fadeIn: 300, fadeOut: 600 }),
  motion('shake', 'targets', { after: 'v', anchor: 'start', offset: 400, duration: 900, intensity: 0.6 }),
], { sound: 'teleport' });

const barkskin = design('Bark creeps inward over the touched creature, hardening its skin.', () => [
  cast('Nature gathers', ['swirling_leaves.complete.01.green'], { stageId: 'c', scale: 0.8, duration: 1200 }),
  aura('Bark hardens', ['aura_themed.01.inward.complete.wood.01.green'], { subject: 'targets', stageId: 'b', after: 'c', anchor: 'start', offset: 500, duration: 2600, scale: 1.1, fadeOut: 500 }),
  motion('brace', 'targets', { after: 'b', anchor: 'start', offset: 600, duration: 800 }),
]);

const beacon = design('Divine light gathers and blooms over every chosen ally, bestowing hope and vitality.', () => [
  cast('Hope kindles', HOLY, { stageId: 'c', scale: 0.8, duration: 1300 }),
  impact('Hope blossoms', ['healing_generic.burst.yellowwhite', 'healing_generic.burst.greenorange'], { stageId: 'h', after: 'c', anchor: 'start', offset: 600, duration: 1800, scale: 1.1 }),
  aura('Radiant glow', ['markers.light.complete.yellow', 'dancing_light.yellow'], { subject: 'targets', after: 'h', anchor: 'start', offset: 200, duration: 2200, scale: 0.9, fadeIn: 300, fadeOut: 600 }),
  motion('pulse', 'targets', { after: 'h', anchor: 'start', duration: 800, intensity: 0.4 }),
], { sound: 'holy' });

const bless = design('Golden blessing light descends on up to three allies.', () => [
  cast('Prayer', HOLY, { stageId: 'c', scale: 0.7, duration: 1200 }),
  aura('Blessing', ['bless.200px.intro.yellow'], { subject: 'targets', stageId: 'b', after: 'c', anchor: 'start', offset: 500, duration: 2600, scale: 1.2, fadeOut: 500 }),
  motion('pulse', 'targets', { after: 'b', anchor: 'start', offset: 300, duration: 800, intensity: 0.4 }),
], { sound: 'bless' });

const blight = design('Necromantic energy washes over the target, drawing moisture and vitality out of it in a withering plume.', () => [
  sigil('Necromantic sigil', NECRO),
  impact('Vitality drawn out', ['energy_strands.in.green.01'], { stageId: 'd', after: 'sig', anchor: 'start', offset: 500, duration: 1600, scale: 1 }),
  impact('Withering plume', ['smoke.puff.centered.dark_green', 'smoke.puff.centered.grey'], { after: 'd', anchor: 'start', offset: 500, duration: 1600, scale: 1 }),
  motion('stagger', 'targets', { after: 'd', anchor: 'start', offset: 400, duration: 800 }),
], { sound: 'drain' });

const blindness = design('A necromantic hex clouds the target\'s senses with a pall of darkness.', () => [
  sigil('Necromantic sigil', NECRO),
  impact('Senses darken', ['smoke.puff.centered.dark_black', 'smoke.puff.centered.grey'], { stageId: 'd', after: 'sig', anchor: 'start', offset: 500, duration: 1800, scale: 0.8, offsetY: -0.2, offsetUnits: 'token' }),
  motion('shake', 'targets', { after: 'd', anchor: 'start', offset: 300, duration: 700, intensity: 0.5 }),
], { sound: 'shadow' });

const brandingCast = design('The weapon is charged with astral radiance, ready for the next hit.', () => [
  aura('Radiance gathers', HOLY, { stageId: 'c', duration: 1600, scale: 0.9 }),
  motion('pulse', 'source', { after: 'c', anchor: 'start', offset: 200, duration: 800, intensity: 0.4 }),
], { sound: 'holy' });

const brandingHit = design('The struck foe flashes with astral radiance and is left shedding light.', () => [
  impact('Radiant brand', ['divine_smite.target.yellowwhite', 'divine_smite.target.blueyellow'], { stageId: 'h', duration: 1600, scale: 1 }),
  aura('Branded glow', ['markers.light.complete.yellow', 'dancing_light.yellow'], { subject: 'targets', after: 'h', anchor: 'start', offset: 600, duration: 2200, scale: 0.8, fadeIn: 300, fadeOut: 600 }),
  motion('recoil', 'targets', { after: 'h', anchor: 'start', offset: 200, duration: 600 }),
], { sound: 'holy' });

const bladeWall = design('A wall of whirling magical blades rises along the chosen line.', () => [
  cast('Blades gather', ['cast_shape.circle.01.yellow', 'cast_shape.circle.01.blue'], { stageId: 'c', scale: 0.8, duration: 1200 }),
  area('Wall of whirling blades', ['cloud_of_daggers.daggers.yellow'], { after: 'c', anchor: 'start', offset: 500, duration: 3500, areaLayout: 'tiles', fadeIn: 300, fadeOut: 600 }),
  motion('pulse', 'source', { after: 'c', anchor: 'start', duration: 800, intensity: 0.4 }),
]);

const blackTentacleSave = design('Ebony tentacles lash up around the creature in the area and try to restrain it.', () => [
  impact('Tentacles grasp', ['black_tentacles.dark_purple'], { stageId: 't', duration: 2400, scale: 1.1 }),
  motion('shake', 'targets', { after: 't', anchor: 'start', offset: 300, duration: 900, intensity: 0.6 }),
]);

const chillTouch2014 = design('A ghostly skeletal hand forms in the target\'s space and assails it with the chill of the grave.', () => [
  cast('Grave chill', NECRO, { stageId: 'c', scale: 0.6, below: true, duration: 900 }),
  impact('Ghostly hand', ['arcane_hand.green'], { stageId: 'h', after: 'c', anchor: 'start', offset: 400, duration: 1800, scale: 0.8, opacity: 0.8 }),
  impact('Necrotic chill', ['energy_strands.complete.dark_green.01', 'energy_strands.complete.blue.01'], { after: 'h', anchor: 'start', offset: 700, duration: 1400, scale: 0.8 }),
  motion('stagger', 'targets', { after: 'h', anchor: 'start', offset: 700, duration: 700 }),
]);

const celestialPillar = design('A spirit from the Upper Planes manifests as a 10-foot-radius pillar of light.', () => [
  cast('Celestial call', HOLY, { stageId: 'c', scale: 0.8, duration: 1300 }),
  area('Pillar of light', ['moonbeam.01.complete.yellow', 'moonbeam.01.complete.blue'], { after: 'c', anchor: 'start', offset: 600, duration: 3800, fadeIn: 300, fadeOut: 600 }),
], { sound: 'holy' });

const minorElementals = design('Elemental spirits flit in a ring around the caster across the 15-foot emanation.', () => [
  sigil('Conjuration sigil', CONJ),
  area('Spirits flit around', ['spirit_guardians.orange.no_ring', 'spirit_guardians.blueyellow.ring'], { after: 'sig', anchor: 'start', offset: 500, duration: 3500, fadeIn: 400, fadeOut: 600 }),
]);

const minorElementalHit = design('The flitting elemental spirits lash the struck creature with extra elemental damage.', () => [
  impact('Elemental lash', ['explosion.01.orange'], { stageId: 'h', duration: 1200, scale: 0.6 }),
  motion('recoil', 'targets', { after: 'h', anchor: 'start', offset: 150, duration: 600 }),
]);

const contingency = design('A dormant ward is woven around the caster, waiting for its trigger.', () => [
  sigil('Evocation sigil', EVO),
  aura('Dormant ward', ['ward.rune.yellow.01'], { after: 'sig', anchor: 'start', offset: 500, duration: 2600, scale: 1, fadeIn: 300, fadeOut: 600 }),
  motion('pulse', 'source', { after: 'sig', anchor: 'start', offset: 600, duration: 800, intensity: 0.4 }),
], { sound: 'shield' });

const continualFlame = design('A heatless, torch-bright flame springs from the touched object.', () => [
  cast('Kindling', ['cast_generic.fire.01.orange'], { stageId: 'c', scale: 0.6, duration: 900 }),
  impact('Everburning flame', ['flames.01.orange'], { after: 'c', anchor: 'start', offset: 400, duration: 3000, scale: 0.55, fadeIn: 200, fadeOut: 600 }),
]);

const counterspell = design('A sharp abjuration snaps toward the enemy caster and unravels its spell in a burst of broken runes.', () => [
  cast('Counter-ward', ABJ, { stageId: 'c', scale: 0.7, below: true, duration: 800 }),
  travel('Unweaving thread', ['energy_strands.range.standard.blue.01', 'energy_strands.range.standard.purple.01'], { stageId: 't', after: 'c', anchor: 'start', offset: 250, duration: 1100 }),
  impact('Spell unravels', ['particle_burst.01.rune.bluepurple'], { after: 't', anchor: 'end', duration: 1500, scale: 1 }),
  motion('stagger', 'targets', { after: 't', anchor: 'end', duration: 700 }),
], { sound: 'dispel' });

const dispel = design('Abjuration reaches the target and its magic breaks apart in scattering runes and glints.', () => [
  sigil('Abjuration sigil', ABJ),
  impact('Magic unravels', ['particle_burst.01.rune.bluepurple'], { stageId: 'u', after: 'sig', anchor: 'start', offset: 500, duration: 1500, scale: 1.1 }),
  impact('Fading glints', ['glint.blue.many', 'glint.yellow.many'], { after: 'u', anchor: 'start', offset: 500, duration: 1600, scale: 1 }),
], { sound: 'dispel' });

const darkvision = design('The touched creature\'s eyes take on a faint glow as it gains darkvision.', () => [
  sigil('Transmutation sigil', TRANS),
  aura('Eyes see the dark', ['eyes.01.bluegreen.single', 'eyes.01.dark_green.single'], { subject: 'targets', after: 'sig', anchor: 'start', offset: 500, duration: 2200, scale: 0.6, offsetY: -0.2, offsetUnits: 'token', fadeIn: 300, fadeOut: 600 }),
], { sound: 'detect' });

const delayedBlast = design('A beam of yellow light flashes to the chosen point and erupts in a fireball.', () => [
  cast('Fire gathers', ['cast_generic.fire.01.orange'], { stageId: 'c', scale: 0.8, duration: 1000 }),
  travel('Yellow beam', ['fireball.beam.yellow', 'fireball.beam.orange'], { stageId: 'b', after: 'c', anchor: 'start', offset: 500, duration: 1200, travelDestination: 'area' }),
  area('Fireball blossoms', ['fireball.explosion.orange'], { after: 'b', anchor: 'end', duration: 2200 }),
  motion('recoil', 'targets', { after: 'b', anchor: 'end', offset: 200, duration: 700 }),
], { sound: 'fireball' });

const delayedBead = design('A beam of yellow light flashes out and condenses into a glowing bead at the chosen point.', () => [
  cast('Fire gathers', ['cast_generic.fire.01.orange'], { stageId: 'c', scale: 0.8, duration: 1000 }),
  travel('Yellow beam', ['fireball.beam.yellow', 'fireball.beam.orange'], { stageId: 'b', after: 'c', anchor: 'start', offset: 500, duration: 1200, travelDestination: 'area' }),
  area('Glowing bead', ['flaming_sphere.200px.orange.01'], { after: 'b', anchor: 'end', duration: 2600, scale: 0.2, fadeIn: 200, fadeOut: 500 }),
]);

const demiplane = design('A shadowy door outlines itself on a nearby surface, leading to an empty demiplane.', () => [
  cast('Shadow gathers', ['darkness.black'], { stageId: 'c', scale: 0.5, duration: 1000 }),
  aura('Shadowy door', ['portals.vertical.ring.dark_purple', 'portals.vertical.ring.bright_yellow'], { after: 'c', anchor: 'start', offset: 500, duration: 3500, scale: 1.2, offsetX: 1, offsetUnits: 'token', fadeIn: 400, fadeOut: 600 }),
], { sound: 'pocketTransition' });

const dimensionDoor = design('The caster vanishes in a burst of planar mist and steps through to the chosen spot.', () => [
  aura('Departure mist', ['misty_step.01.purple', 'misty_step.01.blue'], { stageId: 'd', duration: 1500, scale: 1.1 }),
  motion('flicker', 'source', { after: 'd', anchor: 'start', offset: 200, duration: 1200 }),
  aura('Arrival mist', ['misty_step.02.purple', 'misty_step.02.blue'], { after: 'd', anchor: 'start', offset: 1100, duration: 1500, scale: 1.1 }),
]);

const whispers = design('A discordant melody slithers into the target\'s mind; it reels away from the caster.', () => [
  cast('Discordant melody', ['cast_generic.sound.01.pinkteal'], { stageId: 'c', scale: 0.7, duration: 900 }),
  impact('Whispers in the mind', ['soundwave.02.purple', 'soundwave.02.blue'], { stageId: 'w', after: 'c', anchor: 'start', offset: 400, duration: 1500, scale: 0.9 }),
  impact('Psychic reel', ['dizzy_stars.200px.purple', 'dizzy_stars.200px.blueorange'], { after: 'w', anchor: 'start', offset: 600, duration: 1500, scale: 0.7, offsetY: -0.35, offsetUnits: 'token' }),
  motion('cower', 'targets', { after: 'w', anchor: 'start', offset: 500, duration: 900 }),
], { sound: 'whispers' });

const divineFavor = design('A prayer wreathes the caster and weapon in divine radiance.', () => [
  aura('Divine radiance', HOLY, { stageId: 'c', duration: 1600, scale: 0.9 }),
  aura('Favored glow', ['bless.200px.intro.yellow'], { after: 'c', anchor: 'start', offset: 600, duration: 2200, scale: 1, fadeOut: 500 }),
  motion('pulse', 'source', { after: 'c', anchor: 'start', offset: 300, duration: 800, intensity: 0.4 }),
], { sound: 'holy' });

const divineWord = design('A word of creation booms outward; each chosen creature is struck by its holy power.', () => [
  cast('Word of power', HOLY, { stageId: 'c', scale: 0.9, duration: 1200 }),
  aura('Word resounds', ['soundwave.01.orangeyellow', 'soundwave.01.blue'], { stageId: 'w', after: 'c', anchor: 'start', offset: 500, duration: 1500, scale: 1.8 }),
  impact('Holy force', ['sacred_flame.target.yellow'], { after: 'w', anchor: 'start', offset: 300, duration: 1800, scale: 1 }),
  motion('stagger', 'targets', { after: 'w', anchor: 'start', offset: 600, duration: 800 }),
], { sound: 'divineWrath' });

const eldritch = design('A crackling beam of eldritch energy streaks to the target and bursts on contact.', () => [
  cast('Eldritch charge', ['cast_shape.circle.01.purple', 'cast_shape.circle.01.blue'], { stageId: 'c', scale: 0.7, duration: 800 }),
  travel('Eldritch blast', ['eldritch_blast.purple'], { stageId: 'b', after: 'c', anchor: 'start', offset: 300, duration: 1500 }),
  impact('Force burst', ['impact.004.dark_purple', 'impact.004.blue'], { after: 'b', anchor: 'end', duration: 1200, scale: 0.9 }),
  motion('recoil', 'targets', { after: 'b', anchor: 'end', duration: 600 }),
]);

const enhance = design('Transmutation suffuses the touched creature with a surge of heightened ability.', () => [
  sigil('Transmutation sigil', TRANS),
  aura('Ability surges', ['condition.boon.01.007.yellow', 'condition.boon.01.007.green'], { subject: 'targets', stageId: 'b', after: 'sig', anchor: 'start', offset: 500, duration: 2400, scale: 1, fadeIn: 300, fadeOut: 500 }),
  motion('pulse', 'targets', { after: 'b', anchor: 'start', offset: 300, duration: 800, intensity: 0.5 }),
]);

const enlarge = design('Transmutation bursts around the target as it swells or shrinks in size.', () => [
  sigil('Transmutation sigil', TRANS),
  impact('Size shifts', ['particle_burst.01.circle.yellow', 'particle_burst.01.circle.bluepurple'], { stageId: 'p', after: 'sig', anchor: 'start', offset: 500, duration: 1500, scale: 1.3 }),
  motion('pulse', 'targets', { after: 'p', anchor: 'start', offset: 200, duration: 1200, intensity: 1.2 }),
]);

const ensnare = design('Grasping vines sprout on the struck target and try to restrain it.', () => [
  impact('Grasping vines', ['vine.complete.nature.single.01.green'], { stageId: 'v', duration: 2600, scale: 1 }),
  motion('shake', 'targets', { after: 'v', anchor: 'start', offset: 400, duration: 900, intensity: 0.6 }),
], { sound: 'vines' });

const eyebite = design('The caster\'s eyes become inky voids and the dread gaze lances into the chosen creature.', () => [
  aura('Inky void eyes', ['eyes.01.single.dark_purple', 'eyes.01.dark_green.single'], { stageId: 'e', duration: 1500, scale: 0.6, offsetY: -0.2, offsetUnits: 'token', fadeIn: 200, fadeOut: 300 }),
  travel('Dread gaze', ['energy_strands.range.standard.dark_purple.03', 'energy_strands.range.standard.purple.03'], { stageId: 'g', after: 'e', anchor: 'start', offset: 500, duration: 1200 }),
  impact('Gaze takes hold', ['smoke.puff.centered.dark_purple', 'smoke.puff.centered.grey'], { after: 'g', anchor: 'end', duration: 1500, scale: 0.8 }),
  motion('cower', 'targets', { after: 'g', anchor: 'end', duration: 900 }),
], { sound: 'fear' });

const falseLife = design('A necromantic facsimile of life knits over the caster as temporary hit points.', () => [
  sigil('Necromantic sigil', NECRO),
  aura('False vitality', ['energy_strands.overlay.dark_purple.01', 'energy_strands.overlay.blue.01'], { after: 'sig', anchor: 'start', offset: 500, duration: 2400, scale: 1, fadeIn: 300, fadeOut: 600 }),
  motion('pulse', 'source', { after: 'sig', anchor: 'start', offset: 700, duration: 800, intensity: 0.4 }),
], { sound: 'drain' });

const fireStorm = design('Sheets of roaring flame erupt across the chosen cubes.', () => [
  cast('Fire gathers', ['cast_generic.fire.01.orange'], { stageId: 'c', scale: 0.9, duration: 1100 }),
  area('Roaring sheets of flame', ['flames.orange.03.2x2'], { stageId: 'f', after: 'c', anchor: 'start', offset: 500, duration: 3200, fadeIn: 200, fadeOut: 600 }),
  area('Flame bursts', ['fireball.explosion.orange'], { after: 'f', anchor: 'start', offset: 200, duration: 2000, opacity: 0.8 }),
  motion('recoil', 'targets', { after: 'f', anchor: 'start', offset: 500, duration: 700 }),
]);

const flameBladeEvoke = design('A scimitar-shaped blade of fire ignites in the caster\'s free hand.', () => [
  cast('Fire kindles', ['cast_generic.fire.01.orange'], { stageId: 'c', scale: 0.6, duration: 800 }),
  aura('Flame blade', ['spiritual_weapon.sword.flaming.orange', 'flames.01.orange'], { after: 'c', anchor: 'start', offset: 300, duration: 2400, scale: 0.6, offsetX: 0.45, offsetUnits: 'token', fadeIn: 200, fadeOut: 500 }),
]);

const flameBladeAttack = design('The caster lunges and slashes with the blade of fire.', () => [
  motion('lunge', 'source', { stageId: 'l', duration: 700 }),
  impact('Fiery slash', ['melee_generic.slash.01.orange'], { stageId: 's', after: 'l', anchor: 'start', offset: 250, duration: 1100, scale: 1 }),
  impact('Scorch', ['impact.fire.01.orange'], { after: 's', anchor: 'start', offset: 300, duration: 1200, scale: 0.8 }),
  motion('recoil', 'targets', { after: 's', anchor: 'start', offset: 300, duration: 600 }),
]);

const flameStrike = design('A vertical column of divine fire roars down from above onto the cylinder.', () => [
  cast('Divine call', HOLY, { stageId: 'c', scale: 0.8, duration: 1100 }),
  area('Column of fire descends', ['sacred_flame.target.yellow'], { stageId: 'col', after: 'c', anchor: 'start', offset: 500, duration: 2000, ...tint('#ff9a3c') }),
  area('Flames erupt', ['fireball.explosion.orange'], { after: 'col', anchor: 'start', offset: 700, duration: 2000 }),
  motion('recoil', 'targets', { after: 'col', anchor: 'start', offset: 800, duration: 700 }),
]);

const flamingSphereSummon = design('A 5-foot sphere of fire appears in the chosen space.', () => [
  cast('Fire gathers', ['cast_generic.fire.01.orange'], { stageId: 'c', scale: 0.7, duration: 900 }),
  area('Flaming sphere', ['flaming_sphere.200px.orange.01'], { after: 'c', anchor: 'start', offset: 400, duration: 3000, fadeIn: 300, fadeOut: 500 }),
]);

const flamingSphereRam = design('The flaming sphere rolls into the creature and scorches it.', () => [
  impact('Sphere rolls in', ['flaming_sphere.200px.orange.02'], { stageId: 's', duration: 1600, scale: 0.9 }),
  impact('Scorch', ['impact.fire.01.orange'], { after: 's', anchor: 'start', offset: 700, duration: 1200, scale: 0.9 }),
  motion('recoil', 'targets', { after: 's', anchor: 'start', offset: 750, duration: 600 }),
]);

const fleshToStone = design('Stone creeps inward over the target and stiffens its body as it fights the petrification.', () => [
  cast('Earth gathers', ['cast_generic.earth.01.browngreen'], { stageId: 'c', scale: 0.8, duration: 1000 }),
  aura('Stone creeps in', ['aura_themed.01.inward.complete.metal.01.grey'], { subject: 'targets', stageId: 's', after: 'c', anchor: 'start', offset: 500, duration: 2400, scale: 1.1, fadeOut: 500 }),
  impact('Grit and dust', ['smoke.puff.centered.grey'], { after: 's', anchor: 'start', offset: 900, duration: 1500, scale: 0.8 }),
  motion('press', 'targets', { after: 's', anchor: 'start', offset: 500, duration: 1000, intensity: 0.6 }),
]);

const fly = design('Feathers swirl around the touched creature as it lifts into flight.', () => [
  cast('Wind gathers', ['swirling_feathers.outburst.01.purple', 'swirling_feathers.outburst.01.textured'], { stageId: 'c', scale: 0.8, duration: 1200 }),
  aura('Lifting feathers', ['swirling_feathers.outburst.01.purple', 'swirling_feathers.outburst.01.textured'], { subject: 'targets', stageId: 'f', after: 'c', anchor: 'start', offset: 500, duration: 2000, scale: 1.2 }),
  motion('levitate', 'targets', { after: 'f', anchor: 'start', offset: 300, duration: 2400 }),
]);

const forcecage = design('A cube-shaped prison of invisible force springs into existence around the area.', () => [
  sigil('Evocation sigil', EVO),
  area('Cage of force', ['wall_of_force.horizontal.blue', 'wall_of_force.horizontal.grey'], { after: 'sig', anchor: 'start', offset: 500, duration: 3500, opacity: 0.8, fadeIn: 300, fadeOut: 700 }),
]);

const freezingSphere = design('A frigid globe streaks to the chosen point and explodes in a 60-foot burst of ice.', () => [
  cast('Cold gathers', ['cast_generic.ice.01.blue', 'cast_generic.02.blue'], { stageId: 'c', scale: 0.8, duration: 1000 }),
  travel('Frigid globe', ['spell_projectile.ice_shard.blue'], { stageId: 'g', after: 'c', anchor: 'start', offset: 500, duration: 1100, travelDestination: 'area' }),
  area('Ice explodes', ['ice_spikes.radial.burst.blue', 'ice_spikes.radial.burst.white'], { after: 'g', anchor: 'end', duration: 2400 }),
  motion('recoil', 'targets', { after: 'g', anchor: 'end', offset: 200, duration: 700 }),
]);

const gaseous = design('The touched creature dissolves into a drifting misty cloud.', () => [
  sigil('Transmutation sigil', TRANS),
  aura('Misty cloud', ['fog_cloud.01.white'], { subject: 'targets', stageId: 'm', after: 'sig', anchor: 'start', offset: 500, duration: 2600, scale: 0.7, opacity: 0.8, fadeIn: 400, fadeOut: 600 }),
  motion('drift', 'targets', { after: 'm', anchor: 'start', offset: 300, duration: 2000 }),
], { sound: 'wind' });

const gateVertical = design('A circular portal opens upright at the chosen point, linking to another plane.', () => [
  sigil('Conjuration sigil', CONJ),
  area('Planar gate', ['portals.vertical.ring.purple', 'portals.vertical.ring.bright_yellow'], { after: 'sig', anchor: 'start', offset: 500, duration: 4000, fadeIn: 400, fadeOut: 600 }),
]);

const gateHorizontal = design('A circular portal opens flat at the chosen point, linking to another plane.', () => [
  sigil('Conjuration sigil', CONJ),
  area('Planar gate', ['portals.horizontal.ring.purple', 'portals.horizontal.ring.bright_yellow'], { after: 'sig', anchor: 'start', offset: 500, duration: 4000, fadeIn: 400, fadeOut: 600 }),
]);

const gentleRepose = design('A quiet necromantic ward settles over the touched remains, halting decay.', () => [
  sigil('Necromantic sigil', NECRO, { scale: 0.7 }),
  aura('Preserving ward', NECRO, { subject: 'targets', stageId: 'w', after: 'sig', anchor: 'start', offset: 400, duration: 2400, scale: 1, below: true, fadeIn: 300, fadeOut: 600 }),
  impact('Stillness', ['glint.purple.few', 'glint.yellow.few'], { after: 'w', anchor: 'start', offset: 600, duration: 1500, scale: 0.8 }),
], { sound: null });

const globe = design('An immobile, shimmering globe springs up around the caster across the 10-foot emanation.', () => [
  sigil('Abjuration sigil', ABJ),
  area('Shimmering globe', ['wall_of_force.sphere.blue', 'wall_of_force.sphere.grey'], { after: 'sig', anchor: 'start', offset: 500, duration: 3500, opacity: 0.8, fadeIn: 400, fadeOut: 700 }),
  motion('brace', 'source', { after: 'sig', anchor: 'start', offset: 500, duration: 900 }),
]);

const greaseSave = design('The creature slips and flounders in the slick grease.', () => [
  impact('Slick grease', ['grease.dark_brown.loop'], { stageId: 'g', duration: 1800, scale: 1.1, below: true, fadeIn: 200, fadeOut: 500 }),
  motion('stagger', 'targets', { after: 'g', anchor: 'start', offset: 200, duration: 900 }),
]);

const guardianSummon = design('A Large spectral guardian wielding a halberd materializes in radiant light.', () => [
  cast('Prayer', HOLY, { stageId: 'c', scale: 0.8, duration: 1200 }),
  aura('Radiant arrival', ['sacred_flame.source.yellow'], { subject: 'targets', stageId: 'a', after: 'c', anchor: 'start', offset: 500, duration: 1600, scale: 1.2 }),
  aura('Spectral guardian', ['spiritual_weapon.halberd.01.spectral.02.orange', 'spiritual_weapon.halberd.01.spectral.02.green'], { subject: 'targets', after: 'a', anchor: 'start', offset: 600, duration: 3000, scale: 1.5, fadeIn: 400, fadeOut: 600 }),
], { sound: 'holy' });

const guardianStrike = design('The spectral guardian sweeps its halberd at the approaching enemy in a flash of radiance.', () => [
  impact('Halberd sweep', ['spiritual_weapon.halberd.01.spectral.02.orange', 'spiritual_weapon.halberd.01.spectral.02.green'], { stageId: 'h', duration: 1600, scale: 1.2, offsetX: -0.4, offsetUnits: 'token', fadeIn: 150, fadeOut: 300 }),
  impact('Radiant strike', ['sacred_flame.target.yellow'], { after: 'h', anchor: 'start', offset: 700, duration: 1600, scale: 0.9 }),
  motion('stagger', 'targets', { after: 'h', anchor: 'start', offset: 800, duration: 700 }),
], { sound: 'holy' });

const harm = design('Virulent necromantic sickness floods the target, draining its life.', () => [
  sigil('Necromantic sigil', NECRO),
  impact('Virulent sickness', ['fumes.04.complete.purple', 'fumes.04.complete.grey'], { stageId: 'f', after: 'sig', anchor: 'start', offset: 500, duration: 2000, scale: 1 }),
  impact('Life drained', ['toll_the_dead.purple.skull_smoke', 'toll_the_dead.green.skull_smoke'], { after: 'f', anchor: 'start', offset: 500, duration: 1800, scale: 0.8 }),
  motion('stagger', 'targets', { after: 'f', anchor: 'start', offset: 500, duration: 900 }),
], { sound: 'drain' });

const heatMetalCast = design('The chosen metal object glows red-hot and burns whoever holds or wears it.', () => [
  cast('Heat gathers', ['cast_generic.fire.01.orange'], { stageId: 'c', scale: 0.7, duration: 900 }),
  aura('Red-hot metal', ['flames.02.orange'], { subject: 'targets', stageId: 'h', after: 'c', anchor: 'start', offset: 400, duration: 2200, scale: 0.7, opacity: 0.85, fadeIn: 300, fadeOut: 500, ...tint('#ff4a1c') }),
  motion('shake', 'targets', { after: 'h', anchor: 'start', offset: 300, duration: 900, intensity: 0.6 }),
], { sound: 'fireIgnition' });

const heatMetalTick = design('The red-hot metal sears the creature again.', () => [
  aura('Red-hot metal', ['flames.02.orange'], { subject: 'targets', stageId: 'h', duration: 1800, scale: 0.7, opacity: 0.85, fadeIn: 200, fadeOut: 500, ...tint('#ff4a1c') }),
  motion('shake', 'targets', { after: 'h', anchor: 'start', offset: 200, duration: 800, intensity: 0.6 }),
], { sound: 'fireIgnition' });

const heroism = design('An enchantment of bravery surges through the touched creature.', () => [
  sigil('Enchantment sigil', ENCH),
  aura('Bravery', ['condition.boon.01.014.yellow', 'condition.boon.01.014.green'], { subject: 'targets', stageId: 'b', after: 'sig', anchor: 'start', offset: 500, duration: 2400, scale: 1, fadeIn: 300, fadeOut: 500 }),
  motion('pulse', 'targets', { after: 'b', anchor: 'start', offset: 300, duration: 800, intensity: 0.5 }),
], { sound: 'bless' });

const hold = design('Spectral chains of enchantment wrap the target, trying to hold it paralyzed.', () => [
  sigil('Enchantment sigil', ENCH),
  aura('Spectral chains', ['markers.chain.spectral_standard.complete.02.purple', 'markers.chain.spectral_standard.complete.02.blue'], { subject: 'targets', stageId: 'h', after: 'sig', anchor: 'start', offset: 500, duration: 2600, scale: 1, fadeOut: 500 }),
  motion('press', 'targets', { after: 'h', anchor: 'start', offset: 500, duration: 1000, intensity: 0.5 }),
], { sound: 'chainBinding' });

const huntersMark = design('A hunter\'s mark pulses over the chosen quarry.', () => [
  aura('Quarry marked', ['hunters_mark.pulse.01.green'], { subject: 'targets', duration: 2200, scale: 1 }),
], { sound: 'detect' });

const huntersMarkHit = design('The mark flares as the hunter\'s attack bites into the quarry.', () => [
  impact('Mark flares', ['hunters_mark.pulse.01.green'], { stageId: 'm', duration: 1500, scale: 0.8 }),
  motion('recoil', 'targets', { after: 'm', anchor: 'start', offset: 150, duration: 500, intensity: 0.6 }),
]);

const aid = design('Bolstering light rises over up to three allies, raising their toughness.', () => [
  cast('Resolve gathers', ['cast_generic.01.yellow'], { stageId: 'c', scale: 0.8, duration: 1000 }),
  impact('Bolstered', ['healing_generic.burst.yellowwhite', 'healing_generic.burst.greenorange'], { stageId: 'b', after: 'c', anchor: 'start', offset: 500, duration: 1800, scale: 1 }),
  motion('pulse', 'targets', { after: 'b', anchor: 'start', offset: 300, duration: 800, intensity: 0.5 }),
]);

const alterSelf = (why, asset, scale = 1) => design(why, () => [
  sigil('Transmutation sigil', TRANS),
  aura('Form shifts', asset, { stageId: 'f', after: 'sig', anchor: 'start', offset: 500, duration: 2000, scale, fadeIn: 200, fadeOut: 500 }),
  motion('pulse', 'source', { after: 'f', anchor: 'start', offset: 200, duration: 900, intensity: 0.6 }),
]);

const naturalAttack = (why, asset, sound) => design(why, () => [
  motion('lunge', 'source', { stageId: 'l', duration: 700 }),
  impact('Natural weapon strikes', asset, { stageId: 'h', after: 'l', anchor: 'start', offset: 250, duration: 1200, scale: 1 }),
  motion('recoil', 'targets', { after: 'h', anchor: 'start', offset: 250, duration: 600 }),
], { sound, soundNamespace: 'ability' });

const animalShapes = design('Nature magic swirls over each willing creature as it shape-shifts into a beast.', () => [
  cast('Nature gathers', ['swirling_leaves.complete.01.green'], { stageId: 'c', scale: 0.8, duration: 1200 }),
  impact('Shape-shift', ['smoke.puff.centered.green', 'smoke.puff.centered.grey'], { stageId: 's', after: 'c', anchor: 'start', offset: 500, duration: 1600, scale: 1.1 }),
  aura('Wild leaves', ['swirling_leaves.complete.02.green'], { subject: 'targets', after: 's', anchor: 'start', offset: 300, duration: 1800, scale: 1, fadeOut: 400 }),
  motion('pulse', 'targets', { after: 's', anchor: 'start', offset: 200, duration: 900, intensity: 0.7 }),
]);

const animateObjects = design('Transmutation runes burst over the chosen objects and they jolt to life.', () => [
  sigil('Transmutation sigil', TRANS),
  impact('Objects awaken', ['particle_burst.01.rune.yellow', 'particle_burst.01.rune.bluepurple'], { stageId: 'a', after: 'sig', anchor: 'start', offset: 500, duration: 1500, scale: 1 }),
  motion('shake', 'targets', { after: 'a', anchor: 'start', offset: 300, duration: 800, intensity: 0.7 }),
]);

const acidSplash2014 = design('A bubble of acid is hurled at one or two creatures and bursts over them.', () => [
  cast('Acid gathers', ['cast_generic.02.green', 'cast_generic.water.02.blue'], { stageId: 'c', scale: 0.7, duration: 800 }),
  motion('throw', 'source', { after: 'c', anchor: 'start', offset: 300, duration: 600 }),
  projectile('Acid bubble', ['liquid.blob.green', 'liquid.blob.blue'], { stageId: 'b', after: 'c', anchor: 'start', offset: 450, duration: 900, scale: 0.45 }),
  impact('Acid bursts', ['liquid.splash.bright_green', 'liquid.splash.blue'], { after: 'b', anchor: 'end', duration: 1500, scale: 1 }),
  motion('recoil', 'targets', { after: 'b', anchor: 'end', duration: 600 }),
]);

const acidSplash2024 = design('An acidic bubble flies to the chosen point and explodes across the 5-foot sphere.', () => [
  cast('Acid gathers', ['cast_generic.02.green', 'cast_generic.water.02.blue'], { stageId: 'c', scale: 0.7, duration: 800 }),
  motion('throw', 'source', { after: 'c', anchor: 'start', offset: 300, duration: 600 }),
  travel('Acid bubble', ['spell_projectile.poison.greenyellow', 'liquid.blob.blue'], { stageId: 'b', after: 'c', anchor: 'start', offset: 450, duration: 900, travelDestination: 'area' }),
  area('Acid explodes', ['liquid.splash.bright_green', 'liquid.splash.blue'], { after: 'b', anchor: 'end', duration: 1500 }),
  motion('recoil', 'targets', { after: 'b', anchor: 'end', offset: 100, duration: 600 }),
]);

const vigorCast = design('The caster draws on their own life force; healing light wells up around them.', () => [
  cast('Life force gathers', ['cast_generic.02.green', 'healing_generic.200px.green'], { stageId: 'c', scale: 0.8, duration: 1000 }),
  aura('Vigor returns', ['healing_generic.loop.greenorange'], { after: 'c', anchor: 'start', offset: 500, duration: 2200, scale: 1, fadeOut: 500 }),
  motion('pulse', 'source', { after: 'c', anchor: 'start', offset: 700, duration: 800, intensity: 0.4 }),
], { sound: 'healing' });

export default {
  // Acid Splash
  'dnd5e:dnd5e-spells-JLTQyqXEaJDrTXyW': acidSplash2014,
  'dnd5e:dnd5e-spells24-phbsplAcidSplash': acidSplash2024,
  // Aid
  'dnd5e:dnd5e-spells-Opwh2PdX4runSBlm': aid,
  'dnd5e:dnd5e-spells24-phbsplAid0000000': aid,
  // Alter Self
  'dnd5e:dnd5e-spells-8RTDOt80u8aBv9qx': alterSelf('Transmutation reshapes the caster\'s body in a puff of shifting form.', ['smoke.puff.centered.green', 'smoke.puff.centered.grey']),
  'dnd5e:dnd5e-spells24-phbsplAlterSelf0:dnd5eactivity000': alterSelf('The caster sprouts gills and webbing; water bubbles around them.', ['bubble.001.001.complete.blue']),
  'dnd5e:dnd5e-spells24-phbsplAlterSelf0:wQGpfux8qzcvwsDo': alterSelf('The caster\'s appearance shimmers and changes.', ['shimmer.01.purple', 'shimmer.01.blue']),
  'dnd5e:dnd5e-spells24-phbsplAlterSelf0:dQnMvyjoGqhgl9wP': alterSelf('Claws, fangs, horns or hooves grow out as natural weapons.', ['claws.200px.dark_red', 'claws.200px.red'], 0.8),
  'dnd5e:dnd5e-spells24-phbsplAlterSelf0:SEwXqOHdPCyejSYR': naturalAttack('The caster rakes the target with grown claws.', ['claws.200px.dark_red', 'claws.200px.red'], 'claw'),
  'dnd5e:dnd5e-spells24-phbsplAlterSelf0:osceJQzUOQPJ9CLn': naturalAttack('The caster bites or gores the target with grown fangs or horns.', ['bite.200px.red'], 'naturalPierce'),
  'dnd5e:dnd5e-spells24-phbsplAlterSelf0:eHtpASAnamFUc69H': naturalAttack('The caster kicks the target with grown hooves.', ['melee_generic.creature_attack.fist.001.red'], 'kick'),
  // Animal Shapes
  'dnd5e:dnd5e-spells-ohqAIBg6de989CIo:dnd5eactivity000': animalShapes,
  'dnd5e:dnd5e-spells-ohqAIBg6de989CIo:Sb7lnASL8TCju9pO': animalShapes,
  'dnd5e:dnd5e-spells24-phbsplAnimalShap': animalShapes,
  // Animate Dead / Create Undead / Finger of Death zombies
  'dnd5e:dnd5e-spells-oyE5nVppa5mde5gT:slTKkuzJMunnfkAs': raiseUndead,
  'dnd5e:dnd5e-spells-oyE5nVppa5mde5gT:jfnuqBcbOWUzfyTU': commandUndead,
  'dnd5e:dnd5e-spells24-phbsplAnimateDea': raiseUndead,
  'dnd5e:dnd5e-spells-E4NXux0RHvME1XgP:dnd5eactivity000': raiseUndead,
  'dnd5e:dnd5e-spells-E4NXux0RHvME1XgP:3zXKdZYunkVxWMeN': commandUndead,
  'dnd5e:dnd5e-spells24-phbsplCreateUnde:ExyqLKqLhGbaJVVd': raiseUndead,
  'dnd5e:dnd5e-spells24-phbsplCreateUnde:BepVtap2tWyUwaxk': commandUndead,
  'dnd5e:dnd5e-spells24-phbsplCreateUnde:CIv9t4XuVEcgmX9n': commandUndead,
  'dnd5e:dnd5e-spells-HPvZm8YJO91k6Qdg:MCAsmHQ4ZyHKOcIG': raiseUndead,
  'dnd5e:dnd5e-spells24-phbsplFingerofDe:bfoGmw7iFaVObnn6': raiseUndead,
  // Animate Objects
  'dnd5e:dnd5e-spells-ATo0Eb63TDtnu6iA': animateObjects,
  'dnd5e:dnd5e-spells24-phbsplAnimateObj': animateObjects,
  // Antilife Shell
  'dnd5e:dnd5e-spells-wXzkqpeFP8eWgJzK': antilife,
  'dnd5e:dnd5e-spells24-phbsplAntilifeSh': antilife,
  // Arcane Eye / Hand / Sword / Vigor
  'dnd5e:dnd5e-spells-ImlCJQwR1VL40Qem': arcaneEye,
  'dnd5e:dnd5e-spells24-phbsplArcaneEye0': arcaneEye,
  'dnd5e:dnd5e-spells-a2KJHCIbY5Mi4Dmn': arcaneHand,
  'dnd5e:dnd5e-spells24-phbsplBigbysHand': arcaneHand,
  'dnd5e:dnd5e-spells-LTDNWoFVJNLjiiNa:dnd5eactivity000': arcaneSword,
  'dnd5e:dnd5e-spells-LTDNWoFVJNLjiiNa:pK9UiWSr9drFEaEE': arcaneSword,
  'dnd5e:dnd5e-spells24-phbswdMordenkain': arcaneSword,
  'dnd5e:dnd5e-spells24-phbsplArcaneVigo:5paXkJ6hEw07yl8g': vigorCast,
  // Astral Projection
  'dnd5e:dnd5e-spells-TIoadMIsUKD4edXi': astral,
  'dnd5e:dnd5e-spells24-phbsplAstralProj': astral,
  // Bane / Banishment / Barkskin / Beacon of Hope
  'dnd5e:dnd5e-spells-95K2aUhAGV9qXjnf': bane,
  'dnd5e:dnd5e-spells24-phbsplBane000000': bane,
  'dnd5e:dnd5e-spells-pxpb2eOB6bv4phAf': banish,
  'dnd5e:dnd5e-spells24-phbsplBanishment': banish,
  'dnd5e:dnd5e-spells-JPwIEfgUPVebr5AH': barkskin,
  'dnd5e:dnd5e-spells24-phbsplBarkskin00': barkskin,
  'dnd5e:dnd5e-spells-ZU9d6woBdUP8pIPt': beacon,
  'dnd5e:dnd5e-spells24-phbsplBeaconofHo': beacon,
  // Black Tentacles (per-creature save) / Blade Barrier walls
  'dnd5e:dnd5e-spells-DGONTFbk5eORs5qv:dnd5eactivity000': blackTentacleSave,
  'dnd5e:dnd5e-spells-dLJhxDfeyOsc3zsY:mhpt8uRwMGXNYABF': bladeWall,
  'dnd5e:dnd5e-spells24-phbsplBladeBarri:Y0nT1EvDbg7IDovC': bladeWall,
  // Bless / Blight / Blindness
  'dnd5e:dnd5e-spells-8dzaICjGy6mTUaUr': bless,
  'dnd5e:dnd5e-spells24-phbsplBless00000': bless,
  'dnd5e:dnd5e-spells-pybg5MNc3lkerH4Y': blight,
  'dnd5e:dnd5e-spells24-phbsplBlight0000': blight,
  'dnd5e:dnd5e-spells-zwGsAv6kmwzYGhh3': blindness,
  'dnd5e:dnd5e-spells24-phbsplBlindnessD': blindness,
  // Branding Smite
  'dnd5e:dnd5e-spells-7UwUjJ6owIQkEPrs:dnd5eactivity000': brandingHit,
  'dnd5e:dnd5e-spells-7UwUjJ6owIQkEPrs:Ke2wZRoRCFxmiHJb': brandingCast,
  // Chill Touch (2014 ranged)
  'dnd5e:dnd5e-spells-vrN18tbTw7io5MWd': chillTouch2014,
  // Conjure Celestial pillar / Conjure Minor Elementals
  'dnd5e:dnd5e-spells24-phbsplConjureCel:VjKltnyiWXZ0xDGZ': celestialPillar,
  'dnd5e:dnd5e-spells24-phbsplConjureMin:dnd5eactivity000': minorElementalHit,
  'dnd5e:dnd5e-spells24-phbsplConjureMin:VSwMJFQoi3KU3Ais': minorElementals,
  // Contingency / Continual Flame / Counterspell
  'dnd5e:dnd5e-spells-4smlOvpF5AQHcyg1': contingency,
  'dnd5e:dnd5e-spells-MK6gpQMeDFo0cP9f:dnd5eactivity000': continualFlame,
  'dnd5e:dnd5e-spells-MK6gpQMeDFo0cP9f:AHnTfgcTLyMZLPNS': continualFlame,
  'dnd5e:dnd5e-spells24-phbsplContinualF': continualFlame,
  'dnd5e:dnd5e-spells-Ek45cBpVXvJdv1Qy': counterspell,
  'dnd5e:dnd5e-spells24-phbsplCounterspe': counterspell,
  // Darkvision / Delayed Blast Fireball / Demiplane / Dimension Door
  'dnd5e:dnd5e-spells-hJ6ZiA3fpoY8v9cp': darkvision,
  'dnd5e:dnd5e-spells24-phbsplDarkvision': darkvision,
  'dnd5e:dnd5e-spells-AoTTjapz1FsGOIZz': delayedBlast,
  'dnd5e:dnd5e-spells24-phbsplDelayedBla:9yLyrnGNwM8EL6Uy': delayedBead,
  'dnd5e:dnd5e-spells-xNM9CzQQr2CieM4B': demiplane,
  'dnd5e:dnd5e-spells24-phbsplDemiplane0': demiplane,
  'dnd5e:dnd5e-spells-A4RsPuSvB9wFtz1j:sIOWWHVlx6FC1kXH': dimensionDoor,
  'dnd5e:dnd5e-spells24-phbsplDimensionD:hCOnUZIondeOKxE5': dimensionDoor,
  // Dispel Magic / Dissonant Whispers / Divine Favor / Divine Word
  'dnd5e:dnd5e-spells-15Fa6q1nH27XfbR8': dispel,
  'dnd5e:dnd5e-spells24-phbsplDispelMagi': dispel,
  'dnd5e:dnd5e-spells24-phbsplDissonantW': whispers,
  'dnd5e:dnd5e-spells-8MICCMeOXT3aJUy9': divineFavor,
  'dnd5e:dnd5e-spells24-phbsplDivineFavo': divineFavor,
  'dnd5e:dnd5e-spells-T1vpZLam7LezjToj': divineWord,
  'dnd5e:dnd5e-spells24-phbsplDivineWord': divineWord,
  // Eldritch Blast
  'dnd5e:dnd5e-spells-Z9p1vezIn95jw1Yw': eldritch,
  'dnd5e:dnd5e-spells24-phbsplEldritchBl': eldritch,
  // Enhance Ability / Enlarge-Reduce / Ensnaring Strike
  'dnd5e:dnd5e-spells-9eOZDBImVKxbeOyZ': enhance,
  'dnd5e:dnd5e-spells24-phbsplEnhanceAbi': enhance,
  'dnd5e:dnd5e-spells-WahI41a3goVUg0x1': enlarge,
  'dnd5e:dnd5e-spells24-phbsplEnlargeRed': enlarge,
  'dnd5e:dnd5e-spells24-phbsplEnsnaringS:dnd5eactivity000': ensnare,
  // Eyebite
  'dnd5e:dnd5e-spells-ZRqu3Xh9FmlBCZGy:NtvCfReyXVq619Kz': eyebite,
  'dnd5e:dnd5e-spells-ZRqu3Xh9FmlBCZGy:eLnw2b2iYJhBaQIY': eyebite,
  'dnd5e:dnd5e-spells24-phbsplEyebite000:r5eaxtkEdeKOXeHb': eyebite,
  'dnd5e:dnd5e-spells24-phbsplEyebite000:3PZbzzH8sBJl3heA': eyebite,
  // False Life / Finger of Death
  'dnd5e:dnd5e-spells-7e3QXF10hLNDEdr6': falseLife,
  'dnd5e:dnd5e-spells24-phbsplFalseLife0': falseLife,
  'dnd5e:dnd5e-spells-HPvZm8YJO91k6Qdg:dnd5eactivity000': necroticBlast('Negative energy courses from the caster into the target, wracking it with searing pain.'),
  'dnd5e:dnd5e-spells24-phbsplFingerofDe:RQqMYphCIL15Sc46': necroticBlast('Negative energy is unleashed into the target, wracking it with searing pain.'),
  // Fire Storm / Flame Blade / Flame Strike / Flaming Sphere
  'dnd5e:dnd5e-spells-J3uILDYS7MiOfmTJ': fireStorm,
  'dnd5e:dnd5e-spells24-phbsplFireStorm0': fireStorm,
  'dnd5e:dnd5e-spells-Advtckpz1B733bu9:rUOzC7j6wRPm8fpO': flameBladeEvoke,
  'dnd5e:dnd5e-spells-Advtckpz1B733bu9:Wj7GiWyEQQKGdYol': flameBladeEvoke,
  'dnd5e:dnd5e-spells24-phbsplFlameBlade:dnd5eactivity000': flameBladeAttack,
  'dnd5e:dnd5e-spells24-phbsplFlameBlade:OIU1htXAoSF0cU3U': flameBladeEvoke,
  'dnd5e:dnd5e-spells-5e1xTohkzqFqbYH4': flameStrike,
  'dnd5e:dnd5e-spells24-phbsplFlameStrik': flameStrike,
  'dnd5e:dnd5e-spells-FjYE214HTERCRZNm:AdvbemIjfAfOL9OU': flamingSphereSummon,
  'dnd5e:dnd5e-spells-FjYE214HTERCRZNm:Abi8r6ArCkjaIPUs': flamingSphereRam,
  'dnd5e:dnd5e-spells24-phbsplFlamingSph:dnd5eactivity100': flamingSphereRam,
  // Flesh to Stone / Fly / Forcecage / Freezing Sphere
  'dnd5e:dnd5e-spells-kozNy29b0X6exFhY:J3DB2z7n1E9Ey0Qx': fleshToStone,
  'dnd5e:dnd5e-spells-kozNy29b0X6exFhY:ZLjky0SAN3L2Afkr': fleshToStone,
  'dnd5e:dnd5e-spells24-phbsplFleshtoSto': fleshToStone,
  'dnd5e:dnd5e-spells-yfbK8gZqESlaoY5t': fly,
  'dnd5e:dnd5e-spells24-phbsplFly0000000': fly,
  'dnd5e:dnd5e-spells-Y7uWUO4yqUN0JKl0': forcecage,
  'dnd5e:dnd5e-spells24-phbsplForcecage0:gacP7LGiwvQBdnfU': forcecage,
  'dnd5e:dnd5e-spells24-phbsplForcecage0:xhJw5fRtiWP5p0DO': forcecage,
  'dnd5e:dnd5e-spells-MImfWCzEPRMYD3Xp': freezingSphere,
  'dnd5e:dnd5e-spells24-phbsplOtilukesFr:adCBWrctRmLQmb8M': freezingSphere,
  'dnd5e:dnd5e-spells24-phbsplOtilukesFr:NKBsnjBBIgsaOPaY': freezingSphere,
  // Gaseous Form / Gate / Gentle Repose / Globe / Grease
  'dnd5e:dnd5e-spells-2IWiZAJtOGDoKjiz': gaseous,
  'dnd5e:dnd5e-spells24-phbsplGaseousFor': gaseous,
  'dnd5e:dnd5e-spells24-phbsplGate000000:2RkjJD6gPT6nVMUO': gateVertical,
  'dnd5e:dnd5e-spells24-phbsplGate000000:rR2zwuw2IFFRTQhi': gateVertical,
  'dnd5e:dnd5e-spells24-phbsplGate000000:iUhxzsW99W33R6di': gateHorizontal,
  'dnd5e:dnd5e-spells24-phbsplGate000000:B3wsBcXONvUm9pUR': gateHorizontal,
  'dnd5e:dnd5e-spells-n4JDcFKe5ikzYmAc': gentleRepose,
  'dnd5e:dnd5e-spells24-phbsplGentleRepo': gentleRepose,
  'dnd5e:dnd5e-spells-WmQpxfjZwF3MGUby': globe,
  'dnd5e:dnd5e-spells24-phbsplGlobeofInv': globe,
  'dnd5e:dnd5e-spells-etgcR9wqmrhyZ0tx:OiCc4lVFXS0vkFhf': greaseSave,
  // Guardian of Faith
  'dnd5e:dnd5e-spells-TgHsuhNasPbhu8MO:uVCIRuG6Klnsa2wx': guardianSummon,
  'dnd5e:dnd5e-spells-TgHsuhNasPbhu8MO:EWTxq50DDmAOzOFR': guardianStrike,
  'dnd5e:dnd5e-spells24-phbsplGuardianof:dnd5eactivity000': guardianSummon,
  'dnd5e:dnd5e-spells24-phbsplGuardianof:dnd5eactivity100': guardianStrike,
  // Harm / Heat Metal / Heroism
  'dnd5e:dnd5e-spells-tMH6Ivn4GmE1naMj': harm,
  'dnd5e:dnd5e-spells24-phbsplHarm000000': harm,
  'dnd5e:dnd5e-spells-2yHXEcrRbadZDr5M:dnd5eactivity000': heatMetalTick,
  'dnd5e:dnd5e-spells-2yHXEcrRbadZDr5M:xQF2eW8hFVpfT1h0': heatMetalCast,
  'dnd5e:dnd5e-spells-2yHXEcrRbadZDr5M:G2KFLGhU06lqMm12': heatMetalTick,
  'dnd5e:dnd5e-spells24-phbsplHeatMetal0:dnd5eactivity000': heatMetalTick,
  'dnd5e:dnd5e-spells24-phbsplHeatMetal0:2jWlvr2titPfBMEm': heatMetalCast,
  'dnd5e:dnd5e-spells24-phbsplHeatMetal0:YPEmwJHX7g68307N': heatMetalTick,
  'dnd5e:dnd5e-spells-ge3Saet9zPTDyaoL:dnd5eactivity000': heroism,
  'dnd5e:dnd5e-spells-ge3Saet9zPTDyaoL:s8S50epEPffDG1NB': heroism,
  'dnd5e:dnd5e-spells24-phbsplHeroism000': heroism,
  // Hold Monster / Hold Person
  'dnd5e:dnd5e-spells-l9Ju5KE7bbn3WpTm': hold,
  'dnd5e:dnd5e-spells24-phbsplHoldMonste': hold,
  'dnd5e:dnd5e-spells-3Lo9boi7P2ro6QV4': hold,
  'dnd5e:dnd5e-spells24-phbsplHoldPerson': hold,
  // Hunter's Mark
  'dnd5e:dnd5e-spells-0xmXiPiuYws1OGcX:dnd5eactivity000': huntersMarkHit,
  'dnd5e:dnd5e-spells-0xmXiPiuYws1OGcX:B3ZCe8XzV7wJ2YiL': huntersMark,
  'dnd5e:dnd5e-spells24-phbsplHuntersMar:dnd5eactivity000': huntersMarkHit,
  'dnd5e:dnd5e-spells24-phbsplHuntersMar:vxr2JKuQ3jyMDTwb': huntersMark,
};
