import test from "node:test";
import assert from "node:assert/strict";
import { beamGeometry } from "../../../scripts/engines/media/media-preview.mjs";
test("beam preview maps opaque endpoints onto token centers, preserving JB2A padding", () => {
  const g = beamGeometry(150, 1000, 400, [200, 200, 200]);
  assert.equal(g.width, 250);
  assert.equal(g.height, 100);
  assert.equal(g.start, 50);
  assert.equal(g.width - g.start - g.end, 150);
});
test("untemplated and malformed media preserve finite preview geometry", () => {
  assert.deepEqual(beamGeometry(150, 1000, 400), {
    width: 150,
    height: 60,
    start: 0,
    end: 0,
  });
  assert.deepEqual(beamGeometry(150, 1000, 400, [200, 900, 900]), {
    width: 150,
    height: 60,
    start: 0,
    end: 0,
  });
});
