// Caverns: what a region marked as one of them holds, drawn on the GPU. Glowing fungus (clusters of small caps on a web
// of faint threads, breathing brighter and dimmer, dimming where someone brushes past), crystals (prisms growing out of
// the walls, each face lit as it turns toward a flame, flashing when one lines up), lava (a cooling crust broken into
// drifting plates, molten rock glowing up through the cracks, lighting the rock around) and low mist (hugging the floor,
// parting around feet). Everything is laid out once from the regions and walls; a frame only moves the clock.

const rng = (seed) => { let h = 2166136261; for (const c of String(seed)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; }; };
const inside = ({ x, y }, p) => { let hit = false; for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) if ((p[i + 1] > y) !== (p[j + 1] > y) && x < ((p[j] - p[i]) * (y - p[i + 1])) / (p[j + 1] - p[i + 1]) + p[i]) hit = !hit; return hit; };
const inArea = (pt, p) => inside(pt, p) && !(p.holes ?? []).some((h) => inside(pt, h));
const boxOf = (p) => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (let i = 0; i < p.length; i += 2) { x0 = Math.min(x0, p[i]); x1 = Math.max(x1, p[i]); y0 = Math.min(y0, p[i + 1]); y1 = Math.max(y1, p[i + 1]); } return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }; };

// Each colour: the glow, its pale heart, and the cap's own flesh as ordinary light shows it.
export const FUNGUS_COLORS = { green: [[0.35, 1, 0.63], [0.82, 1, 0.86], [0.55, 0.6, 0.46]], blue: [[0.35, 0.69, 1], [0.8, 0.91, 1], [0.5, 0.55, 0.62]], violet: [[0.75, 0.47, 1], [0.93, 0.83, 1], [0.57, 0.5, 0.6]] };
export const CRYSTAL_STONES = { amethyst: [[0.78, 0.73, 0.96], [0.47, 0.35, 0.67]], quartz: [[0.86, 0.91, 0.94], [0.47, 0.53, 0.59]], rose: [[1, 0.67, 0.63], [0.59, 0.27, 0.27]] };

// ---- Layout (pure) --------------------------------------------------------------------------------------------------

// The fungus in some areas (flat x, y pairs): a cluster every ~`per` squares, each a crowd of caps (bigger toward the
// middle, little ones crowding at the big ones' feet) and short threads curling out from it, all on the floor
// (`floor({ x, y })`, not the rock). Caps { x, y, r, phase, seed, d }, the bigger first; threads [[x, y], ...]. The same
// areas always grow the same fungus.
export function fungusIn(areas = [], { grid = 100, per = 4, seed = 'fungus', floor = () => true } = {}) {
  const r = rng(seed), clusters = [], here = (pt, p) => inArea(pt, p) && floor(pt);
  for (const p of areas) {
    const b = boxOf(p), want = Math.max(1, Math.round((b.w * b.h) / (grid * grid) / per));
    for (let n = 0, tries = 0; n < want && tries < want * 30; tries++) {
      const c = { x: b.x + r() * b.w, y: b.y + r() * b.h };
      if (!here(c, p)) continue;
      n++;
      const spread = grid * (0.3 + 0.35 * r()), count = 14 + Math.floor(r() * 12), caps = [];
      for (let i = 0; i < count; i++) {
        const a = r() * 6.283, d = Math.sqrt(r()) * spread, size = grid * (0.04 + r() * 0.1) * (1 - 0.45 * d / spread);
        const cap = { x: c.x + Math.cos(a) * d, y: c.y + Math.sin(a) * d * 0.75, r: size, phase: r() * 6.28, seed: r() * 50, d };
        if (!here(cap, p)) continue;
        caps.push(cap);
        if (size > grid * 0.08) for (let k = 0; k < 3; k++) { const t = r() * 6.283, small = { x: cap.x + Math.cos(t) * size * 1.25, y: cap.y + Math.sin(t) * size * 1.05, r: grid * (0.012 + r() * 0.02), phase: r() * 6.28, seed: r() * 50, d }; if (here(small, p)) caps.push(small); }
      }
      caps.sort((a, b) => a.y - b.y);
      const threads = Array.from({ length: 8 + Math.floor(r() * 5) }, () => {
        let x = c.x + (r() - 0.5) * spread, y = c.y + (r() - 0.5) * spread * 0.75, a = r() * 6.283; const pts = [[x, y]];
        for (let k = 0; k < 6; k++) { a += (r() - 0.5) * 1.6; x += Math.cos(a) * grid * 0.06; y += Math.sin(a) * grid * 0.06; pts.push([x, y]); }
        return pts;
      });
      clusters.push({ x: c.x, y: c.y, caps, threads });
    }
  }
  return clusters;
}

