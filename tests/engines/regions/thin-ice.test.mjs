import test from "node:test";
import assert from "node:assert/strict";
import { SIZES, holdsUp, iceStep, iceStateOf, iceUpdatesFor, squareKeyAt, squaresCrossed, sizeNameOf, squaresAcross, weightOffset, walkedLegs, squaresEntered, moveSince, movePathName, OFF_THE_FLOOR, thinIceOn, iceSettingsOf, iceMoveFor, iceRefreezeUpdates, iceRepairUpdates, iceMeltUpdates, iceMeltSquares, MELTED } from "../../../scripts/engines/regions/thin-ice.mjs";

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

test("ending a move on a square it just cracked leaves it cracked, not broken", () => {
  const r = iceStep({ limit: "med", size: "lg", squares: ["2,2"], cracked: [] });
  assert.deepEqual(r.cracks, ["2,2"], "where a move stops is not what breaks ice");
  assert.deepEqual(r.breaks, [], "a single step onto sound ice is a crack, however the move ends");
});

test("a square never lands in both lists", () => {
  const r = iceStep({ limit: "med", size: "lg", squares: ["1,1", "1,2", "1,3"], cracked: ["1,2"] });
  assert.deepEqual(r.cracks, ["1,1", "1,3"], "fresh squares crack");
  assert.deepEqual(r.breaks, ["1,2"], "and the one already cracked gives way");
  for (const key of r.breaks) assert.ok(!r.cracks.includes(key));
});

test("a break is whispered by name, a crack more quietly, nothing at all is null", () => {
  const broke = iceStep({ limit: "med", size: "huge", squares: ["3,4"], cracked: [], name: "Torvald", system: "pf2e" });
  assert.equal(broke.note, "Torvald breaks through the ice into the water (swim).");
  const cracked = iceStep({ limit: "med", size: "lg", squares: ["3,4"], cracked: [], name: "Torvald" });
  assert.match(cracked.note, /Torvald/);
  assert.match(cracked.note, /crack/);
  assert.notEqual(cracked.note, broke.note);
  assert.equal(iceStep({ limit: "med", size: "sm", squares: ["3,4"], cracked: [] }).note, null);
});

test("the whisper names a Swim action only where the system has one to name", () => {
  const go = (system) => iceStep({ limit: "med", size: "huge", squares: ["3,4"], cracked: [], name: "Torvald", system }).note;
  assert.equal(go("pf2e"), "Torvald breaks through the ice into the water (swim).");
  assert.equal(go("PF2E"), "Torvald breaks through the ice into the water (swim).", "however the system id is cased");
  assert.equal(go("sf2e"), "Torvald breaks through the ice into the water (swim).");
  for (const system of ["dnd5e", "daggerheart", "drawsteel", "", undefined, null, 7, {}]) {
    assert.equal(go(system), "Torvald breaks through the ice into the water.",
      "a table whose game has no Swim action is told what happened, not told to take an action it does not have");
  }
});

test("an unnamed creature still gets a plain whisper", () => {
  const r = iceStep({ limit: "med", size: "huge", squares: ["3,4"], cracked: [], system: "pf2e" });
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
  assert.deepEqual(iceStateOf(doc), { cracks: ["3,4", "3,5"], holes: ["7,2"], holeSizes: { "7,2": 1 }, melts: [] });
});

test("iceStateOf is empty for a missing flag, an empty object, null, a string and a number", () => {
  const empty = { cracks: [], holes: [], holeSizes: {}, melts: [] };
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
  assert.deepEqual(iceStateOf(regionWith({ cracks: "3,4", holes: ["1,1"] })), { cracks: [], holes: [], holeSizes: {}, melts: [] });
  const doc = regionWith({ cracks: { "3,4": 1, "5,5": NaN, "6,6": null, "7,7": 0, nope: 1, "": 1 }, holes: { "1,1": 1, "x,2": 1 } });
  assert.deepEqual(iceStateOf(doc), { cracks: ["3,4"], holes: ["1,1"], holeSizes: { "1,1": 1 }, melts: [] });
});

