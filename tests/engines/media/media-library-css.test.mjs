import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// Folder sources sits at the left of the Assets toolbar: a panel anchored to its right edge grew
// leftwards, under Foundry's sidebar, in narrower windows (issue #3).
test("the Folder sources panel opens rightwards from its button and fits the library", async () => {
  const css = await readFile(new URL("../../../styles/media-library.css", import.meta.url), "utf8");
  const rule = css.match(/\.an-media-source-panel\s*\{([^}]*)\}/)?.[1] ?? "";
  assert.match(rule, /(?:^|;)\s*left:\s*0\s*;/, "anchored at the button's left edge");
  assert.doesNotMatch(rule, /(?:^|;)\s*right:\s*0\s*;/);
  assert.match(rule, /width:\s*min\(400px,\s*calc\(100cqw - 188px/, "never wider than the library beside the 188px sidebar");
});
