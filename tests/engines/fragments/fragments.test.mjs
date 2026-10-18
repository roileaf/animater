import test from "node:test";
import assert from "node:assert/strict";
import { normalizeFragments, seededRandom, polygonArea, pointInPolygon, fragmentPieces, fragmentFlight, fragmentPose } from "../../../scripts/engines/fragments/fragments.mjs";

const stage = (extra = {}) => ({ kind: "motion", motion: "fragments", duration: 1400, ...normalizeFragments({ seed: 7, ...extra }) });
const sum = (pieces) => pieces.reduce((a, p) => a + polygonArea(p.polygon), 0);
const samplesInOne = (pieces) => {
  for (let i = 0; i < 20; i++) for (let j = 0; j < 20; j++) {
    const pt = { x: -0.5 + (i + 0.5) / 20, y: -0.5 + (j + 0.5) / 20 };
    const hits = pieces.filter((p) => pointInPolygon(pt, p.polygon)).length;
    if (hits !== 1) return false;
  }
  return true;
};

test("fragment fields are clamped with pattern-aware piece counts", () => {
  assert.deepEqual(normalizeFragments({}), { pattern: "halves", cut: "attack", angle: 0, pieces: 2, spread: 0.6, spin: 30, fall: 0.3, drift: 0, fade: 600 });
  assert.equal(normalizeFragments({ pattern: "shards" }).pieces, 7);
  assert.equal(normalizeFragments({ pattern: "shards", pieces: 40 }).pieces, 10);
  assert.equal(normalizeFragments({ pattern: "dust" }).pieces, 48);
  assert.equal(normalizeFragments({ pattern: "dust", pieces: 3 }).pieces, 16);
  assert.equal(normalizeFragments({ pattern: "topBottom", pieces: 9 }).pieces, 2);
  assert.equal(normalizeFragments({ pattern: "bogus", spread: 9, spin: -5, fade: 50, seed: 12.7 }).pattern, "halves");
  const n = normalizeFragments({ spread: 9, spin: -5, fade: 50, seed: 12 });
  assert.deepEqual([n.spread, n.spin, n.fade, n.seed], [3, 0, 100, 12]);
  assert.equal(normalizeFragments({ seed: -1 }).seed, undefined);
});

test("a seed always gives the same randoms", () => {
  const a = seededRandom(42), b = seededRandom(42);
  for (let i = 0; i < 5; i++) assert.equal(a(), b());
  assert.notEqual(seededRandom(1)(), seededRandom(2)());
});

test("every pattern covers the token exactly once", () => {
  for (const pattern of ["halves", "topBottom", "shards", "dust"])
    for (const seed of [1, 7, 99, 1234])
      for (const angle of [0, 0.7, Math.PI / 2, 2.4]) {
        const pieces = fragmentPieces(stage({ pattern, seed }), angle);
        assert.ok(Math.abs(sum(pieces) - 1) < 1e-9, `${pattern} seed ${seed} angle ${angle}: area ${sum(pieces)}`);
        assert.ok(samplesInOne(pieces), `${pattern} seed ${seed} angle ${angle}: overlap or gap`);
        assert.ok(pieces.every((p) => polygonArea(p.polygon) > 1e-4), `${pattern}: no empty piece`);
      }
});

test("halves are cut along the cut angle; top/bottom is cut on the screen horizontal", () => {
  const [a, b] = fragmentPieces(stage(), 0);
  assert.ok(Math.abs(polygonArea(a.polygon) - 0.5) < 1e-9);
  assert.ok(a.centroid.y * b.centroid.y < 0, "a horizontal cut puts one half above, one below");
  const [c, d] = fragmentPieces(stage(), Math.PI / 2);
  assert.ok(c.centroid.x * d.centroid.x < 0, "a vertical cut puts one half left, one right");
  const [t, u] = fragmentPieces(stage({ pattern: "topBottom" }), 1.1);
  assert.ok(t.centroid.y * u.centroid.y < 0 && Math.abs(t.centroid.x) < 1e-9, "top/bottom ignores the attack angle");
});

