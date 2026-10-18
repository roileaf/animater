import test from "node:test";
import assert from "node:assert/strict";
import { normalizeFragments, prepareFragments, polygonArea, pointInPolygon, fragmentPieces, fragmentCount, FRAGMENT_COUNTS, FRAGMENT_PATTERNS, FRAGMENT_BEHAVIORS, FRAGMENT_TINTS } from "../../../scripts/engines/fragments/fragments.mjs";
import { validateRecipe } from "../../../scripts/core/model.mjs";

const stage = (extra = {}) => ({ kind: "motion", motion: "fragments", duration: 1400, ...normalizeFragments({ seed: 7, ...extra }) });
const NEW = ["cross", "claw", "diced", "starburst", "rings", "pixelate", "ribbons"];
const area = (pieces) => pieces.reduce((a, p) => a + polygonArea(p.polygon), 0);
const convex = (pts) => {
  let sign = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length], c = pts[(i + 2) % pts.length];
    const z = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(z) < 1e-12) continue;
    if (sign && Math.sign(z) !== sign) return false;
    sign = Math.sign(z);
  }
  return true;
};
// Samples offset so none lies on a 45-degree diagonal or an axis, where two pieces share an edge.
const coversOnce = (pieces) => {
  for (let i = 0; i < 20; i++) for (let j = 0; j < 20; j++) {
    const pt = { x: -0.5 + (i + 0.513) / 20, y: -0.5 + (j + 0.529) / 20 };
    if (pieces.filter((p) => pointInPolygon(pt, p.polygon)).length !== 1) return false;
  }
  return true;
};
const grid = (n) => { const cols = Math.ceil(Math.sqrt(n)); return cols * Math.round(n / cols); };
const expected = (pattern, n) => ({ cross: 4, claw: 4, diced: n * n, starburst: n, rings: 8 * n, pixelate: grid(n), ribbons: n })[pattern];

test("the new patterns are registered with their labels and piece ranges", () => {
  assert.deepEqual(Object.fromEntries(NEW.map((k) => [k, FRAGMENT_PATTERNS[k]])),
    { cross: "Cross cut", claw: "Claw marks", diced: "Diced", starburst: "Starburst", rings: "Rings", pixelate: "Pixelate", ribbons: "Ribbons" });
  assert.deepEqual(Object.fromEntries(NEW.map((k) => [k, FRAGMENT_COUNTS[k]])),
    { cross: [4, 4, 4], claw: [4, 4, 4], diced: [2, 6, 4], starburst: [6, 16, 10], rings: [2, 4, 3], pixelate: [16, 64, 36], ribbons: [6, 16, 10] });
  assert.deepEqual(FRAGMENT_BEHAVIORS, { burst: "Burst apart", implode: "Implode", absorb: "Drawn to the attacker", rise: "Rise away", bounce: "Fall and bounce", drip: "Melt down", crumble: "Crumble to a heap",
    flatten: "Crushed flat", shudder: "Shudder apart", glitch: "Glitch out", sink: "Sink and fade" });
  assert.deepEqual(FRAGMENT_TINTS, { none: "None", frozen: "Frozen", charred: "Charred", stone: "Stone", ghost: "Ghostly", burning: "Burning", electric: "Electric", acid: "Acid", poison: "Poison" });
});

test("piece counts follow the pattern: defaults, clamps, and a count left over from another pattern", () => {
  for (const pattern of NEW) {
    const [lo, hi, def] = FRAGMENT_COUNTS[pattern];
    assert.equal(normalizeFragments({ pattern }).pieces, def, pattern);
    assert.equal(normalizeFragments({ pattern, pieces: 999 }).pieces, hi, pattern);
    assert.equal(normalizeFragments({ pattern, pieces: 0 }).pieces, lo, pattern);
  }
  // A dust count of 48 left on a stage switched to diced is 6 per side, not 48.
  const diced = stage({ pattern: "diced", pieces: 48 });
  assert.equal(diced.pieces, 6);
  assert.equal(fragmentPieces(diced, 0).length, 36);
});

test("each new pattern tiles the token with convex pieces, for any seed, cut and turn", () => {
  for (const pattern of NEW) {
    const [lo, hi] = FRAGMENT_COUNTS[pattern];
    for (const n of [lo, hi]) for (const seed of [1, 99]) for (const angle of [0.3, 2.2]) for (const turn of [0, 0.9]) {
      const s = stage({ pattern, pieces: n, seed }), pieces = fragmentPieces(s, angle, turn), label = `${pattern} n${n} seed${seed} a${angle} t${turn}`;
      assert.equal(pieces.length, expected(pattern, n), label);
      assert.equal(fragmentCount(s), pieces.length, label);
      assert.ok(Math.abs(area(pieces) - 1) < 1e-6, `${label}: area ${area(pieces)}`);
      assert.ok(pieces.every((p) => convex(p.polygon)), `${label}: convex`);
      assert.ok(pieces.every((p) => polygonArea(p.polygon) > 1e-9), `${label}: no empty piece`);
      assert.ok(coversOnce(pieces), `${label}: overlap or gap`);
    }
  }
});

