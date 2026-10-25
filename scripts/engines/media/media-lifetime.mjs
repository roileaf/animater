import { MEDIA_DURATIONS } from "../../../data/media-durations.mjs";

// A clip's measured length in media milliseconds, or 0 when unmeasured. A key one
// numbered variant short of a clip (breath_weapons02.burst.cone.arcana.purple) may
// play any of its numbered variants (.01, .02): the longest of them. A whole family
// (jb2a.impact) is no single clip and stays unmeasured.
const lengths = new Map();
export function clipLength(key) {
  if (typeof key !== "string") return 0;
  if (Object.hasOwn(MEDIA_DURATIONS, key)) return MEDIA_DURATIONS[key];
  if (!lengths.has(key)) {
    const prefix = key + ".";
    lengths.set(key, Math.max(0, ...Object.keys(MEDIA_DURATIONS).filter((k) => k.startsWith(prefix) && /^\d+$/.test(k.slice(prefix.length))).map((k) => MEDIA_DURATIONS[k])));
  }
  return lengths.get(key);
}

// Once means the complete movie. Explicit skip/end values remain deliberate
// editorial clips; looping ambience keeps its chosen finite stage envelope.
// Resolve before stage links, repetitions, highlights and cleanup deadlines.
export function completeMediaStage(stage) {
  if (!stage.oneShot || stage.clipStart || stage.clipEnd) return stage;
  const native = Math.max(0, ...stage.assets.map(clipLength));
  if (!native) return stage;
  const full = native / stage.playbackRate;
  const exit = Math.max(
    stage.fadeOut,
    stage.scaleOutDuration,
    stage.rotateOutDuration,
  );
  const duration = Math.max(stage.duration, Math.ceil(full + exit));
  if (duration > 30000)
    throw Error(
      "Whole clip exceeds 30 seconds. Choose an explicit clip end or faster media speed.",
    );
  return { ...stage, duration };
}

// How much of the playing clip Sequencer is asked for (media milliseconds). A stage that
// plays its clip once (or from an opening skip) never asks for more than the clip holds:
// Sequencer holds a finished one-shot clip on its last frame for the rest of the duration,
// so a stage timed for a longer fallback froze the shorter clip that played (Chill Touch's
// 2-second strands held for 2.5 seconds more). Only its exit (a fade-out, a scale or turn
// out) still plays over the last frame, as completeMediaStage times it. Its timeline keeps
// the planned duration.
export function mediaSpan(stage) {
  const skip = stage.clipStart || 0, rate = stage.playbackRate || 1;
  const span = stage.duration * rate + (stage.clipEnd ? 0 : skip);
  if (stage.clipEnd || !(stage.oneShot || skip)) return span;
  const native = clipLength(stage.asset);
  if (!(native > skip)) return span;
  const exit = Math.max(stage.fadeOut || 0, stage.scaleOutDuration || 0, stage.rotateOutDuration || 0);
  return Math.min(span, Math.ceil((native - skip) / rate + exit) * rate + skip);
}

// JB2A breath weapons (and the breath_weapons02 bursts) grow out of the mouth for a
// second or two before they fill their cone or line, then linger and fade: a built-in
// stage shorter than the clip cut the breath off before it arrived. Catalog breaths
// play their whole clip. Loop footage, lasting areas, explicit clips and stages that may
// fall back to other art keep their timing.
const BREATH_CLIP = /^jb2a\.breath_weapons(?:\d+)?\.(?!loop\.)/;
export const breathClip = (key) => typeof key === "string" && BREATH_CLIP.test(key);
export function wholeBreathClip(stage) {
  if (!["template", "travel"].includes(stage.kind) || stage.oneShot || stage.persist || stage.clipStart || stage.clipEnd) return stage;
  // Every fallback must be breath footage too: other art would hold its own last frame for that long.
  return stage.assets?.length && stage.assets.every(breathClip) ? { ...stage, oneShot: true } : stage;
}
export function wholeBreathClips(recipe) {
  const stages = recipe.stages.map(wholeBreathClip);
  return stages.every((s, i) => s === recipe.stages[i]) ? recipe : { ...recipe, stages };
}