test("shards and dust have the asked number of pieces; dust pieces carry their rectangle", () => {
  assert.equal(fragmentPieces(stage({ pattern: "shards", pieces: 7 }), 0).length, 7);
  const dust = fragmentPieces(stage({ pattern: "dust", pieces: 48 }), 0);
  assert.ok(dust.length >= 42 && dust.length <= 56);
  assert.ok(dust.every((p) => p.rect && p.rect.w > 0 && p.rect.h > 0));
});

test("flights are deterministic, separate halves along the cut normal, and fade to nothing", () => {
  const s = stage({ spread: 0.6 }), pieces = fragmentPieces(s, 0);
  const f0 = fragmentFlight(s, pieces[0], 0, 0), again = fragmentFlight(s, pieces[0], 0, 0);
  assert.deepEqual(f0, again);
  const top = pieces.find((p) => p.centroid.y < 0), bottom = pieces.find((p) => p.centroid.y > 0);
  const endTop = fragmentPose(s, top, fragmentFlight(s, top, 0, 0), 1), endBottom = fragmentPose(s, bottom, fragmentFlight(s, bottom, 1, 0), 1);
  assert.ok(endTop.y < endBottom.y, "halves move apart across a horizontal cut");
  assert.equal(endTop.alpha, 0);
  assert.equal(fragmentPose(s, top, fragmentFlight(s, top, 0, 0), 0).alpha, 1);
  assert.deepEqual([fragmentPose(s, top, fragmentFlight(s, top, 0, 0), 0).x, fragmentPose(s, top, fragmentFlight(s, top, 0, 0), 0).y], [0, 0]);
});

test("dust peels away edge first along the wind", () => {
  const s = stage({ pattern: "dust", drift: 0.8 }), pieces = fragmentPieces(s, 0);
  const lead = pieces.reduce((a, p) => (p.centroid.x > a.centroid.x ? p : a)), tail = pieces.reduce((a, p) => (p.centroid.x < a.centroid.x ? p : a));
  assert.ok(fragmentFlight(s, lead, 0, 0).start < fragmentFlight(s, tail, 1, 0).start, "the edge facing the wind goes first");
  const end = fragmentPose(s, lead, fragmentFlight(s, lead, 0, 0), 1);
  assert.equal(end.alpha, 0);
  assert.ok(end.x > 0, "drifts with the wind (+x here)");
});

import { createFragmentRenderer } from "../../../scripts/engines/fragments/fragment-render.mjs";

test("the renderer builds one piece per fragment on the token, moves them, and cleans up", () => {
  const made = [];
  class Container { constructor() { this.children = []; this.position = { set: (x, y) => { this.x = x; this.y = y; } }; this.scale = { set: (x, y) => { this.sx = x; this.sy = y; } }; this.alpha = 1; this.rotation = 0; made.push(this); } addChild(...c) { this.children.push(...c); } destroy() { this.destroyed = true; } }
  class Sprite { constructor(t) { this.texture = t; this.anchor = { set() {} }; this.position = { set() {} }; } }
  class Graphics { beginFill() { return this; } drawPolygon(p) { this.points = p; return this; } endFill() { return this; } }
  class Texture { constructor(base, frame) { this.baseTexture = base; this.frame = frame; } destroy() { this.destroyed = true; } }
  class Rectangle { constructor(x, y, w, h) { Object.assign(this, { x, y, width: w, height: h }); } }
  const layer = { children: [], addChild(c) { this.children.push(c); } };
  const texture = { baseTexture: {}, frame: { x: 0, y: 0, width: 200, height: 200 } };
  const token = { center: { x: 500, y: 300 }, w: 100, h: 100, mesh: { texture, rotation: 0, scale: { x: 1, y: 1 }, parent: layer } };
  const r = createFragmentRenderer({ PIXI: { Container, Sprite, Graphics, Texture, Rectangle }, grid: () => 100 });
  const handle = r.start(token, { motion: "fragments", pattern: "halves", seed: 3, duration: 1000 }, 0);
  assert.equal(layer.children.length, 2);
  handle.update(1);
  assert.ok(layer.children.every((c) => c.alpha === 0));
  handle.destroy();
  assert.ok(layer.children.every((c) => c.destroyed));
  const dust = r.start(token, { motion: "fragments", pattern: "dust", pieces: 16, seed: 3, duration: 1000 }, 0);
  assert.equal(layer.children.length, 2 + 16);
  dust.destroy();
  assert.equal(createFragmentRenderer({ PIXI: { Container, Sprite, Graphics, Texture, Rectangle }, grid: () => 100 }).start({ ...token, mesh: null }, { pattern: "halves" }, 0), null, "no artwork, no pieces");
});

