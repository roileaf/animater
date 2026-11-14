// What the smoke a fire fills a room with looks like: the picking (pure and seeded), the drift between rounds, and
// the two guards on main.mjs's own text — the drawing writes nothing, and the old rolling haze stands down where the
// new simulated smoke runs.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createSmokeLooks, smokePuffs, smokeSheets, smokeSheetAt, smokeTone, smokeBetween, smokeSway, smokeSeedOf,
  airHazeShows, TONE_STEPS, THIN_TOP, SMOKE_DRIFT_MS, HAZE_ALPHA, CORE_ALPHA, CORE_ALPHA_TOP,
  SMOKE_SORT_LAYER, TOKEN_SORT_LAYER, BIRD_SORT_LAYER } from "../../../scripts/engines/props/smoke-look.mjs";
import { THICK, THIN, DENSITY_CAP } from "../../../scripts/engines/props/smoke-field.mjs";
import { smokeOnlySave, smokeRunsOn, SMOKE_NOTE, SMOKE_MARK } from "../../../scripts/engines/props/smoke-round.mjs";
import { propSceneFieldsHTML } from "../../../scripts/ui/prop-config.mjs";

const geo = { cols: 4, origin: { x: 0, y: 0 }, cell: 50, seed: 7 };

// ---- The brief's own two tests. ----

test("the same cells and seed always give the same puffs", () => {
  const a = smokePuffs([{ i: 5, v: 2 }], { cols: 4, origin: { x: 0, y: 0 }, cell: 50, seed: 7 });
  assert.deepEqual(a, smokePuffs([{ i: 5, v: 2 }], { cols: 4, origin: { x: 0, y: 0 }, cell: 50, seed: 7 }));
});

test("thicker smoke is drawn darker than thin", () => {
  const thick = smokePuffs([{ i: 5, v: 2 }], { cols: 4, origin: { x: 0, y: 0 }, cell: 50, seed: 1 })[0];
  const thin = smokePuffs([{ i: 5, v: 0.4 }], { cols: 4, origin: { x: 0, y: 0 }, cell: 50, seed: 1 })[0];
  assert.ok(thick.tone > thin.tone);
});

// ---- The picking. ----

test("the puffs stand in their own cell, and nowhere else", () => {
  const puffs = smokePuffs([{ i: 5, v: 2 }], geo);
  assert.ok(puffs.length > 0);
  // Cell 5 of a 4-wide grid of 50px squares is column 1, row 1: x 50-100, y 50-100.
  for (const p of puffs) {
    assert.ok(p.x > 50 && p.x < 100, `x ${p.x}`);
    assert.ok(p.y > 50 && p.y < 100, `y ${p.y}`);
    assert.ok(p.r > 0 && p.r < 50, `r ${p.r}`);
  }
});

test("the grid's origin carries the cloud with it", () => {
  const here = smokePuffs([{ i: 5, v: 2 }], geo);
  const there = smokePuffs([{ i: 5, v: 2 }], { ...geo, origin: { x: 300, y: 200 } });
  assert.equal(here.length, there.length);
  for (let k = 0; k < here.length; k++) {
    assert.ok(Math.abs((there[k].x - here[k].x) - 300) < 1e-9);
    assert.ok(Math.abs((there[k].y - here[k].y) - 200) < 1e-9);
  }
});

test("a different seed paints a different cloud, cell for cell", () => {
  const a = smokePuffs([{ i: 5, v: 2 }], { ...geo, seed: 7 });
  const b = smokePuffs([{ i: 5, v: 2 }], { ...geo, seed: 8 });
  assert.equal(a.length, b.length);
  assert.notDeepEqual(a, b);
  // Still the same cell: a reseed moves the brush, never the smoke.
  for (const p of b) assert.ok(p.x > 50 && p.x < 100 && p.y > 50 && p.y < 100);
});

test("smoke under the thin floor is painted at all", () => {
  assert.deepEqual(smokePuffs([{ i: 5, v: THIN - 0.01 }], geo), []);
  assert.deepEqual(smokePuffs([{ i: 5, v: 0 }], geo), []);
  assert.ok(smokePuffs([{ i: 5, v: THIN }], geo).length > 0);
});

test("thicker smoke is painted with more puffs than thin", () => {
  const thin = smokePuffs([{ i: 5, v: THIN }], geo).length;
  const thick = smokePuffs([{ i: 5, v: DENSITY_CAP }], geo).length;
  assert.ok(thick > thin, `${thick} > ${thin}`);
});

