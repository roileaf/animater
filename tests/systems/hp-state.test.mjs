import test from "node:test";
import assert from "node:assert/strict";
import { hpPath, hpState, hpChange, isKillTransition, isNpcActor, displaceHp } from "../../scripts/systems/hp-state.mjs";

test("PF2e, SF2e and D&D read system.attributes.hp and are down at 0 or below", () => {
  for (const sys of ["pf2e", "sf2e", "dnd5e"]) {
    const actor = { type: "npc", system: { attributes: { hp: { value: 5, max: 10 } } } };
    assert.equal(hpPath(actor, sys), "system.attributes.hp.value");
    assert.deepEqual(hpState(actor, sys), { value: 5, max: 10, down: false, marked: false });
    assert.equal(hpState({ system: { attributes: { hp: { value: 0 } } } }, sys).down, true);
    assert.equal(hpState({ system: {} }, sys), null);
    assert.equal(isNpcActor({ type: "npc" }, sys), true);
    assert.equal(isNpcActor({ type: "character" }, sys, { playerOwned: false }), false, "only npc counts outside Daggerheart");
  }
});

test("the 2e/5e kill and harm rules are unchanged: a drop to 0 from above, a loss short of it, nothing else", () => {
  const hp = (value) => hpState({ system: { attributes: { hp: { value } } } }, "pf2e");
  assert.deepEqual(hpChange(hp(5), hp(0)), { dropped: true });
  assert.deepEqual(hpChange(hp(5), hp(-3)), { dropped: true });
  assert.deepEqual(hpChange(hp(5), hp(2)), { dropped: false });
  assert.equal(hpChange(hp(5), hp(7)), null, "healing");
  assert.equal(hpChange(hp(5), hp(5)), null, "no change");
  assert.equal(hpChange(hp(0), hp(-1)), null, "already down");
  assert.equal(hpChange(undefined, hp(0)), null, "no HP change recorded before the update");
  assert.equal(hpChange(hp(5), hpState({ system: {} }, "pf2e")), null);
  assert.equal(isKillTransition(hp(1), hp(0)), true);
  assert.equal(isKillTransition(hp(3), hp(1)), false);
  assert.equal(displaceHp({ system: { attributes: { hp: { value: 0 } } } }, "pf2e"), 0);
  assert.equal(displaceHp({ system: { attributes: { hp: { value: 4 } } } }, "dnd5e"), 4);
  assert.ok(Number.isNaN(displaceHp({ system: {} }, "dnd5e")));
});

test("Daggerheart marks hit points up to the maximum; a companion marks stress", () => {
  const adversary = (value, max = 4) => ({ type: "adversary", system: { resources: { hitPoints: { value, max }, stress: { value: 0, max: 2 } } } });
  const dh = (actor) => hpState(actor, "daggerheart");
  assert.equal(hpPath(adversary(0), "daggerheart"), "system.resources.hitPoints.value");
  assert.deepEqual(dh(adversary(3)), { value: 3, max: 4, down: false, marked: true });
  assert.deepEqual(hpChange(dh(adversary(3)), dh(adversary(4))), { dropped: true });
  assert.deepEqual(hpChange(dh(adversary(1)), dh(adversary(2))), { dropped: false });
  assert.equal(hpChange(dh(adversary(4)), dh(adversary(4))), null, "already at max: no kill");
  assert.equal(hpChange(dh(adversary(3)), dh(adversary(1))), null, "clearing marks heals");
  assert.equal(dh(adversary(0, 0)).down, false, "a track with no maximum is never down");
  assert.equal(dh({ type: "adversary", system: {} }), null);
  const companion = (value) => ({ type: "companion", system: { resources: { stress: { value, max: 3 } } } });
  assert.equal(hpPath(companion(0), "daggerheart"), "system.resources.stress.value");
  assert.equal(isKillTransition(dh(companion(2)), dh(companion(3))), true, "companions go down on their stress track");
  assert.equal(displaceHp(adversary(4), "daggerheart"), 0);
  assert.equal(displaceHp(adversary(1), "daggerheart"), 1);
});

test("Daggerheart NPCs: adversaries, and any creature no player owns", () => {
  assert.equal(isNpcActor({ type: "adversary" }, "daggerheart", { playerOwned: true }), true);
  assert.equal(isNpcActor({ type: "character" }, "daggerheart", { playerOwned: false }), true);
  assert.equal(isNpcActor({ type: "character" }, "daggerheart", { playerOwned: true }), false);
  assert.equal(isNpcActor({ type: "companion" }, "daggerheart", { playerOwned: true }), false);
  assert.equal(isNpcActor(null, "daggerheart"), false);
});
