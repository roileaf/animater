// Draw Steel ability designs: what an ability plays, from the facts of its row (draw-steel.mjs
// abilityRow / abilityLook) and the class it belongs to. Five layers make two abilities differ:
//   1. the look: its element (damage type, else the keyword naming its power) in its shape (a strike,
//      a burst or aura, a placed cube or wall, a line, or a self/ally boon or heal);
//   2. the class's style: its weapons (a Fury's axe or maul, a Shadow's daggers, a Null's fists), its
//      accent on an untyped blow (a Censor's holy light, a Shadow's smoke), its boons;
//   3. the ability's own name (a Charge rushes, a Leap jumps, a Whirlwind spins, a Song rings out);
//   4. what it does to its targets: forced movement (pushed back, dragged in, slid aside — the look
//      only, the table moves the creature) and the conditions it applies;
//   5. how big it is: a free strike is quick, a heroic ability grows with its cost.
// Body accents play through Tokenshade where it is installed (a struck creature burns, frosts, rings,
// glows); without it those stages are dropped at play time. Pure: no Foundry globals.
import { AREA_LOOKS, NATURAL_ATTACK, weaponStages, weaponStyle } from "../daggerheart/daggerheart-catalog.mjs";
import { weaponSoundDesign, weaponMotion, featureMotion } from "../daggerheart/daggerheart-polish.mjs";
import { weaponFamily } from "../../systems/daggerheart.mjs";

const round = (n) => Math.round(n * 100) / 100;
// A stable pick from a list by name, so an ability always plays the same alternate.
export function pickBy(name, items) {
  let h = 0;
  for (const c of String(name ?? "")) h = (h * 31 + c.codePointAt(0)) >>> 0;
  return items[h % items.length];
}

// Element looks: a cast at the user, a bolt to a ranged target, a hit on each target, a burst around
// the user (or placed for a cube or wall) and a breath along a line. Patreon keys first; every list
// ends with a key JB2A Free has (tests/catalogs/draw-steel resolves every slot in both editions).
const PURPLE_HIT = ["jb2a.impact.004.dark_purple", "jb2a.impact.005.purple", "jb2a.particle_burst.01.rune.bluepurple"];
export const DS_LOOKS = Object.freeze({
  fire: AREA_LOOKS.fire, cold: AREA_LOOKS.cold, lightning: AREA_LOOKS.lightning, acid: AREA_LOOKS.acid, poison: AREA_LOOKS.poison,
  arcane: AREA_LOOKS.arcane, physical: AREA_LOOKS.physical,
  corruption: { label: "Corruption", color: "#6b4a8f", cast: ["jb2a.cast_generic.02.dark_purple", "jb2a.cast_generic.02.blue"],
    bolt: ["jb2a.eldritch_blast.dark_purple", "jb2a.eldritch_blast.purple"], hit: PURPLE_HIT,
    burst: ["jb2a.arms_of_hadar.dark_purple"], breath: ["jb2a.breath_weapons.acid.line.purple", "jb2a.eldritch_blast.purple"] },
  holy: { label: "Holy", color: "#ffe9a3", cast: ["jb2a.sacred_flame.source.yellow"], bolt: ["jb2a.guiding_bolt.01.yellow", "jb2a.guiding_bolt.01.blueyellow"],
    hit: ["jb2a.sacred_flame.target.yellow"], burst: ["jb2a.divine_smite.target.yellowwhite", "jb2a.divine_smite.target.blueyellow"],
    breath: ["jb2a.guiding_bolt.02.yellow", "jb2a.guiding_bolt.01.blueyellow"] },
  psychic: { label: "Psychic", color: "#b07cff", cast: ["jb2a.cast_generic.01.dark_purple", "jb2a.cast_generic.02.blue"], bolt: ["jb2a.magic_missile.purple"],
    hit: ["jb2a.impact.009.purple", "jb2a.particle_burst.01.rune.bluepurple"], burst: ["jb2a.soundwave.01.purple", "jb2a.soundwave.02.blue"],
    breath: ["jb2a.energy_beam.normal.bluepink.02"] },
  sonic: { label: "Sonic", color: "#c8d0e0", cast: ["jb2a.soundwave.01.blue"], bolt: ["jb2a.energy_beam.normal.blue.01"],
    hit: ["jb2a.soundwave.01.blue"], burst: ["jb2a.thunderwave.center.blue"], breath: ["jb2a.energy_beam.normal.blue.01"] },
  earth: { label: "Earth", color: "#b0794a", cast: ["jb2a.cast_generic.earth.01.browngreen"], bolt: ["jb2a.boulder.toss.02.01.stone.brown"],
    hit: ["jb2a.impact.boulder.01", "jb2a.impact.ground_crack.01.orange"], burst: ["jb2a.impact.ground_crack.02.orange", "jb2a.ground_cracks.01.orange"],
    breath: ["jb2a.boulder.toss.02.01.stone.brown"] },
  void: { label: "Void", color: "#3a2a5a", cast: ["jb2a.cast_generic.02.dark_purple", "jb2a.cast_generic.02.blue"], bolt: ["jb2a.eldritch_blast.dark_purple", "jb2a.eldritch_blast.purple"],
    hit: ["jb2a.smoke.puff.centered.dark_purple", "jb2a.smoke.puff.centered.grey"], burst: ["jb2a.darkness.black"], breath: ["jb2a.eldritch_blast.dark_purple", "jb2a.eldritch_blast.purple"] },
  nature: { label: "Nature", color: "#5fae5a", cast: ["jb2a.cast_generic.earth.01.browngreen"], bolt: ["jb2a.swirling_leaves.ranged.greenorange"],
    hit: ["jb2a.swirling_leaves.outburst.01.greenorange", "jb2a.swirling_leaves.outburst.01.pink"], burst: ["jb2a.entangle.green"],
    breath: ["jb2a.swirling_leaves.ranged.greenorange"] },
  time: { label: "Time", color: "#8fb8ff", cast: ["jb2a.magic_signs.circle.02.divination.complete.blue"], bolt: ["jb2a.magic_missile.blue", "jb2a.ray_of_frost.blue"],
    hit: ["jb2a.impact.004.blue", "jb2a.impact.003.blue"], burst: ["jb2a.magic_signs.circle.02.divination.complete.blue"], breath: ["jb2a.magic_missile.blue", "jb2a.ray_of_frost.blue"] },
  force: { label: "Force", color: "#b58cff", cast: ["jb2a.cast_generic.02.blue"], bolt: ["jb2a.magic_missile.purple"],
    hit: ["jb2a.impact.005.purple", "jb2a.impact.004.dark_purple", "jb2a.particle_burst.01.rune.bluepurple"], burst: ["jb2a.explosion.04.dark_purple", "jb2a.explosion.04.blue"],
    breath: ["jb2a.energy_beam.normal.bluepink.02"] },
});
export const dsLook = (element) => DS_LOOKS[element] ?? DS_LOOKS.arcane;

