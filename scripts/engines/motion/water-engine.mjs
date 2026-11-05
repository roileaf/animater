// Moving water: a live surface on a water region. Waves run along its current and before the wind, the map seen through them bends, and the
// sun, the moon and any flame near glint on them. It lies on the map under the floor layers, so what a region paints (floor-looks.mjs) covers it,
// and the shadows, the creatures and the darkness all fall on it as on the map. One quad a region, drawn only while it is in view.

import { floorLights, glareAt, skyForFloors } from './floor-looks.mjs';

// How each kind of water moves: rough how big its waves, pace how fast it runs, foam how white it breaks, swell how long its waves, streak (a fall) drawn out the way it falls.
export const WATER_MOTION = Object.freeze({
  still: { rough: 1, pace: 0, foam: 0, swell: 1, streak: 0 },
  river: { rough: 1, pace: 1, foam: 0, swell: 1, streak: 0 },
  rapids: { rough: 2.1, pace: 2.2, foam: 0.75, swell: 0.75, streak: 0 },
  falls: { rough: 1.5, pace: 4.5, foam: 1, swell: 1, streak: 1 },
  sea: { rough: 1.6, pace: 0, foam: 0.25, swell: 1.7, streak: 0 },
});
// How much foam water carries (pure): by its kind, as its stream is strong (`current` 0–1). A river only breaks when it runs hard.
export function waterFoam(kind, current = 0.4) {
  const c = Math.min(1, Math.max(0, Number.isFinite(Number(current)) ? Number(current) : 0.4)), base = (WATER_MOTION[kind] ?? WATER_MOTION.still).foam;
  if (kind === 'river') return Math.max(0, c - 0.5) * 0.3;
  return base * (kind === 'sea' ? 1 : 0.35 + 0.65 * c);
}
// How long the wave pattern slides before it fades into a fresh one, seconds.
const FLOW_CYCLE = 1.6;
// How each place's part of that cycle differs from its neighbours': over this many squares, by this part of a cycle.
const FLOW_PHASE = Object.freeze({ span: 7, amount: 0.5 });
// How much the timing bends the pattern (pure): the stretch across it at the fastest it runs, 0 none. Much over a quarter draws arcs in the water.
export const flowBend = (current = 1) => (FLOW_PHASE.amount / FLOW_PHASE.span) * current * 1.4 * 0.9 * FLOW_CYCLE * 1.5;
const MOST_LIGHTS = 6, MOST_RINGS = 16, RING_LIFE = 3, SKY_EVERY = 0.5, LIGHTS_EVERY = 0.2;

const VERT = `precision highp float;
attribute vec2 aVertexPosition;
uniform mat3 projectionMatrix, translationMatrix;
varying vec2 vWorld;
void main(){ vWorld = aVertexPosition; gl_Position = vec4((projectionMatrix * translationMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0); }`;

