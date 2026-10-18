import test from "node:test";
import assert from "node:assert/strict";
import { installedSoundCatalog } from "../../../scripts/engines/sound/spell-sounds.mjs";

test("PSFX Patreon (psfx-patreon) counts as PSFX for catalog sounds", () => {
  const database = { entryExists: () => true, getAllFileEntries: () => [] };
  const only = (id) => ({ get: (m) => (m === id ? { active: true } : undefined) });
  assert.ok(installedSoundCatalog(only("psfx-patreon"), database).packs.some((p) => p.module === "psfx"));
  assert.ok(installedSoundCatalog(only("psfx"), database).packs.some((p) => p.module === "psfx"));
  assert.ok(!installedSoundCatalog(only("ggg"), database).packs.some((p) => p.module === "psfx"));
});
