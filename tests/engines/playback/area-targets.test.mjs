// Who a placed area catches. Its creature stages (an impact on each target) used to play for whoever the user had
// targeted when the area was set down, and systems and modules that target what a template covers do it a moment
// later: the stage found no one and was skipped (reported with a D&D 5e cone whose Target stage never played).
import test from "node:test";
import assert from "node:assert/strict";
import { areaTargets, tokenSamples } from "../../../scripts/engines/playback/area-targets.mjs";

const token = (id, x, y, squares = 1, extra = {}) => ({ id, center: { x: x + squares * 50, y: y + squares * 50 }, w: squares * 100, h: squares * 100, document: { x, y, width: squares, height: squares, elevation: 0, hidden: false, ...extra } });
// A square area from (0,0) to (300,300).
const inside = (p) => p.x >= 0 && p.x < 300 && p.y >= 0 && p.y < 300;
const caster = token("caster", 0, 0), near = token("near", 100, 100), far = token("far", 600, 600), hidden = token("hidden", 200, 0, 1, { hidden: true });
const all = [caster, near, far, hidden];
const ids = (list) => list.map((t) => t.id);

test("with no one targeted, the area's stages play for every creature in it but the caster and the hidden", () => {
  assert.deepEqual(ids(areaTargets({ tokens: all, userTargets: [], source: caster, inside })), ["near"]);
});

test("targets left over from before, outside the area, are not its targets", () => {
  assert.deepEqual(ids(areaTargets({ tokens: all, userTargets: [far], source: caster, inside })), ["near"]);
});

test("targets chosen inside the area are kept as chosen", () => {
  const second = token("second", 200, 200);
  assert.deepEqual(ids(areaTargets({ tokens: [...all, second], userTargets: [second, far], source: caster, inside })), ["second"]);
});

test("a big creature is caught by any of its squares", () => {
  const ogre = token("ogre", 200, 200, 2);
  assert.equal(inside(ogre.center), false, "its middle is outside");
  assert.deepEqual(tokenSamples(ogre, 100), [{ x: 250, y: 250 }, { x: 350, y: 250 }, { x: 250, y: 350 }, { x: 350, y: 350 }]);
  assert.deepEqual(ids(areaTargets({ tokens: [caster, ogre], userTargets: [], source: caster, inside, gridSize: 100 })), ["ogre"]);
});

test("an area that catches no one has no targets; one that cannot be read keeps the user's", () => {
  assert.deepEqual(areaTargets({ tokens: [caster, far], userTargets: [], source: caster, inside }), []);
  assert.deepEqual(ids(areaTargets({ tokens: all, userTargets: [far], source: caster, inside: null })), ["far"]);
  assert.deepEqual(ids(areaTargets({ tokens: all, userTargets: [far], source: caster, inside: () => { throw Error("no shape yet"); } })), ["far"]);
});
