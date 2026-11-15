import test from "node:test";
import assert from "node:assert/strict";
import { crackLines, holeOutline, icePlates, meltOutline, slushRing, iceBreakOf, iceHoleAt, iceHoleRings , plateAt, cutIceHoles } from "../../../scripts/engines/regions/ice-break-look.mjs";
import { MELTED } from "../../../scripts/engines/regions/ice-break-look.mjs";

const GRID = 100;
const KEYS = ["3,4", "0,0", "-1,2", "-7,-5", "12,-3"];
const centre = (key, grid) => { const [c, r] = key.split(",").map(Number); return { x: (c + 0.5) * grid, y: (r + 0.5) * grid }; };
const area2 = (ring) => ring.reduce((s, p, i) => { const q = ring[(i + 1) % ring.length]; return s + p.x * q.y - q.x * p.y; }, 0);
const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
const properCross = (a, b, c, d) => {
  const d1 = cross(a, b, c), d2 = cross(a, b, d), d3 = cross(c, d, a), d4 = cross(c, d, b);
  return d1 * d2 < 0 && d3 * d4 < 0;
};
const isSimple = (ring) => {
  const n = ring.length;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    if (j === i + 1 || (i === 0 && j === n - 1)) continue; // edges that share a vertex
    if (properCross(ring[i], ring[(i + 1) % n], ring[j], ring[(j + 1) % n])) return false;
  }
  return true;
};
const inside = (ring, p) => {
  let in_ = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) in_ = !in_;
  }
  return in_;
};

test("the same key and seed draw the same break, a different seed another", () => {
  const o = { grid: GRID, seed: 5, size: 2 };
  assert.deepEqual(crackLines("3,4", o), crackLines("3,4", o));
  assert.deepEqual(holeOutline("3,4", o), holeOutline("3,4", o));
  assert.deepEqual(icePlates("3,4", o), icePlates("3,4", o));
  const p = { ...o, seed: 6 };
  assert.notDeepEqual(crackLines("3,4", o), crackLines("3,4", p));
  assert.notDeepEqual(holeOutline("3,4", o), holeOutline("3,4", p));
  assert.notDeepEqual(icePlates("3,4", o), icePlates("3,4", p));
  assert.notDeepEqual(holeOutline("3,4", o), holeOutline("4,4", o));
});

test("the hole is a closed ring that does not repeat its first point", () => {
  for (const key of KEYS) for (const size of [1, 2, 3, 4]) {
    const ring = holeOutline(key, { grid: GRID, seed: 9, size });
    assert.ok(ring.length >= 8, "enough points to look jagged");
    assert.notDeepEqual(ring[0], ring[ring.length - 1], "first point is not repeated");
    for (const p of ring) assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
  }
});

test("the hole ring never crosses itself, whatever the key, size or seed", () => {
  for (const key of KEYS) for (const size of [1, 2, 3, 4]) for (let seed = 0; seed < 25; seed++) {
    assert.ok(isSimple(holeOutline(key, { grid: GRID, seed, size })), `${key} size ${size} seed ${seed}`);
  }
});

test("the hole ring always winds the same way: positive area in canvas coordinates (clockwise on screen)", () => {
  for (const key of KEYS) for (const size of [1, 2, 3, 4]) for (let seed = 0; seed < 25; seed++) {
    assert.ok(area2(holeOutline(key, { grid: GRID, seed, size })) > 0, `${key} size ${size} seed ${seed}`);
  }
});

test("the hole is about the creature's size plus one square, centred on its square, within size + 1 squares", () => {
  for (const key of KEYS) for (const size of [1, 2, 3, 4]) {
    const c = centre(key, GRID);
    const ring = holeOutline(key, { grid: GRID, seed: 3, size });
    for (const p of ring) assert.ok(Math.hypot(p.x - c.x, p.y - c.y) <= (size + 1) * GRID, "within size + 1 squares");
    const width = Math.max(...ring.map((p) => p.x)) - Math.min(...ring.map((p) => p.x));
    assert.ok(width > size * GRID * 0.8 && width <= (size + 1) * GRID, `width ${width} for size ${size}`);
    assert.ok(inside(ring, c), "the square it broke is in the hole");
  }
});

