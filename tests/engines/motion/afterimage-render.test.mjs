import test from 'node:test';
import assert from 'node:assert/strict';
import { createAfterimages, placeUnder } from '../../../scripts/engines/motion/afterimage-render.mjs';

const point = (x = 0, y = 0) => ({ x, y, set(x, y = x) { this.x = x; this.y = y; } });
const layer = () => ({
  children: [],
  addChild(child) { child.parent?.removeChild(child); this.children.push(child); child.parent = this; },
  removeChild(child) { this.children = this.children.filter((c) => c !== child); child.parent = null; },
});
const sprite = (texture) => ({
  texture, position: point(), rotation: 0, scale: point(1, 1), anchor: point(), alpha: 1, tint: 0xffffff, visible: true,
  parent: null, destroyed: false, destroy() { this.destroyed = true; this.parent?.removeChild(this); },
});
function fixture({ on = true } = {}) {
  let now = 0, id = 0;
  const callbacks = new Map(), made = [];
  const parent = layer();
  const mesh = { texture: { id: 'art' }, position: point(250, 120), rotation: 0.3, scale: point(-1.2, 0.8), anchor: point(0.5, 0.6),
    elevation: 5, sortLayer: 700, sort: 3, zIndex: 2, parent };
  const ghosts = createAfterimages({
    makeSprite: (texture) => { const s = sprite(texture); made.push(s); return s; },
    place: placeUnder,
    enabled: () => on,
    now: () => now,
    frame: (f) => { callbacks.set(++id, f); return id; },
    cancel: (i) => callbacks.delete(i),
  });
  const advance = (t) => { now = t; const queued = [...callbacks.values()]; callbacks.clear(); queued.forEach((f) => f()); };
  const live = () => parent.children.filter((c) => c !== mesh);
  return { ghosts, mesh, parent, made, advance, live, token: {}, pending: () => callbacks.size };
}

test('ghost copies pose and mirroring', () => {
  const { ghosts, mesh, token, live } = fixture();
  ghosts.drop(token, mesh, '#3366ff', 0);
  const [g] = live();
  assert.equal(g.texture, mesh.texture);
  assert.deepEqual([g.position.x, g.position.y], [250, 120]);
  assert.equal(g.rotation, 0.3);
  assert.deepEqual([g.scale.x, g.scale.y], [-1.2, 0.8]);
  assert.deepEqual([g.anchor.x, g.anchor.y], [0.5, 0.6]);
  assert.equal(g.tint, 0x3366ff);
  assert.equal(g.alpha, 0.4);
});

test('ghosts sit just under the token', () => {
  const { ghosts, mesh, token, live, parent } = fixture();
  ghosts.drop(token, mesh, '#ffffff', 0);
  const [g] = live();
  assert.equal(g.parent, parent);
  assert.deepEqual([g.elevation, g.sortLayer, g.sort], [5, 700, 3]);
  assert.equal(g.zIndex, 1);
});

test('a ghost with no tint gets a soft cool white', () => {
  const { ghosts, mesh, token, live } = fixture();
  ghosts.drop(token, mesh, undefined, 0);
  assert.equal(live()[0].tint, 0xdfe8ff);
});

test('ghosts fade over 350 ms on the clock they are given', () => {
  const { ghosts, mesh, token, live } = fixture();
  ghosts.drop(token, mesh, '#ffffff', 1000);
  ghosts.tick(token, 1175);
  assert.ok(Math.abs(live()[0].alpha - 0.2) < 1e-9);
  ghosts.tick(token, 1350);
  assert.equal(live().length, 0);
});

test('cap keeps 8', () => {
  const { ghosts, mesh, token, live, made } = fixture();
  for (let i = 0; i < 10; i++) ghosts.drop(token, mesh, '#ffffff', i * 10);
  assert.equal(live().length, 8);
  // Each oldest goes back to the pool and the next ghost reuses it: nine sprites ever made.
  ghosts.drop(token, mesh, '#ffffff', 100);
  assert.equal(made.length, 9);
  assert.equal(live().length, 8);
});

test('stop lets ghosts fade out', () => {
  const { ghosts, mesh, token, live, advance, pending } = fixture();
  ghosts.drop(token, mesh, '#ffffff', 0);
  ghosts.drop(token, mesh, '#ffffff', 100);
  ghosts.fadeOut(token);
  advance(200);
  assert.equal(live().length, 2);
  advance(400);
  assert.equal(live().length, 1);
  advance(500);
  assert.equal(live().length, 0);
  assert.equal(pending(), 0);
});

test('destroyed mesh ends ghosts cleanly', () => {
  const { ghosts, mesh, token, live, advance, pending } = fixture();
  ghosts.drop(token, mesh, '#ffffff', 0);
  live()[0].destroy();
  mesh.destroyed = true;
  ghosts.drop(token, mesh, '#ffffff', 10);
  ghosts.fadeOut(token);
  assert.doesNotThrow(() => advance(20));
  assert.equal(live().length, 0);
  assert.equal(pending(), 0);
});

test('disabled client draws none', () => {
  const { ghosts, mesh, token, live, made } = fixture({ on: false });
  ghosts.drop(token, mesh, '#ffffff', 0);
  assert.equal(live().length, 0);
  assert.equal(made.length, 0);
});

test('clear removes every ghost and stops fading', () => {
  const { ghosts, mesh, token, live, made, pending } = fixture();
  ghosts.drop(token, mesh, '#ffffff', 0);
  ghosts.drop(token, mesh, '#ffffff', 400);
  ghosts.tick(token, 400);
  ghosts.fadeOut(token);
  ghosts.clear();
  assert.equal(live().length, 0);
  assert.equal(pending(), 0);
  assert.ok(made.every((s) => s.destroyed));
});
