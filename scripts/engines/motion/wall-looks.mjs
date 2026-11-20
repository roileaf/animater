// Which walls get painted, what each is made of, and how the scene's loose segments join up into runs worth painting.
// Pure: it is handed plain wall records and gives back plain runs. The painting is wall-paint.mjs; putting the
// pictures on the canvas is painted-walls.mjs.
//
// A wall in Foundry is a segment on its own — two points, no idea that the wall beside it is the same wall. Painted
// one at a time they meet in a seam at every corner, so they are chained here into runs first: everything of the same
// material that shares an end, walked end to end.

import { WALL_MATERIAL_IDS, WORKED } from './wall-paint.mjs';

export const DEFAULT_MATERIAL = 'dressed';

/** Endpoints are floats: two walls meet when their ends land on the same tenth of a pixel. */
const endKey = (x, y) => `${Math.round(x * 10)},${Math.round(y * 10)}`;

/**
 * A short, steady stamp of where a run goes. Its key carries this, so a wall that is DRAGGED is painted again.
 * Which end the run happened to be walked from is not part of it: the same wall read in another order is the same
 * wall, and repainting the map every time Foundry hands the walls over differently would be absurd.
 */
const shapeOf = (points) => {
  const said = (list) => list.map(([x, y]) => `${Math.round(x)},${Math.round(y)}`).join(';');
  const text = [said(points), said([...points].reverse())].sort()[0];
  let h = 2166136261;
  for (const ch of text) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
};

/**
 * Is this wall one we paint? Doors are not: a door leaves a gap in the stone, which is exactly what a doorway looks
 * like from above, and the door itself is drawn by whatever draws doors. Nor are walls that stop nothing — the
 * invisible helpers a GM uses to shape light or sound are not masonry.
 */
export function wallPainted(wall) {
  if (!wall || !Array.isArray(wall.c) || wall.c.length < 4) return false;
  // A wall is painted because it was drawn with a material, and for no other reason. Animater never paints over the
  // walls a map came with: a GM lays walls with the Map painting bar's Walls tab, and those are the ones it paints.
  if (!WALL_MATERIAL_IDS.includes(wall.animater?.material)) return false;
  // A doorway and a window are both gaps in the stone: the run stops at one side and picks up at the other, and what
  // fills the gap is painted by its own engine. Painted as wall as well, a window had stone laid over it.
  if (wall.door || wall.animater?.window) return false;
  const [x1, y1, x2, y2] = wall.c;
  if (!Number.isFinite(x1) || !Number.isFinite(y1) || !Number.isFinite(x2) || !Number.isFinite(y2)) return false;
  return Math.hypot(x2 - x1, y2 - y1) >= 1;
}

/**
 * The material of one wall: the one it was drawn with. A wall without one is not painted at all (wallPainted), so
 * this only ever answers for walls that have one; an unknown name falls back rather than throwing the wall away.
 */
export function materialOf(wall) {
  const own = wall?.animater?.material;
  return WALL_MATERIAL_IDS.includes(own) ? own : DEFAULT_MATERIAL;
}

/** Two directions are the same line when they point the same way to within a thousandth. */
const STRAIGHT_ENOUGH = 0.9995;

/**
 * The straight stretch of wall one wall belongs to: itself, and every painted wall carrying straight on from either
 * end, of the same material. A GM draws a wall a square at a time, so the wall under the pointer is usually one
 * square long — and a doorway cut from it could never be wider than that square, whatever the bar asked for (Roi:
 * "this is NOT 3 squares wide"). An opening is cut from the whole straight stretch instead.
 *
 * Returns { a, b, length, d, parts: [{ id, from, to }] }, each part measured from `a` along the stretch, in order.
 * A corner stops it, and so does a junction: three walls meeting is nobody's straight line.
 */