// Crystal clusters in some areas: growing out of the walls that run through them (about one a square and a half along a
// wall, on the side inside the area that is floor, `floor({ x, y })`, not solid rock), or standing free in an area with no
// walls. Each { x, y, out (angle away from the wall), shards: [{ x, y, a, L, wd, tilt }], rock: [[x, y], ...] }.
export function crystalsIn(areas = [], { walls = [], grid = 100, seed = 'crystals', floor = () => true } = {}) {
  const r = rng(seed), out = [];
  const cluster = (bx, by, dir, free) => {
    const along = [-Math.sin(dir), Math.cos(dir)], shards = [], rock = [];
    for (let i = 0; i < 9; i++) { const a = i / 9 * 6.283, k = grid * (0.2 + 0.1 * r()); rock.push([bx + Math.cos(a) * k * (free ? 0.8 : 1.2), by + Math.sin(a) * k * (free ? 0.8 : 0.6)]); }
    for (let i = 0, n = 7 + Math.floor(r() * 7); i < n; i++) {
      const a = dir + (r() - 0.5) * (free ? 6.283 : 2.3), L = grid * (0.15 + r() * 0.38), o = (r() - 0.5) * grid * 0.45;
      shards.push({ x: bx + along[0] * o, y: by + along[1] * o, a, L: L * (1 - Math.abs(o) / (grid * 0.6)), wd: grid * (0.09 + r() * 0.1) + L * 0.15, tilt: 0.3 + r() * 0.6 });
    }
    shards.sort((s1, s2) => s2.L - s1.L);
    out.push({ x: bx + Math.cos(dir) * grid * 0.25, y: by + Math.sin(dir) * grid * 0.25, out: dir, shards, rock });
  };
  for (const p of areas) {
    let grew = 0;
    for (const w of walls) {
      if (!(Number(w.move) > 0)) continue;
      const [x1, y1, x2, y2] = w.c, len = Math.hypot(x2 - x1, y2 - y1); if (len < grid * 0.5) continue;
      const nx = -(y2 - y1) / len, ny = (x2 - x1) / len;
      for (let s = grid * 0.4; s < len - grid * 0.3; s += grid * (1.1 + r() * 0.8)) {
        if (r() < 0.35) continue;
        const px = x1 + (x2 - x1) * (s / len), py = y1 + (y2 - y1) * (s / len);
        for (const side of [1, -1]) {
          const at = { x: px + nx * side * grid * 0.12, y: py + ny * side * grid * 0.12 };
          if (inArea(at, p) && floor({ x: px + nx * side * grid * 0.5, y: py + ny * side * grid * 0.5 })) { cluster(at.x, at.y, Math.atan2(ny * side, nx * side), false); grew++; }
        }
      }
    }
    if (!grew) { const b = boxOf(p), want = Math.max(1, Math.round((b.w * b.h) / (grid * grid) / 8));
      for (let n = 0, tries = 0; n < want && tries < want * 30; tries++) { const at = { x: b.x + r() * b.w, y: b.y + r() * b.h }; if (inArea(at, p)) { cluster(at.x, at.y, r() * 6.283, true); n++; } } }
  }
  return out;
}

// The faces of one crystal cluster as triangles: [{ pts: [[x, y] x3], n: [nx, ny, nz], kind (0 crystal, 1 rock) }].
export function crystalFaces(cl) {
  const tris = [];
  const fan = (pts, n, kind) => { for (let i = 1; i < pts.length - 1; i++) tris.push({ pts: [pts[0], pts[i], pts[i + 1]], n, kind }); };
  fan(cl.rock, [0, 0, 1], 1);
  for (const s of cl.shards) {
    const ux = Math.cos(s.a), uy = Math.sin(s.a), px = -uy, py = ux, hw = s.wd / 2, c = Math.cos(s.tilt), z = Math.sin(s.tilt);
    const base = [s.x, s.y], sh = [s.x + ux * s.L * 0.78, s.y + uy * s.L * 0.78], tip = [s.x + ux * s.L, s.y + uy * s.L];
    const side = (k) => [[base[0] + px * hw * k, base[1] + py * hw * k], [sh[0] + px * hw * k, sh[1] + py * hw * k], sh, base];
    fan(side(1), [px * c, py * c, z], 0); fan(side(-1), [-px * c, -py * c, z], 0);
    const nn = (k) => { const x = (px * k + ux) * 0.7, y = (py * k + uy) * 0.7, m = Math.hypot(x, y) || 1; return [(x / m) * c, (y / m) * c, z]; };
    tris.push({ pts: [[sh[0] + px * hw, sh[1] + py * hw], tip, sh], n: nn(1), kind: 0 }, { pts: [[sh[0] - px * hw, sh[1] - py * hw], tip, sh], n: nn(-1), kind: 0 });
  }
  return tris;
}

// ---- Drawing -------------------------------------------------------------------------------------------------------

const NOISE = `
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * noise(p); p = p * 2.03 + 17.0; a *= 0.5; } return s; }`;

const FUNGUS_VERT = `
precision highp float;
attribute vec2 aVertexPosition; attribute vec2 aCenter; attribute vec4 aCap;
uniform mat3 translationMatrix; uniform mat3 projectionMatrix;
varying vec2 vPos; varying vec2 vCenter; varying vec4 vCap;
void main(){ vPos = aVertexPosition; vCenter = aCenter; vCap = aCap;
  gl_Position = vec4((projectionMatrix * translationMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0); }`;

