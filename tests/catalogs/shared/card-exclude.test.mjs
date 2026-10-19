import test from "node:test";
import assert from "node:assert/strict";
import { Workspace } from "../../../scripts/ui/workspace.mjs";
import { cardExcludeHTML } from "../../../scripts/catalogs/shared/catalog-details.mjs";
import { PF2E_SPELLS } from "../../../scripts/catalogs/pf2e/spells/spell-catalog.mjs";
const [card, selectedSpell] = PF2E_SPELLS.slice(0, 2).map((s) => s.id);

function spellsWorkspace(excluded = []) {
  const w = Object.create(Workspace.prototype);
  let state = { enabled: true, scope: "all", excluded, selected: [], customized: [] };
  Object.assign(w, {
    page: "spells", selectedSpell, busy: false, message: "", drafts: new Map(), dirty: new Set(),
    root: { querySelectorAll: () => [], querySelector: () => null },
    host: {
      environment: () => ({ ready: true, systemId: "pf2e" }),
      catalogState: () => state,
      setCatalogState: async (change) => { state = { ...state, ...change }; },
      recipes: () => [],
    },
  });
  w.render = () => {};
  const click = (dataset) => w.onClick({ target: { closest: () => ({ dataset, disabled: false }) }, preventDefault() {} });
  return { w, click, state: () => state };
}

test("a card's exclude toggle excludes that card, not the selected entry", async () => {
  const f = spellsWorkspace();
  await f.click({ action: "catalog-exclude", id: card });
  assert.deepEqual(f.state().excluded, [card]);
  await f.click({ action: "catalog-exclude", id: card });
  assert.deepEqual(f.state().excluded, [], "clicking again includes it");
  await f.click({ action: "catalog-exclude" });
  assert.deepEqual(f.state().excluded, [selectedSpell], "the detail-panel button still toggles the selection");
});

test("card toggle markup reflects the excluded state", () => {
  const off = cardExcludeHTML("weapon-exclude", { id: "longsword", name: "Longsword" }, false);
  assert.match(off, /data-action="weapon-exclude" data-id="longsword" aria-pressed="false"/);
  assert.match(off, /aria-label="Leave Longsword out of Plug &amp; play"/);
  const on = cardExcludeHTML("weapon-exclude", { id: "longsword", name: "Longsword" }, true);
  assert.match(on, /class="an-card-exclude is-on"/);
  assert.match(on, /aria-label="Put Longsword back in Plug &amp; play"/);
});

test("with plug & play off or picked-only, a card's ✓ adds and removes just that entry", async () => {
  const f = spellsWorkspace();
  const setState = (s) => { f.w.host.setCatalogState({ ...s }); };
  setState({ enabled: false, scope: "all", selected: [], excluded: [] });
  await f.click({ action: "card-include", id: card });
  assert.equal(f.state().enabled, true);
  assert.equal(f.state().scope, "selected", "only picked entries play");
  assert.deepEqual(f.state().selected, [card]);
  await f.click({ action: "card-include", id: card });
  assert.deepEqual(f.state().selected, [], "clicking again removes it");
  assert.equal(f.state().scope, "selected");
});

test("cards show exclude while the whole catalog runs, include otherwise", async () => {
  const { cardToggleHTML, cardSlotClass } = await import("../../../scripts/catalogs/shared/catalog-details.mjs");
  const item = { id: "x1", name: "Shield" };
  const all = { enabled: true, scope: "all", excluded: ["x1"], selected: [] };
  assert.match(cardToggleHTML(all, "catalog-exclude", "card-include", item), /an-card-exclude is-on/);
  assert.equal(cardSlotClass(all, "x1"), " is-excluded");
  const picked = { enabled: true, scope: "selected", excluded: [], selected: ["x1"] };
  assert.match(cardToggleHTML(picked, "catalog-exclude", "card-include", item), /an-card-include is-on[^>]*data-action="card-include"/);
  assert.equal(cardSlotClass(picked, "x1"), " is-included");
  const off = { enabled: false, scope: "all", excluded: [], selected: [] };
  assert.match(cardToggleHTML(off, "catalog-exclude", "card-include", item), /class="an-card-include"/);
});
