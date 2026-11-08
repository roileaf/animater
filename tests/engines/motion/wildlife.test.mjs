import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { rabbitStep, songStep, crowFlock, fishStep, preyFor, preyCaught, thumpsNow, noiseReaching, NOISE_SPEED, overOpen, WILD_SOUNDS, WILD_GAPS, wildSound, closedGround, resettled } from '../../../scripts/engines/motion/wildlife.mjs';
import { foxStep } from '../../../scripts/engines/motion/field-life.mjs';
import { critterVoices } from '../../../scripts/engines/motion/underground-sounds.mjs';

const seq = (values) => { let i = 0; return () => values[i++ % values.length]; };
const rabbit = (over = {}) => ({ x: 0, y: 0, a: 0, wait: 0, mode: 'sit', hop: 0, ...over });
const song = (over = {}) => ({ x: 0, y: 0, a: 0, wait: 5, peck: 0, mode: 'ground', vx: 0, vy: 0, h: 0, ...over });

test('a rabbit bolts away from anyone close, and only then', () => {
  const near = [{ x: 0, y: 100 }];
  const r = rabbitStep(rabbit(), { grid: 100, near, random: () => 0.5 });
  assert.equal(r.mode, 'bolt');
  let run = r; for (let i = 0; i < 60; i++) run = rabbitStep(run, { dt: 1 / 60, grid: 100, near, random: () => 0.5 });
  assert.ok(run.y < -50, `ran away from it: ${run.y}`);
  assert.notEqual(rabbitStep(rabbit({ wait: 5 }), { grid: 100, near: [{ x: 0, y: 900 }] }).mode, 'bolt');
  assert.equal(rabbitStep(rabbit({ wait: 5 }), { grid: 100, scare: true, random: () => 0.5 }).mode, 'bolt');
});

test('a rabbit keeps to open ground and never goes through a wall', () => {
  // The ground ends and a wall stands at y = -50.
  const ok = (x, y) => y > -50, blocked = (a, b) => (a.y + 50) * (b.y + 50) < 0;
  let wander = rabbit({ mode: 'hop', hops: 99 }), r = Math.random;
  for (let i = 0; i < 2000; i++) { wander = rabbitStep(wander, { dt: 1 / 60, grid: 100, ok, blocked, random: r }); assert.ok(wander.y > -50, `at ${wander.y}`); }
  let fleeing = rabbit({ mode: 'bolt', bolts: 99, a: 0 });
  for (let i = 0; i < 2000; i++) { fleeing = rabbitStep(fleeing, { dt: 1 / 60, grid: 100, ok: () => true, blocked, near: [], random: r }); assert.ok(fleeing.y > -50, `at ${fleeing.y}`); }
});

test('a rabbit stays out of the water, even running for its life, and hops off ground it finds itself on', () => {
  // The river starts at y = -50; whoever scares it stands on the far side, so it runs straight at the water.
  const ok = (x, y) => y > -50, near = [{ x: 0, y: 150 }];
  let r = rabbit();
  for (let i = 0; i < 3000; i++) { r = rabbitStep(r, { dt: 1 / 60, grid: 100, ok, near, random: Math.random }); assert.ok(r.y > -50, `in the water at ${r.y}`); }
  let wet = rabbit({ y: -200, wait: 0 });
  for (let i = 0; i < 20000 && !ok(wet.x, wet.y); i++) wet = rabbitStep(wet, { dt: 1 / 60, grid: 100, ok, random: Math.random });
  assert.ok(ok(wet.x, wet.y), 'climbed out');
  const stuck = rabbitStep(rabbit({ wait: 0 }), { grid: 100, ok: () => false, random: () => 0.9 });
  assert.equal(stuck.mode, 'hop', 'does not sit there');
});

test('a songbird on the wrong ground takes off, and a fish in no water at all can still swim', () => {
  assert.equal(songStep(song({ wait: 0 }), { dt: 0.1, grid: 100, ok: () => false, random: () => 0.5 }).mode, 'up');
  const moved = fishStep({ x: 0, y: 0, a: 0, wait: 5, turn: 0, dart: 0 }, { dt: 0.5, grid: 100, ok: () => false, random: () => 0.5 });
  assert.notEqual(moved.y, 0);
});

