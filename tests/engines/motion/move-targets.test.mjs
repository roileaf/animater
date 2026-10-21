import test from "node:test";
import assert from "node:assert/strict";
import { moveOptions, hitsTarget, pullReach, shoveRecipe, playMoveStage, previewMotion, isMoveStage, allowedSpot, movePrompt, moveCone } from "../../../scripts/engines/motion/move-targets.mjs";
import { planFinisher } from "../../../scripts/engines/finishers/finisher-play.mjs";
import { validateRecipe, planRecipe } from "../../../scripts/core/model.mjs";

const token = (id, x, y, size = 1) => ({ id, name: id, center: { x: x * 100 + size * 50, y: y * 100 + size * 50 }, w: size * 100, h: size * 100, document: { x: x * 100, y: y * 100, width: size, height: size } });
const stage = (motion, extra = {}) => ({ kind: "motion", motion, stageId: motion, subject: "targets", ...extra });

test("Push and Pull are timeline stages: saved with their squares and who chooses, always on the targets", () => {
  const saved = validateRecipe({ id: "eb", name: "Eldritch Blast", trigger: "attack", stages: [
    { stageId: "hit", kind: "impact", assets: ["jb2a.eldritch_blast.purple"], subject: "targets", delay: 0, duration: 1200 },
    { stageId: "shove", kind: "motion", motion: "push", subject: "source", squares: 40, moveAsk: "target", requiresHit: true, afterStage: "hit", timingAnchor: "start", startOffset: 300, duration: 600 }] });
  const push = saved.stages.find((s) => s.stageId === "shove");
  assert.equal(push.subject, "targets", "it moves the targets, never the one who acted");
  assert.equal(push.squares, 10);
  assert.equal(push.moveAsk, "target");
  // It sits on the timeline like any stage: 300 ms after the blast starts.
  const plan = planRecipe(saved, [{ key: "jb2a.eldritch_blast.purple" }], { source: token("me", 0, 0), targets: [token("t", 3, 0)], outcome: "success", gridSize: 100 });
  assert.equal(plan.find((s) => s.stageId === "shove").delay, 300);
  assert.deepEqual(moveOptions({}), { squares: 2, moveAsk: "none", moveCone: 90 });
  assert.ok(isMoveStage(push));
});

test("only on a hit: each target by its own hit; a use with no roll moves", () => {
  const s = stage("push", { requiresHit: true }), a = token("a", 3, 0);
  assert.equal(hitsTarget(s, { outcome: "failure" }, a), false);
  assert.equal(hitsTarget(s, { outcome: "criticalSuccess" }, a), true);
  assert.equal(hitsTarget(s, {}, a), true, "a save spell has no attack roll");
  assert.equal(hitsTarget(s, { targetOutcomes: { a: "failure" }, outcome: "success" }, a), false);
  assert.equal(hitsTarget(stage("push"), { outcome: "failure" }, a), true);
});

test("a pull stops beside the puller; a push or pull shoves the right way", () => {
  const me = token("me", 0, 0);
  assert.equal(pullReach(token("t", 5, 0), me, 100), 4);
  assert.equal(pullReach(token("t", 1, 1), me, 100), 0, "already beside");
  assert.equal(pullReach(token("ogre", 4, 0, 2), me, 100), 3, "a large creature's own size counts");
  const t = token("t", 5, 0), host = { gridSize: () => 100, trace: () => {}, landing: (mover, d, squares) => ({ x: mover.document.x + Math.round(d.x * squares) * 100, y: mover.document.y + Math.round(d.y * squares) * 100 }) };
  assert.deepEqual(planFinisher({ recipe: shoveRecipe(stage("push"), 2), mover: t, attacker: me }, host).to, { x: 700, y: 0 });
  const pulled = planFinisher({ recipe: shoveRecipe(stage("pull"), 3), mover: t, attacker: me }, host);
  assert.deepEqual(pulled.to, { x: 200, y: 0 });
  assert.ok(pulled.composed.stages.some((s) => s.kind === "motion" && s.motion === "rush"), "a quick shove carries it there");
  assert.equal(previewMotion(stage("push")).motion, "recoil");
  assert.equal(previewMotion(stage("pull")).motion, "lunge");
});

test("someone picks the square: it lands exactly there; Esc leaves it; never the one who acted", async () => {
  const me = token("me", 0, 0), t = token("Goblin", 6, 0), moved = [], picks = [];
  const host = (spot) => ({ gridSize: () => 100, pick: async (who, request) => { picks.push([who, request.squares, request.pull]); return spot; }, playFinisher: async (shove, mover, source, at) => { moved.push([shove.finisher, mover.id, source.id, at]); return true; } });
  const pull = stage("pull", { squares: 3, moveAsk: "target", destination: t });
  assert.equal(await playMoveStage(pull, { source: me }, host(null)), false, "Esc: stays put");
  assert.deepEqual(moved, []);
  assert.equal(await playMoveStage(pull, { source: me }, host({ x: 400, y: 100 })), true);
  assert.deepEqual(moved, [[{ knockback: 3, ending: "stay", pull: true }, "Goblin", "me", { x: 400, y: 100 }]]);
  assert.deepEqual(picks, [["target", 3, true], ["target", 3, true]]);
  // Nobody picks: it goes straight along the line.
  await playMoveStage(stage("push", { squares: 2, destination: t }), { source: me }, host({ x: 0, y: 0 }));
  assert.equal(moved.at(-1)[3], null);
  assert.equal(picks.length, 2);
  assert.equal(await playMoveStage({ ...pull, destination: me }, { source: me }, host({ x: 0, y: 0 })), null);
  assert.match(movePrompt(true, t, me, 3), /Pull Goblin: click a square up to 3 squares away, toward me/);
});

