// Bespoke compositions (dnd5e-items-weapons-a). Keys: '<system>:<entryId>' or '<system>:<entryId>:<variant|mode>'.
// See scripts/catalogs/bespoke/helpers.mjs and scripts/bespoke.mjs.
import { cast, travel, projectile, impact, area, aura, sprite, motion, tint, spin, breathe, design } from './helpers.mjs';

const A = { soundNamespace: 'ability' };
const keep = r => r.stages.filter(s => s.kind !== 'sound');
const hitOf = r => (r.stages.find(s => s.kind === 'impact') ?? r.stages.find(s => s.kind === 'travel') ?? r.stages[0]).stageId;
/** Keep the generated visuals, swap only the sound profile. */
const resound = (why, sound, spell = false) => design(why, ({ recipe }) => keep(recipe), { sound, ...(spell ? {} : A) });
/** Generic melee skeleton: lunge then contact film (stageId 'hit'). */
const swing = (label, assets, o = {}) => [
  motion('lunge', 'source', { stageId: 'sw', duration: 900, distance: 0.22, intensity: 0.6 }),
  impact(label, assets, { stageId: 'hit', delay: 380, duration: 1500, scale: 1.3, ...o }),
];
const reel = (o = {}) => motion('stagger', 'targets', { after: 'hit', anchor: 'start', offset: 300, duration: 700, intensity: 0.5, requiresHit: true, ...o });
const after = (o = {}) => ({ after: 'hit', anchor: 'start', offset: 250, ...o });

// --- natural weapons --------------------------------------------------------
const POISON = ['impact_themed.poison.greenyellow', 'markers.poison.dark_green.01'];
const bite = (why, extra = []) => design(why, () => [
  ...swing('Jaws snap shut', ['bite.400px.red'], { scale: 0.9, duration: 1300 }),
  ...extra,
], { sound: 'naturalPierce', ...A });
const venomBite = why => bite(why, [impact('Venom seeps into the wound', POISON, after({ offset: 350, duration: 1600, scale: 0.7 }))]);

const stoneCreep = why => design(why, () => [
  impact('Grey stone creeps over the flesh', ['cast_generic.earth.01.browngreen'], { stageId: 'st', duration: 1800, scale: 0.9, ...tint('#9a9a94') }),
  impact('Dust sheds as the body stiffens', ['smoke.puff.centered.grey'], { after: 'st', anchor: 'start', offset: 700, duration: 1400, scale: 0.8, opacity: 0.7 }),
  motion('press', 'targets', { after: 'st', anchor: 'start', offset: 300, duration: 1100, intensity: 0.4 }),
], { sound: 'earth' });

const darkTouch = why => design(why, () => [
  ...swing('Withering touch', ['melee_generic.creature_attack.fist.002.purple', 'melee_generic.creature_attack.fist.002.blue'], { scale: 1, duration: 1300, ...tint('#5b3a78') }),
  impact('Necrotic rot blooms', ['toll_the_dead.purple.skull_smoke', 'toll_the_dead.green.skull_smoke'], after({ offset: 300, duration: 1800, scale: 0.8, ...tint('#5b3a78') })),
  reel({ intensity: 0.4 }),
], { sound: 'void' });

// --- staffs that cast named spells -------------------------------------------
const burningHands = why => design(why, () => [
  cast('Thumbs touch, fingers spread', ['cast_generic.fire.01.orange'], { stageId: 'c', duration: 900, scale: 0.7 }),
  area('Fan of flame', ['burning_hands.01.orange'], { stageId: 'f', after: 'c', anchor: 'start', offset: 350, duration: 2200 }),
  motion('recoil', 'targets', { after: 'f', anchor: 'start', offset: 500, duration: 700, intensity: 0.5 }),
], { sound: 'fireCone' });
const fireball = why => design(why, () => [
  cast('Staff tip kindles a bead of fire', ['cast_generic.fire.01.orange'], { stageId: 'c', duration: 1000, scale: 0.8 }),
  travel('Bead streaks to the point', ['fireball.beam.orange'], { stageId: 'b', after: 'c', anchor: 'start', offset: 500, duration: 1300, travelDestination: 'area' }),
  area('Fireball blossoms', ['fireball.explosion.orange'], { stageId: 'x', after: 'b', anchor: 'end', duration: 2600 }),
  motion('stagger', 'targets', { after: 'x', anchor: 'start', offset: 300, duration: 800, intensity: 0.6 }),
], { sound: 'fireball' });
const wallOfFire = why => design(why, () => [
  cast('Staff sweeps a line of heat', ['cast_generic.fire.01.orange'], { stageId: 'c', duration: 900, scale: 0.7 }),
  area('Wall of flame roars up', ['wall_of_fire.300x100.yellow'], { after: 'c', anchor: 'start', offset: 400, duration: 3500, fadeIn: 300, fadeOut: 600 }),
], { sound: 'fireWall' });
const coneOfCold = why => design(why, () => [
  cast('Frost gathers at the staff', ['cast_generic.ice.01.blue', 'cast_generic.02.blue'], { stageId: 'c', duration: 900, scale: 0.7 }),
  area('Cone of cold', ['cone_of_cold.blue'], { stageId: 'f', after: 'c', anchor: 'start', offset: 350, duration: 2500 }),
  motion('stagger', 'targets', { after: 'f', anchor: 'start', offset: 500, duration: 800, intensity: 0.5 }),
], { sound: 'coldCone' });
const fogCloud = why => design(why, () => [
  cast('Mist rolls off the staff', ['cast_generic.water.02.blue'], { stageId: 'c', duration: 900, scale: 0.6 }),
  area('Fog cloud billows', ['fog_cloud.01.white'], { after: 'c', anchor: 'start', offset: 400, duration: 4000, fadeIn: 500, fadeOut: 800 }),
], { sound: 'wind' });
const iceStorm = why => design(why, () => [
  cast('Staff calls the sky', ['cast_generic.ice.01.blue', 'cast_generic.02.blue'], { stageId: 'c', duration: 900, scale: 0.7 }),
  area('Hail hammers down', ['sleet_storm.01.blue'], { stageId: 's', after: 'c', anchor: 'start', offset: 400, duration: 3200 }),
  area('Frozen ground cracks', ['impact.ground_crack.frost.01.white'], { after: 's', anchor: 'start', offset: 600, duration: 2200, below: true }),
  motion('press', 'targets', { after: 's', anchor: 'start', offset: 700, duration: 1000, intensity: 0.5 }),
], { sound: 'cold' });
const wallOfIce = why => design(why, () => [
  cast('Frost gathers at the staff', ['cast_generic.ice.01.blue', 'cast_generic.02.blue'], { stageId: 'c', duration: 900, scale: 0.7 }),
  area('Wall of ice erupts', ['ice_spikes.wall.burst.white'], { after: 'c', anchor: 'start', offset: 400, duration: 2600 }),
], { sound: 'iceWall' });
const cureWounds = why => design(why, () => [
  cast('Healing gathers', ['cast_generic.02.green', 'cast_generic.02.blue'], { stageId: 'c', duration: 900, scale: 0.6 }),
  impact('Wounds knit closed', ['cure_wounds.400px.blue'], { after: 'c', anchor: 'start', offset: 450, duration: 2200, scale: 0.9 }),
], { sound: 'healing' });
const lesserRestoration = why => design(why, () => [
  cast('Cleansing light gathers', ['cast_generic.01.yellow'], { stageId: 'c', duration: 900, scale: 0.6 }),
  impact('Affliction lifts away', ['healing_generic.200px.yellow'], { after: 'c', anchor: 'start', offset: 450, duration: 2000, scale: 0.9 }),
], { sound: 'healing' });
const massCure = why => design(why, () => [
  cast('A wave of healing gathers', ['cast_generic.02.green', 'cast_generic.02.blue'], { stageId: 'c', duration: 1000, scale: 0.9 }),
  impact('Healing washes over each ally', ['healing_generic.03.burst.bluegreen'], { after: 'c', anchor: 'start', offset: 500, duration: 2000, scale: 0.9, targetStagger: 150 }),
], { sound: 'healing' });
const charmPerson = why => design(why, () => [
  cast('Enchantment sigil', ['magic_signs.circle.02.enchantment.complete.pink'], { stageId: 'c', duration: 1400, scale: 0.6, below: true }),
  impact('Hearts flutter over the target', ['impact_themed.heart.02.pink', 'markers.heart.pink.01'], { after: 'c', anchor: 'start', offset: 600, duration: 2000, scale: 0.7 }),
], { sound: 'psychic' });
const command = why => design(why, () => [
  cast('One word of command rings out', ['soundwave.01.purple', 'soundwave.01.blue'], { stageId: 'c', duration: 1000, scale: 0.6, faceTarget: true, ...tint('#c46bd6') }),
  impact('Compulsion binds the listener', ['magic_signs.circle.02.enchantment.complete.pink'], { after: 'c', anchor: 'start', offset: 400, duration: 1600, scale: 0.6, below: true }),
  motion('shake', 'targets', { after: 'c', anchor: 'start', offset: 700, duration: 600, intensity: 0.3 }),
], { sound: 'psychic' });
const comprehend = why => design(why, () => [
  aura('Divination circle', ['magic_signs.circle.02.divination.complete.blue'], { stageId: 'c', duration: 2000, scale: 0.8, below: true }),
  aura('Runes resolve into meaning', ['icon.runes.blue', 'icon.runes.orange'], { after: 'c', anchor: 'start', offset: 500, duration: 1800, scale: 0.5, offsetY: -0.6, offsetUnits: 'token', ...tint('#7fb6ff') }),
], { sound: 'detect' });
const enchantWard = why => design(why, () => [
  aura('Ward against enchantment', ['shield.01.complete.01.purple', 'shield.01.complete.01.blue'], { stageId: 'w', duration: 2000, scale: 0.9, ...tint('#d27fd8') }),
  motion('brace', 'source', { after: 'w', anchor: 'start', offset: 150, duration: 800, intensity: 0.4 }),
], { sound: 'shield' });

