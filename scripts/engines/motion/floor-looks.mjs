// What a region's floor shows (region-steps.mjs). Two layers, every screen drawing its own from the region's flags.
// Looks: blood, frost, runes and the rest laid over the floor, spreading from where the GM clicked or fading in. A look is drawn
// live only while it changes, then baked once into a plain image, so a finished one costs no more than a tile.
// Textures: a floor painted for a bare map. Each floor is one sharp tile, painted once with its own lighting and repeating
// without a seam, shared by every region with that floor; a region only samples it, so it stays sharp at any zoom.
// Both fade out at the region's edge along an uneven line, instead of ending on the region's straight sides.

import { STEP_LOOKS, spreadFrom } from './region-steps.mjs';
import { areaOf, insideAreas } from './floor-motion.mjs';

const VERT = `precision highp float;
attribute vec2 aVertexPosition;
uniform mat3 projectionMatrix, translationMatrix;
varying vec2 vWorld;
void main(){ vWorld = aVertexPosition; gl_Position = vec4((projectionMatrix * translationMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0); }`;

const NOISE = `float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
vec2 hash2(vec2 p){ return vec2(hash(p), hash(p + 19.7)); }
float noise(vec2 p){ vec2 i = floor(p), f = p - i; f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.03 + 17.0; a *= 0.5; } return v; }
// Noise as smooth through its cell walls as within them, for what a sharp shine reads: walls in plain noise show as thin straight lines.
float silk(vec2 p){ p = vec2(p.x * 0.8 - p.y * 0.6, p.x * 0.6 + p.y * 0.8); vec2 i = floor(p), f = p - i; f = f * f * f * (f * (f * 6.0 - 15.0) + 10.0); return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }`;

// Where the sun and moon really reach: not in a wall's shade (the wall shadows' sunlit floor), under a roof or under the trees. For every layer that answers them.
export const SUN_REACH = `uniform sampler2D uSunlit, uTreeShade;
uniform vec4 uSceneRect;
float sunReach(vec2 world){ vec2 at = (world - uSceneRect.xy) / max(uSceneRect.zw, vec2(1.0)); return texture2D(uSunlit, at).a * (1.0 - 0.9 * texture2D(uTreeShade, at).a); }`;
export const sunUniforms = (PIXI) => ({ uSunlit: PIXI.Texture.WHITE, uTreeShade: PIXI.Texture.EMPTY, uSceneRect: [0, 0, 1, 1] });
const shadeWith = (w, shade) => { if (shade) { w.uSunlit = shade.sunlit; w.uTreeShade = shade.trees; w.uSceneRect = shade.rect; } };

// A sea's waterline, the same for the water that draws it and for a look that must stop at it: how far from the shore, along a line that wanders in long smooth curves, off the grid, so it neither follows the region's edge nor steps.
export const SHORE_LINE = `float shoreNoise(vec2 p){ vec2 i = floor(p), f = p - i; f = f * f * (3.0 - 2.0 * f); float a = fract(sin(dot(i, vec2(127.1, 311.7))) * 43758.5), b = fract(sin(dot(i + vec2(1.0, 0.0), vec2(127.1, 311.7))) * 43758.5), c = fract(sin(dot(i + vec2(0.0, 1.0), vec2(127.1, 311.7))) * 43758.5), d = fract(sin(dot(i + vec2(1.0, 1.0), vec2(127.1, 311.7))) * 43758.5); return mix(mix(a, b, f.x), mix(c, d, f.x), f.y); }
float shoreLine(vec2 w, float away){ vec2 t = vec2(w.x * 0.8 - w.y * 0.6, w.x * 0.6 + w.y * 0.8); return away + (shoreNoise(t * 0.55) - 0.5) * 0.3 + (shoreNoise(t * 1.7 + 5.0) - 0.5) * 0.1; }`;

// The region's shape, blurred, as a small image: half at its edge, full well inside. So a point shows nothing at the edge and all
// of itself about a square in, fading between along an uneven line, and nothing spills out of the region.
const EDGE = `uniform sampler2D uMask;
uniform vec4 uBox;
uniform float uPeak;
uniform float uTight; // 2: a hard edge, on the region's line; 1: full close to the edge, for what should meet it (water); 0, unset: well in
float inside(vec2 world, float grid){
  if (uTight > 1.5) return smoothstep(uPeak * 0.25, uPeak * 0.5, texture2D(uMask, (world - uBox.xy) / uBox.zw).a);
  float wobble = fbm(world / (grid * 0.7)) - 0.5 + (noise(world / (grid * 0.09)) - 0.5) * 0.35;
  // A shape narrower than its blur never reaches full: uPeak is as far as it gets, so it still fades to all of itself.
  return smoothstep(min(0.5, uPeak * 0.5), uPeak * (0.97 - 0.27 * uTight), texture2D(uMask, (world - uBox.xy) / uBox.zw).a + wobble * 0.14 * uPeak);
}`;

