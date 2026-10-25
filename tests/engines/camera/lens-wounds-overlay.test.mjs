import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLensBloodOverlay } from '../../../scripts/engines/camera/lens-blood-draw.mjs';
import { NO_WOUND, stainsAfterHit, settleStains, WOUNDED } from '../../../scripts/engines/camera/lens-wounds.mjs';

// A 2D context that records what it draws.
function context(canvas) {
  const drawn = [];
  return new Proxy({ canvas, drawn }, {
    get(target, key) {
      if (key in target) return target[key];
      if (key === 'createRadialGradient' || key === 'createLinearGradient') return () => ({ addColorStop() {} });
      if (key === 'getTransform') return () => ({ a: 1, b: 0 });
      if (key === 'drawImage') return (img) => drawn.push(img);
      if (key === 'fill') return () => drawn.push('fill');
      return () => {};
    },
    set(target, key, value) { target[key] = value; return true; },
  });
}
// Elements: canvases with recording contexts, layers that note their animations; all connected.
function element(tag) {
  const el = { tag, style: {}, dataset: {}, isConnected: true, width: 1, height: 1, animations: [] };
  el.getContext = () => (el.ctx ??= context(el));
  el.after = () => {};
  el.remove = () => { el.isConnected = false; };
  el.animate = (frames, opts) => { const a = { frames, opts, cancel() { a.cancelled = true; } }; el.animations.push(a); return a; };
  el.getAnimations = () => el.animations.filter((a) => !a.cancelled);
  return el;
}
function page() {
  const made = [], looks = [];
  let frames = [], t = 1000;
  const doc = { createElement: (tag) => { const e = element(tag); made.push(e); return e; }, getElementById: () => null, body: { append() {} } };
  const win = { innerWidth: 1600, innerHeight: 900, devicePixelRatio: 1, requestAnimationFrame: (cb) => { frames.push(cb); return frames.length; }, cancelAnimationFrame: () => { frames = []; } };
  const overlay = createLensBloodOverlay({ doc, win, now: () => t, area: () => ({ x: 0, y: 0, w: 1600, h: 900 }), worker: false, board: (look) => looks.push(look) });
  return {
    overlay, looks, made,
    byId: (id) => made.find((e) => e.id === id),
    run(ms = 16) { t += ms; const f = frames; frames = []; for (const cb of f) cb(); return f.length; },
    settle(max = 400) { let n = 0; while (frames.length && n++ < max) this.run(); return n; },
    get frames() { return frames.length; },
    get t() { return t; },
  };
}

test('the wound look eases in over its ms, then draws no more frames: a CSS gradient on its own layer', () => {
  const p = page();
  assert.equal(p.overlay.wound({ edge: 0.6 }, { ms: 600 }), true);
  const layer = p.byId('animater-lens-wound');
  assert.ok(layer, 'a layer of its own');
  assert.match(layer.style.cssText, /pointer-events:none/);
  p.run(300);
  const half = p.overlay.woundLook;
  assert.equal(half.edge, 0.6, 'aims at the target');
  assert.match(layer.style.background, /radial-gradient/);
  const n = p.settle();
  assert.ok(n > 0 && n < 60);
  assert.equal(p.frames, 0, 'settled: no frames');
  assert.equal(p.overlay.wound({ edge: 0.6 }), false, 'the same look again: nothing to do');
  assert.deepEqual(p.looks, [], 'red edges alone leave the board alone');
});

