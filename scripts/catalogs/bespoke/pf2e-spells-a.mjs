// Bespoke compositions (pf2e-spells-a). Keys: '<system>:<entryId>' or '<system>:<entryId>:<variant|mode>'.
// See scripts/catalogs/bespoke/helpers.mjs and scripts/bespoke.mjs.
import { cast, travel, projectile, impact, area, aura, sprite, motion, tint, spin, breathe, design } from './helpers.mjs';
export default {
  // Entropic Wheel: thermal energy stockpiled in a wheel-like construct that
  // burns with cold and freezes with heat. Heat and cold gather on opposite
  // sides, then a burning rim and an orbit of icy motes form and counter-rotate;
  // the first thermal mote kindles above the caster. Spell Effect: Entropic
  // Wheel keeps the same dual wheel turning for the duration.
  'pf2e:X4T5RlQBrdpmA35n': design('Heat and cold gather on opposite sides and form a counter-rotating wheel of flame and icy motes; the first thermal mote kindles.', () => [
    cast('Heat gathers', ['cast_generic.fire.01.orange'], { stageId: 'ew-heat', scale: 0.8, offsetX: -0.35, offsetUnits: 'token', duration: 900 }),
    cast('Cold gathers', ['cast_generic.ice.01.blue', 'cast_generic.fire.01.orange'], { stageId: 'ew-cold', scale: 0.8, offsetX: 0.35, offsetUnits: 'token', mirrorX: true, duration: 900, ...tint('#8cdcff') }),
    aura('Burning rim', ['fire_ring.500px.yellow', 'fire_ring.500px.red'], { stageId: 'ew-rim', after: 'ew-heat', anchor: 'start', offset: 650, duration: 2800, scale: 1.2, opacity: 0.75, below: true, fadeIn: 300, fadeOut: 500, ...tint('#ff8a3d'), ...spin(3500, 1) }),
    aura('Icy motes orbit', ['aura_themed.01.orbit.complete.cold.01.blue'], { stageId: 'ew-ice', after: 'ew-heat', anchor: 'start', offset: 650, duration: 2800, scale: 1.35, opacity: 0.85, fadeIn: 300, fadeOut: 500, ...spin(3500, -1) }),
    cast('First thermal mote', ['dancing_light.blueyellow', 'dancing_light.yellow'], { stageId: 'ew-mote', after: 'ew-rim', anchor: 'start', offset: 800, duration: 1600, scale: 0.3, offsetY: -0.6, offsetUnits: 'token', fadeIn: 200, fadeOut: 400 }),
    motion('pulse', 'source', { after: 'ew-rim', anchor: 'start', duration: 900, intensity: 0.5 }),
  ]),

  // ---- Batch 1 (500 Toads .. Antimagic Artifice) ----

  // Aberrant Whispers: alien phrases in an emanation assault minds; orange runes read as generic utility.
  'pf2e:qhJfRnkCRrMI4G1O': design('Unknown alien phrases ripple out from the caster and horror sigils wash over every mind in the emanation; listeners flinch.', () => [
    cast('Alien utterance', ['soundwave.02.purple', 'soundwave.02.blue'], { stageId: 'aw-voice', scale: 0.7, duration: 1400, ...tint('#9a6bd6') }),
    area('Whispers fill the emanation', ['template_circle.symbol.out_flow.horror.purple', 'template_circle.symbol.normal.horror.purple'], { stageId: 'aw-area', after: 'aw-voice', anchor: 'start', offset: 300, duration: 2600, opacity: 0.85, fadeIn: 300, fadeOut: 600 }),
    impact('Mind assaulted', ['markers.horror.purple.01', 'icon.horror.purple'], { after: 'aw-area', anchor: 'start', offset: 500, duration: 1600, scale: 0.5, targetSelection: 'all' }),
    motion('cower', 'targets', { after: 'aw-area', anchor: 'start', offset: 550, duration: 1000, intensity: 0.4 }),
  ]),

  // Abyssal Plague: a touch that siphons fragments of the soul; old recipe was a 7.8 s purple gas cloud.
  'pf2e:vJuaxTd6q11OjGqA': design('A corrupting touch plants the Abyssal plague; red soul-strands are torn out of the victim and a demonic curse mark settles.', () => [
    motion('lunge', 'source', { stageId: 'ap-touch', duration: 600, intensity: 0.45 }),
    impact('Abyssal touch', ['unarmed_strike.magical.01.dark_red', 'unarmed_strike.magical.01.blue'], { stageId: 'ap-hit', after: 'ap-touch', anchor: 'start', offset: 300, duration: 900, scale: 0.8, ...tint('#8b1a2b') }),
    impact('Soul fragments siphoned', ['energy_strands.in.red.01', 'energy_strands.in.green.01'], { stageId: 'ap-siphon', after: 'ap-hit', anchor: 'start', offset: 350, duration: 2000, scale: 0.9, ...tint('#b0203a') }),
    impact('Plague mark', ['condition.curse.01.004.red'], { after: 'ap-siphon', anchor: 'start', offset: 600, duration: 1800, scale: 0.6 }),
    motion('stagger', 'targets', { after: 'ap-hit', anchor: 'start', duration: 800, intensity: 0.45 }),
  ]),

  // Accelerated Decomposition: the body withers with void energy; old recipe was grey smoke + blue sparkles for 5.4 s.
  'pf2e:rqoWAxQv4RWbwyAr': design('Void energy speeds decay: a necromantic sign flares, the target is wrapped in withering dark-green strands and crumbles into grave dust.', () => [
    cast('Decay invoked', ['magic_signs.rune.necromancy.complete.green'], { stageId: 'ad-cast', scale: 0.55, duration: 1200 }),
    impact('Body withers', ['energy_strands.overlay.dark_green.01', 'energy_strands.overlay.blue.01'], { stageId: 'ad-wither', after: 'ad-cast', anchor: 'start', offset: 500, duration: 2200, scale: 1, ...tint('#4f6b2a') }),
    impact('Flesh crumbles', ['smoke.puff.centered.dark_green', 'smoke.puff.centered.grey'], { after: 'ad-wither', anchor: 'start', offset: 700, duration: 1500, scale: 0.9 }),
    motion('stagger', 'targets', { after: 'ad-wither', anchor: 'start', offset: 200, duration: 1100, intensity: 0.5 }),
  ]),

  // Access Lore: three 6.5 s orange rune icons was long and noisy for a quick divine-knowledge sift.
  'pf2e:LbPLNWlLCxKCo5gF': design('Divine knowledge is sifted: a golden divination sign turns at the caster while motes of lore drift inward.', () => [
    cast('Divine sifting', ['magic_signs.rune.divination.complete.yellow', 'magic_signs.rune.divination.complete.blue'], { stageId: 'al-sign', scale: 0.6, duration: 2400 }),
    cast('Lore gathers', ['particles.inward.white.01.03', 'particles.inward.greenyellow.01.03'], { after: 'al-sign', anchor: 'start', offset: 400, duration: 1800, scale: 0.8, ...tint('#ffe7a0') }),
  ]),

  // Achaekek's Clutch: the mantis god's symbol is marked on the body; bleed-linked claws.
  'pf2e:IT1aaqDBAISlHDUV': design("Achaekek's blood-red symbol brands the target and spectral mantis claws rake across it once.", () => [
    cast('Symbol drawn', ['cast_generic.dark.01.red', 'cast_generic.01.yellow'], { stageId: 'ac-cast', scale: 0.7, duration: 900 }),
    impact('Mantis brand', ['condition.curse.01.011.red'], { stageId: 'ac-mark', after: 'ac-cast', anchor: 'start', offset: 500, duration: 2200, scale: 0.6 }),
    impact('Claws rake', ['claws.200px.dark_red', 'claws.200px.red'], { after: 'ac-mark', anchor: 'start', offset: 700, duration: 1000, scale: 0.9 }),
    motion('shake', 'targets', { after: 'ac-mark', anchor: 'start', offset: 750, duration: 600, intensity: 0.35 }),
  ]),

  // Acid Grip: an ephemeral taloned hand grips the target and burns it.
  'pf2e:9h9YCncqah6VNsKf': design('A spectral green hand closes on the target, its talons raking acid that keeps fuming.', () => [
    cast('Shape talon', ['cast_generic.02.green', 'cast_generic.02.blue'], { stageId: 'ag-cast', scale: 0.75, duration: 600 }),
    impact('Taloned hand grips', ['arcane_hand.green'], { stageId: 'ag-hand', after: 'ag-cast', anchor: 'end', duration: 1700, scale: 0.75 }),
    impact('Acid talons', ['claws.200px.bright_green', 'claws.200px.red'], { after: 'ag-hand', anchor: 'start', offset: 600, duration: 1000, scale: 0.9, ...tint('#8fe04a') }),
    aura('Corrosion fumes', ['fumes.04.loop.green', 'fumes.04.loop.grey'], { subject: 'targets', after: 'ag-hand', anchor: 'start', offset: 900, duration: 1600, scale: 1.1, fadeOut: 500, ...tint('#7bcf3a') }),
    motion('stagger', 'targets', { after: 'ag-hand', anchor: 'start', offset: 550, duration: 800, intensity: 0.5 }),
  ]),

  // Acid Storm: a storm of acid rain pelts the burst; old recipe was one splash film.
  'pf2e:ZW8ovbu1etdfMre3': design('Green acid rain pelts the whole burst while caustic fumes rise and creatures inside flinch.', () => [
    cast('Storm summoned', ['cast_generic.02.green', 'cast_generic.02.blue'], { stageId: 'as-cast', scale: 0.8, duration: 700 }),
    area('Acid rain', ['template_square.raindrops.001.7x7.instant.combined.greenyellow', 'template_square.raindrops.001.7x7.instant.combined.blue'], { stageId: 'as-rain', after: 'as-cast', anchor: 'end', duration: 3000, ...tint('#93e03c') }),
    area('Caustic fumes', ['fumes.04.complete.green', 'fumes.04.complete.grey'], { after: 'as-rain', anchor: 'start', offset: 900, duration: 2400, opacity: 0.6, below: true, ...tint('#7bcf3a') }),
    motion('cower', 'targets', { after: 'as-rain', anchor: 'start', offset: 400, duration: 1200, intensity: 0.35 }),
  ]),

  // Acidic Burst: a shell of acid forms around the caster and bursts outward.
  'pf2e:rnNGALRtsjspFTws': design('A shell of acid wraps the caster, then bursts outward in a ring of splashing acid that drenches everyone adjacent.', () => [
    aura('Acid shell', ['bubble.001.001.complete.green', 'bubble.001.001.complete.blue'], { stageId: 'ab-shell', duration: 900, scale: 1.1, ...tint('#8fe04a') }),
    area('Shell bursts', ['water_splash.circle.01.green', 'water_splash.circle.01.blue'], { stageId: 'ab-burst', after: 'ab-shell', anchor: 'end', offset: -150, duration: 1600, ...tint('#8fe04a') }),
    motion('pulse', 'source', { after: 'ab-shell', anchor: 'end', offset: -200, duration: 500, intensity: 0.6 }),
    motion('recoil', 'targets', { after: 'ab-burst', anchor: 'start', offset: 150, duration: 600, intensity: 0.5 }),
  ]),

  // Admonishing Ray: a ray that lands like a punch or slap; earth crater impact was wrong material.
  'pf2e:uToa7ksKAzmEpkKC': design('A golden ray of force connects and lands like a punch on the target, knocking it back a step without lasting harm.', () => [
    cast('Focus beam', ['glint.yellow.few'], { stageId: 'ar-cast', scale: 0.7, duration: 500 }),
    travel('Admonishing ray', ['energy_beam.normal.yellow.01', 'energy_beam.normal.bluepink.02'], { stageId: 'ar-ray', after: 'ar-cast', anchor: 'end', duration: 1300, scale: 0.7, ...tint('#ffd75a') }),
    impact('Punch lands', ['unarmed_strike.magical.01.yellow', 'unarmed_strike.magical.01.blue'], { after: 'ar-ray', anchor: 'start', offset: 500, duration: 900, scale: 0.8, ...tint('#ffd75a') }),
    motion('recoil', 'targets', { after: 'ar-ray', anchor: 'start', offset: 550, duration: 650, intensity: 0.6 }),
  ]),

  // Advanced Scurvy: a touch-delivered wasting disease (fatigue, bleeding gums); 7.8 s purple gas was off.
  'pf2e:XEhzFKNTSARsofav': design("A sickly touch: pallid green miasma seeps into the target and a blood-drop sign marks scurvy's hemorrhaging.", () => [
    motion('lunge', 'source', { stageId: 'sc-touch', duration: 600, intensity: 0.4 }),
    impact('Disease seeps in', ['smoke.puff.centered.dark_green', 'smoke.puff.centered.grey'], { stageId: 'sc-sick', after: 'sc-touch', anchor: 'start', offset: 300, duration: 1600, scale: 0.85 }),
    impact('Hemorrhage mark', ['markers.drop.red.01', 'icon.drop.red'], { after: 'sc-sick', anchor: 'start', offset: 600, duration: 1600, scale: 0.45 }),
    motion('stagger', 'targets', { after: 'sc-sick', anchor: 'start', offset: 200, duration: 900, intensity: 0.4 }),
  ]),

  // Airburst: the blast pushes; targets were static.
  'pf2e:fprqWKUc0jnMIyGU': design('A ring of wind blasts out from the caster and nearby creatures are buffeted backward.', () => [
    area('Air bursts outward', ['thunderwave.center.blue'], { stageId: 'ai-burst', duration: 1500, ...tint('#eef6ff') }),
    area('Wind lines scatter', ['wind_lines.01.02.white'], { after: 'ai-burst', anchor: 'start', offset: 200, duration: 1300 }),
    motion('brace', 'source', { duration: 600, intensity: 0.4 }),
    motion('stagger', 'targets', { after: 'ai-burst', anchor: 'start', offset: 250, duration: 750, intensity: 0.6 }),
  ]),

  // Alarm: 8 s boundary film was too long; the hand-bell alert option had no visual.
  'pf2e:4WAib3GichxLjp5p': design('A shimmering ward boundary traces the burst, a password rune settles at its centre and a ghostly hand bell chimes once.', () => [
    area('Alert boundary', ['template_circle.aura.04.inward.001.complete.combined.refraction'], { stageId: 'al-ward', duration: 3000, opacity: 0.8, fadeOut: 600 }),
    area('Password rune', ['magic_signs.rune.abjuration.complete.yellow', 'magic_signs.rune.abjuration.complete.blue'], { stageId: 'al-rune', after: 'al-ward', anchor: 'start', offset: 500, duration: 2200, scale: 0.35 }),
    area('Bell chimes', ['toll_the_dead.yellow.bell', 'toll_the_dead.green.bell'], { after: 'al-rune', anchor: 'start', offset: 900, duration: 1600, scale: 0.3 }),
  ]),

  // All-Encompassing Hunger: devouring a life; a 6.4 s annihilation sphere on the target over-dramatised a 1d6 bite.
  'pf2e:wJi0lq4yA5Mlj0MY': design("A void maw closes on the target and its life force streams back into the caster, who swells with stolen vitality.", () => [
    impact('Void maw', ['bite.200px.purple', 'bite.200px.red'], { stageId: 'ah-bite', duration: 1000, scale: 0.9, ...tint('#5a2a7a') }),
    impact('Life devoured', ['sphere_of_annihilation.200px.purple'], { stageId: 'ah-void', after: 'ah-bite', anchor: 'start', offset: 300, duration: 1600, scale: 0.5, opacity: 0.85 }),
    travel('Life drawn to caster', ['energy_beam.reverse.dark_green', 'energy_strands.range.standard.purple.01'], { stageId: 'ah-drain', after: 'ah-void', anchor: 'start', offset: 400, duration: 1500, scale: 0.6 }),
    cast('Hunger sated', ['particles.inward.greenyellow.01.01'], { after: 'ah-drain', anchor: 'start', offset: 700, duration: 1400, scale: 0.6 }),
    motion('stagger', 'targets', { after: 'ah-bite', anchor: 'start', duration: 800, intensity: 0.5 }),
    motion('pulse', 'source', { after: 'ah-drain', anchor: 'end', offset: -300, duration: 700, intensity: 0.5 }),
  ]),

  // Allfood: 8 s blob was overlong; this is a quick transmutation of an object into bland edible goo.
  'pf2e:X3fWP6YCSzcdtg93': design('A transmutation sign turns over the object and it slumps into a bland, gooey beige mass.', () => [
    cast('Matter softens', ['magic_signs.rune.transmutation.complete.yellow'], { stageId: 'af-sign', scale: 0.5, duration: 1600 }),
    impact('Edible goo', ['liquid.blob.brown', 'liquid.blob.blue'], { after: 'af-sign', anchor: 'start', offset: 700, duration: 1800, scale: 0.7, ...tint('#d6c29a') }),
  ]),

  // Amalgamizing Leap: you and the target catapult through space; departure-only shimmer left both tokens static.
  'pf2e:XB65dUQipPCTNNIY': design('Caster and target both tear into a purple teleport warp and flicker out, their signatures haphazardly entangled.', () => [
    cast('Entangle signatures', ['energy_strands.complete.dark_purple.01', 'energy_strands.complete.blue.01'], { stageId: 'ml-strands', scale: 1, duration: 1100 }),
    travel('Signatures fused', ['energy_strands.range.standard.dark_purple.01', 'energy_strands.range.standard.purple.01'], { stageId: 'ml-link', after: 'ml-strands', anchor: 'start', offset: 300, duration: 1100, scale: 0.5 }),
    cast('Caster vanishes', ['misty_step.01.purple', 'misty_step.01.blue'], { stageId: 'ml-out', after: 'ml-link', anchor: 'end', offset: -200, duration: 1300 }),
    impact('Target vanishes', ['misty_step.01.purple', 'misty_step.01.blue'], { after: 'ml-link', anchor: 'end', offset: -200, duration: 1300, targetSelection: 'all' }),
    motion('flicker', 'source', { after: 'ml-out', anchor: 'start', duration: 900, intensity: 0.7 }),
    motion('flicker', 'targets', { after: 'ml-out', anchor: 'start', duration: 900, intensity: 0.7 }),
  ]),

  // Anchoring Air: solidified air catches the attacker's strike; old recipe played only at the caster.
  'pf2e:bCZP8N2C41gF10G2': design("Air thickens around the attacking creature and a pale wind-hand clamps its strike in a vise.", () => [
    cast('Air solidifies', ['wind_lines.01.01.white'], { stageId: 'aa-cast', scale: 0.6, duration: 700 }),
    impact('Vise of air', ['arcane_hand.blue'], { stageId: 'aa-grip', after: 'aa-cast', anchor: 'start', offset: 250, duration: 1500, scale: 0.7, opacity: 0.75, ...tint('#e6f3ff') }),
    impact('Gale wraps limb', ['whirlwind.bluewhite', 'whirlwind.bluegrey'], { after: 'aa-grip', anchor: 'start', offset: 200, duration: 1500, scale: 0.55, opacity: 0.7 }),
    motion('shake', 'targets', { after: 'aa-grip', anchor: 'start', offset: 300, duration: 700, intensity: 0.4 }),
  ]),

  // Ancient Dust: a coughed cloud of grey grave soil in a cone; old projectile smoke ran 9 s.
  'pf2e:OJ91rm1FkJSlf3nk': design('The caster coughs a cone of grey grave soil; creatures caught in it choke on the void-tainted dust.', () => [
    motion('recoil', 'source', { duration: 500, intensity: 0.35 }),
    area('Grave dust cone', ['breath_weapons02.burst.cone.arcana.dark_black.01', 'breath_weapons.poison.cone.green'], { stageId: 'ad-cone', offset: 150, duration: 2200, ...tint('#9b927f') }),
    area('Dust settles', ['template_cone_PF2e.001.001.purplered'], { after: 'ad-cone', anchor: 'start', offset: 600, duration: 1800, opacity: 0.4, below: true, ...tint('#7a7365') }),
    motion('cower', 'targets', { after: 'ad-cone', anchor: 'start', offset: 450, duration: 900, intensity: 0.4 }),
  ]),

  // Angelic Messenger: planar transport to a celestial realm; an 8.5 s portal was overlong and the caster never left.
  'pf2e:joEruBVz31Uxczzq': design('A golden celestial gate opens beside the caster, divine light washes over them and they flicker away to the plane.', () => [
    cast('Celestial gate', ['portals.vertical.ring.yellow', 'portals.vertical.ring.bright_yellow'], { stageId: 'am-gate', duration: 3200, scale: 1, offsetX: 0.9, offsetUnits: 'token', fadeOut: 500 }),
    cast('Divine light', ['divine_smite.caster.standard.yellowwhite', 'divine_smite.caster.blueyellow'], { stageId: 'am-light', after: 'am-gate', anchor: 'start', offset: 900, duration: 1600, scale: 0.9 }),
    motion('flicker', 'source', { after: 'am-light', anchor: 'start', offset: 600, duration: 1000, intensity: 0.8 }),
  ]),

  // Angelic Wings: wings of pure light shedding bright light; purple feathers read as fiendish.
  'pf2e:kRsmUlSWhi6PJvZ7': design('Wings of pure golden light unfurl in a burst of radiant feathers, bright light blooms and the caster lifts into flight.', () => [
    cast('Light gathers', ['dancing_light.yellow'], { stageId: 'aw-light', scale: 0.8, duration: 700 }),
    cast('Wings unfurl', ['swirling_feathers.outburst.01.orange', 'swirling_feathers.outburst.01.textured'], { stageId: 'aw-wings', after: 'aw-light', anchor: 'start', offset: 400, duration: 2000, scale: 1.2, ...tint('#fff1b8') }),
    aura('Radiant glow', ['markers.light.complete.yellow', 'markers.light.complete.blue'], { after: 'aw-wings', anchor: 'start', offset: 300, duration: 2400, scale: 1.3, opacity: 0.7, below: true, ...tint('#ffe9a0') }),
    motion('levitate', 'source', { after: 'aw-wings', anchor: 'start', offset: 300, duration: 2200, intensity: 0.8 }),
  ]),

  // Animate Rope: an 8.5 s spectral chain loop was overlong; the rope should writhe and coil briefly.
  'pf2e:rVANhQgB8Uqi9PTl': design('A transmutation rune quickens the rope, which writhes into a coiling chain-like loop around the target point.', () => [
    cast('Rope awakens', ['magic_signs.rune.transmutation.complete.yellow'], { stageId: 'rp-sign', scale: 0.45, duration: 1200 }),
    impact('Rope coils', ['markers.chain.standard.complete.02.grey', 'markers.chain.standard.complete.02.red'], { after: 'rp-sign', anchor: 'start', offset: 600, duration: 2400, scale: 0.8, ...tint('#b58b55') }),
  ]),

  // ---- Batch 2 (Antimagic Field .. Bee-Man's Summons) ----

  // Appearance of Wealth: a vision of immense treasure; purple particles carried no sense of gold.
  'pf2e:ZeftDoh0nFAXBAWY': design('A glittering illusion of heaped gold fills the burst: golden glints and twinkling coins sparkle while onlookers stare, fascinated.', () => [
    cast('Illusion woven', ['magic_signs.rune.illusion.complete.yellow', 'magic_signs.rune.illusion.complete.purple'], { stageId: 'aw-sign', scale: 0.5, duration: 1200 }),
    area('Golden hoard gleams', ['particle_burst.01.star.yellow', 'particle_burst.01.star.bluepurple'], { stageId: 'aw-hoard', after: 'aw-sign', anchor: 'start', offset: 500, duration: 1800, ...tint('#ffd34d') }),
    area('Coins glitter', ['twinkling_stars.points07.orange'], { after: 'aw-hoard', anchor: 'start', offset: 300, duration: 2600, opacity: 0.9 }),
    area('Treasure glints', ['glint.yellow.many'], { after: 'aw-hoard', anchor: 'start', offset: 600, duration: 2000, scale: 0.8 }),
  ]),

  // Arcane Explosion: the caster's body becomes pure magic and explodes outward through a 30-ft emanation.
  'pf2e:KY2xyMavZHAoG69D': design('The caster dissolves into raw arcane force that detonates outward across the emanation, hurling creatures back, then reforms as a glowing sphere.', () => [
    cast('Body becomes magic', ['energy_field.01.blue'], { stageId: 'ae-charge', duration: 1100, scale: 1.1, ...tint('#b48cff') }),
    motion('flicker', 'source', { after: 'ae-charge', anchor: 'start', offset: 300, duration: 900, intensity: 0.8 }),
    area('Force detonation', ['explosion.04.dark_purple', 'explosion.04.blue'], { stageId: 'ae-blast', after: 'ae-charge', anchor: 'end', offset: -200, duration: 1800 }),
    area('Shockwave rolls outward', ['template_circle.out_pulse.02.burst.purplepink', 'template_circle.out_pulse.02.burst.bluewhite'], { after: 'ae-blast', anchor: 'start', offset: 100, duration: 1500 }),
    motion('recoil', 'targets', { after: 'ae-blast', anchor: 'start', offset: 250, duration: 750, intensity: 0.8 }),
    aura('Glowing sphere reforms', ['markers.light_orb.complete.blue', 'markers.light.complete.blue'], { after: 'ae-blast', anchor: 'end', offset: -300, duration: 2000, scale: 1, ...tint('#c3a2ff') }),
  ]),

  // Arctic Rift: a jagged crack in the air drawing away warmth along a line; creatures on it had no reaction.
  'pf2e:C2GYCH3TtUFqPfdX': design('A jagged frigid crack tears open along the line, frost bursts on each creature in it and they shiver, slowed by the stolen warmth.', () => [
    cast('Warmth drawn in', ['cast_generic.ice.01.blue', 'cast_generic.02.blue'], { stageId: 'ar-cast', scale: 0.8, duration: 700 }),
    area('Frigid rift', ['template_line.ice.01.blue'], { stageId: 'ar-line', after: 'ar-cast', anchor: 'end', duration: 3000 }),
    impact('Frost bites', ['impact.frost.white.01'], { after: 'ar-line', anchor: 'start', offset: 500, duration: 1300, scale: 0.8, targetSelection: 'all' }),
    motion('shake', 'targets', { after: 'ar-line', anchor: 'start', offset: 550, duration: 1000, intensity: 0.4 }),
  ]),

  // Armor of Bones: the caster ossifies; a purple force shield is the wrong material.
  'pf2e:pSNLufPPsReKQtJR': design('The caster ossifies: pale bone plates spiral in and lock into a bony shell around the body.', () => [
    cast('Bone gathers', ['aura_themed.01.inward.complete.metal.01.grey'], { stageId: 'ab-in', scale: 1, duration: 1300, ...tint('#e8dfc6') }),
    aura('Ossified shell', ['shield.02.complete.01.white', 'shield.01.complete.01.blue'], { after: 'ab-in', anchor: 'start', offset: 700, duration: 2000, scale: 1.1, opacity: 0.85, ...tint('#e8dfc6') }),
    motion('brace', 'source', { after: 'ab-in', anchor: 'start', offset: 700, duration: 800, intensity: 0.5 }),
  ]),

  // Armor of Thorn and Claw: thorns and claws erupt from the skin; pink leaves read as a nature bloom.
  'pf2e:EPTmSiURVp2ldkVB': design('Razor thorns burst outward from the body and claws rake the air as the caster bristles.', () => [
    cast('Body bristles', ['cast_generic.02.green', 'cast_generic.02.blue'], { stageId: 'tc-cast', scale: 0.75, duration: 600, ...tint('#7fa64a') }),
    aura('Thorns erupt', ['aura_themed.01.outward.complete.wood.01.green'], { stageId: 'tc-thorns', after: 'tc-cast', anchor: 'end', offset: -150, duration: 2000, scale: 1.1 }),
    aura('Claws flex', ['claws.200px.brown', 'claws.200px.red'], { after: 'tc-thorns', anchor: 'start', offset: 400, duration: 1000, scale: 0.8, ...tint('#9a7b4f') }),
    motion('pulse', 'source', { after: 'tc-thorns', anchor: 'start', duration: 800, intensity: 0.6 }),
  ]),

  // Arms of Nature: a weapon is drawn forth from wood; old films ran 8-9 s.
  'pf2e:aHu20NHj7YIqxr80': design('Vines and leaves curl out of the wooden target and resolve into a green spectral weapon.', () => [
    impact('Wood stirs', ['vine.complete.nature.single.01.green'], { stageId: 'an-vine', duration: 2200, scale: 0.6 }),
    impact('Leaves spiral', ['swirling_leaves.complete.02.green'], { after: 'an-vine', anchor: 'start', offset: 300, duration: 1800, scale: 0.6 }),
    impact('Weapon takes shape', ['spiritual_weapon.club.01.spectral.02.green'], { after: 'an-vine', anchor: 'start', offset: 900, duration: 1800, scale: 0.6, fadeIn: 300 }),
  ]),

  // Aromatic Lure: tantalizing false scents; a 7.8 s purple gas cloud read as poison.
  'pf2e:LX4pCagYLpc9hEji': design('Sweet rosy scent-wisps curl around the target, which sways dreamily toward the promised aroma.', () => [
    cast('Scent suggestion', ['magic_signs.rune.enchantment.complete.pink'], { stageId: 'lu-sign', scale: 0.45, duration: 1100 }),
    impact('Tantalizing aroma', ['smoke.puff.side.02.multicolored', 'smoke.puff.side.02.white'], { stageId: 'lu-scent', after: 'lu-sign', anchor: 'start', offset: 450, duration: 1800, scale: 0.7, ...tint('#ffb3d9') }),
    impact('Euphoric pull', ['markers.heart.pink.01', 'icon.heart.pink'], { after: 'lu-scent', anchor: 'start', offset: 600, duration: 1600, scale: 0.4 }),
    motion('drift', 'targets', { after: 'lu-scent', anchor: 'start', offset: 400, duration: 1400, intensity: 0.35 }),
  ]),

  // Arrow Salvo: an immense wooden bow launches massive arrows at everything nearby; a vines/growth sound was wrong.
  'pf2e:7PnjDM52lb4LEqHR': design('A conjured great bow looses a salvo of massive arrows that rain down across the whole burst; struck creatures reel.', () => [
    cast('Great bow drawn', ['swirling_leaves.outburst.01.greenorange', 'swirling_leaves.outburst.01.pink'], { stageId: 'as-bow', scale: 0.8, duration: 900 }),
    motion('recoil', 'source', { after: 'as-bow', anchor: 'end', offset: -200, duration: 500, intensity: 0.4 }),
    area('Arrow salvo', ['volley_of_projectiles_Circle.arrow.001.001.orangeyellow'], { stageId: 'as-volley', after: 'as-bow', anchor: 'end', offset: -100, duration: 2600 }),
    area('Dust kicks up', ['smoke.puff.ring.01.white'], { after: 'as-volley', anchor: 'start', offset: 1400, duration: 1300, opacity: 0.6, scale: 0.8, ...tint('#b39b7a') }),
    motion('stagger', 'targets', { after: 'as-volley', anchor: 'start', offset: 1300, duration: 700, intensity: 0.5 }),
  ], { sound: 'pierce' }),

  // Ash Form: a cloud of minuscule ash; dark purple smoke and a healing chime missed the material.
  'pf2e:2B0C22OuX9YrIJ5y': design('The caster crumbles into a drifting cloud of grey ash and streams lightly in place.', () => [
    cast('Body disperses', ['smoke.puff.centered.grey'], { stageId: 'af-burst', scale: 1.1, duration: 1300 }),
    sprite('Ash silhouette', { after: 'af-burst', anchor: 'start', offset: 300, duration: 1800, opacity: 0.5 }),
    aura('Ash wake', ['smoke.plumes_loop.01.grey'], { after: 'af-burst', anchor: 'start', offset: 500, duration: 2500, scale: 1.1, opacity: 0.8, fadeOut: 600, ...tint('#8a8378') }),
    motion('drift', 'source', { after: 'af-burst', anchor: 'start', offset: 300, duration: 2000, intensity: 0.4 }),
  ], { sound: 'wind' }),

  // Ash-Strewn Ending: a mythic corpse burns on a pyre and the wind scatters its ashes; a purple bonfire and lute music were off.
  'pf2e:QqMlN9VSHfD2v4Qv': design('A roaring orange pyre burns, then wind sweeps its grey ashes across the area.', () => [
    cast('Mythic pyre', ['bonfire.02.orange', 'bonfire.01.orange'], { stageId: 'ae-pyre', duration: 3000, scale: 1.1, fadeOut: 600 }),
    area('Ash scatters', ['particles.002.001.complete.many.white', 'particles.002.001.complete.many.blue'], { stageId: 'ae-ash', after: 'ae-pyre', anchor: 'start', offset: 1200, duration: 3000, ...tint('#9c958a') }),
    area('Carried on the wind', ['wind_lines.01.01.white'], { after: 'ae-ash', anchor: 'start', offset: 200, duration: 2600, opacity: 0.8 }),
  ], { sound: 'fire' }),

  // Astral Projection: an 8.5 s portal; spirits should lift out of the bodies.
  'pf2e:4Cntq9odgW6xMpAs': design('A silver cord of light spins up as the caster\'s astral double lifts free and a violet astral gate shimmers open.', () => [
    cast('Silver cord', ['energy_strands.complete.blue.01'], { stageId: 'ap-cord', scale: 0.8, duration: 1800 }),
    sprite('Astral double rises', { after: 'ap-cord', anchor: 'start', offset: 600, duration: 2000, opacity: 0.45, offsetY: -0.3, offsetUnits: 'token' }),
    cast('Astral threshold', ['portals.vertical.ring.purple', 'portals.vertical.ring.bright_yellow'], { after: 'ap-cord', anchor: 'start', offset: 800, duration: 3200, scale: 0.8, offsetX: 0.9, offsetUnits: 'token', fadeOut: 500 }),
    motion('levitate', 'source', { after: 'ap-cord', anchor: 'start', offset: 600, duration: 2000, intensity: 0.4 }),
  ]),

  // Attacked from Within: the caster reaches into the target's soul for its worst memory; a 6.4 s icon read as a status marker.
  'pf2e:B4p4cD9Q71mHTpOP': design('Spectral strands plunge into the target\'s spirit and drag up anguish; horror flares over it and it cowers.', () => [
    cast('Spirit reaches', ['energy_strands.complete.dark_purple.01', 'energy_strands.complete.blue.01'], { stageId: 'aw-cast', scale: 0.8, duration: 900 }),
    impact('Into the soul', ['energy_strands.in.purple.01', 'energy_strands.in.green.01'], { stageId: 'aw-in', after: 'aw-cast', anchor: 'start', offset: 500, duration: 1600, scale: 0.9 }),
    impact('Anguish surfaces', ['markers.horror.purple.01', 'icon.horror.purple'], { after: 'aw-in', anchor: 'start', offset: 700, duration: 1600, scale: 0.5 }),
    motion('cower', 'targets', { after: 'aw-in', anchor: 'start', offset: 700, duration: 1100, intensity: 0.5 }),
  ]),

  // Augmented Body: clockwork parts and magitech; purple sparkles carried no metal.
  'pf2e:pSepsfCrrAKuwA0N': design('Clockwork plates and gears orbit and lock onto the caster\'s body with a metallic shimmer.', () => [
    cast('Magitech spark', ['static_electricity.01.blue'], { stageId: 'au-spark', scale: 0.7, duration: 700 }),
    aura('Clockwork orbit', ['aura_themed.01.orbit.complete.metal.01.grey'], { stageId: 'au-orbit', after: 'au-spark', anchor: 'start', offset: 300, duration: 2200, scale: 1.1 }),
    aura('Plates lock in', ['aura_themed.01.inward.complete.metal.01.teal', 'aura_themed.01.inward.complete.metal.01.grey'], { after: 'au-orbit', anchor: 'start', offset: 900, duration: 1500, scale: 1 }),
    motion('pulse', 'source', { after: 'au-orbit', anchor: 'start', offset: 1100, duration: 700, intensity: 0.6 }),
  ]),

  // Avatar: a Huge avatar of the caster's deity; generic purple transformation lacked any divinity.
  'pf2e:ckUOoqOM7Kg7VqxB': design('A pillar of divine radiance engulfs the caster, a blessing sigil blazes and the caster swells into a towering avatar.', () => [
    cast('Divine summons', ['divine_smite.caster.standard.yellowwhite', 'divine_smite.caster.blueyellow'], { stageId: 'av-smite', scale: 1.2, duration: 1600 }),
    aura('Blessing blazes', ['bless.400px.intro.yellow'], { stageId: 'av-bless', after: 'av-smite', anchor: 'start', offset: 600, duration: 2000, scale: 1.4, below: true }),
    sprite('Towering silhouette', { after: 'av-bless', anchor: 'start', offset: 300, duration: 1800, scale: 1.8, opacity: 0.35 }),
    motion('pulse', 'source', { after: 'av-bless', anchor: 'start', offset: 300, duration: 1300, intensity: 0.9 }),
  ]),

  // Awaken Entropy: time accelerates, flesh falters and stone crumbles; orange cracks and blue particles read as fire/ice.
  'pf2e:ZMvplR106Jxl7B15': design('Entropy wakes across the burst: the ground cracks dull grey, ash-coloured motes crumble upward and creatures inside wither.', () => [
    area('Ground ages and cracks', ['ground_cracks.02.purple', 'ground_cracks.02.orange'], { stageId: 'en-crack', duration: 3200, below: true, ...tint('#6d6670') }),
    area('Matter crumbles', ['particles.002.001.complete.many.purplered', 'particles.002.001.complete.many.blue'], { stageId: 'en-dust', after: 'en-crack', anchor: 'start', offset: 400, duration: 3000, ...tint('#a39a8f') }),
    area('Time-worn haze', ['smoke.plumes.01.grey'], { after: 'en-dust', anchor: 'start', offset: 300, duration: 2400, opacity: 0.5 }),
    motion('stagger', 'targets', { after: 'en-crack', anchor: 'start', offset: 700, duration: 1100, intensity: 0.45 }),
  ]),

  // Awaken Portal: an 8.5 s portal film was overlong.
  'pf2e:AkF4yFcSCdhoULyZ': design('Energy gathers and threads into a dormant gate, which flares awake in a violet ring.', () => [
    cast('Energy gathers', ['particles.inward.greenyellow.01.03'], { stageId: 'po-gather', scale: 0.7, duration: 1500 }),
    cast('Gate connections', ['energy_strands.complete.blue.01'], { after: 'po-gather', anchor: 'start', offset: 500, duration: 1800, scale: 0.85 }),
    cast('Portal reawakens', ['portals.vertical.ring.purple', 'portals.vertical.ring.bright_yellow'], { after: 'po-gather', anchor: 'start', offset: 1000, duration: 3500, scale: 1.1, offsetX: 1, offsetUnits: 'token', fadeOut: 600 }),
  ]),

  // Banishing Touch: a touch launches the target up into the air and away; nothing moved before.
  'pf2e:nKR6Xt5cPGDumX66': design('A force-charged palm strike blasts the target, which is flung up and backward by a gust of magic.', () => [
    motion('lunge', 'source', { stageId: 'bt-lunge', duration: 600, intensity: 0.5 }),
    impact('Launching touch', ['unarmed_strike.magical.02.blue'], { stageId: 'bt-hit', after: 'bt-lunge', anchor: 'start', offset: 300, duration: 900, scale: 0.9 }),
    impact('Force gust', ['side_impact.part.shockwave.blue'], { after: 'bt-hit', anchor: 'start', offset: 150, duration: 900, scale: 0.8 }),
    motion('leap', 'targets', { after: 'bt-hit', anchor: 'start', offset: 200, duration: 1500, distance: 1.5, motionRange: 'distance', motionHeading: 'away', jumpHeight: 0.8, intensity: 0.6 }),
  ]),

  // Banishment: an 8.4 s portal film; the target should be wrenched toward its home plane.
  'pf2e:bay4AfSu2iIozNNW': design('A swirling planar vortex opens beneath the target and its home plane pulls hard at it.', () => [
    cast('Banishing word', ['magic_signs.rune.abjuration.complete.purple', 'magic_signs.rune.abjuration.complete.blue'], { stageId: 'ba-sign', scale: 0.5, duration: 1100 }),
    impact('Planar vortex', ['portals.horizontal.vortex.purple', 'portals.horizontal.ring.bright_yellow'], { stageId: 'ba-vortex', after: 'ba-sign', anchor: 'start', offset: 500, duration: 2800, scale: 0.9, below: true, fadeOut: 500 }),
    impact('Home plane tugs', ['energy_strands.in.purple.01', 'energy_strands.in.green.01'], { after: 'ba-vortex', anchor: 'start', offset: 400, duration: 1800, scale: 0.9 }),
    motion('shake', 'targets', { after: 'ba-vortex', anchor: 'start', offset: 500, duration: 1300, intensity: 0.5 }),
  ]),

  // Barbed Spear: a conjured barbed spear hurled at a foe; a purple cold arrow was the wrong object and element.
  'pf2e:dQ7LrD2HxJoCzi2M': design('A conjured barbed spear is hurled and lodges in the target with a spray of blood.', () => [
    cast('Spear conjured', ['glint.purple.few', 'glint.yellow.few'], { stageId: 'bs-cast', scale: 0.7, duration: 500 }),
    motion('throw', 'source', { after: 'bs-cast', anchor: 'start', offset: 200, duration: 600, intensity: 0.5 }),
    travel('Spear flies', ['spear.throw.01', 'arrow.physical.white.01'], { stageId: 'bs-flight', after: 'bs-cast', anchor: 'end', duration: 1300 }),
    impact('Barbs bite', ['impact.005.dark_red', 'impact.005.orange'], { after: 'bs-flight', anchor: 'start', offset: 900, duration: 900, scale: 0.7 }),
    motion('recoil', 'targets', { after: 'bs-flight', anchor: 'start', offset: 950, duration: 650, intensity: 0.5 }),
  ]),

  // ---- Batch 3 (Befitting Attire .. Bloody Tendrils) ----

  // Begone: a touch sends the foe rocketing backward; there was no touch and the strands read as a buff.
  'pf2e:1INVZLR5tMzSPZVZ': design('A touch releases a burst of mystic force and the foe is shoved hard away from the caster.', () => [
    motion('lunge', 'source', { stageId: 'bg-touch', duration: 550, intensity: 0.45 }),
    impact('Mystic force', ['unarmed_strike.magical.02.pinkpurple', 'unarmed_strike.magical.02.blue'], { stageId: 'bg-hit', after: 'bg-touch', anchor: 'start', offset: 280, duration: 900, scale: 0.85 }),
    impact('Shockwave', ['side_impact.part.shockwave.purple', 'side_impact.part.shockwave.blue'], { after: 'bg-hit', anchor: 'start', offset: 150, duration: 900, scale: 0.8 }),
    motion('rush', 'targets', { after: 'bg-hit', anchor: 'start', offset: 200, duration: 1400, distance: 1.2, motionRange: 'distance', motionHeading: 'away', intensity: 0.6 }),
  ]),

  // Beheading Buzz Saw: a molten bladed disc wheels down the line slicing everyone; targets had no wound or reaction.
  'pf2e:dKWc83KKiXoIJkhp': design('Molten scrap spins into a bladed disc that wheels down the line; each creature in its path is slashed and bleeds.', () => [
    cast('Molten scrap gathers', ['cast_generic.fire.01.orange'], { stageId: 'bz-cast', scale: 0.7, duration: 600, ...tint('#ffb070') }),
    area('Buzz saw wheels forward', ['chakram.01.return.01', 'template_line_piercing.generic.01.orange'], { stageId: 'bz-saw', after: 'bz-cast', anchor: 'end', duration: 2200, ...tint('#ffb070') }),
    impact('Bladed cut', ['melee_generic.slash.01.orange', 'melee_generic.slash.01.orange'], { after: 'bz-saw', anchor: 'start', offset: 700, duration: 900, scale: 0.8, targetSelection: 'all' }),
    impact('Bleeding wound', ['liquid.splash_side02.red'], { after: 'bz-saw', anchor: 'start', offset: 900, duration: 1000, scale: 0.5, targetSelection: 'all' }),
    motion('stagger', 'targets', { after: 'bz-saw', anchor: 'start', offset: 750, duration: 700, intensity: 0.55 }),
  ]),

  // Beseech Arcanotheign: a half-white, half-black storm of magic arrives with a flash and cacophonous crash (sonic).
  'pf2e:wZ1rsLrWfYtMZfgv': design("Nethys's herald arrives as a roiling storm of white and black magic; a blinding flash and a cacophonous crash roll across the emanation.", () => [
    cast('Storm of magic', ['static_electricity.03.purple', 'static_electricity.03.blue'], { stageId: 'ba-storm', duration: 1600, scale: 1.4 }),
    cast('White half', ['smoke.puff.ring.01.white'], { after: 'ba-storm', anchor: 'start', offset: 200, duration: 1600, scale: 0.9, offsetX: -0.25, offsetUnits: 'token' }),
    cast('Black half', ['smoke.puff.ring.01.dark_black', 'smoke.puff.ring.01.white'], { after: 'ba-storm', anchor: 'start', offset: 200, duration: 1600, scale: 0.9, offsetX: 0.25, offsetUnits: 'token', mirrorX: true }),
    area('Cacophonous crash', ['template_circle.out_pulse.02.burst.bluewhite'], { stageId: 'ba-crash', after: 'ba-storm', anchor: 'start', offset: 900, duration: 1800 }),
    motion('cower', 'targets', { after: 'ba-crash', anchor: 'start', offset: 200, duration: 900, intensity: 0.5 }),
  ], { sound: 'sonic' }),

  // Bestial Curse: the target's body churns into bestial features; a spider web made no sense.
  'pf2e:VuPDHoVEPLbMfCJC': design('A curse sinks into the target and its body churns: claw marks and coarse hide ripple over it as it doubles over.', () => [
    cast('Curse spoken', ['magic_signs.rune.transmutation.complete.red', 'magic_signs.rune.transmutation.complete.yellow'], { stageId: 'bc-sign', scale: 0.45, duration: 1100 }),
    impact('Curse takes hold', ['condition.curse.01.007.red'], { stageId: 'bc-curse', after: 'bc-sign', anchor: 'start', offset: 500, duration: 1800, scale: 0.6 }),
    impact('Bestial features', ['claws.200px.brown', 'claws.200px.red'], { after: 'bc-curse', anchor: 'start', offset: 500, duration: 1000, scale: 0.7, ...tint('#9a7b4f') }),
    motion('shake', 'targets', { after: 'bc-curse', anchor: 'start', offset: 450, duration: 1000, intensity: 0.5 }),
  ]),

  // Bind Undead: an 8.7 s chain loop was overlong for a single word of power.
  'pf2e:GUeRTriJkMlMlVrk': design('A necromantic word lashes spectral chains around the undead target, binding it to the caster\'s will.', () => [
    cast('Word of power', ['magic_signs.rune.necromancy.complete.green'], { stageId: 'bu-sign', scale: 0.5, duration: 1100 }),
    travel('Command link', ['energy_strands.range.standard.dark_green.01', 'energy_strands.range.standard.purple.01'], { stageId: 'bu-link', after: 'bu-sign', anchor: 'start', offset: 400, duration: 1300, scale: 0.5 }),
    impact('Bound in chains', ['markers.chain.spectral_standard.complete.02.green', 'markers.chain.spectral_standard.complete.02.blue'], { after: 'bu-link', anchor: 'start', offset: 600, duration: 2400, scale: 0.7 }),
    motion('shake', 'targets', { after: 'bu-link', anchor: 'start', offset: 700, duration: 700, intensity: 0.35 }),
  ]),

  // Binding Circle: ritual that calls an extraplanar creature into a circle; 8.5 s portal ran over the cap.
  'pf2e:2ykmAVKrsAWcazcC': design('A binding conjuration circle blazes on the ground and an extraplanar gate shimmers open within it.', () => [
    cast('Binding circle', ['magic_signs.circle.02.conjuration.complete.yellow'], { stageId: 'bi-circle', scale: 1.2, duration: 3500, below: true }),
    cast('Extraplanar gate', ['portals.horizontal.ring.purple', 'portals.horizontal.ring.bright_yellow'], { after: 'bi-circle', anchor: 'start', offset: 900, duration: 2800, scale: 0.8, below: true, fadeOut: 500 }),
  ]),

  // Binding Muzzle: a shimmering muzzle of force clamps the mouth shut.
  'pf2e:lrFKkzgz80B5vTBb': design('Bands of shimmering force snap around the target\'s mouth and a mute sigil flashes as it is clamped shut.', () => [
    impact('Force bands', ['energy_strands.complete.purple.01', 'energy_strands.complete.blue.01'], { stageId: 'bm-bands', duration: 1500, scale: 0.55, offsetY: -0.15, offsetUnits: 'token' }),
    impact('Muzzled', ['markers.mute.purple.01', 'icon.mute.dark_red'], { after: 'bm-bands', anchor: 'start', offset: 500, duration: 1600, scale: 0.4 }),
    motion('shake', 'targets', { after: 'bm-bands', anchor: 'start', offset: 450, duration: 650, intensity: 0.35 }),
  ]),

  // Blackfinger's Blades: weapons coated in giant scorpion venom; a 7.8 s gas cloud overshot it.
  'pf2e:y5pzaNfb17CM1slC': design('Dripping green venom coats each blessed weapon and a toxic glint marks it.', () => [
    cast('Prayer for death', ['cast_generic.02.green', 'cast_generic.02.blue'], { stageId: 'bf-cast', scale: 0.7, duration: 700 }),
    impact('Venom coats weapons', ['liquid.splash_side.bright_green', 'liquid.splash_side.blue'], { stageId: 'bf-venom', after: 'bf-cast', anchor: 'end', duration: 1200, scale: 0.5, targetSelection: 'all', ...tint('#6fcf3a') }),
    impact('Toxic sign', ['markers.poison.dark_green.01', 'icon.poison.dark_green'], { after: 'bf-venom', anchor: 'start', offset: 400, duration: 1600, scale: 0.35, targetSelection: 'all' }),
  ]),

  // Blastback: you hit the ground with a shuddering boom; caster and targets were static.
  'pf2e:YuCBhE9tGgN8G2zU': design('The caster slams down with a shuddering boom and a ring of displaced air bowls nearby creatures back.', () => [
    motion('slam', 'source', { stageId: 'bb-slam', duration: 600, intensity: 0.7 }),
    area('Air bursts outward', ['thunderwave.center.blue'], { stageId: 'bb-wave', after: 'bb-slam', anchor: 'start', offset: 300, duration: 1500, ...tint('#eef6ff') }),
    area('Dust ring', ['smoke.puff.ring.01.white'], { after: 'bb-wave', anchor: 'start', duration: 1300, opacity: 0.7, ...tint('#cfc6b8') }),
    motion('recoil', 'targets', { after: 'bb-wave', anchor: 'start', offset: 200, duration: 700, intensity: 0.6 }),
  ]),

  // Blessed Boundary: hundreds of spiky divine-force fragments swirling as a hollow protective sphere.
  'pf2e:jj5d830iUi2ZlQfs': design('Hundreds of golden spiky fragments of divine force whirl up into a hollow protective shell around the burst.', () => [
    cast('Divine force called', ['divine_smite.caster.standard.yellowwhite', 'divine_smite.caster.blueyellow'], { stageId: 'bb-call', scale: 0.8, duration: 1100 }),
    area('Shell of fragments', ['energy_wall.01.circle.900x900.01.complete.orange', 'wall_of_force.sphere.grey'], { stageId: 'bb-shell', after: 'bb-call', anchor: 'start', offset: 500, duration: 3200, ...tint('#ffe08a') }),
    area('Whirling shards', ['cloud_of_daggers.kunai.yellow', 'cloud_of_daggers.daggers.yellow'], { after: 'bb-shell', anchor: 'start', offset: 300, duration: 2500, opacity: 0.8 }),
  ]),

  // Blight: plants wither and crops spoil; blue-purple leaves and blue motes read as a fey bloom.
  'pf2e:7yWXx3qC4eFNHhxD': design('Dead brown leaves whirl away from the caster and grey motes of withered soil drift off.', () => [
    cast('Leaves wither', ['swirling_leaves.outburst.01.orangered', 'swirling_leaves.outburst.01.pink'], { stageId: 'bl-leaves', scale: 0.9, duration: 2400, ...tint('#8a6b3a') }),
    cast('Soil sickens', ['particles.outward.white.01.03', 'particles.outward.greenyellow.01.03'], { after: 'bl-leaves', anchor: 'start', offset: 600, duration: 2200, scale: 0.9, ...tint('#6f6658') }),
  ]),

  // Blightburn Blast: a cone of radioactive blightburn energy; a poison icon projectile ran 6.5 s.
  'pf2e:EgkypvUZIZkx1UlQ': design('A cone of lurid green radiation blasts from the caster\'s hands, glittering with crystal motes; creatures inside recoil sickened.', () => [
    cast('Radiation gathers', ['cast_generic.02.green', 'cast_generic.02.blue'], { stageId: 'bb-cast', scale: 0.7, duration: 600 }),
    area('Blightburn blast', ['breath_weapons02.burst.cone.fire.green.01', 'breath_weapons.poison.cone.green'], { stageId: 'bb-cone', after: 'bb-cast', anchor: 'end', offset: -100, duration: 2200, ...tint('#b6ff3a') }),
    area('Crystal glimmer', ['twinkling_stars.points06.white'], { after: 'bb-cone', anchor: 'start', offset: 400, duration: 1800, opacity: 0.8, ...tint('#d9ff9a') }),
    motion('recoil', 'targets', { after: 'bb-cone', anchor: 'start', offset: 400, duration: 700, intensity: 0.5 }),
  ]),

  // Blinding Beauty: a terribly beautiful glance in a cone that dazzles and blinds.
  'pf2e:Q56HLIHVKY6bC5W3': design('A dazzling, rosy-gold radiance sweeps out of the caster\'s glance across the cone and enemies shield their eyes.', () => [
    cast('Alluring glance', ['eyes.01.orangeyellow.single', 'eyes.01.dark_green.single'], { stageId: 'bb-eyes', scale: 0.45, duration: 900 }),
    area('Blinding beauty', ['breath_weapons02.burst.cone.holy.yellow.01', 'template_cone_PF2e.001.001.purplered'], { stageId: 'bb-cone', after: 'bb-eyes', anchor: 'start', offset: 500, duration: 1800, opacity: 0.85, ...tint('#ffd6ea') }),
    area('Dazzling glints', ['glint.yellow.many'], { after: 'bb-cone', anchor: 'start', offset: 300, duration: 1500 }),
    motion('cower', 'targets', { after: 'bb-cone', anchor: 'start', offset: 350, duration: 900, intensity: 0.4 }),
  ]),

  // Blinding Bottle: an exploding glass bottle hurled across enemy lines; a grenade launch was the wrong object.
  'pf2e:3ygqSJYWZM1UV76Z': design('The caster hurls a conjured glass bottle; it shatters across the burst in a cloud of sight-stealing green toxin.', () => [
    motion('throw', 'source', { stageId: 'bo-throw', duration: 600, intensity: 0.5 }),
    projectile('Bottle flies', ['throwable.throw.flask.03.green', 'throwable.throw.flask.01.orange'], { stageId: 'bo-flight', after: 'bo-throw', anchor: 'start', offset: 250, duration: 1100, scale: 0.6 }),
    area('Glass shatters', ['explosion.side_fracture.flask.03', 'explosion.side_fracture.flask.01'], { after: 'bo-flight', anchor: 'end', duration: 1000, scale: 0.6 }),
    area('Toxic cloud', ['fumes.toxic.green', 'fumes.04.complete.grey'], { stageId: 'bo-cloud', after: 'bo-flight', anchor: 'end', offset: 100, duration: 2500 }),
    motion('cower', 'targets', { after: 'bo-cloud', anchor: 'start', offset: 300, duration: 900, intensity: 0.4 }),
  ]),

  // Blinding Foam: colourful caustic foam sprayed into the eyes; a 5.7 s bubble film read as a protective ward.
  'pf2e:7uL4XhHpxZpgNJPh': design('A glob of colourful caustic foam sprays onto the target\'s face and fizzes there as it reels.', () => [
    cast('Foam gathers', ['cast_generic.02.green', 'cast_generic.02.blue'], { stageId: 'fo-cast', scale: 0.7, duration: 550 }),
    projectile('Foam glob', ['liquid.blob.green', 'liquid.blob.blue'], { stageId: 'fo-glob', after: 'fo-cast', anchor: 'end', duration: 700, scale: 0.5 }),
    impact('Foam splashes', ['liquid.splash.bright_green', 'liquid.splash.blue'], { stageId: 'fo-hit', after: 'fo-glob', anchor: 'end', duration: 1300, scale: 0.75 }),
    impact('Fizzing foam', ['bubble.002.001.complete.pinkyellow', 'bubble.002.001.complete.blue'], { after: 'fo-hit', anchor: 'start', offset: 250, duration: 1800, scale: 0.45, offsetY: -0.15, offsetUnits: 'token' }),
    motion('recoil', 'targets', { after: 'fo-hit', anchor: 'start', duration: 650, intensity: 0.55 }),
  ]),

  // Blister: searing caustic blisters grow on the skin; an 8.3 s blue blob was too long and the wrong colour.
  'pf2e:59NR1hA2jPSgg2sW': design('Searing blisters swell on the target\'s skin, bubbling with yellow-green caustic fluid as it flinches.', () => [
    cast('Point', ['cast_generic.02.green', 'cast_generic.02.blue'], { stageId: 'bl-cast', scale: 0.6, duration: 500 }),
    impact('Blisters swell', ['bubble.001.002.complete.green', 'bubble.001.002.complete.blue'], { stageId: 'bl-swell', after: 'bl-cast', anchor: 'end', duration: 2000, scale: 0.45, ...tint('#c8d94a') }),
    impact('Caustic sheen', ['fumes.04.complete.green', 'fumes.04.complete.grey'], { after: 'bl-swell', anchor: 'start', offset: 500, duration: 1600, scale: 0.7, opacity: 0.7 }),
    motion('shake', 'targets', { after: 'bl-swell', anchor: 'start', offset: 300, duration: 800, intensity: 0.4 }),
  ]),

  // Blood Chestnuts: a handful of sharp crimson seeds; a purple cold arrow was the wrong object and element.
  'pf2e:HTzrWoYokIEqxD9t': design('A flung handful of sharp crimson seeds pelts the target and buries itself in its flesh.', () => [
    motion('throw', 'source', { stageId: 'bc-throw', duration: 550, intensity: 0.45 }),
    travel('Crimson seeds', ['bullet.02.red', 'bullet.01.orange'], { stageId: 'bc-seeds', after: 'bc-throw', anchor: 'start', offset: 250, duration: 1000, scale: 0.6, ...tint('#a3182a') }),
    impact('Seeds bury in', ['impact.005.dark_red', 'impact.005.orange'], { after: 'bc-seeds', anchor: 'start', offset: 700, duration: 900, scale: 0.6 }),
    motion('recoil', 'targets', { after: 'bc-seeds', anchor: 'start', offset: 750, duration: 650, intensity: 0.45 }),
  ]),

  // Blood Feast: the caster's head splits into an enormous maw that feasts on blood; a magic sword was wrong.
  'pf2e:ES6FkwXXqYr4ujQH': design('The caster lunges and an enormous red maw bites into the target, spraying blood.', () => [
    motion('lunge', 'source', { stageId: 'bf-lunge', duration: 650, intensity: 0.6 }),
    impact('Enormous maw', ['bite.400px.red'], { stageId: 'bf-bite', after: 'bf-lunge', anchor: 'start', offset: 300, duration: 1000, scale: 0.8 }),
    impact('Blood spray', ['liquid.splash02.red'], { after: 'bf-bite', anchor: 'start', offset: 300, duration: 1200, scale: 0.7 }),
    motion('recoil', 'targets', { after: 'bf-bite', anchor: 'start', offset: 250, duration: 650, intensity: 0.55 }),
  ]),

  // Blood in the Water: spectral aquatic predators swarm the bleeding target; a sacred flame cast and 5.3 s splash were off.
  'pf2e:CXpOlv2ZZq2jVbRX': design('Bloodied water churns around the target as spectral predators circle and snap at it.', () => [
    cast('Hex', ['cast_generic.water.02.blue'], { stageId: 'bw-cast', scale: 0.7, duration: 700 }),
    impact('Bloodied water churns', ['water_splash.circle.01.red', 'water_splash.circle.01.blue'], { stageId: 'bw-water', after: 'bw-cast', anchor: 'end', duration: 1800, scale: 0.9 }),
    impact('Spectral predators', ['aura_themed.01.orbit.complete.cold.01.blue'], { after: 'bw-water', anchor: 'start', offset: 200, duration: 2000, scale: 0.9, opacity: 0.6, ...tint('#7fd4ff') }),
    impact('Snapping jaws', ['bite.200px.blue', 'bite.200px.red'], { after: 'bw-water', anchor: 'start', offset: 700, duration: 900, scale: 0.6, opacity: 0.85 }),
    motion('shake', 'targets', { after: 'bw-water', anchor: 'start', offset: 750, duration: 750, intensity: 0.45 }),
  ]),

  // Blood Runs Cold: chilling the blood in the veins; snowflake icons ran 6.4 s.
  'pf2e:Oj36W4SwlVBMMdiX': design('Frost creeps inward over the target as its blood chills, and it shivers.', () => [
    cast('Chill', ['cast_generic.ice.01.blue', 'cast_generic.02.blue'], { stageId: 'bc-cast', scale: 0.6, duration: 600 }),
    impact('Frost creeps inward', ['aura_themed.01.inward.complete.cold.01.blue'], { stageId: 'bc-frost', after: 'bc-cast', anchor: 'end', duration: 1800, scale: 0.9 }),
    impact('Blood chills', ['markers.snowflake.blue.01', 'icon.snowflake.blue'], { after: 'bc-frost', anchor: 'start', offset: 600, duration: 1500, scale: 0.35 }),
    motion('shake', 'targets', { after: 'bc-frost', anchor: 'start', offset: 400, duration: 1200, intensity: 0.3 }),
  ]),

  // Blood-Feasting Breath: inhale life from one cone, exhale it as healing; drifting wind lines ran 5.4 s.
  'pf2e:94eJHyFPNM1Z3TZp': design('A dark red cone of life-draining breath sweeps the area, crimson essence rushes back into the caster and a healing glow follows.', () => [
    area('Draining breath', ['breath_weapons02.burst.cone.arcana.dark_black.01', 'breath_weapons.poison.cone.green'], { stageId: 'fb-cone', duration: 2000, ...tint('#8a1424') }),
    motion('stagger', 'targets', { after: 'fb-cone', anchor: 'start', offset: 400, duration: 800, intensity: 0.45 }),
    cast('Life inhaled', ['energy_strands.in.red.01', 'energy_strands.in.green.01'], { stageId: 'fb-in', after: 'fb-cone', anchor: 'start', offset: 900, duration: 1500, scale: 0.9 }),
    cast('Life exhaled as healing', ['healing_generic.200px.red', 'healing_generic.200px.green'], { after: 'fb-in', anchor: 'start', offset: 800, duration: 1500, scale: 0.8 }),
  ]),

  // Bloodspray Curse: any wound gushes blood; a yellow ward rune read as protective.
  'pf2e:VXUrO8TwRqBpNzdU': design('A blood-red curse settles on the target and its skin weeps a brief gush of blood.', () => [
    cast('Curse spoken', ['cast_generic.dark.01.red', 'cast_generic.01.yellow'], { stageId: 'bs-cast', scale: 0.6, duration: 700 }),
    impact('Wound curse', ['condition.curse.01.016.red'], { stageId: 'bs-curse', after: 'bs-cast', anchor: 'start', offset: 400, duration: 2000, scale: 0.6 }),
    impact('Blood gushes', ['liquid.splash02.red'], { after: 'bs-curse', anchor: 'start', offset: 600, duration: 1100, scale: 0.5 }),
    motion('shake', 'targets', { after: 'bs-curse', anchor: 'start', offset: 600, duration: 600, intensity: 0.35 }),
  ]),

  // ---- Batch 4 (Blossoming Gore .. Call The Blood) ----

  // Blossoming Gore: a field of bloody roses grows from a thrall's blood; a 7.9 s tinted yellow-green growth ran long.
  'pf2e:77Zvk75oywQ7MBVV': design('Thrall blood soaks the ground and a field of crimson roses bursts up across the burst.', () => [
    area('Blood soaks the ground', ['liquid.splash02.red'], { stageId: 'bg-blood', duration: 1500, scale: 0.8 }),
    area('Bloody roses bloom', ['plant_growth.02.round.4x4.complete.greenred', 'plant_growth.03.round.4x4.complete.greenyellow'], { after: 'bg-blood', anchor: 'start', offset: 500, duration: 3500, ...tint('#a3243f') }),
  ]),

  // Boil Blood: blood boils within the veins; a silent recipe for a fire spell, and the flame ran 5 s.
  'pf2e:fBoiPXmcIO50OFFR': design('Heat floods the target\'s veins: inner flames flare, scalding steam rises off it and it convulses.', () => [
    cast('Heat gathers', ['cast_generic.fire.01.orange'], { stageId: 'bb-cast', scale: 0.8, duration: 650 }),
    impact('Blood boils', ['flames.01.orange'], { stageId: 'bb-boil', after: 'bb-cast', anchor: 'end', duration: 2200, scale: 0.9, opacity: 0.85, ...tint('#ff5a3a') }),
    impact('Scalding steam', ['fumes.steam.white'], { after: 'bb-boil', anchor: 'start', offset: 500, duration: 1800, scale: 0.8 }),
    motion('shake', 'targets', { after: 'bb-boil', anchor: 'start', offset: 300, duration: 1300, intensity: 0.5 }),
  ], { sound: 'fire' }),

  // Bonding Meal: a shared meal that binds friends; a 9 s smoke plume and rune icons ran long.
  'pf2e:aYn7Xgrz4vIMNeIc': design('A warm cooking fire glows while hearts of shared memory drift up from the gathering.', () => [
    cast('Cooking fire', ['campfire.03.01.complete.orange', 'campfire.01.orange'], { stageId: 'bm-fire', duration: 3200, scale: 0.6, below: true, fadeOut: 500 }),
    cast('Shared memories', ['markers.heart.pink.01', 'icon.heart.pink'], { after: 'bm-fire', anchor: 'start', offset: 900, duration: 2000, scale: 0.4, offsetY: -0.5, offsetUnits: 'token' }),
  ]),

  // Bone Moth's Kiss: a tiny bone-white moth flies from the caster's mouth to brush the target; purple poison gas missed it.
  'pf2e:MavAJJo6jhQfdBXW': design('A tiny bone-white moth flutters from the caster to the target and brushes it with diseased wings.', () => [
    cast('Moth emerges', ['butterflies.single.yellow', 'butterflies.single.orange'], { stageId: 'bm-out', duration: 900, scale: 0.35, offsetY: -0.2, offsetUnits: 'token', ...tint('#f2ecdc') }),
    projectile('Moth flies', ['butterflies.single.yellow', 'butterflies.single.orange'], { stageId: 'bm-fly', after: 'bm-out', anchor: 'start', offset: 500, duration: 1400, scale: 0.35, ...tint('#f2ecdc') }),
    impact('Wing-dust kiss', ['smoke.puff.centered.grey'], { after: 'bm-fly', anchor: 'end', duration: 1300, scale: 0.5, ...tint('#e8e0cc') }),
    motion('shake', 'targets', { after: 'bm-fly', anchor: 'end', offset: 100, duration: 600, intensity: 0.3 }),
  ]),

  // Bone Shield: a shield of rough raw bone in a free hand; purple force shield missed the material.
  'pf2e:nWrcBLML2mCZxW5v': design('Rough bone fragments knit together into a pale shield and the caster raises it.', () => [
    cast('Bone assembles', ['aura_themed.01.inward.complete.metal.01.grey'], { stageId: 'bs-in', scale: 0.8, duration: 1100, ...tint('#e8dfc6') }),
    aura('Bone shield raised', ['shield.02.complete.01.white', 'shield.01.complete.01.blue'], { after: 'bs-in', anchor: 'start', offset: 600, duration: 1800, scale: 0.9, ...tint('#e2d6b8') }),
    motion('brace', 'source', { after: 'bs-in', anchor: 'start', offset: 650, duration: 750, intensity: 0.5 }),
  ]),

  // Bone Spray: a torrent of jagged bone shards fills the cone; one thrown bone and a footprint read thin.
  'pf2e:S708JF3E0kuhuRzG': design('A torrent of jagged bone shards sprays through the cone and creatures inside are torn and bleed.', () => [
    motion('recoil', 'source', { duration: 450, intensity: 0.35 }),
    area('Bone shard torrent', ['volley_of_projectiles_ConePF2e.arrow.001.003.white', 'volley_of_projectiles_ConePF2e.arrow.001.001.orangeyellow'], { stageId: 'bs-volley', duration: 2200, ...tint('#ece4cf') }),
    impact('Torn flesh', ['liquid.splash_side02.red'], { after: 'bs-volley', anchor: 'start', offset: 900, duration: 1000, scale: 0.45, targetSelection: 'all' }),
    motion('stagger', 'targets', { after: 'bs-volley', anchor: 'start', offset: 900, duration: 700, intensity: 0.5 }),
  ]),

  // Boneshaker: seize a creature's skeleton from afar and clench; a 6.4 s skull icon and earth rumble missed the grip.
  'pf2e:zdNUbHqqZzjA07oM': design('A spectral bone-white hand closes around the target\'s skeleton and squeezes; the target buckles.', () => [
    motion('pulse', 'source', { stageId: 'bk-fist', duration: 600, intensity: 0.4 }),
    impact('Skeletal grip', ['arcane_hand.purple'], { stageId: 'bk-hand', after: 'bk-fist', anchor: 'start', offset: 200, duration: 1600, scale: 0.75, ...tint('#e8dfc6') }),
    impact('Bones compress', ['impact.dark.01.red', 'impact.004.blue'], { after: 'bk-hand', anchor: 'start', offset: 700, duration: 900, scale: 0.6, ...tint('#d9cfb8') }),
    motion('press', 'targets', { after: 'bk-hand', anchor: 'start', offset: 650, duration: 1000, intensity: 0.6 }),
  ], { sound: 'bludgeon' }),

  // Bonewall Bulwark: a jumble of bones with reaching limbs forms a wall; a skull icon and blue motes didn't build anything.
  'pf2e:11pQoPJpSH2jp7h6': design('A jumble of pale bones tumbles into a wall along the line, a necrotic skull ward flaring as it settles.', () => [
    area('Bones pile into a wall', ['falling_rocks.top.2x1.white', 'falling_rocks.top.2x1.grey'], { stageId: 'bw-wall', duration: 2400, ...tint('#e6dcc4') }),
    area('Necrotic binding', ['ward.skull.dark_purple.01', 'icon.skull.purple'], { after: 'bw-wall', anchor: 'start', offset: 800, duration: 1800, scale: 0.4 }),
  ]),

  // Bony Barrage: a volley of teeth, vertebrae and phalanges in a 30-ft cone.
  'pf2e:yfaTZv8nCsS4GtrA': design('The thrall shatters into a volley of teeth and bones that pelts every creature in the cone.', () => [
    area('Bone volley', ['volley_of_projectiles_ConePF2e.arrow.001.002.white', 'volley_of_projectiles_ConePF2e.arrow.001.001.orangeyellow'], { stageId: 'bb-volley', duration: 2400, ...tint('#ece4cf') }),
    impact('Bone fragments strike', ['impact.004.blue'], { after: 'bb-volley', anchor: 'start', offset: 1000, duration: 800, scale: 0.5, targetSelection: 'all', ...tint('#e6dcc4') }),
    motion('stagger', 'targets', { after: 'bb-volley', anchor: 'start', offset: 1000, duration: 700, intensity: 0.5 }),
  ]),

  // Boomerang Shot: a curved length of wood strikes for bludgeoning; the vine/growth sound was off.
  'pf2e:zPVJI8Jltt3ERkaU': design('A curved length of wood is launched, arcs to the target and cracks into it.', () => [
    cast('Wood shaped', ['swirling_leaves.complete.02.green'], { stageId: 'bo-cast', scale: 0.7, duration: 600 }),
    motion('throw', 'source', { after: 'bo-cast', anchor: 'start', offset: 250, duration: 600, intensity: 0.5 }),
    travel('Boomerang arcs', ['boomerang.01.white.01.throw', 'arrow.physical.white.01'], { stageId: 'bo-flight', after: 'bo-cast', anchor: 'end', duration: 1300, ...tint('#a87b4f') }),
    impact('Wood cracks in', ['impact.001.green', 'impact.001.blue'], { after: 'bo-flight', anchor: 'start', offset: 900, duration: 800, scale: 0.8, ...tint('#a87b4f') }),
    motion('recoil', 'targets', { after: 'bo-flight', anchor: 'start', offset: 950, duration: 650, intensity: 0.5 }),
  ], { sound: 'bludgeon' }),

  // Booming Blast: an amplified gunshot crack spreads terror; the 5.5 s soundwave left foes unmoved and the spell was silent.
  'pf2e:DNvfKfDSs9DstDfT': design('The firearm cracks with a muzzle flash and the amplified report booms out across the emanation, rattling foes.', () => [
    cast('Gunshot crack', ['muzzle_flash.burst.01.yellow', 'muzzle_flash.single.01.yellow'], { stageId: 'bb-shot', scale: 0.6, duration: 700 }),
    motion('recoil', 'source', { after: 'bb-shot', anchor: 'start', duration: 450, intensity: 0.4 }),
    area('Thunderous report', ['soundwave.02.orangeyellow', 'soundwave.02.blue'], { stageId: 'bb-wave', after: 'bb-shot', anchor: 'start', offset: 150, duration: 2000 }),
    motion('cower', 'targets', { after: 'bb-wave', anchor: 'start', offset: 300, duration: 900, intensity: 0.45 }),
  ], { sound: 'sonic' }),

  // Bottomless Stomach: an extradimensional space in the mouth; an 8.2 s portal was far too long.
  'pf2e:F9mA2Bg27QKniIdv': design('A tiny shimmering extradimensional vortex flickers open at the target\'s mouth and closes.', () => [
    cast('Storage opens', ['magic_signs.rune.conjuration.complete.purple', 'magic_signs.rune.conjuration.complete.yellow'], { stageId: 'st-sign', scale: 0.4, duration: 1000 }),
    impact('Mouth pocket', ['portals.vertical.vortex.purple', 'portals.vertical.ring.bright_yellow'], { after: 'st-sign', anchor: 'start', offset: 500, duration: 2000, scale: 0.3, offsetY: -0.1, offsetUnits: 'token', fadeIn: 200, fadeOut: 400 }),
  ]),

  // Breathe Fire: a gout of flame from the mouth; the breath film ran 8 s.
  'pf2e:y6rAdMK6EFlV6U0t': design('A gout of flame roars out of the caster\'s mouth across the cone; creatures caught in it recoil from the heat.', () => [
    motion('lunge', 'source', { duration: 500, intensity: 0.3 }),
    area('Gout of flame', ['breath_weapons02.burst.cone.fire.orange.01'], { stageId: 'bf-cone', offset: 150, duration: 2200 }),
    motion('recoil', 'targets', { after: 'bf-cone', anchor: 'start', offset: 450, duration: 650, intensity: 0.5 }),
  ]),

  // Bridge of Graves: a span of grave dirt and tombstones; orange cracks read as lava.
  'pf2e:yXZMG66ROw3TjRRo': design('Dark grave dirt heaves up along the line into a span studded with tombstones, under a necrotic skull ward.', () => [
    area('Grave dirt span', ['ground_cracks.02.purple', 'ground_cracks.02.orange'], { stageId: 'bg-span', duration: 3200, areaLayout: 'tiles', below: true, ...tint('#5d4b3a') }),
    area('Tombstones rise', ['falling_rocks.top.1x1.grey'], { after: 'bg-span', anchor: 'start', offset: 400, duration: 2000, areaLayout: 'tiles', scale: 0.8 }),
    area('Grave ward', ['ward.skull.dark_purple.01', 'icon.skull.purple'], { after: 'bg-span', anchor: 'start', offset: 900, duration: 1800, scale: 0.35 }),
  ]),

  // Bridge of Vines: the vine film ran 8.9 s.
  'pf2e:VUUWjeapcyLZabVA': design('Vines sprout from beneath the caster and weave outward along the line into a living bridge.', () => [
    area('Vines weave a bridge', ['vine.complete.nature.group.01.green'], { stageId: 'bv-vine', duration: 3500, areaLayout: 'tiles' }),
    area('Leaves settle', ['swirling_leaves.complete.02.green'], { after: 'bv-vine', anchor: 'start', offset: 900, duration: 2000, scale: 0.5 }),
  ]),

  // Buffeting Winds: a quick wind burst in a cone; a 9 s smoke projectile and footprint missed the gust.
  'pf2e:xGFAGlonNySXrunq': design('A quick burst of wind rips through the cone and batters the creatures there back on their heels.', () => [
    area('Wind burst', ['template_cone_PF2e.001.001.white', 'template_cone_PF2e.001.001.purplered'], { stageId: 'bw-cone', duration: 1500, opacity: 0.6, ...tint('#eef6ff') }),
    area('Battering gusts', ['wind_lines.01.02.white'], { after: 'bw-cone', anchor: 'start', offset: 150, duration: 1500 }),
    motion('stagger', 'targets', { after: 'bw-cone', anchor: 'start', offset: 300, duration: 700, intensity: 0.6 }),
  ]),

  // Burning Blossoms: a towering intangible tree whose white-hot petals rain fire; 8 s films ran far too long.
  'pf2e:kWDt0JcKPgX6MvdD': design('A towering spectral tree blooms across the cylinder and white-hot petals drift down in a shower of pale flame; onlookers gaze, fascinated.', () => [
    area('Hollow tree rises', ['plant_growth.04.round.4x4.complete.greenwhite', 'plant_growth.03.round.4x4.complete.greenyellow'], { stageId: 'bb-tree', duration: 3200 }),
    area('Burning petals drift', ['swirling_leaves.complete.01.orangepink', 'swirling_leaves.complete.01.green'], { stageId: 'bb-petals', after: 'bb-tree', anchor: 'start', offset: 1000, duration: 3000, ...tint('#fff3e8') }),
    area('White-hot fire', ['flames.04.complete.orange'], { after: 'bb-petals', anchor: 'start', offset: 400, duration: 2400, opacity: 0.75, scale: 0.8, ...tint('#fff2e0') }),
    motion('drift', 'targets', { after: 'bb-petals', anchor: 'start', offset: 300, duration: 1500, intensity: 0.3 }),
  ]),

  // Burning Trail: the target's feet glow with flame; an 8 s flame ran long.
  'pf2e:T9psKCvl7TIdKysl': design('Magical flames kindle around the target\'s feet and glow there, ready to trail behind it.', () => [
    cast('Kindle', ['cast_generic.fire.01.orange'], { stageId: 'bt-cast', scale: 0.6, duration: 600 }),
    impact('Feet aflame', ['flames.04.complete.orange'], { after: 'bt-cast', anchor: 'end', duration: 2600, scale: 0.4, offsetY: 0.3, offsetUnits: 'token', fadeOut: 500 }),
  ]),

  // Bursting Bloom: a rose bush sprouts from the target's chest and wraps it in thorned vines; the growth film ran 8.9 s.
  'pf2e:vGMbpV7GWIFPNUaZ': design('A crimson rose bush bursts out of the target\'s chest in a spray of blood and wraps it in thorny vines.', () => [
    impact('Bloody burst', ['liquid.splash02.red'], { stageId: 'bb-blood', duration: 1100, scale: 0.6 }),
    impact('Rose bush erupts', ['plant_growth.02.round.2x2.complete.greenred', 'plant_growth.03.round.2x2.complete.greenyellow'], { stageId: 'bb-rose', after: 'bb-blood', anchor: 'start', offset: 250, duration: 3000, scale: 0.6, ...tint('#a3243f') }),
    impact('Thorned vines wrap', ['entangle.02.complete.02.green', 'entangle.02.complete.02.green'], { after: 'bb-rose', anchor: 'start', offset: 700, duration: 2200, scale: 0.5 }),
    motion('stagger', 'targets', { after: 'bb-blood', anchor: 'start', offset: 100, duration: 900, intensity: 0.5 }),
  ]),

  // Butterfly Bender: a ritual of blackout drinking that twists fate; a 9 s smoke plume ran long.
  'pf2e:wneYzMFUWreyqWHD': design('Woozy stars spin above the drinking party while a fate die tumbles.', () => [
    cast('Blackout', ['dizzy_stars.400px.yellow', 'dizzy_stars.400px.blueorange'], { stageId: 'bb-dizzy', duration: 3000, scale: 0.6, offsetY: -0.4, offsetUnits: 'token' }),
    cast('Fate tumbles', ['icosahedron.roll.blue'], { after: 'bb-dizzy', anchor: 'start', offset: 800, duration: 2200, scale: 0.35 }),
  ]),

  // Buzzing Bites: crawling insects bite the foe; a magic sword swing was entirely wrong.
  'pf2e:BItahht2hEHvR9Bt': design('A cloud of buzzing insects swarms over the target and bites, and it swats and squirms.', () => [
    cast('Hex', ['cast_generic.02.green', 'cast_generic.02.blue'], { stageId: 'bz-cast', scale: 0.6, duration: 550 }),
    impact('Insect swarm', ['fireflies.many.01.orange', 'fireflies.many.01.green'], { stageId: 'bz-swarm', after: 'bz-cast', anchor: 'end', duration: 2200, scale: 0.6, ...tint('#4a3b1f') }),
    impact('Tiny bites', ['bite.200px.grey', 'bite.200px.red'], { after: 'bz-swarm', anchor: 'start', offset: 500, duration: 800, scale: 0.35 }),
    motion('shake', 'targets', { after: 'bz-swarm', anchor: 'start', offset: 400, duration: 1200, intensity: 0.35 }),
  ]),

  // Buzzing Servants: bees from Axis build geometric wax shapes; purple butterflies were the wrong creature.
  'pf2e:U7415tttUO8JLvpf': design('A golden swarm of bees descends on the square and builds glowing geometric wax shapes there.', () => [
    area('Bee swarm', ['fireflies.many.01.yellow', 'fireflies.many.01.green'], { stageId: 'bs-bees', duration: 2600, scale: 0.8, ...tint('#ffcc33') }),
    area('Wax geometry', ['magic_signs.circle.02.transmutation.complete.yellow'], { after: 'bs-bees', anchor: 'start', offset: 900, duration: 2400, scale: 0.8, below: true, ...tint('#f0c048') }),
  ], { sound: 'swarm' }),

  // Calcification: bone dust invades a creature and starts turning it into a bone statue; blue motes and a skull icon ran long.
  'pf2e:L13n9NKvfGLApse1': design('A puff of bone dust engulfs the target and pale bone crusts inward over its body as it stiffens.', () => [
    impact('Bone dust', ['smoke.puff.centered.grey'], { stageId: 'ca-dust', duration: 1300, scale: 0.8, ...tint('#e8e0cc') }),
    impact('Body calcifies', ['aura_themed.01.inward.complete.metal.01.grey'], { after: 'ca-dust', anchor: 'start', offset: 500, duration: 2000, scale: 0.9, ...tint('#ece4cf') }),
    motion('press', 'targets', { after: 'ca-dust', anchor: 'start', offset: 700, duration: 1300, intensity: 0.45 }),
  ]),

  // Calcium Rain: a cloud of dancing bone shards collapses like rain; the falling film ran 6.4 s.
  'pf2e:yil09OX5uMCs3Z8v': design('A pale cloud of bone shards gathers over the burst and collapses in a piercing rain; creatures underneath cower.', () => [
    area('Shard cloud', ['fog_cloud.01.white'], { stageId: 'cr-cloud', duration: 2600, opacity: 0.6, ...tint('#e6dfcf') }),
    area('Bone rain', ['template_square.raindrops.001.7x7.instant.combined.white', 'template_square.raindrops.001.7x7.instant.combined.blue'], { stageId: 'cr-rain', after: 'cr-cloud', anchor: 'start', offset: 700, duration: 2600, ...tint('#efe8d6') }),
    impact('Shards bite', ['liquid.splash_side02.red'], { after: 'cr-rain', anchor: 'start', offset: 600, duration: 900, scale: 0.4, targetSelection: 'all' }),
    motion('cower', 'targets', { after: 'cr-rain', anchor: 'start', offset: 400, duration: 1200, intensity: 0.45 }),
  ]),

  // Call Spirit: tearing the veil to call a wispy spirit; an 8.5 s portal and 9 s smoke ran long.
  'pf2e:gsYEuWv04XTDxe91': design('The veil tears open in a pale gate and a wispy spirit form rises from it.', () => [
    cast('Veil tears', ['portals.vertical.ring.dark_blue', 'portals.vertical.ring.bright_yellow'], { stageId: 'cs-gate', duration: 3200, scale: 0.9, offsetX: 0.9, offsetUnits: 'token', fadeOut: 500 }),
    cast('Spirit answers', ['spirit_guardians.dark_whiteblue.spirits', 'spirit_guardians.blueyellow.ring'], { after: 'cs-gate', anchor: 'start', offset: 1000, duration: 2400, scale: 0.6, offsetX: 0.9, offsetUnits: 'token', opacity: 0.85 }),
  ], { sound: 'spirit' }),

  // ---- Batch 5 (Call the Ten .. Cleanse Air) ----

  // Call the Ten: masked spirits appear near each target to strike or shield; the old recipe only shielded the caster.
  'pf2e:REBo9wSxDDx7Qdcc': design('An indistinct masked warrior-spirit flares up beside each target and looses a burst of golden spirit energy at it.', () => [
    cast('Call the Ten', ['sacred_flame.source.yellow'], { stageId: 'ct-call', scale: 0.7, duration: 700 }),
    impact('Masked spirit appears', ['spirit_guardians.blueyellow.spirits', 'spirit_guardians.blueyellow.ring'], { stageId: 'ct-spirit', after: 'ct-call', anchor: 'end', duration: 1800, scale: 0.5, opacity: 0.8, offsetX: -0.4, offsetUnits: 'token', targetSelection: 'all' }),
    impact('Spirit energy', ['impact.011.yellow', 'impact.007.yellow'], { after: 'ct-spirit', anchor: 'start', offset: 700, duration: 900, scale: 0.7, targetSelection: 'all' }),
  ], { sound: 'spirit' }),

  // Camel Spit: partially digested food spat with force (acid, dazzles); purple splash read as arcane.
  'pf2e:Hycyiw9xVzoIY4Dy': design('The caster rears back and spits a brown glob that splatters across the target\'s face.', () => [
    motion('recoil', 'source', { stageId: 'cs-rear', duration: 450, intensity: 0.3 }),
    projectile('Spit glob', ['liquid.blob.brown', 'liquid.blob.blue'], { stageId: 'cs-glob', after: 'cs-rear', anchor: 'start', offset: 250, duration: 700, scale: 0.45, ...tint('#8a6a3a') }),
    impact('Splatter', ['liquid.splash.brown', 'liquid.splash.blue'], { stageId: 'cs-hit', after: 'cs-glob', anchor: 'end', duration: 1300, scale: 0.7, ...tint('#8a6a3a') }),
    aura('Acrid residue', ['fumes.04.loop.green', 'fumes.04.loop.grey'], { subject: 'targets', after: 'cs-hit', anchor: 'start', offset: 300, duration: 1100, scale: 0.9, ...tint('#9a8a4a') }),
    motion('recoil', 'targets', { after: 'cs-hit', anchor: 'start', duration: 650, intensity: 0.5 }),
  ]),

  // Carrion Mire: corpse limbs grasp from the ground to drag creatures prone; the healing chime was wrong.
  'pf2e:24JgGrYx7ixgP4kn': design('The ground opens into a mire of grey-green corpse limbs that clutch at everyone in the burst and drag them down.', () => [
    area('Mire opens', ['ground_cracks.02.dark_red', 'ground_cracks.02.orange'], { stageId: 'cm-crack', duration: 2600, below: true, ...tint('#4f4a3a') }),
    area('Corpse limbs grasp', ['black_tentacles.dark_green', 'black_tentacles.dark_purple'], { stageId: 'cm-limbs', after: 'cm-crack', anchor: 'start', offset: 300, duration: 3000, ...tint('#8a9078') }),
    motion('sink', 'targets', { after: 'cm-limbs', anchor: 'start', offset: 600, duration: 1300, intensity: 0.5 }),
  ], { sound: 'void' }),

  // Carryall: a small ghostly force platform floats behind the caster; the caster levitating was wrong.
  'pf2e:LvezN4a3kYf1OHMg': design('A small ghostly disc of force shimmers into being beside the caster, hovering just above the ground.', () => [
    cast('Force gathers', ['cast_generic.01.blue', 'cast_generic.02.blue'], { stageId: 'cy-cast', scale: 0.6, duration: 600 }),
    cast('Force platform', ['wall_of_force.horizontal.blue', 'wall_of_force.horizontal.grey'], { after: 'cy-cast', anchor: 'start', offset: 300, duration: 2600, scale: 0.3, opacity: 0.55, offsetX: -0.9, offsetUnits: 'token', fadeIn: 300, fadeOut: 500 }),
  ]),

  // Cast into Time: a wave of temporal energy sends creatures tumbling through time; they vanish until the end of the turn.
  'pf2e:OdqM06M0wDUqZWiR': design('A rippling cone of temporal energy washes out; time-motes swirl and caught creatures flicker as they are flung through time.', () => [
    area('Temporal wave', ['template_cone_PF2e.001.002.blue', 'template_cone_PF2e.001.001.purplered'], { stageId: 'ct-cone', duration: 2000, opacity: 0.85 }),
    impact('Time swirls', ['particles.swirl.blue.01.01', 'particles.swirl.greenyellow.01.01'], { after: 'ct-cone', anchor: 'start', offset: 400, duration: 1600, scale: 0.6, targetSelection: 'all', ...tint('#9fd0ff') }),
    motion('flicker', 'targets', { after: 'ct-cone', anchor: 'start', offset: 500, duration: 1100, intensity: 0.7 }),
  ]),

  // Cataclysm: five world-ending cataclysms strike at once; the old stack ran to 8 s and never hit the creatures.
  'pf2e:wLIvH0AT1u7oa64N': design('Every cataclysm lands at once across the burst: the ground splits, acid rain and freezing shards fall, lightning lashes, a tidal surge and flames roll through, and everyone inside is battered.', () => [
    area('Earthquake', ['ground_cracks.03.orange'], { stageId: 'cy-quake', duration: 3500, below: true }),
    area('Acid rain', ['template_square.raindrops.001.7x7.instant.combined.greenyellow', 'template_square.raindrops.001.7x7.instant.combined.blue'], { after: 'cy-quake', anchor: 'start', offset: 200, duration: 2600, ...tint('#93e03c') }),
    area('Freezing wind', ['ice_spikes.radial.burst.white'], { after: 'cy-quake', anchor: 'start', offset: 600, duration: 2400 }),
    area('Lightning lashes', ['lightning_strike.blue'], { after: 'cy-quake', anchor: 'start', offset: 900, duration: 1800 }),
    area('Tsunami', ['water_splash.circle.01.blue'], { after: 'cy-quake', anchor: 'start', offset: 1200, duration: 2400 }),
    area('Firestorm', ['flames.04.complete.orange'], { after: 'cy-quake', anchor: 'start', offset: 1500, duration: 2600, opacity: 0.85 }),
    motion('shake', 'targets', { after: 'cy-quake', anchor: 'start', offset: 300, duration: 2600, intensity: 0.7 }),
  ]),

  // Caustic Blast: a glob of acid is flung and immediately detonates; there was no glob.
  'pf2e:thAHF1zxNplLCJPO': design('A large acid glob is flung, bursts on landing and sprays caustic acid across the burst.', () => [
    cast('Acid gathers', ['cast_generic.02.green', 'cast_generic.02.blue'], { stageId: 'cb-cast', scale: 0.7, duration: 500 }),
    projectile('Acid glob', ['liquid.blob.green', 'liquid.blob.blue'], { stageId: 'cb-glob', after: 'cb-cast', anchor: 'end', duration: 800, scale: 0.55 }),
    area('Glob detonates', ['liquid.splash.green', 'liquid.splash.blue'], { stageId: 'cb-burst', after: 'cb-glob', anchor: 'end', duration: 1600 }),
    area('Fumes linger', ['fumes.04.complete.green', 'fumes.04.complete.grey'], { after: 'cb-burst', anchor: 'start', offset: 600, duration: 1400, opacity: 0.6 }),
    motion('recoil', 'targets', { after: 'cb-burst', anchor: 'start', offset: 150, duration: 650, intensity: 0.5 }),
  ]),

  // Channel Arrogance: flooding a creature with the caster's majesty; a divination scan was the wrong idea.
  'pf2e:CVvkveEH7lonSTZd': design('The caster blazes with imperious violet majesty that floods into the target, leaving it stunned and staring.', () => [
    cast('Majestic presence', ['markers.light.complete.purple', 'markers.light.complete.blue'], { stageId: 'ca-glow', duration: 1300, scale: 1.1, below: true }),
    motion('pulse', 'source', { after: 'ca-glow', anchor: 'start', duration: 800, intensity: 0.6 }),
    travel('Ego floods out', ['energy_strands.range.standard.purple.02', 'energy_strands.range.standard.purple.02'], { stageId: 'ca-flood', after: 'ca-glow', anchor: 'start', offset: 500, duration: 1300, scale: 0.6 }),
    impact('Overawed', ['markers.stun.purple.01', 'icon.stun.purple'], { after: 'ca-flood', anchor: 'start', offset: 700, duration: 1600, scale: 0.45 }),
    motion('shake', 'targets', { after: 'ca-flood', anchor: 'start', offset: 700, duration: 750, intensity: 0.4 }),
  ]),

  // Chroma Leach: a hand glowing with impossible colours saps colour and vitality by touch; nothing moved.
  'pf2e:4y2DMq9DV5HvmnxC': design('A hand blazing with impossible colours touches the target; the colours drain out of it in strands and it sags, listless.', () => [
    cast('Impossible colours', ['impact.013.001.pinkyellow', 'impact.013.001.orangeyellow'], { stageId: 'cl-hand', scale: 0.5, duration: 800 }),
    motion('lunge', 'source', { after: 'cl-hand', anchor: 'start', offset: 300, duration: 550, intensity: 0.4 }),
    impact('Colour drains', ['energy_strands.in.purple.01', 'energy_strands.in.green.01'], { stageId: 'cl-drain', after: 'cl-hand', anchor: 'end', duration: 1700, scale: 0.85, ...tint('#c0a8ff') }),
    impact('Greyed out', ['smoke.puff.centered.grey'], { after: 'cl-drain', anchor: 'start', offset: 700, duration: 1300, scale: 0.7 }),
    motion('stagger', 'targets', { after: 'cl-drain', anchor: 'start', offset: 300, duration: 900, intensity: 0.4 }),
  ]),

  // Chromatic Armor: armor of sheets of coloured light; a plain yellow force shield missed the colours.
  'pf2e:NBSBFHxBm88qxQUy': design('Shifting sheets of rainbow light wrap the target as shimmering armor and shed bright light.', () => [
    cast('Colours gather', ['dancing_light.pink', 'dancing_light.yellow'], { stageId: 'ch-cast', scale: 0.7, duration: 600 }),
    impact('Rainbow armor', ['markers.bubble.complete.rainbow', 'markers.bubble.complete.blue'], { after: 'ch-cast', anchor: 'end', duration: 2400, scale: 0.9 }),
    impact('Bright light', ['markers.light.complete.yellow', 'markers.light.complete.blue'], { after: 'ch-cast', anchor: 'end', offset: 300, duration: 2000, scale: 1.2, opacity: 0.5, below: true }),
  ]),

  // Chromatic Ray: a ray of coloured light; a plain yellow beam ignored the rainbow.
  'pf2e:Hb8GdAhP0zBCv3zU': design('A ray of streaming rainbow light lances into the target and bursts in shifting colours.', () => [
    cast('Focus colours', ['dancing_light.pink', 'dancing_light.yellow'], { stageId: 'cr-cast', scale: 0.7, duration: 550 }),
    travel('Chromatic ray', ['scorching_ray.01.rainbow01', 'scorching_ray.01.orange'], { stageId: 'cr-ray', after: 'cr-cast', anchor: 'end', duration: 1500, scale: 0.8 }),
    impact('Colours burst', ['impact.013.002.pinkyellow', 'impact.013.002.orangeyellow'], { after: 'cr-ray', anchor: 'start', offset: 600, duration: 1000, scale: 0.8 }),
    motion('recoil', 'targets', { after: 'cr-ray', anchor: 'start', offset: 650, duration: 650, intensity: 0.5 }),
  ]),

  // Chthonian Wrath: the energy of an Outer Rifts realm blasts through a 60-ft cone; blue strands and a footprint were faint.
  'pf2e:crF4g9jRN1y84MSD': design('A roaring cone of abyssal energy and debris tears out of the Outer Rifts and pummels everything in it.', () => [
    cast('Rift tears', ['portals.horizontal.vortex.red', 'portals.horizontal.ring.bright_yellow'], { stageId: 'cw-rift', scale: 0.6, duration: 900 }),
    area('Abyssal blast', ['breath_weapons02.burst.cone.arcana.purple.01', 'breath_weapons.fire.cone.orange.01'], { stageId: 'cw-cone', after: 'cw-rift', anchor: 'start', offset: 500, duration: 2400, ...tint('#b04a6a') }),
    motion('recoil', 'targets', { after: 'cw-cone', anchor: 'start', offset: 500, duration: 700, intensity: 0.6 }),
  ]),

  // Cinder Gaze: reading the future in flames and smoke; 8-9 s films ran long.
  'pf2e:mOUwbIN1SUp8FyPR': design('A small fire flickers before the caster, smoke curls up in patterns and a seeing eye opens in it.', () => [
    cast('Flames read', ['campfire.03.01.complete.orange', 'campfire.01.orange'], { stageId: 'cg-fire', duration: 3000, scale: 0.45, offsetX: 0.6, offsetUnits: 'token', fadeOut: 500 }),
    cast('Smoke patterns', ['smoke.plumes.01.grey'], { after: 'cg-fire', anchor: 'start', offset: 600, duration: 2400, scale: 0.5, offsetX: 0.6, offsetY: -0.3, offsetUnits: 'token', opacity: 0.7 }),
    cast('Future glimpsed', ['eyes.01.orangeyellow.single', 'eyes.01.dark_green.single'], { after: 'cg-fire', anchor: 'start', offset: 1300, duration: 1600, scale: 0.4 }),
  ]),

  // Cinder Scribe: a quill of flame writes a vanishing message; an 8 s flame ran long.
  'pf2e:I17urWNQYVTYTM1z': design('A small quill of flame scrawls glowing runes onto the object that fade almost at once.', () => [
    impact('Flame quill', ['flames.01.orange'], { stageId: 'cs-quill', duration: 1600, scale: 0.3 }),
    impact('Inscription fades', ['markers.runes.orange.01', 'icon.runes.orange'], { after: 'cs-quill', anchor: 'start', offset: 600, duration: 1800, scale: 0.4, fadeOut: 800 }),
  ]),

  // Cinder Swarm: a mass of fiery insects swarms the target in a 5-ft aura; orange butterflies ran 6 s.
  'pf2e:bVvGpSOg2WaTUItS': design('A mass of glowing fiery insects pours from the caster\'s hands and swarms the target in a crackling cloud.', () => [
    cast('Embers quicken', ['cast_generic.fire.01.orange'], { stageId: 'cn-cast', scale: 0.8, duration: 700 }),
    impact('Fiery swarm', ['fireflies.many.01.orange', 'fireflies.many.01.green'], { stageId: 'cn-swarm', after: 'cn-cast', anchor: 'end', duration: 2800, scale: 1.1, ...tint('#ff8a3a') }),
    impact('Ember sparks', ['particles.outward.orange.02.02', 'particles.outward.greenyellow.02.02'], { after: 'cn-swarm', anchor: 'start', offset: 400, duration: 1600, scale: 0.9 }),
    motion('shake', 'targets', { after: 'cn-swarm', anchor: 'start', offset: 400, duration: 900, intensity: 0.4 }),
  ]),

  // Claws of the Otter: webbed fingers and cold claws; spider webs and a snowflake icon misread it.
  'pf2e:yNTfght6fu9WYKmx': design('The caster\'s nails lengthen into icy blue claws as a chill ripples over the hands.', () => [
    cast('Chill ripples', ['aura_themed.01.inward.complete.cold.01.blue'], { stageId: 'co-chill', scale: 0.8, duration: 1300 }),
    cast('Otter claws', ['claws.200px.bright_blue', 'claws.200px.red'], { after: 'co-chill', anchor: 'start', offset: 600, duration: 1000, scale: 0.7, ...tint('#9fdcff') }),
    motion('pulse', 'source', { after: 'co-chill', anchor: 'start', offset: 600, duration: 700, intensity: 0.5 }),
  ]),

  // Cleanse Affliction: restorative magic pushes back a toxin or malady; an 8 s purple gas cloud read as poisoning.
  'pf2e:SUKaxVZW2TlM8lu0': design('Gentle restorative light washes over the target and a sickly haze lifts away from it.', () => [
    cast('Restorative sign', ['magic_signs.rune.abjuration.complete.green', 'magic_signs.rune.abjuration.complete.blue'], { stageId: 'ca-sign', scale: 0.45, duration: 1000 }),
    impact('Restorative light', ['healing_generic.200px.green'], { stageId: 'ca-heal', after: 'ca-sign', anchor: 'start', offset: 500, duration: 1600, scale: 0.8 }),
    impact('Affliction lifts', ['smoke.puff.side.green', 'smoke.puff.side.grey'], { after: 'ca-heal', anchor: 'start', offset: 400, duration: 1300, scale: 0.6, rotation: -90 }),
  ]),

  // ---- Batch 6 (Cleanse Cuisine .. Control Sand) ----

  // Cleanse Cuisine: food and drink become gourmet fare; an 8 s purple blob looked like slime.
  'pf2e:qXTB7Ec9yYh5JPPV': design('A golden transmutation sign turns over the food and it sparkles into a gourmet treat.', () => [
    impact('Transmute fare', ['magic_signs.rune.transmutation.complete.yellow'], { stageId: 'cc-sign', duration: 1500, scale: 0.4 }),
    impact('Gourmet sparkle', ['swirling_sparkles.01.yellow', 'swirling_sparkles.01.blue'], { after: 'cc-sign', anchor: 'start', offset: 600, duration: 1800, scale: 0.6 }),
  ]),

  // Clinging Ice: sleet and snow collect on the feet and legs; a 6.6 s sleet storm on the whole token ran long.
  'pf2e:MraZBLJ4Be3ogmWL': design('Freezing sleet swirls down and ice crusts around the target\'s feet as it struggles to move.', () => [
    impact('Sleet falls', ['sleet_storm.01.blue', 'sleet_storm.01.blue'], { stageId: 'ci-sleet', duration: 2000, scale: 0.5 }),
    impact('Ice clings to legs', ['ice_spikes.radial.burst.blue', 'ice_spikes.radial.burst.white'], { after: 'ci-sleet', anchor: 'start', offset: 600, duration: 1600, scale: 0.5, offsetY: 0.25, offsetUnits: 'token', below: true }),
    motion('shake', 'targets', { after: 'ci-sleet', anchor: 'start', offset: 700, duration: 900, intensity: 0.35 }),
  ]),

  // Cloak of Colors: a cloak of swirling colours that dazzles; orange-purple sparkles alone were muted.
  'pf2e:TCk2MDwf5L5OYjFC': design('A cloak of swirling rainbow colours wraps the target and flashes brilliantly.', () => [
    impact('Swirling colours', ['markers.bubble.complete.rainbow', 'markers.bubble.complete.blue'], { stageId: 'cc-cloak', duration: 2400, scale: 0.9 }),
    impact('Brilliant flash', ['impact.013.001.pinkyellow', 'impact.013.001.orangeyellow'], { after: 'cc-cloak', anchor: 'start', offset: 600, duration: 900, scale: 0.7 }),
  ]),

  // Cloak of Light: holy light that heals the living and burns undead; green nature-healing read as druidic.
  'pf2e:ba1RyDpwq6tfW8VM': design('The caster is wrapped in radiant golden light that blooms outward in a warm, healing glow.', () => [
    cast('Holy light kindles', ['divine_smite.caster.standard.yellowwhite', 'divine_smite.caster.blueyellow'], { stageId: 'cl-smite', scale: 0.9, duration: 1400 }),
    cast('Restoring radiance', ['healing_generic.burst.yellowwhite', 'healing_generic.burst.greenorange'], { after: 'cl-smite', anchor: 'start', offset: 600, duration: 1600, scale: 1 }),
    aura('Bright glow', ['markers.light.complete.yellow', 'markers.light.complete.blue'], { after: 'cl-smite', anchor: 'start', offset: 800, duration: 2200, scale: 1.4, opacity: 0.6, below: true }),
    motion('pulse', 'source', { after: 'cl-smite', anchor: 'start', offset: 600, duration: 900, intensity: 0.45 }),
  ]),

  // Clockwork Devotion: cogs summon a halberd-wielding clockwork battalion that slashes nearby enemies.
  'pf2e:zEAblSSbfu1246JL': design('A handful of cogs scatters, a whirl of clockwork gears forms the battalion and halberds slash at the enemies around it.', () => [
    cast('Cogs tossed', ['aura_themed.01.outward.complete.metal.01.grey'], { stageId: 'cd-cogs', scale: 0.7, duration: 1000 }),
    area('Clockwork battalion', ['aura_themed.01.orbit.complete.metal.01.grey'], { stageId: 'cd-army', after: 'cd-cogs', anchor: 'start', offset: 500, duration: 2600, opacity: 0.9 }),
    impact('Halberds slash', ['halberd.melee.01.white'], { after: 'cd-army', anchor: 'start', offset: 900, duration: 1200, scale: 0.7, targetSelection: 'all' }),
    motion('stagger', 'targets', { after: 'cd-army', anchor: 'start', offset: 1300, duration: 700, intensity: 0.5 }),
  ], { sound: 'metal' }),

  // Cloud Current: a great white cloud with a powerful current; green fog read as toxic.
  'pf2e:s7kVnr0EdljCamuR': design('White vapour billows into a great cloud and a strong wind current streams through it.', () => [
    cast('Vapour gathers', ['fog_cloud.01.white'], { stageId: 'cu-fog', duration: 3000, scale: 1, opacity: 0.85 }),
    cast('Current flows', ['wind_stream.white'], { after: 'cu-fog', anchor: 'start', offset: 600, duration: 2200, scale: 0.8 }),
  ], { sound: 'wind' }),

  // Clownish Curse: ridiculous noises and clumsy oversized hands and feet.
  'pf2e:S7ylpCJyq0CYkux9': design('A comical curse plops onto the target: silly notes honk off it as it wobbles awkwardly.', () => [
    impact('Curse settles', ['condition.curse.01.002.purple', 'condition.curse.01.002.red'], { stageId: 'cl-curse', duration: 1800, scale: 0.6 }),
    impact('Ridiculous noises', ['impact_themed.music_note.pink', 'music_notations.quaver.blue'], { after: 'cl-curse', anchor: 'start', offset: 500, duration: 1200, scale: 0.5 }),
    motion('shake', 'targets', { after: 'cl-curse', anchor: 'start', offset: 500, duration: 1000, intensity: 0.4 }),
  ]),

  // Collective Transposition: teleports targets to new positions; only area signs played and nobody moved.
  'pf2e:c3XygMbzrZMgV1y3': design('A conjuration sign marks the area and each chosen creature blinks out in a flash of teleportation.', () => [
    cast('Transposition sign', ['magic_signs.rune.conjuration.complete.purple', 'magic_signs.rune.conjuration.complete.yellow'], { stageId: 'ct-sign', scale: 0.6, duration: 1100 }),
    impact('Teleport flash', ['teleport.01.blue'], { stageId: 'ct-tp', after: 'ct-sign', anchor: 'start', offset: 600, duration: 1500, scale: 0.8, targetSelection: 'all' }),
    motion('flicker', 'targets', { after: 'ct-tp', anchor: 'start', offset: 200, duration: 900, intensity: 0.8 }),
  ], { sound: 'teleport' }),

  // Combustion: a creature ignites in lasting flames; 8-9 s films ran long and nothing reacted.
  'pf2e:Z3kJty995FkrsZRb': design('The target bursts into roaring flames that cling to it, trailing smoke, and it reels.', () => [
    impact('Ignition', ['impact.fire.01.orange'], { stageId: 'co-ign', duration: 900, scale: 0.8 }),
    impact('Clinging flames', ['flames.04.complete.orange'], { stageId: 'co-flame', after: 'co-ign', anchor: 'start', offset: 250, duration: 3000, scale: 0.9, fadeOut: 500 }),
    impact('Burning smoke', ['smoke.plumes.01.grey'], { after: 'co-flame', anchor: 'start', offset: 900, duration: 2000, scale: 0.6, opacity: 0.7 }),
    motion('stagger', 'targets', { after: 'co-ign', anchor: 'start', offset: 150, duration: 900, intensity: 0.5 }),
  ]),

  // Cone of Cold: icy cold rushes out in a 60-ft cone; nothing in the cone reacted.
  'pf2e:3puDanGfpEt6jK5k': design('Icy cold rushes out of the caster\'s hands through the whole cone; frost bursts on every creature caught and they shudder.', () => [
    cast('Cold gathers', ['cast_generic.ice.01.blue', 'cast_generic.02.blue'], { stageId: 'cc-cast', scale: 0.7, duration: 600 }),
    area('Cone of cold', ['cone_of_cold.blue'], { stageId: 'cc-cone', after: 'cc-cast', anchor: 'end', offset: -150, duration: 3000 }),
    impact('Frost bursts', ['impact.frost.white.01'], { after: 'cc-cone', anchor: 'start', offset: 900, duration: 1200, scale: 0.7, targetSelection: 'all' }),
    motion('shake', 'targets', { after: 'cc-cone', anchor: 'start', offset: 900, duration: 1000, intensity: 0.5 }),
  ]),

  // Confetti Cloud: a dense storm of swirling confetti with party sounds; blue particles weren't confetti.
  'pf2e:CI7F5qdwp6YngyFt': design('A festive storm of multicoloured confetti bursts and swirls through the burst while party noise crackles.', () => [
    area('Confetti burst', ['firework.02.bluepink.03', 'firework.02.orangeyellow.01'], { stageId: 'cf-pop', duration: 1600, scale: 0.6 }),
    area('Swirling confetti', ['particles.002.001.complete.many.pinkyellow', 'particles.002.001.complete.many.blue'], { after: 'cf-pop', anchor: 'start', offset: 300, duration: 3000 }),
    area('Party noise', ['impact_themed.music_note.pink', 'music_notations.beamed_quavers.blue'], { after: 'cf-pop', anchor: 'start', offset: 700, duration: 1600, scale: 0.4 }),
  ], { sound: 'applause' }),

  // Confront Selves: the target confronts an alternate self amid swirling shards of their life.
  'pf2e:VGK9s6LCMMS027zP': design('A ghostly alternate self flickers beside the target while shards of its life swirl and shatter around it.', () => [
    sprite('Alternate self', { stageId: 'cs-self', subject: 'targets', duration: 1800, opacity: 0.4, offsetX: 0.4, offsetUnits: 'token' }),
    impact('Life shards', ['shatter.purple', 'shatter.blue'], { after: 'cs-self', anchor: 'start', offset: 500, duration: 1400, scale: 0.7 }),
    motion('shake', 'targets', { after: 'cs-self', anchor: 'start', offset: 600, duration: 800, intensity: 0.4 }),
  ]),

  // Confusing Colors: a cloud of cascading, ever-changing colours; purple particles were monotone.
  'pf2e:uEyfLoFQsRKBRIcB': design('A cloud of cascading rainbow colours blooms over the burst and those inside reel, dazzled and confused.', () => [
    area('Cascading colours', ['particles.002.001.complete.many.pinkyellow', 'particles.002.001.complete.many.blue'], { stageId: 'cc-cloud', duration: 3000 }),
    area('Colour flare', ['impact.013.003.bluepurple', 'impact.013.003.orangeyellow'], { after: 'cc-cloud', anchor: 'start', offset: 300, duration: 1500, scale: 0.9 }),
    area('Shifting hues', ['swirling_sparkles.01.bluepink', 'swirling_sparkles.01.blue'], { after: 'cc-cloud', anchor: 'start', offset: 600, duration: 2200 }),
    motion('shake', 'targets', { after: 'cc-cloud', anchor: 'start', offset: 700, duration: 1000, intensity: 0.4 }),
  ]),

  // Conjured Clockwork: a complex clockwork device spreads across the ground slicing anything inside.
  'pf2e:eob29LrDMH2IoeAj': design('Interlocking clockwork gears spread across the burst and their blades slice at creatures inside.', () => [
    area('Clockwork spreads', ['aura_themed.01.orbit.complete.metal.01.grey'], { stageId: 'cw-gears', duration: 3200, below: true }),
    area('Gear-teeth turn', ['aura_themed.01.outward.complete.metal.01.grey'], { after: 'cw-gears', anchor: 'start', offset: 500, duration: 2200, opacity: 0.8 }),
    impact('Blades slice', ['melee_generic.slash.01.orange', 'melee_generic.slash.01.orange'], { after: 'cw-gears', anchor: 'start', offset: 1000, duration: 800, scale: 0.6, targetSelection: 'all', ...tint('#c9cfd6') }),
    motion('stagger', 'targets', { after: 'cw-gears', anchor: 'start', offset: 1050, duration: 650, intensity: 0.4 }),
  ]),

  // Conjured Conveyance: a wooden vehicle conjured from plant matter; a 7.9 s growth film ran long.
  'pf2e:FQd6Jc3CU6wiS2U7': design('Wood and greenery spiral together and grow into an intricately carved vehicle.', () => [
    area('Wood grows', ['plant_growth.03.square.2x2.complete.greenyellow'], { stageId: 'cv-wood', duration: 3200 }),
    area('Leaves settle', ['swirling_leaves.complete.02.green'], { after: 'cv-wood', anchor: 'start', offset: 700, duration: 2000, scale: 0.8 }),
  ]),

  // Conquering Soldiers: glimmering ghostly army arrives with a victory battle cry (fear).
  'pf2e:ion3VOiLan6ga3QC': design('A glimmering spectral army of old manifests with a roaring battle cry that rolls over the enemies, who quail.', () => [
    area('Spectral army', ['spirit_guardians.blueyellow.spirits', 'spirit_guardians.blueyellow.ring'], { stageId: 'cs-army', duration: 3000, opacity: 0.85 }),
    area('Battle cry', ['soundwave.02.orangeyellow', 'soundwave.02.blue'], { after: 'cs-army', anchor: 'start', offset: 700, duration: 1800 }),
    motion('cower', 'targets', { after: 'cs-army', anchor: 'start', offset: 900, duration: 1000, intensity: 0.5 }),
  ], { sound: 'battleCry' }),

  // Consuming Darkness: a gateway of clinging shadow that partially swallows enemies.
  'pf2e:HMTloW1hvRFJ5Z2D': design('The caster\'s shadow spreads into a swirling black gateway and enemies inside sink into the clinging dark.', () => [
    area('Shadow gateway', ['template_circle.vortex.intro.dark_black', 'template_circle.vortex.intro.blue'], { stageId: 'cd-vortex', duration: 2600, below: true }),
    area('Clinging darkness', ['darkness.black'], { after: 'cd-vortex', anchor: 'start', offset: 300, duration: 2600, opacity: 0.75 }),
    motion('sink', 'targets', { after: 'cd-vortex', anchor: 'start', offset: 700, duration: 1200, intensity: 0.5 }),
  ]),

  // Control Sand: a small sandstorm whips around the caster; outward orange particles were faint.
  'pf2e:oahqARSgOGDRybBQ': design('A small sandstorm whips up and swirls around the caster.', () => [
    area('Sandstorm', ['whirlwind.bluegrey', 'whirlwind.bluegrey'], { stageId: 'cs-storm', duration: 2800, opacity: 0.8, ...tint('#cba66a') }),
    area('Sand grains', ['particles.outward.orange.02.05', 'particles.outward.greenyellow.02.05'], { after: 'cs-storm', anchor: 'start', offset: 300, duration: 2200, ...tint('#d8b878') }),
  ], { sound: 'wind' }),

  // ---- Batch 7 (Control Water .. Dancing Shield) ----

  // Control Water: raising or lowering water across a 50-ft square; an 8.5 s blob ran long.
  'pf2e:zfn5RqAdF63neqpP': design('Water across the whole square surges and heaves as its level rises or falls at the caster\'s will.', () => [
    cast('Will imposed', ['cast_generic.water.02.blue'], { stageId: 'cw-cast', scale: 0.8, duration: 800 }),
    area('Water heaves', ['water_splash.circle.01.blue'], { stageId: 'cw-heave', after: 'cw-cast', anchor: 'start', offset: 400, duration: 2400 }),
    area('Surface ripples', ['liquid.splash.blue'], { after: 'cw-heave', anchor: 'start', offset: 700, duration: 2200, opacity: 0.7 }),
  ]),

  // Coral Scourge: barnacles and coral grow over the body and stiffen the joints; a spike-trap film and a blood drop ran 6.4 s.
  'pf2e:ZIk1EYbG6l4JuUkO': design('Rough coral and barnacles crust inward over the target and it stiffens.', () => [
    cast('Sea magic', ['cast_generic.water.02.blue'], { stageId: 'cs-cast', scale: 0.6, duration: 600 }),
    impact('Coral crusts over', ['aura_themed.01.inward.complete.wood.01.red', 'aura_themed.01.inward.complete.wood.01.green'], { stageId: 'cs-coral', after: 'cs-cast', anchor: 'end', duration: 2000, scale: 0.9, ...tint('#e39a8c') }),
    impact('Brine drips', ['liquid.splash_side.blue'], { after: 'cs-coral', anchor: 'start', offset: 500, duration: 1000, scale: 0.4 }),
    motion('press', 'targets', { after: 'cs-coral', anchor: 'start', offset: 600, duration: 1200, intensity: 0.4 }),
  ]),

  // Cordyceps Command: a mote of tailored spores whisked at the target; a 7.8 s gas cloud overshot it.
  'pf2e:ADwX87fWrpB8cQ5Q': design('A tiny mote of cordyceps spores is whisked at the target and bursts into a fungal haze that it breathes in.', () => [
    cast('Spores gather', ['particles.inward.greenyellow.01.02'], { stageId: 'cc-gather', scale: 0.5, duration: 800 }),
    projectile('Spore mote', ['particles.swirl.greenyellow.01.01'], { stageId: 'cc-mote', after: 'cc-gather', anchor: 'end', duration: 900, scale: 0.35 }),
    impact('Fungal haze', ['smoke.puff.centered.green', 'smoke.puff.centered.grey'], { after: 'cc-mote', anchor: 'end', duration: 1500, scale: 0.7, ...tint('#b9b56a') }),
    motion('shake', 'targets', { after: 'cc-mote', anchor: 'end', offset: 200, duration: 800, intensity: 0.35 }),
  ]),

  // Corrosive Muck: two puddles of acidic slime; an 8 s grease loop ran long.
  'pf2e:BlfOg9Ceymgjstjm': design('Puddles of bubbling green slime spread across the burst, giving off acrid vapour.', () => [
    area('Acidic slime', ['grease.dark_green.loop', 'grease.dark_brown.loop'], { stageId: 'cm-slime', duration: 3500, fadeIn: 300, fadeOut: 600, ...tint('#8fa863') }),
    area('Slime bubbles', ['bubble.001.002.complete.green', 'bubble.001.002.complete.blue'], { after: 'cm-slime', anchor: 'start', offset: 600, duration: 2200, scale: 0.5, ...tint('#a8d05a') }),
    area('Acrid vapour', ['smoke.plumes.01.grey'], { after: 'cm-slime', anchor: 'start', offset: 800, duration: 2400, scale: 0.6, opacity: 0.6, ...tint('#b3bb80') }),
  ]),

  // Cozy Cabin: a simple wooden cabin with a fireplace; a 7.9 s growth film and a green fire missed it.
  'pf2e:mwPfoYfVGSMAaUec': design('Timber grows and knits into a snug wooden cabin, and a warm hearth fire kindles inside.', () => [
    area('Timber grows', ['plant_growth.03.square.4x4.complete.greenyellow'], { stageId: 'cb-wood', duration: 3500, ...tint('#a37b4f') }),
    area('Hearth kindles', ['campfire.03.01.complete.orange', 'campfire.01.orange'], { after: 'cb-wood', anchor: 'start', offset: 1200, duration: 2400, scale: 0.25 }),
  ]),

  // Crashing Wave: a wave sweeps through the cone; struck creatures did not react.
  'pf2e:T4QKmtYPeCgYxVGe': design('A crashing wave sweeps out through the cone and knocks back everything it hits.', () => [
    cast('Water rises', ['cast_generic.water.02.blue'], { stageId: 'cw-cast', scale: 0.7, duration: 600 }),
    area('Crashing wave', ['water_splash.cone.01.blue'], { stageId: 'cw-wave', after: 'cw-cast', anchor: 'end', offset: -150, duration: 2600 }),
    motion('stagger', 'targets', { after: 'cw-wave', anchor: 'start', offset: 500, duration: 800, intensity: 0.6 }),
  ]),

  // Create Demiplane: a world-creating ritual; four 8.5 s portals ran far over.
  'pf2e:ZwwIUavMbEwcZz35': design('A great rune-etched icosahedron turns above the caster and a portal to the new demiplane opens.', () => [
    cast('World design', ['icosahedron.rune.above.blueyellow'], { stageId: 'cd-ico', scale: 1, duration: 3200 }),
    cast('Demiplane gate', ['portals.vertical.ring.purple', 'portals.vertical.ring.bright_yellow'], { after: 'cd-ico', anchor: 'start', offset: 1200, duration: 3200, scale: 1, offsetX: 1, offsetUnits: 'token', fadeOut: 600 }),
  ]),

  // Create Earthen Facsimile: soil morphs into a small figurine; a 6.5 s rockfall ran long.
  'pf2e:AI5B9jzdB1g1Lf8A': design('A clump of soil churns in the caster\'s hand and hardens into a small earthen figurine.', () => [
    cast('Soil morphs', ['cast_generic.earth.01.browngreen'], { stageId: 'ef-earth', scale: 0.5, duration: 1200 }),
    cast('Figure hardens', ['particles.inward.white.01.02', 'particles.inward.greenyellow.01.02'], { after: 'ef-earth', anchor: 'start', offset: 500, duration: 1500, scale: 0.4, ...tint('#9e8265') }),
  ]),

  // Create Mycoguardian: a ritual turning a creature into a fungus creature; a 9 s smoke plume ran long.
  'pf2e:6nPc5CPRUbSSRDP1': design('A transmutation circle glows as a fog of pale fungal spores swirls in and settles.', () => [
    cast('Transmutation circle', ['magic_signs.circle.02.transmutation.complete.green', 'magic_signs.circle.02.transmutation.complete.yellow'], { stageId: 'cm-circle', scale: 0.9, duration: 3200, below: true }),
    cast('Spores swirl', ['particles.swirl.greenyellow.02.01'], { after: 'cm-circle', anchor: 'start', offset: 700, duration: 2400, scale: 0.9, ...tint('#cfc79a') }),
  ]),

  // Create Thrall: conjures undead thralls; smoke and a 6.6 s skull icon read thin.
  'pf2e:1JaRoJvlf8EPvnnD': design('Necrotic green smoke and a grinning skull rise at each chosen square as thralls claw into being.', () => [
    area('Necrotic mist', ['toll_the_dead.green.skull_smoke'], { stageId: 'ct-skull', duration: 2200, scale: 0.6 }),
    area('Undead rise', ['smoke.puff.centered.dark_green', 'smoke.puff.centered.grey'], { after: 'ct-skull', anchor: 'start', offset: 600, duration: 1500, scale: 0.8 }),
  ], { sound: 'void' }),

  // Create Water: water flows from cupped hands; an 8.4 s blob ran long.
  'pf2e:WzLKjSw6hsBhuklC': design('Clear water wells up and spills from the caster\'s cupped hands.', () => [
    cast('Water wells', ['cast_generic.water.02.blue'], { stageId: 'cw-cast', scale: 0.5, duration: 800 }),
    cast('Water spills', ['liquid.splash.blue'], { after: 'cw-cast', anchor: 'start', offset: 400, duration: 1600, scale: 0.4 }),
  ]),

  // Creative Splash: a deluge of paint or colourful illusions in a burst; purple light read as arcane.
  'pf2e:xTpp8dHZsNMDm75B': design('A deluge of bright paint splashes down across the burst in vivid colours.', () => [
    area('Paint deluge', ['liquid.splash02.blue', 'liquid.splash02.red'], { stageId: 'cs-paint', duration: 1600 }),
    area('Second colour', ['liquid.splash02.red'], { after: 'cs-paint', anchor: 'start', offset: 250, duration: 1500, scale: 0.8 }),
    area('Vivid flare', ['impact.013.003.pinkyellow', 'impact.013.003.orangeyellow'], { after: 'cs-paint', anchor: 'start', offset: 450, duration: 1300 }),
    motion('shake', 'targets', { after: 'cs-paint', anchor: 'start', offset: 450, duration: 650, intensity: 0.35 }),
  ]),

  // Crimson Breath: a blast of crimson mist exhaled at the target; green poison fog for 7.8 s was the wrong colour.
  'pf2e:ExQk8AwDphmckEmZ': design('The caster exhales a blast of crimson mist that engulfs the target, which chokes and staggers.', () => [
    motion('lunge', 'source', { stageId: 'cb-breath', duration: 550, intensity: 0.35 }),
    travel('Crimson mist', ['breath_weapons.poison.cone.dark_red', 'breath_weapons.poison.cone.green'], { stageId: 'cb-mist', after: 'cb-breath', anchor: 'start', offset: 200, duration: 1500, scale: 0.6, ...tint('#b0203a') }),
    impact('Toxic miasma', ['fumes.04.complete.purple', 'fumes.04.complete.grey'], { stageId: 'cb-fog', after: 'cb-mist', anchor: 'start', offset: 700, duration: 1800, scale: 0.8, ...tint('#a3243f') }),
    motion('stagger', 'targets', { after: 'cb-fog', anchor: 'start', offset: 200, duration: 900, intensity: 0.45 }),
  ]),

  // Crucible of Iron: molten iron pours over the target and encases it.
  'pf2e:i5h9VQ1T6MLInINM': design('A spout of molten iron pours down on the target, then cools into a grey metal shell around it.', () => [
    impact('Molten iron pours', ['lava_spout.001.001.complete.orangeyellow'], { stageId: 'ci-pour', duration: 1800, scale: 0.5 }),
    impact('Iron encases', ['aura_themed.01.inward.complete.metal.01.grey'], { after: 'ci-pour', anchor: 'start', offset: 900, duration: 1800, scale: 0.9 }),
    motion('press', 'targets', { after: 'ci-pour', anchor: 'start', offset: 500, duration: 1300, intensity: 0.5 }),
  ]),

  // Cry of Destruction: a booming voice smashes what's in front of the caster; drifting soundwave projectiles ran 4.5 s.
  'pf2e:0H1ozccQGGFLUwFI': design('The caster\'s voice booms out as a cone of shattering sound that rocks every creature in front of them.', () => [
    cast('Voice booms', ['cast_generic.sound.01.pinkteal'], { stageId: 'cd-voice', scale: 0.7, duration: 600 }),
    area('Destructive cry', ['template_cone_PF2e.001.002.blueteal', 'template_cone_PF2e.001.001.purplered'], { stageId: 'cd-cone', after: 'cd-voice', anchor: 'start', offset: 250, duration: 1600 }),
    impact('Sonic shatter', ['impact.sound.01.pinkteal', 'shatter.blue'], { after: 'cd-cone', anchor: 'start', offset: 350, duration: 900, scale: 0.6, targetSelection: 'all' }),
    motion('recoil', 'targets', { after: 'cd-cone', anchor: 'start', offset: 350, duration: 650, intensity: 0.55 }),
  ]),

  // Cup of Dust: an unquenchable thirst curse; an 8 s blood drop and blue motes missed the dryness.
  'pf2e:10siFBMF4pIDhVmf': design('A dry curse settles on the target and dust puffs from its parched lips as it sags.', () => [
    impact('Thirst curse', ['condition.curse.01.019.red'], { stageId: 'cu-curse', duration: 1800, scale: 0.6, ...tint('#c9a46a') }),
    impact('Parching dust', ['smoke.puff.centered.grey'], { after: 'cu-curse', anchor: 'start', offset: 500, duration: 1300, scale: 0.6, ...tint('#cbb08a') }),
    motion('stagger', 'targets', { after: 'cu-curse', anchor: 'start', offset: 600, duration: 900, intensity: 0.35 }),
  ]),

  // Curse of Death: the patron wraps a hand around the target's heart; a pink heart icon read as affection.
  'pf2e:nQS4vPm5zprqkzFZ': design('A dark spectral hand closes around the target\'s heart; a black heart flickers and it doubles over.', () => [
    impact('Patron\'s grip', ['arcane_hand.purple'], { stageId: 'cd-hand', duration: 1600, scale: 0.7, ...tint('#3a1a40') }),
    impact('Heart seized', ['markers.heart.dark_red.01', 'icon.heart.pink'], { after: 'cd-hand', anchor: 'start', offset: 600, duration: 1500, scale: 0.4, ...tint('#5a0f1f') }),
    motion('stagger', 'targets', { after: 'cd-hand', anchor: 'start', offset: 650, duration: 1000, intensity: 0.5 }),
  ], { sound: 'void' }),

  // Cyclone Rondo: a whirlwind that can knock creatures prone; creatures inside did nothing.
  'pf2e:IDkEuq5jLEDhJ31C': design('A Shory melody calls up a roaring whirlwind across the square that buffets creatures caught in it.', () => [
    cast('Shory melody', ['music_notations.treble_clef.blue'], { stageId: 'cr-song', scale: 0.5, duration: 900 }),
    area('Whirlwind rises', ['whirlwind.bluewhite', 'whirlwind.bluegrey'], { stageId: 'cr-wind', after: 'cr-song', anchor: 'start', offset: 450, duration: 3200 }),
    motion('stagger', 'targets', { after: 'cr-wind', anchor: 'start', offset: 600, duration: 1000, intensity: 0.55 }),
  ]),

  // Daemonic Pact: calling daemons from Abaddon; an 8.5 s portal and rune icons ran long.
  'pf2e:Vpohy4XH1DaH95hT': design('A drop of blood falls into a necrotic circle and a sickly gate to Abaddon opens.', () => [
    cast('Blood offering', ['markers.drop.red.01', 'icon.drop.red'], { stageId: 'dp-blood', scale: 0.4, duration: 1300 }),
    cast('Abaddon circle', ['magic_signs.circle.02.necromancy.complete.dark_green', 'magic_signs.circle.02.necromancy.complete.green'], { after: 'dp-blood', anchor: 'start', offset: 500, duration: 3000, scale: 1, below: true }),
    cast('Gate to Abaddon', ['portals.vertical.ring.dark_green', 'portals.vertical.ring.bright_yellow'], { after: 'dp-blood', anchor: 'start', offset: 1100, duration: 3000, scale: 0.9, offsetX: 1, offsetUnits: 'token', fadeOut: 500 }),
  ]),

  // Dance of Darkness: you dance up to half your Speed, then darkness fills a burst; the caster never moved.
  'pf2e:9BGEf9Sv5rgNBCk0': design('The caster dances a short way in a swirl of shadow and magical darkness blooms across the burst.', () => [
    motion('rush', 'source', { stageId: 'dd-dance', duration: 1500, distance: 1.2, motionRange: 'distance', motionHeading: 'toward', intensity: 0.45 }),
    sprite('Shadow trail', { after: 'dd-dance', anchor: 'start', duration: 1200, opacity: 0.35 }),
    area('Darkness blooms', ['darkness.black'], { after: 'dd-dance', anchor: 'start', offset: 900, duration: 3000, fadeIn: 400, fadeOut: 700 }),
  ]),

  // Dancing Blade: a telekinetically animated weapon flies to the foe and strikes; a flaming sword and an earth rumble were wrong.
  'pf2e:ViqzVEprQVzCXZ9f': design('An animated blade lifts, flies to the foe as if held by an invisible duelist and slashes at it.', () => [
    cast('Weapon animates', ['glint.yellow.few'], { stageId: 'db-lift', scale: 0.7, duration: 600 }),
    projectile('Blade flies', ['spiritual_weapon.shortsword.01.simple.01', 'spiritual_weapon.shortsword.01.spectral.02.green'], { stageId: 'db-fly', after: 'db-lift', anchor: 'end', duration: 1200, scale: 0.6 }),
    impact('Duelist slash', ['melee_generic.slashing.one_handed', 'melee_generic.slash.01.orange'], { after: 'db-fly', anchor: 'end', duration: 1100, scale: 0.9 }),
    motion('recoil', 'targets', { after: 'db-fly', anchor: 'end', offset: 250, duration: 650, intensity: 0.45 }),
  ], { sound: 'slash' }),

  // Dancing Fountain: a pool erupts in a dazzling, musical water show; notes alone carried no water.
  'pf2e:smiVuoFMSgY2FTOO': design('A shallow pool spreads across the burst and jets of water leap up in a musical fountain display.', () => [
    area('Pool spreads', ['water_splash.circle.01.blue'], { stageId: 'df-pool', duration: 1800 }),
    area('Fountain jets', ['lava_spout.001.001.complete.blue', 'lava_spout.001.001.complete.orangeyellow'], { after: 'df-pool', anchor: 'start', offset: 500, duration: 2400, scale: 0.5, ...tint('#8fd4ff') }),
    area('Music', ['music_notations.beamed_quavers.blue'], { after: 'df-pool', anchor: 'start', offset: 900, duration: 1600, scale: 0.5 }),
  ]),

  // Dancing Shield: a levitated shield orbits the target; the target itself levitating was wrong.
  'pf2e:8Hw3P6eurX1MYm7L': design('The touched shield lifts and circles the target, raised to guard it.', () => [
    cast('Shield lifts', ['magic_signs.rune.abjuration.complete.blue'], { stageId: 'ds-sign', scale: 0.45, duration: 900 }),
    aura('Orbiting shield', ['markers.shield.blue.01', 'icon.shield.green'], { subject: 'targets', after: 'ds-sign', anchor: 'start', offset: 450, duration: 2600, scale: 0.35, offsetX: 0.55, offsetUnits: 'token', ...spin(1600, 1) }),
    impact('Shield raised', ['shield.01.complete.01.blue'], { after: 'ds-sign', anchor: 'start', offset: 900, duration: 1600, scale: 0.9, opacity: 0.6 }),
  ]),

  // ---- Batch 8 (Darkened Eyes .. Dim the Light) ----

  // Dawnflower's Light: soft golden truth-revealing light across a 60-ft emanation; small glints didn't light anything.
  'pf2e:11P3KgDTMIeQIJD7': design('The object blazes with soft golden sunlight that washes out across the whole emanation.', () => [
    cast('Dawnflower kindles', ['sacred_flame.source.yellow'], { stageId: 'dl-flame', scale: 0.7, duration: 1100 }),
    area('Golden light spreads', ['template_circle.out_pulse.02.burst.yellowwhite', 'template_circle.out_pulse.02.burst.bluewhite'], { stageId: 'dl-pulse', after: 'dl-flame', anchor: 'start', offset: 500, duration: 2200, ...tint('#ffe9a9') }),
    aura('Sunlike glow', ['markers.light.complete.yellow', 'markers.light.complete.blue'], { after: 'dl-pulse', anchor: 'start', duration: 2600, scale: 1.6, opacity: 0.6, below: true }),
  ]),

  // Day's Weight: a whole day's aches fast-forwarded onto one creature; an 8.2 s divination circle ran long.
  'pf2e:Llx0xKvtu8S4z6TI': design('Time whirls rapidly around the target and the weight of a whole day bows it down.', () => [
    cast('Time quickens', ['magic_signs.rune.transmutation.complete.blue', 'magic_signs.rune.transmutation.complete.yellow'], { stageId: 'dw-sign', scale: 0.45, duration: 1000 }),
    impact('Hours rush past', ['particles.swirl.blue.02.01', 'particles.swirl.greenyellow.02.01'], { stageId: 'dw-swirl', after: 'dw-sign', anchor: 'start', offset: 450, duration: 1800, scale: 0.8, playbackRate: 1.6, ...tint('#cfe0ff') }),
    motion('press', 'targets', { after: 'dw-swirl', anchor: 'start', offset: 600, duration: 1300, intensity: 0.5 }),
  ], { sound: 'time' }),

  // Dazzling Flash: a holy symbol flashes in a blinding cone; a 6.4 s star icon and footprint were weak.
  'pf2e:zul5cBTfr7NXHBZf': design('The raised holy symbol flares and a blinding cone of white-gold light sears outward; creatures shield their eyes.', () => [
    cast('Symbol raised', ['ward.star.yellow.01'], { stageId: 'df-symbol', scale: 0.45, duration: 1100 }),
    area('Blinding flash', ['breath_weapons02.burst.cone.holy.yellow.01', 'template_cone_PF2e.001.001.purplered'], { stageId: 'df-cone', after: 'df-symbol', anchor: 'start', offset: 400, duration: 1600, ...tint('#fff3c4') }),
    motion('cower', 'targets', { after: 'df-cone', anchor: 'start', offset: 250, duration: 900, intensity: 0.45 }),
  ]),

  // Dead Weight: a thrall hurls itself onto a creature and fuses to it; the target lunging was backwards.
  'pf2e:4kQMFyRKj5Gv13zl': design('The thrall slams into the target in a burst of necrotic flesh and fuses there, weighing it down.', () => [
    impact('Thrall slams in', ['melee_generic.creature_attack.fist.002.purple', 'melee_generic.creature_attack.fist.002.blue'], { stageId: 'dw-hit', duration: 900, scale: 0.8 }),
    impact('Flesh fuses', ['smoke.puff.centered.dark_purple', 'smoke.puff.centered.grey'], { after: 'dw-hit', anchor: 'start', offset: 300, duration: 1400, scale: 0.7 }),
    motion('press', 'targets', { after: 'dw-hit', anchor: 'start', offset: 250, duration: 1200, intensity: 0.55 }),
  ]),

  // Death Knell: snuffing out a dying creature's life; an 8 s pink heart missed the knell.
  'pf2e:dLdRqT6UxTKlsPgp': design('A spectral death bell tolls over the dying creature and a skull of grey smoke rises from it.', () => [
    impact('The knell tolls', ['toll_the_dead.purple.complete', 'toll_the_dead.green.complete'], { stageId: 'dk-bell', duration: 2600, scale: 0.7 }),
    motion('shake', 'targets', { after: 'dk-bell', anchor: 'start', offset: 900, duration: 700, intensity: 0.35 }),
  ]),

  // Death Ward: shields a creature from void energy; a purple ward on the caster missed the target and read as necromantic.
  'pf2e:YvXKGlHOt7mdW2jZ': design('A golden protective rune flares and a warm ward of light settles around the touched creature.', () => [
    cast('Warding rune', ['magic_signs.rune.abjuration.complete.yellow', 'magic_signs.rune.abjuration.complete.blue'], { stageId: 'dw-rune', scale: 0.45, duration: 1000 }),
    impact('Death ward', ['shield.02.complete.01.yellow', 'shield.01.complete.01.blue'], { after: 'dw-rune', anchor: 'start', offset: 450, duration: 2000, scale: 1 }),
  ]),

  // Decompose: rapid decay of a corpse; an 8.7 s purple smoke ran long.
  'pf2e:AvUDguV71UG7srSj': design('Sickly green rot smoke rises from the touched corpse as it crumbles to motes.', () => [
    impact('Decay begins', ['smoke.puff.centered.dark_green', 'smoke.puff.centered.grey'], { stageId: 'de-rot', duration: 1700, scale: 0.8 }),
    impact('Matter departs', ['particles.outward.greenyellow.01.04'], { after: 'de-rot', anchor: 'start', offset: 500, duration: 1600, scale: 0.7, ...tint('#7c7a52') }),
  ]),

  // Defy the Gods: draining divine power from the target back to the caster; the beam flowed the wrong way.
  'pf2e:3ZNuJm5LDA8GkFsH': design('The caster grasps at the target\'s borrowed divinity and a stream of its power is torn back into the caster.', () => [
    cast('Reach for power', ['cast_generic.02.dark_purple', 'cast_generic.02.blue'], { stageId: 'dg-cast', scale: 0.8, duration: 600 }),
    impact('Divinity torn', ['impact.001.pinkpurple', 'impact.001.blue'], { stageId: 'dg-hit', after: 'dg-cast', anchor: 'end', duration: 900, scale: 0.9 }),
    travel('Power drained back', ['energy_beam.reverse.purple', 'energy_strands.range.standard.purple.01'], { stageId: 'dg-drain', after: 'dg-hit', anchor: 'start', offset: 300, duration: 1500, scale: 0.7 }),
    motion('stagger', 'targets', { after: 'dg-hit', anchor: 'start', duration: 800, intensity: 0.45 }),
    motion('pulse', 'source', { after: 'dg-drain', anchor: 'end', offset: -300, duration: 700, intensity: 0.5 }),
  ]),

  // Dehydrate: inner fire drives moisture out; 6-8 s flames and steam ran long.
  'pf2e:f9m9DayyGy3meqUX': design('A wave of dry heat shimmers through the burst and steam boils off the creatures inside.', () => [
    area('Inner fire stirs', ['particles.inward.orange.01.02', 'particles.inward.greenyellow.01.02'], { stageId: 'dh-heat', duration: 1500, ...tint('#e9b36a') }),
    area('Moisture boils off', ['fumes.steam.white'], { after: 'dh-heat', anchor: 'start', offset: 500, duration: 2200 }),
    area('Embers flicker', ['flames.04.complete.orange'], { after: 'dh-heat', anchor: 'start', offset: 700, duration: 2000, scale: 0.6, opacity: 0.6 }),
    motion('stagger', 'targets', { after: 'dh-heat', anchor: 'start', offset: 800, duration: 900, intensity: 0.35 }),
  ], { sound: 'fire' }),

  // Deity's Strike: a manifested divine weapon strikes the target and bursts in a shockwave.
  'pf2e:x9RIFhquazom4p02': design('A radiant manifestation of the deity\'s weapon appears above the target, smites it and bursts in a shock wave of divine energy.', () => [
    cast('Call divine weapon', ['divine_smite.caster.standard.yellowwhite', 'divine_smite.caster.blueyellow'], { stageId: 'ds-call', scale: 0.8, duration: 900 }),
    impact('Divine weapon strikes', ['spiritual_weapon.longsword.01.flaming.yellow', 'spiritual_weapon.mace.flaming.yellow'], { stageId: 'ds-blade', after: 'ds-call', anchor: 'start', offset: 500, duration: 1800, scale: 0.8 }),
    impact('Divine shock wave', ['divine_smite.target.yellowwhite', 'divine_smite.target.blueyellow'], { after: 'ds-blade', anchor: 'start', offset: 1000, duration: 1400, scale: 0.9 }),
    motion('recoil', 'targets', { after: 'ds-blade', anchor: 'start', offset: 1050, duration: 650, intensity: 0.6 }),
  ]),

  // Déjà Vu: a looped thought makes the target repeat itself; an 8.8 s rune ran long.
  'pf2e:rerNA6YZsdxuJYt3': design('An afterimage of the target repeats its pose twice while a looping divination sign turns over it.', () => [
    impact('Looping thought', ['magic_signs.rune.divination.complete.purple', 'magic_signs.rune.divination.complete.blue'], { stageId: 'dv-sign', duration: 2000, scale: 0.45 }),
    sprite('First echo', { subject: 'targets', after: 'dv-sign', anchor: 'start', offset: 400, duration: 1000, opacity: 0.4, offsetX: -0.25, offsetUnits: 'token' }),
    sprite('Second echo', { subject: 'targets', after: 'dv-sign', anchor: 'start', offset: 1100, duration: 1000, opacity: 0.4, offsetX: -0.25, offsetUnits: 'token' }),
  ]),

  // Delay Consequence: the moment of injury is pushed later in the timestream; an 8.5 s field ran long.
  'pf2e:3wmX7htzOXiHLdAn': design('Time folds around the struck target: a frozen afterimage hangs beside it as a swirl of temporal motes holds the wound back.', () => [
    impact('Moment folds', ['particles.swirl.blue.01.01', 'particles.swirl.greenyellow.01.01'], { stageId: 'dc-swirl', duration: 1800, scale: 0.8, ...tint('#cfe0ff') }),
    sprite('Held moment', { subject: 'targets', after: 'dc-swirl', anchor: 'start', offset: 300, duration: 1500, opacity: 0.4 }),
  ], { sound: 'time' }),

  // Deluge: a catastrophic downpour that vanishes; flyers fall and others are swept.
  'pf2e:8fEfjvC01gNclDKJ': design('A catastrophic downpour crashes across the whole burst and creatures inside are battered down and swept.', () => [
    area('Torrential downpour', ['template_square.raindrops.001.7x7.instant.combined.blue'], { stageId: 'de-rain', duration: 2400 }),
    area('Flood surge', ['water_splash.circle.01.blue'], { after: 'de-rain', anchor: 'start', offset: 700, duration: 2200 }),
    motion('stagger', 'targets', { after: 'de-rain', anchor: 'start', offset: 800, duration: 1000, intensity: 0.65 }),
  ]),

  // Demonic Pact: calling demons from the Outer Rifts; an 8.5 s portal ran long.
  'pf2e:tsKnoBuBbKMXkiz5': design('A blood-red summoning circle burns and a gate to the Abyss tears open beside the caster.', () => [
    cast('Demonic circle', ['magic_signs.circle.02.conjuration.complete.dark_red', 'magic_signs.circle.02.conjuration.complete.yellow'], { stageId: 'dp-circle', duration: 3200, scale: 1, below: true }),
    cast('Abyssal gate', ['portals.vertical.ring.dark_red', 'portals.vertical.ring.bright_yellow'], { after: 'dp-circle', anchor: 'start', offset: 900, duration: 3000, scale: 0.9, offsetX: 1, offsetUnits: 'token', fadeOut: 500 }),
  ]),

  // Desiccate: moisture pulled out of bodies (void); a blue water splash looked like adding water.
  'pf2e:M0jQlpQYUr0pp2Sv': design('Moisture is wrenched out of each target in a hiss of steam, leaving parched dust as they wither.', () => [
    impact('Moisture torn out', ['fumes.steam.white'], { stageId: 'ds-steam', duration: 1600, scale: 0.8, targetSelection: 'all' }),
    impact('Parched dust', ['smoke.puff.centered.grey'], { after: 'ds-steam', anchor: 'start', offset: 600, duration: 1300, scale: 0.6, targetSelection: 'all', ...tint('#c8b48a') }),
    motion('stagger', 'targets', { after: 'ds-steam', anchor: 'start', offset: 300, duration: 1000, intensity: 0.5 }),
  ]),

  // Detonate Magic: the target's magic dissipates in a destructive explosion of force; 7.8 s scan/smoke ran long.
  'pf2e:kUSShxXzY1sPtJA0': design('The target\'s magic unravels into strands and detonates in a burst of force.', () => [
    impact('Magic unravels', ['energy_strands.complete.purple.01', 'energy_strands.complete.blue.01'], { stageId: 'dm-strands', duration: 1100, scale: 0.8 }),
    impact('Force detonation', ['explosion.04.dark_purple', 'explosion.04.blue'], { stageId: 'dm-boom', after: 'dm-strands', anchor: 'start', offset: 700, duration: 1500, scale: 0.9 }),
    motion('recoil', 'targets', { after: 'dm-boom', anchor: 'start', offset: 150, duration: 650, intensity: 0.6 }),
  ]),

  // Devour Life: consuming a target's life force (void) and healing from it; the return beam flowed caster-to-target.
  'pf2e:PgLvO8UNHSj5f61m': design('Shadowy arms seize the target, its life force is ripped out and streams back into the caster, who swells with it.', () => [
    cast('Hunger awakens', ['arms_of_hadar.dark_purple'], { stageId: 'dl-arms', scale: 0.6, duration: 900 }),
    impact('Life consumed', ['energy_strands.overlay.dark_purple.01', 'energy_strands.overlay.blue.01'], { stageId: 'dl-eat', after: 'dl-arms', anchor: 'start', offset: 500, duration: 1800, scale: 1, ...tint('#705299') }),
    travel('Life streams to caster', ['energy_beam.reverse.purple', 'energy_strands.range.standard.purple.04'], { stageId: 'dl-drain', after: 'dl-eat', anchor: 'start', offset: 400, duration: 1600, scale: 0.7 }),
    cast('Life absorbed', ['energy_strands.in.purple.01', 'energy_strands.in.green.01'], { after: 'dl-drain', anchor: 'start', offset: 800, duration: 1500, scale: 1 }),
    motion('stagger', 'targets', { after: 'dl-eat', anchor: 'start', offset: 200, duration: 1000, intensity: 0.55 }),
  ]),

  // Devouring Void: countless hungry tears in space across a 30-ft burst; a 6.6 s sphere ran long.
  'pf2e:EAuUxxnDV4v3KDAC': design('Hungry black tears in space open across the burst, snapping like mouths at the living creatures inside.', () => [
    area('Spatial tears', ['portals.horizontal.vortex.black', 'portals.horizontal.ring.bright_yellow'], { stageId: 'dv-tears', duration: 3000, scale: 0.7, below: true }),
    area('Annihilating dark', ['sphere_of_annihilation.600px.purple'], { after: 'dv-tears', anchor: 'start', offset: 300, duration: 2600, opacity: 0.6 }),
    impact('Hungry mouths', ['bite.200px.purple', 'bite.200px.red'], { after: 'dv-tears', anchor: 'start', offset: 900, duration: 900, scale: 0.5, targetSelection: 'all' }),
    motion('stagger', 'targets', { after: 'dv-tears', anchor: 'start', offset: 950, duration: 800, intensity: 0.5 }),
  ]),

  // Diabolic Edict: an infernal oath seal; an 8.8 s rune ran long.
  'pf2e:Vctwx1ewa8HUOA94': design('A crimson infernal seal stamps over the target, binding it to the proclaimed task.', () => [
    impact('Infernal seal', ['magic_signs.rune.enchantment.complete.red', 'magic_signs.rune.enchantment.complete.pink'], { stageId: 'de-seal', duration: 2000, scale: 0.6 }),
    impact('Chained oath', ['markers.chain.standard.complete.02.red'], { after: 'de-seal', anchor: 'start', offset: 600, duration: 1800, scale: 0.6 }),
  ]),

  // Diabolic Pact: a devil's service bound by contract; 8.5-8.8 s chains and portal ran long.
  'pf2e:30BBep9U4BDV0EgQ': design('Infernal chains coil into a contract seal and a hellish gate opens to send the devils.', () => [
    cast('Contract chains', ['markers.chain.standard.complete.02.red'], { stageId: 'dp-chains', scale: 0.7, duration: 2200 }),
    cast('Hellish gate', ['portals.vertical.ring.dark_red_yellow', 'portals.vertical.ring.bright_yellow'], { after: 'dp-chains', anchor: 'start', offset: 900, duration: 3000, scale: 0.9, offsetX: 1, offsetUnits: 'token', fadeOut: 500 }),
  ]),

  // Diamond Dust: an emanation of dancing ice crystals; a 6.8 s sleet film exceeded the cap.
  'pf2e:wjJW9hWY5CkkMvY5': design('The air around the caster supercools into a glittering cloud of dancing ice crystals.', () => [
    area('Ice crystals', ['sleet_storm.01.blue'], { stageId: 'dd-sleet', duration: 3500, fadeOut: 600 }),
    area('Refracting glints', ['twinkling_stars.points06.white'], { after: 'dd-sleet', anchor: 'start', offset: 500, duration: 2600, ...tint('#cfefff') }),
  ]),

  // ---- Batch 9 (Dimensional Assault .. Drain Life) ----

  // Dimensional Drop: a portal opens beneath the target, which plummets through the void and drops out above its space.
  'pf2e:PnZQsPSYFtTQFiU1': design('A portal yawns open under the target, which sinks through it, then a second portal flashes above and it crashes back down.', () => [
    impact('Portal below', ['portals.horizontal.vortex.purple', 'portals.horizontal.ring.bright_yellow'], { stageId: 'dd-below', duration: 1800, scale: 0.8, below: true, fadeOut: 400 }),
    motion('sink', 'targets', { stageId: 'dd-sink', after: 'dd-below', anchor: 'start', offset: 300, duration: 1000, intensity: 0.8 }),
    impact('Portal above', ['misty_step.02.purple', 'misty_step.02.blue'], { after: 'dd-below', anchor: 'start', offset: 1300, duration: 1200, scale: 0.9 }),
    motion('slam', 'targets', { after: 'dd-below', anchor: 'start', offset: 1500, duration: 700, intensity: 0.6 }),
  ]),

  // Dimensional Excision: planar boundaries slice away pieces of the target; the old recipe teleported the caster.
  'pf2e:MFPvs0ARxtThYPFq': design('Rifts between planes slice across the target like scalpels, cutting away its essence through tiny portals; it bleeds and reels.', () => [
    cast('Planes parted', ['magic_signs.rune.conjuration.complete.purple', 'magic_signs.rune.conjuration.complete.yellow'], { stageId: 'de-sign', scale: 0.45, duration: 900 }),
    impact('Planar cuts', ['melee_generic.slash.02.001.purple', 'melee_generic.slash.02.001.blue'], { stageId: 'de-cut', after: 'de-sign', anchor: 'start', offset: 450, duration: 900, scale: 0.9 }),
    impact('Essence banished', ['portals.vertical.ring_masked.purple', 'portals.vertical.ring.bright_yellow'], { after: 'de-cut', anchor: 'start', offset: 250, duration: 1400, scale: 0.4 }),
    impact('Lacerations', ['liquid.splash_side02.red'], { after: 'de-cut', anchor: 'start', offset: 350, duration: 1000, scale: 0.5 }),
    motion('stagger', 'targets', { after: 'de-cut', anchor: 'start', offset: 200, duration: 900, intensity: 0.6 }),
  ]),

  // Dimensional Steps: a short teleport; the caster never visibly blinked.
  'pf2e:zjG6NncHyAKqSF7m': design('The caster vanishes in a purple misty step and flickers through space.', () => [
    cast('Rift', ['misty_step.01.purple', 'misty_step.01.blue'], { stageId: 'ds-out', duration: 1300 }),
    motion('flicker', 'source', { after: 'ds-out', anchor: 'start', offset: 200, duration: 900, intensity: 0.8 }),
  ]),

  // Dinosaur Fort: a primeval fort of sharpened wood; a 7.9 s growth and skull icons ran long.
  'pf2e:FA55Fxf8MBXhje95': design('Sharpened timber palisades sprout up and a primal roar of dust rolls out.', () => [
    area('Palisade grows', ['plant_growth.03.square.4x4.complete.greenyellow'], { stageId: 'df-wall', duration: 3500, ...tint('#a37b4f') }),
    area('Primal dust', ['smoke.puff.ring.01.white'], { after: 'df-wall', anchor: 'start', offset: 1000, duration: 1600, ...tint('#b39b7a') }),
  ]),

  // Discomfiting Whispers: an aura of spiteful murmurings; a 6.5 s die icon read as luck, not malice.
  'pf2e:t1e3U2eluRsp2izf': design('Spiteful murmurs ripple out around the caster and horror sigils flicker through the aura.', () => [
    cast('Murmurs', ['soundwave.02.purple', 'soundwave.02.blue'], { stageId: 'dw-voice', scale: 0.6, duration: 1300 }),
    area('Spiteful aura', ['template_circle.symbol.out_flow.horror.purple', 'template_circle.symbol.normal.horror.purple'], { after: 'dw-voice', anchor: 'start', offset: 300, duration: 2600, opacity: 0.75 }),
  ]),

  // Disorienting Flash: a small explosion of bright light and ear-piercing sound; an 8 s moonbeam was soft and silent of sound.
  'pf2e:iALgymtr6vhsHFCr': design('A blinding white flash bursts with an ear-splitting crack and creatures inside reel with dazzled eyes.', () => [
    area('Blinding flash', ['explosion.05.yellowwhite', 'explosion.03.blueyellow'], { stageId: 'df-flash', duration: 1300 }),
    area('Ear-piercing crack', ['soundwave.02.orangeyellow', 'soundwave.02.blue'], { after: 'df-flash', anchor: 'start', offset: 100, duration: 1400 }),
    motion('cower', 'targets', { after: 'df-flash', anchor: 'start', offset: 200, duration: 900, intensity: 0.5 }),
  ], { sound: 'sonic' }),

  // Disruptive Transfer: a teleport leaving a dazzling array of overlapping destinations; the caster never blinked.
  'pf2e:jSJz4vx0fXPHa3d6': design('The caster blinks away in a burst of overlapping afterimages that dazzle everyone adjacent.', () => [
    cast('Path calculated', ['magic_signs.rune.conjuration.complete.purple', 'magic_signs.rune.conjuration.complete.yellow'], { stageId: 'dt-sign', scale: 0.45, duration: 700 }),
    sprite('Overlapping destinations', { after: 'dt-sign', anchor: 'start', offset: 400, duration: 1200, opacity: 0.4, offsetX: 0.3, offsetUnits: 'token' }),
    cast('Departure flash', ['misty_step.01.purple', 'misty_step.01.blue'], { stageId: 'dt-out', after: 'dt-sign', anchor: 'start', offset: 500, duration: 1300 }),
    motion('flicker', 'source', { after: 'dt-out', anchor: 'start', offset: 200, duration: 900, intensity: 0.8 }),
  ], { sound: 'teleport' }),

  // Div Pact: calling divs from Abaddon; an 8.5 s portal ran long.
  'pf2e:D8cWhrzcsd43OlIX': design('A sickly green necromantic circle flares and a gate to Abaddon opens beside the caster.', () => [
    cast('Abaddon circle', ['magic_signs.circle.02.necromancy.complete.dark_green', 'magic_signs.circle.02.necromancy.complete.green'], { stageId: 'dv-circle', duration: 3000, below: true }),
    cast('Gate to Abaddon', ['portals.vertical.ring.dark_green', 'portals.vertical.ring.bright_yellow'], { after: 'dv-circle', anchor: 'start', offset: 900, duration: 3000, scale: 0.9, offsetX: 1, offsetUnits: 'token', fadeOut: 500 }),
  ]),

  // Dive and Breach: a leap into a splash through the Plane of Water and back out in another splash; purple portals missed the water.
  'pf2e:1xM9muPRa8hiyJtI': design('The caster leaps and dives into a crashing splash of water, then bursts out in another splash further on.', () => [
    motion('leap', 'source', { stageId: 'db-leap', duration: 1500, distance: 1, motionRange: 'distance', motionHeading: 'toward', jumpHeight: 0.5, intensity: 0.45 }),
    cast('Dive splash', ['water_splash.circle.01.blue'], { stageId: 'db-in', after: 'db-leap', anchor: 'start', offset: 900, duration: 1600 }),
    cast('Breach splash', ['impact.water.02.blue'], { after: 'db-in', anchor: 'start', offset: 900, duration: 1300, scale: 1.2 }),
    motion('recoil', 'targets', { after: 'db-in', anchor: 'start', offset: 150, duration: 650, intensity: 0.45 }),
  ], { sound: 'water' }),

  // Divine Armageddon: a divine cataclysm of void and spirit across a 60-ft burst; the healing chime was wrong.
  'pf2e:it4wx2mDIJDlZGqS': design('Divine cataclysm crashes over the whole burst: a shockwave of holy light tangled with void darkness smites every creature inside.', () => [
    cast('Deity\'s judgement', ['divine_smite.caster.standard.yellowwhite', 'divine_smite.caster.blueyellow'], { stageId: 'da-call', scale: 1, duration: 1300 }),
    area('Divine shockwave', ['template_circle.out_pulse.02.burst.yellowwhite', 'template_circle.out_pulse.02.burst.bluewhite'], { stageId: 'da-wave', after: 'da-call', anchor: 'start', offset: 700, duration: 2000 }),
    area('Void and spirit', ['explosion.05.purplepink', 'explosion.04.blue'], { after: 'da-wave', anchor: 'start', offset: 200, duration: 1800 }),
    impact('Smitten', ['divine_smite.target.yellowwhite', 'divine_smite.target.blueyellow'], { after: 'da-wave', anchor: 'start', offset: 400, duration: 1300, scale: 0.7, targetSelection: 'all' }),
    motion('stagger', 'targets', { after: 'da-wave', anchor: 'start', offset: 450, duration: 900, intensity: 0.6 }),
  ], { sound: 'divineWrath' }),

  // Divine Decree: a litany dealing spirit damage to enemies in the emanation; enemies never reacted.
  'pf2e:sX2o0HH4RjJDAZ8C': design('The caster thunders a holy litany; a ring of spirit force rolls across the emanation and enemies are struck down.', () => [
    cast('Faith litany', ['magic_signs.rune.abjuration.complete.yellow', 'magic_signs.rune.abjuration.complete.blue'], { stageId: 'dd-sign', scale: 0.5, duration: 1000 }),
    area('Mandate voice', ['soundwave.02.orangeyellow', 'soundwave.02.blue'], { stageId: 'dd-voice', after: 'dd-sign', anchor: 'start', offset: 400, duration: 1800 }),
    area('Spirit force', ['spirit_guardians.blueyellow.ring'], { after: 'dd-voice', anchor: 'start', offset: 200, duration: 2400 }),
    impact('Smitten', ['divine_smite.target.yellowwhite', 'divine_smite.target.blueyellow'], { after: 'dd-voice', anchor: 'start', offset: 500, duration: 1300, scale: 0.7, targetSelection: 'all' }),
    motion('stagger', 'targets', { after: 'dd-voice', anchor: 'start', offset: 550, duration: 900, intensity: 0.55 }),
  ]),

  // Divine Plagues: wracking divine plagues; a 7.8 s purple gas read as arcane poison.
  'pf2e:NkeLctXo9FLGnDhi': design('A golden curse of judgement settles on the target and sickly plague-smoke wracks it.', () => [
    impact('Divine judgement', ['condition.curse.01.009.red'], { stageId: 'dp-curse', duration: 1800, scale: 0.6, ...tint('#e0c060') }),
    impact('Plague smoke', ['smoke.puff.centered.dark_green', 'smoke.puff.centered.grey'], { after: 'dp-curse', anchor: 'start', offset: 500, duration: 1500, scale: 0.7 }),
    motion('stagger', 'targets', { after: 'dp-curse', anchor: 'start', offset: 550, duration: 900, intensity: 0.45 }),
  ]),

  // Divine Wrath: divine fury smites enemies in the burst; static 6.6 s films with no reaction.
  'pf2e:hVU9msO9yGkxKZ3J': design('A ring of divine fury blazes across the burst and holy light smites each enemy inside, which reels sickened.', () => [
    area('Divine fury', ['spirit_guardians.blueyellow.ring'], { stageId: 'dw-ring', duration: 2600 }),
    impact('Smitten', ['divine_smite.target.yellowwhite', 'divine_smite.target.blueyellow'], { after: 'dw-ring', anchor: 'start', offset: 500, duration: 1300, scale: 0.7, targetSelection: 'all' }),
    motion('stagger', 'targets', { after: 'dw-ring', anchor: 'start', offset: 550, duration: 900, intensity: 0.5 }),
  ]),

  // Dizzying Colors: a swirling multitude of colours in a cone; purple sparkles and a footprint were monotone.
  'pf2e:UKsIOWmMx4hSpafl': design('A swirling cone of rainbow colours floods out and the creatures caught in it reel, dazzled.', () => [
    area('Swirling colours', ['template_cone_PF2e.001.002.pinkyellow', 'template_cone_PF2e.001.001.purplered'], { stageId: 'dc-cone', duration: 1800 }),
    impact('Colour burst', ['impact.013.002.pinkyellow', 'impact.013.002.orangeyellow'], { after: 'dc-cone', anchor: 'start', offset: 350, duration: 1000, scale: 0.6, targetSelection: 'all' }),
    motion('shake', 'targets', { after: 'dc-cone', anchor: 'start', offset: 400, duration: 900, intensity: 0.45 }),
  ]),

  // Door to Beyond: hairline cracks outside reality pull creatures toward them; a magic sword swing was wrong.
  'pf2e:iMmexY6ZosLS4I5R': design('The caster strikes the air and black hairline cracks open beside them, sucking air and debris inward; nearby creatures are dragged.', () => [
    motion('lunge', 'source', { stageId: 'db-strike', duration: 550, intensity: 0.4 }),
    cast('Cracks in reality', ['portals.vertical.vortex.black', 'portals.vertical.ring.bright_yellow'], { stageId: 'db-door', after: 'db-strike', anchor: 'start', offset: 250, duration: 2800, scale: 0.4, offsetX: 0.9, offsetUnits: 'token', fadeOut: 500 }),
    area('Air rushes inward', ['template_circle.vortex.intro.dark_black', 'template_circle.vortex.intro.blue'], { after: 'db-door', anchor: 'start', offset: 300, duration: 2400, opacity: 0.6 }),
    motion('stagger', 'targets', { after: 'db-door', anchor: 'start', offset: 600, duration: 1000, intensity: 0.45 }),
  ]),

  // Downpour: torrential rain over the burst; a splash and an 8 s smoke plume ran long.
  'pf2e:K4LXpaBWrGy6jIER': design('Torrential rain pours over the whole burst and a veil of grey mist rises.', () => [
    area('Torrential rain', ['template_square.raindrops.001.7x7.instant.combined.blue'], { stageId: 'dp-rain', duration: 3000 }),
    area('Rain mist', ['fog_cloud.01.white'], { after: 'dp-rain', anchor: 'start', offset: 700, duration: 2600, opacity: 0.5 }),
  ]),

  // Dragon Breath: a cone of draconic energy; faint particles and a footprint carried no breath.
  'pf2e:JcobNl4iE9HmMYtE': design('The caster spews a roaring cone of draconic energy and creatures inside are blasted back.', () => [
    motion('lunge', 'source', { duration: 500, intensity: 0.35 }),
    area('Draconic breath', ['breath_weapons02.burst.cone.arcana.purple.01', 'breath_weapons.fire.cone.orange.01'], { stageId: 'db-cone', offset: 150, duration: 2200 }),
    motion('recoil', 'targets', { after: 'db-cone', anchor: 'start', offset: 450, duration: 650, intensity: 0.55 }),
  ]),

  // Dragon Wings: leathery wings sprout; purple feathers read as bird wings.
  'pf2e:HWJODX2zPg5cg34F': design('Dark leathery wings unfurl in a rush of air and the caster beats up into flight.', () => [
    cast('Wings unfurl', ['swirling_feathers.outburst.01.red', 'swirling_feathers.outburst.01.textured'], { stageId: 'dw-wings', duration: 1600, scale: 1.1, ...tint('#7a3b2a') }),
    cast('Wingbeat gust', ['wind_lines.01.02.white'], { after: 'dw-wings', anchor: 'start', offset: 400, duration: 1400 }),
    motion('levitate', 'source', { after: 'dw-wings', anchor: 'start', offset: 400, duration: 2000, intensity: 0.8 }),
  ], { sound: 'wind' }),

  // Drain Life: life energy pulled from the target into the caster; the return strands flowed caster-to-target and the drain impact ran 5.9 s.
  'pf2e:cqdmSmQnM0q6wbWG': design('The caster closes a fist; the target\'s life energy is torn out and streams back into the caster.', () => [
    cast('Fist closes', ['arms_of_hadar.dark_purple'], { stageId: 'dl-arms', scale: 0.5, duration: 700 }),
    impact('Life torn out', ['impact.009.purple', 'impact.009.orange'], { stageId: 'dl-hit', after: 'dl-arms', anchor: 'start', offset: 350, duration: 1000, scale: 0.9 }),
    travel('Life streams back', ['energy_beam.reverse.purple', 'energy_strands.range.multiple.purple.01'], { stageId: 'dl-drain', after: 'dl-hit', anchor: 'start', offset: 250, duration: 1500, scale: 0.7 }),
    cast('Caster receives', ['healing_generic.loop.purplepink', 'healing_generic.loop.greenorange'], { after: 'dl-drain', anchor: 'start', offset: 800, duration: 1100, scale: 1.2 }),
    motion('stagger', 'targets', { after: 'dl-hit', anchor: 'start', duration: 800, intensity: 0.45 }),
    motion('pulse', 'source', { after: 'dl-drain', anchor: 'end', offset: -300, duration: 700, intensity: 0.5 }),
  ]),
};
