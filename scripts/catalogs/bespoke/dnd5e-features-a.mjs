// Bespoke compositions (dnd5e-features-a). Keys: '<system>:<entryId>' or '<system>:<entryId>:<variant|mode>'.
// See scripts/catalogs/bespoke/helpers.mjs and scripts/bespoke.mjs.
// D&D 5e class/race/monster features plus conditions and Actor effects.
// Designs are shared between 2014/2024 twins through put([...ids], design).
import { cast, travel, projectile, impact, area, aura, sprite, motion, tint, spin, breathe, design } from './helpers.mjs';

const D = id => `dnd5e:dnd5e-${id}`;
const out = {};
const put = (ids, d) => { for (const id of [].concat(ids)) out[D(id)] = d; };
const ab = (sound, extra = {}) => ({ sound, soundNamespace: 'ability', ...extra });
// Persistent condition/effect layer: gentle loop on the affected token while the native effect is active.
const st = (label, assets, o = {}) => aura(label, assets, { persist: true, duration: 6000, fadeIn: 400, fadeOut: 400, bindAlpha: true, ...o });
const state = (why, layers) => design(why, () => layers.map(([label, assets, o]) => st(label, assets, o)));

// ---------------------------------------------------------------- breath weapons
// Rear back, a wisp of the element at the maw, then the exhalation fills the measured cone/line.
const breath = (why, { puff, puffTint, keys, t, hit = 'recoil' }) => design(why, () => [
  motion('brace', 'source', { stageId: 'inhale', duration: 700, intensity: 0.6 }),
  cast('Breath gathers at the maw', puff, { stageId: 'maw', scale: 0.55, duration: 900, faceTarget: true, ...(puffTint ? tint(puffTint) : {}) }),
  area('Exhalation', keys, { stageId: 'exhale', after: 'inhale', anchor: 'end', offset: -100, duration: 2200, ...(t ? tint(t) : {}) }),
  motion('lunge', 'source', { after: 'inhale', anchor: 'end', duration: 900, intensity: 0.45 }),
  ...(hit ? [motion(hit, 'targets', { after: 'exhale', anchor: 'start', offset: 600, duration: 800, intensity: 0.6 })] : []),
]);
const FIRE_PUFF = ['cast_generic.fire.01.orange'];
const fireCone = breath('The creature rears back and exhales a roaring cone of flame across the area.', { puff: FIRE_PUFF, keys: ['breath_weapons.fire.cone.orange'] });
const fireLine = breath('The creature rears back and exhales a narrow line of fire along the measured line.', { puff: FIRE_PUFF, keys: ['breath_weapons.fire.line.orange'] });
const coldCone = breath('The creature draws breath and exhales a freezing cone of frost and icy air.', { puff: ['cast_generic.ice.01.blue', 'smoke.puff.side.grey'], puffTint: '#bfe8ff', keys: ['breath_weapons.cold.cone.blue'] });
const coldLine = breath('An icy gale is exhaled in a line, a blast of frost driving straight away from the creature.', { puff: ['cast_generic.ice.01.blue', 'smoke.puff.side.grey'], puffTint: '#bfe8ff', keys: ['breath_weapons02.burst.line.ice', 'breath_weapons.lightning.line.blue'], t: '#cfeeff' });
const lightningLine = breath('Sparks crackle at the jaws before a bolt of lightning is exhaled along the line.', { puff: ['static_electricity.01.blue'], keys: ['breath_weapons.lightning.line.blue'] });
const acidLine = breath('Acid froths at the mouth and is exhaled or spat in a corrosive line.', { puff: ['smoke.puff.side.green', 'smoke.puff.side.grey'], puffTint: '#9be060', keys: ['breath_weapons.acid.line.green'] });
const poisonCone = breath('A choking cloud of green poison gas billows out in a cone.', { puff: ['smoke.puff.side.dark_green', 'smoke.puff.side.grey'], puffTint: '#7fbf5a', keys: ['breath_weapons.poison.cone.green'] });
const gasPuff = ['smoke.puff.side.grey'];
const gas = (why, keys, color, hit = 'recoil') => breath(why, { puff: gasPuff, puffTint: color, keys, t: color, hit });
const sleepGas = gas('Lavender sleep gas rolls out of the maw in a soft cone; no damage, only drowsy vapor.', ['breath_weapons.poison.cone.purple', 'breath_weapons.poison.cone.green'], '#b9a4ff', null);
const paralyzingGas = gas('A sickly yellow-green paralytic gas is exhaled in a cone.', ['breath_weapons.poison.cone.green'], '#d4e06a', null);
const slowingGas = gas('A pale grey-blue gas that saps speed is exhaled in a cone.', ['breath_weapons.poison.cone.blue', 'breath_weapons.poison.cone.green'], '#a9c2d6', null);
const weakeningGas = gas('A dull ochre gas that saps strength is exhaled in a cone.', ['breath_weapons.poison.cone.orange', 'breath_weapons.poison.cone.green'], '#a8935a', null);
const petrifyingGas = gas('A stony grey petrifying gas is exhaled in a cone.', ['breath_weapons.poison.cone.blue', 'breath_weapons.poison.cone.green'], '#9e9e8c', null);
const blindingDust = gas('A cone of blinding dust and grit is blown out of the maw.', ['breath_weapons.poison.cone.orange', 'breath_weapons.poison.cone.green'], '#d9c49a', null);
const steamCone = gas('Scalding white steam is exhaled in a cone; creatures flinch from the heat.', ['breath_weapons.poison.cone.blue', 'breath_weapons.poison.cone.green'], '#f0f4f7');
const repulsionCone = breath('A cone of pale repulsive force is exhaled, shoving at everything before the creature.', { puff: ['smoke.puff.side.grey'], puffTint: '#e6eef5', keys: ['breath_weapons02.burst.cone.arcana.purple', 'breath_weapons02.burst.cone.fire.orange'], t: '#e6eef5' });
const draconicCone = breath('Draconic energy (type set by the ancestry) is exhaled in a cone.', { puff: ['smoke.puff.side.grey'], puffTint: '#c9a6ff', keys: ['breath_weapons02.burst.cone.arcana.purple', 'breath_weapons02.burst.cone.fire.orange'], t: '#c9a6ff' });
const draconicLine = breath('Draconic energy (type set by the ancestry) is exhaled in a line.', { puff: ['smoke.puff.side.grey'], puffTint: '#c9a6ff', keys: ['breath_weapons02.burst.line.arcana.purple', 'breath_weapons02.burst.line.fire.orange'], t: '#c9a6ff' });

put(['monsterfeatures-zjcGly9P3Gn9MXt7', 'monsterfeatures24-mmAcidBreath0000', 'monsterfeatures-kZpl32DBmqxlRegX', 'monsterfeatures24-mmAcidSpray00000', 'races-NnSZlrsHCFeH3cCq', 'races-bFpLM0N3uTeHLdzu'], acidLine);
put(['races-KVgvW5yhKcmQUanz', 'races-pJzMSk9qYywYy65w', 'monsterfeatures-LVnd9fq9cQj7rR0Q', 'monsterfeatures24-mmLightningBreat'], lightningLine);
put(['races-JrUcwLR2aQC09iUM', 'monsterfeatures-bGSW8IuWURWiWtxr', 'monsterfeatures24-mmFireBreath0000'], fireLine);
put(['races-YPQQBZAuRiSwuBfh', 'races-kB61JPKQrDBbSNU7'], fireCone);
put(['monsterfeatures-iHOaiOqwUWIfCljJ', 'monsterfeatures24-mmColdBreath0000', 'monsterfeatures-Z7U6z4HD1ORlkTIJ', 'monsterfeatures24-mmFrostBreath000', 'races-pAYTdRGftNr8AitK', 'races-KL7wx9Q8XNJQir0k'], coldCone);
put('monsterfeatures24-mmColdGale000000', coldLine);
put(['races-lXIxndsBaQglHBtO', 'monsterfeatures-JAEclghgOT24pQD9', 'monsterfeatures24-mmPoisonBreath00'], poisonCone);
out[D('monsterfeatures-43BnuqkQgg5l1Nfh')] = { ...sleepGas, sound: 'sleep' };
out[D('monsterfeatures24-mmSleepBreath000:6ce9oevQRWomSVSF')] = { ...sleepGas, sound: 'sleep' };
put(['monsterfeatures-BiasCPpNsaAVKzIj', 'monsterfeatures24-mmParalyzingBrea'], { ...paralyzingGas, sound: 'poison' });
put(['monsterfeatures-JRy507rS9wxT3GBh', 'monsterfeatures24-mmSlowingBreath0'], { ...slowingGas, sound: 'poison' });
put(['monsterfeatures-IHh6n8uZBGqyRfZz', 'monsterfeatures24-mmWeakeningBreat'], { ...weakeningGas, sound: 'poison' });
put(['monsterfeatures-xmXYBevj0kuPa3Fo', 'monsterfeatures24-mmPetrifyingBrea'], { ...petrifyingGas, sound: 'poison' });
put(['monsterfeatures-tHvaJB8tXSriVXRm:dnd5eactivity000', 'monsterfeatures-tHvaJB8tXSriVXRm:dnd5eactivity100', 'monsterfeatures24-mmBlindingBreath'], { ...blindingDust, sound: 'wind' });
put(['monsterfeatures-4UuuUKjATTixrZGP', 'monsterfeatures24-mmSteamBreath000'], steamCone);
put(['monsterfeatures-zRDERBe0lMbwyGwN', 'monsterfeatures24-mmRepulsionBreat'], repulsionCone);
put(['origins24-phbsptBreathWeap:dxCRYmNSSGp6L2yh', 'monsterfeatures24-mmDragonsBreath0'], { ...draconicCone, sound: 'dragonRoar' });
put('origins24-phbsptBreathWeap:iyK44COq6gbdbkc2', { ...draconicLine, sound: 'dragonRoar' });

// ---------------------------------------------------------------- natural attacks & martial strikes
const strike = (why, { hit, hitTint, scale = 0.9, src = 'lunge', tgt = 'recoil', srcI = 0.7, accent, accentTint }) => design(why, () => [
  motion(src, 'source', { stageId: 'swing', duration: 650, intensity: srcI }),
  impact('Contact', hit, { stageId: 'hit', after: 'swing', anchor: 'start', offset: 250, duration: 1000, scale, ...(hitTint ? tint(hitTint) : {}) }),
  ...(accent ? [impact('Accent', accent, { after: 'hit', anchor: 'start', offset: 150, duration: 1100, scale: 0.8, requiresHit: true, ...(accentTint ? tint(accentTint) : {}) })] : []),
  ...(tgt ? [motion(tgt, 'targets', { after: 'hit', anchor: 'start', offset: 120, duration: 700, intensity: 0.6, requiresHit: true })] : []),
]);
const claw = { ...strike('A raking claw swipe tears across the target.', { hit: ['claws.200px.red'] }), ...ab('claw') };
const bite = { ...strike('Jaws snap shut on the target.', { hit: ['bite.200px.red'] }), ...ab('naturalPierce') };
const hooves = { ...strike('The creature rears and stamps down with its hooves.', { hit: ['impact.009.orange'], scale: 0.8, src: 'slam', srcI: 0.5, tgt: 'stagger' }), ...ab('kick') };
const lash = { ...strike('A tentacle or lash whips out and cracks against the target.', { hit: ['melee_generic.creature_attack.fist.002.green', 'melee_generic.creature_attack.fist.002.blue'], hitTint: '#9fbf7a' }), ...ab('whip') };
const tail = { ...strike('A heavy tail sweeps around and slams into the target.', { hit: ['melee_generic.bludgeoning.two_handed', 'impact.009.orange'], src: 'spin', srcI: 1, tgt: 'stagger', scale: 1 }), ...ab('club') };
const fist = { ...strike('A plain unarmed blow lands on the target.', { hit: ['unarmed_strike.physical.01.blue'] }), ...ab('unarmed') };
put('monsterfeatures-DPrO7eVVxiKD8QWD', claw);
put('monsterfeatures-5rr8YdsGtL8WxEuE', bite);
put('monsterfeatures-re3oXQ3Xg4Z3Fr6O', hooves);
put(['monsterfeatures24-mmLash0000000000', 'monsterfeatures-czKwBo1qw5O2gCNy'], lash);
put(['monsterfeatures24-mmTailSwipe00000', 'monsterfeatures-Kx011zSOyhqEumH5'], tail);
put('monsterfeatures-9W2baYpS2ahNYhjb', fist);
put('classes24-phbinvMasterofMy:SEwXqOHdPCyejSYR', { ...strike('Alter Self natural weapons: grown claws rake the target.', { hit: ['claws.200px.bright_purple', 'claws.200px.red'] }), ...ab('claw') });
put('classes24-phbinvMasterofMy:osceJQzUOQPJ9CLn', { ...strike('Alter Self natural weapons: fangs or horns gore the target.', { hit: ['bite.200px.purple', 'bite.200px.red'] }), ...ab('naturalPierce') });
put('classes24-phbinvMasterofMy:eHtpASAnamFUc69H', hooves);

const multiattack = design('Two quick swings in succession stand for the creature\'s volley of attacks; outcomes are left to the rolls.', () => [
  motion('lunge', 'source', { stageId: 'm1', duration: 600, intensity: 0.6 }),
  impact('First swing', ['melee_generic.slash.01.orange'], { stageId: 'h1', after: 'm1', anchor: 'start', offset: 200, duration: 900, scale: 0.9 }),
  motion('lunge', 'source', { stageId: 'm2', after: 'm1', anchor: 'end', offset: 50, duration: 600, intensity: 0.7 }),
  impact('Second swing', ['melee_generic.slash.02.001.blue', 'melee_generic.slash.01.orange'], { after: 'm2', anchor: 'start', offset: 200, duration: 900, scale: 0.9, mirrorX: true, ...tint('#e8d9c0') }),
], { sound: null });
put(['monsterfeatures-EqoLg8T8EHvhJgKE', 'monsterfeatures24-mmMultiattack000'], multiattack);

const reaping = design('A spectral scythe sweeps through the target, slashing and leaving a necrotic chill.', () => [
  motion('lunge', 'source', { stageId: 'swing', duration: 700, intensity: 0.7 }),
  impact('Spectral scythe sweep', ['melee_generic.slashing.two_handed', 'melee_generic.slash.01.orange'], { stageId: 'hit', after: 'swing', anchor: 'start', offset: 220, duration: 1000, ...tint('#a9b8c9') }),
  impact('Necrotic chill', ['impact.004.dark_purple', 'impact.004.blue'], { after: 'hit', anchor: 'start', offset: 200, duration: 1000, scale: 0.8, requiresHit: true, ...tint('#7a5aa8') }),
  motion('recoil', 'targets', { after: 'hit', anchor: 'start', offset: 150, duration: 700, intensity: 0.6, requiresHit: true }),
], { sound: 'slash' });
put('monsterfeatures-of2dTSnPwmhR52O7', reaping);

const graveStrike = (why, move) => design(why, () => [
  ...(move ? [motion('rush', 'source', { stageId: 'mv', duration: 1600, intensity: 0.4, distance: 4, motionRange: 'target', motionHeading: 'toward', motionEndpoint: 'near' }), aura('Grave dust trail', ['smoke.puff.side.dark_purple', 'smoke.puff.side.grey'], { stageId: 'dust', scale: 0.6, duration: 900, opacity: 0.7, faceTarget: true, ...tint('#5b4a6e') })] : []),
  motion('lunge', 'source', { stageId: 'swing', ...(move ? { after: 'mv', anchor: 'arrival' } : {}), duration: 650, intensity: 0.7 }),
  impact('Necrotic blow', ['unarmed_strike.magical.01.dark_purple', 'unarmed_strike.magical.01.blue'], { stageId: 'hit', after: 'swing', anchor: 'start', offset: 200, duration: 1000, ...tint('#6a4a8c') }),
  impact('Rot blooms', ['impact.004.dark_purple', 'impact.004.blue'], { after: 'hit', anchor: 'start', offset: 150, duration: 900, scale: 0.75, requiresHit: true, ...tint('#6a4a8c') }),
  motion('recoil', 'targets', { after: 'hit', anchor: 'start', offset: 120, duration: 700, intensity: 0.6, requiresHit: true }),
], { sound: 'void' });
put('monsterfeatures24-mmDeathlessStrik', graveStrike('The undead lurches forward and strikes with a grave-cold, necrotic blow.', true));
put('monsterfeatures24-mmNecroticStrike', graveStrike('A rotting fist or negative-energy touch lands with a necrotic bloom.', false));

