import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { planDocuments, houseFrom, floorFor, builtOf, BUILT_ROOF } from '../../../scripts/engines/mapbuild/map-plan.mjs';
import { pathRegion, pathUnder, pointAt, legAt } from '../../../scripts/engines/mapbuild/path-lay.mjs';
import { mirroredOver, snappedDrag, prefabOf, prefabRegion, prefabsOf, PREFAB_MOST } from '../../../scripts/engines/mapbuild/decor-select.mjs';
import { DECOR_KINDS } from '../../../scripts/engines/motion/decor-paint.mjs';
import { turnOf } from '../../../scripts/engines/motion/decorations.mjs';
import { decorSettings } from '../../../scripts/engines/motion/decor-regions.mjs';

// The second batch of map making by hand: a whole building in one drag, a Select that shows what it is dragging and
// keeps to the grid and mirrors, prefabs, and a laid path whose points can be moved.
const own = (doc) => doc.flags.animater;
const shell = readFileSync(new URL('../../../scripts/shell/map-painting.mjs', import.meta.url), 'utf8');
const at = (kind, x, y, more = {}) => ({ kind, x, y, size: DECOR_KINDS[kind].size, turn: 0, seed: 7, flip: false, ...more });
const near = (a, b) => Math.abs(a - b) < 1e-9;

test('a box dragged is a whole building: a door in the side it faces, windows in the others, its usual floor', () => {
  const house = houseFrom({ x: 500, y: 300, w: 600, h: 400 }, { grid: 100, face: 's', material: 'dressed', age: 0.2, id: 'abc' });
  assert.deepEqual(house.doors, [{ side: 's', from: 300, to: 400 }]);
  assert.deepEqual(house.windows.map((o) => [o.side, o.from]), [['n', 100], ['n', 400], ['e', 200], ['w', 200]]);
  assert.deepEqual(house.floor, { floor: 'stone', style: 'flagstones' }); assert.deepEqual(floorFor('timber'), ['wood', 'planks']);
  assert.equal(houseFrom({ x: 0, y: 0, w: 600, h: 400 }, { face: 'n' }).doors[0].side, 'n');
  assert.equal(houseFrom({ x: 0, y: 0, w: 50, h: 400 }), null, 'less than a square is no building');
  assert.deepEqual(houseFrom({ x: 0, y: 0, w: 200, h: 200 }, { face: 's' }).windows, [], 'a hut two squares across has a door and no room for windows');
});

