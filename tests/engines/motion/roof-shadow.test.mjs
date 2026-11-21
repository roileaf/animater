import test from 'node:test';
import assert from 'node:assert/strict';
import { roofsOf, roofShadowEdges, ROOF_PITCH, ROOF_RISE_MOST } from '../../../scripts/engines/motion/roof-looks.mjs';
import { wallShadowQuads } from '../../../scripts/engines/motion/wall-shadows.mjs';

// Roi, of a house with a long pale shadow and a short dark one frozen inside it: "why theres a roof shadow and wall
// shadow and why the roof shadow is stronger?" A building throws one shadow, and it is the roof's.

const GRID = 100;
const house = (extra = {}) => roofsOf({ roofs: [{ id: 'r', x: 200, y: 200, w: 600, h: 400, kind: 'slate', ...extra }] }, { grid: GRID });

test('a roof casts from its eaves at the height of the walls, and from its ridge above them', () => {
  const edges = roofShadowEdges(house(), { grid: GRID, wallTall: 2 });
  const eaves = edges.filter((e) => e.top === 2), ridge = edges.filter((e) => e.top > 2);
  assert.equal(eaves.length, 4, 'the eave ring');
  assert.equal(ridge.length, 1, 'and the ridge');
  // The eaves hang past the walls: the ring is wider than the room it covers.
  const xs = eaves.flatMap((e) => [e.c[0], e.c[2]]);
  assert.ok(Math.min(...xs) < 200 && Math.max(...xs) > 800, 'out past the walls on both sides');
  // Half the short side is two squares, so the ridge stands two squares' pitch over the walls.
  assert.equal(ridge[0].top, 2 + 2 * ROOF_PITCH);
  for (const e of edges) assert.equal(e.roof, 'r', 'each knows the roof it is of');
});

test('a great hall is tall, but its ridge is not a spire', () => {
  const big = roofsOf({ roofs: [{ id: 'b', x: 0, y: 0, w: 3000, h: 2000, kind: 'slate' }] }, { grid: GRID });
  const top = Math.max(...roofShadowEdges(big, { grid: GRID, wallTall: 2 }).map((e) => e.top));
  assert.equal(top, 2 + ROOF_RISE_MOST);
});

test('the same caster as the walls takes them, so the shadow follows the hour', () => {
  const edges = roofShadowEdges(house(), { grid: GRID, wallTall: 2 });
  const reach = (height) => {
    const quads = wallShadowQuads({ walls: edges, sun: { angle: 225, height, strength: 1 }, grid: GRID, height: 2 });
    assert.ok(quads.length >= 4, 'the roof casts');
    return Math.max(...quads.map((q) => Math.hypot(q.points[4] - q.c[2], q.points[5] - q.c[3])));
  };
  assert.ok(reach(20) > reach(60) * 2, 'long in the evening, short at noon');
});

// The first attempt told the roof to leave its painted shadow off and the roof never heard: painted-roofs.mjs hands
// the painter a chosen list of things, and the reach was not on it (Roi, looking at the result: "2 i think").
test('told a reach of nought, the layer paints the roof with no shadow thrown clear of it', async () => {
  const { createPaintedRoofs } = await import('../../../scripts/engines/motion/painted-roofs.mjs');
  const moves = [];
  const ctx = new Proxy({}, { get: (_, k) => (k === 'canvas' ? null : k === 'translate' ? (x, y) => { moves.push([x, y]); }
    : k === 'createLinearGradient' || k === 'createRadialGradient' || k === 'createPattern' ? () => ({ addColorStop() {} })
    : k === 'getImageData' ? () => ({ data: new Uint8ClampedArray(4) }) : k === 'measureText' ? () => ({ width: 0 }) : () => {}), set: () => true });
  const make = (w, h) => ({ width: w, height: h, getContext: () => ctx });
  class Container { constructor() { this.children = []; } addChild(c) { this.children.push(c); return c; } removeChild() {} destroy() {} }
  class Sprite extends Container { constructor(t) { super(); this.texture = t; this.anchor = { set() {} }; this.position = { set() {} }; this.scale = { set() {} }; } }
  const PIXI = { Container, Sprite, Texture: { from: (c) => ({ width: c.width, height: c.height, destroy() {} }) } };
  const farthest = (look) => {
    moves.length = 0;
    const root = new Container();
    const layer = createPaintedRoofs({ PIXI, root: () => root, grid: () => GRID, make });
    layer.populate({ roofs: house().map((r) => ({ ...r, key: `${r.key}:${look.shadowReach ?? 'own'}` })), look });
    layer.settle();
    // The painter's second move is the shadow's: the first puts the picture's corner in place, the next steps the
    // shadow away from the light by however far it is to reach.
    return Math.hypot(...(moves[1] ?? [0, 0]));
  };
  const own = farthest({});
  assert.ok(Math.abs(own - GRID * 0.9) < 2, `left to itself it throws one nine tenths of a square (${own})`);
  assert.equal(farthest({ shadowReach: 0 }), 0, 'and told nought, none');
});

test('no roofs, no edges; and a roof with no room is passed over', () => {
  assert.deepEqual(roofShadowEdges([], { grid: GRID }), []);
  assert.deepEqual(roofShadowEdges([{ id: 'x', room: { x: 0, y: 0, w: 0, h: 100 } }], { grid: GRID }), []);
});
