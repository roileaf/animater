// Native visual vocabulary. Independently authored composition, not macro code.
import { paceGeneratedMotion } from "../../../engines/motion/motion-pacing.mjs";
import { applyCatalogMotion, SPELL_MOTION_REVIEWS } from '../../shared/catalog-motion.mjs';
import {
  DELIVERY_MOTIFS,
  DELIVERY_DESIGNS,
} from "./spell-delivery-designs.mjs";
import { paceDeliveryEffects } from "./spell-delivery-timing.mjs";
import { DEEP_SPELL_MOTIFS, DEEP_SPELL_DESIGNS, deepSpellLayers } from "./spell-deep-designs.mjs";
import { timedStages } from "../../../engines/playback/composition.mjs";
import { UTILITY_SPELL_MOTIFS, UTILITY_SPELL_DESIGNS, utilitySpellLayers } from './spell-utility-designs.mjs';
import { applySpellVisualIdentity } from './spell-visual-identity.mjs';
import { FEAR_SPELL_MOTIFS, FEAR_SPELL_DESIGNS, fearSpellLayers } from './spell-fear-designs.mjs';
import { BROAD_VARIETY_MOTIFS, BROAD_VARIETY_DESIGNS, broadVarietyLayers } from './spell-broad-variety-designs.mjs';
import {SPECIFIC_FALLBACK_MOTIFS,SPECIFIC_FALLBACK_DESIGNS,specificFallbackLayers} from './spell-specific-fallbacks.mjs';
import {GAP_SPELL_MOTIFS,GAP_SPELL_DESIGNS,gapSpellLayers} from './spell-gap-designs.mjs';
import {FIRE_SPELL_MOTIFS,FIRE_SPELL_DESIGNS,fireSpellLayers} from './spell-fire-designs.mjs';
import {FIX_SPELL_MOTIFS,FIX_SPELL_DESIGNS,fixSpellLayers,applyFixStyle,capSpellStages} from './spell-fix-designs.mjs';
const motif = (label, pattern, roots = {}) => ({ label, pattern, ...roots });
export const SPELL_MOTIFS = {
  smolder: motif("Finger snap and smolder", "smolder", {
    hit: "flames,bonfire",
    aura: "fireflies,flames",
  }),
  frostOrb: motif("Enclosing frost orb", "enclose", {
    hit: "energy_field,ice_spikes.radial.burst",
    aura: "ice_spikes.radial.loop",
  }),
  icyRay: motif("Icy ray and frost scar", "ray", {
    bolt: "ray_of_frost",
    hit: "impact_themed.ice,ice_spikes.radial.burst",
  }),
  needles: motif("Three metal needles", "needles", {
    cast: "glint",
    bolt: "dart,arrow",
    hit: "melee_generic.piercing,impact",
  }),
  flameRay: motif("Heat ray", "ray", {
    bolt: "scorching_ray",
    hit: "fire_jet,impact",
  }),
  thrownFlame: motif("Thrown flame", "object", {
    bolt: "fire_bolt",
    hit: "impact_themed.fire,impact",
    cast: "flames",
  }),
  forceShards: motif("Solidified force shards", "volley", {
    bolt: "magic_missile",
    hit: "impact",
  }),
  smallArc: motif("Leaping electrical arc", "chain", {
    bolt: "electric_arc",
    hit: "static_electricity.01",
  }),
  stormChain: motif("Propagating lightning chain", "chain", {
    bolt: "chain_lightning",
    hit: "static_electricity.03",
  }),
  thunderFall: motif("Lightning followed by thunder", "thunder", {
    hit: "lightning_strike",
    aura: "soundwave.01,soundwave.02",
  }),
  claws: motif("Morphed claw strike", "claws", {
    cast: "claws",
    hit: "claws,melee_attack",
    aura: "liquid.splash02",
  }),
  acidHand: motif("Acid talon and corrosion", "grasp", {
    hit: "claws",
    aura: "fumes,liquid.splash",
  }),
  waterJet: motif("Pressure jet and push", "push", {
    bolt: "gust_of_wind,water_splash",
    hit: "water_splash,liquid.splash",
  }),
  geyser: motif("Upward water spout", "eruption", {
    hit: "water_splash",
    aura: "liquid.splash",
  }),
  looseObject: motif("Lift and hurl loose object", "object", {
    bolt: "boulder,throwable",
    hit: "side_impact,impact",
  }),
  divineRay: motif("Divine beam and radiant flare", "ray", {
    bolt: "energy_beam.normal.yellow,energy_beam.normal",
    hit: "divine_smite",
  }),
  energyRay: motif("Focused energy ray", "ray", {
    cast: "glint",
    bolt: "energy_beam.normal",
    hit: "impact",
  }),
  moonRay: motif("Freezing moonlight beam", "ray", {
    cast: "cast_generic.03.white,cast_generic.02.blue,glint",
    bolt: "ray_of_frost,energy_beam.normal",
    hit: "impact_themed.ice,glint",
  }),
  lunarRay: motif("Silvery moonlight ray", "ray", {
    cast: "cast_generic.03.white,cast_generic.02.blue,glint",
    bolt: "energy_beam.normal.blue,energy_beam.normal",
    hit: "glint,sacred_flame",
  }),
  darkRay: motif("Unholy darkness beam", "ray", {
    bolt: "energy_beam.normal.dark_purplered,energy_beam.normal,disintegrate",
    hit: "impact_themed.darkness,energy_field",
  }),
  toxicRay: motif("Toxic spore beam", "ray", {
    bolt: "energy_beam.normal.dark_green,energy_beam.normal,energy_conduit",
    hit: "fumes,liquid.splash",
    aura: "fumes",
  }),
  prismaticRay: motif("Colored light ray", "ray", {
    bolt: "energy_beam.normal.bluepink,energy_beam.normal",
    hit: "particle_burst,glint",
  }),
  waterBolt: motif("Hurled saltwater bolt", "movingGlob", {
    bolt: "liquid.blob.blue",
    hit: "water_splash,liquid.splash.blue",
    aura: "water_splash",
  }),
  inkJet: motif("Viscous ink shot", "movingGlob", {
    bolt: "liquid.blob.purple,liquid.blob",
    hit: "liquid.splash_side.dark_black,liquid.splash",
    aura: "liquid.splash_side.grey,liquid.splash",
  }),
  iceShard: motif("Hollow icicle projectile", "missile", {
    bolt: "spell_projectile.ice_shard,snowball_toss",
    hit: "impact_themed.ice,ice_spikes.radial.burst",
    aura: "ice_spikes.radial.loop",
  }),
  acidArrow: motif("Corroding acid arrow", "missile", {
    bolt: "arrow,spell_projectile.poison",
    hit: "liquid.splash.green",
    aura: "fumes",
  }),
  acidSplash: motif("Hurled acid glob", "movingGlob", {
    bolt: "liquid.blob.green",
    hit: "liquid.splash.green",
    aura: "fumes",
  }),
  forceBolt: motif("Single force missile", "missile", {
    bolt: "magic_missile,spell_projectile",
    hit: "impact",
  }),
  vitalBolt: motif("Life energy missile", "missile", {
    bolt: "spell_projectile.heart,magic_missile",
    hit: "healing_generic,cure_wounds",
    aura: "healing_generic",
  }),
  thunderSphere: motif("Concentrated electrical sphere", "movingGlob", {
    cast: "lightning_orb.01.complete,lightning_ball",
    bolt: "lightning_ball",
    hit: "static_electricity,impact_themed.electricity",
    aura: "static_electricity",
  }),
  spiritualArmament: motif("Ghostly weapon flung and returned", "armament", {
    bolt: "spiritual_weapon",
    hit: "melee_generic,impact",
    aura: "glint",
  }),
  spiritualWeapon: motif("Ghostly weapon strikes beside foe", "spiritWeapon", {
    hit: "spiritual_weapon",
    aura: "melee_generic,impact",
  }),
  fieryBlade: motif("Conjured fiery blade strike", "weapon", {
    cast: "flames",
    hit: "sword.melee.fire,melee_attack,scimitar",
    aura: "flames",
  }),
  groundCrush: motif("Ground opens then closes", "groundCrush", {
    hit: "ground_cracks",
    aura: "eruption,falling_rocks",
  }),
  shadowTendrils: motif("Shadow tendrils rise and grasp", "tendrils", {
    area: "black_tentacles",
    hit: "black_tentacles,arms_of_hadar",
    aura: "smoke",
  }),
  hoveringFlame: motif("Conjured hovering flame", "hoveringFlame", {
    hit: "flaming_sphere.200px.orange,flames",
    aura: "fireflies",
  }),
  weaponThrow: motif("Telekinetic weapon flung and returned", "armament", {
    bolt: "spiritual_weapon",
    hit: "melee_generic,impact",
  }),
  reanimate: motif("Corpse reanimation cue", "reanimate", {
    cast: "magic_signs.circle.01.necromancy",
    hit: "bone.return,energy_strands",
    aura: "smoke",
  }),
  incarnateFey: motif("Faerie arrival cue", "arrival", {
    cast: "magic_signs.circle.01.conjuration",
    hit: "fairies,butterflies",
    aura: "swirling_sparkles",
  }),
  incarnateBones: motif("Bone and dark-cloud arrival cue", "arrival", {
    cast: "magic_signs.circle.01.necromancy",
    hit: "bone.return,smoke",
    aura: "smoke",
  }),
  incarnateRose: motif("Flowering plant arrival cue", "arrival", {
    cast: "magic_signs.circle.01.conjuration",
    hit: "plant_growth,entangle",
    aura: "swirling_leaves",
  }),
  incarnateTempest: motif("Spectral whirlwind arrival cue", "arrival", {
    cast: "magic_signs.circle.01.necromancy",
    hit: "whirlwind,smoke",
    aura: "smoke,energy_strands",
  }),
  incarnateKaiju: motif("Ground-shaking monster arrival cue", "arrival", {
    cast: "magic_signs.circle.01.conjuration",
    hit: "burrow,eruption",
    aura: "ground_cracks,smoke",
  }),
  restore: motif("Vitality bloom", "restore", {
    hit: "healing_generic",
    aura: "particles.outward,cure_wounds",
  }),
  soothe: motif("Gentle mental restoration", "soothe", {
    hit: "cure_wounds",
    aura: "swirling_sparkles,particles",
  }),
  voidCollapse: motif("Void contraction", "collapse", {
    hit: "energy_field",
    aura: "toll_the_dead,smoke",
  }),
  lifeWarp: motif("Localized life-force distortion", "warp", {
    hit: "energy_strands,energy_field",
    aura: "shimmer",
  }),
  drain: motif("Life force returns to caster", "drain", {
    bolt: "energy_strands,energy_beam",
    hit: "liquid.splash02,impact",
    aura: "healing_generic",
  }),
  mentalJolt: motif("Mental jolt", "jolt", {
    hit: "dizzy_stars,shatter",
    aura: "shimmer",
  }),
  phantomPain: motif("Recurring phantom pain", "pain", {
    hit: "shatter",
    aura: "energy_strands,shimmer",
  }),
  dread: motif("Dread and tremor", "fear", {
    hit: "toll_the_dead",
    aura: "smoke,energy_strands",
  }),
  forceShield: motif("Force shield raised", "shield", {
    hit: "shield.01.intro",
    aura: "shield.01.loop",
  }),
  glassShield: motif("Translucent glass shell", "glass", {
    cast: "glint",
    hit: "shield.01.intro",
    aura: "shimmer,glint",
  }),
  boneShield: motif("Bone assembly and guard", "bone", {
    cast: "bone.return,glint",
    hit: "shield_themed,shield.01.intro",
    aura: "ward",
  }),
  fireShield: motif("Hovering flame shield", "fireShield", {
    hit: "shield_themed.above.fire,shield.01.intro",
    aura: "fire_ring,flames",
  }),
  swiftTime: motif("Accelerating time echoes", "haste", {
    aura: "wind_lines,swirling_sparkles",
  }),
  slowTime: motif("Decelerating time ring", "slow", {
    aura: "magic_signs,energy_field",
  }),
  flight: motif("Air lift and trailing shadow", "flight", {
    hit: "wind_stream,swirling_feathers",
    aura: "gust_of_wind",
  }),
  gravity: motif("Gravity lift", "gravity", {
    hit: "energy_field",
    aura: "magic_signs",
  }),
  duplicates: motif("Three swirling duplicates", "mirror", {
    hit: "shimmer",
    aura: "particles.outward",
  }),
  blurred: motif("Blurry target echoes", "blur", {
    hit: "shimmer",
    aura: "shimmer",
  }),
  lightBend: motif("Light bends around target", "vanish", {
    hit: "shimmer",
    aura: "smoke",
  }),
  vineLash: motif("Vine lash and binding", "vine", {
    bolt: "vine.complete.nature.single",
    hit: "entangle",
    aura: "vine.loop.nature.single",
  }),
  growingPlants: motif("Plants unfold from ground", "growth", {
    area: "plant_growth,entangle",
    hit: "swirling_leaves",
  }),
  detonation: motif("Sudden detonation", "explosion", {
    hit: "explosion,impact",
    aura: "smoke",
  }),
  acidGlob: motif("Acid glob and spray", "glob", {
    area: "liquid.splash,liquid.blob",
    hit: "fumes",
  }),
  portalStep: motif("Quick departure shimmer", "portal", {
    hit: "misty_step",
    aura: "portals",
  }),
  teleportGate: motif("Gathering teleport gate", "gate", {
    hit: "teleport",
    aura: "portals",
  }),
  tracerBeam: motif("Tracer becomes destructive beam", "disintegrate", {
    bolt: "disintegrate",
    hit: "particle_burst",
    aura: "smoke",
  }),
  blessing: motif("Outward blessing rings", "bless", {
    aura: "bless,magic_signs",
  }),
  doubt: motif("Inward rings of doubt", "bane", {
    aura: "magic_signs.circle.02.enchantment,energy_field",
  }),
  grease: motif("Glossy slick surface", "slick", {
    hit: "grease",
    aura: "liquid.blob",
  }),
  prismatic: motif("Pulsing colored lights", "prismatic", {
    area: "particle_burst",
    aura: "swirling_sparkles",
  }),
  summon: motif("Conjuration circle", "summon", {
    hit: "portals",
    aura: "magic_signs",
  }),
  song: motif("Notes and resonant waves", "song", {
    hit: "music_notations",
    aura: "soundwave",
  }),
  sonicWave: motif("Sonic pressure wave", "sonic", {
    hit: "shatter,soundwave",
    aura: "soundwave,thunderwave",
  }),
  swarm: motif("Swarming silhouettes", "swarm", {
    hit: "bats,butterflies",
    area: "bats,butterflies",
    aura: "particles",
  }),
  crowFlock: motif("Flying flock and local torment", "flyingSwarm", {
    bolt: "bats",
    hit: "bats",
    aura: "swirling_feathers",
    symbolic: true,
  }),
  stone: motif("Stone rises and fractures", "stone", {
    hit: "ground_cracks,falling_rocks",
    area: "ground_cracks,eruption",
  }),
  poisonMist: motif("Poison breath and fumes", "mist", {
    hit: "fumes",
    area: "fumes,fog_cloud",
    aura: "smoke",
  }),
  eye: motif("Divination scan", "scan", {
    hit: "detect_magic,eyes",
    aura: "magic_signs",
  }),
  weapon: motif("Weapon flourish", "weapon", {
    hit: "melee_attack,sword",
    bolt: "spiritual_weapon",
  }),
  form: motif("Transformation silhouettes", "form", {
    hit: "energy_field",
    aura: "swirling_sparkles",
  }),
  whisper: motif("Quiet message and reply", "whisper", {
    cast: "glint",
    hit: "soundwave.01",
    aura: "soundwave.02",
  }),
  commandWord: motif("Spoken command", "command", {
    cast: "cast_shape",
    hit: "soundwave.02",
    aura: "energy_field",
  }),
  charmHaze: motif("Dreamy charming haze", "charm", {
    cast: "swirling_sparkles",
    hit: "shimmer",
    aura: "swirling_sparkles",
  }),
  silenceField: motif("Sound fades into silence", "silence", {
    cast: "glint",
    hit: "soundwave.01",
    aura: "bubble",
  }),
  soundSculpt: motif("Sound bends and changes", "soundEdit", {
    cast: "music_notations",
    hit: "soundwave.02",
    aura: "music_notations",
  }),
  weaponRunes: motif("Runes inscribe a weapon", "runes", {
    cast: "glint",
    hit: "magic_signs.rune,magic_signs",
    aura: "glint",
  }),
  bodyRunes: motif("Runes empower the body", "bodyRunes", {
    cast: "cast_shape",
    hit: "on_token_buff.001.001",
    aura: "magic_signs",
  }),
  armorMantle: motif("Shimmering armor mantle", "armor", {
    cast: "cast_shape",
    hit: "ward",
    aura: "shimmer",
  }),
  protectiveWard: motif("Protective energy envelope", "protect", {
    cast: "magic_signs.circle.01.abjuration",
    hit: "ward",
    aura: "antilife_shell",
  }),
  sanctuaryHalo: motif("Gentle sanctuary halo", "sanctuary", {
    cast: "glint",
    hit: "bless",
    aura: "ward",
  }),
  elementalGuard: motif("Elemental resistance shell", "protect", {
    cast: "cast_shape",
    hit: "shield.01.intro",
    aura: "energy_field",
  }),
  darkShroud: motif("Dark shroud closes", "darkness", {
    cast: "smoke",
    hit: "darkness",
    area: "darkness",
    aura: "smoke",
  }),
  lightOrb: motif("Floating illumination orb", "lightOrb", {
    cast: "glint",
    hit: "dancing_light.yellow",
    aura: "glint",
  }),
  minorMagic: motif("Small harmless magical flourishes", "minorMagic", {
    cast: "glint",
    hit: "swirling_sparkles",
    aura: "particles",
  }),
  floatingHand: motif("Ghostly hand lifts an object", "floatingHand", {
    cast: "cast_shape",
    hit: "arcane_hand",
    aura: "glint",
  }),
  strengthSap: motif("Strength ebbs inward", "sap", {
    cast: "cast_shape",
    hit: "energy_strands.complete",
    aura: "energy_field",
  }),
  empower: motif("Encouraging rising energy", "empower", {
    cast: "glint",
    hit: "on_token_buff.001.001",
    aura: "bardic_inspiration",
  }),
  organRead: motif("Anatomical perception cue", "inspect", {
    cast: "glint",
    hit: "eyes.01.single",
    aura: "detect_magic",
    symbolic: true,
  }),
  spectralRush: motif("Ghostlike movement echoes", "spectralRush", {
    cast: "smoke",
    hit: "shimmer",
    aura: "smoke",
  }),
  spiritVeil: motif("Veil of spirits", "spectralVeil", {
    cast: "spirit_guardians",
    hit: "shimmer",
    aura: "spirit_guardians",
  }),
  decay: motif("Decay spreads and withers", "decay", {
    cast: "magic_signs.circle.01.necromancy",
    hit: "energy_strands.complete",
    area: "energy_strands.complete",
    aura: "smoke",
  }),
  undeadVigor: motif("Void seed restores undead vigor", "vigor", {
    cast: "magic_signs.circle.01.necromancy",
    hit: "energy_field",
    aura: "energy_strands.complete",
  }),
  mapRead: motif("Cartographic star and tracing cue", "inspect", {
    cast: "glint",
    hit: "twinkling_stars",
    aura: "magic_signs",
    symbolic: true,
  }),
  generic: {...motif("Needs configuration", "generic"),unavailable:true},
  ...DELIVERY_MOTIFS,
  ...DEEP_SPELL_MOTIFS,
  ...UTILITY_SPELL_MOTIFS,
  ...FEAR_SPELL_MOTIFS,
  ...BROAD_VARIETY_MOTIFS,
  ...SPECIFIC_FALLBACK_MOTIFS,
  ...GAP_SPELL_MOTIFS,
  ...FIRE_SPELL_MOTIFS,
  ...FIX_SPELL_MOTIFS,
};