function fakePixi({ failOn, strictFrame } = {}) {
  let n = 0;
  class Container { constructor() { if (failOn && ++n === failOn) throw new Error("ctor"); this.children = []; this.position = { set: (x, y) => { this.x = x; this.y = y; } }; this.alpha = 1; this.rotation = 0; } addChild(...c) { this.children.push(...c); } destroy() { this.destroyed = true; } }
  class Sprite { constructor(t) { this.texture = t; this.anchor = { set() {} }; this.position = { set() {} }; } }
  class Graphics { beginFill() { return this; } drawPolygon() { return this; } endFill() { return this; } }
  class Texture { constructor(base, frame) { if (strictFrame && (frame.x + frame.width > base.width || frame.y + frame.height > base.height)) throw new Error("frame overflow"); this.baseTexture = base; this.frame = frame; } destroy() { this.destroyed = true; } }
  class Rectangle { constructor(x, y, w, h) { Object.assign(this, { x, y, width: w, height: h }); } }
  return { Container, Sprite, Graphics, Texture, Rectangle };
}
const rig = (mesh = {}, pixi = fakePixi()) => {
  const layer = { children: [], addChild(c) { this.children.push(c); } };
  const texture = { baseTexture: { width: 333, height: 333 }, frame: { x: 0, y: 0, width: 333, height: 333 } };
  return { layer, token: { center: { x: 500, y: 300 }, w: 100, h: 100, mesh: { texture, rotation: 0, scale: { x: 1, y: 1 }, parent: layer, ...mesh } }, r: createFragmentRenderer({ PIXI: pixi, grid: () => 100 }) };
};
const halves = { motion: "fragments", pattern: "halves", seed: 1, duration: 1000 };

test("dust crop frames stay inside the texture", () => {
  const pixi = fakePixi({ strictFrame: true }), crops = [];
  const T = pixi.Texture; pixi.Texture = class extends T { constructor(...a) { super(...a); crops.push(this.frame); } };
  const { r, token } = rig({}, pixi);
  assert.ok(r.start(token, { ...halves, pattern: "dust", pieces: 20 }, 0));
  assert.equal(crops.length, 20);
  assert.ok(crops.every((f) => f.x >= 0 && f.y >= 0 && f.width >= 1 && f.height >= 1 && f.x + f.width <= 333 && f.y + f.height <= 333));
});

test("a failure midway destroys the pieces already built", () => {
  const { r, token, layer } = rig({}, fakePixi({ failOn: 3 }));
  assert.throws(() => r.start(token, { ...halves, pattern: "dust", pieces: 8 }, 0));
  assert.ok(layer.children.length > 0 && layer.children.every((c) => c.destroyed));
});

test("pieces copy the mesh's elevation and sorting", () => {
  const { r, token, layer } = rig({ elevation: 4, sortLayer: 700, sort: 9, zIndex: 3 });
  r.start(token, halves, 0);
  assert.ok(layer.children.every((c) => c.elevation === 4 && c.sortLayer === 700 && c.sort === 9 && c.zIndex === 4));
});

test("pieces take the displayed art size, and the anchor places their centre", () => {
  const { r, token, layer } = rig({ width: 150, height: 150, position: { x: 1000, y: 1000 }, anchor: { x: 0, y: 0 } });
  r.start(token, halves, 0);
  const [a, b] = layer.children;
  assert.ok(Math.abs((a.x + b.x) / 2 - 1075) < 1e-6 && Math.abs((a.y + b.y) / 2 - 1075) < 1e-6, "centred at position + half the art");
  assert.ok(Math.abs(a.x - b.x) + Math.abs(a.y - b.y) > 0);
});

test("the base transform replaces the live pose for size and place", () => {
  const { r, token, layer } = rig({ width: 300, height: 300, scale: { x: 2, y: 2 }, position: { x: 5, y: 5 }, anchor: { x: 0.5, y: 0.5 } });
  r.start(token, halves, 0, { x: 200, y: 200, rotation: 0, sx: 1, sy: 1 });
  const [a, b] = layer.children;
  assert.ok(Math.abs((a.x + b.x) / 2 - 200) < 1e-6 && Math.abs((a.y + b.y) / 2 - 200) < 1e-6);
});