// Charges & pounces: physical approach with kicked-up dust, then the blow.
const dust = (o = {}) => aura('Dust kicks up', ['smoke.puff.side.grey'], { scale: 0.7, duration: 900, opacity: 0.75, faceTarget: true, mirrorX: true, ...tint('#bba98d'), ...o });
const rushTo = (o = {}) => motion('rush', 'source', { stageId: 'run', duration: 1500, intensity: 0.4, distance: 8, motionRange: 'target', motionHeading: 'toward', motionEndpoint: 'near', ...o });
const chargeOnly = design('The creature barrels straight toward its foe, dust kicking up behind it.', () => [rushTo(), dust({ after: 'run', anchor: 'start' })], { sound: null });
const chargeHit = (why, hit, sound, tgt = 'stagger', leap = false) => design(why, () => [
  leap ? motion('leap', 'source', { stageId: 'run', duration: 1400, intensity: 0.4, distance: 6, motionRange: 'target', motionHeading: 'toward', motionEndpoint: 'near' }) : rushTo(),
  dust({ after: 'run', anchor: 'start' }),
  impact('Impact on arrival', hit, { stageId: 'hit', after: 'run', anchor: 'arrival', duration: 1000, scale: 0.9 }),
  motion(tgt, 'targets', { after: 'hit', anchor: 'start', offset: 100, duration: 750, intensity: 0.7, requiresHit: true }),
], ab(sound));
put(['monsterfeatures-7NML6SkyvOsZ17iq', 'monsterfeatures24-mmCharge00000000', 'monsterfeatures24-mmPounce00000000'], chargeOnly);
put(['monsterfeatures-WqRzbokPG0am6AHb:dnd5eactivity000'], chargeHit('A straight charge ends in a goring tusk strike.', ['impact.009.orange'], 'naturalPierce'));
put(['monsterfeatures-yD51x4dihnbHwfsj:dnd5eactivity000'], chargeHit('A straight charge ends in a gore that can bowl the target over.', ['impact.009.orange'], 'naturalPierce'));
put('monsterfeatures24-mmChargingHorn00', chargeHit('The creature lowers its horn and charges in for one attack.', ['impact.009.orange'], 'naturalPierce', 'recoil'));
put(['monsterfeatures-MqAVplIArAKzpnXB:dnd5eactivity000'], chargeHit('The beast pounces through the air and lands with raking claws.', ['claws.200px.red'], 'claw', 'stagger', true));
put(['monsterfeatures-BnuDkgCOeGvAoYhy', 'monsterfeatures24-mmRampage0000000'], chargeHit('Blood-maddened, the creature rushes the next foe and bites.', ['bite.200px.red'], 'naturalPierce', 'recoil'));
put('monsterfeatures24-mmOnslaught00000', chargeHit('The creature surges half its speed and rakes with a claw or tail.', ['claws.200px.red'], 'claw', 'recoil'));
// The [save] halves of charge/pounce: the knock-down attempt on the struck target.
const knockdown = design('The follow-through of the charge: a heavy shove at the struck target.', () => [
  motion('lunge', 'source', { stageId: 'shove', duration: 600, intensity: 0.8 }),
  impact('Heavy shove', ['impact.009.orange'], { stageId: 'hit', after: 'shove', anchor: 'start', offset: 200, duration: 900, scale: 0.8 }),
  aura('Dust on the ground', ['smoke.puff.ring.01.white'], { subject: 'targets', after: 'hit', anchor: 'start', duration: 900, scale: 0.6, opacity: 0.6, below: true, ...tint('#bba98d') }),
], ab('unarmed'));
put(['monsterfeatures-WqRzbokPG0am6AHb:dnd5eactivity100', 'monsterfeatures-MqAVplIArAKzpnXB:dnd5eactivity100', 'monsterfeatures-yD51x4dihnbHwfsj:dnd5eactivity100'], knockdown);
put('monsterfeatures24-mmTramplingCharg', design('The creature thunders straight through enemies\' spaces, trampling as it goes.', () => [
  rushTo({ distance: 10 }), dust({ after: 'run', anchor: 'start' }),
  impact('Trampling hooves', ['impact.009.orange'], { stageId: 'hit', after: 'run', anchor: 'arrival', duration: 900, scale: 0.8 }),
  motion('stagger', 'targets', { after: 'hit', anchor: 'start', duration: 750, intensity: 0.6 }),
], ab('kick')));
put('monsterfeatures24-mmTrample0000000', design('The creature stomps down on a prone foe.', () => [
  motion('slam', 'source', { stageId: 'stomp', duration: 900, intensity: 0.6 }),
  impact('Stomp', ['impact.009.orange'], { stageId: 'hit', after: 'stomp', anchor: 'start', offset: 600, duration: 900 }),
  aura('Ground cracks', ['ground_cracks.01.orange'], { subject: 'targets', after: 'hit', anchor: 'start', duration: 1400, scale: 0.6, below: true, opacity: 0.7 }),
  motion('press', 'targets', { after: 'hit', anchor: 'start', duration: 700, intensity: 0.6 }),
], ab('kick')));
put('monsterfeatures24-mmAquaticCharge0', design('The creature swims straight at an enemy in a rush of bubbles.', () => [
  rushTo(), aura('Bubble wake', ['bubble.002.001.complete.blue', 'bubble.001.001.complete.blue'], { after: 'run', anchor: 'start', scale: 0.8, duration: 1400, opacity: 0.8 }),
  impact('Water surges on arrival', ['water_splash.circle.01.blue'], { after: 'run', anchor: 'arrival', duration: 1200, scale: 0.6 }),
], { sound: 'water' }));
put('monsterfeatures24-mmBubbleDash0000', design('Underwater, the creature darts away trailing a stream of bubbles.', () => [
  motion('rush', 'source', { stageId: 'run', duration: 1400, intensity: 0.3, distance: 2, motionRange: 'distance', motionHeading: 'toward', motionEndpoint: 'near' }),
  aura('Bubble trail', ['bubble.002.001.complete.blue', 'bubble.001.001.complete.blue'], { after: 'run', anchor: 'start', scale: 0.8, duration: 1400, opacity: 0.85 }),
], { sound: 'water' }));

// Dash / disengage / hide: mundane movement; no tornado, just speed lines, dust or a slip into cover.
const dash = design('A burst of speed: the creature sprints off with speed lines and a puff of dust.', () => [
  motion('rush', 'source', { stageId: 'run', duration: 1400, intensity: 0.4, distance: 2, motionRange: 'distance', motionHeading: 'toward', motionEndpoint: 'near' }),
  aura('Speed lines', ['wind_lines.01.01.white'], { after: 'run', anchor: 'start', scale: 0.9, duration: 1000, opacity: 0.6, faceTarget: true }),
  dust({ after: 'run', anchor: 'start' }),
], { sound: null });
const disengage = design('A quick sidestep out of reach, leaving a scuff of dust.', () => [
  motion('dodge', 'source', { stageId: 'step', duration: 1000, intensity: 0.5, distance: 0.5, motionRange: 'distance', motionHeading: 'toward', motionEndpoint: 'near' }),
  sprite('Afterimage', { after: 'step', anchor: 'start', duration: 600, opacity: 0.35 }),
  dust({ after: 'step', anchor: 'start', scale: 0.5 }),
], { sound: null });
const hide = design('The creature ducks low and slips into cover.', () => [
  motion('sink', 'source', { duration: 1200, intensity: 0.45 }),
  aura('Slipping into shadow', ['smoke.puff.centered.grey'], { duration: 1000, scale: 0.7, opacity: 0.5, ...tint('#5a5a66') }),
], { sound: null });
const cunning = design('Quick thinking and agility: a fast sidestep with speed lines (Dash, Disengage or Hide).', () => [
  motion('dodge', 'source', { stageId: 'step', duration: 1100, intensity: 0.6, distance: 0.4, motionRange: 'distance', motionHeading: 'toward', motionEndpoint: 'near' }),
  aura('Speed lines', ['wind_lines.01.02.white'], { after: 'step', anchor: 'start', scale: 0.8, duration: 900, opacity: 0.6 }),
  sprite('Afterimage', { after: 'step', anchor: 'start', duration: 600, opacity: 0.35 }),
], { sound: null });
put(['classes24-phbrgeCunningAct:NtS3iThuWWwm8O62', 'monsterfeatures24-mmHasten00000000'], dash);
put('classes24-phbrgeCunningAct:AeCciDTvw3kS583a', disengage);
put('classes24-phbrgeCunningAct:NiI5qEhg9TepZxMh', hide);
put(['classfeatures-01pcLg6PRu5zGrsb', 'monsterfeatures-J36uxDWfbkflPV7k', 'monsterfeatures24-mmCunningAction0', 'monsterfeatures24-mmNimbleEscape00'], cunning);
put('monsterfeatures24-mmDeathlessAgili', design('The undead lurches away at speed, shedding grave dust.', () => [
  motion('rush', 'source', { stageId: 'run', duration: 1400, intensity: 0.4, distance: 2, motionRange: 'distance', motionHeading: 'away', motionEndpoint: 'near' }),
  aura('Grave dust', ['smoke.puff.side.dark_purple', 'smoke.puff.side.grey'], { after: 'run', anchor: 'start', scale: 0.7, duration: 900, opacity: 0.7, ...tint('#5b4a6e') }),
], { sound: null }));
put('monsterfeatures24-mmProwl000000000', design('The tiger slinks forward without drawing attacks, then melts into hiding.', () => [
  motion('rush', 'source', { stageId: 'run', duration: 1500, intensity: 0.15, distance: 1.5, motionRange: 'distance', motionHeading: 'toward', motionEndpoint: 'near' }),
  motion('sink', 'source', { after: 'run', anchor: 'end', duration: 1000, intensity: 0.35 }),
], { sound: null }));
put(['classfeatures-yrSFIGTaQOH2PFRI', 'classes24-phbmnkMonksFocus:0MuRZ0Ur95xQTKFq'], design('Step of the Wind: a light, bounding leap carried on a rush of air.', () => [
  motion('leap', 'source', { stageId: 'jump', duration: 1500, intensity: 0.4, distance: 2, motionRange: 'distance', motionHeading: 'toward', motionEndpoint: 'near' }),
  aura('Rushing air', ['wind_lines.01.01.white'], { after: 'jump', anchor: 'start', scale: 0.9, duration: 1100, opacity: 0.6 }),
  dust({ after: 'jump', anchor: 'start', scale: 0.5 }),
], { sound: 'wind' }));
put('monsterfeatures24-mmLeap0000000000', design('A powerful jump: dust on take-off and a thud on landing.', () => [
  motion('leap', 'source', { stageId: 'jump', duration: 1500, intensity: 0.4, distance: 2, motionRange: 'distance', motionHeading: 'toward', motionEndpoint: 'near' }),
  dust({ after: 'jump', anchor: 'start', scale: 0.55 }),
], { sound: null }));
const deadlyLeap = design('The creature leaps high and crashes down onto the creatures below.', () => [
  motion('leap', 'source', { stageId: 'jump', duration: 1500, intensity: 0.5, distance: 3, motionRange: 'target', motionHeading: 'toward', motionEndpoint: 'near' }),
  impact('Crushing landing', ['impact.009.orange'], { stageId: 'land', after: 'jump', anchor: 'arrival', duration: 1000, scale: 1.1 }),
  aura('Ground cracks', ['ground_cracks.01.orange'], { subject: 'targets', after: 'land', anchor: 'start', duration: 1500, scale: 0.8, below: true, opacity: 0.75 }),
  motion('stagger', 'targets', { after: 'land', anchor: 'start', duration: 750, intensity: 0.6 }),
], { sound: 'bludgeon' });
put(['monsterfeatures-bG5Z45jj4wz0N3T6:dnd5eactivity000', 'monsterfeatures-bG5Z45jj4wz0N3T6:dnd5eactivity100', 'monsterfeatures24-mmDeadlyLeap0000'], deadlyLeap);
put('monsterfeatures24-mmSwoop000000000', design('The flier beats upward and sweeps away, dropping what it carries.', () => [
  aura('Shadow below', ['drop_shadow.dark_black'], { stageId: 'shadow', duration: 1800, scale: 0.9, opacity: 0.55, below: true, offsetY: 0.25, offsetUnits: 'token' }),
  motion('rush', 'source', { stageId: 'fly', duration: 1600, intensity: 0.3, distance: 2, motionRange: 'distance', motionHeading: 'toward', motionEndpoint: 'near' }),
  aura('Wingbeat gust', ['wind_lines.01.02.white'], { after: 'fly', anchor: 'start', scale: 0.9, duration: 1000, opacity: 0.6 }),
], { sound: 'wind' }));
put(['monsterfeatures-X96xsQjIolyHtV91', 'monsterfeatures24-mmWhirlwindOfSan'], design('The creature dissolves into a whirlwind of sand and whips across the field.', () => [
  aura('Sand whirlwind', ['whirlwind.bluewhite', 'whirlwind.bluegrey'], { stageId: 'sand', duration: 2200, scale: 1, opacity: 0.85, ...tint('#d9c49a') }),
  motion('flicker', 'source', { after: 'sand', anchor: 'start', duration: 1200, intensity: 0.6 }),
], { sound: 'wind' }));
put('monsterfeatures24-mmWorldshakingMo', design('The colossus strides and every footfall ends in a ground-splitting shock wave.', () => [
  motion('rush', 'source', { stageId: 'stride', duration: 1600, intensity: 0.4, distance: 2, motionRange: 'distance', motionHeading: 'toward', motionEndpoint: 'near' }),
  motion('slam', 'source', { stageId: 'stomp', after: 'stride', anchor: 'end', duration: 800, intensity: 0.6 }),
  area('Shock wave', ['ground_cracks.03.orange'], { stageId: 'quake', after: 'stomp', anchor: 'start', offset: 550, duration: 2200 }),
  aura('Debris', ['falling_rocks.top.1x1.grey'], { after: 'stomp', anchor: 'start', offset: 550, duration: 1500, scale: 0.9 }),
  motion('stagger', 'targets', { after: 'quake', anchor: 'start', offset: 150, duration: 800, intensity: 0.6 }),
], { sound: 'earthquake' }));

