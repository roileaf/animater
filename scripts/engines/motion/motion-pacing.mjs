// Native catalog defaults only. Saved recipes retain their chosen duration.
export const GENERATED_MOTION_DURATION = Object.freeze({
  rush: 2000,
  leap: 2200,
  roll: 1800,
  dodge: 1300,
  lunge: 800,
  recoil: 650,
  shake: 750,
  spin: 1400,
  levitate: 1400,
  pulse: 900,
  press: 1100,
  sink: 1400,
  flicker: 1200,
  throw: 900,
  brace: 800,
  stagger: 900,
  collapse: 1800,
  cower: 1100,
  slam: 1200,
  drift: 1800,
  squash: 450,
  electrocute: 1300,
  fade: 900,
  fragments: 1400,
  path: 1200,
});

export function paceGeneratedMotion(stage) {
  if (stage.kind !== "motion") return stage;
  const minimum = GENERATED_MOTION_DURATION[stage.motion];
  if (!minimum || stage.duration >= minimum) return stage;
  const duration = Math.max(minimum, Number(stage.duration) || minimum);
  // Keep a native lunge's contact peak aligned with its impact footage.
  const delay =
    stage.motion === "lunge"
      ? Math.max(
          0,
          (Number(stage.delay) || 0) -
            (duration - (Number(stage.duration) || 0)) / 2,
        )
      : stage.delay;
  return { ...stage, duration, delay };
}

export function shakeCycles(stage) {
  const duration = Number.isFinite(Number(stage.duration))
    ? Math.max(0, Number(stage.duration))
    : 1500;
  // Cycles depend on elapsed time. A short reaction must not cram five
  // oscillations into a fraction of a second. Envelope keeps fractional
  // cycles continuous at both boundaries.
  return Math.min(5, duration / 250);
}

export function settledProgress(progress) {
  return progress * progress * progress * (progress * (progress * 6 - 15) + 10);
}
