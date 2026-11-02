// Tokenshade tethers: what a travel or projectile stage draws itself instead of a JB2A clip, where JB2A has no fitting
// one. A rope, vine, chain, burning chain or tongue reaches from the caster to the target, holds and draws back; a
// snare, silk wad or bola is thrown along the line and lands; motes stream from one end to the other. Every client
// draws it from the tag on the stage's effect (runtime.mjs), for as long as that effect plays, on its own screen.

import { tetherArt } from './tether-art.mjs';

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

// The drawing (tether-art.mjs): one container per tether over the tokens, placed each frame. `add(key, tag, ends)`
// with `ends() => ({ a, b, grid, visible })` read live (the ends follow the drawn tokens); `remove(key)`; `tick(nowMs)`.
export function createTethers({ PIXI, root }) {
  const tethers = new Map();
  const drop = (t) => { try { if (!t.art.root.destroyed) t.art.root.destroy({ children: true }); } catch { /* gone with the canvas */ } };
  function draw(t, now) {
    const { a, b, grid = 100, visible = true } = t.ends() ?? {};
    const st = tetherState(t.tag.style, now - t.start, t.tag.ms);
    t.art.root.visible = Boolean(visible && a && b && st && st.alpha > 0);
    if (!t.art.root.visible) return;
    // How far a thrown thing has settled since it landed, a rope since it reached (0..1 over a sixth of its time).
    const frac = (now - t.start) / t.tag.ms;
    st.settle = Math.min(1, Math.max(0, (frac - 0.62) / 0.15));
    const time = (now - t.start) / 1000;
    // A point along the line, pushed `off` pixels across it.
    const along = (u, off = 0) => { const p = tetherPoint(a, b, u, time, { sag: 0.04, seed: t.seed }); return { x: p.x + p.nx * off, y: p.y + p.ny * off }; };
    t.art.draw({ a, b, grid, st, t: time, along, color: Number.isFinite(t.tag.color) ? t.tag.color : undefined });
  }
  return {
    add(key, tag, ends, now = performance.now()) {
      if (!tetherStyle(tag?.style) || !(tag.ms > 0)) return;
      this.remove(key);
      const art = tetherArt(PIXI, tag.style, tetherStyle(tag.style).color);
      root()?.addChild(art.root);
      tethers.set(key, { art, tag, ends, start: now, seed: hash(String(key)) * TAU });
    },
    remove(key) { const t = tethers.get(key); if (t) { drop(t); tethers.delete(key); } },
    tick(now = performance.now()) {
      for (const [key, t] of tethers) {
        if (t.art.root.destroyed || now - t.start > t.tag.ms + 500) { this.remove(key); continue; }
        if (t.art.root.parent !== root()) root()?.addChild(t.art.root);
        try { draw(t, now); } catch (error) { console.warn('Animater tether:', error); this.remove(key); }
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
  // Hidden until its first frame is drawn, so it never shows a blank (white) canvas.
  Object.assign(view.style, { position: 'absolute', inset: '0', width: `${w}px`, height: `${h}px`, pointerEvents: 'none', zIndex: '2', visibility: 'hidden' });
  scene.appendChild(view);
  const tethers = createTethers({ PIXI, root: () => app.stage });
  const ends = () => {
    const s = scene.querySelector('.an-tokenfx-sample')?.getBoundingClientRect(), r = scene.getBoundingClientRect();
    const a = s ? { x: s.left - r.left + s.width / 2, y: s.top - r.top + s.height / 2 } : { x: w * 0.25, y: h / 2 };
    // The far end sits down and to the right of the sample, clear of the edges.
    return { a, b: { x: w * 0.72, y: Math.min(h * 0.8, a.y + h * 0.42) }, grid: Math.max(40, (s?.width ?? 120) * 0.7), visible: true };
  };
  let frame = 0, began = performance.now(), stopped = false;
  tethers.add('preview', { style, ms }, ends, began);
  const tick = () => {
    if (stopped) return;
    const now = performance.now();
    if (now - began > ms + pauseMs) { began = now; tethers.add('preview', { style, ms }, ends, now); }
    tethers.tick(now);
    app.render();
    view.style.visibility = "visible";
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
