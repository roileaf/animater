import test from "node:test";
import assert from "node:assert/strict";
import { wreckLayout, wreckTargets, LIQUIDS, SPILL_FAN, POTION_COLOURS, PAGE_COLOURS, SPINE_COLOURS, POWDER_TONES, collapseDust, spillExtent, patchTongues } from "../../../scripts/engines/props/prop-wreck-layout.mjs";
import { tileToWorld, localStop } from "../../../scripts/engines/props/prop-wreck.mjs";
import { propGuesses } from "../../../scripts/engines/props/prop-traits.mjs";
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

// Burning lamp oil (Task 10)
test("lanterns and lamps hold lamp oil; it spills like oil and a fire leaves a scorch", () => {
  assert.equal(propGuesses("Lantern_A.webp").contents, "lampoil");
  const s = wreckLayout({ ...note, fire: true, mark: "scorch" }, { ...at, contents: "lampoil" });
  assert.equal(s.spill.color, 0x4a3410);
  assert.equal(s.spill.alpha, LIQUIDS.oil.alpha);
  assert.equal(s.mark.kind, "scorch");
  // a fire note scorches whatever its mark said; without fire the mark stands
  assert.equal(wreckLayout({ ...note, fire: true, mark: "dust" }, { ...at, contents: "lampoil" }).mark.kind, "scorch");
  assert.equal(wreckLayout({ ...note, mark: "dust" }, { ...at, contents: "lampoil" }).mark.kind, "dust");
});
test("a fire note lays out flames over the spill; the rest of the wreck is unchanged by it", () => {
  const lit = { ...note, mark: "dust", fire: true }, plain = { ...note, mark: "dust" };
  const a = wreckLayout(lit, { ...at, contents: "lampoil" }), b = wreckLayout(plain, { ...at, contents: "lampoil" });
  assert.equal(b.fire, null);
  assert.deepEqual(a.spill, b.spill);
  assert.deepEqual(a.specks, b.specks);
  assert.deepEqual(a, wreckLayout(lit, { ...at, contents: "lampoil" }), "seeded");
  const { flames, embers, at: c } = a.fire;
  // a bed of torch-flame tongues over the patch (patchTongues)
  assert.deepEqual(flames, patchTongues({ at: c, r: a.fire.r, cutAngle: note.cutAngle, seed: note.seed, grid: 100 }));
  assert.ok(flames.length >= 5 && flames.length <= 9);
  for (const f of flames) {
    assert.ok(f.scale >= 0.7 && f.scale <= 1.9);
    assert.ok(Math.hypot(f.x - c.x, f.y - c.y) <= 60, "on the spill");
    assert.ok(f.start >= 0 && f.start <= 600);
  }
  // the patch burns where the oil ran: ahead of the hit, not behind the prop
  assert.ok((c.x - 500) * Math.cos(note.cutAngle) + (c.y - 300) * Math.sin(note.cutAngle) > 0);
  assert.ok(embers.length >= 200 && embers.every((e) => e.at + e.life <= 60000));
  // its scorch lies under the patch
  const pts = a.mark.blobs[0].steps[0].polys.flat(), xs = pts.filter((_, i) => i % 2 === 0), ys = pts.filter((_, i) => i % 2 === 1);
  const mean = (l) => l.reduce((s, v) => s + v, 0) / l.length;
  assert.ok(Math.hypot(mean(xs) - c.x, mean(ys) - c.y) < 20);
  // a fire note on a prop with no oil still scorches, with no flames
  assert.equal(wreckLayout(lit, { ...at, contents: "none" }).fire, null);
});

