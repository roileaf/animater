import test from "node:test";
import assert from "node:assert/strict";
import { findCatalogSpell, LEGACY_SPELLS } from "../../scripts/catalogs/pf2e/spells/spell-catalog.mjs";

const find = (name) => findCatalogSpell({ type: "use", item: { type: "spell", name } })?.name;

test("a pre-Remaster spell name plays the spell it became", () => {
  assert.equal(find("Produce Flame"), "Ignition");
  assert.equal(find("Dancing Lights"), "Light");
  assert.equal(find("Magic Missile"), "Force Barrage");
  assert.equal(find("Remove Curse"), "Cleanse Affliction");
});

test("every legacy name points at a spell the catalog has", () => {
  for (const [legacy, remaster] of Object.entries(LEGACY_SPELLS)) assert.ok(find(remaster), `${legacy} → ${remaster}`);
});

test("notes in a spell's name are not part of it", () => {
  assert.equal(find("Dragon Breath (Gold)"), "Dragon Breath");
  assert.equal(find("Detect Alignment (At Will) (Evil Only)"), "Detect Magic");
  assert.equal(find("Slow (2/day)"), "Slow");
});

test("an unknown spell still finds nothing", () => {
  assert.equal(find("Spell Nobody Wrote"), undefined);
});
