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

// Roi's picture of a round tower: its shadow with a square corner bitten out. The floor under a roof is where the
// sun's shadow is not drawn, and a cone's floor had been handed over as its box.
test('the floor under a cone is round: the corners of its box are out of doors', async () => {
  const { roofFloor } = await import('../../../scripts/engines/motion/roof-looks.mjs');
  const tower = roofsOf({ roofs: [{ id: 't', x: 0, y: 0, w: 400, h: 400, kind: 'slate', form: 'cone', round: true }] }, { grid: GRID })[0];
  assert.equal(tower.form, 'cone');
  const floor = roofFloor(tower);
  assert.ok(floor.length >= 24, 'a ring, not four corners');
  for (let i = 0; i < floor.length; i += 2) assert.ok(Math.abs(Math.hypot(floor[i] - 200, floor[i + 1] - 200) - 200) < 0.001, 'every point on the wall');
  assert.deepEqual(roofFloor(house()[0]), [200, 200, 800, 200, 800, 600, 200, 600], 'a square house keeps its box');
  assert.equal(roofFloor({ room: { x: 0, y: 0, w: 0, h: 10 } }), null);
});

// Roi, of a pyramid whose shadow was two stacked blocks: "are we sure that the shape of the shadow matches the roof
// shape for all roof shapes?" It did not. A roof is a solid with no hollows, so its shadow is the outline round the
// shadows of its corners, and that is one shape with the roof's own top to it.
test('each form of roof throws its own outline: a point for a pyramid and a cone, a ridge for the rest', async () => {
  const { roofShadows } = await import('../../../scripts/engines/motion/roof-looks.mjs');
  const { wallShadowReach } = await import('../../../scripts/engines/motion/wall-shadows.mjs');
  // The shadow falls straight up the map, from a low sun: under a high one a shallow roof's ridge does not reach past
  // its own eaves, and the shadow is rightly the eaves' and nothing more (checked at the foot of this test).
  const sun = { angle: 90, height: 20, strength: 1 };
  const cast = (extra) => {
    const roofs = roofsOf({ roofs: [{ id: 'r', x: 0, y: 0, w: 600, h: 400, kind: 'slate', ...extra }] }, { grid: GRID });
    const [shadow] = roofShadows(roofs, { grid: GRID, wallTall: 2, sun, reach: wallShadowReach });
    assert.ok(shadow, `${roofs[0].form} casts`);
    const pts = []; for (let i = 0; i < shadow.points.length; i += 2) pts.push([shadow.points[i], shadow.points[i + 1]]);
    const far = Math.min(...pts.map((p) => p[1]));
    // No hollows: walking round it, it only ever turns one way.
    const turns = pts.map((p, i) => { const a = pts[(i + 1) % pts.length], b = pts[(i + 2) % pts.length]; return Math.sign((a[0] - p[0]) * (b[1] - a[1]) - (a[1] - p[1]) * (b[0] - a[0])); }).filter(Boolean);
    assert.ok(turns.every((t) => t === turns[0]), `${roofs[0].form}: one shape, no steps in it`);
    // It still stands under the roof it came from: the eaves' near side is on the outline.
    assert.ok(Math.max(...pts.map((p) => p[1])) > 400, 'down to the eaves');
    const tip = [...new Set(pts.filter((p) => Math.abs(p[1] - far) < 0.5).map((p) => Math.round(p[0])))].map((x) => [x, far]);
    return { form: roofs[0].form, tip, far };
  };
  const hip = cast({ form: 'hip' }), pyramid = cast({ w: 400, form: 'pyramid' }), cone = cast({ w: 400, form: 'cone', round: true });
  assert.equal(hip.form, 'hip'); assert.equal(pyramid.form, 'pyramid'); assert.equal(cone.form, 'cone');
  assert.equal(hip.tip.length, 2, 'a hipped roof ends in its ridge');
  assert.ok(Math.abs(hip.tip[0][0] - hip.tip[1][0]) < 400, 'which is shorter than the house');
  assert.equal(pyramid.tip.length, 1, 'a pyramid ends in its point');
  assert.equal(pyramid.tip[0][0], 200, 'over the middle');
  assert.equal(cone.tip.length, 1, 'and so does a cone');
  // The point stands a pitch over the walls, so its shadow reaches past the eaves' own.
  assert.ok(Math.abs(pyramid.far - (200 - wallShadowReach(2 + 2 * ROOF_PITCH, 20) * GRID)) < 0.5, 'thrown from the height of the point');
  // At noon the point's shadow falls short of the eaves': the shade is square-ended, and that is the truth of it.
  const noon = roofShadows(roofsOf({ roofs: [{ id: 'p', x: 0, y: 0, w: 400, h: 400, kind: 'slate', form: 'pyramid' }] }, { grid: GRID }), { grid: GRID, wallTall: 2, sun: { angle: 90, height: 70, strength: 1 }, reach: wallShadowReach })[0];
  const ys = noon.points.filter((_, i) => i % 2), top = Math.min(...ys);
  assert.ok(new Set(noon.points.filter((v, i) => i % 2 === 0 && Math.abs(noon.points[i + 1] - top) < 0.5).map(Math.round)).size >= 2, 'a flat end under a high sun');
  assert.deepEqual(roofShadows([], { grid: GRID, sun, reach: wallShadowReach }), []);
  assert.deepEqual(roofShadows(house(), { grid: GRID, sun: null, reach: wallShadowReach }), [], 'no sun, no shadow');
});

