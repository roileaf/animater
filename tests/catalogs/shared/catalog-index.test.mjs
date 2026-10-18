import test from "node:test";
import assert from "node:assert/strict";
import { catalogIndex, installedAssets, resolveAsset } from "../../../scripts/core/model.mjs";

// Catalog order is the runtime's (localeCompare), which differs from code-unit order.
const catalog = [
  { key: "jb2a.explosion.01.orange" },
  { key: "jb2a.explosion.01.Blue" },
  { key: "jb2a.explosion.01.blue" },
  { key: "jb2a.fire_bolt.orange" },
  { key: "jb2a.fire_bolt" },
  { key: "jb2a.misty_step.01.blue" },
].map((e) => ({ ...e, file: `${e.key}.webm` }));
const stages = [
  { kind: "cast", assets: ["jb2a.fire_bolt.orange"] },
  { kind: "cast", assets: ["jb2a.explosion.01"] },
  { kind: "cast", assets: ["jb2a.explosion"] },
  { kind: "cast", assets: ["jb2a.fire_bolt"] },
  { kind: "cast", assets: ["jb2a.missing", "jb2a.misty_step.01"] },
  { kind: "cast", assets: ["jb2a.missing"] },
  { kind: "cast", assets: ["modules/x/art/thing.webm"] },
  { kind: "cast", assets: ["jb2a.misty_step.01", "jb2a.misty_step.01.blue", "jb2a.fire_bolt"] },
  { kind: "motion", assets: [] },
  { kind: "cast", assets: ["jb2a.explosion.01.b"] },
  { kind: "cast", assets: [] },
];

test("a catalog index resolves every asset exactly as the plain catalog does", () => {
  const index = catalogIndex(catalog);
  for (const stage of stages) {
    assert.deepEqual(installedAssets(stage, index), installedAssets(stage, catalog), stage.assets.join(","));
    assert.equal(resolveAsset(stage, index), resolveAsset(stage, catalog), stage.assets.join(","));
    assert.deepEqual(installedAssets(stage, index, 1), installedAssets(stage, catalog, 1));
  }
});

test("a prefix picks the first match in catalog order, not alphabetical order", () => {
  const index = catalogIndex(catalog);
  assert.equal(resolveAsset({ kind: "cast", assets: ["jb2a.explosion.01"] }, index), "jb2a.explosion.01.orange");
});

test("an empty catalog index resolves nothing but file paths", () => {
  const index = catalogIndex([]);
  assert.equal(resolveAsset({ kind: "cast", assets: ["jb2a.fire_bolt"] }, index), null);
  assert.equal(resolveAsset({ kind: "cast", assets: ["art/thing.webm"] }, index), resolveAsset({ kind: "cast", assets: ["art/thing.webm"] }, []));
});
