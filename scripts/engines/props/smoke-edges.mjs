// The sight-blocking boundary of thick smoke, as the fewest straight segments.
// Pure: no Foundry, no PIXI. Only THICK cells fence; thin smoke conceals but never blocks, so a corridor of haze
// cannot sever a party. Collinear runs are merged because a segment per cell would hand the engine hundreds of
// touching collinear edges, the worst case for its intersection sweep.
import { smokeTier } from "./smoke-field.mjs";
import { cellRect } from "./fire-spread.mjs";

// Join contiguous spans on one line. `spans` are [line, from, to]; returns merged [line, from, to], sorted.
function mergeSpans(spans) {
  spans.sort((p, q) => p[0] - q[0] || p[1] - q[1] || p[2] - q[2]);
  const out = [];
  for (const s of spans) {
    const last = out[out.length - 1];
    if (last && last[0] === s[0] && s[1] <= last[2]) last[2] = Math.max(last[2], s[2]);
    else out.push([s[0], s[1], s[2]]);
  }
  return out;
}

export function smokeEdges(cells, { cols, rows, origin, cell }) {
  const thick = new Set();
  for (const c of cells ?? []) {
    if (c.i >= 0 && c.i < cols * rows && smokeTier(c.v) === "thick") thick.add(c.i);
  }
  const has = (col, row) => col >= 0 && col < cols && row >= 0 && row < rows && thick.has(row * cols + col);
  const geo = { cols, origin, cell };
  const horiz = []; // [y, x0, x1]
  const vert = []; // [x, y0, y1]
  for (const i of thick) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const { x, y, w, h } = cellRect(i, geo);
    if (!has(col, row - 1)) horiz.push([y, x, x + w]);
    if (!has(col, row + 1)) horiz.push([y + h, x, x + w]);
    if (!has(col - 1, row)) vert.push([x, y, y + h]);
    if (!has(col + 1, row)) vert.push([x + w, y, y + h]);
  }
  const edges = [
    ...mergeSpans(horiz).map(([y, x0, x1]) => ({ a: { x: x0, y }, b: { x: x1, y } })),
    ...mergeSpans(vert).map(([x, y0, y1]) => ({ a: { x, y: y0 }, b: { x, y: y1 } })),
  ];
  return edges.sort((p, q) => p.a.y - q.a.y || p.a.x - q.a.x || p.b.y - q.b.y || p.b.x - q.b.x);
}

// ---- The Foundry-facing half, still pure: scene data in, edge descriptions out. ----

export const SMOKE_EDGE_PREFIX = "animater.smoke.";

// The one grid every smoke cell index is read against: the whole canvas, origin 0,0, one cell per grid square.
// (Same convention as the fire's scene-wide grid.) The task that WRITES smoke must use this same function, or the
// stored indices and the fence disagree.
export function smokeGridOf(dimensions) {
  const cell = Number(dimensions?.size);
  const width = Number(dimensions?.width);
  const height = Number(dimensions?.height);
  if (!(cell > 0) || !(width > 0) || !(height > 0)) return null;
  return { cols: Math.ceil(width / cell), rows: Math.ceil(height / cell), origin: { x: 0, y: 0 }, cell };
}

// smokeCellsOf gives a map with STRING keys; smokeEdges wants [{i, v}] with numeric i. This is the one place they meet.
export const smokeCellList = (cells) => Object.entries(cells ?? {}).map(([i, v]) => ({ i: Number(i), v }));

// Every fence segment of a scene, rebuilt from its stored grid alone: [{id, a, b}]. The id is made of the segment's own
// coordinates, so the same smoke always gives the same ids. [] when there is no smoke or no usable canvas size.
export function smokeEdgeSpecs(scene, cellsOf) {
  const grid = smokeGridOf(scene?.dimensions);
  if (!grid) return [];
  return smokeEdges(smokeCellList(cellsOf(scene)), grid).map((e) => ({
    id: `${SMOKE_EDGE_PREFIX}${e.a.x},${e.a.y},${e.b.x},${e.b.y}`, a: e.a, b: e.b,
  }));
}

// Put exactly `specs` into each level's edge set: first remove what was put there before (`priorIds`), then add.
// `makeEdge(spec)` builds the engine's edge object. Returns the new id list. Removing before adding means a rebuild
// over a set that already holds smoke (a changed grid) never leaves stale segments, and over one the engine just
// cleared (a reset) removes nothing and adds everything.
export function syncSmokeEdges(levels, specs, makeEdge, priorIds = []) {
  const ids = [];
  for (const level of levels) {
    for (const id of priorIds) level.edges.delete(id);
  }
  for (const spec of specs) {
    const edge = makeEdge(spec);
    for (const level of levels) level.edges.set(spec.id, edge);
    ids.push(spec.id);
  }
  return ids;
}
