import test from 'node:test';
import assert from 'node:assert/strict';
import { wallShadowQuads, wallShadowStrength, wallShadowReach, inWallShade, createWallShadows, WALL_SHADOW_CAP } from '../../../scripts/engines/motion/wall-shadows.mjs';

const grid = 100;
// A wall running north–south at x = 500, from y 0 to 400, blocking light normally.
const wall = { c: [500, 0, 500, 400], light: 20, door: 0, ds: 0 };
// The sun in the west (screen degrees toward it: 180), 45° up: shadows fall east, as long as the wall is tall.
const west = { angle: 180, height: 45, strength: 1 };

test('a wall in the sun casts its shadow away from it, as long as its height throws it', () => {
  const [q] = wallShadowQuads({ walls: [wall], sun: west, grid, height: 2 });
  assert.equal(q.alpha, 1);
  assert.equal(q.top, 2);
  const xs = q.points.filter((_, i) => i % 2 === 0), ys = q.points.filter((_, i) => i % 2 === 1);
  assert.ok(Math.abs(Math.min(...xs) - 500) < 1e-9 && Math.abs(Math.max(...xs) - 700) < 1e-6, 'from the wall two squares east');
  assert.deepEqual([Math.min(...ys), Math.max(...ys)].map((v) => Math.round(v) + 0), [0, 400]);
  // A lower sun, a longer shadow; a wall of its own height (Wall Height's top) casts by that.
  const low = wallShadowQuads({ walls: [wall], sun: { ...west, height: 20 }, grid, height: 2 })[0];
  assert.ok(Math.max(...low.points.filter((_, i) => i % 2 === 0)) > 700);
  const tall = wallShadowQuads({ walls: [{ ...wall, top: 4 }], sun: west, grid, height: 2 })[0];
  assert.equal(tall.top, 4);
  assert.ok(Math.abs(Math.max(...tall.points.filter((_, i) => i % 2 === 0)) - 900) < 1e-6);
});

test('a wall raised off the floor (Wall Height’s bottom) casts from its bottom to its top: lit beside it', () => {
  // A rail from 1 to 2 squares up, the sun at 45° in the west: its shadow lies one to two squares east.
  const [q] = wallShadowQuads({ walls: [{ ...wall, bottom: 1, top: 2 }], sun: west, grid, height: 2 });
  const xs = q.points.filter((_, i) => i % 2 === 0);
  assert.ok(Math.abs(Math.min(...xs) - 600) < 1e-6 && Math.abs(Math.max(...xs) - 700) < 1e-6);
  assert.equal(q.bottom, 1);
  assert.equal(inWallShade({ x: 550, y: 200 }, [q]), 0, 'lit right beside it');
  assert.equal(inWallShade({ x: 650, y: 200 }, [q]), 1);
  // On the floor or below it, as a wall standing on the floor; a bottom at or past its top casts nothing.
  assert.deepEqual(wallShadowQuads({ walls: [{ ...wall, bottom: -1, top: 2 }], sun: west, grid })[0].points, wallShadowQuads({ walls: [wall], sun: west, grid })[0].points);
  assert.equal(wallShadowQuads({ walls: [{ ...wall, bottom: 2, top: 2 }], sun: west, grid }).length, 0);
  // Its own bottom with the world's height: up from that bottom.
  const hung = wallShadowQuads({ walls: [{ ...wall, bottom: 3 }], sun: west, grid, height: 2 })[0];
  assert.equal(hung.top, 5);
});

test('a wall’s height: the Wall Height module’s, else its own Animater fields, else the level’s ceiling, else the world’s', async () => {
  const { wallSpan } = await import('../../../scripts/engines/motion/wall-shadows.mjs');
  // Scene units (5 ft a square), up from the level's floor at 10 ft.
  const at = { floor: 10, per: 5, ceiling: 30 };
  assert.deepEqual(wallSpan({ 'wall-height': { top: 25, bottom: 15 }, animater: { shadowTop: 40 } }, at), { top: 3, bottom: 1 }, 'Wall Height first');
  assert.deepEqual(wallSpan({ animater: { shadowTop: 20, shadowBottom: 15 } }, at), { top: 2, bottom: 1 }, 'its own fields');
  assert.deepEqual(wallSpan({ animater: { shadowTop: null, shadowBottom: 15 } }, at), { top: 4, bottom: 1 }, 'a bottom alone: the ceiling above it');
  assert.deepEqual(wallSpan({}, at), { top: 4, bottom: null }, 'the level’s ceiling');
  assert.deepEqual(wallSpan({}, { floor: 0, per: 5, ceiling: null }), { top: null, bottom: null }, 'the world’s height');
  assert.deepEqual(wallSpan({ animater: { shadowTop: '' } }, { floor: 0, per: 5 }), { top: null, bottom: null }, 'an emptied field');
});

