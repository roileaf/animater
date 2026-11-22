// Who a placed area catches: the creatures its target stages play for (an impact on each one inside).
// The user's own targets are not enough: a system or module that targets what a template covers does it a moment
// after the area is set down, and targets left from an earlier action may stand anywhere on the map.

// The middle of every grid square a token stands on: a big creature is caught by any one of them.
export function tokenSamples(token, gridSize = 100) {
  const doc = token?.document ?? {}, wide = Math.max(1, Math.round(Number(doc.width) || 1)), tall = Math.max(1, Math.round(Number(doc.height) || 1));
  if (wide * tall === 1 || wide * tall > 36) return [{ x: token.center.x, y: token.center.y }];
  const left = Number(doc.x ?? token.center.x - (wide * gridSize) / 2), top = Number(doc.y ?? token.center.y - (tall * gridSize) / 2), points = [];
  for (let row = 0; row < tall; row++) for (let col = 0; col < wide; col++) points.push({ x: left + (col + 0.5) * gridSize, y: top + (row + 0.5) * gridSize });
  return points;
}

// tokens: every token on the scene; userTargets: who the user has targeted; source: the caster (never its own
// target); inside(point, token): whether the area covers a point, or null when the area cannot be read.
// The user's targets that stand in the area if any do (a chosen few among those it covers), else everyone in it.
// Hidden creatures are never added: an impact on one would give it away.
export function areaTargets({ tokens = [], userTargets = [], source = null, inside = null, gridSize = 100 } = {}) {
  if (typeof inside !== "function") return [...userTargets];
  try {
    const caught = (token) => token && token !== source && token.id !== source?.id && tokenSamples(token, gridSize).some((point) => inside(point, token) === true);
    const chosen = userTargets.filter(caught);
    return chosen.length ? chosen : tokens.filter((token) => !token?.document?.hidden && caught(token));
  } catch {
    return [...userTargets];
  }
}
