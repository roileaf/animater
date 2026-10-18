// Bespoke compositions (pf2e-states-b). Keys: '<system>:<entryId>' or '<system>:<entryId>:<variant|mode>'.
// See scripts/catalogs/bespoke/helpers.mjs and scripts/bespoke.mjs.
// Persistent token markers for native PF2e effects: aura(...) stages only, persist on the source.
import { cast, travel, projectile, impact, area, aura, sprite, motion, tint, spin, breathe, design } from './helpers.mjs';

const L = (label, assets, o = {}) => aura(label, assets, { persist: true, duration: 6000, ...o });

const flight = () => [L('Wind streaks', ['wind_lines.01.02.white'], { scale: 1.5, opacity: 0.9 }), L('Cloud puffs', ['ambient_fog.001.loop.small.white'], { scale: 1.25, below: true, opacity: 0.55 })];
const flightFire = () => [L('Flame cloak', ['flames.04.loop.orange'], { scale: 1.5, opacity: 0.9 }), L('Hot updraft', ['wind_lines.01.02.white'], { scale: 1.5, opacity: 0.55 })];
const flightHoly = () => [L('Halo radiance', ['template_circle.aura.03.outward.001.loop.combined.greenyellow', 'template_circle.aura.03.outward.001.loop.combined.blue'], { ...tint('#ffe2a0'), scale: 1, opacity: 0.8 }), L('Drifting stars', ['twinkling_stars.points06.orange'], { ...tint('#ffe2a0'), scale: 1.3 })];
const flightDragon = () => [L('Draconic embers', ['aura_themed.01.orbit.loop.metal.01.red', 'aura_themed.01.orbit.loop.metal.01.grey'], { scale: 1.5, opacity: 0.85 }), L('Wing-beat wind', ['wind_lines.01.02.white'], { scale: 1.5, opacity: 0.7 })];
const flightBone = () => [L('Bone motes', ['aura_themed.01.orbit.loop.metal.01.grey'], { ...tint('#e3dcc8'), scale: 1.5 }), L('Wing-beat wind', ['wind_lines.01.02.white'], { scale: 1.5, opacity: 0.6 })];
const flightStorm = () => [L('Storm charge', ['lightning_orb.01.loop.bluepurple'], { scale: 1.5 }), L('Gale', ['wind_lines.01.02.white'], { scale: 1.5, opacity: 0.75 })];
const flightMoon = () => [L('Moonbeam column', ['moonbeam.01.loop.blue'], { scale: 1.2, opacity: 0.85 }), L('Lofting wind', ['wind_lines.01.02.white'], { scale: 1.5, opacity: 0.5 })];
const vapor = () => [L('Vapor body', ['ambient_fog.001.loop.small.white'], { scale: 1.4, opacity: 0.8 }), L('Mist drift', ['wind_lines.01.02.white'], { scale: 1.5, opacity: 0.45 })];
const swift = () => [L('Speed lines', ['wind_lines.01.01.white'], { scale: 1.5 }), L('Quickened ring', ['token_border.circle.spinning.blue.007'], { scale: 1.35, opacity: 0.55 })];
const quicksilver = () => [L('Quicksilver motes', ['aura_themed.01.orbit.loop.metal.01.grey'], { ...tint('#dfe6f2'), scale: 1.5 }), L('Speed lines', ['wind_lines.01.01.white'], { scale: 1.5, opacity: 0.8 })];
const ghostRush = () => [L('Spectral mist', ['ambient_fog.001.loop.small.white'], { ...tint('#c9d6ff'), scale: 1.35, opacity: 0.7 }), L('Rushing wind', ['wind_lines.01.01.white'], { scale: 1.5 })];
const smokeSpeed = () => [L('Trailing smoke', ['smoke.plumes_loop.01.grey'], { scale: 1.5, opacity: 0.75 }), L('Speed lines', ['wind_lines.01.01.white'], { scale: 1.5, opacity: 0.6 })];
const glow = () => [L('Soft radiance', ['markers.light.loop.yellow02', 'markers.light.loop.blue'], { ...tint('#ffe2a0'), scale: 1.5, opacity: 0.9 }), L('Light sparkle', ['twinkling_stars.points05.white'], { ...tint('#fff2c0'), scale: 1.1, opacity: 0.9 })];
const eyesDark = () => [L('Watchful eyes', ['eyes.01.dark_yellow.single', 'eyes.01.dark_green.single'], { ...tint('#ffd75e'), scale: 1.1 })];
const eyesMany = () => [L('Eyes all around', ['eyes.01.dark_yellow.many', 'eyes.01.dark_green.many'], { ...tint('#d9b8ff'), scale: 1.3 })];
const eyesMenace = () => [L('Baleful eye', ['eyes.01.dark_red.single', 'eyes.01.dark_green.single'], { ...tint('#ff5a5a'), scale: 1.1 })];
const web = () => [L('Clinging web', ['web.01', 'web.02'], { scale: 1.2, opacity: 0.8 })];
const entangle = () => [L('Grasping growth', ['entangle.02.loop.02.green'], { scale: 1.3 })];
const vines = () => [L('Living vines', ['vine.loop.nature.group.01.green'], { scale: 1.4 })];
const ice = () => [L('Frost motes', ['aura_themed.01.orbit.loop.cold.01.blue'], { scale: 1.5, opacity: 0.8 }), L('Snowflake', ['markers.snowflake.blue.01'], { scale: 0.75 })];
const iceChain = () => [L('Frozen chains', ['markers.chain.spectral_standard.loop.02.blue'], { scale: 1.4 }), L('Snowflake', ['markers.snowflake.blue.02'], { scale: 0.7 })];
const coldFog = () => [L('Freezing fog', ['ambient_fog.001.loop.large.blue', 'ambient_fog.001.loop.large.white'], { ...tint('#bfe6ff'), scale: 1.2, opacity: 0.85 })];
const sandstorm = () => [L('Blowing sand', ['smoke.plumes_loop.01.grey'], { ...tint('#d8b878'), scale: 1.5, opacity: 0.85 }), L('Gale', ['wind_lines.01.02.white'], { ...tint('#e9d3a2'), scale: 1.5, opacity: 0.7 })];
const sandForm = () => [L('Sand body', ['smoke.plumes_loop.01.grey'], { ...tint('#d8b878'), scale: 1.5, opacity: 0.9 })];
const ashForm = () => [L('Drifting ash', ['smoke.plumes_loop.01.grey'], { ...tint('#8a8a92'), scale: 1.5, opacity: 0.8 }), L('Dying embers', ['particles.swirl.orange.01.01', 'particles.swirl.greenyellow.01.01'], { ...tint('#ff9a4a'), scale: 1.3, opacity: 0.7 })];
const stench = () => [L('Foul fumes', ['fumes.04.loop.green', 'fumes.04.loop.grey'], { ...tint('#8fd45a'), scale: 1.5, opacity: 0.85 })];
const sulfur = () => [L('Sulfurous fumes', ['fumes.04.loop.green', 'fumes.04.loop.grey'], { ...tint('#d9c34a'), scale: 1.5, opacity: 0.9 })];
const violetFog = () => [L('Violet fog', ['ambient_fog.001.loop.large.bluepurple', 'ambient_fog.001.loop.large.white'], { ...tint('#a982e0'), scale: 1.3, opacity: 0.9 })];
const mist = () => [L('Drifting mist', ['ambient_fog.001.loop.small.white'], { scale: 1.4, opacity: 0.8 })];
const acid = () => [L('Corrosive bubbling', ['bubble.001.001.loop.green', 'bubble.001.001.loop.blue'], { ...tint('#9be15a'), scale: 1.5 })];
const fire = () => [L('Flames', ['flames.04.loop.orange'], { scale: 1.3 }), L('Rising embers', ['particles.swirl.orange.01.01', 'particles.swirl.greenyellow.01.01'], { ...tint('#ffb978'), scale: 1.3, opacity: 0.8 })];
const lightning = () => [L('Electric crackle', ['lightning_orb.01.loop.bluepurple'], { scale: 1.5 })];
const rage = () => [L('Rage haze', ['aura_themed.01.orbit.loop.metal.01.red', 'aura_themed.01.orbit.loop.metal.01.grey'], { scale: 1.5 }), L('Rage pulse', ['token_border.circle.spinning.orange.012', 'token_border.circle.spinning.blue.007'], { ...tint('#ff4a3a'), scale: 1.4, opacity: 0.6 })];
const luck = () => [L('Stars of fortune', ['markers.circle_of_stars.yellowblue', 'markers.circle_of_stars.blue'], { ...tint('#ffe27a'), scale: 1.2 })];
const misfortune = () => [L('Ill omen', ['markers.horror.purple.02'], { scale: 0.75 })];
const moon = () => [L('Moonlight', ['moonbeam.01.loop.blue'], { scale: 1.1, opacity: 0.85 })];
const bubbles = () => [L('Rising bubbles', ['bubble.001.001.loop.blue'], { scale: 1.5 })];
const rain = () => [L('Cascading water', ['shield.01.loop.blue'], { scale: 1.5, opacity: 0.8 }), L('Droplets', ['bubble.001.001.loop.blue'], { scale: 1.4, opacity: 0.8 })];
const whirl = () => [L('Swirling wind', ['template_circle.whirl.loop.blue'], { ...tint('#dbe9ff'), scale: 0.9, opacity: 0.85 })];
const breeze = () => [L('Gentle breeze', ['wind_lines.01.02.white'], { scale: 1.5, opacity: 0.75 })];
const grease = () => [L('Slick oil', ['grease.dark_brown.loop'], { scale: 1.2, below: true })];
const ooze = () => [L('Ooze bubbles', ['bubble.001.001.loop.green', 'bubble.001.001.loop.blue'], { ...tint('#8fd45a'), scale: 1.5 }), L('Slick sheen', ['grease.dark_green.loop', 'grease.dark_brown.loop'], { ...tint('#6fae45'), scale: 1.2, below: true, opacity: 0.8 })];
const dino = () => [L('Primal might', ['aura_themed.01.orbit.loop.wood.01.green'], { ...tint('#b08a5a'), scale: 1.5 })];
const cosmic = () => [L('Starfield', ['twinkling_stars.points08.white'], { scale: 1.4 }), L('Orbiting stars', ['markers.circle_of_stars.blue'], { scale: 1.3, opacity: 0.8 })];
const fey = () => [L('Fairy lights', ['fairies.loop.01.greenyellow', 'fairies.loop.01.bluepurple'], { scale: 1.4 })];
const dust = () => [L('Glittering dust', ['twinkling_stars.points05.white'], { ...tint('#ffd6f5'), scale: 1.3 })];
const shadow = () => [L('Shadow ring', ['markers.smoke.ring.loop.purple', 'markers.smoke.ring.loop.bluepurple'], { ...tint('#7a5aa8'), scale: 1.5, opacity: 0.9 })];
const mute = () => [L('Silenced voice', ['markers.mute.dark_red.01'], { scale: 0.75 })];
const horror = () => [L('Creeping dread', ['markers.horror.purple.01'], { scale: 0.75 })];
const tremor = () => [L('Ground ripples', ['template_circle.out_pulse.01.loop.bluewhite'], { ...tint('#d8b878'), scale: 1.2, below: true, opacity: 0.8 })];
const bubbleShell = () => [L('Air bubble', ['markers.bubble.loop.blue'], { scale: 1.1 })];
const steam = () => [L('Steam', ['fumes.steam.white'], { scale: 1.5, opacity: 0.85 }), L('Furnace glow', ['flames.04.loop.orange'], { scale: 1.1, opacity: 0.55 })];
const magnet = () => [L('Magnetic pull', ['aura_themed.01.inward.loop.metal.01.grey'], { ...tint('#b7c4e0'), scale: 1.5 })];
const stars = () => [L('Shooting stars', ['twinkling_stars.points07.orange'], { scale: 1.4 })];
const pollen = () => [L('Drifting pollen', ['particles.swirl.greenyellow.01.01'], { ...tint('#e8e060'), scale: 1.5, opacity: 0.9 })];
const ghostly = () => [L('Spectral swirl', ['aura_themed.01.orbit.loop.cold.01.blue'], { ...tint('#d6e8ff'), scale: 1.5, opacity: 0.85 })];

