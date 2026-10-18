// Bespoke compositions (dnd5e-features-b). Keys: '<system>:<entryId>' or '<system>:<entryId>:<variant|mode>'.
// See scripts/catalogs/bespoke/helpers.mjs and scripts/bespoke.mjs.
// Every entry in this slice is a D&D 5e condition or Actor effect, so each design
// is one or two persistent aura layers on the affected token (subject 'source').
// Mundane martial features use restrained physical cues (footprints, dust, a
// steel shield marker, a weapon glint) instead of magic circles.
import { cast, travel, projectile, impact, area, aura, sprite, motion, tint, spin, breathe, design } from './helpers.mjs';

// Persistent layer defaults, matching the generated state lifetime.
const P = { persist: true, duration: 6000, fadeIn: 400, fadeOut: 400, bindAlpha: true, opacity: 0.82 };
const A = (label, assets, o = {}) => aura(label, assets, { ...P, ...o });
const MK = { scale: 0.72 }; // floating condition marker
const UNDER = { offsetY: 0.22, offsetUnits: 'token' };

const LOOKS = {
  prone: ['knocked flat, a low ring of settling dust marks the creature on the ground.', () => [A('Dust settles around the fallen body', ['smoke.ring.01.white', 'smoke.puff.ring.01.white'], { scale: 1.15, below: true, opacity: 0.5, ...tint('#b9ab8f') })]],
  sleep: ['unconscious or magically asleep, shown by a drifting sleep symbol.', () => [A('Asleep', ['sleep.symbol.blue', 'sleep.symbol.pink'], { scale: 0.9, ...tint('#9fb8ff') })]],
  exhausted: ['exhaustion shows as heavy, steaming breath rather than magic.', () => [A('Laboured, steaming breath', ['fumes.steam.white'], { scale: 0.7, opacity: 0.55 })]],
  dead: ['the final exhaustion level is death, marked with a skull.', () => [A('Death marker', ['markers.skull.dark_red.01', 'markers.skull.purple.01'], MK)]],
  guard: ['a mundane defensive benefit, shown as a plain steel shield marker instead of a magic ring.', () => [A('Guarded stance', ['markers.shield.blue.01', 'markers.shield.green.01'], { ...MK, opacity: 0.8, ...tint('#c9d3de') })]],
  swiftMundane: ['trained, non-magical mobility, shown as faint footfalls underfoot.', () => [A('Light footfalls', ['footprints.human.grey', 'footprints.shoe.grey'], { scale: 0.9, below: true, opacity: 0.45 })]],
  swift: ['magically quickened movement, shown as rushing air beneath the creature.', () => [A('Rushing air', ['wind_lines.01.01.white'], { scale: 1.25, below: true, opacity: 0.5 })]],
  haste: ['hastened: a golden quickening swirl around the creature for the duration.', () => [A('Golden quickening swirl', ['particles.swirl.orange.01.01', 'particles.swirl.greenyellow.01.01'], { scale: 1.3, opacity: 0.8, ...tint('#ffcf5a') })]],
  flight: ['a fly speed, shown by a shadow left on the ground below and moving air.', () => [
    A('Shadow on the ground below', ['drop_shadow.dark_black'], { scale: 0.85, below: true, opacity: 0.5, ...UNDER }),
    A('Air currents', ['wind_lines.01.02.white'], { scale: 1.2, below: true, opacity: 0.4 }),
  ]],
  levitate: ['levitating: the creature hangs above its own shadow.', () => [
    A('Shadow beneath the hovering body', ['drop_shadow.dark_black'], { scale: 0.85, below: true, opacity: 0.5, ...UNDER }),
    A('Lifting motes', ['swirling_sparkles.01.blue'], { scale: 1.1, opacity: 0.4 }),
  ]],
  feathers: ['feathered wings grant flight: drifting feathers above a ground shadow.', () => [
    A('Shadow on the ground below', ['drop_shadow.dark_black'], { scale: 0.85, below: true, opacity: 0.5, ...UNDER }),
    A('Feathers stir', ['swirling_feathers.outburst.01.textured', 'swirling_feathers.outburst.01.orange'], { scale: 1.15, opacity: 0.65 }),
  ]],
  bats: ['the cloak turns into bat wings for flight: dark bats flutter around the wearer.', () => [
    A('Shadow on the ground below', ['drop_shadow.dark_black'], { scale: 0.85, below: true, opacity: 0.5, ...UNDER }),
    A('Bat wings flutter', ['bats.loop.01.red', 'bats.loop.01.green'], { scale: 1.2, opacity: 0.7, ...tint('#5a4a6a') }),
  ]],
  breeze: ['a conjured fan of wind, shown as steady streaming air.', () => [A('Steady magical wind', ['wind_lines.01.01.white'], { scale: 1.3, opacity: 0.55 })]],
  mist: ['the body becomes a drifting cloud of mist.', () => [A('Body of drifting mist', ['fog_cloud.02.white', 'fog_cloud.01.white'], { scale: 1.25, opacity: 0.7 })]],
  aquatic: ['breathing water and swimming freely, shown by small rising bubbles.', () => [A('Rising bubbles', ['markers.bubble.loop.blue'], MK)]],
  whirlpool: ['caught in a whirlpool: a water vortex turns beneath the creature.', () => [A('Whirlpool vortex', ['portals.horizontal.vortex.blue', 'bubble.001.001.loop.blue'], { scale: 1.4, below: true, opacity: 0.85 })]],
  waterWalk: ['walking on liquid as if solid ground: ripples spread underfoot.', () => [A('Ripples underfoot', ['zoning.outward.circle.loop.bluegreen.01.01'], { scale: 1.1, below: true, opacity: 0.6, ...tint('#5fa8e8') })]],
  caltrops: ['slowed by caltrops underfoot.', () => [A('Caltrops underfoot', ['caltrops.01.grey'], { scale: 0.8, below: true, opacity: 0.9 })]],
  hobbled: ['a wounding blow slows the creature, shown as a bleeding wound marker.', () => [A('Bleeding wound', ['markers.drop.red.01'], MK)]],
  bleeding: ['the disease makes the creature bleed uncontrollably.', () => [A('Uncontrolled bleeding', ['markers.drop.red.01', 'markers.drop.dark_green.01'], MK)]],
  staggered: ['a physical blow leaves the creature reeling.', () => [A('Reeling', ['dizzy_stars.200px.yellow', 'dizzy_stars.200px.blueorange'], { scale: 0.9, opacity: 0.85 })]],
  laughing: ['wracked by uncontrollable laughter.', () => [A('Fits of laughter', ['dizzy_stars.200px.pink', 'dizzy_stars.200px.blueorange'], { scale: 0.9, opacity: 0.85, ...tint('#ff9ad5') })]],
  armorDamaged: ['the target\'s armor is damaged and protects less, shown as a cracked shield.', () => [A('Damaged armor', ['markers.shield_cracked.dark_red.01', 'markers.shield_cracked.purple.01'], MK)]],
  sapped: ['strength is drained out of the target, dark strands pulling inward.', () => [A('Strength drained away', ['energy_strands.in.purple.01', 'energy_strands.in.green.01'], { scale: 1.3, opacity: 0.7, ...tint('#7b4fa8') })]],
  frostMark: ['cold numbs the limbs and slows movement, shown with a frost marker.', () => [A('Frost-numbed limbs', ['markers.snowflake.blue.01'], MK)]],
  iceEncased: ['the creature is frozen in place, encased in ice.', () => [A('Encased in ice', ['shield_themed.above.ice.01.blue'], { scale: 1.3, opacity: 0.85 })]],
  winter: ['winter magic around the wearer: gentle swirling snow.', () => [A('Swirling snow', ['sleet_storm.01.blue'], { scale: 1.4, below: true, opacity: 0.6 })]],
  petrifying: ['the flesh is hardening toward stone: grey grit converges on the body.', () => [A('Flesh hardening to stone', ['aura_themed.01.inward.loop.metal.01.grey'], { scale: 1.4, opacity: 0.75, ...tint('#a39a8c') })]],
  stoneSkin: ['skin hard as stone: a slow orbit of grey stone flakes.', () => [A('Stone-hard skin', ['aura_themed.01.orbit.loop.metal.01.grey'], { scale: 1.35, opacity: 0.6, ...tint('#a39a8c') })]],
  buried: ['buried under earth and rubble.', () => [A('Buried in rubble', ['falling_rocks.top.1x1.sandstone', 'falling_rocks.top.1x1.grey'], { scale: 1.1, opacity: 0.9 })]],
  tentacles: ['restrained by writhing black tentacles.', () => [A('Black tentacles grip', ['black_tentacles.dark_purple'], { scale: 0.9, below: true, opacity: 0.9 })]],
  whirlwindHold: ['restrained inside the whirlwind and carried with it.', () => [A('Spinning in the whirlwind', ['whirlwind.bluegrey', 'whirlwind.blue'], { scale: 1.25, opacity: 0.75 })]],
  sandstorm: ['a whirl of sand screens the creature against the attack.', () => [A('Whirling sand screen', ['whirlwind.bluegrey', 'whirlwind.blue'], { scale: 1.3, opacity: 0.7, ...tint('#d8b878') })]],
  spectralBonds: ['held fast by magical bonds.', () => [A('Spectral bonds', ['markers.chain.spectral_standard.loop.02.blue'], { scale: 1.65 })]],
  compelled: ['the creature\'s will is bound to obey, shown as spectral enchantment chains.', () => [A('Will bound by enchantment', ['markers.chain.spectral_standard.loop.02.purple', 'markers.chain.spectral_standard.loop.02.blue'], { scale: 1.65, ...tint('#b48cff') })]],
  chained: ['physically shackled.', () => [A('Shackled', ['markers.chain.standard.loop.02.grey', 'markers.chain.standard.loop.02.red'], { scale: 1.65, ...tint('#9aa0a8') })]],
  rope: ['bound by animated rope.', () => [A('Bound by rope', ['markers.chain.standard.loop.02.grey', 'markers.chain.standard.loop.02.red'], { scale: 1.65, ...tint('#c8a878') })]],
  trap: ['caught in the jaws of a hunting trap.', () => [A('Jaws of a trap', ['markers.chain.spike.loop.02.grey', 'markers.chain.standard.loop.02.red'], { scale: 1.65, ...tint('#9aa0a8') })]],
  plants: ['restrained by grasping plants and vines.', () => [A('Grasping plants', ['entangle.02.loop.02.green'], { scale: 1.3, opacity: 0.9 })]],
  engulfed: ['engulfed inside an ooze, restrained and suffocating.', () => [A('Engulfed in ooze', ['bubble.002.001.loop.greenyellow', 'bubble.002.001.loop.blue'], { scale: 1.35, opacity: 0.75, ...tint('#a6d96a') })]],
  swallowed: ['swallowed whole: blinded and restrained inside the creature.', () => [A('Inside the creature', ['bubble.002.001.loop.purplered', 'bubble.002.001.loop.blue'], { scale: 1.35, opacity: 0.75, ...tint('#8a3a4a') })]],
  insects: ['a cloud of biting insects harries the target.', () => [A('Biting insect cloud', ['fireflies.many.01.green'], { scale: 1.2, opacity: 0.75, ...tint('#7a7350') })]],
  bless: ['blessed: a soft golden blessing glows beneath the creature.', () => [A('Blessing', ['bless.200px.loop.yellow'], { scale: 1.3, below: true, opacity: 0.85 })]],
  ethereal: ['shifted into the Ethereal Plane: a faint ghostly veil.', () => [A('Ghostly ethereal veil', ['energy_strands.overlay.blue.01'], { scale: 1.4, opacity: 0.55 })]],
  shadowVeil: ['wrapped in shadow and hard to perceive.', () => [A('Wrapped in shadow', ['darkness.black'], { scale: 0.9, opacity: 0.4 })]],
  hidden: ['hiding: the creature keeps to the shadows (no magic).', () => [A('Keeping to the shadows', ['darkness.black'], { scale: 0.85, opacity: 0.3 })]],
  camouflage: ['elven camouflage: leaves drift around the wearer.', () => [A('Leaf-dappled camouflage', ['swirling_leaves.loop.02.green'], { scale: 1.2, opacity: 0.5 })]],
  trueSight: ['enhanced sight that sees things as they are, shown as watchful glowing eyes.', () => [A('Seeing truly', ['eyes.01.dark_yellow.single', 'eyes.01.dark_green.single'], { scale: 0.55, opacity: 0.85, ...tint('#ffd36b') })]],
  darkvision: ['sight in darkness, shown as glowing night-eyes.', () => [A('Night-eyes', ['eyes.01.dark_purple.single', 'eyes.01.dark_green.single'], { scale: 0.55, opacity: 0.8, ...tint('#9a7fd1') })]],
  devilSight: ['fiendish sight that pierces magical darkness.', () => [A('Devil\'s eyes', ['eyes.01.orangered.single', 'eyes.01.dark_green.single'], { scale: 0.55, opacity: 0.85, ...tint('#ff6a3d') })]],
  alert: ['instinctive, non-magical alertness, shown as watchful eyes.', () => [A('Watchful eyes', ['eyes.01.orangeyellow.single', 'eyes.01.dark_green.single'], { scale: 0.5, opacity: 0.6, ...tint('#e8c070') })]],
  divineSense: ['divine awareness of celestials, fiends and undead nearby.', () => [A('Divine awareness', ['detect_magic.circle.yellow', 'detect_magic.circle.blue'], { scale: 1.65, below: true, opacity: 0.7, ...tint('#ffe08a') })]],
  detectPoison: ['sensing poisons and disease nearby: a green divination pulse.', () => [A('Sensing poison and disease', ['detect_magic.circle.green', 'detect_magic.circle.blue'], { scale: 1.65, below: true, opacity: 0.75, ...tint('#8dd998') })]],
  mind: ['a telepathic or mind-reading link.', () => [A('Telepathic link', ['energy_strands.02.marker.bluepurple'], MK)]],
  tongues: ['magically understanding language: a divination glyph above the creature.', () => [A('Glyph of understanding', ['magic_signs.rune.divination.loop.blue'], { scale: 0.5, opacity: 0.85 })]],
  beastSpeech: ['speaking with beasts: a green divination glyph.', () => [A('Glyph of beast speech', ['magic_signs.rune.divination.loop.green', 'magic_signs.rune.divination.loop.blue'], { scale: 0.5, opacity: 0.85, ...tint('#7cc96b') })]],
  abyssal: ['the demon armor grants the Abyssal language: an infernal-red glyph.', () => [A('Abyssal glyph', ['magic_signs.rune.divination.loop.red', 'magic_signs.rune.divination.loop.blue'], { scale: 0.5, opacity: 0.85, ...tint('#d0453a') })]],
  foresight: ['seeing into the immediate future: a golden divination glyph.', () => [A('Glimpse of the future', ['magic_signs.rune.divination.loop.yellow', 'magic_signs.rune.divination.loop.blue'], { scale: 0.55, opacity: 0.85, ...tint('#ffd36b') })]],
  truth: ['enchanted so it cannot speak a deliberate lie.', () => [A('Glyph of truth', ['magic_signs.rune.enchantment.loop.yellow', 'magic_signs.rune.enchantment.loop.pink'], { scale: 0.5, opacity: 0.85, ...tint('#ffe08a') })]],
  mindWard: ['the mind is sealed against psychic intrusion and divination.', () => [A('Sealed mind', ['shield.02.loop.purple', 'shield.01.loop.blue'], { scale: 1.5, opacity: 0.8, ...tint('#b48cff') })]],
  mindMark: ['the caster always knows where the target is: a psychic mark.', () => [A('Psychic mark', ['hunters_mark.loop.01.purple', 'hunters_mark.loop.01.green'], { scale: 0.38, opacity: 0.9, offsetX: 0.3, offsetY: -0.3, offsetUnits: 'token', ...tint('#b48cff') })]],
  hunted: ['marked as an enemy or quarry.', () => [A('Marked as quarry', ['hunters_mark.loop.01.red', 'hunters_mark.loop.01.green'], { scale: 0.38, opacity: 0.9, offsetX: 0.3, offsetY: -0.3, offsetUnits: 'token', ...tint('#e0503c') })]],
  marked: ['the caster has insight into the target\'s defenses.', () => [A('Defenses laid bare', ['hunters_mark.loop.01.blue', 'hunters_mark.loop.01.green'], { scale: 0.38, opacity: 0.9, offsetX: 0.3, offsetY: -0.3, offsetUnits: 'token', ...tint('#8bbdf4') })]],
  hex: ['hexed: a violet curse sigil hangs over the target.', () => [A('Hex', ['condition.curse.01.001.purple', 'condition.curse.01.001.red'], { scale: 1.5, ...tint('#9a5fd1') })]],
  hypnotized: ['transfixed by a twisting pattern of colors.', () => [A('Hypnotic pattern', ['markers.circle_of_stars.orangepurple', 'markers.circle_of_stars.blue'], { scale: 0.8 })]],
  dance: ['compelled to dance comically in place.', () => [A('Irresistible dance', ['markers.music.purplepink', 'markers.music.greenorange'], MK)]],
  mocked: ['stung by a magically barbed insult.', () => [A('Mockery', ['markers.music_note.dark_red.01', 'markers.music_note.blue.01'], { ...MK, ...tint('#c0504d') })]],
  discord: ['bickering and incapable of meaningful communication.', () => [A('Discord', ['dizzy_stars.200px.red', 'dizzy_stars.200px.blueorange'], { scale: 0.9, ...tint('#e07a84') })]],
  feverishMind: ['a feverish mind that acts as if confused.', () => [A('Feverish confusion', ['dizzy_stars.200px.red', 'dizzy_stars.200px.blueorange'], { scale: 0.9, ...tint('#e07a84') })]],
  hopeless: ['overwhelmed with despair.', () => [A('Despair', ['markers.horror.purple.01'], MK)]],
  fearPurple: ['terrorized by phantasmal fears.', () => [A('Phantasmal terror', ['markers.fear.dark_purple.01'], MK)]],
  lovePink: ['charmed by a love potion.', () => [A('Infatuated', ['markers.heart.pink.01'], MK)]],
  sickened: ['sickened by the eyebite gaze.', () => [A('Sickened', ['markers.poison.purple.01', 'markers.poison.dark_green.01'], { ...MK, ...tint('#9a5fd1') })]],
  poisonMark: ['poisoned by a needle.', () => [A('Poisoned', ['markers.poison.dark_green.01'], MK)]],
  enlarge: ['growing a size larger.', () => [A('Swelling outward', ['extras.tmfx.outpulse.circle.01.normal'], { scale: 1.4, opacity: 0.6, ...tint('#c58cff') })]],
  reduce: ['shrinking a size smaller.', () => [A('Drawing inward', ['extras.tmfx.inpulse.circle.01.normal'], { scale: 1.2, opacity: 0.6, ...tint('#c58cff') })]],
  alterSelf: ['the body is magically reshaped.', () => [A('Reshaped body', ['shimmer.01.purple', 'shimmer.01.blue'], { scale: 1.5, opacity: 0.7, ...tint('#c58cff') })]],
  charisma: ['silver-tongued: a warm golden sparkle.', () => [A('Silver tongue', ['swirling_sparkles.01.yellow', 'swirling_sparkles.01.blue'], { scale: 1.4, opacity: 0.7, ...tint('#ffd36b') })]],
  mighty: ['great physical strength: the ground strains under the creature.', () => [A('Ground strains under its weight', ['ground_cracks.01.white', 'ground_cracks.01.orange'], { scale: 1.1, below: true, opacity: 0.55, ...tint('#8a7a66') })]],
  thunderMight: ['thunderous strength: a low rumble rolls off the wielder.', () => [A('Rumbling thunder', ['soundwave.01.blue'], { scale: 1.0, opacity: 0.55, ...tint('#b9cff5') })]],
  booming: ['the voice booms three times as loud.', () => [A('Booming voice', ['soundwave.02.orangeyellow', 'soundwave.02.blue'], { scale: 0.9, opacity: 0.6, ...tint('#ffd36b') })]],
  vibrations: ['imperceptible lethal vibrations linger in the target.', () => [A('Lethal vibrations', ['soundwave.01.purple', 'soundwave.01.blue'], { scale: 0.8, opacity: 0.5, ...tint('#b48cff') })]],
  hardy: ['tougher than most: a steady heartbeat (more hit points), no magic.', () => [A('Steady heartbeat', ['ui.heartbeat.01.red', 'ui.heartbeat.01.green'], { scale: 0.6, opacity: 0.75, ...tint('#e0503c') })]],
  stabilized: ['stabilized at 0 hit points: a faint but steady heartbeat.', () => [A('Faint steady heartbeat', ['ui.heartbeat.02.green'], { scale: 0.6, opacity: 0.8 })]],
  vitality: ['fortified vitality and extra hit points.', () => [A('Glowing vitality', ['healing_generic.loop.greenorange'], { scale: 1.0, opacity: 0.55 })]],
  martial: ['a martial weapon technique: a quick steel glint, no magic circle.', () => [A('Weapon glint', ['glint.blue.few', 'glint.yellow.few'], { scale: 0.8, opacity: 0.7, ...tint('#dfe7f0') })]],
  reckless: ['attacking recklessly: a fierce red glint of steel.', () => [A('Reckless glint', ['glint.blue.few', 'glint.yellow.few'], { scale: 0.8, opacity: 0.75, ...tint('#e05a4a') })]],
  knack: ['a practised skill or knack: a faint glint, no magic circle.', () => [A('Practised knack', ['glint.yellow.few'], { scale: 0.7, opacity: 0.5 })]],
  luck: ['a twinkle of good luck.', () => [A('Twinkle of luck', ['twinkling_stars.points05.white'], { scale: 0.6, opacity: 0.8, ...tint('#ffe08a') })]],
  starry: ['the robe\'s stars glitter around the wearer.', () => [A('Glittering stars', ['twinkling_stars.points06.white'], { scale: 1.0, opacity: 0.8 })]],
  celestial: ['a summoned celestial, marked with holy light.', () => [A('Celestial light', ['markers.light.loop.yellow', 'markers.light.loop.blue'], { ...MK, ...tint('#ffe08a') })]],
  feySummon: ['a summoned fey or woodland creature, wreathed in drifting leaves.', () => [A('Drifting leaves', ['swirling_leaves.loop.01.green'], { scale: 1.3, opacity: 0.6 })]],
  carriedFlame: ['a flame carried in hand, shedding light.', () => [A('Flame in hand', ['flames.01.orange'], { scale: 0.4, offsetX: 0.35, offsetY: 0.1, offsetUnits: 'token', opacity: 0.95 })]],
  carriedLight: ['a mote of brilliant radiance shines in the hand.', () => [A('Mote of radiance', ['markers.light_orb.loop.yellow', 'markers.light_orb.loop.blue'], { scale: 0.4, offsetX: 0.35, offsetY: 0.1, offsetUnits: 'token', ...tint('#ffe9a6') })]],
  shining: ['the target sheds light and cannot hide.', () => [A('Shedding light', ['markers.light.loop.yellow', 'markers.light.loop.blue'], { scale: 1.3, below: true, opacity: 0.7, ...tint('#fff0ab') })]],
  burning: ['the target is on fire.', () => [A('Burning', ['flames.01.orange'], { scale: 0.8, opacity: 0.85 })]],
  heatedMetal: ['carried metal glows red-hot.', () => [A('Red-hot metal', ['shield_themed.above.molten_earth.01.orange'], { scale: 1.3, opacity: 0.7 })]],
  acidBurn: ['acid clings to the target and burns again.', () => [A('Clinging acid', ['liquid.blob.green', 'liquid.blob.blue'], { scale: 0.8, opacity: 0.75, ...tint('#9fe07a') })]],
  shocked: ['a lingering electric shock prevents reactions.', () => [A('Lingering shock', ['static_electricity.01.blue'], { scale: 1.1, opacity: 0.85 })]],
  warmShield: ['wispy warm flames wreathe the body.', () => [A('Warm flames', ['shield_themed.above.fire.01.orange'], { scale: 1.35 })]],
  chillShield: ['wispy chill flames wreathe the body.', () => [A('Chill flames', ['shield_themed.above.ice.01.blue'], { scale: 1.35 })]],
  deathWard: ['warded against death by a protective star.', () => [A('Death ward', ['ward.star.yellow.01'], { scale: 1.4, below: true, opacity: 0.8 })]],
  sanctuary: ['warded against attack by a sanctuary rune.', () => [A('Sanctuary rune', ['ward.rune.yellow.01'], { scale: 1.4, below: true, opacity: 0.8 })]],
  holyWard: ['a holy ward against celestials, fiends, fey, elementals and undead.', () => [A('Holy ward', ['shield.02.loop.yellow', 'shield.01.loop.blue'], { scale: 1.55, opacity: 0.8, ...tint('#ffe9a6') })]],
  faithShield: ['a shimmering field of faith (+2 AC).', () => [A('Shield of faith', ['shield.01.loop.yellow', 'shield.01.loop.blue'], { scale: 1.65, ...tint('#fff0ab') })]],
  arcaneShield: ['the staff wards its wielder (+AC and saves).', () => [A('Arcane ward', ['shield.01.loop.blue'], { scale: 1.65 })]],
  brave: ['imbued with bravery, immune to fear.', () => [A('Bravery', ['condition.boon.01.001.yellow', 'condition.boon.01.001.green'], { scale: 1.6, ...tint('#ffd36b') })]],
  boon: ['a small divine boon to the next saving throw.', () => [A('Boon', ['condition.boon.01.001.green'], { scale: 1.6 })]],
  forceSphere: ['sealed inside a sphere of force.', () => [A('Sphere of force', ['wall_of_force.sphere.blue', 'wall_of_force.sphere.grey'], { scale: 1.3, opacity: 0.7 })]],
  forcePrison: ['trapped in a warded demiplane prison.', () => [A('Warded prison', ['energy_field.01.blue'], { scale: 1.65 })]],
  antiScry: ['hidden from divination magic: an abjuration rune circle.', () => [A('Abjuration against scrying', ['extras.tmfx.runes.circle.simple.abjuration'], { scale: 1.4, below: true, opacity: 0.55, ...tint('#9fb8ff') })]],
  natureWard: ['nature\'s ward: a slow orbit of leaves and seeds.', () => [A('Nature\'s ward', ['aura_themed.01.orbit.loop.nature.01.green'], { scale: 1.4, opacity: 0.75 })]],
  rage: ['raging: the same red battle aura as the barbarian\'s Rage.', () => [A('Rage', ['aura_themed.01.orbit.loop.metal.01.red', 'aura_themed.01.orbit.loop.metal.01.grey'], { scale: 1.85, ...tint('#ed859b') })]],
  strain: ['the strain of casting Wish saps strength and burns with each spell.', () => [A('Wish strain', ['energy_strands.overlay.dark_red.01', 'energy_strands.overlay.blue.01'], { scale: 1.5, opacity: 0.65, ...tint('#b0413e') })]],
  sunGlare: ['weakened in sunlight: harsh sun glare.', () => [A('Sun glare', ['glint.yellow.many'], { scale: 1.1, opacity: 0.7 })]],
  faerieFire: ['outlined in faerie light.', () => [A('Faerie fire', ['dancing_light.purplegreen'], { scale: 1.65 })]],
  goldBlind: ['struck blind and deaf by the divine word.', () => [A('Blinded by the divine word', ['markers.runes.yellow.01', 'markers.runes.orange.01'], { ...MK, ...tint('#ffe2a0') })]],
  goldDeaf: ['struck deaf by the divine word.', () => [A('Deafened by the divine word', ['markers.mute.dark_red.01'], { ...MK, ...tint('#ffe2a0') })]],
  sequestered: ['sequestered: invisible and hidden from divination, in suspended animation.', () => [A('Sequestered', ['markers.on_token_mask.loop.01.blue', 'markers.on_token_mask.loop.01.orange'], { ...MK, ...tint('#87d6ee') })]],
  invisible: ['Empty Body makes the monk invisible.', () => [A('Empty body', ['markers.on_token_mask.loop.01.purple', 'markers.on_token_mask.loop.01.orange'], { ...MK, ...tint('#8c7ab8') })]],
  slowRing: ['speed halved and actions restricted, like the Slow spell.', () => [A('Slowed', ['token_border.circle.static.dark_red.001', 'token_border.circle.static.blue.001'], { scale: 1.5, ...tint('#e07a84') })]],
};
const use = (look, name) => design(`${name}: ${LOOKS[look][0]}`, LOOKS[look][1]);

