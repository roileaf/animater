// Flames on the map's fire lights: a torch, brazier or campfire light placed where the map draws no fire gets the held
// torch's own flame (held-torch.mjs: rising noise shaped and coloured by heat), flickering, with a faint warm halo and a
// glowing heart; it leans with the draft where the air moves (indoor-air.mjs). A brazier or a campfire burns as a bed of
// tongues across its bowl, the middle ones tallest, over glowing coals. Over the lighting (fire gives light), on this
// screen only.

import { flameMesh, flicker, flameTint, tintFlame } from './held-torch.mjs';

// How big a light's flame is (pure, px of the flame's height unit): by the fire's size (fire-smoke.mjs fireSize, 0.3–2.5),
// a torch's about a third of a square, a big brazier's half again as tall.
export const flameUnit = (size = 1, grid = 100) => grid * 0.22 * Math.sqrt(Math.min(2.5, Math.max(0.3, size)) * 2) * 0.75;

// The kinds of fire (pure): a torch one tongue; a brazier a bed across a bowl about a square wide; a bonfire a wider,
// taller bed. Auto: a light animated as a torch burns as one, a flame or fire as a brazier.
export const FIRE_KINDS = ['torch', 'brazier', 'bonfire'];
export const fireKindOf = (flag, animation = '') => FIRE_KINDS.includes(flag) ? flag : /torch/i.test(String(animation)) ? 'torch' : /flame|fire/i.test(String(animation)) ? 'brazier' : 'torch';

// The tongues of a fire (pure): where each stands from the fire's middle (px) and how tall it is (times the unit). One for
// a torch; a brazier one big flame with two smaller pressed against it (they burn together as one fire), a bonfire a
// bigger one with four round it. The middle one tallest, the others drawn behind it.
export function fireTongues(kind = 'torch', grid = 100) {
  if (kind === 'brazier') return [{ x: -grid * 0.08, y: -grid * 0.02, scale: 1.1 }, { x: grid * 0.08, y: -grid * 0.01, scale: 1.2 }, { x: 0, y: 0, scale: 1.7 }];
  if (kind === 'bonfire') return [{ x: -grid * 0.2, y: -grid * 0.03, scale: 1.2 }, { x: grid * 0.2, y: -grid * 0.02, scale: 1.3 }, { x: -grid * 0.1, y: grid * 0.02, scale: 1.6 }, { x: grid * 0.1, y: grid * 0.03, scale: 1.5 }, { x: 0, y: grid * 0.01, scale: 2.2 }];
  return [{ x: 0, y: 0, scale: 1 }];
}

/** The layer: sync([{ key, x, y, unit, color, kind, grid }]) keeps one fire a light; look(lean(key) -> -1..1) leans them; tick(t); clear(). */
export function createLightFlames({ PIXI, root }) {
  const flames = new Map();
  const drop = (f) => { try { f.box.destroy({ children: true }); } catch { /* gone */ } };
  return {
    sync(list = []) {
      const want = new Set();
      for (const spec of list) {
        want.add(spec.key);
        const kind = spec.kind ?? 'torch';
        let f = flames.get(spec.key);
        if (f && (f.unit !== spec.unit || f.kind !== kind)) { drop(f); flames.delete(spec.key); f = null; }
        if (!f) {
          const box = new PIXI.Container(), halo = new PIXI.Graphics(), tongues = [];
          box.eventMode = 'none'; box.addChild(halo);
          fireTongues(kind, spec.grid ?? spec.unit * 4).forEach((t, i) => {
            const made = flameMesh(PIXI, Math.max(2, Math.round(spec.unit * t.scale)), (flames.size * 7.31 + i * 13.7) % 97);
            if (!made) return;
            made.mesh.position.set(t.x, t.y); box.addChild(made.mesh); tongues.push({ ...made, key: i ? `${spec.key}:${i}` : spec.key });
          });
          if (!tongues.length) { box.destroy({ children: true }); continue; }
          root().addChild(box);
          f = { box, halo, tongues, unit: spec.unit, kind, spread: kind === 'torch' ? 0 : Math.max(...fireTongues(kind, spec.grid ?? spec.unit * 4).map((t) => Math.hypot(t.x, t.y))), lean: 0 };
          flames.set(spec.key, f);
        }
        f.box.position.set(spec.x, spec.y);
        f.tint = flameTint(spec.color);
        for (const t of f.tongues) tintFlame(t.shader, f.tint);
      }
      for (const [key, f] of flames) if (!want.has(key)) { drop(f); flames.delete(key); }
    },
    look(lean = () => 0) { for (const [key, f] of flames) f.aim = Number(lean(key)) || 0; },
    tick(t) {
      for (const [, f] of flames) {
        try {
          let tall = 0;
          f.lean += ((f.aim ?? 0) - f.lean) * 0.08;
          for (const tongue of f.tongues) {
            const k = flicker(tongue.key, t), u = tongue.shader.uniforms;
            u.uTime = t; u.uLean = (f.lean + k.sway) * 2.5; u.uAlpha = 1;
            tongue.mesh.scale.set(k.width, k.height);
            tall += k.height / f.tongues.length;
          }
          // The heart where it burns (a bed of coals under a brazier's), and a faint warm halo round it.
          const g = f.halo, r = (f.unit + f.spread) * (0.9 + 0.1 * (tall - 1)), hex = f.tint ? f.tint.hex : 0xff8a30;
          g.clear();
          for (let i = 10; i >= 1; i--) { g.beginFill(hex, 0.016); g.drawCircle(0, -r * 0.3, r * Math.sqrt(i / 10)); g.endFill(); }
          // The heart: a soft warm glow at the flame's root, fading out to nothing (no rim: a solid one read as a coin).
          const hx = f.unit * 0.2 + f.spread * 0.6, hy = f.unit * 0.08 + f.spread * 0.3, heat = 0.07 + 0.03 * (tall - 1);
          for (let i = 5; i >= 1; i--) { g.beginFill(f.tint ? f.tint.hex : 0xff5a10, heat); g.drawEllipse(0, 0, hx * (i / 5), hy * (i / 5)); g.endFill(); }
        } catch { /* mid-teardown: the next sync drops it */ }
      }
    },
    clear() { for (const f of flames.values()) drop(f); flames.clear(); },
    get count() { return flames.size; },
  };
}