// Each look's painter, by its number in region-steps.mjs. Each compiles into a small shader of its own the first time it is used.
const LOOK_HELPERS = `precision highp float;
varying vec2 vWorld;
uniform float uGrid, uSeed, uTime, uCover, uBias, uScale; // uScale: how big its pattern is, 1 as painted
${NOISE.replace('float fbm(', 'float plainFbm(')}
// A look's patches are where its noise passes a line, so raising the noise spreads them, each by its own shape, and lowering it draws them in.
float fbm(vec2 p){ return plainFbm(p) + uBias; }
vec3 vor(vec2 p){ vec2 n = floor(p), f = fract(p); float a = 8.0, b = 8.0, c = 0.0;
  for (float j = -1.0; j <= 1.0; j += 1.0) for (float i = -1.0; i <= 1.0; i += 1.0) { vec2 g = vec2(i, j), r = g + hash2(n + g) - f; float d = dot(r, r); if (d < a) { b = a; a = d; c = hash(n + g + 3.3); } else if (d < b) b = d; }
  return vec3(sqrt(a), sqrt(b) - sqrt(a), c); }
// A patch's edge, torn rather than blurred.
float torn(vec2 p, float v, float at, float soft){ return smoothstep(at - soft, at + soft, v + (plainFbm(p * 17.0 + 2.0) - 0.5) * 0.2 + (noise(p * 90.0) - 0.5) * 0.06); }
// How far to bend a pattern here, so nothing in it runs straight.
vec2 sway(vec2 p, float by){ return (vec2(plainFbm(p), plainFbm(p + 5.3)) - 0.5) * by; }
vec4 over(vec3 c, float a){ return vec4(c * a, a); }
vec4 on(vec4 low, vec4 high){ return high + low * (1.0 - high.a); }
float segment(vec2 p, vec2 a, vec2 b){ vec2 pa = p - a, ba = b - a; return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0)); }
// What is left of the dead, seen from above: long bones (some snapped), sets of ribs, chips, now and then a skull. Drawn as a surface in light, not a shape with an edge:
// each part rounded toward the light, with a shadow it casts, grain along its length, porous ends, weathered and dirty, part sunk in the soil.
float bsmin(float a, float b, float k){ float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0); return mix(b, a, h) - k * h * (1.0 - h); }
float boneAt(vec2 p, out float pale, out vec2 grainAt, out float lit, out float porous){
  vec2 n = floor(p); float best = 9.0; pale = 0.5; grainAt = vec2(0.0); lit = 0.0; porous = 0.0;
  for (float j = -1.0; j <= 1.0; j += 1.0) for (float i = -1.0; i <= 1.0; i += 1.0) {
    vec2 g = n + vec2(i, j); if (hash(g + 11.0) > 0.6 + uBias * 2.0) continue;
    float kind = hash(g + 21.0), a = hash(g + 7.0) * 6.283, size = 0.75 + 0.5 * hash(g + 5.0), d = 9.0, end_ = 0.0;
    vec2 at = p - (g + 0.5 + (hash2(g) - 0.5) * 0.6), way = vec2(cos(a), sin(a)), side = vec2(-way.y, way.x);
    vec2 q = vec2(dot(at, way), dot(at, side)) / size, facing = vec2(0.0);
    float rough = (noise(q * 9.0 + g) - 0.5) * 0.02 + (noise(q * 31.0 + g) - 0.5) * 0.007;
    if (kind < 0.42) {
      // A long bone: bowed, narrow along its shaft, flaring into its ends; the knuckles run into it; a third snapped off short and jagged.
      float len = 0.3 + 0.3 * hash(g + 3.0); q.y -= (hash(g + 9.0) - 0.5) * 0.35 * q.x * q.x;
      if (hash(g + 31.0) < 0.5) q.x = -q.x;
      float broad = 0.027 + 0.026 * pow(smoothstep(0.35, 1.0, abs(q.x) / len), 2.0);
      d = length(vec2(max(abs(q.x) - len, 0.0), q.y)) - broad;
      d = bsmin(d, bsmin(length(q - vec2(len, 0.03)) - 0.044, length(q - vec2(len + 0.012, -0.028)) - 0.036, 0.02), 0.035);
      end_ = smoothstep(0.62, 1.0, abs(q.x) / len);
      if (hash(g + 15.0) < 0.35) d = max(d, -len * 0.35 + (noise(q * vec2(14.0, 40.0) + g) - 0.5) * 0.16 - q.x);
      else d = bsmin(d, length(q + vec2(len, 0.0)) - 0.05, 0.035);
      facing = vec2(smoothstep(0.7, 1.05, abs(q.x) / len) * sign(q.x) * 0.7, clamp(q.y / max(broad, 0.01), -1.0, 1.0));
    } else if (kind < 0.72) {
      // Ribs: curved together, thinning toward their tips.
      for (float r = 0.0; r < 2.5; r += 1.0) {
        vec2 t = q + vec2(0.05 * (r - 1.0), 0.34 + r * 0.07);
        float bow = length(t), turn = abs(atan(t.x, t.y)), reach = 0.72 + 0.22 * hash(g + r + 40.0), wide = 0.017 * (1.0 - 0.55 * turn / reach), one = max(abs(bow - (0.3 + r * 0.075)) - wide, turn - reach);
        if (one < d) { d = one; facing = t / max(bow, 0.01) * clamp((bow - (0.3 + r * 0.075)) / wide, -1.0, 1.0); }
      }
    } else if (kind < 0.94) {
      // Chips and small bones.
      for (float r = 0.0; r < 2.5; r += 1.0) { vec2 o = q - (hash2(g + r * 3.7) - 0.5) * 0.42; float wide = 0.022 + 0.034 * hash(g + r + 50.0), one = length(o * vec2(1.0, 1.7)) - wide; if (one < d) { d = one; facing = clamp(o / wide, -1.0, 1.0); } }
      end_ = 0.6;
    } else {
      // A skull from above: its rounded cranium, the bones of its face, the sockets dark.
      d = bsmin(length(q * vec2(1.0, 1.24)) - 0.135, length((q - vec2(0.0, 0.135)) * vec2(1.25, 1.0)) - 0.072, 0.03);
      d = max(d, 0.03 - length(vec2(abs(q.x) - 0.048, q.y - 0.125)));
      facing = clamp(q / 0.15, -1.0, 1.0);
    }
    d += rough;
    if (d < best) { best = d; pale = hash(g + 13.0); grainAt = q + g * 3.1; lit = dot(way * facing.x + side * facing.y, vec2(-0.6, -0.8)); porous = end_; }
  }
  return best;
}
vec4 bones(vec2 p){
  float pale, lit, porous, unused, unusedB; vec2 grainAt, unusedC;
  float best = boneAt(p, pale, grainAt, lit, porous), thrown = boneAt(p - vec2(0.03, 0.04), unused, unusedC, unusedB, unused);
  // Sunk where the ground has come up over it, with soil caked on what is left showing.
  float soil = fbm(p * 3.0 + 7.0), shown = smoothstep(0.24, 0.36, soil), caked = 1.0 - smoothstep(0.26, 0.36, soil + (fbm(p * 22.0) - 0.5) * 0.14);
  float along = noise(vec2(grainAt.x * 5.0, grainAt.y * 60.0)), mottled = fbm(p * 20.0), stain = smoothstep(0.4, 0.66, fbm(p * 8.0 + 3.0)), pits = smoothstep(0.62, 0.8, noise(p * 150.0)) * (0.25 + 0.75 * porous), inner = clamp(-best / 0.03, 0.0, 1.0);
  vec3 bone = mix(vec3(0.44, 0.4, 0.31), vec3(0.72, 0.66, 0.53), pale) * (0.8 + 0.28 * along) * (0.72 + 0.5 * mottled);
  bone *= mix(vec3(1.0), vec3(0.68, 0.55, 0.38), stain * 0.65) * (1.0 - 0.5 * pits);
  bone = mix(bone, vec3(0.16, 0.125, 0.085) * (0.8 + 0.5 * mottled), caked * 0.7);
  // The light on it: bright on the side toward it, falling away on the other, as round things do.
  bone *= (0.82 + 0.42 * clamp(lit, -1.0, 1.0)) * (0.76 + 0.24 * inner);
  float shadow = 0.5 * smoothstep(0.035, -0.015, thrown) * shown;
  return on(over(vec3(0.012, 0.01, 0.008), shadow), over(bone, smoothstep(0.008, -0.01, best) * shown));
}
`;
// Where blood has fallen, wet or dried: mostly specks, some streaks thrown two ways, a rare big splash with a torn edge, soaked ground under the worst of it, and bare ground between the clusters.
const BLOOD_MARKS = `vec2 bent = (vec2(fbm(p * 9.0 + uSeed), fbm(p * 9.0 + uSeed + 5.0)) - 0.5) * 0.09; float cluster = fbm(p * 2.6 + uSeed + 11.0), dense = smoothstep(0.36, 0.5, cluster), some = smoothstep(0.26, 0.42, cluster), rough = (fbm(p * 14.0 + uSeed + 3.0) - 0.5) * 0.38 + (fine - 0.5) * 0.12; vec3 big = vor((p + bent * 0.6) * 4.5 + uSeed); float bigR = 0.1 + 0.62 * pow(fract(big.z * 7.3), 3.0), splat = (1.0 - smoothstep(bigR - 0.05, bigR + 0.03, big.x + rough)) * step(0.5, big.z) * dense; vec2 way = vec2(cos(uSeed * 3.0), sin(uSeed * 3.0)), way2 = vec2(way.x * 0.6 - way.y * 0.8, way.x * 0.8 + way.y * 0.6); vec3 mid = vor((p - way * dot(p, way) * 0.6) * 15.0 + uSeed + 4.0), fleck = vor((p - way2 * dot(p, way2) * 0.7) * 30.0 + uSeed + 9.0); float midR = 0.06 + 0.3 * pow(fract(mid.z * 5.1), 2.0), fleckR = 0.05 + 0.26 * pow(fract(fleck.z * 3.7), 2.0), streak = (1.0 - smoothstep(midR - 0.04, midR + 0.03, mid.x + rough * 0.5)) * step(0.5, mid.z) * some, speck = (1.0 - smoothstep(fleckR - 0.04, fleckR + 0.03, fleck.x + rough * 0.3)) * step(0.5, fleck.z) * some, soak = smoothstep(0.5, 0.72, fbm(p * 6.0 + uSeed + 21.0) + (cluster - 0.5) * 0.6) * 0.24, pool = max(splat * (0.72 + 0.2 * smoothstep(0.0, 0.2, bigR - big.x - rough)), max(streak * (0.5 + 0.4 * fract(mid.z * 3.1)), speck * (0.45 + 0.45 * fract(fleck.z * 2.3)))); vec2 q = p * 46.0 + uSeed; vec3 d1 = vor(q), d2 = vor(q * 2.6 + 3.0); float drops = max(smoothstep(0.2, 0.12, d1.x) * step(0.72, d1.z), smoothstep(0.24, 0.15, d2.x) * step(0.62, d2.z)) * some * (1.0 - uCover);`;
const PAINTERS = Object.freeze({
  48: `{ vec2 w = p + (vec2(fbm(p * 7.0), fbm(p * 7.0 + 5.0)) - 0.5) * 0.09; vec3 v = vor(w * 5.0 + uSeed), small = vor(w * 19.0 + uSeed); float split = smoothstep(0.012, 0.0, v.y) * smoothstep(0.26, 0.5, fbm(p * 6.0 + uSeed + 2.0)), hair = smoothstep(0.009, 0.0, small.y) * smoothstep(0.55, 0.75, fbm(p * 5.0 + uSeed)), cloud = fbm(p * 4.0 + uSeed), milk = smoothstep(0.5, 0.74, fbm(p * 9.0 + uSeed + 6.0)), bubbles = smoothstep(0.9, 0.94, noise(p * 130.0 + uSeed)) * smoothstep(0.45, 0.7, cloud), sheen = smoothstep(0.58, 0.8, fbm(p * 2.2 + uSeed)); vec3 c = mix(vec3(0.17, 0.27, 0.34), vec3(0.42, 0.55, 0.61), cloud * 0.85 + v.z * 0.15); c = mix(c, vec3(0.66, 0.74, 0.78), milk * 0.42); c += vec3(0.26, 0.28, 0.3) * split + vec3(0.1) * hair + vec3(0.2) * bubbles + vec3(0.07, 0.09, 0.1) * sheen; return over(c, 0.76 + 0.12 * cloud); }`,
  49: `{ float damp = smoothstep(0.3, 0.6, wide); vec4 low = vec4(vec3(0.012, 0.016, 0.02) * damp * 0.22, damp * 0.22); vec2 bend = sway(p * 3.0 + uSeed, 0.8); float curl = fbm(p * 4.0 + uSeed + bend), wisp = fbm(p * 13.0 + uSeed + bend * 2.0), puff = smoothstep(0.44, 0.8, curl) * smoothstep(0.3, 0.6, fbm(p * 2.2 + uSeed + 3.0)) * (0.65 + 0.7 * wisp); return on(low, over(mix(vec3(0.66, 0.69, 0.7), vec3(0.88, 0.9, 0.9), curl), min(1.0, puff) * 0.6)); }`,
  50: `{ float big = fbm(p * 3.0 + uSeed), mid = fbm(p * 9.0 + uSeed), low = fbm(p * 30.0 + uSeed), shape = torn(p, big + 0.05, 0.33, 0.012), deep = smoothstep(0.34, 0.5, big + 0.05), hollow = smoothstep(0.62, 0.36, big * 0.55 + mid * 0.45); vec3 c = mix(vec3(0.86, 0.885, 0.91), vec3(0.67, 0.73, 0.8), hollow * 0.6) * (0.95 + 0.08 * low); c -= 0.03 * smoothstep(0.55, 0.8, noise(p * 300.0)); return over(c, shape * (0.62 + 0.36 * deep)); }`,
  51: `{ float bank = smoothstep(0.34, 0.74, fbm(p * vec2(2.2, 4.4) + uSeed)), fine_ = fbm(p * 9.0 + uSeed); return over(mix(vec3(0.58, 0.63, 0.66), vec3(0.76, 0.79, 0.8), fine_), bank * (0.42 + 0.26 * fine_)); }`,
  1: `{ ${BLOOD_MARKS} float cloud = smoothstep(0.34, 0.68, fbm((p + bent * 3.0) * 5.0 + uSeed)); vec3 c = mix(mix(vec3(0.24, 0.022, 0.03), vec3(0.13, 0.01, 0.018), splat * smoothstep(0.0, 0.25, bigR - big.x - rough)), mix(vec3(0.17, 0.018, 0.026), vec3(0.27, 0.03, 0.036), cloud), uCover) * (0.82 + 0.4 * fine); return over(c, max(mix(max(pool, soak), 0.3 + 0.42 * cloud, uCover), drops * 0.8)); }`,
  2: `{ float damp = max(uCover, torn(p, wide, 0.42, 0.04)), pooled = torn(p, fbm(p * 3.0 + uSeed + 9.0), 0.6, 0.015) * damp, a = 0.17 * damp + 0.25 * pooled; return vec4(vec3(0.012, 0.02, 0.03) * a + vec3(0.5, 0.58, 0.68) * 0.04 * pooled, a); }`,
  3: `{ vec3 v = vor(p * 16.0 + uSeed + sway(p * 9.0, 0.2)); float e = wide + 0.12, char_ = torn(p, e, 0.42, 0.012), scorch = torn(p, e, 0.33, 0.03), seam = smoothstep(0.05, 0.0, v.y), ashy = smoothstep(0.6, 0.76, fbm(p * 70.0 + uSeed)) * smoothstep(0.42, 0.6, fbm(p * 8.0 + uSeed + 3.0)), grain = noise(p * 220.0); vec3 black = mix(vec3(0.024, 0.021, 0.018), vec3(0.085, 0.078, 0.072), fine * 0.6 + v.z * 0.4) * (1.0 - 0.65 * seam) * (0.86 + 0.26 * grain) + vec3(0.24, 0.235, 0.225) * ashy * (1.0 - seam) * 0.75; black += vec3(0.3, 0.075, 0.01) * seam * smoothstep(0.72, 0.86, fbm(p * 5.0 + uSeed)) * (0.55 + 0.45 * sin(fine * 30.0)); vec3 brown = vec3(0.15, 0.095, 0.05) * (0.7 + 0.6 * fine); return over(mix(brown, black, char_), mix(scorch * 0.55, 0.95, char_)); }`,
  4: `{ float lie = fbm(p * 4.0 + uSeed), shape = torn(p, lie + (fine - 0.5) * 0.14, 0.38, 0.05), deep = smoothstep(0.38, 0.62, lie), grain = noise(p * 240.0); vec3 v = vor(p * 46.0 + uSeed + 3.0); float size = 0.02 + 0.2 * pow(fract(v.z * 7.7), 4.0), bit = smoothstep(size, size * 0.55, v.x + (fine - 0.5) * 0.08) * step(0.8, v.z) * smoothstep(0.42, 0.56, fbm(p * 7.0 + uSeed + 2.0)); vec3 c = mix(vec3(0.3, 0.295, 0.285), vec3(0.54, 0.53, 0.51), fine * 0.55 + grain * 0.45); c = mix(c, vec3(0.08, 0.075, 0.07), bit * 0.75); return over(c, shape * (0.42 + 0.46 * deep + 0.1 * bit)); }`,
  5: `{ vec2 w = p * 20.0 + uSeed + (vec2(fbm(p * 7.0), fbm(p * 7.0 + 7.0)) - 0.5) * 1.1; float feather = smoothstep(0.012, 0.0, abs(fbm(w) - 0.5)) * 0.3 + smoothstep(0.006, 0.0, abs(fbm(w * 2.7) - 0.5)) * 0.22, reach = smoothstep(0.3, 0.62, wide + (fine - 0.5) * 0.3); return over(mix(vec3(0.6, 0.68, 0.74), vec3(0.8, 0.86, 0.9), fine), min(1.0, reach * 0.4 + feather * reach) + 0.08 * smoothstep(0.88, 0.96, noise(p * 220.0)) * reach); }`,
  6: `{ vec2 w = p * 4.5 + uSeed + (vec2(fbm(p * 8.0), fbm(p * 8.0 + 3.0)) - 0.5) * 1.5 + (vec2(fbm(p * 30.0), fbm(p * 30.0 + 3.0)) - 0.5) * 0.25; vec3 v = vor(w), small = vor(w * 3.1 + 8.0); float broad = 0.008 + 0.022 * smoothstep(0.3, 0.7, fbm(p * 5.0 + uSeed)), crack = smoothstep(broad, broad * 0.4, v.y) * smoothstep(0.26, 0.42, fbm(p * 6.0 + uSeed + 2.0)), hair = smoothstep(0.012, 0.0, small.y) * smoothstep(0.08, 0.0, v.y), lip = smoothstep(broad * 2.4, broad, v.y) * (1.0 - crack); return vec4(vec3(0.32, 0.3, 0.26) * lip * 0.07, max(0.92 * crack, max(0.5 * hair, lip * 0.07))); }`,
  7: `{ vec3 v = vor(p * 90.0 + uSeed), big = vor(p * 30.0 + uSeed + 3.0); float clump = (1.0 - smoothstep(0.0, 0.66, v.x)) * 0.55 + (1.0 - smoothstep(0.0, 0.7, big.x)) * 0.45, reach = max(uCover, smoothstep(0.36, 0.52, wide + (clump - 0.5) * 0.2 + (fine - 0.5) * 0.18)); vec3 c = mix(vec3(0.045, 0.075, 0.025), vec3(0.17, 0.24, 0.07), clump) * (0.78 + 0.45 * v.z); if (big.z > 0.8) c = mix(c, vec3(0.25, 0.23, 0.07), 0.4); return over(c, reach * 0.94); }`,
  8: `{ float streak = fbm(vec2(p.x * 26.0, p.y * 5.0) + uSeed), tone = fbm(p * 13.0 + uSeed) * 0.55 + fbm(p * 62.0 + uSeed) * 0.45, flake = smoothstep(0.022, 0.005, vor(p * 70.0 + uSeed).y) * smoothstep(0.5, 0.64, tone), pits = smoothstep(0.76, 0.87, noise(p * 150.0 + uSeed)) * smoothstep(0.42, 0.62, fbm(p * 9.0 + uSeed + 2.0)), reach = max(uCover, torn(p, wide + (streak - 0.5) * 0.14, 0.42, 0.025)); vec3 c = mix(vec3(0.21, 0.1, 0.05), vec3(0.4, 0.2, 0.085), smoothstep(0.34, 0.58, tone)); c = mix(c, vec3(0.5, 0.29, 0.115), smoothstep(0.56, 0.7, tone) * 0.6); c *= (0.88 + 0.24 * streak) * (1.0 - 0.5 * pits) * (1.0 - 0.3 * flake); return over(c, reach * 0.88); }`,
  9: `{ vec2 way = vec2(cos(uSeed), sin(uSeed)); vec3 v = vor(p * 34.0 + uSeed + sway(p * 8.0, 0.8)), w = vor(p * 21.0 + uSeed + 6.0); float a = atan(way.y, way.x) + (v.z - 0.5) * 1.1, co = cos(a), si = sin(a), b = atan(way.y, way.x) + (w.z - 0.5) * 1.1, cb = cos(b), sb = sin(b); float blade = noise(vec2(co * p.x + si * p.y, si * p.x - co * p.y) * vec2(30.0, 260.0) + v.z * 50.0), under_ = noise(vec2(cb * p.x + sb * p.y, sb * p.x - cb * p.y) * vec2(22.0, 190.0) + w.z * 30.0), bare = torn(p, fbm(p * 5.0 + uSeed + 4.0), 0.62, 0.03), tone = fbm(p * 7.0 + uSeed + 2.0); vec3 c = mix(vec3(0.3, 0.235, 0.11), vec3(0.54, 0.44, 0.22), blade * 0.65 + tone * 0.35) * (0.84 + 0.3 * fine); vec4 low = over(mix(vec3(0.17, 0.13, 0.065), vec3(0.3, 0.24, 0.12), under_) * (0.8 + 0.4 * fine), 0.5 + 0.2 * (1.0 - bare)); return on(low, over(c, smoothstep(0.3, 0.56, blade) * (1.0 - 0.85 * bare) * 0.82)); }`,
  10: `{ float wetness = smoothstep(0.44, 0.7, fbm(p * 6.0 + uSeed)), grain = fbm(p * 60.0 + uSeed), chunks = smoothstep(0.56, 0.72, fbm(p * 26.0 + uSeed)), reach = smoothstep(0.28, 0.44, wide + (fine - 0.5) * 0.3); return over(mix(vec3(0.5, 0.51, 0.51), vec3(0.3, 0.29, 0.27), wetness) * (0.74 + 0.5 * grain) + vec3(0.2) * chunks * (1.0 - wetness * 0.6), reach * 0.78); }`,
  11: `{ float silt = fbm(p * 5.0 + uSeed + sway(p * 3.0 + uSeed, 1.2)), scum = torn(p, fbm(p * 8.0 + uSeed + 3.0), 0.66, 0.015); vec3 c = mix(vec3(0.055, 0.055, 0.024), vec3(0.17, 0.145, 0.066), silt); c = mix(c, vec3(0.2, 0.2, 0.09) * (0.75 + 0.5 * fine), scum * 0.75); return over(c, 0.8 + 0.1 * scum); }`,
  12: `return over(vec3(0.66, 0.7, 0.72), 0.14 + 0.42 * smoothstep(0.3, 0.72, fbm(p * 3.0 + uSeed)));`,
  13: `{ vec3 v = vor((p + sway(p * 7.0, 0.07)) * 12.0 + uSeed); float heat = smoothstep(0.36, 0.68, fbm(p * 3.0 + uSeed)), split = smoothstep(0.03, 0.007, v.y) * smoothstep(0.3, 0.5, fbm(p * 6.0 + uSeed + 2.0)), halo = smoothstep(0.13, 0.0, v.y); vec4 baked = over(vec3(0.14, 0.075, 0.04) * (0.7 + 0.55 * fine + 0.2 * v.z), 0.2 + 0.36 * heat); return on(baked, vec4(vec3(0.46, 0.1, 0.012) * split * (0.25 + 0.75 * heat) + vec3(0.13, 0.024, 0.003) * halo * halo * heat, split * 0.8)); }`,
  14: `{ float reach = smoothstep(0.34, 0.5, wide); vec2 w = p * 4.0 + uSeed + sway(p * 6.0, 1.3); vec3 v = vor(w), s = vor(w * 2.3 + 4.0); float stem = smoothstep(0.024, 0.008, v.y), fork = smoothstep(0.016, 0.005, s.y) * smoothstep(0.16, 0.0, v.y); vec4 out_ = over(vec3(0.115, 0.105, 0.05) * (0.7 + 0.6 * fine), max(stem, fork * 0.85) * reach * 0.95); vec2 q = p * 46.0 + uSeed, n = floor(q); for (float j = -1.0; j <= 1.0; j += 1.0) for (float i = -1.0; i <= 1.0; i += 1.0) { vec2 g = n + vec2(i, j), c = g + 0.5 + (hash2(g) - 0.5) * 0.8, home = (c - uSeed) / 46.0; if (hash(g + 4.0) > 0.86) continue; vec2 hw = home * 4.0 + uSeed + sway(home * 6.0, 1.3); if (vor(hw).y > 0.13 || smoothstep(0.34, 0.5, fbm(home * 5.0 + uSeed)) < 0.5) continue; vec2 d = q - c; float a = hash(g + 9.0) * 6.283, co = cos(a), si = sin(a); d = vec2(co * d.x - si * d.y, si * d.x + co * d.y); float h = hash(g + 2.0), len = 0.26 + 0.56 * h * h, along = clamp(d.x / len * 0.5 + 0.5, 0.0, 1.0), wide_ = len * 0.46 * sqrt(max(0.0, 1.0 - pow(abs(d.x / len), 1.6))), leaf = smoothstep(wide_, wide_ * 0.7, abs(d.y)) * step(abs(d.x), len); if (leaf > 0.0) { vec3 tone = mix(vec3(0.09, 0.155, 0.045), vec3(0.23, 0.32, 0.085), hash(g + 6.0)) * (0.72 + 0.5 * along) * (1.0 - 0.3 * smoothstep(0.03, 0.0, abs(d.y))); out_ = on(out_, over(tone, leaf * reach)); } } return out_; }`,
  15: `{ vec4 out_ = over(vec3(0.08, 0.13, 0.05) * (0.55 + fine), 0.22 * smoothstep(0.3, 0.55, wide)); for (float l = 0.0; l < 1.5; l += 1.0) { float per = l < 0.5 ? 74.0 : 30.0; vec2 q = p * per + uSeed + l * 3.1, n = floor(q); for (float j = -1.0; j <= 1.0; j += 1.0) for (float i = -1.0; i <= 1.0; i += 1.0) { vec2 g = n + vec2(i, j), home = (g - uSeed - l * 3.1) / per; float clump = fbm(home * 3.0 + uSeed); if (hash(g + 1.0 + l) > smoothstep(0.42, 0.62, clump) * (l < 0.5 ? 0.8 : 0.42)) continue; vec2 c = g + 0.5 + (hash2(g + l) - 0.5) * 0.75, d = q - c; float r = length(d), kind = fract(fbm(home * 2.2 + uSeed + 9.0) * 3.3 + hash(g + 3.0) * 0.16), h = hash(g + 5.0 + l), size = 0.12 + 0.3 * h * h, turn = hash(g + 8.0) * 6.283, count = hash(g + 12.0) < 0.5 ? 5.0 : 6.0, petal = 0.62 + 0.38 * abs(cos((atan(d.y, d.x) + turn) * count * 0.5)), body = smoothstep(size * petal, size * petal * 0.8, r), heart = smoothstep(size * 0.3, size * 0.2, r); if (body <= 0.0) continue; vec3 tone = kind < 0.3 ? vec3(0.62, 0.61, 0.52) : kind < 0.58 ? vec3(0.6, 0.47, 0.13) : kind < 0.8 ? vec3(0.34, 0.23, 0.46) : vec3(0.52, 0.26, 0.33); tone *= 0.62 + 0.5 * smoothstep(0.0, size, r) * (0.75 + 0.25 * fine); tone = mix(tone, vec3(0.56, 0.42, 0.1), heart); out_ = on(out_, over(tone, body * 0.94)); } } return out_; }`,
  16: `{ vec2 w = p + sway(p * 7.0, 0.09); float lump = fbm(w * 34.0 + uSeed), crumb = fbm(w * 95.0 + uSeed + 3.0), hard = smoothstep(0.34, 0.62, lump), rut = smoothstep(0.07, 0.0, abs(fbm(p * 2.6 + uSeed + 8.0) - 0.5)), rut2 = smoothstep(0.05, 0.0, abs(fbm(p * 3.7 + uSeed + 15.0) - 0.5)), wet_ = smoothstep(0.5, 0.68, fbm(p * 6.0 + uSeed + 2.0)), turned = max(torn(p, wide, 0.36, 0.025), max(rut, rut2) * torn(p, wide, 0.28, 0.03)); vec3 c = mix(vec3(0.065, 0.045, 0.028), vec3(0.235, 0.165, 0.1), hard * 0.7 + crumb * 0.3) * (1.0 - 0.4 * wet_) * (1.0 - 0.6 * max(rut, rut2 * 0.8)); return over(c, turned * 0.93); }`,
  17: `{ vec2 w = p + sway(p * 5.0 + uSeed, 0.14); vec3 v = vor(w * 7.0 + uSeed), s = vor(w * 19.0 + uSeed + 4.0); float rot = torn(p, wide, 0.42, 0.03), vein = smoothstep(0.024, 0.005, v.y) * smoothstep(0.34, 0.5, fbm(p * 6.0 + uSeed + 9.0)), small = smoothstep(0.016, 0.003, s.y) * smoothstep(0.1, 0.0, v.y), mould = torn(p, fbm(p * 12.0 + uSeed + 5.0), 0.64, 0.02), spot = smoothstep(0.5, 0.72, fbm(p * 9.0 + uSeed + 2.0)); vec3 c = mix(vec3(0.12, 0.105, 0.078), vec3(0.27, 0.24, 0.18), fine) * (1.0 - 0.45 * spot); c = mix(c, vec3(0.42, 0.44, 0.36) * (0.8 + 0.4 * fine), mould * 0.7); return on(over(c, rot * 0.78), over(vec3(0.03, 0.018, 0.035), min(1.0, vein + small * 0.7) * 0.9 * rot)); }`,
  18: `return bones(p * 9.0 + uSeed);`,
  19: `{ vec3 v = vor(p * 150.0 + uSeed); float crust = smoothstep(0.38, 0.66, fbm(p * 6.0 + uSeed) + (fine - 0.5) * 0.35); return over(mix(vec3(0.55, 0.54, 0.5), vec3(0.8, 0.79, 0.75), v.z) * (0.85 + 0.2 * smoothstep(0.0, 0.1, v.y)), crust * 0.72); }`,
  20: `{ vec2 bend = sway(p * 3.0 + uSeed, 1.1); float lobes = fbm(p * 3.5 + uSeed) + (plainFbm(p * 11.0 + uSeed) - 0.5) * 0.1, pool = max(uCover * 0.8, smoothstep(0.415, 0.43, lobes)), lip = smoothstep(0.415, 0.47, lobes); vec3 d = vor(p * 26.0 + uSeed + 5.0); float size = 0.05 + 0.2 * d.z * d.z, drop = smoothstep(size, size * 0.8, d.x) * step(0.88, d.z) * smoothstep(0.34, 0.41, lobes), film = fbm(p * 5.0 + uSeed + bend), sheen = smoothstep(0.5, 0.64, film) * smoothstep(0.82, 0.68, film) * lip; vec3 hue = 0.5 + 0.5 * cos(film * 16.0 + vec3(0.0, 2.1, 4.2)), rainbow = mix(vec3(dot(hue, vec3(0.33))), hue, 0.55) * 0.085 * sheen, c = mix(vec3(0.05, 0.036, 0.024), vec3(0.012, 0.011, 0.013), lip) + rainbow; float a = max(pool * (0.72 + 0.22 * lip), drop * 0.86); return vec4(c * a, a); }`,
  21: `{ float hot = smoothstep(0.3, 0.62, fbm(p * 3.0 + uSeed)), churn = fbm(p * 11.0 + uSeed + sway(p * 5.0 + uSeed, 1.4)); vec4 out_ = over(mix(vec3(0.14, 0.19, 0.18), vec3(0.47, 0.52, 0.5), smoothstep(0.34, 0.72, churn)), 0.3 + 0.28 * hot); for (float l = 0.0; l < 1.5; l += 1.0) { float per = l < 0.5 ? 24.0 : 64.0; vec2 q = p * per + uSeed + l * 5.3, n = floor(q); for (float j = -1.0; j <= 1.0; j += 1.0) for (float i = -1.0; i <= 1.0; i += 1.0) { vec2 g = n + vec2(i, j); float gather = smoothstep(0.46, 0.68, fbm((g - uSeed) / per * 4.0 + uSeed + 2.0)); if (hash(g + 1.0 + l) > gather * (l < 0.5 ? 0.42 : 0.78)) continue; vec2 d = q - (g + 0.5 + (hash2(g + l) - 0.5) * 0.7); float h = hash(g + 3.0 + l), r = 0.1 + 0.34 * h * h, u = length(d) / r; if (u >= 1.0) continue; float rim = smoothstep(0.74, 0.94, u) * smoothstep(1.0, 0.94, u), shine = smoothstep(0.26, 0.08, length(d / r - vec2(-0.34, -0.38))), shade = smoothstep(0.2, 0.9, dot(d / r, vec2(0.62, 0.7))); vec3 skin = mix(vec3(0.3, 0.36, 0.35), vec3(0.08, 0.11, 0.11), shade * 0.8); out_ = on(out_, vec4(skin * 0.22 + vec3(0.72, 0.76, 0.74) * rim * 0.5 + vec3(0.92) * shine * 0.5, max(0.22, max(rim * 0.6, shine * 0.55)))); } } return out_; }`,
  22: `{ vec2 q = p * 8.0 + uSeed + (vec2(fbm(p * 5.0), fbm(p * 5.0 + 5.0)) - 0.5) * 1.4; vec3 v = vor(q); float where = smoothstep(0.52, 0.66, fbm(p * 11.0 + uSeed + 9.0)), line = smoothstep(0.02, 0.0, v.y) * where, glow = smoothstep(0.14, 0.0, v.y) * where, haze = smoothstep(0.35, 0.75, fbm(p * 2.5 + uSeed)); return vec4(vec3(0.3, 0.42, 0.85) * line * 0.75 + vec3(0.07, 0.1, 0.26) * glow * 0.6 + vec3(0.03, 0.045, 0.12) * haze, 0.08 * haze + 0.32 * line); }`,
  23: `{ float glow = smoothstep(0.3, 0.74, fbm(p * 2.0 + uSeed)); vec3 v = vor(p * 34.0 + uSeed), t = vor((p + sway(p * 4.0 + uSeed, 0.3)) * 6.0 + uSeed + 2.0), s = vor(p * 80.0 + uSeed + 7.0); float size = 0.03 + 0.13 * v.z * v.z, mote = smoothstep(size, size * 0.3, v.x) * step(0.86, v.z) * glow, dust = smoothstep(0.1, 0.03, s.x) * step(0.8, s.z) * glow, thread = smoothstep(0.018, 0.0, t.y) * smoothstep(0.5, 0.68, fbm(p * 8.0 + uSeed + 6.0)) * glow; return vec4(vec3(0.17, 0.145, 0.08) * (0.12 + 0.7 * glow) + vec3(0.5, 0.44, 0.24) * (mote + thread * 0.45) + vec3(0.26, 0.23, 0.13) * dust, 0.03 + 0.2 * mote + 0.08 * thread); }`,
  24: `{ vec2 w = p + sway(p * 5.0 + uSeed, 0.3) + sway(p * 22.0, 0.03); vec3 v = vor(w * 6.0 + uSeed), s = vor(w * 15.0 + uSeed + 4.0); float dark = smoothstep(0.34, 0.58, wide + (fine - 0.5) * 0.3), live = smoothstep(0.38, 0.56, fbm(p * 6.0 + uSeed + 13.0)), core = smoothstep(0.012 + 0.018 * live, 0.004, v.y) * live, halo = smoothstep(0.13, 0.0, v.y), small = smoothstep(0.02, 0.004, s.y) * smoothstep(0.42, 0.62, fbm(p * 7.0 + uSeed + 3.0)); vec4 under_ = over(vec3(0.02, 0.012, 0.028), dark * 0.7); return vec4(under_.rgb * (1.0 - min(1.0, core + small) * 0.8) + vec3(0.19, 0.06, 0.25) * (core * 0.8 + small * 0.4) * dark + vec3(0.06, 0.02, 0.09) * halo * dark, under_.a); }`,
  25: `{ vec3 v = vor((p + sway(p * 6.0, 0.08)) * 8.0 + uSeed); float hollow = torn(p, fbm(p * 4.0 + uSeed), 0.58, 0.02), crack = smoothstep(0.014, 0.004, v.y) * smoothstep(0.42, 0.58, fbm(p * 6.0 + uSeed + 2.0)); vec3 c = mix(vec3(0.115, 0.115, 0.12), vec3(0.245, 0.245, 0.25), fine * 0.65 + noise(p * 170.0) * 0.35) * (1.0 - 0.4 * hollow) * (1.0 - 0.6 * crack); return over(c, 0.56 + 0.18 * hollow + 0.18 * crack); }`,
  29: `return vec4(vec3(0.03, 0.065, 0.08) * 0.65 + vec3(0.7, 0.8, 0.85) * smoothstep(0.55, 0.8, fbm(vec2(p.x * 9.0, p.y * 26.0))) * 0.045, 0.65);`,
  30: `{ vec3 v = vor(p * 42.0 + uSeed); float pools = fbm(p * 4.0 + uSeed), at = pools + (fine - 0.5) * 0.14, pool = max(uCover * 0.75, smoothstep(0.495, 0.51, at)), eaten = torn(p, pools, 0.47, 0.012) * (1.0 - pool), crust = torn(p, pools, 0.41, 0.025) * (1.0 - pool) * (1.0 - eaten), pit = smoothstep(0.72, 0.84, noise(p * 150.0 + uSeed)), radius = 0.05 + 0.24 * v.z * v.z, bubble = smoothstep(0.035, 0.0, abs(v.x - radius)) * step(0.62, v.z); vec3 c = mix(vec3(0.11, 0.15, 0.03), vec3(0.25, 0.3, 0.06), fine * 0.7 + 0.15) + vec3(0.3, 0.34, 0.09) * bubble * 0.7; return on(on(over(vec3(0.38, 0.385, 0.27) * (0.7 + 0.5 * fine) * (1.0 - 0.5 * pit), crust * 0.6), over(vec3(0.07, 0.07, 0.025), eaten * 0.55)), over(c, pool * 0.9)); }`,
  31: `{ float mist = smoothstep(0.3, 0.7, fbm(p * 3.0 + uSeed)), sick = torn(p, fbm(p * 5.0 + uSeed + 6.0), 0.47, 0.03), mood = smoothstep(0.36, 0.66, fbm(p * 7.0 + uSeed + 3.0)); vec3 s = vor(p * 36.0 + uSeed), t = vor((p + sway(p * 5.0 + uSeed, 0.14)) * 9.0 + uSeed + 2.0); float size = 0.04 + 0.2 * s.z * s.z, spore = smoothstep(size, size * 0.6, s.x) * step(0.56, s.z) * sick, thread = smoothstep(0.018, 0.004, t.y) * sick; vec3 c = mix(vec3(0.15, 0.085, 0.19), vec3(0.2, 0.25, 0.095), mood) * (0.72 + 0.55 * fine); c = mix(c, vec3(0.34, 0.38, 0.16), spore * 0.6) * (1.0 - 0.6 * thread); return over(c, 0.16 + 0.22 * mist + 0.42 * sick + 0.15 * spore); }`,
  32: `{ vec2 w = p * 8.0 + uSeed + (vec2(fbm(p * 7.0), fbm(p * 7.0 + 3.0)) - 0.5) * 2.2 + (vec2(fbm(p * 24.0), fbm(p * 24.0 + 3.0)) - 0.5) * 0.35; vec3 v = vor(w); float breadth = 0.012 + 0.07 * smoothstep(0.34, 0.7, fbm(p * 4.0 + uSeed)), glow = smoothstep(breadth * 3.4, 0.0, v.y), core = smoothstep(breadth, breadth * 0.3, v.y); vec3 rock = mix(vec3(0.02, 0.018, 0.016), vec3(0.075, 0.065, 0.055), fine); return vec4(rock * 0.74 * (1.0 - core) + vec3(0.32, 0.055, 0.006) * glow * glow * glow + vec3(0.5, 0.22, 0.03) * core, 0.74 * (1.0 - core) + core); }`,
  33: `{ vec2 q = p * 5.0 + uSeed + sway(p * 5.0, 1.2) + sway(p * 42.0, 0.12); vec3 v = vor(q), s = vor(q * 2.5 + 3.0); float where = smoothstep(0.48, 0.6, fbm(p * 8.0 + uSeed + 9.0)), core = smoothstep(0.011, 0.002, v.y) * where, glow = smoothstep(0.08, 0.0, v.y) * where, fork = smoothstep(0.009, 0.002, s.y) * smoothstep(0.13, 0.0, v.y) * where; return vec4(vec3(0.78, 0.88, 1.0) * core * 0.9 + vec3(0.42, 0.62, 0.98) * fork * 0.6 + vec3(0.1, 0.17, 0.42) * glow * glow * 0.8 + vec3(0.02, 0.03, 0.06) * smoothstep(0.3, 0.7, wide), 0.05 + 0.5 * core + 0.3 * fork); }`,
  34: `{ vec3 v = vor(p * 13.0 + uSeed); float lead = smoothstep(0.045, 0.0, v.y); return vec4(mix(vec3(0.1), 0.13 + 0.1 * cos(v.z * 6.28 + vec3(0.0, 2.1, 4.2)), 0.6) * (0.75 + 0.4 * fine) * 0.5 * (1.0 - lead) + vec3(0.01) * lead, 0.5 + 0.42 * lead); }`,
  40: `{ vec2 way = vec2(cos(uSeed), sin(uSeed)), q = vec2(dot(p, way), dot(p, vec2(-way.y, way.x))) + sway(p * 4.0 + uSeed, 0.12); float carve = fbm(vec2(q.x * 3.0, q.y * 11.0) + uSeed) * 6.0, r = fract(carve), crest = smoothstep(0.0, 0.9, r) * smoothstep(1.0, 0.94, r), reach = torn(p, wide, 0.4, 0.025); return over(mix(vec3(0.69, 0.72, 0.77), vec3(0.85, 0.86, 0.875), crest) * (0.96 + 0.06 * fine), reach * (0.7 + 0.22 * crest)); }`,
  41: `{ vec4 out_ = vec4(0.0); for (float l = 0.0; l < 2.5; l += 1.0) { vec3 v = vor(p * (24.0 + l * 16.0) + uSeed + l * 3.7); float top = smoothstep(0.012, 0.09, v.y), keep = step(0.3 + l * 0.14, v.z) * smoothstep(0.3, 0.46, wide + 0.06); vec3 tone = mix(vec3(0.13, 0.12, 0.105), vec3(0.34, 0.32, 0.28), v.z) * (0.65 + 0.6 * fine) * (0.5 + 0.7 * smoothstep(0.0, 0.2, v.y)); out_ = on(out_, over(tone, top * keep)); } return out_; }`,
  42: `{ vec3 v = vor(p * 19.0 + uSeed + sway(p * 7.0, 1.0) + sway(p * 30.0, 0.16)), e = vor(p * 90.0 + uSeed + 4.0); float hot = smoothstep(0.38, 0.62, fbm(p * 3.0 + uSeed)), burn = torn(p, wide + 0.1, 0.36, 0.02), alight = smoothstep(0.34, 0.5, fbm(p * 7.0 + uSeed + 11.0)), breadth = 0.006 + 0.034 * hot * alight, seam = smoothstep(breadth, breadth * 0.35, v.y) * (0.3 + 0.7 * alight), halo = smoothstep(breadth * 5.0, 0.0, v.y), ash = smoothstep(0.62, 0.76, fbm(p * 36.0 + uSeed)) * (1.0 - hot), ember = smoothstep(0.14, 0.05, e.x) * step(0.9, e.z) * hot; vec3 c = mix(vec3(0.022, 0.02, 0.018), vec3(0.08, 0.072, 0.064), fine * 0.6 + v.z * 0.4) * (1.0 - seam) + vec3(0.2, 0.195, 0.185) * ash * (1.0 - seam); c += vec3(0.2, 0.045, 0.004) * halo * halo * hot + vec3(0.62, 0.2, 0.025) * seam * (0.3 + 0.7 * hot) + vec3(0.36, 0.3, 0.1) * seam * hot * hot + vec3(0.7, 0.3, 0.05) * ember; return vec4(c * burn, burn * 0.9); }`,
  43: `{ ${BLOOD_MARKS} float flake = smoothstep(0.05, 0.0, vor(p * 42.0 + uSeed).y); vec3 c = mix(vec3(0.17, 0.075, 0.045), vec3(0.26, 0.13, 0.07), smoothstep(0.5, 0.7, fine)) * (1.0 - 0.35 * flake); return over(c, max(mix(max(pool, soak), 0.65, uCover), drops * 0.75)); }`,
  44: `{ vec3 v = vor(p * 5.5 + uSeed + sway(p * 4.0 + uSeed, 0.5)); float wet_ = smoothstep(0.36, 0.62, fbm(p * 2.5 + uSeed + 9.0)), keep = smoothstep(0.3, 0.6, v.z), sag = smoothstep(0.6, 0.0, v.x) * keep, rings = (sin(v.x * 62.0) * 0.5 + 0.5) * smoothstep(0.55, 0.12, v.x) * keep, grain = noise(p * 240.0); vec3 c = mix(vec3(0.36, 0.28, 0.17), vec3(0.17, 0.125, 0.075), wet_ * 0.7) * (0.8 + 0.3 * fine) * (0.9 + 0.2 * grain); c *= (1.0 - 0.42 * sag) * (0.94 + 0.16 * rings); return over(c, 0.84); }`,
  45: `{ vec2 bend = sway(p * 3.0 + uSeed, 0.9); float run = fbm(p * 4.0 + uSeed + bend), lines = smoothstep(0.1, 0.0, abs(fract(run * 7.0) - 0.5)), shape = torn(p, wide, 0.38, 0.012); vec3 v = vor(p * 9.0 + uSeed + bend), b = vor(p * 56.0 + uSeed + 2.0); float crack = smoothstep(0.012, 0.003, v.y) * smoothstep(0.42, 0.6, fbm(p * 7.0 + uSeed + 2.0)), radius = 0.05 + 0.2 * fract(b.z * 9.1), bubble = smoothstep(0.03, 0.0, abs(b.x - radius)) * step(0.82, b.z); vec3 c = mix(vec3(0.1, 0.17, 0.14), vec3(0.24, 0.34, 0.29), run) + vec3(0.1, 0.13, 0.12) * lines * 0.45 + vec3(0.26, 0.3, 0.28) * (crack + bubble * 0.5); return over(c, shape * (0.76 + 0.14 * crack)); }`,
  46: `{ float gloss = smoothstep(0.56, 0.82, fbm(p * 3.0 + uSeed)); vec3 v = vor((p + sway(p * 6.0 + uSeed, 0.09)) * 5.0 + uSeed); float line = smoothstep(0.006, 0.0015, v.y) * smoothstep(0.38, 0.56, fbm(p * 6.0 + uSeed + 2.0)); return vec4(vec3(0.02, 0.035, 0.045) * 0.68 + vec3(0.32, 0.42, 0.47) * (0.1 * gloss + 0.34 * line), 0.68); }`,
  47: `{ vec3 v = vor((p + sway(p * 8.0, 0.05)) * 25.0 + uSeed), stone = vor(p * 52.0 + uSeed + 9.0); float wet_ = smoothstep(0.42, 0.66, fbm(p * 4.0 + uSeed)), split = smoothstep(0.035, 0.008, v.y) * (1.0 - wet_), pebble = smoothstep(0.08 + 0.14 * fract(stone.z * 7.1), 0.05, stone.x) * step(0.86, stone.z); vec3 c = mix(vec3(0.25, 0.19, 0.12) * (0.85 + 0.25 * v.z), vec3(0.075, 0.055, 0.038), wet_) * (0.76 + 0.5 * fine) * (1.0 - 0.75 * split); c = mix(c, vec3(0.3, 0.28, 0.24) * (0.7 + 0.6 * fine), pebble); return over(c, 0.95); }`,
});
const lookFrag = (id) => `${LOOK_HELPERS}
vec4 stain(vec2 p){
  float fine = fbm(p * 22.0), wide = fbm(p * 5.0 + uSeed);
  float patchy = max(uCover, smoothstep(0.38, 0.54, wide + (fine - 0.5) * 0.25));
  ${PAINTERS[id] ?? 'return vec4(0.0);'}
}
void main(){ gl_FragColor = stain(vWorld / (uGrid * 5.0 * (uScale > 0.0 ? uScale : 1.0)) + uSeed); }`;

