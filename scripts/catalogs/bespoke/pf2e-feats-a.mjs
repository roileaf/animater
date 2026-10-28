// Bespoke compositions (pf2e-feats-a). Keys: '<system>:<entryId>' or '<system>:<entryId>:<variant|mode>'.
// See scripts/catalogs/bespoke/helpers.mjs and scripts/bespoke.mjs.
import { cast, travel, projectile, impact, area, aura, sprite, motion, tint, spin, breathe, design } from './helpers.mjs';

// Shared builders (Patreon key first, Free fallback second).
const HIT = ['impact.002.orange', 'impact.005.orange'];
const PIERCE = ['melee_generic.piercing.one_handed', 'melee_generic.slash.02.001.blue'];
const SLASH = ['melee_generic.slashing.one_handed', 'melee_generic.slash.02.001.blue'];
const FIST = ['melee_generic.creature_attack.fist.002.blue'];
const OPT = { optionalTargets: true };

// Black-powder Strike: muzzle flash at the shooter, a round in flight, a hit.
const gunShot = (p, o = {}) => [
  cast('Muzzle flash', ['muzzle_flash.single.01.yellow'], { stageId: `${p}-flash`, faceTarget: true, scale: 0.7, duration: 700, delay: o.delay ?? 0 }),
  travel('Round flies', [`bullet.01.${o.color ?? 'orange'}`, 'bullet.01.orange'], { stageId: `${p}-shot`, after: `${p}-flash`, anchor: 'start', offset: 80, duration: 900, ...(o.travel ?? {}) }),
  impact(o.hitLabel ?? 'Round strikes', o.hit ?? HIT, { stageId: `${p}-hit`, after: `${p}-shot`, anchor: 'end', scale: 0.8, duration: 1100, ...(o.impact ?? {}) }),
  motion('recoil', 'source', { after: `${p}-flash`, anchor: 'start', duration: 500, intensity: 0.5 }),
];
const FIREARM = { sound: 'firearm', soundNamespace: 'ability' };

// Bow Strike: draw, white arrow flight, small contact.
const bowShot = (p, o = {}) => [
  motion('brace', 'source', { stageId: `${p}-draw`, duration: 700, intensity: 0.35 }),
  travel('Arrow flies', ['arrow.physical.white.01', 'arrow.physical.white'], { stageId: `${p}-shot`, after: `${p}-draw`, anchor: 'start', offset: o.aimMs ?? 450, duration: 1000 }),
  impact('Arrow strikes', HIT, { stageId: `${p}-hit`, after: `${p}-shot`, anchor: 'end', scale: 0.7, duration: 1000 }),
];
const BOW = { sound: 'bow', soundNamespace: 'ability' };

