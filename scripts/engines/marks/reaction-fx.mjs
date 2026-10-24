// Element reaction visuals: steam, smoke, a flare, crackling arcs and sizzle bubbles, drawn procedurally into one
// PIXI Graphics per reaction and redrawn each frame from its seed (no assets). PIXI is passed in.
import { seededRandom } from '../fragments/fragments.mjs';

const ease = (k) => 1 - (1 - k) ** 2;

// Puffs that rise and grow as they fade: steam is white and climbs, smoke is grey and spreads low.
function puffs(random, radius, { count, rise, grow, color, alpha }) {
  const list = Array.from({ length: count }, () => ({
    x: (random() * 2 - 1) * radius * 0.7, y: (random() * 2 - 1) * radius * 0.4,
    r: radius * (0.18 + 0.14 * random()), drift: (random() - 0.5) * radius * 0.5,
    start: random() * 0.35, rise: rise * (0.7 + 0.6 * random()),
  }));
  return (g, k) => {
    for (const p of list) {
      const local = (k - p.start) / (1 - p.start);
      if (local <= 0 || local >= 1) continue;
      const e = ease(local);
      g.beginFill(color, alpha * Math.sin(Math.PI * local));
      g.drawCircle(p.x + p.drift * e, p.y - p.rise * radius * e, p.r * (1 + grow * e));
      g.endFill();
    }
  };
}

// A burst of green fire ringed with orange, swelling and gone in a blink.
function flare(random, radius) {
  const tongues = Array.from({ length: 9 }, (_, i) => ({ a: (i / 9) * 2 * Math.PI + random() * 0.4, d: 0.5 + 0.4 * random(), r: 0.2 + 0.15 * random() }));
  return (g, k) => {
    const fade = 1 - k, size = radius * (0.5 + 0.8 * ease(k));
    g.beginFill(0xff8a1e, 0.35 * fade);
    g.drawCircle(0, 0, size);
    g.endFill();
    for (const t of tongues) {
      g.beginFill(0x7dff3a, 0.5 * fade);
      g.drawCircle(Math.cos(t.a) * size * t.d, Math.sin(t.a) * size * t.d, radius * t.r * (1 - 0.5 * k));
      g.endFill();
    }
    g.beginFill(0xfff2a0, 0.6 * fade);
    g.drawCircle(0, 0, size * 0.35);
    g.endFill();
  };
}

// Jagged blue-white bolts from the mark to each target, re-forked a few times a second.
function arcs(seed, radius, targets) {
  const ends = targets.length ? targets : [0, 1, 2].map((i) => ({ dx: Math.cos(i * 2.1) * radius, dy: Math.sin(i * 2.1) * radius }));
  return (g, k, at) => {
    const random = seededRandom((seed + Math.floor(k * 8) * 7919) >>> 0);
    const fade = k < 0.7 ? 1 : (1 - k) / 0.3;
    for (const end of ends) {
      const dx = end.dx ?? end.x - at.x, dy = end.dy ?? end.y - at.y, len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len, ny = dx / len, steps = Math.max(4, Math.round(len / 18));
      const points = [[0, 0]];
      for (let i = 1; i < steps; i++) {
        const along = i / steps, jag = (random() * 2 - 1) * Math.min(18, len * 0.12);
        points.push([dx * along + nx * jag, dy * along + ny * jag]);
      }
      points.push([dx, dy]);
      for (const [width, color, alpha] of [[5, 0x4f7dff, 0.35], [1.8, 0xeaf2ff, 0.95]]) {
        g.lineStyle(width, color, alpha * fade);
        g.moveTo(points[0][0], points[0][1]);
        for (const [x, y] of points.slice(1)) g.lineTo(x, y);
      }
    }
    g.lineStyle(0);
  };
}

// Small yellow-green bubbles swelling and popping across the frost.
function bubbles(random, radius) {
  const list = Array.from({ length: 16 }, () => {
    const a = random() * 2 * Math.PI, d = radius * 0.8 * Math.sqrt(random());
    return { x: Math.cos(a) * d, y: Math.sin(a) * d, r: 3 + 5 * random(), start: random() * 0.6, life: 0.25 + 0.2 * random() };
  });
  return (g, k) => {
    for (const b of list) {
      const local = (k - b.start) / b.life;
      if (local <= 0 || local >= 1) continue;
      g.lineStyle(1.5, 0xe4ff9a, 0.8 * (1 - local));
      g.beginFill(0xb6d84a, 0.25 * (1 - local));
      g.drawCircle(b.x, b.y, b.r * (0.4 + 0.6 * local));
      g.endFill();
    }
    g.lineStyle(0);
  };
}

function drawerFor(reaction, random) {
  const { kind, radius, seed } = reaction;
  switch (kind) {
    case 'steam': return puffs(random, radius, { count: 14, rise: 1.6, grow: 1.2, color: 0xf4f8ff, alpha: 0.55 });
    case 'smoke': return puffs(random, radius, { count: 12, rise: 0.6, grow: 1.6, color: 0x6c6a68, alpha: 0.5 });
    case 'flare': return flare(random, radius);
    case 'arcs': return arcs(seed, radius, reaction.targets ?? []);
    case 'bubbles': return bubbles(random, radius);
    default: return null;
  }
}

/**
 * One reaction's display (`display`, placed at the reaction's point) and its clock: `update(t)` redraws it and says
 * whether it is still running; `destroy()` takes it off. `startAt` is when it began.
 */
export function reactionVisual(PIXI, reaction, startAt) {
  const g = new PIXI.Graphics();
  g.eventMode = 'none';
  g.position.set(reaction.at.x, reaction.at.y);
  if (reaction.kind === 'flare' || reaction.kind === 'arcs') g.blendMode = PIXI.BLEND_MODES?.ADD ?? g.blendMode;
  const draw = drawerFor(reaction, seededRandom(reaction.seed));
  const duration = reaction.durationMs > 0 ? reaction.durationMs : 1000;
  return {
    display: g,
    update(t) {
      const k = (t - startAt) / duration;
      if (!draw || k >= 1 || g.destroyed) return false;
      g.clear();
      if (k > 0) draw(g, k, reaction.at);
      return true;
    },
    destroy() {
      if (!g.destroyed) g.destroy();
    },
  };
}
