// Held lanterns (with "Creatures hold their torches and lanterns"): a creature carrying a lantern (an item named for one,
// held or equipped) has its light hang from its hand as a small lantern, swaying as it walks. As a real one: a wire bail
// to hold it by, a vented iron cap and chimney, a cage of three glass panes (the two side ones turned away, darker)
// between iron posts, a stepped base, and inside a candle whose flame (the torch's flame shader, small) lights the
// glass from within, catching a glint on the panes. Its light comes from the lantern. Drawn above the tokens on this
// screen only; nothing is saved.
import { torchPose, flicker, flameMesh, teardrop, flameTint, tintFlame, mixHex } from './held-torch.mjs';

// Where the lantern hangs on a token at (x, y), `width` wide, held on `side`: from the hand, its body below it.
// `centre` is the glass (where the light comes from).
export function lanternPose({ x, y, width = 100, side = 1 } = {}, grid = 100) {
  const { hand } = torchPose({ x, y, width, side }, grid), w = Math.min(Number(width) || grid, grid * 2.2);
  // About two-thirds of a torch's length (a lantern is a foot and a half, a torch two to three feet).
  const size = Math.max(grid * 0.22, w * 0.3);
  return { hand, size, centre: { x: hand.x, y: hand.y + size * 0.62 } };
}

// How far it swings at `t` seconds (radians): a slow idle sway, more as the creature moves (`lean`, as torches lean).
export const lanternSwing = (key, t, lean = 0) => {
  const f = flicker(key, t * 0.25);
  return 0.05 * Math.sin(t * 1.7 + f.sway * 3) - lean * 0.9;
};

const hash = (text) => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
};

// The lantern's measures, in its size `s`, down from the hand at (0, 0): the cage of glass from `top` to `bottom`,
// `outer` wide each side (narrowing a little to its foot), its panes meeting at `join`; the candle's wick at `wick`.
const CAGE = { top: 0.37, bottom: 0.84, outer: [0.28, 0.25], join: [0.14, 0.125], wick: 0.67 };
const cageShape = (s) => [-CAGE.outer[0] * s, CAGE.top * s, CAGE.outer[0] * s, CAGE.top * s, CAGE.outer[1] * s, CAGE.bottom * s, -CAGE.outer[1] * s, CAGE.bottom * s];
// One pane (-1 left, 0 front, 1 right) as a polygon.
const paneShape = (s, k) => {
  const [ot, ob] = CAGE.outer, [jt, jb] = CAGE.join, t = CAGE.top * s, b = CAGE.bottom * s;
  if (k === 0) return [-jt * s, t, jt * s, t, jb * s, b, -jb * s, b];
  return k < 0 ? [-ot * s, t, -jt * s, t, -jb * s, b, -ob * s, b] : [jt * s, t, ot * s, t, ob * s, b, jb * s, b];
};

const IRON = { outline: 0x0a0807, dark: 0x1e1a16, mid: 0x3b342d, light: 0x7a6c5c };

