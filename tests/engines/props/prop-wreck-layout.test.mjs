import test from "node:test";
import assert from "node:assert/strict";
import { wreckLayout, wreckTargets, SPILL_FAN } from "../../../scripts/engines/props/prop-wreck-layout.mjs";

const note = { seed: 9, cutAngle: 0.4, pattern: "shards", pieces: 10, spread: 0.32, spin: 120, tint: "scorched", mark: "scorch", from: { x: 0, y: 0 }, walls: [] };
const at = { centre: { x: 500, y: 300 }, width: 100, height: 100, grid: 100 };
test("the same note always lays out the same wreck", () => {
  assert.deepEqual(wreckLayout(note, { ...at, contents: "wine" }), wreckLayout(note, { ...at, contents: "wine" }));
  assert.notDeepEqual(wreckLayout({ ...note, seed: 10 }, at), wreckLayout(note, at));
});
test("contents: nothing has no spill; liquids are floor-blood marks; grain clumps along the hit", () => {
  assert.equal(wreckLayout(note, { ...at, contents: "none" }).spill, null);
  const wine = wreckLayout(note, { ...at, contents: "wine" }).spill;
  assert.equal(wine.kind, "wine");
  assert.ok(wine.marks.some((m) => m.art === "pool") && !wine.marks.some((m) => m.art === "slash" || m.art === "blunt"));
  const grain = wreckLayout(note, { ...at, contents: "grain" }).spill;
  const meanAngle = Math.atan2(...grain.marks.reduce(([sy, sx], k) => [sy + k.y - 300, sx + k.x - 500], [0, 0]));
  assert.ok(Math.abs(meanAngle - 0.4) < 0.6);
});
test("a liquid runs out the way the hit pushed it: patches and drops lie in a fan about the cut, the far side of the mark stays bare", () => {
  for (let seed = 1; seed <= 40; seed++) for (const cutAngle of [0, 0.4, 2.5, -2]) {
    const n = { ...note, seed, cutAngle }, wine = wreckLayout(n, { ...at, contents: "wine" }).spill;
    const from = { x: 500 + Math.cos(cutAngle) * 12.5, y: 300 + Math.sin(cutAngle) * 12.5 };
    for (const m of wine.marks.filter((k) => k.art !== "pool")) {
      const off = Math.atan2(m.y - from.y, m.x - from.x) - cutAngle, turn = Math.atan2(Math.sin(off), Math.cos(off));
      assert.ok(Math.abs(turn) <= SPILL_FAN + 1e-9, `seed ${seed} cut ${cutAngle}: ${m.art} off the fan by ${turn}`);
    }
  }
});
test("liquid colours, goods bits and the ground mark kinds", () => {
  const w = (contents, n = note) => wreckLayout(n, { ...at, contents });
  assert.deepEqual([w("water").spill.color, w("water").spill.alpha], [0x33505c, 0.7]);
  assert.deepEqual([w("wine").spill.color, w("wine").spill.alpha], [0x4a0c1a, 0.92]);
  assert.deepEqual([w("oil").spill.color, w("oil").spill.alpha], [0x4a3410, 0.85]);
  const goods = w("goods").spill;
  assert.equal(goods.marks.length, 60);
  assert.ok(goods.marks.every((b) => b.l * 2 >= 4 && b.l * 2 <= 9));
  assert.equal(w("grain").spill.marks.length, Math.round(700 * Math.sqrt(0.5)));
  for (const mark of ["scorch", "dust", "frost", "stain", "burn"]) assert.equal(w("none", { ...note, mark }).mark.kind, mark);
  assert.ok(w("none", { ...note, mark: "frost" }).mark.ticks.length === 14);
});
test("only hidden tiles with a valid note get a wreck", () => {
  const t = (id, hidden, broken) => ({ id, hidden, flags: { animater: { prop: broken ? { broken } : {} } } });
  assert.deepEqual(wreckTargets([t("a", true, note), t("b", false, note), t("c", true, null), t("d", true, { seed: "x" })]).map((w) => w.id), ["a"]);
});
test("18 specks, within about 1.3 radii of the centre", () => {
  const { specks } = wreckLayout(note, at);
  assert.equal(specks.length, 18);
  assert.ok(specks.every((s) => Math.hypot(s.x - 500, s.y - 300) <= 1.31 * 50));
});
