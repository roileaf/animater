// How Tokenshade travel looks are drawn (tethers.mjs times them): textured strips that bend along the line (a twisted
// rope, a thorned vine, metal chain links, a glossy tapering tongue), lifted off the ground with their shadow beneath
// it, and shaded objects thrown in an arc (bola weights, a snare, a wad of silk), glowing motes with trails. Every
// texture is painted here on a small canvas, once, and shared.

const TAU = Math.PI * 2;
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const easeOut = (t) => 1 - (1 - t) ** 3;

// ---------------------------------------------------------------- textures ----
const painted = new Map();
function texture(PIXI, name) {
  if (painted.has(name)) return painted.get(name);
  const [w, h, paint, repeat] = PAINTERS[name];
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  paint(c.getContext('2d'), w, h);
  const tex = PIXI.Texture.from(c);
  if (repeat) tex.baseTexture.wrapMode = PIXI.WRAP_MODES.REPEAT;
  painted.set(name, tex);
  return tex;
}
// A band shaded as a cylinder across its height: dark at both edges, lit a little above the middle.
function cylinder(g, w, h, dark, mid, light) {
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, dark); grad.addColorStop(0.35, light); grad.addColorStop(0.55, mid); grad.addColorStop(1, dark);
  g.fillStyle = grad; g.fillRect(0, 0, w, h);
}
const PAINTERS = {
  // Three strands twisted: diagonal lays, each shaded, a dark groove between.
  rope: [128, 32, (g, w, h) => {
    cylinder(g, w, h, '#4a3420', '#a07a4a', '#d8b884');
    for (let x = -h; x < w + h; x += 16) {
      g.strokeStyle = 'rgba(40,26,12,0.75)'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x + h * 0.9, h); g.stroke();
      g.strokeStyle = 'rgba(255,236,196,0.35)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(x + 5, 0); g.lineTo(x + 5 + h * 0.9, h); g.stroke();
    }
    for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(60,40,20,${0.2 + 0.3 * Math.random()})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 1); }
  }, true],
  // A woody green stem with ridges and thorns along both edges.
  vine: [128, 40, (g, w, h) => {
    const top = h * 0.25, bot = h * 0.75;
    g.save(); g.beginPath(); g.rect(0, top, w, bot - top); g.clip();
    cylinder(g, w, h, '#1d3a10', '#3f7426', '#7fb050');
    g.strokeStyle = 'rgba(20,40,10,0.5)'; g.lineWidth = 1;
    for (let y = top + 3; y < bot; y += 4) { g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + 1.5, w * 0.6, y - 1.5, w, y); g.stroke(); }
    g.restore();
    g.fillStyle = '#2b4a18';
    for (const [x, up] of [[18, true], [52, false], [86, true], [114, false]]) {
      g.beginPath();
      if (up) { g.moveTo(x - 4, top + 1); g.lineTo(x + 6, 2); g.lineTo(x + 3, top + 1); }
      else { g.moveTo(x - 4, bot - 1); g.lineTo(x + 6, h - 2); g.lineTo(x + 3, bot - 1); }
      g.fill();
    }
  }, true],
  // Two links per tile: one seen face on (an open oval), one edge on (a bar), polished steel.
  chain: [64, 32, (g, w, h) => {
    const steel = (y0, y1) => { const s = g.createLinearGradient(0, y0, 0, y1); s.addColorStop(0, '#3c4046'); s.addColorStop(0.3, '#e8ecf0'); s.addColorStop(0.6, '#8a929c'); s.addColorStop(1, '#2a2e34'); return s; };
    g.lineWidth = 7; g.strokeStyle = steel(4, h - 4);
    g.beginPath(); g.ellipse(18, h / 2, 15, 10, 0, 0, TAU); g.stroke();
    g.lineWidth = 1.5; g.strokeStyle = 'rgba(10,12,16,0.8)';
    g.beginPath(); g.ellipse(18, h / 2, 18.5, 13.5, 0, 0, TAU); g.stroke();
    g.beginPath(); g.ellipse(18, h / 2, 11.5, 6.5, 0, 0, TAU); g.stroke();
    g.fillStyle = steel(h / 2 - 5, h / 2 + 5);
    g.beginPath(); g.roundRect(32, h / 2 - 5, 32, 10, 5); g.fill();
    g.strokeStyle = 'rgba(10,12,16,0.8)'; g.stroke();
  }, true],
  // Wet flesh: deep pink edges, a paler middle with a groove down it, a glossy highlight.
  tongue: [64, 32, (g, w, h) => {
    cylinder(g, w, h, '#6a1a2a', '#c4566a', '#ec9aa8');
    g.strokeStyle = 'rgba(110,30,45,0.6)'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, h * 0.52); g.lineTo(w, h * 0.52); g.stroke();
    g.strokeStyle = 'rgba(255,240,244,0.55)'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, h * 0.3); g.lineTo(w, h * 0.3); g.stroke();
    for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(150,40,60,0.35)'; g.beginPath(); g.arc(Math.random() * w, h * (0.3 + 0.4 * Math.random()), 0.8, 0, TAU); g.fill(); }
  }, true],
  // A thin translucent strand with a few loose fibres.
  silk: [64, 8, (g, w, h) => {
    const s = g.createLinearGradient(0, 0, 0, h); s.addColorStop(0, 'rgba(255,255,255,0)'); s.addColorStop(0.5, 'rgba(255,255,255,0.95)'); s.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = s; g.fillRect(0, 0, w, h);
  }, true],
  // Soft light across the band (a glow under a burning chain).
  band: [16, 32, (g, w, h) => {
    const s = g.createLinearGradient(0, 0, 0, h); s.addColorStop(0, 'rgba(255,255,255,0)'); s.addColorStop(0.5, 'rgba(255,255,255,1)'); s.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = s; g.fillRect(0, 0, w, h);
  }, true],
  // A soft round light (motes, embers, a shadow's blur).
  soft: [64, 64, (g, w) => {
    const s = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); s.addColorStop(0, 'rgba(255,255,255,1)'); s.addColorStop(0.35, 'rgba(255,255,255,0.55)'); s.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = s; g.fillRect(0, 0, w, w);
  }],
  // A shaded sphere lit from the top left (a bola weight, a tongue's tip).
  ball: [64, 64, (g, w) => {
    const s = g.createRadialGradient(w * 0.36, w * 0.34, w * 0.04, w / 2, w / 2, w / 2); s.addColorStop(0, '#ffffff'); s.addColorStop(0.25, '#c8c8c8'); s.addColorStop(0.8, '#585858'); s.addColorStop(1, '#202020');
    g.fillStyle = s; g.beginPath(); g.arc(w / 2, w / 2, w / 2 - 1, 0, TAU); g.fill();
  }],
  // A leaf: pointed, lighter along its vein.
  leaf: [48, 24, (g, w, h) => {
    const s = g.createLinearGradient(0, 0, 0, h); s.addColorStop(0, '#2e5a18'); s.addColorStop(0.5, '#6aa040'); s.addColorStop(1, '#244a12');
    g.fillStyle = s; g.beginPath(); g.moveTo(1, h / 2); g.quadraticCurveTo(w * 0.45, -2, w - 1, h / 2); g.quadraticCurveTo(w * 0.45, h + 2, 1, h / 2); g.fill();
    g.strokeStyle = 'rgba(200,240,160,0.6)'; g.lineWidth = 1; g.beginPath(); g.moveTo(2, h / 2); g.lineTo(w - 3, h / 2); g.stroke();
  }],
  // A wad of silk: soft, layered, a little lumpy.
  wad: [64, 64, (g, w) => {
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * TAU, r = Math.random() * w * 0.22, x = w / 2 + Math.cos(a) * r, y = w / 2 + Math.sin(a) * r, rr = w * (0.12 + Math.random() * 0.12);
      const s = g.createRadialGradient(x - rr * 0.3, y - rr * 0.3, 0, x, y, rr); s.addColorStop(0, 'rgba(255,255,255,0.95)'); s.addColorStop(1, 'rgba(210,210,215,0)');
      g.fillStyle = s; g.beginPath(); g.arc(x, y, rr, 0, TAU); g.fill();
    }
  }],
  // A sprung jaw: an arc of steel teeth.
  jaw: [64, 32, (g, w, h) => {
    const s = g.createLinearGradient(0, 0, 0, h); s.addColorStop(0, '#d0d4da'); s.addColorStop(1, '#4a4e56');
    g.fillStyle = s; g.strokeStyle = '#1c1e22'; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(2, h - 4);
    for (let i = 0; i <= 8; i++) { const x = 2 + (i / 8) * (w - 4); g.lineTo(x, i % 2 ? 4 : h * 0.55); }
    g.lineTo(w - 2, h - 4); g.closePath(); g.fill(); g.stroke();
  }],
};

