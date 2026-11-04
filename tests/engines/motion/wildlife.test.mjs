import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { rabbitStep, songStep, crowFlock, fishStep, preyFor, preyCaught, WILD_SOUNDS, WILD_GAPS, wildSound } from '../../../scripts/engines/motion/wildlife.mjs';
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
  assert.equal(wildSound('fishSplash'), WILD_SOUNDS.fishSplash[0]);
  assert.equal(wildSound('nothing'), null);
  let t = 0; const v = critterVoices({ gaps: WILD_GAPS, now: () => t, random: () => 0 });
  assert.equal(v.wanted('crowCaw'), true); assert.equal(v.wanted('crowCaw'), false);
  t = 2.6; assert.equal(v.wanted('crowCaw'), true);
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

test('a hawk stoops on a rabbit it can see, not one already running, and catches about half under its talons', () => {
  const near = { x: 100, y: 0, mode: 'sit' }, far = { x: 900, y: 0, mode: 'sit' }, running = { x: 10, y: 0, mode: 'bolt' };
  assert.equal(preyFor({ x: 0, y: 0 }, [far, running, near]), near);
  assert.equal(preyFor({ x: 0, y: 0 }, [far, near], { seen: (x) => x > 500 }), far, 'out of sight is no use');
  assert.equal(preyFor({ x: 0, y: 0 }, [running]), null);
  assert.equal(preyFor({ x: 0, y: 0 }, []), null);
  assert.equal(preyCaught({ x: 0, y: 0 }, { x: 10, y: 0 }, { grid: 100, luck: 0.2 }), true);
  assert.equal(preyCaught({ x: 0, y: 0 }, { x: 10, y: 0 }, { grid: 100, luck: 0.9 }), false, 'it got away');
  assert.equal(preyCaught({ x: 0, y: 0 }, { x: 200, y: 0 }, { grid: 100, luck: 0.1 }), false, 'too far off');
});
