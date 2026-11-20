// The painted windows on the map: the opening, and the leaves hanging in it (window-paint.mjs paints them,
// wall-looks.mjs finds the windows).
//
// Built the way the doors are, and for the same reason. A window used to be one picture that was painted again
// whenever it opened, with the open one swapped for a bare frame — so every opened window looked alike, whatever it
// had been. Now the opening is painted once and left alone, and what fills it is leaves: a casement pair turning on
// its hinges at either end, or curtains drawn aside along the wall. They move; nothing is repainted to make them.

import { paintWindowFrame, paintWindowLeaf, windowFor, WINDOW_ART, WINDOW_MOTION, WINDOW_SWING, WINDOW_DRAW_ASIDE } from './window-paint.mjs';
import { LIT } from './wall-paint.mjs';

/** How long a window takes to open, in seconds. A touch quicker than a door: it is lighter. */
export const OPEN_TIME = 0.95;

const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

export function createPaintedWindows({ PIXI, root, grid = () => 100, make = undefined } = {}) {
  const art = new Map(); // key -> { frame, leaves: [{ sprite, at: {x,y}, turn, way }], window, kind, at, want, shape }
  let queue = [];

  const host = () => { try { return root?.(); } catch { return null; } };
  /** What the PICTURES depend on. Opening it is not one of them any more: that is the leaves moving. */
  const shapeOf = (w) => `${w.key}|${w.slats ? 1 : 0}`;

  const dropOne = (key) => {
    const had = art.get(key);
    if (!had) return;
    art.delete(key);
    for (const part of [had.frame, ...had.leaves.map((l) => l.sprite)]) {
      if (!part) continue;
      try { part.parent?.removeChild(part); part.destroy(); } catch { /* gone with the canvas */ }
    }
    for (const texture of had.textures ?? []) { try { texture?.destroy(true); } catch { /* gone with the canvas */ } }
  };
  const drop = () => { queue = []; for (const key of [...art.keys()]) dropOne(key); };

  /** Where a leaf stands, for `t` of the way open: turned on its hinge, or drawn aside along the wall. */
  const place = (held, leaf, t) => {
    const { motion } = WINDOW_MOTION[held.kind] ?? { motion: 'none' };
    const w = held.window, turn = leaf.turn;
    if (motion === 'slide') {
      // Curtains do not swing: they gather toward their own end of the opening.
      const by = leaf.length * WINDOW_DRAW_ASIDE * t;
      leaf.sprite.position.set(leaf.at[0] + Math.cos(turn) * -by, leaf.at[1] + Math.sin(turn) * -by);
      leaf.sprite.rotation = turn;
      leaf.sprite.scale.set(Math.max(0.3, 1 - t * 0.55), 1);
      return;
    }
    leaf.sprite.position.set(leaf.at[0], leaf.at[1]);
    leaf.sprite.rotation = turn + leaf.way * w.way * WINDOW_SWING * t;
  };

  const hang = (window) => {
    const where = host();
    if (!where || !PIXI?.Sprite || !PIXI?.Texture) return false;
    const kind = WINDOW_ART[window.kind] ? window.kind : windowFor(window.material);
    // A wall's thickness is measured from its middle out, a window's across the whole opening, so the one is twice
    // the other: set into a wall drawn 0.17 thick, a window was coming out half the wall's width.
    const look = { grid: grid(), thick: window.thick > 0 ? window.thick * 2 : undefined, seed: window.id?.length ?? 4, slats: window.slats };
    const frameArt = paintWindowFrame(kind, window.length, look, make);
    if (!frameArt) return false;
    dropOne(window.key);
    const textures = [], parts = WINDOW_MOTION[kind]?.parts ?? 0;
    // The pictures are painted bigger than they are laid, so each sprite is told the size it belongs at on the map.
    const sprite = (art) => {
      const texture = PIXI.Texture.from(art.canvas); textures.push(texture);
      const s = new PIXI.Sprite(texture); s.eventMode = 'none';
      const box = art.box ?? { w: art.canvas.width, h: art.canvas.height };
      s.width = box.w; s.height = box.h;
      where.addChild(s); return s;
    };
    // A painted wall's top is drawn lifted off the line it runs along, so an opening set into it is lifted too, or
    // it sits half out of the stone it is cut from.
    const lit = Array.isArray(window.lit) && window.lit.length === 2 ? window.lit : LIT;
    const up = grid() * (window.lift ?? 0);
    const lifted = (p) => [p[0] + lit[0] * up, p[1] + lit[1] * up];
    let frame = null;
    try {
      frame = sprite(frameArt);
      frame.anchor.set(0.5);
      frame.position.set(...lifted(window.middle));
      frame.rotation = window.along;
    } catch { return false; }

    const leaves = [];
    if (parts > 0) {
      const each = window.length / parts;
      const leafArt = paintWindowLeaf(kind, each, look, make);
      if (leafArt) {
        const along = window.along, half = window.length / 2;
        const middle = lifted(window.middle);
        // Each leaf hangs at its own end of the opening and opens away from the other, as a casement pair does.
        for (let i = 0; i < parts; i++) {
          const way = parts === 1 ? 1 : i === 0 ? 1 : -1;
          const end = parts === 1 ? -half : i === 0 ? -half : half;
          const at = [middle[0] + Math.cos(along) * end, middle[1] + Math.sin(along) * end];
          const turn = way > 0 ? along : along + Math.PI;
          let s = null;
          try { s = sprite(leafArt); } catch { break; }
          const leafBox = leafArt.box ?? { w: leafArt.canvas.width, h: leafArt.canvas.height };
          s.anchor.set(leafArt.hinge[0] / leafBox.w, leafArt.hinge[1] / leafBox.h);
          leaves.push({ sprite: s, at, turn, way, length: each });
        }
      }
    }
    const want = window.open ? 1 : 0;
    const held = { frame, leaves, textures, window, kind, at: want, want, shape: shapeOf(window) };
    for (const leaf of leaves) place(held, leaf, want);
    art.set(window.key, held);
    return true;
  };

  return {
    /**
     * The openings this scene has. One that has not changed keeps its pictures — opening it only moves its leaves,
     * which is the whole point: nothing is painted again to open a window.
     */
    populate({ windows = [] } = {}) {
      const want = new Map(windows.map((w) => [w.key, w]));
      for (const key of [...art.keys()]) if (!want.has(key)) dropOne(key);
      for (const [key, window] of want) {
        const had = art.get(key);
        if (had && had.shape === shapeOf(window)) { had.window = window; had.want = window.open ? 1 : 0; }
      }
      queue = windows.filter((w) => art.get(w.key)?.shape !== shapeOf(w));
      return queue.length;
    },
    /** Hang the next few, and move whatever is still opening or shutting. `dt` in seconds. */
    step(dt = 0, budget = 2) {
      for (let i = 0; i < budget && queue.length; i++) { const window = queue.shift(); if (!hang(window) && !host()) { queue.unshift(window); break; } }
      for (const held of art.values()) {
        if (held.at === held.want) continue;
        const by = OPEN_TIME > 0 ? dt / OPEN_TIME : 1;
        held.at = held.want > held.at ? Math.min(held.want, held.at + by) : Math.max(held.want, held.at - by);
        const t = ease(Math.max(0, Math.min(1, held.at)));
        for (const leaf of held.leaves) place(held, leaf, t);
      }
      return queue.length;
    },
    settle(most = 200) {
      let n = 0;
      while (queue.length && n++ < most) this.step(0, 1);
      for (const held of art.values()) { held.at = held.want; for (const leaf of held.leaves) place(held, leaf, held.at); }
      return queue.length;
    },
    drop,
    get state() { return { set: art.size, waiting: queue.length, moving: [...art.values()].filter((w) => w.at !== w.want).length, leaves: [...art.values()].reduce((n, w) => n + w.leaves.length, 0), keys: [...art.keys()] }; },
  };
}
