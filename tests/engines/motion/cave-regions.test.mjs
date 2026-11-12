import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FLOORS, FLOOR_LOOK, FOOTSTEP_FILES } from '../../../scripts/engines/motion/movement-feel.mjs';
import { CAVE_CHOICES, caveHasMenu, caveKindFlags, caveKindOf, caveLook, caveMenu, defaultSteps, showsTexture, stepFlags, stepIndexOf, stepMenu } from '../../../scripts/engines/motion/region-steps.mjs';

test('fungus goes by its size, amount and stage, and unset is as it always was', () => {
  const usual = caveLook({ cavern: 'fungus-blue' });
  assert.deepEqual([usual.kind, usual.tone, usual.scale, usual.amount, usual.glow], ['fungus', 'blue', 1, 1, 1]);
  const dormant = caveLook({ cavern: 'fungus-blue', caveStep: 0, caveSize: 2, caveAmount: 3 });
  assert.equal(dormant.glow, 0.15); assert.equal(dormant.scale, 1.5); assert.equal(dormant.amount, 1.5);
  assert.equal(caveLook({ cavern: 'fungus-green', caveSize: 9 }).scale, 2, 'past twice its size it blows out to white');
  assert.equal(caveLook({ cavern: 'crystals-rose', caveSize: 9 }).scale, 3 * 1.15);
});

test('crystals flare by stage; mist thickens by stage and amount', () => {
  assert.equal(caveLook({ cavern: 'crystals-rose', caveStep: 0 }).torch, 0.35);
  assert.equal(caveLook({ cavern: 'crystals-rose' }).torch, 1);
  assert.equal(caveLook({ cavern: 'mist' }).thick, 1, 'as it always was');
  assert.equal(caveLook({ cavern: 'mist', caveStep: null }).thick, 1, 'a blank stage is no stage');
  assert.equal(caveLook({ cavern: 'mist', caveStep: 0, caveAmount: 2 }).thick, 0.9);
});

test('lava is a floor: it has steps, walks, and is drawn from its floor', () => {
  assert.ok(FLOORS.includes('lava') && FLOOR_LOOK.lava && FOOTSTEP_FILES.lava.length);
  assert.deepEqual(defaultSteps('lava').map((s) => s.name), ['Crust', 'Cracking', 'Molten'], 'nothing else a floor can become');
  assert.equal(stepIndexOf({ floor: 'lava' }, 'lava'), 2, 'molten until told otherwise, as it is drawn');
  assert.equal(caveKindOf({ floor: 'lava' }), 'lava');
  assert.equal(caveLook({ floor: 'lava' }).heat, 0.6, 'as it always was');
  const steps = defaultSteps('lava'), crust = stepFlags({ floor: 'lava', steps, stepsFloor: 'lava', step: 0 }), cracking = stepFlags({ floor: 'lava', steps, stepsFloor: 'lava', step: 1 });
  assert.equal(crust.floor, 'stone', 'the crust is walked on as rock');
  assert.ok(caveLook(crust).heat < caveLook(cracking).heat && caveLook(cracking).heat < caveLook({ floor: 'lava' }).heat);
  assert.equal(showsTexture({ floor: 'lava' }, 'on'), false, 'no floor texture is painted over it');
});

test('the popup is offered on what it can change, floor or none', () => {
  assert.ok(caveHasMenu({ cavern: 'fungus-green' }) && caveHasMenu({ cavern: 'mist' }) && caveHasMenu({ cavern: 'crystals-rose' }));
  for (const none of [{}, { cavern: 'webs' }, { cavern: 'lava' }, { floor: 'lava' }]) assert.equal(caveHasMenu(none), false);
  const menu = caveMenu({ cavern: 'fungus-blue', caveAmount: 2 }, 'cavern');
  assert.equal(menu.choosable, true); assert.equal(menu.tone, 'blue'); assert.equal(menu.amount, 2); assert.equal(menu.step, 2);
  assert.equal(menu.sizeRange.max, 2);
  assert.equal(caveMenu({ cavern: 'mist' }, 'cavern').tones, null, 'mist has no colour');
  assert.equal(caveMenu({ cavern: 'mist' }, 'stone').choosable, false, 'on a floor it stays what it is');
  assert.deepEqual(CAVE_CHOICES.map(([k]) => k), ['fungus', 'crystals', 'lava', 'mist']);
  assert.equal(caveMenu({}, 'stone'), null);
  assert.deepEqual(caveMenu({ floor: 'lava' }, 'lava'), { kind: 'lava', choosable: true });
});

