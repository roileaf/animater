// A read-only look at the smoke's room model on a live scene, for when the smoke behaves and nobody can see why.
// Writes nothing, changes nothing, and runs on whatever scene it is given (the canvas's by default).
//
// From a GM's console:
//   (await import("/modules/animater/tools/smoke-probe.mjs")).smokeProbe()
//
// It answers the one question the stored flags cannot: WHERE this room stands open. A room vents through three
// different things, and only the first is a door or a window the GM can see:
//   wall   — a wall of the room that stands open where it leads out (an open door, a window swung open, a frame
//            with nothing in it, a hole battered through)
//   sky    — a cell under a region flagged "Open to the sky"
//   edge   — a cell whose neighbour is NOT indoors with no wall between them. This is the one that surprises:
//            it is the indoor REGION's edge, not a wall, so a roof region drawn short of the walls — or around
//            them — vents the room along its whole boundary however tightly the doors are shut.
// The report gives each room's size, its openings split by which of the three they are, and what that works out
// to as a share and a per-round retention, so "the smoke clears anyway" has a number behind it.
import { smokeGathering } from "../scripts/engines/props/smoke-gather.mjs";
import { smokeOpeningsOf, smokeCellsOf, THICK, THIN } from "../scripts/engines/props/smoke-field.mjs";
import { smokeGridOf, smokeCellList } from "../scripts/engines/props/smoke-edges.mjs";
import { smokeNeighbours, smokeRoomAt, smokeRunsOn, smokeLevelFor } from "../scripts/engines/props/smoke-round.mjs";
import { regionsOnLevel, skyRegionsOf } from "../scripts/engines/props/smoke-regions.mjs";
import { indoorPolygonsOf } from "../scripts/engines/regions/image-plane.mjs";
import { pointInPolygon } from "../scripts/engines/fragments/fragments.mjs";
import { wallBetween } from "../scripts/engines/props/fire-rounds.mjs";
import { undergroundOf } from "../scripts/core/underground.mjs";

const ID = "animater";

// main.mjs's own two, copied because they are private to it. Keep them the same shape as the originals
// (main.mjs regionAreas and wallView) — a probe that reads the scene differently from the round would lie.
const regionAreas = (region) => {
  const tree = region?.polygonTree;
  if (!tree?.children) return Array.from(region?.polygons ?? [], (p) => Array.from(p.points ?? []));
  const out = [];
  const walk = (node) => {
    for (const area of node.children ?? []) {
      if (area.isHole) continue;
      const points = Array.from(area.points ?? []), cut = (area.children ?? []).filter((c) => c.isHole);
      points.holes = cut.map((c) => Array.from(c.points ?? []));
      out.push(points);
      for (const hole of cut) walk(hole);
    }
  };
  walk(tree);
  return out;
};
const wallView = (doc) => ({ id: doc.id, c: [...(doc.c ?? [])], door: doc.door, ds: doc.ds, move: doc.move,
  sight: doc.sight, light: doc.light, sound: doc.sound, levels: [...(doc.levels ?? [])], flags: doc.flags ?? {} });

export function smokeProbe(scene = globalThis.canvas?.scene) {
  if (!scene) return console.warn("Animater smoke probe: no scene");
  const geo = smokeGridOf(scene.dimensions);
  const stored = smokeCellList(smokeCellsOf(scene));
  if (!geo) { console.warn("Animater smoke probe: this scene has no readable grid"); return null; }
  const { cols, rows, cell, origin } = geo;
  const deep = undergroundOf(scene.flags?.[ID], null);
  const level = smokeLevelFor(scene, []);
  const onLevel = regionsOnLevel(scene.regions, level);
  const polys = deep ? [] : indoorPolygonsOf(onLevel, regionAreas);
  const work = smokeGathering({
    cache: new Map(), sceneId: scene.id, geo, level, deep,
    polygons: () => polys,
    shafts: () => skyRegionsOf(onLevel).flatMap((r) => { try { return regionAreas(r) ?? []; } catch { return []; } }),
    walls: () => (scene.walls?.contents ?? []).map(wallView),
    inside: pointInPolygon, crosses: wallBetween,
  });
  const { indoors, walled, sky } = work;
  // The round's own opening list, asked exactly as main.mjs asks for it.
  const byWall = new Set(smokeOpeningsOf({ walls: scene.walls?.contents ?? [], cell, origin, cols, rows, indoors }));

  const inside = stored.filter((c) => indoors(c.i));
  const rooms = new Map();
  for (const c of stored) {
    if (!indoors(c.i)) continue;
    const own = smokeRoomAt({ from: c.i, cols, rows, indoors, walled, cache: work.rooms }) ?? { id: "", size: cols * rows };
    const id = own.id ?? "";
    if (!rooms.has(id)) rooms.set(id, { id, size: Number(own.size) > 0 ? Number(own.size) : cols * rows, cells: [], open: { edge: [], wall: [], sky: [] } });
    rooms.get(id).cells.push(c);
  }
  // Why each cell of each room is an opening, if it is. Same three tests the round makes, kept apart here so the
  // report can say which one is doing the venting.
  for (const room of rooms.values()) {
    for (const c of room.cells) {
      let breathes = false;
      for (const n of smokeNeighbours(c.i, cols, rows)) if (!indoors(n) && !walled(c.i, n)) breathes = true;
      let open = false;
      try { open = sky(c.i) === true; } catch { open = false; }
      if (breathes) room.open.edge.push(c.i);
      if (byWall.has(c.i)) room.open.wall.push(c.i);
      if (open) room.open.sky.push(c.i);
    }
  }
  const at = (i) => `(${i % cols},${Math.floor(i / cols)})`;
  const report = {
    scene: scene.name, on: smokeRunsOn(scene), grid: { cols, rows, cell }, underground: deep === true,
    indoorRegions: polys.length, skyRegions: skyRegionsOf(onLevel).length,
    storedCells: stored.length, storedIndoors: inside.length,
    thick: inside.filter((c) => c.v >= THICK).length, thin: inside.filter((c) => c.v >= THIN && c.v < THICK).length,
    rooms: [...rooms.values()].map((r) => {
      const all = new Set([...r.open.edge, ...r.open.wall, ...r.open.sky]);
      const share = Math.min(1, all.size / Math.max(1, r.size));
      const vent = share > 0 ? (0.9 * share) / (share + 0.45) : 0;
      return {
        id: r.id || "(whole scene)", roomCells: r.size, smokingCells: r.cells.length,
        openings: all.size, byRegionEdge: r.open.edge.length, byOpenWall: r.open.wall.length, bySky: r.open.sky.length,
        openShare: Number(share.toFixed(3)), ventPerRound: Number(vent.toFixed(3)),
        keptPerRound: Number(((1 - 0.02) * (1 - vent)).toFixed(3)),
        firstFewEdgeOpenings: r.open.edge.slice(0, 8).map(at),
        firstFewWallOpenings: r.open.wall.slice(0, 8).map(at),
      };
    }),
  };
  console.log("Animater smoke probe", report);
  console.table(report.rooms);
  return report;
}