test('a big creature half in a wall’s shade is half shaded: its footprint, not only its middle', async () => {
  const { shadeAcross } = await import('../../../scripts/engines/motion/wall-shadows.mjs');
  // The wall's shadow from x 500 to 700 (sun in the west, a wall 2 squares tall).
  const quads = wallShadowQuads({ walls: [wall], sun: west, grid, height: 2 });
  assert.equal(shadeAcross({ x: 600, y: 200 }, 100, quads), 1, 'a small creature wholly in it');
  assert.equal(shadeAcross({ x: 400, y: 200 }, 100, quads), 0, 'wholly out');
  // A dragon three squares wide, its middle just inside the shadow's edge: a third of it out in the sun.
  const dragon = shadeAcross({ x: 650, y: 200 }, 300, quads);
  assert.ok(dragon > 0.3 && dragon < 0.8, String(dragon));
  assert.equal(shadeAcross({ x: 600, y: 200 }, 100, quads, { elevation: 2 }), 0, 'above the wall');
});

test('how long a shadow reaches: height over the tangent of the sun, never past the cap', () => {
  assert.ok(Math.abs(wallShadowReach(2, 45) - 2) < 1e-9);
  assert.equal(wallShadowReach(2, 1), WALL_SHADOW_CAP);
  assert.equal(wallShadowReach(2, 90 - 1e-12) >= 0, true);
});

test('which walls cast: light-blocking ones whole, limited and window-like ones half, open doors and see-through none', () => {
  assert.equal(wallShadowStrength(wall), 1);
  assert.equal(wallShadowStrength({ ...wall, light: 0 }), 0, 'lets light through');
  assert.equal(wallShadowStrength({ ...wall, light: 10 }), 0.5, 'limited (foliage)');
  assert.equal(wallShadowStrength({ ...wall, light: 30 }), 0.5, 'proximity (a window)');
  assert.equal(wallShadowStrength({ ...wall, door: 1, ds: 1 }), 0, 'an open door');
  assert.equal(wallShadowStrength({ ...wall, door: 1, ds: 0 }), 1, 'a closed door');
  assert.equal(wallShadowStrength({ ...wall, door: 2, ds: 2 }), 1, 'a locked secret door');
  assert.equal(wallShadowQuads({ walls: [{ ...wall, light: 0 }], sun: west, grid }).length, 0);
});

test('no sun, no wall shadows', () => {
  assert.deepEqual(wallShadowQuads({ walls: [wall], sun: null, grid }), []);
  assert.deepEqual(wallShadowQuads({ walls: [wall], sun: { ...west, strength: 0 }, grid }), []);
});

test('a creature in a wall’s shade, unless it stands or flies above the wall', () => {
  const quads = wallShadowQuads({ walls: [wall], sun: west, grid, height: 2 });
  assert.equal(inWallShade({ x: 600, y: 200 }, quads), 1, 'behind the wall');
  assert.equal(inWallShade({ x: 400, y: 200 }, quads), 0, 'on its sunny side');
  assert.equal(inWallShade({ x: 800, y: 200 }, quads), 0, 'past the shadow');
  assert.equal(inWallShade({ x: 600, y: 200 }, quads, { elevation: 2 }), 0, 'as high as the wall');
  const half = wallShadowQuads({ walls: [{ ...wall, light: 10 }], sun: west, grid, height: 2 });
  assert.equal(inWallShade({ x: 600, y: 200 }, half), 0.5);
});

