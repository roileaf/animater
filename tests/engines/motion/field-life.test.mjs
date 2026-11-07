import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wolfStep, deerStep, foxStep, butterflyStep, dragonflyStep, owlPlace, turnToward, clearWay, batLamps } from '../../../scripts/engines/motion/field-life.mjs';

const deer = (over = {}) => ({ x: 0, y: 0, a: 0, mode: 'graze', wait: 5, t: 0, way: 0, want: 0, v: 0, gait: 0, lift: 0, h: 0, ...over });
const fox = (over = {}) => ({ x: 0, y: 0, a: 0, want: 0, mode: 'trot', t: 0, wait: 5, v: 0, gait: 0, way: 0, h: 0, ...over });

test('bats gather at a lamp out of doors, never at a light someone carries', () => {
  const post = { x: 100, y: 100, carried: false }, torch = { x: 300, y: 100, carried: true }, hearth = { x: 500, y: 100, carried: false };
  const open = (l) => l.x < 400;
  assert.deepEqual(batLamps([post, torch, hearth], open), [post], 'the lamp in the open only: not the torch, not the one indoors');
  assert.deepEqual(batLamps([torch], open), [], 'a torch alone draws none');
  assert.deepEqual(batLamps([post, torch]), [post], 'open everywhere when nothing says otherwise');
});

test('a turn goes the short way and only so far', () => {
  assert.ok(Math.abs(turnToward(0, 1, 0.1) - 0.1) < 1e-9);
  assert.ok(turnToward(3, -3, 0.1) > 3, 'round through pi, not back through zero');
  assert.ok(Math.abs(turnToward(0, 0.05, 0.1) - 0.05) < 1e-9);
});

test('a deer bounds away from anyone near or a noise, and stays clear of walls and water', () => {
  const near = [{ x: 0, y: 200 }];
  const up = deerStep(deer(), { grid: 100, near, random: () => 0.5 });
  assert.equal(up.mode, 'flee');
  assert.equal(deerStep(deer(), { grid: 100, near: [{ x: 0, y: 900 }] }).mode, 'graze');
  assert.equal(deerStep(deer(), { grid: 100, noise: { x: 0, y: 2000 }, random: () => 0.5 }).mode, 'flee');
  // Water beyond y = -300 and a wall beyond x = 300: however long it runs, it stays this side of both.
  const ok = (x, y) => y > -300, blocked = (a, b) => (a.x - 300) * (b.x - 300) < 0;
  let o = up; for (let i = 0; i < 6000; i++) { o = deerStep(o, { dt: 1 / 60, grid: 100, near, ok, blocked }); assert.ok(o.y > -300 && o.x < 300, `at ${o.x}, ${o.y}`); }
});

test('the clearest way is the one nearest what it wanted, either side', () => {
  const dry = (x, y) => y > -100;
  assert.equal(clearWay(0, 0, 0, 100, dry), 0, 'clear already');
  const up = -Math.PI / 2, w = clearWay(0, 0, up, 200, dry);
  assert.ok(Math.sin(w) * 200 > -100 && w !== up, 'round the water');
  assert.equal(clearWay(0, 0, up, 200, () => false), null, 'boxed in');
});

test('a deer driven at a bank runs along it instead of sticking, its nose kept off the water', () => {
  // Water beyond y = -300, someone right behind it, pushing it straight at the bank.
  const ok = (x, y) => y > -300; let o = deer({ y: -180, a: 0, mode: 'flee', way: -Math.PI / 2, t: 0, gait: 0.75 }), start = o.x, furthest = 0, facing = new Set();
  for (let i = 0; i < 220; i++) { o = deerStep(o, { dt: 1 / 60, grid: 100, ok, near: [{ x: o.x, y: o.y + 200 }] }); assert.ok(o.y > -300, `in the water at ${o.y}`); furthest = Math.max(furthest, Math.abs(o.x - start)); assert.ok(o.y - Math.cos(o.a) * 40 > -300, 'its nose over the water'); facing.add(Math.round(o.a * 2)); }
  assert.ok(furthest > 200, `got away along the bank: ${furthest}`);
  assert.ok(facing.size < 12, 'and did not spin');
});

