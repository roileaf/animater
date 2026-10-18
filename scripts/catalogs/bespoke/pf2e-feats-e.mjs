// Bespoke compositions (pf2e-feats-e). Keys: '<system>:<entryId>' or '<system>:<entryId>:<variant|mode>'.
// See scripts/catalogs/bespoke/helpers.mjs and scripts/bespoke.mjs.
// PF2e feats have no measured template at play time, so emanations/bursts/cones
// are drawn as source auras and per-target impacts (targetSelection:'all').
import { cast, travel, projectile, impact, area, aura, sprite, motion, tint, spin, breathe, design } from './helpers.mjs';

// Shared art (Patreon key first, Free fallback last).
const SLASH = ['melee_generic.slashing.one_handed', 'melee_generic.slash.01.orange'];
const SLASH2 = ['melee_generic.slash.02.002.orange', 'melee_generic.slash.02.002.blue'];
const HEAVY = ['melee_generic.slashing.two_handed', 'melee_generic.slash.01.orange'];
const PIERCE = ['melee_generic.piercing.one_handed', 'melee_generic.slash.02.001.blue'];
const BLUNT = ['melee_generic.bludgeoning.one_handed', 'melee_generic.creature_attack.fist.002.blue'];
const BLUNT2 = ['melee_generic.bludgeoning.two_handed', 'melee_generic.creature_attack.fist.002.blue'];
const FIST = c => [`unarmed_strike.physical.01.${c}`, 'unarmed_strike.physical.01.blue'];
const FIST2 = c => [`unarmed_strike.physical.02.${c}`, 'unarmed_strike.physical.02.blue'];
const CLAW = c => [`melee_generic.creature_attack.claw.001.${c}`, 'melee_generic.creature_attack.claw.001.red'];
const CLAWS = c => [`claws.200px.${c}`, 'claws.200px.red'];
const BITE = c => [`bite.200px.${c}`, 'bite.200px.red'];
const FEAR = c => [`icon.fear.${c}`, 'icon.fear.dark_purple'];
const STUN = c => [`icon.stun.${c}`, 'icon.stun.purple'];
const WAVE = c => [`soundwave.02.${c}`, 'soundwave.02.blue'];
const ARROW = ['arrow.physical.white.01'];
const BULLET = ['bullet.01.orange'];
const MUZZLE = ['muzzle_flash.single.01.yellow'];
const DUST = ['smoke.puff.side.grey'];
const CRACK = ['impact.ground_crack.01.orange'];
const ALL = { targetSelection: 'all' };

const lunge = (o = {}) => motion('lunge', 'source', { duration: 700, intensity: 0.6, ...o });
// One melee contact on the first target, timed to the lunge.
const hit = (label, assets, o = {}) => impact(label, assets, { delay: 300, ...o });

// Demoralize-style intimidation: a cue at the source, a fear icon on the
// target(s), and a cower. `cue` is the source art; `many` hits every target.
const intimidate = ({ cue = WAVE('purple'), cueLabel = 'Menace', cueScale = 0.9, cueTint, color = 'dark_purple', many = false, src = 'pulse', srcIntensity = 0.4 } = {}) => [
  cast(cueLabel, cue, { stageId: 'dm-cue', scale: cueScale, duration: 1200, ...(cueTint ? tint(cueTint) : {}) }),
  motion(src, 'source', { duration: 700, intensity: srcIntensity }),
  impact('Fear takes hold', FEAR(color), { stageId: 'dm-fear', after: 'dm-cue', anchor: 'start', offset: 450, duration: 1600, scale: 0.6, fadeIn: 150, fadeOut: 400, ...(many ? ALL : {}) }),
  motion('cower', 'targets', { after: 'dm-fear', anchor: 'start', offset: 100, duration: 900, intensity: 0.4, ...(many ? ALL : {}) }),
];

// Ranged weapon shot: draw, flight, contact, recoil.
const shot = ({ flight = ARROW, contact = ['impact.005.white', 'impact.005.orange'], aim = 'Draw and aim', tintHex, flightMs = 1200, extra = [] } = {}) => [
  motion('recoil', 'source', { delay: 350, duration: 500, intensity: 0.3 }),
  travel('Shot', flight, { stageId: 'sh-fly', delay: 300, duration: flightMs, ...(tintHex ? tint(tintHex) : {}) }),
  impact('Contact', contact, { stageId: 'sh-hit', after: 'sh-fly', anchor: 'end', duration: 1000, scale: 0.7 }),
  ...extra,
];

