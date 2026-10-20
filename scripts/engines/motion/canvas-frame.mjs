// Token poses run on Foundry's canvas ticker after it refreshes tokens (priority 23) and before
// it draws (-25). On a separate animation frame, a token refresh could be drawn for a frame
// in its natural pose, which flickers a lying-down (prone) token upright, and another module
// moving the same mesh from the ticker (Sequencer's motions, priority NORMAL + 1) would be the
// pose drawn every frame. Added each frame, ours runs after such a listener, so ours shows.
// Never added while the ticker is running (PIXI would call it again in the same pass, forever):
// the browser's next frame queues it, and the ticker runs it once on its following pass.
export function nextFrame(cb) {
  const h = { cb, ran: false };
  h.run = (...args) => { h.ran = true; return cb(...args); };
  h.raf = globalThis.requestAnimationFrame(() => {
    h.raf = null;
    const ticker = globalThis.canvas?.app?.ticker;
    if (!ticker) return h.run();
    h.ticker = ticker;
    ticker.addOnce(h.run, null, (globalThis.PIXI?.UPDATE_PRIORITY?.NORMAL ?? 0) + 1);
  });
  return h;
}
// Once a frame has started, PIXI removes it itself. Removing it too (a motion ending inside its
// own frame) destroys PIXI's listener twice, which unhooks its neighbour and can cut every later
// listener, Foundry's draw among them, off the ticker: the canvas freezes for good.
export function cancelFrame(h) {
  if (h?.raf) globalThis.cancelAnimationFrame(h.raf);
  if (h?.ticker && !h.ran) h.ticker.remove(h.run);
}
