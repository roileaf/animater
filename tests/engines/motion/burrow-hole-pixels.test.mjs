import test from 'node:test';
import assert from 'node:assert/strict';
import { holePixels, HOLE_N, HOLE_SPAN } from '../../../scripts/engines/motion/movement-feel-render.mjs';

// Reads the picture at a point in the hole's radius units (+x the way the tunnel runs).
const sample = (px, n, x, y) => { const i = Math.floor((x + HOLE_SPAN) / (2 * HOLE_SPAN) * n), j = Math.floor((y + HOLE_SPAN) / (2 * HOLE_SPAN) * n), k = (j * n + i) * 4; return { r: px[k], g: px[k + 1], b: px[k + 2], a: px[k + 3] }; };
const bright = (p) => p.r + p.g + p.b;

test('holePixels: a black heart, earth heaped round it, bare ground at the corners', () => {
  for (const exit of [false, true]) for (let variant = 0; variant < 4; variant++) {
    const px = holePixels(HOLE_N, { variant, exit });
    assert.equal(px.length, HOLE_N * HOLE_N * 4);
    const heart = sample(px, HOLE_N, 0.1, 0);
    assert.ok(heart.a > 240 && bright(heart) < 60, `dark opaque heart (${JSON.stringify(heart)})`);
    assert.equal(sample(px, HOLE_N, -HOLE_SPAN + 0.02, -HOLE_SPAN + 0.02).a, 0, 'nothing drawn at the corner');
    // Earth lies just behind the opening either way.
    let earth = 0; for (let y = -0.3; y <= 0.3; y += 0.1) earth += sample(px, HOLE_N, -1.0, y).a > 0 ? 1 : 0;
    assert.ok(earth >= 4, 'loose earth behind the hole');
  }
});

test('holePixels: going in throws the earth back; coming out heaps it ahead too', () => {
  const cover = (px, x) => { let n = 0; for (let y = -0.5; y <= 0.5; y += 0.05) n += sample(px, HOLE_N, x, y).a > 0 ? 1 : 0; return n; };
  let inAhead = 0, outAhead = 0;
  for (let variant = 0; variant < 4; variant++) { inAhead += cover(holePixels(HOLE_N, { variant }), 1.25); outAhead += cover(holePixels(HOLE_N, { variant, exit: true }), 1.25); }
  assert.ok(outAhead > inAhead, `${outAhead} > ${inAhead}`);
});

test('holePixels: same shape every time; variants differ', () => {
  assert.deepEqual(holePixels(HOLE_N, { variant: 2 }), holePixels(HOLE_N, { variant: 2 }));
  assert.notDeepEqual(holePixels(HOLE_N, { variant: 1 }), holePixels(HOLE_N, { variant: 2 }));
});
