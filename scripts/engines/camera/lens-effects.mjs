// Damage-type effects on the camera lens, beside lens blood (lens-blood.mjs): the same players-only rule (the
// player's creature hit, or the creature it hit, and only what that screen perceives), and each energy type leaves
// its own short mark on the glass: fire soot and embers, frost that thaws, lightning arcs, acid drops, a poisoned
// sway, a sonic ripple, force cracks, a void drain, a radiant glare, double vision, spirit wisps; Daggerheart's magic
// an arcane shimmer. A plan is pure data, seeded and deterministic: static shapes painted once (darkening ones on
// the multiplied canvas, light on the glint canvas above it), a few live particles, and keyframes for a short CSS
// filter/transform on the board. lens-effects-draw.mjs draws it; nothing here touches Foundry.

import { hpChange } from '../../systems/hp-state.mjs';
import { qualityRank } from '../../core/quality.mjs';
import { normalizeDamageType } from '../playback/damage-moments.mjs';
import { lensAmount, hitStrength, dealtStrength, edgeToward } from './lens-blood.mjs';

const TAU = Math.PI * 2;
const clamp01 = (v) => Math.min(1, Math.max(0, Number(v) || 0));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => { const v = clamp01(t); return v * v * (3 - 2 * v); };
const r1 = (v) => Math.round(v * 10) / 10;
const r3 = (v) => Math.round(v * 1000) / 1000;

// The energy looks, and what stands for each on the lens. Physical damage draws blood only, with two extras: bleed
// darkens the view in a short pulse, a crushing crit cracks the glass a little. 'arcane' is Daggerheart's magic.
export const LENS_EFFECT_ENERGY = Object.freeze(['fire', 'cold', 'electricity', 'acid', 'poison', 'sonic', 'force', 'void', 'vitality', 'mental', 'spirit']);
export const LENS_EFFECT_TYPES = Object.freeze([...LENS_EFFECT_ENERGY, 'arcane', 'bleed', 'bludgeoning']);
export const LENS_EFFECTS = Object.freeze({
  maxAlive: 4,
  // Two energy types at most from one hit (the largest first), plus a physical extra.
  maxEnergy: 2,
});

/**
 * The lens effects a damage record (damage-moments.mjs damageFromMessage / damageFromParts / daggerheartDamage) calls
 * for, in order: its energy types, the main (largest) one first, two at most; Daggerheart's magical damage as the
 * arcane shimmer first (its generic arcana force left out, a domain's own energy kept); then bleed's pulse and a
 * bludgeoning crit's crack. [] for plain physical hits.
 */
export function lensEffectTypes({ type = null, types = [], dhType = null, crit = false } = {}) {
  const all = [...new Set([type, ...(Array.isArray(types) ? types : [])].map((t) => (t ? normalizeDamageType(t) : '')).filter(Boolean))];
  const magical = dhType === 'magical' || all.includes('arcane') || all.includes('magical');
  const energy = all.filter((t) => LENS_EFFECT_ENERGY.includes(t) && !(magical && t === 'force'));
  const out = [...(magical ? ['arcane'] : []), ...energy].slice(0, LENS_EFFECTS.maxEnergy);
  if (all.includes('bleed')) out.push('bleed');
  if (crit && all.includes('bludgeoning')) out.push('bludgeoning');
  return out;
}

const lostOf = (before, after) => Math.max(0, before.marked ? after.value - before.value : before.value - after.value);

/**
 * Whether this blow plays its damage-type effects on this screen: the lens blood rule (lensSplashFor) with the
 * effects' own switches. Bloodless creatures still burn, freeze and crack the lens. types: lensEffectTypes(...).
 * Answers { types, strength (0..1, the splash strength before damage-type scaling: ~60% of max HP is full; crits
 * floored), crit, amount, kind 'self'|'dealt', impact (screen point or null), quality } or null.
 */
export function lensEffectHit({ isGM = false, worldOn = true, localOn = true, quality = 'full', amount = 'heavy', gore = 'full',
  role = null, before = null, after = null, crit = false, visible = true, hidden = false,
  screen = null, attackerScreen = null, types = [] } = {}) {
  if (isGM || !worldOn || !localOn || (role !== 'victim' && role !== 'attacker') || !types?.length) return null;
  const look = lensAmount({ amount, gore, quality });
  if (!look || hidden || !visible) return null;
  const change = hpChange(before, after);
  if (!change) return null;
  const hit = { lost: lostOf(before, after), max: Number(after.max) || Number(before.max) || 0, crit: crit === true, down: change.dropped === true };
  const kind = role === 'victim' ? 'self' : 'dealt';
  const point = (p) => (p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: p.x, y: p.y } : null);
  return { types: types.slice(), strength: kind === 'self' ? hitStrength(hit) : dealtStrength(hit), crit: hit.crit, amount: look, kind,
    impact: kind === 'self' ? point(attackerScreen) : point(screen), quality };
}

