// "Show me" for finishers: two guided tours that build a finisher in the studio on a practice
// finisher that is never saved (id tour-practice). The engine is shared with Flash
// (tour-engine.mjs); this file holds the steps, the practice recipes, the studio's own hand
// (timeline scrub, path grid, settings dialog) and the snapshot that puts the studio back.
// Each step declares the selectors it uses (`targets`): tests/finisher-tour.test.mjs renders the
// studio at every step and checks they resolve, so a UI rename breaks a test, not the tour.
import { validateRecipe } from "../core/model.mjs";
import { squaresToCanvas } from "./keyframe-ui.mjs";
import { runTour, center, wait, Interrupted } from "./tour-engine.mjs";

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
export const TOUR_PRACTICE_ID = "tour-practice";
export const FINISHER_TOURS = Object.freeze({
  flying: { label: "A flying finisher", detail: "Keyframes: fling the target along a path, stretch it, slam it into a wall." },
  shattering: { label: "A shattering finisher", detail: "Fragments: cut the target into pieces that fly apart." },
});

// The studio's markup the tours use (studio.mjs, workspace.mjs, keyframe-ui.mjs, fragments-ui.mjs,
// finisher-ui.mjs). Compound selectors only, each matching one element.
export const SEL = Object.freeze({
  settings: ".an-st-settings",
  settingsOpen: "button.an-st-trigger",
  settingsClose: 'button[aria-label="Close recipe settings"]',
  on: 'select[data-field="finisher.on"]',
  ending: 'select[data-field="finisher.ending"]',
  wall: 'select[data-field="finisher.wall"]',
  label: 'input[data-field="label"]',
  asset: "button.an-asset-picker",
  addTarget: 'button[data-action="studio-add"][data-st-track="target"]',
  addMotion: 'button[data-action="studio-add"][data-st-track="motion"]',
  motion: 'select[data-field="motion"]',
  subject: 'select[data-field="subject"]',
  motionEnd: 'select[data-field="motionEnd"]',
  canvas: "[data-kf-canvas]",
  kfX: 'input[data-kf-field="x"]',
  kfStretch: 'input[data-kf-field="stretch"]',
  kfScale: 'input[data-kf-field="scale"]',
  kfAdd: 'button[data-action="kf-add"]',
  smooth: 'button[data-action="kf-smooth"]',
  pathEase: 'select[data-field="pathEase"]',
  pattern: 'select[data-field="pattern"]',
  cut: 'select[data-field="cut"]',
  pieces: 'input[data-field="pieces"]',
  spread: 'input[data-field="spread"]',
  spin: 'input[data-field="spin"]',
  fall: 'input[data-field="fall"]',
  fade: 'input[data-field="fade"]',
  ruler: "[data-st-ruler]",
  timeline: "[data-studio-tl]",
  play: 'button[data-action="studio-play"]',
});
export const kfSelect = (i) => `button[data-action="kf-select"][data-kf="${i}"]`;
export const kfDot = (i) => `[data-kf-dot="${i}"]`;
export const kfDiamond = (i) => `[data-kf-diamond="${i}"]`;

// A recipe needs a stage, so each practice finisher starts with one unnamed Target stage.
const PRACTICE = {
  flying: { name: "Practice: Thunder shove", finisher: { on: "use", ending: "body" }, assets: ["jb2a.impact.003.white"] },
  shattering: { name: "Practice: Shattered", finisher: { on: "kill", ending: "body" }, assets: ["jb2a.melee_generic.slash"] },
};
export function practiceFinisher(tour) {
  const p = PRACTICE[tour] ?? PRACTICE.flying;
  return validateRecipe({
    id: TOUR_PRACTICE_ID, name: p.name, description: "A practice finisher from the guided tour. It is never saved.",
    trigger: "manual", color: "#c0392b", finisher: p.finisher,
    stages: [{ stageId: "first", kind: "impact", subject: "targets", assets: p.assets, duration: 900 }],
  });
}