// `full`: three sizes of wave, the rings of what steps in it, and small water at the bank. Otherwise two sizes, and no more.
const fragOf = (full) => `precision highp float;
#define FULL ${full ? 1 : 0}
varying vec2 vWorld;
uniform sampler2D uMap, uMask, uFlow, uWaves, uBed; // uBed: a painted floor seen through it instead of the map, one every uBedSize px
uniform vec4 uMapRect, uBox;
uniform float uTime, uWind, uGrid, uCurrent, uSun, uFrozen, uLightCount, uStill, uRough, uFoam, uSwell, uStreak, uBedSize, uStrength;
uniform vec2 uWindDir, uToSun, uGlare, uDown, uRun; // uRun: where a fall starts and ends, along uDown
uniform vec3 uSunColor;
uniform vec4 uLights[${MOST_LIGHTS}];
uniform vec3 uLightColors[${MOST_LIGHTS}];
#if FULL
uniform vec4 uRings[${MOST_RINGS}];
#endif
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); float a = fract(sin(dot(i, vec2(127.1, 311.7))) * 43758.5), b = fract(sin(dot(i + vec2(1.0, 0.0), vec2(127.1, 311.7))) * 43758.5), c = fract(sin(dot(i + vec2(0.0, 1.0), vec2(127.1, 311.7))) * 43758.5), d = fract(sin(dot(i + vec2(1.0, 1.0), vec2(127.1, 311.7))) * 43758.5); return mix(mix(a, b, f.x), mix(c, d, f.x), f.y); }
// Bubbles packed together, each jostling about its own place: how far from the nearest one's middle, and how near the wall between it and the next.
vec2 bubbles(vec2 p, float t){
  vec2 cell = floor(p), inner = fract(p); float near = 8.0, next = 8.0;
  for (float j = -1.0; j <= 1.0; j += 1.0) for (float i = -1.0; i <= 1.0; i += 1.0) {
    vec2 g = vec2(i, j), c = cell + g, h = vec2(fract(sin(dot(c, vec2(127.1, 311.7))) * 43758.5), fract(sin(dot(c, vec2(269.5, 183.3))) * 43758.5));
    vec2 r = g + 0.5 + 0.42 * sin(t * (0.5 + h.yx) + h * 6.283) - inner;
    float d = dot(r, r); if (d < near) { next = near; near = d; } else if (d < next) next = d;
  }
  near = sqrt(near);
  return vec2(near, sqrt(next) - near);
}
// One size of wave: the sheet slid along the way the water goes, twice, each fading out before it has slid too far, so it never stretches.
vec2 waves(float size, vec2 drift, float pa, float pb, float wa, float wb, float seed){
  vec2 base, run;
  if (uStreak > 0.5) { base = vec2(dot(vWorld, vec2(-uDown.y, uDown.x)) / (uGrid * size * 0.3), dot(vWorld, uDown) / (uGrid * size * 2.6)) + seed; run = vec2(0.0, length(drift) / (uGrid * size * 2.6)); }
  else { base = vWorld / (uGrid * size) + seed; run = drift / (uGrid * size); }
  return (texture2D(uWaves, base - run * pa).xy * 2.0 - 1.0) * wa + (texture2D(uWaves, base - run * pb + 0.37).xy * 2.0 - 1.0) * wb;
}
void main(){
  vec2 uv = (vWorld - uBox.xy) / uBox.zw;
  vec4 mask = texture2D(uMask, uv);
  if (mask.r < 0.004) { gl_FragColor = vec4(0.0); return; }
  float deep = mask.g, calm = 1.0 - uFrozen;
  vec3 flowed = texture2D(uFlow, uv).rgb;
  // Along the current, before the wind. A river slower than its usual slows everything on it.
  vec2 along = (flowed.xy * 2.0 - 1.0) * flowed.z;
  // (A short cycle and a small slide: it never goes far enough for a bend in the river to shear the pattern. Each place has its own part of the cycle, so nothing pulses.)
  vec2 drift = (along * uCurrent * uGrid * 0.9 + uWindDir * uGrid * (0.04 + 0.3 * uWind) * uStill) * ${FLOW_CYCLE.toFixed(2)};
  float phase = noise(vWorld / (uGrid * ${FLOW_PHASE.span.toFixed(1)})) * ${FLOW_PHASE.amount.toFixed(2)}, pa = fract(uTime / ${FLOW_CYCLE.toFixed(2)} + phase), pb = fract(pa + 0.5), wa = 1.0 - abs(2.0 * pa - 1.0), wb = 1.0 - wa;
  // A fall: it comes down to the line where it lands, near its foot, a strong one thrown a little further out; below that is the pool it lands in.
  float land = mix(0.78, 0.86, uStrength), way = 0.0, landed = 0.0;
  if (uStreak > 0.5) { way = clamp((dot(vWorld, uDown) - uRun.x) / max(1.0, uRun.y - uRun.x), 0.0, 1.0) + (noise(vWorld / (uGrid * 0.7)) - 0.5) * 0.06; landed = smoothstep(land - 0.025, land + 0.05, way); }
  vec2 slope = waves(4.6 * uSwell, drift * 0.55, pa, pb, wa, wb, 0.0) * (0.035 + 0.09 * uWind) + waves(1.5 * uSwell, drift, pa, pb, wa, wb, 0.61) * (0.05 + 0.16 * uWind);
#if FULL
  slope += waves(0.48 * uSwell, drift * 1.5, pa, pb, wa, wb, 0.23) * (0.025 + 0.2 * uWind);
#endif
  if (landed > 0.0) {
    // The pool's own waves, round and slow, carried gently on from where it lands.
    vec2 roll = uDown * uGrid * (0.25 + 0.35 * uStrength) * ${FLOW_CYCLE.toFixed(2)};
    vec2 big = vWorld / (uGrid * 1.5) + 0.61, fine = vWorld / (uGrid * 0.48) + 0.23;
    vec2 pool = ((texture2D(uWaves, big - roll * pa / (uGrid * 1.5)).xy * 2.0 - 1.0) * wa + (texture2D(uWaves, big - roll * pb / (uGrid * 1.5) + 0.37).xy * 2.0 - 1.0) * wb) * 0.11
      + ((texture2D(uWaves, fine - roll * pa / (uGrid * 0.48)).xy * 2.0 - 1.0) * wa + (texture2D(uWaves, fine - roll * pb / (uGrid * 0.48) + 0.37).xy * 2.0 - 1.0) * wb) * 0.09;
    slope = mix(slope, pool, landed);
  }
  slope *= (1.0 + 0.7 * flowed.z * min(uCurrent, 2.0) * (1.0 - landed)) * (0.45 + 0.55 * smoothstep(0.0, 0.5, deep)) * calm * uRough;
  float rough = length(slope), crest = 0.0;
#if FULL
  if (landed > 0.0) {
    // Where it hits, each stretch of the fall throws out rings across the pool, in the water's real surface, so they bend what is under them and catch the light.
    float side = dot(vWorld, vec2(-uDown.y, uDown.x)) / uGrid, from = (dot(vWorld, uDown) - (uRun.x + (uRun.y - uRun.x) * land)) / uGrid, row = floor(side / 0.9);
    for (float i = -1.0; i <= 1.0; i += 1.0) for (float n = 0.0; n < 2.0; n += 1.0) {
      float c = row + i, h = fract(sin(c * 127.1 + n * 61.7) * 43758.5), age = fract(uTime * (0.32 + 0.2 * h) + h * 3.7 + n * 0.5);
      vec2 p = vec2(side - (c + 0.2 + 0.6 * h) * 0.9, from - (h - 0.5) * 0.12);
      float d = length(p), out_ = d - age * 1.5, ring = exp(-out_ * out_ / 0.012) * (1.0 - age) * (1.0 - age) * landed;
      crest = max(crest, ring); slope += ring * sin(out_ * 30.0) * 0.35 * p / max(d, 0.01);
    }
  }
#endif
#if FULL
  for (int i = 0; i < ${MOST_RINGS}; i++) {
    vec4 r = uRings[i]; float s = uTime - r.z; if (s < 0.0 || s > ${RING_LIFE.toFixed(1)}) continue;
    vec2 p = vWorld - r.xy; float d = length(p), g = uGrid * r.w, off = d - s * g * 0.95, wid = g * 0.34;
    if (off > g * 0.4 || off < -wid * 3.0) continue;
    slope += exp(-pow((off + g * 0.25) / wid, 2.0)) * exp(-s * 1.2) * sin(off * 26.0 / g) * 0.5 * p / max(d, 0.001);
  }
#endif
  // The map seen through it, bent; deep water holds less of its bed and more of its own colour.
  vec2 seen = vWorld + slope * uGrid * 0.55 * (0.4 + 0.6 * deep);
  vec3 col;
  if (uBedSize > 0.0) {
    // Its painted floor, sampled twice so it does not read as a repeat.
    vec2 tile = seen / uBedSize;
    col = mix(texture2D(uBed, tile).rgb, texture2D(uBed, vec2(tile.y, -tile.x) * 0.93 + 0.37).rgb, smoothstep(0.38, 0.62, noise(seen / (uGrid * 3.0))));
  } else {
    col = texture2D(uMap, clamp((seen - uMapRect.xy) / uMapRect.zw, 0.0, 1.0)).rgb;
    col = mix(col, col * vec3(0.72, 0.86, 0.9) + vec3(0.004, 0.016, 0.022), deep * 0.55 * calm);
  }
  // The sky on what tilts away from the eye.
  vec3 n = normalize(vec3(-slope, 1.0));
  col += mix(vec3(0.4, 0.46, 0.5), uSunColor, 0.35) * smoothstep(0.02, 0.24, rough) * 0.1 * (0.25 + 0.75 * uSun);
  // Each wave lit on the side toward the light and dark on the other, so it can be seen moving wherever the glare is not.
  col *= 1.0 + clamp(dot(slope, uToSun) * 2.0, -0.26, 0.26) * (0.3 + 0.7 * uSun) * (uStreak > 0.5 ? 0.3 : 1.0);
  // Glare: a long path lying toward the light, tightest across it; what the waves tilt into that path flashes.
  vec2 rel = (vWorld - uGlare) / (uGrid * 5.0), across = vec2(-uToSun.y, uToSun.x);
  float face = normalize(vec3(-slope * 1.5 - uToSun * dot(rel, uToSun) * 0.28 - across * dot(rel, across) * 1.4, 1.0)).z;
  // (Falling water is too broken to hold a long glare.)
  col += uSunColor * (pow(face, 520.0) * 0.6 + pow(face, 27.0) * 0.012) * uSun * (uStreak > 0.5 ? 0.35 : 1.0);
  // A flame near: glints on the waves, the way it lies.
  for (int i = 0; i < ${MOST_LIGHTS}; i++) {
    if (float(i) >= uLightCount) break;
    vec2 off = uLights[i].xy - vWorld; float dist = length(off), far = dist / uLights[i].z;
    if (far >= 1.0) continue;
    float faces = normalize(vec3(-slope * 1.5 - off / max(dist, 1.0) * min(0.45, far * 1.3), 1.0)).z, near = (1.0 - far) * (1.0 - far) * uLights[i].w;
    col += uLightColors[i] * (pow(faces, 300.0) * 2.4 + pow(faces, 30.0) * 0.12) * near;
  }
#if FULL
  // Small water lapping at the bank.
  float lap = (sin(deep * 26.0 + uTime * (1.1 + 1.6 * uWind) + noise(vWorld / (uGrid * 0.5)) * 9.0) * 0.5 + 0.5) * smoothstep(0.45, 0.7, noise(vWorld / (uGrid * 0.7) + uTime * 0.05));
  col += vec3(0.5, 0.54, 0.55) * smoothstep(0.7, 1.0, lap) * (1.0 - smoothstep(0.1, 0.75, deep)) * mask.r * 0.07 * (0.25 + 0.75 * max(uSun, min(1.0, uLightCount))) * calm;
#endif
  // Where it runs hard it breaks white: flat on top of the water, after its light, as foam has no waves of its own.
  if (uFoam > 0.0) {
    // Foam: soft clots of bubbles. A fall has it only at its foot, where it lands, boiling in place; the stronger the stream the further up it reaches.
    float clots, foam;
    if (uStreak > 0.5) {
      vec2 at = vWorld / (uGrid * 0.22);
      clots = noise(at + uTime * vec2(0.3, 0.2)) * 0.55 + noise(at * 2.2 + 11.0 - uTime * vec2(0.25, 0.4)) * 0.3 + noise(at * 4.9 + 23.0 + uTime * vec2(-0.4, 0.3)) * 0.15;
      // Where the water hits it churns white; from there it rides out on the rings and thins away down the pool.
      float wide = 0.025 + 0.035 * uStrength + (noise(vWorld / (uGrid * 0.55)) - 0.5) * 0.04, band = way < land ? exp(-pow((way - land) / 0.012, 2.0)) : exp(-pow((way - land) / max(0.01, wide), 2.0));
      float thick = (band * (0.9 + 0.4 * uStrength) + crest * 0.8 + landed * 0.05) * (0.3 + 2.2 * (clots - 0.35)) * uFoam;
      foam = 0.0;
      if (thick > 0.01) {
        // Bubbles as specks of two sizes, soft and filled, packing together into white where it is thick, with a few gaps left.
        vec2 wander = (vec2(noise(vWorld / (uGrid * 0.3)), noise(vWorld / (uGrid * 0.3) + 17.0)) - 0.5) * 0.5;
        vec2 big = bubbles(vWorld / (uGrid * 0.075) + wander, uTime);
        float specks = smoothstep(0.34, 0.14, big.x);
#if FULL
        vec2 small = bubbles(vWorld / (uGrid * 0.032) + wander * 2.0 + 5.0, uTime * 1.3);
        specks = max(specks, smoothstep(0.36, 0.16, small.x) * 0.85);
        foam = mix(specks * smoothstep(0.04, 0.4, thick), 1.0 - smoothstep(0.2, 0.08, small.x) * 0.35 * (1.0 - smoothstep(0.7, 1.2, thick)), smoothstep(0.45, 0.95, thick));
#else
        foam = mix(specks * smoothstep(0.04, 0.4, thick), 0.9, smoothstep(0.45, 0.95, thick));
#endif
      }
    } else {
      vec2 at = vWorld / (uGrid * 0.2), byA = at - drift * pa / (uGrid * 0.2), byB = at - drift * pb / (uGrid * 0.2) + 7.3;
      clots = (noise(byA) * 0.6 + noise(byA * 2.3 + 11.0) * 0.4) * wa + (noise(byB) * 0.6 + noise(byB * 2.3 + 11.0) * 0.4) * wb;
      foam = smoothstep(0.62 - 0.14 * uFoam, 0.82, clots + rough * 1.1) * uFoam * 0.85;
    }
    col = mix(col, vec3(0.86, 0.9, 0.92) * (0.93 + 0.1 * clots), min(1.0, foam) * calm);
  }
  // Where it has frozen, the map's own water is under the ice; this stops and fades.
  float a = smoothstep(0.0, 0.5, mask.r) * calm;
  gl_FragColor = vec4(col * a, a);
}`;

