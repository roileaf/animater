import test from 'node:test';
import assert from 'node:assert/strict';
import { WATER_MOTION, WATER_SHADERS, flowBend, flowField, ringSlot, wakeRingDue, waterFoam, waveSheet } from '../../../scripts/engines/motion/water-engine.mjs';
import { floorDetail } from '../../../scripts/core/quality.mjs';

// A band running top to bottom, soft at its sides.
const band = (w, h) => { const soft = new Uint8Array(w * h); for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) soft[j * w + i] = Math.max(0, 255 - Math.abs(i - w / 2) * 30); return soft; };
const dirAt = (out, w, i, j) => { const k = (j * w + i) * 4; return [(out[k] - 127.5) / 127.5, (out[k + 1] - 127.5) / 127.5, out[k + 2]]; };

test('still water has no way to go', () => {
  const out = flowField(band(8, 8), 8, 8, null);
  assert.equal(out[2], 0);
  assert.ok(Math.abs(dirAt(out, 8, 4, 4)[0]) < 0.02);
});

test('a river runs along its banks, the way it is told, even when told a little off', () => {
  const w = 40, h = 40, south = Math.PI / 2, askew = Math.PI / 2 + 0.6;
  for (const angle of [south, askew]) {
    const [x, y, flows] = dirAt(flowField(band(w, h), w, h, angle), w, 15, 20);
    assert.equal(flows, 255);
    assert.ok(y > 0.9, `down the band, got ${y}`);
    assert.ok(Math.abs(x) < 0.4);
  }
  const [, up] = dirAt(flowField(band(w, h), w, h, -Math.PI / 2), w, 15, 20);
  assert.ok(up < -0.9);
});

test('where a region is cut off across its flow the water runs on through, not sideways along the cut', () => {
  // A band running down, stopped short: full at the top, fading out across its width in the last rows.
  const w = 40, h = 40, soft = band(w, h); for (let j = 32; j < h; j++) for (let i = 0; i < w; i++) soft[j * w + i] *= Math.max(0, 1 - (j - 32) / 6);
  const out = flowField(soft, w, h, Math.PI / 2);
  for (const i of [15, 20, 25]) { const [x, y] = dirAt(out, w, i, 36); assert.ok(y > 0.85, `at ${i}: down, got ${y}`); assert.ok(Math.abs(x) < 0.5, `at ${i}: not sideways, got ${x}`); }
});

test('open water with no banks near goes the way it is told', () => {
  const soft = new Uint8Array(100).fill(255), [x, y] = dirAt(flowField(soft, 10, 10, 0), 10, 5, 5);
  assert.ok(x > 0.95 && Math.abs(y) < 0.05);
});

test('the wave sheet tiles and is made the same each time', () => {
  const a = waveSheet(64), b = waveSheet(64);
  assert.deepEqual(a, b);
  assert.equal(a.length, 64 * 64 * 4);
  let lo = 255, hi = 0; for (let i = 0; i < a.length; i += 4) { lo = Math.min(lo, a[i]); hi = Math.max(hi, a[i]); }
  assert.ok(hi - lo > 30, 'it has waves');
  // Smooth at the size it is used: neighbouring slopes change gently, with no crease for the light to draw as a line.
  const S = 512, big = waveSheet(S); let jump = 0; for (let j = 0; j < S; j++) for (let i = 1; i < S; i++) jump = Math.max(jump, Math.abs(big[(j * S + i) * 4] - big[(j * S + i - 1) * 4]));
  assert.ok(jump < 64, `no creases, got ${jump}`);
  let seam = 0; for (let j = 0; j < S; j++) seam = Math.max(seam, Math.abs(big[j * S * 4] - big[(j * S + S - 1) * 4]));
  assert.ok(seam < 64, `its edges meet, got ${seam}`);
});

test('the quality levels say how much water to draw', () => {
  assert.equal(floorDetail('full').water, 'full');
  assert.equal(floorDetail('light').water, 'full');
  assert.equal(floorDetail('balanced').water, 'simple');
  assert.equal(floorDetail('low').water, null);
  assert.equal(floorDetail('off').water, null);
});