test("every puff carries its own name, so the drift can follow it", () => {
  const puffs = smokePuffs([{ i: 5, v: 3 }, { i: 6, v: 3 }], geo);
  const seeds = new Set(puffs.map((p) => p.seed));
  assert.equal(seeds.size, puffs.length);
  for (const p of puffs) assert.ok(Number.isInteger(p.seed) && p.seed > 0);
});

test("the cells are painted in their own order, whatever order they arrive in", () => {
  const up = smokePuffs([{ i: 2, v: 2 }, { i: 9, v: 2 }], geo);
  const down = smokePuffs([{ i: 9, v: 2 }, { i: 2, v: 2 }], geo);
  assert.deepEqual(up, down);
});

test("nonsense in is nothing out, never a puff at NaN", () => {
  assert.deepEqual(smokePuffs([{ i: 5, v: 2 }], { ...geo, cols: 0 }), []);
  assert.deepEqual(smokePuffs([{ i: 5, v: 2 }], { ...geo, cell: 0 }), []);
  assert.deepEqual(smokePuffs(null, geo), []);
  assert.deepEqual(smokePuffs([{ i: -1, v: 2 }, { i: 1.5, v: 2 }, { i: "x", v: 2 }, null], geo), []);
  for (const p of smokePuffs([{ i: 5, v: "x" }, { i: 6, v: 2 }], geo)) {
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.r) && Number.isFinite(p.tone));
  }
});

// ---- Stepped tones: painted, not photographic. ----

test("the tones are steps, and thick is always darker than thin", () => {
  const steps = new Set();
  for (let v = 0; v <= DENSITY_CAP + 0.5; v += 0.01) steps.add(smokeTone(v));
  // Nothing between the steps: a painted brush, never a smooth gradient.
  for (const s of steps) {
    if (s === 0) continue;
    assert.ok(Number.isInteger(Math.round(s * TONE_STEPS)) && Math.abs(s * TONE_STEPS - Math.round(s * TONE_STEPS)) < 1e-9, `off a step: ${s}`);
  }
  assert.ok(steps.size <= TONE_STEPS + 1, `${steps.size} tones`);
  // What blocks sight reads heavier than what only conceals: every thick tone over every thin one.
  const thin = [], thick = [];
  for (let v = THIN; v < THICK; v += 0.01) thin.push(smokeTone(v));
  for (let v = THICK; v <= DENSITY_CAP; v += 0.01) thick.push(smokeTone(v));
  assert.ok(Math.min(...thick) > Math.max(...thin));
  assert.equal(smokeTone(THIN - 0.01), 0);
  // Past the cap nothing goes darker still.
  assert.equal(smokeTone(DENSITY_CAP * 3), smokeTone(DENSITY_CAP));
});

// ---- The cloud is ONE BODY: the three faults of fix round 1, each pinned. ----

// A point in a polygon given as a flat [x, y, x, y, ...] run.
const inside = (pts, x, y) => {
  let on = false;
  for (let i = 0, j = pts.length - 2; i < pts.length; j = i, i += 2) {
    const ax = pts[i], ay = pts[i + 1], bx = pts[j], by = pts[j + 1];
    if ((ay > y) !== (by > y) && x < ((bx - ax) * (y - ay)) / (by - ay) + ax) on = !on;
  }
  return on;
};
const area = (pts) => {
  let a = 0;
  for (let i = 0, j = pts.length - 2; i < pts.length; j = i, i += 2) a += pts[j] * pts[i + 1] - pts[i] * pts[j + 1];
  return Math.abs(a) / 2;
};
// A 4-wide block of cells: 5, 6, 9, 10 is a 2x2 square in the middle of a 4-wide grid.
const BLOCK = [{ i: 5, v: 2 }, { i: 6, v: 2 }, { i: 9, v: 2 }, { i: 10, v: 2 }];
const kindOf = (sheets, kind) => sheets.filter((s) => s.kind === kind);

test("every smoking square is covered, and the two bodies are the two tiers", () => {
  const sheets = smokeSheets([{ i: 5, v: 2 }, { i: 6, v: 0.4 }], geo);
  // One haze sheet per smoking square of either tier; one core sheet for the thick square alone.
  assert.deepEqual(kindOf(sheets, "haze").map((s) => s.i).sort((a, b) => a - b), [5, 6]);
  assert.deepEqual(kindOf(sheets, "core").map((s) => s.i), [5]);
  // The thin square is in no core body at all: that is what makes the tiers different things on the map.
  assert.equal(kindOf(sheets, "core").some((s) => s.i === 6), false);
});

