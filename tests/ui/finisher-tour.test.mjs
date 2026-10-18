import test from "node:test";
import assert from "node:assert/strict";
import { FINISHER_TOURS, TOUR_PRACTICE_ID, practiceFinisher, finisherSteps, studioSurface, SEL } from "../../scripts/ui/finisher-tour.mjs";
import { canvasToSquares, squaresToCanvas } from "../../scripts/ui/keyframe-ui.mjs";
import { validateRecipe } from "../../scripts/core/model.mjs";
import { pathSquares } from "../../scripts/engines/motion/keyframe-path.mjs";
import { finisherTravelPath } from "../../scripts/engines/finishers/finisher-model.mjs";
import { studioHTML } from "../../scripts/ui/studio.mjs";
import { Workspace } from "../../scripts/ui/workspace.mjs";
import { headlessHand, findInHTML } from "../helpers/studio-hand.mjs";

// The studio on the practice finisher, as runFinisherTour opens it (no canvas: demo environment).
function practiceStudio(tour) {
  const w = Object.create(Workspace.prototype);
  Object.assign(w, {
    page: "finishers", studio: true, selected: TOUR_PRACTICE_ID, stageIndex: 0, keyframeIndex: 0, keyframeFocus: false,
    studioTime: 0, studioSettings: false, previewMode: "recipe", category: "All", busy: false, message: "",
    drafts: new Map([[TOUR_PRACTICE_ID, practiceFinisher(tour)]]), dirty: new Set(),
    root: { querySelectorAll: () => [], querySelector: () => null },
  });
  w.host = { environment: () => ({ demo: true }), catalog: () => [], recipes: () => [], players: () => [], itemSummary: () => null };
  w.render = () => {};
  w.recipePreviewHTML = () => "<div data-recipe-scene></div>";
  return w;
}
const sorted = (list) => [...new Set(list)].sort();

test("two finisher tours, named as in the spec", () => {
  assert.ok(Object.isFrozen(FINISHER_TOURS));
  assert.deepEqual({ ...FINISHER_TOURS }, {
    flying: { label: "A flying finisher", detail: "Keyframes: fling the target along a path, stretch it, slam it into a wall." },
    shattering: { label: "A shattering finisher", detail: "Fragments: cut the target into pieces that fly apart." },
  });
});

test("practice finishers are valid, never-saved finisher drafts", () => {
  for (const [tour, name] of [["flying", "Practice: Thunder shove"], ["shattering", "Practice: Shattered"]]) {
    const p = practiceFinisher(tour);
    assert.equal(p.id, TOUR_PRACTICE_ID);
    assert.equal(p.name, name);
    assert.equal(p.trigger, "manual");
    assert.equal(p.category, "Finisher");
    assert.equal(typeof p.finisher, "object");
    assert.doesNotThrow(() => validateRecipe(p));
    assert.deepEqual(p.stages.map((s) => [s.kind, s.label]), [["impact", ""]], "one unnamed Target stage: a recipe needs a stage");
    p.stages.push({}); assert.equal(practiceFinisher(tour).stages.length, 1, "a fresh copy each time");
  }
  assert.equal(practiceFinisher("nope").name, "Practice: Thunder shove");
});

test("squaresToCanvas is the inverse of canvasToSquares", () => {
  const rect = { left: 100, top: 50, width: 400, height: 300 }, view = { x: -2, y: -3.5, w: 7, h: 7 };
  // Non-zero points: canvasToSquares rounds, and a rounded tiny negative would be -0.
  for (const p of [{ x: 0.5, y: 0.25 }, { x: 4, y: 1 }, { x: 2, y: -1.5 }]) {
    const c = squaresToCanvas(p, rect, view);
    assert.deepEqual(canvasToSquares({ clientX: c.x, clientY: c.y }, rect, view), p);
  }
});

test("every step says something, declares its selectors and has a demonstration", () => {
  assert.equal(finisherSteps("flying").length, 10);
  assert.equal(finisherSteps("shattering").length, 7);
  for (const tour of ["flying", "shattering"]) {
    const steps = finisherSteps(tour);
    for (const s of steps) {
      assert.equal(typeof s.say, "string"); assert.ok(s.say.length > 20);
      assert.ok(Array.isArray(s.targets)); assert.equal(typeof s.show, "function");
      for (const sel of s.targets) assert.doesNotThrow(() => findInHTML("", sel), `${sel} is a compound selector`);
    }
    assert.match(steps.at(-1).say, /Finish/);
  }
});

