import test from 'node:test';
import assert from 'node:assert/strict';
import { fireSize, smokeRate, smokeDue, smokePuff, createFireSmoke, SMOKE_CAP } from '../../../scripts/engines/motion/fire-smoke.mjs';
import { particleState } from '../../../scripts/engines/motion/movement-feel.mjs';

test('a fire\'s size comes from its light: a candle small, a bonfire big, within bounds', () => {
  assert.equal(fireSize({ bright: 0, dim: 0 }), 0.3);
  assert.ok(fireSize({ bright: 400, dim: 800 }) > fireSize({ bright: 100, dim: 200 }));
  assert.equal(fireSize({ dim: 800 }), fireSize({ bright: 400 }), 'half the dim radius when there is no bright one');
  assert.equal(fireSize({ bright: 99999 }), 2.5);
  assert.ok(smokeRate(2) > smokeRate(0.5));
});

test('a fire puffs steadily at its rate, out of step with other fires', () => {
  const total = (key, size) => { let n = 0; for (let t = 0; t < 10000; t += 16) n += smokeDue(key, t, t + 16, size); return n; };
  const n = total('torch', 1);
  assert.ok(Math.abs(n - smokeRate(1) * 10) <= 1, `about ${smokeRate(1) * 10} in 10 s, got ${n}`);
  assert.ok(total('bonfire', 2.5) > n);
  assert.equal(smokeDue('a', 100, 100), 0);
  const firstOf = (key) => { for (let t = 0; t < 2000; t += 16) if (smokeDue(key, t, t + 16)) return t; return -1; };
  assert.ok(new Set(['a', 'b', 'c', 'd', 'e', 'f'].map(firstOf)).size > 2, 'fires start their puffs at different moments');
});

test('a puff leaves above the flame, rises, widens and fades away', () => {
  const fire = { key: 'k', x: 500, y: 500, size: 1 };
  const p = smokePuff(fire, { grid: 100, n: 3 });
  assert.ok(p.y < 500 && p.vy < 0, 'rises north on the map');
  assert.ok(Math.abs(p.vx) < Math.abs(p.vy), 'mostly up, a little sideways');
  const early = particleState(p, 200), late = particleState(p, p.life * 0.8);
  assert.ok(late.y < early.y && late.scale > early.scale && late.alpha < early.alpha);
  assert.equal(particleState(p, p.life + 1), null);
  assert.deepEqual(smokePuff(fire, { n: 3 }), smokePuff(fire, { n: 3 }), 'the same puff every time');
  assert.notDeepEqual(smokePuff(fire, { n: 3 }).vx, smokePuff(fire, { n: 4 }).vx, 'the column sways puff to puff');
  assert.ok(smokePuff({ ...fire, size: 2.5 }, { n: 1 }).radius > smokePuff({ ...fire, size: 0.3 }, { n: 1 }).radius);
});

test('smoke follows the fires: only visible ones, capped, cleared when off', () => {
  let time = 0, on = true, list = [{ key: 'a', x: 0, y: 0, size: 1, visible: true }, { key: 'b', x: 300, y: 0, size: 1, visible: false }];
  let live = 0;
  const layer = { addParticle: (spec) => { live++; return spec; }, updateParticle() {}, removeParticle() { live--; }, clear() { live = 0; } };
  const smoke = createFireSmoke({ fires: () => list, enabled: () => on, grid: () => 100, now: () => time, layer });
  for (; time < 5000; time += 16) smoke.tick();
  assert.ok(smoke.size > 0);
  assert.equal(smoke.size, live);
  const owners = new Set();
  const spy = createFireSmoke({ fires: () => list, enabled: () => true, grid: () => 100, now: () => time, layer: { ...layer, addParticle: (s) => { owners.add(s.owner); return s; } } });
  for (let t = 0; t < 3000; t += 16) { time += 16; spy.tick(); }
  assert.deepEqual([...owners], ['a'], 'a fire this screen cannot see does not smoke');
  list = Array.from({ length: 60 }, (_, i) => ({ key: `f${i}`, x: i * 50, y: 0, size: 2.5, visible: true }));
  for (let t = 0; t < 4000; t += 16) { time += 16; smoke.tick(); }
  assert.ok(smoke.size <= SMOKE_CAP);
  on = false; smoke.tick();
  assert.equal(smoke.size, 0);
});

test('a hearth under a roof smokes out of its chimney, carried downwind; a carried torch never does', async () => {
  const { chimneyOf, chimneyPlume, smokePuff } = await import('../../../scripts/engines/motion/fire-smoke.mjs');
  assert.equal(chimneyOf({ indoors: true, roofShown: 1 }), true, 'a hearth under the roof');
  assert.equal(chimneyOf({ indoors: true, roofShown: 0 }), false, 'the roof faded: its smoke shows in the room');
  assert.equal(chimneyOf({ indoors: false, roofShown: 1 }), false, 'a campfire');
  assert.equal(chimneyOf({ choice: true }), true, 'a forge set to always');
  assert.equal(chimneyOf({ choice: false, indoors: true, roofShown: 1 }), false, 'set never');
  assert.equal(chimneyOf({ choice: true, carried: true }), false, 'a carried torch');
  const plume = chimneyPlume({ key: 'h', x: 0, y: 0, size: 1 }, 1, 0);
  assert.ok(plume.size > 1 && plume.drift.x > 0.9, 'fuller, and carried east in a strong east wind');
  assert.ok(smokePuff(plume, { grid: 100, n: 1 }).vx > smokePuff({ key: 'h', x: 0, y: 0, size: 1 }, { grid: 100, n: 1 }).vx, 'leaning downwind');
});
