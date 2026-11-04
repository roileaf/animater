import test from 'node:test';
import assert from 'node:assert/strict';
import { draftField, sceneOpenings, draftStrength, gustDelays, GUST_SPEED, createSmokeAir, MIST_AIR, doorPushAt } from '../../../scripts/engines/motion/indoor-air.mjs';

// Two rooms side by side (0–300 and 300–600), a door between them at x 300; the left room opens to the outside at x 0.
const bounds = { x: 0, y: 0, width: 600, height: 300 };
const room = (door) => [
  { c: [0, 0, 600, 0], move: 20 }, { c: [0, 300, 600, 300], move: 20 }, { c: [600, 0, 600, 300], move: 20 },
  { c: [300, 0, 300, 100], move: 20 }, { c: [300, 200, 300, 300], move: 20 }, { c: [300, 100, 300, 200], move: 20, door: 1, ds: door },
];
const outside = [{ x: 50, y: 150 }];

test('the air reaches through an open door toward the outside, and not through a shut one', () => {
  const shut = draftField({ res: 1, walls: room(0), bounds, grid: 100, openings: outside }), open = draftField({ res: 1, walls: room(1), bounds, grid: 100, openings: outside });
  const far = (f) => f.dist[1 * f.cols + 5];
  assert.equal(far(shut), -1, 'the far room sealed: still air');
  assert.ok(far(open) > 0, 'the door open: it is reached');
  assert.ok(open.dir[(1 * open.cols + 5) * 2] < 0, 'and its air flows toward the way out (west)');
});

test('a door standing open on the scene edge, or a region that leads out, is an opening', () => {
  const walls = [{ c: [0, 100, 0, 200], move: 20, door: 1, ds: 1 }, { c: [300, 100, 300, 200], move: 20, door: 1, ds: 1 }, { c: [0, 250, 0, 290], move: 20, door: 1, ds: 0 }];
  const out = sceneOpenings({ walls, bounds, grid: 100, regions: [{ polygons: [[1, 1, 2, 2, 3, 1]], leads: true }, { polygons: [[9, 9, 8, 8, 7, 9]] }] });
  assert.equal(out.filter((o) => !Array.isArray(o)).length, 1, 'only the open door on the edge');
  assert.equal(out.filter(Array.isArray).length, 1, 'only the region that leads out');
});

test('the air flows toward the nearest way out, and every square it reaches leads there', () => {
  // Two ways out, either end of a long hall (0–1000 across, one square high).
  const hall = { x: 0, y: 0, width: 1000, height: 100 };
  const f = draftField({ res: 1, walls: [], bounds: hall, grid: 100, openings: [{ x: 50, y: 50 }, { x: 950, y: 50 }] });
  assert.ok(f.dir[1 * 2] < 0, 'near the west end it flows west');
  assert.ok(f.dir[8 * 2] > 0, 'near the east end it flows east');
  assert.equal(Math.max(...f.dist), 4, 'never more than halfway from one');
  // Downhill: from each square, a neighbour nearer the way out.
  for (let i = 0; i < f.cols; i++) if (f.dist[i] > 0) assert.ok([i - 1, i + 1].some((n) => n >= 0 && n < f.cols && f.dist[n] === f.dist[i] - 1));
});

test('walls that do not stop movement (a window, a curtain) let the air through; a diagonal wall stops it', () => {
  const box = { x: 0, y: 0, width: 300, height: 300 }, out = [{ x: 50, y: 150 }];
  const reached = (walls) => draftField({ res: 1, walls, bounds: box, grid: 100, openings: out }).dist[1 * 3 + 2];
  assert.ok(reached([{ c: [200, 0, 200, 300], move: 0 }]) > 0, 'move 0: open to the air');
  assert.equal(reached([{ c: [200, 0, 200, 300], move: 20 }]), -1, 'a solid wall: sealed');
  assert.ok(reached([{ c: [150, 120, 250, 180], move: 20 }]) > 1, 'a short diagonal wall: the air goes round it (further)');
  assert.equal(draftField({ res: 1, walls: [{ c: [300, 0, 0, 300], move: 20 }], bounds: box, grid: 100, openings: out }).dist[2 * 3 + 2], -1, 'but cuts off the corner behind it');
});

test('a region that is a way out fills all its squares; a locked door seals as a shut one does', () => {
  const box = { x: 0, y: 0, width: 400, height: 200 };
  const f = draftField({ res: 1, walls: [], bounds: box, grid: 100, openings: [[0, 0, 200, 0, 200, 200, 0, 200]] });
  assert.equal([0, 1, 4, 5].every((k) => f.dist[k] === 0), true, 'every square inside the region is the outside');
  const walls = (ds) => [{ c: [200, 0, 200, 200], move: 20, door: 1, ds }];
  const far = (ds) => draftField({ res: 1, walls: walls(ds), bounds: box, grid: 100, openings: [{ x: 50, y: 50 }] }).dist[3];
  assert.equal(far(2), -1); assert.equal(far(0), -1); assert.ok(far(1) > 0);
});

