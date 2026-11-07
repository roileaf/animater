import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DUSK_DIM, duskOf, shaftAt, shaftOf, sunsetTint, wallAlong, windowFade, windowGlowBand, windowShafts } from '../../../scripts/engines/motion/wall-shadows.mjs';

// A room 3 squares wide, its west wall with a glass window, its east wall solid.
const glass = { c: [0, 200, 0, 400], light: 0, move: 20 }, east = { c: [300, 0, 300, 1000], light: 20, move: 20 };

test('a window\'s frame shows in its light; a doorway\'s does not', () => {
  const sun = { angle: 180, height: 30, strength: 1 };
  const [s] = windowShafts({ walls: [glass], sun, grid: 100 });
  assert.equal(s.panes, 'cross');
  const door = windowShafts({ walls: [{ c: [0, 200, 0, 400], door: 1, ds: 1, light: 20 }], sun, grid: 100 })[0];
  assert.equal(door.panes, false);
  const shutters = windowShafts({ walls: [{ c: [0, 200, 0, 400], light: 20, move: 20, kind: 'shutterWindow', slats: true }], sun, grid: 100 })[0];
  assert.equal(shutters.panes, 'bar', 'shutters: the bar where they meet, over their slats\' bands'); assert.ok(shutters.slats > 0);
  for (const kind of ['shutterWindow', 'glassWindow', 'woodWindow']) assert.equal(windowShafts({ walls: [{ c: [0, 200, 0, 400], light: 20, move: 20, kind, open: true }], sun, grid: 100 })[0].panes, false, `${kind} thrown open: the light whole`);
  assert.equal(windowShafts({ walls: [{ c: [0, 200, 0, 400], light: 20, move: 20, kind: 'glassWindow' }], sun, grid: 100 })[0].panes, 'cross', 'shut glass: its cross');
  assert.equal(windowShafts({ walls: [{ c: [0, 200, 0, 400], light: 20, move: 20, kind: 'curtainWindow' }], sun, grid: 100 })[0].panes, false, 'a curtain\'s cloth');
});

test('the light stops at the far wall, and what would have gone on lights that wall', () => {
  const far = windowShafts({ walls: [glass, east], sun: { angle: 180, height: 6, strength: 1 }, grid: 100 })[0];
  assert.ok(far.points[4] <= 300 + 1e-6 && far.points[6] <= 300 + 1e-6, 'never through it');
  assert.ok(far.wall && far.wall.share > 0.3, 'a low sun throws most of it on the wall');
  const near = windowShafts({ walls: [glass, east], sun: { angle: 180, height: 60, strength: 1 }, grid: 100 })[0];
  assert.equal(near.wall, null, 'a high sun lands short of it');
  assert.equal(wallAlong({ x: 0, y: 300 }, { x: 1, y: 0 }, [glass, east], { skip: glass }), 300);
  assert.equal(wallAlong({ x: 0, y: 300 }, { x: 1, y: 0 }, [glass, { c: [500, 0, 500, 1000], light: 0, move: 20 }], { skip: glass, most: 900 }), 900, 'glass lets it on');
});

test('the room dims and the light turns pink as the sun goes down, never by moonlight', () => {
  assert.equal(duskOf({ height: 60 }), 0);
  assert.ok(duskOf({ height: 20 }) > 0.3 && duskOf({ height: 20 }) < 0.8);
  assert.equal(duskOf({ height: 4 }), 1);
  assert.equal(duskOf({ height: 4, moon: true }), 0);
  assert.ok(DUSK_DIM >= 0.4 && DUSK_DIM <= 0.5);
  assert.deepEqual(sunsetTint([1, 0.8, 0.6], { height: 40 }), [1, 0.8, 0.6]);
  const pink = sunsetTint([1, 0.8, 0.6], { height: 3 });
  assert.ok(pink[2] < 0.6 && pink[1] < 0.8);
  assert.deepEqual(sunsetTint([0.7, 0.8, 1], { height: 3, moon: true }), [0.7, 0.8, 1]);
});

