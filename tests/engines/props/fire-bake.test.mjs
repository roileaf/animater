import test from "node:test";
import assert from "node:assert/strict";
import { frontsOf, stripLook, cellAt, frontTiles, fadeWeights, compositeAlpha, FAMILY_CAP, familyKey, groundLook, tilePlan, frameAt, frameMix, footAt, leanAt, topAt, liftAt, cellFeatures, paintTile, paintSeats, paintGround, bakeTile,
  createFlameBank, acquireFlameBank, releaseFlameBank, tileSize, FRAMES, FRAME_MS, RING, VARIANTS, LEAN } from "../../../scripts/engines/props/fire-bake.mjs";
import { createFireLooks } from "../../../scripts/engines/props/fire-looks.mjs";

const cell = (col, row, seed = col + row * 10 + 1, g = 100) => ({ id: `${col},${row}`, seed, rect: { x: col * g, y: row * g, w: g, h: g } });

// A 2D context that accepts anything and records the composite modes it is put through.
const recorder = () => {
  const modes = new Set(), calls = [];
  const grad = { addColorStop() {} };
  const ctx = new Proxy({}, {
    get(t, k) {
      if (k === "modes") return modes;
      if (k === "calls") return calls;
      if (k in t) return t[k];
      if (k === "createLinearGradient" || k === "createRadialGradient") return () => grad;
      return (...a) => { calls.push(k); };
    },
    set(t, k, v) { t[k] = v; if (k === "globalCompositeOperation") modes.add(v); return true; },
  });
  return ctx;
};

test("squares that touch along a row burn as one front, squares that touch only at a corner stay apart", () => {
  const fronts = frontsOf([cell(0, 0), cell(1, 0), cell(2, 0), cell(3, 1), cell(4, 1), cell(2, 3)]);
  assert.deepEqual(fronts.map((f) => f.cells.map((c) => c.id)), [["0,0", "1,0", "2,0"], ["3,1", "4,1"], ["2,3"]]);
  // Diagonal neighbours are not one front.
  assert.equal(frontsOf([cell(0, 0), cell(1, 1)]).length, 2);
  // A gap of one square splits a row; the order the cells are handed in does not matter.
  assert.deepEqual(frontsOf([cell(3, 0), cell(0, 0), cell(1, 0)]).map((f) => f.cells.length), [2, 1]);
  assert.deepEqual(frontsOf([cell(1, 0), cell(0, 0)]).map((f) => f.cells.map((c) => c.id)), [["0,0", "1,0"]]);
  // A front knows where it stands and how big its squares are.
  assert.deepEqual([fronts[1].x, fronts[1].y, fronts[1].w, fronts[1].h], [300, 100, 100, 100]);
  assert.deepEqual(frontsOf([]), []);
  assert.deepEqual(frontsOf(null), []);
  assert.deepEqual(frontsOf([{ id: "bad", seed: 1, rect: { x: NaN, y: 0, w: 100, h: 100 } }]), []);
});

test("squares are told apart by position on the real, fractional grid too", () => {
  const g = 91.3, origin = 17.7;
  const row = [0, 1, 2].map((i) => ({ id: `c${i}`, seed: i + 1, rect: { x: origin + i * g, y: 40.1, w: g, h: g } }));
  assert.equal(frontsOf(row).length, 1);
  assert.equal(frontsOf([row[0], row[2]]).length, 2);
  // A different size of square is not the same front.
  assert.equal(frontsOf([row[0], { ...row[1], rect: { ...row[1].rect, w: g * 2 } }]).length, 2);
});

test("a row's strip look is the same every time and uses every variant; a ground picture's is its square's own", () => {
  assert.deepEqual(stripLook(12), stripLook(12));
  assert.deepEqual(groundLook(12345), groundLook(12345));
  const seen = new Set();
  for (let row = 0; row < 200; row++) {
    const l = stripLook(row);
    assert.ok(l.variant >= 0 && l.variant < VARIANTS && l.phase >= 0 && l.phase < FRAMES && l.shift >= 0 && l.shift < RING);
    seen.add(l.variant);
  }
  assert.equal(seen.size, VARIANTS);
});