// ---------------------------------------------------------------- martial class features (restrained, physical)
put(['classes24-phbftrActionSurg', 'classfeatures-xF1VTcJ3AdkbTsdQ'], design('Action Surge: the fighter steels themself and surges forward with a burst of raw effort.', () => [
  motion('brace', 'source', { stageId: 'set', duration: 600, intensity: 0.7 }),
  aura('Burst of effort', ['wind_lines.01.02.white'], { after: 'set', anchor: 'end', duration: 900, scale: 0.9, opacity: 0.7 }),
  aura('Dust ring', ['smoke.puff.ring.01.white'], { after: 'set', anchor: 'end', duration: 900, scale: 0.7, opacity: 0.55, below: true, ...tint('#cbbfa8') }),
  motion('pulse', 'source', { after: 'set', anchor: 'end', duration: 700, intensity: 0.6 }),
], { sound: null }));
put(['classes24-phbftrSecondWind', 'classfeatures-nTjmWbyHweXuIqwc'], design('Second Wind: the fighter digs into their stamina, catches a breath and steadies.', () => [
  motion('press', 'source', { stageId: 'breath', duration: 800, intensity: 0.5 }),
  aura('Steadying heartbeat', ['ui.heartbeat.01.green'], { after: 'breath', anchor: 'start', offset: 200, duration: 1800, scale: 0.6, offsetY: -0.55, offsetUnits: 'token' }),
  motion('pulse', 'source', { after: 'breath', anchor: 'end', duration: 700, intensity: 0.4 }),
], { sound: null }));
const indomitable = design('Indomitable: the fighter shrugs off the failed save through sheer grit.', () => [
  motion('shake', 'source', { stageId: 'strain', duration: 700, intensity: 0.5 }),
  motion('brace', 'source', { after: 'strain', anchor: 'end', duration: 700, intensity: 0.6 }),
  aura('Unbroken resolve', ['markers.shield_rampart.complete.01.white', 'markers.shield_rampart.complete.01.orange'], { after: 'strain', anchor: 'end', duration: 1600, scale: 0.6, offsetY: -0.5, offsetUnits: 'token', ...tint('#e8e2d0') }),
], { sound: null });
put(['classes24-phbftrIndomitabl', 'classfeatures-653ZHbNcmm7ZGXbw'], indomitable);
put('classfeatures-Q1exex5ALteprrPo', design('Indomitable Might: raw strength braced against the ground.', () => [
  motion('brace', 'source', { stageId: 'set', duration: 800, intensity: 0.7 }),
  aura('Ground gives under the strain', ['ground_cracks.01.orange'], { after: 'set', anchor: 'start', offset: 300, duration: 1500, scale: 0.6, below: true, opacity: 0.6 }),
], { sound: null }));
const clingToLife = design('Refusing to fall: the creature staggers, then plants itself with a stubborn heartbeat at 1 hit point.', () => [
  motion('stagger', 'source', { stageId: 'reel', duration: 700, intensity: 0.6 }),
  motion('brace', 'source', { after: 'reel', anchor: 'end', duration: 700, intensity: 0.6 }),
  aura('Stubborn heartbeat', ['ui.heartbeat.01.red', 'ui.heartbeat.01.green'], { after: 'reel', anchor: 'end', duration: 1800, scale: 0.6, offsetY: -0.55, offsetUnits: 'token', ...tint('#d84a4a') }),
], { sound: null });
put(['monsterfeatures-8FX2KlWyBAKEYGzs', 'origins24-phbsptRelentless', 'races-97c8i9Z28thvZuA8', 'classes24-phbbrbRelentless:dnd5eactivity100', 'classfeatures-FqfmbPgxiyrWzhYk:dnd5eactivity000', 'classfeatures-FqfmbPgxiyrWzhYk:dnd5eactivity100'], clingToLife);
put(['classes24-phbbrbRage000000', 'classfeatures-VoR0SUrNX5EJVPIO'], design('Rage: a primal roar, the barbarian swells and shakes with fury as a red flush washes over them.', () => [
  motion('brace', 'source', { stageId: 'gather', duration: 600, intensity: 0.7 }),
  motion('shake', 'source', { after: 'gather', anchor: 'end', duration: 700, intensity: 0.6 }),
  motion('pulse', 'source', { after: 'gather', anchor: 'end', duration: 900, intensity: 0.7 }),
  aura('Fury flares', ['impact.012.dark_red', 'impact.012.blue'], { after: 'gather', anchor: 'end', duration: 1200, scale: 0.9, ...tint('#c0392b') }),
  aura('Ground shudders', ['ground_cracks.01.dark_red', 'ground_cracks.01.orange'], { after: 'gather', anchor: 'end', duration: 1800, scale: 0.7, below: true, opacity: 0.65 }),
], ab('battleCry')));
put(['classes24-phbbrbFrenzy0000', 'classfeatures-CkbbAckeCtyHXEnL'], { ...strike('Frenzy: a reckless, furious extra blow while raging.', { hit: ['melee_generic.slash.01.orange'], hitTint: '#d65a3a', src: 'lunge', srcI: 1, tgt: 'stagger', accent: ['impact.012.dark_red', 'impact.012.blue'], accentTint: '#c0392b' }), ...ab('greatsword') });
put('classes24-phbbrbBrutalStri', { ...strike('Brutal Strike: the barbarian forgoes advantage for one crushing, weighty blow.', { hit: ['melee_generic.bludgeoning.two_handed', 'impact.009.orange'], scale: 1.1, src: 'lunge', srcI: 1.1, tgt: 'stagger', accent: ['impact.009.orange'] }), ...ab('greatsword') });
const reactionStrike = { ...strike('A swift reaction attack lashes out at the creature that just attacked.', { hit: ['melee_generic.slash.01.orange'], srcI: 0.8 }), ...ab('sword') };
put(['classes24-phbbrbRetaliatio', 'classfeatures-xzD9zlRP6dUxCtCl', 'classfeatures-StfmqK1twVfukpa0'], reactionStrike);
put(['classfeatures-5gx1O0sxK08awEO9', 'classfeatures-3CaP1vFHVR8LgHjx:dnd5eactivity000'], { ...strike('A precise follow-up cut exploits the wounded quarry for extra damage.', { hit: ['melee_generic.slash.01.orange'], scale: 0.8, src: 'lunge', srcI: 0.5 }), ...ab('sword') });
put('classfeatures-C6sHdDGmCMo0cYHd', design('Horde Breaker: the swing carries on into a second foe beside the first.', () => [
  motion('lunge', 'source', { stageId: 'swing', duration: 650, intensity: 0.7 }),
  impact('First cut', ['melee_generic.slash.01.orange'], { stageId: 'h1', after: 'swing', anchor: 'start', offset: 200, duration: 900, targetSelection: 'first' }),
  impact('Carry-through cut', ['melee_generic.slash.02.001.blue', 'melee_generic.slash.01.orange'], { after: 'h1', anchor: 'start', offset: 300, duration: 900, targetSelection: 'secondary', mirrorX: true, ...tint('#e8d9c0') }),
], ab('sword')));
put('classfeatures-1DY8w3CXeD7PHDXF', design('Whirlwind Attack: the ranger spins, cutting at every creature within reach.', () => [
  motion('spin', 'source', { stageId: 'spin', duration: 900, intensity: 1 }),
  aura('Circling blade arc', ['melee_generic.whirlwind.01.orange'], { stageId: 'arc', after: 'spin', anchor: 'start', offset: 100, duration: 1000, scale: 1.2 }),
  motion('recoil', 'targets', { after: 'arc', anchor: 'start', offset: 350, duration: 700, intensity: 0.5, requiresHit: true }),
], ab('sword')));
put('monsterfeatures-5DJYFjGQCz5aSl5e', { ...strike('Surprise Attack: an ambush strike catches the unready target.', { hit: ['sneak_attack.dark_red', 'sneak_attack.dark_green'], srcI: 1, tgt: 'stagger' }), ...ab('dagger') });
put('classes24-phbrgeSteadyAim0', design('Steady Aim: the rogue stops, settles and lines up the next shot.', () => [
  motion('press', 'source', { duration: 1000, intensity: 0.35 }),
  aura('Focus', ['glint.yellow.few'], { duration: 1000, scale: 0.6, opacity: 0.8, offsetY: -0.3, offsetUnits: 'token' }),
], { sound: null }));
put(['classes24-phbrgeUncannyDod', 'classfeatures-7pyZjz5vlUWV01qQ', 'classfeatures-Mm64SKAHJWYecgXS'], design('Uncanny Dodge: the rogue twists aside so the blow only grazes, leaving an afterimage.', () => [
  motion('dodge', 'source', { stageId: 'twist', duration: 900, intensity: 0.6, distance: 0.15, motionRange: 'distance', motionHeading: 'toward', motionEndpoint: 'near' }),
  sprite('Afterimage', { after: 'twist', anchor: 'start', duration: 600, opacity: 0.35 }),
  aura('Grazing blow', ['impact.007.yellow'], { after: 'twist', anchor: 'start', offset: 150, duration: 600, scale: 0.4, opacity: 0.8 }),
], { sound: null }));
put('classes24-phbrgrSuperiorDe', design('Superior Hunter\'s Defense: the ranger braces and rolls with the blow, hardening against that damage.', () => [
  motion('brace', 'source', { stageId: 'set', duration: 800, intensity: 0.6 }),
  aura('Hardened guard', ['markers.shield_rampart.complete.01.white', 'markers.shield_rampart.complete.01.orange'], { after: 'set', anchor: 'start', offset: 150, duration: 1500, scale: 0.55, offsetY: -0.5, offsetUnits: 'token', ...tint('#cfe0c8') }),
], { sound: null }));
const parry = design('Parry: the defender braces and turns the blade aside with a ringing spark.', () => [
  motion('brace', 'source', { stageId: 'guard', duration: 700, intensity: 0.7 }),
  aura('Blade meets blade', ['impact.007.yellow'], { after: 'guard', anchor: 'start', offset: 200, duration: 600, scale: 0.45 }),
], ab('shield'));
put(['monsterfeatures-kfi26Jy0VLXv9TTm', 'monsterfeatures24-mmParry000000000', 'classfeatures-Xf763cJoDHPPWSGG'], parry);
put('monsterfeatures24-mmRiposte0000000', design('Riposte: the blade turns the attack, then snaps back in a counter-thrust.', () => [
  motion('brace', 'source', { stageId: 'guard', duration: 600, intensity: 0.7 }),
  aura('Parry spark', ['impact.007.yellow'], { after: 'guard', anchor: 'start', offset: 150, duration: 600, scale: 0.45 }),
  motion('lunge', 'source', { stageId: 'counter', after: 'guard', anchor: 'end', duration: 600, intensity: 0.8 }),
  impact('Counter-thrust', ['melee_generic.piercing.one_handed', 'melee_generic.slash.01.orange'], { after: 'counter', anchor: 'start', offset: 180, duration: 900, scale: 0.8 }),
], ab('rapier')));
const redirect = design('Deflect and redirect: the monk catches the force of the attack and flings it back at a foe.', () => [
  motion('brace', 'source', { stageId: 'catch', duration: 600, intensity: 0.7 }),
  aura('Caught', ['impact.007.yellow'], { after: 'catch', anchor: 'start', offset: 150, duration: 600, scale: 0.45 }),
  motion('throw', 'source', { stageId: 'fling', after: 'catch', anchor: 'end', duration: 700, intensity: 0.7 }),
  travel('Redirected strike', ['ranged.02.instant.01.yellow'], { stageId: 'fly', after: 'fling', anchor: 'start', offset: 250, duration: 900, scale: 0.7, ...tint('#f2e6c8') }),
  motion('recoil', 'targets', { after: 'fly', anchor: 'arrival', duration: 650, intensity: 0.6, requiresHit: true }),
], ab('physicalToss'));
put(['classes24-phbmnkDeflectAtt:dJv36KHyIVsbD00p', 'classes24-phbmnkDeflectEne:AnEiO80Ga3etD595', 'monsterfeatures24-mmDeflectMissile:x0MjUmnv2OPAbm6y'], redirect);
put('monsterfeatures24-mmRedirectAttack', design('Redirect Attack: the goblin ducks and yanks an ally into the attack\'s path, swapping places.', () => [
  motion('dodge', 'source', { stageId: 'swap', duration: 900, intensity: 0.6, distance: 0.4, motionRange: 'distance', motionHeading: 'toward', motionEndpoint: 'near' }),
  sprite('Afterimage', { after: 'swap', anchor: 'start', duration: 500, opacity: 0.35 }),
  dust({ after: 'swap', anchor: 'start', scale: 0.5 }),
], { sound: null }));
const patientDefense = design('Patient Defense: the monk drops into a guarded stance, weaving away from attacks.', () => [
  motion('brace', 'source', { stageId: 'stance', duration: 700, intensity: 0.5 }),
  motion('dodge', 'source', { after: 'stance', anchor: 'end', duration: 900, intensity: 0.4, distance: 0.18, motionRange: 'distance', motionHeading: 'toward', motionEndpoint: 'near' }),
  sprite('Afterimage', { after: 'stance', anchor: 'end', duration: 700, opacity: 0.3 }),
  aura('Calm guard', ['wind_lines.01.01.white'], { after: 'stance', anchor: 'start', duration: 1100, scale: 0.8, opacity: 0.5 }),
], { sound: null });
put(['classes24-phbmnkHeightened:x5fBC7ybAnr79AxK', 'classes24-phbmnkMonksFocus:7xj7b6e8tDznDSrE', 'classes24-phbmnkMonksFocus:EFzidO6yAapw8d60', 'classfeatures-TDglPcxIVEzvVSgK'], patientDefense);
const flurry = design('Flurry of Blows: a rapid chain of punches and kicks hammers the target.', () => [
  motion('lunge', 'source', { stageId: 'm1', duration: 500, intensity: 0.6 }),
  impact('Flurry', ['flurry_of_blows.physical.blue'], { stageId: 'hit', after: 'm1', anchor: 'start', offset: 150, duration: 1300 }),
  motion('lunge', 'source', { after: 'm1', anchor: 'end', duration: 500, intensity: 0.6 }),
  motion('shake', 'targets', { after: 'hit', anchor: 'start', offset: 200, duration: 800, intensity: 0.4, requiresHit: true }),
], ab('unarmed'));
put(['classfeatures-5MwNlVZK7m6VolOH', 'classes24-phbmnkHeightened:XLma1NEOJNEBD6mH', 'classes24-phbmnkMonksFocus:2ghJTBhilLrFn9xT'], flurry);
put('classes24-phbmnkEmpoweredS', { ...strike('Empowered Strikes: the unarmed blow lands as a burst of force.', { hit: ['unarmed_strike.magical.01.pinkpurple', 'unarmed_strike.magical.01.blue'] }), ...ab('unarmed') });
put(['classes24-phbmnkStunningSt', 'classfeatures-pvRc6GAu1ok6zihC'], design('Stunning Strike: a precise blow to a pressure point jolts the target\'s ki; the stun itself rides on the save.', () => [
  motion('lunge', 'source', { stageId: 'jab', duration: 600, intensity: 0.8 }),
  impact('Pressure-point strike', ['unarmed_strike.physical.02.blue', 'unarmed_strike.physical.01.blue'], { stageId: 'hit', after: 'jab', anchor: 'start', offset: 180, duration: 900 }),
  impact('Ki jolt', ['side_impact.part.shockwave.blue'], { after: 'hit', anchor: 'start', offset: 150, duration: 700, scale: 0.6, requiresHit: true }),
  motion('shake', 'targets', { after: 'hit', anchor: 'start', offset: 150, duration: 600, intensity: 0.5, requiresHit: true }),
], ab('unarmed')));
const openHand = (why, tgt) => design(why, () => [
  motion('lunge', 'source', { stageId: 'palm', duration: 600, intensity: 0.8 }),
  impact('Open-palm strike', ['unarmed_strike.physical.01.blue'], { stageId: 'hit', after: 'palm', anchor: 'start', offset: 180, duration: 900 }),
  tgt,
], ab('unarmed'));
put('classes24-phbmnkOpenHandTe:1jdSaWanuRrdkVs3', openHand('Open Hand: Addle — a disorienting palm strike leaves the target unable to react.', motion('shake', 'targets', { after: 'hit', anchor: 'start', offset: 150, duration: 700, intensity: 0.45, requiresHit: true })));
put('classes24-phbmnkOpenHandTe:XoaS0RtDCGAqrQsf', openHand('Open Hand: Push — the palm strike drives the target straight back.', motion('rush', 'targets', { after: 'hit', anchor: 'start', offset: 120, duration: 1000, intensity: 0.5, distance: 1.5, motionRange: 'distance', motionHeading: 'away', motionEndpoint: 'near', requiresHit: true })));
put('classes24-phbmnkOpenHandTe:5Qgc0K3TfuonkPIG', openHand('Open Hand: Topple — a sweeping palm strike tries to bowl the target over.', motion('stagger', 'targets', { after: 'hit', anchor: 'start', offset: 120, duration: 800, intensity: 0.8, requiresHit: true })));
put('classfeatures-iQxLNydNLlCHNKbp', openHand('Open Hand Technique: a palm strike that can knock prone, push away, or deny reactions.', motion('stagger', 'targets', { after: 'hit', anchor: 'start', offset: 120, duration: 800, intensity: 0.6, requiresHit: true })));
const quiver = (why, withStrike) => design(why, () => [
  ...(withStrike ? [motion('lunge', 'source', { stageId: 'palm', duration: 600, intensity: 0.7 }), impact('Palm strike', ['unarmed_strike.physical.02.blue', 'unarmed_strike.physical.01.blue'], { stageId: 'hit', after: 'palm', anchor: 'start', offset: 180, duration: 900 })] : [motion('pulse', 'source', { stageId: 'hit', duration: 600, intensity: 0.3 })]),
  impact('Lethal vibrations ripple', ['extras.tmfx.outpulse.circle.01.fast', 'extras.tmfx.outpulse.circle.01.normal'], { stageId: 'ripple', after: 'hit', anchor: 'start', offset: 200, duration: 1200, scale: 0.6, opacity: 0.8, ...tint('#9fc7ff') }),
  motion('shake', 'targets', { after: 'ripple', anchor: 'start', duration: 1000, intensity: 0.6 }),
], ab('unarmed'));
put(['classes24-phbmnkQuiveringP:O1mQr2rPpzRpB3yJ', 'classfeatures-h1gM8SH3BNRtFevE'], quiver('Quivering Palm: an unarmed strike seeds imperceptible lethal vibrations in the body.', true));
put('classes24-phbmnkQuiveringP:lBn87Q4yyJXWzLqg', quiver('Quivering Palm: the monk ends the vibrations and they shudder through the target.', false));
put(['classes24-phbmnkMartialArt:x7fKZy0kgRTMACTa', 'classes24-phbmnkMartialArt:uCIVkZurvxHYJ0h0'], design('Martial Arts weapon mastery: a practiced flourish of the monk weapon.', () => [
  motion('spin', 'source', { duration: 800, intensity: 1 }),
  aura('Weapon flourish', ['melee_generic.whirlwind.01.orange'], { duration: 900, scale: 0.8, opacity: 0.7, ...tint('#d9cbb0') }),
], { sound: null }));
put('classfeatures-10b6z2W1txNkrGP7', design('Ki: the monk centers their breath and a faint inner light steadies.', () => [
  motion('press', 'source', { duration: 900, intensity: 0.3 }),
  aura('Centered breath', ['markers.light.complete.blue'], { duration: 1600, scale: 0.6, opacity: 0.7 }),
], { sound: null }));
put('classfeatures-ZmC31XKS4YNENnoc', design('Stillness of Mind: the monk calms their mind, shedding charm or fear.', () => [
  motion('press', 'source', { duration: 1000, intensity: 0.25 }),
  aura('Calm mind', ['markers.light.complete.blue'], { duration: 1800, scale: 0.6, opacity: 0.75, offsetY: -0.4, offsetUnits: 'token' }),
], { sound: null }));
put(['classes24-phbmnkSlowFall00', 'classfeatures-KQz9bqxVkXjDl8gK'], design('Slow Fall: the monk drifts down and rolls out of the landing.', () => [
  motion('drift', 'source', { stageId: 'fall', duration: 1400, intensity: 0.5 }),
  aura('Soft landing', ['smoke.puff.ring.01.white'], { after: 'fall', anchor: 'end', offset: -300, duration: 900, scale: 0.6, opacity: 0.55, below: true, ...tint('#cbbfa8') }),
], { sound: null }));
put('classes24-phbrgeCunningStr:n64fvJMT9fPUy7DH', { ...strike('Cunning Strike: Poison — the sneak attack drives toxin from a poisoner\'s kit into the wound.', { hit: ['sneak_attack.dark_green'], accent: ['impact_themed.poison.greenyellow', 'smoke.puff.centered.grey'], accentTint: '#8fd16a', tgt: 'shake' }), ...ab('dagger') });
put('classes24-phbrgeCunningStr:dWcCw1vTWRMx4YzD', { ...strike('Cunning Strike: Trip — the sneak attack hooks the target\'s legs.', { hit: ['sneak_attack.dark_purple', 'sneak_attack.dark_green'], tgt: 'stagger' }), ...ab('dagger') });
put('classes24-phbrgeCunningStr:jR7KqMuPOZYUCDyO', { ...strike('Sneak Attack: a precise strike at an unguarded spot.', { hit: ['sneak_attack.dark_purple', 'sneak_attack.dark_green'] }), ...ab('dagger') });
put('classes24-phbrgeCunningStr:m2bRZ1YeD3yf9nV7', design('Cunning Strike: Withdraw — strike, then slip away half a move.', () => [
  motion('lunge', 'source', { stageId: 'stab', duration: 550, intensity: 0.7 }),
  impact('Sneak strike', ['sneak_attack.dark_purple', 'sneak_attack.dark_green'], { stageId: 'hit', after: 'stab', anchor: 'start', offset: 160, duration: 900 }),
  motion('rush', 'source', { after: 'stab', anchor: 'end', duration: 1200, intensity: 0.4, distance: 1.2, motionRange: 'distance', motionHeading: 'away', motionEndpoint: 'near' }),
], ab('dagger')));
put('classes24-phbrgeDeviousStr:4TnBjQTJzt9UjUos', { ...strike('Devious Strike: Daze — a rattling blow to the head.', { hit: ['sneak_attack.dark_purple', 'sneak_attack.dark_green'], tgt: 'shake' }), ...ab('dagger') });
put('classes24-phbrgeDeviousStr:3eq7lcmpkJJBU2KO', { ...strike('Devious Strike: Knock Out — a heavy blow aimed to drop the target.', { hit: ['sneak_attack.dark_purple', 'sneak_attack.dark_green'], accent: ['impact.009.orange'], srcI: 1, tgt: 'stagger' }), ...ab('club') });
put('classes24-phbrgeDeviousStr:ki4lIPVGNA0HjEzH', { ...strike('Devious Strike: Obscure — the strike flicks grit and shadow into the target\'s eyes.', { hit: ['sneak_attack.dark_purple', 'sneak_attack.dark_green'], accent: ['smoke.puff.centered.dark_black', 'smoke.puff.centered.grey'], accentTint: '#3d3a45', tgt: 'shake' }), ...ab('dagger') });
put('classes24-phbrgeFastHands0:5pHgM0ZQStN6rIGE', design('Fast Hands: Use an Object — a deft flick of the wrist.', () => [
  motion('pulse', 'source', { duration: 500, intensity: 0.3 }),
  aura('Quick hands', ['glint.yellow.few'], { duration: 900, scale: 0.5, opacity: 0.8 }),
], { sound: null }));