export function alongStretch(walls, id) {
  const kept = (walls ?? []).filter(wallPainted).map((w) => ({ ...w, material: materialOf(w) }));
  const me = kept.find((w) => w.id === id);
  if (!me) return null;
  const ends = new Map();
  for (const w of kept) for (const key of [endKey(w.c[0], w.c[1]), endKey(w.c[2], w.c[3])]) {
    if (!ends.has(key)) ends.set(key, []);
    ends.get(key).push(w);
  }
  const way = (w, head) => { // the wall's direction, pointing away from the end we came in by
    const [x1, y1, x2, y2] = w.c, len = Math.hypot(x2 - x1, y2 - y1) || 1;
    const d = [(x2 - x1) / len, (y2 - y1) / len];
    return endKey(x1, y1) === head ? d : [-d[0], -d[1]];
  };
  const far = (w, head) => (endKey(w.c[0], w.c[1]) === head ? [w.c[2], w.c[3]] : [w.c[0], w.c[1]]);
  // Walk out of one end of `me` for as long as the wall carries straight on.
  const walk = (head, d) => {
    const got = [];
    let at = head, from = me.id, dir = d;
    for (;;) {
      const here = (ends.get(at) ?? []).filter((w) => w.id !== from);
      if (here.length !== 1) break; // a loose end, or a junction nobody walks straight through
      const next = here[0];
      if (next.material !== me.material || got.some((w) => w.id === next.id)) break;
      const to = way(next, at);
      if (to[0] * dir[0] + to[1] * dir[1] < STRAIGHT_ENOUGH) break; // it turns a corner here
      got.push(next);
      at = endKey(...far(next, at));
      from = next.id;
      dir = to;
    }
    return got;
  };
  const [x1, y1, x2, y2] = me.c, mine = Math.hypot(x2 - x1, y2 - y1) || 1;
  const ahead = [(x2 - x1) / mine, (y2 - y1) / mine];
  const back = walk(endKey(x1, y1), [-ahead[0], -ahead[1]]);
  const on = walk(endKey(x2, y2), ahead);
  const chain = [...back.slice().reverse(), me, ...on];
  // Measured from this wall's own start, the stretch begins at whichever end lies furthest back along it.
  const off = (p) => (p[0] - x1) * ahead[0] + (p[1] - y1) * ahead[1];
  let least = 0;
  for (const w of chain) least = Math.min(least, off([w.c[0], w.c[1]]), off([w.c[2], w.c[3]]));
  const a = [x1 + ahead[0] * least, y1 + ahead[1] * least];
  const along = (p) => off(p) - least;
  const parts = chain.map((w) => {
    const one = along([w.c[0], w.c[1]]), two = along([w.c[2], w.c[3]]);
    return { id: w.id, from: Math.min(one, two), to: Math.max(one, two) };
  }).sort((p, q) => p.from - q.from);
  const length = parts.length ? parts.at(-1).to : mine;
  return { a, b: [a[0] + ahead[0] * length, a[1] + ahead[1] * length], d: ahead, length, parts };
}

/**
 * The scene's loose segments chained into runs: same material, sharing an end, walked from one loose end to the
 * other. A closed ring (a round tower, a courtyard) has no loose end, so it is walked from wherever it was found and
 * closed back on itself.
 *
 * Returns [{ key, points, material, walls }], `key` steady for the same set of walls so a run paints the same way
 * every time the scene is opened.
 */