// Damage-type wards (resistance / protection). Lightning and thunder get a
// second faint layer so they read differently from a generic blue ward.
const RES = {
  acid: [['shield.01.loop.green', 'shield.01.loop.blue'], '#b8e580'],
  cold: [['shield_themed.above.ice.01.blue'], null],
  fire: [['shield_themed.above.fire.01.orange'], null],
  lightning: [['shield.01.loop.blue'], null, ['Crackling sparks', ['static_electricity.01.blue'], { scale: 1.2, opacity: 0.5 }]],
  thunder: [['shield.01.loop.blue'], '#b9cff5', ['Low rumble', ['soundwave.01.blue'], { scale: 1.1, opacity: 0.4, ...tint('#b9cff5') }]],
  necrotic: [['shield.01.loop.purple', 'shield.01.loop.blue'], '#9366bf'],
  force: [['shield.01.loop.purple', 'shield.01.loop.blue'], '#c9b8ff'],
  poison: [['shield.01.loop.green', 'shield.01.loop.blue'], '#8dd998'],
  psychic: [['shield.01.loop.red', 'shield.01.loop.blue'], '#e29be9'],
  radiant: [['shield.01.loop.yellow', 'shield.01.loop.blue'], '#fff0ab'],
  bludgeoning: [['shield.01.loop.white', 'shield.01.loop.blue'], '#d8bf8a'],
  piercing: [['shield.01.loop.white', 'shield.01.loop.blue'], '#d8bf8a'],
  slashing: [['shield.01.loop.white', 'shield.01.loop.blue'], '#d8bf8a'],
  fiend: [['shield.01.loop.red', 'shield.01.loop.blue'], '#c0504d'],
};
const res = (el, name) => design(`${name}: resistance to ${el === 'fiend' ? 'a chosen damage type, fiend-red' : el} damage, shown as a ${el === 'fiend' ? 'fiendish' : el}-themed ward.`, () => {
  const [assets, hex, extra] = RES[el];
  const shield = A(`${el[0].toUpperCase()}${el.slice(1)} ward`, assets, { scale: assets[0].startsWith('shield_themed') ? 1.35 : 1.65, ...(hex ? tint(hex) : {}) });
  return extra ? [shield, A(...extra)] : [shield];
});

// Ioun stones: the matching JB2A ioun stone orbits the head.
const ioun = (stone, name) => design(`${name}: the described ioun stone orbits the wearer's head.`, () => [
  A('Orbiting ioun stone', [`ioun_stones.01.${stone}`, `ioun_stones.01.${stone.replace(/^red\.agility$/, 'pink.agility')}`], { scale: 1.0, opacity: 0.95 }),
]);

