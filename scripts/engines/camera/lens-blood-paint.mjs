// Lens blood's sprite painting (lens-blood-draw.mjs draws them): each splat's wet and dried looks, its glint and its
// reaction's light (aura). No
// DOM here: it runs on the main thread (a fallback, and tests) and in the
// paint worker (lens-blood-paint-worker.mjs), on whatever canvases make(w, h) gives (OffscreenCanvas in the worker).

import { cssColor, shade, mix } from './lens-blood.mjs';

const DRIED = 0x2b1308;
const TAU = Math.PI * 2;
const lerp = (a, b, t) => a + (b - a) * t;
// The biggest side of a cached sprite, in device pixels.
export const SPRITE_MAX = 512;

// The splat's colours as it dries: its own shade of the blood colour, darker thick blood and much darker pools, a
// dark rim, and a light clear red where it is thin. The overlay multiplies them over the board (liquid on glass), so
// thin blood must stay light (a red tint) and only pooled blood goes near black.
// What a damage type turns the blood into as it dries (react.type, lens-blood.mjs): cooked to a char, fried, frozen
// pale, eaten to a sickly brown, withered black, burned off pale gold, thinned to a pale wisp. Others dry as blood does.
const DRIES = {
  fire: (wet) => mix(shade(wet, 0.5), 0x2a1309, 0.55),
  electricity: (wet) => mix(shade(wet, 0.8), 0x2a1c18, 0.3),
  cold: (wet) => mix(wet, 0xc8dce8, 0.3),
  acid: (wet) => mix(shade(wet, 0.7), 0x5a5512, 0.45),
  poison: (wet) => mix(shade(wet, 0.6), 0x2e3c0c, 0.4),
  void: (wet) => mix(shade(wet, 0.25), 0x07040a, 0.75),
  vitality: (wet) => mix(wet, 0xe0c68c, 0.5),
  spirit: (wet) => mix(wet, 0xe6eaf2, 0.62),
};
export function tones(splat, dry) {
  const wet = shade(splat.color, (splat.tone ?? 1) * 1.12), to = DRIES[splat.react?.type];
  const body = mix(wet, to ? to(wet) : mix(shade(wet, 0.55), DRIED, 0.45), dry);
  return { body, core: shade(body, 0.42), thin: mix(body, mix(shade(body, 2.1), 0xe8484a, 0.25), 0.9 * (1 - dry * 0.6)), rim: shade(body, 0.4), light: mix(shade(body, 2.4), 0xffd0c8, 0.3 * (1 - dry)) };
}

// How each shape sits on the glass: alpha of its thinnest and its thickest blood, how strong its rim, how soft its
// edge (device px), how wide its thickness spreads (share of r: wider leaves more of it thin), how much of its body
// thins out in patches (0..1).
export const LOOK = {
  blob: { thin: 0.7, thick: 0.95, rim: 0.8, soft: 1.3, spread: 0.42, film: 0.6 },
  crown: { thin: 0.7, thick: 0.95, rim: 0.8, soft: 1.2, spread: 0.4, film: 0.6 },
  streak: { thin: 0.68, thick: 0.92, rim: 0.7, soft: 1.1, spread: 0.5, film: 0.35 },
  spray: { thin: 0.7, thick: 0.9, rim: 0.55, soft: 0.9, spread: 0.6, film: 0 },
  mist: { thin: 0.5, thick: 0.6, rim: 0.3, soft: 0.8, spread: 0.6, film: 0 },
  smear: { thin: 0.12, thick: 0.3, rim: 0.25, soft: 2.6, spread: 0.9, film: 0 },
};
// A reaction's look on top: force slams it crisp, spirit thins it soft and see-through, cooked and fried blood keep a
// heavier rim.
export const lookOf = (splat) => {
  const look = LOOK[splat.shape] ?? LOOK.blob, re = splat.react;
  if (!re) return look;
  if (re.crisp) return { ...look, soft: look.soft * 0.45, spread: look.spread * 0.85, rim: look.rim * 1.15 };
  if (re.ethereal) return { ...look, soft: look.soft * 2.4, thin: look.thin * 0.62, thick: look.thick * 0.72, rim: look.rim * 0.5 };
  if (re.type === 'fire' || re.type === 'electricity') return { ...look, rim: Math.min(1, look.rim * 1.5) };
  return look;
};