test("iceStateOf reads how wide each hole is, and a hole stored without a size has none", () => {
  const doc = regionWith({ holes: { "1,1": 3, "2,2": true, "3,3": "big", "4,4": -2 }, cracks: { "9,9": 1 } });
  const state = iceStateOf(doc);
  assert.deepEqual(state.holes, ["1,1", "2,2", "3,3", "4,4"], "anything truthy is a hole; a size of its own is extra");
  assert.deepEqual(state.holeSizes, { "1,1": 3 }, "only a width that makes sense; the drawing falls back to the limit for the rest");
  assert.deepEqual(state.cracks, ["9,9"], "cracks are untouched by any of it");
});

test("iceStateOf names the squares fire melted apart from the ones a creature broke", () => {
  const state = iceStateOf(regionWith({ holes: { "1,1": MELTED, "2,2": 3 } }));
  assert.deepEqual(state.holes, ["1,1", "2,2"], "both are open water");
  assert.deepEqual(state.melts, ["1,1"], "only the melt is a melt");
  assert.deepEqual(state.holeSizes, { "2,2": 3 }, "and a melt has no creature's width");
});

test("no key written is ever a parent of another key written", () => {
  // A parent object written beside a delete beneath it undoes that delete, and leaves what was cleared sitting in the
  // flag for ever. Nothing here may write `thinIce`, or `thinIce.cracks`, next to `thinIce.cracks.3,4`.
  const region = regionWith({ cracks: { "3,4": 1, "9,9": 1 }, holes: { "0,0": 2 } });
  const every = [
    iceUpdatesFor({ cracks: ["1,1"], breaks: [] }, { region }),
    iceUpdatesFor({ cracks: ["5,5"], breaks: ["3,4"] }, { region, size: 2 }),
    iceUpdatesFor({ cracks: [], breaks: ["9,9", "7,7"] }, { region, size: 3 }),
    iceRefreezeUpdates(region),
    iceMeltUpdates([{ id: "reg1", flags: { animater: { ...region.flags.animater, iceThin: true } }, squares: ["3,4", "2,2"] }]),
  ].flat();
  assert.ok(every.length >= 5, "there is something to check in each shape of write");
  for (const update of every) {
    const keys = Object.keys(update).filter((k) => k !== "_id");
    assert.ok(keys.length, "a write writes something");
    for (const key of keys) for (const other of keys) {
      if (key === other) continue;
      assert.ok(!other.startsWith(`${key}.`), `${key} is a parent of ${other}`);
    }
  }
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
  assert.deepEqual(out, { updates: [], note: null, broke: false });
});

test("a creature two sizes over breaks the first square it enters, and no other", () => {
  const { updates, note } = iceMoveFor({ region: iceRegion({}), size: "huge", squares: ["3,4", "3,5"], ended: "3,5", name: "Torvald", system: "pf2e" });
  assert.deepEqual(updates, [{ _id: "reg1", [`${FLAG}.holes.3,4`]: 3 }]);
  assert.equal(note, "Torvald breaks through the ice into the water (swim).");
});

test("the hole is as wide as the creature that fell through it, not as wide as the limit", () => {
  const huge = iceMoveFor({ region: iceRegion({}), size: "huge", squares: ["3,4"] }).updates[0];
  const large = iceMoveFor({ region: iceRegion({ cracks: { "3,4": 1 } }), size: "lg", squares: ["3,4"] }).updates[0];
  assert.equal(huge[`${FLAG}.holes.3,4`], 3, "a Huge creature, straight through");
  assert.equal(large[`${FLAG}.holes.3,4`], 2, "a Large one, through a crack it found there");
});


test("one size over cracks what it crosses, and goes through where the ice was cracked already", () => {
  const first = iceMoveFor({ region: iceRegion({}), size: "lg", squares: ["1,1", "1,2", "1,3"], name: "Bron", system: "pf2e" });
  assert.deepEqual(first.updates, [{ _id: "reg1", [`${FLAG}.cracks.1,1`]: 1, [`${FLAG}.cracks.1,2`]: 1, [`${FLAG}.cracks.1,3`]: 1 }]);
  assert.equal(first.note, "The ice cracks under Bron.");
  assert.equal(first.broke, false);
  // Walking back over what it cracked is what puts it in.
  const back = iceMoveFor({ region: iceRegion({ cracks: { "1,1": 1, "1,2": 1, "1,3": 1 } }), size: "lg", squares: ["1,2"], name: "Bron", system: "pf2e" });
  assert.equal(back.note, "Bron breaks through the ice into the water (swim).");
  assert.equal(back.broke, true);
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
    assert.deepEqual(iceMoveFor({ region, size: "grg", squares: ["1,1"], ended: "1,1" }), { updates: [], note: null, broke: false }, `thin ice off as ${JSON.stringify(thin)}`);
  }
});