// Tokenshade's look on a struck body, per element (the damage looks of damage-moments.mjs, plus the
// condition looks that fit time, nature and earth). Physical and plain magic leave the body as it is.
export const BODY_ACCENTS = Object.freeze({
  fire: "Burning", cold: "Frostbitten", lightning: "Electrocuted", acid: "Corroding", poison: "Envenomed", corruption: "Withering",
  void: "Withering", holy: "Radiant Burn", psychic: "Psychic Warp", sonic: "Resonance", force: "Force Jolt", time: "Sluggish",
  nature: "Rooted", earth: "Mud-Caked",
});
const fx = (stageId, label, preset, subject, delay, duration, { tint = "", strength } = {}) => ({
  kind: "tokenfx", stageId, label: `Tokenshade · ${label}`, assets: [], catalogFx: true, fxProfile: "drawSteel", fxPreset: preset, fxLibrary: "tokenshade", fxTint: tint,
  ...(strength ? { fxStrength: strength } : {}), subject, delay, duration, optionalTargets: subject === "targets", ...(subject === "targets" ? { targetSelection: "all" } : {}) });
const move = (stageId, label, motion, subject, delay, duration, intensity, distance, extra = {}) =>
  ({ kind: "motion", stageId, label, assets: [], motion, subject, delay, duration, intensity, distance, targetSelection: subject === "targets" ? "all" : "first", ...extra });

// Class styles. Weapons are names the shared weapon styles know (a Greataxe cleaves, a Maul hammers,
// a Rapier thrusts); `accent` is the element an untyped blow lands in; `boon` and `glow` are its
// self and ally abilities. Every list ends with a key JB2A Free has.
export const CLASS_STYLES = Object.freeze({
  Censor: { color: "#f2c94c", melee: ["Longsword", "Mace", "Warhammer"], ranged: ["Longbow"], accent: "holy", glow: "#f2c94c",
    boon: { self: ["jb2a.divine_smite.caster.yellowwhite", "jb2a.divine_smite.caster.blueyellow"], target: ["jb2a.bless.200px.intro.yellow"] }, sound: "holy" },
  Conduit: { color: "#ffe08a", melee: ["Mace", "Hammer", "Quarterstaff"], ranged: ["Sling"], accent: "holy", glow: "#ffe08a",
    boon: { self: ["jb2a.bless.400px.intro.yellow"], target: ["jb2a.healing_generic.200px.yellow", "jb2a.bless.200px.intro.yellow"] }, sound: "bless" },
  Elementalist: { color: "#ff9a3d", melee: ["Quarterstaff"], ranged: [], accent: null, glow: "#ff9a3d",
    boon: { self: ["jb2a.energy_strands.overlay.purple.01", "jb2a.energy_strands.02.marker.bluepurple"], target: ["jb2a.particle_burst.01.rune.bluepurple"] }, sound: "force" },
  Fury: { color: "#d0485a", melee: ["Greataxe", "Maul", "Greatsword"], ranged: ["Throwing Axe"], accent: null, glow: "#d0485a", natural: true,
    boon: { self: ["jb2a.energy_strands.overlay.dark_red.01", "jb2a.smoke.puff.centered.grey"], target: ["jb2a.markers.fear.dark_purple.03", "jb2a.markers.fear.dark_purple.01"] }, sound: "battleCry" },
  Null: { color: "#8fb8ff", melee: ["Fist", "Palm Strike", "Kick"], ranged: [], accent: "psychic", glow: "#8fb8ff", unarmed: true,
    boon: { self: ["jb2a.markers.circle_of_stars.blue"], target: ["jb2a.markers.light.complete.blue"] }, sound: "psychic" },
  Shadow: { color: "#5b5f6e", melee: ["Dagger", "Shortsword", "Knife"], ranged: ["Throwing Knife", "Shortbow"], accent: "shadow", glow: "#7a7f8a",
    boon: { self: ["jb2a.misty_step.01.dark_black", "jb2a.misty_step.01.blue"], target: ["jb2a.smoke.puff.side.dark_black", "jb2a.smoke.puff.side.grey"] }, sound: "shadow" },
  Tactician: { color: "#c9a36b", melee: ["Longsword", "Spear", "Halberd"], ranged: ["Crossbow", "Longbow"], accent: null, glow: "#e8a33d",
    boon: { self: ["jb2a.markers.shield_rampart.complete.01.orange"], target: ["jb2a.markers.shield_rampart.complete.01.orange", "jb2a.markers.shield.green.01"] }, sound: "shield" },
  Talent: { color: "#b07cff", melee: ["Fist"], ranged: [], accent: "psychic", glow: "#b07cff",
    boon: { self: ["jb2a.markers.circle_of_stars.blue"], target: ["jb2a.particle_burst.01.rune.bluepurple"] }, sound: "psychic" },
  Troubadour: { color: "#ff9ec4", melee: ["Rapier", "Scimitar", "Dagger"], ranged: ["Shortbow", "Throwing Knife"], accent: null, glow: "#ff9ec4",
    boon: { self: ["jb2a.bardic_inspiration.purplepink", "jb2a.bardic_inspiration.greenorange"], target: ["jb2a.markers.music_note.blue.01"] }, sound: "song" },
});
const DEFAULT_STYLE = { color: "#c9a36b", melee: ["Longsword", "Spear", "Handaxe", "Mace"], ranged: ["Longbow", "Crossbow"], accent: null, glow: "#8fb8ff",
  boon: { self: ["jb2a.condition.boon.01.007.yellow", "jb2a.bless.200px.intro.yellow"], target: ["jb2a.condition.boon.01.007.green", "jb2a.particle_burst.01.star.yellow"] }, sound: "shield" };
