import { test } from "node:test";
import assert from "node:assert/strict";
import { SMART_TUNING, sizeOrder, startSize, boxPoints, nearbyClicks, consensus, cutStart, cutFrom, solidCut, spotAt, sliverAt, smallSpots, maskPieces, cleanSelection, nextAreaId, smartProposal } from "../../../scripts/engines/regions/smart-select.mjs";

const W = 100, H = 80;
const rect = (x0, y0, x1, y1) => { const m = new Uint8Array(W * H); for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) m[y * W + x] = 1; return m; };
const or = (...masks) => { const m = new Uint8Array(W * H); for (const a of masks) for (let i = 0; i < m.length; i++) m[i] ||= a[i]; return m; };
const sum = (m) => m.reduce((s, v) => s + v, 0);

test("the three sizes order smallest first; a click starts in the middle, a box on the top score", () => {
  const slab = rect(10, 10, 14, 14), room = rect(5, 5, 40, 30), most = rect(0, 0, 90, 70);
  const masks = [most, slab, room];
  assert.deepEqual(sizeOrder(masks), [1, 2, 0]);
  assert.equal(startSize(masks, [0.9, 0.95, 0.6]), 2, "a click: the room, not the slab the top score picks");
  assert.equal(startSize(masks, [0.9, 0.95, 0.6], { box: true }), 1, "a box: the model's top score");
});

test("a box goes in as its two corners with SAM's corner labels, whichever way it was dragged", () => {
  assert.deepEqual(boxPoints([50, 40, 10, 5]), [{ x: 10, y: 5, label: 2 }, { x: 50, y: 40, label: 3 }]);
});

test("nearby clicks surround the click by a share of the long side and stay on the map", () => {
  const spots = nearbyClicks({ x: 1, y: 40 }, W, H);
  assert.equal(spots.length, 5);
  assert.deepEqual(spots[0], { x: 1, y: 40, label: 1 });
  const r = W * SMART_TUNING.consensusRadius;
  assert.deepEqual(spots[1], { x: 1 + r, y: 40, label: 1 });
  assert.equal(spots[2].x, 0, "kept on the map");
  assert.ok(spots.every((s) => s.label === 1));
});

test("consensus picks the floor that most nearby clicks agree on, not the bush under the click", () => {
  const bush = rect(48, 38, 52, 42), floor = rect(10, 10, 90, 70), map = rect(0, 0, 100, 80);
  const onBush = [bush, rect(47, 37, 53, 43), map];   // the real click: all three sizes miss the floor's extent
  const around = [floor, map, rect(10, 10, 88, 70)];   // four nearby clicks on open floor
  const pick = consensus([onBush, around, around, around, around], W, H, 2);
  assert.ok(sum(pick.mask) > sum(bush) * 10, "the floor, not the bush");
  assert.ok(Math.abs(sum(pick.mask) - sum(floor)) < sum(floor) * 0.1);
});

test("cleanup keeps the clicked piece, drops loose ones, and fills small enclosed holes but not big ones", () => {
  const floor = rect(10, 10, 60, 60), table = rect(30, 30, 34, 34), courtyard = rect(15, 15, 55, 25), stray = rect(80, 5, 90, 15);
  const withHoles = floor.map((v, i) => (v && !table[i] && !courtyard[i] ? 1 : 0)), mask = or(withHoles, stray);
  const out = cleanSelection(mask, W, H, [{ x: 20, y: 40, label: 1 }], 0.02);
  assert.equal(out[85 + 10 * W], 0, "the loose piece is dropped");
  assert.equal(out[31 + 31 * W], 1, "the small table hole is filled");
  assert.equal(out[30 + 20 * W], 0, "the large courtyard hole stays a hole");
  assert.equal(cleanSelection(mask, W, H, [{ x: 0, y: 0, label: 2 }, { x: 99, y: 79, label: 3 }], 0.02)[85 + 10 * W], 1, "a box keeps every piece");
});