test('a fox driven at a bank gets away along it too', () => {
  const ok = (x, y) => y > -300; let f = fox({ y: -220, mode: 'flee', way: -Math.PI / 2, a: 0 }), furthest = 0;
  for (let i = 0; i < 150; i++) { f = foxStep(f, { dt: 1 / 60, grid: 100, ok }); assert.ok(f.y > -300); furthest = Math.max(furthest, Math.abs(f.x)); }
  assert.ok(furthest > 150, `along the bank: ${furthest}`);
});

test('a deer stops running once nothing is near, and a stride goes with the ground covered', () => {
  let o = deerStep(deer(), { grid: 100, near: [{ x: 0, y: 200 }], random: () => 0.5 });
  for (let i = 0; i < 300; i++) o = deerStep(o, { dt: 1 / 60, grid: 100 });
  assert.equal(o.mode, 'look'); assert.equal(o.h, 0);
  let w = deer({ mode: 'walk', lift: 1, wait: 99, v: 42 }); const from = w.gait, x0 = w.y;
  w = deerStep(w, { dt: 0.1, grid: 100 });
  assert.ok(w.gait > from && w.y < x0, 'walks forward');
  const still = deerStep(deer({ mode: 'graze', wait: 99 }), { dt: 0.1, grid: 100 });
  assert.equal(still.gait, 0, 'no strides standing still');
});

test('a fox creeps on a rabbit, coils and pounces at it', () => {
  const prey = [{ x: 0, y: -400, mode: 'sit' }];
  let f = fox({ wait: 0 }); const modes = new Set();
  for (let i = 0; i < 4000 && f.mode !== 'landed'; i++) { f = foxStep(f, { dt: 1 / 60, grid: 100, prey, time: i / 60, random: () => 0.5 }); modes.add(f.mode); }
  for (const m of ['stalk', 'coil', 'pounce', 'landed']) assert.ok(modes.has(m), m);
  assert.ok(Math.hypot(f.x - prey[0].x, f.y - prey[0].y) < 10, 'came down where it was');
});

test('a fox leaves a rabbit already running, runs from anyone near, and keeps to its ground', () => {
  const running = foxStep(fox({ wait: 0 }), { grid: 100, prey: [{ x: 0, y: -100, mode: 'bolt' }], random: () => 0.5 });
  assert.equal(running.mode, 'trot');
  const stalking = foxStep(fox({ mode: 'stalk' }), { grid: 100, prey: [{ x: 0, y: -100, mode: 'bolt' }] });
  assert.equal(stalking.mode, 'trot');
  const near = [{ x: 0, y: 150 }], ok = (x, y) => y > -300;
  let f = foxStep(fox(), { grid: 100, near, ok, random: () => 0.5 });
  assert.equal(f.mode, 'flee');
  for (let i = 0; i < 4000; i++) { f = foxStep(f, { dt: 1 / 60, grid: 100, near, ok }); assert.ok(f.y > -300, `at ${f.y}`); }
});

test('a carrying fox goes off and is gone till it is brought back', () => {
  let f = fox({ mode: 'carry', way: 0 });
  for (let i = 0; i < 500 && f.mode === 'carry'; i++) f = foxStep(f, { dt: 1 / 60, grid: 100, near: [{ x: 0, y: 50 }], random: () => 0.5 });
  assert.equal(f.mode, 'away'); assert.ok(f.back > 0);
  assert.equal(foxStep(f, { dt: 1, grid: 100, near: [{ x: f.x, y: f.y }] }).mode, 'away');
});

test('butterflies and dragonflies keep to where they may be', () => {
  const ok = (x, y) => Math.hypot(x, y) < 300;
  let b = { x: 0, y: 0, a: 0, wait: 0, turn: 0, p: 0 };
  for (let i = 0; i < 6000; i++) { b = butterflyStep(b, { dt: 1 / 60, grid: 100, ok, time: i / 60 }); assert.ok(ok(b.x, b.y), `at ${b.x}, ${b.y}`); }
  let d = { x: 0, y: 0, a: 0, hover: 0 }, darts = 0;
  for (let i = 0; i < 6000; i++) { const was = d.dart; d = dragonflyStep(d, { dt: 1 / 60, grid: 100, ok }); assert.ok(ok(d.x, d.y), `at ${d.x}, ${d.y}`); if (d.dart && !was) darts++; }
  assert.ok(darts > 3, 'it moves about');
});

