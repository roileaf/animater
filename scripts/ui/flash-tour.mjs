// "Show me": a guided walkthrough in the Flash screens editor, at the GM's pace. Each step shows
// its caption, then a virtual mouse demonstrates it once on the real interface; Next moves on,
// Back returns to the step before (restoring the screen as it was) and Replay shows it again.
// Everything happens on a practice screen that is never saved. Stop, Esc or a click elsewhere
// ends it and puts the editor back as it was. The machinery is shared: scripts/tour-engine.mjs.
import { validateFlash } from "../engines/flash/flash-model.mjs";
import { runTour, wait, center } from "./tour-engine.mjs";

export const FLASH_TOURS = Object.freeze({
  slide: { label: "A sliding title", detail: "Keyframes: move text across the screen." },
  signature: { label: "A signature move", detail: "An attack's big moment: background, band, letters, impact, linked to a recipe." },
});

// Flash's own hand: points on its 16:9 stage, its time slider, and fields on the inspector's other tab.
function flashSurface(editor, root) {
  return (hand) => {
    const frame = () => root.querySelector("[data-flash-stage]").getBoundingClientRect();
    const at = (x, y) => { const f = frame(); return { x: f.left + (x / 100) * f.width, y: f.top + (y / 100) * f.height }; };
    const scrubTo = async (ms) => {
      const range = root.querySelector("[data-flash-time]"), r = range.getBoundingClientRect(), max = Number(range.max) || 1;
      const x = (t) => r.left + 8 + ((r.width - 16) * t) / max, y = r.top + r.height / 2;
      await hand.moveTo({ x: x(editor.time), y }); hand.setDown(true);
      const from = editor.time, steps = 20;
      for (let i = 1; i <= steps; i++) {
        hand.check();
        const t = from + ((ms - from) * i) / steps;
        hand.place({ x: x(t), y }, 60); await wait(60);
        range.value = String(Math.round(t)); range.dispatchEvent(new Event("input", { bubbles: true }));
      }
      hand.setDown(false); await hand.pause(400);
    };
    // A field on the inspector's other tab: click that tab first.
    const find = async (selector) => {
      const tab = /data-flash-field="(backdrop|duck|sound)/.test(selector) ? "screen" : /data-flash-(layer|key)-field/.test(selector) ? "layer" : null;
      if (tab) await hand.click(`[data-action="flash-tab"][data-tab="${tab}"]`);
      return root.querySelector(selector);
    };
    return { at, scrubTo, find };
  };
}

