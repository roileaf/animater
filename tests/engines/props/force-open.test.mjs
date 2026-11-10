import test from "node:test";
import assert from "node:assert/strict";
import { defaultForceDC, forceDCOf, forceOpenWording, forceOpenPrompt, showForceDC, forceOpenResult, closestForcedDoor, forceOpenRoller, FORCE_OPEN_SYSTEMS } from "../../../scripts/engines/props/force-open.mjs";

const scene = (f = {}) => ({ id: "s", flags: { animater: { breakableProps: true, ...f } } });
const door = (extra = {}) => ({ id: "d1", c: [300, 200, 400, 200], door: 1, ds: 0, move: 20, sight: 20, light: 20, sound: 20, levels: [], flags: {}, ...extra });
const d20 = (total, natural = 10) => ({ total, dice: [{ faces: 20, total: natural, results: [{ result: natural, active: true }] }] });

test("default Force open DC by material and system", () => {
  for (const sys of ["pf2e", "sf2e", "dnd5e"]) {
    assert.equal(defaultForceDC("wood", sys), 15);
    assert.equal(defaultForceDC("metal", sys), 20);
    assert.equal(defaultForceDC("stone", sys), 25);
  }
  assert.equal(defaultForceDC("wood", "daggerheart"), 13);
  assert.equal(defaultForceDC("metal", "daggerheart"), 16);
  assert.equal(defaultForceDC("stone", "daggerheart"), 19);
  assert.equal(defaultForceDC("wood", "draw-steel"), null); // the tier rule instead
  assert.equal(defaultForceDC("stone", "draw-steel"), null);
  assert.equal(defaultForceDC("wood", "crucible"), null);
  assert.equal(defaultForceDC("lava", "pf2e"), 15); // unknown material reads as wood
  assert.deepEqual([...FORCE_OPEN_SYSTEMS].sort(), ["daggerheart", "dnd5e", "draw-steel", "pf2e", "sf2e"]);
});

test("the door's own DC wins over the default; junk falls back; Draw Steel has none", () => {
  assert.equal(forceDCOf({ forceDC: 18 }, "wood", "pf2e"), 18);
  assert.equal(forceDCOf({ forceDC: "22" }, "wood", "dnd5e"), 22); // a form may save it as text
  assert.equal(forceDCOf({ forceDC: null }, "metal", "pf2e"), 20);
  assert.equal(forceDCOf({ forceDC: "" }, "stone", "daggerheart"), 19);
  assert.equal(forceDCOf({ forceDC: -3 }, "wood", "pf2e"), 15);
  assert.equal(forceDCOf({ forceDC: 2.5 }, "wood", "pf2e"), 15);
  assert.equal(forceDCOf({ forceDC: 18 }, "wood", "draw-steel"), null);
  assert.equal(forceDCOf({ forceDC: 18 }, "wood", "crucible"), null);
  assert.equal(forceDCOf(undefined, "wood", "pf2e"), 15);
});

test("the prompt speaks each system's words", () => {
  assert.deepEqual(forceOpenWording("pf2e"), { skill: "Athletics", label: "Force Open", dc: "DC" });
  assert.deepEqual(forceOpenWording("sf2e"), { skill: "Athletics", label: "Force Open", dc: "DC" });
  assert.deepEqual(forceOpenWording("dnd5e"), { skill: "Strength (Athletics)", label: "Force open", dc: "DC" });
  assert.deepEqual(forceOpenWording("daggerheart"), { skill: "Strength", label: "Force open", dc: "Difficulty" });
  assert.deepEqual(forceOpenWording("draw-steel"), { skill: "Might", label: "Force open", dc: null });
  assert.equal(forceOpenWording("crucible"), null);
  assert.equal(forceOpenPrompt("pf2e", "wood", 15), "Force it open? Athletics vs DC 15");
  assert.equal(forceOpenPrompt("dnd5e", "metal", 20), "Force it open? Strength (Athletics) vs DC 20");
  assert.equal(forceOpenPrompt("daggerheart", "wood", 13), "Force it open? Strength vs Difficulty 13");
  assert.equal(forceOpenPrompt("draw-steel", "wood", null), "Force it open? Might test: tier 2 or 3 breaks it");
  assert.equal(forceOpenPrompt("draw-steel", "stone", null), "Force it open? Might test: only tier 3 breaks it");
  assert.equal(forceOpenPrompt("crucible", "wood", null), null);
});

