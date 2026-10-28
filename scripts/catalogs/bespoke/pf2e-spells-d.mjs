// Bespoke compositions (pf2e-spells-d). Keys: '<system>:<entryId>' or '<system>:<entryId>:<variant|mode>'.
// See scripts/catalogs/bespoke/helpers.mjs and scripts/bespoke.mjs.
import { cast, travel, projectile, impact, area, aura, sprite, motion, tint, spin, breathe, design } from './helpers.mjs';

// Shared touch-sting (Spider Sting / Widow's Bite / Wyvern Sting).
const sting = (scale = 1) => [
  motion('lunge', 'source', { stageId: 'st-lunge', duration: 700, intensity: 0.6 }),
  impact('Stinger stabs', ['melee_generic.piercing.one_handed', 'impact.003.blue'], { stageId: 'st-hit', after: 'st-lunge', anchor: 'start', offset: 380, duration: 1000, scale: 0.8 * scale, ...tint('#7fd04a') }),
  impact('Venom floods the wound', ['impact_themed.poison.greenyellow', 'icon.poison.dark_green'], { after: 'st-hit', anchor: 'start', offset: 250, duration: 1800, scale: 0.6 * scale, fadeOut: 400 }),
  aura('Toxic seep', ['fumes.toxic.green', 'fumes.04.complete.grey'], { subject: 'targets', after: 'st-hit', anchor: 'start', offset: 400, duration: 2000, scale: 0.8 * scale, opacity: 0.7, fadeIn: 300, fadeOut: 600, ...tint('#7fd04a') }),
  motion('recoil', 'targets', { after: 'st-hit', anchor: 'start', duration: 650, intensity: 0.5 }),
];

// Shared sky storm (Storm Lord / Wrathful Storm).
const skyStorm = (lightning = 'call_lightning.high_res.blue', extra = []) => [
  cast('Sky darkens', ['fog_cloud.01.white'], { stageId: 'sk-dark', duration: 900, scale: 1.1, opacity: 0.8, ...tint('#4a5466') }),
  area('Roiling storm clouds', ['fog_cloud.01.white'], { stageId: 'sk-cloud', after: 'sk-dark', anchor: 'start', offset: 400, duration: 4000, opacity: 0.75, fadeIn: 600, fadeOut: 900, ...tint('#5a6478') }),
  area('Lightning flashes', [lightning, 'call_lightning.high_res.blue'], { stageId: 'sk-bolt', after: 'sk-cloud', anchor: 'start', offset: 900, duration: 1600, scale: 0.6 }),
  area('Gales', ['wind_lines.01.01.white'], { after: 'sk-cloud', anchor: 'start', offset: 500, duration: 3000, opacity: 0.6, fadeIn: 300, fadeOut: 600 }),
  ...extra,
];

