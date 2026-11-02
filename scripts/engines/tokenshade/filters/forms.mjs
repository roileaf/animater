// Forms a creature takes on: wings that grow from its back and beat, and growths that spread over its body.
import { rgb, clamp } from './util.mjs';

const f = v => Number(v) || 0;

// Wings from the creature's back, beating. They turn with the token (laid out across the art's own width) and are
// drawn behind the art, so its body covers where they join. `style` 0: leathery, a membrane between finger bones
// with a scalloped trailing edge (dragons, fiends, bats); 1: feathered, layered feathers ending in notched tips;
// 2: luminous, feathers of light with a soft glow round them. `span`: reach in token radii; `beat`: how far they lift.
const wings = {
  type: 'wings', order: 120,
  defaults: { style: 0, color: 0x5a2a20, boneColor: 0x24120c, span: 1.15, beat: 1, alpha: 1, time: 0 },
  timeScale: 1,
  uniforms: {
    uStyle: ['int', p => clamp(Math.round(f(p.style)), 0, 2)], uColor: ['vec3', p => rgb(p.color)], uBone: ['vec3', p => rgb(p.boneColor)],
    uSpan: ['float', p => clamp(p.span, 0.3, 2.5)], uBeat: ['float', p => clamp(p.beat, 0, 2)], uAlpha: ['float', p => clamp(p.alpha, 0, 1)],
  },
  reach: (p, c) => c.size * 0.5 * (clamp(p.span, 0.3, 2.5) + 0.5),
  glsl: `
// Finger (or feather-row) angles and lengths from the shoulder, outward-down to up; edge radius at angle th.
float fingerA(int i) { return i == 0 ? -0.75 : i == 1 ? -0.35 : i == 2 ? 0.05 : i == 3 ? 0.42 : 0.72; }
float fingerL(int i) { return i == 0 ? 0.42 : i == 1 ? 0.7 : i == 2 ? 0.9 : i == 3 ? 1.0 : 0.95; }
float edgeAt(float th, int style) {
  float e = 0.0;
  for (int i = 0; i < 4; i++) {
    float a0 = fingerA(i), a1 = fingerA(i + 1);
    if (th >= a0 && th <= a1) {
      float t = (th - a0) / (a1 - a0);
      e = mix(fingerL(i), fingerL(i + 1), t);
      if (style == 0) e -= 0.13 * sin(PI * t) * (i == 3 ? 0.3 : 1.0);
    }
  }
  // Feathers: each tip rounded, a notch between.
  if (style != 0 && e > 0.0) e *= 1.0 - 0.07 * pow(abs(sin(th * 11.0)), 0.6);
  return e;
}
void main() {
  vec4 base = fxSample(vTextureCoord);
  int style = int(uStyle + 0.5);
  float R = fxTokenRadius();
  // This fragment in token radii, in the art's own frame (y down), so the wings turn with the token.
  vec2 q = fxCanvasToArtDelta(fxCanvas()) * uArtSize / R;
  float side = q.x < 0.0 ? -1.0 : 1.0;
  float beat = sin(uTime * TAU);
  vec2 l = vec2(q.x * side, q.y) - vec2(0.12, -0.12);
  // A beat lifts the wing and folds it a little toward the viewer (shorter across).
  l = rot2(-0.32 * uBeat * beat) * l;
  l.x /= mix(1.0, 0.86, uBeat * (0.5 - 0.5 * beat));
  float r = length(l) / uSpan, th = atan(-l.y, l.x);
  float px = 1.2 / (uSpan * R * uZoom);
  float e = edgeAt(th, style);
  float wing = e > 0.0 ? smoothstep(px, -px, r - e) : 0.0;
  // Bones (leathery) or feather shafts: thin lines out from the shoulder along each finger.
  float bone = 0.0;
  if (style == 0) {
    for (int i = 0; i < 5; i++) {
      float a = fingerA(i);
      vec2 d = vec2(cos(a), -sin(a));
      float along = dot(l / uSpan, d), across = abs(dot(l / uSpan, vec2(-d.y, d.x)));
      float w = mix(0.035, 0.008, clamp(along / fingerL(i), 0.0, 1.0)) * (i == 4 ? 1.6 : 1.0);
      if (along > 0.0 && along < fingerL(i)) bone = max(bone, smoothstep(w + px, w - px, across));
    }
    wing = max(wing, bone);
  }
  vec3 col = uColor * (style == 0 ? 0.62 + 0.5 * (1.0 - r) : 0.9 + 0.2 * (1.0 - r)) * (0.9 + 0.15 * beat);
  if (style == 0) {
    // Thin skin: light through it near the edge, darker toward the body, a dark trailing rim.
    col *= 0.85 + 0.25 * smoothstep(0.4, 1.0, r / max(e, 0.01));
    col = mix(col, uBone, bone);
    col = mix(col, uBone, smoothstep(e - 4.0 * px, e, r) * 0.6);
  } else {
    // Feathers: rows of vanes, each a little darker along its shaft, longer flight feathers outside.
    float rows = abs(fract(th * 11.0 / PI) - 0.5);
    col *= 0.82 + 0.3 * smoothstep(0.0, 0.5, rows);
    col *= 0.88 + 0.18 * step(0.62, r);
  }
  float a = wing * uAlpha;
  vec4 o = fxBehind(base, col, a);
  if (style == 2) {
    // Light: the wing glows and a soft halo spills round it.
    float halo = e > 0.0 ? exp(-max(r - e, 0.0) * 7.0) * 0.8 : 0.0;
    o = fxBehind(o, mix(uColor, vec3(1.0), 0.35), halo * (1.0 - wing) * uAlpha);
    o.rgb += mix(uColor, vec3(1.0), 0.5) * wing * 0.6 * uAlpha * (1.0 - base.a);
  }
  gl_FragColor = o;
}`,
};

