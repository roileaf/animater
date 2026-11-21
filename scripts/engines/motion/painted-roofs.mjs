// The painted roofs on the map: one picture a roof (roof-paint.mjs paints it, roof-looks.mjs says where and what),
// laid over the building and faded away while somebody is inside it.
//
// A roof is painted once and then only faded, because fading is all that happens to it: a roof does not change when
// you walk under it, it simply stops being in your way.

import { paintRoofPicture } from './roof-paint.mjs';
import { openingKey } from './roof-sight.mjs';

/**
 * How soft the edge of an opening is, in grid squares. A sight polygon is all straight lines and hard corners, and
 * cutting one out of a painted roof read as a torch beam shone through a ceiling. Blurred by half a square it reads
 * as the roof thinning out where you can see, which is what was wanted.
 */
export const OPEN_FEATHER = 0.2;

/** How long a roof takes to fade out or back, in seconds. Quick enough not to be waited for, slow enough to see. */
export const FADE_TIME = 0.35;
/**
 * How much of a roof is left when somebody is under it: none. A tenth of a roof still lies over the floor as a haze,
 * and what is wanted inside a house is the house, not a hint of its lid.
 */
export const FADED = 0;

export function createPaintedRoofs({ PIXI, root, grid = () => 100, make = undefined } = {}) {
  const art = new Map(); // key -> { sprite, texture, roof, at, want, box, canvas, said, cut, cutCanvas }
  let queue = [];

  const host = () => { try { return root?.(); } catch { return null; } };

  /** Put the whole roof back: the picture as it was painted, with nothing cut out of it. */
  const unmask = (held) => {
    if (!held?.cut) return;
    try { held.sprite.texture = held.texture; held.sprite.width = held.box.w; held.sprite.height = held.box.h; } catch { /* gone with the canvas */ }
    try { held.cut.destroy(true); } catch { /* gone with the canvas */ }
    held.cut = null; held.cutCanvas = null; held.said = ''; held.rubbed = undefined;
  };

  const dropOne = (key) => {
    const had = art.get(key);
    if (!had) return;
    art.delete(key);
    unmask(had);
    try { had.sprite.parent?.removeChild(had.sprite); had.sprite.destroy(); } catch { /* gone with the canvas */ }
    try { had.texture?.destroy(true); } catch { /* gone with the canvas */ }
  };

  /**
   * One roof, with what can be seen rubbed out of it, as a picture of its own for the sprite to wear.
   *
   * It is cut where the roof was painted: on a plain 2D canvas, with `destination-out`. Three other ways were
   * tried first, all of them on the graphics card — a mask on the sprite, a filter on the sprite, and rubbing the
   * opening into a texture — and all three failed in the same quiet way. The opening was provably in the texture,
   * pixel by pixel, and the map still showed an unbroken roof, because Foundry draws the map through a group of
   * its own that does not take kindly to either. On a 2D canvas there is nothing to argue with: the pixels are
   * rubbed out, the canvas is handed back to the card as a picture, and the layer stays what it always was — a
   * plain sprite wearing a plain texture.
   *
   * The blur is there because a sight polygon is all hard corners, and a hard cut read as a torch beam shone
   * through a ceiling rather than a room you can see into.
   */
  const cutOut = (held, polys) => {
    const sheet = make ?? ((w, h) => { const c = globalThis.document?.createElement?.('canvas'); if (c) { c.width = w; c.height = h; } return c; });
    const box = held.box;
    if (!held.canvas || !PIXI?.Texture?.from) return false;
    // The roof is painted bigger than it is laid, so the cut is made at the picture's own size and the map
    // measurements are brought up to it. Cutting at map size showed one corner of the picture stretched over the
    // whole roof the moment a door was opened.
    const k = Math.max(1, (held.canvas.width || 1) / Math.max(1, box.w));
    const w = Math.max(1, Math.ceil(box.w * k)), h = Math.max(1, Math.ceil(box.h * k));
    try {
      if (!held.cutCanvas || held.cutCanvas.width !== w || held.cutCanvas.height !== h) {
        held.cutCanvas = sheet(w, h);
        held.rubbed = undefined; // a canvas with no roof on it yet has to be laid whole
        if (held.cut) { try { held.cut.destroy(true); } catch { /* gone with the picture */ } held.cut = null; }
      }
      const g = held.cutCanvas?.getContext?.('2d');
      if (!g) return false;
      const soft = Math.max(1, Math.round(grid() * OPEN_FEATHER * k));
      // Only the ground somebody has just walked past changes. Putting the whole roof back and cutting it again
      // every time anybody took a step cost a quarter of the frame on one house, and a town has more than one, so
      // what is put back is the stretch the old opening and the new one lie in, and nothing else. The margin is
      // the blur's own reach, which spreads a cut well past the shape that made it.
      const edge = soft * 3;
      let fresh = null;
      for (const poly of polys) {
        if (poly.length < 6) continue;
        for (let i = 0; i + 1 < poly.length; i += 2) {
          const x = (poly[i] - box.x) * k, y = (poly[i + 1] - box.y) * k;
          if (!fresh) fresh = { x0: x, y0: y, x1: x, y1: y };
          else { if (x < fresh.x0) fresh.x0 = x; if (x > fresh.x1) fresh.x1 = x; if (y < fresh.y0) fresh.y0 = y; if (y > fresh.y1) fresh.y1 = y; }
        }
      }
      const wider = fresh ? { x0: fresh.x0 - edge, y0: fresh.y0 - edge, x1: fresh.x1 + edge, y1: fresh.y1 + edge } : null;
      const was = held.rubbed ?? null;
      const both = !wider ? was : !was ? wider
        : { x0: Math.min(was.x0, wider.x0), y0: Math.min(was.y0, wider.y0), x1: Math.max(was.x1, wider.x1), y1: Math.max(was.y1, wider.y1) };
      // A fresh canvas has no roof on it yet, and a stretch that is most of the roof anyway is quicker laid whole.
      const whole = fresh === null || held.rubbed === undefined || !both
        || (both.x1 - both.x0) * (both.y1 - both.y0) > w * h * 0.6;
      const put = whole ? { x: 0, y: 0, w, h } : {
        x: Math.max(0, Math.floor(both.x0)), y: Math.max(0, Math.floor(both.y0)),
        w: Math.min(w, Math.ceil(both.x1)) - Math.max(0, Math.floor(both.x0)),
        h: Math.min(h, Math.ceil(both.y1)) - Math.max(0, Math.floor(both.y0)),
      };
      if (put.w > 0 && put.h > 0) {
        g.clearRect(put.x, put.y, put.w, put.h);
        g.drawImage(held.canvas, put.x, put.y, put.w, put.h, put.x, put.y, put.w, put.h);
      }
      g.save();
      g.globalCompositeOperation = 'destination-out';
      // Two creatures in one room see overlapping shapes, and rubbing out is the one way of putting holes in
      // something that does not mind them overlapping. Rubbing one that was never put back costs nothing: what is
      // already gone cannot go twice.
      g.filter = `blur(${soft}px)`;
      g.fillStyle = '#000';
      for (const poly of polys) {
        if (poly.length < 6) continue;
        g.beginPath();
        g.moveTo((poly[0] - box.x) * k, (poly[1] - box.y) * k);
        for (let i = 2; i + 1 < poly.length; i += 2) g.lineTo((poly[i] - box.x) * k, (poly[i + 1] - box.y) * k);
        g.closePath();
        g.fill();
      }
      g.restore();
      held.rubbed = wider;
      if (held.cut) { try { held.cut.update(); } catch { /* it will be made again below */ } }
      if (!held.cut) held.cut = PIXI.Texture.from(held.cutCanvas);
      held.sprite.texture = held.cut;
      // A sprite keeps the scale it was given, so a texture of another size has to be laid again at the roof's size.
      held.sprite.width = box.w; held.sprite.height = box.h;
      return true;
    } catch { return false; }
  };
  const drop = () => { queue = []; for (const key of [...art.keys()]) dropOne(key); };

  const lay = (roof, look) => {
    const where = host();
    if (!where || !PIXI?.Sprite || !PIXI?.Texture) return false;
    const picture = paintRoofPicture(roof.room, roof.kind, {
      grid: grid(), seed: roof.id?.length ?? 9, form: roof.form, high: roof.high, lit: look.lit ?? null, tint: roof.tint ?? null,
      // Only a building the GM dressed puts anything up, and only on a day the calendar calls a feast.
      dressing: roof.dressed ? (look.dressing ?? null) : null,
      chimney: roof.chimney, chimneyAt: roof.chimneyAt,
      snow: look.snow ?? 0, moss: look.moss ?? 0, soot: look.soot ?? 0, wet: look.wet ?? 0, leaves: look.leaves ?? 0,
      // How far the roof's own painted shadow reaches: nought while the sun casts the building's shadow for it.
      // (Left off this list, the caller's "off" never arrived and the house kept two shadows.)
      shadowReach: look.shadowReach,
    }, make);
    if (!picture) return false;
    dropOne(roof.key);
    let texture = null;
    try { texture = PIXI.Texture.from(picture.canvas); } catch { return false; }
    const sprite = new PIXI.Sprite(texture);
    sprite.eventMode = 'none';
    sprite.position.set(picture.box.x, picture.box.y);
    sprite.width = picture.box.w;
    sprite.height = picture.box.h;
    sprite.alpha = 1;
    where.addChild(sprite);
    // The painted canvas is kept, not just the texture made from it: an opening is cut out of a copy of it.
    art.set(roof.key, { sprite, texture, roof, chimney: picture.chimney, at: 1, want: 1, box: picture.box, canvas: picture.canvas, said: '', cut: null, cutCanvas: null });
    // The new picture is up, so the one it replaces can come down — and it hands over how far it had faded, or a
    // roof somebody is standing under would snap back to solid as the sun moved.
    for (const [key, held] of [...art]) {
      if (key === roof.key || held.old !== true || held.roof?.id !== roof.id) continue;
      const now = art.get(roof.key);
      now.at = held.at; now.want = held.want; now.sprite.alpha = held.at;
      dropOne(key);
    }
    return true;
  };

  return {
    /** The roofs this scene has. One unchanged keeps its picture, and keeps however far it had faded. */
    populate({ roofs = [], look = {} } = {}) {
      const want = new Map(roofs.map((r) => [r.key, r]));
      // A roof being painted again keeps the picture it has until the new one is up. Taken down first, it left a
      // hole over the building for as long as the queue took to reach it, and since the sun is part of how a roof
      // is painted, every step of the sun blinked it away and back (Roi: "when moving the sun it removes the roof
      // while it redraws it"). A roof really taken off has nothing coming, and goes at once.
      const coming = new Set(roofs.map((r) => r.id));
      for (const [key, held] of [...art]) {
        if (want.has(key)) continue;
        if (coming.has(held.roof?.id)) held.old = true;
        else dropOne(key);
      }
      queue = roofs.filter((r) => !art.has(r.key)).map((r) => ({ roof: r, look }));
      return queue.length;
    },
    /** Which roofs are being stood under: their keys. Everything else comes back. */
    cover(keys = []) {
      const inside = new Set(keys);
      for (const [key, held] of art) held.want = inside.has(key) ? FADED : 1;
    },
    /**
     * What can be seen under each roof: its key against the polygons roof-sight.mjs cut for it. A roof with
     * openings stays fully painted and is masked instead, so the rooms nobody has looked into keep their lid.
     * A roof not named here loses its mask and goes back to fading as a whole, which is what happens on a scene
     * with no vision to go by.
     */
    open(byKey = new Map()) {
      const asked = byKey instanceof Map ? byKey : new Map(Object.entries(byKey ?? {}));
      for (const [key, held] of art) {
        const polys = asked.get(key) ?? [];
        const said = openingKey(polys);
        // The roof a mask is cut in stays whole: the mask is what lets the room show through, and a roof both
        // masked and faded would be gone twice over. This is settled before the shortcut below, because cover()
        // runs first and will have asked for a fade.
        if (held.cut || polys.length) held.want = 1;
        if (said === held.said) continue;
        if (!polys.length) { unmask(held); continue; }
        if (cutOut(held, polys)) held.said = said;
        else { unmask(held); held.want = FADED; } // no renderer to cut with, so fall back to lifting the lid
      }
    },
    /** Lay the next few, and move whatever is still fading. `dt` in seconds. */
    step(dt = 0, budget = 1) {
      // A roof's own look wins over the scene's: its years are its own.
      for (let i = 0; i < budget && queue.length; i++) { const next = queue.shift(); if (!lay(next.roof, next.roof.look ?? next.look ?? {}) && !host()) { queue.unshift(next); break; } }
      for (const held of art.values()) {
        if (held.at === held.want) continue;
        const by = FADE_TIME > 0 ? dt / FADE_TIME : 1;
        held.at = held.want > held.at ? Math.min(held.want, held.at + by) : Math.max(held.want, held.at - by);
        held.sprite.alpha = held.at;
      }
      return queue.length;
    },
    settle(most = 120) { let n = 0; while (queue.length && n++ < most) this.step(0, 1); for (const held of art.values()) { held.at = held.want; held.sprite.alpha = held.at; } return queue.length; },
    /** Where each roof's smoke rises from, for the scene's own chimney smoke. */
    get chimneys() { return [...art.values()].filter((h) => h.chimney).map((h) => ({ id: h.roof.id, at: h.chimney })); },
    drop,
    get state() { return { laid: art.size, waiting: queue.length, fading: [...art.values()].filter((r) => r.at !== r.want).length, opened: [...art.values()].filter((r) => r.cut).length, keys: [...art.keys()] }; },
  };
}
