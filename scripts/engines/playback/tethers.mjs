// Tokenshade tethers: what a travel or projectile stage draws itself instead of a JB2A clip, where JB2A has no fitting
// one. A rope, vine, chain, burning chain or tongue reaches from the caster to the target, holds and draws back; a
// snare, silk wad or bola is thrown along the line and lands; motes stream from one end to the other. Every client
// draws it from the tag on the stage's effect (runtime.mjs), for as long as that effect plays, on its own screen.

const TAU = Math.PI * 2;
export const TETHER_STYLES = Object.freeze({
  rope: { kind: 'reach', color: 0xb08a5a, width: 0.05 },
  vine: { kind: 'reach', color: 0x3f6a22, width: 0.08, whip: true },
  chain: { kind: 'reach', color: 0x9aa0a8, width: 0.05 },
  'burning-chain': { kind: 'reach', color: 0xff7a1e, width: 0.05, burning: true },
  tongue: { kind: 'reach', color: 0xd96a7a, width: 0.09, whip: true },
  snare: { kind: 'thrown', color: 0xb89a6a, width: 0.03 },
  silk: { kind: 'thrown', color: 0xf2f0ea, width: 0.03 },
  bola: { kind: 'thrown', color: 0x8a7a64, width: 0.035 },
  motes: { kind: 'stream', color: 0xe6e0ff, width: 0.035 },
});
export const tetherStyle = (name) => TETHER_STYLES[name] ?? null;

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const easeOut = (t) => 1 - (1 - t) ** 3;

// How far along the line it shows at `elapsed` of `ms`: a reaching one shoots out (a third of its time), holds and
// draws back over the last quarter (a whip snaps back faster); a thrown one flies (most of its time) and stays where
// it lands. `{ reach }` 0..1 from the caster, `{ head }` 0..1 where a thrown thing is, `alpha` how much of it shows.
export function tetherState(style, elapsed, ms) {
  const s = tetherStyle(style), t = clamp01(elapsed / Math.max(1, ms));
  if (!s) return null;
  if (s.kind === 'reach') {
    const out = easeOut(clamp01(t / 0.32)), back = clamp01((t - (s.whip ? 0.82 : 0.75)) / (s.whip ? 0.18 : 0.25));
    return { reach: out * (1 - back * back), alpha: 1 - clamp01((t - 0.94) / 0.06) };
  }
  if (s.kind === 'thrown') {
    const fly = clamp01(t / 0.62);
    return { head: fly * fly * (3 - 2 * fly), landed: fly >= 1, alpha: 1 - clamp01((t - 0.85) / 0.15) };
  }
  return { reach: 1, alpha: Math.min(clamp01(t / 0.12), 1 - clamp01((t - 0.85) / 0.15)) };
}

// A point `u` (0 from … 1 to) along the line, bowed a little across it and wavering at `time` (seconds).
export function tetherPoint(a, b, u, time = 0, { sag = 0.06, wave = 0, seed = 0 } = {}) {
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
  const bow = Math.sin(Math.PI * u) * (len * sag + wave * Math.sin(u * 7 + time * 6 + seed));
  return { x: a.x + dx * u + nx * bow, y: a.y + dy * u + ny * bow, nx, ny, len };
}

const hash = (text) => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
};

