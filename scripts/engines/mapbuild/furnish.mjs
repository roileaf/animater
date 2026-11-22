// What stands in a room, by what the room is (pure). A box, a kind and a seed give the furniture and where each piece
// goes: along the walls, in the corners and out in the middle, never in a doorway. The same seed furnishes the same
// room the same way; another seed moves things round.
//
// The map builder furnishes its buildings with this, and the Structures tab's Furnish mode a room drawn by hand.

import { DECOR_KINDS } from '../motion/decor-paint.mjs';

// [what, where it goes, how many]: 'corner', against a 'wall', or out in the 'middle'.
export const ROOM_KINDS = Object.freeze({
  home: { label: 'Home', items: [['bed', 'corner', 1], ['hearth', 'wall', 1], ['tableStools', 'middle', 1], ['bookshelf', 'wall', 1], ['strongbox', 'corner', 1], ['barrel', 'corner', 1]] },
  bedroom: { label: 'Bedroom', items: [['bed', 'corner', 2], ['strongbox', 'corner', 1], ['desk', 'wall', 1], ['bookshelf', 'wall', 1], ['rug', 'middle', 1]] },
  tavern: { label: 'Tavern', items: [['counter', 'wall', 1], ['hearth', 'wall', 1], ['tableStools', 'middle', 4], ['barrel', 'corner', 2], ['crate', 'corner', 1], ['bench', 'wall', 1]] },
  kitchen: { label: 'Kitchen', items: [['hearth', 'wall', 1], ['counter', 'wall', 1], ['tableStools', 'middle', 1], ['barrel', 'corner', 2], ['sacks', 'corner', 1], ['washtub', 'corner', 1], ['firewood', 'wall', 1]] },
  smithy: { label: 'Smithy', items: [['anvil', 'middle', 1], ['hearth', 'wall', 1], ['trough', 'wall', 1], ['sacks', 'corner', 1], ['timbers', 'wall', 1], ['barrel', 'corner', 1], ['weaponRack', 'wall', 1]] },
  store: { label: 'Shop', items: [['counter', 'wall', 1], ['bookshelf', 'wall', 2], ['crate', 'corner', 1], ['barrel', 'corner', 1], ['sacks', 'corner', 1], ['strongbox', 'corner', 1]] },
  library: { label: 'Library', items: [['bookshelf', 'wall', 4], ['desk', 'middle', 1], ['rug', 'middle', 1], ['papers', 'middle', 1], ['candles', 'corner', 1]] },
  shrine: { label: 'Shrine', items: [['altar', 'wall', 1], ['statue', 'corner', 2], ['bench', 'middle', 2], ['urns', 'corner', 1], ['candles', 'corner', 1]] },
  guardroom: { label: 'Guardroom', items: [['weaponRack', 'wall', 2], ['tableStools', 'middle', 1], ['bed', 'corner', 2], ['strongbox', 'corner', 1], ['barrel', 'corner', 1]] },
  storeroom: { label: 'Storeroom', items: [['crate', 'corner', 2], ['barrel', 'corner', 2], ['sacks', 'wall', 2], ['crate', 'middle', 2], ['barrel', 'middle', 1]] },
  prison: { label: 'Prison', items: [['cage', 'middle', 2], ['chains', 'wall', 2], ['strawBed', 'corner', 2], ['bones', 'corner', 1]] },
  barn: { label: 'Barn', items: [['haystack', 'corner', 3], ['trough', 'wall', 1], ['sacks', 'corner', 1], ['crate', 'middle', 1], ['timbers', 'wall', 1]] },
  stable: { label: 'Stable', items: [['trough', 'wall', 1], ['haystack', 'corner', 2], ['sacks', 'corner', 1]] },
  tower: { label: 'Study', items: [['desk', 'middle', 1], ['bookshelf', 'wall', 1], ['strongbox', 'wall', 1]] },
  crypt: { label: 'Crypt', items: [['sarcophagus', 'wall', 3], ['urns', 'corner', 2], ['bones', 'middle', 1], ['cobweb', 'corner', 2], ['brazier', 'middle', 1]] },
  hall: { label: 'Great hall', items: [['column', 'middle', 6], ['brazier', 'corner', 2], ['throne', 'wall', 1], ['rug', 'middle', 1], ['statue', 'corner', 2]] },
  lair: { label: 'Lair', items: [['bones', 'corner', 2], ['boneRubble', 'middle', 1], ['strawBed', 'corner', 1], ['rubble', 'corner', 1], ['cobweb', 'corner', 1], ['bones', 'middle', 1]] },
  treasury: { label: 'Treasury', items: [['treasure', 'middle', 2], ['strongbox', 'wall', 3], ['urns', 'corner', 1], ['brazier', 'corner', 1], ['weaponRack', 'wall', 1]] },
  ruin: { label: 'Ruin', items: [['rubble', 'corner', 2], ['brokenFurniture', 'middle', 1], ['rubble', 'middle', 1], ['bones', 'corner', 1], ['brokenPillar', 'wall', 1]] },
  room: { label: 'Spare room', items: [['bed', 'corner', 1], ['strongbox', 'corner', 1], ['desk', 'wall', 1]] },
});
export const ROOM_IDS = Object.freeze(Object.keys(ROOM_KINDS));
/** The room kinds as a menu, for the bar: [id, label]. */
export const ROOM_CHOICES = Object.freeze(['home', 'bedroom', 'kitchen', 'tavern', 'store', 'smithy', 'library', 'shrine', 'guardroom', 'storeroom', 'prison', 'crypt', 'hall', 'treasury', 'lair', 'barn', 'stable'].map((id) => [id, ROOM_KINDS[id].label]));

