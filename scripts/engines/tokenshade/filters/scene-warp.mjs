// Map distortion's one scene filter (engines/distortion/distortion-host.mjs): a screen pass on canvas.primary
// that bends what is drawn there. Up to four slots, each a shockwave ring (0), a heat haze (1) or a teleport
// warp (2). Places and sizes are in world pixels and reach the screen through uWorldToScreen; amplitudes are
// screen pixels. Unlike the token filters it has no art box: the input is the whole screen.
import { NOISE } from '../glsl.mjs';

export const SCENE_WARP_SLOTS = 4;

const HEAD = `
precision highp float;
varying vec2 vTextureCoord;
uniform sampler2D uSampler;
uniform vec4 inputSize;
uniform vec4 inputClamp;
uniform vec4 outputFrame;
const float PI = 3.14159265;
const float TAU = 6.28318531;
`;

const MAIN = `
uniform float uTime;
uniform float uSlots;
uniform float uKind[4];
uniform vec2 uCentre[4];
uniform float uRadius[4];
uniform float uRing[4];
uniform float uAmp[4];
uniform float uBand[4];
uniform vec4 uSeg[4];
uniform mat3 uWorldToScreen;

vec2 toScreen(vec2 world) { return (uWorldToScreen * vec3(world, 1.0)).xy; }

void main() {
  vec2 s = vTextureCoord * inputSize.xy + outputFrame.xy;
  float zoom = length(uWorldToScreen[0].xy);
  vec2 off = vec2(0.0);
  for (int i = 0; i < 4; i++) {
    if (float(i) >= uSlots) break;
    float amp = uAmp[i];
    if (amp <= 0.0) continue;
    float r = max(uRadius[i] * zoom, 1.0);
    vec2 d = s - toScreen(uCentre[i]);
    float dist = length(d);
    vec2 dir = dist > 0.0 ? d / dist : vec2(0.0);
    if (uKind[i] < 0.5) {
      // Shockwave: a refracting band on the growing ring.
      // Its own band width (world pixels) when the plan gave one, else a sixth of the ring.
      float band = max(uBand[i] > 0.0 ? uBand[i] * zoom : r * 0.16, 12.0);
      float x = (dist - uRing[i] * zoom) / (band * 0.5);
      off -= dir * sin(x * 2.2) * amp * exp(-x * x * 2.0);
    } else if (uKind[i] < 1.5) {
      // Heat haze: rising noise over a circle, or the capsule around a line of fire.
      vec2 a = toScreen(uSeg[i].xy), b = toScreen(uSeg[i].zw), ab = b - a;
      float h = clamp(dot(s - a, ab) / max(dot(ab, ab), 1e-4), 0.0, 1.0);
      float mask = 1.0 - smoothstep(r * 0.55, r, length(s - a - ab * h));
      if (mask <= 0.0) continue;
      vec2 q = (s - toScreen(uCentre[i])) / (zoom * 60.0) + vec2(float(i) * 13.7, uTime * 1.4);
      off += vec2(fbm3(q), 0.5 * fbm3(q * 1.3 + 7.1)) * amp * 1.6 * mask;
    } else {
      // Teleport warp: space pinches toward the point, strongest halfway out.
      float k = clamp(dist / r, 0.0, 1.0);
      off += dir * amp * 4.0 * k * (1.0 - k);
    }
  }
  vec2 uv = (s + off - outputFrame.xy) * inputSize.zw;
  gl_FragColor = texture2D(uSampler, clamp(uv, inputClamp.xy, inputClamp.zw));
}
`;

let source = null;
export function sceneWarpSource() {
  return (source ??= `${HEAD}\n${NOISE}\n${MAIN}`);
}

export function sceneWarpUniforms() {
  const n = SCENE_WARP_SLOTS;
  return {
    uTime: 0, uSlots: 0,
    uKind: new Float32Array(n), uCentre: new Float32Array(n * 2), uRadius: new Float32Array(n),
    uRing: new Float32Array(n), uAmp: new Float32Array(n), uBand: new Float32Array(n), uSeg: new Float32Array(n * 4),
    uWorldToScreen: new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]),
  };
}

/**
 * Fill the uniforms for this frame. `slots`: up to four { kind, centre, radius, ring, amp, a?, b? } (world
 * pixels; a and b are a capsule's ends, else the centre); `m`: the world-to-screen matrix { a, b, c, d, tx, ty };
 * `timeMs`: any steady clock (it only moves the haze).
 */
export function writeSceneWarp(u, slots, m, timeMs) {
  const n = Math.min(slots.length, SCENE_WARP_SLOTS);
  u.uSlots = n;
  u.uTime = (timeMs / 1000) % 1000;
  u.uWorldToScreen.set([m.a, m.b, 0, m.c, m.d, 0, m.tx, m.ty, 1]);
  for (let i = 0; i < n; i++) {
    const slot = slots[i], a = slot.a ?? slot.centre, b = slot.b ?? slot.centre;
    u.uKind[i] = slot.kind;
    u.uCentre[i * 2] = slot.centre.x; u.uCentre[i * 2 + 1] = slot.centre.y;
    u.uRadius[i] = slot.radius;
    u.uRing[i] = slot.ring;
    u.uAmp[i] = slot.amp;
    u.uBand[i] = slot.band > 0 ? slot.band : 0;
    u.uSeg.set([a.x, a.y, b.x, b.y], i * 4);
  }
  for (let i = n; i < SCENE_WARP_SLOTS; i++) u.uAmp[i] = 0;
}

// PIXI's program for the filter; Program.from caches by source, so warm-up builds the very one it uses.
export const sceneWarpProgram = (PIXI) => PIXI.Program.from(PIXI.Filter.defaultVertexSrc, sceneWarpSource());

export const sceneWarpFilter = (PIXI) => new PIXI.Filter(undefined, sceneWarpSource(), sceneWarpUniforms());
