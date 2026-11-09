// Draws a broken prop's wreckage: the ground mark, the spill and splinters (from prop-wreck-layout) and the prop's own
// art cut into pieces that lie where they landed. One Container per wreck, sorted just above the tile.
import { bloodArt } from "../motion/blood-art.mjs";
import { wreckLayout, wreckTargets, GRAIN_TONES } from "./prop-wreck-layout.mjs";
import { propSound } from "./prop-sounds.mjs";
import { seededRandom } from "../fragments/fragments.mjs";

const FALLBACK = { mid: 0x7a6a55, dark: 0x433a2f, light: 0x9a8a72 };
const FLIGHT_MS = 1400;
const quiet = (fn) => { try { fn(); } catch { /* keep cleaning */ } };

// materialOf(tile doc) names the prop's material; playSound(file, at) plays a recording at a point (main.mjs, with room acoustics).
export function createPropWreckage({ PIXI, layer, renderer, grid, materialOf = () => "wood", playSound = () => {} }) {
  const wrecks = new Map(); // tile id -> { box, handle, stop }
  const artTextures = new Map(), colours = new Map();

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
          const m = [r / n, g / n, b / n], hex = (k) => (Math.min(255, m[0] * k) << 16) | (Math.min(255, m[1] * k) << 8) | Math.min(255, m[2] * k);
          return { mid: hex(1), dark: hex(0.55), light: hex(1.25) };
        } catch { return FALLBACK; }
      })());
    }
    return colours.get(src);
  };

  const blotch = (b) => {
    const g = new PIXI.Graphics();
    for (const step of b.steps) for (const pts of step.polys) {
      if (step.edge) g.lineStyle(1, b.ink, 0.14); else g.lineStyle(0);
      g.beginFill(step.color, step.alpha).drawPolygon(pts).endFill();
    }
    return g;
  };

  const groundMark = (mark) => {
    const g = new PIXI.Container();
    for (const b of mark.blobs) g.addChild(blotch(b));
    if (mark.ticks.length) {
      const t = new PIXI.Graphics(); t.lineStyle(1.2, 0xf2f8fb, 0.5);
      for (const { x, y, s } of mark.ticks) t.moveTo(x - s, y).lineTo(x + s, y).moveTo(x, y - s).lineTo(x, y + s);
      g.addChild(t);
    }
    return g;
  };

  // Draws the spill into `box`; returns grow(t), t 0-1.
  const drawSpill = (spill, box, tones) => {
    if (!spill) return () => {};
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
    // Grain and goods: each bit a small shadow, then the bit; goods take the tile's tones, grain its own.
    const g = new PIXI.Graphics(), goods = spill.kind === "goods", tone = (k) => (goods ? [tones.dark, tones.mid, tones.light][k.tone] : GRAIN_TONES[k.tone]);
    const quad = (k, m = 1) => { const dx = Math.cos(k.rot) * m, dy = Math.sin(k.rot) * m; return [k.x - dx * k.l, k.y - dy * k.l, k.x - dy * k.w, k.y + dx * k.w, k.x + dx * k.l, k.y + dy * k.l, k.x + dy * k.w, k.y - dx * k.w]; };
    for (const k of spill.marks) g.beginFill(0x2a1e10, 0.28).drawEllipse(k.x + 0.8, k.y + 0.9, k.l, k.w).endFill();
    for (const k of spill.marks) {
      if (k.husk) g.lineStyle(0.6, 0x6d5a3a, 0.5).beginFill(0xe6d6a8, 0.75).drawPolygon(quad(k, 2)).endFill().lineStyle(0);
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
  };

  const hide = (id) => { const e = wrecks.get(id); if (e) { wrecks.delete(id); release(e); } };

  // The sort layer a tile draws in: its mesh's, else the primary canvas's tiles layer (a hidden tile has no mesh on a player's client).
  const sortLayerOf = (tile) => tile.mesh?.sortLayer ?? globalThis.canvas?.primary?.constructor?.SORT_LAYERS?.TILES ?? foundry.canvas?.groups?.PrimaryCanvasGroup?.SORT_LAYERS?.TILES;

  // A failure leaves no half-built wreck behind, so the next sync tries again.
  async function show(tile, note, contents = "none", opts = {}) {
    const id = (tile.document ?? tile).id;
    try { await draw(tile, note, contents, opts); }
    catch (error) { hide(id); console.warn("Animater prop wreckage: could not draw", error); }
  }

  async function draw(tile, note, contents, { animate = false }) {
    const d = tile.document ?? tile, id = d.id;
    hide(id);
    const centre = { x: d.x + d.width / 2, y: d.y + d.height / 2 };
    const box = new PIXI.Container(), entry = { box, handle: null, stop: null };
    wrecks.set(id, entry);
    box.sortableChildren = true;
    box.elevation = d.elevation ?? 0; box.sort = (d.sort ?? 0) + 1;
    const sortLayer = sortLayerOf(tile);
    if (sortLayer !== undefined) box.sortLayer = sortLayer;
    layer().addChild(box);

    const src = d.texture?.src;
    const [texture, tones] = await Promise.all([textureOf(tile, src).catch(() => null), src ? sample(src) : FALLBACK]);
    if (wrecks.get(id) !== entry) return; // hidden or redrawn while loading
    const layout = wreckLayout(note, { centre, width: d.width, height: d.height, grid: grid() || 100, contents });
    const marks = new PIXI.Container(); marks.zIndex = -1; box.addChild(marks);
    marks.addChild(groundMark(layout.mark));
    const grow = drawSpill(layout.spill, marks, tones), speckG = drawSpecks(layout.specks, marks, tones);

    // The prop's art stands in as an unseen sprite at the tile's transform; its pieces fly from it.
    if (texture) {
      const stand = new PIXI.Sprite(texture); stand.anchor.set(0.5); stand.renderable = false;
      stand.width = d.width; stand.height = d.height;
      stand.scale.x *= Math.sign(d.texture?.scaleX ?? 1) || 1; stand.scale.y *= Math.sign(d.texture?.scaleY ?? 1) || 1;
      stand.position.set(centre.x, centre.y); stand.rotation = ((d.rotation ?? 0) * Math.PI) / 180;
      stand.elevation = box.elevation; stand.sort = tile.mesh?.sort ?? d.sort ?? 0; stand.zIndex = 0;
      if (sortLayer !== undefined) stand.sortLayer = sortLayer;
      box.addChild(stand);
      const stage = { pattern: note.pattern, pieces: note.pieces, spread: note.spread, spin: note.spin, fall: 0, duration: FLIGHT_MS, keep: true, tint: note.tint, seed: note.seed };
      try { entry.handle = renderer.start({ mesh: stand, center: centre, w: d.width, h: d.height, id, document: { elevation: box.elevation } }, stage, note.cutAngle); }
      catch (error) { console.warn("Animater prop wreckage: no pieces", error); }
    }
    const frame = (t) => { entry.handle?.update(t); grow(t); speckG.alpha = Math.min(1, t * 1.5); };
    if (!animate) { frame(1); return; }
    // Only a break seen happening is heard; a wreck redrawn on load stays silent. The note's seed gives every screen the same pick.
    try {
      const { file, splash } = propSound(materialOf(d), contents, seededRandom(note.seed));
      playSound(file, centre); if (splash) playSound(splash, centre);
    } catch (error) { console.warn("Animater prop wreckage: no sound", error); }
    const t0 = performance.now(); let raf = 0;
    entry.stop = () => { cancelAnimationFrame(raf); entry.stop = null; };
    const tick = () => {
      const t = Math.min(1, (performance.now() - t0) / FLIGHT_MS);
      frame(t);
      if (t < 1) raf = requestAnimationFrame(tick); else entry.stop = null;
    };
    frame(0); raf = requestAnimationFrame(tick);
  }

  // Draws every hidden tile that has a note and removes the rest; a wreck already drawn is left alone.
  function sync(tiles) {
    const want = wreckTargets(tiles), ids = new Set(want.map((w) => w.id)), byId = new Map((tiles ?? []).map((t) => [(t.document ?? t).id, t]));
    for (const id of [...wrecks.keys()]) if (!ids.has(id)) hide(id);
    for (const { id, note } of want) {
      if (wrecks.has(id)) continue;
      const tile = byId.get(id), contents = (tile.document ?? tile).flags?.animater?.prop?.contents ?? "none";
      show(tile, note, contents, { animate: false });
    }
  }

  function clear() {
    for (const id of [...wrecks.keys()]) hide(id);
    for (const t of artTextures.values()) if (t) quiet(() => t.destroy(true));
    artTextures.clear();
  }

  return { show, hide, sync, clear };
}
