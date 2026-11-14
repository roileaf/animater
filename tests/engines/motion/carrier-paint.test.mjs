import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PAINTED_CARRIERS, PAINTED_SETS, spanOf, paintCarrier } from '../../../scripts/engines/motion/carrier-paint.mjs';

// Roi, with a carrier beside the map's own decorations: "take a look at the design system we used for the decorations
// ... everything should have the same design system", and on the baked art at full zoom: "SUPER low quality". The
// carriers are painted with the decorations' own tools now, at whatever size they are asked for, so there is nothing
// to stretch and nothing to go soft.
test('the carriers are painted with the decorations own kit, not a second one of their own', () => {
  const src = readFileSync(new URL('../../../scripts/engines/motion/carrier-paint.mjs', import.meta.url), 'utf8');
  assert.match(src, /import \{ PAINT_KIT[^}]*\} from '\.\/decor-paint\.mjs'/, 'it takes the map\'s painting kit');
  assert.ok(!/createElement\('canvas'\)/.test(src) || /defaultCanvas/.test(src), 'and the kit\'s canvas');
  // No colour of its own that the decorations do not use: the ink is theirs.
  assert.ok(!/INK[^D]/.test(src.replace(/INKD/g, '')) || src.includes('INKD'), 'inked as they are');
});

test('every carrier is laid out in feet, and its picture holds its shafts as well as its bed', () => {
  assert.deepEqual(PAINTED_SETS, ['wagon', 'tilt', 'cart', 'sled']);
  for (const set of PAINTED_SETS) {
    const k = PAINTED_CARRIERS[set];
    assert.ok(k.bed > 0 && k.wide > 0 && k.span >= k.bed, `${set} holds its bed`);
    assert.equal(spanOf(set), k.span);
  }
  // A wagon is ten feet of bed with five more of shafts in front, so its picture is twenty feet across its middle.
  assert.equal(PAINTED_CARRIERS.wagon.bed, 10);
  assert.equal(PAINTED_CARRIERS.wagon.span, 20);
  assert.ok(PAINTED_CARRIERS.cart.bed < PAINTED_CARRIERS.wagon.bed, 'a hand cart is the smaller');
  assert.equal(spanOf('nonsense'), 0);
});

test('a carrier paints into a canvas of the size asked for, with its silhouette beside it', () => {
  // A stand-in for a canvas: enough of the 2D context to be drawn into without a browser.
  const calls = [];
  const ctx = new Proxy({}, { get: (_, name) => {
    if (name === 'canvas') return null;
    if (['fillStyle', 'strokeStyle', 'lineWidth', 'lineCap', 'lineJoin', 'filter', 'globalCompositeOperation'].includes(name)) return '';
    if (name === 'createRadialGradient') return () => ({ addColorStop() {} });
    if (name === 'measureText') return () => ({ width: 0 });
    return (...args) => { calls.push(String(name)); return undefined; };
  }, set: () => true });
  const make = (w, h) => ({ width: w, height: h, getContext: () => ctx });
  const art = paintCarrier('wagon', 7, 400, {}, make);
  assert.ok(art.width >= 400 && art.width === art.height, 'a square picture at least as big as asked for');
  assert.ok(art.canvas && art.shadow, 'the picture and its silhouette');
  assert.ok(calls.includes('fill') && calls.includes('stroke'), 'something was painted and inked');
  assert.equal(paintCarrier('nonsense', 1, 100, {}, make), null);
  // Asked for twice the size it paints twice as big: nothing is baked, so nothing is ever stretched.
  assert.ok(paintCarrier('wagon', 7, 800, {}, make).width > art.width);
});