// Reviewed against complete PF2e descriptions. Aliases share only when their
// central fiction matches; display names alone never create cosmetic variants.
export const AUTHORED_SPELL_DESIGNS = {
  message: [
    "whisper",
    "Quiet sound gathers at the recipient, then a softer reply cue fades. No music or attack impact is assumed.",
  ],
  sending: [
    "whisper",
    "A restrained recipient cue suggests a remote mental message; it does not draw a physical beam over the entire distance.",
  ],
  command: [
    "commandWord",
    "One expanding spoken-command wave reaches the target, then fades. The chosen action and saving throw remain mechanical.",
  ],
  suggestion: [
    "charmHaze",
    "A gentle convincing haze gathers around the recipient; no forced token movement or sleep cue is applied.",
  ],
  charm: [
    "charmHaze",
    "A dreamy haze and warm sparkles suggest the altered impression; attitude and saving throws remain mechanical.",
  ],
  silence: [
    "silenceField",
    "A sound wave contracts and disappears into a quiet envelope; sound blocking and heightened aura placement remain mechanical.",
  ],
  "sculpt-sound": [
    "soundSculpt",
    "Resonant waves bend into a second layer, suggesting edited sound rather than a damaging sonic blast.",
  ],
  "runic-weapon": [
    "weaponRunes",
    "Glints and inscribing runes suggest the weapon's new magic, with no caster lunge or strike. Token artwork stands in for the carried weapon.",
  ],
  "runic-body": [
    "bodyRunes",
    "Rising energy and body runes suggest empowered unarmed attacks; the cast itself makes no attack.",
  ],
  "mystic-armor": [
    "armorMantle",
    "A shimmering mantle wraps caster and settles, distinct from a raised force shield.",
  ],
  protection: [
    "protectiveWard",
    "Protective energy surrounds the willing recipient in a brief envelope; no Shield Block or condition is assumed.",
  ],
  sanctuary: [
    "sanctuaryHalo",
    "A soft outward halo and ward suggest attacks being deterred; saving throws remain mechanical.",
  ],
  "spell-immunity": [
    "protectiveWard",
    "A ward settles around the recipient; chosen-spell counteraction remains mechanical.",
  ],
  "resist-energy": [
    "elementalGuard",
    "A neutral energy shield settles around the recipient. The chosen energy type needs customization; no fire resistance is assumed.",
  ],
  darkness: [
    "darkShroud",
    "A dark globe grows across the placed burst, followed by fading dark vapour; lighting state stays mechanical.",
  ],
  light: [
    "lightOrb",
    "One small hovering light orb appears beside caster as a placement cue; attaching it and persistent lighting remain mechanical.",
  ],
  prestidigitation: [
    "minorMagic",
    "Small glints and restrained flourishes suggest harmless magic. The chosen cook, lift, make or tidy option needs customization.",
  ],
  "telekinetic-hand": [
    "floatingHand",
    "A ghostly hand appears at the selected object and rises slowly; object movement and the invisible-hand option remain manual.",
  ],
  enfeeble: [
    "strengthSap",
    "A localized inward contraction suggests sapped strength, without blood, damage or a life-drain tether.",
  ],
  "infectious-enthusiasm": [
    "empower",
    "Encouraging energy rises around caster. Allies' later choice to share the benefit remains separate.",
  ],
  organsight: [
    "organRead",
    "A perception cue marks anatomical scrutiny; eye artwork is symbolic and does not depict exposed organs or a later precision strike.",
  ],
  "ghost-rush": [
    "spectralRush",
    "Fading ghostlike caster echoes suggest intangible movement; the two Strides and final position remain player controlled.",
  ],
  "spirit-veil": [
    "spiritVeil",
    "A brief spirit layer surrounds caster and fades into a translucent veil; visibility remains mechanical.",
  ],
  "sudden-blight": [
    "decay",
    "Inward strands darken across the placed burst and fade into withering residue; plants and creatures are not deleted.",
  ],
  "malignant-sustenance": [
    "undeadVigor",
    "Void energy seeds the targeted undead and rises into a steady restorative glow; fast healing remains mechanical.",
  ],
  "spontaneous-cartography": [
    "mapRead",
    "A small star and tracing runes suggest a map being recorded; this symbolic cue does not create the actual map.",
  ],
  ignition: [
    "smolder",
    "A finger-snap cue ignites the target in place; no flying fire bolt.",
  ],
  "produce-flame": [
    "thrownFlame",
    "A thrown flame connects caster and target, then bursts on contact.",
  ],
  frostbite: [
    "frostOrb",
    "Cold forms around the target, followed by a short shiver and icy residue.",
  ],
  "ray-of-frost": [
    "icyRay",
    "A narrow icy ray connects caster to target; the impact leaves a frost scar.",
  ],
  "polar-ray": [
    "icyRay",
    "A blue-white freezing beam reaches the target, followed by an icy contact burst; no drained condition is applied.",
  ],
  "holy-light": [
    "divineRay",
    "A blazing holy beam connects caster to foe, then flares at contact; darkness counteraction remains mechanical.",
  ],
  "searing-light": [
    "divineRay",
    "A focused searing light beam connects caster to foe and ends in a radiant flare.",
  ],
  "moonlight-ray": [
    "moonRay",
    "A freezing silver-blue moonlight beam connects caster to foe, leaving a brief frost flash.",
  ],
  moonbeam: [
    "lunarRay",
    "A silvery ray of moonlight reaches the target and glints at contact; it does not use a scorching orange ray despite its fire damage type.",
  ],
  "chromatic-ray": [
    "prismaticRay",
    "One colored beam reaches the target. This editable base visual does not determine the rolled color or its mechanics.",
  ],
  "ray-of-corruption": [
    "toxicRay",
    "A toxic spore beam reaches the target, followed by foul vapour and short acid residue; no object or creature is destroyed.",
  ],
  "admonishing-ray": [
    "energyRay",
    "A focused energy ray ends in a restrained contact recoil; no persistent injury or condition is assumed.",
  ],
  "chilling-darkness": [
    "darkRay",
    "A cold unholy beam of darkness connects caster to target; its light counteraction remains mechanical.",
  ],
  "call-of-the-grave": [
    "darkRay",
    "One sickening energy ray reaches the target; this short visual does not apply sickened or slowed.",
  ],
  "fire-ray": [
    "flameRay",
    "A fiery ray arcs toward the target; a short flame contact cue suggests the burning space without creating hazardous terrain.",
  ],
  "acid-arrow": [
    "acidArrow",
    "One acid arrow flies to target, splashes on contact and leaves brief corrosion fumes.",
  ],
  "acid-splash": [
    "acidSplash",
    "A compact acid glob flies to the target and splatters on contact; nearby splash damage remains mechanical.",
  ],
  "briny-bolt": [
    "waterBolt",
    "A hurled bolt of saltwater splashes against the foe; it is a moving liquid object rather than an energy ray.",
  ],
  inkshot: [
    "inkJet",
    "A compact shot of viscous ink flies to the target and splatters; it does not create a poison fog or apply dazzled.",
  ],
  "winter-bolt": [
    "iceShard",
    "One hollow icicle flies toward the target and breaks into a short frosty burst; later detonation is resolved separately.",
  ],
  "force-bolt": [
    "forceBolt",
    "One arrow-shaped force missile reaches the foe; it does not borrow Force Barrage's three-projectile volley.",
  ],
  heartbolt: [
    "vitalBolt",
    "One life-energy missile reaches the target and blooms there. Any optional target-centered emanation needs customization.",
  ],
  "horizon-thunder-sphere": [
    "thunderSphere",
    "An electrical sphere gathers at caster and flies to the target; the base cast does not assume a two-round charge or explosion.",
  ],
  "spiritual-armament": [
    "spiritualArmament",
    "A ghostly weapon echo flies to the foe, strikes and returns to caster; the caster's token does not charge into melee.",
  ],
  "hand-of-the-apprentice": [
    "weaponThrow",
    "A weapon flies toward the target and returns. A generic ghostly weapon stands in for the actor's chosen held weapon.",
  ],
  "spiritual-weapon": [
    "spiritualWeapon",
    "A ghostly weapon materializes beside the foe and strikes locally; it does not travel from caster or move the caster token.",
  ],
  "blazing-blade": [
    "fieryBlade",
    "A conjured fiery blade suggests a close strike rather than a focused ray; subsequent chosen attack actions remain mechanical.",
  ],
  "crushing-ground": [
    "groundCrush",
    "Ground fractures open below the target then close inward with a short tremor; no creature position or condition is changed.",
  ],
  "final-sacrifice": [
    "detonation",
    "A detonation and fading smoke originate at the targeted minion; sacrificing it and resolving the surrounding damage remain mechanical.",
  ],
  "necrotic-bomb": [
    "detonation",
    "A necrotic detonation and fading residue originate at the targeted thrall; its destruction and the surrounding damage remain mechanical.",
  ],
  "detonate-magic": [
    "detonation",
    "A magical detonation originates at the targeted item; this visual does not delete the item or resolve the surrounding damage.",
  ],
  "deathly-scream": [
    "sonicWave",
    "A sonic pressure cue expands around the targeted thrall; the thrall's destruction and surrounding saves remain mechanical.",
  ],
  "rebuke-death": [
    "restore",
    "Vitality gathers around the chosen recipient; additional recipients and exact healing areas remain casting choices.",
  ],
  "black-tentacles": [
    "shadowTendrils",
    "Dark tentacles rise across the placed circular area and briefly grasp; later attacks and grabbed conditions remain mechanical.",
  ],
  slither: [
    "shadowTendrils",
    "Dark grasping shapes rise across the placed circular area. JB2A tentacles stand in for shadow snakes; no restraint is applied.",
  ],
  "floating-flame": [
    "hoveringFlame",
    "One sustained flame coalesces beside caster as a placement cue; remote square placement and later controlled movement need customization.",
  ],
  "flaming-sphere": [
    "hoveringFlame",
    "One fiery sphere coalesces beside caster as a placement cue; remote placement and later sustained movement remain manual.",
  ],
  "shambling-horror": [
    "reanimate",
    "A necromantic ring and rising bone energy gather around the targeted corpse; the minion actor and its abilities are created separately.",
  ],
  "incarnate-faerie-revelers": [
    "incarnateFey",
    "Faerie lights and silhouettes suggest the revel's arrival beside caster; the remote incarnation and its arrive/depart effects need separate placement and resolution.",
  ],
  "incarnate-skeletal-giant": [
    "incarnateBones",
    "Bone energy rises through a dark cloud as an arrival cue. This is not a giant model; remote placement and arrive/depart effects remain manual.",
  ],
  "incarnate-wild-rose": [
    "incarnateRose",
    "Growth and leaves suggest the rose's arrival beside caster; its remote Huge plant and arrive/depart effects need separate placement and resolution.",
  ],
  "incarnate-tempest-of-shades": [
    "incarnateTempest",
    "A smoky spectral whirlwind suggests the shades' arrival; it does not show individual faces or place the remote incarnation.",
  ],
  "incarnate-kaiju": [
    "incarnateKaiju",
    "Broken earth and rising dust suggest a massive creature's arrival; it does not depict the chosen kaiju or resolve its remote arrive/depart effects.",
  ],
  "incarnate-ancient-specter": [
    "summon",
    "A conjuration circle suggests the specter's arrival; JB2A does not supply its specific wraith artwork and remote placement remains manual.",
  ],
  "incarnate-archmage": [
    "summon",
    "A conjuration circle suggests the legendary wizard's arrival; its figure, remote placement and arrive/depart effects need separate resolution.",
  ],
  "incarnate-deific-herald": [
    "summon",
    "A conjuration circle suggests the herald's arrival; sanctification-specific artwork and its arrive/depart effects need separate customization.",
  ],
  "incarnate-draconic-legion": [
    "summon",
    "A conjuration circle suggests the legion's arrival; chosen dragons, remote placement and breath areas need separate customization.",
  ],
  "needle-darts": [
    "needles",
    "Three closely spaced needles strike one target; the base cast uses three shots.",
  ],
  "blazing-bolt": [
    "flameRay",
    "One heat ray per chosen target, staggered by target rather than three rays at every creature.",
  ],
  "scorching-ray": [
    "flameRay",
    "Heat rays release separately toward chosen creatures.",
  ],
  "force-barrage": [
    "forceShards",
    "Three complete shard flights distributed through chosen targets in order, each with its own contact. Editable three-action illustration; adjust total shard count for action and heightened choices.",
  ],
  "magic-missile": [
    "forceShards",
    "A staggered magical shard volley, with separate contact flashes.",
  ],
  "electric-arc": [
    "smallArc",
    "A small arc leaps through targeted creatures in targeting order.",
  ],
  "chain-lightning": [
    "stormChain",
    "A stronger discharge propagates creature to creature; each arrival adds static and a brief token tremor.",
  ],
  thunderstrike: [
    "thunderFall",
    "Lightning descends on the target, then a delayed sonic ring and token jolt sell the thunder.",
  ],
  "gouging-claw": [
    "claws",
    "Caster lunges as a claw slash lands; target recoils. Token positions return afterward.",
  ],
  "acid-grip": [
    "acidHand",
    "A talon appears at target, followed by acid fumes and a brief cosmetic tug.",
  ],
  "hydraulic-push": [
    "waterJet",
    "A pressure jet meets a splash and cosmetic target recoil; no forced-movement document update.",
  ],
  spout: [
    "geyser",
    "Water erupts upward on affected targets; exact cube placement remains a symbolic target cue.",
  ],
  "telekinetic-projectile": [
    "looseObject",
    "A lifted stone stands in for the chosen loose object, then lands with physical impact.",
  ],
  "divine-lance": [
    "divineRay",
    "A bright divine beam resolves into a radiant contact flare.",
  ],
  heal: [
    "restore",
    "Vital energy blooms at target, with rising particles and a restrained token pulse.",
  ],
  soothe: [
    "soothe",
    "A softer, slower mental wash settles around target rather than repeating Heal's burst.",
  ],
  harm: [
    "voidCollapse",
    "Void energy closes inward on the target, using a dark contraction instead of healing light.",
  ],
  "void-warp": [
    "lifeWarp",
    "A short localized void distortion contracts around the target's life force.",
  ],
  "vampiric-feast": [
    "drain",
    "Target impact precedes a return-flow tether into caster and a caster recovery glow.",
  ],
  "vampiric-touch": [
    "drain",
    "A contact drain pulls visual energy from target back to caster.",
  ],
  daze: [
    "mentalJolt",
    "A compact mental jolt uses a brief token tremor and overhead stars.",
  ],
  "phantom-pain": [
    "phantomPain",
    "Two pain pulses and separated token tremors suggest recurring illusory pain without applying conditions.",
  ],
  fear: [
    "dread",
    "Dark dread gathers around target; a short tremor suggests fear without moving or applying frightened.",
  ],
  shield: [
    "forceShield",
    "A compact force shield raises beside caster and settles into a short guard loop.",
  ],
  "glass-shield": [
    "glassShield",
    "Translucent shielding and glass-like glints emphasize a fragile shell; the cast does not show Shield Block's later break.",
  ],
  "bone-shield": [
    "boneShield",
    "Bone-colored assembly precedes a sturdier guard silhouette. Free media substitutes glints for bone artwork.",
  ],
  "fire-shield": [
    "fireShield",
    "A hovering shield is surrounded by a separate flame layer, distinct from a fire attack.",
  ],
  haste: [
    "swiftTime",
    "Fast trailing token echoes accompany accelerating sparkles.",
  ],
  slow: [
    "slowTime",
    "A slowly turning ring closes around target; heavy echoes contrast with Haste's quick trails.",
  ],
  fly: [
    "flight",
    "Target rises and settles over a separate trailing shadow and wind wisps.",
  ],
  levitate: [
    "gravity",
    "Target lifts slowly inside a gravity ring and returns to its original pose.",
  ],
  "mirror-image": [
    "duplicates",
    "Three visible token copies move around caster; the original token stays visible.",
  ],
  blur: [
    "blurred",
    "Two tightly spaced blurred copies affect the target instead of Mirror Image's three caster duplicates.",
  ],
  invisibility: [
    "lightBend",
    "Target copies dissolve through shimmer. Mechanical visibility remains PF2e's responsibility.",
  ],
  disappearance: [
    "lightBend",
    "A longer shimmer dissolves target echoes; no visibility state is changed.",
  ],
  "tangle-vine": [
    "vineLash",
    "A single vine lashes from caster, then briefly binds target with a recoil cue.",
  ],
  tanglefoot: ["vineLash", "A vine lash resolves into brief binding foliage."],
  "entangling-flora": [
    "growingPlants",
    "Green growth expands over the circular area, with leaves rising afterward.",
  ],
  entangle: [
    "growingPlants",
    "Plants spread across a circular area with a slow growing layer.",
  ],
  fireball: [
    "detonation",
    "One sudden area detonation is followed by fading smoke, avoiding two identical explosion layers.",
  ],
  "caustic-blast": [
    "acidGlob",
    "A growing acid splash sprays across the chosen burst and leaves a short fume layer.",
  ],
  translocate: [
    "portalStep",
    "A quick departure shimmer sheds one short-lived caster echo.",
  ],
  "dimension-door": [
    "portalStep",
    "Departure shimmer suggests a quick transit without relocating the token.",
  ],
  teleport: [
    "teleportGate",
    "A longer runic preparation opens a broad departure gate, distinct from Translocate's snap.",
  ],
  disintegrate: [
    "tracerBeam",
    "A faint tracer is followed by a larger destructive beam and particles; no death or token deletion is assumed.",
  ],
  bless: [
    "blessing",
    "Warm rings open outward from caster to suggest growing ally support.",
  ],
  bane: [
    "doubt",
    "Dark rings close inward at caster to suggest doubt, opposite Bless's outward motion.",
  ],
  grease: [
    "grease",
    "A short glossy slick appears on the chosen target object; square-area mode needs customization.",
  ],
  "vibrant-pattern": [
    "prismatic",
    "Colored area lights pulse in intensity; no blinded condition is applied.",
  ],
  "summon-animal": [
    "summon",
    "A nature-colored casting circle marks conjuration at caster; the summoned creature is placed separately.",
  ],
  "murder-of-crows": [
    "crowFlock",
    "A flock flies from caster to the targeted creature and circles it with a brief torment cue. JB2A bats stand in for crows; dazzled, blinded and damage remain mechanical.",
  ],
  ...DELIVERY_DESIGNS,
  ...DEEP_SPELL_DESIGNS,
  ...UTILITY_SPELL_DESIGNS,
  ...FEAR_SPELL_DESIGNS,
  ...BROAD_VARIETY_DESIGNS,
  ...SPECIFIC_FALLBACK_DESIGNS,
  ...GAP_SPELL_DESIGNS,
  ...FIRE_SPELL_DESIGNS,
  ...FIX_SPELL_DESIGNS,
  // PF2e 8.6.0 additions, reviewed against their complete descriptions.
  "brimstone-rain": ["lavaColumn", "Smoldering brimstone globs rupture out of the ground across the burst. Lingering sulfurous fumes, difficult terrain and persistent poison stay native."],
  "control-currents": ["waterLine", "A water current runs along the line in the chosen direction. Forced movement only applies where the line meets water and stays native."],
  "curse-of-slippery-steps": ["grease", "A glossy wet slick settles under the cursed creature's feet. Difficult terrain and the water trail depend on the Reflex save."],
  "devils-horseshoe": ["lockSeal", "A conjured silver horseshoe seals over the chosen entrance. Damage and conditions apply later to fiends passing through, never on cast."],
  "gift-of-dusk": ["strengthSap", "Inky energy seeps into the target's shadow and its strength ebbs inward. The curse stages and a detached shadow creature remain native."],
  "glimpse-the-netherworld": ["materialArea-shadow", "Netherworld shadows tear open around the slain enemy and fill the 10-foot emanation. Cold and persistent damage depend on Reflex saves."],
  "gloom-mantle": ["darkShroud", "A dark shroud closes around the caster for the concealment. Bright light ending it stays native."],
  "infernal-supervision": ["diabolicTask", "An infernal contract seal settles on the caster to guide their words. Lore and social bonuses are native modifiers."],
  "piercing-jet": ["waterBolt", "A thin pressurized stream of water flies to the target on a ranged spell attack. No push: the jet pierces rather than shoves."],
  "pin-the-spears-in-the-lamb": ["shadowTendrils", "Shadow spikes rise and grasp each target's shadow on the ground. Speed penalty or immobilization depends on each Reflex save."],
  "rude-awakening": ["gapC-rousing-splash", "Frigid conjured water splashes over the chosen ally to fortify their resolve. The Will save and saving-throw bonuses stay native."],
  "saturate": ["materialArea-water", "Water drawn from the air soaks the burst. Difficult terrain or quicksand depends on the native surface."],
  "searing-rain": ["gapA-downpour", "A torrential downpour of boiling water fills the burst and leaves steam. Persistent fire and concealment stay native."],
  "silver-spear": ["thrownSpear", "A great conjured silver lance is hurled at the target. Extra spirit damage and teleport tether against fiends stay native."],
  "spray-of-salt": ["materialSand", "A wave of purified white salt sprays through the cone. Acid and persistent spirit damage depend on Fortitude saves and creature traits."],
  "tenebrous-freedom": ["devouringShadow", "The target's shadow tears free and becomes an independent shape. Its later movement and the enfeebled/clumsy penalties remain native."],
  "the-night-is-mine": ["localShadow", "The darkness around the target rises and strikes it with cold. Damage depends on the basic Reflex save; the reaction trigger is native."],
  "turnip-lantern": ["lightOrb", "A carved turnip lantern lights in the caster's hand. Its 20-foot bright-light aura and bonus against unholy creatures run as the native aura effect."],
  "unending-tears": ["privateGrief", "Sorrow wells over the target and their eyes stream with tears. Dazzled, stupefied and emotion suppression depend on the Will save."],
};

