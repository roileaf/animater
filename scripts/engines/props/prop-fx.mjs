// Small painted fire effects the wreckage draws (approved mock "Breaking more", scene 4 onward): flames seen from above,
// a soft glow, embers, smoke puffs and a flash. Each call adds its drawing to `parent` and returns a handle
// {update(ms), destroy()}; ms is the time since the effect's own start, so a redraw at any time draws the same frame.
import { seededRandom as stream } from "../fragments/fragments.mjs";

const TAU = Math.PI * 2;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const span = (t, a, d) => clamp01((t - a) / d);
const lerp = (a, b, u) => a + (b - a) * u;
const outCubic = (u) => 1 - (1 - u) ** 3;
const INK = 0x1a1410;

// The flame's stepped tones, outermost first: [colour, alpha, share of the radius].
export const FLAME = [[0x8e2410, 0.92, 1], [0xd8601c, 0.95, 0.72], [0xf4b443, 0.95, 0.46], [0xfde69a, 0.9, 0.22]];
export const FLICKER_MS = 70; // a new shape about 14 times a second

// One flame from above into Graphics g: tongues around a hot core, leaning one way (screen up by default).
export function paintFlame(g, x, y, s, t, seed, alpha = 1, lean = -Math.PI / 2) {
  if (s < 0.5 || alpha <= 0) return;
  const r = stream(seed * 7919 + Math.floor(t / FLICKER_MS) * 13), n = 5 + Math.floor(r() * 3), ph = r() * TAU;
  const tongues = Array.from({ length: n }, () => 0.6 + r() * 0.8);
  for (const [c, a, k] of FLAME) {
    const pts = [];
    for (let i = 0; i < 24; i++) {
      const ang = (i / 24) * TAU, turn = ((ang + ph) / TAU) * n, ti = Math.floor(turn) % n, local = turn % 1;
      const tongue = Math.sin(local * Math.PI) ** 2.5 * tongues[ti] * 0.55, leanK = 1 + 0.6 * Math.max(0, Math.cos(ang - lean));
      const rr = s * k * (0.42 + tongue * leanK) * (0.9 + r() * 0.2);
      pts.push(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr);
    }
    g.beginFill(c, a * alpha).drawPolygon(pts).endFill();
  }
}