export const WATER_SHADERS = Object.freeze({ VERT, full: fragOf(true), simple: fragOf(false) });

// Which way water goes at each cell of a small grid (pure). It follows its banks, the way nearest what the region says: `soft` the region's shape
// blurred (0–255, `w` by `h`), `angle` the way it flows (radians), null for still water. Gives red and green the direction, blue where it flows.
export function flowField(soft, w, h, angle) {
  const out = new Uint8ClampedArray(w * h * 4);
  if (!Number.isFinite(angle)) { for (let i = 0; i < out.length; i += 4) { out[i] = 128; out[i + 1] = 128; out[i + 3] = 255; } return out; }
  const cx = Math.cos(angle), cy = Math.sin(angle), dx = new Float32Array(w * h), dy = new Float32Array(w * h), at = (i, j) => soft[Math.max(0, Math.min(h - 1, j)) * w + Math.max(0, Math.min(w - 1, i))];
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const gx = at(i + 1, j) - at(i - 1, j), gy = at(i, j + 1) - at(i, j - 1), length = Math.hypot(gx, gy), bank = Math.min(1, Math.max(0, (length - 2) / 10));
    let tx = length > 0 ? -gy / length : 0, ty = length > 0 ? gx / length : 0;
    const along = tx * cx + ty * cy;
    if (along < 0) { tx = -tx; ty = -ty; }
    // An edge square across the way it flows is where the region was cut off, not a bank: it runs on through.
    const follows = bank * Math.min(1, Math.max(0, (Math.abs(along) - 0.25) / 0.35));
    dx[j * w + i] = cx * (1 - follows) + tx * follows; dy[j * w + i] = cy * (1 - follows) + ty * follows;
  }
  // Smoothed, so the way it goes turns gently.
  for (let pass = 0; pass < 3; pass++) {
    const nx = new Float32Array(w * h), ny = new Float32Array(w * h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { let sx = 0, sy = 0; for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) { const c = Math.max(0, Math.min(h - 1, j + b)) * w + Math.max(0, Math.min(w - 1, i + a)); sx += dx[c]; sy += dy[c]; } nx[j * w + i] = sx; ny[j * w + i] = sy; }
    dx.set(nx); dy.set(ny);
  }
  for (let c = 0; c < w * h; c++) { const length = Math.hypot(dx[c], dy[c]) || 1, k = c * 4; out[k] = 127.5 + (dx[c] / length) * 127.5; out[k + 1] = 127.5 + (dy[c] / length) * 127.5; out[k + 2] = 255; out[k + 3] = 255; }
  return out;
}