test("a square that catches beside a front leaves every tile already drawn as it was", () => {
  const sq = (col, row = 4, g = 100) => ({ id: `${col},${row}`, seed: (col + 1) * 2654435761 % 0xffffffff, rect: { x: col * g, y: row * g, w: g, h: g } });
  const three = frontTiles(frontsOf([sq(5), sq(6), sq(7)])[0]);
  const grewLeft = frontTiles(frontsOf([sq(4), sq(5), sq(6), sq(7)])[0]);
  const grewRight = frontTiles(frontsOf([sq(5), sq(6), sq(7), sq(8)])[0]);
  assert.deepEqual(grewLeft.look, three.look, "same variant and loop phase");
  assert.deepEqual(grewRight.look, three.look);
  // The squares in the middle keep their picture exactly; only the end that was an end changes kind (the edge no longer falls
  // to the ground there), never its place in the ring or its variant.
  assert.deepEqual(grewLeft.tiles.slice(2), three.tiles.slice(1), "the old second and third tiles");
  assert.deepEqual(grewLeft.tiles[1], { ...three.tiles[0], kind: "mid" });
  assert.deepEqual(grewRight.tiles.slice(0, 2), three.tiles.slice(0, 2));
  assert.deepEqual(grewRight.tiles[2], { ...three.tiles[2], kind: "mid" });
  for (const f of [three, grewLeft, grewRight]) assert.ok(f.tiles.every((t) => t.variant === f.look.variant));
  // A square's ring place is its column, whatever front it is in; fractional grids give the same answer.
  assert.equal(cellAt({ x: 17.7 + 3 * 91.3, y: 40.1, w: 91.3, h: 91.3 }).col - cellAt({ x: 17.7 + 2 * 91.3, y: 40.1, w: 91.3, h: 91.3 }).col, 1);
  const k = (f) => f.tiles.map((t) => t.k);
  assert.deepEqual(k(grewLeft).slice(1), k(three), "ring places of the old tiles are unchanged");
  // Another row is another strip.
  assert.notDeepEqual(stripLook(3), stripLook(4));
});

test("a front of n squares is n tiles: its two ends fall to the ground and the squares between run on round the ring", () => {
  assert.deepEqual(tilePlan(1), [{ kind: "solo", k: 0 }]);
  assert.deepEqual(tilePlan(2), [{ kind: "left", k: 0 }, { kind: "right", k: 1 }]);
  const plan = tilePlan(RING + 3);
  assert.equal(plan.length, RING + 3);
  assert.equal(plan[0].kind, "left");
  assert.equal(plan.at(-1).kind, "right");
  assert.ok(plan.slice(1, -1).every((t) => t.kind === "mid"));
  // Each tile's place in the ring is one more than the last, so the edge of one square is the start of the next.
  for (let i = 1; i < plan.length; i++) assert.equal(plan[i].k, i % RING);
  assert.equal(tilePlan(0).length, 1);
  // The strip can begin anywhere round the ring, so two fronts do not show the same stretch of edge.
  assert.deepEqual(tilePlan(5, 3).map((t) => t.k), [3, 4, 5, 6, 7]);
  assert.deepEqual(tilePlan(RING + 2, RING - 1).map((t) => t.k).slice(0, 3), [RING - 1, 0, 1]);
  assert.deepEqual(tilePlan(1, 5), [{ kind: "solo", k: 5 }]);
  assert.deepEqual(tilePlan(3, -1), tilePlan(3, RING - 1));
});

