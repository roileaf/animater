import test from "node:test";
import assert from "node:assert/strict";
import { doorWreckLayout, windowWreckLayout, wallWreckTargets, wallLevelBase, DOOR_COLOUR, SPLINTER_TONES, GLASS_TONES } from "../../../scripts/engines/props/wall-wreck-layout.mjs";

// Door fixtures (R8: a later window test uses its own names).
const doorWall = { id: "d1", c: [300, 200, 400, 200] };
const doorNote = { seed: 5, cutAngle: Math.PI / 2, from: { x: 350, y: 120 }, kind: "door", material: "wood", mark: "dust" }; // hit from above: far side is y > 200
// Which side of the wall's line a point is on, signed like the side the hit came from (negative: the far side).
const sideOf = (wall, p) => { const [x1, y1, x2, y2] = wall.c; return Math.sign((x2 - x1) * (p.y - y1) - (y2 - y1) * (p.x - x1)); };

test("2-3 planks, all on the far side; splinters mostly far, a few near", () => {
  const L = doorWreckLayout(doorNote, doorWall, 100);
  assert.ok(L.planks.length >= 2 && L.planks.length <= 3, `${L.planks.length} planks`);
  assert.ok(L.planks.every((p) => p.y > 200), "every plank lies past the wall");
  assert.ok(L.splinters.near.length >= 3 && L.splinters.near.length <= 8, `${L.splinters.near.length} near splinters`);
  assert.ok(L.splinters.far.length > L.splinters.near.length);
});

test("the jagged gap covers the door segment", () => {
  const { gap } = doorWreckLayout(doorNote, doorWall, 100), xs = gap.poly.filter((_, i) => i % 2 === 0), ys = gap.poly.filter((_, i) => i % 2 === 1);
  assert.ok(Math.min(...xs) <= 305 && Math.max(...xs) >= 395, `x ${Math.min(...xs)}..${Math.max(...xs)}`);
  assert.ok(Math.min(...ys) < 200 && Math.max(...ys) > 200, `y ${Math.min(...ys)}..${Math.max(...ys)}`);
  assert.ok(gap.poly.length >= 20 && gap.poly.length % 2 === 0, "a ragged polygon, not a box");
});

test("same note, same wreck; only walls with a valid note get one", () => {
  assert.deepEqual(doorWreckLayout(doorNote, doorWall, 100), doorWreckLayout(doorNote, doorWall, 100));
  assert.notDeepEqual(doorWreckLayout({ ...doorNote, seed: 6 }, doorWall, 100), doorWreckLayout(doorNote, doorWall, 100));
  const w = (id, broken) => ({ id, flags: { animater: { breakWall: { broken } } } });
  const got = wallWreckTargets([w("a", doorNote), w("b", { seed: "x" }), { id: "c", flags: {} }]);
  assert.deepEqual(got.map((x) => x.id), ["a"]);
  assert.equal(got[0].note.seed, 5);
  assert.equal(got[0].note.kind, "door");
  assert.deepEqual(wallWreckTargets(undefined), []);
});

test("hit from the other side, or on an upright wall, the planks still land past the wall from the hitter", () => {
  const below = { ...doorNote, cutAngle: -Math.PI / 2, from: { x: 350, y: 300 } };
  assert.ok(doorWreckLayout(below, doorWall, 100).planks.every((p) => p.y < 200));
  const upright = { id: "d2", c: [500, 100, 500, 200] };
  for (const [from, cutAngle] of [[{ x: 420, y: 150 }, 0], [{ x: 580, y: 150 }, Math.PI]]) {
    const n = { ...doorNote, from, cutAngle }, L = doorWreckLayout(n, upright, 100), hitter = sideOf(upright, from);
    for (const p of L.planks) assert.equal(sideOf(upright, p), -hitter, `plank at ${p.x},${p.y}`);
    // A slanted hit still lands on the far side: the throw is held within the far half.
    for (const p of doorWreckLayout({ ...n, cutAngle: cutAngle + 1.4 }, upright, 100).planks) assert.equal(sideOf(upright, p), -hitter);
  }
});

test("far splinters lie past the wall, near ones on the hitter's side, all in the splinter tones", () => {
  const L = doorWreckLayout(doorNote, doorWall, 100), mid = (s) => ({ x: (s.pts[0] + s.pts[4]) / 2, y: (s.pts[1] + s.pts[5]) / 2 });
  assert.ok(L.splinters.far.every((s) => mid(s).y > 195), "far splinters past the wall");
  assert.ok(L.splinters.near.every((s) => mid(s).y < 205), "near splinters on the hitter's side");
  for (const s of [...L.splinters.far, ...L.splinters.near]) {
    assert.equal(s.pts.length, 8);
    assert.ok(SPLINTER_TONES.includes(s.tone), `tone ${s.tone}`);
  }
});