const FUNGUS_FRAG = `
precision highp float;
varying vec2 vPos; varying vec2 vCenter; varying vec4 vCap;   // cap: radius, phase, seed, distance from its cluster's middle
uniform float uTime, uGrid, uPass, uDark;   // pass 0: the caps as light shows them (on the floor); 1: their glow (added)
uniform vec3 uGlow, uPale, uFlesh;
uniform vec3 uTouch[12];   // where creatures were lately: x, y, seconds ago (large: none)
${NOISE}
void main(){
  float R = vCap.x; vec2 p = vPos - vCenter; float dist = length(p);
  // A cap seen from above: a low dome, a little out of round.
  float e = length(p / vec2(1.0, 0.9)) / (R * (1.0 + 0.08 * (noise(p / R * 2.0 + vCap.z) - 0.5)));
  float inside = smoothstep(1.0, 0.92, e);
  if (uPass < 0.5) {
    if (inside <= 0.0) { gl_FragColor = vec4(0.0); return; }
    // A low cap lit from the upper left: its flesh tinged with its glow, a darker bump at the middle, faint fine lines
    // running out to a thin, paler, translucent rim; freckled.
    vec3 n = normalize(vec3(p / R * 0.45, 1.0)), L = normalize(vec3(-0.55, -0.45, 0.7));
    float light = 0.72 + 0.28 * max(0.0, dot(n, L)), freckle = smoothstep(0.64, 0.7, noise(p / R * 4.0 + vCap.z)) * 0.15;
    float a = atan(p.y, p.x), lines = 0.06 * smoothstep(0.35, 0.9, e) * (0.5 + 0.5 * sin(a * (22.0 + floor(vCap.z)) + noise(vec2(a * 3.0, vCap.z)) * 2.0));
    vec3 flesh = mix(uFlesh, uGlow, 0.35), c = flesh * light * (1.0 - freckle - lines);
    c *= 1.0 - 0.3 * smoothstep(0.28, 0.0, e);
    c = mix(c, mix(uPale, uGlow, 0.4), 0.45 * smoothstep(0.7, 0.98, e));
    gl_FragColor = vec4(c * inside, inside);
    return;
  }
  // The glow: strongest in the dark, still plain to see by day.
  float dim = 0.0;
  for (int i = 0; i < 12; i++) { vec3 t = uTouch[i]; float near = 1.0 - smoothstep(uGrid * 0.45, uGrid * 0.9, length(vCenter - t.xy)); dim = max(dim, near * clamp(1.0 - t.z / 4.0, 0.0, 1.0)); }
  float b = (0.55 + 0.45 * sin(uTime * 0.55 - vCap.w / uGrid * 4.0 + vCap.y * 0.3)) * (1.0 - 0.85 * dim) * (0.45 + 0.55 * uDark);
  // The light it throws on the floor round it, the cap glowing through (brightest at its thin rim).
  vec3 col = uGlow * 0.16 * b * exp(-pow(dist / (R * 3.0), 2.0));
  col += mix(uGlow, uPale, 0.35 * smoothstep(0.5, 0.95, e)) * inside * b * (0.3 + 0.55 * smoothstep(0.3, 1.0, e));
  // A spore or two drifting up off the bigger caps.
  if (R > uGrid * 0.05) for (int s = 0; s < 2; s++) {
    float fs = float(s), per = 4.0 + hash(vec2(vCap.y, fs)) * 3.0, ph = fract(uTime / per + hash(vec2(fs, vCap.y + 2.0)));
    vec2 at = vec2(sin(uTime * 0.8 + fs * 3.0 + vCap.y) * R * 0.6, -ph * R * 3.0);
    col += uPale * 0.5 * sin(ph * 3.1416) * b * exp(-dot(p - at, p - at) / (uGrid * uGrid * 0.0001));
  }
  gl_FragColor = vec4(col, 0.0);
}`;

const CRYSTAL_VERT = `
precision highp float;
attribute vec2 aVertexPosition; attribute vec3 aNormal; attribute float aKind;
uniform mat3 translationMatrix; uniform mat3 projectionMatrix;
varying vec2 vPos; varying vec3 vNormal; varying float vKind;
void main(){ vPos = aVertexPosition; vNormal = aNormal; vKind = aKind;
  gl_Position = vec4((projectionMatrix * translationMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0); }`;

const CRYSTAL_FRAG = `
precision highp float;
varying vec2 vPos; varying vec3 vNormal; varying float vKind;   // kind: 0 a crystal's face, 1 the rock, 2 the floor's tint
uniform vec4 uLights[8];    // x, y, reach, strength
uniform vec3 uLightCol[8];
uniform float uCount, uGrid;
uniform vec3 uPale, uDeep;
void main(){
  vec3 n = normalize(vNormal), col = vec3(0.0);
  for (int i = 0; i < 8; i++) {
    if (float(i) >= uCount) break;
    vec4 L = uLights[i]; vec3 to = vec3(L.xy - vPos, uGrid * 0.9);
    float att = (1.0 - smoothstep(L.z * 0.25, L.z, length(to.xy))) * L.w;
    if (att <= 0.0) continue;
    vec3 l = normalize(to);
    float diff = max(0.0, dot(n, l)) * att, spec = pow(max(0.0, dot(n, normalize(l + vec3(0.0, 0.0, 1.0)))), 140.0) * att;
    if (vKind < 0.5) {
      float k = 0.04 + 0.9 * diff;
      col += mix(uDeep, uPale, clamp(k - 0.3, 0.0, 1.0)) * k * uLightCol[i] * 0.35 + spec * vec3(1.0, 0.97, 0.92) * 0.9;
    } else if (vKind < 1.5) col += vec3(0.3, 0.28, 0.31) * diff * 0.35 * uLightCol[i];
    else col += uPale * 0.08 * att * att;
  }
  // The floor's tint fades out from the cluster (its quad's own falloff in the normal's x, y).
  if (vKind > 1.5) col *= max(0.0, 1.0 - length(vNormal.xy));
  // Several lights together never wash a face out.
  col = col / (1.0 + max(col.r, max(col.g, col.b)) * 0.6);
  gl_FragColor = vec4(col, 0.0);
}`;

