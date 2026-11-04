// Water dripping from a ceiling: the region marked as dripping holds a pool, its rough shore just inside the region's
// edge and the stone round it wet and dark. Through the water the floor shows, dimmer and bluer the deeper, and drops
// fall all over it (each spot at its own pace, big drops and small), each bending the floor as its rings run out and
// cross the others', the wave crests lit on the side facing the light and glinting, the troughs dark; it lands with a
// tiny crown and a droplet bouncing back up. Over open water there is no pool: the water itself rings. All on the GPU,
// the floor read from the map's own picture (so it bends under the ripples).

export const MAX_DROPS = 16, MAX_POINTS = 32, MAX_STEPS = 6;
const rng = (seed) => { let h = 2166136261; for (const c of String(seed)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; }; };
const inside = ({ x, y }, p) => { let hit = false; for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) if ((p[i + 1] > y) !== (p[j + 1] > y) && x < ((p[j] - p[i]) * (y - p[i + 1])) / (p[j + 1] - p[i + 1]) + p[i]) hit = !hit; return hit; };
const boxOf = (p) => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (let i = 0; i < p.length; i += 2) { x0 = Math.min(x0, p[i]); x1 = Math.max(x1, p[i]); y0 = Math.min(y0, p[i + 1]); y1 = Math.max(y1, p[i + 1]); } return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }; };

// Where the drops fall in one area (pure): about one a square (at least two, at most MAX_DROPS; fewer and slower at a
// slow `pace`, more and quicker at a fast one), each well inside it, with its own rhythm (seconds between drops), offset,
// size (0.6 small – 1.4 big) and seed; and whether the area is open water (its middle inside one of `water`, polygons).
// The same area always gives the same drops.
// How a region's drip pace changes it: how many spots drip (a share of one a square) and how much slower each is.
export const DRIP_PACES = { slow: { spots: 0.2, every: 3 }, '': { spots: 0.6, every: 1 }, fast: { spots: 1, every: 0.6 }, faster: { spots: 1.6, every: 0.35 } };
// How deep a dripping region's water is: 0 a puddle (the floor plain through it), 0.5 a pool, 1 deep (dark, the floor
// barely seen).
export const DRIP_DEPTHS = { '': 0, pool: 0.5, deep: 1 };

export function dripsIn(area, { grid = 100, seed = 'drips', water = [], pace = '' } = {}) {
  const { spots, every } = DRIP_PACES[pace] ?? DRIP_PACES[''], random = rng(seed), b = boxOf(area);
  const want = Math.min(MAX_DROPS, Math.max(pace === 'slow' ? 1 : 2, Math.round(((b.w * b.h) / (grid * grid)) * spots)));
  const margin = Math.min(grid * 0.25, Math.min(b.w, b.h) * 0.2), drops = [];
  const deep = (pt) => inside(pt, area) && [[margin, 0], [-margin, 0], [0, margin], [0, -margin]].every(([dx, dy]) => inside({ x: pt.x + dx, y: pt.y + dy }, area));
  for (let tries = 0; drops.length < want && tries < want * 40; tries++) {
    const at = { x: b.x + random() * b.w, y: b.y + random() * b.h };
    if (!deep(at)) continue;
    drops.push({ ...at, every: (2.5 + random() * 4.5) * every, offset: random() * 6, size: 0.6 + random() * 0.8, seed: random() * 100 });
  }
  const middle = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  return { drops, water: water.some((w) => inside(middle, w)) };
}

const VERT = `
precision highp float;
attribute vec2 aVertexPosition; attribute vec2 aUvs;
uniform mat3 translationMatrix; uniform mat3 projectionMatrix;
varying vec2 vUv;
void main(){ vUv = aUvs; gl_Position = vec4((projectionMatrix * translationMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0); }`;