// The drawing: one Graphics per tether over the tokens, redrawn each frame. `add(key, tag, ends)` with
// `ends() => ({ a, b, grid, visible })` read live (the ends follow the drawn tokens); `remove(key)`; `tick(nowMs)`.
export function createTethers({ PIXI, root }) {
  const tethers = new Map();
  const drop = (t) => { try { if (!t.g.destroyed) t.g.destroy(); } catch { /* gone with the canvas */ } };
  function line(g, pts, width, color, alpha) {
    if (pts.length < 2) return;
    g.lineStyle({ width, color, alpha, cap: 'round', join: 'round' });
    g.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
    g.lineStyle(0);
  }
  function draw(t, now) {
    const { a, b, grid = 100, visible = true } = t.ends() ?? {};
    const g = t.g;
    g.clear();
    if (!visible || !a || !b) return;
    const s = tetherStyle(t.tag.style), st = tetherState(t.tag.style, now - t.start, t.tag.ms);
    if (!s || !st || st.alpha <= 0) return;
    const color = Number.isFinite(t.tag.color) ? t.tag.color : s.color, w = Math.max(1.5, s.width * grid), time = (now - t.start) / 1000;
    const at = (u, opts) => tetherPoint(a, b, u, time, { seed: t.seed, ...opts });
    if (s.kind === 'reach') {
      const n = 28, reach = st.reach, pts = [];
      const opts = { sag: t.tag.style === 'tongue' ? 0.02 : 0.05, wave: s.whip ? grid * 0.08 * (1 - reach) : grid * 0.02 };
      for (let i = 0; i <= n; i++) pts.push(at((i / n) * reach, opts));
      if (s.burning) line(g, pts, w * 2.6, 0xff4a00, 0.25 * st.alpha);
      if (t.tag.style === 'tongue') {
        // Fleshy and tapering: thick at the mouth, a rounded tip.
        for (let i = 1; i < pts.length; i++) line(g, [pts[i - 1], pts[i]], w * (1.2 - 0.6 * (i / n)), color, st.alpha);
        const tip = pts[pts.length - 1];
        g.beginFill(color, st.alpha); g.drawCircle(tip.x, tip.y, w * 0.6); g.endFill();
      } else if (t.tag.style === 'chain' || s.burning) {
        // Links: alternate rings face on and edge on, one every link length.
        const len = pts[0].len * reach, step = w * 1.6, count = Math.max(1, Math.floor(len / step));
        g.lineStyle({ width: Math.max(1, w * 0.32), color: s.burning ? 0xffd27a : color, alpha: st.alpha });
        for (let i = 0; i < count; i++) {
          const p = at(((i + 0.5) / count) * reach, opts), ang = Math.atan2(b.y - a.y, b.x - a.x);
          if (i % 2) { g.moveTo(p.x - Math.cos(ang) * step * 0.45, p.y - Math.sin(ang) * step * 0.45); g.lineTo(p.x + Math.cos(ang) * step * 0.45, p.y + Math.sin(ang) * step * 0.45); }
          else g.drawEllipse(p.x, p.y, step * 0.55, w * 0.55);
        }
        g.lineStyle(0);
      } else {
        line(g, pts, w, color, st.alpha);
        if (t.tag.style === 'rope') {
          // The twist of its strands.
          g.lineStyle({ width: Math.max(1, w * 0.25), color: 0x5a4028, alpha: 0.7 * st.alpha });
          for (let i = 1; i < n; i += 1) {
            const p = pts[i];
            if (!p) continue;
            g.moveTo(p.x - p.nx * w * 0.45 - p.ny * w * 0.3, p.y - p.ny * w * 0.45 + p.nx * w * 0.3);
            g.lineTo(p.x + p.nx * w * 0.45 + p.ny * w * 0.3, p.y + p.ny * w * 0.45 - p.nx * w * 0.3);
          }
          g.lineStyle(0);
        }
        if (t.tag.style === 'vine') {
          // Leaves along it, alternating sides, and thorns.
          for (let i = 2; i < n; i += 3) {
            const p = pts[i]; if (!p) continue;
            const side = i % 2 ? 1 : -1;
            g.beginFill(0x6f9a3a, st.alpha); g.drawEllipse(p.x + p.nx * w * 1.1 * side, p.y + p.ny * w * 1.1 * side, w * 0.9, w * 0.45); g.endFill();
          }
        }
      }
      // A rope that has reached coils round the target.
      if (t.tag.style === 'rope' && reach > 0.98) {
        g.lineStyle({ width: Math.max(1, w * 0.8), color, alpha: st.alpha });
        g.drawEllipse(b.x, b.y, grid * 0.38, grid * 0.3);
        g.lineStyle(0);
      }
    } else if (s.kind === 'thrown') {
      const p = at(st.head, { sag: -0.12 }), spin = time * TAU * 2.2;
      if (t.tag.style === 'bola') {
        // Two weights on a cord, end over end.
        const r = grid * 0.3, q1 = { x: p.x + Math.cos(spin) * r, y: p.y + Math.sin(spin) * r }, q2 = { x: p.x - Math.cos(spin) * r, y: p.y - Math.sin(spin) * r };
        line(g, [q1, q2], Math.max(1, w), color, st.alpha);
        g.beginFill(0x4a4038, st.alpha); g.drawCircle(q1.x, q1.y, grid * 0.1); g.drawCircle(q2.x, q2.y, grid * 0.1); g.endFill();
      } else if (t.tag.style === 'snare') {
        // A loop of cord tumbling, a sprung jaw on it.
        g.lineStyle({ width: Math.max(1, w), color, alpha: st.alpha });
        g.drawEllipse(p.x, p.y, grid * 0.2 * Math.abs(Math.cos(spin)) + grid * 0.05, grid * 0.2);
        g.lineStyle({ width: Math.max(1, w * 1.2), color: 0x6a6a70, alpha: st.alpha });
        g.moveTo(p.x - grid * 0.12, p.y); g.lineTo(p.x + grid * 0.12, p.y);
        g.lineStyle(0);
      } else {
        // A wad of silk, a trailing strand back to the thrower; once landed it unfurls into threads.
        line(g, [at(0, { sag: -0.12 }), p], Math.max(1, w * 0.4), color, 0.5 * st.alpha);
        if (!st.landed) { g.beginFill(color, st.alpha); g.drawCircle(p.x, p.y, grid * 0.12); g.endFill(); }
        else {
          g.lineStyle({ width: Math.max(1, w * 0.5), color, alpha: st.alpha });
          for (let i = 0; i < 8; i++) { const ang = (i / 8) * TAU + t.seed; g.moveTo(b.x, b.y); g.lineTo(b.x + Math.cos(ang) * grid * 0.45, b.y + Math.sin(ang) * grid * 0.45); }
          g.drawCircle(b.x, b.y, grid * 0.25);
          g.lineStyle(0);
        }
      }
    } else {
      // Motes streaming from one end to the other, each fading in and out on its way.
      const count = 9;
      for (let i = 0; i < count; i++) {
        const u = ((time * 0.6 + i / count + t.seed) % 1 + 1) % 1, p = at(u, { sag: 0.04, wave: grid * 0.05 });
        const alpha = Math.sin(Math.PI * u) * st.alpha;
        g.beginFill(color, alpha * 0.35); g.drawCircle(p.x, p.y, w * 1.8); g.endFill();
        g.beginFill(color, alpha); g.drawCircle(p.x, p.y, w * 0.7); g.endFill();
      }
    }
  }
  return {
    add(key, tag, ends, now = performance.now()) {
      if (!tetherStyle(tag?.style) || !(tag.ms > 0)) return;
      this.remove(key);
      const g = new PIXI.Graphics();
      g.eventMode = 'none';
      root()?.addChild(g);
      tethers.set(key, { g, tag, ends, start: now, seed: hash(String(key)) * TAU });
    },
    remove(key) { const t = tethers.get(key); if (t) { drop(t); tethers.delete(key); } },
    tick(now = performance.now()) {
      for (const [key, t] of tethers) {
        if (t.g.destroyed || now - t.start > t.tag.ms + 500) { this.remove(key); continue; }
        if (t.g.parent !== root()) root()?.addChild(t.g);
        try { draw(t, now); } catch { this.remove(key); }
      }
    },
    clear() { for (const key of [...tethers.keys()]) this.remove(key); },
    get size() { return tethers.size; },
  };
}