const AREA_VERT = `
precision highp float;
attribute vec2 aVertexPosition; attribute vec2 aUvs;
uniform mat3 translationMatrix; uniform mat3 projectionMatrix;
varying vec2 vUv;
void main(){ vUv = aUvs; gl_Position = vec4((projectionMatrix * translationMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0); }`;

const LAVA_FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uMask;    // a: the lava (soft edged)
uniform sampler2D uWide;    // a: a wide blur of it (the light it throws around)
uniform vec4 uBox;         // the quad over the scene: x, y, w, h
uniform float uTime, uGrid, uHeat, uPass;   // pass 0: the lava on the floor; 1: its glow, over the darkness
${NOISE}
vec2 worley(vec2 q){ vec2 i = floor(q); float f1 = 9.0, f2 = 9.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec2 c = i + vec2(float(x), float(y)); float h = hash(c), h2 = hash(c + 31.7);
    vec2 p = c + 0.5 + 0.4 * vec2(sin(uTime * 0.07 + h * 6.28), cos(uTime * 0.06 + h2 * 6.28)); float d = length(p - q);
    if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d; }
  return vec2(f1, f2); }
vec3 ramp(float T){ T = clamp(T, 0.0, 1.0);
  vec3 a = vec3(0.086, 0.055, 0.047), b = vec3(0.27, 0.047, 0.024), c = vec3(0.69, 0.15, 0.03), d = vec3(0.98, 0.47, 0.1), e = vec3(1.0, 0.91, 0.63);
  if (T < 0.25) return mix(a, b, T / 0.25); if (T < 0.5) return mix(b, c, (T - 0.25) / 0.25); if (T < 0.75) return mix(c, d, (T - 0.5) / 0.25); return mix(d, e, (T - 0.75) / 0.25); }