// Something growing over the creature's body, only on its art, spreading in patches as `amount` rises (0..1).
// `kind` 0: fungus, mould with pale caps sprouting from it; 1: mycelium, fine white threads branching over it;
// 2: coral, knobbly crusts in branching clumps; 3: scales, overlapping rows with a sheen; 4: ink, dark wet smears.
const growth = {
  type: 'growth', order: 360,
  defaults: { kind: 0, color: 0xd8cbb0, accent: 0x6f6a3c, amount: 1, scale: 1, time: 0 },
  timeScale: 1,
  uniforms: {
    uKind: ['int', p => clamp(Math.round(f(p.kind)), 0, 4)], uColor: ['vec3', p => rgb(p.color)], uAccent: ['vec3', p => rgb(p.accent)],
    uAmount: ['float', p => clamp(p.amount, 0, 1)], uScale: ['float', p => clamp(p.scale, 0.2, 5)],
  },
  reach: () => 0,
  glsl: `
void main() {
  vec4 base = fxSample(vTextureCoord);
  if (base.a <= 0.001) { gl_FragColor = base; return; }
  int kind = int(uKind + 0.5);
  float R = fxTokenRadius();
  // Across the art in token radii (the pattern turns and grows with the token), and a patch mask that spreads.
  vec2 a = (fxArt() - 0.5) * uArtSize / R * uScale;
  float patch = fbm(a * 1.6 + uSeed * 13.0) + 0.5;
  float reach = mix(-0.1, 1.15, uAmount);
  float cover = smoothstep(reach, reach - 0.12, patch);
  vec3 art = unpremul(base), col = art;
  float px = 1.0 / (R * uZoom) * uScale;
  if (kind == 0) {
    // Mould under, caps over: each cell may hold a round cap, lit on top, a dark gill rim below.
    float mould = smoothstep(0.35, 0.75, fbm(a * 9.0) + 0.5);
    col = mix(art, mix(uAccent, uColor * 0.8, mould), cover * 0.75);
    vec3 c = cells(a * 7.0, 0.0);
    float capR = 0.18 + 0.2 * hash11(c.z * 91.0);
    float cap = step(0.45, hash11(c.z * 17.0)) * smoothstep(capR + 5.0 * px, capR - 5.0 * px, c.x) * smoothstep(reach - 0.1, reach - 0.25, patch);
    vec3 capCol = uColor * (1.05 - 0.6 * smoothstep(capR * 0.4, capR, c.x));
    col = mix(col, capCol, cap);
  } else if (kind == 1) {
    // Threads: the thin ridges of two noises, crossing and branching.
    float t1 = abs(gnoise(a * 6.0)), t2 = abs(gnoise(a * 11.0 + 3.7));
    float w = 0.035 + 0.02 * smoothstep(0.0, 1.0, cover);
    float thread = max(smoothstep(w, 0.0, t1), smoothstep(w * 0.7, 0.0, t2) * 0.8);
    col = mix(art, art * 0.85, cover * 0.4);
    col = mix(col, uColor, thread * cover);
  } else if (kind == 2) {
    // Coral: knobbly cells, each a rounded bump, deeper colour in the crevices between.
    vec3 c = cells(a * 8.0, 0.0);
    float bump = smoothstep(0.0, 0.45, c.y - c.x);
    vec3 coral = mix(uAccent, uColor, bump) * (0.85 + 0.3 * hash11(c.z * 7.0));
    float dots = smoothstep(0.08, 0.02, length(fract(a * 26.0) - 0.5)) * bump;
    col = mix(art, coral * (1.0 + 0.25 * dots), cover * 0.9);
  } else if (kind == 3) {
    // Scales: offset rows of round-bottomed scales, each lighter at its top and edged dark, a sheen sliding over.
    vec2 g = a * vec2(4.2, 5.4);
    float row = floor(g.y);
    g.x += mod(row, 2.0) * 0.5;
    vec2 cellP = fract(g) - vec2(0.5, 0.0);
    float d = length(cellP * vec2(1.0, 1.3));
    float scale = smoothstep(0.62, 0.5, d);
    vec3 sc = mix(uAccent, uColor, smoothstep(0.6, 0.0, cellP.y)) * (0.8 + 0.25 * hash11(row * 3.1 + floor(g.x)));
    float sheen = pow(max(0.0, sin((a.x + a.y) * 3.0 - uTime * 1.2)), 12.0) * 0.4;
    col = mix(art, mix(uAccent * 0.4, sc + sheen, scale), cover * 0.85);
  } else {
    // Ink: dark smears dragged one way, wet highlights along them.
    vec2 s = vec2(a.x * 0.6 + a.y * 0.8, a.y * 2.2 - a.x * 0.4);
    float smear = smoothstep(0.42, 0.62, fbm(s * 2.4) + 0.5);
    float wet = pow(smoothstep(0.55, 0.75, fbm(s * 7.0 + 2.0) + 0.5), 3.0) * smear;
    col = mix(art, uColor, smear * cover * 0.9);
    col += vec3(0.35) * wet * cover;
  }
  gl_FragColor = vec4(clamp(col, 0.0, 1.0) * base.a, base.a);
}`,
};

export const FORM_SPECS = [wings, growth];
