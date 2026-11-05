import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sootSpots, ventsIn, wetRuns, rubbleStones, mothHome, keepInside, mothShadow } from '../../../scripts/engines/motion/underground-life.mjs';

test('moths round a torch on a wall loop on the room side, never through the wall', () => {
  // A torch just below a wall at y 0: its light reaches only y > 0.
  const shape = [-500, 0, 500, 0, 500, 500, -500, 500];
  const home = mothHome({ x: 0, y: 10, shape }, { grid: 100 });
  assert.ok(home.y > 30, 'the loop shifted out into the room');
  const p = keepInside({ x: 0, y: -80 }, home, shape);
  assert.ok(p.y > 0, 'pulled back inside the light');
  assert.deepEqual(keepInside({ x: 20, y: 60 }, home, shape), { x: 20, y: 60 }, 'inside already: left alone');
  const free = mothHome({ x: 0, y: 0, shape: null }, { grid: 100 });
  assert.deepEqual(free, { x: 0, y: 0, shape: null });
});

const room = [0, 0, 1000, 0, 1000, 1000, 0, 1000];

test('soot gathers on the wall nearest a fire standing against it, on the fire\'s side', () => {
  const walls = [{ c: [0, 0, 1000, 0], light: 20, move: 20 }, { c: [0, 0, 0, 1000], light: 20, move: 20 }];
  const [s] = sootSpots([{ key: 'a', x: 400, y: 30 }], walls, { grid: 100 });
  assert.equal(s.key, 'a');
  assert.equal(s.x, 400); assert.equal(s.y, 0);
  assert.ok(s.ny > 0.99, 'the fire is below the wall');
});

test('no soot for a fire standing away from the walls, or by a wall that lets light through', () => {
  assert.equal(sootSpots([{ key: 'a', x: 500, y: 500 }], [{ c: [0, 0, 1000, 0], light: 20, move: 20 }], { grid: 100 }).length, 0);
  assert.equal(sootSpots([{ key: 'a', x: 400, y: 30 }], [{ c: [0, 0, 1000, 0], light: 0, move: 20 }], { grid: 100 }).length, 0);
});

test('vents lie inside their area, about one per six squares, the same each time', () => {
  const a = ventsIn([room], { grid: 100, seed: 's' }), b = ventsIn([room], { grid: 100, seed: 's' });
  assert.equal(a.length, Math.round(100 / 6));
  assert.deepEqual(a, b);
  for (const v of a) assert.ok(v.x >= 0 && v.x <= 1000 && v.y >= 0 && v.y <= 1000);
  assert.equal(ventsIn([[0, 0, 50, 0, 50, 50, 0, 50]], { grid: 100 }).length, 1, 'a small area still has one');
});

test('wet runs follow the walls through the area, wet on the floor side, a square at a time', () => {
  const walls = [{ c: [0, 500, 1000, 500], move: 20 }, { c: [0, 2000, 1000, 2000], move: 20 }, { c: [500, 0, 500, 300], move: 20, door: 1 }];
  const runs = wetRuns([room], walls, { grid: 100 });
  // Both sides of the wall across the room, ten squares each; the far wall and the door none.
  assert.equal(runs.length, 20);
  assert.ok(runs.every((r) => r.a.y === 500 && Math.abs(r.ny) === 1));
  const onlyBelow = wetRuns([room], walls, { grid: 100, floor: (p) => p.y > 500 });
  assert.equal(onlyBelow.length, 10);
  assert.ok(onlyBelow.every((r) => r.ny === 1));
});

test('a cave-in\'s heap lies round its middle, mostly gravel, the same for the same seed', () => {
  const a = rubbleStones({ x: 500, y: 500, radius: 160, seed: 7 }), b = rubbleStones({ x: 500, y: 500, radius: 160, seed: 7 });
  assert.deepEqual(a, b);
  assert.ok(a.length >= 50);
  assert.ok(a.every((s) => Math.hypot(s.x - 500, s.y - 500) <= 160 * 1.15 + 0.001));
  const small = a.filter((s) => s.size < 160 * 0.06).length;
  assert.ok(small > a.length * 0.6, 'mostly small stones');
  assert.ok(a.some((s) => s.size > 160 * 0.07), 'a few big ones');
  const biggest = (list) => Math.max(...list.map((s) => s.size));
  assert.ok(biggest(rubbleStones({ x: 0, y: 0, radius: 300, seed: 7 })) > biggest(a) * 1.5, 'boulders in a big fall');
  // Far wider, far bigger: a boulder keeps its share of the circle.
  const share = (radius) => biggest(rubbleStones({ x: 0, y: 0, radius, seed: 7 })) / radius;
  assert.ok(share(800) > share(160) * 0.75, `${share(800)} against ${share(160)}`);
  assert.ok(rubbleStones({ x: 0, y: 0, radius: 1000, seed: 7 }).length <= 224, 'never more than a floor can draw');
  assert.ok(Math.abs(biggest(rubbleStones({ x: 0, y: 0, radius: 600, seed: 7 }, { grid: 200 })) - 2 * biggest(rubbleStones({ x: 0, y: 0, radius: 300, seed: 7 }))) < 1e-6, 'scaled to the grid');
  assert.notDeepEqual(rubbleStones({ x: 500, y: 500, radius: 160, seed: 8 }), a);
});

test('a moth over the flame never throws a shadow bigger than one a little way off', () => {
  const close = mothShadow(1, { grid: 100 }), off = mothShadow(35, { grid: 100 }), far = mothShadow(200, { grid: 100 });
  assert.deepEqual(close, off, 'right over the flame: no bigger');
  assert.ok(close.size < 100 * 0.45, `${close.size} under half a square`);
  assert.ok(close.far < 100 * 1.4, 'and not thrown across the room');
  assert.ok(far.size < close.size && far.alpha < close.alpha, 'smaller and fainter further off');
});

test('a vent fades to nothing before the edge of its picture, so it can never show a corner', async () => {
  const { ventShade } = await import('../../../scripts/engines/motion/underground-life.mjs');
  for (let i = 0; i <= 40; i++) {
    const t = -1 + i / 20;
    for (const tear of [0, 0.5, 1]) for (const [u, v] of [[t, -1], [t, 1], [-1, t], [1, t]]) assert.equal(ventShade(u, v, tear), 0, `${u},${v}`);
  }
  assert.ok(ventShade(0, 0, 0.5) > 0.5, 'dark along its middle');
  assert.ok(ventShade(0, 0.8, 0.5) < ventShade(0, 0, 0.5), 'and lighter away from it');
});