// A seeded random source for a splat's fine texture (mulberry32).
function grainRandom(seed) {
  let a = (Number(seed) || 0) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A closed smooth path (midpoint quadratics) through relative points [[x, y]] scaled by r.
function closedPath(ctx, pts, r) {
  if (!pts || pts.length < 3) return;
  const last = pts[pts.length - 1];
  ctx.moveTo(((last[0] + pts[0][0]) / 2) * r, ((last[1] + pts[0][1]) / 2) * r);
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], n = pts[(i + 1) % pts.length];
    ctx.quadraticCurveTo(p[0] * r, p[1] * r, ((p[0] + n[0]) / 2) * r, ((p[1] + n[1]) / 2) * r);
  }
  ctx.closePath();
}
const polar = (body) => body.map((p) => [Math.cos(p.a) * p.r, Math.sin(p.a) * p.r]);

// Adds a droplet: an ellipse stretched along its flight (e), at least `min` px across.
function droplet(ctx, d, r, min) {
  const rr = Math.max(min, d.r * r), e = Math.max(1, d.e ?? 1), x = d.dx * r, y = d.dy * r, a = d.a ?? 0;
  const rx = rr * Math.sqrt(e), ry = rr / Math.sqrt(e) * (e > 1 ? 1.05 : 1);
  ctx.moveTo(x + Math.cos(a) * rx, y + Math.sin(a) * rx);
  if (ctx.ellipse) ctx.ellipse(x, y, rx, Math.max(min * 0.6, ry), a, 0, TAU);
  else ctx.arc(x, y, rr, 0, TAU);
}

// The whole outline of a splat, all subpaths wound the same way (one nonzero fill is their union).
export function outline(ctx, splat, r, min = 0.5) {
  const shape = splat.shape ?? 'blob';
  if (splat.path) closedPath(ctx, splat.path, r);
  else if (splat.body?.length) closedPath(ctx, polar(splat.body), r);
  for (const f of splat.fingers ?? []) closedPath(ctx, f, r);
  for (const d of splat.droplets ?? []) droplet(ctx, d, r, shape === 'mist' ? min * 0.8 : min);
}

// The splat's extent in relative units: [minX, minY, maxX, maxY].
function extent(splat) {
  let x0 = -0.2, y0 = -0.2, x1 = 0.2, y1 = 0.2;
  const add = (x, y, m = 0) => { x0 = Math.min(x0, x - m); y0 = Math.min(y0, y - m); x1 = Math.max(x1, x + m); y1 = Math.max(y1, y + m); };
  for (const p of splat.body ?? []) add(Math.cos(p.a) * p.r, Math.sin(p.a) * p.r);
  for (const p of splat.path ?? []) add(p[0], p[1]);
  for (const f of splat.fingers ?? []) for (const p of f) add(p[0], p[1]);
  for (const d of splat.droplets ?? []) add(d.dx, d.dy, d.r * Math.sqrt(Math.max(1, d.e ?? 1)) + 0.05);
  // A margin all round: soft edges, rims and noisy lobes can reach past the outline points (a splat was cut off flat).
  const m = 0.25 + 0.12 * Math.max(x1 - x0, y1 - y0);
  return [x0 - m, y0 - m, x1 + m, y1 + m];
}

// Paints `src`'s alpha, blurred by `blur` (device px), in `color` onto ctx: a shadow cast from far off the canvas.
function blurred(ctx, src, blur, color = '#fff') {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  const off = src.width + blur * 4 + 64;
  ctx.shadowOffsetX = off;
  ctx.drawImage(src, -off, 0);
  ctx.restore();
}
function tint(ctx, color) {
  ctx.save();
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.restore();
}

