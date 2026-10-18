export const isColorArray = v => Array.isArray(v) && v.length === 3 && v.every(n => typeof n === 'number' && Number.isFinite(n));
// Shared value helpers for specs.
export const rgb = c => {
  if (isColorArray(c)) return c;
  const n = typeof c === 'string' && /^#?[\da-f]{6}$/i.test(c) ? parseInt(c.replace('#', ''), 16) : Number(c) || 0;
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};
export const deg = d => (Number(d) || 0) * Math.PI / 180;
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, Number.isFinite(+v) ? +v : lo));
