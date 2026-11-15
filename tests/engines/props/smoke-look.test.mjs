// What the smoke a fire fills a room with looks like: the field it is drawn from, the three looks, what a creature
// standing in it is seen through, the drift between rounds, the bake, and teardown.
//
// EVERY TEST HERE IS A TEST OF BEHAVIOUR. An earlier round of this feature shipped tests that matched literal source
// text and passed whatever the code did, which hid four real bugs; so nothing below reads the module's source, and
// the look is judged by numbers that come out of the very functions the screen is painted from:
//   - smokeCover is the falloff the bake paints and the sprites composite, so "a creature in thick smoke is hidden"
//     is measured, not asserted;
//   - "the cloud is not built out of cells" is measured as the SPREAD of the feather along a straight wall: a
//     cell-shaped cloud has the same edge everywhere, and this one cannot;
//   - the drawing is really run, with a fake PIXI and a fake canvas, and the sprites it places are inspected.
// The one source test that remains is about main.mjs — absences and counts in a file no pure test can see — and says
// why it is kept.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createSmokeLooks, createSmokeBank, smokeForms, smokeWash, smokePuffs, smokeSheets, smokeFieldOf,
  smokeDensityAt, smokeWeight, smokeBand, smokeTone, smokeCover, formCoverAt, formProfile, smokeOutsideBy,
  smokeHeadroom, formRim, FORM_RIM, smokeBetween, smokeSway, smokeSeedOf, smokeNoise, paintForm, paintWashTile, paintMask,
  airHazeShows, airHazeFor, washAt, SMOKE_LOOKS, SMOKE_LOOK_NAMES, DEFAULT_SMOKE_LOOK, TONE_STEPS, THIN_TOP,
  THICK_COVER, THIN_COVER, OVERHANG, SMOKE_DRIFT_MS, SMOKE_SWAY, SMOKE_FRAME_MS, FORM_PX, WASH_PX,
  SMOKE_SORT_LAYER, TOKEN_SORT_LAYER, BIRD_SORT_LAYER } from "../../../scripts/engines/props/smoke-look.mjs";
import { THICK, THIN, DENSITY_CAP } from "../../../scripts/engines/props/smoke-field.mjs";
import { smokeOnlySave, smokeRunsOn, SMOKE_NOTE, SMOKE_MARK } from "../../../scripts/engines/props/smoke-round.mjs";
import { propSceneFieldsHTML, smokeLightFieldHTML, SMOKE_LIGHT_FLAG } from "../../../scripts/ui/prop-config.mjs";

// A real map's square, not the 50px grid an earlier look was judged on and flattered by.
const CELL = 100, COLS = 20;
const geo = (over = {}) => ({ cols: COLS, origin: { x: 0, y: 0 }, cell: CELL, seed: 7, ...over });
// A room of 8x6 squares, columns 2-9 and rows 2-7, every square at the same density.
const room = (v, { from = [2, 2], to = [9, 7] } = {}) => {
  const out = [];
  for (let r = from[1]; r <= to[1]; r++) for (let c = from[0]; c <= to[0]; c++) out.push({ i: r * COLS + c, v });
  return out;
};
// The same room thick in the middle and thin round the rim, which is what a real round leaves behind.
const mixedRoom = () => room(2.6).map((c) => {
  const col = c.i % COLS, r = (c.i - col) / COLS;
  return { ...c, v: col === 2 || col === 9 || r === 2 || r === 7 ? 0.6 : 2.6 };
});
const at = (c, r, dx = 0, dy = 0) => [(c + 0.5 + dx) * CELL, (r + 0.5 + dy) * CELL];
// The whole cloud of a field under one look, as the drawing paints it: the forms always, and the washes only for
// the look that lays them down. main.mjs hands sync both and each look takes what it needs, so a test that counted
// the wash under "billow" would be measuring a cloud nobody ever sees.
const cloudOf = (cells, look = DEFAULT_SMOKE_LOOK, over = {}) => ({
  forms: smokeForms(cells, geo({ ...over, look })),
  wash: SMOKE_LOOKS[look]?.wash ? smokeWash(cells, geo(over)) : null,
});

// ---- The field: the cells are the input, not the shape. ----

test("the stored cells are read as a field that can be asked anywhere, not as a set of squares", () => {
  const field = smokeFieldOf([{ i: 2 * COLS + 2, v: 3 }, { i: 2 * COLS + 3, v: 1 }], geo());
  // Dead on a cell's centre, the cell's own value.
  assert.equal(smokeDensityAt(field, ...at(2, 2)), 3);
  assert.equal(smokeDensityAt(field, ...at(3, 2)), 1);
  // Halfway between two centres, halfway between their values: there is no step anywhere for an edge to follow.
  assert.ok(Math.abs(smokeDensityAt(field, 3 * CELL, 2.5 * CELL) - 2) < 1e-9);
  // And it falls smoothly to nothing over the square beyond the last one, which is the soft boundary for free.
  const out = [0, 0.25, 0.5, 0.75, 1].map((k) => smokeDensityAt(field, (2.5 - k) * CELL, 2.5 * CELL));
  for (let i = 1; i < out.length; i++) assert.ok(out[i] < out[i - 1], `falls off: ${out.join(" ")}`);
  assert.equal(out[out.length - 1], 0);
  // Nothing to paint is null, and nonsense never becomes a NaN.
  assert.equal(smokeFieldOf([{ i: 5, v: THIN - 0.01 }], geo()), null);
  assert.equal(smokeFieldOf([{ i: 5, v: 2 }], geo({ cols: 0 })), null);
  assert.equal(smokeFieldOf([{ i: 5, v: 2 }], geo({ cell: 0 })), null);
  assert.equal(smokeFieldOf(null, geo()), null);
  assert.equal(smokeDensityAt(null, 0, 0), 0);
  assert.equal(smokeDensityAt(smokeFieldOf([{ i: 5, v: 2 }], geo()), NaN, 0), 0);
});

test("a density below the thin floor is no smoke at all, and the weight rises with it", () => {
  assert.equal(smokeWeight(THIN - 0.01), 0);
  assert.equal(smokeWeight(0), 0);
  assert.equal(smokeWeight("x"), 0);
  let last = -1;
  for (let d = THIN; d <= DENSITY_CAP; d += 0.05) {
    const w = smokeWeight(d);
    assert.ok(w > last, `rises at ${d}`);
    assert.ok(w > 0 && w <= 1);
    last = w;
  }
  // What blocks sight is always heavier than what merely conceals, on both sides of the line.
  assert.ok(smokeWeight(THICK) > smokeWeight(THICK - 1e-6));
  assert.ok(smokeWeight(THICK) > smokeWeight((THIN + THICK) / 2));
  // Painted in whole steps, never a smooth photographic ramp.
  assert.equal(smokeBand(THIN - 0.01), 0);
  assert.ok(smokeBand(DENSITY_CAP) <= TONE_STEPS && smokeBand(DENSITY_CAP) >= smokeBand(THICK));
  assert.ok(new Set([THIN, 0.6, 1.0, 1.5, 2.5, DENSITY_CAP].map(smokeBand)).size > 1);
  assert.ok(smokeTone(DENSITY_CAP) > THIN_TOP && smokeTone(THIN) <= THIN_TOP);
});