export async function runFlashTour(editor, tour = "slide") {
  if (editor.touring) return;
  const w = editor.w, root = w.root;
  editor.touring = true;
  const saved = { editing: editor.editing, selectedId: editor.selectedId, draft: editor.draft, dirty: editor.dirty, layerIndex: editor.layerIndex, time: editor.time, undo: editor.undoStack, redo: editor.redoStack };
  editor.selectedId = "tour-practice"; editor.editing = true;
  editor.draft = validateFlash(tour === "signature"
    ? { id: "tour-practice", name: "Practice: Dragon's Fury", event: "start", duration: 3800, backdrop: { color: "#0a0303", opacity: 0.75, vignette: true }, layers: [] }
    : { id: "tour-practice", name: "Practice: a sliding title", duration: 3200, backdrop: { color: "#05040c", opacity: 0.7 }, layers: [] });
  editor.dirty = false; editor.layerIndex = 0; editor.time = 0; editor.undoStack = []; editor.redoStack = [];
  w.render();

  const text = () => root.querySelector('[data-flash-stage] [data-flash-layer="0"] .an-flash-text');
  // ---- the steps: what the caption says, and what the hand shows
  const layerText = (index) => root.querySelector(`[data-flash-stage] [data-flash-layer="${index}"] .an-flash-text`);
  const slide = [
    { say: "Let's make a title slide across the screen. We'll practise on a scratch screen that is never saved. Press <b>Next</b> when you're ready.", show: async () => {} },
    { say: "First, add a text layer with <b>+ Text</b>.", show: async (h) => { await h.click('[data-action="flash-add"][data-kind="text"]'); } },
    { say: "Type your words in the inspector's <b>Text</b> box.", show: async (h) => { await h.type('textarea[data-flash-layer-field="text"]', "CHARGE!"); } },
    { say: "Move the playhead (the slider under the stage) to where the motion should <b>start</b>, then drag the text to its starting spot on the left.", show: async (h) => { await h.scrubTo(400); await h.drag(text(), h.at(20, 50)); } },
    { say: "Click <b>◆ Add keyframe</b> (or press <b>K</b>). It pins the text here, at this moment.", show: async (h) => { await h.click('[data-action="flash-key-add"]'); } },
    { say: "Move the playhead to where the motion should <b>end</b>, and drag the text to the right. The layer already has a keyframe, so this adds a second one here.", show: async (h) => { await h.scrubTo(2400); await h.drag(text(), h.at(80, 50)); } },
    { say: "The two <b>◆</b> on the layer's row are the keyframes. The text glides between them. Drag a ◆ along the row to change its timing.", show: async (h) => {
      for (const k of root.querySelectorAll(".an-flash-row.is-selected .an-flash-key")) { k.scrollIntoView({ block: "nearest" }); await h.moveTo(center(k), 900); await h.pause(500); }
    } },
    { say: "Press <b>▶ Preview</b> (or Space) to watch it. Keyframes can also scale (corner handle), turn (round handle) and fade (mouse wheel).", show: async (h) => { await h.click('[data-action="flash-preview"]'); } },
    { say: "That's it! Use <b>+ New flash screen</b> to make your own. Press <b>Finish</b> and the practice screen goes away.", show: async () => {} },
  ];
  const signature = [
    { say: "Let's build a <b>signature move</b>: a card that plays right before an attack, spell or ability animation, with its name filled in. Practice screen, never saved. Press <b>Next</b>.", show: async () => {} },
    { say: "Set <b>Plays at</b> to <b>Before an animation</b>, so recipes can use it.", show: async (h) => { await h.choose('select[data-flash-field="event"]', "action"); } },
    { say: "In <b>Screen</b>, pick an animated background (<b>Ember fog</b>) and turn on <b>Cinematic bars</b>.", show: async (h) => {
      await h.choose('select[data-flash-field="backdrop.media"]', "jb2a.ambient_fog.001.loop.large.orangeyellow");
      await h.tick('input[data-flash-field="backdrop.bars"]');
    } },
    { say: "Add a <b>+ Band</b>: the slanted stripe the title sits on. Give it a deep red.", show: async (h) => {
      await h.click('[data-action="flash-add"][data-kind="band"]');
      await h.choose('input[data-flash-layer-field="color"]', "#7a1400");
    } },
    { say: "Add <b>+ Text</b> and type <b>{action}</b>. When the card plays it becomes the attack's name: here it shows a sample, “Dragon's Fury”.", show: async (h) => {
      await h.click('[data-action="flash-add"][data-kind="text"]');
      await h.type('textarea[data-flash-layer-field="text"]', "{action}");
    } },
    { say: "Make it big: <b>drag the Size label</b> to the right (any number label can be dragged like this).", show: async (h) => { await h.scrubLabel('input[data-flash-layer-field="size"]', 110); } },
    { say: "Tick <b>Gradient to</b> for a hot fill, and set <b>Letters one by one</b> so each letter slams in.", show: async (h) => {
      await h.tick('input[data-flash-layer-field="gradient"]');
      await h.type('input[data-flash-layer-field="letters"]', "45");
    } },
    { say: "Move the playhead to where the last letter lands and add <b>+ Flash</b> and <b>+ Shake</b>: they hit at the playhead.", show: async (h) => {
      await h.scrubTo(1100);
      await h.click('[data-action="flash-add"][data-kind="flash"]');
      await h.click('[data-action="flash-add"][data-kind="shake"]');
    } },
    { say: "Add one more <b>+ Text</b> with <b>{name}</b> (who uses the move), and drag it under the title.", show: async (h) => {
      await h.click('[data-action="flash-add"][data-kind="text"]');
      await h.type('textarea[data-flash-layer-field="text"]', "{name}");
      await h.scrubTo(2400);
      await h.drag(layerText(editor.layerIndex), h.at(50, 66));
    } },
    { say: "Press <b>▶ Preview</b> to watch it.", show: async (h) => { await h.click('[data-action="flash-preview"]'); } },
    { say: "To use it: open a recipe in the Studio, click its trigger (⚙ <b>Recipe settings</b>) and pick it under <b>Flash screen first</b>. It plays for everyone right before that animation.", show: async (h) => {
      const recipes = root.querySelector('[data-action="page"][data-page="recipes"]'); if (recipes) { await h.moveTo(center(recipes)); await h.pause(900); }
    } },
    { say: "Done! Press <b>Finish</b> and the practice screen goes away.", show: async () => {} },
  ];
  const steps = tour === "signature" ? signature : slide;
  const snapshot = () => ({ draft: JSON.stringify(editor.draft), time: editor.time, layerIndex: editor.layerIndex });
  const restore = (s) => {
    editor.preview?.stop(); editor.playing = false;
    Object.assign(editor, { draft: JSON.parse(s.draft), time: s.time, layerIndex: s.layerIndex, dirty: false });
    w.render();
  };
  const cleanup = () => {
    editor.preview?.stop(); editor.playing = false;
    Object.assign(editor, { editing: saved.editing, selectedId: saved.selectedId, draft: saved.draft, dirty: saved.dirty, layerIndex: saved.layerIndex, time: saved.time, undoStack: saved.undo, redoStack: saved.redo });
    editor.touring = false;
    w.render();
  };
  await runTour({ root, steps, snapshot, restore, cleanup, surface: flashSurface(editor, root) });
}
