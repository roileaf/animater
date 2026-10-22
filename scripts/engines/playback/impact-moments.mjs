import { strikeAt } from "../../systems/outcome.mjs";
// Timing for the crit freeze and the slow-motion kill: when the blow lands, and how a plan stretches around it.
export const HOLD_MS = 100;
export const SLOW_TEMPO = 0.5;
export const SLOW_PITCH = 0.85;
export const SLOW_CAP_MS = 6000;

const CRIT = "criticalSuccess";

// A crit is read from the roll's outcome, never from saves.
export function plannedCrit(context = {}) {
  return context.outcome === CRIT || Object.values(context.targetOutcomes ?? {}).includes(CRIT);
}

// Targets that took a crit; null when the whole roll is critical.
export function critTargetIds(context = {}) {
  if (context.outcome === CRIT) return null;
  return new Set(Object.entries(context.targetOutcomes ?? {}).filter(([, v]) => v === CRIT).map(([id]) => id));
}

// When the blow lands on a crit target (stages with no destination stay in).
export function contactTime(plan, critIds) {
  if (!critIds) return strikeAt(plan);
  return strikeAt(plan.filter((s) => !s.destination?.id || critIds.has(s.destination.id)));
}

// Freeze the moment of contact: everything after it waits holdMs, what plays across it is marked.
export function withHitStop(plan, at, holdMs = HOLD_MS) {
  const marks = new Map();
  const out = plan.map((s) => {
    const delay = s.delay ?? 0;
    const next = delay > at ? { ...s, delay: delay + holdMs } : { ...s };
    if (s.kind !== "sound" && !s.persist && delay <= at && at < delay + (s.duration ?? 0)) marks.set(next, { afterMs: at - delay, holdMs });
    return next;
  });
  return { plan: out, marks };
}

// Slow motion is never longer than the cap: a long plan slows less.
export const tempoFor = (lengthMs, tempo = SLOW_TEMPO, capMs = SLOW_CAP_MS) => Math.min(1, Math.max(tempo, lengthMs / capMs));

// Stretch a plan in time. motionHold and motionArrival are percentages of the move, so they stay.
export function withTempo(plan, tempo) {
  if (!(tempo < 1)) return plan;
  const slow = (n) => (n == null ? n : n / tempo);
  return plan.map((s) => {
    const next = { ...s, delay: slow(s.delay), duration: slow(s.duration) };
    if (s.moveDelay != null) next.moveDelay = slow(s.moveDelay);
    if (s.kind === "sound") next.pitch = (s.pitch || 1) * SLOW_PITCH;
    else next.playbackRate = (s.playbackRate ?? 1) * tempo;
    return next;
  });
}
