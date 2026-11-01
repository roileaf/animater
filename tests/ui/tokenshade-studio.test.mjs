import test from "node:test";
import assert from "node:assert/strict";
import { TokenshadeStudio, TOKENSHADE_PAGE, studioStage, stageForRecipe } from "../../scripts/ui/tokenshade-studio.mjs";

const glow = { name: "glow", library: "tokenshade", params: [{ filterType: "glow", outerStrength: 4 }] };
const workspace = (over = {}) => {
  const saved = [], recipes = [{ id: "r1", name: "Ember shot", stages: [{ stageId: "stage-1", kind: "impact" }] }];
  const w = {
    page: TOKENSHADE_PAGE, root: { querySelector: () => null }, drafts: new Map(), saved, rendered: 0,
    render() { this.rendered++; }, listedRecipes: () => recipes,
    edit() { if (!this.drafts.has(this.selected)) this.drafts.set(this.selected, structuredClone(recipes.find((r) => r.id === this.selected))); return this.drafts.get(this.selected); },
    host: {
      fxCatalog: () => ({ tokenReady: true, presets: [{ name: "glow", library: "tokenshade" }, { name: "Mine", library: "animater-custom" }] }),
      tokenFxPreset: (library, name) => (name === "glow" ? glow : null),
      saveTokenFxPreset: async (name, layers) => saved.push({ name, layers }),
    },
    ...over,
  };
  return w;
};

test("the page lists a library's presets, old library ids included, and starts on the first", () => {
  const w = workspace(), studio = new TokenshadeStudio(w);
  assert.match(studio.html(), /data-name="glow"/);
  assert.equal(studio.draft.fxPreset, "glow");
  studio.library = "tokenshade-custom"; studio.draft = null;
  assert.match(studio.html(), /data-name="Mine"/);
});

test("an edit works on a copy; Save as my preset stores its layers", async () => {
  const w = workspace(), studio = new TokenshadeStudio(w);
  studio.html();
  const input = { type: "range", value: "9", dataset: { field: "fxLayer", index: "studio", layer: "0", key: "outerStrength" }, nextElementSibling: null };
  assert.equal(studio.input(input), true);
  assert.equal(studio.draft.fxLayers[0].outerStrength, 9);
  assert.equal(glow.params[0].outerStrength, 4, "the built-in preset never changes");
  w.root = { querySelector: (s) => (s.includes("fx-preset-name") ? { value: "Bright glow" } : null) };
  await studio.action("fx-preset-save", { dataset: { index: "studio" } });
  assert.equal(w.saved[0].name, "Bright glow");
  assert.equal(w.saved[0].layers[0].outerStrength, 9);
  assert.equal(studio.library, "tokenshade-custom");
});

test("Add to animation puts a full token filter stage into the recipe and opens it", async () => {
  const w = workspace(), studio = new TokenshadeStudio(w);
  studio.html();
  w.root = { querySelector: (s) => (s.includes('data-studio="recipe"') ? { value: "r1" } : null) };
  await studio.action("studio-add", { dataset: {} });
  const r = w.drafts.get("r1"), stage = r.stages.at(-1);
  assert.equal(stage.kind, "tokenfx"); assert.equal(stage.fxPreset, "glow"); assert.equal(stage.duration, 3000);
  assert.equal(stage.stageId, "stage-2", "a stage id the recipe does not use yet");
  assert.equal(w.page, "recipes"); assert.equal(w.selected, "r1"); assert.equal(w.studio, true); assert.equal(w.stageIndex, 1);
});

test("an edited copy goes into a recipe as its own layers", () => {
  const draft = { ...studioStage("tokenshade", "glow"), fxLayers: [{ filterType: "glow", outerStrength: 9 }], fxSpeed: 2 };
  const stage = stageForRecipe(draft, glow);
  assert.deepEqual(stage.fxLayers, [{ filterType: "glow", outerStrength: 9 }]);
  assert.equal(stage.fxSpeed, 2);
  assert.equal(stageForRecipe(studioStage("tokenshade", "glow"), glow).fxLayers, undefined, "unedited: the preset by name");
});
test('a valued condition\'s stronger steps sit with the condition; place looks have their own section', async () => {
  const { presetGroup } = await import('../../scripts/ui/tokenshade-studio.mjs');
  for (const n of ['Dying', 'Dying 4', 'Trembling 3', 'Wounded 2']) assert.equal(presetGroup(n, []), 'Conditions', n);
  for (const n of ['Haunted ground', 'Heat shimmer', 'Cold mist']) assert.equal(presetGroup(n, []), 'Places', n);
});
