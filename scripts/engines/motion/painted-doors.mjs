// The painted doors on the map: one leaf a doorway (door-paint.mjs paints it, wall-looks.mjs finds them), hung at its
// hinge and turned as the door opens.
//
// The leaf is painted once, straight, and then turned — not painted again at every angle. So opening a door costs a
// rotation, which is why it can swing rather than snap: a door that jumped from shut to open would look like a
// sprite being swapped, which is what it would be.

import { paintDoorLeaf, DOOR_SWING, doorFor, doorHangs, DOOR_KINDS } from './door-paint.mjs';

/**
 * How long a door takes to swing, in seconds. A heavy door, not a saloon door — half a second read as a door
 * flicking from shut to open with nothing in between (Roi: "doors open animation is TOO FAST LOL").
 */
export const SWING_TIME = 1.25;

const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

export function createPaintedDoors({ PIXI, root, grid = () => 100, make = undefined } = {}) {
  const art = new Map(); // key -> { sprite, texture, door, at, want }
  let queue = [];

  const host = () => { try { return root?.(); } catch { return null; } };

  const dropOne = (key) => {
    const had = art.get(key);
    if (!had) return;
    art.delete(key);
    try { had.sprite.parent?.removeChild(had.sprite); had.sprite.destroy(); } catch { /* gone with the canvas */ }
    try { had.texture?.destroy(true); } catch { /* gone with the canvas */ }
  };
  const drop = () => { queue = []; for (const key of [...art.keys()]) dropOne(key); };

  const hang = (door) => {
    const where = host();
    if (!where || !PIXI?.Sprite || !PIXI?.Texture) return false;
    const kind = DOOR_KINDS[door.kind] ? door.kind : doorFor(door.material);
    const leaf = paintDoorLeaf(kind, door.length, { grid: grid(), seed: door.id?.length ?? 3, lit: door.lit ?? null }, make);
    if (!leaf) return false;
    dropOne(door.key);
    let texture = null;
    try { texture = PIXI.Texture.from(leaf.canvas); } catch { return false; }
    const sprite = new PIXI.Sprite(texture);
    sprite.eventMode = 'none';
    // The hinge is the point it turns about, so that is where it is pinned to the map. Measured against the size
    // the picture covers on the map, not against the canvas — the canvas carries more pixels than that.
    const box = leaf.box ?? { w: leaf.canvas.width, h: leaf.canvas.height };
    sprite.anchor.set(leaf.hinge[0] / box.w, leaf.hinge[1] / box.h);
    sprite.width = box.w;
    sprite.height = box.h;
    sprite.position.set(door.hinge[0], door.hinge[1]);
    const at = door.open ? 1 : 0;
    sprite.rotation = door.along + swingOf(kind, door, at);
    if (doorHangs(kind)) sprite.alpha = door.open ? 0.35 : 1;
    where.addChild(sprite);
    art.set(door.key, { sprite, texture, door, kind, at, want: at });
    return true;
  };

  // A hung door does not swing: it is drawn aside, so it only fades. Everything else turns on its hinge.
  const swingOf = (kind, door, t) => (doorHangs(kind) ? 0 : door.way * DOOR_SWING * t);

  return {
    /** The doorways this scene has. Anything unchanged keeps its leaf, and its leaf keeps where it had swung to. */
    populate({ doors = [] } = {}) {
      const want = new Map(doors.map((d) => [d.key, d]));
      for (const key of [...art.keys()]) if (!want.has(key)) dropOne(key);
      for (const [key, door] of want) {
        const had = art.get(key);
        if (had) { had.door = door; had.want = door.open ? 1 : 0; }
      }
      queue = doors.filter((d) => !art.has(d.key));
      return queue.length;
    },
    /** Hang the next few leaves, and move whatever is still swinging. `dt` in seconds. */
    step(dt = 0, budget = 2) {
      for (let i = 0; i < budget && queue.length; i++) { const door = queue.shift(); if (!hang(door) && !host()) { queue.unshift(door); break; } }
      for (const held of art.values()) {
        if (held.at === held.want) continue;
        const by = SWING_TIME > 0 ? dt / SWING_TIME : 1;
        held.at = held.want > held.at ? Math.min(held.want, held.at + by) : Math.max(held.want, held.at - by);
        const t = ease(Math.max(0, Math.min(1, held.at)));
        held.sprite.rotation = held.door.along + swingOf(held.kind, held.door, t);
        if (doorHangs(held.kind)) held.sprite.alpha = 1 - t * 0.65;
      }
      return queue.length;
    },
    /** Hang everything now, with every door where it should already be. */
    settle(most = 200) { let n = 0; while (queue.length && n++ < most) this.step(0, 1); for (const held of art.values()) { held.at = held.want; held.sprite.rotation = held.door.along + swingOf(held.kind, held.door, held.at); } return queue.length; },
    drop,
    get state() { return { hung: art.size, waiting: queue.length, swinging: [...art.values()].filter((d) => d.at !== d.want).length, keys: [...art.keys()] }; },
  };
}