test('every wildlife sound is there, credited, and has its wait', () => {
  for (const [kind, files] of Object.entries(WILD_SOUNDS)) {
    assert.ok(WILD_GAPS[kind], kind);
    for (const f of files) {
      const here = new URL(`../../../${f.replace('modules/animater/', '')}`, import.meta.url);
      assert.ok(fs.existsSync(here), f);
      assert.ok(fs.readFileSync(new URL('License.txt', here), 'utf8').includes(f.split('/').at(-1)), `${f} credited`);
    }
  }
});

test('a wildlife sound is never the same file twice running, and a flock is heard no more often than its wait', () => {
  let was = null; for (let i = 0; i < 50; i++) { const f = wildSound('hawkCry'); assert.notEqual(f, was); was = f; }
  assert.ok(WILD_SOUNDS.fishSplash.includes(wildSound('fishSplash')));
  assert.equal(wildSound('nothing'), null);
  let t = 0; const v = critterVoices({ gaps: WILD_GAPS, now: () => t, random: () => 0 });
  assert.equal(v.wanted('crowCaw'), true); assert.equal(v.wanted('crowCaw'), false);
  t = 2.6; assert.equal(v.wanted('crowCaw'), true);
});

test('a rabbit thumps when first startled, not on every run while chased', () => {
  assert.equal(thumpsNow(Infinity), true);
  assert.equal(thumpsNow(20), true);
  assert.equal(thumpsNow(2), false);
});

test('a noise reaches each place in turn, once, as far as it carries', () => {
  const at = (t) => [{ x: 0, y: 0, r: 2000, t }];
  assert.equal(noiseReaching(at(0.1), 1000, 0, { grid: 100 }), null, 'not there yet');
  const when = 1000 / (NOISE_SPEED * 100) + 0.01;
  assert.ok(noiseReaching(at(when), 1000, 0, { grid: 100 }), 'there now');
  assert.equal(noiseReaching(at(when + 1), 1000, 0, { grid: 100 }), null, 'gone past');
  assert.equal(noiseReaching([{ x: 0, y: 0, r: 500, t: when }], 1000, 0, { grid: 100 }), null, 'too far off to hear');
});

test('a noise sends them all off, away from it', () => {
  const noise = { x: 0, y: 500 };
  const r = rabbitStep(rabbit({ wait: 5 }), { grid: 100, noise, random: () => 0.5 });
  assert.equal(r.mode, 'bolt'); assert.ok(Math.abs(r.a) < 0.1, 'up the map, away');
  const s = songStep(song(), { grid: 100, noise, random: () => 0.5 });
  assert.equal(s.mode, 'up'); assert.ok(s.vy < 0);
  assert.ok(fishStep({ x: 0, y: 0, a: 2, wait: 5, turn: 0, dart: 0 }, { grid: 100, noise, random: () => 0.5 }).dart > 0);
});

test('a fish left on dry ground makes for the water', () => {
  const pool = (x, y) => y < -100; let f = { x: 0, y: 0, a: 3, wait: 0, turn: 0, dart: 0 };
  for (let i = 0; i < 400 && !pool(f.x, f.y); i++) f = fishStep(f, { dt: 1 / 60, grid: 100, ok: pool });
  assert.ok(pool(f.x, f.y), `at ${f.x}, ${f.y}`);
});

test('a songbird in flight turns back at a wall and from a closed place, and can leave one it is in', () => {
  const blocked = (a, b) => (a.x - 303.3) * (b.x - 303.3) < 0;
  let s = { ...song(), mode: 'up', vx: 400, vy: 0, t: 0, flight: 30, tries: 0 };
  for (let i = 0; i < 1200; i++) { s = songStep(s, { dt: 1 / 60, grid: 100, blocked, random: Math.random }); assert.ok(s.x < 303.3, `through the wall at ${s.x}`); }
  const barred = (x) => x > 300; let b = { ...song(), mode: 'up', vx: 400, vy: 0, t: 0, flight: 30, tries: 0 };
  for (let i = 0; i < 1200; i++) { b = songStep(b, { dt: 1 / 60, grid: 100, barred, random: Math.random }); assert.ok(b.x <= 300, `in the closed place at ${b.x}`); }
  const out = songStep({ ...song({ x: 500 }), mode: 'up', vx: -400, vy: 0, t: 0, flight: 30, tries: 0 }, { dt: 1 / 60, grid: 100, barred, random: () => 0.5 });
  assert.ok(out.x < 500, 'leaving is allowed');
});