const flying = () => [
  { say: "Let's build a <b>finisher</b>: an animation that really moves the target token when it plays. This one flings the target along a path into a wall. It's a practice finisher that is never saved. Press <b>Next</b> when you're ready.",
    targets: [], show: async () => {} },
  { say: "Click the <b>⚙</b> chip to open the <b>Recipe settings</b>, and set <b>Plays on</b> to <b>Killing blow</b>. (<b>At walls</b> appears once the finisher has a path. We'll set it later.)",
    targets: [SEL.settingsOpen, SEL.on, SEL.settingsClose],
    show: async (h) => { await h.openSettings(); await h.choose(SEL.on, "kill"); await h.pause(400); await h.closeSettings(); } },
  { say: "The <b>Target</b> track already has an impact stage. Name it <b>hit</b> in <b>Stage name</b>. Its <b>Visual asset</b> is an impact; <b>Browse ↗</b> picks another one from Assets.",
    targets: [SEL.label, SEL.asset],
    show: async (h) => { await h.type(SEL.label, "hit"); await h.pointAt(SEL.asset); } },
  { say: "On the <b>Token motion</b> track press <b>+</b>. Set <b>Motion</b> to <b>Keyframed path</b>, <b>Animate</b> to <b>Target tokens</b>, and <b>End</b> to <b>Hold at the end</b>: the finisher moves the token to where the path ends.",
    targets: [SEL.addMotion, SEL.motion, SEL.subject, SEL.motionEnd],
    show: async (h) => {
      await h.click(SEL.addMotion);
      await h.choose(SEL.motion, "path");
      await h.choose(SEL.subject, "targets");
      await h.choose(SEL.motionEnd, "hold");
    } },
  { say: "The grid shows the path from above; +x is away from the attacker. Drag the end dot out, or type <b>X (squares)</b> 4. Then select keyframe <b>1</b> and press <b>+ Keyframe after</b> to add one in the middle (double-clicking the path's timeline bar adds one too), and drag it up into an arc.",
    targets: [SEL.canvas, kfDot(1), SEL.kfX, kfSelect(0), SEL.kfAdd],
    show: async (h) => {
      await h.dragKeyframe(1, 1.8, 0);
      await h.choose(SEL.kfX, "4");
      await h.click(kfSelect(0));
      await h.click(SEL.kfAdd);
      await h.dragKeyframe(1, 2, -1.5);
    } },
  { say: "Each <b>◆</b> on the path's timeline bar is a keyframe. Select the middle one (<b>2</b>) and set <b>Stretch</b> to 0.2, so it stretches along the flight, and <b>Size ×</b> to 1.15 for a slight swell.",
    targets: [kfDiamond(1), kfSelect(1), SEL.kfStretch, SEL.kfScale],
    show: async (h) => {
      await h.pointAt(kfDiamond(1));
      await h.click(kfSelect(1));
      await h.choose(SEL.kfStretch, "0.2");
      await h.choose(SEL.kfScale, "1.15");
    } },
  { say: "Set <b>Path easing</b> to <b>Smooth deceleration</b>: fast off the hit, slowing as it lands. <b>Make smooth</b> sets every keyframe to Linear, so the path stays one continuous motion.",
    targets: [SEL.pathEase, SEL.smooth],
    show: async (h) => { await h.choose(SEL.pathEase, "easeOutCubic"); await h.pointAt(SEL.smooth); } },
  { say: "Open the settings again. Now that there is a held path, <b>At walls</b> is there: set it to <b>Slam into it</b>. Then move the playhead near the end and add two <b>Target</b> stages, <b>landing</b> and <b>wall-crack</b>. The landing plays where the token lands, stages named <b>wall…</b> play where it hits a wall, and a slam cuts the flight short there.",
    targets: [SEL.settingsOpen, SEL.wall, SEL.settingsClose, SEL.ruler, SEL.timeline, SEL.addTarget, SEL.label],
    show: async (h) => {
      await h.openSettings(); await h.choose(SEL.wall, "slam"); await h.closeSettings();
      await h.scrubTo(2000);
      await h.click(SEL.addTarget); await h.type(SEL.label, "landing");
      await h.click(SEL.addTarget); await h.type(SEL.label, "wall-crack");
    } },
  { say: "Drag along the ruler to scrub through it, then press <b>▶</b> to play the whole finisher in the preview. With nothing selected or targeted, stand-in tokens play the parts.",
    targets: [SEL.ruler, SEL.timeline, SEL.play],
    show: async (h) => { await h.scrubTo(600); await h.pause(300); await h.click(SEL.play); } },
  { say: "That's it! Use <b>+ New finisher</b> or a preset to make your own, then assign it under <b>Applies to</b>. Press <b>Finish</b> and the practice finisher goes away.",
    targets: [], show: async () => {} },
];

