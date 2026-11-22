import test from 'node:test';
import assert from 'node:assert/strict';
import { planDocuments, builtOf, ribbon, BUILT_ROOF, THINGS_A_REGION, ROUND_SIDES } from '../../../scripts/engines/mapbuild/map-plan.mjs';
import { buildPlan, MAP_PRESET_IDS, TREE_AMOUNTS } from '../../../scripts/engines/mapbuild/map-presets.mjs';
import { DECOR_KINDS } from '../../../scripts/engines/motion/decor-paint.mjs';

// Roi, after a village was put on an empty scene by script: "do you think we can build such a thing inside the module
// itself?" — a window in Foundry, nothing sent anywhere. The plan and the layouts are pure, so they are tested here;
// the shell only writes what they hand it.
const MAP = { x: 0, y: 0, width: 3000, height: 2000, grid: 100 };
const own = (doc) => doc.flags.animater;

test('the ground is one painted floor under the whole map, and everything made is marked as built', () => {
  const { regions, walls, lights, roofs } = planDocuments({ ...MAP, ground: { floor: 'grass', style: 'meadow' }, lights: [{ x: 500, y: 500 }], buildings: [{ x: 500, y: 300, w: 400, h: 300, material: 'timber', floor: { floor: 'wood', style: 'planks' } }] });
  assert.deepEqual(regions[0].shapes, [{ type: 'rectangle', x: 0, y: 0, width: 3000, height: 2000, rotation: 0, hole: false }]);
  assert.equal(own(regions[0]).floor, 'grass'); assert.equal(own(regions[0]).texture, 'on'); assert.deepEqual(own(regions[0]).textureStyles, { grass: 'meadow' });
  for (const doc of [...regions, ...walls, ...lights]) assert.equal(own(doc).built, true);
  assert.ok(roofs.every((r) => r.id.startsWith(BUILT_ROOF)));
});

test('a path is a strip along its line, and water moves', () => {
  assert.deepEqual(ribbon([[0, 100], [200, 100]], 100), [0, 150, 200, 150, 200, 50, 0, 50]);
  const { regions } = planDocuments({ ...MAP, paths: [{ floor: 'dirt', style: 'road', width: 200, line: [[0, 1000], [1500, 900], [3000, 1000]] }], water: [{ shapes: [{ x: 2000, y: 1500, radiusX: 300, radiusY: 200 }] }, { kind: 'river', line: [[2500, 0], [2500, 2000]], width: 200 }] });
  const [path, pond, stream] = regions;
  assert.equal(path.shapes[0].points.length, 12); assert.equal(own(path).floor, 'dirt'); assert.equal(own(path).stepEdge, 0.6);
  assert.equal(own(pond).waterKind, 'still'); assert.equal(own(pond).flowTo, ''); assert.equal(pond.shapes[0].type, 'ellipse');
  assert.equal(own(stream).waterKind, 'river'); assert.equal(own(stream).flowTo, 's'); assert.equal(stream.shapes[0].type, 'polygon');
});

test('a building is walls that close, a door and windows let into them, a floor and a roof', () => {
  const { regions, walls, roofs } = planDocuments({ ...MAP, buildings: [{ id: 'a', x: 500, y: 300, w: 500, h: 400, material: 'dressed', floor: { floor: 'stone', style: 'flagstones' },
    doors: [{ side: 's', from: 200, to: 300 }], windows: [{ side: 'n', from: 200, to: 300 }], inner: [{ c: [800, 300, 800, 700], door: { from: 100, to: 200 } }], roof: { chimney: 'stone' } }] });
  const outer = walls.filter((w) => !(w.c[0] === 800 && w.c[2] === 800));
  // Every corner of the outer wall is met by exactly two walls: nothing left open, nothing doubled.
  const ends = new Map(); for (const w of outer) for (const p of [`${w.c[0]},${w.c[1]}`, `${w.c[2]},${w.c[3]}`]) ends.set(p, (ends.get(p) ?? 0) + 1);
  assert.ok([...ends.values()].every((n) => n === 2), 'the outer wall closes');
  const doors = walls.filter((w) => w.door === 1), windows = walls.filter((w) => own(w).window);
  assert.equal(doors.length, 2, 'the front door and the inner one');
  assert.deepEqual(doors[0].c, [800, 700, 700, 700], 'let into the south side, measured from its east corner');
  assert.equal(own(doors[0]).door, 'banded'); assert.equal(doors[0].ds, 0);
  assert.equal(windows.length, 1); assert.deepEqual(windows[0].c, [700, 300, 800, 300]);
  assert.ok(walls.every((w) => own(w).material === 'dressed' && own(w).thick > 0));
  assert.equal(own(regions[0]).stepEdgeOff, true, 'a room\'s floor ends at its walls');
  assert.deepEqual(roofs, [{ id: `${BUILT_ROOF}a`, x: 500, y: 300, w: 500, h: 400, kind: 'slate', form: 'hip', round: false, age: 0.25, chimney: 'stone', material: 'dressed' }]);
});

