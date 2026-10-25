// Lens blood's paint worker: paints splat sprites (lens-blood-paint.mjs) off the main thread on OffscreenCanvas and
// sends them back as transferred ImageBitmaps. Without OffscreenCanvas it says so and the overlay paints on the main
// thread instead.

import { paintReply } from './lens-blood-paint.mjs';

const ok = typeof OffscreenCanvas === 'function' && !!new OffscreenCanvas(1, 1).getContext?.('2d');
// A pause after each sprite (ms): painting them all in one burst leaves the GPU process (which rasterises the
// canvases, and Foundry's board too) a few dropped frames behind; paced, a heavy splash's wet looks all arrive in
// about 150 ms with none dropped. Dried looks are not needed for seconds, so they go slower still.
const PACE = 8, DRY_PACE = 16;
// A sprite takes eight layers; they are reused from one sprite to the next (resizing one clears it and resets its
// context) instead of piling up dozens of big canvases for the collector.
const pool = [], used = [];
const make = (w, h) => {
  const c = pool.pop() ?? new OffscreenCanvas(w, h);
  c.width = w;
  c.height = h;
  used.push(c);
  return c;
};
const bitmap = (c) => c.transferToImageBitmap();

const queue = [];
let busy = false;
function next() {
  const msg = queue.shift();
  if (!msg) { busy = false; return; }
  busy = true;
  try {
    // ms: how long it took to paint (for the preview page).
    const t0 = performance.now();
    const { reply, transfer } = paintReply(msg, make, bitmap);
    reply.ms = Math.round((performance.now() - t0) * 10) / 10;
    self.postMessage(reply, transfer);
  } catch (err) {
    self.postMessage({ id: msg?.id, ok: false, error: String(err?.message ?? err) });
  } finally {
    pool.push(...used.splice(0));
  }
  const wait = msg.dried ? DRY_PACE : PACE;
  if (wait > 0) setTimeout(next, wait); else next();
}

self.postMessage({ type: ok ? 'ready' : 'unsupported' });
self.onmessage = (event) => {
  if (!ok) { self.postMessage({ type: 'unsupported' }); return; }
  // The lens was cleared: what is still waiting is no longer wanted.
  if (event.data?.type === 'clear') { queue.length = 0; return; }
  queue.push(event.data);
  if (!busy) next();
};
