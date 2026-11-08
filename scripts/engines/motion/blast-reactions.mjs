// What an energy blast does to the creatures it catches (engines/motion/energy-blast.mjs plays the blast itself): fire
// sets them alight a while, cold rimes them with frost, lightning crackles round them, force and sound throw them back
// (ConditionBody's shove), the void and the mind make them tremble. A show only, like the blast: nothing is changed
// unless the GM has blasts really push.

// Each blast kind's reaction (energy-blast.mjs BLAST_TYPES ids); none for the rest.
export const BLAST_REACTIONS = Object.freeze({ fire: 'burn', cold: 'frost', electricity: 'shock', force: 'shove', sonic: 'shove', void: 'tremble', psychic: 'tremble' });
export const reactionOf = (kind) => BLAST_REACTIONS[kind] ?? null;
// How long a reaction lasts by default, and its range, in seconds.
export const REACTION_SECONDS = Object.freeze({ min: 2, max: 12, usual: 5 });
export const reactionSecondsOf = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.min(REACTION_SECONDS.max, Math.max(REACTION_SECONDS.min, n)) : REACTION_SECONDS.usual; };

/**
 * The creatures a blast catches (pure): each whose middle lies within its ring, or whose body reaches into it (a big
 * creature is caught by its edge). `tokens` [{ id, x, y, w }] (x, y the middle), `blast` { x, y, radius }. Each caught
 * one with `away`, the unit way from the blast's middle to it (straight on when it stands at the middle).
 */
export function caughtBy(blast, tokens = []) {
  const out = [];
  for (const t of tokens) {
    const dx = t.x - blast.x, dy = t.y - blast.y, d = Math.hypot(dx, dy), reach = blast.radius + (Number(t.w) || 0) * 0.25;
    if (d > reach) continue;
    out.push({ ...t, away: d > 1 ? { x: dx / d, y: dy / d } : { x: 0, y: -1 }, d });
  }
  return out;
}
// How strongly a reaction shows `t` seconds in (pure, 0–1): whole until most of its time is gone, then fading out.
export function reactionLife(t, seconds) { const s = reactionSecondsOf(seconds); if (t < 0) return 0; if (t >= s) return 0; const f = Math.max(0, (t - s * 0.6) / (s * 0.4)); return 1 - f * f * (3 - 2 * f); }
// Where a really pushed creature ends (pure): half a square away from the blast, short of any wall (`blocked(from, to)`).
export function pushedTo(t, grid, blocked = () => false) {
  const to = { x: t.x + t.away.x * grid * 0.5, y: t.y + t.away.y * grid * 0.5 };
  return blocked({ x: t.x, y: t.y }, to) ? null : to;
}
// The colour a reaction lays over a creature's art (pure, [r, g, b] and how much), for its tint: a cooling for frost, a flash
// for lightning; fire lights it by its own flames, the void darkens it in its own warp.
export function reactionTint(reaction, life, flick = 1) {
  if (reaction === 'frost') return { color: [0.88, 0.96, 1], amount: 0.35 * life };
  if (reaction === 'shock') return { color: [0.9, 0.93, 1], amount: 0.5 * life * flick };
  return { color: [1, 1, 1], amount: 0 };
}
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const mixTint = (base, color, amount) => { const r = (base >> 16) & 255, g = (base >> 8) & 255, b = base & 255, m = (v, c) => Math.round(v + (c * 255 - v) * amount); return (m(r, color[0]) << 16) | (m(g, color[1]) << 8) | m(b, color[2]); };