test('an owl crosses on a bow, off the map at both ends', () => {
  const at = (t) => owlPlace({ cx: 0, cy: 0, way: 0, far: 1000, t });
  assert.ok(at(0).x < -400 && at(1).x > 400);
  assert.ok(Math.abs(at(0.5).y) > 50, 'bowed in the middle');
});

test('a deer or fox on ground gone bad runs for the nearest good ground, and does not stop till it is off', async () => {
  const { runsOff, deerStep, foxStep } = await import('../../../scripts/engines/motion/field-life.mjs');
  const spots = [{ x: 1000, y: 0 }, { x: -300, y: 0 }], ok = (x) => x < -200 || x > 200, grid = 100;
  const start = { x: 0, y: 0, a: 0, mode: 'graze', wait: 5, gait: 0, lift: 0, v: 0, h: 0, t: 0 };
  const deer = runsOff(start, { spots });
  assert.equal(deer.mode, 'flee');
  assert.ok(Math.abs(Math.abs(deer.way) - Math.PI) < 1e-9, 'toward the nearer');
  assert.equal(runsOff({ ...start, mode: 'carry' }, { spots }).mode, 'carry');
  assert.equal(runsOff({ ...start, mode: 'away' }, { spots }).mode, 'away');
  assert.equal(runsOff(start, { spots: [] }).mode, 'graze', 'nowhere to run to');
  const run = (step, o) => { let n = 0; while (n++ < 1200 && (o.mode === 'flee' || !ok(o.x, o.y))) { o = step(o, { dt: 1 / 60, grid, ok, random: () => 0.5 }); if (o.mode !== 'flee' && !ok(o.x, o.y)) return { ...o, stuck: true }; } return o; };
  const d = run(deerStep, deer);
  assert.ok(ok(d.x, d.y) && !d.stuck, `deer got off: ${Math.round(d.x)}`);
  const f = run(foxStep, runsOff({ ...start, mode: 'trot' }, { spots }));
  assert.ok(ok(f.x, f.y) && !f.stuck, `fox got off: ${Math.round(f.x)}`);
});

const wolf = (over = {}) => ({ x: 0, y: 0, a: 0, want: 0, mode: 'trot', t: 0, wait: 5, v: 0, gait: 0, seed: 0, ...over });
const run = (w, opts, seconds) => { for (let t = 0; t < seconds; t += 1 / 30) w = wolfStep(w, { dt: 1 / 30, grid: 100, random: () => 0.5, ...opts }); return w; };

test('a wolf runs from people, noise and fires, and away from them', () => {
  for (const opts of [{ near: [{ x: 200, y: 0 }] }, { noise: { x: 200, y: 0 } }, { fires: [{ x: 200, y: 0 }] }]) {
    const w = wolfStep(wolf(), { dt: 1 / 30, grid: 100, random: () => 0.5, ...opts });
    assert.equal(w.mode, 'flee');
    assert.ok(Math.cos(w.way) < 0, 'the other way');
  }
  assert.equal(wolfStep(wolf(), { dt: 1 / 30, grid: 100, near: [{ x: 900, y: 0 }], random: () => 0.5 }).mode, 'trot', 'too far to mind');
  const gone = run(wolf(), { fires: [{ x: 200, y: 0 }] }, 2);
  assert.ok(gone.x < -100, 'it gets away');
});

test('the pack keeps with its first', () => {
  const leader = wolf({ x: 800, y: 0, a: Math.PI / 2, v: 90 });
  const w = run(wolf({ seed: 1 }), { leader }, 8);
  assert.ok(Math.hypot(w.x - 800, w.y) < 300, 'caught up');
  assert.equal(wolfStep(wolf(), { dt: 1 / 30, grid: 100, leader: { ...leader, mode: 'hunt' }, prey: [{ x: 5000, y: 0 }] }).mode, 'hunt', 'hunts when it hunts');
  assert.equal(wolfStep(wolf({ x: 800 }), { dt: 1 / 30, grid: 100, leader: { ...leader, mode: 'rest' }, random: () => 0.5 }).mode, 'rest', 'lies up beside it');
  assert.equal(wolfStep(wolf({ mode: 'rest' }), { dt: 1 / 30, grid: 100, leader: { ...leader, mode: 'trot' }, random: () => 0.5 }).mode, 'trot', 'and gets up with it');
});

