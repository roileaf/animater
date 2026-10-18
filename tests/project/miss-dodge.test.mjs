import test from "node:test";
import assert from "node:assert/strict";
import { withOutcome, meleeClip, meleeHit } from "../../scripts/systems/outcome.mjs";
import { validateRecipe, planRecipe } from "../../scripts/core/model.mjs";
import { timedStages } from "../../scripts/engines/playback/composition.mjs";
import { applyEffectOptions } from "../../scripts/core/stage-options.mjs";

const bolt = () => validateRecipe({ id: "bolt", name: "Bolt", trigger: "attack", stages: [
  { stageId: "c", kind: "cast", assets: ["jb2a.a"], duration: 600 },
  { stageId: "t", kind: "travel", assets: ["jb2a.b"], afterStage: "c", duration: 1500, contact: 900 },
  { stageId: "i", kind: "impact", assets: ["jb2a.c"], afterStage: "t", timingAnchor: "arrival" },
] });
const sword = () => validateRecipe({ id: "sword", name: "Sword", trigger: "attack", stages: [
  { stageId: "lunge", kind: "motion", motion: "lunge", subject: "source", assets: [], duration: 1250 },
  { stageId: "contact", kind: "impact", assets: ["jb2a.sword.melee.01.white"], delay: 625, duration: 1400 },
  { stageId: "accent", kind: "impact", assets: ["jb2a.impact.fire.01"], afterStage: "contact", timingAnchor: "start", startOffset: 180 },
  { stageId: "swish", kind: "sound", soundFile: "swing.ogg", afterStage: "contact", timingAnchor: "start", assets: [] },
] });
const dodgeOf = (r) => r.stages.find((s) => s.kind === "motion" && s.subject === "targets");

test("melee weapon clips are recognised by their JB2A key", () => {
  for (const key of ["jb2a.sword.melee.01.white", "jb2a.melee_attack.03.greataxe.02.white", "jb2a.unarmed_strike.physical.01.blue", "jb2a.greataxe.melee.standard.white"])
    assert.ok(meleeClip(key), key);
  for (const key of ["jb2a.impact.fire.01", "jb2a.arrow.physical.white", "jb2a.explosion.01", "jb2a.xmeleex.01", "", undefined]) assert.ok(!meleeClip(key), String(key));
});

test("a missed flight: the target dodges as the shot arrives", () => {
  const out = validateRecipe(withOutcome(bolt(), { outcome: "failure", type: "attack", messageId: "m1" }));
  const dodge = dodgeOf(out);
  assert.equal(dodge?.motion, "dodge");
  assert.equal(dodge.optionalTargets, true);
  const arrival = 600 + 900;
  const at = timedStages(out).find((s) => s.stageId === dodge.stageId).delay;
  assert.ok(at < arrival && at > arrival - 400, `dodge starts just before arrival (${at})`);
  assert.ok(!out.stages.some((s) => s.kind === "impact"), "nothing lands");
});

test("a missed melee strike: the swing still cuts the air while the target sidesteps it", () => {
  const out = validateRecipe(withOutcome(sword(), { outcome: "failure", type: "attack", messageId: "m2" }));
  assert.deepEqual(out.stages.filter((s) => s.kind !== "motion").map((s) => s.stageId), ["contact", "swish"]);
  const at = timedStages(out).find((s) => s.stageId === dodgeOf(out).stageId).delay;
  const hit = 625 + 1400 * meleeHit("jb2a.sword.melee.01.white");
  assert.ok(at > 625 && at < hit && hit - at < 300, `dodge starts as the blow comes in, not with the clip (${at}, hit ${hit})`);
});

test("a fumble dodges too, and the attacker still stumbles", () => {
  const out = validateRecipe(withOutcome(sword(), { outcome: "criticalFailure", type: "attack" }));
  assert.ok(dodgeOf(out));
  assert.ok(out.stages.some((s) => s.stageId === "fumble"));
});

test("dodge side follows the message, so every client sees the same side", () => {
  const side = (id) => dodgeOf(withOutcome(bolt(), { outcome: "failure", type: "attack", messageId: id })).motionSide;
  assert.equal(side("abc"), side("abc"));
  assert.ok(new Set(["a", "b", "c", "d", "e", "f", "g", "h"].map(side)).size === 2, "both sides occur");
});

test("a recipe that already has its own target dodge keeps it", () => {
  const r = validateRecipe({ ...bolt(), stages: [...bolt().stages, { stageId: "own", kind: "motion", motion: "dodge", subject: "targets", assets: [] }] });
  const out = withOutcome(r, { outcome: "failure", type: "attack" });
  assert.deepEqual(out.stages.filter((s) => s.kind === "motion" && s.subject === "targets").map((s) => s.stageId), ["own"]);
});

test("hits, damage and use events never dodge", () => {
  for (const [outcome, type] of [["success", "attack"], ["criticalSuccess", "attack"], ["failure", "damage"]])
    assert.ok(!withOutcome(sword(), { outcome, type }).stages.some((s) => s.motion === "dodge"), `${outcome} ${type}`);
});

const db = [
  { key: "jb2a.sword.melee.01.white", label: "Sword", kind: "impact", width: 800, height: 600 },
  { key: "jb2a.impact.fire.01", label: "Fire", kind: "impact", width: 400, height: 400 },
];
const target = { id: "t", center: { x: 500, y: 100 }, w: 100, h: 100 };

test("a melee swing plays from the attacker, turned toward the target", () => {
  for (const source of [{ id: "s", center: { x: 100, y: 100 } }, { id: "s", center: { x: 900, y: 100 } }]) {
    const plan = planRecipe(sword(), db, { source, targets: [target], gridSize: 100, preview: true });
    const swing = plan.find((s) => s.stageId === "contact"), accent = plan.find((s) => s.stageId === "accent");
    assert.equal(swing.meleeFrom, source, "starts at the wielder (JB2A melee clips are drawn from there)");
    assert.equal(swing.facing, target);
    assert.equal(Boolean(swing.facingMirror), target.center.x < source.center.x, "kept blade-up when it swings leftward");
    assert.ok(!accent.facing && !accent.meleeFrom, "a plain impact stays on the target");
  }
});

test("a leftward swing is mirrored on top of the stage's own mirroring", () => {
  const calls = [];
  const effect = new Proxy({}, { get: (_, name) => (...args) => { calls.push([name, ...args]); return effect; } });
  applyEffectOptions(effect, { kind: "impact", duration: 1000, rotation: -25, facingMirror: true });
  assert.deepEqual(calls.find((c) => c[0] === "rotate"), ["rotate", -25]);
  assert.ok(calls.some((c) => c[0] === "mirrorY" && c[1] === true));
});

test("each JB2A melee family lands its blow at its own measured moment", () => {
  assert.equal(meleeHit("jb2a.sword.melee.01.white"), 0.47);
  assert.equal(meleeHit("jb2a.greataxe.melee.standard.white"), 0.63);
  assert.equal(meleeHit("jb2a.melee_attack.03.greataxe.02.white"), 0.39);
  assert.equal(meleeHit("jb2a.unarmed_strike.physical.01.blue"), 0.43);
  assert.equal(meleeHit("jb2a.unknown_blade.melee.01"), 0.5);
});
