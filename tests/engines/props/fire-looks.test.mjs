import test from "node:test";
import assert from "node:assert/strict";
import { warmEdges, charredCells, litCells, firePulse, fireSteady, createFireLooks, PULSE_QUIET_MS } from "../../../scripts/engines/props/fire-looks.mjs";
import { HEAT_WARN, HEAT_CATCH } from "../../../scripts/engines/props/fire-spread.mjs";

test("the edge shows on what is smouldering and on nothing else", () => {
  const things = [
    { id: "cold", fire: null },
    { id: "warm", fire: { heat: HEAT_WARN, burning: false, roundsLeft: 0 } },
    { id: "hot", fire: { heat: (HEAT_WARN + HEAT_CATCH) / 2, burning: false, roundsLeft: 0 } },
    { id: "cool", fire: { heat: HEAT_WARN - 1, burning: false, roundsLeft: 0 } },
    { id: "alight", fire: { heat: HEAT_CATCH, burning: true, roundsLeft: 3 } },
  ];
  const edges = warmEdges(things);
  assert.deepEqual(edges.map((e) => e.id), ["warm", "hot"]); // not the cold, the barely warm or the one already alight
  assert.equal(edges[0].heat, 0); // just warned
  assert.equal(edges[1].heat, 0.5); // half way to catching
  assert.deepEqual(warmEdges(), []);
  // A thing whose fire was deleted (its key gone) shows nothing.
  assert.deepEqual(warmEdges([{ id: "gone", fire: undefined }]), []);
});

test("the pulse swells, stays in bounds, and quickens as it nears catching", () => {
  for (const heat of [0, 0.5, 1]) {
    for (let ms = 0; ms < 4000; ms += 37) {
      const v = firePulse(ms, heat);
      assert.ok(v >= 0 && v <= 1, `pulse ${v}`);
    }
  }
  // Hotter is brighter at the top of the swell, and the swell comes round sooner.
  const peak = (heat, period) => firePulse(period / 4, heat);
  assert.ok(peak(1, 900) > peak(0, 1600));
  assert.ok(Math.abs(firePulse(0, 0) - firePulse(1600, 0)) < 1e-9); // a full turn of the slow pulse
  assert.ok(Math.abs(firePulse(0, 1) - firePulse(900, 1)) < 1e-9); // and of the quick one
});

test("only the burnt grass squares are scorched ground", () => {
  const saved = { 3: { charred: true, heat: 0, burning: false }, 4: { heat: 60, burning: false }, 9: { burning: true, heat: 100 }, 11: { charred: true } };
  assert.deepEqual(charredCells(saved), [3, 11]);
  assert.deepEqual(charredCells({}), []);
  assert.deepEqual(charredCells(null), []);
  assert.deepEqual(charredCells({ nope: { charred: true } }), []); // a key that is not a square index
});

test("burning grass has something to see: flames on what is alight, the ember edge on what is warming", () => {
  const saved = {
    2: { heat: HEAT_CATCH, burning: true, roundsLeft: 2 },
    3: { heat: HEAT_WARN, burning: false, roundsLeft: 0 },
    4: { heat: (HEAT_WARN + HEAT_CATCH) / 2, burning: false, roundsLeft: 0 },
    5: { heat: HEAT_WARN - 1, burning: false, roundsLeft: 0 }, // barely warm: nothing yet
    6: { charred: true, heat: 0, burning: false, roundsLeft: 0 }, // burnt out: only its scorch
    7: null,
  };
  const lit = litCells(saved);
  assert.deepEqual(lit.map((c) => c.i), [2, 3, 4]);
  assert.equal(lit[0].burning, true);
  assert.equal(lit[0].heat, 1);
  assert.equal(lit[1].burning, false);
  assert.equal(lit[1].heat, 0); // just warned, as a prop's edge is
  assert.equal(lit[2].heat, 0.5);
  // A square that is alight is never also scorched ground, and a charred one is never alight.
  assert.deepEqual(charredCells(saved), [6]);
  assert.deepEqual(litCells({}), []);
  assert.deepEqual(litCells(null), []);
  assert.deepEqual(litCells({ nope: { burning: true } }), []); // a key that is not a square index
});

test("a fire that has stopped changing settles: the edge stays, the frame loop does not", () => {
  // The painted frame, the clock and the animation frames are all this test's own.
  const frames = [];
  const realRaf = globalThis.requestAnimationFrame, realCancel = globalThis.cancelAnimationFrame;
  globalThis.requestAnimationFrame = (fn) => { frames.push(fn); return frames.length; };
  globalThis.cancelAnimationFrame = () => {};
  const art = () => { const g = { calls: 0, clear() { this.calls++; return this; }, lineStyle() { return this; }, beginFill() { return this; }, endFill() { return this; }, drawPolygon() { return this; }, destroy() {} }; return g; };
  const made = [];
  const PIXI = { Container: class { constructor() { this.children = []; this.parent = null; } addChild(c) { this.children.push(c); c.parent = this; } destroy() {} },
    Graphics: class { constructor() { Object.assign(this, art()); made.push(this); } } };
  let clock = 0;
  const root = new PIXI.Container();
  const looks = createFireLooks({ PIXI, layer: () => root, floor: () => root, grid: () => 100, now: () => clock });
  const warm = [{ id: "crate", heat: 0.5, rotation: 0, rect: { x: 0, y: 0, w: 100, h: 100 } }];
  looks.sync({ edges: warm });
  assert.equal(frames.length, 1, "the swell starts");
  // The same heat, over and over: a prop left warm by a fire long out never changes again.
  const step = () => { const fn = frames.shift(); clock += 16; if (fn) fn(); };
  for (let i = 0; i < 100; i++) step(); // a second and a half of frames, well inside the quiet window
  assert.ok(frames.length > 0, "it breathes while it is new");
  clock = PULSE_QUIET_MS + 1;
  step();
  assert.equal(frames.length, 0, "and stops once nothing has changed for a while");
  // The edge is still drawn: the last frame was painted, at the still glow.
  const edgeArt = made[1];
  assert.ok(edgeArt.calls > 0, "the edge was painted");
  // Something new (hotter, or another thing warming) wakes it again.
  looks.sync({ edges: [{ ...warm[0], heat: 0.8 }] });
  assert.equal(frames.length, 1, "a change wakes the swell");
  globalThis.requestAnimationFrame = realRaf;
  globalThis.cancelAnimationFrame = realCancel;
});

test("the still glow is the middle of the swell", () => {
  for (const heat of [0, 0.3, 1]) {
    const still = fireSteady(heat);
    let low = Infinity, high = -Infinity;
    for (let ms = 0; ms < 4000; ms += 1) { const v = firePulse(ms, heat); low = Math.min(low, v); high = Math.max(high, v); }
    assert.ok(still > low && still < high, `settled ${still} inside ${low}..${high}`);
    assert.ok(Math.abs(still - (low + high) / 2) < 1e-3, `settled ${still} is the middle of ${low}..${high}`);
  }
});
