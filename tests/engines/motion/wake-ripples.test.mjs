import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wakeAim, wakeReach, wakeSpread, wakeLife, wakeFade, createWakeTrails } from '../../../scripts/engines/motion/wake-ripples.mjs';

const east = { x: 1, y: 0 }, south = { x: 0, y: 1 };

test('the way a swimmer is going, once it has come far enough', () => {
  assert.deepEqual(wakeAim({ x: 0, y: 0 }, { x: 100, y: 0 }, 10), east);
  assert.equal(wakeAim(null, { x: 1, y: 1 }), null, 'nowhere yet to come from');
  assert.equal(wakeAim({ x: 5, y: 5 }, { x: 5, y: 5 }), null, 'it has not moved');
  assert.equal(wakeAim({ x: 0, y: 0 }, { x: 5, y: 0 }, 10), null, 'not far enough');
});

test('a wake opens to one angle, about 19.5 degrees each side, by its end whatever the speed or size', () => {
  for (const [g, speed] of [[100, 60], [100, 300], [100, 1200], [40, 300]]) {
    const life = wakeLife(g, speed), behind = speed * life, angle = Math.atan((wakeSpread(g, speed, life) - wakeSpread(g, speed, 0)) / behind) * 180 / Math.PI;
    assert.ok(Math.abs(angle - 19.47) < 0.01, `${angle} at ${speed}`);
  }
  assert.equal(wakeSpread(100, 300, 0), 45, 'from its flanks');
});

test('its arms curve: spreading quickly and then less so', () => {
  const at = (age) => wakeSpread(100, 300, age);
  assert.ok(at(0.5) - at(0.25) > at(2) - at(1.75));
});

test('a piece of wake comes up and then fades away, sooner the faster it was made', () => {
  assert.equal(wakeFade(0), 0);
  assert.ok(wakeFade(0.3) > wakeFade(1.5));
  assert.equal(wakeFade(2.6), 0);
  assert.ok(wakeLife(100, 1200) < wakeLife(100, 300));
  assert.equal(wakeLife(100, 10), 2.6, 'no longer than this however slow');
  assert.ok(wakeFade(1, wakeLife(100, 1200)) === 0, 'a fast one is gone sooner');
});

test('what is left in the water stays where it was made, whatever the swimmer does next', () => {
  const pieces = createWakeTrails();
  pieces.drive('a', { x: 0, y: 0, g: 100, dir: east }, 0);
  pieces.drive('a', { x: 40, y: 0, g: 100, dir: east }, 0.1);
  const made = structuredClone(pieces.trails[0].points);
  pieces.drive('a', { x: 40, y: 40, g: 100, dir: south }, 0.2);
  pieces.drive('a', { x: 40, y: 90, g: 100, dir: south }, 0.3);
  assert.deepEqual(pieces.trails[0].points.slice(0, made.length), made);
});

test('a piece remembers how fast and how far along it was made', () => {
  const pieces = createWakeTrails();
  pieces.drive('a', { x: 0, y: 0, g: 100, dir: east }, 0);
  pieces.drive('a', { x: 60, y: 0, g: 100, dir: east }, 0.2);
  const made = pieces.trails[0].points[1];
  assert.ok(Math.abs(made.speed - 300) < 1e-6);
  assert.equal(made.u, 60);
});

test('a slow swimmer still leaves its wake: only how far it has come counts', () => {
  const pieces = createWakeTrails();
  for (let i = 0; i <= 100; i++) pieces.drive('slow', { x: i * 2, y: 0, g: 100, dir: east }, i * 0.1);
  assert.ok(pieces.total > 3);
  assert.equal(pieces.trails.length, 1, 'one unbroken trail');
});

test('it fades away after the swimmer stops, and starting again begins anew', () => {
  const pieces = createWakeTrails();
  pieces.drive('a', { x: 0, y: 0, g: 100, dir: east }, 0);
  pieces.drive('a', { x: 40, y: 0, g: 100, dir: east }, 0.1);
  pieces.drive('a', { x: 80, y: 0, g: 100, dir: east }, 1);
  assert.equal(pieces.trails.length, 2, 'stopped a while');
  pieces.sweep(10);
  assert.equal(pieces.trails.length, 0);
  assert.equal(pieces.total, 0);
});

test('a jump across the water does not draw a wake between', () => {
  const pieces = createWakeTrails();
  pieces.drive('a', { x: 0, y: 0, g: 100, dir: east }, 0);
  pieces.drive('a', { x: 2000, y: 0, g: 100, dir: east }, 0.1);
  assert.equal(pieces.trails.length, 2);
});

test('however many animals are paddling, a token keeps its wake', () => {
  const pieces = createWakeTrails({ limit: 20 });
  for (let n = 0; n < 12; n++) for (let i = 0; i < 6; i++) pieces.drive(`duck${n}`, { x: i * 40, y: n * 500, g: 100, dir: east }, i * 0.1);
  for (let i = 0; i < 6; i++) pieces.drive('token', { x: i * 40, y: 9000, g: 100, dir: east, keep: true }, 0.6 + i * 0.1);
  assert.equal(pieces.total, 20);
  assert.equal(pieces.trails.find((t) => t.key === 'token').points.length, 6);
});

