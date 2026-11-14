import test from "node:test";
import assert from "node:assert/strict";
import { SIZES, holdsUp, iceStep, iceStateOf, iceUpdatesFor, squareKeyAt, squaresCrossed, sizeNameOf, squaresAcross, iceHoleAt, iceMoveFor } from "../../../scripts/engines/regions/thin-ice.mjs";

test("the limit holds its own size and everything smaller", () => {
  assert.equal(holdsUp("med", "sm"), 0);
  assert.equal(holdsUp("med", "med"), 0);
  assert.equal(holdsUp("med", "lg"), 1);
  assert.equal(holdsUp("med", "huge"), 2);
  assert.equal(holdsUp("med", "grg"), 2);
});

test("the sizes run from tiny to gargantuan", () => {
  assert.deepEqual(SIZES, ["tiny", "sm", "med", "lg", "huge", "grg"]);
});

test("one size over cracks every square it enters and breaks none", () => {
  const r = iceStep({ limit: "med", size: "lg", squares: ["3,4", "3,5"], cracked: [] });
  assert.deepEqual(r.cracks, ["3,4", "3,5"]);
  assert.deepEqual(r.breaks, []);
});

test("one size over breaks a square that is already cracked", () => {
  const r = iceStep({ limit: "med", size: "lg", squares: ["3,4"], cracked: ["3,4"] });
  assert.deepEqual(r.breaks, ["3,4"]);
});

test("two sizes over breaks the first square it enters, and no further", () => {
  const r = iceStep({ limit: "med", size: "huge", squares: ["3,4", "3,5"], cracked: [] });
  assert.deepEqual(r.breaks, ["3,4"]);
  assert.deepEqual(r.cracks, []);
});

test("a creature at or under the limit never cracks anything", () => {
  const r = iceStep({ limit: "lg", size: "med", squares: ["1,1", "1,2"], cracked: ["1,2"] });
  assert.deepEqual(r, { cracks: [], breaks: [], note: null });
});

test("a creature exactly at the limit never cracks anything", () => {
  const r = iceStep({ limit: "med", size: "med", squares: ["1,1"], cracked: ["1,1"], ended: "1,1" });
  assert.deepEqual(r, { cracks: [], breaks: [], note: null });
});

test("ending a move on a square it just cracked breaks it", () => {
  const r = iceStep({ limit: "med", size: "lg", squares: ["2,2"], cracked: [], ended: "2,2" });
  assert.deepEqual(r.breaks, ["2,2"]);
  assert.deepEqual(r.cracks, []);
});

test("a square never lands in both lists", () => {
  const r = iceStep({ limit: "med", size: "lg", squares: ["1,1", "1,2", "1,3"], cracked: ["1,2"], ended: "1,3" });
  assert.deepEqual(r.cracks, ["1,1"]);
  assert.deepEqual(r.breaks, ["1,2", "1,3"]);
});

test("a break is whispered by name, a crack more quietly, nothing at all is null", () => {
  const broke = iceStep({ limit: "med", size: "huge", squares: ["3,4"], cracked: [], name: "Torvald" });
  assert.equal(broke.note, "Torvald breaks through the ice into the water (swim).");
  const cracked = iceStep({ limit: "med", size: "lg", squares: ["3,4"], cracked: [], name: "Torvald" });
  assert.match(cracked.note, /Torvald/);
  assert.match(cracked.note, /crack/);
  assert.notEqual(cracked.note, broke.note);
  assert.equal(iceStep({ limit: "med", size: "sm", squares: ["3,4"], cracked: [] }).note, null);
});

test("an unnamed creature still gets a plain whisper", () => {
  const r = iceStep({ limit: "med", size: "huge", squares: ["3,4"], cracked: [] });
  assert.equal(r.note, "A creature breaks through the ice into the water (swim).");
});

test("crossing its own crack in the same move breaks it, and lists no square twice", () => {
  const r = iceStep({ limit: "med", size: "lg", squares: ["3,4", "3,5", "3,4"], cracked: [] });
  assert.deepEqual(r.breaks, ["3,4"]);
  assert.deepEqual(r.cracks, ["3,5"]);
});

test("a square entered three times in one move is still listed once", () => {
  const r = iceStep({ limit: "med", size: "lg", squares: ["1,1", "1,1", "1,1"], cracked: [] });
  assert.deepEqual(r.breaks, ["1,1"]);
  assert.deepEqual(r.cracks, []);
});

test("a cracked square entered twice is broken once", () => {
  const r = iceStep({ limit: "med", size: "lg", squares: ["1,1", "1,1"], cracked: ["1,1"] });
  assert.deepEqual(r.breaks, ["1,1"]);
  assert.deepEqual(r.cracks, []);
});

