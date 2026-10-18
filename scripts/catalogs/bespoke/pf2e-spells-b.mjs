// Bespoke compositions (pf2e-spells-b). Keys: '<system>:<entryId>' or '<system>:<entryId>:<variant|mode>'.
// See scripts/catalogs/bespoke/helpers.mjs and scripts/bespoke.mjs.
import { cast, travel, projectile, impact, area, aura, sprite, motion, tint, spin, breathe, design } from './helpers.mjs';
export default {
  // Draw Blood: a fanged mouth in the palm bites the target in melee; blood flows back as healing.
  'pf2e:NVeN6RrFu12HnTne': design('A melee spell attack: the fanged palm lunges and bites the target, blood sprays, and a thin red trickle of vitality returns to the caster.', () => [
    cast('Fanged palm', ['bite.200px.red'], { stageId: 'palm', scale: 0.35, duration: 700, offsetX: 0.3, offsetUnits: 'token' }),
    motion('lunge', 'source', { stageId: 'lunge', after: 'palm', anchor: 'start', offset: 350, duration: 650 }),
    impact('Bite', ['bite.400px.red'], { stageId: 'bite', after: 'lunge', anchor: 'start', offset: 250, duration: 1100, scale: 0.7 }),
    impact('Blood drawn', ['liquid.splash02.red'], { after: 'bite', anchor: 'start', offset: 300, duration: 1300, scale: 0.6 }),
    motion('recoil', 'targets', { after: 'bite', anchor: 'start', offset: 250, duration: 600 }),
    aura('Blood vitality returns', ['healing_generic.200px.red', 'healing_generic.200px.purple'], { after: 'bite', anchor: 'start', offset: 900, duration: 1400, scale: 0.6, fadeIn: 200, fadeOut: 400 }),
  ], { sound: 'claws' }),

  // Dread Mosquito Storm: a plague of undead mosquitoes over a 60-foot burst.
  'pf2e:Q6cvsLytYffpeN3g': design('A swarm of undead mosquitoes (dark-red firefly motes) fills the burst over a sickly necrotic haze.', () => [
    cast('Plague gathers', ['fumes.04.complete.purple', 'fumes.04.complete.grey'], { stageId: 'gather', scale: 0.9, duration: 1200 }),
    area('Necrotic haze', ['fumes.04.complete.purple', 'fumes.04.complete.grey'], { stageId: 'haze', after: 'gather', anchor: 'start', offset: 600, duration: 3200, opacity: 0.7, below: true }),
    area('Mosquito swarm', ['fireflies.many.01.red', 'fireflies.many.01.green'], { after: 'haze', anchor: 'start', offset: 250, duration: 3200, ...tint('#5a1020') }),
    area('Second wave', ['fireflies.many.02.red', 'fireflies.many.02.green'], { after: 'haze', anchor: 'start', offset: 700, duration: 2800, ...tint('#3d2a40') }),
  ]),

  // Dust Storm: swirling, choking dust that cuts like sand.
  'pf2e:K1wmI4qPmRhFczmy': design('A swirling dust storm: tan haze fills the burst while a sand-coloured whirlwind churns through it.', () => [
    area('Choking dust', ['fog_cloud.02.white', 'fog_cloud.01.white'], { stageId: 'dust', duration: 4000, ...tint('#c7a77e'), fadeIn: 400, fadeOut: 600 }),
    area('Swirling sand', ['whirlwind.bluegrey', 'whirlwind.bluegrey02'], { after: 'dust', anchor: 'start', offset: 300, duration: 3400, opacity: 0.75, ...tint('#b8915a') }),
    motion('cower', 'targets', { after: 'dust', anchor: 'start', offset: 700, duration: 900, intensity: 0.5 }),
  ]),

  // Eagle's Cry: a piercing eagle cry in a 30-foot cone; frightens on a failed save.
  'pf2e:AUZPwEorddewm0x1': design('A sonic cone of soundwaves and feathers erupts from the caster; deafened foes flinch and cower from the eagle cry.', () => [
    cast('Eagle cry', ['soundwave.02.blue'], { stageId: 'cry', scale: 0.6, duration: 1000 }),
    motion('pulse', 'source', { after: 'cry', anchor: 'start', duration: 600, intensity: 0.6 }),
    area('Piercing cone', ['breath_weapons.cold.cone.blue'], { stageId: 'cone', after: 'cry', anchor: 'start', offset: 250, duration: 1800, opacity: 0.55, ...tint('#cfe6ff') }),
    area('Feathers', ['swirling_feathers.outburst.01.blue', 'swirling_feathers.outburst.01.textured'], { after: 'cone', anchor: 'start', offset: 200, duration: 1800, scale: 0.6 }),
    motion('cower', 'targets', { after: 'cone', anchor: 'start', offset: 450, duration: 900 }),
  ]),

  // Earthbind: the weight of earth drags a flying target to the ground.
  'pf2e:gPvtmKMRpg9I9D7H': design('Earthen weight drags the flier down: rocks fall onto the target, which is pressed to the cracking ground.', () => [
    cast('Weight of earth', ['ground_cracks.03.orange'], { stageId: 'c', scale: 0.6, duration: 900 }),
    impact('Falling stone', ['falling_rocks.top.1x1.sandstone', 'falling_rocks.top.1x1.grey'], { stageId: 'rocks', after: 'c', anchor: 'start', offset: 400, duration: 1500, scale: 0.9 }),
    motion('press', 'targets', { after: 'rocks', anchor: 'start', offset: 300, duration: 1000 }),
    impact('Grounded', ['ground_cracks.01.orange'], { after: 'rocks', anchor: 'start', offset: 900, duration: 1800, scale: 0.8, below: true }),
  ]),

  // Earthbreaker Stride: gain a burrow Speed; the ground parts as you move.
  'pf2e:uZmUhjgqiX6d0Dv6': design('The ground parts around the caster, who sinks into a freshly opened burrow.', () => [
    cast('Stone stirs', ['ground_cracks.03.orange'], { stageId: 'stir', scale: 0.9, duration: 1200, below: true }),
    cast('Burrow opens', ['burrow.out.01.brown', 'ground_cracks.01.orange'], { stageId: 'burrow', after: 'stir', anchor: 'start', offset: 450, duration: 1600, scale: 0.9 }),
    motion('sink', 'source', { after: 'burrow', anchor: 'start', offset: 250, duration: 1200 }),
  ]),

  // Eat Fire: you swallow the incoming fire, then hold the smoke.
  'pf2e:FWuLUKIbkJZjBiuA': design('Reaction: flames are drawn inward into the caster\'s mouth and swallowed, leaving a thin wisp of held smoke.', () => [
    cast('Fire swallowed', ['particles.inward.orange.01.03', 'particles.inward.greenyellow.01.03'], { stageId: 'in', scale: 0.8, duration: 1300 }),
    cast('Flames drawn in', ['flames.01.orange'], { after: 'in', anchor: 'start', duration: 1100, scale: 0.45, offsetY: -0.25, offsetUnits: 'token', fadeOut: 500 }),
    motion('pulse', 'source', { after: 'in', anchor: 'start', offset: 800, duration: 600, intensity: 0.5 }),
    aura('Held smoke', ['smoke.puff.centered.grey'], { after: 'in', anchor: 'end', offset: -200, duration: 1500, scale: 0.5, opacity: 0.6, offsetY: -0.3, offsetUnits: 'token' }),
  ]),

  // Echo Jump: teleport away, leaving an echo that explodes with force.
  'pf2e:LpMeT0CW1OEKdaQL': design('The caster blinks away in a misty step, leaving a silhouette echo that detonates as a force burst over the emanation.', () => [
    cast('Departure', ['misty_step.01.blue'], { stageId: 'out', duration: 1200 }),
    motion('flicker', 'source', { after: 'out', anchor: 'start', offset: 200, duration: 800 }),
    sprite('Departure echo', { stageId: 'echo', after: 'out', anchor: 'start', offset: 300, duration: 1100, opacity: 0.6, fadeOut: 400 }),
    area('Echo force burst', ['explosion.04.blue', 'explosion.02.blue'], { after: 'echo', anchor: 'start', offset: 700, duration: 1500 }),
    motion('recoil', 'targets', { after: 'echo', anchor: 'start', offset: 850, duration: 600 }),
  ]),

  // Electric Arc: arc leaps from one target to another.
  'pf2e:kBhaPuzLUSwS6vVf': design('A quick arc of lightning leaps to each target in turn with a static crack on contact; the original arc lingered over 6 s.', () => [
    cast('Charge current', ['static_electricity.02.blue'], { stageId: 'charge', scale: 0.7, duration: 600 }),
    travel('Arc', ['electric_arc.blue.02', 'electric_arc.02'], { stageId: 'arc', after: 'charge', anchor: 'end', offset: -150, duration: 1200, scale: 0.6 }),
    impact('Static discharge', ['static_electricity.01.blue'], { after: 'arc', anchor: 'start', offset: 700, duration: 1300, scale: 1 }),
    motion('shake', 'targets', { after: 'arc', anchor: 'start', offset: 700, duration: 600, intensity: 0.5 }),
  ]),

  // Elemental Toss: fling a chunk of your elemental matter (ranged spell attack).
  'pf2e:0JUOgbbFCapp3HlW': design('A thrown chunk of elemental matter rather than an alchemical flask: the caster flicks a stone-and-moss shard at the foe, which cracks on impact.', () => [
    cast('Matter gathers', ['cast_generic.earth.01.browngreen'], { stageId: 'gather', scale: 0.6, duration: 700 }),
    motion('throw', 'source', { after: 'gather', anchor: 'start', offset: 300, duration: 600 }),
    travel('Elemental chunk', ['spell_projectile.earth.01.browngreen', 'boulder.toss.02.01.stone.brown'], { stageId: 'toss', after: 'gather', anchor: 'start', offset: 450, duration: 1300, scale: 0.45 }),
    impact('Chunk shatters', ['impact.boulder.01', 'impact.001.blue'], { stageId: 'hit', after: 'toss', anchor: 'start', offset: 900, duration: 1100, scale: 0.6 }),
    motion('recoil', 'targets', { after: 'hit', anchor: 'start', duration: 600 }),
  ]),

  // Elephant Form: become a Large elephant/mammoth with trunk, tusks and stomping feet.
  'pf2e:zjYQyuBNT5VjV4mz': design('A huge earthy transformation ending in a ground-cracking stomp instead of claws, since an elephant fights with feet, trunk and tusks.', () => [
    cast('Primal change', ['cast_generic.earth.01.browngreen'], { stageId: 'c', scale: 0.9, duration: 1100 }),
    sprite('Silhouette swells', { stageId: 'grow', after: 'c', anchor: 'start', offset: 450, duration: 1300, opacity: 0.55, fadeOut: 500 }),
    motion('pulse', 'source', { after: 'c', anchor: 'start', offset: 500, duration: 1000, intensity: 0.8 }),
    motion('slam', 'source', { stageId: 'stomp', after: 'grow', anchor: 'end', offset: -300, duration: 700 }),
    impact('Stomp', ['ground_cracks.02.orange'], { after: 'stomp', anchor: 'start', offset: 300, duration: 1800, scale: 1.1, below: true }),
  ]),

  // Ember Doppelgänger: smoke and embers form a glowing duplicate that blasts a 10-foot burst.
  'pf2e:Vsy8RWuTrdIVDVSm': design('Swirls of smoke and embers form a glowing duplicate (sprite) and its 10-foot blast of fire erupts in the chosen area; flames no longer run 8 s.', () => [
    cast('Smoke and embers swirl', ['smoke.puff.ring.01.dark_black', 'smoke.puff.ring.01.white'], { stageId: 'smoke', scale: 0.9, duration: 1200 }),
    cast('Embers', ['particles.inward.orange.01.03', 'particles.inward.greenyellow.01.03'], { after: 'smoke', anchor: 'start', duration: 1200, scale: 0.8, ...tint('#ff8a3d') }),
    sprite('Ember duplicate', { stageId: 'dup', after: 'smoke', anchor: 'start', offset: 500, duration: 2200, opacity: 0.6, offsetX: 0.9, offsetUnits: 'token', fadeIn: 300, fadeOut: 500 }),
    area('Fire blast', ['explosion.01.orange'], { stageId: 'blast', after: 'dup', anchor: 'start', offset: 900, duration: 1600 }),
    area('Smouldering burst', ['flames.02.orange'], { after: 'blast', anchor: 'start', offset: 300, duration: 1600, opacity: 0.7 }),
    motion('recoil', 'targets', { after: 'blast', anchor: 'start', offset: 200, duration: 600 }),
  ]),

  // Embrace the Pit: devil horns and diabolic features; fire and poison resistance.
  'pf2e:ilGsyGLGjjIPHbyP': design('A diabolic morph: hellfire-red energy wreathes the caster and settles as a smouldering infernal skin.', () => [
    cast('Infernal heritage stirs', ['cast_generic.dark.01.red', 'cast_generic.fire.01.orange'], { stageId: 'c', scale: 0.9, duration: 1100 }),
    sprite('Silhouette shifts', { after: 'c', anchor: 'start', offset: 400, duration: 1200, opacity: 0.5, fadeOut: 400 }),
    aura('Hellfire skin', ['flames.02.orange'], { after: 'c', anchor: 'start', offset: 600, duration: 2000, scale: 0.9, opacity: 0.7, fadeIn: 300, fadeOut: 600, ...tint('#b0201a') }),
    motion('pulse', 'source', { after: 'c', anchor: 'start', offset: 600, duration: 1000, intensity: 0.7 }),
  ]),

  // Enhance Victuals: water into wine, food made gourmet; counteracts poison.
  'pf2e:rdTEF1hfAWbN58NE': design('A sparkle of transformation over the food and drink instead of a grey 9 s smoke plume.', () => [
    impact('Fare transforms', ['swirling_sparkles.01.yellow', 'swirling_sparkles.01.blue'], { stageId: 's', duration: 1800, scale: 0.7 }),
    impact('Gourmet glint', ['glint.yellow.few'], { after: 's', anchor: 'start', offset: 500, duration: 1500, scale: 0.5 }),
  ]),

  // Entangle Fate: a swirl of energy entangles the fates of everyone caught in the blast.
  'pf2e:11haL5O9KMpY5Fv7': design('Threads of fate tie the targets together and leave them dazed by conflicting glimpses; the vine-growth sound did not fit a mental spell.', () => [
    cast('Fate swirls', ['cast_shape.circle.01.purple', 'cast_generic.02.blue'], { stageId: 'c', scale: 0.8, duration: 900 }),
    impact('Fates entangle', ['energy_strands.complete.purple.01', 'energy_strands.complete.blue.01'], { stageId: 'tie', after: 'c', anchor: 'start', offset: 450, duration: 2000, scale: 0.9 }),
    impact('Conflicting glimpses', ['dizzy_stars.200px.purple', 'dizzy_stars.200px.blueorange'], { after: 'tie', anchor: 'start', offset: 700, duration: 1600, scale: 0.8 }),
    motion('stagger', 'targets', { after: 'tie', anchor: 'start', offset: 700, duration: 800, intensity: 0.6 }),
  ], { sound: 'psychic' }),

  // Entreat the Many: a spiraling cyclone of colorful spirit forms deals force damage in a 10-foot emanation.
  'pf2e:Vg4K3dTDswNQf4Bx': design('A spiralling cyclone of colourful bonded spirits sweeps the emanation and buffets enemies; stages trimmed from 6.5 s.', () => [
    cast('Spirits answer', ['spirit_guardians.pinkpurple.particles', 'spirit_guardians.blueyellow.ring'], { stageId: 'c', duration: 1000, scale: 0.8 }),
    area('Spirit cyclone', ['spirit_guardians.pinkpurple.spirits', 'spirit_guardians.blueyellow.ring'], { stageId: 'cyc', after: 'c', anchor: 'start', offset: 400, duration: 3200, fadeIn: 300, fadeOut: 500, ...spin(2400, 1) }),
    area('Second chorus', ['spirit_guardians.blueyellow.spirits', 'spirit_guardians.blueyellow.ring'], { after: 'cyc', anchor: 'start', offset: 300, duration: 2800, opacity: 0.7, fadeOut: 500, ...spin(2800, -1) }),
    motion('recoil', 'targets', { after: 'cyc', anchor: 'start', offset: 900, duration: 700 }),
  ], { sound: 'spirit' }),

  // Envenom Companion: the companion's attacks drip with venom.
  'pf2e:gWmLT5SkA0qH2mNE': design('Venom coats the companion: a green splash and a brief toxic drip on the target rather than a 7.8 s poison cloud.', () => [
    cast('Venom summoned', ['fumes.toxic.green', 'fumes.04.complete.grey'], { stageId: 'c', scale: 0.6, duration: 1000 }),
    impact('Venom coats', ['liquid.splash.green', 'liquid.splash.blue'], { stageId: 'coat', after: 'c', anchor: 'start', offset: 500, duration: 1300, scale: 0.6, ...tint('#5fcf3a') }),
    aura('Dripping venom', ['icon.poison.dark_green'], { subject: 'targets', after: 'coat', anchor: 'start', offset: 600, duration: 1600, scale: 0.4, offsetY: -0.55, offsetUnits: 'token', fadeIn: 200, fadeOut: 500 }),
  ]),

  // Eradicate Undeath: massive deluge of life energy in a 30-foot cone.
  'pf2e:J5MNC4xq3CHH31qT': design('A golden-white torrent of vitality pours through the cone and undead in it stagger apart, replacing drifting heart icons.', () => [
    cast('Life gathers', ['healing_generic.burst.yellowwhite', 'healing_generic.burst.greenorange'], { stageId: 'c', scale: 0.7, duration: 900 }),
    area('Vitality deluge', ['breath_weapons.fire.cone.yellow.01', 'breath_weapons.fire.cone.orange.01'], { stageId: 'cone', after: 'c', anchor: 'start', offset: 350, duration: 2000, ...tint('#fff2b8') }),
    area('Radiant motes', ['template_cone_PF2e.001.001.white', 'template_cone_PF2e.001.001.purplered'], { after: 'cone', anchor: 'start', offset: 200, duration: 2000, opacity: 0.6, ...tint('#ffe9a0') }),
    motion('stagger', 'targets', { after: 'cone', anchor: 'start', offset: 500, duration: 900 }),
  ]),

  // Execute: point at a creature and invoke the demise of all things (70 void damage).
  'pf2e:Z9OrRXKgAPv6Hn5l': design('A pointed death invocation: void gathers, a tolling skull of doom strikes the target, which staggers; the healing-glow sound was wrong for a death spell.', () => [
    cast('Demise invoked', ['cast_generic.02.dark_purple', 'cast_generic.02.blue'], { stageId: 'c', scale: 0.7, duration: 900, ...tint('#3a1450') }),
    motion('lunge', 'source', { after: 'c', anchor: 'start', offset: 300, duration: 500, intensity: 0.4 }),
    impact('Death knell', ['toll_the_dead.purple.skull_smoke', 'toll_the_dead.green.skull_smoke'], { stageId: 'skull', after: 'c', anchor: 'start', offset: 550, duration: 2000, scale: 0.9 }),
    impact('Void rupture', ['impact.011.dark_purple', 'impact.011.blue'], { after: 'skull', anchor: 'start', offset: 600, duration: 1200, scale: 0.8 }),
    motion('stagger', 'targets', { after: 'skull', anchor: 'start', offset: 650, duration: 900 }),
  ], { sound: 'void' }),

  // Exploding Earth: hurl a packed ball of earth and stone that explodes on impact, with splash.
  'pf2e:v89KwyaBd6g5rWVS': design('A thrown stone ball bursts on the target in a shower of earth; the 6 s ground-crack impact was trimmed and a throw gesture added.', () => [
    cast('Earth packs tight', ['cast_generic.earth.01.browngreen'], { stageId: 'c', scale: 0.6, duration: 700 }),
    motion('throw', 'source', { after: 'c', anchor: 'start', offset: 300, duration: 600 }),
    travel('Earth ball', ['boulder.toss.02.01.stone.brown'], { stageId: 'toss', after: 'c', anchor: 'start', offset: 450, duration: 1300, scale: 0.5 }),
    impact('Ball explodes', ['impact.boulder.02', 'impact.ground_crack.01.orange'], { stageId: 'hit', after: 'toss', anchor: 'start', offset: 900, duration: 1400, scale: 0.8 }),
    impact('Earth splash', ['falling_rocks.top.1x1.sandstone', 'falling_rocks.top.1x1.grey'], { after: 'hit', anchor: 'start', offset: 150, duration: 1500, scale: 0.9 }),
    motion('recoil', 'targets', { after: 'hit', anchor: 'start', duration: 650 }),
  ]),

  // Extract Poison: siphon poison out of a touched object into your held weapon.
  'pf2e:CLThxp8Qf43IQ3Sb': design('Green toxin is siphoned out of the touched object and coats the caster\'s weapon, instead of a purple life-drain.', () => [
    impact('Poison drawn out', ['particles.outward.greenyellow.01.04'], { stageId: 'out', duration: 1300, scale: 0.6 }),
    travel('Toxin flows to the blade', ['energy_strands.range.standard.dark_green.01', 'energy_strands.range.standard.purple.01'], { stageId: 'flow', after: 'out', anchor: 'start', offset: 300, duration: 1400, scale: 0.6, ...tint('#7ad13a') }),
    aura('Weapon coated', ['icon.poison.dark_green'], { after: 'flow', anchor: 'start', offset: 900, duration: 1500, scale: 0.4, offsetX: 0.35, offsetUnits: 'token', fadeIn: 200, fadeOut: 400 }),
  ], { sound: 'poison' }),

  // Faerie Fire: creatures in the burst are limned in colourful, heatless fire.
  'pf2e:HRb2doyaLtaoCfi3': design('Sparkling motes fill the burst and each creature is briefly limned in cool violet flame.', () => [
    area('Faerie motes', ['swirling_sparkles.01.bluepink', 'swirling_sparkles.01.blue'], { stageId: 'sp', duration: 2600, fadeOut: 500 }),
    aura('Limned in heatless fire', ['flames.01.purple', 'flames.01.orange'], { subject: 'targets', after: 'sp', anchor: 'start', offset: 500, duration: 2400, scale: 0.9, opacity: 0.55, fadeIn: 300, fadeOut: 600, ...tint('#c77dff') }),
  ]),

  // Fallen Soldier's Lament: an illusory ghost of a fallen foe paraded across the field, frightening enemies.
  'pf2e:LjLSvAqnR03EnITX': design('A ghostly sprite of the fallen foe rises in spectral mist and enemies cower; the 9 s smoke plume was cut.', () => [
    impact('Ghost mist', ['smoke.puff.centered.dark_purple', 'smoke.puff.centered.grey'], { stageId: 'mist', duration: 1600, scale: 0.8 }),
    sprite('Fallen foe\'s ghost', { after: 'mist', anchor: 'start', offset: 300, duration: 2400, opacity: 0.5, offsetY: -0.2, offsetUnits: 'token', fadeIn: 400, fadeOut: 600 }),
    impact('Lament', ['icon.fear.dark_purple'], { after: 'mist', anchor: 'start', offset: 900, duration: 1500, scale: 0.45, offsetY: -0.6, offsetUnits: 'token' }),
    motion('cower', 'targets', { after: 'mist', anchor: 'start', offset: 1000, duration: 1000 }),
  ]),

  // Falling Sky: telekinetic pressure smashes everything in the cylinder to the ground.
  'pf2e:vm9O7ne48NM72yrJ': design('Crushing telekinetic pressure descends over the cylinder and slams creatures to the cracking ground.', () => [
    cast('Pressure gathers', ['glint.purple.few', 'glint.yellow.few'], { stageId: 'c', scale: 0.9, duration: 700 }),
    area('Pressure descends', ['energy_field.02.above.purple', 'energy_field.02.above.blue'], { stageId: 'p', after: 'c', anchor: 'start', offset: 500, duration: 2200 }),
    area('Floor buckles', ['ground_cracks.02.purple', 'ground_cracks.02.orange'], { after: 'p', anchor: 'start', offset: 900, duration: 2000, below: true }),
    motion('press', 'targets', { after: 'p', anchor: 'start', offset: 600, duration: 1100 }),
  ], { sound: 'gravity' }),

  // Falling Stars: four stars crash down and explode in 40-foot bursts.
  'pf2e:jrBa9deU2ULFWvSl': design('Falling stars crash down: a rock-and-star impact cracks the centre then a bright energy explosion floods the burst, replacing drifting twinkles.', () => [
    cast('Reach into the sky', ['glint.yellow.many'], { stageId: 'c', scale: 0.8, duration: 700 }),
    area('Star strikes', ['falling_rocks.top.2x1.orange', 'falling_rocks.top.2x1.grey'], { stageId: 'hit', after: 'c', anchor: 'start', offset: 400, duration: 1400, scale: 0.4 }),
    area('Star explosion', ['explosion.05.bluewhite', 'explosion.02.blue'], { stageId: 'boom', after: 'hit', anchor: 'start', offset: 500, duration: 1800 }),
    area('Impact crater', ['impact.ground_crack.01.white', 'impact.ground_crack.01.orange'], { after: 'hit', anchor: 'start', offset: 500, duration: 2200, scale: 0.4, below: true }),
    motion('recoil', 'targets', { after: 'boom', anchor: 'start', offset: 150, duration: 650 }),
  ], { sound: 'explosion' }),

  // Fateful Condemnation: echoes of past lives instill despair; a shimmering mist aura surrounds the target.
  'pf2e:ReUoodsqUYSTwSgE': design('Spectral echoes of past lives swirl around the target, then a shimmering mist settles about it as despair takes hold.', () => [
    cast('Fate drawn upon', ['cast_shape.circle.01.purple', 'cast_generic.02.blue'], { stageId: 'c', scale: 0.8, duration: 900 }),
    impact('Echoes of past lives', ['spirit_guardians.dark_purple.spirits', 'spirit_guardians.blueyellow.ring'], { stageId: 'echo', after: 'c', anchor: 'start', offset: 450, duration: 2200, scale: 0.45, fadeOut: 500 }),
    aura('Shimmering mist', ['fog_cloud.02.white', 'fog_cloud.01.white'], { subject: 'targets', after: 'echo', anchor: 'start', offset: 800, duration: 2400, scale: 0.9, opacity: 0.55, fadeIn: 400, fadeOut: 700, ...tint('#b9a6d9') }),
    motion('cower', 'targets', { after: 'echo', anchor: 'start', offset: 700, duration: 1000, intensity: 0.7 }),
  ]),

  // Feral Shades: grey void mist spills out in a cone, shaped like a pack of predators that savage foes.
  'pf2e:Ru9v8U9IRk3LtWx8': design('A grey void mist washes through the cone and spectral claws rake each creature, replacing a slow smoke projectile over a cone outline.', () => [
    cast('Void gathers', ['cast_generic.02.dark_purple', 'cast_generic.02.blue'], { stageId: 'c', scale: 0.7, duration: 800, ...tint('#5d5670') }),
    area('Grey predator mist', ['breath_weapons.poison.cone.dark_black', 'breath_weapons.poison.cone.green'], { stageId: 'cone', after: 'c', anchor: 'start', offset: 350, duration: 2000, ...tint('#7d7890') }),
    impact('Shades savage', ['claws.200px.bright_purple', 'claws.200px.red'], { stageId: 'claw', after: 'cone', anchor: 'start', offset: 500, duration: 1300, scale: 0.8, ...tint('#a69bc4') }),
    motion('recoil', 'targets', { after: 'claw', anchor: 'start', offset: 200, duration: 600 }),
  ]),

  // Ferrous Form: your body becomes flexible iron.
  'pf2e:89Hj5QuqvcwVXcqj': design('Same iron-plating transformation, but with a ringing metal sound instead of the healing-glow chime.', () => [
    cast('Iron spreads', ['cast_generic.02.dark_purple', 'cast_generic.02.blue'], { stageId: 'c', scale: 0.9, duration: 900, ...tint('#b8bcc4') }),
    sprite('Silhouette hardens', { after: 'c', anchor: 'start', offset: 400, duration: 1200, opacity: 0.5, fadeOut: 400 }),
    aura('Metal plates close', ['aura_themed.01.inward.complete.metal.01.grey'], { after: 'c', anchor: 'start', offset: 500, duration: 2000, scale: 1 }),
    motion('brace', 'source', { after: 'c', anchor: 'start', offset: 700, duration: 900 }),
  ], { sound: 'metal' }),

  // Field of Life: a field of warm life energy heals the living and burns undead.
  'pf2e:x5rGOmhDRDVQPrnW': design('A warm golden aura of life spreads over the burst with healing motes rising from those inside, instead of a giant heart icon.', () => [
    area('Field of life', ['template_circle.aura.01.complete.large.yellow', 'template_circle.aura.01.complete.large.bluepurple'], { stageId: 'f', duration: 4000, opacity: 0.85, fadeIn: 400, fadeOut: 700, ...tint('#ffe08a') }),
    impact('Rejuvenation', ['healing_generic.400px.yellow'], { after: 'f', anchor: 'start', offset: 700, duration: 1800, scale: 0.6 }),
  ]),

  // Fiendish Rift: a tear to a fiendish plane opens; fiends reach out and grab creatures.
  'pf2e:oQXM2XeIDGOmFuZr': design('A blood-red planar tear opens over the burst, clutching fiendish appendages rise from it and grab creatures (stagger).', () => [
    area('Fiendish tear', ['portals.horizontal.vortex.red', 'portals.horizontal.ring.bright_yellow'], { stageId: 'rift', duration: 3800, scale: 0.8, fadeIn: 300, fadeOut: 600, ...tint('#8a1010') }),
    area('Fiends reach out', ['black_tentacles.dark_purple'], { stageId: 'grab', after: 'rift', anchor: 'start', offset: 500, duration: 3000, scale: 0.9, ...tint('#7a1a2a') }),
    motion('stagger', 'targets', { after: 'grab', anchor: 'start', offset: 600, duration: 900 }),
  ]),

  // Final Fate of the Locust Host: conjure Deskari's rotting, vermin-riddled corpse; stench sickens foes.
  'pf2e:bIz6QnUIxu5Z7vEH': design('The rotting Lord of Locusts arrives in black smoke wrapped in a buzzing locust haze; its stench sickens enemies, instead of the caster levitating on feathers.', () => [
    cast('Corpse arrives', ['smoke.puff.ring.01.dark_black', 'smoke.puff.ring.01.white'], { stageId: 'arr', scale: 1.4, duration: 1600 }),
    aura('Locust haze', ['fireflies.many.01.orange', 'fireflies.many.01.green'], { stageId: 'haze', after: 'arr', anchor: 'start', offset: 400, duration: 3200, scale: 1.8, fadeIn: 300, fadeOut: 600, ...tint('#5b4a22') }),
    aura('Putrid stench', ['fumes.toxic.green', 'fumes.04.complete.grey'], { after: 'arr', anchor: 'start', offset: 700, duration: 2800, scale: 1.6, opacity: 0.55, below: true, fadeOut: 600 }),
    impact('Sickened', ['icon.poison.dark_green'], { after: 'haze', anchor: 'start', offset: 900, duration: 1400, scale: 0.4, offsetY: -0.55, offsetUnits: 'token' }),
    motion('stagger', 'targets', { after: 'haze', anchor: 'start', offset: 900, duration: 900, intensity: 0.7 }),
  ]),

  // Final Sacrifice: your minion violently explodes, burning everything within 20 feet.
  'pf2e:x0rWq0wS06dns4G2': design('Disruptive energy shakes the minion, which detonates in a fiery 20-foot blast; the 8.7 s smoke tail was cut.', () => [
    cast('Bond channels ruin', ['cast_generic.fire.01.orange'], { stageId: 'c', scale: 0.7, duration: 700 }),
    impact('Minion destabilises', ['static_electricity.01.orange', 'static_electricity.01.blue'], { stageId: 'unstable', after: 'c', anchor: 'start', offset: 400, duration: 900, scale: 0.8 }),
    motion('shake', 'targets', { after: 'unstable', anchor: 'start', duration: 900, intensity: 0.8 }),
    area('Minion explodes', ['fireball.explosion.orange'], { stageId: 'boom', after: 'unstable', anchor: 'end', offset: -100, duration: 1800 }),
    area('Smoke disperses', ['smoke.puff.ring.01.dark_black', 'smoke.puff.ring.01.white'], { after: 'boom', anchor: 'start', offset: 700, duration: 1600, opacity: 0.6 }),
  ]),

  // Flame Wisp: three faintly glowing wisps of fire float around your head.
  'pf2e:3q9tBMWsWQKlXPPJ': design('Three distinct flame wisps appear in a ring around the caster\'s head instead of overlapping on one spot.', () => [
    cast('Wisp one', ['dancing_light.yellow'], { stageId: 'w1', duration: 2600, scale: 0.22, offsetX: -0.4, offsetY: -0.45, offsetUnits: 'token', fadeIn: 200, fadeOut: 500, ...tint('#ff8a3d') }),
    cast('Wisp two', ['dancing_light.yellow'], { after: 'w1', anchor: 'start', offset: 250, duration: 2400, scale: 0.22, offsetX: 0.4, offsetY: -0.45, offsetUnits: 'token', fadeIn: 200, fadeOut: 500, ...tint('#ff8a3d') }),
    cast('Wisp three', ['dancing_light.yellow'], { after: 'w1', anchor: 'start', offset: 500, duration: 2200, scale: 0.22, offsetY: -0.7, offsetUnits: 'token', fadeIn: 200, fadeOut: 500, ...tint('#ffb347') }),
  ]),

  // Flammable Fumes: an invisible toxic cloud that later becomes explosive.
  'pf2e:6AqH5SGchbdhOJxA': design('A faint, barely visible toxic haze settles over the burst with a poison sigil; trimmed from an 8 s opaque cloud since the gas is invisible.', () => [
    area('Faint toxic gas', ['fumes.04.complete.grey'], { stageId: 'gas', duration: 4200, opacity: 0.35, fadeIn: 500, fadeOut: 800, ...tint('#9fb36a') }),
    area('Toxic sigil', ['template_circle.symbol.normal.poison.dark_green'], { after: 'gas', anchor: 'start', offset: 500, duration: 2500, opacity: 0.5, scale: 0.6 }),
  ]),

  // Flashy Disappearance: a puff of colourful smoke as you turn invisible and Stride.
  'pf2e:YgbYvkLvnWJ4WfEA': design('A puff of multicoloured smoke bursts and the caster flickers out of sight.', () => [
    cast('Colourful smoke', ['smoke.puff.ring.01.multicolored', 'smoke.puff.ring.01.white'], { stageId: 'puff', scale: 1.2, duration: 1600 }),
    motion('flicker', 'source', { after: 'puff', anchor: 'start', offset: 200, duration: 900 }),
    sprite('Vanishing silhouette', { after: 'puff', anchor: 'start', offset: 200, duration: 1100, opacity: 0.5, fadeOut: 700 }),
  ]),

  // Flicker: flicker between planes; teleport 10 feet at random each turn.
  'pf2e:zR67Rt3UMHKC5evy': design('Planar shimmer with the caster visibly flickering in and out, rather than only a static portal.', () => [
    cast('Planes overlap', ['portals.horizontal.ring_masked.purple', 'misty_step.01.blue'], { stageId: 'p', scale: 0.8, duration: 1200 }),
    cast('Phase shimmer', ['misty_step.01.purple', 'misty_step.01.blue'], { after: 'p', anchor: 'start', offset: 450, duration: 900, scale: 1.1 }),
    motion('flicker', 'source', { after: 'p', anchor: 'start', offset: 500, duration: 1400 }),
    sprite('Phase echo', { after: 'p', anchor: 'start', offset: 600, duration: 1000, opacity: 0.45, offsetX: 0.3, offsetUnits: 'token', fadeOut: 500 }),
  ]),

  // Flowing Strike: a wave of water pushes you up to 50 feet; the wave batters your Strike's target.
  'pf2e:zCLyETFoPqCQXLVy': design('The caster rides a rushing wave toward the foe and the following water crashes into the target, pushing it back; there was no movement before.', () => [
    cast('River surges', ['water_splash.circle.01.blue'], { stageId: 'surge', scale: 0.9, duration: 1200, below: true }),
    motion('rush', 'source', { stageId: 'ride', after: 'surge', anchor: 'start', offset: 300, duration: 1100, distance: 5, intensity: 0.6, motionRange: 'target', motionHeading: 'toward', motionEndpoint: 'near' }),
    aura('Wave behind', ['liquid.splash_side.blue'], { after: 'surge', anchor: 'start', offset: 300, duration: 1100, scale: 0.8, opacity: 0.8 }),
    impact('Wave batters', ['liquid.splash_side.bright_blue', 'liquid.splash_side.blue'], { stageId: 'hit', after: 'ride', anchor: 'arrival', duration: 1400, scale: 0.9 }),
    motion('recoil', 'targets', { after: 'ride', anchor: 'arrival', offset: 100, duration: 700, intensity: 1 }),
  ]),

  // For Love, For Lightning: weapon plunged into the ground crackles with crimson lightning that arcs to an enemy.
  'pf2e:mtxMpGWpwwWSbySj': design('The weapon is driven into the ground and crimson lightning arcs to the foe; colour fixed from blue and the 6 s arc trimmed.', () => [
    motion('slam', 'source', { stageId: 'plunge', duration: 600, intensity: 0.6 }),
    cast('Weapon plunged', ['impact.ground_crack.01.dark_red', 'impact.ground_crack.01.orange'], { stageId: 'gc', after: 'plunge', anchor: 'start', offset: 300, duration: 1500, scale: 0.6, below: true }),
    cast('Crimson crackle', ['static_electricity.03.red', 'static_electricity.03.blue'], { after: 'gc', anchor: 'start', duration: 1800, scale: 0.8, ...tint('#e0203a') }),
    travel('Crimson arc', ['electric_arc.blue.01', 'electric_arc.01'], { stageId: 'arc', after: 'gc', anchor: 'start', offset: 500, duration: 1200, scale: 0.8, ...tint('#e0203a') }),
    impact('Discharge', ['static_electricity.02.red', 'static_electricity.02.blue'], { after: 'arc', anchor: 'start', offset: 600, duration: 1300, ...tint('#e0203a') }),
    motion('shake', 'targets', { after: 'arc', anchor: 'start', offset: 600, duration: 700, intensity: 0.7 }),
  ]),

  // Flesh Tsunami: a thrall melts into a massive wave of sticky flesh across a 60-foot cone.
  'pf2e:jtACJQc6n9ZaG9kA': design('A thrall bursts into a crimson wave of flesh that sweeps the cone and mires foes, instead of a splash projectile over a cone outline.', () => [
    impact('Thrall liquefies', ['liquid.splash02.red'], { stageId: 'melt', duration: 1300, scale: 0.9 }),
    area('Flesh wave', ['breath_weapons.poison.cone.red', 'breath_weapons.poison.cone.green'], { stageId: 'wave', after: 'melt', anchor: 'start', offset: 400, duration: 2200, ...tint('#8a1c2b') }),
    motion('stagger', 'targets', { after: 'wave', anchor: 'start', offset: 600, duration: 900, intensity: 0.6 }),
  ]),

  // Force Bolt: an arrow-shaped bolt of force that automatically hits.
  'pf2e:Hu38hoAUSYeFpkVa': design('Same single force missile, but the contact flash is trimmed from 5.9 s to a crisp hit.', () => [
    cast('Shape the bolt', ['cast_shape.circle.single01.purple', 'cast_generic.02.blue'], { stageId: 'c', scale: 0.7, duration: 600 }),
    travel('Force bolt', ['magic_missile.purple'], { stageId: 'bolt', after: 'c', anchor: 'start', offset: 350, duration: 1300, scale: 0.65 }),
    impact('Force contact', ['impact.010.purple', 'impact.010.orange'], { stageId: 'hit', after: 'bolt', anchor: 'start', offset: 950, duration: 1100, scale: 0.9, ...tint('#b48cff') }),
    motion('recoil', 'targets', { after: 'hit', anchor: 'start', duration: 600 }),
  ]),

  // Force Fang: your weapon or fist becomes a spike of force against a foe in reach.
  'pf2e:9mPEoOPN0AMuixIv': design('A melee lunge with a force-trailed strike and a force flash on the target; the original had no attacker movement.', () => [
    motion('lunge', 'source', { stageId: 'lunge', duration: 650 }),
    cast('Force fang', ['melee_attack.01.trail.01.blueyellow'], { after: 'lunge', anchor: 'start', duration: 1200, scale: 0.8 }),
    impact('Force spike', ['energy_attack.01.blue'], { stageId: 'hit', after: 'lunge', anchor: 'start', offset: 300, duration: 1300, scale: 0.75 }),
    motion('recoil', 'targets', { after: 'hit', anchor: 'start', offset: 100, duration: 550 }),
  ]),

  // Force Fling: a force echo of your weapon flies out to Strike a foe within 15 feet.
  'pf2e:cd6cVkRwleJvAY68': design('The caster swings and a spectral force copy of the weapon flies to the foe and strikes; added the swing and the target reaction.', () => [
    motion('lunge', 'source', { stageId: 'swing', duration: 600, intensity: 0.6 }),
    projectile('Force echo flies', ['spiritual_weapon.longsword.01.astral.01.purple', 'spiritual_weapon.longsword.01.spectral.02.green'], { stageId: 'fly', after: 'swing', anchor: 'start', offset: 200, duration: 1300, scale: 0.7 }),
    impact('Echo strikes', ['melee_generic.slashing.one_handed', 'melee_generic.slash.02.001.blue'], { stageId: 'hit', after: 'fly', anchor: 'start', offset: 1100, duration: 1100 }),
    motion('recoil', 'targets', { after: 'hit', anchor: 'start', duration: 600 }),
  ]),

  // Force Rain: a magical cloud batters creatures with shards of solidified magic.
  'pf2e:3zw2UJPEdRSLzigN': design('A violet force cloud gathers over the area and rains glittering force shards, instead of a green fog with falling rocks.', () => [
    cast('Call the cloud', ['glint.purple.few', 'glint.yellow.few'], { stageId: 'c', scale: 0.8, duration: 600 }),
    area('Force cloud', ['fog_cloud.02.white', 'fog_cloud.01.white'], { stageId: 'cloud', after: 'c', anchor: 'start', offset: 400, duration: 3200, opacity: 0.6, fadeIn: 300, fadeOut: 600, ...tint('#a58bff') }),
    area('Shards rain down', ['cloud_of_daggers.daggers.purple'], { stageId: 'rain', after: 'cloud', anchor: 'start', offset: 500, duration: 2400, scale: 0.9 }),
    motion('shake', 'targets', { after: 'rain', anchor: 'start', offset: 400, duration: 900, intensity: 0.6 }),
  ]),

  // Forge: superheat the target (especially metal), dealing fire damage.
  'pf2e:FTR8m4qrhYzTRyrD': design('The target glows white-hot as heat floods inward and flames lick it; trimmed from an 8 s metal aura.', () => [
    cast('Heat channelled', ['cast_generic.fire.01.orange'], { stageId: 'c', scale: 0.6, duration: 700 }),
    impact('Superheating', ['particles.inward.orange.01.04', 'particles.inward.greenyellow.01.04'], { stageId: 'heat', after: 'c', anchor: 'start', offset: 350, duration: 1300, scale: 0.8, ...tint('#ff7a2a') }),
    impact('Red-hot flare', ['flames.01.orange'], { after: 'heat', anchor: 'start', offset: 600, duration: 1800, scale: 0.8 }),
    motion('shake', 'targets', { after: 'heat', anchor: 'start', offset: 700, duration: 700, intensity: 0.5 }),
  ]),

  // Foul Miasma: a target's disease is drawn out into an infectious mist in a 15-foot emanation.
  'pf2e:6nTBr5XNuKOuPM5m': design('Sickly mist boils out of the target and spreads around it as an infectious emanation, trimmed from a 7.8 s cloud.', () => [
    cast('Disease called out', ['fumes.04.complete.purple', 'fumes.04.complete.grey'], { stageId: 'c', scale: 0.6, duration: 900 }),
    aura('Infectious miasma', ['fumes.toxic.green', 'fumes.04.complete.grey'], { subject: 'targets', stageId: 'mist', after: 'c', anchor: 'start', offset: 450, duration: 3200, scale: 2.2, opacity: 0.7, fadeIn: 300, fadeOut: 700, ...tint('#8fa860') }),
    motion('stagger', 'targets', { after: 'mist', anchor: 'start', offset: 300, duration: 800, intensity: 0.5 }),
  ], { sound: 'poison' }),

  // Fractious Echo: a bludgeoning Strike knocks the body back 10 feet and leaves its spirit behind.
  'pf2e:0KI1hoBAevIc9xoS': design('A heavy blow sends the target flying back while its spiritual echo stays where it stood; previously there was no strike motion or push.', () => [
    motion('lunge', 'source', { stageId: 'lunge', duration: 650 }),
    impact('Battering blow', ['unarmed_strike.physical.01.blue'], { stageId: 'hit', after: 'lunge', anchor: 'start', offset: 250, duration: 1200, scale: 0.9 }),
    sprite('Spiritual echo', { subject: 'targets', after: 'hit', anchor: 'start', offset: 200, duration: 2200, opacity: 0.45, fadeOut: 700, ...tint('#8fd0ff') }),
    impact('Spirit exposed', ['energy_strands.complete.blue.01'], { after: 'hit', anchor: 'start', offset: 250, duration: 1800, scale: 0.8 }),
    motion('rush', 'targets', { after: 'hit', anchor: 'start', offset: 200, duration: 800, distance: 2, intensity: 0.6, motionRange: 'distance', motionHeading: 'away' }),
  ], { sound: 'bludgeon' }),

  // Freeze Time: stop time for everything but yourself.
  'pf2e:1dsahW4g1ggXtypx': design('A brief frozen-moment flash with a still afterimage instead of a 17.6 s spinning icosahedron.', () => [
    cast('Time halts', ['icosahedron.simple.blue', 'icosahedron.simple'], { stageId: 'c', scale: 0.8, duration: 2600, fadeIn: 200, fadeOut: 600 }),
    cast('Stilled world', ['template_circle.out_pulse.01.burst.bluewhite'], { after: 'c', anchor: 'start', offset: 300, duration: 1800, scale: 1.6, opacity: 0.6 }),
    sprite('Held instant', { after: 'c', anchor: 'start', offset: 600, duration: 2000, opacity: 0.4, fadeOut: 700 }),
  ]),

  // Freezing Touch: the cold of a blizzard in one touch freezes the target in place.
  'pf2e:v2KE1ueuO5EjvF78': design('A frost-laden touch: the caster reaches in, ice spikes burst on the target and it locks rigid, instead of an 8 s cold aura.', () => [
    cast('Blizzard cold gathers', ['cast_generic.ice.01.blue', 'cast_generic.02.blue'], { stageId: 'c', scale: 0.6, duration: 700 }),
    motion('lunge', 'source', { stageId: 'touch', after: 'c', anchor: 'start', offset: 300, duration: 600 }),
    impact('Frost crystallizes', ['ice_spikes.radial.burst.white'], { stageId: 'ice', after: 'touch', anchor: 'start', offset: 250, duration: 1500, scale: 0.8 }),
    aura('Frozen in place', ['ice_spikes.radial.loop.white'], { subject: 'targets', after: 'ice', anchor: 'start', offset: 700, duration: 1600, scale: 0.8, opacity: 0.7, fadeOut: 500 }),
    motion('shake', 'targets', { after: 'ice', anchor: 'start', offset: 100, duration: 600, intensity: 0.4 }),
  ]),

  // Frigid Flurry: a 120-foot line of freezing shards; the wind carries you to the other end as snow.
  'pf2e:vFkz0gVBUT2gGnm1': design('A frost gust tears down the line and the caster, turned to snow, is carried along it past the foes; previously the caster never moved.', () => [
    cast('Cold breath', ['cast_generic.ice.01.blue', 'cast_generic.02.blue'], { stageId: 'c', scale: 0.7, duration: 700 }),
    area('Shard-laden gust', ['ray_of_frost.blue'], { stageId: 'gust', after: 'c', anchor: 'start', offset: 300, duration: 1800 }),
    area('Snow flurry', ['wind_stream.white'], { after: 'gust', anchor: 'start', offset: 150, duration: 1800, opacity: 0.7, ...tint('#d6f0ff') }),
    sprite('Snow-crystal silhouette', { after: 'gust', anchor: 'start', offset: 300, duration: 1200, opacity: 0.4, fadeOut: 500, ...tint('#d6f0ff') }),
    motion('rush', 'source', { after: 'gust', anchor: 'start', offset: 400, duration: 1300, distance: 8, intensity: 0.6, motionRange: 'target', motionEndpoint: 'past' }),
    motion('shake', 'targets', { after: 'gust', anchor: 'start', offset: 500, duration: 700, intensity: 0.5 }),
  ]),

  // Frog Tongue: your tongue lashes out to strike and stick to a creature.
  'pf2e:cnRltZAjU9aCklqz': design('A pink tongue lashes out and smacks the target, which is jerked; the stone-rumble sound did not fit.', () => [
    motion('lunge', 'source', { stageId: 'lash', duration: 500, intensity: 0.5 }),
    travel('Tongue lashes', ['energy_strands.range.standard.purple.01'], { stageId: 'tongue', after: 'lash', anchor: 'start', offset: 100, duration: 1300, scale: 0.35, ...tint('#e08aa8') }),
    impact('Sticky smack', ['liquid.splash.bright_green', 'liquid.splash.blue'], { stageId: 'hit', after: 'tongue', anchor: 'start', offset: 450, duration: 1100, scale: 0.4, ...tint('#e7a2bd') }),
    motion('recoil', 'targets', { after: 'hit', anchor: 'start', duration: 550 }),
  ], { sound: 'bludgeon' }),

  // Frozen Lungs: freezing water pools in the target's lungs.
  'pf2e:g90j3T60ScfWQZaf': design('Icy water condenses into the target\'s chest and it chokes and staggers, instead of two 8 s overlays.', () => [
    cast('Water pulled', ['cast_generic.water.02.blue'], { stageId: 'c', scale: 0.6, duration: 700 }),
    impact('Water pools within', ['liquid.blob.blue'], { stageId: 'pool', after: 'c', anchor: 'start', offset: 350, duration: 1400, scale: 0.4, offsetY: 0.05, offsetUnits: 'token' }),
    impact('Lungs freeze', ['aura_themed.01.inward.complete.cold.01.blue'], { after: 'pool', anchor: 'start', offset: 600, duration: 1800, scale: 0.7, fadeOut: 500 }),
    motion('stagger', 'targets', { after: 'pool', anchor: 'start', offset: 700, duration: 900 }),
  ]),

  // Fulminating Impact: a melee Strike charged with electricity and sonic force.
  'pf2e:vNc9vsGyb27POoES': design('A charged palm, a lunging Strike and a thunderclap of electricity and sound on the target; nothing previously landed on the target.', () => [
    cast('Charged palm', ['static_electricity.02.blue'], { stageId: 'c', scale: 0.6, duration: 800 }),
    motion('lunge', 'source', { stageId: 'lunge', after: 'c', anchor: 'start', offset: 400, duration: 650 }),
    impact('Charged blow', ['unarmed_strike.magical.01.blue'], { stageId: 'hit', after: 'lunge', anchor: 'start', offset: 250, duration: 1100 }),
    impact('Fulmination', ['static_electricity.01.blue'], { after: 'hit', anchor: 'start', offset: 150, duration: 1200, scale: 0.9 }),
    impact('Shockwave', ['soundwave.02.blue'], { after: 'hit', anchor: 'start', offset: 200, duration: 1100, scale: 0.6 }),
    motion('recoil', 'targets', { after: 'hit', anchor: 'start', offset: 100, duration: 650 }),
  ]),

  // Fungal Exhalation: exhale toxic mold spores in a 15-foot cone.
  'pf2e:H481wmQUtEUhxHzi': design('A mould-green cloud of spores billows through the cone and sickened creatures stagger.', () => [
    cast('Exhale', ['smoke.puff.side.green', 'smoke.puff.side.grey'], { stageId: 'c', scale: 0.5, duration: 800 }),
    area('Spore cloud', ['breath_weapons.poison.cone.green'], { stageId: 'cone', after: 'c', anchor: 'start', offset: 200, duration: 2200, ...tint('#8aa35a') }),
    area('Drifting spores', ['particles.002.001.complete.few.greenpurple', 'particles.002.001.complete.few.blue'], { after: 'cone', anchor: 'start', offset: 400, duration: 2000, opacity: 0.8, ...tint('#a6b86a') }),
    motion('stagger', 'targets', { after: 'cone', anchor: 'start', offset: 600, duration: 800, intensity: 0.5 }),
  ]),

  // Fungal Infestation: toxic spores swarm over creatures in a cone; grotesque growths erupt.
  'pf2e:3VxVbZqIRvpKkg3O': design('A spore cone washes over foes and fungal growths erupt on them, trimmed from an 8 s cone with a residue at 9 s.', () => [
    cast('Spores gather', ['fumes.toxic.green', 'fumes.04.complete.grey'], { stageId: 'c', scale: 0.8, duration: 700 }),
    area('Spore swarm', ['breath_weapons.poison.cone.green'], { stageId: 'cone', after: 'c', anchor: 'start', offset: 300, duration: 2200 }),
    impact('Fungal growths erupt', ['plant_growth.03.round.2x2.complete.greenyellow'], { after: 'cone', anchor: 'start', offset: 800, duration: 2200, scale: 0.5, ...tint('#9a8f5a') }),
    motion('stagger', 'targets', { after: 'cone', anchor: 'start', offset: 900, duration: 800, intensity: 0.6 }),
  ]),

  // Gale Blast: wind whirls around you in a 5-foot emanation, pushing creatures away.
  'pf2e:dDiOnjcsBFbAvP6t': design('A short whirl of wind around the caster shoves adjacent creatures outward; trimmed from an 8 s whirlwind.', () => [
    area('Whirling gale', ['whirlwind.bluewhite', 'whirlwind.bluegrey'], { stageId: 'w', duration: 1800, fadeOut: 500 }),
    area('Gust ring', ['template_circle.out_pulse.01.burst.bluewhite'], { after: 'w', anchor: 'start', offset: 250, duration: 1300, opacity: 0.6 }),
    motion('rush', 'targets', { after: 'w', anchor: 'start', offset: 400, duration: 700, distance: 1, intensity: 0.6, motionRange: 'distance', motionHeading: 'away' }),
  ]),

  // Garden of Stone: a 10-foot-tall stalagmite erupts, piercing and pushing creatures; smaller spikes around it.
  'pf2e:YZiPAxdZFYXu6BvA': design('Stone spikes erupt from cracking ground across the burst and shove creatures aside, instead of cracks alone.', () => [
    cast('Ground shakes', ['ground_cracks.03.orange'], { stageId: 'c', scale: 0.8, duration: 900, below: true }),
    area('Ground fractures', ['ground_cracks.01.orange'], { stageId: 'gc', after: 'c', anchor: 'start', offset: 400, duration: 2400, below: true }),
    area('Stalagmite erupts', ['ice_spikes.radial.burst.grey', 'ice_spikes.radial.burst.white'], { stageId: 'spike', after: 'gc', anchor: 'start', offset: 250, duration: 1800, ...tint('#8a7a62') }),
    motion('recoil', 'targets', { after: 'spike', anchor: 'start', offset: 150, duration: 700 }),
  ]),

  // Garden of the Green Man's Growth: a green man erupts from the ground in a burst of lush growth.
  'pf2e:jQgX7zChqjFrU7Q1': design('Lush growth bursts outward around the caster and vines lash up, knocking foes back; trimmed from two 9 s loops.', () => [
    cast('Call to the green man', ['cast_generic.earth.01.browngreen'], { stageId: 'c', scale: 1, duration: 900 }),
    cast('Verdant bloom', ['plant_growth.03.round.2x2.complete.greenyellow'], { stageId: 'bloom', after: 'c', anchor: 'start', offset: 400, duration: 3500, scale: 1.6, fadeOut: 600 }),
    cast('Green man\'s vines', ['vine.complete.nature.group.01.green'], { after: 'bloom', anchor: 'start', offset: 400, duration: 3000, scale: 1.2, fadeOut: 600 }),
    motion('recoil', 'targets', { after: 'bloom', anchor: 'start', offset: 700, duration: 700 }),
  ], { sound: 'growth' }),

  // Genie's Veil: the target vanishes in a burst of colourful smoke and sparkles and reappears an instant later.
  'pf2e:OyiKIbWllLZC6sGz': design('Colourful smoke and sparkles burst on the attacked creature as it blinks out and back.', () => [
    impact('Colourful smoke', ['smoke.puff.ring.01.multicolored', 'smoke.puff.ring.01.white'], { stageId: 'puff', duration: 1500, scale: 1 }),
    impact('Wish sparkles', ['swirling_sparkles.01.bluepink', 'swirling_sparkles.01.blue'], { after: 'puff', anchor: 'start', offset: 200, duration: 1600, scale: 0.8 }),
    motion('flicker', 'targets', { after: 'puff', anchor: 'start', offset: 150, duration: 800 }),
  ]),

  // Gentle Landing: a magical updraft slows a falling creature.
  'pf2e:TTwOKGqmZeKSyNMH': design('An updraft and drifting feathers catch the falling creature, which drifts gently instead of standing still.', () => [
    impact('Magical updraft', ['wind_lines.01.01.white'], { stageId: 'up', duration: 2400, scale: 1, fadeOut: 500 }),
    impact('Feather-soft descent', ['swirling_feathers.outburst.01.textured'], { after: 'up', anchor: 'start', offset: 300, duration: 2000, scale: 0.6 }),
    motion('drift', 'targets', { after: 'up', anchor: 'start', offset: 200, duration: 2000, intensity: 0.6 }),
  ]),

  // Geyser: a scalding geyser blasts up, flinging creatures into the air, then leaves steam.
  'pf2e:i88Vi47PDDoP6gQv': design('A scalding water column erupts, creatures are hurled up and slam back down, then steam fills the area; trimmed from a 6.3 s steam stage.', () => [
    area('Geyser erupts', ['water_splash.circle.01.blue'], { stageId: 'g', duration: 2200 }),
    area('Water column', ['liquid.splash_side.blue'], { after: 'g', anchor: 'start', offset: 150, duration: 1800, scale: 0.9, rotation: -90 }),
    motion('levitate', 'targets', { stageId: 'lift', after: 'g', anchor: 'start', offset: 300, duration: 900, intensity: 1 }),
    motion('slam', 'targets', { after: 'lift', anchor: 'end', duration: 600 }),
    area('Steam cloud', ['fumes.steam.white'], { after: 'g', anchor: 'start', offset: 1000, duration: 3200, opacity: 0.8, fadeOut: 800 }),
  ]),

  // Gift of the Anemos: gusting winds envelop you in a 10-foot aura.
  'pf2e:x2Gf3lt64eoMocMd': design('A short gusting whirl around the caster rather than an 8 s whirlwind film.', () => [
    aura('Gusting winds', ['whirlwind.bluewhite', 'whirlwind.bluegrey'], { stageId: 'w', duration: 2600, scale: 1.6, opacity: 0.75, fadeIn: 300, fadeOut: 600 }),
    aura('Wind lines', ['wind_lines.01.01.white'], { after: 'w', anchor: 'start', offset: 300, duration: 2000, scale: 1.4, opacity: 0.7, ...spin(2000, 1) }),
  ], { sound: 'wind' }),

  // Glacial Causeway: a path of ice extends 120 feet in a line from your feet.
  'pf2e:Ee4f4JGCjp2tFmeB': design('A frost crack spreads square by square along the line to form the ice path, instead of one radial ice burst.', () => [
    cast('Cold underfoot', ['cast_generic.ice.01.blue', 'cast_generic.02.blue'], { stageId: 'c', scale: 0.7, duration: 700, below: true }),
    area('Ice path', ['impact.ground_crack.frost.01.blue', 'impact.ground_crack.frost.01.white'], { stageId: 'path', after: 'c', anchor: 'start', offset: 300, duration: 2600, areaLayout: 'tiles', below: true }),
  ]),

  // Glacial Heart: ice and bone-deep cold freeze the target from the inside out.
  'pf2e:ZyREiMaul0VhDYh3': design('Cold floods inward and ice bursts from within the target, which seizes up; trimmed from three 6-8 s overlays.', () => [
    impact('Bone-deep cold', ['aura_themed.01.inward.complete.cold.01.blue'], { stageId: 'in', duration: 1800, scale: 0.9 }),
    impact('Heart freezes', ['ice_spikes.radial.burst.blue', 'ice_spikes.radial.burst.white'], { stageId: 'ice', after: 'in', anchor: 'start', offset: 900, duration: 1500, scale: 0.8 }),
    motion('shake', 'targets', { after: 'ice', anchor: 'start', duration: 800, intensity: 0.6 }),
  ]),

  // Glacial Skewer: a large spike of ice launched at a target, pushing it 10 feet back.
  'pf2e:LecsGlwWvnfyOeec': design('A launched ice spike shatters on the target and drives it back 10 feet, replacing a faint glint contact.', () => [
    cast('Ice spike forms', ['cast_generic.ice.01.blue', 'cast_generic.02.blue'], { stageId: 'c', scale: 0.6, duration: 700 }),
    travel('Ice spike', ['spell_projectile.ice_shard.blue'], { stageId: 'shard', after: 'c', anchor: 'start', offset: 350, duration: 1200, scale: 0.75 }),
    impact('Skewering impact', ['impact_themed.ice_shard.01.blue', 'impact_themed.ice_shard.blue'], { stageId: 'hit', after: 'shard', anchor: 'start', offset: 850, duration: 1200, scale: 0.9 }),
    motion('rush', 'targets', { after: 'hit', anchor: 'start', offset: 50, duration: 700, distance: 2, intensity: 0.7, motionRange: 'distance', motionHeading: 'away' }),
  ]),

  // Glass Sand: a handful of sand becomes jagged glass shards in a 60-foot cone.
  'pf2e:dgMauNKWeRIu8pMN': design('Thrown sand becomes a glittering spray of glass shards that fills the cone and slashes foes, replacing a single icosahedron projectile and stone rumble.', () => [
    motion('throw', 'source', { stageId: 'toss', duration: 600 }),
    area('Glass shard spray', ['breath_weapons.cold.cone.blue'], { stageId: 'cone', after: 'toss', anchor: 'start', offset: 250, duration: 1900, ...tint('#e6f6ff') }),
    area('Glinting edges', ['glint.blue.many', 'glint.yellow.many'], { after: 'cone', anchor: 'start', offset: 300, duration: 1700, opacity: 0.9 }),
    motion('recoil', 'targets', { after: 'cone', anchor: 'start', offset: 500, duration: 600 }),
  ], { sound: 'slash' }),

  // Goblin Pox: your touch afflicts the target with an itchy, allergenic rash.
  'pf2e:zJQnkKEKbJqGB3iB': design('A touch leaves a sickly green rash bloom on the target, which squirms, instead of a 7.8 s purple poison cloud.', () => [
    motion('lunge', 'source', { stageId: 'touch', duration: 600, intensity: 0.6 }),
    impact('Rash blooms', ['particles.outward.greenyellow.01.03'], { stageId: 'rash', after: 'touch', anchor: 'start', offset: 250, duration: 1400, scale: 0.6 }),
    impact('Sickened', ['icon.poison.dark_green'], { after: 'rash', anchor: 'start', offset: 400, duration: 1400, scale: 0.4, offsetY: -0.55, offsetUnits: 'token' }),
    motion('shake', 'targets', { after: 'rash', anchor: 'start', offset: 300, duration: 800, intensity: 0.4 }),
  ], { sound: 'poison' }),

  // Grasp of the Deep: the phantasmal pressure of the deep sea crushes the target.
  'pf2e:rwWtpZpkNYvypknx': design('Phantasmal deep water closes over the target and crushes it down; trimmed from 8 s overlays.', () => [
    impact('Deep water closes', ['liquid.splash.blue'], { stageId: 'w', duration: 1500, scale: 0.8, ...tint('#1f4a8a') }),
    impact('Crushing pressure', ['energy_field.02.above.blue'], { after: 'w', anchor: 'start', offset: 300, duration: 2200, scale: 0.7, opacity: 0.8, ...tint('#2a5aa0') }),
    motion('press', 'targets', { after: 'w', anchor: 'start', offset: 400, duration: 1200 }),
  ]),

  // Grasping Earth: hand-like protrusions of rock and soil grab and bury creatures.
  'pf2e:Wpgt5TYcTHLDei6J': design('Earthen hands claw up out of cracked ground and seize the creatures in the burst.', () => [
    cast('Stone stirs', ['ground_cracks.03.orange'], { stageId: 'c', scale: 0.8, duration: 900, below: true }),
    area('Ground fractures', ['ground_cracks.01.orange'], { stageId: 'gc', after: 'c', anchor: 'start', offset: 400, duration: 2600, below: true }),
    area('Earthen hands grasp', ['black_tentacles.dark_purple'], { stageId: 'hands', after: 'gc', anchor: 'start', offset: 300, duration: 2600, ...tint('#8a6a44') }),
    motion('stagger', 'targets', { after: 'hands', anchor: 'start', offset: 500, duration: 900 }),
  ]),

  // Grasping Vine: a vine erupts beneath you and stretches to grab the target.
  'pf2e:cQgPIohUja0DUiRL': design('A vine erupts at the caster and lashes across to coil around the target; trimmed from two 8.5 s vine loops.', () => [
    cast('Vine erupts', ['vine.complete.nature.single.01.green'], { stageId: 'v', scale: 0.7, duration: 1800 }),
    travel('Vine stretches', ['energy_strands.range.standard.purple.01'], { stageId: 'reach', after: 'v', anchor: 'start', offset: 300, duration: 1400, scale: 0.5, ...tint('#5c884d') }),
    impact('Vine coils', ['vine.complete.nature.group.01.green'], { stageId: 'coil', after: 'reach', anchor: 'start', offset: 600, duration: 2200, scale: 0.8 }),
    motion('stagger', 'targets', { after: 'coil', anchor: 'start', offset: 200, duration: 800, intensity: 0.6 }),
  ]),

  // Gravity Wave: a ripple of gravitic force lifts enemies in a cone and slams them down.
  'pf2e:alG1y2mnNZGRywad': design('A violet gravitic ripple rolls through the cone, lifting foes and then slamming them down.', () => [
    cast('Gravity gathers', ['energy_field.02.above.blue'], { stageId: 'c', scale: 0.6, duration: 900, ...tint('#8b77aa') }),
    area('Gravitic ripple', ['template_cone_PF2e.001.001.bluepurple', 'template_cone_PF2e.001.001.purplered'], { stageId: 'cone', after: 'c', anchor: 'start', offset: 300, duration: 2000, ...tint('#8b77aa') }),
    motion('levitate', 'targets', { stageId: 'lift', after: 'cone', anchor: 'start', offset: 300, duration: 800 }),
    motion('slam', 'targets', { after: 'lift', anchor: 'end', duration: 600 }),
  ]),

  // Gritty Wheeze: exhale a small cloud of desiccating grit and sand in a 15-foot cone.
  'pf2e:s8gTmnNMg4H4bHEF': design('A tan cloud of grit billows through the cone and creatures flinch from the sand in their eyes.', () => [
    cast('Grit exhaled', ['smoke.puff.side.grey', 'smoke.puff.side.02.white'], { stageId: 'c', scale: 0.5, duration: 800, ...tint('#c7a77e') }),
    area('Sand cloud', ['breath_weapons.poison.cone.orange', 'breath_weapons.poison.cone.green'], { stageId: 'cone', after: 'c', anchor: 'start', offset: 200, duration: 2000, ...tint('#c7a77e') }),
    motion('cower', 'targets', { after: 'cone', anchor: 'start', offset: 500, duration: 800, intensity: 0.6 }),
  ]),

  // Halcyon Mists: a soothing ancestral mist grants temporary HP and ends persistent damage.
  'pf2e:IERHT6v4o5ISvuJG': design('A soft mist gathers around the target with a faint ancestral glow, trimmed from 6-8 s fog and spirit rings.', () => [
    aura('Soothing mist', ['ambient_fog.001.complete.small.white'], { subject: 'targets', stageId: 'mist', duration: 3200, scale: 1.2, opacity: 0.8, fadeIn: 400, fadeOut: 800 }),
    impact('Ancestral support', ['healing_generic.200px.blue'], { after: 'mist', anchor: 'start', offset: 500, duration: 1800, scale: 0.7 }),
  ]),

  // Hand of the Apprentice: hurl a held melee weapon at the target; it flies back afterwards.
  'pf2e:bSDTWUIvgXkBaEv8': design('The caster visibly hurls the weapon, which strikes and returns, with a thrown-weapon sound instead of silence.', () => [
    motion('throw', 'source', { stageId: 'throw', duration: 600 }),
    projectile('Weapon flies', ['spiritual_weapon.club.01.astral.01.purple', 'spiritual_weapon.club.01.spectral.02.green'], { stageId: 'out', after: 'throw', anchor: 'start', offset: 250, duration: 700, scale: 0.75 }),
    impact('Weapon strikes', ['impact.002.pinkpurple', 'impact.002.blue'], { stageId: 'hit', after: 'out', anchor: 'end', offset: -100, duration: 900, scale: 0.8 }),
    motion('recoil', 'targets', { after: 'hit', anchor: 'start', duration: 600 }),
    cast('Weapon returns to hand', ['glint.purple.few', 'glint.yellow.few'], { after: 'hit', anchor: 'start', offset: 600, duration: 900, scale: 0.5 }),
  ], { sound: 'physicalToss', soundNamespace: 'ability' }),

  // Harm: channel void energy to harm the living or heal the undead.
  'pf2e:wdA52JJnsuQWeyqz': design('Dark void energy gathers and bursts over the target, with a void sound instead of the healing chime and no 5 s residue.', () => [
    cast('Void gathers', ['arms_of_hadar.dark_purple'], { stageId: 'c', scale: 0.6, duration: 800 }),
    impact('Void surges', ['impact.011.dark_purple', 'impact.011.blue'], { stageId: 'hit', after: 'c', anchor: 'start', offset: 450, duration: 1200, scale: 0.9, ...tint('#5a2a7a') }),
    impact('Void tendrils', ['energy_strands.complete.dark_purple.01', 'energy_strands.complete.blue.01'], { after: 'hit', anchor: 'start', offset: 150, duration: 1600, scale: 0.8, ...tint('#5a2a7a') }),
    motion('shake', 'targets', { after: 'hit', anchor: 'start', offset: 100, duration: 700, intensity: 0.5 }),
  ], { sound: 'void' }),

  // Haunting Hymn: a jarring hymn in a 15-foot cone deals sonic damage.
  'pf2e:b5BQbwmuBhgPXTyi': design('A ghostly blue wash of sound and notes fills the cone and listeners flinch, replacing a detection-cone outline.', () => [
    cast('Hymn begins', ['music_notations.bass_clef.blue', 'icon.music_note.blue'], { stageId: 'c', scale: 0.6, duration: 900 }),
    area('Jarring hymn', ['template_cone_PF2e.001.001.blueteal', 'template_cone_PF2e.001.001.purplered'], { stageId: 'cone', after: 'c', anchor: 'start', offset: 300, duration: 1800, ...tint('#8fc8ff') }),
    area('Dissonant notes', ['music_notations.bass_clef.blue', 'icon.music_note.blue'], { after: 'cone', anchor: 'start', offset: 200, duration: 1600, scale: 0.5 }),
    motion('cower', 'targets', { after: 'cone', anchor: 'start', offset: 400, duration: 800, intensity: 0.5 }),
  ]),

  // Haunting Spirit: an invisible spirit only the target can see haunts it.
  'pf2e:EAkuu0qgr2Hi2xGk': design('A pale ghost circles the target, which shrinks back; trimmed from a 6 s spirit-guardian ring.', () => [
    impact('Spirit manifests', ['spirit_guardians.dark_whiteblue.spirits', 'spirit_guardians.blueyellow.ring'], { stageId: 'sp', duration: 2600, scale: 0.45, opacity: 0.75, fadeIn: 300, fadeOut: 600 }),
    impact('Omen', ['icon.horror.purple'], { after: 'sp', anchor: 'start', offset: 600, duration: 1500, scale: 0.4, offsetY: -0.55, offsetUnits: 'token' }),
    motion('cower', 'targets', { after: 'sp', anchor: 'start', offset: 700, duration: 900 }),
  ], { sound: 'whispers' }),

  // Heartbolt: a bolt of life energy plunges into the target, then explodes in a 20-foot vital plume.
  'pf2e:ugysbQQWGvVq7iu8': design('A green bolt of life energy flies to the target and blooms outward through the 20-foot emanation; the hostile recoil was removed since the usual target is a willing ally.', () => [
    cast('Heart glows', ['cast_generic.02.green', 'cast_generic.02.blue'], { stageId: 'c', scale: 0.6, duration: 700 }),
    travel('Life bolt', ['magic_missile.green', 'magic_missile.purple'], { stageId: 'bolt', after: 'c', anchor: 'start', offset: 400, duration: 1200, scale: 0.65, ...tint('#7dff9a') }),
    impact('Vital burst', ['healing_generic.03.burst.green', 'healing_generic.03.burst.bluegreen'], { stageId: 'hit', after: 'bolt', anchor: 'start', offset: 850, duration: 1600, scale: 1 }),
    area('Vital plume', ['template_circle.out_pulse.01.burst.bluewhite'], { after: 'hit', anchor: 'start', offset: 250, duration: 1500, opacity: 0.7, ...tint('#8dffa8') }),
  ]),

  // Heaving Earth: strike the ground and send a wave through it that explodes at the target, pushing it back and prone.
  'pf2e:yWySiasyPZcRoe4d': design('The caster slams the ground, a burrowing wave races to the target and erupts in stone, hurling it back; previously only cracks at the caster.', () => [
    motion('slam', 'source', { stageId: 'slam', duration: 600 }),
    cast('Ground struck', ['impact.ground_crack.01.orange'], { after: 'slam', anchor: 'start', offset: 250, duration: 1400, scale: 0.7, below: true }),
    travel('Wave through the earth', ['burrow.ranged.01.brown', 'rolling_boulder.loop.01.rock.brown'], { stageId: 'wave', after: 'slam', anchor: 'start', offset: 350, duration: 1300, scale: 0.6 }),
    impact('Earth explodes', ['impact.boulder.02', 'impact.ground_crack.01.orange'], { stageId: 'boom', after: 'wave', anchor: 'start', offset: 1000, duration: 1400, scale: 0.9 }),
    impact('Stone shower', ['falling_rocks.top.1x1.sandstone', 'falling_rocks.top.1x1.grey'], { after: 'boom', anchor: 'start', offset: 100, duration: 1500, scale: 0.9 }),
    motion('rush', 'targets', { after: 'boom', anchor: 'start', offset: 100, duration: 700, distance: 2, intensity: 0.7, motionRange: 'distance', motionHeading: 'away' }),
  ], { sound: 'earthquake' }),

  // Hedge Prison: a hollow cube of dense bushes encases the target.
  'pf2e:z0ffligcrkVtKZd6': design('Dense hedges and vines close around the target in a few seconds rather than two 8.5 s loops.', () => [
    impact('Hedge walls rise', ['plant_growth.03.square.2x2.complete.greenyellow', 'plant_growth.03.round.2x2.complete.greenyellow'], { stageId: 'h', duration: 3500, scale: 1.2, fadeOut: 600 }),
    impact('Vines knit', ['vine.complete.nature.group.01.green'], { after: 'h', anchor: 'start', offset: 400, duration: 3000, scale: 1.1, fadeOut: 600 }),
  ], { sound: 'vines' }),

  // Hidebound: the struck target's skin erupts in thick hide or dense scales.
  'pf2e:3TuGuGZqyOBmWp7N': design('A reaction: hide and scales close over the target, which braces against the blow; trimmed from an 8 s nature aura.', () => [
    impact('Hide hardens', ['aura_themed.01.inward.complete.nature.01.green'], { stageId: 'hide', duration: 1800, scale: 0.9, ...tint('#8a7a52') }),
    impact('Scales', ['icon.shield.green'], { after: 'hide', anchor: 'start', offset: 400, duration: 1300, scale: 0.4, offsetY: -0.55, offsetUnits: 'token' }),
    motion('brace', 'targets', { after: 'hide', anchor: 'start', offset: 200, duration: 800 }),
  ]),

  // Holy Cascade: toss an amplified vial of holy water; it bursts in an enormous cascade.
  'pf2e:DZ9bzXYqMjAK9TzC': design('The caster lobs a vial of holy water that explodes into a radiant cascade over the burst, knocking creatures back.', () => [
    motion('throw', 'source', { stageId: 'throw', duration: 600 }),
    projectile('Holy water vial', ['throwable.throw.flask.01.white', 'throwable.throw.flask.01.orange'], { stageId: 'vial', after: 'throw', anchor: 'start', offset: 250, duration: 1000, scale: 0.5 }),
    area('Cascade', ['water_splash.circle.01.blue'], { stageId: 'splash', after: 'vial', anchor: 'end', offset: -100, duration: 2200 }),
    area('Sacred shimmer', ['ward.star.yellow.01', 'ward.star.yellow'], { after: 'splash', anchor: 'start', offset: 200, duration: 2000, opacity: 0.6 }),
    motion('recoil', 'targets', { after: 'splash', anchor: 'start', offset: 200, duration: 650 }),
  ]),

  // Horde of Underlings: summon six underlings in a 30-foot cone; each attacks an adjacent enemy.
  'pf2e:y5amezSt82FYu9HG': design('Summoning sigils flare across the cone and underlings burst out of dark smoke to set on adjacent foes, replacing a cone outline with markers.', () => [
    cast('Summons called', ['magic_signs.rune.conjuration.complete.grey', 'magic_signs.rune.conjuration.complete.yellow'], { stageId: 'c', scale: 0.5, duration: 1200 }),
    area('Summoning sigils', ['magic_signs.circle.02.conjuration.complete.dark_purple', 'magic_signs.circle.02.conjuration.complete.dark_yellow'], { stageId: 'sig', after: 'c', anchor: 'start', offset: 400, duration: 2200, opacity: 0.7, below: true }),
    area('Underlings arrive', ['smoke.puff.ring.01.dark_black', 'smoke.puff.ring.01.white'], { stageId: 'arr', after: 'sig', anchor: 'start', offset: 600, duration: 1600 }),
    impact('Underling attacks', ['melee_attack.02.bone.01'], { after: 'arr', anchor: 'start', offset: 700, duration: 1200, scale: 0.6 }),
    motion('shake', 'targets', { after: 'arr', anchor: 'start', offset: 900, duration: 600, intensity: 0.4 }),
  ]),

  // Hurtling Stone: a magical stone thrown with divine aim; can push the target.
  'pf2e:pRKaEXnjGJXbPHPC': design('The caster throws a stone that cracks into the foe and knocks it back a step; the 6 s impact was trimmed.', () => [
    cast('Stone evoked', ['glint.yellow.few'], { stageId: 'c', scale: 0.6, duration: 600 }),
    motion('throw', 'source', { after: 'c', anchor: 'start', offset: 200, duration: 600 }),
    travel('Hurtling stone', ['boulder.toss.02.01.stone.brown'], { stageId: 'stone', after: 'c', anchor: 'start', offset: 350, duration: 1200, scale: 0.4 }),
    impact('Stone strikes', ['impact.earth.01.browngreen', 'impact.ground_crack.01.orange'], { stageId: 'hit', after: 'stone', anchor: 'start', offset: 800, duration: 1400, scale: 0.8 }),
    motion('rush', 'targets', { after: 'hit', anchor: 'start', offset: 50, duration: 600, distance: 1, intensity: 0.6, motionRange: 'distance', motionHeading: 'away' }),
  ]),

  // Hydraulic Push: a blast of pressurised water bludgeons the target and knocks it back.
  'pf2e:jfVCuOpzC6mUrf6f': design('A real jet of water (not a wind gust) slams the target, which is driven back; splash trimmed from 5.4 s.', () => [
    cast('Pressure gathers', ['water_splash.circle.01.blue'], { stageId: 'c', scale: 0.6, duration: 700 }),
    travel('Water jet', ['breath_weapons.acid.line.blue', 'breath_weapons.acid.line.green'], { stageId: 'jet', after: 'c', anchor: 'start', offset: 350, duration: 1300, scale: 0.8, ...tint('#4aa8ff') }),
    impact('Water slams', ['liquid.splash_side.bright_blue', 'liquid.splash_side.blue'], { stageId: 'hit', after: 'jet', anchor: 'start', offset: 600, duration: 1300, scale: 0.9 }),
    motion('rush', 'targets', { after: 'hit', anchor: 'start', offset: 50, duration: 700, distance: 1.5, intensity: 0.7, motionRange: 'distance', motionHeading: 'away' }),
  ]),

  // Hydraulic Torrent: a swirling torrent of water along a 60-foot line batters and pushes creatures.
  'pf2e:Y3G6Y6EDgCY0s3fq': design('A churning blue water torrent runs down the line with splashes on those battered, who are pushed back; replaces a plain energy beam.', () => [
    cast('Water gathers', ['water_splash.circle.01.blue'], { stageId: 'c', scale: 0.7, duration: 700 }),
    motion('brace', 'source', { after: 'c', anchor: 'start', offset: 300, duration: 900, intensity: 0.5 }),
    area('Torrent', ['breath_weapons.acid.line.blue', 'breath_weapons.acid.line.green'], { stageId: 'line', after: 'c', anchor: 'start', offset: 350, duration: 2000, ...tint('#4aa8ff') }),
    impact('Battering water', ['liquid.splash_side.blue'], { after: 'line', anchor: 'start', offset: 500, duration: 1300, scale: 0.8 }),
    motion('rush', 'targets', { after: 'line', anchor: 'start', offset: 550, duration: 700, distance: 1, intensity: 0.6, motionRange: 'distance', motionHeading: 'away' }),
  ]),

  // Imaginary Weapon: a simple weapon of force lashes out in a melee spell attack.
  'pf2e:sUr5KCpeE6AXfvPp': design('The caster lunges with a conjured force blade that slashes the target; the original had no movement or reaction.', () => [
    motion('lunge', 'source', { stageId: 'lunge', duration: 650 }),
    impact('Force blade arc', ['melee_attack.01.magic_sword.yellow.01'], { stageId: 'arc', after: 'lunge', anchor: 'start', offset: 150, duration: 1100, scale: 0.9 }),
    impact('Force contact', ['energy_attack.01.blue'], { after: 'arc', anchor: 'start', offset: 250, duration: 1100, scale: 0.7 }),
    motion('recoil', 'targets', { after: 'arc', anchor: 'start', offset: 300, duration: 600 }),
  ]),

  // Imp Sting: a stabbing, poisonous imp sting on a touched creature.
  'pf2e:oryfsRK27jAUnziw': design('A quick stabbing sting with a burst of venom and a poison mark on the foe, instead of a 7.8 s poison cloud.', () => [
    motion('lunge', 'source', { stageId: 'stab', duration: 600 }),
    impact('Sting', ['impact_themed.poison.greenyellow', 'impact.001.blue'], { stageId: 'hit', after: 'stab', anchor: 'start', offset: 250, duration: 1100, scale: 0.6 }),
    impact('Imp venom', ['fumes.toxic.green', 'fumes.04.complete.grey'], { after: 'hit', anchor: 'start', offset: 200, duration: 1600, scale: 0.5, opacity: 0.8 }),
    motion('shake', 'targets', { after: 'hit', anchor: 'start', duration: 650, intensity: 0.5 }),
  ]),

  // Impaling Spike: a cold iron spike thrusts up from the earth to impale the target.
  'pf2e:oXeEbcUdgJGWHGEJ': design('A cold-iron spike stabs up beneath the target, which is jolted and pinned; trimmed from an 8 s metal aura.', () => [
    impact('Ground splits', ['impact.ground_crack.01.white', 'impact.ground_crack.01.orange'], { stageId: 'gc', duration: 1500, scale: 0.6, below: true }),
    impact('Iron spike rises', ['spike_trap.05x05ft.top.holes.normal.01.01'], { stageId: 'spike', after: 'gc', anchor: 'start', offset: 200, duration: 2000, scale: 1.2, ...tint('#7f8a94') }),
    motion('shake', 'targets', { after: 'spike', anchor: 'start', offset: 300, duration: 700, intensity: 0.8 }),
    impact('Cold iron glint', ['aura_themed.01.outward.complete.metal.01.grey'], { after: 'spike', anchor: 'start', offset: 500, duration: 1600, scale: 0.6, fadeOut: 500 }),
  ]),

  // Implosion: the target collapses in on itself (75 damage).
  'pf2e:4WS7HrFjwNvTn8T2': design('Matter collapses violently inward on the target, which is crushed down, instead of a soft 6.8 s energy field.', () => [
    impact('Collapse begins', ['particles.inward.blue.02.03', 'particles.inward.greenyellow.02.03'], { stageId: 'in', duration: 1200, scale: 0.9 }),
    impact('Implosion', ['sphere_of_annihilation.200px.purple', 'sphere_of_annihilation.200px'], { stageId: 'imp', after: 'in', anchor: 'start', offset: 500, duration: 1500, scale: 0.5, fadeOut: 400 }),
    motion('press', 'targets', { after: 'in', anchor: 'start', offset: 400, duration: 1000, intensity: 1.2 }),
    impact('Shockwave', ['impact.011.blue'], { after: 'imp', anchor: 'start', offset: 700, duration: 900, scale: 0.8 }),
  ]),

  // Imprinting Hand: your hand presses into the target, dealing force and hampering healing.
  'pf2e:c6CXH7WTxtS4D1Fi': design('A spectral hand presses into the target with a force jolt; the healing-glow sound was wrong for a harmful spell.', () => [
    impact('Hand presses', ['arcane_hand.blue'], { stageId: 'hand', duration: 1600, scale: 0.6 }),
    impact('Force imprint', ['energy_strands.02.marker.bluepurple'], { after: 'hand', anchor: 'start', offset: 600, duration: 1800, scale: 0.6 }),
    motion('recoil', 'targets', { after: 'hand', anchor: 'start', offset: 500, duration: 600 }),
  ], { sound: 'force' }),

  // Incarnate Archmage: an immense archmage spirit arrives in a burst of force striking up to 5 creatures.
  'pf2e:JAaETUBg0xlttpCH': design('The archmage arrives through a conjuration circle and its force bolts strike the chosen creatures, which the original never showed.', () => [
    cast('Conjuration circle', ['magic_signs.circle.02.conjuration.complete.purple', 'magic_signs.circle.02.conjuration.complete.yellow'], { stageId: 'circle', scale: 1.6, duration: 2200, below: true }),
    sprite('Archmage spirit', { stageId: 'spirit', after: 'circle', anchor: 'start', offset: 600, duration: 2200, opacity: 0.45, offsetY: -0.3, offsetUnits: 'token', fadeIn: 400, fadeOut: 500 }),
    travel('Amplified force bolts', ['magic_missile.purple'], { stageId: 'bolts', after: 'spirit', anchor: 'start', offset: 600, duration: 1300, scale: 0.6 }),
    impact('Force strikes', ['impact.009.purple', 'impact.009.orange'], { after: 'bolts', anchor: 'start', offset: 900, duration: 1000, scale: 0.7 }),
    motion('recoil', 'targets', { after: 'bolts', anchor: 'start', offset: 950, duration: 600 }),
  ], { sound: 'forceMissile' }),

  // Incarnate Deific Herald: your deity's herald arrives and unleashes divine wrath.
  'pf2e:kIRWUBxocERjIBni': design('A golden conjuration circle heralds a towering divine figure whose wrath washes over foes; previously a silent purple circle.', () => [
    cast('Divine circle', ['magic_signs.circle.02.conjuration.complete.yellow', 'magic_signs.circle.02.conjuration.complete.dark_yellow'], { stageId: 'circle', scale: 1.6, duration: 2200, below: true }),
    cast('Herald descends', ['sacred_flame.source.yellow'], { stageId: 'desc', after: 'circle', anchor: 'start', offset: 500, duration: 1800, scale: 1.4 }),
    sprite('Herald', { after: 'desc', anchor: 'start', offset: 200, duration: 2200, opacity: 0.45, offsetY: -0.3, offsetUnits: 'token', fadeIn: 400, fadeOut: 500, ...tint('#ffe9a0') }),
    impact('Divine wrath', ['divine_smite.target.yellowwhite', 'sacred_flame.target.yellow'], { stageId: 'wrath', after: 'desc', anchor: 'start', offset: 900, duration: 1600, scale: 0.8 }),
    motion('stagger', 'targets', { after: 'wrath', anchor: 'start', offset: 200, duration: 800 }),
  ], { sound: 'divineWrath' }),

  // Incarnate Draconic Legion: a legion of dragons descends and breathes annihilating blasts.
  'pf2e:2EIUqc8TCTQimggQ': design('Dragons announce themselves with a roar and a blast of breath energy that explodes on the foes; the energy type is chosen, so the breath is a neutral pale energy.', () => [
    cast('Legion summoned', ['magic_signs.circle.02.evocation.loop.purple', 'magic_signs.circle.02.conjuration.complete.yellow'], { stageId: 'circle', scale: 1.4, duration: 1800, below: true }),
    travel('Draconic breath', ['breath_weapons.fire.line.purple', 'breath_weapons.fire.line.orange'], { stageId: 'breath', after: 'circle', anchor: 'start', offset: 900, duration: 1800, ...tint('#e8e0ff') }),
    impact('Annihilation', ['explosion.05.bluewhite', 'explosion.02.blue'], { stageId: 'boom', after: 'breath', anchor: 'start', offset: 700, duration: 1600, scale: 0.9 }),
    motion('recoil', 'targets', { after: 'boom', anchor: 'start', offset: 100, duration: 700 }),
  ], { sound: 'dragonRoar' }),

  // Incarnate Skeletal Giant: a giant of jagged bone leaps from a dark cloud and lands with an earthshaking crash.
  'pf2e:3LPFReFtMPiO0pAk': design('A dark cloud gathers, the bone giant crashes down and the ground cracks, knocking nearby foes off their feet.', () => [
    cast('Dark cloud', ['smoke.puff.ring.01.dark_black', 'smoke.puff.ring.01.white'], { stageId: 'cloud', scale: 1.8, duration: 1800, offsetY: -0.4, offsetUnits: 'token' }),
    cast('Bone giant lands', ['impact.ground_crack.01.dark_red', 'impact.ground_crack.01.orange'], { stageId: 'land', after: 'cloud', anchor: 'start', offset: 1000, duration: 2200, scale: 1.8, below: true }),
    cast('Shards of bone and stone', ['falling_rocks.top.2x1.white', 'falling_rocks.top.2x1.grey'], { after: 'land', anchor: 'start', offset: 100, duration: 1500, scale: 1.4 }),
    motion('slam', 'targets', { after: 'land', anchor: 'start', offset: 200, duration: 700 }),
  ], { sound: 'earthquake' }),

  // Incendiary Aura: a combustible aura surrounds you.
  'pf2e:AspA30tzKCHFWRf0': design('A smouldering haze with drifting embers wraps the caster, trimmed from an 8 s grey cloud.', () => [
    aura('Combustible haze', ['fumes.04.complete.grey'], { stageId: 'haze', duration: 3200, scale: 2, opacity: 0.6, fadeIn: 400, fadeOut: 700, ...tint('#8a6a5a') }),
    aura('Drifting embers', ['fireflies.few.01.orange', 'fireflies.few.01.green'], { after: 'haze', anchor: 'start', offset: 300, duration: 2800, scale: 1.6, ...tint('#ff8a3d') }),
  ]),

  // Incendiary Fog: a cloud of flammable black dust functions as mist.
  'pf2e:I2fwPslQth0DTPQD': design('A black dust cloud settles over the burst with a few stray sparks, trimmed from an 8 s two-layer fog.', () => [
    cast('Dust summoned', ['smoke.puff.centered.dark_black', 'smoke.puff.centered.grey'], { stageId: 'c', scale: 0.7, duration: 900 }),
    area('Black dust', ['fumes.04.complete.black', 'fumes.04.complete.grey'], { stageId: 'dust', after: 'c', anchor: 'start', offset: 400, duration: 4200, fadeIn: 400, fadeOut: 800 }),
    area('Stray sparks', ['fireflies.few.01.orange', 'fireflies.few.01.green'], { after: 'dust', anchor: 'start', offset: 800, duration: 2500, opacity: 0.7, ...tint('#ffb060') }),
  ]),

  // Infectious Comedy: a magical joke infects the target with uncontrollable laughter.
  'pf2e:SE3MddYAUyPKABuF': design('A joke lands: the target is overcome with giggles (dizzy sparkle and shaking), with a laughter sound instead of silence.', () => [
    cast('Joke told', ['soundwave.02.orangeyellow', 'soundwave.02.blue'], { stageId: 'c', scale: 0.5, duration: 900 }),
    impact('Laughter', ['dizzy_stars.200px.yellow', 'dizzy_stars.200px.blueorange'], { stageId: 'laugh', after: 'c', anchor: 'start', offset: 400, duration: 1800, scale: 0.7 }),
    motion('shake', 'targets', { after: 'laugh', anchor: 'start', offset: 200, duration: 1200, intensity: 0.5 }),
  ], { sound: 'laughter' }),

  // Inkshot: viscous toxic ink jets into the target's face.
  'pf2e:MiTFNcqCI9f34A2V': design('A glob of dark ink splatters the target\'s face and it flinches, dazzled; green fumes and splash replaced by inky black.', () => [
    cast('Ink gathers', ['liquid.blob.purple', 'liquid.blob.blue'], { stageId: 'c', scale: 0.3, duration: 600, ...tint('#2a2238') }),
    projectile('Ink glob', ['liquid.blob.purple', 'liquid.blob.blue'], { stageId: 'shot', after: 'c', anchor: 'start', offset: 300, duration: 800, scale: 0.4, ...tint('#2a2238') }),
    impact('Ink splatters', ['liquid.splash.dark_black', 'liquid.splash.blue'], { stageId: 'hit', after: 'shot', anchor: 'end', offset: -100, duration: 1300, scale: 0.6, ...tint('#2a2238') }),
    motion('cower', 'targets', { after: 'hit', anchor: 'start', duration: 800 }),
  ]),

  // Inner Upheaval: qi-infused unarmed Strike or Flurry of Blows.
  'pf2e:ZL8NTvB22NeEWhVG': design('Qi gathers and the monk lunges into a glowing unarmed strike that lands on the target; nothing landed before.', () => [
    cast('Qi focuses', ['energy_strands.in.blue.01', 'energy_strands.in.green.01'], { stageId: 'qi', scale: 0.7, duration: 800 }),
    motion('lunge', 'source', { stageId: 'lunge', after: 'qi', anchor: 'start', offset: 400, duration: 600 }),
    impact('Qi strike', ['unarmed_strike.magical.01.blue'], { stageId: 'hit', after: 'lunge', anchor: 'start', offset: 200, duration: 1100 }),
    motion('recoil', 'targets', { after: 'hit', anchor: 'start', offset: 100, duration: 600 }),
  ]),

  // Internal Insurrection: parts of the target's body rebel against the whole.
  'pf2e:RbORUmnwlB8b3mNf': design('Dark red strands writhe through the target\'s body as it doubles over in pain, replacing a 7.8 s purple poison cloud.', () => [
    cast('Disease called', ['cast_generic.dark.01.red', 'cast_generic.01.yellow'], { stageId: 'c', scale: 0.6, duration: 800, ...tint('#7a1a2a') }),
    impact('Body rebels', ['energy_strands.complete.dark_red.01', 'energy_strands.complete.blue.01'], { stageId: 'rebel', after: 'c', anchor: 'start', offset: 400, duration: 2000, scale: 0.8, ...tint('#8a2030') }),
    motion('stagger', 'targets', { after: 'rebel', anchor: 'start', offset: 400, duration: 1000 }),
  ]),

  // Interstellar Void: the frigid depths of space cloak the target.
  'pf2e:L37RTc7K79OUpZ7X': design('A starry black void envelops the target with a deep chill and it shivers; trimmed from an 8 s cold aura.', () => [
    impact('Freezing void', ['darkness.black'], { stageId: 'void', duration: 2600, scale: 0.6, opacity: 0.85, fadeIn: 300, fadeOut: 700 }),
    impact('Distant stars', ['twinkling_stars.points07.white', 'twinkling_stars.points04.white'], { after: 'void', anchor: 'start', offset: 300, duration: 2200, scale: 0.7 }),
    impact('Interstellar chill', ['aura_themed.01.inward.complete.cold.01.blue'], { after: 'void', anchor: 'start', offset: 500, duration: 1800, scale: 0.7 }),
    motion('shake', 'targets', { after: 'void', anchor: 'start', offset: 600, duration: 900, intensity: 0.4 }),
  ]),

  // Invoke the Crimson Oath: swing a weapon downward and unleash a cone of ruby energy.
  'pf2e:AsKLseOo8hwv5Jha': design('A downward weapon swing releases a ruby wave through the cone that batters foes, replacing a blue field projectile and cone outline.', () => [
    motion('slam', 'source', { stageId: 'swing', duration: 600 }),
    cast('Crimson arc', ['melee_attack.01.trail.01.orangered'], { after: 'swing', anchor: 'start', duration: 1100 }),
    area('Ruby blast', ['template_cone_PF2e.001.001.purplered'], { stageId: 'cone', after: 'swing', anchor: 'start', offset: 350, duration: 1900, ...tint('#c41e44') }),
    motion('recoil', 'targets', { after: 'cone', anchor: 'start', offset: 400, duration: 650 }),
  ]),

  // Jassim's Allegiance: a Gargantuan Jistkan automaton emerges from the ground and fires an eye beam.
  'pf2e:JEMSVySuS4jvTepQ': design('The ancient automaton heaves up out of the ground and its fiery eye beam scorches the foes, instead of a silent 8 s metal aura.', () => [
    cast('Ground heaves', ['impact.ground_crack.01.orange'], { stageId: 'gc', scale: 1.6, duration: 2000, below: true }),
    cast('Automaton emerges', ['aura_themed.01.outward.complete.metal.01.grey'], { stageId: 'emerge', after: 'gc', anchor: 'start', offset: 300, duration: 2000, scale: 1.4, fadeOut: 500 }),
    travel('Eyes of fire', ['energy_beam.normal.red.01', 'energy_beam.normal.blue.01'], { stageId: 'beam', after: 'emerge', anchor: 'start', offset: 900, duration: 1600, scale: 0.8, ...tint('#ff7a2a') }),
    impact('Searing impact', ['impact.fire.01.orange', 'explosion.01.orange'], { stageId: 'hit', after: 'beam', anchor: 'start', offset: 500, duration: 1300, scale: 0.8 }),
    motion('recoil', 'targets', { after: 'hit', anchor: 'start', duration: 650 }),
  ], { sound: 'fireRay' }),

  // Juvenile Companion: your companion shrinks into its harmless juvenile form.
  'pf2e:KFpBT6FPfSFhxQ27': design('A gentle shrinking shimmer on the companion rather than claws and hide emerging, since the companion becomes a tiny harmless juvenile.', () => [
    cast('Gentle change', ['cast_generic.02.dark_purple', 'cast_generic.02.blue'], { stageId: 'c', scale: 0.6, duration: 800, ...tint('#e8c8a0') }),
    impact('Shrinking shimmer', ['shimmer.01.orange', 'shimmer.01.blue'], { stageId: 'sh', after: 'c', anchor: 'start', offset: 400, duration: 1600, scale: 0.9 }),
    sprite('Smaller silhouette', { after: 'sh', anchor: 'start', offset: 200, duration: 1200, opacity: 0.5, fadeOut: 500 }),
    impact('Playful sparkles', ['swirling_sparkles.01.yellow', 'swirling_sparkles.01.blue'], { after: 'sh', anchor: 'start', offset: 500, duration: 1600, scale: 0.6 }),
    motion('sink', 'targets', { after: 'sh', anchor: 'start', offset: 200, duration: 900, intensity: 0.5 }),
  ]),

  // Kinetic Ram: gathered kinetic force pushes the target 10 or 20 feet away.
  'pf2e:sPHcuLIKj9SDaDAD': design('A ram of kinetic force slams the target and drives it back, replacing two slow 5 s energy fields with a long recoil.', () => [
    cast('Kinetic energy gathers', ['energy_field.02.above.purple', 'energy_field.02.above.blue'], { stageId: 'c', scale: 0.6, duration: 900 }),
    motion('lunge', 'source', { after: 'c', anchor: 'start', offset: 400, duration: 500, intensity: 0.5 }),
    impact('Force ram', ['impact.011.purple', 'impact.011.blue'], { stageId: 'hit', after: 'c', anchor: 'start', offset: 600, duration: 1100, scale: 0.9 }),
    motion('rush', 'targets', { after: 'hit', anchor: 'start', offset: 50, duration: 800, distance: 2, intensity: 0.7, motionRange: 'distance', motionHeading: 'away' }),
  ]),

  // Knock: the target door, lock or container becomes easier to open.
  'pf2e:6Ot4N22t5tPD51BO': design('A short unlocking sigil flash on the lock and a release glint, trimmed from an 8.7 s abjuration circle.', () => [
    cast('Latch loosens', ['cast_generic.01.dark_purple', 'cast_generic.02.blue'], { stageId: 'c', scale: 0.6, duration: 700 }),
    impact('Seal opens', ['magic_signs.circle.01.abjuration.blue', 'magic_signs.circle.01.abjuration'], { stageId: 'seal', after: 'c', anchor: 'start', offset: 400, duration: 2000, scale: 0.6, fadeOut: 500 }),
    impact('Released glint', ['glint.yellow.few'], { after: 'seal', anchor: 'start', offset: 900, duration: 1300, scale: 0.6 }),
  ]),

  // Lament: a guttural wail of negative emotion shakes enemies' hearts.
  'pf2e:T90ij2uu6ZaBaSXV': design('A wailing soundwave rolls out from the caster and enemies\' hearts quail; a wail sound fits better than a quiet mental pulse.', () => [
    cast('Guttural wail', ['soundwave.01.purple', 'soundwave.01.blue'], { stageId: 'wail', scale: 1.2, duration: 1400 }),
    motion('pulse', 'source', { after: 'wail', anchor: 'start', duration: 700, intensity: 0.6 }),
    impact('Hearts shaken', ['icon.fear.dark_purple'], { after: 'wail', anchor: 'start', offset: 500, duration: 1500, scale: 0.4, offsetY: -0.55, offsetUnits: 'token' }),
    motion('cower', 'targets', { after: 'wail', anchor: 'start', offset: 500, duration: 900 }),
  ], { sound: 'scream' }),

  // Lashing Rope: an animated rope encircles you and makes reach Strikes that slash and trip.
  'pf2e:sbTxe4CGP4tn6y51': design('A rope-coloured animated coil wraps the caster and lashes out at the target; the void-purple 8.5 s vines did not fit a rope.', () => [
    aura('Rope encircles', ['vine.complete.liquid.single.01.grey', 'vine.complete.nature.single.01.green'], { stageId: 'coil', duration: 2200, scale: 0.9, fadeOut: 500, ...tint('#a07a4a') }),
    motion('lunge', 'source', { after: 'coil', anchor: 'start', offset: 700, duration: 500, intensity: 0.5 }),
    impact('Rope lashes', ['melee_generic.slash.02.001.blue'], { stageId: 'lash', after: 'coil', anchor: 'start', offset: 900, duration: 1000, scale: 0.8, ...tint('#c49a62') }),
    motion('recoil', 'targets', { after: 'lash', anchor: 'start', duration: 600 }),
  ], { sound: 'whip', soundNamespace: 'ability' }),

  // Leng Sting: a nightmarish replica of a Leng spider's venomous bite on a touched creature.
  'pf2e:QVMjPfXlpnmeuWKS': design('A stabbing venomous sting with a dark venom burst and the target reeling, instead of a 7.8 s poison cloud.', () => [
    motion('lunge', 'source', { stageId: 'stab', duration: 600 }),
    impact('Sting', ['impact_themed.poison.greenyellow', 'impact.001.blue'], { stageId: 'hit', after: 'stab', anchor: 'start', offset: 250, duration: 1100, scale: 0.6, ...tint('#7a5aa8') }),
    impact('Leng venom', ['fumes.toxic.green', 'fumes.04.complete.grey'], { after: 'hit', anchor: 'start', offset: 200, duration: 1600, scale: 0.5, opacity: 0.8, ...tint('#5a3a7a') }),
    motion('stagger', 'targets', { after: 'hit', anchor: 'start', duration: 800, intensity: 0.6 }),
  ]),
};
