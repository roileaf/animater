// Bespoke compositions (pf2e-feats-c). Keys: '<system>:<entryId>' or '<system>:<entryId>:<variant|mode>'.
// See scripts/catalogs/bespoke/helpers.mjs and scripts/bespoke.mjs.
import { cast, travel, projectile, impact, area, aura, sprite, motion, tint, spin, breathe, design } from './helpers.mjs';

// Shared small builders for this slice.
const ab = (profile, extra = {}) => ({ sound: profile, soundNamespace: 'ability', ...extra });
/** Self-buff resolve: a rising ward plus a held glow on the source. */
const resolve = (color, freeTint, o = {}) => [
  cast('Resolve rises', [`shield.03.intro.${color}`, 'shield.01.intro.blue'], { stageId: 'rs-cast', scale: 0.9, duration: 1300, ...(freeTint ? tint(freeTint) : {}) }),
  aura('Steeled spirit', [`on_token_buff.001.001.${o.buff ?? 'orangeyellow'}`], { after: 'rs-cast', anchor: 'start', offset: 700, duration: 2000, scale: 1.1, opacity: 0.85, fadeIn: 300, fadeOut: 500 }),
  motion('brace', 'source', { after: 'rs-cast', anchor: 'start', offset: 150, duration: 1000, intensity: 0.4 }),
];
/** Ranged weapon shot: aim, flight, small contact. */
const shot = (flight, contact, o = {}) => [
  impact('Aim', [o.aim ?? 'hunters_mark.pulse.01.green', 'hunters_mark.pulse.01.green'], { stageId: 'sh-aim', scale: 0.5, duration: 900, opacity: 0.8 }),
  travel('Shot', flight, { stageId: 'sh-fly', after: 'sh-aim', anchor: 'start', offset: 500, duration: o.flight ?? 1600, ...(o.repeats ? { repeats: o.repeats, repeatInterval: 450 } : {}) }),
  impact('Contact', contact, { after: 'sh-fly', anchor: 'arrival', duration: 1200, scale: o.scale ?? 0.8, ...(o.repeats ? { repeats: o.repeats, repeatInterval: 450 } : {}) }),
  motion('recoil', 'source', { after: 'sh-fly', anchor: 'start', duration: 600, intensity: 0.4 }),
];