test("neighbouring smoking cells join dead flush: no clean floor between two full squares", () => {
  const sheets = kindOf(smokeSheets(BLOCK, geo), "haze");
  assert.equal(sheets.length, 4);
  // Cell 5 is column 1 row 1 (x 50-100, y 50-100); cell 6 is column 2 row 1 (x 100-150).
  // The shared side is x = 100, y 50-100. Every point along it must be inside BOTH squares' outlines, which can only
  // happen if neither side was pulled in — if either were ragged, floor would show between them.
  const five = sheets.find((s) => s.i === 5).pts, six = sheets.find((s) => s.i === 6).pts;
  for (const y of [52, 60, 75, 90, 98]) {
    assert.ok(inside(five, 99.5, y), `cell 5 reaches its east wall at y ${y}`);
    assert.ok(inside(six, 100.5, y), `cell 6 reaches its west wall at y ${y}`);
  }
  // A joined side carries no ink: the seam must be invisible, or a filled room reads as a grid of lumps.
  // Cell 5 of the 2x2 block has two joined sides (east and south) and two boundary sides, so two rims.
  assert.equal(sheets.find((s) => s.i === 5).rims.length, 2);
  // And no rim of cell 5 runs along its joined east side (x = 100) or its joined south side (y = 100).
  for (const rim of sheets.find((s) => s.i === 5).rims) {
    const xs = rim.filter((_, k) => k % 2 === 0), ys = rim.filter((_, k) => k % 2 === 1);
    assert.ok(!(xs.every((x) => x > 99.9)), "no ink along the joined east side");
    assert.ok(!(ys.every((y) => y > 99.9)), "no ink along the joined south side");
  }
});

test("a cell with smoke all round it has no ragged edge at all, and covers its whole square", () => {
  // A 3x3 block on a 4-wide grid: cells 1,2 / 5,6 / 9,10 give cell 5 and 6 interior-ish; take a full 3-wide run.
  const nine = [1, 2, 3, 5, 6, 7, 9, 10, 11].map((i) => ({ i, v: 2 }));
  const sheets = kindOf(smokeSheets(nine, { ...geo, cols: 4 }), "haze");
  const middle = sheets.find((s) => s.i === 6);
  assert.deepEqual(middle.rims, [], "nothing of it is a boundary");
  // Its outline is exactly its own square: four corners, the full 50x50.
  assert.equal(middle.pts.length, 8);
  assert.equal(Math.round(area(middle.pts)), 2500);
});

test("the cloud's ragged edge is pulled inward, so it never crosses the wall its cells stop at", () => {
  for (const seed of [1, 7, 42, 1234, 99999]) {
    for (const s of smokeSheets([{ i: 5, v: 2 }], { ...geo, seed })) {
      for (let k = 0; k < s.pts.length; k += 2) {
        assert.ok(s.pts[k] >= 50 - 1e-9 && s.pts[k] <= 100 + 1e-9, `x ${s.pts[k]} left its square (seed ${seed})`);
        assert.ok(s.pts[k + 1] >= 50 - 1e-9 && s.pts[k + 1] <= 100 + 1e-9, `y ${s.pts[k + 1]} left its square`);
      }
      // A lone square is ragged on all four sides, so it is plainly smaller than the square it stands in.
      assert.equal(s.rims.length, 4);
      assert.ok(area(s.pts) < 2500 * 0.95, `a lone square is ragged: ${area(s.pts)}`);
    }
  }
});

test("thick smoke really hides what is under it; thin smoke does not", () => {
  // What a creature is seen through, as the painter stacks it: the haze over every smoking square, and the core over
  // the thick ones on top of that.
  const thin = HAZE_ALPHA;
  const thick = 1 - (1 - HAZE_ALPHA) * (1 - CORE_ALPHA);
  const thickest = 1 - (1 - HAZE_ALPHA) * (1 - CORE_ALPHA_TOP);
  assert.ok(thick >= 0.85, `a thick square must hide: ${thick}`);
  assert.ok(thickest >= 0.9, `the thickest must hide more still: ${thickest}`);
  // Thin smoke conceals and no more: a creature standing in it is still plainly there.
  assert.ok(thin > 0.2 && thin < 0.6, `thin smoke veils, it does not hide: ${thin}`);
  // And the step between the tiers is unmistakable, not a shade of alpha.
  assert.ok(thick - thin > 0.35, `the tiers must differ at a glance: ${thin} against ${thick}`);
});