test("a picked square: a push ends no closer, a pull no farther and never on top of the puller", () => {
  const me = token("me", 0, 0), t = token("t", 4, 0), c = (x, y) => ({ x: x * 100 + 50, y: y * 100 + 50 });
  assert.equal(allowedSpot({ mover: t, source: me, center: c(6, 0), pull: false, grid: 100 }), true);
  assert.equal(allowedSpot({ mover: t, source: me, center: c(4, 3), pull: false, grid: 100, degrees: 180 }), true, "sideways, with a 180 degree cone");
  assert.equal(allowedSpot({ mover: t, source: me, center: c(3, 0), pull: false, grid: 100 }), false, "a push never brings it closer");
  assert.equal(allowedSpot({ mover: t, source: me, center: c(2, 0), pull: true, grid: 100 }), true);
  assert.equal(allowedSpot({ mover: t, source: me, center: c(1, 0), pull: true, grid: 100 }), true, "right beside");
  assert.equal(allowedSpot({ mover: t, source: me, center: c(0, 0), pull: true, grid: 100 }), false, "not on top of them");
  assert.equal(allowedSpot({ mover: t, source: me, center: c(6, 0), pull: true, grid: 100 }), false, "a pull never sends it away");
});

test("a picked square sits in a cone: straight away for a push, straight toward for a pull, never behind", () => {
  const me = token("me", 0, 0), t = token("t", 4, 0), c = (x, y) => ({ x: x * 100 + 50, y: y * 100 + 50 });
  const ok = (x, y, pull, degrees) => allowedSpot({ mover: t, source: me, center: c(x, y), pull, grid: 100, degrees });
  assert.equal(ok(7, 0, false), true, "straight away");
  assert.equal(ok(6, 2, false), true, "45 degrees off: the edge of a 90 degree cone");
  assert.equal(ok(4, 3, false), false, "straight sideways is outside the cone");
  assert.equal(ok(4, 3, false, 180), true, "a 180 degree cone allows sideways");
  assert.equal(ok(2, 0, true), true, "a pull straight in");
  assert.equal(ok(3, 2, true), false, "a pull off to the side");
  assert.equal(ok(6, 0, true, 180), false, "never away, even with a wide cone");
  const cone = moveCone({ mover: t, source: me, pull: false, degrees: 90 });
  assert.ok(Math.abs(cone.angle) < 1e-9 && Math.abs(cone.half - Math.PI / 4) < 1e-9);
  assert.ok(Math.abs(Math.abs(moveCone({ mover: t, source: me, pull: true }).angle) - Math.PI) < 1e-9, "a pull's wedge points back at the puller");
});

test("the composition preview shows the reach: a push beside the source, a pull its squares away, the wedge or a straight line", async () => {
  const { chainPreview } = await import("../../../scripts/engines/preview/chain-preview.mjs");
  const recipe = (motion, extra = {}) => ({ id: "r", name: "R", trigger: "attack", stages: [{ stageId: "m", kind: "motion", motion, subject: "targets", squares: 3, moveAsk: "actor", moveCone: 60, assets: [], delay: 0, duration: 600, ...extra }] });
  const size = { previewWidth: 800, previewHeight: 300 };
  const push = chainPreview(recipe("push"), size), pull = chainPreview(recipe("pull"), size);
  // In real pixels, in squares of the grid key, whatever the panel size.
  const gap = (c) => (parseFloat(c.actors[1].left) - parseFloat(c.actors[0].left)) / c.grid;
  assert.ok(Math.abs(gap(push) - 1) < 1e-6, "a push starts beside the source");
  assert.ok(Math.abs(gap(pull) - 4) < 1e-6, "a pull starts its 3 squares away");
  assert.equal(push.moveCone.angle, 0);
  assert.equal(pull.moveCone.angle, Math.PI, "the wedge points back at the puller");
  assert.ok(Math.abs(push.moveCone.half - Math.PI / 6) < 1e-9, "a 60 degree cone");
  assert.equal(chainPreview(recipe("push", { moveAsk: "none" }), size).moveCone.half, 0, "nobody picks: a straight line");
  const far = chainPreview(recipe("pull", { squares: 10 }), { previewWidth: 400, previewHeight: 300 });
  assert.ok(far.grid < 55 && parseFloat(far.actors[1].left) <= 640, "a long reach shrinks the squares to fit");
  assert.equal(push.grid, 55, "a short reach keeps full-size squares, the size of the grid key");
});