put('monsterfeatures24-mmShieldBash0000', { ...strike('Shield Bash: the shield slams into the target, trying to knock it down.', { hit: ['impact.009.orange'], src: 'lunge', srcI: 1, tgt: 'stagger', scale: 0.9 }), ...ab('shieldStrike') });
put('classfeatures-06NVMYf58Z76O85O', design('Protection fighting style: the fighter swings their shield into the attack\'s path to protect an ally.', () => [
  motion('lunge', 'source', { stageId: 'interpose', duration: 600, intensity: 0.5 }),
  aura('Shield interposed', ['markers.shield_rampart.complete.01.white', 'markers.shield_rampart.complete.01.orange'], { subject: 'targets', after: 'interpose', anchor: 'start', offset: 200, duration: 1400, scale: 0.55, ...tint('#e2dccb') }),
], ab('shieldRaise', { fx: false })));
put('monsterfeatures-BpwXJvMA7MfVQ7i6', design('Rock Catching: the giant braces and snatches the hurled boulder out of the air.', () => [
  motion('brace', 'source', { stageId: 'catch', duration: 800, intensity: 0.8 }),
  aura('Catch', ['impact.009.orange'], { after: 'catch', anchor: 'start', offset: 250, duration: 800, scale: 0.6 }),
  aura('Grit falls away', ['smoke.puff.ring.01.white'], { after: 'catch', anchor: 'start', offset: 300, duration: 900, scale: 0.6, opacity: 0.6, ...tint('#bba98d') }),
], ab('physicalToss')));
put('monsterfeatures24-mmBoulderToss000', design('The giant winds back and hurls a boulder that smashes down at the point.', () => [
  motion('throw', 'source', { stageId: 'wind', duration: 900, intensity: 0.8 }),
  projectile('Boulder in flight', ['boulder.toss.02.01.stone.brown'], { stageId: 'rock', after: 'wind', anchor: 'start', offset: 350, duration: 1300 }),
  area('Boulder crashes down', ['ground_cracks.02.orange'], { stageId: 'crash', after: 'rock', anchor: 'end', offset: -150, duration: 1800 }),
  impact('Debris spray', ['falling_rocks.side.1x1.grey'], { after: 'rock', anchor: 'end', offset: -150, duration: 1200, scale: 0.8 }),
  motion('stagger', 'targets', { after: 'crash', anchor: 'start', offset: 100, duration: 700, intensity: 0.6 }),
], { sound: 'earth' }));
put(['monsterfeatures-hxXzd3KCfnqnT89w', 'monsterfeatures24-mmFling000000000'], design('Fling: the grappled creature is heaved up and hurled away.', () => [
  motion('throw', 'source', { stageId: 'heave', duration: 900, intensity: 0.9 }),
  motion('leap', 'targets', { stageId: 'flight', after: 'heave', anchor: 'start', offset: 350, duration: 1400, intensity: 0.6, distance: 2.5, motionRange: 'distance', motionHeading: 'away', motionEndpoint: 'near' }),
  impact('Hard landing', ['impact.009.orange'], { after: 'flight', anchor: 'arrival', duration: 900, scale: 0.7 }),
], ab('physicalToss')));
put('monsterfeatures24-mmPummel00000000', design('Pummel: repeated blows rain down on the creature caught in its grip.', () => [
  motion('lunge', 'source', { stageId: 'p1', duration: 450, intensity: 0.6 }),
  impact('Blow', ['unarmed_strike.physical.01.blue'], { stageId: 'h1', after: 'p1', anchor: 'start', offset: 150, duration: 800, ...tint('#d9cbb0') }),
  motion('lunge', 'source', { stageId: 'p2', after: 'p1', anchor: 'end', duration: 450, intensity: 0.6 }),
  impact('Blow', ['unarmed_strike.physical.02.blue', 'unarmed_strike.physical.01.blue'], { after: 'p2', anchor: 'start', offset: 150, duration: 800, mirrorX: true, ...tint('#d9cbb0') }),
  motion('shake', 'targets', { after: 'h1', anchor: 'start', duration: 1000, intensity: 0.4 }),
], ab('unarmed')));
const grab = (why) => design(why, () => [
  motion('lunge', 'source', { stageId: 'reach', duration: 600, intensity: 0.7 }),
  impact('Seized', ['impact.009.orange'], { stageId: 'hit', after: 'reach', anchor: 'start', offset: 200, duration: 800, scale: 0.6 }),
  motion('press', 'targets', { after: 'hit', anchor: 'start', duration: 900, intensity: 0.5 }),
], ab('unarmed'));
put('monsterfeatures24-mmConstrict00000:IgOMjRxAt7UISkJq', grab('Constrict: coils wrap around and squeeze the target.'));
put('monsterfeatures24-mmQuickGrapple00:aDWVHpJgsNPPNrDs', grab('Quick Grapple: a lightning-fast grab at the target.'));
put('monsterfeatures24-mmAdhesive000000:FYt2snfprvi5DgcW', design('Adhesive: the creature that touched the mimic is stuck fast to its gluey hide.', () => [
  impact('Gluey contact', ['liquid.splash.grey', 'liquid.splash.blue'], { stageId: 'hit', duration: 1000, scale: 0.6, ...tint('#c8b98a') }),
  motion('shake', 'targets', { after: 'hit', anchor: 'start', duration: 900, intensity: 0.4 }),
], { sound: null }));
const tentacleSlam = design('Tentacle Slam: grappled creatures are lifted and slammed into each other or the ground.', () => [
  motion('throw', 'source', { stageId: 'heave', duration: 800, intensity: 0.6 }),
  motion('slam', 'targets', { stageId: 'slam', after: 'heave', anchor: 'start', offset: 150, duration: 900, intensity: 0.7 }),
  impact('Crash', ['impact.009.orange'], { after: 'slam', anchor: 'start', offset: 650, duration: 900, scale: 0.8 }),
], ab('club'));
put(['monsterfeatures-QiM1nbPzbLzKnfmP:dnd5eactivity000', 'monsterfeatures-QiM1nbPzbLzKnfmP:dnd5eactivity100', 'monsterfeatures24-mmTentacleSlam00'], tentacleSlam);
const reel = (why, strand) => design(why, () => [
  travel('Line to the prey', strand, { stageId: 'line', duration: 1400, scale: 0.7, ...tint('#d8d8d8') }),
  motion('brace', 'source', { after: 'line', anchor: 'start', offset: 200, duration: 900, intensity: 0.6 }),
  motion('rush', 'targets', { after: 'line', anchor: 'start', offset: 300, duration: 1200, intensity: 0.5, distance: 2, motionRange: 'distance', motionHeading: 'toward', motionEndpoint: 'near' }),
], { sound: null });
put('monsterfeatures-IwQRhCTgCfAADyt8', reel('Reel: the creature drags each grappled victim straight toward itself.', ['energy_strands.range.standard.grey', 'energy_strands.range.standard.purple']));
put('monsterfeatures24-mmReel0000000000', reel('Reel: the web strand pulls the restrained victim toward the spider.', ['web.complete.002.white', 'energy_strands.range.standard.purple']));
const swallow = design('Swallow: the creature\'s jaws close on the grappled prey and gulp it down.', () => [
  motion('lunge', 'source', { stageId: 'gulp', duration: 700, intensity: 0.9 }),
  impact('Jaws close', ['bite.400px.red', 'bite.200px.red'], { stageId: 'hit', after: 'gulp', anchor: 'start', offset: 200, duration: 1000 }),
  motion('sink', 'targets', { after: 'hit', anchor: 'start', offset: 250, duration: 1200, intensity: 0.7, requiresHit: true }),
], ab('naturalPierce'));
put(['monsterfeatures-aH5ncM30tP8tPQ24', 'monsterfeatures24-mmSwallow0000000:YorssyWMumAsvzx3'], swallow);
put('monsterfeatures24-mmSwallow0000000:rGeGukkm2t2fXsoy', design('Regurgitate: the swallowed creature is expelled in a slick spray.', () => [
  motion('throw', 'source', { stageId: 'heave', duration: 800, intensity: 0.6 }),
  impact('Spat out', ['liquid.splash.green', 'liquid.splash.blue'], { stageId: 'spray', after: 'heave', anchor: 'start', offset: 300, duration: 1000, scale: 0.7, ...tint('#9cbf6a') }),
  motion('rush', 'targets', { after: 'spray', anchor: 'start', duration: 1000, intensity: 0.5, distance: 1, motionRange: 'distance', motionHeading: 'away', motionEndpoint: 'near' }),
], { sound: null }));
put(['monsterfeatures-Eh80lkzHiEOJP8FI:dnd5eactivity000', 'monsterfeatures-Eh80lkzHiEOJP8FI:dnd5eactivity300', 'monsterfeatures24-mmEngulf00000000:5o0Bh8PQaojx5XMx'], design('Engulf: the ooze slides over creatures in its path, swallowing them into its acidic body.', () => [
  rushTo({ duration: 1800, intensity: 0.3 }),
  impact('Engulfed in ooze', ['liquid.splash.bright_green', 'liquid.splash.blue'], { stageId: 'hit', after: 'run', anchor: 'arrival', duration: 1200, scale: 0.8, ...tint('#a3d65c') }),
  motion('sink', 'targets', { after: 'hit', anchor: 'start', duration: 1000, intensity: 0.4 }),
], { sound: 'acid' }));
put('monsterfeatures24-mmEngulf00000000:Exfa4q7O4SvXjGt7', design('Engulfed: acid churns around the creature trapped inside the ooze.', () => [
  aura('Digesting acid', ['bubble.002.002.complete.greenyellow', 'bubble.002.002.complete.blue'], { ...tint('#a3d65c'), subject: 'targets', duration: 2000, scale: 0.8, opacity: 0.85 }),
  motion('shake', 'targets', { duration: 1200, intensity: 0.35 }),
], { sound: 'acid' }));
put(['monsterfeatures-HMOOZRxolMmv91xm:dnd5eactivity000', 'monsterfeatures-HMOOZRxolMmv91xm:dnd5eactivity300'], design('Mucous Cloud: a creature touching the aboleth is coated in transformative slime.', () => [
  impact('Slimed', ['liquid.splash.green', 'liquid.splash.blue'], { stageId: 'hit', duration: 1100, scale: 0.6, ...tint('#8fc9a8') }),
  motion('shake', 'targets', { after: 'hit', anchor: 'start', duration: 800, intensity: 0.35 }),
], { sound: 'water' }));
put('monsterfeatures24-mmMucusCloud0000:clFFG8uDBSFzxIo8', design('Mucus Cloud: a haze of transformative mucus spreads through the water around the aboleth.', () => [
  area('Mucus haze', ['fog_cloud.02.green02', 'fog_cloud.01.white'], { stageId: 'haze', duration: 2600, opacity: 0.75, ...tint('#8fc9a8') }),
  motion('pulse', 'source', { duration: 800, intensity: 0.4 }),
], { sound: 'water' }));

// Spitting / ranged natural attacks
put(['monsterfeatures-0awyZX05OnVLF4k2', 'monsterfeatures24-mmBlindingSpittl'], design('Blinding Spittle: a chemical glob is spat at a point and bursts in a blinding flash.', () => [
  motion('throw', 'source', { stageId: 'spit', duration: 700, intensity: 0.5 }),
  projectile('Chemical glob', ['throwable.throw.flask.01.white', 'throwable.throw.flask.01.orange'], { stageId: 'glob', after: 'spit', anchor: 'start', offset: 250, duration: 900, scale: 0.4, ...tint('#e8f0b0') }),
  area('Blinding flash', ['explosion.02.yellow', 'impact.006.yellow'], { stageId: 'flash', after: 'glob', anchor: 'end', offset: -100, duration: 1300 }),
  motion('recoil', 'targets', { after: 'flash', anchor: 'start', offset: 100, duration: 600, intensity: 0.4 }),
], { sound: 'light' }));
put('monsterfeatures24-mmPoisonousSpitt', design('Poisonous Spittle: a stream of venom is spat into the target\'s face.', () => [
  motion('throw', 'source', { stageId: 'spit', duration: 700, intensity: 0.5 }),
  travel('Venom stream', ['ranged.01.instant.01.dark_green', 'ranged.01.instant.01.dark_orange'], { stageId: 'stream', after: 'spit', anchor: 'start', offset: 250, duration: 800, scale: 0.6, ...tint('#7fbf3a') }),
  impact('Venom splash', ['impact_themed.poison.greenyellow', 'liquid.splash.blue'], { after: 'stream', anchor: 'arrival', duration: 1000, scale: 0.7, ...tint('#7fbf3a') }),
  motion('recoil', 'targets', { after: 'stream', anchor: 'arrival', duration: 650, intensity: 0.5 }),
], { sound: 'poison' }));
const sting = design('A stinging tentacle lashes the target with paralytic venom.', () => [
  motion('lunge', 'source', { stageId: 'lash', duration: 600, intensity: 0.7 }),
  impact('Venomous sting', ['impact_themed.poison.greenyellow', 'impact.003.blue'], { stageId: 'hit', after: 'lash', anchor: 'start', offset: 200, duration: 1000, scale: 0.7, ...tint('#a8d65a') }),
  motion('shake', 'targets', { after: 'hit', anchor: 'start', duration: 800, intensity: 0.4 }),
], { sound: 'poison' });
put(['monsterfeatures24-mmParalyzingTent', 'monsterfeatures-nKpLMXS9E10TSGhU'], sting);
const webShot = design('A sticky strand of webbing is shot at the target and wraps around it.', () => [
  motion('throw', 'source', { stageId: 'shoot', duration: 650, intensity: 0.4 }),
  travel('Web strand', ['web.complete.002.white', 'energy_strands.range.standard.purple'], { stageId: 'strand', after: 'shoot', anchor: 'start', offset: 200, duration: 900, scale: 0.5, ...tint('#eeeeee') }),
  impact('Webbing wraps', ['web.complete.002.white'], { after: 'strand', anchor: 'arrival', duration: 1500, scale: 0.6 }),
  motion('shake', 'targets', { after: 'strand', anchor: 'arrival', duration: 800, intensity: 0.35 }),
], { sound: 'vines' });
put(['monsterfeatures-i8WDjw4J1gJWQmqG:dnd5eactivity100', 'monsterfeatures24-mmWeb00000000000', 'monsterfeatures24-mmWebStrand00000'], webShot);
put(['monsterfeatures-6HJpLJxctQdMLeuB', 'monsterfeatures24-mmAntennae000000', 'monsterfeatures24-mmReflexiveAnten', 'monsterfeatures24-mmDestroyMetal00'], design('The rust monster\'s antennae flick against metal, which flakes away into rust.', () => [
  motion('lunge', 'source', { stageId: 'touch', duration: 600, intensity: 0.5 }),
  impact('Metal corrodes', ['impact.008.orange'], { stageId: 'hit', after: 'touch', anchor: 'start', offset: 200, duration: 900, scale: 0.55, ...tint('#b5651d') }),
  impact('Rust flakes', ['smoke.puff.centered.grey'], { after: 'hit', anchor: 'start', offset: 150, duration: 1100, scale: 0.6, opacity: 0.8, ...tint('#a0522d') }),
], { sound: 'acid' }));
put(['monsterfeatures-QMGBV7OSnXqWLdhr', 'monsterfeatures24-mmBarbedHide0000'], design('Barbed Hide: the creature bristles and its barbs stab whatever is grappling it.', () => [
  motion('pulse', 'source', { stageId: 'bristle', duration: 600, intensity: 0.4 }),
  impact('Barbs pierce', ['melee_generic.piercing.one_handed', 'impact.009.orange'], { stageId: 'hit', after: 'bristle', anchor: 'start', offset: 150, duration: 900, scale: 0.6 }),
  motion('recoil', 'targets', { after: 'hit', anchor: 'start', duration: 600, intensity: 0.5 }),
], ab('naturalPierce')));
put('monsterfeatures24-mmInfernalTail00:tJYeyUk3iPYJq9xM', design('Infernal Tail: a barbed tail lashes out and tears an infernal wound.', () => [
  motion('spin', 'source', { stageId: 'swing', duration: 800, intensity: 1 }),
  impact('Tail lash', ['melee_generic.slash.01.orange'], { stageId: 'hit', after: 'swing', anchor: 'start', offset: 300, duration: 900, ...tint('#c0392b') }),
  impact('Hellish gash', ['liquid.splash_side.red', 'liquid.splash02.red'], { after: 'hit', anchor: 'start', offset: 150, duration: 900, scale: 0.6, requiresHit: true }),
  motion('recoil', 'targets', { after: 'hit', anchor: 'start', duration: 650, intensity: 0.5, requiresHit: true }),
], ab('whip')));
put('monsterfeatures24-mmInfernalTail00:zZfCQ0IeJZCjPLzE', design('The infernal wound keeps bleeding.', () => [
  aura('Wound bleeds', ['markers.drop.red'], { subject: 'targets', duration: 2000, scale: 0.6, offsetY: -0.4, offsetUnits: 'token' }),
  motion('shake', 'targets', { duration: 700, intensity: 0.3 }),
], { sound: null }));
put('monsterfeatures24-mmLoathsomeLimbs', design('Loathsome Limbs: a severed limb drops away in a gout of troll blood.', () => [
  motion('shake', 'source', { stageId: 'sever', duration: 700, intensity: 0.6 }),
  aura('Limb severed', ['liquid.splash_side.green', 'liquid.splash_side02.red'], { after: 'sever', anchor: 'start', duration: 900, scale: 0.6, ...tint('#5f7f3a') }),
], { sound: null }));
put(['monsterfeatures-NzHwrEuKnKxZ4NTP', 'monsterfeatures24-mmSplit000000000'], design('Split: the ooze bulges and divides into two smaller oozes.', () => [
  motion('pulse', 'source', { stageId: 'bulge', duration: 800, intensity: 0.8 }),
  sprite('Second ooze', { after: 'bulge', anchor: 'start', offset: 300, duration: 1200, offsetX: 0.45, offsetUnits: 'token', opacity: 0.6 }),
  aura('Slime splatter', ['liquid.splash.dark_black', 'liquid.splash.blue'], { after: 'bulge', anchor: 'start', offset: 300, duration: 1000, scale: 0.6, ...tint('#4a4a52') }),
], { sound: null }));
put('monsterfeatures-Ouvju0Y3SoYb5EMR', design('Flying Sword: the greatsword is released and hovers beside its master.', () => [
  aura('Sword hovers', ['spiritual_weapon.greatsword.01.simple', 'spiritual_weapon.greatsword.01.spectral.02.green'], { duration: 2400, scale: 0.6, offsetX: 0.6, offsetUnits: 'token', fadeIn: 300, fadeOut: 400, ...tint('#d9d9e0') }),
], { sound: 'metal' }));

// ---------------------------------------------------------------- teleport / planar shifts
const blink = (why, cloud, ttint, sound = 'teleport') => design(why, () => [
  aura('Departure', cloud, { stageId: 'out', duration: 1300, scale: 0.9, ...(ttint ? tint(ttint) : {}) }),
  motion('flicker', 'source', { after: 'out', anchor: 'start', duration: 1100, intensity: 0.8 }),
], { sound });
put(['monsterfeatures-PPzVD90vab60FqCt', 'monsterfeatures24-mmTeleport000000', 'monsterfeatures24-mmPursuit0000000'], blink('The creature vanishes in a flash and reappears where it chooses.', ['misty_step.01.purple', 'misty_step.01.blue']));
put('monsterfeatures24-mmMistyStep00000', blink('Misty Step: the creature fades into silvery mist and steps elsewhere.', ['misty_step.01.blue']));
put('origins24-phbsptCloudsJaun', blink('Cloud\'s Jaunt: the goliath vanishes in a puff of cloud-grey mist.', ['misty_step.01.grey', 'misty_step.01.blue']));
put('monsterfeatures24-mmTreeStride0000', blink('Tree Stride: the creature steps into a tree in a swirl of leaves and out of another.', ['swirling_leaves.complete.01.green'], null, 'growth'));
put('monsterfeatures24-mmArcaneProwl000', design('Arcane Prowl: the creature blinks through arcane space and pounces on a foe.', () => [
  aura('Blink', ['misty_step.01.purple', 'misty_step.01.blue'], { stageId: 'out', duration: 1100, scale: 0.8 }),
  motion('flicker', 'source', { after: 'out', anchor: 'start', duration: 900, intensity: 0.8 }),
  motion('lunge', 'source', { stageId: 'pounce', after: 'out', anchor: 'end', offset: -200, duration: 600, intensity: 0.8 }),
  impact('Claws', ['claws.200px.bright_purple', 'claws.200px.red'], { after: 'pounce', anchor: 'start', offset: 200, duration: 900 }),
], { sound: 'teleport' }));
const ethereal = blink('The creature fades into the Border Ethereal (or back), its form turning ghostly.', ['misty_step.01.grey', 'misty_step.01.blue'], '#cfe0f0');
put(['monsterfeatures-3iLXiqhhOgXOMMg7', 'monsterfeatures24-mmEtherealJaunt0', 'monsterfeatures-rDoNJnKdY47x8MD4', 'monsterfeatures24-mmEtherealness00'], ethereal);
put(['monsterfeatures-NfTCXq8eRrqjhvAo', 'monsterfeatures24-mmEtherealStride'], design('Ethereal Stride: the creature and willing companions fade into the Ethereal Plane together.', () => [
  aura('Fading', ['misty_step.01.grey', 'misty_step.01.blue'], { stageId: 'out', duration: 1300, scale: 0.9, ...tint('#cfe0f0') }),
  aura('Companions fade', ['misty_step.01.grey', 'misty_step.01.blue'], { subject: 'targets', after: 'out', anchor: 'start', offset: 150, duration: 1300, scale: 0.8, ...tint('#cfe0f0') }),
  motion('flicker', 'source', { after: 'out', anchor: 'start', duration: 1100, intensity: 0.8 }),
  motion('flicker', 'targets', { after: 'out', anchor: 'start', offset: 150, duration: 1100, intensity: 0.8 }),
], { sound: 'teleport' }));
put('monsterfeatures24-mmDeathlyTelepor', design('Deathly Teleport: the creature vanishes and necrotic energy bursts in the space it left.', () => [
  aura('Vanish', ['misty_step.01.dark_purple', 'misty_step.01.blue'], { stageId: 'out', duration: 1200, scale: 0.9 }),
  motion('flicker', 'source', { after: 'out', anchor: 'start', duration: 1000, intensity: 0.8 }),
  area('Necrotic burst', ['arms_of_hadar.dark_purple'], { after: 'out', anchor: 'start', offset: 300, duration: 2000, opacity: 0.85 }),
], { sound: 'void' }));
put('monsterfeatures24-mmRadiantTelepor', design('Radiant Teleport: the celestial vanishes in a flash and radiance bursts where it was.', () => [
  aura('Vanish in light', ['teleport.01.yellow', 'teleport.01.blue'], { stageId: 'out', duration: 1300, scale: 0.9 }),
  motion('flicker', 'source', { after: 'out', anchor: 'start', duration: 1000, intensity: 0.8 }),
  area('Radiant burst', ['explosion.02.yellow', 'impact.006.yellow'], { after: 'out', anchor: 'start', offset: 250, duration: 1500 }),
], { sound: 'holy' }));