test("one form's falloff is stepped inside and feathered at the rim: painted, and never a line", () => {
  assert.equal(formProfile(0), 1);
  assert.equal(formProfile(1), 0);
  assert.equal(formProfile(1.2), 0);
  assert.equal(formProfile(-1), 0);
  let last = 2;
  for (let t = 0; t < 1; t += 0.02) {
    const v = formProfile(t);
    assert.ok(v <= last + 1e-9, `never rises outward at ${t}`);
    last = v;
  }
  // Stepped: a handful of values over the middle, not a different one every sample.
  const inner = new Set([...Array(40)].map((_, k) => formProfile((k / 40) * 0.75).toFixed(4)));
  assert.ok(inner.size > 1 && inner.size <= TONE_STEPS + 2, `stepped tone, ${inner.size} steps`);
  // Feathered: the last of the rim is a ramp to nothing, so no form ends at a hard circle.
  assert.ok(formProfile(0.97) > 0 && formProfile(0.97) < formProfile(0.85) / 2);
});

// ---- The three looks, each judged on the same brief. ----

test("every look is a different cloud from the same field, and all three are offered", () => {
  assert.deepEqual(SMOKE_LOOK_NAMES, ["billow", "drift", "wash"]);
  assert.ok(SMOKE_LOOK_NAMES.includes(DEFAULT_SMOKE_LOOK));
  const cells = mixedRoom();
  const shapes = SMOKE_LOOK_NAMES.map((look) => JSON.stringify(smokeForms(cells, geo({ look }))));
  assert.equal(new Set(shapes).size, 3, "three looks, three clouds");
  // An unknown look is the shipped one, never a throw and never an empty map.
  assert.deepEqual(smokeForms(cells, geo({ look: "nonsense" })), smokeForms(cells, geo({ look: DEFAULT_SMOKE_LOOK })));
});

for (const look of SMOKE_LOOK_NAMES) {
  test(`${look}: the same cells, seed and look give the same cloud, every time`, () => {
    const cells = mixedRoom();
    assert.deepEqual(smokeForms(cells, geo({ look })), smokeForms(cells, geo({ look })));
    const a = smokeWash(cells, geo()), b = smokeWash(cells, geo());
    assert.deepEqual([...a.thin], [...b.thin]);
    assert.deepEqual([...a.thick], [...b.thick]);
    // The order the cells arrive in is not the cloud's order.
    assert.deepEqual(smokeForms([...cells].reverse(), geo({ look })), smokeForms(cells, geo({ look })));
    // A different scene wears a different brush, and the same scene somewhere else carries its cloud with it.
    assert.notDeepEqual(smokeForms(cells, geo({ look, seed: 8 })), smokeForms(cells, geo({ look })));
    const moved = smokeForms(cells, geo({ look, origin: { x: 300, y: 200 } }));
    const home = smokeForms(cells, geo({ look }));
    assert.equal(moved.length, home.length);
    for (let k = 0; k < home.length; k++) {
      assert.ok(Math.abs(moved[k].x - home[k].x - 300) < 1e-6);
      assert.ok(Math.abs(moved[k].y - home[k].y - 200) < 1e-6);
    }
  });

  test(`${look}: thick smoke hides what stands in it and thin smoke does not`, () => {
    // Measured through smokeCover, which is the falloff the bake paints and the sprites composite: this is the
    // mechanical promise of the two tiers, not a matter of taste.
    const sample = (cells, c, r) => {
      const cloud = cloudOf(cells, look);
      let worst = 1, best = 0;
      for (const [dx, dy] of [[0, 0], [0.3, 0.3], [-0.3, 0.3], [0.3, -0.3], [-0.3, -0.3]]) {
        const v = smokeCover(cloud, ...at(c, r, dx, dy));
        worst = Math.min(worst, v); best = Math.max(best, v);
      }
      return { worst, best };
    };
    const thickRoom = room(2.6), thinRoom = room(0.6);
    for (let r = 3; r <= 6; r++) for (let c = 3; c <= 8; c++) {
      const { worst } = sample(thickRoom, c, r);
      assert.ok(worst >= THICK_COVER, `a creature in thick smoke at ${c},${r} is seen through ${worst.toFixed(3)}`);
    }
    for (let r = 3; r <= 6; r++) for (let c = 3; c <= 8; c++) {
      const { best } = sample(thinRoom, c, r);
      assert.ok(best <= THIN_COVER, `a creature in thin smoke at ${c},${r} is hidden to ${best.toFixed(3)}`);
    }
    // And the two read apart at a glance, not by a shade: a wide gap between the tiers at the same spot.
    const thick = smokeCover(cloudOf(thickRoom, look), ...at(5, 4));
    const thin = smokeCover(cloudOf(thinRoom, look), ...at(5, 4));
    assert.ok(thick - thin > 0.3, `the tiers are ${thin.toFixed(2)} against ${thick.toFixed(2)}`);
  });

  test(`${look}: the cloud feathers out to nothing instead of stopping at a line`, () => {
    const cloud = cloudOf(room(2.6), look);
    // Walking out from the room's edge along twenty rays: the paint falls away over a stretch and is gone, and it
    // is gone at different distances on different rays. One ray could be a lucky gap in a stream, so what is
    // measured is the whole wall.
    const steps = [0, 0.15, 0.3, 0.5, 0.75, 1];
    const rays = [...Array(20).keys()].map((k) => steps.map((d) => smokeCover(cloud, (2 - d) * CELL, (2.2 + (k / 20) * 5.6) * CELL)));
    const mean = steps.map((_, i) => rays.reduce((a, ray) => a + ray[i], 0) / rays.length);
    for (let i = 1; i < mean.length; i++) assert.ok(mean[i] <= mean[i - 1] + 1e-9, `falls away: ${mean.map((v) => v.toFixed(3)).join(" ")}`);
    assert.ok(mean[1] > 0.02, `there is paint beyond the last square: ${mean.map((v) => v.toFixed(3)).join(" ")}`);
    assert.ok(mean[mean.length - 1] < 0.02, `and none of it a square out: ${mean.map((v) => v.toFixed(3)).join(" ")}`);
    const soft = rays.filter((ray) => ray[1] > 0.02).length;
    assert.ok(soft > rays.length / 3, `the boundary is soft along the wall, not at ${soft} of ${rays.length} points`);
    // And it is a band, not a cliff: out there the cloud is a fraction of what it is inside.
    const inside = smokeCover(cloud, ...at(3, 4));
    assert.ok(mean.some((v) => v > 0.02 && v < inside * 0.7), `a soft boundary: inside ${inside.toFixed(2)}, out ${mean.map((v) => v.toFixed(3)).join(" ")}`);
  });

  test(`${look}: no edge of the cloud follows the grid, however straight the wall is`, () => {
    // The failure this pins is the rejected look exactly: squares merged into a polygon gave a dead straight edge
    // corner to corner along a straight run of cells. Here the feather is measured at forty points along one wall
    // of a plain rectangular room; a cell-built cloud gives the same number every time.
    const cloud = cloudOf(room(2.6), look);
    const reach = [];
    for (let k = 0; k < 40; k++) {
      const y = (2.1 + (k / 40) * 5.8) * CELL;
      let far = 0;
      for (let d = 0; d <= 1.2; d += 0.02) if (smokeCover(cloud, (2 - d) * CELL, y) > 0.06) far = d;
      reach.push(far);
    }
    const mean = reach.reduce((a, b) => a + b, 0) / reach.length;
    const sd = Math.sqrt(reach.reduce((a, b) => a + (b - mean) ** 2, 0) / reach.length);
    assert.ok(new Set(reach.map((v) => v.toFixed(2))).size > 6, `a wandering edge, not ${new Set(reach).size} values`);
    assert.ok(sd > 0.04, `the edge wanders by ${sd.toFixed(3)} squares`);
    assert.ok(mean > 0, "and it does reach past the cells");
  });

  test(`${look}: no paint goes further than the overhang past the squares the GM wrote`, () => {
    // A cloud has to spill a little or it would stop at a line, but a wall is a wall: whatever the look, nothing is
    // painted more than OVERHANG past the cells, so smoke cannot wash into the room next door.
    const cells = mixedRoom(), cloud = cloudOf(cells, look);
    const field = smokeFieldOf(cells, geo());
    for (let r = 0; r <= 11; r++) for (let c = 0; c <= 14; c++) for (const [dx, dy] of [[0, 0], [0.4, 0], [0, 0.4], [0.4, 0.4]]) {
      const [x, y] = at(c, r, dx, dy);
      if (smokeOutsideBy(field, x, y) <= (OVERHANG + 0.25) * CELL) continue;
      assert.ok(smokeCover(cloud, x, y) < 0.01, `paint ${smokeCover(cloud, x, y).toFixed(3)} well past the cells at ${c},${r}`);
    }
    // Every form stands in a square that is really smoking; only its paint reaches beyond.
    for (const f of smokeForms(cells, geo({ look }))) {
      assert.equal(smokeOutsideBy(field, f.x, f.y), 0, `a form at ${f.x},${f.y} outside the smoke`);
      assert.ok(f.r > 0 && f.a > 0 && Number.isFinite(f.r) && Number.isFinite(f.a));
    }
  });

  test(`${look}: nothing is painted where the smoke is too thin to count, and nonsense is nothing`, () => {
    assert.deepEqual(smokeForms(room(THIN - 0.01), geo({ look })), []);
    assert.deepEqual(smokeForms([{ i: 5, v: 0 }], geo({ look })), []);
    assert.ok(smokeForms(room(THIN), geo({ look })).length > 0);
    assert.deepEqual(smokeForms([{ i: -1, v: 2 }, { i: 1.5, v: 2 }, { i: "x", v: 2 }, null], geo({ look })), []);
    assert.deepEqual(smokeForms(null, geo({ look })), []);
    assert.deepEqual(smokeForms(room(2), geo({ look, cols: 0 })), []);
    assert.deepEqual(smokeForms(room(2), geo({ look, cell: 0 })), []);
    for (const f of smokeForms([{ i: 5, v: "x" }, { i: 2 * COLS + 2, v: 2 }], geo({ look }))) {
      assert.ok([f.x, f.y, f.r, f.a, f.angle, f.squash].every(Number.isFinite), JSON.stringify(f));
    }
  });

  test(`${look}: a form is never the size or the shape of a square, and no two share a straight side`, () => {
    // What the two rejected looks both did: the first drew one patch per square, the second gave each square a
    // polygon with sides that ran corner to corner. A form here is placed off any cell lattice and sized off it too.
    const forms = smokeForms(mixedRoom(), geo({ look }));
    assert.ok(forms.length > 50, `a filled room is a cloud of forms: ${forms.length}`);
    // Where a form stands inside its square tells the whole story: a cloud built out of cells piles its shapes at
    // the middles (the first rejected look) or on the edges (the second). This one is spread evenly across the
    // square, so there is nothing for the eye to line up.
    for (const axis of ["x", "y"]) {
      const bins = new Array(10).fill(0);
      for (const f of forms) bins[Math.min(9, Math.floor((((f[axis] / CELL) % 1) + 1) % 1 * 10))]++;
      for (let b = 0; b < 10; b++) {
        assert.ok(bins[b] > 0, `${axis}: nothing at all a tenth of the way along a square (${bins.join(",")})`);
        assert.ok(bins[b] < forms.length * 0.2, `${axis}: forms pile up at the ${b}th tenth (${bins.join(",")})`);
      }
    }
    // And their sizes are all over the place, so no two neighbours make a straight shared side.
    assert.ok(new Set(forms.map((f) => f.r.toFixed(1))).size > 8, "many sizes");
  });
}

