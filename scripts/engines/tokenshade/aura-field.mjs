// Tokenshade aura fields: an aura drawn on the ground by a shader instead of looping footage. One quad under the
// tokens, as wide as the aura; the shader draws a crisp thin edge exactly at the reach, a motif in a narrow band just
// inside it (runes, hexes, flame, frost...) and only a breath of colour over the rest, so creatures inside stay clear.
// Pure data and GLSL here; the canvas mesh that carries it lives with the playback engine.
import { NOISE, COLOR } from './glsl.mjs';

// Motifs, by id. Each is a way of drawing the band at the edge of the reach.
export const AURA_MOTIFS = Object.freeze({
  dashes: 1, runes: 2, hexes: 3, flame: 4, frost: 5, wind: 6, vines: 7, sparks: 8, ripples: 9, shadow: 10, radiance: 11, storm: 12, notes: 13, skulls: 14, hearts: 15, eyes: 16, blades: 17, drops: 18,
  // Ground patterns across the whole area: a sigil drawn stroke by stroke, cracks opening, rime, smouldering ground.
  sigil: 19, cracks: 20, rime: 21, smoulder: 22,
});
export const AURA_MOTIF_NAMES = Object.freeze(Object.fromEntries(Object.entries(AURA_MOTIFS).map(([k, v]) => [v, k])));

// Defaults: how strong the edge, band and wash are (0..1), the band's share of the radius, and the pace.
export const AURA_FIELD_DEFAULTS = Object.freeze({ motif: 'dashes', color: 0x9ccff9, edge: 0.75, band: 0.6, wash: 0.05, bandWidth: 0.8, gap: 0.25, speed: 1, inward: false });

export const AURA_VERTEX = `
precision highp float;
attribute vec2 aVertexPosition;
uniform mat3 translationMatrix;
uniform mat3 projectionMatrix;
uniform float uExtent;
varying vec2 vLocal;
void main() {
  vLocal = aVertexPosition * uExtent;
  gl_Position = vec4((projectionMatrix * translationMatrix * vec3(vLocal, 1.0)).xy, 0.0, 1.0);
}`;