export default {
  // Shining Starlight Attack: constellation above the head, then a blast.
  'pf2e:yuhhRjqBzFgkKYrq': design('The constellation appears above your head while you brandish the sentinel weapon, then releases a starlit blast that strikes the enemies.', () => [
    cast('Constellation above head', ['twinkling_stars.points04.orange'], { stageId: 'ss-stars', duration: 2200, scale: 0.9, offsetY: -0.8, offsetUnits: 'token', fadeIn: 200, fadeOut: 400 }),
    cast('Sentinel weapon brandished', ['spiritual_weapon.longsword.01.flaming.yellow', 'spiritual_weapon.longsword.01.spectral.02.green'], { stageId: 'ss-blade', delay: 150, duration: 1400, scale: 0.6, fadeIn: 150, fadeOut: 300 }),
    motion('pulse', 'source', { delay: 150, duration: 800, intensity: 0.4 }),
    travel('Starlight blast', ['breath_weapons02.burst.line.holy.yellow.01', 'breath_weapons02.burst.line.fire.orange.01'], { stageId: 'ss-blast', after: 'ss-stars', anchor: 'start', offset: 1100, duration: 1800 }),
    impact('Dazzling flare', ['impact.007.yellow'], { after: 'ss-blast', anchor: 'end', offset: -250, duration: 1200, scale: 0.9 }),
    motion('recoil', 'targets', { after: 'ss-blast', anchor: 'end', offset: -250, duration: 650, intensity: 0.5 }),
  ], { sound: 'radiantRay' }),

  // Shipwreck: the vessel wrenches itself apart.
  'pf2e:5uWwusDkfmOOlZjK': design('The targeted vessel wrenches and splinters apart: a cracking shatter, debris spilling from its frame and a violent shudder.', () => [
    cast('Wrenching gesture', ['cast_generic.earth.01.browngreen'], { stageId: 'sw-cast', duration: 800, scale: 0.7 }),
    impact('Hull cracks apart', ['shatter.orange', 'shatter.blue'], { stageId: 'sw-crack', after: 'sw-cast', anchor: 'start', offset: 500, duration: 1500, scale: 1.2, ...tint('#9a6b3e') }),
    impact('Planks and debris spill', ['falling_rocks.side.2x1.sandstone', 'falling_rocks.side.2x1.grey'], { after: 'sw-crack', anchor: 'start', offset: 300, duration: 2000, scale: 0.9, ...tint('#8a5a32') }),
    motion('shake', 'targets', { after: 'sw-crack', anchor: 'start', duration: 1400, intensity: 0.9 }),
  ], { sound: 'earthquake' }),

  // Shock and Awe: illusory cannons, bullets and arrows across the burst.
  'pf2e:Y3qZrvZrqPuGJ2hk': design('An illusory battlefield erupts across the burst: volleys of arrows, illusory cannon blasts and smoke overwhelm enemies, who flinch in fear.', () => [
    cast('Illusion unfolds', ['particles.outward.purple.01.04', 'particles.outward.greenyellow.01.04'], { stageId: 'sa-cast', duration: 700, scale: 0.85 }),
    area('Illusory arrows and bullets', ['volley_of_projectiles_Circle.arrow.001.001.bluepurple', 'volley_of_projectiles_Circle.arrow.001.001.orangeyellow'], { stageId: 'sa-volley', after: 'sa-cast', anchor: 'end', duration: 2200 }),
    area('Illusory cannon blasts', ['explosion.01.purple', 'explosion.02.blue'], { stageId: 'sa-boom', after: 'sa-cast', anchor: 'end', offset: 300, duration: 1600, scale: 0.4, repeats: 3, repeatInterval: 350, offsetX: 0.3, ...tint('#b48cff') }),
    area('False smoke', ['smoke.puff.centered.dark_purple', 'smoke.puff.centered.grey'], { after: 'sa-boom', anchor: 'start', offset: 400, duration: 2000, scale: 0.5, opacity: 0.8, fadeOut: 600 }),
    motion('cower', 'targets', { after: 'sa-boom', anchor: 'start', offset: 500, duration: 1200, intensity: 0.6 }),
  ]),

  // Shock to the System: dense lightning cloud descends, then a revitalizing jolt.
  'pf2e:M5dp7ILSCKID9fDK': design('A dense storm cloud descends over the target and fires a revitalizing jolt of lightning into it, leaving a healing glow.', () => [
    cast('Sparks gather', ['static_electricity.01.blue'], { stageId: 'st-cast', duration: 700, scale: 0.7, ...tint('#ffe066') }),
    aura('Lightning cloud descends', ['fog_cloud.01.white'], { subject: 'targets', stageId: 'st-cloud', after: 'st-cast', anchor: 'end', duration: 2200, scale: 1.6, opacity: 0.85, fadeIn: 400, fadeOut: 500, offsetY: -0.3, offsetUnits: 'token', ...tint('#5d6a80') }),
    impact('Revitalizing jolt', ['lightning_strike.yellow', 'lightning_strike.blue'], { stageId: 'st-bolt', after: 'st-cloud', anchor: 'start', offset: 900, duration: 1500, scale: 1.8 }),
    aura('Life returns', ['healing_generic.loop.yellowwhite', 'healing_generic.loop.greenorange'], { subject: 'targets', after: 'st-bolt', anchor: 'start', offset: 200, duration: 1800, scale: 1.2, fadeIn: 200, fadeOut: 500 }),
    motion('stagger', 'targets', { after: 'st-bolt', anchor: 'start', duration: 600, intensity: 0.4 }),
  ]),

  // Shockwave: a wave of energy ripples through the earth in a cone.
  'pf2e:dgCH2E0gMLMUgyFl': design('You strike the ground and a shockwave ripples through the earth across the cone; creatures stumble as the ground shakes.', () => [
    motion('slam', 'source', { stageId: 'sh-slam', duration: 700, intensity: 0.7 }),
    impact('Ground struck', ['impact.ground_crack.01.orange'], { subject: 'source', after: 'sh-slam', anchor: 'start', offset: 350, duration: 1200, scale: 0.6 }),
    area('Earth ripples outward', ['template_cone_PF2e.001.002.orangeyellow', 'template_cone_PF2e.001.001.purplered'], { stageId: 'sh-wave', after: 'sh-slam', anchor: 'start', offset: 400, duration: 1800, opacity: 0.8, ...tint('#a07a4a') }),
    impact('Ground buckles under foes', ['impact.ground_crack.orange.02'], { after: 'sh-wave', anchor: 'start', offset: 500, duration: 1500, scale: 0.7 }),
    motion('stagger', 'targets', { after: 'sh-wave', anchor: 'start', offset: 500, duration: 800, intensity: 0.6 }),
  ]),

  // Sign of Conviction: holy symbol of force above you; you stand immovable.
  'pf2e:SxRVCc1Q2MtVuPMo': design('Your deity\'s symbol forms from pure force in the air above you while you plant yourself, immobile and warded.', () => [
    cast('Faith invoked', ['divine_smite.caster.standard.yellowwhite', 'divine_smite.caster.blueyellow'], { stageId: 'sc-cast', duration: 1200, scale: 0.8 }),
    aura('Religious symbol above', ['ward.star.yellow.01'], { stageId: 'sc-sym', after: 'sc-cast', anchor: 'start', offset: 500, duration: 3000, scale: 0.6, offsetY: -0.9, offsetUnits: 'token', fadeIn: 300, fadeOut: 600 }),
    aura('Steadfast ward', ['shield.01.complete.01.blue'], { after: 'sc-sym', anchor: 'start', offset: 300, duration: 2400, scale: 1, opacity: 0.6, fadeIn: 300, fadeOut: 500, ...tint('#ffe7a0') }),
    motion('brace', 'source', { after: 'sc-sym', anchor: 'start', duration: 900, intensity: 0.6 }),
  ], { sound: 'bless' }),

  // Skeleton Army: skeletal hulks rise from the dirt and rake foes.
  'pf2e:y1dcR5unn2UwlUR9': design('The ground splits as a legion of skeletal hulks claws up from the dirt across the area, raking enemies with bony hands.', () => [
    cast('Bones crushed in hand', ['cast_generic.01.dark_purple', 'cast_generic.01.yellow'], { stageId: 'sk-cast', duration: 700, scale: 0.7 }),
    area('Earth splits open', ['impact.ground_crack.purple.02', 'impact.ground_crack.orange.02'], { stageId: 'sk-crack', after: 'sk-cast', anchor: 'end', duration: 1800, ...tint('#7a6a5a') }),
    area('Bony hands claw upward', ['arcane_hand.purple'], { stageId: 'sk-hands', after: 'sk-crack', anchor: 'start', offset: 300, duration: 2200, scale: 0.7, fadeIn: 200, fadeOut: 500, ...tint('#e8e0cc') }),
    area('Skulls of the march', ['toll_the_dead.grey.skull_smoke', 'toll_the_dead.green.skull_smoke'], { after: 'sk-hands', anchor: 'start', offset: 400, duration: 2000, scale: 0.6 }),
    motion('stagger', 'targets', { after: 'sk-hands', anchor: 'start', offset: 600, duration: 800, intensity: 0.5 }),
  ], { sound: 'earthquake' }),

  // Slashing Gust: miniature air ripples slice one or two foes.
  'pf2e:1Yoipc5jNcMehtEW': design('You slash your hand through the air and blade-thin ripples of wind fly out to slice each target.', () => [
    cast('Hand slashes the air', ['wind_lines.01.02.white'], { stageId: 'sg-cast', duration: 600, scale: 0.7 }),
    travel('Ripples of air', ['ranged_slash.instant.001.white', 'ranged_slash.instant.001.blue'], { stageId: 'sg-fly', after: 'sg-cast', anchor: 'start', offset: 300, duration: 1200 }),
    impact('Air slices', ['melee_generic.slash.02.002.blue'], { after: 'sg-fly', anchor: 'end', offset: -250, duration: 900, scale: 0.8, ...tint('#e8f4ff') }),
    motion('recoil', 'targets', { after: 'sg-fly', anchor: 'end', offset: -250, duration: 600, intensity: 0.45 }),
  ]),

  // Slime Spit: toxic goo to the face.
  'pf2e:hWtB81P2KGzGHKAJ': design('You spit a glob of toxic goo that splatters across the target\'s face and eyes; it reels and wipes at the slime.', () => [
    motion('lunge', 'source', { stageId: 'sp-spit', duration: 500, intensity: 0.35 }),
    projectile('Glob of goo', ['liquid.blob.green', 'liquid.blob.blue'], { stageId: 'sp-glob', after: 'sp-spit', anchor: 'start', offset: 200, duration: 900, scale: 0.35, ...tint('#7fd04a') }),
    impact('Goo splatters the face', ['liquid.splash.green', 'liquid.splash.blue'], { stageId: 'sp-hit', after: 'sp-glob', anchor: 'end', offset: -250, duration: 1300, scale: 0.6, offsetY: -0.2, offsetUnits: 'token', ...tint('#7fd04a') }),
    aura('Toxic fumes', ['fumes.toxic.green', 'fumes.04.complete.grey'], { subject: 'targets', after: 'sp-hit', anchor: 'start', offset: 200, duration: 1800, scale: 0.7, opacity: 0.7, fadeOut: 500, ...tint('#7fd04a') }),
    motion('shake', 'targets', { after: 'sp-hit', anchor: 'start', duration: 700, intensity: 0.4 }),
  ], { sound: 'acidSplash' }),

  // Snake Fangs: jaw unhinges, fangs extend.
  'pf2e:wLWMswY7aBHEFTRb': design('Your jaw unhinges and venomous fangs extend; a serpent bite snaps in front of you as the morph takes hold.', () => [
    cast('Body morphs', ['cast_generic.02.dark_purple', 'cast_generic.02.blue'], { stageId: 'sf-cast', duration: 900, scale: 0.8, ...tint('#6f9a4f') }),
    aura('Fangs snap', ['bite.200px.green', 'bite.200px.red'], { stageId: 'sf-bite', after: 'sf-cast', anchor: 'start', offset: 500, duration: 1100, scale: 0.7, offsetY: -0.25, offsetUnits: 'token', ...tint('#9fd36a') }),
    aura('Venom drips', ['impact_themed.poison.greenyellow', 'icon.poison.dark_green'], { after: 'sf-bite', anchor: 'start', offset: 400, duration: 1400, scale: 0.4, fadeOut: 400 }),
    motion('pulse', 'source', { after: 'sf-cast', anchor: 'start', offset: 300, duration: 900, intensity: 0.5 }),
  ]),

  // Songbird's Call: a storm of songbirds whirls around you.
  'pf2e:CzMCiFbgLj1irnP4': design('Your song calls a storm of songbirds that whirls through the emanation in a flurry of feathers and birdsong, pecking at enemies.', () => [
    cast('Song rises', ['music_notations.beamed_quavers.purple', 'music_notations.beamed_quavers.blue'], { stageId: 'sb-cast', duration: 1100, scale: 0.6, offsetY: -0.5, offsetUnits: 'token' }),
    area('Whirling birds', ['swirling_feathers.outburst.01.textured'], { stageId: 'sb-birds', after: 'sb-cast', anchor: 'start', offset: 400, duration: 2600, scale: 1.1, ...spin(4000, 1) }),
    area('Birdsong', ['soundwave.01.orangeyellow', 'soundwave.01.blue'], { after: 'sb-birds', anchor: 'start', offset: 300, duration: 1500, opacity: 0.5 }),
    impact('Pecking', ['impact.002.orange', 'impact.002.blue'], { after: 'sb-birds', anchor: 'start', offset: 900, duration: 700, scale: 0.35, repeats: 3, repeatInterval: 300 }),
    motion('pulse', 'source', { after: 'sb-cast', anchor: 'start', duration: 900, intensity: 0.4 }),
  ]),

  // Spider Sting: touch that duplicates a spider's venomous sting.
  'pf2e:DYdvMZ8G2LiSLVWw': design('You reach out and stab the touched creature with a spider\'s venomous sting; venom spreads in the wound.', () => sting(0.8)),

  // Spike Stones: rock spikes thrust up across the burst.
  'pf2e:3xD8DYrr8YDVYGg7': design('Long, sharp spikes of solid rock thrust up from the ground across the whole burst, leaving it hazardous.', () => [
    cast('Earth answers', ['cast_generic.earth.01.browngreen'], { stageId: 'ss-cast', duration: 800, scale: 0.75 }),
    area('Ground cracks', ['impact.ground_crack.orange.02'], { stageId: 'ss-crack', after: 'ss-cast', anchor: 'end', duration: 1800 }),
    area('Stone spikes thrust up', ['ice_spikes.radial.burst.grey', 'ice_spikes.radial.burst.white'], { after: 'ss-crack', anchor: 'start', offset: 300, duration: 2400, scale: 1, ...tint('#8a6e4b') }),
    motion('pulse', 'source', { after: 'ss-cast', anchor: 'start', duration: 700, intensity: 0.4 }),
  ], { sound: 'earth' }),

  // Spirit Blast: ethereal energy attacks a creature's spirit.
  'pf2e:PHVHBbdHeQRfjLmE': design('You concentrate ethereal energy and it bursts inside the target\'s spirit in a flare of spectral light; the creature reels.', () => [
    cast('Ethereal energy gathers', ['particles.inward.blue.01.03', 'particles.inward.greenyellow.01.03'], { stageId: 'sb-cast', duration: 800, scale: 0.8, ...tint('#cfe8ff') }),
    impact('Spirit struck', ['divine_smite.target.blueyellow'], { stageId: 'sb-hit', after: 'sb-cast', anchor: 'end', duration: 1600, scale: 1.1 }),
    impact('Spectral echoes', ['spirit_guardians.blueyellow.no_ring', 'spirit_guardians.blueyellow.ring'], { after: 'sb-hit', anchor: 'start', offset: 200, duration: 2200, scale: 0.6, fadeIn: 200, fadeOut: 600 }),
    motion('stagger', 'targets', { after: 'sb-hit', anchor: 'start', offset: 150, duration: 700, intensity: 0.6 }),
  ]),

  // Spiritual Weapon: a force weapon appears beside the foe and strikes it.
  'pf2e:Fq9yCbqI2RDt6Orw': design('A ghostly weapon of force materializes beside the foe and strikes it.', () => [
    cast('Weapon summoned', ['glint.purple.few', 'glint.yellow.few'], { stageId: 'sw-cast', duration: 500, scale: 0.75 }),
    impact('Spectral weapon appears', ['spiritual_weapon.club.01.astral.01.purple', 'spiritual_weapon.club.01.spectral.02.green'], { stageId: 'sw-wpn', after: 'sw-cast', anchor: 'end', duration: 1700, scale: 0.8, offsetX: -0.5, offsetUnits: 'token', fadeIn: 200, fadeOut: 300 }),
    impact('Force strike', ['melee_attack.02.club', 'melee_attack.02.club.01'], { stageId: 'sw-hit', after: 'sw-wpn', anchor: 'start', offset: 650, duration: 1000, scale: 0.9, ...tint('#b48cff') }),
    impact('Force impact', ['impact.007.purple', 'impact.007.yellow'], { after: 'sw-hit', anchor: 'start', offset: 350, duration: 900, scale: 0.7 }),
    motion('recoil', 'targets', { after: 'sw-hit', anchor: 'start', offset: 350, duration: 650, intensity: 0.45 }),
  ]),

  // Spout: water blasts upward from the ground in the area.
  'pf2e:eSL5hVT9gXrnRLtd': design('Water blasts upward out of the ground in the target cube, buffeting the creatures standing there.', () => [
    cast('Water called', ['cast_generic.water.02.blue'], { stageId: 'so-cast', duration: 600, scale: 0.6 }),
    area('Geyser erupts', ['water_splash.circle.01.blue'], { stageId: 'so-burst', after: 'so-cast', anchor: 'end', duration: 1300, scale: 1.1 }),
    area('Spray falls back', ['liquid.splash.blue'], { after: 'so-burst', anchor: 'start', offset: 300, duration: 900 }),
    motion('levitate', 'targets', { after: 'so-burst', anchor: 'start', duration: 900, intensity: 0.4 }),
  ]),

  // Spray of Stars: a cone of tiny shooting stars.
  'pf2e:mlNYROcFrUF8nFgk': design('You fling a cone of tiny burning shooting stars; creatures in the cone are scorched and dazzled.', () => [
    cast('Stars in hand', ['twinkling_stars.points04.white'], { stageId: 'sp-cast', duration: 800, scale: 0.6 }),
    area('Shooting stars spray', ['breath_weapons02.burst.cone.holy.yellow.02', 'breath_weapons02.burst.cone.fire.orange.02'], { stageId: 'sp-cone', after: 'sp-cast', anchor: 'start', offset: 450, duration: 1800 }),
    area('Starlit sparks', ['twinkling_stars.points05.white'], { after: 'sp-cone', anchor: 'start', offset: 300, duration: 1600, scale: 0.8, fadeOut: 500 }),
    motion('cower', 'targets', { after: 'sp-cone', anchor: 'start', offset: 500, duration: 900, intensity: 0.4 }),
  ]),

  // Steal the Sky: flying target loses the air's support and drops.
  'pf2e:zoY0fQYTF1NzezTg': design('You deny a flying creature the air\'s support; a downdraft slams over it and drives it toward the ground.', () => [
    impact('Downdraft', ['wind_lines.01.02.white'], { stageId: 'sk-down', duration: 1200, scale: 1.1, rotation: 90 }),
    impact('Air collapses', ['template_circle.out_pulse.01.burst.bluewhite'], { after: 'sk-down', anchor: 'start', offset: 300, duration: 1200, scale: 0.6, opacity: 0.7 }),
    motion('press', 'targets', { after: 'sk-down', anchor: 'start', offset: 200, duration: 1100, intensity: 0.8 }),
  ], { sound: 'wind' }),

  // Stop Heart: a cruel grasp squeezes the heart.
  'pf2e:rwbL3oBniZZeJc2f': design('A spectral hand reaches into the opponent and squeezes its heart; void damage pulses and the creature doubles over.', () => [
    cast('Cruel grasp', ['arms_of_hadar.dark_purple'], { stageId: 'sh-cast', duration: 700, scale: 0.6 }),
    impact('Hand closes', ['arcane_hand.red'], { stageId: 'sh-hand', after: 'sh-cast', anchor: 'start', offset: 400, duration: 1800, scale: 0.6, fadeIn: 200, fadeOut: 400, ...tint('#5a1730') }),
    impact('Heart squeezed', ['icon.heart.dark_red', 'icon.heart.pink'], { after: 'sh-hand', anchor: 'start', offset: 500, duration: 1400, scale: 0.4, ...tint('#8a1f3a') }),
    impact('Void pulse', ['impact.011.dark_red', 'impact.011.blue'], { stageId: 'sh-pulse', after: 'sh-hand', anchor: 'start', offset: 900, duration: 900, scale: 0.7 }),
    motion('stagger', 'targets', { after: 'sh-pulse', anchor: 'start', duration: 800, intensity: 0.6 }),
  ]),

  // Storm Lord: sky darkens, ominous clouds and lightning across the area.
  'pf2e:XYhU3Wi94n1RKxTa': design('The sky darkens over the emanation, swirling with ominous clouds punctuated by flashes of lightning.', () => skyStorm('call_lightning.high_res.blue')),

  // Storm of Vengeance: massive storm cloud over a 360-ft burst (scene rain FX added on top).
  'pf2e:r4HLQcYwB62bTayl': design('A massive storm cloud forms over the burst, rain and gales sweeping beneath it as lightning lances down.', () => skyStorm('call_lightning.high_res.purple')),

  // Summon Dragon: a dragon answers the summons.
  'pf2e:kghwmH3tQjMIhdH1': design('A conjuration circle tears open a portal and a dragon emerges with a snap of its jaws and a gust of smoke.', () => [
    cast('Conjuration circle', ['magic_signs.circle.01.conjuration'], { stageId: 'sd-circle', duration: 1400, scale: 0.9 }),
    cast('Portal opens', ['portals.vertical.vortex.purple', 'portals.vertical.ring.bright_yellow'], { stageId: 'sd-portal', after: 'sd-circle', anchor: 'start', offset: 500, duration: 2400, scale: 1.4, fadeIn: 300, fadeOut: 500 }),
    cast('Dragon jaws snap', ['bite.400px.orange', 'bite.400px.red'], { after: 'sd-portal', anchor: 'start', offset: 1000, duration: 1100, scale: 0.8 }),
    cast('Smoke billows', ['smoke.puff.ring.01.white'], { after: 'sd-portal', anchor: 'start', offset: 1300, duration: 1500, scale: 1.2, opacity: 0.8 }),
  ], { sound: 'dragonRoar' }),

  // Stormburst: localized storm of lightning and wind, knocking foes prone.
  'pf2e:Ifc2b6bNVdjKV7Si': design('Your voice cracks like thunder and a localized storm of lightning and wind bursts over the area, knocking creatures off their feet.', () => [
    cast('Thunderous voice', ['soundwave.02.blue'], { stageId: 'sb-cast', duration: 900, scale: 0.8 }),
    area('Lightning surge', ['static_electricity.02.blue'], { stageId: 'sb-zap', after: 'sb-cast', anchor: 'start', offset: 500, duration: 1800 }),
    area('Thunderclap', ['thunderwave.center.blue'], { after: 'sb-zap', anchor: 'start', offset: 200, duration: 1500, scale: 0.9 }),
    area('Gale', ['wind_lines.01.01.white'], { after: 'sb-zap', anchor: 'start', duration: 2000, opacity: 0.7, fadeOut: 500 }),
    impact('Strikes', ['lightning_strike.blue'], { after: 'sb-zap', anchor: 'start', offset: 300, duration: 1200, scale: 1.2 }),
    motion('stagger', 'targets', { after: 'sb-zap', anchor: 'start', offset: 400, duration: 800, intensity: 0.7 }),
  ], { sound: 'lightningBolt' }),

  // Suffocate: breath forcibly drawn out of the lungs.
  'pf2e:qGWORxQ0aSsH2taf': design('You cruelly draw the breath out of the creature\'s lungs; air streams out of it and it chokes and doubles over.', () => [
    cast('Grasping gesture', ['particles.inward.white.02.03', 'particles.inward.greenyellow.02.03'], { stageId: 'su-cast', duration: 900, scale: 0.6, ...tint('#e8f4ff') }),
    impact('Breath torn out', ['particles.outward.white.02.03', 'particles.outward.greenyellow.02.03'], { stageId: 'su-air', after: 'su-cast', anchor: 'start', offset: 300, duration: 1600, scale: 0.7, ...tint('#e8f4ff') }),
    impact('Chest crushed', ['impact.012.blue'], { after: 'su-air', anchor: 'start', offset: 500, duration: 900, scale: 0.5, ...tint('#cfe0f0') }),
    motion('cower', 'targets', { after: 'su-air', anchor: 'start', offset: 300, duration: 1200, intensity: 0.6 }),
  ]),

  // Sunburst: a globe of searing sunlight explodes.
  'pf2e:a3aQxCpoj1q1NQxC': design('A powerful globe of searing sunlight explodes across the burst, scorching everything in blinding radiance.', () => [
    cast('Sunlight gathers', ['sacred_flame.source.yellow'], { stageId: 'su-cast', duration: 900, scale: 0.8 }),
    area('Globe of sunlight bursts', ['explosion.03.yellow', 'explosion.03.blueyellow'], { stageId: 'su-boom', after: 'su-cast', anchor: 'end', duration: 1800 }),
    area('Searing wave', ['template_circle.out_pulse.01.burst.yellowwhite', 'template_circle.out_pulse.01.burst.bluewhite'], { after: 'su-boom', anchor: 'start', offset: 150, duration: 1500, ...tint('#ffd36b') }),
    impact('Burning light', ['sacred_flame.target.yellow'], { after: 'su-boom', anchor: 'start', offset: 400, duration: 1500, scale: 0.8 }),
    motion('recoil', 'targets', { after: 'su-boom', anchor: 'start', offset: 300, duration: 700, intensity: 0.5 }),
  ], { sound: 'explosion' }),

  // Swampcall: terrain turns to mud and creatures sink.
  'pf2e:lbrWMnS2pecKaSVB': design('The soil churns into sodden mud across the burst and creatures sink partly into the morass.', () => [
    cast('Soil spirits stir', ['cast_generic.earth.01.browngreen'], { stageId: 'sw-cast', duration: 800, scale: 0.7 }),
    area('Ground turns to mud', ['liquid.splash.brown', 'liquid.splash.blue'], { stageId: 'sw-mud', after: 'sw-cast', anchor: 'end', duration: 1600, ...tint('#6b5a34') }),
    area('Earth churns', ['ground_cracks.03.orange'], { after: 'sw-mud', anchor: 'start', duration: 2400, opacity: 0.7, fadeOut: 600, ...tint('#5a4a2a') }),
    motion('sink', 'targets', { after: 'sw-mud', anchor: 'start', offset: 300, duration: 1200, intensity: 0.6 }),
  ], { sound: 'water' }),

  // Swarming Wasp Stings: disembodied stingers stab creatures.
  'pf2e:LVwmAH5NGvTuuQSU': design('A buzzing swarm of disembodied wasp stingers descends on the targets, stabbing them repeatedly and injecting venom.', () => [
    cast('Swarm conjured', ['particles.002.001.complete.many.orangeyellow', 'particles.002.001.complete.many.blue'], { stageId: 'ws-cast', duration: 900, scale: 0.8, ...tint('#e6c23a') }),
    aura('Stingers swarm', ['particles.002.001.complete.many.orangeyellow', 'particles.002.001.complete.many.blue'], { subject: 'targets', stageId: 'ws-swarm', after: 'ws-cast', anchor: 'start', offset: 500, duration: 2200, scale: 1.1, ...tint('#e6c23a') }),
    impact('Stings', ['impact.003.yellow', 'impact.003.blue'], { after: 'ws-swarm', anchor: 'start', offset: 300, duration: 600, scale: 0.3, repeats: 4, repeatInterval: 250 }),
    impact('Venom', ['impact_themed.poison.greenyellow', 'icon.poison.dark_green'], { after: 'ws-swarm', anchor: 'start', offset: 1300, duration: 1200, scale: 0.4 }),
    motion('shake', 'targets', { after: 'ws-swarm', anchor: 'start', offset: 300, duration: 1200, intensity: 0.4 }),
  ]),

  // Synaptic Pulse: pulsating mental blast stuns enemies.
  'pf2e:BilnTGuXrof9Dt9D': design('You emit a pulsating mental blast across the emanation; enemies\' minds are overloaded and they stand stunned.', () => [
    cast('Mind focuses', ['cast_shape.circle.01.purple', 'cast_shape.circle.01.blue'], { stageId: 'sp-cast', duration: 700, scale: 0.7 }),
    area('Mental pulse', ['template_circle.out_pulse.02.burst.purplepink', 'template_circle.out_pulse.02.burst.bluewhite'], { stageId: 'sp-pulse', after: 'sp-cast', anchor: 'end', duration: 1600 }),
    area('Second pulse', ['soundwave.01.purple', 'soundwave.01.blue'], { after: 'sp-pulse', anchor: 'start', offset: 400, duration: 1300, opacity: 0.7 }),
    impact('Stunned', ['dizzy_stars.200px.purple', 'dizzy_stars.200px.blueorange'], { after: 'sp-pulse', anchor: 'start', offset: 500, duration: 1800, scale: 0.5, offsetY: -0.35, offsetUnits: 'token' }),
    motion('stagger', 'targets', { after: 'sp-pulse', anchor: 'start', offset: 300, duration: 800, intensity: 0.5 }),
  ]),

  // Telekinetic Haul: target lifted and moved 20 ft.
  'pf2e:tpLTLbJUrYcMWGld': design('A telekinetic grip seizes the target and hauls it through the air, suspended.', () => [
    cast('Telekinetic focus', ['cast_shape.circle.01.purple', 'cast_shape.circle.01.blue'], { stageId: 'th-cast', duration: 600, scale: 0.7 }),
    impact('Unseen hand grips', ['arcane_hand.purple'], { stageId: 'th-hand', after: 'th-cast', anchor: 'end', duration: 2400, scale: 0.6, opacity: 0.7, fadeIn: 200, fadeOut: 500 }),
    aura('Lifting field', ['energy_field.02.below.purple', 'energy_field.02.below.blue'], { subject: 'targets', after: 'th-hand', anchor: 'start', duration: 2200, scale: 0.9, opacity: 0.6, below: true, fadeIn: 200, fadeOut: 500 }),
    motion('levitate', 'targets', { after: 'th-hand', anchor: 'start', offset: 200, duration: 1800, intensity: 0.6 }),
    motion('drift', 'targets', { after: 'th-hand', anchor: 'start', offset: 400, duration: 1600, intensity: 0.6 }),
  ]),

  // Telekinetic Maneuver: a rush of telekinetic power shoves/trips the foe.
  'pf2e:mrDi3v933gsmnw25': design('A rush of telekinetic force shoves the foe off balance (Disarm, Shove, Reposition or Trip).', () => [
    cast('Telekinetic thrust', ['glint.purple.few', 'glint.yellow.few'], { stageId: 'tm-cast', duration: 500, scale: 0.75 }),
    motion('lunge', 'source', { after: 'tm-cast', anchor: 'start', duration: 600, intensity: 0.3 }),
    impact('Force shove', ['arcane_hand.purple'], { stageId: 'tm-hand', after: 'tm-cast', anchor: 'end', duration: 1300, scale: 0.6, fadeOut: 300 }),
    impact('Force impact', ['impact.007.purple', 'impact.007.yellow'], { after: 'tm-hand', anchor: 'start', offset: 450, duration: 900, scale: 0.7 }),
    motion('stagger', 'targets', { after: 'tm-hand', anchor: 'start', offset: 450, duration: 800, intensity: 0.6 }),
  ]),

  // Telekinetic Rend: violent axis of motion smashes or severs.
  'pf2e:yyz029C9eqfY38PT': design('A violent axis of telekinetic motion whirls through the burst, smashing and slicing everything inside it.', () => [
    cast('Mind seizes the space', ['cast_shape.circle.01.purple', 'cast_shape.circle.01.blue'], { stageId: 'tr-cast', duration: 600, scale: 0.65 }),
    area('Telekinetic vortex', ['melee_generic.whirlwind.01.bluepurple', 'melee_generic.whirlwind.01.orange'], { stageId: 'tr-whirl', after: 'tr-cast', anchor: 'end', duration: 1400, ...tint('#b48cff') }),
    area('Rending impact', ['impact.012.purple', 'impact.012.blue'], { after: 'tr-whirl', anchor: 'start', offset: 450, duration: 900, scale: 0.8 }),
    motion('shake', 'targets', { after: 'tr-whirl', anchor: 'start', offset: 400, duration: 700, intensity: 0.5 }),
  ]),

  // Tempest Cloak: howling winds around the target.
  'pf2e:70BjbNRVc4OTLAgN': design('You shroud the creature in a cloak of fierce, howling winds that whirl around it and deflect missiles.', () => [
    cast('Winds called', ['wind_lines.01.02.white'], { stageId: 'tc-cast', duration: 600, scale: 0.7 }),
    aura('Howling wind cloak', ['whirlwind.bluewhite', 'whirlwind.bluegrey'], { subject: 'targets', stageId: 'tc-cloak', after: 'tc-cast', anchor: 'end', duration: 2800, scale: 0.9, opacity: 0.8, fadeIn: 300, fadeOut: 600 }),
    aura('Swirling gusts', ['wind_lines.01.01.white'], { subject: 'targets', after: 'tc-cloak', anchor: 'start', duration: 2400, scale: 1.3, opacity: 0.6, fadeIn: 300, fadeOut: 500, ...spin(2400, 1) }),
  ], { sound: 'wind' }),

  // Tempest Surge: swirling storm of wind, clouds and lightning around a foe.
  'pf2e:ho1jSoYKrHUNnM90': design('A swirling storm of violent wind, roiling cloud and crackling lightning surrounds the foe.', () => [
    cast('Storm conjured', ['static_electricity.02.blue'], { stageId: 'ts-cast', duration: 600, scale: 0.7 }),
    impact('Storm surrounds foe', ['whirlwind.blue', 'whirlwind.bluegrey'], { stageId: 'ts-storm', after: 'ts-cast', anchor: 'end', duration: 2600, scale: 1.2, fadeIn: 200, fadeOut: 500 }),
    impact('Lightning crackles', ['static_electricity.03.blue'], { after: 'ts-storm', anchor: 'start', offset: 400, duration: 1500, scale: 1.1 }),
    motion('shake', 'targets', { after: 'ts-storm', anchor: 'start', offset: 300, duration: 1100, intensity: 0.5 }),
  ]),

  // Tempest Touch: icy water clings to the touched target.
  'pf2e:EzB9i7R6aBRAtJCh': design('Your touch calls up a churning mass of icy water that clings to the target and freezes around its legs.', () => [
    motion('lunge', 'source', { stageId: 'tt-lunge', duration: 650, intensity: 0.5 }),
    impact('Icy water engulfs', ['liquid.splash.blue'], { stageId: 'tt-water', after: 'tt-lunge', anchor: 'start', offset: 350, duration: 1300, scale: 0.8 }),
    impact('Ice forms', ['impact.frost.blue', 'impact.frost.white.01'], { after: 'tt-water', anchor: 'start', offset: 400, duration: 1200, scale: 0.7 }),
    impact('Clinging rime', ['ice_spikes.radial.burst.blue', 'ice_spikes.radial.burst.white'], { after: 'tt-water', anchor: 'start', offset: 600, duration: 1600, scale: 0.6, below: true }),
    motion('stagger', 'targets', { after: 'tt-water', anchor: 'start', duration: 800, intensity: 0.5 }),
  ]),

  // The Unseeing Blade Master: ritual forms in incense smoke (shortened).
  'pf2e:5xf9wK9xyAeGFPw7': design('You run through blade forms within thick clouds of incense, fighting by senses other than sight.', () => [
    cast('Incense clouds', ['smoke.plumes.01.grey'], { stageId: 'ub-smoke', duration: 4000, scale: 1, opacity: 0.8, fadeIn: 400, fadeOut: 800 }),
    cast('Blade forms', ['spiritual_weapon.longsword.01.dark.white', 'spiritual_weapon.longsword.01.spectral.02.green'], { after: 'ub-smoke', anchor: 'start', offset: 600, duration: 2600, scale: 0.8, fadeIn: 200, fadeOut: 400, ...spin(1300, 1) }),
    motion('spin', 'source', { after: 'ub-smoke', anchor: 'start', offset: 700, duration: 2400, intensity: 0.35 }),
  ]),

  // Theogeny: genesis of a divine realm around you.
  'pf2e:9dyWP9RGCFwunGEo': design('Divine light floods outward as a new divine realm forms around you, transfiguring the whole emanation.', () => [
    cast('Divine spark', ['divine_smite.caster.standard.yellowwhite', 'divine_smite.caster.blueyellow'], { stageId: 'th-cast', duration: 1300, scale: 0.9 }),
    area('Realm unfolds', ['template_circle.out_pulse.01.burst.yellowwhite', 'template_circle.out_pulse.01.burst.bluewhite'], { stageId: 'th-realm', after: 'th-cast', anchor: 'start', offset: 700, duration: 2000, ...tint('#ffe9a8') }),
    area('Celestial motes', ['twinkling_stars.points06.orange'], { after: 'th-realm', anchor: 'start', offset: 300, duration: 2600, opacity: 0.8, fadeOut: 700 }),
    aura('Divine radiance', ['bless.400px.intro.yellow'], { after: 'th-cast', anchor: 'start', offset: 500, duration: 2200, scale: 1, fadeOut: 500 }),
    motion('pulse', 'source', { after: 'th-cast', anchor: 'start', offset: 500, duration: 900, intensity: 0.5 }),
  ], { sound: 'bless' }),

  // Threefold Limb: limb becomes ice, water or steam and strikes.
  'pf2e:3DY4vbXj0BYSWA7z': design('Your limb turns to ice, water or steam and lashes the target in a melee spell attack.', () => [
    cast('Limb transforms', ['cast_generic.water.02.blue'], { stageId: 'tl-cast', duration: 700, scale: 0.7 }),
    motion('lunge', 'source', { stageId: 'tl-lunge', after: 'tl-cast', anchor: 'start', offset: 300, duration: 650, intensity: 0.6 }),
    impact('Water lash', ['liquid.splash_side.blue'], { stageId: 'tl-hit', after: 'tl-lunge', anchor: 'start', offset: 350, duration: 1100, scale: 0.8 }),
    impact('Ice bites', ['impact.frost.blue', 'impact.frost.white.01'], { after: 'tl-hit', anchor: 'start', offset: 150, duration: 1000, scale: 0.55 }),
    impact('Steam hisses', ['fumes.steam.white'], { after: 'tl-hit', anchor: 'start', offset: 300, duration: 1500, scale: 0.6, opacity: 0.7, fadeOut: 500 }),
    motion('recoil', 'targets', { after: 'tl-hit', anchor: 'start', duration: 650, intensity: 0.5 }),
  ], { sound: 'water' }),

  // Thunderburst: blast of air and a peal of thunder.
  'pf2e:LFSwMtQVP05EzlZe': design('A powerful blast of air and a loud peal of thunder burst across the area, battering and deafening creatures.', () => [
    cast('Air gathers', ['wind_lines.01.02.white'], { stageId: 'tb-cast', duration: 600, scale: 0.7 }),
    area('Thunder peal', ['thunderwave.center.blue'], { stageId: 'tb-boom', after: 'tb-cast', anchor: 'end', duration: 1500 }),
    area('Air blast', ['explosion.02.blue'], { after: 'tb-boom', anchor: 'start', offset: 100, duration: 1300, scale: 0.9, opacity: 0.8 }),
    area('Shock rings', ['soundwave.01.blue'], { after: 'tb-boom', anchor: 'start', offset: 200, duration: 1300, opacity: 0.7 }),
    motion('stagger', 'targets', { after: 'tb-boom', anchor: 'start', offset: 200, duration: 800, intensity: 0.7 }),
  ], { sound: 'sonic' }),

  // Thunderous Strike: two-handed strike, then a sonic cone topples creatures.
  'pf2e:r82rqcm0MmGaBFkM': design('You swing your two-handed weapon in a massive Strike and the impact releases a cone of sonic vibrations that topples creatures.', () => [
    motion('lunge', 'source', { stageId: 'ts-lunge', duration: 750, intensity: 0.7 }),
    impact('Heavy Strike', ['melee_generic.bludgeoning.two_handed', 'melee_attack.03.greatclub.01'], { stageId: 'ts-hit', targetSelection: 'first', after: 'ts-lunge', anchor: 'start', offset: 350, duration: 1000, scale: 1 }),
    area('Sonic cone', ['template_cone_PF2e.001.003.blue', 'template_cone_PF2e.001.001.purplered'], { stageId: 'ts-cone', after: 'ts-hit', anchor: 'start', offset: 300, duration: 1600, opacity: 0.85 }),
    area('Vibrations', ['soundwave.02.blue'], { after: 'ts-cone', anchor: 'start', duration: 1300, opacity: 0.6 }),
    motion('stagger', 'targets', { after: 'ts-cone', anchor: 'start', offset: 300, duration: 800, intensity: 0.6 }),
  ], { sound: 'sonic' }),

  // Tidal Surge: a wave moves the target.
  'pf2e:iAnpxrLaBU4V6Sej': design('A tremendous wave crashes into the target and carries it along the ground or through the water.', () => [
    cast('Wave called', ['cast_generic.water.02.blue'], { stageId: 'td-cast', duration: 600, scale: 0.7 }),
    impact('Wave crashes', ['liquid.splash_side.blue'], { stageId: 'td-wave', after: 'td-cast', anchor: 'end', duration: 1300, scale: 1.1 }),
    impact('Churning water', ['water_splash.circle.01.blue'], { after: 'td-wave', anchor: 'start', offset: 200, duration: 1300, scale: 0.8 }),
    motion('rush', 'targets', { after: 'td-wave', anchor: 'start', offset: 250, duration: 1300, intensity: 0.3, motionRange: 'distance', distance: 2, motionHeading: 'away' }),
  ]),

  // Timber: a dead tree falls along the line.
  'pf2e:9I8mp7RkjeXbkYfx': design('A small dead tree sprouts in your space, topples along the line onto everyone in its path and decomposes.', () => [
    cast('Dead tree sprouts', ['plant_growth.03.round.2x2.complete.greenyellow'], { stageId: 'ti-tree', duration: 1000, scale: 0.6, ...tint('#7a5a3a') }),
    area('Tree crashes down', ['impact.ground_crack.orange.01'], { stageId: 'ti-crash', after: 'ti-tree', anchor: 'start', offset: 700, duration: 1300, areaLayout: 'tiles', scale: 0.8 }),
    area('Bark and leaves scatter', ['swirling_leaves.complete.02.green'], { after: 'ti-crash', anchor: 'start', offset: 200, duration: 1800, areaLayout: 'tiles', scale: 0.7, ...tint('#8a6a3a') }),
    motion('stagger', 'targets', { after: 'ti-crash', anchor: 'start', offset: 150, duration: 700, intensity: 0.6 }),
  ], { sound: 'bludgeon' }),

  // Time Jump: you leap through time across the battlefield.
  'pf2e:qJGW6BbIcU6sfA1d': design('Time pauses as you blink across the battlefield, leaving temporal afterimages behind.', () => [
    cast('Time freezes', ['icosahedron.rune.above.blueyellow'], { stageId: 'tj-cast', duration: 1400, scale: 0.7, fadeOut: 300 }),
    sprite('Temporal afterimage', { after: 'tj-cast', anchor: 'start', offset: 400, duration: 1500 }),
    motion('flicker', 'source', { stageId: 'tj-flick', after: 'tj-cast', anchor: 'start', offset: 400, duration: 600, intensity: 0.6 }),
    motion('rush', 'source', { after: 'tj-flick', anchor: 'end', duration: 1600, intensity: 0.4, motionRange: 'distance', distance: 3, motionHeading: 'toward' }),
    cast('Reappearance shimmer', ['shimmer.01.blue'], { after: 'tj-flick', anchor: 'end', offset: 1200, duration: 1000, scale: 0.8 }),
  ]),

  // Tornadic Gale: spinning gale along the line pulls creatures in.
  'pf2e:nsWSe5ssxAPn0j8t': design('A spinning gale bursts from you along the line, a row of whirling vortices dragging adjacent creatures into it and battering them.', () => [
    cast('Gale unleashed', ['wind_lines.01.02.white'], { stageId: 'tg-cast', duration: 700, scale: 0.8 }),
    area('Vortex gale', ['whirlwind.bluewhite', 'whirlwind.bluegrey'], { stageId: 'tg-vortex', after: 'tg-cast', anchor: 'start', offset: 400, duration: 2600, areaLayout: 'tiles', scale: 0.9, fadeIn: 200, fadeOut: 600 }),
    area('Wind stream', ['gust_of_wind.default'], { after: 'tg-vortex', anchor: 'start', duration: 2000, opacity: 0.7 }),
    motion('spin', 'targets', { after: 'tg-vortex', anchor: 'start', offset: 400, duration: 1200, intensity: 0.4 }),
    motion('stagger', 'targets', { after: 'tg-vortex', anchor: 'start', offset: 1700, duration: 700, intensity: 0.6 }),
  ]),

  // Torturous Trauma: internal organs battered with no external sign.
  'pf2e:zHSp4PzoOE72DV4o': design('Unseen force batters the creature\'s internal organs; a dull pulse inside it and it doubles over in pain.', () => [
    cast('Cruel gesture', ['cast_shape.circle.01.purple', 'cast_shape.circle.01.blue'], { stageId: 'tt-cast', duration: 600, scale: 0.6, ...tint('#8a1f3a') }),
    impact('Internal battering', ['impact.011.dark_red', 'impact.011.blue'], { stageId: 'tt-hit', after: 'tt-cast', anchor: 'end', duration: 900, scale: 0.55, repeats: 2, repeatInterval: 350 }),
    impact('Pain', ['icon.heart.dark_red', 'icon.heart.pink'], { after: 'tt-hit', anchor: 'start', offset: 200, duration: 1300, scale: 0.35, fadeOut: 400, ...tint('#8a1f3a') }),
    motion('cower', 'targets', { after: 'tt-hit', anchor: 'start', offset: 150, duration: 1100, intensity: 0.6 }),
  ], { sound: 'bludgeon' }),

  // Touch of Death: unarmed Strike plants a word of death.
  'pf2e:Ovvflf5aFbmBxqq8': design('You make an unarmed Strike that plants a word of death in the target, marked by a fading skull.', () => [
    motion('lunge', 'source', { stageId: 'td-lunge', duration: 700, intensity: 0.6 }),
    impact('Deadly strike', ['unarmed_strike.magical.01.dark_purple', 'unarmed_strike.magical.01.blue'], { stageId: 'td-hit', after: 'td-lunge', anchor: 'start', offset: 350, duration: 1000, scale: 0.9 }),
    impact('Death mark', ['icon.skull.purple'], { after: 'td-hit', anchor: 'start', offset: 300, duration: 1500, scale: 0.4, fadeIn: 200, fadeOut: 500 }),
    motion('recoil', 'targets', { after: 'td-hit', anchor: 'start', duration: 650, intensity: 0.5 }),
  ], { sound: 'unarmed', soundNamespace: 'ability' }),

  // Touch of Undeath: touch attacks the life force with undeath.
  'pf2e:GYI4xloAgkm6tTrT': design('Your touch drives undeath into the target\'s life force; void energy pulses and a skull flickers.', () => [
    motion('lunge', 'source', { stageId: 'tu-lunge', duration: 650, intensity: 0.5 }),
    impact('Void touch', ['impact.011.dark_purple', 'impact.011.blue'], { stageId: 'tu-hit', after: 'tu-lunge', anchor: 'start', offset: 350, duration: 900, scale: 0.6 }),
    impact('Life force drains', ['particles.inward.purple.02.03', 'particles.inward.greenyellow.02.03'], { after: 'tu-hit', anchor: 'start', offset: 150, duration: 1500, scale: 0.7 }),
    impact('Undeath', ['icon.skull.purple'], { after: 'tu-hit', anchor: 'start', offset: 300, duration: 1300, scale: 0.35, fadeOut: 400 }),
    motion('stagger', 'targets', { after: 'tu-hit', anchor: 'start', duration: 750, intensity: 0.5 }),
  ]),

  // Tracking Mayflies: mayfly swarm guides a ranged Strike.
  'pf2e:HnykPqaCEPk3d2n3': design('A magical swarm of mayflies gathers and guides your shot through the sky to the target.', () => [
    cast('Mayflies gather', ['fireflies.many.01.green'], { stageId: 'tm-flies', duration: 1100, scale: 0.8, ...tint('#e8f0b0') }),
    travel('Guided shot', ['arrow.physical.white.01'], { stageId: 'tm-shot', after: 'tm-flies', anchor: 'start', offset: 700, duration: 1300 }),
    impact('Mayflies swarm the target', ['fireflies.few.02.green'], { after: 'tm-shot', anchor: 'end', offset: -250, duration: 1600, scale: 0.7, fadeOut: 500, ...tint('#e8f0b0') }),
    motion('recoil', 'targets', { after: 'tm-shot', anchor: 'end', offset: -250, duration: 600, intensity: 0.45 }),
  ], { sound: 'bow', soundNamespace: 'ability' }),

  // Turbulent Tide: water-sheathed improvised weapon surges outward.
  'pf2e:eCwsj7wGQK1uBwiH': design('You Strike with your water-sheathed improvised weapon; it breaks and the sheath of water surges outward, pushing adjacent creatures away.', () => [
    motion('lunge', 'source', { stageId: 'tt-lunge', duration: 700, intensity: 0.6 }),
    impact('Water-sheathed Strike', ['liquid.splash_side.blue'], { stageId: 'tt-hit', targetSelection: 'first', after: 'tt-lunge', anchor: 'start', offset: 350, duration: 1100, scale: 0.9 }),
    aura('Water surges outward', ['water_splash.circle.01.blue'], { stageId: 'tt-surge', after: 'tt-hit', anchor: 'start', offset: 250, duration: 1300, scale: 1.8 }),
    motion('rush', 'targets', { after: 'tt-surge', anchor: 'start', offset: 150, duration: 1000, intensity: 0.3, motionRange: 'distance', distance: 1, motionHeading: 'away' }),
  ]),

  // Unbreaking Wave Advance: a mighty wave pushes foes back.
  'pf2e:ytboJsyZEbE1MLeV': design('A mighty wave bursts from your hand across the cone and pushes foes back.', () => [
    motion('lunge', 'source', { stageId: 'wa-push', duration: 650, intensity: 0.4 }),
    area('Mighty wave', ['water_splash.cone.01.blue'], { stageId: 'wa-wave', after: 'wa-push', anchor: 'start', offset: 250, duration: 1800 }),
    motion('rush', 'targets', { after: 'wa-wave', anchor: 'start', offset: 400, duration: 1100, intensity: 0.3, motionRange: 'distance', distance: 2, motionHeading: 'away' }),
  ]),

  // Unexpected Windfall: coins and heavy treasure rain on a foe.
  'pf2e:KR8WgdazifDBjDkW': design('Coins, heavy stone trinkets and cumbersome treasures rain down on the foe, weighing it down.', () => [
    impact('Treasure glints above', ['glint.yellow.many'], { stageId: 'uw-glint', duration: 900, scale: 0.8, offsetY: -0.6, offsetUnits: 'token' }),
    impact('Treasure rains down', ['falling_rocks.top.1x1.sandstone', 'falling_rocks.top.1x1.grey'], { stageId: 'uw-rain', after: 'uw-glint', anchor: 'start', offset: 400, duration: 2000, scale: 1, ...tint('#e0b84a') }),
    impact('Coins scatter', ['glint.yellow.few'], { after: 'uw-rain', anchor: 'start', offset: 600, duration: 1300, scale: 0.9 }),
    motion('press', 'targets', { after: 'uw-rain', anchor: 'start', offset: 500, duration: 1100, intensity: 0.6 }),
  ]),

  // Unfolding Wind Buffet: three wind-wrapped unarmed Strikes, foe pushed back.
  'pf2e:ALuvl9GYawnsZZCx': design('You make three wind-wrapped unarmed Strikes against the same target and the force of air pushes it back.', () => [
    motion('lunge', 'source', { stageId: 'wb-lunge', duration: 1300, intensity: 0.5 }),
    impact('Three wind strikes', ['unarmed_strike.magical.01.blue'], { stageId: 'wb-hits', after: 'wb-lunge', anchor: 'start', offset: 250, duration: 700, scale: 0.8, repeats: 3, repeatInterval: 330, ...tint('#e0f0ff') }),
    impact('Gust', ['wind_lines.01.01.white'], { after: 'wb-hits', anchor: 'start', offset: 700, duration: 1200, scale: 0.9 }),
    motion('rush', 'targets', { after: 'wb-hits', anchor: 'start', offset: 900, duration: 900, intensity: 0.3, motionRange: 'distance', distance: 1, motionHeading: 'away' }),
  ], { sound: 'unarmed', soundNamespace: 'ability' }),

  // Unfolding Wind Crash: jump up to 120 ft, crash down in a 20-ft emanation.
  'pf2e:XjNROFtWnwovhCsq': design('You leap high into the air on the wind and crash down, a shockwave of air and stone bursting out around your landing.', () => [
    cast('Wind lifts you', ['wind_lines.01.01.white'], { stageId: 'wc-cast', duration: 700, scale: 0.8 }),
    motion('leap', 'source', { stageId: 'wc-leap', after: 'wc-cast', anchor: 'start', offset: 300, duration: 1500, intensity: 0.7, motionRange: 'distance', distance: 3, motionHeading: 'toward', jumpHeight: 1 }),
    motion('slam', 'source', { stageId: 'wc-slam', after: 'wc-leap', anchor: 'end', duration: 600, intensity: 0.9 }),
    area('Crash shockwave', ['impact.ground_crack.white.02', 'impact.ground_crack.orange.02'], { stageId: 'wc-crash', after: 'wc-slam', anchor: 'start', offset: 150, duration: 1600 }),
    area('Blast of air', ['thunderwave.center.blue'], { after: 'wc-crash', anchor: 'start', duration: 1300, opacity: 0.8 }),
    motion('stagger', 'targets', { after: 'wc-crash', anchor: 'start', offset: 150, duration: 800, intensity: 0.7 }),
  ]),

  // Untwisting Iron Roots: earth throws enemies off balance.
  'pf2e:9o5aG5025ZczjkPb': design('You stamp and the earth around you heaves, chunks of rock throwing nearby enemies off balance and to the ground.', () => [
    motion('slam', 'source', { stageId: 'ir-slam', duration: 650, intensity: 0.8 }),
    area('Earth heaves', ['impact.ground_crack.orange.02'], { stageId: 'ir-heave', after: 'ir-slam', anchor: 'start', offset: 300, duration: 1600 }),
    area('Rubble', ['ground_cracks.02.orange'], { after: 'ir-heave', anchor: 'start', offset: 200, duration: 2200, opacity: 0.8, fadeOut: 600 }),
    motion('stagger', 'targets', { after: 'ir-heave', anchor: 'start', offset: 200, duration: 800, intensity: 0.7 }),
  ], { sound: 'earth' }),

  // Updraft: target launched into the air and crashes down.
  'pf2e:QozxgBbcmktLKdBs': design('A powerful blast of wind erupts from the ground, launching the target into the air before it crashes back down.', () => [
    cast('Wind called', ['wind_lines.01.02.white'], { stageId: 'ud-cast', duration: 500, scale: 0.7 }),
    impact('Updraft erupts', ['whirlwind.bluewhite', 'whirlwind.bluegrey'], { stageId: 'ud-wind', after: 'ud-cast', anchor: 'end', duration: 2000, scale: 0.9, fadeIn: 150, fadeOut: 400 }),
    motion('levitate', 'targets', { stageId: 'ud-lift', after: 'ud-wind', anchor: 'start', offset: 200, duration: 1300, intensity: 0.9 }),
    motion('slam', 'targets', { after: 'ud-lift', anchor: 'end', duration: 600, intensity: 0.8 }),
    impact('Crash', ['impact.ground_crack.white.01', 'impact.ground_crack.01.orange'], { after: 'ud-lift', anchor: 'end', offset: 100, duration: 1000, scale: 0.6, below: true }),
  ]),

  // Utter Destruction: screech of destructive sonic and void energy.
  'pf2e:XGB77j7m0SLky8U1': design('You screech with an unearthly voice and a cone of sonic and void energy smashes everything before you.', () => [
    cast('Unearthly screech', ['toll_the_dead.purple.shockwave', 'toll_the_dead.green.shockwave'], { stageId: 'ud-cast', duration: 900, scale: 0.6 }),
    area('Destructive cone', ['breath_weapons02.burst.cone.arcana.dark_black.01', 'breath_weapons02.burst.cone.fire.orange.01'], { stageId: 'ud-cone', after: 'ud-cast', anchor: 'start', offset: 400, duration: 1800, ...tint('#5a2a7a') }),
    area('Sonic waves', ['soundwave.02.purple', 'soundwave.02.blue'], { after: 'ud-cone', anchor: 'start', duration: 1400, opacity: 0.7 }),
    motion('stagger', 'targets', { after: 'ud-cone', anchor: 'start', offset: 400, duration: 800, intensity: 0.7 }),
  ]),

  // Vacuum: you inhale all air in the area.
  'pf2e:kk7JKox6MdGAWmCH': design('You inhale all the air in the surrounding area; air streams inward to you and nearby creatures gasp for breath.', () => [
    area('Air rushes inward', ['particles.inward.white.02.04', 'particles.inward.greenyellow.02.04'], { stageId: 'va-air', duration: 2000, ...tint('#e8f4ff') }),
    area('Wind drawn in', ['template_circle.whirl.intro.blue'], { after: 'va-air', anchor: 'start', offset: 200, duration: 1600, opacity: 0.5, ...tint('#dfe8f0') }),
    motion('pulse', 'source', { after: 'va-air', anchor: 'start', offset: 300, duration: 1200, intensity: 0.5 }),
    motion('cower', 'targets', { after: 'va-air', anchor: 'start', offset: 800, duration: 1100, intensity: 0.5 }),
  ], { sound: 'wind' }),

  // Vengeful Glare: icy vengeance or fiery wrath in a gaze.
  'pf2e:8uVMoiYDzhzWJEZ2': design('Your gaze falls on the creature, burning with fiery wrath or icy vengeance; the glare scorches or freezes it.', () => [
    cast('Vengeful eyes', ['eyes.01.orangered.single', 'eyes.01.dark_green.single'], { stageId: 'vg-eyes', duration: 1300, scale: 0.45, offsetY: -0.3, offsetUnits: 'token' }),
    impact('Wrathful flare', ['impact.fire.01.orange'], { stageId: 'vg-fire', after: 'vg-eyes', anchor: 'start', offset: 700, duration: 1100, scale: 0.6 }),
    impact('Icy vengeance', ['impact.frost.blue', 'impact.frost.white.01'], { after: 'vg-fire', anchor: 'start', offset: 150, duration: 1100, scale: 0.55, opacity: 0.8 }),
    motion('stagger', 'targets', { after: 'vg-fire', anchor: 'start', duration: 700, intensity: 0.45 }),
  ]),

  // Vitality Lash: Creation's Forge energy demolishes a corrupted essence.
  'pf2e:kcelf6IHl3L9VXXg': design('Vital energy from Creation\'s Forge lashes the target, searing its corrupted essence in golden light.', () => [
    cast('Vitality gathers', ['healing_generic.burst.yellowwhite', 'healing_generic.burst.greenorange'], { stageId: 'vl-cast', duration: 900, scale: 0.6 }),
    travel('Lash of vitality', ['energy_beam.normal.yellow.01', 'energy_beam.normal.bluepink.02'], { stageId: 'vl-lash', after: 'vl-cast', anchor: 'start', offset: 500, duration: 1100 }),
    impact('Corruption seared', ['divine_smite.target.yellowwhite', 'divine_smite.target.blueyellow'], { after: 'vl-lash', anchor: 'end', offset: -250, duration: 1500, scale: 0.9 }),
    motion('stagger', 'targets', { after: 'vl-lash', anchor: 'end', offset: -250, duration: 700, intensity: 0.5 }),
  ]),

  // Vitrifying Blast: cone of glass shards.
  'pf2e:g2V4ID0pl1ZGAxZj': design('You launch a cone of glittering glass shards that embed in creatures and begin turning them to glass.', () => [
    cast('Glass forms', ['glint.yellow.many'], { stageId: 'vb-cast', duration: 700, scale: 0.6, ...tint('#d8f0ff') }),
    area('Glass shard cone', ['breath_weapons02.burst.cone.ice.01', 'breath_weapons.cold.cone.blue'], { stageId: 'vb-cone', after: 'vb-cast', anchor: 'start', offset: 350, duration: 1700, ...tint('#cfeaf0') }),
    impact('Shards embed', ['impact_themed.ice_shard.blue'], { after: 'vb-cone', anchor: 'start', offset: 450, duration: 1200, scale: 0.6, ...tint('#e0f4f8') }),
    motion('stagger', 'targets', { after: 'vb-cone', anchor: 'start', offset: 450, duration: 800, intensity: 0.55 }),
  ], { sound: 'pierce' }),

  // Vomit Swarm: belch a cone of magical vermin.
  'pf2e:cB17yFc9456Pyfec': design('You belch forth a cone of skittering magical vermin that swarm over everyone in the area, biting and stinging.', () => [
    motion('lunge', 'source', { stageId: 'vs-belch', duration: 600, intensity: 0.4 }),
    area('Vermin pour out', ['breath_weapons.poison.cone.green'], { stageId: 'vs-cone', after: 'vs-belch', anchor: 'start', offset: 250, duration: 1800, ...tint('#6a5a3a') }),
    impact('Vermin swarm over foes', ['particles.002.001.complete.many.greenyellow', 'particles.002.001.complete.many.blue'], { after: 'vs-cone', anchor: 'start', offset: 500, duration: 2000, scale: 0.9, ...tint('#5a4a2a') }),
    motion('shake', 'targets', { after: 'vs-cone', anchor: 'start', offset: 500, duration: 1200, intensity: 0.4 }),
  ]),

  // Weapon Storm: weapon multiplies and swipes in a cone or emanation.
  'pf2e:8M03UxGXjYyDFAoy': design('You swing your weapon and it multiplies into a flurry of spectral duplicates that swipe at every creature around you.', () => [
    motion('spin', 'source', { stageId: 'ws-spin', duration: 1000, intensity: 0.4 }),
    aura('Duplicated blades sweep', ['melee_generic.whirlwind.01.bluepurple', 'melee_generic.whirlwind.01.orange'], { stageId: 'ws-sweep', after: 'ws-spin', anchor: 'start', offset: 150, duration: 1400, scale: 2.2 }),
    aura('Flurry of duplicates', ['cloud_of_daggers.daggers.purple'], { after: 'ws-sweep', anchor: 'start', offset: 200, duration: 1600, scale: 1.6, opacity: 0.85, fadeOut: 500 }),
    impact('Swipes land', ['melee_generic.slash.02.001.purple', 'melee_generic.slash.02.001.blue'], { after: 'ws-sweep', anchor: 'start', offset: 450, duration: 900, scale: 0.8 }),
    motion('recoil', 'targets', { after: 'ws-sweep', anchor: 'start', offset: 450, duration: 650, intensity: 0.45 }),
  ], { sound: 'slash' }),

  // Weapon Tide: a wave of weapons travels along the ground.
  'pf2e:IV76q50T2pZemxAl': design('You conjure a wave of weapons that surges along the ground through the cone, striking creatures in the area.', () => [
    cast('Weapons conjured', ['glint.purple.few', 'glint.yellow.few'], { stageId: 'wt-cast', duration: 600, scale: 0.75 }),
    area('Wave of weapons', ['volley_of_projectiles_ConePF2e.arrow.001.002.bluepurple', 'volley_of_projectiles_ConePF2e.arrow.001.001.orangeyellow'], { stageId: 'wt-wave', after: 'wt-cast', anchor: 'start', offset: 300, duration: 1800 }),
    impact('Blades strike', ['melee_generic.slash.02.001.purple', 'melee_generic.slash.02.001.blue'], { after: 'wt-wave', anchor: 'start', offset: 600, duration: 900, scale: 0.8 }),
    motion('stagger', 'targets', { after: 'wt-wave', anchor: 'start', offset: 600, duration: 700, intensity: 0.5 }),
  ], { sound: 'slash' }),

  // Widow's Bite: melee spell attack with a conjured stinger.
  'pf2e:6JDq5d8w11ZuH4Ta': design('You conjure a deadly stinger on your hand and stab the foe, flooding the wound with venom.', () => sting(0.8)),

  // Wings of the Valkyrie: white or black feathered wings, fly Speed.
  'pf2e:9ZwpT9RDwCxhYQXd': design('Powerful feathered wings emerge from your back in a burst of white feathers and you lift into the air.', () => [
    cast('Wings unfurl', ['swirling_feathers.outburst.01.textured'], { stageId: 'wv-wings', duration: 1600, scale: 1.1 }),
    sprite('Ground shadow', { after: 'wv-wings', anchor: 'start', offset: 500, duration: 2000 }),
    motion('levitate', 'source', { after: 'wv-wings', anchor: 'start', offset: 500, duration: 2100, intensity: 0.8 }),
  ]),

  // Withering Grasp: touch rots organic material.
  'pf2e:7tp97g0UCJ9wOrd5': design('Your withering touch rots the target; void energy spreads from the contact in a puff of decay.', () => [
    motion('lunge', 'source', { stageId: 'wg-lunge', duration: 650, intensity: 0.5 }),
    impact('Withering touch', ['impact.011.dark_purple', 'impact.011.blue'], { stageId: 'wg-hit', after: 'wg-lunge', anchor: 'start', offset: 350, duration: 900, scale: 0.6 }),
    impact('Decay spreads', ['smoke.puff.centered.dark_purple', 'smoke.puff.centered.grey'], { after: 'wg-hit', anchor: 'start', offset: 200, duration: 1600, scale: 0.6, fadeOut: 500, ...tint('#5a4a3a') }),
    motion('stagger', 'targets', { after: 'wg-hit', anchor: 'start', duration: 700, intensity: 0.5 }),
  ]),

  // Wood Walk: wood shapes itself to carry you.
  'pf2e:Up4zLmZDgciUDpIv': design('Branches and vines weave into steps and ladders, carrying you swiftly along the surface.', () => [
    cast('Vines weave', ['vine.complete.nature.group.02.green'], { stageId: 'ww-vines', duration: 1600, scale: 0.8 }),
    cast('Leaves stir', ['swirling_leaves.complete.01.green'], { after: 'ww-vines', anchor: 'start', offset: 300, duration: 1800, scale: 0.8 }),
    motion('rush', 'source', { after: 'ww-vines', anchor: 'start', offset: 700, duration: 2000, intensity: 0.3, motionRange: 'distance', distance: 3, motionHeading: 'toward' }),
  ]),

  // Wooden Double: a wooden block takes the blow while you Step away.
  'pf2e:aUMmmtPmBdCdVDed': design('A wooden double appears in your place and takes the blow as you Step aside in a swirl of leaves.', () => [
    cast('Leaves swirl', ['swirling_leaves.complete.01.green'], { stageId: 'wd-leaves', duration: 1500, scale: 1 }),
    sprite('Wooden substitute', { after: 'wd-leaves', anchor: 'start', offset: 200, duration: 2200 }),
    motion('dodge', 'source', { after: 'wd-leaves', anchor: 'start', offset: 250, duration: 1200, intensity: 0.35, motionRange: 'distance', distance: 1, motionHeading: 'toward' }),
  ]),

  // Worm's Repast: gnawing worms within the target's flesh.
  'pf2e:H4oF5szC7aogqtvw': design('Gnawing worms materialize within the target\'s flesh and writhe out of it; the creature convulses in pain.', () => [
    cast('Vermin conjured', ['glint.purple.few', 'glint.yellow.few'], { stageId: 'wr-cast', duration: 500, scale: 0.7 }),
    impact('Worms writhe out', ['vine.complete.void.group.01.dark_pinkpurple', 'black_tentacles.dark_purple'], { stageId: 'wr-worms', after: 'wr-cast', anchor: 'end', duration: 2000, scale: 0.5, ...tint('#c08a8a') }),
    impact('Bloody bites', ['liquid.splash02.red'], { after: 'wr-worms', anchor: 'start', offset: 400, duration: 1200, scale: 0.4 }),
    motion('shake', 'targets', { after: 'wr-worms', anchor: 'start', offset: 200, duration: 1400, intensity: 0.5 }),
  ]),

  // Wrathful Storm: massive storm cloud with rain, gales, lightning and blizzard.
  'pf2e:yLJROsQtyrPIKcDx': design('A massive storm cloud forms over the area, unleashing gales, sleet and lightning.', () => skyStorm('call_lightning.high_res.blue', [
    area('Blizzard', ['sleet_storm.02.blue'], { after: 'sk-cloud', anchor: 'start', offset: 600, duration: 2800, opacity: 0.7, fadeIn: 300, fadeOut: 700 }),
  ])),

  // Wyvern Sting: touch duplicating a wyvern's venomous sting.
  'pf2e:IoHxAkK0uGqrgtWl': design('You stab the touched creature with a wyvern\'s massive venomous sting; venom courses through the wound.', () => sting(1.1)),

  // Ymeri's Mark: fiery mark of the Queen of the Inferno.
  'pf2e:6gEKZaGdH842RF3J': design('The fiery mark of the Queen of the Inferno burns into the target, smoldering on its body.', () => [
    cast('Infernal sign', ['cast_generic.fire.01.orange'], { stageId: 'ym-cast', duration: 800, scale: 0.7 }),
    impact('Mark burns in', ['ward.rune.yellow.01'], { stageId: 'ym-mark', after: 'ym-cast', anchor: 'start', offset: 500, duration: 2200, scale: 0.55, fadeIn: 200, fadeOut: 500, ...tint('#ff6a2a') }),
    impact('Smoldering flames', ['flames.01.orange'], { after: 'ym-mark', anchor: 'start', offset: 300, duration: 1800, scale: 0.5, opacity: 0.85, fadeOut: 500 }),
    motion('cower', 'targets', { after: 'ym-mark', anchor: 'start', offset: 200, duration: 900, intensity: 0.4 }),
  ]),

  // Zombie Horde: a horde of zombies claws up from the ground.
  'pf2e:ziujByCygD3MO2CK': design('The destroyed thrall bursts into a horde of zombies clawing up from the ground across the burst, battering creatures within.', () => [
    cast('Thrall destroyed', ['toll_the_dead.grey.skull_smoke', 'toll_the_dead.green.skull_smoke'], { stageId: 'zh-cast', duration: 1000, scale: 0.6 }),
    area('Ground splits', ['impact.ground_crack.dark_red.02', 'impact.ground_crack.orange.02'], { stageId: 'zh-crack', after: 'zh-cast', anchor: 'start', offset: 500, duration: 1700, ...tint('#5a4a3a') }),
    area('Hands claw up', ['arcane_hand.green'], { stageId: 'zh-hands', after: 'zh-crack', anchor: 'start', offset: 300, duration: 2200, scale: 0.7, fadeIn: 200, fadeOut: 500, ...tint('#8a9a6a') }),
    motion('stagger', 'targets', { after: 'zh-hands', anchor: 'start', offset: 500, duration: 800, intensity: 0.5 }),
  ]),
};
