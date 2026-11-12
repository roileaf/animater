// How a crossing between heights looks on the map (Map painting's Heights, heights.mjs crossings): a ladder, a rope or a bridge,
// in weathered wood and hemp toned into the painted map (Roi, of the first mock: "too cartoony"): muted and darker than the
// lit ground, thin uneven ink, pieces of uneven size with grain and dark undersides, one rung or plank gone, rope that sags,
// shadows thrown away from the sun. Drawn with PIXI.Graphics calls into `g`, their shadows into `sh` (to be blurred and faded
// by the caller), so it is tested with a stand-in. A ramp is drawn by the caller (faint hatching downhill).

const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const hexOf = (c) => (Math.round(Math.max(0, Math.min(255, c[0]))) << 16) | (Math.round(Math.max(0, Math.min(255, c[1]))) << 8) | Math.round(Math.max(0, Math.min(255, c[2])));
export const INK = 0x180f08;
export const wood = (k) => hexOf([96, 78, 56].map((c, i) => c * (0.78 + 0.3 * k) + [0, -2, -6][i]));
export const hemp = (k) => hexOf([126, 108, 78].map((c) => c * (0.7 + 0.35 * k)));
const SNOW = 0xf3f6fb;

/** A piece of wood from a to b, `w` thick (px): its dark underside, its own tone toward the sun, a pale lit edge, a little
 *  grain, thin uneven ink. `sun` the way the light comes from (a unit { x, y }); `k` the map's px per 100. */
export function plank(g, ax, ay, bx, by, w, seed, sun, k = 1, { wet = 0, snow = 0 } = {}) {
  const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len, lit = nx * sun.x + ny * sun.y > 0 ? 1 : -1;
  // (Wet wood is darker: its tone pulled down. Roi: "lets make heights support weather".)
  const tone = (0.35 + hash(seed) * 0.5) * (1 - 0.45 * Math.max(0, Math.min(1, wet))), wob = (hash(seed * 7) - 0.5) * w * 0.25;
  const quad = (o0, o1) => [ax + nx * o0 * w, ay + ny * o0 * w, bx + nx * (o0 * w + wob), by + ny * (o0 * w + wob), bx + nx * (o1 * w + wob), by + ny * (o1 * w + wob), ax + nx * o1 * w, ay + ny * o1 * w];
  g.lineStyle(0); g.beginFill(wood(tone * 0.55), 1); g.drawPolygon(quad(-0.5, 0.5)); g.endFill();
  g.beginFill(wood(tone), 1); g.drawPolygon(quad(0.5 * lit, -0.15 * lit)); g.endFill();
  g.lineStyle(Math.max(0.6, 0.8 * k), 0xd2be96, 0.18 + 0.12 * tone); g.moveTo(ax + nx * 0.42 * w * lit, ay + ny * 0.42 * w * lit); g.lineTo(bx + nx * (0.42 * w * lit + wob), by + ny * (0.42 * w * lit + wob));
  g.lineStyle(Math.max(0.5, 0.7 * k), 0x1e140c, 0.35);
  for (let i = 0; i < 2; i++) { const o = (hash(seed * 3 + i) - 0.5) * 0.6 * w, t0 = hash(seed + i * 5) * 0.3, t1 = 0.6 + hash(seed * 2 + i) * 0.4; g.moveTo(ax + dx * t0 + nx * o, ay + dy * t0 + ny * o); g.lineTo(ax + dx * t1 + nx * o, ay + dy * t1 + ny * o); }
  g.lineStyle((0.9 + 0.5 * hash(seed * 11)) * k, INK, 0.75); g.drawPolygon(quad(-0.5, 0.5));
  // Wet: a faint sheen along it. Snow: lying along its upper edge (the side up the map), more the more lies.
  if (wet > 0.05) { g.lineStyle(Math.max(0.5, 0.6 * k), 0xdce6ff, 0.22 * wet); g.moveTo(ax + nx * 0.1 * w, ay + ny * 0.1 * w); g.lineTo(bx + nx * (0.1 * w + wob), by + ny * (0.1 * w + wob)); }
  if (snow > 0.05) { const up = ny <= 0 ? 1 : -1, o0 = 0.5 * up, o1 = (0.5 - 0.38 * Math.min(1, snow * 1.2)) * up; g.lineStyle(0); g.beginFill(SNOW, Math.min(1, snow * 1.3)); g.drawPolygon(quad(o0, o1)); g.endFill(); }
}

/** A ladder down a cliff face from its top (x0, y0, at the rim) to its foot (x1, y1), `w` wide: two worn rails, uneven rungs,
 *  one gone, a little dirt where it stands. Returns how many rungs it drew. */