test('a high flier fades out over a closed place and back, never popping', () => {
  let open = overOpen(undefined, false, 1 / 60); assert.equal(open, 1);
  open = overOpen(open, true, 1 / 60); assert.ok(open > 0.8 && open < 1, 'easing out');
  for (let i = 0; i < 30; i++) open = overOpen(open, true, 1 / 60);
  assert.equal(open, 0);
  open = overOpen(open, false, 1 / 60); assert.ok(open > 0 && open < 0.2, 'easing back');
});

test('songbirds peck, take to the air from anyone close, and land somewhere they can stand', () => {
  const up = songStep(song(), { grid: 100, near: [{ x: 50, y: 0 }], random: () => 0.5 });
  assert.equal(up.mode, 'up');
  assert.ok(up.vx < 0, 'away from it');
  let s = up; for (let i = 0; i < 300 && s.mode !== 'ground'; i++) s = songStep(s, { dt: 1 / 60, grid: 100, random: () => 0.5 });
  assert.equal(s.mode, 'ground');
  assert.equal(s.h, 0);
  assert.ok(!s.gone);
  // Only water below: it flies on a while, and at last is gone rather than standing on it.
  let w = up; for (let i = 0; i < 2000 && w.mode !== 'ground'; i++) w = songStep(w, { dt: 1 / 60, grid: 100, ok: () => false, random: () => 0.5 });
  assert.equal(w.gone, true);
  const still = songStep(song({ wait: 0 }), { dt: 0.1, grid: 100, random: seq([0.1, 0.5]) });
  assert.ok(still.peck > 0, 'a peck');
});

test('crows come in from beyond the map and head across it', () => {
  const area = { x: 0, y: 0, width: 1000, height: 800 }, flock = crowFlock(area, 0, { grid: 100, count: 6, random: () => 0.5 });
  assert.equal(flock.length, 6);
  for (const c of flock) { assert.ok(c.x < 0, 'starts off the map'); assert.ok(c.vx > 0 && Math.abs(c.vy) < 1e-9, 'flying across'); }
  assert.ok(new Set(flock.map((c) => Math.round(c.y))).size > 3, 'a loose spread');
});

test('a fish stays in the water, drifting, and darts from anyone close', () => {
  const inPond = (x, y) => Math.hypot(x, y) < 200; let f = { x: 0, y: 0, a: 0, wait: 0, turn: 0, dart: 0 };
  for (let i = 0; i < 4000; i++) { f = fishStep(f, { dt: 1 / 60, grid: 100, ok: inPond }); assert.ok(inPond(f.x, f.y), `at ${f.x}, ${f.y}`); }
  const scared = fishStep({ x: 0, y: 0, a: 0, wait: 5, turn: 0, dart: 0 }, { grid: 100, near: [{ x: 0, y: 100 }], random: () => 0.5 });
  assert.ok(scared.dart > 0, 'dashes');
  assert.ok(Math.abs(scared.a) < 0.1, 'away, up the map');
});

