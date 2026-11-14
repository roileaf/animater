import test from "node:test";
import assert from "node:assert/strict";
import { SIZES, holdsUp, iceStep } from "../../../scripts/engines/regions/thin-ice.mjs";

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