// Paints one look of a splat (wet or dried) into a new sprite. Answers { image, glint, ox, oy, unit, dev } or null.
export function paint(splat, dev, make, dried) {
  const [x0, y0, x1, y1] = extent(splat), look = lookOf(splat), shape = splat.shape ?? 'blob';
  const pad = 6;
  let unit = splat.r * dev;
  const big = Math.max(x1 - x0, y1 - y0) * unit + pad * 2;
  if (big > SPRITE_MAX) unit *= SPRITE_MAX / big;
  const W = Math.max(2, Math.ceil((x1 - x0) * unit + pad * 2)), H = Math.max(2, Math.ceil((y1 - y0) * unit + pad * 2));
  const ox = pad - x0 * unit, oy = pad - y0 * unit;
  const layer = () => { const c = make(W, H); const g = c?.getContext?.('2d'); return g ? g : null; };
  const out = layer(), mask = layer(), soft = layer(), thick = layer(), work = layer(), alpha = layer(), dense = layer();
  if (!out || !mask || !soft || !thick || !work || !alpha || !dense) return null;
  const rot = splat.rotation ?? 0;
  // A screen offset (px) in the splat's own (rotated) frame.
  const local = (x, y) => [x * Math.cos(-rot) - y * Math.sin(-rot), x * Math.sin(-rot) + y * Math.cos(-rot)];
  const c = tones(splat, dried ? 1 : 0);

  // The outline, hard, then softened a touch.
  mask.translate(ox, oy);
  mask.fillStyle = '#fff';
  mask.beginPath();
  outline(mask, splat, unit, 0.45 * dev);
  mask.fill();
  mask.setTransform(1, 0, 0, 1, 0, 0);
  blurred(soft, mask.canvas, look.soft * dev);
  soft.globalAlpha = 0.45;
  soft.drawImage(mask.canvas, 0, 0);
  soft.globalAlpha = 1;

  // Thickness: the mask blurred wide (thick middles stay near 1, thin fingers, tails and drops fall low), thinned
  // in a few seeded patches (blood spreads unevenly: a film here, a pool there) and thickened where it pools.
  const spreadPx = Math.max(2, look.spread * unit);
  blurred(thick, mask.canvas, spreadPx);
  const random = grainRandom(splat.grain ?? Math.round(splat.x * 31 + splat.y * 17 + splat.r));
  const blob = (g, px, py, pr, a) => {
    const gr = g.createRadialGradient(px, py, 0, px, py, pr);
    gr.addColorStop(0, `rgba(255,255,255,${a})`);
    gr.addColorStop(0.6, `rgba(255,255,255,${a * 0.5})`);
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(px - pr, py - pr, pr * 2, pr * 2);
  };
  if (look.film > 0) {
    thick.save();
    thick.translate(ox, oy);
    thick.globalCompositeOperation = 'destination-out';
    for (let k = 3 + Math.floor(random() * 4); k > 0; k--) {
      const ang = random() * TAU, d = Math.sqrt(random()) * 0.8;
      blob(thick, Math.cos(ang) * d * unit, Math.sin(ang) * d * unit, (0.25 + random() * 0.35) * unit, look.film * (0.5 + random() * 0.5));
    }
    thick.globalCompositeOperation = 'source-over';
    for (const p of splat.pools ?? []) blob(thick, p.dx * unit, p.dy * unit, Math.max(2, p.r * unit * 1.1), 0.7);
    thick.restore();
  }
  thick.globalCompositeOperation = 'destination-in';
  thick.drawImage(soft.canvas, 0, 0);
  thick.globalCompositeOperation = 'source-over';
  // The same, boosted: anything not thin (for the rim, the light and the glint).
  for (let k = 0; k < 3; k++) dense.drawImage(thick.canvas, 0, 0);

  // Colour: thin blood a light clear red, thick blood darker (thickness squared, so the change is gradual and much
  // of the splat stays see-through), the thickest (cubed) near black.
  const power = (n) => {
    work.clearRect(0, 0, W, H);
    work.drawImage(thick.canvas, 0, 0);
    work.globalCompositeOperation = 'destination-in';
    for (let k = 1; k < n; k++) work.drawImage(thick.canvas, 0, 0);
    work.globalCompositeOperation = 'source-over';
  };
  out.drawImage(soft.canvas, 0, 0);
  tint(out, cssColor(c.thin));
  out.globalCompositeOperation = 'source-atop';
  power(2);
  tint(work, cssColor(c.body));
  out.drawImage(work.canvas, 0, 0);
  power(3);
  tint(work, cssColor(c.core));
  out.globalAlpha = dried ? 0.45 : 0.55;
  out.drawImage(work.canvas, 0, 0);
  out.globalAlpha = 1;

  // Pools and grain: darker patches where it gathers, faint lighter and darker mottling all over.
  out.translate(ox, oy);
  for (const p of splat.pools ?? []) {
    const px = p.dx * unit, py = p.dy * unit, pr = Math.max(2, p.r * unit);
    const g = out.createRadialGradient(px, py, 0, px, py, pr);
    g.addColorStop(0, cssColor(c.core, dried ? 0.5 : 0.55));
    g.addColorStop(1, cssColor(c.core, 0));
    out.fillStyle = g;
    out.beginPath();
    out.ellipse(px, py, pr, pr * 0.75, (p.dx + p.dy) * 3, 0, TAU);
    out.fill();
  }
  const [gx0, gy0, gx1, gy1] = [x0 * unit, y0 * unit, x1 * unit, y1 * unit];
  const specks = shape === 'mist' ? 0 : 26;
  for (let k = 0; k < specks; k++) {
    const px = lerp(gx0, gx1, random()), py = lerp(gy0, gy1, random()), pr = (0.08 + random() * 0.25) * unit;
    const light = random() < 0.5, g = out.createRadialGradient(px, py, 0, px, py, pr);
    const col = light ? c.thin : c.core;
    g.addColorStop(0, cssColor(col, 0.12 + random() * 0.14));
    g.addColorStop(1, cssColor(col, 0));
    out.fillStyle = g;
    out.fillRect(px - pr, py - pr, pr * 2, pr * 2);
  }
  // Smears: the drag lines a wipe leaves.
  if (splat.streaks?.length) {
    out.lineCap = 'round';
    for (const s of splat.streaks) {
      out.strokeStyle = cssColor(c.core, 0.35 * (s.o ?? 1));
      out.lineWidth = Math.max(0.7, s.w * unit);
      out.beginPath();
      out.moveTo(s.x0 * unit, s.y * unit);
      out.quadraticCurveTo((s.x0 + s.x1) / 2 * unit, (s.y + s.w * 2) * unit, s.x1 * unit, s.y * unit);
      out.stroke();
    }
  }
  out.setTransform(1, 0, 0, 1, 0, 0);

  // The meniscus: a darker band just inside the edge of thick blood (a drying ring, stronger once dry). Cooked or
  // fried blood is singed wider, all round its edge, thin blood too.
  const re = splat.react, singed = dried && (re?.type === 'fire' || re?.type === 'electricity');
  work.clearRect(0, 0, W, H);
  work.drawImage(soft.canvas, 0, 0);
  work.globalCompositeOperation = 'destination-out';
  blurred(work, mask.canvas, Math.max(2.5 * dev, unit * (singed ? 0.2 : 0.12)));
  if (!singed) {
    work.globalCompositeOperation = 'destination-in';
    work.drawImage(dense.canvas, 0, 0);
  }
  work.globalCompositeOperation = 'source-over';
  tint(work, cssColor(singed ? shade(c.rim, 0.6) : c.rim));
  out.globalAlpha = Math.min(1, look.rim * (dried ? 1.25 : 1));
  out.drawImage(work.canvas, 0, 0);
  out.drawImage(work.canvas, 0, 0);
  out.globalAlpha = 1;
  // Its reaction's marks once it has reacted (the dried look): singed or fried crackle, a withered one's veins.
  if (dried && re) marks(out, re, { ox, oy, unit, dev, c });

  // Light through the drop gathers on its far side from the light (top left of the screen): a soft bright crescent
  // inside the bottom-right edge of thick blood.
  if (!dried && shape !== 'mist') {
    work.clearRect(0, 0, W, H);
    work.globalCompositeOperation = 'source-over';
    work.drawImage(soft.canvas, 0, 0);
    const [sx, sy] = local(-1, -1.15), o = Math.max(1.5 * dev, unit * 0.09);
    work.globalCompositeOperation = 'destination-out';
    work.save();
    work.translate(sx * o, sy * o);
    blurred(work, mask.canvas, Math.max(2 * dev, unit * 0.08));
    work.restore();
    work.globalCompositeOperation = 'destination-in';
    work.drawImage(dense.canvas, 0, 0);
    work.globalCompositeOperation = 'source-over';
    tint(work, cssColor(c.light));
    out.globalAlpha = shape === 'smear' ? 0.2 : 0.38;
    out.drawImage(work.canvas, 0, 0);
    out.globalAlpha = 1;
  }

  // Opacity: thin blood lets the board through, thick blood hardly at all.
  alpha.globalAlpha = (look.thick - look.thin) / Math.max(0.01, 1 - look.thin);
  alpha.drawImage(thick.canvas, 0, 0);
  alpha.globalAlpha = look.thin * (dried ? 0.92 : 1);
  alpha.drawImage(soft.canvas, 0, 0);
  alpha.globalAlpha = 1;
  alpha.globalCompositeOperation = 'destination-in';
  alpha.drawImage(soft.canvas, 0, 0);
  out.globalCompositeOperation = 'destination-in';
  out.drawImage(alpha.canvas, 0, 0);
  out.globalCompositeOperation = 'source-over';

  let glint = null;
  if (!dried && shape !== 'mist' && shape !== 'smear') glint = paintGlint(splat, make, { W, H, ox, oy, unit, dev, thick: dense });
  // A reaction's light, drawn over the blood on the shine layer, faded in and out live: frost, a gold glow, a sheen.
  const aura = !dried && re && ((re.frost && !re.still) || re.glow || re.sheen) ? paintAura(splat, make, { W, H, ox, oy, unit, dev, mask: mask.canvas, soft: soft.canvas, dense: dense.canvas }) : null;
  return { image: out.canvas, glint, aura, ox, oy, unit, dev };
}