test('the layer bakes the shadows once into one soft picture under the creatures, and clears', () => {
  const made = [];
  class Container { constructor() { this.children = []; } addChild(c) { this.children.push(c); c.parent = this; return c; } removeChild(c) { this.children = this.children.filter((x) => x !== c); } destroy() { this.destroyed = true; } }
  class Graphics extends Container { constructor() { super(); this.fills = []; } beginFill(c, a) { this.fill = a; return this; } drawPolygon(p) { this.fills.push({ p, a: this.fill }); return this; } endFill() { return this; } clear() { this.fills = []; } }
  class Sprite extends Container { constructor(t) { super(); this.texture = t; this.position = { set: (x, y) => { this.x = x; this.y = y; } }; this.scale = { set: (x, y) => { this.sx = x; this.sy = y; } }; } }
  const PIXI = { Container, Graphics, Sprite, BLEND_MODES: { ERASE: 'erase' }, RenderTexture: { create: (o) => { const t = { ...o, destroy() { t.destroyed = true; } }; made.push(t); return t; } }, BlurFilter: class { constructor(s) { this.strength = s; } } };
  const renders = [];
  const root = new Container();
  const shadows = createWallShadows({ PIXI, root: () => root, render: (g, rt) => renders.push({ g, rt }) });
  const quads = wallShadowQuads({ walls: [wall], sun: west, grid, height: 2 });
  shadows.build({ quads, bounds: { x: 0, y: 0, width: 2000, height: 1000 }, alpha: 0.4, indoors: [[0, 0, 100, 0, 100, 100]] });
  assert.equal(renders.length, 2, 'baked once, with its sunlit floor');
  assert.equal(root.children.length, 1, 'one picture');
  const sprite = root.children[0];
  assert.equal(sprite.alpha, 0.4);
  assert.ok(sprite.sx > 1, 'drawn small and scaled up (soft, cheap)');
  assert.ok(made[0].width < 2000 && made[0].height < 1000);
  // Beside it, the sunlit floor (white where the sun reaches, cut out where walls shade it or a roof covers it), for
  // keeping creatures' sun shadows off floor already in shade; never drawn itself.
  assert.equal(renders.length === 2 || renders.length === 1, true);
  const sunlit = shadows.sunlit;
  assert.ok(sunlit && sunlit.texture && sunlit.x === 0 && sunlit.y === 0 && sunlit.scale > 1);
  assert.notEqual(sunlit.texture, sprite.texture);
  shadows.build({ quads: [], bounds: { x: 0, y: 0, width: 2000, height: 1000 }, alpha: 0.4 });
  assert.equal(root.children.length, 0, 'none to draw: nothing there');
  assert.equal(shadows.sunlit, null, 'no walls in the sun: the whole floor sunlit');
  assert.ok(made[0].destroyed && made[1].destroyed);
  shadows.build({ quads, bounds: { x: 0, y: 0, width: 2000, height: 1000 }, alpha: 0.4 });
  shadows.clear();
  assert.equal(root.children.length, 0);
});