test("a region with no cracked list yet does not throw", () => {
  const r = iceStep({ limit: "med", size: "lg", squares: ["3,4"] });
  assert.deepEqual(r.cracks, ["3,4"]);
  assert.deepEqual(r.breaks, []);
  assert.deepEqual(iceStep({ limit: "med", size: "lg" }), { cracks: [], breaks: [], note: null });
  assert.deepEqual(iceStep(), { cracks: [], breaks: [], note: null });
});

const FLAG = "flags.animater.thinIce";
const regionWith = (thinIce) => ({ id: "reg1", flags: { animater: { thinIce } } });

test("iceStateOf reads the stored maps back as sorted key lists", () => {
  const doc = regionWith({ cracks: { "3,5": 1, "3,4": 1 }, holes: { "7,2": 1 } });
  assert.deepEqual(iceStateOf(doc), { cracks: ["3,4", "3,5"], holes: ["7,2"], holeSizes: { "7,2": 1 } });
});

test("iceStateOf is empty for a missing flag, an empty object, null, a string and a number", () => {
  const empty = { cracks: [], holes: [], holeSizes: {} };
  assert.deepEqual(iceStateOf({}), empty);
  assert.deepEqual(iceStateOf({ flags: {} }), empty);
  assert.deepEqual(iceStateOf(regionWith({})), empty);
  assert.deepEqual(iceStateOf(regionWith(null)), empty);
  assert.deepEqual(iceStateOf(regionWith("cracked")), empty);
  assert.deepEqual(iceStateOf(regionWith(NaN)), empty);
  assert.deepEqual(iceStateOf(null), empty);
  assert.deepEqual(iceStateOf(undefined), empty);
});

test("iceStateOf drops junk: non-object maps, NaN or empty markers, keys that are not squares", () => {
  assert.deepEqual(iceStateOf(regionWith({ cracks: "3,4", holes: ["1,1"] })), { cracks: [], holes: [], holeSizes: {} });
  const doc = regionWith({ cracks: { "3,4": 1, "5,5": NaN, "6,6": null, "7,7": 0, nope: 1, "": 1 }, holes: { "1,1": 1, "x,2": 1 } });
  assert.deepEqual(iceStateOf(doc), { cracks: ["3,4"], holes: ["1,1"], holeSizes: { "1,1": 1 } });
});

test("iceStateOf reads how wide each hole is, and a hole stored without a size has none", () => {
  const doc = regionWith({ holes: { "1,1": 3, "2,2": true, "3,3": "big", "4,4": -2 }, cracks: { "9,9": 1 } });
  const state = iceStateOf(doc);
  assert.deepEqual(state.holes, ["1,1", "2,2", "3,3", "4,4"], "anything truthy is a hole; a size of its own is extra");
  assert.deepEqual(state.holeSizes, { "1,1": 3 }, "only a width that makes sense; the drawing falls back to the limit for the rest");
  assert.deepEqual(state.cracks, ["9,9"], "cracks are untouched by any of it");
});

test("a new crack is written at its own key, never as a whole object", () => {
  const [u] = iceUpdatesFor({ cracks: ["3,4"], breaks: [] }, { region: regionWith({}) });
  assert.deepEqual(u, { _id: "reg1", [`${FLAG}.cracks.3,4`]: 1 });
});

test("a crack that breaks is deleted from cracks by name and added to holes in one update", () => {
  const region = regionWith({ cracks: { "3,4": 1 } });
  const updates = iceUpdatesFor({ cracks: [], breaks: ["3,4"] }, { region });
  assert.equal(updates.length, 1);
  assert.deepEqual(updates[0], { _id: "reg1", [`${FLAG}.cracks.-=3,4`]: null, [`${FLAG}.holes.3,4`]: 1 });
});

test("a break on a square that was never cracked only adds the hole", () => {
  const [u] = iceUpdatesFor({ cracks: [], breaks: ["2,2"] }, { region: regionWith({ cracks: { "9,9": 1 } }) });
  assert.deepEqual(u, { _id: "reg1", [`${FLAG}.holes.2,2`]: 1 });
});

test("no update writes the whole thinIce or cracks object", () => {
  const region = regionWith({ cracks: { "1,1": 1 } });
  const [u] = iceUpdatesFor({ cracks: ["4,4"], breaks: ["1,1"] }, { region });
  for (const key of Object.keys(u)) {
    assert.notEqual(key, FLAG);
    assert.notEqual(key, `${FLAG}.cracks`);
    assert.notEqual(key, `${FLAG}.holes`);
  }
});