export default {
  // Split Spellstrike: two weapons, two different foes, the spell riding both.
  'pf2e:EJvmqVFxR3xn7QiR': design('Each weapon carries the charged spell to a different foe: the first blade discharges on the first target, the second on another, never stacking both on one creature.', () => [
    cast('Spell charges both blades', ['energy_strands.in.purple.01', 'energy_strands.in.green.01'], { stageId: 'ss-ch', scale: 0.8, duration: 900 }),
    lunge({ delay: 600 }),
    impact('First weapon strikes', ['melee_generic.slash.02.001.purple', 'melee_generic.slash.02.001.blue'], { stageId: 'ss-a', after: 'ss-ch', anchor: 'end', offset: -100, duration: 1100, targetSelection: 'first' }),
    impact('Spell discharges', ['impact.011.purple', 'impact.012.blue'], { after: 'ss-a', anchor: 'start', offset: 350, duration: 1100, scale: 0.8, targetSelection: 'first' }),
    impact('Second weapon strikes', ['melee_generic.slash.02.002.purple', 'melee_generic.slash.02.002.blue'], { stageId: 'ss-b', after: 'ss-a', anchor: 'start', offset: 650, duration: 1100, targetSelection: 'second' }),
    impact('Spell discharges', ['impact.011.purple', 'impact.012.blue'], { after: 'ss-b', anchor: 'start', offset: 350, duration: 1100, scale: 0.8, targetSelection: 'second' }),
  ]),

  // Spore Cloud: pollen/spores, 10-ft emanation, dazzled/blinded.
  'pf2e:a32r2n9j36khV0Cp': design('A burst of pollen and spores billows out in a 10-foot emanation, clouding the eyes of creatures caught in it.', () => [
    motion('pulse', 'source', { duration: 600, intensity: 0.4 }),
    aura('Spore cloud billows', ['fumes.04.complete.green', 'fumes.04.complete.grey'], { stageId: 'sc-c', delay: 150, scale: 5, duration: 2600, opacity: 0.75, fadeOut: 600, ...tint('#c7c96a') }),
    aura('Drifting pollen', ['particles.outward.greenyellow.01.01'], { delay: 300, scale: 4.5, duration: 2200, opacity: 0.85 }),
    impact('Spores in the eyes', ['dizzy_stars.200px.yellow', 'dizzy_stars.200px.blueorange'], { after: 'sc-c', anchor: 'start', offset: 700, duration: 1400, scale: 0.5, ...ALL }),
  ]),

  // Spray Ink: reactive ink jet at the attacker, dazzling it.
  'pf2e:6ZM8ZtLa4wwkrVJE': design('A jet of black ink sprays into the attacker\'s face, smearing it so it is dazzled.', () => [
    motion('recoil', 'source', { duration: 500, intensity: 0.3 }),
    impact('Ink splashes the attacker', ['liquid.splash_side.dark_black', 'liquid.splash_side.blue'], { stageId: 'ink', delay: 150, duration: 1200, scale: 0.9, ...tint('#141418') }),
    aura('Ink clings', ['liquid.blob.blue'], { subject: 'targets', after: 'ink', anchor: 'start', offset: 500, duration: 1800, scale: 0.7, opacity: 0.8, fadeOut: 500, ...tint('#141418') }),
    motion('shake', 'targets', { after: 'ink', anchor: 'start', offset: 150, duration: 700, intensity: 0.4 }),
  ]),

  // Springboard: Leap off the struck foe to another and talon it.
  'pf2e:PEw6PEGHSfbMI9Is': design('The leg lashes out and the user Leaps off the foe in an arc toward another, the talon descending in a crescent on landing.', () => [
    cast('Spring off', DUST, { scale: 0.7, duration: 900, below: true }),
    motion('leap', 'source', { stageId: 'sb-leap', delay: 100, duration: 1500, intensity: 0.6, distance: 4, motionRange: 'target', motionHeading: 'toward', motionEndpoint: 'near' }),
    impact('Crescent talon', ['melee_generic.creature_attack.claw.002.green', 'melee_generic.creature_attack.claw.002.red'], { after: 'sb-leap', anchor: 'end', offset: -250, duration: 1200 }),
  ]),

  // Sprout Fruit: a ripe fruit sprouts from the plants on your body.
  'pf2e:WxnCYjr02usmMN1q': design('Leaves rustle across the user\'s plant-covered body and a single ripe fruit swells into being with a warm healing glow.', () => [
    cast('Leaves stir', ['swirling_leaves.complete.01.green'], { scale: 0.8, duration: 1300 }),
    cast('Fruit ripens', ['plant_growth.02.round.2x2.complete.greenred', 'plant_growth.03.round.2x2.complete.greenyellow'], { delay: 450, scale: 0.55, duration: 1800, offsetY: -0.3, offsetUnits: 'token' }),
    aura('Restorative glow', ['healing_generic.200px.green'], { delay: 1300, scale: 0.6, duration: 1300, opacity: 0.7 }),
  ]),

  // Squawk!: an awkward bird squawk and ruffled feathers to cover a faux pas.
  'pf2e:CCmiEmS7ZgyQUfhn': design('The tengu ruffles its feathers and lets out an awkward squawk; a little puff of feathers covers the social misstep.', () => [
    motion('shake', 'source', { duration: 650, intensity: 0.35 }),
    cast('Feathers ruffle', ['swirling_feathers.outburst.01.textured'], { scale: 0.8, duration: 1300 }),
    cast('Squawk', WAVE('orangeyellow'), { delay: 150, scale: 0.6, duration: 900 }),
  ]),

  // Squirm Free: slip out of a grab.
  'pf2e:SzkpazSZ0pi1WZsH': design('The poppet wriggles and slips sideways out of the grasp in a quick squirm.', () => [
    motion('shake', 'source', { duration: 600, intensity: 0.45 }),
    motion('dodge', 'source', { delay: 550, duration: 800, intensity: 0.3, distance: 0.5, motionRange: 'distance', motionHeading: 'away', motionEndpoint: 'near' }),
    cast('Slip loose', ['wind_lines.01.01.white'], { delay: 500, scale: 0.6, duration: 1000 }),
  ]),

  // Stab and Blast: bayonet/stock melee, then a point-blank shot.
  'pf2e:UIMZe4QDJQ9k4npN': design('A bayonet thrust into the foe, then the trigger is pulled at point-blank range: muzzle flash, round and impact in quick succession.', () => [
    lunge(),
    hit('Bayonet thrust', PIERCE, { stageId: 'sb-m', duration: 1100 }),
    cast('Point-blank discharge', MUZZLE, { stageId: 'sb-f', after: 'sb-m', anchor: 'start', offset: 650, scale: 0.6, duration: 600, offsetX: 0.4, offsetUnits: 'token' }),
    travel('Round', BULLET, { stageId: 'sb-r', after: 'sb-f', anchor: 'start', duration: 500 }),
    impact('Round strikes', ['impact.005.orange'], { after: 'sb-r', anchor: 'end', duration: 900, scale: 0.6 }),
    motion('recoil', 'targets', { after: 'sb-r', anchor: 'end', duration: 500, intensity: 0.4 }),
  ]),

  // Staff Sweep: shove or trip two foes within reach with a staff sweep.
  'pf2e:dPmJ91qawZW2U8K3': design('One wide staff sweep catches up to two foes standing near each other, knocking them back or off their feet.', () => [
    lunge({ intensity: 0.5 }),
    impact('Staff sweep', ['quarterstaff.melee.01.white'], { stageId: 'st', delay: 200, duration: 1300, ...ALL }),
    impact('Feet swept', DUST, { after: 'st', anchor: 'start', offset: 550, duration: 1000, scale: 0.6, ...ALL }),
    motion('stagger', 'targets', { after: 'st', anchor: 'start', offset: 500, duration: 800, intensity: 0.5, ...ALL }),
  ], { sound: 'staff', soundNamespace: 'ability' }),

  // Staggering Blow: megafauna companion's single powerful strike, slowed.
  'pf2e:waZzVgfyr1Vcxfqk': design('The megafauna mount rears and drives one enormous blow into the foe, the ground cracking as the target staggers, slowed.', () => [
    motion('pulse', 'source', { duration: 700, intensity: 0.25 }),
    lunge({ delay: 500, duration: 800 }),
    impact('Massive blow', BLUNT2, { stageId: 'sgb', delay: 850, scale: 1.4, duration: 1300 }),
    impact('Ground cracks', CRACK, { after: 'sgb', anchor: 'start', offset: 200, duration: 1300, scale: 0.9, below: true }),
    motion('stagger', 'targets', { after: 'sgb', anchor: 'start', offset: 150, duration: 900, intensity: 0.6 }),
  ], { sound: 'club', soundNamespace: 'ability' }),

  // Staggering Fire: an ordinary arrow or bolt to slow a foe.
  'pf2e:fngPLUD4Sltho2kn': design('A plain bow or crossbow shot thuds into the foe\'s legs, hobbling its Speed; no fire or magic involved.', () => shot({ extra: [
    motion('stagger', 'targets', { after: 'sh-fly', anchor: 'end', duration: 800, intensity: 0.45 }),
  ] }), { sound: 'bow', soundNamespace: 'ability' }),

  // Stand Back, I'm A Doctor!: defibrillating shock, adjacent creatures zapped.
  'pf2e:cQziPqmbo353bq7S': design('Healer\'s tools deliver a crackling Stasian shock to the dying patient, who revives with a healing pulse while sparks lash adjacent creatures.', () => [
    impact('Defibrillating shock', ['static_electricity.01.blue'], { stageId: 'dr-s', delay: 100, scale: 0.9, duration: 1200 }),
    motion('shake', 'targets', { after: 'dr-s', anchor: 'start', offset: 100, duration: 600, intensity: 0.4 }),
    impact('Sparks leap outward', ['electric_arc.blue.01', 'electric_arc.01'], { after: 'dr-s', anchor: 'start', offset: 300, scale: 1.2, duration: 900 }),
    impact('Life returns', ['healing_generic.03.burst.bluegreen'], { after: 'dr-s', anchor: 'end', offset: -200, scale: 0.8, duration: 1600 }),
  ]),

  // Starshot Arrow: a bolt of starlight that unravels into a binding constellation.
  'pf2e:Oa5sEYqqY8gNTo56': design('A whispered invocation turns the arrow into a streak of starlight; on impact it unravels into a constellation that wraps the target\'s limbs.', () => [
    cast('Invocation over the arrow', ['twinkling_stars.points04.white'], { scale: 0.5, duration: 900 }),
    motion('recoil', 'source', { delay: 600, duration: 500, intensity: 0.3 }),
    travel('Starlight bolt', ['guiding_bolt.01.blueyellow'], { stageId: 'sa-b', delay: 550, duration: 1200 }),
    impact('Constellation unravels', ['twinkling_stars.points08.white'], { stageId: 'sa-h', after: 'sa-b', anchor: 'end', duration: 1300, scale: 0.9 }),
    aura('Starlight bindings', ['markers.chain.spectral_standard.complete.02.blue'], { subject: 'targets', after: 'sa-h', anchor: 'start', offset: 300, duration: 1600, scale: 0.9, opacity: 0.8 }),
  ], { sound: 'bow', soundNamespace: 'ability' }),

  // Start the Festival!: a stampede of partying tanuki in a 30-ft burst.
  'pf2e:2VzIrCWJU4dJQV0x': design('A whistle and a point, and a horde of tanuki pours over the area: scampering paw prints and dust trample every enemy caught in the party.', () => [
    cast('Whistle and point', WAVE('orangeyellow'), { scale: 0.6, duration: 900 }),
    impact('Tanuki stampede', ['footprints.monster.grey', 'footprints.shoe.grey'], { stageId: 'tf', delay: 500, duration: 2000, scale: 1.2, ...ALL }),
    impact('Trampled', DUST, { after: 'tf', anchor: 'start', offset: 300, duration: 1200, scale: 0.8, repeats: 2, repeatInterval: 500, ...ALL }),
    motion('shake', 'targets', { after: 'tf', anchor: 'start', offset: 300, duration: 1200, intensity: 0.4, ...ALL }),
  ], { sound: 'bludgeon' }),

  // Stasian Smash: dynamo strike, electricity, sparks leap to two other foes.
  'pf2e:A0keRhzNlcB1u4gD': design('The coil-modified dynamo smashes into the foe in a burst of electricity, and sparks leap across the gap to up to two other foes.', () => [
    lunge(),
    hit('Dynamo smash', FIST2('blue'), { stageId: 'ss-h', duration: 1200 }),
    impact('Stasian discharge', ['static_electricity.02.blue', 'static_electricity.01.blue'], { after: 'ss-h', anchor: 'start', offset: 250, scale: 0.9, duration: 1200 }),
    travel('Sparks leap', ['chain_lightning.secondary.blue'], { after: 'ss-h', anchor: 'start', offset: 500, duration: 900, targetSelection: 'secondary', targetLimit: 2 }),
  ], { sound: 'feat-unarmed-electric', soundNamespace: 'ability' }),

  // Statement Strut: a confident walk that enraptures enemies.
  'pf2e:P092yzkGN4UYYVXB': design('The user Strides with show-stopping attitude, a shimmer of glamour trailing behind, and enemies along the way are left enraptured.', () => [
    motion('rush', 'source', { stageId: 'st-w', delay: 100, duration: 2000, intensity: 0.2, distance: 2, motionRange: 'distance', motionHeading: 'toward', motionEndpoint: 'near' }),
    sprite('Strut afterimage', { delay: 300, duration: 1200 }),
    aura('Glamour trail', ['swirling_sparkles.01.blue'], { delay: 100, duration: 2000, scale: 1, ...tint('#e7b6ff') }),
    impact('Enraptured', ['impact_themed.heart.pinkyellow', 'icon.heart.pink'], { after: 'st-w', anchor: 'start', offset: 900, duration: 1400, scale: 0.5, ...ALL }),
  ]),

  // Statue: body and gear appear to be stone, holding perfectly still.
  'pf2e:n4755xLnUbsKYfUM': design('Grey stone creeps over body and equipment as the user locks into a perfectly still statue pose.', () => [
    cast('Stone creeps over', ['shimmer.01.blue'], { scale: 1, duration: 1400, ...tint('#9a9a9a') }),
    impact('Settling dust', DUST, { delay: 600, scale: 0.6, duration: 1000 }),
    motion('brace', 'source', { delay: 400, duration: 900, intensity: 0.3 }),
  ]),

  // Steal for the Depths: grapple and drag the creature under the water.
  'pf2e:MADUYJxUdhkCvI1B': design('The merfolk grabs the creature and drags it down beneath the surface in a churn of water and bubbles.', () => [
    lunge({ intensity: 0.5 }),
    impact('Grab', FIST('blue'), { stageId: 'sd-g', delay: 250, duration: 900 }),
    impact('Pulled under', ['water_splash.circle.01.blue'], { stageId: 'sd-s', after: 'sd-g', anchor: 'start', offset: 450, scale: 0.9, duration: 1400 }),
    motion('sink', 'targets', { after: 'sd-s', anchor: 'start', offset: 100, duration: 1100, intensity: 0.5 }),
    aura('Bubbles rise', ['bubble.001.001.complete.blue'], { subject: 'targets', after: 'sd-s', anchor: 'start', offset: 600, duration: 1500, scale: 0.6 }),
  ], { sound: 'water' }),

  // Steam Knight: swirling armor of scalding steam.
  'pf2e:7PjBANpMMoBxTYq3': design('The kinetic aura condenses into swirling, superheated steam armor that hisses around the user.', () => [
    cast('Water flashes to steam', ['impact.water.02.blue'], { scale: 0.9, duration: 1000 }),
    aura('Steam armor swirls', ['fumes.steam.white'], { delay: 300, scale: 1.8, duration: 2600, opacity: 0.85, fadeIn: 300, fadeOut: 600 }),
    aura('Scalding heat', ['fire_ring.500px.red'], { delay: 450, scale: 1.3, duration: 2200, opacity: 0.35, below: true, fadeIn: 300, fadeOut: 600, ...tint('#ff9a5a') }),
    motion('pulse', 'source', { delay: 300, duration: 800, intensity: 0.3 }),
  ]),

  // Steed's Toppling Strike: the steed's unarmed attack knocks the foe prone.
  'pf2e:cW88fH1HBM5AlV4M': design('The champion\'s steed lunges with a hoof or jaws and slams the offender to the ground.', () => [
    lunge({ intensity: 0.7 }),
    hit('Steed strikes', BLUNT2, { stageId: 'stt', duration: 1200, scale: 1.1 }),
    motion('slam', 'targets', { after: 'stt', anchor: 'start', offset: 250, duration: 800, intensity: 0.5 }),
    impact('Knocked prone', DUST, { after: 'stt', anchor: 'start', offset: 500, duration: 1000, scale: 0.7, below: true }),
  ]),

  // Stomp Ground: a booted stomp rattles foes in a 5-foot emanation.
  'pf2e:eSq9I2OPDfzhybkr': design('A booted foot slams down; the ground cracks around the guardian and adjacent foes stagger or fall.', () => [
    motion('slam', 'source', { duration: 700, intensity: 0.6 }),
    aura('Ground cracks', CRACK, { stageId: 'sg', delay: 350, scale: 2.6, duration: 1600, below: true }),
    aura('Dust ring', ['smoke.puff.ring.01.white'], { delay: 400, scale: 2.4, duration: 1100, opacity: 0.6 }),
    motion('stagger', 'targets', { after: 'sg', anchor: 'start', offset: 100, duration: 800, intensity: 0.5, ...ALL }),
  ]),

  // Stone Passage: Stride through stone as if it were open space.
  'pf2e:Anpsl8ibCaXcBNG9': design('Stone softens with a brown shimmer as the minotaur strides straight through it, rock dust rippling where it passes.', () => [
    cast('Stone grows insubstantial', ['shimmer.01.orange', 'shimmer.01.blue'], { scale: 1, duration: 1000, ...tint('#a58864') }),
    motion('rush', 'source', { stageId: 'sp-r', delay: 400, duration: 1800, intensity: 0.35, distance: 1.2, motionRange: 'distance', motionHeading: 'toward', motionEndpoint: 'near' }),
    sprite('Phasing afterimage', { delay: 450, duration: 1200, opacity: 0.5 }),
    cast('Rock dust ripples', DUST, { delay: 500, scale: 0.8, duration: 1100 }),
  ], { sound: 'earth' }),

  // Stonewall: become petrified until end of turn.
  'pf2e:gLOLdDj21bTaLHp7': design('Stone surges up the dwarf\'s body, turning it to rigid grey rock that shrugs off the blow.', () => [
    cast('Stone surges', CRACK, { scale: 0.9, duration: 1200, below: true }),
    aura('Petrified skin', ['shimmer.01.blue'], { delay: 300, duration: 2000, scale: 1, ...tint('#8d8d8d') }),
    motion('brace', 'source', { delay: 300, duration: 900, intensity: 0.4 }),
  ]),

  // Storm of Claws: three claw Strikes, Stepping back after hits.
  'pf2e:fyN2LDuaFXzZTboA': design('Three savage claw rakes land in quick succession, then the user steps back to admire the damage.', () => [
    lunge({ duration: 900 }),
    impact('Three claw rakes', ['melee_generic.creature_attack.claw.002.red', 'melee_generic.creature_attack.claw.002.red'], { stageId: 'sc', delay: 250, duration: 650, repeats: 3, repeatInterval: 550 }),
    motion('dodge', 'source', { delay: 1900, duration: 700, intensity: 0.3, distance: 0.5, motionRange: 'distance', motionHeading: 'away', motionEndpoint: 'near' }),
  ]),

  // Storm Retribution: Tempest Surge at the attacker, pushing it back.
  'pf2e:F1DVDJRARfdb1Kjz': design('Storming fury answers the critical hit: a Tempest Surge of lightning envelops the attacker and shoves it back 5 feet.', () => [
    cast('Storm answers', ['static_electricity.01.blue'], { scale: 0.8, duration: 900 }),
    impact('Tempest Surge', ['lightning_strike.blue'], { stageId: 'sr', delay: 350, duration: 1200 }),
    aura('Storm clings', ['static_electricity.02.blue', 'static_electricity.01.blue'], { subject: 'targets', after: 'sr', anchor: 'start', offset: 400, duration: 1400, scale: 0.9 }),
    motion('recoil', 'targets', { after: 'sr', anchor: 'start', offset: 150, duration: 700, intensity: 0.6 }),
  ]),

  // Storm Shroud: a swirling storm of rain/sand/snow grants concealment.
  'pf2e:nAVLB5MLYWUu8N71': design('A small swirling storm of wind-driven rain and cloud wraps around the user, blurring its outline.', () => [
    cast('Storm gathers', ['whirlwind.bluegrey'], { scale: 1, duration: 1300 }),
    aura('Shrouding storm', ['sleet_storm.01.blue'], { delay: 400, scale: 1.6, duration: 2400, opacity: 0.7, fadeIn: 300, fadeOut: 600 }),
    aura('Concealed', ['fog_cloud.01.white'], { delay: 600, scale: 1.4, duration: 2000, opacity: 0.45, fadeIn: 300, fadeOut: 600 }),
  ], { sound: 'wind' }),

  // Storm Spiral: thunderclouds, lightning and a thunderclap in a 20-ft burst.
  'pf2e:hv0SwlsAtcnR7R4T': design('A miniature thunderstorm spirals over the burst: lightning bolts strike each creature and a tremendous thunderclap rolls out.', () => [
    cast('Gather the storm', ['static_electricity.01.blue'], { scale: 0.8, duration: 900 }),
    impact('Storm clouds swirl', ['whirlwind.bluegrey'], { stageId: 'sp-c', delay: 300, scale: 2.2, duration: 2200, opacity: 0.7, below: true }),
    impact('Lightning strikes', ['call_lightning.low_res.blue'], { stageId: 'sp-l', after: 'sp-c', anchor: 'start', offset: 400, duration: 1300, scale: 0.8, ...ALL }),
    impact('Thunderclap', ['thunderwave.center.blue'], { after: 'sp-l', anchor: 'start', offset: 300, duration: 1100, scale: 0.9, ...ALL }),
    motion('shake', 'targets', { after: 'sp-l', anchor: 'start', offset: 200, duration: 700, intensity: 0.4, ...ALL }),
  ]),

  // Storming Breath: freezing breath (or sonic scream) in a 30-ft cone.
  'pf2e:EBmZyzDWhFSLydlM': design('A blast of freezing breath gusts from the user\'s mouth across the cone, frost biting every creature in it.', () => [
    motion('recoil', 'source', { delay: 200, duration: 700, intensity: 0.3 }),
    travel('Freezing breath', ['cone_of_cold.blue'], { stageId: 'sb', delay: 150, duration: 1600 }),
    impact('Frost bites', ['impact.frost.white.01'], { after: 'sb', anchor: 'end', duration: 1100, scale: 0.8, ...ALL }),
  ]),

  // Storming Gaze: a third eye fires a cone of lightning.
  'pf2e:D3usONRMsGZ7mWs1': design('A third eye snaps open on the forehead and lightning crackles out in a 15-foot cone, jolting each creature in it.', () => [
    cast('Third eye opens', ['eyes.01.bluegreen.single', 'eyes.01.dark_green.single'], { stageId: 'sg-e', scale: 0.4, duration: 900, offsetY: -0.25, offsetUnits: 'token' }),
    travel('Storming gaze', ['breath_weapons.lightning.line.blue'], { stageId: 'sg-b', after: 'sg-e', anchor: 'start', offset: 500, duration: 1200, ...ALL }),
    impact('Jolt', ['static_electricity.01.blue'], { after: 'sg-b', anchor: 'end', duration: 900, scale: 0.7, ...ALL }),
  ]),

  // Strafing Breath: the dragon mount sweeps forward wreathed in breath.
  'pf2e:pFKfYsxBWdUlmU6A': design('The dragon mount charges forward three times while its magical breath billows around rider and mount.', () => [
    motion('rush', 'source', { stageId: 'sb-r', delay: 150, duration: 2600, intensity: 0.35, distance: 3, motionRange: 'distance', motionHeading: 'toward', motionEndpoint: 'near' }),
    sprite('Charge afterimage', { delay: 300, duration: 1600 }),
    aura('Breath billows around', ['fire_ring.500px.red'], { delay: 200, duration: 2600, scale: 2.2, opacity: 0.55, fadeIn: 300, fadeOut: 500, ...spin(2600) }),
    aura('Smoke trail', ['smoke.puff.side.grey'], { delay: 500, duration: 1400, scale: 1.2, opacity: 0.6 }),
  ]),

  // Strangle: squeeze the breath out of a grabbed foe.
  'pf2e:lMA3F9SGzGV79P5C': design('The user tightens the hold on the grabbed foe and squeezes the breath from it; the victim is crushed and gasping.', () => [
    motion('pulse', 'source', { duration: 900, intensity: 0.4 }),
    hit('Squeeze', FIST('dark_red'), { stageId: 'sq', duration: 1100 }),
    motion('press', 'targets', { after: 'sq', anchor: 'start', offset: 100, duration: 1000, intensity: 0.5 }),
    impact('Breath forced out', ['smoke.puff.centered.grey'], { after: 'sq', anchor: 'start', offset: 600, duration: 900, scale: 0.4 }),
  ]),

  // Stumbling Finisher: Strike that pushes the target back 5 ft.
  'pf2e:gHkRvvdjNv6nfh9Y': design('A flashy finishing blow sends the foe stumbling backward.', () => [
    lunge(),
    hit('Finishing blow', SLASH, { stageId: 'sf', duration: 1300 }),
    motion('recoil', 'targets', { after: 'sf', anchor: 'start', offset: 250, duration: 800, intensity: 0.7 }),
  ]),

  // Stunning Finisher: dizzying blow, stunned.
  'pf2e:jkBzlMB4TS1sS2Fm': design('A dizzying finishing blow rattles the foe, leaving it reeling and seeing stars.', () => [
    lunge(),
    hit('Dizzying blow', BLUNT, { stageId: 'sf', duration: 1200 }),
    impact('Stunned', ['dizzy_stars.200px.yellow', 'dizzy_stars.200px.blueorange'], { after: 'sf', anchor: 'start', offset: 450, duration: 1600, scale: 0.6, offsetY: -0.35, offsetUnits: 'token' }),
    motion('shake', 'targets', { after: 'sf', anchor: 'start', offset: 250, duration: 800, intensity: 0.4 }),
  ]),

  // Submerged Stillness: invisible while hiding underwater.
  'pf2e:K4EzoLtW9wCYbKHR': design('The elf sinks still beneath the water, skin shifting to match the murk; a few bubbles rise and the outline fades away.', () => [
    cast('Water stills', ['water_splash.circle.01.blue'], { scale: 0.8, duration: 1100 }),
    aura('Bubbles rise', ['bubble.001.001.complete.blue'], { delay: 400, scale: 0.8, duration: 1600 }),
    motion('sink', 'source', { delay: 300, duration: 1200, intensity: 0.4 }),
    sprite('Fading outline', { delay: 500, duration: 1600, opacity: 0.5, fadeOut: 1000 }),
  ]),

  // Submission Hold: iron grip saps the grabbed opponent's strength.
  'pf2e:ZXaDS4OJvsQYvhBZ': design('An iron grip clamps down on the grabbed foe, crushing it and sapping its strength.', () => [
    motion('pulse', 'source', { duration: 900, intensity: 0.4 }),
    hit('Iron grip', FIST('orange'), { stageId: 'sh', duration: 1100 }),
    motion('press', 'targets', { after: 'sh', anchor: 'start', offset: 100, duration: 1100, intensity: 0.55 }),
    impact('Strength drains', ['energy_strands.in.red.01', 'energy_strands.in.green.01'], { after: 'sh', anchor: 'start', offset: 500, duration: 1300, scale: 0.6 }),
  ]),

  // Sudden Terror: amorphous poppet body spooks a creature (visual demoralize).
  'pf2e:tXn6fJO3Q2dAvCZC': design('The poppet\'s cloth body warps and bulges into something unsettling, and the watching creature recoils in fright.', () => intimidate({ cue: ['shimmer.01.purple', 'shimmer.01.blue'], cueLabel: 'Body warps', cueScale: 1, color: 'dark_purple', src: 'shake' }), { sound: 'fear' }),

  // Sunder Spell: Strike that can destroy a spell manifestation.
  'pf2e:8INrcMUv5vzWMG3X': design('A furious barbarian Strike shatters the magic it hits; the spell\'s energy breaks apart in shards.', () => [
    lunge(),
    hit('Furious Strike', HEAVY, { stageId: 'ss', duration: 1200, scale: 1.1 }),
    impact('Magic shatters', ['shatter.blue'], { after: 'ss', anchor: 'start', offset: 300, duration: 1200, scale: 0.8 }),
  ]),

  // Suplex: heave the grabbed foe overhead and slam it down prone.
  'pf2e:9yko78REsaw7i2gr': design('The user heaves the grabbed foe overhead and slams it into the ground; dust and cracks burst from the landing.', () => [
    motion('levitate', 'targets', { delay: 100, duration: 800, intensity: 0.6 }),
    motion('throw', 'source', { delay: 100, duration: 900, intensity: 0.5 }),
    motion('slam', 'targets', { stageId: 'sx-s', delay: 850, duration: 700, intensity: 0.7 }),
    impact('Slammed down', ['impact.ground_crack.02.orange', 'impact.ground_crack.01.orange'], { delay: 1000, duration: 1300, scale: 0.9, below: true }),
    impact('Dust bursts', ['smoke.puff.ring.01.white'], { delay: 1050, duration: 1000, scale: 0.7 }),
  ]),

  // Surging Smash: melee Strike, then a 30-ft cone of force from the weapon.
  'pf2e:QXlyDP3lbW1GjmT5': design('The overflowing nexus surges through the weapon: a Strike lands, then a torrent of magical force washes out in a cone.', () => [
    cast('Nexus surges into weapon', ['energy_strands.in.purple.01', 'energy_strands.in.green.01'], { scale: 0.7, duration: 900 }),
    lunge({ delay: 400 }),
    impact('Weapon Strike', SLASH, { stageId: 'ss-h', delay: 700, duration: 1100 }),
    travel('Force torrent', ['breath_weapons02.burst.cone.fire.orange.01'], { stageId: 'ss-c', after: 'ss-h', anchor: 'start', offset: 350, duration: 1500, ...tint('#b38cff') }),
    impact('Force washes over', ['impact.011.purple', 'impact.012.blue'], { after: 'ss-c', anchor: 'end', duration: 1100, scale: 0.8, ...ALL }),
  ]),

  // Surprise Snare: a quick-deploy snare triggers in the opponent's space.
  'pf2e:wqrOVv9gnqF4nlLR': design('The user flicks a prepared snare into the foe\'s square and it springs immediately, snapping shut around it.', () => [
    motion('throw', 'source', { duration: 700, intensity: 0.4 }),
    projectile('Snare tossed', ['caltrops.01.grey'], { stageId: 'ss-t', delay: 250, duration: 700, scale: 0.4 }),
    impact('Snare springs', ['spike_trap.05x05ft.top.no_base', 'spike_trap.05x05ft.top.holes', 'impact.005.orange'], { stageId: 'ss-h', after: 'ss-t', anchor: 'end', duration: 1300, scale: 0.8 }),
    motion('shake', 'targets', { after: 'ss-h', anchor: 'start', offset: 150, duration: 700, intensity: 0.45 }),
  ]),

  // Surprising Leap: eidolon jumps and strikes mid-leap.
  'pf2e:tqbldgibtisKjfgf': design('The eidolon springs high into the air and strikes the foe from above before dropping back to the ground.', () => [
    motion('leap', 'source', { stageId: 'sl', delay: 100, duration: 1500, intensity: 0.65, distance: 6, motionRange: 'target', motionHeading: 'toward', motionEndpoint: 'near' }),
    impact('Airborne Strike', SLASH, { after: 'sl', anchor: 'end', offset: -400, duration: 1200 }),
    cast('Landing dust', DUST, { after: 'sl', anchor: 'end', offset: -100, duration: 900, scale: 0.6 }),
  ]),

  // Sweeping Fan Block: snap two fans open and sweep ammunition aside.
  'pf2e:dY8LGT6KDcGy93GY': design('Up on one leg, both fans snap open and sweep across the body in a gust that knocks the incoming ammunition aside.', () => [
    motion('spin', 'source', { duration: 800, intensity: 0.25 }),
    cast('Fans sweep a gust', ['wind_lines.01.02.white'], { scale: 1, duration: 1100 }),
    cast('Ammunition deflected', ['impact.005.white', 'impact.005.orange'], { delay: 450, scale: 0.5, duration: 800, offsetX: 0.4, offsetUnits: 'token' }),
  ]),

  // Swift Banishment: the critical hit sends the victim to its home plane.
  'pf2e:t3unBu3PX6AO0uIW': design('The force of the critical blow tears a planar rift around the extraplanar foe and banishment drags it toward home.', () => [
    lunge(),
    hit('Critical blow', SLASH, { stageId: 'sb-h', duration: 1100 }),
    impact('Banishing rift', ['portals.vertical.ring.dark_purple', 'portals.vertical.ring.bright_yellow'], { stageId: 'sb-p', after: 'sb-h', anchor: 'start', offset: 350, duration: 1800, scale: 0.9, fadeIn: 200, fadeOut: 400 }),
    motion('flicker', 'targets', { after: 'sb-p', anchor: 'start', offset: 500, duration: 900, intensity: 0.6 }),
  ], { sound: 'teleport' }),

  // Swift Intervention: a quick shot to pin clothing or knock an ally clear.
  'pf2e:Rh3KSd7BUfV12GBT': design('A fast, well-placed arrow pins the falling ally\'s clothing to safety.', () => shot({ flightMs: 1000 })),

  // Swim Through Earth: burrow into the earth as if it were water.
  'pf2e:ZvCG3exhs9ZhhKPV': design('The earth parts like water; the kineticist dives in and burrows away beneath the surface.', () => [
    cast('Earth parts', ['burrow.out.01.brown', 'impact.ground_crack.01.orange'], { scale: 0.9, duration: 1200 }),
    motion('sink', 'source', { delay: 200, duration: 1100, intensity: 0.5 }),
    travel('Burrow trail', ['burrow.ranged.01.brown', 'smoke_line.15x05ft.lightblue'], { delay: 700, duration: 1400, optionalTargets: true }),
  ]),

  // Swipe: one arcing swing at up to two adjacent enemies.
  'pf2e:JbrVcOf82oFXk3mY': design('One wide, arcing swing carves through up to two adjacent enemies.', () => [
    lunge(),
    hit('Wide arc', HEAVY, { stageId: 'sw', duration: 1300, ...ALL }),
    motion('recoil', 'targets', { after: 'sw', anchor: 'start', offset: 300, duration: 600, intensity: 0.35, ...ALL }),
  ]),

  // Swiping Trace: wide swing that transfers a rune to each foe hit.
  'pf2e:f88lisILiPrOQv2r': design('A rune glows on the weapon tip; one arcing swing hits up to two foes and leaves the rune traced on each.', () => [
    cast('Rune on the weapon', ['magic_signs.rune.02.complete.01.orange', 'icon.runes.orange'], { scale: 0.4, duration: 900 }),
    lunge({ delay: 350 }),
    impact('Wide arc', HEAVY, { stageId: 'st', delay: 650, duration: 1200, ...ALL }),
    impact('Rune transfers', ['icon.runes.orange'], { after: 'st', anchor: 'start', offset: 400, duration: 1400, scale: 0.45, fadeIn: 200, fadeOut: 400, ...ALL }),
  ]),

  // Sword-Light Wave: spiritual energy unleashed through the weapon at range.
  'pf2e:8M7iQfVBRuucR6hJ': design('Spiritual energy gathers in the blade and a crescent wave of sword-light cuts across up to 60 feet into the opponent.', () => [
    cast('Spirit gathers in the blade', ['divine_smite.caster.yellowwhite', 'divine_smite.caster.blueyellow'], { scale: 0.7, duration: 1000 }),
    motion('lunge', 'source', { delay: 500, duration: 600, intensity: 0.5 }),
    travel('Sword-light wave', ['ranged_slash.instant.001.white', 'ranged_slash.instant.001.blue'], { stageId: 'sw', delay: 650, duration: 1200 }),
    impact('Sword-light strikes', ['impact.005.yellow', 'impact.005.orange'], { after: 'sw', anchor: 'end', duration: 1100, scale: 0.8 }),
  ]),

  // Sympathetic Strike: witch armament shines with patron runes; link formed.
  'pf2e:VOgAiCqC5kpIpLaf': design('The witch armament shines with the patron\'s runes as it strikes, and a sympathetic link glimmers around the target.', () => [
    cast('Patron runes kindle', ['icon.runes.green02', 'icon.runes.orange'], { scale: 0.4, duration: 900 }),
    lunge({ delay: 350 }),
    impact('Armament strikes', ['unarmed_strike.magical.01.green', 'unarmed_strike.magical.01.blue'], { stageId: 'ss', delay: 650, duration: 1100 }),
    aura('Sympathetic link', ['markers.runes.green02.01', 'markers.runes.orange.01'], { subject: 'targets', after: 'ss', anchor: 'start', offset: 400, duration: 1800, scale: 0.8, opacity: 0.8, fadeIn: 200, fadeOut: 500 }),
  ]),

  // Tag Team: a ranged follow-up on the creature the spotter missed.
  'pf2e:pT6r5BVJjALJUmb3': design('Covering the partner\'s miss, a quick arrow follows up on the same foe.', () => shot({ flightMs: 1000 })),

  // Tail Spin: tail sweep trips up to two adjacent creatures.
  'pf2e:rnEfO5eyRw7Fywzb': design('The goblin spins, tail lashing low across the floor, and trips up to two adjacent creatures.', () => [
    motion('spin', 'source', { duration: 800, intensity: 0.35 }),
    impact('Tail sweeps low', ['melee_generic.whirlwind.01.orange'], { stageId: 'ts', delay: 150, duration: 1200, scale: 0.7, ...ALL }),
    impact('Tripped', DUST, { after: 'ts', anchor: 'start', offset: 450, duration: 900, scale: 0.6, below: true, ...ALL }),
    motion('stagger', 'targets', { after: 'ts', anchor: 'start', offset: 400, duration: 800, intensity: 0.5, ...ALL }),
  ]),

  // Take in the Catch: net grapple, step, draw, Strike.
  'pf2e:6f05ORvbFKeLVRBM': design('The net is cast over the foe and hauled tight, then the user steps in, draws a weapon and strikes the netted creature.', () => [
    motion('throw', 'source', { duration: 700, intensity: 0.4 }),
    impact('Net snares', ['web.01'], { stageId: 'tc-n', delay: 250, duration: 1500, scale: 0.7 }),
    motion('dodge', 'source', { after: 'tc-n', anchor: 'start', offset: 600, duration: 700, intensity: 0.25, distance: 0.5, motionRange: 'distance', motionHeading: 'toward', motionEndpoint: 'near' }),
    impact('Strike the catch', SLASH, { after: 'tc-n', anchor: 'start', offset: 1200, duration: 1100 }),
  ]),

  // Talmandor's Shout: righteous celestial shout demoralizes enemies nearby.
  'pf2e:j305O6rhKvx4sT38': design('A righteous shout in the celestial Talmandor\'s name rings out in golden waves, cowing every enemy around the shouter.', () => intimidate({ cue: WAVE('orangeyellow'), cueLabel: 'Righteous shout', cueScale: 1.4, color: 'orange', many: true })),

  // Tangled Forest Rake: lashing branch Strike that repositions the foe.
  'pf2e:ewbt80Yin18k6oLq': design('Arms like gnarled branches rake the foe and drag it up to 10 feet into a new position.', () => [
    lunge(),
    hit('Lashing branch', ['vine.complete.nature.single.02.green'], { stageId: 'tr', duration: 1200, scale: 0.8 }),
    impact('Raking contact', CLAW('green'), { after: 'tr', anchor: 'start', offset: 150, duration: 1000 }),
    motion('rush', 'targets', { after: 'tr', anchor: 'start', offset: 450, duration: 900, intensity: 0.3, distance: 1, motionRange: 'distance', motionHeading: 'right', motionEndpoint: 'near' }),
  ]),

  // Target of Opportunity: a ranged or thrown follow-up strike.
  'pf2e:2FJwXMTJycSZY80Q': design('Capitalising on the ally\'s hit, an extra arrow joins the barrage against the same opponent.', () => shot({ flightMs: 1000 })),

  // Targeting Shot: tracks the prey around obstacles, ignoring cover.
  'pf2e:HVwmYfSLhrnCksHV': design('Carefully tracking the hunted prey, the ranger fires a shot that finds its way past concealment and cover.', () => [
    impact('Prey tracked', ['hunters_mark.pulse.01.green'], { scale: 0.6, duration: 1000 }),
    ...shot({ flightMs: 1100 }).map(s => (s.delay !== undefined ? { ...s, delay: s.delay + 500 } : s)),
  ]),

  // Taste Blood: drink fresh blood for temp HP; target may be drained.
  'pf2e:WWSwcvIjGUQOKKuD': design('The dhampir bites and drinks; a thread of blood draws from the victim back into the drinker.', () => [
    lunge({ intensity: 0.5 }),
    hit('Bite', BITE('red'), { stageId: 'tb', duration: 1100, scale: 0.8 }),
    travel('Blood drawn', ['energy_strands.range.standard.dark_red.01', 'energy_strands.range.standard.purple.01'], { after: 'tb', anchor: 'start', offset: 400, duration: 1300, mirrorX: true, ...tint('#a3141c') }),
    aura('Vitality gained', ['energy_strands.in.red.01', 'energy_strands.in.green.01'], { after: 'tb', anchor: 'start', offset: 900, duration: 1300, scale: 0.6 }),
  ]),

  // Taunting Strike: Strike plus a visual Taunt.
  'pf2e:Um5owecqPW17dtl2': design('The guardian\'s blow lands and draws the enemy\'s attention: a marker flares on the foe as it is taunted.', () => [
    lunge(),
    hit('Strike', SLASH, { stageId: 'ts', duration: 1100 }),
    impact('Taunted', ['hunters_mark.pulse.01.purple', 'hunters_mark.pulse.01.green'], { after: 'ts', anchor: 'start', offset: 400, duration: 1300, scale: 0.6 }),
  ]),

  // Tectonic Stomp: tremors in a 30-ft emanation knock creatures prone.
  'pf2e:9XXtDeRF2egCCzcx': design('A heavy stomp sends tremors rippling outward; cracks run across the ground and creatures standing on it are thrown down.', () => [
    motion('slam', 'source', { duration: 700, intensity: 0.7 }),
    aura('Tremor rings out', ['ground_cracks.01.orange'], { stageId: 'ts', delay: 350, scale: 5, duration: 2000, below: true, fadeOut: 600 }),
    impact('Ground heaves', CRACK, { after: 'ts', anchor: 'start', offset: 300, duration: 1200, scale: 0.8, below: true, ...ALL }),
    motion('stagger', 'targets', { after: 'ts', anchor: 'start', offset: 350, duration: 900, intensity: 0.6, ...ALL }),
  ]),

  // Telling Blow: a mythic Strike with extra weapon dice.
  'pf2e:QufAglrest3fr1iz': design('Mythic power flares gold along the weapon and the telling blow lands with outsized force.', () => [
    cast('Mythic resolve', ['divine_smite.caster.yellowwhite', 'divine_smite.caster.blueyellow'], { scale: 0.7, duration: 900 }),
    lunge({ delay: 450 }),
    impact('Telling blow', HEAVY, { stageId: 'tb', delay: 750, duration: 1200, scale: 1.2 }),
    impact('Mythic impact', ['impact.005.yellow', 'impact.005.orange'], { after: 'tb', anchor: 'start', offset: 250, duration: 1000, scale: 0.8 }),
    motion('stagger', 'targets', { after: 'tb', anchor: 'start', offset: 250, duration: 800, intensity: 0.5 }),
  ]),

  // Temporal Fury: Strike, near-instant 10-ft Step, Strike.
  'pf2e:eXPJTsu80nOYgzI3': design('A Strike, then the user skips through time to a new spot so fast it looks like teleportation, and strikes again.', () => [
    lunge(),
    hit('First Strike', SLASH, { stageId: 'tf-a', duration: 1000 }),
    motion('flicker', 'source', { stageId: 'tf-f', after: 'tf-a', anchor: 'start', offset: 600, duration: 600, intensity: 0.6 }),
    motion('dodge', 'source', { after: 'tf-f', anchor: 'start', duration: 400, intensity: 0.5, distance: 1, motionRange: 'distance', motionHeading: 'right', motionEndpoint: 'near' }),
    cast('Time skips', ['magic_signs.circle.02.divination.complete.purple', 'extras.tmfx.runes.circle.simple.divination'], { after: 'tf-f', anchor: 'start', scale: 0.6, duration: 900 }),
    impact('Second Strike', SLASH2, { after: 'tf-f', anchor: 'start', offset: 600, duration: 1000 }),
  ]),

  // Terrifying Countenance: magical cowl, Mask of Terror on yourself.
  'pf2e:Rbp08BSSzwpkWVjh': design('A shadowy cowl materialises and the vigilante\'s face becomes a mask of terror.', () => [
    cast('Cowl forms', ['smoke.puff.centered.dark_black', 'smoke.puff.centered.grey'], { scale: 0.9, duration: 1100 }),
    aura('Mask of Terror', ['markers.fear.dark_purple.01'], { delay: 400, duration: 2000, scale: 0.8, fadeIn: 300, fadeOut: 500 }),
  ], { sound: 'fear' }),

  // Terrifying Croak: a haunting croak demoralizes a creature.
  'pf2e:T8tNZANOWUZiXuzO': design('The tripkee\'s throat swells and a haunting, rattling croak rolls out, filling the target with lingering dread.', () => intimidate({ cue: WAVE('green'), cueLabel: 'Haunting croak', color: 'dark_purple', src: 'pulse', srcIntensity: 0.55 }), { sound: 'growl', soundNamespace: 'ability' }),

  // Terrifying Howl: demoralize every enemy within 30 ft.
  'pf2e:HjinlKihkadhkQ4Z': design('A raging, terrifying howl rolls out across 30 feet and every enemy in earshot quails.', () => intimidate({ cue: WAVE('red'), cueLabel: 'Terrifying howl', cueScale: 1.5, color: 'dark_red', many: true, src: 'pulse', srcIntensity: 0.6 })),

  // Terrifying Invocation: roar the rune's name (Demoralize) and Invoke it.
  'pf2e:HZE37GeNGeBeutZk': design('Spitting and roaring the rune\'s terrible name, the runesmith terrifies the target and the rune upon it flares as it is invoked.', () => [
    ...intimidate({ cue: WAVE('orangeyellow'), cueLabel: 'Roar the rune\'s name', color: 'dark_orange' }),
    impact('Rune invoked', ['magic_signs.rune.02.complete.01.orange', 'icon.runes.orange'], { after: 'dm-fear', anchor: 'start', offset: 500, duration: 1400, scale: 0.5 }),
  ]),

  // Terrifying Transformation: flesh tears as you transform; demoralize all within 30 ft.
  'pf2e:rAUNZfiulXh4zcm6': design('Flesh tears and warps grotesquely as the user transforms, and every enemy within 30 feet is struck with horror at the sight.', () => [
    cast('Flesh warps', ['shimmer.01.purple', 'shimmer.01.blue'], { stageId: 'tt', scale: 1.2, duration: 1500, ...tint('#8a1f2b') }),
    motion('shake', 'source', { duration: 900, intensity: 0.5 }),
    impact('Horror at the sight', ['icon.horror.purple'], { stageId: 'tt-f', after: 'tt', anchor: 'start', offset: 700, duration: 1600, scale: 0.6, ...ALL }),
    motion('cower', 'targets', { after: 'tt-f', anchor: 'start', offset: 100, duration: 900, intensity: 0.4, ...ALL }),
  ], { sound: 'transform' }),

  // That Was a Close One, Huh?: innocent laugh about the lucky shot unnerves foes.
  'pf2e:KP5VugClDb7I8enS': design('An innocent laugh about that impossibly lucky shot leaves the foe rattled.', () => intimidate({ cue: ['impact_themed.music_note.pink', 'icon.music_note.blue'], cueLabel: 'Innocent laugh', cueScale: 0.5, color: 'dark_purple' }), { sound: 'laughter' }),

  // The Dead Walk: two ghostly warriors manifest and Strike adjacent enemies.
  'pf2e:Fd0DriV32X3S9B2z': design('Two ghostly warriors rise beside the oracle\'s enemies and each cuts down at a foe with a spectral blade.', () => [
    cast('Beseech the spirits', ['spirit_guardians.blue.spirits', 'spirit_guardians.blueyellow.ring'], { scale: 1.6, duration: 1400, opacity: 0.8 }),
    impact('First ghostly warrior', ['spiritual_weapon.longsword.01.spectral.01.blue', 'spiritual_weapon.greatsword.01.spectral.02.green'], { stageId: 'dw-a', delay: 500, duration: 1600, scale: 0.9, fadeIn: 200, fadeOut: 400, targetSelection: 'first' }),
    impact('Second ghostly warrior', ['spiritual_weapon.longsword.01.spectral.01.blue', 'spiritual_weapon.greatsword.01.spectral.02.green'], { delay: 800, duration: 1600, scale: 0.9, fadeIn: 200, fadeOut: 400, targetSelection: 'second' }),
    impact('Spirit cut', ['impact.005.blue', 'impact.005.orange'], { after: 'dw-a', anchor: 'start', offset: 700, duration: 900, scale: 0.6, ...ALL }),
  ], { sound: 'spirit' }),

  // The Shattered Mountain Weeps: rock sphere explodes into falling debris and shrapnel.
  'pf2e:Aa0DqivAEL0ngunw': design('A massive sphere of rock bursts over the area; boulders and shrapnel rain down on every creature, knocking those who fail prone.', () => [
    cast('Rock sphere forms', ['cast_generic.earth.01.browngreen'], { scale: 0.9, duration: 1000 }),
    impact('Sphere explodes', ['explosion.shrapnel.bomb.01.grey', 'explosion.shrapnel.bomb.01.black'], { stageId: 'sm-x', delay: 500, duration: 1200, scale: 1.4, targetSelection: 'first' }),
    impact('Debris rains down', ['falling_rocks.top.1x1.grey'], { stageId: 'sm-r', after: 'sm-x', anchor: 'start', offset: 350, duration: 1600, scale: 1, ...ALL }),
    impact('Boulder impact', ['impact.boulder.01', 'impact.ground_crack.02.orange'], { after: 'sm-r', anchor: 'start', offset: 500, duration: 1300, scale: 0.9, below: true, ...ALL }),
    motion('stagger', 'targets', { after: 'sm-r', anchor: 'start', offset: 550, duration: 900, intensity: 0.6, ...ALL }),
  ]),

  // The Thousand Lashes of the Weeping Willow: a massive willow lashes all enemies.
  'pf2e:PYRx4lCIQXyW8tz8': design('A massive weeping willow erupts from the Plane of Wood and its thousand branches lash every enemy around it.', () => [
    cast('Call the willow', ['cast_generic.earth.01.browngreen'], { scale: 0.9, duration: 1000 }),
    impact('Willow rises', ['plant_growth.03.ring.4x4.complete.greenyellow'], { stageId: 'tl-w', delay: 400, duration: 2000, scale: 1.2, below: true, targetSelection: 'first' }),
    impact('Branches lash', ['vine.complete.nature.group.01.green'], { stageId: 'tl-l', after: 'tl-w', anchor: 'start', offset: 600, duration: 1500, scale: 0.8, ...ALL }),
    impact('Slashing whips', CLAW('green'), { after: 'tl-l', anchor: 'start', offset: 300, duration: 1000, scale: 0.8, ...ALL }),
    motion('shake', 'targets', { after: 'tl-l', anchor: 'start', offset: 300, duration: 700, intensity: 0.4, ...ALL }),
  ]),

  // The Tyrant Falls!: cry the final line of the Crimson Oath, unleashing power.
  'pf2e:H63SJLkenhLDkVnN': design('The final line of the Crimson Oath is cried aloud and overwhelming crimson power erupts around the oathbearer.', () => [
    cast('Crimson Oath cry', WAVE('red'), { scale: 1.2, duration: 1100 }),
    motion('pulse', 'source', { duration: 800, intensity: 0.5 }),
    aura('Unbridled power', ['divine_smite.caster.dark_red', 'divine_smite.caster.blueyellow'], { delay: 400, scale: 1.1, duration: 1800, ...tint('#c41b2b') }),
    aura('Crimson aura', ['energy_field.01.yellow', 'energy_field.01.blue'], { delay: 900, scale: 1.2, duration: 2000, opacity: 0.6, fadeIn: 300, fadeOut: 500, ...tint('#b3121f') }),
  ], { sound: 'battleCry', soundNamespace: 'ability' }),

  // The World Devours: the ground opens to swallow a creature.
  'pf2e:PKNL4jyUcSARtjyN': design('The ground of the waking world splits open beneath the creature and swallows it down.', () => [
    cast('The world stirs', ['cast_generic.earth.01.browngreen'], { scale: 0.8, duration: 900 }),
    impact('Earth splits', ['impact.ground_crack.02.orange', 'impact.ground_crack.01.orange'], { stageId: 'wd', delay: 400, duration: 1600, scale: 1, below: true }),
    impact('Maw of earth', ['burrow.out.01.brown', 'impact.ground_crack.03.orange'], { after: 'wd', anchor: 'start', offset: 300, duration: 1300, scale: 0.9 }),
    motion('sink', 'targets', { after: 'wd', anchor: 'start', offset: 450, duration: 1200, intensity: 0.7 }),
  ]),

  // Thousand-Year Grudge: former lives' despair through the eyes; sickened.
  'pf2e:TXWxuF8O44zNTUz8': design('A thousand lifetimes of frustration stare out through the samsaran\'s eyes, and the target reels, sickened by the weight of it.', () => [
    cast('Ancient glare', ['eyes.01.dark_purple.single', 'eyes.01.dark_green.single'], { stageId: 'tg', scale: 0.5, duration: 1100 }),
    travel('Despair pours out', ['energy_strands.range.standard.purple.01'], { after: 'tg', anchor: 'start', offset: 400, duration: 1100 }),
    impact('Sickened', ['icon.poison.dark_green'], { after: 'tg', anchor: 'start', offset: 1000, duration: 1500, scale: 0.55 }),
    motion('cower', 'targets', { after: 'tg', anchor: 'start', offset: 1000, duration: 900, intensity: 0.4 }),
  ], { sound: 'whispers' }),

  // Thrash: thrash a grabbed foe around.
  'pf2e:rMPL11JRcmlutvRi': design('The raging barbarian violently thrashes the grabbed foe about, battering it.', () => [
    motion('shake', 'source', { duration: 1000, intensity: 0.5 }),
    motion('shake', 'targets', { delay: 100, duration: 1100, intensity: 0.7 }),
    impact('Battered', FIST2('orange'), { delay: 250, duration: 650, repeats: 2, repeatInterval: 450 }),
  ], { sound: 'unarmed', soundNamespace: 'ability' }),

  // Threatening Pursuit: growl, snort and stamping hooves demoralize foes.
  'pf2e:DJn652sW7nstvXf5': design('Unseen, the minotaur growls, snorts and stamps its hooves; the sound rolls out and every enemy within 30 feet knows it is being hunted.', () => [
    motion('slam', 'source', { duration: 600, intensity: 0.4 }),
    cast('Hoof stamp', DUST, { scale: 0.7, duration: 900, below: true }),
    ...intimidate({ cue: WAVE('red'), cueLabel: 'Growl and snort', cueScale: 1.4, color: 'dark_red', many: true }).filter(s => s.motion !== 'pulse'),
  ], { sound: 'growl', soundNamespace: 'ability' }),

  // Throw and Catch: hurl the warshard weapon; it returns to hand.
  'pf2e:nbwHIS38AgSDquNu': design('The warshard weapon is hurled at the opponent and flies straight back into the wielder\'s hand.', () => [
    motion('throw', 'source', { duration: 700, intensity: 0.5 }),
    travel('Weapon hurled', ['sword.throw.white', 'dagger.throw.01.white'], { stageId: 'tc-t', delay: 250, duration: 900 }),
    impact('Contact', ['impact.005.white', 'impact.005.orange'], { after: 'tc-t', anchor: 'end', duration: 900, scale: 0.6 }),
    travel('Weapon returns', ['sword.throw.white', 'dagger.return.01.white'], { after: 'tc-t', anchor: 'end', offset: 200, duration: 900, mirrorX: true }),
  ], { sound: 'thrown', soundNamespace: 'ability' }),

  // Thunder Clap: hands slam together, sonic cone, deafening.
  'pf2e:37CUdnWwJCfOCC2H': design('Hands slam together and a deafening thunderclap blasts out in a cone, battering every creature in front.', () => [
    motion('pulse', 'source', { duration: 500, intensity: 0.5 }),
    cast('Hands clap', ['impact.005.white', 'impact.005.orange'], { scale: 0.5, duration: 600 }),
    travel('Thunderclap cone', ['soundwave.01.blue'], { stageId: 'tc', delay: 200, duration: 1100, scale: 1.4 }),
    impact('Sonic blast', ['thunderwave.center.blue'], { after: 'tc', anchor: 'end', duration: 1100, scale: 0.8, ...ALL }),
    motion('recoil', 'targets', { after: 'tc', anchor: 'end', duration: 600, intensity: 0.4, ...ALL }),
  ]),

  // Thunderous Landing: Fly and land; a shockwave of air pushes creatures away.
  'pf2e:rkViV16nuFbm6hPj': design('The user swoops down and lands hard; a shockwave of air bursts from the landing and blows nearby creatures back.', () => [
    motion('leap', 'source', { stageId: 'tl', delay: 100, duration: 1400, intensity: 0.6, distance: 1.5, motionRange: 'distance', motionHeading: 'toward', motionEndpoint: 'near' }),
    aura('Landing shockwave', ['thunderwave.center.blue'], { after: 'tl', anchor: 'end', offset: -150, scale: 2.4, duration: 1100 }),
    aura('Air blast', ['smoke.puff.ring.01.white'], { after: 'tl', anchor: 'end', offset: -100, scale: 2.2, duration: 1000, opacity: 0.7 }),
    motion('recoil', 'targets', { after: 'tl', anchor: 'end', duration: 700, intensity: 0.7, ...ALL }),
  ], { sound: 'wind' }),

  // Tidal Hands: waves in the shape of hands rush out.
  'pf2e:rVyEIKeBfX6EQSLs': design('With an emphatic gesture, waves shaped like giant watery hands rush out and slam into the creatures in front.', () => [
    cast('Emphatic gesture', ['cast_generic.water.02.blue'], { scale: 0.8, duration: 900 }),
    impact('Watery hands', ['arcane_hand.blue'], { stageId: 'th', delay: 400, duration: 1500, scale: 0.8, ...ALL }),
    impact('Wave crashes', ['water_splash.circle.01.blue'], { after: 'th', anchor: 'start', offset: 600, duration: 1300, scale: 0.8, ...ALL }),
    motion('recoil', 'targets', { after: 'th', anchor: 'start', offset: 650, duration: 700, intensity: 0.5, ...ALL }),
  ]),

  // Tiger Slash: two-handed tiger claw swipe that pushes the target 5 ft.
  'pf2e:6J2ZSGNsXPKPcJGV': design('A fierce two-handed tiger claw swipe rakes the foe and shoves it back 5 feet.', () => [
    lunge({ intensity: 0.7 }),
    hit('Tiger claws', ['claws.400px.bright_orange', 'claws.200px.red'], { stageId: 'ts', duration: 1100, scale: 0.9 }),
    motion('recoil', 'targets', { after: 'ts', anchor: 'start', offset: 300, duration: 700, intensity: 0.7 }),
  ]),

  // Time Dilation Cascade: six Strikes with borrowed time.
  'pf2e:xM0vwRFLZgmmI4YJ': design('Time dilates around the ranger and six Strikes land in a blur, each echoing the last.', () => [
    cast('Time dilates', ['magic_signs.circle.02.divination.complete.purple', 'extras.tmfx.runes.circle.simple.divination'], { scale: 0.8, duration: 1000 }),
    lunge({ delay: 300, duration: 1600, intensity: 0.4 }),
    sprite('Blurred echoes', { delay: 450, duration: 1600, opacity: 0.4 }),
    impact('Six Strikes', SLASH2, { delay: 450, duration: 500, repeats: 6, repeatInterval: 320 }),
  ]),

  // Too Angry to Die: stand up from prone with a defiant roar; Demoralize.
  'pf2e:oFcn7SDOH6W2QhJl': design('Rising from the ground with a roar of defiance, the furious survivor glares a foe into fear.', () => intimidate({ cue: WAVE('red'), cueLabel: 'Defiant roar', cueScale: 1.1, color: 'dark_red', src: 'levitate', srcIntensity: 0.3 })),

  // Topple the Titans: after tripping a larger foe, make others fall.
  'pf2e:F8V4dN91JmHIOQCv': design('The toppled titan hits the ground with a force that shakes the earth, and the tremor knocks nearby enemies down too.', () => [
    motion('slam', 'targets', { stageId: 'tt-s', duration: 700, intensity: 0.7, targetSelection: 'first' }),
    impact('Titan crashes down', ['impact.ground_crack.02.orange', 'impact.ground_crack.01.orange'], { stageId: 'tt', delay: 250, duration: 1500, scale: 1.3, below: true, targetSelection: 'first' }),
    impact('Shockwave spreads', ['ground_cracks.01.orange'], { after: 'tt', anchor: 'start', offset: 300, duration: 1400, scale: 1, below: true, targetSelection: 'secondary' }),
    motion('stagger', 'targets', { after: 'tt', anchor: 'start', offset: 400, duration: 900, intensity: 0.6, targetSelection: 'secondary' }),
  ], { sound: 'earthquake' }),

  // Torch Goblin: set yourself on fire with an incendiary.
  'pf2e:U5FcfRvveTKtgebq': design('The goblin touches a torch to itself and bursts into flame, happily burning.', () => [
    cast('Ignition', ['impact.fire.01.orange'], { scale: 0.6, duration: 900 }),
    aura('Wreathed in flame', ['flames.01.orange'], { delay: 300, scale: 1, duration: 2400, opacity: 0.9, fadeIn: 200, fadeOut: 600 }),
    motion('shake', 'source', { delay: 250, duration: 700, intensity: 0.3 }),
  ]),

  // Torrent in the Blood: healing wave of water in a 30-ft cone.
  'pf2e:ijsMs8iv9AsHQWrv': design('A cleansing wave of water splashes across the cone and washes creatures with healing that drives out poisons and disease.', () => [
    cast('Water gathers', ['cast_generic.water.02.blue'], { scale: 0.8, duration: 900 }),
    travel('Healing wave', ['water_splash.cone.01.blue'], { stageId: 'tb', delay: 350, duration: 1200 }),
    impact('Cleansing wash', ['impact.water.02.blue'], { after: 'tb', anchor: 'end', duration: 1000, scale: 0.7, ...ALL }),
    impact('Wounds close', ['healing_generic.03.burst.bluegreen'], { after: 'tb', anchor: 'end', offset: 300, duration: 1500, scale: 0.6, ...ALL }),
  ], { sound: 'waterHeal' }),

  // Tremor: small localized tremor in a 10-ft burst.
  'pf2e:r5vSplcFXtTS0kOB': design('A localized tremor shakes the burst: the ground cracks under each creature and they are jolted, the unlucky ones knocked prone.', () => [
    cast('Earth answers', ['cast_generic.earth.01.browngreen'], { scale: 0.8, duration: 900 }),
    impact('Ground cracks', ['ground_cracks.01.orange'], { stageId: 'tr', delay: 350, duration: 1800, scale: 1.1, below: true, ...ALL }),
    motion('shake', 'targets', { after: 'tr', anchor: 'start', offset: 100, duration: 1000, intensity: 0.6, ...ALL }),
    impact('Dust kicks up', DUST, { after: 'tr', anchor: 'start', offset: 400, duration: 1000, scale: 0.6, ...ALL }),
  ]),

  // Trial by Skyfire: blazing bolts fall in a 10-ft emanation around you.
  'pf2e:lUuEX5HVxylRvFAF': design('Murmured portents call down a rain of blazing bolts from the heavens, striking all around the oracle in a 10-foot emanation.', () => [
    cast('Portent murmured', ['cast_generic.fire.01.orange'], { scale: 0.8, duration: 900 }),
    aura('Skyfire falls', ['fireball.beam.orange'], { stageId: 'ts', delay: 400, duration: 600, scale: 0.6, offsetX: 1, offsetY: -1, offsetUnits: 'token', rotation: 90, repeats: 3, repeatInterval: 450 }),
    aura('Burning ground', ['flames.04.loop.orange', 'flames.04.complete.orange'], { delay: 600, duration: 2400, scale: 3, opacity: 0.6, below: true, fadeIn: 300, fadeOut: 600 }),
    impact('Bolts strike', ['impact.fire.01.orange'], { after: 'ts', anchor: 'start', offset: 500, duration: 1000, scale: 0.6, optionalTargets: true, ...ALL }),
  ]),

  // Triangle Shot: three arrows fired at once at a single target.
  'pf2e:62glnJI2o0KnHULB': design('Three arrows strung together leave the bow at once and strike the single target in a tight cluster.', () => [
    motion('recoil', 'source', { delay: 350, duration: 500, intensity: 0.35 }),
    travel('Arrow 1', ARROW, { stageId: 'ta', delay: 300, duration: 1100 }),
    travel('Arrow 2', ARROW, { delay: 300, duration: 1100, offsetY: -0.15, offsetUnits: 'token' }),
    travel('Arrow 3', ARROW, { delay: 300, duration: 1100, offsetY: 0.15, offsetUnits: 'token' }),
    impact('Clustered hits', ['impact.005.white', 'impact.005.orange'], { after: 'ta', anchor: 'end', duration: 1000, scale: 0.8 }),
  ], { sound: 'bow', soundNamespace: 'ability' }),

  // Tumbling Lumber: logs roll in a 10x30-ft line.
  'pf2e:iSnstY2UywUdoBRZ': design('A slew of logs bursts from the Plane of Wood and rolls down the line, flattening terrain and bowling over creatures.', () => [
    cast('Wood gate opens', ['swirling_leaves.complete.01.green'], { scale: 0.8, duration: 900 }),
    projectile('Logs roll', ['rolling_boulder.loop.01.rock.brown'], { stageId: 'tl', delay: 300, duration: 1600, scale: 0.6, ...tint('#8a5a2b') }),
    impact('Bowled over', ['impact.ground_crack.01.orange'], { after: 'tl', anchor: 'end', duration: 1000, scale: 0.7, below: true, ...ALL }),
    motion('roll', 'targets', { after: 'tl', anchor: 'end', duration: 800, intensity: 0.4, distance: 0.6, motionRange: 'distance', motionHeading: 'away', motionEndpoint: 'near', ...ALL }),
  ]),

  // Turn to Mist: Vapor Form.
  'pf2e:bqBCatllklPceA34': design('The user dissolves into a drifting cloud of vapor.', () => [
    cast('Body dissolves', ['smoke.puff.centered.grey'], { scale: 1, duration: 1100 }),
    aura('Vapor form', ['fog_cloud.01.white'], { delay: 300, scale: 1.3, duration: 2400, opacity: 0.75, fadeIn: 400, fadeOut: 600 }),
    sprite('Fading body', { delay: 200, duration: 1500, opacity: 0.4, fadeOut: 900 }),
  ]),

  // Tut-Tut: pull the blow at the last moment and threaten instead.
  'pf2e:0ptK0blZehF3ABha': design('The blow stops a hair short of the target; a wagging finger and a cool look do the rest, leaving the foe frightened.', () => [
    lunge({ intensity: 0.45 }),
    hit('Pulled blow', ['unarmed_strike.no_hit.01.blue', 'unarmed_strike.physical.01.blue'], { stageId: 'tt', duration: 900 }),
    impact('Fear takes hold', FEAR('dark_purple'), { after: 'tt', anchor: 'start', offset: 600, duration: 1500, scale: 0.6 }),
    motion('cower', 'targets', { after: 'tt', anchor: 'start', offset: 650, duration: 900, intensity: 0.4 }),
  ]),

  // Twin Shot Knockdown: two shots, one from each weapon; prone if both hit.
  'pf2e:aWk0JaqVaUf2Cz9a': design('Both loaded weapons fire in turn at the same foe\'s legs, and the twin hits knock it off balance.', () => [
    cast('First muzzle flash', MUZZLE, { scale: 0.5, duration: 500, offsetY: -0.2, offsetUnits: 'token' }),
    travel('First shot', BULLET, { stageId: 'ts-a', delay: 100, duration: 500 }),
    cast('Second muzzle flash', MUZZLE, { delay: 500, scale: 0.5, duration: 500, offsetY: 0.2, offsetUnits: 'token' }),
    travel('Second shot', BULLET, { stageId: 'ts-b', delay: 600, duration: 500 }),
    motion('recoil', 'source', { delay: 100, duration: 900, intensity: 0.35 }),
    impact('Hits land low', ['impact.005.orange'], { after: 'ts-a', anchor: 'end', duration: 800, scale: 0.6, repeats: 2, repeatInterval: 500 }),
    motion('stagger', 'targets', { after: 'ts-b', anchor: 'end', duration: 800, intensity: 0.6 }),
  ], { sound: 'pistol', soundNamespace: 'ability' }),

  // Twin Weakness: weapon Strike with implement pressed in, searing the weakness.
  'pf2e:85xm82Z005CUNBMB': design('The weapon strikes while the thaumaturge presses the implement against the foe, its energies searing the exploited weakness.', () => [
    lunge(),
    hit('Weapon Strike', SLASH, { stageId: 'tw', duration: 1100 }),
    impact('Implement sears', ['impact.011.purple', 'impact.012.blue'], { after: 'tw', anchor: 'start', offset: 350, duration: 1100, scale: 0.7 }),
  ]),

  // Twirling Throw: thrown weapon soars and spins back to the hand.
  'pf2e:WGGLlrhV8cKFn1v0': design('The thrown weapon spins through the air to the distant foe and whirls back into the swashbuckler\'s hand.', () => [
    motion('throw', 'source', { duration: 700, intensity: 0.45 }),
    travel('Weapon spins out', ['dagger.throw.01.white'], { stageId: 'tt', delay: 250, duration: 900 }),
    impact('Contact', ['impact.005.white', 'impact.005.orange'], { after: 'tt', anchor: 'end', duration: 900, scale: 0.6 }),
    travel('Weapon returns', ['dagger.return.01.white'], { after: 'tt', anchor: 'end', offset: 150, duration: 900 }),
  ], { sound: 'thrownDagger', soundNamespace: 'ability' }),

  // Unbalancing Sweep: Shove or Trip up to three enemies.
  'pf2e:pmz1itHp13JtcrjW': design('A great sweep of weapon or fists around the barbarian knocks up to three enemies back or off their feet.', () => [
    motion('spin', 'source', { duration: 900, intensity: 0.3 }),
    cast('Great sweep', ['melee_generic.whirlwind.01.orange'], { scale: 1.4, duration: 1200 }),
    impact('Swept', DUST, { stageId: 'us', delay: 450, duration: 1000, scale: 0.6, ...ALL }),
    motion('stagger', 'targets', { after: 'us', anchor: 'start', duration: 800, intensity: 0.6, ...ALL }),
  ]),

  // Unerring Runic Attraction: ammunition homes in on a rune-bearing foe.
  'pf2e:XXqVhmNeC7bRxQLI': design('The rune on the foe flares like a beacon and the arrow curves unerringly toward it, ignoring cover and concealment.', () => [
    impact('Rune beacon', ['icon.runes.orange'], { scale: 0.45, duration: 1300 }),
    ...shot({ contact: ['impact.005.orange'], flightMs: 1100 }).map(s => (s.delay !== undefined ? { ...s, delay: s.delay + 400 } : s)),
  ], { sound: 'bow', soundNamespace: 'ability' }),

  // Unexpected Shift: phase out of reality briefly to resist damage.
  'pf2e:AgR1OPBHDvwV5wKD': design('The gnome blinks out of reality for a split second, the threat passing through a flickering, half-there body.', () => [
    motion('flicker', 'source', { duration: 900, intensity: 0.7 }),
    cast('Phase shimmer', ['shimmer.01.purple', 'shimmer.01.blue'], { scale: 1, duration: 1200 }),
    sprite('Phasing afterimage', { delay: 100, duration: 900, opacity: 0.4, offsetX: 0.15, offsetUnits: 'token' }),
  ]),

  // Unnerving Expansion: curse maelstrom pours outward; Demoralize.
  'pf2e:JZurhROfi2JfmLfb': design('The curse maelstrom pours outward in a wider dark swirl, and its unnerving pressure frightens a creature within it.', () => [
    aura('Maelstrom expands', ['energy_field.02.below.purple', 'energy_field.02.below.blue'], { delay: 0, scale: 3, duration: 2000, opacity: 0.6, below: true, fadeOut: 500, ...spin(4000) }),
    ...intimidate({ cue: ['smoke.puff.ring.01.dark_black', 'smoke.puff.ring.01.white'], cueLabel: 'Curse pours outward', cueScale: 2.4, cueTint: '#5a2a7a' }),
  ]),

  // Unnerving Prowess: a crit with the Aldori sword unnerves the foe.
  'pf2e:V7bwuYADV8huWeF7': design('A flourish of the Aldori dueling sword after the decisive blow leaves the opponent unnerved.', () => [
    motion('spin', 'source', { duration: 800, intensity: 0.25 }),
    cast('Blade flourish', ['melee_generic.whirlwind.01.orange'], { scale: 0.9, duration: 1000 }),
    impact('Fear takes hold', FEAR('dark_purple'), { delay: 650, duration: 1500, scale: 0.6 }),
    motion('cower', 'targets', { delay: 700, duration: 900, intensity: 0.4 }),
  ]),

  // Unnerving Terror: mighty howl in yaoguai form; enemies within 30 ft frightened.
  'pf2e:eJmloGN2jfKYUNPw': design('In yaoguai form the user unleashes a mighty howl that plants fear in every enemy within 30 feet.', () => intimidate({ cue: WAVE('purple'), cueLabel: 'Mighty howl', cueScale: 1.5, color: 'dark_purple', many: true, srcIntensity: 0.6 })),

  // Unrivaled Retort: defy the area effect and fire a mighty ranged counter.
  'pf2e:kUb7FtYlJPNy4tYv': design('Mythic power flares as the user shrugs off the area effect and looses a mighty counter-shot.', () => [
    cast('Mythic defiance', ['divine_smite.caster.yellowwhite', 'divine_smite.caster.blueyellow'], { scale: 0.7, duration: 900 }),
    ...shot({ contact: ['impact.005.yellow', 'impact.005.orange'], flightMs: 1000 }).map(s => (s.delay !== undefined ? { ...s, delay: s.delay + 500 } : s)),
  ]),

  // Unseat: mounted lance blow to knock a rider off its mount.
  'pf2e:39RJF47FLYr5gZ8p': design('From atop the companion, a jousting thrust slams into the mounted foe and knocks it out of the saddle.', () => [
    lunge({ intensity: 0.7 }),
    hit('Lance thrust', ['spear.melee.01.white'], { stageId: 'un', duration: 1200 }),
    motion('roll', 'targets', { after: 'un', anchor: 'start', offset: 400, duration: 800, intensity: 0.4, distance: 0.7, motionRange: 'distance', motionHeading: 'away', motionEndpoint: 'near' }),
    impact('Thrown from the saddle', DUST, { after: 'un', anchor: 'start', offset: 900, duration: 900, scale: 0.6 }),
  ], { sound: 'spear', soundNamespace: 'ability' }),

  // Unsheathing the Sword-Light: Spellstrike with a sword; light-blades fall around you.
  'pf2e:RtT7r61Yytpe2RlF': design('Drawing the sword releases its light: the Spellstrike lands, and countless blades of light rain down all around the magus.', () => [
    cast('Light unsheathed', ['divine_smite.caster.yellowwhite', 'divine_smite.caster.blueyellow'], { scale: 0.8, duration: 900 }),
    lunge({ delay: 350 }),
    impact('Spellstrike', SLASH, { stageId: 'us', delay: 650, duration: 1100 }),
    aura('Blades of light fall', ['spiritual_weapon.longsword.01.spectral.01.orange', 'spiritual_weapon.greatsword.01.spectral.02.green'], { after: 'us', anchor: 'start', offset: 300, duration: 1600, scale: 1.4, opacity: 0.8, fadeIn: 200, fadeOut: 500, ...tint('#fff2b0') }),
    impact('Light rains on foes', ['impact.005.yellow', 'impact.005.orange'], { after: 'us', anchor: 'start', offset: 700, duration: 1000, scale: 0.6, ...ALL }),
  ]),

  // Vengeful Remnant: wreathed in the tatters of claimed souls.
  'pf2e:6m2oJVzwufgjJi9W': design('Tattered souls claimed by the blade swirl up and wrap the user like a ghostly cloak, warding off harm.', () => [
    cast('Souls rise', ['spirit_guardians.dark_whiteblue.spirits', 'spirit_guardians.blueyellow.ring'], { scale: 1.3, duration: 1400, opacity: 0.85 }),
    aura('Tattered soul cloak', ['spirit_guardians.dark_whiteblue.particles', 'spirit_guardians.blueyellow.ring'], { delay: 600, scale: 1.2, duration: 2000, opacity: 0.7, fadeIn: 300, fadeOut: 500 }),
    motion('brace', 'source', { delay: 300, duration: 900, intensity: 0.35 }),
  ], { sound: 'spirit' }),

  // Vermillion Threads: crimson web of strings fills a 15-ft burst.
  'pf2e:gcDnshdIZVfp9bbz': design('Arcane Cascade sends crimson threads shooting in four directions, weaving a blood-dyed web across a 15-foot burst.', () => [
    cast('Threads shoot out', ['energy_strands.complete.dark_red.01', 'energy_strands.in.green.01'], { scale: 1.3, duration: 1100 }),
    aura('Vermillion web', ['web.complete.002.purplered', 'web.complete.002.white'], { delay: 450, scale: 4, duration: 2400, opacity: 0.8, below: true, fadeOut: 600, ...tint('#c0142a') }),
  ], { sound: 'chainBinding' }),

  // Vexing Tempest: familiar's air spellshape gust pushes creatures.
  'pf2e:IsWrDVtDsWDKTPSi': design('The familiar spins up elemental air; when the air spell lands, a disruptive gust bursts out and sends creatures flying.', () => [
    cast('Air gathers', ['whirlwind.bluegrey'], { scale: 0.8, duration: 1200 }),
    aura('Disruptive gust', ['wind_lines.01.02.white'], { delay: 500, scale: 1.8, duration: 1600, opacity: 0.8, ...spin(1600) }),
  ], { sound: 'wind' }),

  // Vicious Evisceration: maims the foe, drained.
  'pf2e:i3hALsjbjk9FdbGN': design('A vicious, raging cut tears into the foe and blood spills as it is drained.', () => [
    lunge(),
    hit('Vicious cut', HEAVY, { stageId: 've', duration: 1100 }),
    impact('Blood spills', ['liquid.splash_side02.red'], { after: 've', anchor: 'start', offset: 250, duration: 1000, scale: 0.6 }),
    motion('stagger', 'targets', { after: 've', anchor: 'start', offset: 250, duration: 700, intensity: 0.4 }),
  ]),

  // Vine Lash: a long vine sprouts from the arm and whips a creature 30 ft away.
  'pf2e:fYD0SrZhMyJVQgvl': design('A long vine sprouts from the arm and lashes out like a whip across up to 30 feet to slash the target.', () => [
    cast('Vine sprouts', ['vine.complete.nature.single.01.green'], { scale: 0.5, duration: 900 }),
    motion('lunge', 'source', { delay: 300, duration: 600, intensity: 0.4 }),
    travel('Vine whips out', ['energy_strands.range.standard.dark_green.01', 'energy_strands.range.standard.purple.01'], { stageId: 'vl', delay: 400, duration: 900, ...tint('#3e8e2a') }),
    impact('Lash', CLAW('green'), { after: 'vl', anchor: 'end', duration: 1000 }),
  ]),

  // Virulent Strike: a hit that pushes an affliction to progress.
  'pf2e:fns6SMiYrUeL6cnx': design('The Strike lands and the target\'s disease or poison surges sickly green through its body.', () => [
    lunge(),
    hit('Strike', SLASH, { stageId: 'vs', duration: 1100 }),
    impact('Affliction surges', ['impact_themed.poison.greenyellow', 'icon.poison.dark_green'], { after: 'vs', anchor: 'start', offset: 350, duration: 1300, scale: 0.6 }),
  ]),

  // Voice Cold as Death: an icy-toned threat.
  'pf2e:WQtt44keeBP8t25P': design('A threat delivered in a tone so icy it freezes the blood: a chill rolls from the speaker and the target shivers in fear.', () => intimidate({ cue: WAVE('blue'), cueLabel: 'Icy threat', color: 'dark_purple' }).concat([
    impact('Blood runs cold', ['icon.snowflake.blue'], { after: 'dm-fear', anchor: 'start', offset: 250, duration: 1200, scale: 0.4, offsetX: 0.3, offsetUnits: 'token' }),
  ]), { sound: 'fear' }),

  // Volcanic Escape: lava erupts beneath you and the attacker; Leap away.
  'pf2e:7zFdE4RHd9QJTWig': design('Lava explodes beneath the kineticist and the attacker; the attacker is scorched as the kineticist rides the blast in a Leap away.', () => [
    impact('Lava erupts under attacker', ['lava_spout.001.001.complete.orangeyellow'], { delay: 0, duration: 1800, scale: 0.7 }),
    cast('Lava blasts below', ['eruption.orange.01'], { delay: 100, duration: 1200, scale: 0.8, below: true }),
    motion('leap', 'source', { delay: 300, duration: 1200, intensity: 0.5, distance: 1.2, motionRange: 'distance', motionHeading: 'away', motionEndpoint: 'near' }),
    motion('recoil', 'targets', { delay: 350, duration: 700, intensity: 0.4 }),
  ]),

  // Wailing Dead: the spirit horde shrieks; mental damage around it.
  'pf2e:wp9Pnu2qe7GkZgHS': design('The horde of spirits shrieks in unison; a ghostly wail washes over living enemies and fills them with dread.', () => [
    cast('Spirits gather', ['spirit_guardians.dark_whiteblue.spirits', 'spirit_guardians.blueyellow.ring'], { scale: 1.6, duration: 1400, opacity: 0.85 }),
    impact('Unison shriek', WAVE('blue'), { stageId: 'wd', delay: 500, duration: 1200, scale: 1, ...ALL }),
    impact('Dread', ['icon.horror.purple'], { after: 'wd', anchor: 'start', offset: 400, duration: 1400, scale: 0.55, ...ALL }),
    motion('cower', 'targets', { after: 'wd', anchor: 'start', offset: 350, duration: 900, intensity: 0.45, ...ALL }),
  ]),

  // Wake and Tremble: the world convulses; creatures fall prone.
  'pf2e:J3Ewv9D0iAKusDNH': design('The roused world convulses: the ground heaves and cracks beneath every creature, throwing them prone.', () => [
    cast('The world wakes', ['cast_generic.earth.01.browngreen'], { scale: 0.9, duration: 900 }),
    impact('Ground convulses', ['ground_cracks.01.orange'], { stageId: 'wt', delay: 350, duration: 1600, scale: 1.1, below: true, ...ALL }),
    motion('stagger', 'targets', { after: 'wt', anchor: 'start', offset: 200, duration: 900, intensity: 0.6, ...ALL }),
  ], { sound: 'earthquake' }),

  // Wake to Strife: a geyser erupts beneath a prone or swimming foe.
  'pf2e:iAtdHXY6wqL7QRBb': design('The explosive power of a geyser erupts beneath the foe, hurling elemental water up around it.', () => [
    cast('Water called', ['cast_generic.water.02.blue'], { scale: 0.7, duration: 800 }),
    impact('Geyser erupts', ['lava_spout.001.001.complete.blue', 'lava_spout.001.001.complete.orangeyellow'], { stageId: 'ws', delay: 300, duration: 1800, scale: 0.8, ...tint('#5ab4ff') }),
    motion('levitate', 'targets', { after: 'ws', anchor: 'start', offset: 200, duration: 900, intensity: 0.5 }),
    impact('Spray', ['water_splash.circle.01.blue'], { after: 'ws', anchor: 'start', offset: 500, duration: 1200, scale: 0.7 }),
  ]),

  // Walk the Plank: Demoralize and force the target to Stride.
  'pf2e:TzBP8yiZQHNhei1V': design('A pirate\'s threat frightens the foe, who backs away along the path the user chooses.', () => [
    ...intimidate({ cue: WAVE('red'), cueLabel: 'Pirate\'s threat', color: 'dark_red' }).filter(s => s.motion !== 'cower'),
    motion('rush', 'targets', { after: 'dm-fear', anchor: 'start', offset: 400, duration: 1500, intensity: 0.3, distance: 1.5, motionRange: 'distance', motionHeading: 'away', motionEndpoint: 'near' }),
  ]),

  // Warning Shot: fire into the air to Demoralize.
  'pf2e:XQEoKoFtq8n3wgA3': design('The gunslinger fires into the air; the roar of the gun does the talking and the foe flinches in fear.', () => [
    cast('Shot into the air', MUZZLE, { stageId: 'wsf', scale: 0.7, duration: 600, offsetY: -0.6, offsetUnits: 'token', rotation: -90 }),
    cast('Smoke', ['smoke.puff.side.02.white'], { delay: 150, scale: 0.5, duration: 1000, offsetY: -0.6, offsetUnits: 'token', rotation: -90 }),
    motion('recoil', 'source', { duration: 500, intensity: 0.3 }),
    impact('Fear takes hold', FEAR('dark_orange'), { stageId: 'wsr', after: 'wsf', anchor: 'start', offset: 500, duration: 1500, scale: 0.6 }),
    motion('cower', 'targets', { after: 'wsr', anchor: 'start', offset: 100, duration: 900, intensity: 0.45 }),
  ]),

  // Warp Path: fold space to teleport 30 ft, then Strike.
  'pf2e:QRFer8JDgmhb2r7A': design('The veiled user folds space, vanishes and reappears beside the foe to deliver a melee Strike.', () => [
    cast('Space folds', ['misty_step.01.purple', 'misty_step.01.blue'], { scale: 0.9, duration: 1000 }),
    motion('flicker', 'source', { delay: 200, duration: 700, intensity: 0.7 }),
    impact('Reappears', ['misty_step.02.purple', 'misty_step.02.blue'], { stageId: 'wp', delay: 700, duration: 1000, scale: 0.8 }),
    impact('Strike on arrival', SLASH, { after: 'wp', anchor: 'start', offset: 450, duration: 1100 }),
  ], { sound: 'teleport' }),

  // Warped Constriction: tentacles crush a grabbed foe with alien wrongness.
  'pf2e:mUL0C7O4HSnPSXea': design('Tendrils and tentacles unfurl from the user\'s body and crush the grabbed foe, polluting its mind with alien wrongness.', () => [
    motion('pulse', 'source', { duration: 800, intensity: 0.45 }),
    impact('Tentacles crush', ['black_tentacles.dark_purple'], { stageId: 'wc', delay: 200, duration: 1800, scale: 0.6 }),
    motion('press', 'targets', { after: 'wc', anchor: 'start', offset: 300, duration: 1100, intensity: 0.55 }),
    impact('Alien wrongness', ['icon.horror.purple'], { after: 'wc', anchor: 'start', offset: 900, duration: 1200, scale: 0.45 }),
  ], { sound: 'shadow' }),

  // Wave Dashes Rocks: plunging-wave slam; target prone.
  'pf2e:mXQG0WtHHGVyJfZf': design('Like a plunging wave dashing against rocks, the monk hurls the held foe down in a crash of water, leaving it prone.', () => [
    lunge({ intensity: 0.7 }),
    hit('Plunging strike', FIST2('blue'), { stageId: 'wd', duration: 1000 }),
    impact('Wave crashes', ['impact.water.02.blue'], { after: 'wd', anchor: 'start', offset: 200, duration: 1100, scale: 0.9 }),
    motion('slam', 'targets', { after: 'wd', anchor: 'start', offset: 250, duration: 700, intensity: 0.6 }),
  ]),

  // Wave Spiral: whirlpool trips each creature in a 10-ft emanation.
  'pf2e:fLlCodqKXyXbZR7C': design('The monk dips and spins, and a wide whirlpool of water swirls out, sweeping the legs from every creature around.', () => [
    motion('spin', 'source', { duration: 1000, intensity: 0.35 }),
    aura('Whirlpool', ['water_splash.circle.01.blue'], { stageId: 'ws', delay: 200, scale: 4.5, duration: 1500, opacity: 0.85, ...spin(1500) }),
    impact('Legs swept', ['impact.water.02.blue'], { after: 'ws', anchor: 'start', offset: 400, duration: 1000, scale: 0.6, ...ALL }),
    motion('stagger', 'targets', { after: 'ws', anchor: 'start', offset: 450, duration: 800, intensity: 0.55, ...ALL }),
  ], { sound: 'water' }),

  // Weaver's Web: the swarm fills its space with sticky webs.
  'pf2e:9aea3IysGvjKY5tT': design('The spider swarm spins dense, sticky webs over every surface in its space.', () => [
    cast('Swarm spins', ['web.complete.002.white', 'web.02'], { scale: 1, duration: 1500, opacity: 0.85 }),
    aura('Sticky webs', ['web.loop.002.white', 'web.01'], { delay: 900, scale: 1.6, duration: 2000, opacity: 0.8, below: true, fadeIn: 300, fadeOut: 600 }),
  ], { sound: 'swarm' }),

  // Webslinger: the effects of a 2nd-rank Web spell.
  'pf2e:VXAIElMlMnVvz3x5': design('The anadi slings a huge web of silk that splays over the targeted area and the creatures in it.', () => [
    motion('throw', 'source', { duration: 700, intensity: 0.4 }),
    projectile('Silk flung', ['web.02'], { stageId: 'ws', delay: 250, duration: 700, scale: 0.4 }),
    impact('Web splays', ['web.complete.002.white', 'web.01'], { after: 'ws', anchor: 'end', duration: 2000, scale: 1.4, ...ALL }),
  ], { sound: 'chainBinding' }),

  // Weft and Warp: Stride, Strike, swap places, Strike again.
  'pf2e:iqAN2AqnQ6UqpQX6': design('A graceful dance: stride in and strike, swap places with the foe in one step, and strike it again while it is off guard.', () => [
    motion('rush', 'source', { stageId: 'ww-r', delay: 100, duration: 1200, intensity: 0.4, distance: 4, motionRange: 'target', motionHeading: 'toward', motionEndpoint: 'near' }),
    impact('First Strike', SLASH, { stageId: 'ww-a', after: 'ww-r', anchor: 'end', offset: -200, duration: 1000 }),
    motion('dodge', 'targets', { after: 'ww-a', anchor: 'start', offset: 500, duration: 600, intensity: 0.4, distance: 0.5, motionRange: 'distance', motionHeading: 'right', motionEndpoint: 'near' }),
    impact('Second Strike', SLASH2, { after: 'ww-a', anchor: 'start', offset: 1000, duration: 1000 }),
  ]),

  // Wheeling Grab: cartwheel through the foe's space, then Grapple it.
  'pf2e:XlagOGG88w6D3G3Z': design('Shifting into claw stance, the user cartwheels through the foe\'s space and seizes it on the way past.', () => [
    motion('roll', 'source', { stageId: 'wg', delay: 100, duration: 1300, intensity: 0.5, distance: 6, motionRange: 'target', motionHeading: 'toward', motionEndpoint: 'past' }),
    impact('Claw grab', CLAW('red'), { after: 'wg', anchor: 'start', offset: 700, duration: 1000 }),
    motion('press', 'targets', { after: 'wg', anchor: 'start', offset: 800, duration: 800, intensity: 0.4 }),
  ]),

  // Whirling Grindstone: flint grindstone shreds flesh and shoots sparks.
  'pf2e:EVgtfnOPDKpB0bAi': design('A whirling flint grindstone appears beside the foe and grinds into it in a spray of sparks.', () => [
    cast('Stone and metal call', ['cast_generic.earth.01.browngreen'], { scale: 0.7, duration: 800 }),
    impact('Grindstone whirls', ['rolling_boulder.loop.01.rock.brown'], { stageId: 'wg', delay: 350, duration: 1600, scale: 0.6, offsetX: -0.5, offsetUnits: 'token', ...spin(500) }),
    impact('Sparks fly', ['particles.outward.orange.01.01', 'particles.outward.greenyellow.01.01'], { after: 'wg', anchor: 'start', offset: 400, duration: 1200, scale: 0.6 }),
    impact('Shredding contact', CLAW('red'), { after: 'wg', anchor: 'start', offset: 500, duration: 1000 }),
  ], { sound: 'metal' }),

  // Whirling in the Summer Storm: hypnotic petal flurry; foes off guard.
  'pf2e:EqNhUXGFjk99QzCg': design('The monk steps and whirls like a petal in a summer storm, a flurry of drifting petals throwing nearby foes off balance.', () => [
    motion('dodge', 'source', { duration: 700, intensity: 0.3, distance: 0.5, motionRange: 'distance', motionHeading: 'right', motionEndpoint: 'near' }),
    motion('spin', 'source', { delay: 600, duration: 900, intensity: 0.3 }),
    aura('Petal flurry', ['swirling_leaves.outburst.01.pink'], { delay: 600, scale: 2, duration: 1600 }),
    impact('Off balance', ['dizzy_stars.200px.pink', 'dizzy_stars.200px.blueorange'], { delay: 1100, duration: 1300, scale: 0.5, ...ALL }),
  ]),

  // Whirling Knockdown: fire the gun while unbalancing with the blade; prone.
  'pf2e:dloGUhZYG1xUPVE4': design('A quick orchestrated combination: the gun fires as the blade hooks the foe off balance, toppling it to the ground.', () => [
    motion('spin', 'source', { duration: 800, intensity: 0.25 }),
    cast('Gun fires', MUZZLE, { scale: 0.5, duration: 500, offsetX: 0.4, offsetUnits: 'token' }),
    travel('Round', BULLET, { stageId: 'wk-r', delay: 100, duration: 500 }),
    impact('Blade hooks', SLASH, { stageId: 'wk-b', delay: 550, duration: 1000 }),
    motion('slam', 'targets', { after: 'wk-b', anchor: 'start', offset: 350, duration: 700, intensity: 0.55 }),
    impact('Toppled', DUST, { after: 'wk-b', anchor: 'start', offset: 600, duration: 900, scale: 0.6, below: true }),
  ]),

  // Whirlwind Spell: Spellstrike against every enemy in reach.
  'pf2e:iHUuWrvkT2uR0PnK': design('The charged spell rides a whirling flurry: the magus spins and strikes every enemy in reach, magic discharging into each one hit.', () => [
    cast('Spell charges the weapon', ['energy_strands.in.purple.01', 'energy_strands.in.green.01'], { scale: 0.7, duration: 800 }),
    motion('spin', 'source', { delay: 300, duration: 1000, intensity: 0.35 }),
    cast('Whirling flurry', ['melee_generic.whirlwind.01.bluepurple', 'melee_generic.whirlwind.01.orange'], { stageId: 'wsp', delay: 300, scale: 1.4, duration: 1300 }),
    impact('Strikes', SLASH, { after: 'wsp', anchor: 'start', offset: 300, duration: 1000, ...ALL }),
    impact('Spell discharges', ['impact.011.purple', 'impact.012.blue'], { after: 'wsp', anchor: 'start', offset: 600, duration: 1000, scale: 0.7, ...ALL }),
  ]),

  // Whirlwind Strike: Strike each enemy within reach.
  'pf2e:AGydz5DKJ2KHSO4S': design('A spinning whirlwind of steel strikes every enemy within reach.', () => [
    motion('spin', 'source', { duration: 1000, intensity: 0.35 }),
    cast('Whirlwind', ['melee_generic.whirlwind.01.orange'], { stageId: 'wws', scale: 1.4, duration: 1300 }),
    impact('Each foe struck', SLASH2, { after: 'wws', anchor: 'start', offset: 350, duration: 1000, ...ALL }),
    motion('recoil', 'targets', { after: 'wws', anchor: 'start', offset: 450, duration: 600, intensity: 0.35, ...ALL }),
  ]),

  // Whisper on the Wind: a Message carried on a soft wind.
  'pf2e:apKvJtD1Qpvt3O9f': design('A soft whisper is caught by a breeze and carried away toward its distant recipient.', () => [
    cast('Whisper', WAVE('blue'), { scale: 0.4, duration: 900, opacity: 0.6 }),
    cast('Breeze carries it off', ['wind_lines.01.01.white'], { delay: 300, scale: 1, duration: 1500, opacity: 0.8 }),
  ], { sound: null }),

  // Wiles on the Wind: an auditory illusion drifts from a distant square.
  'pf2e:F2i6B8adeIy4LYxk': design('Lies are loosed on a drifting wind: a breeze swirls away and illusory voices murmur from somewhere else.', () => [
    cast('Lies loosed', ['wind_lines.01.01.white'], { scale: 1, duration: 1300 }),
    impact('Illusory voices', ['soundwave.01.purple', 'soundwave.01.blue'], { delay: 700, duration: 1500, scale: 0.6, opacity: 0.7, optionalTargets: true }),
  ]),

  // Winding Flow: two of Stand, Step and Stride.
  'pf2e:vXH0HWMHzevA1Wox': design('The monk flows smoothly through a short Step and a Stride, one movement turning into the next.', () => [
    motion('dodge', 'source', { stageId: 'wf-a', duration: 600, intensity: 0.25, distance: 0.5, motionRange: 'distance', motionHeading: 'right', motionEndpoint: 'near' }),
    motion('rush', 'source', { after: 'wf-a', anchor: 'end', duration: 1300, intensity: 0.3, distance: 1.2, motionRange: 'distance', motionHeading: 'toward', motionEndpoint: 'near' }),
    cast('Flowing wake', ['wind_lines.01.01.white'], { delay: 300, scale: 0.8, duration: 1500, opacity: 0.8 }),
  ]),

  // Wing Buffet: wings batter up to two adjacent creatures.
  'pf2e:tPi6FAnHYe6ijuyk': design('Powerful draconic wings beat outward and batter up to two adjacent creatures away.', () => [
    motion('pulse', 'source', { duration: 700, intensity: 0.5 }),
    cast('Wings beat', ['swirling_feathers.outburst.01.red', 'swirling_feathers.outburst.01.textured'], { scale: 1.3, duration: 1100 }),
    impact('Buffeted', ['wind_lines.01.02.white'], { stageId: 'wb', delay: 350, duration: 900, scale: 0.7, ...ALL }),
    motion('recoil', 'targets', { after: 'wb', anchor: 'start', offset: 150, duration: 700, intensity: 0.6, ...ALL }),
  ], { sound: 'wind' }),

  // Wing Shove: wings spread wide to shove two flanking enemies.
  'pf2e:wvpDbFZZ9I8aAtmg': design('Wings spread wide in a single sweep and shove both flanking enemies away.', () => [
    motion('pulse', 'source', { duration: 700, intensity: 0.5 }),
    cast('Wings spread', ['swirling_feathers.outburst.01.textured'], { scale: 1.4, duration: 1100 }),
    impact('Shoved', ['wind_lines.01.02.white'], { stageId: 'ws', delay: 350, duration: 900, scale: 0.7, ...ALL }),
    motion('recoil', 'targets', { after: 'ws', anchor: 'start', offset: 150, duration: 700, intensity: 0.6, ...ALL }),
  ], { sound: 'wind' }),

  // Wings of Bone and Sinew: destroy a thrall, fuse it into bony wings.
  'pf2e:JDESC0i487ydw2iC': design('A nearby thrall collapses into bone and sinew that streams to the necromancer and knits into gruesome wings.', () => [
    impact('Thrall unmade', ['toll_the_dead.grey.skull_smoke', 'toll_the_dead.green.skull_smoke'], { stageId: 'wb', duration: 1200, scale: 0.7, optionalTargets: true }),
    cast('Bone streams in', ['energy_strands.in.purple.01', 'energy_strands.in.green.01'], { delay: 400, scale: 0.9, duration: 1200, ...tint('#d9d2c0') }),
    aura('Bony wings form', ['swirling_feathers.outburst.01.textured'], { delay: 900, scale: 1.4, duration: 1400, ...tint('#cfc6b0') }),
    motion('levitate', 'source', { delay: 1300, duration: 1100, intensity: 0.4 }),
  ], { sound: 'drain' }),

  // Witchwood Seed: touch to implant a malignant seed.
  'pf2e:S3CAJt6D7r1KcRv8': design('A touch implants a malignant seed; roots and thorny growth burst from the creature\'s body.', () => [
    lunge({ intensity: 0.4 }),
    hit('Seed implanted', ['unarmed_strike.magical.01.green', 'unarmed_strike.magical.01.blue'], { stageId: 'wsd', duration: 900 }),
    impact('Malignant growth', ['vine.complete.nature.single.03.green'], { after: 'wsd', anchor: 'start', offset: 350, duration: 1500, scale: 0.6 }),
    motion('shake', 'targets', { after: 'wsd', anchor: 'start', offset: 450, duration: 800, intensity: 0.4 }),
  ]),

  // Wolf Drag: wolf jaw Strike that knocks the target prone.
  'pf2e:uJpghjJtNbqKUxRd': design('Low to the ground, the monk snaps the wolf jaw closed on the foe and drags it off its feet.', () => [
    lunge({ intensity: 0.7 }),
    hit('Wolf jaw', BITE('grey'), { stageId: 'wd', duration: 1000, scale: 0.8 }),
    motion('slam', 'targets', { after: 'wd', anchor: 'start', offset: 350, duration: 700, intensity: 0.5 }),
    impact('Dragged down', DUST, { after: 'wd', anchor: 'start', offset: 600, duration: 900, scale: 0.6, below: true }),
  ], { sound: 'claw', soundNamespace: 'ability' }),

  // Wood Ward: vines and roots burst up between you and the attacker.
  'pf2e:qW0E05GudC6bRA2Q': design('With a sweep of the hand, vines and roots burst from the ground at the edge of the space, forming a wooden lattice of cover.', () => [
    motion('brace', 'source', { duration: 800, intensity: 0.35 }),
    cast('Roots burst up', ['vine.complete.nature.group.02.green'], { scale: 0.9, duration: 1700, offsetX: 0.45, offsetUnits: 'token' }),
    aura('Wooden lattice', ['aura_themed.01.orbit.complete.wood.01.green'], { delay: 400, scale: 1.2, duration: 1600, opacity: 0.8 }),
  ]),

  // Words, Fly Free: a tattooed rune flies off in a crescent onto foes in a cone.
  'pf2e:iFalS8jTlNgp3hP5': design('The rune flows down the outflung arm and flies through the air in a glowing crescent, tracing itself on each creature in the cone.', () => [
    cast('Tattoo rune flows', ['icon.runes.orange'], { scale: 0.4, duration: 800 }),
    travel('Rune crescent', ['ranged_slash.instant.001.orangeyellow', 'ranged_slash.instant.001.blue'], { stageId: 'wf', delay: 350, duration: 1000, ...ALL }),
    impact('Rune traced', ['icon.runes.orange'], { after: 'wf', anchor: 'end', duration: 1400, scale: 0.45, fadeIn: 200, fadeOut: 400, ...ALL }),
  ]),

  // Worm's Feast: infant cave worms feast on the target's flesh.
  'pf2e:mctOx1S4JnqXkjAc': design('A brood of infant cave worms bursts from the ground beneath the target and writhes over it, gnawing its flesh.', () => [
    cast('Call the brood', ['cast_generic.earth.01.browngreen'], { scale: 0.7, duration: 800 }),
    impact('Worms burst forth', ['burrow.out.01.brown', 'impact.ground_crack.01.orange'], { stageId: 'wf', delay: 350, duration: 1300, scale: 0.8 }),
    impact('Gnawing worms', ['black_tentacles.dark_red', 'black_tentacles.dark_purple'], { after: 'wf', anchor: 'start', offset: 400, duration: 1600, scale: 0.4, ...tint('#b06a7a') }),
    impact('Flesh torn', ['liquid.splash02.red'], { after: 'wf', anchor: 'start', offset: 900, duration: 900, scale: 0.5 }),
    motion('shake', 'targets', { after: 'wf', anchor: 'start', offset: 500, duration: 1000, intensity: 0.45 }),
  ]),

  // Wrapped In Smoke: a powder burn makes a hazy cloud around the innovation.
  'pf2e:VPnkSL25EfrEpPSX': design('A quick, inefficient powder burn belches a hazy grey cloud around the innovation, concealing everything within 5 feet.', () => [
    cast('Powder flares', ['impact.fire.01.orange'], { scale: 0.4, duration: 600 }),
    aura('Smoke billows', ['smoke.plumes.01.grey', 'smoke.plumes.01.grey'], { delay: 200, scale: 2.4, duration: 2600, opacity: 0.85, fadeOut: 700 }),
  ], { sound: 'explosion' }),

  // Wrath of the First Ghoul: maggots burst into the wound with psychic horror.
  'pf2e:csjkzb5dsyZPeOtY': design('The Strike lands and ravenous maggots burst into the wound, whispering Kabriri\'s horrors into the victim\'s mind.', () => [
    lunge(),
    hit('Strike', SLASH, { stageId: 'fg', duration: 1100 }),
    impact('Maggots burst forth', ['impact_themed.poison.greenyellow', 'icon.poison.dark_green'], { after: 'fg', anchor: 'start', offset: 300, duration: 1100, scale: 0.6, ...tint('#e0dcb0') }),
    impact('Ghoulish horror', ['icon.skull.dark_green', 'icon.skull.purple'], { after: 'fg', anchor: 'start', offset: 700, duration: 1300, scale: 0.5 }),
    motion('shake', 'targets', { after: 'fg', anchor: 'start', offset: 400, duration: 800, intensity: 0.45 }),
  ]),

  // Wrathful Presence: erinyes' wrath in a 30-ft aura.
  'pf2e:ykqZmY0CsaV1kyt4': design('The unending wrath of the erinyes flares around the user as a 30-foot aura of crimson fire and fury.', () => [
    cast('Erinyes\' wrath', ['divine_smite.caster.dark_red', 'divine_smite.caster.blueyellow'], { scale: 0.9, duration: 1100, ...tint('#c3192a') }),
    aura('Wrathful aura', ['energy_field.02.below.purple', 'energy_field.02.below.blue'], { delay: 400, scale: 5, duration: 2600, opacity: 0.55, below: true, fadeIn: 400, fadeOut: 700, ...tint('#b3121f'), ...spin(6000) }),
    motion('pulse', 'source', { delay: 300, duration: 900, intensity: 0.4 }),
  ], { sound: 'divineWrath' }),

  // Writhing Runelord Weapon: polearm elongates; Stride and Strike twice.
  'pf2e:ABobcAdaA8p1nHRV': design('The polearm bends and stretches unnaturally as the user strides in and strikes twice from impossible reach.', () => [
    cast('Weapon writhes', ['shimmer.01.purple', 'shimmer.01.blue'], { scale: 0.8, duration: 900 }),
    motion('rush', 'source', { stageId: 'wr', delay: 300, duration: 1200, intensity: 0.35, distance: 3, motionRange: 'target', motionHeading: 'toward', motionEndpoint: 'near' }),
    impact('First thrust', ['spear.melee.01.purple', 'spear.melee.01.white'], { stageId: 'wr-a', after: 'wr', anchor: 'end', offset: -200, duration: 1000 }),
    impact('Second thrust', ['spear.melee.01.purple', 'spear.melee.01.white'], { after: 'wr-a', anchor: 'start', offset: 650, duration: 1000 }),
  ]),

  // You Can't Hide From Us: mark the target for death.
  'pf2e:4znZkQYxrSg7RMxb': design('Following the companion\'s hit, the Strike lands and marks the creature for death; it can no longer hide.', () => [
    lunge(),
    hit('Strike', SLASH, { stageId: 'yc', duration: 1100 }),
    impact('Marked for death', ['hunters_mark.pulse.01.purple', 'hunters_mark.pulse.01.green'], { after: 'yc', anchor: 'start', offset: 400, duration: 1400, scale: 0.7 }),
  ]),

  // You're Next: menace another after downing a foe.
  'pf2e:gjec0ts3wkFbjvHN': design('Standing over the fallen foe, the user fixes a cold stare on the next victim, who shrinks in fear.', () => intimidate({ cue: ['eyes.01.dark_red.single', 'eyes.01.dark_green.single'], cueLabel: 'Cold stare', cueScale: 0.45, color: 'dark_red', src: 'pulse', srcIntensity: 0.3 }), { sound: 'fear' }),

  // Zealous Inevitability: Strike with deity's weapon; target doomed.
  'pf2e:eaw645inkbHNylgC': design('The sacred weapon strikes with zeal and a spectral skull marks the target, brought one step closer to its doom.', () => [
    cast('Zeal kindles', ['divine_smite.caster.yellowwhite', 'divine_smite.caster.blueyellow'], { scale: 0.7, duration: 800 }),
    lunge({ delay: 350 }),
    impact('Sacred Strike', SLASH, { stageId: 'zi', delay: 650, duration: 1100 }),
    impact('Doom marked', ['icon.skull.dark_red', 'icon.skull.purple'], { after: 'zi', anchor: 'start', offset: 450, duration: 1400, scale: 0.5 }),
  ]),

  // Zombie Horde: construct splits into a shambling swarm of corpses.
  'pf2e:5uhKRkYDzLP7v3XY': design('The reanimated construct breaks apart into a shambling swarm of tiny corpses that pours over nearby enemies, clawing at them.', () => [
    cast('Construct splits apart', ['smoke.puff.ring.01.dark_black', 'smoke.puff.ring.01.white'], { scale: 1.4, duration: 1000, ...tint('#6b6248') }),
    aura('Shambling swarm', ['spirit_guardians.dark_black.particles', 'spirit_guardians.blueyellow.ring'], { delay: 300, scale: 2.4, duration: 2200, opacity: 0.8, below: true, fadeOut: 500, ...tint('#6b6248') }),
    impact('Swarm claws', CLAWS('dark_red'), { delay: 800, duration: 1000, scale: 0.7, repeats: 2, repeatInterval: 500, ...ALL }),
    motion('shake', 'targets', { delay: 900, duration: 1100, intensity: 0.4, ...ALL }),
  ], { sound: 'swarm' }),
};