export const classStyle = (group) => CLASS_STYLES[group] ?? DEFAULT_STYLE;
// Each class's other boons (an ability picks one by its name) and its own healing light.
const CLASS_BOONS = {
  Censor: { boons: [{ self: ["jb2a.bless.400px.intro.yellow"], target: ["jb2a.divine_smite.target.yellowwhite", "jb2a.divine_smite.target.blueyellow"] }],
    heal: { self: ["jb2a.healing_generic.400px.yellow", "jb2a.healing_generic.200px.yellow"], target: ["jb2a.cure_wounds.400px.yellow", "jb2a.healing_generic.200px.yellow"] } },
  Conduit: { boons: [{ self: ["jb2a.markers.light_orb.complete.yellow", "jb2a.markers.light_orb.complete.blue"], target: ["jb2a.bless.200px.intro.yellow"] },
    { self: ["jb2a.divine_smite.caster.yellowwhite", "jb2a.divine_smite.caster.blueyellow"], target: ["jb2a.markers.light.complete.blue"] }],
    heal: { self: ["jb2a.healing_generic.03.burst.yellow", "jb2a.healing_generic.200px.yellow"], target: ["jb2a.healing_generic.200px.yellow"] } },
  Elementalist: { boons: [{ self: ["jb2a.energy_strands.overlay.orange.01", "jb2a.energy_strands.overlay.blue.01"], target: ["jb2a.particle_burst.01.circle.yellow", "jb2a.particle_burst.01.rune.bluepurple"] }],
    heal: { self: ["jb2a.healing_generic.03.burst.green", "jb2a.healing_generic.200px.green"], target: ["jb2a.swirling_leaves.outburst.01.greenorange", "jb2a.swirling_leaves.outburst.01.pink"] } },
  Fury: { boons: [{ self: ["jb2a.divine_smite.caster.dark_red", "jb2a.divine_smite.caster.blueyellow"], target: ["jb2a.impact.010.red", "jb2a.impact.010.orange"] }],
    heal: { self: ["jb2a.healing_generic.200px.red", "jb2a.healing_generic.200px.green"], target: ["jb2a.cure_wounds.400px.red", "jb2a.cure_wounds.400px.blue"] } },
  Null: { boons: [{ self: ["jb2a.token_border.circle.spinning.blue.004"], target: ["jb2a.markers.light.complete.blue"] }],
    heal: { self: ["jb2a.healing_generic.400px.blue"], target: ["jb2a.cure_wounds.200px.blue"] } },
  Shadow: { boons: [{ self: ["jb2a.smoke.puff.centered.dark_black", "jb2a.smoke.puff.centered.grey"], target: ["jb2a.misty_step.01.dark_black", "jb2a.misty_step.01.blue"] }],
    heal: { self: ["jb2a.healing_generic.200px.purple"], target: ["jb2a.cure_wounds.400px.purple", "jb2a.cure_wounds.400px.blue"] } },
  Tactician: { boons: [{ self: ["jb2a.bless.400px.intro.blue", "jb2a.bless.400px.intro.yellow"], target: ["jb2a.markers.shield.green.01"] },
    { self: ["jb2a.markers.shield_rampart.complete.01.orange"], target: ["jb2a.hunters_mark.pulse.01.red", "jb2a.hunters_mark.pulse.01.green"] }],
    heal: { self: ["jb2a.healing_generic.03.burst.bluegreen"], target: ["jb2a.cure_wounds.400px.green", "jb2a.cure_wounds.400px.blue"] } },
  Talent: { boons: [{ self: ["jb2a.energy_strands.overlay.purple.01", "jb2a.energy_strands.overlay.blue.01"], target: ["jb2a.markers.light_orb.complete.blue"] }],
    heal: { self: ["jb2a.healing_generic.03.burst.bluepurple", "jb2a.healing_generic.200px.purple"], target: ["jb2a.cure_wounds.400px.purple", "jb2a.cure_wounds.400px.blue"] } },
  Troubadour: { boons: [{ self: ["jb2a.markers.music.blueyellow", "jb2a.markers.music.greenorange"], target: ["jb2a.markers.music_note.purple.01", "jb2a.markers.music_note.blue.01"] },
    { self: ["jb2a.bardic_inspiration.pink", "jb2a.bardic_inspiration.greenorange"], target: ["jb2a.markers.heart.pink.03"] },
    { self: ["jb2a.soundwave.01.purple", "jb2a.soundwave.02.blue"], target: ["jb2a.markers.music_note.dark_red.01", "jb2a.markers.music_note.blue.02"] }],
    heal: { self: ["jb2a.healing_generic.200px.purple"], target: ["jb2a.markers.heart.pink.03", "jb2a.cure_wounds.400px.pink", "jb2a.cure_wounds.400px.blue"] } },
};
// How a self or ally ability without a motif moves its user, picked by its name.
const SELF_GESTURES = [["pulse", "Draws on resolve", 0.6], ["levitate", "Rises with purpose", 0.4], ["brace", "Squares up", 0.5], ["spin", "Turns with a flourish", 0.35]];
// A Shadow's untyped blow lands in smoke (no element of its own).
const SHADOW_HIT = ["jb2a.smoke.puff.side.dark_black", "jb2a.smoke.puff.side.grey"];
const HEAL = { self: ["jb2a.healing_generic.400px.green", "jb2a.healing_generic.200px.green"], target: ["jb2a.cure_wounds.400px.blue", "jb2a.healing_generic.200px.green"] };

// Name motifs: the first that names the ability shapes how its user moves and what joins the look.
export const MOTIFS = Object.freeze([
  { id: "leap", pattern: /\b(?:leap|pounce|vault|spring|bound|jump|soar|dive)/i },
  { id: "charge", pattern: /\b(?:charge|rush|dash|sprint|lunge|tackle|stampede|onslaught|advance)/i },
  { id: "spin", pattern: /\b(?:spin|whirl|sweep|cleave|circle|around|tornado|cyclone|reap)/i },
  { id: "slam", pattern: /\b(?:slam|smash|crush|hammer|quake|stomp|shatter|break|pummel|bash|wreck)/i },
  { id: "flurry", pattern: /\b(?:flurry|barrage|volley|rain|hail|thousand|many|double|twin|two|triple|rapid|blur)/i },
  { id: "shadow", pattern: /\b(?:shadow|smoke|vanish|blink|fade|disappear|teleport|step)/i },
  { id: "song", pattern: /\b(?:song|ballad|verse|chorus|melod|tune|limerick|sonata|hymn|anthem|sing|serenade|lullaby|encore|harmony)/i },
  { id: "roar", pattern: /\b(?:roar|shout|cry|howl|bellow|thunder|scream|war\b|rally|command|order)/i },
  { id: "shield", pattern: /\b(?:shield|ward|guard|protect|defend|aegis|bulwark|parry|block|armor|sanctuary)/i },
  { id: "mark", pattern: /\b(?:mark|judg|hunt|target|pin|expose|brand|sentence|condemn)/i },
]);
export const motifOf = (name, keywords = []) => MOTIFS.find((m) => m.pattern.test(String(name ?? "")))?.id ?? (keywords.includes("charge") ? "charge" : null);

// What a hit does to its targets beyond the damage: forced movement and applied conditions.
const CONDITION_RIDERS = {
  dazed: { assets: ["jb2a.dizzy_stars.200px.blueorange"], motion: ["stagger", 0.6, 0.06] },
  frightened: { assets: ["jb2a.markers.fear.dark_purple.03", "jb2a.markers.fear.dark_purple.01"], motion: ["cower", 0.7, 0.05] },
  grabbed: { assets: ["jb2a.markers.chain.standard.complete.02.red"], motion: ["press", 0.5, 0.04] },
  prone: { assets: ["jb2a.impact.ground_crack.01.orange"], motion: ["squash", 0.8, 0.05], below: true },
  restrained: { assets: ["jb2a.entangle.02.complete.02.green", "jb2a.entangle.green"], motion: ["press", 0.6, 0.04], below: true },
  slowed: { assets: ["jb2a.energy_strands.overlay.blue.01", "jb2a.static_electricity.01.blue"], motion: ["sink", 0.3, 0.03] },
  bleeding: { assets: ["jb2a.liquid.splash.red", "jb2a.liquid.splash.blue"] },
  weakened: { assets: ["jb2a.markers.shield_cracked.dark_red.01", "jb2a.markers.shield_cracked.purple.01"] },
  taunted: { assets: ["jb2a.hunters_mark.pulse.01.red", "jb2a.hunters_mark.pulse.01.green"] },
  surprised: { assets: ["jb2a.particle_burst.01.star.yellow", "jb2a.twinkling_stars.points07.orange"] },
};
export function riderStages({ forced = null, conditions = [] } = {}, at = 900, scale = 1) {
  const stages = [];
  if (forced?.kind) {
    const n = Math.min(10, Math.max(1, Number(forced.squares) || 1));
    const [motion, label] = forced.kind === "pull" ? ["stagger", "Dragged in"] : forced.kind === "slide" ? ["dodge", "Slid aside"] : ["recoil", "Driven back"];
    stages.push(move("forced", `${label} (${forced.kind} ${n})`, motion, "targets", at + 60, 700 + n * 60, round(Math.min(1, 0.55 + n * 0.08)), round(Math.min(0.3, 0.06 + n * 0.025)), { optionalTargets: true }));
    if (forced.kind === "pull") stages.push({ stageId: "forced-chain", kind: "impact", assets: ["jb2a.markers.chain.standard.complete.02.red"], delay: at, duration: 900, scale: round(0.6 * scale), opacity: 0.8, optionalTargets: true });
    else stages.push({ stageId: "forced-dust", kind: "impact", assets: ["jb2a.smoke.puff.side.02.white", "jb2a.smoke.puff.side.grey"], delay: at + 120, duration: 900, scale: round(0.6 * scale), opacity: 0.7, optionalTargets: true, below: true });
  }
  for (const id of conditions.filter((c) => CONDITION_RIDERS[c]).slice(0, 2)) {
    const r = CONDITION_RIDERS[id], delay = at + 200 + stages.filter((s) => s.kind === "impact").length * 150;
    stages.push({ stageId: `cond-${id}`, kind: "impact", assets: [...r.assets], delay, duration: 1200, scale: round(0.7 * scale), opacity: 0.85, optionalTargets: true, ...(r.below ? { below: true } : {}) });
    if (r.motion && !stages.some((s) => s.kind === "motion" && s.subject === "targets")) stages.push(move(`cond-${id}-motion`, `${id[0].toUpperCase()}${id.slice(1)}`, r.motion[0], "targets", delay, 900, r.motion[1], r.motion[2], { optionalTargets: true }));
  }
  return stages;
}