test("the tiers differ in brush coverage too, not only in tone", () => {
  const patches = (v) => smokePuffs([{ i: 5, v }], geo).length;
  assert.ok(patches(DENSITY_CAP) >= patches(THIN) * 2, `${patches(DENSITY_CAP)} against ${patches(THIN)}`);
  // Every thick tone is above the thin tier's darkest, which is the line the two bodies are cut on.
  assert.ok(smokeTone(THICK) > THIN_TOP);
  assert.ok(smokeTone(THICK - 0.01) <= THIN_TOP);
});

test("a body is seeded and stable, and nonsense in is nothing out", () => {
  assert.deepEqual(smokeSheets(BLOCK, geo), smokeSheets(BLOCK, geo));
  assert.notDeepEqual(smokeSheets(BLOCK, geo), smokeSheets(BLOCK, { ...geo, seed: 8 }));
  // The order the cells arrive in changes nothing.
  assert.deepEqual(smokeSheets(BLOCK, geo), smokeSheets([...BLOCK].reverse(), geo));
  assert.deepEqual(smokeSheets(BLOCK, { ...geo, cols: 0 }), []);
  assert.deepEqual(smokeSheets(BLOCK, { ...geo, cell: 0 }), []);
  assert.deepEqual(smokeSheets(null, geo), []);
  assert.deepEqual(smokeSheets([{ i: 5, v: THIN - 0.01 }, { i: -2, v: 2 }, { i: "x", v: 2 }, null], geo), []);
  for (const s of smokeSheets(BLOCK, geo)) assert.ok(s.pts.every(Number.isFinite) && s.pts.length >= 8);
});

test("a square at the far right of the grid does not join the square at the far left of the next row", () => {
  // Cells 7 and 8 on a 4-wide grid are column 3 row 1 and column 0 row 2: they touch in the index, not on the map.
  const sheets = kindOf(smokeSheets([{ i: 7, v: 2 }, { i: 8, v: 2 }], geo), "haze");
  for (const s of sheets) assert.equal(s.rims.length, 4, `cell ${s.i} is alone on the map`);
});

test("a body's weight walks in and out while its outline stands still", () => {
  const s = smokeSheets([{ i: 5, v: 2 }], geo).find((x) => x.kind === "core");
  assert.equal(smokeSheetAt(null, s, 0).grow, 0);
  assert.equal(smokeSheetAt(null, s, 1).grow, 1);
  assert.equal(smokeSheetAt(s, null, 0).grow, 1);
  assert.equal(smokeSheetAt(s, null, 1).grow, 0);
  // Growing in or fading out, the outline is the one it had: the shape moves only on the round boundary.
  assert.deepEqual(smokeSheetAt(null, s, 0.5).pts, s.pts);
  assert.deepEqual(smokeSheetAt(s, null, 0.5).pts, s.pts);
  // A square that stayed is at full weight throughout, with its tone walking between the two rounds.
  const darker = { ...s, tone: 1 };
  assert.equal(smokeSheetAt(s, darker, 0.5).grow, 1);
  assert.equal(smokeSheetAt(s, darker, 0.5).tone, (s.tone + 1) / 2);
  assert.equal(smokeSheetAt(null, null, 0.5), null);
  assert.deepEqual(smokeSheetAt(null, s, 5), smokeSheetAt(null, s, 1));
});

// ---- The drift: the cloud walks from the round just gone to the one just written. ----

test("a puff that stayed walks from where it was to where it is", () => {
  const was = { x: 0, y: 0, r: 10, tone: 0.25, seed: 9 };
  const now = { x: 100, y: 50, r: 20, tone: 0.75, seed: 9 };
  assert.deepEqual(smokeBetween(was, now, 0), { x: 0, y: 0, r: 10, tone: 0.25, seed: 9 });
  assert.deepEqual(smokeBetween(was, now, 1), { x: 100, y: 50, r: 20, tone: 0.75, seed: 9 });
  const half = smokeBetween(was, now, 0.5);
  assert.equal(half.x, 50);
  assert.equal(half.y, 25);
  assert.equal(half.r, 15);
  assert.equal(half.tone, 0.5);
  // Out of range is clamped, never extrapolated past the round.
  assert.deepEqual(smokeBetween(was, now, 5), smokeBetween(was, now, 1));
  assert.deepEqual(smokeBetween(was, now, -5), smokeBetween(was, now, 0));
});

test("new smoke grows in and cleared smoke fades away, so neither pops", () => {
  const p = { x: 10, y: 10, r: 20, tone: 0.75, seed: 3 };
  const born = smokeBetween(null, p, 0), grown = smokeBetween(null, p, 1);
  assert.equal(born.tone, 0);
  assert.ok(born.r < p.r);
  assert.equal(grown.tone, p.tone);
  assert.equal(grown.r, p.r);
  const going = smokeBetween(p, null, 0), gone = smokeBetween(p, null, 1);
  assert.equal(going.tone, p.tone);
  assert.equal(gone.tone, 0);
  assert.ok(gone.r < p.r);
});

