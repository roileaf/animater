import { test } from 'node:test';
import assert from 'node:assert/strict';
import { doorSends, doorPlace, burstTarget, flockPaths, burstPose, flockSize, FLOCKS } from '../../../scripts/engines/motion/door-burst.mjs';

// A door in a wall along y = 500; the wall stops everything but the gap from x 450 to 550.
const door = doorPlace([450, 500, 550, 500]);
const crossesWall = (a, b) => { if ((a.y - 500) * (b.y - 500) >= 0) return false; const x = a.x + ((500 - a.y) / (b.y - a.y)) * (b.x - a.x); return x < 450 || x > 550; };

test('a door sends what it is set to, the first time only unless set to every time', () => {
  assert.equal(doorSends({}), null);
  assert.equal(doorSends({ doorBurst: '' }), null);
  assert.equal(doorSends({ doorBurst: 'bats' }), 'bats');
  assert.equal(doorSends({ doorBurst: 'rats' }), 'rats');
  assert.equal(doorSends({ doorBurst: 'rats', burstFired: true }), null);
  assert.equal(doorSends({ doorBurst: 'bats', doorBurstWhen: 'always', burstFired: true }), 'bats');
  assert.equal(flockSize('big'), FLOCKS.big);
  assert.equal(flockSize('nonsense'), FLOCKS.medium);
});

test('they come at the nearest token the doorway can reach', () => {
  const tokens = [{ x: 500, y: 200 }, { x: 500, y: 400 }, { x: 5000, y: 400 }];
  assert.deepEqual(burstTarget(door, tokens, { grid: 100 }), { x: 500, y: 400 });
  assert.equal(burstTarget(door, [{ x: 5000, y: 400 }], { grid: 100 }), null, 'too far');
  assert.deepEqual(burstTarget(door, tokens, { grid: 100, blocked: (a, b) => b.y === 400 }), { x: 500, y: 200 }, 'behind a wall: the next');
});

for (const kind of ['bats', 'rats']) test(`every screen works out the same ${kind}; from the far side, through the door, over the opener, never through a wall`, () => {
  const target = { x: 500, y: 200 }, make = (seed) => flockPaths({ door, target, count: 16, grid: 100, seed, blocked: crossesWall, kind });
  assert.deepEqual(make('a'), make('a'));
  assert.notDeepEqual(make('a'), make('b'));
  const flock = make('a');
  assert.equal(flock.length, 16);
  for (const one of flock) {
    assert.ok(one.pts[0].y >= 500, 'behind the door');
    assert.ok(one.pts[1].x >= 450 && one.pts[1].x <= 550 && one.pts[1].y === 500, 'through the gap');
    assert.ok(Math.hypot(one.pts[2].x - 500, one.pts[2].y - 200) < 200, 'over the opener');
    for (let i = 0; i < 4; i++) assert.equal(crossesWall(one.pts[i], one.pts[i + 1]), false, `leg ${i} crosses no wall`);
  }
  assert.ok(flockPaths({ door, target: { x: 500, y: 800 }, count: 4, grid: 100, blocked: crossesWall, kind }).every((b) => b.pts[0].y <= 500), 'opened from the other side, the other way');
  assert.equal(flockPaths({ door, count: 5, grid: 100, kind }).length, 5, 'nobody there: into the room anyway');
});

test('rats run straighter and a little slower than bats fly', () => {
  const avg = (list, f) => list.reduce((s, x) => s + f(x), 0) / list.length, bats = flockPaths({ door, count: 40, grid: 100, kind: 'bats' }), rats = flockPaths({ door, count: 40, grid: 100, kind: 'rats' });
  assert.ok(avg(rats, (x) => x.wob) < avg(bats, (x) => x.wob) / 2);
  assert.ok(avg(rats, (x) => x.life) > avg(bats, (x) => x.life));
});

test('one fades in and out along its way and is gone after', () => {
  const [one] = flockPaths({ door, target: { x: 500, y: 200 }, count: 1, grid: 100 });
  assert.equal(burstPose(one, -0.1), null);
  assert.equal(burstPose(one, one.life + 0.1), null);
  const start = burstPose(one, 0.02, { grid: 100 }), mid = burstPose(one, one.life / 2, { grid: 100 }), end = burstPose(one, one.life * 0.99, { grid: 100 });
  assert.ok(start.alpha < 1 && mid.alpha === 1 && end.alpha < 0.1);
  assert.ok(Number.isFinite(mid.x) && Number.isFinite(mid.y) && Number.isInteger(mid.frame));
});