// Magic and psionic strikes: a bolt at range, a charged touch in melee.
export function elementStrikeStages(element, mode) {
  const look = dsLook(element);
  if (mode === "melee") return [
    { stageId: "charge", kind: "cast", assets: [...look.cast], duration: 700, scale: 0.5, opacity: 0.85 },
    { stageId: "hit-contact", kind: "impact", assets: [...look.hit], delay: 300, duration: 1000, scale: 0.9 }];
  return [
    { stageId: "cast", kind: "cast", assets: [...look.cast], duration: 800, scale: 0.6 },
    { stageId: "bolt", kind: "travel", assets: [...(look.bolt ?? DS_LOOKS.arcane.bolt)], delay: 300, duration: 1000, scale: 1 },
    { stageId: "hit-accent", kind: "impact", assets: [...look.hit], delay: 1100, duration: 1000, scale: 0.9 }];
}
// A burst erupts around the user, a cube or wall where it was placed (on its targets), a line breathes.
export function areaStages(element, shape) {
  const look = dsLook(element);
  if (shape === "line") return [
    { stageId: "gather", kind: "cast", assets: [...look.cast], duration: 900, scale: 0.55 },
    { stageId: "breath", kind: "travel", assets: [...(look.breath ?? look.bolt ?? DS_LOOKS.arcane.bolt)], delay: 400, duration: 2000, scale: 1, optionalTargets: true, oneShot: true },
    { stageId: "hit", kind: "impact", assets: [...look.hit], delay: 1300, duration: 1000, scale: 0.8, optionalTargets: true }];
  if (shape === "area") return [
    { stageId: "cast", kind: "cast", assets: [...look.cast], duration: 800, scale: 0.6 },
    { stageId: "area", kind: "impact", assets: [...look.burst], delay: 400, duration: 2000, scale: 1.4, below: true, optionalTargets: true, targetSelection: "first" },
    { stageId: "hit", kind: "impact", assets: [...look.hit], delay: 1000, duration: 1000, scale: 0.8, optionalTargets: true }];
  return [
    { stageId: "burst", kind: "cast", assets: [...look.burst], duration: 2000, scale: 1.6, below: true },
    { stageId: "hit", kind: "impact", assets: [...look.hit], delay: 700, duration: 1000, scale: 0.8, optionalTargets: true }];
}

// A weapon strike: its wielder's weapon (a natural attack its name names, else the class's weapon
// picked by the ability's name), and the accent an untyped blow of that class lands in.
export function weaponStrike({ name = "", mode = "melee", element = "physical", group = null, generic = false } = {}) {
  const style = classStyle(group), ranged = mode === "ranged";
  const natural = !ranged && Object.entries(NATURAL_ATTACK).find(([, p]) => p.test(name))?.[0];
  const pool = ranged ? style.ranged : style.melee;
  // A weapon its name names wins (a Rapier Flunge thrusts, a Dagger Dance stabs), then the class's own.
  const named = natural ? null : weaponFamily(name);
  const weaponName = named || generic || natural || !pool?.length ? name : pickBy(name, pool);
  const spec = { name: weaponName, range: ranged ? "far" : "melee", damageTypes: ["physical"], ...(named ? { family: named } : generic || natural || !pool?.length ? { generic: true } : { family: weaponFamily(weaponName) }) };
  const s = weaponStyle(spec), stages = weaponStages(spec);
  // A Null strikes with ki-charged fists.
  if (style.unarmed && !ranged && !natural) for (const st of stages) if (st.stageId === "swing") st.assets = ["jb2a.unarmed_strike.magical.01.blue", "jb2a.unarmed_strike.physical.01.blue"];
  const hit = stages.find((st) => st.stageId.startsWith("hit"));
  const accent = element !== "physical" ? element : style.accent;
  if (accent) stages.push({ stageId: "accent", kind: "impact", assets: accent === "shadow" ? [...SHADOW_HIT] : [...dsLook(accent).hit], delay: (hit?.delay ?? 600) + 100, duration: 1000, scale: 0.75, opacity: 0.9 });
  return { style: s, weaponName, stages, accent: accent === "shadow" ? null : accent };
}

const SHAPE_SOUND = { fire: { burst: "explosion", line: "fireCone", area: "fireball" }, cold: { line: "coldCone" }, lightning: { line: "lightningBolt" }, earth: { burst: "earthquake", area: "earthquake" } };
const ELEMENT_SOUND = { fire: "fire", cold: "cold", lightning: "electric", acid: "acid", poison: "poison", corruption: "void", holy: "holy", psychic: "psychic",
  sonic: "sonic", earth: "earth", void: "void", nature: "vines", time: "time", force: "force", arcane: "force", physical: "bludgeon" };
const MOTIF_SOUND = { song: "song", roar: "battleCry", shield: "shield", shadow: "shadow", slam: "earthquake" };
const elementSound = (element, shape) => ({ namespace: "spell", profile: SHAPE_SOUND[element]?.[shape] ?? ELEMENT_SOUND[element] ?? "force" });
const MOTION_SHAPE = { burst: "burst", area: "burst", line: "breath", strike: "strike" };

// How much bigger an ability plays: a free strike a little smaller, a heroic ability by its cost.
export const abilityScale = ({ category = "", resource = 0 } = {}) => round(category === "freeStrike" ? 0.9 : 1 + Math.min(11, Number(resource) || 0) * 0.03);
const scaled = (stages, s) => stages.map((st) => (st.kind === "motion" || st.kind === "tokenfx" || st.kind === "sound" || !Number.isFinite(st.scale) ? st : { ...st, scale: round(st.scale * s) }));
const firstHit = (stages) => stages.find((st) => st.kind === "impact") ?? null;

