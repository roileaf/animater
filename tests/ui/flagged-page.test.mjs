import test from "node:test";
import assert from "node:assert/strict";
import { flaggedRows, flaggedPageHTML, handleFlaggedAction } from "../../scripts/ui/flagged-page.mjs";
import { PF2E_EFFECTS } from "../../scripts/catalogs/pf2e/state-catalog.mjs";

const bless = PF2E_EFFECTS.find((e) => e.slug === "spell-effect-bless");
const flags = { [bless.id]: { name: bless.name, kind: "effect", flaggedAt: 2000, by: "gm" }, gone: { name: "Effect: Old", kind: "effect", flaggedAt: 1000, by: "" } };

test("the Flagged page lists every flagged look newest first, opening the ones this world still has", () => {
  assert.deepEqual(flaggedRows(flags).map((r) => [r.id, Boolean(r.entry)]), [[bless.id, true], ["gone", false]]);
  const html = flaggedPageHTML({ host: { flaggedLooks: () => flags, userName: (id) => (id === "gm" ? "Gamemaster" : "") } }, { now: 2000 + 5 * 60000 });
  assert.match(html, /2 flagged looks/);
  assert.match(html, /<b title="Spell Effect: Bless">Bless<\/b><small>Effect · flagged 5 min ago by Gamemaster<\/small>/);
  assert.equal((html.match(/data-action="flag-open"/g) ?? []).length, 1, "a look no longer in the catalog cannot open");
  assert.match(html, /no longer in this world's catalog/);
  assert.match(flaggedPageHTML({ host: { flaggedLooks: () => ({}) } }), /Nothing flagged[\s\S]*hold Shift/);
});

test("Open in catalog goes to its catalog page, filtered to flagged, with it selected; Clear and Clear all unflag", async () => {
  const cleared = [];
  const w = { page: "flagged", selectedState: {}, statePages: {}, stateFlaggedOnly: {}, render() {},
    host: { flaggedLooks: () => flags, toggleFlaggedLook: async (e) => cleared.push(e.id), clearFlaggedLooks: async () => cleared.push("all") } };
  assert.equal(await handleFlaggedAction(w, "flag-open", { dataset: { id: bless.id } }), true);
  assert.deepEqual([w.page, w.selectedState.effect, w.stateFlaggedOnly.effect], ["effects", bless.id, true]);
  await handleFlaggedAction(w, "flag-clear", { dataset: { id: bless.id } });
  await handleFlaggedAction(w, "flags-clear-all", { dataset: {} });
  assert.deepEqual(cleared, [bless.id, "all"]);
  assert.equal(await handleFlaggedAction(w, "something-else", { dataset: {} }), false);
});
