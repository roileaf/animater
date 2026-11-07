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

test('an area is drawn as high as the highest of those in it, and only when someone is off the floor', async () => {
  const { areaElevation } = await import('../../../scripts/engines/playback/ground-elevation.mjs');
  const token = (elevation, parent) => ({ document: { elevation, level: 'L', parent } });
  assert.equal(areaElevation({ source: token(0), targets: [] }, null), null, 'on the floor: left alone');
  assert.equal(areaElevation({ source: token(30), targets: [] }, null), 30, 'a raised caster');
  assert.equal(areaElevation({ source: token(0), targets: [token(20), token(5)] }, null), 20, 'a raised creature caught in it');
  assert.equal(areaElevation({ targets: [] }, null), null, 'nobody at all');
  const scene = { levels: new Map([['L', { elevation: { base: 10, top: 25 } }], ['M', { elevation: { base: 25, top: 50 } }]]) };
  assert.equal(areaElevation({ source: token(10, scene), targets: [] }, null), null, 'on the floor of an upper level');
  assert.equal(areaElevation({ source: token(40, scene), targets: [] }, null), 25, 'kept to its level, or Sequencer would hide it');
  const single = { levels: new Map([['L', { elevation: { base: 0, top: 20 } }]]) };
  assert.equal(areaElevation({ source: token(30, single), targets: [] }, null), 30, 'one level hides nothing: as high as the flier, or it draws under it');
});