test('every kind of water moves its own way', () => {
  assert.deepEqual(Object.keys(WATER_MOTION), ['still', 'river', 'rapids', 'falls', 'sea']);
  assert.equal(WATER_MOTION.still.pace, 0);
  assert.ok(WATER_MOTION.rapids.pace > WATER_MOTION.river.pace && WATER_MOTION.rapids.foam > 0);
  assert.ok(WATER_MOTION.falls.pace > WATER_MOTION.rapids.pace && WATER_MOTION.falls.streak === 1);
  assert.ok(WATER_MOTION.sea.swell > 1);
});

test('foam follows how strong the stream is', () => {
  assert.ok(waterFoam('falls', 1) > waterFoam('falls', 0.4) && waterFoam('falls', 0.4) > waterFoam('falls', 0.1));
  assert.equal(waterFoam('falls', 1), WATER_MOTION.falls.foam);
  assert.ok(waterFoam('falls', 0) > 0);
  assert.ok(waterFoam('rapids', 1) > waterFoam('rapids', 0.2));
  assert.equal(waterFoam('river', 0.4), 0);
  assert.ok(waterFoam('river', 1) > 0 && waterFoam('river', 1) < waterFoam('rapids', 1));
  assert.equal(waterFoam('still', 1), 0);
  assert.equal(waterFoam('sea', 0.1), WATER_MOTION.sea.foam);
  assert.ok(Number.isFinite(waterFoam('nonsense', 'much')));
});

test('a creature rings the water more often than an animal, each from its first stroke', () => {
  assert.equal(wakeRingDue(undefined, 5, true), true);
  assert.equal(wakeRingDue(undefined, 5, false), true);
  assert.equal(wakeRingDue(5, 5.2, true), false);
  assert.equal(wakeRingDue(5, 5.4, true), true);
  assert.equal(wakeRingDue(5, 5.4, false), false);
  assert.equal(wakeRingDue(5, 6, false), true);
});

test('an animal never takes the place of a creature\'s ring still spreading', () => {
  const rings = new Float32Array(3 * 4).fill(-99), keeps = [true, false, true];
  rings[2] = 10; rings[6] = 10; rings[10] = 10;
  assert.equal(ringSlot(keeps, rings, 10.5, 0, true), 0);
  assert.equal(ringSlot(keeps, rings, 10.5, 0, false), 1);
  assert.equal(ringSlot([true, true, true], rings, 10.5, 0, false), -1);
  assert.equal(ringSlot([true, true, true], rings, 12, 2, false), 2);
});

test('a fall has foam only at its foot, and nothing times the clock by where it is', () => {
  const frag = WATER_SHADERS.full, part = frag.slice(frag.indexOf('float clots, foam;'), frag.indexOf('} else {', frag.indexOf('float clots, foam;')));
  assert.ok(part.includes('band = way < land'), 'foam where it lands');
  assert.ok(part.includes('crest'), 'and on the rings it throws out');
  assert.ok(frag.includes('float land = mix(0.78, 0.86, uStrength)'), 'a stronger fall lands no further up');
  assert.ok(!part.includes('rough'), 'wave height makes no foam on its face');
  assert.ok(!part.includes('lip'));
  assert.ok(!/uTime[^;]*(foot|way)/.test(part), 'no shear');
  assert.ok(part.includes('bubbles('), 'foam is made of bubbles');
  assert.ok(part.includes('thick > 0.01'), 'worked out only where there is foam');
  assert.ok(frag.includes('min(uCurrent, 2.0)'), 'speed does not grow the waves without end');
});

test('the timing of the flow never bends the pattern into arcs, even at its swiftest', () => {
  assert.ok(flowBend(1) < 0.25, `got ${flowBend(1)}`);
  assert.ok(flowBend(0.4) < flowBend(1));
});

test('foam is drawn last, after the light on the waves', () => {
  for (const frag of [WATER_SHADERS.full, WATER_SHADERS.simple]) { assert.ok(frag.indexOf('float clots') > frag.indexOf('A flame near')); assert.ok(frag.indexOf('float clots') < frag.indexOf('Where it has frozen')); }
});

test('the shaders are whole, and the simple one lacks the costly parts', () => {
  for (const frag of [WATER_SHADERS.full, WATER_SHADERS.simple]) assert.ok(!frag.includes('${'));
  assert.ok(WATER_SHADERS.full.includes('#define FULL 1'));
  assert.ok(WATER_SHADERS.simple.includes('#define FULL 0'));
});