test('the first wolf hunts a deer it sees, then gives up; it does not catch it', () => {
  const deer = [{ x: 300, y: 0 }];
  assert.equal(wolfStep(wolf({ wait: 0 }), { dt: 1 / 30, grid: 100, prey: deer, random: () => 0.5 }).mode, 'hunt');
  const hunting = run(wolf({ mode: 'hunt', a: Math.PI / 2 }), { prey: [{ x: 5000, y: 0 }] }, 3);
  assert.ok(hunting.x > 500, 'runs it down');
  assert.equal(run(wolf({ mode: 'hunt', a: Math.PI / 2 }), { prey: [{ x: 5000, y: 0 }] }, 7).mode, 'trot', 'gives up');
  assert.equal(wolfStep(wolf({ wait: 0 }), { dt: 1 / 30, grid: 100, prey: [{ x: 3000, y: 0 }], random: () => 0.9 }).mode, 'trot', 'none in sight');
});

test('a wolf stays out of what it cannot enter', () => {
  const w = run(wolf({ a: Math.PI / 2, want: Math.PI / 2, v: 90 }), { ok: (x) => x < 300, time: 0 }, 6);
  assert.ok(w.x < 340);
});

test('a map only gets what its ground has room for', async () => {
  const { balancedLife } = await import('../../../scripts/engines/motion/wildlife.mjs');
  const many = balancedLife({ rabbits: 30, songbirds: 27, crows: 18, deer: 12, foxes: 3, wolves: 9 }, 300);
  assert.equal(many.wolves, 5, 'one pack, not a crowd');
  assert.equal(many.foxes, 2);
  assert.ok(many.rabbits + many.deer + many.wolves + many.foxes <= 15, 'room for 15 on this ground');
  assert.ok(many.deer >= 1 && many.rabbits >= 1, 'something to hunt');
  assert.equal(many.songbirds, 12);
  assert.equal(many.crows, 8);
  assert.deepEqual(balancedLife({ rabbits: 5, deer: 4, foxes: 1 }, 600), { rabbits: 5, deer: 4, foxes: 1, wolves: 0, songbirds: 0, crows: 0, squirrels: 0, snakes: 0 }, 'the usual fits as it is');
  assert.equal(balancedLife({ rabbits: 0, deer: 8 }, 0).rabbits, 0, 'none asked for, none given');
  assert.ok(balancedLife({ rabbits: 30, wolves: 9, foxes: 3 }, 0).rabbits >= 1, 'a tiny map still has one');
});

test('newcomers come from just off the nearest edge, past no wall', async () => {
  const { edgeArrival } = await import('../../../scripts/engines/motion/wildlife.mjs');
  const area = { x: 0, y: 0, width: 1000, height: 1000 }, spot = { x: 950, y: 500 };
  assert.deepEqual(edgeArrival([spot], area, { grid: 100 }), { from: { x: 1060, y: 500 }, to: spot, clear: 80 });
  assert.ok(edgeArrival([spot], area, { grid: 100, blocked: (from) => from.x > 1000 }), 'the map\'s own boundary is no wall to it');
  assert.equal(edgeArrival([spot], area, { grid: 100, blocked: () => true }), null);
  assert.equal(edgeArrival([], area), null);
  assert.equal(edgeArrival([spot], null), null);
});

test('a deer and a wolf walk in to where they are going, then carry on as usual', async () => {
  const { deerStep } = await import('../../../scripts/engines/motion/field-life.mjs');
  let d = { x: -60, y: 0, tx: 300, ty: 0, a: Math.PI / 2, mode: 'arrive', t: 0, gait: 0, wait: 0, v: 0, lift: 1, h: 0 }, step = { dt: 1 / 30, grid: 100, random: () => 0.5, ok: (x) => x > 0 };
  for (let i = 0; i < 300 && d.mode === 'arrive'; i++) d = deerStep(d, step);
  assert.equal(d.mode, 'look');
  assert.ok(Math.abs(d.x - 300) < 60);
  const w = run(wolf({ x: -60, tx: 300, ty: 0, a: Math.PI / 2, mode: 'arrive' }), { ok: (x) => x > 0 }, 5);
  assert.notEqual(w.mode, 'arrive');
  assert.ok(w.x > 200);
  assert.equal(run(wolf({ x: -60, tx: 300, ty: 0, a: Math.PI / 2, mode: 'arrive' }), { blocked: () => true }, 26).mode, 'trot', 'never stuck at the edge for good');
  const crossing = run(wolf({ x: -60, tx: 300, ty: 0, a: Math.PI / 2, mode: 'arrive', clear: 80 }), { blocked: (p) => p.x < 0 }, 2);
  assert.ok(crossing.x > 100, 'it crosses the edge of the map');
});