test("the burning patch's tongues: seeded, inside the patch, tallest at the middle, more for a bigger patch", () => {
  const at = { x: 400, y: 260 }, base = { at, r: 50, cutAngle: 0.4, seed: 77, grid: 100 };
  const t = patchTongues(base);
  assert.deepEqual(t, patchTongues(base), "the same seed lays the same bed");
  assert.notDeepEqual(t, patchTongues({ ...base, seed: 78 }));
  assert.ok(t.length >= 5 && t.length <= 9);
  const ca = Math.cos(0.4), sa = Math.sin(0.4);
  for (const f of t) {
    const dx = f.x - at.x, dy = f.y - at.y, u = dx * ca + dy * sa, v = -dx * sa + dy * ca;
    assert.ok((u / (0.75 * 50)) ** 2 + (v / (0.45 * 50)) ** 2 <= 1 + 1e-9, "inside the patch, stretched along the spill");
    assert.ok(f.scale >= 0.7 && f.scale <= 1.9);
    assert.ok(f.start >= 0 && f.start <= 600);
  }
  const tallest = t.reduce((a, b) => (b.scale > a.scale ? b : a));
  assert.ok(Math.hypot(tallest.x - at.x, tallest.y - at.y) <= 0.15 * 50, "the tallest stands at the middle");
  for (const f of t) if (f !== tallest) assert.ok(f.scale < tallest.scale);
  // the ones further out are lower: the bed falls off toward its edge
  const out = t.filter((f) => Math.hypot(f.x - at.x, f.y - at.y) > 25), mid = t.filter((f) => Math.hypot(f.x - at.x, f.y - at.y) < 12);
  if (out.length && mid.length) assert.ok(Math.max(...out.map((f) => f.scale)) < Math.min(...mid.map((f) => f.scale)));
  // drawn back to front: up the screen first
  for (let i = 1; i < t.length; i++) assert.ok(t[i].y >= t[i - 1].y);
  // a small patch burns with fewer tongues than a big one
  assert.ok(patchTongues({ ...base, r: 25 }).length < patchTongues({ ...base, r: 150 }).length);
  assert.equal(patchTongues({ ...base, r: 25 }).length, 5);
  assert.equal(patchTongues({ ...base, r: 150 }).length, 9);
});

// Powder kegs (Task 13)
test("an exploded keg leaves a big scorch and thrown staves and hoops; a spilled one dark grain", () => {
  const boom = wreckLayout({ ...note, powder: "exploded", burst: 2, mark: "scorch" }, { ...at, contents: "powder" });
  assert.equal(boom.spill, null);
  const r = Math.max(...boom.mark.blobs[0].steps[0].polys.flat().filter((_, i) => i % 2 === 0).map((x) => Math.abs(x - 500)));
  assert.ok(r >= 0.6 * 2 * 100);
  assert.ok(boom.blast.staves.length >= 8 && boom.blast.staves.length <= 14 && boom.blast.hoops.length >= 2);
  const spilled = wreckLayout({ ...note, powder: "spilled" }, { ...at, contents: "powder" });
  assert.equal(spilled.spill.kind, "powder");
  assert.ok(spilled.spill.marks.every((m) => Number.isInteger(m.tone) && m.tone >= 0 && m.tone < POWDER_TONES.length));
});
test("every exploded keg: a scorch at least 0.6 of its burst, 8-14 staves thrown outward, 2-4 hoops, fire turning to smoke", () => {
  assert.deepEqual(POWDER_TONES, [0x1e1c1a, 0x2a2724, 0x3a3631, 0x141312]);
  for (let seed = 1; seed <= 60; seed++) for (const burst of [1, 2, 4]) {
    const n = { ...note, seed, powder: "exploded", burst, mark: "dust" }, L = wreckLayout(n, { ...at, contents: "powder" });
    assert.deepEqual(L, wreckLayout(n, { ...at, contents: "powder" }), "seeded");
    assert.equal(L.mark.kind, "scorch", "an explosion scorches whatever the mark said");
    const pts = L.mark.blobs[0].steps[0].polys.flat(), xs = pts.filter((_, i) => i % 2 === 0), ys = pts.filter((_, i) => i % 2 === 1);
    const reach = Math.max(...xs.map((x) => Math.abs(x - 500)), ...ys.map((y) => Math.abs(y - 300)));
    assert.ok(reach >= 0.6 * burst * 100, `seed ${seed} burst ${burst}: scorch reaches ${reach}`);
    assert.ok(reach <= 1.6 * burst * 100, "and stays about the burst's size");
    const { staves, hoops, puffs, slivers, grains } = L.blast;
    assert.ok(staves.length >= 8 && staves.length <= 14 && staves.length % 2 === 0, "each stave split in two along its length");
    for (const s of staves) {
      assert.ok(s.poly.length >= 6 && s.poly.every(Number.isFinite));
      assert.ok(s.poly.every((v, i) => v >= -1 && v <= 101), "cut from the keg's own picture (tile-local px)");
      const out = Math.hypot(s.to.x - 50, s.to.y - 50) - Math.hypot(s.home.x - 50, s.home.y - 50);
      assert.ok(out > 20, `seed ${seed}: a stave thrown outward (${out})`);
      assert.ok(s.dur >= 650 && s.dur <= 900 && Number.isFinite(s.to.rot));
    }
    assert.ok(hoops.length >= 2 && hoops.length <= 4);
    for (const h of hoops) { assert.ok(h.r > 0 && h.l > 0.5 && h.l < 3, "a bent arc, never a whole ring"); assert.ok(Math.hypot(h.x - 500, h.y - 300) > 30); assert.deepEqual([h.x0, h.y0], [500, 300]); }
    const fire = puffs.filter((p) => p.kind === "fire"), smoke = puffs.filter((p) => p.kind === "smoke");
    assert.equal(fire.length + smoke.length, puffs.length);
    assert.ok(fire.length >= 5 && smoke.length >= 6);
    assert.ok(Math.max(...fire.map((p) => p.at)) < Math.min(...smoke.map((p) => p.at)), "the fireball comes first, the smoke after");
    assert.ok(smoke.every((p) => p.vy < 0 && p.r1 > p.r0 && p.life >= 1500), "smoke grows and rolls away up the screen");
    assert.ok(slivers.length > 0 && slivers.every((s) => [0, 1, 2].includes(s.tone)));
    assert.ok(grains.every((g) => g.tone === 0 || g.tone === 1));
  }
});
test("a spilled keg: dark powder grains along the hit, the keg itself still breaks; an exploded one spills none", () => {
  const plain = wreckLayout({ ...note, powder: "spilled" }, { ...at, contents: "powder" });
  assert.equal(plain.blast, null);
  assert.equal(plain.specks.length, 18);
  assert.ok(plain.spill.marks.length >= 300);
  assert.ok(plain.spill.marks.every((m) => m.l > 0 && m.l <= 2.5 && m.w > 0 && m.w <= 1.5), "fine grains");
  const mean = Math.atan2(...plain.spill.marks.reduce(([sy, sx], k) => [sy + k.y - 300, sx + k.x - 500], [0, 0]));
  assert.ok(Math.abs(mean - note.cutAngle) < 0.6);
  // A keg's note from before it was set (no powder) spills like a spilled one.
  assert.equal(wreckLayout(note, { ...at, contents: "powder" }).spill.kind, "powder");
  // Grain stays grain.
  assert.equal(wreckLayout(note, { ...at, contents: "grain" }).spill.kind, "grain");
  assert.equal(wreckLayout({ ...note, powder: "exploded", burst: 2 }, { ...at, contents: "powder" }).specks.length, 0, "its splinters are the blast's slivers");
});
test("an explosion's burst defaults to the keg default when its note has none", () => {
  const a = wreckLayout({ ...note, powder: "exploded" }, { ...at, contents: "powder" }), b = wreckLayout({ ...note, powder: "exploded", burst: 2 }, { ...at, contents: "powder" });
  assert.deepEqual(a, b);
  assert.notDeepEqual(wreckLayout({ ...note, powder: "exploded", burst: 3 }, { ...at, contents: "powder" }).mark, b.mark);
});