// Uniforms: uRadius reach in canvas px (the edge), uInner the creature's own radius, uZoom canvas→screen scale (for a
// one-screen-pixel edge at any zoom), uTime seconds, uMotif, uColor, uStrength (edge, band, wash), uBand band width and uGap
// its distance from the edge (canvas px), uInward 1 when the aura gathers toward its creature, uAlpha overall opacity.
const BODY = `
varying vec2 vLocal;
uniform float uRadius, uInner, uZoom, uTime, uBand, uGap, uInward, uAlpha;
uniform int uMotif;
uniform vec3 uColor;
uniform vec3 uStrength;

// A line r units from the edge: 1 on it, fading over w.
float line(float x, float w) { return smoothstep(w, 0.0, abs(x)); }

// Icons for the icon band, as signed distances in a cell (q about -0.5..0.5, y up = away from the creature);
// negative inside. Small shapes built from circles and boxes, so they stay crisp at any zoom.
float sdBox(vec2 q, vec2 b) { vec2 d = abs(q) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
float sdCircle(vec2 q, float r) { return length(q) - r; }
float iconSkull(vec2 q) {
  float head = min(sdCircle(q - vec2(0.0, 0.06), 0.27), sdBox(q - vec2(0.0, -0.19), vec2(0.13, 0.09)));
  float holes = min(min(sdCircle(q - vec2(-0.1, 0.04), 0.075), sdCircle(q - vec2(0.1, 0.04), 0.075)), sdBox(q - vec2(0.0, -0.08), vec2(0.025, 0.04)));
  float teeth = sdBox(vec2(mod(q.x + 0.045, 0.09) - 0.045, q.y + 0.26), vec2(0.012, 0.05));
  return max(max(head, -holes), -teeth);
}
float iconHeart(vec2 q) {
  q = q * 2.6 + vec2(0.0, 0.25); q.x = abs(q.x);
  float c = sdCircle(q - vec2(0.3, 0.25), 0.36);
  float v = sdBox(vec2(q.x * 0.7071 + q.y * 0.7071, q.x * -0.7071 + q.y * 0.7071) - vec2(-0.05, -0.05), vec2(0.42));
  return min(c, max(v, -q.y - 0.9)) / 2.6;
}
float iconEye(vec2 q) {
  float lid = max(sdCircle(q - vec2(0.0, -0.24), 0.36), sdCircle(q - vec2(0.0, 0.24), 0.36));
  float ring = abs(lid) - 0.025;
  return min(ring, sdCircle(q, 0.09));
}
float iconBlade(vec2 q) {
  float blade = sdBox(q - vec2(0.0, 0.08), vec2(0.035, 0.3));
  float tip = sdCircle(q - vec2(0.0, 0.38), 0.035);
  float guard = sdBox(q - vec2(0.0, -0.22), vec2(0.15, 0.025));
  float grip = sdBox(q - vec2(0.0, -0.32), vec2(0.025, 0.08));
  return min(min(min(blade, tip), guard), min(grip, sdCircle(q - vec2(0.0, -0.42), 0.04)));
}
float iconDrop(vec2 q) {
  q.y += 0.08;
  float bulb = sdCircle(q, 0.18);
  float cone = max(abs(q.x) - (0.42 - q.y) * 0.44, -q.y) ;
  return min(bulb, max(cone, q.y - 0.42));
}
// Icons orbiting just inside the edge, bobbing a little, one per cell; a few cells left empty.
float iconBand(int k, vec2 p, float e, float R, float bw, float t, float dir, float px) {
  float n = max(8.0, floor(TAU * R / (bw * 1.4)));
  float ang = atan(p.y, p.x);
  float a1 = (ang / TAU + dir * t * 0.008) * n, id = mod(floor(a1), n);
  float size = bw * 0.8;
  float bob = 0.12 * sin(t * 1.1 + id * 1.7);
  vec2 q = vec2((fract(a1) - 0.5) * (TAU * R / n) / size, -(e - bw * (0.5 + bob)) / size);
  float s = k == 14 ? iconSkull(q) : k == 15 ? iconHeart(q) : k == 16 ? iconEye(q) : k == 17 ? iconBlade(q) : iconDrop(q);
  float aa = 1.2 * px / size;
  return smoothstep(aa, -aa, s) * step(0.2, hash21(vec2(id, float(k))));
}

void main() {
  vec2 p = vLocal;
  float d = length(p), ang = atan(p.y, p.x), t = uTime;
  float px = 1.0 / max(uZoom, 0.05);                 // one screen pixel in canvas px
  float R = uRadius, bw = max(uBand, 6.0 * px);      // the band, a little inside the edge
  float e0 = R - d;                                  // distance inside the edge (negative beyond it)
  if (e0 < -3.0 * px - R * 0.04) discard;
  float e = e0 - uGap;                               // distance inside the band's outer side
  float u = clamp(e / bw, 0.0, 1.0);                 // 0 at the edge, 1 at the band's inner side
  float dir = uInward > 0.5 ? -1.0 : 1.0;
  float arc = ang * R;                               // canvas px along the edge
  vec3 col = uColor;
  float a = 0.0;

  // The edge: a crisp line at the reach, a soft glow inside it.
  float edge = line(e0, 1.2 * px + R * 0.002) + 0.35 * smoothstep(bw * 0.5, 0.0, e0) * step(0.0, e0);
  // The wash: a breath of colour, strongest near the edge, nothing near the creature.
  float wash = smoothstep(uInner * 1.3, R, d) * step(0.0, e0);

  float band = 0.0;
  vec3 bandCol = col;
  if (uMotif == 1) {
    // Dashes that turn slowly round the edge.
    float n = max(12.0, floor(R / 28.0) * 2.0);
    float k = fract((ang / TAU) * n + dir * t * 0.03);
    band = step(0.25, k) * step(k, 0.75) * line(e - bw * 0.25, bw * 0.12);
  } else if (uMotif == 2) {
    // A ring of runes between two thin lines, turning slowly: each rune a few strokes picked by its cell.
    float n = max(14.0, floor(TAU * R / (bw * 0.75)));
    float a1 = (ang / TAU + dir * t * 0.006) * n, id = mod(floor(a1), n);
    vec2 q = vec2(fract(a1) - 0.5, (e - bw * 0.5) / (bw * 0.75));
    float w = 0.07, k = hash21(vec2(id, 3.0)), k2 = hash21(vec2(id, 7.0));
    float glyph = step(abs(q.x - 0.0), w) * step(abs(q.y), 0.32);                                    // stem
    glyph = max(glyph, step(0.3, k) * step(abs(q.x + q.y * 0.7 - 0.05), w) * step(abs(q.y), 0.3));     // diagonal
    glyph = max(glyph, step(0.55, k) * step(abs(q.y - 0.28), w) * step(abs(q.x), 0.24));               // bar on top
    glyph = max(glyph, step(0.5, k2) * step(abs(length(q - vec2(0.12, -0.12)) - 0.12), w * 0.8));      // hook
    glyph = max(glyph, step(0.75, k2) * step(abs(q.x - q.y * 0.7 + 0.05), w) * step(abs(q.y), 0.22)); // second diagonal
    glyph *= step(0.15, hash21(vec2(id, 11.0)));                                                      // a gap now and then
    float glow = 0.75 + 0.25 * sin(t * 1.5 + id);
    band = glyph * glow + 0.6 * (line(e - bw * 0.05, 0.9 * px + R * 0.0012) + line(e - bw * 0.95, 0.9 * px + R * 0.0012));
    bandCol = mix(col, vec3(1.0), 0.25 * glyph);
  } else if (uMotif == 3) {
    // Hexagon cells along the edge, a few lit at a time.
    vec2 q = vec2(arc, e) / (bw * 0.45);
    vec2 r = vec2(1.0, 1.7320508), h = r * 0.5;
    vec2 g1 = mod(q, r) - h, g2 = mod(q - h, r) - h;
    vec2 g = dot(g1, g1) < dot(g2, g2) ? g1 : g2;
    vec2 ag = abs(g);
    float l = 0.5 - max(dot(ag, normalize(r)), ag.x);
    float pulse = 0.5 + 0.5 * sin(t * 1.2 + hash21(floor(q - g)) * TAU);
    band = (smoothstep(0.06, 0.0, l) * 0.8 + 0.15 * pulse) * (1.0 - u);
  } else if (uMotif == 4) {
    // Flame tongues licking inward from the edge.
    vec2 q = vec2(arc / bw * 0.9, e / bw * 1.6 - t * 0.9);
    float n = warped(q, t * 0.5);
    float tongue = smoothstep(0.25, 0.75, n - u * 0.85);
    band = tongue;
    bandCol = heatRamp(col, clamp(tongue * (1.1 - u), 0.0, 1.0));
  } else if (uMotif == 5) {
    // Frost: crystal spikes reaching in from the edge.
    float n = ridged(vec2(arc / bw * 1.4, 0.0) + vec2(0.0, t * 0.05));
    float spike = smoothstep(n * 0.9, n * 0.9 - 0.15, u);
    float glint = smoothstep(0.92, 1.0, ridged(vec2(arc, e) / bw * 3.0 + t * 0.1));
    band = spike * 0.75 + glint * 0.6 * (1.0 - u);
    bandCol = mix(col, vec3(0.92, 0.97, 1.0), 0.35 + 0.4 * glint);
  } else if (uMotif == 6) {
    // Wind streaks running round the edge.
    float s = gnoise(vec2(arc / (bw * 3.0) - dir * t * 0.8, e / bw * 3.0));
    float s2 = gnoise(vec2(arc / (bw * 1.6) - dir * t * 1.3 + 11.0, e / bw * 5.0));
    band = (smoothstep(0.15, 0.45, s) + 0.6 * smoothstep(0.25, 0.55, s2)) * (1.0 - u);
    bandCol = mix(col, vec3(1.0), 0.3);
  } else if (uMotif == 7) {
    // Two vines braiding along the edge, with buds.
    float w = 1.4 * px + bw * 0.04;
    float v1 = line(e - bw * (0.35 + 0.25 * sin(arc / bw * 1.3 + t * 0.2)), w);
    float v2 = line(e - bw * (0.35 + 0.25 * sin(arc / bw * 1.3 + PI + t * 0.2)), w);
    vec3 c = cells(vec2(arc, e) / (bw * 0.5), 0.0);
    float bud = smoothstep(0.12, 0.0, c.x) * step(0.8, c.z) * (1.0 - u);
    band = v1 + v2 + bud;
    bandCol = mix(col, col * 1.3 + 0.1, bud);
  } else if (uMotif == 8) {
    // Sparks drifting in the band, twinkling: a bright core and a soft halo, a cross glint on the brightest.
    vec2 q = vec2(arc - dir * t * bw * 0.2, e) / (bw * 0.55);
    vec3 c = cells(q, t * 0.5);
    float tw = 0.45 + 0.55 * sin(t * 2.5 + c.z * TAU);
    float on = step(0.4, c.z) * tw;
    vec2 g = fract(q) - 0.5;
    float cross = smoothstep(0.03, 0.0, min(abs(g.x), abs(g.y))) * smoothstep(0.35, 0.0, length(g)) * step(0.85, c.z);
    band = (smoothstep(0.14, 0.02, c.x) + 0.5 * smoothstep(0.38, 0.0, c.x) + cross * 0.8) * on * smoothstep(1.0, 0.55, u);
    bandCol = mix(col, vec3(1.0), 0.55);
  } else if (uMotif == 9) {
    // Slow ripples crossing the whole reach.
    float k = fract(d / (R * 0.2) - dir * t * 0.08);
    band = 0.0;
    wash += 0.5 * smoothstep(0.08, 0.0, abs(k - 0.5) - 0.02) * smoothstep(uInner * 1.3, R, d);
  } else if (uMotif == 10) {
    // Shadow: a dark smoky band that dims the ground, veined with the aura's colour.
    float n = warped(vec2(arc, e) / bw * 0.8 + vec2(dir * t * 0.15, 0.0), t * 0.3);
    float smoke = smoothstep(0.35, 0.8, n) * (1.0 - u);
    float vein = smoothstep(0.86, 0.98, ridged(vec2(arc, e) / bw * 1.2 + t * 0.05)) * (1.0 - u);
    band = smoke * 0.8 + vein;
    bandCol = mix(col * 0.12, col, vein);
  } else if (uMotif == 11) {
    // Radiance: soft rays leaning in from the edge, a bright rim.
    float rays = 0.5 + 0.5 * sin(ang * max(18.0, floor(R / 30.0)) + t * 0.25 + gnoise(vec2(ang * 3.0, t * 0.2)) * 2.0);
    band = pow(rays, 3.0) * (1.0 - u) * 0.8;
    edge *= 1.3;
    bandCol = mix(col, vec3(1.0, 0.98, 0.9), 0.4);
  } else if (uMotif == 12) {
    // Storm: lightning crackling along the edge now and then.
    float flick = step(0.6, hash11(floor(t * 6.0)));
    float bolt = smoothstep(0.92, 0.99, ridged(vec2(arc / bw * 1.2 + floor(t * 6.0) * 7.0, e / bw * 2.0)));
    band = bolt * (1.0 - u) * (0.35 + 0.65 * flick);
    bandCol = mix(col, vec3(1.0), 0.6);
  } else if (uMotif >= 14 && uMotif <= 18) {
    // Icons: skulls, hearts, eyes, blades or drops, with a faint line along their inner side.
    band = iconBand(uMotif, p, e, R, bw, t, dir, px) * 0.85 + 0.35 * line(e - bw * 1.05, 0.9 * px + R * 0.0012);
    bandCol = mix(col, vec3(1.0), 0.15);
  } else if (uMotif == 13) {
    // Notes: music notes drifting round the band, bobbing as they go.
    float n = max(10.0, floor(TAU * R / (bw * 1.3)));
    float a1 = (ang / TAU + dir * t * 0.012) * n, id = mod(floor(a1), n);
    float bob = 0.18 * sin(t * 1.4 + id * 2.3);
    vec2 q = vec2((fract(a1) - 0.5) * 1.6, (e - bw * (0.45 + bob)) / (bw * 0.7));
    vec2 hq = (q - vec2(-0.08, -0.18)) * vec2(1.0, 1.45);
    float head = smoothstep(0.24, 0.19, length(hq));
    float stem = step(abs(q.x - 0.07), 0.035) * step(-0.18, q.y) * step(q.y, 0.42);
    float flag = step(0.5, hash21(vec2(id, 2.0))) * step(abs(q.y - 0.42 + (q.x - 0.07) * 0.9), 0.05) * step(0.07, q.x) * step(q.x, 0.28);
    band = (head + stem + flag) * step(0.25, hash21(vec2(id, 9.0))) * (0.7 + 0.3 * sin(t * 2.0 + id));
    bandCol = mix(col, vec3(1.0), 0.2);
  }
  band *= step(-px, e);

  // Ground patterns: drawn across the whole area, not only its edge band (they suit a spell's area best).
  float fill = 0.0;
  vec3 fillCol = col;
  float inside = step(0.0, e0) * smoothstep(uInner * 0.9, uInner * 1.3, d);
  if (uMotif == 19) {
    // Sigil: a circle and a five-pointed star drawn stroke by stroke over four seconds, then held, pulsing gently.
    float drawn = clamp(t * 0.25, 0.0, 1.0), w = 1.4 * px + R * 0.004, rr = R * 0.82;
    float circle = line(d - rr, w) * step(fract(ang / TAU + 0.25), drawn);
    float star = 0.0;
    for (int i = 0; i < 5; i++) {
      float fi = float(i);
      vec2 a0 = vec2(cos(fi * 2.0 * TAU / 5.0 - PI * 0.5), sin(fi * 2.0 * TAU / 5.0 - PI * 0.5)) * rr;
      vec2 a1 = vec2(cos((fi + 1.0) * 2.0 * TAU / 5.0 - PI * 0.5), sin((fi + 1.0) * 2.0 * TAU / 5.0 - PI * 0.5)) * rr;
      vec2 ab = a1 - a0; float h = clamp(dot(p - a0, ab) / dot(ab, ab), 0.0, 1.0);
      // Each stroke draws in its turn, from one point to the next.
      float upTo = clamp(drawn * 5.0 - fi, 0.0, 1.0);
      star = max(star, line(length(p - a0 - ab * h), w) * step(h, upTo));
    }
    fill = (circle + star) * (0.75 + 0.25 * sin(t * 1.6));
    fillCol = mix(col, vec3(1.0), 0.3);
  } else if (uMotif == 20) {
    // Cracks: splitting the ground from the middle outward over about six seconds, glowing where they open.
    float reach = clamp(t * 0.16, 0.0, 1.0) * R;
    vec3 c = cells(p / (R * 0.16), 0.0);
    float crack = smoothstep(0.06, 0.0, c.y - c.x) * step(0.4, hash21(floor(p / (R * 0.16)) + c.z));
    float open = smoothstep(reach, reach - R * 0.08, d + gnoise(p / (R * 0.1)) * R * 0.05);
    float tip = smoothstep(R * 0.06, 0.0, abs(d - reach)) * step(d, R);
    fill = crack * open * inside;
    fillCol = mix(col * 0.3, mix(col, vec3(1.0, 0.85, 0.6), 0.5), tip + 0.3);
  } else if (uMotif == 21) {
    // Rime: frost crystals across the ground, glinting.
    vec2 q = p / (R * 0.12);
    float frost = smoothstep(0.5, 0.75, fbm(q) + 0.5) * 0.55 + smoothstep(0.92, 1.0, ridged(q * 2.0)) * 0.5;
    float glint = smoothstep(0.96, 1.0, hash21(floor(q * 6.0))) * (0.5 + 0.5 * sin(t * 3.0 + hash21(floor(q * 6.0)) * TAU));
    fill = (frost + glint) * inside;
    fillCol = mix(col, vec3(0.92, 0.97, 1.0), 0.5 + 0.4 * glint);
  } else if (uMotif == 22) {
    // Smoulder: dark ash patches with embers glowing in their seams, breathing.
    vec2 q = p / (R * 0.14);
    vec3 c = cells(q, t * 0.1);
    float ash = smoothstep(0.45, 0.8, fbm(q * 0.6) + 0.5);
    float seam = smoothstep(0.08, 0.0, c.y - c.x);
    float breathe = 0.6 + 0.4 * sin(t * 1.3 + c.z * TAU);
    fill = (ash * 0.45 + seam * breathe) * inside;
    fillCol = mix(col * 0.12, heatRamp(col, 0.75 * breathe), seam);
  }

  vec3 rgb = col * edge * uStrength.x + bandCol * band * uStrength.y + col * wash * uStrength.z + fillCol * fill * uStrength.y;
  a = clamp(edge * uStrength.x + band * uStrength.y + wash * uStrength.z + fill * uStrength.y, 0.0, 1.0) * uAlpha;
  // Premultiplied out; shadow darkens what it covers.
  gl_FragColor = vec4(rgb * uAlpha, a);
}`;