test("iceMoveFor reads the region's own limit, and holds nothing against junk", () => {
  assert.deepEqual(iceMoveFor({ region: iceRegion({}, { holds: "huge" }), size: "lg", squares: ["1,1"], ended: "1,1" }), { updates: [], note: null, broke: false });
  assert.equal(iceMoveFor({ region: iceRegion({}, { holds: "sm" }), size: "med", squares: ["1,1"], ended: "1,1" }).updates.length, 1);
  assert.deepEqual(iceMoveFor({ region: iceRegion({}), size: "huge" }), { updates: [], note: null, broke: false });
  assert.deepEqual(iceMoveFor({}), { updates: [], note: null, broke: false });
  assert.deepEqual(iceMoveFor(), { updates: [], note: null, broke: false });
});

test("nothing to write is nothing to whisper: a creature falling into a hole that is already there", () => {
  const region = iceRegion({ holes: { "1,1": 3 } });
  assert.deepEqual(iceMoveFor({ region, size: "huge", squares: ["1,1"], ended: "1,1", name: "Torvald" }), { updates: [], note: null, broke: false });
});

test("where a creature's weight is read in its footprint, in squares from its own corner", () => {
  assert.equal(weightOffset(1), 0.5, "a Medium creature: the middle of its one square");
  assert.equal(weightOffset(3), 1.5, "a Huge one: the middle of its middle square");
  // An even footprint has no middle square: its middle falls exactly on the grid line between two it stands on equally,
  // and the square nearer its own corner is read, so the weight is always in a square the creature really occupies.
  assert.equal(weightOffset(2), 0.5, "a Large one: the first of the two it straddles");
  assert.equal(weightOffset(4), 1.5, "a Gargantuan one: the first of the middle two");
  assert.equal(weightOffset(0.5), 0.25, "a Tiny one: its own middle, well inside its square");
  for (const junk of [0, -2, NaN, undefined, null, "lg"]) assert.equal(weightOffset(junk), 0.5, `${junk} reads as one square`);
});

test("an even-width creature's weight lands in a square it stands in, not the one past it", () => {
  // A Large creature with its corner on 1,1 covers columns 1 and 2 and rows 1 and 2. Its middle is the point 200,200 —
  // the very corner of 2,2, which it stands on no more than on 1,1, 1,2 and 2,1.
  const weight = (corner, wide) => ({ x: (corner + weightOffset(wide)) * GRID, y: (corner + weightOffset(wide)) * GRID });
  assert.equal(squareKeyAt(weight(1, 2).x, weight(1, 2).y, GRID), "1,1");
  assert.equal(squareKeyAt(weight(1, 4).x, weight(1, 4).y, GRID), "2,2", "a Gargantuan creature on 1,1 covers 1 to 4");
  assert.equal(squareKeyAt(weight(1, 3).x, weight(1, 3).y, GRID), "2,2", "an odd footprint has a middle square of its own");
  assert.equal(squareKeyAt(weight(1, 1).x, weight(1, 1).y, GRID), "1,1");
});

// ---- putting the ice back (Refreeze and Repair), and fire melting it ----

const stored = (id, thinIce, extra = {}) => ({ id, flags: { animater: { iceThin: true, iceHolds: "med", thinIce, ...extra } } });


