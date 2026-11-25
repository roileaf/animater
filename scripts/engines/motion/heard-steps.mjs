// Footsteps heard from a creature this screen cannot see: where each one falls, short ink strokes are struck round the
// foot, as an inker marks a thump, and run a little outward as they fade. Wider for a bigger creature, small and faint
// for one that sneaks. `vague`: the ear only places it roughly, so the mark lands off its square, looser, with no foot.

export const MAX_MARKS = 24;
// How long a mark lasts, in seconds.
export const MARK_LIFE = 1.4;

const DARK = 0x1a1410, PALE = 0xece0c8;

// A small seeded random (0–1), from any seed.
const seeded = (seed) => {
  let h = 2166136261;
  for (const ch of String(seed)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); }
  return () => { h = (Math.imul(h, 1664525) + 1013904223) >>> 0; return h / 4294967296; };
};
// Paint is laid in a few tones, not blended.
const stepped = (a, steps = 3) => Math.ceil(Math.max(0, Math.min(1, a)) * steps) / steps;

/** One mark (pure): `size` the creature's width in squares, `loud` 0–1 how well it is heard, `grid` px a square. */
export function heardStepMark({ seed = '', size = 1, sneak = false, loud = 1, vague = false, grid = 100, heading = 0 } = {}) {
  const r = seeded(seed), wide = Math.max(0.4, Number(size) || 1);
  const radius = grid * wide * (vague ? 0.7 : 0.48) * (sneak ? 0.55 : 1), weight = (0.7 + wide * 0.3) * (sneak ? 0.75 : 1) * grid / 70;
  // (A bigger foot is struck round with more strokes, or its ring would read as a few stray lines.)
  const n = 7 + Math.floor(r() * 3) + Math.round(Math.max(0, wide - 1) * 2.5), strokes = [];
  for (let i = 0; i < n; i++) strokes.push({ angle: (i / n) * Math.PI * 2 + r() * 0.5, len: radius * (0.22 + r() * 0.3), width: (1.6 + r() * 1.6) * weight });
  let dx = 0, dy = 0;
  if (vague) { const an = r() * Math.PI * 2, d = (0.5 + r() * 0.9) * grid; dx = Math.cos(an) * d; dy = Math.sin(an) * d; }
  return { strokes, radius, dx, dy, loud: Math.max(0, Math.min(1, loud)) * (sneak ? 0.45 : 1),
    smudge: vague ? null : { rx: radius * 0.2, ry: radius * 0.11, turn: Number(heading) || 0 } };
}

/** How a mark looks `k` of the way through its life (pure): each stroke from its middle, the strokes' alpha, the smudge's. */
export function heardStepLook(mark, k) {
  if (!(k < 1)) return { alpha: 0, smudge: 0, strokes: [] };
  const t = Math.max(0, k), from = mark.radius * (0.3 + 0.5 * Math.sqrt(t));
  return {
    alpha: stepped(1 - t) * mark.loud,
    smudge: mark.smudge && t < 0.5 ? stepped((0.5 - t) * 1.4) * mark.loud * 0.6 : 0,
    // Seen from above, drawn a touch flat, as everything on the floor is.
    strokes: mark.strokes.map((s) => { const c = Math.cos(s.angle), sn = Math.sin(s.angle) * 0.94; return { x1: c * from, y1: sn * from, x2: c * (from + s.len), y2: sn * (from + s.len), width: s.width }; }),
  };
}

/** The layer: add({ x, y, size, sneak, loud, heading, vague, seed }) strikes a mark there now; tick(seconds); clear(). */
export function createHeardSteps({ PIXI, root, grid = () => 100 }) {
  let g = null, marks = [];
  const make = () => { g = new PIXI.Graphics(); g.eventMode = 'none'; root().addChild(g); };
  const draw = () => {
    g.clear();
    for (const m of marks) {
      const look = heardStepLook(m.mark, m.age / MARK_LIFE), x = m.x + m.mark.dx, y = m.y + m.mark.dy;
      if (!(look.alpha > 0)) continue;
      // A dark line with a pale core: it reads on the dark of a place unseen and on a lit floor alike.
      for (const [color, widen, alpha] of [[DARK, 2.2, look.alpha * 0.55], [PALE, 1, look.alpha]]) for (const s of look.strokes) {
        g.lineStyle({ width: s.width * widen, color, alpha, cap: 'round' }); g.moveTo(x + s.x1, y + s.y1); g.lineTo(x + s.x2, y + s.y2);
      }
      if (look.smudge > 0) { const f = m.mark.smudge, c = Math.cos(f.turn), sn = Math.sin(f.turn);
        g.lineStyle({ width: 0 }); g.beginFill(PALE, look.smudge);
        // (An ellipse turned along the way it walks, as a few points: Graphics has no turned ellipse.)
        for (let i = 0; i <= 12; i++) { const a = (i / 12) * Math.PI * 2, px = Math.cos(a) * f.rx, py = Math.sin(a) * f.ry; g[i ? 'lineTo' : 'moveTo'](x + px * c - py * sn, y + px * sn + py * c); }
        g.endFill(); }
    }
  };
  const clear = () => { try { g?.parent?.removeChild(g); g?.destroy(); } catch { /* gone */ } g = null; marks = []; };
  return {
    add({ x, y, size = 1, sneak = false, loud = 1, heading = 0, vague = false, seed = '' } = {}) {
      if (!g || g.destroyed) make();
      marks.push({ x, y, age: 0, mark: heardStepMark({ seed, size, sneak, loud, vague, heading, grid: grid() }) });
      if (marks.length > MAX_MARKS) marks.splice(0, marks.length - MAX_MARKS);
    },
    tick(seconds) {
      if (!g || !marks.length) return;
      for (const m of marks) m.age += seconds;
      marks = marks.filter((m) => m.age < MARK_LIFE);
      draw();
    },
    clear,
    get busy() { return marks.length > 0; },
    get count() { return marks.length; },
  };
}
