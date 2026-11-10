import test from "node:test";
import assert from "node:assert/strict";
import { createTorchFires } from "../../../scripts/engines/props/prop-fire.mjs";

// A small stand-in for PIXI: containers with children, sprites, meshes with a shader's uniforms.
class Node {
  constructor() { this.children = []; this.visible = true; this.destroyed = false; this.alpha = 1; this.position = { x: 0, y: 0, set(x, y) { this.x = x; this.y = y; } }; this.scale = { set() {} }; }
  addChild(...c) { for (const k of c) { k.parent = this; this.children.push(k); } return c[0]; }
  destroy() { this.destroyed = true; for (const c of this.children) c.destroy(); }
}
const PIXI = {
  Container: class extends Node {},
  Sprite: class extends Node { constructor(t) { super(); this.texture = t; this.anchor = { set() {} }; } },
  Mesh: class extends Node { constructor(g, s) { super(); this.shader = s; } },
  Shader: { from: (v, f, uniforms) => ({ uniforms: { ...uniforms } }) },
  Geometry: class { addAttribute() { return this; } addIndex() { return this; } },
  Texture: { from: () => ({ baseTexture: {}, destroy() {} }) },
};
globalThis.document ??= { createElement: () => ({ getContext: () => ({ createRadialGradient: () => ({ addColorStop() {} }), fillRect() {} }) }) };
const tongues = [{ x: 10, y: 0, scale: 1 }, { x: 50, y: 0, scale: 1 }, { x: 90, y: 0, scale: 1 }];

test("a fire draws in the root over the lighting, else the fallback; not seen hides it", () => {
  const root = new PIXI.Container(), fallback = new PIXI.Container();
  let seen = false;
  const torch = createTorchFires({ PIXI, root: () => root, seen: () => seen });
  const f = torch.fire(fallback, { key: "prop:a", at: { x: 50, y: 0 }, unit: 20, tongues });
  assert.equal(f.box.parent, root);
  f.update(0);
  assert.equal(f.box.visible, false);
  seen = true; f.update(250);
  assert.equal(f.box.visible, true);
  const g = createTorchFires({ PIXI }).fire(fallback, { key: "prop:b", at: { x: 0, y: 0 }, unit: 20, tongues });
  assert.equal(g.box.parent, fallback);
});

test("below the tongue tier a fire has no tongues, only its glow and sparks", () => {
  const torch = createTorchFires({ PIXI, tongues: () => false });
  const f = torch.fire(new PIXI.Container(), { key: "prop:a", at: { x: 0, y: 0 }, unit: 20, tongues });
  assert.equal(f.box.children.filter((c) => c instanceof PIXI.Mesh).length, 0);
  assert.equal(createTorchFires({ PIXI }).fire(new PIXI.Container(), { key: "prop:a", at: { x: 0, y: 0 }, unit: 20, tongues }).box.children.filter((c) => c instanceof PIXI.Mesh).length, 3);
});

test("perTongue: each tongue shows only where it is seen, so a big bush's visible side still burns", () => {
  const asked = [];
  // only the right-hand side of the bush is in sight; its centre is not
  const seen = (key, at) => { asked.push(key); return at.x > 60; };
  const torch = createTorchFires({ PIXI, seen });
  const f = torch.fire(new PIXI.Container(), { key: "prop:bush", at: { x: 50, y: 0 }, unit: 20, tongues, perTongue: true });
  f.update(0, () => ({ level: 1 }));
  const meshes = f.box.children.filter((c) => c instanceof PIXI.Mesh);
  assert.deepEqual(meshes.map((m) => m.visible), [false, false, true]);
  assert.equal(f.box.visible, true);
  assert.ok(asked.includes("prop:bush:2"));
  // a tongue that moves into sight shows at the next look
  f.update(250, (i) => (i === 0 ? { level: 1, x: 80, y: 0 } : { level: 1 }));
  assert.equal(meshes[0].visible, true);
  // nothing in sight: the whole fire hides
  const g = createTorchFires({ PIXI, seen: () => false }).fire(new PIXI.Container(), { key: "prop:b", at: { x: 50, y: 0 }, unit: 20, tongues, perTongue: true });
  g.update(0); assert.equal(g.box.visible, false);
});

test("a fire's keys are forgotten when it goes (the flame-cover cache drops them)", () => {
  const gone = [];
  const torch = createTorchFires({ PIXI, forget: (key) => gone.push(key) });
  const f = torch.fire(new PIXI.Container(), { key: "prop:a", at: { x: 0, y: 0 }, unit: 20, tongues });
  f.destroy();
  assert.deepEqual(gone, ["prop:a"]);
  f.destroy(); // twice: once only
  assert.deepEqual(gone, ["prop:a"]);
});

test("over(): a container over the lighting for a flash, hidden where it is not seen, forgotten when it goes", () => {
  const root = new PIXI.Container(), fallback = new PIXI.Container(), gone = [];
  let seen = false;
  const torch = createTorchFires({ PIXI, root: () => root, seen: () => seen, forget: (k) => gone.push(k) });
  const o = torch.over(fallback, { key: "blast:k", at: { x: 5, y: 5 }, elevation: 0 });
  assert.equal(o.box.parent, root);
  o.update(0); assert.equal(o.box.visible, false);
  seen = true; o.update(100); assert.equal(o.box.visible, false); // looked at five times a second
  o.update(220); assert.equal(o.box.visible, true);
  o.destroy(); assert.equal(o.box.destroyed, true); assert.deepEqual(gone, ["blast:k"]);
  assert.equal(createTorchFires({ PIXI }).over(fallback, { key: "x", at: { x: 0, y: 0 } }).box.parent, fallback);
});
