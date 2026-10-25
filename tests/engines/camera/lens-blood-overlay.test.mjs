import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLensBloodOverlay } from '../../../scripts/engines/camera/lens-blood-draw.mjs';
import { paintReply } from '../../../scripts/engines/camera/lens-blood-paint.mjs';

// A 2D context that records the images it draws.
function context(canvas) {
  const drawn = [];
  const ctx = new Proxy({ canvas, drawn }, {
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
  return ctx;
}
const makeCanvas = (width = 1, height = 1) => { const c = { width, height, style: {}, isConnected: true }; const g = context(c); c.getContext = () => g; return c; };

// A page: one canvas element for the overlay, frames run by hand, the clock set by hand; Worker as given.
function page({ Worker } = {}) {
  let el = null, frames = [], t = 1000;
  const doc = {
    createElement: () => (el ? makeCanvas() : (el = makeCanvas())),
    getElementById: () => null,
    body: { append() {} },
  };
  const win = { innerWidth: 1600, innerHeight: 900, devicePixelRatio: 1, Worker,
    requestAnimationFrame: (cb) => { frames.push(cb); return frames.length; }, cancelAnimationFrame: () => { frames = []; } };
  const overlay = createLensBloodOverlay({ doc, win, now: () => t });
  return {
    overlay,
    frame(ms = 16) { t += ms; const run = frames; frames = []; for (const f of run) f(); return el.getContext('2d').drawn.splice(0); },
    get running() { return frames.length > 0; },
  };
}

// A worker that keeps what it is sent and answers when told, painting for real on recording canvases.
function fakeWorker({ supported = true } = {}) {
  const made = [];
  class FakeWorker {
    constructor(url, opts) {
      this.url = String(url); this.opts = opts; this.posts = []; this.terminated = false;
      made.push(this);
      queueMicrotask(() => this.onmessage?.({ data: { type: supported ? 'ready' : 'unsupported' } }));
    }
    postMessage(msg) { this.posts.push(structuredClone(msg)); }
    terminate() { this.terminated = true; }
    // Answers the first n waiting requests (all by default); answers the bitmaps sent.
    answer(n = Infinity) {
      const out = [];
      for (const msg of this.posts.splice(0, n)) {
        const { reply } = paintReply(msg, makeCanvas, (c) => ({ bitmap: true, width: c.width, height: c.height, closed: false, close() { this.closed = true; } }));
        out.push(reply);
        this.onmessage?.({ data: reply });
      }
      return out;
    }
  }
  return { FakeWorker, made };
}
const SPLASH = { kind: 'self', strength: 0.99, amount: 'heavy', tunnel: 0 };
const bitmapsIn = (drawn) => drawn.filter((d) => d?.bitmap);
const bitmapsOf = (replies) => replies.flatMap((r) => [r.image, r.glint].filter(Boolean));

test('splats are painted in a module worker and drawn only once their bitmaps arrive', async () => {
  const { FakeWorker, made } = fakeWorker();
  const p = page({ Worker: FakeWorker });
  const added = p.overlay.splash(SPLASH, { seed: 'w' });
  assert.ok(added >= 4);
  assert.equal(made.length, 0, 'created lazily');
  let drawn = p.frame();
  assert.equal(made.length, 1);
  const w = made[0];
  assert.match(w.url, /lens-blood-paint-worker\.mjs$/);
  assert.deepEqual(w.opts, { type: 'module' });
  // Each splat: its wet look now, its dried one ahead of time (wet ones first).
  assert.equal(w.posts.length, added * 2);
  assert.deepEqual(w.posts.map((m) => m.dried), [...Array(added).fill(false), ...Array(added).fill(true)]);
  assert.ok(w.posts.every((m) => m.dev === 1 && typeof m.id === 'number' && m.splat.r > 0));
  assert.equal(bitmapsIn(drawn).length, 0, 'nothing drawn before it arrives');
  await null;
  const first = w.answer(2);
  drawn = p.frame(200);
  const shown = bitmapsIn(drawn);
  assert.ok(shown.length >= 2 && shown.length <= 4, `two splats' bitmaps (and glints): ${shown.length}`);
  assert.ok(shown.every((b) => bitmapsOf(first).includes(b)));
  w.answer();
  drawn = p.frame(16);
  assert.ok(bitmapsIn(drawn).length >= added, 'all of them once all arrived');
  assert.equal(w.posts.length, 0, 'asked once per look');
  p.frame(16);
  assert.equal(w.posts.length, 0);
  assert.equal(made.length, 1, 'one worker');
});

test('bitmaps are closed when their splat dies, on clear, and when they arrive too late', async () => {
  const { FakeWorker, made } = fakeWorker();
  const p = page({ Worker: FakeWorker });
  p.overlay.splash(SPLASH, { seed: 'c' });
  p.frame();
  const w = made[0];
  const all = bitmapsOf(w.answer());
  p.frame(100);
  assert.ok(all.every((b) => !b.closed));
  // Run to the end: every splat dies, its bitmaps are closed.
  for (let i = 0; i < 2000 && p.running; i++) p.frame(50);
  assert.equal(p.running, false);
  assert.ok(all.every((b) => b.closed), 'closed as their splats died');
  // Cleared with requests in flight: what is drawn is closed, late replies are closed and never drawn.
  p.overlay.splash(SPLASH, { seed: 'd' });
  p.frame();
  const early = bitmapsOf(w.answer(3));
  p.frame(100);
  p.overlay.clear();
  assert.ok(early.every((b) => b.closed), 'closed on clear');
  assert.deepEqual(w.posts.at(-1), { type: 'clear' }, 'the worker drops what it still has queued');
  w.posts.pop();
  const late = bitmapsOf(w.answer());
  assert.ok(late.length > 0 && late.every((b) => b.closed), 'late replies closed');
  p.overlay.splash(SPLASH, { seed: 'e' });
  const drawn = p.frame();
  assert.ok(bitmapsIn(drawn).every((b) => !late.includes(b) && !early.includes(b)));
  await null;
});

test('without Worker the splats are painted on this thread within the per-frame budget', () => {
  const p = page({ Worker: undefined });
  p.overlay.splash(SPLASH, { seed: 'n' });
  const drawn = p.frame();
  assert.ok(drawn.filter((d) => d === 'fill').length >= 2, 'painted and drawn here (flat: no canvas in node)');
  assert.equal(bitmapsIn(drawn).length, 0);
});

test('a worker without OffscreenCanvas, or one that errors, hands painting back to this thread', async () => {
  for (const how of ['unsupported', 'error', 'throws']) {
    const { FakeWorker, made } = fakeWorker({ supported: how !== 'unsupported' });
    const Worker = how === 'throws' ? class { constructor() { throw new Error('no module workers'); } } : FakeWorker;
    const p = page({ Worker });
    p.overlay.splash(SPLASH, { seed: how });
    let drawn = p.frame();
    if (how !== 'throws') {
      assert.equal(drawn.filter((d) => d === 'fill').length, 0, `${how}: no splat before the worker answers`);
      await null;
      if (how === 'error') made[0].onerror?.({ message: 'boom' });
      assert.equal(made[0].terminated, true, `${how}: worker dropped`);
    }
    drawn = p.frame();
    assert.ok(drawn.filter((d) => d === 'fill').length >= 2, `${how}: painted here now`);
    const posts = made[0]?.posts.length ?? 0;
    p.frame();
    assert.equal(made[0]?.posts.length ?? 0, posts, `${how}: no more requests`);
  }
});

// A page that keeps every element it makes (in DOM order after the board) and every call on their contexts.
function domPage({ Worker, board = true } = {}) {
  const els = [], order = [];
  let frames = [], t = 1000;
  const canvasEl = () => {
    const c = { width: 1, height: 1, style: {}, isConnected: true, calls: [] };
    const drawn = [];
    const ctx = new Proxy({ canvas: c, drawn }, {
      get(target, key) {
        if (key in target) return target[key];
        if (key === 'createRadialGradient' || key === 'createLinearGradient') return () => ({ addColorStop() {} });
        if (key === 'getTransform') return () => ({ a: 1, b: 0 });
        return (...a) => { c.calls.push([key, ...a]); if (key === 'drawImage') drawn.push(a[0]); if (key === 'fill') drawn.push('fill'); };
      },
      set(target, key, value) { target[key] = value; return true; },
    });
    c.getContext = () => ctx;
    c.after = (...n) => { order.splice(order.indexOf(c) + 1, 0, ...n); };
    c.remove = () => { c.isConnected = false; };
    return c;
  };
  const boardEl = { after: (...n) => { order.unshift(...n); } };
  const doc = {
    createElement: () => { const c = canvasEl(); els.push(c); return c; },
    getElementById: (id) => (board && id === 'board' ? boardEl : null),
    body: { append: (...n) => order.push(...n) },
  };
  const win = { innerWidth: 1600, innerHeight: 900, devicePixelRatio: 2, Worker,
    requestAnimationFrame: (cb) => { frames.push(cb); return frames.length; }, cancelAnimationFrame: () => { frames = []; } };
  const overlay = createLensBloodOverlay({ doc, win, now: () => t, area: () => ({ x: 0, y: 0, w: 1200, h: 900 }) });
  return { overlay, els, order, frame(ms = 16) { t += ms; const run = frames; frames = []; for (const f of run) f(); } };
}

test('the shine has its own canvas: normal blending, right above the multiplied one, same place and size', () => {
  for (const board of [true, false]) {
    const p = domPage({ Worker: undefined, board });
    p.overlay.splash(SPLASH, { seed: 'two' });
    p.frame();
    assert.equal(p.els.length, 2, 'two canvases');
    const [blood, shine] = p.els;
    assert.equal(blood.id, 'animater-lens-blood');
    assert.equal(shine.id, 'animater-lens-blood-glint');
    assert.match(blood.style.cssText, /mix-blend-mode:multiply/);
    assert.match(shine.style.cssText, /mix-blend-mode:normal/);
    for (const el of [blood, shine]) assert.match(el.style.cssText, /pointer-events:none/);
    assert.deepEqual(p.order, [blood, shine], `${board ? 'after the board' : 'in the body'}: the shine stacked right above the blood`);
    for (const k of ['left', 'top', 'width', 'height']) assert.equal(shine.style[k], blood.style[k], k);
    assert.equal(blood.style.width, '1200px');
    assert.deepEqual([shine.width, shine.height], [blood.width, blood.height]);
    assert.deepEqual([blood.width, blood.height], [2400, 1800], 'device pixels');
  }
});

test('glints go on the shine canvas, not the multiplied one (worker and main-thread paths)', async () => {
  const { FakeWorker, made } = fakeWorker();
  const p = domPage({ Worker: FakeWorker });
  p.overlay.splash(SPLASH, { seed: 'g' });
  p.frame();
  await null;
  const replies = made[0].answer();
  const [blood, shine] = p.els;
  blood.getContext('2d').drawn.length = 0;
  p.frame(200);
  const glints = replies.map((r) => r.glint).filter(Boolean), images = replies.map((r) => r.image);
  assert.ok(glints.length > 0, 'some splats carry a glint');
  const onBlood = blood.getContext('2d').drawn, onShine = shine.getContext('2d').drawn;
  assert.ok(onShine.some((b) => glints.includes(b)), 'glints on the shine canvas');
  assert.ok(!onBlood.some((b) => glints.includes(b)), 'none on the multiplied canvas');
  assert.ok(onBlood.some((b) => images.includes(b)) && !onShine.some((b) => images.includes(b)), 'blood on the multiplied one only');
  // Each frame starts both clean.
  assert.ok(shine.calls.some(([k]) => k === 'clearRect'));
  // Main thread, flat (no canvas in node): the flat glint is filled on the shine canvas.
  const q = domPage({ Worker: undefined });
  q.overlay.splash(SPLASH, { seed: 'g' });
  q.frame(100);
  assert.ok(q.els[1].getContext('2d').drawn.includes('fill'), 'flat glints on the shine canvas');
});

test('clear() wipes the shine canvas too, and a frame redraws nothing after it', () => {
  const p = domPage({ Worker: undefined });
  p.overlay.splash(SPLASH, { seed: 'clr' });
  p.frame();
  const [, shine] = p.els;
  shine.calls.length = 0;
  p.overlay.clear();
  const wipe = shine.calls.find(([k]) => k === 'clearRect');
  assert.ok(wipe, 'shine cleared');
  assert.deepEqual(wipe.slice(1), [0, 0, shine.width, shine.height], 'all of it, in device pixels');
  assert.equal(p.overlay.alive, 0);
  shine.calls.length = 0;
  p.frame();
  assert.equal(shine.calls.length, 0, 'no frame runs after clear');
});
