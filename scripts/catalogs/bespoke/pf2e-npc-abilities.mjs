// Bespoke compositions for PF2e NPC abilities (catalogs/pf2e/npc-abilities.mjs): the monster
// abilities hundreds of creatures share (Grab, Constrict, Swallow Whole, Breath Weapon…).
// Keys: 'pf2e:npc-<id>', and 'pf2e:npc-breath:<element>-<shape>' for breath weapons.
// Clips and pacing follow the D&D monster features in dnd5e-features-a.mjs.
import { cast, travel, projectile, impact, area, aura, sprite, motion, tint, design } from './helpers.mjs';
import { damageLook } from '../../engines/playback/damage-moments.mjs';

const out = {};
const put = (ids, d) => { for (const id of [].concat(ids)) out[`pf2e:npc-${id}`] = d; };
const ab = (sound, extra = {}) => ({ sound, soundNamespace: 'ability', ...extra });
const dust = (o = {}) => aura('Dust kicks up', ['smoke.puff.side.grey'], { scale: 0.7, duration: 900, opacity: 0.75, faceTarget: true, mirrorX: true, ...tint('#bba98d'), ...o });
const rushTo = (o = {}) => motion('rush', 'source', { stageId: 'run', duration: 1500, intensity: 0.4, distance: 8, motionRange: 'target', motionHeading: 'toward', motionEndpoint: 'near', ...o });

// ---------------------------------------------------------------- grips
put('grab', design('Grab: the creature clamps onto the creature it just hit and holds on.', () => [
  motion('lunge', 'source', { stageId: 'reach', duration: 600, intensity: 0.7 }),
  impact('Seized', ['impact.009.orange'], { stageId: 'hit', after: 'reach', anchor: 'start', offset: 200, duration: 800, scale: 0.6 }),
  motion('press', 'targets', { after: 'hit', anchor: 'start', duration: 900, intensity: 0.5 }),
], ab('unarmed')));
put('constrict', design('Constrict: coils or limbs tighten around the held creature and crush it.', () => [
  motion('brace', 'source', { stageId: 'tighten', duration: 800, intensity: 0.6 }),
  aura('Coils tighten', ['aura_themed.01.inward.complete.metal.01.grey'], { stageId: 'coil', subject: 'targets', after: 'tighten', anchor: 'start', offset: 150, duration: 1400, scale: 0.7, opacity: 0.8, ...tint('#8a7a5c') }),
  impact('Crushing squeeze', ['impact.009.orange'], { after: 'coil', anchor: 'start', offset: 600, duration: 800, scale: 0.55 }),
  motion('shake', 'targets', { after: 'coil', anchor: 'start', offset: 300, duration: 1100, intensity: 0.5 }),
], ab('unarmed')));
put('swallow', design('Swallow Whole: the jaws close on the held prey and gulp it down.', () => [
  motion('lunge', 'source', { stageId: 'gulp', duration: 700, intensity: 0.9 }),
  impact('Jaws close', ['bite.400px.red', 'bite.200px.red'], { stageId: 'hit', after: 'gulp', anchor: 'start', offset: 200, duration: 1000 }),
  motion('sink', 'targets', { after: 'hit', anchor: 'start', offset: 250, duration: 1200, intensity: 0.7 }),
], ab('naturalPierce')));
put('engulf', design('Engulf: the creature slides over everything in its path and draws it into its body.', () => [
  rushTo({ duration: 1800, intensity: 0.3 }),
  impact('Engulfed', ['liquid.splash.bright_green', 'liquid.splash.blue'], { stageId: 'hit', after: 'run', anchor: 'arrival', duration: 1200, scale: 0.8, ...tint('#a3d65c') }),
  motion('sink', 'targets', { after: 'hit', anchor: 'start', duration: 1000, intensity: 0.4 }),
], { sound: 'acid' }));
put('drain', design('Blood Drain: fangs sink into the held creature and its blood is drawn out.', () => [
  motion('lunge', 'source', { stageId: 'bite', duration: 650, intensity: 0.7 }),
  impact('Fangs sink in', ['bite.200px.red', 'bite.400px.red'], { stageId: 'hit', after: 'bite', anchor: 'start', offset: 150, duration: 900, scale: 0.8 }),
  aura('Blood drips', ['markers.drop.red.01', 'markers.drop.red'], { subject: 'targets', after: 'hit', anchor: 'start', offset: 250, duration: 1500, scale: 0.5 }),
  aura('Life drawn in', ['energy_strands.complete.dark_red.01'], { after: 'hit', anchor: 'start', offset: 400, duration: 1400, scale: 0.7, opacity: 0.8 }),
  motion('pulse', 'source', { after: 'hit', anchor: 'start', offset: 500, duration: 900, intensity: 0.4 }),
], ab('naturalPierce')));