// Strokes a flat [x, y, ...] polyline (relative to r) at `unit` px.
function polyline(g, pts, unit) {
  g.moveTo(pts[0] * unit, pts[1] * unit);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i] * unit, pts[i + 1] * unit);
}
// A reaction's marks in the dried look: dark crackle from the edge in (cooked, fried), dark veins (withered).
function marks(out, re, { ox, oy, unit, dev, c }) {
  out.save();
  out.translate(ox, oy);
  out.lineCap = 'round';
  out.lineJoin = 'round';
  const stroke = (lines, color, width) => {
    if (!lines?.length) return;
    out.strokeStyle = color;
    out.lineWidth = width;
    out.beginPath();
    for (const l of lines) polyline(out, l, unit);
    out.stroke();
  };
  const dark = shade(c.core, 0.55);
  // The crust cracks open: a dark lip, and the crack itself cut out of the dried look (the redder wet blood under it
  // shows through, laid over it as it dries).
  stroke(re.cracks, cssColor(dark, 0.5), Math.max(1.6 * dev, unit * 0.055));
  out.globalCompositeOperation = 'destination-out';
  stroke(re.cracks, 'rgba(0,0,0,0.9)', Math.max(0.9 * dev, unit * 0.03));
  out.globalCompositeOperation = 'source-over';
  stroke(re.veins, cssColor(dark, 0.3), Math.max(2 * dev, unit * 0.08));
  stroke(re.veins, cssColor(0x050206, 0.9), Math.max(0.8 * dev, unit * 0.025));
  out.restore();
}

