import test from 'node:test';
import assert from 'node:assert/strict';
import { fireSize, smokeRate, smokeDue, smokePuff, createFireSmoke, SMOKE_CAP, SMOKE_COLOURS, smokeRamp } from '../../../scripts/engines/motion/fire-smoke.mjs';
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
  const plain = smokePuff({ key: 'h', x: 0, y: 0, size: 1 }, { grid: 100, n: 1 }), pale = smokePuff(plume, { grid: 100, n: 1 });
  assert.ok(pale.color > plain.color && pale.alpha > plain.alpha, 'paler and fuller, to read against the roof');
  assert.ok(smokePuff(plume, { grid: 100, n: 1 }).vx > smokePuff({ key: 'h', x: 0, y: 0, size: 1 }, { grid: 100, n: 1 }).vx, 'leaning downwind');
});

test('the column never traces the same sway twice: no repeat at any lag', () => {
  // How alike a fire's sideways lean is to itself `lag` puffs later. A sine over the puff number came back round
  // every 25 puffs — two and a half seconds of smoke, and the loop was plain to see on a map.
  const vx = Array.from({ length: 400 }, (_, i) => smokePuff({ key: 'hearth', x: 0, y: 0, size: 1 }, { grid: 100, n: i + 1 }).vx);
  const mean = vx.reduce((a, b) => a + b, 0) / vx.length, dev = vx.map((v) => v - mean);
  const norm = dev.reduce((a, b) => a + b * b, 0);
  const alike = (lag) => dev.slice(0, dev.length - lag).reduce((a, v, i) => a + v * dev[i + lag], 0) / norm;
  // Neighbouring puffs are alike, which is what makes it a column rather than a scatter; past the length of the longer
  // wander (about nine puffs) the likeness has to stay down, instead of climbing back towards 1 as the sine's did.
  let worst = { lag: 0, r: 0 };
  for (let lag = 12; lag <= 120; lag++) { const r = alike(lag); if (r > worst.r) worst = { lag, r }; }
  assert.ok(worst.r < 0.35, `no lag brings the sway back: worst was ${worst.lag} puffs at ${worst.r.toFixed(2)}`);
  assert.ok(alike(1) > 0.5 && alike(10) < 0.25, 'it bends smoothly puff to puff, and has forgotten itself ten puffs later');
  const other = Array.from({ length: 40 }, (_, i) => smokePuff({ key: 'brazier', x: 0, y: 0, size: 1 }, { grid: 100, n: i + 1 }).vx);
  assert.notDeepEqual(other, vx.slice(0, 40), 'and two fires do not sway alike');
});

test('a fire smokes the colour it was given, grey when it was given none', () => {
  const fire = { key: 'k', x: 0, y: 0, size: 1 };
  const grey = smokePuff(fire, { grid: 100, n: 2 });
  assert.equal(smokePuff({ ...fire, smokeColor: '' }, { grid: 100, n: 2 }).color, grey.color, 'no colour is the grey it always was');
  assert.equal(smokePuff({ ...fire, smokeColor: 'nonsense' }, { grid: 100, n: 2 }).color, grey.color, 'a colour this version does not know is grey, not a crash');
  assert.equal(smokePuff({ ...fire, smokeColor: null }, { grid: 100, n: 2 }).color, grey.color, 'a light saved before the colour existed');
  for (const key of Object.keys(SMOKE_COLOURS)) {
    if (!key) continue;
    const puff = smokePuff({ ...fire, smokeColor: key }, { grid: 100, n: 2 });
    assert.notEqual(puff.color, grey.color, `${key} does not smoke grey`);
    assert.ok(SMOKE_COLOURS[key].dark.includes(puff.color), `${key} draws from its own tones`);
    assert.deepEqual(smokePuff({ ...fire, smokeColor: key }, { grid: 100, n: 2 }), puff, 'the same puff every time');
  }
});

test('every smoke colour has four tones, a paler set for the chimney, and none of them is flat', () => {
  const lum = (c) => (((c >> 16) & 255) * 2 + ((c >> 8) & 255) * 3 + (c & 255)) / 6;
  for (const [key, ramp] of Object.entries(SMOKE_COLOURS)) {
    assert.equal(ramp.dark.length, 4, `${key} has four tones in the room`);
    assert.equal(ramp.pale.length, 4, `${key} has four tones above the roof`);
    assert.ok(ramp.name && ramp.about, `${key} says what it is`);
    assert.ok(new Set(ramp.dark).size === 4 && new Set(ramp.pale).size === 4, `${key} varies, rather than reading as one blob`);
    const dark = ramp.dark.map(lum), pale = ramp.pale.map(lum);
    assert.ok(Math.max(...pale) > Math.max(...dark), `${key} is paler out of the chimney, to read against the shingles`);
    assert.ok(Math.min(...dark) > 20 && Math.max(...pale) < 250, `${key} is never flat black or flat white, which read as a hole`);
  }
  assert.deepEqual(smokeRamp('green', true), SMOKE_COLOURS.green.pale);
  assert.deepEqual(smokeRamp('green'), SMOKE_COLOURS.green.dark);
  assert.deepEqual(smokeRamp(undefined, true), SMOKE_COLOURS[''].pale, 'a fire with no colour still smokes');
});