// ------------------------------------------------------------------ strips ----
// A textured strip along a list of points, its width given per point (so it can taper), the texture tiled along it.
function strip(PIXI, tex, n = 48) {
  const verts = new Float32Array(n * 4), uvs = new Float32Array(n * 4), index = new Uint16Array((n - 1) * 6);
  for (let i = 0; i < n - 1; i++) index.set([2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 1, 2 * i + 3, 2 * i + 2], i * 6);
  const geom = new PIXI.MeshGeometry(verts, uvs, index), mesh = new PIXI.Mesh(geom, new PIXI.MeshMaterial(tex));
  mesh.n = n;
  // `pts` [{x,y}], `width(i)` px, `tile` px of length per texture repeat (0: stretched once).
  mesh.set = (pts, width, tile = 0) => {
    const m = Math.min(n, pts.length);
    if (m < 2) { mesh.visible = false; return; }
    mesh.visible = true;
    let along = 0;
    for (let i = 0; i < n; i++) {
      const k = Math.min(i, m - 1), p = pts[k], q = pts[Math.min(k + 1, m - 1)], o = pts[Math.max(k - 1, 0)];
      let dx = q.x - o.x, dy = q.y - o.y; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
      const half = width(k) / 2;
      if (i > 0 && k > 0) along += Math.hypot(p.x - pts[k - 1].x, p.y - pts[k - 1].y) * (i < m ? 1 : 0);
      verts.set([p.x - dy * half, p.y + dx * half, p.x + dy * half, p.y - dx * half], i * 4);
      const u = tile > 0 ? along / tile : k / (m - 1);
      uvs.set([u, 0, u, 1], i * 4);
    }
    geom.getBuffer('aVertexPosition').update();
    geom.getBuffer('aTextureCoord').update();
  };
  return mesh;
}
const sprite = (PIXI, tex, parent, { blend = false, anchor = 0.5 } = {}) => {
  const s = new PIXI.Sprite(tex);
  s.anchor.set(anchor);
  if (blend) s.blendMode = PIXI.BLEND_MODES.ADD;
  parent.addChild(s);
  return s;
};

