import test from "node:test";
import assert from "node:assert/strict";
import { trackOf, studioTracks, rulerStep, rulerHTML, silencedTracks } from "../../scripts/ui/studio.mjs";
import { RecipeClock } from "../../scripts/engines/playback/choreography.mjs";

const stage = (stageId, kind, extra = {}) => ({ stageId, kind, delay: 0, duration: 1000, assets: ["jb2a.x"], ...extra });

test("studio sorts stages into role tracks", () => {
  assert.equal(trackOf({ kind: "cast" }), "caster");
  assert.equal(trackOf({ kind: "aura", subject: "source" }), "caster");
  assert.equal(trackOf({ kind: "aura", subject: "targets" }), "target");
  assert.equal(trackOf({ kind: "projectile" }), "flight");
  assert.equal(trackOf({ kind: "travel" }), "flight");
  assert.equal(trackOf({ kind: "impact" }), "target");
  assert.equal(trackOf({ kind: "template" }), "target");
  assert.equal(trackOf({ kind: "motion" }), "motion");
  assert.equal(trackOf({ kind: "sprite" }), "motion");
  assert.equal(trackOf({ kind: "sound" }), "sound");
  assert.equal(trackOf({ kind: "tokenfx" }), "fx");
  assert.equal(trackOf({ kind: "scenefx" }), "fx");
});

test("studio tracks pack sequential clips into one lane and keep empty tracks", () => {
  const recipe = { stages: [
    stage("a", "impact"),
    stage("b", "impact", { startMode: "after", afterStage: "a", timingAnchor: "end" }),
    stage("c", "impact", { delay: 200 }),
  ] };
  const { tracks, total, end } = studioTracks(recipe);
  assert.deepEqual(tracks.map((t) => t.id), ["caster", "flight", "target", "motion", "sound", "fx"]);
  const target = tracks.find((t) => t.id === "target");
  assert.equal(target.lanes.length, 2, "a→b share a lane; c overlaps a");
  assert.deepEqual(target.lanes[0].map((r) => r.stageId), ["a", "b"]);
  assert.deepEqual(tracks.find((t) => t.id === "caster").lanes, [[]]);
  assert.equal(end, 2000);
  assert.ok(total > end, "room to drag past the end");
});

test("document-linked recipes only offer attached-layer tracks", () => {
  const recipe = { lifecycle: "document", stages: [stage("a", "aura", { subject: "source", persist: true })] };
  assert.deepEqual(studioTracks(recipe).tracks.map((t) => t.id), ["caster", "fx"]);
});

test("ruler labels stay readable as zoom changes", () => {
  assert.equal(rulerStep(4000, 1), 500);
  assert.ok(rulerStep(4000, 8) < rulerStep(4000, 1));
  assert.match(rulerHTML(2000, 1), /is-major[^>]*left:0\.000%/);
});

test("recipe clock can start part-way through", async () => {
  let now = 1000;
  const frames = [];
  const queue = [];
  const clock = new RecipeClock({ frame: (cb) => { queue.push(cb); return queue.length; }, cancel: () => {}, now: () => now });
  const recipe = { stages: [stage("a", "impact")] };
  const done = clock.play(recipe, (f) => frames.push(Math.round(f.time)), { from: 600 });
  assert.equal(frames[0], 600);
  now = 1500;
  queue.shift()(now);
  assert.ok(await done);
  assert.equal(frames.at(-1), 1000);
});

test("solo overrides mute; muting alone hides only muted tracks", () => {
  assert.deepEqual([...silencedTracks(new Set(["sound"]))], ["sound"]);
  assert.deepEqual([...silencedTracks(new Set(["sound"]), new Set(["target", "sound"]))].sort(), ["caster", "flight", "fx", "motion"]);
  assert.equal(silencedTracks().size, 0);
});