// Drawn on the graphics card, from photographs of real flames, hoarfrost and electric arcs.
const NOISE = [
  'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
  'float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }',
  'float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; } return v; }',
].join('\n');
const VERT = ['precision highp float;', 'attribute vec2 aVertexPosition; attribute vec2 aUvs;', 'uniform mat3 translationMatrix, projectionMatrix;', 'varying vec2 vUv;', 'void main(){ vUv = aUvs; gl_Position = vec4((projectionMatrix * translationMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0); }'].join('\n');
// Fire: licking tongues rising from the top of the creature, white-yellow at the root through orange to a deep red, split
// into wisps at their tips with dark gaps between; a lick of flame round its sides; streaks of embers; a warm light on the
// ground. The quad is FIRE_SIZE bodies square, the creature FIRE_LOW of it below the middle (room for the flames). Added.
export const FIRE_SIZE = 2.4, FIRE_LOW = 0.1;
const FIRE = ['precision highp float;', 'varying vec2 vUv;', 'uniform float uTime, uLife, uR;', NOISE,
  'vec3 ramp(float t){ vec3 a = vec3(0.35, 0.03, 0.0), b = vec3(0.95, 0.28, 0.03), c = vec3(1.0, 0.62, 0.15), d = vec3(1.0, 0.93, 0.7); return t < 0.33 ? mix(a, b, t / 0.33) : t < 0.66 ? mix(b, c, (t - 0.33) / 0.33) : mix(c, d, (t - 0.66) / 0.34); }',
  'void main(){',
  '  vec2 p = vUv - vec2(0.5, 0.6); float r = uR, d = length(p) - r, t = uTime;',
  '  float top = -sqrt(max(r * r - p.x * p.x, 0.0)), h = (top - p.y) / r, across = 1.0 - smoothstep(r * 0.55, r * 1.08, abs(p.x));',
  '  vec2 q = vec2(p.x * 13.0, p.y * 2.6 + t * 3.0); q.x += (fbm(vec2(q.x * 0.7, q.y * 0.5 - t * 0.4)) - 0.5) * 2.2;',
  '  float n = fbm(q) * 0.8 + fbm(q * 2.4 + 4.0) * 0.35;',
  '  float tongues = (pow(n, 1.7) * 2.6 - max(h, 0.0) * 0.6 - 0.5) * across * smoothstep(-0.1, 0.04, h);',
  '  float lick = (fbm(vec2(atan(p.y, p.x) * 5.0, t * 1.4)) - 0.35) * exp(-abs(d) / (0.07 * r)) * (0.55 + 0.45 * clamp(-p.y / r + 0.4, 0.0, 1.0));',
  '  float f = clamp(max(tongues, lick) * 2.0, 0.0, 1.0) * uLife;',
  '  vec3 col = ramp(f) * f * 1.25;',
  '  float glow = exp(-max(d, 0.0) / (r * 0.6)) * 0.22 * uLife * (0.85 + 0.15 * noise(vec2(t * 6.0, 1.0)));',
  '  col += vec3(1.0, 0.45, 0.12) * glow;',
  '  vec2 cell = floor(vec2(p.x * 22.0, p.y * 9.0 + t * 3.5)); float hc = hash(cell);',
  '  if (hc > 0.86 && h > -0.4) { vec2 fp = fract(vec2(p.x * 22.0, p.y * 9.0 + t * 3.5)) - vec2(0.3 + 0.4 * hash(cell + 2.0), 0.5); float e = (1.0 - smoothstep(0.0, 0.08, abs(fp.x))) * (1.0 - smoothstep(0.0, 0.45, abs(fp.y))); col += vec3(1.0, 0.65, 0.25) * e * uLife * (1.0 - smoothstep(r * 0.5, r * 2.2, length(p))); }',
  '  gl_FragColor = vec4(col, 0.0);',
  '}'].join('\n');
