// Draws lens blood (lens-blood.mjs) on a 2D canvas laid right over Foundry's board, under its interface, the same
// place as the kill-cam's vignette. It renders only while splats or tunnel pulses live: the frame loop stops when
// the lens is clean. The faint lingering tunnel (low HP) is a static CSS gradient on the same element, no frames.
//
// Each splat is painted once into cached sprites (lens-blood-paint.mjs): a wet look with a separate glint layer and
// a dried one. The overlay has them painted in a worker (lens-blood-paint-worker.mjs), so a big splash never stalls
// the game, and draws a splat once its bitmaps arrive; with no worker it paints them here, a few a frame. Every frame
// then only draws those bitmaps (scaled, rotated, faded; the dried one tinted over the wet one) and the drips, which
// run down live.

import { admitSplash, liveSplats, splatState, tunnelState, cssColor } from './lens-blood.mjs';
import { tones, lookOf, outline, paint, splatData } from './lens-blood-paint.mjs';
import { lensEffectsFor, LENS_EFFECTS } from './lens-effects.mjs';
import { drawEffect, releaseEffect, boardHost } from './lens-effects-draw.mjs';
import { boardAt, mergeBoard, boardStyle } from './lens-effects.mjs';
import { NO_WOUND, woundGradient, woundBoard, mixWound, stainAlpha, stainMoving, stainState } from './lens-wounds.mjs';

const TAU = Math.PI * 2;
const lerp = (a, b, t) => a + (b - a) * t;