test("a puff sways on its own slow turn, the same on every screen", () => {
  const p = { x: 100, y: 100, r: 20, tone: 0.75, seed: 12345 };
  assert.deepEqual(smokeSway(p, 1000), smokeSway(p, 1000));
  assert.notDeepEqual(smokeSway(p, 1000), smokeSway(p, 2000));
  // It never leaves its own cell: the sway is a fraction of the puff's own radius.
  for (let ms = 0; ms < 20000; ms += 137) {
    const q = smokeSway(p, ms);
    assert.ok(Math.hypot(q.x - p.x, q.y - p.y) <= p.r, `swayed ${Math.hypot(q.x - p.x, q.y - p.y)}`);
    assert.equal(q.tone, p.tone);
    assert.equal(q.r, p.r);
  }
  // Two puffs do not sway in step.
  assert.notEqual(smokeSway(p, 1000).x, smokeSway({ ...p, seed: 777 }, 1000).x);
});

test("the drift is well inside a round, so the cloud is settled before the next one moves it", () => {
  assert.ok(SMOKE_DRIFT_MS > 0 && SMOKE_DRIFT_MS < 6000);
});

test("a scene's seed is its own, and the same on every screen", () => {
  assert.equal(smokeSeedOf("scene0000000000z"), smokeSeedOf("scene0000000000z"));
  assert.notEqual(smokeSeedOf("scene0000000000z"), smokeSeedOf("scene0000000000y"));
  for (const id of ["", null, undefined, "x"]) assert.ok(Number.isInteger(smokeSeedOf(id)) && smokeSeedOf(id) > 0);
});

// ---- What used to be five source-text guards, now driven through the code itself. ----
// Fix round 2: a regex over main.mjs can say that two lines exist; it cannot say that a THIRD one does not, and it
// never once ran the code. Everything below that has a pure surface is now exercised instead. One source test is
// kept at the very end, and says why.

// A PIXI stand-in that records what was painted, and a frame clock, so the drawing can really be run under node.
const fakePixi = () => {
  const calls = [];
  class Graphics {
    constructor() { this.destroyed = false; }
    clear() { calls.push(["clear"]); return this; }
    beginFill(colour, alpha) { calls.push(["fill", colour, alpha]); return this; }
    endFill() { return this; }
    // The points themselves, rounded, so a test can see the cloud MOVE and not merely be painted.
    drawPolygon(p) { calls.push(["poly", p.map((n) => Math.round(n * 100) / 100).join(",")]); return this; }
    lineStyle(w, c, a) { calls.push(["line", w, c, a]); return this; }
    moveTo() { return this; }
    lineTo() { return this; }
    destroy() { this.destroyed = true; }
  }
  class Container {
    constructor() { this.children = []; this.parent = null; this.destroyed = false; }
    addChild(c) { this.children.push(c); c.parent = this; return c; }
    destroy() { this.destroyed = true; for (const c of this.children) c.destroy?.(); }
  }
  return { PIXI: { Graphics, Container }, calls };
};
// requestAnimationFrame does not exist under node; this stands in for it and lets a test step the frames by hand.
const withFrames = (body) => {
  const had = [globalThis.requestAnimationFrame, globalThis.cancelAnimationFrame];
  const pending = new Map(), cancelled = [];
  let id = 0;
  globalThis.requestAnimationFrame = (fn) => { pending.set(++id, fn); return id; };
  globalThis.cancelAnimationFrame = (n) => { cancelled.push(n); pending.delete(n); };
  const frame = () => { const [[n, fn]] = pending.size ? [...pending] : [[0, null]]; pending.delete(n); fn?.(); };
  try { return body({ frame, cancelled, pending }); }
  finally { [globalThis.requestAnimationFrame, globalThis.cancelAnimationFrame] = had; }
};
const field = [{ i: 5, v: 2 }, { i: 6, v: 2 }, { i: 9, v: 0.5 }];
const drawn = (cells, geometry = geo) => ({ sheets: smokeSheets(cells, geometry), puffs: smokePuffs(cells, geometry) });

