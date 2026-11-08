import { test } from 'node:test';
import assert from 'node:assert/strict';
import { perchesFrom, nextPerch, perchHopStep, perchBirdCount, perchedBird, headingOf, PERCH_KINDS, TAKEOFF, GLIDE } from '../../../scripts/engines/motion/perch-hops.mjs';

const fixed = (v = 0.5) => () => v;
const roof = (o = {}) => ({ x: 500, y: 500, width: 400, height: 200, rotation: 0, anchorX: 0.5, anchorY: 0.5, up: 2, shown: 1, seed: 7, ...o });
const run = (bird, opts, seconds, dt = 1 / 30) => { let b = bird; for (let t = 0; t < seconds; t += dt) b = perchHopStep(b, { dt, ...opts }); return b; };

test('a roof gives a ridge along the middle of its longer side, short of the ends, and four edges', () => {
  const p = perchesFrom({ roofs: [roof()], grid: 100 });
  const ridge = p.filter((q) => q.on === 'ridge');
  assert.ok(ridge.length >= 2);
  for (const q of ridge) { assert.equal(q.y, 500); assert.ok(q.x > 300 + 400 * 0.19 && q.x < 300 + 400 * 0.81); assert.equal(q.kind, 'roof'); assert.equal(q.h, 2); }
  const edges = p.filter((q) => q.on === 'edge');
  assert.ok(edges.some((q) => q.y < 420) && edges.some((q) => q.y > 580) && edges.some((q) => q.x < 320) && edges.some((q) => q.x > 680));
  // every edge perch is on the roof, pulled in from its border
  for (const q of edges) assert.ok(q.x > 300 && q.x < 700 && q.y > 400 && q.y < 600);
  // a bird on the top edge looks up the map, out over it
  assert.equal(edges.find((q) => q.key.includes(':top:')).face, 0);
});

test('a tall roof has its ridge down its length, and a turned roof turns its perches with it', () => {
  const tall = perchesFrom({ roofs: [roof({ width: 200, height: 400 })], grid: 100 }).filter((q) => q.on === 'ridge');
  for (const q of tall) assert.equal(q.x, 500);
  const turned = perchesFrom({ roofs: [roof({ rotation: Math.PI / 2 })], grid: 100 }).filter((q) => q.on === 'ridge');
  for (const q of turned) { assert.ok(Math.abs(q.x - 500) < 1e-9); assert.ok(q.y > 300 && q.y < 700); }
});

test('a small roof, or one faded for a creature under it, gives no perch; keys stay the same', () => {
  assert.equal(perchesFrom({ roofs: [roof({ width: 60, height: 60 })], grid: 100 }).length, 0);
  assert.equal(perchesFrom({ roofs: [roof({ shown: 0.2 })], grid: 100 }).length, 0);
  const a = perchesFrom({ roofs: [roof()], grid: 100 }).map((q) => q.key), b = perchesFrom({ roofs: [roof()], grid: 100 }).map((q) => q.key);
  assert.deepEqual(a, b); assert.equal(new Set(a).size, a.length);
});

test('trees and ground spots give one perch each', () => {
  const p = perchesFrom({ trees: [{ x: 10, y: 20, r: 80 }], ground: [{ x: 5, y: 6 }] });
  assert.deepEqual(p.map((q) => [q.kind, q.on, q.h]), [['tree', 'canopy', 3], ['ground', 'ground', 0]]);
});

test('the next perch is in range, free, not kept out and not reached across a place kept out', () => {
  const from = { x: 0, y: 0, key: 'here' };
  const perches = [
    { x: 0, y: 0, kind: 'tree', on: 'canopy', key: 'here' },
    { x: 100, y: 0, kind: 'tree', on: 'canopy', key: 'tooClose' },
    { x: 9000, y: 0, kind: 'tree', on: 'canopy', key: 'tooFar' },
    { x: 1000, y: 0, kind: 'roof', on: 'ridge', key: 'taken' },
    { x: 0, y: 1000, kind: 'roof', on: 'ridge', key: 'kept' },
    { x: -1000, y: 0, kind: 'roof', on: 'ridge', key: 'across' },
    { x: 1000, y: 1000, kind: 'roof', on: 'edge', key: 'ok' },
  ];
  const kept = (x, y) => (x === 0 && y === 1000) || (x < -400 && x > -600);
  for (let i = 0; i < 20; i++) assert.equal(nextPerch(from, perches, { kind: 'crows', grid: 100, taken: ['taken'], kept, random: () => i / 20 })?.key, 'ok');
  assert.equal(nextPerch(from, perches.slice(0, 3), { kind: 'crows', grid: 100 }), null);
});

