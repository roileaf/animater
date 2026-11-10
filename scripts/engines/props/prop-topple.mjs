// A toppled statue or pillar: where it lies, the rubble Region it leaves (v14 modifyMovementCost, walking costs double)
// and the GM's whisper about who stands under the fall. Pure: no Foundry globals.
import { onLevel } from "./prop-pick.mjs";

const RUBBLE_COLOR = "#7a6a55";
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const tidy = (v) => Math.round(v * 1000) / 1000 + 0; // no float dust, no -0

// The strip the statue falls along: from the rect's centre along cutAngle (away from the blow), as long as the rect's
// longer side and as wide as its shorter side. rect: {x, y, width, height} (top-left).
export function toppleStrip(rect, cutAngle) {
  const { x, y, width, height } = rect;
  return { from: { x: x + width / 2, y: y + height / 2 }, angle: cutAngle, length: Math.max(width, height), width: Math.min(width, height) };
}

// The strip's four corners as x, y pairs: the start edge's left, the far edge's left, its right, the start edge's right.
export function stripPolygon({ from, angle, length, width }) {
  const dx = Math.cos(angle), dy = Math.sin(angle), nx = -dy * (width / 2), ny = dx * (width / 2);
  const ex = from.x + dx * length, ey = from.y + dy * length;
  return [from.x - nx, from.y - ny, ex - nx, ey - ny, ex + nx, ey + ny, from.x + nx, from.y + ny].map(tidy);
}

// The Region the rubble is made of: a polygon on the statue's level that doubles the cost of walking (other movement
// actions keep their cost). flags.animater.propRubble names the tile so undo and Repair can find it.
export function rubbleRegionData({ strip, tileId, levels = [], bottom = null, top = null } = {}) {
  return {
    name: "Rubble", color: RUBBLE_COLOR,
    shapes: [{ type: "polygon", points: stripPolygon(strip) }],
    elevation: { bottom, top }, levels: [...levels],
    behaviors: [{ type: "modifyMovementCost", name: "Rubble", system: { difficulties: { walk: 2 } } }],
    flags: { animater: { propRubble: tileId } },
  };
}

// Whether two convex polygons (flat x, y lists) overlap with area: a shared edge or corner alone is not enough.
function overlap(a, b) {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i += 2) {
      const j = (i + 2) % poly.length, ax = poly[j + 1] - poly[i + 1], ay = poly[i] - poly[j]; // an edge's normal
      const range = (p) => { let lo = Infinity, hi = -Infinity; for (let k = 0; k < p.length; k += 2) { const d = p[k] * ax + p[k + 1] * ay; lo = Math.min(lo, d); hi = Math.max(hi, d); } return [lo, hi]; };
      const [alo, ahi] = range(a), [blo, bhi] = range(b), eps = 1e-6 * Math.hypot(ax, ay);
      if (ahi <= blo + eps || bhi <= alo + eps) return false;
    }
  }
  return true;
}

// The names of the tokens {name, x, y, w, h, level} whose square overlaps the strip, on the fall's levels.
export function tokensUnderStrip(tokens, strip, levels) {
  const poly = stripPolygon(strip);
  return (tokens ?? []).filter((t) => onLevel(t.level, levels) && overlap(poly, [t.x, t.y, t.x + t.w, t.y, t.x + t.w, t.y + t.h, t.x, t.y + t.h])).map((t) => t.name);
}

export function toppleWhisper(propName, names = []) {
  if (!names.length) return "";
  return `<p><b>${esc(propName || "A statue")} toppled.</b></p><p>Under the fall: ${names.map(esc).join(", ")}.</p>`;
}