test('a hawk stoops on a rabbit it can see, not one already running, and catches most under its talons', () => {
  const near = { x: 100, y: 0, mode: 'sit' }, far = { x: 900, y: 0, mode: 'sit' }, running = { x: 10, y: 0, mode: 'bolt' };
  assert.equal(preyFor({ x: 0, y: 0 }, [far, running, near]), near);
  assert.equal(preyFor({ x: 0, y: 0 }, [far, near], { seen: (x) => x > 500 }), far, 'out of sight is no use');
  assert.equal(preyFor({ x: 0, y: 0 }, [running]), null);
  assert.equal(preyFor({ x: 0, y: 0 }, []), null);
  assert.equal(preyCaught({ x: 0, y: 0 }, { x: 10, y: 0 }, { grid: 100, luck: 0.7 }), true);
  assert.equal(preyCaught({ x: 0, y: 0 }, { x: 10, y: 0 }, { grid: 100, luck: 0.9 }), false, 'it got away');
  assert.equal(preyCaught({ x: 0, y: 0 }, { x: 200, y: 0 }, { grid: 100, luck: 0.1 }), false, 'too far off');
});

// A map of 2000px at 50px squares, as the scene is read: a ring of seven walls round a tree, with no way out.
const groundWith = (walls) => {
  const cols = 40, rows = 40, cell = 50, ground = closedGround({ cols, rows, cell, area: { x: 0, y: 0 }, walls, roofed: new Uint8Array(cols * rows) }), shut = new Set(ground.cells);
  return { ...ground, closed: (x, y) => { const c = ground.cellAt(x, y); return c < 0 || shut.has(c); } };
};
const ringOf = (cx, cy, r, sides = 7) => Array.from({ length: sides }, (_, k) => { const a = (k / sides) * Math.PI * 2 + 0.4, b = ((k + 1) / sides) * Math.PI * 2 + 0.4; return { x1: cx + Math.cos(a) * r, y1: cy + Math.sin(a) * r, x2: cx + Math.cos(b) * r, y2: cy + Math.sin(b) * r }; });
const inRing = (ring, x, y) => { let c = false; for (const w of ring) if ((w.y1 > y) !== (w.y2 > y) && x < w.x1 + ((y - w.y1) / (w.y2 - w.y1)) * (w.x2 - w.x1)) c = !c; return c; };
const rings = Array.from({ length: 40 }, (_, n) => ringOf(700 + n * 13.7, 800 + n * 9.1, 190 + n * 2));

test('no point inside a sealed ring reads as open ground, whichever side of it its square lies', () => {
  for (const ring of rings) {
    const { closed } = groundWith(ring);
    // Every 100px square's middle (where creatures are placed), and a finer sweep besides.
    for (let y = 450; y < 1500; y += 25) for (let x = 450; x < 1500; x += 25) assert.equal(closed(x, y), inRing(ring, x, y), `${x}, ${y} against ${JSON.stringify(ring[0])}`);
  }
});

test('a pocket too small to hold the middle of any square is still closed', () => {
  const { closed } = groundWith(ringOf(510, 510, 12));
  assert.equal(closed(510, 510), true);
  assert.equal(closed(560, 560), false);
});

test('ground with no walls has nothing closed', () => {
  const { cells, closed, cellAt } = groundWith([]);
  assert.deepEqual(cells, []);
  assert.equal(closed(510, 510), false);
  assert.equal(cellAt(510, 510), 10 * 40 + 10);
});

test('a wall drawn round a creature sends it to open ground, and leaves the rest where they are', () => {
  const { closed } = groundWith(ringOf(1000, 1000, 200)), view = {};
  const inside = { x: 1000, y: 1000, mode: 'sit', view }, outside = { x: 300, y: 300, mode: 'sit', view };
  const [moved, stayed] = resettled([inside, outside], { spots: [{ x: 500, y: 500 }], closed });
  assert.deepEqual([moved.x, moved.y], [500, 500]);
  assert.equal(moved.view, view, 'the same picture, moved');
  assert.equal(stayed, outside, 'untouched');
  assert.equal(closed(moved.x, moved.y), false);
  // Nowhere to send it: it stays and makes do.
  const [left] = resettled([inside], { spots: [], closed });
  assert.equal(left, inside);
});