test("Refreeze clears every crack and every hole by name, and never writes a parent next to a delete under it", () => {
  const region = stored("reg1", { cracks: { "1,1": 1, "-2,3": 1 }, holes: { "4,5": 2 } });
  const [u] = iceRefreezeUpdates(region);
  assert.equal(u._id, "reg1");
  assert.deepEqual(Object.keys(u).filter((k) => k !== "_id").sort(), [
    `${FLAG}.cracks.-=-2,3`, `${FLAG}.cracks.-=1,1`, `${FLAG}.holes.-=4,5`,
  ].sort());
  for (const value of Object.entries(u).filter(([k]) => k !== "_id").map(([, v]) => v)) assert.equal(value, null, "each delete is null, for the caller to convert");
  // The bug that has shipped twice in this feature: a parent object written beside a delete beneath it leaves stale keys.
  for (const key of Object.keys(u)) assert.ok(!/\.(cracks|holes)$/.test(key) && key !== FLAG, `${key} writes a parent object`);
});

test("Refreeze on a region with nothing stored writes nothing at all", () => {
  assert.deepEqual(iceRefreezeUpdates(stored("reg1", {})), []);
  assert.deepEqual(iceRefreezeUpdates(stored("reg1", { cracks: {}, holes: {} })), []);
  assert.deepEqual(iceRefreezeUpdates({ flags: { animater: { thinIce: { holes: { "1,1": 1 } } } } }), [], "and nothing without an id");
  assert.deepEqual(iceRefreezeUpdates(undefined), []);
});

test("Refreeze clears a key the ice stored falsy or malformed too: the region is put back whole", () => {
  const [u] = iceRefreezeUpdates(stored("reg1", { cracks: { "1,1": 0 }, holes: { junk: 1 } }));
  assert.deepEqual(Object.keys(u).filter((k) => k !== "_id").sort(), [`${FLAG}.cracks.-=1,1`, `${FLAG}.holes.-=junk`]);
});

test("Repair puts back every region's ice, one update each, and deletes no region", () => {
  const updates = iceRepairUpdates([
    stored("reg1", { holes: { "1,1": 1 } }),
    stored("reg2", {}),
    stored("reg3", { cracks: { "2,2": 1 } }),
  ]);
  assert.deepEqual(updates.map((u) => u._id), ["reg1", "reg3"]);
  assert.ok(updates.every((u) => !("deleteRegions" in u)));
  assert.deepEqual(iceRepairUpdates([]), []);
  assert.deepEqual(iceRepairUpdates(undefined), []);
});

test("Repair clears the ice of a region the GM has since turned thin ice off on", () => {
  const off = stored("reg1", { holes: { "1,1": 1 } }, { iceThin: false });
  assert.deepEqual(iceRepairUpdates([off]).map((u) => u._id), ["reg1"]);
});

test("fire melts the squares it covers to open water, stored as a melt and not as a break", () => {
  const [u] = iceMeltUpdates([{ ...stored("reg1", { cracks: { "1,1": 1 } }), squares: ["1,1", "1,2"] }]);
  assert.equal(u[`${FLAG}.holes.1,1`], MELTED);
  assert.equal(u[`${FLAG}.holes.1,2`], MELTED);
  assert.equal(u[`${FLAG}.cracks.-=1,1`], null, "the crack under the melt goes by name");
  assert.ok(!(`${FLAG}.cracks.-=1,2`in u), "and a square that was never cracked is not deleted");
});

test("fire melts nothing on a region without thin ice, and nothing where the ice is already open", () => {
  assert.deepEqual(iceMeltUpdates([{ ...stored("reg1", {}, { iceThin: false }), squares: ["1,1"] }]), []);
  assert.deepEqual(iceMeltUpdates([{ ...stored("reg1", { holes: { "1,1": 2 } }), squares: ["1,1"] }]), [], "a hole stays the break it was");
  assert.deepEqual(iceMeltUpdates([{ ...stored("reg1", {}), squares: [] }]), []);
  assert.deepEqual(iceMeltUpdates([{ ...stored("reg1", {}), squares: ["junk", "1.5,2"] }]), []);
  assert.deepEqual(iceMeltUpdates(), []);
});