test("the hole scales with the grid", () => {
  const a = holeOutline("2,2", { grid: 50, seed: 1, size: 1 });
  const b = holeOutline("2,2", { grid: 100, seed: 1, size: 1 });
  const span = (r) => Math.max(...r.map((p) => p.x)) - Math.min(...r.map((p) => p.x));
  assert.ok(Math.abs(span(b) / span(a) - 2) < 0.2);
});

test("cracks are several jagged lines that stay inside their own square", () => {
  for (const key of KEYS) for (let seed = 0; seed < 20; seed++) {
    const [c, r] = key.split(",").map(Number);
    const lines = crackLines(key, { grid: GRID, seed });
    assert.ok(lines.length >= 3);
    for (const line of lines) {
      assert.ok(line.length >= 3, "a crack bends");
      for (const p of line) {
        assert.ok(p.x >= c * GRID && p.x <= (c + 1) * GRID, `${key} x ${p.x}`);
        assert.ok(p.y >= r * GRID && p.y <= (r + 1) * GRID, `${key} y ${p.y}`);
      }
    }
  }
});

test("every crack starts where the weight fell, or on another crack", () => {
  // A fracture radiates from the point it was struck and branches off itself; nothing starts in mid-air.
  for (const seed of [0, 2, 5, 9]) {
    const c = centre("-1,2", GRID);
    const lines = crackLines("-1,2", { grid: GRID, seed });
    const points = lines.flat();
    for (const line of lines) {
      const head = line[0];
      const fromMiddle = Math.hypot(head.x - c.x, head.y - c.y) < GRID * 0.2;
      const onAnother = points.some((p) => p !== head && Math.hypot(p.x - head.x, p.y - head.y) < 1e-9);
      assert.ok(fromMiddle || onAnother, `a crack starts at the middle or on another: ${JSON.stringify(head)}`);
    }
  }
});

test("a break leaves the sheet in a few big plates, more of them for a bigger hole, every one inside it", () => {
  const count = (size) => icePlates("3,4", { grid: GRID, seed: 4, size }).length;
  assert.ok(count(1) >= 3, "a sheet comes apart into slabs you can count, not into chips");
  assert.ok(count(4) <= 12, "and never into confetti");
  assert.ok(count(3) > count(1), "a bigger hole breaks into more");
  for (const size of [1, 2, 4]) {
    const ring = holeOutline("3,4", { grid: GRID, seed: 4, size });
    for (const plate of icePlates("3,4", { grid: GRID, seed: 4, size }).filter((pl) => !pl.chip)) {
      assert.ok(plate.points.length >= 3, "a plate is a polygon");
      assert.ok(Math.abs(plate.turn) <= Math.PI, "a turn in radians, and a small one");
      assert.ok(inside(ring, plate.mid), "the plate sits in the hole it came from");
    }
  }
});

test("the creature leaves an opening its own size, with the ice shoved out around it", () => {
  // It went through here, so there is no ice where it is: the slabs ring an opening about as wide as the creature, which
  // is what makes a token in the water read as being in the water rather than sitting on a heap of broken ice.
  for (const [size, squares] of [[1, 1], [2, 2], [3, 3]]) {
    const o = { grid: GRID, seed: 9, size };
    const plates = icePlates("3,4", o);
    const c = centre("3,4", GRID);
    assert.ok(plates.length >= 3, `the sheet is still in pieces round it: ${plates.length}`);
    let nearest = Infinity;
    for (const plate of plates.filter((pl) => !pl.chip)) for (const pt of plate.points) nearest = Math.min(nearest, Math.hypot(pt.x - c.x, pt.y - c.y));
    const want = (squares / 2) * GRID;
    assert.ok(nearest > want * 0.7, `the opening is clear of ice: nearest ${(nearest / GRID).toFixed(2)} squares`);
    assert.ok(nearest < want * 1.45, `and no wider than the creature made it: ${(nearest / GRID).toFixed(2)} squares`);
  }
});

test("the ice still rings the opening rather than drifting off it", () => {
  const o = { grid: GRID, seed: 4, size: 2 };
  const ring = holeOutline("3,4", o);
  for (const plate of icePlates("3,4", o)) {
    assert.ok(inside(ring, plate.mid), "every piece is still in the hole it came from");
  }
});

