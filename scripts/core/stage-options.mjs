// One configuration vocabulary for saved recipes, Sequencer and composition.
export const EASES = {
  linear: "Linear",
  easeInQuad: "Ease in",
  easeOutQuad: "Ease out",
  easeInOutQuad: "Ease in / out",
  easeOutBack: "Overshoot",
  easeInBack: "Pull back then accelerate",
  easeOutCubic: "Smooth deceleration",
};
export const TRACK_PROPERTIES = {
  "position.x": "Horizontal (grid squares)",
  "position.y": "Vertical (grid squares)",
  rotation: "Rotation (degrees)",
  "scale.x": "Width multiplier",
  "scale.y": "Height multiplier",
  alpha: "Opacity",
  width: "Artwork width change (squares)",
  height: "Artwork height change (squares)",
};
// [key, label, default, min, max, step] or [key, label, default, choices].
export const OPTION_GROUPS = {
  "Timing & repetition": [
    ["requiresHit", "Only after a confirmed successful attack", false],
    ["repeats", "Plays", 1, 1, 18, 1],
    ["repeatSimultaneous", "Launch repeated plays together", false],
    [
      "repeatScope",
      "Distribute plays",
      "perTarget",
      {
        perTarget: "Every targeted creature",
        total: "Total, through targets in order",
      },
    ],
    ["repeatGap", "Gap between plays (ms)", 0, 0, 10000, 50],
    ["repeatInterval", "Restart every (ms, 0 = when finished)", 0, 0, 10000, 50],
    ["targetStagger", "Between targets (ms)", 0, 0, 3000, 50],
  ],
  "Media playback": [
    ["oneShot", "Play the clip once, no looping", false],
    ["playbackRate", "Media speed", 1, 0.25, 3, 0.25],
    ["clipStart", "Skip opening (ms)", 0, 0, 30000, 50],
    ["clipEnd", "Stop clip at (ms, 0 = its end)", 0, 0, 30000, 50],
  ],
  "Placement & attachment": [
    ["optionalTargets", "Skip stage when no targets are selected", false],
    ["targetSelection", "Target endpoints", "all", {all:"All selected targets",first:"First selected target",secondary:"All except first target",second:"Second selected target",third:"Third selected target",last:"Last selected target"}],
    ["targetLimit", "Maximum targets (0 = all)", 0, 0, 18, 1],
    [
      "areaLayout",
      "Line artwork",
      "fit",
      { fit: "Stretch along line", tiles: "Separate cues along line" },
    ],
    ["offsetX", "Horizontal offset (squares)", 0, -10, 10, 0.1],
    ["offsetY", "Vertical offset (squares)", 0, -10, 10, 0.1],
    ["offsetUnits", "Offset reference", "grid", {grid:"Scene grid squares",token:"Token footprint"}],
    ["rotation", "Rotation (degrees)", 0, -720, 720, 5],
    ["anchorX", "Anchor X", 0.5, 0, 1, 0.1],
    ["anchorY", "Anchor Y", 0.5, 0, 1, 0.1],
    ["customAnchor", "Override artwork anchor", false],
    ["mirrorX", "Mirror horizontally", false],
    ["mirrorY", "Mirror vertically", false],
    ["faceTarget", "Face the first target", false],
    ["attach", "Follow token", false],
    ["bindRotation", "Follow token rotation", false],
    ["bindAlpha", "Follow token opacity", true],
    ["maskToken", "Crop effect to token", false],
    ["zIndex", "Layer priority", 0, -100, 100, 1],
    ["overlayFit", "Fit overlay to screen", true],
  ],
  "Entrance & exit": [
    ["ease", "Transition easing", "linear", EASES],
    ["fadeIn", "Fade in (ms)", 0, 0, 30000, 50],
    ["fadeOut", "Fade out (ms)", 0, 0, 30000, 50],
    ["scaleIn", "Starting scale", 0, 0, 5, 0.1],
    ["scaleInDuration", "Grow in (ms)", 0, 0, 30000, 50],
    ["scaleOut", "Ending scale", 0, 0, 5, 0.1],
    ["scaleOutDuration", "Shrink out (ms)", 0, 0, 30000, 50],
    ["rotateIn", "Starting rotation (degrees)", 0, -720, 720, 5],
    ["rotateInDuration", "Rotate in (ms)", 0, 0, 30000, 50],
    ["rotateOut", "Exit rotation (degrees)", 0, -720, 720, 5],
    ["rotateOutDuration", "Rotate out (ms)", 0, 0, 30000, 50],
  ],
  "Color & filters": [
    ["tintEnabled", "Apply tint", false],
    ["tint", "Tint color", "#ffffff"],
    ["colorize", "Recolor fully (ignore the original color)", false],
    ["brightness", "Brightness", 1, 0, 3, 0.1],
    ["contrast", "Contrast", 0, -1, 1, 0.1],
    ["saturation", "Saturation", 0, -1, 1, 0.1],
    ["hue", "Hue (degrees)", 0, -180, 180, 5],
    ["blur", "Blur (pixels)", 0, 0, 20, 1],
    ["glow", "Glow strength", 0, 0, 10, 0.5],
    ["glowColor", "Glow color", "#9e8aff"],
  ],
  "Token copies": [
    ["copies", "Copies", 1, 1, 6, 1],
    ["copySpread", "Copy spacing (squares)", 0.3, 0, 3, 0.1],
    ["shadow", "Shadow silhouette", false],
  ],
  Sound: [["volume", "Volume", 0.5, 0, 1, 0.05]],
};
export const OPTION_FIELDS = Object.values(OPTION_GROUPS).flat();
export const number = (v, min, max, fallback) =>
  v !== undefined && v !== null && v !== "" && Number.isFinite(Number(v))
    ? Math.min(max, Math.max(min, Number(v))) + 0
    : fallback;
