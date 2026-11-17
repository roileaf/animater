import test from "node:test";
import assert from "node:assert/strict";
import {
  LOCKS, LOCK_DEFAULT, LOCK_QUALITIES, PICK_LOCK_SYSTEMS,
  lockQualityOf, ownLockDC, ownLockSuccesses, lockDCOf, lockTierOf, lockSuccessesNeeded, lockProgressOf,
  pickLockWording, pickLockPrompt, pickLockResult, lockPicked, pickLockLine,
} from "../../../scripts/engines/props/pick-lock.mjs";

const d20 = (total, nat = null) => ({ total, dice: [{ faces: 20, total: nat ?? total }] });
const pf2eMsg = (total, { outcome, dc, nat } = {}) => ({
  rolls: [d20(total, nat)],
  ...(outcome ? { flags: { pf2e: { context: { outcome, dc: { value: dc } } } } } : {}),
});

test("the locks are PF2e's own: a poor lock is two DC 15 checks, a superior one six at DC 40", () => {
  assert.deepEqual(LOCKS.poor, { label: "Poor lock", dc: 15, successes: 2 });
  assert.deepEqual(LOCKS.superior, { label: "Superior lock", dc: 40, successes: 6 });
  // Each step up is harder and takes one more way in than the last. The ladder starts at two, not one: even the
  // worst lock in the book takes a second check.
  assert.equal(LOCKS[LOCK_QUALITIES[0]].successes, 2);
  let was = LOCKS[LOCK_QUALITIES[0]];
  for (const q of LOCK_QUALITIES.slice(1)) {
    assert.ok(LOCKS[q].dc > was.dc, `${q} is harder than the one below`);
    assert.equal(LOCKS[q].successes, was.successes + 1, `${q} takes one more success`);
    was = LOCKS[q];
  }
  assert.ok(Object.hasOwn(LOCKS, LOCK_DEFAULT));
});

test("a door's quality is the GM's choice, and nonsense is not a choice", () => {
  assert.equal(lockQualityOf({ lock: "good" }), "good");
  assert.equal(lockQualityOf({}), LOCK_DEFAULT);
  assert.equal(lockQualityOf({ lock: "skeleton key" }), LOCK_DEFAULT);
  assert.equal(lockQualityOf(null), LOCK_DEFAULT);
});

test("the GM's own DC beats the quality's, within reason", () => {
  assert.equal(ownLockDC({ lockDC: 18 }), 18);
  assert.equal(ownLockDC({ lockDC: "18" }), 18, "a form saves it as text");
  assert.equal(ownLockDC({ lockDC: 0 }), null);
  assert.equal(ownLockDC({ lockDC: 61 }), null);
  assert.equal(ownLockDC({ lockDC: 12.5 }), null);
  assert.equal(ownLockDC({}), null);
  assert.equal(lockDCOf({ lock: "poor", lockDC: 33 }, "pf2e"), 33, "the GM's own wins over the quality");
  assert.equal(lockDCOf({ lock: "poor" }, "pf2e"), 15);
});

test("every system that can force a door can pick a lock, each in its own words", () => {
  for (const sys of PICK_LOCK_SYSTEMS) {
    const w = pickLockWording(sys);
    assert.ok(w?.skill && w.label === "Pick the lock", sys);
    assert.ok(sys === "draw-steel" ? w.dc === null : typeof w.dc === "string", `${sys} says how it is measured`);
    const dc = lockDCOf({}, sys);
    assert.ok(sys === "draw-steel" ? dc === null : dc > 0, `${sys} has a difficulty for an average lock`);
  }
  assert.equal(pickLockWording("swade"), null, "and a system with no Force Open has no lockpicking either");
  assert.equal(lockDCOf({}, "swade"), null);
});

test("only the systems whose own action counts successes count them", () => {
  for (const sys of ["pf2e", "sf2e"]) assert.equal(lockSuccessesNeeded({ lock: "good" }, sys), 5, sys);
  // Inventing a multi-success lock for a system that never had one would be a house rule.
  for (const sys of ["dnd5e", "daggerheart", "draw-steel"]) assert.equal(lockSuccessesNeeded({ lock: "good" }, sys), 1, sys);
});

