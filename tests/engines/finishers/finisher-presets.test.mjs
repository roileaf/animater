import test from "node:test";
import assert from "node:assert/strict";
import { FINISHER_PRESETS, presetFinisher } from "../../../scripts/engines/finishers/finisher-presets.mjs";
import { motionPose } from "../../../scripts/engines/motion/motion.mjs";
import { installedAssets } from "../../../scripts/core/model.mjs";
import { finisherTravelPath } from "../../../scripts/engines/finishers/finisher-model.mjs";
import { assetDatabases } from "../../../tools/asset-databases.mjs";

const IDS = ["launch", "cleave", "skewer", "struck-down", "ash", "shatter", "jolt", "blast", "wall-slam", "unmade", "melt", "ascend", "shaken-apart", "soul-departs", "fall", "slice-in-half", "bisect", "shatter-shards", "disintegrate", "sky-launch", "ragdoll-tumble", "vortex-spiral", "pancake", "diced", "claw-shred", "soul-drain", "frozen-shatter", "ember-ascent", "pixel-delete", "turn-to-dust",
  "perforated", "carved", "pulverized", "bled-out", "cinders", "frostbitten", "thunderstruck", "dissolved", "shattered-by-sound", "blown-apart", "consumed", "smitten", "unraveled", "withered"];

test("every preset is a valid kill finisher the GM can save as their own", () => {
  assert.deepEqual(Object.keys(FINISHER_PRESETS), IDS);
  for (const id of IDS) {
    const r = presetFinisher(id, `mine-${id}`);
    assert.equal(r.id, `mine-${id}`);
    assert.equal(r.category, "Finisher");
    assert.equal(r.trigger, "manual");
    assert.equal(r.finisher.on, "kill");
    assert.ok(r.stages.some((s) => s.kind === "motion" && s.subject === "targets"), `${id} moves the real target token`);
    assert.ok(r.stages.length <= 16, id);
  }
});

test("flinging presets travel on a held keyframed path that lands upright", () => {
  for (const id of ["launch", "skewer", "struck-down", "jolt", "blast", "wall-slam"]) {
    const r = presetFinisher(id, id), path = finisherTravelPath(r);
    assert.ok(path, `${id} has a held travel path`);
    const end = path.keyframes.at(-1);
    assert.ok(Math.round(Math.max(Math.abs(end.x), Math.abs(end.y))) > 0, `${id} travels`);
    assert.equal(((end.rotation % 360) + 360) % 360, 0, `${id} lands upright`);
    assert.deepEqual([end.scale, end.alpha], [1, 1], `${id} lands at full size, visible`);
  }
});

test("vanishing presets shrink or fade in place and stay gone until hidden", () => {
  for (const id of ["ash", "shatter", "unmade", "melt", "ascend", "shaken-apart"]) {
    const r = presetFinisher(id, id), path = finisherTravelPath(r);
    assert.equal(r.finisher.ending, "vanish", id);
    assert.ok(path, `${id} has a held path`);
    assert.equal(Math.round(Math.max(Math.abs(path.keyframes.at(-1).x), Math.abs(path.keyframes.at(-1).y))), 0, `${id} stays in place`);
    assert.equal(path.keyframes.at(-1).alpha, 0, `${id} ends invisible`);
  }
});

test("every preset effect resolves in JB2A Patreon", async () => {
  const db = await assetDatabases();
  for (const id of IDS)
    for (const s of presetFinisher(id, id).stages.filter((s) => !["motion", "sound"].includes(s.kind)))
      assert.ok(installedAssets(s, db.patreon).length, `${id}/${s.stageId}: ${s.assets.join(", ")}`);
});

test("Wall slam flies 6 squares, slams into a wall that stops it, and crashes there", () => {
  const r = presetFinisher("wall-slam", "ws"), path = finisherTravelPath(r);
  assert.equal(r.finisher.wall, "slam");
  assert.equal(r.finisher.ending, "body");
  assert.equal(path.keyframes.at(-1).x, 6);
  assert.deepEqual(r.stages.filter((s) => s.stageId.startsWith("wall")).map((s) => s.stageId), ["wall-crack", "wall-squash", "wall-dust"]);
  assert.ok(r.stages.some((s) => s.stageId === "landing"), "lands hard when nothing stops it");
});

