// Daggerheart library: domain cards and weapons from data/daggerheart-catalog.mjs (built by
// tools/build-daggerheart.mjs from the system's compendia) and the system's conditions, each with a
// deterministic animation: a card by its design record (data/daggerheart-card-designs/, authored from
// the card's text) or, without one, by its domain's palette and its kind; a weapon by the family its
// name names and its range, a condition by its look. Pure: no Foundry globals.
import { DAGGERHEART_SOURCE, DAGGERHEART_CARDS, DAGGERHEART_WEAPONS } from "../../../data/daggerheart-catalog.mjs";
import { CARD_DESIGNS } from "../../../data/daggerheart-card-designs/index.mjs";
import { designStages } from "./daggerheart-card-design.mjs";
import { clone, normalize, validateRecipe, matchRecipe, ownRecipe, matchStrikeOverride } from "../../core/model.mjs";
import { DH_ROLL_TYPES, MELEE_RANGES, dhDamageKind, weaponFamily, featureElement } from "../../systems/daggerheart.mjs";
import { DEFEATED_RECIPE } from "../../engines/playback/defeated-look.mjs";
import { weaponSoundDesign, cardSoundDesign, featureSoundDesign, utilitySoundDesign, withDhSounds, weaponMotion, featureMotion, utilityMotion } from "./daggerheart-polish.mjs";
import { withConditionLook } from "../shared/catalog-fx.mjs";
import { withCatalogTeleport } from "../shared/catalog-teleport.mjs";
export { DAGGERHEART_SOURCE };
export const DH_KINDS = Object.freeze(["card", "weapon", "condition"]);
const SOURCE_URL = `https://github.com/${DAGGERHEART_SOURCE.repository ?? "Foundryborne/daggerheart"}/tree/${DAGGERHEART_SOURCE.version}`;
const round = (n) => Math.round(n * 100) / 100;
const title = (id) => { const s = String(id ?? ""); return s ? s.charAt(0).toUpperCase() + s.slice(1) : ""; };

// Domain palettes: a colour and a motif each, as JB2A keys. Patreon keys first; every list ends with
// a key JB2A Free has (tests/daggerheart-catalog.test.mjs resolves every slot in both editions).
export const DOMAIN_PALETTES = Object.freeze({
  arcana: { color: "#a070ff", motif: "violet arcane bursts and runes",
    cast: ["jb2a.cast_generic.01.dark_purple", "jb2a.cast_generic.02.blue"], projectile: ["jb2a.magic_missile.purple"],
    impact: ["jb2a.impact.005.purple", "jb2a.impact.004.dark_purple", "jb2a.particle_burst.01.rune.bluepurple"],
    aura: ["jb2a.energy_strands.overlay.purple.01", "jb2a.energy_strands.02.marker.bluepurple"],
    circle: ["jb2a.magic_signs.circle.02.evocation.complete.purple", "jb2a.magic_signs.circle.02.evocation", "jb2a.magic_signs.circle.01.evocation"] },
  blade: { color: "#c9d4e0", motif: "steel slashes, white sparks",
    cast: ["jb2a.melee_generic.slash.01.bluepurple", "jb2a.melee_generic.slash.02.001.blue"], projectile: ["jb2a.dagger.throw.01.white"],
    impact: ["jb2a.impact.003.blue", "jb2a.impact.001.blue"], aura: ["jb2a.static_electricity.01.blue"],
    circle: ["jb2a.magic_signs.circle.02.abjuration.complete.blue"] },
  bone: { color: "#e8e2d0", motif: "bone shards and cracks, pale",
    cast: ["jb2a.cast_generic.03.white", "jb2a.cast_generic.02.blue"], projectile: ["jb2a.magic_missile.grey", "jb2a.magic_missile.purple"],
    impact: ["jb2a.impact.ground_crack.01.white", "jb2a.ground_cracks.01.orange"], aura: ["jb2a.smoke.puff.centered.grey"],
    circle: ["jb2a.magic_signs.circle.02.necromancy.complete.dark_green", "jb2a.magic_signs.circle.02.necromancy", "jb2a.magic_signs.circle.01.necromancy"] },
  codex: { color: "#5b8def", motif: "blue runes and magic circles",
    cast: ["jb2a.cast_generic.02.blue"], projectile: ["jb2a.magic_missile.blue", "jb2a.magic_missile.purple"],
    impact: ["jb2a.impact.004.blue", "jb2a.impact.003.blue"], aura: ["jb2a.magic_signs.rune.divination.complete.blue", "jb2a.magic_signs.rune.divination"],
    circle: ["jb2a.magic_signs.circle.02.divination.complete.blue", "jb2a.magic_signs.circle.02.divination", "jb2a.magic_signs.circle.01.divination"] },
  dread: { color: "#a8323c", motif: "blood-red dread and black smoke",
    cast: ["jb2a.cast_generic.01.dark_red", "jb2a.cast_generic.fire.01.orange"], projectile: ["jb2a.magic_missile.dark_red", "jb2a.magic_missile.purple"],
    impact: ["jb2a.impact.004.dark_red", "jb2a.impact.003.dark_purple", "jb2a.impact.005.orange"], aura: ["jb2a.energy_strands.overlay.dark_red.01", "jb2a.smoke.puff.centered.grey"],
    circle: ["jb2a.magic_signs.circle.02.necromancy.complete.dark_red", "jb2a.magic_signs.circle.02.necromancy"] },
  grace: { color: "#ff9ec4", motif: "warm light and hearts/sparkles",
    cast: ["jb2a.cast_generic.01.yellow"], projectile: ["jb2a.magic_missile.yellow", "jb2a.magic_missile.purple"],
    impact: ["jb2a.markers.heart.pink.03", "jb2a.particle_burst.01.circle.yellow", "jb2a.healing_generic.200px.yellow"], aura: ["jb2a.healing_generic.200px.yellow"],
    circle: ["jb2a.magic_signs.circle.02.enchantment.complete.pink", "jb2a.magic_signs.circle.02.enchantment", "jb2a.magic_signs.circle.01.enchantment"] },
  midnight: { color: "#5b2a86", motif: "shadow smoke, dark purple",
    cast: ["jb2a.cast_generic.dark.01.red", "jb2a.cast_generic.02.dark_purple", "jb2a.cast_generic.02.blue"], projectile: ["jb2a.magic_missile.dark_red", "jb2a.magic_missile.purple"],
    impact: ["jb2a.smoke.puff.centered.dark_purple", "jb2a.impact.003.dark_purple", "jb2a.smoke.puff.centered.grey"], aura: ["jb2a.darkness.black"],
    circle: ["jb2a.magic_signs.circle.02.illusion.complete.dark_purple", "jb2a.magic_signs.circle.02.illusion", "jb2a.magic_signs.circle.01.illusion"] },
  sage: { color: "#5fae5a", motif: "green nature, vines and leaves",
    cast: ["jb2a.cast_generic.earth.01.browngreen"], projectile: ["jb2a.magic_missile.green", "jb2a.magic_missile.purple"],
    impact: ["jb2a.swirling_leaves.outburst.01.greenorange", "jb2a.swirling_leaves.outburst.01.pink"], aura: ["jb2a.entangle.green"],
    circle: ["jb2a.magic_signs.circle.02.conjuration.complete.green", "jb2a.magic_signs.circle.02.conjuration", "jb2a.magic_signs.circle.01.conjuration"] },
  splendor: { color: "#ffd966", motif: "radiant gold and white",
    cast: ["jb2a.sacred_flame.source.yellow"], projectile: ["jb2a.magic_missile.yellow", "jb2a.magic_missile.purple"],
    impact: ["jb2a.sacred_flame.target.yellow"], aura: ["jb2a.bless.200px.intro.yellow"],
    circle: ["jb2a.magic_signs.circle.02.evocation.complete.yellow", "jb2a.magic_signs.circle.02.conjuration.complete.yellow"] },
  valor: { color: "#e8a33d", motif: "golden shields and impacts",
    cast: ["jb2a.divine_smite.caster.yellowwhite", "jb2a.divine_smite.caster.blueyellow"], projectile: ["jb2a.magic_missile.orange", "jb2a.magic_missile.purple"],
    impact: ["jb2a.impact.ground_crack.01.orange", "jb2a.ground_cracks.01.orange"], aura: ["jb2a.markers.shield_rampart.complete.03.yellow", "jb2a.markers.shield_rampart.complete.01.orange"],
    circle: ["jb2a.magic_signs.circle.02.abjuration.complete.yellow", "jb2a.magic_signs.circle.02.abjuration.complete.blue"] },
});
export const domainPalette = (domain) => DOMAIN_PALETTES[String(domain ?? "").toLowerCase()] ?? DOMAIN_PALETTES.arcana;

