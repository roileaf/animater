// Bespoke compositions (pf2e-states-a). Keys: '<system>:<entryId>' or '<system>:<entryId>:<variant|mode>'.
// See scripts/catalogs/bespoke/helpers.mjs and scripts/bespoke.mjs.
// Conditions and effects play while the native effect is active, so every stage is a
// persistent aura on the source token. Only effects with a described visual are redesigned;
// plain numeric bonuses and penalties keep the generated marker.
import { cast, travel, projectile, impact, area, aura, sprite, motion, tint, spin, breathe, design } from './helpers.mjs';

const P = (label, assets, o = {}) => aura(label, assets, { persist: true, duration: 6000, fadeIn: 500, fadeOut: 500, bindAlpha: true, bindRotation: false, ...o });
const T = 'token';
const many = (ids, d) => Object.fromEntries(ids.map(id => [`pf2e:${id}`, d]));

// ---- reusable layer sets ----------------------------------------------------------
// Radiant wings: a glow on each flank of the token plus a soft golden halo of light.
const radiantWings = (color = 'orange') => () => [
  P('Left wing glow', [`twinkling_stars.points06.${color}`, 'twinkling_stars.points06.orange'], { offsetX: -0.6, offsetUnits: T, scale: 0.95, opacity: 0.9 }),
  P('Right wing glow', [`twinkling_stars.points06.${color}`, 'twinkling_stars.points06.orange'], { offsetX: 0.6, offsetUnits: T, scale: 0.95, opacity: 0.9, mirrorX: true }),
  P('Wing light', ['markers.light_orb.loop.yellow', 'markers.light_orb.loop.blue'], { scale: 1.5, opacity: 0.4, ...tint('#ffd978') }),
  P('Wingbeat gusts', ['wind_lines.01.01.white'], { scale: 1.5, opacity: 0.45 }),
];
const gust = () => [P('Updraft', ['wind_lines.01.01.white', 'wind_lines.01.02.white'], { scale: 1.5, opacity: 0.65 }), P('Lift', ['token_border.circle.spinning.orange.012', 'token_border.circle.spinning.blue.002'], { scale: 1.4, opacity: 0.45 })];
const speedLines = () => [P('Speed streaks', ['wind_lines.01.02.white', 'wind_lines.01.01.white'], { scale: 1.55, opacity: 0.6 }), P('Quickened pace', ['token_border.circle.spinning.blue.007'], { scale: 1.45, opacity: 0.55 })];
const swimBubbles = () => [P('Rising bubbles', ['bubble.001.001.loop.blue', 'bubble.002.001.loop.blue'], { scale: 1.3, opacity: 0.8 }), P('Water sheen', ['token_border.circle.spinning.blue.007'], { scale: 1.45, opacity: 0.45 })];
const glowingEyes = () => [P('Eyes that pierce the dark', ['eyes.01.dark_yellow.single', 'eyes.01.dark_green.single'], { scale: 0.7, opacity: 0.85, ...tint('#e8e45a') })];
const holyWeapon = () => [P('Hallowed gleam', ['markers.light_orb.loop.yellow', 'markers.light_orb.loop.blue'], { scale: 1.3, opacity: 0.55, ...tint('#ffe27a') }), P('Divine sparks', ['twinkling_stars.points05.orange', 'twinkling_stars.points05.white'], { scale: 1.45, opacity: 0.9 })];
const divineWard = () => [P('Divine ward', ['shield.01.loop.yellow', 'shield.01.loop.blue'], { scale: 1.45, opacity: 0.55, ...tint('#ffd36b') }), P('Holy motes', ['twinkling_stars.points04.orange'], { scale: 1.5, opacity: 0.75 })];
const ghostly = () => [P('Spectral mist', ['fumes.04.loop.blue', 'fumes.04.loop.grey'], { scale: 1.35, opacity: 0.5 }), P('Ghostly outline', ['token_border.circle.static.blue.003', 'token_border.circle.static.blue.002'], { scale: 1.4, opacity: 0.55 })];
const beastShift = () => [P('Wild shape', ['aura_themed.01.orbit.loop.nature.01.green'], { scale: 1.45, opacity: 0.85, ...spin(9000) }), P('Falling fur and leaves', ['swirling_leaves.loop.01.green', 'swirling_leaves.loop.02.green'], { scale: 1.3, opacity: 0.8 })];
const slime = (hex) => () => [P('Clinging slime', ['grease.dark_green.loop', 'grease.dark_brown.loop'], { scale: 1.1, opacity: 0.85, below: true, ...tint(hex) }), P('Sticky drip', ['bubble.001.001.loop.green', 'bubble.001.001.loop.blue'], { scale: 1.1, opacity: 0.6, ...tint(hex) })];