// Task 21 (D2): every thrown or spilled position stops short of a wall between the prop and where it lands.
import { wallStop } from "../../../scripts/engines/props/prop-walls.mjs";
test("a wall beside the prop stops every spill, book, page, shard, speck, flame and blast bit on the prop's side", () => {
  // the prop's centre is 500,300; a wall 40 px away on the side the hit throws things (cutAngle 0.4 → down-right)
  const wall = { id: "w", c: [540, 0, 540, 1000], move: 20, sight: 20, door: 0, ds: 0 };
  const stop = wallStop(at.centre, [wall], 4);
  const left = (p, what) => assert.ok(p.x < 540, `${what} at ${p.x}`); // short of it along the throw
  for (const seed of [1, 2, 3, 9]) {
    const n = { ...note, seed };
    for (const contents of ["wine", "grain", "goods", "powder", "books", "potions", "lampoil"]) {
      const free = wreckLayout(n, { ...at, contents });
      const L = wreckLayout(n, { ...at, contents, stop });
      for (const s of L.specks) { left(s, `${contents} speck`); for (let i = 0; i < s.pts.length; i += 2) assert.ok(s.pts[i] <= 540 - 4 + 20, "speck outline"); }
      const sp = L.spill;
      if (sp?.marks) for (const m of sp.marks) left(m, `${contents} mark`);
      if (sp?.kind === "books") for (const b of [...sp.closed, ...sp.small, ...sp.pages]) left(b, "book");
      if (sp?.kind === "potions") for (const b of [...sp.shards, ...sp.stains]) left(b, "potion");
      // without a stop the same wreck goes past the wall (so the test means something)
      const past = (free.spill?.marks ?? [...(free.spill?.closed ?? []), ...(free.spill?.pages ?? []), ...(free.spill?.shards ?? [])]).some((m) => m.x > 540);
      if (contents !== "lampoil") assert.ok(past || free.specks.some((s) => s.x > 540), `${contents} seed ${seed}: nothing would cross`);
    }
    const fire = wreckLayout({ ...n, fire: true }, { ...at, contents: "lampoil", stop }).fire;
    left(fire.at, "fire centre");
    for (const f of fire.flames) left(f, "flame");
    const keg = wreckLayout({ ...n, powder: "exploded", burst: 2 }, { ...at, contents: "powder", stop }).blast;
    for (const b of [...keg.hoops, ...keg.slivers, ...keg.grains]) left(b, "blast bit");
  }
  // no stop: unchanged from before
  assert.deepEqual(wreckLayout(note, { ...at, contents: "books" }), wreckLayout(note, { ...at, contents: "books", stop: (p) => p }));
});
test("the burning patch's centre follows the stopped spill (its glow goes where it burns)", () => {
  const wall = { id: "w", c: [0, 330, 1000, 330], move: 20, sight: 20, door: 0, ds: 0 };
  const n = { ...note, seed: 4, cutAngle: Math.PI / 2, fire: true };
  const free = wreckLayout(n, { ...at, contents: "lampoil" }).fire, held = wreckLayout(n, { ...at, contents: "lampoil", stop: wallStop(at.centre, [wall], 4) }).fire;
  assert.ok(free.at.y > 330, `free patch at ${free.at.y}`);
  assert.ok(held.at.y < 330, `held patch at ${held.at.y}`);
});

