// Floating light orbs (the "Creatures carry their lights" setting, with held torches): a creature lit by a Light spell
// (PF2e's Spell Effect: Light or Everlight, D&D's Light, Daggerheart's…) has its light float at its shoulder as a small
// glowing orb — a bright core with light churning inside it, a soft halo, a few motes circling — bobbing gently, its
// colour the light's own. The token's light comes from the orb (as a torch's from its flame). Drawn above the tokens
// on this screen only; nothing is saved.

const TAU = Math.PI * 2;
const hash = (text) => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
};

// Effects that make a creature's light a conjured orb, by name (with or without "Spell Effect:" / "Effect:").
const ORB_SPELLS = /^(?:(?:spell\s+)?effect\s*:\s*)?(?:light|everlight|continual flame|dancing lights?|faerie light|light orb|glowing orb)$/i;
export const isOrbEffect = (name) => ORB_SPELLS.test(String(name ?? '').trim());

// What a creature's own light is drawn as: 'orb' (a light spell), 'lantern' (it holds a lantern), 'torch' (a fire light),
// or null (left as Foundry draws it). `choice` is the token's own (Token configuration → Animater light shown as): ''
// decides from what it holds, its light and its effects; 'lantern', 'torch', 'orb' or 'none' force it. `held`: the items
// it holds or has equipped, as names or { name, light } (`light` the light the item gives, { animation, bright, dim },
// as PF2e's TokenLight rules say); `light` the token's light now, the same shape.
const LANTERN = /\blantern\b/i, TORCH = /\b(?:torch|candle|candlecap)\b/i;
const sameLight = (a, b) => !!a && !!b && ['animation', 'bright', 'dim'].every((k) => a[k] == null || b[k] == null || a[k] === b[k]) && (a.animation != null || a.bright != null);
export function heldLightKind({ choice = '', fire = false, effects = [], held = [], light = null } = {}) {
  if (choice === 'none') return null;
  if (choice === 'torch' || choice === 'orb' || choice === 'lantern') return choice;
  // A Light spell running is the light it gives, even with a lantern in hand.
  if ([...effects].some(isOrbEffect)) return 'orb';
  const items = [...held].map((h) => (typeof h === 'object' && h ? { name: String(h.name ?? ''), light: h.light ?? null } : { name: String(h), light: null }));
  // The item whose light the token has now (a lit torch beside an unlit lantern, or the other way round).
  const giver = items.find((i) => sameLight(i.light, light) && (LANTERN.test(i.name) || TORCH.test(i.name)));
  if (giver) return LANTERN.test(giver.name) ? 'lantern' : 'torch';
  // Else a torch in hand with a fire light is the torch; a lantern carried, the lantern.
  if (fire && items.some((i) => TORCH.test(i.name) && !LANTERN.test(i.name))) return 'torch';
  if (items.some((i) => LANTERN.test(i.name))) return 'lantern';
  return fire ? 'torch' : null;
}

// How many lights a creature's light spell makes: Dancing Lights several wisps circling it, any other one orb.
export const orbCount = (effects = []) => ([...effects].some((n) => /dancing lights?/i.test(String(n))) ? 4 : 1);

// Where the orb floats over a token at (x, y) (its centre), `width` wide, at `t` seconds: above the shoulder on `side`
// (1 right, -1 left), bobbing and drifting a little. `rest` is where it hangs without the bob (the light's origin).
// A wisp (`wisp`: { i, of }) instead circles the creature slowly, smaller, each on its own part of the ring.
export function orbPose({ x, y, width = 100, side = 1, key = '', wisp = null } = {}, grid = 100, t = 0) {
  const w = Math.min(Number(width) || grid, grid * 2.2), s = side < 0 ? -1 : 1, p = hash(String(key)) * TAU;
  if (wisp?.of > 1) {
    const a = t * 0.45 + (wisp.i / wisp.of) * TAU + 0.3 * Math.sin(t * 0.9 + p), reach = w * (0.55 + 0.06 * Math.sin(t * 1.3 + p));
    const at = { x: x + Math.cos(a) * reach, y: y + Math.sin(a) * reach * 0.8 + Math.sin(t * 2.4 + p) * w * 0.03 };
    return { rest: { x, y }, at, radius: Math.max(grid * 0.055, w * 0.075) };
  }
  const rest = { x: x + s * w * 0.3, y: y - w * 0.3 };
  const bob = { x: Math.sin(t * 0.7 + p) * w * 0.02, y: Math.sin(t * 2.2 + p) * w * 0.03 };
  return { rest, at: { x: rest.x + bob.x, y: rest.y + bob.y }, radius: Math.max(grid * 0.06, w * 0.085) };
}

// A light's colour as a number, or a soft warm-white when it has none.
export const orbColor = (color) => {
  const n = typeof color === 'string' ? parseInt(color.replace('#', ''), 16) : Number(color);
  return Number.isFinite(n) && n > 0 ? n : 0xfff1d0;
};

// Motes circling the orb at `t`: [{ x, y, size, alpha }] in orb radii from its centre.
export function orbMotes(key, t, count = 4) {
  return Array.from({ length: count }, (_, i) => {
    const seed = hash(`${key}:${i}`), a = t * (0.6 + seed * 0.8) * (i % 2 ? 1 : -1) + seed * TAU, r = 1.5 + 0.6 * Math.sin(t * 1.3 + seed * 9);
    return { x: Math.cos(a) * r, y: Math.sin(a) * r * 0.6, size: 0.08 + 0.06 * seed, alpha: 0.45 + 0.4 * (0.5 + 0.5 * Math.sin(t * 3 + seed * 13)) };
  });
}