test("fragmentCount matches the pieces for the classic patterns too", () => {
  for (const pattern of ["halves", "topBottom", "shards", "dust"]) {
    const s = stage({ pattern });
    assert.equal(fragmentCount(s), fragmentPieces(s, 0.4).length, pattern);
  }
});

test("a seed always gives the same pieces; starburst turns with the seed", () => {
  for (const pattern of NEW) assert.deepEqual(fragmentPieces(stage({ pattern, seed: 5 }), 0.7, 0.2), fragmentPieces(stage({ pattern, seed: 5 }), 0.7, 0.2), pattern);
  assert.notDeepEqual(fragmentPieces(stage({ pattern: "starburst", seed: 1 }), 0), fragmentPieces(stage({ pattern: "starburst", seed: 2 }), 0));
});

test("the cut angle turns the cross and the claw cuts", () => {
  const cross0 = fragmentPieces(stage({ pattern: "cross" }), 0);
  assert.ok(cross0.some((p) => Math.abs(p.centroid.y) < 1e-9 && p.centroid.x > 0.1), "a wedge faces a swing along +x");
  const cross45 = fragmentPieces(stage({ pattern: "cross" }), Math.PI / 4);
  assert.ok(cross45.every((p) => Math.abs(Math.abs(p.centroid.x) - Math.abs(p.centroid.y)) < 1e-9), "turned 45 degrees, the wedges face the diagonals");
  // Swing -30 degrees + the 30 degree tilt: horizontal rakes, four bands down the token.
  const flat = fragmentPieces(stage({ pattern: "claw" }), -Math.PI / 6);
  assert.ok(flat.every((p) => Math.abs(p.centroid.x) < 1e-9));
  flat.map((p) => p.centroid.y).forEach((y, i) => assert.ok(Math.abs(y - [-0.375, -0.125, 0.125, 0.375][i]) < 1e-9, `band ${i}: ${y}`));
  const upright = fragmentPieces(stage({ pattern: "claw" }), Math.PI / 3);
  assert.ok(upright.every((p) => Math.abs(p.centroid.y) < 1e-9), "swing 60 degrees: vertical rakes");
});

test("ribbons stay upright on screen when the token is turned", () => {
  for (const turn of [0, 0.5, 1.2, -2]) {
    const pieces = fragmentPieces(stage({ pattern: "ribbons", pieces: 8 }), 0.3, turn);
    const span = pieces.map((p) => { const xs = p.polygon.map((q) => Math.cos(turn) * q.x - Math.sin(turn) * q.y); return [Math.min(...xs), Math.max(...xs)]; });
    for (let i = 1; i < span.length; i++) assert.ok(span[i - 1][1] <= span[i][0] + 1e-9, `turn ${turn}: strip ${i - 1} ends before strip ${i} starts on screen x`);
  }
  const level = fragmentPieces(stage({ pattern: "ribbons", pieces: 10 }), 0, 0);
  const width = (p) => Math.max(...p.polygon.map((q) => q.x)) - Math.min(...p.polygon.map((q) => q.x));
  assert.ok(level.every((p) => Math.abs(width(p) - 0.1) < 1e-9), "upright token: ten strips a tenth wide");
});

test("diced and pixelate pieces carry their rectangle; pixelate numbers its cells in scanline order; rings number their ring", () => {
  const diced = fragmentPieces(stage({ pattern: "diced", pieces: 3 }), 0);
  assert.ok(diced.every((p) => p.rect && Math.abs(p.rect.w - 1 / 3) < 1e-12 && Math.abs(p.rect.h - 1 / 3) < 1e-12));
  const pixels = fragmentPieces(stage({ pattern: "pixelate", pieces: 36 }), 0);
  assert.deepEqual(pixels.map((p) => p.order), Array.from({ length: 36 }, (_, i) => i));
  assert.ok(pixels.every((p) => p.rect));
  const rings = fragmentPieces(stage({ pattern: "rings", pieces: 3 }), 0);
  assert.deepEqual([0, 1, 2].map((k) => rings.filter((p) => p.ring === k).length), [8, 8, 8]);
  const mean = (k) => rings.filter((p) => p.ring === k).reduce((a, p) => a + Math.hypot(p.centroid.x, p.centroid.y), 0) / 8;
  assert.ok(mean(0) < mean(1) && mean(1) < mean(2), "rings grow outward");
});

test("behaviour, tint and towards are validated; defaults stay unstored", () => {
  const n = normalizeFragments({ behavior: "implode", tint: "stone", towards: { x: 1.5, y: -2 } });
  assert.deepEqual([n.behavior, n.tint, n.towards], ["implode", "stone", { x: 1.5, y: -2 }]);
  for (const bad of ["burst", "bogus", "", null, 3, "__proto__", undefined]) assert.equal("behavior" in normalizeFragments({ behavior: bad }), false, String(bad));
  for (const bad of ["none", "#ffffff", "", null, "toString", undefined]) assert.equal("tint" in normalizeFragments({ tint: bad }), false, String(bad));
  assert.deepEqual(normalizeFragments({ towards: { x: 100, y: -100 } }).towards, { x: 40, y: -40 });
  for (const bad of [null, "x", {}, { x: 1 }, { x: "1", y: 2 }, { x: NaN, y: 0 }, { x: Infinity, y: 0 }, { x: 0, y: null }])
    assert.equal("towards" in normalizeFragments({ towards: bad }), false, JSON.stringify(bad));
  const p = prepareFragments({ pattern: "cross", behavior: "nope", tint: "#ffffff", towards: { x: "a" } });
  assert.deepEqual([p.behavior, p.tint, p.towards], ["burst", "none", undefined], "junk on the raw stage does not survive");
  const q = prepareFragments({ pattern: "cross", behavior: "rise", tint: "ghost", towards: { x: 2, y: 3 } });
  assert.deepEqual([q.behavior, q.tint, q.towards], ["rise", "ghost", { x: 2, y: 3 }]);
});

