// Draws a broken prop's wreckage: the ground mark, the spill and splinters (from prop-wreck-layout) and the prop's own
// art cut into pieces that lie where they landed. One Container per wreck, sorted just above the tile.
import { bloodArt } from "../motion/blood-art.mjs";
import { wreckLayout, wreckTargets, collapseDust, spillExtent, BLAST_SCORCH, GRAIN_TONES, POWDER_TONES, SPINE_COLOURS, BURN_DIE_MS } from "./prop-wreck-layout.mjs";
import { BURN_MS } from "./prop-lights.mjs";
import { createPropFx } from "./prop-fx.mjs";
import { propTraits, propGuesses, BURST_DEFAULT } from "./prop-traits.mjs";
import { collapseLayout } from "./prop-collapse.mjs";
import { tipLayout, COAL_MS } from "./prop-tip.mjs";
import { createPosedPieces, tileFrame } from "./prop-pieces.mjs";
import { propSound } from "./prop-sounds.mjs";
import { seededRandom } from "../fragments/fragments.mjs";
import { tileRect, tileArtScale } from "./prop-geometry.mjs";

const FALLBACK = { mid: 0x7a6a55, dark: 0x433a2f, light: 0x9a8a72 };
const FLIGHT_MS = 1400;
const quiet = (fn) => { try { fn(); } catch { /* keep cleaning */ } };
const INK = 0x1a1410;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a, b, u) => a + (b - a) * u;
const outCubic = (u) => 1 - (1 - u) ** 3, outQuart = (u) => 1 - (1 - u) ** 4;
const span = (t, a, d) => clamp01((t - a) / d);
const shade = (c, k) => (Math.min(255, ((c >> 16) & 255) * k) << 16) | (Math.min(255, ((c >> 8) & 255) * k) << 8) | Math.min(255, (c & 255) * k);
const mix = (a, b, u) => (Math.round(lerp((a >> 16) & 255, (b >> 16) & 255, u)) << 16) | (Math.round(lerp((a >> 8) & 255, (b >> 8) & 255, u)) << 8) | Math.round(lerp(a & 255, b & 255, u));
const ms = (v) => v / FLIGHT_MS; // a share of the wreck's timeline
const fin = (v, or) => (Number.isFinite(v) ? v : or);
// A tile-local point (origin at the tile's top-left, unturned) in world px: turned about the tile's anchor at its x/y,
// as Foundry (and the wreck's stand sprite) draws the tile.
export function tileToWorld(d, centre, { x, y }) {
  const ax = fin(d.texture?.anchorX, 0.5), ay = fin(d.texture?.anchorY, 0.5), turn = ((Number(d.rotation) || 0) * Math.PI) / 180;
  const px = fin(Number(d.x), centre.x), py = fin(Number(d.y), centre.y), dx = x - ax * d.width, dy = y - ay * d.height;
  return { x: px + dx * Math.cos(turn) - dy * Math.sin(turn), y: py + dx * Math.sin(turn) + dy * Math.cos(turn) };
}

// The ground mark painted once into its own texture: each tone step is the union of its lobes, filled once with
// rounded edges, so overlapping lobes never stack into see-through polygon layers; only the outer step's silhouette
// gets the faint ink edge. `held` collects the texture for release. Door wrecks (wall-wreck.mjs) paint theirs with it too.
const css = (color, alpha) => `rgba(${(color >> 16) & 255},${(color >> 8) & 255},${color & 255},${alpha})`;
const lobePath = (ctx, pts, ox, oy, k) => {
  const n = pts.length / 2, p = (i) => [(pts[(2 * i) % pts.length] - ox) * k, (pts[(2 * i + 1) % pts.length] - oy) * k];
  const mid = (i) => { const [ax, ay] = p(i), [bx, by] = p(i + 1); return [(ax + bx) / 2, (ay + by) / 2]; };
  ctx.moveTo(...mid(n - 1));
  for (let i = 0; i < n; i++) ctx.quadraticCurveTo(...p(i), ...mid(i));
  ctx.closePath();
};
// A glass shard into Graphics g: the triangle pts (about the shard's own centre) filled pale with a faint ink edge and
// one bright edge, or, for its shadow (dark), plain black. Shared with the window wreck (wall-wreck.mjs).
export function paintShard(g, pts, colour, alpha, dark = false) {
  if (dark) { g.beginFill(0x000000, 1).drawPolygon(pts).endFill(); return; }
  g.lineStyle(0.7, INK, 0.35).beginFill(colour, alpha).drawPolygon(pts).endFill();
  g.lineStyle(0.9, 0xffffff, 0.75).moveTo(pts[0], pts[1]).lineTo(pts[2], pts[3]);
}
export function paintMark(PIXI, mark, held) {
  const xs = [], ys = [];
  for (const b of mark.blobs) for (const s of b.steps) for (const pts of s.polys) for (let i = 0; i < pts.length; i += 2) { xs.push(pts[i]); ys.push(pts[i + 1]); }
  for (const { x, y, s } of mark.ticks) { xs.push(x - s, x + s); ys.push(y - s, y + s); }
  if (!xs.length) return new PIXI.Container();
  const pad = 4, ox = Math.min(...xs) - pad, oy = Math.min(...ys) - pad, w = Math.max(...xs) + pad - ox, h = Math.max(...ys) + pad - oy;
  const k = Math.min(2, 1024 / Math.max(w, h)); // sharp when zoomed in, bounded in memory
  const c = document.createElement("canvas"); c.width = Math.ceil(w * k); c.height = Math.ceil(h * k);
  const ctx = c.getContext("2d");
  for (const b of mark.blobs) {
    b.steps.forEach((step) => {
      ctx.beginPath(); for (const pts of step.polys) lobePath(ctx, pts, ox, oy, k);
      ctx.fillStyle = css(step.color, Math.min(1, step.alpha * 1.4)); ctx.fill("nonzero");
    });
    const outer = b.steps.find((s) => s.edge);
    if (outer) {
      // The silhouette's outside half of a stroke: stroke every lobe, then cut away everything inside the union.
      const e = document.createElement("canvas"); e.width = c.width; e.height = c.height;
      const ex = e.getContext("2d");
      ex.beginPath(); for (const pts of outer.polys) lobePath(ex, pts, ox, oy, k);
      ex.lineWidth = 2 * k; ex.lineJoin = "round"; ex.strokeStyle = css(b.ink, 0.22); ex.stroke();
      ex.globalCompositeOperation = "destination-out"; ex.fillStyle = "#000"; ex.fill("nonzero");
      ctx.drawImage(e, 0, 0);
    }
  }
  if (mark.ticks.length) {
    ctx.beginPath();
    for (const { x, y, s } of mark.ticks) { const X = (x - ox) * k, Y = (y - oy) * k, S = s * k; ctx.moveTo(X - S, Y); ctx.lineTo(X + S, Y); ctx.moveTo(X, Y - S); ctx.lineTo(X, Y + S); }
    ctx.lineWidth = 1.2 * k; ctx.strokeStyle = css(0xf2f8fb, 0.5); ctx.stroke();
  }
  const tex = PIXI.Texture.from(c); held.push(tex);
  const s = new PIXI.Sprite(tex); s.position.set(ox, oy); s.scale.set(1 / k);
  return s;
}