test("a stub on the hinge and latch ends; the two longest planks banded (as the mock), in the door's wood; the mark on the far side", () => {
  const L = doorWreckLayout(doorNote, doorWall, 100);
  assert.equal(L.stubs.length, 2);
  const [a, b] = L.stubs.map((s) => s.x).sort((p, q) => p - q);
  assert.ok(a < 310 && b > 390, `stubs at ${a} and ${b}`);
  for (const s of L.stubs) { assert.ok(Math.abs(s.y - 200) < 1e-9); assert.ok(s.len > 5 && s.len < 25); }
  assert.deepEqual(L.planks.map((p) => p.band), L.planks.map((_, i) => i !== 2));
  for (const p of L.planks) {
    assert.ok(p.len > p.wid && p.wid > 10, `plank ${p.len}x${p.wid}`);
    const dr = ((p.tone >> 16) & 255) - ((DOOR_COLOUR >> 16) & 255);
    assert.ok(dr >= 0 && dr <= 8, `tone ${p.tone.toString(16)} is the door's wood`);
  }
  assert.equal(L.mark.kind, "dust");
  assert.ok(L.mark.y > 200 && L.mark.r > 20);
  assert.equal(doorWreckLayout({ ...doorNote, mark: "scorch" }, doorWall, 100).mark.kind, "scorch");
});

test("the wreck scales with the grid", () => {
  const big = doorWreckLayout(doorNote, { id: "d1", c: [600, 400, 800, 400] }, 200), small = doorWreckLayout(doorNote, doorWall, 100);
  const across = (L) => { const ys = L.gap.poly.filter((_, i) => i % 2 === 1); return Math.max(...ys) - Math.min(...ys); };
  assert.ok(across(big) > across(small) * 1.6);
  assert.ok(big.planks[0].wid > small.planks[0].wid * 1.6);
});

test("a door's wreck lies on its own level's floor", () => {
  const levels = [{ id: "g", elevation: { base: 0, top: 10 } }, { id: "u", elevation: { base: 10, top: 20 } }];
  assert.equal(wallLevelBase(new Set(["u"]), levels, "g"), 10);
  assert.equal(wallLevelBase([], levels, "u"), 10, "no level named: the initial level");
  assert.equal(wallLevelBase(undefined, levels, null), 0, "else the first level");
  assert.equal(wallLevelBase(["u"], [], null), 0, "a scene without levels");
  assert.equal(wallLevelBase(["x"], [{ id: "x", elevation: {} }], null), 0);
});

// Window fixtures (R8: their own names, not the door's).
const windowWall = { id: "w", c: [300, 200, 400, 200] };
const windowNote = { seed: 3, cutAngle: Math.PI / 2, from: { x: 350, y: 120 }, kind: "window", material: "glass", mark: "dust" }; // hit from above: far side is y > 200

test("shards fan out away from the hit, a few near, glints, teeth in the frame", () => {
  const L = windowWreckLayout(windowNote, windowWall, 100);
  assert.ok(L.shards.far.every((s) => s.y > 200) && L.shards.near.every((s) => s.y < 200));
  assert.equal(L.shards.far.length, 60, "far count as the mock");
  assert.equal(L.shards.near.length, 9, "near count as the mock");
  assert.ok(L.shards.far.length > L.shards.near.length);
  assert.equal(L.glints.length, 9, "7 far + 2 near glints, as the mock");
  assert.ok(L.teeth.length >= 3, `${L.teeth.length} teeth`);
  assert.ok(L.teeth.every((t) => t.pts.every((v, i) => i % 2 === 0 || Math.abs(v - 200) <= 25)));
});

