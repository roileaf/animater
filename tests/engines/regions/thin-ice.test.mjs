import test from "node:test";
import assert from "node:assert/strict";
import { SIZES, holdsUp, iceStep, iceStateOf, iceUpdatesFor } from "../../../scripts/engines/regions/thin-ice.mjs";

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
  assert.deepEqual(iceStateOf(doc), { cracks: ["3,4", "3,5"], holes: ["7,2"] });
});

test("iceStateOf is empty for a missing flag, an empty object, null, a string and a number", () => {
  const empty = { cracks: [], holes: [] };
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
  assert.deepEqual(iceStateOf(regionWith({ cracks: "3,4", holes: ["1,1"] })), { cracks: [], holes: [] });
  const doc = regionWith({ cracks: { "3,4": 1, "5,5": NaN, "6,6": null, "7,7": 0, nope: 1, "": 1 }, holes: { "1,1": 1, "x,2": 1 } });
  assert.deepEqual(iceStateOf(doc), { cracks: ["3,4"], holes: ["1,1"] });
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