test("muting token motion removes it from chain previews", async () => {
  const { PF2E_FEATS, featRecipe } = await import("../../scripts/catalogs/pf2e/feats/feat-catalog.mjs");
  const { chainPreview } = await import("../../scripts/engines/preview/chain-preview.mjs");
  const { RecipePreview } = await import("../../scripts/engines/preview/recipe-preview.mjs");
  const chain = chainPreview(featRecipe(PF2E_FEATS.find((f) => f.name === "Sudden Charge")), {});
  const motion = chain.recipe.playbackPlan.find((p) => p.kind === "motion");
  const p = Object.assign(Object.create(RecipePreview.prototype), { chain, recipe: chain.recipe, scene: { clientWidth: 400, clientHeight: 300 }, grid: 55 });
  const frame = { time: motion.delay + motion.duration * 0.4, stages: [] };
  const moving = p.subjectPose(motion.subject, frame);
  assert.ok(Math.abs(moving.x) + Math.abs(moving.y) > 1, "unmuted motion moves the token");
  p.muted = new Set([motion.index]);
  const still = p.subjectPose(motion.subject, frame);
  assert.equal(Math.round(Math.abs(still.x) + Math.abs(still.y)), 0);
});

test("muting the filters track silences Token Magic in chain previews", async () => {
  const { PF2E_FEATS, featRecipe } = await import("../../scripts/catalogs/pf2e/feats/feat-catalog.mjs");
  const { chainPreview } = await import("../../scripts/engines/preview/chain-preview.mjs");
  const { TokenFxPreview } = await import("../../scripts/engines/preview/token-fx-preview.mjs");
  const recipe = featRecipe(PF2E_FEATS.find((f) => f.name === "Sudden Charge"));
  recipe.stages.push({ stageId: "zoom", kind: "tokenfx", subject: "source", fxLibrary: "tokenshade", fxPreset: "zoomblur", assets: [], delay: 100, duration: 1500, scale: 1, opacity: 1 });
  const chain = chainPreview(recipe, {});
  const plan = chain.recipe.playbackPlan, at = plan.findIndex((p) => p.kind === "tokenfx");
  assert.ok(at >= 0, "Sudden Charge has a Token Magic stage");
  const fx = new TokenFxPreview({ scene: { dataset: {} }, recipe: chain.recipe, PIXI: {}, tokenMagic: {} });
  const entry = fx.entries.find((e) => e.index === at);
  assert.equal(entry.stageIndex, plan[at].index, "entries remember their recipe stage");
  assert.notEqual(entry.index, entry.stageIndex, "plan position differs from stage number here");
  const frame = { time: plan[at].delay + 50, stages: [] };
  assert.equal(fx.state(entry, frame).state, "playing");
  assert.equal(fx.state(entry, { ...frame, muted: new Set([plan[at].index]) }).state, "pending");
});

test("a random-variant group shows as one clip: the variant being edited, else the first", async () => {
  const { studioTracks: tracksOf } = await import("../../scripts/ui/studio.mjs");
  const { validateRecipe: v } = await import("../../scripts/core/model.mjs");
  const recipe = v({ id: "r", name: "R", trigger: "manual", stages: [
    { stageId: "a", kind: "cast", assets: ["jb2a.impact.001.orange"], variantGroup: "g" },
    { stageId: "b", kind: "cast", assets: ["jb2a.impact.002.blue"], variantGroup: "g", delay: 500 },
    { stageId: "c", kind: "cast", assets: ["jb2a.impact.003.green"] },
  ] });
  const shown = (sel) => tracksOf(recipe, sel).tracks.flatMap((t) => t.lanes.flat()).map((row) => recipe.stages[row.index].stageId).sort();
  assert.deepEqual(shown(-1), ["a", "c"]);
  assert.deepEqual(shown(1), ["b", "c"], "editing variant 2 shows its own clip and timing");
  assert.deepEqual(shown(2), ["a", "c"]);
});