// Where a ring goes (pure): next in turn, one that has not to wait for a free place; an animal's only where it takes no creature's still spreading, -1 if none.
export function ringSlot(keeps, rings, now, next, keep, life = 1.5) {
  if (keep) return next;
  for (let n = 0; n < keeps.length; n++) { const slot = (next + n) % keeps.length; if (!keeps[slot] || now - rings[slot * 4 + 2] > life) return slot; }
  return -1;
}
// Whether what moves in water is due its next ring (pure): a creature every third of a second, an animal less often, as there may be many.
export const wakeRingDue = (last, now, keep) => !(last >= 0) || now - last >= (keep ? 0.3 : 0.9);
// A tiling sheet of wave slopes, red and green, made here, not stored (pure).
export function waveSheet(size = 512) {
  const height = new Float32Array(size * size), wrap = (v, f) => ((v % f) + f) % f, spot = (x, y, f, seed) => { const v = Math.sin(wrap(x, f) * 127.1 + wrap(y, f) * 311.7 + seed * 74.7) * 43758.5453; return v - Math.floor(v); };
  const smooth = (u, v, f, seed) => { const x = u * f, y = v * f, xi = Math.floor(x), yi = Math.floor(y); let a = x - xi, b = y - yi; a = a * a * (3 - 2 * a); b = b * b * (3 - 2 * b); return (spot(xi, yi, f, seed) * (1 - a) + spot(xi + 1, yi, f, seed) * a) * (1 - b) + (spot(xi, yi + 1, f, seed) * (1 - a) + spot(xi + 1, yi + 1, f, seed) * a) * b; };
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) { let sum = 0, amp = 1, f = 6; for (let o = 0; o < 4; o++) { sum += smooth(i / size, j / size, f, o + 1) * amp; amp *= 0.5; f *= 2; } height[j * size + i] = sum / 2.1; }
  const out = new Uint8ClampedArray(size * size * 4), at = (i, j) => height[wrap(j, size) * size + wrap(i, size)];
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) { const k = (j * size + i) * 4; out[k] = 127.5 + (at(i + 1, j) - at(i - 1, j)) * 24 * 127.5; out[k + 1] = 127.5 + (at(i, j + 1) - at(i, j - 1)) * 24 * 127.5; out[k + 2] = 255; out[k + 3] = 255; }
  return out;
}