// A self or ally ability: its class's boon (a motif's own when its name names one) or a heal, a glow
// on the user's body, and its gesture.
function selfStages(look, style, motif, { name = "", group = null } = {}) {
  const heal = look.utility === "heal", extra = CLASS_BOONS[group] ?? {};
  const art = heal ? extra.heal ?? HEAL : motif === "shield" ? { self: ["jb2a.markers.shield_rampart.complete.01.orange"], target: ["jb2a.markers.shield.green.01"] }
    : motif === "song" ? { self: ["jb2a.bardic_inspiration.purplepink", "jb2a.bardic_inspiration.greenorange"], target: ["jb2a.markers.music_note.blue.01"] }
    : motif === "roar" ? { self: ["jb2a.soundwave.01.blue"], target: style.boon.target }
    : motif === "shadow" ? { self: ["jb2a.misty_step.01.dark_black", "jb2a.misty_step.01.blue"], target: SHADOW_HIT }
    : motif === "mark" ? { self: style.boon.self, target: ["jb2a.hunters_mark.pulse.01.red", "jb2a.hunters_mark.pulse.01.green"] }
    : pickBy(name, [style.boon, ...(extra.boons ?? [])]);
  const gesture = heal ? ["levitate", "Rises with renewed strength", 0.6] : motif === "shield" ? ["brace", "Braces behind a guard", 0.6] : motif === "roar" ? ["slam", "Bellows and stamps", 0.7]
    : motif === "song" ? ["spin", "Turns with the music", 0.4] : motif === "shadow" ? ["flicker", "Flickers into shadow", 0.7]
    : ["charge", "leap"].includes(motif) ? ["dodge", "Moves to a new spot", 0.6] : pickBy(`${name}#gesture`, SELF_GESTURES);
  return [
    move("user-gesture", gesture[1], gesture[0], "source", 0, 1100, gesture[2], 0.05),
    { stageId: "self", kind: "cast", assets: [...art.self], duration: 1600, scale: 1.3 },
    { stageId: "target", kind: "impact", assets: [...art.target], delay: 400, duration: 1400, scale: 1.1, optionalTargets: true },
    fx("glow", heal ? "Healing glow" : "Resolve glow", "glow", "source", 200, 1600, { tint: heal ? "#80dda4" : style.glow }),
  ];
}

// The motif's change to a strike or area: an approach (rush or leap) the rest waits for, a spin, a
// slam, a second and third blow, a shadow step, a cry, a guard, a mark.
function withMotif(stages, motif, { look, scale }) {
  if (!motif) return stages;
  const strike = look.shape === "strike";
  if ((motif === "charge" || motif === "leap") && strike && look.mode === "melee") {
    const leap = motif === "leap", lead = 900;
    const approach = move("approach", leap ? "Leaps at the foe" : "Charges in", leap ? "leap" : "rush", "source", 0, 2400, 0.55, 6,
      { motionRange: "target", perSquare: 180, motionArrival: 35, motionHold: 40, ...(leap ? { jumpHeight: 0.8 } : {}) });
    return [approach, { stageId: "trail", kind: "cast", assets: ["jb2a.smoke.puff.side.02.white", "jb2a.smoke.puff.side.grey"], duration: 900, scale: 0.6, opacity: 0.6, below: true },
      ...stages.filter((s) => !(s.kind === "motion" && s.subject === "source")).map((s) => ({ ...s, delay: (s.delay ?? 0) + lead }))];
  }
  const hit = firstHit(stages), at = hit?.delay ?? 600;
  switch (motif) {
    case "spin": return [...stages.filter((s) => !(s.kind === "motion" && s.subject === "source")), move("spin", "Spins through the blow", "spin", "source", 0, 900, 0.8, 0),
      { stageId: "whirl", kind: "cast", assets: ["jb2a.melee_generic.whirlwind.01.orange"], delay: 100, duration: 1000, scale: round(0.9 * scale), opacity: 0.85 }];
    case "slam": return [...stages.filter((s) => !(s.kind === "motion" && s.subject === "source")), move("slam", "Rises and slams down", "slam", "source", 0, 1000, 1, 0.1),
      { stageId: "crack", kind: "impact", assets: ["jb2a.impact.ground_crack.01.orange", "jb2a.ground_cracks.01.orange"], delay: at, duration: 1400, scale: round(0.9 * scale), below: true, optionalTargets: true }];
    case "flurry": return hit ? [...stages, { ...hit, stageId: "hit-2", delay: at + 260, scale: round((hit.scale ?? 0.9) * 0.85) }, { ...hit, stageId: "hit-3", delay: at + 520, scale: round((hit.scale ?? 0.9) * 0.75) }] : stages;
    case "shadow": return [{ stageId: "shadow-step", kind: "cast", assets: ["jb2a.misty_step.01.dark_black", "jb2a.misty_step.01.blue"], duration: 900, scale: 0.8, opacity: 0.85 },
      move("flicker", "Flickers through the shadows", "flicker", "source", 0, 700, 0.6, 0), ...stages.map((s) => (s.kind === "motion" && s.subject === "source" ? { ...s, delay: (s.delay ?? 0) + 300 } : s))];
    case "roar": return [{ stageId: "roar", kind: "cast", assets: ["jb2a.soundwave.01.blue"], duration: 900, scale: 0.9, opacity: 0.8 }, ...stages];
    case "shield": return [...stages, { stageId: "guard", kind: "cast", assets: ["jb2a.markers.shield_rampart.complete.01.orange"], delay: at, duration: 1400, scale: 0.8, opacity: 0.8 }];
    case "mark": return [...stages, { stageId: "mark", kind: "impact", assets: ["jb2a.hunters_mark.pulse.01.red", "jb2a.hunters_mark.pulse.01.green"], delay: at + 150, duration: 1300, scale: 0.6, optionalTargets: true }];
    case "song": return [{ stageId: "notes", kind: "cast", assets: ["jb2a.markers.music_note.blue.01"], duration: 1200, scale: 0.7, opacity: 0.85 }, ...stages];
    default: return stages;
  }
}

// Clips play to their end instead of being cut at the stage's length: a clip up to WHOLE_CLIP long plays
// whole (oneShot, timed by its measured length at play time); a longer one (a chain, a fear mark, fumes)
// shows for LONG_CLIP and fades out. Unmeasured clips keep their stage's length.
export const WHOLE_CLIP = 3500, LONG_CLIP = 2600;
export function wholeClips(stages, clipLength) {
  return stages.map((s) => {
    if (!["cast", "impact", "travel"].includes(s.kind) || s.persist || s.clipStart || s.clipEnd) return s;
    const len = Math.max(0, ...(s.assets ?? []).map(clipLength));
    if (!len || s.duration >= len) return s;
    return len <= WHOLE_CLIP ? { ...s, oneShot: true } : { ...s, duration: Math.max(s.duration, LONG_CLIP), fadeOut: Math.max(s.fadeOut ?? 0, 600) };
  });
}

// An ability used with no one targeted (a Charge, an unrolled strike): the user's lunge or rush toward a
// target becomes a gesture in place, and what lands on targets is skipped instead of blocking the rest.
export function untargetedStages(stages) {
  let gestured = false;
  return stages.flatMap((s) => {
    if (s.kind === "motion" && s.subject !== "targets" && (s.motion === "lunge" || s.motionRange === "target")) {
      if (gestured) return [];
      gestured = true;
      return [move(s.stageId, "Readies the blow", "pulse", "source", s.delay ?? 0, 800, 0.6, 0.05)];
    }
    return ["travel", "impact"].includes(s.kind) || s.subject === "targets" ? [{ ...s, optionalTargets: true }] : [s];
  });
}