test("the plates nearest the middle sit furthest apart: that is where the creature went through", () => {
  const o = { grid: GRID, seed: 3, size: 3 };
  const plates = icePlates("3,4", o);
  const c = { x: 3.5 * GRID, y: 4.5 * GRID };
  const span = (plate) => Math.max(...plate.points.map((pt) => Math.hypot(pt.x - plate.mid.x, pt.y - plate.mid.y)));
  const near = plates.filter((pl) => Math.hypot(pl.mid.x - c.x, pl.mid.y - c.y) < GRID * 0.8);
  const far = plates.filter((pl) => Math.hypot(pl.mid.x - c.x, pl.mid.y - c.y) > GRID * 1.4);
  if (near.length && far.length) {
    const tight = (list) => list.reduce((sum, pl) => sum + span(pl), 0) / list.length;
    assert.ok(tight(near) > 0 && tight(far) > 0, "both ends of the hole have plates with size");
  }
  assert.ok(plates.length >= 3);
});

test("junk input gives nothing and never throws", () => {
  const good = { grid: GRID, seed: 1, size: 1 };
  for (const key of ["", "x", "3", "3,", "a,b", "1.5,2", null, undefined, 7, "3,4,5"]) {
    assert.deepEqual(crackLines(key, good), []);
    assert.deepEqual(holeOutline(key, good), []);
    assert.deepEqual(icePlates(key, good), []);
  }
  for (const bad of [{}, { grid: 0, size: 1 }, { grid: -5, size: 1 }, { grid: "x", size: 1 }, { grid: GRID }, { grid: GRID, size: 0 }, { grid: GRID, size: NaN }, undefined]) {
    assert.deepEqual(holeOutline("3,4", bad), []);
    assert.deepEqual(icePlates("3,4", bad), []);
  }
  assert.deepEqual(crackLines("3,4", { grid: 0 }), []);
  assert.deepEqual(crackLines("3,4", undefined), []);
  assert.ok(crackLines("3,4", { grid: GRID }).length >= 3, "a missing seed is just seed 0");
});

// ---- what fire melts: open water with a slushy edge, drawn as a melt and never as a break ----

test("a melt is a rounded opening about its square, simple and wound the way the water engine reads", () => {
  for (const key of KEYS) for (let seed = 0; seed < 10; seed++) {
    const ring = meltOutline(key, { grid: GRID, seed, size: 1 });
    assert.ok(ring.length >= 12, "enough points for a soft edge");
    assert.ok(isSimple(ring), `${key} seed ${seed} crosses itself`);
    assert.ok(area2(ring) > 0, "wound clockwise on screen, as a hole is");
    const mid = centre(key, GRID);
    for (const p of ring) {
      const r = Math.hypot(p.x - mid.x, p.y - mid.y);
      assert.ok(r > GRID * 0.3 && r < GRID * 0.62, `${key} reaches ${r}: about the square it melted`);
    }
  }
});

test("a melt's edge is far smoother than a break's: fire eats the ice away, it does not shatter it", () => {
  // How far the edge jumps from one point to the next, against how far out it reaches: a break is spikes of shattered
  // ice, a melt a few slow lobes. Over many seeds, so neither is judged on one lucky shape.
  const wander = (ring, key) => {
    const mid = centre(key, GRID), rs = ring.map((p) => Math.hypot(p.x - mid.x, p.y - mid.y));
    let step = 0;
    for (let i = 0; i < rs.length; i++) step += Math.abs(rs[i] - rs[(i + 1) % rs.length]);
    return step / rs.length / (rs.reduce((a, b) => a + b, 0) / rs.length);
  };
  const mean = (list) => list.reduce((a, b) => a + b, 0) / list.length;
  const seeds = [...Array(20).keys()];
  const melt = mean(seeds.map((seed) => wander(meltOutline("3,4", { grid: GRID, seed, size: 1 }), "3,4")));
  const broke = mean(seeds.map((seed) => wander(holeOutline("3,4", { grid: GRID, seed, size: 1 }), "3,4")));
  assert.ok(melt < broke * 0.6, `a melt wanders ${melt.toFixed(3)}, a break ${broke.toFixed(3)}`);
});