test("fronts start at different places round the ring, and a wide front shows no period", () => {
  const offsets = new Set();
  for (let s = 1; s < 200; s++) { const o = stripLook(s * 7919).shift; assert.ok(Number.isInteger(o) && o >= 0 && o < RING); offsets.add(o); }
  assert.equal(offsets.size, RING);
  assert.ok(RING >= 8);
  const h = (x) => topAt(x, 0.3, 1);
  for (const shift of [1, 2, 3, 4, 5, 6, 7]) {
    let diff = 0;
    for (let x = 0; x < RING; x += 0.05) diff += Math.abs(h(x) - h(x + shift));
    assert.ok(diff > 1, `shifted by ${shift} squares it is a different edge`);
  }
});

test("the top edge falls to nothing at an end, is full a seventh of a square in, and never goes under its floor", () => {
  for (let v = 0; v < VARIANTS; v++) {
    for (let th = 0; th < 1; th += 0.1) {
      assert.equal(topAt(0.3, th, v, 0), 0);
      assert.ok(topAt(0.3, th, v, 1 / 14) < topAt(0.3, th, v, 1 / 7), "it rises from the end");
      for (let x = 0; x < RING * 2; x += 0.05) {
        const h = topAt(x, th, v);
        assert.ok(h >= 0.12 - 1e-9 && h <= 1.14 + 1e-9, `edge ${h}`);
      }
    }
  }
});

test("the top edge runs on across the ring and round the loop, so tiles and frames join", () => {
  for (let v = 0; v < VARIANTS; v++) {
    for (const x of [0, 0.37, 1, 2.5, 3.99]) {
      for (const th of [0, 0.2, 0.55]) {
        assert.ok(Math.abs(topAt(x, th, v) - topAt(x + RING, th, v)) < 1e-9, "repeats every ring");
        assert.ok(Math.abs(topAt(x, th, v) - topAt(x, th + 1, v)) < 1e-9, "repeats every loop");
      }
    }
    // Continuous: a tiny step along the strip is a tiny step in height, including over a seam between two squares.
    for (let x = 0; x < RING * 2; x += 0.001) assert.ok(Math.abs(topAt(x + 0.001, 0.3, v) - topAt(x, 0.3, v)) < 0.05);
  }
  // Frames of the loop differ: it boils.
  assert.notEqual(topAt(0.4, 0, 0), topAt(0.4, 0.25, 0));
});

test("the foot's erased line wanders smoothly: uneven, but with no comb in it", () => {
  for (let v = 0; v < VARIANTS; v++) {
    let lo = Infinity, hi = -Infinity, worst = 0;
    for (let x = 0; x < RING; x += 1 / 48) {
      const f = footAt(x, v);
      lo = Math.min(lo, f); hi = Math.max(hi, f);
      worst = Math.max(worst, Math.abs(footAt(x + 1 / 48, v) - f));
      assert.ok(Math.abs(footAt(x, v) - footAt(x + RING, v)) < 1e-9, "repeats every ring");
    }
    assert.ok(hi - lo > 0.1, "uneven");
    assert.ok(worst < 0.04, `neighbouring columns differ by ${worst}: no picket fence`);
  }
});

test("the loop is played by cross-fading each frame into the next, never by cutting", () => {
  assert.deepEqual(frameMix(0, 0), { a: 0, b: 1, t: 0 });
  const half = frameMix(FRAME_MS * 2.5, 0);
  assert.equal(half.a, 2); assert.equal(half.b, 3); assert.ok(Math.abs(half.t - 0.5) < 1e-9);
  assert.equal(frameMix(FRAME_MS * (FRAMES - 0.25), 0).b, 0, "the last frame fades into the first");
  assert.deepEqual(frameMix(99999, 4, true), { a: 4, b: 4, t: 0 }, "settled is one frame");
  let last = frameMix(0, 3);
  for (let ms = 1; ms < 3000; ms += 7) {
    const m = frameMix(ms, 3);
    assert.ok(m.t >= 0 && m.t < 1);
    if (m.a !== last.a) assert.ok(m.t < 0.1 && last.t > 0.9, "the frame changes only as the fade completes");
    last = m;
  }
  assert.equal(frameMix(5000, 2).a, frameAt(5000, 2), "the same frame as the cut would show");
});

