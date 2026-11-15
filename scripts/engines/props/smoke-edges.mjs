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

// The geometry the smoke's cell indices are read against when the scene stored none: the whole canvas, origin 0,0, one
// cell per grid square. (Same convention as the fire's scene-wide grid.)
export function smokeGridOf(dimensions) {
  const cell = Number(dimensions?.size);
  const width = Number(dimensions?.width);
  const height = Number(dimensions?.height);
  if (!(cell > 0) || !(width > 0) || !(height > 0)) return null;
  return { cols: Math.ceil(width / cell), rows: Math.ceil(height / cell), origin: { x: 0, y: 0 }, cell };
}

// What the writer stores BESIDE the cells, at `flags.animater.smokeGrid`: { cols, cell, level }. The cells' indices only mean
// something against the `cols` and `cell` they were written with, so the fence reads those, not the scene's current size
// (a resize or grid change would otherwise slide the fence under the cells). `level` is the id of the level the smoke is on.
export const SMOKE_GRID_FLAG = "smokeGrid";

// The stored geometry as a grid (rows are whatever the stored cells need), or null when absent or unusable.
export function storedSmokeGrid(scene, cells) {
  const raw = scene?.flags?.animater?.[SMOKE_GRID_FLAG];
  const cols = Number(raw?.cols);
  const cell = Number(raw?.cell);
  if (!(Number.isInteger(cols) && cols > 0 && cell > 0)) return null;
  const top = Math.max(-1, ...Object.keys(cells ?? {}).map(Number).filter(Number.isInteger));
  return { cols, rows: Math.max(1, Math.ceil((top + 1) / cols)), origin: { x: 0, y: 0 }, cell };
}

// smokeCellsOf gives a map with STRING keys; smokeEdges wants [{i, v}] with numeric i. This is the one place they meet.
export const smokeCellList = (cells) => Object.entries(cells ?? {}).map(([i, v]) => ({ i: Number(i), v }));

/**
 * How thick the smoke is at one point on the map: the density stored for the square that point falls in, 0 where
 * nothing is stored, the point is off the grid, or the geometry is unusable.
 *
 * Read against the geometry the cells were WRITTEN with (storedSmokeGrid), never the scene's current size — the same
 * rule the fence and the cloud follow, because a resize or a grid change would otherwise slide the answer under the
 * stored squares. `cells` is the keyed flag as smokeCellsOf gives it; `grid` is {cols, cell, origin}.
 *
 * Pure: no Foundry, no clock. What asks is the drawn flames — a fire standing in thick smoke is not seen, which is
 * the same thing the sight-blocking fence says about everything else behind it.
 */
export function smokeDensityAt(cells, grid, point) {
  const cols = Number(grid?.cols), size = Number(grid?.cell);
  const x = Number(point?.x), y = Number(point?.y);
  if (!(Number.isInteger(cols) && cols > 0 && size > 0) || !Number.isFinite(x) || !Number.isFinite(y)) return 0;
  const col = Math.floor((x - (Number(grid?.origin?.x) || 0)) / size);
  const row = Math.floor((y - (Number(grid?.origin?.y) || 0)) / size);
  if (col < 0 || col >= cols || row < 0) return 0;
  const v = Number(cells?.[String(row * cols + col)]);
  return Number.isFinite(v) && v > 0 ? v : 0;
}

// THE one rule about the level, shared by the writer (smoke-round.mjs smokeLevelFor) and every reader (smokeLevelOf
// below, and through it the fence and the cloud): a level only counts while the SCENE STILL HAS IT. An id that is not
// a document id, or that names a level the scene no longer holds, names nothing — and neither side will ever answer
// with one. (A scene that lists no levels at all cannot contradict anything, so there any document id passes.)
//
// They disagreed before, and the disagreement was the worst of both: delete the level the smoke was stored on and the
// writer moved the field to a live one, while every reader kept handing back the dead id. smokeFenceLevels found no
// level matching it and returned [], so thick smoke stopped blocking sight, and the cloud was drawn on nothing —
// smoke stored, nothing drawn, nothing blocking, and no way to tell from the flag that anything was wrong.
const LEVEL_ID = /^[a-zA-Z0-9]{16}$/;
export function smokeLevelReal(scene, id) {
  if (typeof id !== "string" || !LEVEL_ID.test(id)) return false;
  const order = [...(scene?.levels ?? [])].map((l) => l?.id).filter((own) => typeof own === "string");
  return !order.length || order.includes(id);
}

// The level the smoke is on, as a READER sees it: the stored one while the scene still has it, else the scene's own
// first level (smoke written before levels were stored), else null. The writer has one more step than this — it can
// look at where this round's sources stand, which a reader has no way to know — but it obeys the same rule, so
// neither of them ever names a level that is gone.
export function smokeLevelOf(scene) {
  const stored = scene?.flags?.animater?.[SMOKE_GRID_FLAG]?.level;
  if (smokeLevelReal(scene, stored)) return stored;
  const first = scene?.initialLevel?.id ?? scene?.firstLevel?.id ?? null;
  return smokeLevelReal(scene, first) ? first : null;
}

// The levels of the scene that hold the fence: just the smoke's own. None when that level is gone or unknown.
export const smokeFenceLevels = (scene) => {
  const id = smokeLevelOf(scene);
  return id ? [...(scene?.levels ?? [])].filter((l) => l.id === id) : [];
};

// Every fence segment of a scene, rebuilt from its stored state alone: [{id, a, b}]. The id is made of the segment's own
// coordinates, so the same smoke always gives the same ids. [] when there is no smoke or no usable geometry.
export function smokeEdgeSpecs(scene, cellsOf) {
  const cells = cellsOf(scene);
  const grid = storedSmokeGrid(scene, cells) ?? smokeGridOf(scene?.dimensions);
  if (!grid) return [];
  return smokeEdges(smokeCellList(cells), grid).map((e) => ({
    id: `${SMOKE_EDGE_PREFIX}${e.a.x},${e.a.y},${e.b.x},${e.b.y}`, a: e.a, b: e.b,
  }));
}

// Put exactly `specs` into the `target` levels' edge sets: first remove what was put in before (`priorIds`) from every one of
// `all` the levels (the smoke may have moved level), then add. `makeEdge(spec)` builds the engine's edge object. Returns the
// new id list. Over a set the engine just cleared (a reset) the removal finds nothing and every edge is added.
export function syncSmokeEdges(all, target, specs, makeEdge, priorIds = []) {
  for (const level of all) for (const id of priorIds) level.edges.delete(id);
  const ids = [];
  for (const spec of specs) {
    const edge = makeEdge(spec);
    for (const level of target) level.edges.set(spec.id, edge);
    ids.push(spec.id);
  }
  return ids;
}
