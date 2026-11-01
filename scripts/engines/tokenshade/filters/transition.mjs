// Transitions on the creature: it dissolves away (or forms, played in reverse), or a colour washes over it. Both
// advance through the art from a direction with a front you can see, so a Transition animation on `amount`
// (animation.mjs 'once') plays the change as the effect lands and holds it after.
import { rgb, clamp } from './util.mjs';

const f = v => Number(v) || 0;

// Where the change starts. from: 1 scattered, 2 the feet up, 3 the head down, 4 the centre out, 5 the edges in.
const POSITION = `
float transitionPos(vec2 q, float n) {
  vec2 a = fxArt();
  int k = int(uFrom + 0.5);
  float pos = k == 2 ? 1.0 - a.y : k == 3 ? a.y : k == 4 ? length(a - 0.5) * 1.414 : k == 5 ? 1.0 - length(a - 0.5) * 1.414 : n;
  return k == 1 ? pos : pos * 0.78 + n * 0.22;
}
`;

// Dissolve: the creature goes, from its front, leaving the style's particles behind it.
// style: 1 embers, 2 ash, 3 sparkles, 4 shadow, 5 pixels, 6 melt, 7 leaves, 8 sand, 9 light, 10 shatter.
const dissolve = {
  type: 'dissolve', order: 920,
  defaults: { amount: 0.5, style: 1, from: 1, color: 0xff7a1a, edge: 0.6, particles: 1, scale: 1, time: 0 },
  timeScale: 1,
  uniforms: {
    uAmount: ['float', p => clamp(p.amount, 0, 1)], uStyle: ['int', p => clamp(Math.round(f(p.style)), 1, 10)],
    uFrom: ['int', p => clamp(Math.round(f(p.from)), 1, 5)], uColor: ['vec3', p => rgb(p.color)],
    uEdge: ['float', p => clamp(p.edge, 0.05, 1)], uParticles: ['float', p => clamp(p.particles, 0, 2)], uScale: ['float', p => clamp(p.scale, 0.2, 4)],
  },
  reach: () => 0,
  glsl: `${POSITION}
void main() {
  vec4 base = fxSample(vTextureCoord);
  if (base.a <= 0.001) { gl_FragColor = base; return; }
  float R = fxTokenRadius(), t = uTime;
  vec2 q = fxCanvas() / (R * 0.16) * uScale;
  int st = int(uStyle + 0.5);
  // The order things go in: soft noise, square blocks for pixels, whole shards for shatter.
  float n = fbm(q * 0.8) * 0.55 + 0.5;
  if (st == 5) n = hash21(floor(q * 1.4));
  vec3 shard = cells(q * 0.55, 0.0);
  if (st == 10) n = hash21(vec2(shard.z * 53.0, 1.0));
  float pos = transitionPos(q, n);
  float s = uAmount * 1.25 - 0.1;              // amount 0: all there; 1: all gone
  float d = pos - s;                           // below 0 gone, above 0 still there
  float gone = smoothstep(0.01, -0.01, d);
  float near = smoothstep(uEdge * 0.25, 0.0, d) * (1.0 - gone);
  vec3 art = unpremul(base), col = art, ec = uColor, pcol = uColor;
  float glow = near, L = luma(art);
  // Where the particles drift: embers and sparkles rise, ash and drips fall, sand blows aside.
  vec2 drift = st == 2 || st == 6 ? vec2(0.0, -t * 0.45) : st == 8 ? vec2(-t * 0.9, 0.0) : st == 7 ? vec2(-t * 0.3, t * 0.25) : vec2(0.0, t * 0.55);
  vec3 pc = cells(q * (st == 5 ? 1.4 : 2.4) + drift, t * 0.5);
  float speck = st == 5 ? step(0.82, pc.z) * step(pc.x, 0.45) : smoothstep(0.13, 0.0, pc.x) * step(0.72, pc.z);
  float trail = smoothstep(0.4, 0.0, -d) * gone;
  if (st == 1) {        // embers: charring ahead of a burning edge
    col = mix(art, art * 0.22, smoothstep(uEdge * 0.6, 0.0, d) * (1.0 - gone));
    ec = heatRamp(uColor, near); pcol = heatRamp(uColor, 0.85);
  } else if (st == 2) { // ash: greying, crumbling, flakes falling
    col = mix(art, vec3(L) * 0.5 + 0.12, smoothstep(uEdge * 0.7, 0.0, d)); glow = 0.0; pcol = vec3(0.5, 0.49, 0.47);
  } else if (st == 3) { // sparkles: a glittering edge, motes rising
    ec = mix(uColor, vec3(1.0), 0.55); pcol = mix(uColor, vec3(1.0), 0.7);
    speck *= 0.6 + 0.4 * sin(t * 6.0 + pc.z * 40.0);
  } else if (st == 4) { // shadow: darkening, smoke curling off
    col = mix(art, uColor * 0.06, smoothstep(uEdge * 0.8, 0.0, d)); glow = 0.0;
    speck = smoothstep(0.5, 0.85, fbm(q * 0.7 + drift) + 0.5); pcol = uColor * 0.08;
  } else if (st == 5) { // pixels: blocks winking out
    glow = near * 0.6; pcol = mix(uColor, vec3(1.0), 0.3);
  } else if (st == 6) { // melt: running down, drips falling
    col = mix(art, mix(art, uColor, 0.4) * 1.1, near); glow = near * 0.4; pcol = mix(uColor, vec3(1.0), 0.25);
  } else if (st == 7) { // leaves: scattering in the wind
    glow = 0.0; pcol = uColor * (0.7 + 0.5 * pc.z);
  } else if (st == 8) { // sand: turning to sand, blown away
    col = mix(art, vec3(0.78, 0.65, 0.43) * (0.55 + 0.6 * L), smoothstep(uEdge, 0.0, d)); glow = 0.0; pcol = vec3(0.82, 0.70, 0.47);
  } else if (st == 9) { // light: burning out into white
    col = mix(art, vec3(1.0), smoothstep(uEdge, 0.0, d) * (1.0 - gone)); ec = mix(uColor, vec3(1.0), 0.7); pcol = vec3(1.0);
  } else {              // shatter: cracks ahead of the front, shards falling away
    float crack = 1.0 - smoothstep(0.0, 0.05, shard.y - shard.x);
    col = mix(art, mix(art, vec3(1.0), 0.35), crack * smoothstep(uEdge, 0.0, d));
    glow = near * 0.5; ec = mix(uColor, vec3(1.0), 0.6); pcol = mix(art, vec3(0.9, 0.95, 1.0), 0.5);
  }
  col = mix(col, ec, clamp(glow, 0.0, 1.0) * 0.9);
  float alpha = base.a * (1.0 - gone);
  float part = clamp(speck * trail * base.a * uParticles, 0.0, 1.0);
  gl_FragColor = vec4(col * alpha + pcol * part * (1.0 - alpha), alpha + part * (1.0 - alpha));
}`,
};

