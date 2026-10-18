import { MEDIA_DURATIONS } from "../../../data/media-durations.mjs";

// Once means the complete movie. Explicit skip/end values remain deliberate
// editorial clips; looping ambience keeps its chosen finite stage envelope.
// Resolve before stage links, repetitions, highlights and cleanup deadlines.
export function completeMediaStage(stage) {
  if (!stage.oneShot || stage.clipStart || stage.clipEnd) return stage;
  const native = Math.max(
    0,
    ...stage.assets.map((key) => MEDIA_DURATIONS[key] ?? 0),
  );
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