const FRAG = `
precision highp float;
varying vec2 vUv;
uniform vec2 uPoly[${MAX_POINTS}];      // the region's outline (scene px)
uniform float uPolyN;
uniform sampler2D uFloor;          // the map's own picture
uniform vec4 uBox, uRect;           // this quad over the scene; where the map's picture lies (x, y, w, h)
uniform vec4 uDrops[${MAX_DROPS}];  // each drop: x, y, seconds between drops, offset
uniform vec4 uDrops2[${MAX_DROPS}]; // size, seed
uniform float uCount, uTime, uGrid, uHasFloor, uOpen, uDeep;   // deep: 0 a puddle – 1 deep water
uniform vec4 uSteps[${MAX_STEPS}];   // creatures stepping in it lately: x, y, when, size
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 3; i++) { s += a * noise(p); p = p * 2.03 + 17.0; a *= 0.5; } return s; }
// How far inside the outline a point is (px; negative outside).
float inside(vec2 q){
  float d = 1e9; bool inPoly = false;
  vec2 a = uPoly[0];
  for (int j = 1; j < ${MAX_POINTS}; j++) { if (float(j) < uPolyN) a = uPoly[j]; }
  for (int i = 0; i < ${MAX_POINTS}; i++) {
    if (float(i) >= uPolyN) break;
    vec2 b = uPoly[i];
    if (i > 0) a = uPoly[i - 1];
    vec2 e = b - a, w = q - a; float t = clamp(dot(w, e) / max(dot(e, e), 1e-6), 0.0, 1.0);
    d = min(d, length(w - e * t));
    if ((a.y > q.y) != (b.y > q.y) && q.x < (b.x - a.x) * (q.y - a.y) / (b.y - a.y) + a.x) inPoly = !inPoly;
  }
  return inPoly ? d : -d;
}
vec3 floorAt(vec2 at){ return uHasFloor > 0.5 ? texture2D(uFloor, clamp((at - uRect.xy) / uRect.zw, 0.0, 1.0)).rgb : vec3(0.3, 0.28, 0.26); }
void main(){
  vec2 px = uBox.xy + vUv * uBox.zw; float g = uGrid;
  // The pool's rough shore, just inside the region's edge (in open water the map's water is the pool).
  // 0.5 on the outline, 1 well inside; wandering in and out of it.
  float shore = 0.5 + inside(px) / (g * 0.8) + (fbm(px / (g * 0.3)) - 0.5) * 0.5;
  if (uOpen < 0.5 && shore < 0.32) { gl_FragColor = vec4(0.0); return; }
  if (uOpen > 0.5 && shore < 0.5) { gl_FragColor = vec4(0.0); return; }
  // The surface's slope: a faint stir always, and every drop's rings (this one and the one before), each a short train
  // of waves running out and dying away, big drops wider and further.
  vec2 slope = vec2(0.012 * sin(px.x * 0.05 + uTime * 1.3 + sin(px.y * 0.04)), 0.012 * cos(px.y * 0.045 - uTime * 1.1 + sin(px.x * 0.03)));
  float waves = 0.0, spark = 0.0;
  for (int i = 0; i < ${MAX_DROPS}; i++) {
    if (float(i) >= uCount) break;
    vec4 d = uDrops[i], d2 = uDrops2[i]; float size = d2.x, seed = d2.y;
    vec2 p = px - d.xy; float dist = length(p), every = d.z, since = fract((uTime + d.w) / every) * every;
    for (int k = 0; k < 2; k++) {
      float s = since + float(k) * every; if (s > 5.0) continue;
      float off = dist - s * g * (0.8 + 0.3 * size), wid = g * 0.33 * size;
      if (off > g * 0.3 || off < -wid * 3.0) continue;
      float env = exp(-pow((off + g * 0.27 * size) / wid, 2.0)) * exp(-s * 1.1) * min(1.0, g * 0.45 * size / (dist + g * 0.15)) * 1.1 * size;
      waves += env;
      slope += -env * sin(off * 28.0 / (g * size)) * 0.42 * p / max(dist, 0.001);
    }
    // The drop: a glint just before it lands, a tiny crown of droplets thrown out and falling back, one bouncing up.
    float until = every - since;
    if (until < 0.12) spark += (1.0 - until / 0.12) * exp(-dot(p, p) / (g * g * 0.0002 * size));
    if (since < 0.35) { float c = since / 0.35; for (int j = 0; j < 7; j++) { float an = float(j) / 7.0 * 6.2832 + seed, r = g * 0.27 * size * c;
      vec2 at = vec2(cos(an), sin(an) * 0.85) * r - vec2(0.0, sin(c * 3.1416) * g * 0.09 * size); spark += 0.75 * (1.0 - c) * exp(-dot(p - at, p - at) / (g * g * 0.00012 * size)); } }
    if (since > 0.12 && since < 0.5) { float c = (since - 0.12) / 0.38; vec2 at = vec2(0.0, -sin(c * 3.1416) * g * 0.15 * size); spark += 0.8 * (1.0 - c * 0.5) * exp(-dot(p - at, p - at) / (g * g * 0.00025 * size)); }
  }
  // Steps through the water: each a ring running out from the foot, with a splash of droplets.
  for (int i = 0; i < ${MAX_STEPS}; i++) {
    vec4 st = uSteps[i]; float s = uTime - st.z, size = st.w;
    if (s < 0.0 || s > 2.2) continue;
    vec2 p = px - st.xy; float dist = length(p), gs = g * size, off = dist - s * gs * 0.9;
    if (off < gs * 0.4 && off > -gs * 1.2) {
      float env = exp(-pow((off + gs * 0.24) / (gs * 0.3), 2.0)) * exp(-s * 1.6) * min(1.0, gs * 0.4 / (dist + gs * 0.12)) * 1.1;
      waves += env; slope += -env * sin(off * 28.0 / gs) * 0.42 * p / max(dist, 0.001);
    }
    if (s < 0.4) { float c = s / 0.4; for (int j = 0; j < 9; j++) { float an = float(j) / 9.0 * 6.2832 + st.x * 0.01, r = gs * 0.32 * c * (0.7 + 0.3 * fract(float(j) * 0.618));
      vec2 at = vec2(cos(an), sin(an) * 0.85) * r - vec2(0.0, sin(c * 3.1416) * gs * 0.1); spark += 0.7 * (1.0 - c) * exp(-dot(p - at, p - at) / (gs * gs * 0.00015)); } }
  }
  // Where the light catches: from the upper left, warm.
  vec3 L = normalize(vec3(-0.55, -0.45, 0.7)), H = normalize(L + vec3(0.0, 0.0, 1.0)), n = normalize(vec3(-slope, 1.0));
  float spec = pow(max(0.0, dot(n, H)), 220.0) * 1.8, shade = (-slope.x * L.x - slope.y * L.y) * 1.6;
  vec3 col; float a;
  if (uOpen < 0.5 && shore < 0.5) {
    // The wet stone round the pool: darker, no ripples.
    col = floorAt(px) * 0.55; a = 0.85 * smoothstep(0.32, 0.5, shore);
  } else {
    // The floor seen through the water, bent by the slope, dimmed and tinted with depth.
    // Deeper water shelves off sooner from the shore, hides the floor more, and is darker and bluer.
    float depth = uOpen > 0.5 ? 0.5 : smoothstep(0.5, 1.1 - 0.4 * uDeep, shore);
    // How much floor shows: plain through a puddle; none at all in deep water past its shallow edge.
    float see = max(0.0, 0.52 - (0.24 + 0.28 * uDeep) * depth);
    col = floorAt(px + slope * g * (0.9 + 0.6 * uDeep * depth)) * see + vec3(0.03, 0.05, 0.075) * depth * (1.0 + 1.2 * uDeep);
    // The room's dim light lying on the water's face: more of it the less floor shows through.
    col += vec3(0.22, 0.2, 0.19) * (0.1 + 0.12 * uDeep) * depth + vec3(0.27, 0.24, 0.22) * shade * (1.0 + 0.5 * uDeep) + vec3(1.0, 0.85, 0.63) * spec;
    a = uOpen > 0.5 ? clamp(waves * 3.0, 0.0, 1.0) : smoothstep(0.5, 0.56, shore);
  }
  col += vec3(0.88, 0.91, 0.95) * spark; a = max(a, min(1.0, spark));
  gl_FragColor = vec4(col * a, a);
}`;