test("localStop: a tile-local point (a stave, a coal) stops at the wall in world px, turned with the tile", () => {
  const wall = { id: "w", c: [540, 0, 540, 1000], move: 20, sight: 20, door: 0, ds: 0 };
  const centre = { x: 500, y: 300 }, stop = wallStop(centre, [wall], 4);
  for (const rotation of [0, 30, 90, 200]) {
    const d = { x: 500, y: 300, width: 100, height: 100, rotation, texture: { anchorX: 0.5, anchorY: 0.5 } };
    const held = localStop(d, centre, stop);
    for (const p of [{ x: 150, y: 50, rot: 2 }, { x: 50, y: 160 }, { x: -60, y: 50 }, { x: 50, y: -60 }]) {
      const q = held(p), w = tileToWorld(d, centre, q), want = stop(tileToWorld(d, centre, p));
      assert.ok(Math.abs(w.x - want.x) < 1e-6 && Math.abs(w.y - want.y) < 1e-6, `rot ${rotation}`);
      assert.ok(w.x < 540);
      if (p.rot !== undefined) assert.equal(q.rot, p.rot);
    }
    const inside = { x: 60, y: 50 };
    assert.equal(held(inside), inside);
  }
});
import { firePatchAt } from "../../../scripts/engines/props/prop-wreck-layout.mjs";
test("firePatchAt: the fire light goes on the burning patch (stopped by the walls), the tile's centre without one", () => {
  const n = { ...note, seed: 4, cutAngle: Math.PI / 2, fire: true };
  assert.deepEqual(firePatchAt(n, { ...at, contents: "lampoil" }), wreckLayout(n, { ...at, contents: "lampoil" }).fire.at);
  assert.notDeepEqual(firePatchAt(n, { ...at, contents: "lampoil" }), at.centre);
  const wall = { id: "w", c: [0, 330, 1000, 330], move: 20, sight: 20, door: 0, ds: 0 }, stop = wallStop(at.centre, [wall], 4);
  assert.deepEqual(firePatchAt(n, { ...at, contents: "lampoil", stop }), wreckLayout(n, { ...at, contents: "lampoil", stop }).fire.at);
  assert.ok(firePatchAt(n, { ...at, contents: "lampoil", stop }).y < 330);
  // a note without fire is asked as if burning (the GM lights it as it writes the note)
  assert.deepEqual(firePatchAt({ ...n, fire: undefined }, { ...at, contents: "lampoil" }), firePatchAt(n, { ...at, contents: "lampoil" }));
  assert.deepEqual(firePatchAt(n, { ...at, contents: "none" }), { x: 500, y: 300 });
});

import { readFileSync } from "node:fs";
import { tonesOfPixels } from "../../../scripts/engines/props/prop-wreck-layout.mjs";
test("tones from pixels: the mean of the opaque ones and the painted box", () => {
  const w = 4, h = 4, data = new Uint8ClampedArray(w * h * 4);
  // (the mean reads every 4th pixel, as sample does: here column 0 of each row)
  for (let p = 0; p < w * h; p++) if (p % w <= 1) data.set([100, 50, 20, 255], p * 4);
  const t = tonesOfPixels(data, w, h);
  assert.equal(t.mid, (100 << 16) | (50 << 8) | 20);
  assert.deepEqual(t.box, [0, 0, 0.5, 1]);
  assert.equal(tonesOfPixels(new Uint8ClampedArray(64), 4, 4), null);
  const wreck = readFileSync(new URL("../../../scripts/engines/props/prop-wreck.mjs", import.meta.url), "utf8");
  assert.match(wreck, /tile\.art/); assert.match(wreck, /tonesOfPixels\(/);
});