// ---------------------------------------------------------------- divine & paladin
const turn = design('The holy symbol is raised and a wave of radiant censure rolls out at the undead and fiends.', () => [
  motion('brace', 'source', { stageId: 'raise', duration: 600, intensity: 0.4 }),
  cast('Holy symbol blazes', ['sacred_flame.source.yellow'], { stageId: 'flare', duration: 1200, scale: 0.7, offsetY: -0.3, offsetUnits: 'token' }),
  aura('Radiant censure rolls out', ['divine_smite.caster.standard.yellowwhite', 'divine_smite.caster.standard.blueyellow'], { stageId: 'wave', after: 'flare', anchor: 'start', offset: 400, duration: 1500, scale: 1.6 }),
  motion('recoil', 'targets', { after: 'wave', anchor: 'start', offset: 300, duration: 700, intensity: 0.5 }),
], { sound: 'holy' });
put(['classes24-phbclcChannelDiv:aOptL5pMaj3WtR8S', 'classfeatures-ZdwGlsJNtc7pGFCd', 'classfeatures-r91UIgwFdHwkXdia'], turn);
put('classes24-phbclcSearUndead', design('Sear Undead: radiant fire scorches each undead caught by Turn Undead.', () => [
  cast('Holy symbol blazes', ['sacred_flame.source.yellow'], { stageId: 'flare', duration: 1000, scale: 0.6, offsetY: -0.3, offsetUnits: 'token' }),
  impact('Radiant searing', ['sacred_flame.target.yellow'], { stageId: 'sear', after: 'flare', anchor: 'start', offset: 450, duration: 1500 }),
  motion('recoil', 'targets', { after: 'sear', anchor: 'start', offset: 300, duration: 700, intensity: 0.5 }),
], { sound: 'holy' }));
put(['classes24-phbpdnAbjureFoes'], design('Abjure Foes: the paladin presents the holy symbol and awe-striking radiance washes over chosen foes.', () => [
  motion('brace', 'source', { stageId: 'raise', duration: 600, intensity: 0.4 }),
  cast('Holy symbol blazes', ['sacred_flame.source.yellow'], { stageId: 'flare', duration: 1200, scale: 0.7, offsetY: -0.3, offsetUnits: 'token' }),
  impact('Awe washes over', ['divine_smite.target.yellowwhite', 'divine_smite.target.blueyellow'], { stageId: 'awe', after: 'flare', anchor: 'start', offset: 450, duration: 1400, scale: 0.8 }),
  motion('cower', 'targets', { after: 'awe', anchor: 'start', offset: 200, duration: 1200, intensity: 0.5 }),
], { sound: 'holy' }));
const sacredWeapon = design('Sacred Weapon: the paladin\'s weapon is imbued with radiant light.', () => [
  motion('brace', 'source', { stageId: 'raise', duration: 600, intensity: 0.4 }),
  aura('Weapon kindles', ['divine_smite.caster.standard.yellowwhite', 'divine_smite.caster.standard.blueyellow'], { stageId: 'kindle', after: 'raise', anchor: 'start', offset: 200, duration: 1400, scale: 0.8 }),
  aura('Radiant gleam', ['glint.yellow.many'], { after: 'kindle', anchor: 'start', offset: 300, duration: 1200, scale: 0.7 }),
], { sound: 'holy' });
put(['classfeatures-xNN0JMKqlG4hKVYu', 'classes24-phbpdnSacredWeap', 'monsterfeatures-lVrnjqBrv90VH96d:dnd5eactivity000'], sacredWeapon);
const radiantStrike = design('The weapon strike lands with an extra flare of divine radiance.', () => [
  impact('Radiant strike', ['divine_smite.target.yellowwhite', 'divine_smite.target.blueyellow'], { stageId: 'hit', duration: 1300, scale: 0.8 }),
  motion('recoil', 'targets', { after: 'hit', anchor: 'start', offset: 150, duration: 600, intensity: 0.5 }),
], { sound: 'holy' });
put(['classes24-phbDivineStrike0:MbCGfaQAeW2rzNWb', 'classfeatures-T6u5z8ZTX6UftXqE', 'classfeatures-FAk41RPCTcvCk6KI'], radiantStrike);
put('classes24-phbDivineStrike0:uYVz8MBW0EZ2X0zD', design('The weapon strike lands with an extra pulse of necrotic divine power.', () => [
  impact('Necrotic strike', ['divine_smite.target.dark_purple', 'divine_smite.target.blueyellow'], { stageId: 'hit', duration: 1300, scale: 0.8 }),
  motion('recoil', 'targets', { after: 'hit', anchor: 'start', offset: 150, duration: 600, intensity: 0.5 }),
], { sound: 'void' }));
put('classes24-phbinvEldritchSm', design('Eldritch Smite: the pact weapon lands with a slam of force that can knock the target prone.', () => [
  impact('Force smite', ['divine_smite.target.purplepink', 'divine_smite.target.blueyellow'], { stageId: 'hit', duration: 1300, scale: 0.85 }),
  motion('press', 'targets', { after: 'hit', anchor: 'start', offset: 200, duration: 800, intensity: 0.7 }),
], { sound: 'force' }));
const divineIntervention = design('Divine Intervention: a column of holy light descends as the deity answers.', () => [
  motion('brace', 'source', { stageId: 'pray', duration: 700, intensity: 0.3 }),
  aura('Column of holy light', ['sacred_flame.source.yellow'], { stageId: 'beam', after: 'pray', anchor: 'start', offset: 200, duration: 1800, scale: 1.2 }),
  aura('Blessing settles', ['bless.400px.intro.yellow'], { after: 'beam', anchor: 'start', offset: 600, duration: 1800, scale: 0.7, below: true }),
  motion('levitate', 'source', { after: 'beam', anchor: 'start', offset: 300, duration: 1400, intensity: 0.3 }),
], { sound: 'holy' });
put(['classes24-phbclcDivineInte', 'classfeatures-eVXqHn0ojWrEuYGU', 'classes24-phbclcGreaterDiv'], divineIntervention);
put('classfeatures-E8ozg8avUVOX9N7u', design('Divine Sense: the paladin opens their awareness and a golden sensing wave spreads outward.', () => [
  motion('press', 'source', { duration: 800, intensity: 0.25 }),
  aura('Sensing wave', ['detect_magic.circle.yellow', 'detect_magic.circle.blue'], { duration: 2400, scale: 1.4, opacity: 0.8, below: true }),
], { sound: 'detect' }));
const holyNimbus = design('Holy Nimbus: the paladin blazes with an aura of sunlight.', () => [
  motion('levitate', 'source', { stageId: 'rise', duration: 1400, intensity: 0.25 }),
  aura('Sunlight radiates', ['spirit_guardians.blueyellow.no_ring', 'spirit_guardians.blueyellow.ring'], { stageId: 'sun', duration: 2600, scale: 1.4, opacity: 0.8, below: true }),
  aura('Radiant core', ['sacred_flame.source.yellow'], { after: 'sun', anchor: 'start', offset: 200, duration: 1600, scale: 0.8 }),
], { sound: 'holy' });
put(['classes24-phbpdnHolyNimbus:k6gGbWQBoLTgqbSG', 'classfeatures-ANE5gjojvhNEagzz'], holyNimbus);
put('monsterfeatures24-mmHolyBurst00000', design('Holy Burst: a sphere of radiant light detonates at the chosen point.', () => [
  cast('Radiance gathers', ['sacred_flame.source.yellow'], { stageId: 'gather', duration: 900, scale: 0.6 }),
  area('Radiant detonation', ['explosion.02.yellow', 'impact.006.yellow'], { stageId: 'burst', after: 'gather', anchor: 'start', offset: 500, duration: 1600 }),
  motion('recoil', 'targets', { after: 'burst', anchor: 'start', offset: 200, duration: 700, intensity: 0.5 }),
], { sound: 'holy' }));
put('classfeatures-U7BIPVPsptBmwsnV', design('Cleansing Touch: the paladin touches a creature and a hostile spell unravels in a soft radiance.', () => [
  motion('lunge', 'source', { stageId: 'touch', duration: 600, intensity: 0.4 }),
  impact('Spell unravels', ['healing_generic.burst.yellowwhite', 'healing_generic.burst.greenorange'], { stageId: 'cleanse', after: 'touch', anchor: 'start', offset: 250, duration: 1500, scale: 0.8, ...tint('#fff2c0') }),
], { sound: 'dispel' }));
put(['monsterfeatures24-mmUnicornsBlessi:OghPbiZjhgIJ5llC', 'monsterfeatures24-mmUnicornsBlessi:lruyGaBCUcPkdyAC'], design('Unicorn\'s Blessing: the unicorn touches a creature with its horn, sending healing light into it.', () => [
  motion('lunge', 'source', { stageId: 'horn', duration: 650, intensity: 0.5 }),
  impact('Horn\'s healing light', ['healing_generic.burst.yellowwhite', 'healing_generic.burst.greenorange'], { stageId: 'heal', after: 'horn', anchor: 'start', offset: 250, duration: 1600, scale: 0.8 }),
  aura('Sparkles', ['glint.yellow.many'], { subject: 'targets', after: 'heal', anchor: 'start', offset: 300, duration: 1200, scale: 0.6 }),
], { sound: 'healing' }));
put('monsterfeatures24-mmGuidingLight00', design('Guiding Light: a flash of light streaks to the target and leaves it glimmering.', () => [
  cast('Light gathers', ['sacred_flame.source.yellow'], { stageId: 'gather', duration: 800, scale: 0.5 }),
  travel('Guiding bolt', ['guiding_bolt.01.yellow', 'guiding_bolt.01.blueyellow'], { stageId: 'bolt', after: 'gather', anchor: 'start', offset: 400, duration: 1300 }),
  motion('recoil', 'targets', { after: 'bolt', anchor: 'arrival', duration: 650, intensity: 0.5, requiresHit: true }),
], { sound: 'radiantRay' }));
put('monsterfeatures24-mmSlayingBow0000', design('Slaying Bow: a radiant arrow flies true at the chosen creature.', () => [
  motion('brace', 'source', { stageId: 'draw', duration: 700, intensity: 0.4 }),
  travel('Radiant arrow', ['arrow.physical.white'], { stageId: 'arrow', after: 'draw', anchor: 'end', offset: -150, duration: 900, ...tint('#fff0a8') }),
  impact('Radiant strike', ['sacred_flame.target.yellow'], { after: 'arrow', anchor: 'arrival', duration: 1400, scale: 0.8 }),
  motion('recoil', 'targets', { after: 'arrow', anchor: 'arrival', duration: 650, intensity: 0.5 }),
], ab('longbow')));
put(['monsterfeatures24-mmVampireWeaknes:Q18pvRsbOyRbHiVK'], design('Sunlight burns the vampire, its skin smoking in the light.', () => [
  aura('Sunlight sears', ['sacred_flame.target.yellow'], { stageId: 'sun', duration: 1500, scale: 0.8 }),
  aura('Skin smokes', ['smoke.plumes.01.grey'], { after: 'sun', anchor: 'start', offset: 300, duration: 1500, scale: 0.6, opacity: 0.7 }),
  motion('shake', 'source', { after: 'sun', anchor: 'start', duration: 1000, intensity: 0.5 }),
], { sound: 'fire' }));

// ---------------------------------------------------------------- bard
const bardic = design('Bardic Inspiration: a stirring flourish of music and words sends an inspiration die to an ally.', () => [
  cast('A stirring flourish', ['music_notations.beamed_quavers.orange', 'music_notations.beamed_quavers.blue'], { stageId: 'flourish', duration: 1000, scale: 0.5, offsetY: -0.4, offsetUnits: 'token' }),
  impact('Inspiration settles on the ally', ['bardic_inspiration.greenorange'], { stageId: 'inspire', after: 'flourish', anchor: 'start', offset: 400, duration: 1800, scale: 0.8 }),
  motion('pulse', 'targets', { after: 'inspire', anchor: 'start', offset: 300, duration: 700, intensity: 0.4 }),
], { sound: 'song' });
put(['classes24-phbbrdBardicInsp', 'classfeatures-hpLNiGq7y67d2EHA'], bardic);
put('classfeatures-pquwueEMweRhiWaq', design('Peerless Skill: the bard spends inspiration on their own check with a confident flourish.', () => [
  aura('Self-inspiration', ['bardic_inspiration.greenorange'], { duration: 1800, scale: 0.7 }),
  motion('pulse', 'source', { duration: 700, intensity: 0.4 }),
], { sound: 'song' }));
const cuttingWords = design('A barbed jest or cutting remark rattles the target\'s confidence.', () => [
  cast('Mocking words', ['music_notations.beamed_quavers.purple', 'music_notations.beamed_quavers.blue'], { stageId: 'jest', duration: 900, scale: 0.45, offsetY: -0.4, offsetUnits: 'token' }),
  impact('Barb lands', ['side_impact.part.slow.music_note.pink', 'side_impact.part.shockwave.blue'], { stageId: 'barb', after: 'jest', anchor: 'start', offset: 350, duration: 1100, scale: 0.6, ...tint('#e0a0d8') }),
  motion('recoil', 'targets', { after: 'barb', anchor: 'start', offset: 150, duration: 600, intensity: 0.35 }),
], { sound: 'laughter' });
put(['classes24-phbbrdCuttingWor', 'classfeatures-5zPmHPQUne7RDfaU', 'monsterfeatures24-mmMockery0000000'], cuttingWords);
const countercharm = design('Countercharm: the bard starts a protective performance of music and words of power.', () => [
  aura('Protective performance', ['music_notations.treble_clef.blue'], { stageId: 'song', duration: 2000, scale: 0.5, offsetY: -0.45, offsetUnits: 'token' }),
  aura('Notes ripple outward', ['soundwave.01.blue'], { after: 'song', anchor: 'start', offset: 300, duration: 1600, scale: 1.2, opacity: 0.6, below: true }),
], { sound: 'song' });
put(['classes24-phbbrdCountercha', 'classfeatures-SEJmsjkEhdAZ90ki'], countercharm);
put('classfeatures-he8RpPXwSl2lVSIk', design('Song of Rest: soothing music helps allies recover during a short rest.', () => [
  aura('Soothing music', ['music_notations.beamed_quavers.green', 'music_notations.beamed_quavers.blue'], { stageId: 'song', duration: 1800, scale: 0.5, offsetY: -0.45, offsetUnits: 'token' }),
  aura('Restoration', ['healing_generic.200px.green'], { subject: 'targets', after: 'song', anchor: 'start', offset: 500, duration: 1600, scale: 0.7 }),
], { sound: 'song' }));
put(['monsterfeatures-IALpDTyYdDOzmDb5', 'monsterfeatures24-mmLuringSong0000'], design('Luring Song: an enchanting melody spreads out and pulls listeners toward the singer.', () => [
  aura('Enchanting melody', ['music_notations.beamed_quavers.purple', 'music_notations.beamed_quavers.blue'], { stageId: 'song', duration: 1800, scale: 0.5, offsetY: -0.45, offsetUnits: 'token' }),
  area('Song carries', ['soundwave.02.purple', 'soundwave.02.blue'], { after: 'song', anchor: 'start', offset: 300, duration: 2000, opacity: 0.7, ...tint('#e6a8f0') }),
], { sound: 'song' }));
put('monsterfeatures-cl5sUkAIeJoAG4gh', design('Leadership: a barked command or warning bolsters nearby allies.', () => [
  motion('brace', 'source', { stageId: 'shout', duration: 600, intensity: 0.5 }),
  aura('Command rings out', ['soundwave.01.orangeyellow', 'soundwave.01.blue'], { stageId: 'call', after: 'shout', anchor: 'start', offset: 150, duration: 1200, scale: 1 }),
  aura('Allies bolstered', ['condition.boon.01.004.yellow', 'condition.boon.01.004.green'], { subject: 'targets', after: 'call', anchor: 'start', offset: 300, duration: 1500, scale: 0.6 }),
], ab('battleCry')));
put('monsterfeatures24-mmWarCry00000000', design('War Cry: a rallying roar fires up the creature or an ally.', () => [
  motion('brace', 'source', { stageId: 'shout', duration: 600, intensity: 0.6 }),
  aura('Battle roar', ['soundwave.01.orangeyellow', 'soundwave.01.blue'], { stageId: 'call', after: 'shout', anchor: 'start', offset: 150, duration: 1200, scale: 1 }),
  aura('Emboldened', ['condition.boon.01.004.red', 'condition.boon.01.004.green'], { subject: 'targets', after: 'call', anchor: 'start', offset: 300, duration: 1500, scale: 0.6 }),
  motion('pulse', 'targets', { after: 'call', anchor: 'start', offset: 300, duration: 700, intensity: 0.4 }),
], ab('battleCry')));

// ---------------------------------------------------------------- ranger
const huntersMark = design('The hunter marks the quarry; a hunter\'s sigil locks onto the target.', () => [
  motion('press', 'source', { stageId: 'aim', duration: 600, intensity: 0.25 }),
  impact('Quarry marked', ['hunters_mark.pulse.01.green'], { stageId: 'mark', after: 'aim', anchor: 'start', offset: 250, duration: 1600, scale: 0.7 }),
], { sound: null });
put(['classes24-phbrgrFavoredEne', 'classes24-phbrgrFoeSlayer0', 'classes24-phbrgrSuperiorHu'], huntersMark);
put('classfeatures-kaHcUGiwi8AtfZIm', design('Primeval Awareness: the ranger attunes to the land and senses favored enemies nearby.', () => [
  motion('press', 'source', { duration: 800, intensity: 0.25 }),
  aura('Senses spread over the land', ['detect_magic.circle.green', 'detect_magic.circle.blue'], { duration: 2400, scale: 1.4, opacity: 0.75, below: true }),
], { sound: 'detect' }));
put('classfeatures-l7W6JB9yWLLLtQKP', design('Volley: the ranger looses a rain of arrows on every creature around the chosen point.', () => [
  motion('brace', 'source', { stageId: 'draw', duration: 700, intensity: 0.4 }),
  area('Rain of arrows', ['volley_of_projectiles_Circle.arrow.001.001.white', 'volley_of_projectiles_Circle.arrow.001.001.orangeyellow'], { stageId: 'volley', after: 'draw', anchor: 'end', offset: -150, duration: 2400 }),
  motion('recoil', 'targets', { after: 'volley', anchor: 'start', offset: 900, duration: 600, intensity: 0.4, requiresHit: true }),
], ab('longbow')));
put('classes24-phbrgrNaturesVei', design('Nature\'s Veil: nature spirits wrap the ranger in leaves and they fade from sight.', () => [
  aura('Leaves swirl', ['swirling_leaves.complete.01.green'], { stageId: 'veil', duration: 1500, scale: 0.9 }),
  motion('flicker', 'source', { after: 'veil', anchor: 'start', offset: 300, duration: 1200, intensity: 0.8 }),
], { sound: 'growth' }));