// A seeded random source (mulberry32 over a string hash).
function rng(text) {
  let h = 2166136261;
  for (const c of String(text)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const between = (random, a, b) => a + (b - a) * random();
const flat = (pts) => pts.flatMap(([x, y]) => [r1(x), r1(y)]);

// 0..1 over a timing { delay, in, hold, out } at `age` ms.
export function envelope(age, { delay = 0, in: rise = 0, hold = 0, out = 0 } = {}) {
  const t = age - delay;
  if (t < 0) return 0;
  if (t < rise) return smooth(t / rise);
  if (t < rise + hold) return 1;
  if (t < rise + hold + out) return 1 - smooth((t - rise - hold) / out);
  return 0;
}
export const endOf = ({ delay = 0, in: rise = 0, hold = 0, out = 0 } = {}) => delay + rise + hold + out;

// A ragged outline: n radius factors around a blot, smooth enough to read as a soft smudge.
function rough(random, n = 14, depth = 0.35) {
  const k = Math.floor(between(random, 2, 5)), ph = random() * TAU;
  return Array.from({ length: n }, (_, i) => r3(1 - depth * 0.5 + depth * (0.5 * Math.sin(i / n * TAU * k + ph) + 0.5 * random())));
}
// A point on the lens's border region: along one edge, `inset` in from it. Leans toward `lean` (an edge name) when given.
const EDGES = ['left', 'right', 'top', 'bottom'];
function nearEdge(random, W, H, inset, lean = null, share = 0.45) {
  const edge = lean && random() < share ? lean : EDGES[Math.floor(random() * 4)];
  const along = random(), d = inset * random();
  if (edge === 'left') return { x: d, y: along * H, edge, inward: 0 };
  if (edge === 'right') return { x: W - d, y: along * H, edge, inward: Math.PI };
  if (edge === 'top') return { x: along * W, y: d, edge, inward: Math.PI / 2 };
  return { x: along * W, y: H - d, edge, inward: -Math.PI / 2 };
}

// A jagged line from a point, stepping `n` times along `ang` with up to `jitter` radians of wander.
function jagged(random, x, y, ang, len, n, jitter) {
  const pts = [[x, y]];
  let a = ang;
  for (let i = 0; i < n; i++) {
    a = ang + (random() - 0.5) * 2 * jitter;
    x += Math.cos(a) * len / n; y += Math.sin(a) * len / n;
    pts.push([x, y]);
  }
  return pts;
}
// A lightning bolt between two points by midpoint displacement.
function bolt(random, x0, y0, x1, y1, disp, levels) {
  let pts = [[x0, y0], [x1, y1]];
  for (let l = 0; l < levels; l++) {
    const next = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i], dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
      const off = (random() - 0.5) * disp;
      next.push([(ax + bx) / 2 - dy / len * off, (ay + by) / 2 + dx / len * off], pts[i]);
    }
    pts = next;
    disp *= 0.55;
  }
  return pts;
}

// Frost: a straight crystal arm feathered with short needles at 60 degrees either side (shorter toward its tip),
// branching into smaller arms like it, until `budget` arms are spent. The needles of an arm are one 'segs' shape.
function dendrite(random, out, x, y, ang, len, depth, w, budget) {
  if (budget.left-- <= 0) return;
  const n = 6, pts = [[x, y]], segs = [];
  for (let i = 1; i <= n; i++) {
    const a = ang + (random() - 0.5) * 0.12, t = i / n;
    x += Math.cos(a) * len / n; y += Math.sin(a) * len / n;
    pts.push([x, y]);
    for (let k = 0; k < 2; k++) {
      const [px, py] = pts[i - 1], u = k / 2, sx = px + (x - px) * u, sy = py + (y - py) * u, nl = len * 0.2 * (1.1 - t) * between(random, 0.6, 1.1);
      for (const side of [-1, 1]) { const na = ang + side * Math.PI / 3; segs.push(r1(sx), r1(sy), r1(sx + Math.cos(na) * nl), r1(sy + Math.sin(na) * nl)); }
    }
    if (depth > 0 && i < n && random() < 0.5) dendrite(random, out, x, y, ang + (random() < 0.5 ? -1 : 1) * Math.PI / 3, len * between(random, 0.35, 0.5) * (1.1 - t), depth - 1, w * 0.7, budget);
  }
  out.push({ p: 'path', pts: flat(pts), w: r1(Math.max(0.6, w)), depth });
  out.push({ p: 'segs', pts: segs, w: r1(Math.max(0.5, w * 0.55)), depth });
}
// Void veins: a curling vein inward, thick to thin in three runs, with a branch or two.
function vein(random, out, x, y, ang, len, w, branches) {
  const runs = 3, per = 6, pts = [[x, y]];
  let a = ang, curl = (random() - 0.5) * 0.5;
  for (let i = 0; i < runs * per; i++) {
    curl += (random() - 0.5) * 0.35; curl *= 0.85; a += curl * 0.4;
    x += Math.cos(a) * len / (runs * per); y += Math.sin(a) * len / (runs * per);
    pts.push([x, y]);
    if (branches > 0 && i > 3 && random() < 0.12) { branches--; vein(random, out, x, y, a + (random() < 0.5 ? -1 : 1) * between(random, 0.5, 1), len * between(random, 0.25, 0.45), w * 0.55, 0); }
  }
  for (let k = 0; k < runs; k++) out.push({ p: 'path', pts: flat(pts.slice(k * per, (k + 1) * per + 1)), w: r1(Math.max(0.6, w * (1 - k * 0.33))) });
}
// Cracked glass from a point: jagged radial cracks with side branches and web segments between neighbours.
function cracks(random, { x, y, R, count, crit = false }) {
  const radials = [], shapes = [], base = random() * TAU;
  for (let k = 0; k < count; k++) {
    const a = base + k * TAU / count + (random() - 0.5) * (TAU / count) * 0.5, len = R * between(random, 0.5, 1);
    const pts = jagged(random, x + Math.cos(a) * R * 0.03, y + Math.sin(a) * R * 0.03, a, len, 6 + Math.floor(random() * 4), 0.13);
    radials.push(pts);
    shapes.push({ p: 'path', pts: flat(pts), w: crit ? 1.6 : 1.3 });
    for (let i = 2; i < pts.length - 1; i++) {
      if (random() > 0.22) continue;
      const side = random() < 0.5 ? -1 : 1, bl = len * between(random, 0.12, 0.3);
      shapes.push({ p: 'path', pts: flat(jagged(random, pts[i][0], pts[i][1], a + side * between(random, 0.4, 0.9), bl, 4, 0.3)), w: 0.9 });
    }
  }
  // The crushed core: short splinters round the point of impact.
  for (let i = 0, k = 6 + Math.floor(count * 0.8); i < k; i++) {
    const a = random() * TAU, d = R * between(random, 0.02, 0.09), l = R * between(random, 0.03, 0.08), b = a + Math.PI / 2 + (random() - 0.5);
    const cx = x + Math.cos(a) * d, cy = y + Math.sin(a) * d;
    shapes.push({ p: 'path', pts: flat([[cx - Math.cos(b) * l / 2, cy - Math.sin(b) * l / 2], [cx + Math.cos(b) * l / 2, cy + Math.sin(b) * l / 2]]), w: 0.9 });
  }
  // The web: short sagging links between neighbouring cracks, nearer the middle more often.
  for (const f of count >= 6 ? [0.22, 0.45, 0.7] : [0.3, 0.6]) {
    for (let k = 0; k < radials.length; k++) {
      if (random() > 0.85 - f * 0.4) continue;
      const a = radials[k], b = radials[(k + 1) % radials.length];
      const pa = a[Math.min(a.length - 1, Math.round(f * (a.length - 1) * between(random, 0.85, 1.15)))], pb = b[Math.min(b.length - 1, Math.round(f * (b.length - 1) * between(random, 0.85, 1.15)))];
      const mx = (pa[0] + pb[0]) / 2, my = (pa[1] + pb[1]) / 2, sag = between(random, 0.05, 0.15);
      shapes.push({ p: 'path', pts: flat([pa, [lerp(mx, x, sag) + (random() - 0.5) * 3, lerp(my, y, sag) + (random() - 0.5) * 3], pb]), w: 0.8 });
    }
  }
  return shapes;
}