test("PF2e: the outcome against the door's DC; no outcome or another DC compares the total", () => {
  const pf = (outcome, total, dcValue = 15, natural = 10, ns = "pf2e") => ({ rolls: [d20(total, natural)], flags: { [ns]: { context: { options: ["action:force-open"], outcome, dc: dcValue === null ? null : { value: dcValue } } } } });
  assert.deepEqual(forceOpenResult({ system: "pf2e", message: pf("success", 16), dc: 15 }), { ok: true });
  assert.deepEqual(forceOpenResult({ system: "pf2e", message: pf("criticalSuccess", 26), dc: 15 }), { ok: true });
  assert.deepEqual(forceOpenResult({ system: "pf2e", message: pf("failure", 12), dc: 15 }), { ok: false, why: "outcome" });
  assert.deepEqual(forceOpenResult({ system: "pf2e", message: pf("criticalFailure", 3), dc: 15 }), { ok: false, why: "outcome" });
  // a natural 20 lifts a failure to a success: the system's outcome against the door's DC says so
  assert.equal(forceOpenResult({ system: "pf2e", message: pf("success", 13, 15, 20), dc: 15 }).ok, true);
  // sheet roll, no DC: the total against the door's
  assert.equal(forceOpenResult({ system: "pf2e", message: pf(null, 15, null), dc: 15 }).ok, true);
  assert.equal(forceOpenResult({ system: "pf2e", message: pf(null, 14, null), dc: 15 }).ok, false);
  // ...with the degree of success: a natural 20 lifts 14 vs 15, a natural 1 drops 16 vs 15
  assert.equal(forceOpenResult({ system: "pf2e", message: pf(null, 14, null, 20), dc: 15 }).ok, true);
  assert.equal(forceOpenResult({ system: "pf2e", message: pf(null, 16, null, 1), dc: 15 }).ok, false);
  // an outcome against some other DC (an inline check at 10) is judged by the total against the door's
  assert.equal(forceOpenResult({ system: "pf2e", message: pf("success", 12, 10), dc: 15 }).ok, false);
  // SF2e keeps its context under its own flags
  assert.equal(forceOpenResult({ system: "sf2e", message: pf("success", 16, 15, 10, "sf2e"), dc: 15 }).ok, true);
  assert.equal(forceOpenResult({ system: "sf2e", message: pf(null, 14, null, 10, "sf2e"), dc: 15 }).ok, false);
});

test("D&D 5e: total against the DC", () => {
  const m = (total, natural = 10) => ({ rolls: [d20(total, natural)] });
  assert.deepEqual(forceOpenResult({ system: "dnd5e", message: m(15), dc: 15 }), { ok: true });
  assert.deepEqual(forceOpenResult({ system: "dnd5e", message: m(14), dc: 15 }), { ok: false, why: "outcome" });
  assert.equal(forceOpenResult({ system: "dnd5e", message: m(14, 20), dc: 15 }).ok, false); // a natural 20 is no auto-success on a check
});

test("Daggerheart: total against the difficulty, a critical always", () => {
  const m = (total, hope = 5, fear = 3) => ({ type: "dualityRoll", system: { roll: { total, dHope: { total: hope }, dFear: { total: fear } } }, rolls: [{ total }] });
  assert.equal(forceOpenResult({ system: "daggerheart", message: m(13), dc: 13 }).ok, true);
  assert.equal(forceOpenResult({ system: "daggerheart", message: m(12), dc: 13 }).ok, false);
  assert.equal(forceOpenResult({ system: "daggerheart", message: m(8, 4, 4), dc: 13 }).ok, true); // matching duality dice: a critical
  // no system roll: the first roll on the message
  assert.equal(forceOpenResult({ system: "daggerheart", message: { rolls: [{ total: 16 }] }, dc: 16 }).ok, true);
});