test("the wash look's masks are a soft, warped shape and know nothing about the grid", () => {
  const plan = smokeWash(mixedRoom(), geo());
  assert.ok(plan.w > 0 && plan.h > 0 && plan.px === CELL / WASH_PX);
  // The thin mask covers everything smoking; the thick one only the thick tier, and it is empty where nothing is thick.
  assert.ok(washAt(plan, plan.thin, ...at(5, 4)) > 0.8);
  assert.ok(washAt(plan, plan.thick, ...at(5, 4)) > 0.5);
  const thinOnly = smokeWash(room(0.6), geo());
  assert.ok(washAt(thinOnly, thinOnly.thin, ...at(5, 4)) > 0.3);
  assert.ok(Math.max(...thinOnly.thick) === 0, "thin smoke never paints the thick wash");
  // The mask's own edge wanders: along a straight wall, the value at a fixed distance out is never the same twice.
  const along = [];
  for (let k = 0; k < 30; k++) along.push(washAt(plan, plan.thin, 1.9 * CELL, (2.2 + (k / 30) * 5.6) * CELL));
  assert.ok(new Set(along.map((v) => v.toFixed(2))).size > 5, `a warped edge: ${along.map((v) => v.toFixed(2)).join(" ")}`);
  // And it is soft: there are plenty of part-way values, not just on and off.
  const mid = [...plan.thin].filter((v) => v > 20 && v < 235).length;
  assert.ok(mid > plan.thin.length * 0.05, `a feathered mask: ${mid} of ${plan.thin.length} part-way`);
  assert.equal(smokeWash(room(THIN - 0.01), geo()), null);
  assert.equal(washAt(null, null, 0, 0), 0);
});

test("the geometry is the one the cells were written with, not a grid of the drawing's own", () => {
  // The cloud of the same indices on a 70px grid stands where a 70px grid puts them; nothing in here assumes 100.
  const cells = room(2.6);
  const small = smokeForms(cells, geo({ cell: 70 })), big = smokeForms(cells, geo({ cell: 140 }));
  const span = (forms) => Math.max(...forms.map((f) => f.x)) - Math.min(...forms.map((f) => f.x));
  assert.ok(span(big) > span(small) * 1.7, "the cloud scales with the square it was written against");
  // A cell index means a different place on a wider grid, and the cloud follows the index, not the pixel.
  const wide = smokeForms([{ i: 25, v: 2 }], geo({ cols: 25 }));
  const narrow = smokeForms([{ i: 25, v: 2 }], geo({ cols: 5 }));
  assert.notEqual(Math.round(wide[0]?.y ?? 0), Math.round(narrow[0]?.y ?? 0));
});