test('a step that switches on fungus keeps its own say over which, and the sliders still work', () => {
  const own = { floor: 'stone', steps: [{ name: 'F', look: 'none', walks: 'stone', effect: 'fungus-violet' }], step: 0, stepsFloor: 'stone', caveSize: 1.5 };
  const menu = caveMenu(own, 'stone');
  assert.equal(menu.tones, null); assert.equal(menu.size, 1.5);
  assert.equal(caveLook(stepFlags(own)).scale, 1.5);
});

test('changing kind carries a region between a floor and none', () => {
  const lava = caveKindFlags({ cavern: 'fungus-green' }, 'lava');
  assert.equal(lava.floor, 'lava'); assert.equal(lava.cavern, '');
  const back = caveKindFlags({ floor: 'lava', steps: defaultSteps('lava'), step: 0 }, 'fungus');
  assert.equal(back.floor, ''); assert.equal(back.cavern, 'fungus-green'); assert.equal(back.steps, null);
  assert.equal(stepFlags({ ...back }).cavern, 'fungus-green', 'no lava step left to override it');
  assert.equal(caveKindFlags({ cavern: 'fungus-green' }, 'mist').cavern, 'mist');
  assert.equal('floor' in caveKindFlags({ floor: 'stone', cavern: 'mist' }, 'crystals'), false, 'a floor of its own stays');
});

test('the floor list says Cavern, for a region only', async () => {
  const { FLOOR_CHOICES } = await import('../../../scripts/engines/motion/movement-feel.mjs');
  assert.match(FLOOR_CHOICES.find(([v]) => v === 'lava')[1], /^Cavern/);
  assert.ok(!FLOOR_CHOICES.some(([, l]) => l === 'Lava'));
  const main = readFileSync(new URL('../../../scripts/main.mjs', import.meta.url), 'utf8');
  assert.match(main, /FLOOR_CHOICES\.filter\(\(\[v\]\) => cavern \|\| v !== "lava" \|\| value === "lava"\)/);
});