test('a side left open has no wall, and a lean-to says which way it leans', () => {
  const { walls, roofs } = planDocuments({ ...MAP, buildings: [{ x: 500, y: 300, w: 500, h: 300, material: 'palisade', open: ['s'], roof: { kind: 'plank', form: 'shed', high: 'north' } }, { x: 1500, y: 300, w: 300, h: 300, roof: false }] });
  assert.equal(walls.length, 3 + 4);
  assert.equal(roofs.length, 1); assert.equal(roofs[0].form, 'shed'); assert.equal(roofs[0].high, 'north');
});

test('a round building is a ring of walls with one door facing where it is asked, under a cone', () => {
  const { walls, roofs, regions } = planDocuments({ ...MAP, buildings: [{ x: 1000, y: 500, w: 400, h: 400, round: true, material: 'fieldstone', floor: { floor: 'stone' }, doors: [{ angle: Math.PI / 2 }] }] });
  assert.equal(walls.length, ROUND_SIDES);
  const doors = walls.filter((w) => w.door === 1);
  assert.equal(doors.length, 1);
  assert.ok((doors[0].c[1] + doors[0].c[3]) / 2 > 880, 'on the south of the ring');
  assert.ok(Math.abs((doors[0].c[0] + doors[0].c[2]) / 2 - 1200) < 5, 'and square on to it');
  assert.equal(roofs[0].form, 'cone'); assert.equal(roofs[0].round, true);
  assert.equal(regions[0].shapes[0].type, 'ellipse');
});

test('only things the module knows are put down, on the map, a region\'s worth at a time', () => {
  const many = Array.from({ length: THINGS_A_REGION + 20 }, (_, i) => ({ kind: 'oak', x: 100 + (i % 50) * 50, y: 100 + Math.floor(i / 50) * 50, size: 3 }));
  const { regions } = planDocuments({ ...MAP, things: [...many, { kind: 'dragon', x: 500, y: 500 }, { kind: 'oak', x: -50, y: 500 }, { kind: 'well', x: 600, y: 600 }] });
  assert.equal(regions.length, 2);
  const [first, second] = regions.map((r) => own(r).decor);
  assert.equal(first.brushed.length, THINGS_A_REGION); assert.equal(second.brushed.length, 21);
  assert.equal(first.density, 0, 'nothing scattered that the plan did not place');
  assert.equal(second.brushed.at(-1).kind, 'well'); assert.equal(second.brushed.at(-1).size, DECOR_KINDS.well.size);
  assert.ok(first.brushed.every((t) => Number.isInteger(t.seed) && t.seed >= 0));
});

test('what the builder made can be told from a GM\'s own work', () => {
  const doc = (id, built) => ({ id, flags: { animater: built ? { built: true } : {} } });
  const found = builtOf({ regions: [doc('r1', true), doc('r2', false)], walls: [doc('w1', false), doc('w2', true)], lights: [doc('l1', true), { id: 'l2' }], roofs: [{ id: `${BUILT_ROOF}b0` }, { id: 'mine' }] });
  assert.deepEqual(found, { regions: ['r1'], walls: ['w2'], lights: ['l1'], roofsKept: [{ id: 'mine' }] });
  assert.deepEqual(builtOf(), { regions: [], walls: [], lights: [], roofsKept: [] });
});

// ------------------------------------------------------------------------------------------------------ the layouts

const boxesOf = (plan) => plan.buildings.map((b) => [b.x, b.y, b.x + b.w, b.y + b.h]);
const inside = (b, x, y, pad = 0) => x > b[0] - pad && x < b[2] + pad && y > b[1] - pad && y < b[3] + pad;
const TREE = (kind) => DECOR_KINDS[kind]?.tree;

test('a seed gives the same map every time, and another seed another map', () => {
  for (const preset of MAP_PRESET_IDS) {
    assert.deepEqual(buildPlan(preset, { ...MAP, seed: 7 }), buildPlan(preset, { ...MAP, seed: 7 }), preset);
    assert.notDeepEqual(buildPlan(preset, { ...MAP, seed: 7 }).things, buildPlan(preset, { ...MAP, seed: 8 }).things, preset);
  }
});

