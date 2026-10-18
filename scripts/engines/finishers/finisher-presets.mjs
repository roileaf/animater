// Built-in finishers to copy and make your own. Each moves the real target token; flinging
// ones travel on a held keyframed path so the token is moved to where it lands (finisher-play.mjs).
import { validateRecipe } from "../../core/model.mjs";
import { damageLook, normalizeDamageType } from "../playback/damage-moments.mjs";
import { daggerheartDamageType } from "../../systems/daggerheart.mjs";

const HIT = ["jb2a.impact.003.white", "jb2a.impact.005.white"];
const DUST = ["jb2a.smoke.puff.side.grey", "jb2a.smoke.puff.centered.grey"];
const SLASH = ["jb2a.melee_generic.slashing.one_handed", "jb2a.melee_generic.slash"];
const PIERCE = ["jb2a.melee_generic.piercing.one_handed", "jb2a.impact.005.white"];
const BLOOD = ["jb2a.liquid.splash.red", "jb2a.liquid.splash02.red"];
const CRACK = ["jb2a.impact.ground_crack.01.white", "jb2a.impact.ground_crack.orange"];
const look = (type) => damageLook(type);
const fx = (stageId, assets, extra = {}) => ({ stageId, kind: "impact", assets, duration: 1200, ...extra });
const move = (stageId, motion, extra = {}) => ({ stageId, kind: "motion", motion, subject: "targets", assets: [], ...extra });
const kf = (at, x = 0, y = 0, extra = {}) => ({ at, x, y, ...extra });
// A held keyframed path on the target: travel ends upright on its square; in-place ones fade out.
// Each is one fluid motion: linear keyframes, with the stage's pathEase shaping the speed.
const path = (keyframes, extra = {}) => move("fly", "path", { motionEnd: "hold", duration: 1300, keyframes, ...extra });
const preset = (name, description, finisher, stages) => ({ name, description, build: () => ({ name, description, trigger: "manual", color: "#c0392b", finisher, stages }) });