test('a fox placed anywhere reckoned open is never walled into a pocket', () => {
  for (const ring of rings.filter((_, n) => n % 8 === 0)) {
    const { closed } = groundWith(ring), crosses = (a, b, w) => { const s = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x), c = { x: w.x1, y: w.y1 }, d = { x: w.x2, y: w.y2 }; return s(a, b, c) * s(a, b, d) <= 0 && s(c, d, a) * s(c, d, b) <= 0; };
    const ok = (x, y) => x >= 0 && y >= 0 && x < 2000 && y < 2000 && !closed(x, y), blocked = (a, b) => ring.some((w) => crosses(a, b, w));
    for (let j = 0; j < 20; j++) for (let i = 0; i < 20; i++) {
      const p = { x: (i + 0.5) * 100, y: (j + 0.5) * 100 };
      if (closed(p.x, p.y)) continue;
      assert.equal(inRing(ring, p.x, p.y), false, `placed inside the ring at ${p.x}, ${p.y}`);
      if (Math.hypot(p.x - 800, p.y - 850) > 500) continue;
      let f = { ...p, a: 1, want: 1, mode: 'trot', t: 0, wait: 1e9, v: 0, gait: 0, way: 0, h: 0 }, far = 0;
      for (let t = 0; t < 1200; t++) { f = foxStep(f, { dt: 1 / 60, grid: 100, ok, blocked, time: t / 60 }); far = Math.max(far, Math.hypot(f.x - p.x, f.y - p.y)); }
      assert.ok(far > 100, `stuck near ${p.x}, ${p.y}: got ${far.toFixed(1)}px`);
    }
  }
});

test('a rabbit on ground gone bad bolts for the nearest good ground, and keeps going till it is off', async () => {
  const { rabbitRunsOff, rabbitStep, nearestSpot } = await import('../../../scripts/engines/motion/wildlife.mjs');
  const spots = [{ x: 900, y: 0 }, { x: 0, y: -400 }], ok = (x, y) => y < -300, grid = 100;
  assert.deepEqual(nearestSpot(0, 0, spots), spots[1]);
  assert.equal(nearestSpot(0, 0, []), null);
  let r = rabbitRunsOff({ x: 0, y: 0, a: 2, mode: 'sit', wait: 3, hop: 0 }, { spots, grid });
  assert.equal(r.mode, 'bolt');
  assert.ok(Math.abs(r.a) < 1e-9, 'facing up the map, toward the nearer');
  assert.ok(r.bolts * grid * 1.09 >= 400, 'enough bounds to get there');
  assert.equal(rabbitRunsOff({ x: 0, y: 0, mode: 'sit' }, { spots: [], grid }).mode, 'sit', 'nowhere to run to');
  for (let i = 0; i < 1800 && !(r.mode === 'sit' && ok(r.x, r.y)); i++) r = rabbitStep(r, { dt: 1 / 60, grid, ok, random: () => 0.5 });
  assert.ok(ok(r.x, r.y), `got off: ${Math.round(r.y)}`);
  assert.equal(r.mode, 'sit', 'and settles there');
});

test('bad weather coming on: they bolt once, stay in sight while they run, then go in', async () => {
  const { takeCover } = await import('../../../scripts/engines/motion/wildlife.mjs');
  let cover = takeCover(null, 1, 0.1);
  assert.deepEqual([cover.out, cover.flush], [1, false]);
  cover = takeCover(cover, 0.5, 0.1);
  assert.deepEqual([cover.out, cover.flush], [1, true]);
  cover = takeCover(cover, 0.2, 2);
  assert.deepEqual([cover.out, cover.flush], [1, false]);
  cover = takeCover(cover, 0.2, 2);
  assert.deepEqual([cover.out, cover.flush], [0.2, false]);
  cover = takeCover(cover, 1, 0.1);
  assert.deepEqual([cover.out, cover.left], [1, false]);
  assert.equal(takeCover(cover, 0.4, 0.1).flush, true, 'and again next time');
});

test('weather already there as a scene starts sends no one running', async () => {
  const { takeCover } = await import('../../../scripts/engines/motion/wildlife.mjs');
  const cover = takeCover(null, 0, 0.1);
  assert.deepEqual([cover.out, cover.flush], [0, false]);
  assert.equal(takeCover(cover, 0, 0.1).flush, false);
});

