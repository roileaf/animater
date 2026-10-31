import test from "node:test";
import assert from "node:assert/strict";
import { groundElevation, onGroundBelow } from "../../../scripts/engines/playback/ground-elevation.mjs";

const scene = { levels: new Map([["ground", { elevation: { base: 0 } }], ["upper", { elevation: { base: 20 } }]]) };
const token = (elevation, level = "ground") => ({ document: { elevation, level, parent: scene } });

test("a below-token layer sits on the floor under its token, however high it flies", () => {
  assert.equal(groundElevation(token(5)), 0, "flying: the floor of its level");
  assert.equal(groundElevation(token(0)), 0);
  assert.equal(groundElevation(token(30, "upper")), 20, "an upper level's floor");
  assert.equal(groundElevation(token(-5)), -5, "down in a pit: its own elevation");
  assert.equal(groundElevation({ document: { elevation: 10 } }, { elevation: { base: 0 } }), 0, "no level of its own: the viewed one");
  assert.equal(groundElevation(null, null), 0);
});

test("the effect goes below tokens at that elevation, absolute rather than bound to the token", () => {
  const calls = [];
  const effect = { belowTokens: () => calls.push(["below"]), elevation: (value, options) => calls.push(["elevation", value, options]) };
  onGroundBelow(effect, token(5));
  assert.deepEqual(calls, [["below"], ["elevation", 0, { absolute: true }]]);
  calls.length = 0;
  onGroundBelow(effect, null);
  assert.deepEqual(calls, [["below"]], "not on a token: only below tokens");
});