// ---------------------------------------------------------------- warlock / sorcerer / misc arcane
put(['classes24-phbinvArmorofSha', 'classfeatures-alUqO6c6OEKFQJdb'], design('Armor of Shadows: a lattice of shadowy force knits around the warlock as Mage Armor.', () => [
  aura('Shadow lattice', ['shield_themed.below.eldritch_web.01.dark_purple'], { stageId: 'web', duration: 2200, scale: 1, fadeIn: 300, fadeOut: 500 }),
  aura('Armor settles', ['shield.02.complete.01.purple', 'shield.01.complete.01.blue'], { after: 'web', anchor: 'start', offset: 300, duration: 1600, scale: 0.8, opacity: 0.7 }),
], { sound: 'shield' }));
put(['classes24-phbinvAscendantS', 'classfeatures-QEuH5TeBN4PPYT2g'], design('Ascendant Step: the warlock rises on Levitate, a shadow left on the ground below.', () => [
  aura('Shadow below', ['drop_shadow.dark_black'], { stageId: 'shadow', duration: 2400, scale: 0.85, opacity: 0.5, below: true, offsetY: 0.2, offsetUnits: 'token' }),
  motion('levitate', 'source', { duration: 2400, intensity: 0.8 }),
  aura('Rising draft', ['wind_lines.01.01.white'], { duration: 1200, scale: 0.7, opacity: 0.45, rotation: -90 }),
], { sound: 'wind' }));
put(['classes24-phbinvGazeofTwoM', 'classfeatures-65ReXU4ZWqcSs3Cm'], design('Gaze of Two Minds: a thin psychic thread links the warlock to a willing creature\'s senses.', () => [
  travel('Shared senses', ['energy_strands.range.standard.blue', 'energy_strands.range.standard.purple'], { stageId: 'link', duration: 1800, scale: 0.5, opacity: 0.8 }),
  aura('Borrowed eyes', ['eyes.01.bluegreen.single', 'eyes.01.dark_green.single'], { subject: 'targets', after: 'link', anchor: 'start', offset: 500, duration: 1500, scale: 0.5, offsetY: -0.5, offsetUnits: 'token' }),
], { sound: null }));
put(['classes24-phbinvFiendishVi', 'classfeatures-id0gmGvzNZBEdzbx'], design('Fiendish Vigor: False Life floods the warlock with a dark, unnatural vitality.', () => [
  aura('Dark vitality', ['healing_generic.burst.purplepink', 'healing_generic.burst.greenorange'], { stageId: 'vigor', duration: 1600, scale: 0.8, ...tint('#8a5ab8') }),
  motion('pulse', 'source', { after: 'vigor', anchor: 'start', offset: 200, duration: 700, intensity: 0.4 }),
], { sound: 'drain' }));
put(['classes24-phbwlkDarkOnesBl', 'classfeatures-Jv0zu4BtUi8bFCqJ'], design('Dark One\'s Blessing: as the foe falls, fiendish flame wraps the warlock as temporary vitality.', () => [
  aura('Fiendish flame', ['shield_themed.below.fire.01.dark_purple', 'shield_themed.below.fire.01.orange'], { stageId: 'flame', duration: 1800, scale: 0.9 }),
  motion('pulse', 'source', { after: 'flame', anchor: 'start', offset: 200, duration: 700, intensity: 0.4 }),
], { sound: 'fire' }));
put('classfeatures-OQSb0bO1yDI4aiMx', design('Dark One\'s Own Luck: the patron nudges fate; a glitter of dark luck flickers around the warlock.', () => [
  aura('Fate twists', ['glint.purple.many', 'glint.yellow.many'], { duration: 1400, scale: 0.7, ...tint('#b48cff') }),
  motion('pulse', 'source', { duration: 600, intensity: 0.3 }),
], { sound: null }));
put('classfeatures-rQhWDaMHMn7iU4f2', design('Stroke of Luck: a lucky glint turns the miss into a hit (or the check into a 20).', () => [
  aura('Lucky glint', ['glint.yellow.many'], { duration: 1300, scale: 0.7 }),
  aura('Fortune', ['markers.light.complete.yellow', 'markers.light.complete.blue'], { ...tint('#ffe08a'), duration: 1500, scale: 0.5, offsetY: -0.5, offsetUnits: 'token' }),
], { sound: null }));
put(['classes24-phbwlkHurlThroug:vIY5Deb2vCh5POdP', 'classfeatures-aCUmlnHlUPHS0rdu'], design('Hurl Through Hell: the struck creature is dragged down through a fiery rift into the Lower Planes.', () => [
  impact('Hellish rift opens', ['portals.horizontal.vortex.red', 'portals.horizontal.ring.bright_yellow'], { stageId: 'rift', duration: 2000, scale: 0.9, below: true }),
  impact('Hellfire', ['flames.01.orange', 'impact.fire.01.orange'], { after: 'rift', anchor: 'start', offset: 300, duration: 1400, scale: 0.6 }),
  motion('sink', 'targets', { after: 'rift', anchor: 'start', offset: 400, duration: 1500, intensity: 0.8 }),
], { sound: 'fear' }));
put('classes24-phbinvRepellingB', design('Repelling Blast: the eldritch blast shoves the struck creature straight back.', () => [
  impact('Force shove', ['side_impact.part.shockwave.purple', 'side_impact.part.shockwave.blue'], { stageId: 'hit', duration: 900, scale: 0.7 }),
  motion('rush', 'targets', { after: 'hit', anchor: 'start', duration: 900, intensity: 0.5, distance: 1, motionRange: 'distance', motionHeading: 'away', motionEndpoint: 'near', requiresHit: true }),
], { sound: 'force' }));
put('classfeatures-pJADgAxxefgcATWr', design('Thirsting Blade: the pact weapon strikes twice in quick succession.', () => [
  motion('lunge', 'source', { stageId: 'm1', duration: 550, intensity: 0.7 }),
  impact('First cut', ['melee_generic.slash.02.001.purple', 'melee_generic.slash.01.orange'], { stageId: 'h1', after: 'm1', anchor: 'start', offset: 180, duration: 850 }),
  motion('lunge', 'source', { stageId: 'm2', after: 'm1', anchor: 'end', duration: 550, intensity: 0.7 }),
  impact('Second cut', ['melee_generic.slash.02.002.purple', 'melee_generic.slash.02.001.blue'], { after: 'm2', anchor: 'start', offset: 180, duration: 850, mirrorX: true }),
], ab('sword')));
put(['classes24-phbinvLifedrinke:LDIKT3JVs25qBVuL'], design('Lifedrinker: the pact weapon bites with an extra pulse of necrotic, psychic or radiant power.', () => [
  impact('Pact weapon drinks', ['impact.003.dark_purple', 'impact.003.blue'], { stageId: 'hit', duration: 1000, scale: 0.8, ...tint('#7a4aa8') }),
  motion('recoil', 'targets', { after: 'hit', anchor: 'start', offset: 120, duration: 600, intensity: 0.5 }),
], { sound: 'drain' }));
put(['classes24-phbinvVisionsOfD', 'classfeatures-zYIdNAjqRyhS6qWs'], design('Visions of Distant Realms: an invisible arcane eye opens and drifts off to scout.', () => [
  aura('Arcane eye opens', ['eyes.01.bluegreen.single', 'eyes.01.dark_green.single'], { duration: 2200, scale: 0.5, offsetY: -0.6, offsetUnits: 'token', fadeIn: 300, fadeOut: 500 }),
], { sound: null }));
put(['classes24-phbinvWhispersOf', 'classfeatures-gFjxo01hAN4c9hDG'], design('Whispers of the Grave: the warlock calls up a corpse\'s spirit to answer questions.', () => [
  aura('Spirit stirs', ['toll_the_dead.grey.skull_smoke', 'toll_the_dead.green.skull_smoke'], { subject: 'targets', stageId: 'spirit', duration: 2000, scale: 0.7, ...tint('#b8c4cc') }),
  aura('Grave whispers', ['smoke.plumes.01.grey'], { subject: 'targets', after: 'spirit', anchor: 'start', offset: 300, duration: 1600, scale: 0.6, opacity: 0.6 }),
], { sound: 'whispers' }));
put('monsterfeatures24-mmFieryRays00000', design('Fiery Rays (Scorching Ray): three rays of fire streak from the caster.', () => [
  cast('Fire gathers', ['cast_generic.fire.01.orange'], { stageId: 'heat', duration: 800, scale: 0.6 }),
  travel('Ray 1', ['scorching_ray.01.orange'], { stageId: 'r1', after: 'heat', anchor: 'start', offset: 400, duration: 1100, targetSelection: 'first' }),
  travel('Ray 2', ['scorching_ray.02.orange', 'scorching_ray.01.orange'], { after: 'heat', anchor: 'start', offset: 650, duration: 1100 }),
  travel('Ray 3', ['scorching_ray.01.orange'], { after: 'heat', anchor: 'start', offset: 900, duration: 1100, targetSelection: 'last' }),
  motion('recoil', 'targets', { after: 'r1', anchor: 'arrival', duration: 650, intensity: 0.5, requiresHit: true }),
], { sound: 'fireRay' }));
put(['monsterfeatures24-mmHellfireSpellc:fN8SjzxRhERq8DlF', 'monsterfeatures24-mmHellfireSpellc:UYyJcxVTi3IXTydV', 'monsterfeatures24-mmHellfireSpellc:d7nppEGoUKLye9JS'], design('Hellfire Spellcasting: a bead of hellfire flies out and blossoms into a fireball.', () => [
  cast('Hellfire gathers', ['cast_generic.fire.01.orange'], { stageId: 'heat', duration: 800, scale: 0.7 }),
  projectile('Fire bead', ['fireball.beam.orange'], { stageId: 'bead', after: 'heat', anchor: 'start', offset: 400, duration: 1200 }),
  impact('Fireball', ['fireball.explosion.orange'], { after: 'bead', anchor: 'end', offset: -150, duration: 1800 }),
], { sound: 'fireball' }));
put(['monsterfeatures24-mmMindInvasion00', 'monsterfeatures24-mmMindJolt000000'], design('Mind Spike: a needle of psychic force stabs into the target\'s mind.', () => [
  travel('Psychic spike', ['energy_strands.range.standard.purple'], { stageId: 'spike', duration: 900, scale: 0.6 }),
  impact('Mind pierced', ['impact.003.pinkpurple', 'impact.003.blue'], { after: 'spike', anchor: 'arrival', duration: 1000, scale: 0.7 }),
  motion('shake', 'targets', { after: 'spike', anchor: 'arrival', duration: 700, intensity: 0.5 }),
], { sound: 'psychic' }));
put(['monsterfeatures-w5mFTTFsdKC7TXgg', 'monsterfeatures24-mmReadThoughts00'], design('Read Thoughts: the creature reaches into a mind and skims its surface thoughts.', () => [
  travel('Mental probe', ['energy_strands.range.standard.purple'], { stageId: 'probe', duration: 1600, scale: 0.45, opacity: 0.7 }),
  aura('Thoughts exposed', ['markers.light.complete.purple', 'markers.light.complete.blue'], { subject: 'targets', after: 'probe', anchor: 'start', offset: 500, duration: 1400, scale: 0.5, offsetY: -0.5, offsetUnits: 'token' }),
], { sound: null }));
const command = design('A single word of command is spoken with supernatural force at the target.', () => [
  motion('brace', 'source', { stageId: 'speak', duration: 500, intensity: 0.4 }),
  travel('Word of command', ['soundwave.01.purple', 'soundwave.01.blue'], { stageId: 'word', after: 'speak', anchor: 'start', offset: 150, duration: 900, scale: 0.5, ...tint('#c8a8ff') }),
  motion('recoil', 'targets', { after: 'word', anchor: 'arrival', duration: 600, intensity: 0.35 }),
], { sound: 'psychic' });
put(['monsterfeatures24-mmBeguile0000000', 'monsterfeatures24-mmCommandingPres', 'monsterfeatures24-mmDreadCommand00'], command);
const hold = (why, color, sound) => design(why, () => [
  cast('Binding gathers', ['cast_generic.02.dark_purple', 'cast_generic.02.blue'], { stageId: 'gather', duration: 800, scale: 0.6, ...tint(color) }),
  impact('Spectral chains bind', ['markers.chain.spectral_standard.complete.02.purple', 'markers.chain.spectral_standard.complete.02.blue'], { stageId: 'bind', after: 'gather', anchor: 'start', offset: 400, duration: 2000, scale: 0.8, ...tint(color) }),
  motion('shake', 'targets', { after: 'bind', anchor: 'start', offset: 200, duration: 900, intensity: 0.35 }),
], { sound });
put('classfeatures-Phy02H5x0TKHd7T3', hold('Chains of Carceri: spectral chains of the prison plane bind the celestial, fiend or elemental (Hold Monster).', '#b48cff', 'chainBinding'));
put('monsterfeatures24-mmChill000000000', hold('Chill: the dragon casts Hold Monster, frost-rimed bindings locking the target in place.', '#bfe8ff', 'cold'));
put('monsterfeatures24-mmConjureInferna', design('Conjure Infernal Chain: a burning chain lashes out and wraps the target.', () => [
  travel('Fiery chain', ['energy_strands.range.standard.dark_red', 'energy_strands.range.standard.purple'], { stageId: 'chain', duration: 1100, scale: 0.6, ...tint('#ff6a2a') }),
  impact('Chain binds', ['markers.chain.spike.complete.02.red', 'markers.chain.standard.complete.02.red'], { after: 'chain', anchor: 'arrival', duration: 1600, scale: 0.7 }),
  impact('Hellfire', ['flames.01.orange', 'impact.fire.01.orange'], { after: 'chain', anchor: 'arrival', duration: 1200, scale: 0.5 }),
  motion('shake', 'targets', { after: 'chain', anchor: 'arrival', duration: 800, intensity: 0.4 }),
], { sound: 'chainBinding' }));
put('monsterfeatures-6ej6jlwh8ryDEzlB', design('Animate Chains: nearby chains sprout razor barbs and writhe to the creature\'s command.', () => [
  motion('pulse', 'source', { duration: 700, intensity: 0.4 }),
  impact('Chains writhe', ['markers.chain.spike.complete.02.grey', 'markers.chain.standard.complete.02.red'], { duration: 2000, scale: 0.8, ...tint('#b8b8b8') }),
], { sound: 'chainBinding' }));
const dominate = design('The creature locks eyes with the target and binds its will with a chain of enchantment.', () => [
  cast('Will gathers', ['cast_shape.circle.01.purple', 'cast_shape.circle.01.blue'], { stageId: 'gather', duration: 800, scale: 0.6 }),
  impact('Will bound', ['markers.chain.spectral_standard.complete.02.purple', 'markers.chain.spectral_standard.complete.02.blue'], { stageId: 'bind', after: 'gather', anchor: 'start', offset: 400, duration: 1800, scale: 0.7 }),
  motion('shake', 'targets', { after: 'bind', anchor: 'start', duration: 800, intensity: 0.3 }),
], { sound: 'psychic' });
put(['monsterfeatures24-mmDominateMind00', 'monsterfeatures-gbcy9MyUF06iUC88'], dominate);
put(['monsterfeatures-NI3FPb5jQsePdlVl', 'monsterfeatures24-mmPossession0000'], design('Possession: the ghost streams into the humanoid\'s body and vanishes.', () => [
  motion('flicker', 'source', { stageId: 'fade', duration: 1100, intensity: 0.9 }),
  travel('Spirit streams in', ['energy_strands.range.standard.grey', 'energy_strands.range.standard.purple'], { stageId: 'stream', after: 'fade', anchor: 'start', offset: 200, duration: 1100, scale: 0.6, ...tint('#cfe0f0') }),
  aura('Possessed', ['smoke.plumes.01.grey'], { subject: 'targets', after: 'stream', anchor: 'arrival', duration: 1400, scale: 0.6, opacity: 0.6 }),
  motion('shake', 'targets', { after: 'stream', anchor: 'arrival', duration: 900, intensity: 0.4 }),
], { sound: 'spirit' }));
put(['monsterfeatures-iq0J225DCbHYU2hU', 'monsterfeatures24-mmDrainingKiss00'], design('Draining Kiss: a fiendish kiss draws life out of the charmed creature.', () => [
  motion('lunge', 'source', { stageId: 'kiss', duration: 700, intensity: 0.5 }),
  impact('Kiss', ['impact_themed.heart.pink', 'markers.heart.pink'], { stageId: 'hit', after: 'kiss', anchor: 'start', offset: 250, duration: 1000, scale: 0.6 }),
  travel('Life drawn out', ['energy_strands.range.standard.dark_red', 'energy_strands.range.standard.purple'], { after: 'hit', anchor: 'start', offset: 300, duration: 1100, scale: 0.5, travelOrigin: 'target', ...tint('#d06080') }),
  motion('shake', 'targets', { after: 'hit', anchor: 'start', offset: 300, duration: 800, intensity: 0.4 }),
], { sound: 'drain' }));
put(['monsterfeatures-r2nM5I77LnSvkLvD', 'monsterfeatures24-mmConsumeLife000:1Hy8CdhpwQlLxDPq'], design('Consume Life: the creature drinks the last life of a dying creature to heal itself.', () => [
  aura('Life leaves the body', ['toll_the_dead.green.skull_smoke'], { subject: 'targets', stageId: 'leave', duration: 1400, scale: 0.6, ...tint('#7a9a6a') }),
  travel('Life siphoned', ['energy_strands.range.standard.dark_green', 'energy_strands.range.standard.purple'], { stageId: 'siphon', after: 'leave', anchor: 'start', offset: 300, duration: 1200, scale: 0.5, travelOrigin: 'target' }),
  aura('Stolen vitality', ['healing_generic.200px.green'], { after: 'siphon', anchor: 'end', offset: -300, duration: 1200, scale: 0.6, ...tint('#6a8a5a') }),
], { sound: 'drain' }));
put('monsterfeatures24-mmLifeDrain00000', design('Life Drain: a necrotic touch withers the target and saps its hit point maximum.', () => [
  motion('lunge', 'source', { stageId: 'touch', duration: 600, intensity: 0.7 }),
  impact('Withering touch', ['impact.004.dark_purple', 'impact.004.blue'], { stageId: 'hit', after: 'touch', anchor: 'start', offset: 200, duration: 1000, scale: 0.8, ...tint('#6a4a8c') }),
  travel('Life siphoned', ['energy_strands.range.standard.dark_purple', 'energy_strands.range.standard.purple'], { after: 'hit', anchor: 'start', offset: 200, duration: 1000, scale: 0.45, travelOrigin: 'target' }),
  motion('recoil', 'targets', { after: 'hit', anchor: 'start', duration: 650, intensity: 0.5 }),
], { sound: 'drain' }));
put(['monsterfeatures-iCae1IDxHvRmjEgi', 'monsterfeatures24-mmHeartSight0000'], design('Heart Sight: the celestial touches a creature and reads its heart and alignment.', () => [
  motion('lunge', 'source', { stageId: 'touch', duration: 600, intensity: 0.35 }),
  impact('Heart revealed', ['impact_themed.heart.pinkyellow', 'markers.heart.pink'], { after: 'touch', anchor: 'start', offset: 250, duration: 1300, scale: 0.55 }),
], { sound: null }));
put('monsterfeatures-qfWKOH5AawhmNSwl', design('Intoxicating Touch: a fey touch leaves the target magically cursed and woozy.', () => [
  motion('lunge', 'source', { stageId: 'touch', duration: 600, intensity: 0.5 }),
  impact('Fey curse', ['impact.003.pinkpurple', 'impact.003.blue'], { stageId: 'hit', after: 'touch', anchor: 'start', offset: 200, duration: 1000, scale: 0.7, ...tint('#e08ad8') }),
  aura('Woozy', ['markers.smoke.ring.loop.purple', 'markers.smoke.ring.loop.bluepurple'], { subject: 'targets', after: 'hit', anchor: 'start', offset: 200, duration: 1500, scale: 0.5, offsetY: -0.4, offsetUnits: 'token', requiresHit: true }),
], { sound: 'psychic' }));
put(['monsterfeatures-8C6hkMXWLeymmJ5C:dnd5eactivity000', 'monsterfeatures-8C6hkMXWLeymmJ5C:dnd5eactivity100', 'monsterfeatures24-mmBlindingGaze00'], design('Blinding Gaze: the creature\'s eyes flare and a searing glare strikes the target.', () => [
  aura('Eyes flare', ['eyes.01.dark_yellow.single', 'eyes.01.dark_green.single'], { stageId: 'eyes', duration: 1000, scale: 0.5, offsetY: -0.3, offsetUnits: 'token' }),
  impact('Searing glare', ['impact.006.yellow'], { after: 'eyes', anchor: 'start', offset: 450, duration: 900, scale: 0.7 }),
  motion('recoil', 'targets', { after: 'eyes', anchor: 'start', offset: 500, duration: 600, intensity: 0.35 }),
], { sound: 'light' }));
put('monsterfeatures-wkIN7WTeX8ebbjtv', design('Petrifying Gaze: meeting the creature\'s eyes, the target\'s flesh begins to stiffen to stone.', () => [
  aura('Gaze', ['eyes.01.dark_yellow.single', 'eyes.01.dark_green.single'], { stageId: 'eyes', duration: 1000, scale: 0.5, offsetY: -0.3, offsetUnits: 'token' }),
  aura('Stone creeps', ['ground_cracks.01.white', 'ground_cracks.01.orange'], { subject: 'targets', after: 'eyes', anchor: 'start', offset: 450, duration: 1600, scale: 0.6, below: true, ...tint('#9e9e8c') }),
  motion('shake', 'targets', { after: 'eyes', anchor: 'start', offset: 450, duration: 800, intensity: 0.3 }),
], { sound: 'earth' }));
put('monsterfeatures-BDnjS1sQi2pdARh8', design('The stone golem\'s Slow: time drags for creatures around it.', () => [
  motion('press', 'source', { duration: 800, intensity: 0.4 }),
  aura('Time drags', ['icosahedron.rune.above.dark_greenpurple', 'icosahedron.rune.above.blueyellow'], { subject: 'targets', duration: 2000, scale: 0.5, offsetY: -0.4, offsetUnits: 'token', ...tint('#a9c2d6') }),
], { sound: 'slow' }));
put('monsterfeatures-ZIGTG2qhkJ54jEk4', design('Haste: time quickens around the creature, which moves in blurred afterimages.', () => [
  aura('Time quickens', ['icosahedron.rune.above.dark_greenpurple', 'icosahedron.rune.above.blueyellow'], { stageId: 'rune', duration: 1600, scale: 0.6, offsetY: -0.4, offsetUnits: 'token' }),
  sprite('Afterimage', { after: 'rune', anchor: 'start', offset: 300, duration: 800, opacity: 0.35, offsetX: -0.15, offsetUnits: 'token' }),
  motion('shake', 'source', { after: 'rune', anchor: 'start', offset: 300, duration: 700, intensity: 0.3 }),
], { sound: 'time' }));
put(['monsterfeatures-t0ojYPOlKEbPpYNc', 'monsterfeatures24-mmPhantasms00000'], design('Phantasms: three illusory duplicates shimmer into being around the creature.', () => [
  aura('Illusion shimmer', ['shimmer.01.purple', 'shimmer.01.blue'], { stageId: 'shim', duration: 1400, scale: 0.9 }),
  sprite('Duplicate', { after: 'shim', anchor: 'start', offset: 300, duration: 1600, opacity: 0.45, offsetX: -0.45, offsetUnits: 'token' }),
  sprite('Duplicate', { after: 'shim', anchor: 'start', offset: 450, duration: 1600, opacity: 0.45, offsetX: 0.45, offsetUnits: 'token' }),
  sprite('Duplicate', { after: 'shim', anchor: 'start', offset: 600, duration: 1600, opacity: 0.45, offsetY: -0.4, offsetUnits: 'token' }),
], { sound: 'transform' }));
const invis = design('The creature fades from sight.', () => [
  aura('Fading shimmer', ['shimmer.01.purple', 'shimmer.01.blue'], { stageId: 'fade', duration: 1300, scale: 0.8, opacity: 0.8 }),
  motion('flicker', 'source', { after: 'fade', anchor: 'start', offset: 200, duration: 1200, intensity: 0.9 }),
], { sound: null });
put(['monsterfeatures-dA5X2eQuOtHywpQF', 'monsterfeatures24-mmInvisibility00', 'monsterfeatures-FRIASnssihfMTZ7q', 'monsterfeatures24-mmVanish00000000', 'classfeatures-3jwFt3hSqDswBlOH'], invis);
put('monsterfeatures24-mmCloakedFlight0', design('Cloaked Flight: the dragon turns invisible and takes wing.', () => [
  aura('Fading shimmer', ['shimmer.01.blue'], { stageId: 'fade', duration: 1200, scale: 0.9, opacity: 0.8 }),
  motion('flicker', 'source', { after: 'fade', anchor: 'start', offset: 200, duration: 1000, intensity: 0.8 }),
  motion('rush', 'source', { after: 'fade', anchor: 'start', offset: 600, duration: 1500, intensity: 0.15, distance: 1.6, motionRange: 'distance', motionHeading: 'toward', motionEndpoint: 'near' }),
  aura('Wingbeat gust', ['wind_lines.01.02.white'], { after: 'fade', anchor: 'start', offset: 600, duration: 1000, scale: 0.9, opacity: 0.5 }),
], { sound: 'wind' }));
const shadowMerge = design('The creature melts into the surrounding shadows.', () => [
  aura('Shadows gather', ['smoke.puff.centered.dark_purple', 'smoke.puff.centered.grey'], { stageId: 'shade', duration: 1200, scale: 0.8, opacity: 0.7, ...tint('#3d3550') }),
  motion('sink', 'source', { after: 'shade', anchor: 'start', offset: 150, duration: 1200, intensity: 0.5 }),
], { sound: 'shadow' });
put(['classes24-phbinvOnewithSha', 'classfeatures-KfnUyjUWAk0bAAus', 'monsterfeatures-nUVFUgyKK7fmQaFh', 'monsterfeatures24-mmShadowStealth0', 'classfeatures-DhU2dWCNnX78TstR'], shadowMerge);
const shapechange = design('The creature\'s form blurs and reshapes in a swirl of smoke.', () => [
  aura('Form blurs', ['smoke.puff.ring.01.white'], { stageId: 'blur', duration: 1100, scale: 0.9, opacity: 0.8, ...tint('#c9b8e8') }),
  aura('Reshaping', ['shimmer.01.purple', 'shimmer.01.blue'], { after: 'blur', anchor: 'start', offset: 200, duration: 1300, scale: 0.9 }),
  motion('pulse', 'source', { after: 'blur', anchor: 'start', offset: 200, duration: 900, intensity: 0.6 }),
], { sound: 'transform' });
put(['monsterfeatures-JsAys4RSGi4lN5Jy', 'monsterfeatures-VhByyxHJN7MNQJRd', 'monsterfeatures24-mmShapeshift0000', 'monsterfeatures24-mmIncubusForm000', 'monsterfeatures24-mmSuccubusForm00'], shapechange);
const enlarge = design('The creature swells to a larger size, the ground shuddering under its new weight.', () => [
  motion('pulse', 'source', { stageId: 'grow', duration: 1300, intensity: 1.2 }),
  aura('Ground shudders', ['smoke.puff.ring.01.white'], { after: 'grow', anchor: 'start', offset: 400, duration: 1000, scale: 0.9, opacity: 0.6, below: true, ...tint('#cbbfa8') }),
], { sound: 'transform' });
put(['monsterfeatures-jZgeHxCR8pF6FOmQ', 'origins24-phbsptLargeForm0'], enlarge);
put('monsterfeatures-dm2G9HupHZbZRvNm', design('Children of the Night: swarms of bats (or rats, or wolves) answer the vampire\'s call.', () => [
  motion('brace', 'source', { stageId: 'call', duration: 600, intensity: 0.4 }),
  aura('Bats swarm out', ['bats.complete.01.red', 'bats.complete.01.green'], { after: 'call', anchor: 'start', offset: 200, duration: 2400, scale: 1.2, ...tint('#5a4a5a') }),
], { sound: 'swarm' }));
put(['monsterfeatures-SlAF2AE4ZKoUvQql', 'monsterfeatures24-mmCreateSpecter0'], design('Create Specter: the violently slain humanoid\'s spirit rises as a specter.', () => [
  aura('Spirit rises', ['toll_the_dead.grey.skull_smoke', 'toll_the_dead.green.skull_smoke'], { subject: 'targets', stageId: 'rise', duration: 2000, scale: 0.8, ...tint('#b8c4cc') }),
  aura('Spectral smoke', ['smoke.plumes.01.grey'], { subject: 'targets', after: 'rise', anchor: 'start', offset: 300, duration: 1800, scale: 0.7, opacity: 0.7 }),
], { sound: 'spirit' }));
put(['monsterfeatures-j6F0v4guYhRYWddT', 'monsterfeatures24-mmAnimateTrees00'], design('Animate Trees: nearby trees shudder awake and uproot themselves.', () => [
  motion('pulse', 'source', { duration: 700, intensity: 0.4 }),
  aura('Leaves shake loose', ['swirling_leaves.complete.01.green'], { subject: 'targets', stageId: 'wake', duration: 1800, scale: 0.9 }),
  motion('shake', 'targets', { after: 'wake', anchor: 'start', offset: 200, duration: 1200, intensity: 0.5 }),
], { sound: 'growth' }));
put(['classes24-phbdrdLandsAid00:dnd5eactivity000'], design('Land\'s Aid: life-draining thorns burst from the ground in the chosen area.', () => [
  cast('Wild Shape energy', ['swirling_leaves.complete.01.green'], { stageId: 'call', duration: 900, scale: 0.6 }),
  area('Thorns and flowers erupt', ['plant_growth.04.ring.4x4.complete.greenwhite', 'plant_growth.03.ring.4x4.complete.greenyellow'], { stageId: 'thorns', after: 'call', anchor: 'start', offset: 400, duration: 2200 }),
  motion('recoil', 'targets', { after: 'thorns', anchor: 'start', offset: 400, duration: 600, intensity: 0.4 }),
], { sound: 'thornWall' }));
put(['monsterfeatures-Uvy7vla2EhYSfTl0', 'monsterfeatures24-mmIgnitedIllumin'], design('Ignited Illumination: the creature bursts into flame (or snuffs it out).', () => [
  aura('Bursts alight', ['flames.01.orange', 'impact.fire.01.orange'], { stageId: 'ignite', duration: 1800, scale: 0.9 }),
  motion('pulse', 'source', { after: 'ignite', anchor: 'start', duration: 700, intensity: 0.4 }),
], { sound: 'fireIgnition' }));
put('monsterfeatures24-mmHeatAura000000', design('Heat Aura: shimmering heat scorches everything in the emanation.', () => [
  area('Heat shimmer', ['fire_ring.500px.red', 'fire_ring.500px.yellow'], { stageId: 'heat', duration: 2200, opacity: 0.75 }),
  motion('pulse', 'source', { duration: 700, intensity: 0.4 }),
  motion('shake', 'targets', { after: 'heat', anchor: 'start', offset: 400, duration: 600, intensity: 0.3 }),
], { sound: 'fire' }));
put(['monsterfeatures-EmlE1a0rhucK2UT1', 'monsterfeatures24-mmDeathThroes000'], design('Death Throes: the dying fiend explodes in a massive blast of fire.', () => [
  motion('shake', 'source', { stageId: 'tremor', duration: 700, intensity: 0.7 }),
  area('Fiery explosion', ['explosion.01.orange'], { stageId: 'boom', after: 'tremor', anchor: 'end', offset: -150, duration: 2000 }),
  area('Fireball blast', ['fireball.explosion.orange'], { after: 'boom', anchor: 'start', offset: 200, duration: 1800, opacity: 0.85 }),
  motion('recoil', 'targets', { after: 'boom', anchor: 'start', offset: 250, duration: 700, intensity: 0.6 }),
], { sound: 'explosion' }));
put(['monsterfeatures-net3yBKQoxl8bZ4r:dnd5eactivity000', 'monsterfeatures-net3yBKQoxl8bZ4r:dnd5eactivity100'], design('Death Burst: the dying mephit bursts into a choking cloud of dust.', () => [
  motion('shake', 'source', { stageId: 'tremor', duration: 600, intensity: 0.6 }),
  aura('Burst of dust', ['smoke.puff.ring.02.white', 'smoke.puff.ring.01.white'], { after: 'tremor', anchor: 'end', offset: -100, duration: 1300, scale: 1.4, ...tint('#cbb894') }),
  aura('Dust hangs', ['smoke.puff.centered.grey'], { after: 'tremor', anchor: 'end', duration: 1600, scale: 1, opacity: 0.7, ...tint('#cbb894') }),
], { sound: 'wind' }));
put('monsterfeatures24-mmDeathBurst0000', design('Death Burst: the dying creature explodes, its element blasting the surrounding space.', () => [
  motion('shake', 'source', { stageId: 'tremor', duration: 600, intensity: 0.6 }),
  area('Elemental burst', ['explosion.01.orange'], { stageId: 'boom', after: 'tremor', anchor: 'end', offset: -100, duration: 1600 }),
  motion('recoil', 'targets', { after: 'boom', anchor: 'start', offset: 200, duration: 600, intensity: 0.5 }),
], { sound: 'explosion' }));
put(['monsterfeatures-KoBGbIkb2tMZv0ch', 'monsterfeatures24-mmAberrantGround'], design('Aberrant Ground: the ground around the creature turns to sucking, doughlike muck.', () => [
  motion('pulse', 'source', { duration: 700, intensity: 0.4 }),
  area('Doughlike ground', ['grease.dark_purple.loop', 'grease.dark_brown.loop'], { stageId: 'muck', duration: 2600, opacity: 0.8, ...tint('#7a5a8c') }),
  aura('Ground warps', ['ground_cracks.01.purple', 'ground_cracks.01.orange'], { after: 'muck', anchor: 'start', duration: 2000, scale: 0.9, below: true, opacity: 0.6, ...tint('#8a6aa8') }),
], { sound: 'earth' }));
put('monsterfeatures-Xwj2GPqTxngS0j2L', design('Blasphemous Word: an unholy word ripples out to every creature within 10 feet.', () => [
  motion('brace', 'source', { stageId: 'utter', duration: 600, intensity: 0.5 }),
  area('Blasphemy ripples out', ['soundwave.02.purple', 'soundwave.02.blue'], { stageId: 'word', after: 'utter', anchor: 'start', offset: 200, duration: 1700, ...tint('#8a3a6a') }),
  motion('recoil', 'targets', { after: 'word', anchor: 'start', offset: 250, duration: 700, intensity: 0.5 }),
], { sound: 'scream' }));
put(['monsterfeatures-ao6mxTJVYy7WaVgW'], design('Blinding Dust: magical dust and sand whirl around the creature.', () => [
  area('Swirling dust', ['whirlwind.bluewhite', 'whirlwind.bluegrey'], { stageId: 'dust', duration: 2200, opacity: 0.8, ...tint('#d9c49a') }),
  aura('Grit', ['smoke.puff.ring.01.white'], { duration: 1200, scale: 1, opacity: 0.6, below: true, ...tint('#d9c49a') }),
], { sound: 'wind' }));
put(['monsterfeatures-dPPLbo3Unu3TqZrs:dnd5eactivity000', 'monsterfeatures-dPPLbo3Unu3TqZrs:dnd5eactivity300', 'monsterfeatures24-mmGibbering00000:PyGOI84k0PPYrru8'], design('Gibbering: maddening, incoherent babble spills out over everything nearby.', () => [
  motion('shake', 'source', { duration: 1200, intensity: 0.3 }),
  area('Maddening babble', ['soundwave.01.multicolored02', 'soundwave.01.blue'], { stageId: 'babble', duration: 2000, opacity: 0.7, ...tint('#b48cc8') }),
  motion('shake', 'targets', { after: 'babble', anchor: 'start', offset: 400, duration: 700, intensity: 0.3 }),
], { sound: 'whispers' }));
put(['monsterfeatures-hu2pgYS1RD7hglvg', 'monsterfeatures24-mmHorrorNimbus00'], design('Horror Nimbus: scintillating, multicolored light flares from the creature.', () => [
  area('Scintillating light', ['energy_field.01.multicolored', 'energy_field.01.blue'], { stageId: 'nimbus', duration: 2200, opacity: 0.8 }),
  motion('pulse', 'source', { duration: 800, intensity: 0.5 }),
  motion('cower', 'targets', { after: 'nimbus', anchor: 'start', offset: 400, duration: 1000, intensity: 0.4 }),
], { sound: 'fear' }));
put('monsterfeatures24-mmBalefulCommand', design('Baleful Command: a dreadful psychic command booms out through the emanation.', () => [
  motion('brace', 'source', { stageId: 'utter', duration: 600, intensity: 0.5 }),
  area('Psychic command', ['soundwave.02.purple', 'soundwave.02.blue'], { stageId: 'word', after: 'utter', anchor: 'start', offset: 200, duration: 1800, ...tint('#b48cff') }),
  motion('recoil', 'targets', { after: 'word', anchor: 'start', offset: 250, duration: 700, intensity: 0.5 }),
], { sound: 'psychic' }));
put('monsterfeatures24-mmCacophony00000', design('Cacophony: a deafening din erupts inside the creature\'s space.', () => [
  impact('Deafening din', ['soundwave.02.blue'], { stageId: 'din', duration: 1300, scale: 0.6 }),
  motion('shake', 'targets', { after: 'din', anchor: 'start', duration: 800, intensity: 0.4 }),
], { sound: 'sonic' }));
put('monsterfeatures24-mmThunderousBell', design('Thunderous Bellow: a cone of deafening, terrifying sound bursts from the creature.', () => [
  motion('brace', 'source', { stageId: 'draw', duration: 600, intensity: 0.6 }),
  area('Bellowing cone', ['extras.tmfx.outpulse.cone.01.fast', 'extras.tmfx.outpulse.cone.01.normal'], { stageId: 'bellow', after: 'draw', anchor: 'end', offset: -100, duration: 1600, ...tint('#9fc7ff') }),
  motion('lunge', 'source', { after: 'draw', anchor: 'end', duration: 700, intensity: 0.4 }),
  motion('recoil', 'targets', { after: 'bellow', anchor: 'start', offset: 300, duration: 700, intensity: 0.5 }),
], { sound: 'sonic' }));
put('monsterfeatures24-mmGigglingMagic0', design('Giggling Magic: a burst of fey mirth leaves the target giggling and off balance.', () => [
  impact('Fits of giggles', ['dizzy_stars.200px.pink', 'dizzy_stars.200px.blueorange'], { stageId: 'giggle', duration: 1500, scale: 0.6, offsetY: -0.35, offsetUnits: 'token' }),
  motion('shake', 'targets', { after: 'giggle', anchor: 'start', duration: 900, intensity: 0.35 }),
], { sound: 'laughter' }));
put(['monsterfeatures24-mmMagicOfTheSpid:ErB1BoIjo8Wj9KXS', 'monsterfeatures24-mmMagicOfTheSpid:8Zw5hRXyd8axv5Zs', 'monsterfeatures24-mmMagicOfTheSpid:B8OHv2CaawtJoMu7'], design('Magic of the Spider Queen: drow innate magic (Darkness, Faerie Fire or Web) gathers in violet shadow.', () => [
  cast('Drow magic gathers', ['cast_generic.02.dark_purple', 'cast_generic.02.blue'], { stageId: 'gather', duration: 1000, scale: 0.7, ...tint('#8a6ab8') }),
  aura('Violet shadow', ['smoke.puff.centered.dark_purple', 'smoke.puff.centered.grey'], { after: 'gather', anchor: 'start', offset: 400, duration: 1300, scale: 0.8, opacity: 0.7, ...tint('#6a4a9a') }),
], { sound: 'shadow' }));
put('monsterfeatures24-mmNightmareHaunt', design('Nightmare Haunting: the night hag sends a dread dream to a sleeping creature.', () => [
  cast('Dream gathers', ['cast_shape.circle.01.purple', 'cast_shape.circle.01.blue'], { stageId: 'gather', duration: 900, scale: 0.6 }),
  aura('Nightmare', ['sleep.symbol.dark_purple', 'sleep.symbol.pink'], { subject: 'targets', after: 'gather', anchor: 'start', offset: 400, duration: 1800, scale: 0.6 }),
], { sound: 'psychic' }));
put('races-koRPOLtj8XAFMwnW', design('Tinker: a few practiced turns of a tinker\'s wrench and a clockwork device takes shape.', () => [
  aura('Tinkering', ['wrench.melee.01.white'], { duration: 1200, scale: 0.5, ...tint('#c9b48a') }),
  motion('pulse', 'source', { duration: 500, intensity: 0.25 }),
], { sound: null }));
put('monsterfeatures24-mmSpiritualWeapo', design('Spiritual Weapon: a floating spectral weapon appears beside the caster.', () => [
  aura('Spectral weapon appears', ['spiritual_weapon.longsword.01.flaming.yellow', 'spiritual_weapon.greatsword.01.spectral.02.green'], { duration: 2400, scale: 0.6, offsetX: 0.6, offsetUnits: 'token', fadeIn: 300, fadeOut: 400 }),
], { sound: 'metal' }));
put(['monsterfeatures-gM767AhU36B6LUGU'], design('Lightning Storm: three bolts of lightning crash down on the chosen targets.', () => [
  cast('Charge builds', ['static_electricity.01.blue'], { stageId: 'charge', duration: 900, scale: 0.7 }),
  impact('Lightning strikes', ['lightning_strike.blue'], { stageId: 'strike', after: 'charge', anchor: 'start', offset: 450, duration: 1200, repeats: 1 }),
  motion('recoil', 'targets', { after: 'strike', anchor: 'start', offset: 150, duration: 650, intensity: 0.6 }),
], { sound: 'lightningBolt' }));
put('monsterfeatures24-mmCloudOfInsects', design('Cloud of Insects: a buzzing swarm descends on the target.', () => [
  impact('Swarm descends', ['fireflies.few.02.yellow', 'fireflies.few.02.green'], { stageId: 'swarm', duration: 2000, scale: 0.8, ...tint('#4a4a3a') }),
  motion('shake', 'targets', { after: 'swarm', anchor: 'start', offset: 300, duration: 1200, intensity: 0.35 }),
], { sound: 'swarm' }));
put(['classes24-phbdrdNaturesSan:oV51RLBkYFH4MPrS'], design('Nature\'s Sanctuary: the spectral trees and vines shift to a new spot.', () => [
  aura('Spectral grove shifts', ['swirling_leaves.complete.01.green'], { duration: 1600, scale: 0.9 }),
  motion('pulse', 'source', { duration: 600, intensity: 0.3 }),
], { sound: 'growth' }));

