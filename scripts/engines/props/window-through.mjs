// A strike through glass breaking it, hit or miss. Pure: no Foundry globals.
// Any weapon Strike (melee, ranged or thrown) that hits its one target, whose straight line from the attacker's centre to
// the target's centre crosses a breakable intact window on the target's level, breaks the first such window on that line
// (nearest the attacker): always, no chance roll; it went through the glass. The glass rules still apply (the GM's
// canBreakWall with the weapon's damage type). The GM reads the line from the tokens it knows, never a client's claim.
// A miss breaks glass its own way, also always: a ranged miss by its flight (window-miss.mjs), a melee miss by its swing
// line (wall-triggers.mjs windowNextToMiss); the scene's miss chance is only for what a miss hits beside the target.
import { windowOnLine } from "./wall-triggers.mjs";

const rect = (r) => [r?.x, r?.y, r?.w, r?.h].every(Number.isFinite);
const centreOf = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
const finite = (p) => Number.isFinite(p?.x) && Number.isFinite(p?.y);

// A strike's degree of success as the through rule reads it: a hit or a critical hit, else null.
export const hitOutcome = (outcome) => (outcome === "success" || outcome === "criticalSuccess" ? outcome : null);
// Any strike's degree of success (hit or miss: glass the strike goes through breaks for every outcome), else null.
const STRIKE = new Set(["success", "criticalSuccess", "miss", "criticalFailure"]);
export const strikeOutcome = (outcome) => (STRIKE.has(outcome) ? outcome : null);

// The first breakable intact window the line from the attacker's centre to the target's centre crosses (footprints
// {x, y, w, h}), on the given levels; null when none. Any window counts here, whatever its material (the glass rule is
// applied after: a window the weapon cannot break still takes the blow).
export function windowThrough(attacker, target, walls, scene, levels) {
  if (!rect(attacker) || !rect(target)) return null;
  return windowOnLine(centreOf(attacker), centreOf(target), walls, scene, levels);
}

// The GM's check: this wall is the first window on the attacker-target centre line, on the given levels. walls: the
// scene's (the wall itself counts even when they leave it out).
export function throughOk(wall, attacker, target, walls, scene, levels) {
  if (!wall?.id) return false;
  const all = (walls ?? []).some((w) => w?.id === wall.id) ? walls : [...(walls ?? []), wall];
  return windowThrough(attacker, target, all, scene, levels)?.id === wall.id;
}

// When a flying weapon reaches the glass, in ms into the play: flight {from, to, start, arrive} (the play's planned hit
// shot, hitFlightsOf), the glass reached in proportion to where its line meets the flight's; 0 with no flight (at once).
export function throughAt(flight, wall) {
  if (!flight) return 0;
  const start = Number(flight.start) || 0, arrive = Number.isFinite(flight.arrive) ? flight.arrive : start;
  const { from, to } = flight;
  if (!finite(from) || !finite(to) || !Array.isArray(wall?.c)) return start;
  const [x1, y1, x2, y2] = wall.c, rx = to.x - from.x, ry = to.y - from.y, sx = x2 - x1, sy = y2 - y1;
  const den = rx * sy - ry * sx;
  if (!den) return start;
  const share = Math.max(0, Math.min(1, ((x1 - from.x) * sy - (y1 - from.y) * sx) / den));
  return Math.round(start + Math.max(0, arrive - start) * share);
}