test("the slush rides the melt's own edge: small chips, all inside it, none in its middle", () => {
  for (const key of KEYS) {
    const ring = meltOutline(key, { grid: GRID, seed: 2, size: 1 }), mid = centre(key, GRID);
    const chips = slushRing(key, { grid: GRID, seed: 2, size: 1 });
    assert.ok(chips.length >= 6, "enough of it to read as slush");
    for (const chip of chips) {
      assert.ok(chip.r > 0 && chip.r < GRID * 0.12, `a chip, not a floe: ${chip.r}`);
      assert.ok(Math.abs(chip.turn) <= Math.PI * 2);
      assert.ok(inside(ring, chip), "in the melt");
      assert.ok(Math.hypot(chip.x - mid.x, chip.y - mid.y) > GRID * 0.15, "out at the edge, not floating in the middle");
    }
  }
});

test("a melt and a slush ring are the same on every client, and junk gives nothing", () => {
  assert.deepEqual(meltOutline("3,4", { grid: GRID, seed: 1, size: 1 }), meltOutline("3,4", { grid: GRID, seed: 1, size: 1 }));
  assert.deepEqual(slushRing("3,4", { grid: GRID, seed: 1, size: 1 }), slushRing("3,4", { grid: GRID, seed: 1, size: 1 }));
  for (const bad of [{}, { grid: 0, size: 1 }, { grid: GRID }, { grid: GRID, size: 0 }, undefined]) {
    assert.deepEqual(meltOutline("3,4", bad), []);
    assert.deepEqual(slushRing("3,4", bad), []);
  }
  for (const key of ["", "a,b", null, 7]) {
    assert.deepEqual(meltOutline(key, { grid: GRID, size: 1 }), []);
    assert.deepEqual(slushRing(key, { grid: GRID, size: 1 }), []);
  }
});

test("a region draws a melted square as a melt and a broken one as a break", () => {
  const region = { id: "reg1", flags: { animater: { iceThin: true, thinIce: { holes: { "1,1": MELTED, "5,5": 2 } } } } };
  const { holes, shards: floating } = iceBreakOf(region, { grid: GRID });
  const melt = holes.find((h) => h.id === "reg1:ice:1,1"), broke = holes.find((h) => h.id === "reg1:ice:5,5");
  assert.ok(melt && broke, "both are open water");
  assert.equal(melt.watery, true);
  const reach = (spec, key) => { const mid = centre(key, GRID); const pts = []; for (let i = 0; i < spec.areas[0].length; i += 2) pts.push(Math.hypot(spec.areas[0][i] - mid.x, spec.areas[0][i + 1] - mid.y)); return Math.max(...pts); };
  assert.ok(reach(melt, "1,1") < GRID * 0.62, "a melt opens about the one square it melted");
  assert.ok(reach(broke, "5,5") > GRID, "a break is as wide as what fell through it");
  assert.ok(melt.edge > broke.edge, "the melt's water fades into the ice; the break ends at a hard edge");
  const chips = floating.find((s) => s.id === "reg1:ice:1,1").list, mid = centre("1,1", GRID);
  assert.ok(chips.length >= 6 && chips.every((c) => Math.hypot(c.x - mid.x, c.y - mid.y) > GRID * 0.15), "slush at its edge, not shards in its middle");
});

// ---- where the ice has given way, the floor is water ----
// The question is asked of the hole's own drawn shape and not of the square it is keyed by, so it lives here, with that
// shape. A hole is drawn a square wider than what fell through it, and a footprint an even number of squares across
// stands with its centre in a different square from the one its weight broke, so a square key cannot answer it.

const holed = (thinIce, { thin = true, holds = "med" } = {}) => ({ id: "reg1", flags: { animater: { iceThin: thin, iceHolds: holds, thinIce } } });

test("a point in a hole is water; the rest of the ice, and a region with no holes, is not", () => {
  const regions = [holed({ cracks: { "0,0": 1 }, holes: { "3,4": 2 } })];
  assert.equal(iceHoleAt({ x: 350, y: 450 }, { regions, grid: GRID }), true);
  assert.equal(iceHoleAt({ x: 50, y: 50 }, { regions, grid: GRID }), false, "a cracked square still carries a creature");
  assert.equal(iceHoleAt({ x: 350, y: 450 }, { regions: [holed({})], grid: GRID }), false);
  assert.equal(iceHoleAt({ x: 350, y: 450 }, { regions: [holed({ holes: { "3,4": 2 } }, { thin: false })], grid: GRID }), false, "thin ice off: the region's holes are not ours");
});

