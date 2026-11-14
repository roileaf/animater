// The one composition that says which document writes the map's rebuilds may ignore, driven as the real function.
// main.mjs imports it and keeps no copy; this file re-implements none of it. Between them that is the whole of it:
// before, the composition was spelled out in main.mjs where only a source-text regex could reach it, and the test that
// cared most wrote its own copy — so a clause could have been dropped from main.mjs with everything still green.
import test from "node:test";
import assert from "node:assert/strict";
import { quietSave, isClockSave } from "../../../scripts/engines/props/quiet-writes.mjs";
import { SMOKE_NOTE } from "../../../scripts/engines/props/smoke-round.mjs";

const scene = (changes, options) => quietSave({ documentName: "Scene" }, changes, options);
const region = (changes, options, flags = { animater: { smokeRegion: true } }) =>
  quietSave({ documentName: "Region", id: "r", flags }, changes, options);

test("Foundry's clock, saved as a setting, is quiet", () => {
  assert.equal(isClockSave({ key: "core.time" }), true);
  assert.equal(quietSave({ key: "core.time" }), true);
  for (const other of [{ key: "core.combatTheme" }, { key: "" }, {}, null, undefined]) assert.equal(isClockSave(other), false, JSON.stringify(other));
});

test("the smoke round's own scene write is quiet; a GM's scene edit is not", () => {
  assert.equal(scene({ "flags.animater.smoke.33": 1.08, "flags.animater.smokeGrid.cols": 10 }, SMOKE_NOTE), true);
  assert.equal(scene({ "flags.animater.smoke.-=33": null, "flags.animater.-=smokeGrid": null }, SMOKE_NOTE), true);
  // A real edit riding along in the same update, the GM's own switch, and somebody else's write.
  assert.equal(scene({ "flags.animater.smoke.33": 1, width: 2000 }, SMOKE_NOTE), false);
  assert.equal(scene({ "flags.animater.smokeFills": false }, SMOKE_NOTE), false);
  assert.equal(scene({ "flags.animater.smoke.33": 1 }, {}), false, "no note of ours");
  assert.equal(scene({}, SMOKE_NOTE), false);
});

test("the smoke round's own region write is quiet; a GM redrawing one is not", () => {
  assert.equal(region({ _id: "r", shapes: [], levels: [] }, SMOKE_NOTE), true);
  assert.equal(region(SMOKE_NOTE, "user000000000000"), true, "created or deleted, where the options come second");
  assert.equal(region({ _id: "r", shapes: [], name: "Smoke?" }, SMOKE_NOTE), false, "a field the round never writes");
  assert.equal(region({ _id: "r", shapes: [] }, {}), false, "no note");
  assert.equal(region(SMOKE_NOTE, "user000000000000", {}), false, "a region that is not ours, under our note");
});

test("a decoration break's own region write is quiet", () => {
  for (const note of [{ animater: { decorBreak: true } }, { animater: { decorRepair: true } }]) {
    assert.equal(region({ _id: "r", "flags.animater.decorBroken": { a: 1 } }, note), true, JSON.stringify(note));
    assert.equal(region({ _id: "r", "flags.animater.decorBroken": {}, name: "x" }, note), false, "a real edit riding along");
  }
});

test("every clause is load-bearing: a write of one kind is never forgiven by another's reader", () => {
  // A Scene note on a Region write and the other way about: each document kind asks only its own readers.
  assert.equal(region({ "flags.animater.smoke.33": 1 }, SMOKE_NOTE), false, "a scene-shaped change on a region");
  assert.equal(scene({ _id: "r", shapes: [], levels: [] }, SMOKE_NOTE), false, "a region-shaped change on a scene");
  // A kind with no reader at all: never quiet, whatever the note says.
  for (const kind of ["Wall", "Tile", "AmbientLight", "Token", undefined]) {
    assert.equal(quietSave({ documentName: kind }, { shapes: [] }, SMOKE_NOTE), false, String(kind));
  }
  assert.equal(quietSave(null, null, null), false);
  assert.equal(quietSave(), false);
});

test("the composition is pure and tells nothing it is given", () => {
  const changes = { "flags.animater.smoke.33": 1.08 }, options = { animater: { ...SMOKE_NOTE.animater } };
  const before = [JSON.stringify(changes), JSON.stringify(options)];
  assert.equal(scene(changes, options), true);
  assert.equal(scene(changes, options), true);
  assert.deepEqual([JSON.stringify(changes), JSON.stringify(options)], before);
});