test('laid by hand it is the GM\'s own: nothing of it is marked as built, so Clear what was built leaves it', () => {
  const house = houseFrom({ x: 500, y: 300, w: 600, h: 400 }, { grid: 100, material: 'timber', thick: 0.3, tint: '#aa8866', id: 'abc' });
  const docs = planDocuments({ buildings: [house] }, { grid: 100, mark: false });
  assert.ok(docs.walls.length >= 8 && docs.walls.every((w) => own(w).built === undefined && own(w).thick === 0.3 && own(w).tint === '#aa8866'));
  assert.equal(docs.regions.length, 1); assert.equal(own(docs.regions[0]).built, undefined);
  assert.equal(docs.roofs[0].id, 'abc'); assert.ok(!docs.roofs[0].id.startsWith(BUILT_ROOF));
  const scene = { regions: docs.regions.map((r, i) => ({ ...r, id: `r${i}` })), walls: docs.walls.map((w, i) => ({ ...w, id: `w${i}` })), lights: [], roofs: docs.roofs };
  assert.deepEqual(builtOf(scene), { regions: [], walls: [], lights: [], roofsKept: docs.roofs });
  // And marked, as the map builder lays it, it is all the builder's.
  assert.ok(planDocuments({ buildings: [house] }, { grid: 100 }).walls.every((w) => own(w).built === true));
  const lay = shell.slice(shell.indexOf('const houseLay = '), shell.indexOf('// (Heard on the window before'));
  assert.match(lay, /planDocuments\(\{ buildings: \[house\] \}, \{ grid: g, mark: false \}\)/);
  assert.match(lay, /face: to\.y >= from\.y \? "s" : "n"/, 'dragged down the map its door faces south');
  assert.match(lay, /rememberDecorStep\(\{ kind: "building", walls:/, 'one step takes the whole of it back');
  assert.equal([...shell.matchAll(/step\.kind === "building"/g)].length, 2);
});

test('mirrored, one stays where it stands and several become their mirror image', () => {
  const [one] = mirroredOver([at('bed', 100, 100, { turn: 0.5, fixed: true })]);
  assert.deepEqual([one.x, one.y, one.mirror, one.fixed], [100, 100, true, true]); assert.ok(near(one.turn, -0.5));
  const [a, b] = mirroredOver([at('bed', 0, 0), at('desk', 200, 50)]);
  assert.deepEqual([a.x, b.x, a.y, b.y], [200, 0, 0, 50]);
  const back = mirroredOver(mirroredOver([at('bed', 0, 0, { turn: 0.3, fixed: true }), at('desk', 200, 50)]));
  assert.deepEqual([back[0].x, back[1].x, back[0].mirror, back[1].mirror], [0, 200, undefined, undefined], 'twice is as it was');
  assert.ok(near(turnOf(back[0]), 0.3));
  const draws = readFileSync(new URL('../../../scripts/engines/motion/decorations.mjs', import.meta.url), 'utf8');
  assert.match(draws, /\(d\.flip && DECOR_KINDS\[d\.kind\]\?\.flat \? -1 : 1\) \* \(d\.mirror \? -1 : 1\) \* k/, 'drawn mirrored, whatever kind it is; the brush\'s own flip still only shows on what lies flat');
});

test('a drag kept to the grid puts the first one picked on a half square', () => {
  assert.deepEqual(snappedDrag(at('bed', 110, 95), 133, 12, 100), { dx: 140, dy: 5 });
  assert.deepEqual(snappedDrag(null, 13, 12, 100), { dx: 13, dy: 12 });
  assert.match(shell, /if \(e\?\.shiftKey\) \(\{ dx, dy \} = snappedDrag\(selectedNow\(\)\[0\]\?\.d, dx, dy, grid\(\)\)\);/);
  assert.match(shell, /if \(sl\.drag\.moved\) \{ selectGhost\(true\); sl\.ghost\?\.position\.set\(dx, dy\); \}/, 'what is dragged is seen going with the pointer');
});

test('a prefab keeps how its pieces stand to each other and nothing of where they were', () => {
  const room = [at('bed', 1000, 1000, { turn: 1, prop: { material: 'wood' } }), at('rug', 1200, 1100, { flip: true }), at('desk', 1100, 900, { mirror: true, fixed: true, turn: 0.2 })];
  const prefab = prefabOf(room, '  A bedroom  ');
  assert.equal(prefab.name, 'A bedroom');
  assert.deepEqual(prefab.items.map((it) => [it.kind, it.dx, it.dy]), [['bed', -100, 0], ['rug', 100, 100], ['desk', 0, -100]]);
  assert.ok(prefab.items.every((it) => it.x === undefined && it.seed === undefined));
  assert.ok(near(prefab.items[0].turn, turnOf(room[0])), 'turned as it was seen'); assert.deepEqual(prefab.items[0].prop, { material: 'wood' }); assert.equal(prefab.items[2].mirror, true);
  assert.equal(prefabOf([], '').name, 'Prefab'); assert.ok(prefabOf(Array.from({ length: 300 }, () => at('crate', 0, 0)), 'x').items.length === PREFAB_MOST);
});

test('set down, a prefab is a region of its own with its pieces laid by hand, fitted to the map\'s scale', () => {
  const prefab = { ...prefabOf([at('bed', 1000, 1000), at('rug', 1200, 1100)], 'Room'), grid: 100 };
  const region = prefabRegion(prefab, 3000, 2000, { grid: 100, was: 100, seed: 5, levelId: 'L1' });
  const decor = decorSettings(own(region).decor);
  assert.deepEqual(decor.brushed.map((d) => [d.kind, d.x, d.y, d.fixed]), [['bed', 2900, 1950, true], ['rug', 3100, 2050, true]]);
  assert.equal(decor.density, 0); assert.equal(region.shapes.length, 2); assert.equal(region.name, 'Room'); assert.deepEqual(region.levels, ['L1']);
  assert.ok(new Set(decor.brushed.map((d) => d.seed)).size === 2);
  const half = prefabRegion(prefab, 0, 0, { grid: 50, was: 100 });
  assert.deepEqual(own(half).decor.brushed.map((d) => [d.x, d.y]), [[-50, -25], [50, 25]], 'on a map of half the square, half as far apart');
  assert.equal(prefabRegion({ name: 'x', items: [] }, 0, 0), null);
  assert.deepEqual(prefabsOf([prefab, null, { name: 'bad' }, { name: 'empty', items: [] }]).map((p) => p.name), ['Room']); assert.deepEqual(prefabsOf('nonsense'), []);
  assert.match(shell, /game\.user\.setFlag\(ID, "prefabs", list\)/, 'kept with the GM who made them');
});

test('a path remembers how it was drawn, and the one under the pointer is found by its line', () => {
  const road = pathRegion('road', [[0, 500], [500, 500], [1000, 700]], { grid: 100, wide: 2, seed: 9 });
  assert.deepEqual(own(road).pathLine, [[0, 500], [500, 500], [1000, 700]]); assert.equal(own(road).pathWide, 2); assert.equal(own(road).pathSmooth, true); assert.equal(own(road).pathSeed, 9);
  const fence = pathRegion('fence', [[0, 0], [800, 0]], { grid: 100, blocks: true });
  const regions = [{ id: 'road', own: own(road) }, { id: 'fence', own: own(fence) }, { id: 'old', own: { path: 'road' } }, { id: 'other', own: { floor: 'grass' } }];
  const found = pathUnder(regions, 250, 580, { grid: 100, reach: 30 });
  assert.equal(found.id, 'road', 'anywhere on a road finds it: half its width is in reach'); assert.equal(found.kind, 'road'); assert.equal(found.wide, 2);
  found.line[0][0] = 999; assert.equal(own(road).pathLine[0][0], 0, 'what is handed over is a copy');
  assert.equal(pathUnder(regions, 400, 20, { grid: 100, reach: 30 }).id, 'fence'); assert.equal(pathUnder(regions, 400, 20, { grid: 100, reach: 30 }).blocks, true);
  assert.equal(pathUnder(regions, 400, 60, { grid: 100, reach: 30 }), null, 'a fence is only its line');
  assert.equal(pathUnder(regions, 2000, 2000, { grid: 100 }), null);
});

test('a point is picked up, or one is put into the line between two', () => {
  const line = [[0, 0], [500, 0], [500, 500]];
  assert.equal(pointAt(line, 495, 8, 30), 1); assert.equal(pointAt(line, 250, 0, 30), -1);
  assert.equal(legAt(line, 250, 10, 30), 0); assert.equal(legAt(line, 510, 250, 30), 1); assert.equal(legAt(line, 250, 250, 30), -1);
  const edit = shell.slice(shell.indexOf('const pathRelay = '), shell.indexOf('const pathFinish = '));
  assert.match(edit, /pt\.points\.splice\(leg \+ 1, 0, pathSnap\(p, e\.shiftKey\)\); i = leg \+ 1;/);
  assert.match(edit, /rememberDecorStep\(\{ kind: "floor", updates: \[\], creates: \[\{ id: made\.id, data \}\], removes \}\)/, 'laid again in one step: undo puts the old path back');
  assert.match(edit, /pathRegion\(edit\.kind, drawn, \{ grid: grid\(\), wide: edit\.wide, smooth: edit\.smooth, seed: edit\.seed/, 'it stays what it was: only its line changes');
});
