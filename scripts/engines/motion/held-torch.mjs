// Held torches (the "Creatures hold their torches" setting): a creature whose own light is a fire (animated as a
// torch or flame) holds a small burning torch at the edge of its token. As a real torch: a wooden handle, a head of
// pitch-soaked wrapping glowing with embers, and the flame growing out of it — widest and hottest (near white) at the
// head, licking upward in turbulent tongues that turn orange, then red, and break off at the tips — with a few sparks
// drifting up. The flame is a small shader (rising noise, shaped and coloured by heat), leaning back as the creature
// moves. Its smoke rises from the flame (fire-smoke.mjs). Drawn above the tokens on this screen only; nothing is saved.

const TAU = Math.PI * 2;
const hash = (text) => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
};

// Which side of its token a creature holds its torch (Token configuration → Animater torch held in): nothing in the art
// says where its hands are, so it is the token's choice — 1 right (the default), -1 left, 0 no torch drawn (its light
// stays Foundry's own, from the middle).
export const torchSide = (flag) => (flag === 'none' ? 0 : flag === 'left' ? -1 : 1);

// Where the torch sits on a token drawn at (x, y) (its centre) and `width` wide: the hand near the rim of the token on
// its side, a little below the middle, the handle leaning out and up; `tip` is the torch's head, where the flame starts.
// `side` -1 holds it on the left. Sizes follow the token, within reason (a Huge creature's torch is not a tree).
export function torchPose({ x, y, width = 100, side = 1 } = {}, grid = 100) {
  const w = Math.min(Number(width) || grid, grid * 2.2), s = side < 0 ? -1 : 1;
  // Held inside the token's square: the hand well in from its edge and the torch fairly upright, so the flame burns
  // within the creature's own space, not over the next square.
  const length = Math.max(grid * 0.28, w * 0.38), angle = -Math.PI / 2 + s * 0.28;
  const hand = { x: x + s * (Number(width) || grid) * 0.34, y: y + (Number(width) || grid) * 0.12 };
  const tip = { x: hand.x + Math.cos(angle) * length, y: hand.y + Math.sin(angle) * length }, flame = length * 0.72;
  // The fire itself burns straight up from the head: `heat` the middle of the flame (where the air shimmers), `top`
  // its tips (where the smoke leaves).
  return { hand, tip, angle, length, flame, heat: { x: tip.x, y: tip.y - flame * 0.55 }, top: { x: tip.x, y: tip.y - flame * 1.0 } };
}

// The flame's flicker at `t` seconds for a torch seeded by `key`: height and width factors (around 1) and a sway, from
// a few unrelated waves so it never visibly repeats.
export function flicker(key, t) {
  const p = hash(String(key)) * TAU;
  const n = (f, o) => Math.sin(t * f + p * o);
  return {
    height: 1 + 0.14 * n(9.1, 1) + 0.08 * n(17.3, 2) + 0.05 * n(31.7, 3),
    width: 1 + 0.08 * n(11.7, 4) + 0.05 * n(23.1, 5),
    sway: 0.1 * n(5.3, 6) + 0.05 * n(13.9, 7),
  };
}