export const FINISHER_PRESETS = {
  launch: preset("Launch", "Sent flying, crashes down in a cloud of dust.", { knockback: 3, ending: "body" },
    [fx("hit", HIT, { duration: 900 }), path([kf(0), kf(0.35, 1.1, 0, { rotation: 250, scale: 1.3 }), kf(0.75, 2.6, 0, { rotation: 600, scale: 1.1 }), kf(1, 3, 0, { rotation: 720 })], { delay: 150, pathEase: "easeOutQuad" }), fx("landing", DUST, { delay: 1450 })]),
  cleave: preset("Cleave", "A clean cut drops it where it stands.", { knockback: 0, ending: "body" },
    [fx("slash", ["jb2a.melee_generic.slashing.one_handed", "jb2a.melee_generic.slash"], { duration: 900 }), move("stagger", "stagger", { delay: 200, duration: 900 }), move("fall", "collapse", { delay: 900, duration: 1400 })]),
  skewer: preset("Skewer", "Driven back a step and pinned.", { knockback: 1, ending: "body" },
    [fx("hit", HIT, { duration: 800 }), path([kf(0), kf(1, 1, 0)], { duration: 450, pathEase: "easeOutCubic" }), move("fall", "collapse", { delay: 700, duration: 1400 })]),
  "struck-down": preset("Struck down", "Snapped back by the shot and dropped.", { knockback: 1, ending: "body" },
    [fx("hit", HIT, { duration: 800 }), path([kf(0), kf(1, 1, 0)], { duration: 350, pathEase: "easeOutCubic" }), move("fall", "collapse", { delay: 500, duration: 1400 })]),
  ash: preset("Burn to ash", "Flames consume it until nothing is left.", { knockback: 0, ending: "vanish" },
    [fx("burn", look("fire").death, { duration: 1800 }), path([kf(0), kf(0.4, 0, 0, { scale: 1.05 }), kf(1, 0, 0, { scale: 0.2, alpha: 0 })], { delay: 300, duration: 1800, pathEase: "easeInQuad" }), fx("ash", look("fire").after, { delay: 1500, duration: 1500 })]),
  shatter: preset("Shatter", "Frozen solid, then broken apart.", { knockback: 0, ending: "vanish" },
    [fx("freeze", look("cold").death, { duration: 1400 }), path([kf(0), kf(0.5, 0, 0, { scale: 1.02 }), kf(0.6, 0.05, 0, { sharp: true }), kf(0.7, -0.05, 0, { sharp: true }), kf(1, 0, 0, { scale: 1.3, alpha: 0 })], { delay: 200, duration: 1600, pathEase: "linear" }), fx("burst", look("cold").after, { delay: 1200 })]),
  jolt: preset("Jolt", "Lightning hurls it aside.", { knockback: 2, ending: "body" },
    [fx("shock", look("electricity").death, { duration: 1600 }), path([kf(0), kf(0.3, 0, 0.2), kf(0.7, 1.4, -0.2, { rotation: -180, scale: 1.15 }), kf(1, 2, 0, { rotation: -360 })], { delay: 400, duration: 1100, pathEase: "easeOutQuad" }), fx("landing", look("electricity").after, { delay: 1500 })]),
  blast: preset("Blast", "Thrown hard by raw force.", { knockback: 3, ending: "body" },
    [fx("blast", look("force").death), path([kf(0), kf(0.6, 2.6, 0, { rotation: 300 }), kf(1, 3, 0, { rotation: 360 })], { delay: 100, duration: 900, pathEase: "easeOutCubic" }), fx("landing", look("force").after, { delay: 1000 })]),
  "wall-slam": preset("Wall slam", "Shoved so hard it slams into the wall.", { knockback: 6, ending: "body", wall: "slam" },
    [fx("hit", HIT, { duration: 800 }), path([kf(0), kf(0.12, 0.5, 0, { scale: 1.08, stretch: 0.1 }), kf(0.6, 3.6, 0, { stretch: 0.22 }), kf(1, 6, 0)], { delay: 100, duration: 1000, pathEase: "easeOutCubic" }),
      fx("wall-crack", ["jb2a.impact.ground_crack.01.orange", "jb2a.impact.005.white"], { duration: 1500, scale: 0.8, delay: 1100 }), move("wall-squash", "squash", { duration: 450, intensity: 1.2, delay: 1100 }),
      fx("wall-dust", DUST, { duration: 1200, delay: 1100 }), fx("landing", ["jb2a.impact.005.white", ...DUST], { delay: 1100, duration: 1200, scale: 1.2 })]),
  unmade: preset("Unmade", "Twists into the dark and is gone.", { knockback: 0, ending: "vanish" },
    [fx("vortex", look("void").death, { duration: 2000 }), path([kf(0), kf(0.5, 0, 0, { rotation: 360, scale: 0.6 }), kf(1, 0, 0, { rotation: 720, scale: 0.05, alpha: 0 })], { delay: 200, duration: 1600, pathEase: "easeInQuad" })]),
  melt: preset("Melt", "Dissolves into a puddle.", { knockback: 0, ending: "vanish" },
    [fx("dissolve", look("acid").death, { duration: 1800 }), path([kf(0), kf(0.6, 0, 0, { scale: 0.8 }), kf(1, 0, 0, { scale: 0.3, alpha: 0 })], { delay: 300, duration: 1600, pathEase: "easeInQuad" }), fx("puddle", look("acid").after, { delay: 1400, duration: 1600 })]),
  ascend: preset("Ascend", "Rises into the light.", { knockback: 0, ending: "vanish" },
    [fx("light", look("vitality").death, { duration: 2000 }), path([kf(0), kf(0.7, 0, 0, { scale: 1.15 }), kf(1, 0, 0, { scale: 1.3, alpha: 0 })], { delay: 200, duration: 1800, pathEase: "easeInOutQuad" }), fx("stars", look("vitality").after, { delay: 1600 })]),
  "shaken-apart": preset("Shaken apart", "Vibrates until it bursts.", { knockback: 0, ending: "vanish" },
    [path([kf(0), kf(0.15, 0.08, 0, { sharp: true }), kf(0.3, -0.08, 0, { sharp: true }), kf(0.45, 0.08, 0, { sharp: true }), kf(0.6, -0.08, 0, { sharp: true }), kf(0.8, 0, 0, { scale: 1.1 }), kf(1, 0, 0, { scale: 1.4, alpha: 0 })], { duration: 1400, pathEase: "linear" }), fx("burst", look("sonic").death, { delay: 1000 }), fx("cracks", look("sonic").after, { delay: 1100, duration: 1500 })]),
  "soul-departs": preset("Soul departs", "The body crumples as the spirit leaves.", { knockback: 0, ending: "body" },
    [move("fall", "collapse", { duration: 1400 }), fx("depart", look("spirit").death, { delay: 400, duration: 1600 })]),
  fall: preset("Fall", "Simply drops.", { knockback: 0, ending: "body" },
    [move("fall", "collapse", { duration: 1400 })]),
  "slice-in-half": preset("Slice in half", "One clean cut along the swing; the halves slide apart.", { ending: "vanish" },
    [fx("slash", ["jb2a.melee_generic.slashing.one_handed", "jb2a.melee_generic.slash"], { duration: 700 }),
     move("cut", "fragments", { motionEnd: "hold", delay: 250, duration: 1400, pattern: "halves", cut: "attack", spread: 0.6, spin: 25, fall: 0.4, fade: 700 })]),
  bisect: preset("Bisect", "Cut through the middle; the top half slides off and topples.", { ending: "vanish" },
    [fx("slash", ["jb2a.melee_generic.slashing.one_handed", "jb2a.melee_generic.slash"], { duration: 700 }),
     move("cut", "fragments", { motionEnd: "hold", delay: 250, duration: 1600, pattern: "topBottom", spread: 0.5, spin: 30, fall: 0.5, fade: 800 })]),
  "shatter-shards": preset("Shatter into shards", "Breaks into spinning shards.", { ending: "vanish" },
    [fx("crack", look("cold").death, { duration: 900 }),
     move("cut", "fragments", { motionEnd: "hold", delay: 300, duration: 1300, pattern: "shards", pieces: 7, spread: 1.5, spin: 360, fall: 0.3, fade: 600 })]),
  disintegrate: preset("Disintegrate", "Crumbles to dust that blows away.", { ending: "vanish" },
    [fx("flash", look("void").death, { duration: 1200 }),
     move("cut", "fragments", { motionEnd: "hold", delay: 200, duration: 1800, pattern: "dust", pieces: 48, spread: 1.2, drift: 0.8, fall: 0, fade: 400 })]),
  "sky-launch": preset("Sky launch", "Blasted off into the distance with a twinkle.", { ending: "vanish" },
    [fx("hit", HIT, { duration: 800 }),
     path([kf(0), kf(0.2, 0.6, 0, { scale: 1.15, stretch: 0.3 }), kf(0.7, 2.4, 0, { scale: 0.4, stretch: 0.3 }), kf(1, 3, 0, { scale: 0.05, alpha: 0 })], { delay: 100, duration: 1200, pathEase: "easeInQuad" }),
     fx("twinkle", ["jb2a.twinkling_stars.points07.white", "jb2a.particle_burst.01.star.yellow"], { delay: 1200, duration: 1000, offsetX: 3, scale: 0.5 })]),
  "ragdoll-tumble": preset("Ragdoll tumble", "Bounces across the floor and lies still.", { ending: "body" },
    [fx("hit", HIT, { duration: 800 }),
     path([kf(0), kf(0.25, 1.2, 0, { rotation: 200, scale: 1.15, ease: "easeOutQuad" }), kf(0.4, 1.6, 0, { rotation: 300, stretch: -0.3, sharp: true, ease: "easeInQuad" }), kf(0.6, 2.3, 0, { rotation: 480, scale: 1.08, ease: "easeOutQuad" }), kf(0.72, 2.6, 0, { rotation: 560, stretch: -0.2, sharp: true, ease: "easeInQuad" }), kf(0.86, 2.9, 0, { rotation: 660, scale: 1.03, ease: "easeOutQuad" }), kf(0.93, 3, 0, { rotation: 700, stretch: -0.1, sharp: true, ease: "easeInQuad" }), kf(1, 3, 0, { rotation: 720, ease: "easeOutQuad" })], { delay: 100, duration: 1800, pathEase: "linear" }),
     fx("landing", DUST, { delay: 1900, duration: 1200 })]),
  "vortex-spiral": preset("Vortex spiral", "Spirals into a dark portal and is gone.", { ending: "vanish" },
    [fx("portal", look("void").death, { duration: 2200 }),
     path(Array.from({ length: 9 }, (_, i) => { const r = 0.6 * (1 - i / 8), t = (i * Math.PI) / 2; return kf(i / 8, i === 0 || i === 8 ? 0 : r * Math.cos(t), i === 0 || i === 8 ? 0 : r * Math.sin(t), { rotation: i * 135, scale: 1 - (0.95 * i) / 8, alpha: i === 8 ? 0 : 1 }); }), { delay: 200, duration: 2000, pathEase: "easeInQuad" })]),
  pancake: preset("Pancake", "Squashed flat into the floor.", { ending: "body" },
    [fx("slam", HIT, { duration: 800 }),
     path([kf(0), kf(0.3, 0, 0, { stretch: 0.1 }), kf(1, 0, 0, { stretch: -0.6, scale: 0.9, ease: "easeOutBack" })], { delay: 150, duration: 500, pathEase: "linear" }),
     fx("ring", ["jb2a.smoke.puff.ring.01.white", ...DUST], { delay: 600, duration: 1200 })]),
  diced: preset("Diced", "Cut into cubes that tumble to the floor.", { knockback: 0, ending: "vanish" },
    [fx("slash", ["jb2a.melee_generic.slashing.one_handed", "jb2a.melee_generic.slash"], { duration: 700 }),
     move("cut", "fragments", { motionEnd: "hold", delay: 250, duration: 1500, pattern: "diced", pieces: 4, spread: 0.6, spin: 200, fall: 0.6, fade: 600 })]),
  "claw-shred": preset("Claw shred", "Raked by claws; the strips slide apart.", { knockback: 0, ending: "vanish" },
    [fx("claw", ["jb2a.claws.400px.red", "jb2a.claws.200px.red"], { duration: 800 }),
     move("cut", "fragments", { motionEnd: "hold", delay: 300, duration: 1400, pattern: "claw", spread: 0.7, spin: 40, fall: 0.4, fade: 600 })]),
  "soul-drain": preset("Soul drain", "Torn into spirit shards that stream into the attacker.", { knockback: 0, ending: "vanish" },
    [fx("drain", look("void").hit, { duration: 1200 }),
     move("cut", "fragments", { motionEnd: "hold", delay: 300, duration: 1800, pattern: "starburst", pieces: 10, behavior: "absorb", tint: "ghost", spread: 1, spin: 90, fade: 500 })]),
  "frozen-shatter": preset("Frozen shatter", "Frozen solid and shattered; the shards bounce and settle.", { knockback: 0, ending: "vanish" },
    [fx("freeze", look("cold").hit, { duration: 900 }),
     move("cut", "fragments", { motionEnd: "hold", delay: 250, duration: 1600, pattern: "shards", pieces: 8, behavior: "bounce", tint: "frozen", spread: 0.8, spin: 180, fade: 500 })]),
  "ember-ascent": preset("Ember ascent", "Burns to embers that drift up and away.", { knockback: 0, ending: "vanish" },
    [fx("burn", look("fire").hit, { duration: 1400 }),
     move("cut", "fragments", { motionEnd: "hold", delay: 300, duration: 2000, pattern: "dust", pieces: 48, behavior: "rise", tint: "charred", spread: 1, spin: 60, drift: 0.3, fade: 700 })]),
  "pixel-delete": preset("Pixel delete", "Erased cell by cell, like a glitch.", { knockback: 0, ending: "vanish" },
    [fx("glitch", look("force").hit, { duration: 900 }),
     move("cut", "fragments", { motionEnd: "hold", delay: 200, duration: 1600, pattern: "pixelate", pieces: 49, spread: 0.5, drift: 0.6, fall: 0.3, fade: 400 })]),
  "turn-to-dust": preset("Turn to dust", "Turned to grey stone, then crumbles from the top into a heap of dust.", { knockback: 0, ending: "vanish" },
    [fx("petrify", ["jb2a.impact.boulder.01", "jb2a.impact.005.dark_white"], { duration: 1000 }),
     move("crumble", "fragments", { motionEnd: "hold", delay: 600, duration: 2200, pattern: "dust", pieces: 56, behavior: "crumble", tint: "stone", spread: 0.3, spin: 40, fade: 900 }),
     fx("puff", ["jb2a.smoke.puff.centered.grey"], { delay: 1900, duration: 1200 })]),
  // One per damage type (FINISHER_BY_DAMAGE_TYPE): the damage's own look round a fragments stage.
  perforated: preset("Perforated", "Punched through; the pieces burst out the far side.", { knockback: 0, ending: "vanish" },
    [fx("pierce", PIERCE, { duration: 700 }),
     move("cut", "fragments", { motionEnd: "hold", delay: 200, duration: 1400, pattern: "perforate", pieces: 4, spread: 1.2, spin: 120, fall: 0.2, fade: 600 }),
     fx("splash", BLOOD, { delay: 350, duration: 1200, offsetX: 0.6, scale: 0.7 })]),
  carved: preset("Carved", "Hacked into strips that slide apart.", { knockback: 0, ending: "vanish" },
    [fx("slash", SLASH, { duration: 700 }),
     move("cut", "fragments", { motionEnd: "hold", delay: 250, duration: 1500, pattern: "slashes", pieces: 3, spread: 0.8, spin: 60, fall: 0.4, fade: 600 }),
     fx("splash", BLOOD, { delay: 400, duration: 1200, scale: 0.7 })]),
  pulverized: preset("Pulverized", "Smashed into the ground and flattened.", { knockback: 0, ending: "vanish" },
    [fx("slam", HIT, { duration: 800 }),
     move("cut", "fragments", { motionEnd: "hold", delay: 150, duration: 1600, pattern: "crush", pieces: 3, behavior: "flatten", spread: 0.6, spin: 20, fade: 700 }),
     fx("crack", CRACK, { delay: 300, duration: 1500, scale: 0.8 })]),
  "bled-out": preset("Bled out", "Opened up; it sags into a pool and is gone.", { knockback: 0, ending: "vanish" },
    [fx("bleed", BLOOD, { duration: 1200 }),
     move("cut", "fragments", { motionEnd: "hold", delay: 300, duration: 2000, pattern: "slashes", pieces: 2, behavior: "sink", spread: 0.3, spin: 10, fade: 800 })]),
  cinders: preset("Cinders", "Burns down to embers that drift up and away.", { knockback: 0, ending: "vanish" },
    [fx("burn", look("fire").hit, { duration: 1400 }),
     move("cut", "fragments", { motionEnd: "hold", delay: 300, duration: 2000, pattern: "dust", pieces: 48, behavior: "rise", tint: "burning", spread: 1, spin: 60, drift: 0.3, fade: 700 }),
     fx("smoke", look("fire").after, { delay: 1500, duration: 1500 })]),
  frostbitten: preset("Frostbitten", "Frozen through; the shards bounce and settle.", { knockback: 0, ending: "vanish" },
    [fx("freeze", look("cold").hit, { duration: 900 }),
     move("cut", "fragments", { motionEnd: "hold", delay: 250, duration: 1600, pattern: "shards", pieces: 8, behavior: "bounce", tint: "frozen", spread: 0.8, spin: 180, fade: 500 }),
     fx("shatter", look("cold").after, { delay: 500 })]),
  thunderstruck: preset("Thunderstruck", "Jolted until it splits along the bolt.", { knockback: 0, ending: "vanish" },
    [fx("shock", look("electricity").death, { duration: 1600 }),
     move("cut", "fragments", { motionEnd: "hold", delay: 200, duration: 1600, pattern: "lightning", behavior: "shudder", tint: "electric", spread: 0.8, spin: 0, fade: 500 }),
     fx("smoke", look("electricity").after, { delay: 1300 })]),
  dissolved: preset("Dissolved", "Eaten away; it runs down in streaks.", { knockback: 0, ending: "vanish" },
    [fx("splash", look("acid").hit, { duration: 1000 }),
     move("cut", "fragments", { motionEnd: "hold", delay: 300, duration: 1800, pattern: "ribbons", pieces: 10, behavior: "drip", tint: "acid", fall: 0.5, fade: 700 }),
     fx("fumes", look("acid").after, { delay: 1200, duration: 1600 })]),
  "shattered-by-sound": preset("Sound shatter", "Shaken by sound until it bursts in rings.", { knockback: 0, ending: "vanish" },
    [fx("wave", look("sonic").hit, { duration: 1200 }),
     move("cut", "fragments", { motionEnd: "hold", delay: 200, duration: 1600, pattern: "rings", pieces: 3, behavior: "shudder", spread: 0.9, spin: 40, fade: 500 }),
     fx("cracks", look("sonic").after, { delay: 900, duration: 1500 })]),
  "blown-apart": preset("Blown apart", "Raw force breaks it into blocks.", { knockback: 0, ending: "vanish" },
    [fx("blast", look("force").death, { duration: 1200 }),
     move("cut", "fragments", { motionEnd: "hold", delay: 150, duration: 1500, pattern: "pixelate", pieces: 36, spread: 0.8, drift: 0.4, fall: 0.3, fade: 400 }),
     fx("ring", look("force").after, { delay: 900 })]),
  consumed: preset("Consumed", "Torn into shadow that streams into the attacker.", { knockback: 0, ending: "vanish" },
    [fx("void", look("void").death, { duration: 1800 }),
     move("cut", "fragments", { motionEnd: "hold", delay: 300, duration: 1800, pattern: "starburst", pieces: 10, behavior: "absorb", tint: "ghost", spread: 1, spin: 90, fade: 500 })]),
  smitten: preset("Smitten", "Burned away by light into rising motes.", { knockback: 0, ending: "vanish" },
    [fx("light", look("vitality").death, { duration: 1800 }),
     move("cut", "fragments", { motionEnd: "hold", delay: 300, duration: 2000, pattern: "dust", pieces: 40, behavior: "rise", tint: "ghost", spread: 1, spin: 30, drift: 0.2, fade: 700 }),
     fx("stars", look("vitality").after, { delay: 1500 })]),
  unraveled: preset("Unraveled", "The mind breaks; it glitches out of being.", { knockback: 0, ending: "vanish" },
    [fx("mind", look("mental").hit, { duration: 1000 }),
     move("cut", "fragments", { motionEnd: "hold", delay: 200, duration: 1400, pattern: "pixelate", pieces: 25, behavior: "glitch", spread: 0.5, fade: 400 })]),
  withered: preset("Withered", "Poison rots it to dust that sinks away.", { knockback: 0, ending: "vanish" },
    [fx("toxin", look("poison").death, { duration: 1600 }),
     move("cut", "fragments", { motionEnd: "hold", delay: 300, duration: 2000, pattern: "dust", pieces: 40, behavior: "sink", tint: "poison", spread: 0.3, spin: 10, fade: 800 })]),
};

