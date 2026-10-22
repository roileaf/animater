// Afterimage trails: pure decisions about when a fast, ground-covering motion drops ghosts.
import { pathDistance } from './motion-path.mjs';
import { pathEnd } from './keyframe-path.mjs';

export const TRAILING = new Set(['rush', 'leap', 'roll', 'dodge', 'path']);
const MIN_TRAVEL_SQ = 1;

// Squares the stage covers from its resting spot.
function travelSquares(stage, gridPx) {
  if (stage.motion === 'path') {
    if (!Array.isArray(stage.keyframes) || !stage.keyframes.length) return 0;
    const end = pathEnd(stage.keyframes);
    return Math.hypot(end.x, end.y);
  }
  const offset = stage.motionOffset;
  const offsetLength = offset ? Math.hypot(offset.x, offset.y) : null;
  if (offsetLength !== null) return offsetLength;
  return pathDistance(stage, {}, gridPx) / gridPx;
}

// Push/pull are held `rush` stages, so they trail like a rush. `afterimages` is auto | always | never.
export function trails(stage, gridPx) {
  if (stage?.kind && stage.kind !== 'motion') return false;
  if (!TRAILING.has(stage?.motion)) return false;
  const mode = stage.afterimages ?? 'auto';
  if (mode === 'never') return false;
  if (mode === 'always') return true;
  return travelSquares(stage, gridPx) >= MIN_TRAVEL_SQ;
}

// Drops a ghost each `spacingSq` squares of outbound travel while moving faster than minSpeedSq squares per second.
export function createTrailGate({ spacingSq = 0.4, minSpeedSq = 4 } = {}) {
  let last = null, carried = 0;
  return {
    step(pose, rest, dtMs, gridPx) {
      const from = last ?? rest;
      last = { x: pose.x, y: pose.y };
      if (!(dtMs > 0) || !(gridPx > 0)) return false;
      const moved = Math.hypot(pose.x - from.x, pose.y - from.y) / gridPx;
      const speed = moved / (dtMs / 1000);
      const outbound = Math.hypot(pose.x - rest.x, pose.y - rest.y) > Math.hypot(from.x - rest.x, from.y - rest.y);
      if (!outbound || speed < minSpeedSq) return false;
      carried += moved;
      if (carried < spacingSq - 1e-9) return false;
      carried -= spacingSq;
      return true;
    },
  };
}

export function ghostAlpha(ageMs, { start = 0.4, fadeMs = 350 } = {}) {
  return start * Math.min(1, Math.max(0, 1 - ageMs / fadeMs));
}

// Ghost positions evenly from `from` to `to`, each appearing a little after the one before.
export function streakLayout(from, to, { count = 5, appearMs = 150 } = {}) {
  return Array.from({ length: count }, (_, i) => {
    const t = count > 1 ? i / (count - 1) : 1;
    return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t, delayMs: appearMs * t };
  });
}