test("the stage panel: a header card, essentials, the kind's block and four tabs, times in seconds", async () => {
  const { Workspace, resetInspectorTab } = await import("../../scripts/ui/workspace.mjs");
  const { validateRecipe } = await import("../../scripts/core/model.mjs");
  const recipe = validateRecipe({ id: "bolt", name: "Bolt", trigger: "attack", match: "fire bolt", stages: [
    { stageId: "cast", kind: "cast", assets: ["jb2a.impact.001.orange"], delay: 0, duration: 650, fadeOut: 200 },
    { stageId: "bolt", kind: "projectile", assets: ["jb2a.fire_bolt.orange"], startMode: "after", startRef: "cast", startOffset: 180, duration: 1500, scale: 0.65, oneShot: true },
  ] });
  Object.assign(recipe.stages[1], { startMode: "after", startRef: "cast", afterStage: "cast", timingAnchor: "end", startOffset: 180 });
  const w = Object.create(Workspace.prototype);
  w.host = { catalog: () => [], soundCatalog: () => null, environment: () => ({ demo: true }), fxCatalog: () => ({ presets: [], effects: [] }) };
  w.stageIndex = 1; w.isStudio = () => true; w.busy = false;
  const html = w.inspectorHTML(recipe);
  assert.match(html, /class="an-inspector-head an-stage-card/);
  assert.match(html, /Fire bolt · orange/, "the asset's readable name");
  assert.match(html, /data-action="studio-dup-stage" data-index="1"/);
  assert.match(html, /data-action="studio-del-stage" data-index="1"/, "one delete path, the timeline's");
  assert.match(html, /Starts when Source ends, \+0\.18 s \(at 0\.83 s\)/);
  assert.match(html, /data-field="startOffset" data-index="1" data-scale="1000"[^>]*value="0\.18"/, "the gap shows in seconds");
  assert.match(html, /data-field="scale" data-index="1" data-scale="0\.01"[^>]*value="65"/, "size as a percentage");
  assert.match(html, /an-type-block"><div class="an-stage-block-title">Moving orb \/ projectile/);
  assert.deepEqual([...html.matchAll(/data-action="inspector-tab" data-tab="(\w+)"/g)].map((m) => m[1]), ["look", "motion", "place", "time"]);
  assert.match(html, /an-stage-tab has-changes" data-action="inspector-tab" data-tab="time"/, "play once differs from the default");
  assert.doesNotMatch(html, /<details class="an-advanced an-options" data-options-group="(Timing|Color|Entrance|Placement)/, "no accordions left");
  w.inspectorTab = "time";
  assert.match(w.inspectorHTML(recipe), /data-action="inspector-tab-reset" data-tab="time"/);
  const stage = { ...recipe.stages[1] };
  resetInspectorTab("time", stage);
  assert.equal(stage.oneShot, undefined);
  assert.equal(stage.startRef, "cast", "a reset keeps the stage's link");
});

test("a sound stage has no Motion tab; its fade easing is on the Timing tab", async () => {
  const { Workspace } = await import("../../scripts/ui/workspace.mjs");
  const { validateRecipe } = await import("../../scripts/core/model.mjs");
  const recipe = validateRecipe({ id: "s", name: "S", trigger: "manual", stages: [{ stageId: "a", kind: "sound", soundFile: "sounds/a.ogg", assets: [], delay: 0, duration: 1000 }] });
  const w = Object.create(Workspace.prototype);
  w.host = { catalog: () => [], soundCatalog: () => null, environment: () => ({ demo: true }), fxCatalog: () => ({ presets: [], effects: [] }) };
  w.stageIndex = 0; w.isStudio = () => true; w.busy = false; w.inspectorTab = "time";
  const html = w.inspectorHTML(recipe);
  assert.deepEqual([...html.matchAll(/data-tab="(\w+)"/g)].map((m) => m[1]), ["time"]);
  assert.match(html, /Fade easing/);
});

const editorWith = async (stages) => {
  const { Workspace } = await import("../../scripts/ui/workspace.mjs");
  const { validateRecipe } = await import("../../scripts/core/model.mjs");
  const saved = validateRecipe({ id: "r", name: "R", trigger: "manual", stages });
  const w = Object.create(Workspace.prototype);
  w.drafts = new Map(); w.dirty = new Set(); w.selected = "r"; w.stageIndex = 0; w.busy = false;
  w.host = { recipes: () => [saved] };
  w.recipe = () => w.drafts.get("r") ?? saved;
  w.stopEditorPreview = () => {}; w.render = () => {}; w.root = { querySelector: () => null };
  return w;
};

test("undo and redo step through edits; undoing back to the saved recipe clears Unsaved", async () => {
  const w = await editorWith([{ stageId: "a", kind: "cast", assets: ["jb2a.x"], delay: 0, duration: 1000 }]);
  w.edit().stages[0].duration = 1500;
  w.histories.get("r").at = 0; // the next edit is a new step, not grouped with this one
  w.edit().stages[0].duration = 2000;
  assert.equal(w.canUndo("undo"), true);
  assert.equal(w.history("undo"), true); assert.equal(w.recipe().stages[0].duration, 1500);
  assert.equal(w.history("undo"), true); assert.equal(w.recipe().stages[0].duration, 1000);
  assert.equal(w.dirty.has("r"), false, "back to what is saved");
  assert.equal(w.history("undo"), false);
  assert.equal(w.history("redo"), true); assert.equal(w.recipe().stages[0].duration, 1500);
  assert.equal(w.dirty.has("r"), true);
});

test("dragging or nudging a linked clip keeps its link and shifts the offset; Alt unlinks", async () => {
  const w = await editorWith([
    { stageId: "a", kind: "cast", assets: ["jb2a.x"], delay: 0, duration: 1000 },
    { stageId: "b", kind: "impact", assets: ["jb2a.y"], delay: 0, duration: 800, afterStage: "a", timingAnchor: "end", startOffset: 0 },
  ]);
  Object.assign(w.edit().stages[1], { startMode: "after", startRef: "a" });
  w.applyTimelineEdit(1, { ms: 1250 });
  let b = w.recipe().stages[1];
  assert.deepEqual([b.startMode, b.startRef, b.startOffset], ["after", "a", 250]);
  w.applyTimelineEdit(1, { ms: 900 }); // before the end of "a": a custom link with a negative offset
  b = w.recipe().stages[1];
  assert.deepEqual([b.startMode, b.afterStage, b.timingAnchor, b.startOffset], [undefined, "a", "end", -100]);
  w.applyTimelineEdit(1, { ms: 400, unlink: true });
  b = w.recipe().stages[1];
  assert.deepEqual([b.afterStage, b.delay], ["", 400]);
});

test("number fields wait while typing and clamp to their range when done, with a note", async () => {
  const w = await editorWith([{ stageId: "a", kind: "cast", assets: ["jb2a.x"], delay: 0, duration: 1000 }]);
  const field = (value) => ({ dataset: { index: "0", field: "duration", scale: "1000" }, type: "number", value, min: "0.1", max: "30", placeholder: "", closest: () => ({ firstChild: { textContent: "Length" } }) });
  w.updateField(field("0.0"));
  assert.equal(w.recipe().stages[0].duration, 1000, "an unfinished value waits");
  const t = field("45"); w.updateField(t, true);
  assert.equal(t.value, "30"); assert.equal(w.recipe().stages[0].duration, 30000);
  assert.match(w.message, /Length goes from 0\.1 to 30; set to 30/);
  w.updateField(field(""), true);
  assert.equal(w.recipe().stages[0].duration, 30000, "a blank keeps the old value");
});

test("the preview clock can stop at a clip's end, for looping one clip", async () => {
  const { validateRecipe } = await import("../../scripts/core/model.mjs");
  const recipe = validateRecipe({ id: "c", name: "C", trigger: "manual", stages: [{ stageId: "a", kind: "cast", assets: ["jb2a.x"], delay: 0, duration: 3000 }] });
  let now = 0; const queue = [];
  const clock = new RecipeClock({ frame: (cb) => queue.push(cb), cancel: () => {}, now: () => now });
  const seen = [];
  const done = clock.play(recipe, (f) => seen.push(Math.round(f.time)), { from: 500, until: 1200 });
  for (const t of [600, 900, 1250]) { now = t; queue.shift()?.(t); }
  assert.equal(await done, true, "reaching the clip's end counts as complete");
  assert.equal(seen[0], 500, "starts at the clip's start");
  assert.ok(seen.at(-1) >= 1200 && queue.length === 0, "no frame after the clip's end");
});

test("Local preview plays the random variant being edited; the table keeps choosing at random", async () => {
  const { editedVariantOnly } = await import("../../scripts/ui/workspace.mjs");
  const recipe = { id: "v", stages: [
    { stageId: "a", kind: "impact", variantGroup: "g", assets: ["jb2a.a"], opacity: 1 },
    { stageId: "b", kind: "impact", variantGroup: "g", assets: ["jb2a.b"], opacity: 1 },
  ] };
  const local = editedVariantOnly(recipe, 1);
  assert.deepEqual(local.stages.map((s) => [s.stageId, s.variantGroup, s.opacity]), [["a", undefined, 0], ["b", undefined, 1]]);
  assert.equal(editedVariantOnly({ id: "n", stages: [{ stageId: "x", kind: "cast" }] }, 0).stages[0].stageId, "x");
});

test("keyframed token paths get the framed path preview", async () => {
  const { chainPreview } = await import("../../scripts/engines/preview/chain-preview.mjs");
  const { validateRecipe } = await import("../../scripts/core/model.mjs");
  const recipe = validateRecipe({ id: "p", name: "P", trigger: "manual", stages: [{ stageId: "m", kind: "motion", motion: "path", subject: "source", assets: [], delay: 0, duration: 1500, keyframes: [{ at: 0, x: 0, y: 0 }, { at: 1, x: 6, y: 0 }] }] });
  assert.equal(chainPreview(recipe, { previewWidth: 400, previewHeight: 300 })?.pathFrame, true);
});

test("new flight and target stages follow the cast and the flight", async () => {
  const { chainAnchor } = await import("../../scripts/ui/studio.mjs");
  const cast = stage("c", "cast"), flight = stage("f", "projectile"), hit = stage("h", "impact");
  assert.equal(chainAnchor([cast], "flight"), cast);
  assert.equal(chainAnchor([cast, flight], "target"), flight);
  assert.equal(chainAnchor([cast], "target"), cast, "no flight: after the cast");
  assert.equal(chainAnchor([cast, flight, hit], "sound"), null, "other tracks start at the playhead");
});

test("path shapes are valid keyframed paths", async () => {
  const { PATH_PRESETS, presetKeyframes } = await import("../../scripts/engines/motion/keyframe-path.mjs");
  for (const id of Object.keys(PATH_PRESETS)) {
    const kfs = presetKeyframes(id);
    assert.ok(kfs.length >= 2, id);
    assert.deepEqual([kfs[0].at, kfs[0].x, kfs[0].y, kfs.at(-1).at], [0, 0, 0, 1], id);
  }
  assert.equal(presetKeyframes("spin").at(-1).rotation, 360);
});

test("a copied stage pastes into another recipe after the selected stage, with no stale links", async () => {
  const { studioAction } = await import("../../scripts/ui/studio.mjs");
  const w = await editorWith([{ stageId: "a", kind: "cast", assets: ["jb2a.x"], delay: 0, duration: 1000 }, { stageId: "b", kind: "impact", assets: ["jb2a.y"], delay: 0, duration: 800, afterStage: "a", timingAnchor: "end" }]);
  w.stageLabel = (s) => s.label || s.kind; w.root = { querySelector: () => null, querySelectorAll: () => [] };
  await studioAction(w, "studio-copy-stage", { dataset: { index: "1" } });
  assert.equal(w.stageClipboard.stageId, "b");
  await studioAction(w, "studio-paste-stage", { dataset: { index: "0" } });
  const pasted = w.recipe().stages[1];
  assert.notEqual(pasted.stageId, "b");
  assert.equal(pasted.afterStage, "a", "starts after the stage it was pasted behind");
  assert.equal(w.recipe().stages.length, 3);
});

test("fields where 0 means off or all say so", async () => {
  const { Workspace } = await import("../../scripts/ui/workspace.mjs");
  const { validateRecipe } = await import("../../scripts/core/model.mjs");
  const recipe = validateRecipe({ id: "z", name: "Z", trigger: "attack", match: "x", stages: [{ stageId: "a", kind: "impact", assets: ["jb2a.x"], delay: 0, duration: 1000 }] });
  const w = Object.create(Workspace.prototype);
  const html = w.optionFieldsHTML(recipe.stages[0], 0, false, ["Timing & repetition", "Media playback", "Placement & attachment"]);
  assert.match(html, /<label>Restart every<span class="an-unit"><input[^>]*value="" placeholder="When finished"/);
  assert.match(html, /<label>Stop clip at<span class="an-unit"><input[^>]*value="" placeholder="Its end"/);
  assert.match(html, /<label>Maximum targets<input[^>]*value="" placeholder="All"/);
  assert.match(html, /<label>Gap between plays<span class="an-unit"><input[^>]*placeholder="Off"/);
  assert.doesNotMatch(html, /0 = /);
});

test("the timeline help opens on click and lists the shortcuts", async () => {
  const { studioAction } = await import("../../scripts/ui/studio.mjs");
  const w = { studioHelp: false, render() {} };
  await studioAction(w, "studio-help", { dataset: {} });
  assert.equal(w.studioHelp, true);
  await studioAction(w, "studio-help", { dataset: {} });
  assert.equal(w.studioHelp, false);
});
