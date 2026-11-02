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
