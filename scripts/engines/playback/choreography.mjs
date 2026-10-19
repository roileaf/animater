import { clone } from "../../core/model.mjs";
import { stageSpan, stageFrame } from "../../core/stage-options.mjs";
import { sampleRecipe } from "./composition.mjs";

// Ordering moves content between chronological timing slots. Durations and all
// effect settings stay with their stage; simultaneous slots remain simultaneous.
// Start modes read like slides: "with previous" starts alongside the stage before
// it, "after previous" when it ends (plus an optional gap in startOffset). They
// are stored as ordinary stage links, so playback and saved data stay unchanged;
// re-running this after any reorder/add/remove keeps each link on its neighbour.
export const START_MODES = Object.freeze({ after: 'After previous', with: 'With previous' });
// startRef names a specific stage to follow; without one (or when that stage is
// gone) the stage follows whichever stage now precedes it.
export function linkStartModes(stages) {
  const ids = new Set(stages.map(s => s.stageId));
  stages.forEach((s, i) => {
    if (!START_MODES[s.startMode]) { delete s.startMode; delete s.startRef; return; }
    if (s.startRef && (!ids.has(s.startRef) || s.startRef === s.stageId)) delete s.startRef;
    if (i === 0 && !s.startRef) { delete s.startMode; s.afterStage = ''; s.delay = 0; return; }
    s.afterStage = s.startRef ?? stages[i - 1].stageId;
    s.timingAnchor = s.startMode === 'with' ? 'start' : 'end';
    if (s.startMode === 'with') s.startOffset = 0;
    else s.startOffset = Math.max(0, Number(s.startOffset) || 0);
    s.delay = 0;
  });
  return stages;
}
// Timeline editing: row order is only a list. Relative "previous stage" links
// are pinned to the stage they currently follow before rows move, so moving a
// row never changes when anything plays.
export function pinStartRefs(stages) {
  stages.forEach((s, i) => { if (START_MODES[s.startMode] && !s.startRef && i > 0) s.startRef = stages[i - 1].stageId; });
  return stages;
}
export function moveRow(stages, from, to) {
  if (![from, to].every(n => Number.isInteger(n) && n >= 0 && n < stages.length)) throw Error("Choose a valid stage position.");
  const result = pinStartRefs(clone(stages));
  const [moved] = result.splice(from, 1);
  result.splice(to, 0, moved);
  return linkStartModes(result);
}
// Snap a dragged start to another stage's start ("with") or end ("after").
export function snapStart(ms, others, tolerance) {
  let best = null;
  for (const o of others) for (const [edge, at] of [["with", o.start], ["after", o.end]]) {
    const d = Math.abs(ms - at);
    if (d <= tolerance && (!best || d < best.d)) best = { d, at, mode: edge, ref: o.stageId };
  }
  return best;
}
export function reorderStages(stages, from, to) {
  if (
    !Number.isInteger(from) ||
    !Number.isInteger(to) ||
    from < 0 ||
    to < 0 ||
    from >= stages.length ||
    to >= stages.length
  )
    throw Error("Choose a valid stage position.");
  const result = clone(stages);
  if (from === to) return result;
  const slots = result.map((s) => s.delay).sort((a, b) => a - b);
  const [moved] = result.splice(from, 1);
  result.splice(to, 0, moved);
  result.forEach((s, i) => {
    s.delay = slots[i];
  });
  return linkStartModes(result);
}

// Resolved start/end of every stage for the editor timeline (sample spacing).
export function timelineLayout(recipe) {
  const resolved = sampleRecipe(recipe).stages;
  const rows = resolved.map((s, i) => {
    const start = Math.max(0, Math.round(s.delay));
    const span = Math.max(100, Math.round(stageSpan(s, recipe.targetCount ?? 1)));
    return { index: i, stageId: recipe.stages[i].stageId, start, end: start + span };
  });
  const end = Math.max(1000, ...rows.map(r => r.end));
  // Round the scale up to a whole half second so the ruler reads cleanly.
  return { rows, total: Math.ceil(end / 500) * 500 };
}
// First-fit lanes by start time: a stage joins the first lane already free when
// it starts, so a sequence shares one row and only overlapping stages stack.
export function packLanes(rows) {
  const lanes = [];
  for (const row of [...rows].sort((a, b) => a.start - b.start || a.index - b.index)) {
    const lane = lanes.find(l => l.at(-1).end <= row.start);
    if (lane) lane.push(row); else lanes.push([row]);
  }
  return lanes;
}
export const recipeDuration = (recipe) =>
  Math.max(
    0,
    ...(recipe.playbackPlan ?? sampleRecipe(recipe).stages).map(
      (s) =>
        s.delay +
        (recipe.playbackPlan
          ? s.duration
          : stageSpan(s, recipe.targetCount ?? 1)),
    ),
  );

export function recipeFrame(recipe, elapsed) {
  const duration = recipeDuration(recipe);
  const time = Math.max(0, Math.min(duration, elapsed));
  return {
    time,
    duration,
    complete: time >= duration,
    stages: sampleRecipe(recipe).stages.map((s, index) => ({
      index,
      ...(recipe.playbackPlan
        ? planFrame(
            recipe.playbackPlan.filter((p) => p.index === index),
            time,
          )
        : stageFrame(s, time, recipe.targetCount ?? 1)),
    })),
  };
}
function planFrame(plan, time) {
  const states = plan.map((p) => ({
    ...stageFrame({ ...p, repeats: 1, targetStagger: 0 }, time),
    targetIndex: p.targetIndex,
    iteration: p.iteration,
    stage: p,
  }));
  return (
    states.find((s) => s.state === "playing") ??
    states.find((s) => s.state === "pending") ??
    states.at(-1)
  );
}

// Explicitly played once; background time counts, cancellation emits no late ticks.
export class RecipeClock {
  constructor({
    frame = (cb) => globalThis.requestAnimationFrame(cb),
    cancel = (id) => globalThis.cancelAnimationFrame(id),
    now = () => performance.now(),
  } = {}) {
    this.frame = frame;
    this.cancel = cancel;
    this.now = now;
  }
  // `until`: stop (as complete) at this time instead of the recipe's end, for looping one clip.
  play(recipe, onFrame, { from = 0, until = Infinity } = {}) {
    this.stop();
    const start = this.now() - Math.max(0, from);
    return new Promise((resolve) => {
      const run = { resolve, handle: null };
      this.run = run;
      const tick = (time) => {
        if (this.run !== run) return;
        const snapshot = recipeFrame(recipe, time - start);
        onFrame(snapshot);
        if (snapshot.complete || time - start >= until) {
          this.run = null;
          resolve(true);
        } else run.handle = this.frame(tick);
      };
      onFrame(recipeFrame(recipe, Math.max(0, from)));
      run.handle = this.frame(tick);
    });
  }
  stop() {
    if (!this.run) return;
    this.cancel(this.run.handle);
    this.run.resolve(false);
    this.run = null;
  }
}