// What a card animates: a rolled spellcast or attack rides its roll message ("attack"); anything else
// rides the use ("use"). Grimoires draw a magic circle; spellcasts that only heal mend.
export function cardDesigns(card) {
  const actions = Array.isArray(card?.actions) ? card.actions : [];
  const rolled = actions.filter((a) => DH_ROLL_TYPES.has(a?.roll)), plain = actions.filter((a) => !DH_ROLL_TYPES.has(a?.roll));
  const grimoire = card?.cardType === "grimoire";
  return {
    attack: rolled.length ? (grimoire ? "circle" : rolled.every((a) => a?.type === "healing") ? "mend" : "bolt") : null,
    use: plain.length || !actions.length ? (grimoire ? "circle" : "aura") : null,
  };
}
// Card level scales the intensity a little (1.00 at level 1, 1.36 at level 10); level 5+ adds a layer.
export const levelScale = (level) => round(1 + (Math.min(10, Math.max(1, Number(level) || 1)) - 1) * 0.04);
export function cardStages(design, palette, level) {
  const s = levelScale(level), extra = (Number(level) || 1) >= 5;
  const cast = { stageId: "cast", kind: "cast", assets: [...palette.cast], duration: 1000, scale: round(1 * s), opacity: 0.95 };
  switch (design) {
    case "bolt": return [cast,
      { stageId: "bolt", kind: "travel", assets: [...palette.projectile], delay: 400, duration: 1000, scale: round(1 * s) },
      { stageId: "hit", kind: "impact", assets: [...palette.impact], delay: 1100, duration: 1200, scale: round(1.2 * s) },
      ...(extra ? [{ stageId: "flare", kind: "impact", assets: [...palette.aura], delay: 1250, duration: 1400, scale: round(0.8 * s), opacity: 0.7 }] : [])];
    case "mend": return [cast,
      { stageId: "mend", kind: "impact", assets: [...palette.aura], delay: 500, duration: 1500, scale: round(1.2 * s) },
      ...(extra ? [{ stageId: "glow", kind: "impact", assets: [...palette.impact], delay: 800, duration: 1200, scale: round(0.7 * s), opacity: 0.8 }] : [])];
    case "circle": return [
      { stageId: "circle", kind: "cast", assets: [...palette.circle], duration: 2200, scale: round(1.1 * s), below: true, opacity: 0.85 },
      { ...cast, delay: 300 },
      { stageId: "hit", kind: "impact", assets: [...palette.impact], delay: 1200, duration: 1200, scale: round(0.9 * s), optionalTargets: true },
      ...(extra ? [{ stageId: "runes", kind: "aura", assets: [...palette.aura], delay: 200, duration: 2000, scale: round(0.9 * s), opacity: 0.6 }] : [])];
    default: return [cast,
      { stageId: "aura", kind: "aura", assets: [...palette.aura], delay: 300, duration: 2000, scale: round(1.2 * s), opacity: 0.95 },
      ...(extra ? [{ stageId: "circle", kind: "cast", assets: [...palette.circle], duration: 2000, scale: round(1.05 * s), below: true, opacity: 0.7 }] : [])];
  }
}

// Weapons: the family (daggerheart.mjs weaponFamily) picks the strike style, the name the swing inside
// it, the range melee or projectile (Melee and Very Close strike in melee).
// A crisp white star for edged and piercing blows, a warm burst for blunt ones; magic keeps its glow.
const PHYSICAL_HIT = ["jb2a.impact.007.white", "jb2a.impact.003.blue"];
const BLUNT_HIT = ["jb2a.impact.010.orange", "jb2a.impact.003.blue"];
// Natural attacks land on the target (claw rakes, a bite); weapon swings stretch from wielder to target.
const CLAWS = ["jb2a.claws.400px.red", "jb2a.claws.200px.red"], BITE = ["jb2a.bite.400px.red", "jb2a.bite.200px.red"];
const UNARMED = ["jb2a.unarmed_strike.physical.01.blue"], GENERIC_SLASH = ["jb2a.melee_generic.slashing.one_handed", "jb2a.unarmed_strike.physical.01.blue"];
const ON_TARGET = new Set([CLAWS[0], BITE[0]]);
export const NATURAL_ATTACK = Object.freeze({ claws: /claw|talon|rake|scratch|pincer|nails?\b|tear\b/i, bite: /bite|fang|jaw|maw|teeth|mandible|gnaw|gnash|chomp|nibble|beak|peck|proboscis|sucker/i,
  unarmed: /fist|punch|slam|tail|horn|ram\b|tentacle|unarmed|kick|headbutt|hoo(?:f|ves)|stomp|tusk|gore|antler|bash|\bhands?\b|\barms?\b/i });
