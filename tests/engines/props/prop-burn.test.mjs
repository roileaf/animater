import test from "node:test";
import assert from "node:assert/strict";
import { burnLayout, splitLayout, burnAt, BURN_AWAY_MS } from "../../../scripts/engines/props/prop-burn.mjs";
import { flatMark } from "../../../scripts/engines/props/prop-wreck-layout.mjs";
import { wreckLayout } from "../../../scripts/engines/props/prop-wreck-layout.mjs";
import { propsInArea, propNextToMiss } from "../../../scripts/engines/props/prop-pick.mjs";
import { validBreakRequest, breakNoteFor } from "../../../scripts/engines/props/prop-requests.mjs";

// Own fixtures (R8).
const note = { seed: 41, cutAngle: 0, pattern: "shards", pieces: 10, spread: 0.32, spin: 120, tint: "none", mark: "dust", from: { x: 0, y: 100 }, walls: [], style: "shatter", lights: [] };

test("burn front runs along the hit over 1.5 s, embers, an ash mark", () => {
  const L = burnLayout({ ...note, style: "burn", mark: "ash", cutAngle: 0 }, { width: 200, height: 200, grid: 100 });
  assert.equal(L.ms, 1500);
  assert.ok(Math.abs(L.dir.x - 1) < 1e-9 && L.embers.length >= 20 && L.embers.length <= 40);
});
test("burn layout: unit dir along the hit (in the tile's turned frame), embers caught by the front in order, ash at the middle", () => {
  assert.equal(BURN_AWAY_MS, 1500);
  const L = burnLayout({ ...note, cutAngle: Math.PI / 2 }, { width: 200, height: 200, grid: 100 });
  assert.ok(Math.abs(L.dir.x) < 1e-9 && Math.abs(L.dir.y - 1) < 1e-9);
  assert.ok(Math.abs(Math.hypot(L.dir.x, L.dir.y) - 1) < 1e-12);
  // a tile turned 90° sees a hit going down the page as going along its own x
  const turned = burnLayout({ ...note, cutAngle: Math.PI / 2 }, { width: 200, height: 200, grid: 100, rotation: 90 });
  assert.ok(Math.abs(turned.dir.x - 1) < 1e-9 && Math.abs(turned.dir.y) < 1e-9);
  assert.deepEqual([L.ash.x, L.ash.y], [100, 100]);
  assert.ok(L.ash.r > 70 && L.ash.r < 100, `ash r ${L.ash.r}`);
  for (const e of L.embers) {
    assert.ok(e.x >= 0 && e.x <= 200 && e.y >= 0 && e.y <= 200, "inside the tile");
    assert.ok(e.t0 >= 0 && e.t0 <= L.ms, "caught while the front runs");
    assert.ok(e.life >= 700 && e.life <= 1200);
    assert.ok(e.vy < 0, "drift up");
    // caught when the front reaches it: its burn time over the front's run
    assert.ok(Math.abs(e.t0 - ((burnAt(L, e.x / 200, e.y / 200) + 0.05) / 1.5) * L.ms) < 1e-6);
  }
  // the hit side catches first: embers on the near half start earlier on average than the far half
  const mean = (list) => list.reduce((s, e) => s + e.t0, 0) / list.length;
  const near = L.embers.filter((e) => e.y < 100), far = L.embers.filter((e) => e.y >= 100);
  assert.ok(near.length && far.length && mean(near) < mean(far));
  // seeded: the same note lays the same burn
  assert.deepEqual(burnLayout({ ...note, cutAngle: 1 }, { width: 200, height: 200, grid: 100 }), burnLayout({ ...note, cutAngle: 1 }, { width: 200, height: 200, grid: 100 }));
  // more embers for a bigger plant, never past 40
  assert.equal(burnLayout(note, { width: 600, height: 600, grid: 100 }).embers.length, 40);
  assert.equal(burnLayout(note, { width: 50, height: 50, grid: 100 }).embers.length, 20);
});
test("burn time: the hit side first, the far side last, within 0-1.1 everywhere", () => {
  const L = burnLayout(note, { width: 200, height: 200, grid: 100 });
  for (let v = 0; v <= 1; v += 0.25) {
    assert.ok(burnAt(L, 0, v) < burnAt(L, 1, v), `row ${v}`);
    for (let u = 0; u <= 1; u += 0.25) { const b = burnAt(L, u, v); assert.ok(b >= 0 && b <= 1.1, `${u},${v}: ${b}`); }
  }
  assert.equal(L.noise.length, 81);
});

