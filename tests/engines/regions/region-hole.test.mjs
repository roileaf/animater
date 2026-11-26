// A hole cut in a region by hand (scripts/engines/regions/region-hole.mjs), and its wiring in main.mjs.
// Roi: "lets add a button to make a hole in the region"; then "instead of attaching parts of lines can you make it
// freedraw? and also we can use the smart model when possible?"
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { strokeRing, strokeLength, ringMask, ringAsk, fittedHole, clickedHole, maskRing, ringToImage, ringToScene, holedShapes } from "../../../scripts/engines/regions/region-hole.mjs";

const W = 60, H = 40;
const box = (x0, y0, x1, y1) => { const m = new Uint8Array(W * H); for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) m[y * W + x] = 1; return m; };
const count = (m) => m.reduce((s, v) => s + v, 0);

test("a drawn stroke closes into a ring with its wiggles taken out; a dab or a line is none", () => {
  const circle = Array.from({ length: 80 }, (_, i) => ({ x: 100 + 50 * Math.cos((i / 80) * Math.PI * 2), y: 100 + 50 * Math.sin((i / 80) * Math.PI * 2) }));
  const ring = strokeRing(circle, 2);
  assert.ok(ring.length >= 6 && ring.length % 2 === 0 && ring.length < 160, "fewer corners than the pointer made");
  assert.deepEqual(strokeRing(circle, 0).length, 160, "none taken out when told to keep every point");
  assert.equal(strokeRing([{ x: 0, y: 0 }, { x: 5, y: 5 }]), null);
  assert.equal(strokeRing([{ x: 0, y: 0 }, { x: 5, y: 5 }, { x: 10, y: 10 }]), null, "all in a line");
  assert.equal(strokeRing([{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: NaN, y: 1 }, { x: 3, y: 0 }]), null);
  assert.equal(strokeRing(null), null);
  assert.equal(strokeLength([{ x: 0, y: 0 }, { x: 3, y: 4 }, { x: 3, y: 10 }]), 11);
  assert.equal(strokeLength([{ x: 1, y: 1 }]), 0);
});

test("a ring fills the pixels it goes round, and tells the model a point inside it and its box", () => {
  const mask = ringMask([10, 10, 30, 10, 30, 25, 10, 25], W, H);
  assert.equal(count(mask), 20 * 15);
  assert.equal(mask[10 * W + 10], 1); assert.equal(mask[9 * W + 10], 0); assert.equal(mask[24 * W + 29], 1); assert.equal(mask[25 * W + 29], 0);
  const ask = ringAsk(mask, W, H);
  assert.deepEqual(ask.points.map((p) => p.label), [1, 2, 3]);
  assert.deepEqual([ask.points[1].x, ask.points[1].y, ask.points[2].x, ask.points[2].y], [10, 10, 29, 24]);
  assert.equal(mask[ask.at.y * W + ask.at.x], 1);
  // A ring bent round its own middle: the point is still inside it.
  const horseshoe = ringMask([5, 5, 40, 5, 40, 30, 30, 30, 30, 12, 15, 12, 15, 30, 5, 30], W, H), bent = ringAsk(horseshoe, W, H);
  assert.equal(horseshoe[bent.at.y * W + bent.at.x], 1);
  assert.equal(ringAsk(new Uint8Array(W * H), W, H), null);
  assert.equal(count(ringMask([-10, -10, 5, -10, 5, 5, -10, 5], W, H)), 25, "kept on the picture");
});

test("the model's answer is taken when it is the thing the ring goes round, and only inside the ring", () => {
  const ring = box(10, 10, 29, 24), at = { x: 20, y: 17 };
  const island = box(13, 12, 26, 22), meadow = box(0, 0, 59, 39), speck = box(20, 17, 21, 18);
  const cut = fittedHole({ masks: [speck, island, meadow], ring, width: W, height: H, at });
  assert.deepEqual(Array.from(cut), Array.from(island), "the island, not the meadow nor a speck of it");
  // Running out past the ring a little: cut at the ring.
  const over = box(13, 12, 33, 22), kept = fittedHole({ masks: [over], ring, width: W, height: H, at });
  assert.equal(count(kept), 17 * 11); assert.equal(kept[15 * W + 31], 0);
  // Nothing that is the circled thing: the ring is cut as drawn.
  assert.equal(fittedHole({ masks: [meadow, speck], ring, width: W, height: H, at }), null);
  assert.equal(fittedHole({ masks: [box(35, 5, 55, 35)], ring, width: W, height: H, at }), null, "a thing beside the ring");
  assert.equal(fittedHole({ masks: [], ring, width: W, height: H, at }), null);
  assert.equal(fittedHole({ masks: [island], ring: null, width: W, height: H, at }), null);
  // A speckled answer is filled solid.
  const holed = Uint8Array.from(island); holed[17 * W + 20] = 0; holed[15 * W + 18] = 0;
  assert.equal(count(fittedHole({ masks: [holed], ring, width: W, height: H, at: { x: 22, y: 19 } })), count(island));
});

