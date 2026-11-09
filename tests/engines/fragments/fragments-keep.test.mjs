import test from "node:test";
import assert from "node:assert/strict";
import { normalizeFragments, fragmentPieces, fragmentFlight, fragmentPose, FRAGMENT_TINTS, FRAGMENT_TINT_LOOKS, FRAGMENT_BEHAVIORS } from "../../../scripts/engines/fragments/fragments.mjs";
import { createFragmentRenderer } from "../../../scripts/engines/fragments/fragment-render.mjs";

test("keep: pieces never fade and hold their end pose", () => {
  const s = { duration: 1400, ...normalizeFragments({ seed: 3, pattern: "shards", keep: true }) };
  for (const [i, p] of fragmentPieces(s, 0).entries()) {
    const f = fragmentFlight(s, p, i, 0);
    assert.equal(fragmentPose(s, p, f, 1).alpha, 1);
    assert.deepEqual(fragmentPose(s, p, f, 5), fragmentPose(s, p, f, 1));
  }
  assert.equal("keep" in normalizeFragments({ keep: false }), false);
});
test("keep also overrides a flight's own fade window and glitch steps", () => {
  for (const [behavior, pattern] of [["absorb", "shards"], ["glitch", "shards"], ["burst", "dust"], ["sink", "shards"]]) {
    const s = { duration: 1400, ...normalizeFragments({ seed: 4, pattern, behavior, keep: true, towards: { x: 2, y: 1 } }) };
    for (const [i, p] of fragmentPieces(s, 0).entries()) {
      const f = fragmentFlight(s, p, i, 0);
      for (const t of [0, 0.3, 0.7, 1, 3]) assert.equal(fragmentPose(s, p, f, t).alpha, 1, `${behavior} t=${t}`);
    }
  }
});
test("without keep, pieces still fade out", () => {
  const s = { duration: 1400, ...normalizeFragments({ seed: 3, pattern: "shards" }) };
  const [p] = fragmentPieces(s, 0);
  assert.equal(fragmentPose(s, p, fragmentFlight(s, p, 0, 0), 1).alpha, 0);
});
test("scorched and frosted tints are registered", () => {
  assert.equal(FRAGMENT_TINTS.scorched, "Scorched");
  assert.equal(FRAGMENT_TINTS.frosted, "Frosted");
  assert.deepEqual(FRAGMENT_TINT_LOOKS.scorched, { tint: 0x8a6f60, alpha: 1, css: "sepia(.35) brightness(.7)" });
  assert.deepEqual(FRAGMENT_TINT_LOOKS.frosted, { tint: 0xcfe4f2, alpha: 1, css: "saturate(.6) brightness(1.1) hue-rotate(170deg)" });
  assert.equal(normalizeFragments({ tint: "scorched" }).tint, "scorched");
});

// The smallest fake of the PIXI the renderer's start() touches.
const fakePixi = () => {
  class Node {
    constructor() { this.children = []; this.position = { x: 0, y: 0, set: (x, y) => { this.position.x = x; this.position.y = y; } }; this.scale = { set() {} }; this.alpha = 1; this.rotation = 0; this.destroyed = false; }
    addChild(c) { this.children.push(c); return c; }
    destroy() { this.destroyed = true; }
  }
  class Sprite extends Node { constructor(texture) { super(); this.texture = texture; this.anchor = { set() {} }; } }
  class Graphics extends Node { beginFill() { return this; } drawPolygon() { return this; } endFill() { return this; } }
  class Texture { constructor(baseTexture, frame) { this.baseTexture = baseTexture; this.frame = frame; } destroy() {} }
  class Rectangle { constructor(x, y, width, height) { Object.assign(this, { x, y, width, height }); } }
  return { Container: Node, Sprite, Graphics, Texture, Rectangle };
};
test("the renderer cuts a tile-shaped target and keeps every piece visible", () => {
  const PIXI = fakePixi(), layer = new PIXI.Container();
  const mesh = { texture: { baseTexture: {}, frame: { x: 0, y: 0, width: 100, height: 100 } }, parent: layer, position: { x: 150, y: 150 }, anchor: { x: 0.5, y: 0.5 }, scale: { x: 1, y: 1 }, width: 100, height: 100, rotation: 0 };
  const tile = { mesh, center: { x: 150, y: 150 }, w: 100, h: 100, id: "tile1", document: { elevation: 0 } };
  const handle = createFragmentRenderer({ PIXI, grid: () => 100 }).start(tile, { seed: 3, pattern: "shards", keep: true, behavior: "bounce", tint: "scorched" }, 0);
  assert.ok(handle);
  const boxes = layer.children;
  assert.ok(boxes.length > 1);
  for (const t of [0.5, 1, 1.5]) {
    handle.update(t);
    for (const b of boxes) assert.equal(b.alpha, 1);
  }
  handle.destroy();
  assert.ok(boxes.every((b) => b.destroyed));
});