test("cross-fading two frames never pulses: both fade, and a pixel the same in both stays within 11% of itself", () => {
  assert.deepEqual(fadeWeights(0), { base: 1, over: 0 });
  assert.deepEqual(fadeWeights(1), { base: 0, over: 1 });
  for (const A of [0.2, 0.42, 0.72]) {
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const c = compositeAlpha(A, A, t);
      assert.ok(c <= A + 1e-12, `A=${A} t=${t}: ${c} never rises above itself (laying the next over a whole base climbs to ${1 - (1 - A) ** 2})`);
      assert.ok(c >= A * (1 - 0.26 * A) - 1e-12 && c >= A * 0.74);
    }
    assert.ok(Math.abs(compositeAlpha(A, A, 0) - A) < 1e-12, "continuous at the start");
    assert.ok(Math.abs(compositeAlpha(A, A, 1) - A) < 1e-12, "and at the flip: no snap");
    assert.ok(Math.abs(compositeAlpha(A, A, 0.5) - (A - A * A / 4)) < 1e-12);
  }
  // The body fill (0.42): the dip is about 10%.
  assert.ok(compositeAlpha(0.42, 0.42, 0.5) > 0.42 * 0.89);
  // Different frames really blend: from the first alone to the second alone.
  assert.equal(compositeAlpha(0.8, 0, 0), 0.8);
  assert.equal(compositeAlpha(0, 0.6, 1), 0.6);
  assert.ok(compositeAlpha(0.8, 0, 0.5) < 0.8 && compositeAlpha(0, 0.6, 0.5) < 0.6);
});

test("the mass breathes with the loop and the swell comes round to where it began", () => {
  assert.ok(Math.abs(liftAt(0) - liftAt(1)) < 1e-9);
  assert.ok(Math.abs(liftAt(0) - (1.9 + 0.45 * 0.5)) < 1e-9, "frame 0 is the middle of the swell, which is the still one");
  for (let th = 0; th < 1; th += 0.05) assert.ok(liftAt(th) >= 1.9 - 1e-9 && liftAt(th) <= 2.35 + 1e-9);
});

test("which frame shows is read off the clock: the same clock, the same frame, and still is its own", () => {
  assert.equal(frameAt(0, 0), 0);
  assert.equal(frameAt(FRAME_MS, 0), 1);
  assert.equal(frameAt(FRAME_MS * FRAMES, 0), 0, "the loop comes round");
  assert.equal(frameAt(FRAME_MS * 3 + 1, 5), (3 + 5) % FRAMES, "a front that starts later in the loop");
  assert.equal(frameAt(123456, 2), frameAt(123456, 2));
  assert.equal(frameAt(99999, 3, true), 3, "settled: the start frame whatever the clock says");
  assert.equal(frameAt(-FRAME_MS, 0), FRAMES - 1, "a clock before zero still lands on a frame");
  assert.equal(frameAt(NaN, 1), 1);
  assert.equal(leanAt(99999, 3, true), 0, "settled fire stands upright");
  for (let ms = 0; ms < 20000; ms += 313) assert.ok(Math.abs(leanAt(ms, 1)) <= LEAN);
});

test("the same square has the same features everywhere, and its neighbours' are its own to read", () => {
  assert.deepEqual(cellFeatures(1, 2), cellFeatures(1, 2));
  assert.notDeepEqual(cellFeatures(1, 2), cellFeatures(1, 3));
  assert.notDeepEqual(cellFeatures(0, 2), cellFeatures(1, 2));
  const f = cellFeatures(0, 0);
  assert.ok(f.columns.length > 0 && f.channels.length >= 2 && f.licks.length >= 2 && f.seats.length === 3);
  for (const v of f.knots.map((k) => k.u)) assert.ok(v >= 0 && v <= 1);
});