test('a room fades the weather in at its edge, half a square unless told', async () => {
  const { indoorEdgeOf, INDOOR_EDGE } = await import('../../../scripts/engines/motion/region-steps.mjs');
  assert.equal(indoorEdgeOf({}), 0.5); assert.equal(indoorEdgeOf({ indoorEdge: 0 }), 0, 'a hard line'); assert.equal(indoorEdgeOf({ indoorEdge: 9 }), INDOOR_EDGE.max);
  const main = readFileSync(new URL('../../../scripts/main.mjs', import.meta.url), 'utf8');
  assert.match(main, /area\.soft = soft; areas\.push\(area\)/);
  assert.match(main, /indoorSoft: skyIndoors\.map\(\(p\) => p\.soft \?\? 0\)/);
  assert.match(main, /areas: \{ body: unroofed, bodySoft, rooms, roomSoft,/);
});

test('the sun\'s layers fade in at a room\'s edge as the weather does', async () => {
  const { eraseRooms } = await import('../../../scripts/engines/motion/wall-shadows.mjs');
  class Graphics { constructor() { this.drawn = 0; } beginFill() { return this; } drawPolygon() { this.drawn++; return this; } endFill() { return this; } beginHole() {} endHole() {} }
  class BlurFilter { constructor(r) { this.r = r; } }
  const PIXI = { Graphics, BlurFilter, BLEND_MODES: { ERASE: 'erase' } }, soft = Object.assign([0, 0, 10, 0, 10, 10], { soft: 1 }), hard = Object.assign([0, 0, 5, 0, 5, 5], { soft: 0 });
  const out = eraseRooms(PIXI, [soft, hard], (p) => p, 50);
  assert.equal(out.length, 2, 'the hard ones together, each soft one its own');
  assert.equal(out[0].blendMode, 'erase'); assert.equal(out[0].drawn, 1);
  assert.equal(out[1].filters[0].r, 25); assert.equal(out[1].filters[0].blendMode, 'erase');
  const main = readFileSync(new URL('../../../scripts/main.mjs', import.meta.url), 'utf8');
  assert.match(main, /const rooms = eraseRooms\(PIXI, indoorPolygons\(\), at, canvas\.grid\.size \* k\)/);
  assert.match(main, /indoors: indoorPolygons\(\), open: [^,]+, grid: canvas\.grid\.size, tops: wallShadowTops\(\), wallTop: /);
});

test('a hole in a roof lets the sun in, and fades at its edge too', async () => {
  const { openRooms } = await import('../../../scripts/engines/motion/wall-shadows.mjs');
  const { cloudAreas } = await import('../../../scripts/engines/motion/drawn-clouds.mjs');
  class Graphics { beginFill() { return this; } drawPolygon() { return this; } endFill() { return this; } }
  class BlurFilter { constructor(r) { this.r = r; } }
  const out = openRooms({ Graphics, BlurFilter }, [Object.assign([0, 0, 400, 0, 400, 400, 0, 400], { soft: 0.5 })], (p) => p, 100);
  assert.equal(out.length, 2); assert.equal(out[1].filters[0].r, 25); assert.equal(out[1].blendMode, undefined, 'it adds light back, never erases');
  const box = { x: 0, y: 0, width: 100, height: 100 };
  assert.deepEqual(cloudAreas(box, { rooms: [[0, 0, 9, 0, 9, 9]], open: [[1, 1, 2, 1, 2, 2]], openSoft: [0.5] }).shadow.openSoft, [0.5], 'a cloud\'s shadow fades in through it');
  const main = readFileSync(new URL('../../../scripts/main.mjs', import.meta.url), 'utf8');
  assert.match(main, /open: undergroundScene\(\) \? \[\] : landedOpenings\(\), grid: canvas\.grid\.size/, 'the sunlit floor where the light lands');
  assert.match(main, /openRooms\(PIXI, landedOpenings\(\), at, canvas\.grid\.size \* k\)/);
  assert.match(main, /openSoft: \(skyOpenAreas \?\? \[\]\)\.map\(\(p\) => p\.soft \?\? 0\)/);
});

test('the light through a roof hole lies under the roof, never on it', () => {
  const main = readFileSync(new URL('../../../scripts/main.mjs', import.meta.url), 'utf8'), cave = readFileSync(new URL('../../../scripts/engines/motion/cavern.mjs', import.meta.url), 'utf8');
  assert.match(main, /out\.push\(\{ kind: "sky", areas, under: !deep, window: skyWindowOf\(region\.flags\[ID\]\), pattern: patternScaleOf\(region\.flags\[ID\]\.skyPattern\), room: openingRoom\(areas\) \}\)/);
  assert.match(cave, /item\.under \? floor : glow, PIXI\.BLEND_MODES\.ADD/);
  assert.match(main, /skyOpenings = sky\.flatMap\(\(p\) => p\.areas \?\? p\)/);
});

test('a small hole stays fully open in its middle, however soft its edge', async () => {
  const { openingFade } = await import('../../../scripts/engines/motion/wall-shadows.mjs');
  const hole = [0, 0, 400, 0, 400, 400, 0, 400];
  assert.equal(openingFade(hole, 240), 100, 'a quarter of its side at most');
  assert.equal(openingFade(hole, 50), 50, 'less when asked');
  assert.equal(openingFade([0, 0, 1000, 0, 1000, 200, 0, 200], 999), 50, 'by its narrower side');
});

test('the light through an opening is the sun\'s own colour', () => {
  const main = readFileSync(new URL('../../../scripts/main.mjs', import.meta.url), 'utf8');
  assert.match(main, /const sunlightColor = \(\) => sunColorOf\(sunNow\);/);
  assert.match(main, /color = sunColorOf\(sun\);/);
});

test('main hands the looks on, opens the popup, and an old lava region is a lava floor', () => {
  const main = readFileSync(new URL('../../../scripts/main.mjs', import.meta.url), 'utf8');
  assert.match(main, /const look = caveLook\(stepFlags\(region\.flags\?\.\[ID\]\)\)/);
  // A region with only a cave's growth opens its panel as a cavern (shownFloorOf: region-panel-model.mjs).
  assert.match(main, /const panelFloorOf = \(region\) => shownFloorOf\(stepFlags\(region\.flags\?\.\[ID\]\) \?\? \{\}, plainFloorOf\(region\)\);/);
  assert.match(main, /own\.cavern === "lava" \? "lava"/);
  assert.ok(stepMenu({ floor: 'lava' }, 'lava').steps.length === 3);
});
