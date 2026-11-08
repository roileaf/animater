import test from 'node:test';
import assert from 'node:assert/strict';
import { fungusIn, crystalsIn, crystalFaces, pathPoints } from '../../../scripts/engines/motion/cavern.mjs';
import { readFileSync } from 'node:fs';
import { webCorners, webStrands } from '../../../scripts/engines/motion/webs.mjs';
import { dripsIn } from '../../../scripts/engines/motion/drips.mjs';

const room = [0, 0, 600, 0, 600, 400, 0, 400];
const walls = [{ c: [0, 0, 600, 0], move: 20 }, { c: [600, 0, 600, 400], move: 20 }, { c: [600, 400, 0, 400], move: 20 }, { c: [0, 400, 0, 0], move: 20 }];
const inRoom = ({ x, y }) => x >= 0 && y >= 0 && x <= 600 && y <= 400;

test('fungus grows in clusters of caps inside its area, the same each time', () => {
  const a = fungusIn([room], { grid: 100, seed: 's' }), b = fungusIn([room], { grid: 100, seed: 's' });
  assert.ok(a.length >= 1 && a.every((c) => c.caps.length > 3));
  assert.ok(a.every((c) => c.caps.every(inRoom)), 'every cap inside');
  assert.deepEqual(a, b);
});

test('crystals grow out of the walls, pointing into the area', () => {
  const clusters = crystalsIn([room], { walls, grid: 100, seed: 'c' });
  assert.ok(clusters.length > 4);
  for (const cl of clusters) assert.ok(inRoom(cl), 'its middle inside the room');
  const faces = crystalFaces(clusters[0]);
  assert.ok(faces.some((f) => f.kind === 0) && faces.some((f) => f.kind === 1));
  assert.ok(faces.every((f) => f.pts.length === 3 && Math.abs(Math.hypot(...f.n) - 1) < 1e-6), 'triangles with unit normals');
});

test('crystals stand free in an area with no walls', () => {
  assert.ok(crystalsIn([room], { walls: [], grid: 100, seed: 'f' }).length >= 1);
});

test('cobwebs hang in the corners where walls meet, inside the area', () => {
  const corners = webCorners({ walls, areas: [room], grid: 100, share: 1 });
  assert.equal(corners.length, 4);
  assert.equal(webCorners({ walls, areas: [[1000, 1000, 1100, 1000, 1100, 1100]], grid: 100, share: 1 }).length, 0, 'none outside the area');
  const strands = webStrands(corners[0], { grid: 100 });
  assert.ok(strands.length > 30 && strands.some((s) => s.loose));
});

test('drops fall all over a dripping area, each its own pace and size; open water is known', () => {
  const { drops, water } = dripsIn(room, { grid: 100, seed: 'w' });
  assert.ok(drops.length >= 10 && drops.length <= 16 && water === false);
  assert.ok(drops.every((d) => d.x > 0 && d.x < 600 && d.y > 0 && d.y < 400), 'all inside');
  assert.ok(new Set(drops.map((d) => d.every.toFixed(2))).size > 5 && Math.max(...drops.map((d) => d.size)) - Math.min(...drops.map((d) => d.size)) > 0.3);
  assert.ok(dripsIn([0, 0, 100, 0, 100, 100, 0, 100], { grid: 100 }).drops.length >= 2, 'at least two, even in one square');
  assert.equal(dripsIn(room, { grid: 100, water: [room] }).water, true);
});

test('a walker clears its whole path through the mist, however far it got between looks', () => {
  const path = pathPoints({ x: 0, y: 0 }, { x: 100, y: 0 }, { step: 25 });
  assert.equal(path.length, 4);
  assert.deepEqual(path.at(-1), { x: 100, y: 0 });
  assert.equal(pathPoints({ x: 0, y: 0 }, { x: 0, y: 0 }).length, 1, 'standing still: where it stands');
  assert.deepEqual(pathPoints({ x: 0, y: 0 }, { x: 5000, y: 0 }, { most: 800 }), [{ x: 5000, y: 0 }], 'a jump clears only where it landed');
});

// Discord (sonofkyuss): a tree tile and a creature over lava showed its cracks through them, as if see-through.
test('the lava\'s glow (over the darkness, so over everything) leaves out what stands over it', () => {
  const cave = readFileSync(new URL('../../../scripts/engines/motion/cavern.mjs', import.meta.url), 'utf8');
  assert.match(cave, /uniform sampler2D uCover;/);
  assert.match(cave, /\(1\.0 - texture2D\(uCover, vUv\)\.a\), 0\.0\);/, 'the glow pass, times what is not covered');
  assert.match(cave, /cover\(c\.rt, c\.box\)/, 'redrawn as things move');
  const main = readFileSync(new URL('../../../scripts/main.mjs', import.meta.url), 'utf8');
  assert.match(main, /cover: coverOverFloor \}\);/);
  assert.match(main, /canvas\.tokens\?\.placeables[^\n]*draw\(t\.mesh\)/); assert.match(main, /canvas\.tiles\?\.placeables[^\n]*> base[^\n]*draw\(t\.mesh\)/);
});