// ------------------------------------------------------------------ styles ----
// The drawing of one tether: `build(PIXI, style, color)` makes its pieces once; `draw(frame)` places them each frame.
// `frame`: { a, b, grid, st (tethers.mjs tetherState), t (seconds), along(u, lift) → ground point, color }.
export function tetherArt(PIXI, style, color) {
  const root = new PIXI.Container();
  root.eventMode = 'none';
  const T = (n) => texture(PIXI, n);
  const shadowOf = (mesh) => { mesh.tint = 0x000000; mesh.alpha = 0.32; return mesh; };
  const parts = {};
  const reach = ['rope', 'vine', 'chain', 'burning-chain', 'tongue'].includes(style);
  if (reach) {
    const tex = T(style === 'burning-chain' ? 'chain' : style);
    parts.shadow = shadowOf(strip(PIXI, tex)); root.addChild(parts.shadow);
    if (style === 'burning-chain') { parts.glow = strip(PIXI, T('band')); parts.glow.blendMode = PIXI.BLEND_MODES.ADD; parts.glow.tint = 0xff5a10; root.addChild(parts.glow); }
    parts.main = strip(PIXI, tex); root.addChild(parts.main);
    if (style === 'burning-chain') parts.main.tint = 0xffc890;
    if (style === 'rope') { parts.coilShadow = shadowOf(strip(PIXI, tex, 64)); parts.coil = strip(PIXI, tex, 64); root.addChildAt(parts.coilShadow, 0); root.addChild(parts.coil); }
    if (style === 'vine') parts.leaves = Array.from({ length: 9 }, () => sprite(PIXI, T('leaf'), root, { anchor: 0 }));
    if (style === 'tongue') parts.tip = sprite(PIXI, T('ball'), root), parts.tip.tint = 0xd8707e;
    if (style === 'burning-chain') parts.embers = Array.from({ length: 14 }, (_, i) => Object.assign(sprite(PIXI, T('soft'), root, { blend: true }), { seed: i / 14 }));
  } else if (style === 'motes') {
    parts.motes = Array.from({ length: 10 }, (_, i) => ({ seed: i / 10, trail: [3, 2, 1, 0].map(() => sprite(PIXI, T('soft'), root, { blend: true })) }));
  } else {
    parts.shadow = sprite(PIXI, T('soft'), root); parts.shadow.tint = 0x000000;
    if (style === 'bola') {
      parts.cord = strip(PIXI, T('rope'), 8); root.addChild(parts.cord);
      parts.ghosts = [0, 1].map(() => [0, 1].map(() => sprite(PIXI, T('ball'), root)));
      parts.balls = [0, 1].map(() => sprite(PIXI, T('ball'), root));
    } else if (style === 'snare') {
      parts.loopShadow = shadowOf(strip(PIXI, T('rope'), 40)); parts.loop = strip(PIXI, T('rope'), 40); root.addChild(parts.loopShadow, parts.loop);
      parts.jaw = sprite(PIXI, T('jaw'), root);
    } else {
      parts.strand = strip(PIXI, T('silk'), 24); root.addChild(parts.strand);
      parts.web = Array.from({ length: 11 }, () => { const s = strip(PIXI, T('silk'), 24); root.addChild(s); return s; });
      parts.wad = sprite(PIXI, T('wad'), root);
    }
  }
  return { root, draw: (f) => DRAW[reach ? 'reach' : style === 'motes' ? 'motes' : 'thrown'](PIXI, style, parts, f, color) };
}