// The flame: a quad from the torch head up, its fragments coloured by "heat" — rising fbm noise inside a tapering
// tongue, broken up more the higher it goes. vUv.y is 0 at the top of the quad, 1 at the head.
const FLAME_VERT = `
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
const FLAME_FRAG = `
precision mediump float;
varying vec2 vUv;
uniform float uTime;
uniform float uSeed;
uniform float uLean;
uniform float uAlpha;
uniform float uSpread;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
void main() {
  float y = 1.0 - vUv.y;                       // 0 at the head, 1 at the top
  float x = (vUv.x - 0.5) * uSpread;          // the quad is wider than the flame, so leaning tongues never hit its edge
  x -= uLean * y * y * 0.3;                    // leaning back as the creature moves
  vec2 q = vec2(x * 5.0, y * 3.2 - uTime * 2.8) + uSeed;
  float n = fbm(q);
  float m = fbm(q * 1.9 + vec2(0.0, -uTime * 1.3));
  // The tongue: widest just above the head, tapering to a point; its edges wander with the noise, more so higher up.
  float width = mix(0.3, 0.04, pow(y, 0.8)) * (0.55 + 0.9 * n) + 0.08 * (1.0 - y) * (1.0 - y);
  float edge = abs(x + (m - 0.5) * 0.34 * y);
  float shape = 1.0 - smoothstep(width * 0.2, width, edge);
  // Its height, broken into licks that tear off at the tips.
  float body = 1.0 - smoothstep(0.35, 0.95, y + (n - 0.5) * 0.6 * y);
  float heat = shape * body;
  // Rounded where it wraps the head (no flat bottom edge), and uneven inside: hotter and cooler pockets churning.
  heat *= smoothstep(0.0, 0.16, y - abs(x) * 0.45 + 0.04);
  heat = clamp(heat * (0.72 + 0.6 * m) * (1.2 - 0.5 * y), 0.0, 1.0);
  // Hottest near white at the root, yellow, orange, deep red at the tips.
  vec3 col = mix(vec3(0.45, 0.05, 0.0), vec3(0.95, 0.32, 0.02), smoothstep(0.08, 0.38, heat));
  col = mix(col, vec3(1.0, 0.7, 0.18), smoothstep(0.38, 0.68, heat));
  col = mix(col, vec3(1.0, 0.93, 0.72), smoothstep(0.78, 1.0, heat) * (1.0 - y) * smoothstep(0.35, 0.7, n));
  // Its edges thin out to nothing (no dark rim); its body is solid, so the art under it never shows through.
  float alpha = smoothstep(0.1, 0.42, heat) * uAlpha;
  gl_FragColor = vec4(col * alpha, alpha);
}`;

// The flame quad around (0, 0), its base there and rising `h` along -y, `w` wide. A shared geometry per size class is
// not worth it: one small quad per torch.
const flameGeometry = (PIXI, w, h) => new PIXI.Geometry()
  .addAttribute('aVertexPosition', [-w / 2, -h, w / 2, -h, w / 2, 0, -w / 2, 0], 2)
  .addAttribute('aUvs', [0, 0, 1, 0, 1, 1, 0, 1], 2)
  .addIndex([0, 1, 2, 0, 2, 3]);

// A flame mesh of its own (for other fires: a lantern's candle), its base at (0, 0), `unit` tall as a torch's `flame`;
// null where shaders are unavailable. Its shader's uniforms are `uTime`, `uLean` and `uAlpha`.
export function flameMesh(PIXI, unit, seed = 0) {
  if (typeof PIXI?.Mesh !== 'function' || typeof PIXI?.Shader?.from !== 'function') return null;
  try {
    const shader = PIXI.Shader.from(FLAME_VERT, FLAME_FRAG, { uTime: 0, uSeed: seed, uLean: 0, uAlpha: 1, uSpread: 2.6 / 1.3 });
    return { shader, mesh: new PIXI.Mesh(flameGeometry(PIXI, unit * 2.6, unit * 1.45), shader) };
  } catch { return null; }
}

// A teardrop flame shape (the fallback where shaders are unavailable), pointing up along -y from its base.
export const teardrop = (g, h, w) => {
  g.moveTo(0, 0);
  g.bezierCurveTo(w * 0.6, -h * 0.05, w * 0.55, -h * 0.55, 0, -h);
  g.bezierCurveTo(-w * 0.55, -h * 0.55, -w * 0.6, -h * 0.05, 0, 0);
};

// Sparks: a few embers leaving the heart of the flame now and then, rising close to its axis and drifting a little
// further out as they go, cooling from yellow to red as they fade.
export function embers(key, t, { count = 5, period = 1.1 } = {}) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const seed = hash(`${key}:${i}`), cycle = period * (0.8 + 0.5 * seed), at = t / cycle + seed * 7;
    const n = Math.floor(at), age = at - n, r = hash(`${key}:${i}:${n}`);
    if (r < 0.35) continue;                    // not every cycle throws a spark
    out.push({ x: (r - 0.5) * 0.14 + Math.sin(age * 5 + r * 9) * 0.05 * age, y: -age * (0.9 + 0.6 * r), life: 1 - age, size: 0.035 + 0.03 * r });
  }
  return out;
}

// The drawing: one container per held torch, above the tokens. `sync(list)` keeps one per torch
// [{ key, x, y, width, side, lean, visible }] and `tick(t)` animates them. The handle sits in `root` with the scene
// (lit as the scene is); the flame, its sparks and its halo in `lightRoot` (above the lighting: fire gives light, it is
// not lit), the same root when there is none.
export function createHeldTorches({ PIXI, root, lightRoot = root, grid = () => 100 }) {
  const torches = new Map();
  const make = (key) => {
    const box = new PIXI.Container(), fire = new PIXI.Container();
    box.eventMode = 'none'; fire.eventMode = 'none';
    const glow = new PIXI.Graphics(), handle = new PIXI.Graphics(), sparks = new PIXI.Graphics(), drawn = new PIXI.Graphics(), ghost = new PIXI.Graphics();
    if (PIXI.BLEND_MODES?.ADD !== undefined) { glow.blendMode = PIXI.BLEND_MODES.ADD; sparks.blendMode = PIXI.BLEND_MODES.ADD; }
    fire.addChild(glow, drawn);
    root().addChild(box);
    const lit = lightRoot();
    // The fire envelops the head: the stick and its wrapped head, then the flame in front of the head's upper part,
    // then the wrap's dark shape faintly over the flame's root (seen through the fire, as in any torch), then sparks.
    if (lit === root()) box.addChild(handle, fire, ghost, sparks); else { box.addChild(handle); lit.addChild(fire); box.addChild(ghost, sparks); }
    return { box, fire, glow, handle, sparks, drawn, ghost, mesh: null, shader: null, seed: hash(String(key)) * 50, drawnFor: null };
  };
  // The head's measures: a wrap of oil-soaked cloth round the stick's end, `top` to `bottom`, `half` wide each side at
  // its widest; the flame roots at `root`, low on it, so the fire covers most of the wrap.
  const headOf = (pose) => {
    const len = pose.length, w = Math.max(3, len * 0.12), top = -len, bottom = -len + len * 0.3;
    return { w, top, bottom, half: w * 0.95, root: top + (bottom - top) * 0.7 };
  };
  // The wrap's outline: slightly bulging, rounded at the top, narrowing onto the stick.
  const wrapShape = (pose) => {
    const { w, top, bottom, half } = headOf(pose), h = bottom - top;
    return [-half * 0.75, top, half * 0.75, top, half, top + h * 0.2, half * 0.95, top + h * 0.75, w * 0.6, bottom, -w * 0.6, bottom, -half * 0.95, top + h * 0.75, -half, top + h * 0.2];
  };
  // A plain fantasy torch: a stick of wood, its end wrapped in rags soaked in pitch, charred dark where it burns.
  const drawHead = (torch, pose) => {
    const { handle, ghost } = torch, len = pose.length, { w, top, bottom, half } = headOf(pose), outline = Math.max(1, w * 0.14);
    handle.clear();
    // The stick: rough wood, a touch narrower toward the hand.
    handle.lineStyle(outline, 0x140b05, 0.9);
    handle.beginFill(0x7a4e2a, 1).drawPolygon([-w * 0.5, bottom - len * 0.02, w * 0.5, bottom - len * 0.02, w * 0.38, 0, -w * 0.38, 0]).endFill();
    handle.lineStyle(0);
    handle.beginFill(0xa06a3a, 0.6).drawPolygon([-w * 0.28, bottom, -w * 0.1, bottom, -w * 0.08, -len * 0.04, -w * 0.2, -len * 0.04]).endFill();
    // The wrap: dark rags round the end, a few turns of cloth showing, glowing where the fire has them.
    handle.lineStyle(outline, 0x0e0804, 0.9);
    handle.beginFill(0x2a1a0f, 1).drawPolygon(wrapShape(pose)).endFill();
    handle.lineStyle(Math.max(0.8, w * 0.1), 0x4d3320, 0.7);
    const h = bottom - top;
    for (const k of [0.35, 0.58, 0.8]) { handle.moveTo(-half * 0.95, top + h * (k + 0.06)); handle.lineTo(half * 0.95, top + h * (k - 0.06)); }
    handle.lineStyle(0);
    handle.beginFill(0xc8460e, 0.75).drawPolygon([-half * 0.7, top + h * 0.05, half * 0.7, top + h * 0.05, half * 0.85, top + h * 0.35, -half * 0.85, top + h * 0.35]).endFill();
    // The wrap seen through the lower flame: the same shape, faint and dark, over the fire.
    ghost.clear();
    ghost.beginFill(0x2a1206, 0.3).drawPolygon(wrapShape(pose)).endFill();
  };
  const drop = (torch) => {
    for (const part of [torch.fire, torch.box]) { try { if (!part.destroyed) part.destroy({ children: true }); } catch { /* gone */ } }
  };
  const makeFlame = (torch, pose) => {
    // Read when first drawn: the module loads before PIXI is up (and in tests, without it).
    if (typeof PIXI?.Mesh !== 'function' || typeof PIXI?.Shader?.from !== 'function') return;
    try {
      // Twice as wide as the flame itself (uSpread maps it back), so a leaning, swaying tongue is never cut off.
      const w = pose.flame * 2.6, h = pose.flame * 1.45;
      torch.shader = PIXI.Shader.from(FLAME_VERT, FLAME_FRAG, { uTime: 0, uSeed: torch.seed, uLean: 0, uAlpha: 1, uSpread: 2.6 / 1.3 });
      torch.mesh?.destroy();
      torch.mesh = new PIXI.Mesh(flameGeometry(PIXI, w, h), torch.shader);
      torch.fire.addChildAt(torch.mesh, torch.fire.children.indexOf(torch.drawn));
    } catch { torch.mesh = null; }
  };
  return {
    sync(list = []) {
      const seen = new Set();
      for (const t of list) {
        if (!t?.visible) continue;
        seen.add(t.key);
        let torch = torches.get(t.key);
        if (!torch || torch.box.destroyed || torch.fire.destroyed) { if (torch) drop(torch); torches.set(t.key, torch = make(t.key)); }
        torch.spec = t;
      }
      for (const [key, torch] of torches) if (!seen.has(key)) { drop(torch); torches.delete(key); }
    },
    tick(seconds) {
      for (const [key, torch] of torches) {
        try {
          const spec = torch.spec, pose = torchPose(spec, grid());
          if (torch.drawnFor !== pose.length) { drawHead(torch, pose); makeFlame(torch, pose); torch.drawnFor = pose.length; }
          const tilt = pose.angle + Math.PI / 2;
          torch.box.position.set(pose.hand.x, pose.hand.y);
          torch.box.rotation = tilt;
          if (torch.fire.parent !== torch.box) { torch.fire.position.set(pose.hand.x, pose.hand.y); torch.fire.rotation = tilt; }
          const f = flicker(key, seconds), lean = (spec.lean ?? 0) + f.sway, head = { x: 0, y: -pose.length + pose.length * 0.04 };
          // The flame starts a little down the head, so it wraps it as it burns.
          const root = { x: head.x, y: headOf(pose).root };
          const { drawn, glow, sparks } = torch;
          drawn.clear(); glow.clear(); sparks.clear();
          if (torch.mesh && !torch.mesh.destroyed) {
            // Upright whatever the handle's tilt: flames burn up.
            torch.mesh.position.set(root.x, root.y);
            // Leaving the head along the stick, its tips bending back up (the shader's lean curves them toward
            // upright), as a tilted torch's fire does.
            torch.mesh.rotation = -tilt * 0.3;
            // A little wider than the wrap, so the fire closes round it.
            torch.mesh.scale.set(1.1 * f.width, f.height);
            const u = torch.shader.uniforms;
            u.uTime = seconds; u.uLean = lean * 2.5 - 2.5 * tilt; u.uAlpha = 1;
          } else {
            const h = pose.flame * 1.4 * f.height, w = pose.flame * 0.6 * f.width;
            drawn.position.set(head.x, head.y);
            drawn.rotation = -tilt - lean;
            drawn.beginFill(0xc8380a, 0.85); teardrop(drawn, h, w); drawn.endFill();
            drawn.beginFill(0xff8a1e, 0.9); teardrop(drawn, h * 0.7, w * 0.7); drawn.endFill();
            drawn.beginFill(0xffe8a8, 1); teardrop(drawn, h * 0.4, w * 0.42); drawn.endFill();
          }
          // The head glowing where it burns, and a faint warm halo (never a disc in daylight).
          const r = pose.flame * (0.9 + 0.1 * (f.height - 1));
          for (let i = 14; i >= 1; i--) { glow.beginFill(0xff8a30, 0.014); glow.drawCircle(head.x, head.y - r * 0.3, r * Math.sqrt(i / 14)); glow.endFill(); }
          glow.beginFill(0xff5a10, 0.5 + 0.2 * (f.height - 1)).drawEllipse(head.x, head.y + pose.length * 0.02, pose.length * 0.09, pose.length * 0.035).endFill();
          // Sparks, in the flame's upright frame.
          const cos = Math.cos(-tilt), sin = Math.sin(-tilt), unit = pose.flame * 2;
          for (const e of embers(key, seconds)) {
            const ex = e.x * unit * 0.5, ey = e.y * unit;
            const px = head.x + ex * cos - ey * sin, py = head.y - pose.flame * 0.4 + ex * sin + ey * cos;
            sparks.beginFill(e.life > 0.6 ? 0xffd27a : e.life > 0.3 ? 0xff8a2a : 0xd2401a, Math.min(1, e.life * 1.6));
            sparks.drawCircle(px, py, Math.max(0.6, e.size * unit * 0.25));
            sparks.endFill();
          }
        } catch { /* a torch mid-teardown: the next sync drops it */ }
      }
    },
    clear() { for (const torch of torches.values()) drop(torch); torches.clear(); },
    get size() { return torches.size; },
  };
}