export function normalizeOptions(stage) {
  const result = {};
  for (const [key, , fallback, min, max] of OPTION_FIELDS) {
    result[key] =
      typeof fallback === "number"
        ? number(stage[key], min, max, fallback)
        : typeof fallback === "boolean"
          ? stage[key] === undefined
            ? fallback
            : stage[key] === true
          : min && typeof min === "object"
            ? Object.hasOwn(min, stage[key])
              ? stage[key]
              : fallback
            : /^#[\da-f]{6}$/i.test(stage[key])
              ? stage[key]
              : fallback;
  }
  // Keep existing neutral recipes and their recorded design fingerprints
  // unchanged; color replacement is an explicit opt-in setting.
  if(!result.colorize)delete result.colorize;
  if(!result.requiresHit)delete result.requiresHit;
  if(result.offsetUnits === 'grid')delete result.offsetUnits;
  if (["travel", "projectile"].includes(stage.kind) && stage.travelDestination === "area") {
    result.areaLayout = stage.areaLayout === "fan" ? "fan" : "fit";
    result.fanCount = Math.round(number(stage.fanCount, 3, 9, 5));
    if (Array.isArray(stage.fanColors)) result.fanColors = stage.fanColors.filter(color=>/^#[\da-f]{6}$/i.test(color)).slice(0,9);
  }
  for (const key of ["repeats", "copies", "zIndex"])
    result[key] = Math.round(result[key]);
  for (const key of [
    "fadeIn",
    "fadeOut",
    "scaleInDuration",
    "scaleOutDuration",
    "rotateInDuration",
    "rotateOutDuration",
  ])
    result[key] = Math.min(result[key], stage.duration);
  result.soundFile =
    typeof stage.soundFile === "string"
      ? stage.soundFile.trim().slice(0, 500)
      : "";
  result.tracks = (Array.isArray(stage.tracks) ? stage.tracks : [])
    .slice(0, 6)
    .map((t) => {
      if (!t || !Object.hasOwn(TRACK_PROPERTIES, t.property))
        throw Error("Choose a supported property track.");
      const range =
        t.property === "alpha"
          ? [0, 1]
          : t.property.startsWith("scale")
            ? [0.01, 5]
            : t.property.startsWith("position") ||
                ["width", "height"].includes(t.property)
              ? [-10, 10]
              : [-720, 720];
      return {
        property: t.property,
        from: number(t.from, ...range, 0),
        to: number(t.to, ...range, 1),
        duration: number(
          t.duration,
          100,
          stage.duration,
          Math.min(1000, stage.duration),
        ),
        delay: number(
          t.delay,
          t.fromEnd && !t.loop ? -stage.duration : 0,
          t.fromEnd && !t.loop ? 0 : stage.duration,
          0,
        ),
        ease: Object.hasOwn(EASES, t.ease) ? t.ease : "linear",
        loop: t.loop === true,
        pingPong: t.pingPong === true,
        fromEnd: t.loop !== true && t.fromEnd === true,
      };
    });
  // Keep pre-existing saved compositions stable when the new mode is off.
  if(!result.repeatSimultaneous)delete result.repeatSimultaneous;
  if(!result.optionalTargets)delete result.optionalTargets;
  return result;
}
export function validateSoundFile(path) {
  if (
    !/^(?![\\/]|.*(?:\.\.|:|[<>"'\x00-\x1f]))[^?#]+\.(?:ogg|mp3|wav|flac|m4a|aac|webm)$/i.test(
      path,
    )
  )
    throw Error(
      "Sound needs a relative Foundry audio file path (ogg, mp3, wav, flac, m4a, aac or webm).",
    );
}
export function applyMediaOptions(section, s) {
  if (s.oneShot) section.loopOptions({ loops: 1 });
  if (s.clipEnd) {
    if (s.clipEnd <= s.clipStart)
      throw Error("Clip end must be after its opening skip.");
    section.timeRange(s.clipStart, s.clipEnd);
  } else if (s.clipStart) section.startTime(s.clipStart);
}
export function stageSpan(stage, targetCount = 1) {
  const s = { ...stage, ...normalizeOptions(stage) };
  const targets =
    ["travel", "projectile", "impact"].includes(s.kind) ||
    s.subject === "targets";
  return (
    s.duration +
    (s.repeats - 1) * repeatStride(s) +
    (targets && s.repeatScope !== "total"
      ? Math.max(0, targetCount - 1) * s.targetStagger
      : 0)
  );
}
export function repeatStride(stage) {
  if(stage.repeatSimultaneous)return 0;
  return stage.repeatInterval > 0
    ? Math.max(100, stage.repeatInterval)
    : stage.duration + (stage.repeatGap ?? 0);
}
export function stageFrame(stage, time, targetCount = 1) {
  if (
    targetCount > 1 &&
    (["travel", "projectile", "impact"].includes(stage.kind) ||
      stage.subject === "targets")
  ) {
    const stagger = normalizeOptions(stage).targetStagger;
    const states = Array.from({ length: targetCount }, (_, targetIndex) => ({
      ...stageFrame(stage, time - targetIndex * stagger),
      targetIndex,
    }));
    const active =
      states.find((s) => s.state === "playing") ??
      states.find((s) => s.state === "waiting") ??
      states.find((s) => s.state === "pending") ??
      states.at(-1);
    return active.state === "pending" && time >= stage.delay
      ? { ...active, state: "waiting" }
      : active;
  }
  const o = normalizeOptions(stage),
    elapsed = time - stage.delay;
  const cycle = repeatStride({ ...stage, ...o });
  const iteration = Math.min(
    o.repeats - 1,
    cycle===0?0:Math.max(0, Math.floor(elapsed / cycle)),
  );
  const localTime = elapsed - iteration * cycle;
  const finished = elapsed >= stageSpan(stage);
  return {
    state:
      elapsed < 0
        ? "pending"
        : finished
          ? "done"
          : localTime < stage.duration
            ? "playing"
            : "waiting",
    iteration,
    targetIndex: 0,
    localTime: Math.max(0, Math.min(stage.duration, localTime)),
    progress: Math.max(0, Math.min(1, localTime / stage.duration)),
  };
}
export function applyEffectOptions(effect, stage) {
  const s = { ...stage, ...normalizeOptions(stage) },
    ease = { ease: s.ease };
  if (s.kind !== "sprite") applyMediaOptions(effect, s);
  // Preserve JB2A database alignment and copied-token mirroring by default.
  if (s.customAnchor) effect.anchor({ x: s.anchorX, y: s.anchorY });
  if (s.rotation) effect.rotate(s.rotation);
  if (s.mirrorX) effect.mirrorX(true);
  if (Boolean(s.mirrorY) !== Boolean(stage.facingMirror)) effect.mirrorY(true);
  if (s.zIndex) effect.zIndex(s.zIndex);
  if (s.playbackRate !== 1) effect.playbackRate(s.playbackRate);
  for (const method of ["fadeIn", "fadeOut"])
    if (s[method]) effect[method](s[method], ease);
  for (const method of ["scaleIn", "scaleOut", "rotateIn", "rotateOut"])
    if (s[method + "Duration"])
      effect[method](s[method], s[method + "Duration"], ease);
  const shadow = s.kind === "sprite" && s.shadow;
  const colorize=s.tintEnabled&&s.colorize&&!shadow;
  if ((s.tintEnabled&&!colorize) || shadow) effect.tint(shadow ? "#000000" : s.tint);
  if (
    s.brightness !== 1 ||
    s.contrast !== 0 ||
    s.saturation !== 0 ||
    s.hue !== 0 || colorize
  )
    effect.filter("ColorMatrix", {
      brightness: s.brightness,
      contrast: s.contrast,
      saturate: s.saturation,
      hue: s.hue,
      ...(colorize?{saturate:-1,tint:parseInt(s.tint.slice(1),16)}:{}),
    });
  if (s.blur) effect.filter("Blur", { blurX: s.blur, blurY: s.blur });
  if (s.glow)
    effect.filter("Glow", {
      color: parseInt(s.glowColor.slice(1), 16),
      outerStrength: s.glow,
      innerStrength: 0,
    });
  for (const t of s.tracks) {
    const target = ["alpha", "width", "height"].includes(t.property)
      ? "sprite"
      : "spriteContainer";
    const opts = {
      from: t.from,
      to: t.to,
      duration: t.duration,
      delay: t.delay,
      ease: t.ease,
      gridUnits:
        t.property.startsWith("position") ||
        ["width", "height"].includes(t.property),
      fromEnd: t.fromEnd,
      absolute: t.property === "alpha",
    };
    if (t.loop)
      effect.loopProperty(target, t.property, {
        ...opts,
        pingPong: t.pingPong,
        loops: 0,
      });
    else effect.animateProperty(target, t.property, opts);
  }
  return effect;
}
export function easeValue(value, ease = "linear") {
  const p = Math.max(0, Math.min(1, value));
  if (ease === "easeInQuad") return p * p;
  if (ease === "easeOutQuad") return 1 - (1 - p) ** 2;
  if (ease === "easeInOutQuad")
    return p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
  if (ease === "easeOutBack")
    return 1 + 2.70158 * (p - 1) ** 3 + 1.70158 * (p - 1) ** 2;
  if (ease === "easeInBack") return 2.70158 * p ** 3 - 1.70158 * p ** 2;
  if (ease === "easeOutCubic") return 1 - (1 - p) ** 3;
  return p;
}
export function previewPose(
  stage,
  localTime,
  grid = 55,
  artwork = { width: 115, height: 115 },
) {
  const s = { ...stage, ...normalizeOptions(stage) };
  const inP = (duration) =>
    duration ? easeValue(localTime / duration, s.ease) : 1;
  const outP = (duration) =>
    duration
      ? easeValue((localTime - (s.duration - duration)) / duration, s.ease)
      : 0;
  const pose = {
    x: s.offsetX * grid,
    y: s.offsetY * grid,
    rotation: s.rotation,
    scaleX: s.scale ?? 1,
    scaleY: s.scale ?? 1,
    alpha: (s.opacity ?? 1) * inP(s.fadeIn) * (1 - outP(s.fadeOut)),
  };
  const scale =
    (s.scaleInDuration
      ? s.scaleIn + (1 - s.scaleIn) * inP(s.scaleInDuration)
      : 1) *
    (s.scaleOutDuration ? 1 + (s.scaleOut - 1) * outP(s.scaleOutDuration) : 1);
  pose.scaleX *= scale * (s.mirrorX ? -1 : 1);
  pose.scaleY *= scale * (s.mirrorY ? -1 : 1);
  pose.rotation +=
    s.rotateIn * (1 - inP(s.rotateInDuration)) +
    s.rotateOut * outP(s.rotateOutDuration);
  for (const t of s.tracks) {
    const elapsed =
      localTime -
      (t.fromEnd ? Math.max(0, s.duration - t.duration + t.delay) : t.delay);
    if (elapsed < 0) continue;
    const cycle = elapsed / t.duration;
    const p = t.loop
      ? t.pingPong && Math.floor(cycle) % 2
        ? 1 - (cycle % 1)
        : cycle % 1
      : Math.min(1, cycle);
    const value = t.from + (t.to - t.from) * easeValue(p, t.ease);
    if (t.property === "position.x") pose.x += value * grid;
    if (t.property === "position.y") pose.y += value * grid;
    if (t.property === "rotation") pose.rotation += value;
    if (t.property === "scale.x") pose.scaleX *= value;
    if (t.property === "scale.y") pose.scaleY *= value;
    if (t.property === "alpha") pose.alpha = value;
    if (t.property === "width") pose.scaleX += (value * grid) / artwork.width;
    if (t.property === "height") pose.scaleY += (value * grid) / artwork.height;
  }
  return pose;
}