test("an unchanged state writes nothing", () => {
  const region = regionWith({ cracks: { "3,4": 1 }, holes: { "7,2": 1 } });
  assert.deepEqual(iceUpdatesFor({ cracks: [], breaks: [] }, { region }), []);
  assert.deepEqual(iceUpdatesFor({ cracks: ["3,4"], breaks: ["7,2"] }, { region }), []);
  assert.deepEqual(iceUpdatesFor({ cracks: ["7,2"], breaks: [] }, { region }), []);
});

test("iceUpdatesFor tolerates a missing step, region or region id", () => {
  assert.deepEqual(iceUpdatesFor(undefined, { region: regionWith({}) }), []);
  assert.deepEqual(iceUpdatesFor({ cracks: ["1,1"], breaks: [] }), []);
  assert.deepEqual(iceUpdatesFor({ cracks: ["1,1"], breaks: [] }, { region: { flags: {} } }), []);
});

test("a square listed as both crack and break breaks, and the update carries the region's _id", () => {
  const [u] = iceUpdatesFor({ cracks: ["1,1"], breaks: ["1,1"] }, { region: { _id: "abc", flags: {} } });
  assert.deepEqual(u, { _id: "abc", [`${FLAG}.holes.1,1`]: 1 });
});

// ---- the squares a move passes through ----
const GRID = 100;
const crossed = (points) => squaresCrossed(points, GRID);

test("a square is named by the column and row its point falls in, even left of or above the origin", () => {
  assert.equal(squareKeyAt(350, 420, GRID), "3,4");
  assert.equal(squareKeyAt(0, 0, GRID), "0,0");
  assert.equal(squareKeyAt(-1, -1, GRID), "-1,-1");
  assert.equal(squareKeyAt(-150, 250, GRID), "-2,2");
  assert.equal(squareKeyAt(NaN, 0, GRID), null);
  assert.equal(squareKeyAt(10, 10, 0), null);
});

test("a move that starts, turns and ends inside one square crosses exactly that one", () => {
  assert.deepEqual(crossed([{ x: 310, y: 420 }, { x: 390, y: 480 }, { x: 320, y: 410 }]), ["3,4"]);
  assert.deepEqual(crossed([{ x: 350, y: 450 }]), ["3,4"]);
});

test("a straight walk lists every square it passes through, in the order it entered them", () => {
  assert.deepEqual(crossed([{ x: 50, y: 50 }, { x: 350, y: 50 }]), ["0,0", "1,0", "2,0", "3,0"]);
  assert.deepEqual(crossed([{ x: 50, y: 250 }, { x: 50, y: 50 }]), ["0,2", "0,1", "0,0"]);
});

test("a move that only clips a corner includes that square", () => {
  // From low in 0,2 to high in 2,1: it cuts across the corner of 1,1 on the way, which its waypoints never land in.
  assert.deepEqual(crossed([{ x: 90, y: 210 }, { x: 210, y: 190 }]), ["0,2", "1,2", "1,1", "2,1"]);
});

test("a step clean through the corner of four squares touches neither square beside it", () => {
  assert.deepEqual(crossed([{ x: 50, y: 150 }, { x: 150, y: 50 }]), ["0,1", "1,0"]);
  assert.deepEqual(crossed([{ x: 50, y: 50 }, { x: 250, y: 250 }]), ["0,0", "1,1", "2,2"]);
});

test("a square left and entered again in one move is listed again, but never twice in a row", () => {
  const out = crossed([{ x: 50, y: 50 }, { x: 250, y: 50 }, { x: 50, y: 50 }]);
  assert.deepEqual(out, ["0,0", "1,0", "2,0", "1,0", "0,0"]);
});

test("each leg of a move is walked from where it starts, so a leg that was not walked is no gap to cross", () => {
  // Two walked legs with a flight between them: main.mjs hands the walked legs over, and neither leg invents the squares between.
  assert.deepEqual(crossed([{ x: 50, y: 50 }, { x: 150, y: 50 }]), ["0,0", "1,0"]);
  assert.deepEqual(crossed([{ x: 950, y: 50 }, { x: 1050, y: 50 }]), ["9,0", "10,0"]);
});