test("the drawing runs off the clock it is handed and never reaches for one of its own", () => {
  withFrames(({ frame }) => {
    const { PIXI, calls } = fakePixi();
    const root = new PIXI.Container();
    let ms = 0, asked = 0;
    const looks = createSmokeLooks({ PIXI, layer: () => root, grid: () => 100, now: () => { asked++; return ms; } });
    // Every clock a module could reach for instead is made to throw for the whole run: if any line of the picking,
    // the drift, the sway or the painting touches one, this test fails where a regex could only have guessed.
    const real = [Date.now, Math.random, globalThis.performance?.now];
    const bang = () => { throw new Error("the smoke read a clock or a die of its own"); };
    Date.now = bang; Math.random = bang;
    if (globalThis.performance) globalThis.performance.now = bang;
    try {
      looks.sync(drawn(field));
      for (ms = 0; ms <= SMOKE_DRIFT_MS * 2; ms += 100) frame();
    } finally {
      Date.now = real[0]; Math.random = real[1];
      if (globalThis.performance && real[2]) globalThis.performance.now = real[2];
    }
    assert.ok(asked > 0, "it does ask the clock it was given");
    assert.ok(calls.some((c) => c[0] === "poly"), "and it really painted");
  });
});

test("the same clock paints the same frame, and a later one a different frame: the drift is real", () => {
  const run = (at) => withFrames(({ frame }) => {
    const { PIXI, calls } = fakePixi();
    const root = new PIXI.Container();
    let ms = 0;
    const looks = createSmokeLooks({ PIXI, layer: () => root, grid: () => 100, now: () => ms });
    looks.sync(drawn(field));
    ms = at; frame();
    return JSON.stringify(calls);
  });
  assert.equal(run(SMOKE_DRIFT_MS), run(SMOKE_DRIFT_MS));
  // Part way through the drift the cloud is lighter than at the end of it: the bodies really walk their weight in.
  assert.notEqual(run(Math.round(SMOKE_DRIFT_MS / 3)), run(SMOKE_DRIFT_MS));
  // And well after the drift the sway still moves it, so a settled room keeps breathing.
  assert.notEqual(run(SMOKE_DRIFT_MS * 2), run(SMOKE_DRIFT_MS * 2 + 2000));
});

test("thick smoke is painted over a wider span of alpha than thin, and the darkest fill really is near solid", () => {
  const fills = (cells) => withFrames(({ frame }) => {
    const { PIXI, calls } = fakePixi();
    const root = new PIXI.Container();
    let ms = 0;
    const looks = createSmokeLooks({ PIXI, layer: () => root, grid: () => 100, now: () => ms });
    looks.sync(drawn(cells));
    ms = SMOKE_DRIFT_MS; frame();
    return calls.filter((c) => c[0] === "fill").map((c) => c[2]);
  });
  const thin = fills([{ i: 5, v: 0.5 }]), thick = fills([{ i: 5, v: DENSITY_CAP }]);
  assert.ok(Math.max(...thick) >= CORE_ALPHA, `a thick square is painted near solid: ${Math.max(...thick)}`);
  assert.ok(Math.max(...thin) <= HAZE_ALPHA + 1e-9, `a thin square never is: ${Math.max(...thin)}`);
});

test("teardown cancels the frame loop and destroys what it made", () => {
  withFrames(({ frame, cancelled, pending }) => {
    const { PIXI } = fakePixi();
    const root = new PIXI.Container();
    const looks = createSmokeLooks({ PIXI, layer: () => root, grid: () => 100, now: () => 0 });
    looks.sync(drawn(field));
    assert.equal(root.children.length, 1, "it put its container on the layer");
    const box = root.children[0];
    looks.clear();
    assert.ok(cancelled.length > 0, "the frame loop is cancelled");
    assert.equal(box.destroyed, true, "and the container destroyed with its children");
    // Nothing of the last cloud is kept: a sync after a clear starts over on a fresh container.
    looks.sync(drawn(field));
    assert.equal(root.children.length, 2);
    assert.notEqual(root.children[1], box);
    looks.clear();
    frame(); pending.clear();
  });
});

test("the drawing is safe before there is a layer to draw on, and on nothing at all", () => {
  withFrames(() => {
    const { PIXI, calls } = fakePixi();
    const looks = createSmokeLooks({ PIXI, layer: () => null, now: () => 0 });
    looks.sync(drawn(field));
    assert.deepEqual(calls, [], "no layer, nothing painted and nothing thrown");
    looks.clear();
    const root = new PIXI.Container();
    const live = createSmokeLooks({ PIXI, layer: () => root, now: () => 0 });
    live.sync();
    live.sync({ sheets: null, puffs: null });
    live.sync({ sheets: [{ pts: [0, 0, 1] }, null, { pts: [NaN, 0, 1, 1, 2, 2], tone: 1 }], puffs: [null, { x: NaN, y: 0, r: 1, tone: 1 }] });
    live.clear();
  });
});

