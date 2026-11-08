// Moving water: a live surface on a water region. Waves run along its current and before the wind, the map seen through them bends, and the
// sun, the moon and any flame near glint on them. It lies on the map under the floor layers, so what a region paints (floor-looks.mjs) covers it,
// and the shadows, the creatures and the darkness all fall on it as on the map. One quad a region, drawn only while it is in view.

import { OVER_SHADOWS as OVER_SHADOW_CODES } from './region-steps.mjs';
import { floorLights, glareAt, SHORE_LINE, skyForFloors, SUN_REACH, sunUniforms } from './floor-looks.mjs';

// How each kind of water moves: rough how big its waves, pace how fast it runs, foam how white it breaks, swell how long its waves, streak (a fall) drawn out the way it falls.
export const WATER_MOTION = Object.freeze({
  still: { rough: 1, pace: 0, foam: 0, swell: 1, streak: 0 },
  river: { rough: 1, pace: 1, foam: 0, swell: 1, streak: 0 },
  rapids: { rough: 2.1, pace: 2.2, foam: 0.75, swell: 0.75, streak: 0 },
  falls: { rough: 1.5, pace: 4.5, foam: 1, swell: 1, streak: 1 },
  sea: { rough: 1.2, pace: 0, foam: 0.8, swell: 1.4, streak: 0, sea: 1 },
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
const MOST_FISH = 14, MOST_LIGHTS = 6, MOST_RINGS = 16, RING_LIFE = 3, SKY_EVERY = 0.5, LIGHTS_EVERY = 0.2;

const VERT = `precision highp float;
attribute vec2 aVertexPosition;
uniform mat3 projectionMatrix, translationMatrix;
varying vec2 vWorld;
void main(){ vWorld = aVertexPosition; gl_Position = vec4((projectionMatrix * translationMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0); }`;

const LIGHT_THROUGH = Object.freeze(['stained', 'frosted', 'leaded']);
export const OVER_PATTERNS = `// How much of what stands over the water stops the sun at a point of it (1 all, 0 none): solid, or the gaps it is built with. kind: its place in OVER_SHADOWS; across: 1 where its boards follow one another across the map.
float overBar(float x, float wide){ return 1.0 - smoothstep(wide, wide + 0.05 + uOverSoft, abs(fract(x) - 0.5)); }
float overPattern(vec2 at, float kind, float across){
  if (kind < 0.5) return 1.0;
  vec2 way = across > 0.5 ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  float along = dot(at, way) / uGrid, side = dot(at, vec2(-way.y, way.x)) / uGrid;
  if (kind < 1.5) return 1.0 - overBar(along * 3.0, 0.05) * (0.55 + 0.45 * noise(vec2(floor(along * 3.0) * 7.0, 2.0)));
  if (kind < 2.5) return 1.0 - overBar(along * 1.6 + (noise(vec2(along * 0.6, 3.0)) - 0.5) * 0.25, 0.14 + 0.06 * noise(vec2(floor(along * 1.6) * 5.0, 4.0)));
  if (kind < 3.5) return max(overBar(along * 0.75, 0.12), overBar(side * 0.9 + 0.5, 0.1));
  if (kind < 4.5) return smoothstep(0.34 - uOverSoft, 0.6 + uOverSoft, noise(at / (uGrid * 0.42) + uTime * 0.03) * 0.7 + noise(at / (uGrid * 0.14) - uTime * 0.05) * 0.3);
  if (kind < 5.5) return smoothstep(0.3, 0.36 + uOverSoft, length(vec2(fract(along * 0.5) - 0.5, (fract(side * 0.33) - 0.5) * 1.4)));
  if (kind < 6.5) return max(overBar(along * 4.0, 0.11), overBar(side * 4.0, 0.11));
  if (kind < 7.5) return 0.8;
  if (kind < 8.5) return 0.34 + 0.16 * noise(at / (uGrid * 0.2));
  if (kind < 9.5) return max(0.22, max(overBar(along * 1.5, 0.035), overBar(side * 1.5, 0.035)));
  if (kind < 10.5) return 0.32;
  return 0.26 + 0.74 * (1.0 - smoothstep(0.0, 0.025 + uOverSoft * 0.1, abs(noise(at / (uGrid * 0.55)) + noise(at / (uGrid * 0.2)) * 0.25 - 0.62)));
}`;

// `full`: three sizes of wave, the rings of what steps in it, and small water at the bank. Otherwise two sizes, and no more.
const fragOf = (full) => `precision highp float;
#define FULL ${full ? 1 : 0}
varying vec2 vWorld;
uniform sampler2D uSand; // the beach: the sand floor's own painted tile
uniform float uSandSize;
uniform float uPeak; // the most of the region's shape any point holds, as a narrow stream never reaches full
uniform float uAimed; // 1: its waves come from one side, told or because it is too small to have an open sea of its own; 0: they come in on every shore
uniform float uWaveClock, uWaveGap; // waves from one side: how many have gone by, and how many squares lie between them
uniform float uSeaState, uSwellLong, uSwellClock; // and how rough the sea has grown, 0 to 1, how long its swells are, and how far they have moved
uniform float uBreakSize; // and how far foam reaches for the size of the water, 1 on wide water
uniform sampler2D uCells; // foam's cells, one tile (foamCells): red how far from a cell's middle, green how far from its wall
uniform sampler2D uOver; // what stands over the water: red its shape, as dark as its shadow is; green more softly, for the dark right under it; blue which shadow it throws, and which way its boards go
uniform float uOverOn, uOverLift; // how far (px) its shadow falls with the sun well up
uniform float uOverWatery; // 1: shade on water is a deeper blue with the waves still in it, as water mostly shows the sky
uniform float uOverSoft; // how soft the patterns in its shadow are
uniform sampler2D uMap, uMask, uFlow, uWaves, uBed; // uBed: a painted floor seen through it instead of the map, one every uBedSize px
uniform vec4 uMapRect, uBox;
uniform float uPix; // how many screen pixels a grid square is right now
uniform vec4 uFish[${MOST_FISH}]; // x, y, heading, world pixels to one unit of a fish
uniform float uFishSwing[${MOST_FISH}], uFishCount, uFishDim;
uniform sampler2D uFishLook; uniform float uFishLookOn; // the fish's own picture (wildlife's, in the painted look), when there is one
uniform float uTime, uWind, uGrid, uCurrent, uSun, uFrozen, uLightCount, uStill, uRough, uFoam, uSwell, uStreak, uBedSize, uStrength, uSea, uBeach, uSoft, uBedColour, uDepthHold, uDepthDark, uDepthTint;
uniform vec2 uWindDir, uSwellDir, uToSun, uGlare, uDown, uRun; // uRun: where a fall starts and ends, along uDown
uniform vec3 uSunColor;
uniform vec4 uLights[${MOST_LIGHTS}];
uniform vec3 uLightColors[${MOST_LIGHTS}];
#if FULL
uniform vec4 uRings[${MOST_RINGS}];
#endif
float noise(vec2 p){ vec2 i = floor(p), f = p - i; f = f * f * (3.0 - 2.0 * f); float a = fract(sin(dot(i, vec2(127.1, 311.7))) * 43758.5), b = fract(sin(dot(i + vec2(1.0, 0.0), vec2(127.1, 311.7))) * 43758.5), c = fract(sin(dot(i + vec2(0.0, 1.0), vec2(127.1, 311.7))) * 43758.5), d = fract(sin(dot(i + vec2(1.0, 1.0), vec2(127.1, 311.7))) * 43758.5); return mix(mix(a, b, f.x), mix(c, d, f.x), f.y); }
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
${SHORE_LINE}
${SUN_REACH}
// Sea foam, one field from new to old. Fresh it is a dense white rope, its edge broken up by the bubbles; as it ages it draws back into clumps and strings, then threads around wide patches of dark water, then nothing. It goes by getting thinner, never by going see-through, so there is no grey film. Three sizes of bubble, bent so no wall runs straight, carried slowly along and always jostling.
vec2 foamWeb(vec2 w, float fresh){
  vec2 at = vec2(dot(w, vec2(-uSwellDir.y, uSwellDir.x)), dot(w, uSwellDir) * 0.8 - uTime * 0.07);
  vec2 bend = vec2(noise(at * 1.1 + uTime * 0.04), noise(at * 1.1 + 9.0 - uTime * 0.03)) - 0.5, curl = vec2(noise(at * 4.1 + 2.0), noise(at * 4.1 + 17.0)) - 0.5, wob = vec2(noise(at * 11.0 + 5.0), noise(at * 11.0 + 29.0)) - 0.5;
  vec2 hair = vec2(noise(at * 27.0 + 3.0), noise(at * 27.0 + 37.0)) - 0.5;
  vec2 p = at + bend * 0.5 + curl * 0.11 + wob * 0.055 + hair * 0.014;
  // How thick it is here: new foam is thick all over, old foam only in clumps and strings, and with next to none left there is nothing to clump.
  vec2 q = at * 1.9 + bend * 1.2 + 31.0;
  float lumps = noise(q) * 0.5 + noise(q * 2.1 + 3.1) * 0.3 + noise(q * 4.3 + 7.7) * 0.2;
  float thick = clamp(fresh * 1.2 + (lumps - 0.5) * 1.5 * (1.0 - 0.45 * fresh) * smoothstep(0.0, 0.3, fresh) - 0.12, 0.0, 1.0);
  if (thick <= 0.0) return vec2(0.0, 1.0);
  // Each size of thread gets at least a pixel's softness, and goes altogether once its bubbles are too small to see, or it would shimmer as the view moves.
  float px = 1.0 / max(uPix, 1.0), fill = thick * thick;
  float wide = bubbles(p * 5.5, uTime * 0.3).y, small = bubbles(p * 15.0 + 3.0, uTime * 0.5).y;
  float wideAt = 0.015 + 0.95 * fill, smallAt = 0.02 + 0.8 * fill;
  float big = (1.0 - smoothstep(wideAt, wideAt + max(0.045 + 0.05 * fill, 8.0 * px), wide)) * smoothstep(0.015, 0.2, thick) * smoothstep(0.2, 0.48, noise(p * 8.0 + 41.0) + thick * 1.2);
  float mid = (1.0 - smoothstep(smallAt, smallAt + max(0.07, 22.0 * px), small)) * smoothstep(0.03, 0.3, thick) * 0.8 * smoothstep(0.22, 0.5, noise(p * 19.0 + 13.0) + thick * 1.2) * (1.0 - smoothstep(0.2, 0.45, 15.0 * px));
  float cover = max(big, mid), glint = 0.0;
#if FULL
  float seen = 1.0 - smoothstep(0.2, 0.45, 37.0 * px);
  if (seen > 0.0) {
    float tiny = bubbles(p * 37.0 + 8.0, uTime * 0.7).y;
    cover = max(cover, (1.0 - smoothstep(0.05 + 0.7 * fill, 0.16 + 0.7 * fill, tiny)) * smoothstep(0.2, 0.6, thick) * 0.55 * seen);
    glint = 0.06 * smoothstep(0.0, 0.3, tiny) * seen;
  }
#endif
  cover = max(cover, smoothstep(0.6, 0.86, thick + (small - 0.25) * 0.35));
  // How it catches the light: billows tumbling along with the wave, churned by others going another way, with soft shade between them.
  vec2 b = p * 6.0 + 21.0 + vec2(0.0, -uTime * 1.1), c = p * 13.0 + 4.0 + uTime * vec2(0.5, 0.75);
  float billow = noise(b) * 0.6 + noise(b * 2.1 + 3.1) * 0.4, churn = noise(c);
  return vec2(cover, 0.78 + 0.2 * smoothstep(0.25, 0.75, billow) + 0.09 * smoothstep(0.3, 0.7, churn) + glint);
}
// Two wave fronts, as one: the nearer shore wins, and they run together smoothly where they meet.
float waveJoin(float a, float b, float k){ float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0); return mix(b, a, h) - k * h * (1.0 - h); }
// How far up its run a wave is over its life, 0-1: in quickly, then a long slow draw back.
float swashRun(float u){ if (u < 0.4) { float k = u / 0.4; return k * (2.0 - k); } float k = (u - 0.4) / 0.6; return 1.0 - k * k * (3.0 - 2.0 * k); }
// How much foam it still has: all of it coming in, thinning away going back.
float swashFoam(float u){ return min(1.0, u / 0.08) * (u < 0.4 ? 1.0 : pow(1.0 - (u - 0.4) / 0.6, 1.4)); }
// One size of wave: the sheet slid along the way the water goes, twice, each fading out before it has slid too far, so it never stretches.
vec2 waves(float size, vec2 drift, float pa, float pb, float wa, float wb, float seed){
  vec2 base, run;
  if (uStreak > 0.5) { base = vec2(dot(vWorld, vec2(-uDown.y, uDown.x)) / (uGrid * size * 0.3), dot(vWorld, uDown) / (uGrid * size * 2.6)) + seed; run = vec2(0.0, length(drift) / (uGrid * size * 2.6)); }
  else { base = vWorld / (uGrid * size) + seed; run = drift / (uGrid * size); }
  return (texture2D(uWaves, base - run * pa).xy * 2.0 - 1.0) * wa + (texture2D(uWaves, base - run * pb + 0.37).xy * 2.0 - 1.0) * wb;
}
// The shape of a fish at off from it, heading z, one unit w world pixels. Its body stops at its nose and tail: past them it has no width, and the soft edge alone would still draw a line.
float fishShape(vec2 off, vec4 fish, float swing, float soft){
  float turnC = cos(fish.z), turnS = sin(fish.z); vec2 q = vec2(turnC * off.x + turnS * off.y, turnC * off.y - turnS * off.x) / fish.w;
  float bendAt = max(q.y + 20.0, 0.0) / 52.0; q.x -= swing * bendAt * bendAt * 7.0;
  float along = (q.y + 4.0) / (q.y < -4.0 ? 16.0 : 24.0), wide = 5.4 * sqrt(max(0.0, 1.0 - along * along)), fin = clamp((q.y - 18.0) / 14.0, 0.0, 1.0);
  float body = (1.0 - smoothstep(wide - soft, wide + soft, abs(q.x))) * (1.0 - smoothstep(0.9, 1.05, abs(along))), tail = (1.0 - smoothstep(1.4 + 4.4 * fin * fin - soft, 1.4 + 4.4 * fin * fin + soft, abs(q.x))) * smoothstep(15.0, 18.0, q.y) * (1.0 - smoothstep(30.0, 33.0, q.y));
  return max(body, tail);
}
// The fish's own picture at off from it, bent as fishShape bends it: wildlife's frame is 40 x 72 of its units, nose up, its middle the fish's place.
vec4 fishLookAt(vec2 off, vec4 fish, float swing){
  float turnC = cos(fish.z), turnS = sin(fish.z); vec2 q = vec2(turnC * off.x + turnS * off.y, turnC * off.y - turnS * off.x) / fish.w;
  float bendAt = max(q.y + 20.0, 0.0) / 52.0; q.x -= swing * bendAt * bendAt * 7.0;
  vec2 uv = vec2((q.x + 20.0) / 40.0, (q.y + 36.0) / 72.0);
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return vec4(0.0);
  return texture2D(uFishLook, uv);
}
${OVER_PATTERNS}
// One set of waves from one side where they break. dense how thick the foam, thinning behind each front; line the bright edge of a front; dark the shade just ahead of a crest; milk the pale water it leaves. Fronts wander and join, breaking in stretches at first and all along them nearer the shore. No backticks in here.
void breaker(vec2 w, float from, vec2 dir, float gap, float clock, float seed, float near, inout float dense, inout float line, inout float dark, inout float milk) {
  vec2 side = vec2(-dir.y, dir.x);
  float across = dot(w, side), bend = (noise(w * 0.1 + seed) - 0.5) * 3.2 + (noise(w * 0.33 + seed * 2.0) - 0.5) * 0.9 + (noise(w * 1.3 + seed) - 0.5) * 0.22;
  float passed = clock - (from + bend) / gap, index = floor(passed), part = passed - index, since = part * gap, toCome = (1.0 - part) * gap, own = fract(sin((index + seed * 7.0) * 12.9898) * 43758.5453);
  float stretches = smoothstep(0.28, 0.6, noise(vec2(across * 0.3 + own * 37.0, index * 3.1 + seed)));
  float breaks = near * mix(stretches, 1.0, smoothstep(0.35, 0.85, near) * smoothstep(0.25, 0.7, uSeaState)) * (0.6 + 0.4 * own) * smoothstep(0.03, 0.3, uSeaState);
  float reach = mix(0.16, 2.0, pow(uSeaState, 1.5)) * uBreakSize * (0.45 + 1.1 * noise(vec2(across * 0.55 + own * 11.0, own * 5.0))) * (0.55 + 0.75 * near);
  float rough = (noise(vec2(across * 2.6, own * 9.0)) - 0.5) * 0.24 + (noise(vec2(across * 8.0, own * 4.0)) - 0.5) * 0.11 + (noise(vec2(across * 23.0, own * 3.0)) - 0.5) * 0.06 + 0.3, behind = max(since - rough, 0.0);
  float combed = reach * (0.72 + 0.34 * noise(vec2(across * 5.0, own * 7.0)) + 0.2 * noise(vec2(across * 16.0, own * 2.0))), head = step(rough, since);
  dense = max(dense, breaks * head * (exp(-behind / combed) * 0.86 + 0.14 * exp(-behind / (reach * 3.5))));
  line = max(line, breaks * head * exp(-behind / 0.05));
  dark = max(dark, (0.3 + 0.7 * near) * max(exp(-toCome / 0.75), exp(-since / 0.3)) * (0.3 + 0.7 * uSeaState));
  milk = max(milk, breaks * head * exp(-behind / (reach * 2.8)));
}
void main(){
  vec2 uv = (vWorld - uBox.xy) / uBox.zw;
  vec4 mask = texture2D(uMask, uv);
  if (mask.r < 0.004) { gl_FragColor = vec4(0.0); return; }
  float deep = min(1.0, mask.g * uDepthHold), calm = 1.0 - uFrozen;
  vec3 flowed = texture2D(uFlow, uv).rgb;
  // Along the current, before the wind. A river slower than its usual slows everything on it.
  vec2 along = (flowed.xy * 2.0 - 1.0) * flowed.z;
  // (A short cycle and a small slide: it never goes far enough for a bend in the river to shear the pattern. Each place has its own part of the cycle, so nothing pulses.)
  // (The sea is never still, wind or none, and its waves may go their own way.)
  float windy = uSea > 0.5 ? max(uWind, 0.45) : uWind;
  vec2 drift = (along * uCurrent * uGrid * 0.9 + (uSea > 0.5 ? uSwellDir : uWindDir) * uGrid * (0.04 + 0.3 * windy) * uStill) * ${FLOW_CYCLE.toFixed(2)};
  float phase = noise(vWorld / (uGrid * ${FLOW_PHASE.span.toFixed(1)})) * ${FLOW_PHASE.amount.toFixed(2)}, pa = fract(uTime / ${FLOW_CYCLE.toFixed(2)} + phase), pb = fract(pa + 0.5), wa = 1.0 - abs(2.0 * pa - 1.0), wb = 1.0 - wa;
  // A fall: it comes down to the line where it lands, near its foot, a strong one thrown a little further out; below that is the pool it lands in.
  float land = mix(0.78, 0.86, uStrength), way = 0.0, landed = 0.0;
  if (uStreak > 0.5) { way = clamp((dot(vWorld, uDown) - uRun.x) / max(1.0, uRun.y - uRun.x), 0.0, 1.0) + (noise(vWorld / (uGrid * 0.7)) - 0.5) * 0.06; landed = smoothstep(land - 0.025, land + 0.05, way); }
  vec2 slope = waves(4.6 * uSwell, drift * 0.55, pa, pb, wa, wb, 0.0) * (0.035 + 0.09 * windy) + waves(1.5 * uSwell, drift, pa, pb, wa, wb, 0.61) * (0.05 + 0.16 * windy);
#if FULL
  slope += waves(0.48 * uSwell, drift * 1.5, pa, pb, wa, wb, 0.23) * (0.025 + 0.2 * windy);
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
  float rough = length(slope), crest = 0.0, swell = 0.0;
  float depth = flowed.x, bore = 0.0, spray = 0.0, surfCrest = 0.0, facing = 1.0;
  vec2 heave = vec2(0.0); // a swell's tilt: it shades the water and bends what is under it, but is too broad to glint, or a whole crest would flash
  if (uSea > 0.5) {
    // The sea: long swells rolling before the wind, shorter ones crossing them, their lines bent a little so none runs straight. Each only ever moves its own way, so nothing shears.
    vec2 w = vWorld / uGrid, one = uSwellDir, two = normalize(uSwellDir + vec2(0.7, -0.4)), three = normalize(uSwellDir + vec2(-0.5, 0.6));
    float bent = noise(w * 0.35) * 3.5, lift = (0.09 + 0.16 * windy) * calm * mix(1.0, 0.4 + 1.1 * uSeaState, uAimed), swellLong = mix(1.0, uSwellLong, uAimed), swellTime = mix(uTime, uSwellClock, uAimed);
    float a1 = dot(w, one) * 1.1 / swellLong - swellTime * 1.05 + bent, a2 = dot(w, two) * 1.9 / swellLong - swellTime * 1.4 + bent * 0.7, a3 = dot(w, three) * 3.1 / swellLong - swellTime * 1.8 + bent * 0.4;
    heave = (one * cos(a1) + two * cos(a2) * 0.6 + three * cos(a3) * 0.35) * lift * (0.35 + 0.65 * smoothstep(0.0, 0.8, mask.b));
    swell = pow(0.5 + 0.5 * sin(a1), 8.0) + 0.5 * pow(0.5 + 0.5 * sin(a2), 10.0);
    // Coming in over the shallows, as real waves do. Slowed by them, the crests swing round to lie along the shore. They crowd and steepen as it shoals, in sets, one surface, so where they meet they are simply one.
    vec2 e = vec2(uGrid * 0.3) / uBox.zw, toDeep = vec2(texture2D(uFlow, uv + vec2(e.x, 0.0)).r - texture2D(uFlow, uv - vec2(e.x, 0.0)).r, texture2D(uFlow, uv + vec2(0.0, e.y)).r - texture2D(uFlow, uv - vec2(0.0, e.y)).r);
    float grade = length(toDeep), surf = (1.0 - smoothstep(0.55, 0.95, depth)) * smoothstep(0.002, 0.02, grade); toDeep /= max(grade, 0.001);
    // Waves from one side break on the shore they run into, and hardly lap the one they left.
    facing = mix(1.0, mix(0.1, 1.0, smoothstep(-0.25, 0.55, -dot(uSwellDir, toDeep))), uAimed);
    heave *= 1.0 - surf;
    // (All of this turned off the grid and bent: noise on the grid runs in straight lines, which would cut a wave off square.)
    vec2 turnA = vec2(w.x * 0.8 - w.y * 0.6, w.x * 0.6 + w.y * 0.8), turnB = vec2(w.x * 0.38 + w.y * 0.92, w.y * 0.38 - w.x * 0.92), bentA = turnA + (noise(turnB * 1.1) - 0.5) * 0.6;
    float shoal = sqrt(depth + 0.02), wander = noise(turnA * 0.22) * 2.2 + noise(turnB * 0.7 + 4.0) * 0.6, phase = mix(shoal * 26.0 + uTime * 1.25, 6.28318 * (uWaveClock - dot(w, one) / uWaveGap), uAimed) + wander;
    float sets = 0.55 + 0.45 * sin(uTime * 0.19 - shoal * 2.0 + noise(w * 0.16) * 4.0), rip = smoothstep(0.2, 0.62, noise(vec2(w.x * 0.8 - w.y * 0.6, w.x * 0.6 + w.y * 0.8) * 0.28 + 7.0));
    heave -= toDeep * sin(phase) * (0.05 + 0.13 * (1.0 - depth)) * (0.6 + 0.4 * windy) * surf * sets * calm * facing;
    surfCrest = pow(0.5 + 0.5 * cos(phase), 1.0 + 3.0 * (1.0 - depth)) * surf * sets * facing;
    // Where it gets too shallow they break: foam along the wave's front, running in with it, trailing away behind.
    float behind = fract((phase + (noise(bentA * 2.4) - 0.5) * 0.85 + (noise(turnB * 6.5 + bentA) - 0.5) * 0.5 + (noise(bentA * 17.0) - 0.5) * 0.28) / 6.28318), breaking = (1.0 - smoothstep(0.34, 0.62, depth)) * smoothstep(0.02, 0.1, depth);
    bore = max(pow(1.0 - smoothstep(0.0, 0.72, behind), 1.5), smoothstep(0.965, 1.0, behind)) * breaking * (0.45 + 0.55 * sets) * (0.5 + 0.5 * rip) * calm * (1.0 - uAimed);
    // Spray torn off the crest, on whichever side of it the wind blows to: seawards behind it, or ashore ahead of it.
    float blown = dot(uWindDir, toDeep);
    spray = max(exp(-behind * 5.0) * max(blown, 0.25), smoothstep(0.86, 0.985, behind) * max(-blown, 0.25)) * breaking * (0.45 + 0.55 * sets) * (0.5 + 0.5 * rip) * calm * (1.0 - uAimed) * (0.35 + 0.65 * windy);
  }
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
  vec2 seen = vWorld + (slope + heave) * uGrid * 0.55 * (0.4 + 0.6 * deep);
  vec3 col;
  if (uBedSize > 0.0) {
    // Its painted floor, sampled twice so it does not read as a repeat. A painted water floor gives only its colour (the blurred picture): its waves are drawn in it, and these are the real ones. A floor under the water keeps its detail.
    vec2 tile = seen / uBedSize; float blur = uBedColour > 0.5 ? 7.0 : 0.0;
    col = mix(texture2D(uBed, tile, blur).rgb, texture2D(uBed, vec2(tile.y, -tile.x) * 0.93 + 0.37, blur).rgb, smoothstep(0.38, 0.62, noise(seen / (uGrid * 3.0))));
  } else {
    col = texture2D(uMap, clamp((seen - uMapRect.xy) / uMapRect.zw, 0.0, 1.0)).rgb;
    col = mix(col, col * vec3(0.72, 0.86, 0.9) + vec3(0.004, 0.016, 0.022), deep * 0.55 * calm);
  }
  if (uDepthTint > 0.5) {
    // A clear sea: pale turquoise over the shallows to deep blue offshore, unevenly over the bottom.
    vec2 w = vWorld / uGrid;
    float clear = clamp((uSea > 0.5 ? depth : deep) * 1.15 + (noise(w * 0.3 + 3.0) * 0.6 + noise(w * 0.9) * 0.25 - 0.42) * 0.42, 0.0, 1.0);
    col = mix(col, mix(mix(vec3(0.42, 0.78, 0.76), vec3(0.06, 0.5, 0.56), smoothstep(0.0, 0.5, clear)), vec3(0.025, 0.25, 0.37), smoothstep(0.42, 1.0, clear)), 0.92 * calm);
  }
  if (uSea > 0.5) {
    // Sea water: its own colour over what lies under it, paler over the shallows, dark in its troughs and lit along its crests.
    float shallow = 1.0 - smoothstep(0.08, 0.85, depth);
    col = mix(col, mix(vec3(0.02, 0.11, 0.17), vec3(0.09, 0.4, 0.41), shallow * shallow), 0.62 * min(1.0, uDepthHold) * calm * (1.0 - uDepthTint));
    col *= 1.0 + (min(swell, 1.0) * mix(0.28, 0.1 + 0.42 * uSeaState, uAimed) * (1.0 - shallow) - 0.06 + surfCrest * 0.2) * calm;
    // Air on the water, however light, the way the waves go: fine ripples across it, soft bands in time with the waves, and gusts drifting over as darker, ruffled patches. All of it slow.
    if (uAimed > 0.5) {
      vec2 air = vWorld / uGrid - (uBox.xy + uBox.zw * 0.5) / uGrid;
      float airGrain = clamp(uGrid / 70.0, 1.0, 3.0), airAlong = dot(air, uSwellDir), airAcross = dot(air, vec2(-uSwellDir.y, uSwellDir.x));
      float ripples = noise(vec2(airAcross * 3.0 * airGrain, airAlong * 9.0 * airGrain - uTime * 0.7)) * 0.6 + noise(vec2(airAcross * 7.0 * airGrain + uTime * 0.2, airAlong * 19.0 * airGrain - uTime * 1.1)) * 0.4;
      float gust = smoothstep(0.5, 0.74, noise(vec2(airAcross * 0.42 + 3.0, airAlong * 0.3 - uTime * 0.12)) * 0.7 + noise(vec2(airAcross * 1.1 + 8.0, airAlong * 0.8 - uTime * 0.3)) * 0.3);
      float band = sin(6.28318 * (uWaveClock - (airAlong + (noise(air * 0.1 + 1.0) - 0.5) * 3.2) / uWaveGap));
      col *= 1.0 + (band * (0.04 + 0.03 * uSeaState) + (ripples - 0.5) * (0.11 + 0.1 * uSeaState) * (1.0 + 0.9 * gust) - gust * 0.09 * (1.0 - 0.5 * uSeaState)) * calm;
    }
  }
  // Fish, under it all: bent by the waves as the bed is, soft, fainter the deeper, each with its shadow on the bed just off it; the light, the glare and the foam all go over them.
  for (int i = 0; i < ${MOST_FISH}; i++) {
    if (float(i) >= uFishCount) break;
    vec4 fish = uFish[i]; vec2 off = seen - fish.xy;
    if (dot(off, off) > fish.w * fish.w * 2300.0) continue;
    float hazy = uSea > 0.5 ? depth : deep, soft = 1.2 + 1.6 * hazy;
    if (uFishLookOn > 0.5) {
      // its painted picture seen through the water: its shadow on the bed, then the fish itself, its colours sunk toward the water's
      col *= 1.0 - 0.34 * fishLookAt(off - vec2(0.055, 0.075) * uGrid, fish, uFishSwing[i]).a * uFishDim * calm;
      vec4 look = fishLookAt(off, fish, uFishSwing[i]); vec3 own = look.rgb / max(look.a, 0.001);
      col = mix(col, own * mix(vec3(0.82, 0.9, 0.9), vec3(0.4, 0.52, 0.54), 0.3 + 0.5 * hazy) * (col / max(0.001, dot(col, vec3(0.33))) * 0.12 + 0.78), look.a * uFishDim * (1.0 - 0.45 * hazy) * calm);
    } else {
      col *= 1.0 - 0.34 * fishShape(off - vec2(0.055, 0.075) * uGrid, fish, uFishSwing[i], soft + 2.6) * uFishDim * calm;
      col = mix(col, col * vec3(0.24, 0.3, 0.32), fishShape(off, fish, uFishSwing[i], soft) * uFishDim * (1.0 - 0.45 * hazy) * calm);
    }
  }
  // Deep water: its own dark, thickest away from the bank, between the eye and the bed and fish; its light and foam go over it.
  col = mix(col, vec3(0.012, 0.055, 0.075), uDepthDark * smoothstep(0.0, 0.6, mask.g) * calm);
  // How much sun or moon gets here, past walls, roofs and trees.
  float sunHere = uSun * sunReach(vWorld);
  // A low sun's sky lying on the water: warmer the lower it stands.
  float evening = clamp((0.62 - uSunColor.b) / 0.45, 0.0, 1.0) * sunHere;
  col = mix(col, col * vec3(1.3, 0.95, 0.74) + vec3(0.075, 0.03, 0.0), evening * 0.4);
  // What stands over the water: its shadow lies away from the sun, longer as the sun gets low, trembling with the waves, and takes the sun off what is under it, glitter and all; and it is dark right under it, whatever the sun does.
  float overShade = 0.0, overUnder = 0.0, overStained = 0.0; vec2 overAt = vWorld;
  if (uOverOn > 0.5) {
    vec2 toward = uToSun * uOverLift * (1.0 + 1.6 * clamp((0.62 - uSunColor.b) / 0.45, 0.0, 1.0)) + (slope + heave) * uGrid * 0.14;
    vec4 over = texture2D(uOver, (vWorld + toward - uBox.xy) / uBox.zw);
    float code = floor(over.b * 255.0 / 8.0 + 0.5), overKind = floor(code / 2.0);
    overAt = vWorld + toward;
    overShade = over.r * overPattern(overAt, overKind, code - overKind * 2.0) * (0.25 + 0.75 * uSun);
    if (overKind > 6.5 && overKind < 7.5) overStained = over.r;
    overUnder = max(texture2D(uOver, uv).g * 0.6, texture2D(uOver, uv + uToSun * uGrid * 0.24 / uBox.zw).g * 0.75);
    sunHere *= 1.0 - min(1.0, overShade * 2.2) * 0.92;
  }
  // The sky on what tilts away from the eye.
  vec3 n = normalize(vec3(-slope, 1.0));
  col += mix(vec3(0.4, 0.46, 0.5), uSunColor, 0.35) * smoothstep(0.02, 0.24, rough) * 0.1 * (0.25 + 0.75 * sunHere);
  // Each wave lit on the side toward the light and dark on the other, so it can be seen moving wherever the glare is not.
  col *= 1.0 + clamp(dot(slope + heave * (uSea > 0.5 ? 0.55 : 1.6), uToSun) * 2.4, -0.34, 0.34) * (0.3 + 0.7 * sunHere) * (uStreak > 0.5 ? 0.3 : 1.0);
  // Glare: a long path lying toward the light, tightest across it; what the waves tilt into that path flashes.
  vec2 rel = (vWorld - uGlare) / (uGrid * 5.0), across = vec2(-uToSun.y, uToSun.x);
  float face = normalize(vec3(-slope * 1.5 - uToSun * dot(rel, uToSun) * 0.28 - across * dot(rel, across) * (uSea > 0.5 ? 2.6 : 1.4), 1.0)).z;
  // (Falling water is too broken to hold a long glare.)
  if (uSea > 0.5) {
    // Glitter is the waves themselves: a wavelet flashes while it is tilted just so, sending the sun to the eye. Wavelets lie across the way to the sun, so the flashes are slivers lying across its path, of every size. Mid-path most faces do it and they run together into one bright sheet; further out only the steep ones, so it breaks into ribbons, then single flecks. Calm gathers it tight, a gale throws it wide.
    float gust = clamp(uWind, 0.0, 1.0);
    vec2 away = uToSun * dot(rel, uToSun) * 0.22 + across * dot(rel, across) * (1.6 - 0.5 * gust);
    if (length(away) < 1.2 + gust && sunHere > 0.0) {
    vec2 lying = vec2(dot(vWorld, uToSun), dot(vWorld, across)) / uGrid, drifted = vec2(dot(uWindDir, uToSun), dot(uWindDir, across)) * uTime;
    // (Bent, and at sizes that never line up, or the wave map's repeats show as rows.)
    vec2 bent_ = lying + (vec2(noise(lying * 0.7), noise(lying * 0.7 + 9.0)) - 0.5) * 0.55 + (vec2(noise(lying * 2.3 + 4.0), noise(lying * 2.3 + 13.0)) - 0.5) * 0.12;
    vec2 broad = bent_ * vec2(1.9, 0.83) + drifted * vec2(0.8, 0.3), fine_ = bent_ * vec2(5.1, 2.2) - drifted * vec2(1.6, 0.6) + 0.37;
    vec2 wavelet = ((texture2D(uWaves, broad).xy * 2.0 - 1.0) + (texture2D(uWaves, fine_).xy * 2.0 - 1.0) * 0.6) * (0.5 + 0.75 * gust) * calm;
    float core = 1.0 - smoothstep(0.0, 0.3 + 0.2 * gust, length(away));
    // Some stretches of water are catching it and some not, so it comes in drifts.
    float catching = smoothstep(0.3, 0.7, noise(lying * 0.9 + drifted * 0.08) * 0.6 + noise(lying * 2.7 - drifted * 0.15) * 0.4);
    float reach = (0.036 + 0.075 * catching + 0.13 * core * core) * (1.0 + 0.6 * gust);
    float miss = length(slope * (1.3 - 0.7 * gust) + heave * 0.55 + wavelet + away), flash = smoothstep(reach, reach * 0.15, miss); flash *= sqrt(flash);
    // White where it burns, the sun's own colour as it thins, so a low sun lays down gold. Soft to its bright middle, not cut out.
    col = mix(col, mix(uSunColor, vec3(1.0), (0.1 + 0.55 * core) * uSunColor.b), min(1.0, flash * (0.8 + 0.35 * core) * sqrt(sunHere)));
    }
    col += mix(uSunColor, vec3(0.62, 0.8, 1.0), 0.45 * uSunColor.b) * (pow(face, 60.0) * 0.11 + pow(face, 27.0) * 0.035) * sunHere;
  } else col += uSunColor * (pow(face, 520.0) * 0.28 + pow(face, 27.0) * 0.012) * sunHere * (uStreak > 0.5 ? 0.35 : 1.0);
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
  col += vec3(0.5, 0.54, 0.55) * smoothstep(0.7, 1.0, lap) * (1.0 - smoothstep(0.1, 0.75, deep)) * mask.r * 0.07 * (0.25 + 0.75 * max(sunHere, min(1.0, uLightCount))) * calm;
#endif
  // The sea's own shore. With a beach: a waterline that wanders in from the region's edge, so no straight side of the region shows, with a tide that breathes a little, and sand up to it, darkening as it nears the water. Without one the region's edge is its shore, and the water goes all the way to it.
  float seaEdge = 1.0, afloat = 1.0, offshore = 1.0, swashed = 1.0, waterline = 0.04;
  if (uSea > 0.5) {
    vec2 w = vWorld / uGrid;
    float line = uBeach > 0.5 ? shoreLine(w, mask.b) : mask.g, tide = uBeach > 0.5 ? 0.19 + sin(uTime * 0.22) * 0.012 : 0.02;
    float lap = tide + sin(uTime * 0.7 + noise(w * 1.1) * 6.0) * 0.012, under = smoothstep(lap, lap + 0.2, line);
    // What foam may be where. Breakers and spray only on the water, whitecaps only out past the shallows; only a wave already running in goes on up the wet sand, and never onto the dry.
    waterline = lap; afloat = smoothstep(lap, lap + 0.05, line); offshore = smoothstep(lap + 0.25, lap + 0.55, line); swashed = smoothstep(lap - 0.08, lap - 0.03, line);
    if (uBeach > 0.5) {
    // Dry sand: soft drifts of paler and darker, with only the faintest fine grain, turned off the grid so it can't weave.
    vec2 turned = vec2(w.x * 0.8 - w.y * 0.6, w.x * 0.6 + w.y * 0.8);
    float drift = noise(turned * 0.9) * 0.5 + noise(turned * 2.6 + 4.0) * 0.32 + noise(turned * 7.0 + 9.0) * 0.18, fineSand = noise(turned * 17.0) * 0.6 + noise(turned.yx * 39.0 + 2.0) * 0.4;
    vec3 sand = mix(vec3(0.54, 0.46, 0.33), vec3(0.73, 0.64, 0.47), drift) * (0.965 + 0.07 * fineSand);
    if (uSandSize > 0.0) { vec2 tile = vWorld / uSandSize; sand = mix(texture2D(uSand, tile).rgb, texture2D(uSand, vec2(tile.y, -tile.x) * 0.93 + 0.37).rgb, smoothstep(0.38, 0.62, noise(turned * 0.8))) * (0.86 + 0.28 * drift); }
    // Wet near the water: dark and a little glossy, the sky's blue in it.
    float wet = smoothstep(tide + 0.0, tide - 0.1 - 0.05 * noise(w * 2.2), line);
    sand = mix(sand * vec3(0.5, 0.49, 0.47) + vec3(0.01, 0.018, 0.025), sand, wet);
    // Over the shallows the sand shows through, fading out as the water deepens.
    vec3 shallows = mix(sand * vec3(0.72, 0.9, 0.9) + vec3(0.01, 0.04, 0.045), col, under);
    col = mix(sand, shallows, smoothstep(lap - 0.008, lap + 0.012, line));
    }
    // The thin lip of the water, always coming and going.
    col = mix(col, vec3(0.84, 0.88, 0.88), (1.0 - smoothstep(0.0, 0.011, abs(line - lap - 0.005))) * (0.35 + 0.5 * smoothstep(0.3, 0.6, noise(w * 7.0 + uTime * 0.25))) * calm);
    // Into the land: broken up, not a line.
    if (uBeach > 0.5) { vec2 turned = vec2(w.x * 0.8 - w.y * 0.6, w.x * 0.6 + w.y * 0.8); seaEdge = smoothstep(0.0, (0.06 + 0.09 * uSoft) * (0.65 + 0.7 * noise(turned * 1.4)), mask.b + mask.b * (noise(turned * 6.0) - 0.5) * 0.5); }
  }
  // Where it runs hard it breaks white: flat on top of the water, after its light, as foam has no waves of its own.
  if (uFoam > 0.0) {
    // Foam: soft clots of bubbles. A fall has it only at its foot, where it lands, boiling in place; the stronger the stream the further up it reaches.
    float clots, foam = 0.0, foamTone = 1.0;
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
      if (uSea > 0.5) {
        // Surf: lines running in to the shore, breaking as they come, and whitecaps on the swells as the wind rises.
        float surf = sin(mask.b * 20.0 + uTime * (1.0 + 0.8 * windy) + noise(vWorld / (uGrid * 1.3)) * 6.0) * 0.5 + 0.5;
        vec2 w = vWorld / uGrid; float run = dot(w, uSwellDir), wide = dot(w, vec2(-uSwellDir.y, uSwellDir.x));
        // Whitecaps: short streaks along the crests, here and there.
        float streak = noise(vec2(run * 9.0 - uTime * 1.2, wide * 1.9)), here = smoothstep(0.5, 0.68, noise(vec2(wide * 0.9 + 3.0, run * 0.5 - uTime * 0.15)));
        float caps = smoothstep(0.7, 0.86, streak) * here * smoothstep(0.55, 1.05, swell) * (0.1 + 0.2 * uWind);
        // Waves up the shore: each comes in whole and draws back, a stretch of shore at a time, its foam going with it, breaking up into lace behind its front. The distance from the shore wanders, so no line follows the region's edge.
        float shoreAway = uBeach > 0.5 ? shoreLine(w, mask.b) : mask.b, merged = 1.25, power = 0.0, strike = 0.0;
        // All the waves make one surface: where they meet, their fronts run together into one line, and so does their foam, nothing drawn over anything.
        if (uAimed < 0.5) for (float i = 0.0; i < 2.5; i += 1.0) {
          float every = (9.0 + i * 4.0) / (0.75 + 0.5 * uWind), at = uTime / every + i * 0.37, u = fract(at), seed = floor(at) + i * 7.0, size = 0.55 + 0.45 * fract(sin(seed * 12.9) * 437.5), left = swashFoam(u);
          float lobe = smoothstep(0.22, 0.78, noise(w * 0.42 + seed * 3.1)), front = mix(1.25, mix(1.0, 0.12, swashRun(u) * size * (0.35 + 0.65 * lobe)), smoothstep(0.0, 0.25, left));
          merged = waveJoin(merged, front, 0.16);
          power = 1.0 - (1.0 - power) * (1.0 - left * exp(-pow((shoreAway - front) / 0.32, 2.0)));
          // Where a wave reaches the shore it strikes: late in its run, along its front, in bursts here and there, different ones each wave.
          float rush = smoothstep(0.12, 0.3, u) * (1.0 - smoothstep(0.42, 0.6, u)) * smoothstep(0.35, 0.65, noise(vec2(w.x * 0.8 - w.y * 0.6, w.x * 0.6 + w.y * 0.8) * 1.3 + seed * 5.3));
          strike = max(strike, rush * size * exp(-pow((shoreAway - front) / 0.08, 2.0)));
        }
        float off = shoreAway - merged, wash = 0.0;
        if (off >= -0.03 && power > 0.002) {
          float gaps = smoothstep(0.3, 0.62, noise(w * 1.1 + uTime * vec2(0.03, -0.02)) + 0.2 * power), reach = noise(w * 0.42 + 9.0);
          // (Well out, the distance from the shore stops counting: no wash there, only near land.)
          wash = power * gaps * smoothstep(-0.03, 0.0, off) * pow(1.0 - smoothstep(0.0, 0.26 + 0.24 * reach, off), 1.4) * (1.0 - smoothstep(0.62, 0.86, mask.b));
        }
        // All of it is one foam: however many waves made it, it is one web, only as new as the newest of them. The water it has just churned stays paler for a while.
        caps *= offshore; wash *= swashed; bore *= afloat; spray *= afloat;
        // Only at the very waterline: out on the water nothing has hit anything yet.
        strike *= (1.0 - smoothstep(waterline + 0.02, waterline + 0.15, shoreAway)) * smoothstep(waterline - 0.15, waterline - 0.07, shoreAway);
        spray = max(spray, strike * 0.3);
        float fresh = 1.0 - (1.0 - min(caps, 1.0)) * (1.0 - min(wash, 1.0)) * (1.0 - min(bore, 1.0)) * (1.0 - min(strike, 1.0) * 0.5);
        if (fresh > 0.01) { col = mix(col, col * 0.7 + vec3(0.16, 0.2, 0.2), fresh * 0.5 * min(uFoam, 1.0) * calm); vec2 web = foamWeb(w, fresh); foam = web.x * 0.97 * uFoam; foamTone = web.y; }
        // Waves from one side, as photographs of them show: a sharp bright front, thick foam behind it that ages into lace with holes in it, combed the way it runs, a dark band ahead of the crest and pale water behind. They break on a shore that lies ahead of them, and nowhere else.
        if (uAimed > 0.5) {
          vec2 boxMiddle = (uBox.xy + uBox.zw * 0.5) / uGrid, way = uSwellDir, side = vec2(-way.y, way.x), from = w - boxMiddle;
          float crossing = (abs(way.x) * uBox.z + abs(way.y) * uBox.w) / uGrid, travelled = dot(from, way), toShore = max(0.0, crossing * 0.5 - travelled);
          float shoreAhead = 1.0 - smoothstep(0.5, 0.85, texture2D(uFlow, (vWorld + way * uGrid * max(toShore - 0.15, 0.0) - uBox.xy) / uBox.zw).r);
          float near = max(shoreAhead * (1.0 - smoothstep(0.22, 0.82, toShore / min(crossing * 0.8, 6.5))), (1.0 - smoothstep(0.12, 0.6, depth)) * smoothstep(0.1, 0.7, (facing - 0.1) / 0.9));
          float dense = 0.0, front = 0.0, dark = 0.0, milk = 0.0;
          breaker(w, travelled, way, uWaveGap, uWaveClock, 1.0, near, dense, front, dark, milk);
#if FULL
          vec2 slanted = normalize(way + side * 0.13);
          breaker(w, dot(from, slanted), slanted, uWaveGap * 1.43, uWaveClock * 0.71 + 0.4, 4.3, near, dense, front, dark, milk);
#endif
          col *= 1.0 - dark * 0.42 * calm;
          col = mix(col, col * 0.6 + vec3(0.3, 0.42, 0.42), min(1.0, milk) * 0.62 * afloat * calm);
          // The wash on the shore itself, up and back with each wave.
          float washed = 0.5 + 0.5 * sin(uWaveClock * 3.14159 + noise(vec2(dot(w, side) * 0.25, 2.0)) * 5.0), shoreLip = (1.0 - smoothstep(0.0, 0.05 + 0.04 * noise(w * 3.0), abs(shoreAway - waterline - 0.03 - washed * 0.09))) * facing * swashed * uBeach;
          if (dense > 0.003 || front > 0.003 || shoreLip > 0.003) {
            float grain = clamp(uGrid / 70.0, 1.0, 3.0); vec2 grained = w * grain, lying = (vec2(dot(w, side), dot(w, way)) - vec2(0.0, uTime * 0.1)) * grain, turned = lying + (vec2(noise(grained * 1.4 + 3.0), noise(grained * 1.4 + 9.0)) - 0.5) * 0.55 + (vec2(noise(grained * 4.5 + 5.0), noise(grained * 4.5 + 13.0)) - 0.5) * 0.22;
            float cellsLarge = texture2D(uCells, vec2(turned.x * 0.15, turned.y * 0.08)).g, cellsSmall = texture2D(uCells, vec2(turned.x * 0.46 + 0.3, turned.y * 0.27)).g;
            float mottle = noise(turned * 6.0) * 0.55 + noise(turned * 15.0) * 0.45, comb = noise(vec2(lying.x * 9.0, lying.y * 0.9)) * 0.6 + noise(vec2(lying.x * 24.0, lying.y * 2.2)) * 0.4;
            float thick = clamp(min(dense, 1.0) * (0.82 + 0.36 * comb), 0.0, 1.0) * afloat, thin = pow(thick, 0.72);
            float wallsLarge = 1.0 - smoothstep(0.03 + thin * 0.42, 0.09 + thin * 0.75, cellsLarge), wallsSmall = 1.0 - smoothstep(thin * 0.5, thin * 1.02 + 0.03, cellsSmall), lacing = 1.0;
#if FULL
            lacing = mix(0.55, 1.0, 1.0 - smoothstep(thin * 0.45, thin * 1.05 + 0.05, texture2D(uCells, vec2(turned.x * 1.35, turned.y * 0.85 + 0.6)).g));
#endif
            float sheet = max(wallsLarge * smoothstep(0.03, 0.2, thick) * (0.2 + 0.5 * mottle) * smoothstep(0.3, 0.6, noise(turned * 2.2)), wallsSmall * lacing * smoothstep(0.06, 0.34, thick)) * (0.5 + 0.5 * thin) * (0.78 + 0.34 * mottle);
            sheet = 1.0 - (1.0 - min(1.0, sheet)) * (1.0 - min(1.0, front * (0.55 + 0.6 * comb)) * afloat) * (1.0 - shoreLip * (1.0 - smoothstep(0.02, 0.26, cellsSmall)) * (0.5 + 0.5 * mottle) * 0.8);
            foamTone = mix(foamTone, mix(0.84, 1.0, smoothstep(0.25, 0.85, thin) * (0.72 + 0.28 * mottle) + 0.1), sheet);
            foam = 1.0 - (1.0 - foam) * (1.0 - sheet);
          }
        }
        if (strike > 0.01) {
          // The splash: droplets thrown off it, in and out in a moment, and a little mist over it.
          float cells = 24.0 / max(uPix, 1.0), reach = (0.04 + 0.11 * noise(w * 5.0 + uTime * 0.8)) * min(strike * 1.4, 1.0);
          float drops = (1.0 - smoothstep(reach, reach + max(0.05, cells), bubbles(w * 24.0 + 3.0, uTime * 2.6).x)) * (1.0 - smoothstep(0.3, 0.6, cells));
          foam = 1.0 - (1.0 - foam) * (1.0 - drops * min(strike * 1.6, 1.0) * 0.75 * uFoam) * (1.0 - strike * 0.08 * noise(w * 2.1 + uTime * vec2(0.5, -0.4)) * uFoam);
        }
        if (spray > 0.01) {
          // Fine strands running with the wind, going faster than the water, each only for a moment; a little mist among them.
          float down = dot(w, uWindDir), across = dot(w, vec2(-uWindDir.y, uWindDir.x)) + (noise(w * 1.2 + 3.0) - 0.5) * 0.5;
          float strands = noise(vec2(down * 1.3 - uTime * 1.6, across * 26.0)) * noise(vec2(down * 0.5 - uTime * 0.7 + 3.0, across * 9.0 + 9.0));
          foam = 1.0 - (1.0 - foam) * (1.0 - min(spray, 1.0) * smoothstep(0.3, 0.5, strands) * 0.55 * uFoam);
        }
      } else foam = smoothstep(0.2, 0.45, rough) * smoothstep(0.42, 0.62, clots) * uFoam * 0.85;
    }
    col = mix(col, uSea > 0.5 ? vec3(0.93, 0.96, 0.97) * foamTone : vec3(0.86, 0.9, 0.92) * (0.93 + 0.1 * clots), min(1.0, foam) * calm);
  }
  // Where it has frozen, the map's own water is under the ice; this stops and fades.
  if (uOverWatery > 0.5) { col = mix(col, col * vec3(0.3, 0.4, 0.48) + vec3(0.0, 0.004, 0.01), min(1.0, overShade * 2.1)); col *= 1.0 - overUnder * 0.34; }
  else col *= (1.0 - overShade) * (1.0 - overUnder);
  // Coloured glass lets its colours through, a pane at a time.
  if (overStained > 0.0) { vec2 pane = floor(overAt / (uGrid * 0.45)); col = mix(col, col * (1.0 + 0.3 * sin(fract(sin(dot(pane, vec2(12.9, 78.2))) * 437.5) * 6.28318 + vec3(0.0, 2.1, 4.2))), min(1.0, overStained * 0.8) * (0.25 + 0.75 * uSun)); }
  float a = smoothstep(uPeak * 0.4, uPeak * 0.7, mask.r) * calm * seaEdge;
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
// Whether an animal in the water is due its next ring (pure): now and then, as there may be many.
export const wakeRingDue = (last, now) => !(last >= 0) || now - last >= 0.9;
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
// A soft shape held inside the sharp one (pure): a blur spreads past a region's edge and over any hole narrower than itself, so each point has the less of the two. Gives its `data`, and `peak` (0-1) the most any point holds, as a narrow stream never reaches full.
export const heldInside = (soft, sharp) => { const data = new Uint8Array(soft.length); let most = 0; for (let i = 0; i < soft.length; i++) { const v = Math.min(soft[i], sharp[i]); data[i] = v; if (v > most) most = v; } return { data, peak: Math.max(0.05, most / 255) }; };
// Takes what stands over the water out of its shape (pure), `inset` cells short of its edge all round: a painted floor lies over the water, so the water runs on under its edge and no seam shows. `data` changed in place.
export const takenOut = (data, cut, w, h, inset = 0) => { for (let y = 0, i = 0; y < h; y++) for (let x = 0; x < w; x++, i++) { let least = cut[i]; for (let n = 1; n <= inset && least > 0; n++) { least = Math.min(least, x >= n ? cut[i - n] : 255, x + n < w ? cut[i + n] : 255, y >= n ? cut[i - n * w] : 255, y + n < h ? cut[i + n * w] : 255); } if (least > 0) data[i] = Math.min(data[i], 255 - least); } return data; };
// The region's shape on a small canvas, its holes left out, blurred by `blur` px; its coverage, one number a pixel.
export const shapeOf = (areas, box, k, blur, beyond = null) => {
  const w = Math.max(2, Math.ceil(box.w * k)), h = Math.max(2, Math.ceil(box.h * k)), room = Math.ceil(blur * 3), canvas = document.createElement('canvas'); canvas.width = w + room * 2; canvas.height = h + room * 2; // (Room round it: a blur stops at the edge of what it is drawn on, which would make a shore of the map's edge.)
  const x = canvas.getContext('2d', { willReadFrequently: true }); x.filter = blur > 0 ? `blur(${blur}px)` : 'none'; x.fillStyle = '#fff'; x.beginPath();
  const trace = (points) => { x.moveTo((points[0] - box.x) * k + room, (points[1] - box.y) * k + room); for (let i = 2; i + 1 < points.length; i += 2) x.lineTo((points[i] - box.x) * k + room, (points[i + 1] - box.y) * k + room); x.closePath(); };
  for (const area of areas) { trace(area); for (const hole of area.holes ?? []) trace(hole); }
  x.fill('evenodd');
  if (beyond) { const far = Math.max(w, h) * 4; x.beginPath(); x.rect(-far, -far, w + far * 2, h + far * 2); x.rect((beyond.x - box.x) * k + room, (beyond.y - box.y) * k + room, beyond.width * k, beyond.height * k); x.fill('evenodd'); }
  const data = x.getImageData(room, room, w, h).data, one = new Uint8Array(w * h);
  for (let i = 0; i < one.length; i++) one[i] = data[i * 4 + 3];
  return { w, h, data: one };
};
// How far the middle of a shape lies from its nearest shore, in cells of its grid (pure). `data` its coverage 0-255, `w` by `h`; `open` { left, right, top, bottom }, the sides that are no shore, as the map ends there.
export function deepestInside(data, w, h, open = {}) {
  const far = w + h, d = new Float32Array(w * h), STEP = 1, DIAG = Math.SQRT2;
  const look = (x, y, i, sign) => { let v = d[i]; const nx = x - sign, ny = y - sign, ax = x + sign; if (nx >= 0 && nx < w) v = Math.min(v, d[i - sign] + STEP); if (ny >= 0 && ny < h) { v = Math.min(v, d[i - sign * w] + STEP); if (nx >= 0 && nx < w) v = Math.min(v, d[i - sign * w - sign] + DIAG); if (ax >= 0 && ax < w) v = Math.min(v, d[i - sign * w + sign] + DIAG); } d[i] = v; };
  for (let y = 0, i = 0; y < h; y++) for (let x = 0; x < w; x++, i++) d[i] = data[i] < 128 ? 0 : (x === 0 && !open.left) || (x === w - 1 && !open.right) || (y === 0 && !open.top) || (y === h - 1 && !open.bottom) ? 1 : far;
  for (let y = 0, i = 0; y < h; y++) for (let x = 0; x < w; x++, i++) look(x, y, i, 1);
  let most = 0;
  for (let y = h - 1, i = w * h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--, i--) { look(x, y, i, -1); if (d[i] > most) most = d[i]; }
  return most;
}
// How far the middle of a sea lies from its shore, in px. Narrow water has its long blurs drawn in to suit (seaBlurs), or it would never get away from its shore: its middle would read as shallows, and break.
export const seaBlurs = (middle, grid) => ({ shore: Math.min(grid * 1.5, middle * 0.5), deep: Math.min(grid * 3.5, middle * 0.6) });
const shoreFits = (areas, grid, map = null) => {
  const box = boxOf(areas); if (!box) return grid * 8;
  const f = Math.min(0.05, 256 / Math.max(box.w, box.h)), shape = shapeOf(areas, box, f, 0, map);
  const open = map ? { left: box.x <= map.x, top: box.y <= map.y, right: box.x + box.w >= map.x + map.width, bottom: box.y + box.h >= map.y + map.height } : {};
  return Math.max(grid * 0.3, deepestInside(shape.data, shape.w, shape.h, open) / f);
};
// How far (px) what stands over water throws its shadow with the sun well up (pure), by how far it stands above the water: `above` and `water` their bottoms, in the scene's units, `distance` those units to a square. A little for what lies right on it, a few squares at most. Off the height of a low sun: the shader lengthens it.
export const overLiftOf = ({ above = 0, water = 0, distance = 5, grid = 100 } = {}) => { const a = Number(above), w = Number(water), rise = (Number.isFinite(a) ? a : 0) - (Number.isFinite(w) ? w : 0), per = Number(distance) > 0 ? Number(distance) : 5; return grid * Math.min(3, Math.max(0.15, (rise / per) * 0.45)); };
// How far from its shore a sea is, as a picture of a box, in its blue, for a look to stop at its waterline. (No shore past the map's edge, `map`.)
export function seaShore(PIXI, areas, box, grid, map = null) {
  const k = Math.min(0.25, 1024 / Math.max(box.w, box.h)), shore = shapeOf(areas, box, k, k * seaBlurs(shoreFits(areas, grid, map), grid).shore, map), pixels = new Uint8ClampedArray(shore.w * shore.h * 4);
  for (let i = 0; i < shore.data.length; i++) { const away = (shore.data[i] - 128) * 2; pixels[i * 4 + 2] = away; pixels[i * 4 + 3] = 255; }
  return textureOf(PIXI, pixels, shore.w, shore.h);
}
const textureOf = (PIXI, pixels, w, h, options = {}) => {
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  canvas.getContext('2d').putImageData(new ImageData(pixels, w, h), 0, 0);
  return new PIXI.Texture(new PIXI.BaseTexture(canvas, { scaleMode: PIXI.SCALE_MODES.LINEAR, wrapMode: PIXI.WRAP_MODES.CLAMP, ...options }));
};

/**
 * The layer. sync(list, { floor, quality }): `list` the water to move as [{ id, areas, over (what stands over it: [{ areas, kind (OVER_SHADOWS), soft, dark, across, painted (its floor is painted over the water), cut (the water is hidden under it; false: it only shades it), casts (false: no shadow) }]), lift (how far its shadow falls, px), kind, angle, followsWind (no way of its own: the wind carries it, as fast as `current`), waves (the way a sea's waves go, radians; none: with the wind), map (a sea has no shore past the map's edge, { x, y, width, height }), current, roofed, keeps, bed: { texture, key, edge } }], `floor` the map's picture
 * { texture, rect }, `quality` 'full' or 'simple'. tick(seconds, { sky, view, lights, weather, flash, wind, angle, mostLights }) while `busy`.
 * addRing({ x, y, size }) for what steps in it; has(id); clear().
 */
// How long between waves from one side, in seconds, by the wind 0 to 1 (pure): the Beaufort scale's, short and choppy in a light air, long in a gale. They cross at a steady pace, in squares a second, so a longer wait is a longer wave and never a faster one.
export const wavePeriod = (wind) => 2.5 + 5.5 * Math.min(1, Math.max(0, Number(wind) || 0));
const WAVE_SPEED = 0.9;
// How far apart waves from one side lie, in squares (pure): by how often they come at their steady pace, but never so far that a small water hardly sees one. Closer together is slower, not faster.
export const waveGap = (period, wide) => Math.max(1.5, Math.min(WAVE_SPEED * period, wide * 0.55));
// A way the waves go, turned a little toward another (pure): so a change of wind swings them round slowly instead of sweeping every front across the water. Always a unit length.
export const turnedToward = (from, to, by) => { const k = Math.min(1, Math.max(0, by)), x = from[0] + (to[0] - from[0]) * k, y = from[1] + (to[1] - from[1]) * k, length = Math.hypot(x, y); return length > 0.001 ? [x / length, y / length] : [to[0], to[1]]; };
// Foam's cells, a tile that repeats (pure, the same on every screen): RGBA pixels, red how far from the middle of a cell, green how far from its wall.
export function foamCells(size = 512, across = 26) {
  let state = 1664525; const random = () => { state = (Math.imul(state, 1103515245) + 12345) & 0x7fffffff; return state / 0x7fffffff; };
  const seeds = new Float32Array(across * across * 2); for (let i = 0; i < seeds.length; i += 1) seeds[i] = random();
  const pixels = new Uint8ClampedArray(size * size * 4);
  for (let py = 0; py < size; py += 1) for (let px = 0; px < size; px += 1) {
    const u = (px / size) * across, v = (py / size) * across, cx = Math.floor(u), cy = Math.floor(v); let first = 9, second = 9;
    for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) { const sx = (cx + dx + across) % across, sy = (cy + dy + across) % across, at = (sy * across + sx) * 2, ox = cx + dx + seeds[at] - u, oy = cy + dy + seeds[at + 1] - v, d = Math.sqrt(ox * ox + oy * oy); if (d < first) { second = first; first = d; } else if (d < second) second = d; }
    const i = (py * size + px) * 4; pixels[i] = first * 200; pixels[i + 1] = (second - first) * 300; pixels[i + 3] = 255;
  }
  return pixels;
}
// How long a sea's swells are, as times their usual, by the wind (pure): short in a light air, long in a gale, moving no faster for it.
export const swellLength = (wind) => 0.6 + 1.7 * Math.min(1, Math.max(0, Number(wind) || 0));
export function createWaterEngine({ PIXI, root, grid = () => 100 }) {
  const known = new Map(), fishes = new Float32Array(MOST_FISH * 4), swings = new Float32Array(MOST_FISH), rings = new Float32Array(MOST_RINGS * 4).fill(-99), ringKeeps = new Array(MOST_RINGS).fill(false);
  let sheet = null, clock = 0, skyAt = 0, lightsAt = 0, nextRing = 0, flashing = false, lights = floorLights(), floorNow = null, qualityNow = 'full';
  let cells = null;
  // A scene with no map picture still has water: deep water's own colour under the waves.
  let plainWater = null;
  const plainFloor = () => { if (!plainWater || plainWater.baseTexture?.destroyed) plainWater = textureOf(PIXI, new Uint8ClampedArray([16, 58, 72, 255]), 1, 1); return { texture: plainWater, rect: { x: 0, y: 0, width: 1, height: 1 } }; };
  const cellsOf = () => { if (!cells || cells.baseTexture?.destroyed) cells = textureOf(PIXI, foamCells(512, 26), 512, 512, { wrapMode: PIXI.WRAP_MODES.REPEAT, mipmap: PIXI.MIPMAP_MODES.ON }); return cells; };
  const sheetOf = () => { if (!sheet || sheet.baseTexture?.destroyed) sheet = textureOf(PIXI, waveSheet(512), 512, 512, { wrapMode: PIXI.WRAP_MODES.REPEAT, mipmap: PIXI.MIPMAP_MODES.ON }); return sheet; };
  const drop = (entry) => { try { entry.mesh.parent?.removeChild(entry.mesh); entry.mesh.destroy(); entry.mask.destroy(true); entry.flow.destroy(true); entry.over?.destroy(true); } catch { /* gone with the canvas */ } };
  const make = (spec) => {
    const size = grid() || 100, box = boxOf(spec.areas), motion = WATER_MOTION[spec.kind] ?? WATER_MOTION.still, overs = spec.over ?? [];
    // (What stands over it only hides it, sharply: the water, its waves and its shores run on beneath as if nothing were there.)
    if (!box) return null;
    // Where it is (red), how far in from its bank (green), and for the sea how far from its shore (blue).
    const k = Math.min(0.25, 1024 / Math.max(box.w, box.h)), hard = spec.edge === 0, crisp = shapeOf(spec.areas, box, k, hard ? 0 : spec.bed ? Math.max(2, size * k * (spec.bed.edge ?? 1) * 0.35) : 2), sharp = spec.bed ? shapeOf(spec.areas, box, k, hard ? 0 : 1) : crisp, held = heldInside(crisp.data, sharp.data), wide = shapeOf(spec.areas, box, k, size * k * 0.36), pixels = new Uint8ClampedArray(crisp.w * crisp.h * 4);
    const blurs = motion.sea ? seaBlurs(shoreFits(spec.areas, size, spec.map), size) : null, shore = motion.sea ? shapeOf(spec.areas, box, k, k * blurs.shore, spec.map) : null;
    for (const o of overs) if (o.cut !== false) takenOut(held.data, shapeOf(o.areas, box, k, o.painted ? 0 : 1).data, crisp.w, crisp.h, o.painted ? 2 : 0);
    for (let i = 0; i < crisp.data.length; i++) { pixels[i * 4] = held.data[i]; pixels[i * 4 + 1] = (wide.data[i] - 128) * 2; pixels[i * 4 + 2] = shore ? (shore.data[i] - 128) * 2 : 255; pixels[i * 4 + 3] = 255; }
    const mask = textureOf(PIXI, pixels, crisp.w, crisp.h);
    const f = Math.min(0.05, 256 / Math.max(box.w, box.h)), soft = shapeOf(spec.areas, box, f, size * f * 0.9), flowPixels = flowField(motion.streak ? soft.data.fill(255) : soft.data, soft.w, soft.h, spec.angle);
    // A sea keeps in its red how deep it is: how far from a real shore, up to some squares out.
    if (motion.sea) { const deep = shapeOf(spec.areas, box, f, f * blurs.deep, spec.map); for (let i = 0; i < deep.data.length; i++) flowPixels[i * 4] = (deep.data[i] - 128) * 2; }
    const flow = textureOf(PIXI, flowPixels, soft.w, soft.h);
    const points = [box.x, box.y, box.x + box.w, box.y, box.x + box.w, box.y + box.h, box.x, box.y + box.h];
    const geometry = new PIXI.Geometry().addAttribute('aVertexPosition', new PIXI.Buffer(new Float32Array(points), true), 2).addIndex(new Uint16Array([0, 1, 2, 0, 2, 3]));
    // What stands over it, for the light: its shadow and the dark under it.
    let over = null;
    if (overs.some((o) => o.casts !== false) && spec.shade !== false) {
      const w = crisp.w, h = crisp.h, overPixels = new Uint8ClampedArray(w * h * 4);
      for (let i = 3; i < overPixels.length; i += 4) overPixels[i] = 255;
      for (const o of overs) {
        if (o.casts === false) continue;
        const soft = o.soft ?? 0, dark = o.dark ?? 0.45, shown = shapeOf(o.areas, box, k, size * k * (0.05 + soft * 0.5)), near = shapeOf(o.areas, box, k, size * k * 0.28), found = shapeOf(o.areas, box, k, Math.max(3, size * k * (0.05 + soft * 0.5) * 2)), code = (Math.max(0, OVER_SHADOW_CODES.indexOf(o.kind)) * 2 + (o.across ? 1 : 0)) * 8;
        // (Which it is, a little past its edge, so its shadow's soft edge reads its own.)
        for (let i = 0; i < shown.data.length; i++) { overPixels[i * 4] = Math.max(overPixels[i * 4], shown.data[i] * dark); if (o.contact !== false && !LIGHT_THROUGH.includes(o.kind)) overPixels[i * 4 + 1] = Math.max(overPixels[i * 4 + 1], near.data[i]); if (found.data[i] > 6) overPixels[i * 4 + 2] = code; }
      }
      over = textureOf(PIXI, overPixels, w, h);
    }
    const uniforms = { uOverWatery: spec.watery ? 1 : 0, uOverSoft: Math.max(0, ...overs.map((o) => o.soft ?? 0)) * 0.3, uOver: over ?? PIXI.Texture.WHITE, uOverOn: over ? 1 : 0, uOverLift: spec.lift ?? size * 0.45, uPeak: held.peak, uAimed: blurs && (Number.isFinite(spec.waves) || blurs.deep < size * 3.5) ? 1 : 0, uWaveClock: 0, uWaveGap: WAVE_SPEED * wavePeriod(0), uSeaState: 0, uSwellLong: swellLength(0), uSwellClock: 0, uBreakSize: 1, uCells: cellsOf(), uMap: floorNow.texture, uMask: mask, uFlow: flow, uWaves: sheetOf(), uBed: spec.bed?.texture ?? PIXI.Texture.WHITE, uSand: spec.sand ?? PIXI.Texture.WHITE, uSandSize: spec.sand ? size * 4 : 0, uBedSize: spec.bed?.texture ? size * 4 : 0, uBedColour: spec.bed?.colourOnly ? 1 : 0, uMapRect: [floorNow.rect.x, floorNow.rect.y, floorNow.rect.width, floorNow.rect.height], uBox: [box.x, box.y, box.w, box.h], uTime: clock, uWind: 0.2, uGrid: size, uCurrent: Number.isFinite(spec.angle) ? (spec.current ?? 0.4) * 1.4 * motion.pace : 0, ...sunUniforms(PIXI), uPix: size, uFish: fishes, uFishSwing: swings, uFishCount: 0, uFishDim: 1, uFishLook: PIXI.Texture.EMPTY, uFishLookOn: 0, uStill: motion.streak ? 0 : spec.followsWind ? 0.35 + 1.3 * (spec.current ?? 0.4) : Number.isFinite(spec.angle) ? 0.12 : 1, uRough: motion.rough, uFoam: waterFoam(spec.kind, spec.current), uStrength: Math.min(1, Math.max(0, spec.current ?? 0.4)), uSwell: motion.swell, uStreak: motion.streak, uSea: motion.sea ? 1 : 0, uBeach: motion.sea && spec.beach !== false ? 1 : 0, uSoft: spec.edge ?? 1, uDepthHold: spec.depth?.hold ?? 1, uDepthDark: spec.depth?.dark ?? 0, uDepthTint: spec.depth?.tint ? 1 : 0, uSwellDir: [0.8, 0.6], uDown: [Math.cos(spec.angle ?? 0), Math.sin(spec.angle ?? 0)], uRun: runOf(spec.areas, spec.angle ?? 0), uSun: 0, uFrozen: 0, uLightCount: 0, uWindDir: [0.8, 0.6], uToSun: [1, 0], uGlare: [box.x, box.y], uSunColor: [1, 1, 1], uLights: lights.lights, uLightColors: lights.colors, uRings: rings };
    const mesh = new PIXI.Mesh(geometry, PIXI.Shader.from(VERT, fragOf(qualityNow === 'full'), uniforms));
    mesh.eventMode = 'none'; root().addChild(mesh);
    skyAt = 0;
    return { over, mesh, mask, flow, box, roofed: !!spec.roofed, keeps: !!spec.keeps, waves: Number.isFinite(spec.waves) ? [Math.cos(spec.waves), Math.sin(spec.waves)] : null };
  };
  return {
    sync(list = [], { floor = null, quality = 'full' } = {}) {
      const picture = floor?.texture?.valid ? floor : list.length ? plainFloor() : null, wanted = picture ? list : [], changedLook = quality !== qualityNow || picture?.texture !== floorNow?.texture;
      qualityNow = quality; floorNow = picture;
      const seen = new Set();
      for (const spec of wanted) {
        seen.add(spec.id);
        const key = JSON.stringify([spec.areas, spec.areas.map((a) => a.holes ?? null), (spec.over ?? []).map((o) => [o.areas, o.areas.map((a) => a.holes ?? null), o.kind, o.soft, o.dark, !!o.across, !!o.painted, o.cut !== false, o.casts !== false, o.contact !== false]), spec.shade !== false, !!spec.watery, spec.lift ?? null, spec.angle, spec.current, spec.kind, !!spec.followsWind, spec.waves ?? null, spec.map ?? null, spec.beach !== false, !!spec.sand, spec.edge ?? 1, spec.depth?.hold ?? 1, spec.depth?.dark ?? 0, !!spec.depth?.tint, spec.bed?.key ?? null, spec.bed?.edge ?? null, !!spec.bed?.texture, quality]), had = known.get(spec.id);
        if (had && had.key === key && !changedLook) { had.roofed = !!spec.roofed; had.keeps = !!spec.keeps; continue; }
        if (had) { drop(had); known.delete(spec.id); }
        try { const entry = make(spec); if (entry) { entry.key = key; entry.areas = spec.areas; known.set(spec.id, entry); } } catch (error) { console.warn('Animater | moving water', error); }
      }
      for (const [id, entry] of known) if (!seen.has(id)) { drop(entry); known.delete(id); }
    },
    tick(seconds, { sky = () => null, view = () => null, lights: sources = () => [], weather = () => null, flash = () => null, wind = 0, angle = 0.6, mostLights = MOST_LIGHTS, fish = () => null, fishLook = () => null, shade = () => null } = {}) {
      clock += seconds;
      const shadeNow = shade();
      const swimming = fish(), fishCount = Math.min(MOST_FISH, swimming?.list?.length ?? 0);
      for (let i = 0; i < fishCount; i++) { const o = swimming.list[i]; fishes[i * 4] = o.x; fishes[i * 4 + 1] = o.y; fishes[i * 4 + 2] = o.a; fishes[i * 4 + 3] = o.scale; swings[i] = o.swing; }
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
        if (shadeNow) { w.uSunlit = shadeNow.sunlit; w.uTreeShade = shadeNow.trees; w.uSceneRect = shadeNow.rect; } w.uFishCount = fishCount; w.uFishDim = swimming?.dim ?? 1; { const look = fishLook(); w.uFishLook = look ?? PIXI.Texture.EMPTY; w.uFishLookOn = look ? 1 : 0; } w.uPix = w.uGrid * (entry.mesh.worldTransform?.a || 1); w.uTime = clock; w.uWind = entry.roofed ? 0.02 : wind; entry.waveWind = (entry.waveWind ?? w.uWind) + (w.uWind - (entry.waveWind ?? w.uWind)) * Math.min(1, seconds / 20); { const period = wavePeriod(entry.waveWind), long = swellLength(entry.waveWind); w.uWaveClock += seconds / period; { const wide = (Math.abs(w.uSwellDir[0]) * entry.box.w + Math.abs(w.uSwellDir[1]) * entry.box.h) / w.uGrid; w.uWaveGap = waveGap(period, wide); w.uBreakSize = Math.min(1, wide / 7); } w.uSeaState = Math.min(1, Math.max(0, entry.waveWind)); w.uSwellLong = long; w.uSwellClock += seconds / long; } w.uWindDir = dir; w.uSwellDir = entry.waves ?? (w.uAimed ? (entry.aimedWith = turnedToward(entry.aimedWith ?? dir, dir, seconds / 20)) : dir); w.uLights = lights.lights; w.uLightColors = lights.colors; w.uLightCount = lights.count;
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
    // Whether this draws the water at a point, so that what swims there is drawn in it, under the surface, rather than on top.
    holds(x, y) {
      const within = (p) => { let on = false; for (let i = 0, j = p.length - 2; i + 1 < p.length; j = i, i += 2) if ((p[i + 1] > y) !== (p[j + 1] > y) && x < ((p[j] - p[i]) * (y - p[i + 1])) / (p[j + 1] - p[i + 1]) + p[i]) on = !on; return on; };
      for (const { box, areas } of known.values()) { if (x < box.x || y < box.y || x > box.x + box.w || y > box.y + box.h) continue; if (areas?.some((a) => within(a) && !(a.holes ?? []).some(within))) return true; }
      return false;
    },
    get busy() { return known.size > 0; },
    get count() { return known.size; },
  };
}

// What it draws with, for warming ahead of the first frame (scene-shaders.mjs).
export const waterShaderSources = (full = true) => [[VERT, fragOf(full)]];