// Board keyframes as a damped wobble: `keys` keys over `ms`, each prop (name: [amplitude, neutral]) swinging around
// its neutral value and settling back.
function wobbleKeys(random, ms, keys, props, { rise = 0.15 } = {}) {
  const out = [], ph = random() * TAU;
  for (let i = 0; i <= keys; i++) {
    const t = i / keys, env = t < rise ? smooth(t / rise) : 1 - smooth((t - rise) / (1 - rise));
    const k = { t: Math.round(t * ms) };
    for (const [name, [amp, neutral = 0, osc = true]] of Object.entries(props)) k[name] = r3(neutral + amp * env * (osc ? Math.sin(ph + i * 1.9) : 1));
    out.push(k);
  }
  return out;
}

// The look of one effect type at intensity e (0..1): its layers (painted once: { canvas, shapes, time, reveal, pulse }
// or a vignette drawn live), its live items and its board keyframes.
const BUILD = {
  fire(random, c) {
    const { W, H, m, e, n, lean, lite, time } = c;
    const soot = [], glow = [];
    for (let i = 0, count = n(22 + 36 * e); i < count; i++) {
      const p = nearEdge(random, W, H, m * 0.08 * (0.5 + e), lean);
      const r = m * between(random, 0.028, 0.075) * (0.6 + 0.6 * e), charred = random() < 0.35;
      soot.push({ p: 'blot', x: r1(p.x), y: r1(p.y), r: r1(r), sx: r3(between(random, 1.3, 2.4)), rot: r3(p.inward + Math.PI / 2 + (random() - 0.5) * 0.6),
        rough: rough(random, 16, 0.5), color: charred ? 0x170b05 : 0x3a2414, alpha: r3(between(random, 0.45, 0.8)), soft: r3(between(random, 0.35, 0.7)) });
      // The burning rim: an orange glow at the soot's inner edge, gone in a moment.
      if (random() < 0.5) glow.push({ p: 'glow', x: r1(p.x + Math.cos(p.inward) * r * 0.9), y: r1(p.y + Math.sin(p.inward) * r * 0.9), r: r1(r * 1.1), color: 0xff6a14, core: 0xffb050, alpha: r3(between(random, 0.3, 0.55)) });
    }
    const layers = [
      { canvas: 'mark', vignette: { color: 0xffa060, alpha: r3(0.4 + 0.35 * e), inner: r3(0.62 - 0.2 * e) }, time },
      { canvas: 'mark', shapes: soot, time, reveal: { mode: 'edges', ms: 480 } },
      { canvas: 'glint', shapes: glow, time: { in: 120, hold: Math.round(time.hold * 0.4), out: 600 }, reveal: { mode: 'edges', ms: 480 } },
      // The heat flash: brief, at the edges.
      { canvas: 'glint', vignette: { color: 0xff7a1e, alpha: r3(0.3 + 0.35 * e), inner: r3(0.55 - 0.2 * e) }, time: { in: 60, hold: 110, out: 520 } },
    ];
    const embers = lite ? [] : Array.from({ length: n(12 + 26 * e) }, () => {
      const p = nearEdge(random, W, H, m * 0.2, random() < 0.5 ? 'bottom' : lean, 0.7);
      return { x: r1(p.x), y: r1(p.y), vx: r1(between(random, -25, 25)), vy: r1(-between(random, 40, 110)), r: r1(between(random, 1.6, 4)),
        delay: Math.round(between(random, 0, 600)), life: Math.round(between(random, 900, 1700) * (c.crit ? 1.3 : 1)), flick: r3(random() * TAU) };
    });
    return { layers, live: embers.length ? [{ kind: 'embers', items: embers }] : [] };
  },
  cold(random, c) {
    const { W, H, m, e, n, lite, time, subtle } = c;
    const frost = [], total = subtle ? 160 : Math.round(260 + 420 * e), reach = m * (0.12 + 0.24 * e);
    const corners = [[0, 0, Math.PI / 4], [W, 0, Math.PI * 3 / 4], [W, H, -Math.PI * 3 / 4], [0, H, -Math.PI / 4]];
    const seeds = (subtle ? corners.filter((_, i) => i % 2 === 0) : corners).map(([x, y, a]) => ({ x, y, a, len: reach }));
    for (let i = 0, extra = n(2 + 4 * e); i < extra; i++) { const p = nearEdge(random, W, H, 4, c.lean); seeds.push({ x: p.x, y: p.y, a: p.inward, len: reach * 0.7 }); }
    for (const s of seeds) {
      // Each seed its share of the paths, so the last ones still grow.
      const budget = { left: Math.round(total / seeds.length * (s.len < reach ? 0.6 : 1.2) / 2) };
      frost.push({ p: 'glow', x: r1(s.x), y: r1(s.y), r: r1(s.len * 1.2), color: 0xe4f1ff, alpha: 0.32 });
      for (let k = 0, arms = 5 + Math.floor(random() * 3); k < arms; k++) dendrite(random, frost, s.x, s.y, s.a + (k - (arms - 1) / 2) * 0.3 + (random() - 0.5) * 0.15, s.len * between(random, 0.5, 1), subtle ? 1 : 2, 1.6, budget);
    }
    frost.forEach((f) => { if (f.p === 'path' || f.p === 'segs') Object.assign(f, { color: 0xf4faff, alpha: r3(0.6 + 0.12 * (f.depth ?? 0)), halo: { w: r1(f.w * 4), color: 0xcfe6ff, alpha: 0.14 } }); });
    const layers = [
      { canvas: 'mark', vignette: { color: 0x9dbedd, alpha: r3(0.35 + 0.35 * e), inner: r3(0.6 - 0.2 * e) }, time },
      { canvas: 'glint', vignette: { color: 0xeef6ff, alpha: r3(0.16 + 0.16 * e), inner: r3(0.62 - 0.15 * e) }, time },
      { canvas: 'glint', shapes: frost, time, reveal: { mode: 'edges', ms: 650 } },
    ];
    // The thaw: a few drops run down from the frost as it fades.
    const thaw = time.in + time.hold;
    const drips = lite ? [] : Array.from({ length: n(3 + 4 * e) }, () => {
      // From the frost on the upper half, a little in from its seed.
      const upper = seeds.filter((s) => s.y < H * 0.6), s = upper[Math.floor(random() * upper.length)] ?? seeds[0];
      const d = s.len * between(random, 0.15, 0.6), a = s.a + (random() - 0.5) * 0.8;
      return { x: r1(Math.min(W - 2, Math.max(2, s.x + Math.cos(a) * d))), y: r1(Math.min(H, Math.max(0, s.y + Math.sin(a) * d))), len: r1(between(random, 40, 130) * (0.6 + 0.6 * e)), w: r1(between(random, 1.4, 2.6)),
        delay: Math.round(thaw - 200 + random() * 300), life: Math.round(time.out + 400) };
    });
    return { layers, live: drips.length ? [{ kind: 'drips', items: drips }] : [] };
  },
  electricity(random, c) {
    const { W, H, m, e, n, lite, at, crit, subtle } = c;
    const count = subtle ? 1 : Math.min(3, 1 + Math.round(2 * e) + (crit ? 1 : 0)), scorch = [], arcs = [], sparks = [];
    for (let i = 0; i < count; i++) {
      const from = i === 0 && at ? { x: at.x, y: at.y } : nearEdge(random, W, H, m * 0.05);
      const a = Math.atan2(H / 2 - from.y, W / 2 - from.x) + (random() - 0.5) * 1.4, len = m * between(random, 0.45, 0.9) * (0.7 + 0.4 * e);
      const to = { x: Math.min(W, Math.max(0, from.x + Math.cos(a) * len)), y: Math.min(H, Math.max(0, from.y + Math.sin(a) * len)) };
      const variants = Array.from({ length: lite ? 1 : 3 }, () => {
        const main = bolt(random, from.x, from.y, to.x, to.y, len * 0.32, 6);
        const branches = Array.from({ length: 2 + Math.floor(random() * 3) }, () => {
          const [bx, by] = main[Math.floor(between(random, 0.2, 0.85) * main.length)], ba = a + (random() < 0.5 ? -1 : 1) * between(random, 0.35, 0.9), bl = len * between(random, 0.12, 0.3);
          return flat(bolt(random, bx, by, bx + Math.cos(ba) * bl, by + Math.sin(ba) * bl, bl * 0.4, 4));
        });
        return { main: flat(main), branches };
      });
      arcs.push({ variants, w: r1(crit ? 2.6 : 2), delay: Math.round(i * between(random, 20, 70)), life: Math.round((300 + 300 * e) * (crit ? 1.5 : 1)), flicker: !lite });
      for (const p of [to, ...variants[0].branches.map((b) => ({ x: b.at(-2), y: b.at(-1) }))]) {
        const r = between(random, 5, 12) * (0.7 + 0.6 * e);
        scorch.push({ p: 'blot', x: r1(p.x), y: r1(p.y), r: r1(r), rough: rough(random, 12, 0.55), color: 0x1f1810, alpha: r3(between(random, 0.55, 0.8)), soft: 0.6 });
      }
      sparks.push({ p: 'glow', x: r1(from.x), y: r1(from.y), r: r1(m * (0.05 + 0.04 * e)), color: 0x9fd0ff, core: 0xffffff, alpha: 0.7 });
    }
    const layers = [
      { canvas: 'mark', shapes: scorch, time: { delay: 120, in: 80, hold: c.time.hold, out: c.time.out } },
      { canvas: 'glint', shapes: sparks, time: { in: 30, hold: 120, out: 300 } },
    ];
    const live = [{ kind: 'arcs', items: arcs }];
    if (!lite) live.unshift({ kind: 'flash', color: 0xe8f1ff, alpha: r3(0.3 + 0.4 * e), in: 30, out: Math.round(crit ? 320 : 220) });
    return { layers, live };
  },
  acid(random, c) {
    const { W, H, m, e, n, lite, time, at } = c;
    const drops = [], shine = [], etch = [], etchMark = [], bubbles = [];
    const cx = at?.x ?? W / 2, cy = at?.y ?? H / 2;
    for (let i = 0, count = n(5 + 9 * e); i < count; i++) {
      const near = random() < 0.55, x = near ? cx + (random() - 0.5) * m * 0.5 : between(random, 0.05, 0.95) * W, y = near ? cy + (random() - 0.5) * m * 0.4 : between(random, 0.05, 0.95) * H;
      const px = Math.min(W - 4, Math.max(4, x)), py = Math.min(H - 4, Math.max(4, y)), r = m * between(random, 0.016, 0.042) * (0.7 + 0.5 * e);
      // A luminous yellow-green drop (glint) over a darker burn (mark), with a bright fleck and a few droplets.
      const drop = (dx, dy, rr) => {
        drops.push({ p: 'blot', x: r1(dx), y: r1(dy), r: r1(rr * 1.1), rough: rough(random, 12, 0.25), color: 0x5f7414, alpha: 0.6, soft: 0.5 });
        shine.push({ p: 'blot', x: r1(dx), y: r1(dy), r: r1(rr), rough: rough(random, 12, 0.22), color: 0xc2ea2e, alpha: r3(between(random, 0.5, 0.65)), soft: 0.3, rim: { color: 0xe8ff7a, alpha: 0.6, w: 1 } });
        shine.push({ p: 'glow', x: r1(dx - rr * 0.35), y: r1(dy - rr * 0.4), r: r1(rr * 0.4), color: 0xffffff, alpha: 0.7 });
      };
      drop(px, py, r);
      for (let k = 0, sat = Math.floor(random() * 3); k < sat; k++) { const a = random() * TAU, d = r * between(random, 1.4, 2.4); drop(px + Math.cos(a) * d, py + Math.sin(a) * d, r * between(random, 0.2, 0.4)); }
      etch.push({ p: 'blot', x: r1(px), y: r1(py), r: r1(r * between(random, 1.5, 2.2)), rough: rough(random, 14, 0.5), color: 0xeef3dc, alpha: r3(between(random, 0.24, 0.34)), soft: 0.85 });
      etchMark.push({ p: 'blot', x: r1(px), y: r1(py), r: r1(r * 1.35), rough: rough(random, 14, 0.45), color: 0x9aa37a, alpha: 0.5, soft: 0.7 });
      if (!lite) for (let b = 0, nb = 2 + Math.floor(random() * 3); b < nb; b++) bubbles.push({ x: r1(px + (random() - 0.5) * r * 1.2), y: r1(py + (random() - 0.5) * r * 1.2), r: r1(between(random, 1.5, Math.max(2, r * 0.3))), delay: Math.round(between(random, 80, time.in + time.hold)), life: Math.round(between(random, 260, 520)) });
    }
    const dropsTime = { in: 70, hold: Math.round(time.hold * 0.6), out: 500 };
    const etchTime = { delay: 280, in: 420, hold: Math.max(0, time.hold - 300), out: time.out };
    return {
      layers: [
        { canvas: 'mark', shapes: etchMark, time: etchTime },
        { canvas: 'mark', shapes: drops, time: dropsTime },
        { canvas: 'glint', shapes: shine, time: dropsTime },
        { canvas: 'glint', shapes: etch, time: etchTime },
      ],
      live: bubbles.length ? [{ kind: 'bubbles', items: bubbles }] : [],
    };
  },
  poison(random, c) {
    const { e, lite, time } = c, pulse = { period: 720, depth: 0.45 };
    const layers = [
      { canvas: 'mark', vignette: { color: 0x5f8a22, alpha: r3(0.55 + 0.3 * e), inner: r3(0.55 - 0.25 * e) }, time, pulse },
      { canvas: 'glint', vignette: { color: 0xc6ee5a, alpha: r3(0.16 + 0.14 * e), inner: r3(0.45 - 0.2 * e) }, time, pulse },
    ];
    const ms = endOf(time);
    const board = lite ? null : wobbleKeys(random, ms, 12, { dx: [3 + 5 * e], rot: [0.25 + 0.45 * e], blur: [0.5 + 0.9 * e, 0, false], hue: [8 + 10 * e, 0, false], saturate: [-0.15 - 0.15 * e, 1, false] });
    return { layers, live: [], board };
  },
  sonic(random, c) {
    const { W, H, m, e, n, lite, at, crit } = c;
    const x = at?.x ?? W / 2, y = at?.y ?? H / 2, reach = m * (0.45 + 0.45 * e);
    const rings = Array.from({ length: n(3 + 2 * e) }, (_, i) => ({ x: r1(x), y: r1(y), r1: r1(reach * (1 - i * 0.12)), w: r1(lerp(7, 2.5, i / 4)), delay: i * 95, life: Math.round(620 + 120 * e) }));
    const layers = [];
    if (lite) layers.push({ canvas: 'glint', shapes: rings.slice(0, 2).map((g, i) => ({ p: 'ring', x: g.x, y: g.y, r: r1(reach * (0.35 + i * 0.25)), w: g.w, color: 0xffffff, alpha: 0.3 })), time: c.time });
    if (crit) layers.push(...crackLayers(random, { x, y, R: m * 0.16, count: 5 }, c, { alpha: 0.5 }));
    const board = lite ? null : wobbleKeys(random, 520, 8, { blur: [0.5 + 1.2 * e, 0, false], scale: [0.006 + 0.008 * e, 1] }, { rise: 0.12 });
    return { layers, live: lite ? [] : [{ kind: 'rings', items: rings }], board };
  },
  force(random, c) {
    const { W, H, m, e, at, crit, subtle } = c;
    const x = at?.x ?? lerp(W * 0.3, W * 0.7, random()), y = at?.y ?? lerp(H * 0.3, H * 0.7, random());
    return { layers: crackLayers(random, { x, y, R: m * (0.18 + 0.3 * e) * (crit ? 1.2 : 1), count: subtle ? 5 : 7 + Math.round(6 * e), crit }, c), live: [] };
  },
  bludgeoning(random, c) {
    const { W, H, m, at } = c;
    return { layers: crackLayers(random, { x: at?.x ?? W / 2, y: at?.y ?? H / 2, R: m * 0.14, count: 5 }, c, { alpha: 0.75 }), live: [] };
  },
  void(random, c) {
    const { W, H, m, e, n, lite, time, lean } = c;
    const veins = [];
    for (let i = 0, count = n(10 + 14 * e); i < count; i++) {
      const p = nearEdge(random, W, H, 2, lean, 0.35);
      vein(random, veins, p.x, p.y, p.inward + (random() - 0.5) * 0.9, m * between(random, 0.08, 0.2) * (0.7 + 0.5 * e), between(random, 4, 6.5), 2);
    }
    veins.forEach((v) => Object.assign(v, { color: 0x1e0822, alpha: 0.78, halo: { w: r1(v.w * 5), color: 0x3a1446, alpha: 0.16 } }));
    const layers = [
      { canvas: 'mark', vignette: { color: 0x2e1f36, alpha: r3(0.45 + 0.35 * e), inner: r3(0.6 - 0.25 * e) }, time },
      { canvas: 'mark', shapes: veins, time, reveal: { mode: 'edges', ms: 700 } },
    ];
    const ms = endOf(time), drain = 1 - (0.45 + 0.35 * e) * (c.subtle ? 0.6 : 1);
    const board = lite ? null : [{ t: 0, saturate: 1, brightness: 1 }, { t: 220, saturate: r3(drain), brightness: r3(1 - 0.18 * e) }, { t: time.in + time.hold, saturate: r3(drain), brightness: r3(1 - 0.18 * e) }, { t: ms, saturate: 1, brightness: 1 }];
    return { layers, live: [], board };
  },
  vitality(random, c) {
    const { W, H, m, e, lite, at, crit } = c;
    const x = at?.x ?? W / 2, y = at?.y ?? H * 0.42, glare = [];
    glare.push({ p: 'glow', x: r1(W / 2), y: r1(H / 2), r: r1(Math.hypot(W, H) * 0.6), color: 0xffe6a8, alpha: r3(0.1 + 0.08 * e) });
    glare.push({ p: 'glow', x: r1(x), y: r1(y), r: r1(m * (0.6 + 0.4 * e)), color: 0xffd98a, alpha: r3(0.25 + 0.2 * e) });
    glare.push({ p: 'glow', x: r1(x), y: r1(y), r: r1(m * (0.3 + 0.35 * e)), color: 0xfff1c8, alpha: r3(0.6 + 0.35 * e), core: 0xffffff });
    glare.push({ p: 'ellipse', x: r1(x), y: r1(y), rx: r1(W * (0.3 + 0.25 * e)), ry: r1(4 + 8 * e), color: 0xfff6dc, alpha: r3(0.4 + 0.25 * e) });
    // Soft rays from the light.
    for (let i = 0, k = 6 + Math.round(4 * e), base = random() * TAU; i < k; i++) glare.push({ p: 'ellipse', x: r1(x), y: r1(y), rx: r1(m * between(random, 0.3, 0.6) * (0.7 + 0.5 * e)), ry: r1(between(random, 6, 14)), rot: r3(base + i * TAU / k + (random() - 0.5) * 0.3), color: 0xfff2c8, alpha: r3(between(random, 0.14, 0.24)) });
    // Lens ghosts along the line through the middle.
    for (let i = 1; i <= 3; i++) {
      const t = -0.35 * i, gx = lerp(x, W / 2, 1 - t), gy = lerp(y, H / 2, 1 - t);
      glare.push({ p: 'glow', x: r1(gx), y: r1(gy), r: r1(m * between(random, 0.03, 0.08)), color: i === 2 ? 0xbfe3ff : 0xffe2a0, alpha: 0.18 });
    }
    const time = { in: 70, hold: Math.round((150 + 320 * e) * (crit ? 1.5 : 1)), out: crit ? 900 : 600 };
    const board = lite ? null : [{ t: 0, brightness: 1 }, { t: 90, brightness: r3(1.12 + 0.12 * e) }, { t: endOf(time), brightness: 1 }];
    return { layers: [{ canvas: 'glint', shapes: glare, time }], live: [], board, time };
  },
  mental(random, c) {
    const { e, lite, time } = c, pulse = { period: 900, depth: 0.35 };
    const layers = [
      { canvas: 'mark', vignette: { color: 0xc2a6e2, alpha: r3(0.3 + 0.3 * e), inner: r3(0.6 - 0.2 * e) }, time, pulse },
      { canvas: 'glint', vignette: { color: 0xb07cff, alpha: r3(0.08 + 0.1 * e), inner: 0.5 }, time, pulse },
    ];
    const board = lite ? null : wobbleKeys(random, Math.round(endOf(time) * 0.9), 12, { split: [5 + 9 * e, 0, false], dx: [1.5 + 2 * e], blur: [0.3 + 0.5 * e, 0, false], hue: [3 + 4 * e] }, { rise: 0.1 });
    return { layers, live: [], board };
  },
  spirit(random, c) {
    const { W, H, m, e, n, lite, time, lean } = c;
    const wisps = Array.from({ length: n(4 + 5 * e) }, () => {
      const p = nearEdge(random, W, H, m * 0.06, lean, 0.35), a = p.inward + (random() - 0.5) * 0.9, len = m * between(random, 0.16, 0.32);
      const pts = [], bend = (random() - 0.5) * 1.6, wave = between(random, 0.06, 0.12), ph = random() * TAU;
      // A curling ribbon of mist: soft dots close together, thick at its head and thinning to a tail.
      for (let i = 0; i <= 40; i++) {
        const t = i / 40, aa = a + bend * (t - 0.5), side = Math.sin(t * 7 + ph) * len * wave;
        pts.push(r1(Math.cos(aa) * len * t - Math.sin(aa) * side), r1(Math.sin(aa) * len * t + Math.cos(aa) * side), r1(lerp(m * 0.03, m * 0.008, t) * (0.7 + 0.5 * e)));
      }
      return { x: r1(p.x), y: r1(p.y), pts, dx: r1(lite ? 0 : Math.cos(a) * m * between(random, 0.05, 0.12)), dy: r1(lite ? 0 : Math.sin(a) * m * between(random, 0.05, 0.12)), alpha: r3(between(random, 0.22, 0.4) * (0.7 + 0.5 * e)), delay: Math.round(random() * 250) };
    });
    const layers = [
      { canvas: 'mark', vignette: { color: 0xc5cfe2, alpha: r3(0.3 + 0.3 * e), inner: r3(0.6 - 0.2 * e) }, time },
      { canvas: 'glint', vignette: { color: 0xeef3ff, alpha: r3(0.1 + 0.12 * e), inner: r3(0.6 - 0.15 * e) }, time },
    ];
    const board = lite ? null : [{ t: 0, saturate: 1, hue: 0 }, { t: 260, saturate: r3(1 - 0.3 * e), hue: -8 }, { t: time.in + time.hold, saturate: r3(1 - 0.3 * e), hue: -8 }, { t: endOf(time), saturate: 1, hue: 0 }];
    return { layers, live: [{ kind: 'wisps', items: wisps, time }], board };
  },
  bleed(random, c) {
    const { e, crit } = c;
    const time = { in: 90, hold: Math.round((380 + 300 * e) * (crit ? 1.5 : 1)), out: 520 };
    return { layers: [{ canvas: 'mark', vignette: { color: 0x5c0303, alpha: r3(0.55 + 0.3 * e), inner: r3(0.62 - 0.2 * e) }, time, pulse: { period: 640, depth: 0.45 } }], live: [], time };
  },
  arcane(random, c) {
    const { W, H, m, e, n, lite, at, time } = c;
    const x = at?.x ?? W / 2, y = at?.y ?? H / 2, R = m * (0.12 + 0.18 * e);
    const count = n(14 + 18 * e);
    const sparkles = Array.from({ length: count }, (_, i) => {
      const a = i / count * TAU + (random() - 0.5) * 0.3;
      return { a: r3(a), d: r3(between(random, 0.85, 1.15)), r: r1(between(random, 3, 8) * (0.7 + 0.5 * e)), delay: Math.round(random() * 300), twinkle: r3(random() * TAU) };
    });
    const layers = [
      { canvas: 'glint', shapes: [{ p: 'ring', x: r1(x), y: r1(y), r: r1(R), w: r1(R * 0.35), color: 0xc49bff, alpha: r3(0.3 + 0.2 * e), soft: true }], time },
      { canvas: 'mark', shapes: [{ p: 'ring', x: r1(x), y: r1(y), r: r1(R * 1.05), w: r1(R * 0.5), color: 0xb79ad8, alpha: 0.35, soft: true }], time },
    ];
    return { layers, live: [{ kind: 'sparkles', x: r1(x), y: r1(y), R: r1(R), grow: lite ? 0 : 0.25, items: sparkles, time, still: lite }] };
  },
};
// Cracks as two layers: dark hairlines multiplied in, and their glint just beside them, both growing out from the
// point of impact in a blink.
function crackLayers(random, at, c, { alpha = 1 } = {}) {
  const lines = cracks(random, at);
  const time = { in: 40, hold: c.time.hold, out: c.time.out };
  const reveal = { mode: 'radial', x: r1(at.x), y: r1(at.y), r: r1(at.R * 1.1), ms: 140 };
  return [
    { canvas: 'mark', shapes: lines.map((l) => ({ ...l, color: 0x1a1d26, alpha: r3(0.75 * alpha) })), time, reveal },
    { canvas: 'glint', shapes: [{ p: 'glow', x: r1(at.x), y: r1(at.y), r: r1(at.R * 0.12), color: 0xffffff, alpha: r3(0.45 * alpha) },
      ...lines.map((l) => ({ ...l, pts: l.pts.map((v) => r1(v + 0.9)), w: r1(Math.max(0.5, l.w * 0.6)), color: 0xffffff, alpha: r3(0.6 * alpha) }))], time, reveal },
  ];
}

