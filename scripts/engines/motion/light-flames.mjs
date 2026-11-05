// Flames on the map's fire lights: a torch, brazier or campfire light placed where the map draws no fire gets the held
// torch's own flame (held-torch.mjs: rising noise shaped and coloured by heat), flickering, with a faint warm halo and a
// glowing heart; it leans with the draft where the air moves (indoor-air.mjs). A brazier or a campfire burns as a bed of
// tongues across its bowl, the middle ones tallest, over glowing coals. Over the lighting (fire gives light), on this
// screen only.

import { flameMesh, flicker, flameTint, tintFlame } from './held-torch.mjs';

// Whether a tile drawn now covers a place (pure): flames are drawn over the darkness, so nothing else hides one under a roof or a tree. `tiles` [{ elevation, alpha, visible, covers(point), fixtureReach? }], by the tile's own picture so a gap in the leaves is open; a roof that has faded for someone inside hides nothing, nor does one below the fire.
// A map's foreground picture holds wall sconces as well as roofs, and a torch light stands right on its sconce. With `fixtureReach` (px) it hides a fire only if it also covers most of the ground around it, as a roof does and a sconce on a wall does not. A tile a GM has placed is taken at its word, however small.
const FIXTURE_AROUND = 6;
const coversAround = (t, { x, y }, reach) => { let n = 0; for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4; if (t.covers({ x: x + Math.cos(a) * reach, y: y + Math.sin(a) * reach })) n++; } return n >= FIXTURE_AROUND; };
export const underTile = (tiles, point, elevation = 0) => tiles.some((t) => t.visible !== false && Number(t.elevation) > Number(elevation) && (t.alpha ?? 1) >= 0.3 && t.covers(point) && (!(t.fixtureReach > 0) || coversAround(t, point, t.fixtureReach)));

// How much of a tile is drawn at a place (pure). Foundry fades a roof in its shader and leaves the tile's own alpha alone, so this reads what the shader does: `state` the tile's occlusion amounts { fade, radial, vision }, whole for a fade, and for the other two only where a creature below the tile reaches: `reaches` [{ elevation, radial(point), vision(point) }].
export const tileDrawnAt = ({ alpha = 1, unoccludedAlpha = 1, occludedAlpha = 0, elevation = 0, state = {} } = {}, reaches = [], point = null) => {
  let occlusion = Number(state.fade) || 0;
  const radial = Number(state.radial) || 0, vision = Number(state.vision) || 0;
  if (point && (radial > 0 || vision > 0)) for (const r of reaches) {
    if (!(Number(r.elevation) < Number(elevation))) continue;
    if (radial > 0 && r.radial?.(point)) occlusion = Math.max(occlusion, radial);
    if (vision > 0 && r.vision?.(point)) occlusion = Math.max(occlusion, vision);
  }
  return (Number(alpha) || 0) * (unoccludedAlpha + (occludedAlpha - unoccludedAlpha) * Math.min(1, occlusion));
};

// How big a light's flame is (pure, px of the flame's height unit): by the fire's size (fire-smoke.mjs fireSize, 0.3–2.5),
// a torch's about a third of a square, a big brazier's half again as tall.
export const flameUnit = (size = 1, grid = 100) => grid * 0.22 * Math.sqrt(Math.min(2.5, Math.max(0.3, size)) * 2) * 0.75;

// The kinds of fire (pure): a torch one tongue; a brazier a bed across a bowl about a square wide; a bonfire a wider,
// taller bed. Auto: one flame (maps light their candles and lanterns with Foundry's flame animation too); a bed is chosen.
export const FIRE_KINDS = ['torch', 'brazier', 'bonfire'];
export const fireKindOf = (flag) => FIRE_KINDS.includes(flag) ? flag : 'torch';