const MAGICAL_HIT = ["jb2a.impact.004.dark_purple", "jb2a.impact.005.purple", "jb2a.particle_burst.01.rune.bluepurple"];
const ARROW = ["jb2a.arrow.physical.white.01", "jb2a.arrow.physical.blue"];
const BOLT = ["jb2a.bolt.physical.white", "jb2a.bolt.physical.orange"];
const SLASH = ["jb2a.melee_generic.slash.01.orange"];
const MISSILE = { magical: ["jb2a.magic_missile.purple"], physical: ["jb2a.magic_missile.orange", "jb2a.magic_missile.purple"] };
export const WEAPON_STYLES = Object.freeze({
  blade: { label: "Blade",
    melee: [[/dagger|knife|knives|anlace|scalpel|razor/i, ["jb2a.dagger.melee.02.white"]], [/axe|hatchet|labrys/i, ["jb2a.greataxe.melee.standard.white", "jb2a.handaxe.melee.standard.white"]],
      [/rapier|estoc/i, ["jb2a.rapier.melee.01.white"]], [/scimitar|cutlass|falchion|saber|katana|scythe/i, ["jb2a.scimitar.melee.01.white", "jb2a.falchion.melee.01.white"]],
      [/./, ["jb2a.sword.melee.01.white", "jb2a.greatsword.melee.standard.white"]]],
    ranged: [[/chakram/i, ["jb2a.chakram.01.throw.01", "jb2a.dagger.throw.01.white"]], [/axe|hatchet/i, ["jb2a.handaxe.throw.01", "jb2a.dagger.throw.01.white"]], [/./, ["jb2a.dagger.throw.01.white"]]] },
  bow: { label: "Bow", melee: [[/./, SLASH]], ranged: [[/crossbow|arbalest/i, BOLT], [/sling/i, ["jb2a.slingshot", "jb2a.bullet.01.orange"]], [/./, ARROW]] },
  firearm: { label: "Firearm", muzzle: ["jb2a.muzzle_flash.single.01.yellow"], melee: [[/./, ["jb2a.sword.melee.01.white"]]], ranged: [[/./, ["jb2a.bullet.01.orange"]]] },
  magic: { label: "Magic", melee: [[/./, ["jb2a.quarterstaff.melee.01.white"]]], ranged: [] },
  hammer: { label: "Hammer",
    melee: [[/mace/i, ["jb2a.mace.melee.01.white"]], [/maul/i, ["jb2a.maul.melee.standard.white"]], [/club|baton|shillelagh|knuckle|gauntlet/i, ["jb2a.greatclub.standard.white", "jb2a.unarmed_strike.physical.01.blue"]],
      [/./, ["jb2a.hammer.melee.01.white"]]],
    ranged: [[/./, ["jb2a.hammer.throw", "jb2a.bullet.01.orange"]]] },
  spear: { label: "Spear",
    melee: [[/halberd|polearm|corbin|pike/i, ["jb2a.halberd.melee.01.white", "jb2a.spear.melee.01.white"]], [/glaive/i, ["jb2a.glaive.melee.01.white"]], [/./, ["jb2a.spear.melee.01.white"]]],
    ranged: [[/./, ["jb2a.javelin.01.throw", "jb2a.spear.throw.01", "jb2a.arrow.physical.white.01"]]] },
  shield: { label: "Shield", melee: [[/./, ["jb2a.melee_generic.bludgeoning.one_handed", "jb2a.unarmed_strike.physical.01.blue"]]], ranged: [[/./, ["jb2a.bullet.01.orange"]]] },
  generic: { label: "Other", melee: [[NATURAL_ATTACK.claws, CLAWS], [NATURAL_ATTACK.bite, BITE], [NATURAL_ATTACK.unarmed, UNARMED], [/./, GENERIC_SLASH]], ranged: [[/./, ARROW]] },
});
const pick = (rules, name) => rules.find(([pattern]) => pattern.test(String(name ?? "")))?.[1] ?? null;
export function weaponStyle({ name, range, damageTypes, generic = false, family: given = null } = {}) {
  // A fallback ("Any claw attack") is not a compendium weapon: its name picks the strike, inside the
  // family it is a fallback for ("Any mace attack") or none.
  const family = given ?? (generic ? null : weaponFamily(name, damageTypes)), magical = dhDamageKind(damageTypes) === "magical";
  const style = WEAPON_STYLES[family] ?? WEAPON_STYLES.generic, melee = MELEE_RANGES.has(range);
  const strike = pick(melee ? style.melee : style.ranged, name) ?? (magical ? MISSILE.magical : MISSILE.physical);
  const blunt = ["hammer", "shield"].includes(family) || [UNARMED[0]].includes(strike[0]);
  return { family, label: style.label, melee, magical, strike: [...strike], hit: [...(magical ? MAGICAL_HIT : blunt ? BLUNT_HIT : PHYSICAL_HIT)], onTarget: ON_TARGET.has(strike[0]),
    muzzle: !melee && style.muzzle ? [...style.muzzle] : null,
    cast: !melee && family === "magic" ? (magical ? ["jb2a.cast_generic.01.dark_purple", "jb2a.cast_generic.02.blue"] : ["jb2a.cast_generic.01.yellow"]) : null };
}
export function weaponStages(weapon) {
  const s = weaponStyle(weapon);
  if (s.melee) return [
    // JB2A melee clips carry a stretch template (wielder to target); claws and bites are drawn small in a large frame.
    { stageId: "swing", kind: s.onTarget ? "impact" : "travel", assets: s.strike, duration: 1400, scale: s.strike[0] === BITE[0] ? 2.4 : s.onTarget ? 1.1 : 1 },
    { stageId: "hit-contact", kind: "impact", assets: s.hit, delay: 550, duration: 900, scale: 0.9 }];
  const lead = s.muzzle ?? s.cast;
  return [
    ...(lead ? [{ stageId: s.muzzle ? "flash" : "cast", kind: "cast", assets: lead, duration: s.muzzle ? 500 : 700, scale: 0.6, ...(s.muzzle ? { faceTarget: true } : {}) }] : []),
    { stageId: "shot", kind: "travel", assets: s.strike, delay: lead ? 150 : 0, duration: 900, scale: 0.8 },
    { stageId: "hit-accent", kind: "impact", assets: s.hit, delay: lead ? 1000 : 850, duration: 900, scale: 0.9 }];
}