test("how far a point is inside the smoke, and how far outside it, are two honest answers", () => {
  const field = smokeFieldOf(room(2.6), geo());
  assert.equal(smokeOutsideBy(field, ...at(5, 4)), 0);
  assert.ok(smokeOutsideBy(field, ...at(0, 4)) > CELL);
  assert.ok(smokeHeadroom(field, ...at(5, 4)) > CELL, "deep inside there is room");
  assert.ok(smokeHeadroom(field, ...at(2, 4)) < CELL, "at the rim there is not");
  assert.equal(smokeOutsideBy(null, 0, 0), Infinity);
  assert.equal(smokeHeadroom(null, 0, 0), 0);
});

// ---- The drift from one round to the next. ----

test("the cloud drifts between rounds instead of jumping: a form that stays keeps its name", () => {
  const before = smokeForms(room(1.6), geo()), after = smokeForms(room(2.6), geo());
  const kept = new Set(before.map((f) => f.seed));
  const same = after.filter((f) => kept.has(f.seed)).length;
  assert.ok(same > after.length * 0.6, `${same} of ${after.length} forms carried over`);
  // A round that thickens the smoke darkens the forms that stayed rather than moving them.
  const was = new Map(before.map((f) => [f.seed, f]));
  const moved = after.filter((f) => was.has(f.seed)).filter((f) => Math.hypot(f.x - was.get(f.seed).x, f.y - was.get(f.seed).y) > 1e-9);
  assert.equal(moved.length, 0, "a form that is still there has not moved");
  const heavier = after.filter((f) => was.has(f.seed) && f.a > was.get(f.seed).a).length;
  assert.ok(heavier > 0, "but it is painted more heavily");
});

test("a form grows in and pales away instead of appearing and vanishing whole", () => {
  const form = { x: 10, y: 20, r: 30, a: 0.5, band: 3, seed: 9 };
  assert.equal(smokeBetween(null, null, 0.5), null);
  const grow = [0, 0.5, 1].map((k) => smokeBetween(null, form, k));
  assert.equal(grow[0].a, 0);
  assert.ok(grow[1].a > 0 && grow[1].a < form.a && grow[1].r < form.r);
  assert.equal(grow[2].a, form.a);
  const fade = [0, 0.5, 1].map((k) => smokeBetween(form, null, k));
  assert.equal(fade[0].a, form.a);
  assert.ok(fade[1].a < form.a && fade[2].a === 0);
  // Both sides there: it walks from one to the other, and clamps outside 0-1.
  const to = { ...form, x: 110, a: 0.9 };
  assert.equal(smokeBetween(form, to, 0.5).x, 60);
  assert.equal(smokeBetween(form, to, 2).x, 110);
  assert.equal(smokeBetween(form, to, -1).x, 10);
  assert.equal(smokeBetween(form, to, "x").x, 10);
});

test("a form sways on its own little circle, off the clock it is handed, and never leaves its own ground", () => {
  const form = { x: 100, y: 100, r: 40, a: 0.5, band: 3, seed: 12345 };
  assert.equal(smokeSway(null, 0), null);
  assert.deepEqual(smokeSway(form, 1000), smokeSway(form, 1000));
  assert.notDeepEqual(smokeSway(form, 1000), smokeSway(form, 2000));
  for (let ms = 0; ms < 20000; ms += 137) {
    const q = smokeSway(form, ms);
    const moved = Math.hypot(q.x - form.x, q.y - form.y);
    assert.ok(moved <= form.r * SMOKE_SWAY + 1e-9, `swayed ${moved} of ${form.r}`);
    assert.equal(q.a, form.a);
    assert.equal(q.r, form.r);
  }
  // Two forms do not sway in step, and the sway is well inside the overhang, so it cannot carry paint through a wall.
  assert.notEqual(smokeSway(form, 1000).x, smokeSway({ ...form, seed: 777 }, 1000).x);
  assert.ok(SMOKE_SWAY < OVERHANG);
});

test("the drift is well inside a round, so the cloud is settled before the next one moves it", () => {
  assert.ok(SMOKE_DRIFT_MS > 0 && SMOKE_DRIFT_MS < 6000);
});

test("a scene's seed is its own, and the same on every screen", () => {
  assert.equal(smokeSeedOf("scene0000000000z"), smokeSeedOf("scene0000000000z"));
  assert.notEqual(smokeSeedOf("scene0000000000z"), smokeSeedOf("scene0000000000y"));
  for (const id of ["", null, undefined, "x"]) assert.ok(Number.isInteger(smokeSeedOf(id)) && smokeSeedOf(id) > 0);
});

test("the noise the cloud is warped by is seeded, smooth and the same on every screen", () => {
  assert.equal(smokeNoise(5, 10, 20, 100), smokeNoise(5, 10, 20, 100));
  assert.notEqual(smokeNoise(5, 10, 20, 100), smokeNoise(6, 10, 20, 100));
  for (let k = 0; k < 50; k++) {
    const v = smokeNoise(5, k * 7.3, k * 3.1, 100);
    assert.ok(v >= 0 && v <= 1, `${v}`);
  }
  // Smooth: two points a tenth of a wavelength apart are close, so the warp is a wander and not a fizz.
  const a = smokeNoise(5, 1000, 1000, 100), b = smokeNoise(5, 1010, 1000, 100);
  assert.ok(Math.abs(a - b) < 0.45, `${a} against ${b}`);
});

// ---- The bake: the pictures the cloud is drawn with. ----

// A canvas 2D context's image data, enough for the bake and no more: what is painted can then be read back pixel by
// pixel, which is how the picture is checked against the very falloff smokeCover adds up.
const fakeContext = (w, h) => {
  const state = { put: null };
  return {
    state,
    createImageData: (iw, ih) => ({ width: iw, height: ih, data: new Uint8ClampedArray(iw * ih * 4) }),
    putImageData: (img) => { state.put = img; },
    canvas: { width: w, height: h },
  };
};
const alphaOf = (img, x, y) => img.data[(y * img.width + x) * 4 + 3] / 255;