test("the recipe model keeps behaviour, tint and towards; a saved stage's colour tint reads as none", () => {
  const v = (extra) => validateRecipe({ id: "x", name: "X", trigger: "manual", stages: [{ kind: "motion", motion: "fragments", pattern: "rings", ...extra }] }).stages[0];
  const kept = v({ behavior: "absorb", tint: "frozen", towards: { x: -3, y: 1 } });
  assert.deepEqual([kept.behavior, kept.tint, kept.towards], ["absorb", "frozen", { x: -3, y: 1 }]);
  const plain = v({});
  assert.equal("behavior" in plain, false);
  assert.equal("towards" in plain, false);
  const prepared = prepareFragments(plain);
  assert.deepEqual([prepared.behavior, prepared.tint], ["burst", "none"], "the generic #ffffff effect colour is not a fragments tint");
});

import { fragmentFlight, fragmentPose } from "../../../scripts/engines/fragments/fragments.mjs";

const ALL = ["halves", "topBottom", "shards", "dust", ...NEW];
const onScreen = (p, turn = 0, size = { w: 1, h: 1 }) => {
  const x = p.centroid.x * size.w, y = p.centroid.y * size.h;
  return { x: Math.cos(turn) * x - Math.sin(turn) * y, y: Math.sin(turn) * x + Math.cos(turn) * y };
};
const flights = (s, angle, turn = 0, size) => fragmentPieces(s, angle, turn).map((p, i) => {
  const f = fragmentFlight(s, p, i, angle, turn, size);
  return { p, f, end: fragmentPose(s, p, f, 1), at: (t) => fragmentPose(s, p, f, t) };
});

// Today's poses (seed 7, spin 90, drift 0.5, cut 0.4, turn 0.3), taken before this change: [piece, t, x, y, rotation, alpha].
const SNAPSHOT = {
  halves: [
    [0, 0.25, 0.034071248046767214, -0.05433828066083379, -19.930795847750872, 1],
    [0, 0.6, 0.09328651470444851, -0.1487773154339231, -70.06920415224913, 0.9333333333333333],
    [0, 0.95, 0.1164814144275584, -0.18576953154893652, -89.68858131487889, 0.11666666666666681],
    [1, 0.25, -0.034071248046767214, 0.1068338788570213, 19.930795847750872, 1],
    [1, 0.6, -0.09328651470444853, 0.2925093966986165, 70.06920415224913, 0.9333333333333333],
    [1, 0.95, -0.11648141442755842, 0.36523937429492, 89.68858131487889, 0.11666666666666681],
  ],
  topBottom: [
    [0, 0.25, 0.05249559819618752, -0.06124486456221878, -59.79238754325261, 1],
    [0, 0.6, 0.14373208126469336, -0.16768742814214224, -210.2076124567474, 0.9333333333333333],
    [0, 0.95, 0.17946984274598343, -0.20938148320364736, -269.06574394463667, 0.11666666666666681],
    [1, 0.25, 0, -1.4648352927694939e-13, 0, 1],
    [1, 0.6, 0, 0.0006996036832114794, 0, 0.9333333333333333],
    [1, 0.95, 0, 0.024565242508539895, 0, 0.11666666666666681],
  ],
  shards: [
    [0, 0.25, 0.2152570687315402, 0.1695525097641993, -45.58371882114443, 1],
    [0, 0.6, 0.3485070120349779, 0.27451009580850255, -73.8012727638334, 0.9333333333333333],
    [0, 0.95, 0.3722900092505059, 0.2932433568873147, -78.83765769736958, 0.11666666666666681],
    [6, 0.25, 0.3550078381992076, -0.20956471490236425, 17.58848499302985, 1],
    [6, 0.6, 0.5747672848509552, -0.33929093733814136, 28.4762325681746, 0.9333333333333333],
    [6, 0.95, 0.6139908535687487, -0.36244500637924587, 30.41952247767476, 0.11666666666666681],
  ],
  dust: [
    [0, 0.25, -1.4728995723696924e-13, 1.0759355403737608e-14, 0, 1],
    [0, 0.6, 0.35590384257061264, -0.02599835048911238, -45.928506341497275, 0.9230629586087842],
    [0, 0.95, 0.5715928094521667, -0.04175417182871659, -78.53644531127091, 0.08972962527545081],
    [48, 0.25, 0.6289025294912988, 0.2405924827114016, -15.692902262400578, 0.8626513271055021],
    [48, 0.6, 0.9009066792152269, 0.34465018739708314, -24.68890350510762, 0.029317993772168705],
    [48, 0.95, 0.9009071589022503, 0.3446503709057931, 37.8935175585575, 0],
  ],
};
test("halves, top/bottom, shards and dust with no behaviour pose exactly as before, at scale 1", () => {
  for (const [pattern, rows] of Object.entries(SNAPSHOT)) {
    const s = stage({ pattern, spin: 90, drift: 0.5 }), pieces = fragmentPieces(s, 0.4, 0.3);
    for (const [i, t, x, y, rotation, alpha] of rows) {
      const pose = fragmentPose(s, pieces[i], fragmentFlight(s, pieces[i], i, 0.4, 0.3), t);
      for (const [key, want] of Object.entries({ x, y, rotation, alpha })) assert.ok(Math.abs(pose[key] - want) < 1e-12, `${pattern} #${i} t=${t} ${key}: ${pose[key]} vs ${want}`);
      assert.deepEqual([pose.scale, pose.stretchY], [1, 1], `${pattern} #${i} t=${t}`);
    }
  }
});

