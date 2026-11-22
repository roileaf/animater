import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { areaRegion, pathRegion, DRAW_SHAPES } from '../../../scripts/engines/mapbuild/path-lay.mjs';
import { planDocuments } from '../../../scripts/engines/mapbuild/map-plan.mjs';
import { DECOR_KINDS, DECOR_DRAFTS, runLine, runBlocks, bakedLean, runSpan, paintDecor } from '../../../scripts/engines/motion/decor-paint.mjs';
import { trunkWalls, decorSettings, decorPlacements } from '../../../scripts/engines/motion/decor-regions.mjs';
import { brushKindsFor } from '../../../scripts/ui/decor-brush-bar.mjs';

// What a map made from nothing still lacked by hand (Roi: "yes, all"): ground laid without a map picture to read,
// fences that stop a creature, the decorations that were drawn and never offered, and a roof that can be taken back.
const own = (region) => region.flags.animater;
const shell = readFileSync(new URL('../../../scripts/shell/map-painting.mjs', import.meta.url), 'utf8');

test('ground is filled in as an outline, a box, or the whole map', () => {
  assert.deepEqual(DRAW_SHAPES.map(([k]) => k), ['line', 'area', 'box', 'all', 'edit']);
  const yard = areaRegion('dirt', { points: [[0, 0], [500, 0], [500, 400], [0, 400]], style: 'earth', edge: 0.8, levelId: 'L1' });
  assert.deepEqual(yard.shapes, [{ type: 'polygon', points: [0, 0, 500, 0, 500, 400, 0, 400], hole: false }]);
  assert.deepEqual([own(yard).floor, own(yard).texture, own(yard).stepEdge], ['dirt', 'on', 0.8]); assert.deepEqual(own(yard).textureStyles, { dirt: 'earth' }); assert.deepEqual(yard.levels, ['L1']);
  const hall = areaRegion('stone', { box: { x: 100, y: 100, width: 600, height: 300 }, edge: 0 });
  assert.equal(hall.shapes[0].type, 'rectangle'); assert.equal(own(hall).stepEdgeOff, true);
  const pond = areaRegion('water', { points: [[0, 0], [300, 0], [150, 200]] });
  assert.deepEqual([own(pond).waterKind, own(pond).flowTo, pond.name], ['still', '', 'Pond']);
  assert.equal(areaRegion('grass', { points: [[0, 0], [100, 0]] }), null, 'two points close nothing in');
  assert.equal(areaRegion('grass', { box: { x: 0, y: 0, width: 0, height: 50 } }), null);
});

test('the ground under a whole map is marked as that, hard-edged, and the builder\'s is the same kind of thing', () => {
  const ground = areaRegion('grass', { box: { x: 0, y: 0, width: 3000, height: 2000 }, style: 'meadow', edge: 1, whole: true });
  assert.equal(own(ground).wholeMap, true); assert.equal(own(ground).stepEdgeOff, true); assert.equal(ground.name, 'Ground');
  assert.equal(own(planDocuments({ x: 0, y: 0, width: 3000, height: 2000, ground: { floor: 'grass' } }).regions[0]).wholeMap, true);
  const fill = shell.slice(shell.indexOf('const pathFillMap = '), shell.indexOf('const pathDown = '));
  assert.match(fill, /regionsHere\(\)\.filter\(\(r\) => r\.flags\?\.\[ID\]\?\.wholeMap === true\)/, 'laid again, it takes the place of the last');
  assert.match(fill, /rememberDecorStep\(\{ kind: "floor", updates: \[\], creates: \[\{ id: made\.id, data \}\], removes \}\)/, 'and undo puts the old ground back');
  assert.ok(!fill.includes('readMap'), 'no map picture is read');
});