// ---------------------------------------------------------------- shoves and blows
put('knockdown', design('Knockdown: a heavy follow-through knocks the struck creature off its feet.', () => [
  motion('lunge', 'source', { stageId: 'shove', duration: 600, intensity: 0.8 }),
  impact('Heavy shove', ['impact.009.orange'], { stageId: 'hit', after: 'shove', anchor: 'start', offset: 200, duration: 900, scale: 0.8 }),
  aura('Dust on the ground', ['smoke.puff.ring.01.white'], { subject: 'targets', after: 'hit', anchor: 'start', duration: 900, scale: 0.6, opacity: 0.6, below: true, ...tint('#bba98d') }),
  motion('slam', 'targets', { after: 'hit', anchor: 'start', offset: 100, duration: 800, intensity: 0.6 }),
], ab('unarmed')));
put('push', design('Push: the blow drives the struck creature back.', () => [
  motion('lunge', 'source', { stageId: 'shove', duration: 600, intensity: 0.8 }),
  impact('Shove', ['impact.009.orange'], { stageId: 'hit', after: 'shove', anchor: 'start', offset: 200, duration: 800, scale: 0.7 }),
  motion('rush', 'targets', { after: 'hit', anchor: 'start', offset: 100, duration: 900, intensity: 0.5, distance: 1, motionRange: 'distance', motionHeading: 'away', motionEndpoint: 'near' }),
], ab('unarmed')));
put('rend', design('Rend: both claws tear into a creature struck twice.', () => [
  motion('lunge', 'source', { stageId: 'r1', duration: 450, intensity: 0.7 }),
  impact('First claw', ['claws.400px.red', 'claws.200px.red'], { stageId: 'h1', after: 'r1', anchor: 'start', offset: 150, duration: 800 }),
  motion('lunge', 'source', { stageId: 'r2', after: 'r1', anchor: 'end', duration: 450, intensity: 0.7 }),
  impact('Second claw tears', ['claws.400px.red', 'claws.200px.red'], { after: 'r2', anchor: 'start', offset: 150, duration: 800, mirrorX: true }),
  aura('Blood sprays', ['liquid.splash02.red', 'liquid.splash.red'], { subject: 'targets', after: 'r2', anchor: 'start', offset: 300, duration: 1000, scale: 0.6 }),
  motion('recoil', 'targets', { after: 'h1', anchor: 'start', duration: 1000, intensity: 0.6 }),
], ab('claw')));
put('sweep', design('A wide swing or lashing tail sweeps through every creature in reach.', () => [
  motion('spin', 'source', { stageId: 'swing', duration: 900, intensity: 0.4 }),
  aura('Sweeping arc', ['melee_generic.whirlwind.01.orange'], { stageId: 'arc', after: 'swing', anchor: 'start', offset: 100, duration: 1000, scale: 1.1, opacity: 0.85 }),
  impact('Struck in the arc', ['impact.009.orange'], { after: 'arc', anchor: 'start', offset: 350, duration: 800, scale: 0.6, optionalTargets: true }),
  motion('stagger', 'targets', { after: 'arc', anchor: 'start', offset: 400, duration: 700, intensity: 0.6, optionalTargets: true }),
], ab('club')));
put('trample', design('Trample: the creature thunders through the spaces of everything in its way.', () => [
  rushTo({ distance: 10 }), dust({ after: 'run', anchor: 'start' }),
  impact('Trampling', ['impact.009.orange'], { stageId: 'hit', after: 'run', anchor: 'arrival', duration: 900, scale: 0.8, optionalTargets: true }),
  aura('Ground cracks', ['ground_cracks.01.orange'], { subject: 'targets', after: 'hit', anchor: 'start', duration: 1400, scale: 0.6, below: true, opacity: 0.7, optionalTargets: true }),
  motion('stagger', 'targets', { after: 'hit', anchor: 'start', duration: 750, intensity: 0.6, optionalTargets: true }),
], ab('kick')));

