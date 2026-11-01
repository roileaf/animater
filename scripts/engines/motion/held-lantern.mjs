// Held lanterns (with "Creatures hold their torches and lanterns"): a creature carrying a lantern (an item named for one,
// held or equipped) has its light hang from its hand as a small lantern — a ring to hold it by, an iron cap and base,
// glass glowing warm with a flickering flame inside — swaying as it walks. Its light comes from the lantern. Drawn above
// the tokens on this screen only; nothing is saved.
import { torchPose, flicker } from './held-torch.mjs';

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

// One lantern per carrier. `sync(list)` keeps one per [{ key, x, y, width, side, lean, visible, color }]; `tick(t)`.
export function createHeldLanterns({ PIXI, root, grid = () => 100 }) {
  const lanterns = new Map();
  const make = () => {
    const box = new PIXI.Container(), halo = new PIXI.Graphics(), body = new PIXI.Graphics(), glass = new PIXI.Graphics();
    box.eventMode = 'none';
    if (PIXI.BLEND_MODES?.ADD !== undefined) halo.blendMode = PIXI.BLEND_MODES.ADD;
    box.addChild(halo, glass, body);
    root().addChild(box);
    return { box, halo, body, glass, drawnFor: null };
  };
  const drop = (l) => { try { if (!l.box.destroyed) l.box.destroy({ children: true }); } catch { /* gone */ } };
  // The iron: a ring to hold it by, a cap, corner bars and a base, all hanging from (0, 0).
  const drawIron = (l, s) => {
    const g = l.body, iron = 0x24201c, edge = Math.max(1, s * 0.07);
    g.clear();
    g.lineStyle(edge, iron, 1).drawCircle(0, s * 0.08, s * 0.1);
    g.lineStyle(edge * 0.6, 0x5a5048, 0.9).moveTo(-s * 0.08, s * 0.06).lineTo(s * 0.08, s * 0.06);
    g.lineStyle(0).beginFill(iron, 1).drawPolygon([-s * 0.18, s * 0.18, s * 0.18, s * 0.18, s * 0.3, s * 0.3, -s * 0.3, s * 0.3]).endFill();
    g.beginFill(iron, 1).drawRoundedRect(-s * 0.32, s * 0.9, s * 0.64, s * 0.12, s * 0.04).endFill();
    for (const bx of [-0.27, 0, 0.27]) g.beginFill(iron, 1).drawRect(s * bx - edge * 0.5, s * 0.3, edge, s * 0.6).endFill();
  };
  return {
    sync(list = []) {
      const seen = new Set();
      for (const l of list) {
        if (!l?.visible) continue;
        seen.add(l.key);
        let lantern = lanterns.get(l.key);
        if (!lantern || lantern.box.destroyed) { if (lantern) drop(lantern); lanterns.set(l.key, lantern = make()); }
        lantern.spec = l;
      }
      for (const [key, l] of lanterns) if (!seen.has(key)) { drop(l); lanterns.delete(key); }
    },
    tick(seconds) {
      for (const [key, l] of lanterns) {
        try {
          const spec = l.spec, pose = lanternPose(spec, grid()), s = pose.size;
          if (l.drawnFor !== s) { drawIron(l, s); l.drawnFor = s; }
          l.box.position.set(pose.hand.x, pose.hand.y);
          l.box.rotation = lanternSwing(key, seconds, spec.lean ?? 0);
          // The glass: warm light, brighter at the flame, flickering with it.
          const f = flicker(key, seconds), heat = Math.max(0.75, Math.min(1.15, f.height));
          l.glass.clear();
          l.glass.beginFill(0xd9861e, 0.95).drawRoundedRect(-s * 0.27, s * 0.3, s * 0.54, s * 0.6, s * 0.05).endFill();
          l.glass.beginFill(0xffc75a, 0.9).drawEllipse(0, s * 0.62, s * 0.2 * f.width, s * 0.24 * heat).endFill();
          l.glass.beginFill(0xfff4c8, 1).drawEllipse(0, s * 0.66, s * 0.07 * f.width, s * 0.12 * heat).endFill();
          // A soft warm halo around the glass.
          l.halo.clear();
          for (let i = 12; i >= 1; i--) l.halo.beginFill(0xffa040, 0.016 * heat).drawCircle(0, s * 0.6, s * 1.5 * Math.sqrt(i / 12)).endFill();
        } catch { /* a lantern mid-teardown: the next sync drops it */ }
      }
    },
    clear() { for (const l of lanterns.values()) drop(l); lanterns.clear(); },
    get size() { return lanterns.size; },
  };
}