test('crossesWall tells whether a line crosses any of the walls', async () => {
  const { crossesWall } = await import('../../../scripts/engines/motion/wildlife.mjs');
  const wall = { x1: 50, y1: 0, x2: 50, y2: 100 };
  assert.equal(crossesWall({ x: 0, y: 50 }, { x: 100, y: 50 }, [wall]), true);
  assert.equal(crossesWall({ x: 0, y: 50 }, { x: 40, y: 50 }, [wall]), false, 'stops short');
  assert.equal(crossesWall({ x: 0, y: 150 }, { x: 100, y: 150 }, [wall]), false, 'goes past its end');
  assert.equal(crossesWall({ x: 0, y: 50 }, { x: 100, y: 50 }, []), false, 'none left to cross');
  assert.equal(crossesWall({ x: 0, y: 50 }, { x: 100, y: 50 }, [{ x1: 0, y1: 0, x2: 100, y2: 0 }]), false, 'running alongside');
});

test('a fish has left the map only once clear of its edge', async () => {
  const { fishOffMap } = await import('../../../scripts/engines/motion/wildlife.mjs');
  const area = { x: 100, y: 100, width: 500, height: 500 };
  assert.equal(fishOffMap({ x: 300, y: 300 }, area, 100), false);
  assert.equal(fishOffMap({ x: 70, y: 300 }, area, 100), false, 'still crossing the edge');
  assert.equal(fishOffMap({ x: 40, y: 300 }, area, 100), true);
  assert.equal(fishOffMap({ x: 300, y: 660 }, area, 100), true);
});

test('a keep-out box of its own decides, then the old group, and All animals holds everything', async () => {
  const { keepsOut, crossesKept } = await import('../../../scripts/engines/motion/wildlife.mjs');
  assert.equal(keepsOut({ ducks: true }, 'ducks'), true);
  assert.equal(keepsOut({ ducks: true }, 'herons'), false);
  assert.equal(keepsOut({ waterBirds: true }, 'gulls'), true, 'a region set before the split');
  assert.equal(keepsOut({ waterBirds: true, gulls: false }, 'gulls'), false, 'unticked since');
  assert.equal(keepsOut({ town: true }, 'cats'), true);
  assert.equal(keepsOut({ insects: true }, 'fireflies'), true);
  assert.equal(keepsOut({ waterBirds: true }, 'rabbits'), false);
  assert.equal(keepsOut({ all: true }, 'owl'), true);
  assert.equal(keepsOut(undefined, 'owl'), false);
  const kept = (kind, x) => kind === 'crows' && x > 40 && x < 60, line = (u) => ({ x: u * 100, y: 0 });
  assert.equal(crossesKept(line, 'crows', kept), true);
  assert.equal(crossesKept(line, 'owl', kept), false, 'another kind');
});

test('a songbird on the ground hops over a moment, a little way each frame, never set down far off at once', async () => {
  const { songStep } = await import('../../../scripts/engines/motion/wildlife.mjs');
  let rolls = [0.99, 0.5, 0.5, 0.99];   // not a peck, a turn, a hop, no run after it
  const random = () => (rolls.length ? rolls.shift() : 0.5);
  let s = { x: 0, y: 0, a: 0, mode: 'ground', wait: 0, peck: 0 };
  s = songStep(s, { dt: 1 / 60, grid: 100, random });
  assert.ok(s.hop, 'a hop begins');
  assert.equal(s.x, 0); assert.equal(s.y, 0);
  const land = { x: s.hop.tx, y: s.hop.ty }; let biggest = 0, prev = { x: s.x, y: s.y };
  for (let i = 0; i < 30 && s.hop; i++) { s = songStep(s, { dt: 1 / 60, grid: 100, random }); biggest = Math.max(biggest, Math.hypot(s.x - prev.x, s.y - prev.y)); prev = { x: s.x, y: s.y }; }
  assert.ok(!s.hop, 'it lands');
  assert.ok(Math.hypot(s.x - land.x, s.y - land.y) < 1e-6, 'where the hop was aimed');
  assert.ok(biggest < Math.hypot(land.x, land.y) / 3, 'carried over several frames');
});