export function presetFinisher(id, newId) {
  const p = FINISHER_PRESETS[id] ?? FINISHER_PRESETS.fall;
  return validateRecipe({ ...p.build(), id: newId });
}

// The built-in finisher for each damage type, by its normalized name (normalizeDamageType already
// folds positive into vitality and negative into void).
export const FINISHER_BY_DAMAGE_TYPE = Object.freeze({
  piercing: "perforated", slashing: "carved", bludgeoning: "pulverized", bleed: "bled-out",
  fire: "cinders", cold: "frostbitten", electricity: "thunderstruck", acid: "dissolved",
  sonic: "shattered-by-sound", force: "blown-apart", void: "consumed", vitality: "smitten", spirit: "smitten",
  mental: "unraveled", poison: "withered",
});
// The "Default finisher for other kills" value that plays the killing blow's damage-type finisher.
export const BY_DAMAGE_TYPE = "by-damage-type";
// That damage type's preset as a finisher with a stable id (builtin-<preset>), or null.
export function damageTypeFinisher(type) {
  const key = normalizeDamageType(type);
  if (!Object.hasOwn(FINISHER_BY_DAMAGE_TYPE, key)) return null;
  const id = FINISHER_BY_DAMAGE_TYPE[key];
  return Object.hasOwn(FINISHER_PRESETS, id) ? presetFinisher(id, `builtin-${id}`) : null;
}

// Daggerheart's "By damage type": physical by the killing weapon's family, magical by the card's domain
// (daggerheartDamageType), then that type's preset. Its damage log already stores this type, so the
// kill path's damageTypeFinisher reaches the same preset.
export const daggerheartDamageFinisher = ({ type, item = null, itemName = null } = {}) => damageTypeFinisher(daggerheartDamageType({ type, item, itemName }));
