import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runTour, Interrupted } from "../../scripts/ui/tour-engine.mjs";
import { FLASH_TOURS, runFlashTour } from "../../scripts/ui/flash-tour.mjs";
import { installFakeDOM } from "../helpers/fake-dom.mjs";

const settle = (ms = 20) => new Promise((r) => setTimeout(r, ms));
const deferred = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; };
// Starts a tour on a fake DOM. `state.value` stands for the editor: snapshot/restore read and write it.
function start(steps, extra = {}) {
  const dom = installFakeDOM();
  const state = { value: "original" }, restored = [], cleaned = [];
  const done = runTour({
    root: { querySelector: () => null }, steps, lead: 0,
    snapshot: () => ({ value: state.value }),
    restore: (s) => { restored.push(s); state.value = s.value; },
    cleanup: () => { cleaned.push(state.value); state.value = "original"; },
    ...extra,
  });
  const button = (name) => dom.caption()?.querySelector(`[data-tour="${name}"]`) ?? null;
  return { dom, state, restored, cleaned, done, button };
}

test("Next stays disabled until the step has been shown", async () => {
  const gate = deferred();
  const t = start([{ say: "One", show: async () => { await gate.promise; } }, { say: "Two", show: async () => {} }]);
  try {
    await settle();
    assert.match(t.dom.caption().innerHTML, /Step 1 of 2/);
    assert.equal(t.button("next").disabled, true, "not shown yet");
    assert.equal(t.button("back").disabled, true, "no step before the first");
    gate.resolve(); await settle();
    assert.equal(t.button("next").disabled, false);
    t.button("stop").click(); await t.done;
  } finally { t.dom.restore(); }
});

test("Back restores the snapshot taken before the previous step; Replay restores this step's", async () => {
  const shown = [];
  const t = start([
    { say: "One", show: async () => { shown.push(1); t.state.value = "after one"; } },
    { say: "Two", show: async () => { shown.push(2); t.state.value = "after two"; } },
  ]);
  try {
    await settle(); t.button("next").click(); await settle();
    assert.equal(t.state.value, "after two");
    t.button("replay").click(); await settle();
    assert.deepEqual(t.restored.at(-1), { value: "after one" }, "Replay: the state before step two");
    t.button("back").click(); await settle();
    assert.deepEqual(t.restored.at(-1), { value: "original" }, "Back: the state before step one");
    assert.deepEqual(shown, [1, 2, 2, 1]);
    assert.match(t.dom.caption().innerHTML, /Step 1 of 2/);
    t.button("stop").click(); await t.done;
  } finally { t.dom.restore(); }
});

test("Stop ends the tour: cleanup once, cursor, caption and listeners gone", async () => {
  const t = start([{ say: "One", show: async () => { t.state.value = "changed"; } }]);
  try {
    await settle();
    assert.equal(t.dom.listeners.length, 2, "pointerdown and keydown");
    t.button("stop").click(); await t.done;
    assert.deepEqual(t.cleaned, ["changed"]);
    assert.equal(t.state.value, "original");
    assert.equal(t.dom.caption(), null);
    assert.equal(t.dom.cursor(), null);
    assert.equal(t.dom.listeners.length, 0);
  } finally { t.dom.restore(); }
});

test("Esc or a real click outside the caption ends it; other keys and synthetic clicks do not", async () => {
  const t = start([{ say: "One", show: async () => {} }]);
  try {
    await settle();
    t.dom.fire("keydown", { key: "a" });
    t.dom.fire("pointerdown", { isTrusted: false, target: {} });
    t.dom.fire("pointerdown", { isTrusted: true, target: t.button("replay") });
    await settle();
    assert.equal(t.cleaned.length, 0, "still running");
    t.dom.fire("keydown", { key: "Escape" }); await t.done;
    assert.equal(t.cleaned.length, 1);
  } finally { t.dom.restore(); }
  const u = start([{ say: "One", show: async () => {} }]);
  try {
    await settle();
    u.dom.fire("pointerdown", { isTrusted: true, target: {} }); await u.done;
    assert.equal(u.cleaned.length, 1);
  } finally { u.dom.restore(); }
});

// Foundry's KeyboardManager listens for keydown on window in the bubble phase; its core
// "dismiss" binding would close the Animater window (and the restored drafts with it). The tour's
// listener is a window capture listener, so it runs first, and it swallows the Esc.
test("Esc is swallowed: prevented and stopped in the window capture phase before Foundry sees it", async () => {
  const t = start([{ say: "One", show: async () => {} }]);
  try {
    await settle();
    const key = t.dom.listeners.find((l) => l.type === "keydown");
    assert.equal(key.options?.capture, true, "registered for the capture phase");
    const event = (k) => ({ key: k, calls: [], preventDefault() { this.calls.push("prevent"); }, stopPropagation() { this.calls.push("stop"); }, stopImmediatePropagation() { this.calls.push("immediate"); } });
    const other = event("a");
    t.dom.fire("keydown", other);
    assert.deepEqual(other.calls, [], "other keys reach the page untouched");
    const esc = event("Escape");
    t.dom.fire("keydown", esc); await t.done;
    assert.deepEqual(esc.calls.sort(), ["immediate", "prevent", "stop"]);
    assert.equal(t.cleaned.length, 1);
  } finally { t.dom.restore(); }
});

test("the last step's Next says Finish and ends the tour", async () => {
  const t = start([{ say: "One", show: async () => {} }, { say: "Two", show: async () => {} }]);
  try {
    await settle();
    assert.match(t.dom.caption().innerHTML, /Next ›/);
    t.button("next").click(); await settle();
    assert.match(t.dom.caption().innerHTML, />Finish</);
    t.button("next").click(); await t.done;
    assert.equal(t.cleaned.length, 1);
  } finally { t.dom.restore(); }
});