// How much body a look has: anything thick catches the light on one side and throws a little shadow on the other.
const BODIES = Object.freeze({ 48: 0.35, 50: 0.75, 7: 1, 14: 1, 15: 1, 41: 1, 10: 1, 4: 0.5, 5: 0.5, 8: 0.5, 16: 0.5, 19: 0.5, 30: 0.5, 40: 0.5 });
const bodyOf = (id) => BODIES[id] ?? 0;
// How far a look's strength moves its noise.
const biasOf = (strength = 1) => (strength - 1) * (strength < 1 ? 0.05 : 0.09);
// Finishes a painted look: its relief, and the region's soft edge.
const FINISH_FRAG = `precision highp float;
varying vec2 vWorld;
uniform sampler2D uPaint;
uniform sampler2D uShore; // a sea's distance from its shore, when the look stops at its waterline
uniform float uGrid, uBody, uWet, uAmount, uClip;
${NOISE}
${EDGE}
${SHORE_LINE}
void main(){
  vec2 uv = (vWorld - uBox.xy) / uBox.zw, toLight = vec2(-0.021, -0.026) * uGrid / uBox.zw;
  vec4 s = texture2D(uPaint, uv);
  vec3 rgb = s.rgb; float a = s.a;
  if (uBody > 0.0) {
    float near = texture2D(uPaint, uv + toLight).a, far = texture2D(uPaint, uv + toLight * 2.4).a, lit = clamp((s.a - near) * 2.2, -1.0, 1.0) * uBody;
    rgb = s.rgb * (1.0 + (lit > 0.0 ? lit * 0.85 : lit * 0.55)) + vec3(0.1) * max(0.0, lit) * s.a * uWet;
    a = s.a + max(0.0, far - s.a) * 0.55 * uBody * (1.0 - s.a);
  }
  // Strength: below 1 what is left thins, above it what is there thickens without passing solid.
  float thick = uAmount < 1.0 ? pow(uAmount, 0.5) : (1.0 - pow(max(0.0, 1.0 - a), uAmount)) / max(a, 0.001);
  gl_FragColor = vec4(rgb, a) * thick * inside(vWorld, uGrid) * (uClip > 0.5 ? smoothstep(0.19, 0.24, shoreLine(vWorld / uGrid, texture2D(uShore, uv).b)) : 1.0);
}`;
// A change crossing the floor: two finished images, the new one taking over from the click. Cheap: it only samples them.
const SPREAD_FRAG = `precision highp float;
varying vec2 vWorld;
uniform sampler2D uOld, uNew;
uniform vec4 uBox;
uniform vec2 uSrc;
uniform float uMix, uReach, uGrid, uSeed, uFade, uFire;
${NOISE}
void main(){
  vec2 uv = (vWorld - uBox.xy) / uBox.zw, p = vWorld / (uGrid * 5.0) + uSeed;
  float front = uFade > 0.5 ? uMix : smoothstep(0.0, 0.1, uMix * (uReach + 0.35) - (distance(vWorld, uSrc) / (uGrid * 5.0) + (fbm(p * 7.0) - 0.5) * 0.22));
  vec4 col = mix(texture2D(uOld, uv), texture2D(uNew, uv), front);
  if (uFire > 0.5 && uFade < 0.5) { float edge = front * (1.0 - front) * 1.1; col.rgb += vec3(1.0, 0.42, 0.06) * edge; col.a = max(col.a, edge * 0.8); }
  gl_FragColor = col;
}`;
const FIRE_LOOKS = new Set([3, 13, 32, 42]);