test("a baked form is the same falloff the cover adds up: solid in the middle, gone at the rim", () => {
  const ctx = fakeContext(FORM_PX, FORM_PX);
  paintForm(ctx, { shape: "billow", variant: 1, band: 3 }, FORM_PX);
  const img = ctx.state.put;
  assert.equal(img.width, FORM_PX);
  const mid = FORM_PX / 2;
  assert.ok(alphaOf(img, mid, mid) > 0.9, `solid in the middle: ${alphaOf(img, mid, mid)}`);
  // Out at the corners, nothing: a form is a patch, not a square of paint.
  for (const [x, y] of [[0, 0], [FORM_PX - 1, 0], [0, FORM_PX - 1], [FORM_PX - 1, FORM_PX - 1]]) {
    assert.equal(alphaOf(img, x, y), 0, `paint in the corner at ${x},${y}`);
  }
  // Across the middle the alpha falls away and reaches nothing before the edge of the picture.
  const row = [...Array(FORM_PX).keys()].map((x) => alphaOf(img, x, mid));
  assert.ok(row[mid] > row[Math.round(mid * 1.5)], "it falls outward");
  assert.equal(row[FORM_PX - 1], 0, "and runs out before the picture's own edge");
  // The picture is the very falloff smokeCover adds up: at half a radius out, the pixel's alpha is formProfile's own
  // value through the rim's wander at that angle, so the hiding the tests measure is the hiding the screen gives.
  const want = formProfile(0.5 / formRim({ shape: "billow", variant: 1, band: 3 }, 0));
  assert.ok(Math.abs(alphaOf(img, Math.round(mid + (mid / FORM_RIM) * 0.5), mid) - want) < 0.02,
    `the picture is the cover's own curve: ${alphaOf(img, Math.round(mid + (mid / FORM_RIM) * 0.5), mid)} against ${want}`);
  // Painted, not photographic: the tones inside the patch are steps, and there is more than one of them.
  const tones = new Set();
  for (let y = mid - 10; y < mid + 10; y++) for (let x = mid - 10; x < mid + 10; x++) tones.add(img.data[(y * img.width + x) * 4]);
  assert.ok(tones.size > 1, `stepped brush shading inside the patch: ${tones.size} tones`);
  // The rim is ragged: the distance at which the paint runs out is not the same all the way round.
  const reach = [];
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2;
    let far = 0;
    for (let d = 1; d < mid; d++) {
      const x = Math.round(mid + Math.cos(a) * d), y = Math.round(mid + Math.sin(a) * d);
      if (x < 0 || y < 0 || x >= FORM_PX || y >= FORM_PX) break;
      if (alphaOf(img, x, y) > 0.02) far = d;
    }
    reach.push(far);
  }
  assert.ok(new Set(reach).size > 4, `a ragged rim, not a circle: ${reach.join(" ")}`);
  // Same spec, same pixels, on every screen; a different variant is a different patch.
  const again = fakeContext(FORM_PX, FORM_PX);
  paintForm(again, { shape: "billow", variant: 1, band: 3 }, FORM_PX);
  assert.deepEqual([...again.state.put.data], [...img.data]);
  const other = fakeContext(FORM_PX, FORM_PX);
  paintForm(other, { shape: "billow", variant: 2, band: 3 }, FORM_PX);
  assert.notDeepEqual([...other.state.put.data], [...img.data]);
});

test("a streak is drawn long and thin, which is what makes the drift look stream", () => {
  const ctx = fakeContext(FORM_PX, FORM_PX);
  paintForm(ctx, { shape: "streak", variant: 0, band: 4 }, FORM_PX);
  const img = ctx.state.put, mid = FORM_PX / 2;
  const across = [...Array(FORM_PX).keys()].filter((y) => alphaOf(img, mid, y) > 0.02).length;
  const along = [...Array(FORM_PX).keys()].filter((x) => alphaOf(img, x, mid) > 0.02).length;
  assert.ok(along > across * 1.6, `long (${along}) against thin (${across})`);
});

test("the wash tile is a seamless painted brush, and a mask picture is the plane's own alpha", () => {
  const ctx = fakeContext(32, 32);
  paintWashTile(ctx, {}, 32);
  const img = ctx.state.put;
  assert.equal(img.width, 32);
  // It tiles: the first column and the one past the last are near enough the same, so no seam shows on the map.
  let worst = 0;
  for (let y = 0; y < 32; y++) worst = Math.max(worst, Math.abs(img.data[(y * 32) * 4] - img.data[(y * 32 + 31) * 4]));
  assert.ok(worst < 80, `no hard seam across the tile: ${worst}`);
  // Painted in steps, and a dry brush leaves a little of the floor showing through.
  const tones = new Set([...Array(1024).keys()].map((i) => img.data[i * 4]));
  assert.ok(tones.size > 1 && tones.size <= 8, `stepped tone: ${tones.size}`);
  assert.ok([...Array(1024).keys()].some((i) => img.data[i * 4 + 3] < 250), "the brush is not a solid sheet");
  const mctx = fakeContext(4, 2);
  paintMask(mctx, new Uint8ClampedArray([0, 64, 128, 255, 10, 20, 30, 40]), 4, 2);
  assert.deepEqual([...Array(8).keys()].map((i) => mctx.state.put.data[i * 4 + 3]), [0, 64, 128, 255, 10, 20, 30, 40]);
});

// ---- The drawing itself, really run. ----

