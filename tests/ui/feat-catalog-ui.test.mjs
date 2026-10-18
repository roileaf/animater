import test from "node:test";
import assert from "node:assert/strict";
import { featCatalogHTML } from "../../scripts/ui/feat-catalog-ui.mjs";
import { PF2E_FEATS, featRecipe, useCatalogFeat } from "../../scripts/catalogs/pf2e/feats/feat-catalog.mjs";

function view(feat, state = {}, recipes = [], environment = {}) {
  return featCatalogHTML({
    featFilters: { search: feat.name, level: "all", activity: "all", category: "all", classTrait: "all", theme: "all", quality: "all" },
    selectedFeat: feat.id, featPage: 0, busy: false,
    recipePreviewHTML: () => "<div data-recipe-scene></div>",
    previewDuration: () => 1500,
    host: {
      featCatalogState: () => state, recipes: () => recipes, enabled: () => false,
      environment: () => ({ systemId: "pf2e", ready: true, motionReady: true, ...environment }),
    },
  });
}

test("feat catalog exposes native activation, full highlighted previews and direct use plus customization", () => {
  const feat = PF2E_FEATS.find((f) => f.slug === "sudden-charge");
  const html = view(feat);
  assert.match(html, /data-action="use-feat" class="an-primary" >Use animation/);
  assert.match(html, /data-action="copy-feat" class="an-quiet" >Customize/);
  assert.match(html, /data-search="feats"/);
  assert.match(html, /data-feat-filter="classTrait"/);
  assert.match(html, /data-stage-drag="0"/);
  assert.match(html, /data-recipe-progress/);
  assert.match(html, /Only this feat's own card/);
  assert.match(html, /data-action="item-details" data-kind="feat"/);
  assert.match(html, /aria-label="Open Sudden Charge details"/);
  assert.doesNotMatch(html, /Ability description|data-options-group="feat-description"/);
  assert.match(html, /Passive bonuses/);
  assert.match(html, /BUILT-IN FEAT · CURATED/);
  assert.doesNotMatch(html, /data-action="catalog-auto"|data-action="use-spell"/);
});

test("feat opt-in status works with global saved automation off; customization priority is visible", () => {
  const feat = PF2E_FEATS.find((f) => f.slug === "sudden-charge"), recipe = featRecipe(feat);
  assert.match(view(feat, useCatalogFeat({}, feat.id)), /Using catalog animation/);
  const html = view(feat, { enabled: true, independent: true, scope: "all", customized: [feat.id] }, [recipe]);
  assert.match(html, /Customized recipe takes priority/);
  assert.match(html, /Edit customization/);
});

test("feat controls cannot claim automatic configuration in preview or another system", () => {
  const feat = PF2E_FEATS.find((f) => f.slug === "sudden-charge");
  for (const env of [{ demo: true }, { systemId: "dnd5e" }, { ready: false }]) {
    const html = view(feat, {}, [], env);
    assert.match(html, /data-action="use-feat" class="an-primary" disabled/);
    assert.match(html, /data-action="feat-auto" disabled/);
  }
});
