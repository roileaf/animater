import test from 'node:test';
import assert from 'node:assert/strict';
import { vaporDue, vaporPuff, vaporArt, createBreathVapor, VAPOR_CAP } from '../../../scripts/engines/motion/breath-vapor.mjs';
import { breathPeriod } from '../../../scripts/engines/motion/idle-life.mjs';
import { PARTICLE_KINDS } from '../../../scripts/engines/motion/movement-feel.mjs';

test('vaporDue: one breath out per breath period, at a seeded moment of each token', () => {
  for (const id of ['a', 'b', 'tok-123']) {
    const period = breathPeriod(id) * 1000;
    let count = 0, first = null;
    for (let t = 0; t < period * 10; t += 16) if (vaporDue(id, t, t + 16)) { count++; first ??= t; }
    assert.ok(count >= 9 && count <= 11, `${id}: ${count}`);
    assert.ok(first !== null && first < period + 16);
  }
  const at = (id) => { for (let t = 0; t < 10000; t += 16) if (vaporDue(id, t, t + 16)) return t; return null; };
  assert.notEqual(at('a'), at('b'));
  assert.equal(vaporDue('a', 100, 100), false);
  assert.equal(vaporDue('a', 200, 100), false);
});

test('vaporPuff: a soft white cloud, readable at table zoom, in front of the face, drifting out, a couple of seconds long', () => {
  // Top-down art (turned, not rotation-locked): breath goes where it faces.
  const puffs = vaporPuff({ id: 'a', x: 500, y: 500, width: 100, rotation: 0, art: 'topdown' }, { grid: 100, n: 1 });
  assert.ok(puffs.length >= 2);
  for (const p of puffs) {
    assert.ok(PARTICLE_KINDS.includes(p.kind));
    assert.equal(p.kind, 'puff');
    assert.ok((p.color & 0xff) > 0xe0 && ((p.color >> 16) & 0xff) > 0xe0, 'white');
    assert.ok(p.alpha >= 0.45 && p.alpha <= 0.65, 'readable but soft');
    assert.ok(p.life >= 1000 && p.life <= 3000);
    assert.ok(p.y > 500, 'facing down at rotation 0: in front of the face');
    assert.ok(p.vy > 0);
  }
  // Turned to face right, the cloud goes right.
  const right = vaporPuff({ id: 'a', x: 500, y: 500, width: 100, rotation: 270, art: 'topdown' }, { grid: 100, n: 1 });
  assert.ok(right.every((p) => p.x > 500));
  assert.deepEqual(vaporPuff({ id: 'a', x: 0, y: 0, width: 100 }, { grid: 100, n: 2 }), vaporPuff({ id: 'a', x: 0, y: 0, width: 100 }, { grid: 100, n: 2 }));
  // Bigger creatures breathe bigger clouds.
  const big = vaporPuff({ id: 'a', x: 0, y: 0, width: 400 }, { grid: 100, n: 1 });
  assert.ok(big[0].radius > puffs[0].radius);
});

function harness(tokens, { on = true } = {}) {
  const live = new Set(), log = { added: 0 };
  let time = 0, enabled = on;
  const layer = {
    addParticle: (spec) => { const h = { spec }; live.add(h); log.added++; return h; },
    updateParticle: (h, state) => { h.state = state; }, removeParticle: (h) => live.delete(h), clear: () => live.clear(),
  };
  const vapor = createBreathVapor({ tokens: () => tokens, enabled: () => enabled, grid: () => 100, now: () => time, layer });
  return { vapor, live, log, advance: (ms) => { time += ms; }, set: (v) => { enabled = v; } };
}
const run = (h, ms) => { for (let t = 0; t < ms; t += 50) { h.advance(50); h.vapor.tick(); } };

test('createBreathVapor: cold, visible, breathing tokens puff; warm, hidden or breathless ones do not', () => {
  const tokens = [
    { id: 'cold', x: 0, y: 0, width: 100, visible: true, breathes: true, cold: true },
    { id: 'warm', x: 0, y: 0, width: 100, visible: true, breathes: true, cold: false },
    { id: 'hidden', x: 0, y: 0, width: 100, visible: false, breathes: true, cold: true },
    { id: 'golem', x: 0, y: 0, width: 100, visible: true, breathes: false, cold: true },
  ];
  const h = harness(tokens);
  run(h, 12000);
  assert.ok(h.log.added >= 4);
  // Only the cold one's puffs: its id is in every seed.
  for (const p of h.live) assert.equal(p.spec.owner, 'cold');
  h.set(false); h.vapor.tick();
  assert.equal(h.live.size, 0);
});

