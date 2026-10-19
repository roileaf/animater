import test from "node:test";
import assert from "node:assert/strict";
import { messageTone } from "../../scripts/ui/workspace.mjs";

test("window messages: errors stay red, things to do first amber, confirmations fade", () => {
  assert.equal(messageTone("Save failed", "Save failed"), "error");
  assert.equal(messageTone("Select a stage first."), "warn");
  assert.equal(messageTone("Open a scene to preview."), "warn");
  assert.equal(messageTone("Recipe saved."), "ok");
  assert.equal(messageTone("Recipe saved.", "Old error"), "ok");
  assert.equal(messageTone(undefined), "ok");
});