// The styles as the Tokenshade studio lists them, with what each is for.
export const TETHER_LABELS = Object.freeze({
  rope: ['Rope', 'Lashes out, holds, coils round the target'],
  vine: ['Vine', 'A leafy vine whips out and snaps back'],
  chain: ['Chain', 'Links reach out and hold'],
  'burning-chain': ['Burning chain', 'Glowing links in a haze of fire'],
  tongue: ['Tongue', 'A fleshy tongue lashes out and snaps back'],
  snare: ['Snare', 'A tumbling loop of cord with a sprung jaw'],
  silk: ['Silk wad', 'A wad of silk that unfurls into threads where it lands'],
  bola: ['Bola', 'Two weights on a cord, end over end'],
  motes: ['Stream of motes', 'Motes flowing from one end to the other (a drain, a transfer)'],
});

// The studio's preview: the style played over and over from the sample token (`.an-tokenfx-sample` in `scene`) to a
// spot across the stage, on its own small canvas laid over the scene. `stop()` ends it.
export function createTetherPreview({ PIXI, scene, style, pauseMs = 700, ms = 2600 }) {
  if (!PIXI?.Application || !scene || !tetherStyle(style)) return null;
  const box = scene.getBoundingClientRect(), w = Math.max(80, Math.round(box.width)), h = Math.max(80, Math.round(box.height));
  const app = new PIXI.Application({ width: w, height: h, backgroundAlpha: 0, antialias: true, autoStart: false });
  const view = app.view;
  Object.assign(view.style, { position: 'absolute', inset: '0', width: `${w}px`, height: `${h}px`, pointerEvents: 'none', zIndex: '2' });
  scene.appendChild(view);
  const tethers = createTethers({ PIXI, root: () => app.stage });
  const ends = () => {
    const s = scene.querySelector('.an-tokenfx-sample')?.getBoundingClientRect(), r = scene.getBoundingClientRect();
    const a = s ? { x: s.left - r.left + s.width / 2, y: s.top - r.top + s.height / 2 } : { x: w * 0.25, y: h / 2 };
    // The sample stands in the middle: the far end is near the right edge, a little lower.
    return { a, b: { x: w * 0.9, y: a.y + h * 0.08 }, grid: Math.max(40, (s?.width ?? 120) * 0.7), visible: true };
  };
  let frame = 0, began = performance.now(), stopped = false;
  tethers.add('preview', { style, ms }, ends, began);
  const tick = () => {
    if (stopped) return;
    const now = performance.now();
    if (now - began > ms + pauseMs) { began = now; tethers.add('preview', { style, ms }, ends, now); }
    tethers.tick(now);
    app.render();
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  return { stop() { stopped = true; cancelAnimationFrame(frame); tethers.clear(); try { app.destroy(true, { children: true }); } catch { /* already gone */ } } };
}

// The tag a stage carries for every client (runtime.mjs): its style, colour, how long it plays and its two ends,
// a token by id (followed while it moves) or a fixed point. null: the stage plays its clip.
export function tetherTag(stage, ms) {
  const style = stage?.tetherStyle ?? 'rope';
  if (stage?.travelLook !== 'tokenshade' || !tetherStyle(style) || !['travel', 'projectile'].includes(stage.kind)) return null;
  const ref = (p) => {
    const id = p?.document?.id ?? (typeof p?.id === 'string' && p?.center ? p.id : null);
    if (id) return { token: id };
    const at = p?.center ?? p;
    return Number.isFinite(at?.x) && Number.isFinite(at?.y) ? { x: at.x, y: at.y } : null;
  };
  const from = ref(stage.flightFrom ?? stage.origin), to = ref(stage.flightTo ?? stage.landing ?? stage.endpoint);
  if (!from || !to || !(ms > 0)) return null;
  const tint = stage.tintEnabled && /^#[0-9a-f]{6}$/i.test(stage.tint ?? '') ? parseInt(stage.tint.slice(1), 16) : null;
  return { style, ms, from, to, ...(tint !== null ? { color: tint } : {}) };
}