test("the studio surface offers the helpers the steps use", () => {
  const surface = studioSurface({ root: { querySelector: () => null }, stageIndex: 0 }, {});
  for (const key of ["openSettings", "closeSettings", "pathPoint", "keyframeHandle", "diamond", "dragKeyframe", "pointAt", "scrubTo", "find"]) assert.equal(typeof surface[key], "function", key);
});

test("a stage switched to Keyframed path gets its keyframes at once, so a held path renders", () => {
  const w = practiceStudio("flying");
  w.edit().stages.push({ stageId: "m", kind: "motion", motion: "lunge", subject: "targets", assets: [], duration: 800 });
  w.stageIndex = 1;
  w.onChange({ target: { dataset: { field: "motion", index: "1" }, type: "select-one", value: "path", hasAttribute: () => false } });
  assert.equal(findInHTML(studioHTML(w, w.recipe()), SEL.motionEnd).length, 1, "a finisher's keyframed path offers End");
  assert.equal(findInHTML(w.motionControlsHTML(w.recipe().stages[1], 1, { name: "plain recipe" }), SEL.motionEnd).length, 0, "only finishers hold");
  w.onChange({ target: { dataset: { field: "motionEnd", index: "1" }, type: "select-one", value: "hold", hasAttribute: () => false } });
  assert.equal(w.recipe().stages[1].keyframes.length, 2);
  assert.doesNotThrow(() => studioHTML(w, w.recipe()), "the chip reads the path's length");
  assert.equal(pathSquares(finisherTravelPath(w.recipe()).keyframes), 1);
});

// For every step: each selector the hand uses matches exactly one element in the studio HTML for
// the draft as it stands at that moment, and it is one of the step's declared targets.
for (const tour of ["flying", "shattering"]) {
  test(`${tour}: every step's selectors resolve in the studio as the tour builds it`, async () => {
    const w = practiceStudio(tour);
    for (const [n, step] of finisherSteps(tour).entries()) {
      const hand = headlessHand(w);
      await step.show(hand);
      assert.deepEqual(sorted(hand.used), sorted(step.targets), `step ${n + 1} declares the selectors it uses`);
      assert.doesNotMatch(w.message ?? "", /would wait on each other/, `step ${n + 1}`);
    }
    const r = w.recipe();
    assert.doesNotThrow(() => validateRecipe(r));
    if (tour === "flying") {
      assert.deepEqual(r.stages.map((s) => s.label), ["hit", "", "landing", "wall-crack"]);
      assert.equal(r.finisher.on, "kill");
      assert.equal(r.finisher.wall, "slam");
      const path = finisherTravelPath(r);
      assert.ok(path, "a held keyframed path on the target");
      assert.equal(pathSquares(path.keyframes), 4);
      assert.equal(path.pathEase, "easeOutCubic");
      assert.equal(path.keyframes.length, 3);
      assert.ok(path.keyframes[1].y < 0, "the middle keyframe arcs up");
      assert.equal(path.keyframes[1].stretch, 0.2);
      assert.equal(path.keyframes[1].scale, 1.15);
    } else {
      assert.deepEqual(r.stages.map((s) => s.label), ["slash", ""]);
      assert.equal(r.finisher.on, "criticalOrKill");
      assert.equal(r.finisher.ending, "vanish");
      const cut = r.stages[1];
      assert.deepEqual([cut.motion, cut.subject, cut.motionEnd, cut.pattern, cut.cut], ["fragments", "targets", "hold", "dust", "attack"]);
      assert.deepEqual([cut.spread, cut.spin, cut.fall], [0.8, 60, 0.5]);
    }
  });
}

import { studioState, restoreStudio, stepSnapshot, restoreStep, finisherToursHTML, runFinisherTour } from "../../scripts/ui/finisher-tour.mjs";
import { finishersPageHTML } from "../../scripts/ui/finisher-ui.mjs";
import { installFakeDOM } from "../helpers/fake-dom.mjs";
import { readFileSync } from "node:fs";