// How far a shape runs along a direction: where it starts and where it ends.
const runOf = (areas, angle) => { const cx = Math.cos(angle), cy = Math.sin(angle); let lo = Infinity, hi = -Infinity; for (const area of areas) for (let i = 0; i + 1 < area.length; i += 2) { const d = area[i] * cx + area[i + 1] * cy; lo = Math.min(lo, d); hi = Math.max(hi, d); } return [lo, hi]; };
const boxOf = (areas) => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const area of areas) for (let i = 0; i + 1 < area.length; i += 2) { x0 = Math.min(x0, area[i]); x1 = Math.max(x1, area[i]); y0 = Math.min(y0, area[i + 1]); y1 = Math.max(y1, area[i + 1]); } return Number.isFinite(x0) ? { x: x0, y: y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) } : null; };
// The region's shape on a small canvas, its holes left out, blurred by `blur` px; its coverage, one number a pixel.
const shapeOf = (areas, box, k, blur) => {
  const w = Math.max(2, Math.ceil(box.w * k)), h = Math.max(2, Math.ceil(box.h * k)), canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  const x = canvas.getContext('2d', { willReadFrequently: true }); x.filter = blur > 0 ? `blur(${blur}px)` : 'none'; x.fillStyle = '#fff'; x.beginPath();
  const trace = (points) => { x.moveTo((points[0] - box.x) * k, (points[1] - box.y) * k); for (let i = 2; i + 1 < points.length; i += 2) x.lineTo((points[i] - box.x) * k, (points[i + 1] - box.y) * k); x.closePath(); };
  for (const area of areas) { trace(area); for (const hole of area.holes ?? []) trace(hole); }
  x.fill('evenodd');
  const data = x.getImageData(0, 0, w, h).data, one = new Uint8Array(w * h);
  for (let i = 0; i < one.length; i++) one[i] = data[i * 4 + 3];
  return { w, h, data: one };
};
const textureOf = (PIXI, pixels, w, h, options = {}) => {
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  canvas.getContext('2d').putImageData(new ImageData(pixels, w, h), 0, 0);
  return new PIXI.Texture(new PIXI.BaseTexture(canvas, { scaleMode: PIXI.SCALE_MODES.LINEAR, wrapMode: PIXI.WRAP_MODES.CLAMP, ...options }));
};