// ---------------------------------------------------------------- charges and movement
put('charge', design('A charge: the creature closes in a straight rush and strikes as it arrives.', () => [
  rushTo(), dust({ after: 'run', anchor: 'start' }),
  impact('Impact on arrival', ['impact.009.orange'], { stageId: 'hit', after: 'run', anchor: 'arrival', duration: 1000, scale: 0.9, optionalTargets: true }),
  motion('stagger', 'targets', { after: 'hit', anchor: 'start', offset: 100, duration: 750, intensity: 0.7, optionalTargets: true }),
], ab('naturalPierce')));
put('pounce', design('Pounce: the creature leaps onto its prey, claws first.', () => [
  motion('leap', 'source', { stageId: 'run', duration: 1400, intensity: 0.4, distance: 6, motionRange: 'target', motionHeading: 'toward', motionEndpoint: 'near' }),
  dust({ after: 'run', anchor: 'start' }),
  impact('Claws on landing', ['claws.200px.red', 'claws.400px.red'], { stageId: 'hit', after: 'run', anchor: 'arrival', duration: 1000, scale: 0.9, optionalTargets: true }),
  motion('stagger', 'targets', { after: 'hit', anchor: 'start', offset: 100, duration: 750, intensity: 0.7, optionalTargets: true }),
], ab('claw')));
put('dash', design('A burst of speed: the creature darts off with speed lines and a puff of dust.', () => [
  motion('rush', 'source', { stageId: 'run', duration: 1400, intensity: 0.4, distance: 2, motionRange: 'distance', motionHeading: 'toward', motionEndpoint: 'near' }),
  aura('Speed lines', ['wind_lines.01.01.white'], { after: 'run', anchor: 'start', scale: 0.9, duration: 1000, opacity: 0.6, faceTarget: true }),
  dust({ after: 'run', anchor: 'start' }),
], { sound: null }));
put('dodge', design('A quick dodge or wing beat turns the blow aside.', () => [
  motion('dodge', 'source', { stageId: 'step', duration: 1000, intensity: 0.5, distance: 0.5, motionRange: 'distance', motionHeading: 'toward', motionEndpoint: 'near' }),
  sprite('Afterimage', { after: 'step', anchor: 'start', duration: 600, opacity: 0.35 }),
], { sound: null }));

// ---------------------------------------------------------------- rocks
put('throw-rock', design('Throw Rock: the creature winds back and hurls a boulder at its target.', () => [
  motion('throw', 'source', { stageId: 'wind', duration: 900, intensity: 0.8 }),
  projectile('Boulder in flight', ['boulder.toss.02.01.stone.brown'], { stageId: 'rock', after: 'wind', anchor: 'start', offset: 350, duration: 1300 }),
  impact('Boulder strikes', ['impact.009.orange'], { stageId: 'crash', after: 'rock', anchor: 'end', offset: -150, duration: 900, scale: 0.9 }),
  impact('Debris spray', ['falling_rocks.side.1x1.grey'], { after: 'rock', anchor: 'end', offset: -150, duration: 1200, scale: 0.8 }),
  motion('stagger', 'targets', { after: 'crash', anchor: 'start', offset: 100, duration: 700, intensity: 0.6 }),
], { sound: 'earth' }));
put('catch-rock', design('Catch Rock: the creature braces and snatches the hurled rock out of the air.', () => [
  motion('brace', 'source', { stageId: 'catch', duration: 800, intensity: 0.8 }),
  aura('Catch', ['impact.009.orange'], { after: 'catch', anchor: 'start', offset: 250, duration: 800, scale: 0.6 }),
  aura('Grit falls away', ['smoke.puff.ring.01.white'], { after: 'catch', anchor: 'start', offset: 300, duration: 900, scale: 0.6, opacity: 0.6, ...tint('#bba98d') }),
], ab('physicalToss')));

