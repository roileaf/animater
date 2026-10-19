import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// Folder sources sits at the left of the Assets toolbar: a panel anchored to its right edge grew
// leftwards, under Foundry's sidebar, in narrower windows (issue #3).
test("the Sources panel opens leftwards from its button at the toolbar's right end and fits the window", async () => {
  const css = await readFile(new URL("../../../styles/media-library.css", import.meta.url), "utf8");
  const rule = css.match(/\.an-media-source-panel\s*\{([^}]*)\}/)?.[1] ?? "";
  assert.match(rule, /(?:^|;)\s*right:\s*0\s*;/, "anchored at the button's right edge, so it never runs off the window");
  assert.doesNotMatch(rule, /(?:^|;)\s*left:\s*0\s*;/);
  assert.match(rule, /width:\s*min\(360px,\s*calc\(100vw - 48px\)\)/);
});