const rngOf = (seed) => { let a = (Number(seed) >>> 0) || 1; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const WALL_TURN = { n: 0, e: Math.PI / 2, s: Math.PI, w: -Math.PI / 2 };

/**
 * The furniture of a room (pure): { things: [{ kind, x, y, size, turn, fixed }], hearth (whether a fire was put in:
 * a roof over it wants a chimney) }. `box` { x, y, w, h } and `doors` [[x, y]…] in the same units as `grid` is one
 * square of (scene pixels with the scene's grid; squares with grid 1). Sizes are in squares, as decorations keep them.
 * Nothing is put within a square and a half of a door, and nothing is made bigger than the room has room for. In a
 * room that does not fill its box, only the places that are in it are used: a round tower has no corners to stand a
 * bed in, so it is furnished along its walls and in its middle.
 */
export function furnishRoom(box, kind = 'home', { grid = 100, seed = 1, doors = [], inside = null } = {}) {
  const rnd = rngOf(seed), g = grid > 0 ? grid : 100, bx = box.x / g, by = box.y / g, w = box.w / g, h = box.h / g, list = ROOM_KINDS[kind]?.items ?? ROOM_KINDS.home.items;
  if (!(w >= 2) || !(h >= 2)) return { things: [], hearth: false };
  // (`inside(x, y)`: whether a spot is in the room at all — for a room that is not its box: a round tower, an L.)
  const free = (p) => doors.every((d) => Math.hypot(p.x - d[0] / g, p.y - d[1] / g) > 1.4) && (!inside || inside(p.x * g, p.y * g));
  const shuffled = (items) => items.map((v) => [rnd(), v]).sort((a, b) => a[0] - b[0]).map((p) => p[1]);
  const along = (long) => [...(long >= 4 ? [0.5] : []), ...(long >= 7 ? [0.28, 0.72] : []), ...(long >= 11 ? [0.12, 0.88] : [])];
  const slots = {
    corner: shuffled([{ x: bx + 0.9, y: by + 0.9 }, { x: bx + w - 0.9, y: by + 0.9 }, { x: bx + w - 0.9, y: by + h - 0.9 }, { x: bx + 0.9, y: by + h - 0.9 }].filter(free)),
    wall: shuffled([...along(w).flatMap((t) => [{ x: bx + w * t, y: by + 0.85, turn: WALL_TURN.n }, { x: bx + w * t, y: by + h - 0.85, turn: WALL_TURN.s }]),
      ...along(h).flatMap((t) => [{ x: bx + 0.85, y: by + h * t, turn: WALL_TURN.w }, { x: bx + w - 0.85, y: by + h * t, turn: WALL_TURN.e }])].filter(free)),
    middle: [],
  };
  const nx = Math.max(1, Math.floor((w - 2.6) / 2.4)), ny = Math.max(1, Math.floor((h - 2.6) / 2.4));
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) slots.middle.push({ x: bx + w / 2 + (i - (nx - 1) / 2) * 2.4, y: by + h / 2 + (j - (ny - 1) / 2) * 2.4 });
  slots.middle = shuffled(slots.middle.filter(free));
  const things = [], put = (what, slot, size, turn) => things.push({ kind: what, x: slot.x * g, y: slot.y * g, size, turn, fixed: true });
  let hearth = false;
  for (const [what, where, many] of list) for (let i = 0; i < many; i++) {
    if (!DECOR_KINDS[what]) break;
    const slot = slots[where].shift();
    if (!slot) break;
    const room = Math.min(w, h), size = Math.min(DECOR_KINDS[what].size ?? 1, Math.max(0.5, room - 1.2)), quarter = rnd() < 0.5 ? 0 : Math.PI / 2;
    // A table stands on a rug, where the room is big enough to have one.
    if (what === 'tableStools' && room >= 4) put('rug', slot, Math.min(2.4, room - 1.4), quarter);
    put(what, slot, size, slot.turn ?? quarter);
    if (what === 'hearth') hearth = true;
  }
  return { things, hearth };
}