import { windowOpening, windowShafts, createWindowShafts, WINDOW_SHAFT_CAP } from '../../../scripts/engines/motion/wall-shadows.mjs';
test('light through windows: a window between its sill and head, an open door from the floor, nothing through a solid wall or closed door', () => {
  assert.deepEqual(windowOpening({ light: 30 }, 2), { bottom: 0.6000000000000001, top: 1.4000000000000001, alpha: 0.8, kind: 'glass' }, 'a 3 ft sill, a 7 ft head');
  assert.deepEqual(windowOpening({ light: 30, top: 4 }, 2), windowOpening({ light: 30 }, 2), 'a tall wall (a 20 ft ceiling) keeps the window its size');
  assert.ok(Math.abs(windowOpening({ light: 30 }, 2, 0.3048 / 1.5).top - 7 * 0.3048 / 1.5) < 1e-9, '1.5 m squares');
  assert.ok(windowOpening({ light: 40 }, 2), 'distance-limited window');
  assert.equal(windowOpening({ light: 20 }, 2), null, 'a solid wall');
  assert.equal(windowOpening({ light: 10 }, 2), null, 'foliage casts dappled shade, no shaft');
  assert.equal(windowOpening({ door: 1, ds: 0, light: 20 }, 2), null, 'closed door');
  assert.deepEqual(windowOpening({ door: 1, ds: 1, light: 20 }, 2), { bottom: 0, top: 1.4000000000000001, alpha: 1, kind: 'open' });
});
test('window shafts land away from the sun, longer as it sinks, capped', () => {
  const walls = [{ c: [0, 0, 100, 0], light: 30 }];
  const high = windowShafts({ walls, sun: { angle: -90, height: 60, strength: 1 }, grid: 100 });
  const low = windowShafts({ walls, sun: { angle: -90, height: 10, strength: 1 }, grid: 100 });
  assert.equal(high.length, 1);
  assert.ok(high[0].points[5] > 0, 'sun in the north: the light falls south');
  assert.ok(low[0].points[5] > high[0].points[5], 'longer at dusk');
  assert.ok(low[0].points[5] <= WINDOW_SHAFT_CAP * 100 + 1e-6, 'capped');
  assert.deepEqual(windowShafts({ walls, sun: null }), []);
  assert.deepEqual(windowShafts({ walls: [{ c: [0, 0, 100, 0], light: 20 }], sun: { angle: -90, height: 30, strength: 1 } }), []);
});
test('the shafts layer draws nothing without a roof to fall under', () => {
  const added = [];
  const layer = createWindowShafts({ PIXI: {}, root: () => ({ addChild: (c) => added.push(c) }), render: () => {} });
  layer.build({ shafts: [{ points: [0, 0, 1, 0, 1, 1, 0, 1], alpha: 1 }], bounds: { x: 0, y: 0, width: 100, height: 100 }, indoors: [] });
  assert.equal(layer.built, false);
});
test('a door between two rooms under the roof lets no daylight through; one to the outside does', () => {
  const sun = { angle: -90, height: 30, strength: 1 }, roof = [0, 0, 1000, 0, 1000, 1000, 0, 1000];
  const inner = { c: [400, 500, 600, 500], door: 1, ds: 1, light: 20 }, outer = { c: [400, 0, 600, 0], door: 1, ds: 1, light: 20 };
  assert.equal(windowShafts({ walls: [inner], sun, grid: 100, indoors: [roof] }).length, 0, 'sun side indoors');
  assert.equal(windowShafts({ walls: [outer], sun, grid: 100, indoors: [roof] }).length, 1, 'sun side outdoors');
});
test('glass drawn as a wall that lets light through but stops movement is a window; one that stops nothing is not', () => {
  assert.ok(windowOpening({ light: 0, move: 20 }, 2), 'light none, movement normal');
  assert.equal(windowOpening({ light: 0, move: 0 }, 2), null, 'stops nothing');
  assert.equal(windowOpening({ light: 0 }, 2), null, 'no movement given');
});

test('a wall taller than a window, between it and the sun, keeps its light out; a low one or the house’s own walls do not', async () => {
  const { wallShadowQuads: quadsOf } = await import('../../../scripts/engines/motion/wall-shadows.mjs');
  // A window in the north wall of a house (its inside to the south), the sun in the north.
  const sun = { angle: -90, height: 45, strength: 1 }, window = { c: [0, 0, 100, 0], light: 30 };
  const house = [{ c: [-200, 0, 0, 0], light: 20, top: 4 }, { c: [100, 0, 300, 0], light: 20, top: 4 }];
  const lit = (others) => {
    const walls = [window, ...house, ...others];
    return windowShafts({ walls, sun, grid: 100, shade: quadsOf({ walls, sun, grid: 100, height: 4 }) });
  };
  assert.equal(lit([]).length, 1, 'the house’s own walls cast their shadows inside, not on the window');
  assert.equal(lit([{ c: [-100, -200, 200, -200], light: 20, top: 8 }]).length, 0, 'a 40 ft wall two squares out');
  assert.equal(lit([{ c: [-100, -200, 200, -200], light: 20, top: 0.6 }]).length, 1, 'a garden wall below the sill');
  assert.equal(lit([{ c: [-100, -900, 200, -900], light: 20, top: 8 }]).length, 1, 'too far off to shade it at this sun');
  // A see-through fence lets some through.
  const fence = lit([{ c: [-100, -200, 200, -200], light: 10, top: 8 }]);
  assert.ok(fence.length === 0 || fence[0].alpha < 0.8, 'less through a fence');
});