test("flights with a behaviour are deterministic", () => {
  for (const behavior of ["implode", "absorb", "rise", "bounce", "drip", "crumble"]) {
    const s = stage({ pattern: "shards", behavior, towards: { x: -2, y: 1 } }), [p] = fragmentPieces(s, 0.3);
    assert.deepEqual(fragmentFlight(s, p, 0, 0.3, 0.2), fragmentFlight(s, p, 0, 0.3, 0.2), behavior);
  }
});

test("implode: every piece of every pattern ends at the token's centre, nearly gone; the outside goes first", () => {
  for (const pattern of ALL) for (const turn of [0, 0.8]) {
    for (const { p, end } of flights(stage({ pattern, behavior: "implode" }), 0.4, turn)) {
      const c = onScreen(p, turn);
      assert.ok(Math.hypot(c.x + end.x, c.y + end.y) < 0.05, `${pattern} turn ${turn}`);
      assert.ok(end.scale <= 0.1, `${pattern}: scale ${end.scale}`);
      assert.equal(end.alpha, 0);
    }
  }
  const dust = flights(stage({ pattern: "dust", behavior: "implode", pieces: 49 }), 0);
  assert.ok(dust[0].f.start < dust[24].f.start, "the corner speck starts before the centre one");
});

test("implode on a 2x2 token, turned, still ends at its centre", () => {
  const size = { w: 2, h: 2 };
  for (const { p, end } of flights(stage({ pattern: "cross", behavior: "implode" }), 0.2, 1.1, size)) {
    const c = onScreen(p, 1.1, size);
    assert.ok(Math.hypot(c.x + end.x, c.y + end.y) < 1e-9);
  }
});

test("absorb: pieces stream to towards, staggered by index, shrinking, fading over the last quarter", () => {
  const towards = { x: -3, y: 1.5 };
  for (const pattern of ALL) {
    const all = flights(stage({ pattern, behavior: "absorb", towards }), 0.4);
    for (const { p, end } of all) {
      const c = onScreen(p);
      assert.ok(Math.hypot(c.x + end.x - towards.x, c.y + end.y - towards.y) < 0.1, pattern);
      assert.ok(Math.abs(end.scale - 0.2) < 1e-9, `${pattern}: scale ${end.scale}`);
      assert.equal(end.alpha, 0);
    }
    const starts = all.map((x) => x.f.start);
    assert.equal(starts[0], 0, pattern);
    assert.ok(Math.abs(starts.at(-1) - 0.4) < 1e-9, pattern);
    assert.ok(starts.every((v, i) => !i || v > starts[i - 1]), `${pattern}: staggered by index`);
    const { f, at } = all.at(-1);
    assert.equal(at(f.start + (1 - f.start) * 0.7).alpha, 1, `${pattern}: still whole before the last quarter`);
  }
});

test("absorb without towards heads 1.5 squares back along the cut; a far attacker on a big turned token is still reached", () => {
  for (const { p, end } of flights(stage({ pattern: "shards", behavior: "absorb" }), 0.6)) {
    const c = onScreen(p);
    assert.ok(Math.hypot(c.x + end.x + 1.5 * Math.cos(0.6), c.y + end.y + 1.5 * Math.sin(0.6)) < 0.1);
  }
  const far = stage({ pattern: "starburst", behavior: "absorb", towards: { x: 400, y: -400 } }), size = { w: 3, h: 3 };
  assert.deepEqual(far.towards, { x: 40, y: -40 });
  for (const { p, end } of flights(far, 0.2, 1.1, size)) {
    const c = onScreen(p, 1.1, size);
    assert.ok(Math.hypot(c.x + end.x - 40, c.y + end.y + 40) < 1e-6, "lands on the clamped attacker point");
  }
});