// One tile of a floor, painted once: repeats without a seam (every noise here wraps at the tile's edge), lit from the upper left.
// A region's floor can be painted in any of its styles. Each compiles into a small shader the first time it is used, and is painted
// once into a tile. The first style of a floor is its usual one.
const B = Object.freeze({
  stone: `vec2 wob = (vec2(fbm1(p + 0.3, 16.0), fbm1(p + 0.7, 16.0)) - 0.5) * 0.012;
    vec2 q = (p + wob) * vec2(4.0, 8.0), id = floor(q); q.x += step(1.0, mod(id.y, 2.0)) * 0.5; id = floor(q); vec2 f = fract(q);
    id.x = mod(id.x, 4.0); float tone = h(id, vec2(4.0, 8.0));
    float edge = min(min(f.x * 0.5, (1.0 - f.x) * 0.5), min(f.y, 1.0 - f.y)), bevel = smoothstep(0.0, 0.07, edge + (fbm1(p, 64.0) - 0.5) * 0.04);
    height = bevel * (0.65 + 0.25 * tone) + fbm1(p + tone, 32.0) * 0.16 + fbm1(p, 128.0) * 0.05;
    col = mix(vec3(0.26, 0.25, 0.23), vec3(0.41, 0.39, 0.35), tone) * (0.8 + 0.4 * fbm1(p + 2.0, 24.0));
    col = mix(col, col * vec3(0.8, 0.86, 0.68), smoothstep(0.55, 0.75, fbm1(p + 5.0, 12.0)) * 0.55);
    col = mix(vec3(0.05, 0.045, 0.04), col, smoothstep(0.0, 0.03, edge));`,
  wood: `float rows = 16.0, row = floor(p.y * rows), fy = fract(p.y * rows), shift = h(vec2(row, 3.0), vec2(rows, 8.0)), x = p.x * 3.0 + shift * 3.0, board = floor(x), fx = fract(x);
    vec2 id = vec2(mod(board, 3.0), row); float tone = h(id, vec2(3.0, rows));
    float knot = 0.0; vec2 kpos = h2(id + 8.0, vec2(3.0, rows)); if (tone > 0.6) knot = smoothstep(0.26, 0.0, length((vec2(fx * 3.0, fy) - vec2(kpos.x * 2.4 + 0.3, kpos.y * 0.6 + 0.2))));
    float grain = fbm(vec2(p.x + tone, p.y + knot * 0.012 + tone * 0.3), vec2(6.0, 96.0)), rings = sin((grain + knot) * 40.0) * 0.5 + 0.5;
    col = mix(vec3(0.17, 0.1, 0.055), vec3(0.34, 0.22, 0.12), tone * 0.55 + grain * 0.55) * (0.82 + 0.22 * rings); col = mix(col, vec3(0.09, 0.05, 0.03), knot * 0.7);
    float edge = min(fy, 1.0 - fy) * 0.4, end = min(fx, 1.0 - fx);
    float gap = min(smoothstep(0.0, 0.006, edge), smoothstep(0.0, 0.0018, end));
    height = 0.4 * gap + 0.12 * rings + 0.14 * tone * gap; col *= 0.22 + 0.78 * gap;
    float nail = smoothstep(0.018, 0.008, length(vec2((fx > 0.5 ? 1.0 - fx : fx) * 3.0 - 0.06, fy - 0.5) * vec2(1.0, 0.5)));
    col = mix(col, vec3(0.1, 0.1, 0.11), nail); height += nail * 0.2;`,
  dirt: `float big = fbm1(p, 6.0), mid = fbm1(p + 0.4, 28.0), low = fbm1(p + 0.7, 120.0);
    col = mix(vec3(0.17, 0.12, 0.08), vec3(0.34, 0.25, 0.16), big * 0.6 + mid * 0.5) * (0.8 + 0.4 * low);
    height = big * 0.5 + mid * 0.3 + low * 0.14;
    vec3 v = vor(p + (vec2(fbm1(p, 40.0), fbm1(p + 0.5, 40.0)) - 0.5) * 0.022, 36.0); float stone = step(0.9, v.z) * smoothstep(0.17, 0.14, v.x);
    col = mix(col, mix(vec3(0.17, 0.15, 0.12), vec3(0.29, 0.26, 0.21), v.y * 2.0), stone * 0.85); height += stone * (0.2 - v.x * 0.6);`,
  grass: `float patches = fbm1(p, 5.0), soil = fbm1(p + 0.3, 60.0);
    col = mix(vec3(0.08, 0.11, 0.045), vec3(0.14, 0.15, 0.065), soil);
    height = soil * 0.08;
    blades(p, 64.0, 2.0, col, height, 0.15);
    blades(p, 80.0, 31.0, col, height, 0.35);
    blades(p, 96.0, 57.0, col, height, 0.55);
    blades(p, 72.0, 83.0, col, height, 0.75);
    col *= mix(vec3(0.93, 0.94, 0.9), vec3(1.05, 1.03, 0.97), smoothstep(0.32, 0.68, patches));`,
  sand: `float wob = fbm1(p, 5.0), big = fbm1(p + 0.6, 4.0), ripple = sin((p.y + (wob - 0.5) * 0.09) * 6.28318 * 36.0) * 0.5 + 0.5, grain = fbm1(p + 0.2, 200.0);
    col = mix(vec3(0.48, 0.39, 0.25), vec3(0.67, 0.57, 0.4), big * 0.7 + grain * 0.35); height = ripple * 0.14 + big * 0.6 + grain * 0.05;
    vec3 v = vor(p, 90.0); col = mix(col, vec3(0.28, 0.24, 0.18), step(0.97, v.z) * smoothstep(0.12, 0.07, v.x) * 0.7);`,
  snow: `float big = fbm1(p, 4.0), mid = fbm1(p + 0.4, 20.0); height = big * 0.9 + mid * 0.2 + fbm1(p, 160.0) * 0.03;
    col = mix(vec3(0.68, 0.74, 0.83), vec3(0.92, 0.94, 0.97), smoothstep(0.3, 0.7, big * 0.8 + mid * 0.3)); gGloss = 0.05;`,
  water: `float big = fbm1(p, 4.0), mid = fbm1(p + 0.3, 16.0); height = big * 0.12 + mid * 0.05;
    col = mix(vec3(0.05, 0.1, 0.12), vec3(0.11, 0.18, 0.18), smoothstep(0.3, 0.7, big)); gGloss = 0.3;`,
  ice: `float big = fbm1(p, 4.0), vein = veins(p + 0.2, 6.0, 0.012), fine = veins(p + 0.6, 17.0, 0.012);
    col = mix(vec3(0.23, 0.36, 0.43), vec3(0.5, 0.65, 0.71), big); col += vec3(0.24) * vein + vec3(0.1) * fine;
    height = big * 0.14 + (vein + fine * 0.5) * -0.05; gGloss = 0.5;
    col += 0.1 * smoothstep(0.86, 0.95, fbm1(p + 0.9, 48.0));`,
  mud: `float big = fbm1(p, 5.0), mid = fbm1(p + 0.3, 22.0), low = fbm1(p + 0.8, 90.0); height = big * 0.7 + mid * 0.42 + low * 0.14;
    col = mix(vec3(0.075, 0.055, 0.038), vec3(0.24, 0.175, 0.11), big * 0.55 + mid * 0.55) * (0.82 + 0.36 * low); gGloss = 0.75;
    float pool = smoothstep(0.6, 0.68, fbm1(p + 0.35, 12.0)); col = mix(col, vec3(0.1, 0.105, 0.095), pool * 0.82); height = mix(height, 0.3, pool * 0.85); gGloss = mix(gGloss, 1.0, pool);`,
  pebbles: `stones(p, 30.0, vec3(0.25, 0.23, 0.2), vec3(0.5, 0.46, 0.4), col, height); if (gStoneTone > 0.8) col *= vec3(1.04, 0.95, 0.86);`,
  glass: `vec2 f = fract(p * 4.0); float edge = min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y)), lead = smoothstep(0.016, 0.02, edge), tone = h(floor(p * 4.0), vec2(4.0));
    float ream = sin((p.y + fbm1(p + tone, 5.0) * 0.16 + tone) * 6.28318 * 34.0) * 0.5 + 0.5, solder = smoothstep(0.05, 0.03, length(min(f, 1.0 - f)));
    col = mix(vec3(0.05, 0.13, 0.16), vec3(0.11, 0.23, 0.22), tone * 0.7 + fbm1(p, 8.0) * 0.4) * (0.975 + 0.05 * ream) * mix(vec3(1.0), vec3(0.9, 1.04, 1.1), fract(tone * 5.3)); col = mix(mix(vec3(0.05, 0.05, 0.055), vec3(0.13, 0.13, 0.14), solder) * (0.8 + 0.5 * fbm1(p, 200.0)), col, lead);
    height = lead * 0.5 + fbm1(p + tone, 10.0) * 0.05 + ream * lead * 0.002; gGloss = 0.9 * lead + 0.2; gTilt = (vec2(fract(tone * 7.31), fract(tone * 3.77)) - 0.5) * 0.7 * lead;`,
  metal: `vec2 f = fract(p * 4.0), id = mod(floor(p * 4.0), 4.0); float edge = min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y)), tone = h(id, vec2(4.0)), seam = smoothstep(0.006, 0.01, edge);
    float brushed = fbm(p + tone, vec2(8.0, 256.0)); vec2 r = min(f, 1.0 - f); float rivet = smoothstep(0.026, 0.023, length(r - 0.07));
    col = mix(vec3(0.2, 0.21, 0.22), vec3(0.33, 0.34, 0.36), tone * 0.5 + brushed * 0.55) * (0.1 + 0.9 * seam);
    col = mix(col, vec3(0.21, 0.12, 0.07), smoothstep(0.66, 0.7, fbm1(p + 0.4, 14.0) + (fbm1(p, 120.0) - 0.5) * 0.2) * (0.35 + 0.4 * fbm1(p, 260.0)));
    height = seam * 0.5 + brushed * 0.03 + rivet * 0.3; col += rivet * 0.09; gGloss = 0.4;`,
});
const GRASS_COLOURS = 'gBladeLow = vec3(0.2, 0.31, 0.1); gBladeHigh = vec3(0.37, 0.47, 0.15); gBladeDry = vec3(0.38, 0.34, 0.14);';
const TILE_STYLES = Object.freeze({
  grass: {
    meadow: GRASS_COLOURS + B.grass,
    long: `gBladeLow = vec3(0.14, 0.24, 0.08); gBladeHigh = vec3(0.3, 0.42, 0.13); gBladeDry = vec3(0.42, 0.38, 0.16);
      float patches = fbm1(p, 4.0), soil = fbm1(p + 0.3, 60.0); col = vec3(0.05, 0.07, 0.03) + 0.05 * soil; height = soil * 0.06;
      blades(p, 34.0, 2.0, col, height, 0.15); blades(p, 42.0, 31.0, col, height, 0.4); blades(p, 38.0, 57.0, col, height, 0.65); blades(p, 46.0, 83.0, col, height, 0.85);
      col *= mix(vec3(0.74, 0.76, 0.66), vec3(1.14, 1.08, 0.92), smoothstep(0.3, 0.7, patches));`,
    turf: `gBladeLow = vec3(0.24, 0.37, 0.13); gBladeHigh = vec3(0.38, 0.5, 0.19); gBladeDry = vec3(0.42, 0.45, 0.18);
      float patches = fbm1(p, 6.0), soil = fbm1(p + 0.3, 90.0); col = vec3(0.13, 0.19, 0.07) + 0.05 * soil; height = soil * 0.05;
      blades(p, 128.0, 2.0, col, height, 0.2); blades(p, 160.0, 31.0, col, height, 0.4); blades(p, 144.0, 57.0, col, height, 0.6);
      col *= mix(vec3(0.86, 0.88, 0.8), vec3(1.08, 1.06, 0.96), smoothstep(0.3, 0.7, patches));`,
    dry: `gBladeLow = vec3(0.36, 0.31, 0.13); gBladeHigh = vec3(0.58, 0.49, 0.23); gBladeDry = vec3(0.3, 0.3, 0.13);
      float patches = fbm1(p, 5.0), soil = fbm1(p + 0.3, 60.0); col = mix(vec3(0.17, 0.13, 0.08), vec3(0.28, 0.21, 0.13), soil); height = soil * 0.1;
      blades(p, 58.0, 2.0, col, height, 0.15); blades(p, 72.0, 31.0, col, height, 0.4); blades(p, 64.0, 57.0, col, height, 0.7);
      col *= mix(vec3(0.82, 0.8, 0.74), vec3(1.1, 1.06, 0.96), smoothstep(0.3, 0.7, patches));`,
    clover: `gBladeLow = vec3(0.18, 0.29, 0.1); gBladeHigh = vec3(0.31, 0.42, 0.14); gBladeDry = vec3(0.33, 0.33, 0.13);
      float soil = fbm1(p + 0.3, 60.0), patches = fbm1(p, 5.0); col = vec3(0.075, 0.1, 0.045) + 0.05 * soil; height = soil * 0.06;
      blades(p, 84.0, 2.0, col, height, 0.15);
      clover(p, 34.0, 11.0, col, height, 0.35); clover(p + 0.37, 42.0, 29.0, col, height, 0.55);
      col *= mix(vec3(0.84, 0.86, 0.78), vec3(1.14, 1.12, 0.98), smoothstep(0.3, 0.7, patches));`,
    forest: `gBladeLow = vec3(0.14, 0.22, 0.08); gBladeHigh = vec3(0.25, 0.34, 0.12); gBladeDry = vec3(0.34, 0.3, 0.13);
      float big = fbm1(p, 5.0), soil = fbm1(p + 0.3, 40.0), low = fbm1(p + 0.6, 140.0);
      col = mix(vec3(0.1, 0.075, 0.05), vec3(0.23, 0.17, 0.105), big * 0.5 + soil * 0.55) * (0.82 + 0.34 * low); height = big * 0.34 + soil * 0.22;
      // Twigs on the ground.
      float twig = smoothstep(0.006, 0.0, abs(fbm1(p + 0.2, 9.0) - 0.5)) * smoothstep(0.42, 0.56, fbm1(p + 0.8, 11.0)); col = mix(col, vec3(0.12, 0.085, 0.055), twig * 0.9); height += twig * 0.12;
      // Moss in cushions.
      vec3 cushion = vor(p, 70.0); float mossy = smoothstep(0.52, 0.66, big + (soil - 0.5) * 0.3); col = mix(col, mix(vec3(0.09, 0.14, 0.045), vec3(0.24, 0.32, 0.09), cushion.z) * (1.18 - cushion.x * 0.75), mossy * 0.95); height += mossy * 0.24 * (1.0 - cushion.x);
      // The year's leaves, deepest where there is no moss.
      leaves(p, 38.0, 3.0, 0.7 - mossy * 0.5, col, height, 0.5); leaves(p + 0.41, 48.0, 17.0, 0.55 - mossy * 0.45, col, height, 0.62);
      blades(p, 30.0, 31.0, col, height, 0.8);`,
  },
  stone: {
    flagstones: `vec2 wob = (vec2(fbm1(p + 0.3, 16.0), fbm1(p + 0.7, 16.0)) - 0.5) * 0.014;
      vec2 q = (p + wob) * vec2(4.0, 8.0), id = floor(q); q.x += step(1.0, mod(id.y, 2.0)) * 0.5; id = floor(q); vec2 f_ = fract(q); id.x = mod(id.x, 4.0);
      float tone = h(id, vec2(4.0, 8.0)), edge = min(min(f_.x * 0.5, (1.0 - f_.x) * 0.5), min(f_.y, 1.0 - f_.y)), bevel = smoothstep(0.0, 0.028, edge + (fbm1(p, 64.0) - 0.5) * 0.024);
      height = bevel * (0.34 + 0.2 * tone) + fbm1(p + tone, 32.0) * 0.2 + fbm1(p, 128.0) * 0.08;
      col = mix(vec3(0.26, 0.25, 0.23), vec3(0.41, 0.39, 0.35), tone) * (0.76 + 0.48 * fbm1(p + 2.0, 24.0)) * (0.9 + 0.2 * fbm1(p, 160.0));
      col = mix(col, col * vec3(0.8, 0.86, 0.68), smoothstep(0.55, 0.75, fbm1(p + 5.0, 12.0)) * 0.5); col = mix(vec3(0.055, 0.05, 0.045), col, smoothstep(0.0, 0.006, edge + (fbm1(p + 0.2, 90.0) - 0.5) * 0.014)); col *= 1.0 - 0.6 * veins(p + tone, 9.0, 0.006);`,
    cobbles: `stones(p, 18.0, vec3(0.2, 0.19, 0.17), vec3(0.42, 0.4, 0.36), col, height); float wear = smoothstep(0.5, 0.75, fbm1(p, 10.0)); col = mix(col, col * vec3(0.76, 0.8, 0.66), wear * 0.5); gGloss = 0.14;`,
    dungeon: `vec2 q = p * 4.0, id = floor(q), f_ = fract(q); id = mod(id, 4.0); float tone = h(id, vec2(4.0)), edge = min(min(f_.x, 1.0 - f_.x), min(f_.y, 1.0 - f_.y)), bevel = smoothstep(0.0, 0.03, edge + (fbm1(p, 64.0) - 0.5) * 0.03);
      height = bevel * (0.36 + 0.2 * tone) + fbm1(p + tone, 40.0) * 0.22 + fbm1(p, 160.0) * 0.08; col = mix(vec3(0.15, 0.145, 0.145), vec3(0.29, 0.28, 0.27), tone) * (0.72 + 0.56 * fbm1(p + 2.0, 28.0)) * (0.86 + 0.28 * fbm1(p, 200.0));
      col = mix(col, vec3(0.055, 0.08, 0.04), smoothstep(0.56, 0.76, fbm1(p + 6.0, 9.0)) * 0.6 * (1.0 - bevel * 0.45)); col = mix(vec3(0.02), col, smoothstep(0.0, 0.006, edge + (fbm1(p + 0.2, 90.0) - 0.5) * 0.014)); col *= 1.0 - 0.72 * veins(p + 0.4, 7.0, 0.007);`,
    cave: `float big = fbm1(p, 4.0), mid = fbm1(p + 0.3, 14.0), ridge = 1.0 - abs(fbm1(p + 0.6, 8.0) - 0.5) * 2.0, low = fbm1(p + 0.8, 90.0); height = big * 0.8 + pow(ridge, 3.0) * 0.5 + mid * 0.34 + low * 0.14;
      col = mix(vec3(0.11, 0.1, 0.09), vec3(0.33, 0.31, 0.27), big * 0.5 + mid * 0.5) * (0.78 + 0.42 * low); col = mix(col, col * vec3(1.12, 0.98, 0.82), smoothstep(0.5, 0.72, fbm1(p + 0.2, 7.0)) * 0.5); col *= 1.0 - 0.78 * veins(p + 0.2, 5.0, 0.01); height -= veins(p + 0.2, 5.0, 0.01) * 0.2;`,
    marble: `vec2 f_ = fract(p * 2.0); float edge = min(min(f_.x, 1.0 - f_.x), min(f_.y, 1.0 - f_.y)), tone = h(mod(floor(p * 2.0), 2.0), vec2(2.0)), turn = tone > 0.5 ? 1.0 : -1.0;
      float wander = fbm1(p + tone, 3.0) * 1.5 + fbm1(p + 0.5, 9.0) * 0.28, along = (p.x + p.y * turn * 0.7) * 3.0 + wander, across = (p.x * turn * 0.8 - p.y) * 7.0 + wander * 1.5, main_ = 1.0 - abs(fract(along) * 2.0 - 1.0), side = 1.0 - abs(fract(across) * 2.0 - 1.0), vein = pow(main_, 70.0), bloom = pow(main_, 9.0) * 0.24, fine_ = pow(side, 130.0) * smoothstep(0.42, 0.6, fbm1(p + 0.9, 6.0));
      col = mix(vec3(0.62, 0.61, 0.58), vec3(0.78, 0.77, 0.74), fbm1(p + tone, 6.0)) * (0.92 + 0.1 * tone); col = mix(col, vec3(0.3, 0.29, 0.3), min(1.0, vein * 0.8 * (0.45 + 0.55 * smoothstep(0.3, 0.5, fbm1(p + 0.3, 5.0))) + bloom + fine_ * 0.5)); col = mix(vec3(0.18), col, smoothstep(0.0, 0.004, edge));
      height = smoothstep(0.0, 0.008, edge) * 0.4; gGloss = 0.75;`,
    crazy: `vec3 v = vor(p, 9.0); float bevel = smoothstep(0.0, 0.05, v.y + (fbm1(p, 64.0) - 0.5) * 0.02); height = bevel * (0.6 + 0.3 * v.z) + fbm1(p, 40.0) * 0.14 + fbm1(p, 128.0) * 0.05;
      col = mix(vec3(0.26, 0.23, 0.19), vec3(0.45, 0.4, 0.33), v.z) * (0.8 + 0.4 * fbm1(p + 2.0, 24.0)); col = mix(vec3(0.05, 0.04, 0.035), col, smoothstep(0.0, 0.01, v.y + (fbm1(p + 0.2, 90.0) - 0.5) * 0.03));`,
  },
  wood: {
    planks: B.wood,
    old: B.wood + ' col *= vec3(0.72, 0.68, 0.64); col = mix(col, vec3(lum(col)) * 0.95, 0.4); height += fbm1(p, 48.0) * 0.14;',
    pale: B.wood + ' col = mix(col, vec3(lum(col)) * vec3(1.4, 1.22, 0.95) + vec3(0.14, 0.12, 0.08), 0.75);',
    deck: `float rows = 28.0, row = floor(p.y * rows), fy = fract(p.y * rows), tone = h(vec2(row, 1.0), vec2(rows, 4.0)), grain = fbm(vec2(p.x + tone, p.y), vec2(4.0, 160.0));
      col = mix(vec3(0.2, 0.135, 0.075), vec3(0.37, 0.27, 0.16), tone * 0.45 + grain * 0.6); float caulk = smoothstep(0.0, 0.05, min(fy, 1.0 - fy)); col *= 0.06 + 0.94 * caulk; height = caulk * 0.55 + grain * 0.08;`,
    logs: `float rows = 8.0, row = floor(p.y * rows), fy = fract(p.y * rows), tone = h(vec2(row, 2.0), vec2(rows, 4.0)), round_ = sqrt(max(0.0, 1.0 - pow(fy * 2.0 - 1.0, 2.0))), ring = fbm(vec2(p.x + tone, p.y), vec2(10.0, 200.0)), split = smoothstep(0.012, 0.0, abs(fbm(vec2(p.x + tone, p.y), vec2(6.0, 40.0)) - 0.5)) * smoothstep(0.1, 0.4, round_);
      col = mix(vec3(0.15, 0.09, 0.05), vec3(0.34, 0.23, 0.13), tone * 0.4 + ring * 0.65) * (0.2 + 0.92 * round_) * (1.0 - 0.6 * split); height = round_ * 1.0 + ring * 0.14 - split * 0.12;`,
    parquet: `vec2 q = p * 8.0, id = floor(q), f_ = fract(q); id = mod(id, 8.0); float turn = mod(id.x + id.y, 2.0), tone = h(id, vec2(8.0)), strip = fract((turn > 0.5 ? f_.x : f_.y) * 4.0), grain = fbm(turn > 0.5 ? vec2(p.x, p.y + tone) : vec2(p.y, p.x + tone), vec2(64.0, 8.0));
      col = mix(vec3(0.23, 0.13, 0.065), vec3(0.42, 0.27, 0.13), tone * 0.45 + grain * 0.55); float gap = smoothstep(0.0, 0.03, min(strip, 1.0 - strip)) * smoothstep(0.0, 0.008, min(min(f_.x, 1.0 - f_.x), min(f_.y, 1.0 - f_.y))); col *= 0.35 + 0.65 * gap; height = gap * 0.3; gGloss = 0.35;`,
  },
  dirt: {
    earth: B.dirt,
    cracked: `vec2 w = p + (vec2(fbm1(p + 0.2, 16.0), fbm1(p + 0.6, 16.0)) - 0.5) * 0.09; vec3 v = vor(w, 26.0); float broad = 0.018 + 0.05 * fbm1(p, 8.0), crack = smoothstep(0.0, broad, v.y), low = fbm1(p, 120.0); height = crack * (0.46 + 0.2 * v.z) + fbm1(p, 64.0) * 0.14; col = mix(vec3(0.3, 0.23, 0.15), vec3(0.47, 0.38, 0.26), v.z * 0.4 + fbm1(p, 30.0) * 0.65) * (0.82 + 0.34 * low); col = mix(vec3(0.05, 0.035, 0.025), col, crack);`,
    forest: `float big = fbm1(p, 5.0), mid = fbm1(p + 0.3, 30.0), low = fbm1(p + 0.6, 140.0); col = mix(vec3(0.1, 0.07, 0.045), vec3(0.24, 0.17, 0.105), big * 0.5 + mid * 0.6) * (0.82 + 0.34 * low); height = big * 0.4 + mid * 0.3;
      float twig = smoothstep(0.006, 0.0, abs(fbm1(p + 0.2, 9.0) - 0.5)) * smoothstep(0.42, 0.56, fbm1(p + 0.8, 11.0)); col = mix(col, vec3(0.12, 0.085, 0.055), twig * 0.9); leaves(p, 40.0, 5.0, 0.3, col, height, 0.5); leaves(p + 0.33, 52.0, 23.0, 0.18, col, height, 0.62); col *= 0.92;`,
    road: `float wob = (fbm1(p, 4.0) - 0.5) * 0.09, x = fract((p.x + wob) * 2.0), rut = smoothstep(0.07, 0.02, abs(x - 0.32)) + smoothstep(0.07, 0.02, abs(x - 0.68)), big = fbm1(p, 7.0), mid = fbm1(p + 0.3, 34.0), low = fbm1(p + 0.6, 140.0); height = (1.0 - rut) * 0.52 + big * 0.24 + mid * 0.2 + low * 0.08;
      col = mix(vec3(0.24, 0.18, 0.12), vec3(0.4, 0.32, 0.21), big * 0.45 + mid * 0.5) * (1.0 - rut * 0.26) * (0.84 + 0.32 * low); gGloss = 0.0 * (0.4 + rut);
      vec3 v = vor(p + (vec2(fbm1(p, 44.0), fbm1(p + 0.5, 44.0)) - 0.5) * 0.02, 40.0); float stone = step(0.88, v.z) * smoothstep(0.17, 0.14, v.x) * (1.0 - rut * 0.8); col = mix(col, mix(vec3(0.19, 0.17, 0.14), vec3(0.33, 0.3, 0.25), v.y * 2.0), stone); height += stone * 0.18;`,
    clay: B.dirt + ' col = mix(col, vec3(lum(col)) * vec3(1.65, 0.86, 0.56), 0.82);',
  },
  sand: {
    dunes: B.sand,
    beach: B.sand + ' col = mix(col, vec3(lum(col)) * vec3(1.16, 1.08, 0.92) + 0.09, 0.6); { vec3 sh = vor(p + 0.3, 46.0); float shell = step(0.9, sh.z) * smoothstep(0.17, 0.08, sh.x); col = mix(col, vec3(0.78, 0.74, 0.65), shell); height += shell * 0.1; }',
    red: B.sand + ' col = mix(col, vec3(lum(col)) * vec3(1.45, 0.84, 0.56), 0.85);',
    wet: B.sand + ' col *= vec3(0.56, 0.54, 0.52); gGloss = 0.5; height *= 0.5;',
    gravelly: B.sand + ' { vec3 v = vor(p + 0.2 + (vec2(fbm1(p, 70.0), fbm1(p + 0.5, 70.0)) - 0.5) * 0.009, 52.0); float size = 0.1 + 0.2 * fract(v.z * 9.1), stone = step(0.62, v.z) * smoothstep(size, size * 0.8, v.x); col = mix(col, mix(vec3(0.36, 0.31, 0.25), vec3(0.58, 0.53, 0.44), fract(v.z * 5.7)) * (0.8 + 0.4 * fbm1(p, 280.0)), stone); height += stone * (0.14 + 0.3 * smoothstep(size, 0.0, v.x)); }',
  },
  snow: {
    drifts: B.snow,
    powder: `float big = fbm1(p, 3.0), mid = fbm1(p + 0.4, 10.0); height = big * 0.45 + mid * 0.08; col = mix(vec3(0.8, 0.84, 0.9), vec3(0.96, 0.97, 0.99), smoothstep(0.3, 0.7, big)); gGloss = 0.04;`,
    packed: `float big = fbm1(p, 6.0), dents = fbm1(p + 0.4, 34.0), low = fbm1(p + 0.2, 120.0); height = dents * 0.3 + big * 0.2 + low * 0.05; col = mix(vec3(0.66, 0.7, 0.75), vec3(0.8, 0.83, 0.86), smoothstep(0.2, 0.8, dents * 0.6 + big * 0.4)) * (0.95 + 0.08 * low); gGloss = 0.1;`,
    dirty: `float big = fbm1(p, 5.0), mid = fbm1(p + 0.4, 22.0), low = fbm1(p + 0.2, 120.0), grime = smoothstep(0.38, 0.78, fbm1(p + 0.7, 12.0) + (mid - 0.5) * 0.3 + (low - 0.5) * 0.24); height = big * 0.6 + mid * 0.24; col = mix(mix(vec3(0.62, 0.65, 0.7), vec3(0.84, 0.86, 0.88), big), vec3(0.36, 0.32, 0.27) * (0.75 + 0.5 * low), grime * 0.56);`,
    crust: `float big = fbm1(p, 4.0), hair = veins(p + 0.3, 11.0, 0.009); height = big * 0.3 - hair * 0.1 + fbm1(p, 80.0) * 0.05; col = mix(vec3(0.62, 0.7, 0.78), vec3(0.87, 0.91, 0.95), big * 0.7 + fbm1(p, 30.0) * 0.3); col = mix(col, vec3(0.42, 0.52, 0.6), hair * 0.55); gGloss = 0.6;`,
  },
  water: {
    deep: B.water,
    shallow: `float big = fbm1(p, 4.0), mid = fbm1(p + 0.3, 20.0), ripple = sin((p.y + (mid - 0.5) * 0.08) * 6.28318 * 30.0) * 0.5 + 0.5; col = mix(vec3(0.17, 0.29, 0.26), vec3(0.32, 0.4, 0.31), smoothstep(0.3, 0.7, big)); col = mix(col, vec3(0.39, 0.36, 0.26), smoothstep(0.54, 0.74, fbm1(p + 0.5, 12.0)) * 0.6); height = ripple * 0.03 + mid * 0.04; gGloss = 0.4;`,
    swamp: `float big = fbm1(p, 4.0), mid = fbm1(p + 0.3, 18.0), drift = smoothstep(0.42, 0.66, fbm1(p + 0.6, 7.0)); vec3 d = vor(p, 90.0); float weed = smoothstep(0.34, 0.2, d.x) * step(0.42, d.z) * drift; col = mix(vec3(0.045, 0.06, 0.03), vec3(0.11, 0.12, 0.055), big) * (0.9 + 0.2 * mid); col = mix(col, mix(vec3(0.13, 0.19, 0.05), vec3(0.28, 0.33, 0.09), d.z), weed); height = weed * 0.14 + mid * 0.03; gGloss = 0.32 * (1.0 - weed);`,
    sea: `float big = fbm1(p, 3.0), mid = fbm1(p + 0.3, 12.0), swell = 1.0 - abs(fbm1(p + 0.5, 6.0) - 0.5) * 2.0, chop = fbm1(p + 0.7, 36.0), caps = smoothstep(0.76, 0.86, fbm1(p + 0.7, 70.0) + (swell - 0.5) * 0.3); col = mix(vec3(0.025, 0.11, 0.19), vec3(0.09, 0.27, 0.34), big * 0.6 + swell * 0.25 + mid * 0.25); col += vec3(0.3, 0.34, 0.34) * caps * 0.16; height = pow(swell, 3.0) * 0.32 + mid * 0.09 + chop * 0.1; gGloss = 0.6;`,
    dark: `float big = fbm1(p, 4.0); col = mix(vec3(0.012, 0.02, 0.026), vec3(0.04, 0.06, 0.07), big); height = big * 0.05; gGloss = 0.5;`,
  },
  ice: {
    clear: B.ice,
    milky: `float big = fbm1(p, 4.0), mid = fbm1(p + 0.4, 20.0); col = mix(vec3(0.56, 0.65, 0.7), vec3(0.8, 0.85, 0.87), big * 0.7 + mid * 0.35); col += vec3(0.06) * veins(p + 0.2, 8.0, 0.012); height = big * 0.1; gGloss = 0.4;`,
    black: `float big = fbm1(p, 4.0); col = mix(vec3(0.03, 0.05, 0.065), vec3(0.08, 0.12, 0.15), big); col += vec3(0.18, 0.22, 0.25) * (veins(p + 0.2, 6.0, 0.006) + 0.5 * veins(p + 0.6, 16.0, 0.004)); height = big * 0.05; gGloss = 0.85;`,
    sheets: `vec3 v = vor(p + (vec2(fbm1(p + 0.1, 20.0), fbm1(p + 0.5, 20.0)) - 0.5) * 0.09, 8.0); float split = smoothstep(0.0, 0.016, v.y); col = mix(vec3(0.25, 0.38, 0.45), vec3(0.54, 0.67, 0.73), v.z * 0.5 + fbm1(p, 12.0) * 0.5); col = mix(vec3(0.05, 0.09, 0.12), col, split); col += vec3(0.08) * veins(p + 0.3, 16.0, 0.008); height = split * (0.3 + 0.3 * v.z); gGloss = 0.55;`,
    dusted: B.ice + ' { float dust = smoothstep(0.42, 0.66, fbm1(p + 0.3, 7.0) + (fbm1(p, 64.0) - 0.5) * 0.3); col = mix(col, vec3(0.86, 0.89, 0.93), dust * 0.85); height += dust * 0.14; gGloss *= 1.0 - dust; }',
  },
  mud: {
    wet: B.mud,
    drying: `vec2 w = p + (vec2(fbm1(p + 0.2, 14.0), fbm1(p + 0.6, 14.0)) - 0.5) * 0.09; vec3 v = vor(w, 24.0); float dry = smoothstep(0.38, 0.58, fbm1(p + 0.2, 6.0)), crack = mix(1.0, smoothstep(0.0, 0.05, v.y), dry); height = crack * (0.4 + 0.25 * v.z * dry) + fbm1(p, 64.0) * 0.12; col = mix(vec3(0.13, 0.095, 0.06), vec3(0.32, 0.25, 0.16), dry * (0.5 + 0.5 * v.z)) * (0.82 + 0.36 * fbm1(p, 120.0)); col *= 0.16 + 0.84 * crack; gGloss = 0.5 * (1.0 - dry);`,
    swamp: B.mud + ' { float slime = smoothstep(0.48, 0.68, fbm1(p + 0.6, 9.0) + (fbm1(p, 70.0) - 0.5) * 0.24); col = mix(col * vec3(0.8, 0.92, 0.72), mix(vec3(0.09, 0.13, 0.03), vec3(0.2, 0.24, 0.06), fbm1(p, 128.0)), slime * 0.82); }',
    red: B.mud + ' col = mix(col, vec3(lum(col)) * vec3(1.9, 0.85, 0.52), 0.88);',
    rutted: `float wob = (fbm1(p, 4.0) - 0.5) * 0.09, x = fract((p.x + wob) * 2.0), rut = min(1.0, smoothstep(0.075, 0.03, abs(x - 0.32)) + smoothstep(0.075, 0.03, abs(x - 0.68))), big = fbm1(p, 7.0), mid = fbm1(p + 0.3, 34.0), low = fbm1(p + 0.6, 140.0);
      height = (1.0 - rut) * 0.5 + big * 0.26 + mid * 0.24 + low * 0.1; col = mix(vec3(0.13, 0.095, 0.06), vec3(0.32, 0.24, 0.15), big * 0.45 + mid * 0.55) * (0.82 + 0.36 * low);
      float water = rut * smoothstep(0.3, 0.5, fbm1(p + 0.8, 10.0)); col = mix(col * (1.0 - rut * 0.22), vec3(0.13, 0.145, 0.135), water * 0.85); height = mix(height, 0.08, water); gGloss = mix(0.5, 1.0, water);`,
  },
  pebbles: {
    river: B.pebbles,
    gravel: 'stones(p, 66.0, vec3(0.22, 0.21, 0.19), vec3(0.49, 0.47, 0.43), col, height);',
    beach: 'stones(p, 19.0, vec3(0.44, 0.41, 0.36), vec3(0.7, 0.67, 0.6), col, height); gGloss = 0.14;',
    slate: `vec3 v = vor(p + (fbm1(p, 30.0) - 0.5) * 0.015, 36.0); float top = smoothstep(0.0, 0.05, v.y); height = top * (0.35 + 0.65 * v.z); col = mix(vec3(0.075, 0.085, 0.1), vec3(0.2, 0.22, 0.25), v.z) * (0.85 + 0.3 * fbm1(p, 160.0)) * (0.2 + 0.8 * top); gGloss = 0.3;`,
    mixed: `stones(p, 28.0, vec3(0.3, 0.28, 0.25), vec3(0.54, 0.5, 0.45), col, height); float kind = fract(gStoneTone * 7.3); if (kind < 0.22) col *= vec3(1.16, 0.92, 0.76); else if (kind < 0.42) col *= vec3(0.78, 0.84, 0.92); else if (kind < 0.55) col *= vec3(0.56, 0.56, 0.56);`,
  },
  glass: {
    leaded: B.glass,
    panes: `vec2 f_ = fract(p * 2.0); float edge = min(min(f_.x, 1.0 - f_.x), min(f_.y, 1.0 - f_.y)), frame = smoothstep(0.012, 0.015, edge), streak = smoothstep(0.7, 0.92, n(vec2((p.x + p.y) * 6.0, 0.5), vec2(12.0, 2.0))); float ream = sin((p.y + fbm1(p, 4.0) * 0.14) * 6.28318 * 22.0) * 0.5 + 0.5; col = mix(vec3(0.1, 0.17, 0.19), vec3(0.17, 0.26, 0.28), fbm1(p, 5.0)) * (0.98 + 0.04 * ream) + 0.04 * streak; col = mix(vec3(0.05, 0.05, 0.05) * (0.8 + 0.5 * fbm1(p, 200.0)), col, frame); height = frame * 0.4 + ream * frame * 0.002; gGloss = 0.9 * frame; vec2 pane = floor(p * 2.0); gTilt = (h2(pane, vec2(2.0)) - 0.5) * 0.6 * frame;`,
    frosted: `vec2 f_ = fract(p * 2.0); float edge = min(min(f_.x, 1.0 - f_.x), min(f_.y, 1.0 - f_.y)), lead = smoothstep(0.005, 0.007, edge), etch = fbm1(p + 0.3, 320.0), fern = veins(p + 0.5, 24.0, 0.018); col = mix(vec3(0.54, 0.6, 0.63), vec3(0.72, 0.77, 0.79), etch * 0.75 + fbm1(p, 12.0) * 0.25) + vec3(0.1) * fern; col = mix(vec3(0.07), col, lead); height = lead * 0.4 + etch * 0.1 + fern * 0.04; gGloss = 0.15;`,
    mosaic: `// Flat pieces of streaky old glass in thin lead: its colour varies by the streaks in it, not by any rounding, and each piece tilts a little as a whole, so the light catches some and not others.
      vec2 w = p + (vec2(fbm1(p + 0.2, 12.0), fbm1(p + 0.6, 12.0)) - 0.5) * 0.025, q = w * 14.0, c0 = floor(q), f_ = fract(q), toNear = vec2(0.0), cell = vec2(0.0); float best = 8.0, d = 8.0;
      for (float j = -1.0; j <= 1.0; j += 1.0) for (float i = -1.0; i <= 1.0; i += 1.0) { vec2 g = vec2(i, j), r = g + 0.2 + 0.6 * h2(c0 + g, vec2(14.0)) - f_; float l = dot(r, r); if (l < best) { best = l; toNear = r; cell = g; } }
      for (float j = -2.0; j <= 2.0; j += 1.0) for (float i = -2.0; i <= 2.0; i += 1.0) { vec2 g = cell + vec2(i, j), r = g + 0.2 + 0.6 * h2(c0 + g, vec2(14.0)) - f_, gap = r - toNear; if (dot(gap, gap) > 0.00001) d = min(d, dot(0.5 * (toNear + r), normalize(gap))); }
      float id = h(c0 + cell + 3.0, vec2(14.0)), kind = fract(id * 5.7), came = smoothstep(0.024, 0.032, d);
      vec3 hue = kind < 0.2 ? vec3(0.42, 0.03, 0.06) : kind < 0.4 ? vec3(0.03, 0.11, 0.4) : kind < 0.6 ? vec3(0.4, 0.22, 0.03) : kind < 0.78 ? vec3(0.03, 0.27, 0.15) : kind < 0.92 ? vec3(0.2, 0.06, 0.34) : vec3(0.42, 0.46, 0.38);
      vec2 way = id < 0.25 ? vec2(1.0, 1.0) : id < 0.5 ? vec2(1.0, -1.0) : id < 0.75 ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
      float along = dot(p, way), streak = n(vec2(along * 30.0 + fbm1(p + id, 8.0) * 5.0, id * 7.0), vec2(30.0, 8.0)) * 0.65 + n(vec2(along * 90.0 + fbm1(p + id, 8.0) * 9.0, id * 3.0), vec2(90.0, 8.0)) * 0.35;
      col = hue * (0.72 + 0.62 * streak) * (0.85 + 0.3 * fract(id * 13.0));
      col += vec3(0.1) * smoothstep(0.93, 0.97, n(p * 260.0 + id * 9.0, vec2(260.0)));
      col = mix(vec3(0.04, 0.04, 0.045) * (0.8 + 0.5 * fbm1(p, 200.0)), col, came);
      height = (1.0 - came) * 0.06; gGloss = mix(0.2, 1.0, came);
      gTilt = ((vec2(fract(id * 7.31), fract(id * 3.77)) - 0.5) * 0.45 + (vec2(fbm1(p + id, 70.0), fbm1(p + id + 0.4, 70.0)) - 0.5) * 0.12) * came;`,
    obsidian: `float big = fbm1(p, 4.0), ridge = veins(p + 0.3, 7.0, 0.02); vec3 chip = vor(p + (big - 0.5) * 0.04, 6.0); float conch = pow(sin(chip.x * 40.0 + big * 16.0) * 0.5 + 0.5, 4.0) * smoothstep(0.34, 0.1, chip.y) * smoothstep(0.0, 0.03, chip.y) * smoothstep(0.42, 0.6, fbm1(p + 0.2, 5.0)); col = mix(vec3(0.01, 0.01, 0.015), vec3(0.05, 0.05, 0.065), big) + vec3(0.07, 0.07, 0.09) * ridge + vec3(0.016, 0.016, 0.022) * conch; col *= 0.75 + 0.5 * smoothstep(0.0, 0.012, chip.y); height = big * 0.2 + ridge * 0.1 + conch * 0.05 + smoothstep(0.0, 0.03, chip.y) * 0.12; gGloss = 1.0;`,
  },
  metal: {
    plates: B.metal,
    grate: `vec2 f_ = fract(p * 40.0); float hole = min(min(f_.x, 1.0 - f_.x), min(f_.y, 1.0 - f_.y)), bar = smoothstep(0.2, 0.215, 0.5 - hole); col = mix(vec3(0.012), mix(vec3(0.17, 0.18, 0.18), vec3(0.31, 0.31, 0.31), fbm1(p, 40.0)), bar); col = mix(col, col * vec3(1.2, 0.72, 0.5), smoothstep(0.56, 0.74, fbm1(p + 0.4, 12.0)) * 0.7); height = bar * 0.7; gGloss = 0.35 * bar;`,
    rusted: B.metal + ' { float scale = fbm1(p, 220.0), rust = smoothstep(0.44, 0.49, fbm1(p + 0.4, 10.0) + (fbm1(p, 80.0) - 0.5) * 0.42); col = mix(col, mix(mix(vec3(0.13, 0.06, 0.03), vec3(0.42, 0.21, 0.08), fbm1(p, 60.0)), vec3(0.47, 0.25, 0.1), smoothstep(0.3, 0.8, fbm1(p + 0.6, 420.0)) * 0.7) * (0.8 + 0.4 * scale), rust * 0.95); gGloss *= 1.0 - rust; height += rust * (0.06 + scale * 0.18); }',
    tread: `vec2 q = p * 16.0; vec2 c1 = fract(q) - 0.5; float turn = mod(floor(q.x) + floor(q.y), 2.0), a = turn > 0.5 ? 0.785 : -0.785; vec2 r = vec2(cos(a) * c1.x - sin(a) * c1.y, sin(a) * c1.x + cos(a) * c1.y); float bump = smoothstep(0.085, 0.07, length(r * vec2(0.42, 2.0))); col = mix(vec3(0.21, 0.22, 0.23), vec3(0.31, 0.32, 0.34), fbm1(p, 32.0)); col += bump * 0.05; height = bump * 0.8; gGloss = 0.45;`,
    copper: B.metal + ' col = mix(col, vec3(lum(col)) * vec3(1.72, 1.1, 0.68), 0.8); { float crust = fbm1(p, 240.0), green = smoothstep(0.52, 0.57, fbm1(p + 0.4, 10.0) + (fbm1(p, 70.0) - 0.5) * 0.4); col = mix(col, mix(vec3(0.12, 0.27, 0.22), vec3(0.24, 0.42, 0.35), smoothstep(0.3, 0.8, fbm1(p + 0.6, 420.0)) * 0.8) * (0.82 + 0.36 * fbm1(p, 60.0)), green * 0.85); height += green * crust * 0.1; gGloss *= 1.0 - green; }',
  },
});
// What each material has close up, over its pattern, in its height too so the light finds it. Grass has its blades and the water is the water engine's; laid stones have their own (stones).
const MICRO = Object.freeze({
  stone: '{ float g = fbm1(p + 1.7, 280.0), m = fbm1(p + 2.3, 36.0), pit = specks(p + 0.2, 260.0, 0.2, 0.2), fl = specks(p + 0.6, 400.0, 0.2, 0.22), hair = veins(p + 0.9, 22.0, 0.006); col *= (0.8 + 0.4 * g) * (0.88 + 0.24 * m) * (1.0 - 0.26 * pit) * (1.0 + 0.14 * fl) * (1.0 - 0.4 * hair); height += (g - 0.5) * 0.05 - pit * 0.03 - hair * 0.03; }',
  polished: '{ float g = fbm1(p + 1.7, 400.0), hair = veins(p + 0.9, 30.0, 0.004); col *= (0.97 + 0.06 * g) * (1.0 - 0.18 * hair); }',
  dirt: '{ float g = fbm1(p + 1.1, 240.0), clod = fbm1(p + 0.7, 64.0), c = specks(p + 0.3, 240.0, 0.28, 0.26), d = specks(p + 0.5, 420.0, 0.3, 0.26); col *= (0.7 + 0.6 * g) * (0.8 + 0.4 * clod) * (1.0 - 0.24 * c) * (1.0 + 0.2 * d); height += clod * 0.16 + (g - 0.5) * 0.12 - c * 0.05 + d * 0.05; }',
  sand: '{ float g = fbm1(p + 0.9, 500.0), dk = specks(p + 0.2, 420.0, 0.2, 0.3), lt = specks(p + 0.5, 360.0, 0.16, 0.3); col *= (0.86 + 0.28 * g) * (1.0 - 0.34 * dk) * (1.0 + 0.24 * lt); height += (g - 0.5) * 0.05; }',
  snow: '{ float g = fbm1(p + 0.4, 360.0), bent = fbm1(p + 0.6, 5.0) * 0.12, scour = fbm1(vec2(p.x * 0.8 - p.y * 0.6 + bent, p.x * 0.6 + p.y * 0.8) * vec2(1.0, 1.0), 44.0), crust = fbm1(p + 0.9, 110.0), glint = specks(p + 0.7, 300.0, 0.1, 0.2); col *= (0.94 + 0.1 * g) * (0.965 + 0.05 * smoothstep(0.35, 0.65, scour)) * (0.97 + 0.05 * crust); col += 0.16 * glint; height += scour * 0.1 + crust * 0.08 + (g - 0.5) * 0.06; }',
  mud: '{ float lump = fbm1(p + 0.3, 30.0), clot = fbm1(p + 0.5, 110.0), g = fbm1(p + 0.8, 300.0), fold = pow(1.0 - abs(fbm1(p + 0.6, 11.0) * 2.0 - 1.0), 14.0), bit = specks(p + 0.1, 110.0, 0.14, 0.24); col *= 1.3 * (0.66 + 0.68 * lump) * (0.78 + 0.44 * clot) * (0.86 + 0.28 * g) * (1.0 - 0.3 * fold); col = mix(col, vec3(0.26, 0.22, 0.12), bit * 0.45); height += lump * 0.7 + clot * 0.3 + (g - 0.5) * 0.12 - fold * 0.3; }',
  glass: '{ float sc = veins(p + 0.4, 18.0, 0.003), dust = fbm1(p + 0.2, 320.0), bub = specks(p + 0.6, 120.0, 0.05, 0.14); col += vec3(0.05, 0.06, 0.065) * sc + 0.035 * (dust - 0.5) + vec3(0.05) * bub; col *= 0.96 + 0.08 * fbm1(p + 0.1, 60.0); height += bub * 0.03; }',
  ice: '{ float bub = specks(p + 0.3, 220.0, 0.07, 0.22), fr = fbm1(p + 0.5, 300.0); col += vec3(0.1, 0.11, 0.12) * bub; col *= 0.96 + 0.08 * fr; height += (fr - 0.5) * 0.03; }',
  wood: '{ float pore = fbm(p + 0.3, vec2(14.0, 700.0)), dent = specks(p + 0.7, 160.0, 0.03, 0.2); col *= (0.84 + 0.32 * pore) * (1.0 - 0.2 * dent); height += (pore - 0.5) * 0.07; }',
  woodBlocks: '{ float pore = fbm1(p + 0.3, 500.0), dent = specks(p + 0.7, 160.0, 0.03, 0.2); col *= (0.9 + 0.2 * pore) * (1.0 - 0.2 * dent); height += (pore - 0.5) * 0.04; }',
  metal: '{ float g = fbm1(p + 0.6, 420.0), sc = veins(p + 0.5, 26.0, 0.004), dent = specks(p + 0.2, 120.0, 0.05, 0.2); col *= (0.9 + 0.2 * g) * (1.0 + 0.22 * sc) * (1.0 - 0.18 * dent); height += sc * 0.02 - dent * 0.03; }',
});
const microOf = (floor, style) => {
  if (floor === 'stone') return style === 'cobbles' ? '' : style === 'marble' ? MICRO.polished : MICRO.stone;
  if (floor === 'pebbles') return style === 'slate' ? MICRO.stone : '';
  if (floor === 'wood' && style === 'parquet') return MICRO.woodBlocks;
  if (floor === 'glass' && style === 'mosaic') return MICRO.polished;
  return Object.hasOwn(MICRO, floor) ? MICRO[floor] : '';
};
const TILE_HEAD = `precision highp float;
varying vec2 vWorld;
float gGloss;
vec2 gTilt; // how a whole piece leans, on what is laid in pieces
vec3 gBladeLow, gBladeHigh, gBladeDry;
float h(vec2 i, vec2 per){ i = mod(i, per); vec3 q = fract(vec3(i.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
vec2 h2(vec2 i, vec2 per){ return vec2(h(i, per), h(i + 41.0, per)); }
float n(vec2 p, vec2 per){ vec2 i = floor(p), f = p - i; f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h(i, per), h(i + vec2(1.0, 0.0), per), f.x), mix(h(i + vec2(0.0, 1.0), per), h(i + vec2(1.0, 1.0), per), f.x), f.y); }
float fbm(vec2 p, vec2 per){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * n(p * per + float(i) * vec2(7.0, 13.0), per); per *= 2.0; a *= 0.5; } return v; }
float fbm1(vec2 p, float per){ return fbm(p, vec2(per)); }
vec3 vor(vec2 p, float per){ vec2 q = p * per, c0 = floor(q), f = fract(q); float a = 8.0, b = 8.0, c = 0.0;
  for (float j = -1.0; j <= 1.0; j += 1.0) for (float i = -1.0; i <= 1.0; i += 1.0) { vec2 g = vec2(i, j), r = g + h2(c0 + g, vec2(per)) - f; float d = dot(r, r); if (d < a) { b = a; a = d; c = h(c0 + g + 3.0, vec2(per)); } else if (d < b) b = d; }
  return vec3(sqrt(a), sqrt(b) - sqrt(a), c); }
float seg(vec2 p, vec2 a, vec2 b){ vec2 pa = p - a, ba = b - a; return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0)); }
// Blades lying every which way, near upright, drawn over what is there; the height they reach.
void blades(vec2 p, float per, float seed, inout vec3 col, inout float height, float top){
  vec2 q = p * per, c0 = floor(q);
  for (float j = -1.0; j <= 1.0; j += 1.0) for (float i = -1.0; i <= 1.0; i += 1.0) {
    vec2 g = c0 + vec2(i, j), o = h2(g + seed, vec2(per)), base = g + o;
    float lean = (h(g + seed + 5.0, vec2(per)) - 0.5) * 1.5, len = 0.9 + 1.1 * h(g + seed + 9.0, vec2(per)), tone = h(g + seed + 17.0, vec2(per));
    vec2 tip = base + vec2(sin(lean), -cos(lean)) * len;
    float along = clamp(dot(q - base, tip - base) / dot(tip - base, tip - base), 0.0, 1.0), d = seg(q, base, tip), wide = 0.14 * (1.0 - along * 0.85);
    float blade = smoothstep(wide, wide * 0.45, d);
    if (blade > 0.0) {
      vec3 c = mix(gBladeLow, gBladeHigh, tone);
      if (tone > 0.86) c = mix(c, gBladeDry, 0.7);
      c *= 0.65 + 0.55 * along;
      col = mix(col, c, blade); height = mix(height, top + along * 0.25, blade);
    }
  }
}
// Rounded stones between dark gaps.
float gStoneTone;
void stones(vec2 p, float per, vec3 low, vec3 high, inout vec3 col, inout float height){
  vec2 q = p * per, c0 = floor(q), pers = vec2(per); float near = 9.0, second = 9.0, tone = 0.5;
  for (float j = -2.0; j <= 2.0; j += 1.0) for (float i = -2.0; i <= 2.0; i += 1.0) {
    vec2 g = c0 + vec2(i, j), d = q - (g + 0.5 + (h2(g, pers) - 0.5) * 0.76);
    float a = h(g + 5.0, pers) * 6.283, co = cos(a), si = sin(a), squash = 0.7 + 0.3 * h(g + 7.0, pers), size = 0.56 + 0.2 * h(g + 3.0, pers);
    d = vec2(co * d.x - si * d.y, (si * d.x + co * d.y) / squash);
    float turn = atan(d.y, d.x), seed = h(g + 9.0, pers) * 6.283, u = length(d) / (size * (1.0 + 0.1 * sin(turn * 3.0 + seed) + 0.05 * sin(turn * 5.0 + seed * 2.0)));
    if (u < near) { second = near; near = u; tone = h(g + 11.0, pers); } else if (u < second) second = u;
  }
  // Where two stones meet they round down into a joint, smoothly: a sudden step in the height breaks up under the light into a twisted line.
  float joint = smoothstep(0.0, 0.2, second - near), seen = smoothstep(1.0, 0.9, near) * smoothstep(0.0, 0.06, second - near), dome = sqrt(max(0.0, 1.0 - near * near)) * (0.35 + 0.65 * joint);
  vec3 soil = mix(vec3(0.07, 0.058, 0.046), vec3(0.15, 0.125, 0.1), fbm1(p + 0.4, 150.0));
  // The stone's own face, down to what shows close up: mottling, fine grain, and small dark pits and pale flecks.
  float mottle = fbm1(p + tone, 90.0), grain = fbm1(p + tone * 3.0, 340.0), pits = smoothstep(0.66, 0.78, fbm1(p + 7.0, 460.0)), flecks = smoothstep(0.7, 0.8, fbm1(p + 11.0, 520.0));
  vec3 stone = mix(low, high, tone) * (0.72 + 0.34 * mottle + 0.26 * grain) * (0.62 + 0.5 * dome) * (1.0 - 0.32 * pits) * (1.0 + 0.2 * flecks);
  col = mix(soil, stone, seen); height = fbm1(p, 120.0) * 0.08 + seen * (0.2 + 0.75 * dome + 0.05 * grain - 0.05 * pits); gStoneTone = tone;
}
// Small marks scattered about: keep says how many of them, r how much of its cell each may fill.
float specks(vec2 p, float per, float keep, float r){ vec3 v = vor(p + (vec2(fbm1(p + 0.31, per * 0.5), fbm1(p + 0.77, per * 0.5)) - 0.5) * 2.4 / per, per); float size = r * (0.35 + 0.65 * fract(v.z * 17.3)); return step(1.0 - keep, v.z) * smoothstep(size, size * 0.55, v.x) * smoothstep(0.42, 0.6, fbm1(p + 3.7, per * 0.07)); }
// Thin lines running through a surface.
float veins(vec2 p, float per, float thin){
  vec2 wander = (vec2(fbm1(p + 0.13, per * 2.0), fbm1(p + 0.57, per * 2.0)) - 0.5) * 1.3 / per;
  vec3 v = vor(p + wander, per);
  return smoothstep(thin * 1.6, 0.0, v.y) * smoothstep(0.38, 0.54, fbm1(p + 0.71, per * 2.0));
}
float lum(vec3 c){ return dot(c, vec3(0.3, 0.55, 0.15)); }
// Fallen leaves lying any way, each pointed with a midrib, some curled darker; drawn over what is there.
void leaves(vec2 p, float per, float seed, float keep, inout vec3 col, inout float height, float top){
  vec2 q = p * per, c0 = floor(q);
  for (float j = -1.0; j <= 1.0; j += 1.0) for (float i = -1.0; i <= 1.0; i += 1.0) {
    vec2 g = c0 + vec2(i, j);
    if (h(g + seed + 2.0, vec2(per)) > keep) continue;
    vec2 d = q - (g + h2(g + seed, vec2(per)));
    float a = h(g + seed + 5.0, vec2(per)) * 6.283, co = cos(a), si = sin(a); d = vec2(co * d.x - si * d.y, si * d.x + co * d.y);
    float len = 0.34 + 0.3 * h(g + seed + 7.0, vec2(per)), along = d.x / len;
    if (abs(along) >= 1.0) continue;
    float half_ = len * 0.42 * pow(1.0 - along * along, 0.8), body = smoothstep(half_, half_ * 0.72, abs(d.y));
    if (body <= 0.0) continue;
    float kind = h(g + seed + 9.0, vec2(per));
    vec3 tone = kind < 0.35 ? vec3(0.37, 0.2, 0.08) : kind < 0.65 ? vec3(0.47, 0.32, 0.11) : kind < 0.85 ? vec3(0.27, 0.15, 0.07) : vec3(0.42, 0.37, 0.14);
    tone *= (0.72 + 0.4 * (d.y / max(0.01, half_)) * 0.5 + 0.2) * (1.0 - 0.45 * smoothstep(0.03, 0.0, abs(d.y)));
    col = mix(col, tone, body); height = mix(height, top + 0.1 * (1.0 - abs(along)), body);
  }
}
// Clover: three round leaflets on one stalk, a pale chevron on each, here and there a small pale flower.
void clover(vec2 p, float per, float seed, inout vec3 col, inout float height, float top){
  vec2 q = p * per, c0 = floor(q);
  for (float j = -1.0; j <= 1.0; j += 1.0) for (float i = -1.0; i <= 1.0; i += 1.0) {
    vec2 g = c0 + vec2(i, j);
    if (h(g + seed + 1.0, vec2(per)) > 0.82) continue;
    vec2 c = g + 0.5 + (h2(g + seed, vec2(per)) - 0.5) * 0.7, d = q - c;
    float a = h(g + seed + 4.0, vec2(per)) * 6.283, size = 0.17 + 0.09 * h(g + seed + 6.0, vec2(per)), tone = h(g + seed + 8.0, vec2(per));
    for (float l = 0.0; l < 2.5; l += 1.0) {
      float t = a + l * 2.094; vec2 way = vec2(cos(t), sin(t)), to = d - way * size * 0.95;
      float r = length(to), leaf = smoothstep(size, size * 0.8, r);
      if (leaf <= 0.0) continue;
      float chevron = smoothstep(0.1, 0.0, abs(dot(to, way) / size + 0.28 - abs(dot(to, vec2(-way.y, way.x))) / size * 0.6)) * 0.5;
      vec3 c2 = mix(vec3(0.13, 0.24, 0.08), vec3(0.25, 0.39, 0.14), tone) * (0.72 + 0.5 * (1.0 - r / size));
      col = mix(col, c2 + vec3(0.1, 0.13, 0.08) * chevron, leaf); height = mix(height, top + (1.0 - r / size) * 0.18, leaf);
    }
    if (tone > 0.93) { float bloom = smoothstep(size * 0.9, size * 0.5, length(d)); col = mix(col, vec3(0.68, 0.64, 0.58) * (0.8 + 0.4 * fbm1(p, 200.0)), bloom); height = mix(height, top + 0.3, bloom); }
  }
}
`;
const styleShift = (floor, style) => { let n = 7; for (const ch of `${floor}/${style}`) n = (n * 31 + ch.charCodeAt(0)) % 9973; return `vec2(${(n / 9973).toFixed(4)}, ${(((n * 7) % 9973) / 9973).toFixed(4)})`; };
const tileFrag = (floor, style, asSurface = false) => `${TILE_HEAD}
vec4 surface(vec2 p){
  gGloss = 0.0; gTilt = vec2(0.0); gBladeLow = vec3(0.2, 0.31, 0.1); gBladeHigh = vec3(0.37, 0.47, 0.15); gBladeDry = vec3(0.38, 0.34, 0.14);
  vec3 col = vec3(0.3); float height = 0.0;
  ${TILE_STYLES[floor]?.[style] ?? Object.values(TILE_STYLES[floor] ?? TILE_STYLES.stone)[0]}
  ${microOf(floor, style)}
  return vec4(col, height);
}
void main(){
  vec2 p = vWorld / 1024.0 + ${styleShift(floor, style)}; float e = 1.0 / 1024.0;
  vec4 s = surface(p); float gloss = gGloss; vec2 tilt = gTilt;
  float dx = surface(p + vec2(e, 0.0)).a - surface(p - vec2(e, 0.0)).a, dy = surface(p + vec2(0.0, e)).a - surface(p - vec2(0.0, e)).a;
  vec3 normal = normalize(vec3(-dx * ${asSurface ? '1.6' : '3.6'}, -dy * ${asSurface ? '1.6' : '3.6'}, 1.0)), light = normalize(vec3(-0.5, -0.6, 0.72));
  float diffuse = max(0.0, dot(normal, light)), shine = pow(max(0.0, dot(reflect(-light, normal), vec3(0.0, 0.0, 1.0))), 28.0);
  gl_FragColor = ${asSurface ? 'vec4(clamp(normal.xy + tilt, -1.0, 1.0) * 0.5 + 0.5, gloss, 1.0)' : 'vec4(s.rgb * (0.63 + 0.52 * diffuse) + vec3(0.72, 0.78, 0.85) * shine * gloss * 0.1, 1.0)'};
}`;