// --- life stealing / wounding / sharpness --------------------------------------
const lifeSteal = why => design(why, () => [
  impact('Life is torn from the wound', ['toll_the_dead.purple.skull_smoke', 'toll_the_dead.green.skull_smoke'], { stageId: 'hit', duration: 1800, scale: 0.8, ...tint('#7a1f3a') }),
  travel('Stolen vitality flows back', ['energy_strands.range.standard.dark_red', 'energy_strands.range.standard.purple'], { stageId: 'flow', travelOrigin: 'target', after: 'hit', anchor: 'start', offset: 350, duration: 1400 }),
  aura('Wielder flushes with stolen life', ['energy_strands.in.red.01', 'energy_strands.in.green.01'], { after: 'flow', anchor: 'end', offset: -300, duration: 1400, scale: 0.8, ...tint('#b0203c') }),
  reel({ intensity: 0.4, requiresHit: false }),
], { sound: 'drain' });
const woundBleed = why => design(why, () => [
  impact('The cursed wound bleeds dark', ['liquid.splash.red', 'liquid.splash02.red'], { stageId: 'hit', duration: 1500, scale: 0.7, ...tint('#5e0f1c') }),
  impact('Blood drips', ['markers.drop.red', 'markers.drop.red.01'], after({ offset: 300, duration: 1500, scale: 0.5, offsetY: -0.4, offsetUnits: 'token' })),
  reel({ intensity: 0.35, requiresHit: false }),
], { sound: 'void' });
const woundClose = why => design(why, () => [
  aura('The wound is staunched', ['cure_wounds.200px.red', 'cure_wounds.200px.blue'], { duration: 1800, scale: 0.7, ...tint('#c0475a') }),
], { sound: null });
const sharpness = why => design(why, () => [
  impact('Razor-keen cleave', ['melee_generic.slash.02.002.blue', 'melee_generic.slash.02.002.blue'], { stageId: 'hit', duration: 1200, scale: 1.3, ...tint('#e8eef6') }),
  impact('Blood sprays', ['liquid.splash.red', 'liquid.splash02.red'], after({ offset: 200, duration: 1300, scale: 0.7 })),
  reel({ intensity: 0.7, requiresHit: false }),
], { sound: 'slash' });
const soulRend = why => design(why, () => [
  impact('Sword tears at the life force', ['toll_the_dead.purple.skull_smoke', 'toll_the_dead.green.skull_smoke'], { stageId: 'hit', duration: 2000, scale: 0.9, ...tint('#5b2a7a') }),
  travel('Soul-stuff drawn toward the blade', ['energy_strands.range.standard.purple', 'energy_strands.range.standard.purple.01'], { travelOrigin: 'target', after: 'hit', anchor: 'start', offset: 400, duration: 1400, opacity: 0.85 }),
  reel({ intensity: 0.5, requiresHit: false }),
], { sound: 'drain' });

// --- giant slayer / berserker ----------------------------------------------------
const giantTopple = why => design(why, () => [
  impact('Ground-shaking blow', ['impact.ground_crack.01.white', 'impact.ground_crack.01.orange'], { stageId: 'hit', duration: 1800, scale: 0.9, below: true, ...tint('#b8ad9a') }),
  impact('Dust kicks up', ['smoke.puff.centered.grey'], after({ offset: 200, duration: 1300, scale: 0.8, opacity: 0.7 })),
  motion('stagger', 'targets', { after: 'hit', anchor: 'start', offset: 200, duration: 800, intensity: 0.7 }),
], { sound: 'earth' });
const berserk = why => design(why, () => [
  aura('Blood-red fury rises', ['energy_strands.overlay.dark_red.01', 'energy_strands.overlay.blue.01'], { stageId: 'r', duration: 2200, scale: 0.9, ...tint('#a3121e') }),
  motion('shake', 'source', { after: 'r', anchor: 'start', offset: 200, duration: 900, intensity: 0.5 }),
], { sound: 'battleCry', ...A });

// --- nets --------------------------------------------------------------------
const netThrow = why => design(why, () => [
  motion('throw', 'source', { stageId: 'tw', duration: 900, intensity: 0.6 }),
  impact('Net drops over the target', ['web.complete.002.white'], { stageId: 'hit', delay: 400, duration: 2400, scale: 0.9, ...tint('#c8b48a') }),
], { sound: 'whip', ...A });
const netSave = why => design(why, () => [
  impact('Net tangles the target', ['web.complete.002.white'], { duration: 2400, scale: 0.9, ...tint('#c8b48a') }),
], { sound: 'whip', ...A });

// --- javelin melee -----------------------------------------------------------
const javelinStab = why => design(why, () => swing('Javelin thrust', ['spear.melee.01.white'], { duration: 1600 }), { sound: 'spear', ...A });

// --- returning hammer ---------------------------------------------------------
const hammerHurl = (why, extra = [], sound = 'thrown') => design(why, () => [
  motion('throw', 'source', { duration: 900, intensity: 0.6 }),
  travel('Hammer hurled', ['hammer.throw', 'dagger.throw.01.white'], { stageId: 'fly', delay: 250, duration: 1300, scale: 0.7 }),
  impact('Heavy impact', ['impact.ground_crack.01.white', 'impact.ground_crack.01.orange'], { stageId: 'hit', after: 'fly', anchor: 'end', duration: 1500, scale: 0.6, ...tint('#c9c3b5') }),
  ...extra,
  travel('Hammer flies back to hand', ['hammer.return', 'dagger.return.01.white'], { travelOrigin: 'target', after: 'hit', anchor: 'start', offset: 400, duration: 1200, scale: 0.7 }),
], { sound, ...(sound === 'lightningBolt' ? {} : A) });

// --- bows ------------------------------------------------------------------
const energyArrow = (extra = []) => [
  motion('recoil', 'source', { delay: 200, duration: 600, distance: 0.06, intensity: 0.5 }),
  travel('Golden energy arrow', ['arrow.physical.orange', 'arrow.physical.white.01'], { stageId: 'fly', delay: 200, duration: 1300, scale: 0.7, ...tint('#ffd34d') }),
  ...extra,
];