test('a fed wolf leaves the deer alone', () => {
  assert.equal(wolfStep(wolf({ wait: 0, full: 100 }), { dt: 1 / 30, grid: 100, prey: [{ x: 300, y: 0 }], random: () => 0.9 }).mode, 'trot');
  assert.equal(wolfStep(wolf({ wait: 0, full: 0 }), { dt: 1 / 30, grid: 100, prey: [{ x: 300, y: 0 }], random: () => 0.9 }).mode, 'hunt');
});

test('a kill is hauled off the map: backing away with it, past the edge, then gone till brought back', async () => {
  const { edgeExit } = await import('../../../scripts/engines/motion/wildlife.mjs');
  const area = { x: 0, y: 0, width: 1000, height: 1000 };
  assert.deepEqual(edgeExit({ x: 900, y: 500 }, area, { grid: 100 }), { x: 1120, y: 500 }, 'the nearest edge');
  assert.deepEqual(edgeExit({ x: 900, y: 500 }, area, { grid: 100, blocked: (a, b) => b.x > 900 }), { x: 900, y: -120 }, 'or the nearest it can reach');
  assert.deepEqual(edgeExit({ x: 900, y: 500 }, area, { grid: 100, blocked: () => true }), { x: 1120, y: 500 }, 'no clear line anywhere: the nearest, and it finds its way');
  assert.equal(edgeExit({ x: 1, y: 1 }, null), null);
  const hauling = wolf({ x: 900, y: 500, a: -Math.PI / 2, mode: 'drag', tx: 1120, ty: 500, pulling: true });
  const one = run(hauling, { blocked: (a, b) => b.x > 1000 }, 1);
  assert.ok(one.x > 900 && one.x < 1000, 'on its way');
  assert.ok(Math.abs(one.a - -Math.PI / 2) < 0.2 || Math.sin(one.a) < 0, 'facing back at the kill');
  const out = run(hauling, { blocked: (a, b) => b.x > 1000 }, 5);
  assert.equal(out.mode, 'away', 'the edge does not stop it going out');
  const still = run(out, { near: [{ x: 1120, y: 500 }] }, 1);
  assert.equal(still.mode, 'away', 'nothing troubles one that has gone');
  assert.equal(wolfStep(hauling, { dt: 1 / 30, grid: 100, near: [{ x: 1000, y: 500 }], random: () => 0.5 }).mode, 'flee', 'driven off, it lets go');
  assert.equal(wolfStep(wolf({ mode: 'drag', tx: 1, ty: 1 }), { dt: 1 / 30, grid: 100, leader: wolf({ mode: 'flee' }), random: () => 0.5 }).mode, 'trot', 'the rest stop when its first does');
});

const chain = (step, o, opts, seconds) => { for (let i = 0; i < seconds * 30; i++) o = step(o, { dt: 1 / 30, grid: 100, random: () => 0.5, ...opts }); return o; };
test('a squirrel races under its tree from anyone near, stays a while, then comes out', async () => {
  const { squirrelStep } = await import('../../../scripts/engines/motion/field-life.mjs');
  const trees = [{ x: 400, y: 0, r: 150 }], s = { x: 0, y: 0, a: Math.PI / 2, mode: 'forage', wait: 5, tree: 0, t: 0, v: 0, gait: 0 };
  assert.equal(squirrelStep(s, { dt: 1 / 30, grid: 100, trees, near: [{ x: -200, y: 0 }] }).mode, 'race');
  const hidden = chain(squirrelStep, s, { trees, near: [{ x: -200, y: 0 }] }, 2);
  assert.equal(hidden.mode, 'hide');
  assert.ok(Math.hypot(hidden.x - 400, hidden.y) < 150, 'under the leaves');
  assert.equal(chain(squirrelStep, hidden, { trees, near: [{ x: 400, y: 0 }] }, 30).mode, 'hide', 'not while someone stands there');
  assert.notEqual(chain(squirrelStep, hidden, { trees }, 30).mode, 'hide', 'out again');
  const noTrees = chain(squirrelStep, { ...s, tree: -1 }, { near: [{ x: -200, y: 0 }] }, 0.5);
  assert.ok(noTrees.x > 100, 'with none, it just bolts');
});

