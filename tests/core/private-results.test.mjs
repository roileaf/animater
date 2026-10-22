import test from "node:test";
import assert from "node:assert/strict";
import { twoeEvent, dnd5eEvent } from "../../scripts/systems/adapters.mjs";
import { twoeSaveOutcome, dnd5eSaveOutcome } from "../../scripts/systems/outcome.mjs";
import { checkFinisherEvent } from "../../scripts/engines/finishers/finisher-model.mjs";
import { hidesResult, setHidePrivateResults } from "../../scripts/core/privacy.mjs";

const gm = { id: "gm", isGM: true };
const strike = (over = {}) => ({ id: "m", author: gm, isRoll: true, speaker: {}, actor: {}, item: { type: "weapon", name: "Shortsword", system: {} },
  flags: { pf2e: { context: { type: "attack-roll", outcome: "failure", options: [] }, origin: { uuid: "Actor.a.Item.b" } } }, ...over });

test("by default a GM's private roll animates its real result", () => {
  setHidePrivateResults(false);
  assert.equal(hidesResult("gm"), false);
  const e = twoeEvent(strike({ whisper: ["gm"] }), "gm");
  assert.equal(e.outcome, "failure", "a private miss still flies wide or into the wall");
  assert.equal(e.private, true);
  const subject = { id: "act", name: "Attack", item: { type: "weapon", name: "Scimitar" }, getUsageToken: () => null };
  const rolls = [{ total: 25, isCritical: true, options: { rollMode: "gmroll" }, parent: { id: "m", author: gm, whisper: ["gm"] } }];
  assert.equal(dnd5eEvent("attack", subject, { rolls }).outcome, "criticalSuccess");
  const save = { author: gm, whisper: ["gm"], flags: { pf2e: { context: { type: "saving-throw", outcome: "criticalFailure", origin: { actor: "a" } } } } };
  assert.equal(twoeSaveOutcome(save), "criticalFailure");
  assert.equal(dnd5eSaveOutcome([{ total: 5, options: { target: 12, rollMode: "gmroll" } }], { isGM: true }), "failure");
  const check = { id: "c", author: gm, whisper: ["gm"], speaker: {}, flags: { pf2e: { context: { type: "skill-check", outcome: "success", options: ["action:shove"] } } } };
  assert.equal(checkFinisherEvent(check, "pf2e", "gm")?.outcome, "success");
});

test("hiding private results is a world choice; blind and players' private rolls stay hidden regardless", () => {
  setHidePrivateResults(true);
  try {
    assert.equal(hidesResult("gm"), true);
    assert.equal(twoeEvent(strike({ whisper: ["gm"] }), "gm").outcome, "hidden");
    assert.equal(hidesResult("public"), false);
  } finally { setHidePrivateResults(false); }
  assert.match(twoeEvent(strike({ whisper: ["gm"], blind: true }), "gm").skipped, /blind roll/);
});