/**
 * The lens effect plans for a hit (lensEffectHit's answer plus view and seed): one plan per type (lensEffectTypes;
 * the second energy type a little weaker). strength 0..1 (a crit at least clearly visible and held ~1.5x longer);
 * amount 'subtle' tones it down; quality Low ('low' or amount forced Subtle by it) keeps only the static marks: no
 * particles, flicker or board filters; Off none. view: the drawing area ({ width, height }); impact: the blow's point
 * in it (null: none). Each plan: { type, strength, crit, lifeMs, time, at, layers, live, board }.
 */
export function lensEffectsFor({ types = [], strength = 0.5, crit = false, amount = 'heavy', kind = 'self', view = { width: 1, height: 1 }, impact = null, quality = 'full', seed = 'lens' } = {}) {
  const rank = qualityRank(quality);
  if (rank === 0 || !types?.length) return [];
  const W = Math.max(1, view?.width || 1), H = Math.max(1, view?.height || 1), m = Math.min(W, H), subtle = amount === 'subtle', lite = rank < 2;
  const at = impact && Number.isFinite(impact.x) && Number.isFinite(impact.y) ? { x: Math.min(W, Math.max(0, impact.x)), y: Math.min(H, Math.max(0, impact.y)) } : null;
  const lean = at ? edgeToward(at, { width: W, height: H }) : null;
  const plans = [];
  let energy = 0;
  for (const type of types.filter((t, i, all) => BUILD[t] && all.indexOf(t) === i)) {
    const physical = type === 'bleed' || type === 'bludgeoning';
    const second = !physical && energy++ > 0;
    // Any hit shows; a crit at least clearly; the hit itself scales the rest. A blow dealt is a little lighter on
    // the lens than one taken; Subtle about half.
    let e = Math.max(0.2, clamp01(strength));
    if (crit) e = Math.min(1, Math.max(0.6, e) + 0.15);
    if (kind === 'dealt') e *= 0.85;
    if (second) e *= 0.75;
    if (subtle) e *= 0.55;
    e = r3(e);
    const hold = Math.round(Math.min(1000, 420 + 580 * e) * (crit ? 1.5 : 1));
    const time = { in: 140, hold, out: crit ? 1000 : 700 };
    const random = rng(`${seed}:${type}`);
    const n = (v) => Math.max(1, Math.round(v * (subtle ? 0.5 : 1)));
    const built = BUILD[type](random, { W, H, m, e, n, at, lean, lite, subtle, crit, kind, time });
    const ptime = built.time ?? time;
    const ends = [endOf(ptime), ...built.layers.map((l) => endOf(l.time ?? ptime)), ...(built.board ?? []).map((k) => k.t),
      ...built.live.flatMap((g) => (g.items ?? []).map((i) => (i.delay ?? 0) + (i.life ?? endOf(g.time ?? ptime))))];
    plans.push({ type, strength: e, crit: crit === true, time: ptime, at, lifeMs: Math.max(...ends) + 50, layers: built.layers, live: built.live, board: built.board ?? null, lite });
  }
  return plans;
}