export default {
  'dnd5e:dnd5e-spells-WTgRpzj4EQGJokA6-DGONTFbk5eORs5qv': use('tentacles', "Restrained by Black Tentacles"), // L13 Restrained by Black Tentacles (2014)
  'dnd5e:dnd5e-spells24-NDytclFrNmC418CS-phbsplEvardsBlac': use('tentacles', "Restrained"), // L14 Restrained (2024)
  'dnd5e:dnd5e-spells-8rP3gwmXVTgZqYZE-8dzaICjGy6mTUaUr': use('bless', "Bless"), // L15 Bless (2014)
  'dnd5e:dnd5e-spells24-1dzvDffEh8wZ0oQy-phbsplBless00000': use('bless', "Blessed"), // L16 Blessed (2024)
  'dnd5e:dnd5e-spells-KfxYKxbFoCe5HJYS-GSvLWcdCZLQkilXT': use('ethereal', "Blinked into the Ethereal Plane"), // L24 Blinked into the Ethereal Plane (2014)
  'dnd5e:dnd5e-spells24-La5ofK0TnPSTL3iq-phbsplBlink00000': use('ethereal', "Ethereal"), // L25 Ethereal (2024)
  'dnd5e:dnd5e-feats24-f6JofmGpxquX9bqb-phbBoonoftheNigh': use('shadowVeil', "Boon of the Night Spirit"), // L28 Boon of the Night Spirit (2024)
  'dnd5e:dnd5e-feats24-Zusz9sywPycPxb1N-phbBoonoftheNigh': use('shadowVeil', "Merged with Shadows"), // L29 Merged with Shadows (2024)
  'dnd5e:dnd5e-feats24-IY36CpEENqnz03c5-phbBoonofTruesig': use('trueSight', "Boon of Truesight"), // L30 Boon of Truesight (2024)
  'dnd5e:dnd5e-equipment24-gHyJQGFKkZJ2rbUe-dmgBootsOfElvenk': use('swiftMundane', "Boots of Elvenkind"), // L31 Boots of Elvenkind (2024)
  'dnd5e:dnd5e-equipment24-XP45fDHAojcVjDc0-dmgBootsOfSpeed0': use('swift', "Boots of Speed Active"), // L32 Boots of Speed Active (2024)
  'dnd5e:dnd5e-equipment24-XQcjU7ekeFYPMM2R-dmgBootsOfStridi': use('swift', "Unburdened Movement"), // L33 Unburdened Movement (2024)
  'dnd5e:dnd5e-items-ewBIkUaBn4meKsK5-hSY1b8yi8JWw2blf': use('swift', "Boots of Striding and Springing"), // L34 Boots of Striding and Springing (2014)
  'dnd5e:dnd5e-items-6PXhI0qCk64LuoXO-RDPFmUR9exTEXFc8': use('winter', "Boots of the Winterlands"), // L37 Boots of the Winterlands (2014)
  'dnd5e:dnd5e-monsterfeatures24-BCkl5LkP4M1bkVpt-mmBoulder0000000': use('prone', "Prone"), // L38 Prone (2024)
  'dnd5e:dnd5e-equipment24-qoOJIw0gTdN8DBKB-dmgBracersOfArch': use('martial', "Bow Proficiencies"), // L39 Bow Proficiencies (2024)
  'dnd5e:dnd5e-items-ChaLjlYldFzDgHHv-ZYEqOSY9BLZs2GPx': use('martial', "Bracers of Archery"), // L41 Bracers of Archery (2014)
  'dnd5e:dnd5e-equipment24-HT7JLnMCpfGKFxI2-dmgBroomOfFlying': use('flight', "Riding Broom (Low Weight)"), // L56 Riding Broom (Low Weight) (2024)
  'dnd5e:dnd5e-equipment24-UzcvESI8ovNwhIPz-dmgBroomOfFlying': use('flight', "Riding Broom (High Weight)"), // L57 Riding Broom (High Weight) (2024)
  'dnd5e:dnd5e-classes24-bg9jWpPRIJ0Q2vPY-phbbrbBrutalStri': use('hobbled', "Hamstrung"), // L58 Hamstrung (2024)
  'dnd5e:dnd5e-monsterfeatures24-ePppPvhLU1DnHySS-mmBurn0000000000': use('burning', "Burning"), // L59 Burning (2024)
  'dnd5e:dnd5e-equipment24-HsbtDDdiWhk4d7WB-phbagCaltrops000': use('caltrops', "Slowed"), // L65 Slowed (2024)
  'dnd5e:dnd5e-equipment24-HsbtDDdiWhk4d7WB-iYwrPPLmuVD9eqfa': use('caltrops', "Slowed"), // L66 Slowed (2024)
  'dnd5e:dnd5e-classes24-hr8wnlgs3uXphCnI-phbpdnChannelDiv': use('divineSense', "Divine Sense"), // L71 Divine Sense (2024)
  'dnd5e:dnd5e-equipment24-hyU6mHq6YNhLZlTY-dmgCloakOfElvenk': use('camouflage', "Cloak of Elvenkind"), // L81 Cloak of Elvenkind (2024)
  'dnd5e:dnd5e-equipment24-LOByj7F1KjZdSUMi-dmgCloakOfTheBat': use('bats', "Fly Speed"), // L85 Fly Speed (2024)
  'dnd5e:dnd5e-equipment24-OXkwPsxYwsIddeXY-dmgCloakOfTheMan': use('aquatic', "Aquatic Bonuses: Swimming and Breathing"), // L86 Aquatic Bonuses: Swimming and Breathing (2024)
  'dnd5e:dnd5e-monsterfeatures24-owuEyJBslYKvxqeX-mmCloudOfInsects': use('insects', "Clouded"), // L87 Clouded (2024)
  'dnd5e:dnd5e-spells-QLQX2Eg3yw7LZwKa-arzCrMRgcNiQuh43': use('compelled', "Command"), // L92 Command (2014)
  'dnd5e:dnd5e-spells-57Vv8uBIE8YRcDPc-4dSvfvTy2ZIJ3K4k': use('tongues', "Comprehend Languages"), // L93 Comprehend Languages (2014)
  'dnd5e:dnd5e-spells24-ANhwNb9xKRpWs4Q2-phbsplComprehend': use('tongues', "Comprehension"), // L94 Comprehension (2024)
  'dnd5e:dnd5e-spells-gG6gFVVIuoHKH4J9-P6f1PPKPd9BCb742': use('compelled', "Compulsion"), // L95 Compulsion (2014)
  'dnd5e:dnd5e-spells-sfKQeT5HoeUFiaBj-1Drt0SHxbEAHxprN': use('feySummon', "Conjured Animal"), // L100 Conjured Animal (2014)
  'dnd5e:dnd5e-spells-tnL6RVwXew6ete0r-XT7nzJmVGgv73uaf': use('celestial', "Summoned Celestial"), // L101 Summoned Celestial (2014)
  'dnd5e:dnd5e-spells-ERO8p9cfsc3Ifbii-1LkZvINag7KqBmDR': use('compelled', "Controlled Elemental"), // L102 Controlled Elemental (2014)
  'dnd5e:dnd5e-spells-2k0c8R6S9F6lQIpH-yN3XZZujhR4aVvPa': use('compelled', "Controlled Fey"), // L103 Controlled Fey (2014)
  'dnd5e:dnd5e-spells-4IJ3RAavRBuB52H9-dEfSELiY1eO3cpX9': use('feySummon', "Conjured Woodland Being"), // L106 Conjured Woodland Being (2014)
  'dnd5e:dnd5e-spells-CwXsi6Uf2CwXZsoe-8cPlf8sC5j7O6mTv': use('carriedFlame', "Flame Blade Illumination"), // L107 Flame Blade Illumination (2014)
  'dnd5e:dnd5e-spells-S3eSD4rmdbYajX2l-CjIq8Ed7bu3vVwT1': use('feverishMind', "Mindfire"), // L122 Mindfire (2014)
  'dnd5e:dnd5e-spells-nnfr2kBR5ByV6rdT-CjIq8Ed7bu3vVwT1': use('bleeding', "Slimy Doom"), // L124 Slimy Doom (2014)
  'dnd5e:dnd5e-spells-mGjF4d035590u5V0-MK6gpQMeDFo0cP9f': use('carriedFlame', "Wielding Continual Flame Object"), // L132 Wielding Continual Flame Object (2014)
  'dnd5e:dnd5e-spells-G5aZCiqtwSzf1PhW-7fFHlBk3UNX8gPKL': use('whirlpool', "Caught in Whirlpool"), // L133 Caught in Whirlpool (2014)
  'dnd5e:dnd5e-monsterfeatures24-cM3NSnDUlURCQP4q-mmCreateWhirlwin': use('whirlwindHold', "Restrained"), // L136 Restrained (2024)
  'dnd5e:dnd5e-classes24-YLfpwyCVUObRTopP-phbrgeCunningAct': use('hidden', "Hiding"), // L139 Hiding (2024)
  'dnd5e:dnd5e-classes24-La47n2N3VtECtnA9-phbrgeCunningStr': use('prone', "Cunning Strike: Tripped"), // L141 Cunning Strike: Tripped (2024)
  'dnd5e:dnd5e-classes24-lTOwmIJoE8GLm1oy-phbbrbDangerSens': use('alert', "Danger Sense"), // L144 Danger Sense (2024)
  'dnd5e:dnd5e-spells-9qaZQFN5xP8Gig8f-hJ6ZiA3fpoY8v9cp': use('darkvision', "Darkvision"), // L146 Darkvision (2014)
  'dnd5e:dnd5e-spells24-ZWNC1jxea2RuIRVc-phbsplDarkvision': use('darkvision', "Darkvision"), // L147 Darkvision (2024)
  'dnd5e:dnd5e-monsterfeatures24-6922OmgCjpz242Ib-mmDeadlyLeap0000': use('prone', "Prone"), // L149 Prone (2024)
  'dnd5e:dnd5e-spells-pTOjdHl8TyRdhRjl-VtCXMdyM6mAdIJZb': use('deathWard', "Death Ward"), // L150 Death Ward (2014)
  'dnd5e:dnd5e-spells24-mLUL8mRFsCzleR5d-phbsplDeathWard0': use('deathWard', "Protection from Death"), // L151 Protection from Death (2024)
  'dnd5e:dnd5e-equipment24-4l1ngEyNnOxpfTGs-dmgDefender00000': use('guard', "Transferred AC Bonus: 1"), // L152 Transferred AC Bonus: 1 (2024)
  'dnd5e:dnd5e-equipment24-jiyXZKFtvIRlZfh2-dmgDefender00000': use('guard', "Transferred AC Bonus: 2"), // L153 Transferred AC Bonus: 2 (2024)
  'dnd5e:dnd5e-equipment24-v3JBpJJorZfV3fXj-dmgDefender00000': use('guard', "Transferred AC Bonus: 3"), // L154 Transferred AC Bonus: 3 (2024)
  'dnd5e:dnd5e-classfeatures-U3so0zDcVt4sIBRz-zSlV0O2rQMdoq6pB': use('guard', "Fighting Style: Defense"), // L155 Fighting Style: Defense (2014)
  'dnd5e:dnd5e-feats24-W0ObItz7sS8ZJ09Y-phbfstDefense000': use('guard', "Defense"), // L156 Defense (2024)
  'dnd5e:dnd5e-classes24-oviiTMxQRTnne9oc-phbrgrDefensiveT': use('guard', "Multiattack Defense"), // L157 Multiattack Defense (2024)
  'dnd5e:dnd5e-equipment24-pcxBoqMaubd365yy-dmgDemonArmor000': use('abyssal', "Abyssal Language"), // L158 Abyssal Language (2024)
  'dnd5e:dnd5e-spells-sU0iSYHVDqfwDwMs-2skfDtglk1mGrb3l': use('detectPoison', "Detect Poison and Disease"), // L163 Detect Poison and Disease (2014)
  'dnd5e:dnd5e-spells24-zSS8rmsXm5JCaM5x-phbsplDetectPois': use('detectPoison', "Detect Poison and Disease"), // L164 Detect Poison and Disease (2024)
  'dnd5e:dnd5e-spells-4qY5z0im7iKXGiyt-ppWAAEul0QHtm4er': use('mind', "Cast"), // L165 Cast (2014)
  'dnd5e:dnd5e-classes24-Qfe7snyNHXLJHp4G-phbinvDevilsSigh': use('devilSight', "Devil's Sight"), // L166 Devil's Sight (2024)
  'dnd5e:dnd5e-classfeatures-3JYlSTG0olbm1FQC-3sN91lT1R3oxcDKd': use('devilSight', "Devil's Sight"), // L167 Devil's Sight (2014)
  'dnd5e:dnd5e-classes24-wWFV1p8u9C1TUPg5-phbrgeDeviousStr': use('staggered', "Devious Strikes: Dazed"), // L168 Devious Strikes: Dazed (2024)
  'dnd5e:dnd5e-classes24-C2IGgt4PnRMxZVey-phbrgeDeviousStr': use('sleep', "Devious Strikes: Knocked Out"), // L169 Devious Strikes: Knocked Out (2024)
  'dnd5e:dnd5e-classfeatures-v6jhyPoAYRIIXBG1-7D2EkLdISwShEDlN': use('guard', "Diamond Soul"), // L171 Diamond Soul (2014)
  'dnd5e:dnd5e-equipment24-JYlrfQOPp5jRIFK2-dmgDimensionalSh': use('chained', "Dimensionally Bound"), // L172 Dimensionally Bound (2024)
  'dnd5e:dnd5e-classes24-Js4phYMTL714onqn-phbmnkDiscipline': use('guard', "Disciplined Survivor"), // L173 Disciplined Survivor (2024)
  'dnd5e:dnd5e-spells24-RMeb9TUrFdhXMTzz-phbsplDispelEvil': use('holyWard', "Dispelling Evil and Good"), // L175 Dispelling Evil and Good (2024)
  'dnd5e:dnd5e-monsterfeatures24-qYzNNpsYbmdB2cg6-mmDissolvingPseu': use('armorDamaged', "Damaged: -1 AC"), // L176 Damaged: -1 AC (2024)
  'dnd5e:dnd5e-classes24-Mvzn4plDBs9fDfph-phbDivineOrderPr': use('guard', "Divine Order: Protector"), // L179 Divine Order: Protector (2024)
  'dnd5e:dnd5e-spells24-8O8KymREuOZFi45g-phbsplDivineWord': use('goldBlind', "Blinded, Deafened"), // L186 Blinded, Deafened (2024)
  'dnd5e:dnd5e-spells24-qZvAfjU2H6Fg6y6M-phbsplDivineWord': use('goldDeaf', "Deafened"), // L187 Deafened (2024)
  'dnd5e:dnd5e-equipment24-dJN7ArhjS5DHmArT-dmgDmtDonjon0000': use('forceSphere', "Donjon Card: Suspended Animation"), // L202 Donjon Card: Suspended Animation (2024)
  'dnd5e:dnd5e-origins24-waI4oHqhpbKUem0M-phbsptDraconicFl': use('flight', "Draconic Flight"), // L203 Draconic Flight (2024)
  'dnd5e:dnd5e-monsterfeatures24-XfAztVHPpKrgYrnD-mmDraconicOrigin': res('lightning', "Lightning Resistance"), // L208 Lightning Resistance (2024)
  'dnd5e:dnd5e-classes24-ZoJYjZ3KGM30khz3-phbscrDraconicRe': use('guard', "Draconic Resilience: Armor"), // L209 Draconic Resilience: Armor (2024)
  'dnd5e:dnd5e-classes24-vMrqtNbCcIgCcl1Q-phbscrDraconicRe': use('hardy', "Draconic Resilience: HP"), // L210 Draconic Resilience: HP (2024)
  'dnd5e:dnd5e-classfeatures-Pu89Tsgy2FJjYPQi-MW1ExvBLm8Hg82aA': use('hardy', "Draconic Resilience"), // L211 Draconic Resilience (2014)
  'dnd5e:dnd5e-equipment24-cPxO25ckNFWtuPOT-dmgDragonScaleMa': res('acid', "Black Scale"), // L213 Black Scale (2024)
  'dnd5e:dnd5e-equipment24-7pZPJW8286U9Tg7k-dmgDragonScaleMa': res('fire', "Gold Scale"), // L214 Gold Scale (2024)
  'dnd5e:dnd5e-equipment24-QZXLvBG314EsIM0W-dmgDragonScaleMa': res('lightning', "Blue Scale"), // L215 Blue Scale (2024)
  'dnd5e:dnd5e-equipment24-Dp2k2G8cSCRIb3bp-dmgDragonScaleMa': res('poison', "Green Scale"), // L216 Green Scale (2024)
  'dnd5e:dnd5e-equipment24-jn9U4aMx0EjCXD2Y-dmgDragonScaleMa': res('fire', "Brass Scale"), // L217 Brass Scale (2024)
  'dnd5e:dnd5e-equipment24-nPEOMehkECBedpCX-dmgDragonScaleMa': res('fire', "Red Scale"), // L218 Red Scale (2024)
  'dnd5e:dnd5e-equipment24-GDfu0ASHkIc3ZYpz-dmgDragonScaleMa': res('lightning', "Bronze Scale"), // L219 Bronze Scale (2024)
  'dnd5e:dnd5e-equipment24-wodSF9vN42I3xmPq-dmgDragonScaleMa': res('cold', "Silver Scale"), // L220 Silver Scale (2024)
  'dnd5e:dnd5e-equipment24-YCUy12OF1A6oWyEt-dmgDragonScaleMa': res('acid', "Copper Scale"), // L221 Copper Scale (2024)
  'dnd5e:dnd5e-equipment24-8Y80BGFPEux1Ifdz-dmgDragonScaleMa': res('cold', "White Scale"), // L222 White Scale (2024)
  'dnd5e:dnd5e-classes24-RZklxO114TnQQDyG-phbscrDragonWing': use('flight', "Winged"), // L223 Winged (2024)
  'dnd5e:dnd5e-monsterfeatures24-6AjyMN83LppkkgC3-mmDrainingSwipe0': use('sapped', "Hit: STR Score -1d4"), // L224 Hit: STR Score -1d4 (2024)
  'dnd5e:dnd5e-classfeatures-B5KM6oYsKC7vRMgG-hCop9uJrWhF1QPb4': use('martial', "Fighting Style: Dueling"), // L227 Fighting Style: Dueling (2014)
  'dnd5e:dnd5e-origins24-Na7W3p67eT9YqW87-phbsptDwarvenTou': use('hardy', "Dwarven Toughness"), // L230 Dwarven Toughness (2024)
  'dnd5e:dnd5e-races-uNu8nD32necK43bp-G7hkETvAYFLSLIVW': use('hardy', "Dwarven Toughness"), // L231 Dwarven Toughness (2014)
  'dnd5e:dnd5e-spells24-6UanNy7OTib1zFSq-phbsplEarthquake': use('buried', "Buried in Rubble"), // L235 Buried in Rubble (2024)
  'dnd5e:dnd5e-classes24-yiLpNgz92fezlhAG-phbinvEldritchMi': use('mind', "Eldritch Mind"), // L236 Eldritch Mind (2024)
  'dnd5e:dnd5e-classfeatures-4dvYtqvbQGDsVi51-3jwFt3hSqDswBlOH': use('invisible', "Ki: Empty Body"), // L237 Ki: Empty Body (2014)
  'dnd5e:dnd5e-equipment24-Yw1oocFffwM4cePn-dmgEnergyBow0000': use('spectralBonds', "Restrained (Arrow of Restraint)"), // L239 Restrained (Arrow of Restraint) (2024)
  'dnd5e:dnd5e-monsterfeatures24-vsa7d6xWOAvWdOWM-mmEngulf00000000': use('engulfed', "Total Cover, Suffocating & Restrained"), // L240 Total Cover, Suffocating & Restrained (2024)
  'dnd5e:dnd5e-spells-iVWIbqSzCYFAQzV6-WahI41a3goVUg0x1': use('enlarge', "Enlarged"), // L252 Enlarged (2014)
  'dnd5e:dnd5e-spells-rFRjXg3BjmTb5GOh-WahI41a3goVUg0x1': use('reduce', "Reduced"), // L253 Reduced (2014)
  'dnd5e:dnd5e-spells24-Wi2E10l7n6Ka8k6u-phbsplEnlargeRed': use('enlarge', "Enlarged"), // L254 Enlarged (2024)
  'dnd5e:dnd5e-spells24-NXdtOxX4HvPeodml-phbsplEnlargeRed': use('reduce', "Reduced"), // L255 Reduced (2024)
  'dnd5e:dnd5e-spells24-tFGMG3cjQTEeAhv2-phbsplEnsnaringS': use('plants', "Ensnared"), // L256 Ensnared (2024)
  'dnd5e:dnd5e-spells-fO14IutGR3Hrepun-gMrWeG8fMDPRFiVe': use('plants', "Entangle"), // L257 Entangle (2014)
  'dnd5e:dnd5e-spells24-wn7K2m4XhXhItgPT-phbsplEntangle00': use('plants', "Restrained"), // L258 Restrained (2024)
  'dnd5e:dnd5e-monsterfeatures24-bju3aUme0f8XYR3z-mmEntanglingRope': use('rope', "Restrained"), // L259 Restrained (2024)
  'dnd5e:dnd5e-spells-rrA8RYmv4eAuVbg8-PQuEgKyCdovOvhqN': use('ethereal', "Etherealness"), // L264 Etherealness (2014)
  'dnd5e:dnd5e-spells24-louTI4Z9bNUYBa8K-phbsplEtherealne': use('ethereal', "Etherealness"), // L265 Etherealness (2024)
  'dnd5e:dnd5e-spells-Tpa22WViLoIQHfDe-zPGohqJRir6MyQ3U': use('swift', "Expeditious Retreat"), // L267 Expeditious Retreat (2014)
  'dnd5e:dnd5e-spells-4aX9fGlauAQsLCAH-ZRqu3Xh9FmlBCZGy': use('sleep', "Eyebite: Slumber"), // L268 Eyebite: Slumber (2014)
  'dnd5e:dnd5e-spells-yBr3oIopzL8uDrPi-ZRqu3Xh9FmlBCZGy': use('sickened', "Eyebite: Sickened"), // L270 Eyebite: Sickened (2014)
  'dnd5e:dnd5e-spells24-5btX5iwwleMMzkvj-phbsplEyebite000': use('sleep', "Asleep"), // L271 Asleep (2024)
  'dnd5e:dnd5e-spells-4A91A48gBwBPPRwO-nqBDWkVOfcGZt4YU': use('faerieFire', "Faerie Fire"), // L274 Faerie Fire (2014)
  'dnd5e:dnd5e-spells24-Y2i0OvwOixxag0ed-phbsplFaerieFire': use('faerieFire', "Outlined"), // L275 Outlined (2024)
  'dnd5e:dnd5e-classes24-Ln2upWfCALSwthX1-phbbrbFastMoveme': use('swiftMundane', "Fast Movement"), // L278 Fast Movement (2024)
  'dnd5e:dnd5e-classfeatures-TIBmPKKnAAiWYuN4-Kl6zifJ5OmdHlOi2': use('swiftMundane', "Fast Movement"), // L279 Fast Movement (2014)
  'dnd5e:dnd5e-spells-gMdi8F2ylxkgG58U-pub0OWVEB71XQx1n': use('feathers', "Feather Fall"), // L283 Feather Fall (2014)
  'dnd5e:dnd5e-equipment24-xCyHeKeepXMk3KXZ-dmgFanQuaalsFeat': use('breeze', "Feather Token: Fan"), // L285 Feather Token: Fan (2024)
  'dnd5e:dnd5e-classes24-CaV1VYMaVjjPceJs-phbbrbFeralInsti': use('alert', "Feral Instinct"), // L287 Feral Instinct (2024)
  'dnd5e:dnd5e-classfeatures-q7TkJQX7PeVOzTQH-NlXslw4yAqmKZWtN': use('alert', "Feral Instinct"), // L288 Feral Instinct (2014)
  'dnd5e:dnd5e-classes24-ji48r1IGeRKQhpi9-phbrgrFeralSense': use('alert', "Feral Senses"), // L289 Feral Senses (2024)
  'dnd5e:dnd5e-classes24-JdULzod722VVpgZx-phbwlkFiendishRe': res('acid', "Fiendish Resilience: Acid"), // L291 Fiendish Resilience: Acid (2024)
  'dnd5e:dnd5e-classes24-JjA9Jda2qeK6Tpxk-phbwlkFiendishRe': res('bludgeoning', "Fiendish Resilience: Bludgeoning"), // L292 Fiendish Resilience: Bludgeoning (2024)
  'dnd5e:dnd5e-classes24-rhUc7IVz5XTphPRp-phbwlkFiendishRe': res('cold', "Fiendish Resilience: Cold"), // L293 Fiendish Resilience: Cold (2024)
  'dnd5e:dnd5e-classes24-GvzW5wzRBfjFqye7-phbwlkFiendishRe': res('fire', "Fiendish Resilience: Fire"), // L294 Fiendish Resilience: Fire (2024)
  'dnd5e:dnd5e-classes24-UZ00jXoUKfevQhxQ-phbwlkFiendishRe': res('lightning', "Fiendish Resilience: Lightning"), // L295 Fiendish Resilience: Lightning (2024)
  'dnd5e:dnd5e-classes24-iMBfFAs7UwqdgSI5-phbwlkFiendishRe': res('necrotic', "Fiendish Resilience: Necrotic"), // L296 Fiendish Resilience: Necrotic (2024)
  'dnd5e:dnd5e-classes24-G0Ed5szAi1vUFCf7-phbwlkFiendishRe': res('piercing', "Fiendish Resilience: Piercing"), // L297 Fiendish Resilience: Piercing (2024)
  'dnd5e:dnd5e-classes24-3Uw7a9ldJtxHam1x-phbwlkFiendishRe': res('poison', "Fiendish Resilience: Poison"), // L298 Fiendish Resilience: Poison (2024)
  'dnd5e:dnd5e-classes24-loTaIaBwUsMSzpdW-phbwlkFiendishRe': res('psychic', "Fiendish Resilience: Psychic"), // L299 Fiendish Resilience: Psychic (2024)
  'dnd5e:dnd5e-classes24-F8szMcfuxVxXJ7sf-phbwlkFiendishRe': res('radiant', "Fiendish Resilience: Radiant"), // L300 Fiendish Resilience: Radiant (2024)
  'dnd5e:dnd5e-classes24-7oATkYAfEZzx6F5P-phbwlkFiendishRe': res('slashing', "Fiendish Resilience: Slashing"), // L301 Fiendish Resilience: Slashing (2024)
  'dnd5e:dnd5e-classes24-6BHlD7hrfHUEfum5-phbwlkFiendishRe': res('thunder', "Fiendish Resilience: Thunder"), // L302 Fiendish Resilience: Thunder (2024)
  'dnd5e:dnd5e-classfeatures-reg3sjReHspgkd0I-9UZ2WjUF2k58CQug': res('fiend', "Fiendish Resilience"), // L303 Fiendish Resilience (2014)
  'dnd5e:dnd5e-spells24-SgNNVLaKxZOVKyKx-phbsplFindSteed0': use('flight', "Flying Steed"), // L306 Flying Steed (2024)
  'dnd5e:dnd5e-spells-lVKx8swB08jm6IFE-avD5XUtkBPQQR97c': use('warmShield', "Warm Shield"), // L310 Warm Shield (2014)
  'dnd5e:dnd5e-spells-UUXwEKSPX4nYfDzo-avD5XUtkBPQQR97c': use('chillShield', "Chill Shield"), // L311 Chill Shield (2014)
  'dnd5e:dnd5e-spells24-YbUr13GTnMrootmf-phbsplFireShield': use('warmShield', "Warm Shield"), // L312 Warm Shield (2024)
  'dnd5e:dnd5e-spells24-CMEUOmIT16kjGT5J-phbsplFireShield': use('chillShield', "Chill Shield"), // L313 Chill Shield (2024)
  'dnd5e:dnd5e-spells-vULxJuCFS32tApK7-Advtckpz1B733bu9': use('carriedFlame', "Flame Blade: 2nd Level"), // L314 Flame Blade: 2nd Level (2014)
  'dnd5e:dnd5e-spells-tpXf44S04mFJMol7-Advtckpz1B733bu9': use('carriedFlame', "Flame Blade: 4th Level"), // L315 Flame Blade: 4th Level (2014)
  'dnd5e:dnd5e-spells-BUBEz95PSksSQbVs-Advtckpz1B733bu9': use('carriedFlame', "Flame Blade: 6th Level"), // L316 Flame Blade: 6th Level (2014)
  'dnd5e:dnd5e-spells-9TTHVfcjufZowUOr-Advtckpz1B733bu9': use('carriedFlame', "Flame Blade: 8th Level"), // L317 Flame Blade: 8th Level (2014)
  'dnd5e:dnd5e-monsterfeatures24-ZjYcf64z7AHBBoj5-mmFlameWhip00000': use('prone', "Prone"), // L318 Prone (2024)
  'dnd5e:dnd5e-equipment24-UpR6gfUl5Qqjddq1-dmgDmtFlames0000': use('hunted', "Flames Card: Devilish Enmity"), // L319 Flames Card: Devilish Enmity (2024)
  'dnd5e:dnd5e-spells-mVqFBzC5qYpFnZFV-kozNy29b0X6exFhY': use('petrifying', "Flesh to Stone"), // L320 Flesh to Stone (2014)
  'dnd5e:dnd5e-spells-GlcVeHlxmWkdMTiP-kozNy29b0X6exFhY': use('petrifying', "Failed Flesh to Stone Save"), // L321 Failed Flesh to Stone Save (2014)
  'dnd5e:dnd5e-spells-W767OHpOwFKPPaCL-kozNy29b0X6exFhY': use('petrifying', "Successful Flesh to Stone Save"), // L322 Successful Flesh to Stone Save (2014)
  'dnd5e:dnd5e-spells24-Xt8AUh0PfYhGYBvY-phbsplFleshtoSto': use('petrifying', "Turning to Stone"), // L324 Turning to Stone (2024)
  'dnd5e:dnd5e-spells24-sFyjp6wt9bjyIl9W-phbsplFleshtoSto': use('petrifying', "Unable to Move"), // L325 Unable to Move (2024)
  'dnd5e:dnd5e-monsterfeatures24-UovyViBfR9aAlt0y-mmFling000000000': use('prone', "Prone"), // L326 Prone (2024)
  'dnd5e:dnd5e-spells-QscuTnvFFOf6QfJp-yfbK8gZqESlaoY5t': use('flight', "Fly"), // L327 Fly (2014)
  'dnd5e:dnd5e-spells24-EHFLuTHqI6cXn1zb-phbsplFly0000000': use('flight', "Flight"), // L328 Flight (2024)
  'dnd5e:dnd5e-spells-UTG8MneezBrTcBGo-6HEEhLdJz32TL4Js': use('foresight', "Foresight"), // L331 Foresight (2014)
  'dnd5e:dnd5e-spells24-P3m4C2ZVEsMzgb5q-phbsplForesight0': use('foresight', "Foresight"), // L332 Foresight (2024)
  'dnd5e:dnd5e-spells-OnWa3f4IQ3pneB5T-da0a1t2FqaTjRZGT': use('swift', "Freedom of Movement"), // L333 Freedom of Movement (2014)
  'dnd5e:dnd5e-spells24-bcTPZ6dJ4kHwaBRD-phbsplFreedomofM': use('swift', "Unrestricted Movement"), // L334 Unrestricted Movement (2024)
  'dnd5e:dnd5e-monsterfeatures24-B3otZdkyUcUlgrmk-mmFreeze00000000': use('frostMark', "Speed: -20 ft."), // L335 Speed: -20 ft. (2024)
  'dnd5e:dnd5e-monsterfeatures24-q6bYdkYCIAqlHO3d-mmFreezingBurst0': use('iceEncased', "0 ft. Speed"), // L336 0 ft. Speed (2024)
  'dnd5e:dnd5e-spells-N2YjmVRCv4gVvuk8-MImfWCzEPRMYD3Xp': use('iceEncased', "Frozen in Ice"), // L337 Frozen in Ice (2014)
  'dnd5e:dnd5e-spells24-JC3QmmHnM4YKj9ek-phbsplOtilukesFr': use('iceEncased', "Trapped in Ice"), // L338 Trapped in Ice (2024)
  'dnd5e:dnd5e-origins24-YHKgdj2KIbQRBZWW-phbsptFrostsChil': use('frostMark', "Chilled"), // L340 Chilled (2024)
  'dnd5e:dnd5e-spells-gICakgyAi1hrs8ug-2IWiZAJtOGDoKjiz': use('mist', "Gaseous Form"), // L341 Gaseous Form (2014)
  'dnd5e:dnd5e-spells24-QeYsfnjEj2T9A3C8-phbsplGaseousFor': use('mist', "Gaseous Form"), // L342 Gaseous Form (2024)
  'dnd5e:dnd5e-equipment24-8vCrPyrvsQ5MIxTJ-dmgGauntletsOfOg': use('mighty', "Ogre Strength"), // L343 Ogre Strength (2024)
  'dnd5e:dnd5e-items-m7FoXVGKT7C9X7aq-3TWT5bv3z5zGUZCe': use('mighty', "Gauntlets of Ogre Power"), // L344 Gauntlets of Ogre Power (2014)
  'dnd5e:dnd5e-spells-zSoZHHi7BA6IAeoj-JQyigMNPiDnGI18b': use('compelled', "Geas"), // L345 Geas (2014)
  'dnd5e:dnd5e-spells24-TXwfzpj9bERo0X1r-phbsplGeas000000': use('compelled', "Under Orders"), // L346 Under Orders (2024)
  'dnd5e:dnd5e-equipment24-z8fm5PbP5qz4iJuP-dmgGemOfSeeing00': use('trueSight', "Seeing"), // L348 Seeing (2024)
  'dnd5e:dnd5e-classes24-IEhxOF5rtwJ3xhOA-phbinvGiftoftheD': use('aquatic', "Water Breathing"), // L351 Water Breathing (2024)
  'dnd5e:dnd5e-monsterfeatures24-3W5EIHf9CRJQ3NyK-mmGigglingMagic0': use('laughing', "Giggling"), // L352 Giggling (2024)
  'dnd5e:dnd5e-spells-fDvXuZj3U8Lgi7t2-1RzxKZzkQOoioxPj': use('charisma', "Glib"), // L353 Glib (2014)
  'dnd5e:dnd5e-spells24-tWt9b1JlQpDYbhfj-phbsplGlibness00': use('charisma', "Glib"), // L354 Glib (2024)
  'dnd5e:dnd5e-equipment24-Nh870Ujh6Eqy0RFi-dmgGlovesOfSwimm': use('aquatic', "Gloves On"), // L355 Gloves On (2024)
  'dnd5e:dnd5e-items-GER4WeaEEvX545Rj-PRhtLbRLb9LjHZG7': use('aquatic', "Gloves of Swimming and Climbing"), // L356 Gloves of Swimming and Climbing (2014)
  'dnd5e:dnd5e-equipment24-6f8ARzOvPmhNZ0NV-dmgGlovesOfThiev': use('aquatic', "Gloves On"), // L357 Gloves On (2024)
  'dnd5e:dnd5e-origins24-KNWLGPsZSHtINp6L-phbsptGnomishCun': use('knack', "Gnomish Cunning"), // L358 Gnomish Cunning (2024)
  'dnd5e:dnd5e-equipment24-KB0ZoPGBRIrkXbHW-dmgGogglesOfNigh': use('darkvision', "Goggles On"), // L359 Goggles On (2024)
  'dnd5e:dnd5e-monsterfeatures24-dgfff9ONKHAUcthM-mmGore0000000000': use('prone', "Prone"), // L360 Prone (2024)
  'dnd5e:dnd5e-monsterfeatures24-cGogXX8DEY06laQN-mmGreatBow000000': use('hobbled', "Speed: -10 Ft."), // L363 Speed: -10 Ft. (2024)
  'dnd5e:dnd5e-origins24-HtNoV5usxEadPbqp-phbsptHalflingNi': use('swiftMundane', "Halfling Nimbleness"), // L387 Halfling Nimbleness (2024)
  'dnd5e:dnd5e-races-8oJGOvksocvoVzVE-PqxZgcJzp1VVgP8t': use('swiftMundane', "Halfling Nimbleness"), // L388 Halfling Nimbleness (2014)
  'dnd5e:dnd5e-spells-XrncWjwUV3gyGj0v-SLxA9QhrggTz0taU': use('holyWard', "Hallow Immunity"), // L389 Hallow Immunity (2014)
  'dnd5e:dnd5e-equipment24-dC3xorzL0AAgy7y1-dmgHammerOfThund': use('mighty', "Might of Giants"), // L391 Might of Giants (2024)
  'dnd5e:dnd5e-items-95tYhecAl2D69Gtv-wGDDt17DpBcXPuUD': use('thunderMight', "Hammer of Thunderbolts"), // L392 Hammer of Thunderbolts (2014)
  'dnd5e:dnd5e-monsterfeatures24-Jvy5UeJBi7Y0WmAp-mmHammerThrow000': use('staggered', "Disadv.: Attacks"), // L393 Disadv.: Attacks (2024)
  'dnd5e:dnd5e-spells-DEPrzDiNHOqKj4Hj-Szvk5FEVQW3uhJi5': use('haste', "Hastened"), // L394 Hastened (2014)
  'dnd5e:dnd5e-spells24-NEFWcyysYgsE6de3-phbsplHaste00000': use('haste', "Hasted"), // L395 Hasted (2024)
  'dnd5e:dnd5e-spells-UFaQd43rbMjowXA2-2yHXEcrRbadZDr5M': use('heatedMetal', "Heated Metal Object"), // L398 Heated Metal Object (2014)
  'dnd5e:dnd5e-spells-hPjQYP6nZM06WETE-2yHXEcrRbadZDr5M': use('heatedMetal', "Holding onto Heated Object"), // L399 Holding onto Heated Object (2014)
  'dnd5e:dnd5e-spells24-VVQbCUE5W44bF4QU-phbsplHeatMetal0': use('heatedMetal', "Heated Metal"), // L400 Heated Metal (2024)
  'dnd5e:dnd5e-equipment24-hFWmlSeGZKjnB2ZE-dmgHelmOfTelepat': use('mind', "Telepathy"), // L402 Telepathy (2024)
  'dnd5e:dnd5e-spells-9nCmXRaDKtOjPZVh-mgFqi0ev8f7Ut19y': use('vitality', "Heroes' Feast"), // L403 Heroes' Feast (2014)
  'dnd5e:dnd5e-spells24-wGsbKojtJs43Pjyx-phbsplHeroesFeas': use('vitality', "Feast's Benefits"), // L404 Feast's Benefits (2024)
  'dnd5e:dnd5e-spells-c4iy2EIj29eRA2qq-ge3Saet9zPTDyaoL': use('brave', "Heroism"), // L405 Heroism (2014)
  'dnd5e:dnd5e-spells24-zCpsdUyNz8bL3LF5-phbsplHeroism000': use('brave', "Bravery"), // L406 Bravery (2024)
  'dnd5e:dnd5e-spells24-ljMTBKPVmEnLPX1b-phbsplHex0000000': use('hex', "Hexed Strength"), // L407 Hexed Strength (2024)
  'dnd5e:dnd5e-spells24-Mmss2SPIy7wtt2PV-phbsplHex0000000': use('hex', "Hexed Dexterity"), // L408 Hexed Dexterity (2024)
  'dnd5e:dnd5e-spells24-XVQwGWbC0A1svBNm-phbsplHex0000000': use('hex', "Hexed Constitution"), // L409 Hexed Constitution (2024)
  'dnd5e:dnd5e-spells24-FfVB2Yyb7wfgpsQB-phbsplHex0000000': use('hex', "Hexed Intelligence"), // L410 Hexed Intelligence (2024)
  'dnd5e:dnd5e-spells24-k2569xtIeXKRReLU-phbsplHex0000000': use('hex', "Hexed Wisdom"), // L411 Hexed Wisdom (2024)
  'dnd5e:dnd5e-spells24-sC2IXWDs07oTt5JN-phbsplHex0000000': use('hex', "Hexed Charisma"), // L412 Hexed Charisma (2024)
  'dnd5e:dnd5e-classfeatures-7if4vIkT84Sw2zFm-r0unvWK0lPsDthDx': use('hidden', "Hide in Plain Sight"), // L413 Hide in Plain Sight (2014)
  'dnd5e:dnd5e-spells-58BFwcwzLrqeODxs-BQk5Row4NymMnUQl': use('laughing', "Hideous Laughter"), // L414 Hideous Laughter (2014)
  'dnd5e:dnd5e-spells24-5nrcjxzmy3FCLCkV-phbsplTashasHide': use('laughing', "Uncontrollable Laughter"), // L415 Uncontrollable Laughter (2024)
  'dnd5e:dnd5e-equipment24-AYtAkgcEHRws0Qeo-dmgHorseshoesOfA': use('swift', "Ignore Difficult Terrain"), // L429 Ignore Difficult Terrain (2024)
  'dnd5e:dnd5e-equipment24-9lS2LxCve4hPYGMn-dmgHorseshoesOfS': use('swift', "Faster"), // L430 Faster (2024)
  'dnd5e:dnd5e-equipment24-9jl46RZ5GOjs9QlJ-phbagHuntingTrap': use('trap', "Trapped"), // L433 Trapped (2024)
  'dnd5e:dnd5e-spells-SQnfuD2rHVcyLZ4j-6g3WLOZ2u0EbaLAd': use('hypnotized', "Hypnotic Pattern"), // L434 Hypnotic Pattern (2014)
  'dnd5e:dnd5e-spells24-mjAs8ssQlgp0AQOp-phbsplHypnoticPa': use('hypnotized', "Hypnotized"), // L435 Hypnotized (2024)
  'dnd5e:dnd5e-monsterfeatures24-273sG6C6R7qUcL2v-mmIceSpear000000': use('frostMark', "Speed -10"), // L436 Speed -10 (2024)
  'dnd5e:dnd5e-spells-X0R4qjZuKiddR6sh-ZVnL9L8v1KC9TBF4': use('buried', "Imprisonment: Buried"), // L437 Imprisonment: Buried (2014)
  'dnd5e:dnd5e-spells-Yde2VRHr9AOSVb5u-ZVnL9L8v1KC9TBF4': use('forceSphere', "Imprisonment: Minimum Containment"), // L440 Imprisonment: Minimum Containment (2014)
  'dnd5e:dnd5e-spells24-RCuPR9PN6DD1YDFc-phbsplImprisonme': use('buried', "Burial"), // L442 Burial (2024)
  'dnd5e:dnd5e-spells24-6P8mzDayeidhwod7-phbsplImprisonme': use('forcePrison', "Hedged Prison"), // L444 Hedged Prison (2024)
  'dnd5e:dnd5e-spells24-ApXXZFLy8fD2cWO0-phbsplImprisonme': use('forceSphere', "Minimus Containment"), // L445 Minimus Containment (2024)
  'dnd5e:dnd5e-spells24-R4BMRAXaadQwpvwk-phbsplImprisonme': use('sleep', "Slumber"), // L446 Slumber (2024)
  'dnd5e:dnd5e-classes24-L9N4evZo1jt46dap-phbbrbImpBrutalS': use('staggered', "Staggered"), // L447 Staggered (2024)
  'dnd5e:dnd5e-classes24-tUyuyTQGmpUqMcFe-phbbrbImpBrutalS': use('armorDamaged', "Sundered"), // L448 Sundered (2024)
  'dnd5e:dnd5e-classes24-fbCF0jqdt3NMZdkc-phbftrImprovedCr': use('martial', "Improved Critical"), // L449 Improved Critical (2024)
  'dnd5e:dnd5e-classes24-Ziuu5P6LoAvevtuN-phbinvInvestment': use('flight', "Investment of Flight"), // L455 Investment of Flight (2024)
  'dnd5e:dnd5e-classes24-VxM3FsirIcd3Of7q-phbinvInvestment': use('aquatic', "Investment of Swimming"), // L456 Investment of Swimming (2024)
  'dnd5e:dnd5e-classes24-chVfpaM9kmt2hOWW-phbinvInvestment': res('acid', "Resist Acid"), // L457 Resist Acid (2024)
  'dnd5e:dnd5e-classes24-SzrV0ZUdpHCl8ury-phbinvInvestment': res('bludgeoning', "Resist Bludgeoning"), // L458 Resist Bludgeoning (2024)
  'dnd5e:dnd5e-classes24-dNB2b7C34xZ8f1VC-phbinvInvestment': res('cold', "Resist Cold"), // L459 Resist Cold (2024)
  'dnd5e:dnd5e-classes24-J9HrAcFSX8Oiz5Os-phbinvInvestment': res('fire', "Resist Fire"), // L460 Resist Fire (2024)
  'dnd5e:dnd5e-classes24-931L7kMtCmfeKCke-phbinvInvestment': res('force', "Resist Force"), // L461 Resist Force (2024)
  'dnd5e:dnd5e-classes24-ftnhEVvBRxrbAfa3-phbinvInvestment': res('lightning', "Resist Lightning"), // L462 Resist Lightning (2024)
  'dnd5e:dnd5e-classes24-wNoq81xzNrVLdSGT-phbinvInvestment': res('necrotic', "Resist Necrotic"), // L463 Resist Necrotic (2024)
  'dnd5e:dnd5e-classes24-8tJH6UHt7riDLp1q-phbinvInvestment': res('piercing', "Resist Piercing"), // L464 Resist Piercing (2024)
  'dnd5e:dnd5e-classes24-W1jLBRVt0gryqFMJ-phbinvInvestment': res('poison', "Resist Poison"), // L465 Resist Poison (2024)
  'dnd5e:dnd5e-classes24-XYrQSl0kdJtV6Bf0-phbinvInvestment': res('psychic', "Resist Psychic"), // L466 Resist Psychic (2024)
  'dnd5e:dnd5e-classes24-hNA4gzQMT9cM2ALU-phbinvInvestment': res('radiant', "Resist Radiant"), // L467 Resist Radiant (2024)
  'dnd5e:dnd5e-classes24-QDl6CxMONYK8Kru1-phbinvInvestment': res('slashing', "Resist Slashing"), // L468 Resist Slashing (2024)
  'dnd5e:dnd5e-classes24-0vsrMfL3s6IQtWcM-phbinvInvestment': res('thunder', "Resist Thunder"), // L469 Resist Thunder (2024)
  'dnd5e:dnd5e-equipment24-89e4TT2q0PLRozOi-dmgAgilityIounSt': ioun('red.agility', "Enhanced Agility: Dexterity Bonus"), // L472 Enhanced Agility: Dexterity Bonus (2024)
  'dnd5e:dnd5e-items-f4ScI5hFiyWF5heN-Q4Iy6hqREsbk9yG7': ioun('red.agility', "Ioun Stone of Agility"), // L473 Ioun Stone of Agility (2014)
  'dnd5e:dnd5e-equipment24-P2rx8Fq56YpwQfSm-dmgAwarenessIoun': ioun('blue.awareness', "Enhanced Awareness: Initiative and Perception"), // L474 Enhanced Awareness: Initiative and Perception (2024)
  'dnd5e:dnd5e-equipment24-hOigjfupZtZR2cy9-dmgFortitudeIoun': ioun('pink.fortitude', "Enhance Fortitude: Constitution Bonus"), // L475 Enhance Fortitude: Constitution Bonus (2024)
  'dnd5e:dnd5e-items-FpwzPfzNKZokKZF4-ig5DOQtQYJPXJId4': ioun('pink.fortitude', "Ioun Stone of Fortitude"), // L476 Ioun Stone of Fortitude (2014)
  'dnd5e:dnd5e-equipment24-47SuTikkluIDzGhZ-dmgInsightIounSt': ioun('blue.insight', "Enhanced Insight: Wisdom Bonus"), // L477 Enhanced Insight: Wisdom Bonus (2024)
  'dnd5e:dnd5e-items-GDz8rS3R0TN0Pxhx-9jMQEm99q1ttAV1Q': ioun('blue.insight', "Ioun Stone of Insight"), // L478 Ioun Stone of Insight (2014)
  'dnd5e:dnd5e-equipment24-wPZxFH2R0HxRees5-dmgIntellectIoun': ioun('red.intellect', "Enhanced Intellect: Intelligence Bonus"), // L479 Enhanced Intellect: Intelligence Bonus (2024)
  'dnd5e:dnd5e-items-PM2UOAyd8Cy964mo-YeLz5OxRNxmvHJId': ioun('red.intellect', "Ioun Stone of Intellect"), // L480 Ioun Stone of Intellect (2014)
  'dnd5e:dnd5e-equipment24-DoQVfD1Ef0o1U8SP-dmgLeadershipIou': ioun('pink.leadership', "Enhanced Leadership: Charisma Bonus"), // L481 Enhanced Leadership: Charisma Bonus (2024)
  'dnd5e:dnd5e-items-3hbyQMgvW8GyQotV-hDF4RSCzMO8iI14x': ioun('pink.leadership', "Ioun Stone of Leadership"), // L482 Ioun Stone of Leadership (2014)
  'dnd5e:dnd5e-equipment24-hLntpSMVY7paNuaE-dmgMasteryIounSt': ioun('green.mastery', "Enhanced Mastery: Proficiency Bonus"), // L483 Enhanced Mastery: Proficiency Bonus (2024)
  'dnd5e:dnd5e-items-jNhlCgAz5EWLkZy6-nk2MH16KcZmKp7FQ': ioun('green.mastery', "Ioun Stone of Mastery"), // L484 Ioun Stone of Mastery (2014)
  'dnd5e:dnd5e-equipment24-DjgONYhHwEnVKjfF-dmgProtectionIou': ioun('pink.protection', "Enhanced Protection: +1 AC"), // L485 Enhanced Protection: +1 AC (2024)
  'dnd5e:dnd5e-items-GWrRc9Yfqt7N24I6-v4uNbmiz4ECTI89n': ioun('pink.protection', "Ioun Stone of Protection"), // L486 Ioun Stone of Protection (2014)
  'dnd5e:dnd5e-equipment24-AvjFlc6qmwT82JXZ-dmgStrengthIounS': ioun('blue.strength', "Enhanced Strength: Strength Bonus"), // L487 Enhanced Strength: Strength Bonus (2024)
  'dnd5e:dnd5e-items-plffDmuTOIrXAJDb-0G5LSgbb5NTV4XC7': ioun('blue.strength', "Ioun Stone of Strength"), // L488 Ioun Stone of Strength (2014)
  'dnd5e:dnd5e-equipment24-4zVHEbOxu2Q1yP06-dmgSustenanceIou': ioun('white.sustenance', "Sustained"), // L489 Sustained (2024)
  'dnd5e:dnd5e-spells-xkNK7kGzkmyftFlx-TfRzwEgBHHkCc6Ql': use('dance', "Irresistible Dance"), // L492 Irresistible Dance (2014)
  'dnd5e:dnd5e-spells24-MpToumiJ2o3S16K7-phbsplOttosIrres': use('dance', "Irresistible Dance"), // L493 Irresistible Dance (2024)
  'dnd5e:dnd5e-spells24-UhFtBDEZEDpVgz9G-phbsplOttosIrres': use('dance', "Short Dance"), // L494 Short Dance (2024)
  'dnd5e:dnd5e-classes24-c7gWn9MMrBQb8ygm-phbbrdJackOfAllT': use('knack', "Jack of All Trades"), // L495 Jack of All Trades (2024)
  'dnd5e:dnd5e-classfeatures-K4xQzXl1Z4zMnyOa-ezWijmCnlnQ9ZRX2': use('knack', "Jack of All Trades"), // L496 Jack of All Trades (2014)
  'dnd5e:dnd5e-spells-8ikEvNdNDRE9VJss-ZrTc23tToJ0JpH2h': use('swift', "Jump"), // L497 Jump (2014)
  'dnd5e:dnd5e-spells24-Esyd01OZ3NCv8gtp-phbsplJump000000': use('swift', "Jump"), // L498 Jump (2024)
  'dnd5e:dnd5e-origins24-QI7POclNlvX9a8VD-phbsptLargeForm0': use('mighty', "Large Form"), // L499 Large Form (2024)
  'dnd5e:dnd5e-spells-pEY6ZwxlbDrRPp6h-MRxldJd6C4bsBo3O': use('levitate', "Levitating"), // L500 Levitating (2014)
  'dnd5e:dnd5e-spells24-axhLHcJQHprSpHRD-phbsplLevitate00': use('levitate', "Levitating"), // L501 Levitating (2024)
  'dnd5e:dnd5e-monsterfeatures24-PFledLQkQ75osOlZ-mmLoathsomeLimbs': use('exhausted', "Exhaustion 1"), // L502 Exhaustion 1 (2024)
  'dnd5e:dnd5e-monsterfeatures24-AVZPkC07GONXpRMe-mmLoathsomeLimbs': use('exhausted', "Exhaustion 2"), // L503 Exhaustion 2 (2024)
  'dnd5e:dnd5e-monsterfeatures24-l1PiPpfAiF9TWs88-mmLoathsomeLimbs': use('exhausted', "Exhaustion 3"), // L504 Exhaustion 3 (2024)
  'dnd5e:dnd5e-monsterfeatures24-DCB7xWKhKSEmZHNn-mmLoathsomeLimbs': use('exhausted', "Exhaustion 4"), // L505 Exhaustion 4 (2024)
  'dnd5e:dnd5e-monsterfeatures24-9Tc60NhDJH43WdEU-mmLoathsomeLimbs': use('exhausted', "Exhaustion 5"), // L506 Exhaustion 5 (2024)
  'dnd5e:dnd5e-monsterfeatures24-drQriWAwmwosemzp-mmLoathsomeLimbs': use('dead', "Exhaustion Dead"), // L507 Exhaustion Dead (2024)
  'dnd5e:dnd5e-spells-hfN31FqOkSYoQVz3-B0pnIcc52O6G8hi8': use('swift', "Longstrider"), // L508 Longstrider (2014)
  'dnd5e:dnd5e-spells24-I746neZVrgJFkRco-phbsplLongstride': use('swift', "Longstrider"), // L509 Longstrider (2024)
  'dnd5e:dnd5e-origins24-k1FDpZEBCHzRsFSA-phbsptLuck000000': use('luck', "Luck"), // L510 Luck (2024)
  'dnd5e:dnd5e-races-uG46N3C6WoFQmW0W-LOMdcNAGWh5xpfm4': use('luck', "Lucky"), // L512 Lucky (2014)
  'dnd5e:dnd5e-spells-3UZLcyUKG7zz2VdP-y8A4HfTwd93ypdEz': use('holyWard', "Magic Circle Protection"), // L518 Magic Circle Protection (2014)
  'dnd5e:dnd5e-equipment24-hKJK8c3uwhFNdn5m-phbagManacles000': use('chained', "Manacled"), // L524 Manacled (2024)
  'dnd5e:dnd5e-spells-s8TC1UrCgjeBdf78-5OGFdJw35QXp6mh6': use('compelled', "Mass Suggestion: 6th Level"), // L529 Mass Suggestion: 6th Level (2014)
  'dnd5e:dnd5e-spells-8zdxyPjy2ubw9zER-5OGFdJw35QXp6mh6': use('compelled', "Mass Suggestion: 7th Level"), // L530 Mass Suggestion: 7th Level (2014)
  'dnd5e:dnd5e-spells-BGqCb71GgI0jO1zt-5OGFdJw35QXp6mh6': use('compelled', "Mass Suggestion: 8th Level"), // L531 Mass Suggestion: 8th Level (2014)
  'dnd5e:dnd5e-spells-kyGswuqopTTebwTU-5OGFdJw35QXp6mh6': use('compelled', "Mass Suggestion: 9th Level"), // L532 Mass Suggestion: 9th Level (2014)
  'dnd5e:dnd5e-classes24-6SL9vuAkx7nAfS5D-phbinvMasterofMy': use('aquatic', "Aquatic Adaptation"), // L534 Aquatic Adaptation (2024)
  'dnd5e:dnd5e-classes24-1jrUeJtfZMGhJOZa-phbinvMasterofMy': use('alterSelf', "Altered Appearance"), // L535 Altered Appearance (2024)
  'dnd5e:dnd5e-classes24-baEBDez6IgWNpkSX-phbinvMasterofMy': use('alterSelf', "Natural Weapon"), // L536 Natural Weapon (2024)
  'dnd5e:dnd5e-spells-3N4KDb8gLlbu1KUC-bllEWfm9xfEKynhv': use('mindWard', "Mind Blank"), // L540 Mind Blank (2014)
  'dnd5e:dnd5e-spells24-po9iJIqq4OqhvMw0-phbsplMindBlank0': use('mindWard', "Mind Blanked"), // L541 Mind Blanked (2024)
  'dnd5e:dnd5e-spells24-AbNgTsT2gRxwmBpg-phbsplMindSpike0': use('mindMark', "Spiked"), // L542 Spiked (2024)
  'dnd5e:dnd5e-classes24-Y9LOXK6Q4vot2cxi-phbbrbMindlessRa': use('rage', "Mindless Rage"), // L544 Mindless Rage (2024)
  'dnd5e:dnd5e-classes24-UYHRNxrU74xiUJAy-phbmnkMonksFocus': use('guard', "Patient Defense (Focus Point)"), // L557 Patient Defense (Focus Point) (2024)
  'dnd5e:dnd5e-classes24-92bFICMzRpJmnO56-phbmnkMonksFocus': use('swiftMundane', "Disengaged"), // L558 Disengaged (2024)
  'dnd5e:dnd5e-classes24-h0xW0mOYF8frKgHf-phbdrdNaturesSan': res('fire', "Nature's Ward: Arid"), // L560 Nature's Ward: Arid (2024)
  'dnd5e:dnd5e-classes24-7YVMASgXswIFXNs2-phbdrdNaturesSan': res('cold', "Nature's Ward: Polar"), // L561 Nature's Ward: Polar (2024)
  'dnd5e:dnd5e-classes24-Gqgjm2NswU6f7qVL-phbdrdNaturesSan': res('lightning', "Nature's Ward: Temperate"), // L562 Nature's Ward: Temperate (2024)
  'dnd5e:dnd5e-classes24-LKxwXqkEIXJR2XAa-phbdrdNaturesSan': res('poison', "Nature's Ward: Tropical"), // L563 Nature's Ward: Tropical (2024)
  'dnd5e:dnd5e-classes24-WWAuOh7qyAZgchmL-phbdrdNaturesWar': use('natureWard', "Nature's Ward"), // L565 Nature's Ward (2024)
  'dnd5e:dnd5e-classes24-J6hYOcVvZlLKuWab-phbdrdNaturesWar': res('fire', "Nature's Ward: Arid"), // L566 Nature's Ward: Arid (2024)
  'dnd5e:dnd5e-classes24-XLIRgAYPO1ARo5pb-phbdrdNaturesWar': res('cold', "Nature's Ward: Polar"), // L567 Nature's Ward: Polar (2024)
  'dnd5e:dnd5e-classes24-yruAlaBCduO8AcnU-phbdrdNaturesWar': res('lightning', "Nature's Ward: Temperate"), // L568 Nature's Ward: Temperate (2024)
  'dnd5e:dnd5e-classes24-lDVYGRNqqw3HwcKM-phbdrdNaturesWar': res('poison', "Nature's Ward: Tropical"), // L569 Nature's Ward: Tropical (2024)
  'dnd5e:dnd5e-classfeatures-Jxpz4MZmgTy7z7cm-OTvrJSJSUgAwXrWX': use('natureWard', "Nature's Ward"), // L570 Nature's Ward (2014)
  'dnd5e:dnd5e-monsterfeatures24-Di6rSDXgFkxAGsFE-mmNightmare00000': use('sleep', "Unconscious"), // L572 Unconscious (2024)
  'dnd5e:dnd5e-monsterfeatures24-7U7Pe61lsMZgN7qh-mmNimbleEscape00': use('hidden', "Apply Hide Action to Target"), // L574 Apply Hide Action to Target (2024)
  'dnd5e:dnd5e-spells-VcHisfZtWwBeEBCP-aU62xVUBYkAQWIHv': use('antiScry', "Nondetection"), // L575 Nondetection (2014)
  'dnd5e:dnd5e-spells24-usz9yzOPHV4Nb93D-phbsplNondetecti': use('antiScry', "Hidden from Divination"), // L576 Hidden from Divination (2024)
  'dnd5e:dnd5e-monsterfeatures24-TSWsGeApnMgxOyIF-mmNoxiousMiasma0': use('armorDamaged', "Damaged: −2 AC"), // L577 Damaged: −2 AC (2024)
  'dnd5e:dnd5e-equipment24-EWoLqkPJeK9dwYhn-dmgOathbow000000': use('hunted', "Sworn Enemy"), // L578 Sworn Enemy (2024)
  'dnd5e:dnd5e-equipment24-YIlD33DO4Py9aaRi-dmgOilOfEthereal': use('ethereal', "Etherealness"), // L580 Etherealness (2024)
  'dnd5e:dnd5e-items-LajiYiJL7B2TZLUZ-Xbq8CyXSRV358SfP': use('ethereal', "Etherealness"), // L581 Etherealness (2014)
  'dnd5e:dnd5e-monsterfeatures24-Nqpxg74Yw9uEVMxQ-mmOozeCube000000': use('engulfed', "Total Cover"), // L586 Total Cover (2024)
  'dnd5e:dnd5e-classes24-uQ474o5Wsv3sEAJK-phbmnkOpenHandTe': use('staggered', "Addled"), // L587 Addled (2024)
  'dnd5e:dnd5e-classes24-E1A8QE6kPsLgqTAP-phbmnkOpenHandTe': use('prone', "Toppled"), // L588 Toppled (2024)
  'dnd5e:dnd5e-classes24-Esyd01OZ3NCv8gtp-phbinvOtherworld': use('swift', "Jump"), // L589 Jump (2024)
  'dnd5e:dnd5e-spells-yXrjsSvXaxXXzsU2-pRMvmknwLf2tdMTj': use('shadowVeil', "Pass without Trace"), // L595 Pass without Trace (2014)
  'dnd5e:dnd5e-spells24-MDdoug4Lfu8klZRO-phbsplPasswithou': use('shadowVeil', "Concealed"), // L596 Concealed (2024)
  'dnd5e:dnd5e-equipment24-4gvBhVBKAHuIetno-dmgPeriaptOfProo': res('poison', "Protected Against Poison"), // L597 Protected Against Poison (2024)
  'dnd5e:dnd5e-monsterfeatures24-9dBgxzdq0cmzyhfR-mmPetrifyingBite': use('petrifying', "Restrained"), // L598 Restrained (2024)
  'dnd5e:dnd5e-monsterfeatures24-SY6t8UAImw8B9PVT-mmPetrifyingBrea': use('petrifying', "Restrained"), // L601 Restrained (2024)
  'dnd5e:dnd5e-monsterfeatures24-a5kKgU7vfT0v17yF-mmPetrifyingGaze': use('petrifying', "Restrained"), // L602 Restrained (2024)
  'dnd5e:dnd5e-spells24-4k92Sjfpcm5bnguO-phbsplPhantasmal': use('fearPurple', "Fears Manifested"), // L611 Fears Manifested (2024)
  'dnd5e:dnd5e-items-VGNePB21bqJfLsCr-63nb14yQRJMc4bIn': use('lovePink', "Alchemical Love"), // L614 Alchemical Love (2014)
  'dnd5e:dnd5e-spells-emSe7CIQnxueDNgP-42O2aNBW7vK90gTL': use('compelled', "Planar Binding: 5th Level"), // L617 Planar Binding: 5th Level (2014)
  'dnd5e:dnd5e-spells-8NkyrHOtbVWMguA8-42O2aNBW7vK90gTL': use('compelled', "Planar Binding: 6th Level"), // L618 Planar Binding: 6th Level (2014)
  'dnd5e:dnd5e-spells-S8lln6FqpREPWcFV-42O2aNBW7vK90gTL': use('compelled', "Planar Binding: 7th Level"), // L619 Planar Binding: 7th Level (2014)
  'dnd5e:dnd5e-spells-J92s3ByKs6NaOktF-42O2aNBW7vK90gTL': use('compelled', "Planar Binding: 8th Level"), // L620 Planar Binding: 8th Level (2014)
  'dnd5e:dnd5e-spells-L76gMWDkyMqNzklM-42O2aNBW7vK90gTL': use('compelled', "Planar Binding: 9th Level"), // L621 Planar Binding: 9th Level (2014)
  'dnd5e:dnd5e-spells24-L72Zv8oIomBPthq7-phbsplPlanarBind': use('compelled', "Bound to Service"), // L622 Bound to Service (2024)
  'dnd5e:dnd5e-equipment24-waWQ0QcVncE6pU5B-dmgPoisonedNeedl': use('poisonMark', "Poisoned Needle"), // L623 Poisoned Needle (2024)
  'dnd5e:dnd5e-items-6sChAuK0HObortfE-HY8duCwmvlXOruTG': use('reduce', "Alchemically Reduced"), // L633 Alchemically Reduced (2014)
  'dnd5e:dnd5e-equipment24-GIybtF2qEmtPCOZj-dmgPotionOfFlyin': use('flight', "Flyer"), // L636 Flyer (2024)
  'dnd5e:dnd5e-items-UumpsHK33ePtvz3s-eTNc8XPtvZNe3yQs': use('flight', "Alchemical Flight"), // L637 Alchemical Flight (2014)
  'dnd5e:dnd5e-items-SffmmlIyQEG7jM0r-bqZ6NTLDCUB98YjV': use('mist', "Gaseous Form"), // L640 Gaseous Form (2014)
  'dnd5e:dnd5e-items-HAuNLWE4FAG5lpup-gTRFQLdVD1gsKtPi': use('enlarge', "Alchemically Enlarged"), // L647 Alchemically Enlarged (2014)
  'dnd5e:dnd5e-equipment24-dHNT1jBXfvYuNH16-dmgPotionOfHeroi': use('bless', "Blessed"), // L648 Blessed (2024)
  'dnd5e:dnd5e-items-KKcIKvHCHET79fEp-wNKYbKYwOHbA7SH8': use('bless', "Blessed"), // L649 Blessed (2014)
  'dnd5e:dnd5e-items-o5uwUilyOmZKavPX-8MPnSrvEeZhPhtTi': res('lightning', "Lightning Resistance"), // L654 Lightning Resistance (2014)
  'dnd5e:dnd5e-items-sGtB63gv4o99IFMT-Ct9LR9Ft1FG4a6Y1': use('mind', "Alchemical Mind Reading"), // L655 Alchemical Mind Reading (2014)
  'dnd5e:dnd5e-equipment24-ZPdhGzt0bhaZyVd2-dmgPotionOfResis': res('lightning', "Lightning Resistance"), // L665 Lightning Resistance (2024)
  'dnd5e:dnd5e-equipment24-hSarjVpqNwhqKOB1-dmgPotionOfResis': res('thunder', "Thunder Resistance"), // L670 Thunder Resistance (2024)
  'dnd5e:dnd5e-items-PXMOx6wnEh05eAKY-ctKfjHjk9gs9UtZI': use('haste', "Hastened"), // L671 Hastened (2014)
  'dnd5e:dnd5e-items-QlQh25ywP4LsgKtg-zBX8LLC2CjC89Dzl': res('thunder', "Thunder Resistance"), // L674 Thunder Resistance (2014)
  'dnd5e:dnd5e-equipment24-FuzyfcWOcC3IXsDB-dmgPotionOfWater': use('aquatic', "Water Breather"), // L676 Water Breather (2024)
  'dnd5e:dnd5e-items-YfuBxNfhlPfQX8Ua-CAZMwFBWp9VC0ZCg': use('aquatic', "Alchemical Water Breathing"), // L677 Alchemical Water Breathing (2014)
  'dnd5e:dnd5e-spells24-B5dLPDfw1fDtfRW1-phbsplPowerWordS': use('spectralBonds', "No Movement"), // L680 No Movement (2024)
  'dnd5e:dnd5e-origins24-ge1u3EIFvsoj3jZu-phbsptPowerfulBu': use('mighty', "Powerful Build"), // L681 Powerful Build (2024)
  'dnd5e:dnd5e-classes24-ufbJRsGGW3REMmJm-phbbrbPrimalKnow': use('knack', "Primal Knowledge"), // L683 Primal Knowledge (2024)
  'dnd5e:dnd5e-classes24-IqjrvuQ2ORv65hxB-phbPrimalOrderMa': use('knack', "Magician"), // L684 Magician (2024)
  'dnd5e:dnd5e-classes24-j6MsESItx2TEvDju-phbPrimalOrderWa': use('guard', "Primal Order: Warden"), // L685 Primal Order: Warden (2024)
  'dnd5e:dnd5e-spells-6bNxvdxYMSZK9N0A-eGMhwmuleAM46C6L': use('petrifying', "Prismatic Spray (indigo)"), // L686 Prismatic Spray (indigo) (2014)
  'dnd5e:dnd5e-spells-KhVHkGeHijwInogC-eGMhwmuleAM46C6L': use('petrifying', "Failed Petrification Save"), // L688 Failed Petrification Save (2014)
  'dnd5e:dnd5e-spells-fLn8u0YSR14RNskW-eGMhwmuleAM46C6L': use('petrifying', "Successful Petrification Save"), // L689 Successful Petrification Save (2014)
  'dnd5e:dnd5e-spells24-cCQh7iXKnT8PKmc1-phbsplPrismaticS': use('petrifying', "Petrifying (Indigo)"), // L691 Petrifying (Indigo) (2024)
  'dnd5e:dnd5e-spells-XnYc2CO3kl73Rxr9-jmfu8zj4zjjzUbeh': use('petrifying', "Failed Petrification Save"), // L693 Failed Petrification Save (2014)
  'dnd5e:dnd5e-spells-0lcdF9sc0cBgnvBg-jmfu8zj4zjjzUbeh': use('petrifying', "Successful Petrification Save"), // L694 Successful Petrification Save (2014)
  'dnd5e:dnd5e-spells24-CbAuJQPoOViKebWs-phbsplPrismaticW': use('petrifying', "Restrained (Indigo)"), // L697 Restrained (Indigo) (2024)
  'dnd5e:dnd5e-spells-e0Ibmfgv8aTzvxiE-j8NtLXOOJ3GAKF8I': res('acid', "Protection from Acid"), // L700 Protection from Acid (2014)
  'dnd5e:dnd5e-spells-u8CWVEZ9xQXeg7EU-j8NtLXOOJ3GAKF8I': res('cold', "Protection from Cold"), // L701 Protection from Cold (2014)
  'dnd5e:dnd5e-spells-Md45M3QzPeWi5GsR-j8NtLXOOJ3GAKF8I': res('fire', "Protection from Fire"), // L702 Protection from Fire (2014)
  'dnd5e:dnd5e-spells-mpQ2ucBu1e2zw56V-j8NtLXOOJ3GAKF8I': res('lightning', "Protection from Lightning"), // L703 Protection from Lightning (2014)
  'dnd5e:dnd5e-spells-Bi9lRQMuk1qVlWes-j8NtLXOOJ3GAKF8I': res('thunder', "Protection from Thunder"), // L704 Protection from Thunder (2014)
  'dnd5e:dnd5e-spells24-RrJ5b1A9TghFe5QK-phbProtectionFro': res('acid', "Acid Protection"), // L705 Acid Protection (2024)
  'dnd5e:dnd5e-spells24-xDm8bqlMGiPq7nlt-phbProtectionFro': res('cold', "Cold Protection"), // L706 Cold Protection (2024)
  'dnd5e:dnd5e-spells24-DsflUNYKqETaLgxG-phbProtectionFro': res('fire', "Fire Protection"), // L707 Fire Protection (2024)
  'dnd5e:dnd5e-spells24-0ODEqmz3M45lwd8q-phbProtectionFro': res('lightning', "Lightning Protection"), // L708 Lightning Protection (2024)
  'dnd5e:dnd5e-spells24-M13rFIPjAIMwKzQp-phbProtectionFro': res('thunder', "Thunder Protection"), // L709 Thunder Protection (2024)
  'dnd5e:dnd5e-spells-6AM7tNmtE61BDJpv-xmDBqZhRVrtLP8h2': use('holyWard', "Protection from Evil and Good"), // L710 Protection from Evil and Good (2014)
  'dnd5e:dnd5e-spells24-0WW6DMPuabIZh1Tv-phbEvilAndGoodPr': use('holyWard', "Protected"), // L711 Protected (2024)
  'dnd5e:dnd5e-spells-dNSELIYDQMBopj0Z-MAxM77CDUu8dgIRQ': res('poison', "Protection from Poison"), // L712 Protection from Poison (2014)
  'dnd5e:dnd5e-spells24-zTci2V6Iij0r0IIg-phbsplProtection': res('poison', "Poison Protection"), // L713 Poison Protection (2024)
  'dnd5e:dnd5e-classes24-GnIJc9uI54mfAQz8-phbmnkQuiveringP': use('vibrations', "Lethal Vibrations"), // L715 Lethal Vibrations (2024)
  'dnd5e:dnd5e-monsterfeatures24-HUmtXTzr92ZaAvf3-mmRam00000000000': use('prone', "Prone"), // L724 Prone (2024)
  'dnd5e:dnd5e-spells-HaoKvppKfss4ajTS-ODhLKBxLnvvLOnw1': use('sapped', "Enfeebled"), // L725 Enfeebled (2014)
  'dnd5e:dnd5e-spells24-yril8uhQgO1dR507-phbsplRayofEnfee': use('sapped', "Brief Enfeeblement"), // L726 Brief Enfeeblement (2024)
  'dnd5e:dnd5e-spells24-uaHZaHEalgWa6eoC-phbsplRayofEnfee': use('sapped', "Enervated"), // L727 Enervated (2024)
  'dnd5e:dnd5e-spells-ZlBjKmRbz1cyezIt-ctW81uiX56xZR2c5': use('frostMark', "Chilled"), // L728 Chilled (2014)
  'dnd5e:dnd5e-spells24-7dnnwBMWLykrVJub-phbsplRayofFrost': use('frostMark', "Reduced Movement"), // L729 Reduced Movement (2024)
  'dnd5e:dnd5e-classes24-XA0GhXVB54U2IuRP-phbbrbRecklessAt': use('reckless', "Reckless"), // L731 Reckless (2024)
  'dnd5e:dnd5e-classes24-TIw25thHBYEPdKR1-phbrgeReliableTa': use('knack', "Reliable Talent"), // L734 Reliable Talent (2024)
  'dnd5e:dnd5e-classfeatures-vMMZHZQ0qT7MT4I4-YN9xm6MCvse4Y60u': use('knack', "Reliable Talent"), // L735 Reliable Talent (2014)
  'dnd5e:dnd5e-classes24-1f8R9CFfhsetkhF5-phbftrRemarkable': use('knack', "Remarkable Athlete"), // L736 Remarkable Athlete (2024)
  'dnd5e:dnd5e-monsterfeatures24-HG9R2hTEqJ0G5urK-mmRepulsionBreat': use('prone', "Prone"), // L737 Prone (2024)
  'dnd5e:dnd5e-spells-tMUWOKD27zNJgv99-1ADstb0Xec6HHRcU': use('forceSphere', "Encased in Resilient Sphere"), // L738 Encased in Resilient Sphere (2014)
  'dnd5e:dnd5e-spells24-U5UciD171a5jcc7s-phbsplOtilukesRe': use('forceSphere', "Enclosed in Sphere"), // L739 Enclosed in Sphere (2024)
  'dnd5e:dnd5e-spells-cK52KOkDDsZveNI2-dl8YwvMboBqX2OC4': use('boon', "Resistance"), // L740 Resistance (2014)
  'dnd5e:dnd5e-spells24-u2mf5JowVgwqCARq-phbsplResistance': res('acid', "Acid Protection"), // L741 Acid Protection (2024)
  'dnd5e:dnd5e-spells24-XYOXUUgKLjXXGt9W-phbsplResistance': res('bludgeoning', "Bludgeoning Protection"), // L742 Bludgeoning Protection (2024)
  'dnd5e:dnd5e-spells24-Wpc5zvXyw2FSCJSD-phbsplResistance': res('cold', "Cold Protection"), // L743 Cold Protection (2024)
  'dnd5e:dnd5e-spells24-S7XVvtgRT8uEP1iw-phbsplResistance': res('fire', "Fire Protection"), // L744 Fire Protection (2024)
  'dnd5e:dnd5e-spells24-E8jlVJoTlfjKcz1r-phbsplResistance': res('lightning', "Lightning Protection"), // L745 Lightning Protection (2024)
  'dnd5e:dnd5e-spells24-2TZhhhCDUC2pqqNg-phbsplResistance': res('necrotic', "Necrotic Protection"), // L746 Necrotic Protection (2024)
  'dnd5e:dnd5e-spells24-iR95ZjBkbXXD3Ena-phbsplResistance': res('piercing', "Piercing Protection"), // L747 Piercing Protection (2024)
  'dnd5e:dnd5e-spells24-KZdzty5DTXdpGukZ-phbsplResistance': res('poison', "Poison Protection"), // L748 Poison Protection (2024)
  'dnd5e:dnd5e-spells24-9EhogBhAM9yIoREK-phbsplResistance': res('radiant', "Radiant Protection"), // L749 Radiant Protection (2024)
  'dnd5e:dnd5e-spells24-sBrdZmXfn33LhYwh-phbsplResistance': res('slashing', "Slashing Protection"), // L750 Slashing Protection (2024)
  'dnd5e:dnd5e-spells24-jP1TZyrEYtskdWXf-phbsplResistance': res('thunder', "Thunder Protection"), // L751 Thunder Protection (2024)
  'dnd5e:dnd5e-equipment24-4dTBPTD5GinKr7kC-dmgRingOfFreeAct': use('swift', "Free Action"), // L764 Free Action (2024)
  'dnd5e:dnd5e-items-1IBWPMloNPjXPnTo-XJ8CG4UvLELCmOi2': res('lightning', "Lightning Resistance"), // L766 Lightning Resistance (2014)
  'dnd5e:dnd5e-equipment24-MNeyPXbTgvHvBZe5-dmgRingOfResista': res('lightning', "Lightning Resistance"), // L777 Lightning Resistance (2024)
  'dnd5e:dnd5e-equipment24-1154actymx6hAYXS-dmgRingOfResista': res('thunder', "Thunder Resistance"), // L782 Thunder Resistance (2024)
  'dnd5e:dnd5e-equipment24-o9qVDiEL3u8S742k-dmgRingOfSwimmin': use('aquatic', "Swimmer"), // L783 Swimmer (2024)
  'dnd5e:dnd5e-items-Shw1dARwswVkzUYD-aA7MbjnpHYoYvmuW': use('aquatic', "Swimming"), // L784 Swimming (2014)
  'dnd5e:dnd5e-items-BuDRWmDb8IbiCjLs-IpBBqr0r7JanyVn0': res('thunder', "Thunder Resistance"), // L785 Thunder Resistance (2014)
  'dnd5e:dnd5e-items-ww5XGi3vgzt77IJs-2veAOEyfbDJuxR8Y': res('cold', "Warmth"), // L786 Warmth (2014)
  'dnd5e:dnd5e-equipment24-vj2uuYo0TMWWXExd-dmgRingOfXrayVis': use('trueSight', "X-Ray Vision"), // L788 X-Ray Vision (2024)
  'dnd5e:dnd5e-monsterfeatures24-cIB1rKGRZwYjMwJn-mmRiposte0000000': use('guard', "+3 AC"), // L789 +3 AC (2024)
  'dnd5e:dnd5e-monsterfeatures24-UUPAry5ZunpEnKkn-mmRoar0000000000': use('prone', "Prone"), // L792 Prone (2024)
  'dnd5e:dnd5e-equipment24-XYTd1ck6pd7NhWs7-dmgRobeOfEyes000': use('trueSight', "Special Senses"), // L793 Special Senses (2024)
  'dnd5e:dnd5e-equipment24-pRyM6fY5UQ1QiSpV-dmgRobeOfStars00': use('starry', "Robe of Stars"), // L795 Robe of Stars (2024)
  'dnd5e:dnd5e-monsterfeatures24-fdpMlJbmkKQfJlME-mmRockLaunch0000': use('prone', "Prone"), // L799 Prone (2024)
  'dnd5e:dnd5e-equipment24-qwsSkmGQOC4YLbCy-dmgDmtRogue00000': use('hunted', "Rogue Card: Hostility"), // L804 Rogue Card: Hostility (2024)
  'dnd5e:dnd5e-equipment24-sYzIZOD83JG2W6wh-dmgRopeOfEntangl': use('rope', "Entangled"), // L805 Entangled (2024)
  'dnd5e:dnd5e-classes24-J9RWCSmYGnP0fkn1-phbrgrRoving0000': use('swiftMundane', "Roving"), // L807 Roving (2024)
  'dnd5e:dnd5e-spells-DxExOr8qiUQ1RQbF-gvdA9nPuWLck4tBl': use('sanctuary', "Sanctuary"), // L808 Sanctuary (2014)
  'dnd5e:dnd5e-spells24-OuM8iKhckcDKavOx-phbSanctuary0000': use('sanctuary', "Warded"), // L809 Warded (2024)
  'dnd5e:dnd5e-races-HGtTN5utBdoMs37f-0kUsT4sMUOr5FcoX': use('martial', "Savage Attacks"), // L810 Savage Attacks (2014)
  'dnd5e:dnd5e-spells24-A0tTvLeRetrC708K-phbsplSearingSmi': use('burning', "Seared"), // L815 Seared (2024)
  'dnd5e:dnd5e-classes24-qPdh1z9RMd6oBcoj-phbrgeSecondstor': use('swiftMundane', "Second-Story Work"), // L816 Second-Story Work (2024)
  'dnd5e:dnd5e-spells-3omf4AjcV8DOMCgO-DQzlB5Y3k791W5bH': use('trueSight', "See Invisibility"), // L817 See Invisibility (2014)
  'dnd5e:dnd5e-spells24-BRwB0T8buWhJAuDx-phbsplSeeInvisib': use('trueSight', "See Invisibility"), // L818 See Invisibility (2024)
  'dnd5e:dnd5e-spells-zqdAKeHbYiGinR9k-wvLbtemkH8gyBpdc': use('sequestered', "Sequestered"), // L822 Sequestered (2014)
  'dnd5e:dnd5e-monsterfeatures24-tlJPRZtTipMsmBRa-mmShieldBash0000': use('prone', "Prone"), // L827 Prone (2024)
  'dnd5e:dnd5e-spells-FKDbXBUs6VJlf8ZY-jZ6JNykRtdQ90MOo': use('faithShield', "Shield of Faith"), // L828 Shield of Faith (2014)
  'dnd5e:dnd5e-spells24-LObm7lj1VH4fF1Al-phbsplShieldofFa': use('faithShield', "Shimmering Field"), // L829 Shimmering Field (2024)
  'dnd5e:dnd5e-equipment24-TNWNbk14uUGiJGvv-dmgShieldOfTheCa': use('prone', "Knocked Down"), // L830 Knocked Down (2024)
  'dnd5e:dnd5e-spells24-pBjrcT286iCAQrjm-phbsplShiningSmi': use('shining', "Shining"), // L832 Shining (2024)
  'dnd5e:dnd5e-spells-nmcuBi3UW1cZJqut-XvbiNhNqXXIFisIy': use('shocked', "Shocking Grasp"), // L833 Shocking Grasp (2014)
  'dnd5e:dnd5e-spells24-DQCAm67ck1GEKHtE-phbsplShockingGr': use('shocked', "Shocked"), // L834 Shocked (2024)
  'dnd5e:dnd5e-spells-MowBnXpRu2aG48i9-KhwiSi9fwVfUPtku': use('sleep', "Sleep"), // L837 Sleep (2014)
  'dnd5e:dnd5e-spells24-04Wa4xUzjA31kPno-phbsplSleep00000': use('sleep', "Sleeping"), // L838 Sleeping (2024)
  'dnd5e:dnd5e-monsterfeatures24-eiPsvHBjVi4pRHqJ-mmSleepBreath000': use('sleep', "Unconscious"), // L840 Unconscious (2024)
  'dnd5e:dnd5e-monsterfeatures24-ztGUDHGfoUxlUY53-mmSlowingBreath0': use('slowRing', "1/2 Speed | Action Restrictions"), // L843 1/2 Speed | Action Restrictions (2024)
  'dnd5e:dnd5e-classes24-EyWEQv8qPwbXyDmA-phbpdnSmiteOfPro': use('holyWard', "Smite of Protection"), // L844 Smite of Protection (2024)
  'dnd5e:dnd5e-spells24-4werkFeLTqFwHRIa-phbsplSparetheDy': use('stabilized', "Stabilized"), // L846 Stabilized (2024)
  'dnd5e:dnd5e-spells-5y2fw4tIHJG90LhP-aL1F8fvYLtNzUbKu': use('beastSpeech', "Speak with Animals"), // L847 Speak with Animals (2014)
  'dnd5e:dnd5e-spells24-lHx55SIuimKR3ALR-phbsplSpeakwithA': use('beastSpeech', "Bestial Communication"), // L848 Bestial Communication (2024)
  'dnd5e:dnd5e-equipment24-zEQTKqd3uBj660cR-dmgLolthsSting00': use('sleep', "Unconscious"), // L853 Unconscious (2024)
  'dnd5e:dnd5e-equipment24-ufvqeQlTyGeTjKYq-dmgStaffOfPower0': use('arcaneShield', "Staff of Power"), // L860 Staff of Power (2024)
  'dnd5e:dnd5e-spells24-T9kBIL7LS3j0Upwz-phbsplStarryWisp': use('shining', "Illuminated"), // L869 Illuminated (2024)
  'dnd5e:dnd5e-equipment24-FqUhrsOwuBjoJjwK-dmgStoneOfGoodLu': use('luck', "Lucky"), // L873 Lucky (2024)
  'dnd5e:dnd5e-items-TghMVbmFnR0t0AoP-296Zgo9RhltWShE1': use('luck', "Stone of Good Luck"), // L874 Stone of Good Luck (2014)
  'dnd5e:dnd5e-origins24-SAbuNo2AO3XXtkdv-phbsptStonecunni': use('knack', "Stonecunning"), // L875 Stonecunning (2024)
  'dnd5e:dnd5e-spells-cSVCA9h5OEo5lfBE-ReMbjfeOKoSj3O79': use('stoneSkin', "Stoneskin"), // L876 Stoneskin (2014)
  'dnd5e:dnd5e-spells24-DbTCk1h0u86Etlpr-phbsplStoneskin0': use('stoneSkin', "Stoneskin"), // L877 Stoneskin (2024)
  'dnd5e:dnd5e-monsterfeatures24-UXwZ02kqy96aH3dZ-mmStormBolt00000': use('prone', "Prone"), // L878 Prone (2024)
  'dnd5e:dnd5e-spells-ODGIMpaADKrhr2Ib-zMAWdyc8UVb37BK4': use('compelled', "Suggested"), // L885 Suggested (2014)
  'dnd5e:dnd5e-equipment24-enZ79fOzsta0vlqK-dmgDmtSun0000000': use('vitality', "Sun Card: Daily Temp HP"), // L887 Sun Card: Daily Temp HP (2024)
  'dnd5e:dnd5e-spells-kWBi1D1UMm4XsLgt-2RC0EyvBLPH88PZF': use('carriedLight', "Sunbeam"), // L888 Sunbeam (2014)
  'dnd5e:dnd5e-classes24-kKOE6KCEE0v4a5lw-phbftrSuperiorCr': use('martial', "Superior Critical"), // L893 Superior Critical (2024)
  'dnd5e:dnd5e-classes24-zAtnsWRpAcTIkjpz-phbmnkSuperiorDe': use('guard', "Superior Defense"), // L894 Superior Defense (2024)
  'dnd5e:dnd5e-classes24-jZGIulxQFLY7uRDe-phbrgrSuperiorDe': res('acid', "Hunter's Defense: Acid"), // L895 Hunter's Defense: Acid (2024)
  'dnd5e:dnd5e-classes24-HybTLXiZgGa3t61e-phbrgrSuperiorDe': res('bludgeoning', "Hunter's Defense: Bludgeoning"), // L896 Hunter's Defense: Bludgeoning (2024)
  'dnd5e:dnd5e-classes24-6z5fLOHiOiHHcuac-phbrgrSuperiorDe': res('cold', "Hunter's Defense: Cold"), // L897 Hunter's Defense: Cold (2024)
  'dnd5e:dnd5e-classes24-DW6JJBsbBtR1Z75R-phbrgrSuperiorDe': res('fire', "Hunter's Defense: Fire"), // L898 Hunter's Defense: Fire (2024)
  'dnd5e:dnd5e-classes24-2kTlaPSpacxduIm7-phbrgrSuperiorDe': res('force', "Hunter's Defense: Force"), // L899 Hunter's Defense: Force (2024)
  'dnd5e:dnd5e-classes24-5ZizSWuVy8cy77K1-phbrgrSuperiorDe': res('lightning', "Hunter's Defense: Lightning"), // L900 Hunter's Defense: Lightning (2024)
  'dnd5e:dnd5e-classes24-fcFLysPw4llFTQsg-phbrgrSuperiorDe': res('necrotic', "Hunter's Defense: Necrotic"), // L901 Hunter's Defense: Necrotic (2024)
  'dnd5e:dnd5e-classes24-8Uf0Dw8A3l7CI8Fd-phbrgrSuperiorDe': res('piercing', "Hunter's Defense: Piercing"), // L902 Hunter's Defense: Piercing (2024)
  'dnd5e:dnd5e-classes24-PpWYucbhugNEIBJ7-phbrgrSuperiorDe': res('poison', "Hunter's Defense: Poison"), // L903 Hunter's Defense: Poison (2024)
  'dnd5e:dnd5e-classes24-BbvC3rh4RDmi06XI-phbrgrSuperiorDe': res('psychic', "Hunter's Defense: Psychic"), // L904 Hunter's Defense: Psychic (2024)
  'dnd5e:dnd5e-classes24-IFg9ae4ZyhMDPa3m-phbrgrSuperiorDe': res('radiant', "Hunter's Defense: Radiant"), // L905 Hunter's Defense: Radiant (2024)
  'dnd5e:dnd5e-classes24-30KWef6vBjF8RChr-phbrgrSuperiorDe': res('slashing', "Hunter's Defense: Slashing"), // L906 Hunter's Defense: Slashing (2024)
  'dnd5e:dnd5e-classes24-P7YUT6Y1NXGpo5Er-phbrgrSuperiorDe': res('thunder', "Hunter's Defense: Thunder"), // L907 Hunter's Defense: Thunder (2024)
  'dnd5e:dnd5e-monsterfeatures24-VOHv1LyO3hHolZXo-mmSwallow0000000': use('swallowed', "Blinded, Restrained, and Total Cover"), // L908 Blinded, Restrained, and Total Cover (2024)
  'dnd5e:dnd5e-monsterfeatures24-aS5FyMP72vn3OKf1-mmSwallow0000000': use('prone', "Prone"), // L909 Prone (2024)
  'dnd5e:dnd5e-monsterfeatures24-WJe5ci1Tiu0hQCb8-mmSwarmOfGraspin': use('prone', "Prone"), // L910 Prone (2024)
  'dnd5e:dnd5e-spells-wBljD0GOI2rgOZgm-B2kbmgbA2WQR00kx': use('discord', "Discord"), // L912 Discord (2014)
  'dnd5e:dnd5e-spells-1jUvUPVKQ2x66y0d-B2kbmgbA2WQR00kx': use('hopeless', "Hopelessness"), // L914 Hopelessness (2014)
  'dnd5e:dnd5e-spells-S9Jw89F2ZmaC2lsw-B2kbmgbA2WQR00kx': use('sleep', "Sleep"), // L917 Sleep (2014)
  'dnd5e:dnd5e-spells24-YAwLt85sPQpUCIBI-phbsplSymbol0000': use('discord', "Arguing"), // L919 Arguing (2024)
  'dnd5e:dnd5e-spells24-A1VA7t5gB7ODNsr6-phbsplSymbol0000': use('sleep', "Sleeping"), // L922 Sleeping (2024)
  'dnd5e:dnd5e-classes24-9Dwnc4r39iE997j0-phbftrTacticalMa': use('martial', "Tactial Master"), // L924 Tactial Master (2024)
  'dnd5e:dnd5e-monsterfeatures24-uAvQlHXKSwnCjRtt-mmTail0000000000': use('prone', "Prone"), // L925 Prone (2024)
  'dnd5e:dnd5e-spells-wv2ZdOUnHIEoBTOD-uAwtVZkiSTyP6ORB': use('mind', "Telepathic Bond"), // L928 Telepathic Bond (2014)
  'dnd5e:dnd5e-spells24-6DciPRMecBWvJCZq-phbsplRarysTelep': use('mind', "Bonded Telepathy"), // L929 Bonded Telepathy (2024)
  'dnd5e:dnd5e-spells24-WUkq6HS8v9DK6fQz-phbsplThaumaturg': use('booming', "Booming Voice"), // L933 Booming Voice (2024)
  'dnd5e:dnd5e-equipment24-c8qf2gTNGwdg4hTP-dmgThunderousGre': use('thunderMight', "Thunderous Strength"), // L938 Thunderous Strength (2024)
  'dnd5e:dnd5e-equipment24-Rg9qnmIespepasJN-dmgThunderousGre': use('prone', "Prone"), // L939 Prone (2024)
  'dnd5e:dnd5e-spells-9h8p0npULTRN0IDw-gopnZvS0c2jD5FP8': use('tongues', "Speaking in Tongues"), // L943 Speaking in Tongues (2014)
  'dnd5e:dnd5e-spells24-bmESvtHHL0Su7gn4-phbsplTongues000': use('tongues', "Universal Communication"), // L944 Universal Communication (2024)
  'dnd5e:dnd5e-monsterfeatures24-OY3B1NBPgGcFmHGi-mmTramplingCharg': use('prone', "Prone"), // L947 Prone (2024)
  'dnd5e:dnd5e-monsterfeatures24-7GhARrr7f6zhJjqy-mmTreeClub000000': use('prone', "Prone"), // L949 Prone (2024)
  'dnd5e:dnd5e-spells-EurClWVSLFaZFKO8-XzkJpE6XpZfKjODD': use('trueSight', "True Seeing"), // L950 True Seeing (2014)
  'dnd5e:dnd5e-spells24-nW7Dh0S9wT7QHWCj-phbsplTrueSeeing': use('trueSight', "Truesight"), // L951 Truesight (2024)
  'dnd5e:dnd5e-spells-9R2Z2PZW9U03QFhW-mGGlcLdggHwcL7MG': use('marked', "True Strike"), // L952 True Strike (2014)
  'dnd5e:dnd5e-classes24-l2B6aDyEF8l9FCME-phbbrbUnarmedStr': use('prone', "Prone"), // L956 Prone (2024)
  'dnd5e:dnd5e-classes24-OgkonP6JL0AdFtQN-phbmnkUnarmedStr': use('prone', "Prone"), // L958 Prone (2024)
  'dnd5e:dnd5e-equipment24-SfM8X3xktY0PR0Kz-phbUnarmedStrike': use('prone', "Prone"), // L960 Prone (2024)
  'dnd5e:dnd5e-classes24-2nOM7nl6sd6UAxA1-phbbrbUnarmoredD': use('guard', "Unarmored Defense"), // L961 Unarmored Defense (2024)
  'dnd5e:dnd5e-classes24-m2RCcVkc0YkCXNEb-phbmnkUnarmoredD': use('guard', "Unarmored Defense"), // L962 Unarmored Defense (2024)
  'dnd5e:dnd5e-classfeatures-R5ro4AuNjcdWD56O-UAvV7N7T4zJhxdfI': use('guard', "Unarmored Defense"), // L963 Unarmored Defense (2014)
  'dnd5e:dnd5e-classfeatures-hEgUnQNVxtBo2zkK-SZbsNbaxFFGwBpNK': use('guard', "Unarmored Defense"), // L964 Unarmored Defense (2014)
  'dnd5e:dnd5e-classes24-OEYjH4cLYd0VPaKm-phbmnkUnarmoredM': use('swiftMundane', "Unarmored Movement"), // L965 Unarmored Movement (2024)
  'dnd5e:dnd5e-classfeatures-Veg0vXI93A0qlxZn-zCeqyQ8uIPNdYJSW': use('swiftMundane', "Unarmored Movement"), // L966 Unarmored Movement (2014)
  'dnd5e:dnd5e-monsterfeatures24-v2EdEMrtcddO1p8U-mmVampireWeaknes': use('sunGlare', "Disadv. Attacks & Checks"), // L970 Disadv. Attacks & Checks (2024)
  'dnd5e:dnd5e-spells-imsGW3YRra9KF6iK-cdrYKaFi98YWaBMw': use('mocked', "Vicious Mockery"), // L972 Vicious Mockery (2014)
  'dnd5e:dnd5e-spells24-suEeAQQXl0X2JqzF-phbsplViciousMoc': use('mocked', "Mocked"), // L973 Mocked (2024)
  'dnd5e:dnd5e-spells24-WHhf4PFHQBDkCAyb-phbsplVitriolicS': use('acidBurn', "Lingering Acid"), // L975 Lingering Acid (2024)
  'dnd5e:dnd5e-spells-9oWdcb2bnPF5z36Z-13uVuBQP6VaiSPvC': use('aquatic', "Water Breathing"), // L991 Water Breathing (2014)
  'dnd5e:dnd5e-spells24-hyFupFam9XIbim0U-phbsplWaterBreat': use('aquatic', "Water Breathing"), // L992 Water Breathing (2024)
  'dnd5e:dnd5e-spells-2WdkWIsjxEWwsGKf-YBda6nLKjxdT1LbS': use('waterWalk', "Water Walking"), // L995 Water Walking (2014)
  'dnd5e:dnd5e-spells24-WAJx0fqTCcBPRDUJ-phbsplWaterWalk0': use('waterWalk', "Water Walking"), // L996 Water Walking (2024)
  'dnd5e:dnd5e-monsterfeatures24-wpkp78XzdLs9q2C3-mmWeakeningBreat': use('sapped', "Weakened"), // L997 Weakened (2024)
  'dnd5e:dnd5e-monsterfeatures24-Bf6DExMyhKyPPV4x-mmWeightOfYears0': use('exhausted', "Exhaustion"), // L1002 Exhaustion (2024)
  'dnd5e:dnd5e-spells-YQNznF5HERSuMOj6-Wl2vtJ4hCt2tpWfR': use('fearPurple', "Weird"), // L1003 Weird (2014)
  'dnd5e:dnd5e-monsterfeatures24-qihlGD6RZ55pZY9n-mmWhirlwind00000': use('prone', "Prone"), // L1006 Prone (2024)
  'dnd5e:dnd5e-monsterfeatures24-Xy0tzgObrMRF2lHm-mmWhirlwindOfSan': use('sandstorm', "+2 AC"), // L1007 +2 AC (2024)
  'dnd5e:dnd5e-spells-Ci7AbltSNoXhSBWy-8PJAsHmbu6UgDHC0': use('mist', "Wind Walking"), // L1009 Wind Walking (2014)
  'dnd5e:dnd5e-spells24-yuAiVeSve8sEy6JQ-phbsplWindWalk00': use('mist', "Cloud Form"), // L1010 Cloud Form (2024)
  'dnd5e:dnd5e-equipment24-jKz5xLbftW2r0f3P-dmgWingedBoots00': use('feathers', "Winged"), // L1011 Winged (2024)
  'dnd5e:dnd5e-equipment24-JLR5JpSUgL3yYcvt-dmgWingsOfFlying': use('feathers', "Winged"), // L1012 Winged (2024)
  'dnd5e:dnd5e-spells-9g5ioU44S0IIIE7N-3okM6Gn63zzEULkz': res('lightning', "Lightning Resistance"), // L1018 Lightning Resistance (2014)
  'dnd5e:dnd5e-spells-a58k6ZCEYLCko09e-3okM6Gn63zzEULkz': res('thunder', "Thunder Resistance"), // L1025 Thunder Resistance (2014)
  'dnd5e:dnd5e-spells-aLW7iyRM1lOAv7kn-3okM6Gn63zzEULkz': use('strain', "Wish Stress"), // L1027 Wish Stress (2014)
  'dnd5e:dnd5e-spells24-f16Ek2U8XKeGL7vB-phbsplWish000000': use('strain', "Wish Stress"), // L1028 Wish Stress (2024)
  'dnd5e:dnd5e-classes24-CkC8PmrUFz70FTwS-phbinvWitchSight': use('trueSight', "Witch Sight"), // L1029 Witch Sight (2024)
  'dnd5e:dnd5e-monsterfeatures24-ERWPInrx4mXsqrwL-mmWorldshakingMo': use('prone', "Prone"), // L1030 Prone (2024)
  'dnd5e:dnd5e-spells24-BgkyT4A5qyArRveO-phbsplZoneofTrut': use('truth', "Cannot Lie"), // L1031 Cannot Lie (2024)
};
