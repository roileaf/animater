import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lensSplats, splatState, LENS_SHAPES } from '../../../scripts/engines/camera/lens-blood.mjs';
import { drawSplat } from '../../../scripts/engines/camera/lens-blood-draw.mjs';

const VIEW = { width: 1600, height: 900 };

// A 2D context that counts what is drawn.
function recorder(canvas = null) {
  const calls = {};
  const gradient = () => ({ addColorStop() {} });
  const ctx = new Proxy({ canvas }, {
    get(target, key) {
      if (key in target) return target[key];
      if (key === 'createRadialGradient' || key === 'createLinearGradient') return (...a) => { calls[key] = (calls[key] ?? 0) + 1; return gradient(a); };
      if (key === 'getTransform') return () => ({ a: 1, b: 0 });
      return (...a) => { calls[key] = (calls[key] ?? 0) + 1; void a; };
    },
    set(target, key, value) { target[key] = value; return true; },
  });
  return { ctx, calls };
}
// A canvas factory of recording canvases (the sprite layers), counting what it makes.
function canvases() {
  const made = [];
  const make = (width, height) => {
    const canvas = { width, height };
    const r = recorder(canvas);
    canvas.getContext = () => r.ctx;
    made.push({ canvas, calls: r.calls });
    return canvas;
  };
  return { make, made };
}
const noCanvas = () => null;

test('every shape paints its sprite once, then each frame only draws bitmaps and drips', () => {
  const seen = new Set();
  for (let i = 0; i < 30 && seen.size < LENS_SHAPES.length; i++) {
    for (const s of lensSplats(`d${i}`, { amount: 'heavy', ...VIEW, strength: 1, crit: true, kind: i % 2 ? 'self' : 'dealt', edge: 'left' })) {
      const { make, made } = canvases();
      const a = recorder();
      drawSplat(a.ctx, s, splatState(s, 500), { canvas: make });
      assert.equal(a.calls.save, 1);
      assert.equal(a.calls.restore, 1);
      assert.ok(made.length >= 6, `${s.shape}: sprite layers`);
      // The sprite's mask: the whole outline (droplets included) in one fill.
      assert.equal(made[1].calls.fill, 1, `${s.shape}: one mask fill`);
      assert.ok(made.every((m) => m.canvas.width <= 2048 && m.canvas.height <= 2048));
      assert.ok(a.calls.drawImage >= 1 && a.calls.drawImage <= 2, `${s.shape}: ${a.calls.drawImage}`);
      // Next frame: nothing new painted, only drawn.
      const count = made.length, b = recorder();
      drawSplat(b.ctx, s, splatState(s, 600), { canvas: make });
      assert.equal(made.length, count, 'cached');
      assert.ok((b.calls.fill ?? 0) <= s.drips.length * 2, `${s.shape}: ${b.calls.fill} fills a frame`);
      seen.add(s.shape);
    }
  }
  assert.equal(seen.size, LENS_SHAPES.length);
});

test('drying paints the dried look once and lays it over the wet one', () => {
  const s = lensSplats('dry', { amount: 'heavy', ...VIEW, strength: 1 })[0];
  const { make, made } = canvases();
  drawSplat(recorder().ctx, s, splatState(s, 300), { canvas: make });
  const wet = made.length;
  const late = splatState(s, s.lifeMs * 0.6);
  assert.ok(late.dry > 0.1);
  const a = recorder();
  drawSplat(a.ctx, s, late, { canvas: make });
  assert.ok(made.length > wet, 'dried sprite painted');
  const painted = made.length;
  drawSplat(recorder().ctx, s, splatState(s, s.lifeMs * 0.65), { canvas: make });
  assert.equal(made.length, painted, 'and cached');
  assert.ok(a.calls.drawImage >= 2);
});

test('without a canvas to paint in it draws flat; an old splat without a shape still draws; a faded one draws nothing', () => {
  const [s] = lensSplats('old', { amount: 'heavy', ...VIEW, strength: 1 });
  const { shape, tone, ...legacy } = s;
  void shape; void tone;
  const a = recorder();
  drawSplat(a.ctx, legacy, splatState(legacy, 500), { canvas: noCanvas });
  assert.ok(a.calls.fill >= 1);
  const c = recorder();
  drawSplat(c.ctx, { ...s }, splatState(s, 500), { canvas: canvases().make });
  assert.ok(c.calls.drawImage >= 1);
  const b = recorder();
  drawSplat(b.ctx, s, splatState(s, s.lifeMs));
  assert.equal(b.calls.save, undefined);
});

test('the same seed paints the same: geometry drives the sprite deterministically', () => {
  const paintOf = (seed) => {
    const [s] = lensSplats(seed, { amount: 'heavy', ...VIEW, strength: 1, crit: true });
    const { make, made } = canvases();
    drawSplat(recorder().ctx, s, splatState(s, 300), { canvas: make });
    return made.map((m) => [m.canvas.width, m.canvas.height, JSON.stringify(m.calls)]);
  };
  assert.deepEqual(paintOf('same'), paintOf('same'));
});


test('blood runs behind the sidebar button strip and fades out across it', async () => {
  const { lensArea } = await import('../../../scripts/engines/camera/lens-blood-draw.mjs');
  const rects = { '#ui-right': { left: 1350, right: 2000, width: 650, height: 900 }, '#chat-notifications': { left: 1060, right: 1360, width: 300, height: 900 },
    '#sidebar': { left: 1660, right: 2000, width: 340, height: 900 }, '#sidebar-tabs': { left: 1660, right: 1708, width: 48, height: 620 } };
  const doc = { querySelector: (sel) => (rects[sel] ? { getBoundingClientRect: () => rects[sel] } : null) };
  const win = { innerWidth: 2000, innerHeight: 900 };
  assert.deepEqual(lensArea(doc, win), { x: 0, y: 0, w: 1708, h: 900, fade: 48 }, 'to the right edge of the strip, fading across it');
  delete rects['#sidebar-tabs'];
  assert.deepEqual(lensArea(doc, win), { x: 0, y: 0, w: 1660, h: 900, fade: 24 }, 'no strip: up to the sidebar');
  assert.deepEqual(lensArea({ querySelector: () => null }, win), { x: 0, y: 0, w: 2000, h: 900, fade: 0 }, 'no sidebar: the whole window');
});