test('songbirds never take a ridge; a pigeon sent down goes to the ground, up to a roof', () => {
  const from = { x: 0, y: 0, key: 'x' }, ridge = { x: 300, y: 0, kind: 'roof', on: 'ridge', key: 'r' }, ground = { x: 0, y: 300, kind: 'ground', on: 'ground', key: 'g' };
  assert.equal(nextPerch(from, [ridge], { kind: 'songbirds' }), null);
  assert.equal(nextPerch(from, [ridge, ground], { kind: 'pigeons', roofs: 0, random: fixed(0.1) }).key, 'g');
  assert.equal(nextPerch(from, [ridge, ground], { kind: 'pigeons', roofs: 1, random: fixed(0.9) }).key, 'r');
  // crows take a roof as often as they like one
  const tree = { x: 300, y: 300, kind: 'tree', on: 'canopy', key: 't' };
  assert.equal(nextPerch(from, [ridge, tree], { kind: 'crows', random: fixed(PERCH_KINDS.crows.roofs - 0.01) }).key, 'r');
  assert.equal(nextPerch(from, [ridge, tree], { kind: 'crows', random: fixed(PERCH_KINDS.crows.roofs + 0.01) }).key, 't');
});

const tree = { x: 0, y: 0, h: 3, kind: 'tree', on: 'canopy', face: 0, key: 't' };
const ridge = { x: 1200, y: 0, h: 2, kind: 'roof', on: 'ridge', face: Math.PI, key: 'r' };

test('a bird sits its time out, hidden in a tree, then flies to the next perch and sits there', () => {
  const bird = perchedBird(tree, { random: fixed(0), first: [1, 1] });
  assert.equal(bird.shown, 0);
  const sitting = run(bird, { choose: () => ridge, random: fixed(0.5) }, 0.9);
  assert.equal(sitting.mode, 'sit');
  const off = run(sitting, { choose: () => ridge, random: fixed(0.5) }, 0.2);
  assert.equal(off.mode, 'fly'); assert.equal(off.to.key, 'r'); assert.ok(Math.abs(off.a - headingOf(tree, ridge)) < 1e-9);
  const there = run(off, { choose: () => null, random: fixed(0.5) }, off.len + 0.1);
  assert.equal(there.mode, 'sit'); assert.equal(there.at.key, 'r'); assert.equal(there.x, 1200); assert.equal(there.shown, 1); assert.equal(there.a, Math.PI); assert.equal(there.lift, 2);
  assert.ok(there.wait >= PERCH_KINDS.crows.sit[0] && there.wait <= PERCH_KINDS.crows.sit[1]);
});

test('the flight beats off the perch, rises over both ends, and glides down at the last', () => {
  let b = perchHopStep(perchedBird(tree, { first: [0, 0] }), { dt: 0.01, choose: () => ridge });
  assert.equal(b.mode, 'fly');
  const seen = new Set(); let top = 0;
  while (b.mode === 'fly') { const before = b.t; b = perchHopStep(b, { dt: 0.02, choose: () => null }); if (b.mode !== 'fly') break; seen.add(b.stage); top = Math.max(top, b.lift); if (before + 0.02 < TAKEOFF) assert.equal(b.stage, 'takeoff'); if (b.len - b.t < GLIDE) assert.equal(b.stage, 'glide'); }
  assert.deepEqual([...seen].sort(), ['flap', 'glide', 'takeoff']);
  assert.ok(top > 3.5, `rises over the tree: ${top}`);
});

test('it fades out of the leaves leaving a tree and into them coming down in one', () => {
  let b = perchHopStep(perchedBird(tree, { first: [0, 0] }), { dt: 0.01, choose: () => ridge });
  b = perchHopStep(b, { dt: 0.1 });
  assert.ok(b.shown > 0 && b.shown < 1);
  b = perchHopStep(b, { dt: 0.5 });
  assert.equal(b.shown, 1);
  let back = perchHopStep(perchedBird(ridge, { first: [0, 0] }), { dt: 0.01, choose: () => tree });
  back = run(back, {}, back.len - 0.15, 0.01);
  assert.ok(back.mode === 'fly' && back.shown < 1);
});