test("Wall slam stretches mid-flight, lands unstretched and squashes on the wall", () => {
  const r = presetFinisher("wall-slam", "ws"), path = finisherTravelPath(r);
  assert.ok(path.keyframes.some((k) => k.stretch > 0), "stretched in flight");
  assert.equal(path.keyframes.find((k) => k.at === 0.6).stretch, 0.22);
  assert.equal(path.keyframes.at(-1).stretch, 0, "lands unstretched");
  const squash = r.stages.find((s) => s.stageId === "wall-squash");
  assert.deepEqual([squash.kind, squash.motion, squash.duration, squash.intensity, squash.subject], ["motion", "squash", 450, 1.2, "targets"]);
  assert.equal(r.stages.find((s) => s.stageId === "wall-crack").scale, 0.8);
  assert.equal(r.stages.some((s) => s.stageId === "wall-shake"), false);
});

test("the creative presets use fragments or keyframed paths as designed", () => {
  for (const id of ["slice-in-half", "bisect", "shatter-shards", "disintegrate"]) {
    const r = presetFinisher(id, id), cut = r.stages.find((s) => s.motion === "fragments");
    assert.ok(cut && cut.motionEnd === "hold" && cut.subject === "targets", id);
    assert.equal(r.finisher.ending, "vanish", id);
  }
  assert.deepEqual(["slice-in-half", "bisect", "shatter-shards", "disintegrate"].map((id) => presetFinisher(id, id).stages.find((s) => s.motion === "fragments").pattern), ["halves", "topBottom", "shards", "dust"]);
  const sky = finisherTravelPath(presetFinisher("sky-launch", "s"));
  assert.equal(sky.keyframes.at(-1).alpha, 0);
  const rag = finisherTravelPath(presetFinisher("ragdoll-tumble", "r"));
  assert.ok(rag.keyframes.filter((k) => k.sharp).length >= 3, "three bounces");
  assert.deepEqual([rag.keyframes.at(-1).rotation % 360, rag.keyframes.at(-1).scale, rag.keyframes.at(-1).stretch], [0, 1, 0], "lands upright");
  const vortex = finisherTravelPath(presetFinisher("vortex-spiral", "v")).keyframes;
  assert.deepEqual([vortex.at(-1).x, vortex.at(-1).y, vortex.at(-1).alpha], [0, 0, 0]);
  assert.ok(vortex.length >= 8);
  const pancake = finisherTravelPath(presetFinisher("pancake", "p")).keyframes.at(-1);
  assert.equal(pancake.stretch, -0.6);
  assert.equal(presetFinisher("pancake", "p").finisher.ending, "body");
});

// One fluid motion per preset: the stage's pathEase shapes the speed, the keyframes are linear.
const PATH_EASES = { launch: "easeOutQuad", skewer: "easeOutCubic", "struck-down": "easeOutCubic", ash: "easeInQuad", shatter: "linear", jolt: "easeOutQuad", blast: "easeOutCubic",
  "wall-slam": "easeOutCubic", unmade: "easeInQuad", melt: "easeInQuad", ascend: "easeInOutQuad", "shaken-apart": "linear", "sky-launch": "easeInQuad", "ragdoll-tumble": "linear", "vortex-spiral": "easeInQuad", pancake: "linear" };
test("every preset path is one fluid motion: a whole-path ease over linear keyframes", () => {
  assert.deepEqual(IDS.filter((id) => finisherTravelPath(presetFinisher(id, id))), Object.keys(PATH_EASES), "every path preset is listed");
  for (const [id, ease] of Object.entries(PATH_EASES)) {
    const path = finisherTravelPath(presetFinisher(id, id));
    assert.equal(path.pathEase, ease, id);
    if (id === "ragdoll-tumble") continue;
    // Pancake's squash keeps its overshoot into the floor.
    const eases = path.keyframes.map((k) => k.ease), expected = eases.map((_, i) => (id === "pancake" && i === eases.length - 1 ? "easeOutBack" : "linear"));
    assert.deepEqual(eases, expected, id);
  }
});

test("Ragdoll tumble slows deliberately at each bounce: easing out into each apex, in to each landing", () => {
  const k = finisherTravelPath(presetFinisher("ragdoll-tumble", "r")).keyframes;
  const inner = k.slice(1, -1);
  assert.deepEqual(inner.map((kf) => [kf.sharp, kf.ease]), inner.map((kf) => (kf.sharp ? [true, "easeInQuad"] : [false, "easeOutQuad"])));
  assert.equal(inner.filter((kf) => kf.sharp).length, 3, "three landings");
  assert.equal(inner.filter((kf) => !kf.sharp).length, 3, "three apexes");
});