const MOST_FLOOR_LIGHTS = 6;
// A floor on a region: its tile, sampled twice so it does not read as a repeat, broken up by a much larger sampling.
const SHOW_FRAG = `precision highp float;
varying vec2 vWorld;
uniform sampler2D uTile;
uniform float uTileSize, uGrid, uAlpha, uSway, uTime, uWind; // the ground itself never moves: blades do (BLADE_VERT)
uniform vec2 uWindDir, uToSun;
uniform vec3 uSunColor;
uniform vec2 uGlare; // where on this floor the sun or moon shines back (glareAt)
uniform sampler2D uShape; // the tile's surface: which way it leans, how glossy
uniform vec4 uLights[${MOST_FLOOR_LIGHTS}]; // torches and lanterns near the view: x, y, reach, strength
uniform vec3 uLightColors[${MOST_FLOOR_LIGHTS}];
uniform float uLightCount, uWet, uRipple; // how soaked by the rain; how much the wind moves its face
uniform float uSun, uTwo, uGloss, uSharp, uGlitter, uLift, uRelief; // the sky, and how this surface answers it (surfaceShine)
${NOISE}
${EDGE}
${SUN_REACH}
void main(){
  vec2 uv = vWorld / uTileSize;
  float gust = 0.0;
  if (uSway > 0.5) {
    // A gust's light passing over the ground, the way the wind blows.
    vec2 across = vec2(-uWindDir.y, uWindDir.x);
    float along = dot(vWorld, uWindDir) / uGrid, side = dot(vWorld, across) / uGrid, pace = 0.7 + 2.2 * uWind;
    gust = sin(along * 0.9 - uTime * pace + sin(side * 0.43 + uTime * 0.13) * 1.6) * 0.5 + 0.5; gust *= gust;
    gust *= 0.14 + 0.86 * uWind;
  }
  float wide = fbm(vWorld / (uGrid * 6.0));
  vec2 turned = vec2(uv.y, -uv.x) * 0.93 + 0.37;
  vec3 a = texture2D(uTile, uv).rgb, b = texture2D(uTile, turned).rgb;
  float blend = uTwo > 0.5 ? smoothstep(0.44, 0.56, wide) : 0.0; // what is laid in pieces is not blended, or they double up
  vec3 col = mix(a, b, blend) * (0.84 + 0.32 * smoothstep(0.25, 0.75, fbm(vWorld / (uGrid * 7.0) + 9.0)));
  col *= 1.0 + gust * 0.05;
  if ((uSun > 0.01 || uLightCount > 0.5) && uGloss + uGlitter + uLift + uRelief > 0.0) {
    // Which way the surface leans here. What leans toward the sun or moon catches it; light comes through or off it as strong as the sky.
    vec4 sa = texture2D(uShape, uv), sb = texture2D(uShape, turned);
    vec2 na = sa.xy * 2.0 - 1.0, nb = sb.xy * 2.0 - 1.0, lean = mix(na, vec2(-nb.y, nb.x), blend);
    float gloss = mix(sa.z, sb.z, blend);
    vec2 bump = lean;
    float sun = uSun * sunReach(vWorld);
    col *= (1.0 + clamp(dot(lean, uToSun) * 2.2, -0.45, 0.45) * uRelief * sun) * (1.0 + uLift * sun * (0.5 + 0.5 * gloss));
    // A highlight only on what leans so as to send the sun or moon back up, with a soft glow round it. It goes where the light goes.
    vec2 g = vWorld / (uGrid * 1.7);
    lean += (vec2(silk(g), silk(g + 31.0)) - 0.5) * 0.2;
    // Water: wind runs over its face, so its glints dance, the harder the wind the more.
    if (uRipple > 0.0) { vec2 run = vWorld / (uGrid * 0.35); float t = uTime * (0.25 + 1.2 * uWind); lean += (vec2(noise(run + t) + noise(run * 2.7 - t) * 0.5, noise(run + 31.0 - t * 0.8) + noise(run * 2.7 + 17.0 + t) * 0.5) / 1.5 - 0.5) * (0.06 + 0.2 * uWind) * uRipple; }
    // Rain: soaked ground goes darker, with a film of water that shines, more in the low places.
    float film = uWet > 0.0 ? uWet * (0.25 + 0.75 * smoothstep(0.4, 0.62, noise(vWorld / (uGrid * 0.8)))) : 0.0;
    col *= 1.0 - 0.22 * uWet;
    float face = normalize(vec3(lean - (vWorld - uGlare) / (uGrid * 6.25), 1.0)).z, shine = pow(face, uSharp) + 0.03 * pow(face, uSharp * 0.12);
    vec2 glint = vWorld / (uGrid * 0.05) + uToSun * 3.0 + uGlare / (uGrid * 2.0); float spark = hash(floor(glint) + 7.3), glitter = uGlitter > 0.0 ? step(0.965, hash(floor(glint))) * smoothstep(0.05 + 0.15 * spark, 0.0, length(fract(glint) - 0.5)) * (0.12 + 0.88 * spark * spark * spark) * smoothstep(0.42, 0.64, silk(vWorld / (uGrid * 0.7))) * smoothstep(0.7, 1.0, inside(vWorld, uGrid)) : 0.0;
    col += uSunColor * (shine * uGloss * gloss * 1.1 + film * pow(face, 90.0) * 0.45 + glitter * uGlitter * 0.6) * sun;
    // A flame beside it: bumps lit on the side facing it, light through glass, a highlight toward it and points of glitter.
    for (int i = 0; i < ${MOST_FLOOR_LIGHTS}; i++) {
      if (float(i) >= uLightCount) break;
      vec2 off = uLights[i].xy - vWorld; float far = length(off) / uLights[i].z;
      if (far >= 1.0) continue;
      float near = (1.0 - far) * (1.0 - far) * uLights[i].w;
      vec2 toward = off / max(length(off), 1.0);
      col *= (1.0 + clamp(dot(bump, toward) * 2.2, -0.45, 0.45) * uRelief * near) * (1.0 + uLift * near);
      float faces = normalize(vec3(lean - toward * min(0.5, length(off) / uGrid * 0.35), 1.0)).z;
      col += uLightColors[i] * (pow(faces, uSharp) * uGloss * gloss * 1.1 + film * pow(faces, 90.0) * 0.45 + glitter * uGlitter * 0.6) * near;
    }
  }
  float show = inside(vWorld, uGrid) * uAlpha;
  gl_FragColor = vec4(min(col, vec3(1.0)) * show, show);
}`;

