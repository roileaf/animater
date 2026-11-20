// The painted walls on the map: one picture a run (wall-paint.mjs paints it, wall-looks.mjs says where and of what),
// laid down as a sprite over the ground and under everything that walks on it.
//
// A big map has hundreds of wall segments, and painting them all in one go holds the frame for as long as it takes.
// So nothing is painted in populate(): the runs go into a queue, and step() paints a few at a time, oldest first,
// until the queue is empty. A scene that is torn down mid-queue simply drops the rest.

import { paintRunPicture, runSeed } from './wall-paint.mjs';

export const PAINT_PER_STEP = 2;      // runs painted per tick: enough to fill a map in a second or two, small enough not to stutter
export const PICTURE_MOST = 2048;     // the biggest a run's picture may be on a side

export function createPaintedWalls({ PIXI, root, grid = () => 100, make = undefined, render = null } = {}) {
  const art = new Map(); // key -> { sprite, texture, run }
  let queue = [], look = {}, alpha = 1;

  const host = () => { try { return root?.(); } catch { return null; } };

  const dropOne = (key) => {
    const had = art.get(key);
    if (!had) return;
    art.delete(key);
    try { had.sprite.parent?.removeChild(had.sprite); had.sprite.destroy(); } catch { /* gone with the canvas */ }
    try { had.texture?.destroy(true); } catch { /* gone with the canvas */ }
  };

  const drop = () => { queue = []; for (const key of [...art.keys()]) dropOne(key); };

  /** Paint one run and put it on the map. Returns false when it could not be painted at all. */
  const paint = (run) => {
    const where = host();
    if (!where || !PIXI?.Sprite || !PIXI?.Texture) return false;
    // The scene's weather, with whatever this run says for itself over it: the years on a wall were chosen when it
    // was laid, so one ruin can stand among walls that are kept.
    const wear = { ...look, ...(run.look ?? {}) };
    const picture = paintRunPicture(run.points, run.material, {
      grid: grid(), seed: runSeed(run.key), join: run.join ?? null, thick: run.thick, closed: run.closed === true, lit: wear.lit ?? null, tint: run.tint ?? null,
      snow: wear.snow ?? 0, moss: wear.moss ?? 0, soot: wear.soot ?? 0, ruin: wear.ruin ?? 0,
    }, make, PICTURE_MOST);
    if (!picture) return false;
    dropOne(run.key);
    let texture = null;
    try { texture = PIXI.Texture.from(picture.canvas); } catch { return false; }
    const sprite = new PIXI.Sprite(texture);
    sprite.eventMode = 'none';
    sprite.position.set(picture.box.x, picture.box.y);
    sprite.width = picture.box.w;
    sprite.height = picture.box.h;
    sprite.alpha = alpha;
    where.addChild(sprite);
    art.set(run.key, { sprite, texture, run });
    // The new picture is up, so the one it replaces can come down. Only now, and only the one it replaces.
    for (const [key, held] of [...art]) if (key !== run.key && held.old === true && (held.run?.id ?? key) === (run.id ?? run.key)) dropOne(key);
    return true;
  };

  return {
    /**
     * The runs this scene should show. Anything already painted and unchanged is left where it is — a GM dragging one
     * wall does not repaint the other two hundred.
     */
    populate({ runs = [], look: weather = {} } = {}) {
      const want = new Map(runs.map((r) => [r.key, r]));
      const same = JSON.stringify(weather) === JSON.stringify(look);
      look = { ...weather };
      // A run that is being painted again keeps the picture it has until the new one is up. Taking it down first
      // left a hole in the map for as long as the queue took to reach it, and since the sun is part of how a wall
      // is painted, every step of the sun blinked the lot (Roi: "when moving the sun it removes the roof while it
      // redraws it"). What is really gone — a wall rubbed out — has nothing coming and goes at once.
      const coming = new Set(runs.map((r) => r.id ?? r.key));
      for (const [key, held] of [...art]) {
        if (same && want.has(key)) continue;
        if (coming.has(held.run?.id ?? key)) held.old = true;
        else dropOne(key);
      }
      queue = runs.filter((r) => !art.has(r.key) || art.get(r.key)?.old === true);
      return queue.length;
    },
    /** Paint the next few runs. Call it from a tick; it returns how many are still waiting. */
    step(budget = PAINT_PER_STEP) {
      for (let i = 0; i < budget && queue.length; i++) { const run = queue.shift(); if (!paint(run) && !host()) { queue.unshift(run); break; } }
      return queue.length;
    },
    /** Paint everything now. For a small map, a test, or a GM who has just turned the feature on and wants to see it. */
    settle(most = 500) { let n = 0; while (queue.length && n++ < most) this.step(1); return queue.length; },
    fade(to = 1) { alpha = Math.max(0, Math.min(1, to)); for (const { sprite } of art.values()) sprite.alpha = alpha; },
    drop,
    get state() { return { painted: art.size, waiting: queue.length, alpha, keys: [...art.keys()] }; },
  };
}