// ---------------------------------------------------------------- fury, fear and the mind
put('fury', design('Ferocity or rage: a red fury rises off the creature as it fights on.', () => [
  motion('shake', 'source', { stageId: 'roar', duration: 900, intensity: 0.5 }),
  aura('Red fury', ['energy_strands.complete.dark_red.01', 'cast_generic.dark.01.red'], { after: 'roar', anchor: 'start', duration: 1800, scale: 0.9, opacity: 0.85 }),
], { sound: 'battleCry' }));
put('frenzy', design('A frenzy of attacks: the creature gathers itself to strike again and again.', () => [
  motion('brace', 'source', { stageId: 'gather', duration: 700, intensity: 0.5 }),
  aura('Frenzied speed', ['wind_lines.01.02.white'], { after: 'gather', anchor: 'start', duration: 1000, scale: 0.9, opacity: 0.6 }),
  aura('Battle fury', ['energy_strands.complete.dark_red.01'], { after: 'gather', anchor: 'start', offset: 200, duration: 1200, scale: 0.8, opacity: 0.6 }),
], { sound: null }));
put('fear', design('A terrifying moan, croak or screech rolls out and its listeners cower.', () => [
  motion('brace', 'source', { stageId: 'cry', duration: 700, intensity: 0.5 }),
  aura('Dread rolls out', ['soundwave.02.purple', 'soundwave.01.purple'], { stageId: 'wave', after: 'cry', anchor: 'start', offset: 150, duration: 1600, scale: 1.6, opacity: 0.85 }),
  aura('Fear grips', ['markers.fear.dark_purple', 'icon.fear.dark_purple'], { subject: 'targets', after: 'wave', anchor: 'start', offset: 400, duration: 1400, scale: 0.6, optionalTargets: true }),
  motion('cower', 'targets', { after: 'wave', anchor: 'start', offset: 450, duration: 900, intensity: 0.5, optionalTargets: true }),
], { sound: 'fear' }));
put('gaze', design('A focused gaze: the creature\'s eyes fix on one creature and its power takes hold.', () => [
  cast('Eyes flare', ['eyes.01.dark_yellow.single', 'eyes.01.dark_green.single'], { stageId: 'eyes', duration: 1200, scale: 0.6 }),
  impact('Caught by the gaze', ['shimmer.01.purple', 'shimmer.01.blue'], { after: 'eyes', anchor: 'start', offset: 500, duration: 1300, scale: 0.7 }),
  motion('stagger', 'targets', { after: 'eyes', anchor: 'start', offset: 700, duration: 700, intensity: 0.4 }),
], { sound: 'psychic' }));
put('dominate', design('Dominate: a will presses into the target\'s mind and bends it.', () => [
  cast('A will reaches out', ['eyes.01.dark_green.many', 'eyes.01.dark_green.single'], { stageId: 'will', duration: 1200, scale: 0.6 }),
  impact('Mind bent', ['shimmer.01.purple'], { after: 'will', anchor: 'start', offset: 500, duration: 1400, scale: 0.8, ...tint('#b07cff') }),
  motion('stagger', 'targets', { after: 'will', anchor: 'start', offset: 700, duration: 900, intensity: 0.35 }),
], { sound: 'psychic' }));

// ---------------------------------------------------------------- self
put('change-shape', design('Change Shape: the creature\'s form shimmers and shifts into another.', () => [
  aura('Form shimmers', ['shimmer.01.purple', 'shimmer.01.blue'], { stageId: 'shift', duration: 1400, scale: 0.9 }),
  aura('Puff of change', ['smoke.puff.centered.grey'], { after: 'shift', anchor: 'start', offset: 600, duration: 1000, scale: 0.8, opacity: 0.7 }),
  motion('pulse', 'source', { after: 'shift', anchor: 'start', offset: 300, duration: 900, intensity: 0.4 }),
], { sound: 'transform' }));
put('mist', design('The creature dissolves into a drifting mist.', () => [
  cast('Body thins', ['misty_step.01.grey', 'misty_step.01.blue'], { stageId: 'thin', duration: 1200, scale: 0.8 }),
  aura('Mist', ['fog_cloud.01.white'], { after: 'thin', anchor: 'start', offset: 300, duration: 1800, scale: 0.9, opacity: 0.7 }),
  motion('sink', 'source', { after: 'thin', anchor: 'start', duration: 1100, intensity: 0.4 }),
], { sound: 'wind' }));
put('shield', design('Shield Block: the shield comes up to take the blow.', () => [
  motion('brace', 'source', { stageId: 'brace', duration: 700, intensity: 0.6 }),
  aura('Shield raised', ['shield.01.complete.01.white', 'shield.01.complete.01.blue'], { after: 'brace', anchor: 'start', offset: 100, duration: 1200, scale: 0.7, opacity: 0.85 }),
], ab('shieldRaise')));
put('spores', design('A cloud of spores bursts from the creature and fills the air around it.', () => [
  motion('pulse', 'source', { stageId: 'burst', duration: 800, intensity: 0.5 }),
  aura('Spore cloud', ['fog_cloud.02.green02', 'fog_cloud.01.white'], { after: 'burst', anchor: 'start', offset: 150, duration: 2400, scale: 2, opacity: 0.75, ...tint('#b8c46a') }),
  motion('cower', 'targets', { after: 'burst', anchor: 'start', offset: 700, duration: 800, intensity: 0.35, optionalTargets: true }),
], { sound: 'poison' }));