// For the preview page in tools/fx-gallery: the look and tile painters, to draw outside the game.
// The shine on a look with a wet or hard face: light only, added over its image, shaped by the look itself. Its thick edges lean and catch
// the light; where there is no sun, moon or flame near, it is not drawn at all.
const SHEEN_FRAG = `precision highp float;
varying vec2 vWorld;
uniform sampler2D uLook;
uniform vec4 uBox;
uniform vec2 uToSun, uGlare;
uniform vec3 uSunColor;
uniform vec4 uLights[${MOST_FLOOR_LIGHTS}];
uniform vec3 uLightColors[${MOST_FLOOR_LIGHTS}];
uniform float uLightCount, uSun, uGloss, uSharp, uGlitter, uRipple, uWind, uTime, uGrid, uRelief, uEdge;
${NOISE}
${SUN_REACH}
void main(){
  vec2 uv = (vWorld - uBox.xy) / uBox.zw, e = vec2(uGrid * 0.03) / uBox.zw;
  vec4 here = texture2D(uLook, uv);
  float body = smoothstep(0.08, 0.35, here.a);
  if (body <= 0.0) { gl_FragColor = vec4(0.0); return; }
  vec4 toLeft = texture2D(uLook, uv - vec2(e.x, 0.0)), toRight = texture2D(uLook, uv + vec2(e.x, 0.0)), toUp = texture2D(uLook, uv - vec2(0.0, e.y)), toDown = texture2D(uLook, uv + vec2(0.0, e.y));
  vec2 lean = vec2(toLeft.a - toRight.a, toUp.a - toDown.a) * 1.4 * uEdge;
  // Its shape, from its edges and what is painted in it.
  vec3 grey = vec3(0.33); vec2 shape = lean + vec2(dot(toLeft.rgb, grey) - dot(toRight.rgb, grey), dot(toUp.rgb, grey) - dot(toDown.rgb, grey)) * 3.0;
  float sun = uSun * sunReach(vWorld), lit = clamp(dot(shape, uToSun) * 2.2, -0.45, 0.45) * uRelief * sun;
  vec2 g = vWorld / (uGrid * 1.7);
  lean += (vec2(silk(g) + silk(g * 5.3 + 11.0) * 0.5, silk(g + 31.0) + silk(g * 5.3 + 47.0) * 0.5) / 1.5 - 0.5) * 0.35;
  if (uRipple > 0.0) { vec2 run = vWorld / (uGrid * 0.35); float t = uTime * (0.25 + 1.2 * uWind); lean += (vec2(noise(run + t) + noise(run * 2.7 - t) * 0.5, noise(run + 31.0 - t * 0.8) + noise(run * 2.7 + 17.0 + t) * 0.5) / 1.5 - 0.5) * (0.06 + 0.2 * uWind) * uRipple; }
  float face = normalize(vec3(lean - (vWorld - uGlare) / (uGrid * 2.5), 1.0)).z;
  vec2 glint = vWorld / (uGrid * 0.05) + uToSun * 3.0 + uGlare / (uGrid * 2.0); float spark = hash(floor(glint) + 7.3), glitter = uGlitter > 0.0 ? step(0.965, hash(floor(glint))) * smoothstep(0.05 + 0.15 * spark, 0.0, length(fract(glint) - 0.5)) * (0.12 + 0.88 * spark * spark * spark) * smoothstep(0.42, 0.64, silk(vWorld / (uGrid * 0.7))) : 0.0;
  vec3 col = uSunColor * ((pow(face, uSharp) + 0.012 * pow(face, uSharp * 0.12)) * uGloss * 0.6 + glitter * uGlitter * 0.4) * sun;
  for (int i = 0; i < ${MOST_FLOOR_LIGHTS}; i++) {
    if (float(i) >= uLightCount) break;
    vec2 off = uLights[i].xy - vWorld; float far = length(off) / uLights[i].z;
    if (far >= 1.0) continue;
    float near = (1.0 - far) * (1.0 - far) * uLights[i].w;
    float faces = normalize(vec3(lean - off / max(length(off), 1.0) * min(0.5, length(off) / uGrid * 0.35), 1.0)).z;
    lit += clamp(dot(shape, off / max(length(off), 1.0)) * 2.2, -0.45, 0.45) * uRelief * near;
    col += uLightColors[i] * (pow(faces, uSharp) * uGloss + glitter * uGlitter * 0.6) * near;
  }
  col += here.rgb * max(lit, 0.0) * 1.4;
  gl_FragColor = vec4(col * body, max(-lit, 0.0) * body * here.a * 0.8);
}`;
// Which looks shine, and how: gloss how bright, sharp how tight, glitter points of light, ripple how the wind moves its face.
const LOOK_SHINES = Object.freeze({
  wet: { gloss: 0.7, sharp: 70 }, flooded: { gloss: 0.7, sharp: 70, ripple: 1 }, murky: { gloss: 0.35, sharp: 40, ripple: 0.5 }, boiling: { gloss: 0.4, sharp: 40, ripple: 1 }, slush: { gloss: 0.35, sharp: 30 }, drained: { gloss: 0.35, sharp: 40 }, quicksand: { gloss: 0.2, sharp: 30 },
  frozen: { gloss: 0.7, sharp: 60, glitter: 0.5 }, blackice: { gloss: 0.9, sharp: 90, glitter: 0.2 }, frost: { gloss: 0.2, sharp: 20, glitter: 1 }, snowed: { gloss: 0.2, sharp: 15, glitter: 1 }, drifts: { gloss: 0.05, sharp: 15, glitter: 0.4 }, salt: { gloss: 0.05, sharp: 20, glitter: 0.6 },
  glaze: { gloss: 0.8, sharp: 80 }, stained: { gloss: 0.7, sharp: 70 },
  blood: { gloss: 0.18, sharp: 110, edge: 0 }, dried: { gloss: 0.06, sharp: 30, edge: 0 }, oil: { gloss: 0.5, sharp: 70, ripple: 0.15, edge: 0 }, acid: { gloss: 0.55, sharp: 40, ripple: 0.3 }, poison: { gloss: 0.4, sharp: 40 },
});
// Light and vapour have no face to catch anything; everything else on the floor does: a shine if wet or hard (LOOK_SHINES), else its bumps (relief). `edge` how much its edges lean, 0 for what lies flat.
const NO_SURFACE = new Set(['none', 'burning', 'arcane', 'holy', 'cursed', 'deadmagic', 'electric', 'misty', 'steam']);
export const lookShine = (look) => (Object.hasOwn(STEP_LOOKS, look) && !NO_SURFACE.has(look) ? { gloss: 0, sharp: 20, glitter: 0, ripple: 0, edge: 1, relief: Object.hasOwn(LOOK_SHINES, look) ? 0 : 0.55, ...(Object.hasOwn(LOOK_SHINES, look) ? LOOK_SHINES[look] : {}) } : null);
export const FLOOR_SHADERS = Object.freeze({ VERT, lookFrag, FINISH_FRAG, tileFrag, bodyOf, biasOf, SHOW_FRAG, SHEEN_FRAG, MOST_FLOOR_LIGHTS });

// Shaders made without stopping the game: most of a new floor's first cost is compiling its shader, and the browser can do that aside.
// get(frag) gives the program once it is ready, null while it is being made, false if it failed. (Where the browser can't, it is ready at once.)
export function createBackgroundPrograms({ gl, sourcesOf }) {
  const made = new Map(), aside = gl.getExtension?.('KHR_parallel_shader_compile');
  const part = (type, source) => { const s = gl.createShader(type); gl.shaderSource(s, source); gl.compileShader(s); return s; };
  return {
    get(frag) {
      let entry = made.get(frag);
      if (!entry) {
        const { vertexSrc, fragmentSrc } = sourcesOf(frag), vert = part(gl.VERTEX_SHADER, vertexSrc), paint = part(gl.FRAGMENT_SHADER, fragmentSrc), program = gl.createProgram();
        gl.attachShader(program, vert); gl.attachShader(program, paint); gl.linkProgram(program);
        entry = { program, vert, paint, state: null }; made.set(frag, entry);
      }
      if (entry.state === null) {
        if (aside && !gl.getProgramParameter(entry.program, aside.COMPLETION_STATUS_KHR)) return null;
        entry.state = !!gl.getProgramParameter(entry.program, gl.LINK_STATUS);
        if (!entry.state) console.warn('Animater | floor shader', gl.getProgramInfoLog(entry.program));
        gl.deleteShader(entry.vert); gl.deleteShader(entry.paint);
      }
      return entry.state ? entry.program : false;
    },
  };
}
const programsByGl = new WeakMap();
const programsFor = (PIXI, renderer) => { const gl = renderer.gl; if (!programsByGl.has(gl)) programsByGl.set(gl, createBackgroundPrograms({ gl, sourcesOf: (frag) => PIXI.Program.from(VERT, frag) })); return programsByGl.get(gl); };
// One such program over a box, into what is bound now, row 0 at the box's top. The caller resets the renderer after.
// After drawing behind the renderer's back: its own program in use again, as it believes, before it sets anything on it.
const handBack = (r) => { r.gl.useProgram(r.shader?.program?.glPrograms?.[r.CONTEXT_UID]?.program ?? null); r.reset(); };
const drawPlain = (gl, program, box, width, height, set = () => {}) => {
  gl.bindVertexArray?.(null);
  gl.viewport(0, 0, width, height); gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST); gl.disable(gl.STENCIL_TEST); gl.disable(gl.SCISSOR_TEST); gl.disable(gl.CULL_FACE); gl.colorMask(true, true, true, true);
  gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
  gl.useProgram(program);
  const buffer = gl.createBuffer(), at = gl.getAttribLocation(program, 'aVertexPosition'), u = (name) => gl.getUniformLocation(program, name);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([box.x, box.y, box.x + box.w, box.y, box.x, box.y + box.h, box.x + box.w, box.y + box.h]), gl.STREAM_DRAW);
  gl.enableVertexAttribArray(at); gl.vertexAttribPointer(at, 2, gl.FLOAT, false, 0, 0);
  gl.uniformMatrix3fv(u('projectionMatrix'), false, new Float32Array([2 / box.w, 0, 0, 0, 2 / box.h, 0, -1 - (2 * box.x) / box.w, -1 - (2 * box.y) / box.h, 1]));
  gl.uniformMatrix3fv(u('translationMatrix'), false, new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]));
  set(u);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  gl.disableVertexAttribArray(at); gl.deleteBuffer(buffer);
};

const quadOf = (PIXI, box, frag, uniforms) => {
  const points = [box.x, box.y, box.x + box.w, box.y, box.x + box.w, box.y + box.h, box.x, box.y + box.h];
  const geometry = new PIXI.Geometry().addAttribute('aVertexPosition', new PIXI.Buffer(new Float32Array(points), true), 2).addIndex(new Uint16Array([0, 1, 2, 0, 2, 3]));
  const mesh = new PIXI.Mesh(geometry, PIXI.Shader.from(VERT, frag, uniforms));
  mesh.eventMode = 'none';
  return mesh;
};
// The box around a region's areas, with room for its soft edge.
const boxOf = (areas, pad) => {
  const xs = [], ys = [];
  for (const area of areas) for (let i = 0; i + 1 < area.length; i += 2) { xs.push(area[i]); ys.push(area[i + 1]); }
  if (!xs.length) return null;
  const x = Math.min(...xs) - pad, y = Math.min(...ys) - pad;
  return { x, y, w: Math.max(...xs) + pad - x, h: Math.max(...ys) + pad - y };
};
// The region's shape in a small soft image, its holes cut out.
const maskOf = (PIXI, render, areas, box, grid, edge = 1) => {
  const k = Math.min(0.25, 512 / Math.max(1, box.w, box.h)), w = Math.max(2, Math.ceil(box.w * k)), h = Math.max(2, Math.ceil(box.h * k));
  const texture = PIXI.RenderTexture.create({ width: w, height: h }), g = new PIXI.Graphics(), holder = new PIXI.Container();
  const at = (points) => points.map((v, i) => (v - (i % 2 ? box.y : box.x)) * k);
  for (const area of areas) { g.beginFill(0xffffff, 1); g.drawPolygon(at(Array.from(area))); for (const hole of area.holes ?? []) { g.beginHole(); g.drawPolygon(at(Array.from(hole))); g.endHole(); } g.endFill(); }
  // The fade: `edge` squares or so, less on a narrow region so that it still reaches full.
  const raw = boxOf(areas, 0), feather = Math.min(grid * 0.42 * edge, Math.min(raw.w, raw.h) * 0.25);
  if (edge > 0) g.filters = [new PIXI.BlurFilter(Math.max(1, feather * k))];
  holder.addChild(g);
  render(holder, texture, true);
  holder.destroy({ children: true });
  // The blur runs over a hole narrower than itself: cut each out again, sharp.
  const cuts = new PIXI.Graphics(), cutter = new PIXI.Container();
  let any = false;
  for (const area of areas) for (const hole of area.holes ?? []) { any = true; cuts.beginFill(0xffffff, 1); cuts.drawPolygon(at(Array.from(hole))); cuts.endFill(); }
  if (any) { cuts.blendMode = PIXI.BLEND_MODES.ERASE; cutter.addChild(cuts); render(cutter, texture, false); }
  cutter.destroy({ children: true });
  return texture;
};
// The most of the shape any point of a mask holds, 0-1. Read once, as a look or floor is made.
const peakOf = (pixels, mask) => { try { const px = pixels(mask); let most = 0; for (let i = 3; i < px.length; i += 4) if (px[i] > most) most = px[i]; return Math.max(0.05, most / 255); } catch { return 1; } };
const seedOf = (id) => { let h = 7; for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) % 997; return h / 37; };
// Looks that glow breathe: their baked image rises and falls, which costs nothing to draw. Rate per second, and how low it goes.
const BREATHING = Object.freeze({ steam: [0.9, 0.72], misty: [0.35, 0.8], hot: [0.8, 0.72], lavacracks: [0.9, 0.78], arcane: [1.4, 0.6], holy: [0.7, 0.65], burning: [3.4, 0.88], electric: [11, 0.45], cursed: [0.5, 0.78] });

// The floors that move in the wind.
export const swaysInWind = (floor) => floor === 'grass';