test("painting uses the canvas modes PIXI.Graphics cannot: additive light, subtracted channels, a dissolved foot", () => {
  const c = recorder();
  paintTile(c, { variant: 1, kind: "solo", k: 0 }, 0.25);
  assert.ok(c.modes.has("lighter"));
  assert.ok(c.modes.has("destination-out"));
  assert.equal(c.globalCompositeOperation, "source-over", "left as it was found");
  assert.equal(c.globalAlpha, 1);
  const again = recorder();
  paintTile(again, { variant: 1, kind: "solo", k: 0 }, 0.25);
  assert.deepEqual(again.calls, c.calls, "the same tile and frame draw the same thing");
  const other = recorder();
  paintTile(other, { variant: 2, kind: "solo", k: 0 }, 0.25);
  assert.notDeepEqual(other.calls, c.calls);
  paintSeats(recorder(), { variant: 0, kind: "mid", k: 2 }, 0.5);
  paintGround(recorder(), 0, 0.5);
});

test("a tile's draw never reads a clock or a random number", () => {
  const real = { now: Date.now, random: Math.random, perf: globalThis.performance?.now };
  Date.now = () => { throw new Error("clock"); };
  Math.random = () => { throw new Error("random"); };
  try {
    for (const kind of ["solo", "left", "mid", "right"]) paintTile(recorder(), { variant: 0, kind, k: 1 }, 0.5);
    paintGround(recorder(), 2, 0.3);
  } finally { Date.now = real.now; Math.random = real.random; }
});

// ---- the bank and the sprites, on a stand-in PIXI ----

const fakePixi = () => {
  const log = { textures: [], destroyed: 0, sprites: [], canvases: 0 };
  class Texture { constructor(src) { this.src = src; this.gone = false; log.textures.push(this); } static from(src) { return new Texture(src); } destroy() { if (!this.gone) { this.gone = true; log.destroyed++; } } }
  class Point { constructor() { this.x = 0; this.y = 0; } set(x, y = x) { this.x = x; this.y = y; } copyFrom(p) { this.x = p.x; this.y = p.y; return this; } }
  class Container { constructor() { this.children = []; this.parent = null; this.destroyed = false; } addChild(c) { this.children.push(c); c.parent = this; return c; }
    destroy() { this.destroyed = true; for (const c of this.children) c.destroy?.(); } }
  class Sprite extends Container { constructor(texture) { super(); this.texture = texture; this.anchor = new Point(); this.position = new Point(); this.scale = new Point(); this.skew = new Point(); this.blendMode = 0; log.sprites.push(this); } }
  class Graphics { constructor() { this.polys = 0; } clear() { this.polys = 0; return this; } lineStyle() { return this; } beginFill() { return this; } endFill() { return this; } drawPolygon() { this.polys++; return this; } }
  return { PIXI: { Texture, Container, Sprite, Graphics, BLEND_MODES: { ADD: 1 } }, log };
};
const fakeCanvas = (log) => (w, h) => { log.canvases++; return { width: w, height: h, getContext: () => recorder() }; };

test("the bank bakes a family once, on first use, and destroys every texture it made", () => {
  const { PIXI, log } = fakePixi();
  const bank = createFlameBank({ PIXI, makeCanvas: fakeCanvas(log) });
  assert.equal(log.canvases, 0, "nothing is baked until something asks");
  const spec = { variant: 0, kind: "solo", k: 0 };
  const a = bank.tile(spec);
  assert.equal(a.length, FRAMES);
  assert.equal(log.canvases, FRAMES * 2, "a family is its flame frames and its foot-light frames");
  assert.strictEqual(bank.tile(spec), a, "the same textures come back");
  assert.equal(log.canvases, FRAMES * 2, "and nothing is baked again");
  bank.tile({ ...spec, kind: "left" }); bank.seats(spec); bank.ground(1); assert.ok(bank.scorch());
  const stats = bank.stats();
  assert.equal(stats.textures, FRAMES * 4 + FRAMES + 1);
  assert.ok(stats.bytes > 0);
  const canvases = log.canvases;
  bank.destroy();
  assert.equal(log.destroyed, FRAMES * 4 + FRAMES + 1);
  assert.deepEqual(bank.tile(spec), [], "a destroyed bank bakes nothing more");
  assert.equal(log.canvases, canvases);
});