test("Pancake squashes over its whole stage: linear path, overshoot only on the last keyframe", () => {
  const path = finisherTravelPath(presetFinisher("pancake", "p"));
  assert.equal(path.pathEase, "linear");
  assert.equal(path.keyframes.at(-1).ease, "easeOutBack");
  const mid = motionPose(path, 0.5), late = motionPose(path, 0.99);
  assert.notDeepEqual(mid, late, "the squash is still progressing mid-stage");
});

import { prepareFragments } from "../../../scripts/engines/fragments/fragments.mjs";
import { FINISHER_PRESET_GROUPS } from "../../../scripts/ui/finisher-ui.mjs";

test("the fragments v2 presets: one hit and one held fragments stage each, as designed", () => {
  const want = {
    diced: ["diced", "burst", "none", 4], "claw-shred": ["claw", "burst", "none", 4], "soul-drain": ["starburst", "absorb", "ghost", 10],
    "frozen-shatter": ["shards", "bounce", "frozen", 8], "ember-ascent": ["dust", "rise", "charred", 48], "pixel-delete": ["pixelate", "burst", "none", 49],
  };
  for (const [id, [pattern, behavior, tint, pieces]] of Object.entries(want)) {
    const r = presetFinisher(id, id), cuts = r.stages.filter((s) => s.motion === "fragments");
    assert.equal(cuts.length, 1, id);
    const cut = prepareFragments(cuts[0]);
    assert.deepEqual([cut.pattern, cut.behavior, cut.tint, cut.pieces, cuts[0].motionEnd, cuts[0].subject], [pattern, behavior, tint, pieces, "hold", "targets"], id);
    assert.deepEqual([r.trigger, r.finisher.ending, r.finisher.knockback], ["manual", "vanish", 0], id);
    assert.equal(r.stages.filter((s) => s.kind === "impact").length, 1, `${id}: one hit`);
    assert.equal(FINISHER_PRESET_GROUPS.Pieces.filter((p) => p === id).length, 1, `${id} is in Pieces once`);
  }
  const diced = prepareFragments(presetFinisher("diced", "d").stages.find((s) => s.motion === "fragments"));
  assert.deepEqual([diced.spin, diced.fall], [200, 0.6]);
});

test("Turn to dust: petrified grey, crumbles top-down into a heap of dust, then a last puff", () => {
  const r = presetFinisher("turn-to-dust", "t");
  assert.equal(FINISHER_PRESETS["turn-to-dust"].name, "Turn to dust");
  assert.deepEqual([r.trigger, r.finisher.ending, r.finisher.knockback], ["manual", "vanish", 0]);
  assert.deepEqual(r.stages.map((s) => s.stageId), ["petrify", "crumble", "puff"]);
  const [petrify, cut, puff] = r.stages;
  assert.equal(petrify.kind, "impact");
  const n = prepareFragments(cut);
  assert.deepEqual([n.pattern, n.pieces, n.behavior, n.tint, n.spread, n.spin, n.fade], ["dust", 56, "crumble", "stone", 0.3, 40, 900]);
  assert.deepEqual([cut.motionEnd, cut.subject, cut.delay, cut.duration], ["hold", "targets", 600, 2200]);
  assert.deepEqual([puff.kind, puff.assets, puff.delay], ["impact", ["jb2a.smoke.puff.centered.grey"], 1900]);
  assert.equal(Object.values(FINISHER_PRESET_GROUPS).flat().filter((id) => id === "turn-to-dust").length, 1);
  assert.ok(FINISHER_PRESET_GROUPS.Pieces.includes("turn-to-dust"), "in Pieces");
});

import { FINISHER_BY_DAMAGE_TYPE, BY_DAMAGE_TYPE, damageTypeFinisher } from "../../../scripts/engines/finishers/finisher-presets.mjs";