test('createBreathVapor: at most VAPOR_CAP tokens breathe vapor at once; puffs fade away', () => {
  assert.equal(VAPOR_CAP, 20);
  const tokens = Array.from({ length: 40 }, (_, i) => ({ id: `t${i}`, x: i * 100, y: 0, width: 100, visible: true, breathes: true, cold: true }));
  const h = harness(tokens);
  run(h, 12000);
  const owners = new Set();
  for (const p of h.live) owners.add(p.spec.owner);
  assert.ok(owners.size <= VAPOR_CAP);
  for (const t of tokens) t.cold = false;
  run(h, 5000);
  assert.equal(h.live.size, 0);
});

test('vaporPuff: on portrait art (the default) breath leaves the mouth, just above the centre, drifting out to the side and up', () => {
  const puffs = vaporPuff({ id: 'p', x: 500, y: 500, width: 100 }, { grid: 100, n: 1 });
  for (const p of puffs) {
    assert.ok(p.y < 500 && p.y > 500 - 100 * 0.25, `at the mouth (${p.y})`);
    assert.ok(Math.abs(p.x - 500) <= 100 * 0.15, 'near the middle of the face');
    assert.ok(p.vy < 0, 'drifts up');
    assert.ok(Math.abs(p.vx) > 0, 'and out to a side');
  }
  // Breaths alternate sides now and then; the same on every screen.
  const sides = new Set(Array.from({ length: 12 }, (_, n) => Math.sign(vaporPuff({ id: 'p', x: 0, y: 0, width: 100 }, { grid: 100, n })[0].vx)));
  assert.equal(sides.size, 2);
});

test('vaporArt: top-down only when the token can turn and has been turned, else a portrait', () => {
  assert.equal(vaporArt({ lockRotation: true, rotation: 90 }), 'portrait');
  assert.equal(vaporArt({ lockRotation: false, rotation: 0 }), 'portrait');
  assert.equal(vaporArt({ lockRotation: false, rotation: 135 }), 'topdown');
  assert.equal(vaporArt({ lockRotation: false, rotation: 360 }), 'portrait');
  assert.equal(vaporArt({ ring: true, lockRotation: false, rotation: 90 }), 'portrait', 'a dynamic ring is a portrait');
});

test('breath scales with the creature: bigger, more, longer clouds, breathed slower', () => {
  const at = (width) => vaporPuff({ id: 's', x: 0, y: 0, width }, { grid: 100, n: 3 });
  const tiny = at(50), medium = at(100), huge = at(300), garg = at(500);
  const avg = (list, f) => list.reduce((a, p) => a + f(p), 0) / list.length;
  assert.ok(avg(garg, (p) => p.radius) > avg(huge, (p) => p.radius) && avg(huge, (p) => p.radius) > 2 * avg(medium, (p) => p.radius) && avg(medium, (p) => p.radius) > avg(tiny, (p) => p.radius));
  assert.ok(tiny.length <= 2 && garg.length >= 4, `${tiny.length} … ${garg.length}`);
  assert.ok(avg(garg, (p) => p.life) > avg(medium, (p) => p.life) && avg(garg, (p) => p.life) <= 3600);
  // Slower breaths for big bodies (the idle chest rise uses the same period, so they stay in step).
  assert.ok(breathPeriod('s', 0.5) < breathPeriod('s', 1) && breathPeriod('s', 1) < breathPeriod('s', 3) && breathPeriod('s', 3) < breathPeriod('s', 5));
  assert.ok(breathPeriod('s', 5) / breathPeriod('s', 1) >= 1.7 && breathPeriod('s', 0.5) / breathPeriod('s', 1) <= 0.7);
  const count = (sq) => { let c = 0; for (let t = 0; t < 60000; t += 16) if (vaporDue('s', t, t + 16, sq)) c++; return c; };
  assert.ok(count(5) < count(1) && count(1) < count(0.5));
});

test('breath from: a token can say where its mouth is (its art may face any way)', () => {
  const from = (mouth) => vaporPuff({ id: 'm', x: 500, y: 500, width: 100, mouth }, { grid: 100, n: 1 });
  assert.ok(from('right').every((p) => p.x > 530 && p.vx > 0), 'right edge, blowing right');
  assert.ok(from('left').every((p) => p.x < 470 && p.vx < 0));
  assert.ok(from('top').every((p) => p.y < 470 && p.vy < 0));
  assert.ok(from('bottom').every((p) => p.y > 530 && p.vy > 0));
  // 'auto' (or nothing) is the portrait mouth just above the centre.
  assert.deepEqual(from('auto'), vaporPuff({ id: 'm', x: 500, y: 500, width: 100 }, { grid: 100, n: 1 }));
  // 'facing' is top-down art: where it faces.
  assert.ok(vaporPuff({ id: 'm', x: 500, y: 500, width: 100, mouth: 'facing', rotation: 270 }, { grid: 100, n: 1 }).every((p) => p.x > 500));
});