// Adversary features used without an attack roll (daggerheart.mjs featureFields): one fallback per
// element, a variant per shape. A breath fills a cone or line to each target, a burst erupts around
// the adversary, a strike lands on the targets. An element with no breath asset bursts instead.
// A `bolt` is the element's attack roll at range (Spit Acid, Fire Bolt): elements without one have no
// attack variant, their rolls take the weapon fallbacks.
export const AREA_LOOKS = Object.freeze({
  cold: { label: "Cold", color: "#9fd8ff", cast: ["jb2a.cast_generic.ice.01.blue", "jb2a.cast_generic.water.02.blue"],
    breath: ["jb2a.breath_weapons02.burst.cone.ice.01", "jb2a.breath_weapons.cold.cone.blue"], burst: ["jb2a.ice_spikes.radial.burst.white"],
    hit: ["jb2a.impact.ground_crack.frost.01.white", "jb2a.impact.frost.white.01"], bolt: ["jb2a.ray_of_frost.blue", "jb2a.magic_missile.blue"] },
  fire: { label: "Fire", color: "#ff7a2f", cast: ["jb2a.cast_generic.fire.01.orange"], breath: ["jb2a.breath_weapons.fire.cone.orange.01"],
    burst: ["jb2a.fire_ring.500px.red", "jb2a.explosion.01.orange"], hit: ["jb2a.impact.fire.01.orange"], bolt: ["jb2a.fire_bolt.orange", "jb2a.magic_missile.orange"] },
  lightning: { label: "Lightning", color: "#7fb8ff", cast: ["jb2a.static_electricity.02.blue"], breath: ["jb2a.breath_weapons.lightning.line.blue"],
    burst: ["jb2a.thunderwave.center.blue"], hit: ["jb2a.static_electricity.01.blue"], bolt: ["jb2a.lightning_bolt.narrow.blue", "jb2a.witch_bolt.blue", "jb2a.magic_missile.blue"] },
  acid: { label: "Acid", color: "#9be060", cast: ["jb2a.smoke.puff.side.green", "jb2a.smoke.puff.side.grey"], breath: ["jb2a.breath_weapons.acid.line.green"],
    burst: ["jb2a.explosion.04.green", "jb2a.explosion.top_fracture.flask.01"], hit: ["jb2a.liquid.splash.green", "jb2a.liquid.splash.blue"],
    bolt: ["jb2a.magic_missile.green", "jb2a.magic_missile.purple"] },
  poison: { label: "Poison", color: "#7fbf5a", cast: ["jb2a.smoke.puff.side.dark_green", "jb2a.smoke.puff.side.grey"], breath: ["jb2a.breath_weapons.poison.cone.green"],
    burst: ["jb2a.fumes.04.complete.green", "jb2a.fumes.04.complete.grey"], hit: ["jb2a.smoke.puff.centered.green", "jb2a.smoke.puff.centered.grey"],
    bolt: ["jb2a.eldritch_blast.green", "jb2a.magic_missile.green", "jb2a.magic_missile.purple"] },
  arcane: { label: "Magic", color: "#a070ff", cast: ["jb2a.cast_generic.01.dark_purple", "jb2a.cast_generic.02.blue"],
    breath: ["jb2a.breath_weapons02.burst.cone.arcana.purple.01", "jb2a.magic_missile.purple"], burst: ["jb2a.explosion.04.dark_purple", "jb2a.explosion.04.blue"], hit: MAGICAL_HIT,
    bolt: ["jb2a.eldritch_blast.purple", "jb2a.magic_missile.purple"] },
  physical: { label: "Physical", color: "#c9a36b", cast: ["jb2a.smoke.puff.side.grey"], breath: null, burst: ["jb2a.impact.ground_crack.01.orange"], hit: PHYSICAL_HIT, bolt: null },
});
// An element's attack roll: a bolt from the adversary at range, a charged touch in melee (Chill Touch).
export const ATTACK_MODES = Object.freeze(["ranged", "melee"]);
export function elementAttackStages(element, mode) {
  const look = AREA_LOOKS[element] ?? AREA_LOOKS.arcane;
  if (mode === "melee") return [
    { stageId: "charge", kind: "cast", assets: [...look.cast], duration: 700, scale: 0.5, opacity: 0.85 },
    { stageId: "hit-contact", kind: "impact", assets: [...look.hit], delay: 300, duration: 1000, scale: 0.9 }];
  return [
    { stageId: "cast", kind: "cast", assets: [...look.cast], duration: 800, scale: 0.6 },
    { stageId: "bolt", kind: "travel", assets: [...(look.bolt ?? AREA_LOOKS.arcane.bolt)], delay: 300, duration: 1000, scale: 1 },
    { stageId: "hit-accent", kind: "impact", assets: [...look.hit], delay: 1100, duration: 1000, scale: 0.9 }];
}
export const FEATURE_SHAPES = Object.freeze(["breath", "burst", "strike"]);
export function featureStages(element, shape) {
  const look = AREA_LOOKS[element] ?? AREA_LOOKS.physical;
  if (shape === "breath" && look.breath) return [
    { stageId: "maw", kind: "cast", assets: [...look.cast], duration: 900, scale: 0.55 },
    { stageId: "breath", kind: "travel", assets: [...look.breath], delay: 400, duration: 2000, scale: 1, optionalTargets: true, oneShot: true },
    { stageId: "hit", kind: "impact", assets: [...look.hit], delay: 1300, duration: 1000, scale: 0.8, optionalTargets: true }];
  if (shape === "strike") return [
    { stageId: "cast", kind: "cast", assets: [...look.cast], duration: 700, scale: 0.5, opacity: 0.85 },
    { stageId: "hit", kind: "impact", assets: [...look.hit], delay: 300, duration: 1000, scale: 0.9, optionalTargets: true }];
  return [
    { stageId: "burst", kind: "cast", assets: [...look.burst], duration: 2000, scale: 1.6, below: true },
    { stageId: "hit", kind: "impact", assets: [...look.hit], delay: 700, duration: 1000, scale: 0.8, optionalTargets: true }];
}

// Conditions (CONFIG.DH.GENERAL): lasting layers through the persistent states, Death move a short
// moment, the defeated set the Defeated look setting (defeated-look.mjs).
export const DH_CONDITIONS = Object.freeze([
  { statusId: "vulnerable", name: "Vulnerable", group: "Lasting", lasting: true, color: "#d0485a", img: "icons/magic/control/silhouette-fall-slip-prone.webp",
    description: "A cracked, red-tinted shimmer while the creature is Vulnerable.",
    stages: [{ stageId: "cracks", kind: "aura", assets: ["jb2a.markers.shield_cracked.dark_red.01", "jb2a.markers.shield_cracked.purple.01"], scale: 0.9, opacity: 0.75, tintEnabled: true, tint: "#d0485a" },
      { stageId: "shimmer", kind: "aura", assets: ["jb2a.energy_strands.overlay.dark_red.01", "jb2a.markers.shield_cracked.purple.02"], scale: 0.85, opacity: 0.45 }] },
  { statusId: "hidden", name: "Hidden", group: "Lasting", lasting: true, color: "#9aa0a6", img: "icons/magic/perception/silhouette-stealth-shadow.webp",
    description: "A smoky fade; only the creature's owners and the GM see it.",
    stages: [{ stageId: "smoke", kind: "aura", assets: ["jb2a.smoke.plumes_loop.01.grey", "jb2a.smoke.puff.centered.grey"], scale: 1, opacity: 0.55, below: true },
      { stageId: "veil", kind: "aura", assets: ["jb2a.energy_strands.overlay.blue.01", "jb2a.energy_strands.overlay.dark_purple.01", "jb2a.smoke.puff.centered.grey"], scale: 0.8, opacity: 0.3 }] },
  { statusId: "restrained", name: "Restrained", group: "Lasting", lasting: true, color: "#8c8f99", img: "icons/magic/control/debuff-chains-shackle-movement-red.webp",
    description: "Chains and vines hold the creature while it is Restrained.",
    stages: [{ stageId: "chains", kind: "aura", assets: ["jb2a.markers.chain.standard.loop.02.grey", "jb2a.markers.chain.standard.loop.02.red"], scale: 0.9, opacity: 0.9 },
      { stageId: "vines", kind: "aura", assets: ["jb2a.entangle.02.loop.02.green", "jb2a.entangle.green"], scale: 0.9, opacity: 0.5, below: true }] },
  { statusId: "deathMove", name: "Death move", group: "Moment", moment: true, color: "#6b6f78", img: null,
    description: "A short, dramatic toll when a character makes their death move.",
    stages: [{ stageId: "toll", kind: "cast", assets: ["jb2a.toll_the_dead.grey.skull_smoke", "jb2a.toll_the_dead.green.skull_smoke"], duration: 2200, scale: 1.1 },
      { stageId: "smoke", kind: "cast", assets: ["jb2a.smoke.puff.centered.grey"], delay: 900, duration: 1600, scale: 1 }],
    sound: "drain" },
  { statusId: "defeated", name: "Defeated", group: "Defeated", defeated: true, color: "#9aa0a6", img: null, description: "Follows the Defeated look setting." },
  { statusId: "unconscious", name: "Unconscious", group: "Defeated", defeated: true, color: "#9aa0a6", img: null, description: "Follows the Defeated look setting." },
  { statusId: "dead", name: "Dead", group: "Defeated", defeated: true, color: "#9aa0a6", img: null, description: "Follows the Defeated look setting." },
]);