/**
 * The layer. sync(list, { floor, quality }): `list` the water to move as [{ id, areas, kind, angle, current, roofed, keeps, bed: { texture, key, edge } }], `floor` the map's picture
 * { texture, rect }, `quality` 'full' or 'simple'. tick(seconds, { sky, view, lights, weather, flash, wind, angle, mostLights }) while `busy`.
 * addRing({ x, y, size }) for what steps in it; has(id); clear().
 */
export function createWaterEngine({ PIXI, root, grid = () => 100 }) {
  const known = new Map(), rings = new Float32Array(MOST_RINGS * 4).fill(-99), ringKeeps = new Array(MOST_RINGS).fill(false);
  let sheet = null, clock = 0, skyAt = 0, lightsAt = 0, nextRing = 0, flashing = false, lights = floorLights(), floorNow = null, qualityNow = 'full';
  const sheetOf = () => { if (!sheet || sheet.baseTexture?.destroyed) sheet = textureOf(PIXI, waveSheet(512), 512, 512, { wrapMode: PIXI.WRAP_MODES.REPEAT, mipmap: PIXI.MIPMAP_MODES.ON }); return sheet; };
  const drop = (entry) => { try { entry.mesh.parent?.removeChild(entry.mesh); entry.mesh.destroy(); entry.mask.destroy(true); entry.flow.destroy(true); } catch { /* gone with the canvas */ } };
  const make = (spec) => {
    const size = grid() || 100, box = boxOf(spec.areas), motion = WATER_MOTION[spec.kind] ?? WATER_MOTION.still;
    if (!box) return null;
    // Where it is (red) and how far in from its bank (green).
    const k = Math.min(0.25, 1024 / Math.max(box.w, box.h)), crisp = shapeOf(spec.areas, box, k, spec.bed ? Math.max(2, size * k * (spec.bed.edge ?? 1) * 0.35) : 2), wide = shapeOf(spec.areas, box, k, size * k * 0.36), pixels = new Uint8ClampedArray(crisp.w * crisp.h * 4);
    for (let i = 0; i < crisp.data.length; i++) { pixels[i * 4] = crisp.data[i]; pixels[i * 4 + 1] = (wide.data[i] - 128) * 2; pixels[i * 4 + 3] = 255; }
    const mask = textureOf(PIXI, pixels, crisp.w, crisp.h);
    const f = Math.min(0.05, 256 / Math.max(box.w, box.h)), soft = shapeOf(spec.areas, box, f, size * f * 0.9), flow = textureOf(PIXI, flowField(motion.streak ? soft.data.fill(255) : soft.data, soft.w, soft.h, spec.angle), soft.w, soft.h);
    const points = [box.x, box.y, box.x + box.w, box.y, box.x + box.w, box.y + box.h, box.x, box.y + box.h];
    const geometry = new PIXI.Geometry().addAttribute('aVertexPosition', new PIXI.Buffer(new Float32Array(points), true), 2).addIndex(new Uint16Array([0, 1, 2, 0, 2, 3]));
    const uniforms = { uMap: floorNow.texture, uMask: mask, uFlow: flow, uWaves: sheetOf(), uBed: spec.bed?.texture ?? PIXI.Texture.WHITE, uBedSize: spec.bed?.texture ? size * 4 : 0, uMapRect: [floorNow.rect.x, floorNow.rect.y, floorNow.rect.width, floorNow.rect.height], uBox: [box.x, box.y, box.w, box.h], uTime: clock, uWind: 0.2, uGrid: size, uCurrent: Number.isFinite(spec.angle) ? (spec.current ?? 0.4) * 1.4 * motion.pace : 0, uStill: motion.streak ? 0 : 1, uRough: motion.rough, uFoam: waterFoam(spec.kind, spec.current), uStrength: Math.min(1, Math.max(0, spec.current ?? 0.4)), uSwell: motion.swell, uStreak: motion.streak, uDown: [Math.cos(spec.angle ?? 0), Math.sin(spec.angle ?? 0)], uRun: runOf(spec.areas, spec.angle ?? 0), uSun: 0, uFrozen: 0, uLightCount: 0, uWindDir: [0.8, 0.6], uToSun: [1, 0], uGlare: [box.x, box.y], uSunColor: [1, 1, 1], uLights: lights.lights, uLightColors: lights.colors, uRings: rings };
    const mesh = new PIXI.Mesh(geometry, PIXI.Shader.from(VERT, fragOf(qualityNow === 'full'), uniforms));
    mesh.eventMode = 'none'; root().addChild(mesh);
    skyAt = 0;
    return { mesh, mask, flow, box, roofed: !!spec.roofed, keeps: !!spec.keeps };
  };
  return {
    sync(list = [], { floor = null, quality = 'full' } = {}) {
      const wanted = floor?.texture?.valid ? list : [], changedLook = quality !== qualityNow || floor?.texture !== floorNow?.texture;
      qualityNow = quality; floorNow = floor;
      const seen = new Set();
      for (const spec of wanted) {
        seen.add(spec.id);
        const key = JSON.stringify([spec.areas, spec.areas.map((a) => a.holes ?? null), spec.angle, spec.current, spec.kind, spec.bed?.key ?? null, spec.bed?.edge ?? null, !!spec.bed?.texture, quality]), had = known.get(spec.id);
        if (had && had.key === key && !changedLook) { had.roofed = !!spec.roofed; had.keeps = !!spec.keeps; continue; }
        if (had) { drop(had); known.delete(spec.id); }
        try { const entry = make(spec); if (entry) { entry.key = key; known.set(spec.id, entry); } } catch (error) { console.warn('Animater | moving water', error); }
      }
      for (const [id, entry] of known) if (!seen.has(id)) { drop(entry); known.delete(id); }
    },
    tick(seconds, { sky = () => null, view = () => null, lights: sources = () => [], weather = () => null, flash = () => null, wind = 0, angle = 0.6, mostLights = MOST_LIGHTS } = {}) {
      clock += seconds;
      const struck = flash(), lookUp = clock >= skyAt || !!struck || flashing; flashing = !!struck;
      if (lookUp) skyAt = clock + SKY_EVERY;
      const seen = view(), sky_ = lookUp ? (weather() ?? {}) : null, light = lookUp ? (struck ? { ...skyForFloors(struck), color: [0.85, 0.9, 1] } : skyForFloors(sky(), sky_.clouds)) : null;
      if (clock >= lightsAt) { lightsAt = clock + LIGHTS_EVERY; lights = floorLights(sources(), seen, mostLights); }
      const dir = [Math.cos(angle), Math.sin(angle)];
      for (const entry of known.values()) {
        const { box } = entry;
        // Off the view: not drawn at all.
        entry.mesh.visible = !seen || (box.x < seen.x + seen.w && box.x + box.w > seen.x && box.y < seen.y + seen.h && box.y + box.h > seen.y);
        const w = entry.mesh.shader.uniforms;
        if (light) { w.uSun = entry.roofed ? 0 : light.shine; w.uToSun = light.toSun; w.uSunColor = light.color; w.uGlare = glareAt(box, light); w.uFrozen = entry.keeps ? 0 : Math.min(1, Math.max(0, (Number(sky_.ice) || 0) * 2 - 0.2)); }
        if (!entry.mesh.visible) continue;
        w.uTime = clock; w.uWind = entry.roofed ? 0.02 : wind; w.uWindDir = dir; w.uLights = lights.lights; w.uLightColors = lights.colors; w.uLightCount = lights.count;
      }
    },
    addRing({ x, y, size = 0.7, keep = true } = {}) {
      if (!known.size) return;
      const slot = ringSlot(ringKeeps, rings, clock, nextRing, keep);
      if (slot < 0) return;
      rings.set([x, y, clock, size], slot * 4); ringKeeps[slot] = keep; nextRing = (slot + 1) % MOST_RINGS;
    },
    has: (id) => known.has(id),
    clear() { for (const entry of known.values()) drop(entry); known.clear(); floorNow = null; rings.fill(-99); },
    get busy() { return known.size > 0; },
    get count() { return known.size; },
  };
}