test("a click takes the thing under it: the model's surest answer that is neither a speck nor most of the map", () => {
  const rock = box(20, 15, 27, 21), meadow = box(0, 0, 59, 39), at = { x: 23, y: 18 };
  const cut = clickedHole({ masks: [meadow, rock], scores: [0.99, 0.8], width: W, height: H, at });
  assert.deepEqual(Array.from(cut), Array.from(rock));
  assert.equal(clickedHole({ masks: [meadow], scores: [0.99], width: W, height: H, at }), null, "only the meadow: no one thing");
  assert.equal(clickedHole({ masks: [], scores: [], width: W, height: H, at }), null);
});

test("a mask is traced to a ring, and rings go between the map's picture and the scene", () => {
  const ring = maskRing(box(20, 15, 27, 21), W, H);
  const xs = ring.filter((_, i) => i % 2 === 0), ys = ring.filter((_, i) => i % 2 === 1);
  assert.deepEqual([Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)], [20, 28, 15, 22], "round the pixels' outer edges");
  assert.equal(maskRing(new Uint8Array(W * H), W, H), null);
  const map = { width: W, height: H, rect: { x: 100, y: 200, width: 600, height: 400 } };
  assert.deepEqual(ringToScene([0, 0, 60, 40, 30, 20], map), [100, 200, 700, 600, 400, 400]);
  assert.deepEqual(ringToImage([100, 200, 700, 600, 400, 400], map), [0, 0, 60, 40, 30, 20]);
});

test("the ring is added to the region's shapes as a hole", () => {
  const shapes = [{ toObject: () => ({ type: "rectangle", x: 0, y: 0, width: 500, height: 500 }) }];
  assert.deepEqual(holedShapes(shapes, [100.4, 100, 200, 100, 200, 200.6]), [{ type: "rectangle", x: 0, y: 0, width: 500, height: 500 }, { type: "polygon", points: [100, 100, 200, 100, 200, 201], hole: true }]);
  assert.equal(holedShapes(shapes, [0, 0, 10, 10]), null);
  assert.equal(holedShapes(shapes, [0, 0, 10, 10, 20, 20]), null, "all in a line");
  assert.equal(holedShapes(shapes, [0, 0, 10, 0, 10, NaN]), null);
  assert.equal(holedShapes(shapes, null), null);
});

test("main.mjs: drawn freehand, fitted by the smart model only where it is already on the machine", () => {
  const main = readFileSync(new URL("../../../scripts/main.mjs", import.meta.url), "utf8").replace(/\r\n/g, "\n");
  const tool = main.slice(main.indexOf("let holeDraw = null, holeSmart = null;"), main.indexOf('Hooks.on("deleteRegion", (doc) => { if (holeDraw?.doc === doc) stopRegionHole(); });'));
  assert.ok(tool.length > 1000);
  assert.ok(tool.includes("if (!(await isSmartModelCached())) return null;"), "never downloaded from here");
  assert.ok(!/DialogV2|SMART_CONSENT/.test(tool), "so nothing to ask");
  assert.ok(tool.includes("if (!floors.levelMapIsPlain(level?.textures)) return null;"), "a map moved in its configuration is drawn by hand only");
  assert.ok(tool.includes("if (keep || !smart) return write(ring);"), "Shift, or no model: as drawn, at once");
  assert.ok(tool.includes("if (fit) propose(fit); else write(ring);"), "the model's outline is shown first; none, and the ring is cut as drawn");
  assert.ok(tool.includes("if (pending && pointInPolygon(at, pending)) return write(pending);"));
  assert.ok(tool.includes('Hooks.on("canvasTearDown", dropHoleSmart);'), "the map it read goes with the scene");
  assert.ok(!/snap\(|holeClickEnds|Backspace/.test(tool), "no corners clicked one by one");
});