test("a cut web's halves sag apart", () => {
  const { halves } = splitLayout({ ...note, style: "split", cutAngle: 0 }, { width: 200, height: 200 });
  assert.equal(halves.length, 2);
  assert.ok(Math.sign(halves[0].to.y) !== Math.sign(halves[1].to.y)); // apart across a horizontal cut
});
test("split layout: the halves cover the tile on either side of a jagged cut, move away from it, droop, turn a little", () => {
  const S = splitLayout({ ...note, style: "split", cutAngle: 0 }, { width: 200, height: 200 });
  const area = (p) => { let a = 0; for (let i = 0; i < p.length; i += 2) { const j = (i + 2) % p.length; a += p[i] * p[j + 1] - p[j] * p[i + 1]; } return Math.abs(a) / 2; };
  const total = area(S.halves[0].poly) + area(S.halves[1].poly);
  assert.ok(Math.abs(total - 200 * 200) < 200 * 200 * 0.01, `halves cover the tile: ${total}`);
  for (const h of S.halves) {
    for (let i = 0; i < h.poly.length; i++) assert.ok(h.poly[i] >= 0 && h.poly[i] <= 200, "inside the tile");
    assert.ok(Math.abs(h.to.rot) > 0.05 && Math.abs(h.to.rot) < 0.2);
    assert.ok(h.to.sx < 1 && h.to.sy < 1, "drawn in toward its anchor");
    assert.ok(h.home.x > 0 && h.home.x < 200 && h.home.y > 0 && h.home.y < 200);
  }
  // half 0 lies on the cut's left-hand normal side (up the page for a cut along +x) and goes further that way
  assert.ok(S.halves[0].home.y < 100 && S.halves[0].to.y < 0);
  assert.ok(S.halves[1].home.y > 100 && S.halves[1].to.y > 0);
  // apart by about an eighth of the size each, with the same small droop down the page
  const apart = S.halves[1].to.y - S.halves[0].to.y;
  assert.ok(apart > 40 && apart < 70, `apart ${apart}`);
  assert.ok(S.halves[0].to.y + S.halves[1].to.y > 0, "both droop down");
  // a diagonal cut: the halves move along the cut's normal, opposite ways
  const D = splitLayout({ ...note, cutAngle: Math.PI / 4 }, { width: 200, height: 200 }), n = [-Math.SQRT1_2, Math.SQRT1_2];
  const along = (h) => h.to.x * n[0] + h.to.y * n[1];
  assert.ok(Math.sign(along(D.halves[0])) !== Math.sign(along(D.halves[1])));
  assert.ok(Math.abs(area(D.halves[0].poly) + area(D.halves[1].poly) - 40000) < 400);
});
test("split layout: loose threads hang from the cut, from both halves; seeded", () => {
  const S = splitLayout({ ...note, cutAngle: 0 }, { width: 200, height: 200 });
  assert.ok(S.threads.length >= 10 && S.threads.length <= 16);
  assert.deepEqual(new Set(S.threads.map((t) => t.half)), new Set([0, 1]));
  for (const t of S.threads) {
    for (const k of ["x0", "y0", "x1", "y1"]) assert.ok(Number.isFinite(t[k]), k);
    const len = Math.hypot(t.x1 - t.x0, t.y1 - t.y0);
    assert.ok(len > 3 && len < 48, `thread ${len}`); // the mock: up to 28 px of 210 across, and 0.6 of that down
    // it starts on its half's cut edge, moved with that half
    const h = S.halves[t.half];
    assert.ok(Math.abs(t.y0 - h.to.y - 100) < 12, `on the cut: ${t.y0}`);
  }
  assert.deepEqual(splitLayout({ ...note, cutAngle: 0.7 }, { width: 200, height: 200 }), splitLayout({ ...note, cutAngle: 0.7 }, { width: 200, height: 200 }));
});

test("the ash ground mark: the mock's three ash tones", () => {
  const m = flatMark("ash", { x: 50, y: 50, r: 40 }, () => 0.5);
  assert.equal(m.kind, "ash");
  assert.deepEqual(m.blobs[0].steps.map((s) => s.color), [0x6d6660, 0x8a837b, 0x4a4440]);
  const w = wreckLayout({ ...note, mark: "ash" }, { centre: { x: 100, y: 100 }, width: 200, height: 200 });
  assert.deepEqual(w.mark.blobs[0].steps.map((s) => s.color), [0x6d6660, 0x8a837b, 0x4a4440]);
});

