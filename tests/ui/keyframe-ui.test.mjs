import test from "node:test";
import assert from "node:assert/strict";
import { keyframeDiamondsHTML, pathCanvasHTML, keyframeInspectorHTML, canvasToSquares, canvasView, scrubPoint, keyframeDeleteApplies } from "../../scripts/ui/keyframe-ui.mjs";
import { normalizeKeyframes, samplePath } from "../../scripts/engines/motion/keyframe-path.mjs";

const stage = { kind: "motion", motion: "path", subject: "targets", motionEnd: "hold", duration: 1000, keyframes: normalizeKeyframes([{ at: 0 }, { at: 0.4, x: 1, y: 0.5 }, { at: 1, x: 2.6, y: 0 }]) };

test("diamonds mark each keyframe's time on the bar; the ends are fixed", () => {
  const html = keyframeDiamondsHTML(stage, 3, 1);
  assert.equal((html.match(/data-kf-diamond=/g) ?? []).length, 3);
  assert.match(html, /data-kf-diamond="1" data-kf-stage="3" style="left:40\.00%"/);
  assert.match(html, /an-kf-diamond is-on/);
  assert.equal((html.match(/is-fixed/g) ?? []).length, 2);
});

test("the canvas draws the path, a draggable dot per keyframe, and a finisher's landing square", () => {
  const plain = pathCanvasHTML(stage, { selected: 2 });
  assert.equal((plain.match(/data-kf-dot=/g) ?? []).length, 2, "the start is fixed: no dot");
  assert.match(plain, /data-kf-view="/);
  assert.match(plain, /data-kf-scrub/);
  assert.doesNotMatch(plain, /data-kf-landing/);
  assert.match(plain, /away from the other token/);
  const fin = pathCanvasHTML(stage, { selected: 2, finisher: { ending: "body" } });
  assert.match(fin, /data-kf-landing/);
  assert.match(fin, /away from the attacker/);
  assert.match(pathCanvasHTML(stage, { finisher: { mover: "source", ending: "body" } }), /away from the attacker/, "an old source mover moves the target too");
});

test("the landing square sits where the grid walk lands, not on the rounded end", () => {
  const s = { ...stage, keyframes: normalizeKeyframes([{ at: 0 }, { at: 1, x: 2.6, y: 1.4 }]) };
  const html = pathCanvasHTML(s, { finisher: { ending: "body" } });
  assert.match(html, /data-kf-landing x="2\.5" y="1\.5"/, "square (3, 2): three longer-axis steps along the end direction");
});

test("pointer positions convert to squares through the letterboxed view", () => {
  const view = { x: -2, y: -2, w: 8, h: 8 };
  const rect = { left: 0, top: 0, width: 400, height: 200 };   // wide box: 200px square, centred
  assert.deepEqual(canvasToSquares({ clientX: 200, clientY: 100 }, rect, view), { x: 2, y: 2 });
  assert.deepEqual(canvasToSquares({ clientX: 100, clientY: 0 }, rect, view), { x: -2, y: -2 });
  const v = canvasView(stage.keyframes);
  assert.equal(v.w, v.h, "square view");
  assert.ok(v.x <= -1 && v.x + v.w >= 3.6 - 1e-9, "the path and a margin fit");
});

test("the inspector edits the selected keyframe and offers add, delete, flip, reset", () => {
  const html = keyframeInspectorHTML(stage, 3, 1);
  for (const key of ["at", "x", "y", "rotation", "scale", "alpha", "ease", "sharp"]) assert.match(html, new RegExp(`data-kf-field="${key}" data-kf-index="1" data-index="3"`), key);
  assert.match(html, /value="400"/, "time shown in ms");
  for (const action of ["kf-add", "kf-delete", "kf-flip", "kf-reset"]) assert.match(html, new RegExp(`data-action="${action}"`));
  const first = keyframeInspectorHTML(stage, 3, 0);
  assert.match(first, /data-kf-field="x"[^>]*disabled/, "the start point is where the token stands");
  assert.match(first, /data-action="kf-delete"[^>]*disabled/);
});

test("the inspector warns when a held path travels and its end is not upright", () => {
  const warn = /This path travels: when the token lands it snaps back to upright/;
  const tilted = { ...stage, keyframes: normalizeKeyframes([{ at: 0 }, { at: 1, x: 3, y: 0, rotation: 45 }]) };
  assert.match(keyframeInspectorHTML(tilted, 0, 1), warn);
  assert.match(keyframeInspectorHTML({ ...stage, keyframes: normalizeKeyframes([{ at: 0 }, { at: 1, x: 3, y: 0, alpha: 0.5 }]) }, 0, 1), warn, "faded counts");
  assert.doesNotMatch(keyframeInspectorHTML(stage, 0, 1), warn, "an upright end");
  assert.doesNotMatch(keyframeInspectorHTML({ ...stage, keyframes: normalizeKeyframes([{ at: 0 }, { at: 1, x: 0.3, y: 0, rotation: 45, scale: 0.05 }]) }, 0, 1), warn, "in place");
  assert.doesNotMatch(keyframeInspectorHTML({ ...tilted, motionEnd: "return" }, 0, 1), warn, "a returning path never lands");
});

test("the scrub token follows the path in time with the playhead", () => {
  assert.deepEqual(scrubPoint(stage, 500, 0), { x: 0, y: 0 }, "before the stage starts: at the token");
  const mid = scrubPoint(stage, 500, 900);
  assert.ok(Math.abs(mid.x - 1) < 1e-6 && Math.abs(mid.y - 0.5) < 1e-6, "400 ms into the stage: keyframe 2");
  assert.deepEqual(scrubPoint(stage, 500, 9999), { x: 2.6, y: 0 }, "after: at the end");
});

test("on a returning path the scrub settles back to the token like the preview", () => {
  const back = { ...stage, motionEnd: undefined };
  const end = scrubPoint(back, 0, 850);
  assert.ok(Math.abs(end.x - 2.6) < 1e-6 && Math.abs(end.y) < 1e-6, "85%: the whole path is drawn");
  const settling = scrubPoint(back, 0, 900);
  assert.ok(settling.x > 0 && settling.x < 2.6, "90%: between the last keyframe and the token");
  assert.deepEqual(scrubPoint(back, 0, 1000), { x: 0, y: 0 }, "the end: back at the token");
  const held = scrubPoint(stage, 0, 900), p = samplePath(stage.keyframes, 0.9);
  assert.ok(Math.abs(held.x - p.x) < 1e-3 && Math.abs(held.y - p.y) < 1e-3, "a held path keeps its own timing");
});

test("Delete removes a keyframe only for the focused path stage", () => {
  const base = { keyframeFocus: true, isPath: true, onBar: false, barIndex: 0, stageIndex: 0 };
  assert.equal(keyframeDeleteApplies(base), true);
  assert.equal(keyframeDeleteApplies({ ...base, onBar: true, barIndex: 0 }), true);
  assert.equal(keyframeDeleteApplies({ ...base, onBar: true, barIndex: 1 }), false, "another stage's bar deletes that stage");
  assert.equal(keyframeDeleteApplies({ ...base, keyframeFocus: false }), false);
  assert.equal(keyframeDeleteApplies({ ...base, isPath: false }), false);
});

test("the inspector edits stretch after size, off on the first keyframe, and explains it", () => {
  const html = keyframeInspectorHTML(stage, 3, 1);
  assert.match(html, /Stretch<input type="number" data-field="keyframe" data-kf-field="stretch" data-kf-index="1" data-index="3" min="-0.6" max="0.6" step="0.05" value="0" >/);
  assert.ok(html.indexOf('data-kf-field="scale"') < html.indexOf('data-kf-field="stretch"'), "after Size");
  assert.match(html, /Stretch squeezes or stretches along the travel direction \(negative = flatten\)\./);
  assert.match(keyframeInspectorHTML(stage, 3, 0), /data-kf-field="stretch"[^>]*disabled/);
  assert.match(keyframeInspectorHTML({ ...stage, keyframes: [{ at: 0, x: 0, y: 0 }, { at: 1, x: 1, y: 0 }] }, 0, 1), /data-kf-field="stretch"[^>]*value="0"/, "an old keyframe without stretch shows 0");
});

test("the inspector offers one path easing, a per-keyframe speed and Make smooth", () => {
  const html = keyframeInspectorHTML(stage, 3, 1);
  assert.match(html, /<label>Path easing<select data-field="pathEase" data-index="3">/);
  assert.match(html, /<option value="linear" selected>Linear<\/option>/, "linear when the stage has none");
  assert.match(html, /One easing for the whole motion\./);
  assert.match(keyframeInspectorHTML({ ...stage, pathEase: "easeOutCubic" }, 3, 1), /data-field="pathEase"[^]*<option value="easeOutCubic" selected>/);
  assert.match(html, /<label>Speed into this keyframe<select data-field="keyframe" data-kf-field="ease" data-kf-index="1" data-index="3">/);
  assert.match(html, /Use for deliberate pauses or bounces; otherwise leave Linear\./);
  assert.doesNotMatch(html, />Easing<select/);
  assert.match(html, /data-action="kf-smooth"/);
});

import { Workspace } from "../../scripts/ui/workspace.mjs";
test("Make smooth sets every keyframe linear and marks the recipe edited, only when something changes", async () => {
  const eased = { ...stage, keyframes: normalizeKeyframes([{ at: 0 }, { at: 0.4, x: 1, ease: "easeInOutQuad" }, { at: 1, x: 3, ease: "easeOutCubic" }]) };
  const setup = (recipe) => {
    const w = Object.create(Workspace.prototype), draft = structuredClone(recipe);
    Object.assign(w, { busy: false, stageIndex: 0, keyframeIndex: 1, edits: 0, renders: 0, root: { querySelector: () => null } });
    w.recipe = () => recipe;
    w.edit = () => { w.edits++; return draft; };
    w.render = () => { w.renders++; };
    const click = () => w.onClick({ target: { closest: () => ({ dataset: { action: "kf-smooth" }, disabled: false }) }, preventDefault() {} });
    return { w, draft, click };
  };
  const a = setup({ id: "r", stages: [eased] });
  await a.click();
  assert.equal(a.w.edits, 1);
  assert.deepEqual(a.draft.stages[0].keyframes.map((k) => k.ease), ["linear", "linear", "linear"]);
  assert.equal(a.w.message, "Path smoothed: one continuous motion. Save to apply.");
  const b = setup({ id: "r", stages: [stage] });
  await b.click();
  assert.equal(b.w.edits, 0, "already smooth: no draft");
  assert.notEqual(b.w.message, "Path smoothed: one continuous motion. Save to apply.");
});

test("the Path easing select omits the overshooting back eases; per-keyframe speed keeps them", () => {
  const html = keyframeInspectorHTML(stage, 3, 1);
  const [pathSel, kfSel] = [/data-field="pathEase"[^>]*>([^]*?)<\/select>/, /data-kf-field="ease"[^>]*>([^]*?)<\/select>/].map((r) => html.match(r)[1]);
  assert.doesNotMatch(pathSel, /easeOutBack|easeInBack/);
  assert.match(kfSel, /value="easeOutBack"/);
  assert.match(kfSel, /value="easeInBack"/);
});
