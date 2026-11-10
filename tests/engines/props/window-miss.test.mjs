import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { windowOnFlight, missPathOk, windowOnMissPath, createMissFlights, missFlies, MISS_NEAR, MISS_LONGER } from "../../../scripts/engines/props/window-miss.mjs";
import { windowNextToMiss, nextToMiss, windowBesideMiss } from "../../../scripts/engines/props/wall-triggers.mjs";
import { planFlight, missLine } from "../../../scripts/engines/playback/flight-path.mjs";

const scene = (f = {}) => ({ id: "s", flags: { animater: { breakableProps: true, ...f } } });
const win = (id, c, extra = {}) => ({ id, c, door: 0, ds: 0, move: 20, sight: 0, light: 20, sound: 20, levels: [], flags: { animater: { breakWall: { window: true } } }, ...extra });
const stone = (id, c) => ({ id, c, door: 0, ds: 0, move: 20, sight: 20, light: 20, sound: 20, levels: [], flags: {} });
// A shooter at (50, 50) (footprint 0..100) and a target at (1000, 50) (footprint 950..1050, 0..100).
const ATT = { x: 0, y: 0, w: 100, h: 100 }, TGT = { x: 950, y: 0, w: 100, h: 100 };
const from = { x: 50, y: 50 }, aim = { x: 1000, y: 50 };
// The wall test planFlight is given: the first wall segment the line crosses that stops movement.
const collidesWith = (walls) => (a, b) => {
  let best = null, bt = Infinity;
  for (const w of walls) {
    if (!(w.move > 0)) continue;
    const [x1, y1, x2, y2] = w.c, rx = b.x - a.x, ry = b.y - a.y, sx = x2 - x1, sy = y2 - y1, den = rx * sy - ry * sx;
    if (!den) continue;
    const t = ((x1 - a.x) * sy - (y1 - a.y) * sx) / den, u = ((x1 - a.x) * ry - (y1 - a.y) * rx) / den;
    if (t > 0 && t <= 1 && u >= 0 && u <= 1 && t < bt) { bt = t; best = { x: a.x + rx * t, y: a.y + ry * t }; }
  }
  return best;
};
const SEED = "message-1";

test("ranged: the window the animation's own miss path stops at breaks, timed to the shot getting there", () => {
  const end = missLine(from, aim, { seed: SEED, gridPx: 100 });
  // a window across the whole miss line, 60% of the way to its end
  const x = 50 + (end.x - 50) * 0.6, glass = win("g", [x, -2000, x, 2000]);
  const path = planFlight({ from, targetRect: TGT, to: aim, role: "attack-miss", seed: SEED, gridPx: 100, collides: collidesWith([glass]) });
  assert.equal(path.outcome, "wall");
  const hit = windowOnFlight({ ...path, start: 100, arrive: 1100 }, [glass], scene(), []);
  assert.equal(hit.wall.id, "g");
  assert.equal(hit.at, 1100); // it stops at the window: it gets there as it arrives
  // a shot flying past (a window that does not stop movement): reached in proportion along its path
  const open = win("o", [x, -2000, x, 2000], { move: 0 });
  const past = planFlight({ from, targetRect: TGT, to: aim, role: "attack-miss", seed: SEED, gridPx: 100, collides: collidesWith([open]) });
  assert.equal(past.outcome, "past");
  const through = windowOnFlight({ ...past, start: 0, arrive: 1000 }, [open], scene(), []);
  assert.equal(through.wall.id, "o");
  assert.ok(Math.abs(through.at - 600) <= 1);
});

test("ranged: the first window on the path, never one behind the wall that stopped the shot or off its line", () => {
  const end = missLine(from, aim, { seed: SEED, gridPx: 100 });
  const at = (k) => 50 + (end.x - 50) * k;
  const first = win("first", [at(0.4), -2000, at(0.4), 2000]), second = win("second", [at(0.7), -2000, at(0.7), 2000]);
  const path = planFlight({ from, targetRect: TGT, to: aim, role: "attack-miss", seed: SEED, gridPx: 100, collides: collidesWith([first, second]) });
  assert.equal(windowOnFlight(path, [second, first], scene(), []).wall.id, "first");
  const wallFirst = stone("stone", [at(0.3), -2000, at(0.3), 2000]);
  const stopped = planFlight({ from, targetRect: TGT, to: aim, role: "attack-miss", seed: SEED, gridPx: 100, collides: collidesWith([wallFirst, first]) });
  assert.equal(windowOnFlight(stopped, [wallFirst, first], scene(), []), null);
  // a window beside the line the seeded miss does not cross
  const beside = win("beside", [500, 1000, 600, 1000]);
  assert.equal(windowOnFlight(path, [beside], scene(), []), null);
  // a window on another level than the target
  assert.equal(windowOnFlight(path, [win("up", first.c, { levels: ["up"] })], scene(), ["ground"]), null);
  assert.equal(windowOnFlight({ from, to: from }, [first], scene(), []), null);
});

