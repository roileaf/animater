import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPlan } from '../../../scripts/engines/mapbuild/map-presets.mjs';
import { planDocuments } from '../../../scripts/engines/mapbuild/map-plan.mjs';
import { furnishRoom } from '../../../scripts/engines/mapbuild/furnish.mjs';
import { DECOR_KINDS } from '../../../scripts/engines/motion/decor-paint.mjs';

// The two maps that are indoors all the way through: rooms cut out of rock, and a cavern. Both are walls first — what
// the vision stops at — so they are tested as walls: that every room can be reached, and that the cavern closes.
const MAP = { x: 0, y: 0, width: 3000, height: 2000, grid: 100 };
const own = (doc) => doc.flags.animater;

// The rooms of a dungeon, reached from its front door through its inner doors: flood over the squares, a wall between
// two squares stopping it unless a door is let into it there.
const reached = (plan) => {
  const b = plan.buildings[0], g = 100, cols = b.w / g, rows = b.h / g;
  const blocked = new Set(); // "x,y,v" a wall on the west side of square x,y; "x,y,h" on its north side
  for (const part of b.inner) {
    const [x1, y1, x2, y2] = part.c.map((v, i) => (v - (i % 2 ? b.y : b.x)) / g), vertical = x1 === x2, len = vertical ? y2 - y1 : x2 - x1;
    for (let k = 0; k < len; k++) { if (part.door && k * g >= part.door.from && k * g < part.door.to) continue; blocked.add(vertical ? `${x1},${y1 + k},v` : `${x1 + k},${y1},h`); }
  }
  const seen = new Set(['0,0']), queue = [[0, 0]];
  while (queue.length) {
    const [x, y] = queue.pop();
    for (const [nx, ny, wall] of [[x - 1, y, `${x},${y},v`], [x + 1, y, `${x + 1},${y},v`], [x, y - 1, `${x},${y},h`], [x, y + 1, `${x},${y + 1},h`]]) {
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows || blocked.has(wall) || seen.has(`${nx},${ny}`)) continue;
      seen.add(`${nx},${ny}`); queue.push([nx, ny]);
    }
  }
  return { seen: seen.size, all: cols * rows };
};

test('a dungeon is one block of rooms, and every square of it can be walked to', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const plan = buildPlan('dungeon', { ...MAP, seed });
    assert.equal(plan.buildings.length, 1); assert.equal(plan.buildings[0].roof, false); assert.equal(plan.where, 'cave');
    assert.ok(plan.buildings[0].inner.length >= 3, `dungeon ${seed}: ${plan.buildings[0].inner.length} dividing walls`);
    assert.ok(plan.buildings[0].inner.every((p) => p.door && p.door.to - p.door.from === 100), 'a door in every dividing wall');
    const flood = reached(plan);
    assert.equal(flood.seen, flood.all, `dungeon ${seed}: ${flood.all - flood.seen} squares walled off`);
    assert.equal(plan.things.filter((t) => DECOR_KINDS[t.kind]?.tree).length, 0, 'nothing grows in rock');
    assert.deepEqual(plan.ground, { floor: 'glass', style: 'obsidian' }, 'solid rock round it');
    assert.equal(plan.lights.length, 2, 'a torch either side of the way in');
  }
});

test('no dividing wall of a dungeon ends in a doorway', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const b = buildPlan('dungeon', { ...MAP, seed }).buildings[0], doors = [];
    for (const p of b.inner) { const [x1, y1, x2, y2] = p.c, len = Math.hypot(x2 - x1, y2 - y1), mid = (p.door.from + p.door.to) / 2; doors.push([x1 + ((x2 - x1) * mid) / len, y1 + ((y2 - y1) * mid) / len]); }
    for (const p of b.inner) for (const end of [[p.c[0], p.c[1]], [p.c[2], p.c[3]]]) for (const d of doors) assert.ok(Math.hypot(end[0] - d[0], end[1] - d[1]) > 60, `dungeon ${seed}: a wall ends in a door`);
  }
});