// Hoarfrost: feathery needles growing in from the creature's edge as a furry white rim, faintly blue in the shade, a fringe of
// crystals reaching out past it, a few glints; its face still seen. Over it. FROST_SIZE bodies square.
export const FROST_SIZE = 1.4;
const FROST = ['precision highp float;', 'varying vec2 vUv;', 'uniform float uTime, uLife, uR, uGrow;', NOISE,
  'void main(){',
  '  vec2 p = vUv - 0.5; float r = uR, d = length(p) - r, a = atan(p.y, p.x);',
  '  float needles = pow(abs(sin(a * 70.0 + fbm(p * 30.0) * 9.0)), 6.0) * 0.6 + pow(fbm(p * 60.0), 2.0) * 0.8;',
  '  float edge = noise(vec2(a * 6.0, 2.0)) * 0.35 + fbm(p * 18.0) * 0.4;',
  '  float inward = r * (0.04 + 0.2 * uGrow) * (0.6 + edge);',
  '  float rim = smoothstep(-inward, -inward * 0.25, d) * step(d, 0.0);',
  '  float reach = r * (0.08 + 0.2 * uGrow) * (0.45 + edge);',
  '  float fringe = step(0.0, d) * (1.0 - smoothstep(0.0, reach, d)) * needles * 1.3;',
  '  float wash = step(d, 0.0) * 0.07;',
  '  float cover = clamp(rim * (0.3 + 0.6 * needles) + fringe + wash, 0.0, 0.9) * uLife;',
  '  vec3 col = mix(vec3(0.62, 0.78, 0.95), vec3(0.97, 0.99, 1.0), clamp(needles + rim * 0.4, 0.0, 1.0));',
  '  float glint = step(0.985, hash(floor(p * 90.0))) * (0.5 + 0.5 * sin(uTime * 6.0 + hash(floor(p * 90.0)) * 40.0)) * rim;',
  '  col += glint;',
  '  gl_FragColor = vec4(col * cover, cover);',
  '}'].join('\n');
// The void and the mind: a dark haze curling round the creature (HAZE_SIZE bodies square), and its own art warping and
// rippling (a filter on its art).
export const HAZE_SIZE = 1.9;
const HAZE = ['precision highp float;', 'varying vec2 vUv;', 'uniform float uTime, uLife, uR;', NOISE,
  'void main(){',
  '  vec2 p = vUv - 0.5; float r = uR, d = length(p) - r, a = atan(p.y, p.x), t = uTime;',
  '  float smoke = fbm(vec2(a * 2.5 + t * 0.4, d * 9.0 - t * 1.2)) * 1.5 - smoothstep(0.0, r * 0.8, d) - 0.25;',
  '  smoke *= smoothstep(-0.05 * r, 0.05 * r, d);',
  '  float s = clamp(smoke * 1.8, 0.0, 1.0) * uLife;',
  '  gl_FragColor = vec4(vec3(0.14, 0.04, 0.22) * s, s * 0.95);',
  '}'].join('\n');
const WARP = ['precision highp float;', 'varying vec2 vTextureCoord;', 'uniform sampler2D uSampler;', 'uniform float uTime, uLife;', NOISE,
  'void main(){',
  '  vec2 uv = vTextureCoord, c = uv - 0.5; float t = uTime;',
  '  float wave = sin(length(c) * 40.0 - t * 9.0) * 0.006 + (fbm(uv * 6.0 + t * 0.9) - 0.5) * 0.03;',
  '  vec4 col = texture2D(uSampler, uv + c * wave * uLife * 4.0 + vec2(fbm(uv * 9.0 - t), fbm(uv * 9.0 + t)) * 0.012 * uLife - 0.006 * uLife);',
  '  float dark = fbm(uv * 5.0 + vec2(t * 0.4, -t * 0.3));',
  '  col.rgb = mix(col.rgb, col.rgb * vec3(0.55, 0.35, 0.8), 0.45 * uLife * smoothstep(0.35, 0.75, dark));',
  '  gl_FragColor = col;',
  '}'].join('\n');
// For warming ahead of the first blast (scene-shaders.mjs), and the tests.
export const BLAST_REACTION_SHADERS = Object.freeze([[VERT, FIRE], [VERT, FROST], [VERT, HAZE]]);
export const BLAST_REACTION_FILTERS = Object.freeze([WARP]);