test("a second add-click keeps its own piece too", () => {
  const a = rect(5, 5, 20, 20), b = rect(60, 40, 80, 60), out = cleanSelection(or(a, b), W, H, [{ x: 10, y: 10, label: 1 }, { x: 70, y: 50, label: 1 }]);
  assert.equal(sum(out), sum(a) + sum(b));
});

test("a new area takes the next free id, shares no pixel with the list, and a sliver is refused", () => {
  assert.equal(nextAreaId([{ id: "area-1" }, { id: "area-4" }]), "area-5");
  assert.equal(nextAreaId([]), "area-1");
  const claimedMask = rect(10, 10, 30, 30), claimed = [{ id: "area-1", pixels: Int32Array.from([...claimedMask.keys()].filter((i) => claimedMask[i])) }];
  const area = smartProposal(rect(20, 20, 60, 50), W, H, { id: "area-2", claimed });
  assert.equal(area.id, "area-2");
  assert.equal(area.smart, true);
  assert.equal(area.preselected, true);
  assert.ok(area.loops.length >= 1);
  const owned = new Set(claimed[0].pixels);
  assert.ok(![...area.pixels].some((p) => owned.has(p)), "no shared pixel");
  assert.equal(smartProposal(rect(0, 0, 1, 1), W, H, { id: "area-3" }), null);
  assert.equal(smartProposal(new Uint8Array(W * H), W, H, { id: "area-3" }), null);
});

test("a right-click cuts the largest size that is still a part of the area, not the area itself", () => {
  const field = rect(0, 0, 80, 60), leaf = rect(30, 30, 32, 32), bush = rect(25, 25, 40, 40), off = rect(85, 0, 100, 80);
  assert.equal(cutStart([field, leaf, bush], field), 2, "the bush: the field itself is too big to be a part");
  assert.equal(cutStart([field, leaf, rect(0, 0, 70, 60)], field), 1, "only the leaf is small enough");
  assert.equal(cutStart([off, rect(0, 0, 100, 80), field], field), null, "off the area or the whole area: nothing to cut");
  assert.equal(cutStart([leaf], new Uint8Array(W * H)), null);
});

test("a big part that plainly looks different, like a stone bridge over a small pool, can still be cut", () => {
  const pool = rect(0, 0, 40, 30), bridge = rect(0, 10, 40, 22), rgba = new Uint8ClampedArray(W * H * 4);
  for (let p = 0; p < W * H; p++) rgba.set(bridge[p] ? [150, 150, 145, 255] : [40, 110, 170, 255], p * 4);
  const pixel = 15 * W + 20;
  assert.equal(cutStart([bridge, pool], pool, { pixel }), null, "40% of the pool: too big by size alone");
  assert.equal(cutStart([bridge, pool], pool, { pixel, rgba, width: W }), 0, "but grey on blue: the bridge");
  const plain = new Uint8ClampedArray(W * H * 4); for (let p = 0; p < W * H; p++) plain.set([40, 110, 170, 255], p * 4);
  assert.equal(cutStart([bridge, pool], pool, { pixel, rgba: plain, width: W }), null, "the same colour as the rest: not a part");
  assert.equal(cutStart([rect(0, 0, 40, 27), pool], pool, { pixel, rgba, width: W }), null, "most of the pool is never a part");
});

test("a cut leaves a hole the size of the part plus a one-pixel rim, and reports what it removed", () => {
  const field = rect(0, 0, 80, 60), bush = rect(30, 30, 40, 40);
  const { mask, removed } = cutFrom(field, bush, W, H);
  assert.equal(sum(removed), 12 * 12, "the bush grown by one pixel");
  assert.equal(sum(mask), 80 * 60 - 12 * 12);
  assert.equal(mask[35 * W + 35], 0, "the hole stays open");
  const edge = cutFrom(field, rect(75, 0, 100, 80), W, H);
  assert.equal(sum(edge.removed), 6 * 60, "only the part on the area is removed");
  const area = smartProposal(mask, W, H, { id: "area-1" });
  assert.ok(area.loops.some((loop) => loop.hole), "traced with the hole");
});