test('a lit room spills its light out of its windows onto the ground outside; not between rooms, nor from a dark room', async () => {
  const { windowGlows } = await import('../../../scripts/engines/motion/wall-shadows.mjs');
  // A room from y 0 to 400, its north wall at y 0 with a window from x 100 to 200; a lamp inside.
  const room = [0, 0, 400, 0, 400, 400, 0, 400], window = { c: [100, 0, 200, 0], light: 30 };
  const lamp = { x: 150, y: 150, radius: 600, color: 0xffaa55 };
  const [glow] = windowGlows({ walls: [window], indoors: [room], lights: [lamp], grid: 100 });
  assert.ok(glow, 'it glows');
  assert.ok(glow.points[5] < 0 && glow.points[7] < 0, 'outward: north, out of the room');
  assert.ok(glow.points[4] - glow.points[6] > 100, 'fanning out from the opening');
  assert.equal(glow.color, 0xffaa55);
  const dimmer = windowGlows({ walls: [window], indoors: [room], lights: [{ ...lamp, y: 380, radius: 500 }], grid: 100 })[0];
  assert.ok(dimmer.alpha < glow.alpha && Math.abs(dimmer.points[5]) < Math.abs(glow.points[5]), 'a lamp further in: fainter and shorter');
  assert.deepEqual(windowGlows({ walls: [window], indoors: [room], lights: [], grid: 100 }), [], 'a dark room');
  assert.deepEqual(windowGlows({ walls: [window], indoors: [room], lights: [{ x: 150, y: -300, radius: 600 }], grid: 100 }), [], 'a light outside the room');
  assert.deepEqual(windowGlows({ walls: [window], indoors: [room, [0, -400, 400, -400, 400, 0, 0, 0]], lights: [lamp], grid: 100 }), [], 'a window between two rooms');
  assert.deepEqual(windowGlows({ walls: [{ c: [100, 0, 200, 0], light: 20 }], indoors: [room], lights: [lamp], grid: 100 }), [], 'a solid wall');
  assert.equal(windowGlows({ walls: [{ c: [100, 0, 200, 0], door: 1, ds: 1, light: 20 }], indoors: [room], lights: [lamp], grid: 100 }).length, 1, 'an open door');
});

test('a creature standing in a window glow blocks its light: a wedge of shadow away from the window, to the glow\'s end', async () => {
  const { windowGlows, glowShadows } = await import('../../../scripts/engines/motion/wall-shadows.mjs');
  // A room south of y 0, a window at y 0 from x 100 to 200: the glow spills north.
  const room = [0, 0, 400, 0, 400, 400, 0, 400], window = { c: [100, 0, 200, 0], light: 30 };
  const glows = windowGlows({ walls: [window], indoors: [room], lights: [{ x: 150, y: 100, radius: 600 }], grid: 100, foot: 0.2 });
  const glow = glows[0], far = glow.reach * 1.25;
  const casts = glowShadows(glows, [{ x: 150, y: -100, r: 30, height: 1.2 }]);
  assert.equal(casts.length, 5, 'one from each point across the window, and the lamp\'s');
  assert.ok(Math.abs(casts.reduce((n, c) => n + c.depth, 0) - 1) < 1e-9, 'whole where every point is hidden');
  // Straight behind the creature every wedge covers the ground; off to the side only some do (the window's edge shows).
  const covers = (pt) => casts.filter((c) => {
    let hit = false; const q = c.points;
    for (let i = 0, j = q.length - 2; i < q.length; j = i, i += 2) if ((q[i + 1] > pt.y) !== (q[j + 1] > pt.y) && pt.x < ((q[j] - q[i]) * (pt.y - q[i + 1])) / (q[j + 1] - q[i + 1]) + q[i]) hit = !hit;
    return hit;
  }).length;
  assert.equal(covers({ x: 150, y: -200 }), 5, 'dark straight behind');
  assert.ok(covers({ x: 215, y: -200 }) > 0 && covers({ x: 215, y: -200 }) < 5, 'half-shadow to the side');
  const lampCast = casts[4];
  assert.ok(Math.abs(lampCast.depth - 0.7) < 1e-9, 'most of it the lamp\'s, hard');
  const cast = casts[1];
  const [ax, ay, bx, by, cx, cy, ex, ey] = cast.points;
  assert.ok(ay < 0 && by < 0 && cy < ay && ey < by, 'north, away from the window');
  assert.ok(Math.abs(Math.hypot(cx - 137.5, cy) - far) < 1, 'out to the glow\'s end: the light is lower than the creature\'s top');
  assert.ok(Math.abs(ex - cx) > Math.abs(ax - bx), 'widening away from the window');
  const short = glowShadows(glows, [{ x: 150, y: -100, r: 15, height: 0.5 }])[1];
  assert.ok(Math.hypot(short.points[4] - 150, short.points[5]) < far - 1, 'a small creature: the light passes over, a shorter shadow');
  assert.deepEqual(glowShadows(glows, [{ x: 900, y: -100, r: 30, height: 1.2 }]), [], 'far from the glow and its lamp');
  // Inside, between the lamp (150, 100) and the window: the lamp's shadow out through it; the one holding it casts none.
  const between = glowShadows(glows, [{ x: 150, y: 40, r: 30, height: 1.2 }]);
  assert.equal(between.length, 1, 'only the lamp\'s');
  assert.ok(between[0].points[5] < -100, 'out through the window over the glow');
  assert.deepEqual(glowShadows(glows, [{ x: 160, y: 110, r: 30, half: 50, height: 1.2 }]), [], 'holding the lamp');
  const shaped = glowShadows(glows, [{ x: 150, y: -100, r: 30, height: 1.2, art: { texture: {} } }]);
  assert.equal(shaped.length, 1, 'in its shape: one shadow, its lamp\'s, no ghosts');
  assert.equal(shaped[0].depth, 1, 'whole');
  assert.deepEqual(glowShadows(glows, [{ x: 150, y: 450, r: 30, height: 1.2 }]), [], 'behind a wall from the lamp: none');
  assert.deepEqual(glowShadows([], [{ x: 150, y: -100, r: 30, height: 1.2 }]), [], 'no glow');
});

