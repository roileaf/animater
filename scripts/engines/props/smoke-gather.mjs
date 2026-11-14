// What one round of room smoke needs to know about a scene's SHAPE: which cells are indoors, which pairs of touching
// cells have a wall between them, and which cells lie under a hole in the roof. Gathered once and kept for as long as
// the room walk is, because every one of those answers costs a walk over polygons or a scan of every wall on the map.
//
// Nothing Foundry-shaped is reached for in here. The three gatherings arrive as thunks and the two geometry tests as
// plain functions, so main.mjs keeps the lookups and a test can drive THIS, the real thing, with fakes and watch what
// comes out. That is the whole point of the module existing: this gathering lived in main.mjs, which no test can
// import, so it was pinned by source-text regexes — and a regex cannot see that two keys of one object collide. One
// did, the indoor-polygon array landed on the room cache, `cache?.get(from)` threw on the first indoor cell of every
// burning round, main.mjs traced it away, and the entire feature was dead with 1604 tests passing.
//
// The kept record is built ONCE, field by field, with every name its own: no seeded object spread over by a built one,
// which is the shape that bug had. `polys`, `holes` and `blocking` are what was gathered; `rooms`, `indoorsAt`,
// `skyAt` and `walledAt` are what has been worked out since and is being remembered.

// What the kept answers were worked out FOR. A resize, a grid change, the smoke moving floor or a scene going
// underground makes them all meaningless, so the record is rebuilt; anything else that could move a wall or a room is
// a real map edit, which empties the caller's whole cache and takes this with it.
export const smokeWorkKey = ({ cols, cell, origin, level = null, deep = false } = {}) =>
  `${cols}:${cell}:${origin?.x ?? 0},${origin?.y ?? 0}:${level ?? ""}:${deep ? 1 : 0}`;

/**
 * The round's working set for one scene: `{ key, rooms, mid, indoors, walled, sky }`.
 *
 *   cache      a Map the caller keeps, scene id -> the record. Emptied by the caller on a real map edit. Null: nothing
 *              is kept and every round starts cold, which is correct, only slower.
 *   sceneId    which scene this is, for the cache.
 *   geo        {cols, rows, cell, origin}: the smoke grid the cells are indexed against.
 *   level      the level the smoke is on, or null. `deep`: an underground scene, where every cell is indoors.
 *   polygons() the indoor rooms on this level — regions that keep the weather out. Asked at most once per record.
 *   shafts()   the polygons of the regions the GM marked open to the sky. Asked at most once per record.
 *   walls()    the walls that stop smoke, in whatever shape `crosses` wants. Asked at most once per record.
 *   inside(point, polygon)   whether a point lies in one polygon.
 *   crosses(from, to, walls) whether the segment between two points crosses any of those walls.
 *
 * `rooms` is the Map smokeRoomAt takes as its `cache` — a Map, and nothing else ever assigned to that name.
 * The three predicates are what smokeRoundPlan takes: each cell, and each PAIR for `walled`, is asked once and the
 * answer kept. A pair is named from the lower cell, so the same two cells asked either way round are one answer.
 * A gathering or a geometry test that throws is read as "not indoors" / "no hole here", never as a thrown round.
 */
export function smokeGathering({ cache = null, sceneId = "", geo, level = null, deep = false,
  polygons = () => [], shafts = () => [], walls = () => [], inside = () => false, crosses = () => false } = {}) {
  const { cols, rows, cell, origin } = geo ?? {};
  const key = smokeWorkKey({ cols, cell, origin, level, deep });
  let own = cache?.get(sceneId) ?? null;
  if (!own || own.key !== key) {
    own = {
      key,
      rooms: new Map(),
      indoorsAt: new Map(),
      skyAt: new Map(),
      walledAt: new Map(),
      polys: safely(polygons, []),
      holes: safely(shafts, []),
      blocking: safely(walls, []),
    };
    cache?.set(sceneId, own);
  }
  const mid = (i) => ({ x: origin.x + ((i % cols) + 0.5) * cell, y: origin.y + (Math.floor(i / cols) + 0.5) * cell });
  const indoors = (i) => {
    let v = own.indoorsAt.get(i);
    if (v === undefined) {
      try { v = deep || own.polys.some((p) => inside(mid(i), p)); } catch { v = false; }
      own.indoorsAt.set(i, v);
    }
    return v;
  };
  // Named from the lower cell: cols * rows is the most cells there are, so this names each pair once and uniquely.
  const pairs = cols * rows;
  const walled = (i, n) => {
    const at = Math.min(i, n) * pairs + Math.max(i, n);
    let v = own.walledAt.get(at);
    if (v === undefined) {
      try { v = crosses(mid(i), mid(n), own.blocking) === true; } catch { v = false; }
      own.walledAt.set(at, v);
    }
    return v;
  };
  const sky = (i) => {
    if (!own.holes.length) return false;
    let v = own.skyAt.get(i);
    if (v === undefined) {
      try { v = own.holes.some((a) => inside(mid(i), a)); } catch { v = false; }
      own.skyAt.set(i, v);
    }
    return v;
  };
  return { key, rooms: own.rooms, mid, indoors, walled, sky };
}

const safely = (fn, fallback) => { try { const v = fn(); return Array.isArray(v) ? v : fallback; } catch { return fallback; } };