test('every layout keeps to the map, its buildings apart and its trees out of the houses and off the roads', () => {
  for (const preset of MAP_PRESET_IDS) for (let seed = 1; seed <= 25; seed++) {
    const plan = buildPlan(preset, { ...MAP, seed }), boxes = boxesOf(plan), note = `${preset} seed ${seed}`;
    for (const [i, b] of boxes.entries()) {
      assert.ok(b[0] >= 100 && b[1] >= 100 && b[2] <= 2900 && b[3] <= 1900, `${note}: a building off the map`);
      for (const other of boxes.slice(i + 1)) assert.ok(b[2] <= other[0] || other[2] <= b[0] || b[3] <= other[1] || other[3] <= b[1], `${note}: two buildings on one spot`);
    }
    for (const t of plan.things) {
      assert.ok(DECOR_KINDS[t.kind], `${note}: ${t.kind} is not a decoration`);
      assert.ok(Number.isFinite(t.x) && Number.isFinite(t.y) && t.size > 0, `${note}: ${t.kind} has no place`);
      if (TREE(t.kind)) assert.ok(!boxes.some((b) => inside(b, t.x, t.y)), `${note}: a ${t.kind} in a house`);
    }
    for (const b of plan.buildings) if (!b.open.length) assert.equal(b.doors.length, 1, `${note}: a building with no way in`);
    // Made into documents without complaint, and all of it marked.
    const docs = planDocuments(plan, { grid: 100 });
    assert.ok(docs.regions.length >= 2 && docs.regions.every((r) => r.shapes.every(Boolean)), note);
    assert.equal(docs.roofs.length, plan.buildings.filter((b) => b.roof !== false).length, note);
  }
});

test('each layout has what it is named for', () => {
  let ponds = 0, streams = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const village = buildPlan('village', { ...MAP, seed });
    assert.ok(village.buildings.length >= 2, `village ${seed}: ${village.buildings.length} buildings`);
    assert.ok(village.paths.length >= 1 && village.things.some((t) => t.kind === 'well'));
    ponds += village.water.length;
    const inn = buildPlan('inn', { ...MAP, seed });
    assert.ok(inn.buildings.some((b) => b.kind === 'tavern' && b.inner.length === 1), `inn ${seed}: no inn`);
    const camp = buildPlan('camp', { ...MAP, seed });
    assert.equal(camp.lights.length, 1); assert.ok(camp.things.filter((t) => t.kind === 'tent').length >= 2); assert.equal(camp.buildings.length, 0);
    streams += camp.water.length;
    const farm = buildPlan('farm', { ...MAP, seed });
    assert.ok(farm.buildings.some((b) => b.kind === 'barn'), `farm ${seed}: no barn`);
    assert.ok(farm.runs.some((r) => r.kind === 'stakeFence'), `farm ${seed}: no fenced field`);
    const laid = planDocuments(farm, { grid: 100 }).regions.flatMap((r) => own(r).decor?.brushed ?? []).filter((t) => t.kind === 'stakeFence');
    assert.ok(laid.length >= 8 && laid.every((t) => t.fixed === true), `farm ${seed}: its fences are laid as runs, each piece in line`);
  }
  assert.ok(ponds > 5 && ponds < 20, 'some villages have a pond and some do not');
  assert.ok(streams > 5 && streams < 20, 'some camps have a stream and some do not');
});

test('how wooded it is is the GM\'s to say, and a small or odd map still gets one', () => {
  const trees = (amount) => buildPlan('village', { ...MAP, seed: 3, trees: amount }).things.filter((t) => TREE(t.kind)).length;
  assert.equal(trees('none'), 0);
  assert.ok(trees('few') < trees('usual') && trees('usual') < trees('thick'));
  assert.deepEqual(Object.keys(TREE_AMOUNTS), ['none', 'few', 'usual', 'thick']);
  for (const preset of MAP_PRESET_IDS) for (const size of [[600, 400], [1000, 1000], [6000, 1200], [5000, 5000]]) {
    const plan = buildPlan(preset, { x: 300, y: 200, width: size[0], height: size[1], grid: 100, seed: 5 });
    for (const t of plan.things) assert.ok(t.x >= 300 && t.x <= 300 + size[0] && t.y >= 200 && t.y <= 200 + size[1], `${preset} ${size}: ${t.kind} off the map`);
    assert.doesNotThrow(() => planDocuments(plan, { grid: 100 }));
  }
  assert.equal(buildPlan('nonsense', { ...MAP, seed: 1 }).preset, 'village');
});
