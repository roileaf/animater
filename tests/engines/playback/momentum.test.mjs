import test from "node:test";
import assert from "node:assert/strict";
import { createMomentum, multiplier, applyMomentum, applyStrain, strikeOf, STRAINED_RATE } from "../../../scripts/engines/playback/momentum.mjs";

const hit = (id, extra = {}) => ({ type: "attack", id: `chat:${id}`, messageId: id, systemId: "pf2e", outcome: "success", item: { type: "weapon" },
  source: { id: "a" }, targets: [{ id: "t" }], automatic: true, ...extra });
const miss = (id, extra = {}) => hit(id, { outcome: "failure", ...extra });

test("multiplier: 1st hit plain, then x1.1, x1.2, x1.3 and no higher", () => {
  assert.deepEqual([0, 1, 2, 3, 4, 7].map(multiplier), [1, 1, 1.1, 1.2, 1.3, 1.3]);
});

test("consecutive hits on the same target in one turn build momentum; a miss resets it", () => {
  const m = createMomentum({ now: () => 0, turnKey: () => "c:1:0" });
  assert.deepEqual([1, 2, 3, 4, 5].map((n) => m.observe(hit(`m${n}`)).factor), [1, 1.1, 1.2, 1.3, 1.3]);
  assert.equal(m.observe(miss("x")).factor, 1);
  assert.equal(m.observe(hit("after")).factor, 1, "the streak starts over");
  assert.equal(m.observe(hit("after2")).factor, 1.1);
});

test("streaks are per attacker and per target", () => {
  const m = createMomentum({ now: () => 0, turnKey: () => "c:1:0" });
  m.observe(hit("1"));
  assert.equal(m.observe(hit("2", { targets: [{ id: "other" }] })).factor, 1, "another target");
  assert.equal(m.observe(hit("3", { source: { id: "b" } })).factor, 1, "another attacker");
  assert.equal(m.observe(hit("4")).factor, 1.1, "the first pair still holds its streak");
});

test("a new turn ends the streak; outside combat it lasts 12 s", () => {
  let turn = "c:1:0", t = 0;
  const m = createMomentum({ now: () => t, turnKey: () => turn });
  m.observe(hit("1"));
  turn = "c:1:1";
  assert.equal(m.observe(hit("2")).factor, 1);
  turn = null;
  m.observe(hit("3"));
  t = 11000;
  assert.equal(m.observe(hit("4")).factor, 1.1, "within 12 s");
  t = 24000;
  assert.equal(m.observe(hit("5")).factor, 1, "too late");
});

test("one attack counts once: riders and replays of the same message share its level", () => {
  const m = createMomentum({ now: () => 0, turnKey: () => "c:1:0" });
  m.observe(hit("1"));
  assert.equal(m.observe(hit("2")).factor, 1.1);
  assert.equal(m.observe(hit("2")).factor, 1.1, "same message again");
  assert.equal(m.observe(hit("3")).factor, 1.2);
});

test("the damage of a strike plays at the level its attack reached, without counting", () => {
  const m = createMomentum({ now: () => 0, turnKey: () => "c:1:0" });
  m.observe(hit("1"));
  m.observe(hit("2"));
  const damage = { ...hit("d2"), type: "damage" };
  assert.equal(m.observe(damage).factor, 1.1);
  assert.equal(m.observe({ ...damage, id: "chat:d2b", messageId: "d2b" }).factor, 1.1, "damage never builds a streak");
  assert.equal(m.observe(hit("3")).factor, 1.2);
});

test("a hidden result neither builds nor resets the streak", () => {
  const m = createMomentum({ now: () => 0, turnKey: () => "c:1:0" });
  m.observe(hit("1"));
  assert.equal(m.observe(hit("h", { outcome: "hidden" })).factor, 1);
  assert.equal(m.observe(hit("2")).factor, 1.1);
});

test("per-target outcomes: only the targets hit gain momentum", () => {
  const m = createMomentum({ now: () => 0, turnKey: () => "c:1:0" });
  const both = { targets: [{ id: "t" }, { id: "u" }], outcome: undefined };
  m.observe(hit("1", { ...both, targetOutcomes: { t: "success", u: "success" } }));
  const r = m.observe(hit("2", { ...both, targetOutcomes: { t: "failure", u: "criticalSuccess" } }));
  assert.equal(r.factor, 1.1);
  assert.equal(m.observe(hit("3", { targets: [{ id: "t" }] })).factor, 1, "t's miss reset its streak");
});

test("a reroll replaces the attack it rerolls instead of counting again", () => {
  const m = createMomentum({ now: () => 0, turnKey: () => "c:1:0" });
  m.observe(hit("1"));
  m.observe(miss("2"));
  assert.equal(m.observe(hit("2r", { reroll: "hero-point" })).factor, 1.1, "the rerolled miss no longer broke the streak");
  assert.equal(m.observe(hit("3")).factor, 1.2);
});

test("PF2e strained strike: a 3rd Strike in a turn that misses", () => {
  const m = createMomentum({ now: () => 0, turnKey: () => "c:1:0" });
  assert.equal(m.observe(miss("1")).strained, false);
  assert.equal(m.observe(miss("2", { targets: [{ id: "u" }] })).strained, false);
  assert.equal(m.observe(miss("3")).strained, true, "the 3rd Strike, whatever its target");
  assert.equal(m.observe(hit("4")).strained, false, "a hit is not strained");
});