const shattering = () => [
  { say: "Let's build a finisher that <b>shatters</b> the target: the token is cut into pieces that fly apart. It's a practice finisher that is never saved. Press <b>Next</b> when you're ready.",
    targets: [], show: async () => {} },
  { say: "Click the <b>⚙</b> chip to open the <b>Recipe settings</b>. Set <b>Plays on</b> to <b>Critical hit or killing blow</b>, and <b>Ending</b> to <b>Vanish</b>, so nothing is left behind.",
    targets: [SEL.settingsOpen, SEL.on, SEL.ending, SEL.settingsClose],
    show: async (h) => { await h.openSettings(); await h.choose(SEL.on, "criticalOrKill"); await h.choose(SEL.ending, "vanish"); await h.pause(400); await h.closeSettings(); } },
  { say: "The <b>Target</b> track already has a stage for the strike. Name it <b>slash</b> in <b>Stage name</b>.",
    targets: [SEL.label],
    show: async (h) => { await h.type(SEL.label, "slash"); } },
  { say: "On the <b>Token motion</b> track press <b>+</b>. Set <b>Motion</b> to <b>Token fragments</b>, <b>Animate</b> to <b>Target tokens</b> and <b>End</b> to <b>Hold at the end</b>. Use <b>Pattern</b> Slice in half, cut to follow the attack, then set <b>Spread</b>, <b>Spin</b>, <b>Fall</b> and <b>Fade</b>.",
    targets: [SEL.addMotion, SEL.motion, SEL.subject, SEL.motionEnd, SEL.pattern, SEL.cut, SEL.spread, SEL.spin, SEL.fall, SEL.fade],
    show: async (h) => {
      await h.click(SEL.addMotion);
      await h.choose(SEL.motion, "fragments");
      await h.choose(SEL.subject, "targets");
      await h.choose(SEL.motionEnd, "hold");
      await h.choose(SEL.pattern, "halves");
      await h.choose(SEL.cut, "attack");
      await h.choose(SEL.spread, "0.8");
      await h.choose(SEL.spin, "60");
      await h.choose(SEL.fall, "0.5");
      await h.choose(SEL.fade, "800");
    } },
  { say: "Switch <b>Pattern</b> to <b>Shards</b> and set <b>Pieces</b> to 7. Then try <b>Dust</b>: the token crumbles away.",
    targets: [SEL.pattern, SEL.pieces],
    show: async (h) => { await h.choose(SEL.pattern, "shards"); await h.choose(SEL.pieces, "7"); await h.pause(600); await h.choose(SEL.pattern, "dust"); } },
  { say: "Press <b>▶</b>: the pieces fly in the preview. With nothing selected or targeted, stand-in tokens play the parts.",
    targets: [SEL.play],
    show: async (h) => { await h.click(SEL.play); } },
  { say: "Done! Use <b>+ New finisher</b> or a preset (<b>Slice in half</b>, <b>Shatter into shards</b>, <b>Disintegrate</b>) to make your own. Press <b>Finish</b> and the practice finisher goes away.",
    targets: [], show: async () => {} },
];

