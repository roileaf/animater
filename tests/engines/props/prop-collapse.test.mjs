import test from "node:test";
import assert from "node:assert/strict";
import { collapseLayout } from "../../../scripts/engines/props/prop-collapse.mjs";

const note = { seed: 11, cutAngle: -0.2, pattern: "shards", pieces: 10, spread: 0.32, spin: 120, tint: "none", mark: "dust", from: { x: 0, y: 0 }, walls: [], style: "collapse", lights: [] };
const table = { width: 270, height: 180, legs: true };

test("2-4 boards along the long side, inside the picture, same every time", () => {
  const L = collapseLayout(note, table);
  assert.deepEqual(L, collapseLayout(note, table));
  const boards = new Set(L.planks.map((p) => p.board));
  assert.ok(boards.size >= 2 && boards.size <= 4);
  for (const p of L.planks) for (let i = 0; i < p.poly.length; i += 2) assert.ok(p.poly[i] >= -1 && p.poly[i] <= 271 && p.poly[i + 1] >= -1 && p.poly[i + 1] <= 181);
  assert.notDeepEqual(collapseLayout({ ...note, seed: 12 }, table), L);
});

test("boards run along the long side: wide props cut in horizontal strips, tall props in vertical ones", () => {
  for (let seed = 1; seed <= 20; seed++) {
    const wide = collapseLayout({ ...note, seed }, table), tall = collapseLayout({ ...note, seed }, { width: 100, height: 200, legs: false });
    const extent = (p, k) => { const v = p.poly.filter((_, i) => i % 2 === k); return Math.max(...v) - Math.min(...v); };
    for (const p of wide.planks.filter((q) => !q.edge)) assert.ok(extent(p, 0) > extent(p, 1), `seed ${seed}: a whole board of a wide prop is wider than tall`);
    for (const p of tall.planks.filter((q) => !q.edge)) assert.ok(extent(p, 1) > extent(p, 0), `seed ${seed}: a whole board of a tall prop is taller than wide`);
  }
});

test("a snapped board is two pieces with the same board index and a shared jagged edge", () => {
  let snapped = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const { planks } = collapseLayout({ ...note, seed }, table), byBoard = new Map();
    for (const p of planks) byBoard.set(p.board, [...(byBoard.get(p.board) ?? []), p]);
    assert.ok([...byBoard.values()].some((ps) => ps.length === 2), `seed ${seed}: at least one board snaps`);
    for (const ps of byBoard.values()) {
      assert.ok(ps.length === 1 || ps.length === 2);
      if (ps.length === 2) { snapped++; assert.deepEqual(ps[0].edge, ps[1].edge); assert.ok(ps[0].edge.length >= 8); }
      else assert.equal(ps[0].edge, undefined);
    }
  }
  assert.ok(snapped >= 30);
});

test("pieces slide along the hit no more than 0.3 of the prop's size", () => {
  for (let seed = 1; seed <= 30; seed++) for (const cutAngle of [-0.2, 1.2, 3]) {
    const { planks } = collapseLayout({ ...note, seed, cutAngle }, table);
    for (const p of planks) {
      const along = (p.to.x - p.home.x) * Math.cos(cutAngle) + (p.to.y - p.home.y) * Math.sin(cutAngle);
      assert.ok(along >= 0.08 * 270 - 1e-6 && along <= 0.3 * 270 + 1e-6, `seed ${seed} cut ${cutAngle}: slide ${along}`);
    }
  }
});

test("outer boards slump in toward the long middle line, across the slide", () => {
  const { planks } = collapseLayout(note, table), across = [-Math.sin(note.cutAngle), Math.cos(note.cutAngle)];
  for (const p of planks.filter((q) => Math.abs(q.home.y - 90) > 30)) {
    const side = (p.to.x - p.home.x) * across[0] + (p.to.y - p.home.y) * across[1], inward = Math.sign(90 - p.home.y) * Math.sign(across[1]);
    assert.ok(side * inward > 0, `a board at y ${p.home.y} moves toward the middle`);
  }
});

