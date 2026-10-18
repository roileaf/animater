import test from "node:test";
import assert from "node:assert/strict";
import { catalogNameHTML, openCatalogDetails } from "../../../scripts/catalogs/shared/catalog-details.mjs";
import { PF2E_SPELLS } from "../../../scripts/catalogs/pf2e/spells/spell-catalog.mjs";
import { PF2E_FEATS } from "../../../scripts/catalogs/pf2e/feats/feat-catalog.mjs";
import { PF2E_WEAPONS } from "../../../scripts/catalogs/pf2e/weapons/weapon-catalog.mjs";

const entries = [
  ["spell", PF2E_SPELLS.find(s => s.name === "Fireball")],
  ["feat", PF2E_FEATS.find(f => f.slug === "twin-takedown")],
  ["weapon", PF2E_WEAPONS.find(w => w.slug === "acid-flask-lesser")],
];

test("standalone catalog never replaces native item sheets with internal rule dialogs", async () => {
  const w = {
    host: { environment: () => ({ demo: true }), resolveItem: async () => null },
    root: {
      querySelector: () => null,
      ownerDocument: { createElement: () => assert.fail("Internal details UI must never be created") },
    },
  };
  for (const [kind, item] of entries) {
    await assert.rejects(openCatalogDetails(w, kind, item.id), /inside Foundry/);
    const html = catalogNameHTML(item, kind, { demo: true });
    assert.match(html, /disabled/);
    assert.match(html, /data-tooltip="Item details open inside Foundry"/);
  }
});

test("missing compendium documents report unavailable native sheet without an internal fallback", async () => {
  const w = {
    host: { environment: () => ({ demo: false }), resolveItem: async () => null },
    root: { ownerDocument: { createElement: () => assert.fail("Internal details UI must never be created") } },
  };
  for (const [kind, item] of entries)
    await assert.rejects(openCatalogDetails(w, kind, item.id), /compendium entry.*unavailable/);
});