// ---------------------------------------------------------------- dragon wings / flight
const wings = design('Spectral draconic wings unfurl and lift the creature into the air.', () => [
  aura('Wings unfurl', ['swirling_feathers.outburst.01.purple', 'swirling_feathers.outburst.01.textured'], { stageId: 'wings', duration: 1300, scale: 0.9, ...tint('#b8a0e0') }),
  aura('Shadow below', ['drop_shadow.dark_black'], { after: 'wings', anchor: 'start', offset: 300, duration: 2000, scale: 0.85, opacity: 0.5, below: true, offsetY: 0.2, offsetUnits: 'token' }),
  motion('levitate', 'source', { after: 'wings', anchor: 'start', offset: 300, duration: 2000, intensity: 0.8 }),
], { sound: 'wind' });
put(['origins24-phbsptDraconicFl', 'classes24-phbscrDragonWing:W3TaYUpTcgqAtLD7', 'classfeatures-3647zjKSE9zFwOXc'], wings);

// ---------------------------------------------------------------- conditions & effects (persistent aura stages only)
const SHADOW = ['drop_shadow.dark_black'];
const airborne = state('Airborne: a soft shadow on the ground beneath the token shows it is off the ground.', [['Shadow below', SHADOW, { scale: 0.85, opacity: 0.45, below: true, offsetY: 0.25, offsetUnits: 'token' }]]);
put(['conditions-dnd5eflying00000', 'conditions-dnd5ehovering000', 'effects-h8FIaFzsQaEWAlAj', 'classes24-GYjbKCZHH2Yl0vTI-phbinvAscendantS'], airborne);
const burrowing = state('Burrowing: churned, cracked earth around the token marks it moving underground.', [['Churned earth', ['ground_cracks.01.orange'], { scale: 0.8, opacity: 0.65, below: true }]]);
put(['conditions-dnd5eburrowing00', 'effects-oA0sjAn5gZxPI1ci'], burrowing);
put('conditions-dnd5ecoverHalf00', state('Half Cover: a low rampart marker shows partial protection.', [['Half cover', ['markers.shield_rampart.loop.01.white', 'markers.shield_rampart.loop.01.orange'], { scale: 0.45, opacity: 0.55, offsetY: -0.5, offsetUnits: 'token', ...tint('#d8d8d8') }]]));
put('conditions-dnd5ecoverThreeQ', state('Three-Quarters Cover: a sturdier rampart marker.', [['Three-quarters cover', ['markers.shield_rampart.loop.03.white', 'markers.shield_rampart.loop.01.orange'], { scale: 0.5, opacity: 0.75, offsetY: -0.5, offsetUnits: 'token', ...tint('#e0e0e0') }]]));
put('conditions-dnd5ecoverTotal0', state('Total Cover: a full rampart marker; the creature cannot be targeted directly.', [['Total cover', ['markers.shield_rampart.loop.03.blue', 'markers.shield_rampart.loop.01.orange'], { scale: 0.55, opacity: 0.9, offsetY: -0.5, offsetUnits: 'token', ...tint('#a8c8f0') }]]));
put('conditions-dnd5edodging0000', state('Dodging: faint motion lines around a creature focused on evasion.', [['Evasive motion', ['wind_lines.01.01.white'], { scale: 0.8, opacity: 0.35 }]]));
put('conditions-dnd5ehiding00000', state('Hiding: a dim veil of shadow around the hidden creature.', [['In shadow', ['darkness.black'], { scale: 0.9, opacity: 0.3, below: true }]]));
put(['conditions-dnd5esleeping000'], state('Sleeping: drifting Zs above the sleeper.', [['Zzz', ['sleep.symbol.blue', 'sleep.symbol.pink'], { scale: 0.45, offsetY: -0.45, offsetUnits: 'token', ...tint('#9fc0ff') }]]));
put(['conditions-dnd5eunconscious', 'effects-HjLkxDzLNBogspf9'], state('Unconscious: the creature is out cold; dim Zs drift above it.', [['Out cold', ['sleep.symbol.dark_purple', 'sleep.symbol.pink'], { scale: 0.45, opacity: 0.85, offsetY: -0.45, offsetUnits: 'token', ...tint('#9a8ab8') }]]));
put('conditions-dnd5estable00000', state('Stable: a slow, steady heartbeat shows the creature has stabilized at 0 HP.', [['Steady heartbeat', ['ui.heartbeat.01.green'], { scale: 0.5, opacity: 0.85, offsetY: -0.5, offsetUnits: 'token' }]]));
put(['conditions-dnd5ebleeding000', 'effects-w9J7VZ6K2mg7Alkj'], state('Bleeding: drops of blood fall from the wounded creature.', [['Bleeding', ['markers.drop.red'], { scale: 0.5, offsetY: -0.4, offsetUnits: 'token' }]]));
put(['conditions-dnd5edehydration', 'effects-c5CkG3XDA5xfxpDM'], state('Dehydration: a faint heat shimmer hangs over the parched creature.', [['Heat shimmer', ['shimmer.01.orange', 'shimmer.01.blue'], { scale: 0.8, opacity: 0.45, ...tint('#e0b070') }]]));
put(['conditions-dnd5efalling0000', 'effects-BQCAZYONY9Uj9eB8'], state('Falling: rushing air streams past the plummeting creature.', [['Rushing air', ['wind_lines.01.02.white'], { scale: 0.8, opacity: 0.5, rotation: -90 }]]));
put(['conditions-dnd5eexhaustion0'], state('Exhaustion: the spent creature steams and sags with fatigue.', [['Fatigue', ['smoke.plumes_loop.01.grey'], { scale: 0.55, opacity: 0.4, offsetY: -0.3, offsetUnits: 'token' }]]));
put(['conditions-dnd5esilenced000', 'effects-ryGbnbaNnIOEHvHG'], state('Silenced: a mute marker over a creature that cannot speak or cast verbal spells.', [['Silenced', ['markers.mute.blue', 'markers.mute.dark_red'], { scale: 0.5, offsetY: -0.45, offsetUnits: 'token', ...tint('#8bbdf4') }]]));
put(['conditions-dnd5esuffocation', 'effects-lvsHwbBuaREr4czg'], state('Suffocation: the last breaths escape as bubbles.', [['Last breaths', ['markers.bubble.loop.blue'], { scale: 0.5, opacity: 0.85, offsetY: -0.35, offsetUnits: 'token' }]]));
put(['conditions-dnd5esurprised00', 'effects-0ivzvyzkvAecusEm'], state('Surprised: an alert indicator over a creature caught off guard.', [['Caught off guard', ['ui.indicator.yellow.01.01'], { scale: 0.45, offsetY: -0.5, offsetUnits: 'token' }]]));
put(['conditions-dnd5etransformed', 'effects-cpzImXTyBL2ATXDS'], state('Transformed: transmutation sparkles linger around the changed form.', [['Transmuted', ['swirling_sparkles.01.bluepink', 'swirling_sparkles.01.blue'], { scale: 0.8, opacity: 0.6 }]]));
put('effects-gw5xaEbysuecB0k8', state('Swim Speed: bubbles trail the swimmer.', [['Bubbles', ['markers.bubble.loop.blue'], { scale: 0.5, opacity: 0.6, offsetY: -0.3, offsetUnits: 'token' }]]));
put(['spells-14Qp5HLSat31r3uM-8RTDOt80u8aBv9qx', 'spells24-6SL9vuAkx7nAfS5D-phbsplAlterSelf0'], state('Aquatic Adaptation: gills and webbing; bubbles mark the water-breathing form.', [['Water breathing', ['markers.bubble.loop.blue'], { scale: 0.5, opacity: 0.65, offsetY: -0.3, offsetUnits: 'token' }]]));
put(['spells-V6Y9a1LElOYZc4J7-8RTDOt80u8aBv9qx', 'spells24-1jrUeJtfZMGhJOZa-phbsplAlterSelf0'], state('Changed Appearance: a faint transmutation shimmer over the altered features.', [['Altered features', ['shimmer.01.purple', 'shimmer.01.blue'], { scale: 0.8, opacity: 0.35 }]]));
put('effects-phbeffAuraLife00', state('Aura of Life: a soft green-gold glow of life energy around the creature.', [['Life aura', ['healing_generic.loop.greenorange'], { scale: 1.2, opacity: 0.45, below: true }]]));
put(['equipment24-ObtXWapsou2jYoip-dmgAmuletOfHealt', 'items-EDhQAxztAvrCtTMV-iiQxTvDOhPGW5spF'], state('Amulet of Health: a strong, steady heartbeat of fixed Constitution.', [['Hale heartbeat', ['ui.heartbeat.01.red', 'ui.heartbeat.01.green'], { scale: 0.45, opacity: 0.7, offsetY: -0.5, offsetUnits: 'token', ...tint('#e06060') }]]));
put('spells-Gz4NTcpPjakj03qY-oyE5nVppa5mde5gT', state('Controlled Undead: spectral chains bind the undead to its master\'s will.', [['Bound to command', ['markers.chain.spectral_standard.loop.02.purple', 'markers.chain.spectral_standard.loop.02.blue'], { scale: 0.6, opacity: 0.75 }]]));
const antipathy = state('Antipathy: a repelling pulse pushes outward from the enchanted target.', [['Repelling pulse', ['extras.tmfx.outpulse.circle.01.slow', 'extras.tmfx.outpulse.circle.01.normal'], { scale: 1.2, opacity: 0.45, below: true, ...tint('#d06a6a') }]]);
const sympathy = state('Sympathy: an alluring pulse draws creatures in toward the enchanted target.', [['Alluring pull', ['extras.tmfx.inpulse.circle.01.normal'], { scale: 1.2, opacity: 0.45, below: true, ...tint('#e8a0d0') }]]);
put(['spells-Q8oqI0ISzsugmoDk-GJ2WYm3SQFR0winH', 'spells24-bW6xZzK4dmulRmUT-phbsplAntipathyS'], antipathy);
put(['spells-lFjm3pDxzxo4U5Jm-GJ2WYm3SQFR0winH', 'spells24-Cz9yMSQmtWRnz81Z-phbsplAntipathyS'], sympathy);
put(['equipment24-DzWVacNiq6ggXbU9-phbagAntitoxin00', 'items-86kZBSv4Zyis1RQm-Fc6UfFNOnW80XMzi'], state('Antitoxin: a pale green ward against poison.', [['Antitoxin ward', ['shield.01.loop.green', 'shield.01.loop.blue'], { scale: 0.9, opacity: 0.45, ...tint('#8dd998') }]]));
put('classes24-iKPJ2nBT687zLvTc-phbpdnDevotionAu', state('Devoted (Aura of Devotion): a soft golden blessing that wards off charms.', [['Devotion', ['bless.200px.loop.yellow'], { scale: 0.8, opacity: 0.5, below: true }]]));
put('monsterfeatures24-kJYNjmfI0RpvF7CQ-mmAversionToFire', state('Averse: the creature flinches from fire; a scorched penalty mark lingers.', [['Fire-shy', ['condition.curse.01.001.red'], { scale: 0.8, opacity: 0.7, ...tint('#ff9a50') }]]));
put(['spells-potjmpJPeUA1U4oe-95K2aUhAGV9qXjnf', 'spells24-7g3RcuidZG1x5Mvm-phbsplBane000000'], state('Bane: a dark curse mark that saps attacks and saves.', [['Bane', ['condition.curse.01.001.purple', 'condition.curse.01.001.red'], { scale: 0.8, opacity: 0.75, ...tint('#8a5ab8') }]]));
put('classes24-WIHaOwkGqnX71mK1-phbbrdBardicInsp', state('Inspired: a musical note hovers over the creature holding Bardic Inspiration.', [['Inspiration die', ['markers.music_note.blue'], { scale: 0.45, offsetY: -0.5, offsetUnits: 'token', ...tint('#f0c060') }]]));
put(['spells-uM6rgctYpcbCVSkn-JPwIEfgUPVebr5AH', 'spells24-Vq0t8ts0lfPoGx6U-phbsplBarkskin00'], state('Barkskin: bark-like wood plates around the creature.', [['Bark', ['aura_themed.01.orbit.loop.wood.01.green'], { scale: 0.9, opacity: 0.7 }]]));
put(['spells-rTmKyD87PuzUBGpJ-ZU9d6woBdUP8pIPt', 'spells24-5fziLN2CaamManlf-phbsplBeaconofHo'], state('Hopeful (Beacon of Hope): a gentle light of hope shines over the creature.', [['Hope', ['markers.light.loop.yellow', 'markers.light.loop.blue'], { ...tint('#ffe08a'), scale: 0.45, opacity: 0.85, offsetY: -0.5, offsetUnits: 'token' }]]));
put(['equipment24-HNruvcSEl25DRvjj-dmgBeltOfDwarven', 'items-uuh2qSmWVNoHcqTc-j2ZGEwx8MhHZXds4'], state('Belt of Dwarvenkind: a steady golden boon of dwarven toughness.', [['Dwarven toughness', ['condition.boon.01.001.yellow', 'condition.boon.01.001.green'], { scale: 0.8, opacity: 0.7, ...tint('#d9b45a') }]]));
put(['items-iGbcuTRYb2okyQeS-NRj0lC3SM03s1YB3', 'equipment24-dVP7XiBERjMWs7xK-dmgcloBeltofGian'], state('Cloud Giant Strength: a low swirl of cloud around the wearer\'s feet.', [['Cloud swirl', ['ambient_fog.001.loop.small.white'], { scale: 0.8, opacity: 0.45, below: true }]]));
put(['items-uTXTubfcSCEANSBh-ORKf6RRcalrdD6Qp', 'equipment24-dVP7XiBERjMWs7xK-dmgfroBeltofGian'], state('Frost Giant Strength: rime motes circle the wearer.', [['Rime', ['aura_themed.01.orbit.loop.cold.01.blue'], { scale: 0.9, opacity: 0.6 }]]));
put(['equipment24-dLiEcoOg6cQcgIP8-dmghilBeltofGian', 'equipment24-dVP7XiBERjMWs7xK-dmgstoBeltofGian', 'items-wz6bugCbOYcTBUMg-ER75WHewYN04Zp11', 'items-lGoO7zq8A2ZphIVf-fCUZ7h8YYrs16UhX'], state('Giant Strength (hill/stone): the ground cracks faintly under the wearer\'s weight.', [['Ground strains', ['ground_cracks.01.orange'], { scale: 0.75, opacity: 0.5, below: true, ...tint('#b09a7a') }]]));
put('monsterfeatures24-8SBNBxgUqwEyYJcK-mmBerserk0000000', state('Berserk: a ring of red fury smoulders around the raging creature.', [['Fury', ['markers.smoke.ring.loop.dark_red', 'markers.smoke.ring.loop.bluepurple'], { scale: 0.7, opacity: 0.7, ...tint('#c0392b') }]]));

export default out;