// F1: a rotated token is cut and flown in screen terms.
const ends = (r, token, layer, stage, angle) => {
  const h = r.start(token, stage, angle);
  const from = layer.children.map((c) => ({ x: c.x, y: c.y }));
  h.update(1);
  return { from, to: layer.children.map((c) => ({ x: c.x, y: c.y })) };
};
test("a token turned a quarter is cut perpendicular to the swing and its halves part on screen y", () => {
  const { r, token, layer } = rig({ rotation: Math.PI / 2 });
  const { from, to } = ends(r, token, layer, { ...halves, fall: 0 }, 0);
  assert.ok(Math.abs(from[0].y - from[1].y) > 10 && Math.abs(from[0].x - from[1].x) < 1e-6, "pieces sit above and below on screen");
  assert.ok(Math.abs(to[0].y - to[1].y) > Math.abs(from[0].y - from[1].y) + 10, "they part along screen y");
  assert.ok(Math.abs(to[0].x - to[1].x) < 1e-6);
});
test("dust on a turned token blows away from an attacker on the left", () => {
  const { r, token, layer } = rig({ rotation: Math.PI / 2 });
  const { from, to } = ends(r, token, layer, { ...halves, pattern: "dust", pieces: 16, drift: 0.8 }, 0);
  const mean = (a) => a.reduce((s, p) => s + p.x, 0) / a.length;
  assert.ok(mean(to) > mean(from) + 50, `blows right: ${mean(from)} -> ${mean(to)}`);
});
test("top/bottom on a turned token still splits on the screen horizontal", () => {
  const { r, token, layer } = rig({ rotation: Math.PI / 2 });
  const { from, to } = ends(r, token, layer, { ...halves, pattern: "topBottom" }, 0);
  const top = from[0].y < from[1].y ? 0 : 1, bottom = 1 - top;
  assert.ok(from[bottom].y - from[top].y > 10, "one piece above the other at the start");
  assert.ok(to[top].y < to[bottom].y, "the top piece ends above the bottom piece");
});

test("a live base moves the pieces with it when the document is rebased mid-stage", () => {
  const { r, token, layer } = rig({ position: { x: 0, y: 0 }, anchor: { x: 0.5, y: 0.5 } });
  const base = { x: 200, y: 200, rotation: 0, sx: 1, sy: 1 };
  const h = r.start(token, halves, 0, () => base);
  h.update(0.5);
  const before = layer.children.map((c) => ({ x: c.x, y: c.y }));
  base.x += 40; base.y -= 25;
  h.update(0.5);
  layer.children.forEach((c, i) => assert.ok(Math.abs(c.x - before[i].x - 40) < 1e-9 && Math.abs(c.y - before[i].y + 25) < 1e-9));
});

import { TokenMotionPlayer } from "../../../scripts/engines/motion/motion.mjs";
test("player and renderer: pieces shift with the document when a held track lands mid-stage", () => {
  const layer = { children: [], addChild(c) { this.children.push(c); } };
  const texture = { baseTexture: { width: 100, height: 100 }, frame: { x: 0, y: 0, width: 100, height: 100 } };
  const mesh = { texture, parent: layer, width: 100, height: 100, anchor: { x: 0.5, y: 0.5 }, rotation: 0, alpha: 1,
    position: { x: 50, y: 50, set(x, y) { this.x = x; this.y = y; } }, scale: { x: 1, y: 1, set(x, y) { this.x = x; this.y = y; } } };
  const token = { mesh, visible: true, w: 100, h: 100, document: { x: 0, y: 0, rotation: 0, width: 1, height: 1, texture: {} } };
  let now = 0, queued = null;
  const player = new TokenMotionPlayer({ frame: (cb) => (queued = cb), cancel: () => {}, now: () => now, grid: () => 100, fragments: createFragmentRenderer({ PIXI: fakePixi(), grid: () => 100 }) });
  void player.play(token, { kind: "motion", motion: "fade", motionEnd: "hold", duration: 50 }, { x: 1, y: 0 }, "me");
  void player.play(token, { kind: "motion", motion: "fragments", pattern: "halves", seed: 2, duration: 1000 }, { x: 1, y: 0 }, "me");
  now = 30; queued(now);
  now = 60; queued(now);
  const before = layer.children.map((c) => ({ x: c.x, y: c.y }));
  assert.equal(before.length, 2);
  token.document.x = 100;
  queued(now);
  assert.equal(player.active.get(token).original.x, 150, "rebased");
  layer.children.forEach((c, i) => assert.ok(Math.abs(c.x - before[i].x - 100) < 1e-9 && Math.abs(c.y - before[i].y) < 1e-9));
});

