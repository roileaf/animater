import test from "node:test";
import assert from "node:assert/strict";
import { PF2E_SPELLS, spellRecipe } from "../../../scripts/catalogs/pf2e/spells/spell-catalog.mjs";
import { Workspace } from "../../../scripts/ui/workspace.mjs";
import { planRecipe } from "../../../scripts/core/model.mjs";
import { chainPreview } from "../../../scripts/engines/preview/chain-preview.mjs";
import { RecipePreview } from "../../../scripts/engines/preview/recipe-preview.mjs";
import { recipeFrame, recipeDuration } from "../../../scripts/engines/playback/choreography.mjs";
const spell = PF2E_SPELLS.find((s) => s.name === "Chain Lightning");
const dbFor = (r) =>
  r.stages.flatMap((s) =>
    s.assets.map((key) => ({ key, file: `${key}.webm` })),
  );
test("fallback Chain Lightning jumps from each creature to the next even without semantic metadata", () => {
  const r = spellRecipe({ ...spell, design: undefined });
  const source = { id: "caster" },
    targets = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const beams = planRecipe(r, dbFor(r), { source, targets }).filter(
    (s) => s.kind === "travel",
  );
  assert.deepEqual(
    beams.map((s) => [s.origin.id, s.endpoint.id]),
    [
      ["caster", "a"],
      ["a", "b"],
      ["b", "c"],
    ],
  );
});
test("full chain composition renders separate target hops instead of one caster-to-target preview", () => {
  const r = spellRecipe(spell),
    w = Object.create(Workspace.prototype);
  w.host = { catalog: () => dbFor(r) };
  const html = w.recipePreviewHTML(r, {});
  assert.equal((html.match(/data-preview-token="targets"/g) ?? []).length, 3);
  assert.match(html, /data-preview-from="target-0" data-preview-to="target-1"/);
  assert.match(html, /data-preview-from="target-1" data-preview-to="target-2"/);
});

test("chain composition preserves selected target order and all native hop timings", () => {
  const r = spellRecipe(spell),
    tokens = {
      targetList: [
        { id: "z", name: "Z" },
        { id: "a", name: "A" },
      ],
    };
  const preview = chainPreview(r, tokens);
  assert.deepEqual(
    preview.actors.slice(1).map((a) => a.token.id),
    ["z", "a"],
  );
  const places = preview.actors.map((a) => ({
    ...a,
    center: { x: a.x * 4, y: a.y * 3 },
    w: 54,
    h: 54,
  }));
  const native = planRecipe(r, dbFor(r), {
    source: places[0],
    targets: places.slice(1),
    gridSize: 100,
    random: () => 0.5,
  });
  const routing = (s) => [
    s.index,
    s.kind,
    s.delay,
    s.duration,
    s.targetIndex,
    s.origin?.id,
    s.endpoint?.id,
  ];
  assert.deepEqual(
    preview.recipe.playbackPlan.map(routing),
    native.map(routing),
  );
  assert.equal(
    recipeDuration(preview.recipe),
    Math.max(...native.map((s) => s.delay + s.duration)),
  );
  const many = chainPreview(r, {
    targetList: Array.from({ length: 8 }, (_, i) => ({ id: String(i) })),
  });
  assert.equal(many.actors.length, 7);
  assert.match(many.note, /first 6 shown/);
});

test("chain editor plays each routed beam and token reaction at its own staggered time", () => {
  const r = spellRecipe(spell),
    chain = chainPreview(r),
    plan = chain.recipe.playbackPlan;
  const layers = plan.flatMap((s, i) =>
    s.kind === "motion"
      ? []
      : [
          {
            dataset: {
              layerStage: String(s.index),
              previewPlan: String(i),
              previewFrom: s.origin?.id,
              previewTo: s.endpoint?.id,
            },
            style: { setProperty() {} },
            art: { style: {} },
            querySelector() {
              return this.art;
            },
            hidden: true,
          },
        ],
  );
  const tokens = chain.actors.map((a) => ({
    dataset: {
      previewToken: a.subject,
      targetIndex: String(a.targetIndex ?? 0),
    },
    style: {},
  }));
  const scene = {
    dataset: { chainPreview: "", previewTokens: "{}" },
    clientWidth: 400,
    clientHeight: 300,
    querySelectorAll: (selector) =>
      selector.startsWith("video") || selector.startsWith("audio")
        ? []
        : selector.startsWith("[data-preview-token]")
          ? tokens
          : layers,
  };
  const w = Object.create(Workspace.prototype);
  w.root = {
    querySelector: () => null,
    querySelectorAll: (selector) =>
      selector === "[data-layer-stage]" ? layers : [],
  };
  const frames = [],
    player = new RecipePreview(scene, r, (f) => {
      w.updatePlayback(f);
      frames.push(f);
    });
  const beams = layers.filter(
    (l) => plan[Number(l.dataset.previewPlan)].kind === "travel",
  );
  const starts = beams.map((l) => plan[Number(l.dataset.previewPlan)].delay);
  player.draw(recipeFrame(player.recipe, starts[0] + 1));
  assert.deepEqual(
    beams.map((l) => !l.hidden),
    [true, false, false],
  );
  player.draw(recipeFrame(player.recipe, starts[1] + 1));
  assert.deepEqual(
    beams.map((l) => !l.hidden),
    [true, true, false],
  );
  player.draw(recipeFrame(player.recipe, starts[2] + 1));
  assert.deepEqual(
    beams.map((l) => !l.hidden),
    [true, true, true],
  );
  assert.deepEqual(
    beams.map((l) => l.style.left),
    ["16%", "48%", "80%"],
  );
  assert.notEqual(beams[1].style.transform, beams[2].style.transform);
  const reactions = plan.filter((s) => s.kind === "motion");
  player.draw(recipeFrame(player.recipe, reactions[0].delay + 70));
  assert.notEqual(
    tokens[1].style.transform,
    "translate(0px,0px) rotate(0rad) scale(1)",
  );
  assert.equal(
    tokens[2].style.transform,
    "translate(0px,0px) rotate(0rad) scale(1)",
  );
  player.draw(recipeFrame(player.recipe, recipeDuration(player.recipe) - 1));
  assert.ok(frames.at(-1).stages.some((s) => s.state === "playing"));
  player.stop();
  assert.ok(layers.every((l) => l.hidden));
  assert.ok(tokens.every((t) => t.style.transform === ""));
});