const CARD_TYPES = { ability: "Ability", spell: "Spell", grimoire: "Grimoire" };
const GENERIC_WEAPONS = [
  { id: "generic-melee", name: "Any melee attack", img: "icons/svg/sword.svg", tier: 0, range: "melee", trait: null, damageTypes: ["physical"], burden: "", generic: true },
  { id: "generic-claws", name: "Any claw attack", img: "icons/svg/claw.svg", tier: 0, range: "melee", trait: null, damageTypes: ["physical"], burden: "", generic: true },
  { id: "generic-bite", name: "Any bite attack", img: "icons/svg/fangs.svg", tier: 0, range: "melee", trait: null, damageTypes: ["physical"], burden: "", generic: true },
  { id: "generic-unarmed", name: "Any unarmed attack", img: "icons/svg/fist.svg", tier: 0, range: "melee", trait: null, damageTypes: ["physical"], burden: "", generic: true },
  { id: "generic-ranged", name: "Any ranged attack", img: "icons/svg/target.svg", tier: 0, range: "far", trait: null, damageTypes: ["physical"], burden: "", generic: true },
];
// Fallbacks by family, for an attack the library does not know whose name names its weapon (an
// adversary's Greataxe, Daggers, Warclub, Recurved Bow): [id, name, family, range, damage]. The name
// picks the strike inside the family (WEAPON_STYLES); FAMILY_FALLBACKS picks the fallback by name.
const FAMILY_WEAPONS = [
  ["sword", "Any sword attack", "blade", "melee"], ["dagger", "Any dagger attack", "blade", "melee"], ["axe", "Any axe attack", "blade", "melee"],
  ["scythe", "Any scythe attack", "blade", "melee"], ["thrown-blade", "Any thrown blade attack", "blade", "far"],
  ["hammer", "Any hammer attack", "hammer", "melee"], ["mace", "Any mace attack", "hammer", "melee"], ["maul", "Any maul attack", "hammer", "melee"],
  ["club", "Any club attack", "hammer", "melee"], ["spear", "Any spear attack", "spear", "melee"], ["polearm", "Any halberd attack", "spear", "melee"],
  ["javelin", "Any javelin attack", "spear", "far"], ["bow", "Any bow attack", "bow", "far"], ["firearm", "Any firearm attack", "firearm", "far"],
  ["shield", "Any shield attack", "shield", "melee"], ["staff", "Any staff attack", "magic", "melee", "magical"], ["staff-ranged", "Any staff or wand attack", "magic", "far", "magical"],
].map(([id, name, family, range, damage = "physical"]) => ({ id: `generic-${id}`, name, img: "icons/svg/sword.svg", tier: 0, range, trait: null, damageTypes: [damage], burden: "", generic: true, family }));
const FAMILY_FALLBACKS = {
  blade: { melee: [[/dagger|knife|knives|razor|scalpel|anlace|shears/i, "dagger"], [/axe|hatchet|labrys|cleaver/i, "axe"], [/scythe|sickle|scimitar|cutlass|falchion|saber|katana/i, "scythe"], [/./, "sword"]],
    ranged: [[/./, "thrown-blade"]] },
  hammer: { melee: [[/mace/i, "mace"], [/maul|pestle|mallet/i, "maul"], [/club|baton|shillelagh|knuckle|gauntlet/i, "club"], [/./, "hammer"]], ranged: [] },
  spear: { melee: [[/halberd|polearm|glaive|pike|corbin/i, "polearm"], [/./, "spear"]], ranged: [[/./, "javelin"]] },
  bow: { melee: [], ranged: [[/./, "bow"]] }, firearm: { melee: [], ranged: [[/./, "firearm"]] }, shield: { melee: [[/./, "shield"]], ranged: [] },
  magic: { melee: [[/./, "staff"]], ranged: [[/./, "staff-ranged"]] },
};
const recipeFor = (entry, variantId, trigger, stages, extra = {}) => validateRecipe({
  id: `animater-${variantId}`, name: entry.name, description: "", category: "Daggerheart", color: entry.color, trigger,
  systemId: "daggerheart", itemUuid: entry.uuid ?? "", catalogEntry: entry.id, stages, ...extra,
});
// A designed card plays its record (its `use` record on the use variant when it has both); others
// keep the palette rules. A record's per-action designs (`actions`, keyed by the action's id) become
// recipes on the variant their action plays on, picked by the event's actionId (dhRecipe).
function cardEntry(card) {
  const palette = domainPalette(card.domain), domain = title(card.domain) || "Unknown", record = CARD_DESIGNS[card.id] ?? null;
  const entry = { id: `daggerheart-card-${card.id}`, systemId: "daggerheart", kind: "card", uuid: `Compendium.daggerheart.${DAGGERHEART_SOURCE.packs?.card ?? "domains"}.Item.${card.id}`,
    name: card.name, img: card.img, level: card.level, domain: card.domain, cardType: card.cardType, edition: domain, group: CARD_TYPES[card.cardType] ?? title(card.cardType),
    theme: domain, quality: record ? "signature" : "themed", color: palette.color, sourceURL: `${SOURCE_URL}/src/packs/domains`,
    descriptionText: `${domain} ${CARD_TYPES[card.cardType] ?? card.cardType} level ${card.level}${record ? ` · ${record.motif}` : ""}` };
  const variants = Object.entries(cardDesigns(card)).filter(([, design]) => design);
  entry.variants = variants.map(([trigger, design]) => {
    const id = `${entry.id}-${trigger}`;
    const part = record && (trigger === "use" && variants.length > 1 && record.use ? record.use : record);
    const stages = part ? designStages(part, { palette, level: card.level, levelScale }) : cardStages(design, palette, card.level);
    const own = (card.actions ?? []).filter((a) => a?.id && record?.actions?.[a.id] && (DH_ROLL_TYPES.has(a.roll) ? "attack" : "use") === trigger);
    const actions = own.length ? Object.fromEntries(own.map((a) => [a.id, recipeFor(entry, id, trigger, designStages(record.actions[a.id], { palette, level: card.level, levelScale }))])) : null;
    return { id, label: `${trigger === "attack" ? "spellcast roll" : "use"} · ${part ? part.shape : design}`, design: part ? part.shape : design, recipe: recipeFor(entry, id, trigger, stages),
      sound: cardSoundDesign(card, design, record?.motif),
      ...(actions ? { actions } : {}) };
  });
  return entry;
}
function weaponEntry(weapon) {
  const style = weaponStyle(weapon), mode = style.melee ? "melee" : "ranged";
  const entry = { id: `daggerheart-weapon-${weapon.id}`, systemId: "daggerheart", kind: "weapon",
    uuid: weapon.generic ? null : `Compendium.daggerheart.${DAGGERHEART_SOURCE.packs?.weapon ?? "weapons"}.Item.${weapon.id}`,
    name: weapon.name, img: weapon.img, level: Number(weapon.tier) || 0, tier: weapon.tier, range: weapon.range, damageTypes: [...(weapon.damageTypes ?? [])], family: style.family,
    generic: Boolean(weapon.generic), edition: weapon.generic ? "Fallback" : `Tier ${weapon.tier}`, group: style.label, theme: style.label, quality: "themed",
    color: style.magical ? "#a070ff" : "#c9a36b", sourceURL: `${SOURCE_URL}/src/packs/items/weapons`,
    descriptionText: `${weapon.range} ${weapon.trait ?? ""} ${(weapon.damageTypes ?? []).join(" ")} ${weapon.burden ?? ""}`.replace(/\s+/g, " ").trim() };
  const id = `${entry.id}-attack`;
  entry.variants = [{ id, label: `attack · ${mode}`, weaponMode: mode, recipe: recipeFor(entry, id, "attack", weaponMotion(style, weaponStages(weapon))), sound: weaponSoundDesign(style, weapon.name) }];
  return entry;
}
// Actions that only heal, gain Hope or Fear, or apply an effect (daggerheart.mjs utilityFields): a
// glow on the user, and on each target when it has some. Patreon keys first, then keys JB2A Free has.
export const UTILITY_LOOKS = Object.freeze({
  heal: { label: "Heal", color: "#6fe08a", self: ["jb2a.healing_generic.400px.green", "jb2a.healing_generic.200px.green"], target: ["jb2a.cure_wounds.400px.blue", "jb2a.healing_generic.200px.green"] },
  hope: { label: "Hope", color: "#f2c94c", self: ["jb2a.divine_smite.caster.yellowwhite", "jb2a.particle_burst.01.star.yellow", "jb2a.twinkling_stars.points07.orange"], target: ["jb2a.bless.200px.intro.yellow", "jb2a.particle_burst.01.star.yellow"] },
  fear: { label: "Fear", color: "#7a3fc9", self: ["jb2a.markers.fear.dark_purple.03", "jb2a.energy_strands.overlay.dark_purple.01", "jb2a.smoke.puff.centered.dark_purple"], target: ["jb2a.condition.curse.01.019.purple", "jb2a.smoke.puff.centered.dark_purple", "jb2a.condition.curse.01.019.red"] },
  boon: { label: "Effect", color: "#8fb8ff", self: ["jb2a.condition.boon.01.007.yellow", "jb2a.bless.200px.intro.yellow", "jb2a.particle_burst.01.star.yellow"], target: ["jb2a.condition.boon.01.007.green", "jb2a.particle_burst.01.star.yellow"] },
  // What changes the adversary or the scene (daggerheart.mjs CHANGE_LOOKS): a summoning circle and portal,
  // a tolling countdown, a transformation burst. `under` lies beneath the token.
  summon: { label: "Summon", color: "#9a6bff", under: ["jb2a.magic_signs.circle.02.conjuration.loop.purple", "jb2a.magic_signs.circle.02.conjuration", "jb2a.magic_signs.circle.01.conjuration"],
    self: ["jb2a.portals.vertical.vortex.purple", "jb2a.misty_step.01.purple", "jb2a.misty_step.01.blue"], target: ["jb2a.misty_step.01.purple", "jb2a.smoke.puff.centered.dark_purple", "jb2a.misty_step.01.blue"] },
  countdown: { label: "Countdown", color: "#c9a0ff", under: ["jb2a.magic_signs.circle.02.divination.complete.blue", "jb2a.magic_signs.circle.02.divination", "jb2a.magic_signs.circle.01.divination"],
    self: ["jb2a.toll_the_dead.purple.bell", "jb2a.toll_the_dead.grey.skull_smoke", "jb2a.toll_the_dead.green.bell"], target: ["jb2a.markers.fear.dark_purple.03", "jb2a.smoke.puff.centered.dark_purple"] },
  transform: { label: "Transform", color: "#d0485a", under: ["jb2a.magic_signs.circle.02.transmutation.loop.purple", "jb2a.magic_signs.circle.02.necromancy", "jb2a.magic_signs.circle.01.necromancy"],
    self: ["jb2a.explosion.04.dark_purple", "jb2a.explosion.04.blue"], target: ["jb2a.energy_strands.overlay.dark_red.01", "jb2a.smoke.puff.centered.dark_purple", "jb2a.energy_strands.overlay.blue.01"] },
  // A Stress or Hope loss with no blow (Terrifying, Scare Tactic); an Armor-only loss cracks the target's guard.
  dread: { label: "Dread", color: "#5b2a86", self: ["jb2a.markers.fear.dark_purple.03", "jb2a.smoke.puff.centered.dark_purple"], target: ["jb2a.condition.curse.01.019.purple", "jb2a.smoke.puff.centered.dark_purple", "jb2a.condition.curse.01.019.red"] },
  sunder: { label: "Sunder", color: "#d0485a", self: ["jb2a.smoke.puff.side.grey"], target: ["jb2a.markers.shield_cracked.dark_red.01", "jb2a.markers.shield_cracked.purple.01", "jb2a.impact.003.blue"] },
});
const UTILITY_TEXT = { boon: "applies an effect", heal: "heals", summon: "summons or calls reinforcements", countdown: "starts a countdown",
  transform: "transforms or evolves the adversary", dread: "makes targets mark Stress or lose Hope", sunder: "breaks the targets' Armor" };