test("Draw Steel: tier 2 breaks wood, not metal; tier 3 breaks stone", () => {
  const m = (product, total) => ({ rolls: [{ total, product }] });
  assert.equal(forceOpenResult({ system: "draw-steel", message: m(2, 13), material: "wood" }).ok, true);
  assert.equal(forceOpenResult({ system: "draw-steel", message: m(2, 13), material: "metal" }).ok, false);
  assert.equal(forceOpenResult({ system: "draw-steel", message: m(3, 18), material: "stone" }).ok, true);
  assert.equal(forceOpenResult({ system: "draw-steel", message: m(1, 9), material: "wood" }).ok, false);
  // no product on the roll: the tier from the total (12 and 17 are the thresholds)
  assert.equal(forceOpenResult({ system: "draw-steel", message: { rolls: [{ total: 12 }] }, material: "wood" }).ok, true);
  assert.equal(forceOpenResult({ system: "draw-steel", message: { rolls: [{ total: 16 }] }, material: "metal" }).ok, false);
  assert.equal(forceOpenResult({ system: "draw-steel", message: { rolls: [{ total: 17 }] }, material: "metal" }).ok, true);
});

test("no roll, an unknown system or no DC never breaks", () => {
  assert.deepEqual(forceOpenResult({ system: "dnd5e", message: { rolls: [] }, dc: 15 }), { ok: false, why: "roll" });
  assert.deepEqual(forceOpenResult({ system: "dnd5e", message: null, dc: 15 }), { ok: false, why: "roll" });
  assert.deepEqual(forceOpenResult({ system: "dnd5e", message: { rolls: [{ total: "x" }] }, dc: 15 }), { ok: false, why: "roll" });
  assert.deepEqual(forceOpenResult({ system: "crucible", message: { rolls: [{ total: 30 }] }, dc: 15 }), { ok: false, why: "roll" });
  assert.deepEqual(forceOpenResult({ system: "dnd5e", message: { rolls: [{ total: 30 }] }, dc: null }), { ok: false, why: "outcome" });
});

test("closestForcedDoor picks the nearest closed breakable door within one square", () => {
  const token = { x: 300, y: 200, w: 100, h: 100 };
  const near = door({ id: "near" }), metal = door({ id: "metal", flags: { animater: { breakWall: { material: "metal" } } } });
  const open = door({ id: "open", ds: 1 }), away = door({ id: "away", c: [300, 500, 400, 500] }), locked = door({ id: "locked", ds: 2 });
  assert.equal(closestForcedDoor(token, [away, near], scene(), 100)?.id, "near");
  assert.equal(closestForcedDoor(token, [metal], scene(), 100)?.id, "metal"); // the DC carries the material now
  assert.equal(closestForcedDoor(token, [open], scene(), 100), null);
  assert.equal(closestForcedDoor(token, [locked], scene(), 100)?.id, "locked");
  assert.equal(closestForcedDoor(token, [away], scene(), 100), null);
  assert.equal(closestForcedDoor(token, [door({ flags: { animater: { breakWall: { forceOpen: false } } } })], scene(), 100), null);
  const win = door({ id: "w", door: 0, flags: { animater: { breakWall: { window: true } } } });
  assert.equal(closestForcedDoor({ x: 300, y: 210, w: 100, h: 100 }, [win], scene(), 100), null);
  // exactly one square counts; the nearer of two wins; a door through the footprint is at 0
  const edge = door({ id: "edge", c: [300, 400, 400, 400] }), beyond = door({ id: "beyond", c: [300, 401, 400, 401] }), close = door({ id: "close", c: [300, 350, 400, 350] });
  assert.equal(closestForcedDoor(token, [edge], scene(), 100)?.id, "edge");
  assert.equal(closestForcedDoor(token, [beyond], scene(), 100), null);
  assert.equal(closestForcedDoor(token, [edge, close], scene(), 100)?.id, "close");
  assert.equal(closestForcedDoor(token, [close, door({ id: "through", c: [350, 150, 350, 350] })], scene(), 100)?.id, "through");
  // levels, broken doors, the scene's switch, a missing token
  const up = door({ id: "up", levels: ["upstairs"] });
  assert.equal(closestForcedDoor({ ...token, level: "ground" }, [up], scene(), 100), null);
  assert.equal(closestForcedDoor({ ...token, level: "upstairs" }, [up], scene(), 100)?.id, "up");
  assert.equal(closestForcedDoor(token, [door({ flags: { animater: { breakWall: { broken: { seed: 1 } } } } })], scene(), 100), null);
  assert.equal(closestForcedDoor(token, [door()], scene({ breakWalls: false }), 100), null);
  assert.equal(closestForcedDoor(null, [door()], scene(), 100), null);
});