test("ranged: the GM accepts a miss line from the attacker, near the target, no longer than the distance plus 3 squares", () => {
  const end = missLine(from, aim, { seed: SEED, gridPx: 100 });
  assert.equal(MISS_NEAR, 1.5); assert.equal(MISS_LONGER, 3);
  assert.equal(missPathOk({ from, to: end }, ATT, TGT, 100), true);
  // not from the attacker's token
  assert.equal(missPathOk({ from: { x: 300, y: 50 }, to: end }, ATT, TGT, 100), false);
  // too long: past the distance (950) plus 3 squares
  const len = Math.hypot(end.x - 50, end.y - 50), dir = { x: (end.x - 50) / len, y: (end.y - 50) / len };
  assert.equal(missPathOk({ from, to: { x: 50 + dir.x * 1260, y: 50 + dir.y * 1260 } }, ATT, TGT, 100), false);
  assert.equal(missPathOk({ from, to: { x: 50 + dir.x * 1240, y: 50 + dir.y * 1240 } }, ATT, TGT, 100), true);
  // a line nowhere near the target (straight down)
  assert.equal(missPathOk({ from, to: { x: 50, y: 1000 } }, ATT, TGT, 100), false);
  // close in, the line must pass within 1.5 squares of the target
  const close = { x: 300, y: 0, w: 100, h: 100 };
  const deg = (a, r) => ({ x: 50 + Math.cos(a * Math.PI / 180) * r, y: 50 + Math.sin(a * Math.PI / 180) * r });
  assert.equal(missPathOk({ from, to: deg(25, 500) }, ATT, close, 100), true);
  assert.equal(missPathOk({ from, to: deg(60, 500) }, ATT, close, 100), false);
  // a long shot's own miss line (19 squares off, 12 degrees wide, so 4 squares off at the target) is still accepted
  const farTgt = { x: 1950, y: 0, w: 100, h: 100 };
  assert.equal(missPathOk({ from, to: missLine(from, { x: 2000, y: 50 }, { seed: SEED, gridPx: 100 }) }, ATT, farTgt, 100), true);
  assert.equal(missPathOk({ from, to: deg(30, 2100) }, ATT, farTgt, 100), false); // but not a wider one
  assert.equal(missPathOk(null, ATT, TGT, 100), false);
  assert.equal(missPathOk({ from, to: end }, undefined, TGT, 100), false);
});

test("ranged: the window the GM reads off a claimed line is its first one", () => {
  const first = win("a", [400, -500, 400, 500]), second = win("b", [700, -500, 700, 500]);
  assert.equal(windowOnMissPath({ from, to: { x: 1200, y: 100 } }, [second, first], scene(), []).id, "a");
  assert.equal(windowOnMissPath({ from: null, to: { x: 1200, y: 100 } }, [first], scene(), []), null);
});

// Melee: an attacker at (150, 250) swinging at a target at (200..300, 200..300).
const swing = { attacker: { x: 150, y: 250 }, target: { x: 200, y: 200, w: 100, h: 100 } };
test("melee: a window beside the target, past its near side, joins the pool; never one on the attacker's side", () => {
  const behind = win("behind", [320, 220, 320, 280]); // just past the target's far side, on the line
  const side = win("side", [220, 320, 280, 320]); // just below it, off the line
  const attackerSide = win("mine", [150, 150, 150, 350]); // the attacker's own side
  const far = win("far", [600, 200, 600, 300]); // more than a square off
  assert.equal(windowNextToMiss(swing, [attackerSide, far, side, behind], scene(), 100, "bludgeoning", []).wall.id, "behind");
  assert.equal(windowNextToMiss(swing, [attackerSide, far], scene(), 100, "bludgeoning", []), null);
  // glass rules: poison breaks no glass; Won't break never; a broken window is gone; another level
  assert.equal(windowNextToMiss(swing, [behind], scene(), 100, "poison", []), null);
  assert.equal(windowNextToMiss(swing, [win("none", behind.c, { flags: { animater: { breakWall: { window: true, material: "none" } } } })], scene(), 100, "slashing", []), null);
  assert.equal(windowNextToMiss(swing, [win("gone", behind.c, { flags: { animater: { breakWall: { window: true, broken: { seed: 1 } } } } })], scene(), 100, "slashing", []), null);
  assert.equal(windowNextToMiss(swing, [win("up", behind.c, { levels: ["up"] })], scene(), 100, "slashing", ["ground"]), null);
  // a door is no window
  assert.equal(windowNextToMiss(swing, [{ ...behind, door: 1, flags: {} }], scene(), 100, "slashing", []), null);
  // the GM's check agrees
  assert.equal(windowBesideMiss(behind, swing.attacker, swing.target, 100), true);
  assert.equal(windowBesideMiss(side, swing.attacker, swing.target, 100), true);
  assert.equal(windowBesideMiss(attackerSide, swing.attacker, swing.target, 100), false);
  assert.equal(windowBesideMiss(far, swing.attacker, swing.target, 100), false);
  assert.equal(windowBesideMiss(win("on", [230, 250, 270, 250]), swing.attacker, swing.target, 100), false); // its middle on the target
  assert.equal(windowBesideMiss(behind, undefined, swing.target, 100), false);
});

