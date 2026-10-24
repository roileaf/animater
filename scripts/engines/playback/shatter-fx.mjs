// The dispel shatter: a lasting effect breaks into glassy shards that burst out from its centre, slow, tumble and
// fade over SHATTER_MS, with a brief flash. Drawn procedurally into one PIXI Graphics, redrawn each frame from its
// seed (the effect's id), so every screen breaks it the same way. PIXI is passed in.
import { seededRandom } from '../fragments/fragments.mjs';

export const SHATTER_MS = 700;
const FLASH = 0.18;
const DEFAULT_TINT = 0xdcecff;
const MAX_SHARDS = 40;

export const shatterSeed = (id) => [...String(id ?? '')].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);

// The effect's tint (a number, "#rrggbb" or a Color), else pale blue-white glass.
export function shardTint(tint) {
  if (typeof tint === 'string') {
    const m = /^#?([0-9a-f]{6})$/i.exec(tint.trim());
    return m ? parseInt(m[1], 16) : DEFAULT_TINT;
  }
  const n = Number(tint?.valueOf?.() ?? tint);
  return Number.isInteger(n) && n >= 0 && n <= 0xffffff && tint !== null && tint !== undefined ? n : DEFAULT_TINT;
}

// Where an effect sat: its sprite's screen bounds back in canvas space (stage translation tx/ty, scale).
export function spotFromBounds(bounds, { tx = 0, ty = 0, scale = 1 } = {}) {
  if (!bounds || !(scale > 0)) return null;
  const w = Number(bounds.width) / scale, h = Number(bounds.height) / scale;
  if (!(w > 0) || !(h > 0)) return null;
  return { x: (Number(bounds.x) - tx) / scale + w / 2, y: (Number(bounds.y) - ty) / scale + h / 2, radius: Math.max(w, h) / 2 };
}

// Triangular shards across the effect's disc: each a triangle (x0,y0,x1,y1,x2,y2 around its own centre) placed at
// its slice of the disc, flying outward (dx, dy: its full travel) and spinning.
export function shardGeometry(seed, radius) {
  const random = seededRandom(seed);
  const r = Math.max(10, Number(radius) || 50);
  const count = Math.min(MAX_SHARDS, Math.max(12, Math.round(r / 6)));
  return Array.from({ length: count }, (_, i) => {
    const a = (i / count) * 2 * Math.PI + random() * 0.5;
    const d = r * (0.15 + 0.75 * Math.sqrt(random()));
    const size = r * (0.08 + 0.12 * random());
    const points = [0, 1, 2].flatMap((j) => {
      const pa = a + j * 2.1 + (random() - 0.5) * 0.9, pr = size * (0.6 + 0.6 * random());
      return [Math.cos(pa) * pr, Math.sin(pa) * pr];
    });
    const travel = r * (0.6 + 0.9 * random());
    return {
      x: Math.cos(a) * d, y: Math.sin(a) * d, points,
      dx: Math.cos(a) * travel, dy: Math.sin(a) * travel,
      spin: (random() - 0.5) * 9, shade: 0.75 + 0.25 * random(), delay: random() * 0.08,
    };
  });
}

const ease = (k) => 1 - (1 - k) ** 3;
// A shade of the tint toward white, for the glint on each shard's face.
const lighten = (c, f) => {
  const ch = (s) => Math.round(((c >> s) & 255) + (255 - ((c >> s) & 255)) * f);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
};

/**
 * One shatter's display (`display`, placed at the effect's centre) and its clock: `update(t)` redraws it and says
 * whether it is still running; `destroy()` takes it off. `spec`: {at, radius, tint, seed}.
 */
export function shatterVisual(PIXI, spec, startAt) {
  const g = new PIXI.Graphics();
  g.eventMode = 'none';
  g.position.set(spec.at.x, spec.at.y);
  const radius = Math.max(10, Number(spec.radius) || 50);
  const shards = shardGeometry(spec.seed >>> 0, radius);
  const tint = shardTint(spec.tint), glint = lighten(tint, 0.6);
  return {
    display: g,
    update(t) {
      const k = (t - startAt) / SHATTER_MS;
      if (k >= 1 || g.destroyed) return false;
      g.clear();
      if (k < 0) return true;
      if (k < FLASH) {
        const f = 1 - k / FLASH;
        g.beginFill(glint, 0.45 * f);
        g.drawCircle(0, 0, radius * (0.6 + 0.5 * (1 - f)));
        g.endFill();
      }
      for (const s of shards) {
        const local = Math.max(0, (k - s.delay) / (1 - s.delay));
        const e = ease(local), fade = (1 - local) ** 1.4;
        // Burst out and slow down, with a little drop as it slows.
        const x = s.x + s.dx * e, y = s.y + s.dy * e + radius * 0.25 * local * local;
        const angle = s.spin * e, cos = Math.cos(angle), sin = Math.sin(angle);
        const pts = [];
        for (let i = 0; i < 6; i += 2) pts.push(x + s.points[i] * cos - s.points[i + 1] * sin, y + s.points[i] * sin + s.points[i + 1] * cos);
        g.lineStyle(1, glint, 0.8 * fade);
        g.beginFill(tint, 0.7 * s.shade * fade);
        g.drawPolygon(pts);
        g.endFill();
      }
      g.lineStyle(0);
      return true;
    },
    destroy() {
      if (!g.destroyed) g.destroy();
    },
  };
}

// Shatters on this client: `spawn(spec)` draws one and returns `{ update(t), destroy() }`. At most `max` at once;
// past that a shatter is skipped. Runs on the PIXI ticker and never throws.
export function createShatterHost({ spawn, now = () => performance.now(), max = 12, enabled = () => true }) {
  let active = [];
  const drop = (handle) => { try { handle.destroy(); } catch { /* already gone */ } };
  return {
    play(spec) {
      try {
        if (!enabled() || active.length >= max) return false;
        const handle = spawn(spec);
        if (!handle) return false;
        active.push(handle);
        return true;
      } catch (err) {
        console.warn('Animater | skipped a dispel shatter', err);
        return false;
      }
    },
    tick() {
      if (!active.length) return;
      let t;
      try { t = now(); } catch { return; }
      active = active.filter((handle) => {
        let alive;
        try { alive = handle.update(t); } catch { alive = false; }
        if (!alive) drop(handle);
        return alive;
      });
    },
    clear() {
      for (const handle of active) drop(handle);
      active = [];
    },
    count() { return active.length; },
  };
}
