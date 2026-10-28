// Bespoke compositions (pf2e-feats-b). Keys: '<system>:<entryId>' or '<system>:<entryId>:<variant|mode>'.
// See scripts/catalogs/bespoke/helpers.mjs and scripts/bespoke.mjs.
import { cast, travel, projectile, impact, area, aura, sprite, motion, tint, spin, breathe, design } from './helpers.mjs';

// Shared art (Patreon first, Free fallback last).
const SLASH = ['melee_generic.slashing.one_handed', 'melee_generic.slash.01.orange'];
const HEAVY = ['melee_generic.slashing.two_handed', 'melee_generic.slash.01.orange'];
const PIERCE = ['melee_generic.piercing.one_handed', 'melee_generic.slash.02.001.blue'];
const BLUNT = ['melee_generic.bludgeoning.two_handed', 'melee_generic.creature_attack.fist.002.blue'];
const FIST = ['unarmed_strike.physical.02.orange', 'unarmed_strike.physical.02.blue'];
const HOLY_HIT = ['divine_smite.target.yellowwhite', 'divine_smite.target.blueyellow'];
const HOLY_SELF = ['divine_smite.caster.yellowwhite', 'divine_smite.caster.blueyellow'];
const FEAR = ['template_circle.symbol.normal.fear.dark_purple'];
const FEAR_ORANGE = ['template_circle.symbol.normal.fear.dark_orange', 'template_circle.symbol.normal.fear.dark_purple'];
const PULSE_PURPLE = ['template_circle.out_pulse.02.burst.purplepink', 'template_circle.out_pulse.02.burst.bluewhite'];
const PULSE_GOLD = ['template_circle.out_pulse.02.burst.yellowwhite', 'template_circle.out_pulse.02.burst.bluewhite'];
const DUST_RING = ['smoke.puff.ring.01.white'];
const RED = '#c4202c';

// Melee strike skeleton: wind-up lunge, contact, then extra layers keyed off 'hit'.
const lungeHit = (label, assets, o = {}) => [
  motion('lunge', 'source', { stageId: 'lunge', duration: 900, intensity: 0.65 }),
  impact(label, assets, { stageId: 'hit', after: 'lunge', anchor: 'start', offset: 380, duration: 1300, ...o }),
];
// Two-handed overhead finisher: gather, lunge, heavy contact, target staggers.
const heavyBlow = (label, assets = HEAVY, o = {}) => [
  motion('pulse', 'source', { stageId: 'gather', duration: 700, intensity: 0.45 }),
  motion('lunge', 'source', { stageId: 'lunge', after: 'gather', anchor: 'end', offset: -150, duration: 950, intensity: 0.8 }),
  impact(label, assets, { stageId: 'hit', after: 'lunge', anchor: 'start', offset: 380, duration: 1400, scale: 1.25, ...o }),
  motion('stagger', 'targets', { after: 'hit', anchor: 'start', offset: 200, duration: 850, intensity: 0.6 }),
];
// Shoves and knockbacks: target slides directly away from the attacker and returns.
const pushAway = (squares, o = {}) => motion('rush', 'targets', { stageId: 'push', after: 'hit', anchor: 'start', offset: 250, duration: 1300, distance: squares, motionRange: 'distance', motionHeading: 'away', intensity: 0.5, ...o });
// Cone breath / sprays aimed at the first target; contacts land on every target.
const cone = (label, assets, o = {}) => travel(label, assets, { stageId: 'cone', targetSelection: 'first', duration: 1800, ...o });
// Fear wave: emanation ring sized to the native radius, fear marks and cowering foes.
const fearWave = (radius, waveAssets, castAssets) => [
  cast('Dread gathers', castAssets, { stageId: 'cast', scale: 0.8, duration: 1000 }),
  aura(`Fear rolls through ${radius} feet`, waveAssets, { stageId: 'wave', after: 'cast', anchor: 'start', offset: 450, duration: 1800, auraRadius: radius, opacity: 0.8, below: true }),
  impact('Fear takes hold', FEAR, { stageId: 'fear', after: 'wave', anchor: 'start', offset: 500, duration: 1500, scale: 0.5, fadeIn: 200, fadeOut: 400 }),
  motion('cower', 'targets', { after: 'fear', anchor: 'start', duration: 1100, intensity: 0.4 }),
];