function defaultCanvas(w, h) {
  if (typeof OffscreenCanvas === 'function') return new OffscreenCanvas(w, h);
  const doc = globalThis.document;
  if (!doc?.createElement) return null;
  const c = doc.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

const SPRITES = new WeakMap();
// The splat's cached sprites at this device scale, the dried one only once asked for (null: no canvas here).
function sprites(splat, dev, make, wantDry) {
  let s = SPRITES.get(splat);
  if (s === null) return null;
  if (!s || s.dev !== dev) {
    const wet = paint(splat, dev, make, false);
    if (!wet) { SPRITES.set(splat, null); return null; }
    s = { dev, wet, dry: null };
    SPRITES.set(splat, s);
  }
  if (wantDry && !s.dry) s.dry = paint(splat, dev, make, true);
  return s;
}

// Whether drawing a splat at this state would first paint a sprite (its wet one, or its dried one once it dries).
export function needsPaint(splat, st) {
  const s = SPRITES.get(splat);
  if (s === null) return false;
  return !s || (st.dry > 0.01 && !s.dry);
}

// The device pixels per CSS pixel the context draws at.
function deviceScale(ctx) {
  try {
    const m = ctx.getTransform?.();
    if (m && Number.isFinite(m.a)) return Math.min(2, Math.max(1, Math.round(Math.hypot(m.a, m.b) * 4) / 4));
  } catch { /* no transform */ }
  return 1;
}

// Where each drip leaves the splat (relative to r, below its middle): just inside the bottom edge of its outline
// at the drip's x, so the rivulet does not show through the body. Cached with the splat.
const DRIP_TOPS = new WeakMap();
function dripTop(splat, i) {
  let tops = DRIP_TOPS.get(splat);
  if (!tops) {
    const rot = splat.rotation ?? 0, cos = Math.cos(rot), sin = Math.sin(rot);
    const pts = (splat.path ?? (splat.body ?? []).map((p) => [Math.cos(p.a) * p.r, Math.sin(p.a) * p.r]))
      .map(([x, y]) => [x * cos - y * sin, x * sin + y * cos]);
    tops = splat.drips.map((d) => {
      let best = 0;
      for (const [x, y] of pts) if (Math.abs(x - d.dx) < 0.25 && y > best) best = y;
      // Only just tucked under: the blood is multiplied, so a rivulet under the body would show through it.
      return Math.max(0, best - 0.1);
    });
    DRIP_TOPS.set(splat, tops);
  }
  return tops[i] ?? 0;
}

// Drips run straight down the lens from under the splat: a narrowing rivulet ending in a round bead a little wider
// than it (a teardrop, no flared cap). Their glint goes on the shine layer (`shine`, the same context when none).
function drips(ctx, splat, st, c, r, shine = ctx) {
  for (let i = 0; i < splat.drips.length; i++) {
    const d = splat.drips[i], len = st.drips[i] ?? 0;
    if (len <= 1) continue;
    const x = splat.x + d.dx * r, w = Math.max(2.2, d.w * r * 1.4), top = splat.y + dripTop(splat, i) * r;
    // The rivulet's half width at its end, and the bead's radius: a touch wider, growing a little as it runs.
    const neck = w * 0.3, bead = Math.min(len * 0.4, neck * (1.3 + Math.min(0.25, len / 500)));
    const cy = top + len - bead, wob = (i + 1) * 1.7 + (splat.grain ?? 0) % 7;
    const at = (t) => x + Math.sin(t * 4 + wob) * w * 0.12 * t;
    // Down the left side to the neck above the bead, round the bead, back up the right side.
    const run = Math.max(0, cy - bead * 0.9 - top), n = 8, bx = at(1);
    ctx.beginPath();
    for (let k = 0; k <= n; k++) { const t = k / n, hw = w * lerp(0.42, 0.3, t); ctx[k ? 'lineTo' : 'moveTo'](at(t) - hw, top + t * run); }
    ctx.quadraticCurveTo(bx - neck, cy - bead * 0.35, bx - bead, cy);
    ctx.arc(bx, cy, bead, Math.PI, 0, true);
    ctx.quadraticCurveTo(bx + neck, cy - bead * 0.35, bx + neck, top + run);
    for (let k = n; k >= 0; k--) { const t = k / n, hw = w * lerp(0.42, 0.3, t); ctx.lineTo(at(t) + hw, top + t * run); }
    // A rounded top, tucked under the splat.
    ctx.quadraticCurveTo(at(0), top - w, at(0) - w * 0.42, top);
    ctx.closePath();
    const g = ctx.createLinearGradient(x - w, 0, x + w, 0);
    g.addColorStop(0, cssColor(c.rim, 0.85));
    g.addColorStop(0.35, cssColor(c.thin, 0.7));
    g.addColorStop(0.6, cssColor(c.body, 0.82));
    g.addColorStop(1, cssColor(c.rim, 0.9));
    ctx.fillStyle = g;
    ctx.fill();
    if (st.highlight > 0.05) {
      const op = shine.globalCompositeOperation;
      shine.globalCompositeOperation = 'source-over';
      shine.fillStyle = `rgba(255,236,232,${0.6 * st.highlight})`;
      shine.beginPath();
      shine.ellipse(bx - bead * 0.38, cy - bead * 0.4, Math.max(0.6, bead * 0.26), Math.max(0.5, bead * 0.18), -0.5, 0, TAU);
      shine.fill();
      shine.globalCompositeOperation = op;
    }
  }
}

// No canvas to paint sprites in (a headless test): a flat soft-coloured fill of the outline and its glint.
function drawFlat(ctx, splat, st, c, r, shine = ctx) {
  ctx.translate(splat.x, splat.y);
  ctx.rotate(splat.rotation ?? 0);
  const look = lookOf(splat);
  ctx.fillStyle = cssColor(c.body, (look.thin + look.thick) / 2);
  ctx.beginPath();
  outline(ctx, splat, r);
  ctx.fill();
  if (st.highlight > 0.02 && splat.highlight) {
    const h = splat.highlight;
    shine.save();
    if (shine !== ctx) { shine.translate(splat.x, splat.y); shine.rotate(splat.rotation ?? 0); }
    shine.globalCompositeOperation = 'source-over';
    shine.fillStyle = `rgba(255,236,232,${0.5 * st.highlight})`;
    shine.beginPath();
    shine.ellipse(h.dx * r, h.dy * r, h.r * r, h.r * r * 0.6, -0.6, 0, TAU);
    shine.fill();
    shine.restore();
  }
}

// Draws a splat from its sprites ({ wet, dry }; dry may still be missing) or, with none, flat. The blood is
// multiplied over what is already on the lens (overlapping splats darken each other, like stacked layers of tinted
// liquid, and each one's thin edges still show through the other). Its shine goes on `shine`, a context drawn with
// normal blending over the multiplied one (multiply can only darken, so a glint there would vanish); without one,
// on the same context. Its reaction (react, lens-blood.mjs) moves, squashes and turns it, may draw a faint ghost of
// it, lays its light (aura) on the shine and draws its few live marks; acid's holes are cut in a copy of its sprite,
// redone only when they have grown a step. make(w, h): a canvas for that copy.
function drawPainted(ctx, splat, st, s, shine = ctx, make = defaultCanvas) {
  const r = splat.r * st.scale, c = tones(splat, st.dry), re = splat.react, live = !!re && !re.still, same = shine === ctx;
  ctx.save();
  const base = st.alpha;
  ctx.globalAlpha = base;
  ctx.globalCompositeOperation = 'multiply';
  if (!same) { shine.save(); shine.globalAlpha = base; }
  if (st.ox || st.oy) { ctx.translate(st.ox, st.oy); if (!same) shine.translate(st.ox, st.oy); }
  if (splat.drips?.length) drips(ctx, splat, st, c, r, shine);
  if (live && !same) screenMarks(shine, splat, st, r, base, make);
  if (!s?.wet) drawFlat(ctx, splat, st, c, r, shine);
  else {
    const turn = (splat.rotation ?? 0) + (st.spin || 0), sx = st.sx ?? 1, sy = st.sy ?? 1;
    ctx.translate(splat.x, splat.y);
    ctx.rotate(turn);
    const k = r / s.wet.unit, kx = k * sx, ky = k * sy;
    ctx.scale(kx, ky);
    if (st.ghost) {
      // A faint double of it, off to one side, wobbling back in.
      ctx.globalAlpha = base * st.ghost.alpha;
      ctx.drawImage(s.wet.image, -s.wet.ox + st.ghost.dx / k, -s.wet.oy + st.ghost.dy / k);
      ctx.globalAlpha = base;
    }
    const holed = live && re.holes?.length ? eaten(splat, s, st, make) : null;
    if (holed) ctx.drawImage(holed, -s.wet.ox, -s.wet.oy);
    else {
      ctx.drawImage(s.wet.image, -s.wet.ox, -s.wet.oy);
      if (st.dry > 0.01 && s.dry) {
        // Drying: the dried look laid over the wet one, inside it only.
        ctx.globalCompositeOperation = 'source-atop';
        ctx.globalAlpha = Math.min(1, st.dry);
        ctx.drawImage(s.dry.image, -s.dry.ox, -s.dry.oy);
        ctx.globalCompositeOperation = 'source-over';
      }
    }
    const glint = st.highlight > 0.02 && s.wet.glint, aura = st.aura > 0.01 && s.wet.aura;
    if (glint || aura || live) {
      if (!same) { shine.translate(splat.x, splat.y); shine.rotate(turn); shine.scale(kx, ky); }
      shine.globalCompositeOperation = 'source-over';
      if (glint) {
        shine.globalAlpha = base * Math.min(1, st.highlight);
        shine.drawImage(s.wet.glint, -s.wet.ox, -s.wet.oy);
      }
      if (aura) {
        shine.globalAlpha = base * Math.min(1, st.aura);
        shine.drawImage(s.wet.aura, -s.wet.ox, -s.wet.oy);
      }
      if (live) {
        // The live marks in its own frame, at r (not the sprite's scale).
        ctx.scale(1 / kx, 1 / ky);
        if (!same) shine.scale(1 / kx, 1 / ky);
        shine.globalAlpha = base;
        ctx.globalCompositeOperation = 'multiply';
        splatMarks(ctx, shine, splat, st, r, c);
      }
    }
  }
  if (!same) shine.restore();
  ctx.restore();
}

// A flat [x, y, ...] polyline at `unit` px, offset by (x, y).
function polyline(g, pts, unit, x = 0, y = 0) {
  g.moveTo(x + pts[0] * unit, y + pts[1] * unit);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(x + pts[i] * unit, y + pts[i + 1] * unit);
}
// An electric spark: a blue glow round a white-hot core.
function spark(g, pts, unit, w, x = 0, y = 0) {
  g.beginPath();
  polyline(g, pts, unit, x, y);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.strokeStyle = 'rgba(110,165,255,0.45)';
  g.lineWidth = w * 3.2;
  g.stroke();
  g.strokeStyle = 'rgba(238,246,255,0.95)';
  g.lineWidth = w;
  g.stroke();
}
// On and off in quick flickers (a spark is not a steady line).
const flicker = (t, seed) => Math.floor(t / 23 + seed) % 3 !== 1;

// A reaction's live marks in the splat's own frame (r: its radius now): bubbles fizzing and popping (fire, acid),
// sparks off its edge (electricity), twinkling glints (cold, vitality). A few small paths each, while they last.
function splatMarks(ctx, shine, splat, st, r, c) {
  const re = splat.react, t = st.t;
  if (re.bubbles?.length && t < 1800) {
    const hi = re.type === 'acid' ? '226,246,140' : '255,234,206';
    for (const b of re.bubbles) {
      if (b.t0 > t) break;
      const u = (t - b.t0) / b.ms;
      if (u >= 1) continue;
      // Small whatever the splat's size (a bubble is a bubble), a little bigger on a big splat.
      const x = b.dx * r, y = b.dy * r, br = Math.min(6, Math.max(1.4, b.r * r * 0.45));
      if (u < 0.75) {
        // Swelling: a dark ring, its thin bright skin and a bright point on it.
        const rr = br * (0.4 + 0.6 * (u / 0.75));
        ctx.strokeStyle = cssColor(c.core, 0.85);
        ctx.lineWidth = Math.max(0.8, rr * 0.5);
        ctx.beginPath();
        ctx.arc(x, y, rr, 0, TAU);
        ctx.stroke();
        shine.strokeStyle = `rgba(${hi},0.45)`;
        shine.lineWidth = 0.7;
        shine.beginPath();
        shine.arc(x, y, rr, 0, TAU);
        shine.stroke();
        shine.fillStyle = `rgba(${hi},0.9)`;
        shine.beginPath();
        shine.arc(x - rr * 0.35, y - rr * 0.35, Math.max(0.6, rr * 0.38), 0, TAU);
        shine.fill();
      } else {
        // Popped: a thin bright ring flung out and gone.
        const q = (u - 0.75) / 0.25;
        shine.strokeStyle = `rgba(${hi},${Math.round(0.7 * (1 - q) * 100) / 100})`;
        shine.lineWidth = 0.7;
        shine.beginPath();
        shine.arc(x, y, br * (1 + q * 0.7), 0, TAU);
        shine.stroke();
      }
    }
  }
  for (const sp of re.sparks ?? []) if (t >= sp.t0 && t < sp.t0 + sp.ms && flicker(t, sp.t0)) spark(shine, sp.pts, r, 1);
  if (re.sparkles?.length) {
    const rgb = re.type === 'vitality' ? '255,226,140' : '236,248,255';
    shine.lineCap = 'round';
    for (const g of re.sparkles) {
      if (t < g.t0 || t > g.t1) continue;
      const tw = Math.sin((t / 1000) * g.hz * TAU + g.ph);
      if (tw < 0.25) continue;
      const a = Math.pow((tw - 0.25) / 0.75, 2), x = g.dx * r, y = g.dy * r, z = Math.max(2, g.s * r) * (0.6 + 0.4 * a);
      shine.strokeStyle = `rgba(${rgb},${Math.round(a * 95) / 100})`;
      shine.lineWidth = 1;
      shine.beginPath();
      shine.moveTo(x - z, y); shine.lineTo(x + z, y);
      shine.moveTo(x, y - z); shine.lineTo(x, y + z);
      shine.stroke();
    }
  }
}

// A reaction's live marks in screen axes (they do not turn with the splat): wisps of steam rising off cooked blood,
// sparks jumping to a neighbouring splat.
function screenMarks(shine, splat, st, r, base, make) {
  const re = splat.react;
  if (re.wisps?.length) {
    const img = wisp(make);
    if (img) {
      for (const w of re.wisps) {
        const u = (st.t - w.t0) / w.ms;
        if (u <= 0 || u >= 1) continue;
        const h = Math.max(30, r * 1.3) * w.h, wd = Math.max(22, r * 0.75) * (0.75 + 0.6 * u), ht = h * (0.45 + 0.55 * u);
        const x = splat.x + w.x * r + Math.sin(u * 3.2 + w.sway * 4) * w.sway * wd, y = splat.y + w.y * r - h * 0.55 * u;
        shine.globalAlpha = base * 0.75 * Math.pow(Math.sin(Math.PI * u), 1.2);
        shine.drawImage(img, x - wd / 2, y - ht, wd, ht);
      }
      shine.globalAlpha = base;
    }
  }
  for (const a of re.arcs ?? []) if (st.age >= a.t0 && st.age < a.t0 + a.ms && flicker(st.age, a.t0)) spark(shine, a.pts, 1, a.w ?? 1, splat.x, splat.y);
}

// A soft rising wisp of steam, painted once and shared by every splat (null: no canvas here).
let WISP;
function wisp(make) {
  if (WISP !== undefined) return WISP;
  const c = make?.(64, 128), g = c?.getContext?.('2d');
  if (!g) { WISP = null; return null; }
  for (let i = 0; i < 16; i++) {
    const t = i / 15, x = 32 + Math.sin(t * 6.5) * 13 * t, y = 118 - t * 100, rr = 6 + t * 14;
    const gr = g.createRadialGradient(x, y, 0, x, y, rr);
    gr.addColorStop(0, `rgba(232,228,222,${0.42 * (1 - t * 0.7)})`);
    gr.addColorStop(1, 'rgba(226,222,216,0)');
    g.fillStyle = gr;
    g.fillRect(x - rr, y - rr, rr * 2, rr * 2);
  }
  WISP = c;
  return c;
}

// Acid's holes: the splat's sprite (its drying laid in) copied with ragged holes cut in it, each with a corroded rim,
// grown a step at a time (redone only when one of them, or the drying, moves on a step). null: no holes yet, or no
// canvas for the copy.
const EATEN = new WeakMap();
function eaten(splat, s, st, make) {
  const holes = splat.react.holes, wet = s.wet;
  const grown = holes.map((h) => { const u = Math.min(1, Math.max(0, (st.t - h.t0) / h.ms)); return Math.round((1 - (1 - u) * (1 - u)) * 12) / 12; });
  if (grown.every((g) => g === 0)) return null;
  let e = EATEN.get(splat);
  if (e === null) return null;
  if (!e || e.wet !== wet) {
    const c = make?.(wet.image.width, wet.image.height), g = c?.getContext?.('2d');
    if (!g) { EATEN.set(splat, null); return null; }
    e = { wet, c, g, key: null };
    EATEN.set(splat, e);
  }
  const dry = st.dry > 0.01 && s.dry ? Math.round(Math.min(1, st.dry) * 24) / 24 : 0, key = `${grown.join()}:${dry}`;
  if (e.key === key) return e.c;
  e.key = key;
  const { g, c } = e, u = wet.unit;
  g.globalCompositeOperation = 'source-over';
  g.globalAlpha = 1;
  g.clearRect(0, 0, c.width, c.height);
  g.drawImage(wet.image, 0, 0);
  if (dry > 0) {
    g.globalCompositeOperation = 'source-atop';
    g.globalAlpha = dry;
    g.drawImage(s.dry.image, wet.ox - s.dry.ox, wet.oy - s.dry.oy);
    g.globalAlpha = 1;
  }
  holes.forEach((h, i) => {
    const f = grown[i];
    if (f <= 0) return;
    const cx = wet.ox + h.dx * u, cy = wet.oy + h.dy * u, hr = Math.max(1, h.r * u * f);
    // The corroded rim first (on the blood only), then the hole: a few overlapping lobes, soft at the edge.
    g.globalCompositeOperation = 'source-atop';
    g.strokeStyle = 'rgba(70,62,14,0.55)';
    g.lineWidth = Math.max(1, hr * 0.5);
    g.beginPath();
    for (const [lx, ly, lr] of h.lobes) { const x = cx + lx * hr, y = cy + ly * hr; g.moveTo(x + lr * hr * 1.15, y); g.arc(x, y, lr * hr * 1.15, 0, TAU); }
    g.stroke();
    g.globalCompositeOperation = 'destination-out';
    for (const [lx, ly, lr] of h.lobes) {
      const x = cx + lx * hr, y = cy + ly * hr, rr = lr * hr, gr = g.createRadialGradient(x, y, 0, x, y, rr);
      gr.addColorStop(0, 'rgba(0,0,0,1)');
      gr.addColorStop(0.7, 'rgba(0,0,0,0.95)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr;
      g.fillRect(x - rr, y - rr, rr * 2, rr * 2);
    }
  });
  g.globalCompositeOperation = 'source-over';
  return c;
}

/**
 * Draws one splat at its state (splatState). Its sprites are painted on first use and cached with the splat, right
 * here on this thread; opts.canvas(w, h) makes a canvas for them (OffscreenCanvas or a DOM canvas by default; none:
 * drawn flat). opts.shine: the context its glint goes on (normal blending, over ctx); ctx itself by default. The
 * overlay paints them in a worker instead when it can.
 */
export function drawSplat(ctx, splat, st, { canvas = defaultCanvas, shine = ctx } = {}) {
  if (st.alpha <= 0 || st.scale <= 0) return;
  drawPainted(ctx, splat, st, sprites(splat, deviceScale(ctx), canvas, st.dry > 0.01), shine ?? ctx, canvas);
}

// Tunnel vision: a dark, slightly red vignette closing in from the edges.
const tunnelGradient = (level) => {
  const l = Math.min(1, Math.max(0, level)), inner = Math.round(lerp(78, 30, l)), alpha = Math.round(0.92 * l * 1000) / 1000;
  return `radial-gradient(ellipse at center, transparent ${inner}%, rgba(28,0,0,${alpha * 0.7}) ${Math.round(inner + (100 - inner) * 0.5)}%, rgba(12,0,0,${alpha}) 100%)`;
};
export function drawTunnel(ctx, width, height, level) {
  if (level <= 0.005) return;
  const l = Math.min(1, level), cx = width / 2, cy = height / 2, far = Math.hypot(cx, cy);
  const g = ctx.createRadialGradient(cx, cy, far * lerp(0.78, 0.3, l), cx, cy, far);
  g.addColorStop(0, 'rgba(28,0,0,0)');
  g.addColorStop(0.5, `rgba(28,0,0,${0.64 * l})`);
  g.addColorStop(1, `rgba(12,0,0,${0.92 * l})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);
}

const closeSprite = (sp) => {
  try { sp?.image?.close?.(); } catch { /* gone */ }
  try { sp?.glint?.close?.(); } catch { /* gone */ }
  try { sp?.aura?.close?.(); } catch { /* gone */ }
};

// Paints splat sprites in a module worker (lens-blood-paint-worker.mjs): each splat's wet and dried looks are asked
// for when it first comes up and arrive as ImageBitmaps a few ms later; until then the splat is not drawn. Bitmaps
// are closed when their splat dies or the lens is cleared; replies for splats already gone are closed and dropped.
// onFail(): no worker (none here, it would not start, it has no OffscreenCanvas, or it failed): paint on this thread.
function workerPainter(win, onFail) {
  let worker = null, failed = typeof win?.Worker !== 'function', nextId = 1;
  const cache = new Map(), pending = new Map();
  const dropAll = () => {
    pending.clear();
    for (const e of cache.values()) { closeSprite(e.wet); closeSprite(e.dry); }
    cache.clear();
  };
  const fail = () => {
    failed = true;
    try { worker?.terminate?.(); } catch { /* gone */ }
    worker = null;
    dropAll();
    onFail();
  };
  const receive = (data) => {
    if (!data || data.type === 'ready') return;
    if (data.type === 'unsupported') { fail(); return; }
    const p = pending.get(data.id);
    pending.delete(data.id);
    if (!data.ok) { closeSprite(data); if (p) fail(); return; }
    const e = p ? cache.get(p.splat) : null;
    if (!e || e.dev !== p.dev || e[p.look]) { closeSprite(data); return; }
    e[p.look] = { image: data.image, glint: data.glint ?? null, aura: data.aura ?? null, ox: data.ox, oy: data.oy, unit: data.unit, dev: data.dev };
  };
  const start = () => {
    if (worker) return true;
    if (failed) { onFail(); return false; }
    try {
      worker = new win.Worker(new URL('./lens-blood-paint-worker.mjs', import.meta.url), { type: 'module' });
      worker.onmessage = (event) => receive(event.data);
      worker.onerror = () => fail();
      worker.onmessageerror = () => fail();
    } catch { worker = null; fail(); }
    return !!worker;
  };
  const ask = (splat, dev, look) => {
    if (!worker) return;
    const id = nextId++;
    pending.set(id, { splat, dev, look });
    try { worker.postMessage({ id, splat: splatData(splat), dev, dried: look === 'dry' }); } catch { fail(); }
  };
  const release = (splat) => {
    const e = cache.get(splat);
    if (e) { closeSprite(e.wet); closeSprite(e.dry); cache.delete(splat); }
  };
  return {
    // Keeps the sprites of the splats alive now at this device scale, asking for missing ones and closing the
    // others'. false: no worker (paint on this thread).
    sync(splats, dev) {
      if (!worker && !failed && !splats.length) return true;
      if (!start()) return false;
      const live = new Set(splats);
      for (const s of [...cache.keys()]) if (!live.has(s)) release(s);
      const fresh = [];
      for (const s of splats) {
        const e = cache.get(s);
        if (e && e.dev === dev) continue;
        if (e) release(s);
        cache.set(s, { dev, wet: null, dry: null });
        fresh.push(s);
      }
      // Wet looks first (they show now), then the dried ones ahead of time, so drying never waits.
      for (const s of fresh) ask(s, dev, 'wet');
      for (const s of fresh) ask(s, dev, 'dry');
      return !failed;
    },
    // A splat's sprites as they have arrived: { dev, wet, dry } (wet or dry null until then).
    get: (splat) => cache.get(splat),
    get pending() { return pending.size; },
    clear() {
      dropAll();
      try { worker?.postMessage({ type: 'clear' }); } catch { /* gone */ }
    },
  };
}

/**
 * The overlay on this screen: splash(splash, { seed, color }), effects(hit, { seed }) (damage-type effects,
 * lens-effects.mjs), linger(level), clear(); and the wounded view (lens-wounds.mjs): wound(look, { ms }) eases its
 * vignette and board look, stains(list) draws the lasting stains (frames only while one shows in or fades), pulse(k)
 * beats the red edges once, flash(peak, ms) a bright breath back to life; clearWounds() takes them all away. area(): where it may draw (the whole window, under Foundry's interface).
 * Splat sprites are painted in a worker when win.Worker is there and works; otherwise (or worker: false) on this
 * thread, about 8 ms of it a frame. board(look | null): applies the effects' short CSS look to the board and puts it
 * back (lens-effects-draw.mjs boardHost by default); null is always sent once they end or the lens is cleared.
 */
export function createLensBloodOverlay({ doc = globalThis.document, win = globalThis.window, now = () => performance.now(), area = () => lensArea(doc, win), worker = true, board = boardHost(doc) } = {}) {
  let el = null, ctx = null, glintEl = null, gctx = null, frame = null, state = { lastAt: -Infinity, splats: [], pulses: [] }, lingering = 0, at = { x: 0, y: 0, w: 1, h: 1 };
  // Damage-type effect plans alive (each with bornAt), and whether the board wears their look now.
  let fx = [], boardOn = false;
  const setBoard = (look) => {
    const on = Boolean(look && (look.filter || look.transform));
    if (!on && !boardOn) return;
    boardOn = on;
    try { board?.(on ? look : null); } catch { /* the board is gone */ }
  };
  // The wounded view: its look now and the ease it is in ({ from, to, start, ms }), its layers (the vignette, the
  // heartbeat's pulse, the waking flash: CSS gradients, no frames) and the lasting stains' canvas.
  let woundCur = { ...NO_WOUND }, woundEase = null, woundFrame = null, woundBg = '', woundEl = null, pulseEl = null, flashEl = null;
  let stainEl = null, sctx = null, stainList = [], stainFrame = null;
  // The board wears the effects' look and the wound's together (blur the larger, colour and brightness multiplied).
  const applyBoard = (t = now()) => {
    const looks = fx.filter((p) => p.board).map((p) => boardAt(p, t - p.bornAt)), wb = woundBoard(woundCur);
    if (wb) looks.push(wb);
    setBoard(looks.length ? boardStyle(mergeBoard(looks)) : null);
  };
  const dropEffects = () => { for (const p of fx) releaseEffect(p); fx = []; applyBoard(); };
  // Canvases for the effects' sprites: offscreen where there are any, else this page's.
  const makeCanvas = (w, h) => {
    if (typeof OffscreenCanvas === 'function') return new OffscreenCanvas(w, h);
    const c = doc?.createElement?.('canvas');
    if (c) { c.width = w; c.height = h; }
    return c ?? null;
  };
  let painter = null, offThread = worker !== false;
  const sprites = () => (offThread ? (painter ??= workerPainter(win, () => { offThread = false; })) : null);
  const node = () => {
    if (el?.isConnected && glintEl?.isConnected) return el;
    if (el?.isConnected) el.remove?.();
    if (glintEl?.isConnected) glintEl.remove?.();
    el = doc.createElement('canvas');
    el.id = 'animater-lens-blood';
    // Multiplied over the board like tinted liquid on glass: thick blood darkens and reddens what is behind it
    // instead of painting over it.
    el.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;pointer-events:none;mix-blend-mode:multiply;';
    // Right over the canvas, under Foundry's interface (as the kill-cam's vignette).
    const board = doc.getElementById('board');
    // The shine (wet glints) on a second canvas right above it, blended normally: multiply can only darken, so a
    // highlight drawn in the multiplied canvas would vanish. Same place and size, under the interface too.
    glintEl = doc.createElement('canvas');
    glintEl.id = 'animater-lens-blood-glint';
    glintEl.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;pointer-events:none;mix-blend-mode:normal;';
    if (board) { board.after(el); el.after(glintEl); } else doc.body.append(el, glintEl);
    ctx = el.getContext('2d');
    gctx = glintEl.getContext('2d');
    el.style.background = lingering > 0 ? tunnelGradient(lingering) : '';
    return el;
  };
  const size = () => {
    // Follows the window and the sidebar as they change.
    at = area();
    const dpr = Math.min(2, win.devicePixelRatio || 1), w = at.w, h = at.h;
    for (const c of [el, glintEl, stainEl, woundEl, pulseEl, flashEl]) {
      if (!c) continue;
      const css = c.style;
      if (css.left !== `${at.x}px` || css.top !== `${at.y}px` || css.width !== `${w}px` || css.height !== `${h}px`) Object.assign(css, { left: `${at.x}px`, top: `${at.y}px`, width: `${w}px`, height: `${h}px` });
      if (!c.isLayer && (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr))) {
        c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
        // Resizing wipes a canvas: the stains are drawn again.
        if (c === stainEl) kickStains();
      }
      // The right edge fades out (behind the sidebar's buttons) instead of ending in a hard line.
      const mask = at.fade > 0 ? `linear-gradient(to right, #000 calc(100% - ${at.fade}px), transparent)` : '';
      if (c.dataset && c.dataset.mask !== mask) { c.dataset.mask = mask; css.maskImage = mask; css.webkitMaskImage = mask; }
    }
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    gctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    sctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w, h };
  };
  // A wound layer: a full-area element laid over the lens canvases (still under Foundry's interface).
  const layer = (id, css) => {
    const d = doc.createElement('div');
    d.id = id;
    d.isLayer = true;
    d.style.cssText = `position:fixed;left:0;top:0;width:100%;height:100%;pointer-events:none;${css}`;
    const after = [flashEl, pulseEl, woundEl, stainEl, glintEl, el].find((x) => x?.isConnected) ?? doc.getElementById?.('board');
    if (after?.after) after.after(d); else doc.body.append(d);
    return d;
  };
  const woundNode = () => {
    if (!woundEl?.isConnected) { woundEl = layer('animater-lens-wound', 'mix-blend-mode:normal;'); woundBg = ''; }
    if (!pulseEl?.isConnected) pulseEl = layer('animater-lens-pulse', 'mix-blend-mode:normal;opacity:0;');
    size();
  };
  const woundApply = () => {
    const bg = woundGradient(woundCur);
    if (bg && !woundEl?.isConnected) woundNode();
    if (woundEl && bg !== woundBg) {
      woundBg = bg;
      woundEl.style.background = bg;
      // The pulse: the same red edges, deeper, shown only for a beat.
      if (pulseEl) pulseEl.style.background = woundCur.edge > 0.004 ? woundGradient({ edge: Math.min(1, woundCur.edge * 1.25 + 0.15) }) : '';
    }
    applyBoard();
  };
  const woundStep = () => {
    woundFrame = null;
    const e = woundEase;
    if (!e) return;
    const k = e.ms > 0 ? Math.min(1, (now() - e.start) / e.ms) : 1;
    woundCur = mixWound(e.from, e.to, k * k * (3 - 2 * k));
    woundApply();
    if (k < 1) woundFrame = win.requestAnimationFrame(woundStep);
    else woundEase = null;
  };
  const stainRender = () => {
    stainFrame = null;
    if (!stainEl?.isConnected || !sctx) return;
    const t = now(), { w, h } = size();
    sctx.clearRect(0, 0, w, h);
    // A stain's sprites are painted on first show (a small splat: a few ms), at most about 6 ms of it a frame.
    let moving = false, painted = false;
    const budget = performance.now() + 6;
    for (const s of stainList) {
      if (stainMoving(s, t)) moving = true;
      const a = stainAlpha(s, t);
      if (a <= 0.003) continue;
      const st = stainState(a);
      if (needsPaint(s.splat, st)) {
        if (painted && performance.now() > budget) { moving = true; continue; }
        painted = true;
      }
      drawSplat(sctx, s.splat, st, { canvas: makeCanvas });
    }
    if (moving) stainFrame = win.requestAnimationFrame(stainRender);
  };
  function kickStains() { if (stainFrame === null && stainEl) stainFrame = win.requestAnimationFrame(stainRender); }
  const dropWounds = () => {
    woundEase = null;
    woundCur = { ...NO_WOUND };
    if (woundFrame !== null) { try { win.cancelAnimationFrame(woundFrame); } catch { /* gone */ } woundFrame = null; }
    if (stainFrame !== null) { try { win.cancelAnimationFrame(stainFrame); } catch { /* gone */ } stainFrame = null; }
    woundBg = '';
    for (const d of [woundEl, pulseEl, flashEl]) if (d) { try { d.getAnimations?.().forEach((a) => a.cancel()); } catch { /* none */ } if (d !== flashEl) d.style.background = ''; }
    stainList = [];
    if (stainEl && sctx) { try { sctx.save?.(); sctx.setTransform?.(1, 0, 0, 1, 0, 0); sctx.clearRect(0, 0, stainEl.width, stainEl.height); sctx.restore?.(); } catch { /* no context */ } }
  };
  const render = () => {
    frame = null;
    if (!el?.isConnected || !ctx) { dropEffects(); return; }
    const t = now();
    state = liveSplats(state, t);
    const { w, h } = size();
    ctx.clearRect(0, 0, w, h);
    gctx?.clearRect(0, 0, w, h);
    const shine = gctx ?? ctx;
    let tunnel = 0;
    for (const p of state.pulses) tunnel = Math.max(tunnel, tunnelState(p, t - p.bornAt).level);
    drawTunnel(ctx, w, h, tunnel);
    const p = sprites();
    if (p?.sync(state.splats, deviceScale(ctx))) {
      // Painted in the worker: only sprites that have arrived are drawn (a fresh splat shows a frame or two late).
      for (const s of state.splats) {
        const e = p.get(s);
        if (!e?.wet) continue;
        const st = splatState(s, t - s.bornAt);
        if (st.alpha > 0 && st.scale > 0) drawPainted(ctx, s, st, e, shine);
      }
    } else {
      // Painted here: a sprite costs 6-20 ms, so at most about 8 ms of painting a frame, the rest wait a frame or two
      // (a big splash lands over a few frames instead of freezing the game for a fifth of a second).
      const budget = performance.now() + 8;
      let painted = false;
      for (const s of state.splats) {
        const st = splatState(s, t - s.bornAt);
        if (needsPaint(s, st)) {
          if (painted && performance.now() > budget) continue;
          painted = true;
        }
        drawSplat(ctx, s, st, { shine });
      }
    }
    if (fx.length) {
      // Damage-type effects over the blood: their marks multiplied in, their light on the glint canvas. A new plan's
      // sprites are painted as it first shows, at most about 6 ms of it a frame.
      const ended = fx.filter((p) => t - p.bornAt >= p.lifeMs);
      if (ended.length) { for (const p of ended) releaseEffect(p); fx = fx.filter((p) => !ended.includes(p)); }
      const dev = deviceScale(ctx), budget = performance.now() + 6;
      let painted = false;
      const paint = () => { if (painted && performance.now() > budget) return false; painted = true; return true; };
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      // An effect that fails to draw is dropped, never the lens with it.
      const broken = [];
      for (const p of fx) {
        try { drawEffect(ctx, gctx, p, t - p.bornAt, { W: w, H: h, dev, paint, make: makeCanvas }); } catch { broken.push(p); }
      }
      if (broken.length) { for (const p of broken) releaseEffect(p); fx = fx.filter((p) => !broken.includes(p)); }
      ctx.restore();
      applyBoard(t);
    }
    if (state.splats.length || state.pulses.length || fx.length) frame = win.requestAnimationFrame(render);
  };
  const kick = () => { if (frame === null) frame = win.requestAnimationFrame(render); };
  return {
    splash(splash, { seed, color, duration = 1 } = {}) {
      node();
      // Splats are laid out on the drawing area; a blow's window point is moved into it.
      at = area();
      const from = splash?.fromScreen, inside = from && Number.isFinite(from.x) ? { x: Math.min(at.w, Math.max(0, from.x - at.x)), y: Math.min(at.h, Math.max(0, from.y - at.y)) } : from;
      const r = admitSplash(state, from ? { ...splash, fromScreen: inside } : splash, { now: now(), seed, width: at.w, height: at.h, color, duration });
      if (r.state === state) return 0;
      state = r.state;
      kick();
      return r.added;
    },
    // A hit's damage-type effects (lens-effects.mjs lensEffectHit's answer): planned on the drawing area, the blow's
    // window point moved into it. The same type again within a moment is not doubled. Answers how many started.
    effects(hit, { seed, duration = 1 } = {}) {
      if (!hit?.types?.length) return 0;
      node();
      at = area();
      const p = hit.impact, inside = p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: Math.min(at.w, Math.max(0, p.x - at.x)), y: Math.min(at.h, Math.max(0, p.y - at.y)) } : null;
      const t = now();
      const plans = lensEffectsFor({ ...hit, view: { width: at.w, height: at.h }, impact: inside, seed: seed ?? `lens:${t}`, duration })
        .filter((plan) => !fx.some((q) => q.type === plan.type && t - q.bornAt < 350));
      if (!plans.length) return 0;
      fx = [...fx, ...plans.map((plan) => ({ ...plan, bornAt: t }))];
      while (fx.length > LENS_EFFECTS.maxAlive) releaseEffect(fx.shift());
      kick();
      return plans.length;
    },
    // The faint lasting tunnel while the player's creature is badly hurt (0 lifts it).
    linger(level) {
      const l = Math.max(0, Number(level) || 0);
      if (l === lingering) return;
      lingering = l;
      if (l > 0) { node(); size(); }
      if (el) el.style.background = l > 0 ? tunnelGradient(l) : '';
    },
    // Ends the damage-type effects only (their switch turned off), the board put back (the wound's own look kept).
    clearEffects() {
      for (const p of fx) releaseEffect(p);
      fx = [];
      boardOn = false;
      try { board?.(null); } catch { /* the board is gone */ }
      applyBoard();
    },
    // The wounded view's look (lens-wounds.mjs: edge, dark, window, blur, saturate, brightness), eased there over ms.
    wound(look, { ms = 600 } = {}) {
      const to = { ...NO_WOUND, ...(look ?? {}) }, aim = woundEase?.to ?? woundCur;
      if (Object.keys(NO_WOUND).every((k) => Math.abs((aim[k] ?? 0) - to[k]) < 0.002)) return false;
      if (!woundEl?.isConnected && woundGradient(to)) woundNode();
      woundEase = { from: { ...woundCur }, to, start: now(), ms: Math.max(0, Number(ms) || 0) };
      if (woundEase.ms === 0) { woundStep(); return true; }
      if (woundFrame === null) woundFrame = win.requestAnimationFrame(woundStep);
      return true;
    },
    get woundLook() { return { ...(woundEase?.to ?? woundCur) }; },
    // The lasting stains ([{ splat, bornAt, fadeAt }], lens-wounds.mjs), drawn dried and still on their own canvas.
    stains(list) {
      const next = Array.isArray(list) ? list : [];
      if (next === stainList) return;
      stainList = next;
      if (!stainList.length && !stainEl) return;
      if (!stainEl?.isConnected) {
        stainEl = doc.createElement('canvas');
        stainEl.id = 'animater-lens-stains';
        stainEl.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;pointer-events:none;mix-blend-mode:multiply;';
        const after = [glintEl, el].find((x) => x?.isConnected) ?? doc.getElementById?.('board');
        if (after?.after) after.after(stainEl); else doc.body.append(stainEl);
        sctx = stainEl.getContext('2d');
        size();
      }
      kickStains();
    },
    get stainCount() { return stainList.length; },
    // One beat of the red edges (k 0..1: how deep), in step with the lingering heartbeat. A compositor animation.
    pulse(k = 0.6, ms = 560) {
      if (!pulseEl?.isConnected || !(k > 0) || !(woundCur.edge > 0.004)) return false;
      try { pulseEl.animate?.([{ opacity: 0 }, { opacity: Math.min(1, k), offset: 0.16 }, { opacity: 0 }], { duration: ms, easing: 'ease-out' }); return true; } catch { return false; }
    },
    // A brief bright breath (waking up): a warm light over the view, gone in ms.
    flash(peak = 0.3, ms = 700) {
      if (!(peak > 0)) return false;
      if (!flashEl?.isConnected) { flashEl = layer('animater-lens-flash', 'mix-blend-mode:screen;opacity:0;background:radial-gradient(ellipse at center, rgba(255,246,232,0.95) 0%, rgba(255,236,214,0.7) 55%, rgba(255,226,200,0.45) 100%);'); size(); }
      try { flashEl.animate?.([{ opacity: 0 }, { opacity: Math.min(1, peak), offset: 0.18 }, { opacity: 0 }], { duration: ms, easing: 'ease-out' }); return true; } catch { return false; }
    },
    // The drawing area's size (stains are laid out on it).
    view() { at = area(); return { width: at.w, height: at.h }; },
    // Takes the wounded view away at once: vignette, pulse, flash and stains, and the board's wound look.
    clearWounds() { dropWounds(); applyBoard(); },
    get alive() { return state.splats.length + state.pulses.length + fx.length; },
    clear() {
      state = { lastAt: -Infinity, splats: [], pulses: [] };
      for (const p of fx) releaseEffect(p);
      fx = [];
      dropWounds();
      // Always put the board back, whatever this overlay thinks it applied.
      boardOn = false;
      try { board?.(null); } catch { /* the board is gone */ }
      painter?.clear();
      lingering = 0;
      if (frame !== null) { try { win.cancelAnimationFrame(frame); } catch { /* gone */ } frame = null; }
      if (el) { el.style.background = ''; try { ctx?.clearRect(0, 0, el.width, el.height); } catch { /* no context */ } }
      if (glintEl) { try { gctx?.save?.(); gctx?.setTransform?.(1, 0, 0, 1, 0, 0); gctx?.clearRect(0, 0, glintEl.width, glintEl.height); gctx?.restore?.(); } catch { /* no context */ } }
    },
  };
}

// Where lens blood draws, in window pixels: the whole window up to Foundry's right-hand column (the sidebar and the
// chat log, whose messages would hide it anyway), behind the rest of the interface. The column may take at most 35%
// of the window; without it, the whole window.
export function lensArea(doc = globalThis.document, win = globalThis.window) {
  const W = win?.innerWidth || 1, H = win?.innerHeight || 1;
  const box = (sel) => { const r = doc?.querySelector?.(sel)?.getBoundingClientRect?.(); return r && r.width > 0 && r.height > 0 && r.left > W * 0.5 && r.width < W * 0.4 ? r : null; };
  // Behind the sidebar's button strip (collapsed or open, the chat panel starts under it), fading out across it so no
  // edge shows between the buttons; without the strip, up to the sidebar. Not #ui-right or #chat-notifications, which
  // in v14 are full-height columns reaching far left of anything visible in them.
  const tabs = box('#sidebar-tabs'), side = box('#sidebar');
  let right = tabs ? tabs.right : side ? side.left : W, fade = tabs ? Math.round(tabs.width) : side ? 24 : 0;
  if (right < W * 0.65) { right = W * 0.65; fade = 24; }
  return { x: 0, y: 0, w: Math.max(1, Math.round(right)), h: H, fade };
}