export default {
  'pf2e:equipment-effects-Zdh2uO1vVYJmaqld': design("Wind streaks and cloud puffs make the flying or floating state read as being carried on air, instead of a generic ring.", flight),
  'pf2e:equipment-effects-Mf9EBLhYmZerf0nS': design("Wind streaks and cloud puffs make the flying or floating state read as being carried on air, instead of a generic ring.", flight),
  'pf2e:feat-effects-RLA7eqF2wjUPS2mf': design("Wind streaks and cloud puffs make the flying or floating state read as being carried on air, instead of a generic ring.", flight),
  'pf2e:feat-effects-Xnt4hGFXYdY5jYOk': design("Wind streaks and cloud puffs make the flying or floating state read as being carried on air, instead of a generic ring.", flight),
  'pf2e:feat-effects-ytG5XJmkOnDOTjNN': design("Wind streaks and cloud puffs make the flying or floating state read as being carried on air, instead of a generic ring.", flight),
  'pf2e:equipment-effects-1XmE0W0tVH5NXGL2': design("Wind streaks and cloud puffs make the flying or floating state read as being carried on air, instead of a generic ring.", flight),
  'pf2e:campaign-effects-UQmizjvdBfSVYoZe': design("Wind streaks and cloud puffs make the flying or floating state read as being carried on air, instead of a generic ring.", flight),
  'pf2e:equipment-effects-1S51uIRb9bnZtpFU': design("Wind streaks and cloud puffs make the flying or floating state read as being carried on air, instead of a generic ring.", flight),
  'pf2e:feat-effects-k1J2SaHPwZb2Y6Bp': design("Wind streaks and cloud puffs make the flying or floating state read as being carried on air, instead of a generic ring.", flight),
  'pf2e:equipment-effects-DXVnnltqkfFglbrn': design("Wind streaks and cloud puffs make the flying or floating state read as being carried on air, instead of a generic ring.", flight),
  'pf2e:spell-effects-ogI0byzw4v5a13eW': design("Wind streaks and cloud puffs make the flying or floating state read as being carried on air, instead of a generic ring.", flight),
  'pf2e:spell-effects-5MI2c9IgxfSeGZQo': design("Wind streaks and cloud puffs make the flying or floating state read as being carried on air, instead of a generic ring.", flight),
  'pf2e:spell-effects-MuRBCiZn5IKeaoxi': design("Wind streaks and cloud puffs make the flying or floating state read as being carried on air, instead of a generic ring.", flight),
  'pf2e:spell-effects-Ig9p2rDXGYHpEuTx': design("Wind streaks and cloud puffs make the flying or floating state read as being carried on air, instead of a generic ring.", flight),
  'pf2e:equipment-effects-Nbgf8zvHimdQqIu6': design("Wind streaks and cloud puffs make the flying or floating state read as being carried on air, instead of a generic ring.", flight),
  'pf2e:spell-effects-mvMWmP3m9Xawbwpx': design("Wind streaks and cloud puffs make the flying or floating state read as being carried on air, instead of a generic ring.", flight),
  'pf2e:spell-effects-JqrTrvwV7pYStMXz': design("Wind streaks and cloud puffs make the flying or floating state read as being carried on air, instead of a generic ring.", flight),
  'pf2e:bestiary-effects-dZDpfgU63rXbBHpe': design("Wind streaks and cloud puffs make the flying or floating state read as being carried on air, instead of a generic ring.", flight),
  'pf2e:spell-effects-uIMaMzd6pcKmMNPJ': design("A rising fire cloak with wind streaks suits a body wreathed in flame that flies.", flightFire),
  'pf2e:spell-effects-hya8NfBB1GJofTXm': design("A rising fire cloak with wind streaks suits a body wreathed in flame that flies.", flightFire),
  'pf2e:spell-effects-Fi66csT9OiBGmPZ0': design("A golden halo with drifting stars shows a radiant, winged celestial form instead of a plain ring.", flightHoly),
  'pf2e:spell-effects-3vWfew0TIrcGRjLZ': design("A golden halo with drifting stars shows a radiant, winged celestial form instead of a plain ring.", flightHoly),
  'pf2e:spell-effects-Bd86oAvK3RLN076H': design("A golden halo with drifting stars shows a radiant, winged celestial form instead of a plain ring.", flightHoly),
  'pf2e:spell-effects-iZYjxY0qYvg5yPP3': design("A golden halo with drifting stars shows a radiant, winged celestial form instead of a plain ring.", flightHoly),
  'pf2e:spell-effects-5Jc2MvOCgMszPulx': design("A golden halo with drifting stars shows a radiant, winged celestial form instead of a plain ring.", flightHoly),
  'pf2e:spell-effects-U5opnfw3DB1szFvV': design("A golden halo with drifting stars shows a radiant, winged celestial form instead of a plain ring.", flightHoly),
  'pf2e:spell-effects-W4lb3417rNDd9tCq': design("A golden halo with drifting stars shows a radiant, winged celestial form instead of a plain ring.", flightHoly),
  'pf2e:feat-effects-4siBPDdWmwks1bI5': design("A golden halo with drifting stars shows a radiant, winged celestial form instead of a plain ring.", flightHoly),
  'pf2e:spell-effects-l8HkOKfiUqd3BUwT': design("A golden halo with drifting stars shows a radiant, winged celestial form instead of a plain ring.", flightHoly),
  'pf2e:spell-effects-jy4edd6pvJvJgOSP': design("Draconic red embers with wind streaks fit dragon wings and a dragon battle form.", flightDragon),
  'pf2e:spell-effects-1pC1qjvCuAKzjYo8': design("Draconic red embers with wind streaks fit dragon wings and a dragon battle form.", flightDragon),
  'pf2e:feat-effects-UDTHsggaQfBlZCfR': design("Pale bone-colored motes and wind streaks fit wings of bone and sinew.", flightBone),
  'pf2e:spell-effects-MUOZtcVJPkLJtDP5': design("Crackling storm energy with wind streaks matches flying as living lightning or a storm.", flightStorm),
  'pf2e:spell-effects-8GUkKvCeI0xljCOk': design("Crackling storm energy with wind streaks matches flying as living lightning or a storm.", flightStorm),
  'pf2e:equipment-effects-uC6KjfiWrTBXYtP8': design("Crackling storm energy with wind streaks matches flying as living lightning or a storm.", flightStorm),
  'pf2e:bestiary-effects-eoIEdBBzgyChUmB9': design("A pale moonbeam column with wind streaks matches riding the moonbeams.", flightMoon),
  'pf2e:spell-effects-sILRkGTwoBywy0BU': design("A thin drifting mist shows the body turned to vapor.", vapor),
  'pf2e:spell-effects-ElkXovNrHB0Doi6O': design("Speed lines over a faint spinning ring read as a burst of haste or extra speed.", swift),
  'pf2e:spell-effects-PQHP7Oph3BQX1GhF': design("Speed lines over a faint spinning ring read as a burst of haste or extra speed.", swift),
  'pf2e:spell-effects-7vIUF5zbvHzVcJA0': design("Speed lines over a faint spinning ring read as a burst of haste or extra speed.", swift),
  'pf2e:spell-effects-HtaDbgTIzdiTiKLX': design("Speed lines over a faint spinning ring read as a burst of haste or extra speed.", swift),
  'pf2e:spell-effects-ThFug45WHkQQXcoF': design("Speed lines over a faint spinning ring read as a burst of haste or extra speed.", swift),
  'pf2e:feat-effects-AOqlEOF3Q7w9XYFp': design("Speed lines over a faint spinning ring read as a burst of haste or extra speed.", swift),
  'pf2e:spell-effects-57lnrCzGUcNUBP2O': design("Speed lines over a faint spinning ring read as a burst of haste or extra speed.", swift),
  'pf2e:equipment-effects-EgAmT4WENb6UNSdJ': design("Speed lines over a faint spinning ring read as a burst of haste or extra speed.", swift),
  'pf2e:feat-effects-nplVDMxYDqdMC32k': design("Speed lines over a faint spinning ring read as a burst of haste or extra speed.", swift),
  'pf2e:equipment-effects-2Bds6d4UGQZqYSZM': design("Silvery metallic motes with speed lines fit quicksilver-fast movement.", quicksilver),
  'pf2e:equipment-effects-6PNLBIdlqqWNCFMy': design("Silvery metallic motes with speed lines fit quicksilver-fast movement.", quicksilver),
  'pf2e:equipment-effects-988f6NpOo4YzFzIr': design("Silvery metallic motes with speed lines fit quicksilver-fast movement.", quicksilver),
  'pf2e:equipment-effects-VPtsrpbP0AE642al': design("Silvery metallic motes with speed lines fit quicksilver-fast movement.", quicksilver),
  'pf2e:spell-effects-1lPlwrQx2yt3PIco': design("Pale mist with speed lines fits a ghostly dash through terrain.", ghostRush),
  'pf2e:equipment-effects-z480XhE3nft1TQDj': design("Smoke trailing the body fits the smoky speed boost.", smokeSpeed),
  'pf2e:equipment-effects-s4yWMBNFpBRFqSvm': design("The description is a source of light; a soft glowing halo with sparkles shows it instead of a small orb marker.", glow),
  'pf2e:feat-effects-263Cd5JMj8Lgc9yz': design("The description is a source of light; a soft glowing halo with sparkles shows it instead of a small orb marker.", glow),
  'pf2e:spell-effects-eRRiss7y7TsneiEu': design("The description is a source of light; a soft glowing halo with sparkles shows it instead of a small orb marker.", glow),
  'pf2e:spell-effects-hpbCDbDOoVyhOmck': design("The description is a source of light; a soft glowing halo with sparkles shows it instead of a small orb marker.", glow),
  'pf2e:spell-effects-cVVZXNbV0nElVOPZ': design("The description is a source of light; a soft glowing halo with sparkles shows it instead of a small orb marker.", glow),
  'pf2e:equipment-effects-XgIY3j2VFUSQ5Or9': design("The description is a source of light; a soft glowing halo with sparkles shows it instead of a small orb marker.", glow),
  'pf2e:spell-effects-Hc8e3aU9yLKPSw8o': design("The description is a source of light; a soft glowing halo with sparkles shows it instead of a small orb marker.", glow),
  'pf2e:boons-and-curses-i8hVCNQTBFPJ1qEG': design("The description is a source of light; a soft glowing halo with sparkles shows it instead of a small orb marker.", glow),
  'pf2e:equipment-effects-j8dPwfhUuIeDgHYT': design("The description is a source of light; a soft glowing halo with sparkles shows it instead of a small orb marker.", glow),
  'pf2e:spell-effects-6ArAZeZyYSNLI0X5': design("The description is a source of light; a soft glowing halo with sparkles shows it instead of a small orb marker.", glow),
  'pf2e:equipment-effects-Sf6UO6vgCeicggOK': design("The description is a source of light; a soft glowing halo with sparkles shows it instead of a small orb marker.", glow),
  'pf2e:equipment-effects-p1pxUzwgWZ9l9jmD': design("The description is a source of light; a soft glowing halo with sparkles shows it instead of a small orb marker.", glow),
  'pf2e:spell-effects-IXS15IQXYCZ8vsmX': design("Watching eyes show the granted sight (darkvision or sensory enhancement) instead of a generic light orb.", eyesDark),
  'pf2e:spell-effects-inNfTmtWpsxeGBI9': design("Watching eyes show the granted sight (darkvision or sensory enhancement) instead of a generic light orb.", eyesDark),
  'pf2e:spell-effects-znWiM5RYLvf8STmR': design("Watching eyes show the granted sight (darkvision or sensory enhancement) instead of a generic light orb.", eyesDark),
  'pf2e:spell-effects-UAiaJYUDLtLToRUU': design("Watching eyes show the granted sight (darkvision or sensory enhancement) instead of a generic light orb.", eyesDark),
  'pf2e:feat-effects-3GPh6O3PJxORytAC': design("Watching eyes show the granted sight (darkvision or sensory enhancement) instead of a generic light orb.", eyesDark),
  'pf2e:spell-effects-T5bk6UH7yuYog1Fp': design("Watching eyes show the granted sight (darkvision or sensory enhancement) instead of a generic light orb.", eyesDark),
  'pf2e:spell-effects-eQzFYXLYPrGc9EBI': design("Watching eyes show the granted sight (darkvision or sensory enhancement) instead of a generic light orb.", eyesDark),
  'pf2e:feat-effects-0v30plBl9TuuJQ5F': design("Watching eyes show the granted sight (darkvision or sensory enhancement) instead of a generic light orb.", eyesDark),
  'pf2e:equipment-effects-parbYdReJWd08fGl': design("Watching eyes show the granted sight (darkvision or sensory enhancement) instead of a generic light orb.", eyesDark),
  'pf2e:equipment-effects-g8JS6wsw5sRWOJLg': design("Watching eyes show the granted sight (darkvision or sensory enhancement) instead of a generic light orb.", eyesDark),
  'pf2e:feat-effects-qSKVcw6brzrvfhUM': design("Watching eyes show the granted sight (darkvision or sensory enhancement) instead of a generic light orb.", eyesDark),
  'pf2e:equipment-effects-ZxT8Shp8NZaQRjlQ': design("A cloud of eyes fits all-around vision and sight in every direction.", eyesMany),
  'pf2e:spell-effects-BfaFe1cI9IkpvmmY': design("A cloud of eyes fits all-around vision and sight in every direction.", eyesMany),
  'pf2e:feat-effects-a7qiSYdlaIRPe57i': design("A cloud of eyes fits all-around vision and sight in every direction.", eyesMany),
  'pf2e:spell-effects-OH3sdHE6xWwOjq9v': design("A cloud of eyes fits all-around vision and sight in every direction.", eyesMany),
  'pf2e:bestiary-effects-Hjb8iwGGxkyhiz7E': design("A baleful red eye fits a malevolent gaze.", eyesMenace),
  'pf2e:feat-effects-tCMVyxQhzYCjBQtK': design("Sticky web strands fit webbing or spider-sticky ground rather than a plain ring.", web),
  'pf2e:equipment-effects-W3BCLbX6j1IqL0uB': design("Sticky web strands fit webbing or spider-sticky ground rather than a plain ring.", web),
  'pf2e:equipment-effects-4JULykNCgQoypsu8': design("Sticky web strands fit webbing or spider-sticky ground rather than a plain ring.", web),
  'pf2e:equipment-effects-wNCxSxruzLVGtLE4': design("Sticky web strands fit webbing or spider-sticky ground rather than a plain ring.", web),
  'pf2e:equipment-effects-YI7QQqXO6nosaAKr': design("Sticky web strands fit webbing or spider-sticky ground rather than a plain ring.", web),
  'pf2e:spell-effects-rjM25qfw5BKj9h97': design("Grasping green growth fits being held by entangling plants.", entangle),
  'pf2e:spell-effects-TwtUIEyenrtAbeiX': design("Grasping green growth fits being held by entangling plants.", entangle),
  'pf2e:spell-effects-5RiskDnSXaRI6F4n': design("Grasping green growth fits being held by entangling plants.", entangle),
  'pf2e:spell-effects-nFOJ53IkO5khO4Rr': design("Grasping green growth fits being held by entangling plants.", entangle),
  'pf2e:spell-effects-tu8FyCtmL3YYR2jL': design("Living vines wrapping the body fit plant growth, roots and plant forms.", vines),
  'pf2e:spell-effects-ZGzhNFB3SM8owk85': design("Living vines wrapping the body fit plant growth, roots and plant forms.", vines),
  'pf2e:equipment-effects-T2eCVO5lN8cNMzyq': design("Living vines wrapping the body fit plant growth, roots and plant forms.", vines),
  'pf2e:bestiary-effects-NAdAO5ElcSlSBkza': design("Living vines wrapping the body fit plant growth, roots and plant forms.", vines),
  'pf2e:bestiary-effects-CqMaZrZfU3Qtf3MI': design("Living vines wrapping the body fit plant growth, roots and plant forms.", vines),
  'pf2e:spell-effects-z2PYQCsDDoBZUwR5': design("Living vines wrapping the body fit plant growth, roots and plant forms.", vines),
  'pf2e:feat-effects-PMHwCrnh9W4sMu5b': design("Living vines wrapping the body fit plant growth, roots and plant forms.", vines),
  'pf2e:feat-effects-JW93FDTAOUNuCgIu': design("Living vines wrapping the body fit plant growth, roots and plant forms.", vines),
  'pf2e:bestiary-effects-7fTxNaznBfjrGTjt': design("Drifting snowflakes with cold motes fit cold and frost that chills or slows the body.", ice),
  'pf2e:bestiary-effects-AxdLeZcz2VVdfvRo': design("Drifting snowflakes with cold motes fit cold and frost that chills or slows the body.", ice),
  'pf2e:spell-effects-I4PsUAaYSUJ8pwKC': design("Drifting snowflakes with cold motes fit cold and frost that chills or slows the body.", ice),
  'pf2e:bestiary-effects-GdkIUl4w8yAJxqdO': design("Drifting snowflakes with cold motes fit cold and frost that chills or slows the body.", ice),
  'pf2e:spell-effects-cfREcFI2ZhrOlm3C': design("Drifting snowflakes with cold motes fit cold and frost that chills or slows the body.", ice),
  'pf2e:feat-effects-E9GohJi4hZ4vSLNu': design("Drifting snowflakes with cold motes fit cold and frost that chills or slows the body.", ice),
  'pf2e:bestiary-effects-josVmrDMWcTinHFK': design("Frost-blue chains fit a speed penalty from shackling cold.", iceChain),
  'pf2e:spell-effects-EftEpvhOKwDn63eL': design("A cold, drifting fog fits the frozen fog that slows movement.", coldFog),
  'pf2e:bestiary-effects-f8rncEs06bqcn3LZ': design("Blowing sand and grit fits a sandstorm or desert wind.", sandstorm),
  'pf2e:feat-effects-gcR66Xgi12ICOVt7': design("Blowing sand and grit fits a sandstorm or desert wind.", sandstorm),
  'pf2e:spell-effects-qO1Gj9l8gh5CMEbf': design("Billowing tan sand fits a body of sand.", sandForm),
  'pf2e:spell-effects-zPPZz6lcp87ALUde': design("Drifting grey ash fits a body turned to ash.", ashForm),
  'pf2e:bestiary-effects-xmES7HVxM7L3j1EN': design("Rising green fumes fit a foul stench or noxious miasma.", stench),
  'pf2e:bestiary-effects-wX9L6fbqVMLP05hn': design("Rising green fumes fit a foul stench or noxious miasma.", stench),
  'pf2e:bestiary-effects-xXfzzNaBOqDUbYBD': design("Rising green fumes fit a foul stench or noxious miasma.", stench),
  'pf2e:bestiary-effects-uB3CVn3momZO9h0L': design("Rising green fumes fit a foul stench or noxious miasma.", stench),
  'pf2e:bestiary-effects-xhkVNfgFMUhalqib': design("Rising green fumes fit a foul stench or noxious miasma.", stench),
  'pf2e:bestiary-effects-5KatA3QnT1zYLxGv': design("Rising green fumes fit a foul stench or noxious miasma.", stench),
  'pf2e:bestiary-effects-hQsqr2sRPp9rNm4U': design("Rising green fumes fit a foul stench or noxious miasma.", stench),
  'pf2e:bestiary-effects-6fPk2jOEp7LOsV7J': design("Rising green fumes fit a foul stench or noxious miasma.", stench),
  'pf2e:bestiary-effects-qecXxM3ERv8MvTPh': design("Rising green fumes fit a foul stench or noxious miasma.", stench),
  'pf2e:equipment-effects-fuQVJiPPUsvL6fi5': design("Sulfurous yellow-green fumes fit a sulfur bomb.", sulfur),
  'pf2e:bestiary-effects-zGWc4q0rXW9eMoYT': design("A violet fog is the description of this effect.", violetFog),
  'pf2e:spell-effects-Ore1RvtyWdioF5QW': design("Soft drifting mist fits mists, clouds and obscuring vapor.", mist),
  'pf2e:equipment-effects-FV5d8zdo8CGZuRbg': design("Soft drifting mist fits mists, clouds and obscuring vapor.", mist),
  'pf2e:equipment-effects-vrQeNhy3M48RBH4B': design("Soft drifting mist fits mists, clouds and obscuring vapor.", mist),
  'pf2e:spell-effects-6TGcfVyzzVHEo7ke': design("Corrosive green bubbling fits acid.", acid),
  'pf2e:equipment-effects-bHCpqwKH9JM8FZa6': design("Corrosive green bubbling fits acid.", acid),
  'pf2e:equipment-effects-wY7yV6a3SICudb1w': design("Corrosive green bubbling fits acid.", acid),
  'pf2e:bestiary-effects-7qoZauizAKfPIXeu': design("Licking flames with embers fit burning, molten or tar fire effects.", fire),
  'pf2e:bestiary-effects-PeQ2isu6YFcHhQyp': design("Licking flames with embers fit burning, molten or tar fire effects.", fire),
  'pf2e:spell-effects-TrmNSuv6zWEiceqn': design("Licking flames with embers fit burning, molten or tar fire effects.", fire),
  'pf2e:spell-effects-4dnt1P2SfcePzkrF': design("Licking flames with embers fit burning, molten or tar fire effects.", fire),
  'pf2e:bestiary-effects-drh6p7VWdByUvRlf': design("A crackling electric orb fits electricity or storm effects.", lightning),
  'pf2e:equipment-effects-ogtcaPeypLDiUXMS': design("A crackling electric orb fits electricity or storm effects.", lightning),
  'pf2e:equipment-effects-2ytxPqhGyLtEjYxW': design("A crackling electric orb fits electricity or storm effects.", lightning),
  'pf2e:bestiary-effects-u9b233QynLAPKPty': design("A crackling electric orb fits electricity or storm effects.", lightning),
  'pf2e:spell-effects-SjxqjPDILhQWUcWf': design("A crackling electric orb fits electricity or storm effects.", lightning),
  'pf2e:spell-effects-81TfqzTfIqkQA4Dy': design("A crackling electric orb fits electricity or storm effects.", lightning),
  'pf2e:feat-effects-z3uyCMBddrPK5umr': design("A red, pulsing martial aura fits rage and frenzy rather than a temp HP heart or plain ring.", rage),
  'pf2e:feat-effects-RoGEt7lrCdfaueB9': design("A red, pulsing martial aura fits rage and frenzy rather than a temp HP heart or plain ring.", rage),
  'pf2e:bestiary-effects-tJx9B2e3AET6PbJD': design("A red, pulsing martial aura fits rage and frenzy rather than a temp HP heart or plain ring.", rage),
  'pf2e:bestiary-effects-94ZHsHjS1OWHa2rg': design("A red, pulsing martial aura fits rage and frenzy rather than a temp HP heart or plain ring.", rage),
  'pf2e:feat-effects-rvyeOU7TQTLnKj03': design("A red, pulsing martial aura fits rage and frenzy rather than a temp HP heart or plain ring.", rage),
  'pf2e:campaign-effects-ALYd08DB00ZeoHAp': design("A red, pulsing martial aura fits rage and frenzy rather than a temp HP heart or plain ring.", rage),
  'pf2e:campaign-effects-e8K0YTKxzf0bhayh': design("A circle of stars fits fortune and good luck.", luck),
  'pf2e:spell-effects-C9IBDViaUxVq0Jzn': design("A circle of stars fits fortune and good luck.", luck),
  'pf2e:bestiary-effects-haDTCFX3EhkdF9sz': design("A circle of stars fits fortune and good luck.", luck),
  'pf2e:feat-effects-lFIUuFrNey4kD4Md': design("A circle of stars fits fortune and good luck.", luck),
  'pf2e:spell-effects-lTL5VwNrZ5xiitGV': design("A circle of stars fits fortune and good luck.", luck),
  'pf2e:feat-effects-gtpqoCOWhF9Pjb8G': design("A circle of stars fits fortune and good luck.", luck),
  'pf2e:spell-effects-fvIlSZPwojixVvyZ': design("A circle of stars fits fortune and good luck.", luck),
  'pf2e:feat-effects-m8QCmsy4WFQCIC7t': design("A circle of stars fits fortune and good luck.", luck),
  'pf2e:equipment-effects-VKdiRnhrsgQTFSCM': design("A circle of stars fits fortune and good luck.", luck),
  'pf2e:bestiary-effects-wwt86BeAHFA5VRuI': design("An ominous purple marker fits bad luck and misfortune.", misfortune),
  'pf2e:bestiary-effects-yxgHWK2rTZKKAzDN': design("An ominous purple marker fits bad luck and misfortune.", misfortune),
  'pf2e:bestiary-effects-QSy3KaLI1AYTR7rP': design("An ominous purple marker fits bad luck and misfortune.", misfortune),
  'pf2e:spell-effects-AmsVO5Q6078mEvNt': design("An ominous purple marker fits bad luck and misfortune.", misfortune),
  'pf2e:equipment-effects-a2DB0gqfriXhU1PU': design("An ominous purple marker fits bad luck and misfortune.", misfortune),
  'pf2e:spell-effects-3hDKcbhn0j6DsRgm': design("Pale moonlight fits moon-based effects.", moon),
  'pf2e:spell-effects-zRKw95WMezr6TgiT': design("Pale moonlight fits moon-based effects.", moon),
  'pf2e:equipment-effects-QrsPKOFuo3qzgxw5': design("Rising bubbles fit water breathing, drowning air supply and water barriers.", bubbles),
  'pf2e:equipment-effects-UDfVCATxdLdSzJYJ': design("Rising bubbles fit water breathing, drowning air supply and water barriers.", bubbles),
  'pf2e:equipment-effects-2iR5uP6vgPzgKKNO': design("Rising bubbles fit water breathing, drowning air supply and water barriers.", bubbles),
  'pf2e:other-effects-2u26bmArDPuoCljc': design("Rising bubbles fit water breathing, drowning air supply and water barriers.", bubbles),
  'pf2e:bestiary-effects-UxNq9uo1GpDYTi5Z': design("Rising bubbles fit water breathing, drowning air supply and water barriers.", bubbles),
  'pf2e:feat-effects-UBC6HbfqbfPQYlMq': design("Rising bubbles fit water breathing, drowning air supply and water barriers.", bubbles),
  'pf2e:spell-effects-LMXxICrByo7XZ3Q3': design("A cool blue sheet of falling water fits a downpour.", rain),
  'pf2e:bestiary-effects-rpxdrOlzY2SOtMWB': design("Swirling wind around the body fits a wind barrier or whirlwind form.", whirl),
  'pf2e:campaign-effects-MH3VWOysJ8XboONX': design("Swirling wind around the body fits a wind barrier or whirlwind form.", whirl),
  'pf2e:feat-effects-q6UokHWSEcEYWmvh': design("Swirling wind around the body fits a wind barrier or whirlwind form.", whirl),
  'pf2e:spell-effects-A9T9NIummN3ShJwz': design("Gentle wind lines fit a breeze.", breeze),
  'pf2e:feat-effects-7MQLLkQACZt8cspt': design("Gentle wind lines fit a breeze.", breeze),
  'pf2e:feat-effects-UMLqhBMT98flcmJi': design("A slick dark oil layer fits grease, oil and mud.", grease),
  'pf2e:feat-effects-jDlnvm9QjA7A2weD': design("A slick dark oil layer fits grease, oil and mud.", grease),
  'pf2e:bestiary-effects-75B7z49jfQbWcSy9': design("A slick dark oil layer fits grease, oil and mud.", grease),
  'pf2e:equipment-effects-d84cOfu0bEF8RBvK': design("A slick dark oil layer fits grease, oil and mud.", grease),
  'pf2e:spell-effects-ciQhlQbQcarzRYzf': design("Green ooze bubbles fit ooze and slime.", ooze),
  'pf2e:equipment-effects-m77YnEX1T7bdk7Qa': design("Green ooze bubbles fit ooze and slime.", ooze),
  'pf2e:spell-effects-0Cyf07wboRp4CmcQ': design("Earthy orbiting motes fit a heavy, primal beast form.", dino),
  'pf2e:spell-effects-KkDRRDuycXwKPa6n': design("Earthy orbiting motes fit a heavy, primal beast form.", dino),
  'pf2e:spell-effects-oJbcmpBSHwmx6FD4': design("Earthy orbiting motes fit a heavy, primal beast form.", dino),
  'pf2e:spell-effects-T6XnxvsgvvOrpien': design("Earthy orbiting motes fit a heavy, primal beast form.", dino),
  'pf2e:spell-effects-iOKhr2El8R6cz6YI': design("Earthy orbiting motes fit a heavy, primal beast form.", dino),
  'pf2e:spell-effects-542Keo6txtq7uvqe': design("Earthy orbiting motes fit a heavy, primal beast form.", dino),
  'pf2e:spell-effects-IWD5RehCxZVfgrX9': design("Earthy orbiting motes fit a heavy, primal beast form.", dino),
  'pf2e:spell-effects-tfdDpf9xSWgQer5g': design("Twinkling stars fit a form of cosmic starlight.", cosmic),
  'pf2e:feat-effects-Y96a1OedsU8PVf7z': design("Twinkling stars fit a form of cosmic starlight.", cosmic),
  'pf2e:spell-effects-jeH78c7kyk376PKS': design("Drifting fairy lights fit fey magic.", fey),
  'pf2e:spell-effects-zjFN1cJEl3AMKiVs': design("Drifting fairy lights fit fey magic.", fey),
  'pf2e:spell-effects-pcK88HqL6LjBNH2h': design("Glittering sparkles fit faerie dust.", dust),
  'pf2e:spell-effects-LHREWCGPkWsc4GGJ': design("Glittering sparkles fit faerie dust.", dust),
  'pf2e:equipment-effects-F6YMKMbhzWBd9A07': design("Glittering sparkles fit faerie dust.", dust),
  'pf2e:spell-effects-ZK90sMiPCJzet8Rg': design("Glittering sparkles fit faerie dust.", dust),
  'pf2e:feat-effects-Nv70aqcQgCBpDYp8': design("A ring of dark smoke fits shadow and darkness cloaks.", shadow),
  'pf2e:spell-effects-mzDgsuuo5wCgqyxR': design("A ring of dark smoke fits shadow and darkness cloaks.", shadow),
  'pf2e:spell-effects-IcQMLYWYDMZbq3XE': design("A ring of dark smoke fits shadow and darkness cloaks.", shadow),
  'pf2e:bestiary-effects-i3942RucZD9OHbAE': design("A ring of dark smoke fits shadow and darkness cloaks.", shadow),
  'pf2e:bestiary-effects-dl8qj25dK6PtO5Y7': design("A ring of dark smoke fits shadow and darkness cloaks.", shadow),
  'pf2e:feat-effects-7HXxtWO5MAJWkwnt': design("A mute marker fits being unable to speak.", mute),
  'pf2e:bestiary-effects-aOpSI5tApXF5xHCM': design("A horror marker fits dread, unsettling auras and terror.", horror),
  'pf2e:bestiary-effects-MxArXuo8JRCm1hus': design("A horror marker fits dread, unsettling auras and terror.", horror),
  'pf2e:spell-effects-FT5Tt2DKBRutDqbV': design("A horror marker fits dread, unsettling auras and terror.", horror),
  'pf2e:spell-effects-sipLHLOyS7sQ0KQV': design("A horror marker fits dread, unsettling auras and terror.", horror),
  'pf2e:equipment-effects-uHZ23fBG9HIdK5ht': design("Ground ripples radiating from the feet fit tremorsense.", tremor),
  'pf2e:spell-effects-7cYUiOONB2lZfSaA': design("Ground ripples radiating from the feet fit tremorsense.", tremor),
  'pf2e:feat-effects-ebCWQB5nfK19GpY5': design("Ground ripples radiating from the feet fit tremorsense.", tremor),
  'pf2e:spell-effects-nUJSdm4fy6fcwsvv': design("A shell of air fits a life bubble.", bubbleShell),
  'pf2e:feat-effects-cmCLIMgtd4TLA23p': design("Billowing steam with embers fits a steam-powered armor stance.", steam),
  'pf2e:feat-effects-PdFisHX9ZJmKEKCv': design("Metal motes drawn inward fit a magnetic field.", magnet),
  'pf2e:feat-effects-RXbfq6oqzVnW6xOV': design("Falling stars fit a stance of shooting stars.", stars),
  'pf2e:feat-effects-8hmw9L2ORKz6Z6Bc': design("Drifting yellow-green pollen fits a pollen cloud.", pollen),
  'pf2e:spell-effects-EScdpppYsf9KhG4D': design("A pale spectral swirl fits ghost touch and spectral effects.", ghostly),
};