// Blades standing on painted grass, each rooted where it stands. All the bending happens here on the graphics card, so a whole
// field is one draw: the wind's gusts cross the field, and each blade answers at its own pace, by its own stiffness.
const BLADE_SHARED = `precision highp float;
attribute vec2 aVertexPosition, aShape, aLean;
attribute vec2 aOwn;
uniform mat3 projectionMatrix, translationMatrix;
uniform vec2 uWindDir, uToSun;
uniform float uTime, uWind, uGrid, uWidth, uReach, uStrength, uRim, uPresses;
uniform vec4 uPress[16];
varying vec2 vWorld;
varying float vUp, vSide, vTone, vLit;
vec2 stand, across;
float bladeLength;
uniform vec4 uLights[${MOST_FLOOR_LIGHTS}]; // torches and lanterns near the view: x, y, reach, strength
uniform vec3 uLightColors[${MOST_FLOOR_LIGHTS}];
uniform float uLightCount;
// The flames on this blade: how strongly they reach it, the way away from them, and their colour by how much each gives.
float flamesAt(out vec2 away, out vec3 glow){
  away = vec2(0.0); glow = vec3(0.0); float most = 0.0;
  for (int i = 0; i < ${MOST_FLOOR_LIGHTS}; i++) {
    if (float(i) >= uLightCount) break;
    vec2 d = aVertexPosition - uLights[i].xy; float dist = length(d), far = dist / uLights[i].z;
    if (far >= 1.0) continue;
    float k = (1.0 - far) * (1.0 - far) * uLights[i].w;
    away += (dist > 0.001 ? d / dist : vec2(0.0, 1.0)) * k; glow += uLightColors[i] * k; most = max(most, k);
  }
  float pull = length(away); if (pull > 0.001) away /= pull;
  return most;
}
// What is standing on or has just walked over this blade: it is pushed out from under, and lies flatter.
float pressAt(out vec2 shove){
  shove = vec2(0.0); float flat_ = 0.0;
  for (int i = 0; i < 16; i++) {
    if (float(i) >= uPresses) break;
    vec4 p = uPress[i]; vec2 d = aVertexPosition - p.xy; float far = length(d), k = smoothstep(p.z * 1.3, p.z * 0.4, far) * p.w;
    if (k > 0.0) { shove += (far > 0.001 ? d / far : vec2(0.0, 1.0)) * k; flat_ = max(flat_, k); }
  }
  return flat_;
}
vec2 windBend(float up){
  float seed = aOwn.x;
  bladeLength = aLean.y;
  stand = vec2(sin(aLean.x), -cos(aLean.x)); across = vec2(-stand.y, stand.x);
  vec2 windSide = vec2(-uWindDir.y, uWindDir.x);
  float along = dot(aVertexPosition, uWindDir) / uGrid, over = dot(aVertexPosition, windSide) / uGrid, pace = 0.7 + 2.2 * uWind, strength = 0.2 + 0.8 * uWind;
  // The gust at this blade's root, with a little of its own lateness.
  float gust = sin(along * 0.9 - uTime * pace + sin(over * 0.43 + uTime * 0.13) * 1.6 + seed * 1.6) * 0.5 + 0.5; gust *= gust;
  // Its own quick sway, and a stiffness: no two alike.
  float stiff = 0.45 + 0.9 * fract(seed * 7.13), own = sin(uTime * (1.3 + 2.6 * fract(seed * 3.7)) + seed * 40.0), crossSway = sin(uTime * (0.9 + 1.7 * fract(seed * 5.3)) + seed * 23.0);
  return (uWindDir * (gust * 0.85 + own * 0.2 + 0.12) + windSide * crossSway * 0.16) * strength * stiff * bladeLength * up * up;
}`;
const BLADE_VERT = `${BLADE_SHARED}
varying vec3 vFlame;
void main(){
  float up = aShape.y, side = aShape.x;
  vec2 bend = windBend(up), shove;
  float flat_ = pressAt(shove);
  vec2 at = aVertexPosition + stand * bladeLength * up * (1.0 - 0.72 * flat_) + across * side * uWidth * (1.0 - up * 0.9) + bend * (1.0 - flat_) + shove * bladeLength * up * 1.15;
  // The side turned to the sun or moon is lit, as is a blade leaning toward it.
  vLit = 1.0 + uStrength * (0.3 * dot(across, uToSun) * side + 0.24 * dot(normalize(stand + bend / max(1.0, bladeLength)), uToSun));
  // And so is the side turned to a flame, in its colour.
  vec2 away; vec3 glow; flamesAt(away, glow);
  vFlame = glow * max(0.0, 0.55 - 0.5 * dot(across, away) * side - 0.35 * dot(normalize(stand + bend / max(1.0, bladeLength)), away));
  vWorld = aVertexPosition; vUp = up; vSide = side; vTone = aOwn.y;
  gl_Position = vec4((projectionMatrix * translationMatrix * vec3(at, 1.0)).xy, 0.0, 1.0);
}`;
const BLADE_FRAG = `precision highp float;
varying vec2 vWorld;
varying float vUp, vSide, vTone, vLit;
varying vec3 vFlame;
uniform vec3 uLow, uHigh, uDry, uSunColor;
uniform float uGrid, uAlpha, uRim;
${NOISE}
${EDGE}
${SUN_REACH}
void main(){
  float reach = sunReach(vWorld);
  vec3 c = mix(uLow, uHigh, vTone);
  if (vTone > 0.88) c = mix(c, uDry, 0.7);
  c *= (0.5 + 0.72 * vUp) * (1.0 - 0.18 * abs(vSide)) * mix(1.0, vLit, reach);
  // A low sun warms the tips.
  c += uSunColor * uRim * vUp * vUp * 0.2 * reach;
  // What a flame adds, more on the tips, which stand nearer it.
  c *= 1.0 + vFlame * (0.6 + 1.4 * vUp);
  float a = inside(vWorld, uGrid) * uAlpha * smoothstep(1.0, 0.45, abs(vSide));
  gl_FragColor = vec4(c * a, a);
}`;
// Each blade's shadow: the same blade lying on the ground, away from the light, and moving as it moves.
const BLADE_SHADOW_VERT = `${BLADE_SHARED}
varying float vNear;
void main(){
  float up = aShape.y, side = aShape.x;
  vec2 bend = windBend(up), shove;
  float flat_ = pressAt(shove);
  vec2 away; vec3 glow; float near = min(1.0, flamesAt(away, glow) * 2.2);
  vNear = near;
  vec2 at = aVertexPosition + mix(-uToSun * uReach, away, near) * bladeLength * up * (1.0 - 0.8 * flat_) + across * side * uWidth * (1.0 - up * 0.9) + bend * 0.6 * (1.0 - flat_) + shove * bladeLength * up;
  vWorld = aVertexPosition; vUp = up; vSide = side; vTone = 0.0; vLit = 1.0;
  gl_Position = vec4((projectionMatrix * translationMatrix * vec3(at, 1.0)).xy, 0.0, 1.0);
}`;
const BLADE_SHADOW_FRAG = `precision highp float;
varying vec2 vWorld;
varying float vUp, vSide, vNear;
uniform float uGrid, uAlpha, uStrength;
${NOISE}
${EDGE}
${SUN_REACH}
void main(){
  float a = 0.075 * max(uStrength * sunReach(vWorld), vNear * 0.9) * (1.0 - vUp * 0.65) * inside(vWorld, uGrid) * uAlpha * smoothstep(1.0, 0.4, abs(vSide));
  gl_FragColor = vec4(0.0, 0.0, 0.0, a);
}`;
export const BLADE_SHADERS = Object.freeze({ BLADE_VERT, BLADE_FRAG, BLADE_SHADOW_VERT, BLADE_SHADOW_FRAG });
// The sun's colour by how high it stands, in degrees: near white overhead, gold as it gets low, deep orange-red on the horizon. Dawn and dusk alike.
const SUN_COLOURS = Object.freeze([[0, [1, 0.42, 0.17]], [6, [1, 0.56, 0.26]], [14, [1, 0.72, 0.42]], [28, [1, 0.87, 0.67]], [50, [1, 0.96, 0.87]]]);
export function sunColour(height) {
  const h = Number.isFinite(Number(height)) ? Math.max(0, Number(height)) : 45, next = SUN_COLOURS.findIndex(([at]) => h < at);
  if (next < 0) return [...SUN_COLOURS.at(-1)[1]];
  if (next === 0) return [...SUN_COLOURS[0][1]];
  const [fromAt, from] = SUN_COLOURS[next - 1], [toAt, to] = SUN_COLOURS[next], u = (h - fromAt) / (toAt - fromAt);
  return from.map((v, i) => +(v + (to[i] - v) * u).toFixed(3));
}
// The sky as the floors read it (pure): which way the sun or moon lies, how strong, how long a shadow it throws, how warm its tips.
export function skyForFloors(sun, clouds = 0) {
  const raw = Number(sun?.strength), strength = Number.isFinite(raw) ? Math.max(0, raw) * (sun?.moon ? 0.45 : 1) * (1 - 0.85 * Math.min(1, Math.max(0, Number(clouds) || 0))) : 0, from = ((Number(sun?.angle) || 0) * Math.PI) / 180;
  const height = Number(sun?.height), low = 1 - Math.min(1, Math.max(0, (Number.isFinite(height) ? height : 45) / 90));
  // Halfway between the light and the eye looking straight down: what a surface must face to shine.
  const up = Math.max(0.85, (1 - low) * Math.PI / 2), half = [Math.cos(from) * Math.cos(up), Math.sin(from) * Math.cos(up), Math.sin(up) + 1], length = Math.hypot(...half);
  return { strength, half: half.map((v) => v / length), toSun: [Math.cos(from), Math.sin(from)], reach: 0.35 + 1.9 * low, shine: sun?.moon ? Math.min(1, strength * 8) : Math.min(1, strength), rim: sun?.moon ? 0 : strength * low * low, color: sun?.moon ? [0.7, 0.8, 1] : sunColour(height) };
}
// How a surface answers the sun and moon: gloss how bright its highlight, sharp how tight, glitter points of light, lift light coming
// through it, relief its bumps catching the light. Grass has none of its own: its blades do that.
const ROUGH = Object.freeze({ gloss: 0, sharp: 8, glitter: 0, lift: 0, relief: 0.8, still: 0, wets: 1, ripple: 0 });
const SHINES = Object.freeze({
  grass: { '': { relief: 0.45, wets: 0 } }, // its blades catch the sun and moon themselves
  dirt: {},
  stone: { '': { gloss: 0.5, sharp: 10, relief: 1, still: 1 }, cave: { gloss: 0.5, sharp: 10, relief: 1 }, marble: { gloss: 0.6, sharp: 60, relief: 0.4, still: 1 } },
  wood: { '': { gloss: 0.5, sharp: 10, still: 1 }, parquet: { gloss: 0.6, sharp: 50, still: 1 } },
  pebbles: { '': { gloss: 0.4, sharp: 12, relief: 1 }, river: { gloss: 0.6, sharp: 40, relief: 1 } },
  sand: { '': { glitter: 0.2 }, wet: { gloss: 0.5, sharp: 50, relief: 0.5 } },
  snow: { '': { gloss: 1, sharp: 8, glitter: 1, relief: 0.5, wets: 0 }, dirty: { gloss: 0.5, sharp: 8, glitter: 0.3, relief: 0.6 }, crust: { gloss: 1.5, sharp: 20, glitter: 1, relief: 0.5 } },
  mud: { '': { gloss: 0.45, sharp: 60, relief: 0.8 }, drying: { gloss: 0.15, sharp: 30, relief: 0.8 }, red: { gloss: 0.3, sharp: 50, relief: 0.8 } },
  water: { '': { gloss: 0.7, sharp: 70, relief: 0.4, wets: 0, ripple: 1 }, swamp: { gloss: 0.5, sharp: 20, relief: 0.4, ripple: 0.4 }, dark: { gloss: 0.9, sharp: 60, relief: 0.2, ripple: 0.3 } },
  ice: { '': { gloss: 0.7, sharp: 60, glitter: 0.5, lift: 0.1, relief: 0.4, wets: 0 }, milky: { gloss: 0.8, sharp: 16, glitter: 0.4, relief: 0.4 }, dusted: { gloss: 0.6, sharp: 12, glitter: 1, relief: 0.4 } },
  glass: { '': { gloss: 1, sharp: 170, lift: 0.3, relief: 0.5, still: 1 }, leaded: { gloss: 0.55, sharp: 70, lift: 0.3, relief: 0.4, still: 1 }, panes: { gloss: 0.55, sharp: 70, lift: 0.2, relief: 0.4, still: 1 }, frosted: { gloss: 1, sharp: 10, lift: 0.25, relief: 0.3, still: 1 }, obsidian: { gloss: 1.2, sharp: 90, relief: 0.3 } },
  metal: { '': { gloss: 0.6, sharp: 40, relief: 0.8, still: 1 }, rusted: { gloss: 0.3, sharp: 10, relief: 0.9, still: 1 }, copper: { gloss: 0.7, sharp: 40, relief: 0.7, still: 1 } },
});
export const surfaceShine = (floor, style) => { const shines = Object.hasOwn(SHINES, floor) ? SHINES[floor] : {}; return { ...ROUGH, ...(shines[''] ?? {}), ...(Object.hasOwn(shines, style ?? '') ? shines[style] : {}) }; };
// Where on a floor the sun or moon shines back (pure): out from its middle toward the light, the lower the light the further. It stays on the
// map, and goes only as the sun or moon goes.
export function glareAt(box, sky) {
  const up = sky?.half?.[2] || 1, reach = Math.min(box?.w ?? 0, box?.h ?? 0) * 0.5;
  return [(box?.x ?? 0) + (box?.w ?? 0) / 2 + ((sky?.half?.[0] ?? 0) / up) * reach, (box?.y ?? 0) + (box?.h ?? 0) / 2 + ((sky?.half?.[1] ?? 0) / up) * reach];
}
// The lights a floor answers (pure): lit ones near the view, nearest first, as the shader wants them.
export function floorLights(sources = [], view = null, most = MOST_FLOOR_LIGHTS) {
  const cx = view ? view.x + view.w / 2 : 0, cy = view ? view.y + view.h / 2 : 0, room = view ? Math.hypot(view.w, view.h) / 2 : Infinity;
  const near = sources.filter((s) => s.radius > 0 && Math.hypot(s.x - cx, s.y - cy) < room + s.radius).sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy)).slice(0, Math.min(most, MOST_FLOOR_LIGHTS));
  const lights = new Float32Array(MOST_FLOOR_LIGHTS * 4), colors = new Float32Array(MOST_FLOOR_LIGHTS * 3);
  near.forEach((s, i) => { lights.set([s.x, s.y, s.radius, s.strength ?? 1], i * 4); colors.set(s.color ?? [1, 0.82, 0.58], i * 3); });
  return { count: near.length, lights, colors };
}
const SKY_EVERY = 0.5, LIGHTS_EVERY = 0.2, NO_LIGHT = 0.05, PRESS_EVERY = 1 / 30;
// How the grass answers what walks through it (pure but for its memory). step(tokens { id, x, y, width }, seconds, grid) gives
// { count, data }: for the shader, x, y, radius and strength four to a press. Each creature presses where it stands; as it moves it
// leaves marks behind that spring back, with a little overshoot. Only the strongest fit.
export const MOST_PRESSES = 16;
export function createBladePresses({ life = 2.6 } = {}) {
  const lastMark = new Map();
  let trail = [];
  const data = new Float32Array(MOST_PRESSES * 4);
  return {
    step(tokens, now, grid) {
      const live = [];
      const seen = new Set();
      for (const t of tokens) {
        const r = (t.width ?? grid) * 0.55;
        seen.add(t.id);
        live.push({ x: t.x, y: t.y, r, s: 1 });
        const mark = lastMark.get(t.id);
        if (!mark) lastMark.set(t.id, { x: t.x, y: t.y });
        else if (Math.hypot(t.x - mark.x, t.y - mark.y) > grid * 0.3) { trail.push({ x: mark.x, y: mark.y, r, born: now }); mark.x = t.x; mark.y = t.y; }
      }
      for (const id of lastMark.keys()) if (!seen.has(id)) lastMark.delete(id);
      trail = trail.filter((m) => now - m.born < life);
      const fading = trail.map((m) => { const a = (now - m.born) / life, spring = (1 - a) * (1 - a) * (1 + 0.28 * Math.sin(a * 17)); return { x: m.x, y: m.y, r: m.r, s: Math.max(0.001, Math.min(0.999, spring)) }; }).sort((a, b) => b.s - a.s);
      const all = [...live, ...fading].slice(0, MOST_PRESSES);
      data.fill(0);
      all.forEach((p, i) => { data[i * 4] = p.x; data[i * 4 + 1] = p.y; data[i * 4 + 2] = p.r; data[i * 4 + 3] = p.s; });
      return { count: all.length, data };
    },
  };
}
// Each grass style's blades: colours as its tile has them; how many to a square, how long and how wide, in squares.
export const GRASS_BLADES = Object.freeze({
  meadow: { low: [0.2, 0.31, 0.1], high: [0.37, 0.47, 0.15], dry: [0.38, 0.34, 0.14], perSquare: 95, length: 0.17, width: 0.011 },
  long: { low: [0.14, 0.24, 0.08], high: [0.3, 0.42, 0.13], dry: [0.42, 0.38, 0.16], perSquare: 70, length: 0.32, width: 0.014 },
  turf: { low: [0.24, 0.37, 0.13], high: [0.38, 0.5, 0.19], dry: [0.42, 0.45, 0.18], perSquare: 120, length: 0.09, width: 0.008 },
  dry: { low: [0.36, 0.31, 0.13], high: [0.58, 0.49, 0.23], dry: [0.3, 0.3, 0.13], perSquare: 80, length: 0.2, width: 0.01 },
  clover: { low: [0.18, 0.29, 0.1], high: [0.31, 0.42, 0.14], dry: [0.33, 0.33, 0.13], perSquare: 22, length: 0.12, width: 0.01 },
  forest: { low: [0.14, 0.22, 0.08], high: [0.25, 0.34, 0.12], dry: [0.34, 0.3, 0.13], perSquare: 18, length: 0.16, width: 0.01 },
});
export const MOST_BLADES = 14000;
export const bladeCount = (squares, perSquare) => Math.min(MOST_BLADES, Math.round(squares * perSquare));
// A blade is three segments, narrowing to its tip.
const BLADE_SHAPE = [[-1, 0], [1, 0], [-1, 0.34], [1, 0.34], [-1, 0.68], [1, 0.68], [-0.25, 1], [0.25, 1]];
const BLADE_INDEX = [0, 1, 2, 1, 3, 2, 2, 3, 4, 3, 5, 4, 4, 5, 6, 5, 7, 6];
const bladesOf = (PIXI, areas, box, style, size, mask, peak, random = Math.random) => {
  const look = GRASS_BLADES[style] ?? GRASS_BLADES.meadow, wanted = bladeCount(areaOf(areas) / (size * size), look.perSquare);
  if (!wanted) return null;
  const roots = [], x0 = box.x, y0 = box.y;
  for (let tries = 0; tries < wanted * 3 && roots.length < wanted; tries++) { const x = x0 + random() * box.w, y = y0 + random() * box.h; if (insideAreas(x, y, areas)) roots.push([x, y]); }
  const n = roots.length, verts = BLADE_SHAPE.length, position = new Float32Array(n * verts * 2), shape = new Float32Array(n * verts * 2), lean = new Float32Array(n * verts * 2), own = new Float32Array(n * verts * 2), index = new Uint32Array(n * BLADE_INDEX.length);
  roots.forEach(([x, y], b) => {
    const tilt = (random() - 0.5) * 1.5, length_ = size * look.length * (0.55 + 0.9 * random()), seed = random(), tone = random();
    for (let v = 0; v < verts; v++) { const i = (b * verts + v) * 2; position[i] = x; position[i + 1] = y; shape[i] = BLADE_SHAPE[v][0]; shape[i + 1] = BLADE_SHAPE[v][1]; lean[i] = tilt; lean[i + 1] = length_; own[i] = seed; own[i + 1] = tone; }
    BLADE_INDEX.forEach((corner, k) => { index[b * BLADE_INDEX.length + k] = b * verts + corner; });
  });
  const geometry = new PIXI.Geometry().addAttribute('aVertexPosition', new PIXI.Buffer(position, true), 2).addAttribute('aShape', new PIXI.Buffer(shape, true), 2).addAttribute('aLean', new PIXI.Buffer(lean, true), 2).addAttribute('aOwn', new PIXI.Buffer(own, true), 2).addIndex(new PIXI.Buffer(index, true, true));
  const common = () => ({ ...sunUniforms(PIXI), uPress: new Float32Array(MOST_PRESSES * 4), uPresses: 0, uWindDir: [1, 0], uToSun: [1, 0], uTime: 0, uWind: 0, uGrid: size, uWidth: size * look.width, uReach: 1, uStrength: 0, uRim: 0, uAlpha: 1, uLights: new Float32Array(MOST_FLOOR_LIGHTS * 4), uLightColors: new Float32Array(MOST_FLOOR_LIGHTS * 3), uLightCount: 0, uMask: mask, uPeak: peak, uBox: [box.x, box.y, box.w, box.h] });
  const blades = new PIXI.Mesh(geometry, PIXI.Shader.from(BLADE_VERT, BLADE_FRAG, { ...common(), uLow: look.low, uHigh: look.high, uDry: look.dry, uSunColor: [1, 0.84, 0.58] }));
  const shadows = new PIXI.Mesh(geometry, PIXI.Shader.from(BLADE_SHADOW_VERT, BLADE_SHADOW_FRAG, common()));
  blades.eventMode = 'none'; shadows.eventMode = 'none'; shadows.visible = false;
  return { blades, shadows };
};

/**
 * Regions' painted floors: sync([{ id, areas, floor, seconds }]) with those that show one. A region seen for the first time
 * shows its floor at once; a new floor fades in over the old. tick(seconds) while `busy`; clear().
 * `extract(renderTexture)` reads a texture out to a canvas, for a tile that can be repeated and scaled cleanly.
 */