// The board's look at `age` ms into a plan: its keyframes eased between ({} with nothing to apply).
export function boardAt(plan, age) {
  const keys = plan?.board;
  if (!keys?.length || age < keys[0].t || age > keys.at(-1).t) return {};
  let i = 1;
  while (i < keys.length - 1 && keys[i].t < age) i++;
  const a = keys[i - 1], b = keys[i], t = smooth(b.t > a.t ? (age - a.t) / (b.t - a.t) : 1), out = {};
  for (const name of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (name === 't') continue;
    const n = NEUTRAL[name] ?? 0;
    out[name] = lerp(a[name] ?? n, b[name] ?? n, t);
  }
  return out;
}
const NEUTRAL = { saturate: 1, brightness: 1, scale: 1, blur: 0, hue: 0, split: 0, dx: 0, dy: 0, rot: 0 };
// Several plans' board looks at once: colour factors multiplied, offsets and hue added, blur and split the strongest.
export function mergeBoard(looks) {
  const out = { ...NEUTRAL };
  for (const l of looks) {
    for (const [k, v] of Object.entries(l)) {
      if (!Number.isFinite(v)) continue;
      if (k === 'saturate' || k === 'brightness' || k === 'scale') out[k] *= v;
      else if (k === 'blur' || k === 'split') out[k] = Math.max(out[k], v);
      else if (k in out) out[k] += v;
    }
  }
  return out;
}
// The inline CSS a board look comes to: { filter, transform, split } ('' each when neutral; split: px of the double
// vision filter, 0 none).
export function boardStyle(look = {}) {
  const l = { ...NEUTRAL, ...look }, f = [];
  const split = Math.abs(l.split) >= 0.3 ? Math.round(l.split * 10) / 10 : 0;
  if (split) f.push('url(#animater-lens-split)');
  if (l.blur >= 0.05) f.push(`blur(${Math.round(l.blur * 100) / 100}px)`);
  if (Math.abs(l.saturate - 1) >= 0.005) f.push(`saturate(${r3(Math.max(0, l.saturate))})`);
  if (Math.abs(l.brightness - 1) >= 0.005) f.push(`brightness(${r3(Math.max(0, l.brightness))})`);
  if (Math.abs(l.hue) >= 0.2) f.push(`hue-rotate(${r1(l.hue)}deg)`);
  const t = [];
  if (Math.abs(l.dx) >= 0.05 || Math.abs(l.dy) >= 0.05) t.push(`translate(${r1(l.dx)}px, ${r1(l.dy)}px)`);
  if (Math.abs(l.rot) >= 0.01) t.push(`rotate(${r3(l.rot)}deg)`);
  if (Math.abs(l.scale - 1) >= 0.0005) t.push(`scale(${Math.round(l.scale * 10000) / 10000})`);
  return { filter: f.join(' '), transform: t.join(' '), split };
}