const track = (property, from, to, duration, extra = {}) => ({
  property,
  from,
  to,
  duration,
  delay: 0,
  ease: "easeOutCubic",
  loop: false,
  pingPong: false,
  fromEnd: false,
  ...extra,
});

const HEAVY_GRAVITY = {
  "unrelenting-gravity": ["press", "Crushing downward force"],
  "gravity-weapon": ["pulse", "Gravity gathers into blows"],
  "variable-gravity": ["pulse", "Gravity grip adjusts"],
  "chosen-gravity": ["pulse", "Gravity reorients"],
};
export function applySpellDesign(spell, base, stage, { motion = true, castRank = spell.rank } = {}) {
  const d = spell.design;
  if (!d) return base;
  const pattern = SPELL_MOTIFS[d.motif]?.pattern ?? "generic";
  const rank = Math.max(1, spell.rank);
  const charge = 260 + Math.min(3, d.actions || 2) * 110 + rank * 20;
  const impactScale = Math.min(
    2.3,
    1 + rank * 0.045 + (d.damageDice || 0) * 0.012,
  );
  const subject = d.subject === "targets" ? "targets" : "source";
  let serial = 0;
  const fx = (kind, slot, label, delay, duration, extra = {}) => ({
    ...stage(kind, slot, delay, duration, extra),
    stageId: `${spell.id}-design-${++serial}`,
    label,
  });
  const cast = (label = "Gather") =>
    fx("cast", "cast", label, 0, charge, {
      scale: 0.7 + rank * 0.035,
      scaleIn: 0.2,
      scaleInDuration: charge * 0.7,
      fadeOut: 120,
      scaleOut: 0,
      scaleOutDuration: 120,
    });
  const at = (slot, label, delay, duration, extra = {}) =>
    fx(
      spell.delivery === "burst" && extra.subject !== "source"
        ? "template"
        : subject === "targets"
          ? "impact"
          : "cast",
      slot,
      label,
      delay,
      duration,
      { ...extra, ...(extra.subject === "source" ? { kind: "cast" } : {}) },
    );
  const aura = (slot, label, delay, duration, extra = {}) =>
    fx(
      spell.delivery === "burst" && extra.subject !== "source" ? "template" : "aura",
      slot,
      label,
      delay,
      duration,
      // An explicitly authored caster cue is local; default emanation auras
      // still become native area stages through the shared stage factory.
      { subject, below: true, ...extra, ...(extra.subject === "source" ? { kind: "aura" } : {}) },
    );
  const beam = (label, delay, duration, extra = {}) =>
    fx("travel", "bolt", label, delay, duration, { scale: 0.8, ...extra });
  const pose = (
    name,
    label,
    delay,
    duration,
    who = subject,
    distance = 0.15,
    intensity = 0.6,
  ) => ({
    kind: "motion",
    assets: [],
    stageId: `${spell.id}-design-${++serial}`,
    label,
    subject:
      who === "targets" &&
      subject === "source" &&
      !["target", "bolt", "volley", "chain", "melee"].includes(spell.delivery)
        ? "source"
        : who,
    motion: name,
    delay,
    duration,
    distance,
    intensity,
  });
  const copy = (label, delay, duration, extra = {}) =>
    fx("sprite", "aura", label, delay, duration, {
      assets: [],
      subject,
      copies: 1,
      copySpread: 0.18,
      opacity: 0.35,
      fadeIn: 150,
      fadeOut: 350,
      ...extra,
    });
  const hit = (label = "Contact", delay = charge, duration = 850, extra = {}) =>
    at("hit", label, delay, duration, { scale: impactScale, ...extra });
  let layers = fixSpellLayers(spell,{cast,hit,aura,pose,copy,fx,track,charge,subject,pattern});
  layers ??= fireSpellLayers(spell,{cast,hit,aura,pose,copy,fx,track,charge,subject,pattern});
  layers ??= gapSpellLayers(spell, { cast, hit, aura, pose, copy, fx, track, charge, subject, pattern });
  layers ??= fearSpellLayers(spell, { cast, hit, aura, pose, copy, fx, track, charge, subject, pattern });
  layers ??= broadVarietyLayers(spell, { cast, hit, aura, pose, copy, fx, track, charge, subject, pattern });
  layers ??= deepSpellLayers(spell, { cast, hit, aura, pose, copy, fx, track, charge, subject, pattern });
  layers ??= utilitySpellLayers(spell, { cast, hit, aura, pose, copy, fx, track, charge, subject, pattern });
  layers ??= specificFallbackLayers(spell, {cast,hit,aura,pose,copy,fx,track,charge,subject,pattern});
  if (!layers) switch (pattern) {
    case "lineBeam":
    case "lineFlight":
    case "lineTiles":
    case "lineBarrier": {
      const duration =
        pattern === "lineTiles"
          ? 2600
          : Math.max(
              1500,
              Math.min(6000, d.mediaTiming?.area?.duration ?? 2400),
            );
      const line = fx("template", "area", d.label, charge, duration, {
        scale: 1,
        fadeIn: 0,
        fadeOut: 150,
        oneShot: pattern === "lineFlight" || pattern === "lineBeam",
        areaLayout: pattern === "lineTiles" ? "tiles" : "fit",
        below: pattern === "lineTiles",
        opacity: pattern === "lineBarrier" ? 0.55 : 0.85,
      });
      layers = [
        cast(pattern === "lineTiles" ? "Shape the area" : "Gather at origin"),
        line,
      ];
      if (d.motif === "darkTendrilsLine") {
        // The description calls for curling darkness through air. Multiple02
        // is a very short colored shot; reviewed Multiple01 has visible curls.
        // Color replacement also keeps the Free purple footage dark.
        const dark = {tintEnabled:true,colorize:true,tint:"#654f72",opacity:1};
        const strand = (slot,label,delay) => fx("template",slot,label,delay,
          Math.max(2200,(d.mediaTiming?.[slot]?.duration ?? 2033)/.85+150), {
            // Alpha inspection: the group occupies half the movie's height;
            // the single strand occupies 22.5%. Compensate transparent padding
            // while keeping the visible curls within the native line width.
            ...dark,scale:slot==="area"?1.8:2.4,fadeIn:0,fadeOut:150,oneShot:true,playbackRate:.85,
            areaLayout:"fit",below:false,
          });
        layers = [
          fx("cast","cast","Source curl",0,700,{
            ...dark,scale:.65,clipEnd:700,fadeIn:60,fadeOut:140,
          }),
          strand("area","Curling tendrils",charge),
          strand("bolt","Winding strand",charge+160),
          pose("pulse","Release",80,950,"source",0,.35),
        ];
      }
      if (["prismaticBarrier", "rainbowPath"].includes(d.motif))
        layers = [
          layers[0],
          ...[
            "#ff4545",
            "#ff9945",
            "#ffe66b",
            "#69de80",
            "#6bcfff",
            "#7877dd",
            "#c16bdf",
          ].map((tint, i) => ({
            ...line,
            stageId: `${line.stageId}-${i}`,
            label: `Color layer ${i + 1}`,
            scale: 0.25,
            offsetY: (i - 3) * 0.12,
            tintEnabled: true,
            tint,
          })),
        ];
      if (["windLine", "vortexLine", "waterLine"].includes(d.motif))
        layers.push(
          pose(
            "recoil",
            "Release response",
            charge + 50,
            1100,
            "source",
            0.06,
            0.3,
          ),
        );
      if (d.motif === "rootedDrainLine")
        layers.push(
          aura("aura", "Nutrients return to caster", charge + 800, 1600, {
            subject: "source",
            scale: 1.1,
          }),
          pose(
            "pulse",
            "Caster revitalizes",
            charge + 850,
            1500,
            "source",
            0.04,
            0.3,
          ),
        );
      if (d.motif === "icyFlurry")
        layers.push(
          copy("Snow-crystal silhouette", charge + 300, 1600, {
            subject: "source",
            opacity: 0.25,
          }),
          pose(
            "pulse",
            "Cold breath exhaled",
            charge + 350,
            900,
            "source",
            0.08,
            0.3,
          ),
        );
      if (["lightningLine", "radianceTorrent"].includes(d.motif))
        layers.push(
          pose(
            "pulse",
            "Channeling response",
            0,
            Math.max(900, charge),
            "source",
            0.03,
            0.25,
          ),
        );
      break;
    }
    case "whisper":
      layers = [
        cast("Quiet focus"),
        hit("Message arrives", charge, 1100, {
          scale: 0.6,
          opacity: 0.28,
          scaleIn: 0.25,
          scaleInDuration: 650,
          fadeOut: 400,
        }),
        aura("aura", "Reply fades", charge + 850, 1000, {
          below: false,
          scale: 0.5,
          opacity: 0.18,
          fadeIn: 300,
          fadeOut: 500,
        }),
      ];
      break;
    case "command":
      layers = [
        cast("Word gathers"),
        hit("Command resonates", charge, 1100, {
          scale: 1.15,
          scaleIn: 0.2,
          scaleInDuration: 550,
          fadeOut: 400,
        }),
        aura("aura", "Word settles", charge + 650, 900, {
          scale: 0.8,
          opacity: 0.28,
          fadeOut: 550,
        }),
      ];
      break;
    case "charm":
      layers = [
        cast("Honeyed focus"),
        hit("Dreamy impression", charge, 1900, {
          scale: 1,
          opacity: 0.45,
          fadeIn: 650,
          fadeOut: 650,
        }),
        aura("aura", "Soft haze", charge + 500, 1800, {
          opacity: 0.25,
          scale: 1.15,
          fadeIn: 550,
          fadeOut: 650,
        }),
      ];
      break;
    case "silence":
      layers = [
        cast("Quiet focus"),
        hit("Sound fades", charge, 1100, {
          scale: 1.1,
          opacity: 0.35,
          scaleOut: 0,
          scaleOutDuration: 1000,
          fadeOut: 650,
        }),
        aura("aura", "Quiet envelope", charge + 700, 1400, {
          scale: 0.9,
          opacity: 0.18,
          fadeIn: 500,
          fadeOut: 650,
        }),
      ];
      break;
    case "soundEdit":
      layers = [
        cast("Shape resonance"),
        hit("Sound bends", charge, 1500, {
          scale: 0.9,
          opacity: 0.45,
          rotateIn: -40,
          rotateInDuration: 1000,
        }),
        aura("aura", "Edited resonance", charge + 550, 1800, {
          below: false,
          scale: 0.8,
          opacity: 0.4,
          fadeIn: 550,
          fadeOut: 650,
        }),
      ];
      break;
    case "runes":
    case "bodyRunes":
      layers = [
        cast("Magic glimmers"),
        hit(
          pattern === "runes" ? "Runes inscribe" : "Body runes rise",
          charge,
          1800,
          {
            scale: pattern === "runes" ? 0.7 : 1.1,
            opacity: 0.7,
            scaleIn: 0.1,
            scaleInDuration: 1000,
          },
        ),
        aura("aura", "Empowerment settles", charge + 750, 1400, {
          scale: 0.8,
          opacity: 0.4,
          fadeIn: 450,
          fadeOut: 650,
        }),
      ];
      break;
    case "armor":
    case "protect":
    case "sanctuary":
      layers = [
        cast("Ward gathers"),
        hit(
          pattern === "armor"
            ? "Armor wraps"
            : pattern === "sanctuary"
              ? "Sanctuary opens"
              : "Protection closes",
          charge,
          1900,
          {
            scale: 1.05,
            scaleIn: 0.2,
            scaleInDuration: 950,
            opacity: 0.65,
            fadeOut: 550,
          },
        ),
        aura("aura", "Guard settles", charge + 800, 1700, {
          scale: pattern === "sanctuary" ? 1.35 : 1,
          opacity: 0.32,
          fadeIn: 650,
          fadeOut: 600,
        }),
      ];
      break;
    case "darkness":
    case "decay":
      layers = [
        cast(pattern === "darkness" ? "Darkness gathers" : "Decay gathers"),
        hit(
          pattern === "darkness" ? "Dark globe forms" : "Withering spreads",
          charge,
          2300,
          {
            scaleIn: 0.1,
            scaleInDuration: 1300,
            opacity: pattern === "darkness" ? 0.8 : 0.6,
            fadeOut: 650,
          },
        ),
        aura("aura", "Fading residue", charge + 800, 1700, {
          opacity: 0.35,
          fadeIn: 650,
          fadeOut: 650,
        }),
      ];
      break;
    case "lightOrb":
      layers = [
        cast("Light gathers"),
        hit("Light orb floats", charge, 2200, {
          scale: 0.45,
          offsetY: -0.4,
          fadeIn: 650,
          fadeOut: 650,
        }),
        aura("aura", "Light glints", charge + 550, 1700, {
          scale: 0.65,
          opacity: 0.4,
          fadeIn: 450,
          fadeOut: 700,
        }),
      ];
      break;
    case "minorMagic":
      layers = [
        cast("Small flourish"),
        hit("Harmless sparkles", charge, 1600, {
          scale: 0.65,
          opacity: 0.5,
          fadeIn: 450,
          fadeOut: 600,
        }),
        aura("aura", "Flecks fade", charge + 700, 1300, {
          scale: 0.7,
          opacity: 0.25,
          fadeOut: 650,
        }),
      ];
      break;
    case "floatingHand":
      layers = [
        cast("Hand gathers"),
        hit("Ghostly hand lifts", charge, 2400, {
          scale: 0.75,
          opacity: 0.6,
          fadeIn: 650,
          fadeOut: 650,
          tracks: [track("position.y", 0, -0.3, 1900)],
        }),
        aura("aura", "Object glints", charge + 700, 1500, {
          scale: 0.5,
          opacity: 0.3,
          fadeOut: 650,
        }),
      ];
      break;
    case "sap":
      layers = [
        cast("Strength ebbs"),
        hit("Inward contraction", charge, 1900, {
          scale: 1,
          scaleOut: 0.25,
          scaleOutDuration: 1500,
          opacity: 0.55,
          fadeOut: 700,
        }),
        aura("aura", "Weakening settles", charge + 650, 1500, {
          scale: 0.85,
          opacity: 0.25,
          fadeOut: 700,
        }),
      ];
      break;
    case "empower":
    case "vigor":
      layers = [
        cast("Energy gathers"),
        hit(
          pattern === "vigor" ? "Void seed grows" : "Encouragement rises",
          charge,
          1900,
          { scale: 1.1, scaleIn: 0.25, scaleInDuration: 1100, opacity: 0.7 },
        ),
        aura("aura", "Vigor settles", charge + 850, 1500, {
          scale: 1,
          opacity: 0.35,
          fadeIn: 500,
          fadeOut: 650,
        }),
      ];
      break;
    case "inspect":
      layers = [
        cast("Focus detail"),
        hit("Detail revealed", charge, 1700, {
          scale: 0.65,
          opacity: 0.6,
          fadeIn: 650,
          fadeOut: 650,
        }),
        aura("aura", "Tracing fades", charge + 650, 1400, {
          scale: 0.9,
          opacity: 0.3,
          rotateIn: -45,
          rotateInDuration: 1000,
          fadeOut: 650,
        }),
      ];
      break;
    case "spectralRush":
    case "spectralVeil":
      layers = [
        cast("Spectral focus"),
        hit("Ghostlike veil", charge, 1900, {
          scale: 1,
          opacity: 0.35,
          fadeIn: 550,
          fadeOut: 650,
        }),
        copy("Spectral echoes", charge + 300, 1900, {
          copies: 2,
          copySpread: 0.16,
          opacity: 0.22,
          fadeIn: 600,
          fadeOut: 800,
        }),
        aura("aura", "Veil fades", charge + 650, 1500, {
          scale: 1.1,
          opacity: 0.22,
          fadeOut: 750,
        }),
      ];
      break;
    case "smolder":
      layers = [
        cast("Finger snap"),
        hit("Smolder", 200, 1300, {
          scale: 0.85,
          scaleIn: 0.08,
          scaleInDuration: 600,
        }),
        aura("aura", "Embers", 700, 1300, { scale: 1.1, opacity: 0.6 }),
        pose("shake", "Burning shiver", 420, 380, "targets", 0.08, 0.4),
      ];
      break;
    case "enclose":
      layers = [
        cast("Cold gathers"),
        aura("hit", "Orb coalesces", charge - 120, 1250, {
          scale: 1.6,
          scaleIn: 0.05,
          scaleInDuration: 650,
        }),
        hit("Frost cracks", charge + 500, 650, { scale: 1.15 }),
        aura("aura", "Ice residue", charge + 550, 1400, { scale: 1.3 }),
        pose("shake", "Cold shiver", charge + 330, 500, "targets", 0.07, 0.45),
      ];
      break;
    case "needles":
      layers = [
        cast("Shape needles"),
        beam("Needle cluster", charge, 1600, {
          repeats: 3,
          repeatInterval: 160,
          scale: 0.5,
        }),
        hit("Needle contacts", charge + 800, 850, {
          repeats: 3,
          repeatInterval: 160,
          scale: 0.65,
        }),
        pose(
          "shake",
          "Needle reaction",
          charge + 240,
          900,
          "targets",
          0.07,
          0.4,
        ),
      ];
      break;
    case "ray":
      layers = [
        cast("Focus beam"),
        beam("Focused ray", charge, 850, {
          targetStagger: d.motif === "flameRay" ? 180 : 0,
        }),
        hit("Ray impact", charge + 650, 700, {
          targetStagger: d.motif === "flameRay" ? 180 : 0,
        }),
        pose(
          "recoil",
          "Contact recoil",
          charge + 690,
          400,
          "targets",
          0.09,
          0.55,
        ),
      ];
      layers.at(-1).targetStagger = d.motif === "flameRay" ? 180 : 0;
      break;
    case "movingGlob":
      layers = [
        cast(
          d.motif === "thunderSphere"
            ? "Gather electrical sphere"
            : "Gather liquid",
        ),
        fx(
          "projectile",
          "bolt",
          d.motif === "thunderSphere" ? "Electrical sphere" : "Moving glob",
          charge,
          700,
          {
            scale: d.motif === "thunderSphere" ? 0.8 : 0.55,
            moveEase: "easeInQuad",
            fadeIn: 50,
            fadeOut: 60,
          },
        ),
        hit(
          d.motif === "thunderSphere" ? "Electrical contact" : "Liquid splash",
          charge + 650,
          850,
        ),
        pose(
          d.motif === "thunderSphere" ? "shake" : "recoil",
          "Contact response",
          charge + 680,
          450,
          "targets",
          0.1,
          0.55,
        ),
      ];
      break;
    case "flyingSwarm":
      layers = [
        cast("Call the flock"),
        fx("projectile", "bolt", "Flock flies to target", charge, 800, {
          scale: 1,
          moveEase: "easeInOutQuad",
          fadeIn: 80,
          fadeOut: 100,
        }),
        hit("Flock torments target", charge + 750, 1500, {
          scale: 1.4,
          tracks: [
            track("position.x", -0.15, 0.15, 650, {
              loop: true,
              pingPong: true,
            }),
          ],
        }),
        aura("aura", "Scattered feathers", charge + 1000, 1000, {
          opacity: 0.45,
          below: false,
        }),
        pose(
          "shake",
          "Flock response",
          charge + 850,
          650,
          "targets",
          0.06,
          0.4,
        ),
      ];
      break;
    case "missile":
      layers = [
        cast("Shape single missile"),
        beam("Single missile flight", charge, 550, {
          scale: 0.65,
          fadeIn: 40,
          fadeOut: 80,
        }),
        hit("Missile contact", charge + 480, 700),
        pose(
          "recoil",
          "Missile response",
          charge + 510,
          450,
          "targets",
          0.09,
          0.45,
        ),
      ];
      break;
    case "armament": {
      // Spiritual Armament copies the caster's own weapon, which then hovers at their side for as long as the
      // spell is sustained (the weapon "returns to your side" between attacks).
      const spirit = d.motif === "spiritualArmament" ? { spiritWeapon: true } : {};
      layers = [
        cast("Ghostly weapon echo"),
        fx("projectile", "bolt", "Fling weapon", charge, 650, {
          travelOrigin: "source",
          scale: 0.75,
          moveEase: "easeInQuad",
          fadeIn: 40,
          fadeOut: 70,
          ...spirit,
        }),
        hit("Weapon strikes", charge + 600, 450, { scale: 0.9 }),
        fx("projectile", "bolt", "Weapon returns", charge + 850, 650, {
          travelOrigin: "target",
          scale: 0.75,
          moveEase: "easeOutQuad",
          fadeIn: 40,
          fadeOut: 150,
          ...spirit,
        }),
        ...(d.motif === "spiritualArmament" ? [fx("aura", "bolt", "Weapon hovers at your side", charge + 1450, 5000, {
          subject: "source",
          persist: true,
          sustain: true,
          spiritWeapon: true,
          offsetX: 0.6,
          offsetY: -0.2,
          offsetUnits: "token",
          scale: 0.8,
          opacity: 0.85,
          fadeIn: 250,
          fadeOut: 400,
        })] : []),
        pose(
          "recoil",
          "Weapon response",
          charge + 620,
          400,
          "targets",
          0.09,
          0.45,
        ),
      ];
      break;
    }
    case "spiritWeapon":
      layers = [
        cast("Call ghostly weapon"),
        hit("Weapon manifests beside foe", charge, 1000, {
          scale: 0.9,
          offsetX: 0.35,
          rotateIn: -40,
          rotateInDuration: 550,
          scaleIn: 0.05,
          scaleInDuration: 250,
        }),
        at("aura", "Local weapon contact", charge + 450, 550, { scale: 0.85 }),
        pose(
          "recoil",
          "Weapon response",
          charge + 480,
          400,
          "targets",
          0.09,
          0.45,
        ),
      ];
      break;
    case "volley":
      layers = [
        cast("Solidify shards"),
        beam("Shard volley", charge, 1900, {
          repeats: 3,
          repeatScope: "total",
          repeatInterval: 300,
          scale: 0.55,
          fadeIn: 0,
          fadeOut: 60,
        }),
        hit("Shard contacts", charge + 1100, 900, {
          repeats: 3,
          repeatScope: "total",
          repeatInterval: 300,
          scale: 0.8,
        }),
        pose("pulse", "Release pulse", charge, 350, "source", 0.1, 0.3),
        {
          ...pose(
            "shake",
            "Shard contact response",
            charge + 1100,
            950,
            "targets",
            0.06,
            0.4,
          ),
          targetStagger: 300,
        },
      ];
      break;
    case "chain": {
      const gap = d.motif === "smallArc" ? 160 : 260;
      layers = [
        cast("Charge current"),
        beam(
          "Creature-to-creature arc",
          charge,
          d.motif === "smallArc" ? 650 : 1100,
          {
            travelOrigin: "previousTarget",
            targetStagger: gap,
            scale: d.motif === "smallArc" ? 0.55 : 1,
          },
        ),
        hit("Static discharge", charge + 300, 900, {
          targetStagger: gap,
          scale: 1.2,
        }),
        pose(
          "shake",
          "Electrical tremor",
          charge + 340,
          600,
          "targets",
          0.08,
          d.motif === "smallArc" ? 0.4 : 0.85,
        ),
      ];
      layers.at(-1).targetStagger = gap;
      break;
    }
    case "thunder":
      layers = [
        cast("Call storm"),
        hit("Descending lightning", charge, 2000, {
          scale: 2.4,
          fadeIn: 0,
          customAnchor: true,
          anchorX: 0.58,
          anchorY: 0.62,
        }),
        aura("aura", "Thunder ring", charge + 240, 1000, {
          scale: 2,
          scaleIn: 0.1,
          scaleInDuration: 600,
        }),
        pose("shake", "Thunder jolt", charge + 260, 650, "targets", 0.15, 0.9),
      ];
      break;
    case "localStrike":
      layers = [
        cast("Channel local strike"),
        hit("Local contact", charge, 1200),
        pose(
          "shake",
          "Contact response",
          charge + 150,
          800,
          "targets",
          0.06,
          0.4,
        ),
      ];
      break;
    case "localBind":
      layers = [
        cast("Qi fabric gathers"),
        pose(
          "lunge",
          "Fabric Strike gesture",
          charge - 100,
          950,
          "source",
          0.18,
          0.5,
        ),
        hit("Local threads unfurl", charge + 250, 1500, { opacity: 0.6 }),
      ];
      break;
    case "localTug":
      layers = [
        cast("Focus force"),
        hit("Local grip", charge, 1400, { opacity: 0.55 }),
        pose("lunge", "Inward tug", charge + 120, 900, "targets", 0.16, 0.55),
      ];
      break;
    case "fetters":
    case "tetherPull":
    case "electricLasso":
      layers = [
        cast(
          pattern === "electricLasso"
            ? "Crackling lasso gathers"
            : "Strands gather",
        ),
        beam(
          pattern === "electricLasso"
            ? "Electrical lasso reaches foe"
            : pattern === "fetters"
              ? "Ghostly bonds fly"
              : "Tether reaches target",
          charge,
          1500,
        ),
        hit(
          pattern === "electricLasso"
            ? "Electrical contact"
            : pattern === "fetters"
              ? "Bonds clasp"
              : "Tether connects",
          charge + 800,
          1500,
          { opacity: 0.6 },
        ),
        pose(
          pattern === "tetherPull" ? "lunge" : "shake",
          pattern === "electricLasso"
            ? "Contact jolt"
            : pattern === "fetters"
              ? "Bonds settle"
              : "Inward tug",
          charge + 850,
          950,
          "targets",
          0.14,
          0.55,
        ),
      ];
      break;
    case "lightningFall":
    case "drawLightning":
      layers = [
        cast("Call lightning"),
        hit("Descending lightning", charge, 2000, {
          scale: 2.4,
          fadeIn: 0,
          customAnchor: true,
          anchorX: 0.58,
          anchorY: 0.62,
        }),
        aura(
          "aura",
          pattern === "drawLightning"
            ? "Caster holds charge"
            : "Static settles",
          charge + 450,
          1300,
          {
            subject: pattern === "drawLightning" ? "source" : subject,
            scale: 1.1,
          },
        ),
        pose(
          "shake",
          "Electrical response",
          charge + 200,
          850,
          "targets",
          0.07,
          0.45,
        ),
      ];
      if (pattern === "drawLightning")
        layers.splice(
          2,
          0,
          beam("Charge returns to caster", charge + 350, 1500, {
            travelOrigin: "target",
            scale: 0.55,
          }),
        );
      break;
    case "stormHeal":
      layers = [
        cast("Revitalizing focus"),
        aura("area", "Cloud surrounds target", charge - 100, 2100, {
          below: false,
          opacity: 0.35,
          scale: 2,
        }),
        hit("Revitalizing lightning", charge + 350, 2000, {
          scale: 2.4,
          fadeIn: 0,
          customAnchor: true,
          anchorX: 0.58,
          anchorY: 0.62,
        }),
        aura("aura", "Vitality restores", charge + 650, 1900, { scale: 1.3 }),
        pose(
          "pulse",
          "Supercharged pulse",
          charge + 700,
          1500,
          "targets",
          0.08,
          0.35,
        ),
      ];
      break;
    case "stormEnclosure":
      layers = [
        cast("Storm gathers"),
        hit("Swirling storm", charge, 2200, { scale: 1.5, opacity: 0.65 }),
        aura("aura", "Crackling discharge", charge + 250, 1600, { scale: 1.2 }),
        pose("shake", "Storm response", charge + 300, 950, subject, 0.06, 0.45),
      ];
      break;
    case "vitalitySeed":
      layers = [
        cast("Shape vital seed"),
        beam("Seed flight", charge, 1500, { scale: 0.5 }),
        hit("Seed embeds", charge + 800, 850, { scale: 0.7 }),
        aura("hit", "Void drains outward", charge + 1150, 1400, {
          scale: 2.4,
          opacity: 0.45,
          scaleIn: 0.2,
          scaleInDuration: 900,
        }),
        aura("aura", "Vital energy returns", charge + 1750, 1600, {
          scale: 1.4,
        }),
        pose(
          "pulse",
          "Restorative pulse",
          charge + 1800,
          1500,
          "targets",
          0.09,
          0.4,
        ),
      ];
      Object.assign(layers[3], {
        afterStage: layers[2].stageId,
        timingAnchor: "start",
        startOffset: 250,
      });
      Object.assign(layers[4], {
        afterStage: layers[3].stageId,
        timingAnchor: "end",
        startOffset: 0,
      });
      Object.assign(layers[5], {
        afterStage: layers[4].stageId,
        timingAnchor: "start",
        startOffset: 50,
      });
      break;
    case "gatherOnly":
      layers = [
        cast("Gather at fist"),
        fx("cast", "hit", "Element coalesces", charge - 150, 1500, {
          scale: 0.65,
        }),
        aura("aura", "Ready for later blast", charge + 400, 1400, {
          subject: "source",
          scale: 0.8,
        }),
      ];
      break;
    case "combatLeap":
      layers = [
        cast("Elemental power gathers"),
        pose(
          "lunge",
          "Cosmetic charge",
          charge - 100,
          1100,
          "source",
          0.5,
          0.65,
        ),
        hit("Melee contact", charge + 450, 1200),
        pose(
          "recoil",
          "Contact recoil",
          charge + 480,
          800,
          "targets",
          0.14,
          0.55,
        ),
      ];
      break;
    case "areaVolley": {
      const flight = beam("Arrows fly into burst", charge, 1600, {
        travelDestination: "area",
        repeats: 3,
        repeatScope: "total",
        repeatInterval: 220,
        scale: 0.65,
        oneShot: true,
      });
      const contact = d.mediaTiming?.bolt?.contact ?? 1000;
      layers = [
        cast("Conjure salvo"),
        flight,
        fx("template", "hit", "Arrow contacts", charge + contact, 1200, {
          afterStage: flight.stageId,
          timingAnchor: "start",
          startOffset: contact,
          repeats: 1,
          repeatScope: "total",
          repeatInterval: 220,
          scale: 1,
          oneShot: true,
        }),
        fx("template", "area", "Dust settles", charge + contact + 440, 1600, {
          scale: 0.6,
          below: true,
          opacity: 0.4,
        }),
        pose("recoil", "Salvo release", charge, 900, "source", 0.06, 0.4),
      ];
      break;
    }
    case "areaRain":
      layers = [
        cast("Call fragment cloud"),
        fx("template", "area", "Cloud gathers over chosen area", charge, 2700, {
          scale: 1,
          opacity: 0.35,
        }),
        fx("template", "hit", "Fragments fall into area", charge + 350, 2700, {
          scale: 1,
          oneShot: true,
          tintEnabled: true,
          tint: d.motif === "forceRain" ? "#bc98ff" : "#ecebe4",
          saturation: -1,
        }),
      ];
      break;
    case "areaDebris":
    case "areaDarkness":
      layers = [
        cast("Animate area"),
        fx(
          "template",
          "area",
          pattern === "areaDarkness"
            ? "Dark shroud"
            : "Objects stir throughout area",
          charge,
          2400,
          { scale: 1, below: true, opacity: 0.65 },
        ),
        fx(
          "template",
          "hit",
          pattern === "areaDarkness" ? "Shadow teeth bite" : "Debris lashes",
          charge + 400,
          1800,
          { scale: 0.7, opacity: 0.65 },
        ),
      ];
      break;
    case "stormCloud":
      layers = [
        cast("Call storm cloud"),
        fx("template", "area", "Cloud forms", charge, 2500, {
          scale: 1,
          opacity: 0.4,
        }),
        fx(
          "template",
          "hit",
          "One sample lightning strike",
          charge + 500,
          2000,
          {
            scale: 0.2,
            fadeIn: 0,
            customAnchor: true,
            anchorX: 0.58,
            anchorY: 0.62,
          },
        ),
      ];
      break;
    case "areaMissile": {
      const flight = fx(
        "projectile",
        "bolt",
        "Object flies to area",
        charge,
        850,
        {
          travelDestination: "area",
          perSquare: 60,
          scale: 0.6,
          moveEase: "easeInQuad",
        },
      );
      layers = [
        cast("Lift area missile"),
        flight,
        fx("template", "area", "Impact fills area", charge + 1000, 2200, {
          afterStage: flight.stageId,
          timingAnchor: "end",
          startOffset: -30,
          scale: 1,
          below: true,
        }),
        fx("template", "hit", "Impact residue", charge + 1450, 1600, {
          afterStage: flight.stageId,
          timingAnchor: "end",
          startOffset: 300,
          scale: 0.9,
          opacity: 0.5,
        }),
      ];
      break;
    }
    case "claws":
      layers = [
        cast("Claw morph"),
        pose("lunge", "Claw lunge", charge - 150, 500, "source", 0.22, 0.8),
        hit("Gouge", charge + 80, 650, { rotation: 35, scale: 1.3 }),
        pose("recoil", "Claw recoil", charge + 100, 500, "targets", 0.13, 0.7),
      ];
      break;
    case "grasp":
      layers = [
        cast("Shape talon"),
        hit("Acid talon", charge, 850, {
          scaleIn: 0.1,
          scaleInDuration: 300,
          hue: 90,
        }),
        aura("aura", "Corrosion fumes", charge + 250, 1700, {
          scale: 1.2,
          opacity: 0.65,
        }),
        pose("recoil", "Cosmetic tug", charge + 150, 500, "targets", 0.12, 0.6),
      ];
      break;
    case "push":
      layers = [
        cast("Pressure gathers"),
        beam("Water jet", charge, 700, { scale: 1.1 }),
        hit("Water splash", charge + 420, 900, { scale: 1.5 }),
        pose("recoil", "Water recoil", charge + 460, 650, "targets", 0.28, 0.8),
      ];
      break;
    case "eruption":
      layers = [
        cast("Water draws up"),
        hit("Upward spout", charge, 1100, {
          tracks: [track("position.y", 0.35, -0.35, 650)],
          scaleIn: 0.2,
          scaleInDuration: 350,
        }),
        aura("aura", "Water settles", charge + 500, 800, { opacity: 0.6 }),
        pose(
          "levitate",
          "Spout bounce",
          charge + 150,
          550,
          "targets",
          0.11,
          0.6,
        ),
      ];
      break;
    case "object":
      layers = [
        cast(d.motif === "thrownFlame" ? "Form flame" : "Lift loose object"),
        fx(
          "projectile",
          "bolt",
          d.motif === "thrownFlame" ? "Thrown flame" : "Hurled object",
          charge,
          800,
          {
            moveEase: "easeInQuad",
            scale: 0.5,
            rotation: 40,
            rotateIn: -70,
            rotateInDuration: 600,
          },
        ),
        hit(
          d.motif === "thrownFlame" ? "Flame contact" : "Object impact",
          charge + 750,
          600,
        ),
        pose(
          "recoil",
          "Physical recoil",
          charge + 760,
          450,
          "targets",
          0.12,
          0.65,
        ),
      ];
      break;
    case "restore":
      layers = [
        cast("Channel vitality"),
        hit("Vitality bloom", charge, 1300, {
          scaleIn: 0.1,
          scaleInDuration: 650,
          glow: 2,
          glowColor: "#b1ffc4",
        }),
        aura("aura", "Rising vital sparks", charge + 350, 1500, {
          tracks: [track("position.y", 0.15, -0.45, 1250)],
          opacity: 0.7,
        }),
        pose(
          "pulse",
          "Vitality pulse",
          charge + 200,
          1000,
          "targets",
          0.1,
          0.45,
        ),
      ];
      break;
    case "soothe":
      layers = [
        cast("Gentle thought"),
        hit("Restorative wash", charge, 1800, {
          opacity: 0.6,
          fadeIn: 700,
          scaleIn: 0.6,
          scaleInDuration: 900,
        }),
        aura("aura", "Calm settles", charge + 550, 1700, {
          scale: 1.3,
          opacity: 0.55,
          rotateIn: -25,
          rotateInDuration: 1200,
        }),
        pose("pulse", "Calm breath", charge + 350, 1700, "targets", 0.1, 0.18),
      ];
      break;
    case "collapse":
      layers = [
        cast("Void gathers"),
        aura("hit", "Void closes", charge, 1200, {
          scale: 1.7,
          scaleOut: 0.05,
          scaleOutDuration: 1000,
        }),
        hit("Void residue", charge + 650, 900, { opacity: 0.5, scale: 0.9 }),
        pose(
          "shake",
          "Life-force tremor",
          charge + 380,
          550,
          "targets",
          0.06,
          0.35,
        ),
      ];
      break;
    case "drain":
      layers = [
        cast("Reach for life force"),
        hit("Drain contact", charge, 750, { opacity: 0.65 }),
        beam("Return life force", charge + 250, 1050, {
          travelOrigin: "target",
          opacity: 0.7,
        }),
        fx("cast", "aura", "Caster receives", charge + 900, 1000, {
          scale: 1.35,
          glow: 2,
        }),
        pose("pulse", "Recovery pulse", charge + 1050, 800, "source", 0.1, 0.5),
      ];
      break;
    case "warp":
      layers = [
        cast("Warp life force"),
        hit("Life-force distortion", charge, 950, {
          opacity: 0.65,
          scale: 0.85,
          tracks: [track("scale.x", 1.2, 0.65, 650)],
        }),
        pose(
          "shake",
          "Life-force jolt",
          charge + 180,
          400,
          "targets",
          0.06,
          0.3,
        ),
        aura("aura", "Warp residue", charge + 450, 800, {
          opacity: 0.3,
          scale: 0.8,
        }),
      ];
      break;
    case "jolt":
      layers = [
        cast("Mental pressure"),
        // Severity reads in scale: a 1d6 cantrip stays small, 6d6+ grows.
        hit("Mental stars", charge, 850, { offsetY: -0.35, scale: 0.85 + Math.min(0.45, (d.damageDice || 0) * 0.05) }),
        pose("shake", "Mental jolt", charge + 100, 400, "targets", 0.07, 0.4),
      ];
      break;
    case "pain":
      layers = [
        cast("Illusory pressure"),
        hit("Pain pulses", charge, 500, {
          repeats: 2,
          repeatGap: 500,
          opacity: 0.55,
        }),
        pose("shake", "Pain tremors", charge + 130, 450, "targets", 0.06, 0.5),
        aura("aura", "Phantom residue", charge + 350, 2000, { opacity: 0.35 }),
      ];
      layers[2].repeats = 2;
      layers[2].repeatGap = 550;
      break;
    case "fear":
      layers = [
        cast("Plant dread"),
        hit("Dread blooms", charge, 1600, {
          opacity: 0.6,
          scaleIn: 0.2,
          scaleInDuration: 500,
        }),
        aura("aura", "Dark wisps", charge + 500, 1700, {
          opacity: 0.5,
          tracks: [track("position.y", 0, -0.25, 1200)],
        }),
        pose("shake", "Fear tremor", charge + 600, 800, "targets", 0.05, 0.3),
      ];
      break;
    case "shield":
    case "glass":
    case "bone":
    case "fireShield": {
      const glass = pattern === "glass",
        bone = pattern === "bone",
        fire = pattern === "fireShield";
      layers = [
        cast(bone ? "Assemble bone" : glass ? "Glass glints" : "Raise guard"),
        hit(
          glass
            ? "Glass shell"
            : bone
              ? "Bone guard"
              : fire
                ? "Fire shield"
                : "Force shield",
          charge,
          1200,
          {
            scale: glass ? 1.05 : 1.35,
            opacity: glass ? 0.45 : 1,
            // Centred: every shield/ward clip is a dome around the body, not a shield held out in front.
            scaleIn: 0.1,
            scaleInDuration: 450,
            brightness: bone ? 0.65 : 1.05,
            saturation: bone ? -0.8 : 0,
          },
        ),
        aura(
          "aura",
          fire ? "Flame rim" : glass ? "Glass shine" : "Guard settles",
          charge + 350,
          1600,
          { opacity: glass ? 0.4 : 0.65, scale: fire ? 1.65 : 1.2 },
        ),
        pose(
          "pulse",
          "Guard stance",
          charge,
          650,
          "source",
          0.1,
          bone ? 0.55 : glass ? 0.18 : 0.3,
        ),
      ];
      break;
    }
    case "haste":
      layers = [
        cast("Accelerate time"),
        copy("Fast echoes", charge, 1100, {
          copies: 3,
          copySpread: 0.25,
          tracks: [track("position.x", -0.35, 0.35, 450)],
        }),
        aura("aura", "Quick trails", charge, 1300, {
          playbackRate: 1.7,
          rotateIn: -45,
          rotateInDuration: 350,
        }),
        pose(
          "pulse",
          "Quickened pulse",
          charge + 100,
          450,
          "targets",
          0.1,
          0.3,
        ),
      ];
      break;
    case "slow":
      layers = [
        cast("Dilate time"),
        aura("aura", "Heavy time ring", charge, 2200, {
          playbackRate: 0.55,
          rotateIn: -90,
          rotateInDuration: 2000,
          scaleOut: 0.6,
          scaleOutDuration: 1800,
        }),
        copy("Heavy echo", charge + 400, 1800, {
          copies: 1,
          opacity: 0.25,
          tracks: [track("position.x", 0.1, 0, 1700)],
        }),
      ];
      break;
    case "flight":
    case "gravity":
      layers = [
        cast(pattern === "flight" ? "Lift on air" : "Defy gravity"),
        hit(
          pattern === "flight" ? "Wind wisps" : "Gravity ring",
          charge,
          2000,
          { below: true, opacity: 0.6 },
        ),
        copy("Ground shadow", charge, 2200, {
          shadow: true,
          opacity: 0.25,
          offsetY: 0.3,
          scale: 0.9,
        }),
        // Only spells that actually lift a creature rise; heavier or redirected
        // gravity presses (shake) or settles (pulse) instead of floating.
        ...(pattern === "gravity" && HEAVY_GRAVITY[spell.slug] ? [pose(
          HEAVY_GRAVITY[spell.slug][0],
          HEAVY_GRAVITY[spell.slug][1],
          charge + 100,
          HEAVY_GRAVITY[spell.slug][0] === "press" ? 1100 : 1200,
          subject,
          HEAVY_GRAVITY[spell.slug][0] === "press" ? 0.12 : 0.06,
          HEAVY_GRAVITY[spell.slug][0] === "press" ? 0.6 : 0.35,
        )] : [pose(
          "levitate",
          pattern === "flight" ? "Air lift" : "Slow levitation",
          charge + 100,
          2100,
          subject,
          pattern === "flight" ? 0.55 : 0.35,
          0.8,
        )]),
      ];
      break;
    case "mirror":
    case "blur":
    case "vanish":
    case "form": {
      const mirror = pattern === "mirror",
        blur = pattern === "blur";
      layers = [
        cast(
          mirror
            ? "Split reflections"
            : blur
              ? "Blur silhouette"
              : pattern === "form"
                ? "Change silhouette"
                : "Bend light",
        ),
        hit("Shimmer", charge, 1000, { opacity: 0.5 }),
        copy(
          mirror
            ? "Three swirling copies"
            : blur
              ? "Blurred target copies"
              : "Dissolving silhouette",
          charge + 100,
          1900,
          {
            copies: mirror ? 3 : blur ? 2 : 1,
            copySpread: mirror ? 0.55 : blur ? 0.1 : 0.15,
            shadow: pattern === "form",
            blur: blur ? 3 : 0,
            tracks: [
              track("position.x", -0.2, 0.2, 1300, {
                loop: mirror,
                pingPong: mirror,
              }),
              track("alpha", 0.4, 0, 1400, { delay: 500 }),
            ],
          },
        ),
        aura("aura", "Afterimage wisps", charge + 500, 1600, { opacity: 0.35 }),
      ];
      if (pattern === "form")
        layers.push(
          pose(
            "pulse",
            "Transformation swell",
            charge + 300,
            1300,
            subject,
            0.1,
            0.7,
          ),
        );
      break;
    }
    case "vine":
      layers = [
        cast("Vine forms"),
        fx("projectile", "bolt", "Vine reaches target", charge, 900, {
          scale: 0.75,
          moveEase: "easeInQuad",
        }),
        aura("aura", "Binding tendril", charge + 550, 1600, {
          scaleIn: 0.3,
          scaleInDuration: 500,
        }),
        pose("recoil", "Vine catch", charge + 650, 450, "targets", 0.1, 0.4),
      ];
      break;
    case "explosion":
    case "glob":
    case "growth":
    case "prismatic": {
      const areaKind =
        spell.delivery === "burst"
          ? "template"
          : subject === "targets"
            ? "impact"
            : "cast";
      layers = [
        cast(
          pattern === "glob"
            ? "Acid gathers"
            : pattern === "growth"
              ? "Seed the ground"
              : "Gather area energy",
        ),
        fx(
          areaKind,
          "area",
          pattern === "explosion"
            ? "Single detonation"
            : pattern === "glob"
              ? "Acid spray"
              : pattern === "growth"
                ? "Plants unfold"
                : "Pulsing lights",
          charge,
          pattern === "growth" ? 2600 : 1600,
          {
            below: pattern !== "explosion",
            scaleIn: pattern === "explosion" ? 1 : 0.1,
            scaleInDuration: pattern === "explosion" ? 0 : 650,
            tracks:
              pattern === "prismatic"
                ? [track("alpha", 0.4, 1, 650, { loop: true, pingPong: true })]
                : [],
          },
        ),
        fx(
          areaKind,
          pattern === "explosion" ? "aura" : "hit",
          pattern === "explosion"
            ? "Smoke disperses"
            : pattern === "glob"
              ? "Fumes linger"
              : pattern === "growth"
                ? "Leaves rise"
                : "Light settles",
          charge + 850,
          1400,
          { opacity: 0.4, scale: 1.1 },
        ),
      ];
      break;
    }
    case "portal":
    case "gate":
      layers = [
        cast(pattern === "gate" ? "Gather travel runes" : "Prepare departure"),
        hit(
          pattern === "gate" ? "Departure gate" : "Departure shimmer",
          charge,
          pattern === "gate" ? 2200 : 850,
          { scale: pattern === "gate" ? 2.2 : 1.25, below: true },
        ),
        copy("Departure echo", charge + 150, pattern === "gate" ? 1600 : 650, {
          shadow: true,
          tracks: [track("alpha", 0.45, 0, pattern === "gate" ? 1400 : 500)],
        }),
      ];
      break;
    case "disintegrate":
      layers = [
        cast("Aim tracer"),
        beam("Faint tracer", charge, 400, { scale: 0.3, opacity: 0.3 }),
        beam("Destructive beam", charge + 300, 1100, { scale: 1.2 }),
        hit("Contact particles", charge + 900, 1000, { opacity: 0.55 }),
        pose("shake", "Beam tremor", charge + 900, 600, "targets", 0.1, 0.8),
      ];
      break;
    case "bless":
    case "bane":
      layers = [
        cast(pattern === "bless" ? "Call blessing" : "Spread doubt"),
        aura(
          "aura",
          pattern === "bless" ? "Outward rings" : "Inward rings",
          charge,
          2400,
          {
            scale: 2,
            scaleIn: pattern === "bless" ? 0.15 : 1,
            scaleInDuration: pattern === "bless" ? 1600 : 0,
            scaleOut: pattern === "bane" ? 0.15 : 1,
            scaleOutDuration: pattern === "bane" ? 1900 : 0,
            opacity: 0.6,
          },
        ),
        pose("pulse", "Caster channel", charge, 1200, "source", 0.1, 0.25),
      ];
      break;
    case "slick":
      layers = [
        cast("Conjure slick"),
        hit("Glossy coating", charge, 1800, {
          below: true,
          scaleIn: 0.2,
          scaleInDuration: 800,
          opacity: 0.7,
        }),
        aura("aura", "Surface glint", charge + 800, 1000, { opacity: 0.25 }),
      ];
      break;
    case "song":
      layers = [
        cast("Begin refrain"),
        at("hit", "Floating notes", charge, 1700, {
          offsetY: -0.4,
          tracks: [track("position.y", 0, -0.4, 1400)],
        }),
        aura("aura", "Resonance", charge + 300, 1300, {
          scale: 1.5,
          opacity: 0.6,
        }),
        pose(
          "pulse",
          "Rhythmic breath",
          charge + 300,
          1100,
          subject,
          0.1,
          0.22,
        ),
      ];
      break;
    case "sonic":
      layers = [
        cast("Pressure builds"),
        hit("Sonic shock", charge, 800),
        aura("aura", "Sound wave", charge + 200, 1200, {
          scaleIn: 0.1,
          scaleInDuration: 850,
          scale: 1.9,
        }),
        pose(
          d.push ? "recoil" : "shake",
          "Sonic response",
          charge + 250,
          700,
          subject,
          0.12,
          0.6,
        ),
      ];
      break;
    case "stone":
      layers = [
        cast("Stone stirs"),
        hit("Ground fracture", charge, 1300, { below: true, scale: 1.6 }),
        hit("Falling fragments", charge + 400, 850, { rotation: 45 }),
        // Restorative or carving stone work reshapes gently; only harm trembles.
        pose(
          subject === "source" || !(d.impact || spell.slug === "petrify") ? "pulse" : "shake",
          subject === "source" ? "Ground channel" : d.impact || spell.slug === "petrify" ? "Ground tremor" : "Stone reshapes",
          charge + 450,
          800,
          subject,
          0.1,
          0.65,
        ),
      ];
      break;
    case "groundCrush":
      layers = [
        cast("Open the ground"),
        hit("Ground opens", charge, 750, {
          below: true,
          scale: 1.5,
          scaleIn: 0.05,
          scaleInDuration: 650,
        }),
        hit("Ground closes", charge + 650, 1050, {
          below: true,
          scale: 1.5,
          scaleOut: 0.05,
          scaleOutDuration: 900,
        }),
        aura("aura", "Broken fragments", charge + 650, 900, {
          opacity: 0.55,
          scale: 1.1,
        }),
        pose(
          "shake",
          "Closing tremor",
          charge + 720,
          500,
          "targets",
          0.08,
          0.55,
        ),
      ];
      break;
    case "tendrils":
      layers = [
        cast("Dark shapes gather"),
        fx("template", "area", "Grasping shapes rise", charge, 2300, {
          below: true,
          scaleIn: 0.05,
          scaleInDuration: 700,
        }),
        fx("template", "aura", "Shadow wisps", charge + 450, 1700, {
          opacity: 0.35,
          below: true,
        }),
      ];
      break;
    case "hoveringFlame":
      layers = [
        cast("Conjure flame"),
        fx("cast", "hit", "Flame coalesces", charge, 2200, {
          scale: 1.1,
          scaleIn: 0.05,
          scaleInDuration: 550,
          tracks: [
            track("position.y", 0.08, -0.08, 900, {
              loop: true,
              pingPong: true,
            }),
          ],
        }),
        fx("aura", "aura", "Drifting embers", charge + 450, 1700, {
          subject: "source",
          opacity: 0.45,
        }),
      ];
      break;
    case "summon":
      layers = [
        fx("cast", "aura", "Conjuration circle", 0, 2200, {
          below: true,
          scale: 1.8,
          rotateIn: -90,
          rotateInDuration: 1600,
        }),
        fx("cast", "hit", "Conjuration opens", charge, 1800, {
          scale: 1.8,
          scaleIn: 0.05,
          scaleInDuration: 1000,
        }),
        fx("cast", "cast", "Conjuration settles", charge + 1300, 700, {
          opacity: 0.5,
          scale: 1.1,
        }),
      ];
      break;
    case "arrival":
      layers = [
        cast("Prepare arrival"),
        fx("cast", "hit", "Arrival cue", charge, 2300, {
          scale: 2,
          scaleIn: 0.05,
          scaleInDuration: 900,
          below: true,
        }),
        fx("aura", "aura", "Arrival wisps", charge + 650, 1800, {
          subject: "source",
          scale: 1.8,
          opacity: 0.45,
          below: true,
        }),
      ];
      break;
    case "reanimate":
      layers = [
        cast("Necromantic invocation"),
        hit("Reanimation energy rises", charge, 1900, {
          scaleIn: 0.05,
          scaleInDuration: 900,
          tracks: [track("position.y", 0.3, -0.25, 1400)],
        }),
        aura("aura", "Grave wisps", charge + 450, 1700, {
          opacity: 0.45,
          scale: 1.3,
        }),
      ];
      break;
    case "mist":
      layers = [
        cast("Gather fumes"),
        hit("Poison mist", charge, 2200, {
          opacity: 0.6,
          scaleIn: 0.1,
          scaleInDuration: 1000,
        }),
        aura("aura", "Drifting vapour", charge + 600, 1500, {
          opacity: 0.35,
          tracks: [track("position.x", -0.15, 0.25, 1300)],
        }),
      ];
      break;
    case "scan":
      layers = [
        cast("Focus perception"),
        hit("Arcane scan", charge, 1700, {
          scaleIn: 0.1,
          scaleInDuration: 1000,
          opacity: 0.65,
        }),
        aura("aura", "Reading runes", charge + 400, 1500, {
          rotateIn: -60,
          rotateInDuration: 1400,
          opacity: 0.45,
        }),
      ];
      break;
    case "weapon":
      layers = [
        cast("Weapon manifests"),
        hit("Weapon flourish", charge, 900, {
          rotateIn: -60,
          rotateInDuration: 600,
        }),
        // Only a spell attack or melee delivery lunges; conjured bites, mirrored
        // cuts and weapon buffs channel in place, and only damage makes targets react.
        pose(
          subject === "source" || !(d.spellAttack || spell.delivery === "melee") ? "pulse" : "lunge",
          subject === "source" || !(d.spellAttack || spell.delivery === "melee") ? "Weapon channel" : "Weapon lunge",
          charge - 100,
          550,
          "source",
          0.14,
          0.6,
        ),
        ...(subject === "targets" && d.damageDice
          ? [
              pose(
                "recoil",
                "Weapon reaction",
                charge + 250,
                500,
                "targets",
                0.1,
                0.5,
              ),
            ]
          : []),
      ];
      break;
    default: {
      layers = base.map((s, i) => ({
        ...s,
        stageId: `${spell.id}-design-${++serial}`,
        duration: s.duration + (d.sustained ? 350 : 0) + rank * 25,
        scale: s.scale + (s.kind === "template" ? 0 : rank * 0.025),
        fadeIn: d.subtle ? 350 : s.fadeIn,
      }));
      if (d.impact && ["target", "bolt", "melee"].includes(spell.delivery))
        layers.push(
          pose(
            d.push ? "recoil" : "shake",
            d.push ? "Impact recoil" : "Impact response",
            charge + 500,
            550,
            "targets",
            d.push ? 0.15 : 0.06,
            0.4,
          ),
        );
      if (pattern === "swarm")
        layers[1] = {
          ...layers[1],
          label: "Swarm gathers",
          tracks: [
            track("position.x", -0.3, 0.3, 1400, {
              loop: true,
              pingPong: true,
            }),
          ],
        };
    }
  }
  // Narrative embellishments come from source semantics, never name hashes.
  // Musical/other authored caster layers must not discard their native cone.
  if (!GAP_SPELL_MOTIFS[d.motif] && spell.delivery === "cone" && d.nativeFootprint && !layers.some(s => s.kind === "template"))
    layers.push(fx("template", "area", "Cone spreads from origin", charge,
      Math.max(2400, d.mediaTiming?.area?.duration ?? 0),
      { scale: 1, oneShot: true, fadeIn: 0, fadeOut: 100 }));
  if (
    d.persistent &&
    !GAP_SPELL_MOTIFS[d.motif] && !FIRE_SPELL_MOTIFS[d.motif] &&
    !d.deferredResidue &&
    spell.delivery !== "line" &&
    !["pain", "grasp", "smolder"].includes(pattern) &&
    layers.length < 7
  )
    layers.push(
      aura(
        "aura",
        "Lingering residue",
        Math.max(...layers.map((s) => s.delay + s.duration)) - 500,
        1100,
        { opacity: 0.4, scale: 1.1 },
      ),
    );
  layers = capSpellStages(spell, applyFixStyle(spell, SPELL_MOTIFS[d.motif], layers, { fx, charge }));
  if(!FIRE_SPELL_MOTIFS[d.motif])layers = applySpellVisualIdentity(spell, layers, stage);
  let paced = paceDeliveryEffects(layers, GAP_SPELL_MOTIFS[d.motif]||FIRE_SPELL_MOTIFS[d.motif]?{...d,preserveStageTiming:true}:d).map(paceGeneratedMotion);
  let reviewedMotion = SPELL_MOTION_REVIEWS[spell.slug];
  if (spell.slug === 'jump') {
    // The base spell jumps now. Its rank-3 version only grants later Leaps.
    if (Number(castRank) >= 3) reviewedMotion = null;
    else paced = paced.filter(s => s.kind !== 'motion').map(s => ({ ...s,
      ...(s.kind === 'impact' ? { kind: 'cast' } : {}), subject: 'source' }));
  }
  if (spell.slug === 'hippocampus-retreat') {
    // The caster changes its own lower limbs, Strikes once, then swims away.
    paced = paced.filter(s => s.kind !== 'motion').map(s => ({ ...s,
      ...(s.kind === 'impact' ? { kind: 'cast' } : {}), subject: 'source' }));
    paced.push(fx('impact', 'hit', 'Parting melee spell attack', charge, 1600, {
      subject: 'targets', targetSelection: 'first', scale: 1.1 }));
  }
  paced = applyCatalogMotion(spell, paced, reviewedMotion);
  // A source/area composition can include selected allies or victims without
  // making their optional links a prerequisite for its primary illustration.
  if(GAP_SPELL_MOTIFS[d.motif] && ['self','emanation','portal','transform','point','ritual','burst','cone','line','wall'].includes(spell.delivery))
    paced=paced.map(s=>s.travelDestination!=='area'&&(['travel','projectile','impact'].includes(s.kind)||s.subject==='targets')?{...s,optionalTargets:true}:s);
  if (!motion) {
    const retained = paced.filter(s => s.kind !== 'motion'), ids = new Set(retained.map(s => s.stageId));
    let resolved;
    paced = retained.map(s => {
      if (!s.afterStage || ids.has(s.afterStage)) return s;
      // Effects-only casting retains the motion's original contact time without
      // retaining a dangling reference to the deliberately omitted token move.
      resolved ??= timedStages({stages:paced});
      return {...s,afterStage:'',delay:resolved.find(p=>p.stageId===s.stageId).delay};
    });
  }
  return paced.map((s) =>
      Object.fromEntries(
        Object.entries(s).map(([key, value]) => [
          key,
          typeof value === "number" ? Math.round(value * 1000) / 1000 + 0 : value,
        ]),
      ),
    );
}