export function utilityStages(look) {
  const l = UTILITY_LOOKS[look] ?? UTILITY_LOOKS.boon;
  return [
    ...(l.under ? [{ stageId: "circle", kind: "cast", assets: [...l.under], duration: 2400, scale: 1.4, below: true, opacity: 0.85 }] : []),
    { stageId: "self", kind: "cast", assets: [...l.self], ...(l.under ? { delay: 300 } : {}), duration: 1600, scale: 1.3 },
    { stageId: "target", kind: "impact", assets: [...l.target], delay: l.under ? 900 : 400, duration: 1400, scale: 1.2, optionalTargets: true }];
}
function utilityEntry(look) {
  const l = UTILITY_LOOKS[look];
  const entry = { id: `daggerheart-weapon-utility-${look}`, systemId: "daggerheart", kind: "weapon", uuid: null, name: `Any ability · ${l.label}`, img: "icons/svg/aura.svg",
    level: 0, tier: 0, range: null, damageTypes: [], family: null, generic: true, edition: "Fallback", group: "Ability", theme: "Ability",
    quality: "themed", color: l.color, sourceURL: `${SOURCE_URL}/src/packs`,
    descriptionText: `any feature, potion or item action that only ${UTILITY_TEXT[look] ?? `gains or spends ${l.label}`}` };
  const id = `${entry.id}-use`;
  entry.variants = [{ id, label: "use", recipe: recipeFor(entry, id, "use", utilityMotion(look, utilityStages(look))), sound: utilitySoundDesign(look) }];
  return entry;
}
function featureEntry(element) {
  const look = AREA_LOOKS[element];
  const entry = { id: `daggerheart-weapon-feature-${element}`, systemId: "daggerheart", kind: "weapon", uuid: null, name: `Any feature attack · ${look.label}`, img: "icons/svg/explosion.svg",
    level: 0, tier: 0, range: null, damageTypes: element === "physical" ? ["physical"] : ["magical"], family: null, element, generic: true, edition: "Fallback", group: "Feature", theme: "Feature",
    quality: "themed", color: look.color, sourceURL: `${SOURCE_URL}/src/packs/adversaries`,
    descriptionText: `adversary feature ${look.label.toLowerCase()} breath burst strike area save` };
  entry.variants = FEATURE_SHAPES.map((shape) => {
    const id = `${entry.id}-${shape}`;
    return { id, label: `use · ${shape}`, featureShape: shape, recipe: recipeFor(entry, id, "use", featureMotion(element, shape, featureStages(element, shape))), sound: featureSoundDesign(element, shape) };
  });
  if (look.bolt) for (const mode of ATTACK_MODES) {
    const id = `${entry.id}-attack-${mode}`, melee = mode === "melee";
    entry.variants.push({ id, label: `attack · ${mode}`, weaponMode: mode,
      recipe: recipeFor(entry, id, "attack", weaponMotion({ melee, family: "magic" }, elementAttackStages(element, mode))), sound: featureSoundDesign(element, melee ? "strike" : "bolt") });
  }
  return entry;
}
function conditionEntry(c) {
  const entry = { id: `daggerheart-condition-${c.statusId}`, systemId: "daggerheart", kind: "condition", uuid: null, statusId: c.statusId, name: c.name, img: c.img,
    level: 0, edition: "Condition", group: c.group, theme: c.group, quality: "themed", color: c.color,
    state: { lasting: Boolean(c.lasting), moment: Boolean(c.moment), defeated: Boolean(c.defeated) }, sourceURL: SOURCE_URL, descriptionText: c.description };
  const id = `${entry.id}-effect`;
  const recipe = c.defeated
    ? validateRecipe({ ...clone(DEFEATED_RECIPE), id: `animater-${id}`, name: c.name, description: "", systemId: "daggerheart", catalogEntry: entry.id, stateEntry: entry.id })
    : recipeFor(entry, id, "effect", c.stages, c.lasting ? { lifecycle: "document", stateEntry: entry.id } : {});
  entry.variants = [{ id, label: c.lasting ? "while the condition lasts" : c.moment ? "when it is applied" : "follows the Defeated look setting", recipe, ...(c.sound ? { sound: { namespace: "spell", profile: c.sound } } : {}) }];
  return entry;
}

