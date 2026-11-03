import test from 'node:test';
import assert from 'node:assert/strict';
import { fungusIn, crystalsIn, crystalFaces } from '../../../scripts/engines/motion/cavern.mjs';
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
