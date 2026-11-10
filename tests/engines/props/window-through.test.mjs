import test from "node:test";
import assert from "node:assert/strict";
import { hitOutcome, strikeOutcome, windowThrough, throughOk, throughAt } from "../../../scripts/engines/props/window-through.mjs";
import { windowInSwing } from "../../../scripts/engines/props/wall-triggers.mjs";

const scene = (f = {}) => ({ id: "s", flags: { animater: { breakableProps: true, ...f } } });
const win = (id, c, extra = {}) => ({ id, c, door: 0, ds: 0, move: 20, sight: 0, light: 20, sound: 20, levels: [], flags: { animater: { breakWall: { window: true } } }, ...extra });
const stone = (id, c) => ({ id, c, door: 0, ds: 0, move: 20, sight: 20, light: 20, sound: 20, levels: [], flags: {} });
// The attacker's footprint (centre 50, 50) and the target's (centre 650, 50): the centre line runs along y = 50.
const ATT = { x: 0, y: 0, w: 100, h: 100 }, TGT = { x: 600, y: 0, w: 100, h: 100 };

test("hitOutcome: only a hit or a critical hit", () => {
  assert.equal(hitOutcome("success"), "success");
  assert.equal(hitOutcome("criticalSuccess"), "criticalSuccess");
  for (const o of ["failure", "criticalFailure", "miss", undefined, null, "hit"]) assert.equal(hitOutcome(o), null);
});

test("strikeOutcome: any strike's outcome, hit or miss", () => {
  for (const o of ["success", "criticalSuccess", "miss", "criticalFailure"]) assert.equal(strikeOutcome(o), o);
  for (const o of ["failure", undefined, null, "hit", ""]) assert.equal(strikeOutcome(o), null);
});

test("windowInSwing: a missed swing's line from the attacker's centre to the target's middle crosses the window", () => {
  assert.equal(windowInSwing(win("g", [200, -100, 200, 200]), { x: 50, y: 50 }, TGT), true);
  assert.equal(windowInSwing(win("off", [300, 100, 300, 300]), { x: 50, y: 50 }, TGT), false);
  assert.equal(windowInSwing(win("behind", [800, -100, 800, 200]), { x: 50, y: 50 }, TGT), false);
  assert.equal(windowInSwing(win("g", [200, -100, 200, 200]), undefined, TGT), false);
  assert.equal(windowInSwing({ id: "x" }, { x: 50, y: 50 }, TGT), false);
});

test("windowThrough: the first breakable intact window the attacker-target centre line crosses, nearest the attacker", () => {
  const near = win("near", [200, -100, 200, 200]), far = win("far", [400, -100, 400, 200]);
  assert.equal(windowThrough(ATT, TGT, [far, near], scene(), [])?.id, "near");
  assert.equal(windowThrough(ATT, TGT, [far], scene(), [])?.id, "far");
  // a window off the line (beside it) is not crossed
  assert.equal(windowThrough(ATT, TGT, [win("off", [300, 100, 300, 300])], scene(), []), null);
  // a plain wall is not a window; a broken window is not intact
  assert.equal(windowThrough(ATT, TGT, [stone("s1", [200, -100, 200, 200])], scene(), []), null);
  const broken = win("b", [200, -100, 200, 200], { flags: { animater: { breakWall: { window: true, broken: { seed: 1 } } } } });
  assert.equal(windowThrough(ATT, TGT, [broken, far], scene(), [])?.id, "far");
  // a window behind the target (past its centre) is not between them
  assert.equal(windowThrough(ATT, TGT, [win("behind", [800, -100, 800, 200])], scene(), []), null);
  // the target's level picks the windows
  const up = win("up", [200, -100, 200, 200], { levels: ["upstairs"] });
  assert.equal(windowThrough(ATT, TGT, [up], scene(), ["ground"]), null);
  assert.equal(windowThrough(ATT, TGT, [up], scene(), ["upstairs"])?.id, "up");
  // bad footprints
  assert.equal(windowThrough(undefined, TGT, [near], scene(), []), null);
  assert.equal(windowThrough(ATT, { x: 0, y: 0 }, [near], scene(), []), null);
});

test("throughOk: the GM's own reading, never the client's line: this window is the first on the centre line", () => {
  const near = win("near", [200, -100, 200, 200]), far = win("far", [400, -100, 400, 200]);
  assert.equal(throughOk(near, ATT, TGT, [near, far], scene(), []), true);
  assert.equal(throughOk(far, ATT, TGT, [near, far], scene(), []), false); // a nearer window shields it
  assert.equal(throughOk(far, ATT, TGT, [far], scene(), []), true);
  // the wall itself counts even when the walls given leave it out
  assert.equal(throughOk(far, ATT, TGT, [], scene(), []), true);
  // off the line, or the attacker elsewhere
  assert.equal(throughOk(win("off", [300, 100, 300, 300]), ATT, TGT, [], scene(), []), false);
  assert.equal(throughOk(far, { x: 0, y: 600, w: 100, h: 100 }, TGT, [far], scene(), []), false);
  assert.equal(throughOk(far, undefined, TGT, [far], scene(), []), false);
});

test("throughAt: when a flying weapon reaches the glass, in proportion along its flight; at once without one", () => {
  const glass = win("g", [200, -100, 200, 200]);
  // a flight from 50 to 650 along y = 50: the glass at x 200 is a quarter of the way
  assert.equal(throughAt({ from: { x: 50, y: 50 }, to: { x: 650, y: 50 }, start: 100, arrive: 900 }, glass), 300);
  // a flight that stopped at the glass reaches it as it arrives
  assert.equal(throughAt({ from: { x: 50, y: 50 }, to: { x: 200, y: 50 }, start: 100, arrive: 900 }, glass), 900);
  // no arrive: at its start
  assert.equal(throughAt({ from: { x: 50, y: 50 }, to: { x: 650, y: 50 }, start: 250 }, glass), 250);
  // no flight, or a broken one: at once
  assert.equal(throughAt(null, glass), 0);
  assert.equal(throughAt({ from: { x: 50, y: 50 }, to: { x: 50, y: 50 }, start: 100, arrive: 900 }, glass), 100);
});