export const AURA_FRAGMENT = `precision highp float;\nconst float PI = 3.14159265;\nconst float TAU = 6.28318531;\n${NOISE}\n${COLOR}\n${BODY}`;

// Uniform values for a field, from its settings (pure: tests and the preview use it).
export function auraUniforms(settings = {}, { radius = 300, inner = 50, zoom = 1, time = 0, grid = 100 } = {}) {
  const s = { ...AURA_FIELD_DEFAULTS, ...settings };
  const color = Number(s.color) >>> 0;
  return {
    uRadius: Math.max(1, Number(radius) || 1), uInner: Math.max(0, Number(inner) || 0), uZoom: Math.max(0.05, Number(zoom) || 1),
    uTime: (Number(time) || 0) * Math.max(0, Number(s.speed) || 0), uMotif: AURA_MOTIFS[s.motif] ?? 1,
    uColor: [((color >> 16) & 255) / 255, ((color >> 8) & 255) / 255, (color & 255) / 255],
    uStrength: [s.edge, s.band, s.wash].map((v) => Math.min(1, Math.max(0, Number(v) || 0))),
    // Band width and its gap from the edge are in grid squares, so icons look the same on a 10 or a 90 foot aura.
    uBand: Math.min(2, Math.max(0.2, Number(s.bandWidth) || 0.6)) * grid, uGap: Math.min(1.5, Math.max(0, Number(s.gap) || 0)) * grid,
    uInward: s.inward ? 1 : 0, uAlpha: 1,
  };
}