const ORB_VERT = `
precision highp float;
attribute vec2 aVertexPosition;
attribute vec2 aUvs;
uniform mat3 translationMatrix;
uniform mat3 projectionMatrix;
varying vec2 vUv;
void main() {
  vUv = aUvs;
  gl_Position = vec4((projectionMatrix * translationMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);
}`;
// A bright core whose light churns (slow rising noise), fading through the light's colour into a soft halo.
const ORB_FRAG = `
precision mediump float;
varying vec2 vUv;
uniform float uTime;
uniform float uSeed;
uniform vec3 uColor;
uniform float uPulse;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.1 + 11.0; a *= 0.5; } return v; }
void main() {
  vec2 p = (vUv - 0.5) * 2.0;                  // -1..1 over the quad; the orb itself is the middle third
  float r = length(p) * 3.0;
  float churn = fbm(p * 6.0 + vec2(uSeed, uSeed - uTime * 0.9)) - 0.5;
  // The light's own colour, made a little richer, so even a near-white light reads as coloured light, not paint.
  vec3 tint = clamp(mix(vec3(dot(uColor, vec3(0.333))), uColor, 2.4), 0.0, 1.0);
  tint = mix(tint, vec3(0.78, 0.88, 1.0), 0.35 * step(0.9, dot(uColor, vec3(0.333))));
  float core = 1.0 - smoothstep(0.35 + 0.15 * churn, 0.9, r);    // the orb, its rim wavering
  float hot = 1.0 - smoothstep(0.0, 0.5 + 0.2 * churn, r);        // its white-hot heart, churning
  float halo = exp(-r * r * 0.42) * (0.5 + 0.18 * uPulse);       // the bloom around it
  vec3 col = mix(tint, vec3(1.0), clamp(hot + 0.25 * churn * core, 0.0, 1.0));
  float alpha = clamp(core * 0.92 + halo * 0.55 * (1.0 - core), 0.0, 1.0);
  gl_FragColor = vec4(col * alpha, alpha);
}`;

const quad = (PIXI, size) => new PIXI.Geometry()
  .addAttribute('aVertexPosition', [-size, -size, size, -size, size, size, -size, size], 2)
  .addAttribute('aUvs', [0, 0, 1, 0, 1, 1, 0, 1], 2)
  .addIndex([0, 1, 2, 0, 2, 3]);

// One orb per lit creature, above the tokens. `sync(list)` keeps one per [{ key, x, y, width, side, color, visible }];
// `tick(t)` animates them.
export function createLightOrbs({ PIXI, root, grid = () => 100 }) {
  const orbs = new Map();
  const make = (key) => {
    const box = new PIXI.Container(), motes = new PIXI.Graphics();
    box.eventMode = 'none';
    if (PIXI.BLEND_MODES?.ADD !== undefined) motes.blendMode = PIXI.BLEND_MODES.ADD;
    box.addChild(motes);
    root().addChild(box);
    return { box, motes, mesh: null, shader: null, seed: hash(String(key)) * 40, size: null };
  };
  const drop = (orb) => { try { if (!orb.box.destroyed) orb.box.destroy({ children: true }); } catch { /* gone */ } };
  return {
    sync(list = []) {
      const seen = new Set();
      for (const o of list) {
        if (!o?.visible) continue;
        seen.add(o.key);
        let orb = orbs.get(o.key);
        if (!orb || orb.box.destroyed) { if (orb) drop(orb); orbs.set(o.key, orb = make(o.key)); }
        orb.spec = o;
      }
      for (const [key, orb] of orbs) if (!seen.has(key)) { drop(orb); orbs.delete(key); }
    },
    tick(seconds) {
      for (const [key, orb] of orbs) {
        try {
          const spec = orb.spec, pose = orbPose({ ...spec, key }, grid(), seconds), size = pose.radius * 3;
          orb.box.position.set(pose.at.x, pose.at.y);
          if (orb.size !== size && typeof PIXI?.Mesh === 'function' && typeof PIXI?.Shader?.from === 'function') {
            orb.mesh?.destroy();
            orb.shader = PIXI.Shader.from(ORB_VERT, ORB_FRAG, { uTime: 0, uSeed: orb.seed, uColor: [1, 1, 1], uPulse: 0 });
            orb.mesh = new PIXI.Mesh(quad(PIXI, size), orb.shader);
            orb.box.addChildAt(orb.mesh, 0);
            orb.size = size;
          }
          const c = orbColor(spec.color), rgb = [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255];
          if (orb.shader) { const u = orb.shader.uniforms; u.uTime = seconds; u.uColor = rgb; u.uPulse = Math.sin(seconds * 2.4 + orb.seed); }
          orb.motes.clear();
          for (const m of orbMotes(key, seconds)) {
            orb.motes.beginFill(c, m.alpha * 0.8).drawCircle(m.x * pose.radius, m.y * pose.radius, Math.max(0.7, m.size * pose.radius)).endFill();
            orb.motes.beginFill(0xffffff, m.alpha * 0.6).drawCircle(m.x * pose.radius, m.y * pose.radius, Math.max(0.4, m.size * pose.radius * 0.45)).endFill();
          }
        } catch { /* an orb mid-teardown: the next sync drops it */ }
      }
    },
    clear() { for (const orb of orbs.values()) drop(orb); orbs.clear(); },
    get size() { return orbs.size; },
  };
}