// A branching arc from a to b (pure on its random): midpoint displacement, a branch now and then reaching off. Segments [ax, ay, bx, by].
export function arcSegments(ax, ay, bx, by, { depth = 5, rough = 30, random = Math.random } = {}) {
  const out = [];
  const step = (ax, ay, bx, by, depth, rough) => {
    if (depth === 0) { out.push([ax, ay, bx, by]); return; }
    const mx = (ax + bx) / 2 + (random() - 0.5) * rough, my = (ay + by) / 2 + (random() - 0.5) * rough;
    step(ax, ay, mx, my, depth - 1, rough * 0.55); step(mx, my, bx, by, depth - 1, rough * 0.55);
    if (depth >= 3 && random() < 0.45) { const a = Math.atan2(my - ay, mx - ax) + (random() < 0.5 ? 1 : -1) * (0.5 + random() * 0.6), len = Math.hypot(bx - ax, by - ay) * 0.45; step(mx, my, mx + Math.cos(a) * len, my + Math.sin(a) * len, depth - 2, rough * 0.5); }
  };
  step(ax, ay, bx, by, depth, rough);
  return out;
}

/**
 * The reactions' layer. root() over the creatures; meshOf(id) a creature's drawn art now (its token mesh) or null;
 * grid() a square. play(reaction, caught, { seconds, seed }) starts one on each caught creature (burn, frost, shock and
 * the void's haze and warp are drawn here; the shove and the tremble itself move the body, outside); tick(seconds); clear().
 */