// A PIXI stand-in that records the sprites it is given, and a canvas maker, so the drawing can be run under node.
const fakePixi = () => {
  const made = { sprites: [], containers: [], textures: [], canvases: [] };
  class Texture {
    constructor(src) { this.src = src; this.destroyed = false; made.textures.push(this); }
    static from(src) { return new Texture(src); }
    destroy() { this.destroyed = true; }
  }
  Texture.EMPTY = new Texture("empty");
  class Node {
    constructor() { this.parent = null; this.destroyed = false; this.visible = true; this.alpha = 1; this.children = []; }
    addChild(c) { this.children.push(c); c.parent = this; return c; }
    destroy() { this.destroyed = true; for (const c of this.children) c.destroy?.(); }
  }
  class Container extends Node {
    constructor() { super(); made.containers.push(this); }
  }
  class Sprite extends Node {
    constructor(texture) {
      super();
      this.texture = texture; this.width = 0; this.height = 0; this.rotation = 0; this.mask = null;
      this.anchor = { set: () => {} };
      this.position = { x: 0, y: 0, set: (x, y) => { this.position.x = x; this.position.y = y; } };
      made.sprites.push(this);
    }
  }
  class TilingSprite extends Sprite {}
  const makeCanvas = (w, h) => {
    const cv = { width: w, height: h };
    cv.getContext = () => fakeContext(w, h);
    made.canvases.push(cv);
    return cv;
  };
  return { PIXI: { Texture, Container, Sprite, TilingSprite }, made, makeCanvas };
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
// Every sprite that is actually showing, as plain numbers.
const showing = (made) => made.sprites.filter((s) => s.visible && s.alpha > 0 && s.width > 0)
  .map((s) => ({ x: Math.round(s.position.x), y: Math.round(s.position.y), w: Math.round(s.width), a: Math.round(s.alpha * 1000) / 1000 }));

for (const look of SMOKE_LOOK_NAMES) {
  test(`${look}: the drawing places sprites from baked pictures, and never rebuilds geometry`, () => {
    withFrames(({ frame }) => {
      const { PIXI, made, makeCanvas } = fakePixi();
      const root = new PIXI.Container();
      let ms = 0;
      const looks = createSmokeLooks({ PIXI, layer: () => root, grid: () => CELL, now: () => ms, look, makeCanvas });
      looks.sync(cloudOf(mixedRoom(), look));
      ms = SMOKE_DRIFT_MS; frame();
      assert.ok(showing(made).length > 0, "it really painted");
      const baked = made.textures.length;
      assert.ok(baked > 1 && baked < 80, `a handful of baked pictures, not one per form: ${baked}`);
      // Bake once, then only place and fade: a hundred frames later not one more picture has been painted.
      for (let n = 0; n < 100; n++) { ms += SMOKE_FRAME_MS; frame(); }
      assert.equal(made.textures.length, baked, "no picture is baked per frame");
      looks.clear();
    });
  });

  test(`${look}: the same clock paints the same frame, and a later one a different one`, () => {
    const run = (at_) => withFrames(({ frame }) => {
      const { PIXI, made, makeCanvas } = fakePixi();
      const root = new PIXI.Container();
      let ms = 0;
      const looks = createSmokeLooks({ PIXI, layer: () => root, grid: () => CELL, now: () => ms, look, makeCanvas });
      looks.sync(cloudOf(mixedRoom(), look));
      ms = at_; frame();
      const out = JSON.stringify(showing(made));
      looks.clear();
      return out;
    });
    assert.equal(run(SMOKE_DRIFT_MS), run(SMOKE_DRIFT_MS));
    assert.notEqual(run(Math.round(SMOKE_DRIFT_MS / 3)), run(SMOKE_DRIFT_MS), "the cloud really walks its weight in");
    assert.notEqual(run(SMOKE_DRIFT_MS * 2), run(SMOKE_DRIFT_MS * 2 + 2000), "and a settled room keeps breathing");
  });

  test(`${look}: the drawing runs off the clock it is handed and never reaches for one of its own`, () => {
    withFrames(({ frame }) => {
      const { PIXI, made, makeCanvas } = fakePixi();
      const root = new PIXI.Container();
      let ms = 0, asked = 0;
      const looks = createSmokeLooks({ PIXI, layer: () => root, grid: () => CELL, look, makeCanvas,
        now: () => { asked++; return ms; } });
      // Every clock and every die a module could reach for instead is made to throw for the whole run: if any line
      // of the placing, the drift, the sway, the bake or the painting touches one, this fails. `new Date()` and
      // crypto.getRandomValues are in the list too, as the obvious ways round the first three.
      const bang = () => { throw new Error("the smoke read a clock or a die of its own"); };
      const realDate = globalThis.Date, realRandom = Math.random, realPerf = globalThis.performance?.now;
      const realCrypto = globalThis.crypto?.getRandomValues;
      class NoDate { constructor() { bang(); } static now() { bang(); } }
      const cloud = cloudOf(mixedRoom(), look);
      globalThis.Date = NoDate; Math.random = bang;
      if (globalThis.performance) globalThis.performance.now = bang;
      if (globalThis.crypto && realCrypto) globalThis.crypto.getRandomValues = bang;
      try {
        looks.sync(cloud);
        for (ms = 0; ms <= SMOKE_DRIFT_MS * 2; ms += 100) frame();
        // And the picking itself, which is the other half: the same cells in, the same cloud out, with no die to roll.
        assert.deepEqual(smokeForms(mixedRoom(), geo({ look })), cloud.forms);
      } finally {
        globalThis.Date = realDate; Math.random = realRandom;
        if (globalThis.performance && realPerf) globalThis.performance.now = realPerf;
        if (globalThis.crypto && realCrypto) globalThis.crypto.getRandomValues = realCrypto;
      }
      assert.ok(asked > 0, "it does ask the clock it was given");
      assert.ok(showing(made).length > 0, "and it really painted");
      looks.clear();
    });
  });

  test(`${look}: teardown cancels the frame loop and destroys what it made, pictures and all`, () => {
    withFrames(({ frame, cancelled, pending }) => {
      const { PIXI, made, makeCanvas } = fakePixi();
      const root = new PIXI.Container();
      let ms = 0;
      const looks = createSmokeLooks({ PIXI, layer: () => root, grid: () => CELL, now: () => ms, look, makeCanvas });
      looks.sync(cloudOf(mixedRoom(), look));
      ms = 500; frame();
      assert.equal(root.children.length, 1, "it put its container on the layer");
      const box = root.children[0];
      const pictures = made.textures.filter((t) => t.src !== "empty");
      assert.ok(pictures.length > 0);
      looks.clear();
      assert.ok(cancelled.length > 0, "the frame loop is cancelled");
      assert.equal(box.destroyed, true, "the container is destroyed with its children");
      assert.ok(pictures.every((t) => t.destroyed), "and every baked picture with it");
      assert.ok(made.canvases.every((cv) => cv.width === 0), "the canvases are let go too");
      // Nothing of the last cloud is kept: a sync after a clear starts over on a fresh container.
      looks.sync(cloudOf(mixedRoom(), look));
      assert.equal(root.children.length, 2);
      assert.notEqual(root.children[1], box);
      looks.clear();
      frame(); pending.clear();
    });
  });
}

test("the drawing is safe before there is a layer, without a canvas, and on nothing at all", () => {
  withFrames(() => {
    const { PIXI, made, makeCanvas } = fakePixi();
    const blind = createSmokeLooks({ PIXI, layer: () => null, now: () => 0, makeCanvas });
    blind.sync(cloudOf(mixedRoom()));
    assert.deepEqual(showing(made), [], "no layer, nothing painted and nothing thrown");
    blind.clear();
    // No canvas at all — a server-side import, or a browser that will not give one — paints nothing and throws nothing.
    const root = new PIXI.Container();
    const dry = createSmokeLooks({ PIXI, layer: () => root, now: () => 0, makeCanvas: null });
    dry.sync(cloudOf(mixedRoom()));
    dry.clear();
    const live = createSmokeLooks({ PIXI, layer: () => root, now: () => 0, makeCanvas });
    live.sync();
    live.sync({ forms: null, wash: null });
    live.sync({ forms: [null, { x: NaN, y: 0, r: 1, a: 1 }, { x: 0, y: 0, r: 0, a: 1 }], wash: { w: 0 } });
    live.sync({ puffs: [{ x: 1, y: 2, r: 3, a: 0.5, seed: 1, band: 2 }], sheets: null });
    live.clear();
    assert.equal(createSmokeBank({ PIXI, makeCanvas: null }), null, "no canvas, no bank");
    assert.equal(createSmokeBank({ PIXI: {}, makeCanvas }), null, "no PIXI, no bank");
  });
});

test("main.mjs's own two names still mean the cloud and the wash", () => {
  // main.mjs is Foundry's entry point and not ours to edit: it asks for `puffs` and `sheets` and hands both to sync.
  const cells = mixedRoom();
  assert.deepEqual(smokePuffs(cells, geo()), smokeForms(cells, geo()));
  const a = smokeSheets(cells, geo()), b = smokeWash(cells, geo());
  assert.deepEqual([...a.thin], [...b.thin]);
});

test("a frame of a filled room is a few hundred sprite moves, and the cloud is planned once a round", () => {
  // The cost this pins: the rejected look rebuilt every polygon every frame. Here a round's planning is one pass
  // over the field and a frame is arithmetic per form, with no geometry and no bake in it at all.
  const cells = mixedRoom();
  for (const look of SMOKE_LOOK_NAMES) {
    const forms = smokeForms(cells, geo({ look }));
    assert.ok(forms.length < 1400, `${look}: ${forms.length} forms for a 48-square room`);
    const next = new Map(forms.map((f) => [f.seed, f]));
    const t0 = process.hrtime.bigint();
    for (let n = 0; n < 50; n++) for (const [, f] of next) smokeSway(smokeBetween(null, f, 0.5), n * SMOKE_FRAME_MS);
    const per = Number(process.hrtime.bigint() - t0) / 1e6 / 50;
    assert.ok(per < 8, `${look}: ${per.toFixed(2)}ms of frame arithmetic`);
  }
  assert.ok(SMOKE_FRAME_MS >= 40, "and it is not asked for more often than smoke needs");
});

test("the cloud's depth sits over the creatures it hides and under the birds", () => {
  assert.ok(SMOKE_SORT_LAYER > TOKEN_SORT_LAYER, "thick smoke must be painted over a creature standing in it");
  assert.ok(SMOKE_SORT_LAYER < BIRD_SORT_LAYER, "birds fly above the smoke");
  assert.notEqual(SMOKE_SORT_LAYER, 657, "not the fire's layer, which lies under the creatures");
  assert.notEqual(SMOKE_SORT_LAYER, 760, "not the old rolling haze's");
});

test("the look is declared, with what each of the three is, so a choice is a choice and not a tweak", () => {
  for (const name of SMOKE_LOOK_NAMES) {
    const spec = SMOKE_LOOKS[name];
    assert.ok(spec.classes.length > 0 && ["billow", "streak"].includes(spec.shape));
    assert.equal(typeof spec.wash, "boolean");
  }
  // They differ in KIND, not in degree: one streams, one washes, one billows.
  assert.equal(SMOKE_LOOKS.drift.flow, true);
  assert.equal(SMOKE_LOOKS.billow.flow, false);
  assert.equal(SMOKE_LOOKS.wash.wash, true);
  assert.equal(SMOKE_LOOKS.billow.wash, false);
  assert.ok(formCoverAt(null, 0, 0) === 0 && smokeCover({}, 0, 0) === 0);
});

// ---- The haze, the round's own write, and the settings: unchanged by this rebuild and still run here. ----

test("the haze stands down exactly where the simulation takes over, and nowhere else", () => {
  const scene = (own) => ({ flags: { animater: own } });
  const ALL = { smokeFills: true, breakableProps: true, fireSpreads: true };
  // Through airHazeFor, which is the whole rule as main.mjs asks it: the scene goes in, and whether the simulation
  // runs is worked out inside. Handing `runs` in by hand is where an earlier bug lived, so nothing hands it now.
  const haze = (own, { on = true, underground = true } = {}) => airHazeFor({ on, underground }, scene(own));
  assert.equal(haze(ALL), false);
  // THE CASE THAT WAS WRONG. The scene's own switch on but Fire spreads off: the drawing's gate is smokeRunsOn, so
  // no simulated smoke is drawn here — and the GM must therefore keep the haze they always had, not lose both.
  assert.equal(haze({ ...ALL, fireSpreads: false }), true, "smokeFills on, fireSpreads off: the haze still rolls");
  assert.equal(haze({ ...ALL, breakableProps: false }), true, "and with Breakable props off too");
  for (const breakableProps of [true, false]) for (const fireSpreads of [true, false]) {
    assert.equal(haze({ smokeFills: false, breakableProps, fireSpreads }), true);
  }
  assert.equal(haze({ smokeFills: false }, { on: false }), false);
  assert.equal(haze({ smokeFills: false }, { underground: false }), false);
  // There is never both at once, and never neither, on any combination at all.
  for (const smokeFills of [true, false]) for (const breakableProps of [true, false]) for (const fireSpreads of [true, false]) {
    const own = { smokeFills, breakableProps, fireSpreads };
    const draws = smokeRunsOn(scene(own));
    assert.equal(draws && haze(own), false, `both at once: ${JSON.stringify(own)}`);
    assert.ok(draws || haze(own), `neither one: ${JSON.stringify(own)}`);
  }
  assert.equal(airHazeShows(), false);
  assert.equal(airHazeShows({ on: "true", underground: true, runs: false }), false);
  assert.equal(airHazeFor(), false);
  assert.equal(airHazeFor({ on: true, underground: true }, null), true, "no scene is no simulation, so the haze rolls");
  assert.equal(airHazeFor({ on: true, underground: true }, {}), true);
  assert.equal(airHazeFor({ on: true, underground: true }, { flags: {} }), true);
});

test("the round's own write wakes nothing; a real scene edit does", () => {
  const own = [{ "flags.animater.smoke.33": 1.08 }, { "flags.animater.smoke.-=33": null },
    { flags: { animater: { smoke: { 33: 1 }, smokeGrid: { cols: 10 } } } }];
  for (const write of own) assert.equal(smokeOnlySave(write, SMOKE_NOTE), true, `the round's own: ${JSON.stringify(write)}`);
  const edits = [{ width: 2000 }, { "flags.animater.smokeFills": false }, { "flags.animater.smoke.33": 1, width: 2000 },
    { flags: { animater: { smoke: {}, smokeFills: false } } }, { "flags.core.something": 1 }];
  for (const edit of edits) assert.equal(smokeOnlySave(edit, SMOKE_NOTE), false, `a real edit: ${JSON.stringify(edit)}`);
  for (const write of own) assert.equal(smokeOnlySave(write, {}), false, "and unmarked, it is somebody else's edit");
});

test("a fire light's own switch is its own field, with its own name", () => {
  const off = smokeLightFieldHTML(), on = smokeLightFieldHTML({ on: true });
  assert.match(off, /name="flags\.animater\.smokeSource"/);
  assert.equal(SMOKE_LIGHT_FLAG, "smokeSource");
  assert.doesNotMatch(off, /smokeSource"[^>]*checked/);
  assert.match(on, /smokeSource"[^>]*checked/);
  assert.match(on, /Fills the room with smoke/);
  assert.match(on, /thick smoke blocks sight, thin smoke conceals/);
  assert.ok(!on.includes('data-tooltip="With the scene\'s'), "the tooltip is escaped");
  assert.ok(on.includes("&#39;"), "and the apostrophe with it");
  assert.ok(!on.includes("roomSmoke"));
  assert.notEqual(SMOKE_LIGHT_FLAG, SMOKE_MARK);
  assert.ok(!propSceneFieldsHTML({}).includes(SMOKE_LIGHT_FLAG), "the scene's field is not the light's");
});

test("the round's own marker and the reader that knows it are one constant", () => {
  assert.equal(smokeOnlySave({ "flags.animater.smoke.33": 1.08 }, SMOKE_NOTE), true);
  assert.equal(smokeOnlySave({ flags: { animater: { smoke: { 33: 1 }, smokeGrid: { cols: 10 } } } }, SMOKE_NOTE), true);
  assert.equal(smokeOnlySave({ "flags.animater.smoke.-=33": null, "flags.animater.-=smokeGrid": null }, SMOKE_NOTE), true);
  assert.equal(smokeOnlySave({ "flags.animater.smoke.33": 1, width: 2000 }, SMOKE_NOTE), false);
  assert.equal(smokeOnlySave({ "flags.animater.smoke.33": 1 }, {}), false);
  assert.equal(smokeOnlySave({ "flags.animater.smoke.33": 1 }, { animater: { propFire: true } }), false);
  assert.deepEqual(Object.keys(SMOKE_NOTE.animater), [SMOKE_MARK]);
  assert.equal(SMOKE_MARK, "smokeFills");
  assert.notEqual(SMOKE_MARK, "roomSmoke");
  assert.equal(SMOKE_NOTE.animater[SMOKE_MARK], true);
  for (const other of ["roomSmoke", "smokeSource", "propFire"]) {
    if (other === SMOKE_MARK) continue;
    assert.equal(smokeOnlySave({ "flags.animater.smoke.33": 1 }, { animater: { [other]: true } }), false, other);
  }
});

test("the scene's switch and the light's are two distinct names, and neither is the settings pair's", () => {
  const scene = (own) => ({ flags: { animater: own } });
  const ALL = { breakableProps: true, fireSpreads: true };
  assert.equal(smokeRunsOn(scene({ ...ALL, smokeFills: true })), true);
  assert.equal(smokeRunsOn(scene({ ...ALL, roomSmoke: true })), false, "the settings pair's name is not a scene flag");
  const html = propSceneFieldsHTML({ smokeFills: true });
  assert.match(html, /name="flags\.animater\.smokeFills"/);
  assert.ok(!html.includes("roomSmoke"), "no roomSmoke left in the scene's own fields");
  assert.match(html, /smokeFills"[^>]*checked/);
  assert.doesNotMatch(propSceneFieldsHTML({}), /smokeFills"[^>]*checked/);
  assert.notEqual(SMOKE_MARK, "smokeSource");
});

// ---- The ONE source test that is kept, and why. ----
// main.mjs is Foundry's entry point. It CAN be imported under node — tests/project/integration.test.mjs does, with a
// query string to dodge the module cache — but only on top of the heavy fake-Foundry harness that file stands up, and
// that file is one of the two slow ones. So a cheap test cannot import it and a source guard here is a cost trade,
// not an impossibility. Everything that COULD be lifted out of it has been — the layer depth and the tiers are
// exported constants, the haze rule is airHazeFor, the marker is SMOKE_NOTE, the scene's field and the light's are
// functions in ui/prop-config.mjs, and all of them are run above. What remains here is only the three things that are
// ABSENCES or COUNTS in a file, which no pure test can see: that the drawing block contains no write call, that there
// is no THIRD place asking the haze question its own way, and that main.mjs declares no marker of its own.
test("main.mjs's own wiring: no write in the drawing, no third haze site, no second marker", () => {
  const main = readFileSync(new URL("../../../scripts/main.mjs", import.meta.url), "utf8");
  const looks = main.slice(main.indexOf("// ---- What the room smoke looks like"), main.indexOf("// A region repainted, reshaped or moved"));
  assert.ok(looks.length > 200, "the drawing block is where this expects it");
  for (const write of ["update(", "updateEmbeddedDocuments", "createEmbeddedDocuments", "deleteEmbeddedDocuments", "setFlag", "unsetFlag"]) {
    assert.ok(!looks.includes(write), `the drawing must not ${write}`);
  }
  assert.equal([...main.matchAll(/roomSmokeOn\(\)/g)].length, 1, "the settings pair is read once, inside hazeSmokeOn");
  assert.equal([...main.matchAll(/hazeSmokeOn\(\)/g)].length, 2, "the two places the haze is asked, and no third");
  assert.match(main, /const hazeSmokeOn = \(\) => airHazeFor\(\{ on: roomSmokeOn\(\), underground: undergroundScene\(\) \}, canvas\?\.scene\);/);
  assert.ok(!/SMOKE_NOTE\s*=/.test(main), "main.mjs keeps no marker of its own");
  const lamp = main.split(/\r?\n/).find((l) => l.includes('"deleteAmbientLight"') && l.includes("lampSoon()"));
  assert.ok(lamp, "the lamp air's hook list");
  assert.match(lamp, /if \(!quietSave\(first, changes, options\)\) lampSoon\(\);/, "the round's own write must not wake it");
  assert.ok(lamp.includes('"updateScene"'), "and a real scene edit still does");
  for (const line of main.split(/\r?\n/)) {
    if (!line.includes("roomSmoke")) continue;
    assert.doesNotMatch(line, /flags[^\n]*roomSmoke|roomSmoke:\s*(true|false|flags)/, `still a roomSmoke flag: ${line.trim()}`);
  }
});

// ---- The plume outside. ----
// The cloud's own forms are clipped so they cannot wash past the squares the GM wrote (OVERHANG), which is right
// for a room's smoke and wrong for what leaves it: a GM watching a burning cellar saw the smoke stop dead at the
// open door, as though the doorway were glass. The plume is the one part of this drawing allowed outside.
test("a vent pours a plume outside the room, and a scene with no vents paints none", () => {
  const vented = (plume) => withFrames(({ frame }) => {
    const { PIXI, made, makeCanvas } = fakePixi();
    const root = new PIXI.Container();
    let ms = 0;
    const looks = createSmokeLooks({ PIXI, layer: () => root, grid: () => CELL, now: () => ms, makeCanvas });
    looks.sync({ ...cloudOf(mixedRoom()), plume });
    ms = 9000; frame();
    const out = showing(made);
    looks.clear();
    return out;
  });
  const geo = { cols: 10, cell: CELL, origin: { x: 0, y: 0 }, seed: 5 };
  // The vent is at cell 5 — the square (5,0) — facing north, OFF the top of the room and out of the cloud.
  const none = vented(null);
  const pouring = vented({ list: [{ i: 5, dx: 0, dy: -1, v: 3 }], ...geo });
  assert.ok(pouring.length > none.length, `${pouring.length} > ${none.length}: the plume adds sprites`);
  // And they are painted ABOVE the vent, which is where the cloud's own forms may not go.
  const above = pouring.filter((s) => s.y < 0);
  assert.ok(above.length, "the plume crosses the threshold the cloud may not");
  // An empty list is the same as none at all, and never throws.
  assert.deepEqual(vented({ list: [], ...geo }).length, none.length);
});

test("the plume keeps pouring after the cloud has settled, and stops when the vents go", () => {
  withFrames(({ frame, pending }) => {
    const { PIXI, made, makeCanvas } = fakePixi();
    const root = new PIXI.Container();
    let ms = 0;
    const looks = createSmokeLooks({ PIXI, layer: () => root, grid: () => CELL, now: () => ms, makeCanvas });
    looks.sync({ ...cloudOf(mixedRoom()), plume: { list: [{ i: 5, dx: 0, dy: -1, v: 3 }], cols: 10, cell: CELL, origin: { x: 0, y: 0 }, seed: 5 } });
    ms = SMOKE_DRIFT_MS * 3; frame();
    // Long past the drift, where a still cloud alone would have let the loop stop: a pouring vent keeps it alive.
    assert.ok(pending.size > 0, "the frame loop runs while a vent pours");
    const early = showing(made).map((s) => `${s.x},${s.y}`).join("|");
    ms += 1200; frame();
    assert.notEqual(showing(made).map((s) => `${s.x},${s.y}`).join("|"), early, "and the puffs are moving");
    looks.clear();
  });
});

// The air pass draws the room's own cloud on a drafty scene, and the bake is then handed the plume ALONE, with no
// cloud to paint (main.mjs syncSmokeLooksNow: sheets null, puffs empty). What leaves by the doorway must still pour:
// the plume is not the cloud, and the air indoors has nothing to do with it.
test("a plume with no cloud of its own still pours", () => {
  withFrames(({ frame, pending }) => {
    const { PIXI, made, makeCanvas } = fakePixi();
    const root = new PIXI.Container();
    let ms = 0;
    const looks = createSmokeLooks({ PIXI, layer: () => root, grid: () => CELL, now: () => ms, makeCanvas });
    looks.sync({ sheets: null, puffs: [], plume: { list: [{ i: 5, dx: 0, dy: -1, v: 3 }], cols: 10, cell: CELL, origin: { x: 0, y: 0 }, seed: 5 } });
    assert.ok(pending.size > 0, "the frame loop runs for a vent with no cloud behind it");
    ms = 9000; frame();
    const out = showing(made);
    assert.ok(out.length > 0, `the plume is painted: ${out.length} sprites`);
    assert.ok(out.some((s) => s.y < 0), "and it crosses the threshold the cloud may not");
    looks.clear();
  });
});
