import test from "node:test";
import assert from "node:assert/strict";
import { isLastingArea } from "../../scripts/engines/playback/lasting-area.mjs";

const spell = (name, duration, description = "", extra = {}) => ({ type: "spell", name, system: { duration: { value: duration, ...extra }, description: { value: description }, area: { type: "burst" } } });

test("sustained area spells and areas that keep acting stay on the map, whatever their name", () => {
  assert.ok(isLastingArea(spell("Pernicious Poltergeist", "sustained up to 1 minute", "", { sustained: true })));
  assert.ok(isLastingArea(spell("Odd Name", "1 minute", "<p>A creature that enters or starts its turn in the area takes 2d6 damage.</p>")));
  assert.ok(!isLastingArea(spell("Slow", "1 minute", "<p>The targets are slowed.</p>")), "affects creatures once");
  assert.ok(!isLastingArea(spell("Fireball", "", "")), "instant");
  assert.ok(isLastingArea(spell("Darkness", "1 minute")), "standing areas by name still stay");
});


import { withLastingArea } from "../../scripts/engines/playback/lasting-area.mjs";
const darknessRecipe = () => ({ id: "d", stages: [
  { stageId: "cast", kind: "cast", assets: ["jb2a.smoke.puff.centered.dark_purple"] },
  { stageId: "area", kind: "template", assets: ["jb2a.darkness.black"], delay: 200 },
  { stageId: "puff", kind: "template", assets: ["jb2a.smoke.puff.centered.dark_purple"] },
] });
const darkness = spell("Darkness", "1 minute");

test("a lasting Darkness keeps its own looping clip", () => {
  const r = withLastingArea(darknessRecipe(), { template: {}, item: darkness }, { exists: () => true });
  assert.deepEqual(r.stages.filter((s) => s.persist).map((s) => s.assets[0]), ["jb2a.darkness.black"]);
});
