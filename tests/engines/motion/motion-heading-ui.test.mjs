import test from "node:test";
import assert from "node:assert/strict";
import { validateRecipe, parseImport } from "../../../scripts/core/model.mjs";
import { Workspace } from "../../../scripts/ui/workspace.mjs";

const recipe = heading => validateRecipe({ id: "heading", name: "Heading", trigger: "manual", stages: [{ kind: "motion", motion: "rush", motionRange: "distance", motionHeading: heading, duration: 2500 }] });

test("path headings survive recipe import and invalid headings use toward", () => {
  for (const heading of ["toward", "away", "up", "down", "left", "right"]) {
    const normalized = recipe(heading);
    assert.equal(normalized.stages[0].motionHeading, heading);
    assert.equal(parseImport(JSON.stringify({ schema: 1, recipes: [normalized] }))[0].stages[0].motionHeading, heading);
  }
  assert.equal(recipe("unsupported").stages[0].motionHeading, "toward");
});

test("path editor exposes selected heading and clear map-direction labels", () => {
  const html = Workspace.prototype.motionControlsHTML(recipe("away").stages[0], 0);
  assert.match(html, /data-field="motionHeading"/);
  assert.match(html, /value="away" selected/);
  for (const label of ["Toward selected token", "Away from selected token", "Upward on map", "Downward on map", "Leftward on map", "Rightward on map"]) assert.ok(html.includes(label));
});

test("the End (hold) choice shows only while editing a finisher", () => {
  const r = recipe("away"), s = r.stages[0];
  assert.doesNotMatch(Workspace.prototype.motionControlsHTML(s, 0, r), /data-field="motionEnd"/);
  assert.doesNotMatch(Workspace.prototype.motionControlsHTML(s, 0), /data-field="motionEnd"/);
  assert.match(Workspace.prototype.motionControlsHTML(s, 0, { ...r, finisher: { on: "kill" } }), /data-field="motionEnd"/);
  assert.match(Workspace.prototype.motionControlsHTML(s, 0, { ...r, finisher: { on: "kill" } }), /moves the token there/, "a finisher's hint says the token really moves");
});
