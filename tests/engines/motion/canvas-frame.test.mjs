import test from "node:test";
import assert from "node:assert/strict";
import { nextFrame, cancelFrame } from "../../../scripts/engines/motion/canvas-frame.mjs";

// PIXI 7.4.3's ticker list, as Foundry 14 ships it: destroy() has no guard against running twice.
class Listener {
  constructor(fn, context = null, priority = 0, once = false) { Object.assign(this, { fn, context, priority, once, next: null, previous: null, _destroyed: false }); }
  match(fn, context = null) { return this.fn === fn && this.context === context; }
  emit(dt) {
    if (this.fn) this.context ? this.fn.call(this.context, dt) : this.fn(dt);
    const next = this.next;
    if (this.once) this.destroy(true);
    if (this._destroyed) this.next = null;
    return next;
  }
  connect(previous) { this.previous = previous; if (previous.next) previous.next.previous = this; this.next = previous.next; previous.next = this; }
  destroy(hard = false) {
    this._destroyed = true; this.fn = null; this.context = null;
    if (this.previous) this.previous.next = this.next;
    if (this.next) this.next.previous = this.previous;
    const next = this.next;
    this.next = hard ? null : next; this.previous = null;
    return next;
  }
}
class Ticker {
  _head = new Listener(null, null, Infinity);
  add(fn, context, priority = 0) { return this._add(new Listener(fn, context, priority)); }
  addOnce(fn, context, priority = 0) { return this._add(new Listener(fn, context, priority, true)); }
  _add(listener) {
    let current = this._head.next, previous = this._head;
    if (!current) listener.connect(previous);
    else {
      while (current) { if (listener.priority > current.priority) { listener.connect(previous); break; } previous = current; current = current.next; }
      if (!listener.previous) listener.connect(previous);
    }
    return this;
  }
  remove(fn, context) { let l = this._head.next; while (l) l = l.match(fn, context) ? l.destroy() : l.next; return this; }
  update() { let l = this._head.next; while (l) l = l.emit(1); }
}

function scene() {
  const ticker = new Ticker(), frames = new Map();
  let renders = 0, id = 0;
  ticker.add(() => renders++, null, -25); // Foundry draws the canvas here.
  globalThis.canvas = { app: { ticker } };
  globalThis.requestAnimationFrame = (cb) => (frames.set(++id, cb), id);
  globalThis.cancelAnimationFrame = (handle) => frames.delete(handle);
  const browserFrame = () => { const due = [...frames.values()]; frames.clear(); due.forEach((cb) => cb()); ticker.update(); };
  return { ticker, browserFrame, renders: () => renders };
}

test("a frame cancelled from inside its own callback never cuts the canvas draw off", () => {
  const { browserFrame, renders } = scene();
  // Two motions ending in the same pass (a caster's pulse and a target's shake, a dying token's pose).
  const a = nextFrame(() => cancelFrame(a));
  const b = nextFrame(() => cancelFrame(b));
  browserFrame();
  browserFrame();
  browserFrame();
  assert.equal(renders(), 3, "the canvas draws every frame");
});

test("a frame cancelled before it runs never runs", () => {
  const { browserFrame } = scene();
  let ran = 0;
  const h = nextFrame(() => ran++);
  browserFrame(); // queued for the ticker's next pass
  const h2 = nextFrame(() => ran++);
  cancelFrame(h2);
  browserFrame();
  assert.equal(ran, 1);
  cancelFrame(h);
});