/** The layer: build({ areas, grid, water, floor: { texture, rect } }) lays a pool in each area (its `pace` and `depth`,
 * keys of DRIP_PACES and DRIP_DEPTHS; `water`, polygons of open water, ripple instead; `floor` the map's picture and where it lies, seen through the water);
 * tick(seconds, landed) (landed({ x, y, size, open }) for each drop that hits the water this frame); pools, each pool's box;
 * clear(). */
export function createDrips({ PIXI, root }) {
  let meshes = [], owns = [], count = 0;
  const drop = () => {
    for (const m of meshes) { try { m.parent?.removeChild(m); m.destroy(); } catch { /* gone */ } }
    meshes = []; owns = []; count = 0;
  };
  return {
    build({ areas = [], grid = 100, water = [], floor = null } = {}) {
      drop();
      const hasFloor = !!floor?.texture?.valid;
      areas.forEach((area, n) => {
        const { drops, water: open } = dripsIn(area, { grid, water, pace: area.pace ?? '', seed: `drips:${n}:${area.slice(0, 4).join(',')}` });
        if (!drops.length) return;
        const b0 = boxOf(area), pad = grid * 0.4, box = { x: b0.x - pad, y: b0.y - pad, w: b0.w + pad * 2, h: b0.h + pad * 2 };
        // The outline (a long one thinned to MAX_POINTS corners).
        const points = []; for (let i = 0; i < area.length; i += 2) points.push(area[i], area[i + 1]);
        const step = Math.max(1, Math.ceil(points.length / 2 / MAX_POINTS)), poly = new Float32Array(MAX_POINTS * 2); let corners = 0;
        for (let i = 0; i < points.length / 2 && corners < MAX_POINTS; i += step) { poly[corners * 2] = points[i * 2]; poly[corners * 2 + 1] = points[i * 2 + 1]; corners++; }
        const own = { uPoly: poly, uPolyN: corners, uFloor: hasFloor ? floor.texture : PIXI.Texture.WHITE, uBox: [box.x, box.y, box.w, box.h], uRect: hasFloor ? [floor.rect.x, floor.rect.y, floor.rect.width, floor.rect.height] : [0, 0, 1, 1],
          uDrops: new Float32Array(MAX_DROPS * 4), uDrops2: new Float32Array(MAX_DROPS * 4), uCount: drops.length, uTime: 0, uGrid: grid, uHasFloor: hasFloor ? 1 : 0, uOpen: open ? 1 : 0, uDeep: 0,
          uSteps: new Float32Array(MAX_STEPS * 4).fill(-1e4), area, list: drops.slice(0, MAX_DROPS), nextStep: 0 };
        own.uDeep = DRIP_DEPTHS[area.depth ?? ''] ?? 0;
        drops.forEach((d, i) => { own.uDrops.set([d.x, d.y, d.every, d.offset], i * 4); own.uDrops2.set([d.size, d.seed, 0, 0], i * 4); });
        const geometry = new PIXI.Geometry()
          .addAttribute('aVertexPosition', [box.x, box.y, box.x + box.w, box.y, box.x + box.w, box.y + box.h, box.x, box.y + box.h], 2)
          .addAttribute('aUvs', [0, 0, 1, 0, 1, 1, 0, 1], 2).addIndex([0, 1, 2, 0, 2, 3]);
        const mesh = new PIXI.Mesh(geometry, PIXI.Shader.from(VERT, FRAG, own)); mesh.eventMode = 'none';
        root().addChild(mesh); meshes.push(mesh); owns.push(own); count += drops.length;
      });
    },
    tick(seconds, landed = null) {
      for (const o of owns) {
        const was = o.uTime; o.uTime += seconds;
        // A drop hits the water as its rhythm comes round (as the shader draws it: since its last drop back to nothing).
        if (landed) for (const d of o.list) if (Math.floor((o.uTime + d.offset) / d.every) !== Math.floor((was + d.offset) / d.every)) landed({ x: d.x, y: d.y, size: d.size, open: !!o.uOpen });
      }
    },
    get pools() { return owns.filter((o) => !o.uOpen).map((o) => ({ x: o.uBox[0], y: o.uBox[1], w: o.uBox[2], h: o.uBox[3] })); },
    // A creature steps into a pool here ({ x, y, size }): its water rings (true), or there is no pool here (false).
    step({ x, y, size = 1 } = {}) {
      const own = owns.find((o) => !o.uOpen && inside({ x, y }, o.area) && !(o.area.holes ?? []).some((h) => inside({ x, y }, h)));
      if (!own) return false;
      own.uSteps.set([x, y, own.uTime, size], own.nextStep * 4); own.nextStep = (own.nextStep + 1) % MAX_STEPS;
      return true;
    },
    clear: drop,
    get count() { return count; },
  };
}
