// What the smoke a fire fills a room with looks like: the picking (pure and seeded), the drift between rounds, and
// the two guards on main.mjs's own text — the drawing writes nothing, and the old rolling haze stands down where the
// new simulated smoke runs.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { smokePuffs, smokeTone, smokeBetween, smokeSway, smokeSeedOf, airHazeShows, TONE_STEPS, SMOKE_DRIFT_MS } from "../../../scripts/engines/props/smoke-look.mjs";
import { THICK, THIN, DENSITY_CAP } from "../../../scripts/engines/props/smoke-field.mjs";

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

// ---- Roi's decision: one smoke per scene. The old rolling haze stands down where the new one runs. ----

test("the scene's switch sends the old haze away, and leaves it alone when it is off", () => {
  // The switch on: no haze at all, whatever the setting and however deep the scene.
  assert.equal(airHazeShows({ on: true, underground: true, fills: true }), false);
  assert.equal(airHazeShows({ on: true, underground: false, fills: true }), false);
  // The switch off: exactly today's answer — the setting pair on, and an underground scene.
  assert.equal(airHazeShows({ on: true, underground: true, fills: false }), true);
  assert.equal(airHazeShows({ on: true, underground: false, fills: false }), false);
  assert.equal(airHazeShows({ on: false, underground: true, fills: false }), false);
  assert.equal(airHazeShows({ on: false, underground: false, fills: false }), false);
  // Nothing given is nothing shown.
  assert.equal(airHazeShows(), false);
  assert.equal(airHazeShows({}), false);
  // Only a real true counts, on any of the three.
  assert.equal(airHazeShows({ on: "true", underground: true, fills: false }), false);
  assert.equal(airHazeShows({ on: true, underground: "true", fills: false }), false);
  assert.equal(airHazeShows({ on: true, underground: true, fills: "true" }), true);
});

// ---- The guards that are about main.mjs's own text. ----

const main = readFileSync(new URL("../../../scripts/main.mjs", import.meta.url), "utf8");
const looks = main.slice(main.indexOf("// ---- What the room smoke looks like"), main.indexOf("// A region repainted, reshaped or moved"));

test("the drawing is wired as the fire's is: its own layer, an injected clock, cleared on teardown", () => {
  assert.ok(looks.length > 200, "the smoke drawing block is where its guards expect it");
  // Its own depth, over the creatures it hides and under the birds; not the fire's 657, not the old haze's 760.
  const layer = looks.match(/floorLayer\("smokeLooks", (\d+)\)/);
  assert.ok(layer, "its own named layer");
  assert.ok(Number(layer[1]) > 700 && Number(layer[1]) < 1100, `over the creatures, under the birds: ${layer[1]}`);
  assert.notEqual(layer[1], "657");
  assert.notEqual(layer[1], "760");
  // The clock is injected, as createFireLooks takes it: nothing inside the drawing reads one.
  assert.match(looks, /now: \(\) => fireNow\(\)/);
  assert.match(looks, /Hooks\.on\("canvasTearDown", \(\) => \{[^\n]*smokeLooks\.clear\(\)/);
  // Debounced through propSafe, as the fire looks are.
  assert.match(looks, /setTimeout\(\(\) => propSafe\("smoke looks", syncSmokeLooksNow\), 60\)/);
});

test("the drawing writes nothing at all", () => {
  for (const write of ["update(", "updateEmbeddedDocuments", "createEmbeddedDocuments", "deleteEmbeddedDocuments", "setFlag", "unsetFlag"]) {
    assert.ok(!looks.includes(write), `the drawing must not ${write}`);
  }
});

test("no clock and no dice anywhere in the smoke's own code", () => {
  const look = readFileSync(new URL("../../../scripts/engines/props/smoke-look.mjs", import.meta.url), "utf8");
  assert.ok(!/Math\.random|Date\.now|performance\.now/.test(look));
  assert.ok(!/Math\.random|Date\.now|performance\.now/.test(looks));
});

test("the old haze asks the one shared question, at both the places it shows", () => {
  // The gate is the pure one, not a second copy of the rule.
  assert.match(main, /const hazeSmokeOn = \(\) => airHazeShows\(\{ on: roomSmokeOn\(\), underground: undergroundScene\(\), fills: smokeFillsHere\(\) \}\);/);
  // Where it stood down, it also lets the lamp air go: nothing of the old haze is left on the screen.
  assert.match(main, /if \(!airField \|\| !hazeSmokeOn\(\)\) \{ smokeAir = null; lampAir\.smokeFill\(null\); return; \}/);
  assert.match(main, /smoke: hazeSmokeOn\(\) \? 0\.85 : 0/);
  // And the old settings pair itself is untouched: it is a third thing with the same old name, deliberately left.
  assert.match(main, /skyPair\("roomSmoke", "roomSmokeLocal", "Smoke in the air"/);
});

test("the new scene and light flags no longer share a name with the settings pair", () => {
  // No DOCUMENT flag answers to roomSmoke any more: what is left of the name is the settings pair and the layer the
  // old haze is drawn in, which are deliberately untouched.
  for (const line of main.split(/\r?\n/)) {
    if (!line.includes("roomSmoke")) continue;
    assert.doesNotMatch(line, /flags[^\n]*roomSmoke|roomSmoke:\s*(true|false|flags)/, `still a roomSmoke flag: ${line.trim()}`);
  }
  // And the two modules the flags are read in have no trace of the old name at all.
  for (const path of ["../../../scripts/engines/props/smoke-round.mjs", "../../../scripts/ui/prop-config.mjs"]) {
    assert.ok(!readFileSync(new URL(path, import.meta.url), "utf8").includes("roomSmoke"), path);
  }
  // The marker the round stamps its own writes with, and the reader that tells them from a GM's edit, moved together.
  assert.match(main, /const SMOKE_NOTE = \{ animater: \{ smokeFills: true \} \};/);
  assert.match(readFileSync(new URL("../../../scripts/engines/props/smoke-round.mjs", import.meta.url), "utf8"),
    /if \(options\?\.animater\?\.smokeFills !== true\) return false;/);
  // The scene's switch and the light's are two distinct names, and both are the new ones.
  assert.match(main, /smokeFills: flags\.smokeFills === true/);
  assert.match(main, /name="flags\.\$\{ID\}\.smokeSource"/);
});