// What an ability's words say it does (draw-steel.mjs abilityVerbs), each with its own look: what the
// user does (gesture), what appears under or on the user, what flies to and lands on its targets, how
// a target's body moves, and the Tokenshade look on the bodies it changes (a fading invisible creature,
// a marked foe, a frightened one, a quickened ally). Every list ends with a key JB2A Free has.
const STAR = ["jb2a.particle_burst.01.star.yellow", "jb2a.twinkling_stars.points07.orange"];
const DUST = ["jb2a.smoke.puff.side.02.white", "jb2a.smoke.puff.side.grey"];
const CRACK = ["jb2a.impact.ground_crack.01.orange", "jb2a.ground_cracks.01.orange"];
export const VERB_LOOKS = Object.freeze({
  teleport: { label: "teleports", gesture: ["flicker", "Vanishes and reappears", 0.9], self: ["jb2a.misty_step.01.blue"], after: ["jb2a.misty_step.02.blue"], fx: ["Misted", "source"], sound: "teleport" },
  swap: { label: "swaps places", gesture: ["flicker", "Trades places", 0.8], self: ["jb2a.misty_step.01.purple", "jb2a.misty_step.01.blue"], target: ["jb2a.misty_step.01.purple", "jb2a.misty_step.01.blue"], sound: "teleport" },
  portal: { label: "opens portals", gesture: ["pulse", "Tears space open", 0.7], self: ["jb2a.portals.vertical.ring_masked.blue", "jb2a.portals.vertical.ring.bright_yellow"], target: ["jb2a.portals.vertical.ring_masked.dark_purple", "jb2a.portals.vertical.ring.bright_yellow"], sound: "pocketTransition" },
  invisible: { label: "turns invisible", gesture: ["fade", "Fades from sight", 0.8], self: ["jb2a.smoke.puff.centered.grey"], fx: ["Unseen", "subjects"], sound: "shadow" },
  conceal: { label: "hides in cover", gesture: ["sink", "Ducks into cover", 0.4], under: ["jb2a.smoke.plumes.01.grey"], self: ["jb2a.darkness.black"], fx: ["Haze", "subjects"], sound: "shadow" },
  illusion: { label: "casts an illusion", gesture: ["spin", "Splits into images", 0.5], self: ["jb2a.misty_step.01.purple", "jb2a.misty_step.01.blue"], fx: ["images", "subjects"], sound: "whispers" },
  shapeshift: { label: "shapeshifts", gesture: ["spin", "Twists into a new form", 0.9], self: ["jb2a.smoke.puff.centered.grey"], after: ["jb2a.claws.200px.red"], fx: ["Shifting", "source"], sound: "transform" },
  phase: { label: "phases through matter", gesture: ["flicker", "Turns insubstantial", 0.6], self: ["jb2a.misty_step.01.blue"], fx: ["Ethereal", "subjects"], sound: "spirit" },
  telekinesis: { label: "moves it with the mind", gesture: ["pulse", "Reaches out with the mind", 0.6], travel: ["jb2a.energy_strands.range.standard.purple.01"], target: ["jb2a.energy_strands.overlay.purple.01", "jb2a.energy_strands.overlay.blue.01"], targetMotion: ["levitate", 0.6, 0.12], sound: "force" },
  grow: { label: "grows huge", gesture: ["slam", "Swells to a giant's size", 1], under: CRACK, self: ["jb2a.impact.ground_crack.02.orange", "jb2a.ground_cracks.01.orange"], sound: "earthquake" },
  fly: { label: "takes flight", gesture: ["levitate", "Lifts into the air", 1, 0.3], under: DUST, fx: ["Levitate", "subjects"], sound: "wind" },
  jump: { label: "leaps", gesture: ["slam", "Leaps and lands hard", 1], under: CRACK, sound: "earthquake" },
  burrow: { label: "burrows", gesture: ["sink", "Digs into the ground", 0.9], under: CRACK, fx: ["Mud-Caked", "source"], sound: "earth" },
  temp: { label: "gains temporary Stamina", gesture: ["brace", "Hardens against harm", 0.5], self: ["jb2a.markers.shield.green.01"], glow: "#7fc8ff", sound: "shield" },
  heal: { label: "heals", gesture: ["levitate", "Rises with renewed strength", 0.6], heal: true, glow: "#80dda4", sound: "healing" },
  immunity: { label: "is warded", gesture: ["brace", "Raises a ward", 0.6], self: ["jb2a.markers.shield_rampart.complete.01.orange"], glow: "#ffd27f", sound: "shield" },
  stability: { label: "plants their feet", gesture: ["brace", "Plants their feet", 0.8], under: CRACK, glow: "#b0794a", sound: "earth" },
  stand: { label: "stands up", gesture: ["levitate", "Rises to their feet", 0.5, 0.1], under: DUST, sound: "objectWhoosh" },
  escape: { label: "breaks free", gesture: ["spin", "Twists free", 0.7], self: ["jb2a.markers.chain.standard.complete.02.red"], after: ["jb2a.impact.003.blue"], sound: "chainBinding" },
  judge: { label: "judges a foe", gesture: ["pulse", "Pronounces judgment", 0.8], target: ["jb2a.divine_smite.target.yellowwhite", "jb2a.divine_smite.target.blueyellow"], fx: ["Exposed", "targets"], sound: "divineWrath" },
  mark: { label: "marks a foe", gesture: ["brace", "Points out the foe", 0.5], target: ["jb2a.hunters_mark.pulse.01.red", "jb2a.hunters_mark.pulse.01.green"], fx: ["Exposed", "targets"], sound: "detect" },
  taunt: { label: "taunts", gesture: ["slam", "Calls the foe out", 0.6], self: ["jb2a.soundwave.01.blue"], target: ["jb2a.hunters_mark.pulse.01.red", "jb2a.hunters_mark.pulse.01.green"], fx: ["Fascinated", "targets"], sound: "battleCry" },
  fear: { label: "frightens", gesture: ["slam", "Looms with menace", 0.8], self: ["jb2a.markers.fear.dark_purple.03", "jb2a.markers.fear.dark_purple.01"], target: ["jb2a.markers.fear.dark_purple.03", "jb2a.markers.fear.dark_purple.01"], targetMotion: ["cower", 0.7, 0.05], fx: ["Trembling", "targets"], sound: "fear" },
  bane: { label: "curses with a bane", gesture: ["pulse", "Lays a curse", 0.6], target: ["jb2a.condition.curse.01.019.purple", "jb2a.condition.curse.01.001.red"], fx: ["Doom", "targets"], sound: "whispers" },
  edge: { label: "grants an edge", gesture: ["pulse", "Points the way", 0.5], target: ["jb2a.condition.boon.01.007.green", "jb2a.condition.boon.01.001.green"], fx: ["Focused", "subjects"], sound: "bless" },
  retaliate: { label: "readies retribution", gesture: ["brace", "Readies retribution", 0.6], self: ["jb2a.divine_smite.caster.dark_red", "jb2a.divine_smite.caster.blueyellow"], glow: "#d0485a", sound: "divineWrath" },
  empower: { label: "empowers its blows", gesture: ["brace", "Charges its blows", 0.7], self: ["jb2a.energy_strands.overlay.dark_red.01", "jb2a.energy_strands.overlay.blue.01"], glow: "#ff7a2f", sound: "battleCry" },
  surge: { label: "gains surges", gesture: ["pulse", "Gathers surges", 0.6], self: STAR, target: STAR, glow: "#ffd166", sound: "bless" },
  resource: { label: "gains Heroic Resource", gesture: ["levitate", "Swells with heroism", 0.4], self: ["jb2a.markers.light_orb.complete.yellow", "jb2a.markers.light_orb.complete.blue"], target: ["jb2a.markers.light_orb.complete.yellow", "jb2a.markers.light_orb.complete.blue"], glow: "#9fd8ff", sound: "light" },
  rally: { label: "rallies allies", gesture: ["slam", "Calls the charge", 0.6], self: ["jb2a.soundwave.01.blue"], target: ["jb2a.bless.200px.intro.yellow"], targetMotion: ["pulse", 0.5, 0.05], sound: "battleCry" },
  speed: { label: "moves fast", gesture: ["dodge", "Darts away", 0.8], under: DUST, fx: ["Quickened", "subjects"], sound: "wind" },
  field: { label: "raises a field", gesture: ["pulse", "Spreads its field", 0.7], field: true, sound: "dispel" },
  object: { label: "makes something appear", gesture: ["slam", "Calls it forth", 0.6], target: ["jb2a.impact.ground_crack.02.orange", "jb2a.ground_cracks.01.orange"], sound: "stoneWall" },
  potion: { label: "hands out a potion", gesture: ["throw", "Lobs a potion", 0.8], travel: ["jb2a.throwable.throw.flask.01.orange"], target: ["jb2a.healing_generic.200px.green"], sound: "healing" },
  telepathy: { label: "speaks mind to mind", gesture: ["pulse", "Reaches into a mind", 0.4], travel: ["jb2a.energy_strands.range.standard.purple.01"], target: ["jb2a.particle_burst.01.rune.bluepurple"], sound: "whispers" },
  sense: { label: "sees what is hidden", gesture: ["pulse", "Looks deeper", 0.4], self: ["jb2a.markers.light.complete.blue"], target: ["jb2a.markers.light.complete.blue"], sound: "detect" },
  time: { label: "bends time", gesture: ["spin", "Turns the clock", 0.6], under: ["jb2a.magic_signs.circle.02.divination.complete.blue"], fx: ["Quickened", "subjects"], sound: "time" },
});
// The verb an ability looks like: the first of what it really does (a teleport, a mark, invisibility)
// before what it only grants along the way (an edge, surges, speed).
const MINOR_VERBS = new Set(["bane", "edge", "surge", "resource", "rally", "speed", "field", "immunity", "stability", "time", "empower", "sense", "temp"]);
export const primaryVerb = (verbs = []) => verbs.find((v) => VERB_LOOKS[v] && !MINOR_VERBS.has(v)) ?? verbs.find((v) => VERB_LOOKS[v]) ?? null;
// A field's ring by its element: holy light, psionic blue, else a warding circle.
const FIELD_RINGS = { holy: ["jb2a.magic_signs.circle.02.abjuration.complete.yellow", "jb2a.magic_signs.circle.02.abjuration.complete.blue"], psychic: ["jb2a.magic_signs.circle.02.divination.complete.blue"],
  force: ["jb2a.magic_signs.circle.02.divination.complete.blue"], fire: ["jb2a.magic_signs.circle.02.evocation.complete.red", "jb2a.magic_signs.circle.02.evocation.complete.dark_red", "jb2a.magic_signs.circle.01.evocation"],
  void: ["jb2a.magic_signs.circle.02.illusion.complete.dark_purple", "jb2a.magic_signs.circle.02.illusion"], corruption: ["jb2a.magic_signs.circle.02.necromancy.complete.dark_green", "jb2a.magic_signs.circle.02.necromancy"],
  nature: ["jb2a.magic_signs.circle.02.conjuration.complete.green", "jb2a.magic_signs.circle.02.conjuration"], earth: CRACK };
