import test from "node:test";
import assert from "node:assert/strict";
import { tileRect, tileArtScale } from "../../../scripts/engines/props/prop-geometry.mjs";

const near = (got, want) => {
  for (const k of Object.keys(want)) assert.ok(Math.abs(got[k] - want[k]) < 1e-9, `${k}: ${got[k]} vs ${want[k]}`);
};

test("default anchor 0.5: x/y is the centre, the rect starts half a tile up and left", () => {
  near(tileRect({ x: 1300, y: 300, width: 100, height: 100, rotation: 0, texture: { anchorX: 0.5, anchorY: 0.5 } }),
    { x: 1250, y: 250, width: 100, height: 100, rotation: 0 });
});

test("anchor 0: x/y is already the top-left corner", () => {
  near(tileRect({ x: 1300, y: 300, width: 100, height: 100, texture: { anchorX: 0, anchorY: 0 } }),
    { x: 1300, y: 300, width: 100, height: 100, rotation: 0 });
});

test("non-square tile at the default anchor", () => {
  near(tileRect({ x: 1600, y: 1100, width: 100, height: 200, texture: { anchorX: 0.5, anchorY: 0.5 } }),
    { x: 1550, y: 1000, width: 100, height: 200 });
});

test("no anchor given reads as v14's default centre", () => {
  near(tileRect({ x: 200, y: 200, width: 100, height: 60 }), { x: 150, y: 170 });
});

test("rotation turns about the anchor: the centre lies along the turned offset", () => {
  // anchor at the top-left corner, turned 90 degrees: the centre swings to the anchor's lower left
  const r = tileRect({ x: 500, y: 500, width: 200, height: 100, rotation: 90, texture: { anchorX: 0, anchorY: 0 } });
  near({ cx: r.x + r.width / 2, cy: r.y + r.height / 2 }, { cx: 450, cy: 600 });
  near(r, { width: 200, height: 100, rotation: 90 });
});

test("a placeable reads through its document", () => {
  near(tileRect({ document: { x: 100, y: 100, width: 100, height: 100, texture: { anchorX: 0.5, anchorY: 0.5 } } }), { x: 50, y: 50 });
});

test("art scale: fill stretches to the tile, then the texture scale multiplies (a negative one mirrors)", () => {
  near(tileArtScale({ width: 200, height: 100 }, 400, 400), { sx: 0.5, sy: 0.25 });
  near(tileArtScale({ width: 200, height: 100, texture: { fit: "fill", scaleX: -2, scaleY: 1.5 } }, 400, 400), { sx: -1, sy: 0.375 });
});
test("art scale: contain, cover, width and height keep the art's aspect", () => {
  const d = (fit) => ({ width: 200, height: 100, texture: { fit } });
  near(tileArtScale(d("contain"), 400, 400), { sx: 0.25, sy: 0.25 });
  near(tileArtScale(d("cover"), 400, 400), { sx: 0.5, sy: 0.5 });
  near(tileArtScale(d("width"), 400, 400), { sx: 0.5, sy: 0.5 });
  near(tileArtScale(d("height"), 400, 400), { sx: 0.25, sy: 0.25 });
  near(tileArtScale({ ...d("contain"), texture: { fit: "contain", scaleX: 2, scaleY: -1 } }, 400, 400), { sx: 0.5, sy: -0.25 });
});
test("art scale: unknown fit reads as fill; a zero or missing scale as 1", () => {
  near(tileArtScale({ width: 100, height: 100, texture: { fit: "odd", scaleX: 0 } }, 50, 200), { sx: 2, sy: 0.5 });
});