test("the cloud's depth sits over the creatures it hides and under the birds", () => {
  assert.ok(SMOKE_SORT_LAYER > TOKEN_SORT_LAYER, "thick smoke must be painted over a creature standing in it");
  assert.ok(SMOKE_SORT_LAYER < BIRD_SORT_LAYER, "birds fly above the smoke");
  assert.notEqual(SMOKE_SORT_LAYER, 657, "not the fire's layer, which lies under the creatures");
  assert.notEqual(SMOKE_SORT_LAYER, 760, "not the old rolling haze's");
});

test("the haze stands down exactly where the simulation takes over, and nowhere else", () => {
  const scene = (own) => ({ flags: { animater: own } });
  const ALL = { smokeFills: true, breakableProps: true, fireSpreads: true };
  const haze = (own, { on = true, underground = true } = {}) =>
    airHazeShows({ on, underground, runs: smokeRunsOn(scene(own)) });
  // Everything on: the simulation runs, so the haze goes.
  assert.equal(haze(ALL), false);
  // THE CASE THAT WAS WRONG. The scene's own switch on but Fire spreads off: the drawing's gate is smokeRunsOn, so
  // no simulated smoke is drawn here — and the GM must therefore keep the haze they always had, not lose both.
  assert.equal(haze({ ...ALL, fireSpreads: false }), true, "smokeFills on, fireSpreads off: the haze still rolls");
  assert.equal(haze({ ...ALL, breakableProps: false }), true, "and with Breakable props off too");
  // The switch off: exactly today's answer, on every combination of the other two.
  for (const breakableProps of [true, false]) for (const fireSpreads of [true, false]) {
    assert.equal(haze({ smokeFills: false, breakableProps, fireSpreads }), true);
  }
  // Nothing can show a haze that the settings pair or the scene's depth rules out.
  assert.equal(haze({ smokeFills: false }, { on: false }), false);
  assert.equal(haze({ smokeFills: false }, { underground: false }), false);
  // There is never both at once, on any combination at all: that is the whole of Roi's decision.
  for (const smokeFills of [true, false]) for (const breakableProps of [true, false]) for (const fireSpreads of [true, false]) {
    const own = { smokeFills, breakableProps, fireSpreads };
    const draws = smokeRunsOn(scene(own));
    assert.equal(draws && haze(own), false, `both at once: ${JSON.stringify(own)}`);
    // And underground, with the pair on, the GM is never left with neither.
    assert.ok(draws || haze(own), `neither one: ${JSON.stringify(own)}`);
  }
  assert.equal(airHazeShows(), false);
  assert.equal(airHazeShows({ on: "true", underground: true, runs: false }), false);
});

test("the round's own marker and the reader that knows it are one constant", () => {
  // The test does not build a note of its own: it uses the very object main.mjs stamps its writes with, so moving
  // the marker without moving the reader fails HERE, in behaviour, and not only in a regex.
  assert.equal(smokeOnlySave({ "flags.animater.smoke.33": 1.08 }, SMOKE_NOTE), true);
  assert.equal(smokeOnlySave({ flags: { animater: { smoke: { 33: 1 }, smokeGrid: { cols: 10 } } } }, SMOKE_NOTE), true);
  assert.equal(smokeOnlySave({ "flags.animater.smoke.-=33": null, "flags.animater.-=smokeGrid": null }, SMOKE_NOTE), true);
  // A real edit riding along is still an edit, and somebody else's write is never ours.
  assert.equal(smokeOnlySave({ "flags.animater.smoke.33": 1, width: 2000 }, SMOKE_NOTE), false);
  assert.equal(smokeOnlySave({ "flags.animater.smoke.33": 1 }, {}), false);
  assert.equal(smokeOnlySave({ "flags.animater.smoke.33": 1 }, { animater: { propFire: true } }), false);
  // The marker is the one key the reader looks for, and it is the new name, not the settings pair's.
  assert.deepEqual(Object.keys(SMOKE_NOTE.animater), [SMOKE_MARK]);
  assert.equal(SMOKE_MARK, "smokeFills");
  assert.notEqual(SMOKE_MARK, "roomSmoke");
  assert.equal(SMOKE_NOTE.animater[SMOKE_MARK], true);
  // A note built with any other marker is not ours, whatever it carries. This is the drift the coupling guards.
  for (const other of ["roomSmoke", "smokeSource", "propFire"]) {
    if (other === SMOKE_MARK) continue;
    assert.equal(smokeOnlySave({ "flags.animater.smoke.33": 1 }, { animater: { [other]: true } }), false, other);
  }
});