// The tongues of a fire (pure): where each stands from the fire's middle (px) and how tall it is (times the unit). One for
// a torch; a brazier one big flame with two smaller pressed against it (they burn together as one fire), a bonfire a
// bigger one with four round it. The middle one tallest, the others drawn behind it.
export function fireTongues(kind = 'torch', grid = 100) {
  if (kind === 'brazier') return [{ x: -grid * 0.08, y: -grid * 0.02, scale: 1.1 }, { x: grid * 0.08, y: -grid * 0.01, scale: 1.2 }, { x: 0, y: 0, scale: 1.7 }];
  if (kind === 'bonfire') return [{ x: -grid * 0.2, y: -grid * 0.03, scale: 1.2 }, { x: grid * 0.2, y: -grid * 0.02, scale: 1.3 }, { x: -grid * 0.1, y: grid * 0.02, scale: 1.6 }, { x: grid * 0.1, y: grid * 0.03, scale: 1.5 }, { x: 0, y: grid * 0.01, scale: 2.2 }];
  return [{ x: 0, y: 0, scale: 1 }];
}

/** The layer: sync([{ key, x, y, unit, color, kind, grid, visible }]) keeps one fire a light; look(lean(key) -> -1..1) leans them; tick(t); clear(). */
export function createLightFlames({ PIXI, root }) {
  const flames = new Map();
  // One soft round glow (white at its middle, fading to nothing at its edge), drawn once and shared: each flame's halo
  // and heart are this, tinted, sized and faded each frame. (Redrawing them as shapes every frame for every fire light
  // made the garbage that stalled the canvas.)
  let glowTex = null;
  const glow = () => {
    if (glowTex && !glowTex.baseTexture?.destroyed) return glowTex;
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    // Even steps of alpha, as the stacked circles gave: densest at the middle, nothing at the rim.
    grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.45, 'rgba(255,255,255,0.55)'); grad.addColorStop(0.8, 'rgba(255,255,255,0.15)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
    return (glowTex = PIXI.Texture.from(c));
  };
  const glowSprite = () => { const s = new PIXI.Sprite(glow()); s.anchor.set(0.5); s.eventMode = 'none'; return s; };
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
          const box = new PIXI.Container(), halo = glowSprite(), heart = glowSprite(), tongues = [];
          box.eventMode = 'none'; box.addChild(halo, heart);
          fireTongues(kind, spec.grid ?? spec.unit * 4).forEach((t, i) => {
            const made = flameMesh(PIXI, Math.max(2, Math.round(spec.unit * t.scale)), (flames.size * 7.31 + i * 13.7) % 97);
            if (!made) return;
            made.mesh.position.set(t.x, t.y); box.addChild(made.mesh); tongues.push({ ...made, key: i ? `${spec.key}:${i}` : spec.key });
          });
          if (!tongues.length) { box.destroy({ children: true }); continue; }
          root().addChild(box);
          f = { box, halo, heart, tongues, unit: spec.unit, kind, spread: kind === 'torch' ? 0 : Math.max(...fireTongues(kind, spec.grid ?? spec.unit * 4).map((t) => Math.hypot(t.x, t.y))), lean: 0 };
          flames.set(spec.key, f);
        }
        f.box.position.set(spec.x, spec.y);
        f.box.visible = spec.visible !== false;
        f.tint = flameTint(spec.color);
        for (const t of f.tongues) tintFlame(t.shader, f.tint);
      }
      for (const [key, f] of flames) if (!want.has(key)) { drop(f); flames.delete(key); }
    },
    look(lean = () => 0) { for (const [key, f] of flames) f.aim = Number(lean(key)) || 0; },
    tick(t) {
      for (const [, f] of flames) {
        if (!f.box.visible) continue;
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
          const r = (f.unit + f.spread) * (0.9 + 0.1 * (tall - 1));
          f.halo.tint = f.tint ? f.tint.hex : 0xff8a30; f.halo.position.set(0, -r * 0.3); f.halo.width = f.halo.height = r * 2; f.halo.alpha = 0.16;
          // The heart: a soft warm glow at the flame's root, fading out to nothing (no rim: a solid one read as a coin).
          const hx = f.unit * 0.2 + f.spread * 0.6, hy = f.unit * 0.08 + f.spread * 0.3, heat = 0.07 + 0.03 * (tall - 1);
          f.heart.tint = f.tint ? f.tint.hex : 0xff5a10; f.heart.width = hx * 2; f.heart.height = hy * 2; f.heart.alpha = Math.min(1, heat * 5);
        } catch { /* mid-teardown: the next sync drops it */ }
      }
    },
    clear() { for (const f of flames.values()) drop(f); flames.clear(); },
    get count() { return flames.size; },
  };
}
