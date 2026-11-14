import test from "node:test";
import assert from "node:assert/strict";
import { createPropWreckage, stumpRings } from "../../../scripts/engines/props/prop-wreck.mjs";

const noop = new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => 0 : k === "then" ? undefined : noop), apply: () => noop, set: () => true });
// A stand-in for PIXI: every container and sprite records its children; a Graphics answers any drawing call.
class Node {
  constructor(...a) { this.args = a; this.children = []; this.position = { set() {} }; this.scale = { set() {} }; this.anchor = { set() {} }; }
  addChild(c) { this.children.push(c); return c; } addChildAt(c) { this.children.push(c); return c; } getChildIndex() { return 0; } removeChild() {} destroy() {}
}
class Sprite extends Node { constructor(t) { super(t); this.texture = t; } }
class Anything extends Node {
  constructor(...a) { super(...a); return new Proxy(this, { get: (o, p) => (p in o ? o[p] : noop), set: (o, p, v) => { o[p] = v; return true; } }); }
}
const PIXI = new Proxy({ Container: Node, Sprite, Texture: { from: (c) => ({ width: c.width, height: c.height, destroy() {} }), WHITE: {} } }, { get: (t, k) => (k in t ? t[k] : Anything) });
globalThis.foundry = { canvas: { groups: { PrimaryCanvasGroup: { SORT_LAYERS: { TILES: 1 } } } } };
globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => noop }) };
globalThis.requestAnimationFrame = () => 1; globalThis.cancelAnimationFrame = () => {};
globalThis.performance ??= { now: () => 0 };

const CROWN = 322, STUMP = 78;
const tile = () => ({ id: "decor:R:oak", x: 500, y: 500, width: CROWN, height: CROWN, rotation: 0, elevation: 0, sort: 0, levels: [], texture: { src: "decor/oak.webp", anchorX: 0.5, anchorY: 0.5, scaleX: 1, scaleY: 1 }, flags: { animater: { prop: {} } }, tree: true, stump: STUMP, art: { texture: { width: CROWN, height: CROWN }, canvas: null, width: CROWN, key: "k" } });
const note = (style, seed = 5) => ({ seed, cutAngle: 0.4, pattern: "diced", pieces: 6, spread: 0.45, spin: 70, tint: "none", mark: "dust", from: { x: 0, y: 0 }, walls: [], lights: [], style });
const warned = [];
console.warn = (...a) => warned.push(a.join(" "));
async function felled(style, seed, clean = true) {
  warned.length = 0;
  const starts = [], w = createPropWreckage({ PIXI, layer: () => new Node(), grid: () => 100, now: () => 0, renderer: { start: (...a) => { starts.push(a); return { update() {}, destroy() {} }; } } });
  await w.show(tile(), note(style, seed), "none", { animate: true });
  if (clean) assert.deepEqual(warned, [], "drawn without a fault");
  return starts;
}

test("a tree broken by a blade or force throws pieces like any breakable, and they are stump-sized, not crown-sized", async () => {
  const starts = await felled("shatter");
  assert.equal(starts.length, 1, "the renderer was asked to fly pieces: not a wreck at rest");
  const [what, stage] = starts[0];
  assert.ok(stage.pieces > 0 && stage.spread > 0 && stage.duration > 0, "pieces that move");
  assert.equal(stage.keep, true, "and end lying where they land");
  assert.equal(what.w, STUMP); assert.equal(what.h, STUMP);
  assert.ok(what.w < CROWN / 3, "bounded by the trunk footprint, never the crown");
  assert.ok(what.mesh.texture.width <= STUMP * 2 + 1, "cut from a stump picture, not from the crown's");
});

test("the same tree breaks the same way on every screen: the scatter and the stump's rings are seeded", async () => {
  const [a, b, c] = [await felled("shatter", 9), await felled("shatter", 9), await felled("shatter", 10)];
  assert.deepEqual(a[0][1], b[0][1]);
  assert.notDeepEqual(a[0][1], c[0][1], "another break, another scatter");
  assert.deepEqual(stumpRings(9), stumpRings(9)); assert.notDeepEqual(stumpRings(9), stumpRings(10));
});

test("a fire's wreck is left as it was: no burst of pieces", async () => {
  for (const style of ["burn", "char"]) assert.equal((await felled(style, 5, false)).length, 0, `${style} does not take the shatter path (the stand-in PIXI is too bare to draw a fire, which is not what this checks)`);
});