void main(){
  vec2 px = uBox.xy + vUv * uBox.zw;
  float glowAround = texture2D(uWide, vUv).a;
  float shore = texture2D(uMask, vUv).a + (fbm(px / (uGrid * 1.1)) - 0.5) * 0.5;
  float flick = 0.85 + 0.15 * noise(vec2(uTime * 1.7, 3.0)) + 0.05 * sin(uTime * 7.0);
  if (shore < 0.5) {
    // Off the lava: only its light on the rock around.
    if (uPass > 0.5) { float h = glowAround * (1.0 - smoothstep(0.35, 0.55, shore)); gl_FragColor = vec4(vec3(0.78, 0.27, 0.06) * h * (0.22 + 0.2 * uHeat) * flick, 0.0); }
    else gl_FragColor = vec4(0.0);
    return;
  }
  float edge = clamp((shore - 0.5) * 3.0, 0.0, 1.0);
  vec2 w = px + (vec2(fbm(px / (uGrid * 2.4) + vec2(uTime * 0.015, 0.0)), fbm(px / (uGrid * 2.4) + vec2(7.0, -uTime * 0.012))) - 0.5) * uGrid * 0.6 - vec2(uTime * uGrid * 0.07, 0.0);
  vec2 f = worley(w / (uGrid * 0.5)); float crack = f.y - f.x;
  float melt = clamp((fbm(px / (uGrid * 2.2) - vec2(uTime * 0.01, 0.0)) - 0.6 + 0.3 * uHeat) / 0.2, 0.0, 1.0);
  float width = 0.03 + 0.04 * uHeat + 0.03 * fbm(w / (uGrid * 0.6)) + 0.42 * melt * melt;
  float open = 0.35 + 0.65 * clamp((fbm(w / (uGrid * 0.8) + 3.0) - 0.35) / 0.25, 0.0, 1.0);
  float seam = exp(-(crack * crack) / (width * width)), rim = 0.45 * exp(-crack / (width * 2.2));
  float T = max(seam * (0.82 + 0.18 * fbm(vec2(px.x - uTime * uGrid * 0.22, px.y) / vec2(uGrid * 0.3, uGrid * 0.18))), rim) * max(open, melt);
  T = max(T, 0.18 * uHeat * fbm(w / (uGrid * 0.45)) + 0.6 * max(0.0, noise(px / (uGrid * 1.6) + vec2(uTime * 0.06, -uTime * 0.04)) - 0.6) * uHeat);
  T *= (0.2 + 0.8 * edge) * (0.55 + 0.6 * uHeat);
  // Bubbles: here and there one swells, bright under a dark skin, and bursts.
  vec2 cell = floor(px / (uGrid * 0.7)); float hb = hash(cell), per = 3.0 + hb * 5.0, life = fract(uTime / per + hb * 7.0);
  vec2 bc = (cell + 0.3 + 0.4 * vec2(hash(cell + 3.1), hash(cell + 5.7))) * uGrid * 0.7; float br = uGrid * (0.04 + 0.06 * hb) * (0.4 + 0.6 * life), bd = length(px - bc);
  float bub = (hb < 0.25 + 0.3 * uHeat && life < 0.9 && edge > 0.5) ? life : 0.0;
  T = max(T, bub * 0.9 * exp(-pow(bd / br, 2.0) * 1.5));
  float skin = bub * smoothstep(br * 0.9, br, bd) * smoothstep(br * 1.15, br, bd);
  vec3 col = ramp(T);
  if (T < 0.2) col += (fbm(px / (uGrid * 0.13)) - 0.45) * 0.09 * (1.0 - T / 0.2);
  col = mix(col, vec3(0.16, 0.05, 0.03), skin * 0.7);
  // Embers off a bubble as it bursts.
  float ember = 0.0;
  if (life > 0.9 && hb < 0.25 + 0.3 * uHeat) for (int s = 0; s < 4; s++) { float fs = float(s), a = hash(cell + fs * 1.3) * 6.2832, k = (life - 0.9) / 0.1;
    vec2 at = bc + vec2(cos(a), sin(a)) * k * uGrid * (0.2 + 0.25 * hash(cell + fs)); ember += (1.0 - k) * exp(-dot(px - at, px - at) / (uGrid * uGrid * 0.00025)); }
  float a = smoothstep(0.5, 0.56, shore);
  if (uPass < 0.5) gl_FragColor = vec4(col * a, a);
  else gl_FragColor = vec4((col * smoothstep(0.15, 0.8, T) * 1.25 + vec3(1.0, 0.6, 0.2) * ember + vec3(0.78, 0.27, 0.06) * glowAround * (0.22 + 0.2 * uHeat) * flick) * a, 0.0);
}`;

const MIST_FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uMask;    // a: the mist's region (soft edged)
uniform sampler2D uTrail;   // r: where feet have parted it lately (1 just now)
uniform sampler2D uDraft;   // the air's flow (indoor-air.mjs draftPixels): rg the way, b how fast
uniform vec4 uBox, uField;  // the quad; where the draft lies (x, y, w, h)
uniform float uTime, uGrid, uThick;
${NOISE}
float banksAt(vec2 px, vec2 drift){
  float n = fbm(px / (uGrid * 2.0) + drift + 0.3 * vec2(fbm(px / (uGrid * 3.0) - drift), 0.0)), n2 = fbm(px / (uGrid * 0.7) - drift * 1.6);
  return smoothstep(0.28, 0.72, n * 0.75 + n2 * 0.25);
}
void main(){
  vec2 px = uBox.xy + vUv * uBox.zw;
  float m = texture2D(uMask, vUv).a;
  if (m < 0.01) { gl_FragColor = vec4(0.0); return; }
  // Banks of mist drifting slowly, wisps through them; thinning toward the region's edge. Where the air moves they
  // stream with it (two phases of the drift crossfaded, so it flows on without tearing).
  vec2 still = vec2(uTime * 0.05, -uTime * 0.02);
  vec4 d = texture2D(uDraft, (px - uField.xy) / uField.zw);
  vec2 flow = (d.rg * 2.0 - 1.0) * d.b * 1.4;
  float p1 = fract(uTime * 0.12), p2 = fract(uTime * 0.12 + 0.5), w = abs(1.0 - 2.0 * p1);
  float banks = mix(banksAt(px, still - flow * p1), banksAt(px, still - flow * p2), 1.0 - w);
  float part = texture2D(uTrail, vUv).r;
  float d = m * m * (0.25 + 0.75 * banks) * uThick * (1.0 - 0.92 * part);
  float a = clamp(d, 0.0, 0.85);
  gl_FragColor = vec4(vec3(0.8, 0.83, 0.87) * a, a);
}`;