test("rise: pieces drift up by at least the spread, swaying, shrinking to 0.4", () => {
  for (const pattern of ["dust", "cross", "ribbons", "halves"]) {
    const s = stage({ pattern, behavior: "rise", spread: 1.2 });
    for (const { end, at } of flights(s, 0)) {
      assert.ok(end.y <= at(0).y - s.spread, `${pattern}: ${end.y}`);
      assert.ok(Math.abs(end.scale - 0.4) < 1e-9);
      assert.ok(Array.from({ length: 21 }, (_, i) => Math.abs(at(i / 20).x)).some((x) => x > 0.05), `${pattern}: sways`);
      assert.equal(end.alpha, 0);
    }
  }
});

test("bounce: pieces never pass the floor 0.4 below their start, bounce back up once, and settle on it", () => {
  for (const pattern of ["shards", "diced", "halves"]) {
    for (const { at } of flights(stage({ pattern, behavior: "bounce" }), 0.3)) {
      const ys = Array.from({ length: 101 }, (_, i) => at(i / 100).y);
      assert.ok(Math.max(...ys) <= 0.4 + 1e-9, `${pattern}: never below the floor`);
      const land = ys.findIndex((y) => y >= 0.4 - 1e-9);
      assert.ok(land > 0, `${pattern}: lands`);
      assert.ok(Math.min(...ys.slice(land)) <= 0.4 - 0.1, `${pattern}: rises again after landing`);
      assert.ok(Math.abs(ys[100] - 0.4) < 1e-9, `${pattern}: settles on the floor`);
    }
  }
});

test("drip: pieces stretch down to at least twice their height and slide down by fall + 0.4", () => {
  const s = stage({ pattern: "ribbons", behavior: "drip", fall: 0.5 });
  for (const { f, end, at } of flights(s, 0)) {
    assert.equal(at(0).stretchY, 1);
    assert.ok(end.stretchY >= 2, `stretch ${end.stretchY}`);
    assert.ok(Math.abs(end.y - 0.9) < 1e-9);
    assert.ok(f.start >= 0 && f.start <= 0.3);
  }
});

test("each new pattern's own burst", () => {
  for (const { p, end } of flights(stage({ pattern: "cross" }), 0.4)) assert.ok(end.x * p.centroid.x + end.y * p.centroid.y > 0, "cross wedges fly outward");
  const claw = flights(stage({ pattern: "claw", spread: 1 }), 0.4), reach = claw.map((x) => Math.hypot(x.end.x, x.end.y));
  assert.ok(Math.min(reach[0], reach[3]) > Math.max(reach[1], reach[2]), `outer claw strips go further: ${reach}`);
  assert.deepEqual(claw.map((x) => x.f.start), [0, 0.08, 0.16, 0.24]);
  for (const { at } of flights(stage({ pattern: "diced", fall: 0.6 }), 0)) assert.ok(at(1).y > at(0.35).y, "dice fall after flying out");
  const burst = stage({ pattern: "starburst", spread: 1 });
  for (const { end } of flights(burst, 0)) assert.ok(Math.hypot(end.x, end.y) >= 1.2 * 0.9 - 1e-9, "starburst reaches spread x 1.2");
  const rings = flights(stage({ pattern: "rings", pieces: 3 }), 0);
  for (const { p, f } of rings) assert.ok(Math.abs(f.start - 0.15 * p.ring) < 1e-9, "outer rings start later");
  const pixels = flights(stage({ pattern: "pixelate", pieces: 36 }), 0);
  assert.ok(pixels.every((x, i) => !i || x.f.start > pixels[i - 1].f.start), "cells go in scanline order");
  assert.equal(pixels[0].at(0.5).alpha, 0, "the first cell is gone by half time");
  assert.equal(pixels[35].at(0.5).alpha, 1, "the last cell is still there");
  for (const { at } of flights(stage({ pattern: "ribbons", fall: 0.4, drift: 0.5 }), 0)) {
    assert.ok(Math.abs(at(1).y - 0.6) < 1e-9, "ribbons fall by fall + 0.2");
    assert.ok(Array.from({ length: 21 }, (_, i) => Math.abs(at(i / 20).x)).some((x) => x > 0.05), "ribbons sway");
  }
  for (const pattern of NEW) for (const { end } of flights(stage({ pattern }), 0.4)) assert.equal(end.alpha, 0, pattern);
});

import { createFragmentRenderer } from "../../../scripts/engines/fragments/fragment-render.mjs";
import { withFragmentTowards } from "../../../scripts/engines/motion/motion.mjs";