export function drawLadder(g, sh, x0, y0, x1, y1, { w = 20, sun = { x: -Math.SQRT1_2, y: -Math.SQRT1_2 }, k = 1, seed = 0, reach = 12, wet = 0, snow = 0 } = {}) {
  const weather = { wet, snow };
  const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len, nx = -uy * w / 2, ny = ux * w / 2;
  // (Its shadow in its own parts, rails and rungs, on the rock behind it: none at its foot, where it stands, growing to `reach`
  // at its top, squashed down the face. Roi: "can we have realistic shadows ... to a leaning ladder\rope against a cliff".)
  const lean = (t) => { const f = Math.max(0, 1 - t / len) * reach * k; return [-sun.x * f, -sun.y * f * 0.5]; };
  sh.lineStyle({ width: 3.2 * k, color: 0x0d0905, alpha: 1, cap: 'round' });
  for (const side of [-1, 1]) for (let t = 0, first = true; t <= len + 0.01; t += Math.max(4, len / 12), first = false) { const [ox, oy] = lean(t), x = x0 + ux * t + nx * side + ox, y = y0 + uy * t + ny * side + oy; if (first) sh.moveTo(x, y); else sh.lineTo(x, y); }
  let t = 8 * k, i = 0, rungs = 0;
  while (t < len - 3 * k) { if (i !== 3) { const sk = (hash(i * 13 + seed) - 0.5) * 2.5 * k, cx = x0 + ux * t, cy = y0 + uy * t, [ox, oy] = lean(t); sh.lineStyle({ width: 2.6 * k, color: 0x0d0905, alpha: 1, cap: 'round' }); sh.moveTo(cx + nx + ox, cy + ny + oy); sh.lineTo(cx - nx + ox, cy - ny + oy); plank(g, cx + nx * 1.05, cy + ny * 1.05 + sk * 0.2, cx - nx * 1.05, cy - ny * 1.05 - sk * 0.2, 3.2 * k, 40 + i + seed, sun, k, weather); rungs++; } t += (9 + hash(i * 7 + seed) * 3.5) * k; i++; }
  for (const s of [-1, 1]) plank(g, x0 + nx * s - ux * 7 * k, y0 + ny * s - uy * 7 * k, x1 + nx * s + ux * 0.6 * s, y1 + ny * s + uy * 0.6 * s, 3.6 * k, (s > 0 ? 3 : 9) + seed, sun, k, { wet, snow: snow * 0.4 });
  g.lineStyle(0); g.beginFill(0x281e12, 0.45); g.drawEllipse(x1 + ux * 3 * k, y1 + uy * 3 * k, w * 0.6, 3.2 * k); g.endFill();
  return rungs;
}

