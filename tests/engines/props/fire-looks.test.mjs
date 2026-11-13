import test from "node:test";
import assert from "node:assert/strict";
import { warmEdges, charredCells, firePulse } from "../../../scripts/engines/props/fire-looks.mjs";
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
