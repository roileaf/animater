import test from "node:test";
import assert from "node:assert/strict";
import { studioTracks, studioHTML, studioAction, STUDIO_TRACKS } from "../../scripts/ui/studio.mjs";
import { TOUR_PRACTICE_ID, practiceFinisher } from "../../scripts/ui/finisher-tour.mjs";
import { validateRecipe } from "../../scripts/core/model.mjs";
import { Workspace } from "../../scripts/ui/workspace.mjs";

const stage = (stageId, kind, extra = {}) => ({ stageId, kind, delay: 0, duration: 1000, assets: ["jb2a.x"], ...extra });
const finisher = (stages) => ({ finisher: {}, stages });
const ids = (r, opts) => studioTracks(r, -1, opts).tracks.map((t) => t.id);

function studioFor(recipe) {
  const w = Object.create(Workspace.prototype);
  Object.assign(w, {
    page: "finishers", studio: true, selected: recipe.id, stageIndex: 0, keyframeIndex: 0, keyframeFocus: false,
    studioTime: 0, studioSettings: false, previewMode: "recipe", category: "All", busy: false, message: "",
    drafts: new Map([[recipe.id, recipe]]), dirty: new Set(),
    root: { querySelectorAll: () => [], querySelector: () => null },
  });
  w.host = { environment: () => ({ demo: true }), catalog: () => [], recipes: () => [], players: () => [], itemSummary: () => null };
  w.render = () => {};
  w.recipePreviewHTML = () => "<div data-recipe-scene></div>";
  return w;
}
const trackNames = (html) => [...html.matchAll(/<div class="an-st-track[^"]*" data-st-track="(\w+)"><div class="an-st-head"><span class="an-st-head-icon">[^<]*<\/span><b>([^<]*)<\/b>/g)].map((m) => [m[1], m[2]]);

test("a finisher shows Token motion, Target, Sound, Filters & scene; Source and Flight are hidden", () => {
  const r = finisher([stage("a", "impact")]);
  assert.deepEqual(ids(r), ["motion", "target", "sound", "fx"]);
  assert.equal(studioTracks(r).hiddenCount, 2);
});

test("the More tracks toggle shows the hidden tracks after the others", () => {
  const r = finisher([stage("a", "impact")]);
  assert.deepEqual(ids(r, { more: true }), ["motion", "target", "sound", "fx", "caster", "flight"]);
});

test("a hidden track that has stages always shows", () => {
  const r = finisher([stage("a", "impact"), stage("b", "projectile")]);
  assert.deepEqual(ids(r), ["motion", "target", "sound", "fx", "flight"]);
  assert.equal(studioTracks(r).hiddenCount, 1, "only Source is still tucked away");
  const c = finisher([stage("a", "cast")]);
  assert.ok(ids(c).includes("caster"));
});

test("a normal recipe keeps all six tracks in today's order, with no More row", () => {
  const r = { stages: [stage("a", "impact")] };
  assert.deepEqual(ids(r), ["caster", "flight", "target", "motion", "sound", "fx"]);
  assert.equal(studioTracks(r).hiddenCount, 0);
  const html = studioHTML(studioFor({ ...validateRecipe({ id: "n", name: "N", trigger: "manual", stages: [stage("a", "impact")] }) }), r);
  assert.doesNotMatch(html, /studio-more/);
});

test("the caster track is called Source everywhere", () => {
  assert.equal(STUDIO_TRACKS.find((t) => t.id === "caster").name, "Source");
});

test("studio HTML for a finisher: new order, More tracks row, aria and tooltip", () => {
  const p = practiceFinisher("flying");
  const w = studioFor(p);
  let html = studioHTML(w, p);
  assert.deepEqual(trackNames(html).map((t) => t[0]), ["motion", "target", "sound", "fx"]);
  assert.match(html, /<button[^>]*data-action="studio-more"[^>]*aria-expanded="false"[^>]*>\+ More tracks/);
  assert.match(html, /data-action="studio-more"[^>]*data-tooltip="/);
  w.studioMoreTracks = true;
  html = studioHTML(w, p);
  assert.deepEqual(trackNames(html), [["motion", "Token motion"], ["target", "Target"], ["sound", "Sound"], ["fx", "Filters &amp; scene"], ["caster", "Source"], ["flight", "Flight"]]);
  assert.match(html, /aria-expanded="true"[^>]*>− Fewer tracks/);
});

test("the More toggle is a view flag: it flips on the workspace, never in the recipe", async () => {
  const p = practiceFinisher("flying");
  const w = studioFor(p);
  let renders = 0; w.render = () => { renders++; };
  const before = JSON.stringify(p);
  assert.equal(await studioAction(w, "studio-more", { dataset: {} }), true);
  assert.equal(w.studioMoreTracks, true);
  assert.equal(renders, 1);
  assert.equal(JSON.stringify(p), before);
  await studioAction(w, "studio-more", { dataset: {} });
  assert.equal(w.studioMoreTracks, false);
});

test("no 'Caster' or 'Attacker' in the editor for a recipe or a finisher", () => {
  for (const r of [practiceFinisher("flying"), validateRecipe({ id: "n", name: "N", trigger: "manual", stages: [stage("a", "cast"), stage("b", "motion", { motion: "lunge" }), stage("c", "projectile")] })]) {
    const w = studioFor(r);
    w.studioMoreTracks = true;
    for (let i = 0; i < r.stages.length; i++) {
      w.stageIndex = i;
      const html = studioHTML(w, r) + w.inspectorHTML(r);
      assert.doesNotMatch(html, /Caster|Attacker/);
    }
  }
});