test("the squares a fire area covers are the region's own, on the map's grid", () => {
  const bounds = { x: 0, y: 0, w: 300, h: 300 };
  const round = (at) => Math.hypot(at.x - 150, at.y - 150) <= 60;
  assert.deepEqual(iceMeltSquares({ bounds, grid: GRID, inArea: round }), ["1,1"]);
  assert.deepEqual(iceMeltSquares({ bounds, grid: GRID, inArea: () => true }).length, 9, "all nine squares of the box");
  assert.deepEqual(iceMeltSquares({ bounds, grid: GRID, inside: (at) => at.y < 100, inArea: () => true }), ["0,0", "1,0", "2,0"], "only the squares the region itself holds");
  assert.deepEqual(iceMeltSquares({ bounds, grid: GRID }), [], "an area covering nothing melts nothing");
  assert.deepEqual(iceMeltSquares({ bounds, grid: GRID, inside: () => { throw new Error("a region mid-change"); }, inArea: () => true }), []);
  assert.deepEqual(iceMeltSquares({ bounds: { x: 0, y: 0, w: 1e6, h: 1e6 }, grid: GRID, inArea: () => true }), [], "a region too big to walk melts nothing");
  for (const bad of [undefined, { bounds: { x: 0, y: 0, w: 0, h: 0 }, grid: GRID }, { bounds: { x: 0, y: 0, w: 100, h: 100 }, grid: 0 }]) assert.deepEqual(iceMeltSquares(bad), []);
});

// ---- the legs of a move, the squares it entered, and a move reported twice ----

const way = (col, row, extra = {}) => ({ x: col * 100, y: row * 100, elevation: 0, action: "walk", teleport: false, ...extra });

test("the actions that leave the floor alone are one list, and swimming is in it", () => {
  assert.deepEqual([...OFF_THE_FLOOR], ["fly", "burrow", "swim", "displace"]);
  assert.ok(Object.isFrozen(OFF_THE_FLOOR), "shared, so never changed under a reader");
});

test("walkedLegs gives the legs really walked, in order, with the last one marked", () => {
  const legs = walkedLegs([way(1, 2), way(1, 3)], { from: way(1, 1) });
  assert.deepEqual(legs.map((l) => [l.from.x, l.from.y, l.to.x, l.to.y, l.last]), [[100, 100, 100, 200, false], [100, 200, 100, 300, true]]);
});

test("a leg flown, burrowed, swum, blinked, teleported or off the floor is left out, and the walk goes on past it", () => {
  for (const extra of [{ action: "fly" }, { action: "burrow" }, { action: "swim" }, { action: "displace" }, { teleport: true }, { elevation: 10 }]) {
    const legs = walkedLegs([way(1, 2, extra), way(1, 3)], { from: way(1, 1) });
    assert.deepEqual(legs.map((l) => [l.from.y, l.to.y, l.last]), [[200, 300, true]], JSON.stringify(extra));
  }
  assert.deepEqual(walkedLegs([way(1, 2)], {}), [], "a move with nowhere to come from walks nothing");
  assert.deepEqual(walkedLegs(undefined, { from: way(1, 1) }), []);
  assert.deepEqual(walkedLegs("waypoints", { from: way(1, 1) }), []);
});

test("walkedLegs reads each end through the point the caller asks for", () => {
  const mid = (w) => ({ x: w.x + 50, y: w.y + 50 });
  assert.deepEqual(walkedLegs([way(1, 2)], { from: way(1, 1), mid }).map((l) => [l.from, l.to]), [[{ x: 150, y: 150 }, { x: 150, y: 250 }]]);
});

test("the squares a move entered leave out the one it began in", () => {
  const legs = walkedLegs([way(1, 2), way(1, 3)], { from: way(1, 1), mid: (w) => ({ x: w.x + 50, y: w.y + 50 }) });
  assert.deepEqual(squaresEntered(legs, 100), ["1,2", "1,3"], "not 1,1, where it was already standing");
  assert.deepEqual(squaresEntered([], 100), []);
  assert.deepEqual(squaresEntered(undefined, 100), []);
  // A move that never leaves its own square enters nothing at all.
  assert.deepEqual(squaresEntered(walkedLegs([way(1, 1)], { from: way(1, 1), mid: (w) => ({ x: w.x + 50, y: w.y + 50 }) }), 100), []);
});

