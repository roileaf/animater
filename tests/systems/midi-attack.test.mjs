import test from "node:test";
import assert from "node:assert/strict";
import { midiTargetOutcomes } from "../../scripts/systems/outcome.mjs";
import { dnd5eEvent } from "../../scripts/systems/adapters.mjs";

const subject = { id: "act1", name: "Attack", item: { type: "weapon", name: "Shortbow" } };
const roll = (total, extra = {}) => ({ total, options: {}, ...extra });

test("Midi's verdict: each target hit or missed as its workflow decided", () => {
  assert.deepEqual(midiTargetOutcomes(roll(10), ["a", "b"], ["b"]), { a: "failure", b: "success" });
  assert.deepEqual(midiTargetOutcomes(roll(25, { isCritical: true }), ["a", "b"], ["a"]), { a: "criticalSuccess", b: "failure" });
  assert.deepEqual(midiTargetOutcomes(roll(1, { isFumble: true }), ["a"], []), { a: "criticalFailure" });
  assert.deepEqual(midiTargetOutcomes(null, ["a"], ["a"]), {});
});

test("a fast-forwarded Midi attack (no chat message) plays its workflow's hits and misses", () => {
  const t1 = { token: "Scene.s.Token.t1", ac: 12 }, t2 = { token: "Scene.s.Token.t2", ac: 25 };
  const miss = dnd5eEvent("attack", subject, { rolls: [roll(10)], verdict: { messageId: "card1", targets: [t1], hits: [] } });
  assert.equal(miss.outcome, "failure");
  assert.deepEqual(miss.targetOutcomes, { t1: "failure" });
  assert.deepEqual(miss.targetUuids, ["Scene.s.Token.t1"]);
  assert.equal(miss.id, "activity:card1:attack");
  // Midi's call wins over the ACs (a reaction, a forced miss): t1's AC 12 is beaten, yet Midi says only t2 was hit.
  const hit = dnd5eEvent("attack", subject, { rolls: [roll(19)], verdict: { messageId: "card2", targets: [t1, t2], hits: ["t2"] } });
  assert.equal(hit.outcome, null);
  assert.deepEqual(hit.targetOutcomes, { t1: "failure", t2: "success" });
});

test("a Midi attack whose hits Midi does not check plays the total against each target's AC", () => {
  const event = dnd5eEvent("attack", subject, { rolls: [roll(12)], verdict: { messageId: "card3", targets: [{ token: "Scene.s.Token.t1", ac: 12 }], hits: null } });
  assert.equal(event.outcome, "success");
  assert.deepEqual(event.targetOutcomes, { t1: "success" });
});