export default {
  // ── Lines 1-60 ─────────────────────────────────────────────────────────
  'pf2e:37uOb0iaWCfTCvBZ': design('Harsh Judgement: a loud declaration rings out and a red mark of condemnation settles on the chosen foe.', () => [
    cast('Loud declaration', ['soundwave.01.red', 'soundwave.01.blue'], { stageId: 'hj-cry', scale: 0.8, duration: 1200, ...tint('#c0392b') }),
    impact('Condemned', ['hunters_mark.loop.01.red', 'hunters_mark.pulse.01.green'], { stageId: 'hj-mark', after: 'hj-cry', anchor: 'start', offset: 450, duration: 2000, scale: 0.8, fadeIn: 200, fadeOut: 500 }),
    impact('Life forfeit', ['markers.skull.dark_red', 'markers.skull.dark_orange'], { after: 'hj-mark', anchor: 'start', offset: 500, duration: 1500, scale: 0.6, offsetY: -0.55, offsetUnits: 'token', fadeIn: 200, fadeOut: 400 }),
    motion('pulse', 'source', { after: 'hj-cry', anchor: 'start', duration: 900, intensity: 0.4 }),
  ], ab('battleCry')),

  'pf2e:Rb3ndqSyDUa6KvOL': design('Hasty Celebration: you burst into song and dance; fireworks and music notes cheer allies on while you twirl, oblivious.', () => [
    cast('Celebration', ['firework.01.orangeyellow', 'firework.01.orangeyellow'], { stageId: 'hc-fw', scale: 0.8, offsetY: -0.6, offsetUnits: 'token', duration: 1600 }),
    cast('Song', ['markers.music.greenorange', 'markers.music.greenorange'], { stageId: 'hc-music', after: 'hc-fw', anchor: 'start', offset: 300, duration: 2200, scale: 0.9 }),
    aura('Party glow', ['bardic_inspiration.greenorange', 'bardic_inspiration.greenorange'], { after: 'hc-fw', anchor: 'start', offset: 600, duration: 1900, scale: 1, opacity: 0.8, fadeIn: 300, fadeOut: 500 }),
    motion('spin', 'source', { after: 'hc-fw', anchor: 'start', offset: 300, duration: 1300, intensity: 0.5 }),
  ]),

  'pf2e:OYrcbyaV3v8ycksj': design('Head of the Night Parade: you Perform and three waves of riotous apparitions (dancing tsukumogami, drinking oni) spill out around you.', () => [
    cast('Perform', ['music_notations.beamed_quavers.purple', 'music_notations.beamed_quavers.blue'], { stageId: 'np-perf', scale: 0.75, duration: 1300 }),
    aura('Night Parade', ['spirit_guardians.pinkpurple.spirits', 'spirit_guardians.blueyellow.ring'], { stageId: 'np-par', after: 'np-perf', anchor: 'start', offset: 500, duration: 3200, scale: 1.4, opacity: 0.85, fadeIn: 400, fadeOut: 700 }),
    cast('Mischief 1', ['smoke.puff.side.dark_purple', 'smoke.puff.side.grey'], { after: 'np-par', anchor: 'start', offset: 200, duration: 1200, scale: 0.7, offsetX: -0.7, offsetUnits: 'token' }),
    cast('Mischief 2', ['smoke.puff.side.dark_purple', 'smoke.puff.side.grey'], { after: 'np-par', anchor: 'start', offset: 700, duration: 1200, scale: 0.7, offsetX: 0.7, offsetUnits: 'token', mirrorX: true }),
    cast('Mischief 3', ['firework.02.bluepink', 'firework.02.yellow'], { after: 'np-par', anchor: 'start', offset: 1200, duration: 1400, scale: 0.6, offsetY: -0.7, offsetUnits: 'token' }),
    motion('pulse', 'source', { after: 'np-perf', anchor: 'start', duration: 900, intensity: 0.4 }),
  ], { sound: 'song' }),

  'pf2e:agfosPInBLQXNQfa': design('Head Stomp: you stamp down on a prone foe with an unarmed Strike; the blow cracks the ground beneath its head.', () => [
    impact('Stomp', ['unarmed_strike.physical.01.dark_red', 'unarmed_strike.physical.01.blue'], { stageId: 'hs-hit', delay: 400, duration: 1200, scale: 0.9 }),
    impact('Ground cracks', ['impact.ground_crack.01.white', 'impact.ground_crack.01.orange'], { after: 'hs-hit', anchor: 'start', offset: 250, duration: 1500, scale: 0.6, below: true }),
    motion('slam', 'source', { delay: 100, duration: 900, intensity: 0.5 }),
  ]),

  'pf2e:Q4NiHmThMtk8razS': design('Headshot: a steadied aim, a single precise sniper round, and a tight impact to the target.', () => shot(['bullet.Snipe.orange', 'bullet.Snipe.blue'], ['impact.005.white', 'impact.005.orange'], { aim: 'hunters_mark.loop.01.red', scale: 0.6 })),

  'pf2e:qJdbK8vgIqeHU7bu': design("Heaven's Thunder: crackling electricity and booming sonic resonance wrap your fists for the next turn.", () => [
    cast('Thunder gathers', ['static_electricity.03.blue', 'static_electricity.03.blue'], { stageId: 'ht-el', scale: 0.9, duration: 1400 }),
    cast('Sonic boom', ['soundwave.02.blue', 'soundwave.02.blue'], { after: 'ht-el', anchor: 'start', offset: 400, duration: 1200, scale: 0.7 }),
    aura('Charged fists', ['static_electricity.01.blue', 'static_electricity.01.blue'], { after: 'ht-el', anchor: 'start', offset: 900, duration: 2000, scale: 0.8, opacity: 0.8, fadeIn: 300, fadeOut: 500 }),
    motion('pulse', 'source', { after: 'ht-el', anchor: 'start', duration: 900, intensity: 0.5 }),
  ], { sound: 'electric' }),

  'pf2e:mGGnDgk4wWpCMon8': design('Hell of 1,000,000 Needles: monumental metal filaments lance up through the targets, then lightning crisscrosses the needles.', () => [
    cast('Metal gathers', ['aura_themed.01.inward.complete.metal.01.grey'], { stageId: 'hn-cast', scale: 0.9, duration: 1200 }),
    impact('Needles lance up', ['ice_spikes.radial.burst.grey', 'ice_spikes.radial.burst.white'], { stageId: 'hn-spike', after: 'hn-cast', anchor: 'start', offset: 700, duration: 2000, scale: 0.9, ...tint('#9aa3ad') }),
    impact('Lightning crisscross', ['static_electricity.02.blue', 'static_electricity.02.blue'], { after: 'hn-spike', anchor: 'start', offset: 700, duration: 1400, scale: 0.8 }),
    motion('stagger', 'targets', { after: 'hn-spike', anchor: 'start', offset: 100, duration: 800, intensity: 0.5 }),
  ]),

  'pf2e:24LBBYT1op52Pm4J': design("Hellbreaker's Resolve: you steel mind and body; a golden ward rises and settles as temporary vigor.", () => resolve('yellow', '#f2c94c')),

  'pf2e:qUSWPWxYF8gfhfHM': design('Helpful Tinkering: a quick wrench-and-fiddle at an ally\'s weapon, which then glows with your innovation\'s boost.', () => [
    impact('Tinker', ['wrench.melee.01.orange', 'wrench.melee.01.white'], { stageId: 'tk-w', delay: 200, duration: 1200, scale: 0.7 }),
    impact('Boost installed', ['impact.013.001.orangeyellow', 'impact.orange'], { after: 'tk-w', anchor: 'start', offset: 600, duration: 1200, scale: 0.6 }),
    motion('lunge', 'source', { delay: 100, duration: 800, distance: 0.12, intensity: 0.4 }),
  ]),

  'pf2e:AY3XRv2j0cZvHaks': design('Hematocritical: you bathe in your foe\'s arterial spray, the blood feeding a crimson surge of spell power.', () => [
    cast('Arterial spray', ['liquid.splash.red', 'liquid.splash02.red'], { stageId: 'hm-blood', scale: 0.8, duration: 1300 }),
    aura('Blood-fed magic', ['energy_strands.overlay.dark_red', 'energy_strands.overlay.blue'], { after: 'hm-blood', anchor: 'start', offset: 600, duration: 2000, scale: 1, opacity: 0.85, fadeIn: 300, fadeOut: 500, ...tint('#8b0000') }),
    motion('pulse', 'source', { after: 'hm-blood', anchor: 'start', offset: 300, duration: 900, intensity: 0.5 }),
  ]),

  'pf2e:QpLRaBnuAiVRJOXG': design('Henge Gate: you strike the earth and two standing stones burst up nearby, your chosen rune blazing in the air above them.', () => [
    cast('Strike the earth', ['impact.ground_crack.01.orange'], { stageId: 'hg-strike', scale: 0.7, below: true, duration: 1300 }),
    cast('Left stone rises', ['falling_rocks.top.1x1.grey'], { stageId: 'hg-l', after: 'hg-strike', anchor: 'start', offset: 450, duration: 1600, scale: 0.7, offsetX: -1.2, offsetUnits: 'token' }),
    cast('Right stone rises', ['falling_rocks.top.1x1.grey'], { after: 'hg-strike', anchor: 'start', offset: 600, duration: 1600, scale: 0.7, offsetX: 1.2, offsetUnits: 'token' }),
    cast('Left rune', ['markers.runes.yellow', 'markers.runes.orange'], { after: 'hg-l', anchor: 'start', offset: 700, duration: 1800, scale: 0.5, offsetX: -1.2, offsetY: -0.8, offsetUnits: 'token', fadeIn: 200, fadeOut: 400 }),
    cast('Right rune', ['markers.runes.yellow', 'markers.runes.orange'], { after: 'hg-l', anchor: 'start', offset: 800, duration: 1800, scale: 0.5, offsetX: 1.2, offsetY: -0.8, offsetUnits: 'token', fadeIn: 200, fadeOut: 400 }),
    motion('slam', 'source', { duration: 800, intensity: 0.5 }),
  ]),

  'pf2e:P07YFQCp3hT3OgJE': design("Herald's Strike: a spirit-wreathed blow hurls divine radiance through the target.", () => [
    cast('Spirit-wreathed weapon', ['divine_smite.caster.yellowwhite', 'divine_smite.caster.blueyellow'], { stageId: 'hst-c', scale: 0.7, duration: 1100 }),
    impact('Divine blow', ['divine_smite.target.yellowwhite', 'divine_smite.target.blueyellow'], { stageId: 'hst-hit', after: 'hst-c', anchor: 'start', offset: 500, duration: 1600, scale: 0.8 }),
    motion('lunge', 'source', { after: 'hst-c', anchor: 'start', offset: 300, duration: 900, distance: 0.2, intensity: 0.6 }),
    motion('recoil', 'targets', { after: 'hst-hit', anchor: 'start', offset: 150, duration: 650, intensity: 0.5 }),
  ]),

  'pf2e:5ELeiNtEDgXfBcwt': design("Herald's Weapon: your weapon is wreathed in pure spiritual energy for a minute.", () => [
    cast('Divine wrath kindles', ['divine_smite.caster.yellowwhite', 'divine_smite.caster.blueyellow'], { stageId: 'hw-c', scale: 0.85, duration: 1400 }),
    aura('Spirit-wreathed weapon', ['sacred_flame.source.white', 'sacred_flame.source.yellow'], { after: 'hw-c', anchor: 'start', offset: 700, duration: 2000, scale: 0.7, opacity: 0.85, fadeIn: 300, fadeOut: 500 }),
    motion('pulse', 'source', { after: 'hw-c', anchor: 'start', offset: 200, duration: 900, intensity: 0.4 }),
  ], { sound: 'holy' }),

  'pf2e:5uzu5u5UFSfRRBSs': design('Heraldic Proclamation: you proclaim your spell with divine might; a radiant ring rolls out to bless allies and smite foes.', () => [
    cast('Proclamation', ['soundwave.01.orangeyellow', 'soundwave.01.blue'], { stageId: 'hp-cry', scale: 0.8, duration: 1200, ...tint('#f2c94c') }),
    aura('Divine might', ['bless.400px.intro.yellow', 'bless.400px.intro.yellow'], { after: 'hp-cry', anchor: 'start', offset: 450, duration: 2200, scale: 1.3, opacity: 0.85, fadeOut: 500 }),
    motion('pulse', 'source', { after: 'hp-cry', anchor: 'start', duration: 900, intensity: 0.5 }),
  ], { sound: 'holy' }),

  'pf2e:81jVmGF9Uo9dp2dI': design('Heroic Defiance: doom shadows recoil as your implacable spirit surges outward.', () => [
    cast('Shadows of doom', ['smoke.puff.centered.dark_black', 'smoke.puff.centered.grey'], { stageId: 'hd-doom', scale: 0.9, duration: 1100 }),
    cast('Spirit surges', ['impact.011.yellow', 'impact.yellow'], { stageId: 'hd-surge', after: 'hd-doom', anchor: 'start', offset: 450, duration: 1300, scale: 0.9 }),
    aura('Defiant vigor', ['on_token_buff.001.001.orangeyellow'], { after: 'hd-surge', anchor: 'start', offset: 300, duration: 2000, scale: 1.1, opacity: 0.85, fadeIn: 300, fadeOut: 500 }),
    motion('brace', 'source', { after: 'hd-surge', anchor: 'start', duration: 900, intensity: 0.5 }),
  ]),

  'pf2e:iVwsLYjOJbfvL0Pe': design('Heroic Presence: a rousing call fills chosen allies with blazing conviction.', () => [
    cast('Rousing call', ['soundwave.02.orangeyellow', 'soundwave.02.blue'], { stageId: 'hpr-c', scale: 0.8, duration: 1300, ...tint('#f2c94c') }),
    impact('Zealous conviction', ['bless.200px.intro.yellow'], { after: 'hpr-c', anchor: 'start', offset: 500, duration: 1900, scale: 0.9 }),
    motion('pulse', 'source', { after: 'hpr-c', anchor: 'start', duration: 900, intensity: 0.4 }),
  ], ab('battleCry')),

  'pf2e:xmf6oUYarFJGajtr': design('Holy Light: arms raised in prayer, you become a towering beacon of holy light; evil eyes are dazzled.', () => [
    cast('Prayer', ['sacred_flame.source.yellow'], { stageId: 'hl-pray', scale: 0.9, duration: 1200 }),
    aura('Beacon', ['bless.400px.intro.yellow'], { stageId: 'hl-beacon', after: 'hl-pray', anchor: 'start', offset: 500, duration: 2600, scale: 2, opacity: 0.8, fadeOut: 600 }),
    aura('Light pillar', ['markers.light.complete.yellow', 'markers.light.complete.blue'], { after: 'hl-pray', anchor: 'start', offset: 600, duration: 2400, scale: 1.2, opacity: 0.9, ...tint('#ffe9a3') }),
    motion('levitate', 'source', { after: 'hl-pray', anchor: 'start', duration: 1800, intensity: 0.3 }),
  ], { sound: 'holy' }),

  'pf2e:GU3EQVOMjD9S2YWj': design('Hone Claws: you grind a wicked edge onto your claws; sparks of the sharpening flash before a blood-red edge gleams.', () => [
    cast('Grinding', ['claws.200px.brown', 'claws.200px.red'], { stageId: 'hc-grind', scale: 0.6, duration: 1100, repeats: 2, repeatInterval: 500 }),
    aura('Wicked edge', ['glint.yellow.many', 'glint.yellow.many'], { after: 'hc-grind', anchor: 'start', offset: 1100, duration: 1500, scale: 0.7, ...tint('#c0392b') }),
    motion('shake', 'source', { after: 'hc-grind', anchor: 'start', duration: 900, intensity: 0.3 }),
  ], ab('claw')),

  'pf2e:rb0GCneYEzBi2LGr': design('Howling Aspect: your hair loosens into flames and your teeth into fangs as you howl a vow of ire.', () => [
    cast('Howl', ['soundwave.01.red', 'soundwave.01.blue'], { stageId: 'ha-howl', scale: 0.8, duration: 1300, ...tint('#ff6a3d') }),
    aura('Flame hair', ['flames.04.complete.orange', 'flames.04.complete.orange'], { after: 'ha-howl', anchor: 'start', offset: 450, duration: 2200, scale: 0.6, offsetY: -0.35, offsetUnits: 'token', fadeIn: 300, fadeOut: 500 }),
    aura('Form surges', ['shimmer.01.orange', 'shimmer.01.blue'], { after: 'ha-howl', anchor: 'start', offset: 600, duration: 1800, scale: 1, opacity: 0.7 }),
    motion('pulse', 'source', { after: 'ha-howl', anchor: 'start', duration: 1000, intensity: 0.6 }),
  ]),

  'pf2e:c3b7DhnDBC7YEgRG': design('Hunted Shot: two quick shots in succession against your hunted prey.', () => shot(['arrow.physical.white.01', 'arrow.physical.white.01'], ['impact.005.white', 'impact.005.orange'], { repeats: 2, scale: 0.6 })),

  'pf2e:GFtNQvpzuqtsdOTG': design("Hunter's Aim: a long, steady aim marks the prey before a single true shot.", () => shot(['arrow.physical.white.01', 'arrow.physical.white.01'], ['impact.005.white', 'impact.005.orange'], { scale: 0.7 })),

  'pf2e:KYTSvAEqK7KAyVwi': design("Hunter's Defense: reading the natural creature's attack, you nimbly sidestep it.", () => [
    cast('Read the attack', ['eyes.01.dark_green.single', 'eyes.01.dark_green.single'], { stageId: 'hd-eye', scale: 0.5, offsetY: -0.6, offsetUnits: 'token', duration: 1000 }),
    cast('Sidestep', ['wind_lines.01.leaves.01.green', 'wind_lines.01.leaves.01.green'], { after: 'hd-eye', anchor: 'start', offset: 400, duration: 1300, scale: 0.7 }),
    motion('dodge', 'source', { after: 'hd-eye', anchor: 'start', offset: 400, duration: 900, distance: 0.4, motionRange: 'distance', intensity: 0.5 }),
  ]),

  'pf2e:9KvsO72JJ3pfkG4U': design('Hurling Charge: hurl the thrown weapon in hand, then charge forward and draw another.', () => [
    projectile('Thrown weapon', ['dagger.throw.01.white', 'dagger.throw.01.white'], { stageId: 'hcg-t', delay: 200, duration: 1300 }),
    impact('Contact', ['impact.005.white', 'impact.005.orange'], { after: 'hcg-t', anchor: 'arrival', duration: 1000, scale: 0.6 }),
    motion('throw', 'source', { duration: 700, intensity: 0.5 }),
    motion('rush', 'source', { after: 'hcg-t', anchor: 'arrival', duration: 1600, distance: 4, intensity: 0.45, motionRange: 'target', motionHeading: 'toward', motionEndpoint: 'near' }),
  ], ab('thrown')),

  'pf2e:E17bF9oLgZ4Z3L8G': design('Hush: you blink through the veil to a new square, strike, and a muffling hush clings to the target.', () => [
    cast('Teleport out', ['misty_step.01.dark_purple', 'misty_step.01.blue'], { stageId: 'hu-out', scale: 0.8, duration: 1100 }),
    motion('flicker', 'source', { after: 'hu-out', anchor: 'start', offset: 200, duration: 900, intensity: 0.6 }),
    impact('Strike', ['melee_generic.slashing.one_handed', 'melee_generic.slash.01.orange'], { stageId: 'hu-hit', after: 'hu-out', anchor: 'start', offset: 900, duration: 1300 }),
    impact('Silence', ['icon.mute.purple', 'icon.mute.dark_red'], { after: 'hu-hit', anchor: 'start', offset: 500, duration: 1300, scale: 0.5, offsetY: -0.55, offsetUnits: 'token', fadeIn: 200, fadeOut: 400 }),
    motion('lunge', 'source', { after: 'hu-hit', anchor: 'start', offset: -200, duration: 800, distance: 0.2, intensity: 0.6 }),
  ]),

  'pf2e:0jJ5FG72lydY3HHR': design('Hydraulic Maneuvers: water siphoned from the air gathers into a torrent you can batter foes with at range.', () => [
    cast('Siphon moisture', ['cast_generic.water.02.blue'], { stageId: 'hm-c', scale: 0.8, duration: 1200 }),
    aura('Torrent held', ['liquid.blob.blue', 'liquid.blob.blue'], { after: 'hm-c', anchor: 'start', offset: 600, duration: 1800, scale: 0.6, offsetX: 0.5, offsetUnits: 'token', fadeIn: 300, fadeOut: 400 }),
    motion('pulse', 'source', { after: 'hm-c', anchor: 'start', duration: 900, intensity: 0.4 }),
  ], { sound: 'water' }),

  'pf2e:PLix02TPp7VaClka': design('Idol Threat: you brandish the creature\'s precious object menacingly; dread and distraction grip it.', () => [
    cast('Brandish', ['glint.yellow.many'], { stageId: 'it-b', scale: 0.6, offsetY: -0.4, offsetUnits: 'token', duration: 1100 }),
    impact('Dread', ['markers.fear.dark_purple', 'markers.fear.dark_purple'], { after: 'it-b', anchor: 'start', offset: 500, duration: 1800, scale: 0.7, fadeIn: 200, fadeOut: 400 }),
    motion('shake', 'source', { after: 'it-b', anchor: 'start', duration: 800, intensity: 0.4 }),
    motion('cower', 'targets', { after: 'it-b', anchor: 'start', offset: 600, duration: 1100, intensity: 0.35 }),
  ]),

  'pf2e:zXsJuf8RjBlJ6nJv': design('Igneogenesis: stone is pulled from your kinetic gate and sculpted into a solid block beside you.', () => [
    cast('Earth gathers', ['cast_generic.earth.01.browngreen'], { stageId: 'ig-c', scale: 0.8, duration: 1200 }),
    cast('Stone object forms', ['falling_rocks.top.1x1.grey'], { stageId: 'ig-rock', after: 'ig-c', anchor: 'start', offset: 600, duration: 1700, scale: 0.8, offsetX: 1, offsetUnits: 'token' }),
    cast('Dust settles', ['impact.ground_crack.01.orange'], { after: 'ig-rock', anchor: 'start', offset: 400, duration: 1400, scale: 0.5, offsetX: 1, offsetUnits: 'token', below: true }),
  ]),

  'pf2e:uKeUPPqV1cNnIy0h': design('Ignite the Sun: a miniature sun flares into being over the area, searing those within.', () => [
    cast('Fires of creation', ['cast_generic.fire.01.orange'], { stageId: 'is-c', scale: 0.8, duration: 1100 }),
    impact('Sun ignites', ['fireball.explosion.orange'], { stageId: 'is-boom', after: 'is-c', anchor: 'start', offset: 600, duration: 1600, scale: 0.9 }),
    impact('Miniature sun', ['flaming_sphere.400px.orange.02', 'flaming_sphere.orange.02'], { after: 'is-boom', anchor: 'start', offset: 500, duration: 2600, scale: 1, opacity: 0.95, fadeIn: 300, fadeOut: 700 }),
  ]),

  'pf2e:EAoMrpAEH9VBcDHK': design('Ill Tide: a cold eddy of bad luck washes over the stumbling creature and lingers as a curse.', () => [
    impact('Ill tide', ['liquid.splash.blue', 'liquid.splash.blue'], { stageId: 'it-w', delay: 200, duration: 1200, scale: 0.6 }),
    impact('Bad luck', ['condition.curse.01.001.blue', 'condition.curse.01.001.red'], { after: 'it-w', anchor: 'start', offset: 500, duration: 1900, scale: 0.8, fadeIn: 200, fadeOut: 500 }),
  ]),

  // ── Lines 61-120 ───────────────────────────────────────────────────────
  'pf2e:a5jZJPZO8RPQjqE7': design('Illimitable Finisher: a single quick Step into a flowing, bravado-laden finisher.', () => [
    motion('rush', 'source', { stageId: 'if-step', delay: 100, duration: 700, distance: 1, intensity: 0.5, motionRange: 'target', motionHeading: 'toward', motionEndpoint: 'near' }),
    impact('Flowing finisher', ['melee_generic.slash.01.orange', 'melee_generic.slash.01.orange'], { stageId: 'if-hit', after: 'if-step', anchor: 'arrival', duration: 1300 }),
    cast('Panache flourish', ['swirling_sparkles.01.yellow', 'swirling_sparkles.01.blue'], { after: 'if-hit', anchor: 'start', offset: 600, duration: 1300, scale: 0.7 }),
    motion('lunge', 'source', { after: 'if-step', anchor: 'arrival', duration: 800, distance: 0.2, intensity: 0.6 }),
  ]),

  'pf2e:hcwSO3qeYLQtRLBa': design('Imbue Spell: the energy of your just-cast spell streams into an adjacent ally, who holds it ready.', () => [
    cast('Spell energy gathered', ['energy_strands.in.purple', 'energy_strands.in.green'], { stageId: 'is-in', scale: 0.8, duration: 1200 }),
    travel('Imbued stream', ['energy_strands.range.standard.purple', 'energy_strands.range.standard.purple'], { stageId: 'is-tr', after: 'is-in', anchor: 'start', offset: 600, duration: 1400 }),
    impact('Held energy', ['on_token_buff.001.001.bluepurple'], { after: 'is-tr', anchor: 'arrival', duration: 1900, scale: 1, fadeIn: 200, fadeOut: 500 }),
  ]),

  'pf2e:R8MaoG7CzHZmQYtM': design('Immovable Object: you plant your feet wide; the ground cracks beneath you and a rampart of stability locks in.', () => [
    cast('Plant feet', ['impact.ground_crack.01.white', 'impact.ground_crack.01.orange'], { stageId: 'io-plant', scale: 0.7, below: true, duration: 1400 }),
    aura('Unmoving', ['markers.shield_rampart.complete.01.white', 'markers.shield_rampart.complete.01.orange'], { after: 'io-plant', anchor: 'start', offset: 400, duration: 2200, scale: 0.9, fadeOut: 400 }),
    motion('brace', 'source', { duration: 1000, intensity: 0.6 }),
  ]),

  'pf2e:Qfn7lmOeXfBtpG4O': design('Impaling Finisher: one thrust drives through the adjacent foe into the one directly behind it.', () => [
    impact('Impaling thrust', ['melee_generic.piercing.one_handed', 'melee_generic.slash.02.001.blue'], { stageId: 'ifn-hit', delay: 350, duration: 1300, targetStagger: 150 }),
    motion('lunge', 'source', { delay: 100, duration: 900, distance: 0.3, intensity: 0.7 }),
    motion('recoil', 'targets', { after: 'ifn-hit', anchor: 'start', offset: 250, duration: 650, intensity: 0.5 }),
  ], ab('spear')),

  'pf2e:guSjEQS3WuXJqQxf': design('Impaling Thrust: a raging piercing thrust skewers the foe and holds it on your weapon, blood welling.', () => [
    impact('Impale', ['melee_generic.piercing.two_handed', 'melee_generic.slash.02.001.blue'], { stageId: 'it-hit', delay: 350, duration: 1500 }),
    impact('Blood wells', ['liquid.splash_side.red', 'liquid.splash_side02.red'], { after: 'it-hit', anchor: 'start', offset: 450, duration: 1200, scale: 0.5 }),
    motion('lunge', 'source', { delay: 100, duration: 1000, distance: 0.3, intensity: 0.7 }),
  ], ab('spear')),

  'pf2e:YeyOqNFKaeuOTiJr': design('Impassable Wall Stance: you set your guard like a rampart that foes cannot slip past.', () => [
    cast('Set guard', ['impact.005.white', 'impact.005.orange'], { stageId: 'iw-c', scale: 0.8, duration: 1000 }),
    aura('Rampart', ['markers.shield_rampart.complete.03.white', 'markers.shield_rampart.complete.01.orange'], { after: 'iw-c', anchor: 'start', offset: 300, duration: 2400, scale: 1, fadeOut: 400 }),
    motion('brace', 'source', { after: 'iw-c', anchor: 'start', duration: 1000, intensity: 0.5 }),
  ], ab('shieldRaise')),

  'pf2e:KdKkLGcUYOpI0deP': design('Impenetrable Fog: a chaotic, swirling fog bank condenses thick around the chosen point.', () => [
    cast('Condense', ['cast_generic.water.02.blue'], { stageId: 'ifg-c', scale: 0.7, duration: 1000 }),
    impact('Fog bank', ['fog_cloud.01.white', 'fog_cloud.01.white'], { after: 'ifg-c', anchor: 'start', offset: 500, duration: 3200, scale: 1.6, opacity: 0.85, fadeIn: 400, fadeOut: 800, ...spin(9000, 1) }),
  ], { sound: 'water' }),

  'pf2e:fLrwddS607eRFfHA': design('Implausible Infiltration: you find tiny imperfections and slip bodily through the wall or floor.', () => [
    cast('Slip through', ['smoke.puff.ring.01.white', 'smoke.puff.ring.01.white'], { stageId: 'ii-c', scale: 0.6, duration: 1100 }),
    motion('flicker', 'source', { stageId: 'ii-fl', delay: 100, duration: 700, intensity: 0.5 }),
    motion('rush', 'source', { after: 'ii-fl', anchor: 'start', offset: 300, duration: 1600, distance: 1.2, intensity: 0.35, motionRange: 'distance', motionHeading: 'toward', motionEndpoint: 'near' }),
    sprite('Squeezing afterimage', { after: 'ii-fl', anchor: 'start', offset: 300, duration: 1200 }),
  ], { fx: false }),

  'pf2e:OqHfUQQorVBkx34j': design('Impossible Flurry: three Strikes with each weapon in a blur, six blows alternating hands.', () => [
    impact('Right-hand strikes', ['melee_generic.slash.02.001.orange', 'melee_generic.slash.02.001.blue'], { stageId: 'ifl-r', delay: 300, duration: 900, repeats: 3, repeatInterval: 500 }),
    impact('Left-hand strikes', ['melee_generic.slash.02.002.orange', 'melee_generic.slash.02.002.blue'], { delay: 550, duration: 900, mirrorX: true, repeats: 3, repeatInterval: 500 }),
    motion('lunge', 'source', { delay: 150, duration: 900, distance: 0.2, intensity: 0.6, repeats: 3, repeatInterval: 500 }),
    motion('shake', 'targets', { delay: 500, duration: 1500, intensity: 0.4 }),
  ]),

  'pf2e:NY2AkQscVIHEC8hQ': design('Impossible Volley: a single volley rains arrows over every foe in the burst.', () => [
    cast('Loose volley', ['wind_lines.01.01.white'], { stageId: 'iv-c', scale: 0.6, duration: 900 }),
    travel('Arcing arrows', ['arrow.physical.white.01', 'arrow.physical.white.01'], { stageId: 'iv-fly', delay: 300, duration: 1500 }),
    impact('Arrows rain', ['volley_of_projectiles_Circle.arrow.001.001.orangeyellow'], { after: 'iv-fly', anchor: 'start', offset: 600, duration: 2000, scale: 0.9, targetSelection: 'first' }),
    motion('recoil', 'source', { delay: 300, duration: 600, intensity: 0.4 }),
  ]),

  'pf2e:xT593tHyPkumPuzz': design('Improvised Repair: a few hasty wrench taps and sparks patch the broken item together.', () => [
    impact('Hasty patch', ['wrench.melee.01.white', 'wrench.melee.01.white'], { stageId: 'ir-w', delay: 200, duration: 1100, scale: 0.6, repeats: 2, repeatInterval: 600 }),
    impact('Shoddy fix holds', ['glint.yellow.few'], { after: 'ir-w', anchor: 'start', offset: 1300, duration: 1100, scale: 0.6 }),
  ], { sound: 'mending' }),

  'pf2e:1RQLf09kpOO6ljmb': design('In Lightning, Life: your Stasian coil delivers a gentle jolt that knits temporary vigor into the ally.', () => [
    cast('Coil charges', ['static_electricity.01.blue', 'static_electricity.01.blue'], { stageId: 'il-c', scale: 0.6, duration: 1000 }),
    travel('Gentle jolt', ['electric_arc.blue.01', 'electric_arc.01'], { stageId: 'il-arc', after: 'il-c', anchor: 'start', offset: 500, duration: 900 }),
    impact('Vigor', ['healing_generic.200px.blue', 'healing_generic.200px.blue'], { after: 'il-arc', anchor: 'start', offset: 500, duration: 1600, scale: 0.8 }),
    motion('shake', 'targets', { after: 'il-arc', anchor: 'start', offset: 300, duration: 600, intensity: 0.3 }),
  ], { sound: 'electricTouch' }),

  'pf2e:fCDC53WOOYrsyVIR': design('Incredible Ricochet: a second shot caroms around cover and strikes unerringly.', () => shot(['arrow.physical.white.01', 'arrow.physical.white.01'], ['impact.007.white', 'impact.007.orange'], { scale: 0.6 })),
  'pf2e:DGO6kyjw2bQG7dbY': design('Incredible Aim: a focused aim on the target, then one true shot.', () => shot(['arrow.physical.white.01', 'arrow.physical.white.01'], ['impact.005.white', 'impact.005.orange'], { scale: 0.7 })),

  'pf2e:v84501yLBubHlGPz': design('Indomitable Spirit: quintessence from countless rebirths envelops you and adjacent allies, hardening and quickening them.', () => [
    cast('Quintessence wells', ['spirit_guardians.dark_whiteblue.particles', 'spirit_guardians.blueyellow.ring'], { stageId: 'isp-c', scale: 0.8, duration: 1300 }),
    aura('Enveloping soul-light', ['spirit_guardians.dark_whiteblue.ring', 'spirit_guardians.blueyellow.ring'], { after: 'isp-c', anchor: 'start', offset: 600, duration: 2600, scale: 0.9, opacity: 0.8, fadeIn: 300, fadeOut: 600 }),
    motion('pulse', 'source', { after: 'isp-c', anchor: 'start', duration: 900, intensity: 0.5 }),
  ], { sound: 'spirit' }),

  'pf2e:dbqpcMp7RwYzT4Ec': design('Infernal Interference: two strikes with your favored weapon, each tearing a glimpse of Hell\'s fires across the foe.', () => [
    impact('First strike', ['melee_generic.slash.02.001.orange', 'melee_generic.slash.02.001.blue'], { stageId: 'ii-1', delay: 400, duration: 1100 }),
    impact('Second strike', ['melee_generic.slash.02.002.orange', 'melee_generic.slash.02.002.blue'], { stageId: 'ii-2', after: 'ii-1', anchor: 'start', offset: 650, duration: 1100, mirrorX: true }),
    impact('Glimpse of Hell', ['fumes.fire.orange', 'flames.01.orange'], { after: 'ii-2', anchor: 'start', offset: 400, duration: 1400, scale: 0.6, opacity: 0.85, ...tint('#b03a1a') }),
    motion('lunge', 'source', { delay: 100, duration: 900, distance: 0.2, intensity: 0.6, repeats: 2, repeatInterval: 650 }),
  ]),

  'pf2e:fklx5lSy6ZEI3sID': design('Infinite Expanse of Bluest Heaven: an illusory endless blue sky opens beneath the creatures, giving the sensation of falling forever.', () => [
    cast('Sky illusion', ['cast_generic.02.blue'], { stageId: 'ib-c', scale: 0.8, duration: 1100 }),
    impact('Bottomless sky', ['portals.horizontal.vortex.blue', 'portals.horizontal.ring.bright_yellow'], { stageId: 'ib-sky', after: 'ib-c', anchor: 'start', offset: 500, duration: 2800, scale: 1.2, below: true, opacity: 0.85, fadeIn: 400, fadeOut: 700, ...tint('#7ec8ff') }),
    impact('Rushing wind', ['wind_lines.01.01.white'], { after: 'ib-sky', anchor: 'start', offset: 400, duration: 1600, scale: 0.8, rotation: 90 }),
    motion('shake', 'targets', { after: 'ib-sky', anchor: 'start', offset: 500, duration: 1200, intensity: 0.35 }),
  ]),

  'pf2e:DaRfJsWAivah3a07': design("Infused with Belkzen's Might: your storied tattoos blaze and pour orc war-leader spirit into your weapons.", () => [
    cast('Tattoos blaze', ['markers.runes.dark_red', 'markers.runes.orange'], { stageId: 'ib-t', scale: 0.8, duration: 1400 }),
    aura('Spirit of conquest', ['energy_strands.overlay.orange', 'energy_strands.overlay.blue'], { after: 'ib-t', anchor: 'start', offset: 600, duration: 2000, scale: 1, opacity: 0.8, fadeIn: 300, fadeOut: 500, ...tint('#e07b2a') }),
    motion('pulse', 'source', { after: 'ib-t', anchor: 'start', duration: 900, intensity: 0.5 }),
  ]),

  'pf2e:FrHsGqUvq6GrugC4': design('Inhale, Exhale!: you draw an especially deep breath, swelling with the dragonet breath to come.', () => [
    cast('Deep breath', ['energy_strands.in.yellow', 'energy_strands.in.green'], { stageId: 'ie-in', scale: 0.8, duration: 1500, ...tint('#ffb347') }),
    aura('Breath held', ['fumes.fire.orange', 'flames.01.orange'], { after: 'ie-in', anchor: 'start', offset: 900, duration: 1400, scale: 0.4, offsetY: -0.3, offsetUnits: 'token', opacity: 0.7, fadeIn: 200, fadeOut: 400 }),
    motion('pulse', 'source', { delay: 200, duration: 1400, intensity: 0.6 }),
  ]),

  'pf2e:OY1Ewg0dbCp52Hl5': design('Inner Strength: you gather your rage and strength, burning away enfeeblement in a red surge.', () => [
    cast('Rage gathers', ['energy_strands.in.red', 'energy_strands.in.green'], { stageId: 'is-r', scale: 0.8, duration: 1200, ...tint('#c0392b') }),
    aura('Strength restored', ['on_token_buff.001.001.purplered'], { after: 'is-r', anchor: 'start', offset: 600, duration: 1800, scale: 1.1, opacity: 0.85, fadeIn: 200, fadeOut: 500 }),
    motion('pulse', 'source', { after: 'is-r', anchor: 'start', offset: 300, duration: 900, intensity: 0.6 }),
  ]),

  'pf2e:rm8NgrdZNjqpGlC1': design('Instigate Psychic Duel: a strand of thought links your mind to the target\'s, drawing both into a psychic duel.', () => [
    cast('Mind reaches', ['cast_shape.circle.01.purple', 'cast_shape.circle.01.blue'], { stageId: 'pd-c', scale: 0.8, duration: 1100 }),
    travel('Psychic link', ['energy_strands.range.standard.purple', 'energy_strands.range.standard.purple'], { stageId: 'pd-link', after: 'pd-c', anchor: 'start', offset: 500, duration: 1800 }),
    impact('Mindscape', ['extras.tmfx.runes.circle.simple.enchantment'], { after: 'pd-link', anchor: 'start', offset: 600, duration: 1800, scale: 0.9, opacity: 0.8, ...tint('#b06cff') }),
  ], { sound: 'psychic' }),

  // ── Lines 121-180 ──────────────────────────────────────────────────────
  'pf2e:MjPqgBQU9W4kelfz': design('Interrupt Charge: your free hand shoots out to snag the fleeing foe.', () => [
    impact('Snag', ['melee_generic.creature_attack.fist.001.yellow', 'melee_generic.creature_attack.fist.002.blue'], { stageId: 'ic-grab', delay: 250, duration: 1200, scale: 0.8 }),
    motion('lunge', 'source', { delay: 50, duration: 800, distance: 0.25, intensity: 0.6 }),
  ], ab('unarmed')),

  'pf2e:lkcM4V3VDAtjlR9P': design('Intimidating Strike: a brutal blow followed by a flare of dread that shatters the target\'s confidence.', () => [
    impact('Brutal blow', ['melee_generic.slashing.one_handed', 'melee_generic.slash.01.orange'], { stageId: 'is-hit', delay: 400, duration: 1400 }),
    impact('Confidence shatters', ['markers.fear.dark_red', 'markers.fear.dark_purple'], { after: 'is-hit', anchor: 'start', offset: 600, duration: 1500, scale: 0.6, offsetY: -0.5, offsetUnits: 'token', fadeIn: 200, fadeOut: 400 }),
    motion('lunge', 'source', { delay: 100, duration: 1000, distance: 0.25, intensity: 0.7 }),
  ]),

  'pf2e:MwjnRpVn3br88Caj': design('Intuitive Illusions: illusion magic flows effortlessly from you, renewing one of your ruses.', () => [
    cast('Illusion sustains', ['extras.tmfx.runes.circle.simple.illusion'], { stageId: 'ii-r', scale: 0.8, duration: 1300, opacity: 0.8, ...tint('#c08cff') }),
    aura('Shimmering ruse', ['shimmer.01.purple', 'shimmer.01.blue'], { after: 'ii-r', anchor: 'start', offset: 500, duration: 1800, scale: 1, opacity: 0.75, fadeIn: 300, fadeOut: 500 }),
  ]),

  'pf2e:SrSYEHqOLXWuj65e': design('Inventive Offensive: a few deft jury-rigging adjustments give your weapon an unexpected new trait.', () => [
    cast('Jury-rig', ['wrench.melee.01.orange', 'wrench.melee.01.white'], { stageId: 'io-w', scale: 0.6, offsetX: 0.4, offsetUnits: 'token', duration: 1100, repeats: 2, repeatInterval: 550 }),
    aura('Modified weapon', ['glint.yellow.many'], { after: 'io-w', anchor: 'start', offset: 1200, duration: 1200, scale: 0.6, offsetX: 0.4, offsetUnits: 'token' }),
  ], { sound: 'mending' }),

  'pf2e:iBdvNOWazhiXeUUa': design('Invoke Defense: spirit-hide and sturdy bark manifest around you during your trance.', () => [
    cast('Spirits gather', ['aura_themed.01.inward.complete.wood.01.green'], { stageId: 'id-c', scale: 0.9, duration: 1300 }),
    aura('Bark and hide', ['aura_themed.01.orbit.complete.wood.01.green'], { after: 'id-c', anchor: 'start', offset: 600, duration: 2200, scale: 1, opacity: 0.85, fadeOut: 500 }),
    motion('brace', 'source', { after: 'id-c', anchor: 'start', offset: 300, duration: 900, intensity: 0.5 }),
  ], { sound: 'spirit' }),

  'pf2e:7ZYw4SiBLBbbICNs': design('Invoke Movement: spirit wings or watery flow manifest, granting you a new way to move.', () => [
    cast('Spirit wings', ['swirling_feathers.outburst.01.blue', 'swirling_feathers.outburst.01.textured'], { stageId: 'im-c', scale: 0.9, duration: 1400 }),
    aura('Spirit locomotion', ['wind_lines.01.leaves.01.green', 'wind_lines.01.leaves.01.green'], { after: 'im-c', anchor: 'start', offset: 600, duration: 1800, scale: 0.8, opacity: 0.7 }),
    motion('levitate', 'source', { after: 'im-c', anchor: 'start', offset: 300, duration: 1800, intensity: 0.3 }),
  ], { sound: 'spirit' }),

  'pf2e:EEtezGRTZSHayQDR': design('Invoke Offense: a spectral claw of an animal spirit manifests as your new spirit-damage attack.', () => [
    cast('Spirits gather', ['spirit_guardians.blueyellow.particles', 'spirit_guardians.blueyellow.ring'], { stageId: 'iof-c', scale: 0.8, duration: 1300 }),
    cast('Spectral claws', ['claws.200px.bright_blue', 'claws.200px.red'], { after: 'iof-c', anchor: 'start', offset: 600, duration: 1100, scale: 0.7, ...tint('#8fd3ff') }),
    motion('pulse', 'source', { after: 'iof-c', anchor: 'start', offset: 400, duration: 900, intensity: 0.5 }),
  ], { sound: 'spirit' }),

  'pf2e:RmAl2BfBkFj8RC1S': design("Iomedae's Valor: on the brink of defeat, golden valor refuses to let you fall.", () => resolve('yellow', '#f2c94c')),
  'pf2e:DYayudEG8sZRB3Ot': design('Keep Up the Good Fight: your commitment to protect others keeps you standing, a ward flaring around you.', () => resolve('blue', null, { buff: 'blue' })),

  'pf2e:x9cYkB8DrUBBwqJd': design('Ironblood Stance: you enter the stance of impenetrable iron; a ring of steel settles around you.', () => [
    cast('Iron gathers', ['aura_themed.01.inward.complete.metal.01.grey'], { stageId: 'ib-c', scale: 0.9, duration: 1300 }),
    aura('Iron stance', ['aura_themed.01.orbit.complete.metal.01.grey'], { after: 'ib-c', anchor: 'start', offset: 600, duration: 2400, scale: 1, opacity: 0.85, fadeOut: 500 }),
    motion('brace', 'source', { after: 'ib-c', anchor: 'start', offset: 300, duration: 1000, intensity: 0.6 }),
  ], { sound: 'metal' }),

  'pf2e:79GUhBznFfYqdwgO': design('Irradiate: a sickly green aura of radiation pulses outward, making everyone nearby ill.', () => [
    cast('Radiation builds', ['fumes.toxic.green', 'fumes.04.complete.grey'], { stageId: 'ir-c', scale: 0.8, duration: 1200, ...tint('#7dff4a') }),
    aura('Radiation pulse', ['energy_field.01.green', 'energy_field.01.blue'], { after: 'ir-c', anchor: 'start', offset: 400, duration: 2600, scale: 2.4, opacity: 0.7, fadeIn: 300, fadeOut: 700, ...tint('#7dff4a') }),
    motion('pulse', 'source', { after: 'ir-c', anchor: 'start', duration: 1000, intensity: 0.5 }),
  ], { sound: 'poison' }),

  'pf2e:gltXysTfoyF1Ywoc': design('Irresistible Bloom: you burst into flowers and pleasant scent, and nearby creatures are drawn to you.', () => [
    cast('Bloom', ['swirling_leaves.outburst.01.pink', 'swirling_leaves.outburst.01.pink'], { stageId: 'ib-b', scale: 1.1, duration: 1500 }),
    aura('Flowers and scent', ['butterflies.loop.01.red', 'butterflies.loop.01.bluepurple'], { after: 'ib-b', anchor: 'start', offset: 500, duration: 2400, scale: 1.2, opacity: 0.85, fadeIn: 300, fadeOut: 600 }),
    aura('Irresistible', ['markers.heart.pink', 'markers.heart.pink'], { after: 'ib-b', anchor: 'start', offset: 900, duration: 1800, scale: 0.5, offsetY: -0.6, offsetUnits: 'token', fadeIn: 200, fadeOut: 400 }),
  ], { sound: 'growth' }),

  'pf2e:hPfqQpiq6W8RPCxz': design('It Was Me All Along!: your disguise is cast off in a dramatic puff and you stride toward your stunned foe.', () => [
    cast('Disguise discarded', ['smoke.puff.ring.01.multicolored', 'smoke.puff.ring.01.white'], { stageId: 'iw-reveal', scale: 0.9, duration: 1300 }),
    sprite('Old guise falls away', { after: 'iw-reveal', anchor: 'start', offset: 200, duration: 1000 }),
    motion('rush', 'source', { after: 'iw-reveal', anchor: 'start', offset: 600, duration: 1800, distance: 1.5, intensity: 0.35, motionRange: 'distance', motionHeading: 'toward', motionEndpoint: 'near' }),
  ]),

  'pf2e:9L6c9sxweM4IdOse': design('Jagged Berms: cube-shaped earth mounds heave up, sharpened wooden stakes jutting from their sides.', () => [
    cast('Earth and wood', ['cast_generic.earth.01.browngreen'], { stageId: 'jb-c', scale: 0.8, duration: 1100 }),
    impact('Mound rises', ['falling_rocks.top.1x1.sandstone', 'falling_rocks.top.1x1.grey'], { stageId: 'jb-m', after: 'jb-c', anchor: 'start', offset: 500, duration: 1600, scale: 0.9 }),
    impact('Stakes jut', ['spike_trap.05x05ft.top.holes.normal.01', 'spike_trap.05x05ft.top.holes.normal.01'], { after: 'jb-m', anchor: 'start', offset: 500, duration: 1500, scale: 1, ...tint('#8b5a2b') }),
  ]),

  'pf2e:dzPwwXHW5NzYGG5h': design("Jester's Gambol: a carefree fey whirl of sparkles and capering fairies settles around you.", () => [
    cast('Caper', ['swirling_sparkles.01.bluepink', 'swirling_sparkles.01.blue'], { stageId: 'jg-c', scale: 0.9, duration: 1300 }),
    aura('Fey frolic', ['fairies.loop.01.greenyellow', 'fairies.loop.01.bluepurple'], { after: 'jg-c', anchor: 'start', offset: 500, duration: 2200, scale: 1, opacity: 0.8, fadeIn: 300, fadeOut: 500 }),
    motion('spin', 'source', { after: 'jg-c', anchor: 'start', duration: 1000, intensity: 0.4 }),
  ]),

  'pf2e:GsICYVRwfcry2s6K': design("Jotun's Grasp: you Step in and seize the foe in giant hands to Grapple it.", () => [
    motion('rush', 'source', { stageId: 'jgr-step', delay: 100, duration: 700, distance: 1, intensity: 0.4, motionRange: 'target', motionHeading: 'toward', motionEndpoint: 'near' }),
    impact('Seize', ['melee_generic.creature_attack.fist.001.yellow', 'melee_generic.creature_attack.fist.002.blue'], { after: 'jgr-step', anchor: 'arrival', duration: 1200, scale: 1 }),
    motion('lunge', 'source', { after: 'jgr-step', anchor: 'arrival', duration: 800, distance: 0.2, intensity: 0.6 }),
  ], ab('unarmed')),

  'pf2e:RwOGkOLCalt4sqz6': design('Kaiju Stance: you swell to Large with the might of a kaiju, the earth shattering around your feet.', () => [
    cast('Earth shatters', ['impact.ground_crack.03.orange', 'impact.ground_crack.orange.03'], { stageId: 'ks-c', scale: 1, below: true, duration: 1500 }),
    aura('Kaiju might', ['ground_cracks.01.orange', 'ground_cracks.orange.01'], { after: 'ks-c', anchor: 'start', offset: 500, duration: 2400, scale: 1.6, below: true, opacity: 0.85, fadeOut: 600 }),
    motion('slam', 'source', { delay: 200, duration: 1000, intensity: 0.7 }),
  ], { sound: 'earthquake' }),

  'pf2e:ySeT8hrMEPF9AsQu': design('Kindle Inner Flames: you and allies in your aura shed faint, glowing embers.', () => [
    cast('Kindle', ['cast_generic.fire.01.orange'], { stageId: 'kf-c', scale: 0.8, duration: 1100 }),
    aura('Glowing embers', ['fireflies.many.01.orange', 'fireflies.many.01.green'], { after: 'kf-c', anchor: 'start', offset: 400, duration: 2600, scale: 1.4, opacity: 0.9, fadeIn: 300, fadeOut: 600, ...tint('#ff8a3d') }),
    motion('pulse', 'source', { after: 'kf-c', anchor: 'start', duration: 900, intensity: 0.4 }),
  ]),

  'pf2e:zknpo51jJndv68Ph': design('Kishin Rage: your eyes glow deep red, oni power crackles through your horns, and a roar demoralizes all around as you take to the air.', () => [
    cast('Red eyes', ['eyes.01.single.dark_red', 'eyes.01.dark_green.single'], { stageId: 'kr-eye', scale: 0.5, offsetY: -0.3, offsetUnits: 'token', duration: 1000, ...tint('#ff2020') }),
    cast('Roar', ['soundwave.01.red', 'soundwave.01.blue'], { stageId: 'kr-roar', after: 'kr-eye', anchor: 'start', offset: 500, duration: 1300, scale: 1.2, ...tint('#c0392b') }),
    aura('Runic power', ['static_electricity.03.dark_red', 'static_electricity.03.blue'], { after: 'kr-roar', anchor: 'start', offset: 300, duration: 2200, scale: 1, opacity: 0.85, fadeOut: 500 }),
    motion('levitate', 'source', { after: 'kr-roar', anchor: 'start', offset: 300, duration: 2000, intensity: 0.4 }),
  ], ab('growl')),

  'pf2e:h0gwBDI61MxkvVPC': design('Kneel Before the Rightful Heir: your regal command crashes over enemies as crushing mental pressure, demanding they bow.', () => [
    cast('Command', ['soundwave.02.purple', 'soundwave.02.blue'], { stageId: 'kb-c', scale: 1.1, duration: 1300 }),
    impact('Mental weight', ['impact.011.dark_purple', 'impact.blue'], { stageId: 'kb-hit', after: 'kb-c', anchor: 'start', offset: 600, duration: 1300, scale: 0.8 }),
    motion('press', 'targets', { after: 'kb-hit', anchor: 'start', duration: 1000, intensity: 0.4 }),
    motion('pulse', 'source', { after: 'kb-c', anchor: 'start', duration: 900, intensity: 0.5 }),
  ], { sound: 'psychic' }),

  'pf2e:pVLdMOqYwul745k3': design('Knockback: the weight of your swing drives the enemy back five feet.', () => [
    impact('Driving blow', ['impact.005.white', 'impact.005.orange'], { stageId: 'kb-hit', delay: 300, duration: 1100, scale: 0.8 }),
    motion('lunge', 'source', { delay: 0, duration: 900, distance: 0.25, intensity: 0.7 }),
    motion('dodge', 'targets', { after: 'kb-hit', anchor: 'start', offset: 150, duration: 700, distance: 1, intensity: 0.6, motionRange: 'distance', motionHeading: 'away', motionEndpoint: 'near' }),
  ], ab('club')),

  // ── Lines 181-240 ──────────────────────────────────────────────────────
  'pf2e:PPUNMjRLQYnmwQvF': design('Kobold Breath: you inhale and expel a torrent of draconic energy in a line at your foes (tinted to the chosen damage type when the roll names one).', () => [
    cast('Draw breath', ['energy_strands.in.yellow', 'energy_strands.in.green'], { stageId: 'kb-in', scale: 0.7, duration: 1000 }),
    travel('Breath torrent', ['breath_weapons.fire.line.orange', 'breath_weapons.fire.line.orange'], { stageId: 'kb-br', after: 'kb-in', anchor: 'start', offset: 600, duration: 2000, targetSelection: 'first' }),
    impact('Breath washes over', ['impact.001.orange', 'impact.005.orange'], { after: 'kb-br', anchor: 'start', offset: 700, duration: 1200, scale: 0.7 }),
    motion('lunge', 'source', { after: 'kb-in', anchor: 'start', offset: 500, duration: 900, distance: 0.15, intensity: 0.5 }),
  ], { sound: 'dragonRoar' }),

  'pf2e:aa8Qbo9D9WVeOGN5': design("Kraken's Call: lightless watery portals open beneath your foes and kraken tentacles surge up to grab them.", () => [
    cast('Call the deep', ['cast_generic.water.02.blue'], { stageId: 'kc-c', scale: 0.8, duration: 1100 }),
    impact('Abyssal portals', ['portals.horizontal.vortex.blue', 'portals.horizontal.ring.bright_yellow'], { stageId: 'kc-p', after: 'kc-c', anchor: 'start', offset: 500, duration: 2800, scale: 0.9, below: true, opacity: 0.9, fadeIn: 300, fadeOut: 600, ...tint('#1f4a7a') }),
    impact('Kraken tentacles', ['black_tentacles.dark_green', 'black_tentacles.dark_purple'], { after: 'kc-p', anchor: 'start', offset: 400, duration: 2400, scale: 0.8, fadeIn: 200, fadeOut: 500, ...tint('#2a6f8f') }),
    impact('Water surges', ['water_splash.circle.01.blue'], { after: 'kc-p', anchor: 'start', offset: 300, duration: 1600, scale: 0.7 }),
    motion('shake', 'targets', { after: 'kc-p', anchor: 'start', offset: 600, duration: 1000, intensity: 0.4 }),
  ], { sound: 'water' }),

  'pf2e:9O7DLcXVXpwLVXI6': design('Lassoing Lash: you whip your lash out and wrap it around the opponent to haul them in.', () => [
    travel('Lash wraps', ['energy_strands.range.standard.grey', 'energy_strands.range.standard.purple'], { stageId: 'll-lash', delay: 250, duration: 1300, ...tint('#8b6a43') }),
    impact('Coil', ['markers.chain.standard.complete.02.grey', 'markers.chain.standard.complete.02.red'], { after: 'll-lash', anchor: 'start', offset: 600, duration: 1500, scale: 0.7, ...tint('#8b6a43') }),
    motion('throw', 'source', { duration: 800, intensity: 0.5 }),
  ], ab('whip')),

  'pf2e:OFCeTaAX99YbXOu0': design('Lava Leap: wreathed in molten stone you Leap at the foe, a wave of lava crashing down where you land, cooling into a protective shell.', () => [
    cast('Molten wreath', ['shield_themed.below.molten_earth.01.orange', 'shield_themed.below.molten_earth.01.orange'], { stageId: 'lv-c', scale: 0.8, duration: 1200 }),
    motion('leap', 'source', { stageId: 'lv-leap', after: 'lv-c', anchor: 'start', offset: 400, duration: 1800, distance: 6, intensity: 0.65, motionRange: 'target', motionHeading: 'toward', motionEndpoint: 'near' }),
    cast('Lava wave crashes', ['lava_spout.001.001.complete.orangeyellow'], { stageId: 'lv-wave', after: 'lv-leap', anchor: 'arrival', duration: 2600, scale: 1.4 }),
    impact('Lava strikes', ['impact.fire.01.orange', 'fireball.explosion.orange'], { after: 'lv-leap', anchor: 'arrival', offset: 250, duration: 1300, scale: 0.6 }),
    aura('Cooling shell', ['shield_themed.above.molten_earth.01.orange'], { after: 'lv-wave', anchor: 'start', offset: 1000, duration: 2000, scale: 1, opacity: 0.85, fadeIn: 300, fadeOut: 500 }),
  ]),

  'pf2e:OZtoTusMmCJymObT': design('Leech-Clip: a flail swing wraps the deserter\'s legs to slow it down.', () => [
    impact('Flail swing', ['melee_attack.01.flail.01', 'melee_attack.01.flail.01'], { stageId: 'lc-hit', delay: 300, duration: 1400 }),
    motion('lunge', 'source', { delay: 100, duration: 900, distance: 0.2, intensity: 0.6 }),
  ], ab('flail')),

  'pf2e:7XA3Hm2md2tU9pEz': design('Left-Hand Blood: you cut yourself, and your blood turns the held weapon toxic green.', () => [
    cast('Self-cut', ['liquid.splash_side.red', 'liquid.splash_side02.red'], { stageId: 'lh-cut', scale: 0.5, duration: 1100 }),
    aura('Poisoned weapon', ['fumes.toxic.green', 'fumes.04.complete.grey'], { after: 'lh-cut', anchor: 'start', offset: 500, duration: 2000, scale: 0.5, offsetX: 0.35, offsetUnits: 'token', opacity: 0.85, fadeIn: 300, fadeOut: 500, ...tint('#7dcf5a') }),
    motion('recoil', 'source', { after: 'lh-cut', anchor: 'start', duration: 600, intensity: 0.3 }),
  ], { sound: 'poison' }),

  'pf2e:jIMeialR9CBo1bx9': design('Levering Strike: a staff blow that levers the foe off balance.', () => [
    impact('Staff blow', ['quarterstaff.melee.01.white', 'quarterstaff.melee.01.white'], { stageId: 'ls-hit', delay: 300, duration: 1400 }),
    motion('lunge', 'source', { delay: 100, duration: 900, distance: 0.2, intensity: 0.6 }),
    motion('stagger', 'targets', { after: 'ls-hit', anchor: 'start', offset: 450, duration: 800, intensity: 0.4 }),
  ], ab('staff')),

  'pf2e:aUhx6xKOhPuK9fEZ': design('Liberating Dive: steel-feathered wings sprout and propel you across the field, one wing slicing a foe while the other frees an ally.', () => [
    cast('Steel wings sprout', ['swirling_feathers.outburst.01.textured', 'swirling_feathers.outburst.01.textured'], { stageId: 'ld-w', scale: 1, duration: 1300, ...tint('#c1c6cc') }),
    motion('leap', 'source', { stageId: 'ld-fly', after: 'ld-w', anchor: 'start', offset: 400, duration: 2000, distance: 1.9, intensity: 0.4, motionRange: 'distance', motionHeading: 'toward', motionEndpoint: 'near' }),
    impact('Wing-edge slice', ['melee_generic.slash.01.bluepurple', 'melee_generic.slash.01.orange'], { after: 'ld-fly', anchor: 'start', offset: 900, duration: 1200, targetSelection: 'first', ...tint('#c1c6cc') }),
    impact('Restraints shorn', ['impact.005.white', 'impact.005.orange'], { after: 'ld-fly', anchor: 'start', offset: 1300, duration: 1100, scale: 0.6, targetSelection: 'secondary' }),
  ]),

  'pf2e:GabSQXUprub2eyUm': design('Lightning Rod: you smash a metal rod into the foe and call lightning down onto it.', () => [
    impact('Metal rod', ['spear.melee.01.white', 'spear.melee.01.white'], { stageId: 'lr-rod', delay: 300, duration: 1300, ...tint('#c1c6cc') }),
    impact('Lightning called', ['lightning_strike.blue', 'lightning_strike.blue'], { after: 'lr-rod', anchor: 'start', offset: 600, duration: 1300, scale: 0.8 }),
    impact('Crackle', ['static_electricity.01.blue', 'static_electricity.01.blue'], { after: 'lr-rod', anchor: 'start', offset: 900, duration: 1300, scale: 0.6 }),
    motion('lunge', 'source', { delay: 100, duration: 900, distance: 0.2, intensity: 0.6 }),
  ]),

  'pf2e:XkmrLhyAoxQTLnza': design('Lobbed Attack: a juggled thrown weapon is lobbed from the toss straight at the unsuspecting target.', () => [
    projectile('Lobbed weapon', ['dagger.throw.01.white', 'dagger.throw.01.white'], { stageId: 'la-t', delay: 300, duration: 1300 }),
    impact('Contact', ['impact.005.white', 'impact.005.orange'], { after: 'la-t', anchor: 'arrival', duration: 1000, scale: 0.6 }),
    motion('throw', 'source', { duration: 800, intensity: 0.5 }),
  ], ab('thrownDagger')),

  'pf2e:SiGvSOPQmZ0nyXVO': design('Lock Down: your Strike pins the enemy within your reach, a binding chain flaring on it.', () => [
    impact('Strike', ['melee_generic.slashing.one_handed', 'melee_generic.slash.01.orange'], { stageId: 'lk-hit', delay: 400, duration: 1400 }),
    impact('Locked in reach', ['markers.chain.standard.complete.02.grey', 'markers.chain.standard.complete.02.red'], { after: 'lk-hit', anchor: 'start', offset: 700, duration: 1500, scale: 0.7, opacity: 0.85 }),
    motion('lunge', 'source', { delay: 100, duration: 1000, distance: 0.2, intensity: 0.6 }),
  ]),

  'pf2e:aTI1r1RaZ1o0givR': design('Lonely Army: silent sling or blowgun shots from hiding, sneaking and reloading between up to three strikes.', () => [
    projectile('Silent shot', ['dart.01.throw.physical.white', 'arrow.physical.white.01'], { stageId: 'lo-s', delay: 200, duration: 1100, repeats: 3, repeatInterval: 900 }),
    impact('Contact', ['impact.005.white', 'impact.005.orange'], { after: 'lo-s', anchor: 'arrival', duration: 900, scale: 0.5, repeats: 3, repeatInterval: 900 }),
    motion('flicker', 'source', { delay: 1000, duration: 1800, intensity: 0.4 }),
  ], ab('blowgun', { fx: false })),

  'pf2e:k2L9p4cc8RrHufut': design("Look but Don't Touch: your blossoms exude a deadly toxin, petals and poison haze clinging to you.", () => [
    cast('Toxic bloom', ['swirling_leaves.outburst.01.pink', 'swirling_leaves.outburst.01.pink'], { stageId: 'lb-b', scale: 0.8, duration: 1300 }),
    aura('Poison haze', ['fumes.toxic.green', 'fumes.04.complete.grey'], { after: 'lb-b', anchor: 'start', offset: 500, duration: 2400, scale: 1, opacity: 0.7, fadeIn: 300, fadeOut: 600, ...tint('#8cd894') }),
    motion('pulse', 'source', { after: 'lb-b', anchor: 'start', duration: 900, intensity: 0.4 }),
  ], { sound: 'poison' }),

  'pf2e:Jk6gZzXEABiX5A0S': design('Loose Cannon: an unpredictable black-powder shot with a bright muzzle flash.', () => [
    cast('Muzzle flash', ['muzzle_flash.single.01.yellow', 'muzzle_flash.single.01.yellow'], { stageId: 'lc-mf', scale: 0.6, faceTarget: true, duration: 700 }),
    travel('Round', ['bullet.01.orange', 'bullet.01.orange'], { stageId: 'lc-b', delay: 100, duration: 1300 }),
    impact('Contact', ['impact.005.white', 'impact.005.orange'], { after: 'lc-b', anchor: 'arrival', duration: 1000, scale: 0.7 }),
    motion('recoil', 'source', { delay: 100, duration: 650, intensity: 0.6 }),
  ]),

  // ── Lines 241-295 ──────────────────────────────────────────────────────
  'pf2e:indcWWwZ2Mg7j9eB': design('Lose Your Chains: your rallying cry of rebellion rings out and the bound ally strains against their chains.', () => [
    cast('Cry of rebellion', ['soundwave.02.orangeyellow', 'soundwave.02.blue'], { stageId: 'lc-cry', scale: 0.8, duration: 1300 }),
    impact('Chains strain', ['markers.chain.standard.complete.02.grey', 'markers.chain.standard.complete.02.red'], { stageId: 'lc-ch', after: 'lc-cry', anchor: 'start', offset: 500, duration: 1400, scale: 0.7 }),
    impact('Bonds burst', ['impact.005.white', 'impact.005.orange'], { after: 'lc-ch', anchor: 'start', offset: 1000, duration: 1000, scale: 0.7 }),
    motion('shake', 'targets', { after: 'lc-ch', anchor: 'start', offset: 300, duration: 800, intensity: 0.4 }),
  ], ab('battleCry')),

  'pf2e:Xb8CyW9sYS27ElcC': design('Lucky Escape: at just the right moment you duck to pick up a shiny coin, and the attack may sail past.', () => [
    cast('Shiny distraction', ['glint.yellow.many'], { stageId: 'le-c', scale: 0.4, offsetY: 0.35, offsetUnits: 'token', duration: 1100 }),
    motion('cower', 'source', { after: 'le-c', anchor: 'start', offset: 200, duration: 1000, intensity: 0.4 }),
    cast('Lucky moment', ['twinkling_stars.points05.orange', 'twinkling_stars.points05.orange'], { after: 'le-c', anchor: 'start', offset: 600, duration: 1300, scale: 0.6 }),
  ]),

  'pf2e:5tlTRfyPXkGS9Coq': design('Lunging Spellstrike: spell energy unwinds your staff into an impossibly long reach for a magical blow.', () => [
    cast('Staff unwinds', ['energy_strands.overlay.purple', 'energy_strands.overlay.blue'], { stageId: 'lsp-c', scale: 0.7, duration: 1100 }),
    impact('Long staff blow', ['quarterstaff.melee.01.purple', 'quarterstaff.melee.01.white'], { stageId: 'lsp-hit', after: 'lsp-c', anchor: 'start', offset: 600, duration: 1400 }),
    impact('Spell discharges', ['impact.005.purple', 'impact.blue'], { after: 'lsp-hit', anchor: 'start', offset: 500, duration: 1300, scale: 0.8 }),
    motion('lunge', 'source', { after: 'lsp-c', anchor: 'start', offset: 400, duration: 1000, distance: 0.35, intensity: 0.7 }),
  ]),

  'pf2e:P8P5PwLgxk84bRQw': design('Luring Chomp: a charming glance lures the foe in close, then your jaws snap shut.', () => [
    impact('Lure', ['markers.heart.pink', 'markers.heart.pink'], { stageId: 'lch-l', delay: 100, duration: 1200, scale: 0.5, offsetY: -0.5, offsetUnits: 'token', fadeIn: 200, fadeOut: 300 }),
    impact('Chomp', ['bite.200px.red', 'bite.200px.red'], { after: 'lch-l', anchor: 'start', offset: 900, duration: 1100, scale: 0.9 }),
    motion('lunge', 'source', { after: 'lch-l', anchor: 'start', offset: 700, duration: 900, distance: 0.25, intensity: 0.7 }),
  ], ab('naturalPierce')),

  'pf2e:yzBlvtPcjhRHFvp0': design('Maelstrom Flow: you overload an improvised weapon with roiling rune energy that will soon consume it.', () => [
    cast('Overload', ['energy_strands.in.blue', 'energy_strands.in.green'], { stageId: 'mf-c', scale: 0.8, duration: 1200 }),
    aura('Overcharged weapon', ['static_electricity.02.blue', 'static_electricity.02.blue'], { after: 'mf-c', anchor: 'start', offset: 600, duration: 2000, scale: 0.6, offsetX: 0.35, offsetUnits: 'token', opacity: 0.85, fadeOut: 500 }),
    motion('shake', 'source', { after: 'mf-c', anchor: 'start', offset: 600, duration: 900, intensity: 0.3 }),
  ]),

  'pf2e:buUSr6Dh9md9WqJx': design("Mage's Field Dressing: glowing threads of arcane magic bind the ally's wounds as Battle Medicine.", () => [
    travel('Arcane threads', ['energy_strands.range.standard.purple', 'energy_strands.range.standard.purple'], { stageId: 'fd-th', delay: 200, duration: 1300 }),
    impact('Bandaged', ['healing_generic.200px.purple', 'healing_generic.200px.purple'], { after: 'fd-th', anchor: 'start', offset: 700, duration: 1800, scale: 0.8 }),
  ], { sound: 'healing' }),

  'pf2e:YJCAiNpFbX2MIc0G': design('Magnetic Field: a magnetic field surrounds you, metal motes orbiting in your aura.', () => [
    cast('Polarize', ['aura_themed.01.inward.complete.metal.01.grey'], { stageId: 'mfd-c', scale: 0.9, duration: 1300 }),
    aura('Magnetic field', ['aura_themed.01.orbit.complete.metal.01.teal', 'aura_themed.01.orbit.complete.metal.01.grey'], { after: 'mfd-c', anchor: 'start', offset: 500, duration: 2600, scale: 1.3, opacity: 0.85, fadeOut: 500 }),
    motion('pulse', 'source', { after: 'mfd-c', anchor: 'start', duration: 900, intensity: 0.4 }),
  ]),

  'pf2e:TYGrEiOjp6pDmgO2': design('Majestic Presence: your draconic bearing flares and lesser beings around you cower in fear.', () => [
    cast('Impressive stance', ['divine_smite.caster.dark_red', 'divine_smite.caster.blueyellow'], { stageId: 'mp-c', scale: 0.9, duration: 1300 }),
    aura('Draconic majesty', ['energy_field.02.below.yellow', 'energy_field.02.below.blue'], { after: 'mp-c', anchor: 'start', offset: 300, duration: 2000, scale: 2.2, below: true, opacity: 0.7, fadeOut: 500, ...tint('#d4a017') }),
    impact('Cowed', ['markers.fear.dark_red', 'markers.fear.dark_purple'], { after: 'mp-c', anchor: 'start', offset: 700, duration: 1500, scale: 0.6, offsetY: -0.5, offsetUnits: 'token', fadeIn: 200, fadeOut: 400 }),
    motion('cower', 'targets', { after: 'mp-c', anchor: 'start', offset: 800, duration: 1100, intensity: 0.35 }),
  ], { sound: 'fear' }),

  'pf2e:SWkeel82rdttxUD3': design('Majestic Proclamation: you announce your name and your constellation blazes, dazzling the enemies around you.', () => [
    cast('Constellation blazes', ['twinkling_stars.points08.white', 'twinkling_stars.points08.white'], { stageId: 'mpr-c', scale: 1.2, duration: 1500 }),
    cast('Blinding flare', ['impact.006.yellow', 'impact.yellow'], { stageId: 'mpr-f', after: 'mpr-c', anchor: 'start', offset: 600, duration: 1200, scale: 1.4 }),
    impact('Dazzled foes', ['twinkling_stars.points04.white', 'twinkling_stars.points04.white'], { after: 'mpr-f', anchor: 'start', offset: 200, duration: 1400, scale: 0.6 }),
    motion('cower', 'targets', { after: 'mpr-f', anchor: 'start', offset: 200, duration: 1000, intensity: 0.3 }),
  ], { sound: 'light' }),

  'pf2e:UcIyf7bTDf6RwydU': design('Makeshift Strike: you snatch up a nearby object and club the foe with it.', () => [
    impact('Improvised bash', ['melee_attack.02.club.01', 'melee_attack.02.club.01'], { stageId: 'ms-hit', delay: 400, duration: 1400 }),
    motion('lunge', 'source', { delay: 150, duration: 1000, distance: 0.2, intensity: 0.6 }),
  ], ab('club')),

  'pf2e:awSvRVuAYKrYMDhy': design('March of the Dead: your thrall horde shambles forward and clutches at the enemies it surrounds.', () => [
    cast('Command the horde', ['toll_the_dead.purple.skull_smoke', 'toll_the_dead.green.skull_smoke'], { stageId: 'md-c', scale: 0.8, duration: 1300 }),
    impact('Thralls close in', ['arms_of_hadar.dark_purple', 'arms_of_hadar.dark_purple'], { after: 'md-c', anchor: 'start', offset: 600, duration: 2200, scale: 0.8, fadeIn: 200, fadeOut: 500 }),
    motion('shake', 'targets', { after: 'md-c', anchor: 'start', offset: 1000, duration: 900, intensity: 0.3 }),
  ], { sound: 'summon' }),

  'pf2e:2WiNIIvUfNxQoZH7': design('March the Mines: you burrow through the earth with an ally following behind.', () => [
    cast('Earth opens', ['impact.ground_crack.01.orange'], { stageId: 'mm-c', scale: 0.7, below: true, duration: 1300 }),
    motion('sink', 'source', { stageId: 'mm-sink', delay: 200, duration: 900, intensity: 0.6 }),
    motion('rush', 'source', { after: 'mm-sink', anchor: 'start', offset: 500, duration: 2400, distance: 2, intensity: 0.35, motionRange: 'distance', motionHeading: 'toward', motionEndpoint: 'near' }),
    motion('rush', 'targets', { after: 'mm-sink', anchor: 'start', offset: 800, duration: 2400, distance: 2, intensity: 0.35, motionRange: 'distance', motionHeading: 'toward', motionEndpoint: 'near' }),
    aura('Tunnel trail', ['ground_cracks.01.orange', 'ground_cracks.orange.01'], { after: 'mm-sink', anchor: 'start', offset: 600, duration: 2000, scale: 0.7, below: true, fadeOut: 500 }),
  ], { sound: 'earth', fx: false }),

  'pf2e:fGwd5g6yHzcyeCG1': design("Martyr's Parry: you intercede with your parrying weapon, guarding your bonded partner.", () => [
    impact('Interceding guard', ['shield.01.complete.01.white', 'shield.01.complete.01.blue'], { stageId: 'mpa-s', delay: 200, duration: 1400, scale: 0.9 }),
    impact('Parry', ['impact.005.white', 'impact.005.orange'], { after: 'mpa-s', anchor: 'start', offset: 400, duration: 900, scale: 0.6 }),
    motion('brace', 'source', { delay: 100, duration: 1000, intensity: 0.5 }),
  ], ab('bladeParry')),

  'pf2e:KboQgBhYXI2WdCt8': design('Mask of Fear: your warmask burns off your face in a flash of flame, taking your fear with it.', () => [
    cast('Warmask burns away', ['flames.01.orange', 'fumes.fire.orange'], { stageId: 'mof-b', scale: 0.4, offsetY: -0.25, offsetUnits: 'token', duration: 1300 }),
    cast('Fear released', ['smoke.puff.centered.dark_black', 'smoke.puff.centered.grey'], { after: 'mof-b', anchor: 'start', offset: 600, duration: 1300, scale: 0.7 }),
    motion('shake', 'source', { after: 'mof-b', anchor: 'start', duration: 800, intensity: 0.4 }),
  ], { sound: 'fireIgnition' }),

  'pf2e:vxE9hBKB6F2ctOX3': design('Mask of Rejection: your warmask projects white-hot fury that tries to vaporize the offending magic.', () => [
    cast('White-hot fury', ['sacred_flame.source.white', 'sacred_flame.source.yellow'], { stageId: 'mr-c', scale: 0.8, duration: 1200 }),
    cast('Magic vaporized', ['impact.009.white', 'impact.yellow'], { after: 'mr-c', anchor: 'start', offset: 600, duration: 1100, scale: 1 }),
    motion('pulse', 'source', { after: 'mr-c', anchor: 'start', duration: 800, intensity: 0.5 }),
  ], { sound: 'dispel' }),

  'pf2e:EDdJFwarNIJIkP2E': design("Master's Counterspell: you expend a matching spell to unravel the foe's casting as it forms.", () => [
    cast('Counter-weave', ['magic_signs.circle.02.abjuration.complete.blue', 'cast_shape.circle.01.blue'], { stageId: 'mc-c', scale: 0.8, duration: 1300 }),
    travel('Counterspell', ['energy_strands.range.standard.blue', 'energy_strands.range.standard.purple'], { stageId: 'mc-tr', after: 'mc-c', anchor: 'start', offset: 500, duration: 1200 }),
    impact('Spell unravels', ['shatter.blue', 'shatter.blue'], { after: 'mc-tr', anchor: 'start', offset: 600, duration: 1300, scale: 0.8 }),
  ], { sound: 'dispel' }),

  'pf2e:BEqXsP6UqARzpEFD': design('Megaton Strike: hidden gears and explosives in your innovation drive a detonating blow.', () => [
    cast('Mechanisms engage', ['wrench.melee.01.orange', 'impact.orange'], { stageId: 'mg-c', scale: 0.5, duration: 800 }),
    impact('Heavy blow', ['melee_generic.bludgeoning.two_handed', 'melee_attack.03.maul.01'], { stageId: 'mg-hit', after: 'mg-c', anchor: 'start', offset: 500, duration: 1500, scale: 1.2 }),
    impact('Detonation', ['explosion.01.orange', 'explosion.01.orange'], { after: 'mg-hit', anchor: 'start', offset: 350, duration: 1200, scale: 0.5 }),
    motion('lunge', 'source', { after: 'mg-c', anchor: 'start', offset: 300, duration: 1000, distance: 0.25, intensity: 0.75 }),
    motion('stagger', 'targets', { after: 'mg-hit', anchor: 'start', offset: 400, duration: 850, intensity: 0.5 }),
  ], { sound: 'explosion' }),

  'pf2e:hlX7jYoS1s6srZC2': design('Megavolt: a damaging bolt of bled-off electric power lashes out in a line from your innovation.', () => [
    cast('Bleed off power', ['static_electricity.01.blue', 'static_electricity.01.blue'], { stageId: 'mv-c', scale: 0.8, duration: 1000 }),
    travel('Lightning line', ['lightning_bolt.wide.blue', 'lightning_bolt.wide.blue'], { stageId: 'mv-b', after: 'mv-c', anchor: 'start', offset: 500, duration: 1500 }),
    impact('Shock', ['impact.001.blue', 'impact.blue'], { after: 'mv-b', anchor: 'start', offset: 500, duration: 1200, scale: 0.8 }),
    motion('recoil', 'source', { after: 'mv-b', anchor: 'start', duration: 600, intensity: 0.4 }),
  ]),

  'pf2e:4F7suRtLfcurHqFI': design("Memory of Nothing: with a look and a gesture you turn the creature's mind against itself, fogging its memory of complex actions.", () => [
    cast('Gesture', ['cast_shape.circle.01.purple', 'cast_shape.circle.01.blue'], { stageId: 'mn-c', scale: 0.7, duration: 1100 }),
    impact('Mind turns inward', ['energy_strands.overlay.dark_purple', 'energy_strands.overlay.blue'], { stageId: 'mn-hit', after: 'mn-c', anchor: 'start', offset: 500, duration: 1800, scale: 0.9, ...tint('#b06cff') }),
    impact('Memory fog', ['smoke.puff.centered.dark_purple', 'smoke.puff.centered.grey'], { after: 'mn-hit', anchor: 'start', offset: 600, duration: 1300, scale: 0.6, offsetY: -0.4, offsetUnits: 'token' }),
  ], { sound: 'psychic' }),

  'pf2e:R7EaZPYtsy5H8lwn': design('Merciless Rend: the eidolon tears into the foe, ripping it with its secondary attack.', () => [
    impact('Rend', ['claws.400px.dark_red', 'claws.400px.red'], { stageId: 'mrd-hit', delay: 200, duration: 1200, scale: 0.9 }),
    impact('Torn flesh', ['liquid.splash_side02.red', 'liquid.splash_side.red'], { after: 'mrd-hit', anchor: 'start', offset: 400, duration: 1200, scale: 0.5 }),
    motion('recoil', 'targets', { after: 'mrd-hit', anchor: 'start', offset: 300, duration: 650, intensity: 0.5 }),
  ], ab('claw')),

  'pf2e:HbdOZ8YTtu8ykASc': design('Metal Carapace: sheets of bent, rusted metal clamp around you into an armored shell, a rusty steel shield forming in hand.', () => [
    cast('Metal gathers', ['aura_themed.01.inward.complete.metal.01.red', 'aura_themed.01.inward.complete.metal.01.grey'], { stageId: 'mcp-c', scale: 0.9, duration: 1300 }),
    aura('Rusted carapace', ['shield_themed.above.molten_earth.01.dark_orange', 'shield_themed.above.molten_earth.01.orange'], { after: 'mcp-c', anchor: 'start', offset: 600, duration: 2000, scale: 1, opacity: 0.8, fadeOut: 500, ...tint('#8a5a3c') }),
    motion('brace', 'source', { after: 'mcp-c', anchor: 'start', offset: 500, duration: 900, intensity: 0.5 }),
  ], { sound: 'metal' }),

  'pf2e:syyT2xBA4H72TpOt': design('Metallic Skin: thick elemental metal spreads over your skin, slowing you but turning blows.', () => [
    cast('Metal spreads', ['aura_themed.01.inward.complete.metal.01.grey'], { stageId: 'msk-c', scale: 0.9, duration: 1300 }),
    aura('Metal skin', ['shield.02.complete.01.white', 'shield.01.complete.01.blue'], { after: 'msk-c', anchor: 'start', offset: 600, duration: 1800, scale: 1, opacity: 0.8, ...tint('#c1c6cc') }),
    motion('brace', 'source', { after: 'msk-c', anchor: 'start', offset: 500, duration: 900, intensity: 0.5 }),
  ], { sound: 'metal' }),

  // ── Lines 296-350 ──────────────────────────────────────────────────────
  'pf2e:stwRJTOKUru9AmQC': design('Meteoric Spellstrike: a spell-charged shot streaks to the target and a trail of energy flows back along the line to you.', () => [
    cast('Spell loads the shot', ['energy_strands.in.purple', 'energy_strands.in.green'], { stageId: 'msp-c', scale: 0.7, duration: 1000 }),
    travel('Spell-charged shot', ['arrow.lightning.purple', 'arrow.physical.white.01'], { stageId: 'msp-fly', after: 'msp-c', anchor: 'start', offset: 500, duration: 1400 }),
    impact('Spell discharges', ['impact.001.pinkpurple', 'impact.blue'], { stageId: 'msp-hit', after: 'msp-fly', anchor: 'arrival', duration: 1200, scale: 0.9 }),
    travel('Energy trail returns', ['energy_beam.reverse.purple', 'energy_beam.normal.bluepink.02'], { after: 'msp-hit', anchor: 'start', offset: 200, duration: 1300, opacity: 0.7 }),
    motion('recoil', 'source', { after: 'msp-fly', anchor: 'start', duration: 600, intensity: 0.4 }),
  ]),

  'pf2e:xaSlCFYUXlu5f0zw': design('Mind Shards: your mind weapon detonates into a cone of psychic shards that shred the minds of those caught in it.', () => [
    cast('Mind weapon detonates', ['shatter.purple', 'shatter.blue'], { stageId: 'msh-c', scale: 0.7, duration: 1100 }),
    travel('Psychic shards', ['spell_projectile.ice_shard.blue', 'spell_projectile.ice_shard.blue'], { stageId: 'msh-fly', after: 'msh-c', anchor: 'start', offset: 400, duration: 1200, ...tint('#c08cff') }),
    impact('Mind shredded', ['impact.011.dark_purple', 'impact.blue'], { after: 'msh-fly', anchor: 'arrival', duration: 1200, scale: 0.8 }),
    motion('throw', 'source', { after: 'msh-c', anchor: 'start', duration: 800, intensity: 0.5 }),
  ], { sound: 'psychic' }),

  'pf2e:BSrYYphRONIkM19m': design('Mineral Deposits: precious metal surges from your blood to line your claws, jaws, or tail.', () => [
    cast('Metal surges', ['aura_themed.01.inward.complete.metal.01.grey'], { stageId: 'md-c', scale: 0.8, duration: 1300 }),
    aura('Metal-lined attack', ['glint.yellow.many'], { after: 'md-c', anchor: 'start', offset: 600, duration: 1500, scale: 0.7, ...tint('#d9dde2') }),
  ], { sound: 'metal' }),

  'pf2e:APfPNpUQlKlCAJkS': design('Miraculous Intervention: a burst of divine light foils the fiend or undead\'s reaction.', () => [
    cast('Whispered prayer', ['sacred_flame.source.yellow'], { stageId: 'mi-c', scale: 0.7, duration: 1000 }),
    impact('Divine interference', ['sacred_flame.target.yellow'], { after: 'mi-c', anchor: 'start', offset: 500, duration: 1500, scale: 0.8 }),
    motion('stagger', 'targets', { after: 'mi-c', anchor: 'start', offset: 800, duration: 700, intensity: 0.35 }),
  ], { sound: 'holy' }),

  'pf2e:fEzxwMCNyvooYqdn': design('Miraculous Repair: an echo of genie wish-magic sparkles over the damaged mechanism, making it work again.', () => [
    impact('Wish echo', ['swirling_sparkles.01.yellow', 'swirling_sparkles.01.blue'], { stageId: 'mrp-s', delay: 200, duration: 1600, scale: 0.7 }),
    impact('Mechanism mended', ['glint.yellow.many'], { after: 'mrp-s', anchor: 'start', offset: 900, duration: 1100, scale: 0.6 }),
  ], { sound: 'mending' }),

  'pf2e:Nb8iLgQeuHU73hQM': design('Mirror Refuge: a silvery mirror-plane opens and you melt into it, hiding behind the glass.', () => [
    cast('Mirror opens', ['portals.vertical.ring_masked.blue', 'portals.vertical.ring.bright_yellow'], { stageId: 'mr-p', scale: 0.8, duration: 2200, fadeIn: 200, fadeOut: 500, ...tint('#cfe8ff') }),
    cast('Reflection shimmer', ['shimmer.01.blue'], { after: 'mr-p', anchor: 'start', offset: 400, duration: 1500, scale: 1 }),
    motion('sink', 'source', { after: 'mr-p', anchor: 'start', offset: 600, duration: 1200, intensity: 0.5 }),
  ], { sound: 'pocketTransition' }),

  'pf2e:kQEIPYoKTt69yXxV': design("Mirror Shield: your raised shield catches the failed spell and hurls it back at its caster.", () => [
    cast('Spell caught', ['shield.01.complete.01.purple', 'shield.01.complete.01.blue'], { stageId: 'ms-c', scale: 0.9, duration: 1100 }),
    travel('Reflected spell', ['energy_beam.normal.purple.01', 'energy_beam.normal.bluepink.02'], { stageId: 'ms-b', after: 'ms-c', anchor: 'start', offset: 600, duration: 1500 }),
    impact('Spell returns', ['impact.001.pinkpurple', 'impact.blue'], { after: 'ms-b', anchor: 'start', offset: 700, duration: 1200, scale: 0.9 }),
    motion('brace', 'source', { duration: 900, intensity: 0.5 }),
  ], ab('shield')),

  'pf2e:h7KZXNRm1gLV1yTt': design('Mist Escape: as you fall, your body dissolves into mist that drifts toward your coffin.', () => [
    cast('Body mists', ['fog_cloud.01.white', 'fog_cloud.01.white'], { stageId: 'me-c', scale: 0.8, duration: 2200, fadeIn: 200, fadeOut: 600 }),
    motion('flicker', 'source', { after: 'me-c', anchor: 'start', offset: 200, duration: 900, intensity: 0.6 }),
    motion('drift', 'source', { after: 'me-c', anchor: 'start', offset: 900, duration: 1800, intensity: 0.4 }),
  ]),

  'pf2e:EOYxsteDMSSZovfV': design('Misty Transformation: wild mists billow around your changing form, concealing everything nearby.', () => [
    cast('Wild mists', ['fog_cloud.01.white', 'fog_cloud.01.white'], { stageId: 'mt-c', scale: 1.3, duration: 2600, fadeIn: 300, fadeOut: 700, ...spin(9000, 1) }),
    sprite('Shifting form', { after: 'mt-c', anchor: 'start', offset: 400, duration: 1200 }),
  ]),

  'pf2e:jCIBYryi6Y3JwmqH': design('Mixed Maneuver: one flowing martial-arts combination folds two maneuvers into a single motion.', () => [
    impact('First maneuver', ['melee_generic.creature_attack.fist.001.yellow', 'melee_generic.creature_attack.fist.002.blue'], { stageId: 'mx-1', delay: 300, duration: 1100, scale: 0.8 }),
    impact('Second maneuver', ['unarmed_strike.physical.01.yellow', 'unarmed_strike.physical.01.blue'], { after: 'mx-1', anchor: 'start', offset: 600, duration: 1100, scale: 0.8, mirrorX: true }),
    motion('lunge', 'source', { delay: 100, duration: 800, distance: 0.2, intensity: 0.5 }),
    motion('spin', 'source', { delay: 800, duration: 700, intensity: 0.3 }),
  ], ab('unarmed')),

  'pf2e:WlgaSpTSGQQrHKlx': design("Mockingbird's Disarm: tumbling past, you strike at the foe's wrist to loosen its grip.", () => [
    impact('Wrist strike', ['melee_generic.slash.02.001.blue', 'melee_generic.slash.02.001.blue'], { stageId: 'mk-hit', delay: 200, duration: 1000, scale: 0.7 }),
    impact('Grip loosens', ['impact.005.white', 'impact.005.orange'], { after: 'mk-hit', anchor: 'start', offset: 350, duration: 900, scale: 0.5 }),
    motion('roll', 'source', { delay: 0, duration: 900, distance: 0.6, intensity: 0.4, motionRange: 'distance', motionHeading: 'toward', motionEndpoint: 'near' }),
  ]),

  'pf2e:hO4sKslTrSQMLbGx': design('Mountain Quake: you stomp and the earth shakes violently around you.', () => [
    cast('Stomp', ['impact.ground_crack.03.orange', 'impact.ground_crack.orange.03'], { stageId: 'mq-c', scale: 1.1, below: true, duration: 1600 }),
    aura('Quake spreads', ['ground_cracks.03.orange', 'ground_cracks.orange.03'], { after: 'mq-c', anchor: 'start', offset: 300, duration: 2400, scale: 2.4, below: true, opacity: 0.85, fadeOut: 600 }),
    motion('slam', 'source', { duration: 900, intensity: 0.8 }),
  ], { sound: 'earthquake' }),

  'pf2e:n2hawNmzW7DBn1Lm': design('Mountain Stronghold: you call on the mountain and a rampart of stone rises to turn blows.', () => [
    cast('Call the mountain', ['impact.ground_crack.01.orange'], { stageId: 'msh2-c', scale: 0.7, below: true, duration: 1200 }),
    aura('Stone rampart', ['markers.shield_rampart.complete.01.orange', 'markers.shield_rampart.complete.01.orange'], { after: 'msh2-c', anchor: 'start', offset: 300, duration: 2000, scale: 1, fadeOut: 400 }),
    motion('brace', 'source', { duration: 1000, intensity: 0.6 }),
  ], { sound: 'earth' }),

  'pf2e:uBOToHKQJr5JBEsg': design("Mummy's Despair: your mental anguish pours outward as a dark, dusty aura of despair.", () => [
    cast('Anguish', ['toll_the_dead.grey.skull_smoke', 'toll_the_dead.green.skull_smoke'], { stageId: 'mud-c', scale: 0.8, duration: 1300 }),
    aura('Aura of despair', ['fumes.04.complete.black', 'fumes.04.complete.grey'], { after: 'mud-c', anchor: 'start', offset: 400, duration: 2800, scale: 2.4, opacity: 0.6, fadeIn: 400, fadeOut: 700, ...tint('#8a7a5a') }),
    impact('Despair grips', ['markers.fear.dark_purple', 'markers.fear.dark_purple'], { after: 'mud-c', anchor: 'start', offset: 900, duration: 1500, scale: 0.55, offsetY: -0.5, offsetUnits: 'token', optionalTargets: true }),
    motion('cower', 'targets', { after: 'mud-c', anchor: 'start', offset: 1000, duration: 1100, intensity: 0.3, optionalTargets: true }),
  ], { sound: 'fear' }),

  'pf2e:4Gl55zsGU6TkSKOJ': design('Musical Summons: your composition rings out and a summoned animal answers the call.', () => [
    cast('Composition', ['music_notations.beamed_quavers.blue', 'music_notations.beamed_quavers.blue'], { stageId: 'msu-c', scale: 0.8, duration: 1300 }),
    cast('Animal answers', ['misty_step.01.green', 'misty_step.01.blue'], { after: 'msu-c', anchor: 'start', offset: 700, duration: 1400, scale: 0.8, offsetX: 1, offsetUnits: 'token' }),
    aura('Song lingers', ['markers.music.greenorange', 'markers.music.greenorange'], { after: 'msu-c', anchor: 'start', offset: 400, duration: 2000, scale: 0.8, fadeOut: 500 }),
  ]),

  'pf2e:zqGSwbm3jM2JGAy5': design('My Kingdom, My Blood: you Stride, plant your weapon in the ground, and a vast crimson aura binds your life to your allies\'.', () => [
    motion('rush', 'source', { stageId: 'mk-mv', delay: 100, duration: 1400, distance: 1.6, intensity: 0.4, motionRange: 'distance', motionHeading: 'toward', motionEndpoint: 'near' }),
    cast('Planted in the earth', ['impact.ground_crack.02.dark_red', 'impact.ground_crack.01.orange'], { stageId: 'mk-plant', after: 'mk-mv', anchor: 'arrival', duration: 1400, scale: 0.8, below: true }),
    motion('slam', 'source', { after: 'mk-mv', anchor: 'arrival', duration: 800, intensity: 0.6 }),
    aura('Blood-bound aura', ['energy_strands.complete.dark_red', 'energy_strands.complete.blue'], { after: 'mk-plant', anchor: 'start', offset: 300, duration: 2600, scale: 2.2, opacity: 0.7, fadeIn: 300, fadeOut: 700, ...tint('#a0102a') }),
  ], { fx: false }),

  'pf2e:pkfa1pc72gOeyO4c': design('Mystical Flare: a torrent of magic fills the air around you with tiny, distracting explosions of light.', () => [
    cast('Torrent released', ['particle_burst.01.star.bluepurple', 'particle_burst.01.star.bluepurple'], { stageId: 'mfl-c', scale: 1, duration: 1300 }),
    aura('Flare bursts', ['firework.02.yellow', 'firework.02.yellow'], { after: 'mfl-c', anchor: 'start', offset: 300, duration: 1600, scale: 0.6, offsetX: -0.6, offsetUnits: 'token', repeats: 2, repeatInterval: 700 }),
    aura('Flare bursts 2', ['firework.01.bluepink', 'firework.01.yellow'], { after: 'mfl-c', anchor: 'start', offset: 650, duration: 1600, scale: 0.6, offsetX: 0.6, offsetY: -0.4, offsetUnits: 'token', repeats: 2, repeatInterval: 700 }),
    aura('Glittering haze', ['twinkling_stars.points06.white'], { after: 'mfl-c', anchor: 'start', offset: 400, duration: 2400, scale: 1.8, opacity: 0.8, fadeOut: 600 }),
  ], { sound: 'light' }),

  'pf2e:tB6V6rWv8vAFsKsX': design('Nanite Shroud: your nanites swarm out of your body into a glittering concealing cloud.', () => [
    cast('Nanites emerge', ['particles.outward.blue.01', 'particles.outward.greenyellow.01'], { stageId: 'ns-c', scale: 0.9, duration: 1300 }),
    aura('Nanite cloud', ['particles.swirl.blue.01', 'particles.swirl.greenyellow.01'], { after: 'ns-c', anchor: 'start', offset: 500, duration: 2600, scale: 1.3, opacity: 0.9, fadeIn: 300, fadeOut: 600 }),
  ]),

  'pf2e:JS24EjgLYcHB9E3T': design('Nanite Surge: your nanites stimulate your body and your circuitry glows, shedding dim light.', () => [
    cast('Nanites surge', ['particles.inward.blue.01', 'particles.inward.greenyellow.01'], { stageId: 'nsu-c', scale: 0.8, duration: 1200 }),
    aura('Circuitry glows', ['markers_scifi.001.complete.001.blueteal', 'markers.light.complete.blue'], { after: 'nsu-c', anchor: 'start', offset: 500, duration: 2000, scale: 1, opacity: 0.85, fadeOut: 500 }),
  ]),

  'pf2e:gYY7PfUk3nPXBiGF': design("Nature's Embrace: your waking world turns on your foes as plants grab, winds buffet and footing shifts.", () => [
    cast('World stirs', ['swirling_leaves.complete.01.green', 'swirling_leaves.complete.01.green'], { stageId: 'ne-c', scale: 1.2, duration: 1600 }),
    aura('Grasping growth', ['plant_growth.02.round.4x4.complete.greenred', 'plant_growth.03.round.4x4.complete.greenyellow'], { after: 'ne-c', anchor: 'start', offset: 400, duration: 2600, scale: 1.4, below: true, fadeOut: 600 }),
  ], { sound: 'vines' }),

  // ── Lines 351-405 ──────────────────────────────────────────────────────
  'pf2e:Pk6qGMlef5SMhhwE': design("Night's Warning: portents written in the night sky flash overhead and you slip aside from the attack.", () => [
    cast('Portents in the stars', ['twinkling_stars.points08.white', 'twinkling_stars.points08.white'], { stageId: 'nw-c', scale: 0.9, offsetY: -0.5, offsetUnits: 'token', duration: 1300 }),
    motion('dodge', 'source', { after: 'nw-c', anchor: 'start', offset: 400, duration: 900, distance: 0.35, intensity: 0.4, motionRange: 'distance' }),
  ]),

  'pf2e:nXbczPfLNbuosNLE': design('No Gods, Only Mortals!: you bellow at the divine caster to stop, and the spell shatters.', () => [
    cast('Order to stop', ['soundwave.02.red', 'soundwave.02.blue'], { stageId: 'ng-c', scale: 0.8, duration: 1200 }),
    impact('Divine spell shatters', ['shatter.orange', 'shatter.blue'], { after: 'ng-c', anchor: 'start', offset: 500, duration: 1300, scale: 0.8, ...tint('#f2c94c') }),
    motion('pulse', 'source', { after: 'ng-c', anchor: 'start', duration: 800, intensity: 0.5 }),
  ], ab('battleCry')),

  'pf2e:quqG3jfWFdopF0G2': design('No!!!: the shock of a fallen ally shatters your mental limits and psychic power spills out of you.', () => [
    cast('Limits break', ['shatter.purple', 'shatter.blue'], { stageId: 'no-c', scale: 0.9, duration: 1000 }),
    aura('Psyche unleashed', ['energy_strands.complete.purple', 'energy_strands.complete.blue'], { after: 'no-c', anchor: 'start', offset: 300, duration: 2400, scale: 1.4, opacity: 0.85, fadeOut: 600 }),
    motion('shake', 'source', { after: 'no-c', anchor: 'start', duration: 900, intensity: 0.6 }),
  ], { sound: 'psychic' }),

  'pf2e:B7VfoCspflTNfmde': design('Noble Bloom: you stand tall and bloom proudly, and the dying ally draws strength from your chrysanthemum radiance.', () => [
    cast('Proud bloom', ['swirling_leaves.outburst.01.greenorange', 'swirling_leaves.outburst.01.pink'], { stageId: 'nb-c', scale: 1, duration: 1400 }),
    impact('Strength to endure', ['healing_generic.200px.yellow', 'healing_generic.200px.yellow'], { after: 'nb-c', anchor: 'start', offset: 600, duration: 1700, scale: 0.8 }),
    motion('pulse', 'source', { after: 'nb-c', anchor: 'start', duration: 900, intensity: 0.4 }),
  ], { sound: 'growth' }),

  'pf2e:IAnUKY3QI8K32yJw': design('Now You See Me: you flash through several possible timelines as you move, leaving flickering echoes behind.', () => [
    cast('Timelines split', ['shimmer.01.purple', 'shimmer.01.blue'], { stageId: 'nysm-c', scale: 1, duration: 1100 }),
    sprite('Timeline echoes', { after: 'nysm-c', anchor: 'start', offset: 200, duration: 1600 }),
    motion('flicker', 'source', { after: 'nysm-c', anchor: 'start', offset: 100, duration: 900, intensity: 0.6 }),
    motion('rush', 'source', { after: 'nysm-c', anchor: 'start', offset: 600, duration: 2200, distance: 1.8, intensity: 0.3, motionRange: 'distance', motionHeading: 'toward', motionEndpoint: 'near' }),
  ], { fx: false }),

  'pf2e:1gtWb6lKWMw1Wp1q': design("Ocean's Balm: your touch carries the blessing of the living sea, salving wounds and dousing flames.", () => [
    impact('Living sea', ['water_splash.circle.01.blue', 'water_splash.circle.01.blue'], { stageId: 'ob-w', delay: 100, duration: 1500, scale: 0.7 }),
    impact('Wounds salved', ['cure_wounds.200px.blue', 'cure_wounds.200px.blue'], { after: 'ob-w', anchor: 'start', offset: 500, duration: 1800, scale: 0.8 }),
  ], { sound: 'waterHeal' }),

  'pf2e:0Ay5ZeuTkJFdfauC': design('Ocular Flesh: you shape a marble-sized fleshy eyeball that watches on your behalf.', () => [
    cast('Flesh shapes', ['liquid.blob.red', 'liquid.splash02.red'], { stageId: 'of-c', scale: 0.35, offsetX: 0.5, offsetUnits: 'token', duration: 1100 }),
    cast('Eyeball opens', ['eyes.01.single.dark_red', 'eyes.01.dark_green.single'], { after: 'of-c', anchor: 'start', offset: 600, duration: 1500, scale: 0.35, offsetX: 0.5, offsetUnits: 'token' }),
  ]),

  'pf2e:cexPKeX0kBKGd2TR': design('Oil Fire: your gauntlet joints split, dousing the grabbed foe in oil that bursts into flame.', () => [
    impact('Oil douses', ['liquid.splash.brown', 'liquid.splash.blue'], { stageId: 'oil-s', delay: 200, duration: 1100, scale: 0.6, ...tint('#5a4320') }),
    impact('Ignition', ['impact.fire.01.orange', 'impact.fire.01.orange'], { stageId: 'oil-f', after: 'oil-s', anchor: 'start', offset: 600, duration: 1200, scale: 0.8 }),
    impact('Burning', ['flames.01.orange', 'flames.01.orange'], { after: 'oil-f', anchor: 'start', offset: 300, duration: 1800, scale: 0.6, fadeOut: 500 }),
    motion('recoil', 'targets', { after: 'oil-f', anchor: 'start', duration: 650, intensity: 0.4 }),
  ]),

  'pf2e:H1kZ8nqvHlAazM35': design("On Borrowed Time: you accelerate the target's personal timestream, its form flickering with hurried echoes.", () => [
    cast('Temporal focus', ['magic_signs.circle.02.divination.complete.purple', 'cast_shape.circle.01.blue'], { stageId: 'obt-c', scale: 0.8, duration: 1300 }),
    impact('Timestream races', ['extras.tmfx.runes.circle.simple.transmutation'], { stageId: 'obt-hit', after: 'obt-c', anchor: 'start', offset: 600, duration: 1800, scale: 0.9, opacity: 0.85, ...tint('#c08cff'), ...spin(900, 1) }),
    sprite('Hurried echoes', { subject: 'targets', after: 'obt-hit', anchor: 'start', offset: 200, duration: 1200 }),
    motion('shake', 'targets', { after: 'obt-hit', anchor: 'start', offset: 200, duration: 1000, intensity: 0.3 }),
  ], { sound: 'time' }),

  'pf2e:OxdlGZ1rndxalf6X': design('One with the Spirits: spirit echoes manifest across your flesh, making you translucent and ghostly.', () => [
    cast('Spirits gather', ['spirit_guardians.dark_whiteblue.spirits', 'spirit_guardians.blueyellow.ring'], { stageId: 'ows-c', scale: 0.9, duration: 1600 }),
    aura('Ghostly form', ['shimmer.01.blue'], { after: 'ows-c', anchor: 'start', offset: 600, duration: 2000, scale: 1, opacity: 0.8 }),
    motion('pulse', 'source', { after: 'ows-c', anchor: 'start', offset: 300, duration: 900, intensity: 0.4 }),
  ], { sound: 'spirit' }),

  'pf2e:jaAnxfXVmUQy0IKU': design('One-Inch Punch: a tiny, perfectly controlled motion releases a mighty shockwave into the foe.', () => [
    impact('Controlled punch', ['unarmed_strike.physical.02.yellow', 'unarmed_strike.physical.02.blue'], { stageId: 'oip-hit', delay: 500, duration: 1100 }),
    impact('Shockwave', ['side_impact.part.shockwave.yellow', 'side_impact.part.shockwave.blue'], { after: 'oip-hit', anchor: 'start', offset: 250, duration: 1000, scale: 0.8 }),
    motion('lunge', 'source', { delay: 300, duration: 500, distance: 0.08, intensity: 0.9 }),
    motion('recoil', 'targets', { after: 'oip-hit', anchor: 'start', offset: 250, duration: 650, intensity: 0.7 }),
  ]),

  'pf2e:fD3RSV9nIkJsW6lD': design('One-Toed Hop: a peculiar stance, then a short vertical hop on each toe.', () => [
    cast('Hop', ['wind_lines.01.01.white'], { stageId: 'oth-c', scale: 0.5, rotation: -90, duration: 1100 }),
    motion('levitate', 'source', { delay: 100, duration: 1200, intensity: 0.4 }),
  ]),

  'pf2e:iCNNMJeGvsIzza4A': design('Oni Form: your horns flash and you swell to Large size with oni ferocity.', () => [
    cast('Horns flash', ['impact.003.dark_red', 'impact.004.blue'], { stageId: 'oni-c', scale: 0.5, offsetY: -0.4, offsetUnits: 'token', duration: 900 }),
    aura('Ferocious growth', ['shimmer.01.orange', 'shimmer.01.blue'], { after: 'oni-c', anchor: 'start', offset: 300, duration: 2000, scale: 1.45, opacity: 0.8, ...tint('#c0392b') }),
    motion('pulse', 'source', { after: 'oni-c', anchor: 'start', offset: 300, duration: 1200, intensity: 0.8 }),
  ], { sound: 'transform' }),

  'pf2e:Canug4VdAMqycpAJ': design('Oni Rampage: your own spilled blood invigorates you into hasted, furious speed.', () => [
    cast('Spilled blood', ['liquid.splash_side.red', 'liquid.splash_side02.red'], { stageId: 'or-b', scale: 0.5, duration: 1000 }),
    aura('Hasted fury', ['wind_lines.01.01.white'], { after: 'or-b', anchor: 'start', offset: 400, duration: 1800, scale: 0.9, opacity: 0.8, ...tint('#e05050') }),
    motion('shake', 'source', { after: 'or-b', anchor: 'start', offset: 300, duration: 900, intensity: 0.5 }),
  ]),

  'pf2e:lFc7HTNUCUemzSiV': design('Open the Blazing Eye: a lightless flame kindles on your forehead and your sight pierces the unseen.', () => [
    cast('Lightless flame', ['flames.purple.01', 'flames.01.orange'], { stageId: 'obe-c', scale: 0.3, offsetY: -0.35, offsetUnits: 'token', duration: 1600, ...tint('#3a1a5a') }),
    aura('Sight beyond', ['eyes.01.single.purple', 'eyes.01.dark_green.single'], { after: 'obe-c', anchor: 'start', offset: 500, duration: 1600, scale: 0.4, offsetY: -0.35, offsetUnits: 'token', fadeIn: 200, fadeOut: 400 }),
    aura('Unseen revealed', ['detect_magic.circle.purple', 'detect_magic.circle.blue'], { after: 'obe-c', anchor: 'start', offset: 700, duration: 1800, scale: 1, opacity: 0.6 }),
  ], { sound: 'detect' }),

  'pf2e:2LdncNMDNJW5Oeyu': design('Opportune Throw: you snatch a weapon from your juggle and hurl it at the creature as it acts.', () => [
    projectile('Thrown weapon', ['dagger.throw.01.white', 'dagger.throw.01.white'], { stageId: 'ot-t', delay: 150, duration: 1100 }),
    impact('Contact', ['impact.005.white', 'impact.005.orange'], { after: 'ot-t', anchor: 'arrival', duration: 900, scale: 0.6 }),
    motion('throw', 'source', { duration: 700, intensity: 0.5 }),
  ], ab('thrownDagger')),

  'pf2e:BVHDkBa4JMmmj5Sn': design('Opportunistic Grapple: you seize the opening and grab hold of your prey.', () => [
    impact('Seize', ['melee_generic.creature_attack.fist.001.yellow', 'melee_generic.creature_attack.fist.002.blue'], { stageId: 'og-g', delay: 200, duration: 1200 }),
    motion('lunge', 'source', { delay: 50, duration: 900, distance: 0.25, intensity: 0.6 }),
  ], ab('unarmed')),

  'pf2e:beGvN5LNWgaISMD8': design('Orbiting Runestone: you trace a rune on a stone that rises to orbit you as a floating guardian.', () => [
    cast('Trace rune', ['magic_signs.rune.02.complete.01.orange', 'icon.runes.orange'], { stageId: 'ors-c', scale: 0.6, duration: 1300 }),
    aura('Orbiting runestone', ['ioun_stones.01.red.intellect', 'ioun_stones.01.red.intellect'], { after: 'ors-c', anchor: 'start', offset: 600, duration: 2600, scale: 1, fadeIn: 300, fadeOut: 500, ...tint('#b98b5a') }),
  ], { sound: 'earth' }),

  'pf2e:PlhPpdwIV0rIAJ8K': design('Orc Ferocity: fierce blood refuses to let you fall; you stagger and stand back up with a roar.', () => [
    cast('Ferocity', ['impact.011.dark_red', 'impact.orange'], { stageId: 'of2-c', scale: 0.9, duration: 1100 }),
    aura('Refuse to fall', ['on_token_buff.001.001.purplered'], { after: 'of2-c', anchor: 'start', offset: 400, duration: 1800, scale: 1.1, opacity: 0.85, fadeOut: 500 }),
    motion('brace', 'source', { after: 'of2-c', anchor: 'start', duration: 1000, intensity: 0.6 }),
  ], ab('growl')),

  'pf2e:cbEodcnBKzx5ii3B': design("Orchard's Endurance: patches of bark spread over you and allies in your kinetic aura.", () => [
    cast('Bark spreads', ['aura_themed.01.inward.complete.wood.01.green'], { stageId: 'oe-c', scale: 0.9, duration: 1300 }),
    aura('Barkskin aura', ['aura_themed.01.orbit.complete.wood.01.green'], { after: 'oe-c', anchor: 'start', offset: 500, duration: 2600, scale: 1.4, opacity: 0.85, fadeOut: 600 }),
    motion('brace', 'source', { after: 'oe-c', anchor: 'start', offset: 300, duration: 900, intensity: 0.4 }),
  ]),

  // ── Lines 406-461 ──────────────────────────────────────────────────────
  'pf2e:W3w7iGGsdkfO1GOn': design('Pack of the Beast Lord: figment duplicates of your united companion swarm around it as it swells to Gargantuan size.', () => [
    cast('Call the pack', ['soundwave.01.orangeyellow', 'soundwave.01.blue'], { stageId: 'pbl-c', scale: 0.8, duration: 1200 }),
    impact('Figment swarm', ['spirit_guardians.greenorange.spirits', 'spirit_guardians.blueyellow.ring'], { stageId: 'pbl-sw', after: 'pbl-c', anchor: 'start', offset: 500, duration: 2600, scale: 1.6, opacity: 0.85, fadeIn: 300, fadeOut: 600 }),
    sprite('Duplicate figments', { subject: 'targets', after: 'pbl-sw', anchor: 'start', offset: 200, duration: 1600 }),
    motion('pulse', 'targets', { after: 'pbl-sw', anchor: 'start', offset: 400, duration: 1400, intensity: 0.9 }),
  ], ab('howl')),

  'pf2e:WRZZItgiMmpLnhdh': design('Pandemonium Eruption: pent-up protean chaos erupts around you in random bursts of acid, lightning and sound.', () => [
    cast('Chaos builds', ['energy_strands.complete.pinkyellow', 'energy_strands.complete.blue'], { stageId: 'pe-c', scale: 0.9, duration: 1100 }),
    aura('Eruption', ['explosion.03.purplepink', 'explosion.02.blue'], { stageId: 'pe-boom', after: 'pe-c', anchor: 'start', offset: 500, duration: 1600, scale: 1.8 }),
    aura('Lightning', ['static_electricity.03.yellow', 'static_electricity.03.blue'], { after: 'pe-boom', anchor: 'start', offset: 200, duration: 1600, scale: 1.8, opacity: 0.85 }),
    aura('Acid', ['liquid.splash.bright_green', 'liquid.splash.blue'], { after: 'pe-boom', anchor: 'start', offset: 400, duration: 1300, scale: 1.2, offsetX: -0.6, offsetUnits: 'token' }),
    aura('Sound', ['soundwave.02.purple', 'soundwave.02.blue'], { after: 'pe-boom', anchor: 'start', offset: 600, duration: 1300, scale: 1.6 }),
    motion('shake', 'source', { after: 'pe-c', anchor: 'start', duration: 1400, intensity: 0.5 }),
  ], { sound: 'explosion' }),

  'pf2e:hPDerDCYmag3s0dP': design("Paragon's Guard: you settle into a stance with your shield held perpetually raised.", () => [
    cast('Shield up', ['shield.01.intro.yellow', 'shield.01.intro.blue'], { stageId: 'pg-c', scale: 0.8, duration: 1000 }),
    aura('Ever-raised shield', ['markers.shield_rampart.complete.03.yellow', 'markers.shield_rampart.complete.01.orange'], { after: 'pg-c', anchor: 'start', offset: 400, duration: 2200, scale: 1, fadeOut: 400 }),
    motion('brace', 'source', { duration: 1000, intensity: 0.5 }),
  ], ab('shieldRaise')),

  'pf2e:uw6xu0H8vZLuizUf': design('Paralyzing Jewel: your head gem flares with waning moonlight, overwhelming nearby enemies with reverent wonder.', () => [
    cast('Head gem glows', ['markers.light_orb.complete.white', 'markers.light_orb.complete.blue'], { stageId: 'pj-c', scale: 0.4, offsetY: -0.35, offsetUnits: 'token', duration: 1300 }),
    aura('Moonlight wave', ['energy_field.02.below.blue', 'energy_field.02.below.blue'], { after: 'pj-c', anchor: 'start', offset: 500, duration: 2200, scale: 2, below: true, opacity: 0.7, fadeOut: 600, ...tint('#dfe8ff') }),
    aura('Reverent wonder', ['twinkling_stars.points06.white'], { after: 'pj-c', anchor: 'start', offset: 700, duration: 1800, scale: 1.6, opacity: 0.85 }),
  ]),

  'pf2e:7fyWKASX6uNByJF5': design('Pass Through: your form filters into the substance of an obstacle as you fly through it.', () => [
    cast('Form thins', ['shimmer.01.blue'], { stageId: 'pt-c', scale: 1, duration: 1200, ...tint('#e8eef6') }),
    motion('flicker', 'source', { after: 'pt-c', anchor: 'start', offset: 200, duration: 900, intensity: 0.5 }),
    motion('rush', 'source', { after: 'pt-c', anchor: 'start', offset: 600, duration: 2200, distance: 1.7, intensity: 0.15, motionRange: 'distance', motionHeading: 'toward', motionEndpoint: 'near' }),
    sprite('Phasing echo', { after: 'pt-c', anchor: 'start', offset: 600, duration: 1400 }),
  ], { fx: false }),

  'pf2e:KNPNjqMFd73Or8mV': design('Pattern Flight: your missile weaves an erratic runic pattern through the air before striking, tracing a rune.', () => [
    travel('Runic flight', ['ranged_helix.001.blue', 'ranged_helix.001.blue'], { stageId: 'pf-fly', delay: 300, duration: 1500, ...tint('#e0a050') }),
    impact('Arrival', ['impact.005.white', 'impact.005.orange'], { stageId: 'pf-hit', after: 'pf-fly', anchor: 'arrival', duration: 1000, scale: 0.6 }),
    impact('Rune traced', ['markers.runes.orange', 'markers.runes.orange'], { after: 'pf-hit', anchor: 'start', offset: 300, duration: 1600, scale: 0.5, offsetY: -0.5, offsetUnits: 'token', fadeIn: 200, fadeOut: 400 }),
    motion('recoil', 'source', { delay: 300, duration: 600, intensity: 0.4 }),
  ]),

  'pf2e:u2fgdFIdQDplKOS3': design('Peafowl Strut: two slow, graceful Steps and then a monk-sword Strike.', () => [
    motion('rush', 'source', { stageId: 'ps-step', delay: 100, duration: 1600, distance: 2, intensity: 0.3, motionRange: 'target', motionHeading: 'toward', motionEndpoint: 'near' }),
    impact('Graceful strike', ['melee_generic.slash.01.bluepurple', 'melee_generic.slash.01.orange'], { after: 'ps-step', anchor: 'arrival', duration: 1300 }),
    motion('lunge', 'source', { after: 'ps-step', anchor: 'arrival', duration: 800, distance: 0.2, intensity: 0.6 }),
    cast('Plumed poise', ['swirling_feathers.outburst.01.blue', 'swirling_feathers.outburst.01.textured'], { delay: 0, duration: 1300, scale: 0.6 }),
  ]),

  'pf2e:YlaLePtgDXGB0Fsf': design('Penetrating Fire: a single bullet punches through one foe and into the one behind it.', () => [
    cast('Muzzle flash', ['muzzle_flash.single.01.yellow', 'muzzle_flash.single.01.yellow'], { stageId: 'pfi-mf', scale: 0.6, faceTarget: true, duration: 700 }),
    travel('Penetrating round', ['bullet.Snipe.orange', 'bullet.Snipe.blue'], { stageId: 'pfi-b', delay: 100, duration: 1400, targetStagger: 150 }),
    impact('Punches through', ['impact.005.white', 'impact.005.orange'], { after: 'pfi-b', anchor: 'arrival', duration: 1000, scale: 0.7, targetStagger: 150 }),
    motion('recoil', 'source', { delay: 100, duration: 650, intensity: 0.6 }),
  ]),

  'pf2e:J2KKsWrNR2tMqLFB': design('Pennant of Victory: you wave your commander\'s banner in triumph and a golden surge of victory sweeps your allies.', () => [
    cast('Banner waves', ['wind_lines.01.01.white'], { stageId: 'pv-w', scale: 0.7, offsetY: -0.5, offsetUnits: 'token', duration: 1100 }),
    aura('Victory surge', ['bless.400px.intro.yellow'], { after: 'pv-w', anchor: 'start', offset: 400, duration: 2200, scale: 2, opacity: 0.8, fadeOut: 500 }),
    cast('Triumph', ['firework.01.orangeyellow', 'firework.01.orangeyellow'], { after: 'pv-w', anchor: 'start', offset: 700, duration: 1500, scale: 0.6, offsetY: -0.8, offsetUnits: 'token' }),
    motion('pulse', 'source', { after: 'pv-w', anchor: 'start', duration: 900, intensity: 0.5 }),
  ], ab('battleCry')),

  'pf2e:jFdCLA9X9WloBvv3': design("Peony's Flourish: you spin your fans in wide arcs, a mosaic of peony petals whirling around you as you move.", () => [
    cast('Fan arcs', ['swirling_leaves.outburst.01.pink', 'swirling_leaves.outburst.01.pink'], { stageId: 'pfl-c', scale: 1, duration: 1300 }),
    aura('Peony mosaic', ['swirling_leaves.loop.01.pink', 'swirling_leaves.loop.01.green'], { after: 'pfl-c', anchor: 'start', offset: 400, duration: 2800, scale: 1.2, opacity: 0.85, fadeOut: 600, ...spin(2500, 1) }),
    motion('spin', 'source', { after: 'pfl-c', anchor: 'start', duration: 1200, intensity: 0.6 }),
    motion('leap', 'source', { after: 'pfl-c', anchor: 'start', offset: 500, duration: 2600, distance: 2.2, intensity: 0.3, motionRange: 'distance', motionHeading: 'toward', motionEndpoint: 'near' }),
  ]),

  'pf2e:zrIrpVOvbGS6a3ux': design('Perfect Shot: after watching intently, you loose at the perfect moment for maximum pain.', () => shot(['arrow.physical.white.01', 'arrow.physical.white.01'], ['impact.007.white', 'impact.007.orange'], { scale: 0.8 })),

  'pf2e:hPanopG3TbXKr52O': design('Pesh Skin: your plant form bristles with hundreds of spines.', () => [
    cast('Spines sprout', ['ice_spikes.radial.burst.white', 'ice_spikes.radial.burst.white'], { stageId: 'pk-c', scale: 0.7, duration: 1400, ...tint('#7aa84a') }),
    aura('Spiny hide', ['aura_themed.01.orbit.complete.nature.01.green'], { after: 'pk-c', anchor: 'start', offset: 600, duration: 2000, scale: 1, opacity: 0.85, fadeOut: 500 }),
  ], { sound: 'thornWall' }),

  'pf2e:KnaKxKP3eCUcCZC7': design('Petrifying Gaze Mimicry: your medusa-like stare locks on the target and a grey stony stiffness creeps over it.', () => [
    cast('Petrifying stare', ['eyes.01.single.orangeyellow', 'eyes.01.dark_green.single'], { stageId: 'pgm-c', scale: 0.5, offsetY: -0.3, offsetUnits: 'token', duration: 1100 }),
    travel('Gaze', ['energy_beam.normal.yellow.01', 'energy_beam.normal.blue.01'], { stageId: 'pgm-g', after: 'pgm-c', anchor: 'start', offset: 500, duration: 1000, opacity: 0.6 }),
    impact('Stone creeps', ['impact.ground_crack.01.white', 'impact.ground_crack.01.orange'], { after: 'pgm-g', anchor: 'start', offset: 400, duration: 1500, scale: 0.6, below: true }),
    impact('Stiffening', ['smoke.puff.centered.grey', 'smoke.puff.centered.grey'], { after: 'pgm-g', anchor: 'start', offset: 500, duration: 1300, scale: 0.6 }),
  ], { sound: 'earth' }),

  'pf2e:BkEOwv3SRtefczpO': design('Phalanx Breaker: a heavy two-handed shot slams into the center of the enemy formation.', () => [
    cast('Muzzle flash', ['muzzle_flash.burst.01.yellow', 'muzzle_flash.single.01.yellow'], { stageId: 'pb-mf', scale: 0.7, faceTarget: true, duration: 800 }),
    travel('Heavy round', ['bullet.03.orange', 'bullet.03.blue'], { stageId: 'pb-b', delay: 100, duration: 1300 }),
    impact('Impact', ['impact.007.orange', 'impact.007.orange'], { after: 'pb-b', anchor: 'arrival', duration: 1100, scale: 0.8 }),
    motion('recoil', 'source', { delay: 100, duration: 800, intensity: 0.8 }),
  ]),

  'pf2e:nY8HtHNJMqP0hz3v': design('Phase Bullet: your round slips into extra dimensions, passing straight through barriers to the target.', () => [
    cast('Dimensional aim', ['portals.vertical.ring_masked.purple', 'portals.vertical.ring.bright_yellow'], { stageId: 'pbu-c', scale: 0.4, faceTarget: true, duration: 1100 }),
    travel('Phasing round', ['bullet.02.purple', 'bullet.02.orange'], { stageId: 'pbu-b', after: 'pbu-c', anchor: 'start', offset: 400, duration: 1400, opacity: 0.85 }),
    impact('Phases in', ['impact.001.pinkpurple', 'impact.blue'], { after: 'pbu-b', anchor: 'arrival', duration: 1100, scale: 0.8 }),
    motion('recoil', 'source', { after: 'pbu-b', anchor: 'start', duration: 600, intensity: 0.5 }),
  ]),

  'pf2e:axGS5bBJ9vl5AePc': design('Phase Out: your eidolon slips partly out of reality, flickering and translucent.', () => [
    impact('Phasing', ['shimmer.01.purple', 'shimmer.01.blue'], { stageId: 'po-c', delay: 100, duration: 1800, scale: 1, opacity: 0.85 }),
    motion('flicker', 'targets', { after: 'po-c', anchor: 'start', offset: 300, duration: 1200, intensity: 0.5 }),
  ]),

  'pf2e:18eGaH5rWEXpDlgk': design('Pierce the Eye: an exacting shot at the foe\'s eye draws a spurt of blood.', () => [
    ...shot(['arrow.physical.white.01', 'arrow.physical.white.01'], ['impact.005.white', 'impact.005.orange'], { aim: 'hunters_mark.loop.01.red', scale: 0.5 }),
    impact('Blood', ['liquid.splash_side.red', 'liquid.splash_side02.red'], { after: 'sh-fly', anchor: 'arrival', duration: 1100, scale: 0.4, offsetY: -0.25, offsetUnits: 'token' }),
  ]),

  'pf2e:4bKTV1UHBP3qSjzr': design('Piercing Doom: your Strike channels your doom into the foe as a flare of void energy.', () => [
    impact('Strike', ['melee_generic.slashing.one_handed', 'melee_generic.slash.01.orange'], { stageId: 'pd-hit', delay: 400, duration: 1400 }),
    impact('Doom channelled', ['impact.011.dark_purple', 'impact.blue'], { after: 'pd-hit', anchor: 'start', offset: 450, duration: 1200, scale: 0.7 }),
    motion('lunge', 'source', { delay: 100, duration: 1000, distance: 0.2, intensity: 0.6 }),
  ]),

  'pf2e:zvbS7gbB9tF7t3qH': design('Piercing Jab: your eidolon runs the enemy through with a horn and holds it there, blood welling.', () => [
    impact('Horn jab', ['melee_generic.piercing.one_handed', 'melee_generic.slash.02.001.blue'], { stageId: 'pj-hit', delay: 350, duration: 1400 }),
    impact('Blood wells', ['liquid.splash_side.red', 'liquid.splash_side02.red'], { after: 'pj-hit', anchor: 'start', offset: 450, duration: 1100, scale: 0.5 }),
    motion('lunge', 'source', { delay: 100, duration: 900, distance: 0.3, intensity: 0.7 }),
  ], ab('naturalPierce')),

  'pf2e:ZTxiM8NExDmxHJDf': design('Pin to the Spot: your Strike pins the target in place, restraining it.', () => [
    impact('Strike', ['melee_generic.slashing.one_handed', 'melee_generic.slash.01.orange'], { stageId: 'pts-hit', delay: 400, duration: 1400 }),
    impact('Pinned', ['markers.chain.standard.complete.02.grey', 'markers.chain.standard.complete.02.red'], { after: 'pts-hit', anchor: 'start', offset: 700, duration: 1500, scale: 0.7, opacity: 0.85 }),
    motion('lunge', 'source', { delay: 100, duration: 1000, distance: 0.2, intensity: 0.6 }),
  ]),

  'pf2e:AiV2xFhYB90KHt2x': design('Pinning Fire: two flurried piercing shots aim to pin the foe\'s clothing and flesh to the ground.', () => [
    travel('Two pinning shots', ['arrow.physical.white.01', 'arrow.physical.white.01'], { stageId: 'pf2-fly', delay: 200, duration: 1300, repeats: 2, repeatInterval: 400 }),
    impact('Pinned to the ground', ['impact.ground_crack.01.white', 'impact.ground_crack.01.orange'], { after: 'pf2-fly', anchor: 'arrival', duration: 1300, scale: 0.5, below: true }),
    motion('recoil', 'source', { delay: 200, duration: 600, intensity: 0.4 }),
  ], ab('bow')),

  'pf2e:RlKGaxQWWLa7xJSc': design('Pirouette: you spin gracefully on one foot, twirling away from the attack.', () => [
    cast('Twirl', ['wind_lines.01.leaves.01.pink', 'wind_lines.01.leaves.01.green'], { stageId: 'pir-c', scale: 0.7, duration: 1200, ...spin(1200, 1) }),
    motion('spin', 'source', { delay: 100, duration: 1000, intensity: 0.6 }),
    motion('dodge', 'source', { delay: 700, duration: 800, distance: 0.35, intensity: 0.4, motionRange: 'distance' }),
  ]),

  'pf2e:A2EBy2L4acrehiAA': design('Pistol Twirl: a flashy twirl of your loaded pistol distracts and wrong-foots the opponent.', () => [
    cast('Pistol twirl', ['glint.yellow.many'], { stageId: 'ptw-c', scale: 0.5, offsetX: 0.35, offsetUnits: 'token', duration: 1100, ...spin(800, 1) }),
    impact('Distracted', ['dizzy_stars.200px.yellow', 'dizzy_stars.200px.blueorange'], { after: 'ptw-c', anchor: 'start', offset: 600, duration: 1500, scale: 0.6 }),
    motion('spin', 'source', { delay: 100, duration: 900, intensity: 0.3 }),
  ]),

  'pf2e:yOyMlFGAgLfRas8m': design("Pistolero's Challenge: a stern call marks your foe as your dueling opponent.", () => [
    cast('Challenge issued', ['soundwave.01.orangeyellow', 'soundwave.01.blue'], { stageId: 'pc-c', scale: 0.7, duration: 1200 }),
    impact('Duel marked', ['hunters_mark.loop.01.red', 'hunters_mark.pulse.01.green'], { after: 'pc-c', anchor: 'start', offset: 500, duration: 1900, scale: 0.7, fadeIn: 200, fadeOut: 500 }),
    motion('pulse', 'source', { after: 'pc-c', anchor: 'start', duration: 800, intensity: 0.4 }),
  ], ab('gunshotAir')),

  'pf2e:0SbHdwYumvmzwWw3': design('Piston Punch: your dynamo extends like a piston, driving one punch through two foes in a row.', () => [
    impact('Piston punch', ['unarmed_strike.physical.02.orange', 'unarmed_strike.physical.02.blue'], { stageId: 'pp-hit', delay: 400, duration: 1200, targetStagger: 150 }),
    impact('Shockwave', ['side_impact.part.shockwave.yellow', 'side_impact.part.shockwave.blue'], { after: 'pp-hit', anchor: 'start', offset: 250, duration: 900, scale: 0.7, targetStagger: 150 }),
    motion('lunge', 'source', { delay: 150, duration: 900, distance: 0.3, intensity: 0.8 }),
    motion('recoil', 'targets', { after: 'pp-hit', anchor: 'start', offset: 250, duration: 650, intensity: 0.5 }),
  ]),

  'pf2e:RnxullWsNdbU7fuH': design('Pivot Strike: you vault on your staff and come down with a staff blow.', () => [
    motion('leap', 'source', { stageId: 'pvs-leap', delay: 100, duration: 1800, distance: 4, intensity: 0.5, motionRange: 'target', motionHeading: 'toward', motionEndpoint: 'near' }),
    impact('Staff blow', ['quarterstaff.melee.01.white', 'quarterstaff.melee.01.white'], { after: 'pvs-leap', anchor: 'arrival', duration: 1400 }),
    motion('lunge', 'source', { after: 'pvs-leap', anchor: 'arrival', duration: 800, distance: 0.2, intensity: 0.6 }),
  ], ab('staff')),

  'pf2e:HWLD3zGFBIjCDATo': design('Planar Sidestep: you shimmer with elemental energy as you shift between planes just as the blow lands.', () => [
    cast('Planar shimmer', ['shimmer.01.purple', 'shimmer.01.blue'], { stageId: 'psd-c', scale: 1, duration: 1300 }),
    cast('Elemental flicker', ['swirling_sparkles.01.orangepurple', 'swirling_sparkles.01.blue'], { after: 'psd-c', anchor: 'start', offset: 200, duration: 1300, scale: 0.8 }),
    motion('flicker', 'source', { delay: 100, duration: 900, intensity: 0.5 }),
  ]),

  'pf2e:xEeCaJsQeDtRAVk1': design('Plant Banner: you drive your banner into the ground and a rallying golden field spreads around it.', () => [
    cast('Banner planted', ['impact.ground_crack.01.white', 'impact.ground_crack.01.orange'], { stageId: 'plb-c', scale: 0.6, below: true, duration: 1200 }),
    aura('Hold the line', ['energy_field.02.below.yellow', 'energy_field.02.below.blue'], { after: 'plb-c', anchor: 'start', offset: 300, duration: 2600, scale: 2.4, below: true, opacity: 0.7, fadeOut: 600, ...tint('#f2c94c') }),
    motion('slam', 'source', { duration: 800, intensity: 0.5 }),
  ], ab('battleCry')),

  'pf2e:exrMKEHRyfINLJhV': design('Plate in Treasure: precious metal flows from your fingers and plates the chosen object in gleaming gold.', () => [
    impact('Metal flows', ['aura_themed.01.inward.complete.metal.01.grey'], { stageId: 'pit-c', delay: 100, duration: 1300, scale: 0.7, ...tint('#e0b84a') }),
    impact('Gilded', ['glint.yellow.many'], { after: 'pit-c', anchor: 'start', offset: 800, duration: 1300, scale: 0.7 }),
  ], { sound: 'metal' }),
};