export default {
  // ---------------- conditions ----------------
  // Petrified: turned to stone. A cold, grey mineral shell with settling dust, instead of a spinning metal orbit.
  'pf2e:conditions-dTwPJuKgBQCMxixg': design('A creature turned to stone is sheathed in grey mineral that slowly settles, with a faint dust haze.', () => [
    P('Stone shell', ['aura_themed.01.inward.loop.metal.01.grey'], { scale: 1.4, opacity: 0.9 }),
    P('Settling dust', ['ambient_fog.001.loop.small.white', 'fog_cloud.01.white'], { scale: 1.1, opacity: 0.35, below: true, ...tint('#9a9a94') }),
  ]),

  // ---------------- auras and emanations ----------------
  // Angelic Halo: a halo hangs above the head with a gentle radiance spreading around.
  'pf2e:spell-effects-jPZXZjetdauqYuEH': design('A bright halo hovers above the caster while a soft green-gold emanation spreads around.', () => [
    P('Halo', ['markers.light.loop.yellow', 'markers.light.loop.blue'], { scale: 0.6, offsetY: -0.62, offsetUnits: T, opacity: 0.95, ...tint('#ffe27a') }),
    P('Halo sparks', ['twinkling_stars.points04.orange', 'twinkling_stars.points04.white'], { scale: 0.7, offsetY: -0.6, offsetUnits: T, opacity: 0.9 }),
    P('Healing radiance', ['template_circle.aura.03.outward.001.loop.combined.greenyellow', 'template_circle.aura.03.outward.001.loop.combined.blue'], { scale: 1.5, below: true, opacity: 0.55, ...tint('#d9e48a') }),
  ]),
  // Ascended Celestial Nimbus: a shining nimbus of light rings the body.
  'pf2e:feat-effects-7UWKpTquSpP6Pgzh': design('A celestial nimbus of light crowns the figure with a slow ring of radiance and stars.', () => [
    P('Nimbus', ['markers.light.loop.yellow', 'markers.light.loop.blue'], { scale: 0.65, offsetY: -0.6, offsetUnits: T, opacity: 0.85, ...tint('#fff0a8') }),
    P('Celestial radiance', ['template_circle.aura.03.outward.002.loop.combined.greenyellow', 'template_circle.aura.03.outward.001.loop.combined.blue'], { scale: 1.5, below: true, opacity: 0.55, ...tint('#d9e48a') }),
    P('Stars', ['twinkling_stars.points08.white'], { scale: 1.4, opacity: 0.85 }),
  ]),

  // ---------------- wings, flight and gusts ----------------
  ...many(['equipment-effects-7uih4ELs2cePqkF2'], design('Golden Wings shed light as they unfurl, so each flank glows with golden radiance while gusts lift the wearer.', radiantWings('orange'))),
  ...many(['equipment-effects-UzSrsR9S2pgMDbbp'], design('The Cape of the Open Sky becomes golden drake wings, shown as a golden glow on each flank with a flapping updraft.', radiantWings('orange'))),
  ...many(['feat-effects-HfXGhXc9D120gvl5'], design('Divine Wings are luminous feathered wings, shown as pale-white radiance on each flank with a light halo and updraft.', radiantWings('white'))),
  ...many(['equipment-effects-gDefAEEMXVVZgqXH'], design('Holy Chain wings shed bright light, so both flanks glow golden and the figure is wrapped in brilliance.', radiantWings('orange'))),
  'pf2e:feat-effects-MrdT7LiOZMN8J4GK': design('Fiendish Wings are bat-like leathery wings, shown as a flutter of red bats around the figure.', () => [
    P('Bat-wing flutter', ['bats.loop.01.red', 'bats.loop.01.green'], { scale: 1.5, opacity: 0.9 }),
    P('Infernal wingbeat', ['wind_lines.01.01.white'], { scale: 1.5, opacity: 0.35, ...tint('#c04030') }),
  ]),
  'pf2e:feat-effects-LhHJkfS5VhfJss6p': design('Fly on Shadowed Wings: wings of shadow, shown as drifting black fumes and a cloud of bats in flight.', () => [
    P('Shadow wings', ['fumes.04.loop.black', 'fumes.04.loop.grey'], { scale: 1.5, opacity: 0.7 }),
    P('Shadow bats', ['bats.loop.01.green', 'bats.loop.01.red'], { scale: 1.5, opacity: 0.8, ...tint('#5a4a8a') }),
  ]),
  'pf2e:equipment-effects-ioGzmVSmMGXWWBYb': design('Cloak of the Bat grants bat flight and sharp senses, shown by bats circling the wearer.', () => [
    P('Circling bats', ['bats.loop.01.red', 'bats.loop.01.green'], { scale: 1.45, opacity: 0.9 }),
  ]),
  'pf2e:bestiary-effects-H99PJXU5cvJ4Oycm': design('Fiery Form sets the creature alight, immune to fire and hovering with its own light and heat.', () => [
    P('Body of flame', ['flames.04.loop.orange'], { scale: 1.5, opacity: 0.9 }),
    P('Firelight', ['fire_ring.500px.red', 'fire_ring.500px.yellow'], { scale: 1.3, opacity: 0.4, below: true }),
    P('Heat updraft', ['wind_lines.01.01.white'], { scale: 1.5, opacity: 0.35, ...tint('#ffb060') }),
  ]),
  'pf2e:feat-effects-Tw9MjeQHL3qFY1PO': design('Furnace Form turns the body into a stoked furnace, shown as roaring flames with rising smoke.', () => [
    P('Furnace flames', ['flames.04.loop.orange'], { scale: 1.45, opacity: 0.9 }),
    P('Furnace smoke', ['smoke.plumes_loop.01.grey', 'fumes.04.loop.grey'], { scale: 1.2, opacity: 0.45 }),
  ]),
  'pf2e:feat-effects-wmBSuZPqiDyUNwXH': design('Dragon\'s Rage Wings ties a rage to draconic flight, shown as a furious red orbit with wingbeat gusts.', () => [
    P('Rage', ['aura_themed.01.orbit.loop.metal.01.red', 'aura_themed.01.orbit.loop.metal.01.grey'], { scale: 1.5, opacity: 0.85, ...tint('#d03020'), ...spin(7000) }),
    P('Wingbeat gusts', ['wind_lines.01.01.white'], { scale: 1.5, opacity: 0.5 }),
  ]),
  'pf2e:feat-effects-nMMqJQsdV37TLfTu': design('Monarch Wings are fey butterfly wings, shown as a flutter of butterflies around the figure.', () => [
    P('Butterfly wings', ['butterflies.loop.01.bluepurple', 'butterflies.loop.01.greenyellow'], { scale: 1.5, opacity: 0.95 }),
    P('Fey sparkle', ['swirling_sparkles.01.blue', 'swirling_sparkles.01.bluepink'], { scale: 1.2, opacity: 0.6 }),
  ]),
  'pf2e:feat-effects-SZY4zxhxoeehYRdN': design('Cyclonic Ascent lifts the user on a whirl of wind.', () => [
    P('Cyclone', ['whirlwind.bluegrey', 'whirlwind.bluewhite'], { scale: 1.3, opacity: 0.55 }),
    P('Wind streaks', ['wind_lines.01.01.white'], { scale: 1.5, opacity: 0.5 }),
  ]),
  ...many(['equipment-effects-YcHGSplvY5Vbqfc8', 'equipment-effects-bDcRrcC6VlkenVK4'], design('Cloud Buns carry the wearer on a puff of cloud, shown as a low billow of white vapour under a light updraft.', () => [
    P('Cloud bed', ['ambient_fog.001.loop.small.white', 'fog_cloud.01.white'], { scale: 1.25, opacity: 0.75, below: true, offsetY: 0.2, offsetUnits: T }),
    P('Updraft', ['wind_lines.01.01.white'], { scale: 1.4, opacity: 0.4 }),
  ])),
  'pf2e:equipment-effects-oiO3cQfqp8MuxR82': design('Blast Boots fly on bursts of fire from the soles.', () => [
    P('Boot flames', ['flames.orange.03.1x1', 'flames.04.loop.orange'], { scale: 0.7, offsetY: 0.4, offsetUnits: T, opacity: 0.95 }),
    P('Thrust gusts', ['wind_lines.01.02.white'], { scale: 1.5, opacity: 0.45 }),
  ]),
  'pf2e:equipment-effects-c0URo81HpSmCkuQc': design('The Energy Robe of Electricity lets the wearer fly crackling with static, shown as electric sparks and gusts.', () => [
    P('Crackling charge', ['static_electricity.01.blue', 'static_electricity.02.blue'], { scale: 1.4, opacity: 0.9 }),
    P('Updraft', ['wind_lines.01.01.white'], { scale: 1.5, opacity: 0.4 }),
  ]),
  'pf2e:equipment-effects-fszJ9ZaslnrW5m5z': design('Nimbus Breath gives electricity resistance and flight, shown as a storm-cloud crackle with gusts.', () => [
    P('Storm crackle', ['lightning_orb.01.loop.bluepurple', 'static_electricity.01.blue'], { scale: 1.2, opacity: 0.7 }),
    P('Updraft', ['wind_lines.01.01.white'], { scale: 1.5, opacity: 0.45 }),
  ]),
  'pf2e:bestiary-effects-C9nb9XbnQgbnXpTq': design('Crystalline Dust Form disperses the body into drifting crystalline motes that fly.', () => [
    P('Crystal dust', ['swirling_sparkles.01.blue', 'swirling_sparkles.01.bluepink'], { scale: 1.4, opacity: 0.9 }),
    P('Dust haze', ['particles.002.001.complete.many.white', 'particles.002.001.complete.many.blue'], { scale: 1.3, opacity: 0.55 }),
  ]),
  'pf2e:bestiary-effects-5x0XpNftvx9uGbXt': design('Death Gasp (Etioling) makes the creature an incorporeal flying spirit, shown as a pale spectral mist.', ghostly),
  'pf2e:feat-effects-ngwcN8u7f7CnqGXp': design('Distant Wandering makes the wanderer invisible and inaudible while flying, shown as a faint refraction shimmer with a light draft.', () => [
    P('Vanishing shimmer', ['condition.boon.02.001.refraction', 'condition.boon.02.002.refraction'], { scale: 1.2, opacity: 0.7 }),
    P('Draft', ['wind_lines.01.01.white'], { scale: 1.5, opacity: 0.3 }),
  ]),
  ...many(['feat-effects-EVRcdGt4awWPgXla', 'feat-effects-5rypwpGjbu4aCAHh', 'feat-effects-Mnvd3jV4EW6nAJKI', 'feat-effects-iN7j0d5LE7OwZlAo', 'feat-effects-0JrHvdUgJBl631En', 'feat-effects-8E5SCmFndGAvgkTw'], design('A granted fly Speed (or air-impulse speed) is shown as a rising updraft with wind streaks.', gust)),

  // ---------------- speed ----------------
  ...many(['equipment-effects-PeuUz7JaabCgl6Yh', 'equipment-effects-lNWACCNe9RYgaFxb', 'equipment-effects-j9zVZwRBVAcnpEkE', 'equipment-effects-88kqcDmsoAEddzUt', 'equipment-effects-lLP56tbG689TNKW5', 'feat-effects-ePvCQNEIhq1iQkuq', 'feat-effects-pQ9e5njvIOe5QzFa', 'campaign-effects-i5PHb9yR33Cr6XMK', 'feat-effects-BJldFHlx4kwMY3rX', 'bestiary-effects-s4XFUgK8UgKnpKrX'], design('A status bonus to Speed is shown as streaking wind lines behind a quickened ring.', speedLines)),

  // ---------------- swimming ----------------
  ...many(['equipment-effects-rkirKFneWDdCjU7a', 'equipment-effects-4tepFOJLhZSelPoa', 'feat-effects-LCU3Lv6ojuTl4DSY', 'feat-effects-OhLcaJeQy4Nf5Mwo', 'feat-effects-HKPmrxkZwHRND5Um'], design('A granted swim Speed is shown as rising water bubbles around the swimmer.', swimBubbles)),
  // Aquatic Combat: everyone fighting in water carries it, so it stays light: a few rising
  // bubbles on the token (it was a generic penalty's red curse sigil under every creature).
  'pf2e:other-effects-TPbr1kErAAJKBi3V': design('Aquatic Combat: fighting in water, shown as a few rising bubbles on the token instead of a curse sigil.', () => [
    P('Rising bubbles', ['bubble.001.001.loop.blue', 'bubble.002.001.loop.blue'], { scale: 0.85, opacity: 0.55 }),
  ]),

  // ---------------- darkvision and sight ----------------
  ...many(['equipment-effects-fbSFwwp60AuDDKpK', 'equipment-effects-7vCenP9j6FuHRv5C', 'equipment-effects-7UL8belWmo7U5YGM', 'equipment-effects-bcxVvIbuZWOvsKcA', 'feat-effects-EcVitI0Wqu3uNfaK', 'equipment-effects-vX8SE5SXnspdzMYZ', 'feat-effects-5IGz4iheaiUWm5KR', 'equipment-effects-Vd2wb7EO58q41HWm', 'equipment-effects-KSvkfMqMQ8mlGLiz', 'equipment-effects-d7BDxmsnM1BUoEeT', 'equipment-effects-WXrqEuLT4uP48Bvo'], design('Darkvision is shown as eyes glowing in the dark rather than as a generic light orb.', glowingEyes)),
  'pf2e:equipment-effects-SZWxyXOTZtGvZbN7': design('Alchemist Goggles let the wearer see through lesser cover, shown as a lens glint over the eyes, not a fog bank.', () => [
    P('Lens glint', ['eyes.01.dark_yellow.single', 'eyes.01.dark_green.single'], { scale: 0.7, opacity: 0.85, ...tint('#e2c25a') }),
    P('Brass shimmer', ['glint.yellow.few', 'twinkling_stars.points04.orange'], { scale: 0.6, opacity: 0.7 }),
  ]),

  // ---------------- divine weapons and wards (were green nature leaves) ----------------
  ...many(['feat-effects-eecIuD6sGPX0FJcT', 'bestiary-effects-K1brBNe37GzceN0N', 'feat-effects-zZ25N1zpXA8GNhFL', 'bestiary-effects-BWmrfNcFfjvWh8SV'], design('Divine Weapon and Divine Infusion imbue arms with holy spirit damage, shown as a hallowed gleam and golden sparks rather than nature leaves.', holyWeapon)),
  ...many(['bestiary-effects-e4HoYakV7SvwvcrH', 'feat-effects-K1IgNCf3Hh2EJwQ9', 'feat-effects-OWFMglWgeCjRhqLK', 'feat-effects-WdxPp1pTQTUYRTA3', 'feat-effects-jMQi2kDirzGgddti'], design('Divine Aegis, Invulnerability and Rebuttal are divine protection, shown as a golden warding shell with holy motes.', divineWard)),
  'pf2e:feat-effects-U2Pgm6B4nmdQ2Gpd': design('Divine Castigation makes heal spells scourge fiends, shown as a stern golden radiance.', holyWeapon),
  'pf2e:feat-effects-6lwPOXa25qx9Lo46': design('Edict of Mortality is a divine restriction, shown as a heavy, dimmed curse mark rather than nature leaves.', () => [
    P('Divine restriction', ['markers.runes03.white.02', 'markers.runes03.orange.01'], { scale: 1.25, opacity: 0.8 }),
    P('Dimmed light', ['condition.curse.01.012.purple', 'condition.curse.01.012.red'], { scale: 1.2, opacity: 0.45 }),
  ]),
  'pf2e:bestiary-effects-1zAL0XwjCx6koYWL': design('Divine Frenzy is a zealous fervour, shown as a hot, fierce orbit of golden-red motes.', () => [
    P('Zeal', ['aura_themed.01.orbit.loop.metal.01.red', 'aura_themed.01.orbit.loop.metal.01.grey'], { scale: 1.4, opacity: 0.85, ...tint('#e05028'), ...spin(6000) }),
    P('Holy fire', ['twinkling_stars.points06.orange'], { scale: 1.4, opacity: 0.8 }),
  ]),
  'pf2e:campaign-effects-dZT1w2EciqaR2NRz': design('Crownhold Consecration is Gorum\'s martial blessing, shown as a steel-and-red war aura instead of leaves.', () => [
    P('War blessing', ['aura_themed.01.orbit.loop.metal.01.red', 'aura_themed.01.orbit.loop.metal.01.grey'], { scale: 1.45, opacity: 0.85, ...spin(8000) }),
    P('Consecrated ground', ['magic_signs.circle.02.abjuration.loop.dark_yellow', 'magic_signs.circle.02.abjuration.loop.yellow', 'magic_signs.circle.02.abjuration.loop.blue'], { scale: 1.3, below: true, opacity: 0.55, ...tint('#e0b84a') }),
  ]),

  // ---------------- bloodline magic (was a blood drop for every bloodline) ----------------
  'pf2e:feat-effects-UQ7vZgmfK0VSFS8A': design('Aberrant blood magic is eldritch and alien, shown as a dark violet web of warding.', () => [
    P('Eldritch web', ['shield_themed.above.eldritch_web.01.dark_purple'], { scale: 1.4, opacity: 0.85 }),
    P('Watching eyes', ['eyes.01.dark_purple.few', 'eyes.01.dark_green.few'], { scale: 1.2, opacity: 0.55 }),
  ]),
  'pf2e:feat-effects-s1tulrmW6teTFjVd': design('Angelic blood magic is a protective angelic aura, shown as a halo glow with golden stars.', () => [
    P('Halo glow', ['markers.light.loop.yellow', 'markers.light.loop.blue'], { scale: 0.6, offsetY: -0.6, offsetUnits: T, opacity: 0.9, ...tint('#ffe27a') }),
    P('Angelic aura', ['shield.01.loop.yellow', 'shield.01.loop.blue'], { scale: 1.45, opacity: 0.4, ...tint('#ffe9a0') }),
    P('Stars', ['twinkling_stars.points05.white', 'twinkling_stars.points05.orange'], { scale: 1.4, opacity: 0.8 }),
  ]),
  'pf2e:feat-effects-aKRo5TIhUtu0kyEr': design('Demonic blood magic is abyssal and violent, shown as dark red hellish flame.', () => [
    P('Abyssal fire', ['flames.04.loop.purple', 'flames.04.loop.orange'], { scale: 1.4, opacity: 0.85, ...tint('#b01c34') }),
    P('Brimstone smoke', ['fumes.04.loop.black', 'fumes.04.loop.grey'], { scale: 1.2, opacity: 0.35 }),
  ]),
  'pf2e:feat-effects-n1vhmOd7aNiuR3nk': design('Diabolic blood magic is infernal, shown as a violet fire ward with a deceptive flicker.', () => [
    P('Infernal ward', ['shield_themed.above.fire.01.dark_purple', 'shield_themed.above.fire.01.orange'], { scale: 1.4, opacity: 0.85 }),
  ]),
  'pf2e:feat-effects-FNTTeJHiK6iOjrSq': design('Draconic blood magic briefly grows dragon scales, shown as a shimmering scaled sheath.', () => [
    P('Dragon scales', ['aura_themed.01.inward.loop.metal.01.red', 'aura_themed.01.inward.loop.metal.01.grey'], { scale: 1.4, opacity: 0.85 }),
    P('Scale glint', ['twinkling_stars.points07.orange'], { scale: 1.3, opacity: 0.7 }),
  ]),
  'pf2e:feat-effects-rJpkKaPRGaH0pLse': design('Fey blood magic is a trickster\'s glamour, shown as drifting fairies.', () => [
    P('Fey glamour', ['fairies.loop.01.greenyellow', 'fairies.loop.01.bluepurple'], { scale: 1.4, opacity: 0.9 }),
  ]),
  'pf2e:feat-effects-SVGW8CLKwixFlnTv': design('Nymph blood magic is alluring and graceful, shown as fluttering blossoms of light and butterflies.', () => [
    P('Allure', ['butterflies.loop.01.white', 'butterflies.loop.01.bluepurple'], { scale: 1.4, opacity: 0.9 }),
    P('Petal drift', ['swirling_leaves.loop.01.pink', 'swirling_leaves.loop.01.green'], { scale: 1.25, opacity: 0.55 }),
  ]),

  // ---------------- elemental and energy fields ----------------
  'pf2e:feat-effects-QOWjsM4GYUHw6pFA': design('Aura Junction (Fire) makes the kinetic aura burn, so the figure is wreathed in rolling flame.', () => [
    P('Fire aura', ['flames.04.loop.orange'], { scale: 1.4, opacity: 0.85 }),
    P('Heat field', ['fire_ring.500px.red', 'fire_ring.500px.yellow'], { scale: 1.4, below: true, opacity: 0.35 }),
  ]),
  'pf2e:feat-effects-MFCcEWCC9PR46qPy': design('Aura Junction (Metal) is a clanging metal field, shown as a grey metallic orbit pulling inward.', () => [
    P('Metal field', ['aura_themed.01.inward.loop.metal.01.grey'], { scale: 1.5, opacity: 0.9 }),
    P('Iron glint', ['glint.yellow.few', 'twinkling_stars.points04.white'], { scale: 1.2, opacity: 0.6 }),
  ]),
  'pf2e:feat-effects-su5qLXoweaHxt6ZP': design('Aura Junction (Wood) is a mending woodland field that sprouts leaves and renews allies.', () => [
    P('Wood aura', ['aura_themed.01.orbit.loop.wood.01.green'], { scale: 1.45, opacity: 0.85, ...spin(9000) }),
    P('Leaf drift', ['swirling_leaves.loop.01.green', 'swirling_leaves.loop.02.green'], { scale: 1.25, opacity: 0.6 }),
  ]),
  'pf2e:feat-effects-09oP0FBBAhXOS4JW': design('Earth Impulse Junction is a stony ward, shown as grey cracked-earth plating hugging the body.', () => [
    P('Stone plating', ['ground_cracks.01.orange', 'ground_cracks.orange.01'], { scale: 1.1, opacity: 0.55, below: true, ...tint('#9a8a70') }),
    P('Earthen ward', ['aura_themed.01.inward.loop.metal.01.grey'], { scale: 1.4, opacity: 0.7 }),
  ]),
  ...many(['equipment-effects-FOZXp7QQDnny1600', 'equipment-effects-VsHhBBLApZsOCJRL', 'equipment-effects-yP45Rqu4jvCfXBkp'], design('Fire and Iceberg resist both fire and cold, shown as a shield half flame and half ice.', () => [
    P('Flame ward', ['shield_themed.above.fire.01.orange'], { scale: 1.4, opacity: 0.8, offsetX: -0.12, offsetUnits: T }),
    P('Ice ward', ['shield_themed.above.ice.01.blue'], { scale: 1.4, opacity: 0.8, offsetX: 0.12, offsetUnits: T }),
  ])),
  'pf2e:feat-effects-UKNtAmCdczhWB4xI': design('Moisture Bath coats the body in water that resists fire and cold, shown as rising bubbles over a blue ward.', () => [
    P('Water film', ['bubble.001.001.loop.blue', 'bubble.002.001.loop.blue'], { scale: 1.3, opacity: 0.8 }),
    P('Cool ward', ['shield.01.loop.blue'], { scale: 1.4, opacity: 0.4 }),
  ]),
  'pf2e:feat-effects-JF2xCqL6t4UJZtUi': design('Blizzard Evasion is a whirl of snow and cold around the fleeing figure.', () => [
    P('Blizzard', ['sleet_storm.01.blue', 'sleet_storm.blue'], { scale: 0.7, opacity: 0.55 }),
    P('Cold orbit', ['aura_themed.01.orbit.loop.cold.01.blue'], { scale: 1.45, opacity: 0.8 }),
    P('Snow gusts', ['wind_lines.01.01.white'], { scale: 1.5, opacity: 0.45 }),
  ]),
  'pf2e:equipment-effects-oKtMGJa0qbxuZD7w': design('The Guardian Staff conjures a ruby-colored plane of force, shown as a red shielding plane around the user.', () => [
    P('Ruby plane of force', ['shield.01.loop.red', 'shield.01.loop.blue'], { scale: 1.45, opacity: 0.6, ...tint('#d03050') }),
    P('Force shimmer', ['energy_field.01.blue', 'energy_field.01.multicolored'], { scale: 1.3, opacity: 0.3, ...tint('#ff6080') }),
  ]),

  // ---------------- creatures, swarms and bones ----------------
  'pf2e:feat-effects-r4kb2zDepFeczMsl': design('Bone Swarm turns the body into a Huge flying swarm of bones, shown as two counter-rotating clouds of bone fragments.', () => [
    P('Bone cloud', ['aura_themed.01.orbit.loop.metal.01.grey'], { scale: 1.5, opacity: 0.9, ...spin(5000) }),
    P('Inner bone cloud', ['aura_themed.01.orbit.loop.metal.01.grey'], { scale: 1.3, opacity: 0.8, ...spin(4000, -1) }),
    P('Gravedust', ['fumes.04.loop.grey'], { scale: 1.5, opacity: 0.3 }),
  ]),
  'pf2e:feat-effects-4Zj71naHbY6O9ggP': design('Bristle curls the body so bone spines splay outward, shown as a ring of bone spikes.', () => [
    P('Splayed spines', ['ice_spikes.radial.loop.grey', 'ice_spikes.radial.loop.white'], { scale: 1.1, opacity: 0.9, ...tint('#e6dcc4') }),
  ]),
  'pf2e:feat-effects-ZsO5juyylVoxUkXh': design('Bone Spikes lets bone spikes grow from the body, shown as a ring of bone spikes.', () => [
    P('Bone spikes', ['ice_spikes.radial.loop.grey', 'ice_spikes.radial.loop.white'], { scale: 1.0, opacity: 0.85, ...tint('#e6dcc4') }),
  ]),
  'pf2e:equipment-effects-5DaEI4I7cVdOD507': design('Caltrops scatter at the feet of the creature that stepped on them, with a bleeding wound.', () => [
    P('Caltrops underfoot', ['caltrops.01.grey', 'caltrops.02.orange'], { scale: 0.6, opacity: 0.95, below: true }),
    P('Bleeding foot', ['markers.drop.red.01', 'markers.drop.red.02'], { scale: 0.7, opacity: 0.8, offsetY: 0.3, offsetUnits: T }),
  ]),
  'pf2e:bestiary-effects-4bR1i7qzmSJ5No6O': design('Bond in Light makes the creature glow with bright light, shown as a bright steady orb with a soft outer glow.', () => [
    P('Bright light', ['markers.light_orb.loop.yellow', 'markers.light_orb.loop.blue'], { scale: 1.5, opacity: 0.7, ...tint('#fff0b0') }),
    P('Outer glow', ['template_circle.aura.03.outward.001.loop.combined.greenyellow', 'template_circle.aura.03.outward.001.loop.combined.blue'], { scale: 1.5, below: true, opacity: 0.35, ...tint('#d9e48a') }),
  ]),

  // ---------------- nets, vines, slime and mud (movement penalties with a described cause) ----------------
  ...many(['bestiary-effects-4fmRhCljZ9l0Tr3J', 'equipment-effects-Hx4MOTujp5z6SlQu'], design('Enliven Foliage and Arboreal\'s Revenge make plants grab at the feet, shown as clutching green vines.', () => [
    P('Clutching vines', ['vine.loop.nature.group.01.green', 'vine.loop.nature.single.01.green'], { scale: 1.1, opacity: 0.95, below: true }),
  ])),
  'pf2e:bestiary-effects-ddfrT7Q9Qe2IzKRB': design('Grasping Tendrils: the akata\'s dark tendrils reach out, shown as shadowy void vines writhing at the ground.', () => [
    P('Shadow tendrils', ['vine.loop.void.group.01.dark_pinkpurple', 'vine.loop.nature.group.01.green'], { scale: 1.2, opacity: 0.9, below: true, ...tint('#5a2a7a') }),
  ]),
  ...many(['equipment-effects-sgQknR94qDt5ILBx', 'equipment-effects-5JYchreCttBg7RcD'], design('Glue Bomb and Goo Grenade glue the target down, shown as sticky brown goo pooled at the feet.', slime('#c8a05a'))),
  ...many(['bestiary-effects-TbmkcfpKIs558skY', 'campaign-effects-uZ2mAwpVz1bkw5GK', 'campaign-effects-cpeMnTLFpi106fjg', 'bestiary-effects-jQmfZcPD6xVYx5nb'], design('Caustic and chthonic mucus slows the creature, shown as clinging green slime and drips.', slime('#7ab04a'))),
  'pf2e:equipment-effects-6p2Sjl7XxCc55ft4': design('Mudrock Snare mires the feet in clinging mud, shown as a pool of brown muck.', slime('#8a6a40')),
  'pf2e:bestiary-effects-hHALCOBKk1j8yRfv': design('Clinging Smoke slows with drifting, oily smoke, shown as grey plumes around the legs.', () => [
    P('Clinging smoke', ['fumes.04.loop.grey', 'smoke.plumes_loop.01.grey'], { scale: 1.3, opacity: 0.65 }),
    P('Heavy air', ['token_border.circle.static.blue.005'], { scale: 1.4, opacity: 0.4 }),
  ]),

  // ---------------- animal, transformed and shifted forms ----------------
  ...many(['campaign-effects-LJOZk2O6KS3iulXy', 'feat-effects-Q8pD29NcGGuRxWwh', 'feat-effects-qIOEe4kUN7FOBifb', 'feat-effects-Tlb2xfEhGLHjwPHy', 'bestiary-effects-USMuxi8ACBJRUrdS'], design('Animal and hybrid shapes (Boar Form, Change Shape, Hybrid Shape, small bird) are shown as a wild-shape orbit of nature motes with fur and leaves.', beastShift)),

  // ---------------- spectral weapons (ghost touch) ----------------
  ...many(['equipment-effects-fRQUwVDXWQMxEtW9', 'equipment-effects-sk5LgfXestDKxCnK', 'feat-effects-IAwtIy6VVel7NexY', 'feat-effects-SiegLMJpVOGuoyWJ', 'equipment-effects-grXFmNl8Zy3VRVpR', 'equipment-effects-O8JjATMWOoRzMTId', 'equipment-effects-02LNcIl70TTy9XS1', 'equipment-effects-vOwZlSNCS35GULgL', 'equipment-effects-Vk9Fwo0Xl1EF9fEF'], design('Ghost-touch weapons strike spirits, so they carry a pale spectral mist and outline.', ghostly)),
};