function fakePixi() {
  const made = { filters: [], crops: 0 };
  class Container { constructor() { this.children = []; this.alpha = 1; this.rotation = 0; this.position = { set: (x, y) => { this.x = x; this.y = y; } }; this.scale = { set: (x, y) => { this.sx = x; this.sy = y; } }; } addChild(...c) { this.children.push(...c); } destroy() { this.destroyed = true; } }
  class Sprite { constructor(t) { this.texture = t; this.anchor = { set() {} }; this.position = { set() {} }; } }
  class Graphics { beginFill() { return this; } drawPolygon() { return this; } endFill() { return this; } }
  class Texture { constructor(base, frame) { made.crops++; this.baseTexture = base; this.frame = frame; } destroy() {} }
  class Rectangle { constructor(x, y, w, h) { Object.assign(this, { x, y, width: w, height: h }); } }
  class ColorMatrixFilter { constructor() { made.filters.push(this); } greyscale(amount, multiply) { this.grey = [amount, multiply]; } }
  return { PIXI: { Container, Sprite, Graphics, Texture, Rectangle, ColorMatrixFilter }, made };
}
const table = ({ size = 100 } = {}) => {
  const { PIXI, made } = fakePixi(), layer = { children: [], addChild(c) { this.children.push(c); } };
  const texture = { baseTexture: { width: 200, height: 200 }, frame: { x: 0, y: 0, width: 200, height: 200 } };
  const token = { center: { x: 500, y: 300 }, w: size, h: size, mesh: { texture, rotation: 0, scale: { x: 1, y: 1 }, parent: layer } };
  const find = (box) => box.children.find((c) => c instanceof PIXI.Sprite) ?? box.children.map(find).find(Boolean);
  const sprites = () => layer.children.map(find);
  return { r: createFragmentRenderer({ PIXI, grid: () => 100 }), token, layer, made, sprites, PIXI };
};
const frag = (extra) => ({ motion: "fragments", seed: 3, duration: 1000, ...extra });

test("the renderer scales and stretches each piece box by its pose", () => {
  const drip = table();
  drip.r.start(drip.token, frag({ pattern: "shards", pieces: 6, behavior: "drip" }), 0).update(1);
  assert.ok(drip.layer.children.every((b) => b.sx === 1 && Math.abs(b.sy - 2.2) < 1e-9), "drip stretches to 2.2");
  const implode = table();
  implode.r.start(implode.token, frag({ pattern: "cross", behavior: "implode" }), 0).update(1);
  assert.ok(implode.layer.children.every((b) => Math.abs(b.sx - 0.05) < 1e-9 && Math.abs(b.sy - 0.05) < 1e-9));
  const plain = table();
  plain.r.start(plain.token, frag({ pattern: "halves" }), 0).update(0.5);
  assert.ok(plain.layer.children.every((b) => b.sx === 1 && b.sy === 1), "the classic patterns stay full size");
});

// Each container maps local points by R(rotation)·S(scale), as PIXI does; the chain runs from the layer child to the sprite.
const linear = (box, Sprite) => {
  const mul = (a, b) => [a[0] * b[0] + a[1] * b[2], a[0] * b[1] + a[1] * b[3], a[2] * b[0] + a[3] * b[2], a[2] * b[1] + a[3] * b[3]];
  let m = [1, 0, 0, 1], node = box;
  while (node && !(node instanceof Sprite)) {
    const c = Math.cos(node.rotation ?? 0), s = Math.sin(node.rotation ?? 0);
    m = mul(m, mul([c, -s, s, c], [node.sx ?? 1, 0, 0, node.sy ?? 1]));
    node = node.children.find((k) => k instanceof Sprite) ?? node.children.find((k) => k.children && k.rotation !== undefined);
  }
  return m;
};
test("drip on a turned token stretches straight down the screen, and the mask moves with the piece", () => {
  for (const turn of [Math.PI / 2, 0.7]) {
    const t = table();
    t.token.mesh.rotation = turn;
    t.r.start(t.token, frag({ pattern: "shards", pieces: 6, behavior: "drip", spin: 90 }), 0).update(1);
    for (const box of t.layer.children) {
      // M·Mᵀ is diag(1, stretch²) only when the stretch is along screen y, whatever the rotation.
      const [a, b, c, d] = linear(box, t.PIXI.Sprite), xx = a * a + b * b, xy = a * c + b * d, yy = c * c + d * d;
      assert.ok(Math.abs(xx - 1) < 1e-9 && Math.abs(xy) < 1e-9 && Math.abs(yy - 2.2 * 2.2) < 1e-9, `turn ${turn}: ${[xx, xy, yy]}`);
    }
    for (const sprite of t.sprites()) if (sprite.mask) assert.ok(t.layer.children.some(function holds(n) { return n.children?.includes(sprite) ? n.children.includes(sprite.mask) : n.children?.some(holds); }), "mask beside its sprite");
  }
});

test("tints set the sprite colour and alpha; stone shares one greyscale filter", () => {
  const looks = { frozen: [0xa8d8ff, 0.9], charred: [0x3a2a22, 1], ghost: [0xd8f0ff, 0.5], stone: [0xb0aca4, 1] };
  for (const [tint, [colour, alpha]] of Object.entries(looks)) {
    const t = table();
    t.r.start(t.token, frag({ pattern: "shards", pieces: 6, tint }), 0).update(0.05);
    assert.ok(t.sprites().every((s) => s.tint === colour), tint);
    assert.ok(t.layer.children.every((b) => Math.abs(b.alpha - alpha) < 1e-9), `${tint}: alpha`);
    if (tint === "stone") {
      assert.equal(t.made.filters.length, 1, "one filter for every piece");
      assert.deepEqual(t.made.filters[0].grey, [0.55, false]);
      assert.ok(t.sprites().every((s) => s.filters?.length === 1 && s.filters[0] === t.made.filters[0]));
    } else assert.ok(t.sprites().every((s) => s.filters === undefined), `${tint}: no filter`);
  }
  const none = table();
  none.r.start(none.token, frag({ pattern: "dust", pieces: 16 }), 0).update(0.05);
  assert.ok(none.sprites().every((s) => s.tint === undefined && s.filters === undefined));
  assert.equal(none.made.filters.length, 0);
});

