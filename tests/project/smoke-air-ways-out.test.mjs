import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { draftField, createSmokeAir } from '../../scripts/engines/motion/indoor-air.mjs';
import { ROOM_AIR } from '../../scripts/engines/props/smoke-air.mjs';

// The air that carries a room's smoke has to know the room's own ways out, not just the map's.
const main = readFileSync(new URL('../../scripts/main.mjs', import.meta.url), 'utf8');
const rebuild = main.slice(main.indexOf('const rebuildDraft = '), main.indexOf('const airVecAt'));

test('the draft is seeded from the room\'s own openings, not only the map\'s edge', () => {
  assert.match(rebuild, /roomWaysOut\(\)/, 'rebuildDraft asks for the room\'s ways out');
  const helper = main.slice(main.indexOf('const roomWaysOut = '), main.indexOf('// How the air moves at a point now'));
  assert.match(helper, /smokeOpeningsOf\(/, 'and takes them from the round\'s own opening list');
  assert.match(helper, /indoors/, 'which is only correct when it is told where the rooms are');
});

test('sceneOpenings is handed the unfiltered walls, or it can never see an open door', () => {
  // smokeWalls DROPS an open door (it is not a wall to smoke); sceneOpenings LOOKS for one. Handed the filtered list it
  // finds nothing, and a map whose only way out is a door at its edge loses its draft entirely.
  assert.match(rebuild, /sceneOpenings\(\{ walls: seen\b/, 'the raw list goes to sceneOpenings');
  assert.match(rebuild, /const walls = smokeWalls\(seen\)/, 'and the filtered one is what blocks the air');
});

// A room with one way out, filled to the brim and left alone, as a cellar is when the fire is out.
function clearing(openings) {
  const grid = 100, bounds = { x: 0, y: 0, width: 2000, height: 2000 };
  const seg = (x1, y1, x2, y2) => ({ c: [x1, y1, x2, y2], move: 20, sight: 20, door: 0, ds: 0 });
  const walls = [seg(200, 200, 1000, 200), seg(200, 1000, 1000, 1000), seg(200, 200, 200, 1000),
    seg(1000, 200, 1000, 500), seg(1000, 700, 1000, 1000)];   // a gap at 500-700: the way out
  const air = createSmokeAir(ROOM_AIR);
  air.setup(draftField({ walls, bounds, grid, openings }), []);
  const prime = [];
  for (let x = 250; x < 1000; x += grid) for (let y = 250; y < 1000; y += grid) prime.push({ x, y, v: 1 });
  air.prime(prime);
  for (let t = 0; t < 600; t++) { air.step(1); if (air.held < 0.5) return t; }
  return Infinity;
}

test('seeding the way out is what empties the room, and it is not a small difference', () => {
  const seeded = clearing([{ x: 1000, y: 600 }]);
  const unseeded = clearing([]);
  assert.ok(seeded < unseeded / 2, `seeded ${seeded}s should be far quicker than unseeded ${unseeded}s`);
  assert.ok(seeded < 120, `a room with a way out empties in minutes, not forever (${seeded}s)`);
});
