// When the animation reaches a thing, so it breaks then (pure, no Foundry globals). A roll's play reports when it starts,
// with its plan; a break waits for the plan's own moment (a swing's blow, a shot's arrival), and with no play (animations
// off, no recipe, a quality skip) it falls back to breaking at once.
import { meleeClip, meleeHit } from "../../systems/outcome.mjs";
import { arrivalOf } from "../playback/flight-path.mjs";

/**
 * The plays this client runs, by the roll's message (or event id): started(key, plan) as one starts, ended(key) when the
 * dispatch is done (a play that never started then means none). wait(key, cap) resolves {plan, age} (ms since it started)
 * once it starts, or null when it ends without starting, after cap ms, or for no key. Reports are kept for keep ms.
 */
export function createPlayWatch({ now = () => Date.now(), later = (fn, ms) => setTimeout(fn, ms), cancel = (id) => clearTimeout(id), keep = 15000 } = {}) {
  const told = new Map(), asked = new Map();
  const tell = (key, report) => {
    const waiting = asked.get(key);
    if (waiting) { asked.delete(key); cancel(waiting.timer); waiting.resolve(report ? { plan: report.plan, age: Math.max(0, now() - report.at) } : null); }
    const before = told.get(key);
    if (before) cancel(before.timer);
    told.set(key, { ...(report ?? { none: true }), timer: later(() => told.delete(key), keep) });
  };
  return {
    started(key, plan) { if (key != null) tell(key, { plan: Array.isArray(plan) ? plan : [], at: now() }); },
    ended(key) { if (key != null && !(told.get(key)?.plan)) tell(key, null); },
    wait(key, cap) {
      if (key == null) return Promise.resolve(null);
      const have = told.get(key);
      if (have) return Promise.resolve(have.plan ? { plan: have.plan, age: Math.max(0, now() - have.at) } : null);
      const before = asked.get(key);
      if (before) { cancel(before.timer); before.resolve(null); }
      return new Promise((resolve) => { asked.set(key, { resolve, timer: later(() => { asked.delete(key); resolve(null); }, cap) }); });
    },
  };
}

const FLIGHTS = new Set(["travel", "projectile"]);
const onTargets = (s) => s.subject === "targets" || s.kind === "impact";
const swing = (s) => s.kind === "impact" && s.subject !== "targets" && (s.assets ?? []).some(meleeClip);
/**
 * ms into a play when its strike reaches the target (a planned play: each stage's delay set), as outcome.mjs times a
 * dodge: a melee swing clip's blow, else the first hit on a target, else a flight's arrival, else the attacker's gesture
 * (45% into it); 0 for none.
 */
export function strikeMoment(plan) {
  const stages = (Array.isArray(plan) ? plan : []).filter((s) => s && typeof s === "object").slice().sort((a, b) => (a.delay ?? 0) - (b.delay ?? 0));
  const at = (s) => Math.max(0, Number(s.delay) || 0);
  const blow = stages.find(swing);
  if (blow) return Math.round(at(blow) + (Number(blow.duration) || 0) * meleeHit((blow.assets ?? []).find(meleeClip)));
  const hit = stages.find((s) => onTargets(s) && s.kind !== "motion" && s.kind !== "sound");
  if (hit) return at(hit);
  const flight = stages.find((s) => FLIGHTS.has(s.kind));
  if (flight) return Math.round(at(flight) + (Number(arrivalOf(flight)) || 0));
  const gesture = stages.find((s) => s.kind === "motion" && s.subject === "source");
  return gesture ? Math.round(at(gesture) + (Number(gesture.duration) || 0) * 0.45) : 0;
}

const MOST_WAIT = 5000;
/** ms from now until a moment `moment` ms into a play that started `age` ms ago: never negative, at most 5 s. */
export function momentWait(moment, age = 0) {
  const w = Number(moment) - (Number(age) || 0);
  return Number.isFinite(w) ? Math.min(MOST_WAIT, Math.max(0, Math.round(w))) : 0;
}