// ---------------------------------------------------------------- breath weapons
// Rear back, a wisp of the element at the maw, then the exhalation fills the placed cone or line.
const BREATH = {
  fire: { puff: ['cast_generic.fire.01.orange'], cone: ['breath_weapons.fire.cone.orange'], line: ['breath_weapons.fire.line.orange'], sound: 'fireCone' },
  cold: { puff: ['cast_generic.ice.01.blue', 'smoke.puff.side.grey'], puffTint: '#bfe8ff', cone: ['breath_weapons.cold.cone.blue'], line: ['breath_weapons02.burst.line.ice', 'breath_weapons.lightning.line.blue'], tint: '#cfeeff', sound: 'coldCone' },
  electricity: { puff: ['static_electricity.01.blue'], cone: ['breath_weapons.cold.cone.blue'], line: ['breath_weapons.lightning.line.blue'], tint: '#9fd8ff', sound: 'electric' },
  acid: { puff: ['smoke.puff.side.green', 'smoke.puff.side.grey'], puffTint: '#9be060', cone: ['breath_weapons.poison.cone.green'], line: ['breath_weapons.acid.line.green'], tint: '#9be060', sound: 'acid' },
  poison: { puff: ['smoke.puff.side.dark_green', 'smoke.puff.side.grey'], puffTint: '#7fbf5a', cone: ['breath_weapons.poison.cone.green'], line: ['breath_weapons.acid.line.green'], tint: '#7fbf5a', sound: 'poison' },
  void: { puff: ['smoke.puff.side.dark_purple', 'smoke.puff.side.grey'], puffTint: '#6b4a8f', cone: ['breath_weapons.poison.cone.purple', 'breath_weapons.poison.cone.green'], line: ['breath_weapons.acid.line.green'], tint: '#6b4a8f', sound: 'void' },
  sonic: { puff: ['smoke.puff.side.grey'], cone: ['breath_weapons.cold.cone.blue'], line: ['breath_weapons.lightning.line.blue'], tint: '#d8dde8', sound: 'sonic' },
  // Anything else (force, mental, spirit, untyped): a grey gust in the area's shape.
  other: { puff: ['smoke.puff.side.grey'], cone: ['breath_weapons.poison.cone.green'], line: ['breath_weapons.acid.line.green'], tint: '#c8c8d0', sound: 'wind' },
};
export const BREATH_ELEMENTS = Object.keys(BREATH);
for (const [element, b] of Object.entries(BREATH)) for (const shape of ['cone', 'line']) {
  out[`pf2e:npc-breath:${element}-${shape}`] = design(`Breath Weapon: the creature rears back and exhales ${element === 'other' ? 'its breath' : element} in a ${shape}.`, () => [
    motion('brace', 'source', { stageId: 'inhale', duration: 700, intensity: 0.6 }),
    cast('Breath gathers at the maw', b.puff, { stageId: 'maw', scale: 0.55, duration: 900, faceTarget: true, ...(b.puffTint ? tint(b.puffTint) : {}) }),
    area('Exhalation', b[shape], { stageId: 'exhale', after: 'inhale', anchor: 'end', offset: -100, duration: 2200, oneShot: true, ...(b.tint ? tint(b.tint) : {}) }),
    motion('pulse', 'source', { after: 'inhale', anchor: 'end', duration: 900, intensity: 0.45 }),
    motion('recoil', 'targets', { after: 'exhale', anchor: 'start', offset: 600, duration: 800, intensity: 0.6, optionalTargets: true }),
  ], { sound: b.sound });
}