test("a speckled cut becomes the one piece under the click, filled solid", () => {
  const bush = rect(20, 20, 40, 40); for (let y = 22; y < 38; y += 3) for (let x = 22; x < 38; x += 3) bush[y * W + x] = 0;
  const speck = rect(70, 10, 72, 12);
  const cut = solidCut(or(bush, speck), W, H, { x: 30, y: 31 });
  assert.equal(sum(cut), 20 * 20, "pinholes filled");
  assert.equal(cut[11 * W + 71], 0, "the stray speck elsewhere is dropped");
});

test("a stray spot of an area is found under a click; the main body never is", () => {
  const body = rect(0, 0, 50, 50), bead = rect(60, 10, 63, 13), patch = rect(60, 30, 75, 45);
  const area = or(body, bead, patch);
  assert.equal(sum(spotAt(area, W, H, 11 * W + 61)), 9, "the bead alone");
  assert.equal(spotAt(area, W, H, 25 * W + 25), null, "the main body is not a spot");
  assert.equal(spotAt(area, W, H, 70 * W + 90), null, "off the area");
  assert.equal(sum(spotAt(area, W, H, 35 * W + 65)), 225, "a smaller piece up to a quarter of the area is a spot too");
  assert.equal(spotAt(or(rect(0, 0, 10, 10), rect(20, 0, 29, 10)), W, H, 25), null, "over a quarter of the area: not a spot");
});

test("the broom takes every piece under 5% of the largest, and nothing when there is none", () => {
  const body = rect(0, 0, 50, 50), bead = rect(60, 10, 63, 13), bead2 = rect(80, 70, 82, 72), patch = rect(60, 30, 75, 45);
  const spots = smallSpots(or(body, bead, bead2, patch), W, H);
  assert.equal(sum(spots), 9 + 4, "both beads; the 225-pixel patch is 9% of the body and stays");
  assert.equal(smallSpots(or(body, patch), W, H), null);
});

test("a cut takes only the part of the clicked thing that lies on the area, and needs the click on it", () => {
  const field = rect(0, 0, 60, 60), bush = rect(50, 20, 90, 40);
  assert.equal(cutStart([field, bush], field, { pixel: 30 * W + 55 }), 1, "the bush, though mostly off the field");
  assert.equal(sum(cutFrom(field, bush, W, H, 0).removed), 10 * 20, "only its overlap goes");
  assert.equal(cutStart([bush], field, { pixel: 30 * W + 20 }), null, "a mask the click is not on is not a cut");
});

test("a right-click on a thin finger of an area finds the finger alone; a thick part or a ragged pixel finds nothing", () => {
  const body = rect(0, 0, 50, 50), finger = rect(50, 22, 80, 28); // 6 pixels wide, 30 long
  const area = or(body, finger);
  const sliver = sliverAt(area, W, H, 25 * W + 70);
  assert.ok(sliver, "the finger");
  assert.ok(sum(sliver) >= 6 * 28 && sum(sliver) <= 6 * 30 + 12, "about the finger, not the body");
  assert.equal(sliver[25 * W + 20], 0, "the body stays");
  assert.equal(sliverAt(area, W, H, 25 * W + 25), null, "the body is thick");
  assert.equal(sliverAt(area, W, H, 25 * W + 95), null, "off the area");
  const ragged = or(body, rect(50, 10, 52, 12));
  assert.equal(sliverAt(ragged, W, H, 11 * W + 51), null, "a two-pixel tooth is too small to be a finger");
  assert.equal(sliverAt(rect(0, 0, W, 4), W, H, 2 * W + 50), null, "a strip that is all the area is not a finger of it");
});

test("a mask's separate pieces come out one list each", () => {
  const pieces = maskPieces(or(rect(0, 0, 3, 3), rect(10, 10, 12, 12)), W, H);
  assert.deepEqual(pieces.map((p) => p.length), [9, 4]);
  assert.equal(pieces[1][0], 10 * W + 10, "sorted pixel lists");
});