test("strained: the multiple attack penalty from the roll wins over the count", () => {
  const m = createMomentum({ now: () => 0, turnKey: () => "c:1:0" });
  assert.equal(m.observe(miss("1", { mapIncreases: 2 })).strained, true);
  m.observe(miss("2"));
  assert.equal(m.observe(miss("3", { mapIncreases: 0 })).strained, false, "a fresh MAP is not strained");
});

test("strained: PF2e and SF2e Strikes only", () => {
  const m = createMomentum({ now: () => 0, turnKey: () => "c:1:0" });
  assert.equal(m.observe(miss("1", { systemId: "dnd5e", mapIncreases: 2 })).strained, false);
  assert.equal(m.observe(miss("2", { systemId: "sf2e", mapIncreases: 2 })).strained, true);
  assert.equal(m.observe(miss("3", { item: { type: "spell" }, mapIncreases: 2 })).strained, false, "a spell attack is no Strike");
});

test("only attack and damage plays count", () => {
  const m = createMomentum({ now: () => 0, turnKey: () => "c:1:0" });
  assert.deepEqual(m.observe({ ...hit("u"), type: "use" }), { factor: 1, strained: false });
  assert.deepEqual(m.observe({ type: "attack", outcome: "success" }), { factor: 1, strained: false }, "no attacker");
});

test("strikeOf reads attacker and targets from tokens, ids or uuids", () => {
  assert.deepEqual(strikeOf({ source: { document: { id: "a" } }, targets: [{ document: { id: "t" } }], outcome: "success" }),
    { attacker: "a", targets: [{ id: "t", outcome: "success" }] });
  assert.deepEqual(strikeOf({ tokenId: "a", targetUuid: "Scene.s.Token.t", outcome: "failure" }),
    { attacker: "a", targets: [{ id: "t", outcome: "failure" }] });
});

test("applyMomentum scales impacts and sound (capped at 1); x1 leaves the recipe", () => {
  const recipe = { stages: [
    { stageId: "i", kind: "impact", scale: 1.35 }, { stageId: "s", kind: "sound", volume: 0.5 },
    { stageId: "l", kind: "sound", volume: 0.95 }, { stageId: "m", kind: "motion", subject: "targets", intensity: 0.5 },
  ] };
  assert.equal(applyMomentum(recipe, 1), recipe);
  const out = applyMomentum(recipe, 1.2);
  assert.ok(Math.abs(out.stages[0].scale - 1.62) < 1e-9);
  assert.ok(Math.abs(out.stages[1].volume - 0.6) < 1e-9);
  assert.equal(out.stages[2].volume, 1);
  assert.deepEqual(out.stages[3], recipe.stages[3]);
  assert.equal(recipe.stages[0].scale, 1.35, "never mutates");
});

test("applyStrain slows the attacker's gesture and adds a small stumble after it", () => {
  const recipe = { stages: [
    { stageId: "lunge", kind: "motion", motion: "lunge", subject: "source", delay: 0, duration: 850 },
    { stageId: "dodge", kind: "motion", motion: "dodge", subject: "targets", duration: 700 },
  ] };
  const out = applyStrain(recipe);
  assert.ok(Math.abs(out.stages[0].duration - 850 / STRAINED_RATE) < 1);
  assert.equal(out.stages[1].duration, 700);
  const stumble = out.stages.find((s) => s.stageId === "strained-stumble");
  assert.equal(stumble.motion, "stagger");
  assert.equal(stumble.subject, "source");
  assert.equal(stumble.afterStage, "lunge");
  assert.ok(stumble.distance < 0.16 && stumble.intensity < 0.6, "smaller than a fumble");
  // A fumble already staggers the attacker: no second stumble.
  const fumbled = applyStrain({ stages: [{ stageId: "fumble", kind: "motion", motion: "stagger", subject: "source", delay: 450, duration: 900 }] });
  assert.equal(fumbled.stages.length, 1);
  assert.ok(fumbled.stages[0].duration > 900);
  // No gesture: the stumble plays on its own.
  const bare = applyStrain({ stages: [{ stageId: "i", kind: "impact", subject: "source", delay: 0, duration: 500 }] });
  assert.equal(bare.stages.at(-1).stageId, "strained-stumble");
  assert.ok(!bare.stages.at(-1).afterStage);
});

test("PF2e attack events carry the Strike's multiple attack penalty step", async () => {
  const { pf2eEvent, mapIncreasesOf } = await import("../../../scripts/systems/adapters.mjs");
  assert.equal(mapIncreasesOf(["item:melee", "map:increases:2"]), 2);
  assert.equal(mapIncreasesOf(["item:melee"]), null);
  const message = (options, type = "attack-roll") => ({ id: "m", author: { id: "u" }, item: { type: "weapon" }, flags: { pf2e: { context: { type, options } } } });
  assert.equal(pf2eEvent(message(["map:increases:1"]), "u").mapIncreases, 1);
  assert.equal("mapIncreases" in pf2eEvent(message([]), "u"), false);
});