test('a fence can be laid to stop movement: a low wall along each piece, end post to end post', () => {
  assert.equal(runBlocks('fence'), true); assert.equal(runBlocks('stakeFence'), true); assert.equal(runBlocks('bush'), false); assert.equal(runBlocks('crate'), false);
  const fence = pathRegion('fence', [[0, 0], [1000, 0]], { grid: 100, seed: 5, blocks: true });
  assert.equal(own(fence).decor.blocks, true);
  assert.equal(own(pathRegion('fence', [[0, 0], [1000, 0]], { grid: 100 })).decor.blocks, undefined, 'only when asked');
  assert.equal(own(pathRegion('hedge', [[0, 0], [1000, 0]], { grid: 100, blocks: true })).decor.blocks, undefined, 'a hedge is bushes: nothing to wall');
  const settings = decorSettings(own(fence).decor), placed = decorPlacements({ settings, areas: [[-200, -200, 1200, -200, 1200, 200, -200, 200]], grid: 100, id: 'r' });
  const walls = trunkWalls(placed, 100);
  assert.equal(walls.length, placed.length); assert.ok(walls.every((w) => w.low === true));
  const sorted = walls.map((w) => (w.c[0] <= w.c[2] ? w.c : [w.c[2], w.c[3], w.c[0], w.c[1]])).sort((a, b) => a[0] - b[0]);
  assert.ok(Math.abs(sorted[0][0]) <= 1 && Math.abs(sorted.at(-1)[2] - 1000) <= 1, 'from one end of the line to the other');
  for (const [i, c] of sorted.entries()) { assert.ok(Math.abs(c[1]) <= 1 && Math.abs(c[3]) <= 1, 'along the line, whatever lean each picture has'); if (i) assert.ok(Math.abs(c[0] - sorted[i - 1][2]) <= 2, 'with no gap to slip through'); }
  const d = { kind: 'fence', x: 500, y: 500, size: 2, turn: 0.4, seed: 3 }, line = runLine(d, 100), a = 0.4 + bakedLean(d), half = runSpan('fence') * 100;
  assert.deepEqual(line, [Math.round(500 - Math.cos(a) * half), Math.round(500 - Math.sin(a) * half), Math.round(500 + Math.cos(a) * half), Math.round(500 + Math.sin(a) * half)]);
  assert.equal(runLine({ kind: 'oak', x: 0, y: 0, size: 2, turn: 0, seed: 1 }, 100), null);
  assert.match(shell, /sight: low \? 0 : 20, light: low \? 0 : 20, sound: 0/, 'sight and light pass over a fence; a tree trunk still stops them');
});

test('a tree\'s trunk is still a ring, beside a fence in the same region', () => {
  const walls = trunkWalls([{ kind: 'oak', x: 0, y: 0, size: 2.6, turn: 0, seed: 1 }, { kind: 'fence', x: 500, y: 0, size: 2, turn: 0, seed: 1, fixed: true }], 100);
  assert.equal(walls.filter((w) => !w.low).length, 8); assert.equal(walls.filter((w) => w.low).length, 1);
});

test('every decoration that was drawn is offered: nothing is left a draft', () => {
  assert.deepEqual(Object.keys(DECOR_DRAFTS), []);
  const was = ['candles', 'firewood', 'choppingBlock', 'cart', 'signpost', 'rubbish', 'nest', 'beehive', 'burrow', 'anthill', 'carcass', 'feathers', 'tracks', 'mineCart', 'oreVein', 'chains', 'hangingRoots', 'dripSpot', 'bloodstain', 'hitchingPost', 'washingLine', 'pump', 'kennel', 'weaponRack'];
  const offered = new Set(['surface', 'town', 'indoor', 'water', 'cave'].flatMap((place) => brushKindsFor(place)));
  for (const id of was) { assert.ok(DECOR_KINDS[id]?.label && DECOR_KINDS[id].size > 0, `${id} is a kind`); assert.ok(offered.has(id), `${id} is on the brush somewhere`); }
  assert.ok(brushKindsFor('town').includes('cart') && brushKindsFor('town').includes('signpost'));
  assert.ok(brushKindsFor('indoor').includes('candles') && brushKindsFor('indoor').includes('weaponRack'));
  assert.ok(brushKindsFor('cave').includes('mineCart') && !brushKindsFor('surface').includes('mineCart'));
  assert.ok(!brushKindsFor('surface').includes('cart'), 'built things stay out of the wild');
  assert.equal(typeof paintDecor, 'function');
});

test('a roof put on or taken off can be taken back', () => {
  assert.match(shell, /if \(JSON\.stringify\(before\) !== JSON\.stringify\(after\)\) rememberDecorStep\(\{ kind: "roofs", before, after \}\);/);
  assert.match(shell, /else if \(step\.kind === "roofs"\) await canvas\.scene\?\.update\(\{ \[`flags\.\$\{ID\}\.roofs`\]: step\.before \}\);/);
  assert.match(shell, /else if \(step\.kind === "roofs"\) await canvas\.scene\?\.update\(\{ \[`flags\.\$\{ID\}\.roofs`\]: step\.after \}\);/);
});