test('the air runs fast through a doorway and barely stirs in a room’s far corner', () => {
  // A room 0–600 by 0–600, its only way out a gap at the middle of its east wall (x 600, y 250–350) to the outside.
  const bounds = { x: 0, y: 0, width: 800, height: 600 };
  const walls = [{ c: [600, 0, 600, 250], move: 20 }, { c: [600, 350, 600, 600], move: 20 }];
  const f = draftField({ walls, bounds, grid: 100, res: 2, openings: [[700, 0, 800, 0, 800, 600, 700, 600]] });
  const at = (x, y) => f.speed[Math.floor(y / f.cell) * f.cols + Math.floor(x / f.cell)];
  assert.ok(at(625, 300) > 0.6, 'through the gap: fast');
  assert.ok(at(25, 25) < 0.25 && at(25, 25) > 0, 'the far corner: barely');
  assert.ok(at(550, 300) > at(300, 300), 'quicker as it nears the gap');
  // And it bends round to the gap: from the room's north-west it heads east and down.
  const k = Math.floor(100 / f.cell) * f.cols + Math.floor(100 / f.cell);
  assert.ok(f.dir[k * 2] > 0.3 && f.dir[k * 2 + 1] > 0);
});

test('a gust sweeps out from the door that opened: the far end of the hall feels it later', () => {
  const hall = { x: 0, y: 0, width: 1500, height: 100 };
  const f = draftField({ walls: [], bounds: hall, grid: 100, res: 1, openings: [{ x: 1450, y: 50 }] });
  const d = gustDelays(f, { x: 50, y: 50 }, { grid: 100 });
  // It starts on both sides of the door at once, then a square every 1/GUST_SPEED seconds.
  assert.ok(d[0] === 0 && d[1] === 0 && d[10] > d[5] && Math.abs(d[14] - 13 / GUST_SPEED) < 1e-6);
  assert.ok(draftStrength(-1) === 0.3, 'before it arrives: the steady draft');
});

test('a door opening sends a gust that swells in, then settles into a steady draft', () => {
  assert.equal(draftStrength(0), 0.3, 'no sudden front as it arrives');
  assert.ok(draftStrength(0.6) > 0.3 && draftStrength(0.6) < draftStrength(1.2));
  assert.ok(draftStrength(1.2) > 0.55 && draftStrength(1.2) <= 0.6);
  assert.ok(draftStrength(12) < 0.32 && draftStrength(12) >= 0.3);
});

test('smoke gathers as time passes, stops at a shut door, and leaves through an open one along the draft', () => {
  // Two rooms side by side, a wall between them with a door; the way out on the far side of the right room.
  const bounds = { x: 0, y: 0, width: 2000, height: 1000 }, grid = 100, way = [{ x: 1950, y: 500 }];
  const walls = (ds) => [{ c: [1000, 0, 1000, 450], move: 20 }, { c: [1000, 550, 1000, 1000], move: 20 }, { c: [1000, 450, 1000, 550], move: 20, door: 1, ds }];
  const at = (field, smoke, x, y) => smoke.at(Math.floor(y / field.cell) * field.cols + Math.floor(x / field.cell));
  const fire = [{ x: 500, y: 500 }];
  const shut = draftField({ walls: walls(0), bounds, grid, openings: way }), smoke = createSmokeAir();
  smoke.setup(shut, fire);
  smoke.step(5); const early = at(shut, smoke, 800, 500), heldEarly = smoke.held;
  smoke.step(55);
  assert.ok(smoke.held > heldEarly * 3, `it builds up: ${heldEarly} then ${smoke.held}`);
  assert.ok(at(shut, smoke, 800, 500) > early, 'reaching further across the room');
  assert.ok(at(shut, smoke, 500, 500) > at(shut, smoke, 800, 500), 'thickest by the fire');
  for (let y = 25; y < 1000; y += 50) for (let x = 1025; x < 2000; x += 50) assert.equal(at(shut, smoke, x, y), 0, 'none past the shut door');
  const before = smoke.held;
  // The door opens: what has gathered stays in the air, and the draft draws it out.
  const open = draftField({ walls: walls(1), bounds, grid, openings: way });
  smoke.setup(open, []);
  smoke.step(4);
  assert.ok(smoke.held > before * 0.5, 'nothing vanishes when the door changes');
  smoke.step(20);
  assert.ok(at(open, smoke, 1050, 500) > 0.01, 'through the door');
  assert.ok(at(open, smoke, 1500, 500) > 0, 'on along the draft');
  smoke.step(300);
  assert.ok(smoke.held < before * 0.5, `and away out of the room: ${before} then ${smoke.held}`);
  // With no way out it stays: the same smoke, sealed, keeps more.
  const sealed = draftField({ walls: walls(0), bounds, grid, openings: [] }), kept = createSmokeAir();
  kept.setup(sealed, fire); kept.step(60); const made = kept.held;
  const drained = draftField({ walls: walls(1), bounds, grid, openings: way }), lost = createSmokeAir();
  lost.setup(drained, fire); lost.step(120); kept.step(60);
  assert.ok(kept.held > lost.held, `${kept.held} against ${lost.held}; ${made}`);
  assert.ok(smoke.pixels.length === shut.cols * shut.rows * 4);
});

