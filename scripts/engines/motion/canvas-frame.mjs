// Token poses run on Foundry's canvas ticker after it refreshes tokens (priority 23) and before
// it draws (-25). On a separate animation frame, a token refresh could be drawn for a frame
// in its natural pose, which flickers a lying-down (prone) token upright, and another module
// moving the same mesh from the ticker (Sequencer's motions, priority NORMAL + 1) would be the
// pose drawn every frame. Added each frame, ours runs after such a listener, so ours shows.
// Never added while the ticker is running (PIXI would call it again in the same pass, forever):
// the browser's next frame queues it, and the ticker runs it once on its following pass.
export function nextFrame(cb) {
  const h = { cb };
  h.raf = globalThis.requestAnimationFrame(() => {
    h.raf = null;
    const ticker = globalThis.canvas?.app?.ticker;
    if (!ticker) return cb();
    h.ticker = ticker;
    ticker.addOnce(cb, null, (globalThis.PIXI?.UPDATE_PRIORITY?.NORMAL ?? 0) + 1);
  });
  return h;
}
export function cancelFrame(h) { if (h?.raf) globalThis.cancelAnimationFrame(h.raf); if (h?.ticker) h.ticker.remove(h.cb); }