export const finisherSteps = (tour) => (tour === "shattering" ? shattering() : flying());

// The studio's own hand, on top of the engine's (tour-engine.mjs).
export function studioSurface(w, hand) {
  const q = (selector) => w.root.querySelector(selector);
  const need = (el) => { if (!el) throw new Interrupted(); return el; };
  const openSettings = async () => { if (!q(SEL.settings)) await hand.click(SEL.settingsOpen); };
  const closeSettings = async () => { if (q(SEL.settings)) await hand.click(SEL.settingsClose); };
  // A point on the path grid, in squares, as screen coordinates (the grid's view changes per path).
  const pathPoint = (x, y) => {
    const canvas = need(q(SEL.canvas)), svg = need(canvas.querySelector("svg"));
    const [vx, vy, vw, vh] = canvas.dataset.kfView.split(" ").map(Number);
    return squaresToCanvas({ x, y }, svg.getBoundingClientRect(), { x: vx, y: vy, w: vw, h: vh });
  };
  const keyframeHandle = (i) => q(kfDot(i));
  const diamond = (i) => q(kfDiamond(i));
  // The studio listens for a dot's moves on the dot itself (studio.mjs studioPointer). A drag cut
  // short by Back, Replay or Stop ends in pointercancel: the studio has been put back by then, and
  // a release would commit the move into whatever recipe is open now.
  const dragKeyframe = async (i, x, y) => { const dot = need(keyframeHandle(i)); await hand.drag(dot, pathPoint(x, y), 1400, { receiver: dot, cancel: "pointercancel" }); };
  const pointAt = async (selector) => {
    const el = need(q(selector));
    el.scrollIntoView({ block: "nearest" }); await hand.pause(150);
    await hand.moveTo(center(el)); await hand.pause(700);
  };
  // Scrub like a hand on the ruler: press on it, then move across the timeline (studioPointer).
  const scrubTo = async (ms) => {
    const ruler = need(q(SEL.ruler)), tl = need(q(SEL.timeline));
    ruler.scrollIntoView({ block: "nearest" }); await hand.pause(150);
    const r = ruler.getBoundingClientRect(), total = Number(tl.dataset.tlTotal) || 1000, y = r.top + r.height / 2;
    const x = (t) => r.left + (r.width * Math.min(total, Math.max(0, t))) / total;
    const from = w.studioTime ?? 0, steps = 20;
    await hand.moveTo({ x: x(from), y }); hand.setDown(true);
    ruler.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: x(from), clientY: y, button: 0, pointerId: 1 }));
    let last = { x: x(from), y };
    try {
      for (let i = 1; i <= steps; i++) {
        hand.check();
        last = { x: x(from + ((ms - from) * i) / steps), y };
        hand.place(last, 60); await wait(60);
        tl.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: last.x, clientY: y, button: 0, pointerId: 1 }));
      }
    } finally {
      tl.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, clientX: last.x, clientY: y, button: 0, pointerId: 1 }));
      hand.setDown(false);
    }
    await hand.pause(400);
  };
  // Finisher fields live in the settings dialog: open it first.
  const find = async (selector) => { if (/data-field="finisher\./.test(selector)) await openSettings(); return q(selector); };
  return { openSettings, closeSettings, pathPoint, keyframeHandle, diamond, dragKeyframe, pointAt, scrubTo, find };
}

// ---- putting the studio back. The studio has no undo stack: its state is the page, the open
// recipe, the drafts and their dirty flags, and the view (stage, keyframe, playhead, dialog, zoom).
const STUDIO_FIELDS = ["page", "studio", "selected", "stageIndex", "studioTime", "keyframeIndex", "keyframeFocus", "studioSettings", "previewMode", "message", "studioZoom", "studioLoop", "fragmentsPreviewAt", "showFinisherTours"];
const copyDrafts = (drafts) => new Map([...drafts].map(([id, r]) => [id, structuredClone(r)]));
export function studioState(w) {
  return { ...Object.fromEntries(STUDIO_FIELDS.map((k) => [k, w[k]])), drafts: copyDrafts(w.drafts), dirty: new Set(w.dirty) };
}
export function restoreStudio(w, state) {
  w.stopEditorPreview?.();
  w.studioPlaying = false;
  const { drafts, dirty, ...fields } = state;
  Object.assign(w, fields, { drafts: copyDrafts(drafts), dirty: new Set(dirty) });
}
// Per step (Back, Replay): the practice draft and what the studio shows of it.
export const stepSnapshot = (w) => ({ draft: JSON.stringify(w.drafts.get(TOUR_PRACTICE_ID)), stageIndex: w.stageIndex, keyframeIndex: w.keyframeIndex, keyframeFocus: w.keyframeFocus, studioTime: w.studioTime, studioSettings: w.studioSettings, fragmentsPreviewAt: w.fragmentsPreviewAt });
export function restoreStep(w, snap) {
  w.stopEditorPreview?.();
  w.studioPlaying = false;
  const { draft, ...view } = snap;
  w.drafts.set(TOUR_PRACTICE_ID, JSON.parse(draft));
  w.dirty.delete(TOUR_PRACTICE_ID);
  Object.assign(w, view, { page: "finishers", studio: true, selected: TOUR_PRACTICE_ID });
  w.render();
}

// The Finishers page's "Show me" button and menu (the Flash menu's markup and classes).
export function finisherToursHTML(open) {
  const menu = open ? `<span class="an-flash-tour-menu" role="menu">${Object.entries(FINISHER_TOURS).map(([id, t]) => `<button role="menuitem" data-action="finisher-tour" data-finisher-tour="${id}"><b>${esc(t.label)}</b><small>${esc(t.detail)}</small></button>`).join("")}</span>` : "";
  return `<span class="an-flash-guides an-finisher-guides"><button class="an-flash-guide" data-action="finisher-tours" aria-expanded="${!!open}" data-tooltip="Guided walkthroughs: watch a finisher being built, step by step">🎓 Show me ▾</button>${menu}</span>`;
}

// One tour at a time. Unsaved work in the studio is kept: it is snapshotted here and put back when
// the tour ends (Finish, Stop, Esc, a click elsewhere, or an error), together with the page.
export async function runFinisherTour(w, tour = "flying", { lead } = {}) {
  if (w.touring) return;
  const which = Object.hasOwn(FINISHER_TOURS, tour) ? tour : "flying";
  w.touring = true;
  const saved = studioState(w);
  let back = false;
  const putBack = () => {
    if (back) return;
    back = true;
    try { restoreStudio(w, saved); } finally { w.touring = false; w.render(); }
  };
  try {
    w.stopEditorPreview?.();
    w.drafts.set(TOUR_PRACTICE_ID, practiceFinisher(which));
    w.dirty.delete(TOUR_PRACTICE_ID);
    Object.assign(w, { page: "finishers", studio: true, selected: TOUR_PRACTICE_ID, studioTime: 0, stageIndex: 0, keyframeIndex: 0, keyframeFocus: false, studioSettings: false, previewMode: "recipe", studioPlaying: false, message: "" });
    w.render();
  } catch (error) { putBack(); throw error; }
  // A throw in the engine's own setup (or in its cleanup) still puts the studio back.
  try {
    await runTour({ root: w.root, steps: finisherSteps(which), lead, snapshot: () => stepSnapshot(w), restore: (snap) => restoreStep(w, snap), cleanup: putBack, surface: (hand) => studioSurface(w, hand) });
  } catch (error) { putBack(); throw error; }
}
