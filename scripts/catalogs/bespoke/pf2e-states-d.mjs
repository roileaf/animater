// Bespoke compositions (pf2e-states-d): conditions and non-spell PF2e effects
// (feat, equipment, other, bestiary, campaign effects) whose generated look
// misrepresented the state: hostile art on a benefit (fear sigils on courage,
// blood drops on blood magic, poison marks on antidotes), the wrong element, or
// generic rings where a specific JB2A loop reads at a glance.
// Every stage is a persistent aura on the bearer, sized ~0.9–1.5x the token,
// with a Patreon key first and a JB2A Free fallback after it.
import { aura, tint, spin, design } from './helpers.mjs';

const P = (label, assets, o = {}) => aura(label, assets, { persist: true, duration: 6000, fadeIn: 500, fadeOut: 500, bindAlpha: true, bindRotation: false, ...o });
const T = 'token';
const many = (ids, d) => Object.fromEntries(ids.map(id => [`pf2e:${id}`, d]));

// ---- reusable layer sets ----------------------------------------------------------
const eyes = (keys, hex, o = {}) => P('Keen eyes', keys, { scale: 0.6, opacity: 0.85, offsetY: -0.2, offsetUnits: T, ...tint(hex), ...o });
const earth = () => [
  P('Earthen mantle', ['aura_themed.01.inward.loop.metal.01.grey'], { scale: 1.4, opacity: 0.75, playbackRate: 0.5, ...tint('#b49a74') }),
  P('Rooted ground', ['ambient_fog.001.loop.small.orangeyellow', 'ambient_fog.001.loop.small.white'], { scale: 1.2, opacity: 0.35, below: true, ...tint('#a08860') }),
];
const storm = () => [
  P('Storm crown', ['lightning_orb.01.loop.bluepurple'], { scale: 1.3, opacity: 0.7 }),
  P('Gale', ['wind_lines.01.01.white'], { scale: 1.45, opacity: 0.45 }),
];
const weaponGleam = () => [
  P('Empowered strikes', ['glint.yellow.many'], { scale: 1.1, opacity: 0.8 }),
  P('Charged edge', ['token_border.circle.spinning.orange.012', 'token_border.circle.spinning.blue.007'], { scale: 1.35, opacity: 0.4, below: true, ...tint('#ffcf70') }),
];
const swift = (hex = '#8fe2f4') => [
  P('Speed lines', ['wind_lines.01.01.white'], { scale: 1.45, opacity: 0.5 }),
  P('Brisk ring', ['token_border.circle.spinning.blue.007'], { scale: 1.35, opacity: 0.4, below: true, ...tint(hex) }),
];
const draconic = () => [
  P('Draconic scales', ['aura_themed.01.inward.loop.metal.01.red', 'aura_themed.01.inward.loop.metal.01.grey'], { scale: 1.35, opacity: 0.7, ...tint('#d0743c') }),
  eyes(['eyes.01.orangeyellow.single', 'eyes.01.dark_green.single'], '#ffb347'),
];
const healing = (hex = '#8be6c4') => [P('Mending', ['healing_generic.loop.greenorange'], { scale: 1.0, opacity: 0.5, ...tint(hex) })];
const ward = (hex, keys = ['shield.01.loop.white', 'shield.01.loop.blue']) => [P('Ward', keys, { scale: 1.15, opacity: 0.45, ...tint(hex) })];