test('a hole drawn in a room lets the window glow out: a window onto the hole is a window onto the open air', async () => {
  const { windowGlows } = await import('../../../scripts/engines/motion/wall-shadows.mjs');
  // A courtyard: a room from 0 to 400 with a hole from 100 to 300; a window in the courtyard's north wall at y 100.
  const room = [0, 0, 400, 0, 400, 400, 0, 400];
  room.holes = [[100, 100, 300, 100, 300, 300, 100, 300]];
  const window = { c: [150, 100, 250, 100], light: 30 };
  const [glow] = windowGlows({ walls: [window], indoors: [room], lights: [{ x: 200, y: 50, radius: 600 }], grid: 100 });
  assert.ok(glow, 'it glows into the courtyard');
  assert.ok(glow.points[5] > 100, 'south, into the hole');
});

test('what fills a window: glass by default, an open frame brighter, curtains dim and spread with faint shadows, shutters in bands', async () => {
  const { windowGlows, windowOpening } = await import('../../../scripts/engines/motion/wall-shadows.mjs');
  const room = [0, 0, 400, 0, 400, 400, 0, 400], lamp = { x: 150, y: 150, radius: 600 };
  const glowOf = (wall) => windowGlows({ walls: [wall], indoors: [room], lights: [lamp], grid: 100 })[0];
  const glass = glowOf({ c: [100, 0, 200, 0], light: 30 }), open = glowOf({ c: [100, 0, 200, 0], light: 30, kind: 'open' });
  const curtained = glowOf({ c: [100, 0, 200, 0], light: 30, kind: 'curtained' }), shuttered = glowOf({ c: [100, 0, 200, 0], light: 30, kind: 'shuttered' });
  assert.equal(glass.kind, 'glass');
  assert.ok(open.alpha > glass.alpha, 'an open frame lets more through');
  assert.ok(curtained.alpha < glass.alpha && curtained.reach < glass.reach, 'curtains: dimmer, shorter');
  const width = (g) => Math.hypot(g.points[4] - g.points[6], g.points[5] - g.points[7]) / g.reach;
  assert.ok(width(curtained) > width(glass), 'curtains: spread wider');
  assert.ok(curtained.shadow < 0.5 && glass.shadow === 1, 'curtains: faint shadows');
  assert.ok(shuttered.slats >= 3 && glass.slats === 0, 'shutters: bands');
  assert.equal(windowOpening({ c: [0, 0, 1, 0], light: 20 }), null, 'a solid wall is no window');
  assert.equal(windowOpening({ c: [0, 0, 1, 0], light: 20, kind: 'shuttered' }).kind, 'shuttered', 'unless given a kind');
});

