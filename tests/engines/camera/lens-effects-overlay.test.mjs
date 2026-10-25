import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLensBloodOverlay } from '../../../scripts/engines/camera/lens-blood-draw.mjs';
import { boardHost, drawEffect, paintLayer, releaseEffect } from '../../../scripts/engines/camera/lens-effects-draw.mjs';
import { lensEffectsFor, LENS_EFFECT_TYPES } from '../../../scripts/engines/camera/lens-effects.mjs';

// A 2D context that records what it draws.
function context(canvas) {
  const calls = [];
  return new Proxy({ canvas, calls }, {
    get(target, key) {
      if (key in target) return target[key];
      if (key === 'createRadialGradient' || key === 'createLinearGradient') return () => ({ addColorStop() {} });
      if (key === 'getTransform') return () => ({ a: 1, b: 0 });
      return (...args) => { calls.push(key); return args[0]; };
    },
    set(target, key, value) { target[key] = value; return true; },
  });
}
const makeCanvas = (width = 1, height = 1) => { const c = { width, height, style: {}, dataset: {}, isConnected: true }; const g = context(c); c.getContext = () => g; return c; };
const HIT = { types: ['poison'], strength: 0.7, crit: false, amount: 'heavy', kind: 'self', impact: { x: 400, y: 300 }, quality: 'full' };

function page() {
  const made = [];
  let frames = [], t = 1000;
  const doc = { createElement: () => { const c = makeCanvas(); made.push(c); return c; }, getElementById: () => null, body: { append() {} } };
  const win = { innerWidth: 1600, innerHeight: 900, devicePixelRatio: 1, requestAnimationFrame: (cb) => { frames.push(cb); return frames.length; }, cancelAnimationFrame: () => { frames = []; } };
  const looks = [];
  const overlay = createLensBloodOverlay({ doc, win, now: () => t, worker: false, board: (look) => looks.push(look) });
  return {
    overlay, looks, made,
    frame(ms = 16) { t += ms; const run = frames; frames = []; for (const f of run) f(); },
    run(ms) { for (let i = 0; i < ms / 16; i++) this.frame(16); },
    get running() { return frames.length > 0; },
  };
}

test('a hit\'s effects draw on the overlay and the board wears their look until they end, then is put back', () => {
  const p = page();
  assert.equal(p.overlay.effects(HIT, { seed: 'a' }), 1);
  assert.equal(p.overlay.alive, 1);
  p.run(400);
  const applied = p.looks.filter(Boolean);
  assert.ok(applied.length > 5, 'the board sways while it plays');
  assert.match(applied.at(-1).filter, /blur|saturate|hue-rotate/);
  const [mark, glint] = p.made;
  assert.ok(mark.getContext('2d').calls.includes('fillRect'), 'the vignette on the multiplied canvas');
  assert.ok(glint.getContext('2d').calls.includes('fillRect'), 'its haze on the glint canvas');
  p.run(4000);
  assert.equal(p.overlay.alive, 0);
  assert.equal(p.looks.at(-1), null, 'the board put back once it ends');
  assert.equal(p.running, false, 'and the frames stop');
});

test('clear() and clearEffects() always put the board back; the same type again at once is not doubled', () => {
  const p = page();
  p.overlay.effects(HIT, { seed: 'a' });
  assert.equal(p.overlay.effects(HIT, { seed: 'b' }), 0, 'not doubled');
  p.run(200);
  p.overlay.clear();
  assert.equal(p.looks.at(-1), null);
  assert.equal(p.overlay.alive, 0);
  p.overlay.effects({ ...HIT, types: ['mental'] }, { seed: 'c' });
  p.run(200);
  assert.ok(p.looks.at(-1)?.split > 0, 'double vision');
  p.overlay.clearEffects();
  assert.equal(p.looks.at(-1), null);
  assert.equal(p.overlay.alive, 0);
});

test('the board is put back when the overlay is gone from the page', () => {
  const p = page();
  p.overlay.effects({ ...HIT, types: ['void'] }, { seed: 'v' });
  p.run(300);
  assert.ok(p.looks.at(-1)?.filter);
  for (const c of p.made) c.isConnected = false;
  p.frame();
  assert.equal(p.looks.at(-1), null);
});