test('mist fills its region and stays there until a door opens, then the draft draws it out past the region', () => {
  const bounds = { x: 0, y: 0, width: 2000, height: 1000 }, grid = 100, way = [{ x: 50, y: 500 }];
  // The mist's room on the right, a door on its left, the way out beyond it.
  const walls = (ds) => [{ c: [1000, 0, 1000, 450], move: 20 }, { c: [1000, 550, 1000, 1000], move: 20 }, { c: [1000, 450, 1000, 550], move: 20, door: 1, ds }];
  const at = (field, air, x, y) => air.at(Math.floor(y / field.cell) * field.cols + Math.floor(x / field.cell));
  const room = []; for (let y = 25; y < 1000; y += 50) for (let x = 1025; x < 2000; x += 50) room.push({ x, y });
  const shut = draftField({ walls: walls(0), bounds, grid, openings: way }), mist = createSmokeAir(MIST_AIR);
  mist.setup(shut, room); mist.fill();
  assert.equal(at(shut, mist, 1500, 500), 1, 'full from the start');
  mist.step(30);
  assert.ok(at(shut, mist, 1500, 500) > 0.8, 'it stays while the door is shut');
  assert.equal(at(shut, mist, 900, 500), 0, 'none past the shut door');
  const open = draftField({ walls: walls(1), bounds, grid, openings: way });
  mist.setup(open, room);
  mist.step(1);
  const atOnce = at(open, mist, 1100, 500);
  assert.ok(atOnce > 0.95, `nothing changes on the spot: ${atOnce}`);
  mist.step(5);
  assert.ok(at(open, mist, 950, 500) > 0.05, `out through the door within seconds: ${at(open, mist, 950, 500)}`);
  const inRoom = () => room.reduce((sum, p) => sum + at(open, mist, p.x, p.y), 0) / room.length, full = inRoom();
  mist.step(20);
  assert.ok(at(open, mist, 500, 500) > 0.005, `on along the draft: ${at(open, mist, 500, 500)}`);
  assert.ok(inRoom() < full, `the room thins: ${inRoom()} from ${full}`);
  mist.step(40);
  assert.ok(inRoom() < full * 0.85, `more as time passes: ${inRoom()} from ${full}`);
  // A door to a room with no way out: no draft, but the door's swing pushes it through, it spreads some squares and stops.
  const sealed = draftField({ walls: walls(1), bounds, grid, openings: [] });
  const quiet = createSmokeAir(MIST_AIR), shoved = createSmokeAir(MIST_AIR), door = { x: 1000, y: 500, nx: -1, ny: 0, ax: 0, ay: 1, half: 50 };
  for (const air of [quiet, shoved]) { air.setup(shut, room); air.fill(); air.setup(sealed, room); }
  assert.deepEqual(shoved.push(door), { x: -1, y: 0 }, 'from the side that holds it, through the door');
  quiet.step(8); shoved.step(8);
  assert.ok(at(sealed, shoved, 850, 500) > at(sealed, quiet, 850, 500) * 1.5, `the push carries it through: ${at(sealed, shoved, 850, 500)} against ${at(sealed, quiet, 850, 500)}`);
  shoved.step(120);
  assert.ok(at(sealed, shoved, 600, 500) > 0.03, `four squares into the next room: ${at(sealed, shoved, 600, 500)}`);
  assert.ok(at(sealed, shoved, 25, 500) < 0.03, `and it never fills the room: ${at(sealed, shoved, 25, 500)}`);
  // Nothing either side of a door: nothing to push.
  assert.equal(createSmokeAirEmpty(sealed).push({ x: 300, y: 300, nx: 1, ny: 0, ax: 0, ay: 1 }), null);
  assert.equal(doorPushAt(-1), 0); assert.equal(doorPushAt(4), 1); assert.equal(doorPushAt(20), 0);
  assert.ok(mist.pixels[(Math.floor(500 / open.cell) * open.cols + Math.floor(1950 / open.cell)) * 4 + 3] > 0);
});

function createSmokeAirEmpty(field) { const air = createSmokeAir(MIST_AIR); air.setup(field, []); return air; }