test("the GM's own number of successes beats the quality's, in every system", () => {
  assert.equal(ownLockSuccesses({ lockSuccesses: 7 }), 7);
  assert.equal(ownLockSuccesses({ lockSuccesses: "7" }), 7, "a form saves it as text");
  assert.equal(ownLockSuccesses({ lockSuccesses: 0 }), null);
  assert.equal(ownLockSuccesses({ lockSuccesses: 21 }), null);
  assert.equal(ownLockSuccesses({ lockSuccesses: 2.5 }), null);
  assert.equal(ownLockSuccesses({}), null);
  // A vault door that takes more than its quality says, and a tired lock that takes less.
  assert.equal(lockSuccessesNeeded({ lock: "poor", lockSuccesses: 8 }, "pf2e"), 8);
  assert.equal(lockSuccessesNeeded({ lock: "superior", lockSuccesses: 1 }, "pf2e"), 1);
  // Elsewhere it is the GM's own call too: setting a number is not inventing a rule, it is using one.
  assert.equal(lockSuccessesNeeded({ lock: "good", lockSuccesses: 3 }, "dnd5e"), 3);
  assert.equal(lockSuccessesNeeded({ lock: "good", lockSuccesses: 3 }, "draw-steel"), 3);
  // Nonsense falls back to the quality, so a half-typed field never locks a door shut for good.
  assert.equal(lockSuccessesNeeded({ lock: "good", lockSuccesses: 0 }, "pf2e"), 5);
  // Progress still cannot claim the lock is open: an eight-success lock holds at seven.
  assert.equal(lockProgressOf({ lock: "poor", lockSuccesses: 8, lockProgress: 9 }, "pf2e"), 7);
});

test("progress is kept on the door, and never claims the lock is already open", () => {
  assert.equal(lockProgressOf({ lockProgress: 2 }, "pf2e"), 2);
  assert.equal(lockProgressOf({}, "pf2e"), 0);
  assert.equal(lockProgressOf({ lockProgress: -3 }, "pf2e"), 0);
  // An average lock takes four; stored progress of nine is a door that should have opened, so it reads as three.
  assert.equal(lockProgressOf({ lockProgress: 9 }, "pf2e"), 3);
  assert.equal(lockProgressOf({ lockProgress: 9 }, "dnd5e"), 0, "where one success opens it there is nothing to store");
});

test("PF2e: a critical success is two ways in, a critical failure breaks the picks", () => {
  const own = { lock: "average" }; // DC 25, four successes
  assert.deepEqual(pickLockResult({ system: "pf2e", message: pf2eMsg(40, { outcome: "criticalSuccess", dc: 25 }), dc: 25, own }), { gained: 2, breaks: false });
  assert.deepEqual(pickLockResult({ system: "pf2e", message: pf2eMsg(26, { outcome: "success", dc: 25 }), dc: 25, own }), { gained: 1, breaks: false });
  assert.deepEqual(pickLockResult({ system: "pf2e", message: pf2eMsg(20, { outcome: "failure", dc: 25 }), dc: 25, own }), { gained: 0, breaks: false, why: "outcome" });
  assert.deepEqual(pickLockResult({ system: "pf2e", message: pf2eMsg(10, { outcome: "criticalFailure", dc: 25 }), dc: 25, own }), { gained: 0, breaks: true, why: "outcome" });
});

test("PF2e: the roll's own outcome is taken only when it was rolled against this very DC", () => {
  const own = { lock: "average" };
  // A message claiming a critical success against some other DC is judged by its total instead (25 vs 25: a success).
  assert.deepEqual(pickLockResult({ system: "pf2e", message: pf2eMsg(25, { outcome: "criticalSuccess", dc: 10 }), dc: 25, own }), { gained: 1, breaks: false });
  // No outcome at all: the degrees, with a natural 20 a step up and a natural 1 a step down.
  assert.equal(pickLockResult({ system: "pf2e", message: pf2eMsg(25), dc: 25, own }).gained, 1);
  assert.equal(pickLockResult({ system: "pf2e", message: pf2eMsg(25, { nat: 20 }), dc: 25, own }).gained, 2, "a natural 20 steps it up");
  assert.equal(pickLockResult({ system: "pf2e", message: pf2eMsg(26, { nat: 1 }), dc: 25, own }).breaks, false);
  assert.equal(pickLockResult({ system: "pf2e", message: pf2eMsg(16, { nat: 1 }), dc: 25, own }).breaks, true, "a natural 1 on a failure breaks them");
});

test("the systems that do not count successes get one way in and keep their picks", () => {
  const own = { lock: "average" };
  assert.deepEqual(pickLockResult({ system: "dnd5e", message: { rolls: [d20(25)] }, dc: 25, own }), { gained: 1, breaks: false });
  assert.deepEqual(pickLockResult({ system: "dnd5e", message: { rolls: [d20(3)] }, dc: 25, own }), { gained: 0, breaks: false, why: "outcome" });
  assert.equal(pickLockResult({ system: "dnd5e", message: { rolls: [d20(3, 1)] }, dc: 25, own }).breaks, false, "no broken picks outside PF2e");
  // Daggerheart: its difficulty, or a critical whatever the total.
  assert.equal(pickLockResult({ system: "daggerheart", message: { system: { roll: { total: 16 } } }, dc: 16, own }).gained, 1);
  assert.equal(pickLockResult({ system: "daggerheart", message: { system: { roll: { total: 4, dHope: { total: 2 }, dFear: { total: 2 } } } }, dc: 16, own }).gained, 1, "hope and fear alike is a critical");
  // Draw Steel has no DC: the tier decides, and a superior lock wants the top one.
  assert.equal(pickLockResult({ system: "draw-steel", message: { rolls: [{ total: 14, product: 2 }] }, own: { lock: "poor" } }).gained, 1);
  assert.equal(pickLockResult({ system: "draw-steel", message: { rolls: [{ total: 14, product: 2 }] }, own: { lock: "superior" } }).gained, 0);
  assert.equal(lockTierOf({ lock: "superior" }), 3);
});