const settle = (ms = 20) => new Promise((r) => setTimeout(r, ms));
// A GM mid-edit: their own finisher open in the studio with unsaved changes.
function busyStudio() {
  const w = Object.create(Workspace.prototype);
  const mine = { ...practiceFinisher("flying"), id: "mine", name: "Mine" };
  Object.assign(w, {
    page: "finishers", studio: true, selected: "mine", stageIndex: 0, keyframeIndex: 2, keyframeFocus: true, studioTime: 450,
    studioSettings: false, previewMode: "recipe", category: "All", busy: false, message: "Keyframe moved. Save to apply.", studioZoom: 2,
    drafts: new Map([["mine", mine]]), dirty: new Set(["mine"]),
    root: { querySelectorAll: () => [], querySelector: () => null },
  });
  w.saves = 0;
  w.host = { environment: () => ({ demo: true }), catalog: () => [], recipes: () => [], players: () => [], itemSummary: () => null, save: async () => { w.saves++; }, confirm: async () => true };
  w.render = () => {};
  return w;
}
const click = (w, dataset) => w.onClick({ target: { closest: () => ({ dataset, disabled: false }) }, preventDefault() {} });

test("the settings captions name the dialog by its heading, Recipe settings", () => {
  for (const tour of Object.keys(FINISHER_TOURS)) {
    const says = finisherSteps(tour).map((s) => s.say).join(" ");
    assert.doesNotMatch(says, /Finisher settings/);
    assert.match(says, /<b>⚙<\/b> chip to open the <b>Recipe settings<\/b>/);
  }
});

test("the Finishers page has the Show me button, and its menu lists both tours", () => {
  const page = (open) => finishersPageHTML({ studio: false, showFinisherTours: open, listedRecipes: () => [], host: { recipes: () => [], defaultFinisher: () => "" } });
  assert.match(page(false), /<button class="an-flash-guide" data-action="finisher-tours" aria-expanded="false"[^>]*>🎓 Show me ▾<\/button>/);
  assert.doesNotMatch(page(false), /data-finisher-tour=/);
  const open = page(true);
  assert.match(open, /aria-expanded="true"/);
  assert.match(open, /<button role="menuitem" data-action="finisher-tour" data-finisher-tour="flying"><b>A flying finisher<\/b><small>Keyframes: fling the target/);
  assert.match(open, /data-action="finisher-tour" data-finisher-tour="shattering"><b>A shattering finisher<\/b>/);
  assert.equal(finisherToursHTML(true).match(/role="menuitem"/g).length, 2);
});

test("Show me toggles its menu; picking a tour closes it and never starts a second tour", async () => {
  const w = busyStudio();
  let renders = 0; w.render = () => { renders++; };
  await click(w, { action: "finisher-tours" });
  assert.equal(w.showFinisherTours, true); assert.equal(renders, 1);
  w.touring = true;
  await click(w, { action: "finisher-tour", finisherTour: "flying" });
  assert.equal(w.showFinisherTours, false);
  assert.equal(w.selected, "mine", "a tour already running: nothing else changes");
});

test("the practice finisher is never saved, duplicated or deleted", async () => {
  const w = busyStudio();
  w.drafts.set(TOUR_PRACTICE_ID, practiceFinisher("flying"));
  w.selected = TOUR_PRACTICE_ID;
  for (const action of ["save", "duplicate", "delete"]) await click(w, { action });
  assert.equal(w.saves, 0);
  assert.ok(w.drafts.has(TOUR_PRACTICE_ID));
});

test("studio snapshot and restore bring back page, recipe, drafts, dirty flags and view exactly", () => {
  const w = busyStudio(), before = studioState(w);
  w.drafts.get("mine").stages[0].label = "changed in place";
  w.drafts.set(TOUR_PRACTICE_ID, practiceFinisher("shattering"));
  Object.assign(w, { selected: TOUR_PRACTICE_ID, stageIndex: 3, studioTime: 0, keyframeIndex: 0, studioSettings: true, message: "", studioZoom: 1 });
  w.dirty.add(TOUR_PRACTICE_ID);
  restoreStudio(w, before);
  assert.deepEqual(studioState(w), before);
  assert.equal(w.drafts.get("mine").stages[0].label, "", "drafts are copies, not shared objects");
  assert.equal(w.drafts.has(TOUR_PRACTICE_ID), false);
  assert.equal(w.dirty.has(TOUR_PRACTICE_ID), false);
});

