import test from 'node:test';
import assert from 'node:assert/strict';
import { furnishRoom, ROOM_KINDS, ROOM_IDS, ROOM_CHOICES } from '../../../scripts/engines/mapbuild/furnish.mjs';
import { buildPlan, MAP_PRESETS, MAP_PRESET_IDS } from '../../../scripts/engines/mapbuild/map-presets.mjs';
import { planDocuments } from '../../../scripts/engines/mapbuild/map-plan.mjs';
import { DECOR_KINDS } from '../../../scripts/engines/motion/decor-paint.mjs';

// Furnishing a room by what it is — the one thing no hand tool did, and what the map builder was already doing for
// its own buildings — and three more maps to build from nothing.
const MAP = { x: 0, y: 0, width: 3000, height: 2000, grid: 100 };
const box = { x: 1000, y: 500, w: 700, h: 500 };

test('every room kind is made of decorations the module has, and the menu offers real ones', () => {
  for (const id of ROOM_IDS) for (const [what, where, many] of ROOM_KINDS[id].items) { assert.ok(DECOR_KINDS[what], `${id}: ${what}`); assert.ok(['corner', 'wall', 'middle'].includes(where)); assert.ok(many >= 1); }
  for (const [id, label] of ROOM_CHOICES) { assert.ok(ROOM_KINDS[id], id); assert.equal(label, ROOM_KINDS[id].label); }
  assert.ok(ROOM_CHOICES.length >= 12);
});

test('a room is furnished inside its walls, the same way for the same seed and another way for another', () => {
  for (const id of ROOM_IDS) {
    const { things } = furnishRoom(box, id, { grid: 100, seed: 4 });
    assert.ok(things.length >= 2, `${id}: ${things.length} things`);
    for (const t of things) { assert.ok(t.x > box.x + 30 && t.x < box.x + box.w - 30 && t.y > box.y + 30 && t.y < box.y + box.h - 30, `${id}: ${t.kind} in the room`); assert.equal(t.fixed, true); assert.ok(t.size > 0); }
    assert.deepEqual(furnishRoom(box, id, { grid: 100, seed: 4 }), furnishRoom(box, id, { grid: 100, seed: 4 }));
  }
  assert.notDeepEqual(furnishRoom(box, 'tavern', { grid: 100, seed: 4 }).things, furnishRoom(box, 'tavern', { grid: 100, seed: 5 }).things);
});

test('nothing stands in a doorway, a fire says so, and a table has a rug where there is room', () => {
  const door = [box.x + box.w / 2, box.y + box.h];
  for (let seed = 1; seed <= 20; seed++) for (const t of furnishRoom(box, 'tavern', { grid: 100, seed, doors: [door] }).things) assert.ok(Math.hypot(t.x - door[0], t.y - door[1]) > 140, `seed ${seed}: ${t.kind} in the doorway`);
  assert.equal(furnishRoom(box, 'kitchen', { seed: 1 }).hearth, true); assert.equal(furnishRoom(box, 'library', { seed: 1 }).hearth, false);
  const home = furnishRoom(box, 'home', { seed: 2 }).things, table = home.find((t) => t.kind === 'tableStools'), rug = home.find((t) => t.kind === 'rug');
  assert.ok(table && rug && rug.x === table.x && rug.y === table.y);
  assert.deepEqual(furnishRoom({ x: 0, y: 0, w: 100, h: 100 }, 'home'), { things: [], hearth: false }, 'a cupboard is not furnished');
  const small = furnishRoom({ x: 0, y: 0, w: 200, h: 200 }, 'bedroom', { seed: 1 }).things;
  assert.ok(small.length >= 1 && small.every((t) => t.size <= 0.81), 'in a small room the furniture is small');
  assert.equal(furnishRoom(box, 'nonsense', { seed: 1 }).things.length, furnishRoom(box, 'home', { seed: 1 }).things.length, 'an unknown kind is a home');
});