test("across seeds: 60 far, 9 near, 9 glints, far shards fan wide past the wall, teeth inside the segment", () => {
  for (let seed = 0; seed < 40; seed++) {
    const L = windowWreckLayout({ ...windowNote, seed }, windowWall, 100);
    assert.equal(L.shards.near.length, 9, `seed ${seed}: near`);
    assert.equal(L.shards.far.length, 60, `seed ${seed}: far`);
    assert.ok(L.shards.far.every((s) => s.y > 200), `seed ${seed}: far past the wall`);
    assert.ok(L.shards.near.every((s) => s.y < 200 && s.y > 150), `seed ${seed}: near close on the hitter's side`);
    assert.equal(L.glints.length, 9, `seed ${seed}: glints`);
    const farPts = new Set(L.shards.far.map((s) => `${s.x},${s.y}`)), nearPts = new Set(L.shards.near.map((s) => `${s.x},${s.y}`));
    assert.equal(L.glints.filter((g) => farPts.has(`${g.x},${g.y}`)).length, 7, `seed ${seed}: 7 far glints`);
    assert.equal(L.glints.filter((g) => nearPts.has(`${g.x},${g.y}`)).length, 2, `seed ${seed}: 2 near glints`);
    for (const t of L.teeth) for (let i = 0; i < t.pts.length; i += 2) {
      assert.ok(t.pts[i] >= 300 && t.pts[i] <= 400, `seed ${seed}: tooth x ${t.pts[i]}`);
      assert.ok(Math.abs(t.pts[i + 1] - 200) <= 6, `seed ${seed}: tooth y ${t.pts[i + 1]}`);
    }
  }
  // The fan: far shards reach well past the wall and spread along it.
  const far = windowWreckLayout(windowNote, windowWall, 100).shards.far, ys = far.map((s) => s.y), xs = far.map((s) => s.x);
  assert.ok(Math.max(...ys) > 300, `reach ${Math.max(...ys)}`);
  assert.ok(Math.max(...xs) - Math.min(...xs) > 100, `spread ${Math.min(...xs)}..${Math.max(...xs)}`);
});

test("each shard is a pale glass triangle with a size, a turn and where it flew from; glints sit on shards", () => {
  const L = windowWreckLayout(windowNote, windowWall, 100), all = [...L.shards.far, ...L.shards.near];
  for (const s of all) {
    assert.ok(Number.isFinite(s.x) && Number.isFinite(s.y) && Number.isFinite(s.rot));
    assert.ok(s.size >= 3 && s.size <= 15, `size ${s.size}`);
    assert.equal(s.pts.length, 6);
    assert.ok(GLASS_TONES.includes(s.tone), `tone ${s.tone}`);
    assert.ok(Math.abs(s.from.y - 200) <= 6 && s.from.x >= 300 && s.from.x <= 400, `from ${s.from.x},${s.from.y}`);
  }
  for (const g of L.glints) {
    assert.ok(all.some((s) => s.x === g.x && s.y === g.y), `glint at ${g.x},${g.y} is on a shard`);
    assert.ok(g.size > 0 && Number.isFinite(g.at), "a size and a twinkle time");
  }
  assert.ok(L.gap.poly.length >= 8 && L.gap.poly.every((v, i) => (i % 2 ? Math.abs(v - 200) <= 6 : v >= 300 && v <= 400)), "the empty pane lies along the frame");
  assert.ok(Math.abs(L.mullion.x - 350) < 1e-9 && Math.abs(L.mullion.y - 200) < 1e-9);
  assert.ok(L.slivers.length >= 3 && L.slivers.every((s) => s.pts.length === 8), "a few frame splinters");
});

test("same note, same window wreck; hit from the other side or on an upright wall, the fan still goes away from the hitter", () => {
  assert.deepEqual(windowWreckLayout(windowNote, windowWall, 100), windowWreckLayout(windowNote, windowWall, 100));
  assert.notDeepEqual(windowWreckLayout({ ...windowNote, seed: 4 }, windowWall, 100), windowWreckLayout(windowNote, windowWall, 100));
  const below = windowWreckLayout({ ...windowNote, cutAngle: -Math.PI / 2, from: { x: 350, y: 300 } }, windowWall, 100);
  assert.ok(below.shards.far.every((s) => s.y < 200) && below.shards.near.every((s) => s.y > 200));
  const upright = { id: "w2", c: [500, 100, 500, 200] };
  for (const [from, cutAngle] of [[{ x: 420, y: 150 }, 0], [{ x: 580, y: 150 }, Math.PI]]) {
    const L = windowWreckLayout({ ...windowNote, from, cutAngle }, upright, 100), hitter = sideOf(upright, from);
    for (const s of L.shards.far) assert.equal(sideOf(upright, s), -hitter, `far shard at ${s.x},${s.y}`);
    for (const s of L.shards.near) assert.equal(sideOf(upright, s), hitter, `near shard at ${s.x},${s.y}`);
  }
});

test("the window wreck scales with the grid; a fire leaves a scorch, else no mark", () => {
  const big = windowWreckLayout(windowNote, { id: "w", c: [600, 400, 800, 400] }, 200), small = windowWreckLayout(windowNote, windowWall, 100);
  const reach = (L, y) => Math.max(...L.shards.far.map((s) => s.y - y));
  assert.ok(reach(big, 400) > reach(small, 200) * 1.6);
  assert.ok(big.shards.far[0].size > small.shards.far[0].size * 1.6);
  assert.equal(small.mark, null);
  const scorch = windowWreckLayout({ ...windowNote, mark: "scorch" }, windowWall, 100).mark;
  assert.equal(scorch.kind, "scorch");
  assert.ok(scorch.y > 200 && scorch.r > 10);
});