test("without a canvas or a PIXI that can make textures there is no bank, and no error", () => {
  assert.equal(createFlameBank({ PIXI: {}, makeCanvas: () => ({}) }), null);
  assert.equal(createFlameBank({ PIXI: fakePixi().PIXI, makeCanvas: null }), null);
  assert.equal(acquireFlameBank({}, null), null);
});

test("the module-wide bank is shared, and let go of only when the last holder lets go", () => {
  const { PIXI, log } = fakePixi();
  const one = acquireFlameBank(PIXI, fakeCanvas(log)), two = acquireFlameBank(PIXI, fakeCanvas(log));
  assert.strictEqual(one, two);
  one.tile({ variant: 0, kind: "solo", k: 0 });
  releaseFlameBank();
  assert.equal(log.destroyed, 0, "one holder is still using it");
  releaseFlameBank();
  assert.equal(log.destroyed, FRAMES * 2);
  releaseFlameBank(); // an extra release is harmless
});

test("burning grass is drawn as one body per front, off the shared clock, baked once, and let go of on clear", () => {
  const { PIXI, log } = fakePixi();
  const frames = [];
  const realRaf = globalThis.requestAnimationFrame, realCancel = globalThis.cancelAnimationFrame;
  globalThis.requestAnimationFrame = (fn) => { frames.push(fn); return frames.length; };
  globalThis.cancelAnimationFrame = () => {};
  try {
    const root = new PIXI.Container();
    let clock = 1000;
    const looks = createFireLooks({ PIXI, layer: () => root, floor: () => root, grid: () => 100, now: () => clock, makeCanvas: fakeCanvas(log) });
    // Three in a row, one that touches them only at a corner, one apart.
    const flames = [cell(0, 0), cell(1, 0), cell(2, 0), cell(3, 1), cell(7, 7)];
    looks.sync({ flames });
    const tileSprites = log.sprites.filter((s) => s.anchor.y > 0 && s.anchor.x === 0 && s.blendMode === 0 && s.scale.x !== 0 && Math.abs(s.scale.x) < 2);
    const additive = log.sprites.filter((s) => s.blendMode === 1);
    // 5 squares in 3 fronts: per square a flame tile and the next frame, a foot light, a still scorch, a ground picture and its next frame.
    assert.equal(log.sprites.length, 30);
    assert.equal(additive.length, 5);
    assert.ok(tileSprites.length >= 5);
    const baked = log.canvases;
    assert.ok(baked > 0);
    assert.equal(frames.length, 1, "the swell starts");

    // The frame shown is the shared clock's; every screen with this clock is at the same point.
    const textureOf = () => log.sprites.map((s) => log.textures.indexOf(s.texture));
    const before = textureOf();
    for (let i = 0; i < 5; i++) { const fn = frames.shift(); clock += 16; fn(); }
    const shown = textureOf();
    clock += FRAME_MS * 3;
    frames.shift()();
    assert.notDeepEqual(textureOf(), shown, "the loop moves on with the clock");
    assert.equal(before.length, shown.length);
    assert.equal(log.canvases, baked, "ticking never bakes");

    // The same squares again change nothing: no new sprites, no new bake.
    const sprites = log.sprites.length;
    looks.sync({ flames });
    assert.equal(log.sprites.length, sprites);
    assert.equal(log.canvases, baked);

    // A fire that has stopped changing settles: still frames, upright, and the loop stops.
    clock = 1000 + 20001 + 5;
    const lastFrame = frames.shift(); lastFrame?.();
    assert.equal(frames.length, 0, "the frame loop stops");
    assert.ok(log.sprites.filter((s) => s.skew.x !== 0).length === 0, "and the fire stands upright");

    // Another square catching rebuilds the layout and wakes the swell.
    looks.sync({ flames: [...flames, cell(1, 1)] });
    assert.equal(frames.length, 1);

    looks.clear();
    assert.equal(log.destroyed, log.textures.length, "every baked texture is destroyed when the fire looks go");
    looks.clear(); // twice is harmless
  } finally { globalThis.requestAnimationFrame = realRaf; globalThis.cancelAnimationFrame = realCancel; }
});