const fieldRing = (element) => FIELD_RINGS[element] ?? ["jb2a.magic_signs.circle.02.abjuration.complete.blue"];
// Other rings of the same element, so two edicts or two fields do not spread the same circle.
const FIELD_ALTS = { holy: [["jb2a.magic_signs.circle.02.evocation.complete.yellow", "jb2a.magic_signs.circle.02.abjuration.complete.blue"], ["jb2a.bless.400px.intro.yellow"]],
  psychic: [["jb2a.token_border.circle.spinning.blue.004"], ["jb2a.energy_conduit.bluepurple.circle.01"]], arcane: [["jb2a.magic_signs.circle.02.conjuration.complete.blue", "jb2a.magic_signs.circle.02.conjuration"]] };
// A melee ability that only grabs, shoves or hinders: hands on the foe, not a weapon swing.
function handsOnStages({ forced, conditions, scale }) {
  return [move("reach", "Reaches for the foe", "lunge", "source", 0, 900, 0.8, 0.12),
    { stageId: "contact", kind: "impact", assets: ["jb2a.unarmed_strike.physical.01.blue"], delay: 350, duration: 800, scale: 0.7, opacity: 0.9 },
    ...riderStages({ forced, conditions }, 450, scale)];
}
const ALLY_TARGETS = new Set(["ally", "selfOrAlly", "selfAlly"]);
const OTHER_TARGETS = new Set(["ally", "selfOrAlly", "selfAlly", "selfOrCreature", "creatureObject", "creature", "object", "enemy", "enemyObject", "special"]);

