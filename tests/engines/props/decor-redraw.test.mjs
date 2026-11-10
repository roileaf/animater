// Many decoration breaks at once repaint once (final review I2): the painter and the cavern are rebuilt once per frame,
// however many decorations broke, were refused or were stored in it.
import test from "node:test";
import assert from "node:assert/strict";
import { createDecorRedraw } from "../../../scripts/engines/props/decor-break.mjs";

function harness() {
  const frames = [], runs = [];
  const redraw = createDecorRedraw({ later: (fn) => frames.push(fn), redraw: (what) => runs.push({ regions: [...what.regions].sort(), cave: what.cave }) });
  const frame = () => { for (const fn of frames.splice(0)) fn(); };
  return { redraw, frames, runs, frame };
}

test("13 breaks in one region within a frame: one painter rebuild, one cave rebuild", () => {
  const h = harness();
  for (let i = 0; i < 13; i++) h.redraw.soon("R1", { cave: true });
  assert.equal(h.runs.length, 0, "nothing rebuilt before the frame");
  assert.equal(h.frames.length, 1, "one rebuild planned");
  h.frame();
  assert.deepEqual(h.runs, [{ regions: ["R1"], cave: true }]);
  h.frame();
  assert.equal(h.runs.length, 1, "nothing left over");
});

test("breaks in two regions in one frame are one rebuild; the cavern only when a cave region was touched", () => {
  const h = harness();
  for (let i = 0; i < 6; i++) { h.redraw.soon("R1"); h.redraw.soon("R2"); }
  h.frame();
  assert.deepEqual(h.runs, [{ regions: ["R1", "R2"], cave: false }]);
  h.redraw.soon("R3", { cave: false }); h.redraw.soon("R4", { cave: true });
  h.frame();
  assert.deepEqual(h.runs[1], { regions: ["R3", "R4"], cave: true });
});

test("a break after the frame plans the next one; a failing rebuild never stops later ones", () => {
  const frames = [], runs = [];
  let fail = true;
  const redraw = createDecorRedraw({ later: (fn) => frames.push(fn), redraw: (w) => { runs.push([...w.regions]); if (fail) { fail = false; throw new Error("canvas gone"); } } });
  redraw.soon("R1");
  assert.throws(() => frames.shift()());
  redraw.soon("R1");
  assert.equal(frames.length, 1, "planned again");
  frames.shift()();
  assert.deepEqual(runs, [["R1"], ["R1"]]);
  assert.equal(redraw.waiting, false);
  redraw.soon("R2");
  assert.equal(redraw.waiting, true);
});