test("squaresCrossed tolerates junk: no grid, no path, points that are not numbers", () => {
  assert.deepEqual(squaresCrossed([{ x: 50, y: 50 }], 0), []);
  assert.deepEqual(squaresCrossed([{ x: 50, y: 50 }]), []);
  assert.deepEqual(squaresCrossed([], GRID), []);
  assert.deepEqual(squaresCrossed(undefined, GRID), []);
  assert.deepEqual(squaresCrossed("3,4", GRID), []);
  assert.deepEqual(squaresCrossed([{ x: NaN, y: 0 }, { x: 50, y: 50 }], GRID), ["0,0"]);
  assert.deepEqual(squaresCrossed([{ x: 50, y: 50 }, { x: Infinity, y: 50 }], GRID), ["0,0"]);
});

// ---- how big the creature is ----
test("a creature's size is read by name, which tells Small from Medium as no square count can", () => {
  assert.equal(sizeNameOf({ size: "sm" }, { width: 1, height: 1 }), "sm");
  assert.equal(sizeNameOf({ size: "med" }, { width: 1, height: 1 }), "med");
  assert.equal(holdsUp("sm", sizeNameOf({ size: "med" }, { width: 1 })), 1, "ice that holds Small gives way under a Medium");
  assert.equal(holdsUp("sm", sizeNameOf({ size: "sm" }, { width: 1 })), 0);
});

test("a creature's size is read wherever a system keeps it, long spellings and all", () => {
  assert.equal(sizeNameOf({ size: "Large" }), "lg");
  assert.equal(sizeNameOf({ system: { traits: { size: { value: "huge" } } } }), "huge");
  assert.equal(sizeNameOf({ system: { traits: { size: "gargantuan" } } }), "grg");
  assert.equal(sizeNameOf({ system: { size: "small" } }), "sm");
  assert.equal(sizeNameOf({ size: "tiny" }), "tiny");
  assert.equal(sizeNameOf({ size: "medium" }), "med");
});

test("a creature whose system names no size is read from its footprint, and one with nothing at all is unknown", () => {
  assert.equal(sizeNameOf(null, { width: 0.5, height: 0.5 }), "tiny");
  assert.equal(sizeNameOf({}, { width: 1 }), "med");
  assert.equal(sizeNameOf({ size: "banana" }, { width: 2 }), "lg");
  assert.equal(sizeNameOf(null, { width: 3 }), "huge");
  assert.equal(sizeNameOf(null, { width: 4 }), "grg");
  assert.equal(sizeNameOf(null, { document: { width: 2 } }), "lg");
  assert.equal(sizeNameOf(null, null), null);
  assert.equal(sizeNameOf(), null);
  assert.equal(holdsUp("med", sizeNameOf()), 0, "a size nobody knows never breaks the ice");
});

test("how many squares each size takes up", () => {
  assert.deepEqual(SIZES.map(squaresAcross), [0.5, 1, 1, 2, 3, 4]);
  assert.equal(squaresAcross("banana"), undefined);
});

// ---- what one move does to one region ----
const iceRegion = (thinIce, { thin = true, holds = "med" } = {}) => ({ id: "reg1", flags: { animater: { iceThin: thin, iceHolds: holds, thinIce } } });

test("a creature the ice holds writes nothing at all, not even an empty update", () => {
  const out = iceMoveFor({ region: iceRegion({ cracks: { "1,1": 1 } }), size: "med", squares: ["1,1", "1,2"], ended: "1,2", name: "Pip" });
  assert.deepEqual(out, { updates: [], note: null });
});

test("a creature two sizes over breaks the first square it enters, and no other", () => {
  const { updates, note } = iceMoveFor({ region: iceRegion({}), size: "huge", squares: ["3,4", "3,5"], ended: "3,5", name: "Torvald" });
  assert.deepEqual(updates, [{ _id: "reg1", [`${FLAG}.holes.3,4`]: 3 }]);
  assert.equal(note, "Torvald breaks through the ice into the water (swim).");
});

test("the hole is as wide as the creature that fell through it, not as wide as the limit", () => {
  const huge = iceMoveFor({ region: iceRegion({}), size: "huge", squares: ["3,4"] }).updates[0];
  const large = iceMoveFor({ region: iceRegion({}), size: "lg", squares: ["3,4"], ended: "3,4" }).updates[0];
  assert.equal(huge[`${FLAG}.holes.3,4`], 3, "a Huge creature");
  assert.equal(large[`${FLAG}.holes.3,4`], 2, "a Large one, through the same square");
});

test("one size over cracks what it crosses and breaks the square it stopped on", () => {
  const { updates, note } = iceMoveFor({ region: iceRegion({}), size: "lg", squares: ["1,1", "1,2", "1,3"], ended: "1,3", name: "Bron" });
  assert.deepEqual(updates, [{ _id: "reg1", [`${FLAG}.holes.1,3`]: 2, [`${FLAG}.cracks.1,1`]: 1, [`${FLAG}.cracks.1,2`]: 1 }]);
  assert.equal(note, "Bron breaks through the ice into the water (swim).");
});