test('a snake lies still, then slides; near it goes off the other way', async () => {
  const { snakeStep } = await import('../../../scripts/engines/motion/field-life.mjs');
  const s = { x: 0, y: 0, a: 0, mode: 'lie', wait: 10, t: 0, v: 0, gait: 0 };
  const still = chain(snakeStep, s, {}, 5);
  assert.deepEqual([still.x, still.y, still.mode], [0, 0, 'lie']);
  assert.equal(chain(snakeStep, { ...s, wait: 0 }, {}, 0.1).mode, 'slide');
  assert.equal(snakeStep(s, { dt: 1 / 30, grid: 100, near: [{ x: 500, y: 0 }] }).mode, 'lie', 'too far to mind');
  const off = chain(snakeStep, s, { near: [{ x: 150, y: 0 }] }, 2);
  assert.equal(off.mode, 'flee');
  assert.ok(off.x < -100, 'away');
  assert.equal(chain(snakeStep, s, { noise: null, scare: true }, 0.1).mode, 'flee');
});

test('the balance caps squirrels and snakes too', async () => {
  const { balancedLife } = await import('../../../scripts/engines/motion/wildlife.mjs');
  const b = balancedLife({ squirrels: 9, snakes: 9 }, 100);
  assert.deepEqual([b.squirrels, b.snakes], [6, 3]);
});

test('a squirrel whose tree has gone does not stay hidden', async () => {
  const { squirrelStep } = await import('../../../scripts/engines/motion/field-life.mjs');
  assert.equal(squirrelStep({ x: 0, y: 0, a: 0, mode: 'hide', wait: 20, tree: -1 }, { dt: 1 / 30, grid: 100, random: () => 0.5 }).mode, 'forage');
});

test('a wolf is not done arriving till it is on the map, and a hungry first wolf ranges toward deer', () => {
  const off = run(wolf({ x: 50, tx: 50, ty: 0, y: 0, a: 0, mode: 'arrive' }), { ok: () => false }, 1);
  assert.equal(off.mode, 'arrive', 'at its mark but still off the map');
  const deer = [{ x: 3000, y: 0 }], hungry = run(wolf({ a: 0, want: 0, wait: 1000 }), { prey: deer, time: 0 }, 12);
  assert.ok(hungry.x > 300, 'toward the deer');
  const fed = run(wolf({ a: 0, want: 0, wait: 1000, full: 500 }), { prey: deer, time: 0 }, 12);
  assert.ok(fed.x < hungry.x, 'not when fed');
  assert.equal(wolfStep(wolf({ wait: 0 }), { dt: 1 / 30, grid: 100, prey: [{ x: 900, y: 0 }], random: () => 0.9 }).mode, 'hunt', 'ten squares off');
});

test('wolves go round a wall, hauling or following', () => {
  // A wall across the way, from y -300 to 300 at x 400.
  const blocked = (a, b) => (a.x < 400) !== (b.x < 400) && Math.abs(a.y) < 300;
  const hauled = run(wolf({ x: 200, y: 0, a: -Math.PI / 2, mode: 'drag', tx: 1000, ty: 0, pulling: true }), { blocked }, 30);
  assert.ok(hauled.mode === 'away' || hauled.x > 400, 'hauled round it');
  const leader = wolf({ x: 900, y: 0, a: Math.PI / 2, v: 0, mode: 'trot' });
  const follower = run(wolf({ x: 200, y: 0, a: Math.PI / 2, seed: 1 }), { blocked, leader }, 20);
  assert.ok(follower.x > 400, 'caught up, not stuck behind the wall');
});