test('someone close, a noise, or its perch gone sends it off early; nowhere to go and a perch gone and it leaves for good', () => {
  const sat = perchedBird(ridge, { first: [50, 50] });
  assert.equal(perchHopStep(sat, { near: [{ x: 1250, y: 0 }], choose: () => tree }).mode, 'fly');
  assert.equal(perchHopStep(sat, { near: [{ x: 1500, y: 0 }], choose: () => tree }).mode, 'sit');
  assert.equal(perchHopStep(sat, { noise: { x: 0, y: 0 }, choose: () => tree }).mode, 'fly');
  assert.equal(perchHopStep(sat, { here: () => false, choose: () => tree }).mode, 'fly');
  assert.equal(perchHopStep(sat, { here: () => false, choose: () => null }).mode, 'gone');
  // time up but nowhere to go: it waits and tries again
  const stay = perchHopStep(perchedBird(ridge, { first: [0, 0] }), { choose: () => null, random: fixed(0) });
  assert.equal(stay.mode, 'sit'); assert.ok(stay.wait >= 4);
  // kept still (night, rain): it sits on past its time
  assert.equal(perchHopStep(perchedBird(ridge, { first: [0, 0] }), { still: true, choose: () => tree }).mode, 'sit');
});

test('how many go about alone: none without somewhere to go, pigeons only with a roof', () => {
  const both = perchesFrom({ roofs: [roof()], trees: [{ x: 0, y: 0, r: 50 }] }), trees = perchesFrom({ trees: [{ x: 0, y: 0 }, { x: 500, y: 0 }] });
  assert.equal(perchBirdCount('crows', both, 6), 1);
  assert.equal(perchBirdCount('crows', both, 0), 0);
  assert.equal(perchBirdCount('crows', trees, 6), 0);
  assert.equal(perchBirdCount('songbirds', trees, 4), 1);
  assert.equal(perchBirdCount('pigeons', trees, 8), 0);
  assert.equal(perchBirdCount('pigeons', both, 8), 2);
});

// ---- In the layers ------------------------------------------------------------------------------------------------------
import { createWildlife } from '../../../scripts/engines/motion/wildlife.mjs';
import { createTownLife } from '../../../scripts/engines/motion/town-life.mjs';
const anyCall = new Proxy(function () {}, { get: (_, key) => (key === Symbol.toPrimitive ? () => 0 : anyCall), apply: () => anyCall, set: () => true });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => anyCall }) };
globalThis.Path2D ??= class { constructor() { return anyCall; } };
const fakePIXI = () => {
  const made = [];
  const PIXI = {
    Texture: { from: () => ({ baseTexture: { destroyed: false } }) },
    Sprite: class { constructor(t) { this.texture = t; this.visible = true; this.anchor = { set() {} }; this.position = { x: 0, y: 0, set: (x, y) => { this.position.x = x; this.position.y = y; } }; this.scale = { set() {} }; made.push(this); } destroy() { this.destroyed = true; } },
  };
  const layer = () => ({ kids: [], addChild(s) { this.kids = this.kids.filter((k) => k !== s); s.parent?.kids && s.parent !== this && (s.parent.kids = s.parent.kids.filter((k) => k !== s)); this.kids.push(s); s.parent = this; } });
  return { PIXI, made, layer };
};
const SCENE = { roofs: [roof({ x: 1500, y: 600 }), roof({ x: 600, y: 1500, seed: 9 })], trees: [{ x: 300, y: 300, r: 80 }, { x: 1800, y: 1600, r: 80 }, { x: 900, y: 400, r: 80 }] };
const tick = (engine, seconds, opts = {}) => { for (let i = 0; i < seconds * 20; i++) engine.tick(0.05, { day: 1, ...opts }); };

test('wildlife: a lone crow goes between the trees and the roofs over time, while the flock still crosses', () => {
  const { PIXI, layer } = fakePIXI(), floor = layer(), sky = layer(), shadow = layer();
  const wild = createWildlife({ PIXI, floor: () => floor, sky: () => sky, skyShadow: () => shadow });
  const perches = perchesFrom({ ...SCENE, grid: 100 });
  wild.populate({ crows: 5, perches, grid: 100, area: { x: 0, y: 0, width: 2000, height: 2000 } });
  assert.equal(wild.counts.perched, 1);
  const visited = new Set(); let flock = false, seenOnRoof = false;
  for (let s = 0; s < 600; s++) {
    tick(wild, 1);
    const b = wild.perchers[0];
    if (b.mode === 'sit') { visited.add(b.at.kind); if (b.at.kind === 'roof') seenOnRoof ||= b.view.body.visible; else assert.equal(b.view.body.visible, false, 'hidden in the leaves'); }
    if (wild.counts.crows > 1) flock = true;
  }
  assert.ok(visited.has('roof') && visited.has('tree'), [...visited].join());
  assert.ok(seenOnRoof, 'seen sitting on a roof');
  assert.ok(flock, 'the flock still crosses');
});