test('the rings of something staying put fit the quad over them', () => {
  assert.ok(wakeReach(1, 200) > wakeReach(0.3, 200));
  assert.ok(wakeReach(0.62, 200) > 200 * 0.62 * 0.85 * 3);
});

// A giant's weight shaking a pond (giant-wake.mjs): a duck's ring is strongest where it starts and gone a square
// out, so a big one of those died half way to the bank. Roi: "shouldnt the ripples go from the center until the
// water edge?" A swell is carried at a set speed and holds its strength the whole way.
test('a swell runs as far as it is sent before it fades, at any strength, and is told from a ring by its sign', async () => {
  const { swellCode, swellOf } = await import('../../../scripts/engines/motion/wake-ripples.mjs');
  for (const reach of [150, 200, 500, 900]) for (const strength of [0.2, 0.7, 1]) {
    const code = swellCode({ reach, grid: 100, strength }), back = swellOf(code);
    assert.ok(code < 0, 'a ring\'s size is never negative');
    assert.ok(back.runs * 100 >= reach * 0.9, `${reach}: sent ${reach}, runs ${back.runs * 100}`);
    assert.ok(back.runs * 100 <= reach + 60 || reach < 100, 'and not much further');
    // It holds for the first part of its run and has faded to nothing by the end of it: gone as it gets there.
    assert.ok(back.fadesFrom > back.runs * 0.5 && back.fadesFrom < back.runs * 0.75, `fades from ${back.fadesFrom} of ${back.runs}`);
    assert.ok(Math.abs(back.strength - Math.min(0.99, strength)) < 1e-3);
  }
  assert.ok(swellOf(swellCode({ reach: 1, grid: 100, strength: 0.5 })).speed >= 0.25, 'never so slow it stands still');
});

test('the ring shader carries a swell at its own speed and holds it, instead of thinning it with distance', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../../../scripts/engines/motion/wake-ripples.mjs', import.meta.url), 'utf8');
  const swell = src.slice(src.indexOf('if (r.w < 0.0) {'), src.indexOf('float g = uGrid * r.w;'));
  assert.ok(swell.length > 100, 'a branch of its own');
  assert.match(swell, /speed = floor\(m\) \/ 20\.0 \* uGrid, strong = fract\(m\)/);
  assert.match(swell, /dist - \(s \* speed \+/);
  assert.ok(!/\/ \(dist \+/.test(swell), 'no falling off with distance');
  assert.ok(!/exp\(-s \*/.test(swell), 'and no dying away from the first moment');
  assert.match(swell, /1\.0 - smoothstep\(/, 'only a fade as its time runs out');
  assert.match(src, /const R = r\.size < 0 \? swellOf\(r\.size\)\.speed \* LIFE \* g \+ g \* 2 : wakeReach\(r\.size, g\);/, 'and the quad drawn over the rings is big enough for it');
});

// Roi, of a swell on a round pond: "why it goes beyond the region boundaries?" Four streaks, north, south, east and
// west, where the pond touches the edge of its own baked picture and the picture's last pixel was read on outward.
test('nothing is drawn past the picture of the water: no streaks where a pond touches its own edge', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../../../scripts/engines/motion/wake-ripples.mjs', import.meta.url), 'utf8');
  const surface = src.slice(src.indexOf('vec4 surface(vec2 slope, float waves){'), src.indexOf('const RING_FRAG'));
  assert.match(surface, /vec2 at = \(vPos - uWaterRect\.xy\) \/ uWaterRect\.zw;\s*if \(uHasWater > 0\.5 && \(at\.x < 0\.0 \|\| at\.y < 0\.0 \|\| at\.x > 1\.0 \|\| at\.y > 1\.0\)\) return vec4\(0\.0\);/);
  assert.ok(surface.indexOf('return vec4(0.0);\n  vec4 where') > 0 || surface.indexOf('at.y > 1.0)) return vec4(0.0);') < surface.indexOf('texture2D(uWater, at)'), 'looked at before the picture is read');
  assert.match(surface, /texture2D\(uWater, at\)/);
});

test('a swell is one bold crest and the one behind it, not a train', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../../../scripts/engines/motion/wake-ripples.mjs', import.meta.url), 'utf8');
  const swell = src.slice(src.indexOf('if (r.w < 0.0) {'), src.indexOf('float g = uGrid * r.w;'));
  const rate = Number(swell.match(/sin\(away \* ([\d.]+) \/ G\)/)?.[1]);
  // Its crests are 2*pi*G/rate apart, and it is about 1.9 G across where it can be seen: under two of them.
  assert.ok(rate > 0 && (1.9 * rate) / (2 * Math.PI) < 4.2, `${rate}`);
  assert.ok(rate <= 14, 'no more crests than that');
});