const DH_ENTRIES = [...DAGGERHEART_CARDS.map(cardEntry), ...DAGGERHEART_WEAPONS.map(weaponEntry), ...GENERIC_WEAPONS.map(weaponEntry), ...FAMILY_WEAPONS.map(weaponEntry), ...Object.keys(AREA_LOOKS).map(featureEntry), ...Object.keys(UTILITY_LOOKS).map(utilityEntry), ...DH_CONDITIONS.map(conditionEntry)];
const byId = new Map(DH_ENTRIES.map((e) => [e.id, e]));
const byUuid = new Map(DH_ENTRIES.filter((e) => e.uuid).map((e) => [e.uuid, e]));
export const dhEntries = (kind) => (kind ? DH_ENTRIES.filter((e) => e.kind === kind) : DH_ENTRIES);
export const dhEntry = (id) => byId.get(String(id).replace(/^animater-/, "")) ?? null;

export function normalizeDhCatalogState(state = {}) {
  state ??= {};
  const ids = (values) => [...new Set((Array.isArray(values) ? values : []).filter((id) => byId.has(id)))];
  return { enabled: state.enabled === true, independent: state.independent === true, preferCatalog: state.preferCatalog === true, scope: state.scope === "selected" ? "selected" : "all",
    selected: ids(state.selected), excluded: ids(state.excluded), customized: ids(state.customized), motion: state.motion !== false, fade: state.fade === true, turn: state.turn === true, sound: state.sound !== false,
    soundVolume: Number.isFinite(Number(state.soundVolume)) ? Math.max(0, Math.min(1, Number(state.soundVolume))) : 0.35,
    opacity: Number.isFinite(Number(state.opacity)) ? Math.max(0.1, Math.min(1, Number(state.opacity))) : 1 };
}
export const dhEntryEnabled = (id, state) => state?.enabled === true && !state.excluded?.includes(id) && (state.scope !== "selected" || state.selected?.includes(id) || state.customized?.includes(id));
export function useDhEntry(state, id) {
  if (!byId.has(id)) throw Error("Choose a Daggerheart catalog entry first.");
  state = normalizeDhCatalogState(state);
  return normalizeDhCatalogState({ ...state, enabled: true, independent: true, scope: state.enabled ? state.scope : "selected", selected: state.enabled ? [...state.selected, id] : [id],
    excluded: state.excluded.filter((v) => v !== id), customized: state.customized.filter((v) => v !== id) });
}
// `motion: false` drops any motion stage a variant has; `sounds` (an installed audio catalog, null
// when the Sounds switch is off) adds the variant's sound design (daggerheart-polish.mjs). `actionId`
// (the action that fired) picks that action's own design; without one, or for an action with none,
// the variant's card design plays (the library's Use and preview).
export function dhRecipe(entry, variantId, { motion = true, actionId = null, sounds = null, soundVolume = 0.35 } = {}) {
  if (!entry) throw Error("Choose a Daggerheart catalog entry first.");
  const variant = entry.variants.find((v) => v.id === variantId) ?? entry.variants[0];
  const recipe = clone((actionId && variant.actions?.[actionId]) || variant.recipe);
  if (!motion && recipe.stages.some((s) => s.kind !== "motion")) recipe.stages = recipe.stages.filter((s) => s.kind !== "motion");
  if (recipe.lifecycle !== "document") recipe.stages = withDhSounds(entry, variant, recipe.stages, { sounds, soundVolume });
  // Lasting conditions (Hidden, Restrained) show a quiet Tokenshade look when it is available.
  return withConditionLook(withCatalogTeleport(validateRecipe(recipe), entry), entry);
}
// A feature fallback plays the variant of the event's shape, its attack roll the variant of its range.
export function dhVariantForEvent(entry, event) {
  const variants = entry?.variants?.filter((v) => v.recipe.trigger === event?.type) ?? [];
  return variants.find((v) => v.featureShape && v.featureShape === event?.featureShape)
    ?? (variants.length > 1 ? variants.find((v) => v.weaponMode === (event?.weaponMode === "ranged" ? "ranged" : "melee")) : null) ?? variants[0] ?? null;
}