test("who rolls from the door: the selected token beside it, else the only owned one beside it", () => {
  const wall = door();
  const beside = { id: "a", x: 300, y: 200, w: 100, h: 100 }, beside2 = { id: "b", x: 200, y: 200, w: 100, h: 100 }, far = { id: "f", x: 300, y: 600, w: 100, h: 100 };
  assert.deepEqual(forceOpenRoller(wall, { controlled: [beside], owned: [beside, beside2] }, 100), { token: beside });
  assert.deepEqual(forceOpenRoller(wall, { controlled: [far], owned: [far, beside] }, 100), { why: "far" });
  assert.deepEqual(forceOpenRoller(wall, { controlled: [], owned: [far, beside] }, 100), { token: beside });
  assert.deepEqual(forceOpenRoller(wall, { controlled: [], owned: [beside, beside2] }, 100), { why: "many" });
  assert.deepEqual(forceOpenRoller(wall, { controlled: [beside, beside2], owned: [beside, beside2] }, 100), { why: "many" });
  assert.deepEqual(forceOpenRoller(wall, { controlled: [], owned: [far] }, 100), { why: "none" });
  assert.deepEqual(forceOpenRoller(wall, {}, 100), { why: "none" });
  // the token has to be on the door's level
  const up = door({ levels: ["upstairs"] });
  assert.deepEqual(forceOpenRoller(up, { controlled: [{ ...beside, level: "ground" }], owned: [] }, 100), { why: "far" });
});

test("the prompt's DC follows each system's own visibility setting; the GM always sees it", () => {
  const show = (system, isGM, settings) => showForceDC({ system, isGM, settings });
  for (const sys of ["pf2e", "sf2e"]) {
    assert.equal(show(sys, false, { pf2eShowDC: false }), false);
    assert.equal(show(sys, false, { pf2eShowDC: true }), true);
    assert.equal(show(sys, true, { pf2eShowDC: false }), true);
    assert.equal(show(sys, false, {}), true);
    assert.equal(show(sys, false, undefined), true);
  }
  assert.equal(show("dnd5e", false, { dnd5eChallengeVisibility: "all" }), true);
  assert.equal(show("dnd5e", false, { dnd5eChallengeVisibility: "player" }), true);
  assert.equal(show("dnd5e", false, { dnd5eChallengeVisibility: "none" }), false);
  assert.equal(show("dnd5e", false, { dnd5eChallengeVisibility: "gm" }), false);
  assert.equal(show("dnd5e", true, { dnd5eChallengeVisibility: "none" }), true);
  assert.equal(show("dnd5e", false, {}), true);
  assert.equal(show("daggerheart", false, { pf2eShowDC: false, dnd5eChallengeVisibility: "none" }), true);
  assert.equal(show("draw-steel", false, {}), true);
  assert.equal(show(undefined, false, undefined), true);
  assert.equal(showForceDC(), true);
  assert.equal(forceOpenPrompt("pf2e", "wood", 15, false), "Force it open? Athletics");
  assert.equal(forceOpenPrompt("dnd5e", "metal", 20, false), "Force it open? Strength (Athletics)");
  assert.equal(forceOpenPrompt("pf2e", "wood", 15, true), "Force it open? Athletics vs DC 15");
  assert.equal(forceOpenPrompt("draw-steel", "wood", null, false), "Force it open? Might test: tier 2 or 3 breaks it");
});
