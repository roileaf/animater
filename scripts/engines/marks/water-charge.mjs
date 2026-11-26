// Lightning on water. Where an electricity area's mark would have lain on a pond, the charge runs out across the water
// instead: forked arcs from where it struck, out to the bank and no further, and one that finds each creature standing
// in that water and crawls over it a moment. Looks only — no game system says electricity spreads through water, so
// nothing is rolled, written or told. Pure: the plan of one strike, from its seed, the same on every screen; the
// drawing is reaction-fx.mjs ('charge').
import { seededRandom } from '../fragments/fragments.mjs';

/** How long a strike on water shows at the least, in ms: the run across the pond and the last creature it holds. */
export const CHARGE_MS = 2600;
/**
 * How long a strike shows when its spell's animation still has `left` ms to play: the water stays alive until the
 * animation is over, and then dies away. Returns { durationMs, hold }: `hold` the seconds it stays at full strength.
 */
export function chargeSpan(left = 0) { const hold = Math.max(0.95, (Number(left) || 0) / 1000); return { durationMs: Math.round(Math.max(CHARGE_MS, hold * 1000 + 1650)), hold }; }
const ARCS = 7, FORKS = 2, FORK_CHANCE = 0.1, MOST_SEGMENTS = 500, MOST_GRABS = 8;
// In squares: how far an arc runs, how long its pieces are, how far off a creature is still found, how fast it runs a second.
const RUN = 6.5, STEP = 0.16, REACH = 8, SPEED = 11;

const finite = (p) => Number.isFinite(p?.x) && Number.isFinite(p?.y);
const inFlat = (flat, p) => {
  let inside = false;
  for (let i = 0, n = flat.length, j = n - 2; i + 1 < n; j = i, i += 2) {
    const ax = flat[i], ay = flat[i + 1], bx = flat[j], by = flat[j + 1];
    if ((ay > p.y) !== (by > p.y) && p.x < ((bx - ax) * (p.y - ay)) / (by - ay) + ax) inside = !inside;
  }
  return inside;
};
// In a water, and not on an island in it.
const inWater = (water, p) => inFlat(water, p) && !(water.holes ?? []).some((hole) => inFlat(hole, p));

// A wandering, forking line of short pieces, each remembering how far along the run it lies, so it is drawn as it runs out.
function walk(random, from, angle, length, step, forks, ok, out, far) {
  let x = from.x, y = from.y, left = length;
  while (left > 0 && out.length < MOST_SEGMENTS) {
    angle += (random() - 0.5) * 0.8;
    const nx = x + Math.cos(angle) * step, ny = y + Math.sin(angle) * step;
    if (!ok({ x: nx, y: ny })) break;
    out.push({ x0: x, y0: y, x1: nx, y1: ny, far });
    if (forks > 0 && random() < FORK_CHANCE) walk(random, { x: nx, y: ny }, angle + (random() < 0.5 ? -1 : 1) * (0.5 + 0.6 * random()), left * 0.55, step, forks - 1, ok, out, far + step);
    x = nx; y = ny; left -= step; far += step;
  }
}

/**
 * One strike's plan, or null when it struck no open water. `spots` are the stretches of water under the mark
 * ([{ x, y, r }], mark-paint.mjs markSteam), the widest first; `waters` the waters here (flat polygons, their islands
 * on `holes`); `tokens` the creatures this screen may show it on ([{ x, y, r }]); `wet(p)` whether a place is open
 * water now (not ice over it). Returns { at, pond, arcs, grabs, speed, reach }: where it struck; that water's own
 * shape; the arcs' pieces and the creatures it finds, both measured from `at`; how fast it runs (pixels a second) and
 * how far. `hold` (seconds, chargeSpan) is passed on for the drawing: how long it stays before it dies away.
 */
export function chargePlan({ spots = [], waters = [], tokens = [], seed = 1, grid = 100, wet = () => true, hold = 0.95 } = {}) {
  const size = grid > 0 ? grid : 100, asked = (p) => { try { return wet(p) === true; } catch { return false; } };
  let at = null, pond = null;
  for (const spot of spots ?? []) {
    if (!finite(spot)) continue;
    const water = (waters ?? []).find((w) => Array.isArray(w) && w.length >= 6 && inWater(w, spot));
    if (water && asked(spot)) { at = { x: spot.x, y: spot.y }; pond = water; break; }
  }
  if (!at) return null;
  const random = seededRandom(seed >>> 0), arcs = [], run = (p) => inWater(pond, { x: p.x + at.x, y: p.y + at.y });
  for (let i = 0; i < ARCS; i++) walk(random, { x: 0, y: 0 }, (i / ARCS) * Math.PI * 2 + random() * 0.4, size * RUN, size * STEP, FORKS, run, arcs, 0);
  const grabs = [];
  for (const t of tokens ?? []) {
    if (!finite(t) || grabs.length >= MOST_GRABS) continue;
    const d = Math.hypot(t.x - at.x, t.y - at.y);
    if (d <= size * REACH && inWater(pond, t)) grabs.push({ dx: t.x - at.x, dy: t.y - at.y, r: t.r > 0 ? t.r : size / 2, d });
  }
  return { at, pond, arcs, grabs, speed: size * SPEED, reach: size * REACH, hold: hold > 0.95 ? hold : 0.95 };
}
