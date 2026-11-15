// What one round of room smoke needs to know about a scene's SHAPE: which cells are indoors, which pairs of touching
// cells have a wall between them, and which cells lie under a hole in the roof. Gathered once and kept for as long as
// the room walk is, because every one of those answers costs a walk over polygons or a scan of every wall on the map.
//
// Nothing Foundry-shaped is reached for in here. The three gatherings arrive as thunks and the two geometry tests as
// plain functions, so main.mjs keeps the lookups and a CHEAP test can drive THIS, the real thing, with fakes and watch
// what comes out. That is the whole point of the module existing: this gathering lived in main.mjs, so in practice it
// was pinned by source-text regexes — and a regex cannot see that two keys of one object collide. One did, the
// indoor-polygon array landed on the room cache, `cache?.get(from)` threw on the first indoor cell of every burning
// round, main.mjs traced it away, and the entire feature was dead with 1604 tests passing.
// (On "no test can import main.mjs": not true, and worth saying plainly because it was the reason given for
// several decisions here. tests/project/integration.test.mjs does import it, with a query string to dodge the
// module cache. What is true is that doing so needs the heavy fake-Foundry harness that file stands up, and that
// file is one of the two slow ones — so a CHEAP test cannot import main.mjs, and a source guard is a cost trade
// rather than an impossibility.)
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
 *   cache      a Map the caller keeps, scene id -> the record. Emptied by the caller on a real map edit. OPTIONAL and
 *              the one thing that is: null means nothing is kept and every round starts cold, which is correct and
 *              only slower, so a caller may honestly mean it.
 *   sceneId    which scene this is, for the cache.
 *   geo        {cols, rows, cell, origin}: the smoke grid the cells are indexed against. REQUIRED.
 *   level      the level the smoke is on, or null. `deep`: an underground scene, where every cell is indoors.
 *   polygons() the indoor rooms on this level — regions that keep the weather out. Asked at most once per record.
 *   shafts()   the polygons of the regions the GM marked open to the sky. Asked at most once per record.
 *   sides()    the polygons of the roofed regions the GM marked as standing open at their sides (a porch, a cart
 *              lodge). Only inside one of these does a region's own edge vent. Asked at most once per record.
 *   walls()    the walls that stop smoke, in whatever shape `crosses` wants. Asked at most once per record.
 *   inside(point, polygon)   whether a point lies in one polygon.
 *   crosses(from, to, walls) whether the segment between two points crosses any of those walls.
 *
 * EVERY ONE of those five, and `geo`, is REQUIRED, and leaving one out THROWS here, naming it. They used to have
 * defaults that quietly answered "nothing": no polygons, no walls, and an `inside` that said no to every point. So
 * deleting the one line in main.mjs that passes `inside` and `crosses` left 850 tests green while the feature was
 * silently dead — nothing was ever indoors, nothing was ever walled, and nothing threw for anyone to notice. A missing
 * injection is a programming error, not a state a scene can be in, and it is told as one. (Note which way the danger
 * runs: smokeRoundPlan's own `indoors` defaults to () => true, "the whole grid is one room", which is loud — a scene
 * full of smoke — and is a case its tests really use. An `inside` that defaults to false is the quiet direction, and
 * the quiet direction is the one that has cost this feature two Criticals.)
 *
 * `rooms` is the Map smokeRoomAt takes as its `cache` — a Map, and nothing else ever assigned to that name.
 * The three predicates are what smokeRoundPlan takes: each cell, and each PAIR for `walled`, is asked once and the
 * answer kept. A pair is named from the lower cell, so the same two cells asked either way round are one answer.
 *
 * One rule about things going wrong: a bad single REGION is skipped where it is read (indoorPolygonsOf, and the
 * regionAreas call in main.mjs's own shafts thunk), because one malformed region should not stop a map's smoke. A
 * broken HELPER is reported: a gathering or a geometry test that throws now throws out of here, up to the round's
 * caller, which tells the GM once per scene and tries again next round. It used to be swallowed into "not indoors",
 * which is a wrong answer presented as a fact — the same silence by another door.
 */
export function smokeGathering({ cache = null, sceneId = "", geo, level = null, deep = false,
  polygons, shafts, sides, walls, inside, crosses } = {}) {
  const missing = Object.entries({ polygons, shafts, sides, walls, inside, crosses })
    .filter(([, fn]) => typeof fn !== "function").map(([name]) => name);
  if (!geo || !(geo.cols > 0) || !(geo.rows > 0) || !(geo.cell > 0) || !geo.origin) missing.unshift("geo");
  if (missing.length) throw new Error(`smokeGathering: nothing was passed for ${missing.join(", ")}`);
  const { cols, rows, cell, origin } = geo;
  const key = smokeWorkKey({ cols, cell, origin, level, deep });
  let own = cache?.get(sceneId) ?? null;
  if (!own || own.key !== key) {
    own = {
      key,
      rooms: new Map(),
      indoorsAt: new Map(),
      skyAt: new Map(),
      walledAt: new Map(),
      polys: listed(polygons),
      holes: listed(shafts),
      open: listed(sides),
      blocking: listed(walls),
      sideAt: new Map(),
      nearAt: new Map(),
    };
    cache?.set(sceneId, own);
  }
  const mid = (i) => ({ x: origin.x + ((i % cols) + 0.5) * cell, y: origin.y + (Math.floor(i / cols) + 0.5) * cell });
  const indoors = (i) => {
    let v = own.indoorsAt.get(i);
    if (v === undefined) {
      v = deep || own.polys.some((p) => inside(mid(i), p));
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
      v = crosses(mid(i), mid(n), own.blocking) === true;
      own.walledAt.set(at, v);
    }
    return v;
  };
  const sky = (i) => {
    if (!own.holes.length) return false;
    let v = own.skyAt.get(i);
    if (v === undefined) {
      v = own.holes.some((a) => inside(mid(i), a));
      own.skyAt.set(i, v);
    }
    return v;
  };
  // Whether this cell lies under a region whose SIDES stand open — a porch, a cart lodge, a pavilion: roofed, so
  // it is indoors, but with no wall where the roof ends. Only such a region's boundary lets the room breathe out.
  // Everywhere else the boundary is sealed, because a roof region is drawn by hand around a building whose walls
  // are the real enclosure, and its outline steps across squares wherever it runs diagonally. Five such steps down
  // one side of a ship's hold vented it at 15% a round with every door and window shut, which is what sent the GM
  // looking for a fault in the doors.
  const openSide = (i) => {
    if (!own.open.length) return false;
    let v = own.sideAt.get(i);
    if (v === undefined) {
      v = own.open.some((a) => inside(mid(i), a));
      own.sideAt.set(i, v);
    }
    return v;
  };
  // Whether a wall runs through this cell's square at all, rather than exactly between its middle and a neighbour's.
  // A wall lying along a boundary that steps across squares crosses some of those middle-to-middle lines and misses
  // others, so `walled` alone reads half of a solid side as holes; this asks the wider question. Tested on the
  // square's four sides, which catches every wall that enters and leaves it. A wall ENDING inside the square
  // without reaching a side is not caught — a stub that short stops nothing anyway.
  const nearWall = (i) => {
    if (!own.blocking.length) return false;
    let v = own.nearAt.get(i);
    if (v === undefined) {
      const { x, y } = mid(i), h = cell / 2;
      const nw = { x: x - h, y: y - h }, ne = { x: x + h, y: y - h }, se = { x: x + h, y: y + h }, sw = { x: x - h, y: y + h };
      v = crosses(nw, ne, own.blocking) === true || crosses(ne, se, own.blocking) === true
        || crosses(se, sw, own.blocking) === true || crosses(sw, nw, own.blocking) === true;
      own.nearAt.set(i, v);
    }
    return v;
  };
  return { key, rooms: own.rooms, mid, indoors, walled, sky, openSide, nearWall };
}

// A gathering's answer as a list. A thunk that THROWS is not caught: it is a broken helper and the round's caller
// must hear about it. One that hands back something that is not a list is read as an empty one, which is the honest
// reading of "this scene has none of those" and is all a wrong shape can safely mean.
const listed = (fn) => { const v = fn(); return Array.isArray(v) ? v : []; };