// Seen on Roi's map: the walls there stand four squares, to their level's ceiling, and the eaves were cast from the
// setting's two, so the walls' shadow stood out past the roof's as a narrow block on a wide one.
test('a roof sits on its walls: the eaves stand as high as the walls under it', async () => {
  const { roofShadows, wallsUnder } = await import('../../../scripts/engines/motion/roof-looks.mjs');
  const { wallShadowReach } = await import('../../../scripts/engines/motion/wall-shadows.mjs');
  const roofs = house(), sun = { angle: 90, height: 45, strength: 1 };
  const walls = wallShadowQuads({ walls: [
    { c: [200, 200, 800, 200], light: 20, top: 4 }, { c: [200, 600, 800, 600], light: 20, top: 4 },
    { c: [400, 200, 400, 600], light: 20, top: 2.5 }, // a partition, lower
    { c: [2000, 0, 2000, 900], light: 20, top: 9 }, // a tower across the street is nobody's eaves
  ], sun, grid: GRID, height: 2 });
  assert.equal(wallsUnder(roofs[0], walls, { grid: GRID, usual: 2 }), 4, 'the tallest wall in its own room');
  assert.equal(wallsUnder(roofs[0], [], { grid: GRID, usual: 2 }), 2, 'and the usual height over no walls at all');
  const eavesOf = (roof) => wallsUnder(roof, walls, { grid: GRID, usual: 2 });
  assert.ok(roofShadowEdges(roofs, { grid: GRID, wallTall: eavesOf }).some((e) => e.top === 4), 'the eave ring at the walls\' top');
  const [shadow] = roofShadows(roofs, { grid: GRID, wallTall: eavesOf, sun, reach: wallShadowReach });
  const far = Math.min(...shadow.points.filter((_, i) => i % 2));
  const wallFar = Math.min(...walls.filter((q) => q.top === 4).flatMap((q) => q.points.filter((_, i) => i % 2)));
  assert.ok(far <= wallFar, 'so no wall under it throws its shadow out past the roof\'s');
});

test('no roofs, no edges; and a roof with no room is passed over', () => {
  assert.deepEqual(roofShadowEdges([], { grid: GRID }), []);
  assert.deepEqual(roofShadowEdges([{ id: 'x', room: { x: 0, y: 0, w: 0, h: 100 } }], { grid: GRID }), []);
});