export function wallRuns(walls, scene = {}) {
  const kept = (walls ?? []).filter(wallPainted).map((w) => ({ ...w, material: materialOf(w) }));
  const runs = [];
  // Where any painted wall meets any other, whatever either is made of. A run that ends at one of these is not
  // finished there — the stone carries on — so it is drawn a little past its end and its neighbour covers the join.
  // Without this every corner, every T and every change of material butted up with its own dark end, and a wall read
  // as a row of planks laid down rather than as one wall (Roi: "the walls doesnt seem like one unit").
  const meeting = new Map();
  for (const w of kept) for (const key of [endKey(w.c[0], w.c[1]), endKey(w.c[2], w.c[3])]) meeting.set(key, (meeting.get(key) ?? 0) + 1);
  const joins = (x, y) => (meeting.get(endKey(x, y)) ?? 0) > 1;
  for (const material of new Set(kept.map((w) => w.material))) {
    const mine = kept.filter((w) => w.material === material), left = new Set(mine.map((w) => w.id));
    // Which walls touch each end. A junction of three or more is a loose end for everybody: a T is not one run.
    const ends = new Map();
    const touch = (key, id) => { if (!ends.has(key)) ends.set(key, []); ends.get(key).push(id); };
    const byId = new Map(mine.map((w) => [w.id, w]));
    for (const w of mine) { touch(endKey(w.c[0], w.c[1]), w.id); touch(endKey(w.c[2], w.c[3]), w.id); }
    const next = (key, from) => {
      const here = ends.get(key) ?? [];
      if (here.length !== 2) return null; // a loose end, or a junction nobody can walk straight through
      const id = here.find((other) => other !== from);
      return id != null && left.has(id) ? byId.get(id) : null;
    };
    const walkFrom = (wall, startKey) => {
      // startKey is the end we walk away from; the run grows out of the other one.
      let at = wall, from = startKey;
      const points = [], ids = [];
      while (at) {
        left.delete(at.id);
        ids.push(at.id);
        const aKey = endKey(at.c[0], at.c[1]);
        const [ax, ay, bx, by] = aKey === from ? at.c : [at.c[2], at.c[3], at.c[0], at.c[1]];
        if (!points.length) points.push([ax, ay]);
        points.push([bx, by]);
        from = endKey(bx, by);
        at = next(from, at.id);
      }
      return { points, ids };
    };
    const loose = (w) => [endKey(w.c[0], w.c[1]), endKey(w.c[2], w.c[3])].find((k) => (ends.get(k) ?? []).length !== 2);
    // Open runs first, from their loose ends, so a run is never started in its middle; then whatever rings are left.
    for (const pass of [0, 1]) {
      for (const w of mine) {
        if (!left.has(w.id)) continue;
        const start = loose(w);
        if (pass === 0 && !start) continue;
        const { points, ids } = walkFrom(w, start ?? endKey(w.c[0], w.c[1]));
        if (points.length < 2) continue;
        const join = [joins(...points[0]), joins(...points.at(-1))];
        // The years on it and how thick it was drawn belong to the wall, not to the map: they were chosen on the bar
        // when it was laid. A run takes them from its first wall, since a run is of one wall's making.
        const first = byId.get(ids[0]) ?? {};
        const age = Math.max(0, Math.min(1, Number(first.animater?.age) || 0)), thick = Number(first.animater?.thick) || 0;
        // The colour it was painted in belongs to the wall the same way its years do: chosen on the bar when it
        // was laid, and the run takes its first wall's.
        const tint = typeof first.animater?.tint === 'string' && /^#[0-9a-f]{3,8}$/i.test(first.animater.tint) ? first.animater.tint : null;
        const stamp = `${Math.round(age * 100)}:${Math.round(thick * 100)}${tint ? `:${tint}` : ''}`;
        // `id` is the run itself, whatever it is wearing: the same stones, however the year or the sun has changed
        // how they are painted. `key` is this particular picture of them. Telling the two apart is what lets a run
        // being painted again keep the picture it has until the new one is ready.
        const id = `${material}:${ids.slice().sort().join('|')}`;
        runs.push({ id, key: `${id}:${shapeOf(points)}:${join.map(Number).join('')}:${stamp}`, points, material, walls: ids, closed: !start, join, age, thick: thick || undefined, tint });
      }
    }
  }
  return runs;
}

/**
 * How a scene's walls are weathered: the season brings its own snow and moss, and the GM can age the whole map. None
 * of it is per wall — a wall that wants its own state says so in its flags, handled by the caller.
 */
export function wallLook(scene = {}, { season = null } = {}) {
  const age = Math.max(0, Math.min(1, Number(scene.age) || 0));
  const under = !!scene.underground;
  // Moss is what the YEARS put on a wall, not what the season does: a wall laid this morning has none of it in any
  // season (Roi: "why is summer showing moss on all walls?"). The season only says how well what is there is doing —
  // best in spring and summer, poorer in autumn, nothing in a frost, and nothing at all in the dark.
  const growing = season === 'summer' || season === 'spring' ? 1 : season === 'autumn' ? 0.7 : season === 'winter' ? 0 : 0.85;
  return {
    snow: under ? 0 : season === 'winter' ? Math.max(0, Math.min(1, Number(scene.snow ?? 0.9))) : 0,
    moss: under ? 0 : Math.min(1, age * growing),
    soot: Math.max(0, Math.min(1, Number(scene.soot) || 0)),
    ruin: age > 0.5 ? (age - 0.5) * 2 : 0,
  };
}

/**
 * A doorway is a door of Foundry's own, drawn here: it carries the material of the wall it was cut into, so the
 * leaf can be of a piece with the stone round it. A door the map came with is left alone, like any other wall.
 */
