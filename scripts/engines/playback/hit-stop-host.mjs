// Hit-stop on this client: a crit's tagged effects and motions of one session freeze together, once, at
// the moment of contact. Each client schedules it from its own arrival, so Foundry is read only through
// the callbacks (main.mjs).
const PREFIX = 'animater-';
const KEEP_MS = 60000;

// `animater-<userId>-<uuid>`: Foundry ids hold no '-', so the user id is the second segment.
export const sessionUser = (session) =>
  typeof session === 'string' && session.startsWith(PREFIX) ? session.slice(PREFIX.length).split('-')[0] : '';

const validMark = (mark) => Number.isFinite(mark?.afterMs) && mark.afterMs >= 0 && Number.isFinite(mark?.holdMs) && mark.holdMs > 0;

export function createHitStopHost({ allowed, holdEffects, holdMotions, schedule = setTimeout, now = Date.now }) {
  const seen = new Map(); // session -> when its freeze was scheduled

  function arrive(session, userId, mark) {
    if (!session || !userId || !validMark(mark) || seen.has(session)) return;
    const t = now();
    for (const [s, at] of seen) if (t - at > KEEP_MS) seen.delete(s);
    seen.set(session, t);
    schedule(() => {
      if (!allowed()) return;
      holdEffects(session, mark.holdMs);
      holdMotions(`${userId}:${session}`, mark.holdMs);
    }, mark.afterMs);
  }

  return {
    onEffect(data) {
      arrive(data?.name, sessionUser(data?.name), data?.animaterHitStop);
    },
    onMotion(data) {
      arrive(data?.session, data?.userId, data?.stage?.hitStop);
    },
  };
}
