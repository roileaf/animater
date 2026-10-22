// Hit-stop holds: which animation sessions are frozen right now, and timers
// that wait out the frozen time. Pure, no Foundry or Sequencer access.

const MAX_SESSIONS = 200;

// One hold per session (the first wins). Keeps the newest MAX_SESSIONS.
export function createHolds({ now = () => performance.now() } = {}) {
  const held = new Map(); // session -> { start, end }

  function hold(session, ms) {
    if (held.has(session)) return false;
    const start = now();
    held.set(session, { start, end: start + ms });
    if (held.size > MAX_SESSIONS) held.delete(held.keys().next().value);
    return true;
  }

  function isHeld(session) {
    const entry = held.get(session);
    return !!entry && now() < entry.end;
  }

  // Held time that falls inside [sinceMs, now].
  function heldMs(session, sinceMs) {
    const entry = held.get(session);
    if (!entry) return 0;
    return Math.max(0, Math.min(entry.end, now()) - Math.max(entry.start, sinceMs));
  }

  function untilMs(session) {
    return isHeld(session) ? held.get(session).end : null;
  }

  function forget(session) {
    held.delete(session);
  }

  return { hold, isHeld, heldMs, untilMs, forget };
}

// Returns (fn, ms) => id. Every arm goes through set(), so whoever owns set
// can clear all of them. When a timer fires, any hold time not yet added is
// waited out first, then fn runs.
export function pausableTimeout(holds, session, { set = (fn, ms) => setTimeout(fn, ms), now = () => performance.now() } = {}) {
  return (fn, ms) => {
    const armedAt = now();
    let added = 0;
    const check = () => {
      const extra = holds.heldMs(session, armedAt) - added;
      if (extra > 0) {
        added += extra;
        set(check, extra);
        return;
      }
      fn();
    };
    return set(check, ms);
  };
}