// ---------------------------------------------------------------- one-of-a-kind abilities
// Built from the ability's own data (npc-abilities.mjs, abilityForm): the shape of the area it places
// (cone, line, burst, emanation) or, with none, the damage it deals to its target, in that damage's look.
// Keys: 'pf2e:npc-generic:<form>-<element>'.
const PHYSICAL = { color: '#d9cbb0', hit: ['impact.009.orange'], death: ['ground_cracks.02.orange', 'impact.009.orange'] };
export const ABILITY_ELEMENTS = ['physical', 'fire', 'cold', 'electricity', 'acid', 'poison', 'void', 'vitality', 'force', 'mental', 'sonic', 'spirit'];
const SOUND = { physical: 'bludgeon', fire: 'fire', cold: 'cold', electricity: 'electric', acid: 'acid', poison: 'poison', void: 'void', vitality: 'holy', force: 'force', mental: 'psychic', sonic: 'sonic', spirit: 'spirit' };
const lookOf = element => (element === 'physical' ? PHYSICAL : damageLook(element) ?? PHYSICAL);
// A cone or line uses the breath art of its energy, else the grey gust tinted to the damage's colour.
const blastOf = (element, shape) => {
  const b = BREATH[element] ?? BREATH.other;
  return { assets: b[shape], tint: BREATH[element] ? b.tint : lookOf(element).color };
};
for (const element of ABILITY_ELEMENTS) {
  const look = lookOf(element), sound = SOUND[element], color = look.color;
  const puff = (o = {}) => cast('Power gathers', look.hit, { stageId: 'gather', duration: 800, scale: 0.45, opacity: 0.85, ...o });
  for (const shape of ['cone', 'line']) {
    const blast = blastOf(element, shape);
    out[`pf2e:npc-generic:${shape}-${element}`] = design(`The creature unleashes ${element === 'physical' ? 'a blast' : `${element}`} across the ${shape} it aims.`, () => [
      motion('brace', 'source', { stageId: 'brace', duration: 600, intensity: 0.5 }),
      puff({ faceTarget: true }),
      area('Blast', blast.assets, { stageId: 'blast', after: 'brace', anchor: 'end', offset: -100, duration: 2000, oneShot: true, ...(blast.tint ? tint(blast.tint) : {}) }),
      motion('recoil', 'targets', { after: 'blast', anchor: 'start', offset: 500, duration: 800, intensity: 0.6, optionalTargets: true }),
    ], { sound });
  }
  out[`pf2e:npc-generic:burst-${element}`] = design(`A burst of ${element === 'physical' ? 'force' : element} erupts where the creature aims it.`, () => [
    puff(),
    area('Burst', look.death ?? look.hit, { stageId: 'burst', after: 'gather', anchor: 'start', offset: 400, duration: 1800 }),
    motion('recoil', 'targets', { after: 'burst', anchor: 'start', offset: 300, duration: 800, intensity: 0.6, optionalTargets: true }),
  ], { sound });
  out[`pf2e:npc-generic:emanation-${element}`] = design(`A wave of ${element === 'physical' ? 'force' : element} rolls out from the creature.`, () => [
    motion('pulse', 'source', { stageId: 'pulse', duration: 800, intensity: 0.5 }),
    area('Wave', look.death ?? look.hit, { stageId: 'wave', after: 'pulse', anchor: 'start', offset: 200, duration: 1800, opacity: 0.9 }),
    motion('recoil', 'targets', { after: 'wave', anchor: 'start', offset: 300, duration: 800, intensity: 0.6, optionalTargets: true }),
  ], { sound });
  out[`pf2e:npc-generic:hit-${element}`] = design(`The creature turns its power on its target: ${element === 'physical' ? 'a crushing blow' : `${element} strikes it`}.`, () => [
    puff(),
    impact('Strikes the target', look.hit, { stageId: 'hit', after: 'gather', anchor: 'start', offset: 450, duration: 1100, scale: 0.8, ...(element === 'physical' ? {} : tint(color)) }),
    motion('recoil', 'targets', { after: 'hit', anchor: 'start', offset: 150, duration: 750, intensity: 0.6 }),
  ], { sound });
}
put('blink', design('The creature vanishes in a blink and reappears.', () => [
  cast('Blink out', ['misty_step.01.blue', 'misty_step.01.purple'], { stageId: 'out', duration: 1200, scale: 0.8 }),
  motion('flicker', 'source', { after: 'out', anchor: 'start', duration: 900, intensity: 0.5 }),
], { sound: 'teleport' }));
put('heal', design('Healing light washes over the creature.', () => [
  aura('Healing glow', ['sacred_flame.target.yellow', 'impact.003.yellow'], { stageId: 'glow', duration: 1500, scale: 0.8, opacity: 0.85, ...tint('#bff0a0') }),
  motion('pulse', 'source', { after: 'glow', anchor: 'start', duration: 900, intensity: 0.3 }),
], { sound: 'healing' }));
put('magic', design('Magic gathers around the creature as it calls on its power.', () => [
  aura('Power stirs', ['shimmer.01.blue', 'shimmer.01.purple'], { stageId: 'stir', duration: 1300, scale: 0.8, opacity: 0.8 }),
  motion('pulse', 'source', { after: 'stir', anchor: 'start', duration: 800, intensity: 0.3 }),
], { sound: null }));
put('magnetism', design('A magnetic field tugs at metal on the target, unsettling its balance without moving its token or applying a condition.', () => [
  aura('Magnetic field gathers', ['static_electricity.01.blue'], {stageId:'field',duration:1200,scale:0.65,opacity:0.6,...tint('#a9c5df')}),
  aura('Metal pulled inward', ['aura_themed.01.inward.complete.metal.01.grey'], {subject:'targets',stageId:'pull',after:'field',anchor:'start',offset:250,duration:1600,scale:0.7,opacity:0.8}),
  motion('shake','targets',{after:'pull',anchor:'start',offset:150,duration:900,intensity:0.22}),
], {sound:null}));
put('disarm', design('The creature wrenches at a held weapon; the animation does not remove equipment or decide the check.', () => [
  motion('brace','source',{stageId:'wrench',duration:650,intensity:0.4}),
  aura('Equipment wrenched', ['aura_themed.01.inward.complete.metal.01.grey'], {subject:'targets',after:'wrench',anchor:'start',offset:200,duration:1100,scale:0.45,opacity:0.7}),
  motion('shake','targets',{after:'wrench',anchor:'start',offset:250,duration:650,intensity:0.18}),
], ab('unarmed')));
put('bind', design('Binding strands gather around the target; the native rules determine restraint and escape.', () => [
  aura('Binding strands', ['energy_strands.complete.dark_red.01'], {subject:'targets',stageId:'bind',duration:1700,scale:0.75,opacity:0.7,...tint('#c6c9bb')}),
  motion('press','targets',{after:'bind',anchor:'start',offset:250,duration:1000,intensity:0.25}),
], {sound:null}));
put('confuse', design('A disorienting influence shimmers around the target without inventing damage or a forced move.', () => [
  aura('Disorienting shimmer',['shimmer.01.purple'],{subject:'targets',stageId:'daze',duration:1500,scale:0.65,opacity:0.6}),
  motion('stagger','targets',{after:'daze',anchor:'start',offset:300,duration:900,intensity:0.2}),
], {sound:'psychic'}));
put('blind', design('The target is briefly obscured by the blinding action; its real condition controls lasting effects.', () => [
  aura('Vision obscured',['smoke.puff.centered.grey'],{subject:'targets',stageId:'obscure',duration:1200,scale:0.6,opacity:0.6}),
  motion('recoil','targets',{after:'obscure',anchor:'start',offset:200,duration:600,intensity:0.2}),
], {sound:null}));
put('veil', design('The creature blends into concealment; native visibility remains authoritative.', () => [
  aura('Camouflage shimmers',['shimmer.01.blue'],{stageId:'veil',duration:1500,scale:0.7,opacity:0.45,...tint('#a1b7a0')}),
  motion('brace','source',{after:'veil',anchor:'start',duration:800,intensity:0.2}),
], {sound:null}));
put('rally', design('The creature rallies nearby allies, signaled by an encouraging pulse around the speaker.', () => [
  aura('Rallying pulse',['soundwave.02.blue','soundwave.01.blue'],{stageId:'rally',duration:1500,scale:1.2,opacity:0.6,...tint('#edcf84')}),
  motion('pulse','source',{after:'rally',anchor:'start',duration:900,intensity:0.25}),
], {sound:null}));
put('sound', design('A piercing cry rolls out from the creature.', () => [
  motion('brace', 'source', { stageId: 'cry', duration: 600, intensity: 0.4 }),
  aura('Sound rolls out', ['soundwave.02.blue', 'soundwave.01.blue'], { after: 'cry', anchor: 'start', offset: 100, duration: 1500, scale: 1.4, opacity: 0.85 }),
], { sound: 'scream' }));

export default out;
