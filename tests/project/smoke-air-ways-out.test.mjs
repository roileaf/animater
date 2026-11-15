import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { draftField, createSmokeAir } from '../../scripts/engines/motion/indoor-air.mjs';
import { ROOM_AIR } from '../../scripts/engines/props/smoke-air.mjs';

// The air that carries a room's smoke has to know the room's own ways out, not just the map's.
const main = readFileSync(new URL('../../scripts/main.mjs', import.meta.url), 'utf8');
const rebuild = main.slice(main.indexOf('const rebuildDraft = '), main.indexOf('const airVecAt'));

test('the draft is seeded from the room\'s own openings, not only the map\'s edge', () => {
  assert.match(rebuild, /roomWaysOut\(bounds, grid\)/, 'rebuildDraft asks for the room\'s ways out');
  assert.match(rebuild, /draftField\(\{[^}]*reaches: rooms\.reaches/, 'and holds their pull to the inside');
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

// A room's own doorway is a way out for the ROOM, not for the open ground beyond it.
test("a room's way out pulls the air inside it and leaves the ground outside alone", () => {
  const grid = 100, bounds = { x: 0, y: 0, width: 2000, height: 2000 };
  const seg = (x1, y1, x2, y2) => ({ c: [x1, y1, x2, y2], move: 20, sight: 20, door: 0, ds: 0 });
  const walls = [seg(200, 200, 1000, 200), seg(200, 1000, 1000, 1000), seg(200, 200, 200, 1000),
    seg(1000, 200, 1000, 500), seg(1000, 700, 1000, 1000)];
  const doorway = { x: 1000, y: 600, inner: true };
  const cell = grid / 2, cols = Math.ceil(bounds.width / cell);
  const indoors = (k) => { const i = k % cols, j = (k - i) / cols, x = (i + 0.5) * cell, y = (j + 0.5) * cell; return x > 200 && x < 1000 && y > 200 && y < 1000; };
  const at = (f, x, y) => f.dist[Math.floor(y / f.cell) * f.cols + Math.floor(x / f.cell)];

  const held = draftField({ walls, bounds, grid, openings: [doorway], reaches: indoors });
  assert.ok(at(held, 500, 600) > 0, 'the air deep in the room still runs for the door');
  assert.equal(at(held, 1400, 600), -1, 'the ground outside the door is left still');
  assert.equal(at(held, 1400, 1600), -1, 'and so is the rest of the map');

  // Without the fence on the walk it is the opposite: every outdoor cell is given a draft pointing back at the doorway,
  // which carried escaping smoke straight back in and drained it at the threshold.
  const loose = draftField({ walls, bounds, grid, openings: [{ x: 1000, y: 600 }] });
  assert.ok(at(loose, 1400, 600) > 0, 'this is what it used to do');
  assert.ok(at(loose, 1400, 1600) > 0);
});

// What leaves a room has to be seen leaving it.
test('smoke reaching a doorway spills into the air beyond instead of vanishing at the threshold', () => {
  const grid = 100, bounds = { x: 0, y: 0, width: 2000, height: 2000 };
  const seg = (x1, y1, x2, y2) => ({ c: [x1, y1, x2, y2], move: 20, sight: 20, door: 0, ds: 0 });
  const walls = [seg(200, 200, 1000, 200), seg(200, 1000, 1000, 1000), seg(200, 200, 200, 1000),
    seg(1000, 200, 1000, 500), seg(1000, 700, 1000, 1000)];
  const cell = grid / 2, cols = Math.ceil(bounds.width / cell);
  const indoors = (k) => { const i = k % cols, j = (k - i) / cols, x = (i + 0.5) * cell, y = (j + 0.5) * cell; return x > 200 && x < 1000 && y > 200 && y < 1000; };
  const field = draftField({ walls, bounds, grid, openings: [{ x: 1000, y: 600, inner: true }], reaches: indoors });
  const air = createSmokeAir(ROOM_AIR);
  air.setup(field, []);
  const prime = [];
  for (let x = 250; x < 1000; x += grid) for (let y = 250; y < 1000; y += grid) prime.push({ x, y, v: 1 });
  air.prime(prime);
  // How much smoke is standing outside the doorway, all told. Some of it would cross by plain diffusion even if the
  // threshold swallowed the rest, so the bar is set where only the spill can reach: with SPILL at 0 this stands at about
  // 9.9 after twenty seconds, and with it at 0.55 about 16.7. Anything over 13 can only be the doorway handing it over.
  const outside = () => {
    let sum = 0;
    for (let k = 0; k < field.cols * field.rows; k++) {
      const i = k % field.cols, j = (k - i) / field.cols, x = (i + 0.5) * field.cell, y = (j + 0.5) * field.cell;
      if (x > 1000 && x < 1500 && y > 350 && y < 850) sum += air.at(k);
    }
    return sum;
  };
  assert.equal(outside(), 0, 'nothing is out there to begin with');
  for (let t = 0; t < 20; t++) air.step(1);
  assert.ok(outside() > 13, `the doorway hands its smoke on rather than swallowing it (saw ${outside().toFixed(2)})`);
});