// Wash: a colour sweeping over the creature and staying: a curse taking hold, a blessing, life draining out.
// washType: 1 tint, 2 drain (grey and dim), 3 glow, 4 shadow, 5 sickly.
const wash = {
  type: 'wash', order: 330,
  defaults: { amount: 0.6, washType: 1, from: 2, color: 0x9a5cff, strength: 0.75, front: 0.7, time: 0 },
  timeScale: 1,
  uniforms: {
    uAmount: ['float', p => clamp(p.amount, 0, 1)], uKind: ['int', p => clamp(Math.round(f(p.washType)), 1, 5)],
    uFrom: ['int', p => clamp(Math.round(f(p.from)), 1, 5)], uColor: ['vec3', p => rgb(p.color)],
    uStrength: ['float', p => clamp(p.strength, 0, 1)], uFront: ['float', p => clamp(p.front, 0, 1)],
  },
  reach: () => 0,
  glsl: `${POSITION}
void main() {
  vec4 base = fxSample(vTextureCoord);
  if (base.a <= 0.001) { gl_FragColor = base; return; }
  float R = fxTokenRadius(), t = uTime;
  vec2 q = fxCanvas() / (R * 0.18);
  float n = fbm(q * 0.7) * 0.5 + 0.5;
  float s = uAmount * 1.2 - 0.08, pos = transitionPos(q, n);
  float covered = smoothstep(s + 0.02, s - 0.02, pos);
  float front = smoothstep(0.07, 0.0, abs(pos - s)) * step(0.001, uAmount);
  vec3 art = unpremul(base);
  float L = luma(art);
  int k = int(uKind + 0.5);
  vec3 target = k == 1 ? mix(art, uColor * (0.35 + L), 0.6)
    : k == 2 ? vec3(L) * 0.55 + uColor * 0.06
    : k == 3 ? art + uColor * (0.45 + 0.15 * sin(t * 2.0))
    : k == 4 ? art * 0.25 + uColor * 0.2 * L
    : mix(art, uColor * (0.5 + 0.6 * L), 0.45) * (0.9 + 0.1 * sin(t * 1.3 + q.y));
  vec3 col = mix(art, clamp(target, 0.0, 1.0), covered * uStrength);
  col = mix(col, mix(uColor, vec3(1.0), 0.5), front * uFront);
  gl_FragColor = vec4(col * base.a, base.a);
}`,
};

export const TRANSITION_SPECS = [dissolve, wash];