test("the scene's switch and the light's are two distinct names, and neither is the settings pair's", () => {
  const scene = (own) => ({ flags: { animater: own } });
  const ALL = { breakableProps: true, fireSpreads: true };
  // The round runs off smokeFills, and the old name means nothing to it at all.
  assert.equal(smokeRunsOn(scene({ ...ALL, smokeFills: true })), true);
  assert.equal(smokeRunsOn(scene({ ...ALL, roomSmoke: true })), false, "the settings pair's name is not a scene flag");
  // The scene's checkbox carries the new name, and nothing carries the old one.
  const html = propSceneFieldsHTML({ smokeFills: true });
  assert.match(html, /name="flags\.animater\.smokeFills"/);
  assert.ok(!html.includes("roomSmoke"), "no roomSmoke left in the scene's own fields");
  assert.match(html, /smokeFills"[^>]*checked/);
  assert.doesNotMatch(propSceneFieldsHTML({}), /smokeFills"[^>]*checked/);
  // The light's flag is a third name again, so none of the three can be mistaken for another.
  assert.notEqual(SMOKE_MARK, "smokeSource");
});

// ---- The ONE source test that is kept, and why. ----
// main.mjs is Foundry's entry point: it is not importable under node, and the three things below live only in it,
// as wiring. There is no pure surface left to run them through — the layer depth, the haze rule, the marker, the
// scene's fields and the tiers are all exported constants or pure functions now, and tested as such above. What is
// left is whether main.mjs ASKS them, in the one place each, and whether the drawing block writes. A third haze
// site, or a stray scene.update in the painter, can only be seen in the text.
test("main.mjs's own wiring: the drawing writes nothing, and the haze is asked in one place only", () => {
  const main = readFileSync(new URL("../../../scripts/main.mjs", import.meta.url), "utf8");
  const looks = main.slice(main.indexOf("// ---- What the room smoke looks like"), main.indexOf("// A region repainted, reshaped or moved"));
  assert.ok(looks.length > 200, "the drawing block is where this expects it");
  for (const write of ["update(", "updateEmbeddedDocuments", "createEmbeddedDocuments", "deleteEmbeddedDocuments", "setFlag", "unsetFlag"]) {
    assert.ok(!looks.includes(write), `the drawing must not ${write}`);
  }
  // The haze rule is asked through the one helper. Counting every mention of the settings pair's reader is what a
  // pure test cannot do: it is the only way to know that a THIRD place does not ask the question its own way.
  const asks = [...main.matchAll(/roomSmokeOn\(\)/g)].length;
  assert.equal(asks, 1, `roomSmokeOn is read once, inside hazeSmokeOn: found ${asks}`);
  assert.match(main, /const hazeSmokeOn = \(\) => airHazeShows\(\{ on: roomSmokeOn\(\), underground: undergroundScene\(\), runs: smokeRunsHere\(\) \}\);/);
  // Exactly the two places the haze shows ask it, and there is no third: the lamp air's fill and its strength.
  assert.equal([...main.matchAll(/hazeSmokeOn\(\)/g)].length, 2, "the two places the haze is asked, and no third");
  assert.match(main, /if \(!airField \|\| !hazeSmokeOn\(\)\) \{ smokeAir = null; lampAir\.smokeFill\(null\); return; \}/);
  assert.match(main, /smoke: hazeSmokeOn\(\) \? 0\.85 : 0/);
  // And the settings pair itself is deliberately left alone: it is the third thing that wore the old name.
  assert.match(main, /skyPair\("roomSmoke", "roomSmokeLocal", "Smoke in the air"/);
  // The marker is imported, never copied: a second literal here is the drift the coupling test cannot see.
  assert.ok(!/SMOKE_NOTE\s*=/.test(main), "main.mjs keeps no marker of its own");
  assert.match(main, /import \{[^}]*SMOKE_NOTE[^}]*\} from "\.\/engines\/props\/smoke-round\.mjs"/);
  // The light's own flag, whose only home is this file's light-configuration HTML.
  assert.match(main, /name="flags\.\$\{ID\}\.smokeSource"\$\{flags\.smokeSource === true \? " checked" : ""\}/);
  // And no document flag anywhere still answers to the settings pair's old name.
  for (const line of main.split(/\r?\n/)) {
    if (!line.includes("roomSmoke")) continue;
    assert.doesNotMatch(line, /flags[^\n]*roomSmoke|roomSmoke:\s*(true|false|flags)/, `still a roomSmoke flag: ${line.trim()}`);
  }
});