const bezier = (x0, y0, mx, my, x1, y1, t) => [(1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * mx + t * t * x1, (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * my + t * t * y1];
/** A rope from a stake at the rim (x0, y0) down the face to (x1, y1): sagging, its twist showing, a loose uneven coil at the foot. */
export function drawRope(g, sh, x0, y0, x1, y1, { sun = { x: -Math.SQRT1_2, y: -Math.SQRT1_2 }, k = 1, seed = 0, wet = 0, snow = 0 } = {}) {
  const damp = 1 - 0.5 * Math.max(0, Math.min(1, wet));
  const mx = (x0 + x1) / 2 + 9 * k, my = (y0 + y1) / 2 + 2 * k, at = (t) => bezier(x0, y0, mx, my, x1, y1, t), off = 5 * k;
  const line = (gr, w, col, a, dx = 0, dy = 0) => { gr.lineStyle({ width: w, color: col, alpha: a, cap: 'round', join: 'round' }); for (let t = 0; t <= 1.0001; t += 0.04) { const [x, y] = at(t), j = (hash(t * 91 + seed) - 0.5) * 0.6 * k; if (t) gr.lineTo(x + j + dx, y + dy); else gr.moveTo(x + dx, y + dy); } };
  // (Its shadow a thin line on the rock, a little away from it at the top, meeting it at the foot.)
  sh.lineStyle({ width: 2.2 * k, color: 0x0d0905, alpha: 1, cap: 'round', join: 'round' }); for (let t = 0; t <= 1.0001; t += 0.04) { const [x, y] = at(t), f = (1 - t) * off * 1.6; if (t) sh.lineTo(x - sun.x * f, y - sun.y * f * 0.5); else sh.moveTo(x - sun.x * f, y - sun.y * f * 0.5); }
  line(g, 4 * k, INK, 0.7); line(g, 2.8 * k, hemp(0.45 * damp), 1);
  for (let t = 0.02; t < 1; t += 0.035) { const [x, y] = at(t), [x2, y2] = at(t + 0.01), dx = x2 - x, dy = y2 - y, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l; g.lineStyle(Math.max(0.6, 0.8 * k), hash(t * 7 + seed) > 0.5 ? 0xc8b48c : 0x1e140c, hash(t * 7 + seed) > 0.5 ? 0.35 : 0.4); g.moveTo(x - nx * 1.3 * k - dx / l, y - ny * 1.3 * k - dy / l); g.lineTo(x + nx * 1.3 * k + dx / l, y + ny * 1.3 * k + dy / l); }
  // The stake, driven in at a lean, the rope round it.
  const sx = x0 - 7 * k, sy = y0 - 6 * k;
  sh.lineStyle(0); sh.beginFill(0x0d0905, 1); sh.drawCircle(sx - sun.x * 4 * k, sy - sun.y * 4 * k, 4 * k); sh.endFill();
  g.lineStyle(k, INK, 0.8); g.beginFill(wood(0.4), 1); g.drawEllipse(sx, sy, 4 * k, 3.4 * k); g.endFill();
  g.lineStyle(0); g.beginFill(wood(0.75), 1); g.drawEllipse(sx - 0.8 * k, sy - 0.8 * k, 2.2 * k, 1.7 * k); g.endFill();
  g.lineStyle(2 * k, hemp(0.4), 1); g.moveTo(x0 - 4 * k, y0 - 4 * k); g.quadraticCurveTo(x0 - 2 * k, y0 - k, x0, y0);
  // The coil: a few loose, uneven loops lying at the foot.
  sh.lineStyle(0); sh.beginFill(0x0d0905, 1); sh.drawEllipse(x1 + 6 * k - sun.x * 3 * k, y1 + 5 * k - sun.y * 3 * k, 11 * k, 8 * k); sh.endFill();
  for (let r = 0; r < 4; r++) {
    const rx = (6 + r * 2.2 + hash(r + seed) * 1.5) * k, ry = rx * (0.7 + hash(r * 3 + seed) * 0.1), cx = x1 + (5 + hash(r * 5 + seed) * 2.5) * k, cy = y1 + (4 + hash(r * 9 + seed) * 2) * k, a0 = 0.3 * r, a1 = a0 + 5.6;
    for (const [w, col, a] of [[3 * k, INK, 0.6], [1.9 * k, hemp((0.3 + 0.1 * r) * damp), 1]]) { g.lineStyle(w, col, a); for (let s = 0; s <= 24; s++) { const ang = a0 + ((a1 - a0) * s) / 24, x = cx + Math.cos(ang) * rx, y = cy + Math.sin(ang) * ry; if (s) g.lineTo(x, y); else g.moveTo(x, y); } }
  }
  // (A little snow lying on the coil.)
  if (snow > 0.05) { g.lineStyle(0); g.beginFill(SNOW, Math.min(1, snow * 1.2)); g.drawEllipse(x1 + 6 * k, y1 + 1.5 * k, 9 * k * (0.6 + 0.4 * snow), 3 * k * (0.6 + 0.4 * snow)); g.endFill(); }
}

/** A plank bridge from (x0, y0) to (x1, y1), `w` wide, held by rope rails sagging between leaning posts: uneven planks with
 *  gaps, one gone; its shadow on the ground below, thrown away from the sun by `drop` px (its height over the ground).
 *  Returns how many planks it drew. */
export function drawBridge(g, sh, x0, y0, x1, y1, { w = 30, drop = 20, rise = null, sun = { x: -Math.SQRT1_2, y: -Math.SQRT1_2 }, k = 1, seed = 0, wet = 0, snow = 0 } = {}) {
  const weather = { wet, snow }, damp = 1 - 0.5 * Math.max(0, Math.min(1, wet));
  const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len, nx = -uy * w / 2, ny = ux * w / 2;
  // (Its shadow in its own planks, gaps and rails, each thrown away from the sun by how high it stands over the ground under
  // it there: far over the low ground, nothing where it rests on the tops. Roi: "can we have realistic shadows for the bridge?")
  const push = (t) => { const d = Math.max(0, Number(rise ? rise(Math.max(0, Math.min(1, t))) : drop) || 0); return [-sun.x * d, -sun.y * d]; };
  for (const s of [-0.75, 0.75]) plank(g, x0 + nx * s, y0 + ny * s, x1 + nx * s, y1 + ny * s, 2.6 * k, (s > 0 ? 71 : 73) + seed, sun, k, { wet, snow: snow * 0.4 });
  let t = 2 * k, i = 0, planks = 0;
  while (t < len - 2 * k) {
    const pw = (5 + hash(i * 3.3 + seed) * 2.5) * k;
    if (i !== 4) { const sk = (hash(i * 5.1 + seed) - 0.5) * 2 * k, cx = x0 + ux * (t + pw / 2), cy = y0 + uy * (t + pw / 2), shrink = 0.92 + hash(i * 1.7 + seed) * 0.1, [ox, oy] = push((t + pw / 2) / len), hu = pw / 2;
      sh.lineStyle(0); sh.beginFill(0x0d0905, 1); sh.drawPolygon([cx + nx * shrink - ux * hu + ox, cy + ny * shrink - uy * hu + oy, cx + nx * shrink + ux * hu + ox, cy + ny * shrink + uy * hu + oy, cx - nx * shrink + ux * hu + ox, cy - ny * shrink + uy * hu + oy, cx - nx * shrink - ux * hu + ox, cy - ny * shrink - uy * hu + oy]); sh.endFill();
      plank(g, cx + nx * shrink + ux * sk, cy + ny * shrink + uy * sk, cx - nx * shrink - ux * sk, cy - ny * shrink - uy * sk, pw, 100 + i + seed, sun, k, weather); planks++; }
    t += pw + (0.8 + hash(i * 2.2 + seed) * 1.2) * k; i++;
  }
  for (const s of [-1, 1]) {
    const px0 = x0 + nx * s * 1.12, py0 = y0 + ny * s * 1.12, px1 = x1 + nx * s * 1.12, py1 = y1 + ny * s * 1.12, cx = (px0 + px1) / 2 + 3 * k, cy = (py0 + py1) / 2 + 5 * k;
    sh.lineStyle({ width: 2.2 * k, color: 0x0d0905, alpha: 1, cap: 'round', join: 'round' }); for (let q = 0; q <= 1.0001; q += 1 / 24) { const [bx, by] = bezier(px0, py0, cx, cy, px1, py1, q), [ox, oy] = push(q); if (q) sh.lineTo(bx + ox * 1.05, by + oy * 1.05); else sh.moveTo(bx + ox * 1.05, by + oy * 1.05); }
    for (const [wd, col, a] of [[2.8 * k, INK, 0.65], [1.8 * k, hemp(0.45 * damp), 1]]) { g.lineStyle(wd, col, a); g.moveTo(px0, py0); g.quadraticCurveTo(cx, cy, px1, py1); }
    for (const [px, py, q] of [[px0, py0, 0], [px1, py1, 1]]) {
      const [ox, oy] = push(q); sh.lineStyle(0); sh.beginFill(0x0d0905, 1); sh.drawCircle(px - sun.x * 5 * k + ox, py - sun.y * 5 * k + oy, 3.6 * k); sh.endFill();
      g.lineStyle(k, INK, 0.8); g.beginFill(wood(0.35), 1); g.drawEllipse(px, py, 3.6 * k, 3.1 * k); g.endFill();
      g.lineStyle(0); g.beginFill(wood(0.7), 1); g.drawEllipse(px - 0.8 * k, py - 0.8 * k, 1.8 * k, 1.4 * k); g.endFill();
    }
  }
  return planks;
}

/** A bridge's post (into `g`) at (x, y): a stout round of wood seen from above, inked, lit on top, its shadow a little away from the
 *  sun into `sh`; snow on it when some lies. Where a swaying span leaves its still end, a pair of these hold its rope rails
 *  (Roi, of a rail cut off there: "you can fix it by putting another pole where it cuts off"). */
export function drawPost(g, sh, x, y, { k = 1, sun = { x: -Math.SQRT1_2, y: -Math.SQRT1_2 }, wet = 0, snow = 0 } = {}) {
  const r = 4.2 * k, tone = 0.35 * (1 - 0.45 * Math.max(0, Math.min(1, wet)));
  if (sh) { sh.lineStyle(0); sh.beginFill(0x0d0905, 1); sh.drawCircle(x - sun.x * 5 * k, y - sun.y * 5 * k, r); sh.endFill(); }
  g.lineStyle(k, INK, 0.85); g.beginFill(wood(tone), 1); g.drawEllipse(x, y, r, r * 0.88); g.endFill();
  g.lineStyle(0); g.beginFill(wood(tone + 0.35), 1); g.drawEllipse(x - 0.9 * k, y - 0.9 * k, r * 0.5, r * 0.42); g.endFill();
  if (snow > 0.05) { g.beginFill(0xf3f6fb, Math.min(1, snow * 1.3)); g.drawEllipse(x, y - r * 0.2, r * 0.75, r * 0.5); g.endFill(); }
}