test("a message with no roll in it does nothing at all", () => {
  assert.deepEqual(pickLockResult({ system: "pf2e", message: {}, dc: 25, own: {} }), { gained: 0, breaks: false, why: "roll" });
  assert.deepEqual(pickLockResult({ system: "swade", message: { rolls: [d20(30)] }, dc: 10, own: {} }), { gained: 0, breaks: false, why: "roll" });
});

test("ways in add up, are never taken back, and the lock opens on the last one", () => {
  assert.deepEqual(lockPicked({ progress: 0, gained: 1, needed: 4 }), { opened: false, progress: 1 });
  assert.deepEqual(lockPicked({ progress: 1, gained: 2, needed: 4 }), { opened: false, progress: 3 });
  assert.deepEqual(lockPicked({ progress: 3, gained: 1, needed: 4 }), { opened: true, progress: 0 });
  // A failure takes nothing back: PF2e's action says so, not even on a critical failure.
  assert.deepEqual(lockPicked({ progress: 2, gained: 0, needed: 4 }), { opened: false, progress: 2 });
  // One success is enough where that is all it takes.
  assert.deepEqual(lockPicked({ progress: 0, gained: 1, needed: 1 }), { opened: true, progress: 0 });
  // A critical success can carry it past what was needed.
  assert.deepEqual(lockPicked({ progress: 3, gained: 2, needed: 4 }), { opened: true, progress: 0 });
});

test("the line the GM reads says what happened and nothing more", () => {
  assert.equal(pickLockLine({ opened: true }), "The lock is open.");
  assert.equal(pickLockLine({ breaks: true }), "The lock holds, and the picks break.");
  assert.equal(pickLockLine({ gained: 0 }), "The lock holds.");
  assert.equal(pickLockLine({ gained: 1, progress: 2, needed: 4 }), "The lock gives a little: 2 of 4 ways in.");
  assert.equal(pickLockLine({ gained: 1, progress: 1, needed: 1 }), "The lock holds.", "a lock that takes one success says nothing about progress");
});

test("the prompt shows how far along only a lock that takes more than one way in", () => {
  assert.equal(pickLockPrompt({ system: "pf2e", dc: 25, progress: 0, needed: 1 }), "Pick the lock? Thievery vs DC 25");
  assert.equal(pickLockPrompt({ system: "pf2e", dc: 25, progress: 2, needed: 4 }), "Pick the lock? Thievery vs DC 25 (2 of 4 ways in)");
  assert.equal(pickLockPrompt({ system: "pf2e", dc: 25, showDC: false, needed: 1 }), "Pick the lock? Thievery");
  assert.equal(pickLockPrompt({ system: "draw-steel", needed: 1 }), "Pick the lock? Agility test");
  assert.equal(pickLockPrompt({ system: "swade" }), null);
});

test("each system's locks are on its own scale, not PF2e's", () => {
  // PF2e's ladder runs to DC 40. In 5e that is past the end of its own difficulty table, so a superior lock would be
  // out of reach of any party that ever plays. 5e's typical lock is 15, which is what an average one is here.
  assert.equal(lockDCOf({ lock: 'average' }, 'dnd5e'), 15, "5e's typical lock");
  assert.equal(lockDCOf({ lock: 'superior' }, 'dnd5e'), 25, 'and its hardest is reachable');
  for (const q of LOCK_QUALITIES) {
    assert.ok(lockDCOf({ lock: q }, 'dnd5e') <= 25, `${q} stays on 5e's table`);
    assert.ok(lockDCOf({ lock: q }, 'dnd5e') >= 10, `${q} is still worth rolling for`);
  }
  // Every system's ladder still climbs.
  for (const sys of ['pf2e', 'sf2e', 'dnd5e', 'daggerheart']) {
    let was = 0;
    for (const q of LOCK_QUALITIES) {
      const dc = lockDCOf({ lock: q }, sys);
      assert.ok(dc > was, `${sys}: ${q} is harder than the one below`);
      was = dc;
    }
  }
  // The GM's own DC is still the GM's own, whatever the system.
  assert.equal(lockDCOf({ lock: 'poor', lockDC: 28 }, 'dnd5e'), 28);
});

test("5e picks a lock with thieves' tools, which is what its tool proficiency is for", () => {
  assert.match(pickLockWording('dnd5e').skill, /thieves' tools/);
  assert.ok(!/Sleight of Hand/.test(pickLockWording('dnd5e').skill), 'not Sleight of Hand, which is a different skill');
  assert.equal(pickLockPrompt({ system: 'dnd5e', dc: 15, needed: 1 }), "Pick the lock? Dexterity (thieves' tools) vs DC 15");
});