// The light a reaction lays over its blood (normal blending, on the shine layer): a frosty rim with ice needles and a
// pale haze (cold), a gold halo round its edge (vitality), an oily rainbow sheen on its thick parts (poison).
export function paintAura(splat, make, { W, H, ox, oy, unit, dev, mask, soft, dense }) {
  const g = make(W, H)?.getContext?.('2d'), w = make(W, H)?.getContext?.('2d');
  if (!g || !w) return null;
  const re = splat.react;
  // The body alone (no flung droplets): frost and glow ring the blood itself, not every speck around it.
  const b = make(W, H)?.getContext?.('2d');
  if (!b) return null;
  b.translate(ox, oy);
  b.fillStyle = '#fff';
  b.beginPath();
  outline(b, { ...splat, droplets: [] }, unit, 0.45 * dev);
  b.fill();
  b.setTransform(1, 0, 0, 1, 0, 0);
  const body = b.canvas;
  // A band just inside its edge, `width` px wide, in `color`.
  const band = (width, color) => {
    w.clearRect(0, 0, W, H);
    w.globalCompositeOperation = 'source-over';
    w.drawImage(body, 0, 0);
    w.globalCompositeOperation = 'destination-out';
    blurred(w, body, width);
    w.globalCompositeOperation = 'source-over';
    tint(w, color);
    return w.canvas;
  };
  if (re.frost) {
    w.clearRect(0, 0, W, H);
    w.drawImage(dense, 0, 0);
    tint(w, 'rgb(214,232,246)');
    g.globalAlpha = 0.1;
    g.drawImage(w.canvas, 0, 0);
    g.globalAlpha = 0.6;
    g.drawImage(band(Math.max(3 * dev, unit * 0.16), 'rgb(226,242,255)'), 0, 0);
    g.globalAlpha = 1;
    if (re.needles?.length) {
      g.save();
      g.translate(ox, oy);
      g.lineCap = 'round';
      g.strokeStyle = 'rgba(240,250,255,0.85)';
      g.lineWidth = Math.max(0.6 * dev, unit * 0.014);
      g.beginPath();
      for (const l of re.needles) polyline(g, l, unit);
      g.stroke();
      g.restore();
    }
    g.globalCompositeOperation = 'destination-in';
    g.drawImage(soft, 0, 0);
  } else if (re.glow) {
    // A halo outside its edge (its outline blurred, the blood itself cut out), and a bright band inside it.
    blurred(g, body, Math.max(4 * dev, unit * 0.18), 'rgb(255,200,96)');
    g.globalCompositeOperation = 'destination-out';
    g.drawImage(soft, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 0.9;
    g.drawImage(band(Math.max(2.5 * dev, unit * 0.12), 'rgb(255,228,150)'), 0, 0);
    g.globalAlpha = 1;
  } else if (re.sheen) {
    // Rainbow bands across it, turned its own way, only where it is thick enough to pool.
    const a = ((splat.grain ?? 0) % 628) / 100, cx = W / 2, cy = H / 2, l = Math.hypot(W, H) / 2;
    const gr = g.createLinearGradient(cx - Math.cos(a) * l, cy - Math.sin(a) * l, cx + Math.cos(a) * l, cy + Math.sin(a) * l);
    [[0, '150,235,110'], [0.2, '90,215,200'], [0.36, '200,150,235'], [0.5, '230,220,110'], [0.66, '120,230,130'], [0.82, '90,190,225'], [1, '180,140,230']]
      .forEach(([at, rgb]) => gr.addColorStop(at, `rgba(${rgb},0.3)`));
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'destination-in';
    g.drawImage(dense, 0, 0);
    g.globalCompositeOperation = 'destination-out';
    // Not over its very middle: a film round the pool.
    blurred(g, mask, Math.max(6 * dev, unit * 0.35), 'rgba(0,0,0,0.7)');
  }
  g.globalCompositeOperation = 'source-over';
  return g.canvas;
}

// The wet shine, lit from the top left of the screen: an irregular glint on the thick part, pinpricks on bigger drops.
export function paintGlint(splat, make, { W, H, ox, oy, unit, dev, thick }) {
  const g = make(W, H)?.getContext?.('2d');
  if (!g) return null;
  const rot = splat.rotation ?? 0, cos = Math.cos(-rot), sin = Math.sin(-rot);
  // A screen offset turned into the splat's own frame.
  const local = (x, y) => [x * cos - y * sin, x * sin + y * cos];
  g.translate(ox, oy);
  const h = splat.highlight ?? { dx: -0.3, dy: -0.3, r: 0.15 };
  // Small, thin and different on each splat (a glint, not a sticker), and only on some of them.
  const [lx, ly] = local(h.dx, h.dy), hr = Math.max(1 * dev, h.r * unit * 0.42);
  const pick = Math.abs(Math.sin((splat.x ?? 0) * 12.9898 + (splat.y ?? 0) * 78.233)) % 1, glint = pick >= 0.4;
  const long = 1.3 + pick * 0.9, narrow = 0.35 + (1 - pick) * 0.25;
  const ks = h.k ?? [1, 0.8, 1, 0.9, 1.1, 0.85, 1];
  const at = splat.path ? [lx * 0.55, ly * 0.55] : [lx, ly];
  // An irregular sliver (ks: its outline's radii), stretched `long` by `narrow`, tilted by `tilt`.
  const sliver = (cx, cy, size, tilt, alpha) => {
    g.fillStyle = `rgba(255,238,236,${alpha})`;
    g.shadowColor = `rgba(255,238,236,${Math.min(1, alpha * 1.1)})`;
    g.shadowBlur = Math.max(1.5, size * 0.5);
    g.beginPath();
    const ct = Math.cos(tilt), st = Math.sin(tilt);
    const pts = ks.map((k, i) => {
      const a = (i / ks.length) * TAU, u = Math.cos(a) * size * k * long, v = Math.sin(a) * size * k * narrow;
      return [cx + u * ct - v * st, cy + u * st + v * ct];
    });
    g.moveTo((pts[0][0] + pts.at(-1)[0]) / 2, (pts[0][1] + pts.at(-1)[1]) / 2);
    for (let i = 0; i < pts.length; i++) { const n = pts[(i + 1) % pts.length]; g.quadraticCurveTo(pts[i][0], pts[i][1], (pts[i][0] + n[0]) / 2, (pts[i][1] + n[1]) / 2); }
    g.fill();
    g.shadowBlur = 0;
    g.shadowColor = 'transparent';
  };
  if (glint) sliver(at[0] * unit, at[1] * unit, hr, (ks[0] - 0.85) * 0.8, 0.55);
  // Some bodies catch a second, smaller glint lower down where they are thick too (not every one: varied).
  if (!splat.path && pick >= 0.62) {
    const [sx, sy] = local(0.18 + (ks[1] - 0.85) * 0.4, 0.22 + (ks[2] - 0.85) * 0.4);
    sliver(sx * unit, sy * unit, hr * (0.45 + (ks[3] - 0.55) * 0.4), 0.6 + ks[4], 0.42);
  }
  // Pinpricks on the bigger drops (no broad sheen: drawn normally over dark blood, it reads as grey fog).
  const [dx, dy] = local(-0.32, -0.36);
  g.fillStyle = 'rgba(255,240,238,0.55)';
  g.beginPath();
  for (const d of splat.droplets ?? []) {
    const rr = d.r * unit;
    if (rr < 3 * dev) continue;
    const x = d.dx * unit + dx * rr, y = d.dy * unit + dy * rr, s = Math.max(0.6 * dev, rr * 0.22);
    g.moveTo(x + s, y);
    g.arc(x, y, s, 0, TAU);
  }
  g.fill();
  g.setTransform(1, 0, 0, 1, 0, 0);
  // Shine only where the blood is thick enough to bead.
  g.globalCompositeOperation = 'destination-in';
  g.drawImage(thick.canvas, 0, 0);
  g.globalCompositeOperation = 'source-over';
  return g.canvas;
}

// The plain data painting reads from a splat (what a paint request carries to the worker).
const SPLAT_FIELDS = ['shape', 'color', 'tone', 'r', 'x', 'y', 'rotation', 'grain', 'body', 'path', 'fingers', 'droplets', 'pools', 'streaks', 'highlight'];
const REACT_FIELDS = ['type', 'still', 'crisp', 'ethereal', 'cracks', 'veins', 'needles', 'frost', 'glow', 'sheen'];
export function splatData(splat) {
  const out = {};
  for (const k of SPLAT_FIELDS) if (splat[k] !== undefined) out[k] = splat[k];
  // Of its reaction, only what its sprites paint (its live marks stay on the main thread).
  if (splat.react) {
    out.react = {};
    for (const k of REACT_FIELDS) if (splat.react[k] !== undefined) out.react[k] = splat.react[k];
  }
  return out;
}

/**
 * Answers one paint request { id, splat (splatData), dev, dried }. make(w, h) makes a canvas; bitmap(canvas) turns a
 * painted one into what is sent back. Answers { reply, transfer }: reply { id, ok, image, glint, aura, ox, oy, unit, dev }
 * (ok false: nothing could be painted), transfer: its bitmaps.
 */
export function paintReply(msg, make, bitmap = (c) => c) {
  const id = msg?.id;
  const s = msg?.splat ? paint(msg.splat, msg.dev, make, msg.dried === true) : null;
  if (!s) return { reply: { id, ok: false }, transfer: [] };
  const image = bitmap(s.image), glint = s.glint ? bitmap(s.glint) : null, aura = s.aura ? bitmap(s.aura) : null;
  return { reply: { id, ok: true, image, glint, aura, ox: s.ox, oy: s.oy, unit: s.unit, dev: s.dev }, transfer: [image, glint, aura].filter(Boolean) };
}