// materialOf(tile doc) names the prop's material; playSound(file, at, {volume, reach}?) plays a recording at a point
// (main.mjs, with room acoustics); shake(at, burst) jolts the view for an explosion seen happening (optional).
export function createPropWreckage({ PIXI, layer, renderer, grid, materialOf = () => "wood", playSound = () => {}, shake = () => {} }) {
  const wrecks = new Map(); // tile id -> { box, handle, stop }
  const artTextures = new Map(), colours = new Map();
  const posed = createPosedPieces({ PIXI });
  const fx = createPropFx({ PIXI });

  const artTexture = (art, n, color) => {
    const key = `${art}:${n}:${color}`;
    if (!artTextures.has(key)) { const c = bloodArt(art, n, color); artTextures.set(key, c ? PIXI.Texture.from(c) : null); }
    return artTextures.get(key);
  };

  // The prop's own colours (mean of its opaque pixels, darker and lighter), sampled once per src.
  const sample = (src) => {
    if (!colours.has(src)) {
      colours.set(src, (async () => {
        try {
          const img = new Image(); img.src = src; await img.decode();
          // Drawn downscaled (about 64 px longest side): the same mean colour for far less memory.
          const k = Math.min(1, 64 / Math.max(img.width, img.height, 1));
          const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
          const x = c.getContext("2d"); x.drawImage(img, 0, 0, c.width, c.height);
          const d = x.getImageData(0, 0, c.width, c.height).data; let r = 0, g = 0, b = 0, n = 0;
          for (let i = 0; i < d.length; i += 16) if (d[i + 3] > 200) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
          if (!n) return FALLBACK;
          // The painted part's bounds (past the soft drop shadow), as shares of the picture: where a collapse's boards lie.
          let x0 = c.width, y0 = c.height, x1 = 0, y1 = 0;
          for (let i = 3, p = 0; i < d.length; i += 4, p++) if (d[i] > 150) { const x = p % c.width, y = (p / c.width) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x + 1); y0 = Math.min(y0, y); y1 = Math.max(y1, y + 1); }
          const m = [r / n, g / n, b / n], hex = (k) => (Math.min(255, m[0] * k) << 16) | (Math.min(255, m[1] * k) << 8) | Math.min(255, m[2] * k);
          return { mid: hex(1), dark: hex(0.55), light: hex(1.25), box: [x0 / c.width, y0 / c.height, x1 / c.width, y1 / c.height] };
        } catch { return FALLBACK; }
      })());
    }
    return colours.get(src);
  };

  const groundMark = (mark, held) => paintMark(PIXI, mark, held);

  // Burning lamp oil (mock scene 4): soft soot under the scorch, always; while it burns (a break seen happening), flames
  // over the spill with a hot core glow and rising embers, catching just after the break and dying down over the last
  // BURN_DIE_MS of BURN_MS. The wide glow is the GM's temporary fire light; its smoke and its fire-pot loop come with it.
  const SCORCH_IN_MS = 12000; // the scorch shows through as the flames die
  const sootUnder = (fire, cutAngle, marks) => fx.glow(marks, fire.at, fire.r * 1.65, 0x0c0806, { alpha: 0.45, flicker: false, add: false, squash: 0.8, angle: cutAngle });
  const burning = (fire, box) => {
    const layer = new PIXI.Container(); layer.zIndex = 2; box.addChild(layer); // over the flying pieces (z 1), as the mock's fire layer
    const core = fx.glow(layer, fire.at, fire.r * 2, 0xffc060, { alpha: 0.5 });
    const flames = fx.flames(layer, fire.flames, { end: BURN_MS, dieMs: BURN_DIE_MS });
    const sparks = fx.embers(layer, fire.embers);
    return {
      update(t) { flames.update(t); core.level(flames.heat); core.update(t); sparks.update(t); },
      destroy() { flames.destroy(); core.destroy(); sparks.destroy(); quiet(() => layer.destroy({ children: true })); },
    };
  };

  // Spilled books, pages and shards: each a small shape going from the prop's line across the hit (where it stood) to
  // where it lies, with a hop and a shadow under it. paint(g, dark) draws it about (0,0); dark is its shadow.
  const flyer = (over, item, { centre, cutAngle, extent }, { delay, dur, hop, spin = 0, ease = outCubic, wobble = 0, shadow = 0.3 }, paint) => {
    const nx = -Math.sin(cutAngle), ny = Math.cos(cutAngle);
    const along = Math.max(-extent / 2, Math.min(extent / 2, (item.x - centre.x) * nx + (item.y - centre.y) * ny));
    const home = { x: centre.x + nx * along, y: centre.y + ny * along }, sh = new PIXI.Graphics(), g = new PIXI.Graphics();
    paint(sh, true); paint(g, false); over.addChild(sh, g);
    return (t) => {
      const r = clamp01((t - delay) / dur), u = ease(r), lift = Math.sin(Math.PI * r) * hop * 18, wob = Math.sin(r * 9) * wobble * (1 - r);
      const x = lerp(home.x, item.x, u) + nx * wob, y = lerp(home.y, item.y, u) + ny * wob;
      g.visible = sh.visible = t >= delay;
      g.position.set(x, y - lift); g.rotation = item.rot - spin * (1 - u); g.scale.set(1 + lift / 72);
      sh.position.set(x + 1.5 + lift * 0.6, y + 2.5 + lift * 0.9); sh.rotation = g.rotation; sh.scale.copyFrom(g.scale); sh.alpha = shadow * (1 - lift / 36);
    };
  };
  // A closed book from above: cover in the tile's tone, a darker spine, the page block past the cover, a pale panel.
  const closedBook = (b, col) => (g, dark) => {
    const w = b.w, h = b.h, x = -w / 2, y = -h / 2;
    if (dark) { g.beginFill(0x000000, 1).drawRect(x, y, w, h).endFill(); return; }
    g.beginFill(0xe2d4b0, 1).drawRect(x + 1.5, y + 1.5, w - 1.5, h - 1.5).endFill();
    g.lineStyle(1.2, INK, 0.9).beginFill(col, 1).drawRect(x, y, w - 2, h - 2).endFill().lineStyle(0);
    g.beginFill(shade(col, 0.62), 1).drawRect(x, y, w * 0.18, h - 2).endFill();
    g.beginFill(shade(col, 1.22), 1).drawRect(x + w * 0.18, y + 1, w * 0.82 - 3, (h - 2) * 0.12).endFill();
    g.lineStyle(0.8, shade(col, 1.45), 0.8).drawRect(x + w * 0.32, y + h * 0.22, w * 0.46, h * 0.42);
    g.lineStyle(1.2, INK, 0.9).moveTo(x + w * 0.18, y).lineTo(x + w * 0.18, y + h - 2);
  };
  // A small book seen from the side: its cover, a lit top edge, a dark spine and pale page edges.
  const smallBook = (b, col) => (g, dark) => {
    const w = b.w, h = b.h, x = -w / 2, y = -h / 2;
    if (dark) { g.beginFill(0x000000, 1).drawRect(x, y, w, h).endFill(); return; }
    g.beginFill(col, 1).drawRect(x, y, w, h).endFill();
    g.beginFill(shade(col, 1.25), 1).drawRect(x + 1, y + 1, w - 2, h * 0.3).endFill();
    g.beginFill(shade(col, 0.6), 1).drawRect(x, y, 2.2, h).endFill();
    g.beginFill(0xe2d4b2, 0.95).drawRect(x + w - 2.2, y + 1, 1.6, h - 2).endFill();
    g.lineStyle(1, INK, 0.9).drawRect(x, y, w, h);
  };
  // A loose page: ruled lines, sometimes a curled corner.
  const page = (p) => (g, dark) => {
    const w = p.w, h = p.h, c = [-w / 2, -h / 2, w / 2, -h / 2, w / 2, h / 2, -w / 2, h / 2];
    if (dark) { g.beginFill(0x000000, 1).drawPolygon(c).endFill(); return; }
    g.lineStyle(0.8, 0x3a2e22, 0.7).beginFill(p.c, 1).drawPolygon(c).endFill().lineStyle(0);
    if (p.curl) g.beginFill(shade(p.c, 0.82), 1).drawPolygon([c[4], c[5], c[6], c[7], 1, h * 0.25 - 1]).endFill();
    g.lineStyle(0.7, 0x5a4a38, 0.45);
    for (let l = 0; l < 4; l++) { const v = -h / 2 + 3 + (l * (h - 6)) / 4; g.moveTo(-w / 2 + 2, v).lineTo(w / 2 - 2 - (l === 3 ? 3 : 0), v); }
  };
  // A shard of coloured glass: a thin triangle, a faint ink edge and one bright edge; pale, mid or clear-ish by turn.
  const shard = (s, i) => (g, dark) => {
    const z = s.size, pts = [0, -z * 0.9, z * (0.3 + (i % 3) * 0.08), z * (0.35 + (i % 4) * 0.06), -z * (0.25 + (i % 5) * 0.04), z * 0.3];
    paintShard(g, pts, [shade(s.colour, 1.5), mix(s.colour, 0xdfeef2, 0.55), shade(s.colour, 1.2)][i % 3], 0.75, dark);
  };

  // Draws the spill: marks into `box`, flying books, pages and shards into `at.over`; returns grow(t), t 0-1.
  const drawSpill = (spill, box, tones, at) => {
    if (!spill) return () => {};
    if (spill.kind === "books") {
      const tone = (b) => SPINE_COLOURS[b.tone] ?? SPINE_COLOURS[0];
      const parts = [
        ...spill.closed.map((b, i) => flyer(at.over, b, at, { delay: ms(40 + i * 50), dur: ms(650), hop: 0.3, spin: (i % 2 ? 1 : -1) * 1.2 }, closedBook(b, tone(b)))),
        ...spill.small.map((b, i) => flyer(at.over, b, at, { delay: ms((i * 37) % 120), dur: ms(560), hop: 0.25, spin: (i % 2 ? 1 : -1) * 1.6 }, smallBook(b, tone(b)))),
        ...spill.pages.map((p, i) => flyer(at.over, p, at, { delay: ms(80), dur: ms(900 * (0.8 + ((i * 7) % 10) * 0.06)), hop: 0.15, spin: ((i % 5) - 2) * 1.2, wobble: 8, shadow: 0.18 }, page(p))),
      ];
      return (t) => { for (const f of parts) f(t); };
    }
    if (spill.kind === "potions") {
      // Stains: the floor-blood pool and patch art, recoloured to each bottle's colour.
      const stains = spill.stains.map((m, i) => {
        const tex = artTexture(i % 2 ? "patch" : "pool", i % 3, m.colour);
        if (!tex) return null;
        const s = new PIXI.Sprite(tex); s.anchor.set(0.5); s.position.set(m.x, m.y); s.rotation = at.cutAngle + ((i * 2.399) % 1.2) - 0.6;
        s.width = s.height = m.r * 2; s.alpha = 0; box.addChild(s);
        return { s, w: m.r * 2, pool: i % 2 === 0 };
      }).filter(Boolean);
      const shards = spill.shards.map((s, i) => flyer(at.over, s, at, { delay: ms(30), dur: ms(500 * (0.6 + ((i * 7) % 10) * 0.07)), hop: 0.1, spin: ((i % 7) - 3) * 1.5, ease: outQuart, shadow: 0.2 }, shard(s, i)));
      return (t) => {
        const r = clamp01((t - ms(120)) / ms(700));
        for (const p of stains) {
          const u = clamp01((r - (p.pool ? 0.15 : 0.05)) / (p.pool ? 0.85 : 0.95)), k = p.pool ? 0.25 + 0.75 * outCubic(u) : 0.6 + 0.4 * u;
          p.s.width = p.s.height = p.w * k; p.s.alpha = 0.75 * Math.min(1, u * 3);
        }
        for (const f of shards) f(t);
      };
    }
    if (spill.color !== undefined) {
      const parts = spill.marks.map((m) => {
        const tex = artTexture(m.art, m.n ?? 0, spill.color);
        if (!tex) return null;
        const s = new PIXI.Sprite(tex); s.anchor.set(0.5); s.position.set(m.x, m.y); s.rotation = m.rot ?? 0;
        const w = m.r * 2, h = m.r * 2 * (m.squash ?? 1); s.width = w; s.height = h; s.alpha = 0; box.addChild(s);
        return { s, w, h, delay: m.delay, pool: m.art === "pool" };
      }).filter(Boolean);
      return (t) => {
        for (const p of parts) {
          const u = Math.min(1, Math.max(0, (t - p.delay) / (1 - p.delay))), k = p.pool ? 0.25 + 0.75 * (1 - (1 - u) ** 2) : 0.6 + 0.4 * u;
          p.s.width = p.w * k; p.s.height = p.h * k; p.s.alpha = spill.alpha * Math.min(1, u * 3);
        }
      };
    }
    // Grain, goods and powder: each bit a small shadow, then the bit; goods take the tile's tones, grain and powder their own.
    const g = new PIXI.Graphics(), goods = spill.kind === "goods", powder = spill.kind === "powder";
    const tone = (k) => (goods ? [tones.dark, tones.mid, tones.light][k.tone] : powder ? POWDER_TONES[k.tone] : GRAIN_TONES[k.tone]);
    const quad = (k, m = 1) => { const dx = Math.cos(k.rot) * m, dy = Math.sin(k.rot) * m; return [k.x - dx * k.l, k.y - dy * k.l, k.x - dy * k.w, k.y + dx * k.w, k.x + dx * k.l, k.y + dy * k.l, k.x + dy * k.w, k.y - dx * k.w]; };
    for (const k of spill.marks) g.beginFill(powder ? 0x0c0a08 : 0x2a1e10, powder ? 0.18 : 0.28).drawEllipse(k.x + 0.8, k.y + 0.9, k.l, k.w).endFill();
    for (const k of spill.marks) {
      if (k.husk && powder) g.beginFill(0x77726a, 0.85).drawPolygon(quad(k)).endFill(); // a grey glint in the powder
      else if (k.husk) g.lineStyle(0.6, 0x6d5a3a, 0.5).beginFill(0xe6d6a8, 0.75).drawPolygon(quad(k, 2)).endFill().lineStyle(0);
      else g.beginFill(tone(k), 1).drawPolygon(quad(k)).endFill();
    }
    g.alpha = 0; box.addChild(g);
    return (t) => { g.alpha = Math.min(1, t * 1.6); };
  };

  const drawSpecks = (specks, box, tones) => {
    const g = new PIXI.Graphics();
    for (const s of specks) g.lineStyle(0.8, 0x14100c, 0.5).beginFill(s.tone ? tones.mid : tones.dark, 0.95).drawPolygon(s.pts).endFill();
    g.alpha = 0; box.addChild(g);
    return g;
  };

  // The art's painted bounds as shares of the tile: only where the art fills the tile one to one (fit "fill", unscaled,
  // unmirrored); anything else uses the whole tile.
  const paintedBox = (d, tones) => {
    const t = d.texture ?? {}, one = (v) => v === undefined || v === null || v === 1;
    return tones.box && (t.fit ?? "fill") === "fill" && one(t.scaleX) && one(t.scaleY) ? tones.box : undefined;
  };

  // Leg stubs left standing at the corners (tile-local px): a dark block of the prop's wood, a shadow and a splintered top.
  const legStubs = (legs, tones, seed) => {
    const g = new PIXI.Graphics(), rand = seededRandom((seed >>> 0) * 17 + 3);
    for (const l of legs) {
      const s = l.size, c = Math.cos(l.rot), sn = Math.sin(l.rot), at = (x, y) => [l.x + x * c - y * sn, l.y + x * sn + y * c];
      const pts = [[-s / 2, -s / 2], [s / 2, -s / 2 + rand() * 2], [s / 2 - rand() * 3, s / 2], [-s / 2, s / 2 - rand() * 2]].flatMap(([x, y]) => at(x, y));
      const top = [[-s / 2 + 2, -s / 2 + 2], [s / 2 - 2, -s / 2 + 2], [s / 2 - 3, -s / 2 + 5], [-s / 2 + 2, -s / 2 + 5]].flatMap(([x, y]) => at(x, y));
      g.lineStyle(0).beginFill(0x000000, 0.35).drawPolygon(pts.map((v, i) => v + (i % 2 ? 3 : 2))).endFill();
      g.lineStyle(1.4, INK, 0.9).beginFill(shade(tones.mid, 0.62), 1).drawPolygon(pts).endFill();
      g.lineStyle(0).beginFill(0xd2b07a, 0.85).drawPolygon(top).endFill();
    }
    return g;
  };

  // The prop's art stands in as an unseen sprite drawn the way Foundry draws the tile (fit, texture scale, anchor at
  // the tile's x/y); its pieces fly from it.
  const standFor = (tile, d, texture, centre, box, sortLayer) => {
    const stand = new PIXI.Sprite(texture); stand.renderable = false;
    const { sx, sy } = tileArtScale(d, texture.width, texture.height);
    stand.anchor.set(fin(d.texture?.anchorX, 0.5), fin(d.texture?.anchorY, 0.5)); stand.scale.set(sx, sy);
    stand.position.set(fin(Number(d.x), centre.x), fin(Number(d.y), centre.y)); stand.rotation = ((d.rotation ?? 0) * Math.PI) / 180;
    stand.elevation = box.elevation; stand.sort = tile.mesh?.sort ?? d.sort ?? 0; stand.zIndex = 0;
    if (sortLayer !== undefined) stand.sortLayer = sortLayer;
    box.addChild(stand);
    return stand;
  };
  // A container placed like the tile (children in tile-local px), for a tile with or without its art.
  const frameOf = (d, centre, z) => {
    const f = tileFrame(PIXI, { position: { x: fin(Number(d.x), centre.x), y: fin(Number(d.y), centre.y) }, rotation: ((d.rotation ?? 0) * Math.PI) / 180,
      anchor: { x: fin(d.texture?.anchorX, 0.5), y: fin(d.texture?.anchorY, 0.5) } }, { width: d.width, height: d.height });
    f.zIndex = z;
    return f;
  };

  // A brazier tipped over (mock scene 4): the whole picture slides to where it lies, squashed narrower along the fall
  // and cooled to a dull tint (its fire is out; its light went out with the break); hot coals scatter ahead of it,
  // glowing and dimming over COAL_MS, with a puff of ash smoke and a few sparks. Drawn on load (animate: false) it is
  // settled: lying, cooled, its coals dark. It sounds of metal whatever the GM set its material to.
  const TIP_TINT = 0x7a6e66, TIP_MS = 520, COOL_START = 150, COOL_MS = 900, COAL_IN = 150, COAL_DARK = 0x2a211c, COAL_ASH = 0x6a5646; // cooled coals keep a pale ash fleck so they read on a dark floor
  function tipped({ tile, d, note, entry, box, texture, centre, sortLayer, animate }) {
    const size = { width: d.width, height: d.height }, side = Math.max(d.width, d.height);
    const L = tipLayout(note, { ...size, grid: grid() || 100, rotation: d.rotation ?? 0 });
    const home = { x: d.width / 2, y: d.height / 2 }, rest = { x: home.x + L.lying.dx, y: home.y + L.lying.dy };
    const restW = tileToWorld(d, centre, rest), ux = Math.cos(note.cutAngle), uy = Math.sin(note.cutAngle);
    // Ash and soot where the bowl spilled, under everything.
    const marks = new PIXI.Container(); marks.zIndex = -1; box.addChild(marks);
    const ash = fx.glow(marks, { x: restW.x + ux * side * 0.3, y: restW.y + uy * side * 0.3 }, side * 0.4, 0x241c16, { alpha: 0.4, flicker: false, add: false, squash: 0.7, angle: note.cutAngle });
    let piece = null;
    if (texture) {
      const stand = standFor(tile, d, texture, centre, box, sortLayer);
      const whole = { poly: [0, 0, d.width, 0, d.width, d.height, 0, d.height], home, to: { ...rest, rot: L.lying.rot, sx: L.lying.sx, sy: L.lying.sy },
        delay: 0, dur: TIP_MS / FLIGHT_MS, hop: 0.2, shadow: 0.45, ink: false };
      try { piece = posed.cut(stand, [whole], size); entry.handle = piece; }
      catch (error) { console.warn("Animater prop wreckage: no tipped prop", error); }
    }
    // The coals: dark chunks a few px across, with a hot heart and a soft glow while they are hot.
    const coalFrame = frameOf(d, centre, 0.5); box.addChild(coalFrame);
    const body = new PIXI.Graphics(), heart = new PIXI.Graphics(); heart.blendMode = PIXI.BLEND_MODES.ADD;
    coalFrame.addChild(body);
    const coals = L.coals.map((c, i) => {
      const r = seededRandom(((note.seed >>> 0) + i * 977) * 13 + 5), turn = r() * Math.PI * 2;
      const shape = Array.from({ length: 6 }, (_, k) => { const a = turn + (k / 6) * Math.PI * 2, m = c.r * (0.7 + r() * 0.35); return [Math.cos(a) * m, Math.sin(a) * m]; }).flat();
      return { ...c, shape, ph: r() * 9, fly: 400 + r() * 300, glow: animate ? fx.glow(coalFrame, c, c.r * 3.4, 0xff6a24, { alpha: 0.95, flicker: false }) : null };
    });
    coalFrame.addChild(heart);
    const heat = (c, ms) => (animate ? 1 - span(ms, COOL_START + COOL_MS, COAL_MS * c.hot - COOL_START - COOL_MS) : 0);
    const drawCoals = (ms) => {
      body.clear(); heart.clear();
      for (const c of coals) {
        const shown = !animate || ms >= COAL_IN, u = animate ? outQuart(span(ms, COAL_IN, c.fly)) : 1;
        const x = lerp(rest.x, c.x, u), y = lerp(rest.y, c.y, u), h = shown ? heat(c, ms) * (0.75 + 0.25 * Math.sin(ms * 0.01 + c.ph)) : 0;
        if (c.glow) { c.glow.sprite.position.set(x, y); c.glow.level(h); c.glow.update(ms); }
        if (!shown) continue;
        const pts = c.shape.map((v, k) => v + (k % 2 ? y : x));
        body.lineStyle(0.8, INK, 0.8).beginFill(COAL_DARK, 1).drawPolygon(pts).endFill();
        if (h > 0.02) heart.beginFill(0xffb050, Math.min(1, 1.1 * h)).drawCircle(x, y, c.r * 0.6).endFill();
        else body.lineStyle(0).beginFill(COAL_ASH, 0.9).drawCircle(x - c.r * 0.2, y - c.r * 0.2, c.r * 0.38).endFill();
      }
    };
    const cool = (ms) => { if (piece) piece.tint(mix(0xffffff, TIP_TINT, animate ? span(ms, COOL_START, COOL_MS) : 1)); ash.sprite.alpha = 0.4 * (animate ? span(ms, 200, 500) : 1); };
    const settle = (ms) => { piece?.update(animate ? Math.min(1, ms / FLIGHT_MS) : 1); cool(ms); drawCoals(ms); };
    if (!animate) { settle(COAL_MS); return; }
    // Seen happening: a puff of ash smoke and a few sparks off the spilled bowl, and the clatter of metal.
    const air = new PIXI.Container(); air.zIndex = 2; box.addChild(air);
    const rand = seededRandom((note.seed >>> 0) * 7 + 3), at = { x: restW.x + ux * side * 0.15, y: restW.y + uy * side * 0.15 };
    const sparks = fx.embers(air, Array.from({ length: 22 }, () => ({ x: at.x + (rand() - 0.5) * side * 0.47, y: at.y + (rand() - 0.5) * side * 0.47,
      vx: ux * (30 + rand() * 40), vy: uy * (30 + rand() * 40) - 30 - rand() * 50, s: 1 + rand(), ph: rand() * 9, at: rand() * 400, life: 600 + rand() * 600 })));
    const smoke = fx.puffs(air, [0, 1, 2].map((i) => ({ x: at.x + ux * i * side * 0.13, y: at.y + uy * i * side * 0.13, vx: ux * 20, vy: uy * 20 - 60,
      r0: side * 0.11, r1: side * 0.3, a: 0.3, at: 100 + i * 120, life: 1500, seed: ((note.seed >>> 0) % 100000) + i })), [0x4a4440, 0x5e5853]);
    try { playSound(propSound("metal", "none", seededRandom(note.seed)).file, centre); }
    catch (error) { console.warn("Animater prop wreckage: no sound", error); }
    const t0 = performance.now(); let raf = 0;
    const done = () => { entry.stop = null; quiet(() => sparks.destroy()); quiet(() => smoke.destroy()); for (const c of coals) if (c.glow) { quiet(() => c.glow.destroy()); c.glow = null; } };
    entry.stop = () => { cancelAnimationFrame(raf); entry.stop = null; };
    const tick = () => {
      const ms = performance.now() - t0;
      settle(Math.min(ms, COAL_MS)); sparks.update(ms); smoke.update(ms);
      if (ms < COAL_MS) raf = requestAnimationFrame(tick); else done();
    };
    settle(0); raf = requestAnimationFrame(tick);
  }

  // A powder keg exploded (mock scene 5): a big scorch with soft soot under it, spent powder, charred staves cut from
  // the keg's own art thrown far, bent iron hoops and splinters of its wood. Seen happening, a flash and a hot glow, a
  // painted fireball darkening into smoke that rolls away, embers, the explosion's sound and a jolt of the view.
  // Drawn on load it is settled: scorch and debris only. `prior`: the spilled keg's wreck an ignite blows up; the
  // explosion plays over it and the exploded wreck replaces it under the fireball (BLAST_SWAP_MS).
  const STAVE_CHAR = 0x8a7266, STAVE_EDGE = "rgba(60,40,26,0.9)", BLAST_SWAP_MS = 220, HOOP_MS = 700;
  const fireTones = [(r) => mix(0xc8401a, 0x2a2422, clamp01(r * 1.4)), (r) => mix(0xf6c04a, 0x3a3230, clamp01(r * 1.6)), (r) => mix(0xfde69a, 0x4a4240, clamp01(r * 1.9))];
  const SMOKE_TONES = [0x3e3a37, 0x55504b, 0x6a645e], SLIVER_TONES = [0x2a1d16, 0x3d2c22], GRAIN_SPENT = [0x141210, 0x222020];
  function exploded({ tile, d, note, entry, box, texture, tones, centre, sortLayer, animate, layout, contents, prior }) {
    const B = layout.blast, k = (grid() || 100) / 100, burst = note.burst ?? BURST_DEFAULT;
    // Under everything: the soot, the scorch, the spent powder.
    const marks = new PIXI.Container(); marks.zIndex = -1; box.addChild(marks);
    const soot = fx.glow(marks, centre, BLAST_SCORCH * burst * (grid() || 100) * 1.25, 0x0c0806, { alpha: 0.4, flicker: false, add: false });
    const mark = marks.addChild(groundMark(layout.mark, entry.textures));
    const grains = new PIXI.Graphics(); marks.addChild(grains);
    // The staves: the keg's picture cut along its wedges, each thrown out and charred as it flies.
    let staves = null;
    if (texture) {
      const stand = standFor(tile, d, texture, centre, box, sortLayer);
      const pieces = B.staves.map((s) => ({ poly: s.poly, home: s.home, to: s.to, delay: 0, dur: s.dur / FLIGHT_MS, hop: s.hop, shadow: 0.32, fresh: STAVE_EDGE }));
      try { staves = posed.cut(stand, pieces, { width: d.width, height: d.height }); entry.handle = staves; }
      catch (error) { console.warn("Animater prop wreckage: no staves", error); }
    }
    // Hoops and splinters, in world px over the staves' shadows.
    const debris = new PIXI.Graphics(); debris.zIndex = 0.5; box.addChild(debris);
    const sliverTone = (t) => (t < 2 ? SLIVER_TONES[t] : shade(tones.mid, 0.6));
    const quad = (x, y, ro, l, w, chip) => {
      const dx = (Math.cos(ro) * l) / 2, dy = (Math.sin(ro) * l) / 2, nx = (-Math.sin(ro) * w) / 2, ny = (Math.cos(ro) * w) / 2;
      return chip ? [x - dx, y - dy, x + nx * 1.6, y + ny * 1.6, x + dx, y + dy, x - nx, y - ny]
        : [x - dx - nx * 0.4, y - dy - ny * 0.4, x + dx * 0.2 - nx, y + dy * 0.2 - ny, x + dx, y + dy, x + dx * 0.1 + nx, y + dy * 0.1 + ny];
    };
    const fly = (g, list, ms, dur, chip, colour, ink) => {
      for (const it of list) {
        const r = animate ? span(ms, 0, dur * it.sh) : 1, u = outQuart(r), lift = Math.sin(Math.PI * r) * 10 * k;
        const pts = quad(lerp(it.x0, it.x, u), lerp(it.y0, it.y, u) - lift, lerp(it.rot0, it.rot, u), it.l, it.w, chip);
        g.lineStyle(0).beginFill(0x000000, 0.25).drawPolygon(pts.map((v, i) => v + (i % 2 ? 2.5 + lift * 0.6 : 1.5))).endFill();
        g.lineStyle(ink ? 0.8 : 0, INK, ink).beginFill(colour(it.tone), 1).drawPolygon(pts).endFill();
      }
    };
    // Each arc starts with a move to its first point, so no straight line joins one hoop (or stroke) to the next.
    const arc = (x, y, w, c, a, r, s0, s1) => { debris.lineStyle(w * k, c, a).moveTo(x + Math.cos(s0) * r, y + Math.sin(s0) * r).arc(x, y, r, s0, s1); };
    const drawDebris = (ms) => {
      debris.clear(); grains.clear();
      fly(grains, B.grains, ms, 500, true, (t) => GRAIN_SPENT[t], 0);
      fly(debris, B.slivers, ms, 700, false, sliverTone, 0.55);
      if (animate && ms <= 0) return;
      const u = animate ? outQuart(span(ms, 0, HOOP_MS)) : 1;
      for (const h of B.hoops) {
        const x = lerp(h.x0, h.x, u), y = lerp(h.y0, h.y, u);
        arc(x, y, 5, INK, 0.9, h.r, h.s, h.s + h.l); arc(x, y, 3, 0x4a4540, 1, h.r, h.s, h.s + h.l); arc(x, y, 1, 0x8a8278, 0.6, h.r - k, h.s + 0.1, h.s + h.l - 0.1);
      }
      debris.lineStyle(0);
    };
    const char = (ms) => staves?.tint(mix(0xffffff, STAVE_CHAR, animate ? clamp01((ms / FLIGHT_MS) * 1.5) : 1));
    const settle = (ms) => {
      staves?.update(animate ? Math.min(1, ms / FLIGHT_MS) : 1); char(ms); drawDebris(ms);
      const u = animate ? span(ms, 0, 250) : 1; mark.alpha = u; soot.sprite.alpha = 0.4 * u;
    };
    if (!animate) { settle(FLIGHT_MS); return; }
    // An ignite: the exploded wreck lies settled, unseen until the fireball covers the spilled keg it replaces.
    const swapIn = !!prior;
    if (swapIn) { settle(FLIGHT_MS); box.visible = false; }
    // The blast, over everything; its own container so it shows while an ignite's wreck waits to be swapped in.
    const air = new PIXI.Container(); air.sortableChildren = true;
    air.elevation = box.elevation; air.sort = box.sort + 1; if (sortLayer !== undefined) air.sortLayer = sortLayer;
    layer().addChild(air); entry.extras.push(air);
    const glow = fx.glow(air, centre, B.glow, 0xff8a30, { alpha: 0.8, flicker: false });
    const fire = fx.puffs(air, B.puffs.filter((p) => p.kind === "fire"), fireTones, { inkA: 0.18 });
    const smoke = fx.puffs(air, B.puffs.filter((p) => p.kind === "smoke"), SMOKE_TONES);
    const sparks = fx.embers(air, B.embers), flash = fx.flash(air, centre, B.flash, { dur: 260 });
    try { playSound(propSound(materialOf(d), contents, seededRandom(note.seed), { powder: "exploded" }).file, centre, { volume: 1, reach: 40 }); }
    catch (error) { console.warn("Animater prop wreckage: no sound", error); }
    try { shake(centre, burst); } catch { /* no shake */ }
    const end = Math.max(FLIGHT_MS, ...B.puffs.map((p) => p.at + p.life), ...B.embers.map((e) => e.at + e.life));
    const t0 = performance.now(); let raf = 0;
    const swap = () => { box.visible = true; dropPrior(entry); };
    const done = () => { entry.stop = null; swap(); quiet(() => air.destroy({ children: true })); entry.extras = entry.extras.filter((x) => x !== air); };
    entry.stop = () => { cancelAnimationFrame(raf); done(); };
    const step = (ms) => {
      if (!swapIn) settle(Math.min(ms, FLIGHT_MS)); else if (ms >= BLAST_SWAP_MS) swap();
      glow.sprite.visible = ms < HOOP_MS; glow.sprite.alpha = 0.8 * (1 - span(ms, 0, HOOP_MS));
      flash.update(ms); fire.update(ms); smoke.update(ms); sparks.update(ms);
    };
    const tick = () => {
      const ms = performance.now() - t0;
      step(Math.min(ms, end));
      if (ms < end) raf = requestAnimationFrame(tick); else done();
    };
    step(0); raf = requestAnimationFrame(tick);
  }

  // The tile's art: its own mesh texture, or, where a hidden tile was never drawn (a player's client), loaded from its src.
  const textureOf = async (tile, src) => {
    const have = tile.mesh?.texture;
    if (have?.valid && have.baseTexture) return have;
    return foundry.canvas.loadTexture(src);
  };

  const release = (entry) => {
    entry.stop?.();
    quiet(() => entry.handle?.destroy());
    quiet(() => entry.box.destroy({ children: true }));
    for (const x of entry.extras ?? []) quiet(() => x.destroy({ children: true }));
    for (const t of entry.textures) quiet(() => t.destroy(true));
    dropPrior(entry);
  };
  function dropPrior(entry) { if (entry.prior) { const p = entry.prior; entry.prior = null; release(p); } }

  const hide = (id) => { const e = wrecks.get(id); if (e) { wrecks.delete(id); release(e); } };

  // The sort layer a tile draws in: its mesh's, else the primary canvas's tiles layer (a hidden tile has no mesh on a player's client).
  const sortLayerOf = (tile) => tile.mesh?.sortLayer ?? globalThis.canvas?.primary?.constructor?.SORT_LAYERS?.TILES ?? foundry.canvas?.groups?.PrimaryCanvasGroup?.SORT_LAYERS?.TILES;

  // A failure leaves no half-built wreck behind, so the next sync tries again.
  async function show(tile, note, contents = "none", opts = {}) {
    const id = (tile.document ?? tile).id;
    try { await draw(tile, note, contents, opts); }
    catch (error) { hide(id); console.warn("Animater prop wreckage: could not draw", error); }
  }

  // ignite: spilled powder set off later; the wreck already drawn stays until the explosion covers it (exploded).
  async function draw(tile, note, contents, { animate = false, ignite = false }) {
    const d = tile.document ?? tile, id = d.id;
    const prior = ignite && animate ? wrecks.get(id) ?? null : null;
    if (prior) { wrecks.delete(id); prior.stop?.(); } else hide(id);
    const rect = tileRect(d), centre = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    const box = new PIXI.Container(), entry = { box, handle: null, stop: null, fire: null, textures: [], extras: [], prior };
    wrecks.set(id, entry);
    box.sortableChildren = true;
    box.elevation = d.elevation ?? 0; box.sort = (d.sort ?? 0) + 1;
    const sortLayer = sortLayerOf(tile);
    if (sortLayer !== undefined) box.sortLayer = sortLayer;
    layer().addChild(box);

    const src = d.texture?.src;
    const [texture, tones] = await Promise.all([textureOf(tile, src).catch(() => null), src ? sample(src) : FALLBACK]);
    if (wrecks.get(id) !== entry) return; // hidden or redrawn while loading
    if (note.style === "tip") { dropPrior(entry); tipped({ tile, d, note, entry, box, texture, centre, sortLayer, animate }); return; }
    const layout = wreckLayout(note, { centre, width: d.width, height: d.height, grid: grid() || 100, contents, rotation: d.rotation ?? 0 });
    if (layout.blast) { exploded({ tile, d, note, entry, box, texture, tones, centre, sortLayer, animate, layout, contents, prior: entry.prior }); return; }
    dropPrior(entry); // anything else drawn over a wreck it replaces: the old one goes now
    const marks = new PIXI.Container(); marks.zIndex = -1; box.addChild(marks);
    const over = new PIXI.Container(); over.zIndex = 0.5; box.addChild(over); // spilled books, pages and shards land on top
    // Furniture that collapses folds into its own boards, with leg stubs, over a dust mark (in place of the plain dust).
    const collapse = note.style === "collapse"
      ? collapseLayout(note, { width: d.width, height: d.height, legs: propGuesses(src).legs, rotation: d.rotation ?? 0, box: paintedBox(d, tones) }) : null;
    const soot = layout.fire ? sootUnder(layout.fire, note.cutAngle, marks) : null;
    const mark = !collapse || note.mark !== "dust" || layout.fire ? marks.addChild(groundMark(layout.mark, entry.textures)) : null;
    if (collapse) {
      const turn = ((d.rotation ?? 0) * Math.PI) / 180;
      const dust = groundMark(collapseDust({ ...collapse.dust, ...tileToWorld(d, centre, collapse.dust), angle: collapse.dust.angle + turn }, note.seed), entry.textures);
      dust.alpha = 0.6; marks.addChild(dust);
    }
    const extent = spillExtent(d.width, d.height, note.cutAngle, d.rotation ?? 0);
    const grow = drawSpill(layout.spill, marks, tones, { over, centre, cutAngle: note.cutAngle, extent }), speckG = drawSpecks(layout.specks, marks, tones);
    // A fire's scorch burns over the oil it fed on (mock scene 4: the stain goes dark), under the splinters.
    if (layout.fire) for (const top of [soot?.sprite, mark]) if (top) marks.addChildAt(top, marks.getChildIndex(speckG));

    if (texture) {
      const stand = standFor(tile, d, texture, centre, box, sortLayer);
      if (collapse) {
        const size = { width: d.width, height: d.height };
        if (collapse.legs.length) { const legs = tileFrame(PIXI, stand, size); legs.zIndex = -0.5; legs.addChild(legStubs(collapse.legs, tones, note.seed)); box.addChild(legs); }
        try { entry.handle = posed.cut(stand, collapse.planks, size); }
        catch (error) { console.warn("Animater prop wreckage: no boards", error); }
      } else {
        // No behaviour: the default burst, whose pieces end lying where they land (keep).
        const stage = { pattern: note.pattern, pieces: note.pieces, spread: note.spread, spin: note.spin, fall: 0, duration: FLIGHT_MS, keep: true, tint: note.tint, seed: note.seed };
        try { entry.handle = renderer.start({ mesh: stand, center: centre, w: d.width, h: d.height, id, document: { elevation: box.elevation } }, stage, note.cutAngle); }
        catch (error) { console.warn("Animater prop wreckage: no pieces", error); }
      }
    }
    const frame = (t) => { entry.handle?.update(t); grow(t); speckG.alpha = Math.min(1, t * 1.5); };
    if (!animate) { frame(1); return; }
    // A break seen burning: the scorch and its soot come in as the flames die; the wreck's own clock runs on to BURN_MS.
    const fire = layout.fire ? burning(layout.fire, box) : null;
    const scorchIn = (ms) => { const u = clamp01((ms - (BURN_MS - SCORCH_IN_MS)) / (SCORCH_IN_MS - 1000)); if (mark) mark.alpha = u; if (soot) soot.sprite.alpha = 0.45 * u; };
    if (fire) entry.fire = fire;
    // Only a break seen happening is heard; a wreck redrawn on load stays silent. The note's seed gives every screen the same pick.
    try {
      const { file, splash } = propSound(materialOf(d), contents, seededRandom(note.seed));
      playSound(file, centre); if (splash) playSound(splash, centre);
    } catch (error) { console.warn("Animater prop wreckage: no sound", error); }
    const t0 = performance.now(), end = fire ? BURN_MS : FLIGHT_MS; let raf = 0;
    const done = () => { entry.stop = null; if (entry.fire) { entry.fire.destroy(); entry.fire = null; } };
    entry.stop = () => { cancelAnimationFrame(raf); done(); };
    const step = (ms) => { frame(Math.min(1, ms / FLIGHT_MS)); if (fire) { fire.update(ms); scorchIn(ms); } };
    const tick = () => {
      const ms = performance.now() - t0;
      step(Math.min(ms, end));
      if (ms < end) raf = requestAnimationFrame(tick); else done();
    };
    step(0); raf = requestAnimationFrame(tick);
  }

  // Draws every hidden tile that has a note and removes the rest; a wreck already drawn is left alone.
  function sync(tiles) {
    const want = wreckTargets(tiles), ids = new Set(want.map((w) => w.id)), byId = new Map((tiles ?? []).map((t) => [(t.document ?? t).id, t]));
    for (const id of [...wrecks.keys()]) if (!ids.has(id)) hide(id);
    for (const { id, note } of want) {
      if (wrecks.has(id)) continue;
      const tile = byId.get(id), contents = propTraits(tile.document ?? tile, grid() || 100).contents;
      show(tile, note, contents, { animate: false });
    }
  }

  function clear() {
    for (const id of [...wrecks.keys()]) hide(id);
    for (const t of artTextures.values()) if (t) quiet(() => t.destroy(true));
    artTextures.clear();
    fx.clear();
  }

  return { show, hide, sync, clear };
}