test('down: the board is dimmed, blurred and greyed through the board host, and always put back', () => {
  const p = page();
  p.overlay.wound({ dark: 0.9, window: 0.3, blur: 1.6, saturate: 0.4, brightness: 0.6 }, { ms: 0 });
  const look = p.looks.at(-1);
  assert.match(look.filter, /blur\(1\.6px\)/);
  assert.match(look.filter, /saturate\(0\.4\)/);
  assert.match(look.filter, /brightness\(0\.6\)/);
  // Eased back out: the board is restored (null) once neutral.
  p.overlay.wound(NO_WOUND, { ms: 300 });
  p.settle();
  assert.equal(p.looks.at(-1), null);
  // clear() always restores, whatever is on.
  p.overlay.wound({ dark: 0.9, blur: 2, saturate: 0.3, brightness: 0.5 }, { ms: 0 });
  p.overlay.clear();
  assert.equal(p.looks.at(-1), null);
  assert.equal(p.byId('animater-lens-wound').style.background, '');
  // clearWounds() too.
  p.overlay.wound({ dark: 0.9, blur: 2 }, { ms: 0 });
  p.overlay.clearWounds();
  assert.equal(p.looks.at(-1), null);
  assert.deepEqual(p.overlay.woundLook, NO_WOUND);
});

test('the wound board look merges with a damage effect\'s, and clearing the effects keeps the wound\'s', () => {
  const p = page();
  p.overlay.wound({ dark: 0.9, window: 0.3, blur: 1.5, saturate: 0.5, brightness: 0.7 }, { ms: 0 });
  p.overlay.effects({ types: ['void'], strength: 0.8, crit: false, amount: 'heavy', kind: 'self', quality: 'full', impact: { x: 400, y: 400 } }, { seed: 'v' });
  p.run(200);
  const merged = p.looks.at(-1);
  assert.match(merged.filter, /blur\(1\.5px\)/);
  const sat = Number(/saturate\(([\d.]+)\)/.exec(merged.filter)?.[1]);
  assert.ok(sat < 0.5, 'void drains it further');
  p.overlay.clearEffects();
  assert.match(p.looks.at(-1).filter, /blur\(1\.5px\) saturate\(0\.5\) brightness\(0\.7\)/);
});

test('stains are drawn on their own canvas while they show in, then nothing; healing fades them and the frames end', () => {
  const p = page();
  const view = p.overlay.view();
  assert.deepEqual(view, { width: 1600, height: 900 });
  let list = stainsAfterHit([], { left: 0.2, seed: 'w', now: p.t, ...view, color: 0x7a0d0d });
  p.overlay.stains(list);
  const canvas = p.byId('animater-lens-stains');
  assert.ok(canvas, 'a canvas of its own');
  assert.match(canvas.style.cssText, /mix-blend-mode:multiply/);
  assert.equal(p.overlay.stainCount, 2);
  p.settle();
  assert.ok(canvas.ctx.drawn.length > 0, 'drawn');
  assert.equal(p.frames, 0, 'still: no frames');
  // Healed: they fade, frames run while they do, then stop.
  list = settleStains(list, { left: 0.9, now: p.t });
  p.overlay.stains(list);
  const n = p.settle();
  assert.ok(n * 16 >= WOUNDED.stainFadeMs, 'drawn through the fade');
  assert.equal(p.frames, 0);
  p.overlay.stains([]);
  p.overlay.clear();
  assert.equal(p.overlay.stainCount, 0);
});

test('a heartbeat pulse beats the red edges; a flash for waking; both cancelled on clear', () => {
  const p = page();
  assert.equal(p.overlay.pulse(0.6), false, 'nothing to beat without red edges');
  p.overlay.wound({ edge: 0.7 }, { ms: 0 });
  assert.equal(p.overlay.pulse(0.6), true);
  const pulse = p.byId('animater-lens-pulse');
  assert.equal(pulse.animations.length, 1);
  assert.equal(pulse.animations[0].frames[1].opacity, 0.6);
  assert.match(pulse.style.background, /radial-gradient/);
  assert.equal(p.overlay.flash(0.3, 700), true);
  const flash = p.byId('animater-lens-flash');
  assert.equal(flash.animations[0].opts.duration, 700);
  assert.match(flash.style.cssText, /mix-blend-mode:screen/);
  p.overlay.clear();
  assert.equal(pulse.getAnimations().length, 0);
  assert.equal(flash.getAnimations().length, 0);
  assert.equal(p.frames, 0);
});