test("melee: the pool is props and windows together, the one nearest the swing's line wins", () => {
  const crate = { id: "crate", x: 300, y: 300, width: 100, height: 100, rotation: 0, hidden: false, texture: { src: "props/Crate_Wood.webp" }, flags: {} };
  const behind = win("behind", [320, 220, 320, 280]);
  assert.deepEqual(nextToMiss(swing, { tiles: [crate], walls: [behind], scene: scene() }, 100, "bludgeoning"), { type: "wall", wall: behind });
  const inLine = { ...crate, id: "inline", x: 300, y: 200 }; // centre (350, 250): on the line
  assert.deepEqual(nextToMiss(swing, { tiles: [inLine], walls: [win("side", [220, 320, 280, 320])], scene: scene() }, 100, "bludgeoning"), { type: "tile", tile: inLine });
  assert.deepEqual(nextToMiss(swing, { tiles: [crate], walls: [], scene: scene() }, 100, "bludgeoning"), { type: "tile", tile: crate });
  assert.equal(nextToMiss(swing, { tiles: [], walls: [], scene: scene() }, 100, "bludgeoning"), null);
});

test("the shot of a roll: told then asked, asked then told, or never told", async () => {
  let t = 1000; const timers = [];
  const m = createMissFlights({ now: () => t, later: (fn, ms) => { const id = { fn, ms }; timers.push(id); return id; }, cancel: (id) => { const i = timers.indexOf(id); if (i >= 0) timers.splice(i, 1); } });
  const shot = [{ targetId: "t", from: { x: 0, y: 0 }, to: { x: 1, y: 0 }, end: { x: 2, y: 0 }, start: 0, arrive: 500 }];
  m.flown("m1", shot); t = 1300;
  assert.deepEqual(await m.wait("m1", 1500), { flights: shot, age: 300 });
  assert.equal(timers.length, 0); // its keep timer is gone
  // asked first, told later
  const asked = m.wait("m2", 1500);
  m.flown("m2", shot);
  assert.deepEqual(await asked, { flights: shot, age: 0 });
  // never told: null once the wait runs out
  const never = m.wait("m3", 1500);
  assert.equal(timers.length, 1); timers.shift().fn();
  assert.equal(await never, null);
  // a report nobody asks for is forgotten after its keep
  m.flown("m4", shot); timers.shift().fn();
  const late = m.wait("m4", 10);
  timers.shift().fn();
  assert.equal(await late, null);
  assert.equal(await m.wait(undefined, 10), null);
});

test("a thrown miss flies like a ranged one; a melee miss swings; anything else is not a strike", () => {
  assert.equal(missFlies("ranged"), true);
  assert.equal(missFlies("thrown"), true);
  assert.equal(missFlies("melee"), false);
  assert.equal(missFlies(undefined), null);
  assert.equal(missFlies("spell"), null);
});

test("a missed strike reaches windows by its weapon mode, thrown included", () => {
  const main = readFileSync(new URL("../../../scripts/main.mjs", import.meta.url), "utf8");
  const body = main.slice(main.indexOf("async function breakPropOnMiss"), main.indexOf("const propMiss ="));
  assert.ok(body.includes("ranged = missFlies(event?.weaponMode)"));
  assert.match(body, /ranged === null\) return/);
  assert.doesNotMatch(body, /weaponMode !== "melee"/);
});