export default {
  // A Hush Falls Over the World: sound is absorbed in a shroud of quiet.
  'pf2e:pFjxlEhcWyc8jHl1': design('A muting sign appears and a pale, soundless haze settles over the waking world, absorbing all noise.', () => [
    cast('Sound is muted', ['icon.mute.blue', 'icon.mute'], { stageId: 'hush-mute', scale: 0.6, offsetY: -0.6, offsetUnits: 'token', duration: 1400, fadeIn: 200, fadeOut: 400, ...tint('#b7c6d6') }),
    aura('Shroud of quiet', ['ambient_fog.001.loop.large.white'], { stageId: 'hush-fog', after: 'hush-mute', anchor: 'start', offset: 400, scale: 3, opacity: 0.45, below: true, duration: 3200, fadeIn: 700, fadeOut: 900, ...tint('#9aa6b4') }),
    motion('pulse', 'source', { after: 'hush-mute', anchor: 'start', duration: 900, intensity: 0.3 }),
  ], { sound: null }),

  // Absolve Sins: 30-foot emanation of mental damage forcing enemies to reflect on their sins.
  'pf2e:sUMrRRFsHiJf4VXP': design('A wave of judgment pulses out across the 30-foot emanation and each enemy cowers as it is forced to face its sins.', () => [
    cast('Judgment gathers', ['divine_smite.caster.reversed.dark_purple', 'divine_smite.caster.reversed.blueyellow'], { stageId: 'abs-cast', scale: 0.9, duration: 1100 }),
    aura('Absolution wave', ['template_circle.out_pulse.01.burst.purplepink', 'template_circle.out_pulse.01.burst.bluewhite'], { stageId: 'abs-wave', after: 'abs-cast', anchor: 'start', offset: 600, scale: 4, opacity: 0.8, below: true, duration: 2000, fadeOut: 500 }),
    impact('Sins weigh on the mind', ['energy_strands.complete.dark_purple.01', 'energy_strands.complete.blue.01'], { stageId: 'abs-hit', after: 'abs-wave', anchor: 'start', offset: 500, scale: 0.9, duration: 1500, ...OPT }),
    motion('cower', 'targets', { after: 'abs-hit', anchor: 'start', offset: 150, duration: 1000, intensity: 0.4, ...OPT }),
  ], { sound: 'psychic' }),

  // Aerial Flash: teleport to the flying foe, Strike, teleport back.
  'pf2e:ifSICnbInp90gcf3': design('You blink out, Strike the airborne foe from a teleported position, then blink back to where you stood.', () => [
    cast('Teleport out', ['misty_step.01.purple', 'misty_step.01.blue'], { stageId: 'af-out', scale: 0.9, duration: 1000 }),
    motion('flicker', 'source', { after: 'af-out', anchor: 'start', duration: 700, intensity: 0.6 }),
    impact('Strike from the air', PIERCE, { stageId: 'af-hit', after: 'af-out', anchor: 'start', offset: 550, duration: 1200 }),
    motion('lunge', 'source', { after: 'af-hit', anchor: 'start', duration: 700, intensity: 0.6 }),
    cast('Teleport back', ['misty_step.02.purple', 'misty_step.02.blue', 'misty_step.01.blue'], { after: 'af-hit', anchor: 'end', offset: -300, scale: 0.9, duration: 1000 }),
  ]),

  // Aerial Piledriver: heave the grabbed foe into the air and crash it down.
  'pf2e:UEqntGzFrFA7ncUO': design('You heave yourself and the grabbed foe upward, then drive it into the ground with a crushing unarmed blow.', () => [
    motion('levitate', 'source', { stageId: 'ap-lift', duration: 800, intensity: 0.5 }),
    motion('levitate', 'targets', { after: 'ap-lift', anchor: 'start', duration: 800, intensity: 0.5 }),
    impact('Piledriver blow', FIST, { stageId: 'ap-hit', after: 'ap-lift', anchor: 'end', duration: 1100 }),
    motion('slam', 'source', { after: 'ap-lift', anchor: 'end', offset: -150, duration: 800, intensity: 0.6 }),
    aura('Ground cracks', ['impact.ground_crack.01.white', 'impact.ground_crack.01.orange'], { subject: 'targets', after: 'ap-hit', anchor: 'start', offset: 150, scale: 1.3, below: true, duration: 1600, fadeOut: 500 }),
    motion('stagger', 'targets', { after: 'ap-hit', anchor: 'start', offset: 150, duration: 800, intensity: 0.6 }),
  ]),

  // Aether Beam: a force beam along a 60-foot line that pushes creatures back.
  'pf2e:NfWNaSD2rwlQcf06': design('Raw nexus energy streams out as a force beam and the creatures it washes over are shoved backward.', () => [
    cast('Nexus opens', ['cast_generic.01.dark_purple', 'cast_generic.02.blue'], { stageId: 'ab-cast', scale: 0.8, duration: 900 }),
    travel('Force beam', ['energy_beam.normal.purple.01', 'energy_beam.normal.bluepink.02'], { stageId: 'ab-beam', after: 'ab-cast', anchor: 'start', offset: 450, duration: 2200, fadeOut: 300 }),
    impact('Beam contact', ['impact.001.dark_purple', 'impact.002.blue'], { stageId: 'ab-hit', after: 'ab-beam', anchor: 'start', offset: 400, duration: 1300 }),
    motion('recoil', 'targets', { after: 'ab-hit', anchor: 'start', duration: 800, intensity: 0.8 }),
  ]),

  // Air Cushion: upward air currents slow a falling creature.
  'pf2e:pIHXinKNQ13ugBGm': design('An updraft swirls beneath the falling creature and lets it drift gently to the ground.', () => [
    cast('Air gathers', ['wind_lines.01.01.white'], { stageId: 'ac-cast', scale: 0.7, duration: 900 }),
    aura('Updraft cushion', ['whirlwind.bluegrey'], { stageId: 'ac-air', subject: 'targets', after: 'ac-cast', anchor: 'start', offset: 400, scale: 1.2, opacity: 0.7, below: true, duration: 2600, fadeIn: 300, fadeOut: 600 }),
    motion('drift', 'targets', { after: 'ac-air', anchor: 'start', duration: 1800, intensity: 0.6 }),
  ], { sound: 'wind' }),

  // Alchemical Shot: bomb contents poured on the round, then a firearm Strike.
  'pf2e:Q1O4P1YIkCfeedHH': design('Alchemical contents are poured over the round, then the shot bursts on the target with the bomb\'s volatile reagents.', () => [
    cast('Pour the bomb', ['liquid.blob.green', 'liquid.blob.blue'], { stageId: 'as-pour', scale: 0.5, duration: 900 }),
    ...gunShot('as', { delay: 700, hitLabel: 'Alchemical burst', hit: ['explosion.01.orange'], impact: { scale: 0.6 } }),
  ], FIREARM),

  // All Shall End in Flames: white-hot cataclysmic 30-foot fire.
  'pf2e:tinTdUGzxWStlf44': design('White-hot fire gathers and erupts in a cataclysmic sphere that engulfs each creature in flame.', () => [
    cast('White-hot fire gathers', ['cast_generic.fire.01.orange'], { stageId: 'ae-cast', duration: 1100 }),
    impact('Cataclysmic sphere', ['fireball.explosion.yellow', 'fireball.explosion.orange'], { stageId: 'ae-boom', after: 'ae-cast', anchor: 'start', offset: 700, scale: 2.2, duration: 2000 }),
    aura('Consuming flames', ['flames.04.loop.orange'], { subject: 'targets', after: 'ae-boom', anchor: 'start', offset: 600, scale: 1.1, duration: 2000, fadeOut: 600 }),
    motion('stagger', 'targets', { after: 'ae-boom', anchor: 'start', offset: 200, duration: 900, intensity: 0.7 }),
  ]),

  // Animal Rage: the barbarian transforms into their instinct animal.
  'pf2e:1VLOhyq0IFMY2rqh': design('A red surge of primal rage swells around you and bestial claws rake the air as your body becomes your animal.', () => [
    cast('Primal rage surges', ['divine_smite.caster.reversed.dark_red', 'divine_smite.caster.reversed.blueyellow'], { stageId: 'ar-rage', scale: 0.9, duration: 1200, ...tint('#c0302a') }),
    sprite('Form swells', { after: 'ar-rage', anchor: 'start', offset: 400, duration: 1200 }),
    aura('Bestial claws', ['claws.400px.dark_red', 'claws.400px.red'], { after: 'ar-rage', anchor: 'start', offset: 700, scale: 0.8, duration: 1000 }),
    motion('pulse', 'source', { after: 'ar-rage', anchor: 'start', offset: 500, duration: 1000, intensity: 0.8 }),
  ], { sound: 'growl', soundNamespace: 'ability' }),

  // Ankle Bite: goblin jaws Strike on the grabber.
  'pf2e:PncXj46fgSwTWRl6': design('You bite down hard on the foe that grabbed you.', () => [
    impact('Jaws bite', ['bite.200px.red'], { stageId: 'ab-bite', delay: 300, scale: 0.8, duration: 1100 }),
    motion('lunge', 'source', { duration: 700, intensity: 0.5 }),
    motion('recoil', 'targets', { after: 'ab-bite', anchor: 'start', offset: 250, duration: 600, intensity: 0.4 }),
  ], { sound: 'naturalPierce', soundNamespace: 'ability' }),

  // Arcane Slam: magic-charged arm slams the grabbed foe into the ground.
  'pf2e:xfbPSP9tl1N95xDF': design('Core magic floods your arm and you slam the grabbed foe into the ground with an arcane crack.', () => [
    cast('Core power flows', ['energy_strands.complete.blue.01'], { stageId: 'as-cast', scale: 0.7, duration: 900 }),
    impact('Slam', FIST, { stageId: 'as-hit', after: 'as-cast', anchor: 'start', offset: 600, duration: 1100 }),
    motion('lunge', 'source', { after: 'as-cast', anchor: 'start', offset: 400, duration: 700, intensity: 0.6 }),
    motion('slam', 'targets', { after: 'as-hit', anchor: 'start', duration: 900, intensity: 0.6 }),
    aura('Arcane crack', ['impact.ground_crack.01.blue', 'impact.ground_crack.01.orange'], { subject: 'targets', after: 'as-hit', anchor: 'start', offset: 350, scale: 1.2, below: true, duration: 1500, fadeOut: 500 }),
  ]),

  // Archer's Aim: a slow, focused bow shot.
  'pf2e:egmb8p3ZIYtx5aQN': design('You steady and hold your draw, then loose a single careful arrow.', () => [
    ...bowShot('aa', { aimMs: 800 }),
  ], BOW),

  // Armor Break: armor bursts into jagged shards in a 10-foot emanation.
  'pf2e:SqITElkyOMAvYVhh': design('You flex and your damaged armor bursts outward in a ring of jagged metal shards that hit nearby enemies.', () => [
    motion('shake', 'source', { stageId: 'abk-flex', duration: 700, intensity: 0.6 }),
    aura('Armor shards burst', ['ice_spikes.radial.burst.grey', 'ice_spikes.radial.burst.white'], { stageId: 'abk-burst', after: 'abk-flex', anchor: 'start', offset: 450, scale: 2.2, duration: 1600, ...tint('#9aa0a6') }),
    impact('Shards hit', HIT, { stageId: 'abk-hit', after: 'abk-burst', anchor: 'start', offset: 250, scale: 0.7, duration: 1000, ...OPT }),
    motion('stagger', 'targets', { after: 'abk-hit', anchor: 'start', duration: 800, intensity: 0.5, ...OPT }),
  ]),

  // Armor in Earth: stone encases you like armor.
  'pf2e:plEZoAyPwjAOdY4e': design('Earth heaves at your feet and stone plates crust over your body as heavy armor.', () => [
    cast('Earth rises', ['cast_generic.earth.01.browngreen'], { stageId: 'ae-earth', duration: 1100 }),
    aura('Ground heaves', ['impact.ground_crack.01.orange'], { after: 'ae-earth', anchor: 'start', offset: 300, scale: 1.2, below: true, duration: 1600, fadeOut: 500 }),
    aura('Stone plating', ['shield_themed.above.molten_earth.01.dark_orange', 'shield_themed.above.molten_earth.01.orange'], { after: 'ae-earth', anchor: 'start', offset: 700, scale: 0.9, duration: 1800, fadeOut: 500, ...tint('#8a6f52') }),
    motion('brace', 'source', { after: 'ae-earth', anchor: 'start', offset: 700, duration: 800, intensity: 0.5 }),
  ]),

  // Army of One: the celestial armament flies out to Strike every enemy in the nimbus.
  'pf2e:0UhZ3UtSXx9qyoiZ': design('You launch your celestial armament into the air; it flies to each enemy in your nimbus and Strikes it before returning.', () => [
    cast('Nimbus flares', ['sacred_flame.source.yellow'], { stageId: 'ao-cast', scale: 0.8, duration: 900 }),
    motion('throw', 'source', { after: 'ao-cast', anchor: 'start', offset: 300, duration: 700, intensity: 0.6 }),
    projectile('Celestial armament flies', ['spiritual_weapon.longsword.01.spectral.01.blue', 'spiritual_weapon.longsword.01.spectral.02.green'], { stageId: 'ao-fly', after: 'ao-cast', anchor: 'start', offset: 600, scale: 0.6, duration: 900, targetSelection: 'all', targetStagger: 250 }),
    impact('Strike each enemy', SLASH, { stageId: 'ao-hit', after: 'ao-fly', anchor: 'end', duration: 1100, targetSelection: 'all', targetStagger: 250 }),
  ]),

  // Avalanche Strike: two-handed sweep against every enemy in reach.
  'pf2e:SGgK4BoUooA0HhTj': design('A sweeping two-handed whirl strikes every adjacent enemy in turn.', () => [
    cast('Two-handed sweep', ['melee_generic.whirlwind.01.bluepurple', 'melee_generic.whirlwind.01.orange'], { stageId: 'av-sweep', scale: 1.2, duration: 1800 }),
    motion('spin', 'source', { after: 'av-sweep', anchor: 'start', offset: 100, duration: 1100, intensity: 0.3 }),
    impact('Each foe hit', ['melee_generic.slash.02.002.orange', 'melee_generic.slash.02.002.blue'], { stageId: 'av-hit', after: 'av-sweep', anchor: 'start', offset: 450, duration: 1200, targetSelection: 'all', targetStagger: 180 }),
    motion('stagger', 'targets', { after: 'av-hit', anchor: 'start', offset: 150, duration: 800, intensity: 0.5, targetSelection: 'all' }),
  ]),

  // Bear Hug: second claw Strike that pulls the foe in and grabs it.
  'pf2e:U3A0kqJ2HKBYiu7X': design('A second raking claw drags the foe into a crushing bear hug.', () => [
    impact('Claw Strike', ['claws.200px.brown', 'claws.200px.red'], { stageId: 'bh-claw', delay: 300, duration: 1100 }),
    motion('lunge', 'source', { duration: 800, intensity: 0.6 }),
    motion('press', 'targets', { after: 'bh-claw', anchor: 'start', offset: 300, duration: 1000, intensity: 0.5 }),
  ]),
  'pf2e:eClTKWfhyv2lFrwC': design('In bear shape, a second raking claw drags the foe into a crushing hug.', () => [
    impact('Claw Strike', ['claws.200px.brown', 'claws.200px.red'], { stageId: 'bhw-claw', delay: 300, duration: 1100 }),
    motion('lunge', 'source', { duration: 800, intensity: 0.6 }),
    motion('press', 'targets', { after: 'bhw-claw', anchor: 'start', offset: 300, duration: 1000, intensity: 0.5 }),
  ]),

  // Belly Flop: drop prone and crush the prone enemy under heavy armor.
  'pf2e:Wk1qjeuofFyLFdTQ': design('You hurl your armored weight down onto the prone enemy and crush it into the ground.', () => [
    motion('slam', 'source', { stageId: 'bf-drop', duration: 900, intensity: 0.7 }),
    impact('Crushing weight', FIST, { stageId: 'bf-hit', after: 'bf-drop', anchor: 'start', offset: 550, scale: 1.1, duration: 1100 }),
    aura('Ground thud', ['impact.ground_crack.01.white', 'impact.ground_crack.01.orange'], { subject: 'targets', after: 'bf-hit', anchor: 'start', offset: 100, scale: 1.2, below: true, duration: 1400, fadeOut: 500 }),
    motion('press', 'targets', { after: 'bf-hit', anchor: 'start', duration: 900, intensity: 0.6 }),
  ]),

  // Bestial Snarling: a predatory growl that frightens adjacent enemies.
  'pf2e:nCmsylaV144Pr4TZ': design('A low, rumbling snarl rolls out from you and adjacent foes flinch in fear.', () => [
    aura('Snarl', ['soundwave.01.red', 'soundwave.01.blue'], { stageId: 'bs-snarl', scale: 1.4, duration: 1300, fadeOut: 300, ...tint('#b04a2a') }),
    motion('pulse', 'source', { after: 'bs-snarl', anchor: 'start', duration: 800, intensity: 0.5 }),
    impact('Fear takes hold', ['icon.fear.dark_red', 'icon.fear.dark_purple'], { stageId: 'bs-fear', after: 'bs-snarl', anchor: 'start', offset: 500, scale: 0.6, offsetY: -0.5, offsetUnits: 'token', duration: 1400 }),
    motion('cower', 'targets', { after: 'bs-fear', anchor: 'start', duration: 1000, intensity: 0.4 }),
  ]),

  // Black Powder Blaze: a firearm-boosted leap ending in a melee Strike.
  'pf2e:YrRlbIzjsFlGGmVN': design('You fire your gun to launch yourself across the field and Strike with your attached weapon on landing.', () => [
    cast('Kickback blast', ['muzzle_flash.burst.01.yellow', 'muzzle_flash.single.01.yellow'], { stageId: 'bpb-blast', scale: 0.8, mirrorX: true, duration: 700 }),
    aura('Powder smoke', ['smoke.puff.side.grey'], { after: 'bpb-blast', anchor: 'start', offset: 150, scale: 0.8, duration: 1300, fadeOut: 500 }),
    motion('leap', 'source', { stageId: 'bpb-leap', after: 'bpb-blast', anchor: 'start', offset: 100, distance: 6, motionRange: 'target', motionEndpoint: 'near', duration: 1600 }),
    impact('Strike on landing', SLASH, { after: 'bpb-leap', anchor: 'end', offset: -300, duration: 1200 }),
  ]),

  // Black Powder Embodiment: you ride your shot and teleport beside the target.
  'pf2e:pWbNhfBiskV4n58a': design('You fire, merge into the shot, and reappear beside the creature it hit.', () => [
    ...gunShot('bpe'),
    motion('flicker', 'source', { after: 'bpe-flash', anchor: 'start', offset: 150, duration: 500, intensity: 0.7 }),
    motion('rush', 'source', { after: 'bpe-shot', anchor: 'end', distance: 20, motionRange: 'target', motionEndpoint: 'near', duration: 900, intensity: 0.4 }),
    impact('Reappear', ['smoke.puff.ring.01.white'], { after: 'bpe-shot', anchor: 'end', offset: 300, scale: 0.8, duration: 1000 }),
  ], FIREARM),

  // Black Powder Flash: ignite black powder in an adjacent foe's face.
  'pf2e:VsGdiAuVbYmDTR82': design('A pinch of black powder flares in the foe\'s face with a blinding flash and smoke.', () => [
    motion('lunge', 'source', { stageId: 'bpf-lunge', duration: 600, intensity: 0.4 }),
    impact('Powder flash', ['muzzle_flash.burst.01.yellow', 'muzzle_flash.single.01.yellow'], { stageId: 'bpf-flash', after: 'bpf-lunge', anchor: 'start', offset: 300, scale: 1, duration: 800 }),
    aura('Smoke in the eyes', ['smoke.puff.centered.grey'], { subject: 'targets', after: 'bpf-flash', anchor: 'start', offset: 150, scale: 0.9, duration: 1500, fadeOut: 500 }),
    motion('recoil', 'targets', { after: 'bpf-flash', anchor: 'start', duration: 700, intensity: 0.5 }),
  ], { sound: 'fireIgnition' }),

  // Blast Tackle: grapple, then fire point-blank.
  'pf2e:r4ZVpDjX2X0yrmhw': design('You throw yourself at the foe, brace the weapon against it and fire a point-blank shot.', () => [
    motion('rush', 'source', { stageId: 'bt-rush', distance: 4, motionRange: 'target', motionEndpoint: 'near', duration: 900, intensity: 0.5 }),
    ...gunShot('bt', { delay: 800, travel: { duration: 400 }, hit: ['explosion_side.01.orange'], impact: { scale: 0.6 } }),
  ], FIREARM),

  // Blasting Beams: a directed beam of heat.
  'pf2e:TtAvM02UvfNaXeXd': design('A searing ray of heat lances from your open hand to the target.', () => [
    cast('Heat gathers in the hand', ['cast_generic.fire.01.orange'], { stageId: 'bb-cast', scale: 0.7, duration: 900 }),
    travel('Heat beam', ['scorching_ray.01.orange'], { stageId: 'bb-ray', after: 'bb-cast', anchor: 'start', offset: 450, duration: 1500 }),
    impact('Scorch', ['impact.fire.01.orange'], { after: 'bb-ray', anchor: 'end', scale: 0.8, duration: 1200 }),
  ], { sound: 'fireRay' }),

  // Blazing Aura: you explode in flame in a 20-foot emanation.
  'pf2e:hkU92nqUYBQLQSMt': design('You explode in a ring of flame that rolls 20 feet outward and scorches enemies.', () => [
    cast('Explode in flame', ['explosion.01.orange'], { stageId: 'ba-boom', scale: 1.4, duration: 1300 }),
    aura('Flame ring', ['fire_ring.900px.red'], { stageId: 'ba-ring', after: 'ba-boom', anchor: 'start', offset: 300, scale: 2.5, below: true, opacity: 0.85, duration: 1800, fadeOut: 600 }),
    impact('Enemies burn', ['impact.fire.01.orange'], { after: 'ba-ring', anchor: 'start', offset: 400, scale: 0.7, duration: 1100, ...OPT }),
  ]),

  // Blazing Wave: a 30-foot cone of flame.
  'pf2e:C5zKhps2Rv95A8yX': design('Flame cascades from you in a broad cone and washes over the creatures in front of you.', () => [
    cast('Flame gathers', ['cast_generic.fire.01.orange'], { stageId: 'bw-cast', scale: 0.7, duration: 800 }),
    travel('Cascade of flame', ['breath_weapons02.burst.cone.fire.orange.01'], { stageId: 'bw-cone', after: 'bw-cast', anchor: 'start', offset: 400, targetSelection: 'first', duration: 2200 }),
    impact('Engulfed', ['flames.01.orange'], { after: 'bw-cone', anchor: 'start', offset: 700, scale: 0.8, duration: 1400, ...OPT }),
  ], { sound: 'fireCone' }),

  // Bleed Out: ranged bloodletting spell attack.
  'pf2e:skPVYOSDj7oC6PSX': design('Residual blood magic lashes out as a crimson bolt and opens a bleeding wound.', () => [
    cast('Blood magic stirs', ['cast_generic.dark.01.red', 'cast_generic.02.blue'], { stageId: 'bo-cast', scale: 0.7, duration: 900, ...tint('#9c1515') }),
    travel('Bloodletting bolt', ['scorching_ray.01.dark_red', 'scorching_ray.01.orange'], { stageId: 'bo-ray', after: 'bo-cast', anchor: 'start', offset: 450, duration: 1300, ...tint('#9c1515') }),
    impact('Wound opens', ['liquid.splash_side.red', 'liquid.splash_side02.red'], { after: 'bo-ray', anchor: 'end', scale: 0.8, duration: 1300 }),
  ], { sound: 'drain' }),

  // Bleeding Finisher: a blow that leaves profuse bleeding.
  'pf2e:dxujgA0NgiEvA0H8': design('A finishing slash opens a profusely bleeding wound.', () => [
    impact('Finishing slash', SLASH, { stageId: 'bf2-hit', delay: 300, duration: 1200 }),
    motion('lunge', 'source', { duration: 700, intensity: 0.6 }),
    aura('Blood spills', ['liquid.splash_side.red', 'liquid.splash_side02.red'], { subject: 'targets', after: 'bf2-hit', anchor: 'start', offset: 300, scale: 0.7, duration: 1200 }),
  ]),

  // Body of Air: your body becomes a cloud of living vapor.
  'pf2e:34mcF1rw3mvntv8Y': design('Your body unravels into a swirling cloud of pale vapor as the attack comes in.', () => [
    cast('Air consumes the body', ['smoke.puff.ring.01.white'], { stageId: 'boa-puff', duration: 1000 }),
    motion('flicker', 'source', { after: 'boa-puff', anchor: 'start', duration: 700, intensity: 0.4 }),
    aura('Living vapor', ['fog_cloud.01.white'], { after: 'boa-puff', anchor: 'start', offset: 300, scale: 0.8, opacity: 0.7, duration: 2400, fadeIn: 300, fadeOut: 700 }),
    aura('Gathered air', ['whirlwind.bluegrey'], { after: 'boa-puff', anchor: 'start', offset: 400, scale: 0.9, opacity: 0.5, below: true, duration: 2200, fadeOut: 700 }),
  ]),

  // Bone Burst: a thrall explodes into bone shards that fly at the triggering creature.
  'pf2e:zFPWGwYLC0wxqUDg': design('Your thrall bursts apart and its bone shards fly at the triggering creature.', () => [
    cast('Thrall bursts', ['explosion.shrapnel.bomb.01.grey', 'explosion.shrapnel.bomb.01.black'], { stageId: 'bb2-burst', scale: 0.6, duration: 900, ...tint('#e6dcc3') }),
    travel('Bone shards', ['bone.throw.01', 'dagger.throw.01.white'], { stageId: 'bb2-fly', after: 'bb2-burst', anchor: 'start', offset: 250, duration: 900, repeats: 3, repeatInterval: 120 }),
    impact('Shards pierce', HIT, { after: 'bb2-fly', anchor: 'end', scale: 0.7, duration: 1000 }),
  ], { sound: 'pierce' }),

  // Bone Spikes: bone spikes tear out of your body.
  'pf2e:cy9jqlHz75GTjg7l': design('Sharp spurs of bone tear outward from your elbows and wrists.', () => [
    cast('Bone spurs erupt', ['ice_spikes.radial.burst.white'], { stageId: 'bsp-spikes', scale: 0.7, duration: 1300, ...tint('#e9dfc6') }),
    motion('shake', 'source', { after: 'bsp-spikes', anchor: 'start', duration: 600, intensity: 0.4 }),
  ], { sound: 'pierce' }),

  // Bone Swarm: you scatter into a whirling storm of bones.
  'pf2e:E4MS2wnRQJfyldrT': design('Your body scatters into a huge, whirling storm of bones that lifts into the air.', () => [
    cast('Body scatters', ['smoke.puff.centered.grey'], { stageId: 'bsw-scatter', duration: 1000 }),
    aura('Storm of bones', ['whirlwind.bluegrey'], { stageId: 'bsw-storm', after: 'bsw-scatter', anchor: 'start', offset: 300, scale: 2, duration: 2600, fadeIn: 300, fadeOut: 700, ...tint('#d9cfb6') }),
    aura('Bone fragments', ['bone.throw.01', 'dagger.throw.01.white'], { after: 'bsw-storm', anchor: 'start', scale: 0.4, duration: 2400, fadeOut: 600, ...spin(1600) }),
    motion('levitate', 'source', { after: 'bsw-storm', anchor: 'start', duration: 1600, intensity: 0.5 }),
  ], { sound: 'wind' }),

  // Bullet and a Broadside: siege weapon Launch plus a firearm Strike.
  'pf2e:Id6C7qTQ3EX4ui2o': design('The adjacent siege weapon launches its shot while you fire your own weapon at the same foe.', () => [
    projectile('Siege shot', ['throwable.launch.cannon_ball.01.black'], { stageId: 'bab-siege', scale: 0.8, duration: 1200 }),
    impact('Siege impact', ['explosion.shrapnel.bomb.01.black'], { after: 'bab-siege', anchor: 'end', scale: 0.8, duration: 1300 }),
    ...gunShot('bab', { delay: 500 }),
  ], FIREARM),

  // Bullet Split: one shot split on a blade to hit two targets.
  'pf2e:vNIimhmP636VOP01': design('You fire across your blade and the split round strikes two different targets at once.', () => [
    cast('Muzzle flash', ['muzzle_flash.single.01.yellow'], { stageId: 'bs2-flash', faceTarget: true, scale: 0.7, duration: 700 }),
    travel('Split rounds', ['bullet.01.orange'], { stageId: 'bs2-shot', after: 'bs2-flash', anchor: 'start', offset: 80, duration: 900, targetSelection: 'all', targetLimit: 2 }),
    impact('Rounds strike', HIT, { after: 'bs2-shot', anchor: 'end', scale: 0.8, duration: 1100, targetSelection: 'all', targetLimit: 2 }),
    motion('recoil', 'source', { after: 'bs2-flash', anchor: 'start', duration: 500, intensity: 0.5 }),
  ], FIREARM),

  // Blood in the Air: a ranged Strike that ignores concealment (gunslinger).
  'pf2e:7spk6rZPiNk2S0yA': design('Locked on to the wounded quarry, you fire straight through its concealment.', () => [
    cast('Lock on', ['hunters_mark.pulse.01.green'], { stageId: 'bia-mark', scale: 0.5, duration: 900 }),
    ...gunShot('bia', { delay: 600 }),
  ], FIREARM),

  // Called Shot: aim at specific anatomy, then a firearm Strike.
  'pf2e:b7KZ7Fg5u5z2gqvt': design('You take aim at a specific body part and fire a precise shot.', () => [
    motion('brace', 'source', { stageId: 'cs-aim', duration: 700, intensity: 0.35 }),
    ...gunShot('cs', { delay: 600 }),
  ], FIREARM),

  // Cover Fire: suppressive firearm or crossbow Strike.
  'pf2e:IzkL60LlKzbKIhY1': design('You lay down a suppressive shot at the foe.', () => [
    ...gunShot('cf'),
  ], FIREARM),

  // Dance of Thunder: Steps and firearm Strikes with thunderous retorts.
  'pf2e:bSC18SbdaNXfBHu9': design('Your steps echo with black-powder thunder as you dance aside and fire.', () => [
    motion('dodge', 'source', { stageId: 'dt-step', distance: 0.5, motionRange: 'distance', duration: 1200, intensity: 0.4 }),
    ...gunShot('dt', { delay: 600 }),
  ], FIREARM),

  // Deflecting Shot: a quick shot to throw an attacker off target.
  'pf2e:ToZw6ZjB0JhWwMeR': design('You snap off a quick shot at the attacker to throw its blow off target.', () => [
    ...gunShot('ds', { hit: ['impact.005.orange'], impact: { scale: 0.6 } }),
  ], FIREARM),

  // Cannonball Fall: drop from height directly onto an enemy.
  'pf2e:pBlmJIHlSyt4zpHv': design('You drop from above straight onto the enemy and land with a ground-cracking impact.', () => [
    motion('leap', 'source', { stageId: 'cbf-fall', distance: 2, motionRange: 'target', motionEndpoint: 'near', duration: 1300 }),
    impact('Crash landing', ['impact.ground_crack.01.white', 'impact.ground_crack.01.orange'], { stageId: 'cbf-hit', after: 'cbf-fall', anchor: 'end', offset: -350, scale: 1.3, duration: 1500 }),
    aura('Dust', ['smoke.puff.centered.grey'], { subject: 'targets', after: 'cbf-hit', anchor: 'start', scale: 1, duration: 1200, fadeOut: 500 }),
    motion('stagger', 'targets', { after: 'cbf-hit', anchor: 'start', offset: 100, duration: 800, intensity: 0.6 }),
  ], { sound: 'bludgeon' }),

  // Celestial Cacophony: a cone of fireworks and black powder pellets.
  'pf2e:zWbPmIQfv9VTYwwH': design('Your innovation\'s detonation chamber sprays fireworks and sizzling pellets that burst among the creatures in front of you.', () => [
    cast('Detonation chamber fires', ['muzzle_flash.burst.01.yellow', 'muzzle_flash.single.01.yellow'], { stageId: 'cc-fire', faceTarget: true, scale: 0.9, duration: 700 }),
    impact('Fireworks scatter', ['firework.01.greenred.01', 'firework.01.orangeyellow.01'], { stageId: 'cc-pop', after: 'cc-fire', anchor: 'start', offset: 400, scale: 0.6, duration: 1800, targetSelection: 'all', targetStagger: 150 }),
    aura('Cacophony', ['soundwave.01.orangeyellow', 'soundwave.01.blue'], { subject: 'targets', after: 'cc-pop', anchor: 'start', offset: 300, scale: 0.8, opacity: 0.7, duration: 1100 }),
    motion('recoil', 'targets', { after: 'cc-pop', anchor: 'start', offset: 200, duration: 700, intensity: 0.4 }),
  ], { sound: 'explosion' }),

  // Cleansing Light: a burst of light from your horn in a 20-foot emanation.
  'pf2e:gXAAJCnjfCDK7YV2': design('Your horn flares and a ring of cleansing light sweeps out 20 feet around you.', () => [
    cast('Horn flares', ['sacred_flame.source.white', 'sacred_flame.source.yellow'], { stageId: 'cl-horn', scale: 0.8, offsetY: -0.3, offsetUnits: 'token', duration: 1100 }),
    aura('Cleansing burst', ['template_circle.out_pulse.01.burst.yellowwhite', 'template_circle.out_pulse.01.burst.bluewhite'], { after: 'cl-horn', anchor: 'start', offset: 450, scale: 3, below: true, opacity: 0.85, duration: 1800, fadeOut: 500 }),
    motion('pulse', 'source', { after: 'cl-horn', anchor: 'start', offset: 300, duration: 800, intensity: 0.4 }),
  ]),

  // Collapse: you collapse into a pile of bones to soften a critical hit.
  'pf2e:TtlbpGchHOoWc4HN': design('You fall apart into a heap of bones as the critical blow lands, shedding its worst force.', () => [
    motion('press', 'source', { stageId: 'col-fall', duration: 1000, intensity: 0.8 }),
    aura('Bones clatter down', ['smoke.puff.centered.grey'], { after: 'col-fall', anchor: 'start', offset: 250, scale: 0.9, below: true, duration: 1300, fadeOut: 500, ...tint('#cfc4aa') }),
  ], { sound: 'bludgeon' }),

  // Constricting Hold: the eidolon squeezes a grabbed creature.
  'pf2e:si8FGX2ZRxetdVHp': design('Your eidolon tightens its coils around the grabbed creature and squeezes.', () => [
    aura('Coils tighten', ['entangle.02.complete.04.grey', 'entangle.02.complete.02.green'], { subject: 'targets', stageId: 'ch-coil', scale: 1, duration: 2000, fadeOut: 500 }),
    impact('Crushing squeeze', FIST, { after: 'ch-coil', anchor: 'start', offset: 600, scale: 0.8, duration: 1000 }),
    motion('press', 'targets', { after: 'ch-coil', anchor: 'start', offset: 500, duration: 1100, intensity: 0.6 }),
  ], { sound: 'bludgeon' }),

  // Crane Flutter: interpose an arm, then counter with a crane wing.
  'pf2e:S14S52HjszTgIy4l': design('You raise a crane wing to turn the attack aside, then answer with a quick wing Strike.', () => [
    motion('brace', 'source', { stageId: 'cfl-block', duration: 700, intensity: 0.4 }),
    cast('Wing guard', ['wind_lines.01.01.white'], { after: 'cfl-block', anchor: 'start', scale: 0.7, duration: 800 }),
    impact('Crane wing counter', ['unarmed_strike.physical.02.orange', 'unarmed_strike.physical.02.blue'], { stageId: 'cfl-hit', after: 'cfl-block', anchor: 'end', offset: 50, duration: 1100 }),
    motion('lunge', 'source', { after: 'cfl-block', anchor: 'end', duration: 600, intensity: 0.5 }),
  ]),

  // Cranial Detonation: the felled enemy's head explodes in psychic energy.
  'pf2e:vCsprcXVTwgtUYAZ': design('Psychic energy detonates from the felled enemy\'s head and blasts those beside it.', () => [
    impact('Psychic detonation', ['explosion.01.purple', 'explosion.02.blue'], { stageId: 'cd-boom', scale: 0.9, offsetY: -0.2, offsetUnits: 'token', duration: 1300, ...tint('#a35cff') }),
    aura('Psychic shock', ['energy_strands.complete.dark_purple.01', 'energy_strands.complete.blue.01'], { subject: 'targets', after: 'cd-boom', anchor: 'start', offset: 250, scale: 1.4, duration: 1500, fadeOut: 500 }),
    motion('stagger', 'targets', { after: 'cd-boom', anchor: 'start', duration: 800, intensity: 0.6 }),
  ], { sound: 'psychic' }),

  // Crimson Breath: 30-foot cone of crimson-worm flame.
  'pf2e:ZuslXMXlW2TzoOgU': design('You breathe a crimson worm\'s blast of flame in a 30-foot cone.', () => [
    motion('lunge', 'source', { stageId: 'cb-breathe', duration: 700, intensity: 0.4 }),
    travel('Flame breath', ['breath_weapons.fire.cone.orange.01'], { stageId: 'cb-cone', after: 'cb-breathe', anchor: 'start', offset: 250, targetSelection: 'first', duration: 2300, ...tint('#e0401c') }),
    impact('Burning', ['flames.01.orange'], { after: 'cb-cone', anchor: 'start', offset: 700, scale: 0.8, duration: 1400, ...OPT }),
  ], { sound: 'fireCone' }),

  // Breath of Hungry Death: cone of flesh-eating, sickly green gas.
  'pf2e:AV9NkSLNvv0UcdcP': design('You exhale a cone of sickly green, flesh-eating gas that eats at everything in it.', () => [
    motion('lunge', 'source', { stageId: 'bhd-breathe', duration: 700, intensity: 0.4 }),
    travel('Flesh-eating gas', ['breath_weapons.poison.cone.green'], { stageId: 'bhd-cone', after: 'bhd-breathe', anchor: 'start', offset: 250, targetSelection: 'first', duration: 2400 }),
    impact('Flesh corrodes', ['impact.001.green', 'impact.005.orange'], { after: 'bhd-cone', anchor: 'start', offset: 800, scale: 0.8, duration: 1300, ...OPT, ...tint('#7fcf3a') }),
  ]),

  // Breath of the Dragon (Dragonblood): exhale a torrent of draconic energy.
  'pf2e:7y8DKd24c7eqzJGV': design('You exhale a torrent of draconic energy in a cone toward your foes.', () => [
    motion('lunge', 'source', { stageId: 'btd-breathe', duration: 700, intensity: 0.4 }),
    travel('Draconic breath', ['breath_weapons02.burst.cone.fire.orange.01'], { stageId: 'btd-cone', after: 'btd-breathe', anchor: 'start', offset: 250, targetSelection: 'first', duration: 2200 }),
    impact('Energy washes over', ['impact.002.orange', 'impact.005.orange'], { after: 'btd-cone', anchor: 'start', offset: 700, scale: 0.8, duration: 1100, ...OPT }),
  ], { sound: 'dragonRoar' }),

  // Crowned in Tempest's Fury: a crown of lightning and howling winds lift you.
  'pf2e:8iHpUB0bYaHh86Kk': design('Lightning crowns your brow, storm sparks crackle around you and howling winds lift you from the ground.', () => [
    cast('Lightning strikes', ['lightning_strike.blue'], { stageId: 'ct-bolt', scale: 0.8, duration: 1100 }),
    aura('Crown of lightning', ['static_electricity.01.blue'], { after: 'ct-bolt', anchor: 'start', offset: 350, scale: 1.4, duration: 2600, fadeOut: 600 }),
    aura('Howling winds', ['whirlwind.blue', 'whirlwind.bluegrey'], { after: 'ct-bolt', anchor: 'start', offset: 450, scale: 1.6, below: true, opacity: 0.6, duration: 2500, fadeOut: 700 }),
    motion('levitate', 'source', { after: 'ct-bolt', anchor: 'start', offset: 400, duration: 1600, intensity: 0.5 }),
  ]),

  // Cry of Rebellion: a passionate yell that inspires allies and pounds foes.
  'pf2e:Qf5aimp36VcZJiYh': design('Your rebellious yell booms outward as a sonic wave that rallies allies and pounds nearby foes.', () => [
    aura('Rebellious yell', ['soundwave.01.orangeyellow', 'soundwave.01.blue'], { stageId: 'cr-yell', scale: 2.4, duration: 1500, fadeOut: 400 }),
    motion('pulse', 'source', { after: 'cr-yell', anchor: 'start', duration: 800, intensity: 0.6 }),
    impact('Sonic pounding', ['impact.002.orange', 'impact.005.orange'], { stageId: 'cr-hit', after: 'cr-yell', anchor: 'start', offset: 400, scale: 0.7, duration: 1000, ...OPT }),
    motion('stagger', 'targets', { after: 'cr-hit', anchor: 'start', duration: 800, intensity: 0.5, ...OPT }),
  ], { sound: 'battleCry', soundNamespace: 'ability' }),

  // Curse of the Saumen Kar: an icy prison sphere around the target.
  'pf2e:UJcuACMlspc1raL1': design('Your runes flash and an orb of unmelting ice seals around the target.', () => [
    cast('Runes flash cold', ['cast_generic.ice.01.blue', 'cast_generic.02.blue'], { stageId: 'sk-cast', scale: 0.8, duration: 900 }),
    travel('Freezing ray', ['ray_of_frost.blue'], { stageId: 'sk-ray', after: 'sk-cast', anchor: 'start', offset: 450, duration: 1200 }),
    impact('Ice forms', ['ice_spikes.radial.burst.white'], { stageId: 'sk-hit', after: 'sk-ray', anchor: 'end', scale: 0.9, duration: 1300 }),
    aura('Icy prison', ['shield_themed.above.ice.01.blue'], { subject: 'targets', after: 'sk-hit', anchor: 'start', offset: 300, scale: 1.1, duration: 2600, fadeIn: 300, fadeOut: 700 }),
  ], { sound: 'cold' }),

  // Cyclonic Ascent: a cyclone around your lower body lifts you into the air.
  'pf2e:u9ZuPuXj0xA4dHxr': design('A cyclone whirls up around your lower body and lifts you into flight.', () => [
    cast('Wind gathers', ['wind_lines.01.01.white'], { stageId: 'ca-wind', scale: 0.8, duration: 900 }),
    aura('Cyclone', ['whirlwind.bluegrey'], { after: 'ca-wind', anchor: 'start', offset: 300, scale: 1.2, below: true, duration: 2400, fadeOut: 700 }),
    motion('levitate', 'source', { after: 'ca-wind', anchor: 'start', offset: 450, duration: 1600, intensity: 0.6 }),
  ]),

  // Deadly Aim: a hard ranger shot at the prey's weak spot.
  'pf2e:enPAJ1oSDutts7ic': design('You aim for your prey\'s weak spot and loose a hard, deliberate shot.', () => [
    cast('Mark the weak point', ['hunters_mark.pulse.01.green'], { stageId: 'da-mark', scale: 0.5, duration: 900 }),
    ...bowShot('da', { aimMs: 600 }),
  ], BOW),

  // Defensive Advance: Raise a Shield, Stride and Strike.
  'pf2e:117d4Me9nAn1GMry': design('You raise your shield, drive forward behind it and Strike the enemy you reach.', () => [
    cast('Raise shield', ['shield.01.intro.yellow', 'shield.01.intro.blue'], { stageId: 'dfa-shield', scale: 0.9, duration: 1000 }),
    motion('rush', 'source', { stageId: 'dfa-rush', after: 'dfa-shield', anchor: 'start', offset: 400, distance: 6, motionRange: 'target', motionEndpoint: 'near', duration: 1500, intensity: 0.5 }),
    impact('Strike at arrival', ['melee_generic.bludgeoning.one_handed', 'melee_generic.slash.02.001.blue'], { after: 'dfa-rush', anchor: 'end', offset: -250, duration: 1200 }),
  ]),

  // Death Dive: the dragon mount plummets onto a foe.
  'pf2e:BKdKyftmphU9n3Wq': design('Your dragon mount dives headlong out of the sky and rakes the foe at the bottom of its plunge.', () => [
    motion('leap', 'source', { stageId: 'dd-dive', distance: 6, motionRange: 'target', motionEndpoint: 'near', duration: 1500 }),
    impact('Diving rake', ['melee_generic.creature_attack.claw.002.red'], { stageId: 'dd-hit', after: 'dd-dive', anchor: 'end', offset: -300, duration: 1100 }),
    aura('Downdraft dust', ['smoke.puff.ring.01.white'], { subject: 'targets', after: 'dd-hit', anchor: 'start', scale: 1.1, duration: 1100 }),
    motion('stagger', 'targets', { after: 'dd-hit', anchor: 'start', offset: 100, duration: 800, intensity: 0.5 }),
  ]),

  // Apocalyptic Visions: visions of Earthfall forced into up to 10 minds.
  'pf2e:ghiZ4DhdmHlBAeU0': design('Visions of Earthfall rain burning stars upon each target\'s mind and they reel in despair.', () => [
    cast('Project the end', ['cast_shape.circle.01.purple', 'cast_shape'], { stageId: 'av2-cast', scale: 0.9, duration: 1000 }),
    impact('Earthfall vision', ['falling_rocks.top.1x1.orange', 'falling_rocks.top.1x1.grey'], { stageId: 'av2-fall', after: 'av2-cast', anchor: 'start', offset: 500, scale: 0.9, opacity: 0.7, duration: 1600, targetSelection: 'all', targetStagger: 120, ...tint('#c75bff') }),
    aura('Despair', ['markers.fear.dark_purple'], { subject: 'targets', after: 'av2-fall', anchor: 'start', offset: 600, scale: 0.6, offsetY: -0.5, offsetUnits: 'token', duration: 1500, fadeOut: 500 }),
    motion('cower', 'targets', { after: 'av2-fall', anchor: 'start', offset: 500, duration: 1000, intensity: 0.4 }),
  ], { sound: 'psychic' }),

  // Assassinate: one swift, lethal Strike on the unaware mark.
  'pf2e:iJxbrXAdxhLqdT5E': design('You strike your unaware mark with one swift, lethal blow that flares with precision.', () => [
    impact('Swift killing blow', PIERCE, { stageId: 'asn-hit', delay: 300, duration: 1200 }),
    motion('lunge', 'source', { duration: 700, intensity: 0.7 }),
    aura('Precision wound', ['sneak_attack.dark_red', 'sneak_attack.dark_green'], { subject: 'targets', after: 'asn-hit', anchor: 'start', offset: 250, scale: 0.7, duration: 1400, ...tint('#8e1414') }),
  ]),
};