export default {
  // ---------------------------------------------------------------- strikes
  'pf2e:ogsVovr4LxFVi42V': design("A crushing guardian blow cracks the foe's armor or hide; a cracked-shield sigil marks the opened defenses.", () => [
    ...heavyBlow('Armor-cracking blow'),
    impact('Armor splits open', ['template_circle.symbol.normal.shield_cracked.dark_red', 'template_circle.symbol.normal.shield_cracked.purple'], { after: 'hit', anchor: 'start', offset: 350, duration: 1500, scale: 0.55, fadeIn: 150, fadeOut: 400 }),
  ]),
  'pf2e:X5SZIwtYpx0r9MPx': design('A mythic blow lands and hurls the foe up to 15 feet away, trailing a ring of dust.', () => [
    ...heavyBlow('Forceful mythic blow', BLUNT, { scale: 1.35 }),
    pushAway(3, { duration: 1500 }),
    impact('Dust kicked up by the knockback', DUST_RING, { after: 'push', anchor: 'start', offset: 200, duration: 1200, scale: 0.8, opacity: 0.7 }),
  ]),
  'pf2e:OLa87RacjBfMIVEQ': design('The melee blow carries an extra burst of holy light into the demon (the slaying explosion stays manual).', () => [
    ...lungeHit('Melee blow', SLASH),
    impact('Holy light sears the demon', HOLY_HIT, { after: 'hit', anchor: 'start', offset: 250, duration: 1800, scale: 0.9 }),
    motion('stagger', 'targets', { after: 'hit', anchor: 'start', offset: 350, duration: 800, intensity: 0.5 }),
  ]),
  'pf2e:amPQHO9O86G6AC4P': design('Spell energy charges the weapon, the Spellstrike lands, and the discharge sweeps a 5-foot ring around the target.', () => [
    cast('Spell gathered into the weapon', ['cast_generic.03.purplered', 'cast_generic.03.blue'], { stageId: 'charge', scale: 0.6, duration: 1000 }),
    motion('lunge', 'source', { stageId: 'lunge', after: 'charge', anchor: 'start', offset: 600, duration: 900, intensity: 0.65 }),
    impact('Spellstrike contact', SLASH, { stageId: 'hit', after: 'lunge', anchor: 'start', offset: 380, duration: 1300 }),
    aura('Discharge sweeps adjacent foes', PULSE_PURPLE, { subject: 'targets', targetSelection: 'first', after: 'hit', anchor: 'start', offset: 300, duration: 1500, auraRadius: 5, opacity: 0.85 }),
  ]),
  'pf2e:XPTSCUoA8c4o9RgQ': design('A reactive offensive-boost blow detonates in a small explosive flash to break the foe\'s concentration.', () => [
    ...lungeHit('Boosted reactive Strike', FIST),
    impact('Explosive distraction', ['explosion.01.orange'], { after: 'hit', anchor: 'start', offset: 200, duration: 1200, scale: 0.5 }),
    motion('recoil', 'targets', { after: 'hit', anchor: 'start', offset: 250, duration: 700, intensity: 0.6 }),
  ]),
  'pf2e:yAgFDUU8HfVK4KTy': design('The weapon snags the foe on a hit and drags it 5 feet toward the attacker.', () => [
    ...lungeHit('Snagging Strike', SLASH),
    motion('rush', 'targets', { after: 'hit', anchor: 'start', offset: 250, duration: 1100, distance: 1, motionRange: 'distance', motionHeading: 'toward', intensity: 0.5 }),
  ]),
  'pf2e:7dRLt7NO4AxziQ8T': design('The Strike lands, spirit energy is torn from the target through a thrall conduit, and it flows back to heal the necromancer.', () => [
    ...lungeHit('Draining Strike', SLASH),
    impact('Spirit torn loose', ['energy_strands.in.purple.01', 'energy_strands.in.green'], { stageId: 'tear', after: 'hit', anchor: 'start', offset: 300, duration: 1300, scale: 0.8 }),
    travel('Life flows back to you', ['energy_strands.range.standard.purple'], { stageId: 'flow', travelOrigin: 'target', after: 'tear', anchor: 'start', offset: 400, duration: 1400 }),
    aura('Stolen vitality heals', ['healing_generic.burst.purplepink', 'healing_generic.burst.greenorange'], { after: 'flow', anchor: 'end', offset: -300, duration: 1400, scale: 0.8 }),
  ]),
  'pf2e:HHAGiBYVv8nyUEsd': design('A one-handed weapon is snapped into a two-handed grip for one heavier overhead blow.', () => heavyBlow('Two-handed grip blow')),
  'pf2e:20JPwspLZ0r28Jnf': design('An unarmed Strike jolts the prey with primal electricity, leaving it twitching.', () => [
    ...lungeHit('Unarmed Strike', ['unarmed_strike.physical.02.blue']),
    impact('Primal electric jolt', ['static_electricity.03.blue'], { after: 'hit', anchor: 'start', offset: 200, duration: 1300, scale: 0.9 }),
    motion('shake', 'targets', { after: 'hit', anchor: 'start', offset: 250, duration: 900, intensity: 0.5 }),
  ]),
  'pf2e:3y459uK2qfWtS9q4': design('A two-handed shield bash follows through into a raised shield.', () => [
    ...lungeHit('Shield bash', ['melee_attack.06.shield.01', 'melee_generic.creature_attack.fist.002.blue']),
    aura('Shield raised', ['shield.01.complete.01.white', 'shield.01.complete.01.blue'], { after: 'hit', anchor: 'end', offset: -300, duration: 1600, scale: 1.05 }),
    motion('brace', 'source', { after: 'hit', anchor: 'end', offset: -250, duration: 900, intensity: 0.4 }),
  ], { sound: 'shieldStrike', soundNamespace: 'ability' }),
  'pf2e:Ad0XBuETAkMD6doj': design('The blow forces a flying foe down to the ground; it settles in a ring of dust.', () => [
    ...heavyBlow('Grounding blow', SLASH, { scale: 1.1 }),
    motion('rush', 'targets', { stageId: 'fall', after: 'hit', anchor: 'start', offset: 250, duration: 1200, distance: 0.7, motionRange: 'distance', motionHeading: 'down', intensity: 0.6 }),
    impact('Lands in a puff of dust', DUST_RING, { after: 'fall', anchor: 'start', offset: 450, duration: 1100, scale: 0.7, opacity: 0.7 }),
  ]),
  'pf2e:PAsFP9jcVcHkBoRd': design('A legendary finishing blow, with weight and a gold flare of mythic power at contact.', () => [
    ...heavyBlow('Mythic finishing blow', HEAVY, { scale: 1.35 }),
    impact('Mythic power flares', ['impact.010.orange', 'impact.005.orange'], { after: 'hit', anchor: 'start', offset: 150, duration: 1100, scale: 0.8 }),
  ]),
  'pf2e:5gnBhockV7O32jTR': design('All remaining rage pours into one final swing, a red surge before the heavy blow.', () => [
    aura('Rage burns out', ['energy_strands.complete.dark_red.01', 'energy_strands.complete.blue'], { duration: 1000, scale: 0.9, ...tint(RED) }),
    ...heavyBlow('Furious final blow', HEAVY, { scale: 1.35 }),
  ]),
  'pf2e:CR9NcAIPTT4oWSEy': design('A two-handed smash into the ground: a quake ring around the chosen square trips the adjacent foes.', () => [
    motion('slam', 'source', { stageId: 'slam', duration: 900, intensity: 0.8 }),
    impact('Smash at the chosen square', BLUNT, { stageId: 'hit', targetSelection: 'first', after: 'slam', anchor: 'start', offset: 380, duration: 1300, scale: 1.3 }),
    aura('Ground quakes around the square', ['impact.ground_crack.01.orange'], { subject: 'targets', targetSelection: 'first', after: 'hit', anchor: 'start', offset: 150, duration: 1600, auraRadius: 5, below: true }),
    motion('press', 'targets', { after: 'hit', anchor: 'start', offset: 300, duration: 900, intensity: 0.5 }),
  ], { sound: 'hammer', soundNamespace: 'ability' }),
  'pf2e:Ij6BBPzZvOFZ3prs': design('A shot strikes an off-guard flyer and the target drops toward the ground.', () => [
    travel('Shot', ['arrow.physical.white.01'], { stageId: 'shot', duration: 1300 }),
    impact('Arrival', ['impact.005.orange'], { stageId: 'hit', after: 'shot', anchor: 'end', offset: -150, duration: 1000, scale: 0.8 }),
    motion('recoil', 'source', { duration: 700, intensity: 0.4 }),
    motion('rush', 'targets', { after: 'hit', anchor: 'start', offset: 150, duration: 1200, distance: 0.7, motionRange: 'distance', motionHeading: 'down', intensity: 0.6 }),
  ]),
  'pf2e:0qL4a3CarG1e0pfB': design('The ranged Strike hits hard enough to shove the foe back.', () => [
    travel('Shot', ['arrow.physical.white.01'], { stageId: 'shot', duration: 1300 }),
    impact('Forceful arrival', ['impact.005.orange'], { stageId: 'hit', after: 'shot', anchor: 'end', offset: -150, duration: 1000, scale: 0.9 }),
    motion('recoil', 'source', { duration: 700, intensity: 0.4 }),
    pushAway(1),
  ]),
  'pf2e:uL6q4wtwvuP8I4po': design('A centered unarmed blow sends the target tumbling straight back.', () => [
    motion('pulse', 'source', { stageId: 'center', duration: 600, intensity: 0.3 }),
    motion('lunge', 'source', { stageId: 'lunge', after: 'center', anchor: 'end', offset: -100, duration: 900, intensity: 0.75 }),
    impact('Flinging blow', FIST, { stageId: 'hit', after: 'lunge', anchor: 'start', offset: 380, duration: 1200, scale: 1.2 }),
    pushAway(2, { motion: 'roll' }),
  ]),
  'pf2e:gq1gGsJDLQuQDrhW': design('A charging headbutt drives the foe back 10 feet, then the monk charges in again for a second ram.', () => [
    motion('rush', 'source', { stageId: 'charge1', duration: 1500, distance: 6, motionRange: 'target', intensity: 0.5 }),
    impact('First ramming horn', PIERCE, { stageId: 'hit', delay: 550, duration: 1100 }),
    pushAway(2, { duration: 1200 }),
    motion('rush', 'source', { stageId: 'charge2', after: 'push', anchor: 'start', offset: 600, duration: 1400, distance: 6, motionRange: 'target', intensity: 0.5 }),
    impact('Second ramming horn', PIERCE, { after: 'charge2', anchor: 'start', offset: 500, duration: 1100 }),
  ], { sound: 'unarmed', soundNamespace: 'ability' }),
  'pf2e:gx9QawjDOZSfSBlN': design('A thundering charge ends in a goring horn Strike.', () => [
    sprite('Charge afterimage', { duration: 1200, copies: 2, opacity: 0.5 }),
    motion('rush', 'source', { stageId: 'charge', duration: 2400, distance: 6, motionRange: 'target', intensity: 0.5 }),
    impact('Goring horns', PIERCE, { after: 'charge', anchor: 'start', offset: 900, duration: 1200, scale: 1.1 }),
  ], { sound: 'naturalPierce', soundNamespace: 'ability' }),
  'pf2e:nRjyyDulHnP5OewA': design('A chest-pounding display rattles the foe before a gorilla slam lands.', () => [
    motion('shake', 'source', { stageId: 'pound', duration: 800, intensity: 0.6 }),
    cast('Chest-pound shockwave', ['toll_the_dead.grey.shockwave', 'toll_the_dead.green.shockwave'], { after: 'pound', anchor: 'start', duration: 1000, scale: 0.7, opacity: 0.8 }),
    motion('cower', 'targets', { after: 'pound', anchor: 'start', offset: 300, duration: 800, intensity: 0.3 }),
    motion('lunge', 'source', { stageId: 'lunge', after: 'pound', anchor: 'end', offset: 100, duration: 900, intensity: 0.8 }),
    impact('Gorilla slam', ['melee_generic.creature_attack.fist.002.blue'], { after: 'lunge', anchor: 'start', offset: 380, duration: 1300, scale: 1.2 }),
  ]),
  'pf2e:Tln47zk8F8nswrEI': design('Jaws bite into a helpless creature and its life flows back as temporary vigor.', () => [
    ...lungeHit('Feasting bite', ['bite.200px.red'], { scale: 0.9 }),
    travel('Life drawn from the meal', ['energy_strands.range.standard.dark_red', 'energy_strands.range.standard.purple'], { stageId: 'flow', travelOrigin: 'target', after: 'hit', anchor: 'start', offset: 450, duration: 1300 }),
    aura('Temporary vigor', ['energy_strands.complete.dark_red.01', 'energy_strands.complete.blue'], { after: 'flow', anchor: 'end', offset: -300, duration: 1400, scale: 0.8, ...tint(RED) }),
  ]),

  // ------------------------------------------------------------ ranged / thrown
  'pf2e:K9hM3AdWGbU3VE8L': design('A triple charge of black powder roars out of the barrel; the recoil leaves the gunslinger staggered.', () => [
    cast('Overcharged muzzle blast', ['muzzle_flash.burst.01.yellow', 'explosion.01.orange'], { stageId: 'flash', faceTarget: true, scale: 0.8, duration: 700 }),
    travel('Shot', ['bullet.01.orange'], { stageId: 'shot', after: 'flash', anchor: 'start', offset: 100, duration: 1000 }),
    impact('Devastating impact', ['explosion.01.orange'], { after: 'shot', anchor: 'end', offset: -150, duration: 1100, scale: 0.4 }),
    motion('recoil', 'source', { stageId: 'kick', duration: 800, intensity: 1.2 }),
    motion('shake', 'source', { after: 'kick', anchor: 'end', duration: 900, intensity: 0.4 }),
  ]),
  'pf2e:7UwXNTmPXIXps2sM': design('Striding in, the fighter throws a weapon at the foe mid-charge.', () => [
    motion('rush', 'source', { stageId: 'charge', duration: 2600, distance: 6, motionRange: 'target', intensity: 0.4 }),
    sprite('Charge afterimage', { duration: 1200, copies: 2, opacity: 0.5 }),
    travel('Thrown weapon', ['dagger.throw.01.white'], { stageId: 'throw', after: 'charge', anchor: 'start', offset: 500, duration: 1000 }),
    impact('Thrown weapon contact', ['impact.005.orange'], { after: 'throw', anchor: 'end', offset: -150, duration: 900, scale: 0.7 }),
  ], { sound: 'thrown', soundNamespace: 'ability' }),
  'pf2e:t4022d8ndt8YJPSe': design('The light mortar lobs a shell into a single square for a tight, focused blast.', () => [
    cast('Mortar launch flash', ['muzzle_flash.single.01.yellow', 'explosion.01.orange'], { stageId: 'launch', faceTarget: true, scale: 0.5, duration: 600 }),
    projectile('Mortar shell', ['throwable.launch.cannon_ball.01.black'], { stageId: 'shell', after: 'launch', anchor: 'start', offset: 150, duration: 1300 }),
    impact('Focused blast', ['explosion.01.orange'], { after: 'shell', anchor: 'end', offset: -150, duration: 1300, scale: 0.6 }),
    motion('recoil', 'source', { duration: 700, intensity: 0.6 }),
  ], { sound: 'explosion' }),
  'pf2e:lmo55Y5NS5iZa56o': design('The head is flung at the foe and lets out a bone-chilling wail before returning.', () => [
    motion('throw', 'source', { stageId: 'throw', duration: 800, intensity: 0.6 }),
    projectile('Flung head', ['impact_themed.skull.pinkpurple', 'toll_the_dead.green.skull_smoke'], { stageId: 'head', after: 'throw', anchor: 'start', offset: 250, duration: 1100, scale: 0.45 }),
    impact('Bone-chilling wail', ['toll_the_dead.blue.skull_smoke', 'toll_the_dead.green.skull_smoke'], { stageId: 'wail', after: 'head', anchor: 'end', offset: -150, duration: 1600, scale: 0.9 }),
    motion('cower', 'targets', { after: 'wail', anchor: 'start', offset: 200, duration: 1100, intensity: 0.4 }),
  ], { sound: 'wail', soundNamespace: 'ability' }),

  // ---------------------------------------------------------------- breaths / cones / lines
  'pf2e:cHOALlKY1XsCj3Fe': design('The dragon-breath cone pours out without spending focus, washing over the creatures in it.', () => [
    cast('Breath drawn in', ['cast_generic.03.purplered', 'cast_generic.03.blue'], { stageId: 'inhale', scale: 0.7, duration: 800 }),
    cone('Dragon breath cone', ['breath_weapons02.burst.cone.arcana.purple.01', 'breath_weapons02.burst.cone.fire.orange'], { after: 'inhale', anchor: 'start', offset: 450 }),
    impact('Breath engulfs', ['explosion.04.dark_purple', 'explosion.01.orange'], { after: 'cone', anchor: 'start', offset: 700, duration: 1200, scale: 0.5 }),
    motion('recoil', 'targets', { after: 'cone', anchor: 'start', offset: 750, duration: 700, intensity: 0.4 }),
  ], { sound: 'dragonRoar' }),
  'pf2e:3uavnVbCsqTvzpgt': design('The raging barbarian exhales a 30-foot cone of draconic energy.', () => [
    motion('pulse', 'source', { stageId: 'inhale', duration: 700, intensity: 0.4 }),
    cone('Raging breath cone', ['breath_weapons02.burst.cone.arcana.purple.01', 'breath_weapons02.burst.cone.fire.orange'], { after: 'inhale', anchor: 'start', offset: 400, duration: 2000, scale: 1.1 }),
    impact('Breath engulfs', ['explosion.04.dark_purple', 'explosion.01.orange'], { after: 'cone', anchor: 'start', offset: 750, duration: 1200, scale: 0.5 }),
    motion('recoil', 'targets', { after: 'cone', anchor: 'start', offset: 800, duration: 700, intensity: 0.4 }),
  ], { sound: 'dragonRoar' }),
  'pf2e:RaqjaXp2miOq4Bis': design('A small dragonet breath of gas, mist or spittle sprays over the nearby creatures.', () => [
    cone('Dragonet breath', ['breath_weapons.poison.cone.purple', 'breath_weapons.poison.cone.green'], { duration: 1600, scale: 0.8 }),
    impact('Breath lingers on targets', ['fumes.04.complete.purple', 'fumes.04.complete.grey'], { after: 'cone', anchor: 'start', offset: 650, duration: 1300, scale: 0.6, opacity: 0.8 }),
  ], { sound: 'poison' }),
  'pf2e:fMIHi9AuwZF7DufT': design('Spectral claws lash out in a 15-foot cone, raking each creature caught in it.', () => [
    cast('Draconic gift flares', ['cast_generic.03.purplered', 'cast_generic.03.blue'], { stageId: 'gift', scale: 0.6, duration: 800 }),
    cone('Spectral claw sweep', ['breath_weapons02.burst.cone.arcana.purple.01', 'breath_weapons02.burst.cone.fire.orange'], { after: 'gift', anchor: 'start', offset: 400, duration: 1500, opacity: 0.6, scale: 0.8 }),
    impact('Spectral claws rake', ['claws.200px.bright_purple', 'claws.200px.red'], { after: 'cone', anchor: 'start', offset: 500, duration: 1100, scale: 0.8 }),
    motion('recoil', 'targets', { after: 'cone', anchor: 'start', offset: 600, duration: 700, intensity: 0.4 }),
  ], { sound: 'claws' }),
  'pf2e:IaV9Ao4twLNblaSq': design('A fusillade of jagged wooden splinters fans out over a 30-foot cone and pierces everyone in it.', () => [
    cast('Wood gathers', ['swirling_leaves.outburst.01.greenorange', 'swirling_leaves.outburst.01.pink'], { stageId: 'gather', scale: 0.7, duration: 900 }),
    cone('Splinter fusillade', ['volley_of_projectiles_ConePF2e.arrow.001.001.greenyellow', 'swirling_leaves.ranged.greenorange'], { after: 'gather', anchor: 'start', offset: 450, duration: 1600, ...tint('#9a6a3a') }),
    impact('Splinters pierce', PIERCE, { after: 'cone', anchor: 'start', offset: 600, duration: 1000, scale: 0.6 }),
    impact('Bleeding wounds', ['liquid.splash_side02.red'], { after: 'cone', anchor: 'start', offset: 800, duration: 1000, scale: 0.4 }),
  ], { sound: 'pierce' }),
  'pf2e:efx6ZCDilI1ixyAM': design('A 20-foot jet of water from the mouth blasts creatures back along the line.', () => [
    cone('Water geyser', ['breath_weapons.acid.line.blue', 'breath_weapons.acid.line.green'], { duration: 1500, ...tint('#4aa8ff') }),
    impact('Water slams in', ['impact.water.02.blue'], { stageId: 'hit', after: 'cone', anchor: 'start', offset: 500, duration: 1100, scale: 0.8 }),
    pushAway(2),
  ]),
  'pf2e:Sav50NxWdLnbaDWQ': design('Heavy wing beats whip up a line of gust that buffets creatures back.', () => [
    cast('Wing beats', ['swirling_feathers.outburst.01.textured'], { stageId: 'wings', scale: 0.9, duration: 1000 }),
    cone('Ferocious gust', ['gust_of_wind.default'], { after: 'wings', anchor: 'start', offset: 400, duration: 1800 }),
    motion('rush', 'targets', { stageId: 'hit', after: 'cone', anchor: 'start', offset: 600, duration: 1200, distance: 1, motionRange: 'distance', motionHeading: 'away', intensity: 0.5 }),
  ]),
  'pf2e:ix1fhe9ttnvFLgmi': design('Vitality blazes ahead in a cone while void energy leaks out behind, the exemplar caught between life and death.', () => [
    aura('Void at your back', ['energy_strands.complete.dark_purple.01', 'energy_strands.complete.blue'], { stageId: 'void', duration: 1600, scale: 1, below: true }),
    cone('Vitality cone ahead', ['breath_weapons02.burst.cone.holy.yellow.01', 'breath_weapons02.burst.cone.fire.orange'], { after: 'void', anchor: 'start', offset: 300, duration: 1600 }),
    impact('Vitality sears', ['healing_generic.burst.yellowwhite', 'healing_generic.burst.greenorange'], { after: 'cone', anchor: 'start', offset: 600, duration: 1200, scale: 0.6 }),
  ]),
  'pf2e:MrBHGo9nmzcVii3k': design('Moisture is wrenched out of the creatures in front of you and flows back into your mouth to heal you.', () => [
    impact('Moisture torn away', ['fumes.steam.white'], { stageId: 'steam', duration: 1400, scale: 0.8 }),
    impact('Void desiccation', ['energy_strands.in.purple.01', 'energy_strands.in.green'], { after: 'steam', anchor: 'start', offset: 150, duration: 1300, scale: 0.7 }),
    projectile('Drawn moisture flies to you', ['liquid.blob.blue'], { stageId: 'flow', travelOrigin: 'target', after: 'steam', anchor: 'start', offset: 400, duration: 1200, scale: 0.35 }),
    aura('Stolen moisture heals', ['energy_field.02.above.purple', 'energy_field.02.above.blue'], { after: 'flow', anchor: 'end', offset: -150, duration: 1400, scale: 0.8 }),
    motion('cower', 'targets', { after: 'steam', anchor: 'start', offset: 200, duration: 900, intensity: 0.3 }),
  ], { sound: 'drain' }),

  // ---------------------------------------------------------------- emanations / bursts
  'pf2e:u2gev0bUzDKwtpmI': design('On the verge of death you pulse void through a 60-foot emanation and draw the stolen life back into yourself.', () => [
    cast('Death-door gasp', ['energy_strands.complete.dark_purple.01', 'energy_strands.complete.blue'], { stageId: 'gasp', scale: 0.9, duration: 1000 }),
    aura('Void pulse fills the emanation', PULSE_PURPLE, { stageId: 'wave', after: 'gasp', anchor: 'start', offset: 400, duration: 1800, auraRadius: 60, opacity: 0.6, below: true }),
    impact('Life torn loose', ['energy_strands.in.purple.01', 'energy_strands.in.green'], { stageId: 'tear', after: 'wave', anchor: 'start', offset: 400, duration: 1300, scale: 0.7 }),
    travel('Life drawn back to you', ['energy_strands.range.standard.dark_purple', 'energy_strands.range.standard.purple'], { stageId: 'flow', travelOrigin: 'target', after: 'tear', anchor: 'start', offset: 300, duration: 1300 }),
    aura('Clinging to life', ['energy_field.02.above.purple', 'energy_field.02.above.blue'], { after: 'flow', anchor: 'end', offset: -300, duration: 1500, scale: 0.9 }),
  ], { sound: 'drain' }),
  'pf2e:HX12ulixkeYeWZUU': design('The god-destroyer within erupts as a 10-foot force emanation that crushes creatures toward the ground.', () => [
    cast('Dominion awakens', ['cast_shape.circle.01.purple', 'cast_shape.circle.01.blue'], { stageId: 'cast', duration: 900 }),
    aura('Force erupts through the emanation', PULSE_PURPLE, { stageId: 'wave', after: 'cast', anchor: 'start', offset: 400, duration: 1800, auraRadius: 10, opacity: 0.9 }),
    impact('Force slams', ['explosion.04.dark_purple', 'explosion.02.blue'], { stageId: 'hit', after: 'wave', anchor: 'start', offset: 300, duration: 1200, scale: 0.6 }),
    motion('press', 'targets', { after: 'hit', anchor: 'start', duration: 900, intensity: 0.5 }),
  ]),
  'pf2e:uHYQ0F7FzeMDNrAD': design('Roiling elemental rage detonates in a 15-foot emanation around the barbarian.', () => [
    motion('shake', 'source', { stageId: 'build', duration: 700, intensity: 0.5 }),
    aura('Elemental explosion', ['explosion.08.orange', 'explosion.01.orange'], { stageId: 'blast', after: 'build', anchor: 'end', offset: -200, duration: 1600, auraRadius: 15 }),
    impact('Caught in the blast', ['impact.005.orange'], { after: 'blast', anchor: 'start', offset: 300, duration: 1000, scale: 0.7 }),
    motion('recoil', 'targets', { after: 'blast', anchor: 'start', offset: 350, duration: 700, intensity: 0.5 }),
  ], { sound: 'explosion' }),
  'pf2e:VAxtUenSWEBWYBRt': design('A terrible wail rolls through a 20-foot emanation and tears at the spirits of living creatures.', () => [
    cast('Terrible wail', ['soundwave.02.purple', 'soundwave.02.blue'], { stageId: 'wail', scale: 0.9, duration: 1000 }),
    aura('Wail fills 20 feet', ['toll_the_dead.purple.shockwave', 'toll_the_dead.green.shockwave'], { stageId: 'wave', after: 'wail', anchor: 'start', offset: 300, duration: 1800, auraRadius: 20, opacity: 0.85 }),
    impact('Spirit torn', ['energy_strands.in.purple.01', 'energy_strands.in.green'], { after: 'wave', anchor: 'start', offset: 450, duration: 1300, scale: 0.7 }),
    motion('cower', 'targets', { after: 'wave', anchor: 'start', offset: 500, duration: 1000, intensity: 0.4 }),
  ], { sound: 'wail', soundNamespace: 'ability' }),
  'pf2e:J7b0h6t09kS5e0R4': design('The spectral dragon bursts apart in a 10-foot explosion of draconic energy.', () => [
    cast('Spectral dragon bursts', ['explosion.03.purplepink', 'explosion.03.blueyellow'], { stageId: 'burst', scale: 1.1, duration: 1300 }),
    impact('Caught in the overflow', ['explosion.04.dark_purple', 'explosion.02.blue'], { stageId: 'hit', after: 'burst', anchor: 'start', offset: 350, duration: 1200, scale: 0.6 }),
    motion('recoil', 'targets', { after: 'hit', anchor: 'start', duration: 700, intensity: 0.5 }),
  ], { sound: 'explosion' }),
  'pf2e:fxkByzNBsYOcyYp8': design('Wings snap open and razor feathers scatter through a 15-foot emanation, slashing everyone nearby.', () => [
    motion('pulse', 'source', { stageId: 'snap', duration: 600, intensity: 0.5 }),
    aura('Feathers scatter outward', ['swirling_feathers.outburst.01.textured'], { stageId: 'burst', after: 'snap', anchor: 'start', offset: 200, duration: 1600, auraRadius: 15 }),
    impact('Feather cuts', SLASH, { after: 'burst', anchor: 'start', offset: 450, duration: 1000, scale: 0.6 }),
    motion('recoil', 'targets', { after: 'burst', anchor: 'start', offset: 500, duration: 700, intensity: 0.4 }),
  ], { sound: 'slash' }),
  'pf2e:oOicdaf3WvT1i5ft': design('An ear-piercing screech blasts a 10-foot emanation, then the kobold scurries away.', () => [
    cast('Screech', ['soundwave.02.orangeyellow', 'soundwave.02.blue'], { stageId: 'shriek', scale: 0.9, duration: 900 }),
    aura('Sonic blast fills 10 feet', ['thunderwave.center.orange', 'thunderwave.center.blue'], { stageId: 'wave', after: 'shriek', anchor: 'start', offset: 200, duration: 1400, auraRadius: 10 }),
    motion('shake', 'targets', { after: 'wave', anchor: 'start', offset: 300, duration: 800, intensity: 0.5 }),
    motion('rush', 'source', { after: 'wave', anchor: 'end', offset: -300, duration: 1800, distance: 3, motionRange: 'distance', motionHeading: 'away', intensity: 0.5 }),
  ]),
  'pf2e:SELSj1vvVLx5cP72': design('A dragon bellow rolls through a 15-foot emanation; frightened enemies cower.', () => fearWave(15, ['toll_the_dead.red.shockwave', 'toll_the_dead.green.shockwave'], ['soundwave.02.red', 'soundwave.02.blue'])),
  'pf2e:xUaEpnfd1FMGNG1z': design('A ghostly lament washes through a 30-foot emanation, frightening the living.', () => fearWave(30, ['toll_the_dead.blue.shockwave', 'toll_the_dead.green.shockwave'], ['toll_the_dead.blue.skull_smoke', 'toll_the_dead.green.skull_smoke'])),
  'pf2e:mAoykPgP5OALqeq3': design('Draconic essence coruscates through a 20-foot emanation, sapping the resolve of each enemy.', () => fearWave(20, PULSE_PURPLE, ['energy_strands.complete.purple.01', 'energy_strands.complete.blue'])),
  'pf2e:FVUdPhbBOvirUNbN': design('Righteous anger boils out as a 15-foot aura of dread; the save happens later as foes end turns inside it.', () => [
    motion('shake', 'source', { stageId: 'anger', duration: 700, intensity: 0.4 }),
    aura('Indignation boils out', ['template_circle.symbol.out_flow.fear.dark_orange', 'template_circle.symbol.normal.fear.dark_purple'], { after: 'anger', anchor: 'start', offset: 200, duration: 3000, auraRadius: 15, opacity: 0.7, below: true, fadeIn: 300, fadeOut: 600 }),
  ]),
  'pf2e:IySKTSfPO0Lzfm8r': design('Weapon raised aloft, you blaze with dazzling mythic radiance and every enemy who sees it quails.', () => [
    motion('levitate', 'source', { stageId: 'raise', duration: 1400, intensity: 0.3 }),
    cast('Weapon raised in radiance', ['sacred_flame.source.yellow'], { stageId: 'cast', scale: 0.9, duration: 1200 }),
    aura('Glory blazes', HOLY_SELF, { stageId: 'glory', after: 'cast', anchor: 'start', offset: 400, duration: 1800, scale: 1.4 }),
    impact('Enemies quail', FEAR_ORANGE, { after: 'glory', anchor: 'start', offset: 500, duration: 1400, scale: 0.5 }),
    motion('cower', 'targets', { after: 'glory', anchor: 'start', offset: 600, duration: 1000, intensity: 0.4 }),
  ], { sound: 'holy' }),
  'pf2e:mgbCNt7MgEVbMlJ7': design('Rising into the sky, you unveil divine magnificence across a 60-foot emanation, dazzling the enemies below.', () => [
    motion('rush', 'source', { stageId: 'rise', duration: 2600, distance: 1.4, motionRange: 'distance', motionHeading: 'up', intensity: 0.3 }),
    aura('Divine magnificence', HOLY_SELF, { stageId: 'glory', after: 'rise', anchor: 'start', offset: 900, duration: 1800, scale: 1.5 }),
    aura('Radiance floods 60 feet', PULSE_GOLD, { after: 'glory', anchor: 'start', offset: 200, duration: 1800, auraRadius: 60, opacity: 0.5, below: true }),
    impact('Dazzled', ['glint.yellow.many'], { after: 'glory', anchor: 'start', offset: 600, duration: 1300, scale: 0.8 }),
  ], { sound: 'holy' }),
  'pf2e:Y5fO1ooNuCFPCB0s': design('You dive straight down and land in a blast of divine spirit force that fills a 10-foot emanation.', () => [
    motion('slam', 'source', { stageId: 'land', duration: 1000, intensity: 0.9 }),
    aura('Divine landing', HOLY_SELF, { stageId: 'impact', after: 'land', anchor: 'start', offset: 500, duration: 1500, scale: 1.2 }),
    aura('Spirit shockwave through 10 feet', PULSE_GOLD, { after: 'impact', anchor: 'start', offset: 100, duration: 1500, auraRadius: 10, opacity: 0.85, below: true }),
    impact('Spirit force', HOLY_HIT, { stageId: 'hit', after: 'impact', anchor: 'start', offset: 300, duration: 1400, scale: 0.7 }),
    motion('stagger', 'targets', { after: 'hit', anchor: 'start', duration: 800, intensity: 0.5 }),
  ], { sound: 'holy' }),
  'pf2e:lNIHXCQ0Zc2gY5OH': design('Mythic vitality brings you back to your feet, then you erupt in retributive flame that burns adjacent foes.', () => [
    aura('Return to consciousness', ['healing_generic.burst.greenorange'], { stageId: 'rise', duration: 1300, scale: 0.9 }),
    motion('pulse', 'source', { after: 'rise', anchor: 'start', offset: 300, duration: 900, intensity: 0.5 }),
    aura('Retributive flames erupt', ['explosion.01.orange'], { stageId: 'erupt', after: 'rise', anchor: 'start', offset: 900, duration: 1500, auraRadius: 5 }),
    impact('Adjacent foes burn', ['impact.fire.01.orange'], { optionalTargets: true, after: 'erupt', anchor: 'start', offset: 250, duration: 1100, scale: 0.7 }),
    motion('recoil', 'targets', { optionalTargets: true, after: 'erupt', anchor: 'start', offset: 300, duration: 700, intensity: 0.5 }),
  ], { sound: 'fire' }),
  'pf2e:WcvscJpQhbTiefwn': design('A spiked turtle-shell carapace snaps shut over the armor as black-powder chains burst into everything adjacent.', () => [
    aura('Spiked shell unfolds', ['shield.01.complete.01.white', 'shield.01.complete.01.blue'], { stageId: 'shell', duration: 1500, scale: 1.05 }),
    motion('brace', 'source', { duration: 900, intensity: 0.5 }),
    aura('Black-powder chain burst', ['explosion.shrapnel.bomb.01.black'], { stageId: 'burst', after: 'shell', anchor: 'start', offset: 350, duration: 1300, auraRadius: 5 }),
    impact('Spiked chains strike', ['impact.fire.01.orange'], { optionalTargets: true, after: 'burst', anchor: 'start', offset: 200, duration: 1000, scale: 0.6 }),
    motion('recoil', 'targets', { optionalTargets: true, after: 'burst', anchor: 'start', offset: 250, duration: 700, intensity: 0.5 }),
  ], { sound: 'explosion' }),
  'pf2e:F8rtjsojGLaRuU5l': design('A black hole opens over your heart and screaming winds drag the creatures in the cone toward you.', () => [
    aura('Void opens over the heart', ['sphere_of_annihilation.200px.purple'], { stageId: 'void', duration: 2600, scale: 0.6, fadeIn: 300, fadeOut: 500 }),
    aura('Vortex pulls inward', ['template_circle.vortex.loop.dark_black', 'template_circle.vortex.loop.blue'], { after: 'void', anchor: 'start', offset: 200, duration: 2400, scale: 2.2, opacity: 0.7, below: true }),
    travel('Screaming winds rush in', ['wind_stream.white'], { stageId: 'wind', travelOrigin: 'target', after: 'void', anchor: 'start', offset: 400, duration: 1600, opacity: 0.8 }),
    motion('rush', 'targets', { after: 'wind', anchor: 'start', offset: 300, duration: 1500, distance: 2, motionRange: 'distance', motionHeading: 'toward', intensity: 0.5 }),
  ]),
  'pf2e:itn27nKYb8FRsdl3': design('Heavy rain hammers down on the creatures in the burst like sling stones, obscuring them.', () => [
    cast('Rain called', ['cast_generic.water.02.blue'], { stageId: 'call', scale: 0.7, duration: 900 }),
    impact('Driving rain', ['sleet_storm.01.blue', 'water_splash.circle.01.blue'], { stageId: 'rain', after: 'call', anchor: 'start', offset: 400, duration: 2200, scale: 1.4, opacity: 0.8 }),
    impact('Drops hammer', ['impact.water.02.blue'], { after: 'rain', anchor: 'start', offset: 400, duration: 1100, scale: 0.7 }),
    motion('press', 'targets', { after: 'rain', anchor: 'start', offset: 450, duration: 900, intensity: 0.4 }),
  ]),

  // ---------------------------------------------------------------- reactions, buffs & stances
  'pf2e:ehPnY1PuPK7EXkYc': design('The taste of fiendish blood sends a supernatural, quickening fury through the orc.', () => [
    cast('Fiendish blood', ['liquid.splash02.red'], { stageId: 'taste', scale: 0.5, duration: 900 }),
    aura('Supernatural fury', ['energy_strands.complete.dark_red.01', 'energy_strands.complete.blue'], { after: 'taste', anchor: 'start', offset: 300, duration: 2000, scale: 1, ...tint(RED) }),
    motion('shake', 'source', { after: 'taste', anchor: 'start', offset: 350, duration: 900, intensity: 0.5 }),
  ]),
  'pf2e:EWeso1zDkCLGlnsW': design('Bloodied and boiling, the barbarian throws caution away in a red surge of reckless fury.', () => [
    cast('Blood boils', ['cast_generic.dark.01.red', 'cast_generic.fire.01.orange'], { stageId: 'boil', scale: 0.8, duration: 1000 }),
    aura('Reckless wrath', ['energy_strands.complete.dark_red.01', 'energy_strands.complete.blue'], { after: 'boil', anchor: 'start', offset: 400, duration: 2000, ...tint(RED) }),
    motion('shake', 'source', { after: 'boil', anchor: 'start', offset: 300, duration: 900, intensity: 0.5 }),
  ]),
  'pf2e:siegOEdEpevAJNFw': design('A heal is cast onto the threatened ally, forming a green ward that soaks the incoming damage.', () => [
    cast('Heal channelled', ['healing_generic.burst.greenorange'], { stageId: 'cast', scale: 0.6, duration: 1000 }),
    impact('Ward absorbs the blow', ['shield.01.complete.01.green', 'shield.01.complete.01.blue'], { stageId: 'ward', after: 'cast', anchor: 'start', offset: 500, duration: 1600, scale: 1 }),
    impact('Healing energy', ['healing_generic.03.burst.green', 'healing_generic.03.burst.bluegreen'], { after: 'ward', anchor: 'start', offset: 250, duration: 1500, scale: 0.8 }),
  ], { sound: 'healing' }),
  'pf2e:WYaKRREZUSH0jel5': design('A desperate plea answered: divine light settles on the champion with a single Focus Point.', () => [
    cast('Plea to the deity', ['sacred_flame.source.yellow'], { stageId: 'plea', scale: 0.7, duration: 1300 }),
    aura('Divine answer', ['bless.200px.intro.yellow'], { after: 'plea', anchor: 'start', offset: 600, duration: 2000, scale: 1 }),
  ], { sound: 'bless' }),
  'pf2e:NBDwiz1NDioc2eMP': design('Gnomish magic gathers inward and refills a Focus Point.', () => [
    cast('Magic gathers inward', ['energy_strands.complete.orange.01', 'energy_strands.complete.blue'], { stageId: 'gather', scale: 0.85, duration: 1500 }),
    aura('Focus restored', ['magic_signs.circle.02.conjuration.complete.yellow'], { after: 'gather', anchor: 'start', offset: 700, duration: 1800, scale: 0.8, below: true }),
  ]),
  'pf2e:ti6rPcSBsCuyEHqy': design('A vortex of sand and dust whirls through the kinetic aura, hiding those inside it.', () => [
    cast('Earth and air stance', ['cast_generic.earth.01.browngreen'], { stageId: 'cast', duration: 1000 }),
    aura('Sand vortex fills the kinetic aura', ['template_circle.whirl.loop.orange', 'template_circle.whirl.loop.blue'], { after: 'cast', anchor: 'start', offset: 300, duration: 3000, auraRadius: 10, opacity: 0.75, below: true, fadeIn: 400, fadeOut: 600, ...tint('#c9a465') }),
    aura('Blowing grit', DUST_RING, { after: 'cast', anchor: 'start', offset: 600, duration: 1500, scale: 1.3, opacity: 0.6, ...tint('#c9a465') }),
  ], { sound: 'wind' }),
  'pf2e:uBBQtYDIsVxnUJsZ': design('The air thickens with ghostly ectoplasm across a 30-foot emanation, shielding allies.', () => [
    cast('Spirits called', ['energy_strands.complete.dark_green.01', 'energy_strands.complete.blue'], { stageId: 'call', scale: 0.8, duration: 1200 }),
    aura('Ectoplasm thickens the air', ['fog_cloud.02.green02', 'fog_cloud.01.white'], { after: 'call', anchor: 'start', offset: 400, duration: 3000, auraRadius: 30, opacity: 0.45, below: true, fadeIn: 500, fadeOut: 700 }),
  ], { sound: 'spirit' }),
  'pf2e:zfnZki2CxmZXdNBO': design('Electricity crackles over the monk as resistance, and a melee attacker gets a shock back.', () => [
    aura('Crackling resistance', ['static_electricity.02.blue'], { stageId: 'static', duration: 1600, scale: 1.05 }),
    motion('brace', 'source', { duration: 900, intensity: 0.4 }),
    impact('Attacker shocked', ['static_electricity.03.blue'], { optionalTargets: true, after: 'static', anchor: 'start', offset: 300, duration: 1200, scale: 0.8 }),
    motion('shake', 'targets', { optionalTargets: true, after: 'static', anchor: 'start', offset: 350, duration: 700, intensity: 0.4 }),
  ]),
  'pf2e:LvmYfUGX3uDCpIHY': design('The armor innovation is electrified and sparks dance across it.', () => [
    cast('Armor charges', ['static_electricity.01.blue'], { stageId: 'charge', duration: 1000 }),
    aura('Electrified armor', ['static_electricity.02.blue'], { after: 'charge', anchor: 'start', offset: 400, duration: 2400, scale: 1.1 }),
    motion('pulse', 'source', { after: 'charge', anchor: 'start', offset: 300, duration: 900, intensity: 0.3 }),
  ]),
  'pf2e:nKkbEKbE9vfKWKdd': design('Attuned to the stone, the dwarf feels tremors ripple outward through 20 feet of ground.', () => [
    motion('sink', 'source', { stageId: 'attune', duration: 900, intensity: 0.25 }),
    cast('Hand to stone', ['impact.ground_crack.01.orange'], { after: 'attune', anchor: 'start', offset: 200, duration: 1200, scale: 0.6, below: true }),
    aura('Tremors ripple outward', ['template_circle.out_pulse.01.burst.greenorange', 'template_circle.out_pulse.01.burst.bluewhite'], { after: 'attune', anchor: 'start', offset: 500, duration: 1800, auraRadius: 20, opacity: 0.6, below: true, ...tint('#c08a4a') }),
  ], { sound: 'earth' }),
  'pf2e:DaW1Ugz0a24jhWLY': design('The critical unarmed blow reverberates through the foe\'s body, shaking muscle from bone.', () => [
    impact('Reverberating shockwave', ['toll_the_dead.grey.shockwave', 'toll_the_dead.green.shockwave'], { stageId: 'wave', duration: 1300, scale: 0.9 }),
    impact('Internal impact', ['impact.005.orange'], { after: 'wave', anchor: 'start', offset: 150, duration: 1000, scale: 0.6 }),
    motion('shake', 'targets', { after: 'wave', anchor: 'start', offset: 100, duration: 1100, intensity: 0.8 }),
  ], { sound: 'bludgeon' }),
  'pf2e:PsLne80WUsD4IFa6': design('Hands dig a shallow pit underfoot and kick a cone of grit in the chosen direction.', () => [
    motion('sink', 'source', { stageId: 'dig', duration: 1200, intensity: 0.3 }),
    aura('Shallow pit', ['ground_cracks.01.orange'], { after: 'dig', anchor: 'start', duration: 2200, scale: 1, below: true, fadeOut: 500 }),
    cone('Grit cloud kicked up', ['breath_weapons.poison.cone.orange', 'breath_weapons.poison.cone.green'], { optionalTargets: true, after: 'dig', anchor: 'start', offset: 500, duration: 1500, opacity: 0.8, ...tint('#b08850') }),
  ], { sound: 'earth' }),
  'pf2e:g3J3kSfnlYjq34Md': design('The object blinks out of its owner\'s grasp and reappears on the thief.', () => [
    impact('Object vanishes', ['teleport.01.white', 'teleport.01.blue'], { stageId: 'vanish', duration: 1300, scale: 0.5 }),
    cast('Object reappears on you', ['misty_step.02.blue'], { after: 'vanish', anchor: 'start', offset: 600, duration: 1300, scale: 0.5 }),
  ], { sound: 'teleport' }),
  'pf2e:IlygXZqCaeB9X30e': design('Primal energy reshapes you into your animal shape and swells it to enlarged size.', () => [
    cast('Primal reshaping', ['swirling_leaves.outburst.01.greenorange', 'swirling_leaves.outburst.01.pink'], { stageId: 'shift', duration: 1300 }),
    motion('pulse', 'source', { stageId: 'grow', after: 'shift', anchor: 'start', offset: 400, duration: 1300, intensity: 1 }),
    aura('Enlarged primal form', ['energy_field.01.green', 'energy_field.01.blue'], { after: 'grow', anchor: 'start', offset: 300, duration: 1600, scale: 1.45 }),
  ], { sound: 'transform' }),
  'pf2e:lgEihn7deZwHczGE': design('Rage explodes into draconic power as wings and scales unfold into a Large dragon form.', () => [
    cast('Draconic power erupts', ['explosion.03.red', 'explosion.01.orange'], { stageId: 'erupt', scale: 0.9, duration: 1200 }),
    aura('Wings unfurl', ['swirling_feathers.outburst.01.red', 'swirling_feathers.outburst.01.textured'], { after: 'erupt', anchor: 'start', offset: 400, duration: 1600, scale: 1.5 }),
    motion('pulse', 'source', { after: 'erupt', anchor: 'start', offset: 400, duration: 1400, intensity: 1 }),
  ], { sound: 'dragonRoar' }),
  'pf2e:6vHkvQv0j56nZuR3': design('Flames consume the kineticist\'s body, leaving a living flame that rises slightly off the ground.', () => [
    cast('Kinetic gate opens', ['cast_generic.fire.01.orange'], { stageId: 'gate', duration: 1000 }),
    aura('Living flame body', ['flames.04.complete.orange'], { after: 'gate', anchor: 'start', offset: 300, duration: 2600, scale: 1.3 }),
    motion('levitate', 'source', { after: 'gate', anchor: 'start', offset: 500, duration: 2000, intensity: 0.3 }),
  ]),
  'pf2e:NIwocFnVpyzjeNUC': design('Reality buckles as the fiendish final form bursts out, shaking everyone within 10 feet.', () => [
    cast('Monstrous blood surges', ['cast_generic.dark.01.red', 'cast_generic.fire.01.orange'], { stageId: 'surge', scale: 0.9, duration: 1100 }),
    motion('shake', 'source', { after: 'surge', anchor: 'start', duration: 1000, intensity: 0.6 }),
    aura('Reality buckles within 10 feet', PULSE_PURPLE, { after: 'surge', anchor: 'start', offset: 500, duration: 1600, auraRadius: 10, opacity: 0.85 }),
    aura('Fiendish final form', ['flames.04.complete.purple', 'flames.04.complete.orange'], { after: 'surge', anchor: 'start', offset: 700, duration: 2200, scale: 1.25 }),
  ]),
  'pf2e:ABL4daQ7c65d0tEM': design('Fast grey storm clouds gather around the kineticist, crackling with lightning.', () => [
    cast('Storm stance', ['wind_lines.01.01.white'], { stageId: 'cast', duration: 1000 }),
    aura('Storm clouds circle', ['fog_cloud.01.white'], { after: 'cast', anchor: 'start', offset: 300, duration: 2800, auraRadius: 10, opacity: 0.5, below: true, fadeIn: 400, fadeOut: 600 }),
    aura('Lightning in the clouds', ['static_electricity.01.blue'], { after: 'cast', anchor: 'start', offset: 700, duration: 1600, scale: 1.3, opacity: 0.8 }),
  ]),
  'pf2e:QfyCxRwvOZfstbj7': design('Intense cold swirls around the foe and frosts it over toward a solid block of ice.', () => [
    cast('Cold gathers', ['cast_generic.ice.01.blue', 'cast_generic.02.blue'], { stageId: 'cast', scale: 0.8, duration: 1000 }),
    impact('Frost swirls around the foe', ['aura_themed.01.inward.complete.cold.01'], { stageId: 'swirl', after: 'cast', anchor: 'start', offset: 450, duration: 1800, scale: 1.1 }),
    impact('Ice encases', ['ice_spikes.radial.burst.white'], { after: 'swirl', anchor: 'start', offset: 900, duration: 1400, scale: 0.6 }),
    motion('shake', 'targets', { after: 'swirl', anchor: 'start', offset: 500, duration: 900, intensity: 0.3 }),
  ]),
  'pf2e:LhpE0NsfNwYP6MOz': design('Frost is expelled from the goblin\'s body onto an adjacent foe, stiffening its limbs.', () => [
    cast('Frigid veins', ['cast_generic.ice.01.blue', 'cast_generic.02.blue'], { stageId: 'cast', scale: 0.7, duration: 900 }),
    impact('Frost bursts on the foe', ['impact_themed.ice_shard.blue'], { stageId: 'hit', after: 'cast', anchor: 'start', offset: 400, duration: 1200, scale: 0.8 }),
    impact('Rime clings', ['ice_spikes.radial.burst.white'], { after: 'hit', anchor: 'start', offset: 300, duration: 1200, scale: 0.5 }),
    motion('stagger', 'targets', { after: 'hit', anchor: 'start', offset: 200, duration: 800, intensity: 0.4 }),
  ], { sound: 'cold' }),
  'pf2e:YK7PLPoLGYGBivEt': design('A high-pitched gladiator\'s roar blasts a 15-foot cone of sonic force at the crowd of foes.', () => [
    cast('Projected roar', ['soundwave.02.red', 'soundwave.02.blue'], { stageId: 'roar', scale: 0.9, faceTarget: true, duration: 1000 }),
    impact('Sonic blast', ['shatter.red', 'shatter.blue'], { stageId: 'hit', after: 'roar', anchor: 'start', offset: 350, duration: 1200, scale: 0.8 }),
    motion('cower', 'targets', { after: 'hit', anchor: 'start', offset: 150, duration: 1000, intensity: 0.4 }),
  ]),
  'pf2e:fUR72e3t7p2IcqqG': design('Two opposing holy symbols are clashed together and a discordant divine flash distracts the faithful foe.', () => [
    cast('First divine symbol', ['sacred_flame.source.yellow'], { stageId: 'a', scale: 0.55, offsetX: -0.3, offsetUnits: 'token', duration: 1100 }),
    cast('Opposing divine symbol', ['sacred_flame.source.purple', 'sacred_flame.source.yellow'], { scale: 0.55, offsetX: 0.3, offsetUnits: 'token', mirrorX: true, duration: 1100 }),
    impact('Discordant divine clash', ['divine_smite.target.purplepink', 'divine_smite.target.blueyellow'], { stageId: 'clash', after: 'a', anchor: 'start', offset: 600, duration: 1500, scale: 0.8 }),
    impact('Distracted', ['dizzy_stars.200px.yellow', 'dizzy_stars.200px.blueorange'], { after: 'clash', anchor: 'start', offset: 600, duration: 1300, scale: 0.6 }),
    motion('stagger', 'targets', { after: 'clash', anchor: 'start', offset: 200, duration: 800, intensity: 0.3 }),
  ]),
  'pf2e:0Iv3VbR1DMPbZIjD': design('The azarketi grabs the creature and drags it down beneath the water.', () => [
    impact('Grabbed at the waterline', ['water_splash.circle.01.blue'], { stageId: 'grab', duration: 1400, scale: 0.9 }),
    motion('sink', 'targets', { after: 'grab', anchor: 'start', offset: 300, duration: 1400, intensity: 0.7 }),
    motion('sink', 'source', { after: 'grab', anchor: 'start', offset: 350, duration: 1400, intensity: 0.5 }),
    impact('Pulled under', ['bubble.001.001.complete.blue', 'liquid.splash.blue'], { after: 'grab', anchor: 'start', offset: 700, duration: 1600, scale: 0.8 }),
  ], { sound: 'water' }),
  'pf2e:8PmPjoqqbOzvUmO2': design('A polite minotaur shove moves an ally out of the way.', () => [
    motion('lunge', 'source', { stageId: 'lunge', duration: 800, intensity: 0.5 }),
    impact('Shoulder nudge', ['impact.005.orange'], { stageId: 'hit', after: 'lunge', anchor: 'start', offset: 350, duration: 800, scale: 0.4, opacity: 0.6 }),
    pushAway(1, { duration: 1000 }),
  ]),
  'pf2e:TnYHtN9gQASqOnii': design('A flashy sidestep makes the attack whiff past.', () => [
    sprite('Dodge afterimage', { duration: 900, opacity: 0.45 }),
    motion('dodge', 'source', { duration: 1200, distance: 0.5, intensity: 0.4 }),
    cast('Air whips past', ['wind_lines.01.01.white'], { scale: 0.6, duration: 1000 }),
  ]),
  'pf2e:RKh9lvo0PdE2Yto4': design('A speeding updraft lifts the target and carries it through a jump.', () => [
    cast('Wind called', ['wind_lines.01.01.white'], { stageId: 'call', scale: 0.7, duration: 900 }),
    impact('Updraft beneath the target', ['whirlwind.bluegrey'], { stageId: 'lift', after: 'call', anchor: 'start', offset: 350, duration: 1600, scale: 0.8, opacity: 0.85 }),
    motion('leap', 'targets', { after: 'lift', anchor: 'start', offset: 300, duration: 2200, distance: 3, motionRange: 'distance', motionHeading: 'away', jumpHeight: 1.2, intensity: 0.5 }),
  ], { sound: 'wind' }),
  'pf2e:zfNLF9S8drNKkljN': design('A short vertical drift through the water, trailing bubbles.', () => [
    cast('Water stirs', ['water_splash.circle.01.blue'], { scale: 0.6, opacity: 0.8, duration: 1200 }),
    motion('drift', 'source', { duration: 1500, intensity: 0.5 }),
  ]),
  'pf2e:VaxsPPPsgXzNxQVI': design('Wild dragonets swarm around you in a flock that dazzles enemies within 10 feet.', () => [
    aura('Dragonets swarm in', ['swirling_feathers.outburst.01.orange', 'swirling_feathers.outburst.01.textured'], { stageId: 'flock', duration: 1800, scale: 1.4 }),
    aura('Flock aura dazzles', ['twinkling_stars.points08.orange'], { after: 'flock', anchor: 'start', offset: 500, duration: 2200, auraRadius: 10, opacity: 0.7, below: true }),
  ]),
  'pf2e:GZrvQo5FcoP5qocX': design('The wound yawns open grotesquely and the attacker recoils, sickened.', () => [
    cast('Wound gapes', ['liquid.splash02.red'], { stageId: 'gape', scale: 0.55, duration: 1000 }),
    impact('Revulsion', ['fumes.04.complete.green', 'fumes.04.complete.grey'], { after: 'gape', anchor: 'start', offset: 400, duration: 1300, scale: 0.6, opacity: 0.8 }),
    motion('cower', 'targets', { after: 'gape', anchor: 'start', offset: 450, duration: 900, intensity: 0.35 }),
  ]),
  'pf2e:cZa6br5C3Iyzqqi9': design('Bark grows over the kineticist as armor, and a wooden shield forms in the free hand.', () => [
    cast('Wood answers', ['swirling_leaves.outburst.01.greenorange', 'swirling_leaves.outburst.01.pink'], { stageId: 'call', duration: 1000 }),
    aura('Bark armor grows', ['aura_themed.01.inward.complete.wood.01'], { stageId: 'bark', after: 'call', anchor: 'start', offset: 300, duration: 1800, scale: 1.1 }),
    aura('Wooden shield', ['shield.01.complete.01.green', 'shield.01.complete.01.blue'], { after: 'bark', anchor: 'start', offset: 500, duration: 1500, scale: 1, ...tint('#8b6a3a') }),
    motion('brace', 'source', { after: 'bark', anchor: 'start', offset: 600, duration: 900, intensity: 0.4 }),
  ], { sound: 'vines' }),
  'pf2e:iv80P6HbOpoNCoNj': design('A golden mystical bond locks the monarch and the challenged foe into a duel.', () => [
    cast('Challenge declared', ['cast_shape.circle.01.yellow', 'cast_shape.circle.01.blue'], { stageId: 'decl', duration: 1100 }),
    travel('Mystical duel bond', ['energy_strands.range.standard.orange', 'energy_strands.range.standard.purple'], { stageId: 'bond', targetSelection: 'first', after: 'decl', anchor: 'start', offset: 500, duration: 2000 }),
    impact('Bound to the duel', ['cast_shape.circle.01.yellow', 'cast_shape.circle.01.blue'], { targetSelection: 'first', after: 'bond', anchor: 'start', offset: 500, duration: 1300 }),
  ]),
  'pf2e:2GrlSP1xhKIz4G8B': design('A mighty cry fills the nephilim with revitalizing celestial energy.', () => [
    cast('Mighty cry', ['soundwave.02.orangeyellow', 'soundwave.02.blue'], { stageId: 'cry', scale: 0.9, duration: 1000 }),
    aura('Revitalizing energy', ['healing_generic.loop.yellowwhite', 'healing_generic.loop.greenorange'], { after: 'cry', anchor: 'start', offset: 400, duration: 2000, scale: 0.9 }),
  ], { sound: 'battleCry', soundNamespace: 'ability' }),
  'pf2e:9LvJo3K2AjKcVvTc': design('Toxic demonic sludge oozes over the body and weapons.', () => [
    cast('Corruption expelled', ['fumes.toxic.green', 'fumes.04.complete.grey'], { stageId: 'expel', scale: 0.8, duration: 1100 }),
    aura('Toxic sludge coats you', ['fumes.04.loop.green', 'fumes.04.loop.grey'], { after: 'expel', anchor: 'start', offset: 400, duration: 2400, scale: 1, opacity: 0.8, fadeIn: 300, fadeOut: 500 }),
  ], { sound: 'poison' }),
};