test('a squirrel comes out on the side away from anyone, and keeps going', async () => {
  const { squirrelStep } = await import('../../../scripts/engines/motion/field-life.mjs');
  const trees = [{ x: 0, y: 0, r: 500 }], s = { x: 0, y: 0, a: 0, mode: 'hide', wait: 0, tree: 0, t: 0, v: 0, gait: 0 };
  // Someone at the tree's middle: the far side of a wide tree is still fine. (random 0.5: out to the west.)
  const out = squirrelStep(s, { dt: 1 / 30, grid: 100, trees, near: [{ x: 100, y: 0 }], random: () => 0.5 });
  assert.equal(out.mode, 'dash');
  assert.equal(squirrelStep(out, { dt: 1 / 30, grid: 100, trees, near: [{ x: 100, y: 0 }], random: () => 0.5 }).mode, 'dash', 'no bolting straight back');
  assert.equal(squirrelStep(s, { dt: 1 / 30, grid: 100, trees, near: [{ x: -575, y: 0 }], random: () => 0.5 }).mode, 'hide', 'someone right where it would come out');
  assert.equal(squirrelStep({ ...out, emerging: false, x: 900, y: 0, tx: 1000, ty: 0 }, { dt: 1 / 30, grid: 100, trees, near: [{ x: 1000, y: 0 }], random: () => 0.5 }).mode, 'race', 'out and about, it minds them again');
});

test('a fright ends, even on ground the animal would not choose', async () => {
  const { foxStep, deerStep } = await import('../../../scripts/engines/motion/field-life.mjs');
  const ask = { dt: 1 / 30, grid: 100, ok: () => false, random: () => 0.5 };
  const calmed = (step, o, stop) => { for (let i = 0; i < 30 * 20; i++) { o = step(o, ask); if (o.mode !== 'flee') return o.mode; } return 'still running'; };
  assert.equal(calmed(wolfStep, wolf({ mode: 'flee', way: 0, t: 0 })), 'trot');
  assert.equal(calmed(foxStep, { x: 0, y: 0, a: 0, mode: 'flee', way: 0, t: 0, gait: 0, v: 0, h: 0 }), 'trot');
  assert.equal(calmed(deerStep, { x: 0, y: 0, a: 0, mode: 'flee', way: 0, t: 0, gait: 0, v: 0, h: 0, lift: 0, step: 0 }), 'look');
  // With someone still on its heels a wolf keeps going.
  assert.equal(wolfStep(wolf({ mode: 'flee', way: 0, t: 3.3, ranOn: 9 }), { ...ask, near: [{ x: 100, y: 0 }] }).mode, 'flee');
});

test('a wolf left behind goes off the map after its pack', () => {
  const leader = wolf({ x: 500, y: 0, mode: 'away' });
  const left = run(wolf({ x: 0, y: 0, seed: 1 }), { leader }, 12);
  assert.equal(left.mode, 'away');
});

test('a wolf hauling forces a way out when it cannot get round', () => {
  // A wall all the way across: no way round it at all.
  const blocked = (a, b) => (a.x < 400) !== (b.x < 400);
  const out = run(wolf({ x: 200, y: 0, a: -Math.PI / 2, mode: 'drag', tx: 800, ty: 0, pulling: true }), { blocked }, 90);
  assert.equal(out.mode, 'away');
});

test('wolves, squirrels and snakes each have their own keep-out', async () => {
  const { readFileSync } = await import('node:fs');
  const main = readFileSync(new URL('../../../scripts/main.mjs', import.meta.url), 'utf8'), field = readFileSync(new URL('../../../scripts/engines/motion/field-life.mjs', import.meta.url), 'utf8');
  for (const kind of ['wolves', 'squirrels', 'snakes']) {
    assert.ok(new RegExp('const KEEP_OUT = \\[[^\\]]*"' + kind + '"').test(main), kind + ' is a kind');
    assert.ok(main.includes('keepBox("' + kind + '",'), kind + ' has a box');
    assert.ok(new RegExp('regions: JSON\\.stringify\\(\\[\\[[^\\]]*"' + kind + '"').test(main), kind + ' ticked is noticed at once');
    assert.ok(field.includes("ok('" + kind + "', x, y)"), kind + ' asks after itself');
  }
  assert.ok(main.includes('keepBox("all", "All animals")'), 'an All animals box');
  assert.ok(main.includes('if (keepsOut(own, kind))'), 'which counts for every kind');
});