test("diced and pixelate draw cropped sub-textures, like dust", () => {
  const t = table();
  t.r.start(t.token, frag({ pattern: "diced", pieces: 3 }), 0);
  assert.equal(t.made.crops, 9);
  t.r.start(t.token, frag({ pattern: "pixelate", pieces: 16 }), 0);
  assert.equal(t.made.crops, 25);
});

test("on a 2x2 token implode ends at its centre and absorb at the attacker point", () => {
  const t = table({ size: 200 });
  t.r.start(t.token, frag({ pattern: "diced", pieces: 3, behavior: "implode" }), 0).update(1);
  assert.ok(t.layer.children.every((b) => Math.abs(b.x - 500) < 1e-6 && Math.abs(b.y - 300) < 1e-6));
  const a = table({ size: 200 });
  a.r.start(a.token, frag({ pattern: "starburst", behavior: "absorb", towards: { x: -3, y: 0 } }), 0).update(1);
  assert.ok(a.layer.children.every((b) => Math.abs(b.x - 200) < 1e-6 && Math.abs(b.y - 300) < 1e-6), "three squares left of the centre");
});

test("the sender measures towards from the fragmented token to the attacker, once", () => {
  const a = { id: "a", center: { x: 100, y: 100 } }, b = { id: "b", center: { x: 400, y: 300 } }, frag0 = { kind: "motion", motion: "fragments" };
  const s = withFragmentTowards(frag0, b, a, b, 100);
  assert.deepEqual(s.towards, { x: -3, y: -2 });
  assert.equal(withFragmentTowards(s, b, a, { id: "c", center: { x: 0, y: 0 } }, 100), s, "never overwritten");
  assert.deepEqual(withFragmentTowards(frag0, a, a, b, 100).towards, { x: 3, y: 2 }, "the attacker itself breaking up flies toward its target");
  assert.equal(withFragmentTowards(frag0, b, null, b, 100), frag0, "no attacker known: nothing sent");
  assert.equal(withFragmentTowards(frag0, b, a, b, 0), frag0, "no grid: nothing sent");
  const shake = { kind: "motion", motion: "shake" };
  assert.equal(withFragmentTowards(shake, b, a, b, 100), shake);
});

test("the shared stone filter is reference-counted per handle and destroyed with the last one", () => {
  const t = table();
  class ColorMatrixFilter { constructor() { t.made.filters.push(this); this.destroyed = 0; } greyscale(amount, multiply) { this.grey = [amount, multiply]; } destroy() { this.destroyed++; } }
  t.PIXI.ColorMatrixFilter = ColorMatrixFilter;
  const stone = frag({ pattern: "shards", pieces: 6, tint: "stone" });
  const one = t.r.start(t.token, stone, 0), two = t.r.start(t.token, stone, 0), plain = t.r.start(t.token, frag({ pattern: "halves" }), 0);
  assert.equal(t.made.filters.length, 1, "both handles share one filter");
  const filter = t.made.filters[0];
  plain.destroy();
  one.destroy();
  assert.equal(filter.destroyed, 0, "the second handle still uses it");
  one.destroy();
  assert.equal(filter.destroyed, 0, "destroying a handle twice releases it once");
  two.destroy();
  assert.equal(filter.destroyed, 1, "the last release destroys it");
  const three = t.r.start(t.token, stone, 0);
  assert.equal(t.made.filters.length, 2, "a later start makes a fresh filter");
  assert.ok(t.sprites().slice(-6).every((s) => s.filters[0] === t.made.filters[1]));
  three.destroy();
  assert.equal(t.made.filters[1].destroyed, 1);
});

test("a stone filter that cannot be made leaves the pieces unfiltered and is not retried", () => {
  const t = table();
  let tries = 0;
  t.PIXI.ColorMatrixFilter = class { constructor() { tries++; throw new Error("no filters here"); } };
  const stone = frag({ pattern: "shards", pieces: 6, tint: "stone" });
  const one = t.r.start(t.token, stone, 0);
  one.update(0.5);
  assert.equal(t.layer.children.length, 6, "the pieces still render");
  assert.ok(t.sprites().every((s) => s.filters === undefined && s.tint === 0xb0aca4));
  t.r.start(t.token, stone, 0).destroy();
  one.destroy();
  assert.equal(tries, 1, "tried once for the renderer, not per piece or per start");
  const nested = table();
  delete nested.PIXI.ColorMatrixFilter;
  nested.PIXI.filters = { ColorMatrixFilter: class { constructor() { nested.made.filters.push(this); } greyscale(a, m) { this.grey = [a, m]; } destroy() {} } };
  nested.r.start(nested.token, stone, 0);
  assert.equal(nested.made.filters.length, 1, "PIXI.filters.ColorMatrixFilter is the fallback");
  assert.ok(nested.sprites().every((s) => s.filters?.[0] === nested.made.filters[0]));
});