test("a front of n squares is placed as n tiles side by side on the grid, all one way round", () => {
  const { PIXI, log } = fakePixi();
  globalThis.requestAnimationFrame = () => 1; globalThis.cancelAnimationFrame = () => {};
  try {
    for (let row = 0; row < 6; row++) {
      const root = new PIXI.Container();
      const looks = createFireLooks({ PIXI, layer: () => root, grid: () => 100, now: () => 0, makeCanvas: fakeCanvas(log) });
      const from = log.sprites.length;
      looks.sync({ flames: [0, 1, 2, 3].map((i) => ({ id: `s${i}`, seed: 77 + i, rect: { x: 200 + i * 100, y: row * 100, w: 100, h: 100 } })) });
      const mine = log.sprites.slice(from).filter((s) => s.blendMode === 0 && s.anchor.x === 0 && s.anchor.y > 0.9 && s.alpha !== 0);
      assert.deepEqual(mine.map((s) => s.position.x).sort((a, b) => a - b), [200, 300, 400, 500], "four tiles, one per square, abutting exactly");
      assert.ok(mine.every((s) => Math.abs(s.scale.x - 100 / 64) < 1e-9), "scaled so a tile is one square wide");
      assert.ok(mine.every((s) => Math.abs(s.position.y - (row * 100 + 82)) < 1e-9), "standing on the foot line");
      looks.clear();
    }
  } finally { delete globalThis.requestAnimationFrame; delete globalThis.cancelAnimationFrame; }
});

test("a burning square's sprites fade the frame out as the next fades in, and the scorch never fades", () => {
  const { PIXI, log } = fakePixi();
  globalThis.cancelAnimationFrame = () => {};
  try {
    const frames = [];
    globalThis.requestAnimationFrame = (fn) => { frames.push(fn); return 1; };
    let clock = 0;
    const looks = createFireLooks({ PIXI, layer: () => new PIXI.Container(), grid: () => 100, now: () => clock, makeCanvas: fakeCanvas(log) });
    looks.sync({ flames: [cell(0, 0)] });
    const base = log.sprites.filter((s) => s.blendMode === 0);
    for (const t of [0, 0.25, 0.5, 0.75]) {
      clock = Math.round(FRAME_MS * (8 + t));
      frames.shift()();
      const alphas = base.map((s) => s.alpha).filter((a) => a !== undefined);
      assert.ok(alphas.some((a) => Math.abs(a - (1 - t)) < 0.01), `a base sprite at ${1 - t}`);
      assert.ok(alphas.some((a) => Math.abs(a - t) < 0.01), `a next-frame sprite at ${t}`);
      assert.ok(base.some((s) => s.alpha === undefined), "the scorch sprite is never touched, so it never fades");
    }
    looks.clear();
  } finally { delete globalThis.requestAnimationFrame; delete globalThis.cancelAnimationFrame; }
});