// --- picking and the GM's check pass the tile's cuttable ---
const tile = (id, src, extra = {}) => ({ id, x: 0, y: 0, width: 100, height: 100, rotation: 0, hidden: false, texture: { src }, flags: {}, ...extra });
test("an area of slashing picks webs and vines, not bushes; fire picks all plants", () => {
  const tiles = [tile("web", "Web_Corner.webp"), tile("vine", "Vines.webp"), tile("bush", "Bush.webp"), tile("ivy", "Ivy.webp")];
  const all = () => true;
  assert.deepEqual(propsInArea(tiles, all, 100, "slashing").map((t) => t.id), ["web", "vine"]);
  assert.deepEqual(propsInArea(tiles, all, 100, "fire").map((t) => t.id), ["web", "vine", "bush", "ivy"]);
  assert.deepEqual(propsInArea(tiles, all, 100, "bludgeoning"), []);
  const miss = propNextToMiss({ attacker: { x: -150, y: 50 }, target: { x: -100, y: 0, w: 100, h: 100 } }, [tile("bush", "Bush.webp")], 100, "slashing");
  assert.equal(miss, null, "a missed slash never cuts a bush");
});
const scene = { id: "s", flags: { animater: { breakableProps: true } } };
const sender = { id: "p", viewedScene: "s" };
const ask = (t, cause, patch = {}) => {
  const n = { ...breakNoteFor({ tile: t, walls: [], grid: 100, cause, seed: 5, from: cause.at, scene }), ...patch };
  return { note: n, check: validBreakRequest({ cause, note: n }, { tile: t, walls: [], scene, grid: 100, sender }) };
};
test("the GM: fire burns a plant away (ash), a slash splits a web, a slash on a bush is refused", () => {
  const fire = { kind: "area", damageType: "fire", at: { x: 50, y: -100 } }, slash = { kind: "area", damageType: "slashing", at: { x: 50, y: -100 } };
  const burnt = ask(tile("b", "Bush.webp"), fire);
  assert.deepEqual([burnt.note.style, burnt.note.mark], ["burn", "ash"]);
  assert.equal(burnt.check.ok, true);
  assert.deepEqual([burnt.check.note.style, burnt.check.note.mark], ["burn", "ash"]);
  const cut = ask(tile("w", "Web_Corner.webp"), slash);
  assert.equal(cut.check.ok, true);
  assert.equal(cut.check.note.style, "split");
  assert.equal(ask(tile("b", "Bush.webp"), slash).check.why, "material");
  assert.equal(ask(tile("v", "Vines_Wall.webp"), { kind: "area", damageType: "bludgeoning", at: { x: 50, y: -100 } }).check.why, "material");
});
test("the GM decides burn and split: a forged style is put right, and so is its mark", () => {
  const fire = { kind: "area", damageType: "fire", at: { x: 50, y: -100 } };
  // a requester claims shatter with a scorch on a burning web: the GM burns it, with ash
  const a = ask(tile("w", "Web_Corner.webp"), fire, { style: "shatter", mark: "scorch" });
  assert.deepEqual([a.check.note.style, a.check.note.mark], ["burn", "ash"]);
  // a requester claims burn on a barrel struck by fire: the GM shatters it, scorched
  const b = ask(tile("c", "Barrel_Wood.webp"), fire, { style: "burn", mark: "ash" });
  assert.deepEqual([b.check.note.style, b.check.note.mark], ["shatter", "scorch"]);
  // a requester claims split on a barrel cut by a slash: shatter, dust
  const c = ask(tile("c", "Barrel_Wood.webp"), { kind: "area", damageType: "slashing", at: { x: 50, y: -100 } }, { style: "split" });
  assert.deepEqual([c.check.note.style, c.check.note.mark], ["shatter", "dust"]);
  // a crate set to Burn away burns from fire
  const d = ask(tile("c", "Crate.webp", { flags: { animater: { prop: { style: "burn" } } } }), fire);
  assert.deepEqual([d.note.style, d.check.note.style, d.check.note.mark], ["burn", "burn", "ash"]);
});
test("a blast burns a plant away", () => {
  const t = tile("b", "Bush.webp"), cause = { kind: "blast", sourceId: "keg", damageType: "fire" };
  const n = breakNoteFor({ tile: t, walls: [], grid: 100, cause, seed: 5, from: { x: 50, y: -50 }, scene });
  assert.deepEqual([n.style, n.mark], ["burn", "ash"]);
  const keg = { id: "keg", x: 0, y: -200, width: 100, height: 100, hidden: true, flags: { animater: { prop: { contents: "powder", broken: { ...note, powder: "exploded", burst: 3 } } } }, texture: { src: "Keg.webp" } };
  const r = validBreakRequest({ cause: { kind: "blast", sourceId: "keg" }, note: n }, { tile: t, walls: [], scene, grid: 100, sender: { id: "gm", isGM: true, viewedScene: "s" }, source: keg });
  assert.equal(r.ok, true, r.why);
  assert.deepEqual([r.note.style, r.note.mark], ["burn", "ash"]);
});