test("crumble: every piece of every pattern ends in a low heap at the token's feet, a little wider than the token", () => {
  for (const pattern of ALL) for (const turn of [0, 0.8]) for (const size of [{ w: 1, h: 1 }, { w: 2, h: 2 }]) {
    const s = { ...stage({ pattern, behavior: "crumble", spin: 40, fade: 900 }), duration: 2200 };
    for (const { p, f, end } of flights(s, 0.4, turn, size)) {
      const c = onScreen(p, turn, size), x = c.x + end.x, y = c.y + end.y;
      for (const v of [x, y, end.rotation, end.scale, f.start, f.end]) assert.ok(Number.isFinite(v), `${pattern}: ${v}`);
      assert.ok(y >= 0.45 * size.h - 1e-9 && y <= 0.55 * size.h + 1e-9, `${pattern} turn ${turn}: lands at ${y / size.h} of the height below centre`);
      assert.ok(Math.abs(x) <= (turn ? 0.95 : 0.75) * size.w, `${pattern}: heap x ${x}`);
      assert.ok(Math.abs(end.rotation) <= s.spin * 0.5 + 1e-9, `${pattern}: rotates a little`);
      assert.equal(end.scale, 1);
      assert.equal(end.alpha, 0);
    }
  }
});

test("crumble: higher pieces start falling first, pieces fall straight down with a small jitter, and fade only late", () => {
  const s = { ...stage({ pattern: "dust", pieces: 49, behavior: "crumble", spin: 40, fade: 900 }), duration: 2200 }, all = flights(s, 0);
  const top = all.filter(({ p }) => p.centroid.y < -0.3), bottom = all.filter(({ p }) => p.centroid.y > 0.3);
  assert.ok(top.length && bottom.length);
  assert.ok(Math.max(...top.map(({ f }) => f.start)) < Math.min(...bottom.map(({ f }) => f.start)), "the top goes first");
  for (const { p, f, at } of all) {
    assert.ok(f.start >= 0 && f.end <= 1 && f.end > f.start);
    assert.deepEqual([at(f.start).x, at(f.start).y], [0, 0], "still until its turn");
    assert.ok(Math.abs(at(1).x) <= Math.abs(p.centroid.x) * 0.2 + 0.08 + 1e-9, "mostly straight down");
    // The stage's fade window is the last 900 / 2200; the pieces stay solid through most of it.
    const window = 1 - 900 / 2200;
    assert.equal(at(window + (1 - window) * 0.5).alpha, 1, "still solid halfway through the fade window");
    assert.ok(at(0.99).alpha < 1);
  }
  const xs = all.map(({ at }) => at(1).x);
  assert.ok(new Set(xs.map((x) => x.toFixed(4))).size > 10, "jittered, not lockstep");
});

test("crumble is deterministic per seed and differs between seeds", () => {
  const ends = (seed) => flights(stage({ pattern: "shards", behavior: "crumble", seed }), 0.3).map(({ end }) => [end.x, end.y, end.rotation]);
  assert.deepEqual(ends(3), ends(3));
  assert.notDeepEqual(ends(3), ends(4));
  assert.equal(normalizeFragments({ behavior: "crumble" }).behavior, "crumble");
});

test("the damage tints validate, and a hex colour still reads as none", () => {
  for (const tint of ["burning", "electric", "acid", "poison"]) assert.equal(normalizeFragments({ tint }).tint, tint);
  assert.equal(prepareFragments({ pattern: "shards", tint: "#ff9a4a" }).tint, "none");
});

test("the renderer squashes flatten pieces wide and flat along the screen, and wears the damage tints", () => {
  const flat = table();
  flat.r.start(flat.token, frag({ pattern: "crush", behavior: "flatten" }), 0).update(1);
  assert.ok(flat.layer.children.every((b) => Math.abs(b.sx - 1.15) < 1e-9 && Math.abs(b.sy - 0.35) < 1e-9), "1.15 wide, 0.35 high");
  for (const turn of [Math.PI / 2, 0.7]) {
    const t = table();
    t.token.mesh.rotation = turn;
    t.r.start(t.token, frag({ pattern: "shards", pieces: 6, behavior: "flatten", spin: 90 }), 0).update(1);
    for (const box of t.layer.children) {
      const [a, b, c, d] = linear(box, t.PIXI.Sprite), xx = a * a + b * b, xy = a * c + b * d, yy = c * c + d * d;
      assert.ok(Math.abs(xx - 1.15 * 1.15) < 1e-9 && Math.abs(xy) < 1e-9 && Math.abs(yy - 0.35 * 0.35) < 1e-9, `turn ${turn}: ${[xx, xy, yy]}`);
    }
  }
  const looks = { burning: [0xff9a4a, 1], electric: [0xbfe6ff, 0.95], acid: [0xa6e05a, 1], poison: [0x9ac885, 0.9] };
  for (const [tint, [colour, alpha]] of Object.entries(looks)) {
    const t = table();
    t.r.start(t.token, frag({ pattern: "shards", pieces: 6, tint }), 0).update(0.05);
    assert.ok(t.sprites().every((s) => s.tint === colour && s.filters === undefined), tint);
    assert.ok(t.layer.children.every((b) => Math.abs(b.alpha - alpha) < 1e-9), `${tint}: alpha`);
  }
});