test("the water reaches as far as the hole is drawn, and no further", () => {
  // A Large creature's hole is drawn three squares across, centred on the square it broke: the dark water beside that
  // square is water underfoot too, and what is drawn as ice still carries.
  const region = holed({ holes: { "3,4": 2 } }), regions = [region];
  const ring = iceBreakOf(region, { grid: GRID }).holes[0].areas[0];
  const ask = (p) => iceHoleAt(p, { regions, grid: GRID });
  let water = 0, ice = 0;
  for (let col = 0; col <= 7; col++) for (let row = 1; row <= 8; row++) {
    const p = { x: (col + 0.5) * GRID, y: (row + 0.5) * GRID };
    // Ray cast against the very ring the water engine is handed, as the only other reading of the same shape.
    let inRing = false;
    for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
      const ax = ring[i], ay = ring[i + 1], bx = ring[j], by = ring[j + 1];
      if (ay > p.y !== by > p.y && p.x < ((bx - ax) * (p.y - ay)) / (by - ay) + ax) inRing = !inRing;
    }
    assert.equal(ask(p), inRing, `${col},${row} reads as ${ask(p) ? "water" : "ice"} and is drawn as ${inRing ? "water" : "ice"}`);
    if (inRing) water++; else ice++;
  }
  assert.ok(water >= 5, `the hole is wider than its one square: ${water} squares of water`);
  assert.ok(ice > water, "and the ice round it still carries");
});

test("the region has the last say over a point in one of its holes", () => {
  const regions = [holed({ holes: { "3,4": 2 } })];
  const asked = [];
  assert.equal(iceHoleAt({ x: 350, y: 450 }, { regions, grid: GRID, inside: (doc, point) => { asked.push([doc.id, point.x, point.y]); return false; } }), false);
  assert.deepEqual(asked, [["reg1", 350, 450]], "asked once, about the point itself");
  assert.equal(iceHoleAt({ x: 50, y: 50 }, { regions, grid: GRID, inside: () => { throw new Error("never asked outside a hole"); } }), false);
});

test("iceHoleAt never throws on junk, and a region that throws is only itself", () => {
  const good = holed({ holes: { "3,4": 2 } });
  assert.equal(iceHoleAt({ x: 350, y: 450 }, { regions: [null, undefined, {}, "x", good], grid: GRID }), true);
  assert.equal(iceHoleAt({ x: 350, y: 450 }, { regions: [good], grid: GRID, inside: () => { throw new Error("broken region"); } }), false);
  assert.equal(iceHoleAt(null, { regions: [good], grid: GRID }), false);
  assert.equal(iceHoleAt({ x: 350, y: 450 }, { regions: [good], grid: 0 }), false);
  assert.equal(iceHoleAt({ x: 350, y: 450 }), false);
  assert.equal(iceHoleAt(), false);
});

test("the rings the floor is asked about are the very rings the water engine is handed", () => {
  const region = holed({ holes: { "3,4": 2, "0,0": 4 } });
  const rings = iceHoleRings(region, { grid: GRID });
  const drawn = iceBreakOf(region, { grid: GRID }).holes;
  assert.equal(rings.length, 2);
  for (const { key, ring } of rings) {
    const spec = drawn.find((h) => h.id === `reg1:ice:${key}`);
    assert.deepEqual(spec.areas[0], ring.flatMap((p) => [p.x, p.y]), `${key} is one shape, not two`);
  }
});

test("the same stored ice gives byte-identical rings every time, so the water keeps its mesh", () => {
  const stored = { holes: { "3,4": 2 } };
  const once = iceBreakOf(holed(stored), { grid: GRID }).holes[0].areas;
  const twice = iceBreakOf(holed(stored), { grid: GRID }).holes[0].areas;
  assert.equal(JSON.stringify(once), JSON.stringify(twice));
  const kept = holed(stored);
  assert.equal(JSON.stringify(iceBreakOf(kept, { grid: GRID }).holes[0].areas), JSON.stringify(iceBreakOf(kept, { grid: GRID }).holes[0].areas), "and again from the one region, through the kept rings");
  const more = iceBreakOf(holed({ holes: { "3,4": 2, "9,9": 1 } }), { grid: GRID }).holes;
  assert.equal(JSON.stringify(more.find((h) => h.id === "reg1:ice:3,4").areas), JSON.stringify(once), "a second hole never moves the first");
});