const DAMAGE_PRESETS = {
  perforated: ["Perforated", "perforate", "burst", "none", 4], carved: ["Carved", "slashes", "burst", "none", 3], pulverized: ["Pulverized", "crush", "flatten", "none", 3],
  "bled-out": ["Bled out", "slashes", "sink", "none", 2], cinders: ["Cinders", "dust", "rise", "burning", 48], frostbitten: ["Frostbitten", "shards", "bounce", "frozen", 8],
  thunderstruck: ["Thunderstruck", "lightning", "shudder", "electric", 2], dissolved: ["Dissolved", "ribbons", "drip", "acid", 10], "shattered-by-sound": ["Sound shatter", "rings", "shudder", "none", 3],
  "blown-apart": ["Blown apart", "pixelate", "burst", "none", 36], consumed: ["Consumed", "starburst", "absorb", "ghost", 10], smitten: ["Smitten", "dust", "rise", "ghost", 40],
  unraveled: ["Unraveled", "pixelate", "glitch", "none", 25], withered: ["Withered", "dust", "sink", "poison", 40],
};

test("the damage-type presets: one held fragments stage each, vanishing in place, in Pieces once", () => {
  for (const [id, [name, pattern, behavior, tint, pieces]] of Object.entries(DAMAGE_PRESETS)) {
    const r = presetFinisher(id, id), cuts = r.stages.filter((s) => s.motion === "fragments");
    assert.equal(FINISHER_PRESETS[id].name, name, id);
    assert.equal(cuts.length, 1, id);
    const cut = prepareFragments(cuts[0]);
    assert.deepEqual([cut.pattern, cut.behavior, cut.tint, cut.pieces, cuts[0].motionEnd, cuts[0].subject], [pattern, behavior, tint, pieces, "hold", "targets"], id);
    assert.deepEqual([r.trigger, r.finisher.on, r.finisher.ending, r.finisher.knockback, r.finisher.success], ["manual", "kill", "vanish", 0, "success"], id);
    assert.ok(r.stages.some((s) => s.kind === "impact"), `${id}: a hit`);
    assert.equal(Object.values(FINISHER_PRESET_GROUPS).flat().filter((p) => p === id).length, 1, `${id} is in one group`);
    assert.ok(FINISHER_PRESET_GROUPS.Pieces.includes(id), `${id} is in Pieces`);
  }
  const blood = (id) => presetFinisher(id, id).stages.some((s) => s.assets?.some((a) => a.startsWith("jb2a.liquid.splash")));
  assert.ok(["perforated", "carved", "bled-out"].every(blood), "the bleeding ones splash blood");
  assert.equal(presetFinisher("perforated", "p").stages.find((s) => s.stageId === "splash").offsetX, 0.6, "the splash lands on the far side");
});

test("FINISHER_BY_DAMAGE_TYPE maps every damage type to an existing preset", () => {
  assert.ok(Object.isFrozen(FINISHER_BY_DAMAGE_TYPE));
  assert.deepEqual(FINISHER_BY_DAMAGE_TYPE, {
    piercing: "perforated", slashing: "carved", bludgeoning: "pulverized", bleed: "bled-out", fire: "cinders", cold: "frostbitten", electricity: "thunderstruck", acid: "dissolved",
    sonic: "shattered-by-sound", force: "blown-apart", void: "consumed", vitality: "smitten", spirit: "smitten", mental: "unraveled", poison: "withered",
  });
  for (const id of Object.values(FINISHER_BY_DAMAGE_TYPE)) assert.ok(FINISHER_PRESETS[id], id);
  assert.deepEqual([...new Set(Object.values(FINISHER_BY_DAMAGE_TYPE))].sort(), Object.keys(DAMAGE_PRESETS).sort(), "every damage preset is reachable");
  assert.equal(BY_DAMAGE_TYPE, "by-damage-type");
});

// Review focus: systems spell damage types their own way.
test("damageTypeFinisher folds names and aliases, and answers null for anything else", () => {
  const id = (type) => damageTypeFinisher(type)?.id ?? null;
  assert.equal(id("piercing"), "builtin-perforated");
  assert.equal(id("Fire"), "builtin-cinders");
  assert.equal(id(" SLASHING "), "builtin-carved");
  assert.equal(id("positive"), "builtin-smitten");
  assert.equal(id("negative"), "builtin-consumed");
  assert.equal(id("lightning"), "builtin-thunderstruck");
  assert.equal(id("psychic"), "builtin-unraveled");
  for (const bad of ["untyped", "", null, undefined, "__proto__", "constructor", "toString"]) assert.equal(id(bad), null, String(bad));
  const r = damageTypeFinisher("fire");
  assert.deepEqual([r.name, r.finisher.on, r.finisher.success, r.enabled !== false], ["Cinders", "kill", "success", true]);
  assert.deepEqual(damageTypeFinisher("fire"), r, "the same recipe every time");
});