test("restoring the studio stops a playing preview", () => {
  const w = busyStudio(), before = studioState(w);
  let stopped = 0;
  Object.assign(w, { studioPlaying: true, previewRun: { stop: () => { stopped++; } } });
  restoreStudio(w, before);
  assert.equal(stopped, 1);
  assert.equal(w.studioPlaying, false);
  Object.assign(w, { studioPlaying: true, previewRun: { stop: () => { stopped++; } } });
  w.drafts.set(TOUR_PRACTICE_ID, practiceFinisher("flying"));
  const snap = stepSnapshot(w);
  w.drafts.get(TOUR_PRACTICE_ID).name = "edited by a step";
  w.dirty.add(TOUR_PRACTICE_ID);
  restoreStep(w, snap);
  assert.equal(stopped, 2);
  assert.equal(w.studioPlaying, false);
  assert.equal(w.recipe().name, "Practice: Thunder shove");
  assert.equal(w.dirty.has(TOUR_PRACTICE_ID), false);
});

test("a tour opens the practice finisher and Esc puts the studio back exactly", async () => {
  const dom = installFakeDOM();
  try {
    const w = busyStudio(), before = studioState(w);
    const running = runFinisherTour(w, "flying", { lead: 0 });
    assert.equal(w.touring, true);
    assert.equal(w.selected, TOUR_PRACTICE_ID);
    assert.equal(w.recipe().name, "Practice: Thunder shove");
    assert.equal(w.studio, true);
    assert.equal(w.page, "finishers");
    await settle();
    assert.match(dom.caption().innerHTML, /Step 1 of 10/);
    dom.fire("keydown", { key: "Escape" });
    await running;
    assert.equal(w.touring, false);
    assert.deepEqual(studioState(w), before, "the GM's unsaved draft, dirty flag, selection and playhead are back");
    assert.equal(w.listedRecipes().some((r) => r.id === TOUR_PRACTICE_ID), false);
    assert.equal(w.saves, 0);
    assert.equal(dom.caption(), null);
  } finally { dom.restore(); }
});

test("the Show me pill is styled on the Finishers page and the stylesheet stays CRLF", () => {
  const css = readFileSync(new URL("../../styles/animater.css", import.meta.url), "utf8");
  assert.match(css, /\.animater \.an-finisher-guides > \.an-flash-guide \{[^}]*height: 26px/);
  assert.doesNotMatch(css, /[^\r]\n/, "every line ends in CRLF");
});

// ---- final fix wave: interrupted drags, setup failures, the practice finisher's other exits.
import { studioPointer, studioKey } from "../../scripts/ui/studio.mjs";
import { runTour } from "../../scripts/ui/tour-engine.mjs";
import { kfDot } from "../../scripts/ui/finisher-tour.mjs";

// The GM's own two-stage finisher open with nothing unsaved (`gm` is that state), then the
// practice finisher open on its stage 1, as a tour step would have it.
function dragStudio() {
  const w = busyStudio();
  const second = (r) => { r.stages.push({ ...structuredClone(r.stages[0]), stageId: "second" }); return r; };
  second(w.drafts.get("mine"));
  Object.assign(w, { dirty: new Set(), stageIndex: 0, keyframeIndex: 0, keyframeFocus: false, message: "" });
  const gm = studioState(w);
  w.drafts.set(TOUR_PRACTICE_ID, second(practiceFinisher("flying")));
  Object.assign(w, { selected: TOUR_PRACTICE_ID, stageIndex: 1 });
  return { w, gm };
}
// A keyframe dot as the studio has it: the drag's moves and release are heard on the dot itself.
// The grid's view is 6 squares on 600px: client (x, y) is square (x / 100 - 1, y / 100 - 3).
function keyframeDot(w) {
  const on = new Map();
  const svg = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 600, height: 600 }) };
  const canvas = { dataset: { kfView: "-1 -3 6 6" }, querySelector: () => svg };
  const dot = {
    dataset: { kfDot: "1" },
    closest: (sel) => (sel === "[data-kf-dot]" ? dot : sel === "[data-kf-canvas]" ? canvas : sel === ".an-studio" ? {} : null),
    getBoundingClientRect: () => ({ left: 495, top: 295, width: 10, height: 10 }),
    setAttribute() {},
    addEventListener: (type, fn) => on.set(type, [...(on.get(type) ?? []), fn]),
    removeEventListener: (type, fn) => on.set(type, (on.get(type) ?? []).filter((f) => f !== fn)),
    dispatchEvent(e) {
      if (e.type === "pointerdown") studioPointer(w, { type: e.type, clientX: e.clientX, clientY: e.clientY, button: 0, pointerId: 1, target: dot, preventDefault() {} });
      for (const fn of on.get(e.type) ?? []) fn(e);
      return true;
    },
    listening: () => (on.get("pointerup") ?? []).length > 0,
  };
  w.root = { querySelectorAll: () => [], querySelector: (sel) => (sel === kfDot(1) ? dot : sel === SEL.canvas ? canvas : null) };
  return dot;
}
const pointer = (type, x, y) => ({ type, clientX: x, clientY: y, button: 0, pointerId: 1 });

