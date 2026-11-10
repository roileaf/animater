import test from "node:test";
import assert from "node:assert/strict";
import { wreckLayout, wreckTargets, SPILL_FAN, POTION_COLOURS, PAGE_COLOURS, SPINE_COLOURS, collapseDust, spillExtent } from "../../../scripts/engines/props/prop-wreck-layout.mjs";
import { tileToWorld } from "../../../scripts/engines/props/prop-wreck.mjs";
import { tileRect } from "../../../scripts/engines/props/prop-geometry.mjs";

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
test("books slide off along the hit; potions smash into 3-4 colours with stains", () => {
  const books = wreckLayout(note, { ...at, contents: "books" }).spill;
  assert.equal(books.kind, "books");
  assert.deepEqual([books.closed.length, books.small.length, books.pages.length], [4, 9, 22]);
  const mean = Math.atan2(...books.pages.reduce(([sy, sx], p) => [sy + p.y - 300, sx + p.x - 500], [0, 0]));
  assert.ok(Math.abs(mean - note.cutAngle) < 0.7);
  const potions = wreckLayout(note, { ...at, contents: "potions" }).spill;
  const colours = new Set(potions.shards.map((s) => s.colour));
  assert.ok(colours.size >= 3 && colours.size <= 4 && potions.stains.length >= 3);
});
test("books and pages: tile tones, page colours, sizes; every seed and hit sends them the hit's way", () => {
  for (let seed = 1; seed <= 25; seed++) for (const cutAngle of [0.4, 2.5, -2]) {
    const n = { ...note, seed, cutAngle }, { closed, small, pages } = wreckLayout(n, { ...at, contents: "books" }).spill;
    for (const b of [...closed, ...small]) { assert.ok(Number.isInteger(b.tone) && b.tone >= 0 && b.tone < SPINE_COLOURS.length); assert.ok(b.w > 0 && b.h > 0 && Number.isFinite(b.rot)); }
    for (const b of closed) assert.ok(b.w >= 25 && b.h <= 50, "closed books are a third to half a square");
    for (const b of small) assert.ok(b.w >= 18 && b.w <= 26 && b.h >= 13 && b.h <= 18);
    for (const p of pages) { assert.ok(PAGE_COLOURS.includes(p.c)); assert.equal(typeof p.curl, "boolean"); assert.ok(p.w >= 9 && p.w <= 16 && p.h >= 11 && p.h <= 17); }
    const ahead = [...closed, ...small, ...pages].filter((b) => (b.x - 500) * Math.cos(cutAngle) + (b.y - 300) * Math.sin(cutAngle) > 0).length;
    assert.ok(ahead >= 0.8 * 35, `seed ${seed} cut ${cutAngle}: only ${ahead} of 35 ahead of the hit`);
  }
  assert.deepEqual(PAGE_COLOURS, [0xeee3c8, 0xe2d4b0, 0xd8c69e]);
});
test("potions: colours from the potion list, shards and stains on the hit's side, sizes scale with the grid", () => {
  assert.deepEqual(POTION_COLOURS, [0x3a8a3a, 0x9a1a1a, 0x2a4ab0, 0xb08a3a]);
  for (let seed = 1; seed <= 25; seed++) {
    const { kind, shards, stains } = wreckLayout({ ...note, seed }, { ...at, contents: "potions" }).spill;
    assert.equal(kind, "potions");
    const cols = new Set([...shards, ...stains].map((s) => s.colour));
    assert.ok(cols.size >= 3 && cols.size <= 4 && [...cols].every((c) => POTION_COLOURS.includes(c)), `seed ${seed}`);
    assert.ok(shards.every((s) => s.size >= 3 && s.size <= 7 && Number.isFinite(s.rot)));
    assert.ok(stains.every((s) => s.r > 0 && s.r <= 34));
    assert.ok(stains.filter((s, i) => i % 2 === 0).every((s) => s.r >= 23), "each bottle leaves a pool as big as the mock's");
  }
  const big = wreckLayout(note, { ...at, grid: 200, width: 200, height: 200, contents: "potions" }).spill;
  assert.ok(big.shards.every((s) => s.size >= 6 && s.size <= 14));
});
test("the collapse dust: a dust mark squashed and turned to the prop", () => {
  const m = collapseDust({ x: 100, y: 50, r: 40, squash: 0.5, angle: Math.PI / 2 }, 7);
  assert.equal(m.kind, "dust");
  assert.deepEqual(m, collapseDust({ x: 100, y: 50, r: 40, squash: 0.5, angle: Math.PI / 2 }, 7));
  const pts = m.blobs[0].steps[0].polys.flat(), xs = pts.filter((_, i) => i % 2 === 0), ys = pts.filter((_, i) => i % 2 === 1);
  assert.ok(Math.max(...ys) - Math.min(...ys) > 1.4 * (Math.max(...xs) - Math.min(...xs)), "turned a quarter: taller than wide");
});
test("books take the shelf's coloured spines: the small ones run through the whole palette", () => {
  assert.deepEqual(SPINE_COLOURS, [0x2c4f7a, 0x7a2a2a, 0x2e5a3a, 0x6a4a8a, 0x8a6a2a, 0x3a3a4a]);
  const { small } = wreckLayout(note, { ...at, contents: "books" }).spill;
  assert.deepEqual(small.map((b) => b.tone), [0, 1, 2, 3, 4, 5, 0, 1, 2]);
});
test("a turned shelf: spilled books and bottles start across the turned tile", () => {
  const tall = { ...at, width: 100, height: 200 }, wide = { ...at, width: 200, height: 100 };
  const near = (p, q) => (typeof p === "number" ? Math.abs(p - q) < 1e-6 : p && typeof p === "object" ? Object.keys(p).length === Object.keys(q ?? {}).length && Object.keys(p).every((k) => near(p[k], q[k])) : p === q);
  for (const contents of ["books", "potions"]) for (const cutAngle of [0, 0.4, 2.5]) {
    const n = { ...note, cutAngle };
    assert.ok(near(wreckLayout(n, { ...tall, contents, rotation: 90 }), wreckLayout(n, { ...wide, contents })), `${contents} cut ${cutAngle}`);
    assert.notDeepEqual(wreckLayout(n, { ...tall, contents, rotation: 90 }), wreckLayout(n, { ...tall, contents }));
  }
  assert.ok(Math.abs(spillExtent(100, 200, 0) - 200) < 1e-9 && Math.abs(spillExtent(100, 200, 0, 90) - 100) < 1e-9);
  assert.ok(Math.abs(spillExtent(100, 200, 0.3, 30) - spillExtent(100, 200, 0)) > 1);
  // Bottles stand along the turned shelf: their stains' spread across the hit follows the turned extent.
  const spread = (L) => { const v = L.spill.shards.map((s) => -(s.x - 500) * Math.sin(0) + (s.y - 300) * Math.cos(0)); return Math.max(...v) - Math.min(...v); };
  assert.ok(spread(wreckLayout({ ...note, cutAngle: 0 }, { ...tall, contents: "potions" })) > spread(wreckLayout({ ...note, cutAngle: 0 }, { ...tall, contents: "potions", rotation: 90 })));
});
test("a tile-local point lands where the tile is drawn: turned about its anchor, matching the tile's centre", () => {
  for (const [ax, ay, rot] of [[0.5, 0.5, 0], [0, 0, 0], [0, 0, 30], [0.2, 0.9, -75], [1, 0.5, 180]]) {
    const d = { x: 400, y: 250, width: 120, height: 180, rotation: rot, texture: { anchorX: ax, anchorY: ay } }, r = tileRect(d);
    const c = tileToWorld(d, { x: 0, y: 0 }, { x: 60, y: 90 });
    assert.ok(Math.abs(c.x - (r.x + 60)) < 1e-9 && Math.abs(c.y - (r.y + 90)) < 1e-9, `anchor ${ax},${ay} rot ${rot}`);
    const a = tileToWorld(d, { x: 0, y: 0 }, { x: ax * 120, y: ay * 180 });
    assert.ok(Math.abs(a.x - 400) < 1e-9 && Math.abs(a.y - 250) < 1e-9, "the anchor point stays at the tile's x/y");
  }
});