const DRAW = {
  reach(PIXI, style, P, f) {
    const { grid, st, t } = f, n = 40;
    const whip = style === 'vine' || style === 'tongue';
    // Out with a little overshoot, settling; a whip's wave runs along it while it flies.
    const r = st.reach, fly = 1 - r;
    const thick = grid * ({ rope: 0.13, vine: 0.2, chain: 0.16, 'burning-chain': 0.16, tongue: 0.2 })[style];
    const lift = (u) => Math.sin(Math.PI * u) * grid * (whip ? 0.35 : 0.22) * (0.6 + 0.4 * fly);
    const wave = (u) => (whip ? grid * 0.32 * fly + grid * 0.04 : grid * 0.05 * fly) * Math.sin(u * 9 - t * 16) * u;
    const ground = [], pts = [];
    for (let i = 0; i < n; i++) {
      const u = (i / (n - 1)) * r, g = f.along(u, wave(u));
      ground.push({ x: g.x + grid * 0.06, y: g.y + grid * 0.1 });
      pts.push({ x: g.x, y: g.y - lift(u) });
    }
    const width = style === 'tongue' ? (k) => thick * (1.15 - 0.55 * (k / (n - 1))) : () => thick;
    const tile = style === 'chain' || style === 'burning-chain' ? thick * 2 : thick * 4;
    P.main.set(pts, width, tile); P.shadow.set(ground, width, tile);
    P.main.alpha = st.alpha; P.shadow.alpha = 0.3 * st.alpha;
    if (P.glow) { P.glow.set(pts, () => thick * 3.2, 0); P.glow.alpha = st.alpha * (0.55 + 0.25 * Math.sin(t * 23) * Math.sin(t * 7.3)); }
    const end = pts[pts.length - 1];
    if (P.tip) { P.tip.position.set(end.x, end.y); P.tip.width = P.tip.height = thick * 1.5; P.tip.alpha = st.alpha; }
    if (P.leaves) P.leaves.forEach((leaf, i) => {
      const u = (i + 1) / (P.leaves.length + 1), shown = clamp01((r - u) * 6), k = Math.round(u * (n - 1)), p = pts[k], q = pts[Math.min(k + 1, n - 1)];
      const side = i % 2 ? 1 : -1, ang = Math.atan2(q.y - p.y, q.x - p.x) + side * (0.9 + 0.15 * Math.sin(t * 3 + i));
      leaf.position.set(p.x, p.y); leaf.rotation = ang; leaf.width = grid * 0.32 * shown; leaf.height = grid * 0.15 * shown; leaf.alpha = st.alpha;
    });
    if (P.embers) P.embers.forEach((e) => {
      const life = (t * 0.9 + e.seed * 7.3) % 1, u = ((e.seed * 13.7) % 1) * r, p = f.along(u, wave(u));
      e.position.set(p.x + Math.sin(t * 4 + e.seed * 20) * grid * 0.08, p.y - lift(u) - life * grid * 0.6);
      e.width = e.height = grid * (0.14 - 0.1 * life); e.tint = life < 0.4 ? 0xffd27a : 0xff6a1e; e.alpha = (1 - life) * st.alpha * 0.9;
    });
    if (P.coil) {
      // Once it has reached, the rope wraps round the target, a turn and a half, tightening.
      const wrap = clamp01((r - 0.97) / 0.03) * clamp01(st.coil ?? 1), b = f.b, m = 60, cpts = [], cshadow = [];
      for (let i = 0; i < m; i++) {
        const a = -Math.PI / 2 + (i / (m - 1)) * TAU * 1.5 * wrap, rr = grid * (0.46 - 0.05 * (i / m));
        cpts.push({ x: b.x + Math.cos(a) * rr, y: b.y + Math.sin(a) * rr * 0.72 - grid * 0.05 });
        cshadow.push({ x: b.x + Math.cos(a) * rr + grid * 0.05, y: b.y + Math.sin(a) * rr * 0.72 + grid * 0.08 });
      }
      P.coil.set(wrap > 0.02 ? cpts : [], () => thick, thick * 4); P.coilShadow.set(wrap > 0.02 ? cshadow : [], () => thick, thick * 4);
      P.coil.alpha = st.alpha; P.coilShadow.alpha = 0.28 * st.alpha;
    }
  },
  thrown(PIXI, style, P, f) {
    const { grid, st, t, a, b } = f, len = Math.hypot(b.x - a.x, b.y - a.y);
    const h = st.head, arc = Math.min(len * 0.28, grid * 1.4) * Math.sin(Math.PI * h) * (st.landed ? 0 : 1);
    const ground = f.along(h, 0), at = { x: ground.x, y: ground.y - arc };
    const shadowSize = grid * (0.55 - 0.25 * (arc / (grid * 1.4 || 1)));
    P.shadow.position.set(ground.x + grid * 0.05, ground.y + grid * 0.12); P.shadow.width = shadowSize; P.shadow.height = shadowSize * 0.5; P.shadow.alpha = 0.45 * st.alpha;
    const spin = t * TAU * 2.4;
    if (style === 'bola') {
      const r = grid * 0.32, ends = (s) => [{ x: at.x + Math.cos(s) * r, y: at.y + Math.sin(s) * r * 0.8 }, { x: at.x - Math.cos(s) * r, y: at.y - Math.sin(s) * r * 0.8 }];
      const [p, q] = ends(spin), mid = { x: at.x + Math.sin(spin) * grid * 0.06, y: at.y - Math.cos(spin) * grid * 0.06 };
      P.cord.set(st.landed ? [] : [p, mid, q], () => grid * 0.05, grid * 0.25);
      P.balls.forEach((ball, i) => { const e = [p, q][i]; ball.position.set(e.x, e.y); ball.width = ball.height = grid * 0.2; ball.tint = 0x7a6a5a; ball.alpha = st.alpha * (st.landed ? 0 : 1); });
      // A blur of where the weights just were.
      P.ghosts.forEach((pair, k) => { const g = ends(spin - (k + 1) * 0.35); pair.forEach((s, i) => { s.position.set(g[i].x, g[i].y); s.width = s.height = grid * 0.2; s.tint = 0x7a6a5a; s.alpha = st.alpha * (st.landed ? 0 : 0.28 / (k + 1)); }); });
      if (st.landed) {
        // Wrapped round the target's legs: the cord circles it, the weights at rest on either side.
        P.cord.set(Array.from({ length: 8 }, (_, i) => { const a2 = (i / 7) * TAU * 0.9; return { x: b.x + Math.cos(a2) * grid * 0.36, y: b.y + grid * 0.18 + Math.sin(a2) * grid * 0.16 }; }), () => grid * 0.05, grid * 0.25);
        P.balls.forEach((ball, i) => { ball.position.set(b.x + (i ? 1 : -1) * grid * 0.4, b.y + grid * 0.22); ball.alpha = st.alpha; });
      }
    } else if (style === 'snare') {
      const cinch = st.landed ? clamp01(st.settle ?? 1) : 0, c = st.landed ? b : at;
      const rx = grid * (st.landed ? 0.5 - 0.14 * cinch : 0.24), ry = st.landed ? rx * 0.7 : grid * 0.24 * Math.abs(Math.cos(spin)) + grid * 0.05;
      const loop = Array.from({ length: 40 }, (_, i) => { const a2 = (i / 39) * TAU; return { x: c.x + Math.cos(a2) * rx, y: c.y + Math.sin(a2) * ry }; });
      P.loop.set(loop, () => grid * 0.06, grid * 0.25); P.loopShadow.set(loop.map((p) => ({ x: p.x + grid * 0.05, y: p.y + grid * 0.09 })), () => grid * 0.06, grid * 0.25);
      P.loop.alpha = st.alpha; P.loopShadow.alpha = 0.28 * st.alpha;
      P.jaw.position.set(c.x, c.y - ry); P.jaw.rotation = st.landed ? 0 : spin; P.jaw.width = grid * 0.32; P.jaw.height = grid * (st.landed ? 0.1 + 0.06 * (1 - cinch) : 0.16); P.jaw.alpha = st.alpha;
    } else {
      // Silk: a wad trailing a strand back to the thrower; landed, it bursts into a web over the target.
      const strand = Array.from({ length: 24 }, (_, i) => { const u = (i / 23) * h; const g = f.along(u, 0); return { x: g.x, y: g.y - Math.min(len * 0.28, grid * 1.4) * Math.sin(Math.PI * u) * (st.landed ? 0 : 1) * (u / Math.max(h, 0.01)) }; });
      P.strand.set(strand, () => grid * 0.035, grid * 0.6); P.strand.tint = f.color ?? 0xffffff; P.strand.alpha = 0.6 * st.alpha;
      const open = st.landed ? easeOut(clamp01(st.settle ?? 1)) : 0;
      P.wad.position.set(at.x, at.y); P.wad.rotation = spin * 0.3; P.wad.width = P.wad.height = grid * (0.34 * (1 - open) + 0.02); P.wad.tint = f.color ?? 0xffffff; P.wad.alpha = st.alpha;
      P.web.forEach((s, i) => {
        let pts;
        if (i < 8) { const a2 = (i / 8) * TAU + 0.2; pts = Array.from({ length: 6 }, (_, k) => ({ x: b.x + Math.cos(a2) * grid * 0.62 * open * (k / 5), y: b.y + Math.sin(a2) * grid * 0.62 * open * (k / 5) })); }
        else { const rr = grid * 0.62 * open * ((i - 7) / 4); pts = Array.from({ length: 24 }, (_, k) => { const a2 = (k / 23) * TAU; return { x: b.x + Math.cos(a2) * rr * (1 + 0.06 * Math.sin(a2 * 8)), y: b.y + Math.sin(a2) * rr * (1 + 0.06 * Math.sin(a2 * 8)) }; }); }
        s.set(open > 0.02 ? pts : [], () => grid * 0.03, grid * 0.6); s.tint = f.color ?? 0xffffff; s.alpha = 0.8 * st.alpha;
      });
    }
  },
  motes(PIXI, style, P, f, color) {
    const { grid, st, t } = f, tint = f.color ?? color ?? 0xe6e0ff;
    P.motes.forEach((m) => {
      const speed = 0.55 + 0.25 * ((m.seed * 7.7) % 1);
      m.trail.forEach((s, k) => {
        const u = ((t * speed + m.seed - k * 0.025) % 1 + 1) % 1, swirl = Math.sin(u * 10 + m.seed * 30) * grid * 0.14;
        const p = f.along(u, swirl), size = grid * (k ? 0.16 - 0.03 * k : 0.22) * (0.7 + 0.3 * Math.sin(t * 9 + m.seed * 40));
        s.position.set(p.x, p.y - Math.sin(Math.PI * u) * grid * 0.2); s.width = s.height = size; s.tint = k ? tint : 0xffffff;
        s.alpha = Math.sin(Math.PI * u) * st.alpha * (k ? 0.5 / k : 0.9);
      });
    });
  },
};