test("a keyframe drag commits only into the recipe and stage it started on, and never on pointercancel", () => {
  const done = dragStudio(), dot = keyframeDot(done.w);
  dot.dispatchEvent(pointer("pointerdown", 500, 300)); dot.dispatchEvent(pointer("pointermove", 300, 150)); dot.dispatchEvent(pointer("pointerup", 300, 150));
  assert.ok(done.w.dirty.has(TOUR_PRACTICE_ID), "a finished drag is an edit");
  assert.deepEqual([done.w.recipe().stages[1].keyframes[1].x, done.w.recipe().stages[1].keyframes[1].y], [2, -1.5]);

  const cancelled = dragStudio(), cdot = keyframeDot(cancelled.w), before = studioState(cancelled.w);
  cdot.dispatchEvent(pointer("pointerdown", 500, 300)); cdot.dispatchEvent(pointer("pointermove", 300, 150)); cdot.dispatchEvent(pointer("pointercancel", 300, 150));
  assert.deepEqual(studioState(cancelled.w), { ...before, keyframeFocus: true, keyframeIndex: 1 }, "a cancelled drag is no edit");
  assert.equal(cdot.listening(), false, "and it lets go of the dot");

  const swapped = dragStudio(), sdot = keyframeDot(swapped.w);
  sdot.dispatchEvent(pointer("pointerdown", 500, 300)); sdot.dispatchEvent(pointer("pointermove", 300, 150));
  restoreStudio(swapped.w, swapped.gm);
  sdot.dispatchEvent(pointer("pointerup", 300, 150));
  assert.deepEqual(studioState(swapped.w), swapped.gm, "the GM's recipe, opened mid-drag, is untouched and not dirty");
  assert.equal(sdot.listening(), false);

  const restaged = dragStudio(), rdot = keyframeDot(restaged.w), was = studioState(restaged.w);
  rdot.dispatchEvent(pointer("pointerdown", 500, 300)); rdot.dispatchEvent(pointer("pointermove", 300, 150));
  restaged.w.stageIndex = 0;
  rdot.dispatchEvent(pointer("pointerup", 300, 150));
  assert.deepEqual(studioState(restaged.w), { ...was, stageIndex: 0, keyframeFocus: true, keyframeIndex: 1 }, "another stage selected mid-drag: no edit");
});

test("Stop or Replay during the tour's keyframe drag never writes into the restored studio", async () => {
  for (const how of ["stop", "replay"]) {
    const dom = installFakeDOM();
    try {
      const { w, gm } = dragStudio(), dot = keyframeDot(w);
      let snap = null;
      const done = runTour({
        root: w.root, lead: 0,
        steps: [{ say: "Drag", show: async (h) => { await h.dragKeyframe(1, 2, -1.5); } }],
        snapshot: () => (snap = stepSnapshot(w)), restore: (s) => restoreStep(w, s),
        cleanup: () => restoreStudio(w, gm), surface: (hand) => studioSurface(w, hand),
      });
      const button = (name) => dom.caption().querySelector(`[data-tour="${name}"]`);
      for (let i = 0; i < 100 && !dot.listening(); i++) await settle(30);
      assert.ok(dot.listening(), "the drag has started");
      await settle(300);
      if (how === "replay") {
        button("replay").click(); await settle(150);
        assert.equal(JSON.stringify(w.drafts.get(TOUR_PRACTICE_ID)), snap.draft, "Replay: the step's own snapshot, unaltered");
        assert.equal(w.dirty.has(TOUR_PRACTICE_ID), false);
      }
      button("stop").click(); await done; await settle(150);
      assert.deepEqual(studioState(w), gm, `${how}: the GM's draft is unchanged and not dirty`);
      assert.equal(dot.listening(), false);
    } finally { dom.restore(); }
  }
});