// An ability without damage, played as what its text says: its main verb, then one more it does.
export function verbStages(verbs, { look, style, group = null, target = null, name = "" } = {}) {
  const main = primaryVerb(verbs), v = VERB_LOOKS[main], second = VERB_LOOKS[verbs.find((x) => x !== main && VERB_LOOKS[x])] ?? null;
  const onOthers = OTHER_TARGETS.has(target), heal = v.heal ? (CLASS_BOONS[group]?.heal ?? HEAL) : null;
  const self = heal ? heal.self : v.self, landing = heal ? heal.target : v.target;
  const g = v.gesture ?? pickBy(`${name}#gesture`, SELF_GESTURES), stages = [move("user-gesture", g[1], g[0], "source", 0, 1100, g[2], g[3] ?? 0.05)];
  // An aura or burst spreads its ring whatever it does inside it (an edict judges, a song inspires).
  if (v.field || look?.shape === "burst") stages.push({ stageId: "field", kind: "cast", assets: [...pickBy(name, [fieldRing(look?.element), ...(FIELD_ALTS[look?.element] ?? [])])], duration: 2200, scale: 1.6, below: true, opacity: 0.85 });
  if (v.under) stages.push({ stageId: "under", kind: "cast", assets: [...v.under], duration: 1400, scale: 1, below: true, opacity: 0.8 });
  if (self) stages.push({ stageId: "self", kind: "cast", assets: [...self], delay: 100, duration: 1500, scale: 1.1 });
  if (v.travel) stages.push({ stageId: "send", kind: "travel", assets: [...v.travel], delay: 300, duration: 900, scale: 0.8, optionalTargets: true });
  if (landing) stages.push(onOthers ? { stageId: "land", kind: "impact", assets: [...landing], delay: v.travel ? 1000 : 500, duration: 1400, scale: 1, optionalTargets: true }
    : { stageId: "land", kind: "cast", assets: [...landing], delay: 500, duration: 1400, scale: 0.9 });
  if (v.after) stages.push({ stageId: "after", kind: "cast", assets: [...v.after], delay: 800, duration: 1200, scale: 0.9 });
  if (v.targetMotion && onOthers) stages.push(move("target-motion", v.label, v.targetMotion[0], "targets", 600, 900, v.targetMotion[1], v.targetMotion[2], { optionalTargets: true }));
  // One more thing the ability does, smaller: its landing on the targets, or its mark on the user.
  const extra = second && (second.target ?? second.self ?? second.under);
  if (extra && !stages.some((s) => s.assets?.[0] === extra[0])) stages.push(onOthers && second.target ? { stageId: "also", kind: "impact", assets: [...second.target], delay: 1000, duration: 1200, scale: 0.7, opacity: 0.85, optionalTargets: true }
    : { stageId: "also", kind: "cast", assets: [...extra], delay: 1000, duration: 1200, scale: 0.7, opacity: 0.85, ...(second.under && !second.self ? { below: true } : {}) });
  const tint = v.glow ?? second?.glow ?? style.glow;
  if (v.fx) {
    const [preset, on] = v.fx;
    if (on !== "targets") stages.push(fx("body", preset, preset, "source", 300, 1800));
    if (on !== "source" && onOthers) stages.push(fx("body-targets", preset, preset, "targets", 600, 1800));
  } else {
    stages.push(fx("glow", `${v.label} glow`, "glow", "source", 300, 1600, { tint }));
    // Only allies share the user's glow: an escaped grabber or a cursed foe does not.
    if (ALLY_TARGETS.has(target) || target === "selfOrCreature") stages.push(fx("glow-targets", `${v.label} glow`, "glow", "targets", 600, 1600, { tint }));
  }
  return { stages, sound: v.sound, main };
}

// The whole design of an ability: stages (visuals, motion, body accents, riders), sound and a label.
// `generic` (a fallback) keeps the plain weapon and no class style; `monster` keeps the class-free
// style but reads the ability's own name for its weapon. `verbs` (what its text says it does) shape an
// ability without damage; one with damage adds its main verb's mark to the hit.
export function designAbility({ look, name = "", group = null, keywords = [], forced = null, conditions = [], category = "", resource = 0, generic = false,
  monster = false, verbs = [], damages = null, target = null } = {}) {
  const plain = generic || monster, style = classStyle(plain ? null : group), motif = generic ? null : motifOf(name, keywords), scale = abilityScale({ category, resource });
  const harmless = damages === false || (damages === null && look.shape === "self"), main = generic ? null : primaryVerb(verbs);
  // A charge or leap is its approach, whatever its text adds (a free strike at its end).
  const approach = ["charge", "leap"].includes(motif) && look.shape === "strike" && look.mode === "melee";
  if (main && harmless && !approach) {
    const v = verbStages(verbs, { look, style, group: plain ? null : group, target, name });
    v.stages.push(...riderStages({ forced, conditions }, 900, scale));
    const also = verbs.find((x) => x !== v.main && VERB_LOOKS[x]);
    return { stages: scaled(v.stages.slice(0, 16), scale), sound: { namespace: "spell", profile: v.sound }, design: `${v.main}${also ? ` + ${also}` : ""}`, color: style.glow };
  }
  if (harmless && look.shape === "strike" && look.mode === "melee" && (forced || conditions.length)) {
    const stages = handsOnStages({ forced, conditions, scale });
    return { stages: scaled(stages, scale), sound: { namespace: "spell", profile: forced ? "bludgeon" : "chainBinding" }, design: `hands on · ${forced?.kind ?? conditions[0]}`, color: style.color };
  }
  if (look.shape === "self") {
    const stages = scaled(selfStages(look, style, motif, { name, group: plain ? null : group }), scale);
    return { stages, sound: { namespace: "spell", profile: look.utility === "heal" ? "healing" : MOTIF_SOUND[motif] ?? style.sound }, design: `${look.utility}${motif ? ` · ${motif}` : ""}`, color: look.utility === "heal" ? "#6fe08a" : style.glow };
  }
  let stages, sound, accent = look.element, design;
  if (look.shape === "strike" && (look.weapon || look.element === "physical")) {
    const w = weaponStrike({ name, mode: look.mode, element: look.element, group: plain ? null : group, generic: plain });
    stages = weaponMotion(w.style, w.stages);
    accent = w.accent ?? look.element;
    sound = look.element === "physical" ? weaponSoundDesign(w.style, w.weaponName) : elementSound(look.element, "strike");
    design = `${w.weaponName.toLowerCase()} ${look.mode}`;
  } else if (look.shape === "strike") {
    stages = weaponMotion({ melee: look.mode === "melee", family: "magic" }, elementStrikeStages(look.element, look.mode));
    sound = elementSound(look.element, "strike");
    design = `${look.element} ${look.mode}`;
  } else {
    stages = featureMotion(["physical", "earth"].includes(look.element) ? "physical" : look.element, MOTION_SHAPE[look.shape], areaStages(look.element, look.shape));
    sound = elementSound(look.element, look.shape);
    design = `${look.element} ${look.shape}`;
  }
  stages = withMotif(stages, motif, { look, scale });
  const hit = firstHit(stages), at = hit?.delay ?? 700;
  // A heroic ability of cost 5 or more adds a flare of its element under its targets.
  if (category === "heroic" && Number(resource) >= 5) stages.push({ stageId: "flare", kind: "impact", assets: [...dsLook(accent === "physical" ? look.element : accent).burst], delay: at + 150, duration: 1400, scale: 0.8, opacity: 0.55, below: true, optionalTargets: true });
  stages.push(...riderStages({ forced, conditions }, at, scale));
  // What else its text says it does to whom it hits (a judgment, a mark, a teleport after the blow).
  const said = main ? VERB_LOOKS[main] : null, mark = said?.target ?? said?.self;
  if (mark && !stages.some((s) => s.assets?.[0] === mark[0])) stages.push({ stageId: "verb", kind: said.target ? "impact" : "cast", assets: [...mark], delay: at + 250, duration: 1200, scale: 0.7, opacity: 0.85, ...(said.target ? { optionalTargets: true } : {}) });
  if (BODY_ACCENTS[accent]) stages.push(fx("body", BODY_ACCENTS[accent], BODY_ACCENTS[accent], "targets", at, 1600));
  else if (said?.fx && said.fx[1] !== "source") stages.push(fx("body", said.fx[0], said.fx[0], "targets", at + 250, 1600));
  if (motif && MOTIF_SOUND[motif] && look.element === "physical") sound = { namespace: "spell", profile: MOTIF_SOUND[motif] };
  return { stages: scaled(stages.slice(0, 16), scale), sound, design: `${design}${motif ? ` · ${motif}` : ""}${main ? ` · ${main}` : ""}`, color: style.color };
}
