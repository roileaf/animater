// Dust shaken from the ceiling: a heavy step (or any jolt) under a roof shakes grit and dust down around it, falling a
// moment, then settling on the floor and fading. A handful of short-lived sprites per jolt, drawn over the creatures.

const rng = (seed) => { let h = 2166136261; for (const c of String(seed)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; }; };

// What one jolt shakes down (pure): grit specks and soft dust puffs around `at`, more and wider the heavier it is
// (`weight` 4 Large – 8 Gargantuan, as the footfalls'). Each: where it lands (x, y), its size, when it starts falling
// (delay, s), how long it falls (fall, s) and lies (lie, s), and whether it is a puff of dust.
export function ceilingFall({ at = { x: 0, y: 0 }, weight = 4, grid = 100, seed = 'jolt' } = {}) {
  const random = rng(seed), heavy = Math.min(1, Math.max(0, (Number(weight) - 3) / 5));
  const reach = grid * (1.2 + 2.2 * heavy), grit = Math.round(30 + 90 * heavy), puffs = Math.round(3 + 6 * heavy);
  const spot = () => { const a = random() * Math.PI * 2, r = reach * Math.sqrt(random()); return { x: at.x + Math.cos(a) * r, y: at.y + Math.sin(a) * r }; };
  const out = [];
  for (let i = 0; i < grit; i++) out.push({ ...spot(), size: grid * (0.026 + 0.034 * random()), delay: random() * 0.35, turn: random() * Math.PI, fall: 0.35 + random() * 0.45, lie: 0.6 + random() * 1.2, puff: false });
  for (let i = 0; i < puffs; i++) out.push({ ...spot(), size: grid * (0.45 + 0.4 * random()), delay: 0.1 + random() * 0.3, fall: 0.5, lie: 1.4 + random() * 0.8, puff: true });
  return out;
}

/** The layer: fall({ at, weight, grid, seed }) shakes dust down there; tick(seconds) moves it; clear(). */
export function createCeilingDust({ PIXI, root }) {
  const live = [];
  let dot = null, cloud = null;
  const textures = () => {
    if (dot && !dot.baseTexture?.destroyed) return;
    // A chip of stone: an irregular five-sided flake.
    const g = new PIXI.Graphics(); g.beginFill(0xffffff, 1); g.drawPolygon([3, 2, 12, 1, 15, 8, 10, 15, 1, 11]); g.endFill();
    dot = PIXI.RenderTexture.create({ width: 16, height: 16 });
    const c = new PIXI.Graphics(); for (let i = 12; i >= 1; i--) { c.beginFill(0xffffff, 0.09); c.drawCircle(64, 64, (64 * i) / 12); c.endFill(); }
    cloud = PIXI.RenderTexture.create({ width: 128, height: 128 });
    return [g, c];
  };
  return {
    fall(spec, renderer) {
      const made = textures();
      if (made && renderer) { renderer.render(made[0], { renderTexture: dot }); renderer.render(made[1], { renderTexture: cloud }); made.forEach((x) => x.destroy()); }
      for (const p of ceilingFall(spec)) {
        const s = new PIXI.Sprite(p.puff ? cloud : dot);
        s.anchor.set(0.5); s.tint = p.puff ? 0xe8dfcf : 0xddd2bd; if (!p.puff) s.rotation = p.turn ?? 0; s.alpha = 0; s.eventMode = 'none';
        root().addChild(s);
        live.push({ s, p, t: 0 });
      }
    },
    tick(seconds) {
      for (let i = live.length - 1; i >= 0; i--) {
        const it = live[i], { p, s } = it; it.t += seconds;
        const t = it.t - p.delay;
        if (t < 0) continue;
        if (p.puff) {
          // A puff billowing out where the dust lands, thinning away.
          const k = Math.min(1, t / (p.fall + p.lie));
          s.position.set(p.x, p.y); s.width = s.height = p.size * 2 * (0.6 + 0.9 * k); s.alpha = 0.6 * Math.sin(Math.min(1, k * 3) * Math.PI / 2) * (1 - k);
        } else if (t < p.fall) {
          // Falling: seen from above it shrinks toward the floor, from large and faint to a small sharp speck.
          const k = t / p.fall; s.position.set(p.x, p.y); s.width = s.height = p.size * (2.6 - 1.6 * k); s.alpha = 0.35 + 0.6 * k;
        } else {
          const k = (t - p.fall) / p.lie; s.position.set(p.x, p.y); s.width = s.height = p.size; s.alpha = 0.95 * (1 - k);
        }
        if (t > p.fall + p.lie) { try { s.destroy(); } catch { /* gone */ } live.splice(i, 1); }
      }
    },
    clear() { for (const { s } of live) { try { s.destroy(); } catch { /* gone */ } } live.length = 0; },
    get busy() { return live.length > 0; },
  };
}