test("a tour whose setup throws still puts the studio back and frees the Show me button", async () => {
  const w = busyStudio(), before = studioState(w);
  // No DOM at all: the engine throws creating its cursor.
  await assert.rejects(runFinisherTour(w, "flying", { lead: 0 }));
  assert.equal(w.touring, false);
  assert.deepEqual(studioState(w), before);
});

test("picking a tour never leaves an unhandled rejection", async () => {
  const w = busyStudio(), before = studioState(w);
  const unhandled = [];
  const watch = (reason) => unhandled.push(reason);
  process.on("unhandledRejection", watch);
  try {
    await click(w, { action: "finisher-tour", finisherTour: "flying" });
    await settle(50);
  } finally { process.off("unhandledRejection", watch); }
  assert.deepEqual(unhandled, []);
  assert.equal(w.touring, false);
  assert.match(w.message, /document is not defined/, "the failure is shown instead");
  assert.deepEqual(studioState(w), { ...before, showFinisherTours: false, message: w.message });
});

test("Ctrl+S and the recipe card menu's Duplicate and Delete leave the practice finisher alone", async () => {
  const w = busyStudio();
  w.drafts.set(TOUR_PRACTICE_ID, practiceFinisher("flying"));
  w.selected = TOUR_PRACTICE_ID;
  let confirms = 0;
  w.host.confirm = async () => { confirms++; return true; };
  const pending = [];
  const save = { click: () => { pending.push(click(w, { action: "save" })); } };
  w.root = { querySelectorAll: () => [], querySelector: (sel) => (sel === '.an-studio [data-action="save"]:not(:disabled)' ? save : null) };
  const key = { key: "s", ctrlKey: true, target: { closest: (sel) => (sel === ".an-studio" ? {} : null), matches: () => false }, preventDefault() {}, stopPropagation() {} };
  assert.equal(studioKey(w, key), true);
  assert.equal(pending.length, 1, "Ctrl+S clicked Save");
  await Promise.all(pending);
  const drafts = w.drafts.size;
  for (const action of ["recipe-menu-duplicate", "recipe-menu-delete"]) await click(w, { action, id: TOUR_PRACTICE_ID });
  assert.equal(w.saves, 0);
  assert.equal(confirms, 0, "no delete prompt for it");
  assert.equal(w.drafts.size, drafts, "no copy made");
  assert.ok(w.drafts.has(TOUR_PRACTICE_ID));
});

test("the Default finisher and a catalog Finisher dropdown never store the practice finisher", async () => {
  const w = busyStudio();
  const stored = [];
  w.host.setDefaultFinisher = async (id) => { stored.push(["default", id]); };
  w.host.save = async (recipes) => { stored.push(["save", recipes]); };
  const change = (attr, value, dataset = {}) => w.onChange({ target: { value, dataset, hasAttribute: (a) => a === attr } });
  change("data-finisher-default", TOUR_PRACTICE_ID);
  change("data-finisher-link", TOUR_PRACTICE_ID, { finisherLink: "Strike" });
  await settle();
  assert.deepEqual(stored, []);
  change("data-finisher-default", "mine");
  await settle();
  assert.deepEqual(stored, [["default", "mine"]], "a real finisher still goes through");
});

test("findInHTML: a ] inside a quoted attribute value is not mistaken for a class", () => {
  assert.equal(findInHTML('<i data-x="a].b"></i>', '[data-x="a].b"]').length, 1);
  assert.equal(findInHTML('<i class="b" data-x="a].c"></i>', 'i.b[data-x="a].c"]').length, 1);
});