test("a second heavy creature over another's cracks falls through them, and the crack is cleared by name", () => {
  const region = iceRegion({ cracks: { "1,1": 1, "1,2": 1 } });
  const { updates, note } = iceMoveFor({ region, size: "lg", squares: ["1,1", "1,2"], ended: "1,2", name: "Bron" });
  assert.deepEqual(updates, [{
    _id: "reg1",
    [`${FLAG}.cracks.-=1,1`]: null, [`${FLAG}.holes.1,1`]: 2,
    [`${FLAG}.cracks.-=1,2`]: null, [`${FLAG}.holes.1,2`]: 2,
  }]);
  assert.match(note, /breaks through the ice/);
});

test("a region the GM never marked as thin ice is left alone, whatever walks over it", () => {
  for (const thin of [false, undefined, "true", 1]) {
    const region = { id: "reg1", flags: { animater: { iceThin: thin, iceHolds: "med", thinIce: {} } } };
    assert.deepEqual(iceMoveFor({ region, size: "grg", squares: ["1,1"], ended: "1,1" }), { updates: [], note: null }, `thin ice off as ${JSON.stringify(thin)}`);
  }
});

test("iceMoveFor reads the region's own limit, and holds nothing against junk", () => {
  assert.deepEqual(iceMoveFor({ region: iceRegion({}, { holds: "huge" }), size: "lg", squares: ["1,1"], ended: "1,1" }), { updates: [], note: null });
  assert.equal(iceMoveFor({ region: iceRegion({}, { holds: "sm" }), size: "med", squares: ["1,1"], ended: "1,1" }).updates.length, 1);
  assert.deepEqual(iceMoveFor({ region: iceRegion({}), size: "huge" }), { updates: [], note: null });
  assert.deepEqual(iceMoveFor({}), { updates: [], note: null });
  assert.deepEqual(iceMoveFor(), { updates: [], note: null });
});

// ---- where the ice has given way, the floor is water ----
test("a point in a hole is water; the rest of the ice, and a region with no holes, is not", () => {
  const region = iceRegion({ cracks: { "0,0": 1 }, holes: { "3,4": 2 } });
  const regions = [region];
  assert.equal(iceHoleAt({ x: 350, y: 450 }, { regions, grid: GRID }), true);
  assert.equal(iceHoleAt({ x: 50, y: 50 }, { regions, grid: GRID }), false, "a cracked square still carries a creature");
  assert.equal(iceHoleAt({ x: 350, y: 450 }, { regions: [iceRegion({})], grid: GRID }), false);
  assert.equal(iceHoleAt({ x: 350, y: 450 }, { regions: [iceRegion({ holes: { "3,4": 2 } }, { thin: false })], grid: GRID }), false, "thin ice off: the region's holes are not ours");
});

test("the region has the last say over a point in one of its hole squares", () => {
  const regions = [iceRegion({ holes: { "3,4": 2 } })];
  const asked = [];
  assert.equal(iceHoleAt({ x: 350, y: 450 }, { regions, grid: GRID, inside: (doc, point) => { asked.push([doc.id, point.x, point.y]); return false; } }), false);
  assert.deepEqual(asked, [["reg1", 350, 450]], "asked once, about the point itself");
  assert.equal(iceHoleAt({ x: 50, y: 50 }, { regions, grid: GRID, inside: () => { throw new Error("never asked outside a hole"); } }), false);
});

test("iceHoleAt never throws on junk, and a region that throws is only itself", () => {
  const good = iceRegion({ holes: { "3,4": 2 } });
  assert.equal(iceHoleAt({ x: 350, y: 450 }, { regions: [null, undefined, {}, "x", good], grid: GRID }), true);
  assert.equal(iceHoleAt({ x: 350, y: 450 }, { regions: [good], grid: GRID, inside: () => { throw new Error("broken region"); } }), false);
  assert.equal(iceHoleAt(null, { regions: [good], grid: GRID }), false);
  assert.equal(iceHoleAt({ x: 350, y: 450 }, { regions: [good], grid: 0 }), false);
  assert.equal(iceHoleAt({ x: 350, y: 450 }), false);
  assert.equal(iceHoleAt(), false);
});

test("nothing to write is nothing to whisper: a creature falling into a hole that is already there", () => {
  const region = iceRegion({ holes: { "1,1": 3 } });
  assert.deepEqual(iceMoveFor({ region, size: "huge", squares: ["1,1"], ended: "1,1", name: "Torvald" }), { updates: [], note: null });
});