test('a dungeon\'s rooms are furnished, and it is made into walls and a floor with no roof', () => {
  const plan = buildPlan('dungeon', { ...MAP, seed: 4 }), docs = planDocuments(plan, { grid: 100 });
  assert.ok(plan.things.length >= 15, `${plan.things.length} things`);
  const b = plan.buildings[0];
  for (const t of plan.things) assert.ok(t.x > b.x && t.x < b.x + b.w && t.y > b.y && t.y < b.y + b.h, `${t.kind} inside the dungeon`);
  assert.equal(docs.roofs.length, 0); assert.ok(docs.walls.filter((w) => w.door === 1).length >= 4);
  assert.equal(own(docs.regions.find((r) => own(r).decor)).decor.where, 'cave');
  assert.equal(docs.lights[0].flags.animater.fireKind, 'torch');
});

test('a cave is closed in by its wall but for its mouth, with rock pillars and nothing outside it', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const plan = buildPlan('cave', { ...MAP, seed }), ring = plan.walls[0];
    assert.equal(ring.closed, true); assert.equal(ring.material, 'natural'); assert.equal(ring.gap.length, 2, 'two legs left out: the mouth');
    assert.ok(ring.line.length >= 18);
    for (const p of ring.line) assert.ok(p[0] > 0 && p[0] < 3000 && p[1] > 0 && p[1] < 2000, `cave ${seed}: its wall on the map`);
    const inside = (x, y) => { let hit = false; const n = ring.line.length; for (let i = 0, j = n - 1; i < n; j = i++) { const a = ring.line[i], c = ring.line[j]; if ((a[1] > y) !== (c[1] > y) && x < ((c[0] - a[0]) * (y - a[1])) / (c[1] - a[1]) + a[0]) hit = !hit; } return hit; };
    for (const t of plan.things) assert.ok(inside(t.x, t.y), `cave ${seed}: ${t.kind} outside the cavern`);
    for (const w of plan.water) assert.ok(inside(w.shapes[0].x, w.shapes[0].y), `cave ${seed}: its pool outside`);
    assert.ok(plan.walls.length >= 2, `cave ${seed}: no pillar of rock`);
    assert.equal(plan.buildings.length, 0); assert.equal(plan.where, 'cave');
  }
});

test('free walls are laid a leg at a time, the closed ones joined up and the gap left open', () => {
  const docs = planDocuments({ ...MAP, walls: [{ line: [[0, 0], [100, 0], [100, 100], [0, 100]], closed: true, gap: [1], material: 'natural', thick: 0.3, age: 0.6 }, { line: [[500, 500], [600, 500], [600, 500]] }] });
  assert.deepEqual(docs.walls.map((w) => w.c), [[0, 0, 100, 0], [100, 100, 0, 100], [0, 100, 0, 0], [500, 500, 600, 500]]);
  assert.deepEqual([own(docs.walls[0]).material, own(docs.walls[0]).thick, own(docs.walls[0]).built], ['natural', 0.3, true]);
  const cave = planDocuments(buildPlan('cave', { ...MAP, seed: 2 }), { grid: 100 });
  assert.ok(cave.walls.length >= 20 && cave.walls.every((w) => own(w).material === 'natural'));
  assert.equal(cave.regions.find((r) => r.name === 'Cavern floor').shapes[0].type, 'polygon');
});

test('a room that does not fill its box is furnished only where it is', () => {
  const box = { x: 0, y: 0, w: 600, h: 600 }, round = (x, y) => Math.hypot(x - 300, y - 300) < 250;
  for (let seed = 1; seed <= 10; seed++) {
    const { things } = furnishRoom(box, 'library', { grid: 100, seed, inside: round });
    assert.ok(things.length >= 2, `seed ${seed}: a round room still gets furniture`);
    for (const t of things) assert.ok(round(t.x, t.y), `seed ${seed}: ${t.kind} outside the tower`);
  }
  const all = furnishRoom(box, 'bedroom', { grid: 100, seed: 3 }).things, inL = furnishRoom(box, 'bedroom', { grid: 100, seed: 3, inside: (x, y) => !(x > 300 && y > 300) }).things;
  assert.ok(inL.every((t) => !(t.x > 300 && t.y > 300)) && inL.length <= all.length, 'nothing in the corner an L-shaped room does not have');
});
