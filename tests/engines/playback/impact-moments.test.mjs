import test from "node:test";
import assert from "node:assert/strict";
import { plannedCrit, critTargetIds, contactTime, withHitStop, tempoFor, withTempo } from "../../../scripts/engines/playback/impact-moments.mjs";
import { strikeAt } from "../../../scripts/systems/outcome.mjs";
import { timedStages } from "../../../scripts/engines/playback/composition.mjs";

test("strikeAt matches strikeTime on a timed recipe", () => {
  const recipe = { stages: [
    { stageId: "fly", kind: "travel", subject: "source", delay: 0, duration: 400, assets: [] },
    { stageId: "hit", kind: "impact", subject: "targets", delay: 400, duration: 500, assets: [] },
  ] };
  const timed = timedStages(recipe);
  assert.equal(strikeAt(timed), timed.find((s) => s.stageId === "hit").delay);
  assert.equal(strikeAt([]), null);
});

test("plannedCrit reads outcome and per-target outcomes, never saves", () => {
  assert.equal(plannedCrit({ outcome: "criticalSuccess" }), true);
  assert.equal(plannedCrit({ targetOutcomes: { a: "success", b: "criticalSuccess" } }), true);
  assert.equal(plannedCrit({ outcome: "success" }), false);
  assert.equal(plannedCrit({}), false);
});

test("critTargetIds names crit targets, or null when the whole roll is critical", () => {
  assert.equal(critTargetIds({ outcome: "criticalSuccess" }), null);
  assert.deepEqual([...critTargetIds({ targetOutcomes: { a: "success", b: "criticalSuccess" } })], ["b"]);
});

test("contactTime uses the first crit target", () => {
  const plan = [
    { kind: "impact", subject: "targets", delay: 300, duration: 500, destination: { id: "a" } },
    { kind: "impact", subject: "targets", delay: 600, duration: 500, destination: { id: "b" } },
  ];
  assert.equal(contactTime(plan, new Set(["b"])), 600);
  assert.equal(contactTime(plan, null), 300);
  assert.equal(contactTime([{ kind: "sound", delay: 0, duration: 100 }], null), null);
});

test("withHitStop delays only what follows contact and marks what plays across it", () => {
  const swing = { kind: "impact", delay: 0, duration: 800 }, hit = { kind: "impact", delay: 400, duration: 500 };
  const crack = { kind: "sound", delay: 400, duration: 300 }, stagger = { kind: "motion", delay: 480, duration: 900 };
  const lasting = { kind: "aura", delay: 0, duration: 5000, persist: true };
  const { plan, marks } = withHitStop([swing, hit, crack, stagger, lasting], 400);
  assert.deepEqual(plan.map((s) => s.delay), [0, 400, 400, 580, 0]);
  assert.deepEqual([...marks.values()], [{ afterMs: 400, holdMs: 100 }, { afterMs: 0, holdMs: 100 }]);
  assert.ok(marks.has(plan[0]) && marks.has(plan[1]));
});

test("tempo is capped and rates stay positive", () => {
  assert.equal(tempoFor(2000), 0.5);
  assert.equal(tempoFor(4500), 0.75);
  assert.equal(tempoFor(9000), 1);
  const [fx, snd] = withTempo([{ kind: "impact", delay: 100, duration: 400, playbackRate: 0.25 }, { kind: "sound", delay: 0, duration: 300 }], 0.5);
  assert.deepEqual([fx.delay, fx.duration, fx.playbackRate], [200, 800, 0.125]);
  assert.equal(snd.pitch, 0.85);
});

test("withTempo scales moveDelay but not percentage motion fields, and leaves full tempo alone", () => {
  const plan = [{ kind: "motion", delay: 0, duration: 200, moveDelay: 50, motionHold: 25, motionArrival: 45 }];
  const [m] = withTempo(plan, 0.5);
  assert.deepEqual([m.moveDelay, m.motionHold, m.motionArrival], [100, 25, 45]);
  assert.equal(withTempo(plan, 1), plan);
});