// One lantern per carrier. `sync(list)` keeps one per [{ key, x, y, width, side, lean, visible, color }]; `tick(t)`.
export function createHeldLanterns({ PIXI, root, grid = () => 100 }) {
  const lanterns = new Map();
  const make = (key) => {
    const box = new PIXI.Container(), flame = new PIXI.Container();
    const halo = new PIXI.Graphics(), inside = new PIXI.Graphics(), candle = new PIXI.Graphics(), drawn = new PIXI.Graphics();
    const glass = new PIXI.Graphics(), body = new PIXI.Graphics();
    box.eventMode = 'none';
    if (PIXI.BLEND_MODES?.ADD !== undefined) halo.blendMode = PIXI.BLEND_MODES.ADD;
    flame.addChild(drawn);
    // Back to front: the halo, the lit inside of the cage, the candle and its flame, the glass over them, the iron.
    box.addChild(halo, inside, candle, flame, glass, body);
    root().addChild(box);
    return { box, halo, inside, candle, flame, drawn, glass, body, mesh: null, shader: null, seed: hash(String(key)) * 50, drawnFor: null };
  };
  const drop = (l) => { try { if (!l.box.destroyed) l.box.destroy({ children: true }); } catch { /* gone */ } };
  // The parts that never change at one size: the iron, the glass's tint and glints, the candle.
  const drawStill = (l, s) => {
    const g = l.body, edge = Math.max(0.8, s * 0.025);
    g.clear();
    // The bail: a wire arching from the cap's sides up to the hand.
    g.lineStyle(Math.max(0.9, s * 0.03), IRON.dark, 1);
    g.moveTo(-0.3 * s, 0.33 * s).bezierCurveTo(-0.34 * s, 0.08 * s, -0.12 * s, 0, 0, 0).bezierCurveTo(0.12 * s, 0, 0.34 * s, 0.08 * s, 0.3 * s, 0.33 * s);
    g.lineStyle(Math.max(0.5, s * 0.012), IRON.light, 0.5);
    g.moveTo(-0.31 * s, 0.3 * s).bezierCurveTo(-0.33 * s, 0.09 * s, -0.12 * s, 0.012 * s, 0, 0.012 * s);
    // The chimney: a short vented drum with a domed lid, where the candle's smoke leaves.
    g.lineStyle(edge, IRON.outline, 1);
    g.beginFill(IRON.mid, 1).drawRect(-0.07 * s, 0.13 * s, 0.14 * s, 0.08 * s).endFill();
    g.beginFill(IRON.dark, 1).drawEllipse(0, 0.13 * s, 0.085 * s, 0.035 * s).endFill();
    g.lineStyle(0);
    for (const vx of [-0.035, 0, 0.035]) g.beginFill(0x080605, 1).drawRect((vx - 0.009) * s, 0.155 * s, 0.018 * s, 0.035 * s).endFill();
    // The cap: a sloping iron hood, lit on its left, over a rim.
    g.lineStyle(edge, IRON.outline, 1);
    g.beginFill(IRON.mid, 1).drawPolygon([-0.09 * s, 0.21 * s, 0.09 * s, 0.21 * s, 0.31 * s, 0.33 * s, -0.31 * s, 0.33 * s]).endFill();
    g.lineStyle(0);
    g.beginFill(IRON.light, 0.45).drawPolygon([-0.09 * s, 0.21 * s, -0.02 * s, 0.21 * s, -0.12 * s, 0.33 * s, -0.31 * s, 0.33 * s]).endFill();
    g.beginFill(IRON.dark, 0.6).drawPolygon([0.05 * s, 0.21 * s, 0.09 * s, 0.21 * s, 0.31 * s, 0.33 * s, 0.17 * s, 0.33 * s]).endFill();
    // The rims holding the glass, top and bottom, with rivets.
    g.lineStyle(edge, IRON.outline, 1);
    g.beginFill(IRON.dark, 1).drawRoundedRect(-0.33 * s, 0.33 * s, 0.66 * s, 0.045 * s, 0.015 * s).endFill();
    g.beginFill(IRON.dark, 1).drawRoundedRect(-0.3 * s, 0.83 * s, 0.6 * s, 0.045 * s, 0.015 * s).endFill();
    // The posts between the panes: the outer two and the two where the front pane meets the sides.
    const post = (top, bottom, w) => g.drawPolygon([top - w, CAGE.top * s, top + w, CAGE.top * s, bottom + w, CAGE.bottom * s, bottom - w, CAGE.bottom * s]);
    g.beginFill(IRON.mid, 1);
    for (const k of [-1, 1]) {
      post(k * CAGE.outer[0] * s, k * CAGE.outer[1] * s, 0.022 * s);
      post(k * CAGE.join[0] * s, k * CAGE.join[1] * s, 0.016 * s);
    }
    g.endFill();
    g.lineStyle(0);
    for (const rx of [-0.27, -0.14, 0.14, 0.27]) {
      g.beginFill(IRON.light, 0.8).drawCircle(rx * s, 0.352 * s, Math.max(0.5, 0.01 * s)).endFill();
      g.beginFill(IRON.light, 0.6).drawCircle(rx * 0.92 * s, 0.852 * s, Math.max(0.5, 0.01 * s)).endFill();
    }
    // The base: a stepped iron foot.
    g.lineStyle(edge, IRON.outline, 1);
    g.beginFill(IRON.mid, 1).drawPolygon([-0.28 * s, 0.875 * s, 0.28 * s, 0.875 * s, 0.23 * s, 0.95 * s, -0.23 * s, 0.95 * s]).endFill();
    g.beginFill(IRON.dark, 1).drawRoundedRect(-0.17 * s, 0.95 * s, 0.34 * s, 0.04 * s, 0.01 * s).endFill();
    g.lineStyle(0);
    g.beginFill(IRON.light, 0.4).drawPolygon([-0.28 * s, 0.875 * s, -0.1 * s, 0.875 * s, -0.08 * s, 0.95 * s, -0.23 * s, 0.95 * s]).endFill();

    // The glass: faintly tinted, the side panes turned away (darker), a glint down the front and the left pane.
    const gl = l.glass;
    gl.clear();
    gl.beginFill(0xfff0d0, 0.06).drawPolygon(cageShape(s)).endFill();
    for (const k of [-1, 1]) gl.beginFill(0x000000, 0.28).drawPolygon(paneShape(s, k)).endFill();
    gl.beginFill(0xffffff, 0.32).drawPolygon([-0.105 * s, 0.4 * s, -0.075 * s, 0.4 * s, -0.085 * s, 0.8 * s, -0.112 * s, 0.8 * s]).endFill();
    gl.beginFill(0xffffff, 0.14).drawPolygon([-0.06 * s, 0.4 * s, -0.05 * s, 0.4 * s, -0.056 * s, 0.62 * s, -0.064 * s, 0.62 * s]).endFill();
    gl.beginFill(0xffffff, 0.18).drawPolygon([-0.24 * s, 0.4 * s, -0.22 * s, 0.4 * s, -0.205 * s, 0.78 * s, -0.222 * s, 0.78 * s]).endFill();

    // The candle: a stub of wax on the base, shaded round, a drip down its side, a dark wick.
    const c = l.candle, cw = 0.06 * s, top = (CAGE.wick + 0.02) * s, foot = CAGE.bottom * s;
    c.clear();
    c.beginFill(0xe9dcc0, 1).drawRect(-cw, top, cw * 2, foot - top).endFill();
    c.beginFill(0xbfa985, 0.85).drawRect(cw * 0.35, top, cw * 0.65, foot - top).endFill();
    c.beginFill(0xfff6e0, 0.7).drawRect(-cw * 0.75, top, cw * 0.3, foot - top).endFill();
    c.beginFill(0xf4ead2, 1).drawEllipse(0, top, cw, cw * 0.35).endFill();
    c.beginFill(0xe9dcc0, 1).drawRoundedRect(-cw * 0.95, top, cw * 0.32, (foot - top) * 0.45, cw * 0.16).endFill();
    c.lineStyle(Math.max(0.6, s * 0.012), 0x1a120c, 1).moveTo(0, top).lineTo(0.005 * s, CAGE.wick * s);
  };
  const makeFlame = (l, s) => {
    try { l.mesh?.destroy(); } catch { /* gone */ }
    const made = flameMesh(PIXI, s * 0.17, l.seed);
    l.mesh = made?.mesh ?? null; l.shader = made?.shader ?? null;
    if (l.mesh) l.flame.addChildAt(l.mesh, 0);
  };
  return {
    sync(list = []) {
      const seen = new Set();
      for (const l of list) {
        if (!l?.visible) continue;
        seen.add(l.key);
        let lantern = lanterns.get(l.key);
        if (!lantern || lantern.box.destroyed) { if (lantern) drop(lantern); lanterns.set(l.key, lantern = make(l.key)); }
        lantern.spec = l;
      }
      for (const [key, l] of lanterns) if (!seen.has(key)) { drop(l); lanterns.delete(key); }
    },
    tick(seconds) {
      for (const [key, l] of lanterns) {
        try {
          const spec = l.spec, pose = lanternPose(spec, grid()), s = pose.size;
          if (l.drawnFor !== s) { drawStill(l, s); makeFlame(l, s); l.drawnFor = s; }
          const swing = lanternSwing(key, seconds, spec.lean ?? 0);
          l.box.position.set(pose.hand.x, pose.hand.y);
          l.box.rotation = swing;
          const f = flicker(key, seconds), heat = Math.max(0.75, Math.min(1.15, f.height)), tint = flameTint(spec.color);
          // Warm by default; a coloured light (flameTint) burns and lights the cage in its own colour.
          const warm = (hex, k = 0) => (tint ? mixHex(tint.hex, k > 0 ? 0xffffff : 0x000000, Math.abs(k)) : hex);
          // The flame on the wick, burning upright as the lantern swings, its tip trailing the swing a little.
          l.flame.position.set(0.005 * s, CAGE.wick * s);
          l.flame.rotation = -swing;
          l.drawn.clear();
          if (l.mesh && !l.mesh.destroyed) {
            l.mesh.scale.set(0.8 * f.width, 0.9 * f.height);
            const u = l.shader.uniforms;
            u.uTime = seconds * 0.8; u.uLean = f.sway * 1.5 + swing * 3; u.uAlpha = 1;
            tintFlame(l.shader, tint);
          } else {
            const h = s * 0.16 * f.height, w = s * 0.07 * f.width;
            l.drawn.beginFill(warm(0xff8a1e), 0.9); teardrop(l.drawn, h, w); l.drawn.endFill();
            l.drawn.beginFill(0xfff0b8, 1); teardrop(l.drawn, h * 0.55, w * 0.55); l.drawn.endFill();
          }
          // The inside of the cage: dark behind, lit warm round the flame, brightest at it, flickering with it.
          const g = l.inside, cy = (CAGE.wick - 0.06) * s;
          g.clear();
          g.beginFill(warm(0x3a1d0a, -0.8), 1).drawPolygon(cageShape(s)).endFill();
          g.beginFill(warm(0xb0581a, -0.3), 0.6 * heat).drawPolygon(cageShape(s)).endFill();
          for (let i = 6; i >= 1; i--) {
            const k = i / 6;
            g.beginFill(k > 0.5 ? warm(0xf09030) : warm(0xffd27a, 0.5), 0.22 * heat).drawEllipse(0, cy, s * 0.3 * k, s * 0.34 * k).endFill();
          }
          // A soft warm halo around the glass.
          l.halo.clear();
          for (let i = 12; i >= 1; i--) l.halo.beginFill(warm(0xffa040, 0.2), 0.016 * heat).drawCircle(0, s * 0.6, s * 1.5 * Math.sqrt(i / 12)).endFill();
        } catch { /* a lantern mid-teardown: the next sync drops it */ }
      }
    },
    clear() { for (const l of lanterns.values()) drop(l); lanterns.clear(); },
    get size() { return lanterns.size; },
  };
}