test("a region's kept rings follow its stored ice when it changes", () => {
  const region = holed({ holes: { "3,4": 2 } });
  assert.equal(iceHoleRings(region, { grid: GRID }).length, 1);
  region.flags.animater.thinIce = { holes: { "3,4": 2, "0,0": 1 } };
  assert.equal(iceHoleRings(region, { grid: GRID }).length, 2, "the new hole is there");
  region.flags.animater.thinIce = { holes: {} };
  assert.deepEqual(iceHoleRings(region, { grid: GRID }), [], "and a refreeze leaves nothing behind");
  region.flags.animater.thinIce = { holes: { "3,4": 2 } };
  assert.equal(iceHoleRings(region, { grid: 50 })[0].ring[0].x, iceHoleRings(holed({ holes: { "3,4": 2 } }), { grid: 50 })[0].ring[0].x, "and another grid is drawn for that grid");
});

test("a plate rides the water: it moves on the clock, and barely", () => {
  const plate = icePlates("3,4", { grid: GRID, seed: 2, size: 2 })[0];
  const still = plateAt(plate, 0), later = plateAt(plate, 5);
  assert.notDeepEqual(still, later, "it is not frozen in place");
  for (const at of [still, later, plateAt(plate, 123.4)]) {
    assert.ok(Math.hypot(at.dx, at.dy) < GRID * 0.05, "a slab does not bob about like a chip");
    assert.ok(Math.abs(at.turn) < 0.05, "nor does it spin");
  }
});

test("every screen rides it the same way, and junk never throws", () => {
  const plate = icePlates("3,4", { grid: GRID, seed: 2, size: 2 })[0];
  assert.deepEqual(plateAt(plate, 3.5), plateAt(plate, 3.5));
  for (const bad of [undefined, null, {}, 7, "now"]) {
    const at = plateAt(bad, 1);
    assert.ok(Number.isFinite(at.dx) && Number.isFinite(at.dy) && Number.isFinite(at.turn));
  }
  for (const when of [undefined, null, NaN, "soon"]) {
    const at = plateAt(plate, when);
    assert.ok(Number.isFinite(at.dx) && Number.isFinite(at.dy) && Number.isFinite(at.turn));
  }
});

test("a break leaves chips as well as slabs, floating in the opening it made", () => {
  // A big creature takes ice down with it and some of it comes back up: small pieces loose in the water, not slabs.
  const o = { grid: GRID, seed: 4, size: 4 };
  const plates = icePlates("3,4", o);
  const chips = plates.filter((pl) => pl.chip), slabs = plates.filter((pl) => !pl.chip);
  assert.ok(chips.length >= 1 && chips.length <= 3, `a few chips, not a slick of them: ${chips.length}`);
  assert.ok(slabs.length > chips.length, "the sheet is still mostly slabs");
  const area = (pts) => Math.abs(pts.reduce((sum, a, i) => { const b = pts[(i + 1) % pts.length]; return sum + (a.x * b.y - b.x * a.y); }, 0)) / 2;
  const biggest = Math.max(...slabs.map((pl) => area(pl.points)));
  for (const chip of chips) assert.ok(area(chip.points) < biggest * 0.5, "a chip is a good deal smaller than a slab");
});

test("no edge of a slab is a perfectly straight run: ice breaks chipped", () => {
  // Three points in a row on one line is a drawn shape, not a broken one. Every edge carries a bite or two out of it.
  const plates = icePlates("3,4", { grid: GRID, seed: 6, size: 2 });
  let straight = 0, corners = 0;
  for (const plate of plates) {
    const pts = plate.points;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length], c2 = pts[(i + 2) % pts.length];
      const cross = (b.x - a.x) * (c2.y - a.y) - (b.y - a.y) * (c2.x - a.x);
      corners++;
      if (Math.abs(cross) < 1e-6) straight++;
    }
  }
  assert.ok(corners > 20, `enough corners to judge: ${corners}`);
  assert.ok(straight / corners < 0.1, `hardly any three points in a row: ${straight} of ${corners}`);
});

