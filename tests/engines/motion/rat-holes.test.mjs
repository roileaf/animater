import test from 'node:test';
import assert from 'node:assert/strict';
import { ratHolesAt, holeFor, holeOut, holeMouth, ratStep, createVermin, HOLE_EVERY, HOLE_UNDER } from '../../../scripts/engines/motion/vermin.mjs';

// Roi: "we should add rat holes so they arent stuck in the same room lol"

// A canvas that answers everything with nothing, and the few PIXI pieces the layer puts on the map.
const blank = () => new Proxy(function () {}, { get: (_, key) => (key === Symbol.toPrimitive ? () => 0 : blank()), apply: () => blank(), set: () => true });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => blank() }) };
globalThis.Path2D ??= class { moveTo() {} lineTo() {} bezierCurveTo() {} quadraticCurveTo() {} closePath() {} };
class Sprite {
  constructor(texture) { this.texture = texture; this.visible = true; this.tint = 0xffffff; this.anchor = { set() {} }; this.scale = { set() {} }; this.rotation = 0; this.position = { x: 0, y: 0, set(x, y) { this.x = x; this.y = y; } }; }
  destroy() { this.destroyed = true; }
}
class Graphics {
  constructor() { this.visible = true; this.position = { set() {} }; }
  clear() {} lineStyle() {} moveTo() {} lineTo() {} destroy() { this.destroyed = true; }
}
const PIXI = { Sprite, Graphics, Texture: { from: (c) => ({ canvas: c }) } };
const newLayer = () => { const root = { children: [], addChild(c) { root.children.push(c); return c; } }; return { layer: createVermin({ PIXI, root: () => root, batsRoot: () => root }), root }; };

const wall = (x1, y1, x2, y2) => ({ x1, y1, x2, y2 });
// A room's four walls and one down the middle, all long enough to be worth gnawing.
const ROOM = [wall(0, 0, 1000, 0), wall(0, 600, 1000, 600), wall(0, 0, 0, 600), wall(1000, 0, 1000, 600), wall(500, 0, 500, 600)];

test('holes are gnawed through long walls, in the dark, and the same scene gets the same ones', () => {
  const holes = ratHolesAt(ROOM, { grid: 100, count: 8 });
  assert.ok(holes.length >= 1, 'a room of long walls has at least one');
  assert.deepEqual(ratHolesAt(ROOM, { grid: 100, count: 8 }), holes, 'opened again, the same walls in the same places');
  for (const h of holes) {
    const on = ROOM.some((w) => Math.abs((h.x - w.x1) * (w.y2 - w.y1) - (h.y - w.y1) * (w.x2 - w.x1)) < 1);
    assert.ok(on, 'each sits on a wall, not out in the room');
    assert.ok(Math.abs(Math.hypot(h.nx, h.ny) - 1) < 1e-9, 'and knows which way is out of it');
    assert.ok(typeof h.id === 'string' && h.id.length, 'and is known by a name of its own');
  }
  assert.equal(ratHolesAt([wall(0, 0, 80, 0)], { grid: 100 }).length, 0, 'a wall shorter than a square and a half has none');
  assert.equal(ratHolesAt(ROOM, { grid: 100, count: 8, lit: () => 1 }).length, 0, 'nor a wall lit on both sides');
  assert.ok(ratHolesAt(ROOM, { grid: 100, count: 1 }).length <= 1, 'never more than it was asked for');
  assert.deepEqual(ratHolesAt(null, {}), [], 'a scene with no walls is a scene with no holes');
  assert.deepEqual(ratHolesAt([{ x1: 'a', y1: 0, x2: 10, y2: 0 }], {}), [], 'and a wall that is not a wall is skipped');
});

test('two holes are never drawn on top of one another', () => {
  // Five walls crossing at the same point: only one gnawed gap comes out of it.
  const star = Array.from({ length: 5 }, (_, i) => { const a = (i * Math.PI) / 5; return wall(500 - Math.cos(a) * 300, 300 - Math.sin(a) * 300, 500 + Math.cos(a) * 300, 300 + Math.sin(a) * 300); });
  const holes = ratHolesAt(star, { grid: 100, count: 8 });
  for (const a of holes) for (const b of holes) if (a !== b) assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= 200, 'two squares apart at the least');
});

test('a rat makes for the nearest hole it could walk to, and none through a wall', () => {
  const rat = { x: 100, y: 100 };
  const near = { id: 'near', x: 200, y: 100, nx: 0, ny: -1, angle: 0 }, far = { id: 'far', x: 900, y: 100, nx: 0, ny: -1, angle: 0 };
  assert.equal(holeFor(rat, [far, near], { grid: 100 }), near, 'the nearest');
  assert.equal(holeFor(rat, [near, far], { grid: 100, blocked: (a, b) => b.x === 200 }), far, 'the next one along where a wall stands in the way');
  assert.equal(holeFor(rat, [far], { grid: 100, reach: 2 }), null, 'one across the map is not worth the walk');
  assert.equal(holeFor(rat, [], { grid: 100 }), null, 'and a scene with none leaves it where it is');
});