test('in squares as in pixels: the map builder furnishes its buildings with the same hand', () => {
  const px = furnishRoom(box, 'store', { grid: 100, seed: 9, doors: [[1350, 1000]] }).things, sq = furnishRoom({ x: 10, y: 5, w: 7, h: 5 }, 'store', { grid: 1, seed: 9, doors: [[13.5, 10]] }).things;
  assert.deepEqual(sq.map((t) => [t.kind, Math.round(t.x * 100), Math.round(t.y * 100), t.size]), px.map((t) => [t.kind, Math.round(t.x), Math.round(t.y), t.size]));
  const village = buildPlan('village', { ...MAP, seed: 3 });
  const inside = village.things.filter((t) => t.fixed && village.buildings.some((b) => t.x > b.x && t.x < b.x + b.w && t.y > b.y && t.y < b.y + b.h));
  assert.ok(inside.length >= 8, 'its houses are furnished');
  assert.ok(planDocuments(village, { grid: 100 }).regions.flatMap((r) => r.flags.animater.decor?.brushed ?? []).some((d) => d.fixed === true && d.kind === 'bed'), 'and the furniture is kept turned as it was set');
});

test('a pier laid along a line lies along it: its sections are painted any way round, and each is turned back by all of it', async () => {
  const { bakedLean, seeded, paintSeedOf, runBlocks } = await import('../../../scripts/engines/motion/decor-paint.mjs');
  const { pathPieces } = await import('../../../scripts/engines/mapbuild/path-lay.mjs');
  const d = { kind: 'dock', seed: 4242 };
  assert.equal(bakedLean(d), seeded(paintSeedOf(d))() * 6.28);
  assert.equal(bakedLean({ kind: 'steppingStones', seed: 7 }), seeded(paintSeedOf({ kind: 'steppingStones', seed: 7 }))() * 6.28);
  assert.equal(bakedLean({ kind: 'rails', seed: 7 }), (seeded(paintSeedOf({ kind: 'rails', seed: 7 }))() - 0.5) * 0.3);
  const pier = pathPieces('dock', [[500, 0], [500, 800]], { grid: 100, seed: 3 });
  assert.ok(pier.length >= 4);
  for (const p of pier) { assert.ok(Math.abs(p.turn + bakedLean(p) - Math.PI / 2) < 1e-9, 'every section runs out from the quay'); assert.equal(p.x, 500); }
  assert.equal(runBlocks('dock'), false, 'a pier is walked on: only fences are barriers'); assert.equal(runBlocks('rails'), false); assert.equal(runBlocks('fence'), true);
});

test('three more maps: a graveyard, a harbour and a ruin, each with what it is named for', () => {
  assert.deepEqual(MAP_PRESET_IDS, ['village', 'inn', 'camp', 'farm', 'graveyard', 'harbour', 'ruin', 'dungeon', 'cave']);
  for (const id of MAP_PRESET_IDS) assert.ok(MAP_PRESETS[id].label && MAP_PRESETS[id].hint);
  for (let seed = 1; seed <= 15; seed++) {
    const yard = buildPlan('graveyard', { ...MAP, seed });
    assert.ok(yard.things.filter((t) => t.kind === 'tombstone').length >= 20, `graveyard ${seed}: ${yard.things.filter((t) => t.kind === 'tombstone').length} stones`);
    assert.ok(yard.buildings.some((b) => b.kind === 'shrine'), `graveyard ${seed}: no chapel`); assert.equal(yard.runs.filter((r) => r.kind === 'fence').length, 5, 'fenced, with a gate left in it');
    const port = buildPlan('harbour', { ...MAP, seed });
    assert.equal(port.water.length, 1); assert.ok(port.water[0].shapes[0].width === 3000, 'the water runs the width of the map');
    assert.ok(port.runs.some((r) => r.kind === 'dock'), `harbour ${seed}: no pier`); assert.ok(port.buildings.length >= 2, `harbour ${seed}: ${port.buildings.length} buildings`);
    assert.equal(port.paths[0].floor, 'stone', 'a cobbled quay');
    for (const b of port.buildings) assert.ok(b.y + b.h <= port.water[0].shapes[0].y, `harbour ${seed}: a warehouse in the water`);
    const ruin = buildPlan('ruin', { ...MAP, seed });
    assert.ok(ruin.buildings.length >= 2 && ruin.buildings.every((b) => b.roof === false && b.age >= 0.8), `ruin ${seed}: roofless and old`);
    assert.ok(ruin.things.some((t) => t.kind === 'rubble') && ruin.things.some((t) => t.kind === 'brokenPillar' || t.kind === 'column'));
    assert.equal(planDocuments(ruin, { grid: 100 }).roofs.length, 0);
    assert.ok(planDocuments(ruin, { grid: 100 }).walls.every((w) => w.flags.animater.age >= 0.8), 'its walls have the years on them');
  }
});