test("a missing element stops the step quietly; any other error ends the tour", async () => {
  const t = start([{ say: "One", show: async () => { throw new Interrupted(); } }]);
  try {
    await settle();
    assert.ok(t.dom.caption(), "the caption stays for Replay, Back or Stop");
    assert.equal(t.button("next").disabled, false);
    assert.equal(t.cleaned.length, 0);
    t.button("stop").click(); await t.done;
  } finally { t.dom.restore(); }
  const u = start([{ say: "One", show: async () => { throw new TypeError("boom"); } }]);
  try {
    await u.done;
    assert.equal(u.cleaned.length, 1);
    assert.equal(u.dom.caption(), null);
  } finally { u.dom.restore(); }
});

test("surface helpers reach the steps, and find falls back to the surface's finder", async () => {
  const got = [];
  const t = start([{ say: "One", show: async (h) => {
    got.push(h.extra, await h.find("#only-in-surface"));
    try { await h.find("#nowhere"); } catch (error) { got.push(error instanceof Interrupted); }
  } }], { surface: (hand) => ({ extra: typeof hand.click, find: async (selector) => (selector === "#only-in-surface" ? { found: selector } : null) }) });
  try {
    await settle();
    assert.deepEqual(got, ["function", { found: "#only-in-surface" }, true]);
    t.button("stop").click(); await t.done;
  } finally { t.dom.restore(); }
});

test("an interrupted drag still releases the pointer", async () => {
  const events = [];
  const target = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 10, height: 10 }), dispatchEvent: (e) => { events.push(["target", e.type]); return true; } };
  const receiver = { dispatchEvent: (e) => { events.push(["receiver", e.type]); return true; } };
  const t = start([{ say: "Drag", show: async (h) => { await h.drag(target, { x: 300, y: 300 }, 3000, { receiver }); } }]);
  try {
    await settle(1500);
    const cursor = t.dom.cursor();
    assert.ok(cursor.classList.contains("is-down"), "mid-drag");
    t.button("stop").click(); await t.done; await settle(150);
    assert.deepEqual(events[0], ["target", "pointerdown"]);
    assert.ok(events.some(([to, type]) => to === "receiver" && type === "pointermove"));
    assert.deepEqual(events.at(-1), ["receiver", "pointerup"]);
    assert.equal(cursor.classList.contains("is-down"), false);
    assert.deepEqual(t.dom.windowEvents, [], "a receiver keeps the moves off window");
  } finally { t.dom.restore(); }
});

test("an interrupted drag can be cancelled instead of released, so the editor commits nothing", async () => {
  const events = [];
  const target = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 10, height: 10 }), dispatchEvent: (e) => { events.push(e.type); return true; } };
  const t = start([{ say: "Drag", show: async (h) => { await h.drag(target, { x: 300, y: 300 }, 3000, { receiver: target, cancel: "pointercancel" }); } }]);
  try {
    await settle(1500);
    t.button("stop").click(); await t.done; await settle(150);
    assert.equal(events[0], "pointerdown");
    assert.equal(events.at(-1), "pointercancel");
    assert.ok(!events.includes("pointerup"), "no release reaches the editor");
  } finally { t.dom.restore(); }
});

test("Flash keeps its tours and its API, and hands the machinery to the shared engine", async () => {
  assert.ok(Object.isFrozen(FLASH_TOURS));
  assert.deepEqual({ ...FLASH_TOURS }, {
    slide: { label: "A sliding title", detail: "Keyframes: move text across the screen." },
    signature: { label: "A signature move", detail: "An attack's big moment: background, band, letters, impact, linked to a recipe." },
  });
  const src = readFileSync(new URL("../../scripts/ui/flash-tour.mjs", import.meta.url), "utf8");
  assert.match(src, /from "\.\/tour-engine\.mjs"/);
  assert.doesNotMatch(src, /createElement|addEventListener|an-tour-cursor/, "no cursor, caption or listeners of its own");
  const engine = readFileSync(new URL("../../scripts/ui/tour-engine.mjs", import.meta.url), "utf8");
  for (const cls of ["an-tour-cursor", "an-tour-caption", "an-tour-step", "an-tour-text", "an-tour-nav"]) assert.match(engine, new RegExp(cls));
  assert.equal(await runFlashTour({ touring: true, w: null }, "slide"), undefined, "a running tour is never started twice");
});

test("Esc ends a Flash tour and puts the Flash editor back exactly", async () => {
  const dom = installFakeDOM();
  try {
    let renders = 0;
    const draft = { id: "mine", name: "Mine" }, undo = ["u1"], redo = [];
    const editor = { w: { root: { querySelector: () => null }, render: () => { renders++; } }, touring: false, editing: false, selectedId: "mine", draft, dirty: true, layerIndex: 2, time: 900, undoStack: undo, redoStack: redo, preview: null, playing: false };
    const running = runFlashTour(editor, "slide");
    assert.equal(editor.touring, true);
    assert.equal(editor.selectedId, "tour-practice");
    assert.equal(editor.draft.name, "Practice: a sliding title");
    await settle();
    dom.fire("keydown", { key: "Escape" });
    await running;
    assert.equal(editor.touring, false);
    assert.equal(editor.draft, draft);
    assert.deepEqual([editor.editing, editor.selectedId, editor.dirty, editor.layerIndex, editor.time], [false, "mine", true, 2, 900]);
    assert.equal(editor.undoStack, undo);
    assert.equal(editor.redoStack, redo);
    assert.ok(renders >= 2);
  } finally { dom.restore(); }
});