test('wildlife: a perch kept out, or gone, is left; a new roof can be flown to', () => {
  const { PIXI, layer } = fakePIXI(), floor = layer(), sky = layer();
  const wild = createWildlife({ PIXI, floor: () => floor, sky: () => sky });
  const perches = perchesFrom({ ...SCENE, grid: 100 });
  wild.populate({ crows: 5, perches, grid: 100, area: { x: 0, y: 0, width: 2000, height: 2000 } });
  // every tree kept out of crows: it leaves at once for a roof
  tick(wild, 0.1, { kept: (kind, x, y) => kind === 'crows' && perches.some((p) => p.kind === 'tree' && p.x === x && p.y === y) });
  assert.equal(wild.perchers[0].mode, 'fly'); assert.equal(wild.perchers[0].to.kind, 'roof');
  // the roofs go (faded): it flies on to a tree
  tick(wild, 10); wild.setPerches(perches.filter((p) => p.kind === 'tree')); tick(wild, 0.1);
  assert.equal(wild.perchers[0].to?.kind ?? wild.perchers[0].at.kind, 'tree');
});

test('wildlife: no roofs and no trees, no lone birds; clear takes them away', () => {
  const { PIXI, made, layer } = fakePIXI(), l = layer();
  const wild = createWildlife({ PIXI, floor: () => l, sky: () => l });
  wild.populate({ crows: 5, perches: [], grid: 100, area: { x: 0, y: 0, width: 2000, height: 2000 } });
  assert.equal(wild.counts.perched, 0);
  wild.populate({ crows: 5, perches: perchesFrom({ ...SCENE }), grid: 100, area: { x: 0, y: 0, width: 2000, height: 2000 } });
  wild.clear(); assert.equal(wild.busy, false); assert.ok(made.every((s) => s.destroyed));
});

test('town: now and then a pigeon goes up alone to a roof, sits there over the roof, and comes back to the flock', () => {
  const { PIXI, layer } = fakePIXI(), floor = layer(), sky = layer(), high = layer();
  const town = createTownLife({ PIXI, floor: () => floor, sky: () => sky, high: () => high });
  const spots = Array.from({ length: 20 }, (_, i) => ({ x: 200 + i * 60, y: 1000 }));
  town.populate({ spots, wallTops: [], perches: perchesFrom({ roofs: SCENE.roofs, grid: 100 }), grid: 100, busy: 'busy', random: (() => { let n = 7; return () => ((n = (n * 16807) % 2147483647) / 2147483647); })() });
  const total = town.counts.pigeons;
  let up = 0, back = false, sitting = false;
  for (let s = 0; s < 900; s++) {
    tick(town, 1, { ok: () => true });
    const c = town.counts; assert.equal(c.pigeons, total, 'none lost');
    if (c.onRoofs) { up = Math.max(up, c.onRoofs); sitting ||= high.kids.some((k) => k.visible && k.tint === undefined); }
    else if (up) back = true;
  }
  assert.ok(up >= 1, 'one went up to a roof'); assert.ok(sitting, 'drawn over the roofs'); assert.ok(back, 'and came back down');
});

test('town: without roofs, or in heavy rain, the pigeons stay with the flock', () => {
  const { PIXI, layer } = fakePIXI(), l = layer();
  const town = createTownLife({ PIXI, floor: () => l, sky: () => l, high: () => l });
  const spots = Array.from({ length: 20 }, (_, i) => ({ x: 200 + i * 60, y: 1000 }));
  town.populate({ spots, wallTops: [], perches: perchesFrom({ trees: SCENE.trees }), grid: 100, busy: 'busy' });
  for (let s = 0; s < 200; s++) { tick(town, 1, { ok: () => true }); assert.equal(town.counts.onRoofs, 0); }
  town.populate({ spots, wallTops: [], perches: perchesFrom({ roofs: SCENE.roofs }), grid: 100, busy: 'busy' });
  for (let s = 0; s < 200; s++) { tick(town, 1, { ok: () => true, rain: 0.9 }); assert.equal(town.counts.onRoofs, 0); }
});
