import { MEDIA_VISIBLE } from "../../../data/media-visible.mjs";

// A built-in cast stage shows its clip's whole visible part: it skips the
// transparent lead-in JB2A cast clips open with and lasts until the clip's
// last visible frame, at most CAST_CLIP_CAP. Only catalog generation calls this;
// saved recipes keep the timing their author chose.
export const CAST_CLIP_CAP = 1800;

const FAMILIES = Object.keys(MEDIA_VISIBLE).sort((a, b) => b.length - a.length);
function assetWindow(key) {
  const family = FAMILIES.find((f) => key === f || key.startsWith(f + "."));
  if (family) return MEDIA_VISIBLE[family];
  // A partial key resolves to an unknown member: assume the shortest of them.
  const members = FAMILIES.filter((f) => f.startsWith(key + ".")).map((f) => MEDIA_VISIBLE[f]);
  return members.length ? combine(members) : null;
}
// Any listed asset may be the one that plays: skip only what all of them leave
// blank and stop where the shortest one ends.
const combine = (windows) => ({
  start: Math.min(...windows.map((w) => w.start)),
  end: Math.min(...windows.map((w) => w.end)),
  total: Math.min(...windows.map((w) => w.total)),
});
export function castClipWindow(assets = []) {
  const windows = assets.map(assetWindow);
  return windows.length && windows.every(Boolean) ? combine(windows) : null;
}
export function fitCastClip(stage) {
  // Whole-movie, lasting, and explicitly clipped stages already say what plays.
  if (stage.kind !== "cast" || stage.oneShot || stage.persist || stage.clipStart || stage.clipEnd) return stage;
  const window = castClipWindow(stage.assets);
  if (!window) return stage;
  const rate = stage.playbackRate || 1;
  const duration = Math.max(stage.duration, Math.min(CAST_CLIP_CAP, Math.ceil((window.end - window.start) / rate)));
  // Never skip so far that the stage would run past the file and wrap around.
  const clipStart = Math.max(0, Math.min(window.start, window.total - Math.ceil(duration * rate)));
  return clipStart === stage.clipStart && duration === stage.duration ? stage : { ...stage, clipStart, duration };
}
// Stages linked to a cast's end follow it through stage timing (afterStage).
export function fitCastClips(recipe) {
  const stages = recipe.stages.map(fitCastClip);
  return stages.every((s, i) => s === recipe.stages[i]) ? recipe : { ...recipe, stages };
}