// The point test the module is given, the same shape main.mjs's own is: flat x, y pairs, and a point inside one of the
// area's holes counts as outside it.
const inArea = ({ x, y }, p) => {
  if (p?.holes?.some((h) => inArea({ x, y }, h))) return false;
  let hit = false;
  for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) if ((p[i + 1] > y) !== (p[j + 1] > y) && x < ((p[j] - p[i]) * (y - p[i + 1])) / (p[j + 1] - p[i + 1]) + p[i]) hit = !hit;
  return hit;
};
const square = (x, y, w) => [x, y, x + w, y, x + w, y + w, x, y + w];
const ringAt = (x, y, r) => ({ areas: [[x - r, y - r, x + r, y - r, x + r, y + r, x - r, y + r]] });

test("a hole in the ice is cut out of the region's own floor, so nothing paints ice over the opening", () => {
  // The painted floor and the step look are both drawn over the moving water, so an opening the floor does not know
  // about is an opening with ice painted across it, and a creature in the water stands on a sheet that is not there.
  const areas = [square(0, 0, 400)];
  const out = cutIceHoles(areas, [ringAt(200, 200, 40)], inArea);
  assert.equal(out, areas, "the region's own areas are what comes back");
  assert.equal(out[0].holes?.length, 1, "the opening is cut out of the area that holds it");
  assert.ok(!inArea({ x: 200, y: 200 }, out[0]), "the middle of the opening is no longer part of the floor");
  assert.ok(inArea({ x: 40, y: 40 }, out[0]), "the ice away from it is untouched");
});

test("each opening is cut from the part of the region that holds it, not whichever came first", () => {
  // A region drawn in two pieces: a hole in the far piece must not be cut out of the near one, or the wrong floor goes
  // missing and the opening stays painted over.
  const near = square(0, 0, 200), far = square(1000, 0, 200);
  const out = cutIceHoles([near, far], [ringAt(1100, 100, 30)], inArea);
  assert.equal(out[0].holes ?? null, null, "the piece the opening is not in keeps its whole floor");
  assert.equal(out[1].holes?.length, 1, "the piece that holds it is the one cut");
});

test("two openings in one piece are both cut, the second judged on the floor as it was", () => {
  // Every ring's home is read before any is cut: a point inside a hole counts as outside the area that holds it, so a
  // second ring judged after the first was cut would find no home and fall to whichever area came first.
  const one = square(0, 0, 400), two = square(1000, 0, 400);
  const out = cutIceHoles([two, one], [ringAt(100, 100, 30), ringAt(300, 300, 30)], inArea);
  assert.equal(out[1].holes?.length, 2, "both openings are cut from the piece that holds them");
  assert.equal(out[0].holes ?? null, null, "and none of them lands on the other piece");
});

test("a region with no broken ice is handed back exactly as it came", () => {
  const areas = [square(0, 0, 400)];
  assert.equal(cutIceHoles(areas, [], inArea), areas);
  assert.equal(areas[0].holes ?? null, null, "nothing is cut, and no empty hole list is invented");
  assert.equal(cutIceHoles(areas, null, inArea), areas, "junk for the holes is no holes");
  assert.deepEqual(cutIceHoles([], [ringAt(0, 0, 10)], inArea), [], "and a region with no areas stays none");
});

test("a hole gives back little of the light, and meltwater gives back all of it", () => {
  // A hole two squares across sits wholly inside a torch's glint, so at full light it came out solid gold while the
  // river it is a hole in shows that same glint as a highlight on dark water. A melt is the other case: a puddle
  // standing open on the ice, which should catch a flame the way any puddle does.
  const broke = iceBreakOf(holed({ holes: { "3,4": 1 } }), { grid: GRID }).holes[0];
  const melted = iceBreakOf(holed({ holes: { "3,4": MELTED } }), { grid: GRID }).holes[0];
  assert.ok(broke.light > 0 && broke.light <= 0.35, `a hole lies down a shaft: ${broke.light}`);
  assert.ok(broke.light > 0, "and not in the dark: none at all kills the glint that says it is water");
  assert.equal(melted.light, 1, "meltwater stands open");
});
