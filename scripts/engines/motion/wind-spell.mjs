// Wind spells blow. A spell of wind has an area and, most of them, no damage: so nothing in the world noticed it. Now
// the air in its area moves the way the spell sends it (gusts.mjs), and what the wind already moves obeys: trees bend,
// flames and smoke lean, cloth snaps. For a moment, on each screen, changing nothing (Roi, 2026-11-25, of putting
// torches out with one: "theres no such mechanic, so visual only"). Pure: what is a wind spell, and the gusts of a shape.

// How long a wind spell's gust blows, in ms.
export const WIND_SPELL_MS = 1800;

// Named for wind, in whatever system. Whole words: a Window of Opportunity is not one, nor is Rewind.
const WINDY = /\b(?:gusts?|winds?|whirlwinds?|windstorms?|cyclones?|tornado(?:es)?|gales?|tempests?|squalls?|zephyrs?|hurricanes?)\b/i;

/** Whether a spell is one of wind (pure): it has the air trait (PF2e, SF2e), or its name says so. */
export function isWindSpell({ name = '', traits = [] } = {}) {
  return (traits ?? []).includes('air') || WINDY.test(String(name ?? ''));
}

const fin = (...v) => v.every(Number.isFinite), rad = (d) => ((Number(d) || 0) * Math.PI) / 180;
// One gust blowing `long` px from a point the way `heading` points, `wide` across: its head set just past the far end,
// so the whole length behind it is in its wake. `inside`: it blows under a ceiling too (the spell was cast in the room).
const along = (x, y, heading, long, wide, strength) => ({
  x: x + Math.cos(heading) * (long + wide / 3), y: y + Math.sin(heading) * (long + wide / 3), heading, strength, width: wide, length: long * 0.95, ms: WIND_SPELL_MS, inside: true,
});
// Outward every way from a middle, as far as `radius`: eight gusts, each gentle, adding up to a wind away from the middle.
const outward = (x, y, radius) => Array.from({ length: 8 }, (_, i) => along(x, y, (i / 8) * Math.PI * 2, radius, radius * 0.9, 0.6));

/**
 * The gusts a wind spell's area blows (pure), for gusts.add: [{ x, y, heading, strength, width, length, ms, inside }].
 * `shape`: the area's own (a Region's shape, or wall-breach.mjs templateShape of a template): a line and a cone blow
 * from their start the way they point; a burst, an emanation, and anything with no direction of its own blow outward
 * from the middle. A shape that cannot be read blows nothing.
 */
export function windSpellGusts(shape, { grid = 100 } = {}) {
  const s = shape;
  if (!s || typeof s !== 'object') return [];
  if (s.type === 'line' && fin(s.x, s.y, s.length) && s.length > 0) return [along(s.x, s.y, rad(s.rotation), s.length, Math.max(Number(s.width) || 0, grid * 2) * 1.25, 1)];
  if (s.type === 'cone' && fin(s.x, s.y, s.radius) && s.radius > 0) return [along(s.x, s.y, rad(s.rotation), s.radius, Math.max(grid * 2, 2 * s.radius * Math.sin(rad(s.angle || 90) / 2) * 0.6), 1)];
  if (['circle', 'ellipse', 'ring', 'emanation'].includes(s.type) && fin(s.x, s.y)) { const r = Number(s.radius) || Math.max(Number(s.radiusX) || 0, Number(s.radiusY) || 0); return r > 0 ? outward(s.x, s.y, r) : []; }
  if (s.type === 'rectangle' && fin(s.x, s.y, s.width, s.height)) {
    const u = (0.5 - (Number(s.anchorX) || 0)) * s.width, v = (0.5 - (Number(s.anchorY) || 0)) * s.height, r = rad(s.rotation);
    return outward(s.x + u * Math.cos(r) - v * Math.sin(r), s.y + u * Math.sin(r) + v * Math.cos(r), Math.max(s.width, s.height) / 2);
  }
  if (s.type === 'polygon' && s.points?.length >= 6) {
    const p = Array.from(s.points), n = Math.floor(p.length / 2); let x = 0, y = 0, far = 0;
    for (let i = 0; i < n; i++) { x += p[2 * i]; y += p[2 * i + 1]; }
    x /= n; y /= n;
    for (let i = 0; i < n; i++) far = Math.max(far, Math.hypot(p[2 * i] - x, p[2 * i + 1] - y));
    return fin(x, y) && far > 0 ? outward(x, y, far) : [];
  }
  return [];
}