export function createPropFx({ PIXI }) {
  let glowTex = null;
  // A white radial falloff, tinted per use.
  const glowTexture = () => {
    if (glowTex && !glowTex.baseTexture?.destroyed) return glowTex;
    const c = document.createElement("canvas"); c.width = c.height = 256;
    const x = c.getContext("2d"), gr = x.createRadialGradient(128, 128, 0, 128, 128, 128);
    gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.35, "rgba(255,255,255,0.55)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = gr; x.fillRect(0, 0, 256, 256);
    glowTex = PIXI.Texture.from(c);
    return glowTex;
  };
  const gone = (o) => { try { o.destroy(); } catch { /* already gone */ } };

  // spots: [{x, y, s, seed, start}] (s: flame radius in px, start: ms it catches). opts: end (ms the fire is out),
  // dieMs (how long it dies down before end), lean. handle.heat is the mean of the flames' strength at the last update.
  function flames(parent, spots, { end = Infinity, dieMs = 1400, lean } = {}) {
    const g = new PIXI.Graphics(); parent.addChild(g);
    const handle = {
      heat: 0, graphics: g,
      update(t) {
        g.clear();
        const die = 1 - span(t, end - dieMs, dieMs);
        let heat = 0;
        for (const f of spots) {
          const k = span(t, f.start ?? 0, 400) * die;
          if (k <= 0) continue;
          heat += k; paintFlame(g, f.x, f.y, f.s * (0.5 + 0.5 * k), t, f.seed ?? 0, Math.min(1, k * 1.5), lean);
        }
        handle.heat = spots.length ? heat / spots.length : 0;
      },
      destroy() { gone(g); },
    };
    return handle;
  }

  // An added (bright) glow of radius r at `at`; handle.level(k) sets its strength 0-1, and update(ms) flickers it.
  // add: false lays it down plainly instead (a soft dark soot under a scorch); squash and angle flatten and turn it.
  function glow(parent, at, r, colour, { alpha = 0.5, flicker = true, add = true, squash = 1, angle = 0 } = {}) {
    const s = new PIXI.Sprite(glowTexture()); s.anchor.set(0.5); s.width = r * 2; s.height = r * 2 * squash; s.rotation = angle; s.tint = colour; s.position.set(at.x, at.y);
    if (add) s.blendMode = PIXI.BLEND_MODES.ADD;
    parent.addChild(s);
    let k = 1;
    const handle = {
      sprite: s,
      level(v) { k = clamp01(v); },
      update(t) { const fl = flicker ? 0.85 + 0.15 * Math.sin(t * 0.02) * Math.sin(t * 0.007) : 1; s.alpha = alpha * k * fl; },
      destroy() { gone(s); },
    };
    handle.update(0);
    return handle;
  }

  // Embers: small hot points that drift and dim. list: [{x, y, vx, vy, s, ph, at, life}] (px over the ember's life, ms).
  function embers(parent, list) {
    const g = new PIXI.Graphics(); g.blendMode = PIXI.BLEND_MODES.ADD; parent.addChild(g);
    return {
      update(t) {
        g.clear();
        for (const e of list) {
          const r = span(t, e.at, e.life); if (r <= 0 || r >= 1) continue;
          const x = e.x + e.vx * r + Math.sin(t * 0.004 + e.ph) * 4, y = e.y + e.vy * r, a = (1 - r) * (0.6 + 0.4 * Math.sin(t * 0.03 + e.ph));
          g.beginFill(0xff8a2a, a * 0.35).drawCircle(x, y, e.s * 2.4).endFill();
          g.beginFill(0xffd27a, a).drawCircle(x, y, e.s).endFill();
        }
      },
      destroy() { gone(g); },
    };
  }

  // Smoke, dust or a fireball: painted puffs (lobes in the given tones, a faint ink rim) that grow, drift and fade.
  // list: [{x, y, vx, vy, r0, r1, a, at, life, seed}]; tones: colours, or functions of the puff's life 0-1.
  function puffs(parent, list, tones, { ink = INK, inkA = 0.12 } = {}) {
    const g = new PIXI.Graphics(); parent.addChild(g);
    return {
      update(t) {
        g.clear();
        for (const p of list) {
          const r = span(t, p.at, p.life); if (r <= 0 || r >= 1) continue;
          const u = outCubic(r), rr = lerp(p.r0, p.r1, u), x = p.x + p.vx * u, y = p.y + p.vy * u, a = p.a * (r < 0.15 ? r / 0.15 : 1 - (r - 0.15) / 0.85);
          const rnd = stream(p.seed ?? 0);
          tones.forEach((c, i) => {
            const k = 1 - i * 0.28;
            for (let l = 0; l < 5; l++) {
              const la = rnd() * TAU, ld = rr * 0.35 * rnd(), pts = [];
              for (let q = 0; q < 10; q++) { const qa = (q / 10) * TAU, qr = rr * k * (0.55 + rnd() * 0.18); pts.push(x + Math.cos(la) * ld + Math.cos(qa) * qr, y + Math.sin(la) * ld + Math.sin(qa) * qr); }
              g.lineStyle(i === 0 ? 1 : 0, ink, inkA * a).beginFill(typeof c === "function" ? c(r) : c, a * 0.45).drawPolygon(pts).endFill();
            }
          });
        }
      },
      destroy() { gone(g); },
    };
  }

  // A quick bright flash at `at` that swells and fades over dur ms.
  function flash(parent, at, r, { dur = 220, colour = 0xfff0c0 } = {}) {
    const h = glow(parent, at, r, colour, { alpha: 1, flicker: false }), s = h.sprite;
    return {
      update(t) { const u = span(t, 0, dur); s.visible = u > 0 && u < 1; s.alpha = 1 - u; s.width = s.height = r * 2 * (0.4 + 0.8 * outCubic(u)); },
      destroy() { h.destroy(); },
    };
  }

  // Frees the shared glow texture (the canvas is torn down).
  function clear() { if (glowTex) { try { glowTex.destroy(true); } catch { /* gone */ } glowTex = null; } }

  return { flames, glow, embers, puffs, flash, clear };
}