test("a move reported again with a longer path is walked only from where it was left", () => {
  const ways = [way(1, 2), way(1, 3), way(1, 4)];
  const first = moveSince({ origin: way(1, 1), passed: { waypoints: ways.slice(0, 1) } }, undefined);
  assert.deepEqual([first.from.y, first.ways.length, first.done], [100, 1, 1]);
  const second = moveSince({ origin: way(1, 1), passed: { waypoints: ways.slice(0, 2) } }, first);
  assert.deepEqual([second.from.y, second.ways.map((w) => w.y), second.done], [200, [300], 2], "only the new waypoint");
  const third = moveSince({ origin: way(1, 1), passed: { waypoints: ways } }, second);
  assert.deepEqual([third.from.y, third.ways.map((w) => w.y)], [300, [400]]);
  const again = moveSince({ origin: way(1, 1), passed: { waypoints: ways } }, third);
  assert.deepEqual(again.ways, [], "the very same report again walks nothing");
});

test("another move is walked whole, even one starting from the very same square", () => {
  const seen = moveSince({ origin: way(1, 1), passed: { waypoints: [way(1, 2), way(1, 3)] } }, undefined);
  const other = moveSince({ origin: way(1, 1), passed: { waypoints: [way(2, 1)] } }, seen);
  assert.deepEqual([other.from.y, other.ways.map((w) => w.x)], [100, [200]], "from the origin, the whole path");
  const sameLength = moveSince({ origin: way(1, 1), passed: { waypoints: [way(2, 1), way(3, 1)] } }, seen);
  assert.deepEqual(sameLength.ways.map((w) => w.x), [200, 300], "the same number of waypoints, another path");
  // Where Foundry names a move, a different name is a different move however alike the paths are.
  const named = moveSince({ id: "m1", origin: way(1, 1), passed: { waypoints: [way(1, 2)] } }, undefined);
  const renamed = moveSince({ id: "m2", origin: way(1, 1), passed: { waypoints: [way(1, 2), way(1, 3)] } }, named);
  assert.deepEqual(renamed.ways.map((w) => w.y), [200, 300]);
  assert.equal(moveSince({ id: "m1", origin: way(1, 1), passed: { waypoints: [way(1, 2), way(1, 3)] } }, named).ways.length, 1, "the same name goes on from where it was");
});

test("moveSince holds nothing against junk", () => {
  assert.deepEqual(moveSince().ways, []);
  assert.deepEqual(moveSince({}, { done: 3, sig: "x" }).ways, []);
  assert.deepEqual(moveSince({ passed: { waypoints: "x" } }).ways, []);
  assert.equal(moveSince({ origin: way(0, 0), passed: { waypoints: [way(1, 1)] } }, { done: 9, sig: "x" }).ways.length, 1, "more remembered than reported: walked whole");
  assert.equal(movePathName(undefined, 2), "");
  assert.equal(movePathName([way(1, 1)], 0), "");
});

// ---- thin ice is water: a region given another floor is not thin ice ----

test("thin ice is off for a region that is no longer water, and its switch is still there to turn off", () => {
  assert.equal(thinIceOn({ iceThin: true }), true, "a water region with no floor of its own");
  assert.equal(thinIceOn({ iceThin: true, floor: "water" }), true);
  assert.equal(thinIceOn({ iceThin: true, floor: "grass" }), false, "open ground is not thin ice");
  assert.equal(thinIceOn({ iceThin: true, floor: "stone" }), false);
  assert.equal(thinIceOn({ iceThin: true, cavern: "fungus" }), false, "nor is a cave");
  assert.equal(thinIceOn({ iceThin: true, overWater: true, floor: "wood" }), false, "nor a deck over the water");
  assert.equal(thinIceOn({ iceThin: true, indoors: true, floor: "wood" }), false, "nor a room");
  assert.equal(thinIceOn({ iceThin: false, floor: "water" }), false);
  // The flag itself is left alone, so taking the region back to water brings the switch back showing it on.
  assert.equal(iceSettingsOf({ flags: { animater: { iceThin: true, floor: "grass" } } }).thin, false);
  assert.equal(iceSettingsOf({ flags: { animater: { iceThin: true, floor: "water", iceHolds: "lg" } } }).holds, "lg");
});

// ---- the squares a fire melts are the ones it reaches ----