// F4: robustness and sync.
import { prepareFragments } from "../../../scripts/engines/fragments/fragments.mjs";
test("a broadcast cut angle survives validation, wrapped into -pi..pi; junk is dropped", () => {
  assert.equal(normalizeFragments({ cutAngle: 1.25 }).cutAngle, 1.25);
  assert.ok(Math.abs(normalizeFragments({ cutAngle: 3 * Math.PI / 2 }).cutAngle + Math.PI / 2) < 1e-9);
  for (const bad of [undefined, null, "", "x", Infinity, NaN]) assert.equal("cutAngle" in normalizeFragments({ cutAngle: bad }), false, String(bad));
});
test("a prepared stage is normalized once and gives the same pieces, flights and poses as a raw one", () => {
  const raw = { motion: "fragments", pattern: "shards", pieces: 99, seed: 4, duration: 1000, spin: 9999 };
  const prepared = prepareFragments(raw);
  assert.equal(prepareFragments(prepared), prepared, "already prepared: returned as is");
  assert.equal(prepared.pieces, 10);
  assert.equal(prepared.spin, 720);
  const a = fragmentPieces(raw, 0.3), b = fragmentPieces(prepared, 0.3);
  assert.deepEqual(a, b);
  a.forEach((p, i) => {
    const fa = fragmentFlight(raw, p, i, 0.3, 0.2), fb = fragmentFlight(prepared, p, i, 0.3, 0.2);
    assert.deepEqual(fa, fb);
    assert.deepEqual(fragmentPose(raw, p, fa, 0.7), fragmentPose(prepared, p, fb, 0.7));
  });
});
test("no artwork logs one trace instead of failing silently", () => {
  const warn = console.warn, warns = [];
  console.warn = (...a) => warns.push(a.join(" "));
  try {
    const { r, token } = rig();
    assert.equal(r.start({ ...token, mesh: { ...token.mesh, texture: null } }, halves, 0), null);
    assert.deepEqual(warns, ["Animater fragments: no token artwork"]);
  } finally { console.warn = warn; }
});
test("one piece failing to destroy does not leak the rest", () => {
  const { r, token, layer } = rig();
  const h = r.start(token, { ...halves, pattern: "dust", pieces: 16 }, 0);
  layer.children[0].destroy = () => { throw new Error("nope"); };
  assert.doesNotThrow(() => h.destroy());
  assert.ok(layer.children.slice(1).every((c) => c.destroyed));
});

test("fragment flights keep their own eases now that path keyframes default to linear", () => {
  const moves = (a, b) => ["x", "y", "rotation", "scale", "alpha", "stretch"].some((key) => a[key] !== b[key]);
  for (const pattern of ["halves", "topBottom", "shards", "dust"]) {
    const s = stage({ pattern, spin: 90 }), pieces = fragmentPieces(s, 0);
    pieces.forEach((p, i) => {
      const k = fragmentFlight(s, p, i, 0.3).keyframes;
      for (let j = 1; j < k.length; j++) if (moves(k[j - 1], k[j])) assert.notEqual(k[j].ease, "linear", `${pattern} piece ${i} keyframe ${j}`);
    });
  }
});

test("a played fragments stage keeps its tint, not the generic effect colour", async () => {
  const { validateRecipe, previewPlan } = await import("../../../scripts/core/model.mjs");
  const recipe = validateRecipe({ id: "t", name: "T", trigger: "manual", stages: [{ stageId: "cut", kind: "motion", motion: "fragments", subject: "targets", tint: "frozen", assets: [] }] });
  const token = { id: "a", center: { x: 50, y: 50 }, w: 100, h: 100 };
  const plan = previewPlan(recipe, { source: token, targets: [{ ...token, id: "b" }] });
  assert.equal(plan.find((s) => s.motion === "fragments").tint, "frozen");
});