const SKY_FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uMask;    // a: the opening (soft edged)
uniform vec4 uBox;
uniform vec2 uShift;        // where the light lands from the opening (px): away from the sun, further the lower it is
uniform vec3 uColor;
uniform float uStrength, uTime, uGrid;
${NOISE}
float openAt(vec2 px){ vec2 uv = (px - uBox.xy) / uBox.zw; return (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) ? 0.0 : texture2D(uMask, uv).a; }
void main(){
  if (uStrength < 0.01) { gl_FragColor = vec4(0.0); return; }
  vec2 px = uBox.xy + vUv * uBox.zw;
  // The pool on the floor: the opening's shape, cast away from the sun, its edge softened, dappled a little.
  float pool = openAt(px - uShift) * (0.85 + 0.15 * noise(px / (uGrid * 0.6) + uTime * 0.05));
  // The shaft: the light seen in the air between the opening and the pool.
  float beam = 0.0;
  for (int k = 1; k < 8; k++) beam += openAt(px - uShift * (float(k) / 8.0));
  beam /= 7.0;
  // Dust turning in the shaft.
  float motes = 0.0;
  if (beam > 0.05) for (int i = 0; i < 2; i++) {
    float layer = float(i), cell = uGrid * (0.14 + 0.08 * layer);
    vec2 q = (px + vec2(sin(uTime * 0.13 + layer), cos(uTime * 0.11 - layer)) * uGrid * 0.4) / cell + layer * 5.1;
    vec2 id = floor(q), f = fract(q) - 0.5; float h = hash(id);
    if (h < 0.35) { f -= (vec2(hash(id + 1.3), hash(id + 2.9)) - 0.5) * 0.6; motes += (1.0 - smoothstep(0.02, 0.07, length(f))) * (0.4 + 0.6 * pow(0.5 + 0.5 * sin(uTime * (0.7 + h * 2.0) + h * 30.0), 2.0)); }
  }
  vec3 col = uColor * uStrength * (pool * 0.5 + beam * 0.18 + motes * beam * 0.7);
  gl_FragColor = vec4(col, 0.0);
}`;

// A quad over a box, with uvs.
const quad = (PIXI, b) => new PIXI.Geometry()
  .addAttribute('aVertexPosition', [b.x, b.y, b.x + b.w, b.y, b.x + b.w, b.y + b.h, b.x, b.y + b.h], 2)
  .addAttribute('aUvs', [0, 0, 1, 0, 1, 1, 0, 1], 2).addIndex([0, 1, 2, 0, 2, 3]);

// An area's mask over `box` (in its alpha): the area itself, blurred by `soft` px.
const maskOf = (PIXI, render, polygons, box, { soft = 0 } = {}) => {
  const k = Math.min(0.25, 1024 / Math.max(box.w, box.h)), w = Math.max(1, Math.ceil(box.w * k)), h = Math.max(1, Math.ceil(box.h * k));
  const out = PIXI.RenderTexture.create({ width: w, height: h }), g = new PIXI.Graphics();
  for (const p of polygons) { g.beginFill(0xffffff, 1); g.drawPolygon(p.map((v, i) => (v - (i % 2 ? box.y : box.x)) * k)); g.endFill(); for (const hole of p.holes ?? []) { g.beginHole(); g.drawPolygon(hole.map((v, i) => (v - (i % 2 ? box.y : box.x)) * k)); g.endHole(); } }
  const blur = Math.max(2, soft * k), filter = new PIXI.BlurFilter(blur); filter.padding = Math.ceil(blur * 3); g.filters = [filter];
  try { render(g, out); } finally { try { g.destroy(); } catch { /* drawn */ } }
  return out;
};

/**
 * The caverns' layers. `floor()` a container on the floor (under the creatures), `glow()` one over the darkness
 * (added light), `render(displayObject, renderTexture)`.
 * build({ fungus: [{ areas, color }], crystals: [{ areas, stone }], lava: [areas], mist: [areas], walls, grid, seed, isFloor })
 * lays it all out; look({ touches: [{ x, y, ago }], lights: [{ x, y, reach, strength, color: [r, g, b] }] }) a few times
 * a second; feet([{ x, y }]) parts the mist; tick(seconds); clear().
 */
export function createCavern({ PIXI, floor, glow, render }) {
  let meshes = [], textures = [], graphics = [], fungus = [], crystals = [], lavas = [], mists = [], skies = [], grid = 100, time = 0;
  // The air's flow (draft()), for the mist to stream with: none, a still texture.
  let draft = null, draftField = [0, 0, 1, 1];
  let still = null;
  const draftTex = () => draft ?? (still ??= PIXI.Texture.fromBuffer(new Uint8Array([128, 128, 0, 255]), 1, 1));
  const drop = () => {
    for (const m of [...meshes, ...graphics]) { try { m.parent?.removeChild(m); m.destroy(); } catch { /* gone */ } }
    for (const t of textures) { try { t.destroy(true); } catch { /* gone */ } }
    meshes = []; textures = []; graphics = []; fungus = []; crystals = []; lavas = []; mists = []; skies = [];
  };
  const add = (mesh, root, blend) => { mesh.eventMode = 'none'; if (blend) mesh.blendMode = blend; root().addChild(mesh); meshes.push(mesh); return mesh; };
  return {
    build({ fungus: fungusAreas = [], crystals: crystalAreas = [], lava = [], mist = [], sky = [], walls = [], grid: g = 100, seed = 'cave', isFloor = () => true } = {}) {
      drop(); grid = g;
      // Openings to the sky: a quad over each, wide enough for the pool its light casts (as far as a low sun throws it).
      for (const areas of sky) for (const p of areas) {
        const b0 = boxOf(p), pad = grid * 4, box = { x: b0.x - pad, y: b0.y - pad, w: b0.w + pad * 2, h: b0.h + pad * 2 };
        const mask = maskOf(PIXI, render, [p], box, { soft: grid * 0.3 }); textures.push(mask);
        const own = { uMask: mask, uBox: [box.x, box.y, box.w, box.h], uShift: [0, 0], uColor: [1, 0.93, 0.78], uStrength: 0, uTime: 0, uGrid: grid };
        add(new PIXI.Mesh(quad(PIXI, box), PIXI.Shader.from(AREA_VERT, SKY_FRAG, own)), glow, PIXI.BLEND_MODES.ADD);
        skies.push(own);
      }
      // Fungus: the caps on the floor as light shows them, and their glow over the darkness (one mesh each a colour, a
      // quad a cap, big enough for its halo); the threads as faint pale lines on the floor.
      for (const { areas, color } of fungusAreas) {
        const clusters = fungusIn(areas, { grid, seed: `${seed}:fungus:${color}`, floor: isFloor }), pos = [], center = [], cap = [], index = [];
        for (const cl of clusters) for (const c of cl.caps) {
          const H = c.r * 5, i = pos.length / 2;
          pos.push(c.x - H, c.y - H * 1.2, c.x + H, c.y - H * 1.2, c.x + H, c.y + H, c.x - H, c.y + H);
          for (let k = 0; k < 4; k++) { center.push(c.x, c.y); cap.push(c.r, c.phase, c.seed, Math.hypot(c.x - cl.x, c.y - cl.y)); }
          index.push(i, i + 1, i + 2, i, i + 2, i + 3);
        }
        if (!index.length) continue;
        const [glowC, pale, flesh] = FUNGUS_COLORS[color] ?? FUNGUS_COLORS.green;
        const lines = new PIXI.Graphics(); lines.eventMode = 'none';
        lines.lineStyle(Math.max(0.5, grid * 0.006), new PIXI.Color(flesh).toNumber(), 0.35);
        for (const cl of clusters) for (const th of cl.threads) { lines.moveTo(th[0][0], th[0][1]); for (const [x, y] of th.slice(1)) lines.lineTo(x, y); }
        floor().addChild(lines); graphics.push(lines);
        const geometry = new PIXI.Geometry().addAttribute('aVertexPosition', pos, 2).addAttribute('aCenter', center, 2).addAttribute('aCap', cap, 4).addIndex(index);
        const body = { uTime: 0, uGrid: grid, uPass: 0, uDark: 1, uGlow: glowC, uPale: pale, uFlesh: flesh, uTouch: new Float32Array(36).fill(1e4) };
        const lit = { ...body, uPass: 1, uTouch: new Float32Array(36).fill(1e4) };
        add(new PIXI.Mesh(geometry, PIXI.Shader.from(FUNGUS_VERT, FUNGUS_FRAG, body)), floor);
        add(new PIXI.Mesh(geometry, PIXI.Shader.from(FUNGUS_VERT, FUNGUS_FRAG, lit)), glow, PIXI.BLEND_MODES.ADD);
        fungus.push(body, lit);
      }
      // Crystals: one mesh a stone, its faces as triangles with their normals, and a soft quad of tint on the floor.
      for (const { areas, stone } of crystalAreas) {
        const clusters = crystalsIn(areas, { walls, grid, seed: `${seed}:crystals:${stone}`, floor: isFloor }), pos = [], normal = [], kind = [];
        for (const cl of clusters) {
          for (const t of crystalFaces(cl)) for (const [x, y] of t.pts) { pos.push(x, y); normal.push(...t.n); kind.push(t.kind); }
          const R = grid * 0.8, corners = [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]];
          for (const [dx, dy] of corners) { pos.push(cl.x + dx * R, cl.y + dy * R); normal.push(dx, dy, 0.001); kind.push(2); }
        }
        if (!pos.length) continue;
        const [pale, deep] = CRYSTAL_STONES[stone] ?? CRYSTAL_STONES.amethyst;
        const own = { uLights: new Float32Array(32), uLightCol: new Float32Array(24), uCount: 0, uGrid: grid, uPale: pale, uDeep: deep };
        const geometry = new PIXI.Geometry().addAttribute('aVertexPosition', pos, 2).addAttribute('aNormal', normal, 3).addAttribute('aKind', kind, 1);
        add(new PIXI.Mesh(geometry, PIXI.Shader.from(CRYSTAL_VERT, CRYSTAL_FRAG, own)), glow, PIXI.BLEND_MODES.ADD);
        // The stone itself as ordinary light shows it, on the floor (the same faces, plain, under the darkness).
        const dull = new PIXI.Graphics(); dull.eventMode = 'none';
        for (const cl of clusters) for (const t of crystalFaces(cl)) { const shade = t.kind ? 0x2a272c : new PIXI.Color(deep.map((v) => v * (0.35 + 0.4 * Math.max(0, t.n[0] * -0.6 + t.n[1] * -0.5 + t.n[2] * 0.6)))).toNumber(); dull.beginFill(shade, 0.92); dull.drawPolygon(t.pts.flat()); dull.endFill(); }
        floor().addChild(dull); graphics.push(dull);
        crystals.push(own);
      }
      // Lava: a quad over each area (and a few squares round it for its light), drawn twice.
      for (const areas of lava) for (const p of areas) {
        const b0 = boxOf(p), pad = grid * 3, box = { x: b0.x - pad, y: b0.y - pad, w: b0.w + pad * 2, h: b0.h + pad * 2 };
        const mask = maskOf(PIXI, render, [p], box, { soft: grid * 0.25 }), wide = maskOf(PIXI, render, [p], box, { soft: grid * 1.6 }); textures.push(mask, wide);
        const own = { uMask: mask, uWide: wide, uBox: [box.x, box.y, box.w, box.h], uTime: 0, uGrid: grid, uHeat: 0.6, uPass: 0 }, lit = { ...own, uPass: 1 };
        const geometry = quad(PIXI, box);
        add(new PIXI.Mesh(geometry, PIXI.Shader.from(AREA_VERT, LAVA_FRAG, own)), floor);
        add(new PIXI.Mesh(geometry, PIXI.Shader.from(AREA_VERT, LAVA_FRAG, lit)), glow, PIXI.BLEND_MODES.ADD);
        lavas.push(own, lit);
      }
      // Mist: a quad over each area; where feet passed lately in a small picture (a cell a quarter square).
      for (const areas of mist) for (const p of areas) {
        const b0 = boxOf(p), pad = grid * 0.5, box = { x: b0.x - pad, y: b0.y - pad, w: b0.w + pad * 2, h: b0.h + pad * 2 };
        const mask = maskOf(PIXI, render, [p], box, { soft: grid * 0.5 }); textures.push(mask);
        const cols = Math.max(1, Math.ceil(box.w / (grid / 4))), rows = Math.max(1, Math.ceil(box.h / (grid / 4))), cells = new Float32Array(cols * rows), px = new Uint8Array(cols * rows * 4);
        const trail = PIXI.Texture.fromBuffer(px, cols, rows, { scaleMode: PIXI.SCALE_MODES.LINEAR }); textures.push(trail);
        const own = { uMask: mask, uTrail: trail, uDraft: draftTex(), uField: draftField, uBox: [box.x, box.y, box.w, box.h], uTime: 0, uGrid: grid, uThick: 1.1 };
        add(new PIXI.Mesh(quad(PIXI, box), PIXI.Shader.from(AREA_VERT, MIST_FRAG, own)), floor);
        mists.push({ own, box, cols, rows, cells, px, trail, dirty: false });
      }
    },
    look({ touches = [], lights = [], dark = 1, sky = null } = {}) {
      for (const own of skies) { own.uStrength = sky?.strength ?? 0; if (sky) { own.uColor = sky.color; own.uShift = sky.shift; } }
      for (const own of fungus) { own.uDark = dark; own.uTouch.fill(1e4); touches.slice(0, 12).forEach((t, i) => { own.uTouch[i * 3] = t.x; own.uTouch[i * 3 + 1] = t.y; own.uTouch[i * 3 + 2] = t.ago; }); }
      for (const own of crystals) {
        const list = lights.slice(0, 8);
        list.forEach((l, i) => { own.uLights[i * 4] = l.x; own.uLights[i * 4 + 1] = l.y; own.uLights[i * 4 + 2] = l.reach; own.uLights[i * 4 + 3] = l.strength; own.uLightCol[i * 3] = l.color[0]; own.uLightCol[i * 3 + 1] = l.color[1]; own.uLightCol[i * 3 + 2] = l.color[2]; });
        own.uCount = list.length;
      }
    },
    // The air's flow (indoor-air.mjs draftPixels, cols x rows of `cell` px from (x, y)); null: still.
    draft(pixels = null, { cols = 1, rows = 1, x = 0, y = 0, cell = 100 } = {}) {
      try { draft?.destroy(true); } catch { /* gone */ }
      draft = pixels ? PIXI.Texture.fromBuffer(pixels, cols, rows, { scaleMode: PIXI.SCALE_MODES.LINEAR }) : null;
      draftField = [x, y, cols * cell, rows * cell];
      for (const m of mists) { m.own.uDraft = draftTex(); m.own.uField = draftField; }
    },
    // Feet part the mist: each creature on it clears a little round patch, which closes again over several seconds.
    feet(list = []) {
      for (const m of mists) for (const f of list) {
        const ci = (f.x - m.box.x) / (grid / 4), cj = (f.y - m.box.y) / (grid / 4), rad = 2.2;
        if (ci < -rad || cj < -rad || ci > m.cols + rad || cj > m.rows + rad) continue;
        for (let j = Math.floor(cj - rad); j <= Math.ceil(cj + rad); j++) for (let i = Math.floor(ci - rad); i <= Math.ceil(ci + rad); i++) {
          if (i < 0 || j < 0 || i >= m.cols || j >= m.rows) continue;
          const d = Math.hypot(i - ci, j - cj) / rad; if (d < 1) { const k = j * m.cols + i; m.cells[k] = Math.max(m.cells[k], 1 - d * d); m.dirty = true; }
        }
      }
    },
    tick(seconds) {
      time += seconds;
      for (const o of fungus) o.uTime = time;
      for (const o of lavas) o.uTime = time;
      for (const o of skies) o.uTime = time;
      for (const m of mists) {
        m.own.uTime = time;
        if (!m.dirty) continue;
        let any = false;
        for (let k = 0; k < m.cells.length; k++) { const v = Math.max(0, m.cells[k] - seconds * 0.12); m.cells[k] = v; m.px[k * 4] = v * 255; if (v > 0) any = true; }
        m.trail.baseTexture.update(); m.dirty = any;
      }
    },
    clear: drop,
    get busy() { return meshes.length > 0; },
    get wantsLights() { return crystals.length > 0; },
    get wantsSky() { return skies.length > 0; },
    get wantsTouches() { return fungus.length > 0; },
    get wantsFeet() { return mists.length > 0; },
  };
}