// sizeOf(id): the creature's footprint across, from its squares; its art can be scaled well past them.
export function createBlastReactions({ PIXI, root, meshOf = () => null, sizeOf = () => 0, grid = () => 100 }) {
  const live = [];
  let clock = 0;
  const quad = () => new PIXI.Geometry().addAttribute('aVertexPosition', [-0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5], 2).addAttribute('aUvs', [0, 0, 1, 0, 1, 1, 0, 1], 2).addIndex([0, 1, 2, 0, 2, 3]);
  const meshFor = (frag, uniforms, blend) => { const m = new PIXI.Mesh(quad(), PIXI.Shader.from(VERT, frag, uniforms)); m.eventMode = 'none'; if (blend) m.blendMode = blend; root().addChild(m); return m; };
  const end = (r) => {
    for (const d of r.drawn) { try { d.destroy(); } catch { /* gone */ } }
    const mesh = meshOf(r.id);
    if (mesh && !mesh.destroyed) { if (r.tinted) mesh.tint = r.baseTint; if (r.warp && Array.isArray(mesh.filters)) { const left = mesh.filters.filter((x) => x !== r.warp); mesh.filters = left.length ? left : null; } }
  };
  return {
    play(reaction, caught = [], { seconds = REACTION_SECONDS.usual, seed = 0 } = {}) {
      if (!['burn', 'frost', 'shock', 'tremble'].includes(reaction)) return;
      for (const t of caught) {
        const old = live.findIndex((r) => r.id === t.id); if (old >= 0) { end(live[old]); live.splice(old, 1); }
        const mesh = meshOf(t.id), r = { id: t.id, reaction, t: 0, seconds: reactionSecondsOf(seconds), seed: seed + hash(t.x + t.y) * 1000, baseTint: mesh?.tint ?? 0xffffff, tinted: false, drawn: [], last: -1 };
        if (reaction === 'burn') r.drawn.push(r.flame = meshFor(FIRE, { uTime: 0, uLife: 0, uR: 0.44 / FIRE_SIZE }, PIXI.BLEND_MODES.ADD));
        if (reaction === 'frost') r.drawn.push(r.frost = meshFor(FROST, { uTime: 0, uLife: 0, uR: 0.44 / FROST_SIZE, uGrow: 0 }));
        if (reaction === 'tremble') {
          r.drawn.push(r.haze = meshFor(HAZE, { uTime: 0, uLife: 0, uR: 0.44 / HAZE_SIZE }));
          // Its own art warps: a filter of its own, beside any it already has, taken off again at the end.
          if (mesh && typeof PIXI.Filter === 'function') { r.warp = new PIXI.Filter(undefined, WARP, { uTime: 0, uLife: 0 }); mesh.filters = [...(mesh.filters ?? []), r.warp]; }
        }
        if (reaction === 'shock') {
          r.light = new PIXI.Graphics(); r.glow = new PIXI.Graphics(); r.core = new PIXI.Graphics();
          for (const g of [r.light, r.glow, r.core]) { g.eventMode = 'none'; g.blendMode = PIXI.BLEND_MODES.ADD; root().addChild(g); r.drawn.push(g); }
          if (typeof PIXI.BlurFilter === 'function') r.glow.filters = [new PIXI.BlurFilter(5)];
        }
        live.push(r);
      }
    },
    tick(seconds) {
      clock += seconds;
      const square = grid() || 100;
      for (let i = live.length - 1; i >= 0; i--) {
        const r = live[i]; r.t += seconds;
        const mesh = meshOf(r.id), life = reactionLife(r.t, r.seconds);
        if (!mesh || mesh.destroyed || life <= 0) { end(r); live.splice(i, 1); continue; }
        const x = mesh.position.x, y = mesh.position.y, body = sizeOf(r.id) || Math.max(Math.abs(mesh.width), Math.abs(mesh.height)) || square, R = body * 0.44;
        let flick = 1;
        if (r.flame) { r.flame.position.set(x, y - FIRE_LOW * body * FIRE_SIZE); r.flame.scale.set(body * FIRE_SIZE); Object.assign(r.flame.shader.uniforms, { uTime: clock, uLife: life }); }
        if (r.frost) { r.frost.position.set(x, y); r.frost.scale.set(body * FROST_SIZE); Object.assign(r.frost.shader.uniforms, { uTime: clock, uLife: life, uGrow: Math.min(1, r.t / 1.2) }); }
        if (r.haze) { r.haze.position.set(x, y); r.haze.scale.set(body * HAZE_SIZE); Object.assign(r.haze.shader.uniforms, { uTime: clock, uLife: life }); }
        if (r.warp) Object.assign(r.warp.uniforms, { uTime: clock, uLife: life });
        if (r.core) {
          // A fresh shape every sixtieth-odd of a second: arcs reaching round its edge, fewer as it dies down; now and then a
          // bright flash that lights it and the ground.
          const at = Math.floor(r.t * 16);
          if (at !== r.last) {
            r.last = at; r.glow.clear(); r.core.clear(); r.light.clear();
            const rnd = (() => { let s = at * 9301 + r.seed * 49297; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
            const arcs = Math.max(1, Math.round(4 * life * rnd() + 0.6)), segs = [];
            for (let k = 0; k < arcs; k++) { const a = rnd() * Math.PI * 2, b = a + (rnd() < 0.5 ? 1 : -1) * (0.7 + rnd() * 1.4), out = 1 + rnd() * 0.35; segs.push(...arcSegments(x + Math.cos(a) * R, y + Math.sin(a) * R, x + Math.cos(b) * R * out, y + Math.sin(b) * R * out, { rough: R * 0.55, random: rnd })); }
            r.glow.lineStyle(Math.max(2, square * 0.045), 0x8f73ff, 0.55 * life); for (const [ax, ay, bx, by] of segs) { r.glow.moveTo(ax, ay); r.glow.lineTo(bx, by); }
            r.core.lineStyle(Math.max(1, square * 0.011), 0xf4f1ff, 0.95 * life); for (const [ax, ay, bx, by] of segs) { r.core.moveTo(ax, ay); r.core.lineTo(bx, by); }
            r.flash = rnd() < 0.25 ? 1 : 0.3;
            r.light.lineStyle(0); for (let k = 5; k > 0; k--) { r.light.beginFill(0x6f62ff, 0.035 * r.flash * life); r.light.drawCircle(x, y, R * (1 + k * 0.35)); r.light.endFill(); }
          }
          flick = r.flash > 0.5 ? 1 : 0;
        }
        // The colour over its art: taken up afresh when Foundry sets its tint again, given back at the end.
        const tint = reactionTint(r.reaction, life, flick);
        if (tint.amount > 0 || r.tinted) {
          if (r.tinted && mesh.tint !== r.lastTint) r.baseTint = mesh.tint;
          r.tinted = true; mesh.tint = r.lastTint = mixTint(r.baseTint, tint.color, tint.amount);
        }
      }
    },
    clear() { for (const r of live) end(r); live.length = 0; },
    get busy() { return live.length > 0; },
    get count() { return live.length; },
  };
}
