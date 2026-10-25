// Draws lens effect plans (lens-effects.mjs) on the lens blood overlay's two canvases: `mark` (multiplied over the
// board: soot, scorch, veins, cracks, tints) and `glint` (normal blending above it: frost, glare, arcs, embers). Each
// layer's static shapes are painted once into a sprite cropped to their bounds and cached with the plan, so a frame
// only draws a few bitmaps (faded, revealed through a clip), a vignette gradient or two and a handful of particles.
// The board's short CSS look (blur, desaturation, sway, double vision) goes through an injected host (boardHost).

import { cssColor } from './lens-blood.mjs';
import { envelope, boardAt, mergeBoard, boardStyle } from './lens-effects.mjs';

const TAU = Math.PI * 2;
const clamp01 = (v) => Math.min(1, Math.max(0, Number(v) || 0));
const smooth = (t) => { const v = clamp01(t); return v * v * (3 - 2 * v); };

function defaultCanvas(w, h) {
  if (typeof OffscreenCanvas === 'function') return new OffscreenCanvas(w, h);
  const doc = globalThis.document;
  if (!doc?.createElement) return null;
  const c = doc.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

// The box a shape covers, in area pixels.
function bounds(s) {
  if (s.p === 'path' || s.p === 'segs') {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < s.pts.length; i += 2) { const x = s.pts[i], y = s.pts[i + 1]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    const w = Math.max(s.w, s.halo?.w ?? 0);
    return [x0 - w, y0 - w, x1 + w, y1 + w];
  }
  const r = s.p === 'blot' ? s.r * Math.max(1, s.sx ?? 1) * 1.4 : s.p === 'ellipse' ? s.rx : s.p === 'ring' ? s.r + s.w : s.r;
  return [s.x - r, s.y - r, s.x + r, s.y + r];
}

// A blot's ragged outline (radius factors round it), smoothed through the midpoints.
function blotPath(ctx, s) {
  const n = s.rough?.length || 12, at = (i) => { const a = (i % n) / n * TAU, k = s.rough?.[i % n] ?? 1; return [Math.cos(a) * s.r * k, Math.sin(a) * s.r * k]; };
  ctx.beginPath();
  let [px, py] = at(0), [qx, qy] = at(1);
  ctx.moveTo((px + qx) / 2, (py + qy) / 2);
  for (let i = 1; i <= n; i++) {
    [px, py] = at(i); [qx, qy] = at(i + 1);
    ctx.quadraticCurveTo(px, py, (px + qx) / 2, (py + qy) / 2);
  }
  ctx.closePath();
}
function paintShape(ctx, s) {
  if (s.p === 'path') {
    ctx.beginPath();
    ctx.moveTo(s.pts[0], s.pts[1]);
    for (let i = 2; i < s.pts.length; i += 2) ctx.lineTo(s.pts[i], s.pts[i + 1]);
    // A soft halo under the line first (frost's sheen, a vein's bruise).
    if (s.halo) { ctx.strokeStyle = cssColor(s.halo.color ?? s.color, s.halo.alpha); ctx.lineWidth = s.halo.w; ctx.stroke(); }
    ctx.strokeStyle = cssColor(s.color, s.alpha);
    ctx.lineWidth = s.w;
    ctx.stroke();
  } else if (s.p === 'segs') {
    // Separate short lines (frost's needles) in one stroke.
    ctx.beginPath();
    for (let i = 0; i + 3 < s.pts.length; i += 4) { ctx.moveTo(s.pts[i], s.pts[i + 1]); ctx.lineTo(s.pts[i + 2], s.pts[i + 3]); }
    if (s.halo) { ctx.strokeStyle = cssColor(s.halo.color ?? s.color, s.halo.alpha); ctx.lineWidth = s.halo.w; ctx.stroke(); }
    ctx.strokeStyle = cssColor(s.color, s.alpha);
    ctx.lineWidth = s.w;
    ctx.stroke();
  } else if (s.p === 'blot') {
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.rot ?? 0);
    ctx.scale(s.sx ?? 1, 1);
    const soft = s.soft ?? 0.5, g = ctx.createRadialGradient(0, 0, 0, 0, 0, s.r * 1.15);
    g.addColorStop(0, cssColor(s.color, s.alpha));
    g.addColorStop(Math.max(0.05, 1 - soft * 0.8), cssColor(s.color, s.alpha * 0.85));
    g.addColorStop(1, cssColor(s.color, s.alpha * (1 - soft) * 0.3));
    blotPath(ctx, s);
    ctx.fillStyle = g;
    ctx.fill();
    if (s.rim) { ctx.strokeStyle = cssColor(s.rim.color, s.rim.alpha); ctx.lineWidth = s.rim.w / Math.max(1, s.sx ?? 1); ctx.stroke(); }
    ctx.restore();
  } else if (s.p === 'glow') {
    const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r);
    g.addColorStop(0, cssColor(s.core ?? s.color, s.alpha));
    g.addColorStop(0.3, cssColor(s.color, s.alpha * 0.6));
    g.addColorStop(1, cssColor(s.color, 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill();
  } else if (s.p === 'ellipse') {
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.rot ?? 0);
    ctx.scale(1, s.ry / s.rx);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, s.rx);
    g.addColorStop(0, cssColor(s.color, s.alpha));
    g.addColorStop(0.4, cssColor(s.color, s.alpha * 0.35));
    g.addColorStop(1, cssColor(s.color, 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, s.rx, 0, TAU); ctx.fill();
    ctx.restore();
  } else if (s.p === 'ring') {
    if (s.soft) {
      const a = Math.max(0, s.r - s.w / 2), b = s.r + s.w / 2, g = ctx.createRadialGradient(s.x, s.y, a, s.x, s.y, b);
      g.addColorStop(0, cssColor(s.color, 0)); g.addColorStop(0.5, cssColor(s.color, s.alpha)); g.addColorStop(1, cssColor(s.color, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(s.x, s.y, b, 0, TAU); ctx.fill();
    } else {
      ctx.strokeStyle = cssColor(s.color, s.alpha); ctx.lineWidth = s.w;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.stroke();
    }
  }
}

/**
 * Paints a layer's shapes once into a sprite cropped to them (inside the area w x h), at `dev` device pixels per
 * area pixel: { image, x, y, w, h } in area pixels, or null (no shapes, nothing on the lens, or no canvas here).
 */
export function paintLayer(layer, { w, h, dev = 1, make = defaultCanvas } = {}) {
  const shapes = layer?.shapes ?? [];
  if (!shapes.length) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const s of shapes) { const [a, b, c, d] = bounds(s); x0 = Math.min(x0, a); y0 = Math.min(y0, b); x1 = Math.max(x1, c); y1 = Math.max(y1, d); }
  x0 = Math.max(0, Math.floor(x0 - 2)); y0 = Math.max(0, Math.floor(y0 - 2)); x1 = Math.min(w, Math.ceil(x1 + 2)); y1 = Math.min(h, Math.ceil(y1 + 2));
  if (x1 <= x0 || y1 <= y0) return null;
  const cw = Math.max(1, Math.ceil((x1 - x0) * dev)), ch = Math.max(1, Math.ceil((y1 - y0) * dev));
  const image = make(cw, ch), ctx = image?.getContext?.('2d');
  if (!ctx) return null;
  ctx.setTransform(dev, 0, 0, dev, -x0 * dev, -y0 * dev);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const s of shapes) paintShape(ctx, s);
  return { image, x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

// A soft radial dot (embers, wisps) or a four-point sparkle, painted once per colour.
const DOTS = new Map();
function dot(make, color, star = false, core = null) {
  const key = `${color}:${star}:${core}`;
  if (DOTS.has(key)) return DOTS.get(key);
  const size = 32, c = make(size, size), ctx = c?.getContext?.('2d');
  if (!ctx) { DOTS.set(key, null); return null; }
  const m = size / 2;
  if (star) {
    ctx.fillStyle = cssColor(color, 0.9);
    for (const [rx, ry] of [[m, m * 0.12], [m * 0.12, m]]) { ctx.beginPath(); ctx.ellipse(m, m, rx, ry, 0, 0, TAU); ctx.fill(); }
  }
  const g = ctx.createRadialGradient(m, m, 0, m, m, star ? m * 0.45 : m);
  g.addColorStop(0, cssColor(star ? 0xffffff : core ?? color, 1));
  g.addColorStop(star ? 0.4 : 0.25, cssColor(color, star ? 0.8 : 0.75));
  g.addColorStop(1, cssColor(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  DOTS.set(key, c);
  return c;
}
// A wisp: soft dots along its curve, painted once.
function paintWisp(item, dev, make) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < item.pts.length; i += 3) { const r = item.pts[i + 2]; x0 = Math.min(x0, item.pts[i] - r); y0 = Math.min(y0, item.pts[i + 1] - r); x1 = Math.max(x1, item.pts[i] + r); y1 = Math.max(y1, item.pts[i + 1] + r); }
  const cw = Math.max(1, Math.ceil((x1 - x0) * dev)), ch = Math.max(1, Math.ceil((y1 - y0) * dev)), image = make(cw, ch), ctx = image?.getContext?.('2d');
  if (!ctx) return null;
  ctx.setTransform(dev, 0, 0, dev, -x0 * dev, -y0 * dev);
  const d = dot(make, 0xe4ecff);
  for (let i = 0; i < item.pts.length; i += 3) {
    const x = item.pts[i], y = item.pts[i + 1], r = item.pts[i + 2];
    ctx.globalAlpha = 0.28;
    if (d) ctx.drawImage(d, x - r, y - r, r * 2, r * 2);
  }
  return { image, x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

// Live vignette: a colour closing in from the edges (an ellipse-ish radial gradient over the area).
function vignette(ctx, W, H, v, alpha) {
  if (alpha <= 0.003) return;
  const cx = W / 2, cy = H / 2, far = Math.hypot(cx, cy), g = ctx.createRadialGradient(cx, cy, far * v.inner, cx, cy, far);
  g.addColorStop(0, cssColor(v.color, 0));
  g.addColorStop(0.55, cssColor(v.color, alpha * 0.55));
  g.addColorStop(1, cssColor(v.color, alpha));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}
// The part of a layer shown so far: from the edges inward (an ellipse shrinking off the corners) or out from a point.
function reveal(ctx, r, age, W, H) {
  if (!r) return;
  const p = smooth(age / (r.ms || 1));
  if (p >= 1) return;
  ctx.beginPath();
  if (r.mode === 'edges') {
    const k = 1 - p;
    ctx.rect(-W, -H, W * 3, H * 3);
    ctx.ellipse(W / 2, H / 2, Math.max(0.01, W * 0.71 * k), Math.max(0.01, H * 0.71 * k), 0, 0, TAU);
    ctx.clip('evenodd');
  } else {
    ctx.arc(r.x, r.y, Math.max(0.01, r.r * p), 0, TAU);
    ctx.clip();
  }
}

const SPRITES = new WeakMap();
// The plan's sprites (one per layer with shapes, and its wisps), painted on first use; `paint()` may refuse
// (over this frame's budget), and the rest are painted in later frames.
function spritesOf(plan, dev, make, paint, W, H) {
  let s = SPRITES.get(plan);
  if (!s || s.dev !== dev) {
    if (s) releaseSprites(s);
    s = { dev, layers: plan.layers.map(() => undefined), wisps: new Map() };
    SPRITES.set(plan, s);
  }
  plan.layers.forEach((l, i) => { if (s.layers[i] === undefined && (!l.shapes || paint())) s.layers[i] = l.shapes ? paintLayer(l, { w: W, h: H, dev, make }) : null; });
  return s;
}
const freeImage = (img) => { try { if (img?.close) img.close(); else if (img) { img.width = 0; img.height = 0; } } catch { /* gone */ } };
function releaseSprites(s) {
  for (const l of s.layers) freeImage(l?.image);
  for (const w of s.wisps.values()) freeImage(w?.image);
  s.layers = []; s.wisps.clear();
}
// Frees a plan's sprites (it ended, or the lens was cleared).
export function releaseEffect(plan) {
  const s = SPRITES.get(plan);
  if (s) { releaseSprites(s); SPRITES.delete(plan); }
}
// Whether every sprite of the plan is painted at this scale (else drawing it next would paint some).
export function effectPainted(plan, dev = 1) {
  const s = SPRITES.get(plan);
  return Boolean(s && s.dev === dev && plan.layers.every((l, i) => !l.shapes || s.layers[i] !== undefined));
}

const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
function stroke(ctx, pts, w, color, alpha) {
  ctx.strokeStyle = cssColor(color, alpha);
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.stroke();
}

// The live items: drawn fresh each frame, a few dozen at most.
const LIVE = {
  flash(g, age, { glint, W, H }) {
    const a = age < g.in ? age / g.in : 1 - (age - g.in) / g.out;
    if (a <= 0) return;
    glint.fillStyle = cssColor(g.color, g.alpha * clamp01(a));
    glint.fillRect(0, 0, W, H);
  },
  embers(g, age, { glint, make }) {
    const d = dot(make, 0xff7a1a, false, 0xfff0b0);
    if (!d) return;
    for (const e of g.items) {
      const t = age - e.delay;
      if (t < 0 || t > e.life) continue;
      const u = t / e.life, s = t / 1000;
      const a = (u < 0.15 ? u / 0.15 : 1 - smooth((u - 0.15) / 0.85)) * (0.7 + 0.3 * Math.sin(t / 45 + e.flick));
      const x = e.x + e.vx * s + Math.sin(t / 170 + e.flick) * 6, y = e.y + e.vy * s, r = e.r * 4.2;
      glint.globalAlpha = clamp01(a);
      glint.drawImage(d, x - r, y - r, r * 2, r * 2);
    }
    glint.globalAlpha = 1;
  },
  drips(g, age, { glint }) {
    for (const d of g.items) {
      const t = age - d.delay;
      if (t < 0 || t > d.life) continue;
      const u = t / d.life, len = d.len * smooth(Math.min(1, u * 1.5)), a = 0.6 * (u < 0.6 ? 1 : 1 - (u - 0.6) / 0.4);
      glint.strokeStyle = cssColor(0xe2f0ff, a * 0.7);
      glint.lineWidth = d.w;
      glint.beginPath(); glint.moveTo(d.x, d.y); glint.lineTo(d.x, d.y + len); glint.stroke();
      glint.fillStyle = cssColor(0xf4faff, a);
      glint.beginPath(); glint.arc(d.x, d.y + len, d.w * 0.95, 0, TAU); glint.fill();
    }
  },
  arcs(g, age, { glint }) {
    for (const arc of g.items) {
      const t = age - arc.delay;
      if (t < 0 || t > arc.life) continue;
      const fade = 1 - smooth((t - arc.life * 0.55) / (arc.life * 0.45));
      const a = arc.flicker ? fade * (0.45 + 0.55 * hash(Math.floor(t / 32) + arc.delay)) : fade;
      const v = arc.variants[arc.flicker ? Math.floor(t / 48) % arc.variants.length : 0];
      for (const [pts, w] of [[v.main, arc.w], ...v.branches.map((b) => [b, arc.w * 0.6])]) {
        stroke(glint, pts, w * 7, 0x6aaeff, a * 0.18);
        stroke(glint, pts, w * 3, 0xa8d4ff, a * 0.5);
        stroke(glint, pts, w, 0xffffff, a);
      }
    }
  },
  bubbles(g, age, { glint }) {
    glint.lineWidth = 1;
    for (const b of g.items) {
      const t = age - b.delay;
      if (t < 0 || t > b.life) continue;
      const u = t / b.life, pop = u > 0.85;
      glint.strokeStyle = cssColor(0xf0ffc8, (pop ? (1 - u) / 0.15 : 1) * 0.75);
      glint.beginPath(); glint.arc(b.x, b.y, b.r * (0.5 + 0.5 * u) * (pop ? 1.3 : 1), 0, TAU); glint.stroke();
    }
  },
  rings(g, age, { glint, mark }) {
    for (const r of g.items) {
      const t = age - r.delay;
      if (t < 0 || t > r.life) continue;
      const u = t / r.life, rad = r.r1 * (1 - (1 - u) ** 3), a = (1 - u) ** 1.5, w = r.w * (2.6 - u);
      if (rad < w * 2) continue;
      // A refracting band: bright on its outer edge (glint), a shadow just inside it (mark), stroked with gradients
      // so only the band itself is filled.
      const g = glint.createRadialGradient(r.x, r.y, Math.max(0, rad - w), r.x, r.y, rad + w);
      g.addColorStop(0, cssColor(0xffffff, 0)); g.addColorStop(0.65, cssColor(0xf4f8ff, 0.42 * a)); g.addColorStop(0.8, cssColor(0xffffff, 0.55 * a)); g.addColorStop(1, cssColor(0xffffff, 0));
      glint.strokeStyle = g; glint.lineWidth = w * 2;
      glint.beginPath(); glint.arc(r.x, r.y, rad, 0, TAU); glint.stroke();
      const d = mark.createRadialGradient(r.x, r.y, Math.max(0, rad - w * 2.5), r.x, r.y, Math.max(0.1, rad - w * 0.2));
      d.addColorStop(0, cssColor(0x5a6478, 0)); d.addColorStop(0.7, cssColor(0x5a6478, 0.4 * a)); d.addColorStop(1, cssColor(0x5a6478, 0));
      mark.strokeStyle = d; mark.lineWidth = w * 2.3;
      mark.beginPath(); mark.arc(r.x, r.y, Math.max(0, rad - w * 1.35), 0, TAU); mark.stroke();
    }
  },
  wisps(g, age, { glint, dev, make, sprites }) {
    const env = envelope(age, g.time);
    if (env <= 0) return;
    g.items.forEach((w, i) => {
      let sp = sprites.wisps.get(i);
      if (sp === undefined) { sp = paintWisp(w, dev, make); sprites.wisps.set(i, sp); }
      if (!sp) return;
      const u = smooth((age - w.delay) / Math.max(1, sprites.span ?? 1500));
      glint.globalAlpha = clamp01(env * w.alpha * 2.2 * smooth((age - w.delay) / 250));
      glint.drawImage(sp.image, w.x + w.dx * u + sp.x, w.y + w.dy * u + sp.y, sp.w, sp.h);
    });
    glint.globalAlpha = 1;
  },
  sparkles(g, age, { glint, make }) {
    const env = envelope(age, g.time), d = dot(make, 0xc9a2ff, true);
    if (env <= 0 || !d) return;
    const grow = 1 + g.grow * smooth(age / 1200);
    for (const s of g.items) {
      const t = age - s.delay;
      if (t < 0) continue;
      const a = env * smooth(t / 180) * (g.still ? 0.85 : 0.45 + 0.55 * Math.abs(Math.sin(t / 110 + s.twinkle)));
      const rad = g.R * s.d * grow, x = g.x + Math.cos(s.a + age / 4000) * rad, y = g.y + Math.sin(s.a + age / 4000) * rad, r = s.r * 1.6;
      glint.globalAlpha = clamp01(a);
      glint.drawImage(d, x - r, y - r, r * 2, r * 2);
    }
    glint.globalAlpha = 1;
  },
};

/**
 * Draws one plan at `age` ms on the two contexts (glint: normal blending over mark; the same one when there is no
 * second). W, H: the drawing area. dev: device pixels per area pixel. paint(): whether another sprite may be painted
 * this frame (default always). Its sprites are cached with the plan (releaseEffect frees them).
 */
export function drawEffect(mark, glint, plan, age, { W, H, dev = 1, make = defaultCanvas, paint = () => true } = {}) {
  glint ??= mark;
  const sprites = spritesOf(plan, dev, make, paint, W, H);
  sprites.span = plan.time ? plan.time.in + plan.time.hold + plan.time.out : 1500;
  plan.layers.forEach((l, i) => {
    let a = envelope(age, l.time ?? plan.time);
    if (l.pulse) a *= 1 - l.pulse.depth * 0.5 * (1 - Math.cos(age / l.pulse.period * TAU));
    if (a <= 0.003) return;
    const ctx = l.canvas === 'glint' ? glint : mark;
    if (l.vignette) { vignette(ctx, W, H, l.vignette, l.vignette.alpha * a); return; }
    const sp = sprites.layers[i];
    if (!sp) return;
    ctx.save();
    try {
      reveal(ctx, l.reveal, age - (l.time?.delay ?? 0), W, H);
      ctx.globalAlpha = clamp01(a);
      ctx.drawImage(sp.image, sp.x, sp.y, sp.w, sp.h);
    } finally { ctx.restore(); }
  });
  for (const g of plan.live) LIVE[g.kind]?.(g, age, { mark, glint, W, H, dev, make, sprites });
}

// The board's combined look from the plans alive at `now` (each born at bornAt): boardStyle's { filter, transform, split }.
export function boardLook(plans, now) {
  return boardStyle(mergeBoard(plans.filter((p) => p.board).map((p) => boardAt(p, now - p.bornAt))));
}

/**
 * The default board host: applies a look's inline filter and transform to #board (the double vision through an SVG
 * filter it adds once) and puts back what was there before when given null or a neutral look, and when #board is
 * replaced. apply(look | null).
 */
export function boardHost(doc = globalThis.document) {
  let el = null, saved = null, applied = null, offsets = null, lastSplit = null;
  const restore = () => {
    if (el && saved) { el.style.filter = saved.filter; el.style.transform = saved.transform; el.style.transformOrigin = saved.origin; }
    el = null; saved = null; applied = null;
  };
  // Two tinted ghosts of the board, offset either way and laid over it at low alpha: a chromatic double image.
  const splitFilter = (px) => {
    if (!offsets) {
      const NS = 'http://www.w3.org/2000/svg', svg = doc.createElementNS?.(NS, 'svg');
      if (!svg) return;
      svg.setAttribute('id', 'animater-lens-split-defs');
      svg.setAttribute('width', '0'); svg.setAttribute('height', '0');
      svg.setAttribute('style', 'position:absolute;width:0;height:0;pointer-events:none');
      svg.innerHTML = `<filter id="animater-lens-split" x="-2%" y="-2%" width="104%" height="104%" color-interpolation-filters="sRGB">
        <feOffset in="SourceGraphic" dx="0" dy="0" result="a"/><feColorMatrix in="a" type="matrix" values="1 0 0 0 0  0 0.72 0 0 0  0 0 0.8 0 0  0 0 0 0.45 0" result="ga"/>
        <feOffset in="SourceGraphic" dx="0" dy="0" result="b"/><feColorMatrix in="b" type="matrix" values="0.75 0 0 0 0  0 0.92 0 0 0  0 0 1 0 0  0 0 0 0.38 0" result="gb"/>
        <feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="ga"/><feMergeNode in="gb"/></feMerge></filter>`;
      doc.body?.append?.(svg);
      offsets = [...(svg.querySelectorAll?.('feOffset') ?? [])];
    }
    if (px === lastSplit) return;
    lastSplit = px;
    offsets[0]?.setAttribute('dx', String(px)); offsets[0]?.setAttribute('dy', String(Math.round(px * 0.3 * 10) / 10));
    offsets[1]?.setAttribute('dx', String(-px)); offsets[1]?.setAttribute('dy', String(-Math.round(px * 0.2 * 10) / 10));
  };
  return (look) => {
    if (!look || (!look.filter && !look.transform)) { restore(); return; }
    const board = doc?.getElementById?.('board');
    if (!board?.style) return;
    if (board !== el) { restore(); el = board; saved = { filter: board.style.filter ?? '', transform: board.style.transform ?? '', origin: board.style.transformOrigin ?? '' }; }
    if (look.split) splitFilter(look.split);
    const key = `${look.filter}|${look.transform}`;
    if (key === applied) return;
    applied = key;
    el.style.filter = [saved.filter, look.filter].filter(Boolean).join(' ');
    el.style.transform = [saved.transform, look.transform].filter(Boolean).join(' ');
    el.style.transformOrigin = '50% 50%';
  };
}
