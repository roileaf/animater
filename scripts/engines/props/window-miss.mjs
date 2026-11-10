// A missed shot or swing breaking a window. Pure: no Foundry globals.
// Ranged: the shot's planned miss path, as the animation draws it (flight-path.mjs planFlight / missFlightsOf: the seeded
// miss line, stopped at the first wall that stops movement), breaks the first breakable window on it, as the shot gets
// there. The GM accepts the miss line claimed only when it fits the shot: it starts at the attacker's token, passes near
// the target, and is no longer than the miss line can be.
// Melee: a window beside the target (its middle) joins the props in the pool a missed swing can hit, never one on the
// attacker's side.
import { MISS_ANGLE } from "../playback/flight-path.mjs";
import { windowOnLine } from "./wall-triggers.mjs";
import { segRectDist } from "./prop-pick.mjs";

const PAST = 2; // px: the shot's stop pushed on, so the window it stops at is crossed
export const MISS_NEAR = 1.5; // squares: the miss line passes this near the target (or as near as its own angle lets it)
export const MISS_LONGER = 3; // squares: the miss line is at most the attacker-target distance plus this
const finite = (p) => Number.isFinite(p?.x) && Number.isFinite(p?.y);
const rect = (r) => [r?.x, r?.y, r?.w, r?.h].every(Number.isFinite);
const dist = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
const centreOf = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

// How far along a-b (0..1) it meets the wall's line.
function shareAlong(a, b, wall) {
  const [x1, y1, x2, y2] = wall.c, rx = b.x - a.x, ry = b.y - a.y, sx = x2 - x1, sy = y2 - y1;
  const den = rx * sy - ry * sx;
  return den ? ((x1 - a.x) * sy - (y1 - a.y) * sx) / den : 0;
}

// The breakable window a planned miss shot flies into, and when: {wall, at} with at in ms into the play, or null.
// flight: {from, to, start, arrive} (missFlightsOf, or planFlight's path with start/arrive 0): the first window on its
// path as drawn (a window it stops at counts; one behind the wall that stopped it does not), reached in proportion to
// its share of the path. walls: the scene's (wall-break views); levels: the target's.
export function windowOnFlight(flight, walls, scene, levels) {
  const { from, to } = flight ?? {};
  if (!finite(from) || !finite(to)) return null;
  const len = dist(from, to);
  if (!len) return null;
  const k = (len + PAST) / len, tip = { x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k };
  const wall = windowOnLine(from, tip, walls, scene, levels);
  if (!wall) return null;
  const share = Math.max(0, Math.min(1, shareAlong(from, to, wall)));
  const start = Number(flight.start) || 0, arrive = Number.isFinite(flight.arrive) ? flight.arrive : start;
  return { wall, at: Math.round(start + Math.max(0, arrive - start) * share) };
}

// The GM's check of a ranged miss line {from, to} (to: its free end): it starts on the attacker's token (footprint
// {x, y, w, h}), it is at most the attacker-target distance plus MISS_LONGER squares, and it passes within MISS_NEAR
// squares of the target's footprint, or as near as the miss line's own angle lets it at that distance (a shot from far
// off flies wide of the target by more than a square and a half).
export function missPathOk(path, attacker, target, grid = 100) {
  const { from, to } = path ?? {};
  if (!finite(from) || !finite(to) || !rect(attacker) || !rect(target)) return false;
  const slack = 1;
  if (from.x < attacker.x - slack || from.x > attacker.x + attacker.w + slack || from.y < attacker.y - slack || from.y > attacker.y + attacker.h + slack) return false;
  const d = dist(centreOf(attacker), centreOf(target));
  if (dist(from, to) > d + MISS_LONGER * grid + slack) return false;
  const near = Math.max(MISS_NEAR * grid, d * Math.sin((MISS_ANGLE * Math.PI) / 180));
  return segRectDist(from, to, { x: target.x, y: target.y, width: target.w, height: target.h }) <= near + slack;
}

// The window a ranged miss line breaks as the GM reads it: the first window on the claimed line, on the target's level.
export function windowOnMissPath(path, walls, scene, levels) {
  return finite(path?.from) && finite(path?.to) ? windowOnLine(path.from, path.to, walls, scene, levels) : null;
}

// Where the shot of a roll is told and asked for (main.mjs): the playing runtime reports its planned miss shots
// (missFlightsOf) by the roll's message, and the client that rolled asks for them, whichever comes first. wait(key, ms)
// resolves {flights, age} (age: ms since they were reported) or null when none came within ms; a report nobody asks for is
// kept for keep ms. now, later(fn, ms) and cancel(id): the clock and timers (Date.now, setTimeout, clearTimeout).
export function createMissFlights({ now = () => Date.now(), later = (fn, ms) => setTimeout(fn, ms), cancel = (id) => clearTimeout(id), keep = 10000 } = {}) {
  const told = new Map(), asked = new Map();
  return {
    flown(key, flights) {
      if (key === undefined || key === null || !Array.isArray(flights)) return;
      const waiting = asked.get(key);
      if (waiting) { asked.delete(key); cancel(waiting.timer); waiting.resolve({ flights, age: 0 }); return; }
      const before = told.get(key);
      if (before) cancel(before.timer);
      told.set(key, { flights, at: now(), timer: later(() => told.delete(key), keep) });
    },
    wait(key, ms) {
      const have = told.get(key);
      if (have) { told.delete(key); cancel(have.timer); return Promise.resolve({ flights: have.flights, age: Math.max(0, now() - have.at) }); }
      if (key === undefined || key === null) return Promise.resolve(null);
      const before = asked.get(key);
      if (before) { cancel(before.timer); before.resolve(null); }
      return new Promise((resolve) => {
        asked.set(key, { resolve, timer: later(() => { asked.delete(key); resolve(null); }, ms) });
      });
    },
  };
}