export default {
  // ---------------- alchemical mutagens and elixirs ----------------
  // Bestial Mutagen: claws and a feral, earthy vigor instead of a generic green boon disk.
  ...many(['equipment-effects-kwD0wuW5Ndkc9YXB', 'equipment-effects-fIpzDpuwLdIS4tW5', 'equipment-effects-1ouUo8lLK6H79Rqh', 'equipment-effects-xFQRiVU6h8EA6Lw9'],
    design('Bestial Mutagen grows claws and feral strength: faint recurring claw rakes inside a slow earthy orbit.', () => [
      P('Feral claws', ['claws.200px.brown', 'claws.200px.red'], { scale: 1.15, opacity: 0.5, playbackRate: 0.6 }),
      P('Bestial vigor', ['aura_themed.01.orbit.loop.nature.01.green'], { scale: 1.35, opacity: 0.55, ...tint('#b08a5a') }),
    ])),
  // Cognitive Mutagen: a mental boost, not the blue "slowed" ring its drawback produced.
  ...many(['equipment-effects-qit1mLbJUyRTYcPU', 'equipment-effects-jaBMZKdoywOTrQvP', 'equipment-effects-RT1BxXrbbGgk40Ti', 'equipment-effects-ztxW3lBPRcesF7wK'],
    design('Cognitive Mutagen sharpens the intellect: a divination circle underfoot and racing glints of thought at the brow.', () => [
      P('Sharpened intellect', ['magic_signs.circle.02.divination.loop.blue'], { scale: 1.3, opacity: 0.45, below: true }),
      P('Racing thoughts', ['glint.blue.few', 'glint.yellow.few'], { scale: 0.9, opacity: 0.75, offsetY: -0.2, offsetUnits: T, ...tint('#a9d4ff') }),
    ])),
  // Drakeheart Mutagen: draconic scales (+AC) and drake eyes (+Perception).
  ...many(['equipment-effects-qwoLV4awdezlEJ60', 'equipment-effects-GBBjw61g4ekJymT0', 'equipment-effects-vFOr2JAJxiVvvn2E', 'equipment-effects-BV8RPntjc9FUzD3g'],
    design('Drakeheart Mutagen hardens the skin into draconic scales and gives burning drake eyes.', () => draconic())),
  // Juggernaut Mutagen: swelling bulk and toughness rather than a floating heart.
  ...many(['equipment-effects-xLilBqqf34ZJYO9i', 'equipment-effects-1l139A2Qik4lBHKO', 'equipment-effects-2PNo8u4wxSbz5WEs', 'equipment-effects-fUrZ4xcMJz0CfTyG'],
    design('Juggernaut Mutagen swells the body with hardened bulk: a heavy inward metal swirl over a ruddy rim.', () => [
      P('Swelling bulk', ['aura_themed.01.inward.loop.metal.01.grey'], { scale: 1.4, opacity: 0.65, playbackRate: 0.6, ...tint('#c98a6a') }),
      P('Toughened rim', ['token_border.circle.static.dark_red.004', 'token_border.circle.static.blue.002'], { scale: 1.35, opacity: 0.45, below: true, ...tint('#c0605a') }),
    ])),
  // Sanguine Mutagen: fortified blood against disease and poison, not a poison sigil or a bleed drop.
  ...many(['equipment-effects-FtBfE4yrbg9fxtxr', 'equipment-effects-5VI5NCEhuorERXTi', 'equipment-effects-yY8vPNmDdQQ5d7n6', 'equipment-effects-sZPXKQACna6YDsVX'],
    design('Sanguine Mutagen fortifies the blood: a ruddy protective sheen with a steady healthy pulse.', () => [
      P('Fortified blood', ['shield.01.loop.red', 'shield.01.loop.blue'], { scale: 1.15, opacity: 0.4, ...tint('#d0505f') }),
      P('Healthy pulse', ['healing_generic.loop.purplepink', 'healing_generic.loop.greenorange'], { scale: 1.0, opacity: 0.45, ...tint('#e07080') }),
    ])),
  // Stone Body Mutagen: stony skin, not a slow ring.
  ...many(['equipment-effects-b9DTIJyBT8kvIBpj', 'equipment-effects-PEPOd38VfVzQMKG5', 'equipment-effects-1xHHvQlW4pRR89qj'],
    design('Stone Body Mutagen turns the skin to stone: a slow grey-brown mineral swirl with a little grit at the feet.', () => [
      P('Stone skin', ['aura_themed.01.inward.loop.metal.01.grey'], { scale: 1.35, opacity: 0.8, playbackRate: 0.5, ...tint('#a99a86') }),
      P('Grit', ['ambient_fog.001.loop.small.white', 'fog_cloud.01.white'], { scale: 1.15, opacity: 0.3, below: true, ...tint('#9a8a74') }),
    ])),
  // Theatrical Mutagen: performance and showmanship, not speed.
  ...many(['equipment-effects-o2yteYPGqEjpPAZ5', 'equipment-effects-euBiKyqrcefeuv4H', 'equipment-effects-bZPjDwwyPT0iKBE9', 'equipment-effects-G1IwG9HRH9CRtHqj'],
    design('Theatrical Mutagen makes the drinker a born performer: a soft spotlight and stage sparkle.', () => [
      P('Spotlight', ['markers.light.loop.yellow', 'markers.light.loop.blue'], { scale: 0.9, opacity: 0.55, offsetY: -0.25, offsetUnits: T, ...tint('#ffe6a0') }),
      P('Stage sparkle', ['twinkling_stars.points07.orange'], { scale: 1.3, opacity: 0.8 }),
    ])),
  // War Blood Mutagen: battle fervor and steeled will, not a bleeding drop.
  ...many(['equipment-effects-8RNPIAuV7ixaXeq5', 'equipment-effects-aIZsC56OdotiGb9M', 'equipment-effects-S3Sv7SYwxozbG554', 'equipment-effects-AvXNZ9I6s1H8C4wd'],
    design('War Blood Mutagen fills the drinker with battle fervor: a red martial orbit over a steady crimson rim.', () => [
      P('Battle fervor', ['aura_themed.01.orbit.loop.metal.01.red', 'aura_themed.01.orbit.loop.metal.01.grey'], { scale: 1.3, opacity: 0.65, ...tint('#d9534f') }),
      P('Steeled will', ['token_border.circle.static.dark_red.007', 'token_border.circle.static.blue.002'], { scale: 1.35, opacity: 0.45, below: true, ...tint('#c0504d') }),
    ])),
  // Hydra Mutagen: all-around vision.
  'pf2e:equipment-effects-jJ038JXfHdvDindo': design('Hydra Mutagen grants all-around vision: many watchful eyes ring the drinker.', () => [
    P('All-around eyes', ['eyes.01.dark_green.many'], { scale: 1.2, opacity: 0.75 }),
  ]),
  // Ichthyosis Mutagen: scaly hide and fast healing, not a curse ring.
  'pf2e:equipment-effects-hAdyMxuWJu7piQSS': design('Ichthyosis Mutagen covers the drinker in fish-like scales that knit wounds: a faint teal sheen with steady mending.', () => [
    P('Scaled hide', ['shield.01.loop.green', 'shield.01.loop.blue'], { scale: 1.15, opacity: 0.35, ...tint('#6fc3b0') }),
    ...healing('#7fd8b8'),
  ]),
  // Prey Mutagen: fleet, skittish prey instincts (Speed, Timely Dodge), not a hunter's mark on the drinker.
  ...many(['equipment-effects-JBWZkGkNikSlQfNr', 'equipment-effects-oqRIuChjaSRKKEes', 'equipment-effects-HLn9nQY4SAvyhaom', 'equipment-effects-KUNJk4bsCRDzArdK'],
    design('Prey Mutagen gives fleet, skittish prey instincts: quick wind lines with leaves kicked up by darting feet.', () => [
      P('Fleet of foot', ['wind_lines.01.01.white'], { scale: 1.45, opacity: 0.5 }),
      P('Darting leaves', ['swirling_leaves.loop.01.green'], { scale: 1.2, opacity: 0.45 }),
    ])),
  // Pallesthetic Mutagen: echolocation and tremorsense read as sonar pings.
  'pf2e:equipment-effects-weKnwX64fD5fuPjy': design('Pallesthetic Mutagen grants echolocation and tremorsense: soft sonar pings ripple out from the drinker.', () => [
    P('Echolocation pings', ['template_circle.radar.loop.ping.001.300px.round.blueteal', 'template_circle.radar.loop.ping.001.300px.round.greenpurple'], { scale: 1.4, opacity: 0.5, below: true }),
  ]),
  // Viperous Elixir: venomous fangs.
  ...many(['equipment-effects-zW8adCNIRo46mfEH', 'equipment-effects-zao2sENSQlMLYhyr', 'equipment-effects-FgwkowiWGfZpnIAc'],
    design('Viperous Elixir grows snake fangs: a faint recurring green bite.', () => [
      P('Viper fangs', ['bite.200px.green', 'bite.200px.red'], { scale: 1.1, opacity: 0.5, playbackRate: 0.6, ...tint('#8ccf6a') }),
    ])),
  // Eagle Eye Elixir: keen sight.
  'pf2e:equipment-effects-VOSQ77DV4BnAkP7m': design('Eagle Eye Elixir sharpens sight: a keen golden gaze with a glint.', () => [
    eyes(['eyes.01.dark_yellow.single', 'eyes.01.dark_green.single'], '#f0d070'),
    P('Glint', ['glint.yellow.few'], { scale: 0.9, opacity: 0.6 }),
  ]),
  // Skeptic's Elixir: seeing through lies.
  ...many(['equipment-effects-TsWUTODTVi487SEz', 'equipment-effects-5Gof60StUppR2Xn9', 'equipment-effects-mG6S6zm6hxaF7Tla'],
    design("Skeptic's Elixir lets the drinker see through falsehoods: a cool, discerning gaze.", () => [
      eyes(['eyes.01.bluegreen.single', 'eyes.01.dark_green.single'], '#9fe0d8'),
    ])),
  // Potion of Sonic Resistance: a ward, not music notes.
  'pf2e:equipment-effects-nBGodDOQTCWBXjNd': design('Potion of Sonic Resistance wraps the drinker in a sound-dampening ward.', () => ward('#c4adf0', ['shield.01.loop.blue'])),
  // Treat Poison: help against poison, not a poison sigil over the patient.
  'pf2e:other-effects-1FrAlPeNseApVrX3': design('Treat Poison steadies the patient against the toxin: a pale green antitoxin ward.', () => ward('#a7deac', ['shield.01.loop.green', 'shield.01.loop.blue'])),

  // ---------------- class features and feats ----------------
  // Arcane Cascade: magus arcane force, not a temporary-HP heart.
  'pf2e:feat-effects-fsjO5oTKttsbpaKl': design('Arcane Cascade lets magic flow through the magus: cascading blue energy strands over an evocation circle.', () => [
    P('Cascading magic', ['energy_strands.overlay.blue.01'], { scale: 1.2, opacity: 0.6 }),
    P('Spell circle', ['magic_signs.circle.02.evocation.loop.blue', 'magic_signs.circle.02.divination.loop.blue'], { scale: 1.3, opacity: 0.4, below: true }),
  ]),
  // Overdrive: an overclocked innovation (sparks and spinning gears), not flames.
  'pf2e:feat-effects-1XlJ9xLzL19GHoOL': design("Overdrive pushes the inventor's gadgets past their limits: crackling orange sparks over a spinning gear-like ring.", () => [
    P('Overclocked sparks', ['static_electricity.01.orange', 'static_electricity.01.blue'], { scale: 1.15, opacity: 0.7, ...tint('#ffb060') }),
    P('Spinning gears', ['token_border.circle.spinning.orange.012', 'token_border.circle.spinning.blue.007'], { scale: 1.35, opacity: 0.45, below: true, ...tint('#ff9a3c') }),
  ]),
  // Unleash Psyche: surging psychic power, not a small overhead rune.
  'pf2e:feat-effects-939OHjW9y8uCmDk3': design('Unleash Psyche lets the psychic mind overflow: violet energy strands surge around the body over a psychic sigil.', () => [
    P('Unleashed mind', ['energy_strands.overlay.dark_purple.01', 'energy_strands.overlay.blue.01'], { scale: 1.25, opacity: 0.6, ...tint('#c48cff') }),
    P('Psychic sigil', ['magic_signs.circle.02.divination.loop.purple', 'magic_signs.circle.02.divination.loop.blue'], { scale: 1.3, opacity: 0.4, below: true, ...tint('#c48cff') }),
  ]),
  // Devise a Stratagem: investigator deduction.
  'pf2e:feat-effects-XQpTyjXFYYNexyOk': design('Devise a Stratagem: the investigator reads the fight, shown as a golden deduction circle and a watchful eye.', () => [
    P('Deduction circle', ['magic_signs.circle.02.divination.loop.dark_yellow', 'magic_signs.circle.02.divination.loop.blue'], { scale: 1.3, opacity: 0.45, below: true, ...tint('#e8c66a') }),
    eyes(['eyes.01.dark_yellow.single', 'eyes.01.dark_green.single'], '#f0d070', { scale: 0.55 }),
  ]),
  // Hunt Prey: the ranger is the hunter, so a predator's focus instead of a prey mark on the ranger.
  'pf2e:feat-effects-MeXyXqWY9qN42bSQ': design("Hunt Prey: the ranger's predatory focus, shown as a green hunter's gaze over a slow stalking ring (the mark belongs on the prey, not the ranger).", () => [
    eyes(['eyes.01.dark_green.single'], '#8fd47e'),
    P('Stalking ring', ['token_border.circle.spinning.blue.002'], { scale: 1.35, opacity: 0.4, below: true, playbackRate: 0.6, ...tint('#7fc47a') }),
  ]),
  // Panache: swashbuckler flair.
  ...many(['feat-effects-uBJsxCzNhje8m8jj', 'feat-effects-paKKHPds77fq5VTH', 'feat-effects-fJD0yIkVPMwdNjLy'],
    design('Panache is the swashbuckler\'s flair: golden sparkles and a showy glint instead of a plain ring.', () => [
      P('Flair', ['twinkling_stars.points07.orange'], { scale: 1.3, opacity: 0.85 }),
      P('Swagger glint', ['glint.yellow.few'], { scale: 1.0, opacity: 0.7 }),
    ])),
  // Regalia (thaumaturge): royal bearing, not a poison sigil.
  'pf2e:feat-effects-fOypEG6eeTwfM6c3': design('Regalia lends a royal bearing that steels allies: a golden crown-light above gold sparkles.', () => [
    P('Regal sparkle', ['twinkling_stars.points06.orange'], { scale: 1.3, opacity: 0.8 }),
    P('Crown light', ['markers.light.loop.yellow', 'markers.light.loop.blue'], { scale: 0.55, opacity: 0.7, offsetY: -0.35, offsetUnits: T, ...tint('#ffd36b') }),
  ]),
  // Offensive Boost / Oil of Potency: an empowered weapon, not a defensive shield dome.
  ...many(['feat-effects-ut5SVyCSXel69nnd', 'equipment-effects-1OLlwExJz7ii2Lu2'],
    design('An empowered weapon: golden glints and a charged ring mark stronger Strikes instead of a defensive shield.', () => weaponGleam())),
  // Lion's Bite: the shield's biting maw is a weapon.
  'pf2e:equipment-effects-cP9oWbEa7cJnnK9j': design("Lion's Bite: the lion shield's maw snaps, shown as a faint golden bite rather than a protective dome.", () => [
    P('Lion maw', ['bite.200px.orange', 'bite.200px.red'], { scale: 1.1, opacity: 0.55, playbackRate: 0.6, ...tint('#e0a040') }),
  ]),
  // Forward March! (initiative bonus).
  'pf2e:equipment-effects-rKDTseFqWUuMJX9p': design('Forward March! spurs a quick start: brisk wind lines and a golden ring for the initiative bonus.', () => swift('#ffd27a')),
  // Path of the Tempest: familiar-summoned winds that speed and protect.
  'pf2e:feat-effects-2CJwgnCsYtk4R5sO': design('Path of the Tempest: winds summoned by the familiar speed the bearer and turn aside blows.', () => [
    P('Familiar winds', ['wind_lines.01.01.white'], { scale: 1.45, opacity: 0.6 }),
    P('Gust ward', ['shield.01.loop.blue'], { scale: 1.15, opacity: 0.3, ...tint('#cfe8ff') }),
  ]),
  // Deck of Destiny: weal or woe, a fortune/misfortune twist.
  'pf2e:equipment-effects-5fPfP74t4NYnRnnc': design('Deck of Destiny twists fate (weal or woe): a circle of turning stars instead of a shield.', () => [
    P('Turn of fate', ['markers.circle_of_stars.yellowblue', 'markers.circle_of_stars.blue'], { scale: 1.1, opacity: 0.8 }),
  ]),
  // Cover: an obstacle between you and the attack.
  'pf2e:other-effects-I9lfZUiCwMiGogVi': design('Cover: a stone-grey barrier half-shields the creature, instead of a floating light orb.', () => ward('#b9b2a4')),
  // Stymie the Gods: protection against divine magic and extraplanar creatures.
  'pf2e:feat-effects-1bnJJb4hsnMOw9cQ': design('Stymie the Gods: a violet abjuration ward against divine power, not swirling leaves.', () => [
    ...ward('#b9a0ff', ['shield.01.loop.purple', 'shield.01.loop.blue']),
    P('Abjuration circle', ['magic_signs.circle.02.abjuration.loop.purple', 'magic_signs.circle.02.abjuration.loop.blue'], { scale: 1.3, opacity: 0.35, below: true }),
  ]),

  // ---------------- stances ----------------
  // Earth stances and effects: stone, not a blue magic shield or a plain ring.
  ...many(['feat-effects-QrJ06Sc2GiloQ6hB', 'feat-effects-gYpy9XBPScIlY93p', 'feat-effects-EfMaI6AnROP4X9lN', 'feat-effects-fo8kb5GW0OF3HPKK', 'feat-effects-zqgOjMU9TGoGwJWc'],
    design('Earth and mountain stances: a slow earthen mineral swirl with dust at the feet.', () => earth())),
  // Crowned in Tempest's Fury / In Lightning, Life: electricity, not an orange flight ring or a heart.
  ...many(['feat-effects-woKCbf1kXPrPjeZG', 'feat-effects-ZouxY0u1dKQEHQ6E'],
    design('A crackling storm crown: an electric orb and gale wrap the kineticist.', () => storm())),
  // Kishin Rage: rage with electric horns.
  'pf2e:feat-effects-TKuUezmnwVftoCcL': design('Kishin Rage: a red battle frenzy crackling with electricity from the horns.', () => [
    P('Rage', ['aura_themed.01.orbit.loop.metal.01.red', 'aura_themed.01.orbit.loop.metal.01.grey'], { scale: 1.4, opacity: 0.75, ...tint('#e05a4a') }),
    P('Horn lightning', ['static_electricity.01.blue'], { scale: 1.1, opacity: 0.5 }),
  ]),
  // Wood Impulse Junction: wood.
  'pf2e:feat-effects-rCsmv66TzQhte4Gp': design('Wood Impulse Junction: living wood and leaves strengthen the kineticist.', () => [
    P('Living wood', ['aura_themed.01.orbit.loop.wood.01.green'], { scale: 1.35, opacity: 0.7 }),
    P('Leaves', ['swirling_leaves.loop.01.green'], { scale: 1.2, opacity: 0.5 }),
  ]),
  // Stunt Performer Stance: an acrobatic showman, not the stunned condition.
  'pf2e:feat-effects-Ei6ACyEsNGLidvSv': design('Stunt Performer Stance is a nimble showman\'s stance: sparkles and a whirl of motion instead of stun stars.', () => [
    P('Showmanship', ['twinkling_stars.points07.orange'], { scale: 1.3, opacity: 0.8 }),
    P('Acrobatic whirl', ['wind_lines.01.02.white'], { scale: 1.4, opacity: 0.35 }),
  ]),
  // Twisting Petal Stance: gale blossoms, not void.
  'pf2e:feat-effects-7Eh8gHNcRNs9iIR8': design('Twisting Petal Stance strikes with gale blossoms: pink petals ride a swirling wind.', () => [
    P('Gale blossoms', ['wind_lines.01.leaves.01.pink', 'wind_lines.01.leaves.01.green'], { scale: 1.4, opacity: 0.75 }),
    P('Petal swirl', ['swirling_leaves.loop.01.pink', 'swirling_leaves.loop.01.green'], { scale: 1.2, opacity: 0.5 }),
  ]),
  // Bullet Dancer Stance: firearms and bayonets, not flames.
  'pf2e:feat-effects-6ctQFQfSZ6o1uyyZ': design('Bullet Dancer Stance: drifting powder smoke and a gunmetal glint rather than a body of flame.', () => [
    P('Powder smoke', ['smoke.plumes_loop.01.grey'], { scale: 1.2, opacity: 0.4 }),
    P('Gunmetal glint', ['glint.blue.few', 'glint.yellow.few'], { scale: 1.0, opacity: 0.6 }),
  ]),
  // Waterfowl Stance: a graceful sword stance, not water bubbles.
  'pf2e:feat-effects-ko8I8OCPddWA9U8v': design('Waterfowl Stance is a gliding sword stance: light wind and white sparkles rather than bubbles.', () => [
    P('Gliding grace', ['wind_lines.01.02.white'], { scale: 1.4, opacity: 0.5 }),
    P('Feather motes', ['twinkling_stars.points06.white'], { scale: 1.25, opacity: 0.6 }),
  ]),
  // Ricochet Stance: thrown weapons rebound, so an orbiting metal arc.
  'pf2e:feat-effects-Unfl4QQURWaX2zfd': design('Ricochet Stance: thrown weapons rebound to hand, shown as a spinning arc of steel rather than a shield.', () => [
    P('Rebounding arc', ['aura_themed.01.orbit.loop.metal.01.grey'], { scale: 1.35, opacity: 0.55, ...spin(5000) }),
  ]),
  // Sky and Heaven Stance: skyward slashes.
  'pf2e:feat-effects-CQfkyJkRHw4IHWhv': design('Sky and Heaven Stance: skyward wind and heavenly sparkle rather than a blue shield dome.', () => [
    P('Skyward wind', ['wind_lines.01.01.white'], { scale: 1.45, opacity: 0.5 }),
    P('Heavenly sparkle', ['twinkling_stars.points06.white'], { scale: 1.3, opacity: 0.65 }),
  ]),

  // ---------------- sorcerer blood magic (benefits, not bleeding) ----------------
  'pf2e:feat-effects-L8m3L4MCGDZJISp0': design('Aesir Blood Magic: the might of the northern gods, a cold white sparkle on a brisk wind (not a blood drop).', () => [
    P('Aesir sparkle', ['twinkling_stars.points06.white'], { scale: 1.3, opacity: 0.75 }),
    P('Northern wind', ['wind_lines.01.02.white'], { scale: 1.4, opacity: 0.35, ...tint('#cfe6ff') }),
  ]),
  'pf2e:feat-effects-3gGBZHcUFsHLJeQH': design('Elemental Blood Magic: a burst of elemental power around the sorcerer (not a blood drop).', () => [
    P('Elemental circle', ['magic_signs.circle.02.evocation.loop.red', 'magic_signs.circle.02.evocation.loop.dark_red'], { scale: 1.3, opacity: 0.45, below: true }),
    P('Elemental motes', ['twinkling_stars.points09.orange'], { scale: 1.25, opacity: 0.7 }),
  ]),
  'pf2e:feat-effects-9AUcoY48H5LrVZiF': design('Genie Blood Magic: a shimmering djinni haze with golden sparkles (not a blood drop).', () => [
    P('Genie haze', ['ambient_fog.001.loop.small.white'], { scale: 1.25, opacity: 0.45, ...tint('#9fd3ff') }),
    P('Wishing sparkle', ['twinkling_stars.points05.orange'], { scale: 1.25, opacity: 0.7 }),
  ]),
  'pf2e:feat-effects-vguxP8ukwVTWWWaA': design('Imperial Blood Magic: an arcane abjuration sigil and glints of pure magic (not a blood drop).', () => [
    P('Imperial sigil', ['magic_signs.circle.02.abjuration.loop.blue'], { scale: 1.3, opacity: 0.45, below: true }),
    P('Arcane glint', ['glint.blue.few', 'glint.yellow.few'], { scale: 1.0, opacity: 0.7 }),
  ]),
  'pf2e:feat-effects-7BFd8A9HFrmg6vwL': design('Psychopomp Blood Magic: a pale soul-guide light in a cool spirit mist (not a blood drop).', () => [
    P('Spirit mist', ['fumes.04.loop.blue', 'fumes.04.loop.grey'], { scale: 1.3, opacity: 0.4 }),
    P('Soul guide', ['markers.light_orb.loop.white', 'markers.light_orb.loop.blue'], { scale: 0.5, opacity: 0.7, offsetY: -0.3, offsetUnits: T }),
  ]),
  'pf2e:feat-effects-fILVhS5NuCtGXfri': design('Wyrmblessed Blood Magic: draconic scales and eyes (not a blood drop).', () => draconic()),
  'pf2e:feat-effects-RXhGjWqBqmQOlaRV': design('Phoenix Blood Magic: rebirth embers and a low flame instead of a generic heart.', () => [
    P('Phoenix embers', ['twinkling_stars.points09.orange'], { scale: 1.3, opacity: 0.8 }),
    P('Rebirth flame', ['flames.04.loop.orange'], { scale: 1.1, opacity: 0.4 }),
  ]),
  'pf2e:equipment-effects-KkFk8PZ2ZZVUrdgj': design('Wine of the Blood steadies the will: a crimson abjuration circle, not a bleeding drop.', () => [
    P('Fortified will', ['magic_signs.circle.02.abjuration.loop.red', 'magic_signs.circle.02.abjuration.loop.blue'], { scale: 1.3, opacity: 0.4, below: true, ...tint('#c05060') }),
  ]),
  // Medical aids: healing, not bleeding.
  ...many(['equipment-effects-zlSNbMDIlTOpcO8R', 'feat-effects-45nzYsMBTP6PIxDN'],
    design('A medical aid that closes wounds: a gentle green mending loop instead of a blood drop.', () => healing())),
  // Hone Claws / Untamed Shift (Oaksteward): claws.
  'pf2e:feat-effects-cYtUBB2cO0FOUU8D': design('Hone Claws: sharpened claws that rake for bleed, shown as red claw marks rather than a drop on the bearer.', () => [
    P('Honed claws', ['claws.200px.dark_red', 'claws.200px.red'], { scale: 1.15, opacity: 0.55, playbackRate: 0.6 }),
  ]),
  'pf2e:bestiary-effects-lBpprC8VD4GRzTtg': design('Untamed Shift (Oaksteward) grows a claw: claw rakes in a wooden orbit, not a shield dome.', () => [
    P('Claws', ['claws.200px.brown', 'claws.200px.red'], { scale: 1.15, opacity: 0.5, playbackRate: 0.6 }),
    P('Oak shift', ['aura_themed.01.orbit.loop.wood.01.green'], { scale: 1.35, opacity: 0.5 }),
  ]),
  // Silkspinner's Shield (Climb): spider climbing.
  'pf2e:equipment-effects-SbYcOry1cxbndSve': design("Silkspinner's Shield grants a climb Speed: faint spider silk instead of a shield dome.", () => [
    P('Spider silk', ['web.02', 'web.01'], { scale: 1.15, opacity: 0.55 }),
  ]),

  // ---------------- misread benefits ----------------
  'pf2e:feat-effects-00gozjbtueYWop0w': design("Hell's Bane: righteous bonus damage against the marked fiend, a holy light rather than a curse rune on the bearer.", () => [
    P('Righteous light', ['markers.light_orb.loop.yellow', 'markers.light_orb.loop.blue'], { scale: 0.55, opacity: 0.7, offsetY: -0.3, offsetUnits: T, ...tint('#ffe27a') }),
    P('Holy sparks', ['twinkling_stars.points05.orange'], { scale: 1.25, opacity: 0.75 }),
  ]),
  'pf2e:feat-effects-ETZHTCjlOUHHSE0Z': design('Oracular Warning gives allies a premonition (+initiative): a divination circle, not a curse rune.', () => [
    P('Premonition', ['magic_signs.circle.02.divination.loop.blue'], { scale: 1.3, opacity: 0.45, below: true }),
  ]),
  'pf2e:feat-effects-IzmXq1LycaKNqGIt': design('Trance of Celerity is a Speed bonus: brisk wind lines and a quick ring, not a curse rune.', () => swift()),
  'pf2e:feat-effects-d0TYadetRJvNb2Au': design('Steal Death grants fast healing: a mending loop under a faint grey shroud, not a skull.', () => [
    ...healing('#b7e3c8'),
    P('Grave shroud', ['fumes.04.loop.grey'], { scale: 1.2, opacity: 0.25 }),
  ]),
  'pf2e:equipment-effects-ocjUbOrpnJeGb3iP': design("Mortalis Coin keeps death at bay (die at dying 5): a pale protective ward, not a skull.", () => ward('#c9b8e8')),
  'pf2e:equipment-effects-5OABp099y6w3didN': design("Soulspark Candle blesses Pharasma's faithful: a candle-like light and pale sparkles, not a skull.", () => [
    P('Candle light', ['markers.light_orb.loop.yellow', 'markers.light_orb.loop.blue'], { scale: 0.5, opacity: 0.7, offsetY: -0.3, offsetUnits: T, ...tint('#ffe6a8') }),
    P('Soul sparks', ['twinkling_stars.points05.white'], { scale: 1.25, opacity: 0.65 }),
  ]),
  'pf2e:feat-effects-evFqVITRiK6AZd6d': design('Soul Thief makes the bearer undead and unholy with void healing: a dark violet orbit, not a bright light.', () => [
    P('Void orbit', ['aura_themed.01.orbit.loop.cold.01.purple', 'aura_themed.01.orbit.loop.cold.01.blue'], { scale: 1.35, opacity: 0.6, ...tint('#8a5fbf') }),
    P('Unholy haze', ['fumes.04.loop.black', 'fumes.04.loop.grey'], { scale: 1.2, opacity: 0.3 }),
  ]),
  'pf2e:equipment-effects-cOcHWeogJFIkEI0d': design('Energizing Lattice glows with bright light: a warm glow around the bearer.', () => [
    P('Lattice glow', ['markers.light.loop.yellow02', 'markers.light.loop.blue'], { scale: 1.3, opacity: 0.6, ...tint('#ffe6a0') }),
  ]),
};
