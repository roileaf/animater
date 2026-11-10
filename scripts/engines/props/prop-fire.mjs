// The fires a break starts (burning lamp oil, a plant burning away) burn with the module's own torch flame: the held
// torch's tongues (held-torch.mjs flameMesh: rising noise shaped and coloured by heat), flickering, with the warm halo
// and glowing heart of a fire light (light-flames.mjs), leaning with the draft. Like a fire light's flame it is drawn
// over the lighting (fire gives light), and only where this screen can see it: `seen(key, at, elevation)` is the same
// test light-flames' fires get (main.mjs: fog and vision, then roofs and trees drawn over it). It is not the "Flames on
// fire lights" setting's: a prop fire always burns while it burns, but its tongues follow the quality tier as a fire
// light's do (`tongues()` false: halo, heart and sparks only). On this screen only; the layout is the note's.
import { flameMesh } from "../motion/held-torch.mjs";
import { fireGlowTexture, fireGlow, burnTongue } from "../motion/light-flames.mjs";

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const hash = (text) => { let h = 2166136261; for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619); return (h >>> 0) / 4294967296; };
const LOOK_MS = 200; // how often a fire asks whether it is seen and which way the air leans it

// root(): the container over the lighting (null: the fire draws into the wreck's own container); seen(key, at,
// elevation) -> false hides it; lean(key, at) -> -1..1 the draft and wind on it; tongues() -> false draws no tongues;
// forget(key): a fire under that key (and its tongues' "key:i") is gone, so whatever seen() keeps for it can go too.
export function createTorchFires({ PIXI, root = () => null, seen = () => true, lean = () => 0, tongues: tonguesOn = () => true, forget = () => {} }) {
  let glowTex = null;
  const glow = () => (glowTex && !glowTex.baseTexture?.destroyed ? glowTex : (glowTex = fireGlowTexture(PIXI)));
  const sprite = (tint) => { const s = new PIXI.Sprite(glow()); s.anchor.set(0.5); s.eventMode = "none"; s.tint = tint; return s; };

  // One fire: spec { key, at (its middle, world px), elevation, unit (px), spread (px its bed reaches from the middle),
  // tongues [{x, y, scale}] (world px where each stands) }. fallback: the container it draws into without a root.
  // handle.sparks: a container in the fire for its embers. handle.update(ms, frame) draws it ms after it caught;
  // frame(i) -> { level 0-1, x?, y? } for tongue i (level 0: out; x, y: where it stands now). heat: the mean level.
  // perTongue: each tongue is looked at where it stands ("key:i"), not only the fire's middle, so a big plant burning
  // half out of sight still shows the half in sight; the halo and heart show while the middle or any tongue is seen.
  function fire(fallback, { key, at, elevation = 0, unit, spread = 0, tongues = [], perTongue = false }) {
    const box = new PIXI.Container(); box.eventMode = "none";
    const halo = sprite(0xff8a30), heart = sprite(0xff5a10);
    halo.position.set(at.x, at.y); heart.position.set(at.x, at.y);
    box.addChild(halo, heart);
    const live = tongues.map((t, i) => {
      if (!tonguesOn()) return null;
      const made = flameMesh(PIXI, Math.max(2, Math.round(unit * t.scale)), (hash(`${key}:${i}`) * 97) % 97);
      if (!made) return null;
      made.mesh.position.set(t.x, t.y); box.addChild(made.mesh);
      return { ...made, key: `${key}:${i}` };
    });
    const sparks = new PIXI.Container(); sparks.eventMode = "none"; box.addChild(sparks);
    (root() ?? fallback).addChild(box);
    let lookedAt = -Infinity, shown = true, aim = 0, leaning = 0, gone = false;
    const sees = (k, p) => { try { return seen(k, p, elevation) !== false; } catch { return true; } };
    const tongueSeen = tongues.map(() => true);
    const handle = {
      box, sparks, heat: 0,
      update(ms, frame = () => ({ level: 1 })) {
        if (box.destroyed) return;
        const frames = tongues.map((_, i) => frame(i) ?? { level: 0 });
        if (ms - lookedAt >= LOOK_MS || ms < lookedAt) {
          lookedAt = ms;
          shown = sees(key, at);
          if (perTongue) tongues.forEach((spec, i) => {
            const f = frames[i], m = live[i]?.mesh;
            const p = Number.isFinite(f.x) && Number.isFinite(f.y) ? { x: f.x, y: f.y } : m && !m.destroyed && Number.isFinite(m.position?.x) ? { x: m.position.x, y: m.position.y } : { x: spec.x, y: spec.y };
            tongueSeen[i] = sees(`${key}:${i}`, p);
          });
          try { aim = Math.max(-1, Math.min(1, Number(lean(key, at)) || 0)); } catch { aim = 0; }
        }
        const any = perTongue && tongueSeen.some(Boolean);
        box.visible = shown || any;
        halo.visible = heart.visible = shown || any;
        leaning += (aim - leaning) * 0.08;
        const t = ms / 1000;
        let heat = 0, tall = 0, burning = 0;
        tongues.forEach((spec, i) => {
          const f = frames[i], k = clamp01(f.level), tongue = live[i];
          heat += k;
          if (!tongue || tongue.mesh.destroyed) return;
          tongue.mesh.visible = k > 0.01 && (!perTongue || tongueSeen[i]);
          if (!tongue.mesh.visible) return;
          if (Number.isFinite(f.x) && Number.isFinite(f.y)) tongue.mesh.position.set(f.x, f.y);
          tall += burnTongue(tongue, t, leaning, { alpha: Math.min(1, k * 1.5), size: 0.5 + 0.5 * k }); burning++;
        });
        handle.heat = tongues.length ? heat / tongues.length : 0;
        // The heart where it burns (the patch's glowing bed), and a faint warm halo round it, both fading with the fire.
        const g = fireGlow({ unit, spread, tall: burning ? tall / burning : 1, heat: handle.heat });
        halo.position.set(at.x, at.y + g.halo.y); halo.width = halo.height = g.halo.size; halo.alpha = g.halo.alpha;
        heart.width = g.heart.w; heart.height = g.heart.h; heart.alpha = g.heart.alpha;
      },
      destroy() {
        try { if (!box.destroyed) box.destroy({ children: true }); } catch { /* gone */ }
        if (!gone) { gone = true; try { forget(key); } catch { /* nothing kept */ } }
      },
    };
    return handle;
  }

  // A container over the lighting for a moment's fire (a keg's fireball, flash and glow), shown by the same rule as a
  // fire: hidden where this screen cannot see its middle. update(ms) looks five times a second.
  function over(fallback, { key, at, elevation = 0 }) {
    const box = new PIXI.Container(); box.eventMode = "none";
    (root() ?? fallback).addChild(box);
    let lookedAt = -Infinity, gone = false;
    return {
      box,
      update(ms) {
        if (box.destroyed || !(ms - lookedAt >= LOOK_MS || ms < lookedAt)) return;
        lookedAt = ms;
        try { box.visible = seen(key, at, elevation) !== false; } catch { box.visible = true; }
      },
      destroy() {
        try { if (!box.destroyed) box.destroy({ children: true }); } catch { /* gone */ }
        if (!gone) { gone = true; try { forget(key); } catch { /* nothing kept */ } }
      },
    };
  }

  // Frees the shared glow texture (the canvas is torn down).
  function clear() { if (glowTex) { try { glowTex.destroy(true); } catch { /* gone */ } glowTex = null; } }

  return { fire, over, clear };
}