export default {
  // Bites
  'dnd5e:dnd5e-monsterfeatures24-mmAttach00000000:il0R60nmuwzk4EEU-melee': bite('The creature latches on with its bite; jaws, not a generic stab.'),
  'dnd5e:dnd5e-monsterfeatures24-mmBeak0000000000': bite('A beak strike reads as a snapping peck, not a weapon stab.'),
  'dnd5e:dnd5e-monsterfeatures24-mmBeaks000000000:6RlCHga28e5lNSV4-melee': bite('Snapping beaks rather than a generic piercing film.'),
  'dnd5e:dnd5e-monsterfeatures24-mmBeaks000000000:3m1SLqBeMGQF3UaQ-melee': bite('Snapping beaks rather than a generic piercing film.'),
  'dnd5e:dnd5e-monsterfeatures-WdpSeGqhZpptz37y:LL3fnYXElb0RgP7W-melee': bite('A piercing bite was shown as a sword slash; now a jaw snap.'),
  'dnd5e:dnd5e-monsterfeatures-WdpSeGqhZpptz37y:LL3fnYXElb0RgP7W-ranged': bite('A reach bite is still a bite; the arrow flight was wrong.'),
  'dnd5e:dnd5e-monsterfeatures24-mmBite0000000000': bite('Jaws snap shut on the target.'),
  'dnd5e:dnd5e-monsterfeatures24-mmBites000000000:nrOPHKjj59hG1On3-melee': bite('Several jaws bite; shown as a snapping bite.'),
  'dnd5e:dnd5e-monsterfeatures24-mmBites000000000:3Yo83eZUNwX51AcE-melee': bite('Several jaws bite; shown as a snapping bite.'),
  'dnd5e:dnd5e-monsterfeatures24-mmPetrifyingBite:ShppIfYgKgtWRJwX-melee': bite('The petrifying effect is a separate save; the attack itself is a bite.'),
  'dnd5e:dnd5e-monsterfeatures24-mmBeard000000000': venomBite('Poisonous beard tendrils pierce and leave the target Poisoned.'),
  'dnd5e:dnd5e-monsterfeatures24-mmGouge000000000': design('A gouging strike that leaves the target Poisoned: the venom now shows.', ({ recipe: r }) => [
    ...keep(r), impact('Venom seeps into the wound', POISON, { after: hitOf(r), anchor: 'start', offset: 450, duration: 1600, scale: 0.7 }),
  ], { sound: 'naturalPierce', ...A }),
  'dnd5e:dnd5e-monsterfeatures24-mmPetrifyingBite:udF9lrpAQMvL0b9J': stoneCreep('First failure leaves the target Restrained as flesh begins to turn to stone.'),
  'dnd5e:dnd5e-monsterfeatures24-mmPetrifyingBite:iNhSZ04yZbleLcqc': stoneCreep('Second failure petrifies the target: grey stone overtakes it.'),

  // Claws and natural blows: sound fixes / art fixes
  'dnd5e:dnd5e-monsterfeatures24-mmClaw0000000000': resound('Claw swipe: claw contact sound instead of a punch.', 'claw'),
  'dnd5e:dnd5e-equipment24-dmgClawedGauntle': resound('Clawed gauntlets deal slashing damage; claw contact sound instead of a punch.', 'claw'),
  'dnd5e:dnd5e-monsterfeatures24-mmClaws000000000:sd9m31XuipJgWhlM-melee': design('Grasping claws seize the target, leaving it Grappled and Restrained.', ({ recipe: r }) => [
    ...keep(r), motion('press', 'targets', { after: hitOf(r), anchor: 'start', offset: 400, duration: 900, intensity: 0.4, requiresHit: true }),
  ], { sound: 'claw', ...A }),
  'dnd5e:dnd5e-monsterfeatures24-mmDevilishClaw00': resound('Devilish claw: claw contact sound instead of a punch.', 'claw'),
  'dnd5e:dnd5e-monsterfeatures24-mmRake0000000000': resound('Raking claws: claw contact sound instead of a punch.', 'claw'),
  'dnd5e:dnd5e-monsterfeatures24-mmRend0000000000': resound('Rending claws: claw contact sound instead of a punch.', 'claw'),
  'dnd5e:dnd5e-monsterfeatures24-mmScratch0000000': resound('Scratch: claw contact sound instead of a punch.', 'claw'),
  'dnd5e:dnd5e-monsterfeatures24-mmHooves00000000': resound('Hooves stamp and kick; kick contact sound.', 'kick'),
  'dnd5e:dnd5e-monsterfeatures24-mmGore0000000000:OeVR19Hp2kvxSNZv-melee': resound('Goring horns pierce; natural piercing sound instead of a punch.', 'naturalPierce'),
  'dnd5e:dnd5e-monsterfeatures24-mmGore0000000000:iBenqFiBu40bUxkH-melee': design('Moving gore: the creature charges straight at the target, horns first, and can knock it Prone.', () => [
    motion('rush', 'source', { stageId: 'ch', duration: 1100, distance: 3, intensity: 0.5, motionRange: 'target', motionHeading: 'toward', motionEndpoint: 'near' }),
    impact('Horns drive in', ['melee_generic.piercing.two_handed', 'spear.melee.01.white'], { stageId: 'hit', after: 'ch', anchor: 'end', offset: -250, duration: 1400, scale: 1.3 }),
    reel({ intensity: 0.8 }),
  ], { sound: 'naturalPierce', ...A }),
  'dnd5e:dnd5e-monsterfeatures24-mmRam00000000000': design('Ram: the creature charges and slams into the target, knocking it Prone.', () => [
    motion('rush', 'source', { stageId: 'ch', duration: 1100, distance: 3, intensity: 0.5, motionRange: 'target', motionHeading: 'toward', motionEndpoint: 'near' }),
    impact('Battering impact', ['melee_generic.bludgeoning.two_handed', 'melee_attack.02.club.01'], { stageId: 'hit', after: 'ch', anchor: 'end', offset: -250, duration: 1400, scale: 1.3 }),
    impact('Dust as the target falls', ['smoke.puff.centered.grey'], after({ offset: 350, duration: 1200, scale: 0.7, opacity: 0.7 })),
    reel({ intensity: 0.8 }),
  ], { sound: 'club', ...A }),
  'dnd5e:dnd5e-monsterfeatures24-mmPincer00000000:3L2u4vI16JJ6lA0p-melee': design('A pincer clamps on and Grapples the target.', () => [
    ...swing('Pincer clamps shut', ['melee_generic.creature_attack.pincer.001.red', 'melee_generic.creature_attack.pincer.001.red'], { duration: 1400, scale: 1.1 }),
    motion('press', 'targets', { after: 'hit', anchor: 'start', offset: 400, duration: 900, intensity: 0.4, requiresHit: true }),
  ], { sound: 'claw', ...A }),
  'dnd5e:dnd5e-monsterfeatures24-mmCorruptingTouc': darkTouch('A corrupting touch, not a blade slash: a dark hand leaves necrotic rot.'),
  'dnd5e:dnd5e-monsterfeatures24-mmCursedTouch000': darkTouch('A cursing touch, not a blade slash: necrotic smoke marks the curse.'),
  'dnd5e:dnd5e-monsterfeatures24-mmParalyzingTouc': design('A touch that leaves the target Paralyzed; shown as a numbing touch and stun, not ice spikes.', () => [
    ...swing('Numbing touch', ['melee_generic.creature_attack.fist.002.green', 'melee_generic.creature_attack.fist.002.blue'], { duration: 1300, scale: 1, ...tint('#6b8f5a') }),
    impact('Muscles lock rigid', ['icon.stun.purple', 'markers.stun.purple.01'], after({ offset: 400, duration: 1800, scale: 0.6, offsetY: -0.35, offsetUnits: 'token' })),
    motion('shake', 'targets', { after: 'hit', anchor: 'start', offset: 450, duration: 700, intensity: 0.3, requiresHit: true }),
  ], { sound: 'psychic' }),
  'dnd5e:dnd5e-monsterfeatures24-mmDrainingSwipe0:pZ84SpChkTN52eO6-melee': design('A shadowy swipe that saps Strength: a claw rake that leaves necrotic smoke, not a gathered cast.', () => [
    ...swing('Shadowy swipe', ['melee_generic.creature_attack.claw.002.purple', 'melee_generic.creature_attack.claw.002.red'], { duration: 1400, ...tint('#3c2a55') }),
    impact('Strength drains away', ['toll_the_dead.purple.skull_smoke', 'toll_the_dead.green.skull_smoke'], after({ offset: 350, duration: 1800, scale: 0.7, ...tint('#3c2a55') })),
    reel({ intensity: 0.4 }),
  ], { sound: 'drain' }),
  'dnd5e:dnd5e-monsterfeatures24-mmChain000000000': design('A lashing chain grapples and Restrains the target; chain lash plus binding links, not a blade slash.', () => [
    ...swing('Chain lashes out', ['melee_attack.01.flail.01'], { duration: 1500 }),
    impact('Chains wrap the target', ['markers.chain.standard.complete.02.grey', 'markers.chain.standard.complete.02.red'], after({ offset: 450, duration: 2000, scale: 0.7, ...tint('#a8a8a8') })),
    motion('press', 'targets', { after: 'hit', anchor: 'start', offset: 500, duration: 900, intensity: 0.4, requiresHit: true }),
  ], { sound: 'flail', ...A }),
  'dnd5e:dnd5e-monsterfeatures24-mmHailOfBark0000': design('Hail of Bark flings shards of bark, not a javelin.', () => [
    motion('throw', 'source', { duration: 900, intensity: 0.5 }),
    travel('Shards of bark', ['swirling_leaves.ranged.greenorange'], { stageId: 'fly', delay: 250, duration: 1300, scale: 0.8, ...tint('#7a5230') }),
    impact('Splinters burst', ['impact.005.orange'], { after: 'fly', anchor: 'end', duration: 1200, scale: 0.7, ...tint('#8a6440') }),
  ], { sound: 'thrown', ...A }),

  // Elemental monster weapons: cleaner composites / right sounds
  'dnd5e:dnd5e-monsterfeatures24-mmFlameWhip00000': design('A burning whip lashes, pulls the target in and knocks it Prone; no stray purple explosion.', () => [
    ...swing('Fiery lash', ['melee_generic.slash.01.orange'], { duration: 1300, scale: 1.4 }),
    impact('Flames bite', ['impact.fire.01.orange'], after({ offset: 200, duration: 1600, scale: 0.8 })),
    reel({ intensity: 0.7 }),
  ], { sound: 'whip', ...A }),
  'dnd5e:dnd5e-monsterfeatures24-mmFieryMace00000': design('A burning mace: flaming head and fire burst, without the unrelated purple explosion.', () => [
    ...swing('Flaming mace', ['mace.melee.fire.orange', 'mace.melee.01.white'], { duration: 1600 }),
    impact('Flames burst', ['impact.fire.01.orange'], after({ offset: 150, duration: 1600, scale: 0.8 })),
  ], { sound: 'enchanted-hammer-fire', ...A }),
  'dnd5e:dnd5e-monsterfeatures24-mmLightningBlade': design('A blade crackling with lightning that denies Reactions; the purple explosion was unrelated.', () => [
    ...swing('Sword strike', ['sword.melee.01.blue', 'sword.melee.01.white'], { duration: 1600 }),
    impact('Lightning arcs through the target', ['lightning_ball.blue'], after({ offset: 150, duration: 1500, scale: 0.7 })),
    motion('shake', 'targets', { after: 'hit', anchor: 'start', offset: 300, duration: 600, intensity: 0.4, requiresHit: true }),
  ], { sound: 'enchanted-greatsword-electricity', ...A }),
  'dnd5e:dnd5e-monsterfeatures24-mmFrostAxe000000': resound('Frost Axe: add the ice cue to the axe sound.', 'enchanted-greatsword-cold'),
  'dnd5e:dnd5e-monsterfeatures24-mmSearingFork000': resound('A searing fork is a spear-like thrust; spear-and-flame sound instead of a punch.', 'enchanted-spear-fire'),
  'dnd5e:dnd5e-monsterfeatures24-mmFlameSpear0000:s066Mk4LF1hYNdhB-ranged': resound('Hurled spear: spear release/contact sound.', 'thrownSpear'),
  'dnd5e:dnd5e-monsterfeatures24-mmIceSpear000000:Iwlro2vXHOQQgIWg-ranged': resound('Hurled spear: spear release/contact sound.', 'thrownSpear'),
  'dnd5e:dnd5e-monsterfeatures24-mmHarpoon0000000:hyK7Ua3oC3S3KqGu-melee': resound('Harpoon thrust: spear contact sound instead of a punch.', 'spear'),
  'dnd5e:dnd5e-monsterfeatures24-mmHarpoon0000000:hyK7Ua3oC3S3KqGu-ranged': resound('Hurled harpoon: spear release/contact sound.', 'thrownSpear'),
  'dnd5e:dnd5e-monsterfeatures24-mmHammerThrow000': resound('Thrown hammer: thrown-weapon release/contact sound.', 'thrown'),
  'dnd5e:dnd5e-monsterfeatures24-mmOceanSpear0000:MAToz1axzbPRBhem-melee': design('An ocean spear slows its target with a surge of water, not ice.', () => [
    ...swing('Spear thrust', ['spear.melee.01.blue', 'spear.melee.01.white'], { duration: 1600 }),
    impact('Seawater surges', ['liquid.splash.blue', 'impact.water.02.blue'], after({ offset: 150, duration: 1500, scale: 0.8 })),
    reel({ intensity: 0.4 }),
  ], { sound: 'feat-unarmed-water', ...A }),
  'dnd5e:dnd5e-monsterfeatures24-mmOceanSpear0000:MAToz1axzbPRBhem-ranged': design('Hurled ocean spear lands in a surge of water, then returns.', () => [
    motion('throw', 'source', { duration: 900, intensity: 0.6 }),
    travel('Spear flies', ['spear.throw', 'dagger.throw.01.white'], { stageId: 'fly', delay: 250, duration: 1300, scale: 0.7 }),
    impact('Seawater surges', ['liquid.splash.blue', 'impact.water.02.blue'], { stageId: 'hit', after: 'fly', anchor: 'end', duration: 1500, scale: 0.8 }),
    travel('Spear returns to hand', ['spear.return', 'dagger.return.01.white'], { travelOrigin: 'target', after: 'hit', anchor: 'start', offset: 400, duration: 1100, scale: 0.7 }),
  ], { sound: 'thrownSpear', ...A }),
  'dnd5e:dnd5e-monsterfeatures24-mmOceanSpear0000:MAToz1axzbPRBhem-thrown': design('Hurled ocean spear lands in a surge of water, then returns.', () => [
    motion('throw', 'source', { duration: 900, intensity: 0.6 }),
    travel('Spear flies', ['spear.throw', 'dagger.throw.01.white'], { stageId: 'fly', delay: 250, duration: 1300, scale: 0.7 }),
    impact('Seawater surges', ['liquid.splash.blue', 'impact.water.02.blue'], { stageId: 'hit', after: 'fly', anchor: 'end', duration: 1500, scale: 0.8 }),
    travel('Spear returns to hand', ['spear.return', 'dagger.return.01.white'], { travelOrigin: 'target', after: 'hit', anchor: 'start', offset: 400, duration: 1100, scale: 0.7 }),
  ], { sound: 'thrownSpear', ...A }),
  'dnd5e:dnd5e-monsterfeatures24-mmRadiantFlame00': design('Radiant flame hurled at a foe; the bolt was over 6 s long.', () => [
    cast('Radiance gathers', ['cast_generic.01.yellow'], { stageId: 'c', duration: 900, scale: 0.6 }),
    travel('Radiant bolt', ['guiding_bolt.01.yellow', 'guiding_bolt.01.blueyellow'], { stageId: 'fly', after: 'c', anchor: 'start', offset: 400, duration: 1600, scale: 0.8 }),
    impact('Holy flame engulfs', ['sacred_flame.target.yellow'], { after: 'fly', anchor: 'end', offset: -200, duration: 2200, scale: 0.9 }),
    motion('recoil', 'targets', { after: 'fly', anchor: 'end', duration: 700, intensity: 0.4 }),
  ], { sound: 'radiantRay' }),
  'dnd5e:dnd5e-monsterfeatures24-mmInfernalGlaive:IS4utGV80LpDrjvt': design('An infernal wound bleeds hellfire at the start of each turn.', () => [
    impact('Infernal wound bleeds', ['liquid.splash.red', 'liquid.splash02.red'], { stageId: 'hit', duration: 1400, scale: 0.7, ...tint('#7a1010') }),
    impact('Hellfire licks the wound', ['impact.fire.01.orange'], after({ offset: 200, duration: 1500, scale: 0.6, ...tint('#c0281a') })),
    reel({ intensity: 0.35, requiresHit: false }),
  ], { sound: 'fire' }),

  // Javelins in melee: a thrust, not a club
  'dnd5e:dnd5e-equipment24-phbwepJavelin000:r1hUkUrLD8kqx8X0-melee': javelinStab('A javelin in melee is a short spear thrust, not a bludgeoning blow.'),
  'dnd5e:dnd5e-items-DWLMnODrnHn8IbAG:dnd5eactivity000-melee': javelinStab('A javelin in melee is a short spear thrust, not a bludgeoning blow.'),
  'dnd5e:dnd5e-items-idtlcnIWgwVdvp31:dnd5eactivity000-melee': javelinStab('A javelin in melee is a short spear thrust, not a bludgeoning blow.'),
  'dnd5e:dnd5e-items-gV671PZGnYoVZefN:dnd5eactivity000-melee': javelinStab('A javelin in melee is a short spear thrust, not a bludgeoning blow.'),
  'dnd5e:dnd5e-items-FhtjbeBeP4q5vTyc:dnd5eactivity000-melee': javelinStab('A javelin in melee is a short spear thrust, not a bludgeoning blow.'),
  'dnd5e:dnd5e-equipment24-dmgJavelinOfLigh:i20Sq0KrXu1Cu54H-melee': design('Javelin of Lightning in melee: a spear thrust that can deal lightning.', () => [
    ...swing('Javelin thrust', ['spear.melee.01.white'], { duration: 1600 }),
    impact('Lightning crackles', ['lightning_ball.blue'], after({ offset: 150, duration: 1400, scale: 0.6 })),
  ], { sound: 'spear', ...A }),

  // Javelin of Lightning (2014): becomes a bolt of lightning
  'dnd5e:dnd5e-items-LEC1wkaAUnWzDPDD:dnd5eactivity000-ranged': design('Hurled and spoken, the javelin becomes a bolt of lightning that strikes its target.', () => [
    motion('throw', 'source', { duration: 900, intensity: 0.6 }),
    travel('Javelin becomes a lightning bolt', ['lightning_bolt.narrow.blue'], { stageId: 'fly', delay: 250, duration: 1300 }),
    impact('Lightning strikes', ['lightning_strike.blue', 'lightning_ball.blue'], { after: 'fly', anchor: 'end', offset: -300, duration: 1500, scale: 0.8 }),
    motion('shake', 'targets', { after: 'fly', anchor: 'end', duration: 600, intensity: 0.5 }),
  ], { sound: 'lightningBolt' }),
  'dnd5e:dnd5e-items-LEC1wkaAUnWzDPDD:dnd5eactivity000-thrown': design('Hurled and spoken, the javelin becomes a bolt of lightning that strikes its target.', () => [
    motion('throw', 'source', { duration: 900, intensity: 0.6 }),
    travel('Javelin becomes a lightning bolt', ['lightning_bolt.narrow.blue'], { stageId: 'fly', delay: 250, duration: 1300 }),
    impact('Lightning strikes', ['lightning_strike.blue', 'lightning_ball.blue'], { after: 'fly', anchor: 'end', offset: -300, duration: 1500, scale: 0.8 }),
    motion('shake', 'targets', { after: 'fly', anchor: 'end', duration: 600, intensity: 0.5 }),
  ], { sound: 'lightningBolt' }),
  'dnd5e:dnd5e-items-LEC1wkaAUnWzDPDD:dnd5eactivity100': design('The bolt forms a 5-foot-wide line; everyone in it saves against lightning.', () => [
    motion('throw', 'source', { duration: 900, intensity: 0.6 }),
    area('Lightning line', ['lightning_bolt.wide.blue'], { stageId: 'l', delay: 300, duration: 1800 }),
    motion('shake', 'targets', { after: 'l', anchor: 'start', offset: 300, duration: 600, intensity: 0.5 }),
  ], { sound: 'lightningBolt' }),

  // Nets
  'dnd5e:dnd5e-items-rJKXDPikXSYXYgb5:dnd5eactivity000-ranged': netThrow('A thrown net entangles the target; the arrow flight was wrong.'),
  'dnd5e:dnd5e-items-rJKXDPikXSYXYgb5:dnd5eactivity000-thrown': netThrow('A thrown net entangles the target; the arrow flight was wrong.'),
  'dnd5e:dnd5e-items-rJKXDPikXSYXYgb5:dnd5eactivity100': netSave('Escaping the net: the net still binds the target, not a burst of light.'),
  'dnd5e:dnd5e-items-hHX5qXva1ScCpBpL:dnd5eactivity000-ranged': netThrow('A thrown net entangles the target; the arrow flight was wrong.'),
  'dnd5e:dnd5e-items-hHX5qXva1ScCpBpL:dnd5eactivity000-thrown': netThrow('A thrown net entangles the target; the arrow flight was wrong.'),
  'dnd5e:dnd5e-items-hHX5qXva1ScCpBpL:dnd5eactivity100': netSave('Escaping the net: the net still binds the target, not a burst of light.'),
  'dnd5e:dnd5e-items-iIuNqnpWCHrLEKWj:dnd5eactivity000-ranged': netThrow('A thrown net entangles the target; the arrow flight was wrong.'),
  'dnd5e:dnd5e-items-iIuNqnpWCHrLEKWj:dnd5eactivity000-thrown': netThrow('A thrown net entangles the target; the arrow flight was wrong.'),
  'dnd5e:dnd5e-items-iIuNqnpWCHrLEKWj:dnd5eactivity100': netSave('Escaping the net: the net still binds the target, not a burst of light.'),

  // Firearms and blowguns: right sound
  'dnd5e:dnd5e-equipment24-phbwepMusket0000': design('A musket shot: muzzle flash and powder smoke with a musket report.', ({ recipe: r }) => [
    ...keep(r),
    cast('Muzzle flash', ['muzzle_flash.single.01.yellow'], { delay: 250, duration: 600, scale: 0.6, faceTarget: true }),
    aura('Powder smoke', ['smoke.puff.side.grey'], { delay: 300, duration: 1300, scale: 0.5, opacity: 0.6, fadeOut: 400 }),
  ], { sound: 'musket', ...A }),
  'dnd5e:dnd5e-equipment24-phbwepPistol0000': design('A pistol shot: muzzle flash with a pistol report.', ({ recipe: r }) => [
    ...keep(r),
    cast('Muzzle flash', ['muzzle_flash.single.01.yellow'], { delay: 250, duration: 600, scale: 0.45, faceTarget: true }),
  ], { sound: 'pistol', ...A }),
  'dnd5e:dnd5e-equipment24-phbwepBlowgun000': resound('Blowgun: dart release sound.', 'blowgun'),
  'dnd5e:dnd5e-items-wNWK6yJMHG9ANqQV': resound('Blowgun: dart release sound.', 'blowgun'),
  'dnd5e:dnd5e-items-N8XNP3vjVZmM2r9S': resound('Blowgun: dart release sound.', 'blowgun'),
  'dnd5e:dnd5e-items-fu7DJcrYWfGMeVt9': resound('Blowgun: dart release sound.', 'blowgun'),
  'dnd5e:dnd5e-items-HQJ8tiyyrJJSUSyF': resound('Blowgun: dart release sound.', 'blowgun'),

  // Quarterstaff of the Acrobat
  'dnd5e:dnd5e-equipment24-dmgQuarterstaffO:BnEnq9qMA5GTF4Rr-thrown': design('The staff is thrown like a javelin and flies straight back to your hand.', () => [
    motion('throw', 'source', { duration: 900, intensity: 0.6 }),
    travel('Staff flies', ['javelin.01.throw', 'dagger.throw.01.white'], { stageId: 'fly', delay: 250, duration: 1200, scale: 0.7 }),
    impact('Staff strikes', ['impact.007.yellow'], { stageId: 'hit', after: 'fly', anchor: 'end', duration: 1000, scale: 0.6, ...tint('#7fd67f') }),
    travel('Staff returns to hand', ['javelin.01.return', 'dagger.return.01.white'], { travelOrigin: 'target', after: 'hit', anchor: 'start', offset: 300, duration: 1100, scale: 0.7 }),
  ], { sound: 'thrownSpear', ...A }),
  'dnd5e:dnd5e-equipment24-dmgQuarterstaffO:uGF83fO9tijt8I01': design('Attack Deflection: you twirl the staff around you for +5 AC against the attack.', () => [
    aura('Staff twirls in a green blur', ['melee_generic.whirlwind.01.greenyellow', 'melee_generic.whirlwind.01.orange'], { stageId: 'w', duration: 1300, scale: 1.1, ...tint('#7fd67f') }),
    motion('brace', 'source', { after: 'w', anchor: 'start', duration: 900, intensity: 0.5 }),
  ], { sound: 'staff', ...A }),

  // Dancing Sword (2024)
  'dnd5e:dnd5e-equipment24-dmgDancingSword0:FztT9hvr1r8FV8kK': design('You toss the sword into the air; it flies up to 30 feet and attacks on its own.', () => [
    motion('throw', 'source', { duration: 800, intensity: 0.5 }),
    travel('Sword flies off', ['sword.throw.white', 'dagger.throw.01.white'], { stageId: 'fly', delay: 250, duration: 1100, scale: 0.7 }),
    impact('The hovering sword strikes', ['spiritual_weapon.longsword.01.spectral.02.green'], { after: 'fly', anchor: 'end', duration: 2200, scale: 0.9, ...tint('#cfe3ff') }),
  ], { sound: 'sword', ...A }),
  'dnd5e:dnd5e-equipment24-dmgDancingSword0:qQ7MztRj7Iuv2EyK': design('You toss the sword into the air; it flies up to 30 feet and attacks on its own.', () => [
    motion('throw', 'source', { duration: 800, intensity: 0.5 }),
    travel('Sword flies off', ['sword.throw.white', 'dagger.throw.01.white'], { stageId: 'fly', delay: 250, duration: 1100, scale: 0.7 }),
    impact('The hovering sword strikes', ['spiritual_weapon.rapier.01.spectral.02.green'], { after: 'fly', anchor: 'end', duration: 2200, scale: 0.9, ...tint('#cfe3ff') }),
  ], { sound: 'rapier', ...A }),
  'dnd5e:dnd5e-equipment24-dmgDancingSword0:HjoCaTF4RcIkhGqc': design('The sword rises to hover at your side, ready to dance.', () => [
    aura('Sword hovers beside you', ['spiritual_weapon.longsword.01.spectral.02.green'], { duration: 2400, scale: 0.6, offsetX: 0.55, offsetUnits: 'token', fadeIn: 300, fadeOut: 500, ...tint('#cfe3ff') }),
  ], { sound: null }),

  // Bows
  'dnd5e:dnd5e-equipment24-dmgEnergyBow0000:JHQrREvLMhTq53nr-ranged': design('The stringless bow looses a glowing golden arrow that deals Force damage.', () => energyArrow([
    impact('Golden force burst', ['impact.006.yellow'], { after: 'fly', anchor: 'end', duration: 1200, scale: 0.7 }),
  ]), { sound: 'longbow', ...A }),
  'dnd5e:dnd5e-equipment24-dmgEnergyBow0000:fBce4PkKN7HiCmRd': design('Arrow of Transport: the arrow teleports the target to a space within 10 feet of you.', () => energyArrow([
    impact('Target vanishes in golden light', ['misty_step.01.yellow', 'misty_step.01.blue'], { after: 'fly', anchor: 'end', duration: 1500, scale: 0.8, ...tint('#ffd34d') }),
    motion('flicker', 'targets', { after: 'fly', anchor: 'end', offset: 200, duration: 900, intensity: 0.6 }),
  ]), { sound: 'teleport' }),
  'dnd5e:dnd5e-equipment24-dmgEnergyBow0000:oR4052opJWNiSVdQ': design('Arrow of Restraint: golden bonds Restrain the target instead of dealing damage.', () => energyArrow([
    impact('Golden bonds snap tight', ['markers.chain.standard.complete.02.yellow', 'web.complete.002.white'], { after: 'fly', anchor: 'end', duration: 2000, scale: 0.7, ...tint('#ffd34d') }),
    motion('press', 'targets', { after: 'fly', anchor: 'end', offset: 200, duration: 900, intensity: 0.4 }),
  ]), { sound: 'chainBinding' }),
  'dnd5e:dnd5e-monsterfeatures24-mmEnchantingBow0': design('An enchanting arrow leaves the target Charmed.', ({ recipe: r }) => [
    ...keep(r),
    impact('Charm takes hold', ['impact_themed.heart.02.pink', 'markers.heart.pink.01'], { after: hitOf(r), anchor: 'start', offset: 250, duration: 1800, scale: 0.6, requiresHit: true }),
  ]),
  'dnd5e:dnd5e-equipment24-dmgOathbow000000:wBvt7GZJkhTta6By-ranged': design('Arrow at your sworn enemy: a longbow shot that marks the foe.', ({ recipe: r }) => [
    ...keep(r),
    impact('Sworn enemy marked', ['hunters_mark.pulse.01.green'], { after: hitOf(r), anchor: 'start', offset: 200, duration: 1600, scale: 0.6 }),
  ], { sound: 'longbow', ...A }),
  'dnd5e:dnd5e-equipment24-dmgOathbow000000:hQyhQEtRT1J0ks2q': design('The bow whispers in Elvish as you nock an arrow; a faint green hunter glow, not void smoke.', () => [
    aura('Elvish whisper', ['hunters_mark.pulse.01.green'], { duration: 1600, scale: 0.6, offsetY: -0.4, offsetUnits: 'token' }),
  ], { sound: 'whispers' }),
  'dnd5e:dnd5e-equipment24-dmgOathbow000000:kq0kzDyPVPzx5iXr': design('Swear Oath: the target becomes your sworn enemy, marked for swift death.', () => [
    impact('Sworn enemy marked', ['hunters_mark.loop.01.green', 'hunters_mark.pulse.01.green'], { duration: 2200, scale: 0.6, fadeIn: 200, fadeOut: 500 }),
  ], { sound: 'whispers' }),
  'dnd5e:dnd5e-items-mGIwk9FwTAJB6qTn:D5yTXUwcRcP6znlD': design('Extra piercing damage against your sworn enemy: the mark flares as the arrow bites.', () => [
    impact('Sworn-enemy mark flares', ['hunters_mark.pulse.01.green'], { stageId: 'hit', duration: 1500, scale: 0.7 }),
    impact('Arrow bites deep', ['impact.009.orange'], after({ offset: 100, duration: 1000, scale: 0.5, ...tint('#9fd18a') })),
  ], { sound: 'pierce' }),

  // Dwarven Thrower: always returns
  'dnd5e:dnd5e-equipment24-dmgDwarvenThrowe:bd1kKOncfoLha8CT-thrown': hammerHurl('The hammer flies, strikes with extra force and flies back to your hand.', [impact('Force burst', ['explosion.02.purple', 'explosion.02.blue'], { after: 'hit', anchor: 'start', duration: 1300, scale: 0.5 })]),
  'dnd5e:dnd5e-equipment24-dmgDwarvenThrowe:w3ATyMSroDLch6Re-ranged': hammerHurl('The hammer flies, strikes with extra force and flies back to your hand.', [impact('Force burst', ['explosion.02.purple', 'explosion.02.blue'], { after: 'hit', anchor: 'start', duration: 1300, scale: 0.5 })]),
  'dnd5e:dnd5e-equipment24-dmgDwarvenThrowe:w3ATyMSroDLch6Re-thrown': hammerHurl('The hammer flies, strikes with extra force and flies back to your hand.', [impact('Force burst', ['explosion.02.purple', 'explosion.02.blue'], { after: 'hit', anchor: 'start', duration: 1300, scale: 0.5 })]),
  'dnd5e:dnd5e-items-kvD4ElYCfCKpjDeg:nrzlvqGr1Iv0fAa0-ranged': hammerHurl('The hammer strikes and immediately flies back to your hand.'),
  'dnd5e:dnd5e-items-kvD4ElYCfCKpjDeg:KNkfMHvoRKvrWQbV-ranged': hammerHurl('Against a giant the hammer lands harder, then flies back to your hand.', [motion('stagger', 'targets', { after: 'hit', anchor: 'start', duration: 800, intensity: 0.6 })]),

  // Hammer of Thunderbolts
  'dnd5e:dnd5e-equipment24-dmgHammerOfThund:ArjEe6ID0twOfNfA-ranged': hammerHurl('On a hit the hammer unleashes a thunderclap; creatures within 30 feet save or are Stunned. Then it returns.', [
    impact('Thunderclap', ['shatter.blue'], { after: 'hit', anchor: 'start', duration: 1800, scale: 2.2 }),
    motion('shake', 'targets', { after: 'hit', anchor: 'start', offset: 200, duration: 700, intensity: 0.6 }),
  ], 'sonic'),
  'dnd5e:dnd5e-items-wGDDt17DpBcXPuUD:HUaufCvw2ISsEtbL-ranged': hammerHurl('On a hit the hammer unleashes a thunderclap audible 300 feet away, then returns.', [
    impact('Thunderclap', ['shatter.blue'], { after: 'hit', anchor: 'start', duration: 1800, scale: 2.2 }),
    motion('shake', 'targets', { after: 'hit', anchor: 'start', offset: 200, duration: 700, intensity: 0.6 }),
  ], 'sonic'),
  'dnd5e:dnd5e-items-wGDDt17DpBcXPuUD:raoOPd1C5wdDhOed': design('Thunderclap: every creature within 30 feet saves or is Stunned.', () => [
    area('Thunderclap rolls outward', ['shatter.blue'], { stageId: 't', duration: 1800 }),
    motion('shake', 'targets', { after: 't', anchor: 'start', offset: 250, duration: 700, intensity: 0.6 }),
  ], { sound: 'sonic' }),
  'dnd5e:dnd5e-items-wGDDt17DpBcXPuUD:dnd5eactivity100': design("Giant's Bane: on a natural 20 the giant must save or die; lightning and thunder fall on it, not on you.", () => [
    impact('Thunderbolt strikes the giant', ['lightning_strike.blue'], { stageId: 'hit', duration: 1500, scale: 1 }),
    impact('Thunder rolls', ['shatter.blue'], after({ offset: 150, duration: 1600, scale: 1.2 })),
    reel({ intensity: 0.7, requiresHit: false }),
  ], { sound: 'lightningBolt' }),
  'dnd5e:dnd5e-equipment24-dmgHammerOfThund:VwpaQcj4wp0XLazq': design("Giants' Bane: on a natural 20 the giant must save or die; a thunderbolt strikes it.", () => [
    impact('Thunderbolt strikes the giant', ['lightning_strike.blue'], { stageId: 'hit', duration: 1500, scale: 1 }),
    impact('Thunder rolls', ['shatter.blue'], after({ offset: 150, duration: 1600, scale: 1.2 })),
    reel({ intensity: 0.7, requiresHit: false }),
  ], { sound: 'lightningBolt' }),

  // Giant Slayer: giant knocked Prone
  'dnd5e:dnd5e-equipment24-dmgGiantSlayer00:RYyb1MBEt8avd2sN-melee': design('Against a Giant the blow lands with extra force and can knock it Prone.', () => [
    ...swing('Heavy blow', ['melee_generic.slashing.two_handed', 'melee_attack.03.greatsword.01'], { duration: 1500 }),
    impact('Ground-shaking impact', ['impact.ground_crack.01.white', 'impact.ground_crack.01.orange'], after({ offset: 200, duration: 1600, scale: 0.8, below: true, ...tint('#b8ad9a') })),
    reel({ intensity: 0.8 }),
  ], { sound: 'greatsword', ...A }),
  'dnd5e:dnd5e-items-YM6bZNmpync83VFa:iV0NKcP1qCn0Nklw': giantTopple('The giant must save or fall Prone: a ground-shaking topple, not a purple flash.'),
  'dnd5e:dnd5e-items-jmSC8I5awCoxNVv7:dnd5eactivity100': giantTopple('The giant must save or fall Prone: a ground-shaking topple, not a purple flash.'),
  'dnd5e:dnd5e-items-nBFr5xTWeChM7xrb:Wpptd4MNJ1ZJOmR1': giantTopple('The giant must save or fall Prone: a ground-shaking topple, not a purple flash.'),
  'dnd5e:dnd5e-items-F3rQcaZvElNEiudk:LUhQwym7xlIj3uSJ': giantTopple('The giant must save or fall Prone: a ground-shaking topple, not a purple flash.'),
  'dnd5e:dnd5e-items-xw2kL7Puwg4wfjW3:NQobq0yfYvud5Q26': giantTopple('The giant must save or fall Prone: a ground-shaking topple, not a purple flash.'),
  'dnd5e:dnd5e-items-I5PWgE4IF40Iv9h4:pyfZl6LF9gpRxncA': giantTopple('The giant must save or fall Prone: a ground-shaking topple, not a purple flash.'),
  'dnd5e:dnd5e-items-ZLpj1bpnWlAFUEHE:aUiTK0NUu2QB61JJ': giantTopple('The giant must save or fall Prone: a ground-shaking topple, not a purple flash.'),
  'dnd5e:dnd5e-items-tTqixDDmzAfs995G:1R1nLwZsyGZLakMP': giantTopple('The giant must save or fall Prone: a ground-shaking topple, not a purple flash.'),

  // Berserker curse
  'dnd5e:dnd5e-items-dvNzJqb7vq6oJlA2:dnd5eactivity100': berserk('The cursed axe demands a Wisdom save or you go berserk; red fury on the wielder, not a purple hit.'),
  'dnd5e:dnd5e-items-zSKorO6lwT7vs2uk:dnd5eactivity100': berserk('The cursed axe demands a Wisdom save or you go berserk; red fury on the wielder, not a purple hit.'),
  'dnd5e:dnd5e-items-gwuffGC4JZ8BbStz:dnd5eactivity100': berserk('The cursed axe demands a Wisdom save or you go berserk; red fury on the wielder, not a purple hit.'),

  // Sharpness / Life Stealing / Wounding / Nine Lives
  'dnd5e:dnd5e-items-QB4CFMTLR6JlD7Kq:Jd1o40IKHttO92Ao': sharpness('A natural 20 deals 4d6 extra slashing: a razor cleave, not holy light.'),
  'dnd5e:dnd5e-items-8MNDhKb1Q87QszOJ:VtVWAxEUk3kzDKAg': sharpness('A natural 20 deals 4d6 extra slashing: a razor cleave, not holy light.'),
  'dnd5e:dnd5e-items-ZKyhkS8ud2NpV7ng:q3i57l0zxELku4X2': sharpness('A natural 20 deals 4d6 extra slashing: a razor cleave, not holy light.'),
  'dnd5e:dnd5e-items-sdHSbitJxgTX6aDG:TedE68TgKKdBwLMY': lifeSteal('A natural 20 deals necrotic damage and you gain that much temporary HP: life flows from target to wielder.'),
  'dnd5e:dnd5e-items-wtctR6tCcYbQPiS0:CWAihMKs4f25qvEL': lifeSteal('A natural 20 deals necrotic damage and you gain that much temporary HP: life flows from target to wielder.'),
  'dnd5e:dnd5e-items-p01JzD9RpIOkJiqK:tppFD0iK7mJ9AKYp': lifeSteal('A natural 20 deals necrotic damage and you gain that much temporary HP: life flows from target to wielder.'),
  'dnd5e:dnd5e-items-sfegfmo59MHJg2YC:Otct9yMzjfFYqwhW': lifeSteal('A natural 20 deals necrotic damage and you gain that much temporary HP: life flows from target to wielder.'),
  'dnd5e:dnd5e-items-902yxeFDwavpm6cv:rXta0GJfFQ1Kaz14': lifeSteal('A natural 20 deals necrotic damage and you gain that much temporary HP: life flows from target to wielder.'),
  'dnd5e:dnd5e-items-JpwuGtFkfrGibQpP:Y58MGQ57f4jdOsYs': woundBleed('The wound reopens each turn for necrotic damage: dark blood, not a cast circle.'),
  'dnd5e:dnd5e-items-pG6dddIcb9NmPrdt:uPvWgQrAZHbnZFr0': woundBleed('The wound reopens each turn for necrotic damage: dark blood, not a cast circle.'),
  'dnd5e:dnd5e-items-KJYqNZgdkRwPmPMl:RUsmZZ5pds5Ne5PI': woundBleed('The wound reopens each turn for necrotic damage: dark blood, not a cast circle.'),
  'dnd5e:dnd5e-items-L4PxYPtYca283sju:3k60lSocT40gjL0w': woundBleed('The wound reopens each turn for necrotic damage: dark blood, not a cast circle.'),
  'dnd5e:dnd5e-items-SpbjbMMoJiva2zOa:sMuNK1s4Dtvl9KXq': woundBleed('The wound reopens each turn for necrotic damage: dark blood, not a cast circle.'),
  'dnd5e:dnd5e-items-JpwuGtFkfrGibQpP:6qPNbABFHwqIACnt': woundClose('A Medicine check closes the wound: a small staunching glow, not dark smoke.'),
  'dnd5e:dnd5e-items-pG6dddIcb9NmPrdt:bl5kA8mU9ikJMBX7': woundClose('A Medicine check closes the wound: a small staunching glow, not dark smoke.'),
  'dnd5e:dnd5e-items-KJYqNZgdkRwPmPMl:Z406QcGzqA1mpETG': woundClose('A Medicine check closes the wound: a small staunching glow, not dark smoke.'),
  'dnd5e:dnd5e-items-L4PxYPtYca283sju:VGzHv2W32QrKhT9Z': woundClose('A Medicine check closes the wound: a small staunching glow, not dark smoke.'),
  'dnd5e:dnd5e-items-SpbjbMMoJiva2zOa:dnd5eactivity100': woundClose('A Medicine check closes the wound: a small staunching glow, not dark smoke.'),
  'dnd5e:dnd5e-equipment24-dmgNineLivesStea:QxD7LVTB9MWX8QmK': soulRend('On a natural 20 the target saves or the weapon tears its life force out.'),
  'dnd5e:dnd5e-items-tFLmAPUDLxBY8jFO:52kldFCJtZsFmopV': soulRend('The sword tears at the target\'s life force; shown on the target, not as a pulse on the wielder.'),
  'dnd5e:dnd5e-items-BefbYlWbRYyy6R8s:DDFJPJHxO4hpJkLr': soulRend('The sword tears at the target\'s life force; shown on the target, not as a pulse on the wielder.'),
  'dnd5e:dnd5e-items-OUGMoQYeJzxEcRvm:c7OxfMTmc5olDsea': soulRend('The sword tears at the target\'s life force; shown on the target, not as a pulse on the wielder.'),
  'dnd5e:dnd5e-items-9Mdes2tKt0cqsNTw:sFSTSSOvTZIlTaxs': soulRend('The sword tears at the target\'s life force; shown on the target, not as a pulse on the wielder.'),
  'dnd5e:dnd5e-items-2Lkub0qIwucWEfp3:dnd5eactivity100': soulRend('The sword tears at the target\'s life force; shown on the target, not as a pulse on the wielder.'),

  // Maces
  'dnd5e:dnd5e-items-w56FIjFafs2rN6iK:AItO0vg7UJqWWDdP': design('A natural 20 deals extra bludgeoning damage (more to Constructs): a crushing, cracking blow.', () => [
    impact('Crushing blow', ['impact.ground_crack.01.white', 'impact.ground_crack.01.orange'], { stageId: 'hit', duration: 1600, scale: 0.7, ...tint('#cfc8b8') }),
    impact('Shock of the blow', ['impact.011.blue'], after({ offset: 0, duration: 1000, scale: 0.6, ...tint('#e8e2d0') })),
    reel({ intensity: 0.7, requiresHit: false }),
  ], { sound: 'hammer', ...A }),
  'dnd5e:dnd5e-equipment24-dmgMaceOfDisrupt:sUoIpd68kJWIxRaU': design('A Fiend or Undead struck must save or be destroyed by radiant power.', () => [
    impact('Radiance sears the unholy', ['divine_smite.target.yellowwhite', 'divine_smite.target.blueyellow'], { stageId: 'hit', duration: 1800, scale: 0.9 }),
    impact('Holy flame', ['sacred_flame.target.yellow'], after({ offset: 300, duration: 2000, scale: 0.8 })),
    reel({ intensity: 0.6, requiresHit: false }),
  ], { sound: 'holy' }),
  'dnd5e:dnd5e-items-m7RubLd1lUcMjYgY:dnd5eactivity100': design('The struck Fiend or Undead saves or is destroyed: radiance on the target, not a glow on the wielder.', () => [
    impact('Radiance sears the unholy', ['divine_smite.target.yellowwhite', 'divine_smite.target.blueyellow'], { stageId: 'hit', duration: 1800, scale: 0.9 }),
    impact('Holy flame', ['sacred_flame.target.yellow'], after({ offset: 300, duration: 2000, scale: 0.8 })),
    reel({ intensity: 0.6, requiresHit: false }),
  ], { sound: 'holy' }),

  // Rod of Lordly Might buttons
  'dnd5e:dnd5e-equipment24-dmgRodOfLordlyMi:apuqiDlUPRWfQkhf-melee': design('Button 1: a fiery blade sprouts from the rod (Flame Tongue).', () => [
    ...swing('Flaming blade', ['sword.melee.fire.orange', 'sword.melee.01.white'], { duration: 1600 }),
    impact('Flames burst', ['impact.fire.01.orange'], after({ offset: 150, duration: 1500, scale: 0.7 })),
  ], { sound: 'enchanted-sword-fire', ...A }),
  'dnd5e:dnd5e-equipment24-dmgRodOfLordlyMi:BsQ1WDJiSRkltvi5-melee': design('Button 2: the rod becomes a magic battleaxe.', () => swing('Battleaxe chop', ['melee_attack.02.battleaxe.01'], { duration: 1600 }), { sound: 'axe', ...A }),
  'dnd5e:dnd5e-equipment24-dmgRodOfLordlyMi:5Mhd70dNk5UBYbXW-melee': design('Button 2, two-handed: the rod becomes a battleaxe swung in both hands.', () => swing('Two-handed axe cleave', ['greataxe.melee.standard.white', 'melee_attack.03.greataxe.01'], { duration: 1600 }), { sound: 'axe', ...A }),
  'dnd5e:dnd5e-equipment24-dmgRodOfLordlyMi:CVIAWq4QHDwg2R3U-melee': design('Button 3: the rod becomes a magic spear.', () => swing('Spear thrust', ['spear.melee.01.white'], { duration: 1600 }), { sound: 'spear', ...A }),

  // Flame Tongue / Frost Brand fixes
  'dnd5e:dnd5e-items-CoUFHk5keIihsbYL:loujkp9Nh5q64dHk-melee': resound('Flaming rapier: add the flame cue to the blade sound.', 'enchanted-sword-fire'),
  'dnd5e:dnd5e-items-qVHCzgVvOZAtuk4N:hljsMttmY6XvlMfE-melee': design('Flame Tongue scimitar ablaze: the blade itself burns, plus 2d6 fire.', () => [
    ...swing('Flaming blade', ['sword.melee.fire.orange', 'scimitar.melee.01.white'], { duration: 1600 }),
    impact('Flames burst', ['impact.fire.01.orange'], after({ offset: 150, duration: 1500, scale: 0.7 })),
  ], { sound: 'enchanted-sword-fire', ...A }),
  'dnd5e:dnd5e-items-Z9FBwEoMi6daDGRj:7buUzB3lbWgeEGPC-melee': design('Flame Tongue shortsword ablaze: the blade itself burns, plus 2d6 fire.', () => [
    ...swing('Flaming blade', ['sword.melee.fire.orange', 'shortsword.melee.01.white'], { duration: 1600 }),
    impact('Flames burst', ['impact.fire.01.orange'], after({ offset: 150, duration: 1500, scale: 0.7 })),
  ], { sound: 'enchanted-sword-fire', ...A }),
  'dnd5e:dnd5e-items-NmZMx2u6bHpRyGUa': resound('Frost Brand adds 1d6 cold: add the ice cue to the blade sound.', 'enchanted-katana-cold'),
  'dnd5e:dnd5e-items-07R6JFioylOCpVoL': resound('Frost Brand adds 1d6 cold: add the ice cue to the blade sound.', 'enchanted-katana-cold'),
  'dnd5e:dnd5e-items-DT02xK1DzxLNlVaI': resound('Frost Brand adds 1d6 cold: add the ice cue to the blade sound.', 'enchanted-katana-cold'),

  // Staff of Fire
  'dnd5e:dnd5e-equipment24-dmgStaffOfFire00:XhhA9HxQ68wpgY1V': burningHands('Staff of Fire casts Burning Hands: a fan of flame.'),
  'dnd5e:dnd5e-items-lsiR1hVfISlC5YoB:AnjWB5KAJFWuctfI': burningHands('Staff of Fire casts Burning Hands: a fan of flame.'),
  'dnd5e:dnd5e-equipment24-dmgStaffOfFire00:Vb0miyFHetlOTk1l': fireball('Staff of Fire casts Fireball.'),
  'dnd5e:dnd5e-items-lsiR1hVfISlC5YoB:omT48ZPHS6r1QJSf': fireball('Staff of Fire casts Fireball.'),
  'dnd5e:dnd5e-equipment24-dmgStaffOfFire00:Sf6jPpI4gdwD3YGl': wallOfFire('Staff of Fire casts Wall of Fire.'),
  'dnd5e:dnd5e-items-lsiR1hVfISlC5YoB:llTtRiiqpPsZ2cEH': wallOfFire('Staff of Fire casts Wall of Fire.'),
  // Staff of Frost
  'dnd5e:dnd5e-equipment24-dmgStaffOfFrost0:csRhMMBN2tuiCgQI': coneOfCold('Staff of Frost casts Cone of Cold.'),
  'dnd5e:dnd5e-items-xEtBeZjJnkDXojQM:t2bjgs4Rehoss7mc': coneOfCold('Staff of Frost casts Cone of Cold.'),
  'dnd5e:dnd5e-equipment24-dmgStaffOfFrost0:9jOlvc6oFRuJJV3j': iceStorm('Staff of Frost casts Ice Storm: pounding hail.'),
  'dnd5e:dnd5e-items-xEtBeZjJnkDXojQM:BjnMyi8sdbu0Ybrr': iceStorm('Staff of Frost casts Ice Storm: pounding hail.'),
  'dnd5e:dnd5e-equipment24-dmgStaffOfFrost0:HZJDEiK50FONr6zO': fogCloud('Staff of Frost casts Fog Cloud.'),
  'dnd5e:dnd5e-items-xEtBeZjJnkDXojQM:3ozkXRFfpdGwx6zZ': fogCloud('Staff of Frost casts Fog Cloud.'),
  'dnd5e:dnd5e-equipment24-dmgStaffOfFrost0:5jvMsJjf4j8A4iC1': wallOfIce('Staff of Frost casts Wall of Ice.'),
  'dnd5e:dnd5e-items-xEtBeZjJnkDXojQM:LOde45eToutGhwC6': wallOfIce('Staff of Frost casts Wall of Ice.'),
  // Staff of Healing
  'dnd5e:dnd5e-equipment24-dmgStaffOfHealin:mkIIFw98V1d8uABu': cureWounds('Staff of Healing casts Cure Wounds on the target, not a glow on the caster.'),
  'dnd5e:dnd5e-items-WLVQJVpCWiPkCAtZ:AcACbFOCPB59VKfz': cureWounds('Staff of Healing casts Cure Wounds on the target, not a glow on the caster.'),
  'dnd5e:dnd5e-equipment24-dmgStaffOfHealin:MjiU3c8lzUOQk8sk': lesserRestoration('Staff of Healing casts Lesser Restoration: an affliction lifts from the target.'),
  'dnd5e:dnd5e-items-WLVQJVpCWiPkCAtZ:nn4geEXkhCgdAySL': lesserRestoration('Staff of Healing casts Lesser Restoration: an affliction lifts from the target.'),
  'dnd5e:dnd5e-equipment24-dmgStaffOfHealin:tfGfEtth3JKF7BXQ': massCure('Staff of Healing casts Mass Cure Wounds on up to six creatures.'),
  'dnd5e:dnd5e-items-WLVQJVpCWiPkCAtZ:r4S7IfUpK5ccLGpa': massCure('Staff of Healing casts Mass Cure Wounds on up to six creatures.'),
  // Staff of Charming
  'dnd5e:dnd5e-equipment24-dmgStaffOfCharmi:7bZzIRhMxei7kmFO': charmPerson('Staff of Charming casts Charm Person: hearts on the target, not on the caster.'),
  'dnd5e:dnd5e-items-FeouSUPUlUhfgeRp:jQpPiY9JypFhSabm': charmPerson('Staff of Charming casts Charm Person: hearts on the target, not on the caster.'),
  'dnd5e:dnd5e-equipment24-dmgStaffOfCharmi:jqnIS8yB9Mbih7tp': command('Staff of Charming casts Command: one spoken word compels the target.'),
  'dnd5e:dnd5e-items-FeouSUPUlUhfgeRp:kyu1xW3gkZI4gPRh': command('Staff of Charming casts Command: one spoken word compels the target.'),
  'dnd5e:dnd5e-equipment24-dmgStaffOfCharmi:zlCbbGPfUWPIMItx': comprehend('Staff of Charming casts Comprehend Languages: a quiet divination, no hearts.'),
  'dnd5e:dnd5e-items-FeouSUPUlUhfgeRp:rkyJP9ExCzn3gY7I': comprehend('Staff of Charming casts Comprehend Languages: a quiet divination, no hearts.'),
  'dnd5e:dnd5e-equipment24-dmgStaffOfCharmi:t8vD0vJ4MzCZIku2': enchantWard('Reflect Enchantment: the staff turns an enchantment back on its caster.'),
  'dnd5e:dnd5e-equipment24-dmgStaffOfCharmi:tEk1wNWngqDYOgOB': enchantWard('Resist Enchantment: the staff wards you against an enchantment.'),
  'dnd5e:dnd5e-items-FeouSUPUlUhfgeRp:m2ld3DGVjzh1mfvQ': enchantWard('Save against enchantment with the staff\'s aid: a ward, not hearts.'),
  'dnd5e:dnd5e-items-FeouSUPUlUhfgeRp:qYGpiqu9mc8BzArx': enchantWard('Turn Back Spell: the staff reflects an enchantment at its caster.'),

  // Luck Blade casts Wish
  'dnd5e:dnd5e-equipment24-dmgLuckBlade0000:9qgEdXDrdcn9Hw9W': design('The Luck Blade casts Wish: a grand circle of golden stars, not a faint glint.', () => [
    cast('Circle of conjuration', ['magic_signs.circle.02.conjuration.complete.yellow'], { stageId: 'c', duration: 2400, scale: 1.4, below: true }),
    aura('Stars burst outward', ['particle_burst.01.star.yellow', 'particle_burst.01.star.bluepurple'], { after: 'c', anchor: 'start', offset: 800, duration: 1600, scale: 1.2, ...tint('#ffd75e') }),
    aura('Lingering twinkle', ['twinkling_stars.points08.white'], { after: 'c', anchor: 'start', offset: 1100, duration: 1800, scale: 0.9, fadeOut: 600 }),
    motion('levitate', 'source', { after: 'c', anchor: 'start', offset: 300, duration: 2000, intensity: 0.3 }),
  ], { sound: 'bless' }),
};