test('a lightning flash comes into a room through its windows: a patch fanning in from each, none between rooms', async () => {
  const { windowFlashes } = await import('../../../scripts/engines/motion/wall-shadows.mjs');
  const room = [0, 0, 400, 0, 400, 400, 0, 400];
  const [patch] = windowFlashes({ walls: [{ c: [100, 0, 200, 0], light: 30 }], indoors: [room], grid: 100 });
  assert.ok(patch, 'a patch');
  assert.ok(patch.points[5] > 0 && patch.points[7] > 0, 'into the room (south of its north wall)');
  assert.ok(patch.points[4] - patch.points[6] > 100, 'fanning out');
  assert.deepEqual(windowFlashes({ walls: [{ c: [100, 0, 200, 0], light: 20 }], indoors: [room], grid: 100 }), [], 'a solid wall');
  assert.deepEqual(windowFlashes({ walls: [{ c: [100, 0, 200, 0], light: 30 }], indoors: [room, [0, -400, 400, -400, 400, 0, 0, 0]], grid: 100 }), [], 'between two rooms');
});

test('a creature behind a closed door or a wall from the lamp casts no shadow in its window\u2019s light, even under the same roof', async () => {
  const { glowShadows } = await import('../../../scripts/engines/motion/wall-shadows.mjs');
  // One roof over two rooms; the lamp in the right one, its window to the south; the creature in the left one.
  const room = [0, 0, 400, 0, 400, 200, 0, 200];
  const glows = [{ points: [250, 200, 350, 200, 380, 400, 220, 400], from: { x: 300, y: 200 }, reach: 200, up: 1, shadow: 1, lamp: { x: 300, y: 100 }, room }];
  const creature = [{ x: 100, y: 120, r: 30, height: 1.2 }];
  assert.ok(glowShadows(glows, creature).length > 0, 'no walls known: in the lamp\u2019s room, it casts');
  const door = { c: [200, 0, 200, 200], light: 20, door: 1, ds: 0 };
  assert.deepEqual(glowShadows(glows, creature, { walls: [door] }), [], 'the door between them closed: none');
  assert.ok(glowShadows(glows, creature, { walls: [{ ...door, ds: 1 }] }).length > 0, 'the door open: it casts');
});

test('a lamp\u2019s shadow ends at its room\u2019s wall, not running on outside into another window\u2019s light', async () => {
  const { glowShadows } = await import('../../../scripts/engines/motion/wall-shadows.mjs');
  const room = [0, 0, 400, 0, 400, 200, 0, 200];
  const glows = [{ points: [-50, 200, 50, 200, 80, 400, -80, 400], from: { x: 0, y: 200 }, reach: 600, up: 1, shadow: 1, lamp: { x: 100, y: 100 }, room }];
  const creature = [{ x: 200, y: 100, r: 30, height: 1.2 }];
  const wall = { c: [300, 0, 300, 200], light: 20, door: 0, ds: 0 };
  const free = glowShadows(glows, creature)[0], cut = glowShadows(glows, creature, { walls: [wall] })[0];
  assert.ok(free.points[4] > 400 && cut.points[4] <= 301, 'stops at the wall');
});

import { glowShadows } from '../../../scripts/engines/motion/wall-shadows.mjs';
test('a creature hovering in a glow moves its shadow with its bob, along the light', () => {
  const glow = { from: { x: 0, y: 0 }, lamp: { x: 0, y: 0 }, points: [0, 0, 0, 100, 600, 100, 600, 0], reach: 600, up: 3, shadow: 1, room: null };
  const cast = (bob) => glowShadows([glow], [{ id: 'f', x: 200, y: 50, r: 30, half: 50, height: 1, bob }]).at(-1);
  assert.equal(cast(0).id, 'f');
  assert.ok(cast(5).body.x > cast(0).body.x + 5, 'rising: further from the light');
  assert.ok(cast(-5).body.x < cast(0).body.x - 5, 'dipping: closer');
});

test('a wall marked to cast no shadow throws none; the others still do', () => {
  const sun = { angle: 0, height: 30, strength: 1 }, wall = (noShadow) => ({ c: [100, 100, 100, 900], light: 20, noShadow });
  assert.equal(wallShadowQuads({ walls: [wall(true)], sun, grid: 100, height: 2 }).length, 0);
  assert.equal(wallShadowQuads({ walls: [wall(false)], sun, grid: 100, height: 2 }).length, 1);
  assert.equal(wallShadowQuads({ walls: [{ c: [100, 100, 100, 900], light: 20 }], sun, grid: 100, height: 2 }).length, 1, 'unset: as before');
  assert.equal(wallShadowQuads({ walls: [wall(true), { ...wall(false), c: [500, 100, 500, 900] }], sun, grid: 100, height: 2 }).length, 1);
});