export function doorPainted(wall) {
  if (!wall || !Array.isArray(wall.c) || wall.c.length < 4) return false;
  if (!(Number(wall.door) > 0)) return false;
  if (!WALL_MATERIAL_IDS.includes(wall.animater?.material)) return false;
  const [x1, y1, x2, y2] = wall.c;
  return Number.isFinite(x1) && Number.isFinite(y1) && Number.isFinite(x2) && Number.isFinite(y2) && Math.hypot(x2 - x1, y2 - y1) >= 1;
}

/**
 * The scene's painted doors, each as the leaf wants it: where its hinge is, which way it swings, how long it is, and
 * whether it stands open. `ds` is Foundry's door state — 0 shut, 1 open, 2 locked, and a locked door is a shut one.
 */
export function wallDoors(walls) {
  return (walls ?? []).filter(doorPainted).map((w) => {
    const [x1, y1, x2, y2] = w.c, flip = w.animater?.hinge === 'far';
    const hinge = flip ? [x2, y2] : [x1, y1], far = flip ? [x1, y1] : [x2, y2];
    // Which end it hangs on and which way it opens are two different things: a door can be hinged at either end and
    // still swing into the room or out of it.
    const out = w.animater?.swing === 'out';
    return {
      id: w.id,
      key: `${w.id}:${w.animater?.door ?? ''}:${w.animater?.material}:${Math.round(x1)},${Math.round(y1)},${Math.round(x2)},${Math.round(y2)}:${flip ? 'f' : 'n'}${out ? 'o' : 'i'}`,
      hinge, far,
      length: Math.hypot(x2 - x1, y2 - y1),
      along: Math.atan2(far[1] - hinge[1], far[0] - hinge[0]),
      way: (flip ? -1 : 1) * (out ? -1 : 1),
      kind: w.animater?.door ?? null,
      material: w.animater?.material,
      open: Number(w.ds) === 1,
    };
  });
}

/**
 * The scene's painted windows. A window is a wall carrying Animater's own window kind (window-state.mjs has known
 * about those for a long while) and, because it was drawn here, a material — so the pane can be of a piece with the
 * stone it is set into. A window the map came with is left alone, like any other wall.
 */
export function windowPainted(wall) {
  if (!wall || !Array.isArray(wall.c) || wall.c.length < 4) return false;
  if (Number(wall.door) > 0) return false;
  if (!wall.animater?.window) return false;
  if (!WALL_MATERIAL_IDS.includes(wall.animater?.material)) return false;
  const [x1, y1, x2, y2] = wall.c;
  return Number.isFinite(x1) && Number.isFinite(y1) && Number.isFinite(x2) && Number.isFinite(y2) && Math.hypot(x2 - x1, y2 - y1) >= 1;
}

export function wallWindows(walls) {
  return (walls ?? []).filter(windowPainted).map((w) => {
    const [x1, y1, x2, y2] = w.c, open = w.animater?.windowOpen === true, slats = w.animater?.windowSlats === true;
    const way = w.animater?.swing === 'out' ? -1 : 1;
    // A window is set into a wall, so it is as thick as that wall: its own drawn thickness, not a figure of its own.
    const thick = Number(w.animater?.thick) || 0;
    return {
      id: w.id,
      thick: thick || undefined,
      key: `${w.id}:${w.animater.window}:${w.animater.material}:${Math.round(x1)},${Math.round(y1)},${Math.round(x2)},${Math.round(y2)}:${way}`,
      way,
      middle: [(x1 + x2) / 2, (y1 + y2) / 2],
      along: Math.atan2(y2 - y1, x2 - x1),
      length: Math.hypot(x2 - x1, y2 - y1),
      kind: w.animater.window,
      material: w.animater.material,
      open, slats,
    };
  });
}

/** How roughly a room's boundary was worked, from the material facing it. */
export const workedFor = (material) => (material === 'natural' ? WORKED.raw : material === 'hewn' ? WORKED.cut : WORKED.faced);

/** A room underground: the hole, how its edge was worked, and whether anyone ever laid it a floor. */
export const roomFor = (pts, material) => ({
  pts,
  face: material,
  worked: workedFor(material),
  coursed: material !== 'natural' && material !== 'hewn',
  laid: material !== 'natural',
});