export function createFloorTextures({ PIXI, root, render, renderer, pixels, grid = () => 100, tileReady = () => {}, tileSize = () => 1024 }) {
  const known = new Map(), tiles = new Map(), roofed = new Set(), waiting = [];
  let lastList = [];
  let clock = 0, skyAt = 0, pressAt = 0, lightsAt = 0, flashing = false, lightsNow = floorLights();
  const presses = createBladePresses();
  // A floor's tile, or null while it is being made: the shader aside, then one tile drawn a frame, so nothing stops for it.
  const tileOf = (floor, style, asSurface = false) => {
    const key = `${floor}/${style}${asSurface ? '/surface' : ''}`, tile = tiles.get(key);
    if (tile && !tile.baseTexture?.destroyed) return tile;
    if (!waiting.some((w) => w.key === key)) { const frag = tileFrag(floor, style, asSurface); waiting.push({ key, frag }); programsFor(PIXI, renderer()).get(frag); }
    return null;
  };
  const makeWaiting = () => {
    const programs = programsFor(PIXI, renderer());
    for (let i = 0; i < waiting.length; i++) {
      const program = programs.get(waiting[i].frag);
      if (program === null) continue;
      const [{ key }] = waiting.splice(i, 1);
      // The picture as sharp as this screen's quality asks for; which way the surface leans doesn't need the detail.
      tiles.set(key, program ? tileFromProgram(program, key.endsWith('/surface') ? 1024 : tileSize()) : PIXI.Texture.WHITE);
      return true;
    }
    return false;
  };
  const tileFromProgram = (program, side = 1024) => {
    const r = renderer(), gl = r.gl, target = gl.createTexture(), frame = gl.createFramebuffer(), data = new Uint8Array(side * side * 4);
    gl.bindTexture(gl.TEXTURE_2D, target); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, side, side, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, frame); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, target, 0);
    // (The painters work in a 1024 square whatever the picture's size: the same pattern, only sharper.)
    drawPlain(gl, program, { x: 0, y: 0, w: 1024, h: 1024 }, side, side);
    gl.readPixels(0, 0, side, side, gl.RGBA, gl.UNSIGNED_BYTE, data);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.deleteFramebuffer(frame); gl.deleteTexture(target);
    handBack(r);
    return new PIXI.Texture(PIXI.BaseTexture.fromBuffer(data, side, side, { wrapMode: PIXI.WRAP_MODES.REPEAT, mipmap: PIXI.MIPMAP_MODES.ON, anisotropicLevel: 8, scaleMode: PIXI.SCALE_MODES.LINEAR, alphaMode: PIXI.ALPHA_MODES.NPM }));
  };
  let scaleNow = 1;
  const drop = (mesh) => { if (!mesh) return; const mask = mesh.animaterMask; try { mesh.parent?.removeChild(mesh); mesh.destroy({ children: true }); mask?.destroy(true); } catch { /* gone */ } };
  const paint = (areas, floor, edge, style, useBlades, shineOn, parent = null) => {
    const size = grid() || 100, box = boxOf(areas, size * Math.max(1, edge));
    if (!box) return null;
    const mask = maskOf(PIXI, render, areas, box, size, edge);
    // Four squares to a tile: a blade of grass, a board or a flagstone at its right size for the map, and sharp.
    const made = surfaceShine(floor, style), shine = shineOn ? made : { ...made, gloss: 0, glitter: 0, lift: 0, relief: 0, ripple: 0, wets: 0 }, answers = shine.gloss + shine.glitter + shine.lift + shine.relief > 0;
    skyAt = 0;
    const mesh = quadOf(PIXI, box, SHOW_FRAG, { ...sunUniforms(PIXI), uTile: tileOf(floor, style), uTileSize: size * 4 * scaleNow, uGrid: size, uAlpha: 1, uShape: answers ? tileOf(floor, style, true) : PIXI.Texture.WHITE, uTwo: shine.still ? 0 : 1, uToSun: [1, 0], uSunColor: [1, 1, 1], uGlare: [0, 0], uLights: new Float32Array(MOST_FLOOR_LIGHTS * 4), uLightColors: new Float32Array(MOST_FLOOR_LIGHTS * 3), uLightCount: 0, uWet: 0, uRipple: shine.ripple, uSun: 0, uGloss: shine.gloss, uSharp: shine.sharp, uGlitter: shine.glitter, uLift: shine.lift, uRelief: shine.relief, uSway: swaysInWind(floor) ? 1 : 0, uTime: 0, uWind: 0, uWindDir: [1, 0], uMask: mask, uPeak: peakOf(pixels, mask), uTight: edge === 0 ? 2 : floor === 'water' ? 1 : 0, uBox: [box.x, box.y, box.w, box.h] });
    mesh.animaterMask = mask; mesh.animaterWets = !!shine.wets;
    (parent ?? root()).addChild(mesh);
    // Grass stands up off its ground, blade by blade.
    if (useBlades && swaysInWind(floor)) { const made = bladesOf(PIXI, areas, box, style, size, mask, mesh.shader.uniforms.uPeak); if (made) { mesh.addChild(made.shadows, made.blades); mesh.animaterBlades = made.blades; mesh.animaterBladeShadows = made.shadows; skyAt = 0; } }
    return mesh;
  };
  // The sky, shade and lights the last frame used, so a snapshot is lit as the scene is now.
  let lastLight = null, lastShade = null;
  const lightNow = (mesh, roofed) => {
    const w = mesh.shader.uniforms;
    if (lastLight) { w.uSun = roofed ? 0 : lastLight.shine; w.uToSun = lastLight.toSun; w.uSunColor = lastLight.color; const [x, y, width, h] = w.uBox; w.uGlare = glareAt({ x, y, w: width, h }, lastLight); }
    shadeWith(w, lastShade); w.uLights = lightsNow.lights; w.uLightColors = lightsNow.colors; w.uLightCount = lightsNow.count;
    if (!mesh.animaterBlades) return;
    const b = mesh.animaterBlades.shader.uniforms, s = mesh.animaterBladeShadows.shader.uniforms;
    for (const u of [b, s]) { shadeWith(u, lastShade); u.uLights = lightsNow.lights; u.uLightColors = lightsNow.colors; u.uLightCount = lightsNow.count; }
    if (lastLight) { b.uToSun = lastLight.toSun; b.uStrength = lastLight.strength; b.uRim = lastLight.rim; b.uSunColor = lastLight.color; s.uToSun = lastLight.toSun; s.uStrength = lastLight.strength; s.uReach = lastLight.reach; }
    mesh.animaterBladeShadows.visible = s.uStrength > NO_LIGHT || lightsNow.count > 0;
  };
  return {
    sync(list = []) {
      const seen = new Set();
      lastList = list;
      for (const spec of list) {
        seen.add(spec.id);
        if (spec.roofed) roofed.add(spec.id); else roofed.delete(spec.id);
        const shape = JSON.stringify(spec.areas), edge = spec.edge ?? 1, style = spec.style ?? '', useBlades = spec.blades !== false, shineOn = spec.shine !== false, entry = known.get(spec.id);
        scaleNow = spec.scale ?? 1;
        if (entry && entry.floor === spec.floor && entry.style === style && entry.shape === shape && entry.edge === edge && entry.useBlades === useBlades && entry.shineOn === shineOn) { for (const mesh of [entry.mesh, entry.old]) if (mesh) mesh.shader.uniforms.uTileSize = (grid() || 100) * 4 * scaleNow; continue; }
        // Not made yet: what is there stays, and it comes when its tiles are ready.
        const wants = surfaceShine(spec.floor, style), base = tileOf(spec.floor, style), surface = !shineOn || !(wants.gloss + wants.glitter + wants.lift + wants.relief > 0) || tileOf(spec.floor, style, true);
        if (!base || !surface) continue;
        let mesh = null;
        try { mesh = paint(spec.areas, spec.floor, edge, style, useBlades, shineOn); } catch (error) { console.warn('Animater | floor texture', error); }
        if (!mesh) continue;
        // A new shape or edge shows at once; only a new floor fades in.
        if (!entry || entry.shape !== shape || entry.edge !== edge || !(spec.seconds > 0)) { drop(entry?.old); drop(entry?.mesh); known.set(spec.id, { mesh, old: null, floor: spec.floor, style, shape, edge, useBlades, shineOn, seconds: 0 }); continue; }
        drop(entry.old);
        mesh.shader.uniforms.uAlpha = 0;
        if (mesh.animaterBlades) { mesh.animaterBlades.shader.uniforms.uAlpha = 0; mesh.animaterBladeShadows.shader.uniforms.uAlpha = 0; }
        known.set(spec.id, { mesh, old: entry.mesh, floor: spec.floor, style, shape, edge, useBlades, shineOn, seconds: spec.seconds });
      }
      for (const [id, entry] of known) if (!seen.has(id)) { drop(entry.old); drop(entry.mesh); known.delete(id); }
    },
    tick(seconds, { wind = 0, angle = 0.6, sky = () => null, tokens = () => [], view = () => null, lights = () => [], weather = () => null, flash = () => null, shade = () => null, mostLights = MOST_FLOOR_LIGHTS } = {}) {
      const shadeNow = shade();
      lastShade = shadeNow;
      clock += seconds;
      if (waiting.length && makeWaiting()) { this.sync(lastList); tileReady(); }
      // Who is standing in the grass: looked at thirty times a second, and only with blades out.
      let pressed = null;
      if (clock >= pressAt) { pressAt = clock + PRESS_EVERY; const fields = [...known.values()].filter((e) => e.mesh.animaterBlades).map((e) => e.mesh.shader.uniforms.uBox); if (fields.length) pressed = presses.step(tokens().filter((t) => fields.some(([x, y, w, h]) => t.x > x && t.y > y && t.x < x + w && t.y < y + h)), clock, grid() || 100); }
      // The sun and moon move slowly: looked at twice a second.
      // (A lightning flash, each frame while it lasts: it lights them from where it struck, whatever the clouds.)
      const struck = flash(), lookUp = clock >= skyAt || !!struck || flashing; flashing = !!struck;
      if (lookUp) skyAt = clock + SKY_EVERY;
      const sky_ = lookUp ? (weather() ?? {}) : null;
      const light = lookUp ? (struck ? { ...skyForFloors(struck), color: [0.85, 0.9, 1] } : skyForFloors(sky(), sky_.clouds)) : null;
      if (light) lastLight = light;
      if (clock >= lightsAt) { lightsAt = clock + LIGHTS_EVERY; lightsNow = floorLights(lights(), view(), mostLights); }
      for (const [id, entry] of known) {
        if (light) for (const mesh of [entry.mesh, entry.old]) { if (!mesh) continue; const w = mesh.shader.uniforms; w.uSun = roofed.has(id) ? 0 : light.shine; w.uToSun = light.toSun; w.uSunColor = light.color; const [x, y, width, h] = w.uBox; w.uGlare = glareAt({ x, y, w: width, h }, light); w.uWet = mesh.animaterWets && !roofed.has(id) ? Math.min(1, Math.max(0, Number(sky_.wet) || 0)) : 0; }
        for (const mesh of [entry.mesh, entry.old]) { if (!mesh) continue; const w = mesh.shader.uniforms; shadeWith(w, shadeNow); w.uTime = clock; w.uWind = roofed.has(id) ? 0 : wind; w.uLights = lightsNow.lights; w.uLightColors = lightsNow.colors; w.uLightCount = lightsNow.count; }
        if (swaysInWind(entry.floor)) {
          const dir = [Math.cos(angle), Math.sin(angle)];
          for (const mesh of [entry.mesh, entry.old]) {
            if (!mesh) continue;
            for (const shader of [mesh.shader, mesh.animaterBlades?.shader, mesh.animaterBladeShadows?.shader]) if (shader) { const w = shader.uniforms; w.uTime = clock; w.uWind = wind; w.uWindDir = dir; }
            if (pressed && mesh.animaterBlades) for (const blade of [mesh.animaterBlades, mesh.animaterBladeShadows]) { const w = blade.shader.uniforms; w.uPress = pressed.data; w.uPresses = pressed.count; }
            if (!mesh.animaterBlades) continue;
            const b = mesh.animaterBlades.shader.uniforms, s = mesh.animaterBladeShadows.shader.uniforms;
            for (const w of [b, s]) { shadeWith(w, shadeNow); w.uLights = lightsNow.lights; w.uLightColors = lightsNow.colors; w.uLightCount = lightsNow.count; }
            if (light) {
              b.uToSun = light.toSun; b.uStrength = light.strength; b.uRim = light.rim; b.uSunColor = light.color;
              s.uToSun = light.toSun; s.uStrength = light.strength; s.uReach = light.reach;
            }
            // Too little light to throw a shadow: not drawn at all.
            mesh.animaterBladeShadows.visible = s.uStrength > NO_LIGHT || lightsNow.count > 0;
          }
        }
        if (!entry.old) continue;
        const u = entry.mesh.shader.uniforms; u.uAlpha = Math.min(1, u.uAlpha + seconds / Math.max(0.01, entry.seconds));
        if (entry.mesh.animaterBlades) { entry.mesh.animaterBlades.shader.uniforms.uAlpha = u.uAlpha; entry.mesh.animaterBladeShadows.shader.uniforms.uAlpha = u.uAlpha; }
        if (u.uAlpha >= 1) { drop(entry.old); entry.old = null; }
      }
    },
    clear() { for (const entry of known.values()) { drop(entry.old); drop(entry.mesh); } known.clear(); },
    // Regions that are not on the scene yet (the floor regions window's drafts), painted exactly as sync would paint them
    // and lit as the scene is now, into a canvas of `width` x `height` showing `rect` of the scene. Nothing is added to
    // the scene. Null while a tile they need is still being made: ask again a moment later.
    snapshot(list, rect, width, height) {
      const r = renderer();
      if (!r || !list?.length || !(rect?.width > 0) || !(width > 0) || !(height > 0)) return null;
      let missing = false;
      for (const spec of list) {
        const style = spec.style ?? '', wants = surfaceShine(spec.floor, style), shineOn = spec.shine !== false;
        if (!tileOf(spec.floor, style)) missing = true;
        if (shineOn && wants.gloss + wants.glitter + wants.lift + wants.relief > 0 && !tileOf(spec.floor, style, true)) missing = true;
      }
      if (missing) return null;
      const holder = new PIXI.Container(), meshes = [], keep = scaleNow;
      let target = null;
      try {
        for (const spec of list) {
          scaleNow = spec.scale ?? 1;
          const mesh = paint(spec.areas, spec.floor, spec.edge ?? 1, spec.style ?? '', spec.blades !== false, spec.shine !== false, holder);
          if (!mesh) continue;
          meshes.push(mesh); lightNow(mesh, !!spec.roofed);
        }
        target = PIXI.RenderTexture.create({ width: Math.round(width), height: Math.round(height) });
        const k = width / rect.width;
        render(holder, target, true, new PIXI.Matrix(k, 0, 0, k, -rect.x * k, -rect.y * k));
        if (r.extract?.canvas) return r.extract.canvas(target);
        const data = pixels(target), out = document.createElement('canvas');
        out.width = target.width; out.height = target.height;
        out.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(data), target.width, target.height), 0, 0);
        return out;
      } finally {
        scaleNow = keep; skyAt = 0;
        for (const mesh of meshes) drop(mesh);
        try { holder.destroy({ children: true }); target?.destroy(true); } catch { /* gone */ }
      }
    },
    // A floor's tile for another layer to draw, null while it is being made.
    tile: (floor, style) => tileOf(floor, style),
    // A floor's tile as a canvas, to look at.
    tileImage: (floor, style) => { const base = tileOf(floor, style)?.baseTexture, data = base?.resource?.data; if (!data) return null; const canvas = document.createElement('canvas'); canvas.width = base.width; canvas.height = base.height; canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(data), base.width, base.height), 0, 0); return canvas; },
    get busy() { if (waiting.length) return true; for (const entry of known.values()) if (entry.old || entry.shineOn || swaysInWind(entry.floor)) return true; return false; },
    get count() { return known.size; },
  };
}

/**
 * The layer: sync([{ id, areas, look, cover, how, seconds, at, flowTo, edge }]) with every region that has a floor (a region seen
 * for the first time shows its look at once; one that changes runs the change); tick(seconds) while `busy`; clear().
 * `root()` the floor layer; `render(object, renderTexture, clear, transform)` draws into a texture.
 * Each look is painted once into an image for its region; a change only blends two images, and a finished one is a plain sprite.
 */
export function createFloorLooks({ PIXI, root, render, renderer, pixels, grid = () => 100 }) {
  const known = new Map(), roofed = new Set();
  let clock = 0, skyAt = 0, lightsAt = 0, flashing = false, lightsNow = floorLights();
  const free = (texture) => { if (texture && texture !== PIXI.Texture.EMPTY) { try { texture.destroy(true); } catch { /* gone */ } } };
  const dropSheen = (entry) => { if (entry.sheen) { try { entry.sheen.parent?.removeChild(entry.sheen); entry.sheen.destroy(); } catch { /* gone */ } entry.sheen = null; } };
  const dropSprite = (entry) => { dropSheen(entry); if (entry.sprite) { try { entry.sprite.parent?.removeChild(entry.sprite); entry.sprite.destroy(); } catch { /* gone */ } entry.sprite = null; } };
  const dropMesh = (entry) => { if (entry.mesh) { try { entry.mesh.parent?.removeChild(entry.mesh); entry.mesh.destroy(); } catch { /* gone */ } entry.mesh = null; } };
  const dropAll = (entry) => { dropMesh(entry); dropSprite(entry); free(entry.image); free(entry.old); entry.image = null; entry.old = null; };
  const textureFor = (box) => { const k = Math.min(1, 2048 / Math.max(1, box.w, box.h)); return { k, texture: PIXI.RenderTexture.create({ width: Math.max(1, Math.ceil(box.w * k)), height: Math.max(1, Math.ceil(box.h * k)) }) }; };
  // A look, painted and finished, as an image the size of the region's box.
  const imageOf = (entry, spec, box) => {
    const id = STEP_LOOKS[spec.look] ?? 0;
    if (!id) return PIXI.Texture.EMPTY;
    const size = grid() || 100, edge = spec.edge ?? 1, mask = maskOf(PIXI, render, spec.areas, box, size, edge), shore = spec.shore?.(box) ?? null;
    const paint = textureFor(box), done = textureFor(box), transform = new PIXI.Matrix(paint.k, 0, 0, paint.k, -box.x * paint.k, -box.y * paint.k);
    const r = renderer(), gl = r.gl;
    r.renderTexture.bind(paint.texture);
    drawPlain(gl, programsFor(PIXI, r).get(lookFrag(id)), box, paint.texture.baseTexture.realWidth, paint.texture.baseTexture.realHeight, (u) => { gl.uniform1f(u('uGrid'), size); gl.uniform1f(u('uSeed'), seedOf(entry.id)); gl.uniform1f(u('uTime'), 0); gl.uniform1f(u('uCover'), spec.cover ? 1 : 0); gl.uniform1f(u('uBias'), biasOf(spec.strength ?? 1)); gl.uniform1f(u('uScale'), spec.scale ?? 1); });
    handBack(r);
    const finisher = quadOf(PIXI, box, FINISH_FRAG, { uPaint: paint.texture, uGrid: size, uBody: bodyOf(id), uWet: 0, uAmount: spec.strength ?? 1, uClip: shore ? 1 : 0, uShore: shore ?? PIXI.Texture.WHITE, uMask: mask, uPeak: peakOf(pixels, mask), uTight: edge === 0 ? 2 : 0, uBox: [box.x, box.y, box.w, box.h] });
    render(finisher, done.texture, true, transform);
    finisher.destroy();
    paint.texture.destroy(true); mask.destroy(true); shore?.destroy(true);
    return done.texture;
  };
  const showImage = (entry) => {
    dropSprite(entry);
    if (!entry.image || entry.image === PIXI.Texture.EMPTY) return;
    const k = entry.image.width / entry.box.w, sprite = new PIXI.Sprite(entry.image);
    sprite.eventMode = 'none'; sprite.position.set(entry.box.x, entry.box.y); sprite.scale.set(1 / k);
    entry.sprite = sprite; root().addChild(sprite);
    const shine = entry.sheenOn ? lookShine(entry.look) : null;
    if (!shine) return;
    const size = grid() || 100, { x, y, w, h } = entry.box;
    entry.sheen = quadOf(PIXI, entry.box, SHEEN_FRAG, { ...sunUniforms(PIXI), uRelief: shine.relief, uEdge: shine.edge, uLook: entry.image, uBox: [x, y, w, h], uToSun: [1, 0], uGlare: glareAt(entry.box, null), uSunColor: [1, 1, 1], uLights: new Float32Array(MOST_FLOOR_LIGHTS * 4), uLightColors: new Float32Array(MOST_FLOOR_LIGHTS * 3), uLightCount: 0, uSun: 0, uGloss: shine.gloss, uSharp: shine.sharp, uGlitter: shine.glitter, uRipple: shine.ripple, uWind: 0, uTime: 0, uGrid: size });
    entry.sheen.visible = false; root().addChild(entry.sheen);
    skyAt = 0;
  };
  const start = (entry, spec, animate) => {
    // Its shader not made yet: what is showing stays until it is, and nothing stops for it.
    const shader = STEP_LOOKS[spec.look] ? programsFor(PIXI, renderer()).get(lookFrag(STEP_LOOKS[spec.look])) : true;
    entry.pending = shader === null ? { spec, animate } : null;
    if (shader === null) return;
    if (shader === false) { dropAll(entry); return; }
    const size = grid() || 100, origin = spreadFrom(spec.areas, spec.at, spec.flowTo), box = boxOf(spec.areas, size * Math.max(1, spec.edge ?? 1));
    dropMesh(entry); free(entry.old); entry.old = null;
    if (!origin || !box) { dropAll(entry); return; }
    const before = entry.image ?? PIXI.Texture.EMPTY;
    let image;
    try { image = imageOf(entry, spec, box); } catch (error) { console.warn('Animater | floor look', error); return; }
    entry.box = box; entry.image = image;
    if (!animate || !(spec.seconds > 0)) { dropSprite(entry); free(before); entry.running = false; showImage(entry); return; }
    dropSprite(entry); entry.old = before;
    entry.uniforms = { uOld: before, uNew: image, uBox: [box.x, box.y, box.w, box.h], uSrc: [origin.x, origin.y], uMix: 0, uReach: origin.reach / (size * 5), uGrid: size, uSeed: seedOf(entry.id), uFade: spec.how === 'fade' ? 1 : 0, uFire: FIRE_LOOKS.has(STEP_LOOKS[spec.look]) ? 1 : 0 };
    entry.mesh = quadOf(PIXI, box, SPREAD_FRAG, entry.uniforms);
    root().addChild(entry.mesh);
    entry.seconds = spec.seconds; entry.mix = 0; entry.running = true;
  };
  const breathing = (entry) => !!(BREATHING[entry.look] && entry.sprite);
  return {
    sync(list = []) {
      const seen = new Set();
      for (const spec of list) {
        seen.add(spec.id);
        if (spec.roofed) roofed.add(spec.id); else roofed.delete(spec.id);
        const shape = JSON.stringify(spec.areas), cover = !!spec.cover, edge = spec.edge ?? 1, strength = spec.strength ?? 1, sheenOn = spec.sheen !== false;
        let entry = known.get(spec.id);
        if (!entry) { entry = { id: spec.id, scale: spec.scale ?? 1, clip: !!spec.shore, look: spec.look, shape, cover, edge, strength, sheenOn, mesh: null, sprite: null, image: null, old: null, running: false }; known.set(spec.id, entry); start(entry, spec, false); continue; }
        if (entry.scale === (spec.scale ?? 1) && entry.clip === !!spec.shore && entry.look === spec.look && entry.shape === shape && entry.cover === cover && entry.edge === edge && entry.strength === strength && entry.sheenOn === sheenOn) continue;
        // Only a new look on the same shape and edge crosses the floor; anything else shows at once.
        const animate = entry.look !== spec.look && entry.shape === shape && entry.edge === edge;
        entry.scale = spec.scale ?? 1; entry.clip = !!spec.shore; entry.look = spec.look; entry.shape = shape; entry.cover = cover; entry.edge = edge; entry.strength = strength; entry.sheenOn = sheenOn;
        start(entry, spec, animate);
      }
      for (const [id, entry] of known) if (!seen.has(id)) { dropAll(entry); known.delete(id); }
    },
    tick(seconds, { sky = () => null, view = () => null, lights = () => [], weather = () => null, flash = () => null, shade = () => null, wind = 0, mostLights = MOST_FLOOR_LIGHTS } = {}) {
      clock += seconds;
      const shadeNow = shade();
      // The same sky as the floors: the sun and moon twice a second, the lights five times, a lightning flash each frame while it lasts.
      let light = null;
      const sheens = [...known.values()].some((entry) => entry.sheen);
      if (sheens) {
        const struck = flash(), lookUp = clock >= skyAt || !!struck || flashing; flashing = !!struck;
        if (lookUp) { skyAt = clock + SKY_EVERY; light = struck ? { ...skyForFloors(struck), color: [0.85, 0.9, 1] } : skyForFloors(sky(), weather()?.clouds); }
        if (clock >= lightsAt) { lightsAt = clock + LIGHTS_EVERY; lightsNow = floorLights(lights(), view(), mostLights); }
      }
      for (const [id, entry] of known) {
        if (entry.pending) start(entry, entry.pending.spec, entry.pending.animate);
        if (entry.sheen) {
          const w = entry.sheen.shader.uniforms;
          shadeWith(w, shadeNow);
          if (light) { w.uSun = roofed.has(id) ? 0 : light.shine; w.uToSun = light.toSun; w.uSunColor = light.color; w.uGlare = glareAt(entry.box, light); }
          w.uTime = clock; w.uWind = roofed.has(id) ? 0 : wind; w.uLights = lightsNow.lights; w.uLightColors = lightsNow.colors; w.uLightCount = lightsNow.count;
          entry.sheen.visible = w.uSun > 0.01 || lightsNow.count > 0;
        }
        if (entry.running) {
          entry.mix = Math.min(1, entry.mix + seconds / Math.max(0.01, entry.seconds));
          entry.uniforms.uMix = entry.mix;
          if (entry.mix >= 1) { entry.running = false; dropMesh(entry); free(entry.old); entry.old = null; showImage(entry); }
        } else if (breathing(entry)) {
          const [rate, low] = BREATHING[entry.look];
          entry.sprite.alpha = low + (1 - low) * (0.5 + 0.5 * Math.sin(clock * rate + seedOf(entry.id)));
        }
      }
    },
    clear() { for (const entry of known.values()) dropAll(entry); known.clear(); },
    get busy() { for (const entry of known.values()) if (entry.pending || entry.running || entry.sheen || breathing(entry)) return true; return false; },
    get count() { let n = 0; for (const entry of known.values()) if (entry.sprite || entry.mesh) n++; return n; },
  };
}

// What it draws with, for warming ahead of the first frame (scene-shaders.mjs).
export const FLOOR_SHADER_SOURCES = Object.freeze([[VERT, SHOW_FRAG], [VERT, SHEEN_FRAG], [VERT, FINISH_FRAG], [BLADE_VERT, BLADE_FRAG], [BLADE_SHADOW_VERT, BLADE_SHADOW_FRAG]]);