// The entry for an event's item: by name, then by the compendium it came from. A weapon attack the
// library does not know (homebrew, or an adversary's standard attack with no Item) gets the melee or
// ranged fallback; a condition effect is found by its status. An adversary feature's attack roll gets
// the same fallback, its unrolled strike (a breath, a save, damage) the fallback of its element.
// An attack the library does not know is told by its name: in melee "Bite and Claws" rakes, "Bite"
// bites, "Tail Swipe" or "Fists" strike unarmed; a weapon it names strikes as its family (a Greataxe
// cleaves, a Recurved Bow shoots, a Rune-Covered Rod casts). Without one, magic damage strikes as the
// element the name names (Fire Bolt, Chill Touch) or as magic (Psychic Strike); anything else slashes
// or flies as an arrow.
const elementAttack = (element) => (AREA_LOOKS[element]?.bolt ? dhEntry(`daggerheart-weapon-feature-${element}`) : null);
function genericWeapon(event) {
  const ranged = event?.weaponMode === "ranged", name = String(event?.itemName ?? event?.item?.name ?? "");
  const natural = ranged ? null : Object.entries(NATURAL_ATTACK).find(([, pattern]) => pattern.test(name))?.[0];
  if (natural) return dhEntry(`daggerheart-weapon-generic-${natural}`);
  const family = pick(FAMILY_FALLBACKS[weaponFamily(name)]?.[ranged ? "ranged" : "melee"] ?? [], name);
  if (family) return dhEntry(`daggerheart-weapon-generic-${family}`);
  if (event?.damageKind === "magical") return elementAttack(featureElement([name], ["magical"]));
  return dhEntry(`daggerheart-weapon-generic-${ranged ? "ranged" : "melee"}`);
}
const utilityEntryFor = (event) => (event?.type === "use" && event?.utilityLook ? dhEntry(`daggerheart-weapon-utility-${event.utilityLook}`) : null);
export function findDhEntry(event) {
  const item = event?.item ?? null;
  if (event?.type === "effect") {
    const statuses = new Set(Array.from(item?.statuses ?? []));
    return dhEntries("condition").find((e) => statuses.has(e.statusId)) ?? null;
  }
  if (item?.type === "feature") {
    // A feature's attack roll strikes as its element (Spit Acid, Venomous Bite), a physical one as a weapon.
    if (event?.type === "attack" && DH_ROLL_TYPES.has(event?.rollType)) return (["physical", "arcane"].includes(event?.featureElement) ? null : elementAttack(event?.featureElement)) ?? genericWeapon(event);
    return event?.type === "use" && event?.featureElement ? dhEntry(`daggerheart-weapon-feature-${event.featureElement}`) : utilityEntryFor(event);
  }
  const kind = item?.type === "domainCard" ? "card" : item?.type === "weapon" || (!item && event?.type === "attack" && event?.rollType === "attack") ? "weapon" : null;
  if (!kind) return utilityEntryFor(event);
  const name = normalize(item?.name ?? event?.itemName);
  const byName = name ? dhEntries(kind).find((e) => e.uuid && normalize(e.name) === name) : null;
  if (byName) return byName;
  for (const uuid of [item?._stats?.compendiumSource, item?.flags?.core?.sourceId]) { const hit = uuid ? byUuid.get(uuid) : null; if (hit) return hit; }
  return kind === "weapon" ? genericWeapon(event) : null;
}

// Plays like the D&D catalog: your recipes that match by name win unless you picked the catalog's;
// lasting conditions and the defeated set belong to the persistent layers, not to dispatch.
export function resolveDaggerheartAutomaticRecipe(event, stateFor, saved = [], { customEnabled = true, sounds = null } = {}) {
  const entry = findDhEntry(event), state = normalizeDhCatalogState(entry && stateFor(entry.kind));
  const custom = customEnabled || (entry && dhEntryEnabled(entry.id, state) && state.customized.includes(entry.id)) ? saved : [];
  const selected = entry && dhEntryEnabled(entry.id, state), prefer = selected && (state.selected.includes(entry.id) || (state.preferCatalog && !state.customized.includes(entry.id) && !ownRecipe(custom, event)));
  const override = matchStrikeOverride(custom, event);
  if (override) return override;
  if (!prefer) { const match = matchRecipe(custom, event); if (match) return match; }
  if (!selected || entry.state?.lasting || entry.state?.defeated) return null;
  if (!prefer && custom.some((r) => !r.enabled && matchRecipe([{ ...r, enabled: true }], event))) return null;
  const variant = dhVariantForEvent(entry, event);
  return variant ? dhRecipe(entry, variant.id, { motion: state.motion, actionId: event?.actionId ?? null, sounds: state.sound ? sounds : null, soundVolume: state.soundVolume }) : null;
}

export function filterDhEntries(kind, { search = "", level = "all", theme = "all" } = {}) {
  const query = normalize(search);
  const score = (e) => (normalize(e.name) === query ? 3 : normalize(e.name).startsWith(query) ? 2 : normalize(e.name).includes(query) ? 1 : 0);
  return dhEntries(kind).filter((e) => (level === "all" || e.level === Number(level)) && (theme === "all" || e.theme === theme)
    && (!query || normalize(`${e.name} ${e.descriptionText ?? ""} ${e.group ?? ""}`).includes(query))).sort((a, b) => (query ? score(b) - score(a) : 0));
}

// The shared catalog page (dnd5e-catalog-ui.mjs) for Daggerheart: domain cards on the spells page
// with domain chips, weapons, conditions.
const DOMAIN_CHIPS = Object.keys(DOMAIN_PALETTES).map((d) => [title(d), title(d)]);
export const dhCatalogProfile = {
  systemId: "daggerheart", label: "Daggerheart", source: DAGGERHEART_SOURCE, entries: dhEntries, entry: dhEntry, recipe: dhRecipe, filter: filterDhEntries,
  normalize: normalizeDhCatalogState, enabled: dhEntryEnabled, use: useDhEntry, stateKey: "dhCatalogState", setStateKey: "setDhCatalogState",
  kinds: { spells: "card", weapons: "weapon", conditions: "condition" },
  labels: { card: "domain cards", weapon: "weapons", condition: "conditions" },
  levelKind: "card", levelLabel: "Level", levels: Array.from({ length: 10 }, (_, i) => i + 1),
  themeLabel: (kind) => (kind === "card" ? "Domain" : kind === "weapon" ? "Weapon family" : "Kind"),
  chips: (kind) => (kind === "card" ? DOMAIN_CHIPS : null),
  // Defeated, Unconscious and Dead play only through the Defeated look setting, so the page offers no Use there.
  governedBy: (entry) => (entry?.state?.defeated ? "Follows the Defeated look setting (Configure Settings → Animater → Defeated look). Use, Customize and Exclude do not apply." : null),
  intro: "Native Daggerheart compendium content. Designed cards animate what their text does; the rest follow their domain and kind. Weapons follow their family and range.",
  hint: "Native system compendiums.",
};