test("the bank never holds more families than its cap, however many it is asked for, and never evicts one that is in use", () => {
  const { PIXI, log } = fakePixi();
  const cap = 6;
  const bank = createFlameBank({ PIXI, makeCanvas: fakeCanvas(log), cap });
  const specs = [];
  for (let v = 0; v < VARIANTS; v++) for (const kind of ["solo", "left", "mid", "right"]) for (let k = 0; k < RING; k++) specs.push({ variant: v, kind, k });
  assert.equal(specs.length, 96, "the distinct families a long campaign can reach");
  const used = specs.slice(0, 2); // a layout using two
  bank.hold(used);
  const keep = used.map((u) => bank.family(u));
  for (let round = 0; round < 3; round++) {
    for (const spec of specs) {
      bank.family(spec);
      assert.ok(bank.stats().families <= cap, "never over the cap");
    }
  }
  assert.equal(bank.stats().families, cap);
  used.forEach((u, i) => { assert.strictEqual(bank.family(u), keep[i], "a family in use keeps its textures"); assert.ok(keep[i].tex.every((t) => !t.gone)); });
  // Everything evicted was destroyed: live textures are exactly the kept families' (flame + foot light) plus none from the rest.
  const live = log.textures.filter((t) => !t.gone).length;
  assert.equal(live, cap * FRAMES * 2);
  assert.ok(log.canvases > cap * FRAMES * 2, "far more were baked than are kept");
  // The least recently used goes first.
  const fresh = createFlameBank({ PIXI, makeCanvas: fakeCanvas(log), cap: 2 });
  const [x, y, z] = specs;
  const fx = fresh.family(x); fresh.family(y); fresh.family(x); fresh.family(z);
  assert.strictEqual(fresh.family(x), fx, "x was used more recently than y, so y went");
  assert.equal(fresh.stats().families, 2);
  // More held than the cap are all kept (in use), and let go of once released.
  const crowd = createFlameBank({ PIXI, makeCanvas: fakeCanvas(log), cap: 2 });
  crowd.hold(specs.slice(0, 5)); for (const sp of specs.slice(0, 5)) crowd.family(sp);
  assert.equal(crowd.stats().families, 5);
  crowd.hold([]);
  assert.equal(crowd.stats().families, 2);
  // The shipped cap keeps the realistic ceiling under 16 MB.
  const b = createFlameBank({ PIXI, makeCanvas: fakeCanvas(log) });
  assert.equal(b.cap, FAMILY_CAP);
  for (const sp of specs) b.family(sp);
  for (let v = 0; v < VARIANTS; v++) b.ground(v);
  b.scorch();
  assert.ok(b.stats().families <= FAMILY_CAP);
  assert.ok(b.stats().bytes < 16 * 1024 * 1024, `${b.stats().bytes} bytes`);
  assert.equal(familyKey({ variant: 1, kind: "mid", k: 3 }), "1:mid:3");
  for (const x of [bank, fresh, crowd, b]) x.destroy();
});

test("with no way to paint, a front is still drawn, as one plain body", () => {
  const { PIXI, log } = fakePixi();
  const frames = [];
  globalThis.requestAnimationFrame = (fn) => { frames.push(fn); return 1; }; globalThis.cancelAnimationFrame = () => {};
  try {
    const root = new PIXI.Container();
    const looks = createFireLooks({ PIXI: { ...PIXI, Texture: undefined }, layer: () => root, grid: () => 100, now: () => 0 });
    looks.sync({ flames: [cell(0, 0), cell(1, 0)] });
    frames.shift()();
    assert.equal(log.sprites.length, 0);
    looks.clear();
  } finally { delete globalThis.requestAnimationFrame; delete globalThis.cancelAnimationFrame; }
});

test("tile pictures have the size the sprites are laid out for", () => {
  const { w, h } = tileSize(64);
  assert.equal(w, 64);
  assert.ok(h > 64 * 3);
  const cvs = bakeTile(fakeCanvas({ canvases: 0 }), { variant: 0, kind: "solo", k: 0 });
  assert.equal(cvs.length, FRAMES);
  assert.ok(cvs.every((cv) => cv.width === w && cv.height === h));
});