test('a wolf hauling goes round a kept-out region, though it wades water', () => {
  // Kept out: a block across the way. No wall.
  const kept = (x, y) => x > 400 && x < 600 && Math.abs(y) < 300, wet = () => false;
  let w = wolf({ x: 200, y: 0, a: -Math.PI / 2, mode: 'drag', tx: 1000, ty: 0, pulling: true }), inside = 0;
  for (let i = 0; i < 30 * 24; i++) { w = wolfStep(w, { dt: 1 / 30, grid: 100, ok: wet, kept, random: () => 0.5 }); if (kept(w.x, w.y)) inside++; }
  assert.equal(inside, 0, 'never in it');
  assert.ok(w.mode === 'away' || w.x > 600, 'past it');
});

test('wolves howl at ease, more by night, and never on a hunt', async () => {
  const { wolfCallNow } = await import('../../../scripts/engines/motion/field-life.mjs');
  const calls = (o, n = 200000) => { let c = 0; for (let i = 0; i < n; i++) if (wolfCallNow({ dt: 1 / 60, pack: 3, ...o })) c++; return c; };
  assert.equal(wolfCallNow({ was: 'arrive', mode: 'trot', pack: 3 }), 'wolfPack', 'coming in');
  assert.equal(wolfCallNow({ was: 'arrive', mode: 'trot', pack: 1 }), 'wolfHowl', 'alone');
  assert.equal(wolfCallNow({ mode: 'rest', pack: 1, random: () => 0 }), 'wolfHowl', 'alone: no pack to join in');
  for (const mode of ['hunt', 'drag', 'flee', 'away', 'arrive']) assert.equal(calls({ mode }, 2000), 0, mode);
  assert.ok(calls({ mode: 'rest', night: 1 }) > calls({ mode: 'rest', night: 0 }) * 1.5, 'more by night');
});

test('a wolf growls once at someone coming close, and again only after they have gone', async () => {
  const { wolfGrowlNow } = await import('../../../scripts/engines/motion/field-life.mjs');
  const at = (x) => [{ x, y: 0 }], w = { x: 0, y: 0, mode: 'trot' };
  assert.deepEqual(wolfGrowlNow(w, at(900)), { growl: false, warned: false }, 'far off');
  assert.deepEqual(wolfGrowlNow(w, at(400)), { growl: true, warned: true }, 'within five squares');
  assert.deepEqual(wolfGrowlNow({ ...w, warned: true }, at(400)), { growl: false, warned: true }, 'not again');
  assert.deepEqual(wolfGrowlNow({ ...w, warned: true }, at(650)), { growl: false, warned: true }, 'still about');
  assert.deepEqual(wolfGrowlNow({ ...w, warned: true }, at(900)), { growl: false, warned: false }, 'gone: it can growl again');
  for (const mode of ['hunt', 'arrive', 'away']) assert.equal(wolfGrowlNow({ ...w, mode }, at(100)).growl, false, mode);
  assert.equal(wolfGrowlNow({ ...w, mode: 'drag' }, at(100)).growl, true, 'over its kill');
});

test('walls round a trunk do not stop a squirrel going up its tree, and it never crosses them', async () => {
  const { squirrelStep } = await import('../../../scripts/engines/motion/field-life.mjs');
  const trees = [{ x: 0, y: 0, r: 300 }], ring = (radius) => (a, b) => Math.hypot(a.x, a.y) >= radius && Math.hypot(b.x, b.y) < radius;
  const race = (start, blocked) => { let s = { x: start, y: 0, a: 0, mode: 'forage', wait: 5, tree: 0 }, least = Infinity; for (let i = 0; i < 90 && s.mode !== 'hide'; i++) { s = squirrelStep(s, { dt: 1 / 30, grid: 100, trees, scare: i === 0, blocked, random: () => 0.5 }); least = Math.min(least, Math.hypot(s.x, s.y)); } return { s, least }; };
  const walled = race(600, ring(250));
  assert.equal(walled.s.mode, 'hide', 'up the tree at the ring');
  assert.ok(walled.least >= 250, 'not through it');
  assert.equal(race(600, () => false).s.mode, 'hide', 'no walls: as before');
  const far = race(600, ring(500));
  assert.notEqual(far.s.mode, 'hide', 'a wall well away from the tree still stops it');
  assert.ok(far.least >= 500);
});