test('a creature standing in a window\'s light gets the sun, fading toward the far end; outside it none', () => {
  const shafts = windowShafts({ walls: [glass], sun: { angle: 180, height: 20, strength: 1 }, grid: 100 });
  const near = shaftAt({ x: 20, y: 300 }, shafts), far = shaftAt({ x: 300, y: 300 }, shafts);
  assert.ok(near > 0.6, `near the window ${near}`); assert.ok(far > 0 && far < near, 'fainter further in');
  assert.equal(shaftAt({ x: 20, y: 900 }, shafts), 0, 'beside the patch, none');
  const banded = shaftAt({ x: 20, y: 300 }, [{ ...shafts[0], slats: 5 }]); assert.ok(Math.abs(banded - near / 2) < 1e-9, 'through slats, half');
  assert.deepEqual(shaftOf({ x: 20, y: 300 }, shafts).points, shafts[0].points, 'its patch, for the shadow to keep to');
  assert.equal(shaftOf({ x: 20, y: 900 }, shafts).points, null);
  const main = readFileSync(new URL('../../../scripts/main.mjs', import.meta.url), 'utf8'), feel = readFileSync(new URL('../../../scripts/engines/motion/movement-feel.mjs', import.meta.url), 'utf8');
  assert.match(main, /lit > 0\.05 \? \{ \.\.\.sunNow, height: [^}]+, strength: \(Number\(sunNow\.strength\) \|\| 0\) \* lit \}/);
  assert.match(main, /value\.clips = \{ \.\.\.\(value\.clips \?\? \{\}\), sun: shaft\.points \}; value\.window = true;/);
  assert.match(feel, /sun: sunlit && lit\.window !== true/);
  assert.match(main, /shaftsNow = sunNow\.moon \? \[\] : shafts;/);
});

test('the patch is brightest by the window and fades along it; frame lines thin out and fade too; a shadow peeks out', () => {
  assert.equal(windowFade(0), 1); assert.ok(windowFade(0.5) < 0.6 && windowFade(0.5) > 0.4); assert.ok(Math.abs(windowFade(1) - 0.2) < 1e-9);
  const src = readFileSync(new URL('../../../scripts/engines/motion/wall-shadows.mjs', import.meta.url), 'utf8'), main = readFileSync(new URL('../../../scripts/main.mjs', import.meta.url), 'utf8');
  assert.match(src, /frames\.lineStyle\(Math\.max\(1, width \* w \* \(1 \+ 0\.6 \* v\)\), 0xffffff, 0\.95 \* \(1 - fades \* v\)\)/);
  assert.match(src, /fades = fine \? 0\.45 : 0\.7/, 'a net fades less than a lone bar, so it stays readable');
  assert.match(src, /new PIXI\.BlurFilter\(SOFTNESS \* 0\.75 \* \(k \/ SHAFT_RESOLUTION\)\)/);
  assert.match(main, /height: Math\.min\(Number\(sunNow\.height\) \|\| 45, WINDOW_SUN_HIGHEST\)/);
});

test('a window\'s glow is a low band along the wall, inside the room, never a round blob', () => {
  const band = windowGlowBand([0, 200, 0, 400], [1, 0], 100), xs = band.filter((_, i) => i % 2 === 0), ys = band.filter((_, i) => i % 2 === 1);
  assert.ok(Math.min(...xs) >= -1e-9, 'only on the room side'); assert.ok(Math.max(...xs) <= 60 + 1e-9, 'a little way in');
  assert.ok(Math.max(...ys) - Math.min(...ys) > 200, 'about the window\'s width across');
  assert.ok(Math.min(...windowGlowBand([0, 200, 0, 400], [-1, 0], 100).filter((_, i) => i % 2 === 0)) < 0, 'the other way when the room is there');
});

test('the far-wall band never cuts across the room when the light meets two walls', async () => {
  const { sameWallLine } = await import('../../../scripts/engines/motion/wall-shadows.mjs');
  // The east wall broken by an open doorway: one edge of the light goes on through it and meets a wall beyond.
  const lower = { c: [300, 300, 300, 1000], light: 20, move: 20 }, door = { c: [300, 200, 300, 300], light: 20, move: 20, door: 1, ds: 1 }, beyond = { c: [700, 0, 700, 1000], light: 20, move: 20 };
  const s = windowShafts({ walls: [glass, lower, door, beyond], sun: { angle: 180, height: 6, strength: 1 }, grid: 100 })[0];
  assert.equal(s.wall, null, 'one edge on each wall: no band');
  assert.ok(s.points[4] <= 300 + 1e-6 && s.points[6] <= 300 + 1e-6, 'and none of it spills past the nearer wall into the next room');
  assert.ok(sameWallLine({ c: [300, 0, 300, 400] }, { c: [300, 400, 300, 900] }), 'a wall in pieces is one wall');
  assert.ok(!sameWallLine({ c: [300, 0, 300, 400] }, { c: [700, 0, 700, 400] }));
});

test('main makes it brighter at dusk, tinted and dimming', () => {
  const main = readFileSync(new URL('../../../scripts/main.mjs', import.meta.url), 'utf8');
  assert.match(main, /const rgb = sunColorOf\(sunNow\)/, 'the sun\'s own colour');
  assert.match(main, /open: undergroundScene\(\) \? \[\] : landedOpenings\(\), grid/, 'the lit floor where the pool lands');
  assert.match(main, /0\.85 \* strength, dusk: duskOf\(sunNow\)/);

});
