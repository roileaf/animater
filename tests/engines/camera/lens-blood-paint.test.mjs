import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lensSplats } from '../../../scripts/engines/camera/lens-blood.mjs';
import { paint, paintReply, splatData } from '../../../scripts/engines/camera/lens-blood-paint.mjs';

const VIEW = { width: 1600, height: 900 };

// Canvases whose 2D contexts record every call in order (the sprite layers).
function canvases() {
  const log = [];
  const make = (width, height) => {
    const canvas = { width, height, n: log.length };
    const gradient = () => ({ addColorStop: (...a) => log.push(['stop', ...a]) });
    const ctx = new Proxy({ canvas }, {
      get(target, key) {
        if (key in target) return target[key];
        if (key === 'createRadialGradient' || key === 'createLinearGradient') return (...a) => { log.push([key, ...a]); return gradient(); };
        return (...a) => { log.push([canvas.n, key, ...a.map((v) => (v && typeof v === 'object' ? `canvas${v.n}` : v))]); };
      },
      set(target, key, value) { log.push([canvas.n, '=', key, value]); target[key] = value; return true; },
    });
    canvas.getContext = () => ctx;
    log.push(['make', width, height]);
    return canvas;
  };
  return { make, log };
}

test('the paint module needs no DOM: it paints on whatever canvases it is given', () => {
  assert.equal(typeof globalThis.document, 'undefined');
  const [s] = lensSplats('nodom', { amount: 'heavy', ...VIEW, strength: 1 });
  const { make } = canvases();
  const wet = paint(s, 1, make, false), dry = paint(s, 1, make, true);
  assert.ok(wet.image && wet.unit > 0);
  assert.equal(dry.glint, null, 'the dried look has no shine');
  assert.equal(paint(s, 1, () => null, false), null);
});

test('a paint request carries plain data and paints exactly what the splat itself paints', () => {
  for (const [i, s] of lensSplats('req', { amount: 'heavy', ...VIEW, strength: 1, crit: true, edge: 'left' }).entries()) {
    const data = splatData({ ...s, bornAt: 5, someFn: () => 1 });
    assert.deepEqual(structuredClone(data), data, 'clonable as is');
    assert.equal(data.someFn, undefined);
    for (const dried of [false, true]) {
      const a = canvases(), b = canvases();
      paint(s, 2, a.make, dried);
      const msg = structuredClone({ id: i, splat: data, dev: 2, dried });
      const bitmaps = [];
      const { reply, transfer } = paintReply(msg, b.make, (c) => { const bm = { bitmapOf: c.n, close() {} }; bitmaps.push(bm); return bm; });
      const at = a.log.findIndex((e, k) => JSON.stringify(e) !== JSON.stringify(b.log[k]));
      assert.equal(at, -1, `${s.shape} ${dried ? "dried" : "wet"}: the same strokes (${JSON.stringify(a.log[at])} vs ${JSON.stringify(b.log[at])})`);
      assert.equal(b.log.length, a.log.length);
      assert.equal(reply.id, i);
      assert.equal(reply.ok, true);
      assert.deepEqual(transfer, bitmaps, 'every bitmap is transferred');
      assert.equal(reply.image, bitmaps[0]);
      assert.equal(!!reply.glint, transfer.length === 2);
      assert.ok(Number.isFinite(reply.ox) && Number.isFinite(reply.oy) && reply.unit > 0 && reply.dev === 2);
    }
  }
});

test('a request that cannot be painted answers not ok, with nothing to transfer', () => {
  const [s] = lensSplats('bad', { amount: 'heavy', ...VIEW, strength: 1 });
  assert.deepEqual(paintReply({ id: 3, splat: splatData(s), dev: 1 }, () => null), { reply: { id: 3, ok: false }, transfer: [] });
  assert.deepEqual(paintReply({ id: 4 }, canvases().make), { reply: { id: 4, ok: false }, transfer: [] });
});