test('Low quality never touches the board; nothing at all at Off', () => {
  const p = page();
  assert.equal(p.overlay.effects({ ...HIT, types: ['poison', 'mental'], quality: 'low' }, { seed: 'l' }), 2);
  p.run(2000);
  assert.ok(p.looks.every((l) => !l), 'no board look at Low');
  assert.equal(p.overlay.effects({ ...HIT, quality: 'off' }), 0);
  assert.equal(p.overlay.effects({ ...HIT, types: [] }), 0);
});

test('every type draws through the overlay with its sprites painted once', () => {
  for (const type of LENS_EFFECT_TYPES) {
    const p = page();
    assert.equal(p.overlay.effects({ ...HIT, types: [type], crit: true }, { seed: type }), 1, type);
    p.run(600);
    const calls = p.made.flatMap((c) => c.getContext('2d').calls);
    assert.ok(calls.some((k) => ['drawImage', 'fillRect', 'stroke', 'fill'].includes(k)), `${type} draws`);
    p.overlay.clear();
  }
});

test('a layer\'s sprite is cropped to its shapes and painted once per plan', () => {
  const [force] = lensEffectsFor({ types: ['force'], strength: 0.5, view: { width: 1600, height: 900 }, impact: { x: 400, y: 300 }, seed: 'f' });
  const sp = paintLayer(force.layers[0], { w: 1600, h: 900, dev: 2, make: makeCanvas });
  assert.ok(sp.w < 1600 && sp.h < 900, 'cropped');
  assert.equal(sp.image.width, Math.ceil(sp.w * 2), 'at the device scale');
  let painted = 0;
  const make = (w, h) => { painted++; return makeCanvas(w, h); };
  const mark = makeCanvas().getContext('2d'), glint = makeCanvas().getContext('2d');
  for (let age = 0; age < 600; age += 50) drawEffect(mark, glint, force, age, { W: 1600, H: 900, make });
  assert.equal(painted, 2, 'two layers, painted once');
  releaseEffect(force);
  drawEffect(mark, glint, force, 100, { W: 1600, H: 900, make });
  assert.equal(painted, 4, 'painted again after release');
  // Over this frame's budget: a layer waits for a later frame.
  const [cold] = lensEffectsFor({ types: ['cold'], strength: 0.5, view: { width: 1600, height: 900 }, seed: 'c' });
  let n = 0;
  drawEffect(mark, glint, cold, 100, { W: 1600, H: 900, make: (w, h) => { n++; return makeCanvas(w, h); }, paint: () => false });
  assert.equal(n, 0);
});

test('the default board host applies the look to #board, keeps what was there and puts it back', () => {
  const board = { style: { filter: 'contrast(1.1)', transform: '', transformOrigin: '' } };
  const offsets = [{ attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } }, { attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } }];
  let appended = 0;
  const doc = {
    getElementById: (id) => (id === 'board' ? board : null),
    createElementNS: () => ({ setAttribute() {}, querySelectorAll: () => offsets, set innerHTML(v) { this.html = v; } }),
    body: { append: () => { appended++; } },
  };
  const apply = boardHost(doc);
  apply({ filter: 'blur(1px)', transform: 'translate(2px, 0px)', split: 0 });
  assert.equal(board.style.filter, 'contrast(1.1) blur(1px)');
  assert.equal(board.style.transform, 'translate(2px, 0px)');
  apply({ filter: 'url(#animater-lens-split)', transform: '', split: 6 });
  assert.equal(appended, 1, 'the double-vision filter added once');
  assert.equal(offsets[0].attrs.dx, '6');
  assert.equal(offsets[1].attrs.dx, '-6');
  apply(null);
  assert.equal(board.style.filter, 'contrast(1.1)', 'put back');
  assert.equal(board.style.transform, '');
  apply({ filter: '', transform: '' });
  assert.equal(board.style.filter, 'contrast(1.1)');
});