test("home is the piece's own centre; timing fits the 0-1 timeline", () => {
  for (const p of collapseLayout(note, table).planks) {
    let x = 0, y = 0; const n = p.poly.length / 2;
    for (let i = 0; i < p.poly.length; i += 2) { x += p.poly[i]; y += p.poly[i + 1]; }
    assert.ok(Math.abs(p.home.x - x / n) < 1e-9 && Math.abs(p.home.y - y / n) < 1e-9);
    assert.ok(p.delay >= 0 && p.dur > 0 && p.delay + p.dur <= 1);
    assert.ok(Math.abs(p.to.rot) < 0.5);
  }
});

test("four leg stubs at the corners with legs, none without", () => {
  const { legs } = collapseLayout(note, table);
  assert.equal(legs.length, 4);
  assert.equal(collapseLayout(note, { width: 100, height: 200, legs: false }).legs.length, 0);
  const corners = legs.map((l) => `${l.x < 135 ? "l" : "r"}${l.y < 90 ? "t" : "b"}`);
  assert.deepEqual(new Set(corners), new Set(["lt", "rt", "lb", "rb"]));
  for (const l of legs) {
    assert.ok(l.size > 0 && l.size <= 180 * 0.16 * 1.05);
    assert.ok(Math.min(l.x, 270 - l.x) < 30 && Math.min(l.y, 180 - l.y) < 30, "a stub sits near its corner");
  }
});

test("the dust lies a little along the hit, squashed to the prop's shape", () => {
  const { dust } = collapseLayout(note, table);
  assert.ok(Math.abs(dust.x - (135 + Math.cos(-0.2) * 27)) < 1e-9 && Math.abs(dust.y - (90 + Math.sin(-0.2) * 27)) < 1e-9);
  assert.equal(dust.r, 135);
  assert.ok(Math.abs(dust.squash - (180 / 270 + 0.2)) < 1e-9);
  assert.equal(dust.angle, 0);
  const tall = collapseLayout(note, { width: 100, height: 200, legs: false }).dust;
  assert.equal(tall.angle, Math.PI / 2);
  assert.ok(Math.abs(tall.squash - 0.7) < 1e-9);
});

test("a turned tile reads the hit in its own frame", () => {
  const turned = collapseLayout({ ...note, cutAngle: -0.2 + Math.PI / 2 }, { ...table, rotation: 90 });
  const flat = collapseLayout(note, table);
  for (let i = 0; i < flat.planks.length; i++) {
    assert.ok(Math.abs(turned.planks[i].to.x - flat.planks[i].to.x) < 1e-6 && Math.abs(turned.planks[i].to.y - flat.planks[i].to.y) < 1e-6);
  }
});

test("with the art's painted box, boards, stubs and dust keep to the painted part", () => {
  const box = [50 / 450, 61 / 300, 402 / 450, 232 / 300], L = collapseLayout(note, { ...table, box });
  const [x0, y0, x1, y1] = [box[0] * 270, box[1] * 180, box[2] * 270, box[3] * 180];
  for (const p of L.planks) for (let i = 0; i < p.poly.length; i += 2) assert.ok(p.poly[i] >= x0 - 6 && p.poly[i] <= x1 + 6 && p.poly[i + 1] >= y0 - 1 && p.poly[i + 1] <= y1 + 1);
  for (const l of L.legs) assert.ok(l.x > x0 && l.x < x1 && l.y > y0 && l.y < y1 && Math.min(l.x - x0, x1 - l.x) < 25);
  assert.ok(Math.abs(L.dust.r - (x1 - x0) / 2) < 1e-9);
  assert.deepEqual(collapseLayout(note, { ...table, box: [0.5, 0, 0.2, 1] }), collapseLayout(note, table), "a bad box is the whole tile");
});