test("only where the region and the fire overlap is walked, so a wide lake still melts", () => {
  // Eighty-one by fifty squares is past the cap: walked whole it melts nothing at all.
  const lake = { x: 0, y: 0, w: 8100, h: 5000 };
  const fire = (p) => Math.hypot(p.x - 3050, p.y - 2050) <= 120;
  assert.deepEqual(iceMeltSquares({ bounds: lake, grid: GRID, inArea: fire }), [], "the whole lake is more than the cap allows");
  assert.deepEqual(iceMeltSquares({ bounds: lake, within: { x: 2930, y: 1930, w: 240, h: 240 }, grid: GRID, inArea: fire }).sort(),
    ["29,20", "30,19", "30,20", "30,21", "31,20"], "narrowed to the fire's own box, the squares under it melt");
});

test("the fire's box never widens the walk past the region, and no box at all walks the region", () => {
  const region = { x: 0, y: 0, w: 200, h: 200 };
  assert.deepEqual(iceMeltSquares({ bounds: region, within: { x: 100, y: 100, w: 1000, h: 1000 }, grid: GRID, inArea: () => true }), ["1,1"]);
  assert.deepEqual(iceMeltSquares({ bounds: region, within: { x: 400, y: 400, w: 100, h: 100 }, grid: GRID, inArea: () => true }), [], "a fire nowhere near it melts nothing");
  assert.deepEqual(iceMeltSquares({ bounds: region, within: null, grid: GRID, inArea: () => true }).length, 4, "no box known: the region itself");
  for (const junk of [{ x: 0, y: 0, w: 0, h: 0 }, { x: NaN, y: 0, w: 10, h: 10 }, "box", 7]) {
    assert.equal(iceMeltSquares({ bounds: region, within: junk, grid: GRID, inArea: () => true }).length, 4, `${JSON.stringify(junk)} is no box, so the region itself`);
  }
});



test("walking across thin ice cracks square after square and never gives way on fresh ice", () => {
  const walk = (squares, cracked = []) => iceStep({ limit: "med", size: "lg", squares, cracked, name: "Bron" });
  const one = walk(["1,1"]);
  assert.deepEqual(one.cracks, ["1,1"], "one square stepped onto cracks");
  assert.deepEqual(one.breaks, [], "and does NOT give way: a single step onto sound ice is not a hole");
  const four = walk(["1,1", "1,2", "1,3", "1,4"]);
  assert.deepEqual(four.cracks, ["1,1", "1,2", "1,3", "1,4"], "a whole walk cracks its way across");
  assert.deepEqual(four.breaks, [], "and goes through nowhere: none of it was cracked before");
});

test("ice already cracked is what gives way, whether this walk cracked it or an earlier one did", () => {
  const back = iceStep({ limit: "med", size: "lg", squares: ["1,1", "1,2", "1,1"], cracked: [], name: "Bron" });
  assert.deepEqual(back.breaks, ["1,1"], "stepping back onto its own crack");
  assert.deepEqual(back.cracks, ["1,2"], "and the square it only crossed once is left cracked");
  const again = iceStep({ limit: "med", size: "lg", squares: ["1,1"], cracked: ["1,1"], name: "Bron" });
  assert.deepEqual(again.breaks, ["1,1"], "or a crack an earlier move left there");
  const elsewhere = iceStep({ limit: "med", size: "lg", squares: ["2,2"], cracked: ["1,1"], name: "Dain" });
  assert.deepEqual(elsewhere.breaks, [], "a crack somewhere else is nothing to do with it");
});


test("the whole walk in one firing behaves the same as the walk one square at a time", () => {
  const atOnce = iceStep({ limit: "med", size: "lg", squares: ["1,1", "1,2", "1,3"], cracked: [] });
  assert.deepEqual(atOnce.cracks, ["1,1", "1,2", "1,3"]);
  assert.deepEqual(atOnce.breaks, []);
  let cracked = [];
  for (const square of ["1,1", "1,2", "1,3"]) {
    const step = iceStep({ limit: "med", size: "lg", squares: [square], cracked });
    cracked = [...cracked, ...step.cracks];
    assert.deepEqual(step.breaks, [], "no firing of it breaks anything");
  }
  assert.deepEqual(cracked, ["1,1", "1,2", "1,3"], "the same cracks, however the move arrived");
});