test('it comes up out of a hole far from the one it went down, never the same one', () => {
  const holes = [0, 1, 2, 3, 4, 5].map((i) => ({ id: `h${i}`, x: i * 200, y: 0, nx: 0, ny: 1, angle: 0 }));
  const went = holes[0];
  for (let i = 0; i < 40; i++) {
    const out = holeOut(went, holes, () => i / 40);
    assert.notEqual(out.id, went.id, 'not straight back out where it went in');
    assert.ok(out.x >= 400, 'and one of the far ones, so it usually surfaces in another room');
  }
  assert.equal(holeOut(went, [went]).id, went.id, 'the only hole on the map is the one it has');
});

test('it arrives nose-first out of the darker side of the wall', () => {
  const hole = { id: 'h', x: 500, y: 300, nx: 0, ny: -1, angle: 0 };
  const dark = holeMouth(hole, { grid: 100, lit: (x, y) => (y < 300 ? 1 : 0) });
  assert.ok(dark.y > 300, 'out on the side that is not lit');
  assert.ok(Math.abs(Math.hypot(dark.x - hole.x, dark.y - hole.y) - 35) < 1, 'a step clear of the wall');
  assert.ok(Math.abs(dark.angle - Math.PI / 2) < 1e-6, 'facing away from it');
  const other = holeMouth(hole, { grid: 100, lit: (x, y) => (y > 300 ? 1 : 0) });
  assert.ok(other.y < 300, 'and the other way round when the dark is');
});

test('a rat told to go to a hole walks there instead of wandering, and the light does not turn it back', () => {
  let rat = { x: 100, y: 100, angle: 0, speed: 0, wait: 0, toHole: 'h', tx: 400, ty: 100 };
  for (let i = 0; i < 200; i++) rat = ratStep(rat, { dt: 1 / 60, grid: 100, lit: () => 1, random: () => 0.5 });
  assert.ok(Math.hypot(400 - rat.x, 100 - rat.y) < 20, `it got there: ${Math.round(rat.x)},${Math.round(rat.y)}`);
  assert.ok(HOLE_EVERY > 0 && HOLE_UNDER[0] > 0 && HOLE_UNDER[1] > HOLE_UNDER[0], 'and the waits either side are real lengths of time');
});

test('a rat shut in one room comes out in the other, which it could never walk to', () => {
  // Two rooms, a solid wall down the middle at x = 500 and a hole in the outer wall of each.
  const divider = (a, b) => (a.x - 500) * (b.x - 500) < 0;
  const left = { id: 'left', x: 200, y: 0, nx: 0, ny: 1, angle: 0 };
  const right = { id: 'right', x: 800, y: 0, nx: 0, ny: 1, angle: 0 };
  const { layer } = newLayer();
  layer.populate({ spots: [{ x: 200, y: 200 }], count: 1, holes: [left, right], grid: 100, lit: () => 0 });
  assert.equal(layer.count, 1);
  assert.equal(layer.state.holes, 2, 'both holes are on the map');
  let crossed = false, hidden = false;
  for (let i = 0; i < 60 * 90 && !crossed; i++) {
    layer.tick(1 / 60, { lit: () => 0, blocked: divider, light: () => null });
    const rat = layer.state.rats[0];
    if (!rat) break;
    if (rat.under > 0) { hidden = true; assert.equal(rat.shown, false, 'nothing is drawn while it is under the floor'); }
    if (rat.x > 500) crossed = true;
  }
  assert.ok(hidden, 'it went down a hole');
  assert.ok(crossed, 'and came up in the room on the other side of a wall it cannot pass');
});

test('with no holes a rat stays where it always did, and clearing takes the holes off the map', () => {
  const { layer, root } = newLayer();
  layer.populate({ spots: [{ x: 200, y: 200 }], count: 1, holes: [], grid: 100, lit: () => 0 });
  for (let i = 0; i < 60 * 60; i++) layer.tick(1 / 60, { lit: () => 0, blocked: (a, b) => (a.x - 500) * (b.x - 500) < 0, light: () => null });
  assert.ok(layer.state.rats[0].x < 500, 'no hole, no crossing');
  const hole = { id: 'h', x: 200, y: 0, nx: 0, ny: 1, angle: 0 };
  // Lit above the wall, dark below it: the arch has to open downward, into the room a rat would come out into.
  layer.populate({ spots: [{ x: 200, y: 200 }], count: 1, holes: [hole], grid: 100, lit: (x, y) => (y < 0 ? 1 : 0) });
  const faces = root.children.find((c) => c instanceof Sprite && c.position.x === 200 && c.position.y === 0);
  assert.ok(Math.abs(Math.sin(faces.rotation)) < 1e-9 && Math.cos(faces.rotation) < 0, 'drawn opening onto the dark side, not into the rock');
  const art = root.children.filter((c) => c instanceof Sprite && c.position.x === 200 && c.position.y === 0);
  assert.ok(art.length >= 1, 'the hole is drawn on the wall');
  layer.clear();
  assert.ok(art.every((c) => c.destroyed), 'and taken off again with everything else');
});
